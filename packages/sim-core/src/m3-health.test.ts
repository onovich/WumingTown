import { describe, expect, it } from "vitest";

import {
  M3_ABILITY_COMMUNICATION,
  M3_ABILITY_MANIPULATION,
  M3_ABILITY_MOVEMENT,
  M3_ABILITY_STAMINA,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_ILLNESS,
  M3_HEALTH_CONDITION_KIND_INJURY,
  createM3AbilityCacheStore,
  createM3HealthAbilityMask,
  createM3HealthConditionStore,
  type M3HealthConditionInput,
  type M3HealthConditionView,
  type M3HealthMetrics,
} from "./index";

describe("m3-health-abilities", () => {
  it("stores focused injury facts and invalidates exact affected ability lanes", () => {
    const health = createM3HealthConditionStore({
      actorCapacity: 6,
      conditionCapacity: 8,
      abilityDirtyCapacity: 24,
    });
    const abilities = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 24 });
    expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, 900)).toEqual({ ok: true });
    expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_STAMINA, 760)).toEqual({ ok: true });
    abilities.drainInvalidationBacklog(8);

    expect(health.addCondition(createLeftLegSprain())).toMatchObject({
      ok: true,
      reason: "condition.injury_applied",
      actorId: ACTOR_YAO,
      actorConditionVersion: 1,
      storeVersion: 1,
    });
    expect(health.readCondition(2)).toMatchObject({
      actorId: ACTOR_YAO,
      kind: M3_HEALTH_CONDITION_KIND_INJURY,
      bodyPart: BODY_PART_LEFT_LEG,
      severity: 420,
      ageTicks: 0,
      sourceId: SOURCE_INCIDENT_SPROUT,
      clueRef: CLUE_LIMP_OBSERVED,
      counterevidenceRef: COUNTER_NO_FEVER,
      terminalState: M3_HEALTH_CONDITION_ACTIVE,
      affectedAbilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT, M3_ABILITY_STAMINA]),
    });

    expect(health.drainAbilityInvalidations(abilities, 8)).toBe(2);
    expect(health.createMetrics()).toMatchObject({
      activeConditionCount: 1,
      conditionUpdateCount: 1,
      abilityInvalidationCount: 2,
      healthDirtyBacklog: 0,
      healthDirtyPeak: 2,
    });
    expect(abilities.createMetrics()).toMatchObject({
      abilityInvalidationCount: 4,
      abilityDirtyBacklog: 2,
      abilityDirtyPeak: 2,
    });

    expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, health, 600)).toMatchObject({
      ok: false,
      reason: "ability.rejected_below_threshold",
      actorId: ACTOR_YAO,
      ability: M3_ABILITY_MOVEMENT,
      value: 480,
      threshold: 600,
      actorConditionVersion: 1,
      baseAbilityVersion: 1,
      visitedConditionCount: 1,
    });
    expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_STAMINA, health, 500)).toMatchObject({
      ok: false,
      reason: "ability.rejected_below_threshold",
      value: 340,
      visitedConditionCount: 1,
    });
    expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MANIPULATION, health, 800)).toMatchObject({
      ok: true,
      reason: "ability.cache_rebuilt",
      value: 1000,
      visitedConditionCount: 1,
    });
  });

  it("reuses valid cache rows and rebuilds only from the actor condition lane after changes", () => {
    const health = createM3HealthConditionStore({
      actorCapacity: 6,
      conditionCapacity: 10,
      abilityDirtyCapacity: 32,
    });
    const abilities = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 32 });
    expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, 900)).toEqual({ ok: true });
    abilities.drainInvalidationBacklog(4);
    expect(health.addCondition(createLeftLegSprain())).toMatchObject({ ok: true });
    expect(
      health.addCondition({
        ...createLeftLegSprain(),
        conditionId: 7,
        actorId: ACTOR_MIN,
        severity: 300,
      }),
    ).toMatchObject({ ok: true });
    expect(health.drainAbilityInvalidations(abilities, 8)).toBe(4);

    expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, health, 1)).toMatchObject({
      ok: true,
      value: 480,
      visitedConditionCount: 1,
    });
    expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, health, 1)).toMatchObject({
      ok: true,
      reason: "ability.cache_hit",
      value: 480,
      visitedConditionCount: 0,
    });
    expect(abilities.createMetrics()).toMatchObject({
      abilityQueryCount: 2,
      abilityCacheHitCount: 1,
      abilityCacheRebuildCount: 1,
      conditionRowsVisitedOnRebuild: 1,
    });

    expect(health.updateCondition({ conditionId: 2, severity: 200 })).toMatchObject({
      ok: true,
      reason: "condition.updated",
      actorConditionVersion: 2,
    });
    expect(health.drainAbilityInvalidations(abilities, 8)).toBe(2);
    expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, health, 1)).toMatchObject({
      ok: true,
      reason: "ability.cache_rebuilt",
      value: 700,
      actorConditionVersion: 2,
      visitedConditionCount: 1,
    });
    expect(abilities.createMetrics()).toMatchObject({
      abilityCacheRebuildCount: 2,
      conditionRowsVisitedOnRebuild: 2,
    });
  });

  it("removes conditions without leaving stale ability values and preserves deterministic hashes", () => {
    const first = createFixtureWithSprain();
    const second = createFixtureWithSprain();
    expect(first.abilities.createHash(first.health)).toBe(
      second.abilities.createHash(second.health),
    );

    expect(first.health.removeCondition(2)).toMatchObject({
      ok: true,
      reason: "condition.removed",
      actorConditionVersion: 2,
    });
    expect(first.health.drainAbilityInvalidations(first.abilities, 8)).toBe(2);
    expect(
      first.abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, first.health, 800),
    ).toMatchObject({
      ok: true,
      value: 900,
      actorConditionVersion: 2,
      visitedConditionCount: 0,
    });
    expect(first.abilities.createHash(first.health)).not.toBe(
      second.abilities.createHash(second.health),
    );
  });

  it("represents illness as a focused negative-control condition with structured reasons", () => {
    const health = createM3HealthConditionStore({
      actorCapacity: 6,
      conditionCapacity: 4,
      abilityDirtyCapacity: 16,
    });
    const abilities = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 16 });
    expect(
      health.addCondition({
        conditionId: 1,
        actorId: ACTOR_SU,
        defId: DEF_MILD_COUGH,
        kind: M3_HEALTH_CONDITION_KIND_ILLNESS,
        bodyPart: BODY_PART_TORSO,
        severity: 140,
        ageTicks: 30,
        sourceId: SOURCE_SECONDARY_FIXTURE,
        componentFlags: 0,
        clueRef: CLUE_COUGH_OBSERVED,
        counterevidenceRef: COUNTER_NO_FEVER,
        terminalState: M3_HEALTH_CONDITION_ACTIVE,
        affectedAbilityMask: createM3HealthAbilityMask([
          M3_ABILITY_STAMINA,
          M3_ABILITY_COMMUNICATION,
        ]),
      }),
    ).toMatchObject({
      ok: true,
      reason: "condition.illness_applied",
    });
    expect(health.drainAbilityInvalidations(abilities, 8)).toBe(2);
    expect(abilities.queryAbility(ACTOR_SU, M3_ABILITY_COMMUNICATION, health, 900)).toMatchObject({
      ok: false,
      reason: "ability.rejected_below_threshold",
      value: 860,
      threshold: 900,
      visitedConditionCount: 1,
    });
  });

  it("rejects condition dirty queue overflow without partial owner mutations", () => {
    const addOverflow = createSmallDirtyHealth();
    const addHash = addOverflow.createHash();
    expect(addOverflow.addCondition(createLeftLegSprain())).toEqual({
      ok: false,
      reason: "condition.dirty_queue_overflow",
    });
    expect(addOverflow.readCondition(2)).toBeUndefined();
    expect(addOverflow.createHash()).toBe(addHash);
    expect(addOverflow.createMetrics()).toMatchObject({
      activeConditionCount: 0,
      storeVersion: 0,
      conditionUpdateCount: 0,
      abilityInvalidationCount: 0,
      healthDirtyBacklog: 0,
    });

    const updateOverflow = createOneLaneOverflowFixture();
    const updateBefore = snapshotCondition(updateOverflow);
    expect(updateOverflow.updateCondition({ conditionId: 2, severity: 200 })).toEqual({
      ok: false,
      reason: "condition.dirty_queue_overflow",
    });
    expect(snapshotCondition(updateOverflow)).toEqual(updateBefore);

    const ageOverflow = createOneLaneOverflowFixture();
    const ageBefore = snapshotCondition(ageOverflow);
    expect(ageOverflow.ageCondition(2, 30)).toEqual({
      ok: false,
      reason: "condition.dirty_queue_overflow",
    });
    expect(snapshotCondition(ageOverflow)).toEqual(ageBefore);

    const removeOverflow = createOneLaneOverflowFixture();
    const removeBefore = snapshotCondition(removeOverflow);
    expect(removeOverflow.removeCondition(2)).toEqual({
      ok: false,
      reason: "condition.dirty_queue_overflow",
    });
    expect(snapshotCondition(removeOverflow)).toEqual(removeBefore);
  });

  it("validates terminal state values on add and update", () => {
    const health = createM3HealthConditionStore({
      actorCapacity: 6,
      conditionCapacity: 8,
      abilityDirtyCapacity: 8,
    });
    expect(
      health.addCondition({
        ...createLeftLegSprain(),
        terminalState: 255,
      }),
    ).toEqual({
      ok: false,
      reason: "condition.terminal_state_out_of_range",
    });
    expect(health.readCondition(2)).toBeUndefined();
    expect(health.createMetrics().activeConditionCount).toBe(0);

    expect(health.addCondition(createLeftLegSprain())).toMatchObject({ ok: true });
    const before = health.readCondition(2);
    expect(health.updateCondition({ conditionId: 2, terminalState: 99 })).toEqual({
      ok: false,
      reason: "condition.terminal_state_out_of_range",
    });
    expect(health.readCondition(2)).toEqual(before);
  });

  it("rejects invalid ability thresholds with value_out_of_range", () => {
    const health = createM3HealthConditionStore({
      actorCapacity: 6,
      conditionCapacity: 8,
      abilityDirtyCapacity: 8,
    });
    const abilities = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 8 });
    expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, health, 1001)).toMatchObject({
      ok: false,
      reason: "ability.value_out_of_range",
      threshold: 1001,
      visitedConditionCount: 0,
    });
  });
});

const ACTOR_YAO = 0;
const ACTOR_MIN = 2;
const ACTOR_SU = 5;
const DEF_LEFT_LEG_SPRAIN = 100;
const DEF_MILD_COUGH = 101;
const BODY_PART_TORSO = 2;
const BODY_PART_LEFT_LEG = 6;
const SOURCE_INCIDENT_SPROUT = 46;
const SOURCE_SECONDARY_FIXTURE = 4601;
const CLUE_LIMP_OBSERVED = 10;
const CLUE_COUGH_OBSERVED = 11;
const COUNTER_NO_FEVER = 20;

function createLeftLegSprain(): M3HealthConditionInput {
  return {
    conditionId: 2,
    actorId: ACTOR_YAO,
    defId: DEF_LEFT_LEG_SPRAIN,
    kind: M3_HEALTH_CONDITION_KIND_INJURY,
    bodyPart: BODY_PART_LEFT_LEG,
    severity: 420,
    ageTicks: 0,
    sourceId: SOURCE_INCIDENT_SPROUT,
    componentFlags: 0,
    clueRef: CLUE_LIMP_OBSERVED,
    counterevidenceRef: COUNTER_NO_FEVER,
    terminalState: M3_HEALTH_CONDITION_ACTIVE,
    affectedAbilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT, M3_ABILITY_STAMINA]),
  };
}

function createMovementOnlySprain(): M3HealthConditionInput {
  return {
    ...createLeftLegSprain(),
    affectedAbilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT]),
  };
}

function createSmallDirtyHealth(): ReturnType<typeof createM3HealthConditionStore> {
  return createM3HealthConditionStore({
    actorCapacity: 6,
    conditionCapacity: 8,
    abilityDirtyCapacity: 1,
  });
}

function createOneLaneOverflowFixture(): ReturnType<typeof createM3HealthConditionStore> {
  const health = createSmallDirtyHealth();
  expect(health.addCondition(createMovementOnlySprain())).toMatchObject({ ok: true });
  expect(health.createMetrics()).toMatchObject({
    activeConditionCount: 1,
    storeVersion: 1,
    conditionUpdateCount: 1,
    abilityInvalidationCount: 1,
    healthDirtyBacklog: 1,
  });
  return health;
}

function snapshotCondition(health: ReturnType<typeof createM3HealthConditionStore>): {
  readonly hash: number;
  readonly condition: M3HealthConditionView | undefined;
  readonly metrics: M3HealthMetrics;
} {
  return {
    hash: health.createHash(),
    condition: health.readCondition(2),
    metrics: health.createMetrics(),
  };
}

function createFixtureWithSprain(): {
  readonly health: ReturnType<typeof createM3HealthConditionStore>;
  readonly abilities: ReturnType<typeof createM3AbilityCacheStore>;
} {
  const health = createM3HealthConditionStore({
    actorCapacity: 6,
    conditionCapacity: 8,
    abilityDirtyCapacity: 24,
  });
  const abilities = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 24 });
  expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, 900)).toEqual({ ok: true });
  abilities.drainInvalidationBacklog(8);
  expect(health.addCondition(createLeftLegSprain())).toMatchObject({ ok: true });
  expect(health.drainAbilityInvalidations(abilities, 8)).toBe(2);
  expect(abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, health, 1)).toMatchObject({
    ok: true,
    value: 480,
  });
  return { health, abilities };
}
