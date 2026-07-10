import { describe, expect, it, vi } from "vitest";

import {
  PR1_INTEGRATED_GAME_SESSION_ALIAS,
  initializeGameSessionRuntime,
} from "@wuming-town/sim-core";
import {
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

import { connectSimulationWorkerPort, createSimulationWorker } from "./index";
import { GameSessionWorkerOutbox } from "./game-session-worker-outbox";
import {
  RecordingSimulationWorkerPort,
  commandMessage,
  countKind,
  emptyCommandBatchMessage,
  findReady,
  findRender,
  findUi,
  gameSessionLoadMessage,
  initMessage,
  isStrictlyIncreasingSequence,
  legacyInitMessage,
  mixedUnsupportedBatchMessage,
  pauseMessage,
  readLatestTick,
  readLatestUi,
  readProjectionPair,
  requestSaveMessage,
  requestUiDetailMessage,
  setSpeedMessage,
  shutdownMessage,
} from "./game-session-worker-test-support";

describe("PR-1 GameSession Simulation Worker", () => {
  it("negotiates schema-v3 projection v1 and publishes coherent initial payloads", () => {
    const messages = createSimulationWorker().receive(initMessage());
    const ready = findReady(messages);
    const render = findRender(messages);
    const ui = findUi(messages);

    expect(ready.payload).toMatchObject({
      acceptedProtocolVersion: 1,
      acceptedSchemaVersion: 3,
      projectionContract: { kind: "game_session", version: 1 },
    });
    expect(render.payload.gameSession?.entities).toHaveLength(22);
    expect(ui.payload.gameSession?.residents).toHaveLength(8);
    expect(ui.payload.gameSession?.resources.map((row) => row.resourceKind)).toEqual([
      "food",
      "wood",
      "stone",
      "lamp_oil",
    ]);
    expect(readProjectionPair(render, ui)).toEqual({ ok: true });
  });

  it("fails closed when the PR-1 catalog omits negotiation", () => {
    const messages = createSimulationWorker().receive({
      ...initMessage(),
      payload: { seed: "5", catalogVersion: PR1_INTEGRATED_GAME_SESSION_ALIAS },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
      payload: { reason: { code: "InvalidPayload" } },
    });
  });

  it("applies 0/30/60/90 TPS policy on future scheduler quanta and preserves speed on pause", () => {
    const worker = createSimulationWorker();
    worker.receive(initMessage());
    expect(readLatestTick(worker.runScheduledQuantum())).toBe(3);

    const speed2 = worker.receive(setSpeedMessage(2, 2));
    expect(readLatestTick(speed2)).toBe(3);
    expect(readLatestTick(worker.runScheduledQuantum())).toBe(9);

    const paused = worker.receive(pauseMessage(3, true));
    expect(readLatestUi(paused).payload.gameSession).toMatchObject({
      paused: true,
      requestedSpeed: 2,
      effectiveTicksPerSecond: 0,
    });
    expect(worker.runScheduledQuantum()).toEqual([]);

    const speed3 = worker.receive(setSpeedMessage(4, 3));
    expect(readLatestUi(speed3).payload.gameSession).toMatchObject({
      paused: true,
      requestedSpeed: 3,
      effectiveTicksPerSecond: 0,
    });
    worker.receive(pauseMessage(5, false));
    expect(readLatestTick(worker.runScheduledQuantum())).toBe(18);

    worker.receive(setSpeedMessage(6, 0));
    expect(worker.runScheduledQuantum()).toEqual([]);
  });

  it("matches headless hashes for the same seed, command stream, and checkpoint", () => {
    const worker = createSimulationWorker();
    worker.receive(initMessage());
    expect(worker.receive(commandMessage(2, "parity.noop"))[0]).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
      payload: { accepted: true },
    });
    let checkpoint: readonly SimulationToMainMessage[] = [];
    for (let quantum = 0; quantum < 10; quantum += 1) {
      checkpoint = worker.runScheduledQuantum();
    }
    const workerUi = readLatestUi(checkpoint).payload.gameSession;
    expect(workerUi).toBeDefined();

    const initialized = initializeGameSessionRuntime({ seed: "5" });
    if (!initialized.ok) throw new Error(initialized.reason);
    const queued = initialized.runtime.queueCommand({
      tick: 0,
      commandId: "parity.noop",
      kind: "noop",
    });
    if (!queued.ok) throw new Error(queued.reason);
    initialized.runtime.advanceTicks(30);
    expect(workerUi?.basis).toMatchObject({
      tick: 30,
      worldHash: initialized.runtime.createWorldHash(),
      readModelHash: initialized.runtime.createReadModelHash(),
    });
  });

  it("rejects a mixed unsupported batch without mutating checkpoint authority", () => {
    const control = createSimulationWorker();
    control.receive(initMessage());
    expect(control.receive(emptyCommandBatchMessage(2))[0]).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
      payload: { accepted: true, batchAccepted: true },
    });

    const rejected = createSimulationWorker();
    rejected.receive(initMessage());
    expect(rejected.receive(mixedUnsupportedBatchMessage(2))[0]).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
      payload: { accepted: false, batchAccepted: false },
    });

    const controlBasis = readLatestUi(control.runScheduledQuantum()).payload.gameSession?.basis;
    const rejectedBasis = readLatestUi(rejected.runScheduledQuantum()).payload.gameSession?.basis;
    expect(rejectedBasis).toMatchObject({
      tick: controlBasis?.tick,
      worldHash: controlBasis?.worldHash,
      readModelHash: controlBasis?.readModelHash,
    });
    expect(controlBasis).toMatchObject({
      worldHash: "0x0fba7fbb",
      readModelHash: "0x7c1484a3",
    });
  });

  it("clears the scheduler immediately on accepted Shutdown and remains callback-safe", () => {
    vi.useFakeTimers();
    try {
      const worker = createSimulationWorker();
      const port = new RecordingSimulationWorkerPort();
      const connection = connectSimulationWorkerPort(port, worker);
      expect(vi.getTimerCount()).toBe(1);

      port.dispatch(initMessage());
      port.dispatch(shutdownMessage(2));
      const postedAtShutdown = port.messages.length;
      expect(vi.getTimerCount()).toBe(0);
      expect(worker.runScheduledQuantum()).toEqual([]);

      vi.advanceTimersByTime(1_000);
      expect(port.messages).toHaveLength(postedAtShutdown);
      connection.disconnect();
      connection.disconnect();
      expect(vi.getTimerCount()).toBe(0);
      expect(port.removeCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails GameSession save closed without emitting a fake SaveReady", () => {
    const worker = createSimulationWorker();
    worker.receive(initMessage());
    const messages = worker.receive(requestSaveMessage(2));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
      payload: { accepted: false, reason: { code: "LifecycleError" } },
    });
  });

  it("fails versioned GameSession load closed with a structured fatal", () => {
    const messages = createSimulationWorker().receive(gameSessionLoadMessage());
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
      payload: { reason: { code: "LifecycleError" } },
    });
  });

  it("publishes requested resident, resource, and structure owner details", () => {
    const worker = createSimulationWorker();
    const entities = findRender(worker.receive(initMessage())).payload.gameSession?.entities;
    if (entities === undefined) throw new Error("GameSession render projection missing");
    const resident = entities.find((entity) => entity.kind === "resident");
    const resource = entities.find((entity) => entity.kind === "resource");
    const structure = entities.find((entity) => entity.kind === "build_site");
    if (resident === undefined || resource === undefined || structure === undefined) {
      throw new Error("required selection subjects missing");
    }

    expect(
      readLatestUi(worker.receive(requestUiDetailMessage(2, resident.entity))).payload.gameSession
        ?.selectionDetail?.kind,
    ).toBe("resident");
    expect(
      readLatestUi(worker.receive(requestUiDetailMessage(3, resource.entity))).payload.gameSession
        ?.selectionDetail?.kind,
    ).toBe("resource");
    expect(
      readLatestUi(worker.receive(requestUiDetailMessage(4, structure.entity))).payload.gameSession
        ?.selectionDetail?.kind,
    ).toBe("structure");
  });

  it("keeps projections latest-wins while preserving reliable sequence order", () => {
    const worker = createSimulationWorker();
    const outbox = new GameSessionWorkerOutbox();
    outbox.enqueue(worker.receive(initMessage()));
    outbox.enqueue(worker.receive(commandMessage(2, "reliable.noop")));
    outbox.enqueue(worker.runScheduledQuantum());
    outbox.enqueue(worker.runScheduledQuantum());
    const metricsBeforeDrain = outbox.createMetrics();
    const drained = outbox.drain();

    expect(metricsBeforeDrain.droppedSnapshots).toBeGreaterThan(0);
    expect(metricsBeforeDrain.queuedReliableMessages).toBeGreaterThanOrEqual(2);
    expect(countKind(drained, SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot)).toBe(1);
    expect(countKind(drained, SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta)).toBe(1);
    expect(countKind(drained, SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult)).toBe(1);
    expect(countKind(drained, SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch)).toBeGreaterThan(0);
    expect(isStrictlyIncreasingSequence(drained)).toBe(true);
  });

  it("does not drop CommandResult, SaveReady, or Fatal around pause", () => {
    const legacyWorker = createSimulationWorker();
    const outbox = new GameSessionWorkerOutbox();
    outbox.enqueue(legacyWorker.receive(legacyInitMessage()));
    outbox.enqueue(legacyWorker.receive(pauseMessage(2, true)));
    outbox.enqueue(legacyWorker.receive(requestSaveMessage(3)));
    const drained = outbox.drain();
    expect(countKind(drained, SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult)).toBe(2);
    expect(countKind(drained, SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady)).toBe(1);

    const fatalWorker = createSimulationWorker();
    const fatalOutbox = new GameSessionWorkerOutbox();
    fatalOutbox.enqueue(
      fatalWorker.receive({
        ...initMessage(),
        payload: { seed: "5", catalogVersion: PR1_INTEGRATED_GAME_SESSION_ALIAS },
      }),
    );
    expect(
      countKind(fatalOutbox.drain(), SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError),
    ).toBe(1);
  });
});
