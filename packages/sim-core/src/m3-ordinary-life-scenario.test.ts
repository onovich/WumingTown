import { describe, expect, it } from "vitest";

import {
  M3_MOOD_LANE_COUNT,
  M3_ORDINARY_LIFE_CHECKPOINTS,
  M3_ORDINARY_LIFE_FULL_HORIZON_TICKS,
  M3_ORDINARY_LIFE_LONG_HORIZON_TICKS,
  M3_ORDINARY_LIFE_PRIMARY_SEED,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M3_ORDINARY_LIFE_SHORT_HORIZON_TICKS,
  M3_RELATIONSHIP_LANE_COUNT,
  NEED_LANE_COUNT,
  runM3OrdinaryLifeScenario,
  type M3OrdinaryLifeReason,
} from "./index";

describe("m3-ordinary-life-scenario", () => {
  it("runs a deterministic ordinary-life vertical slice with injury consequences", () => {
    const summary = runM3OrdinaryLifeScenario({ seed: "3", ticks: 20_000 });
    const repeat = runM3OrdinaryLifeScenario({ seed: "3", ticks: 20_000 });

    expect(summary.scenarioId).toBe(M3_ORDINARY_LIFE_SCENARIO_ID);
    expect(summary.seed).toBe(M3_ORDINARY_LIFE_PRIMARY_SEED);
    expect(summary.requestedSeed).toBe("3");
    expect(summary.primarySeed).toBe(M3_ORDINARY_LIFE_PRIMARY_SEED);
    expect(summary.tickHorizons).toEqual({
      short: M3_ORDINARY_LIFE_SHORT_HORIZON_TICKS,
      full: M3_ORDINARY_LIFE_FULL_HORIZON_TICKS,
      long: M3_ORDINARY_LIFE_LONG_HORIZON_TICKS,
    });
    expect(summary.worldHash).toBe(repeat.worldHash);
    expect(summary.commandStreamHash).toBe(repeat.commandStreamHash);
    expect(summary.replayEvidence).toEqual({
      firstWorldHash: summary.worldHash,
      replayWorldHash: summary.worldHash,
      hashMatch: true,
    });

    expect(summary.endState.yaoMovementAfterInjury).toBeLessThan(600);
    expect(summary.endState.yaoMovementAfterTreatment).toBeGreaterThan(
      summary.endState.yaoMovementAfterInjury,
    );
    expect(summary.endState.yaoSprainSeverity).toBe(260);
    expect(summary.endState.treatmentCompletedCount).toBe(1);
    expect(summary.endState.activeMedicalRequests).toBe(0);
    expect(summary.endState.grainBowlQuantity).toBe(7);
    expect(summary.endState.bandageQuantity).toBe(2);
    expect(summary.endState.yaoMinGratitude).toBeGreaterThan(0);
    expect(summary.endState.yaoLinCare).toBeGreaterThan(0);
    expect(summary.endState.finalWeather).toBe("rain_light");
    expect(summary.endState.finalScheduleWindow).toBe("night");
  });

  it("emits machine-checkable hashes traces queue metrics and terminal invariants", () => {
    const summary = runM3OrdinaryLifeScenario({ seed: "3", ticks: 20_000 });
    const reasons = new Set<M3OrdinaryLifeReason>();

    for (const trace of summary.reasonTraces) {
      reasons.add(trace.reason);
      expect(trace.sequence).toBeGreaterThan(0);
      expect(trace.tick).toBeGreaterThanOrEqual(0);
      expect(trace.candidateTotal).toBeGreaterThanOrEqual(trace.scoredCount);
      expect(trace.visitedCount).toBeLessThanOrEqual(
        Math.max(trace.candidateCap, trace.visitedCount),
      );
    }

    let expectedCheckpointCount = 0;
    for (const tick of M3_ORDINARY_LIFE_CHECKPOINTS) {
      if (tick <= 20_000) {
        expectedCheckpointCount += 1;
      }
    }
    expect(summary.checkpointHashes).toHaveLength(expectedCheckpointCount);
    for (let index = 0; index < expectedCheckpointCount; index += 1) {
      expect(summary.checkpointHashes[index]?.tick).toBe(M3_ORDINARY_LIFE_CHECKPOINTS[index]);
      expect(summary.checkpointHashes[index]?.hash.startsWith("0x")).toBe(true);
    }
    expect(summary.worldHash.startsWith("0x")).toBe(true);
    expect(summary.contentHash.startsWith("0x")).toBe(true);
    expect(summary.commandStreamHash.startsWith("0x")).toBe(true);

    expect(reasons.has("scenario.initialized")).toBe(true);
    expect(reasons.has("need.hunger_urgency_indexed")).toBe(true);
    expect(reasons.has("need.rest_urgency_indexed")).toBe(true);
    expect(reasons.has("food.consumed_integer_portion")).toBe(true);
    expect(reasons.has("condition.injury_applied")).toBe(true);
    expect(reasons.has("ability.cache_invalidated")).toBe(true);
    expect(reasons.has("work.interrupted_by_ability_change")).toBe(true);
    expect(reasons.has("work.rejected_actor_ability_below_threshold")).toBe(true);
    expect(reasons.has("work.rejected_outdoor_night_window")).toBe(true);
    expect(reasons.has("medical.offer_created")).toBe(true);
    expect(reasons.has("medical.counterevidence_no_fever")).toBe(true);
    expect(reasons.has("medical.treatment_completed")).toBe(true);
    expect(reasons.has("mood.thought_added")).toBe(true);
    expect(reasons.has("relationship.event_applied")).toBe(true);
    expect(reasons.has("weather.changed_by_command")).toBe(true);
    expect(reasons.has("save.checkpoint_written")).toBe(true);
    expect(reasons.has("snapshot.rebuilt_derived_indexes")).toBe(true);
    expect(summary.reasonTraces.length).toBeLessThanOrEqual(64);
    expect(summary.queueMetrics.needDirtyBacklog).toBe(0);
    expect(summary.queueMetrics.foodDirtyBacklog).toBe(0);
    expect(summary.terminalInvariantCounters).toMatchObject({
      activeReservationCount: 0,
      runningJobCount: 0,
      negativeNeedLaneCount: 0,
      needLaneCheckCount: 6 * NEED_LANE_COUNT,
      outOfRangeMoodLaneCount: 0,
      moodLaneCheckCount: 6 * M3_MOOD_LANE_COUNT * 2,
      outOfRangeRelationshipLaneCount: 0,
      activeM4FactCount: 0,
      m4AbsenceCheckCount: 5,
      reasonTraceOverflowCount: 0,
      itemConservationDelta: 0,
      medicalStockConservationDelta: 0,
    });
    expect(summary.terminalInvariantCounters.relationshipLaneCheckCount).toBeGreaterThanOrEqual(
      M3_RELATIONSHIP_LANE_COUNT,
    );
    expect(summary.performance.actorThinkPasses).toBeGreaterThanOrEqual(4);
    expect(summary.performance.workCandidateVisitedCount).toBeLessThanOrEqual(24 * 4);
    expect(summary.performance.medicalCandidateVisitedCount).toBeGreaterThan(0);
    expect(summary.performance.foodCandidateVisitedCount).toBeGreaterThan(0);
    expect(summary.performance.socialCandidateVisitedCount).toBeGreaterThan(0);
  });

  it("keeps shared checkpoint hashes stable across requested horizons", () => {
    const short = runM3OrdinaryLifeScenario({ seed: "3", ticks: 12_000 });
    const long = runM3OrdinaryLifeScenario({ seed: "3", ticks: 20_000 });

    for (const shortCheckpoint of short.checkpointHashes) {
      const longCheckpoint = long.checkpointHashes.find(
        (checkpoint) => checkpoint.tick === shortCheckpoint.tick,
      );
      expect(longCheckpoint?.hash).toBe(shortCheckpoint.hash);
    }
  });
});
