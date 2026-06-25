import { describe, expect, it } from "vitest";

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
  resumeM3OrdinaryLifeFromSave,
  runM3OrdinaryLifeReplay,
  runM3OrdinaryLifeScenario,
  type M3OrdinaryLifeSaveEnvelope,
  type M3OrdinaryLifeScenarioSummary,
  type M3ReplayRun,
} from "./index";

const REQUESTED_SEED = "3";
const SAMPLE_TICKS = [12_000, 36_000, 60_000, 80_000, M3_ORDINARY_LIFE_LONG_HORIZON_TICKS] as const;

describe("M3 ordinary-life long-run invariants", () => {
  it("keeps M3 ordinary life stable leak-free and replay-equivalent through long horizon", () => {
    const samples = createSamples();
    const longRun = readLastSample(samples);
    const fullDay = samples[1] ?? failMissingSample();
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
    const resumed = readReplay(
      resumeM3OrdinaryLifeFromSave({
        save,
        loadTick: M3_LOAD_TICK,
        finalTick: M3_FINAL_TICK,
        checkpointTicks: [M3_SAVE_TICK, M3_FINAL_TICK],
      }),
    );
    const compared = compareM3ReplayRuns(replayAfterSave, resumed, {
      expected: "coordination/artifacts/WM-0059/m3-invariants/expected.json",
      actual: "coordination/artifacts/WM-0059/m3-invariants/actual.json",
      resumed: "coordination/artifacts/WM-0059/m3-invariants/resumed.json",
      save: "coordination/artifacts/WM-0059/m3-invariants/save.json",
      summary: "coordination/artifacts/WM-0059/m3-invariants/summary.json",
    });
    const longRunProjection = createM3ReadOnlyProjection(longRun, SAMPLE_TICKS.length - 1);

    expect(longRun.scenarioId).toBe(M3_ORDINARY_LIFE_SCENARIO_ID);
    expect(longRun.seed).toBe(M3_ORDINARY_LIFE_PRIMARY_SEED);
    expect(longRun.requestedSeed).toBe(REQUESTED_SEED);
    expect(longRun.finalTick).toBe(M3_ORDINARY_LIFE_LONG_HORIZON_TICKS);
    expect(longRun.replayEvidence.hashMatch).toBe(true);
    expect(replay.finalTick).toBe(M3_ORDINARY_LIFE_LONG_HORIZON_TICKS);
    expect(replay.finalWorldHash).toBe(longRun.worldHash);
    expect(compared).toMatchObject({ ok: true });
    expect(resumed.finalWorldHash).toBe(replayAfterSave.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(replayAfterSave.finalReadModelHash);

    expect(longRun.terminalInvariantCounters).toMatchObject({
      activeReservationCount: 0,
      runningJobCount: 0,
      negativeNeedLaneCount: 0,
      outOfRangeMoodLaneCount: 0,
      outOfRangeRelationshipLaneCount: 0,
      activeM4FactCount: 0,
      reasonTraceOverflowCount: 0,
      staleAbilityCacheRejectCount: 0,
      itemConservationDelta: 0,
      medicalStockConservationDelta: 0,
    });
    expect(longRun.terminalInvariantCounters.needLaneCheckCount).toBe(30);
    expect(longRun.terminalInvariantCounters.moodLaneCheckCount).toBe(36);
    expect(longRun.terminalInvariantCounters.relationshipLaneCheckCount).toBe(15);
    expect(longRun.terminalInvariantCounters.m4AbsenceCheckCount).toBe(5);

    expect(maxQueueBacklog(samples)).toBeLessThanOrEqual(6);
    expect(maxActiveReservations(samples)).toBe(0);
    expect(maxRunningJobs(samples)).toBe(0);
    expect(noStaleMedicalOffers(samples)).toBe(true);
    expect(noConditionDrift(samples)).toBe(true);
    expect(noMoodRelationshipDrift(samples)).toBe(true);
    expect(noHashDivergence(samples)).toBe(true);
    expect(longRunProjection.readModelHash).toMatch(/^0x[0-9a-f]{8}$/u);

    expect(fullDay.endState).toMatchObject({
      treatmentCompletedCount: 1,
      activeMedicalRequests: 0,
      staleMedicalOfferRejectCount: 0,
      grainBowlQuantity: 7,
      bandageQuantity: 2,
      finalWeather: "rain_light",
      finalScheduleWindow: "dawn",
    });
    expect(longRun.endState).toMatchObject({
      yaoMovementAfterInjury: 480,
      yaoMovementAfterTreatment: 640,
      yaoSprainSeverity: 260,
      yaoMoodValence: 500,
      yaoMoodTension: 500,
      linMoodValence: 500,
      minMoodValence: 500,
      yaoMinGratitude: 120,
      yaoLinCare: 45,
      activeMedicalRequests: 0,
      staleMedicalOfferRejectCount: 0,
    });
  });
});

function createSamples(): readonly M3OrdinaryLifeScenarioSummary[] {
  const samples: M3OrdinaryLifeScenarioSummary[] = [];
  for (const tick of SAMPLE_TICKS) {
    samples.push(runM3OrdinaryLifeScenario({ seed: REQUESTED_SEED, ticks: tick }));
  }
  return samples;
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
  const sample = samples[samples.length - 1];
  if (sample === undefined) {
    throw new Error("M3 invariant gate expected at least one sample");
  }
  return sample;
}

function maxQueueBacklog(samples: readonly M3OrdinaryLifeScenarioSummary[]): number {
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

function failMissingSample(): never {
  throw new Error("missing M3 sample");
}
