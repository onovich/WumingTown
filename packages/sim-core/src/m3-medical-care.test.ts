import { describe, expect, it, vi } from "vitest";

import {
  M3_ABILITY_MANIPULATION,
  M3_ABILITY_MOVEMENT,
  M3_ABILITY_STAMINA,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_INJURY,
  M3_MEDICAL_NO_REQUEST,
  createEntityRegistry,
  createGridPathfinder,
  createItemStackStore,
  createJobCoreStore,
  createM3AbilityCacheStore,
  createM3HealthAbilityMask,
  createM3HealthConditionStore,
  createM3MedicalCareStore,
  createM3TreatmentJobStore,
  createMapGrid,
  createPathVersionBasis,
  createReservationLedger,
  type EntityId,
  type M3HealthConditionInput,
  type M3MedicalPatientRequestInput,
  type PathSearchResult,
} from "./index";

describe("m3-medical-care", () => {
  it("reads patient and caregiver rows into reusable flat outputs", () => {
    const fixture = createReadyTreatmentFixture();
    const legacyPatient = fixture.medical.readPatientRequest(REQUEST_YAO_SPRAIN);
    const legacyCaregiver = fixture.medical.readCaregiverState(ACTOR_MIN);
    if (legacyPatient === undefined || legacyCaregiver === undefined) {
      throw new Error("missing medical owner rows");
    }
    const patientOutput = createPatientRequestIntoOutput();
    const caregiverOutput = createCaregiverStateIntoOutput();
    const patientIdentity = patientOutput;
    const caregiverIdentity = caregiverOutput;
    const legacyPatientRead = vi
      .spyOn(fixture.medical, "readPatientRequest")
      .mockImplementation(() => {
        throw new Error("materializing readPatientRequest called");
      });
    const legacyCaregiverRead = vi
      .spyOn(fixture.medical, "readCaregiverState")
      .mockImplementation(() => {
        throw new Error("materializing readCaregiverState called");
      });

    fixture.medical.readPatientRequestInto(REQUEST_YAO_SPRAIN, patientOutput);
    expect(patientOutput).toEqual({
      ok: true,
      reason: undefined,
      ...legacyPatient,
      active: true,
      medicalStoreVersion: 2,
    });
    expect(patientOutput).toBe(patientIdentity);

    fixture.medical.readCaregiverStateInto(ACTOR_MIN, caregiverOutput);
    expect(caregiverOutput).toEqual({
      ok: true,
      reason: undefined,
      ...legacyCaregiver,
      medicalStoreVersion: 2,
    });
    expect(caregiverOutput).toBe(caregiverIdentity);
    expect(legacyPatientRead).not.toHaveBeenCalled();
    expect(legacyCaregiverRead).not.toHaveBeenCalled();

    fixture.medical.readPatientRequestInto(1, patientOutput);
    expect(patientOutput).toEqual({
      ok: false,
      reason: "medical.no_patient",
      requestId: 1,
      active: false,
      patientId: 0,
      conditionId: 0,
      regionId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      treatmentDefId: 0,
      stockDefId: 0,
      stockAmount: 0,
      targetCellIndex: 0,
      scoreMilli: 0,
      conditionVersion: 0,
      actorConditionVersion: 0,
      healthStoreVersion: 0,
      severity: 0,
      clueRef: 0,
      counterevidenceRef: 0,
      medicalStoreVersion: 2,
    });
    expect(patientOutput).toBe(patientIdentity);

    fixture.medical.readPatientRequestInto(-1, patientOutput);
    expect(patientOutput).toEqual({
      ok: false,
      reason: "medical.request_id_out_of_range",
      requestId: -1,
      active: false,
      patientId: 0,
      conditionId: 0,
      regionId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      treatmentDefId: 0,
      stockDefId: 0,
      stockAmount: 0,
      targetCellIndex: 0,
      scoreMilli: 0,
      conditionVersion: 0,
      actorConditionVersion: 0,
      healthStoreVersion: 0,
      severity: 0,
      clueRef: 0,
      counterevidenceRef: 0,
      medicalStoreVersion: 2,
    });
    expect(patientOutput).toBe(patientIdentity);

    fixture.medical.readCaregiverStateInto(1, caregiverOutput);
    expect(caregiverOutput).toEqual({
      ok: false,
      reason: "medical.rejected_caregiver_ability",
      caregiverId: 1,
      valid: false,
      regionId: 0,
      permissionId: 0,
      ability: 0,
      minimumValue: 0,
      allowed: false,
      abilityValue: 0,
      actorConditionVersion: 0,
      baseAbilityVersion: 0,
      medicalStoreVersion: 2,
    });
    expect(caregiverOutput).toBe(caregiverIdentity);

    fixture.medical.readCaregiverStateInto(-1, caregiverOutput);
    expect(caregiverOutput).toEqual({
      ok: false,
      reason: "medical.actor_out_of_range",
      caregiverId: -1,
      valid: false,
      regionId: 0,
      permissionId: 0,
      ability: 0,
      minimumValue: 0,
      allowed: false,
      abilityValue: 0,
      actorConditionVersion: 0,
      baseAbilityVersion: 0,
      medicalStoreVersion: 2,
    });
    expect(caregiverOutput).toBe(caregiverIdentity);
    expect(legacyPatientRead).not.toHaveBeenCalled();
    expect(legacyCaregiverRead).not.toHaveBeenCalled();
  });

  it("selects treatment offers from patient owner state and caregiver ability state", () => {
    const fixture = createMedicalFixture();
    const scratch = createSelectionScratch();

    expect(
      fixture.medical.upsertPatientRequestFromCondition(createRequest(), fixture.health),
    ).toMatchObject({ ok: true, reason: "medical.offer_created" });
    expect(
      fixture.medical.updateCaregiverStateFromAbility(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          permissionId: PERMISSION_CLINIC,
          ability: M3_ABILITY_MANIPULATION,
          minimumValue: 700,
          allowed: true,
        },
        fixture.health,
        fixture.abilities,
      ),
    ).toMatchObject({ ok: true });

    const selected = fixture.medical.selectTreatmentRequests(
      {
        caregiverId: ACTOR_MIN,
        regionId: REGION_CLINIC,
        urgencyBucket: URGENCY_HIGH,
        permissionId: PERMISSION_CLINIC,
        candidateCap: 24,
        maxSelectedRequests: 12,
      },
      fixture.health,
      scratch,
    );
    expect(selected).toMatchObject({
      ok: true,
      selectedCount: 1,
      bucketCandidateCount: 1,
      visitedCount: 1,
      scoredCount: 1,
      selectedRequestId: REQUEST_YAO_SPRAIN,
      reason: "medical.offer_created",
    });
    expect(fixture.medical.createMetrics()).toMatchObject({
      activePatientRequestCount: 1,
      caregiverStateCount: 1,
      selectionCount: 1,
      candidateVisitedCount: 1,
    });
  });

  it("stops medical offer traversal at candidateCap and reports a bounded cap hit", () => {
    const fixture = createMedicalFixture();
    for (let offset = 0; offset < 5; offset += 1) {
      const conditionId = CONDITION_YAO_SPRAIN + offset;
      if (offset > 0) {
        expect(fixture.health.addCondition(createSprain(conditionId))).toMatchObject({ ok: true });
      }
    }
    for (let offset = 0; offset < 5; offset += 1) {
      const conditionId = CONDITION_YAO_SPRAIN + offset;
      expect(
        fixture.medical.upsertPatientRequestFromCondition(
          createRequestFor(conditionId, offset, 100 + offset * 100),
          fixture.health,
        ),
      ).toMatchObject({ ok: true });
    }
    allowCaregiver(fixture);
    const scratch = createSelectionScratch();

    const selected = fixture.medical.selectTreatmentRequests(
      {
        caregiverId: ACTOR_MIN,
        regionId: REGION_CLINIC,
        urgencyBucket: URGENCY_HIGH,
        permissionId: PERMISSION_CLINIC,
        candidateCap: 2,
        maxSelectedRequests: 12,
      },
      fixture.health,
      scratch,
    );

    expect(selected).toMatchObject({
      ok: true,
      bucketCandidateCount: 2,
      visitedCount: 2,
      scoredCount: 2,
      rejectedByCandidateCap: 1,
      reason: "medical.candidate_cap_reached",
    });
    expect(fixture.medical.createMetrics()).toMatchObject({
      selectionCount: 1,
      candidateVisitedCount: 2,
      candidateCapHitCount: 1,
    });
  });

  it("progresses treatment through reservations pathing condition delta and cleanup", () => {
    const fixture = createReadyTreatmentFixture();
    const created = createTreatmentJob(fixture, 0);
    expect(created).toMatchObject({ ok: true, reason: "medical.treatment_created" });

    expect(
      fixture.treatments.reserve(
        0,
        10,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_reserved" });
    expect(fixture.ledger.activeCount).toBe(3);

    const path = createPath(fixture, 11);
    expect(
      fixture.treatments.startPathing(
        0,
        11,
        path,
        fixture.pathBasis,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_pathing" });
    expect(fixture.treatments.beginTreatment(0, 12, fixture.jobCore)).toMatchObject({
      ok: true,
      reason: "medical.treatment_started",
    });
    expect(
      fixture.treatments.tickTreatment(
        0,
        13,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.condition_delta_applied" });
    expect(
      fixture.treatments.tickTreatment(
        0,
        14,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_completed" });

    expect(fixture.health.readCondition(CONDITION_YAO_SPRAIN)).toMatchObject({
      severity: 260,
    });
    expect(fixture.items.readStack(STACK_BANDAGE)).toMatchObject({
      quantity: 2,
      availableQuantity: 2,
    });
    expect(fixture.ledger.activeCount).toBe(0);
    expect(fixture.treatments.readJob(0)).toMatchObject({
      step: "completed",
      deltaApplied: true,
      terminalReason: "medical.treatment_completed",
    });
    const completedCondition = readConditionOrThrow(fixture, CONDITION_YAO_SPRAIN);
    const completedJob = readTreatmentJobOrThrow(fixture, 0);
    expect(completedJob.conditionVersion).toBe(completedCondition.conditionVersion);
    expect(fixture.treatments.createMetrics()).toMatchObject({
      completedCount: 1,
      conditionDeltaCount: 1,
      stockConsumedCount: 1,
      reservationCleanupCount: 3,
    });

    expect(fixture.health.drainAbilityInvalidations(fixture.abilities, 8)).toBe(4);
    expect(
      fixture.abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, fixture.health, 1),
    ).toMatchObject({
      ok: true,
      value: 640,
      actorConditionVersion: 2,
      visitedConditionCount: 1,
    });
  });

  it("fails and cleans reserved treatment when completion basis changes", () => {
    const stalePatient = createReadyTreatmentFixture();
    startTreatingJob(stalePatient, 2);
    expect(
      stalePatient.treatments.tickTreatment(
        2,
        30,
        stalePatient.health,
        stalePatient.abilities,
        stalePatient.items,
        stalePatient.ledger,
        stalePatient.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      stalePatient.health.updateCondition({ conditionId: CONDITION_YAO_SPRAIN, severity: 410 }),
    ).toMatchObject({ ok: true });
    expect(
      stalePatient.treatments.tickTreatment(
        2,
        31,
        stalePatient.health,
        stalePatient.abilities,
        stalePatient.items,
        stalePatient.ledger,
        stalePatient.jobCore,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_stale_owner_state" });
    expect(stalePatient.ledger.activeCount).toBe(0);
    expect(stalePatient.items.readStack(STACK_BANDAGE)).toMatchObject({ quantity: 3 });
    expect(stalePatient.treatments.readJob(2)).toMatchObject({
      step: "failed",
      terminalReason: "medical.rejected_stale_owner_state",
    });

    const missingStock = createReadyTreatmentFixture();
    startTreatingJob(missingStock, 3);
    expect(
      missingStock.treatments.tickTreatment(
        3,
        40,
        missingStock.health,
        missingStock.abilities,
        missingStock.items,
        missingStock.ledger,
        missingStock.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(missingStock.items.removeQuantity(STACK_BANDAGE, 3, DEF_BANDAGE)).toMatchObject({
      ok: true,
    });
    expect(
      missingStock.treatments.tickTreatment(
        3,
        41,
        missingStock.health,
        missingStock.abilities,
        missingStock.items,
        missingStock.ledger,
        missingStock.jobCore,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_no_stock" });
    expect(missingStock.ledger.activeCount).toBe(0);
    expect(missingStock.treatments.readJob(3)).toMatchObject({
      step: "failed",
      terminalReason: "medical.rejected_no_stock",
    });

    const weakCaregiver = createReadyTreatmentFixture();
    startTreatingJob(weakCaregiver, 4);
    expect(
      weakCaregiver.treatments.tickTreatment(
        4,
        50,
        weakCaregiver.health,
        weakCaregiver.abilities,
        weakCaregiver.items,
        weakCaregiver.ledger,
        weakCaregiver.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(weakCaregiver.abilities.setBaseAbility(ACTOR_MIN, M3_ABILITY_MANIPULATION, 600)).toEqual(
      { ok: true },
    );
    expect(
      weakCaregiver.treatments.tickTreatment(
        4,
        51,
        weakCaregiver.health,
        weakCaregiver.abilities,
        weakCaregiver.items,
        weakCaregiver.ledger,
        weakCaregiver.jobCore,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_caregiver_ability" });
    expect(weakCaregiver.ledger.activeCount).toBe(0);
    expect(weakCaregiver.treatments.readJob(4)).toMatchObject({
      step: "failed",
      terminalReason: "medical.rejected_caregiver_ability",
    });
  });

  it("records updated condition row version separately from health store version", () => {
    const fixture = createVersionSkewTreatmentFixture();
    startTreatingJob(fixture, 5);
    expect(
      fixture.treatments.tickTreatment(
        5,
        60,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.treatments.tickTreatment(
        5,
        61,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_completed" });

    const condition = readConditionOrThrow(fixture, CONDITION_YAO_SPRAIN);
    const job = readTreatmentJobOrThrow(fixture, 5);
    expect(job.conditionVersion).toBe(condition.conditionVersion);
    expect(job.healthStoreVersion).toBe(fixture.health.storeVersion);
    expect(job.conditionVersion).not.toBe(job.healthStoreVersion);
  });

  it("cancels reserved treatment jobs without consuming stock or leaking reservations", () => {
    const fixture = createReadyTreatmentFixture();
    expect(createTreatmentJob(fixture, 1)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        1,
        20,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    expect(fixture.ledger.activeCount).toBe(3);

    expect(
      fixture.treatments.interrupt(1, "immediate", 21, fixture.ledger, fixture.jobCore),
    ).toEqual({
      ok: false,
      reason: "job.interruption_denied",
    });
    expect(fixture.ledger.activeCount).toBe(3);
    expect(fixture.treatments.cancel(1, 21, fixture.ledger, fixture.jobCore)).toMatchObject({
      ok: true,
      reason: "medical.interrupted_safe_point",
    });
    expect(fixture.ledger.activeCount).toBe(0);
    expect(fixture.items.readStack(STACK_BANDAGE)).toMatchObject({ quantity: 3 });
    expect(fixture.health.readCondition(CONDITION_YAO_SPRAIN)).toMatchObject({ severity: 420 });
    expect(fixture.treatments.readJob(1)).toMatchObject({
      step: "canceled",
      deltaApplied: false,
    });
  });

  it("distinguishes ability permission stock path reservation and stale owner-state failures", () => {
    const fixture = createReadyTreatmentFixture();
    const scratch = createSelectionScratch();

    expect(
      fixture.medical.updateCaregiverStateFromAbility(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          permissionId: PERMISSION_CLINIC,
          ability: M3_ABILITY_MANIPULATION,
          minimumValue: 950,
          allowed: true,
        },
        fixture.health,
        fixture.abilities,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_caregiver_ability" });

    expect(
      fixture.medical.updateCaregiverStateFromAbility(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          permissionId: PERMISSION_CLINIC,
          ability: M3_ABILITY_MANIPULATION,
          minimumValue: 700,
          allowed: false,
        },
        fixture.health,
        fixture.abilities,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_permission" });
    expect(
      fixture.medical.selectTreatmentRequests(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          urgencyBucket: URGENCY_HIGH,
          permissionId: PERMISSION_CLINIC,
          candidateCap: 24,
          maxSelectedRequests: 12,
        },
        fixture.health,
        scratch,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_permission" });

    allowCaregiver(fixture);
    expect(createTreatmentJob(fixture, 2, 99)).toEqual({
      ok: false,
      reason: "medical.rejected_no_stock",
    });
    expect(fixture.items.removeQuantity(STACK_BANDAGE, 3, DEF_BANDAGE)).toMatchObject({ ok: true });
    expect(createTreatmentJob(fixture, 2)).toEqual({
      ok: false,
      reason: "medical.rejected_no_stock",
    });
    expect(fixture.items.addQuantity(STACK_BANDAGE, 3, DEF_BANDAGE)).toMatchObject({ ok: true });

    expect(createTreatmentJob(fixture, 2)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        2,
        30,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const failedPath = createFailedPath(fixture, 31);
    expect(
      fixture.treatments.startPathing(
        2,
        31,
        failedPath,
        fixture.pathBasis,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toEqual({ ok: false, reason: "path.no_route_to_patient" });
    expect(fixture.ledger.activeCount).toBe(0);
    expect(fixture.treatments.readJob(2)).toMatchObject({
      step: "failed",
      terminalReason: "path.no_route_to_patient",
    });
    const restored = createM3TreatmentJobStore(8);
    expect(restored.restoreFromSnapshot(fixture.treatments.createSnapshot())).toMatchObject({
      ok: true,
    });
    expect(restored.readJob(2)).toMatchObject({
      step: "failed",
      terminalReason: "path.no_route_to_patient",
    });

    expect(createTreatmentJob(fixture, 3)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        3,
        40,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    expect(createTreatmentJob(fixture, 4)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        4,
        41,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_interaction_conflict" });
    expect(fixture.treatments.readJob(4)).toMatchObject({
      step: "failed",
      terminalReason: "reservation_interaction_conflict",
    });
    expect(fixture.treatments.cancel(3, 42, fixture.ledger, fixture.jobCore)).toMatchObject({
      ok: true,
    });
    expect(fixture.ledger.activeCount).toBe(0);

    expect(
      fixture.health.updateCondition({ conditionId: CONDITION_YAO_SPRAIN, severity: 300 }),
    ).toMatchObject({ ok: true });
    expect(createTreatmentJob(fixture, 5)).toEqual({
      ok: false,
      reason: "medical.rejected_stale_owner_state",
    });

    const stalePathFixture = createReadyTreatmentFixture();
    expect(createTreatmentJob(stalePathFixture, 6)).toMatchObject({ ok: true });
    expect(
      stalePathFixture.treatments.reserve(
        6,
        44,
        stalePathFixture.health,
        stalePathFixture.abilities,
        stalePathFixture.items,
        stalePathFixture.ledger,
        stalePathFixture.jobCore,
        stalePathFixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const stalePath = createPath(stalePathFixture, 45);
    const staleBasis = {
      mapVersion: stalePathFixture.pathBasis.mapVersion,
      navigationVersion: stalePathFixture.pathBasis.navigationVersion + 1,
      regionVersion: stalePathFixture.pathBasis.regionVersion,
      roomVersion: stalePathFixture.pathBasis.roomVersion,
      regionGraphVersion: stalePathFixture.pathBasis.regionGraphVersion,
    };
    expect(
      stalePathFixture.treatments.startPathing(
        6,
        45,
        stalePath,
        staleBasis,
        stalePathFixture.ledger,
        stalePathFixture.jobCore,
      ),
    ).toEqual({ ok: false, reason: "path.stale_basis" });
    expect(stalePathFixture.ledger.activeCount).toBe(0);
    expect(stalePathFixture.treatments.readJob(6)).toMatchObject({
      step: "failed",
      terminalReason: "path.stale_basis",
    });
  });
});

const ACTOR_YAO = 0;
const ACTOR_MIN = 2;
const ACTOR_SU = 5;
const REGION_CLINIC = 1;
const PERMISSION_CLINIC = 1;
const URGENCY_HIGH = 3;
const REQUEST_YAO_SPRAIN = 0;
const CONDITION_YAO_SPRAIN = 2;
const CONDITION_EXTRA = 7;
const DEF_LEFT_LEG_SPRAIN = 100;
const DEF_BANDAGE = 200;
const DEF_TREAT_SPRAIN = 300;
const BODY_PART_LEFT_LEG = 6;
const SOURCE_SPRAIN = 46;
const CLUE_LIMP = 10;
const COUNTER_NO_FEVER = 20;
const STACK_BANDAGE = 0;

interface MedicalFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly health: ReturnType<typeof createM3HealthConditionStore>;
  readonly abilities: ReturnType<typeof createM3AbilityCacheStore>;
  readonly medical: ReturnType<typeof createM3MedicalCareStore>;
  readonly treatments: ReturnType<typeof createM3TreatmentJobStore>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly jobCore: ReturnType<typeof createJobCoreStore>;
  readonly caregiver: EntityId;
  readonly patient: EntityId;
  readonly stock: EntityId;
  readonly grid: ReturnType<typeof createMapGrid>;
  readonly pathBasis: ReturnType<typeof createPathVersionBasis>;
}

type PatientRequestIntoOutput = Parameters<MedicalFixture["medical"]["readPatientRequestInto"]>[1];
type CaregiverStateIntoOutput = Parameters<MedicalFixture["medical"]["readCaregiverStateInto"]>[1];

function createPatientRequestIntoOutput(): PatientRequestIntoOutput {
  return {
    ok: true,
    reason: "medical.value_out_of_range",
    requestId: 99,
    active: true,
    patientId: 99,
    conditionId: 99,
    regionId: 99,
    urgencyBucket: 99,
    permissionId: 99,
    treatmentDefId: 99,
    stockDefId: 99,
    stockAmount: 99,
    targetCellIndex: 99,
    scoreMilli: 99,
    conditionVersion: 99,
    actorConditionVersion: 99,
    healthStoreVersion: 99,
    severity: 99,
    clueRef: 99,
    counterevidenceRef: 99,
    medicalStoreVersion: 99,
  };
}

function createCaregiverStateIntoOutput(): CaregiverStateIntoOutput {
  return {
    ok: true,
    reason: "medical.value_out_of_range",
    caregiverId: 99,
    valid: true,
    regionId: 99,
    permissionId: 99,
    ability: 99,
    minimumValue: 99,
    allowed: true,
    abilityValue: 99,
    actorConditionVersion: 99,
    baseAbilityVersion: 99,
    medicalStoreVersion: 99,
  };
}

function createMedicalFixture(): MedicalFixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const caregiver = mustAllocate(registry);
  const patient = mustAllocate(registry);
  const stock = mustAllocate(registry);
  const health = createM3HealthConditionStore({
    actorCapacity: 6,
    conditionCapacity: 8,
    abilityDirtyCapacity: 32,
  });
  const abilities = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 32 });
  expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, 900)).toEqual({ ok: true });
  expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_STAMINA, 760)).toEqual({ ok: true });
  expect(abilities.setBaseAbility(ACTOR_MIN, M3_ABILITY_MANIPULATION, 920)).toEqual({ ok: true });
  abilities.drainInvalidationBacklog(8);
  expect(health.addCondition(createSprain())).toMatchObject({ ok: true });
  const medical = createM3MedicalCareStore({
    requestCapacity: 8,
    actorCapacity: 6,
    regionCapacity: 4,
    urgencyBucketCount: 4,
    permissionCapacity: 4,
  });
  const treatments = createM3TreatmentJobStore(8);
  const items = createItemStackStore(4);
  expect(
    items.createStack({
      stackId: STACK_BANDAGE,
      entity: stock,
      defId: DEF_BANDAGE,
      quantity: 3,
      capacity: 3,
    }),
  ).toMatchObject({ ok: true });
  const ledger = createReservationLedger({ capacity: 32, entityCapacity: 16, cellCount: 16 });
  const jobCore = createJobCoreStore({ capacity: 8 });
  const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
  const pathBasis = createPathVersionBasis(grid, {
    navigationVersion: 0,
    regionVersion: 0,
    roomVersion: 0,
    regionGraphVersion: 0,
  });
  return {
    registry,
    health,
    abilities,
    medical,
    treatments,
    items,
    ledger,
    jobCore,
    caregiver,
    patient,
    stock,
    grid,
    pathBasis,
  };
}

function createReadyTreatmentFixture(): MedicalFixture {
  const fixture = createMedicalFixture();
  expect(
    fixture.medical.upsertPatientRequestFromCondition(createRequest(), fixture.health),
  ).toMatchObject({ ok: true });
  allowCaregiver(fixture);
  return fixture;
}

function createVersionSkewTreatmentFixture(): MedicalFixture {
  const fixture = createMedicalFixture();
  expect(fixture.health.addCondition(createSprain(CONDITION_EXTRA))).toMatchObject({ ok: true });
  expect(
    fixture.medical.upsertPatientRequestFromCondition(createRequest(), fixture.health),
  ).toMatchObject({ ok: true });
  allowCaregiver(fixture);
  return fixture;
}

function allowCaregiver(fixture: MedicalFixture): void {
  expect(
    fixture.medical.updateCaregiverStateFromAbility(
      {
        caregiverId: ACTOR_MIN,
        regionId: REGION_CLINIC,
        permissionId: PERMISSION_CLINIC,
        ability: M3_ABILITY_MANIPULATION,
        minimumValue: 700,
        allowed: true,
      },
      fixture.health,
      fixture.abilities,
    ),
  ).toMatchObject({ ok: true });
}

function startTreatingJob(fixture: MedicalFixture, jobId: number): void {
  expect(createTreatmentJob(fixture, jobId)).toMatchObject({ ok: true });
  expect(
    fixture.treatments.reserve(
      jobId,
      10 + jobId,
      fixture.health,
      fixture.abilities,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
      fixture.registry,
    ),
  ).toMatchObject({ ok: true });
  expect(
    fixture.treatments.startPathing(
      jobId,
      11 + jobId,
      createPath(fixture, 11 + jobId),
      fixture.pathBasis,
      fixture.ledger,
      fixture.jobCore,
    ),
  ).toMatchObject({ ok: true });
  expect(fixture.treatments.beginTreatment(jobId, 12 + jobId, fixture.jobCore)).toMatchObject({
    ok: true,
  });
}

function createTreatmentJob(
  fixture: MedicalFixture,
  jobId: number,
  stockStackId = STACK_BANDAGE,
): ReturnType<MedicalFixture["treatments"]["createJob"]> {
  return fixture.treatments.createJob(
    {
      jobId,
      caregiver: fixture.caregiver,
      caregiverActorId: ACTOR_MIN,
      requestId: REQUEST_YAO_SPRAIN,
      stockStackId,
      patientInteractionTarget: fixture.patient,
      patientInteractionSpotId: 7,
      treatmentCellIndex: 5,
      ability: M3_ABILITY_MANIPULATION,
      minimumAbilityValue: 700,
      treatmentTicks: 2,
      workPerTickQ16: 65_536,
      severityDelta: 160,
      createdTick: 0,
    },
    fixture.medical,
    fixture.health,
    fixture.abilities,
    fixture.items,
    fixture.jobCore,
    fixture.registry,
  );
}

function createPath(fixture: MedicalFixture, tick: number): PathSearchResult {
  return createGridPathfinder(fixture.grid.cellCount).findPath(fixture.grid, {
    requestSequence: tick,
    issuedTick: tick,
    startCellIndex: 0,
    goalCellIndex: 5,
    basis: fixture.pathBasis,
  });
}

function createFailedPath(fixture: MedicalFixture, tick: number): PathSearchResult {
  return {
    ok: false,
    requestSequence: tick,
    basis: fixture.pathBasis,
    startCellIndex: 0,
    goalCellIndex: 5,
    reason: "path_no_route",
    nodeExpansions: 0,
  };
}

function createSelectionScratch(): {
  readonly selectedRequestIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
} {
  const selectedRequestIds = new Uint32Array(12);
  selectedRequestIds.fill(M3_MEDICAL_NO_REQUEST);
  return {
    selectedRequestIds,
    selectedScoresMilli: new Int32Array(12),
  };
}

function readConditionOrThrow(
  fixture: MedicalFixture,
  conditionId: number,
): NonNullable<ReturnType<MedicalFixture["health"]["readCondition"]>> {
  const condition = fixture.health.readCondition(conditionId);
  if (condition === undefined) {
    throw new Error(`missing condition ${String(conditionId)}`);
  }
  return condition;
}

function readTreatmentJobOrThrow(
  fixture: MedicalFixture,
  jobId: number,
): NonNullable<ReturnType<MedicalFixture["treatments"]["readJob"]>> {
  const job = fixture.treatments.readJob(jobId);
  if (job === undefined) {
    throw new Error(`missing treatment job ${String(jobId)}`);
  }
  return job;
}

function createSprain(conditionId = CONDITION_YAO_SPRAIN): M3HealthConditionInput {
  return {
    conditionId,
    actorId: conditionId === CONDITION_EXTRA ? ACTOR_SU : ACTOR_YAO,
    defId: DEF_LEFT_LEG_SPRAIN,
    kind: M3_HEALTH_CONDITION_KIND_INJURY,
    bodyPart: BODY_PART_LEFT_LEG,
    severity: 420,
    ageTicks: 0,
    sourceId: SOURCE_SPRAIN,
    componentFlags: 0,
    clueRef: CLUE_LIMP,
    counterevidenceRef: COUNTER_NO_FEVER,
    terminalState: M3_HEALTH_CONDITION_ACTIVE,
    affectedAbilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT, M3_ABILITY_STAMINA]),
  };
}

function createRequest(): M3MedicalPatientRequestInput {
  return createRequestFor(CONDITION_YAO_SPRAIN, REQUEST_YAO_SPRAIN, 900);
}

function createRequestFor(
  conditionId: number,
  requestId: number,
  scoreMilli: number,
): M3MedicalPatientRequestInput {
  return {
    requestId,
    patientId: ACTOR_YAO,
    conditionId,
    regionId: REGION_CLINIC,
    urgencyBucket: URGENCY_HIGH,
    permissionId: PERMISSION_CLINIC,
    treatmentDefId: DEF_TREAT_SPRAIN,
    stockDefId: DEF_BANDAGE,
    stockAmount: 1,
    targetCellIndex: 5,
    scoreMilli,
  };
}

function mustAllocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const allocated = registry.allocate();
  if (!allocated.ok) {
    throw new Error("test registry capacity exhausted");
  }
  return allocated.entity;
}
