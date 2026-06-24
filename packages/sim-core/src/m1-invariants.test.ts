import { describe, expect, it } from "vitest";

import {
  HAULING_BUILDING_SCENARIO_ID,
  compareM1ReplayRuns,
  createM1HaulingBuildingSaveEnvelope,
  resumeM1HaulingBuildingFromSave,
  runHaulingBuildingScenario,
  runM1HaulingBuildingReplay,
  type M1HaulingBuildingSaveEnvelope,
  type M1ReplayRun,
} from "./index";

const SCENARIO_SEED = "1";
const FINAL_TICK = 100_000;
const SAVE_TICK = 2_400;

describe("M1 hauling-building long-run invariants", () => {
  it("keeps resources, reservations, queues, save round trip and hashes stable", () => {
    const summary = runHaulingBuildingScenario({
      seed: SCENARIO_SEED,
      ticks: FINAL_TICK,
    });
    const replay = readReplay(
      runM1HaulingBuildingReplay({
        seed: SCENARIO_SEED,
        checkpointTicks: [0, SAVE_TICK, FINAL_TICK],
      }),
    );
    const replayAfterSave = readReplay(
      runM1HaulingBuildingReplay({
        seed: SCENARIO_SEED,
        checkpointTicks: [SAVE_TICK, FINAL_TICK],
      }),
    );
    const save = readSave(createM1HaulingBuildingSaveEnvelope(SCENARIO_SEED, SAVE_TICK));
    const resumed = readReplay(
      resumeM1HaulingBuildingFromSave({
        save,
        finalTick: FINAL_TICK,
        checkpointTicks: [SAVE_TICK, FINAL_TICK],
      }),
    );
    const compared = compareM1ReplayRuns(replayAfterSave, resumed, {
      expected: "coordination/artifacts/WM-0029/m1-invariants/expected.json",
      actual: "coordination/artifacts/WM-0029/m1-invariants/actual.json",
      resumed: "coordination/artifacts/WM-0029/m1-invariants/resumed.json",
      save: "coordination/artifacts/WM-0029/m1-invariants/save.json",
      summary: "coordination/artifacts/WM-0029/m1-invariants/summary.json",
    });

    expect(summary.scenarioId).toBe(HAULING_BUILDING_SCENARIO_ID);
    expect(summary.seed).toBe(SCENARIO_SEED);
    expect(summary.finalTick).toBe(FINAL_TICK);
    expect(summary.longRunStable).toBe(true);
    expect(summary.idleWindow).toMatchObject({
      sampled: true,
      firstSampleTick: 2_401,
      lastSampleTick: FINAL_TICK,
      hashStable: true,
      noQueueGrowth: true,
      noStaleEntityReferences: true,
      maxDemandOfferCount: 0,
      maxBuildOfferCount: 0,
      maxActiveOfferCount: 0,
      maxActiveReservationCount: 0,
      maxRunningJobCount: 0,
    });
    expect(summary.idleWindow.sampleCount).toBeGreaterThan(1);
    expect(summary.invariants).toMatchObject({
      buildCompletedExactlyOnce: true,
      materialConserved: true,
      noCarriedItems: true,
      noRunningJobs: true,
      noStaleOffers: true,
      reservationsReleased: true,
      tick2400EndState: true,
    });
    expect(summary.endState.activeReservationCount).toBe(0);
    expect(summary.endState.runningJobCount).toBe(0);
    expect(summary.endState.staleOfferCount).toBe(0);
    expect(summary.endState.sourceWoodQuantity).toBeGreaterThanOrEqual(0);
    expect(summary.endState.sourceStoneQuantity).toBeGreaterThanOrEqual(0);
    expect(summary.endState.decoyPaperQuantity).toBeGreaterThanOrEqual(0);
    expect(replay.finalWorldHash).toBe(summary.worldHash);
    expect(resumed.finalWorldHash).toBe(replayAfterSave.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(replayAfterSave.finalReadModelHash);
    expect(compared).toMatchObject({ ok: true });
  });
});

function readReplay(result: ReturnType<typeof runM1HaulingBuildingReplay>): M1ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readSave(
  result: ReturnType<typeof createM1HaulingBuildingSaveEnvelope>,
): M1HaulingBuildingSaveEnvelope {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}
