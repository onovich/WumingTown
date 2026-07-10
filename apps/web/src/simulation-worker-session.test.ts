import { describe, expect, it } from "vitest";

import type {
  BrowserSimulationWorkerHandle,
  BrowserSimulationWorkerMessageEvent,
} from "@wuming-town/sim-worker";
import { createSimulationWorker } from "@wuming-town/sim-worker";
import {
  createGameSessionLifecycleReadModel,
  createGameSessionWorldReadModel,
  createWebGameSessionProjectionAssembler,
  type WebGameSessionProjectionFrame,
} from "./playable-worker-projection";
import {
  GAME_SESSION_PROJECTION_VERSION,
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type MainToSimulationMessage,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

import {
  WEB_GAME_SESSION_DEFAULT_SEED,
  WEB_GAME_SESSION_SCENARIO_ID,
  WEB_PLAYABLE_WORKER_SCENARIO_ID,
  advanceWebPlayableWorkerScenarioToTick,
  createWebSimulationWorkerSession,
  drainWebPlayableCommandsToTerminal,
  readWebGameSessionRenderProjection,
  readWebGameSessionUiProjection,
  sendWebPlayableCommandBatch,
  startWebPlayableWorkerScenario,
  startWebGameSession,
  readWebPlayableProjection,
  waitForWebPlayableProjectionAtOrBeyondTick,
} from "./simulation-worker-session";

describe("web Simulation Worker session bridge adapter", () => {
  it("requests the exact PR-1 GameSession contract and waits for validated Ready", () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });

    const init = startWebGameSession(session);

    expect(session.getState()).toBe("initializing");
    expect(init).toStrictEqual({
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "web-session",
      sequence: 1,
      kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
      payload: {
        seed: WEB_GAME_SESSION_DEFAULT_SEED,
        catalogVersion: WEB_GAME_SESSION_SCENARIO_ID,
        projectionRequest: {
          kind: "game_session",
          version: GAME_SESSION_PROJECTION_VERSION,
        },
      },
    });

    worker.dispatch({ ...gameSessionReady(), sequence: 1 });
    expect(session.getState()).toBe("active");
    session.destroy();
  });

  it("reads GameSession render and UI payloads from public fields without summaries", () => {
    const transport = new RecordingBrowserWorker();
    const browserSession = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => transport,
    });
    const init = startWebGameSession(browserSession);
    const messages = createSimulationWorker().receive(init);
    const render = messages.find(
      (message) => message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
    );
    const ui = messages.find((message) => message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta);
    if (render === undefined || ui === undefined) {
      throw new Error("Expected initial GameSession render/UI projections.");
    }

    expect(readWebGameSessionRenderProjection(render)?.entities).toHaveLength(22);
    expect(readWebGameSessionUiProjection(ui)?.residents).toHaveLength(8);
    expect(readWebGameSessionRenderProjection(ui)).toBeUndefined();
    expect(readWebGameSessionUiProjection(render)).toBeUndefined();
    browserSession.destroy();
  });

  it("fails malformed negotiated GameSession payloads closed without a legacy fallback", () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });
    const assembler = createWebGameSessionProjectionAssembler();
    const received: SimulationToMainMessage[] = [];
    let visibleFrame: WebGameSessionProjectionFrame | undefined;
    session.subscribe((message) => {
      received.push(message);
      if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError) {
        visibleFrame = undefined;
        assembler.reset();
        return;
      }
      const render = readWebGameSessionRenderProjection(message);
      const ui = readWebGameSessionUiProjection(message);
      const update =
        render !== undefined
          ? assembler.pushRender(render)
          : ui === undefined
            ? undefined
            : assembler.pushUi(ui);
      if (update === undefined) return;
      if (update.status === "ready") visibleFrame = update.frame;
    });
    const initialMessages = createSimulationWorker().receive(startWebGameSession(session));
    for (const message of initialMessages) worker.dispatch(message);
    expect(visibleFrame).toBeDefined();
    worker.dispatch({
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "web-session",
      sequence: Math.max(...initialMessages.map((message) => message.sequence)) + 1,
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      payload: { tick: 0, summaries: ["must-not-be-used"] },
    });

    expect(session.getState()).toBe("fatal");
    expect(worker.terminated).toBe(true);
    expect(visibleFrame).toBeUndefined();
    expect(createGameSessionLifecycleReadModel("web-session", "fatal").entities).toStrictEqual([]);
    expect(received.at(-1)).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
      payload: {
        reason: {
          detail: "Negotiated UiDelta is missing gameSession",
        },
      },
    });
  });

  it("publishes one coherent GameSession basis for residents, resources, jobs, and detail", () => {
    const transport = new RecordingBrowserWorker();
    const browserSession = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => transport,
    });
    const worker = createSimulationWorker();
    const initialMessages = worker.receive(startWebGameSession(browserSession));
    const initialFrame = assembleGameSessionFrame(initialMessages);
    const selectedRender = initialFrame.render.entities.find(
      (entity) => entity.kind === "resident",
    );
    if (selectedRender === undefined) throw new Error("Expected a projected resident.");
    const selectedEntityId = `${String(selectedRender.entity.index)}:${String(selectedRender.entity.generation)}`;
    const detailMessages = worker.receive({
      protocolVersion: SIM_PROTOCOL_VERSION,
      schemaVersion: SIM_SCHEMA_VERSION,
      sessionId: "web-session",
      sequence: 2,
      kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
      payload: { subject: { kind: "entity", entityId: selectedEntityId } },
    });
    const frame = assembleGameSessionFrame(detailMessages);
    const readModel = createGameSessionWorldReadModel({ frame, selectedEntityId });
    const initialDefault = createGameSessionWorldReadModel({
      frame: initialFrame,
      selectedEntityId: undefined,
    });
    const unavailable = createGameSessionWorldReadModel({
      frame,
      selectedEntityId: "999:1",
    });

    expect(frame.render.basis).toStrictEqual(frame.ui.basis);
    expect(frame.ui.selectionDetail?.basis).toMatchObject(frame.basis);
    expect(readModel.sessionId).toBe(frame.basis.scenarioId);
    expect(readModel.entities.filter((entity) => entity.kind === "resident")).toHaveLength(8);
    expect(readModel.town.resources).toStrictEqual([]);
    expect(frame.render.entities.filter((entity) => entity.kind === "resource")).toHaveLength(4);
    expect(readModel.entities.some((entity) => entity.summary.includes("available"))).toBe(true);
    expect(readModel.focusMarkers).toHaveLength(frame.ui.jobs.length);
    expect(readModel.jobMarkers).toBeUndefined();
    expect(readModel.selectedEntityId).toBe(selectedEntityId);
    expect(initialDefault.selectedEntityId).toBe(selectedEntityId);
    expect(unavailable.selectedEntityId).toBe("");
    expect(
      readModel.entities.find((entity) => entity.entityId === selectedEntityId)?.tile,
    ).toStrictEqual({
      x: selectedRender.xQ16 / frame.render.tileSizeQ16,
      y: selectedRender.yQ16 / frame.render.tileSizeQ16,
    });
    const otherResident = frame.render.entities.find(
      (entity) =>
        entity.kind === "resident" &&
        (entity.entity.index !== selectedRender.entity.index ||
          entity.entity.generation !== selectedRender.entity.generation),
    );
    if (otherResident === undefined) throw new Error("Expected another projected resident.");
    const otherResidentId = `${String(otherResident.entity.index)}:${String(otherResident.entity.generation)}`;
    const switched = createGameSessionWorldReadModel({
      frame,
      selectedEntityId: otherResidentId,
    });
    expect(
      switched.entities.find((entity) => entity.entityId === otherResidentId)?.inspector
        .lastDecision,
    ).toBe("—");

    const resourceRender = frame.render.entities.find((entity) => entity.kind === "resource");
    if (resourceRender === undefined) throw new Error("Expected a projected resource.");
    const resourceEntityId = `${String(resourceRender.entity.index)}:${String(resourceRender.entity.generation)}`;
    const rapidResourceSwitch = createGameSessionWorldReadModel({
      frame,
      selectedEntityId: resourceEntityId,
    });
    const rapidResourceEntity = rapidResourceSwitch.entities.find(
      (entity) => entity.entityId === resourceEntityId,
    );
    expect(rapidResourceSwitch.selectedEntityId).toBe(resourceEntityId);
    expect(rapidResourceEntity?.kind).toBe("resource");
    expect(rapidResourceEntity?.inspector.lastDecision).toBe("\u2014");

    const resourceFrame = assembleGameSessionFrame(
      worker.receive({
        protocolVersion: SIM_PROTOCOL_VERSION,
        schemaVersion: SIM_SCHEMA_VERSION,
        sessionId: "web-session",
        sequence: 3,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
        payload: { subject: { kind: "entity", entityId: resourceEntityId } },
      }),
    );
    const resourceReadModel = createGameSessionWorldReadModel({
      frame: resourceFrame,
      selectedEntityId: resourceEntityId,
    });
    expect(resourceFrame.ui.selectionDetail?.kind).toBe("resource");
    const selectedResource = resourceReadModel.entities.find(
      (entity) => entity.entityId === resourceEntityId,
    );
    expect(selectedResource?.kind).toBe("resource");
    expect(selectedResource?.summary).toBe("80 available, 0 reserved, 80 total");
    browserSession.destroy();
  });

  it("rejects an incoherent Web pair and keeps lifecycle placeholders free of town facts", () => {
    const transport = new RecordingBrowserWorker();
    const browserSession = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => transport,
    });
    const frame = assembleGameSessionFrame(
      createSimulationWorker().receive(startWebGameSession(browserSession)),
    );
    const assembler = createWebGameSessionProjectionAssembler();

    expect(assembler.pushRender(frame.render)).toStrictEqual({ status: "pending" });
    expect(
      assembler.pushUi({
        ...frame.ui,
        basis: { ...frame.ui.basis, worldHash: "0xincoherent" },
      }),
    ).toMatchObject({ status: "invalid" });

    const fatal = createGameSessionLifecycleReadModel(
      "web-session",
      "fatal",
      "projection mismatch",
    );
    expect(fatal.entities).toStrictEqual([]);
    expect(fatal.town.resources).toStrictEqual([]);
    expect(fatal.town.alerts).toStrictEqual([]);
    expect(fatal.focusMarkers).toStrictEqual([]);
    assembler.reset();
    expect(assembler.pushUi(frame.ui)).toStrictEqual({ status: "pending" });
    browserSession.destroy();
  });

  it("uses the sim-worker package-root session API for WM-0150 transport only", () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });

    startWebPlayableWorkerScenario(session, "5");
    sendWebPlayableCommandBatch(session, []);
    advanceWebPlayableWorkerScenarioToTick(session, 45);
    session.destroy();

    expect(worker.messages.slice(0, 2)).toStrictEqual([
      {
        protocolVersion: SIM_PROTOCOL_VERSION,
        schemaVersion: SIM_SCHEMA_VERSION,
        sessionId: "web-session",
        sequence: 1,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
        payload: {
          seed: "5",
          catalogVersion: WEB_PLAYABLE_WORKER_SCENARIO_ID,
        },
      },
      {
        protocolVersion: SIM_PROTOCOL_VERSION,
        schemaVersion: SIM_SCHEMA_VERSION,
        sessionId: "web-session",
        sequence: 2,
        kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
        payload: {
          commands: [],
        },
      },
    ]);

    const advanceMessage = worker.messages[2];
    if (advanceMessage?.kind !== MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch) {
      throw new Error("expected public advance helper to post PlayerCommandBatch");
    }
    const advanceCommand = advanceMessage.payload.commands[0];
    if (advanceCommand === undefined) {
      throw new Error("expected public advance helper to post one command");
    }
    expect(typeof advanceCommand.commandId).toBe("string");
    expect(advanceCommand.kind).toBe(PLAYER_COMMAND_KIND.Noop);
  });

  it("reads public playable projections from UiDelta without summary parsing", () => {
    const projection = readWebPlayableProjection(playableUiDelta());

    expect(projection).toMatchObject({
      playableCommandReadModelVersion: 1,
      basis: {
        tick: 12,
        commandBasis: {
          basisTick: 12,
        },
      },
    });
    expect(readWebPlayableProjection(gameSessionReady())).toBeUndefined();
  });

  it("awaits public playable projection ticks through the Web adapter", async () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });

    const wait = waitForWebPlayableProjectionAtOrBeyondTick(session, { targetTick: 12 });
    worker.dispatch(playableUiDeltaAt(12, []));
    const result = await wait;
    session.destroy();

    expect(result).toMatchObject({
      status: "advanced",
      targetTick: 12,
      projection: {
        basis: { tick: 12 },
      },
    });
    expect(worker.messages).toHaveLength(1);
  });

  it("cleans up public drain subscriptions on cancellation", async () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });
    const controller = new AbortController();

    const drain = drainWebPlayableCommandsToTerminal(session, {
      commandIds: ["cmd-lamp"],
      maxTargetTick: 30,
      stepTicks: 10,
      signal: controller.signal,
    });
    controller.abort(new Error("test cancellation"));
    await expect(drain).rejects.toThrow("test cancellation");

    worker.dispatch(
      playableUiDeltaAt(10, [
        {
          commandId: "cmd-lamp",
          markerState: "moving",
        },
      ]),
    );
    session.destroy();

    expect(worker.messages).toHaveLength(1);
  });

  it("settles concurrent public waits from the same playable UiDelta", async () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });

    const first = waitForWebPlayableProjectionAtOrBeyondTick(session, { targetTick: 12 });
    const second = waitForWebPlayableProjectionAtOrBeyondTick(session, { targetTick: 12 });
    const settled = waitForSettled([first, second]);
    worker.dispatch(playableUiDeltaAt(12, []));
    const values = expectAllFulfilled(await settled);
    session.destroy();

    expect(values).toHaveLength(2);
    expect(values[0]?.projection.basis.tick).toBe(12);
    expect(values[1]?.projection.basis.tick).toBe(12);
  });

  it("rejects all concurrent public waits on destroy", async () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });

    const first = waitForWebPlayableProjectionAtOrBeyondTick(session, { targetTick: 30 });
    const second = waitForWebPlayableProjectionAtOrBeyondTick(session, { targetTick: 40 });
    const settled = waitForSettled([first, second]);
    session.destroy();

    expectAllRejected(await settled, "destroyed");
  });

  it("rejects all concurrent public drains on shutdown", async () => {
    const worker = new RecordingBrowserWorker();
    const session = createWebSimulationWorkerSession({
      sessionId: "web-session",
      workerFactory: () => worker,
    });

    startWebPlayableWorkerScenario(session, "5");
    const first = drainWebPlayableCommandsToTerminal(session, {
      commandIds: ["cmd-lamp"],
      maxTargetTick: 30,
      stepTicks: 10,
    });
    const second = drainWebPlayableCommandsToTerminal(session, {
      commandIds: ["cmd-build"],
      maxTargetTick: 60,
      stepTicks: 10,
    });
    const settled = waitForSettled([first, second]);
    session.shutdown();

    expectAllRejected(await settled, "shutdown");
    expect(worker.messages[worker.messages.length - 1]?.kind).toBe(
      MAIN_TO_SIMULATION_MESSAGE_KIND.Shutdown,
    );
  });
});

function assembleGameSessionFrame(
  messages: readonly SimulationToMainMessage[],
): WebGameSessionProjectionFrame {
  const assembler = createWebGameSessionProjectionAssembler();
  for (const message of messages) {
    const render = readWebGameSessionRenderProjection(message);
    const ui = readWebGameSessionUiProjection(message);
    const update =
      render !== undefined
        ? assembler.pushRender(render)
        : ui === undefined
          ? undefined
          : assembler.pushUi(ui);
    if (update?.status === "invalid") throw new Error(update.detail);
    if (update?.status === "ready") return update.frame;
  }
  throw new Error("Expected a coherent GameSession projection frame.");
}

class RecordingBrowserWorker implements BrowserSimulationWorkerHandle {
  readonly messages: MainToSimulationMessage[] = [];
  private listener: ((event: BrowserSimulationWorkerMessageEvent) => void) | undefined;
  terminated = false;

  postMessage(message: MainToSimulationMessage): void {
    this.messages.push(message);
  }

  addEventListener(
    type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    expect(type).toBe("message");
    expect(listener).toBeDefined();
    this.listener = listener;
  }

  removeEventListener(
    type: "message",
    listener: (event: BrowserSimulationWorkerMessageEvent) => void,
  ): void {
    expect(type).toBe("message");
    expect(listener).toBeDefined();
    if (this.listener === listener) {
      this.listener = undefined;
    }
  }

  terminate(): void {
    this.listener = undefined;
    this.terminated = true;
  }

  dispatch(message: SimulationToMainMessage): void {
    const activeListener = this.listener;
    if (activeListener === undefined) {
      throw new Error("expected worker listener");
    }
    activeListener({ data: message });
  }
}

function playableUiDelta(): SimulationToMainMessage {
  return playableUiDeltaAt(12, []);
}

function playableUiDeltaAt(
  tick: number,
  orders: readonly {
    readonly commandId: string;
    readonly markerState:
      | "queued"
      | "claimable"
      | "claimed"
      | "moving"
      | "working"
      | "blocked"
      | "completed"
      | "failed"
      | "canceled";
  }[],
): SimulationToMainMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "web-session",
    sequence: 4,
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
    payload: {
      tick,
      summaries: [],
      readOnly: true,
      playable: {
        playableCommandReadModelVersion: 1,
        basis: {
          tick,
          snapshotSequence: 1,
          worldHash: "0xworld",
          readModelHash: "0xread",
          contentManifestHash: "0x0150015a",
          targetVersion: 1,
          mapVersion: 1,
          reservationVersion: 1,
          jobVersion: 1,
          commandBasis: {
            playableCommandContractVersion: 1,
            basisTick: tick,
            basisSnapshotSequence: 1,
            basisReadModelHash: "0xread",
            contentManifestHash: "0x0150015a",
          },
        },
        targets: [],
        placements: [],
        orders: orders.map((order, index) => ({
          orderId: `order-${String(index)}`,
          commandId: order.commandId,
          jobId: index,
          jobKind: "lamp_refill",
          markerState: order.markerState,
          target: {
            kind: "lamp_gap",
            gapId: "lamp-gap-0",
            anchorCell: { x: 12, y: 7, cellIndex: 124 },
          },
          progressQ16: 0,
          requiredWork: 30,
        })),
        pawns: [],
        lamps: [],
        resources: { materials: [] },
        alerts: [],
      },
    },
  };
}

function gameSessionReady(): SimulationToMainMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "web-session",
    sequence: 3,
    kind: SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
    payload: {
      acceptedProtocolVersion: SIM_PROTOCOL_VERSION,
      acceptedSchemaVersion: SIM_SCHEMA_VERSION,
      status: "ready",
      projectionContract: {
        kind: "game_session",
        version: GAME_SESSION_PROJECTION_VERSION,
      },
    },
  };
}

async function waitForSettled<T>(
  promises: readonly Promise<T>[],
): Promise<readonly PromiseSettledResult<T>[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.allSettled(promises),
      new Promise<readonly PromiseSettledResult<T>[]>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("timed out waiting for concurrent helper settlement"));
        }, 100);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function expectAllFulfilled<T>(results: readonly PromiseSettledResult<T>[]): readonly T[] {
  const values: T[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") {
      throw new Error("expected concurrent helper promise to be fulfilled");
    }
    values.push(result.value);
  }
  return values;
}

function expectAllRejected<T>(
  results: readonly PromiseSettledResult<T>[],
  messageFragment: string,
): void {
  for (const result of results) {
    if (result.status !== "rejected") {
      throw new Error("expected concurrent helper promise to be rejected");
    }
    const reason: unknown = result.reason;
    if (!(reason instanceof Error)) {
      throw new Error("expected concurrent helper rejection reason to be an Error");
    }
    expect(reason.message).toContain(messageFragment);
  }
}
