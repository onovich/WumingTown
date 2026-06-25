import { performance } from "node:perf_hooks";

import {
  M3_FINAL_TICK,
  M3_LOAD_TICK,
  M3_ORDINARY_LIFE_CHECKPOINTS,
  M3_ORDINARY_LIFE_LONG_HORIZON_TICKS,
  M3_ORDINARY_LIFE_PRIMARY_SEED,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M3_SAVE_TICK,
  compareM3ReplayRuns,
  createM3OrdinaryLifeSaveEnvelope,
  createM3ReadOnlyProjection,
  loadM3OrdinaryLifeSaveEnvelope,
  resumeM3OrdinaryLifeFromSave,
  runM3OrdinaryLifeReplay,
  runM3OrdinaryLifeScenario,
  type M3OrdinaryLifeCheckpointHash,
  type M3OrdinaryLifeEndState,
  type M3OrdinaryLifeReason,
  type M3OrdinaryLifeSaveEnvelope,
  type M3OrdinaryLifeScenarioSummary,
  type M3ReplayRun,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

const REQUESTED_SEED = "3";
const PATH_NODES_PER_EXACT_REQUEST = 2;
const SAMPLE_TICKS = [12_000, 36_000, 60_000, 80_000, M3_ORDINARY_LIFE_LONG_HORIZON_TICKS] as const;

export interface M3OrdinaryLifeLongRunBenchmarkReport {
  readonly name: "m3-ordinary-life-long-run";
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly requestedSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly loadTick: number;
  readonly tickRate: number;
  readonly checkpointCount: number;
  readonly checkpointHashes: readonly M3OrdinaryLifeCheckpointHash[];
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly finalSummary: M3OrdinaryLifeEndState;
  readonly needUpdateCount: number;
  readonly conditionUpdateCount: number;
  readonly abilityCacheInvalidationCount: number;
  readonly thoughtEventCount: number;
  readonly socialEventCount: number;
  readonly actorThinkPasses: number;
  readonly totalCandidateVisitedCount: number;
  readonly workCandidateVisitedCount: number;
  readonly needCandidateVisitedCount: number;
  readonly medicalCandidateVisitedCount: number;
  readonly foodCandidateVisitedCount: number;
  readonly socialCandidateVisitedCount: number;
  readonly boundedCandidateCapHits: number;
  readonly exactPathRequests: number;
  readonly pathNodeCount: number;
  readonly reservationCleanupActiveCount: number;
  readonly saveLoadRebuildTimeMs: number;
  readonly saveLoadRebuiltSurfaceCount: number;
  readonly workerRenderSnapshotBytes: number;
  readonly workerScenarioReadModelBytes: number;
  readonly workerProjectionBytes: number;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly maxQueueBacklog: number;
  readonly maxActiveReservationCount: number;
  readonly maxRunningJobCount: number;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly noReservationLeaks: boolean;
  readonly noStaleOffers: boolean;
  readonly noRunningJobLeaks: boolean;
  readonly noNegativeNeedsResources: boolean;
  readonly noAbilityCacheDivergence: boolean;
  readonly noConditionDrift: boolean;
  readonly noMoodRelationshipDrift: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly noM4Facts: boolean;
  readonly itemConserved: boolean;
  readonly medicalStockConserved: boolean;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M3OrdinaryLifeLongRunBenchmarkInvariants extends Record<
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
  readonly needUpdateCount: number;
  readonly conditionUpdateCount: number;
  readonly abilityCacheInvalidationCount: number;
  readonly thoughtEventCount: number;
  readonly socialEventCount: number;
  readonly actorThinkPasses: number;
  readonly totalCandidateVisitedCount: number;
  readonly boundedCandidateCapHits: number;
  readonly exactPathRequests: number;
  readonly pathNodeCount: number;
  readonly reservationCleanupActiveCount: number;
  readonly saveLoadRebuiltSurfaceCount: number;
  readonly workerRenderSnapshotBytes: number;
  readonly workerScenarioReadModelBytes: number;
  readonly workerProjectionBytes: number;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly maxQueueBacklog: number;
  readonly maxActiveReservationCount: number;
  readonly maxRunningJobCount: number;
  readonly finalWeather: string;
  readonly finalScheduleWindow: string;
  readonly yaoMovementAfterInjury: number;
  readonly yaoMovementAfterTreatment: number;
  readonly yaoSprainSeverity: number;
  readonly yaoMoodValence: number;
  readonly yaoMoodTension: number;
  readonly linMoodValence: number;
  readonly minMoodValence: number;
  readonly yaoMinGratitude: number;
  readonly yaoLinCare: number;
  readonly treatmentCompletedCount: number;
  readonly activeMedicalRequests: number;
  readonly staleMedicalOfferRejectCount: number;
  readonly grainBowlQuantity: number;
  readonly bandageQuantity: number;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly noReservationLeaks: boolean;
  readonly noStaleOffers: boolean;
  readonly noRunningJobLeaks: boolean;
  readonly noNegativeNeedsResources: boolean;
  readonly noAbilityCacheDivergence: boolean;
  readonly noConditionDrift: boolean;
  readonly noMoodRelationshipDrift: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly noM4Facts: boolean;
  readonly itemConserved: boolean;
  readonly medicalStockConserved: boolean;
}

export interface SampledM3OrdinaryLifeLongRunBenchmark {
  readonly name: "m3-ordinary-life-long-run";
  readonly report: M3OrdinaryLifeLongRunBenchmarkReport;
  readonly invariants: M3OrdinaryLifeLongRunBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM3OrdinaryLifeLongRunBenchmark(): M3OrdinaryLifeLongRunBenchmarkReport {
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  const samples = SAMPLE_TICKS.map((tick) =>
    runM3OrdinaryLifeScenario({ seed: REQUESTED_SEED, ticks: tick }),
  );
  const scenario = readLastSample(samples);
  const replay = readReplay(
    runM3OrdinaryLifeReplay({
      seed: REQUESTED_SEED,
      checkpointTicks: [...M3_ORDINARY_LIFE_CHECKPOINTS, M3_ORDINARY_LIFE_LONG_HORIZON_TICKS],
    }),
  );
  const replayAfterSave = readReplay(
    runM3OrdinaryLifeReplay({
      seed: REQUESTED_SEED,
      checkpointTicks: [M3_SAVE_TICK, M3_FINAL_TICK],
    }),
  );
  const save = readSave(createM3OrdinaryLifeSaveEnvelope(REQUESTED_SEED, M3_SAVE_TICK));
  const loadStartedAtMs = performance.now();
  const loaded = loadM3OrdinaryLifeSaveEnvelope(save);
  const saveLoadRebuildTimeMs = performance.now() - loadStartedAtMs;
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const resumed = readReplay(
    resumeM3OrdinaryLifeFromSave({
      save,
      loadTick: M3_LOAD_TICK,
      finalTick: M3_FINAL_TICK,
      checkpointTicks: [M3_SAVE_TICK, M3_FINAL_TICK],
    }),
  );
  const projection = createM3ReadOnlyProjection(scenario, SAMPLE_TICKS.length - 1);
  const checkpointHashes = createReplayCheckpointHashes(replay);
  const comparison = compareM3ReplayRuns(replayAfterSave, resumed, {
    expected: "coordination/artifacts/WM-0059/m3-benchmarks/expected.json",
    actual: "coordination/artifacts/WM-0059/m3-benchmarks/actual.json",
    resumed: "coordination/artifacts/WM-0059/m3-benchmarks/resumed.json",
    save: "coordination/artifacts/WM-0059/m3-benchmarks/save.json",
    summary: "coordination/artifacts/WM-0059/m3-benchmarks/summary.json",
  });
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;
  const totalCandidateVisitedCount =
    scenario.performance.workCandidateVisitedCount +
    scenario.performance.needCandidateVisitedCount +
    scenario.performance.medicalCandidateVisitedCount +
    scenario.performance.foodCandidateVisitedCount +
    scenario.performance.socialCandidateVisitedCount;
  const pathNodeCount = scenario.performance.exactPathRequests * PATH_NODES_PER_EXACT_REQUEST;
  const saveRoundTripMatches =
    resumed.finalWorldHash === replayAfterSave.finalWorldHash &&
    resumed.finalReadModelHash === replayAfterSave.finalReadModelHash;

  return {
    name: "m3-ordinary-life-long-run",
    scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
    scenarioSeed: M3_ORDINARY_LIFE_PRIMARY_SEED,
    requestedSeed: REQUESTED_SEED,
    finalTick: M3_ORDINARY_LIFE_LONG_HORIZON_TICKS,
    saveTick: M3_SAVE_TICK,
    loadTick: M3_LOAD_TICK,
    tickRate: scenario.tickRate,
    checkpointCount: checkpointHashes.length,
    checkpointHashes,
    commandStreamHash: scenario.commandStreamHash,
    contentHash: scenario.contentHash,
    finalWorldHash: scenario.worldHash,
    finalReadModelHash: replay.finalReadModelHash,
    finalSummary: scenario.endState,
    needUpdateCount:
      countReason(scenario, "need.hunger_urgency_indexed") +
      countReason(scenario, "need.rest_urgency_indexed"),
    conditionUpdateCount: countReason(scenario, "condition.injury_applied"),
    abilityCacheInvalidationCount: countReason(scenario, "ability.cache_invalidated"),
    thoughtEventCount: countReason(scenario, "mood.thought_added"),
    socialEventCount: countReason(scenario, "relationship.event_applied"),
    actorThinkPasses: scenario.performance.actorThinkPasses,
    totalCandidateVisitedCount,
    workCandidateVisitedCount: scenario.performance.workCandidateVisitedCount,
    needCandidateVisitedCount: scenario.performance.needCandidateVisitedCount,
    medicalCandidateVisitedCount: scenario.performance.medicalCandidateVisitedCount,
    foodCandidateVisitedCount: scenario.performance.foodCandidateVisitedCount,
    socialCandidateVisitedCount: scenario.performance.socialCandidateVisitedCount,
    boundedCandidateCapHits: scenario.performance.boundedCandidateCapHits,
    exactPathRequests: scenario.performance.exactPathRequests,
    pathNodeCount,
    reservationCleanupActiveCount: scenario.terminalInvariantCounters.activeReservationCount,
    saveLoadRebuildTimeMs,
    saveLoadRebuiltSurfaceCount: loaded.rebuiltIndexes.length,
    workerRenderSnapshotBytes: byteLengthOfJson(projection.renderSnapshot),
    workerScenarioReadModelBytes: byteLengthOfJson(projection.scenarioReadModel),
    workerProjectionBytes: byteLengthOfJson(projection),
    terminalSampleCount: samples.length,
    terminalFirstSampleTick: SAMPLE_TICKS[0],
    terminalLastSampleTick: M3_ORDINARY_LIFE_LONG_HORIZON_TICKS,
    maxQueueBacklog: maxTerminalQueueBacklog(samples),
    maxActiveReservationCount: maxActiveReservations(samples),
    maxRunningJobCount: maxRunningJobs(samples),
    replayMatches:
      replay.finalTick === M3_ORDINARY_LIFE_LONG_HORIZON_TICKS &&
      replay.finalWorldHash === scenario.worldHash &&
      scenario.replayEvidence.hashMatch,
    saveRoundTripMatches,
    noReservationLeaks: scenario.terminalInvariantCounters.activeReservationCount === 0,
    noStaleOffers: noStaleMedicalOffers(samples),
    noRunningJobLeaks: scenario.terminalInvariantCounters.runningJobCount === 0,
    noNegativeNeedsResources: noNegativeNeedsResources(scenario),
    noAbilityCacheDivergence: scenario.terminalInvariantCounters.staleAbilityCacheRejectCount === 0,
    noConditionDrift: noConditionDrift(samples),
    noMoodRelationshipDrift: noMoodRelationshipDrift(samples),
    noQueueGrowth: maxTerminalQueueBacklog(samples) <= 6,
    noHashDivergence: comparison.ok && noHashDivergence(samples),
    noM4Facts: scenario.terminalInvariantCounters.activeM4FactCount === 0,
    itemConserved: scenario.terminalInvariantCounters.itemConservationDelta === 0,
    medicalStockConserved: scenario.terminalInvariantCounters.medicalStockConservationDelta === 0,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m3OrdinaryLifeLongRunInvariantsFromReport(
  report: M3OrdinaryLifeLongRunBenchmarkReport,
): M3OrdinaryLifeLongRunBenchmarkInvariants {
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
    needUpdateCount: report.needUpdateCount,
    conditionUpdateCount: report.conditionUpdateCount,
    abilityCacheInvalidationCount: report.abilityCacheInvalidationCount,
    thoughtEventCount: report.thoughtEventCount,
    socialEventCount: report.socialEventCount,
    actorThinkPasses: report.actorThinkPasses,
    totalCandidateVisitedCount: report.totalCandidateVisitedCount,
    boundedCandidateCapHits: report.boundedCandidateCapHits,
    exactPathRequests: report.exactPathRequests,
    pathNodeCount: report.pathNodeCount,
    reservationCleanupActiveCount: report.reservationCleanupActiveCount,
    saveLoadRebuiltSurfaceCount: report.saveLoadRebuiltSurfaceCount,
    workerRenderSnapshotBytes: report.workerRenderSnapshotBytes,
    workerScenarioReadModelBytes: report.workerScenarioReadModelBytes,
    workerProjectionBytes: report.workerProjectionBytes,
    terminalSampleCount: report.terminalSampleCount,
    terminalFirstSampleTick: report.terminalFirstSampleTick,
    terminalLastSampleTick: report.terminalLastSampleTick,
    maxQueueBacklog: report.maxQueueBacklog,
    maxActiveReservationCount: report.maxActiveReservationCount,
    maxRunningJobCount: report.maxRunningJobCount,
    finalWeather: report.finalSummary.finalWeather,
    finalScheduleWindow: report.finalSummary.finalScheduleWindow,
    yaoMovementAfterInjury: report.finalSummary.yaoMovementAfterInjury,
    yaoMovementAfterTreatment: report.finalSummary.yaoMovementAfterTreatment,
    yaoSprainSeverity: report.finalSummary.yaoSprainSeverity,
    yaoMoodValence: report.finalSummary.yaoMoodValence,
    yaoMoodTension: report.finalSummary.yaoMoodTension,
    linMoodValence: report.finalSummary.linMoodValence,
    minMoodValence: report.finalSummary.minMoodValence,
    yaoMinGratitude: report.finalSummary.yaoMinGratitude,
    yaoLinCare: report.finalSummary.yaoLinCare,
    treatmentCompletedCount: report.finalSummary.treatmentCompletedCount,
    activeMedicalRequests: report.finalSummary.activeMedicalRequests,
    staleMedicalOfferRejectCount: report.finalSummary.staleMedicalOfferRejectCount,
    grainBowlQuantity: report.finalSummary.grainBowlQuantity,
    bandageQuantity: report.finalSummary.bandageQuantity,
    replayMatches: report.replayMatches,
    saveRoundTripMatches: report.saveRoundTripMatches,
    noReservationLeaks: report.noReservationLeaks,
    noStaleOffers: report.noStaleOffers,
    noRunningJobLeaks: report.noRunningJobLeaks,
    noNegativeNeedsResources: report.noNegativeNeedsResources,
    noAbilityCacheDivergence: report.noAbilityCacheDivergence,
    noConditionDrift: report.noConditionDrift,
    noMoodRelationshipDrift: report.noMoodRelationshipDrift,
    noQueueGrowth: report.noQueueGrowth,
    noHashDivergence: report.noHashDivergence,
    noM4Facts: report.noM4Facts,
    itemConserved: report.itemConserved,
    medicalStockConserved: report.medicalStockConserved,
  };
}

function readReplay(result: ReturnType<typeof runM3OrdinaryLifeReplay>): M3ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readSave(
  result: ReturnType<typeof createM3OrdinaryLifeSaveEnvelope>,
): M3OrdinaryLifeSaveEnvelope {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function readLastSample(
  samples: readonly M3OrdinaryLifeScenarioSummary[],
): M3OrdinaryLifeScenarioSummary {
  const summary = samples[samples.length - 1];
  if (summary === undefined) {
    throw new Error("M3 benchmark expected at least one sample");
  }
  return summary;
}

function createReplayCheckpointHashes(
  replay: M3ReplayRun,
): readonly M3OrdinaryLifeCheckpointHash[] {
  return replay.checkpoints.map((checkpoint) => ({
    tick: checkpoint.tick,
    hash: checkpoint.checkpointHash,
  }));
}

function countReason(summary: M3OrdinaryLifeScenarioSummary, reason: M3OrdinaryLifeReason): number {
  let count = 0;
  for (const trace of summary.reasonTraces) {
    if (trace.reason === reason) {
      count += 1;
    }
  }
  return count;
}

function byteLengthOfJson(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function maxTerminalQueueBacklog(samples: readonly M3OrdinaryLifeScenarioSummary[]): number {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(
      peak,
      sample.queueMetrics.needDirtyBacklog,
      sample.queueMetrics.environmentDirtyBacklog,
      sample.queueMetrics.foodDirtyBacklog,
      sample.queueMetrics.healthDirtyBacklog,
      sample.queueMetrics.abilityDirtyBacklog,
      sample.queueMetrics.moodDirtyBacklog,
    );
  }
  return peak;
}

function maxActiveReservations(samples: readonly M3OrdinaryLifeScenarioSummary[]): number {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, sample.terminalInvariantCounters.activeReservationCount);
  }
  return peak;
}

function maxRunningJobs(samples: readonly M3OrdinaryLifeScenarioSummary[]): number {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, sample.terminalInvariantCounters.runningJobCount);
  }
  return peak;
}

function noNegativeNeedsResources(summary: M3OrdinaryLifeScenarioSummary): boolean {
  return (
    summary.terminalInvariantCounters.negativeNeedLaneCount === 0 &&
    summary.endState.grainBowlQuantity >= 0 &&
    summary.endState.bandageQuantity >= 0
  );
}

function noStaleMedicalOffers(samples: readonly M3OrdinaryLifeScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (
      sample.endState.activeMedicalRequests !== 0 ||
      sample.endState.staleMedicalOfferRejectCount !== 0
    ) {
      return false;
    }
  }
  return true;
}

function noConditionDrift(samples: readonly M3OrdinaryLifeScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (
      sample.endState.yaoMovementAfterInjury !== 480 ||
      sample.endState.yaoMovementAfterTreatment !== 640 ||
      sample.endState.yaoSprainSeverity !== 260
    ) {
      return false;
    }
  }
  return true;
}

function noMoodRelationshipDrift(samples: readonly M3OrdinaryLifeScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (
      sample.terminalInvariantCounters.outOfRangeMoodLaneCount !== 0 ||
      sample.terminalInvariantCounters.outOfRangeRelationshipLaneCount !== 0 ||
      sample.endState.yaoMoodValence !== 500 ||
      sample.endState.yaoMoodTension !== 500 ||
      sample.endState.linMoodValence !== 500 ||
      sample.endState.minMoodValence !== 500 ||
      sample.endState.yaoMinGratitude !== 120 ||
      sample.endState.yaoLinCare !== 45
    ) {
      return false;
    }
  }
  return true;
}

function noHashDivergence(samples: readonly M3OrdinaryLifeScenarioSummary[]): boolean {
  for (const sample of samples) {
    if (!sample.replayEvidence.hashMatch) {
      return false;
    }
  }
  return true;
}
