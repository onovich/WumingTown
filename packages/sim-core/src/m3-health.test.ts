import { describe, expect, it, vi } from "vitest";

import {
  M3_ABILITY_COMMUNICATION,
  M3_ABILITY_CONSCIOUSNESS,
  M3_ABILITY_MANIPULATION,
  M3_ABILITY_MOVEMENT,
  M3_ABILITY_SIGHT,
  M3_ABILITY_STAMINA,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_ILLNESS,
  M3_HEALTH_CONDITION_KIND_INJURY,
  M3_HEALTH_CONDITION_RECOVERING,
  M3_HEALTH_CONDITION_RESOLVED,
  createM3AbilityCacheStore,
  createM3HealthAbilityMask,
  createM3HealthConditionStore,
  type M3HealthConditionInput,
  type M3HealthConditionIntoOutput,
  type M3HealthConditionView,
  type M3HealthTreatmentConditionDeltaPrepareInput,
  type M3HealthTreatmentPrepareReason,
  type M3HealthMetrics,
  type PreparedM3HealthTreatmentConditionDelta,
} from "./index";
import { commitPreparedM3HealthTreatment } from "./m3-health";

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

  it("reads condition facts into one reused output and completely resets failures", () => {
    const health = createTreatmentHealth();
    const output = createHealthConditionIntoOutput(77);
    const identity = output;
    health.readConditionInto(2, output);
    expect(output).toBe(identity);
    expect(output).toStrictEqual({
      ok: true,
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
      storeVersion: 1,
      conditionVersion: 1,
      actorConditionVersion: 1,
      updateCount: 1,
      invalidationCount: 2,
      dirtyWriteCursor: 2,
      dirtyCount: 2,
      dirtyPeak: 2,
      dirtyCapacity: 16,
    });

    Object.assign(output, createHealthConditionIntoOutput(81));
    health.readConditionInto(7, output);
    expect(output).toBe(identity);
    expect(output).toStrictEqual(createHealthConditionIntoOutput(0, 7));

    Object.assign(output, createHealthConditionIntoOutput(93));
    health.readConditionInto(8, output);
    expect(output).toBe(identity);
    expect(output).toStrictEqual(createHealthConditionIntoOutput(0, 8));
  });

  it("preflights every treatment identity value and version before any owner write", () => {
    const health = createTreatmentHealth();
    const input = createTreatmentPrepareInput(health, 120);
    const output = createPreparedHealthTreatment(91);
    const identity = output;
    const before = snapshotHealthOwner(health);
    const flips: readonly (readonly [
      Partial<M3HealthTreatmentConditionDeltaPrepareInput>,
      M3HealthTreatmentPrepareReason,
    ])[] = [
      [{ conditionId: 8 }, "condition.id_out_of_range"],
      [{ conditionId: 7 }, "condition.not_active"],
      [{ expectedActorId: ACTOR_MIN }, "condition.identity_stale"],
      [{ expectedDefId: DEF_LEFT_LEG_SPRAIN + 1 }, "condition.identity_stale"],
      [{ expectedSeverity: 419 }, "condition.value_stale"],
      [{ expectedTerminalState: M3_HEALTH_CONDITION_RECOVERING }, "condition.value_stale"],
      [
        { expectedAffectedAbilityMask: input.expectedAffectedAbilityMask ^ 1 },
        "condition.value_stale",
      ],
      [{ expectedStoreVersion: input.expectedStoreVersion + 1 }, "condition.version_stale"],
      [{ expectedConditionVersion: input.expectedConditionVersion + 1 }, "condition.version_stale"],
      [
        { expectedActorConditionVersion: input.expectedActorConditionVersion + 1 },
        "condition.version_stale",
      ],
      [{ severityDelta: 0 }, "condition.severity_out_of_range"],
      [{ severityDelta: -1 }, "condition.severity_out_of_range"],
      [{ severityDelta: 0.5 }, "condition.severity_out_of_range"],
      [{ severityDelta: Number.NaN }, "condition.severity_out_of_range"],
      [{ severityDelta: Number.POSITIVE_INFINITY }, "condition.severity_out_of_range"],
      [{ severityDelta: Number.MAX_SAFE_INTEGER + 1 }, "condition.severity_out_of_range"],
      [{ severityDelta: 1001 }, "condition.severity_out_of_range"],
    ];
    for (const [flip, reason] of flips) {
      health.prepareTreatmentConditionDeltaInto({ ...input, ...flip }, output);
      expect(output).toBe(identity);
      expect(output).toStrictEqual(createPreparedHealthTreatmentFailure(reason));
      expect(snapshotHealthOwner(health)).toStrictEqual(before);
    }
    health.prepareTreatmentConditionDeltaInto(input, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: "condition.treatment_prepared",
      conditionId: 2,
      actorId: ACTOR_YAO,
      abilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT, M3_ABILITY_STAMINA]),
      previousSeverity: 420,
      nextSeverity: 300,
      previousTerminalState: M3_HEALTH_CONDITION_ACTIVE,
      nextTerminalState: M3_HEALTH_CONDITION_RECOVERING,
      previousStoreVersion: 1,
      nextStoreVersion: 2,
      previousConditionVersion: 1,
      nextConditionVersion: 2,
      previousActorConditionVersion: 1,
      nextActorConditionVersion: 2,
      previousUpdateCount: 1,
      nextUpdateCount: 2,
      previousInvalidationCount: 2,
      nextInvalidationCount: 4,
      previousDirtyWriteCursor: 2,
      nextDirtyWriteCursor: 4,
      previousDirtyCount: 2,
      nextDirtyCount: 4,
      previousDirtyPeak: 2,
      nextDirtyPeak: 4,
      invalidationWriteCount: 2,
    });
    expect(snapshotHealthOwner(health)).toStrictEqual(before);

    const resolved = createM3HealthConditionStore({
      actorCapacity: 6,
      conditionCapacity: 8,
      abilityDirtyCapacity: 8,
    });
    expect(
      resolved.addCondition({
        ...createLeftLegSprain(),
        terminalState: M3_HEALTH_CONDITION_RESOLVED,
      }),
    ).toMatchObject({ ok: true });
    resolved.prepareTreatmentConditionDeltaInto(createTreatmentPrepareInput(resolved, 10), output);
    expect(output).toStrictEqual(
      createPreparedHealthTreatmentFailure("condition.terminal_state_out_of_range"),
    );

    const recovering = createTreatmentHealth();
    expect(
      recovering.updateCondition({
        conditionId: 2,
        terminalState: M3_HEALTH_CONDITION_RECOVERING,
      }),
    ).toMatchObject({ ok: true });
    const recoveringBefore = snapshotHealthOwner(recovering);
    recovering.prepareTreatmentConditionDeltaInto(
      createTreatmentPrepareInput(recovering, 20),
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      previousTerminalState: M3_HEALTH_CONDITION_RECOVERING,
      nextTerminalState: M3_HEALTH_CONDITION_RECOVERING,
      previousSeverity: 420,
      nextSeverity: 400,
    });
    expect(snapshotHealthOwner(recovering)).toStrictEqual(recoveringBefore);
  });

  it("commits an exact treatment delta and wraps first middle and last ability dirty lanes", () => {
    const health = createTreatmentHealth(
      createM3HealthAbilityMask([M3_ABILITY_CONSCIOUSNESS, M3_ABILITY_SIGHT, M3_ABILITY_STAMINA]),
      4,
    );
    const cache = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 16 });
    expect(health.drainAbilityInvalidations(cache, 6)).toBe(3);
    const prepared = createPreparedHealthTreatment();
    health.prepareTreatmentConditionDeltaInto(createTreatmentPrepareInput(health, 500), prepared);
    expect(prepared).toStrictEqual({
      ok: true,
      reason: "condition.treatment_prepared",
      conditionId: 2,
      actorId: ACTOR_YAO,
      abilityMask: createM3HealthAbilityMask([
        M3_ABILITY_CONSCIOUSNESS,
        M3_ABILITY_SIGHT,
        M3_ABILITY_STAMINA,
      ]),
      previousSeverity: 420,
      nextSeverity: 0,
      previousTerminalState: M3_HEALTH_CONDITION_ACTIVE,
      nextTerminalState: M3_HEALTH_CONDITION_RESOLVED,
      previousStoreVersion: 1,
      nextStoreVersion: 2,
      previousConditionVersion: 1,
      nextConditionVersion: 2,
      previousActorConditionVersion: 1,
      nextActorConditionVersion: 2,
      previousUpdateCount: 1,
      nextUpdateCount: 2,
      previousInvalidationCount: 3,
      nextInvalidationCount: 6,
      previousDirtyWriteCursor: 3,
      nextDirtyWriteCursor: 2,
      previousDirtyCount: 0,
      nextDirtyCount: 3,
      previousDirtyPeak: 3,
      nextDirtyPeak: 3,
      invalidationWriteCount: 3,
    });
    const beforeCondition = createHealthConditionIntoOutput();
    health.readConditionInto(2, beforeCondition);
    const invalidations = vi.spyOn(cache, "invalidateConditionAbilityLane");
    commitPreparedM3HealthTreatment(health, prepared);
    const afterCondition = createHealthConditionIntoOutput();
    health.readConditionInto(2, afterCondition);
    expect(afterCondition).toStrictEqual({
      ...beforeCondition,
      severity: 0,
      terminalState: M3_HEALTH_CONDITION_RESOLVED,
      storeVersion: 2,
      conditionVersion: 2,
      actorConditionVersion: 2,
      updateCount: 2,
      invalidationCount: 6,
      dirtyWriteCursor: 2,
      dirtyCount: 3,
    });
    expect(health.createMetrics()).toStrictEqual({
      activeConditionCount: 1,
      storeVersion: 2,
      conditionUpdateCount: 2,
      abilityInvalidationCount: 6,
      healthDirtyBacklog: 3,
      healthDirtyPeak: 3,
    });
    expect(readHealthDirtyState(health)).toStrictEqual({
      readCursor: 3,
      writeCursor: 2,
      count: 3,
      peak: 3,
      actors: [0, 0, 0, 0],
      abilities: [M3_ABILITY_SIGHT, M3_ABILITY_STAMINA, M3_ABILITY_STAMINA, 0],
      versions: [2, 2, 1, 2],
      reasons: [1, 1, 1, 1],
    });
    expect(health.drainAbilityInvalidations(cache, 6)).toBe(3);
    expect(invalidations.mock.calls).toStrictEqual([
      [ACTOR_YAO, M3_ABILITY_CONSCIOUSNESS, 2, "ability.cache_invalidated"],
      [ACTOR_YAO, M3_ABILITY_SIGHT, 2, "ability.cache_invalidated"],
      [ACTOR_YAO, M3_ABILITY_STAMINA, 2, "ability.cache_invalidated"],
    ]);
  });

  it("appends to a partially occupied dirty ring without clobbering and raises peak", () => {
    const mask = createM3HealthAbilityMask([
      M3_ABILITY_CONSCIOUSNESS,
      M3_ABILITY_SIGHT,
      M3_ABILITY_STAMINA,
    ]);
    const health = createTreatmentHealth(mask, 6);
    const cache = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 16 });
    expect(health.drainAbilityInvalidations(cache, 2)).toBe(2);
    expect(readHealthDirtyState(health)).toMatchObject({
      readCursor: 2,
      writeCursor: 3,
      count: 1,
      peak: 3,
    });
    const prepared = createPreparedHealthTreatment();
    health.prepareTreatmentConditionDeltaInto(createTreatmentPrepareInput(health, 10), prepared);
    expect(prepared).toMatchObject({
      ok: true,
      previousDirtyWriteCursor: 3,
      nextDirtyWriteCursor: 0,
      previousDirtyCount: 1,
      nextDirtyCount: 4,
      previousDirtyPeak: 3,
      nextDirtyPeak: 4,
    });
    const invalidations = vi.spyOn(cache, "invalidateConditionAbilityLane");
    commitPreparedM3HealthTreatment(health, prepared);
    expect(readHealthDirtyState(health)).toStrictEqual({
      readCursor: 2,
      writeCursor: 0,
      count: 4,
      peak: 4,
      actors: [0, 0, 0, 0, 0, 0],
      abilities: [0, M3_ABILITY_SIGHT, M3_ABILITY_STAMINA, 0, M3_ABILITY_SIGHT, M3_ABILITY_STAMINA],
      versions: [1, 1, 1, 2, 2, 2],
      reasons: [1, 1, 1, 1, 1, 1],
    });
    expect(health.drainAbilityInvalidations(cache, 6)).toBe(4);
    expect(invalidations.mock.calls).toStrictEqual([
      [ACTOR_YAO, M3_ABILITY_STAMINA, 1, "ability.cache_invalidated"],
      [ACTOR_YAO, M3_ABILITY_CONSCIOUSNESS, 2, "ability.cache_invalidated"],
      [ACTOR_YAO, M3_ABILITY_SIGHT, 2, "ability.cache_invalidated"],
      [ACTOR_YAO, M3_ABILITY_STAMINA, 2, "ability.cache_invalidated"],
    ]);
  });

  it("checks every version and counter boundary plus treatment dirty capacity", () => {
    const boundaries = [0xffff_fffc, 0xffff_fffd, 0xffff_fffe, 0xffff_ffff] as const;
    const versionFields = [
      "version",
      "conditionVersions",
      "actorConditionVersions",
      "updateCount",
    ] as const;
    for (const field of versionFields) {
      for (const value of boundaries) {
        const health = createTreatmentHealth();
        setHealthBoundary(health, field, value);
        const prepared = createPreparedHealthTreatment();
        health.prepareTreatmentConditionDeltaInto(createTreatmentPrepareInput(health, 1), prepared);
        expect(prepared.ok, `${field} ${value.toString(16)}`).toBe(value !== 0xffff_ffff);
        if (prepared.ok) {
          const next =
            field === "version"
              ? prepared.nextStoreVersion
              : field === "conditionVersions"
                ? prepared.nextConditionVersion
                : field === "actorConditionVersions"
                  ? prepared.nextActorConditionVersion
                  : prepared.nextUpdateCount;
          expect(next).toBe(value + 1);
        } else {
          expect(prepared).toStrictEqual(
            createPreparedHealthTreatmentFailure(
              field === "updateCount"
                ? "condition.counter_exhausted"
                : "condition.version_exhausted",
            ),
          );
        }
      }
    }

    const exactInvalidation = createTreatmentHealth(
      createM3HealthAbilityMask([M3_ABILITY_CONSCIOUSNESS, M3_ABILITY_SIGHT, M3_ABILITY_STAMINA]),
      8,
    );
    exactInvalidation.drainAbilityInvalidations(
      createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 8 }),
      6,
    );
    setHealthBoundary(exactInvalidation, "invalidationCount", 0xffff_ffff - 3);
    const exactPrepared = createPreparedHealthTreatment();
    exactInvalidation.prepareTreatmentConditionDeltaInto(
      createTreatmentPrepareInput(exactInvalidation, 1),
      exactPrepared,
    );
    expect(exactPrepared).toMatchObject({ ok: true, nextInvalidationCount: 0xffff_ffff });

    const exhaustedInvalidation = createTreatmentHealth(
      createM3HealthAbilityMask([M3_ABILITY_CONSCIOUSNESS, M3_ABILITY_SIGHT, M3_ABILITY_STAMINA]),
      8,
    );
    exhaustedInvalidation.drainAbilityInvalidations(
      createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 8 }),
      6,
    );
    setHealthBoundary(exhaustedInvalidation, "invalidationCount", 0xffff_ffff - 2);
    const exhaustedPrepared = createPreparedHealthTreatment();
    exhaustedInvalidation.prepareTreatmentConditionDeltaInto(
      createTreatmentPrepareInput(exhaustedInvalidation, 1),
      exhaustedPrepared,
    );
    expect(exhaustedPrepared).toStrictEqual(
      createPreparedHealthTreatmentFailure("condition.counter_exhausted"),
    );

    const fullQueue = createTreatmentHealth(
      createM3HealthAbilityMask([M3_ABILITY_CONSCIOUSNESS, M3_ABILITY_SIGHT, M3_ABILITY_STAMINA]),
      3,
    );
    const queueBefore = snapshotCondition(fullQueue);
    const queuePrepared = createPreparedHealthTreatment();
    fullQueue.prepareTreatmentConditionDeltaInto(
      createTreatmentPrepareInput(fullQueue, 1),
      queuePrepared,
    );
    expect(queuePrepared).toStrictEqual(
      createPreparedHealthTreatmentFailure("condition.dirty_queue_overflow"),
    );
    expect(snapshotCondition(fullQueue)).toStrictEqual(queueBefore);
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

function createTreatmentHealth(
  affectedAbilityMask = createM3HealthAbilityMask([M3_ABILITY_MOVEMENT, M3_ABILITY_STAMINA]),
  abilityDirtyCapacity = 16,
): ReturnType<typeof createM3HealthConditionStore> {
  const health = createM3HealthConditionStore({
    actorCapacity: 6,
    conditionCapacity: 8,
    abilityDirtyCapacity,
  });
  expect(
    health.addCondition({
      ...createLeftLegSprain(),
      affectedAbilityMask,
    }),
  ).toMatchObject({ ok: true });
  return health;
}

function createTreatmentPrepareInput(
  health: ReturnType<typeof createM3HealthConditionStore>,
  severityDelta: number,
): M3HealthTreatmentConditionDeltaPrepareInput {
  const condition = createHealthConditionIntoOutput();
  health.readConditionInto(2, condition);
  if (!condition.ok) throw new Error("missing Health treatment condition");
  return {
    conditionId: condition.conditionId,
    expectedActorId: condition.actorId,
    expectedDefId: condition.defId,
    expectedSeverity: condition.severity,
    expectedTerminalState: condition.terminalState,
    expectedAffectedAbilityMask: condition.affectedAbilityMask,
    expectedStoreVersion: condition.storeVersion,
    expectedConditionVersion: condition.conditionVersion,
    expectedActorConditionVersion: condition.actorConditionVersion,
    severityDelta,
  };
}

function createHealthConditionIntoOutput(
  seed = 0,
  conditionId = seed === 0 ? 0xffff_ffff : seed,
): M3HealthConditionIntoOutput {
  return {
    ok: seed !== 0,
    conditionId,
    actorId: seed,
    defId: seed,
    kind: seed,
    bodyPart: seed,
    severity: seed,
    ageTicks: seed,
    sourceId: seed,
    componentFlags: seed,
    clueRef: seed,
    counterevidenceRef: seed,
    terminalState: seed,
    affectedAbilityMask: seed,
    storeVersion: seed,
    conditionVersion: seed,
    actorConditionVersion: seed,
    updateCount: seed,
    invalidationCount: seed,
    dirtyWriteCursor: seed,
    dirtyCount: seed,
    dirtyPeak: seed,
    dirtyCapacity: seed,
  };
}

function createPreparedHealthTreatment(seed = 0): PreparedM3HealthTreatmentConditionDelta {
  return {
    ok: seed !== 0,
    reason: seed === 0 ? "condition.not_active" : "condition.treatment_prepared",
    conditionId: seed === 0 ? 0xffff_ffff : seed,
    actorId: seed,
    abilityMask: seed,
    previousSeverity: seed,
    nextSeverity: seed,
    previousTerminalState: seed,
    nextTerminalState: seed,
    previousStoreVersion: seed,
    nextStoreVersion: seed,
    previousConditionVersion: seed,
    nextConditionVersion: seed,
    previousActorConditionVersion: seed,
    nextActorConditionVersion: seed,
    previousUpdateCount: seed,
    nextUpdateCount: seed,
    previousInvalidationCount: seed,
    nextInvalidationCount: seed,
    previousDirtyWriteCursor: seed,
    nextDirtyWriteCursor: seed,
    previousDirtyCount: seed,
    nextDirtyCount: seed,
    previousDirtyPeak: seed,
    nextDirtyPeak: seed,
    invalidationWriteCount: seed,
  };
}

function createPreparedHealthTreatmentFailure(
  reason: M3HealthTreatmentPrepareReason,
): PreparedM3HealthTreatmentConditionDelta {
  return { ...createPreparedHealthTreatment(), reason };
}

interface HealthOwnerSnapshot {
  readonly hash: number;
  readonly condition: M3HealthConditionIntoOutput;
  readonly metrics: M3HealthMetrics;
  readonly conditionVersions: readonly number[];
  readonly actorConditionVersions: readonly number[];
  readonly dirty: HealthDirtyState;
}

interface HealthDirtyState {
  readonly readCursor: number;
  readonly writeCursor: number;
  readonly count: number;
  readonly peak: number;
  readonly actors: readonly number[];
  readonly abilities: readonly number[];
  readonly versions: readonly number[];
  readonly reasons: readonly number[];
}

function snapshotHealthOwner(
  health: ReturnType<typeof createM3HealthConditionStore>,
): HealthOwnerSnapshot {
  const condition = createHealthConditionIntoOutput();
  health.readConditionInto(2, condition);
  return {
    hash: health.createHash(),
    condition,
    metrics: health.createMetrics(),
    conditionVersions: readHealthUint32Lane(health, "conditionVersions"),
    actorConditionVersions: readHealthUint32Lane(health, "actorConditionVersions"),
    dirty: readHealthDirtyState(health),
  };
}

function readHealthDirtyState(
  health: ReturnType<typeof createM3HealthConditionStore>,
): HealthDirtyState {
  return {
    readCursor: readHealthScalar(health, "dirtyReadCursor"),
    writeCursor: readHealthScalar(health, "dirtyWriteCursor"),
    count: readHealthScalar(health, "dirtyCount"),
    peak: readHealthScalar(health, "dirtyPeak"),
    actors: readHealthUint32Lane(health, "dirtyActors"),
    abilities: readHealthUint8Lane(health, "dirtyAbilities"),
    versions: readHealthUint32Lane(health, "dirtyVersions"),
    reasons: readHealthUint8Lane(health, "dirtyReasons"),
  };
}

function readHealthScalar(
  health: ReturnType<typeof createM3HealthConditionStore>,
  field: string,
): number {
  const reflected: unknown = Reflect.get(health, field);
  if (typeof reflected !== "number") throw new Error(`missing Health scalar ${field}`);
  return reflected;
}

function readHealthUint32Lane(
  health: ReturnType<typeof createM3HealthConditionStore>,
  field: string,
): readonly number[] {
  const reflected: unknown = Reflect.get(health, field);
  if (!(reflected instanceof Uint32Array)) throw new Error(`missing Health Uint32 lane ${field}`);
  return Array.from(reflected);
}

function readHealthUint8Lane(
  health: ReturnType<typeof createM3HealthConditionStore>,
  field: string,
): readonly number[] {
  const reflected: unknown = Reflect.get(health, field);
  if (!(reflected instanceof Uint8Array)) throw new Error(`missing Health Uint8 lane ${field}`);
  return Array.from(reflected);
}

function setHealthBoundary(
  health: ReturnType<typeof createM3HealthConditionStore>,
  field:
    | "version"
    | "conditionVersions"
    | "actorConditionVersions"
    | "updateCount"
    | "invalidationCount",
  value: number,
): void {
  if (field === "conditionVersions" || field === "actorConditionVersions") {
    const reflected: unknown = Reflect.get(health, field);
    if (!(reflected instanceof Uint32Array)) throw new Error(`missing Health ${field}`);
    reflected[field === "conditionVersions" ? 2 : ACTOR_YAO] = value;
    return;
  }
  if (!Reflect.set(health, field, value)) throw new Error(`failed to set Health ${field}`);
}
