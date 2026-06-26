import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  M4_REPLAY_CHECKPOINT_SEQUENCE,
  M4_SAVE_TICK,
  createM4AdvanceCommandId,
  runM4CoreVerticalSliceReplay,
  type M4ReplayRun,
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

interface M4ParityDiagnostics {
  readonly seed: string;
  readonly requestedSeed: string;
  readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
  readonly checkpointCount: number;
  readonly firstMismatchedCheckpointTick: number | null;
  readonly finalSnapshotSizeBytes: number;
  readonly finalReadModelSizeBytes: number;
  readonly finalProjectionSizeBytes: number;
  readonly latencyMetrics: {
    readonly renderSnapshotMessages: number;
    readonly uiDeltaMessages: number;
    readonly metricsSampleMessages: number;
    readonly totalProjectionMessages: number;
  };
  readonly basisSurfaceCount: number;
}

describe("M4 Worker/headless parity", () => {
  it("matches Node headless M4 hashes and emits read-only basis projections", () => {
    const worker = createSimulationWorker();
    const expected = readM4Replay(
      runM4CoreVerticalSliceReplay({
        seed: "4",
        checkpointTicks: M4_REPLAY_CHECKPOINT_SEQUENCE,
      }),
    );
    const snapshots: RenderSnapshotMessage[] = [];
    const uiDeltas: UiDeltaMessage[] = [];
    const metricsSamples: MetricsSampleMessage[] = [];

    collectProjectionMessages(
      worker.receive(makeM4InitSession(1)),
      snapshots,
      uiDeltas,
      metricsSamples,
    );

    for (let index = 1; index < M4_REPLAY_CHECKPOINT_SEQUENCE.length; index += 1) {
      const tick = M4_REPLAY_CHECKPOINT_SEQUENCE[index] ?? failMissingCheckpointTick();
      collectProjectionMessages(
        worker.receive(makeM4AdvanceBatch(index + 1, tick, index)),
        snapshots,
        uiDeltas,
        metricsSamples,
      );
    }

    expect(snapshots).toHaveLength(M4_REPLAY_CHECKPOINT_SEQUENCE.length);
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index] ?? failMissingSnapshot();
      const checkpoint = expected.checkpoints[index] ?? failMissingCheckpoint();
      expect(snapshot.payload).toMatchObject({
        entityCount: 3,
        scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        readModelHash: checkpoint.readModelHash,
        readOnly: true,
      });
    }

    const finalSnapshot = snapshots[snapshots.length - 1] ?? failMissingSnapshot();
    const finalUiDelta = uiDeltas[uiDeltas.length - 1] ?? failMissingUiDelta();
    const finalMetrics = metricsSamples[metricsSamples.length - 1] ?? failMissingMetricsSample();
    const diagnostics = createM4ParityDiagnostics(
      snapshots,
      finalUiDelta,
      uiDeltas.length,
      metricsSamples.length,
      expected,
    );

    expect(finalSnapshot.payload).toMatchObject({
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      tick: expected.finalTick,
      worldHash: expected.finalWorldHash,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(finalUiDelta.payload).toMatchObject({
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:lamp-gap="),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:evidence="),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:obligation="),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:town-rule="),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:crisis="),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:director="),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m4-basis:dawn-review="),
    );
    expect(finalMetrics.payload).toMatchObject({
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: M4_REPLAY_CHECKPOINT_SEQUENCE.length,
    });
    expect(diagnostics).toMatchObject({
      seed: "50",
      requestedSeed: "4",
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      checkpointCount: M4_REPLAY_CHECKPOINT_SEQUENCE.length,
      firstMismatchedCheckpointTick: null,
      latencyMetrics: {
        renderSnapshotMessages: M4_REPLAY_CHECKPOINT_SEQUENCE.length,
        uiDeltaMessages: M4_REPLAY_CHECKPOINT_SEQUENCE.length,
        metricsSampleMessages: M4_REPLAY_CHECKPOINT_SEQUENCE.length,
        totalProjectionMessages: M4_REPLAY_CHECKPOINT_SEQUENCE.length * 3,
      },
    });
    expect(diagnostics.finalSnapshotSizeBytes).toBeGreaterThan(0);
    expect(diagnostics.finalReadModelSizeBytes).toBeGreaterThan(0);
    expect(diagnostics.finalProjectionSizeBytes).toBeGreaterThan(
      diagnostics.finalSnapshotSizeBytes,
    );
    expect(diagnostics.basisSurfaceCount).toBeGreaterThanOrEqual(12);

    writeM4DiagnosticsArtifact(diagnostics);
  });

  it("returns M4 save metadata without exposing mutable authority through the Worker", () => {
    const worker = createSimulationWorker();

    worker.receive(makeM4InitSession(1));
    worker.receive(makeM4AdvanceBatch(2, M4_SAVE_TICK, 1));
    const saveReady = saveReadyMessage(worker.receive(makeRequestSave(3)));

    expect(saveReady.payload).toMatchObject({
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      checkpointTick: M4_SAVE_TICK,
    });
    expect(saveReady.payload.worldHash).toMatch(/^0x[0-9a-f]{8}$/u);
  });
});

function makeM4InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m4",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "4",
      catalogVersion: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
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
    sessionId: "session-m4",
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

function makeRequestSave(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m4",
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

function createM4ParityDiagnostics(
  snapshots: readonly RenderSnapshotMessage[],
  finalUiDelta: UiDeltaMessage,
  uiDeltaMessageCount: number,
  metricsSampleMessageCount: number,
  expected: M4ReplayRun,
): M4ParityDiagnostics {
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
  const finalSnapshotSizeBytes = JSON.stringify(finalSnapshot.payload).length;
  const finalReadModelSizeBytes = JSON.stringify(finalUiDelta.payload).length;
  return {
    seed: expected.seed,
    requestedSeed: expected.requestedSeed,
    scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    checkpointCount: snapshots.length,
    firstMismatchedCheckpointTick,
    finalSnapshotSizeBytes,
    finalReadModelSizeBytes,
    finalProjectionSizeBytes:
      finalSnapshotSizeBytes +
      finalReadModelSizeBytes +
      metricsSampleMessageCount * JSON.stringify({ kind: "metrics" }).length,
    latencyMetrics: {
      renderSnapshotMessages: snapshots.length,
      uiDeltaMessages: uiDeltaMessageCount,
      metricsSampleMessages: metricsSampleMessageCount,
      totalProjectionMessages: snapshots.length + uiDeltaMessageCount + metricsSampleMessageCount,
    },
    basisSurfaceCount: countBasisSurfaces(finalUiDelta),
  };
}

function countBasisSurfaces(finalUiDelta: UiDeltaMessage): number {
  let count = 0;
  for (const summary of finalUiDelta.payload.summaries) {
    if (summary.startsWith("m4-basis:")) {
      count += 1;
    }
  }
  return count;
}

function writeM4DiagnosticsArtifact(diagnostics: M4ParityDiagnostics): void {
  const artifactDir = path.join("coordination", "artifacts", "WM-0069");
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    path.join(artifactDir, "m4-worker-parity-diagnostics.json"),
    `${JSON.stringify(diagnostics, null, 2)}\n`,
    "utf8",
  );
}

function saveReadyMessage(messages: readonly SimulationToMainMessage[]): SaveReadyMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady) {
      return message;
    }
  }

  throw new Error("expected SaveReady message");
}

function readM4Replay(result: ReturnType<typeof runM4CoreVerticalSliceReplay>): M4ReplayRun {
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
