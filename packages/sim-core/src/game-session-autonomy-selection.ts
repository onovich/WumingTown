import type { EntityRegistry } from "./entity-id";
import { AUTONOMY_REASON_NONE, type AutonomyReasonCode } from "./game-session-autonomy-reasons";
import type { ResidentAutonomyStore } from "./game-session-autonomy-store";
import {
  AUTONOMY_CANDIDATE_SOURCE_NONE,
  AUTONOMY_MAX_CLAIM_REFS,
  AUTONOMY_REF_NONE,
  type AutonomyCandidateSourceCode,
  type AutonomyDecisionKind,
  type AutonomyState,
  type AutonomyStoreOutput,
  type AutonomyTransitionInput,
  type AutonomyVersionBasis,
  type ResidentAutonomyReadOutput,
} from "./game-session-autonomy-types";
import type {
  M3FoodAvailabilityStore,
  M3FoodCandidateQuery,
  M3FoodCandidateSelectionIntoOutput,
  M3FoodCandidateSelectionIntoScratch,
  M3FoodPortionIntoOutput,
} from "./m3-food";
import type {
  M3AbilityCacheStore,
  M3AbilityQueryIntoOutput,
  M3HealthConditionStore,
} from "./m3-health";
import type {
  M3MedicalCaregiverStateIntoOutput,
  M3MedicalCareStore,
  M3MedicalPatientRequestIntoOutput,
  M3MedicalSelectionIntoOutput,
  M3MedicalSelectionIntoScratch,
  M3MedicalSelectionOptions,
} from "./m3-medical-care";
import type { NeedStore } from "./m3-needs";
import type {
  RestCandidateEnvironmentBasis,
  RestCandidateIndex,
  RestCandidateQuery,
  RestCandidateSelectionIntoOutput,
  RestCandidateSelectionIntoScratch,
  RestFixtureIntoOutput,
  RestSleepStore,
} from "./m3-rest-sleep";
import type { MapGrid } from "./map-grid";
import type { GridPathfinder, PathSearchIntoOutput } from "./pathing";
import type {
  ReservationAcquireIntoOutput,
  ReservationAcquireIntoScratch,
  ReservationClaimRequest,
  ReservationChannel,
  ReservationLedger,
  ReservationTransactionRequest,
} from "./reservation-ledger";
import type { Tick } from "./time";
import type {
  WorkOfferIndex,
  WorkOfferReadIntoOutput,
  WorkOfferSelectionIntoOutput,
  WorkOfferSelectionIntoScratch,
} from "./work-offers";

export const AUTONOMY_DEFAULT_DECISION_CADENCE_TICKS = 30;
export const AUTONOMY_DEFAULT_RETRY_BACKOFF_TICKS = 30;

/** Owner-derived schedule facts are built once per tick and reused for every resident call. */
export interface AutonomyScheduleFactsLane {
  readonly sourceTick: Tick;
  readonly residentGenerations: Uint32Array;
  readonly scheduleCodes: Uint8Array;
  readonly windowOpenFlags: Uint8Array;
  readonly allowedWorkTypeMasks: Uint32Array;
  readonly permissionIds: Uint32Array;
  readonly ownerVersions: Uint32Array;
  readonly mealWindowIds: Uint32Array;
  readonly mealWindowVersions: Uint32Array;
  readonly weatherExposureCodes: Uint8Array;
  readonly weatherVersions: Uint32Array;
  readonly weatherSourceVersions: Uint32Array;
  readonly outdoorWorkAllowedFlags: Uint8Array;
}

/** JobCore remains authoritative; this lane is only its reusable numeric decision projection. */
export interface AutonomyJobFactsLane {
  readonly sourceTick: Tick;
  readonly residentGenerations: Uint32Array;
  readonly activeFlags: Uint8Array;
  readonly jobIds: Uint32Array;
  readonly jobVersions: Uint32Array;
  readonly interruptionPolicyCodes: Uint8Array;
  readonly safePointFlags: Uint8Array;
}

/** Mutable owner basis supplied by WM-0171 and sampled before and after exact pathing. */
export interface AutonomyPathBasisLane {
  mapVersion: number;
  navigationVersion: number;
  regionVersion: number;
  roomVersion: number;
  regionGraphVersion: number;
}

/** Caller-owned request object structurally accepted by GridPathfinder.findPathInto. */
export interface AutonomyPathRequest {
  requestSequence: number;
  issuedTick: Tick;
  startCellIndex: number;
  goalCellIndex: number;
  readonly basis: AutonomyPathBasisLane;
  maxNodeExpansions: number;
}

/** Caller-owned query object structurally accepted by WorkOfferIndex.selectTopOffersInto. */
export interface AutonomyWorkOfferSelectionOptions {
  pawnId: number;
  workType: number;
  regionId: number;
  defId: number;
  urgencyBucket: number;
  permissionId: number;
  candidateCap: number;
  maxSelectedOffers: number;
}

/** A coordinator-owned scalar lane. The fixed slot code is the final tie-break. */
export interface AutonomyCandidateLane {
  sourceCode: AutonomyCandidateSourceCode;
  slotCode: number;
  candidateId: number;
  scoreMilli: number;
  targetId: number;
  targetCellIndex: number;
  readonly basis: AutonomyVersionBasis;
}

/**
 * Exactly five reusable lanes. Selection order is score, candidate row id, target id,
 * then this fixed FOOD -> REST -> MEDICAL -> ORDINARY -> WAIT slot order.
 */
export interface AutonomyFiveCandidateLanes {
  readonly food: AutonomyCandidateLane;
  readonly rest: AutonomyCandidateLane;
  readonly medical: AutonomyCandidateLane;
  readonly ordinary: AutonomyCandidateLane;
  readonly wait: AutonomyCandidateLane;
}

/** One shared budget across all five sources; sources do not receive private caps. */
export interface AutonomyGlobalCandidateBudget {
  visitedCap: number;
  retainedCap: number;
  exactPathCap: number;
  visitedCount: number;
  retainedCount: number;
  exactPathCount: number;
}

export interface AutonomyMutableEntityRef {
  index: number;
  generation: number;
}

export interface AutonomyMutableReservationTransaction extends ReservationTransactionRequest {
  readonly owner: AutonomyMutableEntityRef;
  jobId: number;
  createdTick: Tick;
  leaseExpiryTick: Tick;
  readonly claims: ReservationClaimRequest[];
}

/** Mutable caller-owned query, structurally accepted by the food selection owner. */
export interface AutonomyFoodCandidateQuery extends M3FoodCandidateQuery {
  foodDefId: number;
  regionId: number;
  permissionId: number;
  mealWindowId: number;
  candidateCap: number;
  maxSelected: number;
}

/** Mutable caller-owned query, structurally accepted by the rest selection owner. */
export interface AutonomyRestCandidateQuery extends RestCandidateQuery {
  regionId: number;
  restKind: RestCandidateQuery["restKind"];
  scheduleWindow: RestCandidateQuery["scheduleWindow"];
  weatherExposure: RestCandidateQuery["weatherExposure"];
  permissionId: number;
  candidateCap: number;
  maxSelectedFixtures: number;
}

/** Mutable caller-owned environment basis, structurally accepted by the rest owner. */
export interface AutonomyRestEnvironmentBasis extends RestCandidateEnvironmentBasis {
  scheduleWindow: RestCandidateEnvironmentBasis["scheduleWindow"];
  scheduleWindowVersion: number;
  weatherExposure: RestCandidateEnvironmentBasis["weatherExposure"];
  outdoorWorkAllowed: boolean;
  weatherVersion: number;
  weatherSourceVersion: number;
}

/** Mutable caller-owned query, structurally accepted by the medical selection owner. */
export interface AutonomyMedicalSelectionOptions extends M3MedicalSelectionOptions {
  caregiverId: number;
  regionId: number;
  urgencyBucket: number;
  permissionId: number;
  candidateCap: number;
  maxSelectedRequests: number;
}

export interface AutonomyClaimPlanHeader {
  ok: boolean;
  reasonCode: AutonomyReasonCode;
  candidateSourceCode: AutonomyCandidateSourceCode;
  candidateId: number;
  pendingJobId: number;
  targetId: number;
  targetCellIndex: number;
  claimCount: number;
}

/** Every slot owns every supported claim shape so filling a plan never allocates a claim object. */
export interface AutonomyClaimSlotScratch {
  readonly entityTarget: AutonomyMutableEntityRef;
  readonly itemTarget: AutonomyMutableEntityRef;
  readonly entityClaim: {
    readonly channel: "entity";
    readonly target: AutonomyMutableEntityRef;
  };
  readonly cellClaim: {
    readonly channel: "cell";
    cellIndex: number;
  };
  readonly itemQuantityClaim: {
    readonly channel: "item_quantity";
    readonly item: AutonomyMutableEntityRef;
    amount: number;
    availableAmount: number;
  };
  readonly interactionSpotClaim: {
    readonly channel: "interaction_spot";
    readonly target: AutonomyMutableEntityRef;
    spotId: number;
  };
  readonly capacityClaim: {
    readonly channel: "capacity";
    readonly target: AutonomyMutableEntityRef;
    capacityId: number;
    amount: number;
    capacity: number;
  };
}

export type AutonomyClaimSlotScratchTuple = readonly [
  AutonomyClaimSlotScratch,
  AutonomyClaimSlotScratch,
  AutonomyClaimSlotScratch,
  AutonomyClaimSlotScratch,
  AutonomyClaimSlotScratch,
  AutonomyClaimSlotScratch,
  AutonomyClaimSlotScratch,
  AutonomyClaimSlotScratch,
];

export interface AutonomyClaimPlanIntoOutput {
  readonly header: AutonomyClaimPlanHeader;
  readonly owner: AutonomyMutableEntityRef;
  readonly target: AutonomyMutableEntityRef;
  readonly item: AutonomyMutableEntityRef;
  readonly transaction: AutonomyMutableReservationTransaction;
  readonly claimSlots: AutonomyClaimSlotScratchTuple;
}

/**
 * Resets every mutable field while preserving output, transaction, array, ref, and slot identities.
 * `transaction.claims` must be the caller-preallocated array used by acquireInto exactly once.
 */
export function resetAutonomyClaimPlanInto(output: AutonomyClaimPlanIntoOutput): void {
  const header = output.header;
  header.ok = false;
  header.reasonCode = AUTONOMY_REASON_NONE;
  header.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_NONE;
  header.candidateId = AUTONOMY_REF_NONE;
  header.pendingJobId = AUTONOMY_REF_NONE;
  header.targetId = AUTONOMY_REF_NONE;
  header.targetCellIndex = AUTONOMY_REF_NONE;
  header.claimCount = 0;
  resetMutableEntityRef(output.owner);
  if (output.transaction.owner !== output.owner) resetMutableEntityRef(output.transaction.owner);
  resetMutableEntityRef(output.target);
  resetMutableEntityRef(output.item);
  output.transaction.jobId = AUTONOMY_REF_NONE;
  output.transaction.createdTick = 0;
  output.transaction.leaseExpiryTick = 0;
  output.transaction.claims.length = 0;
  for (let index = 0; index < AUTONOMY_MAX_CLAIM_REFS; index += 1) {
    const slot = output.claimSlots[index];
    if (slot !== undefined) resetAutonomyClaimSlot(slot);
  }
}

function resetMutableEntityRef(ref: AutonomyMutableEntityRef): void {
  ref.index = AUTONOMY_REF_NONE;
  ref.generation = AUTONOMY_REF_NONE;
}

function resetAutonomyClaimSlot(slot: AutonomyClaimSlotScratch): void {
  resetMutableEntityRef(slot.entityTarget);
  resetMutableEntityRef(slot.itemTarget);
  resetMutableEntityRef(slot.entityClaim.target);
  resetMutableEntityRef(slot.itemQuantityClaim.item);
  resetMutableEntityRef(slot.interactionSpotClaim.target);
  resetMutableEntityRef(slot.capacityClaim.target);
  slot.cellClaim.cellIndex = AUTONOMY_REF_NONE;
  slot.itemQuantityClaim.amount = 0;
  slot.itemQuantityClaim.availableAmount = 0;
  slot.interactionSpotClaim.spotId = AUTONOMY_REF_NONE;
  slot.capacityClaim.capacityId = AUTONOMY_REF_NONE;
  slot.capacityClaim.amount = 0;
  slot.capacityClaim.capacity = 0;
}

/** Validates every required reference alias without allocating scratch or result objects. */
export function hasValidAutonomyClaimPlanAliases(output: AutonomyClaimPlanIntoOutput): boolean {
  if (output.transaction.owner !== output.owner) return false;
  for (let index = 0; index < AUTONOMY_MAX_CLAIM_REFS; index += 1) {
    const slot = output.claimSlots[index];
    if (slot === undefined || !hasValidAutonomyClaimSlotAliases(slot)) return false;
  }
  return true;
}

function hasValidAutonomyClaimSlotAliases(slot: AutonomyClaimSlotScratch): boolean {
  return (
    slot.entityClaim.target === slot.entityTarget &&
    slot.interactionSpotClaim.target === slot.entityTarget &&
    slot.capacityClaim.target === slot.entityTarget &&
    slot.itemQuantityClaim.item === slot.itemTarget
  );
}

/**
 * The only reviewed hot-path binding operation: it writes an existing fixed-slot claim reference
 * into the existing transaction array. Claim-plan sources must not construct claim objects.
 */
export function bindAutonomyClaimSlotInto(
  output: AutonomyClaimPlanIntoOutput,
  slotIndex: number,
  channel: ReservationChannel,
): boolean {
  if (
    output.transaction.owner !== output.owner ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= AUTONOMY_MAX_CLAIM_REFS ||
    output.transaction.claims.length >= AUTONOMY_MAX_CLAIM_REFS
  )
    return false;
  const slot = output.claimSlots[slotIndex];
  if (slot === undefined || !hasValidAutonomyClaimSlotAliases(slot)) return false;
  output.transaction.claims[output.transaction.claims.length] = readAutonomySlotClaim(
    slot,
    channel,
  );
  output.header.claimCount = output.transaction.claims.length;
  return true;
}

function readAutonomySlotClaim(
  slot: AutonomyClaimSlotScratch,
  channel: ReservationChannel,
): ReservationClaimRequest {
  if (channel === "entity") return slot.entityClaim;
  if (channel === "cell") return slot.cellClaim;
  if (channel === "item_quantity") return slot.itemQuantityClaim;
  if (channel === "interaction_spot") return slot.interactionSpotClaim;
  return slot.capacityClaim;
}

/**
 * Direct indexed lookup only. Implementations reset first, and successful outputs echo
 * `header.pendingJobId === transaction.jobId`. Failed plans are never persisted. After a
 * successful acquire, publication clears pendingJob; a publication failure releases the exact
 * claim ids returned by that acquire before retrying.
 */
export interface AutonomyClaimPlanSource {
  readPlanInto(
    candidateSourceCode: AutonomyCandidateSourceCode,
    candidateId: number,
    targetId: number,
    targetCellIndex: number,
    output: AutonomyClaimPlanIntoOutput,
  ): void;
}

export interface AutonomyDecisionRequest {
  readonly tick: Tick;
  readonly residentIndex: number;
  readonly residentGeneration: number;
  readonly originCellIndex: number;
  readonly originRegionId: number;
  readonly requestSequenceStart: number;
  readonly maxNodeExpansions: number;
}

export interface AutonomyDecisionScratch {
  readonly residentReadOutput: ResidentAutonomyReadOutput;
  readonly globalBudget: AutonomyGlobalCandidateBudget;
  readonly candidates: AutonomyFiveCandidateLanes;
  readonly foodQuery: AutonomyFoodCandidateQuery;
  readonly foodScratch: M3FoodCandidateSelectionIntoScratch;
  readonly foodOutput: M3FoodCandidateSelectionIntoOutput;
  readonly foodReadOutput: M3FoodPortionIntoOutput;
  readonly restQuery: AutonomyRestCandidateQuery;
  readonly restEnvironment: AutonomyRestEnvironmentBasis;
  readonly restScratch: RestCandidateSelectionIntoScratch;
  readonly restOutput: RestCandidateSelectionIntoOutput;
  readonly restReadOutput: RestFixtureIntoOutput;
  readonly medicalOptions: AutonomyMedicalSelectionOptions;
  readonly medicalScratch: M3MedicalSelectionIntoScratch;
  readonly medicalOutput: M3MedicalSelectionIntoOutput;
  readonly medicalPatientReadOutput: M3MedicalPatientRequestIntoOutput;
  readonly medicalCaregiverReadOutput: M3MedicalCaregiverStateIntoOutput;
  readonly ordinaryOptions: AutonomyWorkOfferSelectionOptions;
  readonly ordinaryScratch: WorkOfferSelectionIntoScratch;
  readonly ordinaryOutput: WorkOfferSelectionIntoOutput;
  readonly ordinaryReadOutput: WorkOfferReadIntoOutput;
  readonly pathRequest: AutonomyPathRequest;
  readonly pathOutput: PathSearchIntoOutput;
  readonly pathRouteCells: Uint32Array;
  readonly selectedRouteCells: Uint32Array;
  readonly abilityOutput: M3AbilityQueryIntoOutput;
  readonly selectedBasis: AutonomyVersionBasis;
  readonly claimPlanOutput: AutonomyClaimPlanIntoOutput;
  readonly reservationScratch: ReservationAcquireIntoScratch;
  readonly reservationOutput: ReservationAcquireIntoOutput;
  readonly reservationClaimIds: Uint32Array;
  readonly transitionInput: AutonomyTransitionInput;
  readonly transitionValidationOutput: AutonomyStoreOutput;
  readonly transitionOutput: AutonomyStoreOutput;
}

export interface AutonomyDecisionOutput {
  ok: boolean;
  decisionKind: AutonomyDecisionKind;
  state: AutonomyState;
  reasonCode: AutonomyReasonCode;
  residentIndex: number;
  residentGeneration: number;
  candidateSourceCode: AutonomyCandidateSourceCode;
  candidateId: number;
  jobId: number;
  targetId: number;
  targetCellIndex: number;
  routeCellCount: number;
  claimCount: number;
  rowVersion: number;
  storeVersion: number;
  reservationVersion: number;
  visitedCount: number;
  scoredCount: number;
  selectedCount: number;
  exactPathCount: number;
  nodeExpansions: number;
}

export interface AutonomyDecisionMetricsOutput {
  tick: Tick;
  decisionsUsedThisTick: number;
  decisionStartCount: number;
  claimedCount: number;
  waitCount: number;
  keepWorkingCount: number;
  interruptionRequestCount: number;
  failedCount: number;
  deferredCount: number;
  visitedCount: number;
  scoredCount: number;
  selectedCount: number;
  candidateCapHitCount: number;
  retainedCapHitCount: number;
  exactPathCount: number;
  exactPathCapHitCount: number;
  nodeExpansionCount: number;
  staleNeedCount: number;
  staleScheduleCount: number;
  staleCapabilityCount: number;
  staleCandidateCount: number;
  stalePathCount: number;
  staleJobCount: number;
  reservationConflictCount: number;
  decisionDeferralCount: number;
  lastReasonCode: AutonomyReasonCode;
}

export interface ResidentAutonomyCoordinatorOptions {
  readonly decisionCadenceTicks?: number;
  readonly retryBackoffTicks?: number;
}

export interface ResidentAutonomyCoordinatorDependencies {
  readonly autonomyStore: ResidentAutonomyStore;
  readonly needs: NeedStore;
  readonly scheduleFacts: AutonomyScheduleFactsLane;
  readonly jobFacts: AutonomyJobFactsLane;
  readonly food: M3FoodAvailabilityStore;
  readonly restStore: RestSleepStore;
  readonly restCandidates: RestCandidateIndex;
  readonly medical: M3MedicalCareStore;
  readonly workOffers: WorkOfferIndex;
  readonly map: MapGrid;
  readonly pathBasis: AutonomyPathBasisLane;
  readonly pathfinder: GridPathfinder;
  readonly abilities: M3AbilityCacheStore;
  readonly healthConditions: M3HealthConditionStore;
  readonly reservations: ReservationLedger;
  readonly entities: EntityRegistry;
  readonly claimPlans: AutonomyClaimPlanSource;
}
