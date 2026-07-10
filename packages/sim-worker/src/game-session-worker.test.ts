import { describe, expect, it } from "vitest";

import {
  PR1_INTEGRATED_GAME_SESSION_ALIAS,
  initializeGameSessionRuntime,
} from "@wuming-town/sim-core";
import {
  GAME_SESSION_PROJECTION_VERSION,
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  validateCoherentGameSessionProjectionPair,
  type GameSessionRenderProjectionV1,
  type GameSessionUiProjectionV1,
  type LoadSessionMessage,
  type MainToSimulationMessage,
  type PauseMessage,
  type ReadyMessage,
  type RenderSnapshotMessage,
  type RequestSaveMessage,
  type RequestUiDetailMessage,
  type SetSpeedMessage,
  type SimulationToMainMessage,
  type UiDeltaMessage,
} from "@wuming-town/sim-protocol";

import {
  createBrowserSimulationWorkerSession,
  createSimulationWorker,
  type BrowserSimulationWorkerHandle,
  type BrowserSimulationWorkerMessageEvent,
} from "./index";
import { GameSessionWorkerOutbox } from "./game-session-worker-outbox";

describe("PR-1 GameSession Simulation Worker", () => {
  it("negotiates schema-v3 projection v1 and publishes coherent initial payloads", () => {
    const worker = createSimulationWorker();
    const messages = worker.receive(initMessage());
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
    const worker = createSimulationWorker();
    const messages = worker.receive({
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

  it("matches headless GameSession hashes for the same seed, command stream, and checkpoint", () => {
    const worker = createSimulationWorker();
    worker.receive(initMessage());
    const accepted = worker.receive(commandMessage(2, "parity.noop"));
    expect(accepted[0]).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult,
      payload: { accepted: true },
    });
    let checkpoint: readonly SimulationToMainMessage[] = [];
    for (let quantum = 0; quantum < 10; quantum += 1) checkpoint = worker.runScheduledQuantum();
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

  it("publishes requested resident, resource, and structure details from owner projections", () => {
    const worker = createSimulationWorker();
    const initial = worker.receive(initMessage());
    const entities = findRender(initial).payload.gameSession?.entities;
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

  it("keeps projections latest-wins while preserving reliable messages in sequence order", () => {
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

  it("does not drop CommandResult, SaveReady, or Fatal around pause and queued projections", () => {
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

  it("browser session closes fatally on missing negotiated payload and keeps stale render droppable", () => {
    const fake = new FakeBrowserWorker();
    const session = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const received: SimulationToMainMessage[] = [];
    session.subscribe((message) => received.push(message));
    const init = session.initGameSession({ seed: "5" });
    expect(session.getState()).toBe("initializing");
    const responses = createSimulationWorker().receive(init);
    for (const message of responses) fake.emit(message);
    expect(session.getState()).toBe("active");

    const currentRender = findRender(responses);
    fake.emit({
      ...currentRender,
      sequence: 100,
      payload: {
        ...currentRender.payload,
        snapshotSequence: 0,
        gameSession: "malformed stale payload is safely droppable",
      },
    });
    expect(session.getState()).toBe("active");

    fake.emit({
      ...findUi(responses),
      sequence: 101,
      payload: { tick: 0, summaries: [], readOnly: true },
    });
    expect(session.getState()).toBe("fatal");
    expect(fake.terminateCount).toBe(1);
    expect(received.at(-1)).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
      payload: { reason: { code: "LifecycleError" } },
    });
  });

  it("does not enter active before Ready and fails an early projection closed", () => {
    const fake = new FakeBrowserWorker();
    const session = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const init = session.initGameSession();
    expect(session.getState()).toBe("initializing");
    const responses = createSimulationWorker().receive(init);
    fake.emit(findRender(responses));
    expect(session.getState()).toBe("fatal");
    expect(fake.terminateCount).toBe(1);
  });

  it("browser session closes on mismatched Ready and incoherent newer basis", () => {
    const mismatched = new FakeBrowserWorker();
    const first = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => mismatched,
    });
    first.initGameSession();
    const ready = findReady(createSimulationWorker().receive(initMessage()));
    mismatched.emit({
      ...ready,
      payload: { ...ready.payload, projectionContract: { kind: "game_session", version: 99 } },
    });
    expect(first.getState()).toBe("fatal");

    const fake = new FakeBrowserWorker();
    const second = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const init = second.initGameSession();
    const responses = createSimulationWorker().receive(init);
    for (const message of responses) fake.emit(message);
    const ui = findUi(responses);
    const projection = ui.payload.gameSession;
    if (projection === undefined) throw new Error("missing projection");
    fake.emit({
      ...ui,
      sequence: 200,
      payload: {
        ...ui.payload,
        readModelHash: "0xincoherent",
        gameSession: {
          ...projection,
          basis: { ...projection.basis, snapshotSequence: 2, readModelHash: "0xincoherent" },
        },
      },
    });
    expect(second.getState()).toBe("active");
    const render = findRender(responses);
    const renderProjection = render.payload.gameSession;
    if (renderProjection === undefined) throw new Error("missing render projection");
    fake.emit({
      ...render,
      sequence: 201,
      payload: {
        ...render.payload,
        snapshotSequence: 2,
        gameSession: {
          ...renderProjection,
          basis: { ...renderProjection.basis, snapshotSequence: 2 },
        },
      },
    });
    expect(second.getState()).toBe("fatal");
  });

  it("browser session fails schema-v2 and malformed newer render rows closed", () => {
    const schemaWorker = new FakeBrowserWorker();
    const schemaSession = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => schemaWorker,
    });
    schemaSession.initGameSession();
    const ready = findReady(createSimulationWorker().receive(initMessage()));
    schemaWorker.emit({ ...ready, schemaVersion: 2 });
    expect(schemaSession.getState()).toBe("fatal");

    const fake = new FakeBrowserWorker();
    const session = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const init = session.initGameSession();
    const responses = createSimulationWorker().receive(init);
    for (const message of responses) fake.emit(message);
    const render = findRender(responses);
    const projection = render.payload.gameSession;
    const firstEntity = projection?.entities[0];
    if (projection === undefined || firstEntity === undefined) throw new Error("render missing");
    fake.emit({
      ...render,
      sequence: 300,
      payload: {
        ...render.payload,
        snapshotSequence: 2,
        tick: 3,
        worldHash: "0xmalformed",
        readModelHash: "0xmalformed-read",
        gameSession: {
          ...projection,
          basis: {
            ...projection.basis,
            tick: 3,
            snapshotSequence: 2,
            worldHash: "0xmalformed",
            readModelHash: "0xmalformed-read",
          },
          entities: [{ ...firstEntity, xQ16: -1 }],
        },
      },
    });
    expect(session.getState()).toBe("fatal");
  });
});

class FakeBrowserWorker implements BrowserSimulationWorkerHandle {
  readonly posted: MainToSimulationMessage[] = [];
  terminateCount = 0;
  private readonly listeners: ((event: BrowserSimulationWorkerMessageEvent) => void)[] = [];

  postMessage(message: MainToSimulationMessage): void {
    this.posted.push(message);
  }

  addEventListener(
    _type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    this.listeners.push(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  emit(message: unknown): void {
    const snapshot = [...this.listeners];
    for (const listener of snapshot) listener({ data: message });
  }
}

function initMessage(): MainToSimulationMessage {
  return {
    ...base(1),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "5",
      catalogVersion: PR1_INTEGRATED_GAME_SESSION_ALIAS,
      projectionRequest: { kind: "game_session", version: GAME_SESSION_PROJECTION_VERSION },
    },
  };
}

function legacyInitMessage(): MainToSimulationMessage {
  return {
    ...base(1),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: { seed: "legacy", catalogVersion: "catalog-legacy" },
  };
}

function commandMessage(sequence: number, commandId: string): MainToSimulationMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: { commands: [{ commandId, kind: PLAYER_COMMAND_KIND.Noop }] },
  };
}

function setSpeedMessage(sequence: number, speed: 0 | 1 | 2 | 3): SetSpeedMessage {
  return { ...base(sequence), kind: MAIN_TO_SIMULATION_MESSAGE_KIND.SetSpeed, payload: { speed } };
}

function pauseMessage(sequence: number, paused: boolean): PauseMessage {
  return { ...base(sequence), kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Pause, payload: { paused } };
}

function requestSaveMessage(sequence: number): RequestSaveMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
    payload: { reason: "manual" },
  };
}

function requestUiDetailMessage(
  sequence: number,
  entity: { readonly index: number; readonly generation: number },
): RequestUiDetailMessage {
  return {
    ...base(sequence),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
    payload: {
      subject: { kind: "entity", entityId: `${String(entity.index)}:${String(entity.generation)}` },
    },
  };
}

function gameSessionLoadMessage(): LoadSessionMessage {
  return {
    ...base(1),
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.LoadSession,
    payload: { saveId: "game-session:v1:unsupported", checkpointSequence: 0 },
  };
}

function base(sequence: number): {
  readonly protocolVersion: 1;
  readonly schemaVersion: 3;
  readonly sessionId: "session-a";
  readonly sequence: number;
} {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
  };
}

function findRender(messages: readonly SimulationToMainMessage[]): RenderSnapshotMessage {
  for (const message of messages) if (message.kind === "RenderSnapshot") return message;
  throw new Error("RenderSnapshot missing");
}

function findUi(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  for (const message of messages) if (message.kind === "UiDelta") return message;
  throw new Error("UiDelta missing");
}

function findReady(messages: readonly SimulationToMainMessage[]): ReadyMessage {
  for (const message of messages) if (message.kind === "Ready") return message;
  throw new Error("Ready missing");
}

function readLatestUi(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  let latest: UiDeltaMessage | undefined;
  for (const message of messages) if (message.kind === "UiDelta") latest = message;
  if (latest === undefined) throw new Error("UiDelta missing");
  return latest;
}

function readLatestTick(messages: readonly SimulationToMainMessage[]): number {
  return readLatestUi(messages).payload.gameSession?.basis.tick ?? -1;
}

function readProjectionPair(
  render: RenderSnapshotMessage,
  ui: UiDeltaMessage,
): ReturnType<typeof validateCoherentGameSessionProjectionPair> {
  const renderProjection: GameSessionRenderProjectionV1 | undefined = render.payload.gameSession;
  const uiProjection: GameSessionUiProjectionV1 | undefined = ui.payload.gameSession;
  if (renderProjection === undefined || uiProjection === undefined)
    throw new Error("projection missing");
  return validateCoherentGameSessionProjectionPair(renderProjection, uiProjection);
}

function countKind(messages: readonly SimulationToMainMessage[], kind: string): number {
  let count = 0;
  for (const message of messages) if (message.kind === kind) count += 1;
  return count;
}

function isStrictlyIncreasingSequence(messages: readonly SimulationToMainMessage[]): boolean {
  let previous = 0;
  for (const message of messages) {
    if (message.sequence <= previous) return false;
    previous = message.sequence;
  }
  return true;
}
