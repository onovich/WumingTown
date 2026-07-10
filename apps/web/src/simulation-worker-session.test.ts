import { describe, expect, it } from "vitest";

import type {
  BrowserSimulationWorkerHandle,
  BrowserSimulationWorkerMessageEvent,
} from "@wuming-town/sim-worker";
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
  WEB_PLAYABLE_WORKER_SCENARIO_ID,
  advanceWebPlayableWorkerScenarioToTick,
  createWebSimulationWorkerSession,
  drainWebPlayableCommandsToTerminal,
  sendWebPlayableCommandBatch,
  startWebPlayableWorkerScenario,
  readWebPlayableProjection,
  waitForWebPlayableProjectionAtOrBeyondTick,
} from "./simulation-worker-session";

describe("web Simulation Worker session bridge adapter", () => {
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
