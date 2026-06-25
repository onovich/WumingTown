import { performance } from "node:perf_hooks";

import {
  M2_WORK_LOGISTICS_SCENARIO_ID,
  compareM2ReplayRuns,
  createM2WorkLogisticsSaveEnvelope,
  resumeM2WorkLogisticsFromSave,
  runM2WorkLogisticsReplay,
  runM2WorkLogisticsScenario,
  type M2WorkLogisticsScenarioSummary,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

const SCENARIO_SEED = "2";
const FINAL_TICK = 100_000;
const SAVE_TICK = 6_000;
const SAMPLE_TICKS = [20_000, 40_000, 60_000, 80_000, FINAL_TICK] as const;

export interface M2WorkLogisticsLongRunBenchmarkReport {
  readonly name: "m2-work-logistics-long-run";
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly actorCount: number;
  readonly completedBuildOrders: number;
  readonly deliveredWood: number;
  readonly deliveredStone: number;
  readonly buildProgressTotal: number;
  readonly materialDeliveryJobsCreated: number;
  readonly materialDeliveryJobsCompleted: number;
  readonly buildJobsCreated: number;
  readonly buildJobsCompleted: number;
  readonly demandOfferPeak: number;
  readonly buildOfferPeak: number;
  readonly actorsUsed: number;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly terminalStateStable: boolean;
  readonly terminalMaxActiveReservationCount: number;
  readonly terminalMaxActiveOfferCount: number;
  readonly terminalMaxRunningJobCount: number;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly noReservationLeaks: boolean;
  readonly noStaleOffers: boolean;
  readonly noNegativeResources: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly materialConserved: boolean;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M2WorkLogisticsLongRunBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly actorCount: number;
  readonly completedBuildOrders: number;
  readonly deliveredWood: number;
  readonly deliveredStone: number;
  readonly buildProgressTotal: number;
  readonly materialDeliveryJobsCreated: number;
  readonly materialDeliveryJobsCompleted: number;
  readonly buildJobsCreated: number;
  readonly buildJobsCompleted: number;
  readonly demandOfferPeak: number;
  readonly buildOfferPeak: number;
  readonly actorsUsed: number;
  readonly terminalSampleCount: number;
  readonly terminalFirstSampleTick: number;
  readonly terminalLastSampleTick: number;
  readonly terminalStateStable: boolean;
  readonly terminalMaxActiveReservationCount: number;
  readonly terminalMaxActiveOfferCount: number;
  readonly terminalMaxRunningJobCount: number;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly noReservationLeaks: boolean;
  readonly noStaleOffers: boolean;
  readonly noNegativeResources: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly materialConserved: boolean;
}

export interface SampledM2WorkLogisticsLongRunBenchmark {
  readonly name: "m2-work-logistics-long-run";
  readonly report: M2WorkLogisticsLongRunBenchmarkReport;
  readonly invariants: M2WorkLogisticsLongRunBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM2WorkLogisticsLongRunBenchmark(): M2WorkLogisticsLongRunBenchmarkReport {
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  const samples = SAMPLE_TICKS.map((tick) =>
    runM2WorkLogisticsScenario({ seed: SCENARIO_SEED, ticks: tick }),
  );
  const scenario = readLastSample(samples);
  const replay = runM2WorkLogisticsReplay({
    seed: SCENARIO_SEED,
    checkpointTicks: [0, SAVE_TICK, 20_000, FINAL_TICK],
  });
  const replayAfterSave = runM2WorkLogisticsReplay({
    seed: SCENARIO_SEED,
    checkpointTicks: [SAVE_TICK, FINAL_TICK],
  });
  const save = createM2WorkLogisticsSaveEnvelope(SCENARIO_SEED, SAVE_TICK);
  const resumed = save.ok
    ? resumeM2WorkLogisticsFromSave({
        save: save.save,
        finalTick: FINAL_TICK,
        checkpointTicks: [SAVE_TICK, FINAL_TICK],
      })
    : save;
  const comparison =
    replayAfterSave.ok && resumed.ok
      ? compareM2ReplayRuns(replayAfterSave.replay, resumed.replay, {
          expected: "benchmark-expected",
          actual: "benchmark-actual",
          resumed: "benchmark-resumed",
          save: "benchmark-save",
          summary: "benchmark-summary",
        })
      : { ok: false };
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;
  const saveRoundTripMatches =
    replayAfterSave.ok &&
    resumed.ok &&
    resumed.replay.finalWorldHash === replayAfterSave.replay.finalWorldHash &&
    resumed.replay.finalReadModelHash === replayAfterSave.replay.finalReadModelHash;
  const noNegativeResources =
    scenario.endState.sourceWoodQuantity >= 0 &&
    scenario.endState.sourceStoneQuantity >= 0 &&
    scenario.endState.decoyPaperQuantity >= 0;

  return {
    name: "m2-work-logistics-long-run",
    scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
    scenarioSeed: SCENARIO_SEED,
    finalTick: FINAL_TICK,
    saveTick: SAVE_TICK,
    actorCount: scenario.actorCount,
    completedBuildOrders: scenario.endState.completedBuildOrders,
    deliveredWood: scenario.endState.deliveredWood,
    deliveredStone: scenario.endState.deliveredStone,
    buildProgressTotal: scenario.endState.buildProgressTotal,
    materialDeliveryJobsCreated: scenario.counters.materialDeliveryJobsCreated,
    materialDeliveryJobsCompleted: scenario.counters.materialDeliveryJobsCompleted,
    buildJobsCreated: scenario.counters.buildJobsCreated,
    buildJobsCompleted: scenario.counters.buildJobsCompleted,
    demandOfferPeak: scenario.counters.demandOfferPeak,
    buildOfferPeak: scenario.counters.buildOfferPeak,
    actorsUsed: scenario.counters.actorsUsed,
    terminalSampleCount: samples.length,
    terminalFirstSampleTick: SAMPLE_TICKS[0],
    terminalLastSampleTick: FINAL_TICK,
    terminalStateStable: terminalStateStable(samples),
    terminalMaxActiveReservationCount: maxActiveReservations(samples),
    terminalMaxActiveOfferCount: maxActiveOffers(samples),
    terminalMaxRunningJobCount: maxRunningJobs(samples),
    finalWorldHash: scenario.worldHash,
    finalReadModelHash: replay.ok ? replay.replay.finalReadModelHash : "invalid",
    replayMatches:
      replay.ok &&
      replay.replay.finalWorldHash === scenario.worldHash &&
      replay.replay.finalTick === FINAL_TICK,
    saveRoundTripMatches,
    noReservationLeaks: scenario.endState.activeReservations === 0,
    noStaleOffers: scenario.endState.activeOffers === 0 && scenario.invariants.offersCleared,
    noNegativeResources,
    noQueueGrowth:
      maxActiveReservations(samples) === 0 &&
      maxActiveOffers(samples) === 0 &&
      maxRunningJobs(samples) === 0 &&
      terminalStateStable(samples),
    noHashDivergence: comparison.ok,
    materialConserved: scenario.invariants.materialConserved,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m2WorkLogisticsLongRunInvariantsFromReport(
  report: M2WorkLogisticsLongRunBenchmarkReport,
): M2WorkLogisticsLongRunBenchmarkInvariants {
  return {
    scenarioId: report.scenarioId,
    scenarioSeed: report.scenarioSeed,
    finalTick: report.finalTick,
    saveTick: report.saveTick,
    actorCount: report.actorCount,
    completedBuildOrders: report.completedBuildOrders,
    deliveredWood: report.deliveredWood,
    deliveredStone: report.deliveredStone,
    buildProgressTotal: report.buildProgressTotal,
    materialDeliveryJobsCreated: report.materialDeliveryJobsCreated,
    materialDeliveryJobsCompleted: report.materialDeliveryJobsCompleted,
    buildJobsCreated: report.buildJobsCreated,
    buildJobsCompleted: report.buildJobsCompleted,
    demandOfferPeak: report.demandOfferPeak,
    buildOfferPeak: report.buildOfferPeak,
    actorsUsed: report.actorsUsed,
    terminalSampleCount: report.terminalSampleCount,
    terminalFirstSampleTick: report.terminalFirstSampleTick,
    terminalLastSampleTick: report.terminalLastSampleTick,
    terminalStateStable: report.terminalStateStable,
    terminalMaxActiveReservationCount: report.terminalMaxActiveReservationCount,
    terminalMaxActiveOfferCount: report.terminalMaxActiveOfferCount,
    terminalMaxRunningJobCount: report.terminalMaxRunningJobCount,
    finalWorldHash: report.finalWorldHash,
    finalReadModelHash: report.finalReadModelHash,
    replayMatches: report.replayMatches,
    saveRoundTripMatches: report.saveRoundTripMatches,
    noReservationLeaks: report.noReservationLeaks,
    noStaleOffers: report.noStaleOffers,
    noNegativeResources: report.noNegativeResources,
    noQueueGrowth: report.noQueueGrowth,
    noHashDivergence: report.noHashDivergence,
    materialConserved: report.materialConserved,
  };
}

function readLastSample(
  samples: readonly M2WorkLogisticsScenarioSummary[],
): M2WorkLogisticsScenarioSummary {
  const summary = samples[samples.length - 1];
  if (summary === undefined) {
    throw new Error("M2 benchmark expected at least one sample");
  }
  return summary;
}

function terminalStateStable(samples: readonly M2WorkLogisticsScenarioSummary[]): boolean {
  const first = samples[0];
  if (first === undefined) {
    return false;
  }

  const expected = createTerminalSignature(first);
  for (const sample of samples) {
    if (createTerminalSignature(sample) !== expected) {
      return false;
    }
  }

  return true;
}

function createTerminalSignature(summary: M2WorkLogisticsScenarioSummary): string {
  return JSON.stringify({
    endState: summary.endState,
    counters: summary.counters,
    invariants: summary.invariants,
  });
}

function maxActiveReservations(samples: readonly M2WorkLogisticsScenarioSummary[]): number {
  return samples.reduce(
    (maxCount, sample) => Math.max(maxCount, sample.endState.activeReservations),
    0,
  );
}

function maxActiveOffers(samples: readonly M2WorkLogisticsScenarioSummary[]): number {
  return samples.reduce((maxCount, sample) => Math.max(maxCount, sample.endState.activeOffers), 0);
}

function maxRunningJobs(samples: readonly M2WorkLogisticsScenarioSummary[]): number {
  return samples.reduce((maxCount, sample) => Math.max(maxCount, sample.endState.runningJobs), 0);
}
