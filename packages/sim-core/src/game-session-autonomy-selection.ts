import type { EntityRegistry } from "./entity-id";
import {
  AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
  AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED,
  AUTONOMY_REASON_CAPABILITY_STALE_BASIS,
  AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED,
  AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED,
  AUTONOMY_REASON_FAILED_INVARIANT,
  AUTONOMY_REASON_IDLE_DECISION_DEFERRED,
  AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER,
  AUTONOMY_REASON_IDLE_OFF_SHIFT,
  AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY,
  AUTONOMY_REASON_NEED_SAFETY_EMERGENCY,
  AUTONOMY_REASON_NONE,
  AUTONOMY_REASON_OFFER_STALE_OWNER,
  AUTONOMY_REASON_PATH_NO_ROUTE,
  AUTONOMY_REASON_PATH_SELECTED,
  type AutonomyReasonCode,
} from "./game-session-autonomy-reasons";
import type { ResidentAutonomyStore } from "./game-session-autonomy-store";
import {
  AUTONOMY_CANDIDATE_SOURCE_NONE,
  AUTONOMY_DECISION_DEFERRED,
  AUTONOMY_DECISION_FAILED,
  AUTONOMY_DECISION_INTERRUPTION_REQUESTED,
  AUTONOMY_DECISION_KEEP_WORKING,
  AUTONOMY_DECISION_NONE,
  AUTONOMY_DECISION_WAIT,
  AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT,
  AUTONOMY_INTERRUPTION_POLICY_EMERGENCY_ONLY,
  AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE,
  AUTONOMY_MAX_EXACT_PATHS,
  AUTONOMY_MAX_RETAINED_CANDIDATES,
  AUTONOMY_MAX_VISITED_CANDIDATES,
  AUTONOMY_MAX_CLAIM_REFS,
  AUTONOMY_REF_NONE,
  AUTONOMY_STATE_BLOCKED,
  AUTONOMY_STATE_IDLE,
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
import {
  M3_ABILITY_CONSCIOUSNESS,
  M3_ABILITY_MOVEMENT,
  type M3AbilityCacheStore,
  type M3AbilityQueryIntoOutput,
  type M3HealthConditionStore,
} from "./m3-health";
import type { M3ScheduleWindowId } from "./m3-environment-data";
import type {
  M3MedicalCaregiverStateIntoOutput,
  M3MedicalCareStore,
  M3MedicalPatientRequestIntoOutput,
  M3MedicalSelectionIntoOutput,
  M3MedicalSelectionIntoScratch,
  M3MedicalSelectionOptions,
} from "./m3-medical-care";
import {
  NEED_LANE_COMFORT,
  NEED_LANE_COUNT,
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_LANE_SOCIAL,
  type NeedLane,
  type NeedStore,
} from "./m3-needs";
import type {
  RestCandidateEnvironmentBasis,
  RestCandidateIndex,
  RestCandidateQuery,
  RestCandidateSelectionIntoOutput,
  RestCandidateSelectionIntoScratch,
  RestFixtureIntoOutput,
  RestFixtureWeatherExposure,
  RestKind,
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
export const AUTONOMY_REAL_SOURCE_COUNT = 4;
export const AUTONOMY_SCHEDULE_CODE_COUNT = 4;
export const AUTONOMY_ORDINARY_MAX_BUCKETS = 8;

export const AUTONOMY_WAKE_EMERGENCY_NEED = 1;
export const AUTONOMY_WAKE_INVALID_TARGET = 2;
export const AUTONOMY_WAKE_JOB_COMPLETED = 4;
export const AUTONOMY_WAKE_SCHEDULE_BOUNDARY = 8;
export const AUTONOMY_WAKE_MASK_ALL = 15;

const AUTONOMY_FACT_CURRENT = 0;
const AUTONOMY_FACT_STALE_NEED = 1;
const AUTONOMY_FACT_STALE_SCHEDULE = 2;
const AUTONOMY_FACT_STALE_CAPABILITY = 3;
const AUTONOMY_FACT_STALE_CANDIDATE = 4;
const AUTONOMY_FACT_STALE_JOB = 5;
const AUTONOMY_FACT_STALE_WAKE = 6;
type AutonomyFactValidationCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const AUTONOMY_SOURCE_QUERY_OK = 0;
const AUTONOMY_SOURCE_QUERY_STALE_CAPABILITY = 1;
const AUTONOMY_SOURCE_QUERY_STALE_OWNER = 2;
type AutonomySourceQueryResult = 0 | 1 | 2;

const AUTONOMY_SOURCE_ABILITY_ALLOWED = 0;
const AUTONOMY_SOURCE_ABILITY_DENIED = 1;
const AUTONOMY_SOURCE_ABILITY_STALE = 2;
type AutonomySourceAbilityQueryResult = 0 | 1 | 2;

/** Construction-only input. The coordinator validates and defensively copies every lane. */
export interface AutonomyDecisionPolicyInput {
  readonly actorCapacity: number;
  readonly policyClassCount: number;
  readonly residentPolicyClassIds: Uint8Array;
  readonly emergencyNeedMaximumValues: Uint16Array;
  readonly sourceEnabledFlags: Uint8Array;
  readonly sourceNeedLaneCodes: Uint8Array;
  readonly sourceNeedMaximumValues: Uint16Array;
  readonly sourceAbilityIds: Uint8Array;
  readonly sourceMinimumAbilityValues: Uint16Array;
  readonly sourceRequiresOpenWindowFlags: Uint8Array;
  readonly sourceHardPriorities: Int32Array;
  readonly sourceBaseScores: Int32Array;
  readonly sourceNeedWeights: Int32Array;
  readonly sourceScheduleBonuses: Int32Array;
  readonly sourceAbilityWeights: Int32Array;
  readonly sourceDistanceWeights: Uint32Array;
  readonly sourceContinuityBonuses: Uint32Array;
  readonly sourceRetryPenalties: Uint32Array;
  readonly minimumConsciousness: number;
  readonly minimumMovement: number;
  readonly safetyEmergencyMaximumValue: number;
  readonly foodDefIds: Uint32Array;
  readonly restKindCodes: Uint8Array;
  readonly restWeatherExposureCodes: Uint8Array;
  readonly medicalUrgencyBuckets: Uint32Array;
  readonly ordinaryDescriptorCounts: Uint8Array;
  readonly ordinaryWorkTypes: Uint8Array;
  readonly ordinaryDefinitionIds: Uint32Array;
  readonly ordinaryUrgencyBuckets: Uint32Array;
  readonly ordinaryRequiredAbilityIds: Uint8Array;
  readonly ordinaryMinimumAbilityValues: Uint16Array;
  readonly ordinaryBaseScoreAdjustments: Int32Array;
  readonly ordinaryDecisionCadenceTicks: number;
  readonly maximumManhattanDistance: number;
}

/** Immutable, defensive-copied policy consumed by the hot path. */
export interface AutonomyDecisionPolicy {
  readonly actorCapacity: number;
  readonly policyClassCount: number;
  readonly residentPolicyClassIds: Uint8Array;
  readonly emergencyNeedMaximumValues: Uint16Array;
  readonly sourceEnabledFlags: Uint8Array;
  readonly sourceNeedLaneCodes: Uint8Array;
  readonly sourceNeedMaximumValues: Uint16Array;
  readonly sourceAbilityIds: Uint8Array;
  readonly sourceMinimumAbilityValues: Uint16Array;
  readonly sourceRequiresOpenWindowFlags: Uint8Array;
  readonly sourceHardPriorities: Int32Array;
  readonly sourceBaseScores: Int32Array;
  readonly sourceNeedWeights: Int32Array;
  readonly sourceScheduleBonuses: Int32Array;
  readonly sourceAbilityWeights: Int32Array;
  readonly sourceDistanceWeights: Uint32Array;
  readonly sourceContinuityBonuses: Uint32Array;
  readonly sourceRetryPenalties: Uint32Array;
  readonly minimumConsciousness: number;
  readonly minimumMovement: number;
  readonly safetyEmergencyMaximumValue: number;
  readonly foodDefIds: Uint32Array;
  readonly restKindCodes: Uint8Array;
  readonly restWeatherExposureCodes: Uint8Array;
  readonly medicalUrgencyBuckets: Uint32Array;
  readonly ordinaryDescriptorCounts: Uint8Array;
  readonly ordinaryWorkTypes: Uint8Array;
  readonly ordinaryDefinitionIds: Uint32Array;
  readonly ordinaryUrgencyBuckets: Uint32Array;
  readonly ordinaryRequiredAbilityIds: Uint8Array;
  readonly ordinaryMinimumAbilityValues: Uint16Array;
  readonly ordinaryBaseScoreAdjustments: Int32Array;
  readonly ordinaryDecisionCadenceTicks: number;
  readonly maximumManhattanDistance: number;
}

/**
 * Validates all construction-time policy facts and takes defensive copies. No request or player
 * mutation can change a compiled coordinator policy after this call.
 */
export function createAutonomyDecisionPolicy(
  input: AutonomyDecisionPolicyInput,
): AutonomyDecisionPolicy {
  validateAutonomyDecisionPolicy(input);
  return {
    actorCapacity: input.actorCapacity,
    policyClassCount: input.policyClassCount,
    residentPolicyClassIds: input.residentPolicyClassIds.slice(),
    emergencyNeedMaximumValues: input.emergencyNeedMaximumValues.slice(),
    sourceEnabledFlags: input.sourceEnabledFlags.slice(),
    sourceNeedLaneCodes: input.sourceNeedLaneCodes.slice(),
    sourceNeedMaximumValues: input.sourceNeedMaximumValues.slice(),
    sourceAbilityIds: input.sourceAbilityIds.slice(),
    sourceMinimumAbilityValues: input.sourceMinimumAbilityValues.slice(),
    sourceRequiresOpenWindowFlags: input.sourceRequiresOpenWindowFlags.slice(),
    sourceHardPriorities: input.sourceHardPriorities.slice(),
    sourceBaseScores: input.sourceBaseScores.slice(),
    sourceNeedWeights: input.sourceNeedWeights.slice(),
    sourceScheduleBonuses: input.sourceScheduleBonuses.slice(),
    sourceAbilityWeights: input.sourceAbilityWeights.slice(),
    sourceDistanceWeights: input.sourceDistanceWeights.slice(),
    sourceContinuityBonuses: input.sourceContinuityBonuses.slice(),
    sourceRetryPenalties: input.sourceRetryPenalties.slice(),
    minimumConsciousness: input.minimumConsciousness,
    minimumMovement: input.minimumMovement,
    safetyEmergencyMaximumValue: input.safetyEmergencyMaximumValue,
    foodDefIds: input.foodDefIds.slice(),
    restKindCodes: input.restKindCodes.slice(),
    restWeatherExposureCodes: input.restWeatherExposureCodes.slice(),
    medicalUrgencyBuckets: input.medicalUrgencyBuckets.slice(),
    ordinaryDescriptorCounts: input.ordinaryDescriptorCounts.slice(),
    ordinaryWorkTypes: input.ordinaryWorkTypes.slice(),
    ordinaryDefinitionIds: input.ordinaryDefinitionIds.slice(),
    ordinaryUrgencyBuckets: input.ordinaryUrgencyBuckets.slice(),
    ordinaryRequiredAbilityIds: input.ordinaryRequiredAbilityIds.slice(),
    ordinaryMinimumAbilityValues: input.ordinaryMinimumAbilityValues.slice(),
    ordinaryBaseScoreAdjustments: input.ordinaryBaseScoreAdjustments.slice(),
    ordinaryDecisionCadenceTicks: input.ordinaryDecisionCadenceTicks,
    maximumManhattanDistance: input.maximumManhattanDistance,
  };
}

function validateAutonomyDecisionPolicy(input: AutonomyDecisionPolicyInput): void {
  requirePositiveSafeInteger(input.actorCapacity, "autonomy policy actor capacity");
  requirePositiveSafeInteger(input.policyClassCount, "autonomy policy class count");
  const tableLength = checkedProduct(
    input.policyClassCount,
    AUTONOMY_SCHEDULE_CODE_COUNT,
    "autonomy policy table length",
  );
  const sourceTableLength = checkedProduct(
    tableLength,
    AUTONOMY_REAL_SOURCE_COUNT,
    "autonomy source table length",
  );
  const ordinaryLength = checkedProduct(
    tableLength,
    AUTONOMY_ORDINARY_MAX_BUCKETS,
    "autonomy ordinary table length",
  );
  requireLaneLength(input.residentPolicyClassIds, input.actorCapacity, "resident policy classes");
  requireLaneLength(input.emergencyNeedMaximumValues, 5, "emergency need thresholds");
  requireLaneLength(input.sourceEnabledFlags, sourceTableLength, "source enabled flags");
  requireLaneLength(input.sourceNeedLaneCodes, AUTONOMY_REAL_SOURCE_COUNT, "source need lanes");
  requireLaneLength(
    input.sourceNeedMaximumValues,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source need thresholds",
  );
  requireLaneLength(input.sourceAbilityIds, AUTONOMY_REAL_SOURCE_COUNT, "source abilities");
  requireLaneLength(
    input.sourceMinimumAbilityValues,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source minimum abilities",
  );
  requireLaneLength(
    input.sourceRequiresOpenWindowFlags,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source schedule flags",
  );
  requireLaneLength(input.sourceHardPriorities, AUTONOMY_REAL_SOURCE_COUNT, "source priorities");
  requireLaneLength(input.sourceBaseScores, AUTONOMY_REAL_SOURCE_COUNT, "source base scores");
  requireLaneLength(input.sourceNeedWeights, AUTONOMY_REAL_SOURCE_COUNT, "source need weights");
  requireLaneLength(
    input.sourceScheduleBonuses,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source schedule bonuses",
  );
  requireLaneLength(
    input.sourceAbilityWeights,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source ability weights",
  );
  requireLaneLength(
    input.sourceDistanceWeights,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source distance weights",
  );
  requireLaneLength(
    input.sourceContinuityBonuses,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source continuity bonuses",
  );
  requireLaneLength(
    input.sourceRetryPenalties,
    AUTONOMY_REAL_SOURCE_COUNT,
    "source retry penalties",
  );
  requireLaneLength(input.foodDefIds, tableLength, "food policy buckets");
  requireLaneLength(input.restKindCodes, tableLength, "rest kind buckets");
  requireLaneLength(input.restWeatherExposureCodes, tableLength, "rest weather buckets");
  requireLaneLength(input.medicalUrgencyBuckets, tableLength, "medical urgency buckets");
  requireLaneLength(input.ordinaryDescriptorCounts, tableLength, "ordinary bucket counts");
  requireLaneLength(input.ordinaryWorkTypes, ordinaryLength, "ordinary work types");
  requireLaneLength(input.ordinaryDefinitionIds, ordinaryLength, "ordinary definition ids");
  requireLaneLength(input.ordinaryUrgencyBuckets, ordinaryLength, "ordinary urgency buckets");
  requireLaneLength(
    input.ordinaryRequiredAbilityIds,
    ordinaryLength,
    "ordinary required abilities",
  );
  requireLaneLength(
    input.ordinaryMinimumAbilityValues,
    ordinaryLength,
    "ordinary minimum abilities",
  );
  requireLaneLength(
    input.ordinaryBaseScoreAdjustments,
    ordinaryLength,
    "ordinary base score adjustments",
  );
  requirePositiveSafeInteger(input.ordinaryDecisionCadenceTicks, "ordinary decision cadence");
  requirePositiveSafeInteger(input.maximumManhattanDistance, "maximum Manhattan distance");
  requireSeverity(input.minimumConsciousness, "minimum consciousness");
  requireSeverity(input.minimumMovement, "minimum movement");
  requireSeverity(input.safetyEmergencyMaximumValue, "safety emergency threshold");
  if (
    (input.emergencyNeedMaximumValues[NEED_LANE_SAFETY] ?? 0) !== input.safetyEmergencyMaximumValue
  )
    throw new RangeError("safety emergency thresholds disagree");

  for (let index = 0; index < input.actorCapacity; index += 1) {
    if ((input.residentPolicyClassIds[index] ?? 0) >= input.policyClassCount)
      throw new RangeError("resident policy class out of range");
  }
  for (let index = 0; index < 5; index += 1)
    requireSeverity(input.emergencyNeedMaximumValues[index] ?? 0, "emergency need threshold");
  for (let sourceIndex = 0; sourceIndex < AUTONOMY_REAL_SOURCE_COUNT; sourceIndex += 1) {
    if ((input.sourceNeedLaneCodes[sourceIndex] ?? 0) >= 5)
      throw new RangeError("source need lane out of range");
    if ((input.sourceAbilityIds[sourceIndex] ?? 0) >= 6)
      throw new RangeError("source ability out of range");
    requireSeverity(input.sourceNeedMaximumValues[sourceIndex] ?? 0, "source need threshold");
    requireSeverity(input.sourceMinimumAbilityValues[sourceIndex] ?? 0, "source ability threshold");
    requireBinary(input.sourceRequiresOpenWindowFlags[sourceIndex] ?? 0, "source schedule flag");
    validateSourceScoreBounds(input, sourceIndex);
  }
  for (let index = 0; index < sourceTableLength; index += 1)
    requireBinary(input.sourceEnabledFlags[index] ?? 0, "source enabled flag");
  for (let tableIndex = 0; tableIndex < tableLength; tableIndex += 1) {
    const count = input.ordinaryDescriptorCounts[tableIndex] ?? 0;
    if (count < 1 || count > AUTONOMY_ORDINARY_MAX_BUCKETS)
      throw new RangeError("ordinary descriptor count out of range");
    if ((input.restKindCodes[tableIndex] ?? 0) > 1)
      throw new RangeError("rest kind code out of range");
    if ((input.restWeatherExposureCodes[tableIndex] ?? 0) > 1)
      throw new RangeError("rest weather code out of range");
    const base = tableIndex * AUTONOMY_ORDINARY_MAX_BUCKETS;
    for (let descriptor = 0; descriptor < count; descriptor += 1) {
      const lane = base + descriptor;
      if ((input.ordinaryWorkTypes[lane] ?? 0) >= 32)
        throw new RangeError("ordinary work type out of range");
      if ((input.ordinaryRequiredAbilityIds[lane] ?? 0) >= 6)
        throw new RangeError("ordinary ability out of range");
      requireSeverity(input.ordinaryMinimumAbilityValues[lane] ?? 0, "ordinary ability threshold");
    }
  }
}

function validateSourceScoreBounds(input: AutonomyDecisionPolicyInput, sourceIndex: number): void {
  let maximum = 0xffff_ffff;
  maximum = checkedAdd(
    maximum,
    absoluteSafe(input.sourceHardPriorities[sourceIndex] ?? 0),
    "score",
  );
  maximum = checkedAdd(maximum, absoluteSafe(input.sourceBaseScores[sourceIndex] ?? 0), "score");
  maximum = checkedAdd(
    maximum,
    checkedProduct(1_000, absoluteSafe(input.sourceNeedWeights[sourceIndex] ?? 0), "score"),
    "score",
  );
  maximum = checkedAdd(
    maximum,
    absoluteSafe(input.sourceScheduleBonuses[sourceIndex] ?? 0),
    "score",
  );
  maximum = checkedAdd(
    maximum,
    checkedProduct(1_000, absoluteSafe(input.sourceAbilityWeights[sourceIndex] ?? 0), "score"),
    "score",
  );
  maximum = checkedAdd(maximum, input.sourceContinuityBonuses[sourceIndex] ?? 0, "score");
  maximum = checkedAdd(maximum, input.sourceRetryPenalties[sourceIndex] ?? 0, "score");
  if (sourceIndex === 3) {
    let maximumOrdinaryAdjustment = 0;
    for (const value of input.ordinaryBaseScoreAdjustments) {
      const adjustment = absoluteSafe(value);
      if (adjustment > maximumOrdinaryAdjustment) maximumOrdinaryAdjustment = adjustment;
    }
    maximum = checkedAdd(maximum, maximumOrdinaryAdjustment, "score");
  }
  maximum = checkedAdd(
    maximum,
    checkedProduct(
      input.maximumManhattanDistance,
      input.sourceDistanceWeights[sourceIndex] ?? 0,
      "score",
    ),
    "score",
  );
  checkedProduct(maximum, 1, "score");
}

function requireLaneLength(lane: { readonly length: number }, length: number, name: string): void {
  if (lane.length !== length) throw new RangeError(`${name} length invalid`);
}

function requirePositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} invalid`);
}

function requireSeverity(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000)
    throw new RangeError(`${name} invalid`);
}

function requireBinary(value: number, name: string): void {
  if (value !== 0 && value !== 1) throw new RangeError(`${name} invalid`);
}

function absoluteSafe(value: number): number {
  if (!Number.isSafeInteger(value)) throw new RangeError("unsafe score component");
  const absolute = Math.abs(value);
  if (!Number.isSafeInteger(absolute)) throw new RangeError("unsafe score component");
  return absolute;
}

function checkedProduct(left: number, right: number, name: string): number {
  const product = left * right;
  if (!Number.isSafeInteger(product)) throw new RangeError(`${name} overflow`);
  return product;
}

function checkedAdd(left: number, right: number, name: string): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) throw new RangeError(`${name} overflow`);
  return sum;
}

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

export function validateAutonomyGlobalCandidateBudget(budget: AutonomyGlobalCandidateBudget): void {
  if (
    budget.visitedCap !== AUTONOMY_MAX_VISITED_CANDIDATES ||
    budget.retainedCap !== AUTONOMY_MAX_RETAINED_CANDIDATES ||
    budget.exactPathCap !== AUTONOMY_MAX_EXACT_PATHS ||
    !isBoundedCount(budget.visitedCount, AUTONOMY_MAX_VISITED_CANDIDATES) ||
    !isBoundedCount(budget.retainedCount, AUTONOMY_MAX_RETAINED_CANDIDATES) ||
    !isBoundedCount(budget.exactPathCount, AUTONOMY_MAX_EXACT_PATHS)
  )
    throw new RangeError("autonomy global budget invalid");
}

function isBoundedCount(value: number, cap: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= cap;
}

/** Fixed coordinator-owned raw Top-12 and full-score lanes. */
export interface AutonomyGlobalRetainedLanes {
  count: number;
  readonly sourceCodes: Uint8Array;
  readonly slotCodes: Uint8Array;
  readonly sourceScratchRowIndexes: Uint8Array;
  readonly policyDescriptorIndexes: Uint8Array;
  readonly needLaneCodes: Uint8Array;
  readonly candidateIds: Uint32Array;
  readonly targetIds: Uint32Array;
  readonly targetCellIndexes: Uint32Array;
  readonly rawScores: Float64Array;
  readonly cheapAdmissionKeys: Float64Array;
  readonly commonScores: Float64Array;
  readonly scoreInvocationCounts: Uint8Array;
  readonly needValues: Uint16Array;
  readonly needOwnerVersions: Uint32Array;
  readonly scheduleCodes: Uint8Array;
  readonly scheduleVersions: Uint32Array;
  readonly abilityIds: Uint8Array;
  readonly abilityMinimumValues: Uint16Array;
  readonly abilityValues: Uint16Array;
  readonly abilityConditionVersions: Uint32Array;
  readonly abilityBaseVersions: Uint32Array;
}

export function validateAutonomyGlobalRetainedLanes(lanes: AutonomyGlobalRetainedLanes): void {
  requireLaneLength(lanes.sourceCodes, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained sources");
  requireLaneLength(lanes.slotCodes, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained slots");
  requireLaneLength(
    lanes.sourceScratchRowIndexes,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained source rows",
  );
  requireLaneLength(
    lanes.policyDescriptorIndexes,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained policy descriptors",
  );
  requireLaneLength(lanes.needLaneCodes, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained needs");
  requireLaneLength(lanes.candidateIds, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained rows");
  requireLaneLength(lanes.targetIds, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained targets");
  requireLaneLength(lanes.targetCellIndexes, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained cells");
  requireLaneLength(lanes.rawScores, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained raw scores");
  requireLaneLength(
    lanes.cheapAdmissionKeys,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained admission keys",
  );
  requireLaneLength(lanes.commonScores, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained common scores");
  requireLaneLength(
    lanes.scoreInvocationCounts,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained scorer counts",
  );
  requireLaneLength(lanes.needValues, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained need values");
  requireLaneLength(
    lanes.needOwnerVersions,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained need versions",
  );
  requireLaneLength(lanes.scheduleCodes, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained schedules");
  requireLaneLength(
    lanes.scheduleVersions,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained schedule versions",
  );
  requireLaneLength(lanes.abilityIds, AUTONOMY_MAX_RETAINED_CANDIDATES, "retained abilities");
  requireLaneLength(
    lanes.abilityMinimumValues,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained ability thresholds",
  );
  requireLaneLength(
    lanes.abilityValues,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained ability values",
  );
  requireLaneLength(
    lanes.abilityConditionVersions,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained condition versions",
  );
  requireLaneLength(
    lanes.abilityBaseVersions,
    AUTONOMY_MAX_RETAINED_CANDIDATES,
    "retained base versions",
  );
  if (
    !Number.isSafeInteger(lanes.count) ||
    lanes.count < 0 ||
    lanes.count > AUTONOMY_MAX_RETAINED_CANDIDATES
  )
    throw new RangeError("retained count invalid");
}

/** Owner-produced wake projection; it does not select a source. */
export interface AutonomyWakeFactsLane {
  readonly sourceTick: Tick;
  readonly residentGenerations: Uint32Array;
  readonly wakeMasks: Uint8Array;
  readonly eventVersions: Uint32Array;
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
  readonly globalRetained: AutonomyGlobalRetainedLanes;
  readonly needValues: Uint16Array;
  readonly needOwnerVersions: Uint32Array;
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
  ingressCount: number;
  scoredCount: number;
  retainedCount: number;
  selectedCount: number;
  approximationDropCount: number;
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
  ingressCount: number;
  scoredCount: number;
  retainedCount: number;
  selectedCount: number;
  approximationDropCount: number;
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
  readonly wakeFacts: AutonomyWakeFactsLane;
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

/**
 * Protocol-neutral B2 arbitration. It reads authoritative owners and exact indexes, but never
 * claims, acquires, transitions, refreshes, or otherwise mutates authoritative world/job state.
 */
export class ResidentAutonomyCoordinator {
  private readonly policy: AutonomyDecisionPolicy;
  private readonly decisionCadenceTicks: number;
  private readonly retryBackoffTicks: number;
  private readonly metrics: AutonomyDecisionMetricsOutput;
  private decisionAdmissionCount = 0;
  private decisionRejectionReason: AutonomyReasonCode = AUTONOMY_REASON_NONE;

  constructor(
    private readonly dependencies: ResidentAutonomyCoordinatorDependencies,
    policyInput: AutonomyDecisionPolicyInput,
    options: ResidentAutonomyCoordinatorOptions = {},
  ) {
    this.policy = createAutonomyDecisionPolicy(policyInput);
    this.decisionCadenceTicks =
      options.decisionCadenceTicks ?? AUTONOMY_DEFAULT_DECISION_CADENCE_TICKS;
    this.retryBackoffTicks = options.retryBackoffTicks ?? AUTONOMY_DEFAULT_RETRY_BACKOFF_TICKS;
    requirePositiveSafeInteger(this.decisionCadenceTicks, "decision cadence");
    requirePositiveSafeInteger(this.retryBackoffTicks, "retry backoff");
    validateCoordinatorConstruction(dependencies, this.policy);
    this.metrics = createCoordinatorMetrics();
  }

  decideInto(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): void {
    this.decisionAdmissionCount = 0;
    this.decisionRejectionReason = AUTONOMY_REASON_NONE;
    resetDecisionOutput(request, output);
    if (!this.prepareDecision(request, scratch, output)) return;
    if (!this.readNeedsAndHardAbilities(request, scratch, output)) return;
    if (this.resolveActiveJob(request, scratch, output)) return;
    if (!this.consumeDecisionSlot()) {
      this.finishDeferred(output);
      return;
    }
    if (!this.admitIndexedCandidates(request, scratch, output)) return;
    if (!this.scoreRetainedCandidates(request, scratch, output)) return;
    reorderRetainedByCommonScore(scratch.globalRetained);
    this.resolveExactPaths(request, scratch, output);
  }

  readMetricsInto(output: AutonomyDecisionMetricsOutput): void {
    copyCoordinatorMetrics(this.metrics, output);
  }

  private prepareDecision(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): boolean {
    if (!isValidDecisionRequest(request, this.dependencies.map)) {
      this.finishFailure(output, AUTONOMY_REASON_FAILED_INVARIANT);
      return false;
    }
    if (!hasValidDecisionScratchShape(scratch)) {
      this.metrics.staleCandidateCount += 1;
      this.finishFailure(output, AUTONOMY_REASON_FAILED_INVARIANT);
      return false;
    }
    resetDecisionScratch(scratch);
    const factCode = validateCurrentDecisionFacts(this.dependencies, request);
    if (factCode !== AUTONOMY_FACT_CURRENT) {
      this.recordStaleFact(factCode);
      this.finishFailure(output, AUTONOMY_REASON_CAPABILITY_STALE_BASIS);
      return false;
    }
    this.dependencies.autonomyStore.readResidentInto(
      request.residentIndex,
      request.residentGeneration,
      scratch.residentReadOutput,
    );
    if (!scratch.residentReadOutput.ok) {
      this.metrics.staleCandidateCount += 1;
      this.finishFailure(output, AUTONOMY_REASON_FAILED_INVARIANT);
      return false;
    }
    output.state = scratch.residentReadOutput.state;
    output.rowVersion = scratch.residentReadOutput.rowVersion;
    output.storeVersion = scratch.residentReadOutput.storeVersion;
    if (this.metrics.tick > request.tick) {
      this.metrics.staleCapabilityCount += 1;
      this.finishFailure(output, AUTONOMY_REASON_CAPABILITY_STALE_BASIS);
      return false;
    }
    if (!this.isDecisionEligible(request, scratch.residentReadOutput.retryTick)) {
      this.finishDeferred(output);
      return false;
    }
    return true;
  }

  private isDecisionEligible(request: AutonomyDecisionRequest, retryTick: Tick): boolean {
    if (this.metrics.tick > request.tick) return false;
    if (this.metrics.tick !== request.tick) {
      this.metrics.tick = request.tick;
      this.metrics.decisionsUsedThisTick = 0;
    }
    if (request.tick < retryTick) return false;
    const wakeMask = this.dependencies.wakeFacts.wakeMasks[request.residentIndex] ?? 0;
    const cadenceDue =
      request.tick % this.decisionCadenceTicks ===
      request.residentIndex % this.decisionCadenceTicks;
    if (wakeMask === 0 && !cadenceDue) return false;
    return true;
  }

  private consumeDecisionSlot(): boolean {
    if (this.metrics.decisionsUsedThisTick >= 2) return false;
    this.metrics.decisionsUsedThisTick += 1;
    this.metrics.decisionStartCount += 1;
    return true;
  }

  private readNeedsAndHardAbilities(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): boolean {
    const needs = this.dependencies.needs;
    if (!needs.isActorActive(request.residentIndex)) {
      this.metrics.staleNeedCount += 1;
      this.finishFailure(output, AUTONOMY_REASON_FAILED_INVARIANT);
      return false;
    }
    for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
      const needLane = decodeNeedLane(lane);
      scratch.needValues[lane] = needs.readLaneValue(request.residentIndex, needLane);
      scratch.needOwnerVersions[lane] = needs.readLaneOwnerVersion(request.residentIndex, needLane);
    }
    if (
      !this.queryHardAbility(
        request,
        scratch,
        M3_ABILITY_CONSCIOUSNESS,
        this.policy.minimumConsciousness,
      )
    ) {
      this.finishHardAbilityFailure(scratch, output);
      return false;
    }
    if (
      !this.queryHardAbility(request, scratch, M3_ABILITY_MOVEMENT, this.policy.minimumMovement)
    ) {
      this.finishHardAbilityFailure(scratch, output);
      return false;
    }
    return true;
  }

  private queryHardAbility(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    ability: number,
    threshold: number,
  ): boolean {
    this.dependencies.abilities.queryAbilityInto(
      request.residentIndex,
      ability,
      this.dependencies.healthConditions,
      threshold,
      scratch.abilityOutput,
    );
    return scratch.abilityOutput.ok;
  }

  private resolveActiveJob(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): boolean {
    const jobs = this.dependencies.jobFacts;
    if ((jobs.activeFlags[request.residentIndex] ?? 0) !== 1) return false;
    output.jobId = jobs.jobIds[request.residentIndex] ?? AUTONOMY_REF_NONE;
    const emergency = hasEmergencyNeed(scratch.needValues, this.policy.emergencyNeedMaximumValues);
    const interruption = jobs.interruptionPolicyCodes[request.residentIndex] ?? 0;
    const safePoint = jobs.safePointFlags[request.residentIndex] ?? 0;
    if (
      emergency &&
      (interruption === AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE ||
        interruption === AUTONOMY_INTERRUPTION_POLICY_EMERGENCY_ONLY ||
        (interruption === AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT && safePoint === 1))
    ) {
      if (!this.consumeDecisionSlot()) {
        this.finishDeferred(output);
        return true;
      }
      output.ok = true;
      output.decisionKind = AUTONOMY_DECISION_INTERRUPTION_REQUESTED;
      output.reasonCode = AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY;
      this.metrics.interruptionRequestCount += 1;
      this.metrics.lastReasonCode = output.reasonCode;
      return true;
    }
    output.ok = true;
    output.decisionKind = AUTONOMY_DECISION_KEEP_WORKING;
    output.reasonCode = AUTONOMY_REASON_NONE;
    this.metrics.keepWorkingCount += 1;
    this.metrics.lastReasonCode = output.reasonCode;
    return true;
  }

  private admitIndexedCandidates(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): boolean {
    const scheduleCode = this.dependencies.scheduleFacts.scheduleCodes[request.residentIndex] ?? 0;
    const policyClass = this.policy.residentPolicyClassIds[request.residentIndex] ?? 0;
    const tableIndex = policyClass * AUTONOMY_SCHEDULE_CODE_COUNT + scheduleCode;
    const enabledCount = this.countEnabledSources(request, scratch, tableIndex);
    if (enabledCount === 0) return true;
    let enabledRank = 0;
    for (let sourceIndex = 0; sourceIndex < AUTONOMY_REAL_SOURCE_COUNT; sourceIndex += 1) {
      if (!this.isSourceEnabled(request, scratch, tableIndex, sourceIndex)) continue;
      const quota = calculateSourceVisitQuota(enabledCount, enabledRank);
      enabledRank += 1;
      const queryResult = this.querySource(request, scratch, tableIndex, sourceIndex, quota);
      if (queryResult === AUTONOMY_SOURCE_QUERY_STALE_CAPABILITY) {
        this.metrics.staleCapabilityCount += 1;
        this.finishFailureWithBudget(scratch, output, AUTONOMY_REASON_CAPABILITY_STALE_BASIS);
        return false;
      }
      if (queryResult === AUTONOMY_SOURCE_QUERY_STALE_OWNER) {
        this.metrics.staleCandidateCount += 1;
        this.finishFailureWithBudget(scratch, output, AUTONOMY_REASON_OFFER_STALE_OWNER);
        return false;
      }
    }
    scratch.globalBudget.retainedCount = scratch.globalRetained.count;
    output.approximationDropCount = this.decisionAdmissionCount - scratch.globalRetained.count;
    if (output.approximationDropCount > 0) this.metrics.retainedCapHitCount += 1;
    return true;
  }

  private countEnabledSources(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
  ): number {
    let count = 0;
    for (let sourceIndex = 0; sourceIndex < AUTONOMY_REAL_SOURCE_COUNT; sourceIndex += 1) {
      if (this.isSourceEnabled(request, scratch, tableIndex, sourceIndex)) count += 1;
    }
    return count;
  }

  private isSourceEnabled(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    sourceIndex: number,
  ): boolean {
    const sourceLane = tableIndex * AUTONOMY_REAL_SOURCE_COUNT + sourceIndex;
    if ((this.policy.sourceEnabledFlags[sourceLane] ?? 0) !== 1) return false;
    if (!this.isSourceNeedEligible(scratch, sourceIndex)) return false;
    return this.isSourceScheduleEligible(request, tableIndex, sourceIndex);
  }

  private isSourceNeedEligible(scratch: AutonomyDecisionScratch, sourceIndex: number): boolean {
    if (
      (scratch.needValues[NEED_LANE_SAFETY] ?? 0) <= this.policy.safetyEmergencyMaximumValue &&
      sourceIndex !== 2
    ) {
      this.recordDecisionRejection(AUTONOMY_REASON_NEED_SAFETY_EMERGENCY);
      return false;
    }
    const needLane = this.policy.sourceNeedLaneCodes[sourceIndex] ?? 0;
    if (
      (scratch.needValues[needLane] ?? 0) > (this.policy.sourceNeedMaximumValues[sourceIndex] ?? 0)
    )
      return false;
    return true;
  }

  private isSourceScheduleEligible(
    request: AutonomyDecisionRequest,
    tableIndex: number,
    sourceIndex: number,
  ): boolean {
    if (
      (this.policy.sourceRequiresOpenWindowFlags[sourceIndex] ?? 0) === 1 &&
      (this.dependencies.scheduleFacts.windowOpenFlags[request.residentIndex] ?? 0) !== 1
    ) {
      this.recordDecisionRejection(AUTONOMY_REASON_IDLE_OFF_SHIFT);
      return false;
    }
    if (sourceIndex === 3) {
      const descriptor = this.ordinaryDescriptorIndex(request, tableIndex);
      const lane = tableIndex * AUTONOMY_ORDINARY_MAX_BUCKETS + descriptor;
      const workType = this.policy.ordinaryWorkTypes[lane] ?? 0;
      const mask = this.dependencies.scheduleFacts.allowedWorkTypeMasks[request.residentIndex] ?? 0;
      if (((mask >>> workType) & 1) !== 1) {
        this.recordDecisionRejection(AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED);
        return false;
      }
    }
    return true;
  }

  private ordinaryDescriptorIndex(request: AutonomyDecisionRequest, tableIndex: number): number {
    const count = this.policy.ordinaryDescriptorCounts[tableIndex] ?? 1;
    const epoch = Math.floor(request.tick / this.policy.ordinaryDecisionCadenceTicks);
    return ((epoch % count) + (request.residentIndex % count)) % count;
  }

  private querySource(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    sourceIndex: number,
    quota: number,
  ): AutonomySourceQueryResult {
    if (sourceIndex === 0) return this.queryFood(request, scratch, tableIndex, quota);
    if (sourceIndex === 1) return this.queryRest(request, scratch, tableIndex, quota);
    if (sourceIndex === 2) return this.queryMedical(request, scratch, tableIndex, quota);
    return this.queryOrdinary(request, scratch, tableIndex, quota);
  }

  private querySourceAbility(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    ability: number,
    minimum: number,
    denialReason: AutonomyReasonCode,
  ): AutonomySourceAbilityQueryResult {
    this.dependencies.abilities.queryAbilityInto(
      request.residentIndex,
      ability,
      this.dependencies.healthConditions,
      minimum,
      scratch.abilityOutput,
    );
    if (scratch.abilityOutput.ok) return AUTONOMY_SOURCE_ABILITY_ALLOWED;
    if (scratch.abilityOutput.reason === "ability.cache_stale_basis")
      return AUTONOMY_SOURCE_ABILITY_STALE;
    this.recordDecisionRejection(denialReason);
    return AUTONOMY_SOURCE_ABILITY_DENIED;
  }

  private queryFood(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    quota: number,
  ): AutonomySourceQueryResult {
    const ability = this.policy.sourceAbilityIds[0] ?? 0;
    const minimum = this.policy.sourceMinimumAbilityValues[0] ?? 0;
    const abilityResult = this.querySourceAbility(
      request,
      scratch,
      ability,
      minimum,
      AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
    );
    if (abilityResult === AUTONOMY_SOURCE_ABILITY_STALE)
      return AUTONOMY_SOURCE_QUERY_STALE_CAPABILITY;
    if (abilityResult === AUTONOMY_SOURCE_ABILITY_DENIED) return AUTONOMY_SOURCE_QUERY_OK;
    this.writeFoodQuery(request, scratch, tableIndex, quota);
    this.dependencies.food.selectCandidatesInto(
      scratch.foodQuery,
      scratch.foodScratch,
      scratch.foodOutput,
    );
    if (
      !recordOwnerVisit(
        scratch,
        scratch.foodOutput.visitedCount,
        scratch.foodOutput.selectedCount,
        quota,
      )
    )
      return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (!scratch.foodOutput.ok || scratch.foodOutput.dirtyBacklog !== 0)
      return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (scratch.foodOutput.candidateCapHit) this.metrics.candidateCapHitCount += 1;
    return this.admitFoodRows(request, scratch, ability)
      ? AUTONOMY_SOURCE_QUERY_OK
      : AUTONOMY_SOURCE_QUERY_STALE_OWNER;
  }

  private writeFoodQuery(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    quota: number,
  ): void {
    const query = scratch.foodQuery;
    query.foodDefId = this.policy.foodDefIds[tableIndex] ?? 0;
    query.regionId = request.originRegionId;
    query.permissionId = this.dependencies.scheduleFacts.permissionIds[request.residentIndex] ?? 0;
    query.mealWindowId = this.dependencies.scheduleFacts.mealWindowIds[request.residentIndex] ?? 0;
    query.candidateCap = quota;
    query.maxSelected = quota;
  }

  private admitFoodRows(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    ability: number,
  ): boolean {
    for (let row = 0; row < scratch.foodOutput.selectedCount; row += 1) {
      const candidateId = scratch.foodScratch.stackIds[row] ?? AUTONOMY_REF_NONE;
      if (
        !this.admitRow(
          request,
          scratch,
          0,
          row,
          0,
          candidateId,
          candidateId,
          scratch.foodScratch.targetCellIndexes[row] ?? AUTONOMY_REF_NONE,
          scratch.foodScratch.scoreMillis[row] ?? 0,
          ability,
        )
      )
        return false;
    }
    return true;
  }

  private queryRest(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    quota: number,
  ): AutonomySourceQueryResult {
    const ability = this.policy.sourceAbilityIds[1] ?? 0;
    const minimum = this.policy.sourceMinimumAbilityValues[1] ?? 0;
    const abilityResult = this.querySourceAbility(
      request,
      scratch,
      ability,
      minimum,
      AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
    );
    if (abilityResult === AUTONOMY_SOURCE_ABILITY_STALE)
      return AUTONOMY_SOURCE_QUERY_STALE_CAPABILITY;
    if (abilityResult === AUTONOMY_SOURCE_ABILITY_DENIED) return AUTONOMY_SOURCE_QUERY_OK;
    this.writeRestQuery(request, scratch, tableIndex, quota);
    this.dependencies.restCandidates.selectCandidatesInto(
      scratch.restQuery,
      scratch.restEnvironment,
      this.dependencies.restStore,
      scratch.restScratch,
      scratch.restOutput,
    );
    if (
      !recordOwnerVisit(
        scratch,
        scratch.restOutput.visitedCount,
        scratch.restOutput.selectedCount,
        quota,
      )
    )
      return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (!scratch.restOutput.ok || scratch.restOutput.dirtyBacklog !== 0)
      return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (scratch.restOutput.candidateCapHit) this.metrics.candidateCapHitCount += 1;
    return this.admitRestRows(request, scratch, ability)
      ? AUTONOMY_SOURCE_QUERY_OK
      : AUTONOMY_SOURCE_QUERY_STALE_OWNER;
  }

  private writeRestQuery(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    quota: number,
  ): void {
    const scheduleCode = this.dependencies.scheduleFacts.scheduleCodes[request.residentIndex] ?? 0;
    const query = scratch.restQuery;
    query.regionId = request.originRegionId;
    query.restKind = decodeRestKind(this.policy.restKindCodes[tableIndex] ?? 0);
    query.scheduleWindow = decodeScheduleWindow(scheduleCode);
    query.weatherExposure = decodeWeatherExposure(
      this.policy.restWeatherExposureCodes[tableIndex] ?? 0,
    );
    query.permissionId = this.dependencies.scheduleFacts.permissionIds[request.residentIndex] ?? 0;
    query.candidateCap = quota;
    query.maxSelectedFixtures = quota;
    writeRestEnvironment(request, this.dependencies.scheduleFacts, query, scratch.restEnvironment);
  }

  private admitRestRows(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    ability: number,
  ): boolean {
    for (let row = 0; row < scratch.restOutput.selectedCount; row += 1) {
      if (
        !this.admitRow(
          request,
          scratch,
          1,
          row,
          0,
          scratch.restScratch.fixtureIds[row] ?? AUTONOMY_REF_NONE,
          scratch.restScratch.entityIndexes[row] ?? AUTONOMY_REF_NONE,
          scratch.restScratch.targetCellIndexes[row] ?? AUTONOMY_REF_NONE,
          scratch.restScratch.scoreMillis[row] ?? 0,
          ability,
        )
      )
        return false;
    }
    return true;
  }

  private queryMedical(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    quota: number,
  ): AutonomySourceQueryResult {
    const ability = this.policy.sourceAbilityIds[2] ?? 0;
    const minimum = this.policy.sourceMinimumAbilityValues[2] ?? 0;
    const caregiverResult = this.prepareMedicalCaregiver(request, scratch, ability, minimum);
    if (caregiverResult === AUTONOMY_SOURCE_ABILITY_STALE)
      return AUTONOMY_SOURCE_QUERY_STALE_CAPABILITY;
    if (caregiverResult === AUTONOMY_SOURCE_ABILITY_DENIED) return AUTONOMY_SOURCE_QUERY_OK;
    const options = scratch.medicalOptions;
    options.caregiverId = request.residentIndex;
    options.regionId = request.originRegionId;
    options.urgencyBucket = this.policy.medicalUrgencyBuckets[tableIndex] ?? 0;
    options.permissionId =
      this.dependencies.scheduleFacts.permissionIds[request.residentIndex] ?? 0;
    options.candidateCap = quota;
    options.maxSelectedRequests = quota;
    this.dependencies.medical.selectTreatmentRequestsInto(
      options,
      this.dependencies.healthConditions,
      this.dependencies.abilities,
      scratch.medicalScratch,
      scratch.medicalOutput,
    );
    if (
      !recordOwnerVisit(
        scratch,
        scratch.medicalOutput.visitedCount,
        scratch.medicalOutput.selectedCount,
        quota,
      )
    )
      return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (!scratch.medicalOutput.ok)
      return scratch.medicalOutput.reason === "medical.selection_empty"
        ? AUTONOMY_SOURCE_QUERY_OK
        : AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    return this.admitMedicalRows(request, scratch, ability, minimum);
  }

  private prepareMedicalCaregiver(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    ability: number,
    minimum: number,
  ): AutonomySourceAbilityQueryResult {
    this.dependencies.medical.readCaregiverStateInto(
      request.residentIndex,
      scratch.medicalCaregiverReadOutput,
    );
    if (!scratch.medicalCaregiverReadOutput.ok || !scratch.medicalCaregiverReadOutput.valid) {
      this.recordDecisionRejection(AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED);
      return AUTONOMY_SOURCE_ABILITY_DENIED;
    }
    if (
      !scratch.medicalCaregiverReadOutput.allowed ||
      scratch.medicalCaregiverReadOutput.permissionId !==
        (this.dependencies.scheduleFacts.permissionIds[request.residentIndex] ?? 0)
    ) {
      this.recordDecisionRejection(AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED);
      return AUTONOMY_SOURCE_ABILITY_DENIED;
    }
    if (
      scratch.medicalCaregiverReadOutput.regionId !== request.originRegionId ||
      scratch.medicalCaregiverReadOutput.ability !== ability ||
      scratch.medicalCaregiverReadOutput.minimumValue !== minimum
    ) {
      this.recordDecisionRejection(AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED);
      return AUTONOMY_SOURCE_ABILITY_DENIED;
    }
    const abilityResult = this.querySourceAbility(
      request,
      scratch,
      ability,
      minimum,
      AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED,
    );
    return abilityResult;
  }

  private hasCurrentMedicalSelection(
    scratch: AutonomyDecisionScratch,
    ability: number,
    minimum: number,
  ): boolean {
    return !(
      scratch.medicalOutput.caregiverAbility !== ability ||
      scratch.medicalOutput.caregiverMinimumValue !== minimum ||
      scratch.medicalOutput.caregiverAbilityValue !== scratch.abilityOutput.value ||
      scratch.medicalOutput.caregiverActorConditionVersion !==
        scratch.abilityOutput.actorConditionVersion ||
      scratch.medicalOutput.caregiverBaseAbilityVersion !==
        scratch.abilityOutput.baseAbilityVersion ||
      !scratch.medicalOutput.caregiverValid ||
      !scratch.medicalOutput.caregiverAllowed
    );
  }

  private admitMedicalRows(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    ability: number,
    minimum: number,
  ): AutonomySourceQueryResult {
    if (!this.hasCurrentMedicalSelection(scratch, ability, minimum))
      return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (scratch.medicalOutput.candidateCapHit) this.metrics.candidateCapHitCount += 1;
    for (let row = 0; row < scratch.medicalOutput.selectedCount; row += 1) {
      if (
        !this.admitRow(
          request,
          scratch,
          2,
          row,
          0,
          scratch.medicalScratch.requestIds[row] ?? AUTONOMY_REF_NONE,
          scratch.medicalScratch.patientIds[row] ?? AUTONOMY_REF_NONE,
          scratch.medicalScratch.targetCellIndexes[row] ?? AUTONOMY_REF_NONE,
          scratch.medicalScratch.scoresMilli[row] ?? 0,
          ability,
        )
      )
        return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    }
    return AUTONOMY_SOURCE_QUERY_OK;
  }

  private queryOrdinary(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    tableIndex: number,
    quota: number,
  ): AutonomySourceQueryResult {
    const descriptor = this.ordinaryDescriptorIndex(request, tableIndex);
    const descriptorLane = tableIndex * AUTONOMY_ORDINARY_MAX_BUCKETS + descriptor;
    const ability = this.policy.ordinaryRequiredAbilityIds[descriptorLane] ?? 0;
    const minimum = this.policy.ordinaryMinimumAbilityValues[descriptorLane] ?? 0;
    const abilityResult = this.querySourceAbility(
      request,
      scratch,
      ability,
      minimum,
      AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED,
    );
    if (abilityResult === AUTONOMY_SOURCE_ABILITY_STALE)
      return AUTONOMY_SOURCE_QUERY_STALE_CAPABILITY;
    if (abilityResult === AUTONOMY_SOURCE_ABILITY_DENIED) return AUTONOMY_SOURCE_QUERY_OK;
    this.writeOrdinaryOptions(request, scratch, descriptorLane, quota);
    this.dependencies.workOffers.selectTopOffersInto(
      scratch.ordinaryOptions,
      scratch.ordinaryScratch,
      scratch.ordinaryOutput,
    );
    if (
      !recordOwnerVisit(
        scratch,
        scratch.ordinaryOutput.visitedCount,
        scratch.ordinaryOutput.selectedCount,
        quota,
      )
    )
      return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (!scratch.ordinaryOutput.ok) return AUTONOMY_SOURCE_QUERY_STALE_OWNER;
    if (scratch.ordinaryOutput.rejectedByCandidateCap > 0) this.metrics.candidateCapHitCount += 1;
    return this.admitOrdinaryRows(request, scratch, descriptor, ability)
      ? AUTONOMY_SOURCE_QUERY_OK
      : AUTONOMY_SOURCE_QUERY_STALE_OWNER;
  }

  private writeOrdinaryOptions(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    descriptorLane: number,
    quota: number,
  ): void {
    const options = scratch.ordinaryOptions;
    options.pawnId = request.residentIndex;
    options.workType = this.policy.ordinaryWorkTypes[descriptorLane] ?? 0;
    options.regionId = request.originRegionId;
    options.defId = this.policy.ordinaryDefinitionIds[descriptorLane] ?? 0;
    options.urgencyBucket = this.policy.ordinaryUrgencyBuckets[descriptorLane] ?? 0;
    options.permissionId =
      this.dependencies.scheduleFacts.permissionIds[request.residentIndex] ?? 0;
    options.candidateCap = quota;
    options.maxSelectedOffers = quota;
  }

  private admitOrdinaryRows(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    descriptor: number,
    ability: number,
  ): boolean {
    for (let row = 0; row < scratch.ordinaryOutput.selectedCount; row += 1) {
      if (
        !this.admitRow(
          request,
          scratch,
          3,
          row,
          descriptor,
          scratch.ordinaryScratch.selectedOfferIds[row] ?? AUTONOMY_REF_NONE,
          scratch.ordinaryScratch.selectedTargetIds[row] ?? AUTONOMY_REF_NONE,
          scratch.ordinaryScratch.selectedTargetCellIndexes[row] ?? AUTONOMY_REF_NONE,
          scratch.ordinaryScratch.selectedScoresMilli[row] ?? 0,
          ability,
        )
      )
        return false;
    }
    return true;
  }

  private admitRow(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    sourceIndex: number,
    sourceRow: number,
    descriptor: number,
    candidateId: number,
    targetId: number,
    targetCellIndex: number,
    rawScore: number,
    ability: number,
  ): boolean {
    if (
      !isUint32(candidateId) ||
      !isUint32(targetId) ||
      !isCellIndex(targetCellIndex, this.dependencies.map) ||
      !Number.isSafeInteger(rawScore)
    )
      return false;
    const cheapKey = safeScoreAdd(rawScore, this.policy.sourceHardPriorities[sourceIndex] ?? 0);
    if (!Number.isSafeInteger(cheapKey)) return false;
    this.decisionAdmissionCount += 1;
    const lanes = scratch.globalRetained;
    const writeIndex = selectRawAdmissionIndex(lanes, cheapKey, candidateId, targetId, sourceIndex);
    if (writeIndex < 0) return true;
    writeAdmissionRow(
      lanes,
      writeIndex,
      sourceIndex,
      sourceRow,
      descriptor,
      candidateId,
      targetId,
      targetCellIndex,
      rawScore,
      cheapKey,
      this.policy.sourceNeedLaneCodes[sourceIndex] ?? 0,
      scratch,
      request,
      ability,
      this.dependencies.scheduleFacts,
    );
    bubbleRawAdmissionUp(lanes, writeIndex);
    return true;
  }

  private scoreRetainedCandidates(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): boolean {
    const lanes = scratch.globalRetained;
    const scheduleCode = this.dependencies.scheduleFacts.scheduleCodes[request.residentIndex] ?? 0;
    const policyClass = this.policy.residentPolicyClassIds[request.residentIndex] ?? 0;
    const tableIndex = policyClass * AUTONOMY_SCHEDULE_CODE_COUNT + scheduleCode;
    for (let row = 0; row < lanes.count; row += 1) {
      lanes.scoreInvocationCounts[row] = (lanes.scoreInvocationCounts[row] ?? 0) + 1;
      output.scoredCount += 1;
      const common = calculateCommonScore(
        this.policy,
        tableIndex,
        request,
        scratch.residentReadOutput,
        lanes,
        row,
        this.dependencies.map.width,
        this.dependencies.scheduleFacts.windowOpenFlags[request.residentIndex] ?? 0,
      );
      if (!Number.isSafeInteger(common)) {
        this.metrics.staleCandidateCount += 1;
        this.finishFailureWithBudget(scratch, output, AUTONOMY_REASON_FAILED_INVARIANT);
        return false;
      }
      lanes.commonScores[row] = common;
      scratch.globalBudget.retainedCount += 0;
    }
    output.retainedCount = lanes.count;
    return true;
  }

  private resolveExactPaths(
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): void {
    const lanes = scratch.globalRetained;
    const attemptLimit = Math.min(lanes.count, AUTONOMY_MAX_EXACT_PATHS);
    for (let row = 0; row < attemptLimit; row += 1) {
      const attemptResult = this.tryExactPath(row, request, scratch, output);
      if (attemptResult !== 0) return;
    }
    if (lanes.count > AUTONOMY_MAX_EXACT_PATHS) this.metrics.exactPathCapHitCount += 1;
    output.ok = true;
    output.decisionKind = AUTONOMY_DECISION_WAIT;
    output.reasonCode =
      lanes.count === 0 ? this.readDecisionRejectionReason() : AUTONOMY_REASON_PATH_NO_ROUTE;
    this.metrics.waitCount += 1;
    this.finishBudget(scratch, output);
    this.metrics.lastReasonCode = output.reasonCode;
  }

  private tryExactPath(
    row: number,
    request: AutonomyDecisionRequest,
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): number {
    const sequence = request.requestSequenceStart + scratch.globalBudget.exactPathCount;
    if (!Number.isSafeInteger(sequence)) {
      this.finishFailureWithBudget(scratch, output, AUTONOMY_REASON_FAILED_INVARIANT);
      return -1;
    }
    writePathRequest(
      request,
      scratch.globalRetained.targetCellIndexes[row] ?? AUTONOMY_REF_NONE,
      sequence,
      this.dependencies.pathBasis,
      scratch.pathRequest,
    );
    scratch.pathRouteCells.fill(AUTONOMY_REF_NONE);
    this.dependencies.pathfinder.findPathInto(
      this.dependencies.map,
      scratch.pathRequest,
      scratch.pathRouteCells,
      scratch.pathOutput,
    );
    scratch.globalBudget.exactPathCount += 1;
    if (!this.accumulatePathExpansions(scratch, output)) return -1;
    if (
      !hasCurrentPathBasis(scratch.pathRequest, scratch.pathOutput, this.dependencies.pathBasis)
    ) {
      this.metrics.stalePathCount += 1;
      return 0;
    }
    if (!scratch.pathOutput.ok) return 0;
    if (!copySelectedRoute(scratch)) {
      this.finishFailureWithBudget(scratch, output, AUTONOMY_REASON_FAILED_INVARIANT);
      return -1;
    }
    writeSelectedBasis(row, request, scratch, this.dependencies);
    publishSelectedCandidate(row, scratch, output);
    output.ok = true;
    output.decisionKind = AUTONOMY_DECISION_NONE;
    output.reasonCode = AUTONOMY_REASON_PATH_SELECTED;
    this.finishBudget(scratch, output);
    this.metrics.lastReasonCode = output.reasonCode;
    return 1;
  }

  private accumulatePathExpansions(
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): boolean {
    if (
      !Number.isSafeInteger(scratch.pathOutput.nodeExpansions) ||
      scratch.pathOutput.nodeExpansions < 0
    ) {
      this.finishFailureWithBudget(scratch, output, AUTONOMY_REASON_FAILED_INVARIANT);
      return false;
    }
    const nextExpansions = safeScoreAdd(output.nodeExpansions, scratch.pathOutput.nodeExpansions);
    if (!Number.isSafeInteger(nextExpansions)) {
      this.finishFailureWithBudget(scratch, output, AUTONOMY_REASON_FAILED_INVARIANT);
      return false;
    }
    output.nodeExpansions = nextExpansions;
    return true;
  }

  private finishBudget(scratch: AutonomyDecisionScratch, output: AutonomyDecisionOutput): void {
    output.visitedCount = scratch.globalBudget.visitedCount;
    output.ingressCount = this.decisionAdmissionCount;
    output.retainedCount = scratch.globalRetained.count;
    output.exactPathCount = scratch.globalBudget.exactPathCount;
    output.approximationDropCount = this.decisionAdmissionCount - scratch.globalRetained.count;
    output.reservationVersion = this.dependencies.reservations.version;
    this.metrics.visitedCount += output.visitedCount;
    this.metrics.ingressCount += output.ingressCount;
    this.metrics.retainedCount += output.retainedCount;
    this.metrics.scoredCount += output.scoredCount;
    this.metrics.selectedCount += output.selectedCount;
    this.metrics.approximationDropCount += output.approximationDropCount;
    this.metrics.exactPathCount += output.exactPathCount;
    this.metrics.nodeExpansionCount += output.nodeExpansions;
  }

  private recordDecisionRejection(reason: AutonomyReasonCode): void {
    if (readRejectionPriority(reason) > readRejectionPriority(this.decisionRejectionReason))
      this.decisionRejectionReason = reason;
  }

  private readDecisionRejectionReason(): AutonomyReasonCode {
    return this.decisionRejectionReason === AUTONOMY_REASON_NONE
      ? AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER
      : this.decisionRejectionReason;
  }

  private recordStaleFact(code: AutonomyFactValidationCode): void {
    if (code === AUTONOMY_FACT_STALE_NEED) this.metrics.staleNeedCount += 1;
    else if (code === AUTONOMY_FACT_STALE_SCHEDULE || code === AUTONOMY_FACT_STALE_WAKE)
      this.metrics.staleScheduleCount += 1;
    else if (code === AUTONOMY_FACT_STALE_CAPABILITY) this.metrics.staleCapabilityCount += 1;
    else if (code === AUTONOMY_FACT_STALE_CANDIDATE) this.metrics.staleCandidateCount += 1;
    else if (code === AUTONOMY_FACT_STALE_JOB) this.metrics.staleJobCount += 1;
  }

  private finishHardAbilityFailure(
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
  ): void {
    if (scratch.abilityOutput.reason === "ability.cache_stale_basis") {
      this.metrics.staleCapabilityCount += 1;
      this.finishFailure(output, AUTONOMY_REASON_CAPABILITY_STALE_BASIS);
      return;
    }
    this.finishFailure(output, AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED);
  }

  private finishFailure(output: AutonomyDecisionOutput, reason: AutonomyReasonCode): void {
    output.ok = false;
    output.decisionKind = AUTONOMY_DECISION_FAILED;
    output.reasonCode = reason;
    this.metrics.failedCount += 1;
    this.metrics.lastReasonCode = reason;
  }

  private finishFailureWithBudget(
    scratch: AutonomyDecisionScratch,
    output: AutonomyDecisionOutput,
    reason: AutonomyReasonCode,
  ): void {
    this.finishBudget(scratch, output);
    this.finishFailure(output, reason);
  }

  private finishDeferred(output: AutonomyDecisionOutput): void {
    output.ok = true;
    output.decisionKind = AUTONOMY_DECISION_DEFERRED;
    output.reasonCode = AUTONOMY_REASON_IDLE_DECISION_DEFERRED;
    this.metrics.deferredCount += 1;
    this.metrics.decisionDeferralCount += 1;
    this.metrics.lastReasonCode = output.reasonCode;
  }
}

function validateCoordinatorConstruction(
  dependencies: ResidentAutonomyCoordinatorDependencies,
  policy: AutonomyDecisionPolicy,
): void {
  const actorCapacity = policy.actorCapacity;
  if (
    actorCapacity > dependencies.autonomyStore.capacity ||
    actorCapacity > dependencies.needs.actorCapacity ||
    actorCapacity > dependencies.entities.capacity ||
    actorCapacity > dependencies.medical.actorCapacity
  )
    throw new RangeError("autonomy coordinator actor capacity invalid");
  validateScheduleFactsLaneCapacity(dependencies.scheduleFacts, actorCapacity);
  validateJobFactsLaneCapacity(dependencies.jobFacts, actorCapacity);
  validateWakeFactsCapacity(dependencies.wakeFacts, actorCapacity);
  const maximumDistance = dependencies.map.width + dependencies.map.height - 2;
  if (
    !Number.isSafeInteger(maximumDistance) ||
    maximumDistance < 0 ||
    policy.maximumManhattanDistance < maximumDistance
  )
    throw new RangeError("autonomy policy Manhattan bound invalid");
  validatePolicyOwnerBuckets(dependencies, policy);
}

function validateScheduleFactsLaneCapacity(
  facts: AutonomyScheduleFactsLane,
  capacity: number,
): void {
  requireLaneAtLeast(facts.residentGenerations, capacity, "facts generations");
  requireLaneAtLeast(facts.scheduleCodes, capacity, "schedule codes");
  requireLaneAtLeast(facts.windowOpenFlags, capacity, "schedule windows");
  requireLaneAtLeast(facts.allowedWorkTypeMasks, capacity, "work masks");
  requireLaneAtLeast(facts.permissionIds, capacity, "schedule permissions");
  requireLaneAtLeast(facts.ownerVersions, capacity, "schedule versions");
  requireLaneAtLeast(facts.mealWindowIds, capacity, "meal windows");
  requireLaneAtLeast(facts.mealWindowVersions, capacity, "meal versions");
  requireLaneAtLeast(facts.weatherExposureCodes, capacity, "weather exposure");
  requireLaneAtLeast(facts.weatherVersions, capacity, "weather versions");
  requireLaneAtLeast(facts.weatherSourceVersions, capacity, "weather source versions");
  requireLaneAtLeast(facts.outdoorWorkAllowedFlags, capacity, "outdoor flags");
}

function validateJobFactsLaneCapacity(facts: AutonomyJobFactsLane, capacity: number): void {
  requireLaneAtLeast(facts.residentGenerations, capacity, "job generations");
  requireLaneAtLeast(facts.activeFlags, capacity, "job active flags");
  requireLaneAtLeast(facts.jobIds, capacity, "job ids");
  requireLaneAtLeast(facts.jobVersions, capacity, "job versions");
  requireLaneAtLeast(facts.interruptionPolicyCodes, capacity, "job interruption policies");
  requireLaneAtLeast(facts.safePointFlags, capacity, "job safe points");
}

function validateWakeFactsCapacity(facts: AutonomyWakeFactsLane, capacity: number): void {
  requireLaneAtLeast(facts.residentGenerations, capacity, "wake generations");
  requireLaneAtLeast(facts.wakeMasks, capacity, "wake masks");
  requireLaneAtLeast(facts.eventVersions, capacity, "wake versions");
}

function requireLaneAtLeast(lane: { readonly length: number }, length: number, name: string): void {
  if (lane.length < length) throw new RangeError(`${name} capacity invalid`);
}

function validatePolicyOwnerBuckets(
  dependencies: ResidentAutonomyCoordinatorDependencies,
  policy: AutonomyDecisionPolicy,
): void {
  const tableLength = policy.policyClassCount * AUTONOMY_SCHEDULE_CODE_COUNT;
  for (let tableIndex = 0; tableIndex < tableLength; tableIndex += 1) {
    if ((policy.foodDefIds[tableIndex] ?? 0) >= dependencies.food.foodDefCapacity)
      throw new RangeError("food policy bucket out of range");
    if ((policy.medicalUrgencyBuckets[tableIndex] ?? 0) >= dependencies.medical.urgencyBucketCount)
      throw new RangeError("medical policy bucket out of range");
    const count = policy.ordinaryDescriptorCounts[tableIndex] ?? 0;
    const base = tableIndex * AUTONOMY_ORDINARY_MAX_BUCKETS;
    for (let descriptor = 0; descriptor < count; descriptor += 1) {
      const lane = base + descriptor;
      if (
        (policy.ordinaryWorkTypes[lane] ?? 0) >= dependencies.workOffers.workTypeCapacity ||
        (policy.ordinaryDefinitionIds[lane] ?? 0) >= dependencies.workOffers.defCapacity ||
        (policy.ordinaryUrgencyBuckets[lane] ?? 0) >= dependencies.workOffers.urgencyBucketCount
      )
        throw new RangeError("ordinary policy bucket out of range");
    }
  }
}

function createCoordinatorMetrics(): AutonomyDecisionMetricsOutput {
  return {
    tick: -1,
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

function copyCoordinatorMetrics(
  source: AutonomyDecisionMetricsOutput,
  target: AutonomyDecisionMetricsOutput,
): void {
  target.tick = source.tick;
  target.decisionsUsedThisTick = source.decisionsUsedThisTick;
  target.decisionStartCount = source.decisionStartCount;
  target.claimedCount = source.claimedCount;
  target.waitCount = source.waitCount;
  target.keepWorkingCount = source.keepWorkingCount;
  target.interruptionRequestCount = source.interruptionRequestCount;
  target.failedCount = source.failedCount;
  target.deferredCount = source.deferredCount;
  target.visitedCount = source.visitedCount;
  target.ingressCount = source.ingressCount;
  target.scoredCount = source.scoredCount;
  target.retainedCount = source.retainedCount;
  target.selectedCount = source.selectedCount;
  target.approximationDropCount = source.approximationDropCount;
  target.candidateCapHitCount = source.candidateCapHitCount;
  target.retainedCapHitCount = source.retainedCapHitCount;
  target.exactPathCount = source.exactPathCount;
  target.exactPathCapHitCount = source.exactPathCapHitCount;
  target.nodeExpansionCount = source.nodeExpansionCount;
  target.staleNeedCount = source.staleNeedCount;
  target.staleScheduleCount = source.staleScheduleCount;
  target.staleCapabilityCount = source.staleCapabilityCount;
  target.staleCandidateCount = source.staleCandidateCount;
  target.stalePathCount = source.stalePathCount;
  target.staleJobCount = source.staleJobCount;
  target.reservationConflictCount = source.reservationConflictCount;
  target.decisionDeferralCount = source.decisionDeferralCount;
  target.lastReasonCode = source.lastReasonCode;
}

function resetDecisionOutput(
  request: AutonomyDecisionRequest,
  output: AutonomyDecisionOutput,
): void {
  output.ok = false;
  output.decisionKind = AUTONOMY_DECISION_NONE;
  output.state = AUTONOMY_STATE_IDLE;
  output.reasonCode = AUTONOMY_REASON_NONE;
  output.residentIndex = request.residentIndex;
  output.residentGeneration = request.residentGeneration;
  output.candidateSourceCode = AUTONOMY_CANDIDATE_SOURCE_NONE;
  output.candidateId = AUTONOMY_REF_NONE;
  output.jobId = AUTONOMY_REF_NONE;
  output.targetId = AUTONOMY_REF_NONE;
  output.targetCellIndex = AUTONOMY_REF_NONE;
  output.routeCellCount = 0;
  output.claimCount = 0;
  output.rowVersion = 0;
  output.storeVersion = 0;
  output.reservationVersion = 0;
  output.visitedCount = 0;
  output.ingressCount = 0;
  output.scoredCount = 0;
  output.retainedCount = 0;
  output.selectedCount = 0;
  output.approximationDropCount = 0;
  output.exactPathCount = 0;
  output.nodeExpansions = 0;
}

function resetDecisionScratch(scratch: AutonomyDecisionScratch): void {
  scratch.globalBudget.visitedCap = AUTONOMY_MAX_VISITED_CANDIDATES;
  scratch.globalBudget.retainedCap = AUTONOMY_MAX_RETAINED_CANDIDATES;
  scratch.globalBudget.exactPathCap = AUTONOMY_MAX_EXACT_PATHS;
  scratch.globalBudget.visitedCount = 0;
  scratch.globalBudget.retainedCount = 0;
  scratch.globalBudget.exactPathCount = 0;
  scratch.globalRetained.count = 0;
  clearRetainedLanes(scratch.globalRetained);
  scratch.needValues.fill(0);
  scratch.needOwnerVersions.fill(0);
  scratch.pathRouteCells.fill(AUTONOMY_REF_NONE);
  scratch.selectedRouteCells.fill(AUTONOMY_REF_NONE);
  resetVersionBasis(scratch.selectedBasis);
}

function clearRetainedLanes(lanes: AutonomyGlobalRetainedLanes): void {
  lanes.sourceCodes.fill(AUTONOMY_CANDIDATE_SOURCE_NONE);
  lanes.slotCodes.fill(0xff);
  lanes.sourceScratchRowIndexes.fill(0xff);
  lanes.policyDescriptorIndexes.fill(0xff);
  lanes.needLaneCodes.fill(0xff);
  lanes.candidateIds.fill(AUTONOMY_REF_NONE);
  lanes.targetIds.fill(AUTONOMY_REF_NONE);
  lanes.targetCellIndexes.fill(AUTONOMY_REF_NONE);
  lanes.rawScores.fill(0);
  lanes.cheapAdmissionKeys.fill(0);
  lanes.commonScores.fill(0);
  lanes.scoreInvocationCounts.fill(0);
  lanes.needValues.fill(0);
  lanes.needOwnerVersions.fill(0);
  lanes.scheduleCodes.fill(0xff);
  lanes.scheduleVersions.fill(0);
  lanes.abilityIds.fill(0xff);
  lanes.abilityMinimumValues.fill(0);
  lanes.abilityValues.fill(0);
  lanes.abilityConditionVersions.fill(0);
  lanes.abilityBaseVersions.fill(0);
}

function isValidDecisionRequest(request: AutonomyDecisionRequest, map: MapGrid): boolean {
  return (
    Number.isSafeInteger(request.tick) &&
    request.tick >= 0 &&
    isUint32(request.residentIndex) &&
    isUint32(request.residentGeneration) &&
    isCellIndex(request.originCellIndex, map) &&
    isUint32(request.originRegionId) &&
    Number.isSafeInteger(request.requestSequenceStart) &&
    request.requestSequenceStart >= 0 &&
    Number.isSafeInteger(request.maxNodeExpansions) &&
    request.maxNodeExpansions > 0
  );
}

function hasValidDecisionScratchShape(scratch: AutonomyDecisionScratch): boolean {
  return (
    hasValidGlobalCandidateBudgetShape(scratch.globalBudget) &&
    hasValidGlobalRetainedShape(scratch.globalRetained) &&
    scratch.needValues.length === NEED_LANE_COUNT &&
    scratch.needOwnerVersions.length === NEED_LANE_COUNT &&
    scratch.pathRouteCells.length >= 1 &&
    scratch.selectedRouteCells.length >= 1
  );
}

function hasValidGlobalCandidateBudgetShape(budget: AutonomyGlobalCandidateBudget): boolean {
  return (
    budget.visitedCap === AUTONOMY_MAX_VISITED_CANDIDATES &&
    budget.retainedCap === AUTONOMY_MAX_RETAINED_CANDIDATES &&
    budget.exactPathCap === AUTONOMY_MAX_EXACT_PATHS &&
    isBoundedCount(budget.visitedCount, AUTONOMY_MAX_VISITED_CANDIDATES) &&
    isBoundedCount(budget.retainedCount, AUTONOMY_MAX_RETAINED_CANDIDATES) &&
    isBoundedCount(budget.exactPathCount, AUTONOMY_MAX_EXACT_PATHS)
  );
}

function hasValidGlobalRetainedShape(lanes: AutonomyGlobalRetainedLanes): boolean {
  const capacity = AUTONOMY_MAX_RETAINED_CANDIDATES;
  return (
    isBoundedCount(lanes.count, capacity) &&
    lanes.sourceCodes.length === capacity &&
    lanes.slotCodes.length === capacity &&
    lanes.sourceScratchRowIndexes.length === capacity &&
    lanes.policyDescriptorIndexes.length === capacity &&
    lanes.needLaneCodes.length === capacity &&
    lanes.candidateIds.length === capacity &&
    lanes.targetIds.length === capacity &&
    lanes.targetCellIndexes.length === capacity &&
    lanes.rawScores.length === capacity &&
    lanes.cheapAdmissionKeys.length === capacity &&
    lanes.commonScores.length === capacity &&
    lanes.scoreInvocationCounts.length === capacity &&
    lanes.needValues.length === capacity &&
    lanes.needOwnerVersions.length === capacity &&
    lanes.scheduleCodes.length === capacity &&
    lanes.scheduleVersions.length === capacity &&
    lanes.abilityIds.length === capacity &&
    lanes.abilityMinimumValues.length === capacity &&
    lanes.abilityValues.length === capacity &&
    lanes.abilityConditionVersions.length === capacity &&
    lanes.abilityBaseVersions.length === capacity
  );
}

function validateCurrentDecisionFacts(
  dependencies: ResidentAutonomyCoordinatorDependencies,
  request: AutonomyDecisionRequest,
): AutonomyFactValidationCode {
  const index = request.residentIndex;
  if (
    index >= dependencies.autonomyStore.capacity ||
    !dependencies.entities.isIndexActive(index) ||
    dependencies.entities.generationAt(index) !== request.residentGeneration
  )
    return AUTONOMY_FACT_STALE_CANDIDATE;
  if (!hasCurrentScheduleFacts(dependencies, request)) return AUTONOMY_FACT_STALE_SCHEDULE;
  if (!hasCurrentJobFacts(dependencies.jobFacts, request)) return AUTONOMY_FACT_STALE_JOB;
  if (!hasCurrentWakeFacts(dependencies.wakeFacts, request)) return AUTONOMY_FACT_STALE_WAKE;
  return AUTONOMY_FACT_CURRENT;
}

function hasCurrentScheduleFacts(
  dependencies: ResidentAutonomyCoordinatorDependencies,
  request: AutonomyDecisionRequest,
): boolean {
  const index = request.residentIndex;
  const schedule = dependencies.scheduleFacts;
  if (
    schedule.sourceTick !== request.tick ||
    (schedule.residentGenerations[index] ?? 0) !== request.residentGeneration
  )
    return false;
  const scheduleCode = schedule.scheduleCodes[index] ?? 0xff;
  const windowOpen = schedule.windowOpenFlags[index] ?? 0xff;
  const weather = schedule.weatherExposureCodes[index] ?? 0xff;
  const outdoor = schedule.outdoorWorkAllowedFlags[index] ?? 0xff;
  if (
    scheduleCode >= AUTONOMY_SCHEDULE_CODE_COUNT ||
    !isBinary(windowOpen) ||
    weather > 1 ||
    !isBinary(outdoor)
  )
    return false;
  const permission = schedule.permissionIds[index] ?? AUTONOMY_REF_NONE;
  if (
    request.originRegionId >= dependencies.food.regionCapacity ||
    request.originRegionId >= dependencies.restCandidates.regionCapacity ||
    request.originRegionId >= dependencies.medical.regionCapacity ||
    request.originRegionId >= dependencies.workOffers.regionCapacity ||
    permission >= dependencies.restCandidates.permissionCapacity ||
    permission >= dependencies.medical.permissionCapacity ||
    permission >= dependencies.workOffers.permissionCapacity
  )
    return false;
  return true;
}

function hasCurrentJobFacts(
  facts: AutonomyJobFactsLane,
  request: AutonomyDecisionRequest,
): boolean {
  const index = request.residentIndex;
  if (
    facts.sourceTick !== request.tick ||
    (facts.residentGenerations[index] ?? 0) !== request.residentGeneration
  )
    return false;
  const active = facts.activeFlags[index] ?? 0xff;
  const safePoint = facts.safePointFlags[index] ?? 0xff;
  const interruption = facts.interruptionPolicyCodes[index] ?? 0xff;
  if (
    !isBinary(active) ||
    !isBinary(safePoint) ||
    interruption > AUTONOMY_INTERRUPTION_POLICY_EMERGENCY_ONLY
  )
    return false;
  if (active === 1) {
    const jobId = facts.jobIds[index] ?? AUTONOMY_REF_NONE;
    const jobVersion = facts.jobVersions[index] ?? 0;
    if (jobId === AUTONOMY_REF_NONE || jobVersion === 0) return false;
  }
  return true;
}

function hasCurrentWakeFacts(
  facts: AutonomyWakeFactsLane,
  request: AutonomyDecisionRequest,
): boolean {
  const index = request.residentIndex;
  return (
    facts.sourceTick === request.tick &&
    (facts.residentGenerations[index] ?? 0) === request.residentGeneration &&
    (facts.wakeMasks[index] ?? 0xff) <= AUTONOMY_WAKE_MASK_ALL
  );
}

function hasEmergencyNeed(values: Uint16Array, thresholds: Uint16Array): boolean {
  for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
    if ((values[lane] ?? 0) <= (thresholds[lane] ?? 0)) return true;
  }
  return false;
}

function calculateSourceVisitQuota(enabledCount: number, enabledRank: number): number {
  const base = Math.floor(AUTONOMY_MAX_VISITED_CANDIDATES / enabledCount);
  const remainder = AUTONOMY_MAX_VISITED_CANDIDATES % enabledCount;
  const quota = base + (enabledRank < remainder ? 1 : 0);
  return Math.min(AUTONOMY_MAX_RETAINED_CANDIDATES, quota);
}

function recordOwnerVisit(
  scratch: AutonomyDecisionScratch,
  visitedCount: number,
  selectedCount: number,
  quota: number,
): boolean {
  if (
    !Number.isSafeInteger(visitedCount) ||
    visitedCount < 0 ||
    visitedCount > quota ||
    !Number.isSafeInteger(selectedCount) ||
    selectedCount < 0 ||
    selectedCount > quota
  )
    return false;
  const total = scratch.globalBudget.visitedCount + visitedCount;
  if (!Number.isSafeInteger(total) || total > AUTONOMY_MAX_VISITED_CANDIDATES) return false;
  scratch.globalBudget.visitedCount = total;
  return true;
}

function decodeRestKind(code: number): RestKind {
  return code === 0 ? "rest" : "sleep";
}

function decodeNeedLane(code: number): NeedLane {
  if (code === NEED_LANE_HUNGER) return NEED_LANE_HUNGER;
  if (code === NEED_LANE_REST) return NEED_LANE_REST;
  if (code === NEED_LANE_COMFORT) return NEED_LANE_COMFORT;
  if (code === NEED_LANE_SOCIAL) return NEED_LANE_SOCIAL;
  return NEED_LANE_SAFETY;
}

function decodeScheduleWindow(code: number): M3ScheduleWindowId {
  if (code === 0) return "dawn";
  if (code === 1) return "daytime";
  if (code === 2) return "evening";
  return "night";
}

function decodeWeatherExposure(code: number): RestFixtureWeatherExposure {
  return code === 0 ? "indoor" : "outdoor";
}

function writeRestEnvironment(
  request: AutonomyDecisionRequest,
  facts: AutonomyScheduleFactsLane,
  query: AutonomyRestCandidateQuery,
  output: AutonomyRestEnvironmentBasis,
): void {
  const index = request.residentIndex;
  output.scheduleWindow = query.scheduleWindow;
  output.scheduleWindowVersion = facts.ownerVersions[index] ?? 0;
  output.weatherExposure = query.weatherExposure;
  output.outdoorWorkAllowed = (facts.outdoorWorkAllowedFlags[index] ?? 0) === 1;
  output.weatherVersion = facts.weatherVersions[index] ?? 0;
  output.weatherSourceVersion = facts.weatherSourceVersions[index] ?? 0;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isBinary(value: number): boolean {
  return value === 0 || value === 1;
}

function isCellIndex(value: number, map: MapGrid): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < map.cellCount;
}

function safeScoreAdd(left: number, right: number): number {
  const result = left + right;
  return Number.isSafeInteger(result) ? result : Number.NaN;
}

function safeScoreMultiply(left: number, right: number): number {
  const result = left * right;
  return Number.isSafeInteger(result) ? result : Number.NaN;
}

function readRejectionPriority(reason: AutonomyReasonCode): number {
  if (reason === AUTONOMY_REASON_NEED_SAFETY_EMERGENCY) return 6;
  if (reason === AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED) return 5;
  if (reason === AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED) return 4;
  if (reason === AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED) return 3;
  if (reason === AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED) return 2;
  if (reason === AUTONOMY_REASON_IDLE_OFF_SHIFT) return 1;
  return 0;
}

function selectRawAdmissionIndex(
  lanes: AutonomyGlobalRetainedLanes,
  cheapKey: number,
  candidateId: number,
  targetId: number,
  slotCode: number,
): number {
  if (lanes.count < AUTONOMY_MAX_RETAINED_CANDIDATES) {
    const index = lanes.count;
    lanes.count += 1;
    return index;
  }
  const tail = AUTONOMY_MAX_RETAINED_CANDIDATES - 1;
  return isIncomingBeforeRow(lanes, tail, cheapKey, candidateId, targetId, slotCode) ? tail : -1;
}

function isIncomingBeforeRow(
  lanes: AutonomyGlobalRetainedLanes,
  row: number,
  score: number,
  candidateId: number,
  targetId: number,
  slotCode: number,
): boolean {
  const rowScore = lanes.cheapAdmissionKeys[row] ?? 0;
  if (score !== rowScore) return score > rowScore;
  const rowId = lanes.candidateIds[row] ?? AUTONOMY_REF_NONE;
  if (candidateId !== rowId) return candidateId < rowId;
  const rowTarget = lanes.targetIds[row] ?? AUTONOMY_REF_NONE;
  if (targetId !== rowTarget) return targetId < rowTarget;
  return slotCode < (lanes.slotCodes[row] ?? 0xff);
}

function writeAdmissionRow(
  lanes: AutonomyGlobalRetainedLanes,
  row: number,
  sourceIndex: number,
  sourceScratchRow: number,
  descriptor: number,
  candidateId: number,
  targetId: number,
  targetCellIndex: number,
  rawScore: number,
  cheapKey: number,
  sourceNeedLane: number,
  scratch: AutonomyDecisionScratch,
  request: AutonomyDecisionRequest,
  ability: number,
  scheduleFacts: AutonomyScheduleFactsLane,
): void {
  lanes.sourceCodes[row] = sourceIndex + 1;
  lanes.slotCodes[row] = sourceIndex;
  lanes.sourceScratchRowIndexes[row] = sourceScratchRow;
  lanes.policyDescriptorIndexes[row] = descriptor;
  lanes.needLaneCodes[row] = sourceNeedLane;
  lanes.candidateIds[row] = candidateId;
  lanes.targetIds[row] = targetId;
  lanes.targetCellIndexes[row] = targetCellIndex;
  lanes.rawScores[row] = rawScore;
  lanes.cheapAdmissionKeys[row] = cheapKey;
  lanes.commonScores[row] = 0;
  lanes.scoreInvocationCounts[row] = 0;
  lanes.needValues[row] = scratch.needValues[sourceNeedLane] ?? 0;
  lanes.needOwnerVersions[row] = scratch.needOwnerVersions[sourceNeedLane] ?? 0;
  lanes.scheduleCodes[row] = scheduleFacts.scheduleCodes[request.residentIndex] ?? 0;
  lanes.scheduleVersions[row] = scheduleFacts.ownerVersions[request.residentIndex] ?? 0;
  lanes.abilityIds[row] = ability;
  lanes.abilityMinimumValues[row] = scratch.abilityOutput.threshold;
  lanes.abilityValues[row] = scratch.abilityOutput.value;
  lanes.abilityConditionVersions[row] = scratch.abilityOutput.actorConditionVersion;
  lanes.abilityBaseVersions[row] = scratch.abilityOutput.baseAbilityVersion;
}

function bubbleRawAdmissionUp(lanes: AutonomyGlobalRetainedLanes, start: number): void {
  let row = start;
  while (row > 0 && isRetainedRowBefore(lanes, row, row - 1, false)) {
    swapRetainedRows(lanes, row, row - 1);
    row -= 1;
  }
}

function reorderRetainedByCommonScore(lanes: AutonomyGlobalRetainedLanes): void {
  for (let pass = 1; pass < lanes.count; pass += 1) {
    let row = pass;
    while (row > 0 && isRetainedRowBefore(lanes, row, row - 1, true)) {
      swapRetainedRows(lanes, row, row - 1);
      row -= 1;
    }
  }
}

function isRetainedRowBefore(
  lanes: AutonomyGlobalRetainedLanes,
  left: number,
  right: number,
  common: boolean,
): boolean {
  const leftScore = common
    ? (lanes.commonScores[left] ?? 0)
    : (lanes.cheapAdmissionKeys[left] ?? 0);
  const rightScore = common
    ? (lanes.commonScores[right] ?? 0)
    : (lanes.cheapAdmissionKeys[right] ?? 0);
  if (leftScore !== rightScore) return leftScore > rightScore;
  const leftId = lanes.candidateIds[left] ?? AUTONOMY_REF_NONE;
  const rightId = lanes.candidateIds[right] ?? AUTONOMY_REF_NONE;
  if (leftId !== rightId) return leftId < rightId;
  const leftTarget = lanes.targetIds[left] ?? AUTONOMY_REF_NONE;
  const rightTarget = lanes.targetIds[right] ?? AUTONOMY_REF_NONE;
  if (leftTarget !== rightTarget) return leftTarget < rightTarget;
  return (lanes.slotCodes[left] ?? 0xff) < (lanes.slotCodes[right] ?? 0xff);
}

function swapRetainedRows(lanes: AutonomyGlobalRetainedLanes, left: number, right: number): void {
  swapUint8(lanes.sourceCodes, left, right);
  swapUint8(lanes.slotCodes, left, right);
  swapUint8(lanes.sourceScratchRowIndexes, left, right);
  swapUint8(lanes.policyDescriptorIndexes, left, right);
  swapUint8(lanes.needLaneCodes, left, right);
  swapUint32(lanes.candidateIds, left, right);
  swapUint32(lanes.targetIds, left, right);
  swapUint32(lanes.targetCellIndexes, left, right);
  swapFloat64(lanes.rawScores, left, right);
  swapFloat64(lanes.cheapAdmissionKeys, left, right);
  swapFloat64(lanes.commonScores, left, right);
  swapUint8(lanes.scoreInvocationCounts, left, right);
  swapUint16(lanes.needValues, left, right);
  swapUint32(lanes.needOwnerVersions, left, right);
  swapUint8(lanes.scheduleCodes, left, right);
  swapUint32(lanes.scheduleVersions, left, right);
  swapUint8(lanes.abilityIds, left, right);
  swapUint16(lanes.abilityMinimumValues, left, right);
  swapUint16(lanes.abilityValues, left, right);
  swapUint32(lanes.abilityConditionVersions, left, right);
  swapUint32(lanes.abilityBaseVersions, left, right);
}

function swapUint8(lane: Uint8Array, left: number, right: number): void {
  const value = lane[left] ?? 0;
  lane[left] = lane[right] ?? 0;
  lane[right] = value;
}

function swapUint16(lane: Uint16Array, left: number, right: number): void {
  const value = lane[left] ?? 0;
  lane[left] = lane[right] ?? 0;
  lane[right] = value;
}

function swapUint32(lane: Uint32Array, left: number, right: number): void {
  const value = lane[left] ?? 0;
  lane[left] = lane[right] ?? 0;
  lane[right] = value;
}

function swapFloat64(lane: Float64Array, left: number, right: number): void {
  const value = lane[left] ?? 0;
  lane[left] = lane[right] ?? 0;
  lane[right] = value;
}

function calculateCommonScore(
  policy: AutonomyDecisionPolicy,
  tableIndex: number,
  request: AutonomyDecisionRequest,
  resident: ResidentAutonomyReadOutput,
  lanes: AutonomyGlobalRetainedLanes,
  row: number,
  mapWidth: number,
  windowOpen: number,
): number {
  const sourceIndex = (lanes.sourceCodes[row] ?? 1) - 1;
  let score = lanes.rawScores[row] ?? 0;
  score = safeScoreAdd(score, policy.sourceBaseScores[sourceIndex] ?? 0);
  const urgency = 1_000 - (lanes.needValues[row] ?? 0);
  score = safeScoreAdd(
    score,
    safeScoreMultiply(urgency, policy.sourceNeedWeights[sourceIndex] ?? 0),
  );
  if (windowOpen === 1) score = safeScoreAdd(score, policy.sourceScheduleBonuses[sourceIndex] ?? 0);
  score = safeScoreAdd(
    score,
    safeScoreMultiply(lanes.abilityValues[row] ?? 0, policy.sourceAbilityWeights[sourceIndex] ?? 0),
  );
  if (sourceIndex === 3) {
    const descriptor = lanes.policyDescriptorIndexes[row] ?? 0;
    const lane = tableIndex * AUTONOMY_ORDINARY_MAX_BUCKETS + descriptor;
    score = safeScoreAdd(score, policy.ordinaryBaseScoreAdjustments[lane] ?? 0);
  }
  if (
    resident.candidateSourceCode === (lanes.sourceCodes[row] ?? 0) &&
    resident.candidateId === (lanes.candidateIds[row] ?? AUTONOMY_REF_NONE)
  ) {
    score = safeScoreAdd(score, policy.sourceContinuityBonuses[sourceIndex] ?? 0);
    if (resident.state === AUTONOMY_STATE_BLOCKED)
      score = safeScoreAdd(score, -(policy.sourceRetryPenalties[sourceIndex] ?? 0));
  }
  const distance = manhattanDistance(
    request.originCellIndex,
    lanes.targetCellIndexes[row] ?? AUTONOMY_REF_NONE,
    mapWidth,
  );
  return safeScoreAdd(
    score,
    -safeScoreMultiply(distance, policy.sourceDistanceWeights[sourceIndex] ?? 0),
  );
}

function manhattanDistance(left: number, right: number, width: number): number {
  const leftX = left % width;
  const leftY = Math.floor(left / width);
  const rightX = right % width;
  const rightY = Math.floor(right / width);
  return Math.abs(leftX - rightX) + Math.abs(leftY - rightY);
}

function writePathRequest(
  request: AutonomyDecisionRequest,
  goalCellIndex: number,
  sequence: number,
  liveBasis: AutonomyPathBasisLane,
  output: AutonomyPathRequest,
): void {
  output.requestSequence = sequence;
  output.issuedTick = request.tick;
  output.startCellIndex = request.originCellIndex;
  output.goalCellIndex = goalCellIndex;
  output.maxNodeExpansions = request.maxNodeExpansions;
  output.basis.mapVersion = liveBasis.mapVersion;
  output.basis.navigationVersion = liveBasis.navigationVersion;
  output.basis.regionVersion = liveBasis.regionVersion;
  output.basis.roomVersion = liveBasis.roomVersion;
  output.basis.regionGraphVersion = liveBasis.regionGraphVersion;
}

function hasCurrentPathBasis(
  requested: AutonomyPathRequest,
  output: PathSearchIntoOutput,
  live: AutonomyPathBasisLane,
): boolean {
  return (
    output.requestSequence === requested.requestSequence &&
    output.startCellIndex === requested.startCellIndex &&
    output.goalCellIndex === requested.goalCellIndex &&
    output.mapVersion === requested.basis.mapVersion &&
    output.navigationVersion === requested.basis.navigationVersion &&
    output.regionVersion === requested.basis.regionVersion &&
    output.roomVersion === requested.basis.roomVersion &&
    output.regionGraphVersion === requested.basis.regionGraphVersion &&
    live.mapVersion === requested.basis.mapVersion &&
    live.navigationVersion === requested.basis.navigationVersion &&
    live.regionVersion === requested.basis.regionVersion &&
    live.roomVersion === requested.basis.roomVersion &&
    live.regionGraphVersion === requested.basis.regionGraphVersion
  );
}

function copySelectedRoute(scratch: AutonomyDecisionScratch): boolean {
  const count = scratch.pathOutput.pathCellCount;
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > scratch.pathRouteCells.length ||
    count > scratch.selectedRouteCells.length
  )
    return false;
  scratch.selectedRouteCells.fill(AUTONOMY_REF_NONE);
  for (let index = 0; index < count; index += 1)
    scratch.selectedRouteCells[index] = scratch.pathRouteCells[index] ?? AUTONOMY_REF_NONE;
  return true;
}

function publishSelectedCandidate(
  row: number,
  scratch: AutonomyDecisionScratch,
  output: AutonomyDecisionOutput,
): void {
  const lanes = scratch.globalRetained;
  output.candidateSourceCode = decodeCandidateSource(lanes.sourceCodes[row] ?? 0);
  output.candidateId = lanes.candidateIds[row] ?? AUTONOMY_REF_NONE;
  output.targetId = lanes.targetIds[row] ?? AUTONOMY_REF_NONE;
  output.targetCellIndex = lanes.targetCellIndexes[row] ?? AUTONOMY_REF_NONE;
  output.routeCellCount = scratch.pathOutput.pathCellCount;
  output.selectedCount = 1;
}

function decodeCandidateSource(code: number): AutonomyCandidateSourceCode {
  if (code === 1) return 1;
  if (code === 2) return 2;
  if (code === 3) return 3;
  if (code === 4) return 4;
  if (code === 5) return 5;
  return 0;
}

function writeSelectedBasis(
  retainedRow: number,
  request: AutonomyDecisionRequest,
  scratch: AutonomyDecisionScratch,
  dependencies: ResidentAutonomyCoordinatorDependencies,
): void {
  const basis = scratch.selectedBasis;
  const lanes = scratch.globalRetained;
  resetVersionBasis(basis);
  basis.candidateId = lanes.candidateIds[retainedRow] ?? AUTONOMY_REF_NONE;
  basis.needOwnerVersion = lanes.needOwnerVersions[retainedRow] ?? 0;
  basis.scheduleVersion = lanes.scheduleVersions[retainedRow] ?? 0;
  basis.capabilityConditionVersion = lanes.abilityConditionVersions[retainedRow] ?? 0;
  basis.capabilityBaseVersion = lanes.abilityBaseVersions[retainedRow] ?? 0;
  basis.pathMapVersion = scratch.pathOutput.mapVersion;
  basis.pathNavigationVersion = scratch.pathOutput.navigationVersion;
  basis.pathRegionVersion = scratch.pathOutput.regionVersion;
  basis.pathRoomVersion = scratch.pathOutput.roomVersion;
  basis.pathRegionGraphVersion = scratch.pathOutput.regionGraphVersion;
  basis.reservationVersion = dependencies.reservations.version;
  basis.jobVersion = dependencies.jobFacts.jobVersions[request.residentIndex] ?? 0;
  const source = lanes.sourceCodes[retainedRow] ?? 0;
  const sourceRow = lanes.sourceScratchRowIndexes[retainedRow] ?? 0;
  if (source === 1) writeSelectedFoodBasis(sourceRow, scratch, basis);
  else if (source === 2) writeSelectedRestBasis(sourceRow, scratch, basis);
  else if (source === 3) writeSelectedMedicalBasis(sourceRow, scratch, basis);
  else if (source === 4) writeSelectedOrdinaryBasis(sourceRow, scratch, basis);
}

function writeSelectedFoodBasis(
  row: number,
  scratch: AutonomyDecisionScratch,
  basis: AutonomyVersionBasis,
): void {
  basis.candidateOwnerVersion = scratch.foodOutput.foodAvailabilityVersion;
  basis.candidateRowVersion = scratch.foodScratch.itemStoreVersions[row] ?? 0;
  basis.candidateIndexVersion = scratch.foodOutput.foodAvailabilityVersion;
  basis.candidateBacklog = scratch.foodOutput.dirtyBacklog;
  basis.foodAvailabilityVersion = scratch.foodOutput.foodAvailabilityVersion;
  basis.foodItemVersion = scratch.foodScratch.itemStoreVersions[row] ?? 0;
  basis.foodMealWindowId = scratch.foodScratch.mealWindowIds[row] ?? 0;
  basis.foodMealWindowVersion = scratch.foodScratch.mealWindowVersions[row] ?? 0;
  basis.foodDirtyBacklog = scratch.foodOutput.dirtyBacklog;
}

function writeSelectedRestBasis(
  row: number,
  scratch: AutonomyDecisionScratch,
  basis: AutonomyVersionBasis,
): void {
  basis.candidateOwnerVersion = scratch.restOutput.restStoreVersion;
  basis.candidateRowVersion = scratch.restScratch.currentFixtureOwnerVersions[row] ?? 0;
  basis.candidateIndexVersion = scratch.restOutput.indexVersion;
  basis.candidateBacklog = scratch.restOutput.dirtyBacklog;
  basis.restStoreVersion = scratch.restOutput.restStoreVersion;
  basis.restCachedRowVersion = scratch.restScratch.cachedFixtureVersions[row] ?? 0;
  basis.restCurrentRowVersion = scratch.restScratch.currentFixtureOwnerVersions[row] ?? 0;
  basis.restSourceVersion = scratch.restOutput.sourceVersion;
  basis.restIndexVersion = scratch.restOutput.indexVersion;
  basis.restDirtyBacklog = scratch.restOutput.dirtyBacklog;
  basis.restScheduleWindowCode =
    scratch.restEnvironment.scheduleWindow === "dawn"
      ? 0
      : scratch.restEnvironment.scheduleWindow === "daytime"
        ? 1
        : scratch.restEnvironment.scheduleWindow === "evening"
          ? 2
          : 3;
  basis.restScheduleWindowVersion = scratch.restEnvironment.scheduleWindowVersion;
  basis.restWeatherExposureCode = scratch.restEnvironment.weatherExposure === "indoor" ? 0 : 1;
  basis.restWeatherVersion = scratch.restEnvironment.weatherVersion;
  basis.restWeatherSourceVersion = scratch.restEnvironment.weatherSourceVersion;
  basis.restOutdoorWorkAllowed = scratch.restEnvironment.outdoorWorkAllowed ? 1 : 0;
}

function writeSelectedMedicalBasis(
  row: number,
  scratch: AutonomyDecisionScratch,
  basis: AutonomyVersionBasis,
): void {
  const output = scratch.medicalOutput;
  basis.candidateOwnerVersion = output.medicalStoreVersion;
  basis.candidateRowVersion = scratch.medicalScratch.conditionVersions[row] ?? 0;
  basis.candidateIndexVersion = output.medicalStoreVersion;
  basis.candidateBacklog = 0;
  basis.medicalStoreVersion = output.medicalStoreVersion;
  basis.medicalHealthStoreVersion = scratch.medicalScratch.healthStoreVersions[row] ?? 0;
  basis.medicalConditionVersion = scratch.medicalScratch.conditionVersions[row] ?? 0;
  basis.medicalActorVersion = scratch.medicalScratch.actorConditionVersions[row] ?? 0;
  basis.medicalCaregiverId = output.selectedCaregiverId;
  basis.medicalCaregiverRegionId = output.caregiverRegionId;
  basis.medicalCaregiverPermissionId = output.caregiverPermissionId;
  basis.medicalCaregiverAbility = output.caregiverAbility;
  basis.medicalCaregiverMinimumAbility = output.caregiverMinimumValue;
  basis.medicalCaregiverAbilityValue = output.caregiverAbilityValue;
  basis.medicalCaregiverActorConditionVersion = output.caregiverActorConditionVersion;
  basis.medicalCaregiverBaseAbilityVersion = output.caregiverBaseAbilityVersion;
  basis.medicalCaregiverValid = output.caregiverValid ? 1 : 0;
  basis.medicalCaregiverAllowed = output.caregiverAllowed ? 1 : 0;
}

function writeSelectedOrdinaryBasis(
  row: number,
  scratch: AutonomyDecisionScratch,
  basis: AutonomyVersionBasis,
): void {
  basis.candidateOwnerVersion = scratch.ordinaryScratch.selectedOwnerVersions[row] ?? 0;
  basis.candidateRowVersion = scratch.ordinaryScratch.selectedRowVersions[row] ?? 0;
  basis.candidateIndexVersion = scratch.ordinaryOutput.selectedIndexVersion;
  basis.candidateBacklog = 0;
}

function resetVersionBasis(basis: AutonomyVersionBasis): void {
  basis.candidateId = AUTONOMY_REF_NONE;
  basis.candidateOwnerVersion = 0;
  basis.candidateRowVersion = 0;
  basis.candidateIndexVersion = 0;
  basis.candidateBacklog = 0;
  basis.needOwnerVersion = 0;
  basis.scheduleVersion = 0;
  basis.capabilityConditionVersion = 0;
  basis.capabilityBaseVersion = 0;
  basis.foodAvailabilityVersion = 0;
  basis.foodItemVersion = 0;
  basis.foodMealWindowId = 0;
  basis.foodMealWindowVersion = 0;
  basis.foodDirtyBacklog = 0;
  basis.restStoreVersion = 0;
  basis.restCachedRowVersion = 0;
  basis.restCurrentRowVersion = 0;
  basis.restSourceVersion = 0;
  basis.restIndexVersion = 0;
  basis.restDirtyBacklog = 0;
  basis.restScheduleWindowCode = 0;
  basis.restScheduleWindowVersion = 0;
  basis.restWeatherExposureCode = 0;
  basis.restWeatherVersion = 0;
  basis.restWeatherSourceVersion = 0;
  basis.restOutdoorWorkAllowed = 0;
  basis.medicalStoreVersion = 0;
  basis.medicalHealthStoreVersion = 0;
  basis.medicalConditionVersion = 0;
  basis.medicalActorVersion = 0;
  basis.medicalCaregiverId = 0;
  basis.medicalCaregiverRegionId = 0;
  basis.medicalCaregiverPermissionId = 0;
  basis.medicalCaregiverAbility = 0;
  basis.medicalCaregiverMinimumAbility = 0;
  basis.medicalCaregiverAbilityValue = 0;
  basis.medicalCaregiverActorConditionVersion = 0;
  basis.medicalCaregiverBaseAbilityVersion = 0;
  basis.medicalCaregiverValid = 0;
  basis.medicalCaregiverAllowed = 0;
  basis.pathMapVersion = 0;
  basis.pathNavigationVersion = 0;
  basis.pathRegionVersion = 0;
  basis.pathRoomVersion = 0;
  basis.pathRegionGraphVersion = 0;
  basis.reservationVersion = 0;
  basis.jobVersion = 0;
}
