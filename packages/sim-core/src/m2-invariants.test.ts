import { describe, expect, it } from "vitest";

import {
  M2_WORK_LOGISTICS_SCENARIO_ID,
  compareM2ReplayRuns,
  createM2WorkLogisticsSaveEnvelope,
  resumeM2WorkLogisticsFromSave,
  runM2WorkLogisticsReplay,
  runM2WorkLogisticsScenario,
  type M2ReplayRun,
  type M2WorkLogisticsSaveEnvelope,
  type M2WorkLogisticsScenarioSummary,
} from "./index";

const SCENARIO_SEED = "2";
const SAVE_TICK = 6_000;
const FINAL_TICK = 100_000;
const SAMPLE_TICKS = [20_000, 40_000, 60_000, 80_000, FINAL_TICK] as const;

describe("M2 work/logistics long-run invariants", () => {
  it("keeps 20 actors hauling and building leak-free across replay save round trip", () => {
    const samples = createTerminalSamples();
    const summary = readLastSample(samples);
    const replay = readReplay(
      runM2WorkLogisticsReplay({
        seed: SCENARIO_SEED,
        checkpointTicks: [0, SAVE_TICK, 20_000, FINAL_TICK],
      }),
    );
    const replayAfterSave = readReplay(
      runM2WorkLogisticsReplay({
        seed: SCENARIO_SEED,
        checkpointTicks: [SAVE_TICK, FINAL_TICK],
      }),
    );
    const save = readSave(createM2WorkLogisticsSaveEnvelope(SCENARIO_SEED, SAVE_TICK));
    const resumed = readReplay(
      resumeM2WorkLogisticsFromSave({
        save,
        finalTick: FINAL_TICK,
        checkpointTicks: [SAVE_TICK, FINAL_TICK],
      }),
    );
    const compared = compareM2ReplayRuns(replayAfterSave, resumed, {
      expected: "coordination/artifacts/WM-0042/m2-invariants/expected.json",
      actual: "coordination/artifacts/WM-0042/m2-invariants/actual.json",
      resumed: "coordination/artifacts/WM-0042/m2-invariants/resumed.json",
      save: "coordination/artifacts/WM-0042/m2-invariants/save.json",
      summary: "coordination/artifacts/WM-0042/m2-invariants/summary.json",
    });

    expect(summary.scenarioId).toBe(M2_WORK_LOGISTICS_SCENARIO_ID);
    expect(summary.seed).toBe(SCENARIO_SEED);
    expect(summary.finalTick).toBe(FINAL_TICK);
    expect(summary.actorCount).toBe(20);
    expect(summary.endState).toMatchObject({
      completedBuildOrders: 4,
      sourceWoodQuantity: 0,
      sourceStoneQuantity: 0,
      decoyPaperQuantity: 1,
      deliveredWood: 24,
      deliveredStone: 12,
      buildProgressTotal: 240,
      activeReservations: 0,
      activeOffers: 0,
      runningJobs: 0,
      lanternStateTotal: 4,
    });
    expect(summary.counters).toMatchObject({
      materialDeliveryJobsCreated: 16,
      materialDeliveryJobsCompleted: 16,
      buildJobsCreated: 4,
      buildJobsCompleted: 4,
      demandOfferPeak: 8,
      buildOfferPeak: 4,
      actorsUsed: 20,
    });
    expect(summary.invariants).toMatchObject({
      allOrdersCompleted: true,
      materialConserved: true,
      reservationsReleased: true,
      offersCleared: true,
      noRunningJobs: true,
      tick20000EndState: true,
    });
    expect(maxActiveReservations(samples)).toBe(0);
    expect(maxActiveOffers(samples)).toBe(0);
    expect(maxRunningJobs(samples)).toBe(0);
    expect(terminalStateStable(samples)).toBe(true);
    expect(replay.finalTick).toBe(FINAL_TICK);
    expect(replay.finalWorldHash).toBe(summary.worldHash);
    expect(resumed.finalWorldHash).toBe(replayAfterSave.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(replayAfterSave.finalReadModelHash);
    expect(compared).toMatchObject({ ok: true });
  });
});

function readReplay(result: ReturnType<typeof runM2WorkLogisticsReplay>): M2ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readSave(
  result: ReturnType<typeof createM2WorkLogisticsSaveEnvelope>,
): M2WorkLogisticsSaveEnvelope {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function readLastSample(
  samples: readonly M2WorkLogisticsScenarioSummary[],
): M2WorkLogisticsScenarioSummary {
  const summary = samples[samples.length - 1];
  if (summary === undefined) {
    throw new Error("M2 invariant gate expected at least one sample");
  }
  return summary;
}

function createTerminalSamples(): readonly M2WorkLogisticsScenarioSummary[] {
  const samples: M2WorkLogisticsScenarioSummary[] = [];

  for (const tick of SAMPLE_TICKS) {
    samples.push(runM2WorkLogisticsScenario({ seed: SCENARIO_SEED, ticks: tick }));
  }

  return samples;
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
  let maxCount = 0;

  for (const sample of samples) {
    maxCount = Math.max(maxCount, sample.endState.activeReservations);
  }

  return maxCount;
}

function maxActiveOffers(samples: readonly M2WorkLogisticsScenarioSummary[]): number {
  let maxCount = 0;

  for (const sample of samples) {
    maxCount = Math.max(maxCount, sample.endState.activeOffers);
  }

  return maxCount;
}

function maxRunningJobs(samples: readonly M2WorkLogisticsScenarioSummary[]): number {
  let maxCount = 0;

  for (const sample of samples) {
    maxCount = Math.max(maxCount, sample.endState.runningJobs);
  }

  return maxCount;
}
