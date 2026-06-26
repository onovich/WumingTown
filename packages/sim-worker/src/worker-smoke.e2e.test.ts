/// <reference lib="dom" />

import { chromium } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";

import {
  HAULING_BUILDING_SCENARIO_ID,
  M2_WORK_LOGISTICS_SCENARIO_ID,
  M3_ORDINARY_LIFE_CHECKPOINTS,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  M4_REPLAY_CHECKPOINT_SEQUENCE,
  createM1AdvanceCommandId,
  createM2AdvanceCommandId,
  createM3AdvanceCommandId,
  createM4AdvanceCommandId,
  runM1HaulingBuildingReplay,
  runM2WorkLogisticsReplay,
  runM3OrdinaryLifeReplay,
  runM4CoreVerticalSliceReplay,
  type M1ReplayRun,
  type M2ReplayRun,
  type M3ReplayRun,
  type M4ReplayRun,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type CommandResultMessage,
  type MetricsSampleMessage,
  type MainToSimulationMessage,
  type RenderSnapshotMessage as ProtocolRenderSnapshotMessage,
  type SaveReadyMessage as ProtocolSaveReadyMessage,
  type SimulationToMainMessage,
  type UiDeltaMessage,
} from "@wuming-town/sim-protocol";

import {
  connectSimulationWorkerPort,
  createSimulationWorker,
  type SimulationWorkerMessageEvent,
  type SimulationWorkerPort,
} from "./index";

interface BrowserWorkerRunInput {
  readonly expectedCount: number;
  readonly inputMessages: readonly MainToSimulationMessage[];
  readonly workerPath: string;
}

describe("worker-smoke simulation Worker protocol", () => {
  it("round-trips through the Node harness without exposing mutable simulation state", () => {
    const worker = createSimulationWorker();

    const initResponses = worker.receive(makeInitSession(1));
    expect(kinds(initResponses)).toStrictEqual([
      SIMULATION_TO_MAIN_MESSAGE_KIND.Ready,
      SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot,
      SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta,
      SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample,
    ]);

    const commandResponses = worker.receive(makeNoopBatch(2));
    expect(commandResult(commandResponses).payload).toMatchObject({
      inReplyToSequence: 2,
      accepted: true,
    });
    expect(kinds(commandResponses)).toContain(SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot);
  });

  it("rejects stale sequences with structured reason codes", () => {
    const worker = createSimulationWorker();

    worker.receive(makeInitSession(1));
    const staleResult = commandResult(worker.receive(makePause(1)));

    expect(staleResult.payload.accepted).toBe(false);
    expect(staleResult.payload.reason).toStrictEqual({
      code: SIMULATION_PROTOCOL_REASON_CODE.StaleSequence,
      detail: "message sequence has already been processed by this Worker",
    });
  });

  it("rejects stale sessions with structured reason codes", () => {
    const worker = createSimulationWorker();

    worker.receive(makeInitSession(1));
    const staleResult = commandResult(
      worker.receive({
        ...makePause(2),
        sessionId: "other-session",
      }),
    );

    expect(staleResult.payload.accepted).toBe(false);
    expect(staleResult.payload.reason?.code).toBe(SIMULATION_PROTOCOL_REASON_CODE.StaleSession);
  });

  it("rejects lifecycle errors before initialization", () => {
    const worker = createSimulationWorker();
    const rejected = commandResult(worker.receive(makePause(1)));

    expect(rejected.payload.accepted).toBe(false);
    expect(rejected.payload.reason?.code).toBe(SIMULATION_PROTOCOL_REASON_CODE.LifecycleError);
  });

  it("round-trips through a browser Worker-compatible message port", () => {
    const port = new MemoryWorkerPort();
    const connection = connectSimulationWorkerPort(port);

    port.dispatch(makeInitSession(1));
    port.dispatch(makeNoopBatch(2));
    connection.disconnect();

    expect(kinds(port.messages)).toContain(SIMULATION_TO_MAIN_MESSAGE_KIND.Ready);
    expect(kinds(port.messages)).toContain(SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult);
    expect(commandResult(port.messages).payload.accepted).toBe(true);
  });

  it("matches Node headless hashes for the M1 hauling-building command stream", () => {
    const worker = createSimulationWorker();
    const expected = readReplay(
      runM1HaulingBuildingReplay({ seed: "1", checkpointTicks: [0, 2_400, 100_000] }),
    );
    const init = worker.receive(makeM1InitSession(1));
    const atZero = renderSnapshot(init);

    expect(atZero.payload).toMatchObject({
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      tick: 0,
      worldHash: expected.checkpoints[0]?.worldHash,
      readOnly: true,
    });

    const at2400 = renderSnapshot(worker.receive(makeM1AdvanceBatch(2, 2_400)));
    const at100000Responses = worker.receive(makeM1AdvanceBatch(3, 100_000));
    const at100000 = renderSnapshot(at100000Responses);

    expect(at2400.payload).toMatchObject({
      tick: 2_400,
      worldHash: expected.checkpoints[1]?.worldHash,
      readModelHash: expected.checkpoints[1]?.readModelHash,
      readOnly: true,
    });
    expect(at100000.payload).toMatchObject({
      tick: 100_000,
      worldHash: expected.checkpoints[2]?.worldHash,
      readModelHash: expected.checkpoints[2]?.readModelHash,
      readOnly: true,
    });
    expect(uiDelta(at100000Responses).payload).toMatchObject({
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      readModelHash: expected.checkpoints[2]?.readModelHash,
      readOnly: true,
    });
    expect(metricsSample(at100000Responses).payload).toMatchObject({
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: 3,
    });
  });

  it("matches Node headless hashes in a real browser module Worker", async () => {
    const expected = readReplay(
      runM1HaulingBuildingReplay({ seed: "1", checkpointTicks: [0, 2_400, 100_000] }),
    );
    const browserMessages = await runBrowserWorker([
      makeM1InitSession(1),
      makeM1AdvanceBatch(2, 2_400),
      makeM1AdvanceBatch(3, 100_000),
    ]);
    const snapshots = renderSnapshots(browserMessages);

    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]?.payload).toMatchObject({
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      tick: 0,
      worldHash: expected.checkpoints[0]?.worldHash,
      readModelHash: expected.checkpoints[0]?.readModelHash,
      readOnly: true,
    });
    expect(snapshots[1]?.payload).toMatchObject({
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      tick: 2_400,
      worldHash: expected.checkpoints[1]?.worldHash,
      readModelHash: expected.checkpoints[1]?.readModelHash,
      readOnly: true,
    });
    expect(snapshots[2]?.payload).toMatchObject({
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      tick: 100_000,
      worldHash: expected.finalWorldHash,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(lastMetricsSample(browserMessages).payload).toMatchObject({
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: 3,
    });
  }, 120000);

  it("matches Node headless hashes for M2 in a real browser module Worker", async () => {
    const expected = readM2Replay(
      runM2WorkLogisticsReplay({ seed: "2", checkpointTicks: [0, 6_000, 20_000] }),
    );
    const browserMessages = await runBrowserWorker([
      makeM2InitSession(1),
      makeM2AdvanceBatch(2, 6_000),
      makeM2AdvanceBatch(3, 20_000),
    ]);
    const snapshots = renderSnapshots(browserMessages);

    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]?.payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      tick: 0,
      worldHash: expected.checkpoints[0]?.worldHash,
      readModelHash: expected.checkpoints[0]?.readModelHash,
      readOnly: true,
    });
    expect(snapshots[1]?.payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      tick: 6_000,
      worldHash: expected.checkpoints[1]?.worldHash,
      readModelHash: expected.checkpoints[1]?.readModelHash,
      readOnly: true,
    });
    expect(snapshots[2]?.payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      tick: 20_000,
      worldHash: expected.finalWorldHash,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(lastMetricsSample(browserMessages).payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: 3,
    });
  }, 120000);

  it("matches Node headless hashes for M3 in a real browser module Worker", async () => {
    const expected = readM3Replay(
      runM3OrdinaryLifeReplay({
        seed: "3",
        checkpointTicks: M3_ORDINARY_LIFE_CHECKPOINTS,
      }),
    );
    const browserMessages = await runBrowserWorker([
      makeM3InitSession(1),
      makeM3AdvanceBatch(2, 3_600),
      makeM3AdvanceBatch(3, 7_200),
      makeM3AdvanceBatch(4, 12_000),
      makeM3AdvanceBatch(5, 18_000),
      makeM3AdvanceBatch(6, 36_000),
    ]);
    const snapshots = renderSnapshots(browserMessages);

    expect(snapshots).toHaveLength(M3_ORDINARY_LIFE_CHECKPOINTS.length);
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index] ?? failMissingSnapshot();
      const checkpoint = expected.checkpoints[index] ?? failMissingCheckpoint();
      expect(snapshot.payload).toMatchObject({
        scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        readModelHash: checkpoint.readModelHash,
        readOnly: true,
      });
    }

    expect(lastMetricsSample(browserMessages).payload).toMatchObject({
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: M3_ORDINARY_LIFE_CHECKPOINTS.length,
    });
  }, 120000);

  it("matches Node headless hashes for M4 in a real browser module Worker", async () => {
    const expected = readM4Replay(
      runM4CoreVerticalSliceReplay({
        seed: "4",
        checkpointTicks: M4_REPLAY_CHECKPOINT_SEQUENCE,
      }),
    );
    const browserMessages = await runBrowserWorker([
      makeM4InitSession(1),
      makeM4AdvanceBatch(2, 3_600, 1),
      makeM4AdvanceBatch(3, 7_200, 2),
      makeM4AdvanceBatch(4, 12_000, 3),
      makeM4AdvanceBatch(5, 18_000, 4),
      makeM4AdvanceBatch(6, 36_000, 5),
    ]);
    const snapshots = renderSnapshots(browserMessages);
    const finalUiDelta = lastUiDelta(browserMessages);

    expect(snapshots).toHaveLength(M4_REPLAY_CHECKPOINT_SEQUENCE.length);
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index] ?? failMissingSnapshot();
      const checkpoint = expected.checkpoints[index] ?? failMissingCheckpoint();
      expect(snapshot.payload).toMatchObject({
        scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        readModelHash: checkpoint.readModelHash,
        readOnly: true,
      });
    }

    expect(finalUiDelta.payload).toMatchObject({
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:dawn-review="),
    );
    expect(lastMetricsSample(browserMessages).payload).toMatchObject({
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: M4_REPLAY_CHECKPOINT_SEQUENCE.length,
    });
  }, 120000);

  it("returns M1 save metadata without exposing mutable authority through the Worker", () => {
    const worker = createSimulationWorker();

    worker.receive(makeM1InitSession(1));
    worker.receive(makeM1AdvanceBatch(2, 2_400));
    const saveReady = saveReadyMessage(worker.receive(makeRequestSave(3)));

    expect(saveReady.payload.scenarioId).toBe(HAULING_BUILDING_SCENARIO_ID);
    expect(saveReady.payload.checkpointTick).toBe(2_400);
    expect(saveReady.payload.worldHash).toMatch(/^0x[0-9a-f]{8}$/);
  });
});

class MemoryWorkerPort implements SimulationWorkerPort {
  readonly messages: SimulationToMainMessage[] = [];
  private listener: ((event: SimulationWorkerMessageEvent) => void) | undefined;

  postMessage(message: SimulationToMainMessage): void {
    this.messages.push(message);
  }

  addEventListener(type: "message", listener: (event: SimulationWorkerMessageEvent) => void): void {
    expect(type).toBe("message");
    this.listener = listener;
  }

  removeEventListener(
    type: "message",
    listener: (event: SimulationWorkerMessageEvent) => void,
  ): void {
    expect(type).toBe("message");
    if (this.listener === listener) {
      this.listener = undefined;
    }
  }

  dispatch(data: unknown): void {
    const activeListener = this.listener;
    if (activeListener === undefined) {
      throw new Error("no message listener registered");
    }

    activeListener({ data });
  }
}

function makeInitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "seed-0005",
      catalogVersion: "catalog-0001",
    },
  };
}

function makeM1InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "1",
      catalogVersion: HAULING_BUILDING_SCENARIO_ID,
    },
  };
}

function makeM2InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "2",
      catalogVersion: M2_WORK_LOGISTICS_SCENARIO_ID,
    },
  };
}

function makeM3InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "3",
      catalogVersion: M3_ORDINARY_LIFE_SCENARIO_ID,
    },
  };
}

function makeM4InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "4",
      catalogVersion: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    },
  };
}

function makeNoopBatch(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: `command-${String(sequence)}`,
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makeM1AdvanceBatch(sequence: number, tick: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: createM1AdvanceCommandId(tick),
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makeM2AdvanceBatch(sequence: number, tick: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: createM2AdvanceCommandId(tick),
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makeM3AdvanceBatch(sequence: number, tick: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: createM3AdvanceCommandId(tick),
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makeM4AdvanceBatch(
  sequence: number,
  tick: number,
  commandSequence: number,
): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: createM4AdvanceCommandId(tick, commandSequence),
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makePause(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.Pause,
    payload: {
      paused: true,
    },
  };
}

function makeRequestSave(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-a",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
    payload: {
      reason: "manual",
    },
  };
}

function kinds(messages: readonly SimulationToMainMessage[]): readonly string[] {
  return messages.map((message) => message.kind);
}

function commandResult(messages: readonly SimulationToMainMessage[]): CommandResultMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.CommandResult) {
      return message;
    }
  }

  throw new Error("expected CommandResult message");
}

function renderSnapshot(
  messages: readonly SimulationToMainMessage[],
): ProtocolRenderSnapshotMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot) {
      return message;
    }
  }

  throw new Error("expected RenderSnapshot message");
}

function uiDelta(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      return message;
    }
  }

  throw new Error("expected UiDelta message");
}

function lastUiDelta(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  let latest: UiDeltaMessage | undefined;

  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      latest = message;
    }
  }

  if (latest !== undefined) {
    return latest;
  }

  throw new Error("expected UiDelta message");
}

function metricsSample(messages: readonly SimulationToMainMessage[]): MetricsSampleMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample) {
      return message;
    }
  }

  throw new Error("expected MetricsSample message");
}

function lastMetricsSample(messages: readonly SimulationToMainMessage[]): MetricsSampleMessage {
  let latest: MetricsSampleMessage | undefined;

  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample) {
      latest = message;
    }
  }

  if (latest !== undefined) {
    return latest;
  }

  throw new Error("expected MetricsSample message");
}

function saveReadyMessage(messages: readonly SimulationToMainMessage[]): ProtocolSaveReadyMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady) {
      return message;
    }
  }

  throw new Error("expected SaveReady message");
}

function renderSnapshots(
  messages: readonly SimulationToMainMessage[],
): readonly ProtocolRenderSnapshotMessage[] {
  const snapshots: ProtocolRenderSnapshotMessage[] = [];

  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot) {
      snapshots.push(message);
    }
  }

  return snapshots;
}

function readReplay(result: ReturnType<typeof runM1HaulingBuildingReplay>): M1ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readM2Replay(result: ReturnType<typeof runM2WorkLogisticsReplay>): M2ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readM3Replay(result: ReturnType<typeof runM3OrdinaryLifeReplay>): M3ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readM4Replay(result: ReturnType<typeof runM4CoreVerticalSliceReplay>): M4ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function failMissingSnapshot(): never {
  throw new Error("missing snapshot");
}

function failMissingCheckpoint(): never {
  throw new Error("missing checkpoint");
}

async function runBrowserWorker(
  inputMessages: readonly MainToSimulationMessage[],
): Promise<readonly SimulationToMainMessage[]> {
  const server = await createServer({
    configFile: false,
    logLevel: "error",
    root: process.cwd(),
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
    },
  });
  await server.listen();

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(readServerUrl(server), { waitUntil: "domcontentloaded" });
    const rawMessages: unknown = await page.evaluate(
      ({
        expectedCount,
        inputMessages: browserInputMessages,
        workerPath,
      }: BrowserWorkerRunInput): Promise<unknown[]> =>
        new Promise<unknown[]>((resolve, reject) => {
          const worker = new Worker(new URL(workerPath, window.location.href), {
            type: "module",
          });
          const received: unknown[] = [];
          const timeout = window.setTimeout((): void => {
            worker.terminate();
            reject(new Error(`Timed out waiting for ${String(expectedCount)} Worker messages.`));
          }, 30_000);

          worker.onerror = (event: ErrorEvent): void => {
            window.clearTimeout(timeout);
            worker.terminate();
            reject(new Error(`Browser Worker error: ${event.message}`));
          };
          worker.onmessage = (event: MessageEvent<unknown>): void => {
            received.push(event.data);
            if (received.length >= expectedCount) {
              window.clearTimeout(timeout);
              worker.terminate();
              resolve(received);
            }
          };

          for (const message of browserInputMessages) {
            worker.postMessage(message);
          }
        }),
      {
        expectedCount: inputMessages.length * 4,
        inputMessages,
        workerPath: "/packages/sim-worker/src/browser-worker-entry.ts",
      },
    );

    return readSimulationMessages(rawMessages);
  } finally {
    await browser.close();
    await server.close();
  }
}

function readServerUrl(server: ViteDevServer): string {
  const localUrl = server.resolvedUrls?.local[0];
  if (localUrl === undefined) {
    throw new Error("Vite dev server did not expose a local URL.");
  }

  return localUrl;
}

function readSimulationMessages(value: unknown): readonly SimulationToMainMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("Browser Worker returned a non-array payload.");
  }

  const messages: SimulationToMainMessage[] = [];
  for (const entry of value) {
    if (!isSimulationMessage(entry)) {
      throw new Error("Browser Worker returned an unexpected message payload.");
    }

    messages.push(entry);
  }

  return messages;
}

function isSimulationMessage(value: unknown): value is SimulationToMainMessage {
  return (
    isRecord(value) &&
    value["protocolVersion"] === SIM_PROTOCOL_VERSION &&
    value["schemaVersion"] === SIM_SCHEMA_VERSION &&
    typeof value["sessionId"] === "string" &&
    typeof value["sequence"] === "number" &&
    typeof value["kind"] === "string" &&
    isRecord(value["payload"])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
