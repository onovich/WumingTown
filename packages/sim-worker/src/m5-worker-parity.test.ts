import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  M5_ALPHA_CONTENT_SCENARIO_ID,
  M5_REBUILT_SURFACE_NAMES,
  M5_REPLAY_CHECKPOINT_SEQUENCE,
  M5_SAVE_TICK,
  createM5AdvanceCommandId,
  createM5ReadOnlyProjection,
  runM5AlphaContentReplay,
  runM5AlphaContentScenario,
  type M5ReadOnlyProjection,
  type M5ReplayRun,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_PROTOCOL_REASON_CODE,
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

import { createSimulationWorker, validateM5WorkerProjectionBasis } from "./index";

interface M5ParityDiagnostics {
  readonly seed: string;
  readonly requestedSeed: string;
  readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
  readonly checkpointCount: number;
  readonly firstMismatchedCheckpointTick: number | null;
  readonly authoritativeReadModelHash: string;
  readonly projectionHash: string;
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
  readonly staleProjectionRejectCode: typeof SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload;
  readonly staleProjectionRejectDetail: string;
}

describe("M5 Worker/headless parity", () => {
  it("matches Node headless M5 hashes and emits read-only basis projections", () => {
    const worker = createSimulationWorker();
    const expected = readM5Replay(
      runM5AlphaContentReplay({
        seed: "5",
        checkpointTicks: M5_REPLAY_CHECKPOINT_SEQUENCE,
      }),
    );
    const finalProjection = createM5ReadOnlyProjection(
      runM5AlphaContentScenario({ seed: "5", ticks: expected.finalTick }),
      M5_REPLAY_CHECKPOINT_SEQUENCE.length - 1,
    );
    const snapshots: RenderSnapshotMessage[] = [];
    const uiDeltas: UiDeltaMessage[] = [];
    const metricsSamples: MetricsSampleMessage[] = [];

    collectProjectionMessages(
      worker.receive(makeM5InitSession(1)),
      snapshots,
      uiDeltas,
      metricsSamples,
    );

    for (let index = 1; index < M5_REPLAY_CHECKPOINT_SEQUENCE.length; index += 1) {
      const tick = M5_REPLAY_CHECKPOINT_SEQUENCE[index] ?? failMissingCheckpointTick();
      collectProjectionMessages(
        worker.receive(makeM5AdvanceBatch(index + 1, tick, index)),
        snapshots,
        uiDeltas,
        metricsSamples,
      );
    }

    expect(snapshots).toHaveLength(M5_REPLAY_CHECKPOINT_SEQUENCE.length);
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index] ?? failMissingSnapshot();
      const checkpoint = expected.checkpoints[index] ?? failMissingCheckpoint();
      expect(snapshot.payload).toMatchObject({
        entityCount: 7,
        scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        readModelHash: checkpoint.readModelHash,
        readOnly: true,
      });
    }

    const finalSnapshot = snapshots[snapshots.length - 1] ?? failMissingSnapshot();
    const finalUiDelta = uiDeltas[uiDeltas.length - 1] ?? failMissingUiDelta();
    const finalMetrics = metricsSamples[metricsSamples.length - 1] ?? failMissingMetricsSample();
    const freshValidation = validateM5WorkerProjectionBasis(
      finalProjection,
      finalProjection.contentManifestHash,
    );
    const staleValidation = validateM5WorkerProjectionBasis(
      createStaleProjection(finalProjection),
      finalProjection.contentManifestHash,
    );

    if (!freshValidation.ok) {
      throw new Error(freshValidation.reason.detail);
    }
    if (staleValidation.ok) {
      throw new Error("expected stale M5 projection rejection");
    }

    const detailAfterStaleCheck = uiDelta(worker.receive(makeRequestUiDetail(7)));
    const diagnostics = createM5ParityDiagnostics(
      snapshots,
      finalUiDelta,
      uiDeltas.length,
      metricsSamples.length,
      expected,
      finalProjection,
      staleValidation.reason.detail,
    );

    expect(finalSnapshot.payload).toMatchObject({
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      tick: expected.finalTick,
      worldHash: expected.finalWorldHash,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(finalUiDelta.payload).toMatchObject({
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      readModelHash: expected.finalReadModelHash,
      detailHash: finalProjection.scenarioReadModel.detailHash,
      readOnly: true,
    });
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m5-basis:content=0xe55d3015"),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining(
        `m5-basis:anomaly-roster=${readSurfaceHash(finalProjection, "anomaly-roster")}`,
      ),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining(
        `m5-basis:faction-governance=${readSurfaceHash(finalProjection, "faction-governance")}`,
      ),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining(
        `m5-basis:season-events=${readSurfaceHash(finalProjection, "season-events")}`,
      ),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining(
        `m5-basis:content-validation=${readSurfaceHash(finalProjection, "content-validation")}`,
      ),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining("m5-basis:review="),
    );
    expect(finalUiDelta.payload.summaries).toContainEqual(
      expect.stringContaining(`m5-basis:projection=${finalProjection.readModelHash}`),
    );
    expect(finalMetrics.payload).toMatchObject({
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: M5_REPLAY_CHECKPOINT_SEQUENCE.length,
    });
    expect(staleValidation.reason).toStrictEqual({
      code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      detail:
        "stale M5 projection basis: content manifest hash does not match active Worker content basis",
    });
    expect(detailAfterStaleCheck.payload).toMatchObject({
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(diagnostics).toMatchObject({
      seed: "155",
      requestedSeed: "5",
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      checkpointCount: M5_REPLAY_CHECKPOINT_SEQUENCE.length,
      firstMismatchedCheckpointTick: null,
      authoritativeReadModelHash: expected.finalReadModelHash,
      projectionHash: finalProjection.readModelHash,
      staleProjectionRejectCode: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
      latencyMetrics: {
        renderSnapshotMessages: M5_REPLAY_CHECKPOINT_SEQUENCE.length,
        uiDeltaMessages: M5_REPLAY_CHECKPOINT_SEQUENCE.length,
        metricsSampleMessages: M5_REPLAY_CHECKPOINT_SEQUENCE.length,
        totalProjectionMessages: M5_REPLAY_CHECKPOINT_SEQUENCE.length * 3,
      },
    });
    expect(diagnostics.finalSnapshotSizeBytes).toBeGreaterThan(0);
    expect(diagnostics.finalReadModelSizeBytes).toBeGreaterThan(0);
    expect(diagnostics.finalProjectionSizeBytes).toBeGreaterThan(
      diagnostics.finalReadModelSizeBytes,
    );
    expect(diagnostics.basisSurfaceCount).toBeGreaterThanOrEqual(M5_REBUILT_SURFACE_NAMES.length);

    writeM5DiagnosticsArtifact(diagnostics);
  });

  it("returns M5 save metadata without exposing mutable authority through the Worker", () => {
    const worker = createSimulationWorker();

    worker.receive(makeM5InitSession(1));
    worker.receive(makeM5AdvanceBatch(2, M5_SAVE_TICK, 1));
    const saveReady = saveReadyMessage(worker.receive(makeRequestSave(3)));

    expect(saveReady.payload).toMatchObject({
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      checkpointTick: M5_SAVE_TICK,
      worldHash: "0xc359959c",
    });
  });
});

function makeM5InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m5",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "5",
      catalogVersion: M5_ALPHA_CONTENT_SCENARIO_ID,
    },
  };
}

function makeM5AdvanceBatch(
  sequence: number,
  tick: number,
  commandSequence: number,
): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m5",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: createM5AdvanceCommandId(tick, commandSequence),
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makeRequestUiDetail(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m5",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestUiDetail,
    payload: {
      subject: {
        kind: "session",
      },
    },
  };
}

function makeRequestSave(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m5",
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

function createM5ParityDiagnostics(
  snapshots: readonly RenderSnapshotMessage[],
  finalUiDelta: UiDeltaMessage,
  uiDeltaMessageCount: number,
  metricsSampleMessageCount: number,
  expected: M5ReplayRun,
  finalProjection: M5ReadOnlyProjection,
  staleProjectionRejectDetail: string,
): M5ParityDiagnostics {
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
    scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
    checkpointCount: snapshots.length,
    firstMismatchedCheckpointTick,
    authoritativeReadModelHash: expected.finalReadModelHash,
    projectionHash: finalProjection.readModelHash,
    finalSnapshotSizeBytes,
    finalReadModelSizeBytes,
    finalProjectionSizeBytes: JSON.stringify(finalProjection).length,
    latencyMetrics: {
      renderSnapshotMessages: snapshots.length,
      uiDeltaMessages: uiDeltaMessageCount,
      metricsSampleMessages: metricsSampleMessageCount,
      totalProjectionMessages: snapshots.length + uiDeltaMessageCount + metricsSampleMessageCount,
    },
    basisSurfaceCount: countBasisSurfaces(finalUiDelta),
    staleProjectionRejectCode: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload,
    staleProjectionRejectDetail,
  };
}

function countBasisSurfaces(finalUiDelta: UiDeltaMessage): number {
  let count = 0;
  for (const summary of finalUiDelta.payload.summaries) {
    if (summary.startsWith("m5-basis:")) {
      count += 1;
    }
  }
  return count;
}

function createStaleProjection(projection: M5ReadOnlyProjection): M5ReadOnlyProjection {
  return {
    ...projection,
    contentManifestHash: "0x00000001",
    scenarioReadModel: {
      ...projection.scenarioReadModel,
      contentManifestHash: "0x00000001",
    },
  };
}

function readSurfaceHash(projection: M5ReadOnlyProjection, surfaceName: string): string {
  for (const surface of projection.rebuiltIndexes.surfaces) {
    if (surface.name === surfaceName) {
      return surface.hash;
    }
  }

  throw new Error(`missing M5 rebuilt surface ${surfaceName}`);
}

function writeM5DiagnosticsArtifact(diagnostics: M5ParityDiagnostics): void {
  const artifactDir = path.join("coordination", "artifacts", "WM-0082");
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    path.join(artifactDir, "m5-worker-parity-diagnostics.json"),
    `${JSON.stringify(diagnostics, null, 2)}\n`,
    "utf8",
  );
}

function uiDelta(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      return message;
    }
  }

  throw new Error("expected UiDelta message");
}

function saveReadyMessage(messages: readonly SimulationToMainMessage[]): SaveReadyMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady) {
      return message;
    }
  }

  throw new Error("expected SaveReady message");
}

function readM5Replay(result: ReturnType<typeof runM5AlphaContentReplay>): M5ReplayRun {
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
