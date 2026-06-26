import { performance } from "node:perf_hooks";

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
  type M4CoreVerticalSlicePerformanceMetrics,
  type M4CoreVerticalSliceScenarioSummary,
  type M4ReplayCheckpoint,
  type M4ReplayRun,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

const REQUESTED_SEED = "4";
const LONG_HORIZON_TICKS = 100_000;
const SAMPLE_TICKS = [12_000, M4_FINAL_TICK, 60_000, 80_000, LONG_HORIZON_TICKS] as const;
const SAVE_REPLAY_CHECKPOINTS = [
  M4_SAVE_TICK,
  M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
  LONG_HORIZON_TICKS,
] as const;

export interface M4CoreVerticalSliceLongRunBenchmarkReport {
  readonly name: "m4-core-vertical-slice-long-run";
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly requestedSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly loadTick: number;
  readonly tickRate: number;
  readonly checkpointCount: number;
  readonly checkpointHashes: readonly M4ReplayCheckpoint[];
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly finalSummary: M4CoreVerticalSliceScenarioSummary;
  readonly m4Metrics: M4CoreVerticalSlicePerformanceMetrics;
  readonly saveLoadRebuildTimeMs: number;
  readonly saveLoadRebuiltSurfaceCount: number;
  readonly workerRenderSnapshotBytes: number;
  readonly workerScenarioReadModelBytes: number;
  readonly workerProjectionBytes: number;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly workerProjectionMatches: boolean;
  readonly noLampDirtyBacklogGrowth: boolean;
  readonly noEvidenceDrift: boolean;
  readonly noDisseminationBacklogGrowth: boolean;
  readonly noObligationLeaks: boolean;
  readonly noInvalidCrisisTransitions: boolean;
  readonly noDirectorRecoveryWindowViolation: boolean;
  readonly noReasonTraceOverflow: boolean;
  readonly noM0ToM3Regression: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M4CoreVerticalSliceLongRunBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly requestedSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly loadTick: number;
  readonly tickRate: number;
  readonly checkpointCount: number;
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly lampDirtyBacklogPeak: number;
  readonly lampDirtyBacklogFinal: number;
  readonly activeGapCount: number;
  readonly evidenceSupportCandidateVisits: number;
  readonly evidenceConfirmedRuleCount: number;
  readonly disseminationDirtyBacklogFinal: number;
  readonly obligationDueIndexedCount: number;
  readonly obligationViolatedCount: number;
  readonly townRuleComplianceCandidateVisits: number;
  readonly crisisTransitionCount: number;
  readonly directorCandidateVisits: number;
  readonly directorRecoveryWindowCount: number;
  readonly reasonTraceCapacity: number;
  readonly reasonTraceStoredCount: number;
  readonly saveLoadRebuiltSurfaceCount: number;
  readonly workerRenderSnapshotBytes: number;
  readonly workerScenarioReadModelBytes: number;
  readonly workerProjectionBytes: number;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly workerProjectionMatches: boolean;
  readonly noLampDirtyBacklogGrowth: boolean;
  readonly noEvidenceDrift: boolean;
  readonly noDisseminationBacklogGrowth: boolean;
  readonly noObligationLeaks: boolean;
  readonly noInvalidCrisisTransitions: boolean;
  readonly noDirectorRecoveryWindowViolation: boolean;
  readonly noReasonTraceOverflow: boolean;
  readonly noM0ToM3Regression: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
}

export interface SampledM4CoreVerticalSliceLongRunBenchmark {
  readonly name: "m4-core-vertical-slice-long-run";
  readonly report: M4CoreVerticalSliceLongRunBenchmarkReport;
  readonly invariants: M4CoreVerticalSliceLongRunBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM4CoreVerticalSliceLongRunBenchmark(): M4CoreVerticalSliceLongRunBenchmarkReport {
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  const samples = SAMPLE_TICKS.map((tick) =>
    runM4CoreVerticalSliceScenario({ seed: REQUESTED_SEED, ticks: tick }),
  );
  const scenario = readLastSample(samples);
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
  const loadStartedAtMs = performance.now();
  const loaded = loadM4CoreVerticalSliceSaveEnvelope(save);
  const saveLoadRebuildTimeMs = performance.now() - loadStartedAtMs;
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const resumed = readReplay(
    resumeM4CoreVerticalSliceFromSave({
      save,
      loadTick: M4_LOAD_TICK,
      finalTick: LONG_HORIZON_TICKS,
      checkpointTicks: SAVE_REPLAY_CHECKPOINTS,
    }),
  );
  const projection = createM4ReadOnlyProjection(scenario, M4_REPLAY_CHECKPOINT_SEQUENCE.length);
  const comparison = compareM4ReplayRuns(replayAfterSave, resumed, {
    expectedPath: "coordination/artifacts/WM-0070/m4-benchmarks/expected.json",
    actualPath: "coordination/artifacts/WM-0070/m4-benchmarks/actual.json",
    diffPath: "coordination/artifacts/WM-0070/m4-benchmarks/diff.json",
  });
  const saveRoundTripMatches =
    resumed.finalWorldHash === replayAfterSave.finalWorldHash &&
    resumed.finalReadModelHash === replayAfterSave.finalReadModelHash;
  const workerProjectionMatches = replay.finalReadModelHash === projection.readModelHash;
  const noLampDirtyBacklogGrowth = hasNoLampDirtyBacklogGrowth(samples);
  const noEvidenceDrift = hasNoEvidenceDrift(samples);
  const noDisseminationBacklogGrowth = hasNoDisseminationBacklogGrowth(samples);
  const noObligationLeaks = hasNoObligationLeaks(samples);
  const noInvalidCrisisTransitions = hasNoInvalidCrisisTransitions(scenario);
  const noDirectorRecoveryWindowViolation = hasNoDirectorRecoveryWindowViolation(scenario);
  const noReasonTraceOverflow = hasNoReasonTraceOverflow(scenario);
  const replayMatches =
    replay.finalTick === LONG_HORIZON_TICKS &&
    replay.finalWorldHash === scenario.finalWorldHash &&
    workerProjectionMatches;
  const noHashDivergence = comparison.ok && replayMatches && saveRoundTripMatches;
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "m4-core-vertical-slice-long-run",
    scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    scenarioSeed: scenario.seed,
    requestedSeed: REQUESTED_SEED,
    finalTick: LONG_HORIZON_TICKS,
    saveTick: M4_SAVE_TICK,
    loadTick: M4_LOAD_TICK,
    tickRate: scenario.tickRate,
    checkpointCount: replay.checkpoints.length,
    checkpointHashes: replay.checkpoints,
    commandStreamHash: scenario.commandStreamHash,
    contentHash: scenario.contentHash,
    finalWorldHash: scenario.finalWorldHash,
    finalReadModelHash: replay.finalReadModelHash,
    finalSummary: scenario,
    m4Metrics: scenario.performanceMetrics,
    saveLoadRebuildTimeMs,
    saveLoadRebuiltSurfaceCount: loaded.rebuiltSurfaceNames.length,
    workerRenderSnapshotBytes: byteLengthOfJson(projection.renderSnapshot),
    workerScenarioReadModelBytes: byteLengthOfJson(projection.scenarioReadModel),
    workerProjectionBytes: byteLengthOfJson(projection),
    terminalSampleCount: samples.length,
    terminalFirstSampleTick: SAMPLE_TICKS[0],
    terminalLastSampleTick: LONG_HORIZON_TICKS,
    replayMatches,
    saveRoundTripMatches,
    workerProjectionMatches,
    noLampDirtyBacklogGrowth,
    noEvidenceDrift,
    noDisseminationBacklogGrowth,
    noObligationLeaks,
    noInvalidCrisisTransitions,
    noDirectorRecoveryWindowViolation,
    noReasonTraceOverflow,
    noM0ToM3Regression: scenario.invariantCounters.m0ToM3RegressionCount === 0,
    noQueueGrowth: noLampDirtyBacklogGrowth && noDisseminationBacklogGrowth,
    noHashDivergence,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m4CoreVerticalSliceLongRunInvariantsFromReport(
  report: M4CoreVerticalSliceLongRunBenchmarkReport,
): M4CoreVerticalSliceLongRunBenchmarkInvariants {
  return {
    scenarioId: report.scenarioId,
    scenarioSeed: report.scenarioSeed,
    requestedSeed: report.requestedSeed,
    finalTick: report.finalTick,
    saveTick: report.saveTick,
    loadTick: report.loadTick,
    tickRate: report.tickRate,
    checkpointCount: report.checkpointCount,
    commandStreamHash: report.commandStreamHash,
    contentHash: report.contentHash,
    finalWorldHash: report.finalWorldHash,
    finalReadModelHash: report.finalReadModelHash,
    lampDirtyBacklogPeak: report.m4Metrics.lampDirtyBacklogPeak,
    lampDirtyBacklogFinal: report.m4Metrics.lampDirtyBacklogFinal,
    activeGapCount: report.m4Metrics.activeGapCount,
    evidenceSupportCandidateVisits: report.m4Metrics.evidenceSupportCandidateVisits,
    evidenceConfirmedRuleCount: report.m4Metrics.evidenceConfirmedRuleCount,
    disseminationDirtyBacklogFinal: report.m4Metrics.disseminationDirtyBacklogFinal,
    obligationDueIndexedCount: report.m4Metrics.obligationDueIndexedCount,
    obligationViolatedCount: report.m4Metrics.obligationViolatedCount,
    townRuleComplianceCandidateVisits: report.m4Metrics.townRuleComplianceCandidateVisits,
    crisisTransitionCount: report.m4Metrics.crisisTransitionCount,
    directorCandidateVisits: report.m4Metrics.directorCandidateVisits,
    directorRecoveryWindowCount: report.m4Metrics.directorRecoveryWindowCount,
    reasonTraceCapacity: report.m4Metrics.reasonTraceCapacity,
    reasonTraceStoredCount: report.m4Metrics.reasonTraceStoredCount,
    saveLoadRebuiltSurfaceCount: report.saveLoadRebuiltSurfaceCount,
    workerRenderSnapshotBytes: report.workerRenderSnapshotBytes,
    workerScenarioReadModelBytes: report.workerScenarioReadModelBytes,
    workerProjectionBytes: report.workerProjectionBytes,
    terminalSampleCount: report.terminalSampleCount,
    terminalFirstSampleTick: report.terminalFirstSampleTick,
    terminalLastSampleTick: report.terminalLastSampleTick,
    replayMatches: report.replayMatches,
    saveRoundTripMatches: report.saveRoundTripMatches,
    workerProjectionMatches: report.workerProjectionMatches,
    noLampDirtyBacklogGrowth: report.noLampDirtyBacklogGrowth,
    noEvidenceDrift: report.noEvidenceDrift,
    noDisseminationBacklogGrowth: report.noDisseminationBacklogGrowth,
    noObligationLeaks: report.noObligationLeaks,
    noInvalidCrisisTransitions: report.noInvalidCrisisTransitions,
    noDirectorRecoveryWindowViolation: report.noDirectorRecoveryWindowViolation,
    noReasonTraceOverflow: report.noReasonTraceOverflow,
    noM0ToM3Regression: report.noM0ToM3Regression,
    noQueueGrowth: report.noQueueGrowth,
    noHashDivergence: report.noHashDivergence,
  };
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
    throw new Error("M4 benchmark expected at least one sample");
  }
  return summary;
}

function byteLengthOfJson(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function hasNoLampDirtyBacklogGrowth(
  samples: readonly M4CoreVerticalSliceScenarioSummary[],
): boolean {
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

function hasNoEvidenceDrift(samples: readonly M4CoreVerticalSliceScenarioSummary[]): boolean {
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

function hasNoDisseminationBacklogGrowth(
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

function hasNoObligationLeaks(samples: readonly M4CoreVerticalSliceScenarioSummary[]): boolean {
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

function hasNoInvalidCrisisTransitions(summary: M4CoreVerticalSliceScenarioSummary): boolean {
  return (
    summary.performanceMetrics.crisisActiveCount === 0 &&
    summary.performanceMetrics.crisisResolvedCount === 1 &&
    summary.performanceMetrics.crisisFailedCount === 1 &&
    summary.performanceMetrics.crisisLowRiskEvidenceCount === 4 &&
    summary.containmentPath.evidenceBeforeIrreversibleHarm &&
    summary.failurePath.evidenceBeforeIrreversibleHarm
  );
}

function hasNoDirectorRecoveryWindowViolation(
  summary: M4CoreVerticalSliceScenarioSummary,
): boolean {
  return (
    summary.performanceMetrics.directorRecoveryWindowCount === 1 &&
    summary.performanceMetrics.directorSelectionCount === 1 &&
    summary.performanceMetrics.directorCandidateVisits <= summary.boundedReads.directorCandidateCap
  );
}

function hasNoReasonTraceOverflow(summary: M4CoreVerticalSliceScenarioSummary): boolean {
  return (
    summary.performanceMetrics.reasonTraceStoredCount <=
      summary.performanceMetrics.reasonTraceCapacity &&
    summary.performanceMetrics.reasonTraceBacklogCount === 0
  );
}

function readIdleWindowSamples(
  samples: readonly M4CoreVerticalSliceScenarioSummary[],
): readonly M4CoreVerticalSliceScenarioSummary[] {
  return samples.filter((sample) => sample.finalTick >= M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS);
}

function failMissingIdleSample(): never {
  throw new Error("M4 benchmark expected at least one idle-window sample");
}
