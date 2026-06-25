import { describe, expect, it } from "vitest";

import {
  M3_ORDINARY_LIFE_CHECKPOINTS,
  M3_ORDINARY_LIFE_PRIMARY_SEED,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M3_SAVE_TICK,
  createM3AdvanceCommandId,
  runM3OrdinaryLifeReplay,
  type M3ReplayRun,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type MainToSimulationMessage,
  type MetricsSampleMessage,
  type RenderSnapshotMessage,
  type SaveReadyMessage,
  type SimulationToMainMessage,
  type UiDeltaMessage,
} from "@wuming-town/sim-protocol";

import { createSimulationWorker } from "./index";

interface M3ParityDiagnostics {
  readonly seed: typeof M3_ORDINARY_LIFE_PRIMARY_SEED;
  readonly requestedSeed: string;
  readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
  readonly checkpointCount: number;
  readonly firstMismatchedCheckpointTick: number | null;
  readonly finalSnapshotSizeBytes: number;
  readonly finalReadModelSizeBytes: number;
  readonly latencyMetrics: {
    readonly renderSnapshotMessages: number;
    readonly uiDeltaMessages: number;
    readonly metricsSampleMessages: number;
    readonly totalProjectionMessages: number;
  };
}

describe("M3 Worker/headless parity", () => {
  it("matches Node headless M3 hashes and keeps projections read-only", () => {
    const worker = createSimulationWorker();
    const expected = readM3Replay(
      runM3OrdinaryLifeReplay({
        seed: "3",
        checkpointTicks: M3_ORDINARY_LIFE_CHECKPOINTS,
      }),
    );
    const snapshots: RenderSnapshotMessage[] = [];
    const uiDeltas: UiDeltaMessage[] = [];
    const metricsSamples: MetricsSampleMessage[] = [];

    collectProjectionMessages(worker.receive(makeM3InitSession(1)), snapshots, uiDeltas, metricsSamples);

    for (let index = 1; index < M3_ORDINARY_LIFE_CHECKPOINTS.length; index += 1) {
      const tick = M3_ORDINARY_LIFE_CHECKPOINTS[index] ?? failMissingCheckpointTick();
      collectProjectionMessages(
        worker.receive(makeM3AdvanceBatch(index + 1, tick)),
        snapshots,
        uiDeltas,
        metricsSamples,
      );
    }

    expect(snapshots).toHaveLength(M3_ORDINARY_LIFE_CHECKPOINTS.length);
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index] ?? failMissingSnapshot();
      const checkpoint = expected.checkpoints[index] ?? failMissingCheckpoint();
      expect(snapshot.payload).toMatchObject({
        entityCount: 6,
        scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        readModelHash: checkpoint.readModelHash,
        readOnly: true,
      });
    }

    const finalSnapshot = snapshots[snapshots.length - 1] ?? failMissingSnapshot();
    const finalUiDelta = uiDeltas[uiDeltas.length - 1] ?? failMissingUiDelta();
    const finalMetrics = metricsSamples[metricsSamples.length - 1] ?? failMissingMetricsSample();
    const tamperedSnapshotPayload = { ...snapshots[3]?.payload, worldHash: "0x00000000" };
    const tamperedReadModelPayload = { ...finalUiDelta.payload, summaries: ["tampered"] };
    const diagnostics = createM3ParityDiagnostics(
      snapshots,
      finalUiDelta,
      uiDeltas.length,
      metricsSamples.length,
      expected,
    );

    expect(tamperedSnapshotPayload.worldHash).toBe("0x00000000");
    expect(tamperedReadModelPayload.summaries).toStrictEqual(["tampered"]);
    expect(finalSnapshot.payload).toMatchObject({
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      tick: expected.finalTick,
      worldHash: expected.finalWorldHash,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(finalUiDelta.payload).toMatchObject({
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(finalUiDelta.payload.summaries).toHaveLength(4);
    expect(finalMetrics.payload).toMatchObject({
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: M3_ORDINARY_LIFE_CHECKPOINTS.length,
    });
    expect(diagnostics).toMatchObject({
      seed: M3_ORDINARY_LIFE_PRIMARY_SEED,
      requestedSeed: "3",
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      checkpointCount: M3_ORDINARY_LIFE_CHECKPOINTS.length,
      firstMismatchedCheckpointTick: null,
      latencyMetrics: {
        renderSnapshotMessages: M3_ORDINARY_LIFE_CHECKPOINTS.length,
        uiDeltaMessages: M3_ORDINARY_LIFE_CHECKPOINTS.length,
        metricsSampleMessages: M3_ORDINARY_LIFE_CHECKPOINTS.length,
        totalProjectionMessages: M3_ORDINARY_LIFE_CHECKPOINTS.length * 3,
      },
    });
    expect(diagnostics.finalSnapshotSizeBytes).toBeGreaterThan(0);
    expect(diagnostics.finalReadModelSizeBytes).toBeGreaterThan(0);
  });

  it("returns M3 save metadata without exposing mutable authority through the Worker", () => {
    const worker = createSimulationWorker();

    worker.receive(makeM3InitSession(1));
    worker.receive(makeM3AdvanceBatch(2, M3_SAVE_TICK));
    const saveReady = saveReadyMessage(worker.receive(makeRequestSave(3)));

    expect(saveReady.payload).toMatchObject({
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      checkpointTick: M3_SAVE_TICK,
    });
    expect(saveReady.payload.worldHash).toMatch(/^0x[0-9a-f]{8}$/u);
  });
});

function makeM3InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m3",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "3",
      catalogVersion: M3_ORDINARY_LIFE_SCENARIO_ID,
    },
  };
}

function makeM3AdvanceBatch(sequence: number, tick: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m3",
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

function makeRequestSave(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m3",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
    payload: {
      reason: "manual",
    },
  };
}

function collectProjectionMessages(
  messages: readonly SimulationToMainMessage[],
  snapshots: RenderSnapshotMessage[],
  uiDeltas: UiDeltaMessage[],
  metricsSamples: MetricsSampleMessage[],
): void {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot) {
      snapshots.push(message);
    } else if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      uiDeltas.push(message);
    } else if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample) {
      metricsSamples.push(message);
    }
  }
}

function createM3ParityDiagnostics(
  snapshots: readonly RenderSnapshotMessage[],
  finalUiDelta: UiDeltaMessage,
  uiDeltaMessageCount: number,
  metricsSampleMessageCount: number,
  expected: M3ReplayRun,
): M3ParityDiagnostics {
  let firstMismatchedCheckpointTick: number | null = null;

  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index] ?? failMissingSnapshot();
    const checkpoint = expected.checkpoints[index] ?? failMissingCheckpoint();
    if (
      firstMismatchedCheckpointTick === null &&
      (snapshot.payload.tick !== checkpoint.tick ||
        snapshot.payload.worldHash !== checkpoint.worldHash ||
        snapshot.payload.readModelHash !== checkpoint.readModelHash)
    ) {
      firstMismatchedCheckpointTick = snapshot.payload.tick;
    }
  }

  const finalSnapshot = snapshots[snapshots.length - 1] ?? failMissingSnapshot();
  return {
    seed: M3_ORDINARY_LIFE_PRIMARY_SEED,
    requestedSeed: expected.requestedSeed,
    scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
    checkpointCount: snapshots.length,
    firstMismatchedCheckpointTick,
    finalSnapshotSizeBytes: JSON.stringify(finalSnapshot.payload).length,
    finalReadModelSizeBytes: JSON.stringify(finalUiDelta.payload).length,
    latencyMetrics: {
      renderSnapshotMessages: snapshots.length,
      uiDeltaMessages: uiDeltaMessageCount,
      metricsSampleMessages: metricsSampleMessageCount,
      totalProjectionMessages: snapshots.length + uiDeltaMessageCount + metricsSampleMessageCount,
    },
  };
}

function saveReadyMessage(messages: readonly SimulationToMainMessage[]): SaveReadyMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady) {
      return message;
    }
  }

  throw new Error("expected SaveReady message");
}

function readM3Replay(result: ReturnType<typeof runM3OrdinaryLifeReplay>): M3ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function failMissingCheckpointTick(): never {
  throw new Error("missing checkpoint tick");
}

function failMissingSnapshot(): never {
  throw new Error("missing snapshot");
}

function failMissingCheckpoint(): never {
  throw new Error("missing checkpoint");
}

function failMissingUiDelta(): never {
  throw new Error("missing UI delta");
}

function failMissingMetricsSample(): never {
  throw new Error("missing metrics sample");
}
