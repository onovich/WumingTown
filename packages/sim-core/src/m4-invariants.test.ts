import { describe, expect, it } from "vitest";

import {
  M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  M4_FINAL_TICK,
  M4_LOAD_TICK,
  M4_REPLAY_CHECKPOINT_SEQUENCE,
  M4_SAVE_TICK,
  compareM4ReplayRuns,
  createM4CoreVerticalSliceSaveEnvelope,
  createM4ReadOnlyProjection,
  loadM4CoreVerticalSliceSaveEnvelope,
  resumeM4CoreVerticalSliceFromSave,
  runM4CoreVerticalSliceReplay,
  runM4CoreVerticalSliceScenario,
  type M4CoreVerticalSliceScenarioSummary,
  type M4ReplayRun,
} from "./index";

const REQUESTED_SEED = "4";
const LONG_HORIZON_TICKS = 100_000;
const SAMPLE_TICKS = [12_000, M4_FINAL_TICK, 60_000, 80_000, LONG_HORIZON_TICKS] as const;
const SAVE_REPLAY_CHECKPOINTS = [
  M4_SAVE_TICK,
  M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
  LONG_HORIZON_TICKS,
] as const;

describe("M4 core vertical-slice long-run invariants", () => {
  it("keeps M4 metrics stable through the long idle window and preserves replay gates", () => {
    const samples = createSamples();
    const longRun = readLastSample(samples);
    const replay = readReplay(
      runM4CoreVerticalSliceReplay({
        seed: REQUESTED_SEED,
        checkpointTicks: [...M4_REPLAY_CHECKPOINT_SEQUENCE, LONG_HORIZON_TICKS],
      }),
    );
    const replayAfterSave = readReplay(
      runM4CoreVerticalSliceReplay({
        seed: REQUESTED_SEED,
        checkpointTicks: SAVE_REPLAY_CHECKPOINTS,
      }),
    );
    const save = createM4CoreVerticalSliceSaveEnvelope(REQUESTED_SEED, M4_SAVE_TICK);
    const loaded = loadM4CoreVerticalSliceSaveEnvelope(save);
    const resumed = readReplay(
      resumeM4CoreVerticalSliceFromSave({
        save,
        loadTick: M4_LOAD_TICK,
        finalTick: LONG_HORIZON_TICKS,
        checkpointTicks: SAVE_REPLAY_CHECKPOINTS,
      }),
    );
    const compared = compareM4ReplayRuns(replayAfterSave, resumed, {
      expectedPath: "coordination/artifacts/WM-0070/m4-invariants/expected.json",
      actualPath: "coordination/artifacts/WM-0070/m4-invariants/actual.json",
      diffPath: "coordination/artifacts/WM-0070/m4-invariants/diff.json",
    });
    const longRunProjection = createM4ReadOnlyProjection(
      longRun,
      M4_REPLAY_CHECKPOINT_SEQUENCE.length,
    );

    expect(longRun.scenarioId).toBe(M4_CORE_VERTICAL_SLICE_SCENARIO_ID);
    expect(longRun.requestedSeed).toBe(REQUESTED_SEED);
    expect(longRun.seed).toBe("50");
    expect(longRun.finalTick).toBe(LONG_HORIZON_TICKS);
    expect(longRun.invariantCounters).toMatchObject({
      preventionPathCount: 1,
      containmentPathCount: 1,
      failurePathCount: 1,
      directFactMutationByDirectorCount: 0,
      m0ToM3RegressionCount: 0,
    });
    expect(longRun.m3Regression).toMatchObject({
      scenarioId: "m3.ordinary_life.injured_caregiver.v1",
      requestedSeed: "3",
      authoritativeScenarioSeed: "46",
      commandStreamHash: "0x226832d2",
      contentHash: "0xdfe7107e",
      finalWorldHash: "0x7eb81a69",
      readModelHash: "0x82bf87d6",
      activeM4FactCountInM3Baseline: 0,
    });

    expect(replay.finalTick).toBe(LONG_HORIZON_TICKS);
    expect(replay.finalWorldHash).toBe(longRun.finalWorldHash);
    expect(replay.finalReadModelHash).toBe(longRunProjection.readModelHash);
    expect(compared).toMatchObject({ ok: true });
    expect(resumed.finalWorldHash).toBe(replayAfterSave.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(replayAfterSave.finalReadModelHash);
    if (!loaded.ok) {
      throw new Error(loaded.reason);
    }
    expect(loaded.loadTick).toBe(M4_LOAD_TICK);
    expect(loaded.rebuiltSurfaceNames.includes("lamp-gap")).toBe(true);
    expect(loaded.rebuiltSurfaceNames.includes("read-model")).toBe(true);
    expect(loaded.rebuiltSurfaceNames.includes("metrics")).toBe(true);

    expect(noLampDirtyBacklogGrowth(samples)).toBe(true);
    expect(noEvidenceDrift(samples)).toBe(true);
    expect(noDisseminationBacklogGrowth(samples)).toBe(true);
    expect(noObligationLeaks(samples)).toBe(true);
    expect(noInvalidCrisisTransitions(longRun)).toBe(true);
    expect(noDirectorRecoveryWindowViolation(longRun)).toBe(true);
    expect(noReasonTraceOverflow(longRun)).toBe(true);
    expect(noHashDivergence(replay, longRun, longRunProjection.readModelHash)).toBe(true);

    expect(longRun.performanceMetrics.lampFullMapDiffusionCount).toBe(0);
    expect(longRun.performanceMetrics.evidenceSupportCandidateVisits).toBeGreaterThan(0);
    expect(longRun.performanceMetrics.townRuleComplianceCandidateVisits).toBeGreaterThan(0);
    expect(longRun.performanceMetrics.crisisTransitionCount).toBeGreaterThanOrEqual(6);
    expect(longRun.performanceMetrics.directorRecoveryWindowCount).toBeGreaterThan(0);
  });
});

function createSamples(): readonly M4CoreVerticalSliceScenarioSummary[] {
  const samples: M4CoreVerticalSliceScenarioSummary[] = [];
  for (const tick of SAMPLE_TICKS) {
    samples.push(runM4CoreVerticalSliceScenario({ seed: REQUESTED_SEED, ticks: tick }));
  }
  return samples;
}

function readReplay(result: ReturnType<typeof runM4CoreVerticalSliceReplay>): M4ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readLastSample(
  samples: readonly M4CoreVerticalSliceScenarioSummary[],
): M4CoreVerticalSliceScenarioSummary {
  const summary = samples[samples.length - 1];
  if (summary === undefined) {
    throw new Error("M4 invariant gate expected at least one sample");
  }
  return summary;
}

function noLampDirtyBacklogGrowth(samples: readonly M4CoreVerticalSliceScenarioSummary[]): boolean {
  const idle = readIdleWindowSamples(samples);
  const first = idle[0] ?? failMissingIdleSample();
  for (const sample of idle) {
    if (
      sample.performanceMetrics.lampDirtyBacklogFinal >
        first.performanceMetrics.lampDirtyBacklogFinal ||
      sample.performanceMetrics.lampGapDirtyBacklogFinal >
        first.performanceMetrics.lampGapDirtyBacklogFinal ||
      sample.performanceMetrics.activeGapCount !== first.performanceMetrics.activeGapCount
    ) {
      return false;
    }
  }
  return true;
}

function noEvidenceDrift(samples: readonly M4CoreVerticalSliceScenarioSummary[]): boolean {
  const idle = readIdleWindowSamples(samples);
  const first = idle[0] ?? failMissingIdleSample();
  for (const sample of idle) {
    if (
      sample.performanceMetrics.evidenceRowCount !== first.performanceMetrics.evidenceRowCount ||
      sample.performanceMetrics.evidenceConfirmedRuleCount !==
        first.performanceMetrics.evidenceConfirmedRuleCount ||
      sample.performanceMetrics.evidenceSupportCandidateVisits !==
        first.performanceMetrics.evidenceSupportCandidateVisits
    ) {
      return false;
    }
  }
  return true;
}

function noDisseminationBacklogGrowth(
  samples: readonly M4CoreVerticalSliceScenarioSummary[],
): boolean {
  const idle = readIdleWindowSamples(samples);
  const first = idle[0] ?? failMissingIdleSample();
  for (const sample of idle) {
    if (
      sample.performanceMetrics.disseminationDirtyBacklogFinal >
        first.performanceMetrics.disseminationDirtyBacklogFinal ||
      sample.performanceMetrics.disseminationRowCount !==
        first.performanceMetrics.disseminationRowCount
    ) {
      return false;
    }
  }
  return true;
}

function noObligationLeaks(samples: readonly M4CoreVerticalSliceScenarioSummary[]): boolean {
  const idle = readIdleWindowSamples(samples);
  const first = idle[0] ?? failMissingIdleSample();
  for (const sample of idle) {
    if (
      sample.performanceMetrics.obligationActiveCount !==
        first.performanceMetrics.obligationActiveCount ||
      sample.performanceMetrics.obligationDueIndexedCount !==
        first.performanceMetrics.obligationDueIndexedCount ||
      sample.performanceMetrics.obligationFulfilledCount !==
        first.performanceMetrics.obligationFulfilledCount ||
      sample.performanceMetrics.obligationViolatedCount !== 0
    ) {
      return false;
    }
  }
  return true;
}

function noInvalidCrisisTransitions(summary: M4CoreVerticalSliceScenarioSummary): boolean {
  return (
    summary.performanceMetrics.crisisActiveCount === 0 &&
    summary.performanceMetrics.crisisResolvedCount === 1 &&
    summary.performanceMetrics.crisisFailedCount === 1 &&
    summary.performanceMetrics.crisisLowRiskEvidenceCount === 4 &&
    summary.containmentPath.evidenceBeforeIrreversibleHarm &&
    summary.failurePath.evidenceBeforeIrreversibleHarm
  );
}

function noDirectorRecoveryWindowViolation(summary: M4CoreVerticalSliceScenarioSummary): boolean {
  return (
    summary.performanceMetrics.directorRecoveryWindowCount === 1 &&
    summary.performanceMetrics.directorSelectionCount === 1 &&
    summary.performanceMetrics.directorCandidateVisits <= summary.boundedReads.directorCandidateCap
  );
}

function noReasonTraceOverflow(summary: M4CoreVerticalSliceScenarioSummary): boolean {
  return (
    summary.performanceMetrics.reasonTraceStoredCount <=
      summary.performanceMetrics.reasonTraceCapacity &&
    summary.performanceMetrics.reasonTraceBacklogCount === 0
  );
}

function noHashDivergence(
  replay: M4ReplayRun,
  summary: M4CoreVerticalSliceScenarioSummary,
  projectionHash: string,
): boolean {
  return (
    replay.finalWorldHash === summary.finalWorldHash && replay.finalReadModelHash === projectionHash
  );
}

function readIdleWindowSamples(
  samples: readonly M4CoreVerticalSliceScenarioSummary[],
): readonly M4CoreVerticalSliceScenarioSummary[] {
  const idleSamples: M4CoreVerticalSliceScenarioSummary[] = [];
  for (const sample of samples) {
    if (sample.finalTick >= M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS) {
      idleSamples.push(sample);
    }
  }
  return idleSamples;
}

function failMissingIdleSample(): never {
  throw new Error("M4 invariant gate expected at least one idle-window sample");
}
