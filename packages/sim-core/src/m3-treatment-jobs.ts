import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import {
  isExactAdoptionClaimPrefix,
  type DriverAdoptionOutput,
  type ExistingClaimsAdoptionControl,
  type NewlyAdoptedRollbackControl,
} from "./autonomy-claim-facts";
import {
  commitPreparedItemStackQuantityRemoval,
  type ItemStackIntoOutput,
  type ItemStackQuantityRemovalPrepareInput,
  type ItemStackReadScratch,
  type ItemStackReason,
  type ItemStackStore,
  type PreparedItemStackQuantityRemoval,
} from "./item-stack-store";
import {
  commitPreparedAutonomyProgress,
  commitPreparedAutonomyTerminal,
  matchesAutonomyOriginTerminalScalars,
  type AutonomyCommittedJobIntoOutput,
  type AutonomyJobMutationIntoOutput,
  type JobCoreStore,
  type JobCoreReason,
  type JobFailureReason,
  type JobInterruptionKind,
  type JobTokenIntoOutput,
  type PreparedAutonomyProgress,
  type PreparedAutonomyTerminal,
} from "./job-core";
import {
  commitPreparedM3HealthTreatment,
  M3_HEALTH_CONDITION_RECOVERING,
  M3_HEALTH_CONDITION_RESOLVED,
  type M3AbilityCacheStore,
  type M3HealthConditionIntoOutput,
  type M3HealthConditionStore,
  type M3HealthTreatmentConditionDeltaPrepareInput,
  type M3HealthTreatmentPrepareReason,
  type PreparedM3HealthTreatmentConditionDelta,
} from "./m3-health";
import type {
  M3MedicalCareStore,
  M3MedicalPatientRequestView,
  M3MedicalReason,
} from "./m3-medical-care";
import {
  type PathReason,
  type PathSearchResult,
  type PathVersionBasis,
  samePathBasis,
} from "./pathing";
import {
  RESERVATION_CELL,
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  type ReservationClaimsIntoOutput,
  type ReservationLedger,
  type ReservationReason,
  type ReservationReleaseIntoOutput,
} from "./reservation-ledger";
import {
  commitPreparedStorageDirtyAppend,
  commitPreparedStorageDirtyCoalesce,
  type PreparedStorageSlotDirty,
  type StorageLogisticsIndex,
  type StorageLogisticsReason,
  type StorageSlotDirtyPrepareInput,
  type StorageSlotIntoOutput,
} from "./storage-logistics-index";
import type { CanonicalWorldField } from "./world-hash";

export const M3_TREATMENT_JOB_KIND = 53;
export const M3_TREATMENT_SNAPSHOT_VERSION = 4;

const UINT32_MAX = 0xffff_ffff;
const CLAIM_COUNT = 3;
const CLAIM_NONE = UINT32_MAX;

const TREATMENT_STEP_CREATED = 1;
const TREATMENT_STEP_RESERVED = 2;
const TREATMENT_STEP_PATHING = 3;
const TREATMENT_STEP_TREATING = 4;
const TREATMENT_STEP_COMPLETED = 5;
const TREATMENT_STEP_CANCELED = 6;
const TREATMENT_STEP_FAILED = 7;

const TREATMENT_EFFECT_NONE = 0;
const TREATMENT_EFFECT_HEALTH_APPLIED = 1;
const TREATMENT_EFFECT_STOCK_CONSUMED = 2;
const TREATMENT_EFFECT_TERMINAL_CLEANUP_PENDING = 3;
const TREATMENT_EFFECT_TERMINAL = 4;

const TREATMENT_OUTCOME_NONE = 0;
const TREATMENT_OUTCOME_COMPLETED = 1;
const TREATMENT_OUTCOME_CANCELED = 2;
const TREATMENT_OUTCOME_FAILED = 3;
const TREATMENT_OUTCOME_INTERRUPTED = 4;

const ORIGIN_U32_STRIDE = 36;
const ORIGIN_TICK_STRIDE = 4;
const ORIGIN_CODE_STRIDE = 9;

const ORIGIN_OWNER_INDEX = 0;
const ORIGIN_OWNER_GENERATION = 1;
const ORIGIN_CAREGIVER_ACTOR_ID = 2;
const ORIGIN_REQUEST_ID = 3;
const ORIGIN_STORAGE_SLOT_ID = 4;
const ORIGIN_STOCK_STACK_ID = 5;
const ORIGIN_STOCK_ITEM_INDEX = 6;
const ORIGIN_STOCK_ITEM_GENERATION = 7;
const ORIGIN_PATIENT_TARGET_INDEX = 8;
const ORIGIN_PATIENT_TARGET_GENERATION = 9;
const ORIGIN_PATIENT_INTERACTION_SPOT_ID = 10;
const ORIGIN_TREATMENT_CELL_INDEX = 11;
const ORIGIN_ABILITY = 12;
const ORIGIN_MINIMUM_ABILITY_VALUE = 13;
const ORIGIN_TREATMENT_TICKS = 14;
const ORIGIN_WORK_PER_TICK_Q16 = 15;
const ORIGIN_SEVERITY_DELTA = 16;
const ORIGIN_PATIENT_ID = 17;
const ORIGIN_CONDITION_ID = 18;
const ORIGIN_TREATMENT_DEF_ID = 19;
const ORIGIN_STOCK_DEF_ID = 20;
const ORIGIN_STOCK_AMOUNT = 21;
const ORIGIN_CONDITION_VERSION = 22;
const ORIGIN_ACTOR_CONDITION_VERSION = 23;
const ORIGIN_HEALTH_STORE_VERSION = 24;
const ORIGIN_ABILITY_VALUE = 25;
const ORIGIN_CAREGIVER_CONDITION_VERSION = 26;
const ORIGIN_CAREGIVER_BASE_ABILITY_VERSION = 27;
const ORIGIN_STOCK_STORE_VERSION = 28;
const ORIGIN_STOCK_ROW_VERSION = 29;
const ORIGIN_RESERVATION_VERSION = 30;
const ORIGIN_PROGRESS_Q16 = 31;
const ORIGIN_JOB_GENERATION = 32;
const ORIGIN_ADOPTION_RESERVATION_VERSION = 33;
const ORIGIN_ADOPTION_DRIVER_VERSION = 34;
const ORIGIN_ADOPTION_SLOT_VERSION = 35;
const ORIGIN_CREATED_TICK = 0;
const ORIGIN_STEP_ENTERED_TICK = 1;
const ORIGIN_LAST_EFFECT_TICK = 2;
const ORIGIN_JOB_CORE_LAST_MUTATION_TICK = 3;
const ORIGIN_DELTA_APPLIED = 0;
const ORIGIN_STOCK_CONSUMED_ONCE = 1;
const ORIGIN_CLEANUP_PENDING = 2;
const ORIGIN_EFFECT_PHASE = 3;
const ORIGIN_TERMINAL_OUTCOME = 4;
const ORIGIN_TERMINAL_FAILURE = 5;
const ORIGIN_TERMINAL_INTERRUPTION = 6;
const ORIGIN_STEP_CODE = 7;
const ORIGIN_TERMINAL_REASON = 8;

export type M3TreatmentStep =
  | "unassigned"
  | "created"
  | "reserved"
  | "pathing_to_patient"
  | "treating"
  | "completed"
  | "canceled"
  | "failed";

export type M3TreatmentReason =
  | "medical.treatment_created"
  | "medical.treatment_reserved"
  | "medical.treatment_pathing"
  | "medical.treatment_started"
  | "medical.treatment_completed"
  | "medical.condition_delta_applied"
  | "medical.interrupted_safe_point"
  | "job.interruption_denied"
  | "medical.job_id_out_of_range"
  | "medical.job_already_active"
  | "medical.job_not_active"
  | "medical.step_invalid"
  | "medical.job_core_failed"
  | "medical.driver_version_mismatch"
  | "medical.driver_version_exhausted"
  | "medical.adopted_state_mismatch"
  | "medical.tick_invalid"
  | "medical.rejected_no_stock"
  | "medical.rejected_stale_owner_state"
  | "medical.rejected_invalid_condition"
  | "medical.rejected_caregiver_ability"
  | "path.no_route_to_patient"
  | "path.stale_basis"
  | ReservationReason
  | M3MedicalReason;

export type M3TreatmentAdoptedTerminalOutcome = "completed" | "canceled" | "failed" | "interrupted";

export type M3TreatmentAdoptedOperationReason =
  | M3TreatmentReason
  | JobCoreReason
  | ReservationReason
  | M3HealthTreatmentPrepareReason
  | ItemStackReason
  | StorageLogisticsReason;

export type M3TreatmentMutationResult =
  | {
      readonly ok: true;
      readonly reason: M3TreatmentReason;
      readonly jobId: number;
      readonly version: number;
    }
  | { readonly ok: false; readonly reason: M3TreatmentReason };

export interface M3TreatmentCreateInput {
  readonly jobId: number;
  readonly caregiver: EntityId;
  readonly caregiverActorId: number;
  readonly requestId: number;
  readonly stockStackId: number;
  readonly patientInteractionTarget: EntityId;
  readonly patientInteractionSpotId: number;
  readonly treatmentCellIndex: number;
  readonly ability: number;
  readonly minimumAbilityValue: number;
  readonly treatmentTicks: number;
  readonly workPerTickQ16: number;
  readonly severityDelta: number;
  readonly createdTick: number;
}

export interface M3TreatmentJobView extends M3TreatmentCreateInput {
  readonly patientId: number;
  readonly conditionId: number;
  readonly treatmentDefId: number;
  readonly stockDefId: number;
  readonly stockAmount: number;
  readonly conditionVersion: number;
  readonly actorConditionVersion: number;
  readonly healthStoreVersion: number;
  readonly abilityValue: number;
  readonly caregiverConditionVersion: number;
  readonly caregiverBaseAbilityVersion: number;
  readonly stockStoreVersion: number;
  readonly reservationVersion: number;
  readonly progressQ16: number;
  readonly deltaApplied: boolean;
  readonly step: M3TreatmentStep;
  readonly terminalReason: M3TreatmentReason;
}

export interface M3TreatmentClaimAdoptionInput extends M3TreatmentCreateInput {
  readonly storageSlotId: number;
  readonly stockItem: EntityId;
  readonly patientId: number;
  readonly conditionId: number;
  readonly treatmentDefId: number;
  readonly stockDefId: number;
  readonly stockAmount: number;
  readonly conditionVersion: number;
  readonly actorConditionVersion: number;
  readonly healthStoreVersion: number;
  readonly abilityValue: number;
  readonly caregiverConditionVersion: number;
  readonly caregiverBaseAbilityVersion: number;
  readonly stockStoreVersion: number;
  readonly readClaimIds: Uint32Array;
  readonly readClaimEpochs: Uint32Array;
  readonly claims: ReservationClaimsIntoOutput;
}

export interface M3TreatmentClaimAdoptionOutput extends DriverAdoptionOutput {
  ownerIndex: number;
  ownerGeneration: number;
  jobActiveCount: number;
  jobReservedCount: number;
  jobRunningCount: number;
  jobCurrentTombstoneCount: number;
  jobCumulativeTerminalCount: number;
  reservedCount: number;
  pathingCount: number;
  treatingCount: number;
  completedCount: number;
  canceledCount: number;
  failedCount: number;
  conditionDeltaCount: number;
  stockConsumedCount: number;
  reservationCleanupCount: number;
  pathFailureCount: number;
  staleBasisRejectCount: number;
}

export interface M3TreatmentAdoptedJobIntoOutput {
  ok: boolean;
  reason: M3TreatmentReason | undefined;
  active: boolean;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  jobSlotVersion: number;
  driverVersion: number;
  caregiverActorId: number;
  requestId: number;
  stockStackId: number;
  storageSlotId: number;
  stockItemIndex: number;
  stockItemGeneration: number;
  patientTargetIndex: number;
  patientTargetGeneration: number;
  patientInteractionSpotId: number;
  treatmentCellIndex: number;
  ability: number;
  minimumAbilityValue: number;
  treatmentTicks: number;
  workPerTickQ16: number;
  severityDelta: number;
  createdTick: number;
  stepEnteredTick: number;
  lastEffectTick: number;
  jobCoreLastMutationTick: number;
  patientId: number;
  conditionId: number;
  treatmentDefId: number;
  stockDefId: number;
  stockAmount: number;
  conditionVersion: number;
  actorConditionVersion: number;
  healthStoreVersion: number;
  abilityValue: number;
  caregiverConditionVersion: number;
  caregiverBaseAbilityVersion: number;
  stockStoreVersion: number;
  reservationVersion: number;
  jobCoreAdoptionReservationVersion: number;
  jobCoreAdoptionDriverVersion: number;
  jobCoreAdoptionSlotVersion: number;
  progressQ16: number;
  deltaApplied: boolean;
  stockConsumedOnce: boolean;
  cleanupPending: boolean;
  effectPhase: number;
  terminalOutcome: M3TreatmentAdoptedTerminalOutcome | undefined;
  terminalFailureReason: JobFailureReason;
  terminalInterruptionKind: JobInterruptionKind | undefined;
  step: M3TreatmentStep;
  terminalReason: M3TreatmentReason;
  activeCount: number;
  reservedCount: number;
  pathingCount: number;
  treatingCount: number;
  completedCount: number;
  canceledCount: number;
  failedCount: number;
  interruptedCount: number;
  cumulativeCompletedCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  cumulativeInterruptedCount: number;
  conditionDeltaCount: number;
  stockConsumedCount: number;
  reservationCleanupCount: number;
  pathFailureCount: number;
  staleBasisRejectCount: number;
  readonly claimIds: Uint32Array;
  readonly claimEpochs: Uint32Array;
  readonly claimCreatedTicks: Float64Array;
  readonly claimLeaseExpiryTicks: Float64Array;
}

export interface M3TreatmentAdoptedMutationInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly tick: number;
}

export interface M3TreatmentAdoptedMutationOutput {
  ok: boolean;
  reason: M3TreatmentAdoptedOperationReason | undefined;
  alreadyCommitted: boolean;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  jobSlotVersion: number;
  jobCoreVersion: number;
  driverVersion: number;
  step: M3TreatmentStep;
  progressQ16: number;
  readyToComplete: boolean;
  effectPhase: number;
  stockConsumedOnce: boolean;
  cleanupPending: boolean;
  terminalOutcome: M3TreatmentAdoptedTerminalOutcome | undefined;
  terminalFailureReason: JobFailureReason;
  terminalInterruptionKind: JobInterruptionKind | undefined;
  releasedClaimCount: number;
  healthStoreVersion: number;
  conditionVersion: number;
  actorConditionVersion: number;
  itemStoreVersion: number;
  itemRowVersion: number;
  reservationVersion: number;
  jobReservedCount: number;
  jobActiveCount: number;
  jobRunningCount: number;
  jobCurrentTombstoneCount: number;
  jobCumulativeTerminalCount: number;
  activeCount: number;
  reservedCount: number;
  pathingCount: number;
  treatingCount: number;
  completedCount: number;
  canceledCount: number;
  failedCount: number;
  interruptedCount: number;
  cumulativeCompletedCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  cumulativeInterruptedCount: number;
  conditionDeltaCount: number;
  stockConsumedCount: number;
  reservationCleanupCount: number;
  pathFailureCount: number;
  staleBasisRejectCount: number;
}

export interface M3TreatmentAdoptedCompleteInput extends M3TreatmentAdoptedMutationInput {
  readonly expectedCurrentLedgerVersion: number;
  readonly healthMutation: M3HealthTreatmentConditionDeltaPrepareInput;
  readonly stockRemoval: ItemStackQuantityRemovalPrepareInput;
  readonly stockSlot: StorageSlotIntoOutput;
  readonly stockDirty: StorageSlotDirtyPrepareInput;
}

export interface M3TreatmentAdoptedTerminalInput extends M3TreatmentAdoptedMutationInput {
  readonly expectedCurrentLedgerVersion: number;
  readonly outcome: "canceled" | "failed" | "interrupted";
  readonly failureReason: JobFailureReason;
  readonly interruptionKind: JobInterruptionKind | undefined;
}

export interface M3TreatmentResumeCleanupInput extends M3TreatmentAdoptedMutationInput {
  readonly expectedCurrentLedgerVersion: number;
  readonly outcome: M3TreatmentAdoptedTerminalOutcome;
  readonly failureReason: JobFailureReason;
  readonly interruptionKind: JobInterruptionKind | undefined;
}

export interface M3TreatmentMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly pathingCount: number;
  readonly treatingCount: number;
  readonly completedCount: number;
  readonly canceledCount: number;
  readonly failedCount: number;
  readonly interruptedCount: number;
  readonly cumulativeCompletedCount: number;
  readonly cumulativeCanceledCount: number;
  readonly cumulativeFailedCount: number;
  readonly cumulativeInterruptedCount: number;
  readonly conditionDeltaCount: number;
  readonly stockConsumedCount: number;
  readonly reservationCleanupCount: number;
  readonly pathFailureCount: number;
  readonly staleBasisRejectCount: number;
}

export interface M3TreatmentJobSnapshotRow {
  readonly jobId: number;
  readonly active: 0 | 1;
  readonly jobGeneration: number;
  readonly jobSlotVersion: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly caregiverActorId: number;
  readonly requestId: number;
  readonly storageSlotId: number;
  readonly stockStackId: number;
  readonly stockItemIndex: number;
  readonly stockItemGeneration: number;
  readonly patientTargetIndex: number;
  readonly patientTargetGeneration: number;
  readonly patientInteractionSpotId: number;
  readonly treatmentCellIndex: number;
  readonly ability: number;
  readonly minimumAbilityValue: number;
  readonly treatmentTicks: number;
  readonly workPerTickQ16: number;
  readonly severityDelta: number;
  readonly createdTick: number;
  readonly stepEnteredTick: number;
  readonly lastEffectTick: number;
  readonly jobCoreLastMutationTick: number;
  readonly patientId: number;
  readonly conditionId: number;
  readonly treatmentDefId: number;
  readonly stockDefId: number;
  readonly stockAmount: number;
  readonly conditionVersion: number;
  readonly actorConditionVersion: number;
  readonly healthStoreVersion: number;
  readonly abilityValue: number;
  readonly caregiverConditionVersion: number;
  readonly caregiverBaseAbilityVersion: number;
  readonly stockStoreVersion: number;
  readonly stockRowVersion: number;
  readonly reservationVersion: number;
  readonly jobCoreAdoptionReservationVersion: number;
  readonly jobCoreAdoptionDriverVersion: number;
  readonly jobCoreAdoptionSlotVersion: number;
  readonly progressQ16: number;
  readonly deltaApplied: 0 | 1;
  readonly stockConsumedOnce: 0 | 1;
  readonly cleanupPending: 0 | 1;
  readonly effectPhase: number;
  readonly terminalOutcomeCode: number;
  readonly terminalFailureCode: number;
  readonly terminalInterruptionCode: number;
  readonly stepCode: number;
  readonly terminalReasonCode: number;
  readonly originPresent: 0 | 1;
  readonly originU32: readonly number[];
  readonly originTicks: readonly number[];
  readonly originCodes: readonly number[];
  readonly claimIds: readonly number[];
  readonly claimEpochs: readonly number[];
  readonly claimCreatedTicks: readonly number[];
  readonly claimLeaseExpiryTicks: readonly number[];
}

export type M3TreatmentJobSnapshot = M3TreatmentJobSnapshotRow;

export interface M3TreatmentStoreSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly pathingCount: number;
  readonly treatingCount: number;
  readonly completedCount: number;
  readonly canceledCount: number;
  readonly failedCount: number;
  readonly interruptedCount: number;
  readonly cumulativeCompletedCount: number;
  readonly cumulativeCanceledCount: number;
  readonly cumulativeFailedCount: number;
  readonly cumulativeInterruptedCount: number;
  readonly conditionDeltaCount: number;
  readonly stockConsumedCount: number;
  readonly reservationCleanupCount: number;
  readonly pathFailureCount: number;
  readonly staleBasisRejectCount: number;
  readonly rows: readonly M3TreatmentJobSnapshotRow[];
}

export interface M3TreatmentStoreSnapshot extends M3TreatmentStoreSnapshotInput {
  readonly snapshotVersion: typeof M3_TREATMENT_SNAPSHOT_VERSION;
}

export type M3TreatmentSnapshotReason =
  | "medical.snapshot_version_unsupported"
  | "medical.snapshot_shape_invalid"
  | "medical.snapshot_record_invalid";

export type M3TreatmentRestoreResult =
  | { readonly ok: true; readonly version: number; readonly activeCount: number }
  | { readonly ok: false; readonly reason: M3TreatmentSnapshotReason };

export class M3TreatmentJobStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly caregiverIndexes: Uint32Array;
  private readonly caregiverGenerations: Uint32Array;
  private readonly caregiverActorIds: Uint32Array;
  private readonly requestIds: Uint32Array;
  private readonly storageSlotIds: Uint32Array;
  private readonly stockStackIds: Uint32Array;
  private readonly patientTargetIndexes: Uint32Array;
  private readonly patientTargetGenerations: Uint32Array;
  private readonly patientInteractionSpotIds: Uint32Array;
  private readonly treatmentCellIndexes: Uint32Array;
  private readonly abilities: Uint8Array;
  private readonly minimumAbilityValues: Uint16Array;
  private readonly treatmentTicks: Uint32Array;
  private readonly workPerTickQ16: Uint32Array;
  private readonly severityDeltas: Uint16Array;
  private readonly createdTicks: Float64Array;
  private readonly stepEnteredTicks: Float64Array;
  private readonly lastEffectTicks: Float64Array;
  private readonly jobCoreLastMutationTicks: Float64Array;
  private readonly jobGenerations: Uint32Array;
  private readonly jobSlotVersions: Uint32Array;
  private readonly claimIds: Uint32Array;
  private readonly claimEpochs: Uint32Array;
  private readonly claimCreatedTicks: Float64Array;
  private readonly claimLeaseExpiryTicks: Float64Array;
  private readonly stockItemIndexes: Uint32Array;
  private readonly stockItemGenerations: Uint32Array;
  private readonly patientIds: Uint32Array;
  private readonly conditionIds: Uint32Array;
  private readonly treatmentDefIds: Uint32Array;
  private readonly stockDefIds: Uint32Array;
  private readonly stockAmounts: Uint32Array;
  private readonly conditionVersions: Uint32Array;
  private readonly actorConditionVersions: Uint32Array;
  private readonly healthStoreVersions: Uint32Array;
  private readonly abilityValues: Uint16Array;
  private readonly caregiverConditionVersions: Uint32Array;
  private readonly caregiverBaseAbilityVersions: Uint32Array;
  private readonly stockStoreVersions: Uint32Array;
  private readonly stockRowVersions: Uint32Array;
  private readonly reservationVersions: Uint32Array;
  private readonly jobCoreAdoptionReservationVersions: Uint32Array;
  private readonly jobCoreAdoptionDriverVersions: Uint32Array;
  private readonly jobCoreAdoptionSlotVersions: Uint32Array;
  private readonly progressQ16: Uint32Array;
  private readonly deltaApplied: Uint8Array;
  private readonly stockConsumedOnce: Uint8Array;
  private readonly cleanupPending: Uint8Array;
  private readonly effectPhases: Uint8Array;
  private readonly terminalOutcomeCodes: Uint8Array;
  private readonly terminalFailureCodes: Uint8Array;
  private readonly terminalInterruptionCodes: Uint8Array;
  private readonly stepCodes: Uint8Array;
  private readonly terminalReasons: Uint16Array;
  private readonly originPresent: Uint8Array;
  private readonly originU32: Uint32Array;
  private readonly originTicks: Float64Array;
  private readonly originCodes: Uint16Array;
  private activeCount = 0;
  private reservedCount = 0;
  private pathingCount = 0;
  private treatingCount = 0;
  private completedCount = 0;
  private canceledCount = 0;
  private failedCount = 0;
  private interruptedCount = 0;
  private cumulativeCompletedCount = 0;
  private cumulativeCanceledCount = 0;
  private cumulativeFailedCount = 0;
  private cumulativeInterruptedCount = 0;
  private storeVersion = 0;
  private conditionDeltaCount = 0;
  private stockConsumedCount = 0;
  private cleanupCount = 0;
  private pathFailureCount = 0;
  private staleRejectCount = 0;
  private readonly jobTokenOutput: JobTokenIntoOutput;
  private readonly autonomyMutationOutput: AutonomyJobMutationIntoOutput;
  private readonly committedJobOutput: AutonomyCommittedJobIntoOutput;
  private readonly preparedProgress: PreparedAutonomyProgress;
  private readonly preparedTerminal: PreparedAutonomyTerminal;
  private readonly healthReadOutput: M3HealthConditionIntoOutput;
  private readonly preparedHealth: PreparedM3HealthTreatmentConditionDelta;
  private readonly itemReadScratch: ItemStackReadScratch;
  private readonly itemReadOutput: ItemStackIntoOutput;
  private readonly preparedItemRemoval: PreparedItemStackQuantityRemoval;
  private readonly storageReadOutput: StorageSlotIntoOutput;
  private readonly preparedStorageDirty: PreparedStorageSlotDirty;
  private readonly releaseOutput: ReservationReleaseIntoOutput;
  private readonly releaseClaimIds: Uint32Array;
  private readonly releaseClaimEpochs: Uint32Array;
  private readonly autonomyOwner: { index: number; generation: number };

  constructor(capacity: number) {
    assertValidCapacity(capacity, "M3 treatment job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.caregiverIndexes = new Uint32Array(capacity);
    this.caregiverGenerations = new Uint32Array(capacity);
    this.caregiverActorIds = new Uint32Array(capacity);
    this.requestIds = new Uint32Array(capacity);
    this.storageSlotIds = new Uint32Array(capacity);
    this.stockStackIds = new Uint32Array(capacity);
    this.patientTargetIndexes = new Uint32Array(capacity);
    this.patientTargetGenerations = new Uint32Array(capacity);
    this.patientInteractionSpotIds = new Uint32Array(capacity);
    this.treatmentCellIndexes = new Uint32Array(capacity);
    this.abilities = new Uint8Array(capacity);
    this.minimumAbilityValues = new Uint16Array(capacity);
    this.treatmentTicks = new Uint32Array(capacity);
    this.workPerTickQ16 = new Uint32Array(capacity);
    this.severityDeltas = new Uint16Array(capacity);
    this.createdTicks = new Float64Array(capacity);
    this.stepEnteredTicks = new Float64Array(capacity);
    this.lastEffectTicks = new Float64Array(capacity);
    this.jobCoreLastMutationTicks = new Float64Array(capacity);
    this.jobGenerations = new Uint32Array(capacity);
    this.jobSlotVersions = new Uint32Array(capacity);
    this.claimIds = new Uint32Array(capacity * CLAIM_COUNT);
    this.claimIds.fill(CLAIM_NONE);
    this.claimEpochs = new Uint32Array(capacity * CLAIM_COUNT);
    this.claimCreatedTicks = new Float64Array(capacity * CLAIM_COUNT);
    this.claimLeaseExpiryTicks = new Float64Array(capacity * CLAIM_COUNT);
    this.stockItemIndexes = new Uint32Array(capacity);
    this.stockItemGenerations = new Uint32Array(capacity);
    this.patientIds = new Uint32Array(capacity);
    this.conditionIds = new Uint32Array(capacity);
    this.treatmentDefIds = new Uint32Array(capacity);
    this.stockDefIds = new Uint32Array(capacity);
    this.stockAmounts = new Uint32Array(capacity);
    this.conditionVersions = new Uint32Array(capacity);
    this.actorConditionVersions = new Uint32Array(capacity);
    this.healthStoreVersions = new Uint32Array(capacity);
    this.abilityValues = new Uint16Array(capacity);
    this.caregiverConditionVersions = new Uint32Array(capacity);
    this.caregiverBaseAbilityVersions = new Uint32Array(capacity);
    this.stockStoreVersions = new Uint32Array(capacity);
    this.stockRowVersions = new Uint32Array(capacity);
    this.reservationVersions = new Uint32Array(capacity);
    this.jobCoreAdoptionReservationVersions = new Uint32Array(capacity);
    this.jobCoreAdoptionDriverVersions = new Uint32Array(capacity);
    this.jobCoreAdoptionSlotVersions = new Uint32Array(capacity);
    this.progressQ16 = new Uint32Array(capacity);
    this.deltaApplied = new Uint8Array(capacity);
    this.stockConsumedOnce = new Uint8Array(capacity);
    this.cleanupPending = new Uint8Array(capacity);
    this.effectPhases = new Uint8Array(capacity);
    this.terminalOutcomeCodes = new Uint8Array(capacity);
    this.terminalFailureCodes = new Uint8Array(capacity);
    this.terminalInterruptionCodes = new Uint8Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.terminalReasons = new Uint16Array(capacity);
    this.originPresent = new Uint8Array(capacity);
    this.originU32 = new Uint32Array(capacity * ORIGIN_U32_STRIDE);
    this.originTicks = new Float64Array(capacity * ORIGIN_TICK_STRIDE);
    this.originCodes = new Uint16Array(capacity * ORIGIN_CODE_STRIDE);
    this.jobTokenOutput = createTreatmentTokenOutput();
    this.autonomyMutationOutput = createTreatmentAutonomyMutationOutput();
    this.committedJobOutput = createTreatmentCommittedJobOutput();
    this.preparedProgress = createTreatmentPreparedProgress();
    this.preparedTerminal = createTreatmentPreparedTerminal();
    this.healthReadOutput = createTreatmentHealthReadOutput();
    this.preparedHealth = createTreatmentPreparedHealth();
    this.itemReadScratch = { entity: { index: 0, generation: 0 } };
    this.itemReadOutput = createTreatmentItemReadOutput();
    this.preparedItemRemoval = createTreatmentPreparedItemRemoval();
    this.storageReadOutput = createTreatmentStorageReadOutput();
    this.preparedStorageDirty = createTreatmentPreparedStorageDirty();
    this.releaseOutput = createTreatmentReleaseOutput();
    this.releaseClaimIds = new Uint32Array(8);
    this.releaseClaimIds.fill(CLAIM_NONE);
    this.releaseClaimEpochs = new Uint32Array(8);
    this.autonomyOwner = { index: 0, generation: 0 };
  }

  adoptExistingClaimsInto(
    control: ExistingClaimsAdoptionControl,
    input: M3TreatmentClaimAdoptionInput,
    jobCore: JobCoreStore,
    output: M3TreatmentClaimAdoptionOutput,
  ): void {
    resetTreatmentAdoptionOutput(output);
    const requiredWork = input.treatmentTicks * input.workPerTickQ16;
    const versionReason = treatmentAdoptionVersionReason(
      control,
      this.storeVersion,
      jobCore.version,
    );
    if (versionReason !== undefined) {
      output.reason = versionReason;
      return;
    }
    if (!this.isExactAdoptionPreflight(control, input, requiredWork, jobCore.version)) {
      output.reason = "medical.adoption_preflight_failed";
      return;
    }
    this.autonomyOwner.index = control.ownerIndex;
    this.autonomyOwner.generation = control.ownerGeneration;
    jobCore.readAutonomyJobTokenInto(
      control.jobId,
      control.jobGeneration,
      this.autonomyOwner,
      control.expectedJobSlotVersion,
      this.jobTokenOutput,
    );
    if (this.hasFailedJobCoreAdoption()) {
      output.reason = this.jobTokenOutput.reason;
      return;
    }
    if (!this.matchesReservedDriverOrigin(control, jobCore)) {
      output.reason = "medical.adopted_state_mismatch";
      return;
    }
    jobCore.createRunningJobScalarsInto(
      control.jobId,
      control.jobGeneration,
      control.ownerIndex,
      control.ownerGeneration,
      M3_TREATMENT_JOB_KIND,
      input.conditionId,
      "path_to_source",
      "at_safe_point",
      requiredWork,
      control.claimCreatedTick,
      control.adoptionTick,
      control.reservationReadVersion,
      control.expectedDriverVersion,
      control.expectedJobSlotVersion,
      control.expectedJobCoreVersion,
      this.jobTokenOutput,
    );
    if (this.hasFailedJobCoreAdoption()) {
      output.reason = this.jobTokenOutput.reason;
      return;
    }
    if (this.effectPhases[control.jobId] === TREATMENT_EFFECT_TERMINAL)
      this.captureTerminalOrigin(control.jobId);
    else this.clearOrigin(control.jobId);
    this.writeAdopted(control, input);
    this.activeCount += 1;
    this.reservedCount += 1;
    this.storeVersion += 1;
    writeTreatmentSuccess(this.jobTokenOutput, this.storeVersion, this.activeCount, output);
    this.writeAdoptionMetrics(output);
  }

  private hasFailedJobCoreAdoption(): boolean {
    return !this.jobTokenOutput.ok;
  }

  rollbackNewlyAdoptedInto(
    control: NewlyAdoptedRollbackControl,
    jobCore: JobCoreStore,
    output: M3TreatmentClaimAdoptionOutput,
  ): void {
    resetTreatmentAdoptionOutput(output);
    const jobId = control.jobId;
    const base = jobId * CLAIM_COUNT;
    const versionReason = treatmentRollbackVersionReason(
      control,
      this.storeVersion,
      jobCore.version,
    );
    if (versionReason !== undefined) {
      output.reason = versionReason;
      return;
    }
    if (
      isIndexInRange(jobId, this.capacity) &&
      this.jobSlotVersions[jobId] !== control.expectedAdoptedJobSlotVersion
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (
      !isIndexInRange(jobId, this.capacity) ||
      !isExactTreatmentRollbackControl(control) ||
      control.expectedAdoptedDriverVersion !== control.expectedDriverVersion + 1 ||
      control.expectedAdoptedJobSlotVersion !== control.expectedJobSlotVersion + 1 ||
      control.expectedJobCoreVersion >= UINT32_MAX ||
      control.expectedAdoptedDriverVersion >= UINT32_MAX ||
      this.active[jobId] !== 1 ||
      this.jobGenerations[jobId] !== control.jobGeneration ||
      this.jobSlotVersions[jobId] !== control.expectedAdoptedJobSlotVersion ||
      this.storeVersion !== control.expectedAdoptedDriverVersion ||
      this.caregiverIndexes[jobId] !== control.ownerIndex ||
      this.caregiverGenerations[jobId] !== control.ownerGeneration ||
      this.createdTicks[jobId] !== control.claimCreatedTick ||
      this.stepEnteredTicks[jobId] !== control.adoptionTick ||
      this.lastEffectTicks[jobId] !== control.adoptionTick ||
      this.reservationVersions[jobId] !== control.reservationReadVersion ||
      this.stepCodes[jobId] !== TREATMENT_STEP_RESERVED ||
      this.progressQ16[jobId] !== 0 ||
      this.deltaApplied[jobId] !== 0
    ) {
      output.reason = "medical.rollback_preflight_failed";
      return;
    }
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      if (
        this.claimIds[base + index] !== control.claimIds[index] ||
        this.claimEpochs[base + index] !== control.claimEpochs[index] ||
        this.claimCreatedTicks[base + index] !== control.claimCreatedTick ||
        this.claimLeaseExpiryTicks[base + index] !== control.claimLeaseExpiryTicks[index]
      ) {
        output.reason = "medical.rollback_preflight_failed";
        return;
      }
    }
    jobCore.rollbackRunningAutonomyJobScalarsInto(
      jobId,
      control.jobGeneration,
      control.ownerIndex,
      control.ownerGeneration,
      control.expectedAdoptedJobSlotVersion,
      control.expectedJobCoreVersion + 1,
      control.claimCreatedTick,
      control.adoptionTick,
      control.reservationReadVersion,
      control.expectedAdoptedDriverVersion,
      this.jobTokenOutput,
    );
    if (!this.jobTokenOutput.ok) {
      output.reason = this.jobTokenOutput.reason;
      return;
    }
    if (this.originPresent[jobId] === 1)
      this.restoreTerminalOrigin(jobId, this.jobTokenOutput.slotVersion);
    else this.writeRolledBackShadow(jobId, this.jobTokenOutput.slotVersion);
    this.activeCount -= 1;
    this.reservedCount -= 1;
    this.storeVersion += 1;
    writeTreatmentSuccess(this.jobTokenOutput, this.storeVersion, this.activeCount, output);
    this.writeAdoptionMetrics(output);
  }

  readAdoptedJobInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    expectedDriverVersion: number,
    output: M3TreatmentAdoptedJobIntoOutput,
  ): void {
    resetTreatmentAdoptedJobOutput(output, jobId, this.storeVersion);
    if (
      output.claimIds.length !== CLAIM_COUNT ||
      output.claimEpochs.length !== CLAIM_COUNT ||
      output.claimCreatedTicks.length !== CLAIM_COUNT ||
      output.claimLeaseExpiryTicks.length !== CLAIM_COUNT ||
      !isIndexInRange(jobId, this.capacity) ||
      jobGeneration === 0 ||
      this.active[jobId] !== 1 ||
      this.jobGenerations[jobId] !== jobGeneration ||
      this.caregiverIndexes[jobId] !== ownerIndex ||
      this.caregiverGenerations[jobId] !== ownerGeneration ||
      this.jobSlotVersions[jobId] !== expectedSlotVersion ||
      this.storeVersion !== expectedDriverVersion
    ) {
      output.reason = "medical.rejected_stale_owner_state";
      return;
    }
    this.writeAdoptedJobOutput(jobId, output);
  }

  startPathingAdoptedInto(
    input: M3TreatmentAdoptedMutationInput,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    resetTreatmentMutationOutput(output);
    if (!this.prepareAdoptedMutationRead(input, jobCore, output)) return;
    const jobId = input.jobId;
    if (!this.isOrdinaryAdoptedMutationState(jobId)) {
      output.reason = "medical.step_invalid";
      return;
    }
    const step = this.stepCodes[jobId] ?? 0;
    if (
      step === TREATMENT_STEP_PATHING &&
      this.lastEffectTicks[jobId] === input.tick &&
      this.matchesCommittedTreatmentJob(jobId, TREATMENT_STEP_PATHING)
    ) {
      this.writeMutationSuccess(jobId, input.expectedJobCoreVersion, true, output);
      return;
    }
    if (
      step !== TREATMENT_STEP_RESERVED ||
      !this.matchesCommittedTreatmentJob(jobId, TREATMENT_STEP_RESERVED) ||
      input.tick < (this.lastEffectTicks[jobId] ?? 0)
    ) {
      output.reason =
        input.tick < (this.lastEffectTicks[jobId] ?? 0)
          ? "medical.tick_invalid"
          : "medical.adopted_state_mismatch";
      return;
    }
    const startHeadroomReason = this.mutationHeadroomReason(input, 5, 2);
    if (startHeadroomReason !== undefined) {
      output.reason = startHeadroomReason;
      return;
    }
    if (this.reservedCount === 0 || this.pathingCount === UINT32_MAX) {
      output.reason = "medical.adopted_state_mismatch";
      return;
    }
    this.stepCodes[jobId] = TREATMENT_STEP_PATHING;
    this.terminalReasons[jobId] = encodeReason("medical.treatment_pathing");
    this.lastEffectTicks[jobId] = input.tick;
    this.reservedCount -= 1;
    this.pathingCount += 1;
    this.storeVersion += 1;
    this.writeMutationSuccess(jobId, input.expectedJobCoreVersion, false, output);
  }

  beginAdoptedInto(
    input: M3TreatmentAdoptedMutationInput,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    resetTreatmentMutationOutput(output);
    if (!this.prepareAdoptedMutationRead(input, jobCore, output)) return;
    const jobId = input.jobId;
    if (!this.isOrdinaryAdoptedMutationState(jobId)) {
      output.reason = "medical.step_invalid";
      return;
    }
    const step = this.stepCodes[jobId] ?? 0;
    if (
      step === TREATMENT_STEP_TREATING &&
      this.progressQ16[jobId] === 0 &&
      this.lastEffectTicks[jobId] === input.tick &&
      this.matchesCommittedTreatmentJob(jobId, TREATMENT_STEP_TREATING)
    ) {
      this.writeMutationSuccess(jobId, input.expectedJobCoreVersion, true, output);
      return;
    }
    if (
      step !== TREATMENT_STEP_PATHING ||
      !this.matchesCommittedTreatmentJob(jobId, TREATMENT_STEP_PATHING) ||
      input.tick < (this.lastEffectTicks[jobId] ?? 0)
    ) {
      output.reason =
        input.tick < (this.lastEffectTicks[jobId] ?? 0)
          ? "medical.tick_invalid"
          : "medical.adopted_state_mismatch";
      return;
    }
    const beginHeadroomReason = this.mutationHeadroomReason(input, 4, 2);
    if (beginHeadroomReason !== undefined) {
      output.reason = beginHeadroomReason;
      return;
    }
    if (this.pathingCount === 0 || this.treatingCount === UINT32_MAX) {
      output.reason = "medical.adopted_state_mismatch";
      return;
    }
    this.autonomyOwner.index = input.ownerIndex;
    this.autonomyOwner.generation = input.ownerGeneration;
    jobCore.enterAutonomyStepInto(
      jobId,
      input.jobGeneration,
      this.autonomyOwner,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      "interact",
      input.tick,
      this.autonomyMutationOutput,
    );
    if (!this.autonomyMutationOutput.ok) {
      output.reason = this.autonomyMutationOutput.reason;
      return;
    }
    this.stepCodes[jobId] = TREATMENT_STEP_TREATING;
    this.terminalReasons[jobId] = encodeReason("medical.treatment_started");
    this.stepEnteredTicks[jobId] = input.tick;
    this.lastEffectTicks[jobId] = input.tick;
    this.jobCoreLastMutationTicks[jobId] = input.tick;
    this.jobSlotVersions[jobId] = this.autonomyMutationOutput.slotVersion;
    this.pathingCount -= 1;
    this.treatingCount += 1;
    this.storeVersion += 1;
    this.writeMutationSuccess(jobId, this.autonomyMutationOutput.version, false, output);
  }

  progressAdoptedInto(
    input: M3TreatmentAdoptedMutationInput,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    resetTreatmentMutationOutput(output);
    if (!this.prepareAdoptedMutationRead(input, jobCore, output)) return;
    const jobId = input.jobId;
    if (!this.isOrdinaryAdoptedMutationState(jobId)) {
      output.reason = "medical.step_invalid";
      return;
    }
    if (
      this.stepCodes[jobId] !== TREATMENT_STEP_TREATING ||
      !this.matchesCommittedTreatmentJob(jobId, TREATMENT_STEP_TREATING)
    ) {
      output.reason = "medical.adopted_state_mismatch";
      return;
    }
    const progress = this.progressQ16[jobId] ?? 0;
    if (progress > 0 && this.lastEffectTicks[jobId] === input.tick) {
      this.writeMutationSuccess(jobId, input.expectedJobCoreVersion, true, output);
      return;
    }
    const requiredWork = this.requiredWorkFor(jobId);
    if (progress >= requiredWork) {
      output.reason = "medical.step_invalid";
      return;
    }
    if (input.tick < (this.lastEffectTicks[jobId] ?? 0)) {
      output.reason = "medical.tick_invalid";
      return;
    }
    const progressHeadroomReason = this.mutationHeadroomReason(input, 3, 1);
    if (progressHeadroomReason !== undefined) {
      output.reason = progressHeadroomReason;
      return;
    }
    jobCore.prepareAutonomyProgressScalarsInto(
      jobId,
      input.jobGeneration,
      input.ownerIndex,
      input.ownerGeneration,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      this.workPerTickQ16[jobId] ?? 0,
      this.preparedProgress,
    );
    if (!this.preparedProgress.ok) {
      output.reason = this.preparedProgress.reason;
      return;
    }
    commitPreparedAutonomyProgress(jobCore, this.preparedProgress);
    this.progressQ16[jobId] = this.preparedProgress.nextProgressQ16;
    this.jobSlotVersions[jobId] = this.preparedProgress.nextSlotVersion;
    this.lastEffectTicks[jobId] = input.tick;
    this.jobCoreLastMutationTicks[jobId] = input.tick;
    this.storeVersion += 1;
    this.writeMutationSuccess(jobId, this.preparedProgress.nextJobCoreVersion, false, output);
  }

  completeAdoptedInto(
    input: M3TreatmentAdoptedCompleteInput,
    health: M3HealthConditionStore,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    resetTreatmentMutationOutput(output);
    if (this.writeCompletedDuplicateIfExact(input, ledger, jobCore, output)) return;
    const jobId = input.jobId;
    if (
      !this.prepareCompletedTerminal(input, health, items, storage, ledger, jobCore, claims, output)
    )
      return;
    if ((this.effectPhases[jobId] ?? 0) === TREATMENT_EFFECT_NONE) {
      if (this.preparedStorageDirty.alreadyQueued)
        this.commitFreshCompleteCoalesce(input, health, items, storage, ledger, jobCore, output);
      else this.commitFreshCompleteAppend(input, health, items, storage, ledger, jobCore, output);
      return;
    }
    if (this.preparedStorageDirty.alreadyQueued)
      this.commitHealthAppliedCompleteCoalesce(input, items, storage, ledger, jobCore, output);
    else this.commitHealthAppliedCompleteAppend(input, items, storage, ledger, jobCore, output);
  }

  terminalAdoptedInto(
    input: M3TreatmentAdoptedTerminalInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    resetTreatmentMutationOutput(output);
    if (!isNegativeTreatmentTerminalOutcome(input.outcome)) {
      output.reason = "medical.step_invalid";
      return;
    }
    if (this.writeTerminalDuplicateIfExact(input, ledger, jobCore, output)) return;
    if (!this.prepareNegativeTerminal(input, ledger, jobCore, claims, output)) return;
    this.releaseStoredClaims(input, ledger);
    if (!this.releaseOutput.ok) {
      this.commitNegativeCleanupPending(input);
      output.reason = this.releaseOutput.reason;
      this.writePendingMutationOutput(input.jobId, input.expectedJobCoreVersion, output);
      return;
    }
    this.commitTerminalTail(input, jobCore, this.releaseOutput.version);
    this.writeMutationSuccess(input.jobId, this.preparedTerminal.nextJobCoreVersion, false, output);
    output.releasedClaimCount = this.releaseOutput.releasedCount;
  }

  resumeCleanupInto(
    input: M3TreatmentResumeCleanupInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    resetTreatmentMutationOutput(output);
    if (this.writeTerminalDuplicateIfExact(input, ledger, jobCore, output)) return;
    if (!this.prepareCleanupResume(input, ledger, jobCore, claims, output)) return;
    this.releaseStoredClaims(input, ledger);
    if (!this.releaseOutput.ok) {
      output.reason = this.releaseOutput.reason;
      this.writePendingMutationOutput(input.jobId, input.expectedJobCoreVersion, output);
      return;
    }
    this.commitTerminalTail(input, jobCore, this.releaseOutput.version);
    this.writeMutationSuccess(input.jobId, this.preparedTerminal.nextJobCoreVersion, false, output);
    output.releasedClaimCount = this.releaseOutput.releasedCount;
  }

  createJob(
    input: M3TreatmentCreateInput,
    medical: M3MedicalCareStore,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    items: ItemStackStore,
    jobCore: JobCoreStore,
    registry: EntityRegistry,
  ): M3TreatmentMutationResult {
    const validation = this.validateCreate(input);
    if (!validation.ok) {
      return validation;
    }
    if ((this.active[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "medical.job_already_active" };
    }
    if (!registry.isAlive(input.caregiver) || !registry.isAlive(input.patientInteractionTarget)) {
      return { ok: false, reason: "medical.rejected_invalid_condition" };
    }
    const request = medical.readPatientRequest(input.requestId);
    if (request === undefined) {
      return { ok: false, reason: "medical.no_patient" };
    }
    const basis = this.validateBasis(input, request, health, abilities, items);
    if (!basis.ok) {
      return basis;
    }
    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.caregiver,
        jobKind: M3_TREATMENT_JOB_KIND,
        targetId: request.conditionId,
        initialStep: "reserve",
        interruptionPolicy: "at_safe_point",
        requiredWorkQ16: input.treatmentTicks * input.workPerTickQ16,
        createdTick: input.createdTick,
      },
      registry,
    );
    if (!created.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.writeCreated(input, request, basis);
    this.activeCount += 1;
    return this.finish(input.jobId, "medical.treatment_created");
  }

  reserve(
    jobId: number,
    tick: number,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    items: ItemStackStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    registry: EntityRegistry,
  ): M3TreatmentMutationResult {
    const validation = this.validateStep(jobId, TREATMENT_STEP_CREATED);
    if (!validation.ok) {
      return validation;
    }
    const basis = this.validateCurrentBasis(jobId, health, abilities, items);
    if (!basis.ok) {
      return basis;
    }
    const stack = items.readStack(this.stockStackIds[jobId] ?? 0, ledger);
    if (stack === undefined || stack.availableQuantity < (this.stockAmounts[jobId] ?? 0)) {
      return { ok: false, reason: "medical.rejected_no_stock" };
    }
    const acquired = ledger.acquire(
      {
        owner: this.readCaregiver(jobId),
        jobId,
        createdTick: tick,
        leaseExpiryTick: tick + 300,
        claims: [
          {
            channel: "item_quantity",
            item: stack.entity,
            amount: this.stockAmounts[jobId] ?? 0,
            availableAmount: stack.quantity,
          },
          {
            channel: "interaction_spot",
            target: this.readPatientTarget(jobId),
            spotId: this.patientInteractionSpotIds[jobId] ?? 0,
          },
          {
            channel: "cell",
            cellIndex: this.treatmentCellIndexes[jobId] ?? 0,
          },
        ],
      },
      registry,
    );
    if (!acquired.ok) {
      this.failTerminalJob(jobId, tick, acquired.reason, ledger, jobCore, "reservation");
      return { ok: false, reason: acquired.reason };
    }
    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      const released = ledger.releaseClaims(acquired.claimIds);
      if (released.ok) {
        this.cleanupCount += released.releasedCount;
      }
      this.setTerminalFailure(jobId, tick, "medical.job_core_failed");
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.reservationVersions[jobId] = ledger.version;
    this.stepCodes[jobId] = TREATMENT_STEP_RESERVED;
    this.terminalReasons[jobId] = encodeReason("medical.treatment_reserved");
    this.stepEnteredTicks[jobId] = tick;
    this.lastEffectTicks[jobId] = tick;
    this.reservedCount += 1;
    return this.finish(jobId, "medical.treatment_reserved");
  }

  startPathing(
    jobId: number,
    tick: number,
    path: PathSearchResult,
    currentBasis: PathVersionBasis,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3TreatmentMutationResult {
    const validation = this.validateStep(jobId, TREATMENT_STEP_RESERVED);
    if (!validation.ok) {
      return validation;
    }
    if (!samePathBasis(path.basis, currentBasis)) {
      this.staleRejectCount += 1;
      this.failTerminalJob(jobId, tick, "path.stale_basis", ledger, jobCore, "path");
      return { ok: false, reason: "path.stale_basis" };
    }
    if (!path.ok) {
      this.pathFailureCount += 1;
      const reason = mapPathReason(path.reason);
      this.failTerminalJob(jobId, tick, reason, ledger, jobCore, "path");
      return { ok: false, reason };
    }
    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.stepCodes[jobId] = TREATMENT_STEP_PATHING;
    this.terminalReasons[jobId] = encodeReason("medical.treatment_pathing");
    this.stepEnteredTicks[jobId] = tick;
    this.lastEffectTicks[jobId] = tick;
    this.reservedCount -= 1;
    this.pathingCount += 1;
    return this.finish(jobId, "medical.treatment_pathing");
  }

  beginTreatment(jobId: number, tick: number, jobCore: JobCoreStore): M3TreatmentMutationResult {
    const validation = this.validateStep(jobId, TREATMENT_STEP_PATHING);
    if (!validation.ok) {
      return validation;
    }
    const entered = jobCore.enterStep(jobId, "interact", tick);
    if (!entered.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.stepCodes[jobId] = TREATMENT_STEP_TREATING;
    this.terminalReasons[jobId] = encodeReason("medical.treatment_started");
    this.stepEnteredTicks[jobId] = tick;
    this.lastEffectTicks[jobId] = tick;
    this.pathingCount -= 1;
    this.treatingCount += 1;
    return this.finish(jobId, "medical.treatment_started");
  }

  tickTreatment(
    jobId: number,
    tick: number,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    items: ItemStackStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3TreatmentMutationResult {
    const validation = this.validateStep(jobId, TREATMENT_STEP_TREATING);
    if (!validation.ok) {
      return validation;
    }
    const ticked = jobCore.tickJob(jobId, tick, this.workPerTickQ16[jobId] ?? 0);
    if (!ticked.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.progressQ16[jobId] = ticked.progressQ16;
    this.lastEffectTicks[jobId] = tick;
    if (!ticked.readyToComplete) {
      this.terminalReasons[jobId] = encodeReason("medical.condition_delta_applied");
      return this.finish(jobId, "medical.condition_delta_applied");
    }
    return this.complete(jobId, tick, health, abilities, items, ledger, jobCore);
  }

  cancel(
    jobId: number,
    tick: number,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3TreatmentMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if (this.isTerminal(jobId)) {
      return { ok: false, reason: "medical.step_invalid" };
    }
    const before = ledger.activeCount;
    const canceled = jobCore.cancelJob(jobId, tick, ledger);
    if (!canceled.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.cleanupCount += before - ledger.activeCount;
    this.transitionToTerminal(jobId, TREATMENT_STEP_CANCELED, tick);
    this.terminalReasons[jobId] = encodeReason("medical.interrupted_safe_point");
    return this.finish(jobId, "medical.interrupted_safe_point");
  }

  interrupt(
    jobId: number,
    kind: JobInterruptionKind,
    tick: number,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3TreatmentMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    const before = ledger.activeCount;
    const interrupted = jobCore.requestInterruption(jobId, kind, tick, ledger);
    if (!interrupted.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    if (!interrupted.interrupted) {
      return { ok: false, reason: "job.interruption_denied" };
    }
    this.cleanupCount += before - ledger.activeCount;
    this.transitionToTerminal(jobId, TREATMENT_STEP_CANCELED, tick);
    this.terminalReasons[jobId] = encodeReason("medical.interrupted_safe_point");
    return this.finish(jobId, "medical.interrupted_safe_point");
  }

  fail(
    jobId: number,
    tick: number,
    reason: JobFailureReason,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3TreatmentMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    const before = ledger.activeCount;
    const failed = jobCore.failJob(jobId, tick, reason, ledger);
    if (!failed.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.cleanupCount += before - ledger.activeCount;
    this.transitionToTerminal(jobId, TREATMENT_STEP_FAILED, tick);
    this.terminalReasons[jobId] = encodeReason("medical.rejected_invalid_condition");
    return this.finish(jobId, "medical.rejected_invalid_condition");
  }

  readJob(jobId: number): M3TreatmentJobView | undefined {
    if (!this.isActive(jobId) || this.jobGenerations[jobId] !== 0) {
      return undefined;
    }
    return {
      jobId,
      caregiver: this.readCaregiver(jobId),
      caregiverActorId: this.caregiverActorIds[jobId] ?? 0,
      requestId: this.requestIds[jobId] ?? 0,
      stockStackId: this.stockStackIds[jobId] ?? 0,
      patientInteractionTarget: this.readPatientTarget(jobId),
      patientInteractionSpotId: this.patientInteractionSpotIds[jobId] ?? 0,
      treatmentCellIndex: this.treatmentCellIndexes[jobId] ?? 0,
      ability: this.abilities[jobId] ?? 0,
      minimumAbilityValue: this.minimumAbilityValues[jobId] ?? 0,
      treatmentTicks: this.treatmentTicks[jobId] ?? 0,
      workPerTickQ16: this.workPerTickQ16[jobId] ?? 0,
      severityDelta: this.severityDeltas[jobId] ?? 0,
      createdTick: this.createdTicks[jobId] ?? 0,
      patientId: this.patientIds[jobId] ?? 0,
      conditionId: this.conditionIds[jobId] ?? 0,
      treatmentDefId: this.treatmentDefIds[jobId] ?? 0,
      stockDefId: this.stockDefIds[jobId] ?? 0,
      stockAmount: this.stockAmounts[jobId] ?? 0,
      conditionVersion: this.conditionVersions[jobId] ?? 0,
      actorConditionVersion: this.actorConditionVersions[jobId] ?? 0,
      healthStoreVersion: this.healthStoreVersions[jobId] ?? 0,
      abilityValue: this.abilityValues[jobId] ?? 0,
      caregiverConditionVersion: this.caregiverConditionVersions[jobId] ?? 0,
      caregiverBaseAbilityVersion: this.caregiverBaseAbilityVersions[jobId] ?? 0,
      stockStoreVersion: this.stockStoreVersions[jobId] ?? 0,
      reservationVersion: this.reservationVersions[jobId] ?? 0,
      progressQ16: this.progressQ16[jobId] ?? 0,
      deltaApplied: this.deltaApplied[jobId] === 1,
      step: decodeStep(this.stepCodes[jobId] ?? 0),
      terminalReason: decodeReason(this.terminalReasons[jobId] ?? 0),
    };
  }

  createMetrics(): M3TreatmentMetrics {
    return {
      version: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount: this.reservedCount,
      pathingCount: this.pathingCount,
      treatingCount: this.treatingCount,
      completedCount: this.completedCount,
      canceledCount: this.canceledCount,
      failedCount: this.failedCount,
      interruptedCount: this.interruptedCount,
      cumulativeCompletedCount: this.cumulativeCompletedCount,
      cumulativeCanceledCount: this.cumulativeCanceledCount,
      cumulativeFailedCount: this.cumulativeFailedCount,
      cumulativeInterruptedCount: this.cumulativeInterruptedCount,
      conditionDeltaCount: this.conditionDeltaCount,
      stockConsumedCount: this.stockConsumedCount,
      reservationCleanupCount: this.cleanupCount,
      pathFailureCount: this.pathFailureCount,
      staleBasisRejectCount: this.staleRejectCount,
    };
  }

  private complete(
    jobId: number,
    tick: number,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    items: ItemStackStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3TreatmentMutationResult {
    if (this.deltaApplied[jobId] === 1) {
      return { ok: false, reason: "medical.step_invalid" };
    }
    const basis = this.validateCurrentBasis(jobId, health, abilities, items);
    if (!basis.ok) {
      return this.failReservedTreatment(jobId, tick, basis.reason, ledger, jobCore);
    }
    const condition = health.readCondition(this.conditionIds[jobId] ?? 0);
    if (condition === undefined) {
      return this.failReservedTreatment(
        jobId,
        tick,
        "medical.rejected_invalid_condition",
        ledger,
        jobCore,
      );
    }
    const delta = this.severityDeltas[jobId] ?? 0;
    const nextSeverity = condition.severity > delta ? condition.severity - delta : 0;
    const updated = health.updateCondition({
      conditionId: this.conditionIds[jobId] ?? 0,
      severity: nextSeverity,
      terminalState:
        nextSeverity === 0 ? M3_HEALTH_CONDITION_RESOLVED : M3_HEALTH_CONDITION_RECOVERING,
    });
    if (!updated.ok) {
      return this.failReservedTreatment(
        jobId,
        tick,
        "medical.rejected_invalid_condition",
        ledger,
        jobCore,
      );
    }
    const updatedCondition = health.readCondition(this.conditionIds[jobId] ?? 0);
    if (updatedCondition === undefined) {
      return this.failReservedTreatment(
        jobId,
        tick,
        "medical.rejected_invalid_condition",
        ledger,
        jobCore,
      );
    }
    const removed = items.removeQuantity(
      this.stockStackIds[jobId] ?? 0,
      this.stockAmounts[jobId] ?? 0,
      this.stockDefIds[jobId] ?? 0,
    );
    if (!removed.ok) {
      throw new Error(`validated treatment stock removal failed: ${removed.reason}`);
    }
    const before = ledger.activeCount;
    const completed = jobCore.completeJob(jobId, tick, ledger);
    if (!completed.ok) {
      throw new Error(`validated treatment completion failed: ${completed.reason}`);
    }
    this.cleanupCount += before - ledger.activeCount;
    this.deltaApplied[jobId] = 1;
    this.conditionVersions[jobId] = updatedCondition.conditionVersion;
    this.actorConditionVersions[jobId] = updatedCondition.actorConditionVersion;
    this.healthStoreVersions[jobId] = health.storeVersion;
    this.stockStoreVersions[jobId] = items.version;
    this.transitionToTerminal(jobId, TREATMENT_STEP_COMPLETED, tick);
    this.terminalReasons[jobId] = encodeReason("medical.treatment_completed");
    this.conditionDeltaCount += 1;
    this.stockConsumedCount += this.stockAmounts[jobId] ?? 0;
    return this.finish(jobId, "medical.treatment_completed");
  }

  private validateBasis(
    input: M3TreatmentCreateInput,
    request: M3MedicalPatientRequestView,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    items: ItemStackStore,
  ):
    | {
        readonly ok: true;
        readonly abilityValue: number;
        readonly caregiverConditionVersion: number;
        readonly caregiverBaseAbilityVersion: number;
        readonly stockStoreVersion: number;
      }
    | { readonly ok: false; readonly reason: M3TreatmentReason } {
    const condition = health.readCondition(request.conditionId);
    if (
      condition?.actorId !== request.patientId ||
      condition.conditionVersion !== request.conditionVersion ||
      health.storeVersion !== request.healthStoreVersion
    ) {
      return { ok: false, reason: "medical.rejected_stale_owner_state" };
    }
    const ability = abilities.queryAbility(
      input.caregiverActorId,
      input.ability,
      health,
      input.minimumAbilityValue,
    );
    if (!ability.ok) {
      return { ok: false, reason: "medical.rejected_caregiver_ability" };
    }
    const stack = items.readStack(input.stockStackId);
    if (stack?.defId !== request.stockDefId || stack.quantity < request.stockAmount) {
      return { ok: false, reason: "medical.rejected_no_stock" };
    }
    return {
      ok: true,
      abilityValue: ability.value,
      caregiverConditionVersion: ability.actorConditionVersion,
      caregiverBaseAbilityVersion: ability.baseAbilityVersion,
      stockStoreVersion: items.version,
    };
  }

  createSnapshot(): M3TreatmentStoreSnapshot {
    const rows: M3TreatmentJobSnapshotRow[] = [];
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const base = jobId * CLAIM_COUNT;
      rows.push({
        jobId,
        active: this.active[jobId] === 1 ? 1 : 0,
        jobGeneration: this.jobGenerations[jobId] ?? 0,
        jobSlotVersion: this.jobSlotVersions[jobId] ?? 0,
        ownerIndex: this.caregiverIndexes[jobId] ?? 0,
        ownerGeneration: this.caregiverGenerations[jobId] ?? 0,
        caregiverActorId: this.caregiverActorIds[jobId] ?? 0,
        requestId: this.requestIds[jobId] ?? 0,
        storageSlotId: this.storageSlotIds[jobId] ?? 0,
        stockStackId: this.stockStackIds[jobId] ?? 0,
        stockItemIndex: this.stockItemIndexes[jobId] ?? 0,
        stockItemGeneration: this.stockItemGenerations[jobId] ?? 0,
        patientTargetIndex: this.patientTargetIndexes[jobId] ?? 0,
        patientTargetGeneration: this.patientTargetGenerations[jobId] ?? 0,
        patientInteractionSpotId: this.patientInteractionSpotIds[jobId] ?? 0,
        treatmentCellIndex: this.treatmentCellIndexes[jobId] ?? 0,
        ability: this.abilities[jobId] ?? 0,
        minimumAbilityValue: this.minimumAbilityValues[jobId] ?? 0,
        treatmentTicks: this.treatmentTicks[jobId] ?? 0,
        workPerTickQ16: this.workPerTickQ16[jobId] ?? 0,
        severityDelta: this.severityDeltas[jobId] ?? 0,
        createdTick: this.createdTicks[jobId] ?? 0,
        stepEnteredTick: this.stepEnteredTicks[jobId] ?? 0,
        lastEffectTick: this.lastEffectTicks[jobId] ?? 0,
        jobCoreLastMutationTick: this.jobCoreLastMutationTicks[jobId] ?? 0,
        patientId: this.patientIds[jobId] ?? 0,
        conditionId: this.conditionIds[jobId] ?? 0,
        treatmentDefId: this.treatmentDefIds[jobId] ?? 0,
        stockDefId: this.stockDefIds[jobId] ?? 0,
        stockAmount: this.stockAmounts[jobId] ?? 0,
        conditionVersion: this.conditionVersions[jobId] ?? 0,
        actorConditionVersion: this.actorConditionVersions[jobId] ?? 0,
        healthStoreVersion: this.healthStoreVersions[jobId] ?? 0,
        abilityValue: this.abilityValues[jobId] ?? 0,
        caregiverConditionVersion: this.caregiverConditionVersions[jobId] ?? 0,
        caregiverBaseAbilityVersion: this.caregiverBaseAbilityVersions[jobId] ?? 0,
        stockStoreVersion: this.stockStoreVersions[jobId] ?? 0,
        stockRowVersion: this.stockRowVersions[jobId] ?? 0,
        reservationVersion: this.reservationVersions[jobId] ?? 0,
        jobCoreAdoptionReservationVersion: this.jobCoreAdoptionReservationVersions[jobId] ?? 0,
        jobCoreAdoptionDriverVersion: this.jobCoreAdoptionDriverVersions[jobId] ?? 0,
        jobCoreAdoptionSlotVersion: this.jobCoreAdoptionSlotVersions[jobId] ?? 0,
        progressQ16: this.progressQ16[jobId] ?? 0,
        deltaApplied: this.deltaApplied[jobId] === 1 ? 1 : 0,
        stockConsumedOnce: this.stockConsumedOnce[jobId] === 1 ? 1 : 0,
        cleanupPending: this.cleanupPending[jobId] === 1 ? 1 : 0,
        effectPhase: this.effectPhases[jobId] ?? 0,
        terminalOutcomeCode: this.terminalOutcomeCodes[jobId] ?? 0,
        terminalFailureCode: this.terminalFailureCodes[jobId] ?? 0,
        terminalInterruptionCode: this.terminalInterruptionCodes[jobId] ?? 0,
        stepCode: this.stepCodes[jobId] ?? 0,
        terminalReasonCode: this.terminalReasons[jobId] ?? 0,
        originPresent: this.originPresent[jobId] === 1 ? 1 : 0,
        originU32: Array.from(
          this.originU32.subarray(jobId * ORIGIN_U32_STRIDE, (jobId + 1) * ORIGIN_U32_STRIDE),
        ),
        originTicks: Array.from(
          this.originTicks.subarray(jobId * ORIGIN_TICK_STRIDE, (jobId + 1) * ORIGIN_TICK_STRIDE),
        ),
        originCodes: Array.from(
          this.originCodes.subarray(jobId * ORIGIN_CODE_STRIDE, (jobId + 1) * ORIGIN_CODE_STRIDE),
        ),
        claimIds: [
          this.claimIds[base] ?? CLAIM_NONE,
          this.claimIds[base + 1] ?? CLAIM_NONE,
          this.claimIds[base + 2] ?? CLAIM_NONE,
        ],
        claimEpochs: [
          this.claimEpochs[base] ?? 0,
          this.claimEpochs[base + 1] ?? 0,
          this.claimEpochs[base + 2] ?? 0,
        ],
        claimCreatedTicks: [
          this.claimCreatedTicks[base] ?? 0,
          this.claimCreatedTicks[base + 1] ?? 0,
          this.claimCreatedTicks[base + 2] ?? 0,
        ],
        claimLeaseExpiryTicks: [
          this.claimLeaseExpiryTicks[base] ?? 0,
          this.claimLeaseExpiryTicks[base + 1] ?? 0,
          this.claimLeaseExpiryTicks[base + 2] ?? 0,
        ],
      });
    }
    return {
      snapshotVersion: M3_TREATMENT_SNAPSHOT_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount: this.reservedCount,
      pathingCount: this.pathingCount,
      treatingCount: this.treatingCount,
      completedCount: this.completedCount,
      canceledCount: this.canceledCount,
      failedCount: this.failedCount,
      interruptedCount: this.interruptedCount,
      cumulativeCompletedCount: this.cumulativeCompletedCount,
      cumulativeCanceledCount: this.cumulativeCanceledCount,
      cumulativeFailedCount: this.cumulativeFailedCount,
      cumulativeInterruptedCount: this.cumulativeInterruptedCount,
      conditionDeltaCount: this.conditionDeltaCount,
      stockConsumedCount: this.stockConsumedCount,
      reservationCleanupCount: this.cleanupCount,
      pathFailureCount: this.pathFailureCount,
      staleBasisRejectCount: this.staleRejectCount,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): M3TreatmentRestoreResult {
    if (isPlainRecord(snapshot) && snapshot["snapshotVersion"] !== M3_TREATMENT_SNAPSHOT_VERSION) {
      return { ok: false, reason: "medical.snapshot_version_unsupported" };
    }
    if (!isM3TreatmentSnapshot(snapshot, this.capacity)) {
      return { ok: false, reason: "medical.snapshot_shape_invalid" };
    }
    this.clearAll();
    this.storeVersion = snapshot.storeVersion;
    this.reservedCount = snapshot.reservedCount;
    this.pathingCount = snapshot.pathingCount;
    this.treatingCount = snapshot.treatingCount;
    this.completedCount = snapshot.completedCount;
    this.canceledCount = snapshot.canceledCount;
    this.failedCount = snapshot.failedCount;
    this.interruptedCount = snapshot.interruptedCount;
    this.cumulativeCompletedCount = snapshot.cumulativeCompletedCount;
    this.cumulativeCanceledCount = snapshot.cumulativeCanceledCount;
    this.cumulativeFailedCount = snapshot.cumulativeFailedCount;
    this.cumulativeInterruptedCount = snapshot.cumulativeInterruptedCount;
    this.conditionDeltaCount = snapshot.conditionDeltaCount;
    this.stockConsumedCount = snapshot.stockConsumedCount;
    this.cleanupCount = snapshot.reservationCleanupCount;
    this.pathFailureCount = snapshot.pathFailureCount;
    this.staleRejectCount = snapshot.staleBasisRejectCount;
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const row = snapshot.rows[jobId];
      if (row !== undefined) this.restoreRecord(row);
    }
    this.activeCount = snapshot.activeCount;
    return { ok: true, version: this.storeVersion, activeCount: this.activeCount };
  }

  private failReservedTreatment(
    jobId: number,
    tick: number,
    reason: M3TreatmentReason,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3TreatmentMutationResult {
    const failed = this.failTerminalJob(jobId, tick, reason, ledger, jobCore, "target_state");
    if (!failed.ok) {
      return failed;
    }
    return { ok: false, reason };
  }

  private failTerminalJob(
    jobId: number,
    tick: number,
    reason: M3TreatmentReason,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    jobReason: JobFailureReason,
  ): M3TreatmentMutationResult {
    const before = ledger.activeCount;
    const failed = jobCore.failJob(jobId, tick, jobReason, ledger);
    if (!failed.ok) {
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.cleanupCount += before - ledger.activeCount;
    this.setTerminalFailure(jobId, tick, reason);
    return this.finish(jobId, reason);
  }

  private setTerminalFailure(jobId: number, tick: number, reason: M3TreatmentReason): void {
    this.transitionToTerminal(jobId, TREATMENT_STEP_FAILED, tick);
    this.terminalReasons[jobId] = encodeReason(reason);
  }

  private transitionToTerminal(jobId: number, terminalStep: number, tick: number): void {
    const previous = this.stepCodes[jobId] ?? 0;
    this.reservedCount -= previous === TREATMENT_STEP_RESERVED ? 1 : 0;
    this.pathingCount -= previous === TREATMENT_STEP_PATHING ? 1 : 0;
    this.treatingCount -= previous === TREATMENT_STEP_TREATING ? 1 : 0;
    this.completedCount -= previous === TREATMENT_STEP_COMPLETED ? 1 : 0;
    this.canceledCount -= previous === TREATMENT_STEP_CANCELED ? 1 : 0;
    this.failedCount -= previous === TREATMENT_STEP_FAILED ? 1 : 0;
    this.completedCount += terminalStep === TREATMENT_STEP_COMPLETED ? 1 : 0;
    this.canceledCount += terminalStep === TREATMENT_STEP_CANCELED ? 1 : 0;
    this.failedCount += terminalStep === TREATMENT_STEP_FAILED ? 1 : 0;
    this.stepCodes[jobId] = terminalStep;
    this.lastEffectTicks[jobId] = tick;
  }

  private validateCurrentBasis(
    jobId: number,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    items: ItemStackStore,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3TreatmentReason } {
    const condition = health.readCondition(this.conditionIds[jobId] ?? 0);
    if (
      condition?.conditionVersion !== (this.conditionVersions[jobId] ?? 0) ||
      condition.actorConditionVersion !== (this.actorConditionVersions[jobId] ?? 0) ||
      health.storeVersion !== (this.healthStoreVersions[jobId] ?? 0)
    ) {
      this.staleRejectCount += 1;
      return { ok: false, reason: "medical.rejected_stale_owner_state" };
    }
    const ability = abilities.queryAbility(
      this.caregiverActorIds[jobId] ?? 0,
      this.abilities[jobId] ?? 0,
      health,
      this.minimumAbilityValues[jobId] ?? 0,
    );
    if (!ability.ok || ability.value !== (this.abilityValues[jobId] ?? 0)) {
      return { ok: false, reason: "medical.rejected_caregiver_ability" };
    }
    const stack = items.readStack(this.stockStackIds[jobId] ?? 0);
    if (
      stack?.defId !== (this.stockDefIds[jobId] ?? 0) ||
      stack.quantity < (this.stockAmounts[jobId] ?? 0) ||
      items.version !== (this.stockStoreVersions[jobId] ?? 0)
    ) {
      return { ok: false, reason: "medical.rejected_no_stock" };
    }
    return { ok: true };
  }

  private restoreRecord(record: M3TreatmentJobSnapshotRow): void {
    this.active[record.jobId] = record.active;
    this.jobGenerations[record.jobId] = record.jobGeneration;
    this.jobSlotVersions[record.jobId] = record.jobSlotVersion;
    this.caregiverIndexes[record.jobId] = record.ownerIndex;
    this.caregiverGenerations[record.jobId] = record.ownerGeneration;
    this.caregiverActorIds[record.jobId] = record.caregiverActorId;
    this.requestIds[record.jobId] = record.requestId;
    this.storageSlotIds[record.jobId] = record.storageSlotId;
    this.stockStackIds[record.jobId] = record.stockStackId;
    this.stockItemIndexes[record.jobId] = record.stockItemIndex;
    this.stockItemGenerations[record.jobId] = record.stockItemGeneration;
    this.patientTargetIndexes[record.jobId] = record.patientTargetIndex;
    this.patientTargetGenerations[record.jobId] = record.patientTargetGeneration;
    this.patientInteractionSpotIds[record.jobId] = record.patientInteractionSpotId;
    this.treatmentCellIndexes[record.jobId] = record.treatmentCellIndex;
    this.abilities[record.jobId] = record.ability;
    this.minimumAbilityValues[record.jobId] = record.minimumAbilityValue;
    this.treatmentTicks[record.jobId] = record.treatmentTicks;
    this.workPerTickQ16[record.jobId] = record.workPerTickQ16;
    this.severityDeltas[record.jobId] = record.severityDelta;
    this.createdTicks[record.jobId] = record.createdTick;
    this.stepEnteredTicks[record.jobId] = record.stepEnteredTick;
    this.lastEffectTicks[record.jobId] = record.lastEffectTick;
    this.jobCoreLastMutationTicks[record.jobId] = record.jobCoreLastMutationTick;
    this.patientIds[record.jobId] = record.patientId;
    this.conditionIds[record.jobId] = record.conditionId;
    this.treatmentDefIds[record.jobId] = record.treatmentDefId;
    this.stockDefIds[record.jobId] = record.stockDefId;
    this.stockAmounts[record.jobId] = record.stockAmount;
    this.conditionVersions[record.jobId] = record.conditionVersion;
    this.actorConditionVersions[record.jobId] = record.actorConditionVersion;
    this.healthStoreVersions[record.jobId] = record.healthStoreVersion;
    this.abilityValues[record.jobId] = record.abilityValue;
    this.caregiverConditionVersions[record.jobId] = record.caregiverConditionVersion;
    this.caregiverBaseAbilityVersions[record.jobId] = record.caregiverBaseAbilityVersion;
    this.stockStoreVersions[record.jobId] = record.stockStoreVersion;
    this.stockRowVersions[record.jobId] = record.stockRowVersion;
    this.reservationVersions[record.jobId] = record.reservationVersion;
    this.jobCoreAdoptionReservationVersions[record.jobId] =
      record.jobCoreAdoptionReservationVersion;
    this.jobCoreAdoptionDriverVersions[record.jobId] = record.jobCoreAdoptionDriverVersion;
    this.jobCoreAdoptionSlotVersions[record.jobId] = record.jobCoreAdoptionSlotVersion;
    this.progressQ16[record.jobId] = record.progressQ16;
    this.deltaApplied[record.jobId] = record.deltaApplied;
    this.stockConsumedOnce[record.jobId] = record.stockConsumedOnce;
    this.cleanupPending[record.jobId] = record.cleanupPending;
    this.effectPhases[record.jobId] = record.effectPhase;
    this.terminalOutcomeCodes[record.jobId] = record.terminalOutcomeCode;
    this.terminalFailureCodes[record.jobId] = record.terminalFailureCode;
    this.terminalInterruptionCodes[record.jobId] = record.terminalInterruptionCode;
    this.stepCodes[record.jobId] = record.stepCode;
    this.terminalReasons[record.jobId] = record.terminalReasonCode;
    this.originPresent[record.jobId] = record.originPresent;
    const originU32Base = record.jobId * ORIGIN_U32_STRIDE;
    const originTickBase = record.jobId * ORIGIN_TICK_STRIDE;
    const originCodeBase = record.jobId * ORIGIN_CODE_STRIDE;
    for (let index = 0; index < ORIGIN_U32_STRIDE; index += 1)
      this.originU32[originU32Base + index] = record.originU32[index] ?? 0;
    for (let index = 0; index < ORIGIN_TICK_STRIDE; index += 1)
      this.originTicks[originTickBase + index] = record.originTicks[index] ?? 0;
    for (let index = 0; index < ORIGIN_CODE_STRIDE; index += 1)
      this.originCodes[originCodeBase + index] = record.originCodes[index] ?? 0;
    const base = record.jobId * CLAIM_COUNT;
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      this.claimIds[base + index] = record.claimIds[index] ?? CLAIM_NONE;
      this.claimEpochs[base + index] = record.claimEpochs[index] ?? 0;
      this.claimCreatedTicks[base + index] = record.claimCreatedTicks[index] ?? 0;
      this.claimLeaseExpiryTicks[base + index] = record.claimLeaseExpiryTicks[index] ?? 0;
    }
  }

  private clearAll(): void {
    this.active.fill(0);
    this.caregiverIndexes.fill(0);
    this.caregiverGenerations.fill(0);
    this.caregiverActorIds.fill(0);
    this.requestIds.fill(0);
    this.storageSlotIds.fill(0);
    this.stockStackIds.fill(0);
    this.patientTargetIndexes.fill(0);
    this.patientTargetGenerations.fill(0);
    this.patientInteractionSpotIds.fill(0);
    this.treatmentCellIndexes.fill(0);
    this.abilities.fill(0);
    this.minimumAbilityValues.fill(0);
    this.treatmentTicks.fill(0);
    this.workPerTickQ16.fill(0);
    this.severityDeltas.fill(0);
    this.createdTicks.fill(0);
    this.stepEnteredTicks.fill(0);
    this.lastEffectTicks.fill(0);
    this.jobCoreLastMutationTicks.fill(0);
    this.jobGenerations.fill(0);
    this.jobSlotVersions.fill(0);
    this.claimIds.fill(CLAIM_NONE);
    this.claimEpochs.fill(0);
    this.claimCreatedTicks.fill(0);
    this.claimLeaseExpiryTicks.fill(0);
    this.stockItemIndexes.fill(0);
    this.stockItemGenerations.fill(0);
    this.patientIds.fill(0);
    this.conditionIds.fill(0);
    this.treatmentDefIds.fill(0);
    this.stockDefIds.fill(0);
    this.stockAmounts.fill(0);
    this.conditionVersions.fill(0);
    this.actorConditionVersions.fill(0);
    this.healthStoreVersions.fill(0);
    this.abilityValues.fill(0);
    this.caregiverConditionVersions.fill(0);
    this.caregiverBaseAbilityVersions.fill(0);
    this.stockStoreVersions.fill(0);
    this.stockRowVersions.fill(0);
    this.reservationVersions.fill(0);
    this.jobCoreAdoptionReservationVersions.fill(0);
    this.jobCoreAdoptionDriverVersions.fill(0);
    this.jobCoreAdoptionSlotVersions.fill(0);
    this.progressQ16.fill(0);
    this.deltaApplied.fill(0);
    this.stockConsumedOnce.fill(0);
    this.cleanupPending.fill(0);
    this.effectPhases.fill(0);
    this.terminalOutcomeCodes.fill(0);
    this.terminalFailureCodes.fill(0);
    this.terminalInterruptionCodes.fill(0);
    this.stepCodes.fill(0);
    this.terminalReasons.fill(0);
    this.originPresent.fill(0);
    this.originU32.fill(0);
    this.originTicks.fill(0);
    this.originCodes.fill(0);
    this.activeCount = 0;
    this.reservedCount = 0;
    this.pathingCount = 0;
    this.treatingCount = 0;
    this.completedCount = 0;
    this.canceledCount = 0;
    this.failedCount = 0;
    this.interruptedCount = 0;
    this.cumulativeCompletedCount = 0;
    this.cumulativeCanceledCount = 0;
    this.cumulativeFailedCount = 0;
    this.cumulativeInterruptedCount = 0;
    this.storeVersion = 0;
    this.conditionDeltaCount = 0;
    this.stockConsumedCount = 0;
    this.cleanupCount = 0;
    this.pathFailureCount = 0;
    this.staleRejectCount = 0;
  }

  private writeRolledBackShadow(jobId: number, slotVersion: number): void {
    this.active[jobId] = 0;
    this.jobGenerations[jobId] = 0;
    this.jobSlotVersions[jobId] = slotVersion;
  }

  private isExactAdoptionPreflight(
    control: ExistingClaimsAdoptionControl,
    input: M3TreatmentClaimAdoptionInput,
    requiredWork: number,
    jobCoreVersion: number,
  ): boolean {
    const claims = input.claims;
    if (
      !isIndexInRange(control.jobId, this.capacity) ||
      control.jobGeneration === 0 ||
      !isUint32(control.jobGeneration) ||
      !isUint32(control.ownerIndex) ||
      control.expectedDriverVersion !== this.storeVersion ||
      control.expectedDriverVersion > 0xffff_fffd ||
      !isUint32(control.expectedJobSlotVersion) ||
      control.expectedJobSlotVersion > 0xffff_fffc ||
      !isUint32(control.expectedJobCoreVersion) ||
      control.expectedJobCoreVersion > 0xffff_fffc ||
      control.expectedJobCoreVersion !== jobCoreVersion ||
      !isPositiveUint32(control.reservationReadVersion) ||
      input.jobId !== control.jobId ||
      input.caregiver.index !== control.ownerIndex ||
      input.caregiver.generation !== control.ownerGeneration ||
      control.ownerGeneration === 0 ||
      !isPositiveUint32(input.treatmentTicks) ||
      !isPositiveUint32(input.workPerTickQ16) ||
      !isPositiveUint32(input.stockAmount) ||
      !isUint32(input.conditionId) ||
      !isUint32(input.treatmentDefId) ||
      input.createdTick !== control.claimCreatedTick ||
      !isUint32(input.stockDefId) ||
      !isUint32(input.stockStackId) ||
      !isUint32(input.storageSlotId) ||
      !isUint32(input.patientId) ||
      !isUint32(input.patientInteractionSpotId) ||
      !isUint32(input.treatmentCellIndex) ||
      !isUint32(input.requestId) ||
      !isUint32(input.caregiverActorId) ||
      !isUint32(input.conditionVersion) ||
      !isUint32(input.actorConditionVersion) ||
      !isUint32(input.healthStoreVersion) ||
      !isUint32(input.caregiverConditionVersion) ||
      !isUint32(input.caregiverBaseAbilityVersion) ||
      !isUint32(input.stockStoreVersion) ||
      !isUint8(input.ability) ||
      !isUint16(input.minimumAbilityValue) ||
      !isUint16(input.severityDelta) ||
      input.severityDelta === 0 ||
      input.severityDelta > 1000 ||
      !isUint16(input.abilityValue) ||
      !isUint32(input.stockItem.index) ||
      input.stockItem.generation === 0 ||
      !isUint32(input.stockItem.generation) ||
      !isUint32(input.patientInteractionTarget.index) ||
      input.patientInteractionTarget.generation === 0 ||
      !isUint32(input.patientInteractionTarget.generation) ||
      !Number.isSafeInteger(requiredWork) ||
      requiredWork <= 0 ||
      requiredWork > UINT32_MAX ||
      !isExactAdoptionClaimPrefix(control, claims, CLAIM_COUNT)
    )
      return false;
    if (input.readClaimIds.length !== 8 || input.readClaimEpochs.length !== 8) return false;
    for (let index = 0; index < 8; index += 1) {
      if (
        input.readClaimIds[index] !== control.claimIds[index] ||
        input.readClaimEpochs[index] !== control.claimEpochs[index]
      )
        return false;
    }
    return isExactTreatmentClaims(control, input, claims);
  }

  private isVirginDriverRow(jobId: number): boolean {
    if (
      this.active[jobId] !== 0 ||
      this.jobGenerations[jobId] !== 0 ||
      this.jobSlotVersions[jobId] !== 0 ||
      this.caregiverIndexes[jobId] !== 0 ||
      this.caregiverGenerations[jobId] !== 0 ||
      this.caregiverActorIds[jobId] !== 0 ||
      this.requestIds[jobId] !== 0 ||
      this.storageSlotIds[jobId] !== 0 ||
      this.stockStackIds[jobId] !== 0 ||
      this.stockItemIndexes[jobId] !== 0 ||
      this.stockItemGenerations[jobId] !== 0 ||
      this.patientTargetIndexes[jobId] !== 0 ||
      this.patientTargetGenerations[jobId] !== 0 ||
      this.patientInteractionSpotIds[jobId] !== 0 ||
      this.treatmentCellIndexes[jobId] !== 0 ||
      this.abilities[jobId] !== 0 ||
      this.minimumAbilityValues[jobId] !== 0 ||
      this.treatmentTicks[jobId] !== 0 ||
      this.workPerTickQ16[jobId] !== 0 ||
      this.severityDeltas[jobId] !== 0 ||
      this.createdTicks[jobId] !== 0 ||
      this.stepEnteredTicks[jobId] !== 0 ||
      this.lastEffectTicks[jobId] !== 0 ||
      this.patientIds[jobId] !== 0 ||
      this.conditionIds[jobId] !== 0 ||
      this.treatmentDefIds[jobId] !== 0 ||
      this.stockDefIds[jobId] !== 0 ||
      this.stockAmounts[jobId] !== 0 ||
      this.conditionVersions[jobId] !== 0 ||
      this.actorConditionVersions[jobId] !== 0 ||
      this.healthStoreVersions[jobId] !== 0 ||
      this.abilityValues[jobId] !== 0 ||
      this.caregiverConditionVersions[jobId] !== 0 ||
      this.caregiverBaseAbilityVersions[jobId] !== 0 ||
      this.stockStoreVersions[jobId] !== 0 ||
      this.stockRowVersions[jobId] !== 0 ||
      this.reservationVersions[jobId] !== 0 ||
      this.jobCoreAdoptionReservationVersions[jobId] !== 0 ||
      this.jobCoreAdoptionDriverVersions[jobId] !== 0 ||
      this.jobCoreAdoptionSlotVersions[jobId] !== 0 ||
      this.progressQ16[jobId] !== 0 ||
      this.deltaApplied[jobId] !== 0 ||
      this.stockConsumedOnce[jobId] !== 0 ||
      this.cleanupPending[jobId] !== 0 ||
      this.effectPhases[jobId] !== 0 ||
      this.terminalOutcomeCodes[jobId] !== 0 ||
      this.terminalFailureCodes[jobId] !== 0 ||
      this.terminalInterruptionCodes[jobId] !== 0 ||
      this.stepCodes[jobId] !== 0 ||
      this.terminalReasons[jobId] !== 0 ||
      this.originPresent[jobId] !== 0
    )
      return false;
    const base = jobId * CLAIM_COUNT;
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      if (
        this.claimIds[base + index] !== CLAIM_NONE ||
        this.claimEpochs[base + index] !== 0 ||
        this.claimCreatedTicks[base + index] !== 0 ||
        this.claimLeaseExpiryTicks[base + index] !== 0
      )
        return false;
    }
    return true;
  }

  private matchesReservedDriverOrigin(
    control: ExistingClaimsAdoptionControl,
    jobCore: JobCoreStore,
  ): boolean {
    const token = this.jobTokenOutput;
    if (
      !token.ok ||
      token.state !== "reserved" ||
      token.version !== control.expectedJobCoreVersion ||
      token.slotVersion !== control.expectedJobSlotVersion
    )
      return false;
    if (!token.originShadowPresent)
      return (
        this.isVirginDriverRow(control.jobId) || this.isOriginlessAdoptionReadyRow(control.jobId)
      );
    return this.matchesVisibleTerminalOrigin(control, jobCore);
  }

  private isOriginlessAdoptionReadyRow(jobId: number): boolean {
    return (
      this.active[jobId] === 0 &&
      this.jobGenerations[jobId] === 0 &&
      (this.jobSlotVersions[jobId] ?? 0) > 0 &&
      this.effectPhases[jobId] === TREATMENT_EFFECT_NONE &&
      this.cleanupPending[jobId] === 0 &&
      this.originPresent[jobId] === 0 &&
      this.stepCodes[jobId] === TREATMENT_STEP_RESERVED &&
      this.deltaApplied[jobId] === 0 &&
      this.stockConsumedOnce[jobId] === 0
    );
  }

  private matchesVisibleTerminalOrigin(
    control: ExistingClaimsAdoptionControl,
    jobCore: JobCoreStore,
  ): boolean {
    const jobId = control.jobId;
    const token = this.jobTokenOutput;
    const outcome = decodeTerminalOutcome(this.terminalOutcomeCodes[jobId] ?? 0);
    const workPerTick = this.workPerTickQ16[jobId] ?? 0;
    if (
      outcome === undefined ||
      workPerTick === 0 ||
      this.active[jobId] !== 0 ||
      this.effectPhases[jobId] !== TREATMENT_EFFECT_TERMINAL ||
      this.cleanupPending[jobId] !== 0 ||
      this.originPresent[jobId] !== 0 ||
      !this.claimsAreCleared(jobId) ||
      token.originState !== "tombstone" ||
      token.originJobGeneration !== (this.jobGenerations[jobId] ?? 0) ||
      token.originOwnerIndex !== (this.caregiverIndexes[jobId] ?? 0) ||
      token.originOwnerGeneration !== (this.caregiverGenerations[jobId] ?? 0) ||
      token.originJobKind !== M3_TREATMENT_JOB_KIND ||
      token.originTargetId !== (this.conditionIds[jobId] ?? 0) ||
      token.originStatus !== terminalStatus(outcome) ||
      token.originFailureReason !== decodeFailureReason(this.terminalFailureCodes[jobId] ?? 0) ||
      token.originCreatedTick !== (this.createdTicks[jobId] ?? 0) ||
      token.originTerminalTick !== (this.lastEffectTicks[jobId] ?? 0) ||
      token.originEffectPhase !== TREATMENT_EFFECT_TERMINAL
    )
      return false;
    return matchesAutonomyOriginTerminalScalars(
      jobCore,
      jobId,
      control.jobGeneration,
      control.ownerIndex,
      control.ownerGeneration,
      control.expectedJobSlotVersion,
      this.jobGenerations[jobId] ?? 0,
      this.caregiverIndexes[jobId] ?? 0,
      this.caregiverGenerations[jobId] ?? 0,
      M3_TREATMENT_JOB_KIND,
      this.conditionIds[jobId] ?? 0,
      terminalStatus(outcome),
      decodeFailureReason(this.terminalFailureCodes[jobId] ?? 0),
      this.createdTicks[jobId] ?? 0,
      this.lastEffectTicks[jobId] ?? 0,
      TREATMENT_EFFECT_TERMINAL,
      "at_safe_point",
      this.progressQ16[jobId] ?? 0,
      this.requiredWorkFor(jobId),
      (this.progressQ16[jobId] ?? 0) / workPerTick,
      this.jobCoreAdoptionReservationVersions[jobId] ?? 0,
      this.jobCoreAdoptionDriverVersions[jobId] ?? 0,
      this.jobCoreAdoptionSlotVersions[jobId] ?? 0,
    );
  }

  private prepareAdoptedMutationRead(
    input: M3TreatmentAdoptedMutationInput,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    if (
      !isIndexInRange(input.jobId, this.capacity) ||
      !isPositiveUint32(input.jobGeneration) ||
      !isUint32(input.ownerIndex) ||
      !isPositiveUint32(input.ownerGeneration) ||
      !isUint32(input.expectedJobSlotVersion) ||
      !isUint32(input.expectedJobCoreVersion) ||
      !isUint32(input.expectedDriverVersion) ||
      !isSafeTick(input.tick)
    ) {
      output.reason = !isSafeTick(input.tick)
        ? "medical.tick_invalid"
        : "medical.adopted_state_mismatch";
      return false;
    }
    if (input.expectedDriverVersion !== this.storeVersion) {
      output.reason = "medical.driver_version_mismatch";
      return false;
    }
    const jobId = input.jobId;
    if (
      this.active[jobId] !== 1 ||
      this.jobGenerations[jobId] !== input.jobGeneration ||
      this.caregiverIndexes[jobId] !== input.ownerIndex ||
      this.caregiverGenerations[jobId] !== input.ownerGeneration ||
      this.jobSlotVersions[jobId] !== input.expectedJobSlotVersion
    ) {
      output.reason = "medical.adopted_state_mismatch";
      return false;
    }
    jobCore.readCommittedAutonomyJobInto(
      jobId,
      input.jobGeneration,
      input.ownerIndex,
      input.ownerGeneration,
      input.expectedJobSlotVersion,
      this.committedJobOutput,
    );
    if (!this.committedJobOutput.ok) {
      output.reason = this.committedJobOutput.reason;
      return false;
    }
    if (
      this.committedJobOutput.version !== input.expectedJobCoreVersion ||
      !this.matchesCommittedTreatmentIdentity(jobId)
    ) {
      output.reason =
        this.committedJobOutput.version !== input.expectedJobCoreVersion
          ? "job_version_mismatch"
          : "medical.adopted_state_mismatch";
      return false;
    }
    return true;
  }

  private isOrdinaryAdoptedMutationState(jobId: number): boolean {
    return (
      this.deltaApplied[jobId] === 0 &&
      this.stockConsumedOnce[jobId] === 0 &&
      this.cleanupPending[jobId] === 0 &&
      this.effectPhases[jobId] === TREATMENT_EFFECT_NONE
    );
  }

  private matchesCommittedTreatmentIdentity(jobId: number): boolean {
    const row = this.committedJobOutput;
    return (
      row.state === "running" &&
      row.jobKind === M3_TREATMENT_JOB_KIND &&
      row.targetId === (this.conditionIds[jobId] ?? 0) &&
      row.status === "running" &&
      row.interruptionPolicy === "at_safe_point" &&
      row.failureReason === "none" &&
      row.createdTick === (this.createdTicks[jobId] ?? 0) &&
      row.requiredWorkQ16 === this.requiredWorkFor(jobId) &&
      row.carriedDefId === CLAIM_NONE &&
      row.carriedAmount === 0 &&
      row.terminalEffectPhase === 0
    );
  }

  private matchesCommittedTreatmentJob(jobId: number, driverStep: number): boolean {
    const row = this.committedJobOutput;
    const progress = this.progressQ16[jobId] ?? 0;
    const workPerTick = this.workPerTickQ16[jobId] ?? 0;
    if (!this.matchesCommittedTreatmentIdentity(jobId) || workPerTick === 0) return false;
    if (driverStep === TREATMENT_STEP_RESERVED || driverStep === TREATMENT_STEP_PATHING) {
      return (
        row.step === "path_to_source" &&
        row.stepEnteredTick === (this.stepEnteredTicks[jobId] ?? 0) &&
        row.lastMutationTick === (this.stepEnteredTicks[jobId] ?? 0) &&
        row.stepTickCount === 0 &&
        row.progressQ16 === 0 &&
        progress === 0
      );
    }
    if (
      driverStep !== TREATMENT_STEP_TREATING ||
      row.step !== "interact" ||
      progress % workPerTick !== 0
    )
      return false;
    return (
      row.stepEnteredTick === (this.stepEnteredTicks[jobId] ?? 0) &&
      row.lastMutationTick === (this.jobCoreLastMutationTicks[jobId] ?? 0) &&
      row.progressQ16 === progress &&
      row.stepTickCount === progress / workPerTick &&
      progress <= this.requiredWorkFor(jobId)
    );
  }

  private requiredWorkFor(jobId: number): number {
    return (this.treatmentTicks[jobId] ?? 0) * (this.workPerTickQ16[jobId] ?? 0);
  }

  private mutationHeadroomReason(
    input: M3TreatmentAdoptedMutationInput,
    futureDriverBumps: number,
    futureJobCoreBumps: number,
  ): M3TreatmentReason | JobCoreReason | undefined {
    const jobId = input.jobId;
    const remainingWork = this.requiredWorkFor(jobId) - (this.progressQ16[jobId] ?? 0);
    const progressBumps = Math.ceil(remainingWork / (this.workPerTickQ16[jobId] ?? 1));
    if (this.storeVersion > UINT32_MAX - (progressBumps + futureDriverBumps))
      return "medical.driver_version_exhausted";
    if (input.expectedJobCoreVersion > UINT32_MAX - (progressBumps + futureJobCoreBumps))
      return "job_core_version_exhausted";
    if (input.expectedJobSlotVersion > UINT32_MAX - (progressBumps + futureJobCoreBumps))
      return "job_slot_version_exhausted";
    return undefined;
  }

  private prepareCompletedTerminal(
    input: M3TreatmentAdoptedCompleteInput,
    health: M3HealthConditionStore,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    const jobId = input.jobId;
    if (!this.prepareTerminalActiveRead(input, jobCore, output)) return false;
    const phase = this.effectPhases[jobId] ?? 0;
    if (
      (phase !== TREATMENT_EFFECT_NONE && phase !== TREATMENT_EFFECT_HEALTH_APPLIED) ||
      this.cleanupPending[jobId] !== 0 ||
      this.stepCodes[jobId] !== TREATMENT_STEP_TREATING ||
      this.progressQ16[jobId] !== this.requiredWorkFor(jobId) ||
      input.tick < (this.lastEffectTicks[jobId] ?? 0)
    ) {
      output.reason =
        input.tick < (this.lastEffectTicks[jobId] ?? 0)
          ? "medical.tick_invalid"
          : "medical.step_invalid";
      return false;
    }
    const maximumDriverVersion = phase === TREATMENT_EFFECT_NONE ? 0xffff_fffc : 0xffff_fffd;
    if (!this.hasTerminalVersionHeadroom(input, maximumDriverVersion, output)) return false;
    if (!this.hasTerminalCounterHeadroom(jobId, "completed")) {
      output.reason = "medical.adopted_state_mismatch";
      return false;
    }
    if (!this.hasCompletedEffectCounterHeadroom(jobId, phase)) {
      output.reason = "medical.adopted_state_mismatch";
      return false;
    }
    if (!this.prepareClaims(input, ledger, claims, output)) return false;
    if (!this.prepareCompletedCore(input, jobCore, output)) return false;
    if (!this.prepareHealthEffect(input, health, phase, output)) return false;
    return this.prepareStockEffect(input, items, storage, ledger, output);
  }

  private prepareNegativeTerminal(
    input: M3TreatmentAdoptedTerminalInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    if (!this.prepareTerminalActiveRead(input, jobCore, output)) return false;
    const jobId = input.jobId;
    if (
      (this.effectPhases[jobId] ?? 0) !== TREATMENT_EFFECT_NONE ||
      this.cleanupPending[jobId] !== 0 ||
      !isExactTreatmentTerminalTuple(input.outcome, input.failureReason, input.interruptionKind) ||
      input.tick < (this.lastEffectTicks[jobId] ?? 0)
    ) {
      output.reason =
        input.tick < (this.lastEffectTicks[jobId] ?? 0)
          ? "medical.tick_invalid"
          : "medical.step_invalid";
      return false;
    }
    if (!this.hasTerminalVersionHeadroom(input, 0xffff_fffd, output)) return false;
    if (!this.hasTerminalCounterHeadroom(jobId, input.outcome)) {
      output.reason = "medical.adopted_state_mismatch";
      return false;
    }
    if (!this.prepareClaims(input, ledger, claims, output)) return false;
    return this.prepareTerminalCore(input, input.outcome, jobCore, output);
  }

  private prepareCleanupResume(
    input: M3TreatmentResumeCleanupInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    if (!this.prepareTerminalActiveRead(input, jobCore, output)) return false;
    const jobId = input.jobId;
    const phase = this.effectPhases[jobId] ?? 0;
    if (
      (phase !== TREATMENT_EFFECT_STOCK_CONSUMED &&
        phase !== TREATMENT_EFFECT_TERMINAL_CLEANUP_PENDING) ||
      this.cleanupPending[jobId] !== 1 ||
      !this.matchesStoredTerminalTuple(jobId, input) ||
      input.tick < (this.lastEffectTicks[jobId] ?? 0)
    ) {
      output.reason =
        input.tick < (this.lastEffectTicks[jobId] ?? 0)
          ? "medical.tick_invalid"
          : "medical.step_invalid";
      return false;
    }
    if (!this.hasTerminalVersionHeadroom(input, 0xffff_fffe, output)) return false;
    if (!this.hasTerminalCounterHeadroom(jobId, input.outcome)) {
      output.reason = "medical.adopted_state_mismatch";
      return false;
    }
    if (!this.prepareClaims(input, ledger, claims, output)) return false;
    return this.prepareTerminalCore(input, input.outcome, jobCore, output);
  }

  private prepareTerminalActiveRead(
    input: M3TreatmentAdoptedMutationInput,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    if (!this.prepareAdoptedMutationRead(input, jobCore, output)) return false;
    const step = this.stepCodes[input.jobId] ?? 0;
    if (
      (step !== TREATMENT_STEP_RESERVED &&
        step !== TREATMENT_STEP_PATHING &&
        step !== TREATMENT_STEP_TREATING) ||
      !this.matchesCommittedTreatmentJob(input.jobId, step)
    ) {
      output.reason = "medical.adopted_state_mismatch";
      return false;
    }
    return true;
  }

  private hasTerminalVersionHeadroom(
    input: M3TreatmentAdoptedMutationInput & { readonly expectedCurrentLedgerVersion: number },
    maximumDriverVersion: number,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    if (input.expectedDriverVersion > maximumDriverVersion) {
      output.reason = "medical.driver_version_exhausted";
      return false;
    }
    if (input.expectedJobCoreVersion > 0xffff_fffe) {
      output.reason = "job_core_version_exhausted";
      return false;
    }
    if (input.expectedJobSlotVersion > 0xffff_fffe) {
      output.reason = "job_slot_version_exhausted";
      return false;
    }
    if (
      !isUint32(input.expectedCurrentLedgerVersion) ||
      input.expectedCurrentLedgerVersion > 0xffff_fffe
    ) {
      output.reason = "reservation_ledger_version_exhausted";
      return false;
    }
    return true;
  }

  private prepareClaims(
    input: M3TreatmentAdoptedMutationInput & { readonly expectedCurrentLedgerVersion: number },
    ledger: ReservationLedger,
    claims: ReservationClaimsIntoOutput,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    this.copyStoredClaims(input.jobId);
    this.autonomyOwner.index = input.ownerIndex;
    this.autonomyOwner.generation = input.ownerGeneration;
    ledger.readActiveClaimsInto(
      this.releaseClaimIds,
      this.releaseClaimEpochs,
      CLAIM_COUNT,
      this.autonomyOwner,
      input.jobId,
      input.jobGeneration,
      input.expectedCurrentLedgerVersion,
      claims,
    );
    if (!claims.ok) {
      output.reason = claims.reason;
      return false;
    }
    if (!this.matchesExactTreatmentClaims(input.jobId, claims)) {
      output.reason = "medical.adopted_state_mismatch";
      return false;
    }
    return true;
  }

  private copyStoredClaims(jobId: number): void {
    const base = jobId * CLAIM_COUNT;
    for (let index = 0; index < 8; index += 1) {
      this.releaseClaimIds[index] =
        index < CLAIM_COUNT ? (this.claimIds[base + index] ?? CLAIM_NONE) : CLAIM_NONE;
      this.releaseClaimEpochs[index] =
        index < CLAIM_COUNT ? (this.claimEpochs[base + index] ?? 0) : 0;
    }
  }

  private matchesExactTreatmentClaims(jobId: number, claims: ReservationClaimsIntoOutput): boolean {
    if (!hasExactClaimsOutputShape(claims) || claims.claimCount !== CLAIM_COUNT) return false;
    const base = jobId * CLAIM_COUNT;
    for (let index = 0; index < 8; index += 1) {
      if (index >= CLAIM_COUNT) {
        if (!isCanonicalInactiveClaim(claims, index)) return false;
        continue;
      }
      if (
        claims.ownerIndexes[index] !== (this.caregiverIndexes[jobId] ?? 0) ||
        claims.ownerGenerations[index] !== (this.caregiverGenerations[jobId] ?? 0) ||
        claims.jobIds[index] !== jobId ||
        claims.jobGenerations[index] !== (this.jobGenerations[jobId] ?? 0) ||
        claims.allocationEpochs[index] !== (this.claimEpochs[base + index] ?? 0) ||
        claims.createdTicks[index] !== (this.claimCreatedTicks[base + index] ?? 0) ||
        claims.leaseExpiryTicks[index] !== (this.claimLeaseExpiryTicks[base + index] ?? 0)
      )
        return false;
    }
    return this.matchesTreatmentClaimChannels(jobId, claims);
  }

  private matchesTreatmentClaimChannels(
    jobId: number,
    claims: ReservationClaimsIntoOutput,
  ): boolean {
    return (
      claims.channelCodes[0] === RESERVATION_ITEM_QUANTITY &&
      claims.hasTargetFlags[0] === 1 &&
      claims.targetIndexes[0] === (this.stockItemIndexes[jobId] ?? 0) &&
      claims.targetGenerations[0] === (this.stockItemGenerations[jobId] ?? 0) &&
      claims.cellIndexes[0] === CLAIM_NONE &&
      claims.slotIds[0] === CLAIM_NONE &&
      claims.amounts[0] === (this.stockAmounts[jobId] ?? 0) &&
      claims.channelCodes[1] === RESERVATION_INTERACTION_SPOT &&
      claims.hasTargetFlags[1] === 1 &&
      claims.targetIndexes[1] === (this.patientTargetIndexes[jobId] ?? 0) &&
      claims.targetGenerations[1] === (this.patientTargetGenerations[jobId] ?? 0) &&
      claims.cellIndexes[1] === CLAIM_NONE &&
      claims.slotIds[1] === (this.patientInteractionSpotIds[jobId] ?? 0) &&
      claims.amounts[1] === 0 &&
      claims.channelCodes[2] === RESERVATION_CELL &&
      claims.hasTargetFlags[2] === 0 &&
      claims.targetIndexes[2] === CLAIM_NONE &&
      claims.targetGenerations[2] === 0 &&
      claims.cellIndexes[2] === (this.treatmentCellIndexes[jobId] ?? 0) &&
      claims.slotIds[2] === CLAIM_NONE &&
      claims.amounts[2] === 0
    );
  }

  private prepareCompletedCore(
    input: M3TreatmentAdoptedCompleteInput,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    return this.prepareTerminalCoreScalars(input, "completed", "none", undefined, jobCore, output);
  }

  private prepareTerminalCore(
    input: M3TreatmentAdoptedTerminalInput | M3TreatmentResumeCleanupInput,
    outcome: M3TreatmentAdoptedTerminalOutcome,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    return this.prepareTerminalCoreScalars(
      input,
      outcome,
      input.failureReason,
      input.interruptionKind,
      jobCore,
      output,
    );
  }

  private prepareTerminalCoreScalars(
    input: M3TreatmentAdoptedMutationInput,
    outcome: M3TreatmentAdoptedTerminalOutcome,
    failureReason: JobFailureReason,
    interruptionKind: JobInterruptionKind | undefined,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    jobCore.prepareAutonomyTerminalScalarsInto(
      input.jobId,
      input.jobGeneration,
      input.ownerIndex,
      input.ownerGeneration,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      terminalStatus(outcome),
      failureReason,
      TREATMENT_EFFECT_TERMINAL,
      interruptionKind,
      this.preparedTerminal,
    );
    if (!this.preparedTerminal.ok) {
      output.reason = this.preparedTerminal.reason;
      return false;
    }
    return true;
  }

  private prepareHealthEffect(
    input: M3TreatmentAdoptedCompleteInput,
    health: M3HealthConditionStore,
    phase: number,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    const jobId = input.jobId;
    health.readConditionInto(this.conditionIds[jobId] ?? 0, this.healthReadOutput);
    if (!this.matchesHealthMutationInput(jobId, input.healthMutation)) {
      output.reason = "medical.rejected_stale_owner_state";
      return false;
    }
    if (phase === TREATMENT_EFFECT_HEALTH_APPLIED) return true;
    health.prepareTreatmentConditionDeltaInto(input.healthMutation, this.preparedHealth);
    if (!this.preparedHealth.ok) {
      output.reason = this.preparedHealth.reason;
      return false;
    }
    return true;
  }

  private matchesHealthMutationInput(
    jobId: number,
    input: M3HealthTreatmentConditionDeltaPrepareInput,
  ): boolean {
    const row = this.healthReadOutput;
    return (
      row.ok &&
      input.conditionId === (this.conditionIds[jobId] ?? 0) &&
      input.conditionId === row.conditionId &&
      input.expectedActorId === (this.patientIds[jobId] ?? 0) &&
      input.expectedActorId === row.actorId &&
      input.expectedDefId === row.defId &&
      input.expectedSeverity === row.severity &&
      input.expectedTerminalState === row.terminalState &&
      input.expectedAffectedAbilityMask === row.affectedAbilityMask &&
      input.expectedStoreVersion === row.storeVersion &&
      input.expectedStoreVersion === (this.healthStoreVersions[jobId] ?? 0) &&
      input.expectedConditionVersion === row.conditionVersion &&
      input.expectedConditionVersion === (this.conditionVersions[jobId] ?? 0) &&
      input.expectedActorConditionVersion === row.actorConditionVersion &&
      input.expectedActorConditionVersion === (this.actorConditionVersions[jobId] ?? 0) &&
      input.severityDelta === (this.severityDeltas[jobId] ?? 0)
    );
  }

  private prepareStockEffect(
    input: M3TreatmentAdoptedCompleteInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    const jobId = input.jobId;
    items.readStackInto(
      this.stockStackIds[jobId] ?? 0,
      ledger,
      this.itemReadScratch,
      this.itemReadOutput,
    );
    if (
      !this.matchesStockRemovalInput(jobId, input.stockRemoval, input.expectedCurrentLedgerVersion)
    ) {
      output.reason = this.itemReadOutput.reason ?? "medical.rejected_stale_owner_state";
      return false;
    }
    items.prepareAutonomousQuantityRemovalInto(
      input.stockRemoval,
      ledger,
      this.itemReadScratch,
      this.preparedItemRemoval,
    );
    if (!this.preparedItemRemoval.ok) {
      output.reason = this.preparedItemRemoval.reason;
      return false;
    }
    storage.readSlotInto(this.storageSlotIds[jobId] ?? 0, this.storageReadOutput);
    if (!matchesStorageSlot(this.storageReadOutput, input.stockSlot)) {
      output.reason = this.storageReadOutput.reason ?? "medical.rejected_stale_owner_state";
      return false;
    }
    if (
      !this.storageReadOutput.ok ||
      this.storageReadOutput.stackId !== (this.stockStackIds[jobId] ?? 0) ||
      this.storageReadOutput.defId !== (this.stockDefIds[jobId] ?? 0) ||
      this.storageReadOutput.quantity !== this.itemReadOutput.quantity ||
      this.storageReadOutput.reservedSupply !== this.itemReadOutput.reservedQuantity ||
      this.storageReadOutput.availableSupply !== this.itemReadOutput.availableQuantity ||
      !matchesStorageDirtyInput(this.storageReadOutput, input.stockDirty)
    ) {
      output.reason = "medical.rejected_stale_owner_state";
      return false;
    }
    storage.prepareSlotDirtyInto(input.stockDirty, this.preparedStorageDirty);
    if (!this.preparedStorageDirty.ok) {
      output.reason = this.preparedStorageDirty.reason;
      return false;
    }
    return true;
  }

  private matchesStockRemovalInput(
    jobId: number,
    input: ItemStackQuantityRemovalPrepareInput,
    expectedCurrentLedgerVersion: number,
  ): boolean {
    const row = this.itemReadOutput;
    const amount = this.stockAmounts[jobId] ?? 0;
    return (
      row.ok &&
      input.stackId === (this.stockStackIds[jobId] ?? 0) &&
      input.stackId === row.stackId &&
      input.entityIndex === (this.stockItemIndexes[jobId] ?? 0) &&
      input.entityIndex === row.entityIndex &&
      input.entityGeneration === (this.stockItemGenerations[jobId] ?? 0) &&
      input.entityGeneration === row.entityGeneration &&
      input.defId === (this.stockDefIds[jobId] ?? 0) &&
      input.defId === row.defId &&
      input.quantity === row.quantity &&
      input.reservedQuantity === row.reservedQuantity &&
      input.ownedReservedQuantity === amount &&
      row.reservedQuantity >= amount &&
      input.availableQuantity === row.availableQuantity &&
      input.capacity === row.capacity &&
      input.amount === amount &&
      input.expectedRowVersion === row.rowVersion &&
      input.expectedStoreVersion === row.storeVersion &&
      input.expectedStoreVersion === (this.stockStoreVersions[jobId] ?? 0) &&
      input.expectedReservationVersion === row.reservationVersion &&
      input.expectedReservationVersion === expectedCurrentLedgerVersion
    );
  }

  private commitFreshCompleteAppend(
    input: M3TreatmentAdoptedCompleteInput,
    health: M3HealthConditionStore,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    commitPreparedM3HealthTreatment(health, this.preparedHealth);
    this.commitHealthAppliedPhase(input);
    commitPreparedItemStackQuantityRemoval(items, this.preparedItemRemoval);
    commitPreparedStorageDirtyAppend(storage, this.preparedStorageDirty);
    this.commitStockConsumedPhase(input);
    this.finishCompletedRelease(input, ledger, jobCore, output);
  }

  private commitFreshCompleteCoalesce(
    input: M3TreatmentAdoptedCompleteInput,
    health: M3HealthConditionStore,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    commitPreparedM3HealthTreatment(health, this.preparedHealth);
    this.commitHealthAppliedPhase(input);
    commitPreparedItemStackQuantityRemoval(items, this.preparedItemRemoval);
    commitPreparedStorageDirtyCoalesce(storage, this.preparedStorageDirty);
    this.commitStockConsumedPhase(input);
    this.finishCompletedRelease(input, ledger, jobCore, output);
  }

  private commitHealthAppliedCompleteAppend(
    input: M3TreatmentAdoptedCompleteInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    commitPreparedItemStackQuantityRemoval(items, this.preparedItemRemoval);
    commitPreparedStorageDirtyAppend(storage, this.preparedStorageDirty);
    this.commitStockConsumedPhase(input);
    this.finishCompletedRelease(input, ledger, jobCore, output);
  }

  private commitHealthAppliedCompleteCoalesce(
    input: M3TreatmentAdoptedCompleteInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    commitPreparedItemStackQuantityRemoval(items, this.preparedItemRemoval);
    commitPreparedStorageDirtyCoalesce(storage, this.preparedStorageDirty);
    this.commitStockConsumedPhase(input);
    this.finishCompletedRelease(input, ledger, jobCore, output);
  }

  private commitHealthAppliedPhase(input: M3TreatmentAdoptedCompleteInput): void {
    const jobId = input.jobId;
    this.conditionVersions[jobId] = this.preparedHealth.nextConditionVersion;
    this.actorConditionVersions[jobId] = this.preparedHealth.nextActorConditionVersion;
    this.healthStoreVersions[jobId] = this.preparedHealth.nextStoreVersion;
    this.deltaApplied[jobId] = 1;
    this.effectPhases[jobId] = TREATMENT_EFFECT_HEALTH_APPLIED;
    this.terminalOutcomeCodes[jobId] = TREATMENT_OUTCOME_COMPLETED;
    this.terminalFailureCodes[jobId] = encodeFailureReason("none");
    this.terminalInterruptionCodes[jobId] = 0;
    this.lastEffectTicks[jobId] = input.tick;
    this.conditionDeltaCount += 1;
    this.storeVersion += 1;
  }

  private commitStockConsumedPhase(input: M3TreatmentAdoptedCompleteInput): void {
    const jobId = input.jobId;
    this.stockStoreVersions[jobId] = this.preparedItemRemoval.nextStoreVersion;
    this.stockRowVersions[jobId] = this.preparedItemRemoval.nextRowVersion;
    this.stockConsumedOnce[jobId] = 1;
    this.cleanupPending[jobId] = 1;
    this.effectPhases[jobId] = TREATMENT_EFFECT_STOCK_CONSUMED;
    this.lastEffectTicks[jobId] = input.tick;
    this.stockConsumedCount += this.preparedItemRemoval.amount;
    this.storeVersion += 1;
  }

  private finishCompletedRelease(
    input: M3TreatmentAdoptedCompleteInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    this.releaseStoredClaims(input, ledger);
    if (!this.releaseOutput.ok) {
      output.reason = this.releaseOutput.reason;
      this.writePendingMutationOutput(input.jobId, input.expectedJobCoreVersion, output);
      return;
    }
    this.commitTerminalTailScalars(
      input,
      "completed",
      "none",
      undefined,
      jobCore,
      this.releaseOutput.version,
    );
    this.writeMutationSuccess(input.jobId, this.preparedTerminal.nextJobCoreVersion, false, output);
    output.releasedClaimCount = this.releaseOutput.releasedCount;
  }

  private releaseStoredClaims(
    input: M3TreatmentAdoptedMutationInput & { readonly expectedCurrentLedgerVersion: number },
    ledger: ReservationLedger,
  ): void {
    this.autonomyOwner.index = input.ownerIndex;
    this.autonomyOwner.generation = input.ownerGeneration;
    ledger.releaseClaimsInto(
      this.releaseClaimIds,
      this.releaseClaimEpochs,
      CLAIM_COUNT,
      this.autonomyOwner,
      input.jobId,
      input.jobGeneration,
      input.expectedCurrentLedgerVersion,
      this.releaseOutput,
    );
  }

  private commitNegativeCleanupPending(input: M3TreatmentAdoptedTerminalInput): void {
    const jobId = input.jobId;
    this.effectPhases[jobId] = TREATMENT_EFFECT_TERMINAL_CLEANUP_PENDING;
    this.cleanupPending[jobId] = 1;
    this.terminalOutcomeCodes[jobId] = encodeTerminalOutcome(input.outcome);
    this.terminalFailureCodes[jobId] = encodeFailureReason(input.failureReason);
    this.terminalInterruptionCodes[jobId] = encodeInterruptionKind(input.interruptionKind);
    this.lastEffectTicks[jobId] = input.tick;
    this.storeVersion += 1;
  }

  private commitTerminalTail(
    input: M3TreatmentAdoptedTerminalInput | M3TreatmentResumeCleanupInput,
    jobCore: JobCoreStore,
    reservationVersion: number,
  ): void {
    this.commitTerminalTailScalars(
      input,
      input.outcome,
      input.failureReason,
      input.interruptionKind,
      jobCore,
      reservationVersion,
    );
  }

  private commitTerminalTailScalars(
    input: M3TreatmentAdoptedMutationInput,
    outcome: M3TreatmentAdoptedTerminalOutcome,
    failureReason: JobFailureReason,
    interruptionKind: JobInterruptionKind | undefined,
    jobCore: JobCoreStore,
    reservationVersion: number,
  ): void {
    const jobId = input.jobId;
    const currentTombstoneDelta = this.currentJobCoreTombstoneDelta(jobId);
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.committedJobOutput.activeCount -= 1;
    this.committedJobOutput.runningCount -= 1;
    this.committedJobOutput.currentTombstoneCount += currentTombstoneDelta;
    this.committedJobOutput.cumulativeTerminalCount += 1;
    this.removeActiveStepCount(this.stepCodes[jobId] ?? 0);
    this.removeOriginCurrentCounts(jobId);
    this.addTerminalCounts(outcome);
    this.active[jobId] = 0;
    this.activeCount -= 1;
    this.jobSlotVersions[jobId] = this.preparedTerminal.nextSlotVersion;
    this.stepCodes[jobId] = terminalStepCode(outcome);
    this.stepEnteredTicks[jobId] = input.tick;
    this.lastEffectTicks[jobId] = input.tick;
    this.jobCoreLastMutationTicks[jobId] = input.tick;
    this.effectPhases[jobId] = TREATMENT_EFFECT_TERMINAL;
    this.cleanupPending[jobId] = 0;
    this.terminalOutcomeCodes[jobId] = encodeTerminalOutcome(outcome);
    this.terminalFailureCodes[jobId] = encodeFailureReason(failureReason);
    this.terminalInterruptionCodes[jobId] = encodeInterruptionKind(interruptionKind);
    this.terminalReasons[jobId] = terminalReasonCode(outcome);
    this.reservationVersions[jobId] = reservationVersion;
    this.cleanupCount += CLAIM_COUNT;
    this.clearStoredClaims(jobId);
    this.clearOrigin(jobId);
    this.storeVersion += 1;
  }

  private removeActiveStepCount(step: number): void {
    if (step === TREATMENT_STEP_RESERVED) this.reservedCount -= 1;
    else if (step === TREATMENT_STEP_PATHING) this.pathingCount -= 1;
    else if (step === TREATMENT_STEP_TREATING) this.treatingCount -= 1;
  }

  private addTerminalCounts(outcome: M3TreatmentAdoptedTerminalOutcome): void {
    if (outcome === "completed") {
      this.completedCount += 1;
      this.cumulativeCompletedCount += 1;
    } else if (outcome === "failed") {
      this.failedCount += 1;
      this.cumulativeFailedCount += 1;
    } else {
      this.canceledCount += 1;
      this.cumulativeCanceledCount += 1;
      if (outcome === "interrupted") {
        this.interruptedCount += 1;
        this.cumulativeInterruptedCount += 1;
      }
    }
  }

  private removeOriginCurrentCounts(jobId: number): void {
    if (this.originPresent[jobId] !== 1) return;
    const outcome = decodeTerminalOutcome(this.originCodes[jobId * ORIGIN_CODE_STRIDE + 4] ?? 0);
    if (outcome === "completed") this.completedCount -= 1;
    else if (outcome === "failed") this.failedCount -= 1;
    else if (outcome === "canceled") this.canceledCount -= 1;
    else if (outcome === "interrupted") {
      this.canceledCount -= 1;
      this.interruptedCount -= 1;
    }
  }

  private hasTerminalCounterHeadroom(
    jobId: number,
    outcome: M3TreatmentAdoptedTerminalOutcome,
  ): boolean {
    if (this.activeCount === 0 || this.cleanupCount > UINT32_MAX - CLAIM_COUNT) return false;
    const originOutcome = this.originTerminalOutcome(jobId);
    if (this.originPresent[jobId] === 1 && originOutcome === undefined) return false;
    const oldCompleted = originOutcome === "completed" ? 1 : 0;
    const oldCanceled = originOutcome === "canceled" || originOutcome === "interrupted" ? 1 : 0;
    const oldFailed = originOutcome === "failed" ? 1 : 0;
    const oldInterrupted = originOutcome === "interrupted" ? 1 : 0;
    if (
      !canReplaceUint32Count(this.completedCount, oldCompleted, outcome === "completed" ? 1 : 0) ||
      !canReplaceUint32Count(
        this.canceledCount,
        oldCanceled,
        outcome === "canceled" || outcome === "interrupted" ? 1 : 0,
      ) ||
      !canReplaceUint32Count(this.failedCount, oldFailed, outcome === "failed" ? 1 : 0) ||
      !canReplaceUint32Count(
        this.interruptedCount,
        oldInterrupted,
        outcome === "interrupted" ? 1 : 0,
      )
    )
      return false;
    if (outcome === "completed") return this.cumulativeCompletedCount < UINT32_MAX;
    if (outcome === "failed") return this.cumulativeFailedCount < UINT32_MAX;
    if (this.cumulativeCanceledCount === UINT32_MAX) return false;
    return outcome !== "interrupted" || this.cumulativeInterruptedCount < UINT32_MAX;
  }

  private originTerminalOutcome(jobId: number): M3TreatmentAdoptedTerminalOutcome | undefined {
    if (this.originPresent[jobId] !== 1) return undefined;
    return decodeTerminalOutcome(
      this.originCodes[jobId * ORIGIN_CODE_STRIDE + ORIGIN_TERMINAL_OUTCOME] ?? 0,
    );
  }

  private hasCompletedEffectCounterHeadroom(jobId: number, phase: number): boolean {
    if (phase === TREATMENT_EFFECT_NONE && this.conditionDeltaCount === UINT32_MAX) return false;
    const amount = this.stockAmounts[jobId] ?? 0;
    return amount > 0 && this.stockConsumedCount <= UINT32_MAX - amount;
  }

  private currentJobCoreTombstoneDelta(jobId: number): number {
    return this.originPresent[jobId] === 1 ? 0 : 1;
  }

  private clearStoredClaims(jobId: number): void {
    const base = jobId * CLAIM_COUNT;
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      this.claimIds[base + index] = CLAIM_NONE;
      this.claimEpochs[base + index] = 0;
      this.claimCreatedTicks[base + index] = 0;
      this.claimLeaseExpiryTicks[base + index] = 0;
    }
  }

  private writeTerminalDuplicateIfExact(
    input: M3TreatmentAdoptedTerminalInput | M3TreatmentResumeCleanupInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    const jobId = input.jobId;
    if (
      !isIndexInRange(jobId, this.capacity) ||
      this.effectPhases[jobId] !== TREATMENT_EFFECT_TERMINAL
    )
      return false;
    if (
      !this.matchesTerminalDuplicateCaller(input, ledger, jobCore) ||
      !this.matchesStoredTerminalTuple(jobId, input)
    ) {
      output.reason = "medical.step_invalid";
      return true;
    }
    this.writeMutationSuccess(jobId, input.expectedJobCoreVersion, true, output);
    return true;
  }

  private writeCompletedDuplicateIfExact(
    input: M3TreatmentAdoptedCompleteInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3TreatmentAdoptedMutationOutput,
  ): boolean {
    const jobId = input.jobId;
    if (
      !isIndexInRange(jobId, this.capacity) ||
      this.effectPhases[jobId] !== TREATMENT_EFFECT_TERMINAL
    )
      return false;
    if (
      !this.matchesTerminalDuplicateCaller(input, ledger, jobCore) ||
      this.terminalOutcomeCodes[jobId] !== TREATMENT_OUTCOME_COMPLETED ||
      this.terminalFailureCodes[jobId] !== encodeFailureReason("none") ||
      this.terminalInterruptionCodes[jobId] !== 0
    ) {
      output.reason = "medical.step_invalid";
      return true;
    }
    this.writeMutationSuccess(jobId, input.expectedJobCoreVersion, true, output);
    return true;
  }

  private matchesTerminalDuplicateCaller(
    input: M3TreatmentAdoptedMutationInput & { readonly expectedCurrentLedgerVersion: number },
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): boolean {
    const jobId = input.jobId;
    if (
      !isSafeTick(input.tick) ||
      input.tick < (this.lastEffectTicks[jobId] ?? 0) ||
      input.expectedDriverVersion !== this.storeVersion ||
      input.expectedCurrentLedgerVersion !== ledger.version ||
      this.active[jobId] !== 0 ||
      this.cleanupPending[jobId] !== 0 ||
      this.jobGenerations[jobId] !== input.jobGeneration ||
      this.caregiverIndexes[jobId] !== input.ownerIndex ||
      this.caregiverGenerations[jobId] !== input.ownerGeneration ||
      this.jobSlotVersions[jobId] !== input.expectedJobSlotVersion ||
      !this.claimsAreCleared(jobId)
    )
      return false;
    jobCore.readCommittedAutonomyJobInto(
      jobId,
      input.jobGeneration,
      input.ownerIndex,
      input.ownerGeneration,
      input.expectedJobSlotVersion,
      this.committedJobOutput,
    );
    return this.matchesCommittedTerminalJob(jobId, input.expectedJobCoreVersion);
  }

  private matchesCommittedTerminalJob(jobId: number, expectedVersion: number): boolean {
    const row = this.committedJobOutput;
    const outcome = decodeTerminalOutcome(this.terminalOutcomeCodes[jobId] ?? 0);
    return (
      outcome !== undefined &&
      row.ok &&
      row.version === expectedVersion &&
      row.state === "tombstone" &&
      row.jobKind === M3_TREATMENT_JOB_KIND &&
      row.targetId === (this.conditionIds[jobId] ?? 0) &&
      row.status === terminalStatus(outcome) &&
      row.failureReason === decodeFailureReason(this.terminalFailureCodes[jobId] ?? 0) &&
      row.interruptionPolicy === "at_safe_point" &&
      row.createdTick === (this.createdTicks[jobId] ?? 0) &&
      row.stepEnteredTick === (this.stepEnteredTicks[jobId] ?? 0) &&
      row.lastMutationTick === (this.lastEffectTicks[jobId] ?? 0) &&
      row.progressQ16 === (this.progressQ16[jobId] ?? 0) &&
      row.requiredWorkQ16 === this.requiredWorkFor(jobId) &&
      row.carriedDefId === CLAIM_NONE &&
      row.carriedAmount === 0 &&
      row.terminalEffectPhase === TREATMENT_EFFECT_TERMINAL
    );
  }

  private matchesStoredTerminalTuple(
    jobId: number,
    input: {
      readonly outcome: M3TreatmentAdoptedTerminalOutcome;
      readonly failureReason: JobFailureReason;
      readonly interruptionKind: JobInterruptionKind | undefined;
    },
  ): boolean {
    return (
      isExactTreatmentTerminalTuple(input.outcome, input.failureReason, input.interruptionKind) &&
      this.terminalOutcomeCodes[jobId] === encodeTerminalOutcome(input.outcome) &&
      this.terminalFailureCodes[jobId] === encodeFailureReason(input.failureReason) &&
      this.terminalInterruptionCodes[jobId] === encodeInterruptionKind(input.interruptionKind)
    );
  }

  private claimsAreCleared(jobId: number): boolean {
    const base = jobId * CLAIM_COUNT;
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      if (
        this.claimIds[base + index] !== CLAIM_NONE ||
        this.claimEpochs[base + index] !== 0 ||
        this.claimCreatedTicks[base + index] !== 0 ||
        this.claimLeaseExpiryTicks[base + index] !== 0
      )
        return false;
    }
    return true;
  }

  private writePendingMutationOutput(
    jobId: number,
    jobCoreVersion: number,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    const reason = output.reason;
    this.writeMutationSuccess(jobId, jobCoreVersion, false, output);
    output.ok = false;
    output.reason = reason;
  }

  private captureTerminalOrigin(jobId: number): void {
    const u32 = jobId * ORIGIN_U32_STRIDE;
    const tick = jobId * ORIGIN_TICK_STRIDE;
    const code = jobId * ORIGIN_CODE_STRIDE;
    this.originPresent[jobId] = 1;
    this.originU32[u32 + ORIGIN_OWNER_INDEX] = this.caregiverIndexes[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_OWNER_GENERATION] = this.caregiverGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_CAREGIVER_ACTOR_ID] = this.caregiverActorIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_REQUEST_ID] = this.requestIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STORAGE_SLOT_ID] = this.storageSlotIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STOCK_STACK_ID] = this.stockStackIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STOCK_ITEM_INDEX] = this.stockItemIndexes[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STOCK_ITEM_GENERATION] = this.stockItemGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_PATIENT_TARGET_INDEX] = this.patientTargetIndexes[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_PATIENT_TARGET_GENERATION] =
      this.patientTargetGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_PATIENT_INTERACTION_SPOT_ID] =
      this.patientInteractionSpotIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_TREATMENT_CELL_INDEX] = this.treatmentCellIndexes[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_ABILITY] = this.abilities[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_MINIMUM_ABILITY_VALUE] = this.minimumAbilityValues[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_TREATMENT_TICKS] = this.treatmentTicks[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_WORK_PER_TICK_Q16] = this.workPerTickQ16[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_SEVERITY_DELTA] = this.severityDeltas[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_PATIENT_ID] = this.patientIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_CONDITION_ID] = this.conditionIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_TREATMENT_DEF_ID] = this.treatmentDefIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STOCK_DEF_ID] = this.stockDefIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STOCK_AMOUNT] = this.stockAmounts[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_CONDITION_VERSION] = this.conditionVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_ACTOR_CONDITION_VERSION] = this.actorConditionVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_HEALTH_STORE_VERSION] = this.healthStoreVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_ABILITY_VALUE] = this.abilityValues[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_CAREGIVER_CONDITION_VERSION] =
      this.caregiverConditionVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_CAREGIVER_BASE_ABILITY_VERSION] =
      this.caregiverBaseAbilityVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STOCK_STORE_VERSION] = this.stockStoreVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_STOCK_ROW_VERSION] = this.stockRowVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_RESERVATION_VERSION] = this.reservationVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_PROGRESS_Q16] = this.progressQ16[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_JOB_GENERATION] = this.jobGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_ADOPTION_RESERVATION_VERSION] =
      this.jobCoreAdoptionReservationVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_ADOPTION_DRIVER_VERSION] =
      this.jobCoreAdoptionDriverVersions[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_ADOPTION_SLOT_VERSION] =
      this.jobCoreAdoptionSlotVersions[jobId] ?? 0;
    this.originTicks[tick + ORIGIN_CREATED_TICK] = this.createdTicks[jobId] ?? 0;
    this.originTicks[tick + ORIGIN_STEP_ENTERED_TICK] = this.stepEnteredTicks[jobId] ?? 0;
    this.originTicks[tick + ORIGIN_LAST_EFFECT_TICK] = this.lastEffectTicks[jobId] ?? 0;
    this.originTicks[tick + ORIGIN_JOB_CORE_LAST_MUTATION_TICK] =
      this.jobCoreLastMutationTicks[jobId] ?? 0;
    this.originCodes[code + ORIGIN_DELTA_APPLIED] = this.deltaApplied[jobId] ?? 0;
    this.originCodes[code + ORIGIN_STOCK_CONSUMED_ONCE] = this.stockConsumedOnce[jobId] ?? 0;
    this.originCodes[code + ORIGIN_CLEANUP_PENDING] = this.cleanupPending[jobId] ?? 0;
    this.originCodes[code + ORIGIN_EFFECT_PHASE] = this.effectPhases[jobId] ?? 0;
    this.originCodes[code + ORIGIN_TERMINAL_OUTCOME] = this.terminalOutcomeCodes[jobId] ?? 0;
    this.originCodes[code + ORIGIN_TERMINAL_FAILURE] = this.terminalFailureCodes[jobId] ?? 0;
    this.originCodes[code + ORIGIN_TERMINAL_INTERRUPTION] =
      this.terminalInterruptionCodes[jobId] ?? 0;
    this.originCodes[code + ORIGIN_STEP_CODE] = this.stepCodes[jobId] ?? 0;
    this.originCodes[code + ORIGIN_TERMINAL_REASON] = this.terminalReasons[jobId] ?? 0;
  }

  private restoreTerminalOrigin(jobId: number, slotVersion: number): void {
    const u32 = jobId * ORIGIN_U32_STRIDE;
    const tick = jobId * ORIGIN_TICK_STRIDE;
    const code = jobId * ORIGIN_CODE_STRIDE;
    this.active[jobId] = 0;
    this.caregiverIndexes[jobId] = this.originU32[u32 + ORIGIN_OWNER_INDEX] ?? 0;
    this.caregiverGenerations[jobId] = this.originU32[u32 + ORIGIN_OWNER_GENERATION] ?? 0;
    this.caregiverActorIds[jobId] = this.originU32[u32 + ORIGIN_CAREGIVER_ACTOR_ID] ?? 0;
    this.requestIds[jobId] = this.originU32[u32 + ORIGIN_REQUEST_ID] ?? 0;
    this.storageSlotIds[jobId] = this.originU32[u32 + ORIGIN_STORAGE_SLOT_ID] ?? 0;
    this.stockStackIds[jobId] = this.originU32[u32 + ORIGIN_STOCK_STACK_ID] ?? 0;
    this.stockItemIndexes[jobId] = this.originU32[u32 + ORIGIN_STOCK_ITEM_INDEX] ?? 0;
    this.stockItemGenerations[jobId] = this.originU32[u32 + ORIGIN_STOCK_ITEM_GENERATION] ?? 0;
    this.patientTargetIndexes[jobId] = this.originU32[u32 + ORIGIN_PATIENT_TARGET_INDEX] ?? 0;
    this.patientTargetGenerations[jobId] =
      this.originU32[u32 + ORIGIN_PATIENT_TARGET_GENERATION] ?? 0;
    this.patientInteractionSpotIds[jobId] =
      this.originU32[u32 + ORIGIN_PATIENT_INTERACTION_SPOT_ID] ?? 0;
    this.treatmentCellIndexes[jobId] = this.originU32[u32 + ORIGIN_TREATMENT_CELL_INDEX] ?? 0;
    this.abilities[jobId] = this.originU32[u32 + ORIGIN_ABILITY] ?? 0;
    this.minimumAbilityValues[jobId] = this.originU32[u32 + ORIGIN_MINIMUM_ABILITY_VALUE] ?? 0;
    this.treatmentTicks[jobId] = this.originU32[u32 + ORIGIN_TREATMENT_TICKS] ?? 0;
    this.workPerTickQ16[jobId] = this.originU32[u32 + ORIGIN_WORK_PER_TICK_Q16] ?? 0;
    this.severityDeltas[jobId] = this.originU32[u32 + ORIGIN_SEVERITY_DELTA] ?? 0;
    this.patientIds[jobId] = this.originU32[u32 + ORIGIN_PATIENT_ID] ?? 0;
    this.conditionIds[jobId] = this.originU32[u32 + ORIGIN_CONDITION_ID] ?? 0;
    this.treatmentDefIds[jobId] = this.originU32[u32 + ORIGIN_TREATMENT_DEF_ID] ?? 0;
    this.stockDefIds[jobId] = this.originU32[u32 + ORIGIN_STOCK_DEF_ID] ?? 0;
    this.stockAmounts[jobId] = this.originU32[u32 + ORIGIN_STOCK_AMOUNT] ?? 0;
    this.conditionVersions[jobId] = this.originU32[u32 + ORIGIN_CONDITION_VERSION] ?? 0;
    this.actorConditionVersions[jobId] = this.originU32[u32 + ORIGIN_ACTOR_CONDITION_VERSION] ?? 0;
    this.healthStoreVersions[jobId] = this.originU32[u32 + ORIGIN_HEALTH_STORE_VERSION] ?? 0;
    this.abilityValues[jobId] = this.originU32[u32 + ORIGIN_ABILITY_VALUE] ?? 0;
    this.caregiverConditionVersions[jobId] =
      this.originU32[u32 + ORIGIN_CAREGIVER_CONDITION_VERSION] ?? 0;
    this.caregiverBaseAbilityVersions[jobId] =
      this.originU32[u32 + ORIGIN_CAREGIVER_BASE_ABILITY_VERSION] ?? 0;
    this.stockStoreVersions[jobId] = this.originU32[u32 + ORIGIN_STOCK_STORE_VERSION] ?? 0;
    this.stockRowVersions[jobId] = this.originU32[u32 + ORIGIN_STOCK_ROW_VERSION] ?? 0;
    this.reservationVersions[jobId] = this.originU32[u32 + ORIGIN_RESERVATION_VERSION] ?? 0;
    this.progressQ16[jobId] = this.originU32[u32 + ORIGIN_PROGRESS_Q16] ?? 0;
    this.jobGenerations[jobId] = this.originU32[u32 + ORIGIN_JOB_GENERATION] ?? 0;
    this.jobCoreAdoptionReservationVersions[jobId] =
      this.originU32[u32 + ORIGIN_ADOPTION_RESERVATION_VERSION] ?? 0;
    this.jobCoreAdoptionDriverVersions[jobId] =
      this.originU32[u32 + ORIGIN_ADOPTION_DRIVER_VERSION] ?? 0;
    this.jobCoreAdoptionSlotVersions[jobId] =
      this.originU32[u32 + ORIGIN_ADOPTION_SLOT_VERSION] ?? 0;
    this.createdTicks[jobId] = this.originTicks[tick + ORIGIN_CREATED_TICK] ?? 0;
    this.stepEnteredTicks[jobId] = this.originTicks[tick + ORIGIN_STEP_ENTERED_TICK] ?? 0;
    this.lastEffectTicks[jobId] = this.originTicks[tick + ORIGIN_LAST_EFFECT_TICK] ?? 0;
    this.jobCoreLastMutationTicks[jobId] =
      this.originTicks[tick + ORIGIN_JOB_CORE_LAST_MUTATION_TICK] ?? 0;
    this.deltaApplied[jobId] = this.originCodes[code + ORIGIN_DELTA_APPLIED] ?? 0;
    this.stockConsumedOnce[jobId] = this.originCodes[code + ORIGIN_STOCK_CONSUMED_ONCE] ?? 0;
    this.cleanupPending[jobId] = this.originCodes[code + ORIGIN_CLEANUP_PENDING] ?? 0;
    this.effectPhases[jobId] = this.originCodes[code + ORIGIN_EFFECT_PHASE] ?? 0;
    this.terminalOutcomeCodes[jobId] = this.originCodes[code + ORIGIN_TERMINAL_OUTCOME] ?? 0;
    this.terminalFailureCodes[jobId] = this.originCodes[code + ORIGIN_TERMINAL_FAILURE] ?? 0;
    this.terminalInterruptionCodes[jobId] =
      this.originCodes[code + ORIGIN_TERMINAL_INTERRUPTION] ?? 0;
    this.stepCodes[jobId] = this.originCodes[code + ORIGIN_STEP_CODE] ?? 0;
    this.terminalReasons[jobId] = this.originCodes[code + ORIGIN_TERMINAL_REASON] ?? 0;
    this.jobSlotVersions[jobId] = slotVersion;
    this.clearStoredClaims(jobId);
    this.clearOrigin(jobId);
  }

  private clearOrigin(jobId: number): void {
    this.originPresent[jobId] = 0;
    const u32Base = jobId * ORIGIN_U32_STRIDE;
    const tickBase = jobId * ORIGIN_TICK_STRIDE;
    const codeBase = jobId * ORIGIN_CODE_STRIDE;
    for (let index = 0; index < ORIGIN_U32_STRIDE; index += 1) this.originU32[u32Base + index] = 0;
    for (let index = 0; index < ORIGIN_TICK_STRIDE; index += 1)
      this.originTicks[tickBase + index] = 0;
    for (let index = 0; index < ORIGIN_CODE_STRIDE; index += 1)
      this.originCodes[codeBase + index] = 0;
  }

  private writeMutationSuccess(
    jobId: number,
    jobCoreVersion: number,
    alreadyCommitted: boolean,
    output: M3TreatmentAdoptedMutationOutput,
  ): void {
    output.ok = true;
    output.reason = undefined;
    output.alreadyCommitted = alreadyCommitted;
    output.jobId = jobId;
    output.jobGeneration = this.jobGenerations[jobId] ?? 0;
    output.ownerIndex = this.caregiverIndexes[jobId] ?? 0;
    output.ownerGeneration = this.caregiverGenerations[jobId] ?? 0;
    output.jobSlotVersion = this.jobSlotVersions[jobId] ?? 0;
    output.jobCoreVersion = jobCoreVersion;
    output.driverVersion = this.storeVersion;
    output.step = decodeStep(this.stepCodes[jobId] ?? 0);
    output.progressQ16 = this.progressQ16[jobId] ?? 0;
    output.readyToComplete = output.progressQ16 >= this.requiredWorkFor(jobId);
    output.effectPhase = this.effectPhases[jobId] ?? 0;
    output.stockConsumedOnce = this.stockConsumedOnce[jobId] === 1;
    output.cleanupPending = this.cleanupPending[jobId] === 1;
    output.terminalOutcome = decodeTerminalOutcome(this.terminalOutcomeCodes[jobId] ?? 0);
    output.terminalFailureReason = decodeFailureReason(this.terminalFailureCodes[jobId] ?? 0);
    output.terminalInterruptionKind = decodeInterruptionKind(
      this.terminalInterruptionCodes[jobId] ?? 0,
    );
    output.releasedClaimCount = 0;
    output.healthStoreVersion = this.healthStoreVersions[jobId] ?? 0;
    output.conditionVersion = this.conditionVersions[jobId] ?? 0;
    output.actorConditionVersion = this.actorConditionVersions[jobId] ?? 0;
    output.itemStoreVersion = this.stockStoreVersions[jobId] ?? 0;
    output.itemRowVersion = this.stockRowVersions[jobId] ?? 0;
    output.reservationVersion = this.reservationVersions[jobId] ?? 0;
    output.jobReservedCount = this.committedJobOutput.reservedCount;
    output.jobActiveCount = this.committedJobOutput.activeCount;
    output.jobRunningCount = this.committedJobOutput.runningCount;
    output.jobCurrentTombstoneCount = this.committedJobOutput.currentTombstoneCount;
    output.jobCumulativeTerminalCount = this.committedJobOutput.cumulativeTerminalCount;
    output.activeCount = this.activeCount;
    output.reservedCount = this.reservedCount;
    output.pathingCount = this.pathingCount;
    output.treatingCount = this.treatingCount;
    output.completedCount = this.completedCount;
    output.canceledCount = this.canceledCount;
    output.failedCount = this.failedCount;
    output.interruptedCount = this.interruptedCount;
    output.cumulativeCompletedCount = this.cumulativeCompletedCount;
    output.cumulativeCanceledCount = this.cumulativeCanceledCount;
    output.cumulativeFailedCount = this.cumulativeFailedCount;
    output.cumulativeInterruptedCount = this.cumulativeInterruptedCount;
    output.conditionDeltaCount = this.conditionDeltaCount;
    output.stockConsumedCount = this.stockConsumedCount;
    output.reservationCleanupCount = this.cleanupCount;
    output.pathFailureCount = this.pathFailureCount;
    output.staleBasisRejectCount = this.staleRejectCount;
  }

  private writeAdoptedJobOutput(jobId: number, output: M3TreatmentAdoptedJobIntoOutput): void {
    output.ok = true;
    output.reason = undefined;
    output.active = true;
    output.jobGeneration = this.jobGenerations[jobId] ?? 0;
    output.ownerIndex = this.caregiverIndexes[jobId] ?? 0;
    output.ownerGeneration = this.caregiverGenerations[jobId] ?? 0;
    output.jobSlotVersion = this.jobSlotVersions[jobId] ?? 0;
    output.caregiverActorId = this.caregiverActorIds[jobId] ?? 0;
    output.requestId = this.requestIds[jobId] ?? 0;
    output.stockStackId = this.stockStackIds[jobId] ?? 0;
    output.storageSlotId = this.storageSlotIds[jobId] ?? 0;
    output.stockItemIndex = this.stockItemIndexes[jobId] ?? 0;
    output.stockItemGeneration = this.stockItemGenerations[jobId] ?? 0;
    output.patientTargetIndex = this.patientTargetIndexes[jobId] ?? 0;
    output.patientTargetGeneration = this.patientTargetGenerations[jobId] ?? 0;
    output.patientInteractionSpotId = this.patientInteractionSpotIds[jobId] ?? 0;
    output.treatmentCellIndex = this.treatmentCellIndexes[jobId] ?? 0;
    output.ability = this.abilities[jobId] ?? 0;
    output.minimumAbilityValue = this.minimumAbilityValues[jobId] ?? 0;
    output.treatmentTicks = this.treatmentTicks[jobId] ?? 0;
    output.workPerTickQ16 = this.workPerTickQ16[jobId] ?? 0;
    output.severityDelta = this.severityDeltas[jobId] ?? 0;
    output.createdTick = this.createdTicks[jobId] ?? 0;
    output.stepEnteredTick = this.stepEnteredTicks[jobId] ?? 0;
    output.lastEffectTick = this.lastEffectTicks[jobId] ?? 0;
    output.jobCoreLastMutationTick = this.jobCoreLastMutationTicks[jobId] ?? 0;
    output.patientId = this.patientIds[jobId] ?? 0;
    output.conditionId = this.conditionIds[jobId] ?? 0;
    output.treatmentDefId = this.treatmentDefIds[jobId] ?? 0;
    output.stockDefId = this.stockDefIds[jobId] ?? 0;
    output.stockAmount = this.stockAmounts[jobId] ?? 0;
    output.conditionVersion = this.conditionVersions[jobId] ?? 0;
    output.actorConditionVersion = this.actorConditionVersions[jobId] ?? 0;
    output.healthStoreVersion = this.healthStoreVersions[jobId] ?? 0;
    output.abilityValue = this.abilityValues[jobId] ?? 0;
    output.caregiverConditionVersion = this.caregiverConditionVersions[jobId] ?? 0;
    output.caregiverBaseAbilityVersion = this.caregiverBaseAbilityVersions[jobId] ?? 0;
    output.stockStoreVersion = this.stockStoreVersions[jobId] ?? 0;
    output.reservationVersion = this.reservationVersions[jobId] ?? 0;
    output.jobCoreAdoptionReservationVersion = this.jobCoreAdoptionReservationVersions[jobId] ?? 0;
    output.jobCoreAdoptionDriverVersion = this.jobCoreAdoptionDriverVersions[jobId] ?? 0;
    output.jobCoreAdoptionSlotVersion = this.jobCoreAdoptionSlotVersions[jobId] ?? 0;
    output.progressQ16 = this.progressQ16[jobId] ?? 0;
    output.deltaApplied = this.deltaApplied[jobId] === 1;
    output.stockConsumedOnce = this.stockConsumedOnce[jobId] === 1;
    output.cleanupPending = this.cleanupPending[jobId] === 1;
    output.effectPhase = this.effectPhases[jobId] ?? 0;
    output.terminalOutcome = decodeTerminalOutcome(this.terminalOutcomeCodes[jobId] ?? 0);
    output.terminalFailureReason = decodeFailureReason(this.terminalFailureCodes[jobId] ?? 0);
    output.terminalInterruptionKind = decodeInterruptionKind(
      this.terminalInterruptionCodes[jobId] ?? 0,
    );
    output.step = decodeStep(this.stepCodes[jobId] ?? 0);
    output.terminalReason = decodeReason(this.terminalReasons[jobId] ?? 0);
    this.writeMetricsInto(output);
    const base = jobId * CLAIM_COUNT;
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      output.claimIds[index] = this.claimIds[base + index] ?? CLAIM_NONE;
      output.claimEpochs[index] = this.claimEpochs[base + index] ?? 0;
      output.claimCreatedTicks[index] = this.claimCreatedTicks[base + index] ?? 0;
      output.claimLeaseExpiryTicks[index] = this.claimLeaseExpiryTicks[base + index] ?? 0;
    }
  }

  private writeMetricsInto(output: M3TreatmentAdoptedJobIntoOutput): void {
    output.activeCount = this.activeCount;
    output.reservedCount = this.reservedCount;
    output.pathingCount = this.pathingCount;
    output.treatingCount = this.treatingCount;
    output.completedCount = this.completedCount;
    output.canceledCount = this.canceledCount;
    output.failedCount = this.failedCount;
    output.interruptedCount = this.interruptedCount;
    output.cumulativeCompletedCount = this.cumulativeCompletedCount;
    output.cumulativeCanceledCount = this.cumulativeCanceledCount;
    output.cumulativeFailedCount = this.cumulativeFailedCount;
    output.cumulativeInterruptedCount = this.cumulativeInterruptedCount;
    output.conditionDeltaCount = this.conditionDeltaCount;
    output.stockConsumedCount = this.stockConsumedCount;
    output.reservationCleanupCount = this.cleanupCount;
    output.pathFailureCount = this.pathFailureCount;
    output.staleBasisRejectCount = this.staleRejectCount;
  }

  private writeAdoptionMetrics(output: M3TreatmentClaimAdoptionOutput): void {
    output.reservedCount = this.reservedCount;
    output.pathingCount = this.pathingCount;
    output.treatingCount = this.treatingCount;
    output.completedCount = this.completedCount;
    output.canceledCount = this.canceledCount;
    output.failedCount = this.failedCount;
    output.conditionDeltaCount = this.conditionDeltaCount;
    output.stockConsumedCount = this.stockConsumedCount;
    output.reservationCleanupCount = this.cleanupCount;
    output.pathFailureCount = this.pathFailureCount;
    output.staleBasisRejectCount = this.staleRejectCount;
  }

  private writeAdopted(
    control: ExistingClaimsAdoptionControl,
    input: M3TreatmentClaimAdoptionInput,
  ): void {
    const jobId = control.jobId;
    this.active[jobId] = 1;
    this.caregiverIndexes[jobId] = control.ownerIndex;
    this.caregiverGenerations[jobId] = control.ownerGeneration;
    this.caregiverActorIds[jobId] = input.caregiverActorId;
    this.requestIds[jobId] = input.requestId;
    this.storageSlotIds[jobId] = input.storageSlotId;
    this.stockStackIds[jobId] = input.stockStackId;
    this.stockItemIndexes[jobId] = input.stockItem.index;
    this.stockItemGenerations[jobId] = input.stockItem.generation;
    this.patientTargetIndexes[jobId] = input.patientInteractionTarget.index;
    this.patientTargetGenerations[jobId] = input.patientInteractionTarget.generation;
    this.patientInteractionSpotIds[jobId] = input.patientInteractionSpotId;
    this.treatmentCellIndexes[jobId] = input.treatmentCellIndex;
    this.abilities[jobId] = input.ability;
    this.minimumAbilityValues[jobId] = input.minimumAbilityValue;
    this.treatmentTicks[jobId] = input.treatmentTicks;
    this.workPerTickQ16[jobId] = input.workPerTickQ16;
    this.severityDeltas[jobId] = input.severityDelta;
    this.createdTicks[jobId] = control.claimCreatedTick;
    this.stepEnteredTicks[jobId] = control.adoptionTick;
    this.lastEffectTicks[jobId] = control.adoptionTick;
    this.jobCoreLastMutationTicks[jobId] = control.adoptionTick;
    this.patientIds[jobId] = input.patientId;
    this.conditionIds[jobId] = input.conditionId;
    this.treatmentDefIds[jobId] = input.treatmentDefId;
    this.stockDefIds[jobId] = input.stockDefId;
    this.stockAmounts[jobId] = input.stockAmount;
    this.conditionVersions[jobId] = input.conditionVersion;
    this.actorConditionVersions[jobId] = input.actorConditionVersion;
    this.healthStoreVersions[jobId] = input.healthStoreVersion;
    this.abilityValues[jobId] = input.abilityValue;
    this.caregiverConditionVersions[jobId] = input.caregiverConditionVersion;
    this.caregiverBaseAbilityVersions[jobId] = input.caregiverBaseAbilityVersion;
    this.stockStoreVersions[jobId] = input.stockStoreVersion;
    this.stockRowVersions[jobId] = 0;
    this.reservationVersions[jobId] = control.reservationReadVersion;
    this.jobCoreAdoptionReservationVersions[jobId] = control.reservationReadVersion;
    this.jobCoreAdoptionDriverVersions[jobId] = control.expectedDriverVersion;
    this.jobCoreAdoptionSlotVersions[jobId] = this.jobTokenOutput.slotVersion;
    this.progressQ16[jobId] = 0;
    this.deltaApplied[jobId] = 0;
    this.stockConsumedOnce[jobId] = 0;
    this.cleanupPending[jobId] = 0;
    this.effectPhases[jobId] = TREATMENT_EFFECT_NONE;
    this.terminalOutcomeCodes[jobId] = TREATMENT_OUTCOME_NONE;
    this.terminalFailureCodes[jobId] = 0;
    this.terminalInterruptionCodes[jobId] = 0;
    this.stepCodes[jobId] = TREATMENT_STEP_RESERVED;
    this.terminalReasons[jobId] = encodeReason("medical.treatment_reserved");
    this.jobGenerations[jobId] = control.jobGeneration;
    this.jobSlotVersions[jobId] = this.jobTokenOutput.slotVersion;
    const base = jobId * CLAIM_COUNT;
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      this.claimIds[base + index] = control.claimIds[index] ?? CLAIM_NONE;
      this.claimEpochs[base + index] = control.claimEpochs[index] ?? 0;
      this.claimCreatedTicks[base + index] = control.claimCreatedTick;
      this.claimLeaseExpiryTicks[base + index] = control.claimLeaseExpiryTicks[index] ?? 0;
    }
  }

  private writeCreated(
    input: M3TreatmentCreateInput,
    request: M3MedicalPatientRequestView,
    basis: {
      readonly abilityValue: number;
      readonly caregiverConditionVersion: number;
      readonly caregiverBaseAbilityVersion: number;
      readonly stockStoreVersion: number;
    },
  ): void {
    this.active[input.jobId] = 1;
    this.caregiverIndexes[input.jobId] = input.caregiver.index;
    this.caregiverGenerations[input.jobId] = input.caregiver.generation;
    this.caregiverActorIds[input.jobId] = input.caregiverActorId;
    this.requestIds[input.jobId] = input.requestId;
    this.stockStackIds[input.jobId] = input.stockStackId;
    this.stockItemIndexes[input.jobId] = 0;
    this.stockItemGenerations[input.jobId] = 0;
    this.patientTargetIndexes[input.jobId] = input.patientInteractionTarget.index;
    this.patientTargetGenerations[input.jobId] = input.patientInteractionTarget.generation;
    this.patientInteractionSpotIds[input.jobId] = input.patientInteractionSpotId;
    this.treatmentCellIndexes[input.jobId] = input.treatmentCellIndex;
    this.abilities[input.jobId] = input.ability;
    this.minimumAbilityValues[input.jobId] = input.minimumAbilityValue;
    this.treatmentTicks[input.jobId] = input.treatmentTicks;
    this.workPerTickQ16[input.jobId] = input.workPerTickQ16;
    this.severityDeltas[input.jobId] = input.severityDelta;
    this.createdTicks[input.jobId] = input.createdTick;
    this.stepEnteredTicks[input.jobId] = input.createdTick;
    this.lastEffectTicks[input.jobId] = input.createdTick;
    this.jobCoreLastMutationTicks[input.jobId] = input.createdTick;
    this.jobGenerations[input.jobId] = 0;
    this.jobSlotVersions[input.jobId] = 0;
    const claimBase = input.jobId * CLAIM_COUNT;
    for (let index = 0; index < CLAIM_COUNT; index += 1) {
      this.claimIds[claimBase + index] = CLAIM_NONE;
      this.claimEpochs[claimBase + index] = 0;
      this.claimCreatedTicks[claimBase + index] = 0;
      this.claimLeaseExpiryTicks[claimBase + index] = 0;
    }
    this.patientIds[input.jobId] = request.patientId;
    this.conditionIds[input.jobId] = request.conditionId;
    this.treatmentDefIds[input.jobId] = request.treatmentDefId;
    this.stockDefIds[input.jobId] = request.stockDefId;
    this.stockAmounts[input.jobId] = request.stockAmount;
    this.conditionVersions[input.jobId] = request.conditionVersion;
    this.actorConditionVersions[input.jobId] = request.actorConditionVersion;
    this.healthStoreVersions[input.jobId] = request.healthStoreVersion;
    this.abilityValues[input.jobId] = basis.abilityValue;
    this.caregiverConditionVersions[input.jobId] = basis.caregiverConditionVersion;
    this.caregiverBaseAbilityVersions[input.jobId] = basis.caregiverBaseAbilityVersion;
    this.stockStoreVersions[input.jobId] = basis.stockStoreVersion;
    this.reservationVersions[input.jobId] = 0;
    this.progressQ16[input.jobId] = 0;
    this.deltaApplied[input.jobId] = 0;
    this.stepCodes[input.jobId] = TREATMENT_STEP_CREATED;
    this.terminalReasons[input.jobId] = 0;
  }

  private validateCreate(
    input: M3TreatmentCreateInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3TreatmentReason } {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "medical.job_id_out_of_range" };
    }
    if (
      !isPositiveSafeInteger(input.treatmentTicks) ||
      !isPositiveSafeInteger(input.workPerTickQ16)
    ) {
      return { ok: false, reason: "medical.rejected_invalid_condition" };
    }
    if (!isSeverity(input.severityDelta)) {
      return { ok: false, reason: "medical.rejected_invalid_condition" };
    }
    return { ok: true };
  }

  private validateActive(
    jobId: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3TreatmentReason } {
    if (!this.isActive(jobId)) {
      return {
        ok: false,
        reason: isIndexInRange(jobId, this.capacity)
          ? "medical.job_not_active"
          : "medical.job_id_out_of_range",
      };
    }
    return { ok: true };
  }

  private validateStep(
    jobId: number,
    expected: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3TreatmentReason } {
    const active = this.validateActive(jobId);
    if (!active.ok) {
      return active;
    }
    if ((this.stepCodes[jobId] ?? 0) !== expected) {
      return { ok: false, reason: "medical.step_invalid" };
    }
    return { ok: true };
  }

  private finish(jobId: number, reason: M3TreatmentReason): M3TreatmentMutationResult {
    this.storeVersion += 1;
    return { ok: true, reason, jobId, version: this.storeVersion };
  }

  private isActive(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && this.active[jobId] === 1;
  }

  private isTerminal(jobId: number): boolean {
    const step = this.stepCodes[jobId] ?? 0;
    return (
      step === TREATMENT_STEP_COMPLETED ||
      step === TREATMENT_STEP_CANCELED ||
      step === TREATMENT_STEP_FAILED
    );
  }

  private readCaregiver(jobId: number): EntityId {
    return {
      index: this.caregiverIndexes[jobId] ?? 0,
      generation: this.caregiverGenerations[jobId] ?? 0,
    };
  }

  private readPatientTarget(jobId: number): EntityId {
    return {
      index: this.patientTargetIndexes[jobId] ?? 0,
      generation: this.patientTargetGenerations[jobId] ?? 0,
    };
  }
}

export function createM3TreatmentJobStore(capacity: number): M3TreatmentJobStore {
  return new M3TreatmentJobStore(capacity);
}

export function createM3TreatmentJobHashFields(
  snapshot: M3TreatmentStoreSnapshot,
  prefix = "m3Treatment",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [];
  const topValues = treatmentSnapshotTopValues(snapshot);
  for (let index = 0; index < TREATMENT_SNAPSHOT_TOP_KEYS.length - 1; index += 1) {
    fields.push({
      name: `${prefix}.${TREATMENT_SNAPSHOT_TOP_KEYS[index] ?? "unknown"}`,
      value: topValues[index] ?? 0,
    });
  }
  for (let jobId = 0; jobId < snapshot.rows.length; jobId += 1) {
    const row = snapshot.rows[jobId];
    if (row === undefined) continue;
    const values = treatmentSnapshotRowValues(row);
    for (let index = 0; index < TREATMENT_ROW_SCALAR_KEYS.length; index += 1) {
      fields.push({
        name: `${prefix}.row.${String(jobId)}.${TREATMENT_ROW_SCALAR_KEYS[index] ?? "unknown"}`,
        value: values[index] ?? 0,
      });
    }
    for (let claim = 0; claim < CLAIM_COUNT; claim += 1) {
      fields.push({
        name: `${prefix}.row.${String(jobId)}.claimId.${String(claim)}`,
        value: row.claimIds[claim] ?? 0,
      });
      fields.push({
        name: `${prefix}.row.${String(jobId)}.claimEpoch.${String(claim)}`,
        value: row.claimEpochs[claim] ?? 0,
      });
      fields.push({
        name: `${prefix}.row.${String(jobId)}.claimCreatedTick.${String(claim)}`,
        value: row.claimCreatedTicks[claim] ?? 0,
      });
      fields.push({
        name: `${prefix}.row.${String(jobId)}.claimLeaseExpiryTick.${String(claim)}`,
        value: row.claimLeaseExpiryTicks[claim] ?? 0,
      });
    }
    for (let index = 0; index < ORIGIN_U32_STRIDE; index += 1)
      fields.push({
        name: `${prefix}.row.${String(jobId)}.originU32.${String(index)}`,
        value: row.originU32[index] ?? 0,
      });
    for (let index = 0; index < ORIGIN_TICK_STRIDE; index += 1)
      fields.push({
        name: `${prefix}.row.${String(jobId)}.originTick.${String(index)}`,
        value: row.originTicks[index] ?? 0,
      });
    for (let index = 0; index < ORIGIN_CODE_STRIDE; index += 1)
      fields.push({
        name: `${prefix}.row.${String(jobId)}.originCode.${String(index)}`,
        value: row.originCodes[index] ?? 0,
      });
  }
  return fields;
}

const TREATMENT_SNAPSHOT_TOP_KEYS = [
  "snapshotVersion",
  "capacity",
  "storeVersion",
  "activeCount",
  "reservedCount",
  "pathingCount",
  "treatingCount",
  "completedCount",
  "canceledCount",
  "failedCount",
  "interruptedCount",
  "cumulativeCompletedCount",
  "cumulativeCanceledCount",
  "cumulativeFailedCount",
  "cumulativeInterruptedCount",
  "conditionDeltaCount",
  "stockConsumedCount",
  "reservationCleanupCount",
  "pathFailureCount",
  "staleBasisRejectCount",
  "rows",
] as const;

const TREATMENT_ROW_SCALAR_KEYS = [
  "jobId",
  "active",
  "jobGeneration",
  "jobSlotVersion",
  "ownerIndex",
  "ownerGeneration",
  "caregiverActorId",
  "requestId",
  "storageSlotId",
  "stockStackId",
  "stockItemIndex",
  "stockItemGeneration",
  "patientTargetIndex",
  "patientTargetGeneration",
  "patientInteractionSpotId",
  "treatmentCellIndex",
  "ability",
  "minimumAbilityValue",
  "treatmentTicks",
  "workPerTickQ16",
  "severityDelta",
  "createdTick",
  "stepEnteredTick",
  "lastEffectTick",
  "jobCoreLastMutationTick",
  "patientId",
  "conditionId",
  "treatmentDefId",
  "stockDefId",
  "stockAmount",
  "conditionVersion",
  "actorConditionVersion",
  "healthStoreVersion",
  "abilityValue",
  "caregiverConditionVersion",
  "caregiverBaseAbilityVersion",
  "stockStoreVersion",
  "stockRowVersion",
  "reservationVersion",
  "jobCoreAdoptionReservationVersion",
  "jobCoreAdoptionDriverVersion",
  "jobCoreAdoptionSlotVersion",
  "progressQ16",
  "deltaApplied",
  "stockConsumedOnce",
  "cleanupPending",
  "effectPhase",
  "terminalOutcomeCode",
  "terminalFailureCode",
  "terminalInterruptionCode",
  "stepCode",
  "terminalReasonCode",
  "originPresent",
] as const;

const TREATMENT_ROW_KEYS = [
  ...TREATMENT_ROW_SCALAR_KEYS,
  "originU32",
  "originTicks",
  "originCodes",
  "claimIds",
  "claimEpochs",
  "claimCreatedTicks",
  "claimLeaseExpiryTicks",
] as const;

function isM3TreatmentSnapshot(
  value: unknown,
  expectedCapacity: number,
): value is M3TreatmentStoreSnapshot {
  if (
    !isExactRecord(value, TREATMENT_SNAPSHOT_TOP_KEYS) ||
    value.snapshotVersion !== M3_TREATMENT_SNAPSHOT_VERSION ||
    value.capacity !== expectedCapacity ||
    !isUint32(value.storeVersion) ||
    !isUint32(value.activeCount) ||
    !isUint32(value.reservedCount) ||
    !isUint32(value.pathingCount) ||
    !isUint32(value.treatingCount) ||
    !isUint32(value.completedCount) ||
    !isUint32(value.canceledCount) ||
    !isUint32(value.failedCount) ||
    !isUint32(value.interruptedCount) ||
    !isUint32(value.cumulativeCompletedCount) ||
    !isUint32(value.cumulativeCanceledCount) ||
    !isUint32(value.cumulativeFailedCount) ||
    !isUint32(value.cumulativeInterruptedCount) ||
    !isUint32(value.conditionDeltaCount) ||
    !isUint32(value.stockConsumedCount) ||
    !isUint32(value.reservationCleanupCount) ||
    !isUint32(value.pathFailureCount) ||
    !isUint32(value.staleBasisRejectCount) ||
    !Array.isArray(value.rows) ||
    value.rows.length !== expectedCapacity
  )
    return false;
  let active = 0;
  let reserved = 0;
  let pathing = 0;
  let treating = 0;
  let completed = 0;
  let canceled = 0;
  let failed = 0;
  let autonomousCompleted = 0;
  let autonomousCanceled = 0;
  let autonomousFailed = 0;
  let conditionDeltaEvidence = 0;
  let stockConsumedEvidence = 0;
  let cleanupEvidence = 0;
  for (let jobId = 0; jobId < expectedCapacity; jobId += 1) {
    const row: unknown = value.rows[jobId];
    if (!isM3TreatmentSnapshotRow(row, jobId)) return false;
    active += row.active;
    reserved += row.active === 1 && row.stepCode === TREATMENT_STEP_RESERVED ? 1 : 0;
    pathing += row.active === 1 && row.stepCode === TREATMENT_STEP_PATHING ? 1 : 0;
    treating += row.active === 1 && row.stepCode === TREATMENT_STEP_TREATING ? 1 : 0;
    const legacyTerminal = row.jobGeneration === 0 && row.active === 1;
    completed +=
      (row.effectPhase === TREATMENT_EFFECT_TERMINAL &&
        row.terminalOutcomeCode === TREATMENT_OUTCOME_COMPLETED) ||
      (legacyTerminal && row.stepCode === TREATMENT_STEP_COMPLETED)
        ? 1
        : 0;
    canceled +=
      (row.effectPhase === TREATMENT_EFFECT_TERMINAL &&
        (row.terminalOutcomeCode === TREATMENT_OUTCOME_CANCELED ||
          row.terminalOutcomeCode === TREATMENT_OUTCOME_INTERRUPTED)) ||
      (legacyTerminal && row.stepCode === TREATMENT_STEP_CANCELED)
        ? 1
        : 0;
    failed +=
      (row.effectPhase === TREATMENT_EFFECT_TERMINAL &&
        row.terminalOutcomeCode === TREATMENT_OUTCOME_FAILED) ||
      (legacyTerminal && row.stepCode === TREATMENT_STEP_FAILED)
        ? 1
        : 0;
    autonomousCompleted +=
      row.effectPhase === TREATMENT_EFFECT_TERMINAL &&
      row.terminalOutcomeCode === TREATMENT_OUTCOME_COMPLETED
        ? 1
        : 0;
    autonomousCanceled +=
      row.effectPhase === TREATMENT_EFFECT_TERMINAL &&
      (row.terminalOutcomeCode === TREATMENT_OUTCOME_CANCELED ||
        row.terminalOutcomeCode === TREATMENT_OUTCOME_INTERRUPTED)
        ? 1
        : 0;
    autonomousFailed +=
      row.effectPhase === TREATMENT_EFFECT_TERMINAL &&
      row.terminalOutcomeCode === TREATMENT_OUTCOME_FAILED
        ? 1
        : 0;
    if (row.deltaApplied === 1) {
      if (conditionDeltaEvidence === UINT32_MAX) return false;
      conditionDeltaEvidence += 1;
    }
    if (
      (row.jobGeneration > 0 && row.stockConsumedOnce === 1) ||
      (row.jobGeneration === 0 &&
        row.deltaApplied === 1 &&
        row.stepCode === TREATMENT_STEP_COMPLETED)
    ) {
      if (stockConsumedEvidence > UINT32_MAX - row.stockAmount) return false;
      stockConsumedEvidence += row.stockAmount;
    }
    if (row.jobGeneration > 0 && row.effectPhase === TREATMENT_EFFECT_TERMINAL) {
      if (cleanupEvidence > UINT32_MAX - CLAIM_COUNT) return false;
      cleanupEvidence += CLAIM_COUNT;
    }
    if (row.originPresent === 1) {
      const originOutcome = row.originCodes[ORIGIN_TERMINAL_OUTCOME] ?? 0;
      completed += originOutcome === TREATMENT_OUTCOME_COMPLETED ? 1 : 0;
      canceled +=
        originOutcome === TREATMENT_OUTCOME_CANCELED ||
        originOutcome === TREATMENT_OUTCOME_INTERRUPTED
          ? 1
          : 0;
      failed += originOutcome === TREATMENT_OUTCOME_FAILED ? 1 : 0;
      autonomousCompleted += originOutcome === TREATMENT_OUTCOME_COMPLETED ? 1 : 0;
      autonomousCanceled +=
        originOutcome === TREATMENT_OUTCOME_CANCELED ||
        originOutcome === TREATMENT_OUTCOME_INTERRUPTED
          ? 1
          : 0;
      autonomousFailed += originOutcome === TREATMENT_OUTCOME_FAILED ? 1 : 0;
      if (row.originCodes[ORIGIN_DELTA_APPLIED] === 1) {
        if (conditionDeltaEvidence === UINT32_MAX) return false;
        conditionDeltaEvidence += 1;
      }
      if (row.originCodes[ORIGIN_STOCK_CONSUMED_ONCE] === 1) {
        const originStockAmount = row.originU32[ORIGIN_STOCK_AMOUNT] ?? 0;
        if (stockConsumedEvidence > UINT32_MAX - originStockAmount) return false;
        stockConsumedEvidence += originStockAmount;
      }
      if (cleanupEvidence > UINT32_MAX - CLAIM_COUNT) return false;
      cleanupEvidence += CLAIM_COUNT;
    }
  }
  return (
    value.activeCount === active &&
    value.reservedCount === reserved &&
    value.pathingCount === pathing &&
    value.treatingCount === treating &&
    value.completedCount === completed &&
    value.canceledCount === canceled &&
    value.failedCount === failed &&
    value.interruptedCount === countTreatmentInterrupted(value.rows) &&
    value.cumulativeCompletedCount >= autonomousCompleted &&
    value.cumulativeCanceledCount >= autonomousCanceled &&
    value.cumulativeFailedCount >= autonomousFailed &&
    value.cumulativeInterruptedCount >= value.interruptedCount &&
    value.cumulativeCanceledCount >= value.cumulativeInterruptedCount &&
    value.conditionDeltaCount >= conditionDeltaEvidence &&
    value.stockConsumedCount >= stockConsumedEvidence &&
    value.reservationCleanupCount >= cleanupEvidence
  );
}

function countTreatmentInterrupted(rows: readonly M3TreatmentJobSnapshotRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (
      row.effectPhase === TREATMENT_EFFECT_TERMINAL &&
      row.terminalOutcomeCode === TREATMENT_OUTCOME_INTERRUPTED
    )
      count += 1;
    if (
      row.originPresent === 1 &&
      row.originCodes[ORIGIN_TERMINAL_OUTCOME] === TREATMENT_OUTCOME_INTERRUPTED
    )
      count += 1;
  }
  return count;
}

function isM3TreatmentSnapshotRow(
  value: unknown,
  jobId: number,
): value is M3TreatmentJobSnapshotRow {
  if (
    !isExactRecord(value, TREATMENT_ROW_KEYS) ||
    value.jobId !== jobId ||
    (value.active !== 0 && value.active !== 1)
  )
    return false;
  for (let index = 2; index < TREATMENT_ROW_SCALAR_KEYS.length; index += 1) {
    const key = TREATMENT_ROW_SCALAR_KEYS[index];
    if (
      key === undefined ||
      key === "createdTick" ||
      key === "stepEnteredTick" ||
      key === "lastEffectTick" ||
      key === "jobCoreLastMutationTick"
    )
      continue;
    if (!isUint32(value[key])) return false;
  }
  if (
    !isSafeTick(value.createdTick) ||
    !isSafeTick(value.stepEnteredTick) ||
    !isSafeTick(value.lastEffectTick) ||
    !isSafeTick(value.jobCoreLastMutationTick) ||
    value.stepEnteredTick < value.createdTick ||
    value.lastEffectTick < value.createdTick ||
    !isFixedNumberLane(value.claimIds, false) ||
    !isFixedNumberLane(value.claimEpochs, false) ||
    !isFixedNumberLane(value.claimCreatedTicks, true) ||
    !isFixedNumberLane(value.claimLeaseExpiryTicks, true) ||
    !isNumberLane(value.originU32, ORIGIN_U32_STRIDE, false) ||
    !isNumberLane(value.originTicks, ORIGIN_TICK_STRIDE, true) ||
    !isNumberLane(value.originCodes, ORIGIN_CODE_STRIDE, false)
  )
    return false;
  // Every scalar and fixed lane is checked above before exposing the structural view.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const row = value as unknown as M3TreatmentJobSnapshotRow;
  if (row.jobGeneration > 0) return isValidAdoptedSnapshotRow(row);
  if (row.active === 1) return isValidLegacySnapshotRow(row);
  return isVirginTreatmentRow(row) || isRollbackTreatmentRow(row);
}

function isValidAdoptedSnapshotRow(row: M3TreatmentJobSnapshotRow): boolean {
  if (row.jobSlotVersion === 0 || !isExactAutonomousTreatmentPayload(row)) return false;
  if (!isValidTreatmentOrigin(row)) return false;
  if (row.effectPhase === TREATMENT_EFFECT_TERMINAL) return isTerminalAutonomousTreatmentRow(row);
  if (row.active !== 1) return false;
  if (row.effectPhase === TREATMENT_EFFECT_NONE) return isOrdinaryAutonomousTreatmentRow(row);
  if (row.effectPhase === TREATMENT_EFFECT_HEALTH_APPLIED) return isHealthAppliedTreatmentRow(row);
  if (row.effectPhase === TREATMENT_EFFECT_STOCK_CONSUMED) return isStockConsumedTreatmentRow(row);
  return (
    row.effectPhase === TREATMENT_EFFECT_TERMINAL_CLEANUP_PENDING &&
    isNegativeCleanupTreatmentRow(row)
  );
}

function isValidLegacySnapshotRow(row: M3TreatmentJobSnapshotRow): boolean {
  const requiredWork = row.treatmentTicks * row.workPerTickQ16;
  if (
    row.jobSlotVersion !== 0 ||
    row.stockItemIndex !== 0 ||
    row.stockItemGeneration !== 0 ||
    row.ownerGeneration === 0 ||
    row.patientTargetGeneration === 0 ||
    !isUint8(row.ability) ||
    !isUint16(row.minimumAbilityValue) ||
    !isUint16(row.severityDelta) ||
    row.severityDelta > 1000 ||
    !isUint16(row.abilityValue) ||
    !isPositiveUint32(row.treatmentTicks) ||
    !isPositiveUint32(row.workPerTickQ16) ||
    !isPositiveUint32(row.stockAmount) ||
    !Number.isSafeInteger(requiredWork) ||
    requiredWork <= 0 ||
    requiredWork > UINT32_MAX ||
    row.stepEnteredTick < row.createdTick ||
    row.lastEffectTick < row.stepEnteredTick ||
    !isValidLegacyTreatmentProgress(row, requiredWork) ||
    row.jobCoreAdoptionReservationVersion !== 0 ||
    row.jobCoreAdoptionDriverVersion !== 0 ||
    row.jobCoreAdoptionSlotVersion !== 0 ||
    row.effectPhase !== TREATMENT_EFFECT_NONE ||
    row.cleanupPending !== 0 ||
    row.stockConsumedOnce !== 0 ||
    row.originPresent !== 0 ||
    !numberLaneIsZero(row.originU32) ||
    !numberLaneIsZero(row.originTicks) ||
    !numberLaneIsZero(row.originCodes) ||
    !isExactReasonForTreatmentStep(row.stepCode, row.terminalReasonCode)
  )
    return false;
  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    if (
      row.claimIds[index] !== CLAIM_NONE ||
      row.claimEpochs[index] !== 0 ||
      row.claimCreatedTicks[index] !== 0 ||
      row.claimLeaseExpiryTicks[index] !== 0
    )
      return false;
  }
  return row.stepCode >= TREATMENT_STEP_CREATED && row.stepCode <= TREATMENT_STEP_FAILED;
}

function isValidLegacyTreatmentProgress(
  row: M3TreatmentJobSnapshotRow,
  requiredWork: number,
): boolean {
  if (row.stepCode === TREATMENT_STEP_COMPLETED)
    return row.deltaApplied === 1 && row.progressQ16 === requiredWork;
  if (row.deltaApplied !== 0) return false;
  if (
    row.stepCode === TREATMENT_STEP_CREATED ||
    row.stepCode === TREATMENT_STEP_RESERVED ||
    row.stepCode === TREATMENT_STEP_PATHING
  )
    return row.progressQ16 === 0;
  return (
    (row.stepCode === TREATMENT_STEP_TREATING ||
      row.stepCode === TREATMENT_STEP_CANCELED ||
      row.stepCode === TREATMENT_STEP_FAILED) &&
    row.progressQ16 <= requiredWork &&
    row.progressQ16 % row.workPerTickQ16 === 0
  );
}

function isVirginTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  const values = treatmentSnapshotRowValues(row);
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] !== 0) return false;
  }
  return (
    row.claimIds[0] === CLAIM_NONE &&
    row.claimIds[1] === CLAIM_NONE &&
    row.claimIds[2] === CLAIM_NONE &&
    lanesAreZero(row, true) &&
    numberLaneIsZero(row.originU32) &&
    numberLaneIsZero(row.originTicks) &&
    numberLaneIsZero(row.originCodes)
  );
}

function isRollbackTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  if (row.active !== 0 || row.jobGeneration !== 0 || row.jobSlotVersion === 0) return false;
  return (
    isExactAutonomousTreatmentPayload(row) &&
    isOrdinaryAutonomousTreatmentRow(row) &&
    row.originPresent === 0 &&
    numberLaneIsZero(row.originU32) &&
    numberLaneIsZero(row.originTicks) &&
    numberLaneIsZero(row.originCodes)
  );
}

function isExactAutonomousTreatmentPayload(row: M3TreatmentJobSnapshotRow): boolean {
  const requiredWork = row.treatmentTicks * row.workPerTickQ16;
  if (
    row.ownerGeneration === 0 ||
    row.stockItemGeneration === 0 ||
    row.patientTargetGeneration === 0 ||
    !isUint8(row.ability) ||
    !isUint16(row.minimumAbilityValue) ||
    !isUint16(row.severityDelta) ||
    row.severityDelta === 0 ||
    row.severityDelta > 1000 ||
    !isUint16(row.abilityValue) ||
    !isPositiveUint32(row.treatmentTicks) ||
    !isPositiveUint32(row.workPerTickQ16) ||
    !isPositiveUint32(row.stockAmount) ||
    !isPositiveUint32(row.reservationVersion) ||
    !Number.isSafeInteger(requiredWork) ||
    requiredWork <= 0 ||
    requiredWork > UINT32_MAX ||
    !isUint32(row.storageSlotId) ||
    !isPositiveUint32(row.jobCoreAdoptionReservationVersion) ||
    !isUint32(row.jobCoreAdoptionDriverVersion) ||
    !isPositiveUint32(row.jobCoreAdoptionSlotVersion) ||
    row.stepEnteredTick < row.createdTick
  )
    return false;
  if (!claimsAreRetainedOrClearedForPhase(row)) return false;
  return true;
}

function isOrdinaryAutonomousTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  const requiredWork = row.treatmentTicks * row.workPerTickQ16;
  if (
    row.deltaApplied !== 0 ||
    row.stockConsumedOnce !== 0 ||
    row.cleanupPending !== 0 ||
    row.terminalOutcomeCode !== TREATMENT_OUTCOME_NONE ||
    row.terminalFailureCode !== 0 ||
    row.terminalInterruptionCode !== 0 ||
    row.stockRowVersion !== 0
  )
    return false;
  if (row.stepCode === TREATMENT_STEP_RESERVED) return isReservedAutonomousTreatmentRow(row);
  if (row.stepCode === TREATMENT_STEP_PATHING)
    return (
      row.terminalReasonCode === encodeReason("medical.treatment_pathing") &&
      row.progressQ16 === 0 &&
      row.lastEffectTick >= row.stepEnteredTick
    );
  if (row.stepCode !== TREATMENT_STEP_TREATING) return false;
  return (
    row.terminalReasonCode === encodeReason("medical.treatment_started") &&
    row.progressQ16 <= requiredWork &&
    row.progressQ16 % row.workPerTickQ16 === 0 &&
    row.lastEffectTick >= row.stepEnteredTick
  );
}

function isHealthAppliedTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  return (
    row.active === 1 &&
    row.stepCode === TREATMENT_STEP_TREATING &&
    row.progressQ16 === row.treatmentTicks * row.workPerTickQ16 &&
    row.deltaApplied === 1 &&
    row.stockConsumedOnce === 0 &&
    row.cleanupPending === 0 &&
    row.terminalOutcomeCode === TREATMENT_OUTCOME_COMPLETED &&
    row.terminalFailureCode === 0 &&
    row.terminalInterruptionCode === 0 &&
    row.terminalReasonCode === encodeReason("medical.treatment_started") &&
    row.stockRowVersion === 0 &&
    row.lastEffectTick >= row.jobCoreLastMutationTick
  );
}

function isStockConsumedTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  return (
    row.active === 1 &&
    row.stepCode === TREATMENT_STEP_TREATING &&
    row.progressQ16 === row.treatmentTicks * row.workPerTickQ16 &&
    row.deltaApplied === 1 &&
    row.stockConsumedOnce === 1 &&
    row.cleanupPending === 1 &&
    row.terminalOutcomeCode === TREATMENT_OUTCOME_COMPLETED &&
    row.terminalFailureCode === 0 &&
    row.terminalInterruptionCode === 0 &&
    row.terminalReasonCode === encodeReason("medical.treatment_started") &&
    row.stockRowVersion > 0 &&
    row.lastEffectTick >= row.jobCoreLastMutationTick
  );
}

function isNegativeCleanupTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  const requiredWork = row.treatmentTicks * row.workPerTickQ16;
  const stepStateIsCanonical =
    (row.stepCode === TREATMENT_STEP_RESERVED &&
      row.terminalReasonCode === encodeReason("medical.treatment_reserved") &&
      row.progressQ16 === 0) ||
    (row.stepCode === TREATMENT_STEP_PATHING &&
      row.terminalReasonCode === encodeReason("medical.treatment_pathing") &&
      row.progressQ16 === 0) ||
    (row.stepCode === TREATMENT_STEP_TREATING &&
      row.terminalReasonCode === encodeReason("medical.treatment_started") &&
      row.progressQ16 <= requiredWork &&
      row.progressQ16 % row.workPerTickQ16 === 0);
  return (
    row.active === 1 &&
    stepStateIsCanonical &&
    row.deltaApplied === 0 &&
    row.stockConsumedOnce === 0 &&
    row.stockRowVersion === 0 &&
    row.cleanupPending === 1 &&
    isExactStoredTerminalTuple(row) &&
    row.terminalOutcomeCode !== TREATMENT_OUTCOME_COMPLETED &&
    row.lastEffectTick >= row.jobCoreLastMutationTick
  );
}

function isTerminalAutonomousTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  const completed = row.terminalOutcomeCode === TREATMENT_OUTCOME_COMPLETED;
  const requiredWork = row.treatmentTicks * row.workPerTickQ16;
  const progressIsCanonical = completed
    ? row.progressQ16 === requiredWork
    : row.progressQ16 <= requiredWork && row.progressQ16 % row.workPerTickQ16 === 0;
  return (
    row.active === 0 &&
    row.cleanupPending === 0 &&
    isExactStoredTerminalTuple(row) &&
    row.stepCode === terminalStepCodeFromStored(row.terminalOutcomeCode) &&
    row.terminalReasonCode === terminalReasonCodeFromStored(row.terminalOutcomeCode) &&
    row.deltaApplied === (completed ? 1 : 0) &&
    row.stockConsumedOnce === (completed ? 1 : 0) &&
    row.stockRowVersion > 0 === completed &&
    progressIsCanonical &&
    row.lastEffectTick === row.stepEnteredTick &&
    row.jobCoreLastMutationTick === row.stepEnteredTick &&
    claimsAreClearedInSnapshot(row)
  );
}

function claimsAreRetainedOrClearedForPhase(row: M3TreatmentJobSnapshotRow): boolean {
  if (row.effectPhase === TREATMENT_EFFECT_TERMINAL) return claimsAreClearedInSnapshot(row);
  if (
    row.claimIds[0] === row.claimIds[1] ||
    row.claimIds[0] === row.claimIds[2] ||
    row.claimIds[1] === row.claimIds[2]
  )
    return false;
  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    if (
      row.claimIds[index] === CLAIM_NONE ||
      row.claimEpochs[index] === 0 ||
      row.claimCreatedTicks[index] !== row.createdTick ||
      (row.claimLeaseExpiryTicks[index] ?? 0) < row.createdTick
    )
      return false;
  }
  return true;
}

function claimsAreClearedInSnapshot(row: M3TreatmentJobSnapshotRow): boolean {
  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    if (
      row.claimIds[index] !== CLAIM_NONE ||
      row.claimEpochs[index] !== 0 ||
      row.claimCreatedTicks[index] !== 0 ||
      row.claimLeaseExpiryTicks[index] !== 0
    )
      return false;
  }
  return true;
}

function isExactStoredTerminalTuple(row: M3TreatmentJobSnapshotRow): boolean {
  const outcome = decodeTerminalOutcome(row.terminalOutcomeCode);
  const failureReason = decodeFailureReason(row.terminalFailureCode);
  const interruptionKind = decodeInterruptionKind(row.terminalInterruptionCode);
  return (
    outcome !== undefined &&
    encodeTerminalOutcome(outcome) === row.terminalOutcomeCode &&
    encodeFailureReason(failureReason) === row.terminalFailureCode &&
    encodeInterruptionKind(interruptionKind) === row.terminalInterruptionCode &&
    isExactTreatmentTerminalTuple(outcome, failureReason, interruptionKind)
  );
}

function terminalStepCodeFromStored(outcomeCode: number): number {
  if (outcomeCode === TREATMENT_OUTCOME_COMPLETED) return TREATMENT_STEP_COMPLETED;
  if (outcomeCode === TREATMENT_OUTCOME_FAILED) return TREATMENT_STEP_FAILED;
  return TREATMENT_STEP_CANCELED;
}

function terminalReasonCodeFromStored(outcomeCode: number): number {
  const outcome = decodeTerminalOutcome(outcomeCode);
  return outcome === undefined ? 0 : terminalReasonCode(outcome);
}

function isValidTreatmentOrigin(row: M3TreatmentJobSnapshotRow): boolean {
  if (row.originPresent === 0)
    return (
      numberLaneIsZero(row.originU32) &&
      numberLaneIsZero(row.originTicks) &&
      numberLaneIsZero(row.originCodes)
    );
  if (!isTreatmentOriginPresent(row.originPresent)) return false;
  const u32 = row.originU32;
  const ticks = row.originTicks;
  const codes = row.originCodes;
  const outcomeCode = codes[ORIGIN_TERMINAL_OUTCOME] ?? 0;
  const completed = outcomeCode === TREATMENT_OUTCOME_COMPLETED;
  const requiredWork = (u32[ORIGIN_TREATMENT_TICKS] ?? 0) * (u32[ORIGIN_WORK_PER_TICK_Q16] ?? 0);
  return (
    row.active === 1 &&
    row.jobGeneration > 0 &&
    (u32[ORIGIN_JOB_GENERATION] ?? 0) > 0 &&
    (u32[ORIGIN_OWNER_GENERATION] ?? 0) > 0 &&
    (u32[ORIGIN_STOCK_ITEM_GENERATION] ?? 0) > 0 &&
    (u32[ORIGIN_PATIENT_TARGET_GENERATION] ?? 0) > 0 &&
    isUint32(u32[ORIGIN_STORAGE_SLOT_ID]) &&
    isUint8(u32[ORIGIN_ABILITY]) &&
    isUint16(u32[ORIGIN_MINIMUM_ABILITY_VALUE]) &&
    isUint16(u32[ORIGIN_SEVERITY_DELTA]) &&
    u32[ORIGIN_SEVERITY_DELTA] > 0 &&
    u32[ORIGIN_SEVERITY_DELTA] <= 1000 &&
    isUint16(u32[ORIGIN_ABILITY_VALUE]) &&
    isPositiveUint32(u32[ORIGIN_TREATMENT_TICKS] ?? 0) &&
    isPositiveUint32(u32[ORIGIN_WORK_PER_TICK_Q16] ?? 0) &&
    (u32[ORIGIN_STOCK_AMOUNT] ?? 0) > 0 &&
    (u32[ORIGIN_RESERVATION_VERSION] ?? 0) > 0 &&
    (u32[ORIGIN_ADOPTION_RESERVATION_VERSION] ?? 0) > 0 &&
    (u32[ORIGIN_ADOPTION_SLOT_VERSION] ?? 0) > 0 &&
    Number.isSafeInteger(requiredWork) &&
    requiredWork > 0 &&
    requiredWork <= UINT32_MAX &&
    isSafeTick(ticks[ORIGIN_CREATED_TICK]) &&
    isSafeTick(ticks[ORIGIN_STEP_ENTERED_TICK]) &&
    isSafeTick(ticks[ORIGIN_LAST_EFFECT_TICK]) &&
    isSafeTick(ticks[ORIGIN_JOB_CORE_LAST_MUTATION_TICK]) &&
    ticks[ORIGIN_CREATED_TICK] <= ticks[ORIGIN_STEP_ENTERED_TICK] &&
    ticks[ORIGIN_STEP_ENTERED_TICK] === ticks[ORIGIN_LAST_EFFECT_TICK] &&
    ticks[ORIGIN_LAST_EFFECT_TICK] === ticks[ORIGIN_JOB_CORE_LAST_MUTATION_TICK] &&
    codes[ORIGIN_EFFECT_PHASE] === TREATMENT_EFFECT_TERMINAL &&
    codes[ORIGIN_CLEANUP_PENDING] === 0 &&
    codes[ORIGIN_DELTA_APPLIED] === (completed ? 1 : 0) &&
    codes[ORIGIN_STOCK_CONSUMED_ONCE] === (completed ? 1 : 0) &&
    (completed
      ? (u32[ORIGIN_PROGRESS_Q16] ?? 0) === requiredWork && (u32[ORIGIN_STOCK_ROW_VERSION] ?? 0) > 0
      : (u32[ORIGIN_PROGRESS_Q16] ?? 0) <= requiredWork &&
        (u32[ORIGIN_PROGRESS_Q16] ?? 0) % (u32[ORIGIN_WORK_PER_TICK_Q16] ?? 1) === 0 &&
        (u32[ORIGIN_STOCK_ROW_VERSION] ?? 0) === 0) &&
    isExactOriginTerminalTuple(codes)
  );
}

function isTreatmentOriginPresent(value: unknown): value is 1 {
  return value === 1;
}

function isExactOriginTerminalTuple(codes: readonly number[]): boolean {
  const outcomeCode = codes[ORIGIN_TERMINAL_OUTCOME] ?? 0;
  const failureCode = codes[ORIGIN_TERMINAL_FAILURE] ?? 0;
  const interruptionCode = codes[ORIGIN_TERMINAL_INTERRUPTION] ?? 0;
  const outcome = decodeTerminalOutcome(outcomeCode);
  const failureReason = decodeFailureReason(failureCode);
  const interruptionKind = decodeInterruptionKind(interruptionCode);
  return (
    outcome !== undefined &&
    encodeTerminalOutcome(outcome) === outcomeCode &&
    encodeFailureReason(failureReason) === failureCode &&
    encodeInterruptionKind(interruptionKind) === interruptionCode &&
    isExactTreatmentTerminalTuple(outcome, failureReason, interruptionKind) &&
    codes[ORIGIN_STEP_CODE] === terminalStepCodeFromStored(outcomeCode) &&
    codes[ORIGIN_TERMINAL_REASON] === terminalReasonCodeFromStored(outcomeCode)
  );
}

function numberLaneIsZero(lane: readonly number[]): boolean {
  for (const value of lane) if (value !== 0) return false;
  return true;
}

function isReservedAutonomousTreatmentRow(row: M3TreatmentJobSnapshotRow): boolean {
  return (
    row.stepCode === TREATMENT_STEP_RESERVED &&
    row.terminalReasonCode === encodeReason("medical.treatment_reserved") &&
    row.progressQ16 === 0 &&
    row.lastEffectTick === row.stepEnteredTick
  );
}

function isExactReasonForTreatmentStep(stepCode: number, reasonCode: number): boolean {
  if (stepCode === TREATMENT_STEP_CREATED) return reasonCode === 0;
  if (stepCode === TREATMENT_STEP_RESERVED) return reasonCode === 10;
  if (stepCode === TREATMENT_STEP_PATHING) return reasonCode === 11;
  if (stepCode === TREATMENT_STEP_TREATING) return reasonCode === 12 || reasonCode === 13;
  if (stepCode === TREATMENT_STEP_COMPLETED) return reasonCode === 1;
  if (stepCode === TREATMENT_STEP_CANCELED) return reasonCode === 2;
  return (
    stepCode === TREATMENT_STEP_FAILED &&
    ((reasonCode >= 3 && reasonCode <= 9) || (reasonCode >= 20 && reasonCode <= 46))
  );
}

function lanesAreZero(row: M3TreatmentJobSnapshotRow, ignoreClaimIds: boolean): boolean {
  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    if (
      (!ignoreClaimIds && row.claimIds[index] !== 0) ||
      row.claimEpochs[index] !== 0 ||
      row.claimCreatedTicks[index] !== 0 ||
      row.claimLeaseExpiryTicks[index] !== 0
    )
      return false;
  }
  return true;
}

function isFixedNumberLane(value: unknown, safeTick: boolean): value is readonly number[] {
  if (!Array.isArray(value) || value.length !== CLAIM_COUNT) return false;
  const lane: readonly unknown[] = value;
  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    const laneValue: unknown = lane[index];
    if (safeTick ? !isSafeTick(laneValue) : !isUint32(laneValue)) return false;
  }
  return true;
}

function isNumberLane(
  value: unknown,
  expectedLength: number,
  safeTick: boolean,
): value is readonly number[] {
  if (!Array.isArray(value) || value.length !== expectedLength) return false;
  const lane: readonly unknown[] = value;
  for (let index = 0; index < expectedLength; index += 1) {
    const laneValue: unknown = lane[index];
    if (safeTick ? !isSafeTick(laneValue) : !isUint32(laneValue)) return false;
  }
  return true;
}

function isSafeTick(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function isExactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  }
  return true;
}

function treatmentSnapshotTopValues(snapshot: M3TreatmentStoreSnapshot): readonly number[] {
  return [
    snapshot.snapshotVersion,
    snapshot.capacity,
    snapshot.storeVersion,
    snapshot.activeCount,
    snapshot.reservedCount,
    snapshot.pathingCount,
    snapshot.treatingCount,
    snapshot.completedCount,
    snapshot.canceledCount,
    snapshot.failedCount,
    snapshot.interruptedCount,
    snapshot.cumulativeCompletedCount,
    snapshot.cumulativeCanceledCount,
    snapshot.cumulativeFailedCount,
    snapshot.cumulativeInterruptedCount,
    snapshot.conditionDeltaCount,
    snapshot.stockConsumedCount,
    snapshot.reservationCleanupCount,
    snapshot.pathFailureCount,
    snapshot.staleBasisRejectCount,
  ];
}

function treatmentSnapshotRowValues(row: M3TreatmentJobSnapshotRow): readonly number[] {
  return [
    row.jobId,
    row.active,
    row.jobGeneration,
    row.jobSlotVersion,
    row.ownerIndex,
    row.ownerGeneration,
    row.caregiverActorId,
    row.requestId,
    row.storageSlotId,
    row.stockStackId,
    row.stockItemIndex,
    row.stockItemGeneration,
    row.patientTargetIndex,
    row.patientTargetGeneration,
    row.patientInteractionSpotId,
    row.treatmentCellIndex,
    row.ability,
    row.minimumAbilityValue,
    row.treatmentTicks,
    row.workPerTickQ16,
    row.severityDelta,
    row.createdTick,
    row.stepEnteredTick,
    row.lastEffectTick,
    row.jobCoreLastMutationTick,
    row.patientId,
    row.conditionId,
    row.treatmentDefId,
    row.stockDefId,
    row.stockAmount,
    row.conditionVersion,
    row.actorConditionVersion,
    row.healthStoreVersion,
    row.abilityValue,
    row.caregiverConditionVersion,
    row.caregiverBaseAbilityVersion,
    row.stockStoreVersion,
    row.stockRowVersion,
    row.reservationVersion,
    row.jobCoreAdoptionReservationVersion,
    row.jobCoreAdoptionDriverVersion,
    row.jobCoreAdoptionSlotVersion,
    row.progressQ16,
    row.deltaApplied,
    row.stockConsumedOnce,
    row.cleanupPending,
    row.effectPhase,
    row.terminalOutcomeCode,
    row.terminalFailureCode,
    row.terminalInterruptionCode,
    row.stepCode,
    row.terminalReasonCode,
    row.originPresent,
  ];
}

function mapPathReason(reason: PathReason): M3TreatmentReason {
  if (reason === "path_stale_result") {
    return "path.stale_basis";
  }
  return "path.no_route_to_patient";
}

function decodeStep(code: number): M3TreatmentStep {
  if (code === TREATMENT_STEP_CREATED) {
    return "created";
  }
  if (code === TREATMENT_STEP_RESERVED) {
    return "reserved";
  }
  if (code === TREATMENT_STEP_PATHING) {
    return "pathing_to_patient";
  }
  if (code === TREATMENT_STEP_TREATING) {
    return "treating";
  }
  if (code === TREATMENT_STEP_COMPLETED) {
    return "completed";
  }
  if (code === TREATMENT_STEP_CANCELED) {
    return "canceled";
  }
  if (code === TREATMENT_STEP_FAILED) {
    return "failed";
  }
  return "unassigned";
}

function hasExactClaimsOutputShape(output: ReservationClaimsIntoOutput): boolean {
  return (
    output.channelCodes.length === 8 &&
    output.ownerIndexes.length === 8 &&
    output.ownerGenerations.length === 8 &&
    output.jobIds.length === 8 &&
    output.jobGenerations.length === 8 &&
    output.hasTargetFlags.length === 8 &&
    output.targetIndexes.length === 8 &&
    output.targetGenerations.length === 8 &&
    output.cellIndexes.length === 8 &&
    output.slotIds.length === 8 &&
    output.amounts.length === 8 &&
    output.allocationEpochs.length === 8 &&
    output.createdTicks.length === 8 &&
    output.leaseExpiryTicks.length === 8
  );
}

function isCanonicalInactiveClaim(output: ReservationClaimsIntoOutput, index: number): boolean {
  return (
    output.channelCodes[index] === 0 &&
    output.ownerIndexes[index] === CLAIM_NONE &&
    output.ownerGenerations[index] === 0 &&
    output.jobIds[index] === CLAIM_NONE &&
    output.jobGenerations[index] === 0 &&
    output.hasTargetFlags[index] === 0 &&
    output.targetIndexes[index] === CLAIM_NONE &&
    output.targetGenerations[index] === 0 &&
    output.cellIndexes[index] === CLAIM_NONE &&
    output.slotIds[index] === CLAIM_NONE &&
    output.amounts[index] === 0 &&
    output.allocationEpochs[index] === 0 &&
    output.createdTicks[index] === 0 &&
    output.leaseExpiryTicks[index] === 0
  );
}

function matchesStorageSlot(
  actual: StorageSlotIntoOutput,
  expected: StorageSlotIntoOutput,
): boolean {
  return (
    actual.ok === expected.ok &&
    actual.reason === expected.reason &&
    actual.active === expected.active &&
    actual.slotId === expected.slotId &&
    actual.storageIndex === expected.storageIndex &&
    actual.storageGeneration === expected.storageGeneration &&
    actual.stackId === expected.stackId &&
    actual.defId === expected.defId &&
    actual.capacity === expected.capacity &&
    actual.desiredQuantity === expected.desiredQuantity &&
    actual.interactionCellIndex === expected.interactionCellIndex &&
    actual.offerId === expected.offerId &&
    actual.workType === expected.workType &&
    actual.regionId === expected.regionId &&
    actual.urgencyBucket === expected.urgencyBucket &&
    actual.permissionId === expected.permissionId &&
    actual.quantity === expected.quantity &&
    actual.reservedSupply === expected.reservedSupply &&
    actual.reservedCapacity === expected.reservedCapacity &&
    actual.availableSupply === expected.availableSupply &&
    actual.availableCapacity === expected.availableCapacity &&
    actual.demandQuantity === expected.demandQuantity &&
    actual.offerActive === expected.offerActive &&
    actual.rowVersion === expected.rowVersion &&
    actual.indexVersion === expected.indexVersion &&
    actual.dirtyBacklog === expected.dirtyBacklog &&
    actual.dirtyQueued === expected.dirtyQueued &&
    actual.dirtyHead === expected.dirtyHead &&
    actual.dirtyCapacity === expected.dirtyCapacity &&
    actual.dirtyQueueIndex === expected.dirtyQueueIndex
  );
}

function matchesStorageDirtyInput(
  actual: StorageSlotIntoOutput,
  expected: StorageSlotDirtyPrepareInput,
): boolean {
  return (
    expected.slotId === actual.slotId &&
    expected.expectedRowVersion === actual.rowVersion &&
    expected.expectedIndexVersion === actual.indexVersion &&
    expected.expectedDirtyBacklog === actual.dirtyBacklog &&
    expected.expectedDirtyQueued === actual.dirtyQueued &&
    expected.expectedDirtyHead === actual.dirtyHead &&
    expected.expectedDirtyCapacity === actual.dirtyCapacity &&
    expected.expectedDirtyQueueIndex === actual.dirtyQueueIndex
  );
}

function isExactTreatmentTerminalTuple(
  outcome: unknown,
  failureReason: unknown,
  interruptionKind: unknown,
): boolean {
  if (outcome === "completed") return failureReason === "none" && interruptionKind === undefined;
  if (outcome === "canceled")
    return failureReason === "cancelled" && interruptionKind === undefined;
  if (outcome === "failed")
    return (
      isKnownJobFailureReason(failureReason) &&
      failureReason !== "none" &&
      failureReason !== "cancelled" &&
      interruptionKind === undefined
    );
  if (outcome === "interrupted")
    return (
      failureReason === "cancelled" &&
      (interruptionKind === "safe_point" || interruptionKind === "emergency")
    );
  return false;
}

function isNegativeTreatmentTerminalOutcome(
  outcome: unknown,
): outcome is "canceled" | "failed" | "interrupted" {
  return outcome === "canceled" || outcome === "failed" || outcome === "interrupted";
}

function isKnownJobFailureReason(reason: unknown): reason is JobFailureReason {
  return (
    reason === "none" ||
    reason === "permission" ||
    reason === "material" ||
    reason === "reservation" ||
    reason === "path" ||
    reason === "risk" ||
    reason === "time" ||
    reason === "target_state" ||
    reason === "cancelled"
  );
}

function terminalStatus(
  outcome: M3TreatmentAdoptedTerminalOutcome,
): "completed" | "failed" | "canceled" {
  if (outcome === "completed") return "completed";
  if (outcome === "failed") return "failed";
  return "canceled";
}

function terminalStepCode(outcome: M3TreatmentAdoptedTerminalOutcome): number {
  if (outcome === "completed") return TREATMENT_STEP_COMPLETED;
  if (outcome === "failed") return TREATMENT_STEP_FAILED;
  return TREATMENT_STEP_CANCELED;
}

function terminalReasonCode(outcome: M3TreatmentAdoptedTerminalOutcome): number {
  if (outcome === "completed") return encodeReason("medical.treatment_completed");
  if (outcome === "failed") return encodeReason("medical.rejected_invalid_condition");
  return encodeReason("medical.interrupted_safe_point");
}

function encodeTerminalOutcome(outcome: M3TreatmentAdoptedTerminalOutcome): number {
  if (outcome === "completed") return TREATMENT_OUTCOME_COMPLETED;
  if (outcome === "canceled") return TREATMENT_OUTCOME_CANCELED;
  if (outcome === "failed") return TREATMENT_OUTCOME_FAILED;
  return TREATMENT_OUTCOME_INTERRUPTED;
}

function decodeTerminalOutcome(code: number): M3TreatmentAdoptedTerminalOutcome | undefined {
  if (code === TREATMENT_OUTCOME_COMPLETED) return "completed";
  if (code === TREATMENT_OUTCOME_CANCELED) return "canceled";
  if (code === TREATMENT_OUTCOME_FAILED) return "failed";
  if (code === TREATMENT_OUTCOME_INTERRUPTED) return "interrupted";
  return undefined;
}

function encodeInterruptionKind(kind: JobInterruptionKind | undefined): number {
  if (kind === "safe_point") return 1;
  if (kind === "emergency") return 2;
  if (kind === "immediate") return 3;
  return 0;
}

function decodeInterruptionKind(code: number): JobInterruptionKind | undefined {
  if (code === 1) return "safe_point";
  if (code === 2) return "emergency";
  if (code === 3) return "immediate";
  return undefined;
}

function encodeFailureReason(reason: JobFailureReason): number {
  if (reason === "permission") return 1;
  if (reason === "material") return 2;
  if (reason === "reservation") return 3;
  if (reason === "path") return 4;
  if (reason === "risk") return 5;
  if (reason === "time") return 6;
  if (reason === "target_state") return 7;
  if (reason === "cancelled") return 8;
  return 0;
}

function decodeFailureReason(code: number): JobFailureReason {
  if (code === 1) return "permission";
  if (code === 2) return "material";
  if (code === 3) return "reservation";
  if (code === 4) return "path";
  if (code === 5) return "risk";
  if (code === 6) return "time";
  if (code === 7) return "target_state";
  if (code === 8) return "cancelled";
  return "none";
}

function encodeReason(reason: M3TreatmentReason): number {
  switch (reason) {
    case "medical.treatment_created":
      return 0;
    case "medical.treatment_reserved":
      return 10;
    case "medical.treatment_pathing":
      return 11;
    case "medical.treatment_started":
      return 12;
    case "medical.condition_delta_applied":
      return 13;
    case "medical.treatment_completed":
      return 1;
    case "medical.interrupted_safe_point":
      return 2;
    case "medical.rejected_invalid_condition":
      return 3;
    case "medical.rejected_no_stock":
      return 4;
    case "medical.rejected_stale_owner_state":
      return 5;
    case "medical.rejected_caregiver_ability":
      return 6;
    case "path.no_route_to_patient":
      return 7;
    case "path.stale_basis":
      return 8;
    case "medical.job_core_failed":
      return 9;
    case "reservation_transaction_empty":
      return 20;
    case "reservation_ledger_capacity_exhausted":
      return 21;
    case "reservation_owner_index_out_of_range":
      return 22;
    case "reservation_owner_not_alive":
      return 23;
    case "reservation_owner_generation_mismatch":
      return 24;
    case "reservation_target_index_out_of_range":
      return 25;
    case "reservation_target_not_alive":
      return 26;
    case "reservation_target_generation_mismatch":
      return 27;
    case "reservation_job_id_invalid":
      return 28;
    case "reservation_created_tick_invalid":
      return 29;
    case "reservation_lease_expiry_invalid":
      return 30;
    case "reservation_amount_invalid":
      return 31;
    case "reservation_available_amount_invalid":
      return 32;
    case "reservation_capacity_invalid":
      return 33;
    case "reservation_insufficient_amount":
      return 34;
    case "reservation_insufficient_capacity":
      return 35;
    case "reservation_cell_out_of_range":
      return 36;
    case "reservation_slot_out_of_range":
      return 37;
    case "reservation_entity_conflict":
      return 38;
    case "reservation_cell_conflict":
      return 39;
    case "reservation_interaction_conflict":
      return 40;
    case "reservation_item_quantity_conflict":
      return 41;
    case "reservation_capacity_conflict":
      return 42;
    case "reservation_duplicate_target":
      return 43;
    case "reservation_claim_id_invalid":
      return 44;
    case "reservation_claim_not_active":
      return 45;
    case "reservation_snapshot_version_unsupported":
      return 46;
    default:
      return 0;
  }
}

function decodeReason(code: number): M3TreatmentReason {
  switch (code) {
    case 10:
      return "medical.treatment_reserved";
    case 11:
      return "medical.treatment_pathing";
    case 12:
      return "medical.treatment_started";
    case 13:
      return "medical.condition_delta_applied";
    case 1:
      return "medical.treatment_completed";
    case 2:
      return "medical.interrupted_safe_point";
    case 3:
      return "medical.rejected_invalid_condition";
    case 4:
      return "medical.rejected_no_stock";
    case 5:
      return "medical.rejected_stale_owner_state";
    case 6:
      return "medical.rejected_caregiver_ability";
    case 7:
      return "path.no_route_to_patient";
    case 8:
      return "path.stale_basis";
    case 9:
      return "medical.job_core_failed";
    case 20:
      return "reservation_transaction_empty";
    case 21:
      return "reservation_ledger_capacity_exhausted";
    case 22:
      return "reservation_owner_index_out_of_range";
    case 23:
      return "reservation_owner_not_alive";
    case 24:
      return "reservation_owner_generation_mismatch";
    case 25:
      return "reservation_target_index_out_of_range";
    case 26:
      return "reservation_target_not_alive";
    case 27:
      return "reservation_target_generation_mismatch";
    case 28:
      return "reservation_job_id_invalid";
    case 29:
      return "reservation_created_tick_invalid";
    case 30:
      return "reservation_lease_expiry_invalid";
    case 31:
      return "reservation_amount_invalid";
    case 32:
      return "reservation_available_amount_invalid";
    case 33:
      return "reservation_capacity_invalid";
    case 34:
      return "reservation_insufficient_amount";
    case 35:
      return "reservation_insufficient_capacity";
    case 36:
      return "reservation_cell_out_of_range";
    case 37:
      return "reservation_slot_out_of_range";
    case 38:
      return "reservation_entity_conflict";
    case 39:
      return "reservation_cell_conflict";
    case 40:
      return "reservation_interaction_conflict";
    case 41:
      return "reservation_item_quantity_conflict";
    case 42:
      return "reservation_capacity_conflict";
    case 43:
      return "reservation_duplicate_target";
    case 44:
      return "reservation_claim_id_invalid";
    case 45:
      return "reservation_claim_not_active";
    case 46:
      return "reservation_snapshot_version_unsupported";
    default:
      return "medical.treatment_created";
  }
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isSeverity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}

function treatmentTarget(
  claims: ReservationClaimsIntoOutput,
  index: number,
  target: EntityId,
): boolean {
  return (
    claims.targetIndexes[index] === target.index &&
    claims.targetGenerations[index] === target.generation
  );
}

function isExactTreatmentClaims(
  control: ExistingClaimsAdoptionControl,
  input: M3TreatmentClaimAdoptionInput,
  claims: ReservationClaimsIntoOutput,
): boolean {
  return (
    isPositiveUint32(control.claimEpochs[0] ?? 0) &&
    isPositiveUint32(control.claimEpochs[1] ?? 0) &&
    isPositiveUint32(control.claimEpochs[2] ?? 0) &&
    claims.allocationEpochs[0] === control.claimEpochs[0] &&
    claims.allocationEpochs[1] === control.claimEpochs[1] &&
    claims.allocationEpochs[2] === control.claimEpochs[2] &&
    input.readClaimEpochs[0] === control.claimEpochs[0] &&
    input.readClaimEpochs[1] === control.claimEpochs[1] &&
    input.readClaimEpochs[2] === control.claimEpochs[2] &&
    control.claimIds[0] !== control.claimIds[1] &&
    control.claimIds[0] !== control.claimIds[2] &&
    control.claimIds[1] !== control.claimIds[2] &&
    claims.channelCodes[0] === RESERVATION_ITEM_QUANTITY &&
    claims.channelCodes[1] === RESERVATION_INTERACTION_SPOT &&
    claims.channelCodes[2] === RESERVATION_CELL &&
    claims.hasTargetFlags[0] === 1 &&
    claims.hasTargetFlags[1] === 1 &&
    claims.hasTargetFlags[2] === 0 &&
    treatmentTarget(claims, 0, input.stockItem) &&
    treatmentTarget(claims, 1, input.patientInteractionTarget) &&
    claims.targetIndexes[2] === CLAIM_NONE &&
    claims.targetGenerations[2] === 0 &&
    claims.cellIndexes[0] === CLAIM_NONE &&
    claims.cellIndexes[1] === CLAIM_NONE &&
    claims.cellIndexes[2] === input.treatmentCellIndex &&
    claims.slotIds[0] === CLAIM_NONE &&
    claims.slotIds[1] === input.patientInteractionSpotId &&
    claims.slotIds[2] === CLAIM_NONE &&
    claims.amounts[0] === input.stockAmount &&
    claims.amounts[1] === 0 &&
    claims.amounts[2] === 0 &&
    claims.createdTicks[0] === control.claimCreatedTick &&
    claims.createdTicks[1] === control.claimCreatedTick &&
    claims.createdTicks[2] === control.claimCreatedTick
  );
}

function isExactTreatmentRollbackControl(control: NewlyAdoptedRollbackControl): boolean {
  if (
    control.claimCount !== CLAIM_COUNT ||
    control.claimIds.length !== 8 ||
    control.claimEpochs.length !== 8 ||
    control.claimLeaseExpiryTicks.length !== 8 ||
    !isSafeTick(control.claimCreatedTick) ||
    !isSafeTick(control.adoptionTick) ||
    control.adoptionTick < control.claimCreatedTick
  )
    return false;
  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    if (
      (control.claimIds[index] ?? CLAIM_NONE) === CLAIM_NONE ||
      (control.claimEpochs[index] ?? 0) === 0 ||
      (control.claimLeaseExpiryTicks[index] ?? 0) < control.claimCreatedTick
    )
      return false;
  }
  for (let index = CLAIM_COUNT; index < 8; index += 1) {
    if (
      control.claimIds[index] !== CLAIM_NONE ||
      control.claimEpochs[index] !== 0 ||
      control.claimLeaseExpiryTicks[index] !== 0
    )
      return false;
  }
  return true;
}

function resetTreatmentAdoptedJobOutput(
  output: M3TreatmentAdoptedJobIntoOutput,
  jobId: number,
  driverVersion: number,
): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.jobId = jobId;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.jobSlotVersion = 0;
  output.driverVersion = driverVersion;
  output.caregiverActorId = 0;
  output.requestId = 0;
  output.stockStackId = 0;
  output.storageSlotId = 0;
  output.stockItemIndex = 0;
  output.stockItemGeneration = 0;
  output.patientTargetIndex = 0;
  output.patientTargetGeneration = 0;
  output.patientInteractionSpotId = 0;
  output.treatmentCellIndex = 0;
  output.ability = 0;
  output.minimumAbilityValue = 0;
  output.treatmentTicks = 0;
  output.workPerTickQ16 = 0;
  output.severityDelta = 0;
  output.createdTick = 0;
  output.stepEnteredTick = 0;
  output.lastEffectTick = 0;
  output.jobCoreLastMutationTick = 0;
  output.patientId = 0;
  output.conditionId = 0;
  output.treatmentDefId = 0;
  output.stockDefId = 0;
  output.stockAmount = 0;
  output.conditionVersion = 0;
  output.actorConditionVersion = 0;
  output.healthStoreVersion = 0;
  output.abilityValue = 0;
  output.caregiverConditionVersion = 0;
  output.caregiverBaseAbilityVersion = 0;
  output.stockStoreVersion = 0;
  output.reservationVersion = 0;
  output.jobCoreAdoptionReservationVersion = 0;
  output.jobCoreAdoptionDriverVersion = 0;
  output.jobCoreAdoptionSlotVersion = 0;
  output.progressQ16 = 0;
  output.deltaApplied = false;
  output.stockConsumedOnce = false;
  output.cleanupPending = false;
  output.effectPhase = TREATMENT_EFFECT_NONE;
  output.terminalOutcome = undefined;
  output.terminalFailureReason = "none";
  output.terminalInterruptionKind = undefined;
  output.step = "unassigned";
  output.terminalReason = "medical.treatment_created";
  output.activeCount = 0;
  output.reservedCount = 0;
  output.pathingCount = 0;
  output.treatingCount = 0;
  output.completedCount = 0;
  output.canceledCount = 0;
  output.failedCount = 0;
  output.interruptedCount = 0;
  output.cumulativeCompletedCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
  output.cumulativeInterruptedCount = 0;
  output.conditionDeltaCount = 0;
  output.stockConsumedCount = 0;
  output.reservationCleanupCount = 0;
  output.pathFailureCount = 0;
  output.staleBasisRejectCount = 0;
  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    if (index < output.claimIds.length) output.claimIds[index] = CLAIM_NONE;
    if (index < output.claimEpochs.length) output.claimEpochs[index] = 0;
    if (index < output.claimCreatedTicks.length) output.claimCreatedTicks[index] = 0;
    if (index < output.claimLeaseExpiryTicks.length) output.claimLeaseExpiryTicks[index] = 0;
  }
}

function treatmentAdoptionVersionReason(
  control: ExistingClaimsAdoptionControl,
  driverVersion: number,
  jobCoreVersion: number,
): string | undefined {
  if (control.expectedDriverVersion !== driverVersion) return "medical.driver_version_mismatch";
  if (driverVersion > 0xffff_fffd) return "medical.driver_version_exhausted";
  if (control.expectedJobCoreVersion !== jobCoreVersion) return "job_version_mismatch";
  if (!isUint32(control.expectedJobSlotVersion) || control.expectedJobSlotVersion > 0xffff_fffc)
    return "job_slot_version_exhausted";
  if (jobCoreVersion > 0xffff_fffc) return "job_core_version_exhausted";
  return undefined;
}

function treatmentRollbackVersionReason(
  control: NewlyAdoptedRollbackControl,
  driverVersion: number,
  jobCoreVersion: number,
): string | undefined {
  if (control.expectedAdoptedDriverVersion !== driverVersion)
    return "medical.driver_version_mismatch";
  if (driverVersion > 0xffff_fffe) return "medical.driver_version_exhausted";
  if (
    !isUint32(control.expectedAdoptedJobSlotVersion) ||
    control.expectedAdoptedJobSlotVersion > 0xffff_fffd
  )
    return "job_slot_version_exhausted";
  if (!isUint32(control.expectedJobCoreVersion) || control.expectedJobCoreVersion > 0xffff_fffc)
    return "job_core_version_exhausted";
  if (jobCoreVersion !== control.expectedJobCoreVersion + 1) return "job_version_mismatch";
  if (jobCoreVersion > 0xffff_fffd) return "job_core_version_exhausted";
  return undefined;
}

function isUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= UINT32_MAX
  );
}

function isPositiveUint32(value: number): boolean {
  return isUint32(value) && value > 0;
}

function canReplaceUint32Count(current: number, removed: number, added: number): boolean {
  return current >= removed && current - removed <= UINT32_MAX - added;
}

function isUint16(value: unknown): value is number {
  return isUint32(value) && value <= 0xffff;
}

function isUint8(value: unknown): value is number {
  return isUint32(value) && value <= 0xff;
}

function createTreatmentAutonomyMutationOutput(): AutonomyJobMutationIntoOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: CLAIM_NONE,
    jobGeneration: 0,
    slotVersion: 0,
    version: 0,
    progressQ16: 0,
    readyToComplete: false,
  };
}

function createTreatmentPreparedProgress(): PreparedAutonomyProgress {
  return {
    ok: false,
    reason: undefined,
    jobId: CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    tick: 0,
    workDeltaQ16: 0,
    nextStepTickCount: 0,
    nextProgressQ16: 0,
    readyToComplete: false,
    nextSlotVersion: 0,
    nextJobCoreVersion: 0,
  };
}

function createTreatmentPreparedTerminal(): PreparedAutonomyTerminal {
  return {
    ok: false,
    reason: undefined,
    jobId: CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    expectedSlotVersion: 0,
    expectedJobCoreVersion: 0,
    tick: 0,
    statusCode: 0,
    failureReasonCode: 0,
    effectPhase: 0,
    nextSlotVersion: 0,
    nextJobCoreVersion: 0,
  };
}

function createTreatmentHealthReadOutput(): M3HealthConditionIntoOutput {
  return {
    ok: false,
    conditionId: CLAIM_NONE,
    actorId: 0,
    defId: 0,
    kind: 0,
    bodyPart: 0,
    severity: 0,
    ageTicks: 0,
    sourceId: 0,
    componentFlags: 0,
    clueRef: 0,
    counterevidenceRef: 0,
    terminalState: 0,
    affectedAbilityMask: 0,
    storeVersion: 0,
    conditionVersion: 0,
    actorConditionVersion: 0,
    updateCount: 0,
    invalidationCount: 0,
    dirtyWriteCursor: 0,
    dirtyCount: 0,
    dirtyPeak: 0,
    dirtyCapacity: 0,
  };
}

function createTreatmentPreparedHealth(): PreparedM3HealthTreatmentConditionDelta {
  return {
    ok: false,
    reason: "condition.not_active",
    conditionId: CLAIM_NONE,
    actorId: 0,
    abilityMask: 0,
    previousSeverity: 0,
    nextSeverity: 0,
    previousTerminalState: 0,
    nextTerminalState: 0,
    previousStoreVersion: 0,
    nextStoreVersion: 0,
    previousConditionVersion: 0,
    nextConditionVersion: 0,
    previousActorConditionVersion: 0,
    nextActorConditionVersion: 0,
    previousUpdateCount: 0,
    nextUpdateCount: 0,
    previousInvalidationCount: 0,
    nextInvalidationCount: 0,
    previousDirtyWriteCursor: 0,
    nextDirtyWriteCursor: 0,
    previousDirtyCount: 0,
    nextDirtyCount: 0,
    previousDirtyPeak: 0,
    nextDirtyPeak: 0,
    invalidationWriteCount: 0,
  };
}

function createTreatmentItemReadOutput(): ItemStackIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    stackId: CLAIM_NONE,
    entityIndex: 0,
    entityGeneration: 0,
    defId: 0,
    quantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    capacity: 0,
    rowVersion: 0,
    storeVersion: 0,
    reservationVersion: 0,
  };
}

function createTreatmentPreparedItemRemoval(): PreparedItemStackQuantityRemoval {
  return {
    ok: false,
    reason: undefined,
    stackId: CLAIM_NONE,
    entityIndex: 0,
    entityGeneration: 0,
    defId: 0,
    amount: 0,
    previousQuantity: 0,
    nextQuantity: 0,
    capacity: 0,
    previousRowVersion: 0,
    nextRowVersion: 0,
    previousStoreVersion: 0,
    nextStoreVersion: 0,
    reservationVersion: 0,
  };
}

function createTreatmentStorageReadOutput(): StorageSlotIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    slotId: 0,
    storageIndex: 0,
    storageGeneration: 0,
    stackId: 0,
    defId: 0,
    capacity: 0,
    desiredQuantity: 0,
    interactionCellIndex: 0,
    offerId: 0,
    workType: 0,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
    quantity: 0,
    reservedSupply: 0,
    reservedCapacity: 0,
    availableSupply: 0,
    availableCapacity: 0,
    demandQuantity: 0,
    offerActive: false,
    rowVersion: 0,
    indexVersion: 0,
    dirtyBacklog: 0,
    dirtyQueued: false,
    dirtyHead: 0,
    dirtyCapacity: 0,
    dirtyQueueIndex: 0,
  };
}

function createTreatmentPreparedStorageDirty(): PreparedStorageSlotDirty {
  return {
    ok: false,
    reason: undefined,
    slotId: 0,
    alreadyQueued: false,
    queueIndex: 0,
    rowVersion: 0,
    indexVersion: 0,
    previousDirtyBacklog: 0,
    nextDirtyBacklog: 0,
    previousDirtyHead: 0,
    nextDirtyHead: 0,
    dirtyCapacity: 0,
  };
}

function createTreatmentReleaseOutput(): ReservationReleaseIntoOutput {
  return {
    ok: false,
    reason: undefined,
    claimIndex: CLAIM_NONE,
    claimId: CLAIM_NONE,
    releasedCount: 0,
    version: 0,
    activeCount: 0,
  };
}

function createTreatmentCommittedJobOutput(): AutonomyCommittedJobIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    jobKind: 0,
    targetId: 0,
    status: undefined,
    step: "unassigned",
    interruptionPolicy: "never",
    failureReason: "none",
    createdTick: 0,
    stepEnteredTick: 0,
    stepTickCount: 0,
    progressQ16: 0,
    requiredWorkQ16: 0,
    carriedDefId: CLAIM_NONE,
    carriedAmount: 0,
    slotVersion: 0,
    version: 0,
    activeCount: 0,
    runningCount: 0,
    reservedCount: 0,
    currentTombstoneCount: 0,
    cumulativeTerminalCount: 0,
    backlogCount: 0,
    state: "free",
    terminalEffectPhase: 0,
    lastMutationTick: 0,
  };
}

function resetTreatmentMutationOutput(output: M3TreatmentAdoptedMutationOutput): void {
  output.ok = false;
  output.reason = undefined;
  output.alreadyCommitted = false;
  output.jobId = CLAIM_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.jobSlotVersion = 0;
  output.jobCoreVersion = 0;
  output.driverVersion = 0;
  output.step = "unassigned";
  output.progressQ16 = 0;
  output.readyToComplete = false;
  output.effectPhase = TREATMENT_EFFECT_NONE;
  output.stockConsumedOnce = false;
  output.cleanupPending = false;
  output.terminalOutcome = undefined;
  output.terminalFailureReason = "none";
  output.terminalInterruptionKind = undefined;
  output.releasedClaimCount = 0;
  output.healthStoreVersion = 0;
  output.conditionVersion = 0;
  output.actorConditionVersion = 0;
  output.itemStoreVersion = 0;
  output.itemRowVersion = 0;
  output.reservationVersion = 0;
  output.jobReservedCount = 0;
  output.jobActiveCount = 0;
  output.jobRunningCount = 0;
  output.jobCurrentTombstoneCount = 0;
  output.jobCumulativeTerminalCount = 0;
  output.activeCount = 0;
  output.reservedCount = 0;
  output.pathingCount = 0;
  output.treatingCount = 0;
  output.completedCount = 0;
  output.canceledCount = 0;
  output.failedCount = 0;
  output.interruptedCount = 0;
  output.cumulativeCompletedCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
  output.cumulativeInterruptedCount = 0;
  output.conditionDeltaCount = 0;
  output.stockConsumedCount = 0;
  output.reservationCleanupCount = 0;
  output.pathFailureCount = 0;
  output.staleBasisRejectCount = 0;
}

function createTreatmentTokenOutput(): JobTokenIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: 0xffff_ffff,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    ownerOccupied: false,
    ownerLegacyLiveCount: 0,
    state: "free",
    originState: "free",
    slotVersion: 0,
    version: 0,
    slotGenerationCounter: 0,
    originShadowPresent: false,
    originJobGeneration: 0,
    originOwnerIndex: 0,
    originOwnerGeneration: 0,
    originJobKind: 0,
    originTargetId: 0,
    originStatus: undefined,
    originFailureReason: "none",
    originCreatedTick: 0,
    originTerminalTick: 0,
    originEffectPhase: 0,
    terminalEffectPhase: 0,
    reservedCount: 0,
    activeCount: 0,
    runningCount: 0,
    currentTombstoneCount: 0,
    cumulativeTerminalCount: 0,
  };
}

function writeTreatmentSuccess(
  token: JobTokenIntoOutput,
  driverVersion: number,
  activeCount: number,
  output: M3TreatmentClaimAdoptionOutput,
): void {
  output.ok = true;
  output.jobId = token.jobId;
  output.jobGeneration = token.jobGeneration;
  output.jobSlotVersion = token.slotVersion;
  output.jobCoreVersion = token.version;
  output.driverVersion = driverVersion;
  output.activeCount = activeCount;
  output.ownerIndex = token.ownerIndex;
  output.ownerGeneration = token.ownerGeneration;
  output.jobActiveCount = token.activeCount;
  output.jobReservedCount = token.reservedCount;
  output.jobRunningCount = token.runningCount;
  output.jobCurrentTombstoneCount = token.currentTombstoneCount;
  output.jobCumulativeTerminalCount = token.cumulativeTerminalCount;
}

function resetTreatmentAdoptionOutput(output: M3TreatmentClaimAdoptionOutput): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = CLAIM_NONE;
  output.jobGeneration = 0;
  output.jobSlotVersion = 0;
  output.jobCoreVersion = 0;
  output.driverVersion = 0;
  output.activeCount = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.jobActiveCount = 0;
  output.jobReservedCount = 0;
  output.jobRunningCount = 0;
  output.jobCurrentTombstoneCount = 0;
  output.jobCumulativeTerminalCount = 0;
  output.reservedCount = 0;
  output.pathingCount = 0;
  output.treatingCount = 0;
  output.completedCount = 0;
  output.canceledCount = 0;
  output.failedCount = 0;
  output.conditionDeltaCount = 0;
  output.stockConsumedCount = 0;
  output.reservationCleanupCount = 0;
  output.pathFailureCount = 0;
  output.staleBasisRejectCount = 0;
}
