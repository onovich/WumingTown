import type { Tick } from "./time";
import type { AutonomyReasonOutput } from "./game-session-autonomy-reasons";

export const RESIDENT_AUTONOMY_SNAPSHOT_VERSION = 2;
export const AUTONOMY_REF_NONE = 0xffff_ffff;
export const AUTONOMY_MAX_VISITED_CANDIDATES = 24;
export const AUTONOMY_MAX_RETAINED_CANDIDATES = 12;
export const AUTONOMY_MAX_EXACT_PATHS = 4;
export const AUTONOMY_MAX_NEW_DECISIONS_PER_TICK = 2;
export const AUTONOMY_MAX_ROUTE_CELLS = 128;
export const AUTONOMY_MAX_CLAIM_REFS = 8;

export const AUTONOMY_CANDIDATE_SOURCE_NONE = 0;
export const AUTONOMY_CANDIDATE_SOURCE_FOOD = 1;
export const AUTONOMY_CANDIDATE_SOURCE_REST = 2;
export const AUTONOMY_CANDIDATE_SOURCE_MEDICAL = 3;
export const AUTONOMY_CANDIDATE_SOURCE_ORDINARY = 4;
export const AUTONOMY_CANDIDATE_SOURCE_WAIT = 5;
export type AutonomyCandidateSourceCode = 0 | 1 | 2 | 3 | 4 | 5;

export const AUTONOMY_CANDIDATE_SLOT_FOOD = 0;
export const AUTONOMY_CANDIDATE_SLOT_REST = 1;
export const AUTONOMY_CANDIDATE_SLOT_MEDICAL = 2;
export const AUTONOMY_CANDIDATE_SLOT_ORDINARY = 3;
export const AUTONOMY_CANDIDATE_SLOT_WAIT = 4;
export const AUTONOMY_CANDIDATE_SLOT_COUNT = 5;

export enum AutonomySnapshotLane {
  residentGeneration = 0,
  state = 1,
  candidateId = 2,
  jobId = 3,
  targetEntityIndex = 4,
  targetEntityGeneration = 5,
  targetCellIndex = 6,
  routeCellCount = 7,
  routeCursor = 8,
  claimCount = 9,
  needLane = 10,
  needValue = 11,
  ability = 12,
  scheduleCode = 13,
  needOwnerVersion = 14,
  scheduleVersion = 15,
  capabilityConditionVersion = 16,
  capabilityBaseVersion = 17,
  candidateOwnerVersion = 18,
  candidateRowVersion = 19,
  candidateIndexVersion = 20,
  pathMapVersion = 21,
  pathNavigationVersion = 22,
  pathRegionVersion = 23,
  pathRoomVersion = 24,
  pathRegionGraphVersion = 25,
  reservationVersion = 26,
  jobVersion = 27,
  rowVersion = 28,
  reasonCode = 29,
  reasonSource = 30,
  reasonSubjectIndex = 31,
  reasonSubjectGeneration = 32,
  reasonTargetIndex = 33,
  reasonTargetGeneration = 34,
  reasonParameterCount = 35,
  reasonOwnerBasis = 36,
  reasonSuggestion = 37,
  terminalPresent = 38,
  terminalState = 39,
  terminalCandidateId = 40,
  terminalJobId = 41,
  terminalTargetEntityIndex = 42,
  terminalTargetEntityGeneration = 43,
  terminalTargetCellIndex = 44,
  terminalReasonCode = 45,
  terminalReasonSource = 46,
  terminalReasonSubjectIndex = 47,
  terminalReasonSubjectGeneration = 48,
  terminalReasonTargetIndex = 49,
  terminalReasonTargetGeneration = 50,
  terminalReasonParameterCount = 51,
  terminalReasonOwnerBasis = 52,
  terminalReasonSuggestion = 53,
  interruptionPolicyCode = 54,
  terminalInterruptionPolicyCode = 55,
  terminalJobVersion = 56,
  pendingJobId = 57,
  candidateSourceCode = 58,
  terminalCandidateSourceCode = 59,
  candidateBacklog = 60,
  foodAvailabilityVersion = 61,
  foodItemVersion = 62,
  foodMealWindowId = 63,
  foodMealWindowVersion = 64,
  foodDirtyBacklog = 65,
  restStoreVersion = 66,
  restCachedRowVersion = 67,
  restCurrentRowVersion = 68,
  restSourceVersion = 69,
  restIndexVersion = 70,
  restDirtyBacklog = 71,
  restScheduleWindowCode = 72,
  restScheduleWindowVersion = 73,
  restWeatherExposureCode = 74,
  restWeatherVersion = 75,
  restWeatherSourceVersion = 76,
  restOutdoorWorkAllowed = 77,
  medicalStoreVersion = 78,
  medicalHealthStoreVersion = 79,
  medicalConditionVersion = 80,
  medicalActorVersion = 81,
  medicalCaregiverId = 82,
  medicalCaregiverRegionId = 83,
  medicalCaregiverPermissionId = 84,
  medicalCaregiverAbility = 85,
  medicalCaregiverMinimumAbility = 86,
  medicalCaregiverAbilityValue = 87,
  medicalCaregiverActorConditionVersion = 88,
  medicalCaregiverBaseAbilityVersion = 89,
  medicalCaregiverValid = 90,
  medicalCaregiverAllowed = 91,
  count = 92,
}

export enum AutonomySnapshotReasonParameterLane {
  current0 = 0,
  current1 = 1,
  current2 = 2,
  current3 = 3,
  current4 = 4,
  current5 = 5,
  terminal0 = 6,
  terminal1 = 7,
  terminal2 = 8,
  terminal3 = 9,
  terminal4 = 10,
  terminal5 = 11,
  count = 12,
}

export enum AutonomySnapshotTickLane {
  stateEntered = 0,
  retry = 1,
  terminal = 2,
  count = 3,
}

export const AUTONOMY_STATE_IDLE = 0;
export const AUTONOMY_STATE_CLAIMING = 1;
export const AUTONOMY_STATE_MOVING = 2;
export const AUTONOMY_STATE_WORKING = 3;
export const AUTONOMY_STATE_BLOCKED = 4;
export const AUTONOMY_STATE_COMPLETED = 5;
export const AUTONOMY_STATE_FAILED = 6;
export const AUTONOMY_STATE_INTERRUPTED = 7;
export type AutonomyState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const AUTONOMY_INTERRUPTION_POLICY_NONE = 0;
export const AUTONOMY_INTERRUPTION_POLICY_NEVER = 1;
export const AUTONOMY_INTERRUPTION_POLICY_AT_SAFE_POINT = 2;
export const AUTONOMY_INTERRUPTION_POLICY_IMMEDIATE = 3;
export const AUTONOMY_INTERRUPTION_POLICY_EMERGENCY_ONLY = 4;
export type AutonomyInterruptionPolicyCode = 0 | 1 | 2 | 3 | 4;

export const AUTONOMY_STORE_OK = 0;
export const AUTONOMY_STORE_RESIDENT_OUT_OF_RANGE = 1;
export const AUTONOMY_STORE_ALREADY_REGISTERED = 2;
export const AUTONOMY_STORE_NOT_REGISTERED = 3;
export const AUTONOMY_STORE_GENERATION_MISMATCH = 4;
export const AUTONOMY_STORE_STATE_MISMATCH = 5;
export const AUTONOMY_STORE_ILLEGAL_TRANSITION = 6;
export const AUTONOMY_STORE_TICK_INVALID = 7;
export const AUTONOMY_STORE_RETRY_TICK_INVALID = 8;
export const AUTONOMY_STORE_REFERENCE_INVALID = 9;
export const AUTONOMY_STORE_BASIS_INVALID = 10;
export const AUTONOMY_STORE_REASON_INVALID = 11;
export const AUTONOMY_STORE_ROUTE_CAPACITY = 12;
export const AUTONOMY_STORE_CLAIM_CAPACITY = 13;
export const AUTONOMY_STORE_SNAPSHOT_VERSION = 14;
export const AUTONOMY_STORE_SNAPSHOT_SHAPE = 15;
export const AUTONOMY_STORE_SNAPSHOT_STATE = 16;
export const AUTONOMY_STORE_ROW_VERSION_MISMATCH = 17;
export const AUTONOMY_STORE_VERSION_EXHAUSTED = 18;
export type AutonomyStoreCode =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18;

export const AUTONOMY_DECISION_NONE = 0;
export const AUTONOMY_DECISION_CLAIMED = 1;
export const AUTONOMY_DECISION_WAIT = 2;
export const AUTONOMY_DECISION_KEEP_WORKING = 3;
export const AUTONOMY_DECISION_INTERRUPTION_REQUESTED = 4;
export const AUTONOMY_DECISION_DEFERRED = 5;
export const AUTONOMY_DECISION_FAILED = 6;
export type AutonomyDecisionKind = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AutonomyVersionBasis {
  candidateId: number;
  candidateOwnerVersion: number;
  candidateRowVersion: number;
  candidateIndexVersion: number;
  candidateBacklog: number;
  needOwnerVersion: number;
  scheduleVersion: number;
  capabilityConditionVersion: number;
  capabilityBaseVersion: number;
  foodAvailabilityVersion: number;
  foodItemVersion: number;
  foodMealWindowId: number;
  foodMealWindowVersion: number;
  foodDirtyBacklog: number;
  restStoreVersion: number;
  restCachedRowVersion: number;
  restCurrentRowVersion: number;
  restSourceVersion: number;
  restIndexVersion: number;
  restDirtyBacklog: number;
  restScheduleWindowCode: number;
  restScheduleWindowVersion: number;
  restWeatherExposureCode: number;
  restWeatherVersion: number;
  restWeatherSourceVersion: number;
  restOutdoorWorkAllowed: number;
  medicalStoreVersion: number;
  medicalHealthStoreVersion: number;
  medicalConditionVersion: number;
  medicalActorVersion: number;
  medicalCaregiverId: number;
  medicalCaregiverRegionId: number;
  medicalCaregiverPermissionId: number;
  medicalCaregiverAbility: number;
  medicalCaregiverMinimumAbility: number;
  medicalCaregiverAbilityValue: number;
  medicalCaregiverActorConditionVersion: number;
  medicalCaregiverBaseAbilityVersion: number;
  medicalCaregiverValid: number;
  medicalCaregiverAllowed: number;
  pathMapVersion: number;
  pathNavigationVersion: number;
  pathRegionVersion: number;
  pathRoomVersion: number;
  pathRegionGraphVersion: number;
  reservationVersion: number;
  jobVersion: number;
}

export interface AutonomyTransitionInput {
  residentIndex: number;
  residentGeneration: number;
  expectedState: AutonomyState;
  expectedRowVersion: number;
  nextState: AutonomyState;
  stateEnteredTick: Tick;
  retryTick: Tick;
  candidateSourceCode: AutonomyCandidateSourceCode;
  candidateId: number;
  jobId: number;
  pendingJobId: number;
  interruptionPolicyCode: AutonomyInterruptionPolicyCode;
  targetEntityIndex: number;
  targetEntityGeneration: number;
  targetCellIndex: number;
  routeCellCount: number;
  routeCursor: number;
  routeCells: Uint32Array;
  claimCount: number;
  claimIds: Uint32Array;
  needLane: number;
  needValue: number;
  ability: number;
  scheduleCode: number;
  basis: AutonomyVersionBasis;
  reason: AutonomyReasonOutput;
}

export interface AutonomyStoreOutput {
  ok: boolean;
  code: AutonomyStoreCode;
  residentIndex: number;
  residentGeneration: number;
  previousState: AutonomyState;
  nextState: AutonomyState;
  rowVersion: number;
  storeVersion: number;
}

export interface AutonomyTerminalOutput {
  present: boolean;
  state: AutonomyState;
  tick: Tick;
  candidateSourceCode: AutonomyCandidateSourceCode;
  candidateId: number;
  jobId: number;
  interruptionPolicyCode: AutonomyInterruptionPolicyCode;
  jobVersion: number;
  targetEntityIndex: number;
  targetEntityGeneration: number;
  targetCellIndex: number;
  reason: AutonomyReasonOutput;
}

export interface ResidentAutonomyReadOutput {
  ok: boolean;
  code: AutonomyStoreCode;
  residentIndex: number;
  residentGeneration: number;
  state: AutonomyState;
  stateEnteredTick: Tick;
  retryTick: Tick;
  candidateSourceCode: AutonomyCandidateSourceCode;
  candidateId: number;
  jobId: number;
  pendingJobId: number;
  interruptionPolicyCode: AutonomyInterruptionPolicyCode;
  targetEntityIndex: number;
  targetEntityGeneration: number;
  targetCellIndex: number;
  routeCellCount: number;
  routeCursor: number;
  routeCells: Uint32Array;
  claimCount: number;
  claimIds: Uint32Array;
  needLane: number;
  needValue: number;
  ability: number;
  scheduleCode: number;
  rowVersion: number;
  storeVersion: number;
  basis: AutonomyVersionBasis;
  reason: AutonomyReasonOutput;
  terminal: AutonomyTerminalOutput;
}

export interface ResidentAutonomySnapshot {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly active: Uint8Array;
  readonly lanes: Uint32Array;
  readonly reasonParameters: Int32Array;
  readonly ticks: Float64Array;
  readonly routeCells: Uint32Array;
  readonly claimIds: Uint32Array;
}
