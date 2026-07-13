import * as ts from "typescript";
import { expect, it, vi } from "vitest";

import {
  AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED,
  AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
  AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED,
  AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED,
  AUTONOMY_REASON_FAILED_INVARIANT,
  AUTONOMY_REASON_IDLE_RETRY_BACKOFF,
  AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER,
  AUTONOMY_REASON_IDLE_OFF_SHIFT,
  AUTONOMY_REASON_INTERRUPTED_DANGER,
  AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
  AUTONOMY_REASON_NONE,
  AUTONOMY_REASON_OFFER_EMPTY_BUCKET,
  AUTONOMY_REASON_OFFER_SELECTED,
  AUTONOMY_REASON_OFFER_STALE_OWNER,
  AUTONOMY_REASON_PATH_NO_ROUTE,
  AUTONOMY_REASON_REF_NONE,
  AUTONOMY_REASON_RESERVATION_ACQUIRED,
  AUTONOMY_REASON_RESERVATION_INSUFFICIENT_AMOUNT,
  AUTONOMY_REASON_SOURCE_CAPABILITY,
  AUTONOMY_REASON_SOURCE_IDLE,
  AUTONOMY_REASON_SOURCE_NEED,
  AUTONOMY_REASON_SOURCE_NONE,
  AUTONOMY_REASON_SOURCE_OFFER,
  AUTONOMY_REASON_SOURCE_PATH,
  AUTONOMY_REASON_SOURCE_RESERVATION,
  AUTONOMY_REASON_SOURCE_SCHEDULE,
  AUTONOMY_REASON_SOURCE_SYSTEM,
  AUTONOMY_SUGGESTION_INSPECT_CAPABILITY,
  AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
  AUTONOMY_SUGGESTION_INSPECT_RESOURCE,
  AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
  AUTONOMY_SUGGESTION_INSPECT_TARGET,
  AUTONOMY_SUGGESTION_NONE,
  isValidAutonomyReason,
  resetAutonomyReason,
  writeAutonomyReason,
  type AutonomyReasonCode,
  type AutonomyReasonOutput,
  type AutonomyReasonSource,
  type AutonomySuggestion,
} from "./game-session-autonomy-reasons";
import { ResidentAutonomyStore } from "./game-session-autonomy-store";
import { isLegalAutonomyTransition } from "./game-session-autonomy-store";
import {
  AUTONOMY_ORDINARY_MAX_BUCKETS,
  AUTONOMY_REAL_SOURCE_COUNT,
  AUTONOMY_SCHEDULE_CODE_COUNT,
  ResidentAutonomyCoordinator,
  bindAutonomyClaimSlotInto,
  createAutonomyDecisionPolicy,
  hasValidAutonomyClaimPlanAliases,
  resetAutonomyClaimPlanInto,
  type AutonomyClaimPlanIntoOutput,
  type AutonomyClaimSlotScratch,
  type AutonomyClaimSlotScratchTuple,
  type AutonomyDecisionOutput,
  type AutonomyDecisionMetricsOutput,
  type AutonomyDecisionPolicyInput,
  type AutonomyDecisionRequest,
  type AutonomyDecisionScratch,
  type AutonomyGlobalRetainedLanes,
  type AutonomyCandidateLane,
  type AutonomyJobFactsLane,
  type AutonomyPathBasisLane,
  type AutonomyScheduleFactsLane,
  type AutonomyWakeFactsLane,
  type ResidentAutonomyCoordinatorDependencies,
} from "./game-session-autonomy-selection";
import {
  AUTONOMY_CANDIDATE_SOURCE_NONE,
  AUTONOMY_CANDIDATE_SOURCE_FOOD,
  AUTONOMY_CANDIDATE_SOURCE_MEDICAL,
  AUTONOMY_CANDIDATE_SOURCE_ORDINARY,
  AUTONOMY_CANDIDATE_SOURCE_REST,
  AUTONOMY_CANDIDATE_SOURCE_WAIT,
  AUTONOMY_DECISION_DEFERRED,
  AUTONOMY_DECISION_FAILED,
  AUTONOMY_DECISION_INTERRUPTION_REQUESTED,
  AUTONOMY_DECISION_KEEP_WORKING,
  AUTONOMY_DECISION_WAIT,
  AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
  AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE,
  AUTONOMY_INTERRUPTION_POLICY_NONE,
  AUTONOMY_MAX_CLAIM_REFS,
  AUTONOMY_MAX_EXACT_PATHS,
  AUTONOMY_MAX_RETAINED_CANDIDATES,
  AUTONOMY_MAX_ROUTE_CELLS,
  AUTONOMY_MAX_VISITED_CANDIDATES,
  AUTONOMY_REF_NONE,
  AUTONOMY_STATE_BLOCKED,
  AUTONOMY_STATE_CLAIMING,
  AUTONOMY_STATE_COMPLETED,
  AUTONOMY_STATE_FAILED,
  AUTONOMY_STATE_IDLE,
  AUTONOMY_STATE_INTERRUPTED,
  AUTONOMY_STATE_MOVING,
  AUTONOMY_STATE_WORKING,
  AUTONOMY_STORE_BASIS_INVALID,
  AUTONOMY_STORE_CLAIM_CAPACITY,
  AUTONOMY_STORE_ILLEGAL_TRANSITION,
  AUTONOMY_STORE_OK,
  AUTONOMY_STORE_REFERENCE_INVALID,
  AUTONOMY_STORE_REASON_INVALID,
  AUTONOMY_STORE_ROUTE_CAPACITY,
  AUTONOMY_STORE_SNAPSHOT_SHAPE,
  AUTONOMY_STORE_SNAPSHOT_STATE,
  AUTONOMY_STORE_SNAPSHOT_VERSION,
  AUTONOMY_STORE_TICK_INVALID,
  AUTONOMY_STORE_VERSION_EXHAUSTED,
  AutonomySnapshotLane,
  AutonomySnapshotReasonParameterLane,
  AutonomySnapshotTickLane,
  type AutonomyState,
  type AutonomyStoreCode,
  type AutonomyStoreOutput,
  type AutonomyTerminalOutput,
  type AutonomyTransitionInput,
  type AutonomyVersionBasis,
  type ResidentAutonomyReadOutput,
  type ResidentAutonomySnapshot,
} from "./game-session-autonomy-types";
import { createEntityRegistry } from "./entity-id";
import { createM3FoodAvailabilityStore } from "./m3-food";
import {
  M3_ABILITY_COMMUNICATION,
  M3_ABILITY_MANIPULATION,
  M3_ABILITY_MOVEMENT,
  M3_ABILITY_STAMINA,
  createM3AbilityCacheStore,
  createM3HealthConditionStore,
  type M3AbilityQueryIntoOutput,
} from "./m3-health";
import { createM3MedicalCareStore } from "./m3-medical-care";
import { NEED_LANE_SAFETY, createNeedStore } from "./m3-needs";
import { createRestCandidateIndex, createRestSleepStore } from "./m3-rest-sleep";
import { MAP_TERRAIN_BLOCKED, createMapGrid } from "./map-grid";
import { createGridPathfinder, type PathRequest, type PathSearchIntoOutput } from "./pathing";
import {
  createReservationLedger,
  type ReservationAcquireIntoOutput,
  type ReservationAcquireIntoScratch,
  type ReservationTransactionRequest,
} from "./reservation-ledger";
import {
  createWorkOfferIndex,
  type WorkOfferMutationIntoOutput,
  type WorkOfferReadIntoOutput,
  type WorkOfferSelectionIntoOutput,
  type WorkOfferSelectionIntoScratch,
} from "./work-offers";

interface ReasonCase {
  readonly code: AutonomyReasonCode;
  readonly source: AutonomyReasonSource;
  readonly suggestion: AutonomySuggestion;
}

it("validates bounded numeric structured reason families without prose", () => {
  const reason = createReason();
  const identity = reason;
  const cases: readonly ReasonCase[] = [
    {
      code: AUTONOMY_REASON_IDLE_OFF_SHIFT,
      source: AUTONOMY_REASON_SOURCE_IDLE,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    },
    {
      code: AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
      source: AUTONOMY_REASON_SOURCE_NEED,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESOURCE,
    },
    {
      code: AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
      source: AUTONOMY_REASON_SOURCE_CAPABILITY,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_CAPABILITY,
    },
    {
      code: AUTONOMY_REASON_OFFER_EMPTY_BUCKET,
      source: AUTONOMY_REASON_SOURCE_OFFER,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_TARGET,
    },
    {
      code: AUTONOMY_REASON_PATH_NO_ROUTE,
      source: AUTONOMY_REASON_SOURCE_PATH,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_TARGET,
    },
    {
      code: AUTONOMY_REASON_RESERVATION_INSUFFICIENT_AMOUNT,
      source: AUTONOMY_REASON_SOURCE_RESERVATION,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESOURCE,
    },
    {
      code: AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED,
      source: AUTONOMY_REASON_SOURCE_SCHEDULE,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    },
    {
      code: AUTONOMY_REASON_FAILED_INVARIANT,
      source: AUTONOMY_REASON_SOURCE_SYSTEM,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    },
    {
      code: AUTONOMY_REASON_INTERRUPTED_DANGER,
      source: AUTONOMY_REASON_SOURCE_SYSTEM,
      suggestion: AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    },
  ];

  for (const entry of cases) {
    writeAutonomyReason(
      reason,
      entry.code,
      entry.source,
      0,
      1,
      AUTONOMY_REASON_REF_NONE,
      AUTONOMY_REASON_REF_NONE,
      6,
      0xffff_ffff,
      entry.suggestion,
      -0x8000_0000,
      0x7fff_ffff,
      -1,
      0,
      1,
      17,
    );
    expect(reason).toBe(identity);
    expect(isValidAutonomyReason(reason), `reason code ${String(entry.code)}`).toBe(true);
  }

  expect("message" in reason).toBe(false);
  expect("prose" in reason).toBe(false);
  expect("text" in reason).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_FAILED_INVARIANT,
    AUTONOMY_REASON_SOURCE_SYSTEM,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    7,
    1,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    1,
    2,
    3,
    4,
    5,
    6,
  );
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_IDLE_OFF_SHIFT,
    AUTONOMY_REASON_SOURCE_IDLE,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    2,
    1,
    AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    -2,
    3,
    99,
    99,
    99,
    99,
  );
  expect(reason.parameter2).toBe(0);
  reason.parameter5 = 1;
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_IDLE_OFF_SHIFT,
    AUTONOMY_REASON_SOURCE_NEED,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    1,
    AUTONOMY_SUGGESTION_INSPECT_SCHEDULE,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
    AUTONOMY_REASON_SOURCE_NEED,
    AUTONOMY_REASON_REF_NONE,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    1,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  expect(isValidAutonomyReason(reason)).toBe(false);

  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_NEED_HUNGER_EMERGENCY,
    AUTONOMY_REASON_SOURCE_NEED,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    1,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  Reflect.set(reason, "suggestion", 6);
  expect(isValidAutonomyReason(reason)).toBe(false);

  resetAutonomyReason(reason);
  expect(reason).toBe(identity);
  expect(reason).toEqual(createReason());
  expect(isValidAutonomyReason(reason)).toBe(true);
});

it("validates and defensively copies the construction-only autonomy policy", () => {
  const input = createDecisionPolicyInput();
  const policy = createAutonomyDecisionPolicy(input);
  const originalFoodDef = policy.foodDefIds[0];
  const originalWorkType = policy.ordinaryWorkTypes[0];
  const originalClass = policy.residentPolicyClassIds[0];

  input.foodDefIds[0] = 999;
  input.ordinaryWorkTypes[0] = 31;
  input.residentPolicyClassIds[0] = 1;
  expect(policy.foodDefIds[0]).toBe(originalFoodDef);
  expect(policy.ordinaryWorkTypes[0]).toBe(originalWorkType);
  expect(policy.residentPolicyClassIds[0]).toBe(originalClass);

  const invalidCount = createDecisionPolicyInput();
  invalidCount.ordinaryDescriptorCounts[0] = AUTONOMY_ORDINARY_MAX_BUCKETS + 1;
  expect(() => createAutonomyDecisionPolicy(invalidCount)).toThrow(RangeError);

  const invalidAliasLength = createDecisionPolicyInput();
  Reflect.set(invalidAliasLength, "sourceEnabledFlags", new Uint8Array(1));
  expect(() => createAutonomyDecisionPolicy(invalidAliasLength)).toThrow(RangeError);

  const overflow = createDecisionPolicyInput();
  overflow.sourceDistanceWeights[0] = 0xffff_ffff;
  Reflect.set(overflow, "maximumManhattanDistance", Number.MAX_SAFE_INTEGER);
  expect(() => createAutonomyDecisionPolicy(overflow)).toThrow(RangeError);
});

it("runs the read-only ordinary owner through raw Top-12, one full score per row, and exact path", () => {
  const fixture = createCoordinatorFixture(12);
  const scratch = createDecisionScratch();
  const output = createDecisionOutput();
  const autonomyBefore = fixture.dependencies.autonomyStore.createSnapshot();
  const reservationBefore = fixture.dependencies.reservations.createSnapshot();
  const retainedIdentity = scratch.globalRetained.candidateIds;
  const routeIdentity = scratch.selectedRouteCells;

  fixture.coordinator.decideInto(
    {
      tick: 0,
      residentIndex: 0,
      residentGeneration: 1,
      originCellIndex: 0,
      originRegionId: 0,
      requestSequenceStart: 77,
      maxNodeExpansions: 64,
    },
    scratch,
    output,
  );

  expect(output).toMatchObject({
    ok: true,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_ORDINARY,
    visitedCount: 12,
    retainedCount: 12,
    scoredCount: 12,
    selectedCount: 1,
    exactPathCount: 1,
  });
  expect(scratch.globalRetained.scoreInvocationCounts.slice(0, 12)).toEqual(
    new Uint8Array(12).fill(1),
  );
  expect(scratch.needValues).toEqual(new Uint16Array([500, 500, 500, 500, 500]));
  for (const version of scratch.needOwnerVersions) expect(version).toBeGreaterThan(0);
  expect(scratch.globalRetained.candidateIds).toBe(retainedIdentity);
  expect(scratch.selectedRouteCells).toBe(routeIdentity);
  expect(scratch.selectedRouteCells[output.routeCellCount]).toBe(AUTONOMY_REF_NONE);
  expect(fixture.dependencies.autonomyStore.createSnapshot()).toEqual(autonomyBefore);
  expect(fixture.dependencies.reservations.createSnapshot()).toEqual(reservationBefore);
  expect(fixture.claimPlanReadCount.value).toBe(0);
});

it("documents the raw Top-12 approximation and enforces N=1..4 shared source quotas", () => {
  const approximation = createCoordinatorFixture(12, 12, 2);
  const approximationScratch = createDecisionScratch();
  const approximationOutput = createDecisionOutput();
  approximation.coordinator.decideInto(
    createDecisionRequest(0, 90),
    approximationScratch,
    approximationOutput,
  );
  expect(approximationOutput).toMatchObject({
    ok: true,
    visitedCount: 24,
    retainedCount: 12,
    scoredCount: 12,
    approximationDropCount: 12,
  });
  expect(approximationScratch.globalRetained.sourceCodes).toEqual(new Uint8Array(12).fill(2));
  expect(approximationScratch.globalRetained.scoreInvocationCounts).toEqual(
    new Uint8Array(12).fill(1),
  );
  expect(approximationScratch.ordinaryOutput.selectedCount).toBe(12);
  expect(approximationScratch.globalRetained.candidateIds.includes(0)).toBe(true);
  expect(
    containsUint8Value(
      approximationScratch.globalRetained.sourceCodes,
      AUTONOMY_CANDIDATE_SOURCE_ORDINARY,
    ),
  ).toBe(false);
  const droppedOrdinaryWouldScore = 10_000 - 0 + 200 + 500 + 20 + 1_000;
  expect(droppedOrdinaryWouldScore).toBeGreaterThan(
    approximationScratch.globalRetained.commonScores[0] ?? Number.MAX_SAFE_INTEGER,
  );

  for (let enabled = 1; enabled <= 4; enabled += 1) {
    const fixture = createCoordinatorFixture(12, 12, enabled);
    const scratch = createDecisionScratch();
    const output = createDecisionOutput();
    fixture.coordinator.decideInto(createDecisionRequest(0, 100 + enabled), scratch, output);
    const expectedQuota = enabled <= 2 ? 12 : enabled === 3 ? 8 : 6;
    expect(
      scratch.ordinaryOptions.candidateCap,
      `enabled=${String(enabled)} reason=${String(output.reasonCode)} medical=${String(scratch.medicalOutput.reason)}`,
    ).toBe(expectedQuota);
    if (enabled >= 2) expect(scratch.restQuery.candidateCap).toBe(expectedQuota);
    if (enabled >= 3) expect(scratch.foodQuery.candidateCap).toBe(expectedQuota);
    if (enabled >= 4) expect(scratch.medicalOptions.candidateCap).toBe(expectedQuota);
    expect(scratch.globalBudget.visitedCount).toBeLessThanOrEqual(AUTONOMY_MAX_VISITED_CANDIDATES);
    expect(scratch.globalRetained.count).toBeLessThanOrEqual(AUTONOMY_MAX_RETAINED_CANDIDATES);
    expect(sumUint8(scratch.globalRetained.scoreInvocationCounts)).toBe(
      scratch.globalRetained.count,
    );
  }
});

it("reorders retained raw candidates by candidate-specific common distance with stable row ties", () => {
  const fixture = createCoordinatorFixture(0, 0, 1, 1, true, 1_000);
  const mutation = createOfferMutationOutputForAutonomy();
  fixture.dependencies.workOffers.registerOfferInto(
    {
      offerId: 0,
      workType: 0,
      regionId: 0,
      defId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      targetId: 30,
      targetCellIndex: 15,
      scoreMilli: 10_000,
      ownerVersion: 1,
    },
    mutation,
  );
  expect(mutation.ok).toBe(true);
  fixture.dependencies.workOffers.registerOfferInto(
    {
      offerId: 1,
      workType: 0,
      regionId: 0,
      defId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      targetId: 31,
      targetCellIndex: 1,
      scoreMilli: 9_999,
      ownerVersion: 1,
    },
    mutation,
  );
  expect(mutation.ok).toBe(true);
  const scratch = createDecisionScratch();
  const output = createDecisionOutput();
  fixture.coordinator.decideInto(createDecisionRequest(0, 95), scratch, output);
  expect(output.candidateId).toBe(1);
  expect(scratch.globalRetained.rawScores[0]).toBeLessThan(
    scratch.globalRetained.rawScores[1] ?? 0,
  );
  expect(scratch.globalRetained.commonScores[0]).toBeGreaterThan(
    scratch.globalRetained.commonScores[1] ?? Number.MAX_SAFE_INTEGER,
  );

  const tie = createCoordinatorFixture(0);
  tie.dependencies.workOffers.registerOfferInto(
    {
      offerId: 5,
      workType: 0,
      regionId: 0,
      defId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      targetId: 40,
      targetCellIndex: 1,
      scoreMilli: 1_000,
      ownerVersion: 1,
    },
    mutation,
  );
  tie.dependencies.workOffers.registerOfferInto(
    {
      offerId: 2,
      workType: 0,
      regionId: 0,
      defId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      targetId: 41,
      targetCellIndex: 1,
      scoreMilli: 1_000,
      ownerVersion: 1,
    },
    mutation,
  );
  const tieOutput = createDecisionOutput();
  tie.coordinator.decideInto(createDecisionRequest(0, 96), createDecisionScratch(), tieOutput);
  expect(tieOutput.candidateId).toBe(2);
});

it("rotates all eight ordinary hauling and lamp descriptors without request-sequence influence", () => {
  const fixture = createCoordinatorFixture(0, 0, 1, AUTONOMY_ORDINARY_MAX_BUCKETS);
  const mutation = createOfferMutationOutputForAutonomy();
  for (let descriptor = 0; descriptor < AUTONOMY_ORDINARY_MAX_BUCKETS; descriptor += 1) {
    fixture.dependencies.workOffers.registerOfferInto(
      {
        offerId: descriptor,
        workType: descriptor % 2,
        regionId: 0,
        defId: Math.floor(descriptor / 2) % 2,
        urgencyBucket: Math.floor(descriptor / 4) % 2,
        permissionId: 0,
        targetId: 20 + descriptor,
        targetCellIndex: descriptor + 1,
        scoreMilli: 1_000 + descriptor,
        ownerVersion: 1,
      },
      mutation,
    );
    expect(mutation.ok).toBe(true);
  }
  fixture.dependencies.scheduleFacts.allowedWorkTypeMasks[0] = 3;

  const firstScratch = createDecisionScratch();
  const firstOutput = createDecisionOutput();
  fixture.coordinator.decideInto(createDecisionRequest(0, 1), firstScratch, firstOutput);
  const repeatedScratch = createDecisionScratch();
  const repeatedOutput = createDecisionOutput();
  fixture.coordinator.decideInto(
    createDecisionRequest(0, 999_999),
    repeatedScratch,
    repeatedOutput,
  );
  expect(firstOutput.candidateId).toBe(0);
  expect(repeatedOutput.candidateId).toBe(0);
  expect(repeatedScratch.ordinaryOptions.workType).toBe(firstScratch.ordinaryOptions.workType);

  const seen = new Uint8Array(AUTONOMY_ORDINARY_MAX_BUCKETS);
  seen[0] = 1;
  let haulingQueries = firstScratch.ordinaryOptions.workType === 0 ? 1 : 0;
  let lampQueries = firstScratch.ordinaryOptions.workType === 1 ? 1 : 0;
  for (let descriptor = 1; descriptor < AUTONOMY_ORDINARY_MAX_BUCKETS; descriptor += 1) {
    const tick = descriptor * 30;
    setCoordinatorFactTick(fixture.dependencies, tick);
    const scratch = createDecisionScratch();
    const output = createDecisionOutput();
    fixture.coordinator.decideInto(
      createDecisionRequest(tick, 1_000 + descriptor),
      scratch,
      output,
    );
    expect(output.candidateId).toBe(descriptor);
    seen[descriptor] = 1;
    if (scratch.ordinaryOptions.workType === 0) haulingQueries += 1;
    else lampQueries += 1;
  }
  expect(seen).toEqual(new Uint8Array(AUTONOMY_ORDINARY_MAX_BUCKETS).fill(1));
  expect(haulingQueries).toBe(4);
  expect(lampQueries).toBe(4);
});

it("fails stale schedule, job, generation, and inactive-Need pregates before owner ingress", () => {
  const staleSchedule = createCoordinatorFixture(12);
  Reflect.set(staleSchedule.dependencies.scheduleFacts, "sourceTick", 1);
  expectPregateFailure(staleSchedule, 0);
  expectCoordinatorMetric(staleSchedule, "staleScheduleCount", 1);

  const staleJob = createCoordinatorFixture(12);
  Reflect.set(staleJob.dependencies.jobFacts, "sourceTick", 1);
  expectPregateFailure(staleJob, 0);
  expectCoordinatorMetric(staleJob, "staleJobCount", 1);

  const staleGeneration = createCoordinatorFixture(12);
  staleGeneration.dependencies.wakeFacts.residentGenerations[0] = 2;
  expectPregateFailure(staleGeneration, 0);
  expectCoordinatorMetric(staleGeneration, "staleScheduleCount", 1);

  const invalidScheduleCode = createCoordinatorFixture(12);
  invalidScheduleCode.dependencies.scheduleFacts.scheduleCodes[0] = 4;
  expectPregateFailure(invalidScheduleCode, 0);
  expectCoordinatorMetric(invalidScheduleCode, "staleScheduleCount", 1);

  const invalidPermission = createCoordinatorFixture(12);
  invalidPermission.dependencies.scheduleFacts.permissionIds[0] = 2;
  expectPregateFailure(invalidPermission, 0);
  expectCoordinatorMetric(invalidPermission, "staleScheduleCount", 1);

  const inactiveNeed = createCoordinatorFixture(12, 0, 1, 1, false);
  const scratch = createDecisionScratch();
  const output = createDecisionOutput();
  inactiveNeed.coordinator.decideInto(createDecisionRequest(0, 5), scratch, output);
  expect(output).toMatchObject({
    ok: false,
    decisionKind: AUTONOMY_DECISION_FAILED,
    visitedCount: 0,
    retainedCount: 0,
    scoredCount: 0,
  });
  expect(scratch.ordinaryOptions.candidateCap).toBe(1);
  expectCoordinatorMetric(inactiveNeed, "staleNeedCount", 1);

  const staleCandidate = createCoordinatorFixture(12);
  const staleCandidateOutput = createDecisionOutput();
  staleCandidate.coordinator.decideInto(
    { ...createDecisionRequest(0, 6), residentGeneration: 2 },
    createDecisionScratch(),
    staleCandidateOutput,
  );
  expect(staleCandidateOutput).toMatchObject({
    ok: false,
    decisionKind: AUTONOMY_DECISION_FAILED,
    visitedCount: 0,
  });
  expectCoordinatorMetric(staleCandidate, "staleCandidateCount", 1);

  const malformedScratch = createCoordinatorFixture(12);
  const invalidScratch = createDecisionScratch();
  invalidScratch.globalBudget.visitedCap = 0;
  malformedScratch.coordinator.decideInto(
    createDecisionRequest(0, 7),
    invalidScratch,
    createDecisionOutput(),
  );
  expectCoordinatorMetric(malformedScratch, "staleCandidateCount", 1);

  const staleCapability = createCoordinatorFixture(12);
  const abilitySpy = vi
    .spyOn(staleCapability.dependencies.abilities, "queryAbilityInto")
    .mockImplementation((actorId, ability, _health, threshold, output) => {
      output.ok = false;
      output.reason = "ability.cache_stale_basis";
      output.actorId = actorId;
      output.ability = ability;
      output.threshold = threshold;
    });
  expectPregateFailure(staleCapability, 0);
  expectCoordinatorMetric(staleCapability, "staleCapabilityCount", 1);
  abilitySpy.mockRestore();
});

it("preserves actual budget when the second or third enabled source becomes stale", () => {
  const cases = [
    { mask: 10, enabled: 2, restCount: 12, staleVisited: 3, visited: 15, ingress: 12 },
    { mask: 11, enabled: 3, restCount: 12, staleVisited: 4, visited: 12, ingress: 8 },
  ] as const;
  for (const [index, scenario] of cases.entries()) {
    const fixture = createCoordinatorFixture(
      0,
      scenario.restCount,
      scenario.enabled,
      1,
      true,
      0,
      scenario.mask,
    );
    const ownerSpy = vi
      .spyOn(fixture.dependencies.workOffers, "selectTopOffersInto")
      .mockImplementation((_options, _scratch, output) => {
        output.ok = false;
        output.reason = "work_offer_row_version_mismatch";
        output.visitedCount = scenario.staleVisited;
        output.selectedCount = 0;
      });
    const output = createDecisionOutput();
    fixture.coordinator.decideInto(
      createDecisionRequest(0, 200 + index),
      createDecisionScratch(),
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      decisionKind: AUTONOMY_DECISION_FAILED,
      reasonCode: AUTONOMY_REASON_OFFER_STALE_OWNER,
      visitedCount: scenario.visited,
      ingressCount: scenario.ingress,
      retainedCount: scenario.ingress,
      scoredCount: 0,
      selectedCount: 0,
      exactPathCount: 0,
      nodeExpansions: 0,
    });
    const metrics = createDecisionMetricsOutput();
    fixture.coordinator.readMetricsInto(metrics);
    expect(metrics).toMatchObject({
      failedCount: 1,
      visitedCount: scenario.visited,
      ingressCount: scenario.ingress,
      retainedCount: scenario.ingress,
      scoredCount: 0,
      selectedCount: 0,
      exactPathCount: 0,
      nodeExpansionCount: 0,
      staleCandidateCount: 1,
      lastReasonCode: AUTONOMY_REASON_OFFER_STALE_OWNER,
    });
    ownerSpy.mockRestore();
  }
});

it("applies hard safety, movement, source ability, permission, and empty-owner semantics", () => {
  const movementDenied = createCoordinatorFixture(12);
  expect(movementDenied.dependencies.abilities.setBaseAbility(0, M3_ABILITY_MOVEMENT, 0)).toEqual({
    ok: true,
  });
  expectPregateFailure(movementDenied, 0);

  const ordinaryAbilityDenied = createCoordinatorFixture(12);
  expect(
    ordinaryAbilityDenied.dependencies.abilities.setBaseAbility(0, M3_ABILITY_MANIPULATION, 0),
  ).toEqual({ ok: true });
  const abilityScratch = createDecisionScratch();
  const abilityOutput = createDecisionOutput();
  ordinaryAbilityDenied.coordinator.decideInto(
    createDecisionRequest(0, 6),
    abilityScratch,
    abilityOutput,
  );
  expect(abilityOutput).toMatchObject({
    ok: true,
    decisionKind: AUTONOMY_DECISION_WAIT,
    visitedCount: 0,
    retainedCount: 0,
    scoredCount: 0,
    exactPathCount: 0,
  });

  const safetyEmergency = createCoordinatorFixture(12);
  expect(
    safetyEmergency.dependencies.needs.setLane(
      { actorId: 0, lane: NEED_LANE_SAFETY, tick: 0, reason: "need.manual_set" },
      50,
    ),
  ).toMatchObject({ ok: true });
  const safetyScratch = createDecisionScratch();
  const safetyOutput = createDecisionOutput();
  safetyEmergency.coordinator.decideInto(createDecisionRequest(0, 7), safetyScratch, safetyOutput);
  expect(safetyOutput).toMatchObject({
    ok: true,
    decisionKind: AUTONOMY_DECISION_WAIT,
    visitedCount: 0,
    selectedCount: 0,
  });
  expect(safetyScratch.needValues[NEED_LANE_SAFETY]).toBe(50);

  const permissionDenied = createCoordinatorFixture(12);
  permissionDenied.dependencies.scheduleFacts.allowedWorkTypeMasks[0] = 0;
  const permissionOutput = createDecisionOutput();
  permissionDenied.coordinator.decideInto(
    createDecisionRequest(0, 8),
    createDecisionScratch(),
    permissionOutput,
  );
  expect(permissionOutput).toMatchObject({
    ok: true,
    decisionKind: AUTONOMY_DECISION_WAIT,
    visitedCount: 0,
  });

  const empty = createCoordinatorFixture(0);
  const emptyOutput = createDecisionOutput();
  empty.coordinator.decideInto(createDecisionRequest(0, 9), createDecisionScratch(), emptyOutput);
  expect(emptyOutput).toMatchObject({
    ok: true,
    decisionKind: AUTONOMY_DECISION_WAIT,
    visitedCount: 0,
    retainedCount: 0,
    scoredCount: 0,
    selectedCount: 0,
    exactPathCount: 0,
  });
});

it("preserves causal source denials with fixed priority and distinguishes true indexed emptiness", () => {
  const denialCases = [
    { mask: 1, ability: M3_ABILITY_MANIPULATION },
    { mask: 2, ability: M3_ABILITY_STAMINA },
    { mask: 8, ability: M3_ABILITY_MANIPULATION },
  ] as const;
  for (const [index, denial] of denialCases.entries()) {
    const fixture = createCoordinatorFixture(0, 0, 1, 1, true, 0, denial.mask);
    expect(fixture.dependencies.abilities.setBaseAbility(0, denial.ability, 0)).toEqual({
      ok: true,
    });
    const output = createDecisionOutput();
    fixture.coordinator.decideInto(
      createDecisionRequest(0, 100 + index),
      createDecisionScratch(),
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      decisionKind: AUTONOMY_DECISION_WAIT,
      reasonCode: AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
      visitedCount: 0,
    });
  }

  const treatmentDenied = createCoordinatorFixture(0, 0, 1, 1, true, 0, 4);
  expect(
    treatmentDenied.dependencies.abilities.setBaseAbility(0, M3_ABILITY_COMMUNICATION, 0),
  ).toEqual({ ok: true });
  const treatmentOutput = createDecisionOutput();
  treatmentDenied.coordinator.decideInto(
    createDecisionRequest(0, 103),
    createDecisionScratch(),
    treatmentOutput,
  );
  expect(treatmentOutput.reasonCode).toBe(AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED);

  const permissionDenied = createCoordinatorFixture(0, 0, 1, 1, true, 0, 4);
  expect(
    permissionDenied.dependencies.medical.updateCaregiverStateFromAbility(
      {
        caregiverId: 0,
        regionId: 0,
        permissionId: 0,
        ability: M3_ABILITY_COMMUNICATION,
        minimumValue: 100,
        allowed: false,
      },
      permissionDenied.dependencies.healthConditions,
      permissionDenied.dependencies.abilities,
    ),
  ).toMatchObject({ ok: false, reason: "medical.rejected_permission" });
  const permissionOutput = createDecisionOutput();
  permissionDenied.coordinator.decideInto(
    createDecisionRequest(0, 104),
    createDecisionScratch(),
    permissionOutput,
  );
  expect(permissionOutput.reasonCode).toBe(AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED);

  const closedWindow = createCoordinatorFixture(0, 0, 1, 1, true, 0, 8);
  closedWindow.dependencies.scheduleFacts.windowOpenFlags[0] = 0;
  const closedWindowOutput = createDecisionOutput();
  closedWindow.coordinator.decideInto(
    createDecisionRequest(0, 105),
    createDecisionScratch(),
    closedWindowOutput,
  );
  expect(closedWindowOutput.reasonCode).toBe(AUTONOMY_REASON_IDLE_OFF_SHIFT);

  const blockedSchedule = createCoordinatorFixture(0, 0, 1, 1, true, 0, 8);
  blockedSchedule.dependencies.scheduleFacts.allowedWorkTypeMasks[0] = 0;
  const blockedScheduleOutput = createDecisionOutput();
  blockedSchedule.coordinator.decideInto(
    createDecisionRequest(0, 106),
    createDecisionScratch(),
    blockedScheduleOutput,
  );
  expect(blockedScheduleOutput.reasonCode).toBe(AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED);

  const priority = createCoordinatorFixture(0, 0, 2, 1, true, 0, 12);
  priority.dependencies.scheduleFacts.allowedWorkTypeMasks[0] = 0;
  expect(priority.dependencies.abilities.setBaseAbility(0, M3_ABILITY_COMMUNICATION, 0)).toEqual({
    ok: true,
  });
  const priorityOutput = createDecisionOutput();
  priority.coordinator.decideInto(
    createDecisionRequest(0, 107),
    createDecisionScratch(),
    priorityOutput,
  );
  expect(priorityOutput.reasonCode).toBe(AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED);

  const trueEmpty = createCoordinatorFixture(0, 0, 1, 1, true, 0, 1);
  const trueEmptyOutput = createDecisionOutput();
  trueEmpty.coordinator.decideInto(
    createDecisionRequest(0, 108),
    createDecisionScratch(),
    trueEmptyOutput,
  );
  expect(trueEmptyOutput.reasonCode).toBe(AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER);
});

it("keeps active work free, consumes interruptions/selections, honors retry/cadence, and rejects rollback", () => {
  const active = createCoordinatorFixture(12);
  active.dependencies.jobFacts.activeFlags[0] = 1;
  active.dependencies.jobFacts.jobIds[0] = 42;
  active.dependencies.jobFacts.jobVersions[0] = 1;
  const keepOutput = createDecisionOutput();
  active.coordinator.decideInto(createDecisionRequest(0, 10), createDecisionScratch(), keepOutput);
  expect(keepOutput.decisionKind).toBe(AUTONOMY_DECISION_KEEP_WORKING);
  const keepMetrics = createDecisionMetricsOutput();
  active.coordinator.readMetricsInto(keepMetrics);
  expect(keepMetrics.decisionsUsedThisTick).toBe(0);

  const interrupted = createCoordinatorFixture(12);
  interrupted.dependencies.jobFacts.activeFlags[0] = 1;
  interrupted.dependencies.jobFacts.jobIds[0] = 43;
  interrupted.dependencies.jobFacts.jobVersions[0] = 1;
  interrupted.dependencies.jobFacts.interruptionPolicyCodes[0] =
    AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE;
  expect(
    interrupted.dependencies.needs.setLane(
      { actorId: 0, lane: NEED_LANE_SAFETY, tick: 0, reason: "need.manual_set" },
      50,
    ),
  ).toMatchObject({ ok: true });
  const interruptedOutput = createDecisionOutput();
  interrupted.coordinator.decideInto(
    createDecisionRequest(0, 11),
    createDecisionScratch(),
    interruptedOutput,
  );
  expect(interruptedOutput.decisionKind).toBe(AUTONOMY_DECISION_INTERRUPTION_REQUESTED);
  const interruptedMetrics = createDecisionMetricsOutput();
  interrupted.coordinator.readMetricsInto(interruptedMetrics);
  expect(interruptedMetrics.decisionsUsedThisTick).toBe(1);

  const retry = createCoordinatorFixture(12);
  const retryInput = createWaitRefreshInput();
  retryInput.retryTick = 30;
  retry.dependencies.autonomyStore.refreshIdleInto(retryInput, createStoreOutput());
  const retryOutput = createDecisionOutput();
  retry.coordinator.decideInto(createDecisionRequest(0, 12), createDecisionScratch(), retryOutput);
  expect(retryOutput.decisionKind).toBe(AUTONOMY_DECISION_DEFERRED);

  const cadence = createCoordinatorFixture(12);
  cadence.dependencies.wakeFacts.wakeMasks[0] = 0;
  setCoordinatorFactTick(cadence.dependencies, 1);
  const cadenceOutput = createDecisionOutput();
  cadence.coordinator.decideInto(
    createDecisionRequest(1, 13),
    createDecisionScratch(),
    cadenceOutput,
  );
  expect(cadenceOutput.decisionKind).toBe(AUTONOMY_DECISION_DEFERRED);

  const rollback = createCoordinatorFixture(12);
  setCoordinatorFactTick(rollback.dependencies, 30);
  rollback.coordinator.decideInto(
    createDecisionRequest(30, 14),
    createDecisionScratch(),
    createDecisionOutput(),
  );
  setCoordinatorFactTick(rollback.dependencies, 0);
  const rollbackOutput = createDecisionOutput();
  rollback.coordinator.decideInto(
    createDecisionRequest(0, 15),
    createDecisionScratch(),
    rollbackOutput,
  );
  expect(rollbackOutput.decisionKind).toBe(AUTONOMY_DECISION_FAILED);

  const cap = createCoordinatorFixture(12);
  cap.coordinator.decideInto(
    createDecisionRequest(0, 16),
    createDecisionScratch(),
    createDecisionOutput(),
  );
  cap.coordinator.decideInto(
    createDecisionRequest(0, 17),
    createDecisionScratch(),
    createDecisionOutput(),
  );
  const thirdOutput = createDecisionOutput();
  cap.coordinator.decideInto(createDecisionRequest(0, 18), createDecisionScratch(), thirdOutput);
  expect(thirdOutput.decisionKind).toBe(AUTONOMY_DECISION_DEFERRED);
});

it("allows KEEP after two consumed slots while a third new selection still defers", () => {
  const fixture = createCoordinatorFixture(12);
  fixture.coordinator.decideInto(
    createDecisionRequest(0, 100),
    createDecisionScratch(),
    createDecisionOutput(),
  );
  fixture.coordinator.decideInto(
    createDecisionRequest(0, 101),
    createDecisionScratch(),
    createDecisionOutput(),
  );
  fixture.dependencies.jobFacts.activeFlags[0] = 1;
  fixture.dependencies.jobFacts.jobIds[0] = 90;
  fixture.dependencies.jobFacts.jobVersions[0] = 1;
  const keepOutput = createDecisionOutput();
  fixture.coordinator.decideInto(
    createDecisionRequest(0, 102),
    createDecisionScratch(),
    keepOutput,
  );
  expect(keepOutput.decisionKind).toBe(AUTONOMY_DECISION_KEEP_WORKING);
  const metricsAfterKeep = createDecisionMetricsOutput();
  fixture.coordinator.readMetricsInto(metricsAfterKeep);
  expect(metricsAfterKeep.decisionsUsedThisTick).toBe(2);
  fixture.dependencies.jobFacts.activeFlags[0] = 0;
  fixture.dependencies.jobFacts.jobIds[0] = AUTONOMY_REF_NONE;
  fixture.dependencies.jobFacts.jobVersions[0] = 0;
  const selectionOutput = createDecisionOutput();
  fixture.coordinator.decideInto(
    createDecisionRequest(0, 103),
    createDecisionScratch(),
    selectionOutput,
  );
  expect(selectionOutput.decisionKind).toBe(AUTONOMY_DECISION_DEFERRED);
});

it("attempts exactly zero through four real paths in common-score order and clears route tails", () => {
  const empty = createCoordinatorFixture(0);
  const emptyOutput = createDecisionOutput();
  empty.coordinator.decideInto(createDecisionRequest(0, 200), createDecisionScratch(), emptyOutput);
  expect(emptyOutput.exactPathCount).toBe(0);

  for (
    let expectedAttempts = 1;
    expectedAttempts <= AUTONOMY_MAX_EXACT_PATHS;
    expectedAttempts += 1
  ) {
    const fixture = createCoordinatorFixture(12);
    for (let cell = 1; cell < expectedAttempts; cell += 1) blockCell(fixture, cell);
    const scratch = createDecisionScratch();
    scratch.selectedRouteCells.fill(123);
    const routeIdentity = scratch.selectedRouteCells;
    const output = createDecisionOutput();
    fixture.coordinator.decideInto(
      createDecisionRequest(0, 210 + expectedAttempts),
      scratch,
      output,
    );
    expect(output.exactPathCount).toBe(expectedAttempts);
    expect(output.selectedCount).toBe(1);
    expect(output.candidateId).toBe(expectedAttempts - 1);
    expect(scratch.selectedRouteCells).toBe(routeIdentity);
    expect(scratch.selectedRouteCells[output.routeCellCount]).toBe(AUTONOMY_REF_NONE);
  }

  const capped = createCoordinatorFixture(12);
  for (let cell = 1; cell <= AUTONOMY_MAX_EXACT_PATHS; cell += 1) blockCell(capped, cell);
  const cappedOutput = createDecisionOutput();
  capped.coordinator.decideInto(
    createDecisionRequest(0, 220),
    createDecisionScratch(),
    cappedOutput,
  );
  expect(cappedOutput).toMatchObject({
    ok: true,
    decisionKind: AUTONOMY_DECISION_WAIT,
    exactPathCount: AUTONOMY_MAX_EXACT_PATHS,
    selectedCount: 0,
  });
});

it("rejects each of five stale path bases and excludes maxNodeExpansions from basis identity", () => {
  const basisFields: readonly (keyof AutonomyPathBasisLane)[] = [
    "mapVersion",
    "navigationVersion",
    "regionVersion",
    "roomVersion",
    "regionGraphVersion",
  ];
  for (const field of basisFields) {
    const fixture = createCoordinatorFixture(12);
    const spy = vi
      .spyOn(fixture.dependencies.pathfinder, "findPathInto")
      .mockImplementation((_grid, request, route, output) => {
        writeSuccessfulPathMock(request, route, output, 1);
        fixture.dependencies.pathBasis[field] += 1;
      });
    const output = createDecisionOutput();
    fixture.coordinator.decideInto(createDecisionRequest(0, 300), createDecisionScratch(), output);
    expect(output).toMatchObject({
      ok: true,
      decisionKind: AUTONOMY_DECISION_WAIT,
      exactPathCount: AUTONOMY_MAX_EXACT_PATHS,
      selectedCount: 0,
    });
    const metrics = createDecisionMetricsOutput();
    fixture.coordinator.readMetricsInto(metrics);
    expect(metrics.stalePathCount).toBe(AUTONOMY_MAX_EXACT_PATHS);
    spy.mockRestore();
  }

  const stable = createCoordinatorFixture(12);
  const sequences = new Float64Array(AUTONOMY_MAX_EXACT_PATHS);
  let callCount = 0;
  const stableSpy = vi
    .spyOn(stable.dependencies.pathfinder, "findPathInto")
    .mockImplementation((_grid, request, route, output) => {
      sequences[callCount] = request.requestSequence;
      callCount += 1;
      if (callCount < AUTONOMY_MAX_EXACT_PATHS) writeFailedPathMock(request, output, 2);
      else writeSuccessfulPathMock(request, route, output, 2);
      Reflect.set(request, "maxNodeExpansions", (request.maxNodeExpansions ?? 0) + 1);
    });
  const stableScratch = createDecisionScratch();
  const stableOutput = createDecisionOutput();
  stable.coordinator.decideInto(createDecisionRequest(0, 400), stableScratch, stableOutput);
  expect(stableOutput).toMatchObject({
    selectedCount: 1,
    exactPathCount: AUTONOMY_MAX_EXACT_PATHS,
    nodeExpansions: 8,
  });
  expect(sequences).toEqual(new Float64Array([400, 401, 402, 403]));
  expect(stableScratch.selectedRouteCells[stableOutput.routeCellCount]).toBe(AUTONOMY_REF_NONE);
  stableSpy.mockRestore();
});

it("rejects wrong path request sequence, start, and goal identity before route publication", () => {
  const identityFields: readonly (keyof PathSearchIntoOutput)[] = [
    "requestSequence",
    "startCellIndex",
    "goalCellIndex",
  ];
  for (const field of identityFields) {
    const fixture = createCoordinatorFixture(12);
    const spy = vi
      .spyOn(fixture.dependencies.pathfinder, "findPathInto")
      .mockImplementation((_grid, request, route, output) => {
        writeSuccessfulPathMock(request, route, output, 1);
        const value = output[field];
        if (typeof value === "number") Reflect.set(output, field, value + 1);
      });
    const scratch = createDecisionScratch();
    const output = createDecisionOutput();
    fixture.coordinator.decideInto(createDecisionRequest(0, 450), scratch, output);
    expect(output).toMatchObject({
      decisionKind: AUTONOMY_DECISION_WAIT,
      selectedCount: 0,
      routeCellCount: 0,
      exactPathCount: AUTONOMY_MAX_EXACT_PATHS,
    });
    for (const cell of scratch.selectedRouteCells) expect(cell).toBe(AUTONOMY_REF_NONE);
    const metrics = createDecisionMetricsOutput();
    fixture.coordinator.readMetricsInto(metrics);
    expect(metrics.stalePathCount).toBe(AUTONOMY_MAX_EXACT_PATHS);
    spy.mockRestore();
  }
});

it("accumulates real path node budgets across four bounded failures", () => {
  const fixture = createCoordinatorFixture(0);
  const mutation = createOfferMutationOutputForAutonomy();
  for (let offerId = 0; offerId < AUTONOMY_MAX_EXACT_PATHS; offerId += 1) {
    fixture.dependencies.workOffers.registerOfferInto(
      {
        offerId,
        workType: 0,
        regionId: 0,
        defId: 0,
        urgencyBucket: 0,
        permissionId: 0,
        targetId: 50 + offerId,
        targetCellIndex: 15 - offerId,
        scoreMilli: 2_000 - offerId,
        ownerVersion: 1,
      },
      mutation,
    );
    expect(mutation.ok).toBe(true);
  }
  const request = createDecisionRequest(0, 500);
  Reflect.set(request, "maxNodeExpansions", 1);
  const output = createDecisionOutput();
  fixture.coordinator.decideInto(request, createDecisionScratch(), output);
  expect(output).toMatchObject({
    decisionKind: AUTONOMY_DECISION_WAIT,
    exactPathCount: AUTONOMY_MAX_EXACT_PATHS,
    nodeExpansions: AUTONOMY_MAX_EXACT_PATHS,
    selectedCount: 0,
  });
});

it("closes decideInto by declaration identity over exact allocation-free owner roots", () => {
  const audit = auditAutonomyDecisionClosure();
  expect(audit.unresolved).toEqual([]);
  expect(audit.forbidden).toEqual([]);
  expect(audit.declarationCount).toBe(239);
  expect(audit.perFile).toEqual(AUTONOMY_HOT_EXPECTED_PER_FILE);
  expect(audit.dynamicOwnerRoots).toEqual(AUTONOMY_HOT_EXPECTED_DYNAMIC_OWNER_ROOTS);
  expect(audit.nativeCallKeys).toEqual(AUTONOMY_HOT_EXPECTED_NATIVE_CALL_KEYS);
  expect(audit.manifestDigest).toBe("d02dea82-d7357816");

  expect(readExpectedDynamicOwnerRoot("fake.selectCandidatesInto")).toBeUndefined();
  expect(readExpectedDynamicOwnerRoot("this.dependencies.food.selectCandidatesInto")).toBe(
    "M3FoodAvailabilityStore.selectCandidatesInto",
  );
});

it("preserves every caller scratch identity and invokes no B3 mutation or global-scan surface", () => {
  const fixture = createCoordinatorFixture(12);
  const scratch = createDecisionScratch();
  const autonomyBefore = fixture.dependencies.autonomyStore.createSnapshot();
  const reservationBefore = fixture.dependencies.reservations.createSnapshot();
  const transitionSpy = vi.spyOn(fixture.dependencies.autonomyStore, "transitionInto");
  const refreshSpy = vi.spyOn(fixture.dependencies.autonomyStore, "refreshIdleInto");
  const acquireSpy = vi.spyOn(fixture.dependencies.reservations, "acquireInto");
  const scanSpy = vi.spyOn(fixture.dependencies.entities, "forEachAliveAscending");
  const globalRetained = scratch.globalRetained;
  const sourceCodes = globalRetained.sourceCodes;
  const admissionKeys = globalRetained.cheapAdmissionKeys;
  const commonScores = globalRetained.commonScores;
  const scorerCounts = globalRetained.scoreInvocationCounts;
  const needValues = scratch.needValues;
  const needVersions = scratch.needOwnerVersions;
  const foodRows = scratch.foodScratch.stackIds;
  const restRows = scratch.restScratch.fixtureIds;
  const medicalRows = scratch.medicalScratch.requestIds;
  const ordinaryRows = scratch.ordinaryScratch.selectedOfferIds;
  const pathRoute = scratch.pathRouteCells;
  const selectedRoute = scratch.selectedRouteCells;
  const selectedBasis = scratch.selectedBasis;
  const abilityOutput = scratch.abilityOutput;
  const residentOutput = scratch.residentReadOutput;

  fixture.coordinator.decideInto(createDecisionRequest(0, 600), scratch, createDecisionOutput());
  setCoordinatorFactTick(fixture.dependencies, 30);
  fixture.coordinator.decideInto(createDecisionRequest(30, 601), scratch, createDecisionOutput());

  expect(scratch.globalRetained).toBe(globalRetained);
  expect(scratch.globalRetained.sourceCodes).toBe(sourceCodes);
  expect(scratch.globalRetained.cheapAdmissionKeys).toBe(admissionKeys);
  expect(scratch.globalRetained.commonScores).toBe(commonScores);
  expect(scratch.globalRetained.scoreInvocationCounts).toBe(scorerCounts);
  expect(scratch.needValues).toBe(needValues);
  expect(scratch.needOwnerVersions).toBe(needVersions);
  expect(scratch.foodScratch.stackIds).toBe(foodRows);
  expect(scratch.restScratch.fixtureIds).toBe(restRows);
  expect(scratch.medicalScratch.requestIds).toBe(medicalRows);
  expect(scratch.ordinaryScratch.selectedOfferIds).toBe(ordinaryRows);
  expect(scratch.pathRouteCells).toBe(pathRoute);
  expect(scratch.selectedRouteCells).toBe(selectedRoute);
  expect(scratch.selectedBasis).toBe(selectedBasis);
  expect(scratch.abilityOutput).toBe(abilityOutput);
  expect(scratch.residentReadOutput).toBe(residentOutput);
  expect(transitionSpy).not.toHaveBeenCalled();
  expect(refreshSpy).not.toHaveBeenCalled();
  expect(acquireSpy).not.toHaveBeenCalled();
  expect(scanSpy).not.toHaveBeenCalled();
  expect(fixture.claimPlanReadCount.value).toBe(0);
  expect(fixture.dependencies.autonomyStore.createSnapshot()).toEqual(autonomyBefore);
  expect(fixture.dependencies.reservations.createSnapshot()).toEqual(reservationBefore);
  transitionSpy.mockRestore();
  refreshSpy.mockRestore();
  acquireSpy.mockRestore();
  scanSpy.mockRestore();
});

it("registers and reads one idle resident through caller-owned outputs", () => {
  const store = new ResidentAutonomyStore(2);
  const storeOutput = createStoreOutput();
  const storeOutputIdentity = storeOutput;
  store.registerResidentInto(0, 1, 0, storeOutput);

  expect(storeOutput).toBe(storeOutputIdentity);
  expect(storeOutput).toMatchObject({
    ok: true,
    code: AUTONOMY_STORE_OK,
    residentIndex: 0,
    residentGeneration: 1,
    nextState: AUTONOMY_STATE_IDLE,
    rowVersion: 1,
    storeVersion: 1,
  });

  const readOutput = createReadOutput();
  const readIdentity = readOutput;
  const basisIdentity = readOutput.basis;
  const reasonIdentity = readOutput.reason;
  const terminalIdentity = readOutput.terminal;
  const terminalReasonIdentity = readOutput.terminal.reason;
  const routeIdentity = readOutput.routeCells;
  const claimIdentity = readOutput.claimIds;
  readOutput.routeCells.fill(77);
  readOutput.claimIds.fill(88);

  store.readResidentInto(0, 1, readOutput);

  expect(readOutput).toBe(readIdentity);
  expect(readOutput.basis).toBe(basisIdentity);
  expect(readOutput.reason).toBe(reasonIdentity);
  expect(readOutput.terminal).toBe(terminalIdentity);
  expect(readOutput.terminal.reason).toBe(terminalReasonIdentity);
  expect(readOutput.routeCells).toBe(routeIdentity);
  expect(readOutput.claimIds).toBe(claimIdentity);
  expect(readOutput).toMatchObject({
    ok: true,
    code: AUTONOMY_STORE_OK,
    residentIndex: 0,
    residentGeneration: 1,
    state: AUTONOMY_STATE_IDLE,
    stateEnteredTick: 0,
    retryTick: 0,
    rowVersion: 1,
    storeVersion: 1,
    routeCellCount: 0,
    routeCursor: 0,
    claimCount: 0,
  });
  expect(readOutput.reason.code).toBe(AUTONOMY_REASON_IDLE_RETRY_BACKOFF);
  expect(readOutput.terminal.present).toBe(false);
  expect(readOutput.terminal.reason.code).toBe(AUTONOMY_REASON_NONE);
  expect(Array.from(readOutput.routeCells)).toEqual(
    Array.from({ length: AUTONOMY_MAX_ROUTE_CELLS }, () => AUTONOMY_REF_NONE),
  );
  expect(Array.from(readOutput.claimIds)).toEqual(
    Array.from({ length: AUTONOMY_MAX_CLAIM_REFS }, () => AUTONOMY_REF_NONE),
  );
});

it("enforces the exact eight-state transition table without prevalidation mutation", () => {
  const states: readonly AutonomyState[] = [
    AUTONOMY_STATE_IDLE,
    AUTONOMY_STATE_CLAIMING,
    AUTONOMY_STATE_MOVING,
    AUTONOMY_STATE_WORKING,
    AUTONOMY_STATE_BLOCKED,
    AUTONOMY_STATE_COMPLETED,
    AUTONOMY_STATE_FAILED,
    AUTONOMY_STATE_INTERRUPTED,
  ];
  const legalNext: readonly (readonly AutonomyState[])[] = [
    [AUTONOMY_STATE_CLAIMING, AUTONOMY_STATE_INTERRUPTED],
    [
      AUTONOMY_STATE_MOVING,
      AUTONOMY_STATE_WORKING,
      AUTONOMY_STATE_BLOCKED,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [
      AUTONOMY_STATE_WORKING,
      AUTONOMY_STATE_BLOCKED,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [
      AUTONOMY_STATE_COMPLETED,
      AUTONOMY_STATE_BLOCKED,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [
      AUTONOMY_STATE_CLAIMING,
      AUTONOMY_STATE_MOVING,
      AUTONOMY_STATE_WORKING,
      AUTONOMY_STATE_IDLE,
      AUTONOMY_STATE_FAILED,
      AUTONOMY_STATE_INTERRUPTED,
    ],
    [AUTONOMY_STATE_IDLE],
    [AUTONOMY_STATE_IDLE],
    [AUTONOMY_STATE_IDLE, AUTONOMY_STATE_CLAIMING],
  ];
  for (let fromIndex = 0; fromIndex < states.length; fromIndex += 1) {
    const from = states[fromIndex];
    const allowed = legalNext[fromIndex];
    if (from === undefined || allowed === undefined) throw new Error("missing transition fixture");
    let illegalCount = 0;
    for (const to of states) {
      const expected = allowed.includes(to);
      expect(isLegalAutonomyTransition(from, to), `${String(from)} -> ${String(to)}`).toBe(
        expected,
      );
      if (!expected) illegalCount += 1;
    }
    expect(illegalCount).toBeGreaterThan(0);
  }

  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const beforeValidation = store.createSnapshot();
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: true, rowVersion: 1, storeVersion: 1 });
  expect(store.createSnapshot()).toEqual(beforeValidation);

  store.transitionInto(input, output);
  expect(output).toMatchObject({
    ok: true,
    previousState: AUTONOMY_STATE_IDLE,
    nextState: AUTONOMY_STATE_CLAIMING,
    rowVersion: 2,
    storeVersion: 2,
  });
  const afterClaiming = store.createSnapshot();
  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_COMPLETED;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_ILLEGAL_TRANSITION });
  expect(store.createSnapshot()).toEqual(afterClaiming);
});

it("copies bounded authoritative route and claims and rejects every capacity overflow atomically", () => {
  const store = new ResidentAutonomyStore(2);
  const transitionOutput = createStoreOutput();
  const transitionIdentity = transitionOutput;
  store.registerResidentInto(0, 1, 0, transitionOutput);
  const input = createClaimingInput();
  store.transitionInto(input, transitionOutput);

  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_MOVING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.routeCellCount = 3;
  input.routeCursor = 1;
  input.routeCells.fill(77);
  input.routeCells[0] = 4;
  input.routeCells[1] = 5;
  input.routeCells[2] = 6;
  input.claimCount = 2;
  input.claimIds.fill(88);
  input.claimIds[0] = 21;
  input.claimIds[1] = 22;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    0,
    1,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  const routeIdentity = input.routeCells;
  const claimIdentity = input.claimIds;
  store.transitionInto(input, transitionOutput);
  expect(transitionOutput).toBe(transitionIdentity);
  expect(input.routeCells).toBe(routeIdentity);
  expect(input.claimIds).toBe(claimIdentity);
  expect(transitionOutput).toMatchObject({ ok: true, rowVersion: 3, storeVersion: 3 });

  const readOutput = createReadOutput();
  const readIdentity = readOutput;
  const readRouteIdentity = readOutput.routeCells;
  const readClaimIdentity = readOutput.claimIds;
  store.readResidentInto(0, 1, readOutput);
  expect(readOutput).toBe(readIdentity);
  expect(readOutput.routeCells).toBe(readRouteIdentity);
  expect(readOutput.claimIds).toBe(readClaimIdentity);
  expect(readOutput).toMatchObject({
    ok: true,
    state: AUTONOMY_STATE_MOVING,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    routeCellCount: 3,
    routeCursor: 1,
    claimCount: 2,
  });
  expect(readOutput.basis).toEqual(input.basis);
  expect(Array.from(readOutput.routeCells.slice(0, 3))).toEqual([4, 5, 6]);
  expect(Array.from(readOutput.routeCells.slice(3))).toEqual(
    Array.from({ length: AUTONOMY_MAX_ROUTE_CELLS - 3 }, () => AUTONOMY_REF_NONE),
  );
  expect(Array.from(readOutput.claimIds.slice(0, 2))).toEqual([21, 22]);
  expect(Array.from(readOutput.claimIds.slice(2))).toEqual(
    Array.from({ length: AUTONOMY_MAX_CLAIM_REFS - 2 }, () => AUTONOMY_REF_NONE),
  );

  const stable = store.createSnapshot();
  const shortRouteRead = createReadOutput(AUTONOMY_MAX_ROUTE_CELLS - 1);
  store.readResidentInto(0, 1, shortRouteRead);
  expect(shortRouteRead).toMatchObject({ ok: false, code: AUTONOMY_STORE_ROUTE_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
  const shortClaimRead = createReadOutput(AUTONOMY_MAX_ROUTE_CELLS, AUTONOMY_MAX_CLAIM_REFS - 1);
  store.readResidentInto(0, 1, shortClaimRead);
  expect(shortClaimRead).toMatchObject({ ok: false, code: AUTONOMY_STORE_CLAIM_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);

  input.expectedState = AUTONOMY_STATE_MOVING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.routeCellCount = AUTONOMY_MAX_ROUTE_CELLS + 1;
  store.validateTransitionInto(input, transitionOutput);
  expect(transitionOutput).toMatchObject({ ok: false, code: AUTONOMY_STORE_ROUTE_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
  input.routeCellCount = 3;
  input.routeCursor = 4;
  store.validateTransitionInto(input, transitionOutput);
  expect(transitionOutput).toMatchObject({ ok: false, code: AUTONOMY_STORE_ROUTE_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
  input.routeCursor = 1;
  input.claimCount = AUTONOMY_MAX_CLAIM_REFS + 1;
  store.validateTransitionInto(input, transitionOutput);
  expect(transitionOutput).toMatchObject({ ok: false, code: AUTONOMY_STORE_CLAIM_CAPACITY });
  expect(store.createSnapshot()).toEqual(stable);
});

it("allows claiming to publish only acquired route and claim pairs before a job exists", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const idleSnapshot = store.createSnapshot();

  input.routeCellCount = 3;
  input.routeCursor = 0;
  input.routeCells[0] = 4;
  input.routeCells[1] = 5;
  input.routeCells[2] = 6;
  input.claimCount = 0;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(idleSnapshot);

  input.routeCellCount = 0;
  input.claimCount = 2;
  input.claimIds[0] = 21;
  input.claimIds[1] = 22;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(idleSnapshot);

  input.routeCellCount = 3;
  input.claimCount = 2;
  input.pendingJobId = 11;
  writeAcquiredReason(input);
  store.transitionInto(input, output);
  expect(output).toMatchObject({
    ok: true,
    nextState: AUTONOMY_STATE_CLAIMING,
    rowVersion: 2,
    storeVersion: 2,
  });
  const readOutput = createReadOutput();
  store.readResidentInto(0, 1, readOutput);
  expect(readOutput).toMatchObject({
    ok: true,
    state: AUTONOMY_STATE_CLAIMING,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_ORDINARY,
    candidateId: 3,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: 11,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    routeCellCount: 3,
    routeCursor: 0,
    claimCount: 2,
  });
  expect(Array.from(readOutput.routeCells.slice(0, 3))).toEqual([4, 5, 6]);
  expect(Array.from(readOutput.claimIds.slice(0, 2))).toEqual([21, 22]);

  const snapshot = store.createSnapshot();
  const restored = new ResidentAutonomyStore(2);
  restored.restoreFromSnapshot(snapshot, output);
  expect(output.ok).toBe(true);
  expect(restored.createSnapshot()).toEqual(snapshot);
});

it("binds interruption policy and job version without partially mutating invalid transitions", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const idle = store.createSnapshot();

  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(idle);
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_NONE;
  input.basis.jobVersion = 1;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(idle);

  input.basis.jobVersion = 0;
  store.transitionInto(input, output);
  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_MOVING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.routeCellCount = 1;
  input.routeCells[0] = 7;
  input.claimCount = 1;
  input.claimIds[0] = 21;
  writeAcquiredReason(input);
  const claiming = store.createSnapshot();
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);
  input.basis.jobVersion = 17;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_MOVING });
  const moving = store.createSnapshot();
  input.expectedState = AUTONOMY_STATE_MOVING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.stateEnteredTick = 3;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE;
  input.basis.jobVersion = 18;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 16;
  store.validateTransitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
});

it("rejects raw states, tick rollback, reason-state mismatch and uncleared terminal claims", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  const idle = store.createSnapshot();
  Reflect.set(input, "nextState", 33);
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_ILLEGAL_TRANSITION });
  expect(store.createSnapshot()).toEqual(idle);

  input.nextState = AUTONOMY_STATE_CLAIMING;
  input.stateEnteredTick = 2;
  store.transitionInto(input, output);
  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_MOVING;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.routeCellCount = 1;
  input.routeCells[0] = 7;
  input.claimCount = 1;
  input.claimIds[0] = 21;
  writeAcquiredReason(input);
  const claiming = store.createSnapshot();
  input.stateEnteredTick = 1;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_TICK_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);

  input.stateEnteredTick = 3;
  writeFailedInvariantReason(input);
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REASON_INVALID });
  expect(store.createSnapshot()).toEqual(claiming);
  writeAcquiredReason(input);
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_MOVING });

  input.expectedState = AUTONOMY_STATE_MOVING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_FAILED;
  input.stateEnteredTick = 4;
  input.routeCellCount = 0;
  input.claimCount = 0;
  resetAutonomyReason(input.reason);
  const moving = store.createSnapshot();
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REASON_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
  writeFailedInvariantReason(input);
  input.routeCellCount = 1;
  input.claimCount = 1;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(moving);
  input.routeCellCount = 0;
  input.claimCount = 0;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_FAILED });
  const read = createReadOutput();
  store.readResidentInto(0, 1, read);
  expect(read).toMatchObject({ routeCellCount: 0, claimCount: 0 });
  expect(read.terminal).toMatchObject({
    present: true,
    state: AUTONOMY_STATE_FAILED,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    jobVersion: 17,
  });
});

it("retains a completed terminal across idle and roundtrips every snapshot lane atomically", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const initialIdleSnapshot = store.createSnapshot();
  const input = createClaimingInput();
  store.transitionInto(input, output);

  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 2;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.claimCount = 2;
  input.claimIds[0] = 21;
  input.claimIds[1] = 22;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    0,
    1,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    1,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    2,
    0,
    0,
    0,
    0,
    0,
  );
  store.transitionInto(input, output);

  input.expectedState = AUTONOMY_STATE_WORKING;
  input.expectedRowVersion = 3;
  input.nextState = AUTONOMY_STATE_COMPLETED;
  input.stateEnteredTick = 3;
  input.routeCellCount = 0;
  input.routeCursor = 0;
  resetAutonomyReason(input.reason);
  const workingWithClaims = store.createSnapshot();
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_REFERENCE_INVALID });
  expect(store.createSnapshot()).toEqual(workingWithClaims);
  input.claimCount = 0;
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: true, nextState: AUTONOMY_STATE_COMPLETED, rowVersion: 4 });

  const terminalRead = createReadOutput();
  store.readResidentInto(0, 1, terminalRead);
  expect(terminalRead).toMatchObject({
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    basis: { jobVersion: 17 },
  });
  expect(terminalRead.terminal).toMatchObject({
    present: true,
    state: AUTONOMY_STATE_COMPLETED,
    tick: 3,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_ORDINARY,
    candidateId: 3,
    jobId: 11,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
    jobVersion: 17,
    targetEntityIndex: 5,
    targetEntityGeneration: 2,
    targetCellIndex: 7,
  });
  expect(terminalRead.terminal.reason.code).toBe(AUTONOMY_REASON_NONE);
  const completedSnapshot = store.createSnapshot();
  const completedGuard = new ResidentAutonomyStore(2);
  const badCompletedPolicy = cloneSnapshot(completedSnapshot);
  badCompletedPolicy.lanes[AutonomySnapshotLane.interruptionPolicyCode] =
    AUTONOMY_INTERRUPTION_POLICY_NONE;
  expectAtomicRestoreFailure(completedGuard, badCompletedPolicy, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badCompletedJobVersion = cloneSnapshot(completedSnapshot);
  badCompletedJobVersion.lanes[AutonomySnapshotLane.jobVersion] = 0;
  expectAtomicRestoreFailure(completedGuard, badCompletedJobVersion, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badMissingTerminal = cloneSnapshot(completedSnapshot);
  for (
    let lane = AutonomySnapshotLane.terminalPresent;
    lane <= AutonomySnapshotLane.terminalReasonSuggestion;
    lane += 1
  )
    badMissingTerminal.lanes[lane] = initialIdleSnapshot.lanes[lane] ?? 0;
  badMissingTerminal.lanes[AutonomySnapshotLane.terminalInterruptionPolicyCode] =
    initialIdleSnapshot.lanes[AutonomySnapshotLane.terminalInterruptionPolicyCode] ?? 0;
  badMissingTerminal.lanes[AutonomySnapshotLane.terminalJobVersion] =
    initialIdleSnapshot.lanes[AutonomySnapshotLane.terminalJobVersion] ?? 0;
  for (
    let lane = AutonomySnapshotReasonParameterLane.terminal0;
    lane <= AutonomySnapshotReasonParameterLane.terminal5;
    lane += 1
  )
    badMissingTerminal.reasonParameters[lane] = initialIdleSnapshot.reasonParameters[lane] ?? 0;
  badMissingTerminal.ticks[AutonomySnapshotTickLane.terminal] =
    initialIdleSnapshot.ticks[AutonomySnapshotTickLane.terminal] ?? 0;
  expectAtomicRestoreFailure(completedGuard, badMissingTerminal, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badTerminalTick = cloneSnapshot(completedSnapshot);
  badTerminalTick.ticks[AutonomySnapshotTickLane.terminal] = 2;
  expectAtomicRestoreFailure(completedGuard, badTerminalTick, AUTONOMY_STORE_SNAPSHOT_STATE);

  input.expectedState = AUTONOMY_STATE_COMPLETED;
  input.expectedRowVersion = 4;
  input.nextState = AUTONOMY_STATE_IDLE;
  input.stateEnteredTick = 4;
  input.retryTick = 5;
  input.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_WAIT;
  input.candidateId = AUTONOMY_REF_NONE;
  writeWaitBasis(input.basis);
  input.jobId = AUTONOMY_REF_NONE;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_NONE;
  input.basis.jobVersion = 0;
  input.targetEntityIndex = AUTONOMY_REF_NONE;
  input.targetEntityGeneration = AUTONOMY_REF_NONE;
  input.targetCellIndex = AUTONOMY_REF_NONE;
  input.claimCount = 0;
  input.needLane = AUTONOMY_REF_NONE;
  input.ability = AUTONOMY_REF_NONE;
  input.scheduleCode = AUTONOMY_REF_NONE;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_IDLE_RETRY_BACKOFF,
    AUTONOMY_REASON_SOURCE_IDLE,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    1,
    0,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    5,
    0,
    0,
    0,
    0,
    0,
  );
  store.transitionInto(input, output);

  const idleRead = createReadOutput();
  store.readResidentInto(0, 1, idleRead);
  expect(idleRead).toMatchObject({
    ok: true,
    state: AUTONOMY_STATE_IDLE,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_WAIT,
    candidateId: AUTONOMY_REF_NONE,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    basis: { jobVersion: 0 },
    targetEntityIndex: AUTONOMY_REF_NONE,
    targetEntityGeneration: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    routeCellCount: 0,
    claimCount: 0,
  });
  expect(idleRead.terminal).toEqual(terminalRead.terminal);
  expect(Array.from(idleRead.routeCells)).toEqual(
    Array.from({ length: AUTONOMY_MAX_ROUTE_CELLS }, () => AUTONOMY_REF_NONE),
  );
  expect(Array.from(idleRead.claimIds)).toEqual(
    Array.from({ length: AUTONOMY_MAX_CLAIM_REFS }, () => AUTONOMY_REF_NONE),
  );

  const snapshot = store.createSnapshot();
  const restored = new ResidentAutonomyStore(2);
  restored.restoreFromSnapshot(snapshot, output);
  expect(output.ok).toBe(true);
  expect(restored.createSnapshot()).toEqual(snapshot);
  const restoredRead = createReadOutput();
  restored.readResidentInto(0, 1, restoredRead);
  expect(restoredRead).toEqual(idleRead);

  const guard = new ResidentAutonomyStore(2);
  guard.registerResidentInto(1, 2, 8, output);
  const badVersion = cloneSnapshot(snapshot);
  Reflect.set(badVersion, "snapshotVersion", 3);
  expectAtomicRestoreFailure(guard, badVersion, AUTONOMY_STORE_SNAPSHOT_VERSION);
  const badShape = cloneSnapshot(snapshot);
  Reflect.set(badShape, "active", new Uint8Array(1));
  expectAtomicRestoreFailure(guard, badShape, AUTONOMY_STORE_SNAPSHOT_SHAPE);
  const wrongLaneType = cloneSnapshot(snapshot);
  Reflect.set(wrongLaneType, "lanes", new Float64Array(wrongLaneType.lanes));
  expectAtomicRestoreFailure(guard, wrongLaneType, AUTONOMY_STORE_SNAPSHOT_SHAPE);
  const throwingLaneGetter = cloneSnapshot(snapshot);
  Object.defineProperty(throwingLaneGetter, "lanes", {
    configurable: true,
    get(): Uint32Array {
      throw new Error("malicious lanes getter");
    },
  });
  expectAtomicRestoreFailure(guard, throwingLaneGetter, AUTONOMY_STORE_SNAPSHOT_SHAPE);
  const badState = cloneSnapshot(snapshot);
  badState.lanes[AutonomySnapshotLane.state] = 99;
  expectAtomicRestoreFailure(guard, badState, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badRawTerminalState = cloneSnapshot(snapshot);
  badRawTerminalState.lanes[AutonomySnapshotLane.terminalState] = 99;
  expectAtomicRestoreFailure(guard, badRawTerminalState, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badReason = cloneSnapshot(snapshot);
  badReason.lanes[AutonomySnapshotLane.reasonSource] = AUTONOMY_REASON_SOURCE_NEED;
  expectAtomicRestoreFailure(guard, badReason, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badRouteTail = cloneSnapshot(snapshot);
  badRouteTail.routeCells[0] = 9;
  expectAtomicRestoreFailure(guard, badRouteTail, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badTerminalJob = cloneSnapshot(snapshot);
  badTerminalJob.lanes[AutonomySnapshotLane.terminalJobId] = AUTONOMY_REF_NONE;
  expectAtomicRestoreFailure(guard, badTerminalJob, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badTerminalChronology = cloneSnapshot(snapshot);
  badTerminalChronology.ticks[AutonomySnapshotTickLane.terminal] = 6;
  expectAtomicRestoreFailure(guard, badTerminalChronology, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdleClaims = cloneSnapshot(snapshot);
  badIdleClaims.lanes[AutonomySnapshotLane.claimCount] = 1;
  badIdleClaims.claimIds[0] = 21;
  expectAtomicRestoreFailure(guard, badIdleClaims, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdlePendingJob = cloneSnapshot(snapshot);
  badIdlePendingJob.lanes[AutonomySnapshotLane.pendingJobId] = 11;
  expectAtomicRestoreFailure(guard, badIdlePendingJob, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdlePolicy = cloneSnapshot(snapshot);
  badIdlePolicy.lanes[AutonomySnapshotLane.interruptionPolicyCode] =
    AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  expectAtomicRestoreFailure(guard, badIdlePolicy, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badIdleJobVersion = cloneSnapshot(snapshot);
  badIdleJobVersion.lanes[AutonomySnapshotLane.jobVersion] = 1;
  expectAtomicRestoreFailure(guard, badIdleJobVersion, AUTONOMY_STORE_SNAPSHOT_STATE);
});

it("restores exhausted row and store versions but rejects the next transition without mutation", () => {
  const source = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  source.registerResidentInto(0, 1, 0, output);
  const input = createClaimingInput();
  source.transitionInto(input, output);
  const exhausted = source.createSnapshot();
  exhausted.lanes[AutonomySnapshotLane.rowVersion] = 0xffff_ffff;
  Reflect.set(exhausted, "storeVersion", 0xffff_ffff);

  const restored = new ResidentAutonomyStore(2);
  restored.restoreFromSnapshot(exhausted, output);
  expect(output.ok).toBe(true);
  expect(restored.createSnapshot()).toEqual(exhausted);

  input.expectedState = AUTONOMY_STATE_CLAIMING;
  input.expectedRowVersion = 0xffff_ffff;
  input.nextState = AUTONOMY_STATE_WORKING;
  input.stateEnteredTick = 2;
  input.jobId = 11;
  input.interruptionPolicyCode = AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT;
  input.basis.jobVersion = 17;
  input.claimCount = 1;
  input.claimIds[0] = 21;
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    0,
    1,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  const before = restored.createSnapshot();
  restored.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_VERSION_EXHAUSTED });
  expect(restored.createSnapshot()).toEqual(before);
});

it("roundtrips each approved candidate source basis and rejects cross-source residue atomically", () => {
  const foodInput = createClaimingInput();
  writeFoodCandidateBasis(foodInput);
  expectCandidateBasisRoundTrip(foodInput);

  const restInput = createClaimingInput();
  writeRestCandidateBasis(restInput);
  expectCandidateBasisRoundTrip(restInput);

  const medicalInput = createClaimingInput();
  writeMedicalCandidateBasis(medicalInput);
  expectCandidateBasisRoundTrip(medicalInput);

  const ordinaryInput = createClaimingInput();
  const ordinaryStore = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  ordinaryStore.registerResidentInto(0, 1, 0, output);
  ordinaryStore.transitionInto(ordinaryInput, output);
  expect(output.ok).toBe(true);
  const ordinarySnapshot = ordinaryStore.createSnapshot();
  const guard = new ResidentAutonomyStore(2);
  const badSource = cloneSnapshot(ordinarySnapshot);
  badSource.lanes[AutonomySnapshotLane.candidateSourceCode] = 99;
  expectAtomicRestoreFailure(guard, badSource, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badSourceShape = cloneSnapshot(ordinarySnapshot);
  badSourceShape.lanes[AutonomySnapshotLane.candidateSourceCode] = AUTONOMY_CANDIDATE_SOURCE_FOOD;
  expectAtomicRestoreFailure(guard, badSourceShape, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badResidue = cloneSnapshot(ordinarySnapshot);
  badResidue.lanes[AutonomySnapshotLane.foodAvailabilityVersion] = 1;
  expectAtomicRestoreFailure(guard, badResidue, AUTONOMY_STORE_SNAPSHOT_STATE);
});

it("rejects impossible Food backlog basis atomically while accepting zero meal-window version", () => {
  const zeroVersion = createClaimingInput();
  writeFoodCandidateBasis(zeroVersion);
  zeroVersion.basis.foodMealWindowVersion = 0;
  expectCandidateBasisRoundTrip(zeroVersion);

  const dirty = createClaimingInput();
  writeFoodCandidateBasis(dirty);
  dirty.basis.foodDirtyBacklog = 1;
  dirty.basis.candidateBacklog = 1;
  expectBasisTransitionRejectedAtomically(dirty);

  const candidateBacklog = createClaimingInput();
  writeFoodCandidateBasis(candidateBacklog);
  candidateBacklog.basis.candidateBacklog = 1;
  expectBasisTransitionRejectedAtomically(candidateBacklog);

  const snapshot = createCandidateSnapshot(createValidFoodInput());
  const guard = new ResidentAutonomyStore(2);
  const storedDirty = cloneSnapshot(snapshot);
  storedDirty.lanes[AutonomySnapshotLane.foodDirtyBacklog] = 1;
  storedDirty.lanes[AutonomySnapshotLane.candidateBacklog] = 1;
  expectAtomicRestoreFailure(guard, storedDirty, AUTONOMY_STORE_SNAPSHOT_STATE);
  const storedCandidateBacklog = cloneSnapshot(snapshot);
  storedCandidateBacklog.lanes[AutonomySnapshotLane.candidateBacklog] = 1;
  expectAtomicRestoreFailure(guard, storedCandidateBacklog, AUTONOMY_STORE_SNAPSHOT_STATE);
});

it("rejects impossible Rest coherence and exposure basis atomically", () => {
  const dirty = createClaimingInput();
  writeRestCandidateBasis(dirty);
  dirty.basis.restDirtyBacklog = 1;
  dirty.basis.candidateBacklog = 1;
  expectBasisTransitionRejectedAtomically(dirty);

  const staleRow = createClaimingInput();
  writeRestCandidateBasis(staleRow);
  staleRow.basis.restCachedRowVersion = 21;
  expectBasisTransitionRejectedAtomically(staleRow);

  const staleSource = createClaimingInput();
  writeRestCandidateBasis(staleSource);
  staleSource.basis.restSourceVersion = 23;
  expectBasisTransitionRejectedAtomically(staleSource);

  const unsafeOutdoor = createClaimingInput();
  writeRestCandidateBasis(unsafeOutdoor);
  unsafeOutdoor.basis.restOutdoorWorkAllowed = 0;
  expectBasisTransitionRejectedAtomically(unsafeOutdoor);
});

it("keeps Rest snapshot validation symmetric and accepts zero environment versions", () => {
  const zeroVersions = createClaimingInput();
  writeRestCandidateBasis(zeroVersions);
  zeroVersions.basis.restScheduleWindowVersion = 0;
  zeroVersions.basis.restWeatherVersion = 0;
  zeroVersions.basis.restWeatherSourceVersion = 0;
  expectCandidateBasisRoundTrip(zeroVersions);

  const snapshot = createCandidateSnapshot(createValidRestInput());
  const guard = new ResidentAutonomyStore(2);
  const badScheduleCode = cloneSnapshot(snapshot);
  badScheduleCode.lanes[AutonomySnapshotLane.restScheduleWindowCode] = 99;
  expectAtomicRestoreFailure(guard, badScheduleCode, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badWeatherCode = cloneSnapshot(snapshot);
  badWeatherCode.lanes[AutonomySnapshotLane.restWeatherExposureCode] = 99;
  expectAtomicRestoreFailure(guard, badWeatherCode, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badOutdoorRelation = cloneSnapshot(snapshot);
  badOutdoorRelation.lanes[AutonomySnapshotLane.restOutdoorWorkAllowed] = 0;
  expectAtomicRestoreFailure(guard, badOutdoorRelation, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badDirtyRelation = cloneSnapshot(snapshot);
  badDirtyRelation.lanes[AutonomySnapshotLane.restDirtyBacklog] = 1;
  badDirtyRelation.lanes[AutonomySnapshotLane.candidateBacklog] = 1;
  expectAtomicRestoreFailure(guard, badDirtyRelation, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badRowRelation = cloneSnapshot(snapshot);
  badRowRelation.lanes[AutonomySnapshotLane.restCachedRowVersion] = 21;
  expectAtomicRestoreFailure(guard, badRowRelation, AUTONOMY_STORE_SNAPSHOT_STATE);
  const badSourceRelation = cloneSnapshot(snapshot);
  badSourceRelation.lanes[AutonomySnapshotLane.restSourceVersion] = 23;
  expectAtomicRestoreFailure(guard, badSourceRelation, AUTONOMY_STORE_SNAPSHOT_STATE);
});

it("rejects infeasible Medical caregiver ability and accepts zero caregiver ability versions", () => {
  const zeroCaregiverCondition = createClaimingInput();
  writeMedicalCandidateBasis(zeroCaregiverCondition);
  zeroCaregiverCondition.basis.medicalCaregiverActorConditionVersion = 0;
  zeroCaregiverCondition.basis.medicalCaregiverBaseAbilityVersion = 0;
  expectCandidateBasisRoundTrip(zeroCaregiverCondition);

  const insufficientAbility = createClaimingInput();
  writeMedicalCandidateBasis(insufficientAbility);
  insufficientAbility.basis.medicalCaregiverAbilityValue = 199;
  expectBasisTransitionRejectedAtomically(insufficientAbility);

  const snapshot = createCandidateSnapshot(createValidMedicalInput());
  const storedInsufficientAbility = cloneSnapshot(snapshot);
  storedInsufficientAbility.lanes[AutonomySnapshotLane.medicalCaregiverAbilityValue] = 199;
  expectAtomicRestoreFailure(
    new ResidentAutonomyStore(2),
    storedInsufficientAbility,
    AUTONOMY_STORE_SNAPSHOT_STATE,
  );
});

it("persists WAIT through the reviewed idle refresh without legalizing idle to idle transition", () => {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const waitInput = createWaitRefreshInput();
  store.transitionInto(waitInput, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_ILLEGAL_TRANSITION });

  store.refreshIdleInto(waitInput, output);
  expect(output).toMatchObject({ ok: true, rowVersion: 2, storeVersion: 2 });
  const read = createReadOutput();
  store.readResidentInto(0, 1, read);
  expect(read).toMatchObject({
    state: AUTONOMY_STATE_IDLE,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_WAIT,
    candidateId: AUTONOMY_REF_NONE,
    basis: {
      candidateId: AUTONOMY_REF_NONE,
      candidateOwnerVersion: 0,
      candidateRowVersion: 0,
      candidateIndexVersion: 0,
      candidateBacklog: 0,
    },
  });

  waitInput.expectedRowVersion = 2;
  waitInput.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_NONE;
  const stable = store.createSnapshot();
  store.refreshIdleInto(waitInput, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_ILLEGAL_TRANSITION });
  expect(store.createSnapshot()).toEqual(stable);
});

it("resets and rebinds only caller-preallocated claim plan identities", () => {
  const plan = createClaimPlanOutput();
  const transaction = plan.transaction;
  const claims = transaction.claims;
  const owner = plan.owner;
  const header = plan.header;
  const slots = plan.claimSlots;
  const entityClaim = slots[0].entityClaim;
  const cellClaim = slots[1].cellClaim;
  const itemClaim = slots[2].itemQuantityClaim;
  const spotClaim = slots[3].interactionSpotClaim;
  const capacityClaim = slots[4].capacityClaim;
  expect(hasValidAutonomyClaimPlanAliases(plan)).toBe(true);
  expect(bindAutonomyClaimSlotInto(plan, 0, "entity")).toBe(true);
  expect(bindAutonomyClaimSlotInto(plan, 1, "cell")).toBe(true);
  plan.header.pendingJobId = 41;
  plan.transaction.jobId = 41;

  resetAutonomyClaimPlanInto(plan);
  expect(plan.transaction).toBe(transaction);
  expect(plan.transaction.claims).toBe(claims);
  expect(plan.transaction.owner).toBe(owner);
  expect(plan.header).toBe(header);
  expect(plan.claimSlots).toBe(slots);
  expect(plan.transaction.claims).toHaveLength(0);
  expect(plan.header).toMatchObject({
    ok: false,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_NONE,
    candidateId: AUTONOMY_REF_NONE,
    pendingJobId: AUTONOMY_REF_NONE,
    claimCount: 0,
  });
  expect(plan.owner).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
  expect(plan.target).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
  expect(plan.item).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });

  expect(bindAutonomyClaimSlotInto(plan, 0, "entity")).toBe(true);
  expect(bindAutonomyClaimSlotInto(plan, 1, "cell")).toBe(true);
  expect(bindAutonomyClaimSlotInto(plan, 2, "item_quantity")).toBe(true);
  expect(bindAutonomyClaimSlotInto(plan, 3, "interaction_spot")).toBe(true);
  expect(bindAutonomyClaimSlotInto(plan, 4, "capacity")).toBe(true);
  expect(plan.transaction.claims).toBe(claims);
  expect(plan.transaction.claims[0]).toBe(entityClaim);
  expect(plan.transaction.claims[1]).toBe(cellClaim);
  expect(plan.transaction.claims[2]).toBe(itemClaim);
  expect(plan.transaction.claims[3]).toBe(spotClaim);
  expect(plan.transaction.claims[4]).toBe(capacityClaim);
  expect(plan.header.claimCount).toBe(5);
  plan.header.pendingJobId = 51;
  plan.transaction.jobId = 51;
  expect(plan.header.pendingJobId).toBe(plan.transaction.jobId);
  const acquireRequest: ReservationTransactionRequest = plan.transaction;
  expect(acquireRequest).toBe(transaction);
});

it("rejects malformed claim aliases and clears every detached embedded ref", () => {
  const plan = createClaimPlanOutput();
  const slot = plan.claimSlots[0];
  const detachedEntity = { index: 61, generation: 62 };
  const detachedSpot = { index: 63, generation: 64 };
  const detachedCapacity = { index: 65, generation: 66 };
  const detachedItem = { index: 67, generation: 68 };
  Reflect.set(slot.entityClaim, "target", detachedEntity);
  Reflect.set(slot.interactionSpotClaim, "target", detachedSpot);
  Reflect.set(slot.capacityClaim, "target", detachedCapacity);
  Reflect.set(slot.itemQuantityClaim, "item", detachedItem);
  expect(hasValidAutonomyClaimPlanAliases(plan)).toBe(false);
  expect(bindAutonomyClaimSlotInto(plan, 0, "entity")).toBe(false);

  resetAutonomyClaimPlanInto(plan);
  expect(slot.entityTarget).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
  expect(slot.itemTarget).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
  expect(detachedEntity).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
  expect(detachedSpot).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
  expect(detachedCapacity).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
  expect(detachedItem).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });

  const detachedOwner = { index: 71, generation: 72 };
  Reflect.set(plan.transaction, "owner", detachedOwner);
  expect(bindAutonomyClaimSlotInto(plan, 1, "cell")).toBe(false);
  resetAutonomyClaimPlanInto(plan);
  expect(detachedOwner).toEqual({ index: AUTONOMY_REF_NONE, generation: AUTONOMY_REF_NONE });
});

function expectCandidateBasisRoundTrip(input: AutonomyTransitionInput): void {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  store.transitionInto(input, output);
  expect(output.ok).toBe(true);
  const read = createReadOutput();
  store.readResidentInto(0, 1, read);
  expect(read.candidateSourceCode).toBe(input.candidateSourceCode);
  expect(read.candidateId).toBe(input.candidateId);
  expect(read.basis).toEqual(input.basis);
  const snapshot = store.createSnapshot();
  const restored = new ResidentAutonomyStore(2);
  restored.restoreFromSnapshot(snapshot, output);
  expect(output.ok).toBe(true);
  expect(restored.createSnapshot()).toEqual(snapshot);
}

function expectBasisTransitionRejectedAtomically(input: AutonomyTransitionInput): void {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  const stable = store.createSnapshot();
  store.transitionInto(input, output);
  expect(output).toMatchObject({ ok: false, code: AUTONOMY_STORE_BASIS_INVALID });
  expect(store.createSnapshot()).toEqual(stable);
}

function createCandidateSnapshot(input: AutonomyTransitionInput): ResidentAutonomySnapshot {
  const store = new ResidentAutonomyStore(2);
  const output = createStoreOutput();
  store.registerResidentInto(0, 1, 0, output);
  store.transitionInto(input, output);
  expect(output.ok).toBe(true);
  return store.createSnapshot();
}

function createValidRestInput(): AutonomyTransitionInput {
  const input = createClaimingInput();
  writeRestCandidateBasis(input);
  return input;
}

function createValidFoodInput(): AutonomyTransitionInput {
  const input = createClaimingInput();
  writeFoodCandidateBasis(input);
  return input;
}

function createValidMedicalInput(): AutonomyTransitionInput {
  const input = createClaimingInput();
  writeMedicalCandidateBasis(input);
  return input;
}

function writeFoodCandidateBasis(input: AutonomyTransitionInput): void {
  input.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_FOOD;
  input.basis.candidateOwnerVersion = 10;
  input.basis.candidateRowVersion = 11;
  input.basis.candidateIndexVersion = 10;
  input.basis.candidateBacklog = 0;
  input.basis.foodAvailabilityVersion = 10;
  input.basis.foodItemVersion = 11;
  input.basis.foodMealWindowId = 3;
  input.basis.foodMealWindowVersion = 12;
  input.basis.foodDirtyBacklog = 0;
  input.reason.ownerBasis = 10;
}

function writeRestCandidateBasis(input: AutonomyTransitionInput): void {
  input.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_REST;
  input.basis.candidateOwnerVersion = 20;
  input.basis.candidateRowVersion = 22;
  input.basis.candidateIndexVersion = 24;
  input.basis.candidateBacklog = 0;
  input.basis.restStoreVersion = 20;
  input.basis.restCachedRowVersion = 22;
  input.basis.restCurrentRowVersion = 22;
  input.basis.restSourceVersion = 20;
  input.basis.restIndexVersion = 24;
  input.basis.restDirtyBacklog = 0;
  input.basis.restScheduleWindowCode = 1;
  input.basis.restScheduleWindowVersion = 25;
  input.basis.restWeatherExposureCode = 1;
  input.basis.restWeatherVersion = 26;
  input.basis.restWeatherSourceVersion = 27;
  input.basis.restOutdoorWorkAllowed = 1;
  input.reason.ownerBasis = 20;
}

function writeMedicalCandidateBasis(input: AutonomyTransitionInput): void {
  input.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_MEDICAL;
  input.basis.candidateOwnerVersion = 30;
  input.basis.candidateRowVersion = 32;
  input.basis.candidateIndexVersion = 30;
  input.basis.candidateBacklog = 0;
  input.basis.medicalStoreVersion = 30;
  input.basis.medicalHealthStoreVersion = 31;
  input.basis.medicalConditionVersion = 32;
  input.basis.medicalActorVersion = 33;
  input.basis.medicalCaregiverId = 4;
  input.basis.medicalCaregiverRegionId = 5;
  input.basis.medicalCaregiverPermissionId = 6;
  input.basis.medicalCaregiverAbility = 1;
  input.basis.medicalCaregiverMinimumAbility = 200;
  input.basis.medicalCaregiverAbilityValue = 500;
  input.basis.medicalCaregiverActorConditionVersion = 34;
  input.basis.medicalCaregiverBaseAbilityVersion = 35;
  input.basis.medicalCaregiverValid = 1;
  input.basis.medicalCaregiverAllowed = 1;
  input.reason.ownerBasis = 30;
}

function createWaitRefreshInput(): AutonomyTransitionInput {
  const input = createClaimingInput();
  input.nextState = AUTONOMY_STATE_IDLE;
  input.retryTick = 2;
  input.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_WAIT;
  input.candidateId = AUTONOMY_REF_NONE;
  input.targetEntityIndex = AUTONOMY_REF_NONE;
  input.targetEntityGeneration = AUTONOMY_REF_NONE;
  input.targetCellIndex = AUTONOMY_REF_NONE;
  input.needLane = AUTONOMY_REF_NONE;
  input.ability = AUTONOMY_REF_NONE;
  input.scheduleCode = AUTONOMY_REF_NONE;
  writeWaitBasis(input.basis);
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_IDLE_RETRY_BACKOFF,
    AUTONOMY_REASON_SOURCE_IDLE,
    0,
    1,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    0,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  return input;
}

function createClaimPlanOutput(): AutonomyClaimPlanIntoOutput {
  const owner = { index: 1, generation: 2 };
  const claimSlots: AutonomyClaimSlotScratchTuple = [
    createClaimSlotScratch(),
    createClaimSlotScratch(),
    createClaimSlotScratch(),
    createClaimSlotScratch(),
    createClaimSlotScratch(),
    createClaimSlotScratch(),
    createClaimSlotScratch(),
    createClaimSlotScratch(),
  ];
  return {
    header: {
      ok: true,
      reasonCode: AUTONOMY_REASON_OFFER_SELECTED,
      candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_ORDINARY,
      candidateId: 3,
      pendingJobId: 41,
      targetId: 5,
      targetCellIndex: 7,
      claimCount: 0,
    },
    owner,
    target: { index: 5, generation: 6 },
    item: { index: 7, generation: 8 },
    transaction: {
      owner,
      jobId: 41,
      createdTick: 9,
      leaseExpiryTick: 10,
      claims: [],
    },
    claimSlots,
  };
}

function createClaimSlotScratch(): AutonomyClaimSlotScratch {
  const entityTarget = { index: 5, generation: 6 };
  const itemTarget = { index: 7, generation: 8 };
  return {
    entityTarget,
    itemTarget,
    entityClaim: { channel: "entity", target: entityTarget },
    cellClaim: { channel: "cell", cellIndex: 9 },
    itemQuantityClaim: {
      channel: "item_quantity",
      item: itemTarget,
      amount: 2,
      availableAmount: 3,
    },
    interactionSpotClaim: { channel: "interaction_spot", target: entityTarget, spotId: 4 },
    capacityClaim: {
      channel: "capacity",
      target: entityTarget,
      capacityId: 5,
      amount: 1,
      capacity: 2,
    },
  };
}

function createStoreOutput(): AutonomyStoreOutput {
  return {
    ok: false,
    code: AUTONOMY_STORE_OK,
    residentIndex: AUTONOMY_REF_NONE,
    residentGeneration: AUTONOMY_REF_NONE,
    previousState: AUTONOMY_STATE_IDLE,
    nextState: AUTONOMY_STATE_IDLE,
    rowVersion: 0,
    storeVersion: 0,
  };
}

function createReadOutput(
  routeCapacity = AUTONOMY_MAX_ROUTE_CELLS,
  claimCapacity = AUTONOMY_MAX_CLAIM_REFS,
): ResidentAutonomyReadOutput {
  return {
    ok: false,
    code: AUTONOMY_STORE_OK,
    residentIndex: AUTONOMY_REF_NONE,
    residentGeneration: AUTONOMY_REF_NONE,
    state: AUTONOMY_STATE_IDLE,
    stateEnteredTick: 0,
    retryTick: 0,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_NONE,
    candidateId: AUTONOMY_REF_NONE,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    targetEntityIndex: AUTONOMY_REF_NONE,
    targetEntityGeneration: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    routeCellCount: 0,
    routeCursor: 0,
    routeCells: new Uint32Array(routeCapacity),
    claimCount: 0,
    claimIds: new Uint32Array(claimCapacity),
    needLane: AUTONOMY_REF_NONE,
    needValue: 0,
    ability: AUTONOMY_REF_NONE,
    scheduleCode: AUTONOMY_REF_NONE,
    rowVersion: 0,
    storeVersion: 0,
    basis: createBasis(),
    reason: createReason(),
    terminal: createTerminal(),
  };
}

function createClaimingInput(): AutonomyTransitionInput {
  const reason = createReason();
  writeAutonomyReason(
    reason,
    AUTONOMY_REASON_OFFER_SELECTED,
    AUTONOMY_REASON_SOURCE_OFFER,
    0,
    1,
    5,
    2,
    0,
    99,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
  const routeCells = new Uint32Array(AUTONOMY_MAX_ROUTE_CELLS);
  const claimIds = new Uint32Array(AUTONOMY_MAX_CLAIM_REFS);
  routeCells.fill(AUTONOMY_REF_NONE);
  claimIds.fill(AUTONOMY_REF_NONE);
  return {
    residentIndex: 0,
    residentGeneration: 1,
    expectedState: AUTONOMY_STATE_IDLE,
    expectedRowVersion: 1,
    nextState: AUTONOMY_STATE_CLAIMING,
    stateEnteredTick: 1,
    retryTick: 0,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_ORDINARY,
    candidateId: 3,
    jobId: AUTONOMY_REF_NONE,
    pendingJobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    targetEntityIndex: 5,
    targetEntityGeneration: 2,
    targetCellIndex: 7,
    routeCellCount: 0,
    routeCursor: 0,
    routeCells,
    claimCount: 0,
    claimIds,
    needLane: 0,
    needValue: 100,
    ability: 1,
    scheduleCode: 1,
    basis: createBasis(),
    reason,
  };
}

function createBasis(): AutonomyVersionBasis {
  return {
    candidateId: 3,
    candidateOwnerVersion: 99,
    candidateRowVersion: 99,
    candidateIndexVersion: 99,
    candidateBacklog: 0,
    needOwnerVersion: 99,
    scheduleVersion: 99,
    capabilityConditionVersion: 99,
    capabilityBaseVersion: 99,
    foodAvailabilityVersion: 0,
    foodItemVersion: 0,
    foodMealWindowId: 0,
    foodMealWindowVersion: 0,
    foodDirtyBacklog: 0,
    restStoreVersion: 0,
    restCachedRowVersion: 0,
    restCurrentRowVersion: 0,
    restSourceVersion: 0,
    restIndexVersion: 0,
    restDirtyBacklog: 0,
    restScheduleWindowCode: 0,
    restScheduleWindowVersion: 0,
    restWeatherExposureCode: 0,
    restWeatherVersion: 0,
    restWeatherSourceVersion: 0,
    restOutdoorWorkAllowed: 0,
    medicalStoreVersion: 0,
    medicalHealthStoreVersion: 0,
    medicalConditionVersion: 0,
    medicalActorVersion: 0,
    medicalCaregiverId: 0,
    medicalCaregiverRegionId: 0,
    medicalCaregiverPermissionId: 0,
    medicalCaregiverAbility: 0,
    medicalCaregiverMinimumAbility: 0,
    medicalCaregiverAbilityValue: 0,
    medicalCaregiverActorConditionVersion: 0,
    medicalCaregiverBaseAbilityVersion: 0,
    medicalCaregiverValid: 0,
    medicalCaregiverAllowed: 0,
    pathMapVersion: 99,
    pathNavigationVersion: 99,
    pathRegionVersion: 99,
    pathRoomVersion: 99,
    pathRegionGraphVersion: 99,
    reservationVersion: 99,
    jobVersion: 0,
  };
}

function writeWaitBasis(basis: AutonomyVersionBasis): void {
  basis.candidateId = AUTONOMY_REF_NONE;
  basis.candidateOwnerVersion = 0;
  basis.candidateRowVersion = 0;
  basis.candidateIndexVersion = 0;
  basis.candidateBacklog = 0;
}

function writeAcquiredReason(input: AutonomyTransitionInput): void {
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_RESERVATION_ACQUIRED,
    AUTONOMY_REASON_SOURCE_RESERVATION,
    input.residentIndex,
    input.residentGeneration,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    input.basis.reservationVersion,
    AUTONOMY_SUGGESTION_INSPECT_TARGET,
    0,
    0,
    0,
    0,
    0,
    0,
  );
}

function writeFailedInvariantReason(input: AutonomyTransitionInput): void {
  writeAutonomyReason(
    input.reason,
    AUTONOMY_REASON_FAILED_INVARIANT,
    AUTONOMY_REASON_SOURCE_SYSTEM,
    input.residentIndex,
    input.residentGeneration,
    input.targetEntityIndex,
    input.targetEntityGeneration,
    0,
    input.basis.jobVersion,
    AUTONOMY_SUGGESTION_INSPECT_RESIDENT,
    0,
    0,
    0,
    0,
    0,
    0,
  );
}

function createReason(): AutonomyReasonOutput {
  return {
    code: AUTONOMY_REASON_NONE,
    source: AUTONOMY_REASON_SOURCE_NONE,
    subjectIndex: AUTONOMY_REASON_REF_NONE,
    subjectGeneration: AUTONOMY_REASON_REF_NONE,
    targetIndex: AUTONOMY_REASON_REF_NONE,
    targetGeneration: AUTONOMY_REASON_REF_NONE,
    parameterCount: 0,
    parameter0: 0,
    parameter1: 0,
    parameter2: 0,
    parameter3: 0,
    parameter4: 0,
    parameter5: 0,
    ownerBasis: 0,
    suggestion: AUTONOMY_SUGGESTION_NONE,
  };
}

function createTerminal(): AutonomyTerminalOutput {
  return {
    present: true,
    state: AUTONOMY_STATE_IDLE,
    tick: 99,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_NONE,
    candidateId: AUTONOMY_REF_NONE,
    jobId: AUTONOMY_REF_NONE,
    interruptionPolicyCode: AUTONOMY_INTERRUPTION_POLICY_NONE,
    jobVersion: 0,
    targetEntityIndex: AUTONOMY_REF_NONE,
    targetEntityGeneration: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    reason: createReason(),
  };
}

function cloneSnapshot(snapshot: ResidentAutonomySnapshot): ResidentAutonomySnapshot {
  return {
    snapshotVersion: snapshot.snapshotVersion,
    capacity: snapshot.capacity,
    storeVersion: snapshot.storeVersion,
    active: snapshot.active.slice(),
    lanes: snapshot.lanes.slice(),
    reasonParameters: snapshot.reasonParameters.slice(),
    ticks: snapshot.ticks.slice(),
    routeCells: snapshot.routeCells.slice(),
    claimIds: snapshot.claimIds.slice(),
  };
}

interface MutableCounter {
  value: number;
}

interface CoordinatorFixture {
  readonly coordinator: ResidentAutonomyCoordinator;
  readonly dependencies: ResidentAutonomyCoordinatorDependencies;
  readonly claimPlanReadCount: MutableCounter;
}

function createCoordinatorFixture(
  offerCount: number,
  restCount = 0,
  enabledSourceCount = 1,
  ordinaryDescriptorCount = 1,
  registerNeedActor = true,
  ordinaryDistanceWeight = 0,
  enabledSourceMask = 0,
): CoordinatorFixture {
  const actorCapacity = 2;
  const entities = createEntityRegistry({ capacity: 64 });
  const allocation = entities.allocate();
  if (!allocation.ok) throw new Error("test resident allocation failed");
  const autonomyStore = new ResidentAutonomyStore(actorCapacity);
  const storeOutput = createStoreOutput();
  autonomyStore.registerResidentInto(0, allocation.entity.generation, 0, storeOutput);
  expect(storeOutput.ok).toBe(true);
  const needs = createNeedStore({ actorCapacity, updateIntervalTicks: 8 });
  if (registerNeedActor)
    expect(
      needs.registerActor({
        actorId: 0,
        hunger: 500,
        rest: 500,
        comfort: 500,
        social: 500,
        safety: 500,
        sourceTick: 0,
      }),
    ).toMatchObject({ ok: true });
  const healthConditions = createM3HealthConditionStore({
    actorCapacity,
    conditionCapacity: 4,
    abilityDirtyCapacity: 8,
  });
  const abilities = createM3AbilityCacheStore({ actorCapacity, dirtyCapacity: 8 });
  const map = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
  const reservations = createReservationLedger({ capacity: 64, entityCapacity: 64, cellCount: 16 });
  const workOffers = createWorkOfferIndex({
    capacity: 32,
    workTypeCapacity: 2,
    regionCapacity: 2,
    defCapacity: 2,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });
  const mutation = createOfferMutationOutputForAutonomy();
  for (let offerId = 0; offerId < offerCount; offerId += 1) {
    workOffers.registerOfferInto(
      {
        offerId,
        workType: 0,
        regionId: 0,
        defId: 0,
        urgencyBucket: 0,
        permissionId: 0,
        targetId: offerId + 10,
        targetCellIndex: (offerId % 15) + 1,
        scoreMilli: (restCount > 0 ? 9_999 : 10_000) - offerId,
        ownerVersion: 1,
      },
      mutation,
    );
    expect(mutation.ok).toBe(true);
  }
  const restStore = createRestSleepStore(12, 2, 2);
  const restCandidates = createRestCandidateIndex({
    fixtureCapacity: 12,
    regionCapacity: 2,
    permissionCapacity: 2,
  });
  for (let fixtureId = 0; fixtureId < restCount; fixtureId += 1) {
    const fixtureAllocation = entities.allocate();
    if (!fixtureAllocation.ok) throw new Error("test fixture allocation failed");
    expect(
      restStore.registerFixture(
        {
          fixtureId,
          entity: fixtureAllocation.entity,
          kind: "clinic_mat",
          restKind: "rest",
          regionId: 0,
          targetCellIndex: 15,
          interactionSpotId: fixtureId,
          scheduleWindow: "dawn",
          weatherExposure: "indoor",
          permissionId: 0,
          recoveryPerTickQ16: 10 << 16,
          baseScoreMilli: 10_000,
        },
        entities,
      ),
    ).toMatchObject({ ok: true });
    expect(restCandidates.markFixtureDirty(fixtureId)).toMatchObject({ ok: true });
  }
  expect(restCandidates.refreshDirty(restStore, Math.max(restCount, 1))).toMatchObject({
    ok: true,
  });
  const generation = allocation.entity.generation;
  const scheduleFacts = createScheduleFacts(actorCapacity, generation, 0);
  const jobFacts = createJobFacts(actorCapacity, generation, 0);
  const wakeFacts = createWakeFacts(actorCapacity, generation, 0);
  const claimPlanReadCount: MutableCounter = { value: 0 };
  const dependencies: ResidentAutonomyCoordinatorDependencies = {
    autonomyStore,
    needs,
    scheduleFacts,
    jobFacts,
    wakeFacts,
    food: createM3FoodAvailabilityStore(12, 2, 2),
    restStore,
    restCandidates,
    medical: createM3MedicalCareStore({
      requestCapacity: 12,
      actorCapacity,
      regionCapacity: 2,
      urgencyBucketCount: 2,
      permissionCapacity: 2,
    }),
    workOffers,
    map,
    pathBasis: {
      mapVersion: map.globalVersion,
      navigationVersion: 1,
      regionVersion: 1,
      roomVersion: 1,
      regionGraphVersion: 1,
    },
    pathfinder: createGridPathfinder(map.cellCount),
    abilities,
    healthConditions,
    reservations,
    entities,
    claimPlans: {
      readPlanInto(_source, _candidate, _target, _cell, output): void {
        claimPlanReadCount.value += 1;
        resetAutonomyClaimPlanInto(output);
      },
    },
  };
  if (enabledSourceCount >= 4 || (enabledSourceMask & 4) !== 0) {
    expect(
      dependencies.medical.updateCaregiverStateFromAbility(
        {
          caregiverId: 0,
          regionId: 0,
          permissionId: 0,
          ability: 4,
          minimumValue: 100,
          allowed: true,
        },
        healthConditions,
        abilities,
      ),
    ).toMatchObject({ ok: true });
  }
  const policy = createEnabledSourcePolicyInput(
    enabledSourceCount,
    ordinaryDescriptorCount,
    ordinaryDistanceWeight,
    enabledSourceMask,
  );
  return {
    coordinator: new ResidentAutonomyCoordinator(dependencies, policy),
    dependencies,
    claimPlanReadCount,
  };
}

function createEnabledSourcePolicyInput(
  enabledSourceCount: number,
  ordinaryDescriptorCount: number,
  ordinaryDistanceWeight: number,
  enabledSourceMask: number,
): AutonomyDecisionPolicyInput {
  const policy = createDecisionPolicyInput();
  policy.sourceEnabledFlags.fill(0);
  policy.ordinaryDescriptorCounts.fill(ordinaryDescriptorCount);
  for (let table = 0; table < policy.policyClassCount * AUTONOMY_SCHEDULE_CODE_COUNT; table += 1) {
    const base = table * AUTONOMY_ORDINARY_MAX_BUCKETS;
    for (let descriptor = 0; descriptor < ordinaryDescriptorCount; descriptor += 1) {
      const lane = base + descriptor;
      policy.ordinaryWorkTypes[lane] = descriptor % 2;
      policy.ordinaryDefinitionIds[lane] = Math.floor(descriptor / 2) % 2;
      policy.ordinaryUrgencyBuckets[lane] = Math.floor(descriptor / 4) % 2;
    }
  }
  policy.ordinaryRequiredAbilityIds.fill(M3_ABILITY_MANIPULATION);
  policy.ordinaryMinimumAbilityValues.fill(100);
  policy.sourceDistanceWeights[3] = ordinaryDistanceWeight;
  for (let table = 0; table < policy.policyClassCount * AUTONOMY_SCHEDULE_CODE_COUNT; table += 1) {
    const base = table * AUTONOMY_REAL_SOURCE_COUNT;
    if (enabledSourceMask === 0) {
      policy.sourceEnabledFlags[base + 3] = 1;
      if (enabledSourceCount >= 2) policy.sourceEnabledFlags[base + 1] = 1;
      if (enabledSourceCount >= 3) policy.sourceEnabledFlags[base] = 1;
      if (enabledSourceCount >= 4) policy.sourceEnabledFlags[base + 2] = 1;
    } else {
      if ((enabledSourceMask & 1) !== 0) policy.sourceEnabledFlags[base] = 1;
      if ((enabledSourceMask & 2) !== 0) policy.sourceEnabledFlags[base + 1] = 1;
      if ((enabledSourceMask & 4) !== 0) policy.sourceEnabledFlags[base + 2] = 1;
      if ((enabledSourceMask & 8) !== 0) policy.sourceEnabledFlags[base + 3] = 1;
    }
  }
  if (enabledSourceCount >= 2) {
    policy.sourceHardPriorities[1] = 0;
    policy.sourceHardPriorities[3] = 0;
    policy.sourceDistanceWeights[1] = 1_000;
  }
  return policy;
}

function createOfferMutationOutputForAutonomy(): WorkOfferMutationIntoOutput {
  return {
    ok: false,
    reason: undefined,
    offerId: 0,
    ownerVersion: 0,
    rowVersion: 0,
    indexVersion: 0,
  };
}

function createScheduleFacts(
  capacity: number,
  generation: number,
  tick: number,
): AutonomyScheduleFactsLane {
  const residentGenerations = new Uint32Array(capacity);
  const windowOpenFlags = new Uint8Array(capacity);
  const allowedWorkTypeMasks = new Uint32Array(capacity);
  const ownerVersions = new Uint32Array(capacity);
  const mealWindowVersions = new Uint32Array(capacity);
  const weatherVersions = new Uint32Array(capacity);
  const weatherSourceVersions = new Uint32Array(capacity);
  const outdoorWorkAllowedFlags = new Uint8Array(capacity);
  residentGenerations[0] = generation;
  windowOpenFlags[0] = 1;
  allowedWorkTypeMasks[0] = 1;
  ownerVersions[0] = 1;
  mealWindowVersions[0] = 1;
  weatherVersions[0] = 1;
  weatherSourceVersions[0] = 1;
  outdoorWorkAllowedFlags[0] = 1;
  return {
    sourceTick: tick,
    residentGenerations,
    scheduleCodes: new Uint8Array(capacity),
    windowOpenFlags,
    allowedWorkTypeMasks,
    permissionIds: new Uint32Array(capacity),
    ownerVersions,
    mealWindowIds: new Uint32Array(capacity),
    mealWindowVersions,
    weatherExposureCodes: new Uint8Array(capacity),
    weatherVersions,
    weatherSourceVersions,
    outdoorWorkAllowedFlags,
  };
}

function createJobFacts(capacity: number, generation: number, tick: number): AutonomyJobFactsLane {
  const residentGenerations = new Uint32Array(capacity);
  residentGenerations[0] = generation;
  return {
    sourceTick: tick,
    residentGenerations,
    activeFlags: new Uint8Array(capacity),
    jobIds: new Uint32Array(capacity).fill(AUTONOMY_REF_NONE),
    jobVersions: new Uint32Array(capacity),
    interruptionPolicyCodes: new Uint8Array(capacity),
    safePointFlags: new Uint8Array(capacity),
  };
}

function createWakeFacts(
  capacity: number,
  generation: number,
  tick: number,
): AutonomyWakeFactsLane {
  const residentGenerations = new Uint32Array(capacity);
  const wakeMasks = new Uint8Array(capacity);
  const eventVersions = new Uint32Array(capacity);
  residentGenerations[0] = generation;
  wakeMasks[0] = 1;
  eventVersions[0] = 1;
  return { sourceTick: tick, residentGenerations, wakeMasks, eventVersions };
}

function createDecisionScratch(): AutonomyDecisionScratch {
  return {
    residentReadOutput: createReadOutput(),
    globalBudget: {
      visitedCap: AUTONOMY_MAX_VISITED_CANDIDATES,
      retainedCap: AUTONOMY_MAX_RETAINED_CANDIDATES,
      exactPathCap: AUTONOMY_MAX_EXACT_PATHS,
      visitedCount: 0,
      retainedCount: 0,
      exactPathCount: 0,
    },
    globalRetained: createGlobalRetainedLanes(),
    needValues: new Uint16Array(5),
    needOwnerVersions: new Uint32Array(5),
    candidates: {
      food: createCandidateLane(AUTONOMY_CANDIDATE_SOURCE_FOOD, 0),
      rest: createCandidateLane(AUTONOMY_CANDIDATE_SOURCE_REST, 1),
      medical: createCandidateLane(AUTONOMY_CANDIDATE_SOURCE_MEDICAL, 2),
      ordinary: createCandidateLane(AUTONOMY_CANDIDATE_SOURCE_ORDINARY, 3),
      wait: createCandidateLane(AUTONOMY_CANDIDATE_SOURCE_WAIT, 4),
    },
    foodQuery: {
      foodDefId: 0,
      regionId: 0,
      permissionId: 0,
      mealWindowId: 0,
      candidateCap: 1,
      maxSelected: 1,
    },
    foodScratch: createFoodSelectionScratchForAutonomy(),
    foodOutput: createFoodSelectionOutputForAutonomy(),
    foodReadOutput: createFoodReadOutputForAutonomy(),
    restQuery: {
      regionId: 0,
      restKind: "rest",
      scheduleWindow: "dawn",
      weatherExposure: "indoor",
      permissionId: 0,
      candidateCap: 1,
      maxSelectedFixtures: 1,
    },
    restEnvironment: {
      scheduleWindow: "dawn",
      scheduleWindowVersion: 0,
      weatherExposure: "indoor",
      outdoorWorkAllowed: true,
      weatherVersion: 0,
      weatherSourceVersion: 0,
    },
    restScratch: createRestSelectionScratchForAutonomy(),
    restOutput: createRestSelectionOutputForAutonomy(),
    restReadOutput: createRestReadOutputForAutonomy(),
    medicalOptions: {
      caregiverId: 0,
      regionId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      candidateCap: 1,
      maxSelectedRequests: 1,
    },
    medicalScratch: createMedicalSelectionScratchForAutonomy(),
    medicalOutput: createMedicalSelectionOutputForAutonomy(),
    medicalPatientReadOutput: createMedicalPatientOutputForAutonomy(),
    medicalCaregiverReadOutput: createMedicalCaregiverOutputForAutonomy(),
    ordinaryOptions: {
      pawnId: 0,
      workType: 0,
      regionId: 0,
      defId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      candidateCap: 1,
      maxSelectedOffers: 1,
    },
    ordinaryScratch: createOfferSelectionScratchForAutonomy(),
    ordinaryOutput: createOfferSelectionOutputForAutonomy(),
    ordinaryReadOutput: createOfferReadOutputForAutonomy(),
    pathRequest: {
      requestSequence: 0,
      issuedTick: 0,
      startCellIndex: 0,
      goalCellIndex: 0,
      basis: {
        mapVersion: 0,
        navigationVersion: 0,
        regionVersion: 0,
        roomVersion: 0,
        regionGraphVersion: 0,
      },
      maxNodeExpansions: 1,
    },
    pathOutput: createPathOutputForAutonomy(),
    pathRouteCells: new Uint32Array(AUTONOMY_MAX_ROUTE_CELLS),
    selectedRouteCells: new Uint32Array(AUTONOMY_MAX_ROUTE_CELLS),
    abilityOutput: createAbilityOutputForAutonomy(),
    selectedBasis: createBasis(),
    claimPlanOutput: createClaimPlanOutput(),
    reservationScratch: createReservationScratchForAutonomy(),
    reservationOutput: createReservationOutputForAutonomy(),
    reservationClaimIds: new Uint32Array(AUTONOMY_MAX_CLAIM_REFS),
    transitionInput: createClaimingInput(),
    transitionValidationOutput: createStoreOutput(),
    transitionOutput: createStoreOutput(),
  };
}

function createGlobalRetainedLanes(): AutonomyGlobalRetainedLanes {
  const cap = AUTONOMY_MAX_RETAINED_CANDIDATES;
  return {
    count: 0,
    sourceCodes: new Uint8Array(cap),
    slotCodes: new Uint8Array(cap),
    sourceScratchRowIndexes: new Uint8Array(cap),
    policyDescriptorIndexes: new Uint8Array(cap),
    needLaneCodes: new Uint8Array(cap),
    candidateIds: new Uint32Array(cap),
    targetIds: new Uint32Array(cap),
    targetCellIndexes: new Uint32Array(cap),
    rawScores: new Float64Array(cap),
    cheapAdmissionKeys: new Float64Array(cap),
    commonScores: new Float64Array(cap),
    scoreInvocationCounts: new Uint8Array(cap),
    needValues: new Uint16Array(cap),
    needOwnerVersions: new Uint32Array(cap),
    scheduleCodes: new Uint8Array(cap),
    scheduleVersions: new Uint32Array(cap),
    abilityIds: new Uint8Array(cap),
    abilityMinimumValues: new Uint16Array(cap),
    abilityValues: new Uint16Array(cap),
    abilityConditionVersions: new Uint32Array(cap),
    abilityBaseVersions: new Uint32Array(cap),
  };
}

function createCandidateLane(
  sourceCode: 1 | 2 | 3 | 4 | 5,
  slotCode: number,
): AutonomyCandidateLane {
  return {
    sourceCode,
    slotCode,
    candidateId: AUTONOMY_REF_NONE,
    scoreMilli: 0,
    targetId: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    basis: createBasis(),
  };
}

function createFoodSelectionScratchForAutonomy(): AutonomyDecisionScratch["foodScratch"] {
  const cap = AUTONOMY_MAX_RETAINED_CANDIDATES;
  return {
    stackIds: new Uint32Array(cap),
    foodDefIds: new Uint32Array(cap),
    regionIds: new Uint32Array(cap),
    storageSlotIds: new Uint32Array(cap),
    targetCellIndexes: new Uint32Array(cap),
    interactionSpotIds: new Uint32Array(cap),
    scoreMillis: new Uint32Array(cap),
    permissionIds: new Uint32Array(cap),
    mealWindowIds: new Uint32Array(cap),
    mealWindowVersions: new Uint32Array(cap),
    safeFlags: new Uint8Array(cap),
    permissionAllowedFlags: new Uint8Array(cap),
    scheduleAllowedFlags: new Uint8Array(cap),
    availableAmounts: new Uint32Array(cap),
    itemStoreVersions: new Uint32Array(cap),
    linkedCandidateFlags: new Uint8Array(cap),
  };
}

function createFoodSelectionOutputForAutonomy(): AutonomyDecisionScratch["foodOutput"] {
  return {
    ok: false,
    reason: undefined,
    queryFoodDefId: 0,
    queryRegionId: 0,
    queryPermissionId: 0,
    queryMealWindowId: 0,
    candidateCap: 0,
    maxSelected: 0,
    bucketCandidateCount: 0,
    visitedCount: 0,
    selectedCount: 0,
    candidateCapHit: false,
    selectedCapHit: false,
    selectedStackId: AUTONOMY_REF_NONE,
    selectedFoodDefId: 0,
    selectedRegionId: 0,
    selectedStorageSlotId: 0,
    selectedTargetCellIndex: AUTONOMY_REF_NONE,
    selectedInteractionSpotId: 0,
    selectedScoreMilli: 0,
    selectedPermissionId: 0,
    selectedMealWindowId: 0,
    selectedMealWindowVersion: 0,
    selectedSafe: false,
    selectedPermissionAllowed: false,
    selectedScheduleAllowed: false,
    selectedAvailableAmount: 0,
    sourceItemVersion: 0,
    selectedLinkedCandidate: false,
    foodAvailabilityVersion: 0,
    dirtyBacklog: 0,
  };
}

function createFoodReadOutputForAutonomy(): AutonomyDecisionScratch["foodReadOutput"] {
  return {
    ok: false,
    reason: undefined,
    stackId: AUTONOMY_REF_NONE,
    foodDefId: 0,
    regionId: 0,
    storageSlotId: 0,
    targetCellIndex: AUTONOMY_REF_NONE,
    interactionSpotId: 0,
    scoreMilli: 0,
    permissionId: 0,
    mealWindowId: 0,
    mealWindowVersion: 0,
    safe: false,
    permissionAllowed: false,
    scheduleAllowed: false,
    availableAmount: 0,
    itemStoreVersion: 0,
    foodAvailabilityVersion: 0,
    active: false,
    linkedCandidate: false,
    dirtyBacklog: 0,
  };
}

function createRestReadOutputForAutonomy(): AutonomyDecisionScratch["restReadOutput"] {
  return {
    ok: false,
    reason: undefined,
    fixtureId: AUTONOMY_REF_NONE,
    active: false,
    entityIndex: AUTONOMY_REF_NONE,
    entityGeneration: AUTONOMY_REF_NONE,
    kind: undefined,
    restKind: undefined,
    regionId: 0,
    targetCellIndex: AUTONOMY_REF_NONE,
    interactionSpotId: 0,
    scheduleWindow: undefined,
    weatherExposure: undefined,
    permissionId: 0,
    recoveryPerTickQ16: 0,
    baseScoreMilli: 0,
    ownerVersion: 0,
    storeVersion: 0,
  };
}

function createRestSelectionScratchForAutonomy(): AutonomyDecisionScratch["restScratch"] {
  const cap = AUTONOMY_MAX_RETAINED_CANDIDATES;
  return {
    fixtureReadOutput: createRestReadOutputForAutonomy(),
    fixtureIds: new Uint32Array(cap),
    entityIndexes: new Uint32Array(cap),
    entityGenerations: new Uint32Array(cap),
    fixtureKindCodes: new Uint8Array(cap),
    restKindCodes: new Uint8Array(cap),
    regionIds: new Uint32Array(cap),
    targetCellIndexes: new Uint32Array(cap),
    interactionSpotIds: new Uint32Array(cap),
    scheduleCodes: new Uint8Array(cap),
    weatherCodes: new Uint8Array(cap),
    permissionIds: new Uint32Array(cap),
    recoveryPerTickQ16s: new Uint32Array(cap),
    scoreMillis: new Uint32Array(cap),
    cachedFixtureVersions: new Uint32Array(cap),
    currentFixtureOwnerVersions: new Uint32Array(cap),
    linkedCandidateFlags: new Uint8Array(cap),
  };
}

function createRestSelectionOutputForAutonomy(): AutonomyDecisionScratch["restOutput"] {
  return {
    ok: false,
    reason: undefined,
    queryRegionId: 0,
    queryRestKind: undefined,
    queryScheduleWindow: undefined,
    queryWeatherExposure: undefined,
    queryPermissionId: 0,
    candidateCap: 0,
    maxSelectedFixtures: 0,
    environmentScheduleWindow: undefined,
    scheduleWindowVersion: 0,
    environmentWeatherExposure: undefined,
    outdoorWorkAllowed: false,
    weatherVersion: 0,
    weatherSourceVersion: 0,
    candidateTotal: 0,
    visitedCount: 0,
    selectedCount: 0,
    candidateCapHit: false,
    selectedCapHit: false,
    selectedFixtureId: AUTONOMY_REF_NONE,
    selectedEntityIndex: AUTONOMY_REF_NONE,
    selectedEntityGeneration: AUTONOMY_REF_NONE,
    selectedFixtureKind: undefined,
    selectedRestKind: undefined,
    selectedRegionId: 0,
    selectedTargetCellIndex: AUTONOMY_REF_NONE,
    selectedInteractionSpotId: 0,
    selectedScheduleWindow: undefined,
    selectedWeatherExposure: undefined,
    selectedPermissionId: 0,
    selectedRecoveryPerTickQ16: 0,
    selectedScoreMilli: 0,
    selectedCachedFixtureVersion: 0,
    selectedCurrentFixtureOwnerVersion: 0,
    selectedLinkedCandidate: false,
    restStoreVersion: 0,
    sourceVersion: 0,
    indexVersion: 0,
    dirtyBacklog: 0,
  };
}

function createMedicalPatientOutputForAutonomy(): AutonomyDecisionScratch["medicalPatientReadOutput"] {
  return {
    ok: false,
    reason: undefined,
    requestId: AUTONOMY_REF_NONE,
    active: false,
    patientId: AUTONOMY_REF_NONE,
    conditionId: AUTONOMY_REF_NONE,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
    treatmentDefId: 0,
    stockDefId: 0,
    stockAmount: 0,
    targetCellIndex: AUTONOMY_REF_NONE,
    scoreMilli: 0,
    conditionVersion: 0,
    actorConditionVersion: 0,
    healthStoreVersion: 0,
    severity: 0,
    clueRef: 0,
    counterevidenceRef: 0,
    medicalStoreVersion: 0,
  };
}

function createMedicalCaregiverOutputForAutonomy(): AutonomyDecisionScratch["medicalCaregiverReadOutput"] {
  return {
    ok: false,
    reason: undefined,
    caregiverId: AUTONOMY_REF_NONE,
    valid: false,
    regionId: 0,
    permissionId: 0,
    ability: 0,
    minimumValue: 0,
    allowed: false,
    abilityValue: 0,
    actorConditionVersion: 0,
    baseAbilityVersion: 0,
    medicalStoreVersion: 0,
  };
}

function createMedicalSelectionScratchForAutonomy(): AutonomyDecisionScratch["medicalScratch"] {
  const cap = AUTONOMY_MAX_RETAINED_CANDIDATES;
  return {
    patientReadOutput: createMedicalPatientOutputForAutonomy(),
    caregiverReadOutput: createMedicalCaregiverOutputForAutonomy(),
    abilityQueryOutput: createAbilityOutputForAutonomy(),
    requestIds: new Uint32Array(cap),
    patientIds: new Uint32Array(cap),
    conditionIds: new Uint32Array(cap),
    regionIds: new Uint32Array(cap),
    urgencyBuckets: new Uint32Array(cap),
    permissionIds: new Uint32Array(cap),
    treatmentDefIds: new Uint32Array(cap),
    stockDefIds: new Uint32Array(cap),
    stockAmounts: new Uint32Array(cap),
    targetCellIndexes: new Uint32Array(cap),
    scoresMilli: new Int32Array(cap),
    conditionVersions: new Uint32Array(cap),
    actorConditionVersions: new Uint32Array(cap),
    healthStoreVersions: new Uint32Array(cap),
    severities: new Uint16Array(cap),
    clueRefs: new Uint32Array(cap),
    counterevidenceRefs: new Uint32Array(cap),
  };
}

function createMedicalSelectionOutputForAutonomy(): AutonomyDecisionScratch["medicalOutput"] {
  return {
    ok: false,
    reason: undefined,
    queryCaregiverId: 0,
    queryRegionId: 0,
    queryUrgencyBucket: 0,
    queryPermissionId: 0,
    candidateCap: 0,
    maxSelectedRequests: 0,
    bucketCandidateCount: 0,
    visitedCount: 0,
    scoredCount: 0,
    selectedCount: 0,
    candidateCapHit: false,
    selectedCapHit: false,
    rejectedByCandidateCap: 0,
    rejectedByPermission: 0,
    rejectedByAbility: 0,
    rejectedByCondition: 0,
    rejectedByStaleBasis: 0,
    selectedRequestId: AUTONOMY_REF_NONE,
    selectedPatientId: AUTONOMY_REF_NONE,
    selectedConditionId: AUTONOMY_REF_NONE,
    selectedRegionId: 0,
    selectedUrgencyBucket: 0,
    selectedPermissionId: 0,
    selectedTreatmentDefId: 0,
    selectedStockDefId: 0,
    selectedStockAmount: 0,
    selectedTargetCellIndex: AUTONOMY_REF_NONE,
    selectedScoreMilli: 0,
    selectedConditionVersion: 0,
    selectedActorConditionVersion: 0,
    selectedHealthStoreVersion: 0,
    selectedSeverity: 0,
    selectedClueRef: 0,
    selectedCounterevidenceRef: 0,
    selectedCaregiverId: AUTONOMY_REF_NONE,
    caregiverRegionId: 0,
    caregiverPermissionId: 0,
    caregiverAbility: 0,
    caregiverMinimumValue: 0,
    caregiverAbilityValue: 0,
    caregiverActorConditionVersion: 0,
    caregiverBaseAbilityVersion: 0,
    caregiverValid: false,
    caregiverAllowed: false,
    medicalStoreVersion: 0,
    healthStoreVersion: 0,
  };
}

function createOfferSelectionScratchForAutonomy(): WorkOfferSelectionIntoScratch {
  const cap = AUTONOMY_MAX_RETAINED_CANDIDATES;
  return {
    candidateOfferIds: new Uint32Array(cap),
    selectedOfferIds: new Uint32Array(cap),
    selectedScoresMilli: new Int32Array(cap),
    selectedOwnerVersions: new Uint32Array(cap),
    selectedRowVersions: new Uint32Array(cap),
    selectedTargetIds: new Uint32Array(cap),
    selectedTargetCellIndexes: new Uint32Array(cap),
  };
}

function createOfferSelectionOutputForAutonomy(): WorkOfferSelectionIntoOutput {
  return {
    ok: false,
    reason: undefined,
    selectedCount: 0,
    bucketCandidateCount: 0,
    visitedCount: 0,
    scoredCount: 0,
    rejectedByCandidateCap: 0,
    rejectedBySelectedCap: 0,
    selectedOfferId: AUTONOMY_REF_NONE,
    selectedOwnerVersion: 0,
    selectedRowVersion: 0,
    selectedIndexVersion: 0,
    selectedTargetId: AUTONOMY_REF_NONE,
    selectedTargetCellIndex: AUTONOMY_REF_NONE,
    selectedScoreMilli: 0,
  };
}

function createOfferReadOutputForAutonomy(): WorkOfferReadIntoOutput {
  return {
    ok: false,
    reason: undefined,
    offerId: AUTONOMY_REF_NONE,
    ownerVersion: 0,
    rowVersion: 0,
    indexVersion: 0,
    workType: 0,
    regionId: 0,
    defId: 0,
    urgencyBucket: 0,
    permissionId: 0,
    targetId: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    scoreMilli: 0,
  };
}

function createPathOutputForAutonomy(): PathSearchIntoOutput {
  return {
    ok: false,
    reason: undefined,
    requestSequence: 0,
    startCellIndex: 0,
    goalCellIndex: 0,
    mapVersion: 0,
    navigationVersion: 0,
    regionVersion: 0,
    roomVersion: 0,
    regionGraphVersion: 0,
    pathCellCount: 0,
    pathCostMilli: 0,
    nodeExpansions: 0,
  };
}

function createAbilityOutputForAutonomy(): M3AbilityQueryIntoOutput {
  return {
    ok: false,
    reason: "ability.actor_out_of_range",
    actorId: 0,
    ability: M3_ABILITY_STAMINA,
    value: 0,
    threshold: 0,
    baseValue: 0,
    conditionPenalty: 0,
    actorConditionVersion: 0,
    baseAbilityVersion: 0,
    visitedConditionCount: 0,
  };
}

function createReservationScratchForAutonomy(): ReservationAcquireIntoScratch {
  return {
    channelCodes: new Uint8Array(AUTONOMY_MAX_CLAIM_REFS),
    keys: new Float64Array(AUTONOMY_MAX_CLAIM_REFS),
    amounts: new Uint32Array(AUTONOMY_MAX_CLAIM_REFS),
    limits: new Uint32Array(AUTONOMY_MAX_CLAIM_REFS),
    targetIndexes: new Uint32Array(AUTONOMY_MAX_CLAIM_REFS),
    targetGenerations: new Uint32Array(AUTONOMY_MAX_CLAIM_REFS),
    hasTargets: new Uint8Array(AUTONOMY_MAX_CLAIM_REFS),
    slots: new Uint32Array(AUTONOMY_MAX_CLAIM_REFS),
  };
}

function createReservationOutputForAutonomy(): ReservationAcquireIntoOutput {
  return {
    ok: false,
    reason: undefined,
    claimIndex: AUTONOMY_REF_NONE,
    conflictingClaimId: AUTONOMY_REF_NONE,
    claimCount: 0,
    version: 0,
    activeCount: 0,
  };
}

function createDecisionOutput(): AutonomyDecisionOutput {
  return {
    ok: false,
    decisionKind: 0,
    state: AUTONOMY_STATE_IDLE,
    reasonCode: AUTONOMY_REASON_NONE,
    residentIndex: AUTONOMY_REF_NONE,
    residentGeneration: AUTONOMY_REF_NONE,
    candidateSourceCode: AUTONOMY_CANDIDATE_SOURCE_NONE,
    candidateId: AUTONOMY_REF_NONE,
    jobId: AUTONOMY_REF_NONE,
    targetId: AUTONOMY_REF_NONE,
    targetCellIndex: AUTONOMY_REF_NONE,
    routeCellCount: 0,
    claimCount: 0,
    rowVersion: 0,
    storeVersion: 0,
    reservationVersion: 0,
    visitedCount: 0,
    ingressCount: 0,
    scoredCount: 0,
    retainedCount: 0,
    selectedCount: 0,
    approximationDropCount: 0,
    exactPathCount: 0,
    nodeExpansions: 0,
  };
}

function createDecisionRequest(
  tick: number,
  requestSequenceStart: number,
): AutonomyDecisionRequest {
  return {
    tick,
    residentIndex: 0,
    residentGeneration: 1,
    originCellIndex: 0,
    originRegionId: 0,
    requestSequenceStart,
    maxNodeExpansions: 64,
  };
}

function expectPregateFailure(fixture: CoordinatorFixture, tick: number): void {
  const scratch = createDecisionScratch();
  const output = createDecisionOutput();
  fixture.coordinator.decideInto(createDecisionRequest(tick, 1), scratch, output);
  expect(output).toMatchObject({
    ok: false,
    decisionKind: AUTONOMY_DECISION_FAILED,
    visitedCount: 0,
    retainedCount: 0,
    scoredCount: 0,
    exactPathCount: 0,
  });
  expect(scratch.ordinaryOptions.candidateCap).toBe(1);
}

function expectCoordinatorMetric(
  fixture: CoordinatorFixture,
  metric: keyof AutonomyDecisionMetricsOutput,
  expected: number,
): void {
  const metrics = createDecisionMetricsOutput();
  fixture.coordinator.readMetricsInto(metrics);
  expect(metrics[metric]).toBe(expected);
}

function createDecisionMetricsOutput(): AutonomyDecisionMetricsOutput {
  return {
    tick: 0,
    decisionsUsedThisTick: 0,
    decisionStartCount: 0,
    claimedCount: 0,
    waitCount: 0,
    keepWorkingCount: 0,
    interruptionRequestCount: 0,
    failedCount: 0,
    deferredCount: 0,
    visitedCount: 0,
    ingressCount: 0,
    scoredCount: 0,
    retainedCount: 0,
    selectedCount: 0,
    approximationDropCount: 0,
    candidateCapHitCount: 0,
    retainedCapHitCount: 0,
    exactPathCount: 0,
    exactPathCapHitCount: 0,
    nodeExpansionCount: 0,
    staleNeedCount: 0,
    staleScheduleCount: 0,
    staleCapabilityCount: 0,
    staleCandidateCount: 0,
    stalePathCount: 0,
    staleJobCount: 0,
    reservationConflictCount: 0,
    decisionDeferralCount: 0,
    lastReasonCode: AUTONOMY_REASON_NONE,
  };
}

function setCoordinatorFactTick(
  dependencies: ResidentAutonomyCoordinatorDependencies,
  tick: number,
): void {
  Reflect.set(dependencies.scheduleFacts, "sourceTick", tick);
  Reflect.set(dependencies.jobFacts, "sourceTick", tick);
  Reflect.set(dependencies.wakeFacts, "sourceTick", tick);
}

function blockCell(fixture: CoordinatorFixture, cellIndex: number): void {
  const x = cellIndex % fixture.dependencies.map.width;
  const y = Math.floor(cellIndex / fixture.dependencies.map.width);
  expect(fixture.dependencies.map.updateCell(x, y, { terrain: MAP_TERRAIN_BLOCKED })).toMatchObject(
    {
      ok: true,
    },
  );
  fixture.dependencies.pathBasis.mapVersion = fixture.dependencies.map.globalVersion;
}

function writeSuccessfulPathMock(
  request: PathRequest,
  route: Uint32Array,
  output: PathSearchIntoOutput,
  nodeExpansions: number,
): void {
  route.fill(AUTONOMY_REF_NONE);
  route[0] = request.startCellIndex;
  route[1] = request.goalCellIndex;
  writePathMockBasis(request, output);
  output.ok = true;
  output.reason = undefined;
  output.pathCellCount = 2;
  output.pathCostMilli = 1_000;
  output.nodeExpansions = nodeExpansions;
}

function writeFailedPathMock(
  request: PathRequest,
  output: PathSearchIntoOutput,
  nodeExpansions: number,
): void {
  writePathMockBasis(request, output);
  output.ok = false;
  output.reason = "path_no_route";
  output.pathCellCount = 0;
  output.pathCostMilli = 0;
  output.nodeExpansions = nodeExpansions;
}

function writePathMockBasis(request: PathRequest, output: PathSearchIntoOutput): void {
  output.requestSequence = request.requestSequence;
  output.startCellIndex = request.startCellIndex;
  output.goalCellIndex = request.goalCellIndex;
  output.mapVersion = request.basis.mapVersion;
  output.navigationVersion = request.basis.navigationVersion;
  output.regionVersion = request.basis.regionVersion;
  output.roomVersion = request.basis.roomVersion;
  output.regionGraphVersion = request.basis.regionGraphVersion;
}

interface AutonomyHotClosureAudit {
  readonly declarationCount: number;
  readonly perFile: Readonly<Record<string, number>>;
  readonly dynamicOwnerRoots: readonly string[];
  readonly nativeCallKeys: readonly string[];
  readonly manifestDigest: string;
  readonly unresolved: readonly string[];
  readonly forbidden: readonly string[];
}

const AUTONOMY_HOT_EXPECTED_PER_FILE: Readonly<Record<string, number>> = {
  "entity-id.ts": 2,
  "game-session-autonomy-reasons.ts": 3,
  "game-session-autonomy-selection.ts": 91,
  "game-session-autonomy-store.ts": 18,
  "m3-food.ts": 15,
  "m3-health.ts": 10,
  "m3-medical-care.ts": 29,
  "m3-needs.ts": 5,
  "m3-rest-sleep.ts": 35,
  "map-grid.ts": 8,
  "pathing.ts": 13,
  "work-offers.ts": 10,
};

const AUTONOMY_HOT_EXPECTED_DYNAMIC_OWNER_ROOT_MAP: ReadonlyMap<string, string> = new Map([
  ["dependencies.entities.generationAt", "EntityRegistry.generationAt"],
  ["dependencies.entities.isIndexActive", "EntityRegistry.isIndexActive"],
  ["needs.isActorActive", "NeedStore.isActorActive"],
  ["needs.readLaneOwnerVersion", "NeedStore.readLaneOwnerVersion"],
  ["needs.readLaneValue", "NeedStore.readLaneValue"],
  ["this.dependencies.abilities.queryAbilityInto", "M3AbilityCacheStore.queryAbilityInto"],
  ["this.dependencies.autonomyStore.readResidentInto", "ResidentAutonomyStore.readResidentInto"],
  ["this.dependencies.food.selectCandidatesInto", "M3FoodAvailabilityStore.selectCandidatesInto"],
  ["this.dependencies.medical.readCaregiverStateInto", "M3MedicalCareStore.readCaregiverStateInto"],
  [
    "this.dependencies.medical.selectTreatmentRequestsInto",
    "M3MedicalCareStore.selectTreatmentRequestsInto",
  ],
  ["this.dependencies.pathfinder.findPathInto", "GridPathfinder.findPathInto"],
  [
    "this.dependencies.restCandidates.selectCandidatesInto",
    "RestCandidateIndex.selectCandidatesInto",
  ],
  ["this.dependencies.workOffers.selectTopOffersInto", "WorkOfferIndex.selectTopOffersInto"],
]);

const AUTONOMY_HOT_EXPECTED_DYNAMIC_OWNER_ROOTS = sortAuditStrings(
  Array.from(
    AUTONOMY_HOT_EXPECTED_DYNAMIC_OWNER_ROOT_MAP,
    ([receiver, target]) => `${receiver} -> ${target}`,
  ),
);

const AUTONOMY_HOT_EXPECTED_NATIVE_CALL_KEYS = [
  "Math.abs",
  "Math.floor",
  "Math.min",
  "Number.isInteger",
  "Number.isSafeInteger",
  "lanes.abilityBaseVersions.fill",
  "lanes.abilityConditionVersions.fill",
  "lanes.abilityIds.fill",
  "lanes.abilityMinimumValues.fill",
  "lanes.abilityValues.fill",
  "lanes.candidateIds.fill",
  "lanes.cheapAdmissionKeys.fill",
  "lanes.commonScores.fill",
  "lanes.needLaneCodes.fill",
  "lanes.needOwnerVersions.fill",
  "lanes.needValues.fill",
  "lanes.policyDescriptorIndexes.fill",
  "lanes.rawScores.fill",
  "lanes.scheduleCodes.fill",
  "lanes.scheduleVersions.fill",
  "lanes.scoreInvocationCounts.fill",
  "lanes.slotCodes.fill",
  "lanes.sourceCodes.fill",
  "lanes.sourceScratchRowIndexes.fill",
  "lanes.targetCellIndexes.fill",
  "lanes.targetIds.fill",
  "output.claimIds.fill",
  "output.routeCells.fill",
  "scratch.needOwnerVersions.fill",
  "scratch.needValues.fill",
  "scratch.pathRouteCells.fill",
  "scratch.selectedRouteCells.fill",
  "this.closedEpoch.fill",
  "this.seenEpoch.fill",
] as const;

const AUTONOMY_HOT_EXPECTED_NATIVE_CALL_KEY_SET = new Set<string>(
  AUTONOMY_HOT_EXPECTED_NATIVE_CALL_KEYS,
);

const AUTONOMY_HOT_FORBIDDEN_PROPERTY_CALLS = new Set([
  "toString",
  "concat",
  "join",
  "map",
  "filter",
  "reduce",
  "flatMap",
  "slice",
  "split",
  "replace",
  "sort",
]);

function auditAutonomyDecisionClosure(): AutonomyHotClosureAudit {
  const program = createAutonomyHotAuditProgram();
  const checker = program.getTypeChecker();
  const source = program
    .getSourceFiles()
    .find((candidate) =>
      normalizeAuditPath(candidate.fileName).endsWith(
        "/packages/sim-core/src/game-session-autonomy-selection.ts",
      ),
    );
  if (source === undefined) throw new Error("autonomy selection source is missing from Program");
  const root = findAutonomyDecisionRoot(source);
  const queue: ts.SignatureDeclaration[] = [root];
  const reached = new Set<ts.SignatureDeclaration>();
  const manifestKeys = new Set<string>();
  const dynamicOwnerRoots = new Set<string>();
  const nativeCallKeys = new Set<string>();
  const unresolved = new Set<string>();
  const forbidden = new Set<string>();
  const perFile: Record<string, number> = {};
  for (const declaration of queue) {
    if (reached.has(declaration)) continue;
    reached.add(declaration);
    const body = readAutonomyCallableBody(declaration);
    const fileName = readAutonomySourceFileName(declaration.getSourceFile());
    const label = readAutonomyCallableLabel(declaration);
    if (body === undefined || fileName === undefined) {
      unresolved.add(`${label}: callable body is outside packages/sim-core/src`);
      continue;
    }
    const manifestKey = `${fileName}:${label}`;
    if (manifestKeys.has(manifestKey))
      unresolved.add(`${manifestKey}: duplicate declaration label`);
    manifestKeys.add(manifestKey);
    perFile[fileName] = (perFile[fileName] ?? 0) + 1;
    auditAutonomyHotBody(
      body,
      declaration,
      checker,
      queue,
      dynamicOwnerRoots,
      nativeCallKeys,
      unresolved,
      forbidden,
    );
  }
  const sortedManifest = sortAuditStrings(Array.from(manifestKeys));
  return {
    declarationCount: reached.size,
    perFile,
    dynamicOwnerRoots: sortAuditStrings(Array.from(dynamicOwnerRoots)),
    nativeCallKeys: sortAuditStrings(Array.from(nativeCallKeys)),
    manifestDigest: hashAutonomyHotManifest(sortedManifest),
    unresolved: sortAuditStrings(Array.from(unresolved)),
    forbidden: sortAuditStrings(Array.from(forbidden)),
  };
}

function createAutonomyHotAuditProgram(): ts.Program {
  const configPath = ts.findConfigFile(
    ts.sys.getCurrentDirectory(),
    (fileName) => ts.sys.fileExists(fileName),
    "tsconfig.typecheck.json",
  );
  if (configPath === undefined) throw new Error("tsconfig.typecheck.json was not found");
  const config = ts.readConfigFile(configPath, (fileName) => ts.sys.readFile(fileName));
  if (config.error !== undefined)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const normalized = normalizeAuditPath(configPath);
  const basePath = normalized.slice(0, normalized.lastIndexOf("/"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, basePath);
  if (parsed.errors.length > 0)
    throw new Error(ts.flattenDiagnosticMessageText(parsed.errors[0]?.messageText ?? "", "\n"));
  return ts.createProgram(parsed.fileNames, parsed.options);
}

function findAutonomyDecisionRoot(source: ts.SourceFile): ts.MethodDeclaration {
  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement) || statement.name?.text !== "ResidentAutonomyCoordinator")
      continue;
    for (const member of statement.members) {
      if (
        ts.isMethodDeclaration(member) &&
        ts.isIdentifier(member.name) &&
        member.name.text === "decideInto"
      )
        return member;
    }
  }
  throw new Error("ResidentAutonomyCoordinator.decideInto declaration was not found");
}

function auditAutonomyHotBody(
  body: ts.ConciseBody,
  caller: ts.SignatureDeclaration,
  checker: ts.TypeChecker,
  queue: ts.SignatureDeclaration[],
  dynamicOwnerRoots: Set<string>,
  nativeCallKeys: Set<string>,
  unresolved: Set<string>,
  forbidden: Set<string>,
): void {
  const callerLabel = readAutonomyCallableLabel(caller);
  const callerFile = readAutonomySourceFileName(caller.getSourceFile());
  function visit(node: ts.Node): void {
    const category = readForbiddenAutonomyHotNode(node);
    if (category !== undefined) forbidden.add(`${callerLabel}: ${category}`);
    if (ts.isCallExpression(node)) {
      const signature = checker.getResolvedSignature(node);
      const target = signature?.declaration;
      if (target === undefined) {
        unresolved.add(`${callerLabel}: unresolved call ${node.expression.getText()}`);
      } else if (target.kind === ts.SyntaxKind.JSDocSignature) {
        unresolved.add(`${callerLabel}: JSDoc-only call ${node.expression.getText()}`);
      } else {
        const targetFile = readAutonomySourceFileName(target.getSourceFile());
        if (targetFile === undefined) {
          const nativeKey = readAutonomyNativeCallKey(node);
          if (nativeKey === undefined || !AUTONOMY_HOT_EXPECTED_NATIVE_CALL_KEY_SET.has(nativeKey))
            unresolved.add(`${callerLabel}: unexpected external call ${node.expression.getText()}`);
          else nativeCallKeys.add(nativeKey);
        } else {
          const targetBody = readAutonomyCallableBody(target);
          if (targetBody === undefined)
            unresolved.add(`${callerLabel}: project call has no body ${node.expression.getText()}`);
          else queue.push(target);
          if (
            callerFile === "game-session-autonomy-selection.ts" &&
            targetFile !== callerFile &&
            ts.isPropertyAccessExpression(node.expression)
          ) {
            const receiverKey = node.expression.getText();
            dynamicOwnerRoots.add(`${receiverKey} -> ${readAutonomyCallableLabel(target)}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(body);
}

function readAutonomyCallableBody(
  declaration: ts.SignatureDeclaration,
): ts.ConciseBody | undefined {
  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isMethodDeclaration(declaration) ||
    ts.isFunctionExpression(declaration) ||
    ts.isArrowFunction(declaration) ||
    ts.isConstructorDeclaration(declaration) ||
    ts.isGetAccessorDeclaration(declaration) ||
    ts.isSetAccessorDeclaration(declaration)
  )
    return declaration.body;
  return undefined;
}

function readAutonomyCallableLabel(declaration: ts.SignatureDeclaration): string {
  if (
    ts.isMethodDeclaration(declaration) ||
    ts.isGetAccessorDeclaration(declaration) ||
    ts.isSetAccessorDeclaration(declaration)
  ) {
    const owner = ts.isClassDeclaration(declaration.parent)
      ? (declaration.parent.name?.text ?? "<anonymous-class>")
      : "<non-class>";
    return `${owner}.${declaration.name.getText()}`;
  }
  if (ts.isConstructorDeclaration(declaration)) {
    const owner = ts.isClassDeclaration(declaration.parent)
      ? (declaration.parent.name?.text ?? "<anonymous-class>")
      : "<non-class>";
    return `${owner}.constructor`;
  }
  if (ts.isFunctionDeclaration(declaration) && declaration.name !== undefined)
    return declaration.name.text;
  return `<anonymous@${String(declaration.getStart())}>`;
}

function readAutonomySourceFileName(source: ts.SourceFile): string | undefined {
  const normalized = normalizeAuditPath(source.fileName);
  const marker = "/packages/sim-core/src/";
  const markerIndex = normalized.lastIndexOf(marker);
  return markerIndex < 0 ? undefined : normalized.slice(markerIndex + marker.length);
}

function normalizeAuditPath(fileName: string): string {
  return fileName.replaceAll("\\", "/").toLowerCase();
}

function readAutonomyNativeCallKey(call: ts.CallExpression): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
  return `${call.expression.expression.getText()}.${call.expression.name.text}`;
}

function readExpectedDynamicOwnerRoot(receiver: string): string | undefined {
  return AUTONOMY_HOT_EXPECTED_DYNAMIC_OWNER_ROOT_MAP.get(receiver);
}

function readForbiddenAutonomyHotNode(node: ts.Node): string | undefined {
  if (ts.isNewExpression(node)) return "new expression";
  if (ts.isObjectLiteralExpression(node)) return "object literal";
  if (ts.isArrayLiteralExpression(node)) return "array literal";
  if (ts.isArrowFunction(node)) return "nested arrow function";
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return "nested function";
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) return "nested class";
  if (ts.isTaggedTemplateExpression(node)) return "tagged template";
  if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return "template literal";
  if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) return "regex literal";
  if (ts.isCallExpression(node)) return readForbiddenAutonomyHotCall(node);
  if (ts.isBinaryExpression(node)) return readForbiddenAutonomyStringBinary(node);
  return undefined;
}

function readForbiddenAutonomyHotCall(node: ts.CallExpression): string | undefined {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) {
    if (expression.text === "Array" || expression.text === "Object" || expression.text === "String")
      return `forbidden call ${expression.text}`;
    return undefined;
  }
  if (!ts.isPropertyAccessExpression(expression)) return undefined;
  const receiver = expression.expression.getText();
  const callName = expression.name.text;
  if (receiver === "Array" && (callName === "from" || callName === "of"))
    return `forbidden call Array.${callName}`;
  if (
    receiver === "Object" &&
    (callName === "create" || callName === "assign" || callName === "fromEntries")
  )
    return `forbidden call Object.${callName}`;
  if (receiver === "JSON" && callName === "stringify") return "forbidden call JSON.stringify";
  return AUTONOMY_HOT_FORBIDDEN_PROPERTY_CALLS.has(callName)
    ? `forbidden call .${callName}`
    : undefined;
}

function readForbiddenAutonomyStringBinary(node: ts.BinaryExpression): string | undefined {
  if (
    node.operatorToken.kind !== ts.SyntaxKind.PlusToken &&
    node.operatorToken.kind !== ts.SyntaxKind.PlusEqualsToken
  )
    return undefined;
  if (!isAutonomyStringProducing(node.left) && !isAutonomyStringProducing(node.right))
    return undefined;
  return node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken
    ? "string-producing plus-equals"
    : "string-producing plus";
}

function isAutonomyStringProducing(node: ts.Expression): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  )
    return true;
  if (ts.isParenthesizedExpression(node)) return isAutonomyStringProducing(node.expression);
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node))
    return isAutonomyStringProducing(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    return isAutonomyStringProducing(node.left) || isAutonomyStringProducing(node.right);
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === "String";
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const callName = node.expression.name.text;
  if (callName === "toString" || callName === "concat" || callName === "join") return true;
  if (node.expression.expression.getText() === "JSON" && callName === "stringify") return true;
  return ts.isCallExpression(node.expression.expression)
    ? isAutonomyStringProducing(node.expression.expression)
    : false;
}

function hashAutonomyHotManifest(manifest: readonly string[]): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const entry of manifest) {
    for (let index = 0; index < entry.length; index += 1) {
      const code = entry.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193);
      second = Math.imul(second ^ code, 0x85ebca6b);
    }
    first = Math.imul(first ^ 10, 0x01000193);
    second = Math.imul(second ^ 10, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}-${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function sortAuditStrings(values: string[]): string[] {
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index] ?? "";
    let cursor = index;
    while (cursor > 0 && (values[cursor - 1] ?? "") > value) {
      values[cursor] = values[cursor - 1] ?? "";
      cursor -= 1;
    }
    values[cursor] = value;
  }
  return values;
}

function containsUint8Value(lane: Uint8Array, expected: number): boolean {
  for (const value of lane) if (value === expected) return true;
  return false;
}

function sumUint8(lane: Uint8Array): number {
  let sum = 0;
  for (const value of lane) sum += value;
  return sum;
}

function createDecisionPolicyInput(): AutonomyDecisionPolicyInput {
  const actorCapacity = 2;
  const policyClassCount = 2;
  const tableLength = policyClassCount * AUTONOMY_SCHEDULE_CODE_COUNT;
  const ordinaryLength = tableLength * AUTONOMY_ORDINARY_MAX_BUCKETS;
  const sourceEnabledFlags = new Uint8Array(tableLength * AUTONOMY_REAL_SOURCE_COUNT);
  const ordinaryDescriptorCounts = new Uint8Array(tableLength);
  const ordinaryWorkTypes = new Uint8Array(ordinaryLength);
  const ordinaryRequiredAbilityIds = new Uint8Array(ordinaryLength);
  sourceEnabledFlags.fill(1);
  ordinaryDescriptorCounts.fill(2);
  for (let index = 0; index < ordinaryLength; index += 1) {
    ordinaryWorkTypes[index] = index % 2;
    ordinaryRequiredAbilityIds[index] = 2;
  }
  return {
    actorCapacity,
    policyClassCount,
    residentPolicyClassIds: new Uint8Array([0, 1]),
    emergencyNeedMaximumValues: new Uint16Array([100, 100, 0, 0, 100]),
    sourceEnabledFlags,
    sourceNeedLaneCodes: new Uint8Array([0, 1, 4, 2]),
    sourceNeedMaximumValues: new Uint16Array([900, 900, 900, 1_000]),
    sourceAbilityIds: new Uint8Array([2, 5, 4, 2]),
    sourceMinimumAbilityValues: new Uint16Array([100, 100, 100, 100]),
    sourceRequiresOpenWindowFlags: new Uint8Array([1, 1, 0, 1]),
    sourceHardPriorities: new Int32Array([40, 30, 50, 20]),
    sourceBaseScores: new Int32Array([400, 300, 500, 200]),
    sourceNeedWeights: new Int32Array([3, 3, 4, 1]),
    sourceScheduleBonuses: new Int32Array([20, 20, 0, 20]),
    sourceAbilityWeights: new Int32Array([1, 1, 1, 1]),
    sourceDistanceWeights: new Uint32Array([2, 2, 2, 2]),
    sourceContinuityBonuses: new Uint32Array([10, 10, 10, 10]),
    sourceRetryPenalties: new Uint32Array([20, 20, 20, 20]),
    minimumConsciousness: 100,
    minimumMovement: 100,
    safetyEmergencyMaximumValue: 100,
    foodDefIds: new Uint32Array(tableLength).fill(1),
    restKindCodes: new Uint8Array(tableLength),
    restWeatherExposureCodes: new Uint8Array(tableLength),
    medicalUrgencyBuckets: new Uint32Array(tableLength).fill(1),
    ordinaryDescriptorCounts,
    ordinaryWorkTypes,
    ordinaryDefinitionIds: new Uint32Array(ordinaryLength).fill(1),
    ordinaryUrgencyBuckets: new Uint32Array(ordinaryLength).fill(1),
    ordinaryRequiredAbilityIds,
    ordinaryMinimumAbilityValues: new Uint16Array(ordinaryLength).fill(100),
    ordinaryBaseScoreAdjustments: new Int32Array(ordinaryLength),
    ordinaryDecisionCadenceTicks: 30,
    maximumManhattanDistance: 63,
  };
}

function expectAtomicRestoreFailure(
  store: ResidentAutonomyStore,
  snapshot: ResidentAutonomySnapshot,
  code: AutonomyStoreCode,
): void {
  const before = store.createSnapshot();
  const output = createStoreOutput();
  store.restoreFromSnapshot(snapshot, output);
  expect(output).toMatchObject({ ok: false, code });
  expect(store.createSnapshot()).toEqual(before);
}
