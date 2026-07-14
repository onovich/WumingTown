import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import {
  commitPreparedAutonomyProgress,
  commitPreparedAutonomyTerminal,
  matchesAutonomyOriginTerminalScalars,
  rollbackAndReleaseRunningAutonomyJobScalarsInto,
  type AutonomyCommittedJobIntoOutput,
  type AutonomyJobMutationIntoOutput,
  type JobCoreReason,
  type JobCoreStore,
  type JobFailureReason,
  type JobInterruptionKind,
  type JobInterruptionPolicy,
  type JobTokenIntoOutput,
  type PreparedAutonomyProgress,
  type PreparedAutonomyTerminal,
} from "./job-core";
import {
  isExactAdoptionClaimPrefix,
  resetDriverAdoptionOutput,
  type DriverAdoptionOutput,
  type ExistingClaimsAdoptionControl,
  type NewlyAdoptedRollbackControl,
} from "./autonomy-claim-facts";
import {
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_VALUE_MAX,
  commitPreparedChangedNeedLaneMutation,
  commitPreparedNoopNeedLaneMutation,
  type NeedDirtySink,
  type NeedLaneMutationPrepareInput,
  type NeedReason,
  type NeedStore,
  type PreparedNeedLaneMutation,
} from "./m3-needs";
import type { M3EnvironmentProjection, M3ScheduleWindowId } from "./m3-environment-data";
import type { MapGrid } from "./map-grid";
import {
  type GridPathfinder,
  type PathCandidate,
  type PathSearchResult,
  type PathVersionBasis,
  resolveTopKPathCandidates,
} from "./pathing";
import {
  RESERVATION_ENTITY,
  RESERVATION_INTERACTION_SPOT,
  type ReservationAcquireIntoOutput,
  type ReservationAcquireIntoScratch,
  type ReservationClaimRequest,
  type ReservationClaimsIntoOutput,
  type ReservationLedger,
  type ReservationReason,
  type ReservationReleaseIntoOutput,
} from "./reservation-ledger";
import { isSafeTick, type Tick } from "./time";
import type { CanonicalWorldField } from "./world-hash";

export const M3_REST_SLEEP_STORE_VERSION = 2;
export const M3_REST_SLEEP_TRACE_CAPACITY = 64;
export const M3_REST_FIXTURE_NONE = 0xffff_ffff;
export const M3_REST_SLEEP_JOB_KIND = 4;
export const M3_REST_DEFAULT_CANDIDATE_CAP = 24;
export const M3_REST_DEFAULT_SELECTED_CAP = 12;
export const M3_REST_DEFAULT_EXACT_PATH_CAP = 4;
export const M3_REST_URGENCY_THRESHOLD = 260;
export const M3_REST_EMERGENCY_THRESHOLD = 180;

const REST_KIND_REST = 0;
const REST_KIND_SLEEP = 1;
const REST_KIND_COUNT = 2;

const WEATHER_EXPOSURE_INDOOR = 0;
const WEATHER_EXPOSURE_OUTDOOR = 1;
const WEATHER_EXPOSURE_COUNT = 2;

const SCHEDULE_DAWN = 0;
const SCHEDULE_DAYTIME = 1;
const SCHEDULE_EVENING = 2;
const SCHEDULE_NIGHT = 3;
const SCHEDULE_COUNT = 4;

const REST_JOB_INACTIVE = 0;
const REST_JOB_CREATED = 1;
const REST_JOB_PATHING_TO_FIXTURE = 2;
const REST_JOB_RESTING = 3;
const REST_JOB_SLEEPING = 4;
const REST_JOB_COMPLETE = 5;
const REST_JOB_FAILED = 6;
const REST_JOB_CANCELLED = 7;

const REST_EFFECT_NONE = 0;
const REST_EFFECT_RECOVERY_APPLIED = 1;
const REST_EFFECT_CLEANUP_PENDING = 2;
const REST_EFFECT_TERMINAL = 3;

const REST_PENDING_NONE = 0;
const REST_PENDING_COMPLETE = 1;
const REST_PENDING_CANCELED = 2;
const REST_PENDING_FAILED = 3;
const REST_PENDING_INTERRUPTED = 4;

const REST_REASON_NONE = 0;
const REST_REASON_SELECTED = 1;
const REST_REASON_COMPLETED = 2;
const REST_REASON_NO_SPOT = 3;
const REST_REASON_SCHEDULE = 4;
const REST_REASON_WEATHER = 5;
const REST_REASON_PATH = 6;
const REST_REASON_RESERVATION = 7;
const REST_REASON_ABILITY = 8;
const REST_REASON_EMERGENCY = 9;
const REST_REASON_NOT_TIRED = 10;
const REST_REASON_INTERRUPTED = 11;
const REST_REASON_INTERRUPT_DENIED = 12;
const REST_REASON_CANDIDATE_CAP = 13;
const REST_REASON_JOB_CORE = 14;
const REST_REASON_NEED = 15;
const REST_REASON_STEP = 16;
const REST_REASON_FIXTURE_ID_OUT_OF_RANGE = 17;
const REST_REASON_FIXTURE_ALREADY_ACTIVE = 18;
const REST_REASON_FIXTURE_NOT_ACTIVE = 19;
const REST_REASON_FIXTURE_ENTITY_INVALID = 20;
const REST_REASON_FIXTURE_INPUT_INVALID = 21;
const REST_REASON_JOB_ID_OUT_OF_RANGE = 22;
const REST_REASON_JOB_ALREADY_ACTIVE = 23;
const REST_REASON_JOB_NOT_ACTIVE = 24;
const REST_REASON_TICK_INVALID = 25;
const REST_REASON_CANCELLED = 26;
const REST_REASON_RESERVATION_BASE = 64;

export type RestKind = "rest" | "sleep";
export type RestFixtureKind = "clinic_mat" | "bedroll";
export type RestFixtureWeatherExposure = "indoor" | "outdoor";

export type RestSleepReason =
  | "rest.none"
  | "rest.selected_indexed_path"
  | "rest.completed"
  | "rest.cancelled"
  | "rest.rejected_no_indexed_candidate"
  | "rest.rejected_schedule_window"
  | "rest.rejected_weather_exposure"
  | "path.no_route_to_rest_fixture"
  | "rest.rejected_reservation"
  | "rest.rejected_ability"
  | "rest.rejected_emergency_need"
  | "rest.rejected_actor_not_tired"
  | "job.interrupted_safe_point"
  | "job.interruption_denied"
  | "trace.candidate_cap_reached"
  | "rest.job_core_failed"
  | "rest.need_update_failed"
  | "rest.step_invalid"
  | "rest.fixture_id_out_of_range"
  | "rest.fixture_already_active"
  | "rest.fixture_not_active"
  | "rest.fixture_entity_invalid"
  | "rest.fixture_input_invalid"
  | "rest.job_id_out_of_range"
  | "rest.job_already_active"
  | "rest.job_not_active"
  | "rest.tick_invalid"
  | ReservationReason;

const RESERVATION_REASON_VALUES: readonly string[] = [
  "reservation_transaction_empty",
  "reservation_ledger_capacity_exhausted",
  "reservation_owner_index_out_of_range",
  "reservation_owner_not_alive",
  "reservation_owner_generation_mismatch",
  "reservation_target_index_out_of_range",
  "reservation_target_not_alive",
  "reservation_target_generation_mismatch",
  "reservation_job_id_invalid",
  "reservation_created_tick_invalid",
  "reservation_lease_expiry_invalid",
  "reservation_amount_invalid",
  "reservation_available_amount_invalid",
  "reservation_capacity_invalid",
  "reservation_insufficient_amount",
  "reservation_insufficient_capacity",
  "reservation_cell_out_of_range",
  "reservation_slot_out_of_range",
  "reservation_entity_conflict",
  "reservation_cell_conflict",
  "reservation_interaction_conflict",
  "reservation_item_quantity_conflict",
  "reservation_capacity_conflict",
  "reservation_duplicate_target",
  "reservation_claim_id_invalid",
  "reservation_claim_not_active",
  "reservation_snapshot_version_unsupported",
];

export type RestSleepMutationResult =
  | { readonly ok: true; readonly id: number; readonly version: number }
  | { readonly ok: false; readonly reason: RestSleepReason };

export type RestSelectionResult =
  | {
      readonly ok: true;
      readonly actorId: number;
      readonly fixtureId: number;
      readonly selectedPath: PathSearchResult;
      readonly candidateTotal: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly exactPathCount: number;
      readonly nodeExpansions: number;
      readonly candidateCapHit: boolean;
      readonly exactPathCapHit: boolean;
      readonly traceSequence: number;
      readonly reason: Extract<RestSleepReason, "rest.selected_indexed_path">;
    }
  | {
      readonly ok: false;
      readonly actorId: number;
      readonly candidateTotal: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly exactPathCount: number;
      readonly nodeExpansions: number;
      readonly traceSequence: number;
      readonly reason: RestSleepReason;
    };

export interface RestFixtureInput {
  readonly fixtureId: number;
  readonly entity: EntityId;
  readonly kind: RestFixtureKind;
  readonly restKind: RestKind;
  readonly regionId: number;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly weatherExposure: RestFixtureWeatherExposure;
  readonly permissionId: number;
  readonly recoveryPerTickQ16: number;
  readonly baseScoreMilli: number;
}

export interface RestFixtureView extends RestFixtureInput {
  readonly ownerVersion: number;
}

export interface RestFixtureIntoOutput {
  ok: boolean;
  reason: RestSleepReason | undefined;
  fixtureId: number;
  active: boolean;
  entityIndex: number;
  entityGeneration: number;
  kind: RestFixtureKind | undefined;
  restKind: RestKind | undefined;
  regionId: number;
  targetCellIndex: number;
  interactionSpotId: number;
  scheduleWindow: M3ScheduleWindowId | undefined;
  weatherExposure: RestFixtureWeatherExposure | undefined;
  permissionId: number;
  recoveryPerTickQ16: number;
  baseScoreMilli: number;
  ownerVersion: number;
  storeVersion: number;
}

export interface RestSleepMetrics {
  readonly version: number;
  readonly activeFixtureCount: number;
  readonly activeJobCount: number;
  readonly candidateIndexedCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
  readonly selectionCount: number;
  readonly candidateVisitedCount: number;
  readonly exactPathRequestCount: number;
  readonly pathFailureCount: number;
  readonly reservationAttemptCount: number;
  readonly reservationFailureCount: number;
  readonly cleanupReleaseCount: number;
  readonly completedJobCount: number;
  readonly cancelledJobCount: number;
  readonly failedJobCount: number;
  readonly interruptedJobCount: number;
}

export interface RestCandidateIndexOptions {
  readonly fixtureCapacity: number;
  readonly regionCapacity: number;
  readonly permissionCapacity: number;
}

export interface RestCandidateQuery {
  readonly regionId: number;
  readonly restKind: RestKind;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly weatherExposure: RestFixtureWeatherExposure;
  readonly permissionId: number;
  readonly candidateCap: number;
  readonly maxSelectedFixtures: number;
}

export interface RestCandidateEnvironmentBasis {
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly scheduleWindowVersion: number;
  readonly weatherExposure: RestFixtureWeatherExposure;
  readonly outdoorWorkAllowed: boolean;
  readonly weatherVersion: number;
  readonly weatherSourceVersion: number;
}

export interface RestCandidateSelectionIntoScratch {
  readonly fixtureReadOutput: RestFixtureIntoOutput;
  readonly fixtureIds: Uint32Array;
  readonly entityIndexes: Uint32Array;
  readonly entityGenerations: Uint32Array;
  readonly fixtureKindCodes: Uint8Array;
  readonly restKindCodes: Uint8Array;
  readonly regionIds: Uint32Array;
  readonly targetCellIndexes: Uint32Array;
  readonly interactionSpotIds: Uint32Array;
  readonly scheduleCodes: Uint8Array;
  readonly weatherCodes: Uint8Array;
  readonly permissionIds: Uint32Array;
  readonly recoveryPerTickQ16s: Uint32Array;
  readonly scoreMillis: Uint32Array;
  readonly cachedFixtureVersions: Uint32Array;
  readonly currentFixtureOwnerVersions: Uint32Array;
  readonly linkedCandidateFlags: Uint8Array;
}

export interface RestCandidateSelectionIntoOutput {
  ok: boolean;
  reason: RestSleepReason | undefined;
  queryRegionId: number;
  queryRestKind: RestKind | undefined;
  queryScheduleWindow: M3ScheduleWindowId | undefined;
  queryWeatherExposure: RestFixtureWeatherExposure | undefined;
  queryPermissionId: number;
  candidateCap: number;
  maxSelectedFixtures: number;
  environmentScheduleWindow: M3ScheduleWindowId | undefined;
  scheduleWindowVersion: number;
  environmentWeatherExposure: RestFixtureWeatherExposure | undefined;
  outdoorWorkAllowed: boolean;
  weatherVersion: number;
  weatherSourceVersion: number;
  candidateTotal: number;
  visitedCount: number;
  selectedCount: number;
  candidateCapHit: boolean;
  selectedCapHit: boolean;
  selectedFixtureId: number;
  selectedEntityIndex: number;
  selectedEntityGeneration: number;
  selectedFixtureKind: RestFixtureKind | undefined;
  selectedRestKind: RestKind | undefined;
  selectedRegionId: number;
  selectedTargetCellIndex: number;
  selectedInteractionSpotId: number;
  selectedScheduleWindow: M3ScheduleWindowId | undefined;
  selectedWeatherExposure: RestFixtureWeatherExposure | undefined;
  selectedPermissionId: number;
  selectedRecoveryPerTickQ16: number;
  selectedScoreMilli: number;
  selectedCachedFixtureVersion: number;
  selectedCurrentFixtureOwnerVersion: number;
  selectedLinkedCandidate: boolean;
  restStoreVersion: number;
  sourceVersion: number;
  indexVersion: number;
  dirtyBacklog: number;
}

export type RestCandidateQueryResult =
  | {
      readonly ok: true;
      readonly reason: RestSleepReason;
      readonly candidateTotal: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly sourceVersion: number;
      readonly indexVersion: number;
      readonly traceSequence: number;
    }
  | { readonly ok: false; readonly reason: RestSleepReason };

export interface RestSelectionInput {
  readonly actorId: number;
  readonly originCellIndex: number;
  readonly regionId: number;
  readonly restKind: RestKind;
  readonly permissionId: number;
  readonly issuedTick: Tick;
  readonly requestSequenceStart: number;
  readonly needStore: NeedStore;
  readonly environment: M3EnvironmentProjection;
  readonly restStore: RestSleepStore;
  readonly restIndex: RestCandidateIndex;
  readonly pathfinder: GridPathfinder;
  readonly grid: MapGrid;
  readonly pathBasis: PathVersionBasis;
  readonly outputFixtureIds: Uint32Array;
  readonly pathCandidateScratch: PathCandidate[];
  readonly traceStore?: RestSleepTraceStore;
  readonly actorCanRest?: boolean;
  readonly weatherExposure?: RestFixtureWeatherExposure;
  readonly emergencyNeedThreshold?: number;
  readonly restUrgencyThreshold?: number;
  readonly candidateCap?: number;
  readonly maxSelectedFixtures?: number;
  readonly maxExactPaths?: number;
  readonly maxNodeExpansions?: number;
}

export interface RestJobCreateInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly restKind: RestKind;
  readonly recoveryTargetValue: number;
  readonly recoveryPerTickQ16: number;
  readonly createdTick: Tick;
  readonly interruptionPolicy?: "never" | "at_safe_point" | "immediate" | "emergency_only";
}

export interface RestClaimAdoptionInput extends RestJobCreateInput {
  readonly fixtureEntity: EntityId;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly environmentVersion: number;
  readonly needOwnerVersion: number;
  readonly currentRestValue: number;
  readonly readClaimIds: Uint32Array;
  readonly readClaimEpochs: Uint32Array;
  readonly claims: ReservationClaimsIntoOutput;
}

export interface RestClaimAdoptionOutput extends DriverAdoptionOutput {
  ownerIndex: number;
  ownerGeneration: number;
  jobCoreReservedCount: number;
  jobCoreActiveCount: number;
  jobCoreRunningCount: number;
  jobCoreCurrentTombstoneCount: number;
  jobCoreCumulativeTerminalCount: number;
  driverPathingCount: number;
  driverRecoveringCount: number;
  driverCompletedCount: number;
  driverCanceledCount: number;
  driverFailedCount: number;
  driverInterruptedCount: number;
  reservationAttemptCount: number;
  reservationFailureCount: number;
  cleanupReleaseCount: number;
  cumulativeCompletedCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  cumulativeInterruptedCount: number;
}

export interface RestAdoptedJobIntoOutput {
  ok: boolean;
  reason: RestSleepReason | undefined;
  active: boolean;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  jobSlotVersion: number;
  jobCoreStepTickCount: number;
  jobCoreAdoptionReservationVersion: number;
  jobCoreAdoptionDriverVersion: number;
  jobCoreAdoptionSlotVersion: number;
  driverVersion: number;
  actorId: number;
  fixtureId: number;
  restKind: RestKind | undefined;
  step: RestJobStep;
  targetCellIndex: number;
  interactionSpotId: number;
  scheduleWindow: M3ScheduleWindowId | undefined;
  environmentVersion: number;
  needOwnerVersion: number;
  lastNeedExpectedValue: number;
  lastNeedDelta: number;
  lastNeedExpectedStoreVersion: number;
  lastNeedExpectedLaneVersion: number;
  lastNeedNextStoreVersion: number;
  lastNeedChanged: number;
  reservationVersion: number;
  readonly claimIds: Uint32Array;
  readonly claimEpochs: Uint32Array;
  readonly claimCreatedTicks: Float64Array;
  readonly claimLeaseExpiryTicks: Float64Array;
  createdTick: number;
  recoveryTargetValue: number;
  recoveryPerTickQ16: number;
  recoveryProgressQ16: number;
  stepEnteredTick: number;
  lastEffectTick: number;
  effectPhase: number;
  cleanupPending: number;
  pendingOutcome: number;
  pendingReason: RestSleepReason | undefined;
  pendingFailure: JobFailureReason;
  pendingInterruption: JobInterruptionKind | undefined;
  interruptionPolicy: JobInterruptionPolicy;
  returnedOnce: number;
  readyToComplete: boolean;
  terminalReason: RestSleepReason;
  terminalOutcome: RestAdoptedTerminalOutcome | undefined;
  activeCount: number;
  pathingCount: number;
  recoveringCount: number;
  completedCount: number;
  canceledCount: number;
  failedCount: number;
  interruptedCount: number;
  reservationAttemptCount: number;
  reservationFailureCount: number;
  cleanupReleaseCount: number;
  cumulativeCompletedCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  cumulativeInterruptedCount: number;
}

export interface RestAdoptedMutationInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly tick: Tick;
}

export interface RestNewlyAdoptedRollbackControl extends NewlyAdoptedRollbackControl {
  readonly expectedActorId: number;
  readonly expectedFixtureId: number;
  readonly expectedRestKind: RestKind;
  readonly expectedTargetCellIndex: number;
  readonly expectedInteractionSpotId: number;
  readonly expectedScheduleWindow: M3ScheduleWindowId;
  readonly expectedEnvironmentVersion: number;
  readonly expectedNeedOwnerVersion: number;
  readonly expectedRecoveryTargetValue: number;
  readonly expectedRecoveryPerTickQ16: number;
  readonly expectedInterruptionPolicy: JobInterruptionPolicy;
  readonly expectedRequiredWorkQ16: number;
}

export interface RestAdoptedTickInput extends RestAdoptedMutationInput {
  readonly needMutation: NeedLaneMutationPrepareInput;
}

export type RestAdoptedTerminalOutcome = "completed" | "canceled" | "failed" | "interrupted";

export interface RestAdoptedTerminalInput extends RestAdoptedMutationInput {
  readonly expectedCurrentLedgerVersion: number;
  readonly outcome: RestAdoptedTerminalOutcome;
  readonly failureReason: JobFailureReason;
  readonly interruptionKind?: JobInterruptionKind;
  readonly terminalReason: RestSleepReason;
}

export interface RestResumeCleanupInput extends RestAdoptedMutationInput {
  readonly expectedCurrentLedgerVersion: number;
  readonly outcome: RestAdoptedTerminalOutcome;
  readonly failureReason: JobFailureReason;
  readonly interruptionKind?: JobInterruptionKind;
  readonly terminalReason: RestSleepReason;
}

export interface RestAdoptedMutationOutput {
  ok: boolean;
  reason: RestSleepReason | ReservationReason | JobCoreReason | NeedReason | undefined;
  jobId: number;
  jobGeneration: number;
  jobSlotVersion: number;
  jobCoreVersion: number;
  driverVersion: number;
  reservationVersion: number;
  needLaneVersion: number;
  needStoreVersion: number;
  cleanupPending: boolean;
  alreadyCommitted: boolean;
  readyToComplete: boolean;
  releasedClaimCount: number;
  terminalOutcome: RestAdoptedTerminalOutcome | undefined;
  ownerIndex: number;
  ownerGeneration: number;
  jobCoreReservedCount: number;
  jobCoreActiveCount: number;
  jobCoreRunningCount: number;
  jobCoreCurrentTombstoneCount: number;
  jobCoreCumulativeTerminalCount: number;
  driverActiveCount: number;
  driverPathingCount: number;
  driverRecoveringCount: number;
  driverCompletedCount: number;
  driverCanceledCount: number;
  driverFailedCount: number;
  driverInterruptedCount: number;
  reservationAttemptCount: number;
  reservationFailureCount: number;
  cleanupReleaseCount: number;
  cumulativeCompletedCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  cumulativeInterruptedCount: number;
}

export type RestJobStep =
  | "inactive"
  | "created"
  | "pathing_to_fixture"
  | "resting"
  | "sleeping"
  | "complete"
  | "failed"
  | "cancelled";

export interface RestJobView {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly restKind: RestKind;
  readonly step: RestJobStep;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly environmentVersion: number;
  readonly needOwnerVersion: number;
  readonly reservationVersion: number;
  readonly fixtureClaimId: number;
  readonly interactionClaimId: number;
  readonly recoveryTargetValue: number;
  readonly recoveryPerTickQ16: number;
  readonly recoveryProgressQ16: number;
  readonly stepEnteredTick: Tick;
  readonly terminalReason: RestSleepReason;
}

export interface RestJobDriverSnapshotOrigin {
  readonly present: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly restKindCode: number;
  readonly stepCode: number;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scheduleCode: number;
  readonly environmentVersion: number;
  readonly needOwnerVersion: number;
  readonly lastNeedExpectedValue: number;
  readonly lastNeedDelta: number;
  readonly lastNeedExpectedStoreVersion: number;
  readonly lastNeedExpectedLaneVersion: number;
  readonly lastNeedNextStoreVersion: number;
  readonly lastNeedChanged: number;
  readonly reservationVersion: number;
  readonly jobGeneration: number;
  readonly jobSlotVersion: number;
  readonly jobCoreStepTickCount: number;
  readonly jobCoreAdoptionReservationVersion: number;
  readonly jobCoreAdoptionDriverVersion: number;
  readonly jobCoreAdoptionSlotVersion: number;
  readonly createdTick: number;
  readonly recoveryTargetValue: number;
  readonly recoveryPerTickQ16: number;
  readonly recoveryProgressQ16: number;
  readonly stepEnteredTick: number;
  readonly lastEffectTick: number;
  readonly effectPhase: number;
  readonly interruptionPolicyCode: number;
  readonly requiredWorkQ16: number;
  readonly readyToComplete: number;
  readonly terminalReasonCode: number;
  readonly terminalOutcome: number;
  readonly terminalFailureCode: number;
  readonly terminalInterruptionCode: number;
}

export interface RestJobDriverSnapshotRow {
  readonly jobId: number;
  readonly active: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly restKindCode: number;
  readonly stepCode: number;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scheduleCode: number;
  readonly environmentVersion: number;
  readonly needOwnerVersion: number;
  readonly lastNeedExpectedValue: number;
  readonly lastNeedDelta: number;
  readonly lastNeedExpectedStoreVersion: number;
  readonly lastNeedExpectedLaneVersion: number;
  readonly lastNeedNextStoreVersion: number;
  readonly lastNeedChanged: number;
  readonly reservationVersion: number;
  readonly claimIds: readonly number[];
  readonly claimEpochs: readonly number[];
  readonly claimCreatedTicks: readonly number[];
  readonly claimLeaseExpiryTicks: readonly number[];
  readonly jobGeneration: number;
  readonly jobSlotVersion: number;
  readonly jobCoreStepTickCount: number;
  readonly jobCoreAdoptionReservationVersion: number;
  readonly jobCoreAdoptionDriverVersion: number;
  readonly jobCoreAdoptionSlotVersion: number;
  readonly createdTick: number;
  readonly recoveryTargetValue: number;
  readonly recoveryPerTickQ16: number;
  readonly recoveryProgressQ16: number;
  readonly stepEnteredTick: number;
  readonly lastEffectTick: number;
  readonly effectPhase: number;
  readonly interruptionPolicyCode: number;
  readonly requiredWorkQ16: number;
  readonly readyToComplete: number;
  readonly cleanupPending: number;
  readonly pendingOutcome: number;
  readonly pendingReasonCode: number;
  readonly pendingFailureCode: number;
  readonly pendingInterruptionCode: number;
  readonly returnedOnce: number;
  readonly terminalReasonCode: number;
  readonly terminalOutcome: number;
  readonly origin: RestJobDriverSnapshotOrigin;
}

export interface RestJobDriverSnapshot {
  readonly snapshotVersion: typeof M3_REST_SLEEP_STORE_VERSION;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly pathingCount: number;
  readonly recoveringCount: number;
  readonly completedCount: number;
  readonly canceledCount: number;
  readonly failedCount: number;
  readonly interruptedCount: number;
  readonly reservationAttemptCount: number;
  readonly reservationFailureCount: number;
  readonly cleanupReleaseCount: number;
  readonly cumulativeCompletedCount: number;
  readonly cumulativeCanceledCount: number;
  readonly cumulativeFailedCount: number;
  readonly cumulativeInterruptedCount: number;
  readonly rows: readonly RestJobDriverSnapshotRow[];
}

export interface RestTraceInput {
  readonly tick: Tick;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly candidateTotal: number;
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly exactPathCount: number;
  readonly exactPathCap: number;
  readonly nodeExpansions: number;
  readonly sourceRestVersion: number;
  readonly environmentVersion: number;
  readonly reservationVersion: number;
  readonly reason: RestSleepReason;
}

export interface RestTraceView extends RestTraceInput {
  readonly sequence: number;
}

export class RestSleepStore {
  readonly fixtureCapacity: number;
  readonly regionCapacity: number;
  readonly permissionCapacity: number;

  private readonly active: Uint8Array;
  private readonly entityIndexes: Uint32Array;
  private readonly entityGenerations: Uint32Array;
  private readonly kindCodes: Uint8Array;
  private readonly restKindCodes: Uint8Array;
  private readonly regionIds: Uint32Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly interactionSpotIds: Uint32Array;
  private readonly scheduleCodes: Uint8Array;
  private readonly weatherCodes: Uint8Array;
  private readonly permissionIds: Uint32Array;
  private readonly recoveryPerTickQ16: Uint32Array;
  private readonly baseScoreMilli: Uint32Array;
  private readonly ownerVersions: Uint32Array;
  private activeFixtureCount = 0;
  private storeVersion = 0;

  constructor(fixtureCapacity: number, regionCapacity: number, permissionCapacity: number) {
    assertValidCapacity(fixtureCapacity, "rest fixture capacity");
    assertValidCapacity(regionCapacity, "rest region capacity");
    assertValidCapacity(permissionCapacity, "rest permission capacity");
    this.fixtureCapacity = fixtureCapacity;
    this.regionCapacity = regionCapacity;
    this.permissionCapacity = permissionCapacity;
    this.active = new Uint8Array(fixtureCapacity);
    this.entityIndexes = new Uint32Array(fixtureCapacity);
    this.entityGenerations = new Uint32Array(fixtureCapacity);
    this.kindCodes = new Uint8Array(fixtureCapacity);
    this.restKindCodes = new Uint8Array(fixtureCapacity);
    this.regionIds = new Uint32Array(fixtureCapacity);
    this.targetCellIndexes = new Uint32Array(fixtureCapacity);
    this.interactionSpotIds = new Uint32Array(fixtureCapacity);
    this.scheduleCodes = new Uint8Array(fixtureCapacity);
    this.weatherCodes = new Uint8Array(fixtureCapacity);
    this.permissionIds = new Uint32Array(fixtureCapacity);
    this.recoveryPerTickQ16 = new Uint32Array(fixtureCapacity);
    this.baseScoreMilli = new Uint32Array(fixtureCapacity);
    this.ownerVersions = new Uint32Array(fixtureCapacity);
  }

  get version(): number {
    return this.storeVersion;
  }

  get activeCount(): number {
    return this.activeFixtureCount;
  }

  registerFixture(input: RestFixtureInput, registry?: EntityRegistry): RestSleepMutationResult {
    const validation = this.validateFixtureInput(input, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.fixtureId] ?? 0) === 1) {
      return { ok: false, reason: "rest.fixture_already_active" };
    }

    this.active[input.fixtureId] = 1;
    this.entityIndexes[input.fixtureId] = input.entity.index;
    this.entityGenerations[input.fixtureId] = input.entity.generation;
    this.kindCodes[input.fixtureId] = encodeFixtureKind(input.kind);
    this.restKindCodes[input.fixtureId] = encodeRestKind(input.restKind);
    this.regionIds[input.fixtureId] = input.regionId;
    this.targetCellIndexes[input.fixtureId] = input.targetCellIndex;
    this.interactionSpotIds[input.fixtureId] = input.interactionSpotId;
    this.scheduleCodes[input.fixtureId] = encodeScheduleWindow(input.scheduleWindow);
    this.weatherCodes[input.fixtureId] = encodeWeatherExposure(input.weatherExposure);
    this.permissionIds[input.fixtureId] = input.permissionId;
    this.recoveryPerTickQ16[input.fixtureId] = input.recoveryPerTickQ16;
    this.baseScoreMilli[input.fixtureId] = input.baseScoreMilli;
    this.activeFixtureCount += 1;
    this.storeVersion += 1;
    this.ownerVersions[input.fixtureId] = this.storeVersion;
    return { ok: true, id: input.fixtureId, version: this.storeVersion };
  }

  removeFixture(fixtureId: number): RestSleepMutationResult {
    if (!this.isFixtureActive(fixtureId)) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    this.active[fixtureId] = 0;
    this.activeFixtureCount -= 1;
    this.storeVersion += 1;
    this.ownerVersions[fixtureId] = this.storeVersion;
    return { ok: true, id: fixtureId, version: this.storeVersion };
  }

  readFixture(fixtureId: number): RestFixtureView | undefined {
    if (!this.isFixtureActive(fixtureId)) {
      return undefined;
    }

    return {
      fixtureId,
      entity: this.readFixtureEntity(fixtureId),
      kind: decodeFixtureKind(this.kindCodes[fixtureId] ?? 0),
      restKind: decodeRestKind(this.restKindCodes[fixtureId] ?? 0),
      regionId: this.regionIds[fixtureId] ?? 0,
      targetCellIndex: this.targetCellIndexes[fixtureId] ?? 0,
      interactionSpotId: this.interactionSpotIds[fixtureId] ?? 0,
      scheduleWindow: decodeScheduleWindow(this.scheduleCodes[fixtureId] ?? 0),
      weatherExposure: decodeWeatherExposure(this.weatherCodes[fixtureId] ?? 0),
      permissionId: this.permissionIds[fixtureId] ?? 0,
      recoveryPerTickQ16: this.recoveryPerTickQ16[fixtureId] ?? 0,
      baseScoreMilli: this.baseScoreMilli[fixtureId] ?? 0,
      ownerVersion: this.ownerVersions[fixtureId] ?? 0,
    };
  }

  readFixtureInto(fixtureId: number, output: RestFixtureIntoOutput): void {
    this.resetFixtureInto(fixtureId, output);
    if (!isIndexInRange(fixtureId, this.fixtureCapacity)) {
      output.reason = "rest.fixture_id_out_of_range";
      return;
    }
    if ((this.active[fixtureId] ?? 0) !== 1) {
      output.reason = "rest.fixture_not_active";
      return;
    }

    output.ok = true;
    output.active = true;
    output.entityIndex = this.entityIndexes[fixtureId] ?? 0;
    output.entityGeneration = this.entityGenerations[fixtureId] ?? 0;
    output.kind = decodeFixtureKind(this.kindCodes[fixtureId] ?? 0);
    output.restKind = decodeRestKind(this.restKindCodes[fixtureId] ?? 0);
    output.regionId = this.regionIds[fixtureId] ?? 0;
    output.targetCellIndex = this.targetCellIndexes[fixtureId] ?? 0;
    output.interactionSpotId = this.interactionSpotIds[fixtureId] ?? 0;
    output.scheduleWindow = decodeScheduleWindow(this.scheduleCodes[fixtureId] ?? 0);
    output.weatherExposure = decodeWeatherExposure(this.weatherCodes[fixtureId] ?? 0);
    output.permissionId = this.permissionIds[fixtureId] ?? 0;
    output.recoveryPerTickQ16 = this.recoveryPerTickQ16[fixtureId] ?? 0;
    output.baseScoreMilli = this.baseScoreMilli[fixtureId] ?? 0;
    output.ownerVersion = this.ownerVersions[fixtureId] ?? 0;
  }

  isFixtureActive(fixtureId: number): boolean {
    return isIndexInRange(fixtureId, this.fixtureCapacity) && (this.active[fixtureId] ?? 0) === 1;
  }

  readFixtureEntity(fixtureId: number): EntityId {
    return {
      index: this.entityIndexes[fixtureId] ?? 0,
      generation: this.entityGenerations[fixtureId] ?? 0,
    };
  }

  readFixtureBaseScore(fixtureId: number): number {
    return this.baseScoreMilli[fixtureId] ?? 0;
  }

  readFixtureOwnerVersion(fixtureId: number): number {
    return this.ownerVersions[fixtureId] ?? 0;
  }

  readFixtureBucketKey(fixtureId: number): number {
    if (!this.isFixtureActive(fixtureId)) {
      return -1;
    }

    return createRestBucketKey(
      this.regionIds[fixtureId] ?? 0,
      this.restKindCodes[fixtureId] ?? 0,
      this.scheduleCodes[fixtureId] ?? 0,
      this.weatherCodes[fixtureId] ?? 0,
      this.permissionIds[fixtureId] ?? 0,
      this.regionCapacity,
      this.permissionCapacity,
    );
  }

  createMetrics(): Pick<RestSleepMetrics, "version" | "activeFixtureCount"> {
    return { version: this.storeVersion, activeFixtureCount: this.activeFixtureCount };
  }

  private validateFixtureInput(
    input: RestFixtureInput,
    registry: EntityRegistry | undefined,
  ): RestSleepMutationResult {
    if (!isIndexInRange(input.fixtureId, this.fixtureCapacity)) {
      return { ok: false, reason: "rest.fixture_id_out_of_range" };
    }

    if (registry !== undefined && !registry.isAlive(input.entity)) {
      return { ok: false, reason: "rest.fixture_entity_invalid" };
    }

    if (
      !isIndexInRange(input.regionId, this.regionCapacity) ||
      !isSafeUint32(input.targetCellIndex) ||
      !isSafeUint32(input.interactionSpotId) ||
      !isIndexInRange(input.permissionId, this.permissionCapacity) ||
      !isPositiveUint32(input.recoveryPerTickQ16) ||
      !isSafeUint32(input.baseScoreMilli)
    ) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    return { ok: true, id: input.fixtureId, version: this.storeVersion };
  }

  private resetFixtureInto(fixtureId: number, output: RestFixtureIntoOutput): void {
    output.ok = false;
    output.reason = undefined;
    output.fixtureId = fixtureId;
    output.active = false;
    output.entityIndex = 0;
    output.entityGeneration = 0;
    output.kind = undefined;
    output.restKind = undefined;
    output.regionId = 0;
    output.targetCellIndex = 0;
    output.interactionSpotId = 0;
    output.scheduleWindow = undefined;
    output.weatherExposure = undefined;
    output.permissionId = 0;
    output.recoveryPerTickQ16 = 0;
    output.baseScoreMilli = 0;
    output.ownerVersion = 0;
    output.storeVersion = this.storeVersion;
  }
}

export class RestCandidateIndex {
  readonly fixtureCapacity: number;
  readonly regionCapacity: number;
  readonly permissionCapacity: number;

  private readonly linked: Uint8Array;
  private readonly bucketKeys: Int32Array;
  private readonly fixtureVersions: Uint32Array;
  private readonly bucketHeads: Int32Array;
  private readonly bucketCounts: Uint32Array;
  private readonly aggregateCounts: Uint32Array;
  private readonly scheduleCounts: Uint32Array;
  private readonly aggregateKeys: Int32Array;
  private readonly scheduleKeys: Int32Array;
  private readonly nextByFixture: Int32Array;
  private readonly previousByFixture: Int32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private indexedCount = 0;
  private selectionCount = 0;
  private candidateVisitedCount = 0;
  private indexVersion = 0;
  private sourceVersion = 0;

  constructor(options: RestCandidateIndexOptions) {
    assertValidCapacity(options.fixtureCapacity, "rest candidate fixture capacity");
    assertValidCapacity(options.regionCapacity, "rest candidate region capacity");
    assertValidCapacity(options.permissionCapacity, "rest candidate permission capacity");
    this.fixtureCapacity = options.fixtureCapacity;
    this.regionCapacity = options.regionCapacity;
    this.permissionCapacity = options.permissionCapacity;
    const bucketCount =
      options.regionCapacity *
      REST_KIND_COUNT *
      SCHEDULE_COUNT *
      WEATHER_EXPOSURE_COUNT *
      options.permissionCapacity;
    const aggregateCount = options.regionCapacity * REST_KIND_COUNT * options.permissionCapacity;
    const scheduleCount =
      options.regionCapacity * REST_KIND_COUNT * SCHEDULE_COUNT * options.permissionCapacity;
    this.linked = new Uint8Array(options.fixtureCapacity);
    this.bucketKeys = new Int32Array(options.fixtureCapacity);
    this.bucketKeys.fill(-1);
    this.fixtureVersions = new Uint32Array(options.fixtureCapacity);
    this.bucketHeads = new Int32Array(bucketCount);
    this.bucketHeads.fill(-1);
    this.bucketCounts = new Uint32Array(bucketCount);
    this.aggregateCounts = new Uint32Array(aggregateCount);
    this.scheduleCounts = new Uint32Array(scheduleCount);
    this.aggregateKeys = new Int32Array(options.fixtureCapacity);
    this.scheduleKeys = new Int32Array(options.fixtureCapacity);
    this.aggregateKeys.fill(-1);
    this.scheduleKeys.fill(-1);
    this.nextByFixture = new Int32Array(options.fixtureCapacity);
    this.previousByFixture = new Int32Array(options.fixtureCapacity);
    this.nextByFixture.fill(-1);
    this.previousByFixture.fill(-1);
    this.dirtyQueued = new Uint8Array(options.fixtureCapacity);
    this.dirtyQueue = new Uint32Array(options.fixtureCapacity);
  }

  rebuildFromStore(store: RestSleepStore): RestSleepMetrics {
    this.clearIndex();

    for (let fixtureId = 0; fixtureId < this.fixtureCapacity; fixtureId += 1) {
      if (store.isFixtureActive(fixtureId)) {
        this.linkFixture(store, fixtureId);
      }
    }

    this.dirtyHead = 0;
    this.dirtyCount = 0;
    this.dirtyQueued.fill(0);
    this.indexVersion += 1;
    this.sourceVersion = store.version;
    return this.createMetrics(store);
  }

  markFixtureDirty(fixtureId: number): RestSleepMutationResult {
    if (!isIndexInRange(fixtureId, this.fixtureCapacity)) {
      return { ok: false, reason: "rest.fixture_id_out_of_range" };
    }

    if ((this.dirtyQueued[fixtureId] ?? 0) === 0) {
      const tail = (this.dirtyHead + this.dirtyCount) % this.dirtyQueue.length;
      this.dirtyQueue[tail] = fixtureId;
      this.dirtyQueued[fixtureId] = 1;
      this.dirtyCount += 1;
      if (this.dirtyCount > this.dirtyPeak) {
        this.dirtyPeak = this.dirtyCount;
      }
    }

    return { ok: true, id: fixtureId, version: this.indexVersion };
  }

  refreshDirty(store: RestSleepStore, budget: number): RestSleepMutationResult {
    if (!isPositiveUint32(budget)) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    let refreshed = 0;
    while (this.dirtyCount > 0 && refreshed < budget) {
      const fixtureId = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.dirtyQueue.length;
      this.dirtyCount -= 1;
      this.dirtyQueued[fixtureId] = 0;
      this.unlinkFixture(fixtureId);
      if (store.isFixtureActive(fixtureId)) {
        this.linkFixture(store, fixtureId);
      }
      refreshed += 1;
    }

    if (refreshed > 0) {
      this.indexVersion += 1;
    }

    if (this.dirtyCount === 0) {
      this.sourceVersion = store.version;
    }

    return { ok: true, id: refreshed, version: this.indexVersion };
  }

  selectCandidatesInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    store: RestSleepStore,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    this.resetCandidateSelectionInto(query, environment, store, scratch, output);
    if (!this.validateCandidateSelectionInto(query, environment, scratch, output)) {
      return;
    }
    if (this.dirtyCount > 0 || this.sourceVersion !== store.version) {
      output.reason = "rest.fixture_input_invalid";
      return;
    }

    const storeVersion = store.version;
    const sourceVersion = this.sourceVersion;
    const ownerIndexVersion = this.indexVersion;
    const restKindCode = encodeRestKind(query.restKind);
    const scheduleCode = encodeScheduleWindow(query.scheduleWindow);
    const weatherCode = encodeWeatherExposure(query.weatherExposure);
    if (
      !this.collectCandidatesInto(
        query,
        restKindCode,
        scheduleCode,
        weatherCode,
        store,
        storeVersion,
        scratch,
        output,
      )
    ) {
      this.failCandidateSelectionInto(query, environment, store, scratch, output);
      return;
    }

    if (
      !this.isCandidateSelectionBasisCurrent(
        store,
        environment,
        scratch,
        output,
        output.selectedCount,
        storeVersion,
        sourceVersion,
        ownerIndexVersion,
      )
    ) {
      this.failCandidateSelectionInto(query, environment, store, scratch, output);
      return;
    }

    this.finishCandidateSelectionInto(
      query,
      restKindCode,
      scheduleCode,
      weatherCode,
      scratch,
      output,
    );
  }

  selectCandidates(
    query: RestCandidateQuery,
    outputFixtureIds: Uint32Array,
    traceStore?: RestSleepTraceStore,
    traceInput?: Pick<
      RestTraceInput,
      "tick" | "actorId" | "sourceRestVersion" | "environmentVersion" | "reservationVersion"
    >,
  ): RestCandidateQueryResult {
    const validation = this.validateQuery(query, outputFixtureIds);
    if (!validation.ok) {
      return validation;
    }

    if (this.dirtyCount > 0) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    clearUint32(outputFixtureIds, query.maxSelectedFixtures, M3_REST_FIXTURE_NONE);
    const restKindCode = encodeRestKind(query.restKind);
    const scheduleCode = encodeScheduleWindow(query.scheduleWindow);
    const weatherCode = encodeWeatherExposure(query.weatherExposure);
    const bucketKey = createRestBucketKey(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      this.regionCapacity,
      this.permissionCapacity,
    );
    const candidateTotal = this.bucketCounts[bucketKey] ?? 0;
    let current = this.bucketHeads[bucketKey] ?? -1;
    let visited = 0;
    let selected = 0;

    while (current >= 0 && visited < query.candidateCap) {
      if (selected < query.maxSelectedFixtures) {
        outputFixtureIds[selected] = current;
        selected += 1;
      }
      visited += 1;
      current = this.nextByFixture[current] ?? -1;
    }

    this.selectionCount += 1;
    this.candidateVisitedCount += visited;
    const candidateCapHit = candidateTotal > visited;
    const selectedCapHit = visited > selected;
    const reason = this.resolveSelectionReason(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      candidateTotal,
      candidateCapHit,
    );
    const traceSequence =
      traceStore !== undefined && traceInput !== undefined
        ? traceStore.record({
            ...traceInput,
            fixtureId:
              selected > 0 ? (outputFixtureIds[0] ?? M3_REST_FIXTURE_NONE) : M3_REST_FIXTURE_NONE,
            candidateTotal,
            visitedCount: visited,
            selectedCount: selected,
            candidateCap: query.candidateCap,
            selectedCap: query.maxSelectedFixtures,
            exactPathCount: 0,
            exactPathCap: 0,
            nodeExpansions: 0,
            reason,
          })
        : 0;

    return {
      ok: true,
      reason,
      candidateTotal,
      visitedCount: visited,
      selectedCount: selected,
      candidateCapHit,
      selectedCapHit,
      sourceVersion: this.sourceVersion,
      indexVersion: this.indexVersion,
      traceSequence,
    };
  }

  createMetrics(store?: RestSleepStore): RestSleepMetrics {
    return {
      version: this.indexVersion,
      activeFixtureCount: store?.activeCount ?? 0,
      activeJobCount: 0,
      candidateIndexedCount: this.indexedCount,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
      selectionCount: this.selectionCount,
      candidateVisitedCount: this.candidateVisitedCount,
      exactPathRequestCount: 0,
      pathFailureCount: 0,
      reservationAttemptCount: 0,
      reservationFailureCount: 0,
      cleanupReleaseCount: 0,
      completedJobCount: 0,
      cancelledJobCount: 0,
      failedJobCount: 0,
      interruptedJobCount: 0,
    };
  }

  private linkFixture(store: RestSleepStore, fixtureId: number): void {
    const bucketKey = store.readFixtureBucketKey(fixtureId);
    if (bucketKey < 0) {
      return;
    }

    let current = this.bucketHeads[bucketKey] ?? -1;
    let previous = -1;

    while (current >= 0 && isRestFixtureBefore(store, current, fixtureId)) {
      previous = current;
      current = this.nextByFixture[current] ?? -1;
    }

    this.previousByFixture[fixtureId] = previous;
    this.nextByFixture[fixtureId] = current;

    if (previous >= 0) {
      this.nextByFixture[previous] = fixtureId;
    } else {
      this.bucketHeads[bucketKey] = fixtureId;
    }

    if (current >= 0) {
      this.previousByFixture[current] = fixtureId;
    }

    this.bucketKeys[fixtureId] = bucketKey;
    this.fixtureVersions[fixtureId] = store.readFixtureOwnerVersion(fixtureId);
    this.linked[fixtureId] = 1;
    this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 0) + 1;
    this.linkAggregateCounts(store, fixtureId);
    this.indexedCount += 1;
  }

  private unlinkFixture(fixtureId: number): void {
    if ((this.linked[fixtureId] ?? 0) !== 1) {
      return;
    }

    const bucketKey = this.bucketKeys[fixtureId] ?? -1;
    const previous = this.previousByFixture[fixtureId] ?? -1;
    const next = this.nextByFixture[fixtureId] ?? -1;

    if (bucketKey >= 0) {
      if (previous >= 0) {
        this.nextByFixture[previous] = next;
      } else {
        this.bucketHeads[bucketKey] = next;
      }

      if (next >= 0) {
        this.previousByFixture[next] = previous;
      }

      this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 1) - 1;
    }

    this.unlinkAggregateCounts(fixtureId);
    this.linked[fixtureId] = 0;
    this.bucketKeys[fixtureId] = -1;
    this.fixtureVersions[fixtureId] = 0;
    this.previousByFixture[fixtureId] = -1;
    this.nextByFixture[fixtureId] = -1;
    this.indexedCount -= 1;
  }

  private linkAggregateCounts(store: RestSleepStore, fixtureId: number): void {
    const fixture = store.readFixture(fixtureId);
    if (fixture === undefined) {
      return;
    }
    const restKindCode = encodeRestKind(fixture.restKind);
    const scheduleCode = encodeScheduleWindow(fixture.scheduleWindow);
    const aggregateKey = createAggregateKey(
      fixture.regionId,
      restKindCode,
      fixture.permissionId,
      this.permissionCapacity,
    );
    const scheduleKey = createScheduleKey(
      fixture.regionId,
      restKindCode,
      scheduleCode,
      fixture.permissionId,
      this.permissionCapacity,
    );
    this.aggregateKeys[fixtureId] = aggregateKey;
    this.scheduleKeys[fixtureId] = scheduleKey;
    this.aggregateCounts[aggregateKey] = (this.aggregateCounts[aggregateKey] ?? 0) + 1;
    this.scheduleCounts[scheduleKey] = (this.scheduleCounts[scheduleKey] ?? 0) + 1;
  }

  private unlinkAggregateCounts(fixtureId: number): void {
    const aggregateKey = this.aggregateKeys[fixtureId] ?? -1;
    const scheduleKey = this.scheduleKeys[fixtureId] ?? -1;

    if (aggregateKey >= 0) {
      this.aggregateCounts[aggregateKey] = (this.aggregateCounts[aggregateKey] ?? 1) - 1;
      this.aggregateKeys[fixtureId] = -1;
    }

    if (scheduleKey >= 0) {
      this.scheduleCounts[scheduleKey] = (this.scheduleCounts[scheduleKey] ?? 1) - 1;
      this.scheduleKeys[fixtureId] = -1;
    }
  }

  private validateCandidateSelectionInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): boolean {
    if (
      !isIndexInRange(query.regionId, this.regionCapacity) ||
      !isIndexInRange(query.permissionId, this.permissionCapacity) ||
      !isPositiveUint32(query.candidateCap) ||
      query.candidateCap > M3_REST_DEFAULT_CANDIDATE_CAP ||
      !isPositiveUint32(query.maxSelectedFixtures) ||
      query.maxSelectedFixtures > M3_REST_DEFAULT_SELECTED_CAP ||
      !isSafeUint32(environment.scheduleWindowVersion) ||
      !isSafeUint32(environment.weatherVersion) ||
      !isSafeUint32(environment.weatherSourceVersion) ||
      !hasRestSelectionScratchCapacity(scratch)
    ) {
      output.reason = "rest.fixture_input_invalid";
      return false;
    }
    if (query.scheduleWindow !== environment.scheduleWindow) {
      output.reason = "rest.rejected_schedule_window";
      return false;
    }
    if (
      query.weatherExposure !== environment.weatherExposure ||
      (query.weatherExposure === "outdoor" && !environment.outdoorWorkAllowed)
    ) {
      output.reason = "rest.rejected_weather_exposure";
      return false;
    }
    return true;
  }

  private resetCandidateSelectionInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    store: RestSleepStore,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    store.readFixtureInto(M3_REST_FIXTURE_NONE, scratch.fixtureReadOutput);
    resetRestSelectionScratch(scratch);
    output.ok = false;
    output.reason = undefined;
    output.queryRegionId = query.regionId;
    output.queryRestKind = query.restKind;
    output.queryScheduleWindow = query.scheduleWindow;
    output.queryWeatherExposure = query.weatherExposure;
    output.queryPermissionId = query.permissionId;
    output.candidateCap = query.candidateCap;
    output.maxSelectedFixtures = query.maxSelectedFixtures;
    output.environmentScheduleWindow = environment.scheduleWindow;
    output.scheduleWindowVersion = environment.scheduleWindowVersion;
    output.environmentWeatherExposure = environment.weatherExposure;
    output.outdoorWorkAllowed = environment.outdoorWorkAllowed;
    output.weatherVersion = environment.weatherVersion;
    output.weatherSourceVersion = environment.weatherSourceVersion;
    output.candidateTotal = 0;
    output.visitedCount = 0;
    output.selectedCount = 0;
    output.candidateCapHit = false;
    output.selectedCapHit = false;
    output.selectedFixtureId = M3_REST_FIXTURE_NONE;
    output.selectedEntityIndex = 0;
    output.selectedEntityGeneration = 0;
    output.selectedFixtureKind = undefined;
    output.selectedRestKind = undefined;
    output.selectedRegionId = 0;
    output.selectedTargetCellIndex = 0;
    output.selectedInteractionSpotId = 0;
    output.selectedScheduleWindow = undefined;
    output.selectedWeatherExposure = undefined;
    output.selectedPermissionId = 0;
    output.selectedRecoveryPerTickQ16 = 0;
    output.selectedScoreMilli = 0;
    output.selectedCachedFixtureVersion = 0;
    output.selectedCurrentFixtureOwnerVersion = 0;
    output.selectedLinkedCandidate = false;
    output.restStoreVersion = store.version;
    output.sourceVersion = this.sourceVersion;
    output.indexVersion = this.indexVersion;
    output.dirtyBacklog = this.dirtyCount;
  }

  private failCandidateSelectionInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    store: RestSleepStore,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    this.resetCandidateSelectionInto(query, environment, store, scratch, output);
    output.reason = "rest.fixture_input_invalid";
  }

  private collectCandidatesInto(
    query: RestCandidateQuery,
    restKindCode: number,
    scheduleCode: number,
    weatherCode: number,
    store: RestSleepStore,
    storeVersion: number,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): boolean {
    const bucketKey = createRestBucketKey(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      this.regionCapacity,
      this.permissionCapacity,
    );
    const candidateTotal = this.bucketCounts[bucketKey] ?? 0;
    let current = this.bucketHeads[bucketKey] ?? -1;
    let visited = 0;
    let selected = 0;
    while (current >= 0 && visited < query.candidateCap) {
      store.readFixtureInto(current, scratch.fixtureReadOutput);
      if (!this.isFixtureReadCurrent(current, storeVersion, scratch.fixtureReadOutput)) {
        return false;
      }
      if (selected < query.maxSelectedFixtures) {
        this.writeCandidateIntoScratch(current, selected, scratch);
        selected += 1;
      }
      visited += 1;
      current = this.nextByFixture[current] ?? -1;
    }
    output.candidateTotal = candidateTotal;
    output.visitedCount = visited;
    output.selectedCount = selected;
    output.candidateCapHit = candidateTotal > visited;
    output.selectedCapHit = visited > selected;
    return true;
  }

  private isFixtureReadCurrent(
    fixtureId: number,
    storeVersion: number,
    fixture: RestFixtureIntoOutput,
  ): boolean {
    return (
      fixture.ok &&
      fixture.active &&
      fixture.fixtureId === fixtureId &&
      fixture.storeVersion === storeVersion &&
      fixture.ownerVersion === (this.fixtureVersions[fixtureId] ?? 0) &&
      (this.linked[fixtureId] ?? 0) === 1
    );
  }

  private writeCandidateIntoScratch(
    fixtureId: number,
    selectedIndex: number,
    scratch: RestCandidateSelectionIntoScratch,
  ): void {
    const fixture = scratch.fixtureReadOutput;
    scratch.fixtureIds[selectedIndex] = fixtureId;
    scratch.entityIndexes[selectedIndex] = fixture.entityIndex;
    scratch.entityGenerations[selectedIndex] = fixture.entityGeneration;
    scratch.fixtureKindCodes[selectedIndex] = encodeOptionalFixtureKind(fixture.kind);
    scratch.restKindCodes[selectedIndex] = encodeOptionalRestKind(fixture.restKind);
    scratch.regionIds[selectedIndex] = fixture.regionId;
    scratch.targetCellIndexes[selectedIndex] = fixture.targetCellIndex;
    scratch.interactionSpotIds[selectedIndex] = fixture.interactionSpotId;
    scratch.scheduleCodes[selectedIndex] = encodeOptionalScheduleWindow(fixture.scheduleWindow);
    scratch.weatherCodes[selectedIndex] = encodeOptionalWeatherExposure(fixture.weatherExposure);
    scratch.permissionIds[selectedIndex] = fixture.permissionId;
    scratch.recoveryPerTickQ16s[selectedIndex] = fixture.recoveryPerTickQ16;
    scratch.scoreMillis[selectedIndex] = fixture.baseScoreMilli;
    scratch.cachedFixtureVersions[selectedIndex] = this.fixtureVersions[fixtureId] ?? 0;
    scratch.currentFixtureOwnerVersions[selectedIndex] = fixture.ownerVersion;
    scratch.linkedCandidateFlags[selectedIndex] = this.linked[fixtureId] ?? 0;
  }

  private isCandidateSelectionBasisCurrent(
    store: RestSleepStore,
    environment: RestCandidateEnvironmentBasis,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
    selectedCount: number,
    storeVersion: number,
    sourceOwnerVersion: number,
    ownerIndexVersion: number,
  ): boolean {
    if (
      store.version !== storeVersion ||
      this.sourceVersion !== sourceOwnerVersion ||
      this.indexVersion !== ownerIndexVersion ||
      this.dirtyCount !== 0 ||
      output.restStoreVersion !== storeVersion ||
      output.sourceVersion !== sourceOwnerVersion ||
      output.indexVersion !== ownerIndexVersion ||
      output.dirtyBacklog !== 0 ||
      !isRestEnvironmentBasisCurrent(environment, output)
    ) {
      return false;
    }
    for (let index = 0; index < selectedCount; index += 1) {
      const fixtureId = scratch.fixtureIds[index] ?? M3_REST_FIXTURE_NONE;
      store.readFixtureInto(fixtureId, scratch.fixtureReadOutput);
      if (
        !this.isCandidateScratchRowCurrent(fixtureId, index, storeVersion, environment, scratch)
      ) {
        return false;
      }
    }
    return true;
  }

  private isCandidateScratchRowCurrent(
    fixtureId: number,
    selectedIndex: number,
    storeVersion: number,
    environment: RestCandidateEnvironmentBasis,
    scratch: RestCandidateSelectionIntoScratch,
  ): boolean {
    const fixture = scratch.fixtureReadOutput;
    return (
      this.isFixtureReadCurrent(fixtureId, storeVersion, fixture) &&
      fixture.entityIndex === (scratch.entityIndexes[selectedIndex] ?? 0) &&
      fixture.entityGeneration === (scratch.entityGenerations[selectedIndex] ?? 0) &&
      encodeOptionalFixtureKind(fixture.kind) === (scratch.fixtureKindCodes[selectedIndex] ?? 0) &&
      encodeOptionalRestKind(fixture.restKind) === (scratch.restKindCodes[selectedIndex] ?? 0) &&
      fixture.regionId === (scratch.regionIds[selectedIndex] ?? 0) &&
      fixture.targetCellIndex === (scratch.targetCellIndexes[selectedIndex] ?? 0) &&
      fixture.interactionSpotId === (scratch.interactionSpotIds[selectedIndex] ?? 0) &&
      encodeOptionalScheduleWindow(fixture.scheduleWindow) ===
        (scratch.scheduleCodes[selectedIndex] ?? 0) &&
      encodeOptionalWeatherExposure(fixture.weatherExposure) ===
        (scratch.weatherCodes[selectedIndex] ?? 0) &&
      fixture.permissionId === (scratch.permissionIds[selectedIndex] ?? 0) &&
      fixture.recoveryPerTickQ16 === (scratch.recoveryPerTickQ16s[selectedIndex] ?? 0) &&
      fixture.baseScoreMilli === (scratch.scoreMillis[selectedIndex] ?? 0) &&
      encodeScheduleWindow(environment.scheduleWindow) ===
        (scratch.scheduleCodes[selectedIndex] ?? 0) &&
      encodeWeatherExposure(environment.weatherExposure) ===
        (scratch.weatherCodes[selectedIndex] ?? 0) &&
      fixture.ownerVersion === (scratch.cachedFixtureVersions[selectedIndex] ?? 0) &&
      fixture.ownerVersion === (scratch.currentFixtureOwnerVersions[selectedIndex] ?? 0) &&
      (scratch.linkedCandidateFlags[selectedIndex] ?? 0) === 1
    );
  }

  private finishCandidateSelectionInto(
    query: RestCandidateQuery,
    restKindCode: number,
    scheduleCode: number,
    weatherCode: number,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    output.ok = true;
    output.reason = this.resolveSelectionReason(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      output.candidateTotal,
      output.candidateCapHit,
    );
    if (output.selectedCount > 0) {
      copyFirstRestCandidateIntoOutput(scratch, output);
    }
    this.selectionCount += 1;
    this.candidateVisitedCount += output.visitedCount;
  }

  private resolveSelectionReason(
    regionId: number,
    restKindCode: number,
    scheduleCode: number,
    weatherCode: number,
    permissionId: number,
    candidateTotal: number,
    candidateCapHit: boolean,
  ): RestSleepReason {
    if (candidateCapHit) {
      return "trace.candidate_cap_reached";
    }

    if (candidateTotal > 0) {
      return "rest.selected_indexed_path";
    }

    const aggregateKey = createAggregateKey(
      regionId,
      restKindCode,
      permissionId,
      this.permissionCapacity,
    );
    if ((this.aggregateCounts[aggregateKey] ?? 0) === 0) {
      return "rest.rejected_no_indexed_candidate";
    }

    const scheduleKey = createScheduleKey(
      regionId,
      restKindCode,
      scheduleCode,
      permissionId,
      this.permissionCapacity,
    );
    if ((this.scheduleCounts[scheduleKey] ?? 0) === 0) {
      return "rest.rejected_schedule_window";
    }

    void weatherCode;
    return "rest.rejected_weather_exposure";
  }

  private validateQuery(
    query: RestCandidateQuery,
    outputFixtureIds: Uint32Array,
  ): RestCandidateQueryResult {
    if (
      !isIndexInRange(query.regionId, this.regionCapacity) ||
      !isIndexInRange(query.permissionId, this.permissionCapacity) ||
      !isPositiveUint32(query.candidateCap) ||
      !isPositiveUint32(query.maxSelectedFixtures) ||
      outputFixtureIds.length < query.maxSelectedFixtures
    ) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    return {
      ok: true,
      reason: "rest.none",
      candidateTotal: 0,
      visitedCount: 0,
      selectedCount: 0,
      candidateCapHit: false,
      selectedCapHit: false,
      sourceVersion: this.sourceVersion,
      indexVersion: this.indexVersion,
      traceSequence: 0,
    };
  }

  private clearIndex(): void {
    this.linked.fill(0);
    this.bucketKeys.fill(-1);
    this.fixtureVersions.fill(0);
    this.bucketHeads.fill(-1);
    this.bucketCounts.fill(0);
    this.aggregateCounts.fill(0);
    this.scheduleCounts.fill(0);
    this.aggregateKeys.fill(-1);
    this.scheduleKeys.fill(-1);
    this.nextByFixture.fill(-1);
    this.previousByFixture.fill(-1);
    this.indexedCount = 0;
  }
}

export class RestJobDriverStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly ownerIndexes: Uint32Array;
  private readonly ownerGenerations: Uint32Array;
  private readonly actorIds: Uint32Array;
  private readonly fixtureIds: Uint32Array;
  private readonly restKindCodes: Uint8Array;
  private readonly stepCodes: Uint8Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly interactionSpotIds: Uint32Array;
  private readonly scheduleCodes: Uint8Array;
  private readonly environmentVersions: Uint32Array;
  private readonly needOwnerVersions: Uint32Array;
  private readonly lastNeedExpectedValues: Uint16Array;
  private readonly lastNeedDeltas: Int32Array;
  private readonly lastNeedExpectedStoreVersions: Uint32Array;
  private readonly lastNeedExpectedLaneVersions: Uint32Array;
  private readonly lastNeedNextStoreVersions: Uint32Array;
  private readonly lastNeedChangedFlags: Uint8Array;
  private readonly reservationVersions: Uint32Array;
  private readonly fixtureClaimIds: Uint32Array;
  private readonly interactionClaimIds: Uint32Array;
  private readonly fixtureClaimEpochs: Uint32Array;
  private readonly interactionClaimEpochs: Uint32Array;
  private readonly fixtureClaimCreatedTicks: Float64Array;
  private readonly interactionClaimCreatedTicks: Float64Array;
  private readonly fixtureClaimLeaseExpiryTicks: Float64Array;
  private readonly interactionClaimLeaseExpiryTicks: Float64Array;
  private readonly jobGenerations: Uint32Array;
  private readonly jobSlotVersions: Uint32Array;
  private readonly jobCoreStepTickCounts: Uint32Array;
  private readonly jobCoreAdoptionReservationVersions: Uint32Array;
  private readonly jobCoreAdoptionDriverVersions: Uint32Array;
  private readonly jobCoreAdoptionSlotVersions: Uint32Array;
  private readonly createdTicks: Float64Array;
  private readonly recoveryTargetValues: Uint16Array;
  private readonly recoveryPerTickQ16: Uint32Array;
  private readonly recoveryProgressQ16: Uint32Array;
  private readonly stepEnteredTicks: Float64Array;
  private readonly lastEffectTicks: Float64Array;
  private readonly effectPhases: Uint8Array;
  private readonly interruptionPolicyCodes: Uint8Array;
  private readonly requiredWorkQ16s: Uint32Array;
  private readonly readyToCompleteFlags: Uint8Array;
  private readonly cleanupPendingFlags: Uint8Array;
  private readonly pendingOutcomes: Uint8Array;
  private readonly pendingReasonCodes: Uint8Array;
  private readonly pendingFailureCodes: Uint8Array;
  private readonly pendingInterruptionCodes: Uint8Array;
  private readonly returnedOnceFlags: Uint8Array;
  private readonly terminalReasonCodes: Uint8Array;
  private readonly terminalOutcomes: Uint8Array;
  private readonly originPresent: Uint8Array;
  private readonly originOwnerIndexes: Uint32Array;
  private readonly originOwnerGenerations: Uint32Array;
  private readonly originActorIds: Uint32Array;
  private readonly originFixtureIds: Uint32Array;
  private readonly originRestKindCodes: Uint8Array;
  private readonly originStepCodes: Uint8Array;
  private readonly originTargetCellIndexes: Uint32Array;
  private readonly originInteractionSpotIds: Uint32Array;
  private readonly originScheduleCodes: Uint8Array;
  private readonly originEnvironmentVersions: Uint32Array;
  private readonly originNeedOwnerVersions: Uint32Array;
  private readonly originLastNeedExpectedValues: Uint16Array;
  private readonly originLastNeedDeltas: Int32Array;
  private readonly originLastNeedExpectedStoreVersions: Uint32Array;
  private readonly originLastNeedExpectedLaneVersions: Uint32Array;
  private readonly originLastNeedNextStoreVersions: Uint32Array;
  private readonly originLastNeedChangedFlags: Uint8Array;
  private readonly originReservationVersions: Uint32Array;
  private readonly originJobGenerations: Uint32Array;
  private readonly originJobSlotVersions: Uint32Array;
  private readonly originJobCoreStepTickCounts: Uint32Array;
  private readonly originJobCoreAdoptionReservationVersions: Uint32Array;
  private readonly originJobCoreAdoptionDriverVersions: Uint32Array;
  private readonly originJobCoreAdoptionSlotVersions: Uint32Array;
  private readonly originCreatedTicks: Float64Array;
  private readonly originRecoveryTargetValues: Uint16Array;
  private readonly originRecoveryPerTickQ16s: Uint32Array;
  private readonly originRecoveryProgressQ16s: Uint32Array;
  private readonly originStepEnteredTicks: Float64Array;
  private readonly originLastEffectTicks: Float64Array;
  private readonly originEffectPhases: Uint8Array;
  private readonly originInterruptionPolicyCodes: Uint8Array;
  private readonly originRequiredWorkQ16s: Uint32Array;
  private readonly originReadyToCompleteFlags: Uint8Array;
  private readonly originTerminalReasonCodes: Uint8Array;
  private readonly originTerminalOutcomes: Uint8Array;
  private readonly originTerminalFailureCodes: Uint8Array;
  private readonly originTerminalInterruptionCodes: Uint8Array;
  private activeCount = 0;
  private pathingCount = 0;
  private recoveringCount = 0;
  private completedCount = 0;
  private canceledCount = 0;
  private failedCount = 0;
  private interruptedCount = 0;
  private storeVersion = 0;
  private reservationAttemptCount = 0;
  private reservationFailureCount = 0;
  private cleanupReleaseCount = 0;
  private completedJobCount = 0;
  private cancelledJobCount = 0;
  private failedJobCount = 0;
  private interruptedJobCount = 0;
  private readonly jobTokenOutput: JobTokenIntoOutput;
  private readonly autonomyMutationOutput: AutonomyJobMutationIntoOutput;
  private readonly preparedProgress: PreparedAutonomyProgress;
  private readonly preparedTerminal: PreparedAutonomyTerminal;
  private readonly preparedNeed: PreparedNeedLaneMutation;
  private readonly committedJobOutput: AutonomyCommittedJobIntoOutput;
  private readonly releaseClaimIds: Uint32Array;
  private readonly releaseClaimEpochs: Uint32Array;
  private readonly releaseOutput: ReservationReleaseIntoOutput;
  private readonly releaseOwnerScratch: { index: number; generation: number };
  private readonly legacyAcquireOwnerScratch: { index: number; generation: number };
  private readonly legacyAcquireTargetScratch: { index: number; generation: number };
  private readonly legacyEntityClaim: {
    channel: "entity";
    target: { index: number; generation: number };
  };
  private readonly legacyInteractionClaim: {
    channel: "interaction_spot";
    target: { index: number; generation: number };
    spotId: number;
  };
  private readonly legacyAcquireClaims: [ReservationClaimRequest, ReservationClaimRequest];
  private readonly legacyAcquireRequest: {
    owner: { index: number; generation: number };
    jobId: number;
    createdTick: number;
    leaseExpiryTick: number;
    claims: [ReservationClaimRequest, ReservationClaimRequest];
  };
  private readonly legacyAcquireScratch: ReservationAcquireIntoScratch;
  private readonly legacyAcquireClaimIds: Uint32Array;
  private readonly legacyReleaseClaimIds: number[];
  private readonly legacyAcquireOutput: ReservationAcquireIntoOutput;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "rest job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.ownerIndexes = new Uint32Array(capacity);
    this.ownerGenerations = new Uint32Array(capacity);
    this.actorIds = new Uint32Array(capacity);
    this.fixtureIds = new Uint32Array(capacity);
    this.restKindCodes = new Uint8Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.targetCellIndexes = new Uint32Array(capacity);
    this.interactionSpotIds = new Uint32Array(capacity);
    this.scheduleCodes = new Uint8Array(capacity);
    this.environmentVersions = new Uint32Array(capacity);
    this.needOwnerVersions = new Uint32Array(capacity);
    this.lastNeedExpectedValues = new Uint16Array(capacity);
    this.lastNeedDeltas = new Int32Array(capacity);
    this.lastNeedExpectedStoreVersions = new Uint32Array(capacity);
    this.lastNeedExpectedLaneVersions = new Uint32Array(capacity);
    this.lastNeedNextStoreVersions = new Uint32Array(capacity);
    this.lastNeedChangedFlags = new Uint8Array(capacity);
    this.reservationVersions = new Uint32Array(capacity);
    this.fixtureClaimIds = new Uint32Array(capacity);
    this.interactionClaimIds = new Uint32Array(capacity);
    this.fixtureClaimEpochs = new Uint32Array(capacity);
    this.interactionClaimEpochs = new Uint32Array(capacity);
    this.fixtureClaimCreatedTicks = new Float64Array(capacity);
    this.interactionClaimCreatedTicks = new Float64Array(capacity);
    this.fixtureClaimLeaseExpiryTicks = new Float64Array(capacity);
    this.interactionClaimLeaseExpiryTicks = new Float64Array(capacity);
    this.jobGenerations = new Uint32Array(capacity);
    this.jobSlotVersions = new Uint32Array(capacity);
    this.jobCoreStepTickCounts = new Uint32Array(capacity);
    this.jobCoreAdoptionReservationVersions = new Uint32Array(capacity);
    this.jobCoreAdoptionDriverVersions = new Uint32Array(capacity);
    this.jobCoreAdoptionSlotVersions = new Uint32Array(capacity);
    this.createdTicks = new Float64Array(capacity);
    this.recoveryTargetValues = new Uint16Array(capacity);
    this.recoveryPerTickQ16 = new Uint32Array(capacity);
    this.recoveryProgressQ16 = new Uint32Array(capacity);
    this.stepEnteredTicks = new Float64Array(capacity);
    this.lastEffectTicks = new Float64Array(capacity);
    this.effectPhases = new Uint8Array(capacity);
    this.interruptionPolicyCodes = new Uint8Array(capacity);
    this.requiredWorkQ16s = new Uint32Array(capacity);
    this.readyToCompleteFlags = new Uint8Array(capacity);
    this.cleanupPendingFlags = new Uint8Array(capacity);
    this.pendingOutcomes = new Uint8Array(capacity);
    this.pendingReasonCodes = new Uint8Array(capacity);
    this.pendingFailureCodes = new Uint8Array(capacity);
    this.pendingInterruptionCodes = new Uint8Array(capacity);
    this.returnedOnceFlags = new Uint8Array(capacity);
    this.terminalReasonCodes = new Uint8Array(capacity);
    this.terminalOutcomes = new Uint8Array(capacity);
    this.originPresent = new Uint8Array(capacity);
    this.originOwnerIndexes = new Uint32Array(capacity);
    this.originOwnerGenerations = new Uint32Array(capacity);
    this.originActorIds = new Uint32Array(capacity);
    this.originFixtureIds = new Uint32Array(capacity);
    this.originRestKindCodes = new Uint8Array(capacity);
    this.originStepCodes = new Uint8Array(capacity);
    this.originTargetCellIndexes = new Uint32Array(capacity);
    this.originInteractionSpotIds = new Uint32Array(capacity);
    this.originScheduleCodes = new Uint8Array(capacity);
    this.originEnvironmentVersions = new Uint32Array(capacity);
    this.originNeedOwnerVersions = new Uint32Array(capacity);
    this.originLastNeedExpectedValues = new Uint16Array(capacity);
    this.originLastNeedDeltas = new Int32Array(capacity);
    this.originLastNeedExpectedStoreVersions = new Uint32Array(capacity);
    this.originLastNeedExpectedLaneVersions = new Uint32Array(capacity);
    this.originLastNeedNextStoreVersions = new Uint32Array(capacity);
    this.originLastNeedChangedFlags = new Uint8Array(capacity);
    this.originReservationVersions = new Uint32Array(capacity);
    this.originJobGenerations = new Uint32Array(capacity);
    this.originJobSlotVersions = new Uint32Array(capacity);
    this.originJobCoreStepTickCounts = new Uint32Array(capacity);
    this.originJobCoreAdoptionReservationVersions = new Uint32Array(capacity);
    this.originJobCoreAdoptionDriverVersions = new Uint32Array(capacity);
    this.originJobCoreAdoptionSlotVersions = new Uint32Array(capacity);
    this.originCreatedTicks = new Float64Array(capacity);
    this.originRecoveryTargetValues = new Uint16Array(capacity);
    this.originRecoveryPerTickQ16s = new Uint32Array(capacity);
    this.originRecoveryProgressQ16s = new Uint32Array(capacity);
    this.originStepEnteredTicks = new Float64Array(capacity);
    this.originLastEffectTicks = new Float64Array(capacity);
    this.originEffectPhases = new Uint8Array(capacity);
    this.originInterruptionPolicyCodes = new Uint8Array(capacity);
    this.originRequiredWorkQ16s = new Uint32Array(capacity);
    this.originReadyToCompleteFlags = new Uint8Array(capacity);
    this.originTerminalReasonCodes = new Uint8Array(capacity);
    this.originTerminalOutcomes = new Uint8Array(capacity);
    this.originTerminalFailureCodes = new Uint8Array(capacity);
    this.originTerminalInterruptionCodes = new Uint8Array(capacity);
    this.fixtureIds.fill(M3_REST_FIXTURE_NONE);
    this.fixtureClaimIds.fill(M3_REST_FIXTURE_NONE);
    this.interactionClaimIds.fill(M3_REST_FIXTURE_NONE);
    this.originFixtureIds.fill(M3_REST_FIXTURE_NONE);
    this.jobTokenOutput = createRestJobTokenOutput();
    this.autonomyMutationOutput = createRestAutonomyMutationOutput();
    this.preparedProgress = createRestPreparedProgress();
    this.preparedTerminal = createRestPreparedTerminal();
    this.preparedNeed = createRestPreparedNeed();
    this.committedJobOutput = createRestCommittedJobOutput();
    this.releaseClaimIds = new Uint32Array(2);
    this.releaseClaimEpochs = new Uint32Array(2);
    this.releaseOutput = {
      ok: false,
      reason: undefined,
      claimIndex: M3_REST_FIXTURE_NONE,
      claimId: M3_REST_FIXTURE_NONE,
      releasedCount: 0,
      version: 0,
      activeCount: 0,
    };
    this.releaseOwnerScratch = { index: 0, generation: 0 };
    this.legacyAcquireOwnerScratch = { index: 0, generation: 0 };
    this.legacyAcquireTargetScratch = { index: 0, generation: 0 };
    this.legacyEntityClaim = { channel: "entity", target: this.legacyAcquireTargetScratch };
    this.legacyInteractionClaim = {
      channel: "interaction_spot",
      target: this.legacyAcquireTargetScratch,
      spotId: 0,
    };
    this.legacyAcquireClaims = [this.legacyEntityClaim, this.legacyInteractionClaim];
    this.legacyAcquireRequest = {
      owner: this.legacyAcquireOwnerScratch,
      jobId: 0,
      createdTick: 0,
      leaseExpiryTick: 0,
      claims: this.legacyAcquireClaims,
    };
    this.legacyAcquireScratch = {
      channelCodes: new Uint8Array(2),
      keys: new Float64Array(2),
      amounts: new Uint32Array(2),
      limits: new Uint32Array(2),
      targetIndexes: new Uint32Array(2),
      targetGenerations: new Uint32Array(2),
      hasTargets: new Uint8Array(2),
      slots: new Uint32Array(2),
    };
    this.legacyAcquireClaimIds = new Uint32Array(2);
    this.legacyReleaseClaimIds = [M3_REST_FIXTURE_NONE, M3_REST_FIXTURE_NONE];
    this.legacyAcquireOutput = {
      ok: false,
      reason: undefined,
      claimIndex: M3_REST_FIXTURE_NONE,
      conflictingClaimId: M3_REST_FIXTURE_NONE,
      claimCount: 0,
      version: 0,
      activeCount: 0,
    };
  }

  adoptExistingClaimsInto(
    control: ExistingClaimsAdoptionControl,
    input: RestClaimAdoptionInput,
    jobCore: JobCoreStore,
    output: RestClaimAdoptionOutput,
  ): void {
    resetRestClaimAdoptionOutput(output);
    const claims = input.claims;
    const work = (input.recoveryTargetValue - input.currentRestValue) * 65_536;
    if (!this.isExactRestAdoptionPreflight(control, input, work)) {
      output.reason =
        input.recoveryTargetValue <= input.currentRestValue
          ? "rest_no_longer_needed"
          : "rest_adoption_preflight_failed";
      return;
    }
    jobCore.createRunningJobScalarsInto(
      control.jobId,
      control.jobGeneration,
      control.ownerIndex,
      control.ownerGeneration,
      M3_REST_SLEEP_JOB_KIND,
      input.fixtureId,
      "path_to_source",
      input.interruptionPolicy ?? defaultPolicy(input.restKind),
      work,
      control.claimCreatedTick,
      control.adoptionTick,
      control.reservationReadVersion,
      control.expectedDriverVersion,
      control.expectedJobSlotVersion,
      control.expectedJobCoreVersion,
      this.jobTokenOutput,
    );
    if (!this.jobTokenOutput.ok) {
      output.reason = this.jobTokenOutput.reason;
      return;
    }
    const jobId = control.jobId;
    this.captureRestOrigin(jobId);
    this.active[jobId] = 1;
    this.ownerIndexes[jobId] = control.ownerIndex;
    this.ownerGenerations[jobId] = control.ownerGeneration;
    this.actorIds[jobId] = input.actorId;
    this.fixtureIds[jobId] = input.fixtureId;
    this.restKindCodes[jobId] = encodeRestKind(input.restKind);
    this.stepCodes[jobId] = REST_JOB_PATHING_TO_FIXTURE;
    this.targetCellIndexes[jobId] = input.targetCellIndex;
    this.interactionSpotIds[jobId] = input.interactionSpotId;
    this.scheduleCodes[jobId] = encodeScheduleWindow(input.scheduleWindow);
    this.environmentVersions[jobId] = input.environmentVersion;
    this.needOwnerVersions[jobId] = input.needOwnerVersion;
    this.lastNeedExpectedValues[jobId] = 0;
    this.lastNeedDeltas[jobId] = 0;
    this.lastNeedExpectedStoreVersions[jobId] = 0;
    this.lastNeedExpectedLaneVersions[jobId] = 0;
    this.lastNeedNextStoreVersions[jobId] = 0;
    this.lastNeedChangedFlags[jobId] = 0;
    this.reservationVersions[jobId] = control.reservationReadVersion;
    this.fixtureClaimIds[jobId] = control.claimIds[0] ?? M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = control.claimIds[1] ?? M3_REST_FIXTURE_NONE;
    this.fixtureClaimEpochs[jobId] = control.claimEpochs[0] ?? 0;
    this.interactionClaimEpochs[jobId] = control.claimEpochs[1] ?? 0;
    this.fixtureClaimCreatedTicks[jobId] = claims.createdTicks[0] ?? 0;
    this.interactionClaimCreatedTicks[jobId] = claims.createdTicks[1] ?? 0;
    this.fixtureClaimLeaseExpiryTicks[jobId] = claims.leaseExpiryTicks[0] ?? 0;
    this.interactionClaimLeaseExpiryTicks[jobId] = claims.leaseExpiryTicks[1] ?? 0;
    this.recoveryTargetValues[jobId] = input.recoveryTargetValue;
    this.recoveryPerTickQ16[jobId] = input.recoveryPerTickQ16;
    this.recoveryProgressQ16[jobId] = 0;
    this.createdTicks[jobId] = control.claimCreatedTick;
    this.stepEnteredTicks[jobId] = control.adoptionTick;
    this.lastEffectTicks[jobId] = control.adoptionTick;
    this.effectPhases[jobId] = REST_EFFECT_NONE;
    this.interruptionPolicyCodes[jobId] = encodeRestInterruptionPolicy(
      input.interruptionPolicy ?? defaultPolicy(input.restKind),
    );
    this.requiredWorkQ16s[jobId] = work;
    this.readyToCompleteFlags[jobId] = 0;
    this.cleanupPendingFlags[jobId] = 0;
    this.pendingOutcomes[jobId] = REST_PENDING_NONE;
    this.pendingReasonCodes[jobId] = 0;
    this.pendingFailureCodes[jobId] = 0;
    this.pendingInterruptionCodes[jobId] = 0;
    this.returnedOnceFlags[jobId] = 0;
    this.jobGenerations[jobId] = control.jobGeneration;
    this.jobSlotVersions[jobId] = this.jobTokenOutput.slotVersion;
    this.jobCoreStepTickCounts[jobId] = 0;
    this.jobCoreAdoptionReservationVersions[jobId] = control.reservationReadVersion;
    this.jobCoreAdoptionDriverVersions[jobId] = control.expectedDriverVersion;
    this.jobCoreAdoptionSlotVersions[jobId] = this.jobTokenOutput.slotVersion;
    this.terminalReasonCodes[jobId] = REST_REASON_NONE;
    this.terminalOutcomes[jobId] = REST_PENDING_NONE;
    this.activeCount += 1;
    this.pathingCount += 1;
    this.storeVersion += 1;
    this.writeAdoptionSuccess(output);
  }

  rollbackNewlyAdoptedInto(
    control: RestNewlyAdoptedRollbackControl,
    jobCore: JobCoreStore,
    output: RestClaimAdoptionOutput,
  ): void {
    resetRestClaimAdoptionOutput(output);
    const jobId = control.jobId;
    if (!this.isExactRestRollbackPreflight(control, jobCore)) {
      output.reason = "rest_rollback_preflight_failed";
      return;
    }
    rollbackAndReleaseRunningAutonomyJobScalarsInto(
      jobCore,
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
    this.restoreRestOriginOrClear(jobId, this.jobTokenOutput.slotVersion);
    this.activeCount -= 1;
    this.pathingCount -= 1;
    this.storeVersion += 1;
    this.writeAdoptionSuccess(output);
  }

  beginAdoptedInto(
    input: RestAdoptedMutationInput,
    jobCore: JobCoreStore,
    output: RestAdoptedMutationOutput,
  ): void {
    resetRestAdoptedMutationOutput(output, this.storeVersion);
    const currentStep = this.stepCodes[input.jobId] ?? REST_JOB_INACTIVE;
    if (
      (currentStep === REST_JOB_RESTING || currentStep === REST_JOB_SLEEPING) &&
      this.lastEffectTicks[input.jobId] === input.tick &&
      this.matchesRestAdoptedMutation(input, currentStep) &&
      this.matchesCommittedRestRunningJob(input, jobCore)
    ) {
      writeRestAdoptedMutationSuccess(
        input.jobId,
        input.jobGeneration,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        this.storeVersion,
        this.reservationVersions[input.jobId] ?? 0,
        this.needOwnerVersions[input.jobId] ?? 0,
        this.lastNeedNextStoreVersions[input.jobId] ?? 0,
        false,
        true,
        (this.readyToCompleteFlags[input.jobId] ?? 0) === 1,
        0,
        undefined,
        output,
      );
      this.writeRestMutationMetrics(input.jobId, jobCore, output);
      return;
    }
    if (
      !this.matchesRestAdoptedMutation(input, REST_JOB_PATHING_TO_FIXTURE) ||
      this.effectPhases[input.jobId] !== REST_EFFECT_NONE ||
      this.cleanupPendingFlags[input.jobId] !== 0 ||
      this.pathingCount === 0 ||
      this.recoveringCount === 0xffff_ffff ||
      this.storeVersion === 0xffff_ffff ||
      !this.matchesCommittedRestActiveJob(input, jobCore, REST_JOB_PATHING_TO_FIXTURE)
    ) {
      output.reason = "rest.step_invalid";
      return;
    }
    jobCore.enterAutonomyStepInto(
      input.jobId,
      input.jobGeneration,
      input.owner,
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
    const jobId = input.jobId;
    this.stepCodes[jobId] =
      (this.restKindCodes[jobId] ?? 0) === REST_KIND_SLEEP ? REST_JOB_SLEEPING : REST_JOB_RESTING;
    this.stepEnteredTicks[jobId] = input.tick;
    this.lastEffectTicks[jobId] = input.tick;
    this.jobSlotVersions[jobId] = this.autonomyMutationOutput.slotVersion;
    this.jobCoreStepTickCounts[jobId] = 0;
    this.pathingCount -= 1;
    this.recoveringCount += 1;
    this.storeVersion += 1;
    writeRestAdoptedMutationSuccess(
      input.jobId,
      input.jobGeneration,
      this.autonomyMutationOutput.slotVersion,
      this.autonomyMutationOutput.version,
      this.storeVersion,
      this.reservationVersions[jobId] ?? 0,
      0,
      0,
      false,
      false,
      false,
      0,
      undefined,
      output,
    );
    this.writeRestMutationMetrics(jobId, jobCore, output);
  }

  tickAdoptedInto(
    input: RestAdoptedTickInput,
    needStore: NeedStore,
    jobCore: JobCoreStore,
    output: RestAdoptedMutationOutput,
  ): void {
    resetRestAdoptedMutationOutput(output, this.storeVersion);
    const jobId = input.jobId;
    const step = this.stepCodes[jobId] ?? REST_JOB_INACTIVE;
    if (
      !this.matchesRestAdoptedMutation(input, step) ||
      (step !== REST_JOB_RESTING && step !== REST_JOB_SLEEPING) ||
      this.cleanupPendingFlags[jobId] !== 0 ||
      (this.effectPhases[jobId] ?? 0) >= REST_EFFECT_CLEANUP_PENDING ||
      this.recoveringCount === 0 ||
      this.storeVersion === 0xffff_ffff
    ) {
      output.reason = "rest.step_invalid";
      return;
    }
    if (
      (this.lastEffectTicks[jobId] ?? 0) === input.tick &&
      (this.effectPhases[jobId] ?? 0) === REST_EFFECT_RECOVERY_APPLIED
    ) {
      if (
        !this.matchesCommittedRestRunningJob(input, jobCore) ||
        !this.matchesCommittedRestNeedEffect(input, needStore)
      ) {
        output.reason = "rest.job_core_failed";
        return;
      }
      writeRestAdoptedMutationSuccess(
        jobId,
        input.jobGeneration,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        this.storeVersion,
        this.reservationVersions[jobId] ?? 0,
        this.needOwnerVersions[jobId] ?? 0,
        needStore.version,
        false,
        true,
        (this.readyToCompleteFlags[jobId] ?? 0) === 1,
        0,
        undefined,
        output,
      );
      this.writeRestMutationMetrics(jobId, jobCore, output);
      return;
    }
    if (!this.matchesCommittedRestActiveJob(input, jobCore, step)) {
      output.reason = "rest.job_core_failed";
      return;
    }
    const previousProgress = this.recoveryProgressQ16[jobId] ?? 0;
    const deltaQ16 = this.recoveryPerTickQ16[jobId] ?? 0;
    const nextProgress = Math.min(0xffff_ffff, previousProgress + deltaQ16);
    const previousWhole = Math.floor(previousProgress / 65_536);
    const nextWhole = Math.floor(nextProgress / 65_536);
    const currentRest = needStore.readLaneValue(this.actorIds[jobId] ?? 0, NEED_LANE_REST);
    const target = this.recoveryTargetValues[jobId] ?? 0;
    const rawDelta = nextWhole > previousWhole ? nextWhole - previousWhole : 0;
    const recoveryDelta = Math.min(rawDelta, target > currentRest ? target - currentRest : 0);
    if (!this.matchesRestNeedMutation(input, needStore, currentRest, recoveryDelta)) {
      output.reason = "rest.need_update_failed";
      return;
    }
    jobCore.prepareAutonomyProgressScalarsInto(
      jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      deltaQ16,
      this.preparedProgress,
    );
    if (!this.preparedProgress.ok) {
      output.reason = this.preparedProgress.reason;
      return;
    }
    needStore.prepareLaneDeltaInto(input.needMutation, this.preparedNeed);
    if (!this.preparedNeed.ok) {
      output.reason = this.preparedNeed.reason;
      return;
    }
    const readyToComplete = this.preparedNeed.nextValue >= target;
    if (this.preparedNeed.changed) {
      commitPreparedChangedNeedLaneMutation(needStore, this.preparedNeed);
      this.commitRestRecoveryTail(input, jobCore, readyToComplete, output);
      return;
    }
    commitPreparedNoopNeedLaneMutation(needStore, this.preparedNeed);
    this.commitRestRecoveryTail(input, jobCore, readyToComplete, output);
  }

  terminalAdoptedInto(
    input: RestAdoptedTerminalInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: RestAdoptedMutationOutput,
  ): void {
    resetRestAdoptedMutationOutput(output, this.storeVersion);
    const jobId = input.jobId;
    const step = this.stepCodes[jobId] ?? REST_JOB_INACTIVE;
    if (!isExactRestTerminalRequestTuple(input)) {
      output.reason = "rest.step_invalid";
      return;
    }
    if (this.isRestTerminalDuplicate(input, ledger, jobCore)) {
      writeRestAdoptedMutationSuccess(
        jobId,
        input.jobGeneration,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        this.storeVersion,
        this.reservationVersions[jobId] ?? 0,
        0,
        0,
        false,
        true,
        true,
        0,
        input.outcome,
        output,
      );
      this.writeRestMutationMetrics(jobId, jobCore, output);
      return;
    }
    if (
      !this.matchesRestAdoptedMutation(input, step) ||
      this.cleanupPendingFlags[jobId] !== 0 ||
      isTerminalRestStep(step) ||
      (input.outcome === "completed" && (this.readyToCompleteFlags[jobId] ?? 0) !== 1)
    ) {
      output.reason = "rest.step_invalid";
      return;
    }
    if (!this.matchesCommittedRestActiveJob(input, jobCore, step)) {
      output.reason = "rest.job_core_failed";
      return;
    }
    if (
      !this.hasRestTerminalHeadroom(jobId, input.outcome, false) ||
      !this.hasRestLedgerReleaseHeadroom(input.expectedCurrentLedgerVersion, ledger)
    ) {
      output.reason = "rest.job_core_failed";
      return;
    }
    if (!this.prepareRestTerminal(input, jobCore)) {
      output.reason = this.preparedTerminal.reason ?? "rest.job_core_failed";
      return;
    }
    this.releaseRestClaims(input, ledger);
    if (!this.releaseOutput.ok) {
      const releaseReason = this.releaseOutput.reason;
      this.persistRestCleanupPending(input);
      writeRestAdoptedMutationSuccess(
        jobId,
        input.jobGeneration,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        this.storeVersion,
        this.releaseOutput.version,
        0,
        0,
        true,
        false,
        (this.readyToCompleteFlags[jobId] ?? 0) === 1,
        0,
        input.outcome,
        output,
      );
      output.ok = false;
      output.reason = releaseReason;
      this.writeRestMutationMetrics(jobId, jobCore, output);
      return;
    }
    this.commitRestTerminalTail(input, jobCore, output);
  }

  resumeCleanupInto(
    input: RestResumeCleanupInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: RestAdoptedMutationOutput,
  ): void {
    resetRestAdoptedMutationOutput(output, this.storeVersion);
    const jobId = input.jobId;
    if (
      !isExactRestTerminalRequestTuple(input) ||
      !this.matchesRestAdoptedMutation(input, this.stepCodes[jobId] ?? REST_JOB_INACTIVE) ||
      this.cleanupPendingFlags[jobId] !== 1 ||
      this.pendingOutcomes[jobId] !== encodeRestPendingOutcome(input.outcome) ||
      this.pendingReasonCodes[jobId] !== encodeRestReason(input.terminalReason) ||
      this.pendingFailureCodes[jobId] !== encodeRestPendingFailure(input.failureReason) ||
      this.pendingInterruptionCodes[jobId] !== encodeRestPendingInterruption(input.interruptionKind)
    ) {
      output.reason = "rest.step_invalid";
      return;
    }
    if (
      !this.matchesCommittedRestActiveJob(
        input,
        jobCore,
        this.stepCodes[jobId] ?? REST_JOB_INACTIVE,
      )
    ) {
      output.reason = "rest.job_core_failed";
      return;
    }
    if (
      !this.hasRestTerminalHeadroom(jobId, input.outcome, true) ||
      !this.hasRestLedgerReleaseHeadroom(input.expectedCurrentLedgerVersion, ledger)
    ) {
      output.reason = "rest.job_core_failed";
      return;
    }
    if (!this.prepareRestTerminal(input, jobCore)) {
      output.reason = this.preparedTerminal.reason ?? "rest.job_core_failed";
      return;
    }
    this.releaseRestClaims(input, ledger);
    if (!this.releaseOutput.ok) {
      writeRestAdoptedMutationSuccess(
        jobId,
        input.jobGeneration,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        this.storeVersion,
        this.releaseOutput.version,
        0,
        0,
        true,
        false,
        (this.readyToCompleteFlags[jobId] ?? 0) === 1,
        0,
        input.outcome,
        output,
      );
      output.ok = false;
      output.reason = this.releaseOutput.reason;
      this.writeRestMutationMetrics(jobId, jobCore, output);
      return;
    }
    this.commitRestTerminalTail(input, jobCore, output);
  }

  createJob(
    input: RestJobCreateInput,
    restStore: RestSleepStore,
    environment: M3EnvironmentProjection,
    needStore: NeedStore,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const validation = this.validateCreateInput(input, restStore, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "rest.job_already_active" };
    }

    const fixture = restStore.readFixture(input.fixtureId);
    if (fixture === undefined) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    const currentRest = needStore.readLaneValue(input.actorId, NEED_LANE_REST);
    if (input.recoveryTargetValue <= currentRest) {
      return { ok: false, reason: "rest.rejected_actor_not_tired" };
    }
    const requiredWorkQ16 = (input.recoveryTargetValue - currentRest) * 65_536;
    if (!Number.isSafeInteger(requiredWorkQ16) || requiredWorkQ16 > 0xffff_ffff) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }
    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: M3_REST_SLEEP_JOB_KIND,
        targetId: input.fixtureId,
        initialStep: "reserve",
        interruptionPolicy: input.interruptionPolicy ?? defaultPolicy(input.restKind),
        requiredWorkQ16,
        createdTick: input.createdTick,
      },
      registry,
    );

    if (!created.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.active[input.jobId] = 1;
    this.ownerIndexes[input.jobId] = input.owner.index;
    this.ownerGenerations[input.jobId] = input.owner.generation;
    this.actorIds[input.jobId] = input.actorId;
    this.fixtureIds[input.jobId] = input.fixtureId;
    this.restKindCodes[input.jobId] = encodeRestKind(input.restKind);
    this.stepCodes[input.jobId] = REST_JOB_CREATED;
    this.targetCellIndexes[input.jobId] = fixture.targetCellIndex;
    this.interactionSpotIds[input.jobId] = fixture.interactionSpotId;
    this.scheduleCodes[input.jobId] = encodeScheduleWindow(fixture.scheduleWindow);
    this.environmentVersions[input.jobId] = environment.version;
    this.needOwnerVersions[input.jobId] = needStore.readLaneOwnerVersion(
      input.actorId,
      NEED_LANE_REST,
    );
    this.lastNeedExpectedValues[input.jobId] = 0;
    this.lastNeedDeltas[input.jobId] = 0;
    this.lastNeedExpectedStoreVersions[input.jobId] = 0;
    this.lastNeedExpectedLaneVersions[input.jobId] = 0;
    this.lastNeedNextStoreVersions[input.jobId] = 0;
    this.lastNeedChangedFlags[input.jobId] = 0;
    this.reservationVersions[input.jobId] = 0;
    this.fixtureClaimIds[input.jobId] = M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[input.jobId] = M3_REST_FIXTURE_NONE;
    this.recoveryTargetValues[input.jobId] = input.recoveryTargetValue;
    this.recoveryPerTickQ16[input.jobId] = input.recoveryPerTickQ16;
    this.recoveryProgressQ16[input.jobId] = 0;
    this.stepEnteredTicks[input.jobId] = input.createdTick;
    this.createdTicks[input.jobId] = input.createdTick;
    this.lastEffectTicks[input.jobId] = input.createdTick;
    this.interruptionPolicyCodes[input.jobId] = encodeRestInterruptionPolicy(
      input.interruptionPolicy ?? defaultPolicy(input.restKind),
    );
    this.requiredWorkQ16s[input.jobId] = requiredWorkQ16;
    this.readyToCompleteFlags[input.jobId] = 0;
    this.jobGenerations[input.jobId] = 0;
    this.terminalReasonCodes[input.jobId] = REST_REASON_NONE;
    this.activeCount += 1;
    return this.finish(input.jobId);
  }

  reserveFixture(
    jobId: number,
    tick: Tick,
    leaseExpiryTick: Tick,
    restStore: RestSleepStore,
    registry: EntityRegistry,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    if (this.isPositiveGenerationJob(jobId)) {
      return { ok: false, reason: "rest.job_core_failed" };
    }
    const ready = this.validateStep(jobId, REST_JOB_CREATED, tick);
    if (!ready.ok) {
      return ready;
    }

    const fixtureId = this.fixtureIds[jobId] ?? M3_REST_FIXTURE_NONE;
    const fixture = restStore.readFixture(fixtureId);
    if (fixture === undefined) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    this.reservationAttemptCount += 1;
    this.legacyAcquireOwnerScratch.index = this.ownerIndexes[jobId] ?? 0;
    this.legacyAcquireOwnerScratch.generation = this.ownerGenerations[jobId] ?? 0;
    this.legacyAcquireTargetScratch.index = fixture.entity.index;
    this.legacyAcquireTargetScratch.generation = fixture.entity.generation;
    this.legacyInteractionClaim.spotId = fixture.interactionSpotId;
    this.legacyAcquireRequest.jobId = jobId;
    this.legacyAcquireRequest.createdTick = tick;
    this.legacyAcquireRequest.leaseExpiryTick = leaseExpiryTick;
    ledger.acquireInto(
      this.legacyAcquireRequest,
      registry,
      this.legacyAcquireScratch,
      this.legacyAcquireClaimIds,
      this.legacyAcquireOutput,
    );

    if (!this.legacyAcquireOutput.ok) {
      this.reservationFailureCount += 1;
      return { ok: false, reason: this.legacyAcquireOutput.reason ?? "rest.rejected_reservation" };
    }

    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      this.legacyReleaseClaimIds[0] = this.legacyAcquireClaimIds[0] ?? M3_REST_FIXTURE_NONE;
      this.legacyReleaseClaimIds[1] = this.legacyAcquireClaimIds[1] ?? M3_REST_FIXTURE_NONE;
      const released = ledger.releaseClaims(this.legacyReleaseClaimIds);
      if (!released.ok) {
        return { ok: false, reason: released.reason };
      }
      this.cleanupReleaseCount += released.releasedCount;
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.fixtureClaimIds[jobId] = this.legacyAcquireClaimIds[0] ?? M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = this.legacyAcquireClaimIds[1] ?? M3_REST_FIXTURE_NONE;
    this.fixtureClaimEpochs[jobId] = this.legacyAcquireOutput.version;
    this.interactionClaimEpochs[jobId] = this.legacyAcquireOutput.version;
    this.fixtureClaimCreatedTicks[jobId] = tick;
    this.interactionClaimCreatedTicks[jobId] = tick;
    this.fixtureClaimLeaseExpiryTicks[jobId] = leaseExpiryTick;
    this.interactionClaimLeaseExpiryTicks[jobId] = leaseExpiryTick;
    this.reservationVersions[jobId] = this.legacyAcquireOutput.version;
    this.stepCodes[jobId] = REST_JOB_PATHING_TO_FIXTURE;
    this.stepEnteredTicks[jobId] = tick;
    this.lastEffectTicks[jobId] = tick;
    this.pathingCount += 1;
    return this.finish(jobId);
  }

  beginRecovery(jobId: number, tick: Tick, jobCore: JobCoreStore): RestSleepMutationResult {
    if (this.isPositiveGenerationJob(jobId)) {
      return { ok: false, reason: "rest.job_core_failed" };
    }
    const ready = this.validateStep(jobId, REST_JOB_PATHING_TO_FIXTURE, tick);
    if (!ready.ok) {
      return ready;
    }

    const entered = jobCore.enterStep(jobId, "interact", tick);
    if (!entered.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.stepCodes[jobId] =
      (this.restKindCodes[jobId] ?? REST_KIND_REST) === REST_KIND_SLEEP
        ? REST_JOB_SLEEPING
        : REST_JOB_RESTING;
    this.stepEnteredTicks[jobId] = tick;
    this.lastEffectTicks[jobId] = tick;
    this.pathingCount -= 1;
    this.recoveringCount += 1;
    return this.finish(jobId);
  }

  tickRecovery(
    jobId: number,
    tick: Tick,
    needStore: NeedStore,
    jobCore: JobCoreStore,
    ledger: ReservationLedger,
    dirtySink?: NeedDirtySink,
  ): RestSleepMutationResult {
    if (this.isPositiveGenerationJob(jobId)) {
      return { ok: false, reason: "rest.job_core_failed" };
    }
    const validation = this.validateRecoveryStep(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const deltaQ16 = this.recoveryPerTickQ16[jobId] ?? 0;
    const actorId = this.actorIds[jobId] ?? 0;
    const targetValue = this.recoveryTargetValues[jobId] ?? NEED_VALUE_MAX;
    const currentRest = needStore.readLaneValue(actorId, NEED_LANE_REST);
    const previousProgress = this.recoveryProgressQ16[jobId] ?? 0;
    const nextProgress = clampUint32(previousProgress + deltaQ16);
    const previousWhole = previousProgress >>> 16;
    const nextWhole = nextProgress >>> 16;
    const rawDelta = nextWhole > previousWhole ? nextWhole - previousWhole : 0;
    const recoveryDelta = Math.min(
      rawDelta,
      targetValue > currentRest ? targetValue - currentRest : 0,
    );

    if (recoveryDelta > 0 && !needStore.isActorActive(actorId)) {
      return { ok: false, reason: "rest.need_update_failed" };
    }

    const ticked = jobCore.tickJob(jobId, tick, deltaQ16);
    if (!ticked.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.recoveryProgressQ16[jobId] = nextProgress;
    this.lastEffectTicks[jobId] = tick;
    this.effectPhases[jobId] = REST_EFFECT_RECOVERY_APPLIED;

    if (recoveryDelta > 0) {
      const mutation = needStore.applyLaneDelta(
        {
          actorId,
          lane: NEED_LANE_REST,
          tick,
          reason: "need.external_delta",
          sourceSystemId: M3_REST_SLEEP_JOB_KIND,
          sourceEventId: jobId,
        },
        recoveryDelta,
      );
      if (!mutation.ok) {
        return { ok: false, reason: "rest.need_update_failed" };
      }
      dirtySink?.markDirty(actorId, NEED_LANE_REST);
      this.needOwnerVersions[jobId] = mutation.ownerVersion;
    }

    const updatedRest = needStore.readLaneValue(actorId, NEED_LANE_REST);
    if (updatedRest >= targetValue || ticked.readyToComplete) {
      return this.complete(jobId, tick, ledger, jobCore);
    }

    return this.finish(jobId);
  }

  cancel(
    jobId: number,
    tick: Tick,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    if (this.isPositiveGenerationJob(jobId)) {
      return { ok: false, reason: "rest.job_core_failed" };
    }
    const validation = this.validateTerminalInput(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const cancelled = jobCore.cancelJob(jobId, tick, ledger);
    if (!cancelled.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.cleanupReleaseCount += cancelled.releasedReservations;
    this.cancelledJobCount += 1;
    this.reservationVersions[jobId] = ledger.version;
    this.markTerminal(jobId, REST_JOB_CANCELLED, "rest.cancelled", tick);
    return this.finish(jobId);
  }

  fail(
    jobId: number,
    tick: Tick,
    reason: RestSleepReason,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    if (this.isPositiveGenerationJob(jobId)) {
      return { ok: false, reason: "rest.job_core_failed" };
    }
    const validation = this.validateTerminalInput(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const failed = jobCore.failJob(jobId, tick, mapRestFailureToJob(reason), ledger);
    if (!failed.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.cleanupReleaseCount += failed.releasedReservations;
    this.failedJobCount += 1;
    this.reservationVersions[jobId] = ledger.version;
    this.markTerminal(jobId, REST_JOB_FAILED, reason, tick);
    return this.finish(jobId);
  }

  interrupt(
    jobId: number,
    kind: JobInterruptionKind,
    tick: Tick,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    if (this.isPositiveGenerationJob(jobId)) {
      return { ok: false, reason: "rest.job_core_failed" };
    }
    const validation = this.validateTerminalInput(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const interrupted = jobCore.requestInterruption(jobId, kind, tick, ledger);
    if (!interrupted.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    if (!interrupted.interrupted) {
      return { ok: false, reason: "job.interruption_denied" };
    }

    this.cleanupReleaseCount += interrupted.releasedReservations;
    this.cancelledJobCount += 1;
    this.interruptedJobCount += 1;
    this.reservationVersions[jobId] = ledger.version;
    this.markTerminal(jobId, REST_JOB_CANCELLED, "job.interrupted_safe_point", tick);
    this.interruptedCount += 1;
    return this.finish(jobId);
  }

  readJob(jobId: number): RestJobView | undefined {
    if (!this.isActiveJob(jobId) || (this.jobGenerations[jobId] ?? 0) !== 0) {
      return undefined;
    }

    return this.createJobView(jobId);
  }

  readAdoptedJobInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedJobSlotVersion: number,
    expectedDriverVersion: number,
    output: RestAdoptedJobIntoOutput,
  ): void {
    resetRestAdoptedJobOutput(
      output,
      this.storeVersion,
      this.activeCount,
      this.pathingCount,
      this.recoveringCount,
      this.completedCount,
      this.canceledCount,
      this.failedCount,
      this.interruptedCount,
      this.reservationAttemptCount,
      this.reservationFailureCount,
      this.cleanupReleaseCount,
      this.completedJobCount,
      this.cancelledJobCount,
      this.failedJobCount,
      this.interruptedJobCount,
    );
    if (
      output.claimIds.length !== 8 ||
      output.claimEpochs.length !== 8 ||
      output.claimCreatedTicks.length !== 8 ||
      output.claimLeaseExpiryTicks.length !== 8 ||
      !isIndexInRange(jobId, this.capacity) ||
      jobGeneration === 0 ||
      (this.jobGenerations[jobId] ?? 0) !== jobGeneration ||
      (this.ownerIndexes[jobId] ?? 0) !== ownerIndex ||
      (this.ownerGenerations[jobId] ?? 0) !== ownerGeneration ||
      (this.jobSlotVersions[jobId] ?? 0) !== expectedJobSlotVersion ||
      this.storeVersion !== expectedDriverVersion
    ) {
      output.reason = "rest.job_not_active";
      return;
    }
    output.ok = true;
    output.active = (this.active[jobId] ?? 0) === 1;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = ownerIndex;
    output.ownerGeneration = ownerGeneration;
    output.jobSlotVersion = expectedJobSlotVersion;
    output.driverVersion = this.storeVersion;
    output.jobCoreStepTickCount = this.jobCoreStepTickCounts[jobId] ?? 0;
    output.jobCoreAdoptionReservationVersion = this.jobCoreAdoptionReservationVersions[jobId] ?? 0;
    output.jobCoreAdoptionDriverVersion = this.jobCoreAdoptionDriverVersions[jobId] ?? 0;
    output.jobCoreAdoptionSlotVersion = this.jobCoreAdoptionSlotVersions[jobId] ?? 0;
    output.actorId = this.actorIds[jobId] ?? 0;
    output.fixtureId = this.fixtureIds[jobId] ?? 0;
    output.restKind = decodeRestKind(this.restKindCodes[jobId] ?? 0);
    output.step = decodeRestJobStep(this.stepCodes[jobId] ?? 0);
    output.targetCellIndex = this.targetCellIndexes[jobId] ?? 0;
    output.interactionSpotId = this.interactionSpotIds[jobId] ?? 0;
    output.scheduleWindow = decodeScheduleWindow(this.scheduleCodes[jobId] ?? 0);
    output.environmentVersion = this.environmentVersions[jobId] ?? 0;
    output.needOwnerVersion = this.needOwnerVersions[jobId] ?? 0;
    output.lastNeedExpectedValue = this.lastNeedExpectedValues[jobId] ?? 0;
    output.lastNeedDelta = this.lastNeedDeltas[jobId] ?? 0;
    output.lastNeedExpectedStoreVersion = this.lastNeedExpectedStoreVersions[jobId] ?? 0;
    output.lastNeedExpectedLaneVersion = this.lastNeedExpectedLaneVersions[jobId] ?? 0;
    output.lastNeedNextStoreVersion = this.lastNeedNextStoreVersions[jobId] ?? 0;
    output.lastNeedChanged = this.lastNeedChangedFlags[jobId] ?? 0;
    output.reservationVersion = this.reservationVersions[jobId] ?? 0;
    output.claimIds[0] = this.fixtureClaimIds[jobId] ?? M3_REST_FIXTURE_NONE;
    output.claimIds[1] = this.interactionClaimIds[jobId] ?? M3_REST_FIXTURE_NONE;
    output.claimEpochs[0] = this.fixtureClaimEpochs[jobId] ?? 0;
    output.claimEpochs[1] = this.interactionClaimEpochs[jobId] ?? 0;
    output.claimCreatedTicks[0] = this.fixtureClaimCreatedTicks[jobId] ?? 0;
    output.claimCreatedTicks[1] = this.interactionClaimCreatedTicks[jobId] ?? 0;
    output.claimLeaseExpiryTicks[0] = this.fixtureClaimLeaseExpiryTicks[jobId] ?? 0;
    output.claimLeaseExpiryTicks[1] = this.interactionClaimLeaseExpiryTicks[jobId] ?? 0;
    output.createdTick = this.createdTicks[jobId] ?? 0;
    output.recoveryTargetValue = this.recoveryTargetValues[jobId] ?? 0;
    output.recoveryPerTickQ16 = this.recoveryPerTickQ16[jobId] ?? 0;
    output.recoveryProgressQ16 = this.recoveryProgressQ16[jobId] ?? 0;
    output.stepEnteredTick = this.stepEnteredTicks[jobId] ?? 0;
    output.lastEffectTick = this.lastEffectTicks[jobId] ?? 0;
    output.effectPhase = this.effectPhases[jobId] ?? 0;
    output.cleanupPending = this.cleanupPendingFlags[jobId] ?? 0;
    output.pendingOutcome = this.pendingOutcomes[jobId] ?? 0;
    output.pendingReason = decodeRestReason(this.pendingReasonCodes[jobId] ?? 0);
    output.pendingFailure = decodeRestPendingFailure(this.pendingFailureCodes[jobId] ?? 0);
    output.pendingInterruption = decodeRestPendingInterruption(
      this.pendingInterruptionCodes[jobId] ?? 0,
    );
    output.interruptionPolicy = decodeRestInterruptionPolicy(
      this.interruptionPolicyCodes[jobId] ?? 0,
    );
    output.readyToComplete = (this.readyToCompleteFlags[jobId] ?? 0) === 1;
    output.returnedOnce = this.returnedOnceFlags[jobId] ?? 0;
    output.terminalReason = decodeRestReason(this.terminalReasonCodes[jobId] ?? 0);
    output.terminalOutcome = decodeRestPendingOutcome(this.terminalOutcomes[jobId] ?? 0);
  }

  createSnapshot(): RestJobDriverSnapshot {
    const rows: RestJobDriverSnapshotRow[] = [];
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      rows.push(this.createSnapshotRow(jobId));
    }
    return {
      snapshotVersion: M3_REST_SLEEP_STORE_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      pathingCount: this.pathingCount,
      recoveringCount: this.recoveringCount,
      completedCount: this.completedCount,
      canceledCount: this.canceledCount,
      failedCount: this.failedCount,
      interruptedCount: this.interruptedCount,
      reservationAttemptCount: this.reservationAttemptCount,
      reservationFailureCount: this.reservationFailureCount,
      cleanupReleaseCount: this.cleanupReleaseCount,
      cumulativeCompletedCount: this.completedJobCount,
      cumulativeCanceledCount: this.cancelledJobCount,
      cumulativeFailedCount: this.failedJobCount,
      cumulativeInterruptedCount: this.interruptedJobCount,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): RestSleepMutationResult {
    const shape = validateRestJobSnapshotShape(snapshot, this.capacity);
    if (!shape.ok) {
      return shape;
    }

    this.clearAll();
    for (const row of shape.snapshot.rows) {
      this.restoreSnapshotRow(row);
    }
    this.storeVersion = shape.snapshot.storeVersion;
    this.activeCount = shape.snapshot.activeCount;
    this.pathingCount = shape.snapshot.pathingCount;
    this.recoveringCount = shape.snapshot.recoveringCount;
    this.completedCount = shape.snapshot.completedCount;
    this.canceledCount = shape.snapshot.canceledCount;
    this.failedCount = shape.snapshot.failedCount;
    this.interruptedCount = shape.snapshot.interruptedCount;
    this.reservationAttemptCount = shape.snapshot.reservationAttemptCount;
    this.reservationFailureCount = shape.snapshot.reservationFailureCount;
    this.cleanupReleaseCount = shape.snapshot.cleanupReleaseCount;
    this.completedJobCount = shape.snapshot.cumulativeCompletedCount;
    this.cancelledJobCount = shape.snapshot.cumulativeCanceledCount;
    this.failedJobCount = shape.snapshot.cumulativeFailedCount;
    this.interruptedJobCount = shape.snapshot.cumulativeInterruptedCount;
    return { ok: true, id: this.activeCount, version: this.storeVersion };
  }

  createMetrics(): Pick<
    RestSleepMetrics,
    | "version"
    | "activeJobCount"
    | "reservationAttemptCount"
    | "reservationFailureCount"
    | "cleanupReleaseCount"
    | "completedJobCount"
    | "cancelledJobCount"
    | "failedJobCount"
    | "interruptedJobCount"
  > {
    return {
      version: this.storeVersion,
      activeJobCount: this.activeCount,
      reservationAttemptCount: this.reservationAttemptCount,
      reservationFailureCount: this.reservationFailureCount,
      cleanupReleaseCount: this.cleanupReleaseCount,
      completedJobCount: this.completedJobCount,
      cancelledJobCount: this.cancelledJobCount,
      failedJobCount: this.failedJobCount,
      interruptedJobCount: this.interruptedJobCount,
    };
  }

  private complete(
    jobId: number,
    tick: Tick,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const completed = jobCore.completeJob(jobId, tick, ledger);
    if (!completed.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.cleanupReleaseCount += completed.releasedReservations;
    this.completedJobCount += 1;
    this.reservationVersions[jobId] = ledger.version;
    this.markTerminal(jobId, REST_JOB_COMPLETE, "rest.completed", tick);
    return this.finish(jobId);
  }

  private validateCreateInput(
    input: RestJobCreateInput,
    restStore: RestSleepStore,
    registry: EntityRegistry,
  ): RestSleepMutationResult {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "rest.job_id_out_of_range" };
    }

    if (!registry.isAlive(input.owner)) {
      return { ok: false, reason: "rest.fixture_entity_invalid" };
    }

    const fixture = restStore.readFixture(input.fixtureId);
    if (fixture?.restKind !== input.restKind) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    if (
      !isSafeUint32(input.actorId) ||
      !isSafeTick(input.createdTick) ||
      !isNeedValue(input.recoveryTargetValue) ||
      !isPositiveUint32(input.recoveryPerTickQ16)
    ) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    return { ok: true, id: input.jobId, version: this.storeVersion };
  }

  private validateStep(jobId: number, step: number, tick: Tick): RestSleepMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "rest.job_not_active" };
    }

    if ((this.stepCodes[jobId] ?? REST_JOB_INACTIVE) !== step) {
      return { ok: false, reason: "rest.step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "rest.tick_invalid" };
    }

    return { ok: true, id: jobId, version: this.storeVersion };
  }

  private validateRecoveryStep(jobId: number, tick: Tick): RestSleepMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "rest.job_not_active" };
    }

    const step = this.stepCodes[jobId] ?? REST_JOB_INACTIVE;
    if (step !== REST_JOB_RESTING && step !== REST_JOB_SLEEPING) {
      return { ok: false, reason: "rest.step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "rest.tick_invalid" };
    }

    return { ok: true, id: jobId, version: this.storeVersion };
  }

  private validateTerminalInput(jobId: number, tick: Tick): RestSleepMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "rest.job_not_active" };
    }

    if (isTerminalRestStep(this.stepCodes[jobId] ?? REST_JOB_INACTIVE)) {
      return { ok: false, reason: "rest.step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "rest.tick_invalid" };
    }

    return { ok: true, id: jobId, version: this.storeVersion };
  }

  private markTerminal(jobId: number, step: number, reason: RestSleepReason, tick: Tick): void {
    const previousStep = this.stepCodes[jobId] ?? REST_JOB_INACTIVE;
    if (previousStep === REST_JOB_PATHING_TO_FIXTURE) this.pathingCount -= 1;
    if (previousStep === REST_JOB_RESTING || previousStep === REST_JOB_SLEEPING) {
      this.recoveringCount -= 1;
    }
    if (step === REST_JOB_COMPLETE) this.completedCount += 1;
    if (step === REST_JOB_CANCELLED) this.canceledCount += 1;
    if (step === REST_JOB_FAILED) this.failedCount += 1;
    this.stepCodes[jobId] = step;
    this.terminalReasonCodes[jobId] = encodeRestReason(reason);
    this.terminalOutcomes[jobId] =
      step === REST_JOB_COMPLETE
        ? REST_PENDING_COMPLETE
        : step === REST_JOB_FAILED
          ? REST_PENDING_FAILED
          : reason === "job.interrupted_safe_point"
            ? REST_PENDING_INTERRUPTED
            : REST_PENDING_CANCELED;
    this.fixtureClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.fixtureClaimEpochs[jobId] = 0;
    this.interactionClaimEpochs[jobId] = 0;
    this.fixtureClaimCreatedTicks[jobId] = 0;
    this.interactionClaimCreatedTicks[jobId] = 0;
    this.fixtureClaimLeaseExpiryTicks[jobId] = 0;
    this.interactionClaimLeaseExpiryTicks[jobId] = 0;
    this.stepEnteredTicks[jobId] = tick;
    this.lastEffectTicks[jobId] = tick;
    this.effectPhases[jobId] = REST_EFFECT_TERMINAL;
  }

  private createJobView(jobId: number): RestJobView {
    return {
      jobId,
      owner: this.readOwner(jobId),
      actorId: this.actorIds[jobId] ?? 0,
      fixtureId: this.fixtureIds[jobId] ?? M3_REST_FIXTURE_NONE,
      restKind: decodeRestKind(this.restKindCodes[jobId] ?? REST_KIND_REST),
      step: decodeRestJobStep(this.stepCodes[jobId] ?? REST_JOB_INACTIVE),
      targetCellIndex: this.targetCellIndexes[jobId] ?? 0,
      interactionSpotId: this.interactionSpotIds[jobId] ?? 0,
      scheduleWindow: decodeScheduleWindow(this.scheduleCodes[jobId] ?? 0),
      environmentVersion: this.environmentVersions[jobId] ?? 0,
      needOwnerVersion: this.needOwnerVersions[jobId] ?? 0,
      reservationVersion: this.reservationVersions[jobId] ?? 0,
      fixtureClaimId: this.fixtureClaimIds[jobId] ?? M3_REST_FIXTURE_NONE,
      interactionClaimId: this.interactionClaimIds[jobId] ?? M3_REST_FIXTURE_NONE,
      recoveryTargetValue: this.recoveryTargetValues[jobId] ?? 0,
      recoveryPerTickQ16: this.recoveryPerTickQ16[jobId] ?? 0,
      recoveryProgressQ16: this.recoveryProgressQ16[jobId] ?? 0,
      stepEnteredTick: this.stepEnteredTicks[jobId] ?? 0,
      terminalReason: decodeRestReason(this.terminalReasonCodes[jobId] ?? REST_REASON_NONE),
    };
  }

  private createSnapshotRow(jobId: number): RestJobDriverSnapshotRow {
    return {
      jobId,
      active: this.active[jobId] ?? 0,
      ownerIndex: this.ownerIndexes[jobId] ?? 0,
      ownerGeneration: this.ownerGenerations[jobId] ?? 0,
      actorId: this.actorIds[jobId] ?? 0,
      fixtureId: this.fixtureIds[jobId] ?? M3_REST_FIXTURE_NONE,
      restKindCode: this.restKindCodes[jobId] ?? 0,
      stepCode: this.stepCodes[jobId] ?? REST_JOB_INACTIVE,
      targetCellIndex: this.targetCellIndexes[jobId] ?? 0,
      interactionSpotId: this.interactionSpotIds[jobId] ?? 0,
      scheduleCode: this.scheduleCodes[jobId] ?? 0,
      environmentVersion: this.environmentVersions[jobId] ?? 0,
      needOwnerVersion: this.needOwnerVersions[jobId] ?? 0,
      lastNeedExpectedValue: this.lastNeedExpectedValues[jobId] ?? 0,
      lastNeedDelta: this.lastNeedDeltas[jobId] ?? 0,
      lastNeedExpectedStoreVersion: this.lastNeedExpectedStoreVersions[jobId] ?? 0,
      lastNeedExpectedLaneVersion: this.lastNeedExpectedLaneVersions[jobId] ?? 0,
      lastNeedNextStoreVersion: this.lastNeedNextStoreVersions[jobId] ?? 0,
      lastNeedChanged: this.lastNeedChangedFlags[jobId] ?? 0,
      reservationVersion: this.reservationVersions[jobId] ?? 0,
      claimIds: [
        this.fixtureClaimIds[jobId] ?? M3_REST_FIXTURE_NONE,
        this.interactionClaimIds[jobId] ?? M3_REST_FIXTURE_NONE,
      ],
      claimEpochs: [this.fixtureClaimEpochs[jobId] ?? 0, this.interactionClaimEpochs[jobId] ?? 0],
      claimCreatedTicks: [
        this.fixtureClaimCreatedTicks[jobId] ?? 0,
        this.interactionClaimCreatedTicks[jobId] ?? 0,
      ],
      claimLeaseExpiryTicks: [
        this.fixtureClaimLeaseExpiryTicks[jobId] ?? 0,
        this.interactionClaimLeaseExpiryTicks[jobId] ?? 0,
      ],
      jobGeneration: this.jobGenerations[jobId] ?? 0,
      jobSlotVersion: this.jobSlotVersions[jobId] ?? 0,
      jobCoreStepTickCount: this.jobCoreStepTickCounts[jobId] ?? 0,
      jobCoreAdoptionReservationVersion: this.jobCoreAdoptionReservationVersions[jobId] ?? 0,
      jobCoreAdoptionDriverVersion: this.jobCoreAdoptionDriverVersions[jobId] ?? 0,
      jobCoreAdoptionSlotVersion: this.jobCoreAdoptionSlotVersions[jobId] ?? 0,
      createdTick: this.createdTicks[jobId] ?? 0,
      recoveryTargetValue: this.recoveryTargetValues[jobId] ?? 0,
      recoveryPerTickQ16: this.recoveryPerTickQ16[jobId] ?? 0,
      recoveryProgressQ16: this.recoveryProgressQ16[jobId] ?? 0,
      stepEnteredTick: this.stepEnteredTicks[jobId] ?? 0,
      lastEffectTick: this.lastEffectTicks[jobId] ?? 0,
      effectPhase: this.effectPhases[jobId] ?? 0,
      interruptionPolicyCode: this.interruptionPolicyCodes[jobId] ?? 0,
      requiredWorkQ16: this.requiredWorkQ16s[jobId] ?? 0,
      readyToComplete: this.readyToCompleteFlags[jobId] ?? 0,
      cleanupPending: this.cleanupPendingFlags[jobId] ?? 0,
      pendingOutcome: this.pendingOutcomes[jobId] ?? 0,
      pendingReasonCode: this.pendingReasonCodes[jobId] ?? 0,
      pendingFailureCode: this.pendingFailureCodes[jobId] ?? 0,
      pendingInterruptionCode: this.pendingInterruptionCodes[jobId] ?? 0,
      returnedOnce: this.returnedOnceFlags[jobId] ?? 0,
      terminalReasonCode: this.terminalReasonCodes[jobId] ?? 0,
      terminalOutcome: this.terminalOutcomes[jobId] ?? REST_PENDING_NONE,
      origin: this.createOriginSnapshot(jobId),
    };
  }

  private createOriginSnapshot(jobId: number): RestJobDriverSnapshotOrigin {
    return {
      present: this.originPresent[jobId] ?? 0,
      ownerIndex: this.originOwnerIndexes[jobId] ?? 0,
      ownerGeneration: this.originOwnerGenerations[jobId] ?? 0,
      actorId: this.originActorIds[jobId] ?? 0,
      fixtureId: this.originFixtureIds[jobId] ?? M3_REST_FIXTURE_NONE,
      restKindCode: this.originRestKindCodes[jobId] ?? 0,
      stepCode: this.originStepCodes[jobId] ?? 0,
      targetCellIndex: this.originTargetCellIndexes[jobId] ?? 0,
      interactionSpotId: this.originInteractionSpotIds[jobId] ?? 0,
      scheduleCode: this.originScheduleCodes[jobId] ?? 0,
      environmentVersion: this.originEnvironmentVersions[jobId] ?? 0,
      needOwnerVersion: this.originNeedOwnerVersions[jobId] ?? 0,
      lastNeedExpectedValue: this.originLastNeedExpectedValues[jobId] ?? 0,
      lastNeedDelta: this.originLastNeedDeltas[jobId] ?? 0,
      lastNeedExpectedStoreVersion: this.originLastNeedExpectedStoreVersions[jobId] ?? 0,
      lastNeedExpectedLaneVersion: this.originLastNeedExpectedLaneVersions[jobId] ?? 0,
      lastNeedNextStoreVersion: this.originLastNeedNextStoreVersions[jobId] ?? 0,
      lastNeedChanged: this.originLastNeedChangedFlags[jobId] ?? 0,
      reservationVersion: this.originReservationVersions[jobId] ?? 0,
      jobGeneration: this.originJobGenerations[jobId] ?? 0,
      jobSlotVersion: this.originJobSlotVersions[jobId] ?? 0,
      jobCoreStepTickCount: this.originJobCoreStepTickCounts[jobId] ?? 0,
      jobCoreAdoptionReservationVersion: this.originJobCoreAdoptionReservationVersions[jobId] ?? 0,
      jobCoreAdoptionDriverVersion: this.originJobCoreAdoptionDriverVersions[jobId] ?? 0,
      jobCoreAdoptionSlotVersion: this.originJobCoreAdoptionSlotVersions[jobId] ?? 0,
      createdTick: this.originCreatedTicks[jobId] ?? 0,
      recoveryTargetValue: this.originRecoveryTargetValues[jobId] ?? 0,
      recoveryPerTickQ16: this.originRecoveryPerTickQ16s[jobId] ?? 0,
      recoveryProgressQ16: this.originRecoveryProgressQ16s[jobId] ?? 0,
      stepEnteredTick: this.originStepEnteredTicks[jobId] ?? 0,
      lastEffectTick: this.originLastEffectTicks[jobId] ?? 0,
      effectPhase: this.originEffectPhases[jobId] ?? 0,
      interruptionPolicyCode: this.originInterruptionPolicyCodes[jobId] ?? 0,
      requiredWorkQ16: this.originRequiredWorkQ16s[jobId] ?? 0,
      readyToComplete: this.originReadyToCompleteFlags[jobId] ?? 0,
      terminalReasonCode: this.originTerminalReasonCodes[jobId] ?? 0,
      terminalOutcome: this.originTerminalOutcomes[jobId] ?? REST_PENDING_NONE,
      terminalFailureCode: this.originTerminalFailureCodes[jobId] ?? 0,
      terminalInterruptionCode: this.originTerminalInterruptionCodes[jobId] ?? 0,
    };
  }

  private restoreSnapshotRow(row: RestJobDriverSnapshotRow): void {
    const id = row.jobId;
    this.active[id] = row.active;
    this.ownerIndexes[id] = row.ownerIndex;
    this.ownerGenerations[id] = row.ownerGeneration;
    this.actorIds[id] = row.actorId;
    this.fixtureIds[id] = row.fixtureId;
    this.restKindCodes[id] = row.restKindCode;
    this.stepCodes[id] = row.stepCode;
    this.targetCellIndexes[id] = row.targetCellIndex;
    this.interactionSpotIds[id] = row.interactionSpotId;
    this.scheduleCodes[id] = row.scheduleCode;
    this.environmentVersions[id] = row.environmentVersion;
    this.needOwnerVersions[id] = row.needOwnerVersion;
    this.lastNeedExpectedValues[id] = row.lastNeedExpectedValue;
    this.lastNeedDeltas[id] = row.lastNeedDelta;
    this.lastNeedExpectedStoreVersions[id] = row.lastNeedExpectedStoreVersion;
    this.lastNeedExpectedLaneVersions[id] = row.lastNeedExpectedLaneVersion;
    this.lastNeedNextStoreVersions[id] = row.lastNeedNextStoreVersion;
    this.lastNeedChangedFlags[id] = row.lastNeedChanged;
    this.reservationVersions[id] = row.reservationVersion;
    this.fixtureClaimIds[id] = row.claimIds[0] ?? M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[id] = row.claimIds[1] ?? M3_REST_FIXTURE_NONE;
    this.fixtureClaimEpochs[id] = row.claimEpochs[0] ?? 0;
    this.interactionClaimEpochs[id] = row.claimEpochs[1] ?? 0;
    this.fixtureClaimCreatedTicks[id] = row.claimCreatedTicks[0] ?? 0;
    this.interactionClaimCreatedTicks[id] = row.claimCreatedTicks[1] ?? 0;
    this.fixtureClaimLeaseExpiryTicks[id] = row.claimLeaseExpiryTicks[0] ?? 0;
    this.interactionClaimLeaseExpiryTicks[id] = row.claimLeaseExpiryTicks[1] ?? 0;
    this.jobGenerations[id] = row.jobGeneration;
    this.jobSlotVersions[id] = row.jobSlotVersion;
    this.jobCoreStepTickCounts[id] = row.jobCoreStepTickCount;
    this.jobCoreAdoptionReservationVersions[id] = row.jobCoreAdoptionReservationVersion;
    this.jobCoreAdoptionDriverVersions[id] = row.jobCoreAdoptionDriverVersion;
    this.jobCoreAdoptionSlotVersions[id] = row.jobCoreAdoptionSlotVersion;
    this.createdTicks[id] = row.createdTick;
    this.recoveryTargetValues[id] = row.recoveryTargetValue;
    this.recoveryPerTickQ16[id] = row.recoveryPerTickQ16;
    this.recoveryProgressQ16[id] = row.recoveryProgressQ16;
    this.stepEnteredTicks[id] = row.stepEnteredTick;
    this.lastEffectTicks[id] = row.lastEffectTick;
    this.effectPhases[id] = row.effectPhase;
    this.cleanupPendingFlags[id] = row.cleanupPending;
    this.interruptionPolicyCodes[id] = row.interruptionPolicyCode;
    this.requiredWorkQ16s[id] = row.requiredWorkQ16;
    this.readyToCompleteFlags[id] = row.readyToComplete;
    this.pendingOutcomes[id] = row.pendingOutcome;
    this.pendingReasonCodes[id] = row.pendingReasonCode;
    this.pendingFailureCodes[id] = row.pendingFailureCode;
    this.pendingInterruptionCodes[id] = row.pendingInterruptionCode;
    this.returnedOnceFlags[id] = row.returnedOnce;
    this.terminalReasonCodes[id] = row.terminalReasonCode;
    this.terminalOutcomes[id] = row.terminalOutcome;
    this.restoreOriginSnapshot(id, row.origin);
  }

  private restoreOriginSnapshot(jobId: number, origin: RestJobDriverSnapshotOrigin): void {
    this.originPresent[jobId] = origin.present;
    this.originOwnerIndexes[jobId] = origin.ownerIndex;
    this.originOwnerGenerations[jobId] = origin.ownerGeneration;
    this.originActorIds[jobId] = origin.actorId;
    this.originFixtureIds[jobId] = origin.fixtureId;
    this.originRestKindCodes[jobId] = origin.restKindCode;
    this.originStepCodes[jobId] = origin.stepCode;
    this.originTargetCellIndexes[jobId] = origin.targetCellIndex;
    this.originInteractionSpotIds[jobId] = origin.interactionSpotId;
    this.originScheduleCodes[jobId] = origin.scheduleCode;
    this.originEnvironmentVersions[jobId] = origin.environmentVersion;
    this.originNeedOwnerVersions[jobId] = origin.needOwnerVersion;
    this.originLastNeedExpectedValues[jobId] = origin.lastNeedExpectedValue;
    this.originLastNeedDeltas[jobId] = origin.lastNeedDelta;
    this.originLastNeedExpectedStoreVersions[jobId] = origin.lastNeedExpectedStoreVersion;
    this.originLastNeedExpectedLaneVersions[jobId] = origin.lastNeedExpectedLaneVersion;
    this.originLastNeedNextStoreVersions[jobId] = origin.lastNeedNextStoreVersion;
    this.originLastNeedChangedFlags[jobId] = origin.lastNeedChanged;
    this.originReservationVersions[jobId] = origin.reservationVersion;
    this.originJobGenerations[jobId] = origin.jobGeneration;
    this.originJobSlotVersions[jobId] = origin.jobSlotVersion;
    this.originJobCoreStepTickCounts[jobId] = origin.jobCoreStepTickCount;
    this.originJobCoreAdoptionReservationVersions[jobId] = origin.jobCoreAdoptionReservationVersion;
    this.originJobCoreAdoptionDriverVersions[jobId] = origin.jobCoreAdoptionDriverVersion;
    this.originJobCoreAdoptionSlotVersions[jobId] = origin.jobCoreAdoptionSlotVersion;
    this.originCreatedTicks[jobId] = origin.createdTick;
    this.originRecoveryTargetValues[jobId] = origin.recoveryTargetValue;
    this.originRecoveryPerTickQ16s[jobId] = origin.recoveryPerTickQ16;
    this.originRecoveryProgressQ16s[jobId] = origin.recoveryProgressQ16;
    this.originStepEnteredTicks[jobId] = origin.stepEnteredTick;
    this.originLastEffectTicks[jobId] = origin.lastEffectTick;
    this.originEffectPhases[jobId] = origin.effectPhase;
    this.originInterruptionPolicyCodes[jobId] = origin.interruptionPolicyCode;
    this.originRequiredWorkQ16s[jobId] = origin.requiredWorkQ16;
    this.originReadyToCompleteFlags[jobId] = origin.readyToComplete;
    this.originTerminalReasonCodes[jobId] = origin.terminalReasonCode;
    this.originTerminalOutcomes[jobId] = origin.terminalOutcome;
    this.originTerminalFailureCodes[jobId] = origin.terminalFailureCode;
    this.originTerminalInterruptionCodes[jobId] = origin.terminalInterruptionCode;
  }

  private clearAll(): void {
    this.active.fill(0);
    this.ownerIndexes.fill(0);
    this.ownerGenerations.fill(0);
    this.actorIds.fill(0);
    this.fixtureIds.fill(M3_REST_FIXTURE_NONE);
    this.restKindCodes.fill(0);
    this.targetCellIndexes.fill(0);
    this.interactionSpotIds.fill(0);
    this.scheduleCodes.fill(0);
    this.environmentVersions.fill(0);
    this.needOwnerVersions.fill(0);
    this.lastNeedExpectedValues.fill(0);
    this.lastNeedDeltas.fill(0);
    this.lastNeedExpectedStoreVersions.fill(0);
    this.lastNeedExpectedLaneVersions.fill(0);
    this.lastNeedNextStoreVersions.fill(0);
    this.lastNeedChangedFlags.fill(0);
    this.reservationVersions.fill(0);
    this.fixtureClaimIds.fill(M3_REST_FIXTURE_NONE);
    this.interactionClaimIds.fill(M3_REST_FIXTURE_NONE);
    this.fixtureClaimEpochs.fill(0);
    this.interactionClaimEpochs.fill(0);
    this.fixtureClaimCreatedTicks.fill(0);
    this.interactionClaimCreatedTicks.fill(0);
    this.fixtureClaimLeaseExpiryTicks.fill(0);
    this.interactionClaimLeaseExpiryTicks.fill(0);
    this.jobGenerations.fill(0);
    this.jobSlotVersions.fill(0);
    this.jobCoreStepTickCounts.fill(0);
    this.jobCoreAdoptionReservationVersions.fill(0);
    this.jobCoreAdoptionDriverVersions.fill(0);
    this.jobCoreAdoptionSlotVersions.fill(0);
    this.createdTicks.fill(0);
    this.recoveryTargetValues.fill(0);
    this.recoveryPerTickQ16.fill(0);
    this.recoveryProgressQ16.fill(0);
    this.stepEnteredTicks.fill(0);
    this.lastEffectTicks.fill(0);
    this.effectPhases.fill(0);
    this.cleanupPendingFlags.fill(0);
    this.pendingOutcomes.fill(0);
    this.interruptionPolicyCodes.fill(0);
    this.requiredWorkQ16s.fill(0);
    this.readyToCompleteFlags.fill(0);
    this.pendingReasonCodes.fill(0);
    this.pendingFailureCodes.fill(0);
    this.pendingInterruptionCodes.fill(0);
    this.returnedOnceFlags.fill(0);
    this.terminalReasonCodes.fill(0);
    this.terminalOutcomes.fill(0);
    this.originPresent.fill(0);
    this.originOwnerIndexes.fill(0);
    this.originOwnerGenerations.fill(0);
    this.originActorIds.fill(0);
    this.originFixtureIds.fill(M3_REST_FIXTURE_NONE);
    this.originRestKindCodes.fill(0);
    this.originStepCodes.fill(0);
    this.originTargetCellIndexes.fill(0);
    this.originInteractionSpotIds.fill(0);
    this.originScheduleCodes.fill(0);
    this.originEnvironmentVersions.fill(0);
    this.originNeedOwnerVersions.fill(0);
    this.originLastNeedExpectedValues.fill(0);
    this.originLastNeedDeltas.fill(0);
    this.originLastNeedExpectedStoreVersions.fill(0);
    this.originLastNeedExpectedLaneVersions.fill(0);
    this.originLastNeedNextStoreVersions.fill(0);
    this.originLastNeedChangedFlags.fill(0);
    this.originReservationVersions.fill(0);
    this.originJobGenerations.fill(0);
    this.originJobSlotVersions.fill(0);
    this.originJobCoreStepTickCounts.fill(0);
    this.originJobCoreAdoptionReservationVersions.fill(0);
    this.originJobCoreAdoptionDriverVersions.fill(0);
    this.originJobCoreAdoptionSlotVersions.fill(0);
    this.originCreatedTicks.fill(0);
    this.originRecoveryTargetValues.fill(0);
    this.originRecoveryPerTickQ16s.fill(0);
    this.originRecoveryProgressQ16s.fill(0);
    this.originStepEnteredTicks.fill(0);
    this.originLastEffectTicks.fill(0);
    this.originEffectPhases.fill(0);
    this.originInterruptionPolicyCodes.fill(0);
    this.originRequiredWorkQ16s.fill(0);
    this.originReadyToCompleteFlags.fill(0);
    this.originTerminalReasonCodes.fill(0);
    this.originTerminalOutcomes.fill(0);
    this.originTerminalFailureCodes.fill(0);
    this.originTerminalInterruptionCodes.fill(0);
    this.stepCodes.fill(REST_JOB_INACTIVE);
    this.activeCount = 0;
    this.pathingCount = 0;
    this.recoveringCount = 0;
    this.completedCount = 0;
    this.canceledCount = 0;
    this.failedCount = 0;
    this.interruptedCount = 0;
    this.storeVersion = 0;
    this.reservationAttemptCount = 0;
    this.reservationFailureCount = 0;
    this.cleanupReleaseCount = 0;
    this.completedJobCount = 0;
    this.cancelledJobCount = 0;
    this.failedJobCount = 0;
    this.interruptedJobCount = 0;
  }

  private isActiveJob(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.active[jobId] ?? 0) === 1;
  }

  private readOwner(jobId: number): EntityId {
    return {
      index: this.ownerIndexes[jobId] ?? 0,
      generation: this.ownerGenerations[jobId] ?? 0,
    };
  }

  private finish(jobId: number): RestSleepMutationResult {
    this.storeVersion += 1;
    return { ok: true, id: jobId, version: this.storeVersion };
  }

  private writeAdoptionSuccess(output: RestClaimAdoptionOutput): void {
    const token = this.jobTokenOutput;
    output.ok = true;
    output.jobId = token.jobId;
    output.jobGeneration = token.jobGeneration;
    output.ownerIndex = token.ownerIndex;
    output.ownerGeneration = token.ownerGeneration;
    output.jobSlotVersion = token.slotVersion;
    output.jobCoreVersion = token.version;
    output.driverVersion = this.storeVersion;
    output.activeCount = this.activeCount;
    output.jobCoreReservedCount = token.reservedCount;
    output.jobCoreActiveCount = token.activeCount;
    output.jobCoreRunningCount = token.runningCount;
    output.jobCoreCurrentTombstoneCount = token.currentTombstoneCount;
    output.jobCoreCumulativeTerminalCount = token.cumulativeTerminalCount;
    output.driverPathingCount = this.pathingCount;
    output.driverRecoveringCount = this.recoveringCount;
    output.driverCompletedCount = this.completedCount;
    output.driverCanceledCount = this.canceledCount;
    output.driverFailedCount = this.failedCount;
    output.driverInterruptedCount = this.interruptedCount;
    output.reservationAttemptCount = this.reservationAttemptCount;
    output.reservationFailureCount = this.reservationFailureCount;
    output.cleanupReleaseCount = this.cleanupReleaseCount;
    output.cumulativeCompletedCount = this.completedJobCount;
    output.cumulativeCanceledCount = this.cancelledJobCount;
    output.cumulativeFailedCount = this.failedJobCount;
    output.cumulativeInterruptedCount = this.interruptedJobCount;
  }

  private isExactRestAdoptionPreflight(
    control: ExistingClaimsAdoptionControl,
    input: RestClaimAdoptionInput,
    work: number,
  ): boolean {
    const claims = input.claims;
    if (
      !isIndexInRange(control.jobId, this.capacity) ||
      input.jobId !== control.jobId ||
      !isPositiveUint32(control.jobGeneration) ||
      !isSafeUint32(control.ownerIndex) ||
      !isPositiveUint32(control.ownerGeneration) ||
      !isSafeUint32(control.expectedJobSlotVersion) ||
      control.expectedJobSlotVersion > 0xffff_fffc ||
      !isSafeUint32(control.expectedJobCoreVersion) ||
      control.expectedDriverVersion !== this.storeVersion ||
      control.expectedDriverVersion > 0xffff_fffd ||
      this.active[control.jobId] === 1 ||
      !this.isReusableRestSlot(control.jobId) ||
      this.originPresent[control.jobId] !== 0 ||
      !this.hasReusableRestOriginCount(control.jobId) ||
      this.activeCount === 0xffff_ffff ||
      this.pathingCount === 0xffff_ffff ||
      input.owner.index !== control.ownerIndex ||
      input.owner.generation !== control.ownerGeneration ||
      !isSafeUint32(input.actorId) ||
      input.actorId !== control.ownerIndex ||
      !isRestKindValue(input.restKind) ||
      !isScheduleWindowValue(input.scheduleWindow) ||
      !isRestInterruptionPolicy(input.interruptionPolicy) ||
      input.createdTick !== control.claimCreatedTick ||
      !isSafeTick(input.createdTick) ||
      !isSafeUint32(input.fixtureId) ||
      input.fixtureId === M3_REST_FIXTURE_NONE ||
      !isSafeUint32(input.fixtureEntity.index) ||
      input.fixtureEntity.index === M3_REST_FIXTURE_NONE ||
      !isSafeUint32(input.fixtureEntity.generation) ||
      input.fixtureEntity.generation === 0 ||
      !isSafeUint32(input.targetCellIndex) ||
      input.targetCellIndex === M3_REST_FIXTURE_NONE ||
      !isSafeUint32(input.interactionSpotId) ||
      input.interactionSpotId === M3_REST_FIXTURE_NONE ||
      !isSafeUint32(input.environmentVersion) ||
      !isSafeUint32(input.needOwnerVersion) ||
      !isNeedValue(input.currentRestValue) ||
      !isNeedValue(input.recoveryTargetValue) ||
      input.recoveryTargetValue <= input.currentRestValue ||
      !isPositiveUint32(input.recoveryPerTickQ16) ||
      !Number.isSafeInteger(work) ||
      work <= 0 ||
      work > 0xffff_ffff ||
      input.readClaimIds.length !== 8 ||
      input.readClaimEpochs.length !== 8 ||
      !isExactAdoptionClaimPrefix(control, claims, 2)
    )
      return false;
    for (let index = 0; index < 8; index += 1) {
      if (
        (input.readClaimIds[index] ?? 0) !== (control.claimIds[index] ?? 0) ||
        (input.readClaimEpochs[index] ?? 0) !== (control.claimEpochs[index] ?? 0)
      )
        return false;
    }
    return (
      claims.channelCodes[0] === RESERVATION_ENTITY &&
      claims.channelCodes[1] === RESERVATION_INTERACTION_SPOT &&
      claims.hasTargetFlags[0] === 1 &&
      claims.hasTargetFlags[1] === 1 &&
      restClaimTarget(claims, 0, input.fixtureEntity) &&
      restClaimTarget(claims, 1, input.fixtureEntity) &&
      claims.cellIndexes[0] === M3_REST_FIXTURE_NONE &&
      claims.cellIndexes[1] === M3_REST_FIXTURE_NONE &&
      claims.slotIds[0] === M3_REST_FIXTURE_NONE &&
      claims.slotIds[1] === input.interactionSpotId &&
      claims.amounts[0] === 0 &&
      claims.amounts[1] === 0
    );
  }

  private isExactRestRollbackPreflight(
    control: RestNewlyAdoptedRollbackControl,
    jobCore: JobCoreStore,
  ): boolean {
    const jobId = control.jobId;
    if (
      !isIndexInRange(jobId, this.capacity) ||
      control.claimCount !== 2 ||
      control.claimIds.length !== 8 ||
      control.claimEpochs.length !== 8 ||
      control.claimLeaseExpiryTicks.length !== 8 ||
      control.expectedDriverVersion > 0xffff_fffd ||
      control.expectedAdoptedDriverVersion !== control.expectedDriverVersion + 1 ||
      control.expectedAdoptedJobSlotVersion !== control.expectedJobSlotVersion + 1 ||
      this.storeVersion !== control.expectedAdoptedDriverVersion ||
      this.active[jobId] !== 1 ||
      this.jobGenerations[jobId] !== control.jobGeneration ||
      this.ownerIndexes[jobId] !== control.ownerIndex ||
      this.ownerGenerations[jobId] !== control.ownerGeneration ||
      this.jobSlotVersions[jobId] !== control.expectedAdoptedJobSlotVersion ||
      this.jobCoreStepTickCounts[jobId] !== 0 ||
      this.jobCoreAdoptionReservationVersions[jobId] !== control.reservationReadVersion ||
      this.jobCoreAdoptionDriverVersions[jobId] !== control.expectedDriverVersion ||
      this.jobCoreAdoptionSlotVersions[jobId] !== control.expectedAdoptedJobSlotVersion ||
      this.stepCodes[jobId] !== REST_JOB_PATHING_TO_FIXTURE ||
      this.actorIds[jobId] !== control.expectedActorId ||
      this.actorIds[jobId] !== control.ownerIndex ||
      this.fixtureIds[jobId] !== control.expectedFixtureId ||
      this.restKindCodes[jobId] !== encodeRestKind(control.expectedRestKind) ||
      this.targetCellIndexes[jobId] !== control.expectedTargetCellIndex ||
      this.interactionSpotIds[jobId] !== control.expectedInteractionSpotId ||
      this.scheduleCodes[jobId] !== encodeScheduleWindow(control.expectedScheduleWindow) ||
      this.environmentVersions[jobId] !== control.expectedEnvironmentVersion ||
      this.needOwnerVersions[jobId] !== control.expectedNeedOwnerVersion ||
      this.recoveryTargetValues[jobId] !== control.expectedRecoveryTargetValue ||
      this.recoveryPerTickQ16[jobId] !== control.expectedRecoveryPerTickQ16 ||
      this.interruptionPolicyCodes[jobId] !==
        encodeRestInterruptionPolicy(control.expectedInterruptionPolicy) ||
      this.requiredWorkQ16s[jobId] !== control.expectedRequiredWorkQ16 ||
      this.createdTicks[jobId] !== control.claimCreatedTick ||
      this.stepEnteredTicks[jobId] !== control.adoptionTick ||
      this.lastEffectTicks[jobId] !== control.adoptionTick ||
      this.reservationVersions[jobId] !== control.reservationReadVersion ||
      this.recoveryProgressQ16[jobId] !== 0 ||
      this.effectPhases[jobId] !== REST_EFFECT_NONE ||
      this.readyToCompleteFlags[jobId] !== 0 ||
      this.cleanupPendingFlags[jobId] !== 0 ||
      this.pendingOutcomes[jobId] !== REST_PENDING_NONE ||
      this.pendingReasonCodes[jobId] !== 0 ||
      this.pendingFailureCodes[jobId] !== 0 ||
      this.pendingInterruptionCodes[jobId] !== 0 ||
      this.returnedOnceFlags[jobId] !== 0 ||
      this.terminalReasonCodes[jobId] !== REST_REASON_NONE ||
      this.terminalOutcomes[jobId] !== REST_PENDING_NONE ||
      this.lastNeedExpectedValues[jobId] !== 0 ||
      this.lastNeedDeltas[jobId] !== 0 ||
      this.lastNeedExpectedStoreVersions[jobId] !== 0 ||
      this.lastNeedExpectedLaneVersions[jobId] !== 0 ||
      this.lastNeedNextStoreVersions[jobId] !== 0 ||
      this.lastNeedChangedFlags[jobId] !== 0 ||
      this.activeCount === 0 ||
      this.pathingCount === 0 ||
      this.fixtureClaimIds[jobId] !== control.claimIds[0] ||
      this.interactionClaimIds[jobId] !== control.claimIds[1] ||
      this.fixtureClaimEpochs[jobId] !== control.claimEpochs[0] ||
      this.interactionClaimEpochs[jobId] !== control.claimEpochs[1] ||
      this.fixtureClaimCreatedTicks[jobId] !== control.claimCreatedTick ||
      this.interactionClaimCreatedTicks[jobId] !== control.claimCreatedTick ||
      this.fixtureClaimLeaseExpiryTicks[jobId] !== control.claimLeaseExpiryTicks[0] ||
      this.interactionClaimLeaseExpiryTicks[jobId] !== control.claimLeaseExpiryTicks[1]
    )
      return false;
    for (let index = 2; index < 8; index += 1) {
      if (
        (control.claimIds[index] ?? 0) !== M3_REST_FIXTURE_NONE ||
        (control.claimEpochs[index] ?? 0) !== 0 ||
        (control.claimLeaseExpiryTicks[index] ?? 0) !== 0
      )
        return false;
    }
    jobCore.readCommittedAutonomyJobInto(
      jobId,
      control.jobGeneration,
      control.ownerIndex,
      control.ownerGeneration,
      control.expectedAdoptedJobSlotVersion,
      this.committedJobOutput,
    );
    const row = this.committedJobOutput;
    if (
      !row.ok ||
      row.state !== "running" ||
      row.version !== control.expectedJobCoreVersion + 1 ||
      row.jobKind !== M3_REST_SLEEP_JOB_KIND ||
      row.targetId !== this.fixtureIds[jobId] ||
      row.status !== "running" ||
      row.step !== "path_to_source" ||
      row.interruptionPolicy !==
        decodeRestInterruptionPolicy(this.interruptionPolicyCodes[jobId] ?? 0) ||
      row.failureReason !== "none" ||
      row.createdTick !== control.claimCreatedTick ||
      row.stepEnteredTick !== control.adoptionTick ||
      row.stepTickCount !== 0 ||
      row.progressQ16 !== 0 ||
      row.requiredWorkQ16 !== this.requiredWorkQ16s[jobId] ||
      row.carriedDefId !== M3_REST_FIXTURE_NONE ||
      row.carriedAmount !== 0 ||
      row.lastMutationTick !== control.adoptionTick ||
      row.terminalEffectPhase !== 0
    )
      return false;
    this.releaseOwnerScratch.index = control.ownerIndex;
    this.releaseOwnerScratch.generation = control.ownerGeneration;
    jobCore.readAutonomyJobTokenInto(
      jobId,
      control.jobGeneration,
      this.releaseOwnerScratch,
      control.expectedAdoptedJobSlotVersion,
      this.jobTokenOutput,
    );
    const token = this.jobTokenOutput;
    if (
      !token.ok ||
      token.version !== control.expectedJobCoreVersion + 1 ||
      token.originShadowPresent !== ((this.originPresent[jobId] ?? 0) === 1)
    )
      return false;
    if (!token.originShadowPresent) return true;
    return (
      token.originJobGeneration === (this.originJobGenerations[jobId] ?? 0) &&
      token.originOwnerIndex === (this.originOwnerIndexes[jobId] ?? 0) &&
      token.originOwnerGeneration === (this.originOwnerGenerations[jobId] ?? 0) &&
      token.originJobKind === M3_REST_SLEEP_JOB_KIND &&
      token.originTargetId === (this.originFixtureIds[jobId] ?? M3_REST_FIXTURE_NONE) &&
      token.originStatus === restCoreStatusForTerminalStep(this.originStepCodes[jobId] ?? 0) &&
      token.originFailureReason ===
        decodeRestPendingFailure(this.originTerminalFailureCodes[jobId] ?? 0) &&
      token.originCreatedTick === (this.originCreatedTicks[jobId] ?? 0) &&
      token.originTerminalTick === (this.originLastEffectTicks[jobId] ?? 0) &&
      token.originEffectPhase === (this.originEffectPhases[jobId] ?? 0) &&
      matchesAutonomyOriginTerminalScalars(
        jobCore,
        jobId,
        control.jobGeneration,
        control.ownerIndex,
        control.ownerGeneration,
        control.expectedAdoptedJobSlotVersion,
        this.originJobGenerations[jobId] ?? 0,
        this.originOwnerIndexes[jobId] ?? 0,
        this.originOwnerGenerations[jobId] ?? 0,
        M3_REST_SLEEP_JOB_KIND,
        this.originFixtureIds[jobId] ?? M3_REST_FIXTURE_NONE,
        restCoreStatusForTerminalStep(this.originStepCodes[jobId] ?? 0),
        decodeRestPendingFailure(this.originTerminalFailureCodes[jobId] ?? 0),
        this.originCreatedTicks[jobId] ?? 0,
        this.originLastEffectTicks[jobId] ?? 0,
        this.originEffectPhases[jobId] ?? 0,
        decodeRestInterruptionPolicy(this.originInterruptionPolicyCodes[jobId] ?? 0),
        this.originRecoveryProgressQ16s[jobId] ?? 0,
        this.originRequiredWorkQ16s[jobId] ?? 0,
        this.originJobCoreStepTickCounts[jobId] ?? 0,
        this.originJobCoreAdoptionReservationVersions[jobId] ?? 0,
        this.originJobCoreAdoptionDriverVersions[jobId] ?? 0,
        this.originJobCoreAdoptionSlotVersions[jobId] ?? 0,
      )
    );
  }

  private isReusableRestSlot(jobId: number): boolean {
    const generation = this.jobGenerations[jobId] ?? 0;
    if (generation === 0)
      return (
        (this.active[jobId] ?? 0) === 0 &&
        (this.stepCodes[jobId] ?? REST_JOB_INACTIVE) === REST_JOB_INACTIVE
      );
    return (
      (this.active[jobId] ?? 0) === 0 &&
      isTerminalRestStep(this.stepCodes[jobId] ?? REST_JOB_INACTIVE) &&
      (this.cleanupPendingFlags[jobId] ?? 0) === 0
    );
  }

  private hasReusableRestOriginCount(jobId: number): boolean {
    if ((this.jobGenerations[jobId] ?? 0) === 0) return true;
    const outcome = this.terminalOutcomes[jobId] ?? REST_PENDING_NONE;
    if (outcome === REST_PENDING_COMPLETE) return this.completedCount > 0;
    if (outcome === REST_PENDING_FAILED) return this.failedCount > 0;
    if (outcome === REST_PENDING_CANCELED) return this.canceledCount > 0;
    return (
      outcome === REST_PENDING_INTERRUPTED && this.canceledCount > 0 && this.interruptedCount > 0
    );
  }

  private captureRestOrigin(jobId: number): void {
    if ((this.jobGenerations[jobId] ?? 0) === 0) {
      this.clearRestOrigin(jobId);
      return;
    }
    this.originPresent[jobId] = 1;
    this.originOwnerIndexes[jobId] = this.ownerIndexes[jobId] ?? 0;
    this.originOwnerGenerations[jobId] = this.ownerGenerations[jobId] ?? 0;
    this.originActorIds[jobId] = this.actorIds[jobId] ?? 0;
    this.originFixtureIds[jobId] = this.fixtureIds[jobId] ?? M3_REST_FIXTURE_NONE;
    this.originRestKindCodes[jobId] = this.restKindCodes[jobId] ?? 0;
    this.originStepCodes[jobId] = this.stepCodes[jobId] ?? 0;
    this.originTargetCellIndexes[jobId] = this.targetCellIndexes[jobId] ?? 0;
    this.originInteractionSpotIds[jobId] = this.interactionSpotIds[jobId] ?? 0;
    this.originScheduleCodes[jobId] = this.scheduleCodes[jobId] ?? 0;
    this.originEnvironmentVersions[jobId] = this.environmentVersions[jobId] ?? 0;
    this.originNeedOwnerVersions[jobId] = this.needOwnerVersions[jobId] ?? 0;
    this.originLastNeedExpectedValues[jobId] = this.lastNeedExpectedValues[jobId] ?? 0;
    this.originLastNeedDeltas[jobId] = this.lastNeedDeltas[jobId] ?? 0;
    this.originLastNeedExpectedStoreVersions[jobId] =
      this.lastNeedExpectedStoreVersions[jobId] ?? 0;
    this.originLastNeedExpectedLaneVersions[jobId] = this.lastNeedExpectedLaneVersions[jobId] ?? 0;
    this.originLastNeedNextStoreVersions[jobId] = this.lastNeedNextStoreVersions[jobId] ?? 0;
    this.originLastNeedChangedFlags[jobId] = this.lastNeedChangedFlags[jobId] ?? 0;
    this.originReservationVersions[jobId] = this.reservationVersions[jobId] ?? 0;
    this.originJobGenerations[jobId] = this.jobGenerations[jobId] ?? 0;
    this.originJobSlotVersions[jobId] = this.jobSlotVersions[jobId] ?? 0;
    this.originJobCoreStepTickCounts[jobId] = this.jobCoreStepTickCounts[jobId] ?? 0;
    this.originJobCoreAdoptionReservationVersions[jobId] =
      this.jobCoreAdoptionReservationVersions[jobId] ?? 0;
    this.originJobCoreAdoptionDriverVersions[jobId] =
      this.jobCoreAdoptionDriverVersions[jobId] ?? 0;
    this.originJobCoreAdoptionSlotVersions[jobId] = this.jobCoreAdoptionSlotVersions[jobId] ?? 0;
    this.originCreatedTicks[jobId] = this.createdTicks[jobId] ?? 0;
    this.originRecoveryTargetValues[jobId] = this.recoveryTargetValues[jobId] ?? 0;
    this.originRecoveryPerTickQ16s[jobId] = this.recoveryPerTickQ16[jobId] ?? 0;
    this.originRecoveryProgressQ16s[jobId] = this.recoveryProgressQ16[jobId] ?? 0;
    this.originStepEnteredTicks[jobId] = this.stepEnteredTicks[jobId] ?? 0;
    this.originLastEffectTicks[jobId] = this.lastEffectTicks[jobId] ?? 0;
    this.originEffectPhases[jobId] = this.effectPhases[jobId] ?? 0;
    this.originInterruptionPolicyCodes[jobId] = this.interruptionPolicyCodes[jobId] ?? 0;
    this.originRequiredWorkQ16s[jobId] = this.requiredWorkQ16s[jobId] ?? 0;
    this.originReadyToCompleteFlags[jobId] = this.readyToCompleteFlags[jobId] ?? 0;
    this.originTerminalReasonCodes[jobId] = this.terminalReasonCodes[jobId] ?? 0;
    this.originTerminalOutcomes[jobId] = this.terminalOutcomes[jobId] ?? REST_PENDING_NONE;
    this.originTerminalFailureCodes[jobId] = this.pendingFailureCodes[jobId] ?? 0;
    this.originTerminalInterruptionCodes[jobId] = this.pendingInterruptionCodes[jobId] ?? 0;
    this.decrementTerminalCurrent(this.terminalOutcomes[jobId] ?? REST_PENDING_NONE);
  }

  private restoreRestOriginOrClear(jobId: number, nextSlotVersion: number): void {
    if ((this.originPresent[jobId] ?? 0) === 0) {
      this.clearRestRow(jobId);
      this.jobSlotVersions[jobId] = 0;
      return;
    }
    this.active[jobId] = 0;
    this.ownerIndexes[jobId] = this.originOwnerIndexes[jobId] ?? 0;
    this.ownerGenerations[jobId] = this.originOwnerGenerations[jobId] ?? 0;
    this.actorIds[jobId] = this.originActorIds[jobId] ?? 0;
    this.fixtureIds[jobId] = this.originFixtureIds[jobId] ?? M3_REST_FIXTURE_NONE;
    this.restKindCodes[jobId] = this.originRestKindCodes[jobId] ?? 0;
    this.stepCodes[jobId] = this.originStepCodes[jobId] ?? 0;
    this.targetCellIndexes[jobId] = this.originTargetCellIndexes[jobId] ?? 0;
    this.interactionSpotIds[jobId] = this.originInteractionSpotIds[jobId] ?? 0;
    this.scheduleCodes[jobId] = this.originScheduleCodes[jobId] ?? 0;
    this.environmentVersions[jobId] = this.originEnvironmentVersions[jobId] ?? 0;
    this.needOwnerVersions[jobId] = this.originNeedOwnerVersions[jobId] ?? 0;
    this.lastNeedExpectedValues[jobId] = this.originLastNeedExpectedValues[jobId] ?? 0;
    this.lastNeedDeltas[jobId] = this.originLastNeedDeltas[jobId] ?? 0;
    this.lastNeedExpectedStoreVersions[jobId] =
      this.originLastNeedExpectedStoreVersions[jobId] ?? 0;
    this.lastNeedExpectedLaneVersions[jobId] = this.originLastNeedExpectedLaneVersions[jobId] ?? 0;
    this.lastNeedNextStoreVersions[jobId] = this.originLastNeedNextStoreVersions[jobId] ?? 0;
    this.lastNeedChangedFlags[jobId] = this.originLastNeedChangedFlags[jobId] ?? 0;
    this.reservationVersions[jobId] = this.originReservationVersions[jobId] ?? 0;
    this.jobGenerations[jobId] = this.originJobGenerations[jobId] ?? 0;
    this.jobSlotVersions[jobId] = nextSlotVersion;
    this.jobCoreStepTickCounts[jobId] = this.originJobCoreStepTickCounts[jobId] ?? 0;
    this.jobCoreAdoptionReservationVersions[jobId] =
      this.originJobCoreAdoptionReservationVersions[jobId] ?? 0;
    this.jobCoreAdoptionDriverVersions[jobId] =
      this.originJobCoreAdoptionDriverVersions[jobId] ?? 0;
    this.jobCoreAdoptionSlotVersions[jobId] = this.originJobCoreAdoptionSlotVersions[jobId] ?? 0;
    this.createdTicks[jobId] = this.originCreatedTicks[jobId] ?? 0;
    this.recoveryTargetValues[jobId] = this.originRecoveryTargetValues[jobId] ?? 0;
    this.recoveryPerTickQ16[jobId] = this.originRecoveryPerTickQ16s[jobId] ?? 0;
    this.recoveryProgressQ16[jobId] = this.originRecoveryProgressQ16s[jobId] ?? 0;
    this.stepEnteredTicks[jobId] = this.originStepEnteredTicks[jobId] ?? 0;
    this.lastEffectTicks[jobId] = this.originLastEffectTicks[jobId] ?? 0;
    this.effectPhases[jobId] = this.originEffectPhases[jobId] ?? 0;
    this.interruptionPolicyCodes[jobId] = this.originInterruptionPolicyCodes[jobId] ?? 0;
    this.requiredWorkQ16s[jobId] = this.originRequiredWorkQ16s[jobId] ?? 0;
    this.readyToCompleteFlags[jobId] = this.originReadyToCompleteFlags[jobId] ?? 0;
    this.terminalReasonCodes[jobId] = this.originTerminalReasonCodes[jobId] ?? 0;
    this.terminalOutcomes[jobId] = this.originTerminalOutcomes[jobId] ?? REST_PENDING_NONE;
    this.pendingFailureCodes[jobId] = this.originTerminalFailureCodes[jobId] ?? 0;
    this.pendingInterruptionCodes[jobId] = this.originTerminalInterruptionCodes[jobId] ?? 0;
    this.fixtureClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.fixtureClaimEpochs[jobId] = 0;
    this.interactionClaimEpochs[jobId] = 0;
    this.fixtureClaimCreatedTicks[jobId] = 0;
    this.interactionClaimCreatedTicks[jobId] = 0;
    this.fixtureClaimLeaseExpiryTicks[jobId] = 0;
    this.interactionClaimLeaseExpiryTicks[jobId] = 0;
    this.cleanupPendingFlags[jobId] = 0;
    this.pendingOutcomes[jobId] = REST_PENDING_NONE;
    this.pendingReasonCodes[jobId] = 0;
    this.returnedOnceFlags[jobId] = 0;
    this.incrementTerminalCurrent(this.terminalOutcomes[jobId] ?? REST_PENDING_NONE);
    this.clearRestOrigin(jobId);
  }

  private clearRestRow(jobId: number): void {
    this.active[jobId] = 0;
    this.ownerIndexes[jobId] = 0;
    this.ownerGenerations[jobId] = 0;
    this.actorIds[jobId] = 0;
    this.fixtureIds[jobId] = M3_REST_FIXTURE_NONE;
    this.restKindCodes[jobId] = 0;
    this.stepCodes[jobId] = REST_JOB_INACTIVE;
    this.targetCellIndexes[jobId] = 0;
    this.interactionSpotIds[jobId] = 0;
    this.scheduleCodes[jobId] = 0;
    this.environmentVersions[jobId] = 0;
    this.needOwnerVersions[jobId] = 0;
    this.reservationVersions[jobId] = 0;
    this.lastNeedExpectedValues[jobId] = 0;
    this.lastNeedDeltas[jobId] = 0;
    this.lastNeedExpectedStoreVersions[jobId] = 0;
    this.lastNeedExpectedLaneVersions[jobId] = 0;
    this.lastNeedNextStoreVersions[jobId] = 0;
    this.lastNeedChangedFlags[jobId] = 0;
    this.fixtureClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.fixtureClaimEpochs[jobId] = 0;
    this.interactionClaimEpochs[jobId] = 0;
    this.fixtureClaimCreatedTicks[jobId] = 0;
    this.interactionClaimCreatedTicks[jobId] = 0;
    this.fixtureClaimLeaseExpiryTicks[jobId] = 0;
    this.interactionClaimLeaseExpiryTicks[jobId] = 0;
    this.jobGenerations[jobId] = 0;
    this.jobSlotVersions[jobId] = 0;
    this.jobCoreStepTickCounts[jobId] = 0;
    this.jobCoreAdoptionReservationVersions[jobId] = 0;
    this.jobCoreAdoptionDriverVersions[jobId] = 0;
    this.jobCoreAdoptionSlotVersions[jobId] = 0;
    this.createdTicks[jobId] = 0;
    this.recoveryTargetValues[jobId] = 0;
    this.recoveryPerTickQ16[jobId] = 0;
    this.recoveryProgressQ16[jobId] = 0;
    this.stepEnteredTicks[jobId] = 0;
    this.lastEffectTicks[jobId] = 0;
    this.effectPhases[jobId] = 0;
    this.cleanupPendingFlags[jobId] = 0;
    this.interruptionPolicyCodes[jobId] = 0;
    this.requiredWorkQ16s[jobId] = 0;
    this.readyToCompleteFlags[jobId] = 0;
    this.pendingOutcomes[jobId] = 0;
    this.pendingReasonCodes[jobId] = 0;
    this.pendingFailureCodes[jobId] = 0;
    this.pendingInterruptionCodes[jobId] = 0;
    this.returnedOnceFlags[jobId] = 0;
    this.terminalReasonCodes[jobId] = 0;
    this.terminalOutcomes[jobId] = REST_PENDING_NONE;
    this.clearRestOrigin(jobId);
  }

  private clearRestOrigin(jobId: number): void {
    this.originPresent[jobId] = 0;
    this.originOwnerIndexes[jobId] = 0;
    this.originOwnerGenerations[jobId] = 0;
    this.originActorIds[jobId] = 0;
    this.originFixtureIds[jobId] = M3_REST_FIXTURE_NONE;
    this.originRestKindCodes[jobId] = 0;
    this.originStepCodes[jobId] = 0;
    this.originTargetCellIndexes[jobId] = 0;
    this.originInteractionSpotIds[jobId] = 0;
    this.originScheduleCodes[jobId] = 0;
    this.originEnvironmentVersions[jobId] = 0;
    this.originNeedOwnerVersions[jobId] = 0;
    this.originLastNeedExpectedValues[jobId] = 0;
    this.originLastNeedDeltas[jobId] = 0;
    this.originLastNeedExpectedStoreVersions[jobId] = 0;
    this.originLastNeedExpectedLaneVersions[jobId] = 0;
    this.originLastNeedNextStoreVersions[jobId] = 0;
    this.originLastNeedChangedFlags[jobId] = 0;
    this.originReservationVersions[jobId] = 0;
    this.originJobGenerations[jobId] = 0;
    this.originJobSlotVersions[jobId] = 0;
    this.originJobCoreStepTickCounts[jobId] = 0;
    this.originJobCoreAdoptionReservationVersions[jobId] = 0;
    this.originJobCoreAdoptionDriverVersions[jobId] = 0;
    this.originJobCoreAdoptionSlotVersions[jobId] = 0;
    this.originCreatedTicks[jobId] = 0;
    this.originRecoveryTargetValues[jobId] = 0;
    this.originRecoveryPerTickQ16s[jobId] = 0;
    this.originRecoveryProgressQ16s[jobId] = 0;
    this.originStepEnteredTicks[jobId] = 0;
    this.originLastEffectTicks[jobId] = 0;
    this.originEffectPhases[jobId] = 0;
    this.originInterruptionPolicyCodes[jobId] = 0;
    this.originRequiredWorkQ16s[jobId] = 0;
    this.originReadyToCompleteFlags[jobId] = 0;
    this.originTerminalReasonCodes[jobId] = 0;
    this.originTerminalOutcomes[jobId] = REST_PENDING_NONE;
    this.originTerminalFailureCodes[jobId] = 0;
    this.originTerminalInterruptionCodes[jobId] = 0;
  }

  private incrementTerminalCurrent(outcome: number): void {
    if (outcome === REST_PENDING_COMPLETE) this.completedCount += 1;
    if (outcome === REST_PENDING_CANCELED || outcome === REST_PENDING_INTERRUPTED) {
      this.canceledCount += 1;
    }
    if (outcome === REST_PENDING_FAILED) this.failedCount += 1;
    if (outcome === REST_PENDING_INTERRUPTED) this.interruptedCount += 1;
  }

  private decrementTerminalCurrent(outcome: number): void {
    if (outcome === REST_PENDING_COMPLETE) this.completedCount -= 1;
    if (outcome === REST_PENDING_CANCELED || outcome === REST_PENDING_INTERRUPTED) {
      this.canceledCount -= 1;
    }
    if (outcome === REST_PENDING_FAILED) this.failedCount -= 1;
    if (outcome === REST_PENDING_INTERRUPTED) this.interruptedCount -= 1;
  }

  private matchesRestAdoptedMutation(
    input: RestAdoptedMutationInput,
    expectedStep: number,
  ): boolean {
    const jobId = input.jobId;
    return (
      isIndexInRange(jobId, this.capacity) &&
      isPositiveUint32(input.jobGeneration) &&
      isSafeUint32(input.owner.index) &&
      isPositiveUint32(input.owner.generation) &&
      isSafeUint32(input.expectedJobSlotVersion) &&
      input.expectedJobSlotVersion <= 0xffff_fffe &&
      isSafeUint32(input.expectedJobCoreVersion) &&
      input.expectedDriverVersion === this.storeVersion &&
      this.storeVersion <= 0xffff_fffe &&
      isSafeTick(input.tick) &&
      input.tick >= (this.createdTicks[jobId] ?? 0) &&
      input.tick >= (this.stepEnteredTicks[jobId] ?? 0) &&
      input.tick >= (this.lastEffectTicks[jobId] ?? 0) &&
      this.active[jobId] === 1 &&
      this.jobGenerations[jobId] === input.jobGeneration &&
      this.ownerIndexes[jobId] === input.owner.index &&
      this.ownerGenerations[jobId] === input.owner.generation &&
      this.jobSlotVersions[jobId] === input.expectedJobSlotVersion &&
      this.stepCodes[jobId] === expectedStep &&
      this.activeCount > 0 &&
      (expectedStep !== REST_JOB_PATHING_TO_FIXTURE || this.pathingCount > 0) &&
      ((expectedStep !== REST_JOB_RESTING && expectedStep !== REST_JOB_SLEEPING) ||
        this.recoveringCount > 0)
    );
  }

  private isPositiveGenerationJob(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.jobGenerations[jobId] ?? 0) > 0;
  }

  private matchesRestNeedMutation(
    input: RestAdoptedTickInput,
    needStore: NeedStore,
    currentRest: number,
    delta: number,
  ): boolean {
    const mutation = input.needMutation;
    return (
      mutation.actorId === (this.actorIds[input.jobId] ?? 0) &&
      mutation.lane === NEED_LANE_REST &&
      mutation.tick === input.tick &&
      mutation.reason === "need.external_delta" &&
      mutation.sourceSystemId === M3_REST_SLEEP_JOB_KIND &&
      mutation.sourceEventId === input.jobId &&
      mutation.delta === delta &&
      mutation.expectedValue === currentRest &&
      mutation.expectedStoreVersion === needStore.version &&
      mutation.expectedLaneVersion ===
        needStore.readLaneOwnerVersion(mutation.actorId, NEED_LANE_REST)
    );
  }

  private commitRestRecoveryTail(
    input: RestAdoptedTickInput,
    jobCore: JobCoreStore,
    readyToComplete: boolean,
    output: RestAdoptedMutationOutput,
  ): void {
    commitPreparedAutonomyProgress(jobCore, this.preparedProgress);
    const jobId = input.jobId;
    this.recoveryProgressQ16[jobId] = this.preparedProgress.nextProgressQ16;
    this.jobSlotVersions[jobId] = this.preparedProgress.nextSlotVersion;
    this.jobCoreStepTickCounts[jobId] = this.preparedProgress.nextStepTickCount;
    this.needOwnerVersions[jobId] = this.preparedNeed.nextLaneVersion;
    this.lastNeedExpectedValues[jobId] = this.preparedNeed.previousValue;
    this.lastNeedDeltas[jobId] = input.needMutation.delta;
    this.lastNeedExpectedStoreVersions[jobId] = this.preparedNeed.previousStoreVersion;
    this.lastNeedExpectedLaneVersions[jobId] = this.preparedNeed.previousLaneVersion;
    this.lastNeedNextStoreVersions[jobId] = this.preparedNeed.nextStoreVersion;
    this.lastNeedChangedFlags[jobId] = this.preparedNeed.changed ? 1 : 0;
    this.lastEffectTicks[jobId] = input.tick;
    this.effectPhases[jobId] = REST_EFFECT_RECOVERY_APPLIED;
    this.readyToCompleteFlags[jobId] = readyToComplete ? 1 : 0;
    this.storeVersion += 1;
    writeRestAdoptedMutationSuccess(
      jobId,
      input.jobGeneration,
      this.preparedProgress.nextSlotVersion,
      this.preparedProgress.nextJobCoreVersion,
      this.storeVersion,
      this.reservationVersions[jobId] ?? 0,
      this.preparedNeed.nextLaneVersion,
      this.preparedNeed.nextStoreVersion,
      false,
      false,
      readyToComplete,
      0,
      undefined,
      output,
    );
    this.writeRestMutationMetrics(jobId, jobCore, output);
  }

  private matchesCommittedRestRunningJob(
    input: RestAdoptedMutationInput,
    jobCore: JobCoreStore,
  ): boolean {
    return this.matchesCommittedRestActiveJob(
      input,
      jobCore,
      this.stepCodes[input.jobId] ?? REST_JOB_INACTIVE,
    );
  }

  private matchesCommittedRestActiveJob(
    input: RestAdoptedMutationInput,
    jobCore: JobCoreStore,
    driverStep: number,
  ): boolean {
    jobCore.readCommittedAutonomyJobInto(
      input.jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      this.committedJobOutput,
    );
    const row = this.committedJobOutput;
    const jobId = input.jobId;
    const expectedCoreStep =
      driverStep === REST_JOB_PATHING_TO_FIXTURE ? "path_to_source" : "interact";
    return (
      row.ok &&
      row.state === "running" &&
      row.version === input.expectedJobCoreVersion &&
      row.jobKind === M3_REST_SLEEP_JOB_KIND &&
      row.targetId === (this.fixtureIds[jobId] ?? 0) &&
      row.status === "running" &&
      row.step === expectedCoreStep &&
      row.failureReason === "none" &&
      row.interruptionPolicy ===
        decodeRestInterruptionPolicy(this.interruptionPolicyCodes[jobId] ?? 0) &&
      row.createdTick === (this.createdTicks[jobId] ?? 0) &&
      row.stepEnteredTick === (this.stepEnteredTicks[jobId] ?? 0) &&
      row.stepTickCount === (this.jobCoreStepTickCounts[jobId] ?? 0) &&
      row.progressQ16 === (this.recoveryProgressQ16[jobId] ?? 0) &&
      row.requiredWorkQ16 === (this.requiredWorkQ16s[jobId] ?? 0) &&
      row.carriedDefId === M3_REST_FIXTURE_NONE &&
      row.carriedAmount === 0 &&
      row.lastMutationTick === (this.lastEffectTicks[jobId] ?? 0) &&
      row.terminalEffectPhase === 0
    );
  }

  private matchesCommittedRestNeedEffect(
    input: RestAdoptedTickInput,
    needStore: NeedStore,
  ): boolean {
    const jobId = input.jobId;
    const mutation = input.needMutation;
    const expectedValue = this.lastNeedExpectedValues[jobId] ?? 0;
    const delta = this.lastNeedDeltas[jobId] ?? 0;
    const nextValue = Math.min(NEED_VALUE_MAX, Math.max(0, expectedValue + delta));
    return (
      mutation.actorId === (this.actorIds[jobId] ?? 0) &&
      mutation.lane === NEED_LANE_REST &&
      mutation.tick === input.tick &&
      mutation.reason === "need.external_delta" &&
      mutation.sourceSystemId === M3_REST_SLEEP_JOB_KIND &&
      mutation.sourceEventId === jobId &&
      mutation.expectedValue === expectedValue &&
      mutation.delta === delta &&
      mutation.expectedStoreVersion === (this.lastNeedExpectedStoreVersions[jobId] ?? 0) &&
      mutation.expectedLaneVersion === (this.lastNeedExpectedLaneVersions[jobId] ?? 0) &&
      needStore.version === (this.lastNeedNextStoreVersions[jobId] ?? 0) &&
      needStore.readLaneOwnerVersion(mutation.actorId, NEED_LANE_REST) ===
        (this.needOwnerVersions[jobId] ?? 0) &&
      needStore.readLaneValue(mutation.actorId, NEED_LANE_REST) === nextValue
    );
  }

  private isRestTerminalDuplicate(
    input: RestAdoptedTerminalInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): boolean {
    const jobId = input.jobId;
    if (
      !isIndexInRange(jobId, this.capacity) ||
      this.active[jobId] !== 0 ||
      this.jobGenerations[jobId] !== input.jobGeneration ||
      this.ownerIndexes[jobId] !== input.owner.index ||
      this.ownerGenerations[jobId] !== input.owner.generation ||
      this.jobSlotVersions[jobId] !== input.expectedJobSlotVersion ||
      this.storeVersion !== input.expectedDriverVersion ||
      this.reservationVersions[jobId] !== input.expectedCurrentLedgerVersion ||
      ledger.version !== input.expectedCurrentLedgerVersion ||
      this.terminalOutcomes[jobId] !== encodeRestPendingOutcome(input.outcome) ||
      this.stepCodes[jobId] !== restTerminalStep(input.outcome) ||
      this.lastEffectTicks[jobId] !== input.tick ||
      this.terminalReasonCodes[jobId] !== encodeRestReason(input.terminalReason) ||
      this.pendingFailureCodes[jobId] !== encodeRestPendingFailure(input.failureReason) ||
      this.pendingInterruptionCodes[jobId] !== encodeRestPendingInterruption(input.interruptionKind)
    )
      return false;
    jobCore.readCommittedAutonomyJobInto(
      jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      this.committedJobOutput,
    );
    const row = this.committedJobOutput;
    return (
      row.ok &&
      row.state === "tombstone" &&
      row.version === input.expectedJobCoreVersion &&
      row.jobKind === M3_REST_SLEEP_JOB_KIND &&
      row.targetId === (this.fixtureIds[jobId] ?? 0) &&
      row.status === restTerminalStatus(input.outcome) &&
      row.step === "complete" &&
      row.interruptionPolicy ===
        decodeRestInterruptionPolicy(this.interruptionPolicyCodes[jobId] ?? 0) &&
      row.failureReason === input.failureReason &&
      row.createdTick === (this.createdTicks[jobId] ?? 0) &&
      row.stepEnteredTick === input.tick &&
      row.lastMutationTick === input.tick &&
      row.stepTickCount === (this.jobCoreStepTickCounts[jobId] ?? 0) &&
      row.progressQ16 === (this.recoveryProgressQ16[jobId] ?? 0) &&
      row.requiredWorkQ16 === (this.requiredWorkQ16s[jobId] ?? 0) &&
      row.carriedDefId === M3_REST_FIXTURE_NONE &&
      row.carriedAmount === 0 &&
      row.terminalEffectPhase === REST_EFFECT_TERMINAL
    );
  }

  private prepareRestTerminal(
    input: RestAdoptedTerminalInput | RestResumeCleanupInput,
    jobCore: JobCoreStore,
  ): boolean {
    jobCore.prepareAutonomyTerminalScalarsInto(
      input.jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      restTerminalStatus(input.outcome),
      input.failureReason,
      REST_EFFECT_TERMINAL,
      input.interruptionKind,
      this.preparedTerminal,
    );
    return this.preparedTerminal.ok;
  }

  private hasRestTerminalHeadroom(
    jobId: number,
    outcome: RestAdoptedTerminalOutcome,
    resume: boolean,
  ): boolean {
    if (
      this.storeVersion > (resume ? 0xffff_fffe : 0xffff_fffd) ||
      this.cleanupReleaseCount > 0xffff_fffd ||
      this.activeCount === 0
    )
      return false;
    const currentStep = this.stepCodes[jobId] ?? REST_JOB_INACTIVE;
    if (currentStep === REST_JOB_PATHING_TO_FIXTURE && this.pathingCount === 0) return false;
    if (
      (currentStep === REST_JOB_RESTING || currentStep === REST_JOB_SLEEPING) &&
      this.recoveringCount === 0
    )
      return false;
    if (outcome === "completed") {
      return this.completedCount < 0xffff_ffff && this.completedJobCount < 0xffff_ffff;
    }
    if (outcome === "failed") {
      return this.failedCount < 0xffff_ffff && this.failedJobCount < 0xffff_ffff;
    }
    if (outcome === "interrupted") {
      return (
        this.canceledCount < 0xffff_ffff &&
        this.interruptedCount < 0xffff_ffff &&
        this.cancelledJobCount < 0xffff_ffff &&
        this.interruptedJobCount < 0xffff_ffff
      );
    }
    return this.canceledCount < 0xffff_ffff && this.cancelledJobCount < 0xffff_ffff;
  }

  private hasRestLedgerReleaseHeadroom(
    expectedCurrentLedgerVersion: number,
    ledger: ReservationLedger,
  ): boolean {
    return (
      isSafeUint32(expectedCurrentLedgerVersion) &&
      expectedCurrentLedgerVersion === ledger.version &&
      ledger.version < 0xffff_ffff
    );
  }

  private releaseRestClaims(
    input: RestAdoptedTerminalInput | RestResumeCleanupInput,
    ledger: ReservationLedger,
  ): void {
    const jobId = input.jobId;
    this.releaseClaimIds[0] = this.fixtureClaimIds[jobId] ?? M3_REST_FIXTURE_NONE;
    this.releaseClaimIds[1] = this.interactionClaimIds[jobId] ?? M3_REST_FIXTURE_NONE;
    this.releaseClaimEpochs[0] = this.fixtureClaimEpochs[jobId] ?? 0;
    this.releaseClaimEpochs[1] = this.interactionClaimEpochs[jobId] ?? 0;
    this.releaseOwnerScratch.index = input.owner.index;
    this.releaseOwnerScratch.generation = input.owner.generation;
    ledger.releaseClaimsInto(
      this.releaseClaimIds,
      this.releaseClaimEpochs,
      2,
      this.releaseOwnerScratch,
      jobId,
      input.jobGeneration,
      input.expectedCurrentLedgerVersion,
      this.releaseOutput,
    );
  }

  private persistRestCleanupPending(input: RestAdoptedTerminalInput): void {
    const jobId = input.jobId;
    this.cleanupPendingFlags[jobId] = 1;
    this.effectPhases[jobId] = REST_EFFECT_CLEANUP_PENDING;
    this.pendingOutcomes[jobId] = encodeRestPendingOutcome(input.outcome);
    this.pendingReasonCodes[jobId] = encodeRestReason(input.terminalReason);
    this.pendingFailureCodes[jobId] = encodeRestPendingFailure(input.failureReason);
    this.pendingInterruptionCodes[jobId] = encodeRestPendingInterruption(input.interruptionKind);
    this.storeVersion += 1;
  }

  private commitRestTerminalTail(
    input: RestAdoptedTerminalInput | RestResumeCleanupInput,
    jobCore: JobCoreStore,
    output: RestAdoptedMutationOutput,
  ): void {
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    const jobId = input.jobId;
    const previousStep = this.stepCodes[jobId] ?? 0;
    if (previousStep === REST_JOB_PATHING_TO_FIXTURE) this.pathingCount -= 1;
    if (previousStep === REST_JOB_RESTING || previousStep === REST_JOB_SLEEPING) {
      this.recoveringCount -= 1;
    }
    this.active[jobId] = 0;
    this.activeCount -= 1;
    this.stepCodes[jobId] = restTerminalStep(input.outcome);
    this.stepEnteredTicks[jobId] = input.tick;
    this.lastEffectTicks[jobId] = input.tick;
    this.effectPhases[jobId] = REST_EFFECT_TERMINAL;
    this.cleanupPendingFlags[jobId] = 0;
    this.pendingOutcomes[jobId] = REST_PENDING_NONE;
    this.pendingReasonCodes[jobId] = 0;
    this.pendingFailureCodes[jobId] = encodeRestPendingFailure(input.failureReason);
    this.pendingInterruptionCodes[jobId] = encodeRestPendingInterruption(input.interruptionKind);
    this.terminalReasonCodes[jobId] = encodeRestReason(input.terminalReason);
    this.terminalOutcomes[jobId] = encodeRestPendingOutcome(input.outcome);
    this.fixtureClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.fixtureClaimEpochs[jobId] = 0;
    this.interactionClaimEpochs[jobId] = 0;
    this.fixtureClaimCreatedTicks[jobId] = 0;
    this.interactionClaimCreatedTicks[jobId] = 0;
    this.fixtureClaimLeaseExpiryTicks[jobId] = 0;
    this.interactionClaimLeaseExpiryTicks[jobId] = 0;
    this.reservationVersions[jobId] = this.releaseOutput.version;
    this.jobSlotVersions[jobId] = this.preparedTerminal.nextSlotVersion;
    this.clearRestOrigin(jobId);
    this.cleanupReleaseCount += this.releaseOutput.releasedCount;
    this.incrementTerminalCurrent(this.terminalOutcomes[jobId] ?? REST_PENDING_NONE);
    if (input.outcome === "completed") {
      this.completedJobCount += 1;
    }
    if (input.outcome === "canceled") {
      this.cancelledJobCount += 1;
    }
    if (input.outcome === "failed") {
      this.failedJobCount += 1;
    }
    if (input.outcome === "interrupted") {
      this.cancelledJobCount += 1;
      this.interruptedJobCount += 1;
    }
    this.storeVersion += 1;
    writeRestAdoptedMutationSuccess(
      jobId,
      input.jobGeneration,
      this.preparedTerminal.nextSlotVersion,
      this.preparedTerminal.nextJobCoreVersion,
      this.storeVersion,
      this.releaseOutput.version,
      0,
      0,
      false,
      false,
      true,
      this.releaseOutput.releasedCount,
      input.outcome,
      output,
    );
    this.writeRestMutationMetrics(jobId, jobCore, output);
  }

  private writeRestMutationMetrics(
    jobId: number,
    jobCore: JobCoreStore,
    output: RestAdoptedMutationOutput,
  ): void {
    output.ownerIndex = this.ownerIndexes[jobId] ?? M3_REST_FIXTURE_NONE;
    output.ownerGeneration = this.ownerGenerations[jobId] ?? 0;
    output.jobCoreReservedCount = jobCore.reservedAutonomyJobCount;
    output.jobCoreActiveCount = jobCore.activeJobCount;
    output.jobCoreRunningCount = jobCore.runningAutonomyJobCount;
    output.jobCoreCurrentTombstoneCount = jobCore.currentTombstoneJobCount;
    output.jobCoreCumulativeTerminalCount = jobCore.cumulativeTerminalJobCount;
    output.driverActiveCount = this.activeCount;
    output.driverPathingCount = this.pathingCount;
    output.driverRecoveringCount = this.recoveringCount;
    output.driverCompletedCount = this.completedCount;
    output.driverCanceledCount = this.canceledCount;
    output.driverFailedCount = this.failedCount;
    output.driverInterruptedCount = this.interruptedCount;
    output.reservationAttemptCount = this.reservationAttemptCount;
    output.reservationFailureCount = this.reservationFailureCount;
    output.cleanupReleaseCount = this.cleanupReleaseCount;
    output.cumulativeCompletedCount = this.completedJobCount;
    output.cumulativeCanceledCount = this.cancelledJobCount;
    output.cumulativeFailedCount = this.failedJobCount;
    output.cumulativeInterruptedCount = this.interruptedJobCount;
  }
}

export class RestSleepTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly ticks: Float64Array;
  private readonly actorIds: Uint32Array;
  private readonly fixtureIds: Uint32Array;
  private readonly candidateTotals: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly selectedCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedCaps: Uint32Array;
  private readonly exactPathCounts: Uint32Array;
  private readonly exactPathCaps: Uint32Array;
  private readonly nodeExpansions: Uint32Array;
  private readonly sourceRestVersions: Uint32Array;
  private readonly environmentVersions: Uint32Array;
  private readonly reservationVersions: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity = M3_REST_SLEEP_TRACE_CAPACITY) {
    assertValidCapacity(capacity, "rest trace capacity");
    this.capacity = capacity;
    this.sequences = new Uint32Array(capacity);
    this.ticks = new Float64Array(capacity);
    this.actorIds = new Uint32Array(capacity);
    this.fixtureIds = new Uint32Array(capacity);
    this.candidateTotals = new Uint32Array(capacity);
    this.visitedCounts = new Uint32Array(capacity);
    this.selectedCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedCaps = new Uint32Array(capacity);
    this.exactPathCounts = new Uint32Array(capacity);
    this.exactPathCaps = new Uint32Array(capacity);
    this.nodeExpansions = new Uint32Array(capacity);
    this.sourceRestVersions = new Uint32Array(capacity);
    this.environmentVersions = new Uint32Array(capacity);
    this.reservationVersions = new Uint32Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
    this.fixtureIds.fill(M3_REST_FIXTURE_NONE);
  }

  record(input: RestTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;
    this.sequences[slot] = sequence;
    this.ticks[slot] = input.tick;
    this.actorIds[slot] = input.actorId;
    this.fixtureIds[slot] = input.fixtureId;
    this.candidateTotals[slot] = input.candidateTotal;
    this.visitedCounts[slot] = input.visitedCount;
    this.selectedCounts[slot] = input.selectedCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedCaps[slot] = input.selectedCap;
    this.exactPathCounts[slot] = input.exactPathCount;
    this.exactPathCaps[slot] = input.exactPathCap;
    this.nodeExpansions[slot] = input.nodeExpansions;
    this.sourceRestVersions[slot] = input.sourceRestVersion;
    this.environmentVersions[slot] = input.environmentVersion;
    this.reservationVersions[slot] = input.reservationVersion;
    this.reasonCodes[slot] = encodeRestReason(input.reason);
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): RestTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }

    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    return {
      sequence: this.sequences[slot] ?? 0,
      tick: this.ticks[slot] ?? 0,
      actorId: this.actorIds[slot] ?? 0,
      fixtureId: this.fixtureIds[slot] ?? M3_REST_FIXTURE_NONE,
      candidateTotal: this.candidateTotals[slot] ?? 0,
      visitedCount: this.visitedCounts[slot] ?? 0,
      selectedCount: this.selectedCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedCap: this.selectedCaps[slot] ?? 0,
      exactPathCount: this.exactPathCounts[slot] ?? 0,
      exactPathCap: this.exactPathCaps[slot] ?? 0,
      nodeExpansions: this.nodeExpansions[slot] ?? 0,
      sourceRestVersion: this.sourceRestVersions[slot] ?? 0,
      environmentVersion: this.environmentVersions[slot] ?? 0,
      reservationVersion: this.reservationVersions[slot] ?? 0,
      reason: decodeRestReason(this.reasonCodes[slot] ?? REST_REASON_NONE),
    };
  }

  createMetrics(): { readonly capacity: number; readonly storedCount: number } {
    return { capacity: this.capacity, storedCount: this.stored };
  }
}

export function selectPathResolvedRestFixture(input: RestSelectionInput): RestSelectionResult {
  const emergencyThreshold = input.emergencyNeedThreshold ?? M3_REST_EMERGENCY_THRESHOLD;
  const restThreshold = input.restUrgencyThreshold ?? M3_REST_URGENCY_THRESHOLD;
  const restValue = input.needStore.readLaneValue(input.actorId, NEED_LANE_REST);
  const sourceRestVersion = input.needStore.readLaneOwnerVersion(input.actorId, NEED_LANE_REST);
  const reservationVersion = 0;

  if (!(input.actorCanRest ?? true)) {
    return createSelectionFailure(input, "rest.rejected_ability", sourceRestVersion, 0);
  }

  if (restValue >= restThreshold) {
    return createSelectionFailure(input, "rest.rejected_actor_not_tired", sourceRestVersion, 0);
  }

  if (
    input.needStore.readLaneValue(input.actorId, NEED_LANE_HUNGER) < emergencyThreshold ||
    input.needStore.readLaneValue(input.actorId, NEED_LANE_SAFETY) < emergencyThreshold
  ) {
    return createSelectionFailure(input, "rest.rejected_emergency_need", sourceRestVersion, 0);
  }

  const candidateCap = input.candidateCap ?? M3_REST_DEFAULT_CANDIDATE_CAP;
  const maxSelected = input.maxSelectedFixtures ?? M3_REST_DEFAULT_SELECTED_CAP;
  const maxExactPaths = input.maxExactPaths ?? M3_REST_DEFAULT_EXACT_PATH_CAP;
  const candidates = input.restIndex.selectCandidates(
    {
      regionId: input.regionId,
      restKind: input.restKind,
      scheduleWindow: input.environment.dayNight.scheduleWindow,
      weatherExposure: input.weatherExposure ?? "indoor",
      permissionId: input.permissionId,
      candidateCap,
      maxSelectedFixtures: maxSelected,
    },
    input.outputFixtureIds,
  );

  if (!candidates.ok) {
    return createSelectionFailure(input, candidates.reason, sourceRestVersion, 0);
  }

  if (candidates.selectedCount === 0) {
    const sequence = recordSelectionTrace(input, {
      sourceRestVersion,
      reservationVersion,
      candidateTotal: candidates.candidateTotal,
      visitedCount: candidates.visitedCount,
      selectedCount: candidates.selectedCount,
      candidateCap,
      selectedCap: maxSelected,
      exactPathCount: 0,
      exactPathCap: maxExactPaths,
      nodeExpansions: 0,
      fixtureId: M3_REST_FIXTURE_NONE,
      reason: candidates.reason,
    });
    return {
      ok: false,
      actorId: input.actorId,
      candidateTotal: candidates.candidateTotal,
      visitedCount: candidates.visitedCount,
      selectedCount: candidates.selectedCount,
      exactPathCount: 0,
      nodeExpansions: 0,
      traceSequence: sequence,
      reason: candidates.reason,
    };
  }

  input.pathCandidateScratch.length = 0;
  for (let index = 0; index < candidates.selectedCount; index += 1) {
    const fixtureId = input.outputFixtureIds[index] ?? M3_REST_FIXTURE_NONE;
    const fixture = input.restStore.readFixture(fixtureId);
    if (fixture !== undefined) {
      input.pathCandidateScratch.push({
        candidateId: fixtureId,
        targetCellIndex: fixture.targetCellIndex,
        scoreMilli: fixture.baseScoreMilli,
      });
    }
  }

  const pathOptions = {
    originCellIndex: input.originCellIndex,
    candidates: input.pathCandidateScratch,
    maxExactPaths,
    basis: input.pathBasis,
    issuedTick: input.issuedTick,
    requestSequenceStart: input.requestSequenceStart,
  };
  const pathing =
    input.maxNodeExpansions === undefined
      ? resolveTopKPathCandidates(input.pathfinder, input.grid, pathOptions)
      : resolveTopKPathCandidates(input.pathfinder, input.grid, {
          ...pathOptions,
          maxNodeExpansions: input.maxNodeExpansions,
        });

  if (!pathing.ok) {
    return createSelectionFailure(input, "path.no_route_to_rest_fixture", sourceRestVersion, 0);
  }

  const selectedPath = firstSuccessfulPath(pathing.results);
  const reason: RestSleepReason =
    selectedPath === undefined ? "path.no_route_to_rest_fixture" : "rest.selected_indexed_path";
  const selectedFixtureId =
    selectedPath?.goalCellIndex !== undefined
      ? findFixtureForGoal(input, candidates.selectedCount, selectedPath.goalCellIndex)
      : M3_REST_FIXTURE_NONE;
  const traceSequence = recordSelectionTrace(input, {
    sourceRestVersion,
    reservationVersion,
    candidateTotal: candidates.candidateTotal,
    visitedCount: candidates.visitedCount,
    selectedCount: candidates.selectedCount,
    candidateCap,
    selectedCap: maxSelected,
    exactPathCount: pathing.exactPathCount,
    exactPathCap: maxExactPaths,
    nodeExpansions: pathing.nodeExpansions,
    fixtureId: selectedFixtureId,
    reason: candidates.candidateCapHit ? "trace.candidate_cap_reached" : reason,
  });

  if (selectedPath === undefined) {
    return {
      ok: false,
      actorId: input.actorId,
      candidateTotal: candidates.candidateTotal,
      visitedCount: candidates.visitedCount,
      selectedCount: candidates.selectedCount,
      exactPathCount: pathing.exactPathCount,
      nodeExpansions: pathing.nodeExpansions,
      traceSequence,
      reason,
    };
  }

  return {
    ok: true,
    actorId: input.actorId,
    fixtureId: selectedFixtureId,
    selectedPath,
    candidateTotal: candidates.candidateTotal,
    visitedCount: candidates.visitedCount,
    selectedCount: candidates.selectedCount,
    exactPathCount: pathing.exactPathCount,
    nodeExpansions: pathing.nodeExpansions,
    candidateCapHit: candidates.candidateCapHit,
    exactPathCapHit: pathing.capHitCount > 0,
    traceSequence,
    reason: "rest.selected_indexed_path",
  };
}

export function createRestSleepStore(
  fixtureCapacity: number,
  regionCapacity: number,
  permissionCapacity: number,
): RestSleepStore {
  return new RestSleepStore(fixtureCapacity, regionCapacity, permissionCapacity);
}

export function createRestCandidateIndex(options: RestCandidateIndexOptions): RestCandidateIndex {
  return new RestCandidateIndex(options);
}

export function createRestJobDriverStore(capacity: number): RestJobDriverStore {
  return new RestJobDriverStore(capacity);
}

export function createRestSleepTraceStore(capacity?: number): RestSleepTraceStore {
  return new RestSleepTraceStore(capacity);
}

function createSelectionFailure(
  input: RestSelectionInput,
  reason: RestSleepReason,
  sourceRestVersion: number,
  reservationVersion: number,
): RestSelectionResult {
  const sequence = recordSelectionTrace(input, {
    sourceRestVersion,
    reservationVersion,
    candidateTotal: 0,
    visitedCount: 0,
    selectedCount: 0,
    candidateCap: input.candidateCap ?? M3_REST_DEFAULT_CANDIDATE_CAP,
    selectedCap: input.maxSelectedFixtures ?? M3_REST_DEFAULT_SELECTED_CAP,
    exactPathCount: 0,
    exactPathCap: input.maxExactPaths ?? M3_REST_DEFAULT_EXACT_PATH_CAP,
    nodeExpansions: 0,
    fixtureId: M3_REST_FIXTURE_NONE,
    reason,
  });
  return {
    ok: false,
    actorId: input.actorId,
    candidateTotal: 0,
    visitedCount: 0,
    selectedCount: 0,
    exactPathCount: 0,
    nodeExpansions: 0,
    traceSequence: sequence,
    reason,
  };
}

function recordSelectionTrace(
  input: RestSelectionInput,
  trace: Omit<RestTraceInput, "tick" | "actorId" | "environmentVersion"> & {
    readonly environmentVersion?: number;
  },
): number {
  return (
    input.traceStore?.record({
      tick: input.issuedTick,
      actorId: input.actorId,
      fixtureId: trace.fixtureId,
      candidateTotal: trace.candidateTotal,
      visitedCount: trace.visitedCount,
      selectedCount: trace.selectedCount,
      candidateCap: trace.candidateCap,
      selectedCap: trace.selectedCap,
      exactPathCount: trace.exactPathCount,
      exactPathCap: trace.exactPathCap,
      nodeExpansions: trace.nodeExpansions,
      sourceRestVersion: trace.sourceRestVersion,
      environmentVersion: trace.environmentVersion ?? input.environment.version,
      reservationVersion: trace.reservationVersion,
      reason: trace.reason,
    }) ?? 0
  );
}

function firstSuccessfulPath(results: readonly PathSearchResult[]): PathSearchResult | undefined {
  for (const result of results) {
    if (result.ok) {
      return result;
    }
  }

  return undefined;
}

function findFixtureForGoal(
  input: RestSelectionInput,
  selectedCount: number,
  goalCellIndex: number,
): number {
  for (let index = 0; index < selectedCount; index += 1) {
    const fixtureId = input.outputFixtureIds[index] ?? M3_REST_FIXTURE_NONE;
    const fixture = input.restStore.readFixture(fixtureId);
    if (fixture?.targetCellIndex === goalCellIndex) {
      return fixtureId;
    }
  }

  return M3_REST_FIXTURE_NONE;
}

function validateRestJobSnapshotShape(
  snapshot: unknown,
  capacity: number,
):
  | { readonly ok: true; readonly snapshot: RestJobDriverSnapshot }
  | { readonly ok: false; readonly reason: RestSleepReason } {
  if (!isRestJobDriverSnapshot(snapshot, capacity)) {
    return { ok: false, reason: "rest.fixture_input_invalid" };
  }
  return { ok: true, snapshot };
}

const REST_JOB_SNAPSHOT_KEYS = [
  "snapshotVersion",
  "capacity",
  "storeVersion",
  "activeCount",
  "pathingCount",
  "recoveringCount",
  "completedCount",
  "canceledCount",
  "failedCount",
  "interruptedCount",
  "reservationAttemptCount",
  "reservationFailureCount",
  "cleanupReleaseCount",
  "cumulativeCompletedCount",
  "cumulativeCanceledCount",
  "cumulativeFailedCount",
  "cumulativeInterruptedCount",
  "rows",
] as const;
const REST_JOB_ROW_KEYS = [
  "jobId",
  "active",
  "ownerIndex",
  "ownerGeneration",
  "actorId",
  "fixtureId",
  "restKindCode",
  "stepCode",
  "targetCellIndex",
  "interactionSpotId",
  "scheduleCode",
  "environmentVersion",
  "needOwnerVersion",
  "lastNeedExpectedValue",
  "lastNeedDelta",
  "lastNeedExpectedStoreVersion",
  "lastNeedExpectedLaneVersion",
  "lastNeedNextStoreVersion",
  "lastNeedChanged",
  "reservationVersion",
  "claimIds",
  "claimEpochs",
  "claimCreatedTicks",
  "claimLeaseExpiryTicks",
  "jobGeneration",
  "jobSlotVersion",
  "jobCoreStepTickCount",
  "jobCoreAdoptionReservationVersion",
  "jobCoreAdoptionDriverVersion",
  "jobCoreAdoptionSlotVersion",
  "createdTick",
  "recoveryTargetValue",
  "recoveryPerTickQ16",
  "recoveryProgressQ16",
  "stepEnteredTick",
  "lastEffectTick",
  "effectPhase",
  "interruptionPolicyCode",
  "requiredWorkQ16",
  "readyToComplete",
  "cleanupPending",
  "pendingOutcome",
  "pendingReasonCode",
  "pendingFailureCode",
  "pendingInterruptionCode",
  "returnedOnce",
  "terminalReasonCode",
  "terminalOutcome",
  "origin",
] as const;
const REST_JOB_ORIGIN_KEYS = [
  "present",
  "ownerIndex",
  "ownerGeneration",
  "actorId",
  "fixtureId",
  "restKindCode",
  "stepCode",
  "targetCellIndex",
  "interactionSpotId",
  "scheduleCode",
  "environmentVersion",
  "needOwnerVersion",
  "lastNeedExpectedValue",
  "lastNeedDelta",
  "lastNeedExpectedStoreVersion",
  "lastNeedExpectedLaneVersion",
  "lastNeedNextStoreVersion",
  "lastNeedChanged",
  "reservationVersion",
  "jobGeneration",
  "jobSlotVersion",
  "jobCoreStepTickCount",
  "jobCoreAdoptionReservationVersion",
  "jobCoreAdoptionDriverVersion",
  "jobCoreAdoptionSlotVersion",
  "createdTick",
  "recoveryTargetValue",
  "recoveryPerTickQ16",
  "recoveryProgressQ16",
  "stepEnteredTick",
  "lastEffectTick",
  "effectPhase",
  "interruptionPolicyCode",
  "requiredWorkQ16",
  "readyToComplete",
  "terminalReasonCode",
  "terminalOutcome",
  "terminalFailureCode",
  "terminalInterruptionCode",
] as const;

function isRestJobDriverSnapshot(value: unknown, capacity: number): value is RestJobDriverSnapshot {
  if (
    !isExactRestObject(value, REST_JOB_SNAPSHOT_KEYS) ||
    value.snapshotVersion !== M3_REST_SLEEP_STORE_VERSION ||
    value.capacity !== capacity ||
    !isSafeUint32(value.storeVersion) ||
    !isSafeUint32(value.activeCount) ||
    !isSafeUint32(value.pathingCount) ||
    !isSafeUint32(value.recoveringCount) ||
    !isSafeUint32(value.completedCount) ||
    !isSafeUint32(value.canceledCount) ||
    !isSafeUint32(value.failedCount) ||
    !isSafeUint32(value.interruptedCount) ||
    !isSafeUint32(value.reservationAttemptCount) ||
    !isSafeUint32(value.reservationFailureCount) ||
    value.reservationFailureCount > value.reservationAttemptCount ||
    !isSafeUint32(value.cleanupReleaseCount) ||
    !isSafeUint32(value.cumulativeCompletedCount) ||
    !isSafeUint32(value.cumulativeCanceledCount) ||
    !isSafeUint32(value.cumulativeFailedCount) ||
    !isSafeUint32(value.cumulativeInterruptedCount) ||
    !isDenseRestSnapshotRows(value.rows, capacity)
  )
    return false;
  let activeCount = 0;
  let pathing = 0;
  let recovering = 0;
  let completed = 0;
  let canceled = 0;
  let failed = 0;
  let interrupted = 0;
  for (let jobId = 0; jobId < capacity; jobId += 1) {
    if (!(jobId in value.rows)) return false;
    const row = value.rows[jobId];
    if (!isRestJobSnapshotRow(row, jobId)) return false;
    activeCount += row.active;
    if (row.active === 1 && row.stepCode === REST_JOB_PATHING_TO_FIXTURE) pathing += 1;
    if (
      row.active === 1 &&
      (row.stepCode === REST_JOB_RESTING || row.stepCode === REST_JOB_SLEEPING)
    )
      recovering += 1;
    if (row.terminalOutcome === REST_PENDING_COMPLETE) completed += 1;
    if (
      row.terminalOutcome === REST_PENDING_CANCELED ||
      row.terminalOutcome === REST_PENDING_INTERRUPTED
    )
      canceled += 1;
    if (row.terminalOutcome === REST_PENDING_FAILED) failed += 1;
    if (row.terminalOutcome === REST_PENDING_INTERRUPTED) interrupted += 1;
  }
  return (
    activeCount === value.activeCount &&
    pathing === value.pathingCount &&
    recovering === value.recoveringCount &&
    completed === value.completedCount &&
    canceled === value.canceledCount &&
    failed === value.failedCount &&
    interrupted === value.interruptedCount &&
    completed <= value.cumulativeCompletedCount &&
    canceled <= value.cumulativeCanceledCount &&
    failed <= value.cumulativeFailedCount &&
    interrupted <= value.cumulativeInterruptedCount
  );
}

function isRestJobSnapshotRow(value: unknown, jobId: number): value is RestJobDriverSnapshotRow {
  if (
    !isExactRestObject(value, REST_JOB_ROW_KEYS) ||
    value.jobId !== jobId ||
    (value.active !== 0 && value.active !== 1) ||
    !isSafeUint32(value.ownerIndex) ||
    !isSafeUint32(value.ownerGeneration) ||
    !isSafeUint32(value.actorId) ||
    !isSafeUint32(value.fixtureId) ||
    !isSafeUint32(value.restKindCode) ||
    value.restKindCode >= REST_KIND_COUNT ||
    !isSafeUint32(value.stepCode) ||
    value.stepCode > REST_JOB_CANCELLED ||
    !isSafeUint32(value.targetCellIndex) ||
    !isSafeUint32(value.interactionSpotId) ||
    !isSafeUint32(value.scheduleCode) ||
    value.scheduleCode >= SCHEDULE_COUNT ||
    !isSafeUint32(value.environmentVersion) ||
    !isSafeUint32(value.needOwnerVersion) ||
    !isNeedValue(value.lastNeedExpectedValue) ||
    typeof value.lastNeedDelta !== "number" ||
    !Number.isSafeInteger(value.lastNeedDelta) ||
    value.lastNeedDelta < -0x8000_0000 ||
    value.lastNeedDelta > 0x7fff_ffff ||
    !isSafeUint32(value.lastNeedExpectedStoreVersion) ||
    !isSafeUint32(value.lastNeedExpectedLaneVersion) ||
    !isSafeUint32(value.lastNeedNextStoreVersion) ||
    (value.lastNeedChanged !== 0 && value.lastNeedChanged !== 1) ||
    !isSafeUint32(value.reservationVersion) ||
    !isExactRestLane(value.claimIds, false) ||
    !isExactRestLane(value.claimEpochs, false) ||
    !isExactRestTickLane(value.claimCreatedTicks) ||
    !isExactRestTickLane(value.claimLeaseExpiryTicks) ||
    !isSafeUint32(value.jobGeneration) ||
    !isSafeUint32(value.jobSlotVersion) ||
    !isSafeUint32(value.jobCoreStepTickCount) ||
    !isSafeUint32(value.jobCoreAdoptionReservationVersion) ||
    !isSafeUint32(value.jobCoreAdoptionDriverVersion) ||
    !isSafeUint32(value.jobCoreAdoptionSlotVersion) ||
    !isSafeTickValue(value.createdTick) ||
    !isNeedValue(value.recoveryTargetValue) ||
    !isSafeUint32(value.recoveryPerTickQ16) ||
    !isSafeUint32(value.recoveryProgressQ16) ||
    !isSafeTickValue(value.stepEnteredTick) ||
    !isSafeTickValue(value.lastEffectTick) ||
    value.stepEnteredTick < value.createdTick ||
    value.lastEffectTick < value.stepEnteredTick ||
    !isSafeUint32(value.effectPhase) ||
    value.effectPhase > REST_EFFECT_TERMINAL ||
    !isSafeUint32(value.interruptionPolicyCode) ||
    value.interruptionPolicyCode > 3 ||
    !isSafeUint32(value.requiredWorkQ16) ||
    (value.readyToComplete !== 0 && value.readyToComplete !== 1) ||
    (value.cleanupPending !== 0 && value.cleanupPending !== 1) ||
    !isRestPendingOutcome(value.pendingOutcome) ||
    !isSafeUint32(value.pendingReasonCode) ||
    !isSafeUint32(value.pendingFailureCode) ||
    !isSafeUint32(value.pendingInterruptionCode) ||
    value.returnedOnce !== 0 ||
    !isSafeUint32(value.terminalReasonCode) ||
    !isRestPendingOutcome(value.terminalOutcome) ||
    !isRestJobOriginSnapshot(value.origin)
  )
    return false;
  if (value.cleanupPending === 1 && value.effectPhase !== REST_EFFECT_CLEANUP_PENDING) return false;
  if (value.cleanupPending === 0 && value.pendingOutcome !== REST_PENDING_NONE) return false;
  if (value.lastNeedNextStoreVersion === 0) {
    if (
      value.lastNeedExpectedValue !== 0 ||
      value.lastNeedDelta !== 0 ||
      value.lastNeedExpectedStoreVersion !== 0 ||
      value.lastNeedExpectedLaneVersion !== 0 ||
      value.lastNeedChanged !== 0
    )
      return false;
  } else {
    const bump = value.lastNeedChanged;
    if (
      value.lastNeedExpectedStoreVersion + bump !== value.lastNeedNextStoreVersion ||
      value.lastNeedExpectedLaneVersion + bump !== value.needOwnerVersion ||
      value.effectPhase < REST_EFFECT_RECOVERY_APPLIED
    )
      return false;
  }
  if (value.jobGeneration === 0 && value.active === 0) return isCanonicalEmptyRestRowValue(value);
  const claimIds = value.claimIds;
  const claimEpochs = value.claimEpochs;
  const claimCreatedTicks = value.claimCreatedTicks;
  const claimLeaseExpiryTicks = value.claimLeaseExpiryTicks;
  if (
    !isExactRestLane(claimIds, false) ||
    !isExactRestLane(claimEpochs, false) ||
    !isExactRestTickLane(claimCreatedTicks) ||
    !isExactRestTickLane(claimLeaseExpiryTicks)
  )
    return false;
  if (value.jobGeneration === 0) return isValidLegacyRestRow(value);
  const authoritativeCreatedTick = value.createdTick;
  if (typeof authoritativeCreatedTick !== "number") return false;
  if (
    value.ownerGeneration === 0 ||
    value.fixtureId === M3_REST_FIXTURE_NONE ||
    value.requiredWorkQ16 === 0 ||
    value.jobCoreAdoptionSlotVersion === 0 ||
    value.jobCoreAdoptionReservationVersion === 0
  )
    return false;
  if (value.active === 1) {
    if (
      claimIds[0] === M3_REST_FIXTURE_NONE ||
      claimIds[1] === M3_REST_FIXTURE_NONE ||
      claimIds[0] === claimIds[1] ||
      claimEpochs[0] === 0 ||
      claimEpochs[1] === 0 ||
      claimCreatedTicks[0] !== authoritativeCreatedTick ||
      claimCreatedTicks[1] !== authoritativeCreatedTick ||
      (claimLeaseExpiryTicks[0] ?? 0) <= authoritativeCreatedTick ||
      (claimLeaseExpiryTicks[1] ?? 0) <= authoritativeCreatedTick ||
      value.terminalReasonCode !== REST_REASON_NONE ||
      value.terminalOutcome !== REST_PENDING_NONE ||
      isTerminalRestStep(value.stepCode)
    )
      return false;
    if (value.cleanupPending === 1) return isValidRestPendingTuple(value);
    return (
      value.pendingOutcome === REST_PENDING_NONE &&
      value.pendingReasonCode === 0 &&
      value.pendingFailureCode === 0 &&
      value.pendingInterruptionCode === 0 &&
      value.effectPhase <= REST_EFFECT_RECOVERY_APPLIED
    );
  }
  return (
    value.cleanupPending === 0 &&
    value.effectPhase === REST_EFFECT_TERMINAL &&
    claimIds[0] === M3_REST_FIXTURE_NONE &&
    claimIds[1] === M3_REST_FIXTURE_NONE &&
    claimEpochs[0] === 0 &&
    claimEpochs[1] === 0 &&
    claimCreatedTicks[0] === 0 &&
    claimCreatedTicks[1] === 0 &&
    claimLeaseExpiryTicks[0] === 0 &&
    claimLeaseExpiryTicks[1] === 0 &&
    value.pendingOutcome === REST_PENDING_NONE &&
    value.pendingReasonCode === 0 &&
    isRestOutcomeStep(value.terminalOutcome, value.stepCode) &&
    isValidRestOutcomeAuditCodes(
      value.terminalOutcome,
      value.terminalReasonCode,
      value.pendingFailureCode,
      value.pendingInterruptionCode,
    )
  );
}

function isValidRestPendingTuple(row: Record<string, unknown>): boolean {
  const outcome = row["pendingOutcome"];
  const reason = row["pendingReasonCode"];
  const failure = row["pendingFailureCode"];
  const interruption = row["pendingInterruptionCode"];
  if (outcome === REST_PENDING_COMPLETE && row["readyToComplete"] !== 1) return false;
  return isValidRestOutcomeAuditCodes(outcome, reason, failure, interruption);
}

function isValidLegacyRestTerminalTuple(outcome: unknown, step: unknown, reason: unknown): boolean {
  if (outcome === REST_PENDING_COMPLETE) {
    return step === REST_JOB_COMPLETE && reason === REST_REASON_COMPLETED;
  }
  if (outcome === REST_PENDING_CANCELED) {
    return step === REST_JOB_CANCELLED && reason === REST_REASON_CANCELLED;
  }
  if (outcome === REST_PENDING_INTERRUPTED) {
    return step === REST_JOB_CANCELLED && reason === REST_REASON_INTERRUPTED;
  }
  return (
    outcome === REST_PENDING_FAILED &&
    step === REST_JOB_FAILED &&
    typeof reason === "number" &&
    reason !== REST_REASON_NONE &&
    reason !== REST_REASON_SELECTED &&
    reason !== REST_REASON_COMPLETED &&
    reason !== REST_REASON_CANCELLED &&
    reason !== REST_REASON_INTERRUPTED
  );
}

function isValidRestOutcomeAuditCodes(
  outcome: unknown,
  reason: unknown,
  failure: unknown,
  interruption: unknown,
): boolean {
  if (outcome === REST_PENDING_COMPLETE) {
    return reason === REST_REASON_COMPLETED && failure === 0 && interruption === 0;
  }
  if (outcome === REST_PENDING_CANCELED) {
    return reason === REST_REASON_CANCELLED && failure === 6 && interruption === 0;
  }
  if (outcome === REST_PENDING_INTERRUPTED) {
    return (
      reason === REST_REASON_INTERRUPTED &&
      failure === 6 &&
      typeof interruption === "number" &&
      interruption >= 1 &&
      interruption <= 3
    );
  }
  return (
    outcome === REST_PENDING_FAILED &&
    typeof failure === "number" &&
    interruption === 0 &&
    isRestFailureReasonCodeMatch(failure, reason)
  );
}

function isRestOutcomeStep(outcome: unknown, step: unknown): boolean {
  if (outcome === REST_PENDING_COMPLETE) return step === REST_JOB_COMPLETE;
  if (outcome === REST_PENDING_FAILED) return step === REST_JOB_FAILED;
  return (
    (outcome === REST_PENDING_CANCELED || outcome === REST_PENDING_INTERRUPTED) &&
    step === REST_JOB_CANCELLED
  );
}

function isRestFailureReasonCodeMatch(failure: number, reason: unknown): boolean {
  if (failure === 1) return reason === REST_REASON_PATH;
  if (failure === 2) return reason === REST_REASON_RESERVATION;
  if (failure === 3) return reason === REST_REASON_ABILITY;
  if (failure === 4) return reason === REST_REASON_NO_SPOT;
  if (failure === 5) return reason === REST_REASON_STEP;
  if (failure === 7) return reason === REST_REASON_WEATHER;
  return failure === 8 && reason === REST_REASON_SCHEDULE;
}

function isRestJobOriginSnapshot(value: unknown): value is RestJobDriverSnapshotOrigin {
  if (
    !isExactRestObject(value, REST_JOB_ORIGIN_KEYS) ||
    (value.present !== 0 && value.present !== 1)
  )
    return false;
  const keys = REST_JOB_ORIGIN_KEYS;
  for (let index = 1; index < keys.length; index += 1) {
    const field = value[keys[index] ?? "present"];
    if (index === 25 || index === 29 || index === 30) {
      if (!isSafeTickValue(field)) return false;
    } else if (index === 13) {
      if (
        typeof field !== "number" ||
        !Number.isSafeInteger(field) ||
        field < -0x8000_0000 ||
        field > 0x7fff_ffff
      )
        return false;
    } else if (index === 12) {
      if (!isNeedValue(field)) return false;
    } else if (index === 17 || index === 34) {
      if (field !== 0 && field !== 1) return false;
    } else if (!isSafeUint32(field)) return false;
  }
  if (value.present === 0) return isCanonicalEmptyRestOrigin(value);
  const generation = value.jobGeneration;
  const step = value.stepCode;
  const createdTick = value.createdTick;
  const stepTick = value.stepEnteredTick;
  const effectTick = value.lastEffectTick;
  const previousStoreVersion = value.lastNeedExpectedStoreVersion;
  const previousLaneVersion = value.lastNeedExpectedLaneVersion;
  const nextStoreVersion = value.lastNeedNextStoreVersion;
  const changed = value.lastNeedChanged;
  const needOwnerVersion = value.needOwnerVersion;
  if (
    typeof previousStoreVersion !== "number" ||
    typeof previousLaneVersion !== "number" ||
    typeof nextStoreVersion !== "number" ||
    typeof changed !== "number" ||
    typeof needOwnerVersion !== "number"
  )
    return false;
  const needBasisOk =
    value.lastNeedNextStoreVersion === 0
      ? value.lastNeedExpectedValue === 0 &&
        value.lastNeedDelta === 0 &&
        value.lastNeedExpectedStoreVersion === 0 &&
        value.lastNeedExpectedLaneVersion === 0 &&
        value.lastNeedChanged === 0
      : previousStoreVersion + changed === nextStoreVersion &&
        previousLaneVersion + changed === needOwnerVersion;
  return (
    needBasisOk &&
    isSafeUint32(generation) &&
    generation > 0 &&
    isSafeUint32(step) &&
    isTerminalRestStep(step) &&
    isSafeTickValue(createdTick) &&
    isSafeTickValue(stepTick) &&
    isSafeTickValue(effectTick) &&
    stepTick >= createdTick &&
    effectTick >= stepTick &&
    isRestOutcomeStep(value.terminalOutcome, step) &&
    isValidRestOutcomeAuditCodes(
      value.terminalOutcome,
      value.terminalReasonCode,
      value.terminalFailureCode,
      value.terminalInterruptionCode,
    )
  );
}

function isCanonicalEmptyRestOrigin(origin: Record<string, unknown>): boolean {
  return (
    origin["present"] === 0 &&
    origin["ownerIndex"] === 0 &&
    origin["ownerGeneration"] === 0 &&
    origin["actorId"] === 0 &&
    origin["fixtureId"] === M3_REST_FIXTURE_NONE &&
    origin["restKindCode"] === 0 &&
    origin["stepCode"] === REST_JOB_INACTIVE &&
    origin["targetCellIndex"] === 0 &&
    origin["interactionSpotId"] === 0 &&
    origin["scheduleCode"] === 0 &&
    origin["environmentVersion"] === 0 &&
    origin["needOwnerVersion"] === 0 &&
    origin["lastNeedExpectedValue"] === 0 &&
    origin["lastNeedDelta"] === 0 &&
    origin["lastNeedExpectedStoreVersion"] === 0 &&
    origin["lastNeedExpectedLaneVersion"] === 0 &&
    origin["lastNeedNextStoreVersion"] === 0 &&
    origin["lastNeedChanged"] === 0 &&
    origin["reservationVersion"] === 0 &&
    origin["jobGeneration"] === 0 &&
    origin["jobSlotVersion"] === 0 &&
    origin["jobCoreStepTickCount"] === 0 &&
    origin["jobCoreAdoptionReservationVersion"] === 0 &&
    origin["jobCoreAdoptionDriverVersion"] === 0 &&
    origin["jobCoreAdoptionSlotVersion"] === 0 &&
    origin["createdTick"] === 0 &&
    origin["recoveryTargetValue"] === 0 &&
    origin["recoveryPerTickQ16"] === 0 &&
    origin["recoveryProgressQ16"] === 0 &&
    origin["stepEnteredTick"] === 0 &&
    origin["lastEffectTick"] === 0 &&
    origin["effectPhase"] === REST_EFFECT_NONE &&
    origin["interruptionPolicyCode"] === 0 &&
    origin["requiredWorkQ16"] === 0 &&
    origin["readyToComplete"] === 0 &&
    origin["terminalReasonCode"] === REST_REASON_NONE &&
    origin["terminalOutcome"] === REST_PENDING_NONE &&
    origin["terminalFailureCode"] === 0 &&
    origin["terminalInterruptionCode"] === 0
  );
}

function isCanonicalEmptyRestRowValue(row: Record<string, unknown>): boolean {
  const claimIds = row["claimIds"];
  const claimEpochs = row["claimEpochs"];
  const claimCreated = row["claimCreatedTicks"];
  const claimLeases = row["claimLeaseExpiryTicks"];
  const origin = row["origin"];
  return (
    isExactRestLane(claimIds, false) &&
    isExactRestLane(claimEpochs, false) &&
    isExactRestTickLane(claimCreated) &&
    isExactRestTickLane(claimLeases) &&
    isRestJobOriginSnapshot(origin) &&
    origin.present === 0 &&
    row["active"] === 0 &&
    row["ownerIndex"] === 0 &&
    row["ownerGeneration"] === 0 &&
    row["actorId"] === 0 &&
    row["fixtureId"] === M3_REST_FIXTURE_NONE &&
    row["restKindCode"] === 0 &&
    row["stepCode"] === REST_JOB_INACTIVE &&
    row["targetCellIndex"] === 0 &&
    row["interactionSpotId"] === 0 &&
    row["scheduleCode"] === 0 &&
    row["environmentVersion"] === 0 &&
    row["needOwnerVersion"] === 0 &&
    row["lastNeedExpectedValue"] === 0 &&
    row["lastNeedDelta"] === 0 &&
    row["lastNeedExpectedStoreVersion"] === 0 &&
    row["lastNeedExpectedLaneVersion"] === 0 &&
    row["lastNeedNextStoreVersion"] === 0 &&
    row["lastNeedChanged"] === 0 &&
    row["reservationVersion"] === 0 &&
    claimIds[0] === M3_REST_FIXTURE_NONE &&
    claimIds[1] === M3_REST_FIXTURE_NONE &&
    claimEpochs[0] === 0 &&
    claimEpochs[1] === 0 &&
    claimCreated[0] === 0 &&
    claimCreated[1] === 0 &&
    claimLeases[0] === 0 &&
    claimLeases[1] === 0 &&
    row["jobGeneration"] === 0 &&
    row["jobSlotVersion"] === 0 &&
    row["jobCoreStepTickCount"] === 0 &&
    row["jobCoreAdoptionReservationVersion"] === 0 &&
    row["jobCoreAdoptionDriverVersion"] === 0 &&
    row["jobCoreAdoptionSlotVersion"] === 0 &&
    row["createdTick"] === 0 &&
    row["recoveryTargetValue"] === 0 &&
    row["recoveryPerTickQ16"] === 0 &&
    row["recoveryProgressQ16"] === 0 &&
    row["stepEnteredTick"] === 0 &&
    row["lastEffectTick"] === 0 &&
    row["effectPhase"] === REST_EFFECT_NONE &&
    row["interruptionPolicyCode"] === 0 &&
    row["requiredWorkQ16"] === 0 &&
    row["readyToComplete"] === 0 &&
    row["cleanupPending"] === 0 &&
    row["pendingOutcome"] === REST_PENDING_NONE &&
    row["pendingReasonCode"] === 0 &&
    row["pendingFailureCode"] === 0 &&
    row["pendingInterruptionCode"] === 0 &&
    row["returnedOnce"] === 0 &&
    row["terminalReasonCode"] === REST_REASON_NONE &&
    row["terminalOutcome"] === REST_PENDING_NONE
  );
}

function isValidLegacyRestRow(row: Record<string, unknown>): boolean {
  const step = row["stepCode"];
  const claimIds = row["claimIds"];
  const claimEpochs = row["claimEpochs"];
  const claimCreated = row["claimCreatedTicks"];
  const claimLeases = row["claimLeaseExpiryTicks"];
  const origin = row["origin"];
  if (
    !isExactRestLane(claimIds, false) ||
    !isExactRestLane(claimEpochs, false) ||
    !isExactRestTickLane(claimCreated) ||
    !isExactRestTickLane(claimLeases) ||
    !isRestJobOriginSnapshot(origin) ||
    origin.present !== 0 ||
    row["active"] !== 1 ||
    row["ownerGeneration"] === 0 ||
    row["actorId"] !== row["ownerIndex"] ||
    row["fixtureId"] === M3_REST_FIXTURE_NONE ||
    row["restKindCode"] === undefined ||
    row["requiredWorkQ16"] === 0 ||
    row["recoveryPerTickQ16"] === 0 ||
    row["recoveryTargetValue"] === 0 ||
    row["jobSlotVersion"] !== 0 ||
    row["jobCoreStepTickCount"] !== 0 ||
    row["jobCoreAdoptionReservationVersion"] !== 0 ||
    row["jobCoreAdoptionDriverVersion"] !== 0 ||
    row["jobCoreAdoptionSlotVersion"] !== 0 ||
    row["cleanupPending"] !== 0 ||
    row["pendingOutcome"] !== REST_PENDING_NONE ||
    row["pendingReasonCode"] !== 0 ||
    row["pendingFailureCode"] !== 0 ||
    row["pendingInterruptionCode"] !== 0 ||
    row["returnedOnce"] !== 0
  )
    return false;
  if (step === REST_JOB_CREATED)
    return (
      row["reservationVersion"] === 0 &&
      claimsAreCanonicalNone(claimIds, claimEpochs, claimCreated, claimLeases) &&
      row["effectPhase"] === REST_EFFECT_NONE &&
      row["terminalReasonCode"] === REST_REASON_NONE &&
      row["terminalOutcome"] === REST_PENDING_NONE
    );
  if (
    step === REST_JOB_PATHING_TO_FIXTURE ||
    step === REST_JOB_RESTING ||
    step === REST_JOB_SLEEPING
  ) {
    return (
      areLiveRestClaimsCanonical(row, claimIds, claimEpochs, claimCreated, claimLeases) &&
      row["terminalReasonCode"] === REST_REASON_NONE &&
      row["terminalOutcome"] === REST_PENDING_NONE
    );
  }
  return (
    isTerminalRestStep(typeof step === "number" ? step : REST_JOB_INACTIVE) &&
    claimsAreCanonicalNone(claimIds, claimEpochs, claimCreated, claimLeases) &&
    row["effectPhase"] === REST_EFFECT_TERMINAL &&
    isValidLegacyRestTerminalTuple(row["terminalOutcome"], step, row["terminalReasonCode"])
  );
}

function areLiveRestClaimsCanonical(
  row: Record<string, unknown>,
  claimIds: readonly number[],
  claimEpochs: readonly number[],
  claimCreated: readonly number[],
  claimLeases: readonly number[],
): boolean {
  const createdTick = row["createdTick"];
  return (
    typeof createdTick === "number" &&
    claimIds[0] !== M3_REST_FIXTURE_NONE &&
    claimIds[1] !== M3_REST_FIXTURE_NONE &&
    claimIds[0] !== claimIds[1] &&
    (claimEpochs[0] ?? 0) > 0 &&
    (claimEpochs[1] ?? 0) > 0 &&
    (claimCreated[0] ?? 0) >= createdTick &&
    (claimCreated[1] ?? 0) >= createdTick &&
    (claimLeases[0] ?? 0) > (claimCreated[0] ?? 0) &&
    (claimLeases[1] ?? 0) > (claimCreated[1] ?? 0) &&
    row["reservationVersion"] !== 0
  );
}

function claimsAreCanonicalNone(
  claimIds: readonly number[],
  claimEpochs: readonly number[],
  claimCreated: readonly number[],
  claimLeases: readonly number[],
): boolean {
  return (
    claimIds[0] === M3_REST_FIXTURE_NONE &&
    claimIds[1] === M3_REST_FIXTURE_NONE &&
    claimEpochs[0] === 0 &&
    claimEpochs[1] === 0 &&
    claimCreated[0] === 0 &&
    claimCreated[1] === 0 &&
    claimLeases[0] === 0 &&
    claimLeases[1] === 0
  );
}

function isRestPendingOutcome(value: unknown): value is number {
  return (
    value === REST_PENDING_NONE ||
    value === REST_PENDING_COMPLETE ||
    value === REST_PENDING_CANCELED ||
    value === REST_PENDING_FAILED ||
    value === REST_PENDING_INTERRUPTED
  );
}

function isExactRestLane(value: unknown, allowSafeTick: boolean): value is readonly number[] {
  if (!Array.isArray(value) || value.length !== 2 || !(0 in value) || !(1 in value)) return false;
  return allowSafeTick
    ? isSafeTickValue(value[0]) && isSafeTickValue(value[1])
    : isSafeUint32(value[0]) && isSafeUint32(value[1]);
}

function isExactRestTickLane(value: unknown): value is readonly number[] {
  return isExactRestLane(value, true);
}

function isExactRestObject<const T extends readonly string[]>(
  value: unknown,
  keys: T,
): value is Record<T[number], unknown> {
  if (!isPlainObject(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const own = Object.keys(value);
  if (own.length !== keys.length) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  return true;
}

function isDenseRestSnapshotRows(value: unknown, length: number): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length !== length) return false;
  for (let index = 0; index < length; index += 1) if (!(index in value)) return false;
  return true;
}

export function isRestEnvironmentBasisCurrent(
  environment: RestCandidateEnvironmentBasis,
  output: RestCandidateSelectionIntoOutput,
): boolean {
  return (
    output.queryScheduleWindow === environment.scheduleWindow &&
    output.queryWeatherExposure === environment.weatherExposure &&
    output.environmentScheduleWindow === environment.scheduleWindow &&
    output.scheduleWindowVersion === environment.scheduleWindowVersion &&
    output.environmentWeatherExposure === environment.weatherExposure &&
    output.outdoorWorkAllowed === environment.outdoorWorkAllowed &&
    output.weatherVersion === environment.weatherVersion &&
    output.weatherSourceVersion === environment.weatherSourceVersion
  );
}

export function hasRestSelectionScratchCapacity(
  scratch: RestCandidateSelectionIntoScratch,
): boolean {
  return (
    scratch.fixtureIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.entityIndexes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.entityGenerations.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.fixtureKindCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.restKindCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.regionIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.targetCellIndexes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.interactionSpotIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.scheduleCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.weatherCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.permissionIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.recoveryPerTickQ16s.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.scoreMillis.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.cachedFixtureVersions.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.currentFixtureOwnerVersions.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.linkedCandidateFlags.length >= M3_REST_DEFAULT_SELECTED_CAP
  );
}

export function resetRestSelectionScratch(scratch: RestCandidateSelectionIntoScratch): void {
  for (let index = 0; index < M3_REST_DEFAULT_SELECTED_CAP; index += 1) {
    scratch.fixtureIds[index] = M3_REST_FIXTURE_NONE;
    scratch.entityIndexes[index] = 0;
    scratch.entityGenerations[index] = 0;
    scratch.fixtureKindCodes[index] = 0;
    scratch.restKindCodes[index] = 0;
    scratch.regionIds[index] = 0;
    scratch.targetCellIndexes[index] = 0;
    scratch.interactionSpotIds[index] = 0;
    scratch.scheduleCodes[index] = 0;
    scratch.weatherCodes[index] = 0;
    scratch.permissionIds[index] = 0;
    scratch.recoveryPerTickQ16s[index] = 0;
    scratch.scoreMillis[index] = 0;
    scratch.cachedFixtureVersions[index] = 0;
    scratch.currentFixtureOwnerVersions[index] = 0;
    scratch.linkedCandidateFlags[index] = 0;
  }
}

export function copyFirstRestCandidateIntoOutput(
  scratch: RestCandidateSelectionIntoScratch,
  output: RestCandidateSelectionIntoOutput,
): void {
  output.selectedFixtureId = scratch.fixtureIds[0] ?? M3_REST_FIXTURE_NONE;
  output.selectedEntityIndex = scratch.entityIndexes[0] ?? 0;
  output.selectedEntityGeneration = scratch.entityGenerations[0] ?? 0;
  output.selectedFixtureKind = decodeFixtureKind(scratch.fixtureKindCodes[0] ?? 0);
  output.selectedRestKind = decodeRestKind(scratch.restKindCodes[0] ?? 0);
  output.selectedRegionId = scratch.regionIds[0] ?? 0;
  output.selectedTargetCellIndex = scratch.targetCellIndexes[0] ?? 0;
  output.selectedInteractionSpotId = scratch.interactionSpotIds[0] ?? 0;
  output.selectedScheduleWindow = decodeScheduleWindow(scratch.scheduleCodes[0] ?? 0);
  output.selectedWeatherExposure = decodeWeatherExposure(scratch.weatherCodes[0] ?? 0);
  output.selectedPermissionId = scratch.permissionIds[0] ?? 0;
  output.selectedRecoveryPerTickQ16 = scratch.recoveryPerTickQ16s[0] ?? 0;
  output.selectedScoreMilli = scratch.scoreMillis[0] ?? 0;
  output.selectedCachedFixtureVersion = scratch.cachedFixtureVersions[0] ?? 0;
  output.selectedCurrentFixtureOwnerVersion = scratch.currentFixtureOwnerVersions[0] ?? 0;
  output.selectedLinkedCandidate = (scratch.linkedCandidateFlags[0] ?? 0) === 1;
}

function isRestFixtureBefore(
  store: RestSleepStore,
  currentFixtureId: number,
  nextFixtureId: number,
): boolean {
  const currentScore = store.readFixtureBaseScore(currentFixtureId);
  const nextScore = store.readFixtureBaseScore(nextFixtureId);

  if (currentScore !== nextScore) {
    return currentScore > nextScore;
  }

  return currentFixtureId < nextFixtureId;
}

export function createRestBucketKey(
  regionId: number,
  restKindCode: number,
  scheduleCode: number,
  weatherCode: number,
  permissionId: number,
  regionCapacity: number,
  permissionCapacity: number,
): number {
  if (
    !isIndexInRange(regionId, regionCapacity) ||
    !isIndexInRange(restKindCode, REST_KIND_COUNT) ||
    !isIndexInRange(scheduleCode, SCHEDULE_COUNT) ||
    !isIndexInRange(weatherCode, WEATHER_EXPOSURE_COUNT) ||
    !isIndexInRange(permissionId, permissionCapacity)
  ) {
    return -1;
  }

  return (
    (((regionId * REST_KIND_COUNT + restKindCode) * SCHEDULE_COUNT + scheduleCode) *
      WEATHER_EXPOSURE_COUNT +
      weatherCode) *
      permissionCapacity +
    permissionId
  );
}

export function createAggregateKey(
  regionId: number,
  restKindCode: number,
  permissionId: number,
  permissionCapacity: number,
): number {
  return (regionId * REST_KIND_COUNT + restKindCode) * permissionCapacity + permissionId;
}

export function createScheduleKey(
  regionId: number,
  restKindCode: number,
  scheduleCode: number,
  permissionId: number,
  permissionCapacity: number,
): number {
  return (
    ((regionId * REST_KIND_COUNT + restKindCode) * SCHEDULE_COUNT + scheduleCode) *
      permissionCapacity +
    permissionId
  );
}

export function encodeRestKind(kind: RestKind): number {
  return kind === "sleep" ? REST_KIND_SLEEP : REST_KIND_REST;
}

export function encodeOptionalRestKind(kind: RestKind | undefined): number {
  return kind === undefined ? REST_KIND_REST : encodeRestKind(kind);
}

export function decodeRestKind(code: number): RestKind {
  return code === REST_KIND_SLEEP ? "sleep" : "rest";
}

function isRestKindValue(value: unknown): value is RestKind {
  return value === "rest" || value === "sleep";
}

export function encodeFixtureKind(kind: RestFixtureKind): number {
  return kind === "bedroll" ? 1 : 0;
}

export function encodeOptionalFixtureKind(kind: RestFixtureKind | undefined): number {
  return kind === undefined ? 0 : encodeFixtureKind(kind);
}

export function decodeFixtureKind(code: number): RestFixtureKind {
  return code === 1 ? "bedroll" : "clinic_mat";
}

export function encodeWeatherExposure(exposure: RestFixtureWeatherExposure): number {
  return exposure === "outdoor" ? WEATHER_EXPOSURE_OUTDOOR : WEATHER_EXPOSURE_INDOOR;
}

export function encodeOptionalWeatherExposure(
  exposure: RestFixtureWeatherExposure | undefined,
): number {
  return exposure === undefined ? WEATHER_EXPOSURE_INDOOR : encodeWeatherExposure(exposure);
}

export function decodeWeatherExposure(code: number): RestFixtureWeatherExposure {
  return code === WEATHER_EXPOSURE_OUTDOOR ? "outdoor" : "indoor";
}

export function encodeScheduleWindow(window: M3ScheduleWindowId): number {
  if (window === "daytime") {
    return SCHEDULE_DAYTIME;
  }
  if (window === "evening") {
    return SCHEDULE_EVENING;
  }
  if (window === "night") {
    return SCHEDULE_NIGHT;
  }
  return SCHEDULE_DAWN;
}

export function encodeOptionalScheduleWindow(window: M3ScheduleWindowId | undefined): number {
  return window === undefined ? SCHEDULE_DAWN : encodeScheduleWindow(window);
}

export function decodeScheduleWindow(code: number): M3ScheduleWindowId {
  if (code === SCHEDULE_DAYTIME) {
    return "daytime";
  }
  if (code === SCHEDULE_EVENING) {
    return "evening";
  }
  if (code === SCHEDULE_NIGHT) {
    return "night";
  }
  return "dawn";
}

function isScheduleWindowValue(value: unknown): value is M3ScheduleWindowId {
  return value === "dawn" || value === "daytime" || value === "evening" || value === "night";
}

function isRestInterruptionPolicy(value: unknown): boolean {
  return (
    value === undefined ||
    value === "never" ||
    value === "at_safe_point" ||
    value === "immediate" ||
    value === "emergency_only"
  );
}

function encodeRestInterruptionPolicy(value: JobInterruptionPolicy): number {
  if (value === "at_safe_point") return 1;
  if (value === "immediate") return 2;
  if (value === "emergency_only") return 3;
  return 0;
}

function decodeRestInterruptionPolicy(value: number): JobInterruptionPolicy {
  if (value === 1) return "at_safe_point";
  if (value === 2) return "immediate";
  if (value === 3) return "emergency_only";
  return "never";
}

function decodeRestJobStep(code: number): RestJobStep {
  if (code === REST_JOB_CREATED) {
    return "created";
  }
  if (code === REST_JOB_PATHING_TO_FIXTURE) {
    return "pathing_to_fixture";
  }
  if (code === REST_JOB_RESTING) {
    return "resting";
  }
  if (code === REST_JOB_SLEEPING) {
    return "sleeping";
  }
  if (code === REST_JOB_COMPLETE) {
    return "complete";
  }
  if (code === REST_JOB_FAILED) {
    return "failed";
  }
  if (code === REST_JOB_CANCELLED) {
    return "cancelled";
  }
  return "inactive";
}

function isTerminalRestStep(step: number): boolean {
  return step === REST_JOB_COMPLETE || step === REST_JOB_FAILED || step === REST_JOB_CANCELLED;
}

function defaultPolicy(kind: RestKind): "at_safe_point" | "emergency_only" {
  return kind === "sleep" ? "emergency_only" : "at_safe_point";
}

function mapRestFailureToJob(reason: RestSleepReason): JobFailureReason {
  if (reason === "path.no_route_to_rest_fixture") {
    return "path";
  }
  if (reason === "rest.rejected_reservation") {
    return "reservation";
  }
  if (reason === "rest.rejected_ability") {
    return "permission";
  }
  if (reason === "rest.rejected_emergency_need") {
    return "risk";
  }
  if (reason === "rest.rejected_schedule_window" || reason === "rest.rejected_weather_exposure") {
    return "time";
  }
  return "target_state";
}

function encodeRestReason(reason: RestSleepReason): number {
  if (reason === "rest.selected_indexed_path") {
    return REST_REASON_SELECTED;
  }
  if (reason === "rest.completed") {
    return REST_REASON_COMPLETED;
  }
  if (reason === "rest.cancelled") {
    return REST_REASON_CANCELLED;
  }
  if (reason === "rest.rejected_no_indexed_candidate") {
    return REST_REASON_NO_SPOT;
  }
  if (reason === "rest.rejected_schedule_window") {
    return REST_REASON_SCHEDULE;
  }
  if (reason === "rest.rejected_weather_exposure") {
    return REST_REASON_WEATHER;
  }
  if (reason === "path.no_route_to_rest_fixture") {
    return REST_REASON_PATH;
  }
  if (reason === "rest.rejected_reservation") {
    return REST_REASON_RESERVATION;
  }
  if (reason === "rest.rejected_ability") {
    return REST_REASON_ABILITY;
  }
  if (reason === "rest.rejected_emergency_need") {
    return REST_REASON_EMERGENCY;
  }
  if (reason === "rest.rejected_actor_not_tired") {
    return REST_REASON_NOT_TIRED;
  }
  if (reason === "job.interrupted_safe_point") {
    return REST_REASON_INTERRUPTED;
  }
  if (reason === "job.interruption_denied") {
    return REST_REASON_INTERRUPT_DENIED;
  }
  if (reason === "trace.candidate_cap_reached") {
    return REST_REASON_CANDIDATE_CAP;
  }
  if (reason === "rest.job_core_failed") {
    return REST_REASON_JOB_CORE;
  }
  if (reason === "rest.need_update_failed") {
    return REST_REASON_NEED;
  }
  if (reason === "rest.step_invalid") {
    return REST_REASON_STEP;
  }
  if (reason === "rest.fixture_id_out_of_range") {
    return REST_REASON_FIXTURE_ID_OUT_OF_RANGE;
  }
  if (reason === "rest.fixture_already_active") {
    return REST_REASON_FIXTURE_ALREADY_ACTIVE;
  }
  if (reason === "rest.fixture_not_active") {
    return REST_REASON_FIXTURE_NOT_ACTIVE;
  }
  if (reason === "rest.fixture_entity_invalid") {
    return REST_REASON_FIXTURE_ENTITY_INVALID;
  }
  if (reason === "rest.fixture_input_invalid") {
    return REST_REASON_FIXTURE_INPUT_INVALID;
  }
  if (reason === "rest.job_id_out_of_range") {
    return REST_REASON_JOB_ID_OUT_OF_RANGE;
  }
  if (reason === "rest.job_already_active") {
    return REST_REASON_JOB_ALREADY_ACTIVE;
  }
  if (reason === "rest.job_not_active") {
    return REST_REASON_JOB_NOT_ACTIVE;
  }
  if (reason === "rest.tick_invalid") {
    return REST_REASON_TICK_INVALID;
  }
  const reservationReasonIndex = indexOfReservationReason(reason);
  if (reservationReasonIndex >= 0) {
    return REST_REASON_RESERVATION_BASE + reservationReasonIndex;
  }
  return REST_REASON_NONE;
}

function decodeRestReason(code: number): RestSleepReason {
  if (code === REST_REASON_SELECTED) {
    return "rest.selected_indexed_path";
  }
  if (code === REST_REASON_COMPLETED) {
    return "rest.completed";
  }
  if (code === REST_REASON_CANCELLED) {
    return "rest.cancelled";
  }
  if (code === REST_REASON_NO_SPOT) {
    return "rest.rejected_no_indexed_candidate";
  }
  if (code === REST_REASON_SCHEDULE) {
    return "rest.rejected_schedule_window";
  }
  if (code === REST_REASON_WEATHER) {
    return "rest.rejected_weather_exposure";
  }
  if (code === REST_REASON_PATH) {
    return "path.no_route_to_rest_fixture";
  }
  if (code === REST_REASON_RESERVATION) {
    return "rest.rejected_reservation";
  }
  if (code === REST_REASON_ABILITY) {
    return "rest.rejected_ability";
  }
  if (code === REST_REASON_EMERGENCY) {
    return "rest.rejected_emergency_need";
  }
  if (code === REST_REASON_NOT_TIRED) {
    return "rest.rejected_actor_not_tired";
  }
  if (code === REST_REASON_INTERRUPTED) {
    return "job.interrupted_safe_point";
  }
  if (code === REST_REASON_INTERRUPT_DENIED) {
    return "job.interruption_denied";
  }
  if (code === REST_REASON_CANDIDATE_CAP) {
    return "trace.candidate_cap_reached";
  }
  if (code === REST_REASON_JOB_CORE) {
    return "rest.job_core_failed";
  }
  if (code === REST_REASON_NEED) {
    return "rest.need_update_failed";
  }
  if (code === REST_REASON_STEP) {
    return "rest.step_invalid";
  }
  if (code === REST_REASON_FIXTURE_ID_OUT_OF_RANGE) {
    return "rest.fixture_id_out_of_range";
  }
  if (code === REST_REASON_FIXTURE_ALREADY_ACTIVE) {
    return "rest.fixture_already_active";
  }
  if (code === REST_REASON_FIXTURE_NOT_ACTIVE) {
    return "rest.fixture_not_active";
  }
  if (code === REST_REASON_FIXTURE_ENTITY_INVALID) {
    return "rest.fixture_entity_invalid";
  }
  if (code === REST_REASON_FIXTURE_INPUT_INVALID) {
    return "rest.fixture_input_invalid";
  }
  if (code === REST_REASON_JOB_ID_OUT_OF_RANGE) {
    return "rest.job_id_out_of_range";
  }
  if (code === REST_REASON_JOB_ALREADY_ACTIVE) {
    return "rest.job_already_active";
  }
  if (code === REST_REASON_JOB_NOT_ACTIVE) {
    return "rest.job_not_active";
  }
  if (code === REST_REASON_TICK_INVALID) {
    return "rest.tick_invalid";
  }
  const reservationReasonIndex = code - REST_REASON_RESERVATION_BASE;
  if (reservationReasonIndex >= 0 && reservationReasonIndex < RESERVATION_REASON_VALUES.length) {
    const reservationReason = RESERVATION_REASON_VALUES[reservationReasonIndex];
    if (isRestSleepReason(reservationReason)) {
      return reservationReason;
    }
  }
  return "rest.none";
}

function isRestSleepReason(value: unknown): value is RestSleepReason {
  return typeof value === "string" && (isLocalRestSleepReason(value) || isReservationReason(value));
}

function isLocalRestSleepReason(value: string): boolean {
  return (
    value === "rest.none" ||
    value === "rest.selected_indexed_path" ||
    value === "rest.completed" ||
    value === "rest.rejected_no_indexed_candidate" ||
    value === "rest.rejected_schedule_window" ||
    value === "rest.rejected_weather_exposure" ||
    value === "path.no_route_to_rest_fixture" ||
    value === "rest.rejected_reservation" ||
    value === "rest.rejected_ability" ||
    value === "rest.rejected_emergency_need" ||
    value === "rest.rejected_actor_not_tired" ||
    value === "job.interrupted_safe_point" ||
    value === "job.interruption_denied" ||
    value === "trace.candidate_cap_reached" ||
    value === "rest.job_core_failed" ||
    value === "rest.need_update_failed" ||
    value === "rest.step_invalid" ||
    value === "rest.fixture_id_out_of_range" ||
    value === "rest.fixture_already_active" ||
    value === "rest.fixture_not_active" ||
    value === "rest.fixture_entity_invalid" ||
    value === "rest.fixture_input_invalid" ||
    value === "rest.job_id_out_of_range" ||
    value === "rest.job_already_active" ||
    value === "rest.job_not_active" ||
    value === "rest.tick_invalid"
  );
}

function isReservationReason(value: string): boolean {
  return indexOfReservationReason(value) >= 0;
}

function indexOfReservationReason(value: string): number {
  for (let index = 0; index < RESERVATION_REASON_VALUES.length; index += 1) {
    if (RESERVATION_REASON_VALUES[index] === value) {
      return index;
    }
  }

  return -1;
}

function clearUint32(values: Uint32Array, count: number, fill: number): void {
  for (let index = 0; index < count; index += 1) {
    values[index] = fill;
  }
}

function isNeedValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= NEED_VALUE_MAX
  );
}

function isSafeTickValue(value: unknown): value is Tick {
  return typeof value === "number" && isSafeTick(value);
}

export function isIndexInRange(value: unknown, upperBound: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < upperBound
  );
}

export function isSafeUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff
  );
}

export function isPositiveUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff
  );
}

function clampUint32(value: number): number {
  return Math.min(0xffff_ffff, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function restClaimTarget(
  claims: ReservationClaimsIntoOutput,
  index: number,
  target: EntityId,
): boolean {
  return (
    claims.targetIndexes[index] === target.index &&
    claims.targetGenerations[index] === target.generation
  );
}

function createRestJobTokenOutput(): JobTokenIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: M3_REST_FIXTURE_NONE,
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

function createRestAutonomyMutationOutput(): AutonomyJobMutationIntoOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: M3_REST_FIXTURE_NONE,
    jobGeneration: 0,
    slotVersion: 0,
    version: 0,
    progressQ16: 0,
    readyToComplete: false,
  };
}

function createRestPreparedProgress(): PreparedAutonomyProgress {
  return {
    ok: false,
    reason: undefined,
    jobId: M3_REST_FIXTURE_NONE,
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

function createRestPreparedTerminal(): PreparedAutonomyTerminal {
  return {
    ok: false,
    reason: undefined,
    jobId: M3_REST_FIXTURE_NONE,
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

function createRestPreparedNeed(): PreparedNeedLaneMutation {
  return {
    ok: false,
    reason: undefined,
    actorId: M3_REST_FIXTURE_NONE,
    lane: NEED_LANE_REST,
    tick: 0,
    previousValue: 0,
    nextValue: 0,
    sourceSystemId: 0,
    sourceEventId: 0,
    reasonCode: 0,
    changed: false,
    previousSourceTick: 0,
    previousSourceSystemId: 0,
    previousSourceEventId: 0,
    previousReasonCode: 0,
    previousStoreVersion: 0,
    previousLaneVersion: 0,
    nextStoreVersion: 0,
    nextLaneVersion: 0,
  };
}

function createRestCommittedJobOutput(): AutonomyCommittedJobIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: M3_REST_FIXTURE_NONE,
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
    carriedDefId: M3_REST_FIXTURE_NONE,
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

function resetRestAdoptedMutationOutput(
  output: RestAdoptedMutationOutput,
  driverVersion: number,
): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = M3_REST_FIXTURE_NONE;
  output.jobGeneration = 0;
  output.jobSlotVersion = 0;
  output.jobCoreVersion = 0;
  output.driverVersion = driverVersion;
  output.reservationVersion = 0;
  output.needLaneVersion = 0;
  output.needStoreVersion = 0;
  output.cleanupPending = false;
  output.alreadyCommitted = false;
  output.readyToComplete = false;
  output.releasedClaimCount = 0;
  output.terminalOutcome = undefined;
  output.ownerIndex = M3_REST_FIXTURE_NONE;
  output.ownerGeneration = 0;
  output.jobCoreReservedCount = 0;
  output.jobCoreActiveCount = 0;
  output.jobCoreRunningCount = 0;
  output.jobCoreCurrentTombstoneCount = 0;
  output.jobCoreCumulativeTerminalCount = 0;
  output.driverActiveCount = 0;
  output.driverPathingCount = 0;
  output.driverRecoveringCount = 0;
  output.driverCompletedCount = 0;
  output.driverCanceledCount = 0;
  output.driverFailedCount = 0;
  output.driverInterruptedCount = 0;
  output.reservationAttemptCount = 0;
  output.reservationFailureCount = 0;
  output.cleanupReleaseCount = 0;
  output.cumulativeCompletedCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
  output.cumulativeInterruptedCount = 0;
}

function writeRestAdoptedMutationSuccess(
  jobId: number,
  jobGeneration: number,
  jobSlotVersion: number,
  jobCoreVersion: number,
  driverVersion: number,
  reservationVersion: number,
  needLaneVersion: number,
  needStoreVersion: number,
  cleanupPending: boolean,
  alreadyCommitted: boolean,
  readyToComplete: boolean,
  releasedClaimCount: number,
  terminalOutcome: RestAdoptedTerminalOutcome | undefined,
  output: RestAdoptedMutationOutput,
): void {
  output.ok = true;
  output.jobId = jobId;
  output.jobGeneration = jobGeneration;
  output.jobSlotVersion = jobSlotVersion;
  output.jobCoreVersion = jobCoreVersion;
  output.driverVersion = driverVersion;
  output.reservationVersion = reservationVersion;
  output.needLaneVersion = needLaneVersion;
  output.needStoreVersion = needStoreVersion;
  output.cleanupPending = cleanupPending;
  output.alreadyCommitted = alreadyCommitted;
  output.readyToComplete = readyToComplete;
  output.releasedClaimCount = releasedClaimCount;
  output.terminalOutcome = terminalOutcome;
}

function restTerminalStatus(
  outcome: RestAdoptedTerminalOutcome,
): "completed" | "canceled" | "failed" {
  if (outcome === "completed") return "completed";
  if (outcome === "failed") return "failed";
  return "canceled";
}

function restTerminalStep(outcome: RestAdoptedTerminalOutcome): number {
  if (outcome === "completed") return REST_JOB_COMPLETE;
  if (outcome === "failed") return REST_JOB_FAILED;
  return REST_JOB_CANCELLED;
}

function restCoreStatusForTerminalStep(step: number): "completed" | "failed" | "canceled" {
  if (step === REST_JOB_COMPLETE) return "completed";
  if (step === REST_JOB_FAILED) return "failed";
  return "canceled";
}

function isExactRestTerminalRequestTuple(
  input: RestAdoptedTerminalInput | RestResumeCleanupInput,
): boolean {
  return isValidRestOutcomeAuditCodes(
    encodeRestPendingOutcome(input.outcome),
    encodeRestReason(input.terminalReason),
    encodeRestPendingFailure(input.failureReason),
    encodeRestPendingInterruption(input.interruptionKind),
  );
}

function encodeRestPendingOutcome(outcome: RestAdoptedTerminalOutcome): number {
  if (outcome === "completed") return REST_PENDING_COMPLETE;
  if (outcome === "canceled") return REST_PENDING_CANCELED;
  if (outcome === "failed") return REST_PENDING_FAILED;
  return REST_PENDING_INTERRUPTED;
}

function decodeRestPendingOutcome(outcome: number): RestAdoptedTerminalOutcome | undefined {
  if (outcome === REST_PENDING_COMPLETE) return "completed";
  if (outcome === REST_PENDING_CANCELED) return "canceled";
  if (outcome === REST_PENDING_FAILED) return "failed";
  if (outcome === REST_PENDING_INTERRUPTED) return "interrupted";
  return undefined;
}

function encodeRestPendingFailure(reason: JobFailureReason): number {
  if (reason === "path") return 1;
  if (reason === "reservation") return 2;
  if (reason === "permission") return 3;
  if (reason === "material") return 4;
  if (reason === "target_state") return 5;
  if (reason === "cancelled") return 6;
  if (reason === "risk") return 7;
  if (reason === "time") return 8;
  return 0;
}

function encodeRestPendingInterruption(reason: JobInterruptionKind | undefined): number {
  if (reason === "safe_point") return 1;
  if (reason === "immediate") return 2;
  if (reason === "emergency") return 3;
  return 0;
}

export function createRestAdoptedJobIntoOutput(): RestAdoptedJobIntoOutput {
  const output: RestAdoptedJobIntoOutput = {
    ok: false,
    reason: undefined,
    active: false,
    jobId: M3_REST_FIXTURE_NONE,
    jobGeneration: 0,
    ownerIndex: M3_REST_FIXTURE_NONE,
    ownerGeneration: 0,
    jobSlotVersion: 0,
    jobCoreStepTickCount: 0,
    jobCoreAdoptionReservationVersion: 0,
    jobCoreAdoptionDriverVersion: 0,
    jobCoreAdoptionSlotVersion: 0,
    driverVersion: 0,
    actorId: 0,
    fixtureId: M3_REST_FIXTURE_NONE,
    restKind: undefined,
    step: "inactive",
    targetCellIndex: 0,
    interactionSpotId: 0,
    scheduleWindow: undefined,
    environmentVersion: 0,
    needOwnerVersion: 0,
    lastNeedExpectedValue: 0,
    lastNeedDelta: 0,
    lastNeedExpectedStoreVersion: 0,
    lastNeedExpectedLaneVersion: 0,
    lastNeedNextStoreVersion: 0,
    lastNeedChanged: 0,
    reservationVersion: 0,
    claimIds: new Uint32Array(8),
    claimEpochs: new Uint32Array(8),
    claimCreatedTicks: new Float64Array(8),
    claimLeaseExpiryTicks: new Float64Array(8),
    createdTick: 0,
    recoveryTargetValue: 0,
    recoveryPerTickQ16: 0,
    recoveryProgressQ16: 0,
    stepEnteredTick: 0,
    lastEffectTick: 0,
    effectPhase: 0,
    cleanupPending: 0,
    pendingOutcome: 0,
    pendingReason: undefined,
    pendingFailure: "none",
    pendingInterruption: undefined,
    interruptionPolicy: "never",
    returnedOnce: 0,
    readyToComplete: false,
    terminalReason: "rest.none",
    terminalOutcome: undefined,
    activeCount: 0,
    pathingCount: 0,
    recoveringCount: 0,
    completedCount: 0,
    canceledCount: 0,
    failedCount: 0,
    interruptedCount: 0,
    reservationAttemptCount: 0,
    reservationFailureCount: 0,
    cleanupReleaseCount: 0,
    cumulativeCompletedCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    cumulativeInterruptedCount: 0,
  };
  output.claimIds.fill(M3_REST_FIXTURE_NONE);
  return output;
}

export function createRestAdoptedMutationOutput(): RestAdoptedMutationOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: M3_REST_FIXTURE_NONE,
    jobGeneration: 0,
    jobSlotVersion: 0,
    jobCoreVersion: 0,
    driverVersion: 0,
    reservationVersion: 0,
    needLaneVersion: 0,
    needStoreVersion: 0,
    cleanupPending: false,
    alreadyCommitted: false,
    readyToComplete: false,
    releasedClaimCount: 0,
    terminalOutcome: undefined,
    ownerIndex: M3_REST_FIXTURE_NONE,
    ownerGeneration: 0,
    jobCoreReservedCount: 0,
    jobCoreActiveCount: 0,
    jobCoreRunningCount: 0,
    jobCoreCurrentTombstoneCount: 0,
    jobCoreCumulativeTerminalCount: 0,
    driverActiveCount: 0,
    driverPathingCount: 0,
    driverRecoveringCount: 0,
    driverCompletedCount: 0,
    driverCanceledCount: 0,
    driverFailedCount: 0,
    driverInterruptedCount: 0,
    reservationAttemptCount: 0,
    reservationFailureCount: 0,
    cleanupReleaseCount: 0,
    cumulativeCompletedCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    cumulativeInterruptedCount: 0,
  };
}

export function createRestJobDriverHashFields(
  snapshot: RestJobDriverSnapshot,
  prefix = "m3Rest",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.storeVersion`, value: snapshot.storeVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
    { name: `${prefix}.pathingCount`, value: snapshot.pathingCount },
    { name: `${prefix}.recoveringCount`, value: snapshot.recoveringCount },
    { name: `${prefix}.completedCount`, value: snapshot.completedCount },
    { name: `${prefix}.canceledCount`, value: snapshot.canceledCount },
    { name: `${prefix}.failedCount`, value: snapshot.failedCount },
    { name: `${prefix}.interruptedCount`, value: snapshot.interruptedCount },
    { name: `${prefix}.reservationAttemptCount`, value: snapshot.reservationAttemptCount },
    { name: `${prefix}.reservationFailureCount`, value: snapshot.reservationFailureCount },
    { name: `${prefix}.cleanupReleaseCount`, value: snapshot.cleanupReleaseCount },
    { name: `${prefix}.cumulativeCompletedCount`, value: snapshot.cumulativeCompletedCount },
    { name: `${prefix}.cumulativeCanceledCount`, value: snapshot.cumulativeCanceledCount },
    { name: `${prefix}.cumulativeFailedCount`, value: snapshot.cumulativeFailedCount },
    { name: `${prefix}.cumulativeInterruptedCount`, value: snapshot.cumulativeInterruptedCount },
  ];
  for (let jobId = 0; jobId < snapshot.rows.length; jobId += 1) {
    const row = snapshot.rows[jobId];
    if (row === undefined) continue;
    const rowPrefix = `${prefix}.row.${String(jobId)}`;
    const values = restJobHashScalarValues(row);
    for (let index = 0; index < REST_JOB_HASH_SCALAR_NAMES.length; index += 1) {
      fields.push({
        name: `${rowPrefix}.${REST_JOB_HASH_SCALAR_NAMES[index] ?? "unknown"}`,
        value: values[index] ?? 0,
      });
    }
    for (let index = 0; index < 2; index += 1) {
      fields.push({
        name: `${rowPrefix}.claimId.${String(index)}`,
        value: row.claimIds[index] ?? 0,
      });
      fields.push({
        name: `${rowPrefix}.claimEpoch.${String(index)}`,
        value: row.claimEpochs[index] ?? 0,
      });
      fields.push({
        name: `${rowPrefix}.claimCreatedTick.${String(index)}`,
        value: row.claimCreatedTicks[index] ?? 0,
      });
      fields.push({
        name: `${rowPrefix}.claimLeaseExpiryTick.${String(index)}`,
        value: row.claimLeaseExpiryTicks[index] ?? 0,
      });
    }
    const originValues = restOriginHashScalarValues(row.origin);
    for (let index = 0; index < REST_ORIGIN_HASH_SCALAR_NAMES.length; index += 1) {
      fields.push({
        name: `${rowPrefix}.origin.${REST_ORIGIN_HASH_SCALAR_NAMES[index] ?? "unknown"}`,
        value: originValues[index] ?? 0,
      });
    }
  }
  return fields;
}

const REST_JOB_HASH_SCALAR_NAMES = [
  "jobId",
  "active",
  "ownerIndex",
  "ownerGeneration",
  "actorId",
  "fixtureId",
  "restKindCode",
  "stepCode",
  "targetCellIndex",
  "interactionSpotId",
  "scheduleCode",
  "environmentVersion",
  "needOwnerVersion",
  "lastNeedExpectedValue",
  "lastNeedDelta",
  "lastNeedExpectedStoreVersion",
  "lastNeedExpectedLaneVersion",
  "lastNeedNextStoreVersion",
  "lastNeedChanged",
  "reservationVersion",
  "jobGeneration",
  "jobSlotVersion",
  "jobCoreStepTickCount",
  "jobCoreAdoptionReservationVersion",
  "jobCoreAdoptionDriverVersion",
  "jobCoreAdoptionSlotVersion",
  "createdTick",
  "recoveryTargetValue",
  "recoveryPerTickQ16",
  "recoveryProgressQ16",
  "stepEnteredTick",
  "lastEffectTick",
  "effectPhase",
  "interruptionPolicyCode",
  "requiredWorkQ16",
  "readyToComplete",
  "cleanupPending",
  "pendingOutcome",
  "pendingReasonCode",
  "pendingFailureCode",
  "pendingInterruptionCode",
  "returnedOnce",
  "terminalReasonCode",
  "terminalOutcome",
] as const;

function restJobHashScalarValues(row: RestJobDriverSnapshotRow): readonly number[] {
  return [
    row.jobId,
    row.active,
    row.ownerIndex,
    row.ownerGeneration,
    row.actorId,
    row.fixtureId,
    row.restKindCode,
    row.stepCode,
    row.targetCellIndex,
    row.interactionSpotId,
    row.scheduleCode,
    row.environmentVersion,
    row.needOwnerVersion,
    row.lastNeedExpectedValue,
    row.lastNeedDelta,
    row.lastNeedExpectedStoreVersion,
    row.lastNeedExpectedLaneVersion,
    row.lastNeedNextStoreVersion,
    row.lastNeedChanged,
    row.reservationVersion,
    row.jobGeneration,
    row.jobSlotVersion,
    row.jobCoreStepTickCount,
    row.jobCoreAdoptionReservationVersion,
    row.jobCoreAdoptionDriverVersion,
    row.jobCoreAdoptionSlotVersion,
    row.createdTick,
    row.recoveryTargetValue,
    row.recoveryPerTickQ16,
    row.recoveryProgressQ16,
    row.stepEnteredTick,
    row.lastEffectTick,
    row.effectPhase,
    row.interruptionPolicyCode,
    row.requiredWorkQ16,
    row.readyToComplete,
    row.cleanupPending,
    row.pendingOutcome,
    row.pendingReasonCode,
    row.pendingFailureCode,
    row.pendingInterruptionCode,
    row.returnedOnce,
    row.terminalReasonCode,
    row.terminalOutcome,
  ];
}

const REST_ORIGIN_HASH_SCALAR_NAMES = [
  "present",
  "ownerIndex",
  "ownerGeneration",
  "actorId",
  "fixtureId",
  "restKindCode",
  "stepCode",
  "targetCellIndex",
  "interactionSpotId",
  "scheduleCode",
  "environmentVersion",
  "needOwnerVersion",
  "lastNeedExpectedValue",
  "lastNeedDelta",
  "lastNeedExpectedStoreVersion",
  "lastNeedExpectedLaneVersion",
  "lastNeedNextStoreVersion",
  "lastNeedChanged",
  "reservationVersion",
  "jobGeneration",
  "jobSlotVersion",
  "jobCoreStepTickCount",
  "jobCoreAdoptionReservationVersion",
  "jobCoreAdoptionDriverVersion",
  "jobCoreAdoptionSlotVersion",
  "createdTick",
  "recoveryTargetValue",
  "recoveryPerTickQ16",
  "recoveryProgressQ16",
  "stepEnteredTick",
  "lastEffectTick",
  "effectPhase",
  "interruptionPolicyCode",
  "requiredWorkQ16",
  "readyToComplete",
  "terminalReasonCode",
  "terminalOutcome",
  "terminalFailureCode",
  "terminalInterruptionCode",
] as const;

function restOriginHashScalarValues(row: RestJobDriverSnapshotOrigin): readonly number[] {
  return [
    row.present,
    row.ownerIndex,
    row.ownerGeneration,
    row.actorId,
    row.fixtureId,
    row.restKindCode,
    row.stepCode,
    row.targetCellIndex,
    row.interactionSpotId,
    row.scheduleCode,
    row.environmentVersion,
    row.needOwnerVersion,
    row.lastNeedExpectedValue,
    row.lastNeedDelta,
    row.lastNeedExpectedStoreVersion,
    row.lastNeedExpectedLaneVersion,
    row.lastNeedNextStoreVersion,
    row.lastNeedChanged,
    row.reservationVersion,
    row.jobGeneration,
    row.jobSlotVersion,
    row.jobCoreStepTickCount,
    row.jobCoreAdoptionReservationVersion,
    row.jobCoreAdoptionDriverVersion,
    row.jobCoreAdoptionSlotVersion,
    row.createdTick,
    row.recoveryTargetValue,
    row.recoveryPerTickQ16,
    row.recoveryProgressQ16,
    row.stepEnteredTick,
    row.lastEffectTick,
    row.effectPhase,
    row.interruptionPolicyCode,
    row.requiredWorkQ16,
    row.readyToComplete,
    row.terminalReasonCode,
    row.terminalOutcome,
    row.terminalFailureCode,
    row.terminalInterruptionCode,
  ];
}

function resetRestAdoptedJobOutput(
  output: RestAdoptedJobIntoOutput,
  driverVersion: number,
  activeCount: number,
  pathingCount: number,
  recoveringCount: number,
  completedCount: number,
  canceledCount: number,
  failedCount: number,
  interruptedCount: number,
  reservationAttemptCount: number,
  reservationFailureCount: number,
  cleanupReleaseCount: number,
  cumulativeCompletedCount: number,
  cumulativeCanceledCount: number,
  cumulativeFailedCount: number,
  cumulativeInterruptedCount: number,
): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.jobId = M3_REST_FIXTURE_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = M3_REST_FIXTURE_NONE;
  output.ownerGeneration = 0;
  output.jobSlotVersion = 0;
  output.jobCoreStepTickCount = 0;
  output.jobCoreAdoptionReservationVersion = 0;
  output.jobCoreAdoptionDriverVersion = 0;
  output.jobCoreAdoptionSlotVersion = 0;
  output.driverVersion = driverVersion;
  output.actorId = 0;
  output.fixtureId = M3_REST_FIXTURE_NONE;
  output.restKind = undefined;
  output.step = "inactive";
  output.targetCellIndex = 0;
  output.interactionSpotId = 0;
  output.scheduleWindow = undefined;
  output.environmentVersion = 0;
  output.needOwnerVersion = 0;
  output.lastNeedExpectedValue = 0;
  output.lastNeedDelta = 0;
  output.lastNeedExpectedStoreVersion = 0;
  output.lastNeedExpectedLaneVersion = 0;
  output.lastNeedNextStoreVersion = 0;
  output.lastNeedChanged = 0;
  output.reservationVersion = 0;
  for (let index = 0; index < 8; index += 1) {
    output.claimIds[index] = M3_REST_FIXTURE_NONE;
    output.claimEpochs[index] = 0;
    output.claimCreatedTicks[index] = 0;
    output.claimLeaseExpiryTicks[index] = 0;
  }
  output.createdTick = 0;
  output.recoveryTargetValue = 0;
  output.recoveryPerTickQ16 = 0;
  output.recoveryProgressQ16 = 0;
  output.stepEnteredTick = 0;
  output.lastEffectTick = 0;
  output.effectPhase = 0;
  output.cleanupPending = 0;
  output.pendingOutcome = 0;
  output.pendingReason = undefined;
  output.pendingFailure = "none";
  output.pendingInterruption = undefined;
  output.returnedOnce = 0;
  output.interruptionPolicy = "never";
  output.readyToComplete = false;
  output.terminalReason = "rest.none";
  output.terminalOutcome = undefined;
  output.activeCount = activeCount;
  output.pathingCount = pathingCount;
  output.recoveringCount = recoveringCount;
  output.completedCount = completedCount;
  output.canceledCount = canceledCount;
  output.failedCount = failedCount;
  output.interruptedCount = interruptedCount;
  output.reservationAttemptCount = reservationAttemptCount;
  output.reservationFailureCount = reservationFailureCount;
  output.cleanupReleaseCount = cleanupReleaseCount;
  output.cumulativeCompletedCount = cumulativeCompletedCount;
  output.cumulativeCanceledCount = cumulativeCanceledCount;
  output.cumulativeFailedCount = cumulativeFailedCount;
  output.cumulativeInterruptedCount = cumulativeInterruptedCount;
}

function resetRestClaimAdoptionOutput(output: RestClaimAdoptionOutput): void {
  resetDriverAdoptionOutput(output);
  output.ownerIndex = M3_REST_FIXTURE_NONE;
  output.ownerGeneration = 0;
  output.jobCoreReservedCount = 0;
  output.jobCoreActiveCount = 0;
  output.jobCoreRunningCount = 0;
  output.jobCoreCurrentTombstoneCount = 0;
  output.jobCoreCumulativeTerminalCount = 0;
  output.driverPathingCount = 0;
  output.driverRecoveringCount = 0;
  output.driverCompletedCount = 0;
  output.driverCanceledCount = 0;
  output.driverFailedCount = 0;
  output.driverInterruptedCount = 0;
  output.reservationAttemptCount = 0;
  output.reservationFailureCount = 0;
  output.cleanupReleaseCount = 0;
  output.cumulativeCompletedCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
  output.cumulativeInterruptedCount = 0;
}

function decodeRestPendingFailure(code: number): JobFailureReason {
  if (code === 1) return "path";
  if (code === 2) return "reservation";
  if (code === 3) return "permission";
  if (code === 4) return "material";
  if (code === 5) return "target_state";
  if (code === 6) return "cancelled";
  if (code === 7) return "risk";
  if (code === 8) return "time";
  return "none";
}

function decodeRestPendingInterruption(code: number): JobInterruptionKind | undefined {
  if (code === 1) return "safe_point";
  if (code === 2) return "immediate";
  if (code === 3) return "emergency";
  return undefined;
}
