import { performance } from "node:perf_hooks";

import {
  HAULING_BUILDING_SCENARIO_ID,
  compareM1ReplayRuns,
  createM1HaulingBuildingSaveEnvelope,
  resumeM1HaulingBuildingFromSave,
  runHaulingBuildingScenario,
  runM1HaulingBuildingReplay,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

const SCENARIO_SEED = "1";
const FINAL_TICK = 100_000;
const SAVE_TICK = 2_400;

export interface M1HaulingBuildingLongRunBenchmarkReport {
  readonly name: "m1-hauling-building-long-run";
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly completedBuildingCount: number;
  readonly idleSampleCount: number;
  readonly idleFirstSampleTick: number | null;
  readonly idleLastSampleTick: number | null;
  readonly idleStateHashStable: boolean;
  readonly idleMaxDemandOfferCount: number;
  readonly idleMaxBuildOfferCount: number;
  readonly idleMaxActiveOfferCount: number;
  readonly idleMaxActiveReservationCount: number;
  readonly idleMaxRunningJobCount: number;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly noReservationLeaks: boolean;
  readonly noStaleEntityReferences: boolean;
  readonly noNegativeResources: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly materialConserved: boolean;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M1HaulingBuildingLongRunBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly finalTick: number;
  readonly saveTick: number;
  readonly completedBuildingCount: number;
  readonly idleSampleCount: number;
  readonly idleFirstSampleTick: number;
  readonly idleLastSampleTick: number;
  readonly idleStateHashStable: boolean;
  readonly idleMaxDemandOfferCount: number;
  readonly idleMaxBuildOfferCount: number;
  readonly idleMaxActiveOfferCount: number;
  readonly idleMaxActiveReservationCount: number;
  readonly idleMaxRunningJobCount: number;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
  readonly replayMatches: boolean;
  readonly saveRoundTripMatches: boolean;
  readonly noReservationLeaks: boolean;
  readonly noStaleEntityReferences: boolean;
  readonly noNegativeResources: boolean;
  readonly noQueueGrowth: boolean;
  readonly noHashDivergence: boolean;
  readonly materialConserved: boolean;
}

export interface SampledM1HaulingBuildingLongRunBenchmark {
  readonly name: "m1-hauling-building-long-run";
  readonly report: M1HaulingBuildingLongRunBenchmarkReport;
  readonly invariants: M1HaulingBuildingLongRunBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM1HaulingBuildingLongRunBenchmark(): M1HaulingBuildingLongRunBenchmarkReport {
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  const scenario = runHaulingBuildingScenario({ seed: SCENARIO_SEED, ticks: FINAL_TICK });
  const replay = runM1HaulingBuildingReplay({
    seed: SCENARIO_SEED,
    checkpointTicks: [0, SAVE_TICK, FINAL_TICK],
  });
  const replayAfterSave = runM1HaulingBuildingReplay({
    seed: SCENARIO_SEED,
    checkpointTicks: [SAVE_TICK, FINAL_TICK],
  });
  const save = createM1HaulingBuildingSaveEnvelope(SCENARIO_SEED, SAVE_TICK);
  const resumed = save.ok
    ? resumeM1HaulingBuildingFromSave({
        save: save.save,
        finalTick: FINAL_TICK,
        checkpointTicks: [SAVE_TICK, FINAL_TICK],
      })
    : save;
  const comparison =
    replayAfterSave.ok && resumed.ok
      ? compareM1ReplayRuns(replayAfterSave.replay, resumed.replay, {
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
    name: "m1-hauling-building-long-run",
    scenarioId: HAULING_BUILDING_SCENARIO_ID,
    scenarioSeed: SCENARIO_SEED,
    finalTick: FINAL_TICK,
    saveTick: SAVE_TICK,
    completedBuildingCount: scenario.endState.completedBuildingCount,
    idleSampleCount: scenario.idleWindow.sampleCount,
    idleFirstSampleTick: scenario.idleWindow.firstSampleTick,
    idleLastSampleTick: scenario.idleWindow.lastSampleTick,
    idleStateHashStable: scenario.idleWindow.hashStable,
    idleMaxDemandOfferCount: scenario.idleWindow.maxDemandOfferCount,
    idleMaxBuildOfferCount: scenario.idleWindow.maxBuildOfferCount,
    idleMaxActiveOfferCount: scenario.idleWindow.maxActiveOfferCount,
    idleMaxActiveReservationCount: scenario.idleWindow.maxActiveReservationCount,
    idleMaxRunningJobCount: scenario.idleWindow.maxRunningJobCount,
    finalWorldHash: scenario.worldHash,
    finalReadModelHash: replay.ok ? replay.replay.finalReadModelHash : "invalid",
    replayMatches:
      replay.ok &&
      replay.replay.finalWorldHash === scenario.worldHash &&
      replay.replay.finalTick === FINAL_TICK,
    saveRoundTripMatches,
    noReservationLeaks: scenario.endState.activeReservationCount === 0,
    noStaleEntityReferences: scenario.idleWindow.noStaleEntityReferences,
    noNegativeResources,
    noQueueGrowth: scenario.idleWindow.noQueueGrowth,
    noHashDivergence: comparison.ok,
    materialConserved: scenario.invariants.materialConserved,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m1HaulingBuildingLongRunInvariantsFromReport(
  report: M1HaulingBuildingLongRunBenchmarkReport,
): M1HaulingBuildingLongRunBenchmarkInvariants {
  return {
    scenarioId: report.scenarioId,
    scenarioSeed: report.scenarioSeed,
    finalTick: report.finalTick,
    saveTick: report.saveTick,
    completedBuildingCount: report.completedBuildingCount,
    idleSampleCount: report.idleSampleCount,
    idleFirstSampleTick: report.idleFirstSampleTick ?? -1,
    idleLastSampleTick: report.idleLastSampleTick ?? -1,
    idleStateHashStable: report.idleStateHashStable,
    idleMaxDemandOfferCount: report.idleMaxDemandOfferCount,
    idleMaxBuildOfferCount: report.idleMaxBuildOfferCount,
    idleMaxActiveOfferCount: report.idleMaxActiveOfferCount,
    idleMaxActiveReservationCount: report.idleMaxActiveReservationCount,
    idleMaxRunningJobCount: report.idleMaxRunningJobCount,
    finalWorldHash: report.finalWorldHash,
    finalReadModelHash: report.finalReadModelHash,
    replayMatches: report.replayMatches,
    saveRoundTripMatches: report.saveRoundTripMatches,
    noReservationLeaks: report.noReservationLeaks,
    noStaleEntityReferences: report.noStaleEntityReferences,
    noNegativeResources: report.noNegativeResources,
    noQueueGrowth: report.noQueueGrowth,
    noHashDivergence: report.noHashDivergence,
    materialConserved: report.materialConserved,
  };
}
