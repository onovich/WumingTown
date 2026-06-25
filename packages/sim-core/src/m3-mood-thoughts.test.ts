import { describe, expect, it } from "vitest";

import {
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_INJURY,
  M3_MOOD_LANE_ENERGY,
  M3_MOOD_LANE_TENSION,
  M3_MOOD_LANE_VALENCE,
  createM3EnvironmentStore,
  createM3HealthAbilityMask,
  createM3HealthConditionStore,
  createM3MoodReasonTraceStore,
  createMoodThoughtMemoryStore,
  createNeedStore,
  type M3HealthConditionInput,
  type M3MoodThoughtInput,
} from "./index";

describe("m3-mood-thoughts", () => {
  it("derives mood targets from need, environment, and health facts", () => {
    const fixture = createFactDrivenFixture();
    const mood = fixture.mood;
    const trace = fixture.trace;

    expect(mood.applyNeedFacts(ACTOR_YAO, fixture.needs, 30, trace)).toBe(3);
    expect(
      mood.applyEnvironmentFact(ACTOR_YAO, fixture.environment.createProjection(3_000), trace),
    ).toMatchObject({
      ok: true,
      reason: "mood.thought_added",
    });
    const condition = fixture.health.readCondition(CONDITION_SPRAIN);
    expect(condition).toBeDefined();
    if (condition === undefined) {
      throw new Error("expected sprain condition");
    }
    expect(mood.applyHealthConditionFact(condition, 2_400, trace)).toMatchObject({
      ok: true,
      reason: "mood.thought_added",
    });

    const actorMood = mood.readActorMood(ACTOR_YAO);
    expect(actorMood).toMatchObject({
      actorId: ACTOR_YAO,
      currentValence: 500,
      currentEnergy: 500,
    });
    expect(actorMood?.targetValence).toBeLessThan(500);
    expect(actorMood?.targetEnergy).toBeLessThan(500);
    expect(actorMood?.targetTension).toBeGreaterThan(500);
    expect(mood.countThoughtsForActor(ACTOR_YAO)).toBe(5);
    expect(mood.countMemoriesForActor(ACTOR_YAO)).toBe(5);
    expect(trace.createMetrics().storedCount).toBeGreaterThanOrEqual(10);
    expect(trace.readNewest(0)).toMatchObject({
      reason: "mood.health_fact_applied",
      sourceKind: "health",
      sourceId: CONDITION_SPRAIN,
    });
  });

  it("updates current mood on scheduled stable integer phases", () => {
    const mood = createMoodThoughtMemoryStore({
      actorCapacity: 4,
      thoughtCapacity: 8,
      memoryCapacity: 8,
      updateIntervalTicks: 2,
      phaseSalt: 1,
    });
    expect(mood.registerActor(0)).toMatchObject({ ok: true });
    expect(mood.registerActor(1)).toMatchObject({ ok: true });
    expect(
      mood.applyThought(createManualThought(1, 0, M3_MOOD_LANE_VALENCE, -300, 500)),
    ).toMatchObject({
      ok: true,
    });

    const tickZero = mood.processScheduledMoodUpdates(0, 8, 25);
    expect(tickZero).toMatchObject({ visitedCount: 1, changedCount: 0 });
    expect(mood.readActorMood(0)?.currentValence).toBe(500);
    expect(mood.readActorMood(1)?.currentValence).toBe(500);

    const tickOne = mood.processScheduledMoodUpdates(1, 8, 25);
    expect(tickOne).toMatchObject({ visitedCount: 1, changedCount: 1 });
    expect(mood.readActorMood(1)?.currentValence).toBe(475);
    expect(mood.createMetrics()).toMatchObject({
      moodUpdateCount: 1,
      moodUpdateVisitedCount: 2,
    });
  });

  it("bounds thought and memory lanes, stacks repeated sources, and expires rows", () => {
    const mood = createMoodThoughtMemoryStore({
      actorCapacity: 2,
      thoughtCapacity: 3,
      memoryCapacity: 3,
      updateIntervalTicks: 1,
    });
    const trace = createM3MoodReasonTraceStore(8);
    expect(mood.registerActor(ACTOR_YAO)).toMatchObject({ ok: true });

    expect(
      mood.applyThought(createManualThought(ACTOR_YAO, 0, M3_MOOD_LANE_VALENCE, -50, 100), trace),
    ).toMatchObject({
      ok: true,
      reason: "mood.thought_added",
    });
    expect(
      mood.applyThought(createManualThought(ACTOR_YAO, 1, M3_MOOD_LANE_VALENCE, -60, 200), trace),
    ).toMatchObject({
      ok: true,
    });
    expect(
      mood.applyThought(createManualThought(ACTOR_YAO, 2, M3_MOOD_LANE_VALENCE, -70, 300), trace),
    ).toMatchObject({
      ok: true,
    });
    expect(
      mood.applyThought(createManualThought(ACTOR_YAO, 3, M3_MOOD_LANE_VALENCE, -80, 400), trace),
    ).toMatchObject({
      ok: true,
    });
    expect(mood.createMetrics()).toMatchObject({
      retainedThoughtCount: 3,
      retainedMemoryCount: 3,
      thoughtEvictionCount: 1,
      memoryEvictionCount: 1,
    });

    expect(
      mood.applyThought(createManualThought(ACTOR_YAO, 3, M3_MOOD_LANE_VALENCE, -90, 400), trace),
    ).toMatchObject({
      ok: true,
      reason: "mood.thought_refreshed",
    });
    expect(mood.createMetrics().retainedThoughtCount).toBe(3);

    expect(mood.processScheduledMoodUpdates(15, 4, 100)).toMatchObject({
      expiredThoughtCount: 3,
      expiredMemoryCount: 0,
    });
    expect(mood.countThoughtsForActor(ACTOR_YAO)).toBe(0);
    expect(mood.countMemoriesForActor(ACTOR_YAO)).toBe(3);
    expect(mood.processScheduledMoodUpdates(30, 4, 100)).toMatchObject({
      expiredMemoryCount: 3,
    });
    expect(mood.countMemoriesForActor(ACTOR_YAO)).toBe(0);
  });

  it("recalculates the evicted actor target on cross-actor thought eviction", () => {
    const mood = createMoodThoughtMemoryStore({
      actorCapacity: 2,
      thoughtCapacity: 1,
      memoryCapacity: 4,
      updateIntervalTicks: 2,
      phaseSalt: 1,
    });
    expect(mood.registerActor(0)).toMatchObject({ ok: true });
    expect(mood.registerActor(1)).toMatchObject({ ok: true });
    expect(
      mood.applyThought(createManualThought(0, 0, M3_MOOD_LANE_VALENCE, -400, 500)),
    ).toMatchObject({ ok: true });
    expect(mood.readActorMood(0)?.targetValence).toBe(300);

    expect(
      mood.applyThought(createManualThought(1, 1, M3_MOOD_LANE_VALENCE, -50, 100)),
    ).toMatchObject({ ok: true });
    expect(mood.countThoughtsForActor(0)).toBe(0);
    expect(mood.readActorMood(0)).toMatchObject({
      currentValence: 500,
      targetValence: 500,
    });

    expect(mood.processScheduledMoodUpdates(0, 4, 100)).toMatchObject({
      visitedCount: 1,
      changedCount: 0,
    });
    expect(mood.readActorMood(0)).toMatchObject({
      currentValence: 500,
      targetValence: 500,
    });
  });

  it("records cross-actor memory eviction and expiration without stale mood targets", () => {
    const mood = createMoodThoughtMemoryStore({
      actorCapacity: 2,
      thoughtCapacity: 4,
      memoryCapacity: 1,
      updateIntervalTicks: 1,
    });
    expect(mood.registerActor(0)).toMatchObject({ ok: true });
    expect(mood.registerActor(1)).toMatchObject({ ok: true });
    expect(
      mood.applyThought(createLongThought(0, 0, M3_MOOD_LANE_VALENCE, -400, 500)),
    ).toMatchObject({ ok: true });
    const actorZeroVersionBeforeEviction = mood.readActorMood(0)?.actorVersion ?? 0;

    expect(
      mood.applyThought(createLongThought(1, 1, M3_MOOD_LANE_ENERGY, -100, 100)),
    ).toMatchObject({ ok: true });
    expect(mood.countMemoriesForActor(0)).toBe(0);
    expect(mood.countThoughtsForActor(0)).toBe(1);
    expect(mood.readActorMood(0)?.targetValence).toBe(300);
    expect(mood.readActorMood(0)?.actorVersion).toBeGreaterThan(actorZeroVersionBeforeEviction);

    const actorOneVersionBeforeExpiration = mood.readActorMood(1)?.actorVersion ?? 0;
    expect(mood.processScheduledMoodUpdates(30, 4, 100)).toMatchObject({
      expiredThoughtCount: 0,
      expiredMemoryCount: 1,
    });
    expect(mood.countMemoriesForActor(1)).toBe(0);
    expect(mood.readActorMood(1)?.actorVersion).toBeGreaterThan(actorOneVersionBeforeExpiration);
  });

  it("produces replay-stable hashes and structured explanation reasons", () => {
    const first = runReplayHashFixture();
    const second = runReplayHashFixture();

    expect(first.hashes).toEqual(second.hashes);
    expect(first.traceReasons).toEqual(second.traceReasons);
    expect(first.metrics).toEqual(second.metrics);
  });
});

const ACTOR_YAO = 0;
const CONDITION_SPRAIN = 2;
const BODY_PART_LEFT_LEG = 6;
const SOURCE_INCIDENT_SPRAIN = 46;
const CLUE_LIMP_OBSERVED = 10;
const COUNTER_NO_FEVER = 20;

function createFactDrivenFixture(): {
  readonly mood: ReturnType<typeof createMoodThoughtMemoryStore>;
  readonly trace: ReturnType<typeof createM3MoodReasonTraceStore>;
  readonly needs: ReturnType<typeof createNeedStore>;
  readonly health: ReturnType<typeof createM3HealthConditionStore>;
  readonly environment: ReturnType<typeof createM3EnvironmentStore>;
} {
  const mood = createMoodThoughtMemoryStore({
    actorCapacity: 6,
    thoughtCapacity: 24,
    memoryCapacity: 24,
    updateIntervalTicks: 1,
  });
  const trace = createM3MoodReasonTraceStore(64);
  const needs = createNeedStore({ actorCapacity: 6, updateIntervalTicks: 5 });
  const health = createM3HealthConditionStore({
    actorCapacity: 6,
    conditionCapacity: 8,
    abilityDirtyCapacity: 24,
  });
  const environment = createM3EnvironmentStore();
  expect(mood.registerActor(ACTOR_YAO)).toMatchObject({ ok: true });
  expect(
    needs.registerActor({
      actorId: ACTOR_YAO,
      hunger: 220,
      rest: 240,
      comfort: 330,
      social: 520,
      safety: 720,
      sourceTick: 0,
    }),
  ).toMatchObject({ ok: true });
  expect(health.addCondition(createLeftLegSprain())).toMatchObject({ ok: true });
  environment.forceWeather(3_000, "rain_light");
  return { mood, trace, needs, health, environment };
}

function createLeftLegSprain(): M3HealthConditionInput {
  return {
    conditionId: CONDITION_SPRAIN,
    actorId: ACTOR_YAO,
    defId: 100,
    kind: M3_HEALTH_CONDITION_KIND_INJURY,
    bodyPart: BODY_PART_LEFT_LEG,
    severity: 420,
    ageTicks: 0,
    sourceId: SOURCE_INCIDENT_SPRAIN,
    componentFlags: 0,
    clueRef: CLUE_LIMP_OBSERVED,
    counterevidenceRef: COUNTER_NO_FEVER,
    terminalState: M3_HEALTH_CONDITION_ACTIVE,
    affectedAbilityMask: createM3HealthAbilityMask([1, 5]),
  };
}

function createManualThought(
  actorId: number,
  sourceId: number,
  targetMoodLane:
    | typeof M3_MOOD_LANE_VALENCE
    | typeof M3_MOOD_LANE_ENERGY
    | typeof M3_MOOD_LANE_TENSION,
  effectDelta: number,
  strength: number,
): M3MoodThoughtInput {
  return {
    actorId,
    tick: sourceId,
    sourceKind: "work",
    sourceId,
    sourceVersion: 1,
    targetMoodLane,
    strength,
    effectDelta,
    durationTicks: 10,
    memoryDurationTicks: 20,
    stackKey: 0x40_0000 + sourceId,
  };
}

function createLongThought(
  actorId: number,
  sourceId: number,
  targetMoodLane:
    | typeof M3_MOOD_LANE_VALENCE
    | typeof M3_MOOD_LANE_ENERGY
    | typeof M3_MOOD_LANE_TENSION,
  effectDelta: number,
  strength: number,
): M3MoodThoughtInput {
  return {
    ...createManualThought(actorId, sourceId, targetMoodLane, effectDelta, strength),
    durationTicks: 100,
    memoryDurationTicks: 20,
  };
}

function runReplayHashFixture(): {
  readonly hashes: readonly number[];
  readonly traceReasons: readonly string[];
  readonly metrics: ReturnType<ReturnType<typeof createMoodThoughtMemoryStore>["createMetrics"]>;
} {
  const fixture = createFactDrivenFixture();
  const mood = fixture.mood;
  const trace = fixture.trace;
  const hashes: number[] = [];
  hashes.push(mood.createHash());
  mood.applyNeedFacts(ACTOR_YAO, fixture.needs, 30, trace);
  hashes.push(mood.createHash());
  mood.applyEnvironmentFact(ACTOR_YAO, fixture.environment.createProjection(3_000), trace);
  hashes.push(mood.createHash());
  const condition = fixture.health.readCondition(CONDITION_SPRAIN);
  if (condition === undefined) {
    throw new Error("expected sprain condition");
  }
  mood.applyHealthConditionFact(condition, 2_400, trace);
  hashes.push(mood.createHash());
  mood.refreshDirtyActors(8);
  mood.processScheduledMoodUpdates(1, 8, 32);
  hashes.push(mood.createHash());

  return {
    hashes,
    traceReasons: [
      trace.readNewest(0)?.reason ?? "",
      trace.readNewest(1)?.reason ?? "",
      trace.readNewest(2)?.reason ?? "",
    ],
    metrics: mood.createMetrics(),
  };
}
