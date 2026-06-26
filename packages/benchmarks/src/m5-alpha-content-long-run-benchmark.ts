import { performance } from "node:perf_hooks";

import {
  M5_ALPHA_CONTENT_EXPECTED_TICKS,
  M5_ALPHA_CONTENT_SCENARIO_ID,
  M5_FINAL_TICK,
  M5_LOAD_TICK,
  M5_REPLAY_CHECKPOINT_SEQUENCE,
  M5_SAVE_TICK,
  compareM5ReplayRuns,
  createM5AlphaContentSaveEnvelope,
  createM5WorkerProjection,
  loadM5AlphaContentSaveEnvelope,
  resumeM5AlphaContentFromSave,
  runM5AlphaContentReplay,
  runM5AlphaContentScenario,
  type M5AlphaContentScenarioSummary,
  type M5ReplayCheckpoint,
  type M5ReplayRun,
  type M5WorkerProjection,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

const REQUESTED_SEED = "5";
const LONG_HORIZON_TICKS = 100_000;
const SAMPLE_TICKS = [
  M5_SAVE_TICK,
  M5_ALPHA_CONTENT_EXPECTED_TICKS,
  60_000,
  80_000,
  LONG_HORIZON_TICKS,
] as const;
const LONG_REPLAY_CHECKPOINTS = [...M5_REPLAY_CHECKPOINT_SEQUENCE, LONG_HORIZON_TICKS] as const;
const SAVE_REPLAY_CHECKPOINTS = [M5_SAVE_TICK, M5_FINAL_TICK, LONG_HORIZON_TICKS] as const;

export interface M5AlphaContentLongRunBenchmarkReport {
  readonly name: "m5-alpha-content-long-run";
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly requestedSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly loadTick: number;
  readonly tickRate: number;
  readonly checkpointCount: number;
  readonly checkpointHashes: readonly M5ReplayCheckpoint[];
  readonly commandStreamHash: string;
  readonly contentManifestHash: string;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly finalSummary: M5AlphaContentScenarioSummary;
  readonly contentDefinitionCount: number;
  readonly catalogEntryCount: number;
  readonly contentValidationFailureCount: number;
  readonly anomalyDefinitionCount: number;
  readonly anomalyActivationCandidateVisits: number;
  readonly anomalyTransitionCount: number;
  readonly thirdKnockResolvedCount: number;
  readonly oldBridgeResolvedCount: number;
  readonly factionCandidateVisits: number;
  readonly governanceCandidateVisits: number;
  readonly factionSelectedFactCount: number;
  readonly governanceSelectedHookCount: number;
  readonly eventPoolCandidateCount: number;
  readonly eventTransitionCount: number;
  readonly eventCooldownWriteCount: number;
  readonly eventPreconditionFailureCount: number;
  readonly saveLoadRebuildTimeMs: number;
  readonly saveLoadRebuiltSurfaceCount: number;
  readonly workerProjectionBytes: number;
  readonly workerProjectionSurfaceCount: number;
  readonly workerProjectionHash: string;
  readonly workerReadModelHash: string;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly workerProjectionMatches: boolean;
  readonly noContentValidationDrift: boolean;
  readonly noAnomalyLeaks: boolean;
  readonly noFactionGovernanceHiddenAuthority: boolean;
  readonly noEventQueueGrowth: boolean;
  readonly noM0ToM4Regression: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly m6StopSignVerdict: "stop_signs_only";
  readonly m6Created: false;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M5AlphaContentLongRunBenchmarkInvariants extends Record<
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
  readonly contentManifestHash: string;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly contentDefinitionCount: number;
  readonly catalogEntryCount: number;
  readonly contentValidationFailureCount: number;
  readonly anomalyDefinitionCount: number;
  readonly anomalyActivationCandidateVisits: number;
  readonly anomalyTransitionCount: number;
  readonly thirdKnockResolvedCount: number;
  readonly oldBridgeResolvedCount: number;
  readonly factionCandidateVisits: number;
  readonly governanceCandidateVisits: number;
  readonly factionSelectedFactCount: number;
  readonly governanceSelectedHookCount: number;
  readonly eventPoolCandidateCount: number;
  readonly eventTransitionCount: number;
  readonly eventCooldownWriteCount: number;
  readonly eventPreconditionFailureCount: number;
  readonly saveLoadRebuiltSurfaceCount: number;
  readonly workerProjectionBytes: number;
  readonly workerProjectionSurfaceCount: number;
  readonly workerProjectionHash: string;
  readonly workerReadModelHash: string;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly workerProjectionMatches: boolean;
  readonly noContentValidationDrift: boolean;
  readonly noAnomalyLeaks: boolean;
  readonly noFactionGovernanceHiddenAuthority: boolean;
  readonly noEventQueueGrowth: boolean;
  readonly noM0ToM4Regression: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly m6StopSignVerdict: string;
  readonly m6Created: boolean;
}

export interface SampledM5AlphaContentLongRunBenchmark {
  readonly name: "m5-alpha-content-long-run";
  readonly report: M5AlphaContentLongRunBenchmarkReport;
  readonly invariants: M5AlphaContentLongRunBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM5AlphaContentLongRunBenchmark(): M5AlphaContentLongRunBenchmarkReport {
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  const samples = createSamples();
  const scenario = readLastSample(samples);
  const replay = readReplay(
    runM5AlphaContentReplay({
      seed: REQUESTED_SEED,
      checkpointTicks: LONG_REPLAY_CHECKPOINTS,
    }),
  );
  const replayAfterSave = readReplay(
    runM5AlphaContentReplay({
      seed: REQUESTED_SEED,
      checkpointTicks: SAVE_REPLAY_CHECKPOINTS,
    }),
  );
  const save = createM5AlphaContentSaveEnvelope(REQUESTED_SEED, M5_SAVE_TICK);
  const loadStartedAtMs = performance.now();
  const loaded = loadM5AlphaContentSaveEnvelope(save);
  const saveLoadRebuildTimeMs = performance.now() - loadStartedAtMs;
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const resumed = readReplay(
    resumeM5AlphaContentFromSave({
      save,
      loadTick: M5_LOAD_TICK,
      finalTick: LONG_HORIZON_TICKS,
      checkpointTicks: SAVE_REPLAY_CHECKPOINTS,
    }),
  );
  const workerProjection = readWorkerProjection(
    createM5WorkerProjection(REQUESTED_SEED, M5_FINAL_TICK),
  );
  const workerCheckpoint = readCheckpoint(replay, M5_FINAL_TICK);
  const comparison = compareM5ReplayRuns(replayAfterSave, resumed, {
    expectedPath: "coordination/artifacts/WM-0083/m5-benchmarks/expected.json",
    actualPath: "coordination/artifacts/WM-0083/m5-benchmarks/actual.json",
    diffPath: "coordination/artifacts/WM-0083/m5-benchmarks/diff.json",
  });
  const replayMatches =
    replay.finalTick === LONG_HORIZON_TICKS &&
    replay.finalWorldHash === scenario.finalWorldHash &&
    replay.finalReadModelHash === scenario.readModelHash;
  const saveRoundTripMatches =
    resumed.finalWorldHash === replayAfterSave.finalWorldHash &&
    resumed.finalReadModelHash === replayAfterSave.finalReadModelHash;
  const workerProjectionMatches =
    workerProjection.worldHash === workerCheckpoint.worldHash &&
    workerProjection.authoritativeReadModelHash === workerCheckpoint.readModelHash;
  const noContentValidationDrift = hasNoContentValidationDrift(samples);
  const noAnomalyLeaks = hasNoAnomalyLeaks(samples);
  const noFactionGovernanceHiddenAuthority = hasNoFactionGovernanceHiddenAuthority(samples);
  const noEventQueueGrowth = hasNoEventQueueGrowth(samples);
  const noM0ToM4Regression = hasNoM0ToM4Regression(scenario);
  const noQueueGrowth = noEventQueueGrowth && noAnomalyLeaks;
  const noHashDivergence =
    comparison.ok && replayMatches && saveRoundTripMatches && workerProjectionMatches;
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "m5-alpha-content-long-run",
    scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
    scenarioSeed: scenario.authoritativeScenarioSeed,
    requestedSeed: REQUESTED_SEED,
    finalTick: LONG_HORIZON_TICKS,
    saveTick: M5_SAVE_TICK,
    loadTick: M5_LOAD_TICK,
    tickRate: scenario.tickRate,
    checkpointCount: replay.checkpoints.length,
    checkpointHashes: replay.checkpoints,
    commandStreamHash: scenario.commandStreamHash,
    contentManifestHash: scenario.contentHash,
    finalWorldHash: scenario.finalWorldHash,
    finalReadModelHash: replay.finalReadModelHash,
    finalSummary: scenario,
    contentDefinitionCount: scenario.contentCatalog.definitionCount,
    catalogEntryCount: scenario.contentCatalog.catalogEntryCount,
    contentValidationFailureCount: scenario.contentCatalog.blockedReasonCount,
    anomalyDefinitionCount: scenario.roster.definitionCount,
    anomalyActivationCandidateVisits: countAnomalyCandidateVisits(scenario),
    anomalyTransitionCount: countAnomalyTransitions(scenario),
    thirdKnockResolvedCount: scenario.thirdKnock.metrics.resolvedCrisisCount,
    oldBridgeResolvedCount: scenario.oldBridge.metrics.resolvedCrisisCount,
    factionCandidateVisits: scenario.factionGovernance.factionMetrics.totalQueryVisits,
    governanceCandidateVisits: scenario.factionGovernance.governanceMetrics.totalQueryVisits,
    factionSelectedFactCount: scenario.factionGovernance.factionSelectedFactIds.length,
    governanceSelectedHookCount: scenario.factionGovernance.governanceSelectedHookIds.length,
    eventPoolCandidateCount:
      scenario.season.metrics.activeIncidentCandidateCount +
      scenario.season.metrics.activeRecoveryCandidateCount,
    eventTransitionCount: scenario.season.metrics.selectionCount,
    eventCooldownWriteCount: scenario.season.metrics.cooldownWriteCount,
    eventPreconditionFailureCount: scenario.season.metrics.preconditionFailureCount,
    saveLoadRebuildTimeMs,
    saveLoadRebuiltSurfaceCount: loaded.rebuiltSurfaceNames.length,
    workerProjectionBytes: byteLengthOfJson(workerProjection),
    workerProjectionSurfaceCount: workerProjection.rebuiltSurfaces.length,
    workerProjectionHash: workerProjection.projectionHash,
    workerReadModelHash: workerProjection.authoritativeReadModelHash,
    terminalSampleCount: samples.length,
    terminalFirstSampleTick: SAMPLE_TICKS[0],
    terminalLastSampleTick: LONG_HORIZON_TICKS,
    replayMatches,
    saveRoundTripMatches,
    workerProjectionMatches,
    noContentValidationDrift,
    noAnomalyLeaks,
    noFactionGovernanceHiddenAuthority,
    noEventQueueGrowth,
    noM0ToM4Regression,
    noQueueGrowth,
    noHashDivergence,
    m6StopSignVerdict: "stop_signs_only",
    m6Created: false,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m5AlphaContentLongRunInvariantsFromReport(
  report: M5AlphaContentLongRunBenchmarkReport,
): M5AlphaContentLongRunBenchmarkInvariants {
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
    contentManifestHash: report.contentManifestHash,
    finalWorldHash: report.finalWorldHash,
    finalReadModelHash: report.finalReadModelHash,
    contentDefinitionCount: report.contentDefinitionCount,
    catalogEntryCount: report.catalogEntryCount,
    contentValidationFailureCount: report.contentValidationFailureCount,
    anomalyDefinitionCount: report.anomalyDefinitionCount,
    anomalyActivationCandidateVisits: report.anomalyActivationCandidateVisits,
    anomalyTransitionCount: report.anomalyTransitionCount,
    thirdKnockResolvedCount: report.thirdKnockResolvedCount,
    oldBridgeResolvedCount: report.oldBridgeResolvedCount,
    factionCandidateVisits: report.factionCandidateVisits,
    governanceCandidateVisits: report.governanceCandidateVisits,
    factionSelectedFactCount: report.factionSelectedFactCount,
    governanceSelectedHookCount: report.governanceSelectedHookCount,
    eventPoolCandidateCount: report.eventPoolCandidateCount,
    eventTransitionCount: report.eventTransitionCount,
    eventCooldownWriteCount: report.eventCooldownWriteCount,
    eventPreconditionFailureCount: report.eventPreconditionFailureCount,
    saveLoadRebuiltSurfaceCount: report.saveLoadRebuiltSurfaceCount,
    workerProjectionBytes: report.workerProjectionBytes,
    workerProjectionSurfaceCount: report.workerProjectionSurfaceCount,
    workerProjectionHash: report.workerProjectionHash,
    workerReadModelHash: report.workerReadModelHash,
    terminalSampleCount: report.terminalSampleCount,
    terminalFirstSampleTick: report.terminalFirstSampleTick,
    terminalLastSampleTick: report.terminalLastSampleTick,
    replayMatches: report.replayMatches,
    saveRoundTripMatches: report.saveRoundTripMatches,
    workerProjectionMatches: report.workerProjectionMatches,
    noContentValidationDrift: report.noContentValidationDrift,
    noAnomalyLeaks: report.noAnomalyLeaks,
    noFactionGovernanceHiddenAuthority: report.noFactionGovernanceHiddenAuthority,
    noEventQueueGrowth: report.noEventQueueGrowth,
    noM0ToM4Regression: report.noM0ToM4Regression,
    noQueueGrowth: report.noQueueGrowth,
    noHashDivergence: report.noHashDivergence,
    m6StopSignVerdict: report.m6StopSignVerdict,
    m6Created: report.m6Created,
  };
}

function createSamples(): readonly M5AlphaContentScenarioSummary[] {
  const samples: M5AlphaContentScenarioSummary[] = [];
  for (const tick of SAMPLE_TICKS) {
    samples.push(runM5AlphaContentScenario({ seed: REQUESTED_SEED, ticks: tick }));
  }
  return samples;
}

function readReplay(result: ReturnType<typeof runM5AlphaContentReplay>): M5ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readLastSample(
  samples: readonly M5AlphaContentScenarioSummary[],
): M5AlphaContentScenarioSummary {
  const summary = samples[samples.length - 1];
  if (summary === undefined) {
    throw new Error("M5 benchmark expected at least one sample");
  }
  return summary;
}

function readWorkerProjection(projection: M5WorkerProjection | undefined): M5WorkerProjection {
  if (projection === undefined) {
    throw new Error("M5 benchmark expected Worker projection at the reviewed final checkpoint");
  }
  return projection;
}

function readCheckpoint(replay: M5ReplayRun, tick: number): M5ReplayCheckpoint {
  for (const checkpoint of replay.checkpoints) {
    if (checkpoint.tick === tick) {
      return checkpoint;
    }
  }
  throw new Error(`missing M5 replay checkpoint ${String(tick)}`);
}

function countAnomalyCandidateVisits(summary: M5AlphaContentScenarioSummary): number {
  return (
    summary.roster.borrowedShadowVisitedCount +
    summary.thirdKnock.queryVisitedCount +
    summary.oldBridge.queryVisitedCount
  );
}

function countAnomalyTransitions(summary: M5AlphaContentScenarioSummary): number {
  return summary.thirdKnock.metrics.traceStoredCount + summary.oldBridge.metrics.traceStoredCount;
}

function byteLengthOfJson(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function hasNoContentValidationDrift(samples: readonly M5AlphaContentScenarioSummary[]): boolean {
  const first = samples[0] ?? failMissingSample();
  for (const sample of samples) {
    if (
      sample.contentHash !== first.contentHash ||
      sample.contentCatalog.definitionCount !== first.contentCatalog.definitionCount ||
      sample.contentCatalog.catalogEntryCount !== first.contentCatalog.catalogEntryCount ||
      sample.contentCatalog.blockedReasonCount !== first.contentCatalog.blockedReasonCount
    ) {
      return false;
    }
  }
  return true;
}

function hasNoAnomalyLeaks(samples: readonly M5AlphaContentScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (
      sample.thirdKnock.metrics.activeCrisisCount !== 0 ||
      sample.thirdKnock.metrics.resolvedCrisisCount !== 1 ||
      sample.thirdKnock.metrics.failedCrisisCount !== 0 ||
      sample.oldBridge.metrics.activeCrisisCount !== 0 ||
      sample.oldBridge.metrics.resolvedCrisisCount !== 1 ||
      sample.oldBridge.metrics.failedCrisisCount !== 0 ||
      sample.oldBridge.metrics.terminalCleanupPendingCount !== 0
    ) {
      return false;
    }
  }
  return true;
}

function hasNoFactionGovernanceHiddenAuthority(
  samples: readonly M5AlphaContentScenarioSummary[],
): boolean {
  for (const sample of samples) {
    if (
      sample.factionGovernance.factionMetrics.activeFactCount !== 4 ||
      sample.factionGovernance.factionMetrics.totalQueryVisits !== 4 ||
      sample.factionGovernance.factionMetrics.staleBasisRejectCount !== 0 ||
      sample.factionGovernance.governanceMetrics.activeHookCount !== 4 ||
      sample.factionGovernance.governanceMetrics.totalQueryVisits !== 8 ||
      sample.factionGovernance.governanceMetrics.riskBlockedCount !== 1 ||
      sample.factionGovernance.governanceMetrics.staleBasisRejectCount !== 0 ||
      !sample.factionGovernance.governanceAllowed.ok ||
      !sample.factionGovernance.governanceAllowed.allowed ||
      !sample.factionGovernance.governanceBlocked.ok ||
      sample.factionGovernance.governanceBlocked.allowed
    ) {
      return false;
    }
  }
  return true;
}

function hasNoEventQueueGrowth(samples: readonly M5AlphaContentScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (
      sample.season.metrics.activeIncidentCandidateCount !== 5 ||
      sample.season.metrics.activeRecoveryCandidateCount !== 2 ||
      sample.season.metrics.selectionCount !== 5 ||
      sample.season.metrics.totalCandidateVisits !== 8 ||
      sample.season.metrics.cooldownWriteCount !== 1 ||
      sample.season.metrics.preconditionFailureStoredCount >
        sample.season.metrics.preconditionFailureCount
    ) {
      return false;
    }
  }
  return true;
}

function hasNoM0ToM4Regression(summary: M5AlphaContentScenarioSummary): boolean {
  const evidence: Record<string, string | boolean> = {
    unchanged: summary.m4Regression.unchanged,
    contentHash: summary.m4Regression.contentHash,
    commandStreamHash: summary.m4Regression.commandStreamHash,
    finalWorldHash: summary.m4Regression.finalWorldHash,
    readModelHash: summary.m4Regression.readModelHash,
  };
  return (
    evidence["unchanged"] === true &&
    evidence["contentHash"] === "0x698f2c41" &&
    evidence["commandStreamHash"] === "0x538d0e43" &&
    evidence["finalWorldHash"] === "0xc201a925" &&
    evidence["readModelHash"] === "0xce261d9d"
  );
}

function failMissingSample(): never {
  throw new Error("M5 benchmark expected at least one sample");
}
