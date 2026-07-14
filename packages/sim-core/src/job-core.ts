import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import { type CanonicalWorldField } from "./world-hash";
import type { ReservationLedger } from "./reservation-ledger";

export const JOB_CORE_SNAPSHOT_VERSION = 2;
export const JOB_NONE = 0xffff_ffff;

const JOB_STATUS_INACTIVE = 0;
const JOB_STATUS_READY = 1;
const JOB_STATUS_RUNNING = 2;
const JOB_STATUS_COMPLETED = 3;
const JOB_STATUS_FAILED = 4;
const JOB_STATUS_CANCELED = 5;

const JOB_STEP_UNASSIGNED = 0;
const JOB_STEP_RESERVE = 1;
const JOB_STEP_PATH_TO_SOURCE = 2;
const JOB_STEP_INTERACT = 3;
const JOB_STEP_COMPLETE = 4;

const JOB_POLICY_NEVER = 0;
const JOB_POLICY_AT_SAFE_POINT = 1;
const JOB_POLICY_IMMEDIATE = 2;
const JOB_POLICY_EMERGENCY_ONLY = 3;

const JOB_INTERRUPT_SAFE_POINT = 0;
const JOB_INTERRUPT_IMMEDIATE = 1;
const JOB_INTERRUPT_EMERGENCY = 2;

const JOB_FAILURE_NONE = 0;
const JOB_FAILURE_PERMISSION = 1;
const JOB_FAILURE_MATERIAL = 2;
const JOB_FAILURE_RESERVATION = 3;
const JOB_FAILURE_PATH = 4;
const JOB_FAILURE_RISK = 5;
const JOB_FAILURE_TIME = 6;
const JOB_FAILURE_TARGET_STATE = 7;
const JOB_FAILURE_CANCELLED = 8;

const JOB_CORE_TERMINAL_COMMIT = Symbol("job-core-terminal-commit");
const JOB_CORE_CARRIED_COMMIT = Symbol("job-core-carried-commit");
const JOB_CORE_PROGRESS_COMMIT = Symbol("job-core-progress-commit");
const JOB_CORE_ROLLBACK_RELEASE_COMMIT = Symbol("job-core-rollback-release-commit");
const JOB_CORE_ORIGIN_TERMINAL_MATCH = Symbol("job-core-origin-terminal-match");

export type JobStatus = "ready" | "running" | "completed" | "failed" | "canceled";

export type JobDriverStep = "unassigned" | "reserve" | "path_to_source" | "interact" | "complete";

export type JobInterruptionPolicy = "never" | "at_safe_point" | "immediate" | "emergency_only";

export type JobInterruptionKind = "safe_point" | "immediate" | "emergency";

export type JobFailureReason =
  | "none"
  | "permission"
  | "material"
  | "reservation"
  | "path"
  | "risk"
  | "time"
  | "target_state"
  | "cancelled";

export type JobCoreReason =
  | "job_id_out_of_range"
  | "job_already_active"
  | "job_not_active"
  | "job_owner_invalid"
  | "job_kind_invalid"
  | "job_target_invalid"
  | "job_tick_invalid"
  | "job_progress_invalid"
  | "job_step_invalid"
  | "job_status_invalid"
  | "job_interruption_denied"
  | "job_version_mismatch"
  | "job_core_version_exhausted"
  | "job_slot_version_exhausted"
  | "job_generation_exhausted"
  | "job_autonomy_capacity_exhausted"
  | "job_owner_already_bound"
  | "job_token_mismatch"
  | "job_snapshot_version_unsupported"
  | "job_snapshot_shape_invalid"
  | "job_snapshot_record_invalid";

export type JobTokenState = "free" | "reserved" | "running" | "tombstone";

export interface JobTokenIntoOutput {
  ok: boolean;
  found: boolean;
  reason: JobCoreReason | undefined;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  ownerOccupied: boolean;
  ownerLegacyLiveCount: number;
  state: JobTokenState;
  originState: JobTokenState;
  slotGenerationCounter: number;
  originShadowPresent: boolean;
  originJobGeneration: number;
  originOwnerIndex: number;
  originOwnerGeneration: number;
  originJobKind: number;
  originTargetId: number;
  originStatus: JobStatus | undefined;
  originFailureReason: JobFailureReason;
  originCreatedTick: number;
  originTerminalTick: number;
  originEffectPhase: number;
  terminalEffectPhase: number;
  slotVersion: number;
  version: number;
  reservedCount: number;
  activeCount: number;
  runningCount: number;
  currentTombstoneCount: number;
  cumulativeTerminalCount: number;
}

export interface AutonomyTerminalPrepareInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly tick: number;
  readonly status: "completed" | "failed" | "canceled";
  readonly failureReason: JobFailureReason;
  readonly effectPhase: number;
  readonly interruptionKind?: JobInterruptionKind;
}

export interface PreparedAutonomyTerminal {
  ok: boolean;
  reason: JobCoreReason | undefined;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  expectedSlotVersion: number;
  expectedJobCoreVersion: number;
  tick: number;
  statusCode: number;
  failureReasonCode: number;
  effectPhase: number;
  nextSlotVersion: number;
  nextJobCoreVersion: number;
}

export interface AutonomyJobMutationIntoOutput {
  ok: boolean;
  reason: JobCoreReason | undefined;
  jobId: number;
  jobGeneration: number;
  slotVersion: number;
  version: number;
  progressQ16: number;
  readyToComplete: boolean;
}

export interface PreparedAutonomyCarriedStep {
  ok: boolean;
  reason: JobCoreReason | undefined;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  defId: number;
  amount: number;
  stepCode: number;
  tick: number;
  nextSlotVersion: number;
  nextJobCoreVersion: number;
}

export interface PreparedAutonomyProgress {
  ok: boolean;
  reason: JobCoreReason | undefined;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  tick: number;
  workDeltaQ16: number;
  nextStepTickCount: number;
  nextProgressQ16: number;
  readyToComplete: boolean;
  nextSlotVersion: number;
  nextJobCoreVersion: number;
}

export type JobCoreMutationResult =
  | {
      readonly ok: true;
      readonly jobId: number;
      readonly version: number;
    }
  | {
      readonly ok: false;
      readonly reason: JobCoreReason;
    };

export type JobTerminalResult =
  | {
      readonly ok: true;
      readonly jobId: number;
      readonly version: number;
      readonly releasedReservations: number;
      readonly clearedCarriedAmount: number;
    }
  | {
      readonly ok: false;
      readonly reason: JobCoreReason;
    };

export type JobTickResult =
  | {
      readonly ok: true;
      readonly jobId: number;
      readonly version: number;
      readonly progressQ16: number;
      readonly readyToComplete: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: JobCoreReason;
    };

export type JobInterruptResult =
  | {
      readonly ok: true;
      readonly interrupted: true;
      readonly jobId: number;
      readonly version: number;
      readonly releasedReservations: number;
      readonly clearedCarriedAmount: number;
    }
  | {
      readonly ok: true;
      readonly interrupted: false;
      readonly jobId: number;
      readonly version: number;
      readonly reason: Extract<JobCoreReason, "job_interruption_denied">;
    }
  | {
      readonly ok: false;
      readonly reason: JobCoreReason;
    };

export type JobSnapshotResult =
  | {
      readonly ok: true;
      readonly version: number;
      readonly activeCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        JobCoreReason,
        | "job_snapshot_version_unsupported"
        | "job_snapshot_shape_invalid"
        | "job_snapshot_record_invalid"
      >;
    };

export interface JobCoreStoreOptions {
  readonly capacity: number;
  readonly ownerCapacity?: number;
  readonly autonomyJobStart?: number;
}

export interface JobCreateInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly jobKind: number;
  readonly targetId: number;
  readonly initialStep: JobDriverStep;
  readonly interruptionPolicy: JobInterruptionPolicy;
  readonly requiredWorkQ16: number;
  readonly createdTick: number;
}

export interface AutonomyRunningJobInput extends JobCreateInput {
  readonly jobGeneration: number;
  readonly expectedSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly stepEnteredTick: number;
  readonly adoptionReservationVersion: number;
  readonly adoptionDriverVersion: number;
}

export interface AutonomyRollbackInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedCreatedTick: number;
  readonly expectedAdoptionTick: number;
  readonly expectedReservationVersion: number;
  readonly expectedAdoptedDriverVersion: number;
}

export interface JobIntoOutput {
  ok: boolean;
  found: boolean;
  reason: JobCoreReason | undefined;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  jobKind: number;
  targetId: number;
  status: JobStatus | undefined;
  step: JobDriverStep;
  interruptionPolicy: JobInterruptionPolicy;
  failureReason: JobFailureReason;
  createdTick: number;
  stepEnteredTick: number;
  stepTickCount: number;
  progressQ16: number;
  requiredWorkQ16: number;
  carriedDefId: number;
  carriedAmount: number;
  slotVersion: number;
  version: number;
  activeCount: number;
  runningCount: number;
  reservedCount: number;
  currentTombstoneCount: number;
  cumulativeTerminalCount: number;
  backlogCount: number;
}

export interface AutonomyCommittedJobIntoOutput extends JobIntoOutput {
  state: JobTokenState;
  terminalEffectPhase: number;
  lastMutationTick: number;
}

export interface JobRecordView {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly jobKind: number;
  readonly targetId: number;
  readonly status: JobStatus;
  readonly step: JobDriverStep;
  readonly interruptionPolicy: JobInterruptionPolicy;
  readonly failureReason: JobFailureReason;
  readonly createdTick: number;
  readonly stepEnteredTick: number;
  readonly stepTickCount: number;
  readonly progressQ16: number;
  readonly requiredWorkQ16: number;
  readonly carriedDefId: number;
  readonly carriedAmount: number;
}

export type JobRecordSnapshot = JobRecordView;

export interface JobCoreSlotSnapshot {
  readonly jobId: number;
  readonly active: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly jobKind: number;
  readonly targetId: number;
  readonly statusCode: number;
  readonly stepCode: number;
  readonly interruptionPolicyCode: number;
  readonly failureReasonCode: number;
  readonly createdTick: number;
  readonly stepEnteredTick: number;
  readonly stepTickCount: number;
  readonly progressQ16: number;
  readonly requiredWorkQ16: number;
  readonly carriedDefId: number;
  readonly carriedAmount: number;
  readonly jobGeneration: number;
  readonly slotGenerationCounter: number;
  readonly slotVersion: number;
  readonly autonomyState: number;
  readonly autonomyOriginState: number;
  readonly originShadowPresent: number;
  readonly originJobGeneration: number;
  readonly originOwnerIndex: number;
  readonly originOwnerGeneration: number;
  readonly originJobKind: number;
  readonly originTargetId: number;
  readonly originStatusCode: number;
  readonly originFailureReasonCode: number;
  readonly originCreatedTick: number;
  readonly originTerminalTick: number;
  readonly originEffectPhase: number;
  readonly terminalEffectPhase: number;
  readonly adoptionReservationVersion: number;
  readonly adoptionDriverVersion: number;
  readonly adoptionSlotVersion: number;
  readonly lastMutationTick: number;
  readonly originStepCode: number;
  readonly originInterruptionPolicyCode: number;
  readonly originStepTickCount: number;
  readonly originProgressQ16: number;
  readonly originRequiredWorkQ16: number;
  readonly originCarriedDefId: number;
  readonly originCarriedAmount: number;
  readonly originAdoptionReservationVersion: number;
  readonly originAdoptionDriverVersion: number;
  readonly originAdoptionSlotVersion: number;
  readonly originLastMutationTick: number;
}

export interface JobCoreOwnerSnapshot {
  readonly ownerIndex: number;
  readonly occupied: number;
  readonly ownerGeneration: number;
  readonly autonomyJobId: number;
  readonly legacyLiveCount: number;
}

export interface JobCoreSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly ownerCapacity: number;
  readonly autonomyJobStart: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly autonomyRunningCount: number;
  readonly currentTombstoneCount: number;
  readonly cumulativeTerminalCount: number;
  readonly freeAutonomyJobIds: readonly number[];
  readonly slots: readonly JobCoreSlotSnapshot[];
  readonly owners: readonly JobCoreOwnerSnapshot[];
  readonly records: readonly JobRecordSnapshot[];
}

export interface JobCoreSnapshot extends JobCoreSnapshotInput {
  readonly snapshotVersion: typeof JOB_CORE_SNAPSHOT_VERSION;
}

export interface JobCoreMetrics {
  readonly activeCount: number;
  readonly runningCount: number;
  readonly terminalCount: number;
  readonly backlogCount: number;
}

type JobSnapshotShapeResult =
  | {
      readonly ok: true;
      readonly snapshot: JobCoreSnapshotInput;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        JobCoreReason,
        | "job_snapshot_version_unsupported"
        | "job_snapshot_shape_invalid"
        | "job_snapshot_record_invalid"
      >;
    };

export class JobCoreStore {
  readonly capacity: number;
  readonly ownerCapacity: number;
  readonly autonomyJobStart: number;

  private readonly active: Uint8Array;
  private readonly ownerIndex: Uint32Array;
  private readonly ownerGeneration: Uint32Array;
  private readonly jobKind: Uint32Array;
  private readonly targetId: Uint32Array;
  private readonly statusCode: Uint8Array;
  private readonly stepCode: Uint8Array;
  private readonly interruptionPolicyCode: Uint8Array;
  private readonly failureReasonCode: Uint8Array;
  private readonly createdTick: Float64Array;
  private readonly stepEnteredTick: Float64Array;
  private readonly stepTickCount: Uint32Array;
  private readonly progressQ16: Uint32Array;
  private readonly requiredWorkQ16: Uint32Array;
  private readonly carriedDefId: Uint32Array;
  private readonly carriedAmount: Uint32Array;
  private readonly jobGenerations: Uint32Array;
  private readonly slotGenerationCounters: Uint32Array;
  private readonly slotVersions: Uint32Array;
  private readonly autonomyStates: Uint8Array;
  private readonly autonomyOriginStates: Uint8Array;
  private readonly originShadowPresent: Uint8Array;
  private readonly originOwnerIndexes: Uint32Array;
  private readonly originJobGenerations: Uint32Array;
  private readonly originOwnerGenerations: Uint32Array;
  private readonly originJobKinds: Uint32Array;
  private readonly originTargetIds: Uint32Array;
  private readonly originStatusCodes: Uint8Array;
  private readonly originFailureReasonCodes: Uint8Array;
  private readonly originCreatedTicks: Float64Array;
  private readonly originTerminalTicks: Float64Array;
  private readonly originEffectPhases: Uint8Array;
  private readonly terminalEffectPhases: Uint8Array;
  private readonly adoptionReservationVersions: Uint32Array;
  private readonly adoptionDriverVersions: Uint32Array;
  private readonly adoptionSlotVersions: Uint32Array;
  private readonly lastMutationTicks: Float64Array;
  private readonly originStepCodes: Uint8Array;
  private readonly originInterruptionPolicyCodes: Uint8Array;
  private readonly originStepTickCounts: Uint32Array;
  private readonly originProgressQ16: Uint32Array;
  private readonly originRequiredWorkQ16: Uint32Array;
  private readonly originCarriedDefIds: Uint32Array;
  private readonly originCarriedAmounts: Uint32Array;
  private readonly originAdoptionReservationVersions: Uint32Array;
  private readonly originAdoptionDriverVersions: Uint32Array;
  private readonly originAdoptionSlotVersions: Uint32Array;
  private readonly originLastMutationTicks: Float64Array;
  private readonly ownerAutonomyOccupied: Uint8Array;
  private readonly ownerAutonomyJobIds: Uint32Array;
  private readonly ownerAutonomyGenerations: Uint32Array;
  private readonly ownerLegacyLiveCounts: Uint32Array;
  private readonly freeAutonomyJobIds: Uint32Array;
  private freeAutonomyCount: number;
  private reservedCount = 0;
  private autonomyRunningCount = 0;
  private currentTombstoneCount = 0;
  private activeCount = 0;
  private terminalCount = 0;
  private storeVersion = 0;

  constructor(options: JobCoreStoreOptions) {
    assertValidCapacity(options.capacity, "job core capacity");
    this.capacity = options.capacity;
    this.ownerCapacity = options.ownerCapacity ?? options.capacity;
    assertValidCapacity(this.ownerCapacity, "job core owner capacity");
    this.autonomyJobStart = options.autonomyJobStart ?? options.capacity;
    if (
      !Number.isSafeInteger(this.autonomyJobStart) ||
      this.autonomyJobStart < 0 ||
      this.autonomyJobStart > options.capacity
    ) {
      throw new RangeError("job core autonomy start is out of range");
    }
    this.active = new Uint8Array(options.capacity);
    this.ownerIndex = new Uint32Array(options.capacity);
    this.ownerGeneration = new Uint32Array(options.capacity);
    this.jobKind = new Uint32Array(options.capacity);
    this.targetId = new Uint32Array(options.capacity);
    this.statusCode = new Uint8Array(options.capacity);
    this.stepCode = new Uint8Array(options.capacity);
    this.interruptionPolicyCode = new Uint8Array(options.capacity);
    this.failureReasonCode = new Uint8Array(options.capacity);
    this.createdTick = new Float64Array(options.capacity);
    this.stepEnteredTick = new Float64Array(options.capacity);
    this.stepTickCount = new Uint32Array(options.capacity);
    this.progressQ16 = new Uint32Array(options.capacity);
    this.requiredWorkQ16 = new Uint32Array(options.capacity);
    this.carriedDefId = new Uint32Array(options.capacity);
    this.carriedAmount = new Uint32Array(options.capacity);
    this.jobGenerations = new Uint32Array(options.capacity);
    this.slotGenerationCounters = new Uint32Array(options.capacity);
    this.slotVersions = new Uint32Array(options.capacity);
    this.autonomyStates = new Uint8Array(options.capacity);
    this.autonomyOriginStates = new Uint8Array(options.capacity);
    this.originShadowPresent = new Uint8Array(options.capacity);
    this.originOwnerIndexes = new Uint32Array(options.capacity);
    this.originJobGenerations = new Uint32Array(options.capacity);
    this.originOwnerGenerations = new Uint32Array(options.capacity);
    this.originJobKinds = new Uint32Array(options.capacity);
    this.originTargetIds = new Uint32Array(options.capacity);
    this.originStatusCodes = new Uint8Array(options.capacity);
    this.originFailureReasonCodes = new Uint8Array(options.capacity);
    this.originCreatedTicks = new Float64Array(options.capacity);
    this.originTerminalTicks = new Float64Array(options.capacity);
    this.originEffectPhases = new Uint8Array(options.capacity);
    this.terminalEffectPhases = new Uint8Array(options.capacity);
    this.adoptionReservationVersions = new Uint32Array(options.capacity);
    this.adoptionDriverVersions = new Uint32Array(options.capacity);
    this.adoptionSlotVersions = new Uint32Array(options.capacity);
    this.lastMutationTicks = new Float64Array(options.capacity);
    this.originStepCodes = new Uint8Array(options.capacity);
    this.originInterruptionPolicyCodes = new Uint8Array(options.capacity);
    this.originStepTickCounts = new Uint32Array(options.capacity);
    this.originProgressQ16 = new Uint32Array(options.capacity);
    this.originRequiredWorkQ16 = new Uint32Array(options.capacity);
    this.originCarriedDefIds = new Uint32Array(options.capacity);
    this.originCarriedDefIds.fill(JOB_NONE);
    this.originCarriedAmounts = new Uint32Array(options.capacity);
    this.originAdoptionReservationVersions = new Uint32Array(options.capacity);
    this.originAdoptionDriverVersions = new Uint32Array(options.capacity);
    this.originAdoptionSlotVersions = new Uint32Array(options.capacity);
    this.originLastMutationTicks = new Float64Array(options.capacity);
    this.ownerAutonomyOccupied = new Uint8Array(this.ownerCapacity);
    this.ownerAutonomyJobIds = new Uint32Array(this.ownerCapacity);
    this.ownerAutonomyGenerations = new Uint32Array(this.ownerCapacity);
    this.ownerLegacyLiveCounts = new Uint32Array(this.ownerCapacity);
    this.ownerAutonomyJobIds.fill(JOB_NONE);
    this.freeAutonomyJobIds = new Uint32Array(options.capacity - this.autonomyJobStart);
    for (let index = 0; index < this.freeAutonomyJobIds.length; index += 1) {
      this.freeAutonomyJobIds[index] = this.autonomyJobStart + index;
    }
    this.freeAutonomyCount = this.freeAutonomyJobIds.length;
    this.carriedDefId.fill(JOB_NONE);
  }

  get activeJobCount(): number {
    return this.activeCount;
  }

  get reservedAutonomyJobCount(): number {
    return this.reservedCount;
  }

  get runningAutonomyJobCount(): number {
    return this.autonomyRunningCount;
  }

  get currentTombstoneJobCount(): number {
    return this.currentTombstoneCount;
  }

  get cumulativeTerminalJobCount(): number {
    return this.terminalCount;
  }

  get version(): number {
    return this.storeVersion;
  }

  reserveAutonomyJobTokenInto(
    expectedJobCoreVersion: number,
    owner: EntityId,
    output: JobTokenIntoOutput,
  ): void {
    this.resetTokenOutput(output);
    if (!this.isValidOwner(owner)) {
      output.reason = "job_owner_invalid";
      return;
    }
    if (expectedJobCoreVersion !== this.storeVersion) {
      output.reason = "job_version_mismatch";
      return;
    }
    if ((this.ownerAutonomyOccupied[owner.index] ?? 0) === 1) {
      output.reason = "job_owner_already_bound";
      return;
    }
    if (this.freeAutonomyCount === 0) {
      output.reason = "job_autonomy_capacity_exhausted";
      return;
    }
    const jobId = this.peekFreeAutonomyJobId();
    if ((this.slotVersions[jobId] ?? 0) > 0xffff_fffb) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    if (this.storeVersion > 0xffff_fffb) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    const generation = (this.slotGenerationCounters[jobId] ?? 0) + 1;
    if (generation > 0xffff_ffff || generation === 0) {
      output.reason = "job_generation_exhausted";
      return;
    }
    this.popFreeAutonomyJobId();
    const origin = this.autonomyStates[jobId] ?? 0;
    this.originJobGenerations[jobId] = this.jobGenerations[jobId] ?? 0;
    if (origin === 3) this.captureTombstoneOrigin(jobId);
    this.slotGenerationCounters[jobId] = generation;
    this.jobGenerations[jobId] = generation;
    this.slotVersions[jobId] = (this.slotVersions[jobId] ?? 0) + 1;
    this.autonomyOriginStates[jobId] = origin;
    this.autonomyStates[jobId] = 1;
    this.ownerIndex[jobId] = owner.index;
    this.ownerGeneration[jobId] = owner.generation;
    this.ownerAutonomyOccupied[owner.index] = 1;
    this.ownerAutonomyJobIds[owner.index] = jobId;
    this.ownerAutonomyGenerations[owner.index] = owner.generation;
    this.reservedCount += 1;
    this.storeVersion += 1;
    this.writeTokenOutput(jobId, output);
  }

  readAutonomyJobTokenForOwnerInto(owner: EntityId, output: JobTokenIntoOutput): void {
    this.resetTokenOutput(output);
    if (!this.isValidOwner(owner)) {
      output.reason = "job_owner_invalid";
      return;
    }
    if ((this.ownerAutonomyOccupied[owner.index] ?? 0) !== 1) {
      output.reason = "job_not_active";
      return;
    }
    if ((this.ownerAutonomyGenerations[owner.index] ?? 0) !== owner.generation) {
      output.reason = "job_token_mismatch";
      return;
    }
    const jobId = this.ownerAutonomyJobIds[owner.index] ?? JOB_NONE;
    if (jobId === JOB_NONE) {
      output.ok = true;
      output.ownerIndex = owner.index;
      output.ownerGeneration = owner.generation;
      output.ownerOccupied = true;
      output.ownerLegacyLiveCount = this.ownerLegacyLiveCounts[owner.index] ?? 0;
      return;
    }
    this.writeTokenOutput(jobId, output);
  }

  readAutonomyJobTokenInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    output: JobTokenIntoOutput,
  ): void {
    this.resetTokenOutput(output);
    if (!this.matchesAutonomyToken(jobId, jobGeneration, owner, expectedSlotVersion)) {
      output.reason = "job_token_mismatch";
      return;
    }
    this.writeTokenOutput(jobId, output);
  }

  releaseReservedAutonomyJobTokenInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    output: JobTokenIntoOutput,
  ): void {
    this.releaseReservedAutonomyJobTokenScalarsInto(
      jobId,
      jobGeneration,
      owner.index,
      owner.generation,
      expectedSlotVersion,
      output,
    );
  }

  releaseReservedAutonomyJobTokenScalarsInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    output: JobTokenIntoOutput,
  ): void {
    this.resetTokenOutput(output);
    if (
      !this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      )
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if ((this.autonomyStates[jobId] ?? 0) !== 1) {
      output.reason = "job_status_invalid";
      return;
    }
    if (this.storeVersion > 0xffff_fffe) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    if (expectedSlotVersion > 0xffff_fffe) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    const origin = this.autonomyOriginStates[jobId] ?? 0;
    const originGeneration = this.originJobGenerations[jobId] ?? 0;
    if (origin === 3) this.restoreTombstoneOrigin(jobId);
    this.jobGenerations[jobId] = originGeneration;
    this.originJobGenerations[jobId] = 0;
    this.autonomyStates[jobId] = origin;
    if (origin === 0) this.clearFreeSlotPayload(jobId);
    this.slotVersions[jobId] = expectedSlotVersion + 1;
    this.clearOwnerAutonomy(ownerIndex);
    this.reservedCount -= 1;
    this.pushFreeAutonomyJobId(jobId);
    this.storeVersion += 1;
    this.writeTokenOutput(jobId, output);
  }

  createRunningJobInto(input: AutonomyRunningJobInput, output: JobTokenIntoOutput): void {
    this.resetTokenOutput(output);
    if (input.expectedJobCoreVersion !== this.storeVersion) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (this.storeVersion > 0xffff_fffc) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    if (input.expectedSlotVersion > 0xffff_fffc) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    if (
      !this.matchesAutonomyToken(
        input.jobId,
        input.jobGeneration,
        input.owner,
        input.expectedSlotVersion,
      ) ||
      (this.autonomyStates[input.jobId] ?? 0) !== 1
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    const validationReason = this.validateCreateInputReason(input, undefined, true);
    if (
      validationReason !== undefined ||
      !isSafeTickValue(input.stepEnteredTick) ||
      input.stepEnteredTick < input.createdTick ||
      !isSafeUint32(input.adoptionReservationVersion) ||
      !isSafeUint32(input.adoptionDriverVersion) ||
      input.adoptionDriverVersion > 0xffff_fffd
    ) {
      output.reason = validationReason ?? "job_tick_invalid";
      return;
    }
    const jobId = input.jobId;
    this.active[jobId] = 1;
    this.jobKind[jobId] = input.jobKind;
    this.targetId[jobId] = input.targetId;
    this.statusCode[jobId] = JOB_STATUS_RUNNING;
    this.stepCode[jobId] = encodeStep(input.initialStep);
    this.interruptionPolicyCode[jobId] = encodePolicy(input.interruptionPolicy);
    this.failureReasonCode[jobId] = JOB_FAILURE_NONE;
    this.createdTick[jobId] = input.createdTick;
    this.stepEnteredTick[jobId] = input.stepEnteredTick;
    this.stepTickCount[jobId] = 0;
    this.progressQ16[jobId] = 0;
    this.requiredWorkQ16[jobId] = input.requiredWorkQ16;
    this.carriedDefId[jobId] = JOB_NONE;
    this.carriedAmount[jobId] = 0;
    this.terminalEffectPhases[jobId] = 0;
    this.adoptionReservationVersions[jobId] = input.adoptionReservationVersion;
    this.adoptionDriverVersions[jobId] = input.adoptionDriverVersion;
    this.adoptionSlotVersions[jobId] = input.expectedSlotVersion + 1;
    this.lastMutationTicks[jobId] = input.stepEnteredTick;
    this.autonomyStates[jobId] = 2;
    this.slotVersions[jobId] = input.expectedSlotVersion + 1;
    this.reservedCount -= 1;
    this.autonomyRunningCount += 1;
    this.activeCount += 1;
    this.storeVersion += 1;
    this.writeTokenOutput(jobId, output);
  }

  createRunningJobScalarsInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    jobKind: number,
    targetId: number,
    initialStep: JobDriverStep,
    interruptionPolicy: JobInterruptionPolicy,
    requiredWorkQ16: number,
    createdTick: number,
    stepEnteredTick: number,
    adoptionReservationVersion: number,
    adoptionDriverVersion: number,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    output: JobTokenIntoOutput,
  ): void {
    this.resetTokenOutput(output);
    const stepCode = encodeStep(initialStep);
    const policyCode = encodePolicy(interruptionPolicy);
    if (expectedJobCoreVersion !== this.storeVersion) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (this.storeVersion > 0xffff_fffc) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    if (!isSafeUint32(expectedSlotVersion) || expectedSlotVersion > 0xffff_fffc) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    if (
      !isIndexInRange(jobId, this.capacity) ||
      !isSafeUint32(jobGeneration) ||
      jobGeneration === 0 ||
      !isIndexInRange(ownerIndex, this.ownerCapacity) ||
      !isSafeUint32(ownerGeneration) ||
      ownerGeneration === 0 ||
      !this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      ) ||
      (this.autonomyStates[jobId] ?? 0) !== 1
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (
      !isSafeUint32(jobKind) ||
      !isSafeUint32(targetId) ||
      targetId >= JOB_NONE ||
      stepCode === JOB_STEP_UNASSIGNED ||
      policyCode === JOB_POLICY_NEVER ||
      !isSafeUint32(requiredWorkQ16) ||
      !isSafeTickValue(createdTick) ||
      !isSafeTickValue(stepEnteredTick) ||
      stepEnteredTick < createdTick ||
      !isSafeUint32(adoptionReservationVersion) ||
      !isSafeUint32(adoptionDriverVersion) ||
      adoptionDriverVersion > 0xffff_fffd
    ) {
      output.reason = "job_tick_invalid";
      return;
    }
    this.active[jobId] = 1;
    this.jobKind[jobId] = jobKind;
    this.targetId[jobId] = targetId;
    this.statusCode[jobId] = JOB_STATUS_RUNNING;
    this.stepCode[jobId] = stepCode;
    this.interruptionPolicyCode[jobId] = policyCode;
    this.failureReasonCode[jobId] = JOB_FAILURE_NONE;
    this.createdTick[jobId] = createdTick;
    this.stepEnteredTick[jobId] = stepEnteredTick;
    this.stepTickCount[jobId] = 0;
    this.progressQ16[jobId] = 0;
    this.requiredWorkQ16[jobId] = requiredWorkQ16;
    this.carriedDefId[jobId] = JOB_NONE;
    this.carriedAmount[jobId] = 0;
    this.terminalEffectPhases[jobId] = 0;
    this.adoptionReservationVersions[jobId] = adoptionReservationVersion;
    this.adoptionDriverVersions[jobId] = adoptionDriverVersion;
    this.adoptionSlotVersions[jobId] = expectedSlotVersion + 1;
    this.lastMutationTicks[jobId] = stepEnteredTick;
    this.autonomyStates[jobId] = 2;
    this.slotVersions[jobId] = expectedSlotVersion + 1;
    this.reservedCount -= 1;
    this.autonomyRunningCount += 1;
    this.activeCount += 1;
    this.storeVersion += 1;
    this.writeTokenOutput(jobId, output);
  }

  rollbackRunningAutonomyJobInto(input: AutonomyRollbackInput, output: JobTokenIntoOutput): void {
    this.rollbackRunningAutonomyJobScalarsInto(
      input.jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedSlotVersion,
      input.expectedJobCoreVersion,
      input.expectedCreatedTick,
      input.expectedAdoptionTick,
      input.expectedReservationVersion,
      input.expectedAdoptedDriverVersion,
      output,
    );
  }

  rollbackRunningAutonomyJobScalarsInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    expectedCreatedTick: number,
    expectedAdoptionTick: number,
    expectedReservationVersion: number,
    expectedAdoptedDriverVersion: number,
    output: JobTokenIntoOutput,
  ): void {
    this.resetTokenOutput(output);
    if (
      !isSafeTickValue(expectedCreatedTick) ||
      !isSafeTickValue(expectedAdoptionTick) ||
      expectedAdoptionTick < expectedCreatedTick ||
      !isSafeUint32(expectedReservationVersion) ||
      !isSafeUint32(expectedAdoptedDriverVersion) ||
      expectedAdoptedDriverVersion === 0 ||
      expectedAdoptedDriverVersion > 0xffff_fffe
    ) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (expectedJobCoreVersion !== this.storeVersion) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (
      !this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      )
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (this.storeVersion > 0xffff_fffe) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    if (expectedSlotVersion > 0xffff_fffe) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    if (
      (this.autonomyStates[jobId] ?? 0) !== 2 ||
      (this.statusCode[jobId] ?? 0) !== JOB_STATUS_RUNNING ||
      (this.stepCode[jobId] ?? 0) !== JOB_STEP_PATH_TO_SOURCE ||
      (this.active[jobId] ?? 0) !== 1 ||
      (this.stepTickCount[jobId] ?? 0) !== 0 ||
      (this.progressQ16[jobId] ?? 0) !== 0 ||
      (this.carriedAmount[jobId] ?? 0) !== 0 ||
      (this.carriedDefId[jobId] ?? JOB_NONE) !== JOB_NONE ||
      (this.createdTick[jobId] ?? 0) !== expectedCreatedTick ||
      (this.stepEnteredTick[jobId] ?? 0) !== expectedAdoptionTick ||
      (this.adoptionReservationVersions[jobId] ?? 0) !== expectedReservationVersion ||
      (this.adoptionDriverVersions[jobId] ?? 0) + 1 !== expectedAdoptedDriverVersion
    ) {
      output.reason = "job_status_invalid";
      return;
    }
    if (
      (this.adoptionSlotVersions[jobId] ?? 0) !== expectedSlotVersion ||
      (this.lastMutationTicks[jobId] ?? 0) !== expectedAdoptionTick
    ) {
      output.reason = "job_status_invalid";
      return;
    }
    this.active[jobId] = 0;
    this.statusCode[jobId] = JOB_STATUS_INACTIVE;
    this.stepCode[jobId] = JOB_STEP_UNASSIGNED;
    this.createdTick[jobId] = 0;
    this.stepEnteredTick[jobId] = 0;
    this.stepTickCount[jobId] = 0;
    this.progressQ16[jobId] = 0;
    this.requiredWorkQ16[jobId] = 0;
    this.adoptionReservationVersions[jobId] = 0;
    this.adoptionDriverVersions[jobId] = 0;
    this.adoptionSlotVersions[jobId] = 0;
    this.lastMutationTicks[jobId] = 0;
    this.autonomyStates[jobId] = 1;
    this.slotVersions[jobId] = expectedSlotVersion + 1;
    this.autonomyRunningCount -= 1;
    this.reservedCount += 1;
    this.activeCount -= 1;
    this.storeVersion += 1;
    this.writeTokenOutput(jobId, output);
  }

  [JOB_CORE_ROLLBACK_RELEASE_COMMIT](
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    expectedCreatedTick: number,
    expectedAdoptionTick: number,
    expectedReservationVersion: number,
    expectedAdoptedDriverVersion: number,
    output: JobTokenIntoOutput,
  ): void {
    this.resetTokenOutput(output);
    if (
      !isSafeTickValue(expectedCreatedTick) ||
      !isSafeTickValue(expectedAdoptionTick) ||
      expectedAdoptionTick < expectedCreatedTick ||
      !isSafeUint32(expectedReservationVersion) ||
      !isSafeUint32(expectedAdoptedDriverVersion) ||
      expectedAdoptedDriverVersion === 0 ||
      expectedAdoptedDriverVersion > 0xffff_fffe ||
      expectedJobCoreVersion !== this.storeVersion
    ) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (expectedJobCoreVersion > 0xffff_fffd || expectedSlotVersion > 0xffff_fffd) {
      output.reason =
        expectedJobCoreVersion > 0xffff_fffd
          ? "job_core_version_exhausted"
          : "job_slot_version_exhausted";
      return;
    }
    if (
      !this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      )
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (
      (this.autonomyStates[jobId] ?? 0) !== 2 ||
      (this.statusCode[jobId] ?? 0) !== JOB_STATUS_RUNNING ||
      (this.stepCode[jobId] ?? 0) !== JOB_STEP_PATH_TO_SOURCE ||
      (this.active[jobId] ?? 0) !== 1 ||
      (this.stepTickCount[jobId] ?? 0) !== 0 ||
      (this.progressQ16[jobId] ?? 0) !== 0 ||
      (this.carriedAmount[jobId] ?? 0) !== 0 ||
      (this.carriedDefId[jobId] ?? JOB_NONE) !== JOB_NONE ||
      (this.createdTick[jobId] ?? 0) !== expectedCreatedTick ||
      (this.stepEnteredTick[jobId] ?? 0) !== expectedAdoptionTick ||
      (this.lastMutationTicks[jobId] ?? 0) !== expectedAdoptionTick ||
      (this.adoptionReservationVersions[jobId] ?? 0) !== expectedReservationVersion ||
      (this.adoptionDriverVersions[jobId] ?? 0) + 1 !== expectedAdoptedDriverVersion ||
      (this.adoptionSlotVersions[jobId] ?? 0) !== expectedSlotVersion ||
      this.autonomyRunningCount === 0 ||
      this.activeCount === 0 ||
      this.freeAutonomyCount >= this.freeAutonomyJobIds.length
    ) {
      output.reason = "job_status_invalid";
      return;
    }
    const origin = this.autonomyOriginStates[jobId] ?? 0;
    if (origin !== 0 && origin !== 3) {
      output.reason = "job_status_invalid";
      return;
    }
    const originGeneration = this.originJobGenerations[jobId] ?? 0;
    if (origin === 3) this.restoreTombstoneOrigin(jobId);
    this.jobGenerations[jobId] = originGeneration;
    this.autonomyStates[jobId] = origin;
    if (origin === 0) {
      this.clearFreeSlotPayload(jobId);
      this.clearOriginShadow(jobId);
    }
    this.slotVersions[jobId] = expectedSlotVersion + 2;
    this.clearOwnerAutonomy(ownerIndex);
    this.autonomyRunningCount -= 1;
    this.activeCount -= 1;
    this.pushFreeAutonomyJobId(jobId);
    this.storeVersion += 2;
    this.writeTokenOutput(jobId, output);
  }

  [JOB_CORE_ORIGIN_TERMINAL_MATCH](
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    originJobGeneration: number,
    originOwnerIndex: number,
    originOwnerGeneration: number,
    originJobKind: number,
    originTargetId: number,
    originStatus: "completed" | "canceled" | "failed",
    originFailureReason: JobFailureReason,
    originCreatedTick: number,
    originTerminalTick: number,
    originEffectPhase: number,
    originInterruptionPolicy: JobInterruptionPolicy,
    originProgressQ16: number,
    originRequiredWorkQ16: number,
    originStepTickCount: number,
    originAdoptionReservationVersion: number,
    originAdoptionDriverVersion: number,
    originAdoptionSlotVersion: number,
  ): boolean {
    return (
      this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      ) &&
      (this.originShadowPresent[jobId] ?? 0) === 1 &&
      (this.originJobGenerations[jobId] ?? 0) === originJobGeneration &&
      (this.originOwnerIndexes[jobId] ?? 0) === originOwnerIndex &&
      (this.originOwnerGenerations[jobId] ?? 0) === originOwnerGeneration &&
      (this.originJobKinds[jobId] ?? 0) === originJobKind &&
      (this.originTargetIds[jobId] ?? 0) === originTargetId &&
      (this.originStatusCodes[jobId] ?? JOB_STATUS_INACTIVE) === encodeStatus(originStatus) &&
      (this.originFailureReasonCodes[jobId] ?? JOB_FAILURE_NONE) ===
        encodeFailureReason(originFailureReason) &&
      (this.originCreatedTicks[jobId] ?? 0) === originCreatedTick &&
      (this.originTerminalTicks[jobId] ?? 0) === originTerminalTick &&
      (this.originEffectPhases[jobId] ?? 0) === originEffectPhase &&
      (this.originStepCodes[jobId] ?? 0) === JOB_STEP_COMPLETE &&
      (this.originInterruptionPolicyCodes[jobId] ?? 0) === encodePolicy(originInterruptionPolicy) &&
      (this.originProgressQ16[jobId] ?? 0) === originProgressQ16 &&
      (this.originRequiredWorkQ16[jobId] ?? 0) === originRequiredWorkQ16 &&
      (this.originStepTickCounts[jobId] ?? 0) === originStepTickCount &&
      (this.originAdoptionReservationVersions[jobId] ?? 0) === originAdoptionReservationVersion &&
      (this.originAdoptionDriverVersions[jobId] ?? 0) === originAdoptionDriverVersion &&
      (this.originAdoptionSlotVersions[jobId] ?? 0) === originAdoptionSlotVersion &&
      (this.originCarriedDefIds[jobId] ?? JOB_NONE) === JOB_NONE &&
      (this.originCarriedAmounts[jobId] ?? 0) === 0 &&
      (this.originLastMutationTicks[jobId] ?? 0) === originTerminalTick
    );
  }

  prepareAutonomyTerminalInto(
    input: AutonomyTerminalPrepareInput,
    output: PreparedAutonomyTerminal,
  ): void {
    resetPreparedAutonomyTerminal(output, this.storeVersion);
    if (input.expectedJobCoreVersion !== this.storeVersion) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (this.storeVersion > 0xffff_fffe) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    if (input.expectedSlotVersion > 0xffff_fffe) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    if (
      !this.matchesAutonomyToken(
        input.jobId,
        input.jobGeneration,
        input.owner,
        input.expectedSlotVersion,
      ) ||
      (this.autonomyStates[input.jobId] ?? 0) !== 2 ||
      (this.active[input.jobId] ?? 0) !== 1 ||
      (this.statusCode[input.jobId] ?? JOB_STATUS_INACTIVE) !== JOB_STATUS_RUNNING
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (
      !isSafeTickValue(input.tick) ||
      input.tick < (this.createdTick[input.jobId] ?? 0) ||
      input.tick < (this.stepEnteredTick[input.jobId] ?? 0) ||
      input.tick < (this.lastMutationTicks[input.jobId] ?? 0)
    ) {
      output.reason = "job_tick_invalid";
      return;
    }
    if (!isValidAutonomyTerminal(input.status, input.failureReason)) {
      output.reason = "job_status_invalid";
      return;
    }
    if (
      !Number.isSafeInteger(input.effectPhase) ||
      input.effectPhase <= 0 ||
      input.effectPhase > 0xff
    ) {
      output.reason = "job_status_invalid";
      return;
    }
    if (
      input.interruptionKind !== undefined &&
      !allowsInterruption(
        this.interruptionPolicyCode[input.jobId] ?? JOB_POLICY_NEVER,
        input.interruptionKind,
      )
    ) {
      output.reason = "job_interruption_denied";
      return;
    }
    if (this.freeAutonomyCount >= this.freeAutonomyJobIds.length) {
      output.reason = "job_autonomy_capacity_exhausted";
      return;
    }
    output.ok = true;
    output.jobId = input.jobId;
    output.jobGeneration = input.jobGeneration;
    output.ownerIndex = input.owner.index;
    output.ownerGeneration = input.owner.generation;
    output.expectedSlotVersion = input.expectedSlotVersion;
    output.expectedJobCoreVersion = input.expectedJobCoreVersion;
    output.tick = input.tick;
    output.statusCode = encodeStatus(input.status);
    output.failureReasonCode = encodeFailureReason(input.failureReason);
    output.effectPhase = input.effectPhase;
    output.nextSlotVersion = input.expectedSlotVersion + 1;
    output.nextJobCoreVersion = input.expectedJobCoreVersion + 1;
  }

  prepareAutonomyTerminalScalarsInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    tick: number,
    status: "completed" | "canceled" | "failed",
    failureReason: JobFailureReason,
    effectPhase: number,
    interruptionKind: JobInterruptionKind | undefined,
    output: PreparedAutonomyTerminal,
  ): void {
    resetPreparedAutonomyTerminal(output, this.storeVersion);
    if (expectedJobCoreVersion !== this.storeVersion) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (this.storeVersion > 0xffff_fffe) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    if (expectedSlotVersion > 0xffff_fffe) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    if (
      !this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      ) ||
      (this.autonomyStates[jobId] ?? 0) !== 2 ||
      (this.active[jobId] ?? 0) !== 1 ||
      (this.statusCode[jobId] ?? JOB_STATUS_INACTIVE) !== JOB_STATUS_RUNNING
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      output.reason = "job_tick_invalid";
      return;
    }
    if (
      !isValidAutonomyTerminal(status, failureReason) ||
      !Number.isSafeInteger(effectPhase) ||
      effectPhase <= 0 ||
      effectPhase > 0xff
    ) {
      output.reason = "job_status_invalid";
      return;
    }
    if (
      interruptionKind !== undefined &&
      !allowsInterruption(this.interruptionPolicyCode[jobId] ?? JOB_POLICY_NEVER, interruptionKind)
    ) {
      output.reason = "job_interruption_denied";
      return;
    }
    if (this.freeAutonomyCount >= this.freeAutonomyJobIds.length) {
      output.reason = "job_autonomy_capacity_exhausted";
      return;
    }
    output.ok = true;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = ownerIndex;
    output.ownerGeneration = ownerGeneration;
    output.expectedSlotVersion = expectedSlotVersion;
    output.expectedJobCoreVersion = expectedJobCoreVersion;
    output.tick = tick;
    output.statusCode = encodeStatus(status);
    output.failureReasonCode = encodeFailureReason(failureReason);
    output.effectPhase = effectPhase;
    output.nextSlotVersion = expectedSlotVersion + 1;
    output.nextJobCoreVersion = expectedJobCoreVersion + 1;
  }

  [JOB_CORE_TERMINAL_COMMIT](prepared: PreparedAutonomyTerminal): void {
    const jobId = prepared.jobId;
    this.statusCode[jobId] = prepared.statusCode;
    this.stepCode[jobId] = JOB_STEP_COMPLETE;
    this.failureReasonCode[jobId] = prepared.failureReasonCode;
    this.stepEnteredTick[jobId] = prepared.tick;
    this.lastMutationTicks[jobId] = prepared.tick;
    this.terminalEffectPhases[jobId] = prepared.effectPhase;
    this.carriedDefId[jobId] = JOB_NONE;
    this.carriedAmount[jobId] = 0;
    this.active[jobId] = 0;
    this.activeCount -= 1;
    this.autonomyRunningCount -= 1;
    this.autonomyStates[jobId] = 3;
    this.clearOriginShadow(jobId);
    this.slotVersions[jobId] = prepared.nextSlotVersion;
    this.clearOwnerAutonomy(prepared.ownerIndex);
    if ((this.autonomyOriginStates[jobId] ?? 0) !== 3) this.currentTombstoneCount += 1;
    this.autonomyOriginStates[jobId] = 0;
    this.terminalCount += 1;
    this.pushFreeAutonomyJobId(jobId);
    this.storeVersion = prepared.nextJobCoreVersion;
  }

  prepareAutonomyCarriedStepInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    defId: number,
    amount: number,
    step: JobDriverStep,
    tick: number,
    output: PreparedAutonomyCarriedStep,
  ): void {
    resetPreparedAutonomyCarriedStep(output);
    const reason = this.validateAutonomyMutation(
      jobId,
      jobGeneration,
      owner,
      expectedSlotVersion,
      expectedJobCoreVersion,
    );
    if (reason !== undefined) {
      output.reason = reason;
      return;
    }
    const stepCode = encodeStep(step);
    if (!isSafeUint32(defId) || !isSafeUint32(amount)) {
      output.reason = "job_progress_invalid";
      return;
    }
    if (
      stepCode === JOB_STEP_UNASSIGNED ||
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      output.reason = stepCode === JOB_STEP_UNASSIGNED ? "job_step_invalid" : "job_tick_invalid";
      return;
    }
    output.ok = true;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = owner.index;
    output.ownerGeneration = owner.generation;
    output.defId = defId;
    output.amount = amount;
    output.stepCode = stepCode;
    output.tick = tick;
    output.nextSlotVersion = expectedSlotVersion + 1;
    output.nextJobCoreVersion = expectedJobCoreVersion + 1;
  }

  [JOB_CORE_CARRIED_COMMIT](prepared: PreparedAutonomyCarriedStep): void {
    const jobId = prepared.jobId;
    this.carriedDefId[jobId] = prepared.defId;
    this.carriedAmount[jobId] = prepared.amount;
    this.statusCode[jobId] = JOB_STATUS_RUNNING;
    this.stepCode[jobId] = prepared.stepCode;
    this.stepEnteredTick[jobId] = prepared.tick;
    this.stepTickCount[jobId] = 0;
    this.lastMutationTicks[jobId] = prepared.tick;
    this.slotVersions[jobId] = prepared.nextSlotVersion;
    this.storeVersion = prepared.nextJobCoreVersion;
  }

  prepareAutonomyProgressScalarsInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    tick: number,
    workDeltaQ16: number,
    output: PreparedAutonomyProgress,
  ): void {
    resetPreparedAutonomyProgress(output, this.storeVersion);
    if (expectedJobCoreVersion !== this.storeVersion) {
      output.reason = "job_version_mismatch";
      return;
    }
    if (this.storeVersion > 0xffff_fffe) {
      output.reason = "job_core_version_exhausted";
      return;
    }
    if (!isSafeUint32(expectedSlotVersion) || expectedSlotVersion > 0xffff_fffe) {
      output.reason = "job_slot_version_exhausted";
      return;
    }
    if (
      !this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      ) ||
      (this.autonomyStates[jobId] ?? 0) !== 2 ||
      (this.active[jobId] ?? 0) !== 1 ||
      (this.statusCode[jobId] ?? JOB_STATUS_INACTIVE) !== JOB_STATUS_RUNNING
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      output.reason = "job_tick_invalid";
      return;
    }
    if (!isSafeUint32(workDeltaQ16) || (this.stepTickCount[jobId] ?? 0) === 0xffff_ffff) {
      output.reason = "job_progress_invalid";
      return;
    }
    const currentProgress = this.progressQ16[jobId] ?? 0;
    const requiredWork = this.requiredWorkQ16[jobId] ?? 0;
    const nextProgress = Math.min(0xffff_ffff, currentProgress + workDeltaQ16);
    output.ok = true;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = ownerIndex;
    output.ownerGeneration = ownerGeneration;
    output.tick = tick;
    output.workDeltaQ16 = workDeltaQ16;
    output.nextStepTickCount = (this.stepTickCount[jobId] ?? 0) + 1;
    output.nextProgressQ16 = nextProgress;
    output.readyToComplete = nextProgress >= requiredWork;
    output.nextSlotVersion = expectedSlotVersion + 1;
    output.nextJobCoreVersion = expectedJobCoreVersion + 1;
  }

  [JOB_CORE_PROGRESS_COMMIT](prepared: PreparedAutonomyProgress): void {
    const jobId = prepared.jobId;
    this.stepTickCount[jobId] = prepared.nextStepTickCount;
    this.progressQ16[jobId] = prepared.nextProgressQ16;
    this.lastMutationTicks[jobId] = prepared.tick;
    this.slotVersions[jobId] = prepared.nextSlotVersion;
    this.storeVersion = prepared.nextJobCoreVersion;
  }

  enterAutonomyStepInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    step: JobDriverStep,
    tick: number,
    output: AutonomyJobMutationIntoOutput,
  ): void {
    resetAutonomyMutationOutput(output, this.storeVersion);
    const reason = this.validateAutonomyMutation(
      jobId,
      jobGeneration,
      owner,
      expectedSlotVersion,
      expectedJobCoreVersion,
    );
    if (reason !== undefined) {
      output.reason = reason;
      return;
    }
    const stepCode = encodeStep(step);
    if (
      stepCode === JOB_STEP_UNASSIGNED ||
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      output.reason = stepCode === JOB_STEP_UNASSIGNED ? "job_step_invalid" : "job_tick_invalid";
      return;
    }
    this.statusCode[jobId] = JOB_STATUS_RUNNING;
    this.stepCode[jobId] = stepCode;
    this.stepEnteredTick[jobId] = tick;
    this.stepTickCount[jobId] = 0;
    this.lastMutationTicks[jobId] = tick;
    this.finishAutonomyMutationInto(
      jobId,
      jobGeneration,
      expectedSlotVersion,
      expectedJobCoreVersion,
      output,
    );
  }

  setAutonomyCarriedStateInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    defId: number,
    amount: number,
    tick: number,
    output: AutonomyJobMutationIntoOutput,
  ): void {
    resetAutonomyMutationOutput(output, this.storeVersion);
    const reason = this.validateAutonomyMutation(
      jobId,
      jobGeneration,
      owner,
      expectedSlotVersion,
      expectedJobCoreVersion,
    );
    if (reason !== undefined) {
      output.reason = reason;
      return;
    }
    if (!isSafeUint32(defId) || !isSafeUint32(amount)) {
      output.reason = "job_progress_invalid";
      return;
    }
    if (!isSafeTickValue(tick) || tick < (this.lastMutationTicks[jobId] ?? 0)) {
      output.reason = "job_tick_invalid";
      return;
    }
    this.carriedDefId[jobId] = defId;
    this.carriedAmount[jobId] = amount;
    this.lastMutationTicks[jobId] = tick;
    this.finishAutonomyMutationInto(
      jobId,
      jobGeneration,
      expectedSlotVersion,
      expectedJobCoreVersion,
      output,
    );
  }

  tickAutonomyJobInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    tick: number,
    workDeltaQ16: number,
    output: AutonomyJobMutationIntoOutput,
  ): void {
    resetAutonomyMutationOutput(output, this.storeVersion);
    const reason = this.validateAutonomyMutation(
      jobId,
      jobGeneration,
      owner,
      expectedSlotVersion,
      expectedJobCoreVersion,
    );
    if (reason !== undefined) {
      output.reason = reason;
      return;
    }
    if (
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      output.reason = "job_tick_invalid";
      return;
    }
    if (!isSafeUint32(workDeltaQ16) || (this.stepTickCount[jobId] ?? 0) === 0xffff_ffff) {
      output.reason = "job_progress_invalid";
      return;
    }
    this.stepTickCount[jobId] = (this.stepTickCount[jobId] ?? 0) + 1;
    this.progressQ16[jobId] = clampUint32((this.progressQ16[jobId] ?? 0) + workDeltaQ16);
    this.lastMutationTicks[jobId] = tick;
    this.finishAutonomyMutationInto(
      jobId,
      jobGeneration,
      expectedSlotVersion,
      expectedJobCoreVersion,
      output,
    );
  }

  readJobInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    output: JobIntoOutput,
  ): void {
    resetJobInto(
      output,
      this.storeVersion,
      this.activeCount,
      this.autonomyRunningCount,
      this.reservedCount,
      this.currentTombstoneCount,
      this.terminalCount,
    );
    if (
      !this.matchesAutonomyToken(jobId, jobGeneration, owner, expectedSlotVersion) ||
      this.active[jobId] !== 1
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    output.ok = true;
    output.found = true;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = owner.index;
    output.ownerGeneration = owner.generation;
    output.jobKind = this.jobKind[jobId] ?? 0;
    output.targetId = this.targetId[jobId] ?? 0;
    output.status = decodeStatus(this.statusCode[jobId] ?? JOB_STATUS_INACTIVE);
    output.step = decodeStep(this.stepCode[jobId] ?? JOB_STEP_UNASSIGNED);
    output.interruptionPolicy = decodePolicy(
      this.interruptionPolicyCode[jobId] ?? JOB_POLICY_NEVER,
    );
    output.failureReason = decodeFailureReason(this.failureReasonCode[jobId] ?? JOB_FAILURE_NONE);
    output.createdTick = this.createdTick[jobId] ?? 0;
    output.stepEnteredTick = this.stepEnteredTick[jobId] ?? 0;
    output.stepTickCount = this.stepTickCount[jobId] ?? 0;
    output.progressQ16 = this.progressQ16[jobId] ?? 0;
    output.requiredWorkQ16 = this.requiredWorkQ16[jobId] ?? 0;
    output.carriedDefId = this.carriedDefId[jobId] ?? JOB_NONE;
    output.carriedAmount = this.carriedAmount[jobId] ?? 0;
    output.slotVersion = expectedSlotVersion;
  }

  readCommittedAutonomyJobInto(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
    output: AutonomyCommittedJobIntoOutput,
  ): void {
    resetCommittedJobInto(
      output,
      this.storeVersion,
      this.activeCount,
      this.autonomyRunningCount,
      this.reservedCount,
      this.currentTombstoneCount,
      this.terminalCount,
    );
    if (
      !isIndexInRange(jobId, this.capacity) ||
      jobId < this.autonomyJobStart ||
      !isIndexInRange(ownerIndex, this.ownerCapacity) ||
      jobGeneration === 0 ||
      !isSafeUint32(jobGeneration) ||
      ownerGeneration === 0 ||
      !isSafeUint32(ownerGeneration) ||
      !isSafeUint32(expectedSlotVersion) ||
      (this.jobGenerations[jobId] ?? 0) !== jobGeneration ||
      (this.ownerIndex[jobId] ?? 0) !== ownerIndex ||
      (this.ownerGeneration[jobId] ?? 0) !== ownerGeneration ||
      (this.slotVersions[jobId] ?? 0) !== expectedSlotVersion
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    const state = decodeTokenState(this.autonomyStates[jobId] ?? 0);
    if (state !== "running" && state !== "tombstone") {
      output.reason = "job_status_invalid";
      return;
    }
    if (
      state === "running" &&
      !this.matchesAutonomyTokenScalars(
        jobId,
        jobGeneration,
        ownerIndex,
        ownerGeneration,
        expectedSlotVersion,
      )
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    if (
      state === "tombstone" &&
      ((this.ownerAutonomyOccupied[ownerIndex] ?? 0) !== 0 ||
        (this.ownerAutonomyJobIds[ownerIndex] ?? JOB_NONE) !== JOB_NONE ||
        (this.ownerAutonomyGenerations[ownerIndex] ?? 0) !== 0)
    ) {
      output.reason = "job_token_mismatch";
      return;
    }
    output.ok = true;
    output.found = true;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = ownerIndex;
    output.ownerGeneration = ownerGeneration;
    output.jobKind = this.jobKind[jobId] ?? 0;
    output.targetId = this.targetId[jobId] ?? 0;
    output.status = decodeStatus(this.statusCode[jobId] ?? JOB_STATUS_INACTIVE);
    output.step = decodeStep(this.stepCode[jobId] ?? JOB_STEP_UNASSIGNED);
    output.interruptionPolicy = decodePolicy(
      this.interruptionPolicyCode[jobId] ?? JOB_POLICY_NEVER,
    );
    output.failureReason = decodeFailureReason(this.failureReasonCode[jobId] ?? JOB_FAILURE_NONE);
    output.createdTick = this.createdTick[jobId] ?? 0;
    output.stepEnteredTick = this.stepEnteredTick[jobId] ?? 0;
    output.stepTickCount = this.stepTickCount[jobId] ?? 0;
    output.progressQ16 = this.progressQ16[jobId] ?? 0;
    output.requiredWorkQ16 = this.requiredWorkQ16[jobId] ?? 0;
    output.carriedDefId = this.carriedDefId[jobId] ?? JOB_NONE;
    output.carriedAmount = this.carriedAmount[jobId] ?? 0;
    output.slotVersion = expectedSlotVersion;
    output.state = state;
    output.terminalEffectPhase = this.terminalEffectPhases[jobId] ?? 0;
    output.lastMutationTick = this.lastMutationTicks[jobId] ?? 0;
  }

  createJob(input: JobCreateInput, registry?: EntityRegistry): JobCoreMutationResult {
    const validationReason = this.validateCreateInputReason(input, registry);
    if (validationReason !== undefined) return { ok: false, reason: validationReason };
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "job_core_version_exhausted" };
    }

    if (this.active[input.jobId] === 1) {
      return { ok: false, reason: "job_already_active" };
    }

    const ownerIndex = input.owner.index;
    const occupied = this.ownerAutonomyOccupied[ownerIndex] ?? 0;
    const legacyLiveCount = this.ownerLegacyLiveCounts[ownerIndex] ?? 0;
    if (
      occupied === 1 &&
      ((this.ownerAutonomyGenerations[ownerIndex] ?? 0) !== input.owner.generation ||
        (this.ownerAutonomyJobIds[ownerIndex] ?? JOB_NONE) !== JOB_NONE)
    ) {
      return { ok: false, reason: "job_owner_already_bound" };
    }
    if (legacyLiveCount === 0xffff_ffff) {
      return { ok: false, reason: "job_core_version_exhausted" };
    }
    this.active[input.jobId] = 1;
    this.ownerIndex[input.jobId] = input.owner.index;
    this.ownerGeneration[input.jobId] = input.owner.generation;
    this.jobKind[input.jobId] = input.jobKind;
    this.targetId[input.jobId] = input.targetId;
    this.statusCode[input.jobId] = JOB_STATUS_READY;
    this.stepCode[input.jobId] = encodeStep(input.initialStep);
    this.interruptionPolicyCode[input.jobId] = encodePolicy(input.interruptionPolicy);
    this.failureReasonCode[input.jobId] = JOB_FAILURE_NONE;
    this.createdTick[input.jobId] = input.createdTick;
    this.stepEnteredTick[input.jobId] = input.createdTick;
    this.stepTickCount[input.jobId] = 0;
    this.progressQ16[input.jobId] = 0;
    this.requiredWorkQ16[input.jobId] = input.requiredWorkQ16;
    this.carriedDefId[input.jobId] = JOB_NONE;
    this.carriedAmount[input.jobId] = 0;
    this.lastMutationTicks[input.jobId] = input.createdTick;
    this.activeCount += 1;
    this.ownerAutonomyOccupied[ownerIndex] = 1;
    this.ownerAutonomyJobIds[ownerIndex] = JOB_NONE;
    this.ownerAutonomyGenerations[ownerIndex] = input.owner.generation;
    this.ownerLegacyLiveCounts[ownerIndex] = legacyLiveCount + 1;
    return this.finishMutation(input.jobId);
  }

  enterStep(jobId: number, step: JobDriverStep, tick: number): JobCoreMutationResult {
    const validation = this.validateActiveJob(jobId);

    if (!validation.ok) {
      return validation;
    }

    if (
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      return { ok: false, reason: "job_tick_invalid" };
    }

    const stepCode = encodeStep(step);

    if (stepCode === JOB_STEP_UNASSIGNED) {
      return { ok: false, reason: "job_step_invalid" };
    }

    this.statusCode[jobId] = JOB_STATUS_RUNNING;
    this.stepCode[jobId] = stepCode;
    this.stepEnteredTick[jobId] = tick;
    this.stepTickCount[jobId] = 0;
    this.lastMutationTicks[jobId] = tick;
    return this.finishMutation(jobId);
  }

  tickJob(jobId: number, tick: number, workDeltaQ16: number): JobTickResult {
    const validation = this.validateActiveJob(jobId);

    if (!validation.ok) {
      return validation;
    }

    if ((this.statusCode[jobId] ?? JOB_STATUS_INACTIVE) !== JOB_STATUS_RUNNING) {
      return { ok: false, reason: "job_status_invalid" };
    }

    if (
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      return { ok: false, reason: "job_tick_invalid" };
    }

    if (!isSafeUint32(workDeltaQ16) || (this.stepTickCount[jobId] ?? 0) === 0xffff_ffff) {
      return { ok: false, reason: "job_progress_invalid" };
    }

    this.stepTickCount[jobId] = (this.stepTickCount[jobId] ?? 0) + 1;
    this.progressQ16[jobId] = clampUint32((this.progressQ16[jobId] ?? 0) + workDeltaQ16);
    this.lastMutationTicks[jobId] = tick;
    return {
      ok: true,
      jobId,
      version: this.bumpVersion(),
      progressQ16: this.progressQ16[jobId] ?? 0,
      readyToComplete: (this.progressQ16[jobId] ?? 0) >= (this.requiredWorkQ16[jobId] ?? 0),
    };
  }

  setCarriedState(jobId: number, defId: number, amount: number): JobCoreMutationResult {
    const validation = this.validateActiveJob(jobId);

    if (!validation.ok) {
      return validation;
    }

    if (!isSafeUint32(defId) || !isSafeUint32(amount)) {
      return { ok: false, reason: "job_progress_invalid" };
    }

    this.carriedDefId[jobId] = defId;
    this.carriedAmount[jobId] = amount;
    return this.finishMutation(jobId);
  }

  completeJob(
    jobId: number,
    tick: number,
    reservationLedger?: ReservationLedger,
  ): JobTerminalResult {
    return this.finishTerminalJob(jobId, tick, JOB_STATUS_COMPLETED, "none", reservationLedger);
  }

  failJob(
    jobId: number,
    tick: number,
    reason: JobFailureReason,
    reservationLedger?: ReservationLedger,
  ): JobTerminalResult {
    if (reason === "none") {
      return { ok: false, reason: "job_status_invalid" };
    }

    return this.finishTerminalJob(jobId, tick, JOB_STATUS_FAILED, reason, reservationLedger);
  }

  cancelJob(jobId: number, tick: number, reservationLedger?: ReservationLedger): JobTerminalResult {
    return this.finishTerminalJob(jobId, tick, JOB_STATUS_CANCELED, "cancelled", reservationLedger);
  }

  requestInterruption(
    jobId: number,
    kind: JobInterruptionKind,
    tick: number,
    reservationLedger?: ReservationLedger,
  ): JobInterruptResult {
    const validation = this.validateActiveJob(jobId);

    if (!validation.ok) {
      return validation;
    }

    if (
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      return { ok: false, reason: "job_tick_invalid" };
    }

    if (!allowsInterruption(this.interruptionPolicyCode[jobId] ?? JOB_POLICY_NEVER, kind)) {
      return {
        ok: true,
        interrupted: false,
        jobId,
        version: this.storeVersion,
        reason: "job_interruption_denied",
      };
    }

    const canceled = this.cancelJob(jobId, tick, reservationLedger);

    if (!canceled.ok) {
      return canceled;
    }

    return {
      ok: true,
      interrupted: true,
      jobId,
      version: canceled.version,
      releasedReservations: canceled.releasedReservations,
      clearedCarriedAmount: canceled.clearedCarriedAmount,
    };
  }

  readJob(jobId: number): JobRecordView | undefined {
    if (!this.isActiveJobId(jobId)) {
      return undefined;
    }

    return this.createRecordView(jobId);
  }

  createSnapshot(): JobCoreSnapshot {
    const records: JobRecordSnapshot[] = [];
    const slots: JobCoreSlotSnapshot[] = [];
    const owners: JobCoreOwnerSnapshot[] = [];
    const freeAutonomyJobIds: number[] = [];

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      if (this.hasVisibleRecord(jobId)) {
        records.push(this.createRecordView(jobId));
      }
      slots.push(this.createSlotSnapshot(jobId));
    }
    for (let ownerIndex = 0; ownerIndex < this.ownerCapacity; ownerIndex += 1) {
      owners.push({
        ownerIndex,
        occupied: this.ownerAutonomyOccupied[ownerIndex] ?? 0,
        ownerGeneration: this.ownerAutonomyGenerations[ownerIndex] ?? 0,
        autonomyJobId: this.ownerAutonomyJobIds[ownerIndex] ?? JOB_NONE,
        legacyLiveCount: this.ownerLegacyLiveCounts[ownerIndex] ?? 0,
      });
    }
    for (let index = 0; index < this.freeAutonomyCount; index += 1) {
      freeAutonomyJobIds.push(this.freeAutonomyJobIds[index] ?? JOB_NONE);
    }

    return {
      snapshotVersion: JOB_CORE_SNAPSHOT_VERSION,
      capacity: this.capacity,
      ownerCapacity: this.ownerCapacity,
      autonomyJobStart: this.autonomyJobStart,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount: this.reservedCount,
      autonomyRunningCount: this.autonomyRunningCount,
      currentTombstoneCount: this.currentTombstoneCount,
      cumulativeTerminalCount: this.terminalCount,
      freeAutonomyJobIds,
      slots,
      owners,
      records,
    };
  }

  restoreFromSnapshot(snapshot: unknown, registry?: EntityRegistry): JobSnapshotResult {
    const shape = this.validateSnapshotShape(snapshot);
    if (!shape.ok) {
      return shape;
    }

    const scratch = createJobCoreStore({
      capacity: this.capacity,
      ownerCapacity: this.ownerCapacity,
      autonomyJobStart: this.autonomyJobStart,
    });
    const validated = scratch.restoreExactSnapshot(shape.snapshot, registry);

    if (!validated.ok) {
      return validated;
    }

    this.clearAll();
    const restored = this.restoreExactSnapshot(shape.snapshot, registry);

    if (!restored.ok) {
      throw new Error(`validated job snapshot failed to restore: ${restored.reason}`);
    }

    return restored;
  }

  createMetrics(): JobCoreMetrics {
    let runningCount = 0;

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      if ((this.active[jobId] ?? 0) === 1 && (this.statusCode[jobId] ?? 0) === JOB_STATUS_RUNNING) {
        runningCount += 1;
      }
    }

    return {
      activeCount: this.activeCount,
      runningCount,
      terminalCount: this.terminalCount,
      backlogCount: 0,
    };
  }

  private finishTerminalJob(
    jobId: number,
    tick: number,
    statusCode: number,
    reason: JobFailureReason,
    reservationLedger: ReservationLedger | undefined,
  ): JobTerminalResult {
    const validation = this.validateActiveJob(jobId);

    if (!validation.ok) {
      return validation;
    }

    if (
      !isSafeTickValue(tick) ||
      tick < (this.createdTick[jobId] ?? 0) ||
      tick < (this.stepEnteredTick[jobId] ?? 0) ||
      tick < (this.lastMutationTicks[jobId] ?? 0)
    ) {
      return { ok: false, reason: "job_tick_invalid" };
    }

    const autonomous = (this.jobGenerations[jobId] ?? 0) > 0;
    this.statusCode[jobId] = statusCode;
    this.stepCode[jobId] = JOB_STEP_COMPLETE;
    this.failureReasonCode[jobId] = encodeFailureReason(reason);
    this.stepEnteredTick[jobId] = tick;
    this.lastMutationTicks[jobId] = tick;
    const cleanup = this.cleanupJob(jobId, reservationLedger);
    this.terminalCount += 1;
    if (autonomous) {
      this.active[jobId] = 0;
      this.activeCount -= 1;
      this.autonomyRunningCount -= 1;
      this.autonomyStates[jobId] = 3;
      this.terminalEffectPhases[jobId] = 1;
      this.clearOriginShadow(jobId);
      this.slotVersions[jobId] = (this.slotVersions[jobId] ?? 0) + 1;
      this.clearOwnerAutonomy(this.ownerIndex[jobId] ?? 0);
      if ((this.autonomyOriginStates[jobId] ?? 0) !== 3) this.currentTombstoneCount += 1;
      this.pushFreeAutonomyJobId(jobId);
    } else {
      this.active[jobId] = 0;
      this.activeCount -= 1;
      const owner = this.ownerIndex[jobId] ?? 0;
      if (owner < this.ownerCapacity && (this.ownerLegacyLiveCounts[owner] ?? 0) > 0) {
        this.ownerLegacyLiveCounts[owner] = (this.ownerLegacyLiveCounts[owner] ?? 1) - 1;
        if ((this.ownerLegacyLiveCounts[owner] ?? 0) === 0) this.clearOwnerAutonomy(owner);
      }
    }
    return {
      ok: true,
      jobId,
      version: this.bumpVersion(),
      releasedReservations: cleanup.releasedReservations,
      clearedCarriedAmount: cleanup.clearedCarriedAmount,
    };
  }

  private cleanupJob(
    jobId: number,
    reservationLedger: ReservationLedger | undefined,
  ): { readonly releasedReservations: number; readonly clearedCarriedAmount: number } {
    const clearedCarriedAmount = this.carriedAmount[jobId] ?? 0;
    let releasedReservations = 0;

    if (reservationLedger !== undefined && (this.jobGenerations[jobId] ?? 0) === 0) {
      const released = reservationLedger.releaseReservationsForOwnerJob(
        {
          index: this.ownerIndex[jobId] ?? 0,
          generation: this.ownerGeneration[jobId] ?? 0,
        },
        jobId,
      );

      if (released.ok) {
        releasedReservations = released.releasedCount;
      }
    }

    this.carriedDefId[jobId] = JOB_NONE;
    this.carriedAmount[jobId] = 0;
    return { releasedReservations, clearedCarriedAmount };
  }

  private restoreExactSnapshot(
    snapshot: JobCoreSnapshotInput,
    registry: EntityRegistry | undefined,
  ): JobSnapshotResult {
    this.clearAll();
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const slot = snapshot.slots[jobId];
      if (slot === undefined) return { ok: false, reason: "job_snapshot_record_invalid" };
      this.active[jobId] = slot.active;
      this.ownerIndex[jobId] = slot.ownerIndex;
      this.ownerGeneration[jobId] = slot.ownerGeneration;
      this.jobKind[jobId] = slot.jobKind;
      this.targetId[jobId] = slot.targetId;
      this.statusCode[jobId] = slot.statusCode;
      this.stepCode[jobId] = slot.stepCode;
      this.interruptionPolicyCode[jobId] = slot.interruptionPolicyCode;
      this.failureReasonCode[jobId] = slot.failureReasonCode;
      this.createdTick[jobId] = slot.createdTick;
      this.stepEnteredTick[jobId] = slot.stepEnteredTick;
      this.stepTickCount[jobId] = slot.stepTickCount;
      this.progressQ16[jobId] = slot.progressQ16;
      this.requiredWorkQ16[jobId] = slot.requiredWorkQ16;
      this.carriedDefId[jobId] = slot.carriedDefId;
      this.carriedAmount[jobId] = slot.carriedAmount;
      this.jobGenerations[jobId] = slot.jobGeneration;
      this.slotGenerationCounters[jobId] = slot.slotGenerationCounter;
      this.slotVersions[jobId] = slot.slotVersion;
      this.autonomyStates[jobId] = slot.autonomyState;
      this.autonomyOriginStates[jobId] = slot.autonomyOriginState;
      this.originShadowPresent[jobId] = slot.originShadowPresent;
      this.originJobGenerations[jobId] = slot.originJobGeneration;
      this.originOwnerIndexes[jobId] = slot.originOwnerIndex;
      this.originOwnerGenerations[jobId] = slot.originOwnerGeneration;
      this.originJobKinds[jobId] = slot.originJobKind;
      this.originTargetIds[jobId] = slot.originTargetId;
      this.originStatusCodes[jobId] = slot.originStatusCode;
      this.originFailureReasonCodes[jobId] = slot.originFailureReasonCode;
      this.originCreatedTicks[jobId] = slot.originCreatedTick;
      this.originTerminalTicks[jobId] = slot.originTerminalTick;
      this.originEffectPhases[jobId] = slot.originEffectPhase;
      this.terminalEffectPhases[jobId] = slot.terminalEffectPhase;
      this.adoptionReservationVersions[jobId] = slot.adoptionReservationVersion;
      this.adoptionDriverVersions[jobId] = slot.adoptionDriverVersion;
      this.adoptionSlotVersions[jobId] = slot.adoptionSlotVersion;
      this.lastMutationTicks[jobId] = slot.lastMutationTick;
      this.originStepCodes[jobId] = slot.originStepCode;
      this.originInterruptionPolicyCodes[jobId] = slot.originInterruptionPolicyCode;
      this.originStepTickCounts[jobId] = slot.originStepTickCount;
      this.originProgressQ16[jobId] = slot.originProgressQ16;
      this.originRequiredWorkQ16[jobId] = slot.originRequiredWorkQ16;
      this.originCarriedDefIds[jobId] = slot.originCarriedDefId;
      this.originCarriedAmounts[jobId] = slot.originCarriedAmount;
      this.originAdoptionReservationVersions[jobId] = slot.originAdoptionReservationVersion;
      this.originAdoptionDriverVersions[jobId] = slot.originAdoptionDriverVersion;
      this.originAdoptionSlotVersions[jobId] = slot.originAdoptionSlotVersion;
      this.originLastMutationTicks[jobId] = slot.originLastMutationTick;
    }
    for (let ownerIndex = 0; ownerIndex < this.ownerCapacity; ownerIndex += 1) {
      const owner = snapshot.owners[ownerIndex];
      if (owner === undefined) return { ok: false, reason: "job_snapshot_record_invalid" };
      this.ownerAutonomyOccupied[ownerIndex] = owner.occupied;
      this.ownerAutonomyGenerations[ownerIndex] = owner.ownerGeneration;
      this.ownerAutonomyJobIds[ownerIndex] = owner.autonomyJobId;
      this.ownerLegacyLiveCounts[ownerIndex] = owner.legacyLiveCount;
    }
    this.freeAutonomyCount = snapshot.freeAutonomyJobIds.length;
    for (let index = 0; index < this.freeAutonomyCount; index += 1) {
      this.freeAutonomyJobIds[index] = snapshot.freeAutonomyJobIds[index] ?? JOB_NONE;
    }
    this.storeVersion = snapshot.storeVersion;
    this.activeCount = snapshot.activeCount;
    this.reservedCount = snapshot.reservedCount;
    this.autonomyRunningCount = snapshot.autonomyRunningCount;
    this.currentTombstoneCount = snapshot.currentTombstoneCount;
    this.terminalCount = snapshot.cumulativeTerminalCount;
    if (!this.isRestoredStateValid(snapshot, registry)) {
      return { ok: false, reason: "job_snapshot_record_invalid" };
    }
    return { ok: true, version: this.storeVersion, activeCount: this.activeCount };
  }

  private validateCreateInputReason(
    input: JobCreateInput,
    registry: EntityRegistry | undefined,
    allowAutonomyRange = false,
  ): JobCoreReason | undefined {
    if (
      !isIndexInRange(input.jobId, this.capacity) ||
      (!allowAutonomyRange && input.jobId >= this.autonomyJobStart)
    ) {
      return "job_id_out_of_range";
    }

    if (!this.isValidOwner(input.owner)) {
      return "job_owner_invalid";
    }

    if (registry !== undefined && !registry.isAlive(input.owner)) {
      return "job_owner_invalid";
    }

    if (!isSafeUint32(input.jobKind)) {
      return "job_kind_invalid";
    }

    if (!isSafeUint32(input.targetId) || input.targetId >= JOB_NONE) {
      return "job_target_invalid";
    }

    if (encodeStep(input.initialStep) === JOB_STEP_UNASSIGNED) {
      return "job_step_invalid";
    }

    if (!isSafeUint32(input.requiredWorkQ16) || !isSafeTickValue(input.createdTick)) {
      return "job_progress_invalid";
    }

    return undefined;
  }

  private validateActiveJob(jobId: number): JobCoreMutationResult {
    if (!isIndexInRange(jobId, this.capacity) || jobId >= this.autonomyJobStart) {
      return { ok: false, reason: "job_id_out_of_range" };
    }

    if ((this.active[jobId] ?? 0) !== 1) {
      return { ok: false, reason: "job_not_active" };
    }

    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "job_core_version_exhausted" };
    }

    return { ok: true, jobId, version: this.storeVersion };
  }

  private validateSnapshotShape(snapshot: unknown): JobSnapshotShapeResult {
    if (!isPlainObject(snapshot)) {
      return { ok: false, reason: "job_snapshot_shape_invalid" };
    }

    const snapshotVersion = snapshot["snapshotVersion"];
    if (!isSafeUint32(snapshotVersion)) {
      return { ok: false, reason: "job_snapshot_shape_invalid" };
    }

    if (snapshotVersion !== JOB_CORE_SNAPSHOT_VERSION) {
      return { ok: false, reason: "job_snapshot_version_unsupported" };
    }

    if (
      !isJobCoreSnapshotInput(snapshot) ||
      snapshot.capacity !== this.capacity ||
      snapshot.ownerCapacity !== this.ownerCapacity ||
      snapshot.autonomyJobStart !== this.autonomyJobStart ||
      snapshot.slots.length !== this.capacity ||
      snapshot.owners.length !== this.ownerCapacity ||
      snapshot.freeAutonomyJobIds.length > this.capacity - this.autonomyJobStart
    ) {
      return { ok: false, reason: "job_snapshot_shape_invalid" };
    }
    for (const record of snapshot.records) {
      if (!isJobRecordSnapshotShape(record)) {
        return { ok: false, reason: "job_snapshot_record_invalid" };
      }
    }
    return { ok: true, snapshot };
  }

  private isValidSnapshotRecord(record: unknown): record is JobRecordSnapshot {
    if (!isPlainObject(record)) {
      return false;
    }

    const owner = record["owner"];
    if (!isPlainObject(owner)) {
      return false;
    }

    const jobId = record["jobId"];
    const jobKind = record["jobKind"];
    const targetId = record["targetId"];
    const status = record["status"];
    const step = record["step"];
    const interruptionPolicy = record["interruptionPolicy"];
    const failureReason = record["failureReason"];
    const createdTick = record["createdTick"];
    const stepEnteredTick = record["stepEnteredTick"];
    const stepTickCount = record["stepTickCount"];
    const progressQ16 = record["progressQ16"];
    const requiredWorkQ16 = record["requiredWorkQ16"];
    const carriedDefId = record["carriedDefId"];
    const carriedAmount = record["carriedAmount"];

    return (
      isIndexInRange(jobId, this.capacity) &&
      isSafeUint32(owner["index"]) &&
      isSafeUint32(owner["generation"]) &&
      isSafeUint32(jobKind) &&
      isSafeUint32(targetId) &&
      targetId < JOB_NONE &&
      isJobStatus(status) &&
      isJobStep(step) &&
      step !== "unassigned" &&
      isJobInterruptionPolicy(interruptionPolicy) &&
      isJobFailureReason(failureReason) &&
      isSafeTickValue(createdTick) &&
      isSafeTickValue(stepEnteredTick) &&
      stepEnteredTick >= createdTick &&
      isSafeUint32(stepTickCount) &&
      isSafeUint32(progressQ16) &&
      isSafeUint32(requiredWorkQ16) &&
      isSafeUint32(carriedDefId) &&
      isSafeUint32(carriedAmount)
    );
  }

  private isActiveJobId(jobId: number): boolean {
    return (
      isIndexInRange(jobId, this.capacity) &&
      jobId < this.autonomyJobStart &&
      this.hasVisibleRecord(jobId)
    );
  }

  private hasVisibleRecord(jobId: number): boolean {
    if ((this.active[jobId] ?? 0) === 1) return true;
    const status = this.statusCode[jobId] ?? JOB_STATUS_INACTIVE;
    if (jobId < this.autonomyJobStart)
      return (
        status === JOB_STATUS_COMPLETED ||
        status === JOB_STATUS_FAILED ||
        status === JOB_STATUS_CANCELED
      );
    return (this.autonomyStates[jobId] ?? 0) === 3;
  }

  private createRecordView(jobId: number): JobRecordView {
    return {
      jobId,
      owner: {
        index: this.ownerIndex[jobId] ?? 0,
        generation: this.ownerGeneration[jobId] ?? 0,
      },
      jobKind: this.jobKind[jobId] ?? 0,
      targetId: this.targetId[jobId] ?? 0,
      status: decodeStatus(this.statusCode[jobId] ?? JOB_STATUS_INACTIVE),
      step: decodeStep(this.stepCode[jobId] ?? JOB_STEP_UNASSIGNED),
      interruptionPolicy: decodePolicy(this.interruptionPolicyCode[jobId] ?? JOB_POLICY_NEVER),
      failureReason: decodeFailureReason(this.failureReasonCode[jobId] ?? JOB_FAILURE_NONE),
      createdTick: this.createdTick[jobId] ?? 0,
      stepEnteredTick: this.stepEnteredTick[jobId] ?? 0,
      stepTickCount: this.stepTickCount[jobId] ?? 0,
      progressQ16: this.progressQ16[jobId] ?? 0,
      requiredWorkQ16: this.requiredWorkQ16[jobId] ?? 0,
      carriedDefId: this.carriedDefId[jobId] ?? JOB_NONE,
      carriedAmount: this.carriedAmount[jobId] ?? 0,
    };
  }

  private createSlotSnapshot(jobId: number): JobCoreSlotSnapshot {
    return {
      jobId,
      active: this.active[jobId] ?? 0,
      ownerIndex: this.ownerIndex[jobId] ?? 0,
      ownerGeneration: this.ownerGeneration[jobId] ?? 0,
      jobKind: this.jobKind[jobId] ?? 0,
      targetId: this.targetId[jobId] ?? 0,
      statusCode: this.statusCode[jobId] ?? 0,
      stepCode: this.stepCode[jobId] ?? 0,
      interruptionPolicyCode: this.interruptionPolicyCode[jobId] ?? 0,
      failureReasonCode: this.failureReasonCode[jobId] ?? 0,
      createdTick: this.createdTick[jobId] ?? 0,
      stepEnteredTick: this.stepEnteredTick[jobId] ?? 0,
      stepTickCount: this.stepTickCount[jobId] ?? 0,
      progressQ16: this.progressQ16[jobId] ?? 0,
      requiredWorkQ16: this.requiredWorkQ16[jobId] ?? 0,
      carriedDefId: this.carriedDefId[jobId] ?? JOB_NONE,
      carriedAmount: this.carriedAmount[jobId] ?? 0,
      jobGeneration: this.jobGenerations[jobId] ?? 0,
      slotGenerationCounter: this.slotGenerationCounters[jobId] ?? 0,
      slotVersion: this.slotVersions[jobId] ?? 0,
      autonomyState: this.autonomyStates[jobId] ?? 0,
      autonomyOriginState: this.autonomyOriginStates[jobId] ?? 0,
      originShadowPresent: this.originShadowPresent[jobId] ?? 0,
      originJobGeneration: this.originJobGenerations[jobId] ?? 0,
      originOwnerIndex: this.originOwnerIndexes[jobId] ?? 0,
      originOwnerGeneration: this.originOwnerGenerations[jobId] ?? 0,
      originJobKind: this.originJobKinds[jobId] ?? 0,
      originTargetId: this.originTargetIds[jobId] ?? 0,
      originStatusCode: this.originStatusCodes[jobId] ?? 0,
      originFailureReasonCode: this.originFailureReasonCodes[jobId] ?? 0,
      originCreatedTick: this.originCreatedTicks[jobId] ?? 0,
      originTerminalTick: this.originTerminalTicks[jobId] ?? 0,
      originEffectPhase: this.originEffectPhases[jobId] ?? 0,
      terminalEffectPhase: this.terminalEffectPhases[jobId] ?? 0,
      adoptionReservationVersion: this.adoptionReservationVersions[jobId] ?? 0,
      adoptionDriverVersion: this.adoptionDriverVersions[jobId] ?? 0,
      adoptionSlotVersion: this.adoptionSlotVersions[jobId] ?? 0,
      lastMutationTick: this.lastMutationTicks[jobId] ?? 0,
      originStepCode: this.originStepCodes[jobId] ?? 0,
      originInterruptionPolicyCode: this.originInterruptionPolicyCodes[jobId] ?? 0,
      originStepTickCount: this.originStepTickCounts[jobId] ?? 0,
      originProgressQ16: this.originProgressQ16[jobId] ?? 0,
      originRequiredWorkQ16: this.originRequiredWorkQ16[jobId] ?? 0,
      originCarriedDefId: this.originCarriedDefIds[jobId] ?? JOB_NONE,
      originCarriedAmount: this.originCarriedAmounts[jobId] ?? 0,
      originAdoptionReservationVersion: this.originAdoptionReservationVersions[jobId] ?? 0,
      originAdoptionDriverVersion: this.originAdoptionDriverVersions[jobId] ?? 0,
      originAdoptionSlotVersion: this.originAdoptionSlotVersions[jobId] ?? 0,
      originLastMutationTick: this.originLastMutationTicks[jobId] ?? 0,
    };
  }

  private isRestoredStateValid(
    snapshot: JobCoreSnapshotInput,
    registry: EntityRegistry | undefined,
  ): boolean {
    const freeSeen = new Uint8Array(this.capacity);
    for (let index = 0; index < this.freeAutonomyCount; index += 1) {
      const jobId = this.freeAutonomyJobIds[index] ?? JOB_NONE;
      if (
        !isIndexInRange(jobId, this.capacity) ||
        jobId < this.autonomyJobStart ||
        freeSeen[jobId] === 1
      )
        return false;
      freeSeen[jobId] = 1;
      if (index > 0) {
        const parent = (index - 1) >>> 1;
        if ((this.freeAutonomyJobIds[parent] ?? JOB_NONE) > jobId) return false;
      }
    }
    let activeCount = 0;
    let reservedCount = 0;
    let runningCount = 0;
    let tombstoneCount = 0;
    let recordIndex = 0;
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const snapshotSlot = snapshot.slots[jobId];
      if (snapshotSlot?.jobId !== jobId) return false;
      const state = this.autonomyStates[jobId] ?? 0;
      if ((this.active[jobId] ?? 0) === 1) {
        activeCount += 1;
        if (
          registry !== undefined &&
          !registry.isAlive({
            index: this.ownerIndex[jobId] ?? 0,
            generation: this.ownerGeneration[jobId] ?? 0,
          })
        )
          return false;
      }
      if (this.hasVisibleRecord(jobId)) {
        const record = snapshot.records[recordIndex];
        if (record === undefined || !this.recordMatchesSlot(record, jobId)) return false;
        recordIndex += 1;
      }
      if (
        (this.slotVersions[jobId] ?? 0) > this.storeVersion ||
        !isValidStatusCode(this.statusCode[jobId] ?? 0) ||
        !isValidStepCode(this.stepCode[jobId] ?? 0) ||
        !isValidPolicyCode(this.interruptionPolicyCode[jobId] ?? 0) ||
        !isValidFailureCode(this.failureReasonCode[jobId] ?? 0) ||
        (this.stepEnteredTick[jobId] ?? 0) < (this.createdTick[jobId] ?? 0) ||
        (this.lastMutationTicks[jobId] ?? 0) < (this.createdTick[jobId] ?? 0) ||
        (this.lastMutationTicks[jobId] ?? 0) < (this.stepEnteredTick[jobId] ?? 0)
      )
        return false;
      if (jobId < this.autonomyJobStart) {
        if (state !== 0 || (this.jobGenerations[jobId] ?? 0) !== 0 || freeSeen[jobId] === 1) {
          return false;
        }
        const status = this.statusCode[jobId] ?? JOB_STATUS_INACTIVE;
        if ((this.active[jobId] ?? 0) === 1) {
          const owner = this.ownerIndex[jobId] ?? this.ownerCapacity;
          if (
            (status !== JOB_STATUS_READY && status !== JOB_STATUS_RUNNING) ||
            !isIndexInRange(owner, this.ownerCapacity) ||
            (this.ownerAutonomyOccupied[owner] ?? 0) !== 1 ||
            (this.ownerAutonomyJobIds[owner] ?? JOB_NONE) !== JOB_NONE ||
            (this.ownerAutonomyGenerations[owner] ?? 0) !== (this.ownerGeneration[jobId] ?? 0)
          ) {
            return false;
          }
        } else if (status !== JOB_STATUS_INACTIVE && status < JOB_STATUS_COMPLETED) return false;
        continue;
      }
      if ((this.jobGenerations[jobId] ?? 0) > (this.slotGenerationCounters[jobId] ?? 0)) {
        return false;
      }
      if (state === 1) reservedCount += 1;
      else if (state === 2) runningCount += 1;
      else if (state === 3) tombstoneCount += 1;
      if ((state === 0 || state === 3) !== (freeSeen[jobId] === 1)) return false;
      if (
        state === 0 &&
        ((this.active[jobId] ?? 0) !== 0 ||
          (this.ownerIndex[jobId] ?? 0) !== 0 ||
          (this.ownerGeneration[jobId] ?? 0) !== 0 ||
          (this.statusCode[jobId] ?? 0) !== JOB_STATUS_INACTIVE ||
          (this.stepCode[jobId] ?? 0) !== JOB_STEP_UNASSIGNED ||
          (this.jobGenerations[jobId] ?? 0) !== 0 ||
          (this.terminalEffectPhases[jobId] ?? 0) !== 0 ||
          (this.adoptionReservationVersions[jobId] ?? 0) !== 0 ||
          (this.adoptionDriverVersions[jobId] ?? 0) !== 0 ||
          (this.adoptionSlotVersions[jobId] ?? 0) !== 0 ||
          (this.carriedDefId[jobId] ?? JOB_NONE) !== JOB_NONE ||
          (this.carriedAmount[jobId] ?? 0) !== 0)
      )
        return false;
      if (state === 1 && (this.active[jobId] ?? 0) !== 0) return false;
      if (
        state === 2 &&
        ((this.active[jobId] ?? 0) !== 1 ||
          (this.statusCode[jobId] ?? 0) !== JOB_STATUS_RUNNING ||
          (this.stepCode[jobId] ?? 0) === JOB_STEP_UNASSIGNED ||
          (this.adoptionSlotVersions[jobId] ?? 0) === 0)
      )
        return false;
      if (
        (state === 1 || state === 2) &&
        ((this.jobGenerations[jobId] ?? 0) === 0 ||
          (this.jobGenerations[jobId] ?? 0) !== (this.slotGenerationCounters[jobId] ?? 0) ||
          !this.tokenHasExactOwnerBacklink(jobId, registry))
      )
        return false;
      if (
        state === 3 &&
        ((this.active[jobId] ?? 0) !== 0 ||
          (this.jobGenerations[jobId] ?? 0) === 0 ||
          !isIndexInRange(this.ownerIndex[jobId] ?? this.ownerCapacity, this.ownerCapacity) ||
          (this.ownerGeneration[jobId] ?? 0) === 0 ||
          (this.statusCode[jobId] ?? 0) < JOB_STATUS_COMPLETED ||
          (this.stepCode[jobId] ?? 0) !== JOB_STEP_COMPLETE ||
          (this.terminalEffectPhases[jobId] ?? 0) === 0 ||
          (this.ownerAutonomyJobIds[this.ownerIndex[jobId] ?? 0] ?? JOB_NONE) === jobId)
      )
        return false;
      const shadow = this.originShadowPresent[jobId] ?? 0;
      if (shadow === 1 && state !== 3) tombstoneCount += 1;
      if (
        shadow === 1 &&
        ((state !== 1 && state !== 2) ||
          (this.autonomyOriginStates[jobId] ?? 0) !== 3 ||
          (this.originJobGenerations[jobId] ?? 0) === 0 ||
          !isIndexInRange(
            this.originOwnerIndexes[jobId] ?? this.ownerCapacity,
            this.ownerCapacity,
          ) ||
          (this.originOwnerGenerations[jobId] ?? 0) === 0 ||
          (this.originTargetIds[jobId] ?? JOB_NONE) >= JOB_NONE ||
          (this.originJobGenerations[jobId] ?? 0) >= (this.jobGenerations[jobId] ?? 0) ||
          !isValidStatusCode(this.originStatusCodes[jobId] ?? 0) ||
          (this.originStatusCodes[jobId] ?? 0) < JOB_STATUS_COMPLETED ||
          (this.originStepCodes[jobId] ?? 0) !== JOB_STEP_COMPLETE ||
          !isValidPolicyCode(this.originInterruptionPolicyCodes[jobId] ?? 0) ||
          !isValidFailureCode(this.originFailureReasonCodes[jobId] ?? 0) ||
          (this.originTerminalTicks[jobId] ?? 0) < (this.originCreatedTicks[jobId] ?? 0) ||
          (this.originLastMutationTicks[jobId] ?? 0) < (this.originTerminalTicks[jobId] ?? 0) ||
          (this.originEffectPhases[jobId] ?? 0) === 0)
      )
        return false;
      if (shadow === 0 && !this.isOriginShadowZero(jobId)) return false;
    }
    if (
      recordIndex !== snapshot.records.length ||
      activeCount !== this.activeCount ||
      reservedCount !== this.reservedCount ||
      runningCount !== this.autonomyRunningCount ||
      tombstoneCount !== this.currentTombstoneCount ||
      this.terminalCount < this.currentTombstoneCount
    )
      return false;
    for (let ownerIndex = 0; ownerIndex < this.ownerCapacity; ownerIndex += 1) {
      if (snapshot.owners[ownerIndex]?.ownerIndex !== ownerIndex) return false;
      const occupied = this.ownerAutonomyOccupied[ownerIndex] ?? 0;
      const generation = this.ownerAutonomyGenerations[ownerIndex] ?? 0;
      const tokenJobId = this.ownerAutonomyJobIds[ownerIndex] ?? JOB_NONE;
      const legacyCount = this.ownerLegacyLiveCounts[ownerIndex] ?? 0;
      if (occupied === 0) {
        if (generation !== 0 || tokenJobId !== JOB_NONE || legacyCount !== 0) return false;
        continue;
      }
      if (occupied !== 1 || generation === 0) return false;
      if (tokenJobId === JOB_NONE) {
        if (
          legacyCount === 0 ||
          this.countLegacyJobsForOwner(ownerIndex, generation) !== legacyCount
        ) {
          return false;
        }
      } else if (
        legacyCount !== 0 ||
        tokenJobId < this.autonomyJobStart ||
        (this.autonomyStates[tokenJobId] ?? 0) === 0 ||
        (this.ownerIndex[tokenJobId] ?? 0) !== ownerIndex ||
        (this.ownerGeneration[tokenJobId] ?? 0) !== generation
      )
        return false;
    }
    return true;
  }

  private tokenHasExactOwnerBacklink(jobId: number, registry: EntityRegistry | undefined): boolean {
    const ownerIndex = this.ownerIndex[jobId] ?? 0;
    const ownerGeneration = this.ownerGeneration[jobId] ?? 0;
    if (
      !isIndexInRange(ownerIndex, this.ownerCapacity) ||
      ownerGeneration === 0 ||
      (this.ownerAutonomyOccupied[ownerIndex] ?? 0) !== 1 ||
      (this.ownerAutonomyJobIds[ownerIndex] ?? JOB_NONE) !== jobId ||
      (this.ownerAutonomyGenerations[ownerIndex] ?? 0) !== ownerGeneration ||
      (this.ownerLegacyLiveCounts[ownerIndex] ?? 0) !== 0
    )
      return false;
    return (
      registry === undefined || registry.isAlive({ index: ownerIndex, generation: ownerGeneration })
    );
  }

  private isOriginShadowZero(jobId: number): boolean {
    return (
      (this.originJobGenerations[jobId] ?? 0) === 0 &&
      (this.originOwnerIndexes[jobId] ?? 0) === 0 &&
      (this.originOwnerGenerations[jobId] ?? 0) === 0 &&
      (this.originJobKinds[jobId] ?? 0) === 0 &&
      (this.originTargetIds[jobId] ?? 0) === 0 &&
      (this.originStatusCodes[jobId] ?? 0) === 0 &&
      (this.originFailureReasonCodes[jobId] ?? 0) === 0 &&
      (this.originCreatedTicks[jobId] ?? 0) === 0 &&
      (this.originTerminalTicks[jobId] ?? 0) === 0 &&
      (this.originEffectPhases[jobId] ?? 0) === 0 &&
      (this.originStepCodes[jobId] ?? 0) === 0 &&
      (this.originInterruptionPolicyCodes[jobId] ?? 0) === 0 &&
      (this.originStepTickCounts[jobId] ?? 0) === 0 &&
      (this.originProgressQ16[jobId] ?? 0) === 0 &&
      (this.originRequiredWorkQ16[jobId] ?? 0) === 0 &&
      (this.originCarriedDefIds[jobId] ?? JOB_NONE) === JOB_NONE &&
      (this.originCarriedAmounts[jobId] ?? 0) === 0 &&
      (this.originAdoptionReservationVersions[jobId] ?? 0) === 0 &&
      (this.originAdoptionDriverVersions[jobId] ?? 0) === 0 &&
      (this.originAdoptionSlotVersions[jobId] ?? 0) === 0 &&
      (this.originLastMutationTicks[jobId] ?? 0) === 0
    );
  }

  private countLegacyJobsForOwner(ownerIndex: number, ownerGeneration: number): number {
    let count = 0;
    for (let jobId = 0; jobId < this.autonomyJobStart; jobId += 1) {
      if (
        (this.active[jobId] ?? 0) === 1 &&
        (this.ownerIndex[jobId] ?? 0) === ownerIndex &&
        (this.ownerGeneration[jobId] ?? 0) === ownerGeneration &&
        (this.statusCode[jobId] ?? 0) !== JOB_STATUS_COMPLETED &&
        (this.statusCode[jobId] ?? 0) !== JOB_STATUS_FAILED &&
        (this.statusCode[jobId] ?? 0) !== JOB_STATUS_CANCELED
      )
        count += 1;
    }
    return count;
  }

  private recordMatchesSlot(record: JobRecordSnapshot, jobId: number): boolean {
    return (
      this.isValidSnapshotRecord(record) &&
      record.jobId === jobId &&
      record.owner.index === (this.ownerIndex[jobId] ?? 0) &&
      record.owner.generation === (this.ownerGeneration[jobId] ?? 0) &&
      record.jobKind === (this.jobKind[jobId] ?? 0) &&
      record.targetId === (this.targetId[jobId] ?? 0) &&
      encodeStatus(record.status) === (this.statusCode[jobId] ?? 0) &&
      encodeStep(record.step) === (this.stepCode[jobId] ?? 0) &&
      encodePolicy(record.interruptionPolicy) === (this.interruptionPolicyCode[jobId] ?? 0) &&
      encodeFailureReason(record.failureReason) === (this.failureReasonCode[jobId] ?? 0) &&
      record.createdTick === (this.createdTick[jobId] ?? 0) &&
      record.stepEnteredTick === (this.stepEnteredTick[jobId] ?? 0) &&
      record.stepTickCount === (this.stepTickCount[jobId] ?? 0) &&
      record.progressQ16 === (this.progressQ16[jobId] ?? 0) &&
      record.requiredWorkQ16 === (this.requiredWorkQ16[jobId] ?? 0) &&
      record.carriedDefId === (this.carriedDefId[jobId] ?? JOB_NONE) &&
      record.carriedAmount === (this.carriedAmount[jobId] ?? 0)
    );
  }

  private finishMutation(jobId: number): JobCoreMutationResult {
    return { ok: true, jobId, version: this.bumpVersion() };
  }

  private validateAutonomyMutation(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
  ): JobCoreReason | undefined {
    if (expectedJobCoreVersion !== this.storeVersion) return "job_version_mismatch";
    if (this.storeVersion > 0xffff_fffd || expectedSlotVersion > 0xffff_fffd) {
      return this.storeVersion > 0xffff_fffd
        ? "job_core_version_exhausted"
        : "job_slot_version_exhausted";
    }
    if (
      !this.matchesAutonomyToken(jobId, jobGeneration, owner, expectedSlotVersion) ||
      (this.autonomyStates[jobId] ?? 0) !== 2 ||
      (this.active[jobId] ?? 0) !== 1
    ) {
      return "job_token_mismatch";
    }
    if ((this.statusCode[jobId] ?? JOB_STATUS_INACTIVE) !== JOB_STATUS_RUNNING) {
      return "job_status_invalid";
    }
    return undefined;
  }

  private finishAutonomyMutationInto(
    jobId: number,
    jobGeneration: number,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
    output: AutonomyJobMutationIntoOutput,
  ): void {
    const slotVersion = expectedSlotVersion + 1;
    const version = expectedJobCoreVersion + 1;
    this.slotVersions[jobId] = slotVersion;
    this.storeVersion = version;
    output.ok = true;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.slotVersion = slotVersion;
    output.version = version;
    output.progressQ16 = this.progressQ16[jobId] ?? 0;
    output.readyToComplete = output.progressQ16 >= (this.requiredWorkQ16[jobId] ?? 0);
  }

  private isValidOwner(owner: EntityId): boolean {
    return (
      isIndexInRange(owner.index, this.ownerCapacity) &&
      isSafeUint32(owner.generation) &&
      owner.generation > 0
    );
  }

  private matchesAutonomyToken(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
  ): boolean {
    return this.matchesAutonomyTokenScalars(
      jobId,
      jobGeneration,
      owner.index,
      owner.generation,
      expectedSlotVersion,
    );
  }

  private matchesAutonomyTokenScalars(
    jobId: number,
    jobGeneration: number,
    ownerIndex: number,
    ownerGeneration: number,
    expectedSlotVersion: number,
  ): boolean {
    return (
      isIndexInRange(jobId, this.capacity) &&
      jobId >= this.autonomyJobStart &&
      isIndexInRange(ownerIndex, this.ownerCapacity) &&
      isSafeUint32(ownerGeneration) &&
      ownerGeneration > 0 &&
      (this.jobGenerations[jobId] ?? 0) === jobGeneration &&
      (this.ownerIndex[jobId] ?? 0) === ownerIndex &&
      (this.ownerGeneration[jobId] ?? 0) === ownerGeneration &&
      (this.slotVersions[jobId] ?? 0) === expectedSlotVersion &&
      (this.autonomyStates[jobId] ?? 0) !== 0 &&
      (this.ownerAutonomyOccupied[ownerIndex] ?? 0) === 1 &&
      (this.ownerAutonomyJobIds[ownerIndex] ?? JOB_NONE) === jobId &&
      (this.ownerAutonomyGenerations[ownerIndex] ?? 0) === ownerGeneration &&
      (this.ownerLegacyLiveCounts[ownerIndex] ?? 0) === 0
    );
  }

  private clearOwnerAutonomy(ownerIndex: number): void {
    this.ownerAutonomyOccupied[ownerIndex] = 0;
    this.ownerAutonomyJobIds[ownerIndex] = JOB_NONE;
    this.ownerAutonomyGenerations[ownerIndex] = 0;
  }

  private captureTombstoneOrigin(jobId: number): void {
    this.originShadowPresent[jobId] = 1;
    this.originOwnerIndexes[jobId] = this.ownerIndex[jobId] ?? 0;
    this.originOwnerGenerations[jobId] = this.ownerGeneration[jobId] ?? 0;
    this.originJobKinds[jobId] = this.jobKind[jobId] ?? 0;
    this.originTargetIds[jobId] = this.targetId[jobId] ?? 0;
    this.originStatusCodes[jobId] = this.statusCode[jobId] ?? JOB_STATUS_INACTIVE;
    this.originFailureReasonCodes[jobId] = this.failureReasonCode[jobId] ?? JOB_FAILURE_NONE;
    this.originCreatedTicks[jobId] = this.createdTick[jobId] ?? 0;
    this.originTerminalTicks[jobId] = this.stepEnteredTick[jobId] ?? 0;
    this.originEffectPhases[jobId] = this.terminalEffectPhases[jobId] ?? 0;
    this.originStepCodes[jobId] = this.stepCode[jobId] ?? 0;
    this.originInterruptionPolicyCodes[jobId] = this.interruptionPolicyCode[jobId] ?? 0;
    this.originStepTickCounts[jobId] = this.stepTickCount[jobId] ?? 0;
    this.originProgressQ16[jobId] = this.progressQ16[jobId] ?? 0;
    this.originRequiredWorkQ16[jobId] = this.requiredWorkQ16[jobId] ?? 0;
    this.originCarriedDefIds[jobId] = this.carriedDefId[jobId] ?? JOB_NONE;
    this.originCarriedAmounts[jobId] = this.carriedAmount[jobId] ?? 0;
    this.originAdoptionReservationVersions[jobId] = this.adoptionReservationVersions[jobId] ?? 0;
    this.originAdoptionDriverVersions[jobId] = this.adoptionDriverVersions[jobId] ?? 0;
    this.originAdoptionSlotVersions[jobId] = this.adoptionSlotVersions[jobId] ?? 0;
    this.originLastMutationTicks[jobId] = this.lastMutationTicks[jobId] ?? 0;
  }

  private restoreTombstoneOrigin(jobId: number): void {
    this.ownerIndex[jobId] = this.originOwnerIndexes[jobId] ?? 0;
    this.ownerGeneration[jobId] = this.originOwnerGenerations[jobId] ?? 0;
    this.jobKind[jobId] = this.originJobKinds[jobId] ?? 0;
    this.targetId[jobId] = this.originTargetIds[jobId] ?? 0;
    this.statusCode[jobId] = this.originStatusCodes[jobId] ?? JOB_STATUS_INACTIVE;
    this.failureReasonCode[jobId] = this.originFailureReasonCodes[jobId] ?? JOB_FAILURE_NONE;
    this.createdTick[jobId] = this.originCreatedTicks[jobId] ?? 0;
    this.stepEnteredTick[jobId] = this.originTerminalTicks[jobId] ?? 0;
    this.stepCode[jobId] = this.originStepCodes[jobId] ?? JOB_STEP_COMPLETE;
    this.interruptionPolicyCode[jobId] = this.originInterruptionPolicyCodes[jobId] ?? 0;
    this.stepTickCount[jobId] = this.originStepTickCounts[jobId] ?? 0;
    this.progressQ16[jobId] = this.originProgressQ16[jobId] ?? 0;
    this.requiredWorkQ16[jobId] = this.originRequiredWorkQ16[jobId] ?? 0;
    this.carriedDefId[jobId] = this.originCarriedDefIds[jobId] ?? JOB_NONE;
    this.carriedAmount[jobId] = this.originCarriedAmounts[jobId] ?? 0;
    this.adoptionReservationVersions[jobId] = this.originAdoptionReservationVersions[jobId] ?? 0;
    this.adoptionDriverVersions[jobId] = this.originAdoptionDriverVersions[jobId] ?? 0;
    this.adoptionSlotVersions[jobId] = this.originAdoptionSlotVersions[jobId] ?? 0;
    this.lastMutationTicks[jobId] = this.originLastMutationTicks[jobId] ?? 0;
    this.terminalEffectPhases[jobId] = this.originEffectPhases[jobId] ?? 0;
    this.clearOriginShadow(jobId);
  }

  private clearOriginShadow(jobId: number): void {
    this.originShadowPresent[jobId] = 0;
    this.originJobGenerations[jobId] = 0;
    this.originOwnerIndexes[jobId] = 0;
    this.originOwnerGenerations[jobId] = 0;
    this.originJobKinds[jobId] = 0;
    this.originTargetIds[jobId] = 0;
    this.originStatusCodes[jobId] = JOB_STATUS_INACTIVE;
    this.originFailureReasonCodes[jobId] = JOB_FAILURE_NONE;
    this.originCreatedTicks[jobId] = 0;
    this.originTerminalTicks[jobId] = 0;
    this.originEffectPhases[jobId] = 0;
    this.originStepCodes[jobId] = 0;
    this.originInterruptionPolicyCodes[jobId] = 0;
    this.originStepTickCounts[jobId] = 0;
    this.originProgressQ16[jobId] = 0;
    this.originRequiredWorkQ16[jobId] = 0;
    this.originCarriedDefIds[jobId] = JOB_NONE;
    this.originCarriedAmounts[jobId] = 0;
    this.originAdoptionReservationVersions[jobId] = 0;
    this.originAdoptionDriverVersions[jobId] = 0;
    this.originAdoptionSlotVersions[jobId] = 0;
    this.originLastMutationTicks[jobId] = 0;
  }

  private clearFreeSlotPayload(jobId: number): void {
    this.active[jobId] = 0;
    this.ownerIndex[jobId] = 0;
    this.ownerGeneration[jobId] = 0;
    this.jobKind[jobId] = 0;
    this.targetId[jobId] = 0;
    this.statusCode[jobId] = JOB_STATUS_INACTIVE;
    this.stepCode[jobId] = JOB_STEP_UNASSIGNED;
    this.interruptionPolicyCode[jobId] = JOB_POLICY_NEVER;
    this.failureReasonCode[jobId] = JOB_FAILURE_NONE;
    this.createdTick[jobId] = 0;
    this.stepEnteredTick[jobId] = 0;
    this.stepTickCount[jobId] = 0;
    this.progressQ16[jobId] = 0;
    this.requiredWorkQ16[jobId] = 0;
    this.carriedDefId[jobId] = JOB_NONE;
    this.carriedAmount[jobId] = 0;
    this.terminalEffectPhases[jobId] = 0;
    this.adoptionReservationVersions[jobId] = 0;
    this.adoptionDriverVersions[jobId] = 0;
    this.adoptionSlotVersions[jobId] = 0;
    this.lastMutationTicks[jobId] = 0;
  }

  private peekFreeAutonomyJobId(): number {
    return this.freeAutonomyJobIds[0] ?? JOB_NONE;
  }

  private popFreeAutonomyJobId(): void {
    const nextCount = this.freeAutonomyCount - 1;
    const replacement = this.freeAutonomyJobIds[nextCount] ?? JOB_NONE;
    this.freeAutonomyCount = nextCount;
    if (nextCount === 0) return;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      if (left >= nextCount) break;
      const right = left + 1;
      let child = left;
      if (
        right < nextCount &&
        (this.freeAutonomyJobIds[right] ?? JOB_NONE) < (this.freeAutonomyJobIds[left] ?? JOB_NONE)
      )
        child = right;
      const childValue = this.freeAutonomyJobIds[child] ?? JOB_NONE;
      if (replacement <= childValue) break;
      this.freeAutonomyJobIds[index] = childValue;
      index = child;
    }
    this.freeAutonomyJobIds[index] = replacement;
  }

  private pushFreeAutonomyJobId(jobId: number): void {
    let index = this.freeAutonomyCount;
    this.freeAutonomyCount += 1;
    for (let depth = 0; depth < this.capacity && index > 0; depth += 1) {
      const parent = (index - 1) >>> 1;
      const parentValue = this.freeAutonomyJobIds[parent] ?? JOB_NONE;
      if (parentValue <= jobId) break;
      this.freeAutonomyJobIds[index] = parentValue;
      index = parent;
    }
    this.freeAutonomyJobIds[index] = jobId;
  }

  private resetTokenOutput(output: JobTokenIntoOutput): void {
    output.ok = false;
    output.found = false;
    output.reason = undefined;
    output.jobId = JOB_NONE;
    output.jobGeneration = 0;
    output.ownerIndex = 0;
    output.ownerGeneration = 0;
    output.ownerOccupied = false;
    output.ownerLegacyLiveCount = 0;
    output.state = "free";
    output.originState = "free";
    output.originShadowPresent = false;
    output.slotGenerationCounter = 0;
    output.originJobGeneration = 0;
    output.originOwnerIndex = 0;
    output.originOwnerGeneration = 0;
    output.originJobKind = 0;
    output.originTargetId = 0;
    output.originStatus = undefined;
    output.originFailureReason = "none";
    output.originCreatedTick = 0;
    output.originTerminalTick = 0;
    output.originEffectPhase = 0;
    output.terminalEffectPhase = 0;
    output.slotVersion = 0;
    output.version = this.storeVersion;
    output.reservedCount = this.reservedCount;
    output.activeCount = this.activeCount;
    output.runningCount = this.autonomyRunningCount;
    output.currentTombstoneCount = this.currentTombstoneCount;
    output.cumulativeTerminalCount = this.terminalCount;
  }

  private writeTokenOutput(jobId: number, output: JobTokenIntoOutput): void {
    const ownerIndex = this.ownerIndex[jobId] ?? 0;
    output.ok = true;
    output.found = true;
    output.jobId = jobId;
    output.jobGeneration = this.jobGenerations[jobId] ?? 0;
    output.ownerIndex = ownerIndex;
    output.ownerGeneration = this.ownerGeneration[jobId] ?? 0;
    output.ownerOccupied =
      ownerIndex < this.ownerCapacity && (this.ownerAutonomyOccupied[ownerIndex] ?? 0) === 1;
    output.ownerLegacyLiveCount =
      ownerIndex < this.ownerCapacity ? (this.ownerLegacyLiveCounts[ownerIndex] ?? 0) : 0;
    output.state = decodeTokenState(this.autonomyStates[jobId] ?? 0);
    output.originState = decodeTokenState(this.autonomyOriginStates[jobId] ?? 0);
    output.originShadowPresent = (this.originShadowPresent[jobId] ?? 0) === 1;
    output.slotGenerationCounter = this.slotGenerationCounters[jobId] ?? 0;
    output.originJobGeneration = this.originJobGenerations[jobId] ?? 0;
    output.originOwnerIndex = this.originOwnerIndexes[jobId] ?? 0;
    output.originOwnerGeneration = this.originOwnerGenerations[jobId] ?? 0;
    output.originJobKind = this.originJobKinds[jobId] ?? 0;
    output.originTargetId = this.originTargetIds[jobId] ?? 0;
    output.originStatus = output.originShadowPresent
      ? decodeStatus(this.originStatusCodes[jobId] ?? JOB_STATUS_INACTIVE)
      : undefined;
    output.originFailureReason = decodeFailureReason(
      this.originFailureReasonCodes[jobId] ?? JOB_FAILURE_NONE,
    );
    output.originCreatedTick = this.originCreatedTicks[jobId] ?? 0;
    output.originTerminalTick = this.originTerminalTicks[jobId] ?? 0;
    output.originEffectPhase = this.originEffectPhases[jobId] ?? 0;
    output.terminalEffectPhase = this.terminalEffectPhases[jobId] ?? 0;
    output.slotVersion = this.slotVersions[jobId] ?? 0;
    output.version = this.storeVersion;
    output.reservedCount = this.reservedCount;
    output.activeCount = this.activeCount;
    output.runningCount = this.autonomyRunningCount;
    output.currentTombstoneCount = this.currentTombstoneCount;
    output.cumulativeTerminalCount = this.terminalCount;
  }

  private bumpVersion(): number {
    this.storeVersion += 1;
    return this.storeVersion;
  }

  private clearAll(): void {
    this.active.fill(0);
    this.ownerIndex.fill(0);
    this.ownerGeneration.fill(0);
    this.jobKind.fill(0);
    this.targetId.fill(0);
    this.statusCode.fill(0);
    this.stepCode.fill(0);
    this.interruptionPolicyCode.fill(0);
    this.failureReasonCode.fill(0);
    this.createdTick.fill(0);
    this.stepEnteredTick.fill(0);
    this.stepTickCount.fill(0);
    this.progressQ16.fill(0);
    this.requiredWorkQ16.fill(0);
    this.carriedDefId.fill(JOB_NONE);
    this.carriedAmount.fill(0);
    this.jobGenerations.fill(0);
    this.slotGenerationCounters.fill(0);
    this.slotVersions.fill(0);
    this.autonomyStates.fill(0);
    this.autonomyOriginStates.fill(0);
    this.originShadowPresent.fill(0);
    this.originOwnerIndexes.fill(0);
    this.originOwnerGenerations.fill(0);
    this.originJobKinds.fill(0);
    this.originTargetIds.fill(0);
    this.originStatusCodes.fill(0);
    this.originFailureReasonCodes.fill(0);
    this.originCreatedTicks.fill(0);
    this.originTerminalTicks.fill(0);
    this.originEffectPhases.fill(0);
    this.terminalEffectPhases.fill(0);
    this.adoptionReservationVersions.fill(0);
    this.adoptionDriverVersions.fill(0);
    this.adoptionSlotVersions.fill(0);
    this.lastMutationTicks.fill(0);
    this.originStepCodes.fill(0);
    this.originInterruptionPolicyCodes.fill(0);
    this.originStepTickCounts.fill(0);
    this.originProgressQ16.fill(0);
    this.originRequiredWorkQ16.fill(0);
    this.originCarriedDefIds.fill(JOB_NONE);
    this.originCarriedAmounts.fill(0);
    this.originAdoptionReservationVersions.fill(0);
    this.originAdoptionDriverVersions.fill(0);
    this.originAdoptionSlotVersions.fill(0);
    this.originLastMutationTicks.fill(0);
    this.ownerAutonomyOccupied.fill(0);
    this.ownerAutonomyJobIds.fill(JOB_NONE);
    this.ownerAutonomyGenerations.fill(0);
    this.ownerLegacyLiveCounts.fill(0);
    for (let index = 0; index < this.freeAutonomyJobIds.length; index += 1) {
      this.freeAutonomyJobIds[index] = this.autonomyJobStart + index;
    }
    this.freeAutonomyCount = this.freeAutonomyJobIds.length;
    this.reservedCount = 0;
    this.autonomyRunningCount = 0;
    this.currentTombstoneCount = 0;
    this.activeCount = 0;
    this.terminalCount = 0;
    this.storeVersion = 0;
  }
}

export function createJobCoreStore(options: JobCoreStoreOptions): JobCoreStore {
  return new JobCoreStore(options);
}

export function commitPreparedAutonomyTerminal(
  store: JobCoreStore,
  prepared: PreparedAutonomyTerminal,
): void {
  store[JOB_CORE_TERMINAL_COMMIT](prepared);
}

export function commitPreparedAutonomyCarriedStep(
  store: JobCoreStore,
  prepared: PreparedAutonomyCarriedStep,
): void {
  store[JOB_CORE_CARRIED_COMMIT](prepared);
}

export function commitPreparedAutonomyProgress(
  store: JobCoreStore,
  prepared: PreparedAutonomyProgress,
): void {
  store[JOB_CORE_PROGRESS_COMMIT](prepared);
}

export function rollbackAndReleaseRunningAutonomyJobScalarsInto(
  store: JobCoreStore,
  jobId: number,
  jobGeneration: number,
  ownerIndex: number,
  ownerGeneration: number,
  expectedSlotVersion: number,
  expectedJobCoreVersion: number,
  expectedCreatedTick: number,
  expectedAdoptionTick: number,
  expectedReservationVersion: number,
  expectedAdoptedDriverVersion: number,
  output: JobTokenIntoOutput,
): void {
  store[JOB_CORE_ROLLBACK_RELEASE_COMMIT](
    jobId,
    jobGeneration,
    ownerIndex,
    ownerGeneration,
    expectedSlotVersion,
    expectedJobCoreVersion,
    expectedCreatedTick,
    expectedAdoptionTick,
    expectedReservationVersion,
    expectedAdoptedDriverVersion,
    output,
  );
}

export function matchesAutonomyOriginTerminalScalars(
  store: JobCoreStore,
  jobId: number,
  jobGeneration: number,
  ownerIndex: number,
  ownerGeneration: number,
  expectedSlotVersion: number,
  originJobGeneration: number,
  originOwnerIndex: number,
  originOwnerGeneration: number,
  originJobKind: number,
  originTargetId: number,
  originStatus: "completed" | "canceled" | "failed",
  originFailureReason: JobFailureReason,
  originCreatedTick: number,
  originTerminalTick: number,
  originEffectPhase: number,
  originInterruptionPolicy: JobInterruptionPolicy,
  originProgressQ16: number,
  originRequiredWorkQ16: number,
  originStepTickCount: number,
  originAdoptionReservationVersion: number,
  originAdoptionDriverVersion: number,
  originAdoptionSlotVersion: number,
): boolean {
  return store[JOB_CORE_ORIGIN_TERMINAL_MATCH](
    jobId,
    jobGeneration,
    ownerIndex,
    ownerGeneration,
    expectedSlotVersion,
    originJobGeneration,
    originOwnerIndex,
    originOwnerGeneration,
    originJobKind,
    originTargetId,
    originStatus,
    originFailureReason,
    originCreatedTick,
    originTerminalTick,
    originEffectPhase,
    originInterruptionPolicy,
    originProgressQ16,
    originRequiredWorkQ16,
    originStepTickCount,
    originAdoptionReservationVersion,
    originAdoptionDriverVersion,
    originAdoptionSlotVersion,
  );
}

export function restoreJobCoreStore(
  snapshot: JobCoreSnapshotInput,
  registry?: EntityRegistry,
): JobCoreStore {
  const store = createJobCoreStore({
    capacity: snapshot.capacity,
    ownerCapacity: snapshot.ownerCapacity,
    autonomyJobStart: snapshot.autonomyJobStart,
  });
  const restored = store.restoreFromSnapshot(snapshot, registry);

  if (!restored.ok) {
    throw new Error(restored.reason);
  }

  return store;
}

export function createJobCoreHashFields(
  snapshot: JobCoreSnapshotInput,
  prefix = "jobs",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.ownerCapacity`, value: snapshot.ownerCapacity },
    { name: `${prefix}.autonomyJobStart`, value: snapshot.autonomyJobStart },
    { name: `${prefix}.storeVersion`, value: snapshot.storeVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
    { name: `${prefix}.reservedCount`, value: snapshot.reservedCount },
    { name: `${prefix}.autonomyRunningCount`, value: snapshot.autonomyRunningCount },
    { name: `${prefix}.currentTombstoneCount`, value: snapshot.currentTombstoneCount },
    { name: `${prefix}.cumulativeTerminalCount`, value: snapshot.cumulativeTerminalCount },
    { name: `${prefix}.freeCount`, value: snapshot.freeAutonomyJobIds.length },
    { name: `${prefix}.slotCount`, value: snapshot.slots.length },
    { name: `${prefix}.ownerCount`, value: snapshot.owners.length },
    { name: `${prefix}.recordCount`, value: snapshot.records.length },
  ];

  for (let index = 0; index < snapshot.freeAutonomyJobIds.length; index += 1) {
    fields.push({
      name: `${prefix}.free.${String(index)}`,
      value: snapshot.freeAutonomyJobIds[index] ?? JOB_NONE,
    });
  }
  for (let index = 0; index < snapshot.slots.length; index += 1) {
    const slot = snapshot.slots[index];
    if (slot === undefined) continue;
    const slotPrefix = `${prefix}.slot.${String(index)}`;
    fields.push({ name: `${slotPrefix}.jobId`, value: slot.jobId });
    for (const [name, value] of jobCoreSlotHashEntries(slot)) {
      fields.push({ name: `${slotPrefix}.${name}`, value });
    }
  }
  for (let index = 0; index < snapshot.owners.length; index += 1) {
    const owner = snapshot.owners[index];
    if (owner === undefined) continue;
    const ownerPrefix = `${prefix}.owner.${String(index)}`;
    fields.push({ name: `${ownerPrefix}.ownerIndex`, value: owner.ownerIndex });
    fields.push({ name: `${ownerPrefix}.occupied`, value: owner.occupied });
    fields.push({ name: `${ownerPrefix}.generation`, value: owner.ownerGeneration });
    fields.push({ name: `${ownerPrefix}.autonomyJobId`, value: owner.autonomyJobId });
    fields.push({ name: `${ownerPrefix}.legacyLiveCount`, value: owner.legacyLiveCount });
  }

  for (const record of snapshot.records) {
    const recordPrefix = `${prefix}.record.${String(record.jobId)}`;
    fields.push({ name: `${recordPrefix}.jobKind`, value: record.jobKind });
    fields.push({ name: `${recordPrefix}.targetId`, value: record.targetId });
    fields.push({ name: `${recordPrefix}.ownerIndex`, value: record.owner.index });
    fields.push({ name: `${recordPrefix}.ownerGeneration`, value: record.owner.generation });
    fields.push({ name: `${recordPrefix}.status`, value: record.status });
    fields.push({ name: `${recordPrefix}.step`, value: record.step });
    fields.push({ name: `${recordPrefix}.policy`, value: record.interruptionPolicy });
    fields.push({ name: `${recordPrefix}.failureReason`, value: record.failureReason });
    fields.push({ name: `${recordPrefix}.createdTick`, value: record.createdTick });
    fields.push({ name: `${recordPrefix}.stepEnteredTick`, value: record.stepEnteredTick });
    fields.push({ name: `${recordPrefix}.stepTickCount`, value: record.stepTickCount });
    fields.push({ name: `${recordPrefix}.progressQ16`, value: record.progressQ16 });
    fields.push({ name: `${recordPrefix}.requiredWorkQ16`, value: record.requiredWorkQ16 });
    fields.push({ name: `${recordPrefix}.carriedDefId`, value: record.carriedDefId });
    fields.push({ name: `${recordPrefix}.carriedAmount`, value: record.carriedAmount });
  }

  return fields;
}

function allowsInterruption(policyCode: number, kind: JobInterruptionKind): boolean {
  const kindCode = encodeInterruptionKind(kind);

  if (policyCode === JOB_POLICY_NEVER) {
    return false;
  }

  if (policyCode === JOB_POLICY_AT_SAFE_POINT) {
    return kindCode === JOB_INTERRUPT_SAFE_POINT || kindCode === JOB_INTERRUPT_EMERGENCY;
  }

  if (policyCode === JOB_POLICY_IMMEDIATE) {
    return true;
  }

  return kindCode === JOB_INTERRUPT_EMERGENCY;
}

function isJobCoreSnapshotInput(value: unknown): value is JobCoreSnapshotInput {
  if (!isExactObject(value, JOB_SNAPSHOT_KEYS)) return false;
  const slots = value["slots"];
  const owners = value["owners"];
  const free = value["freeAutonomyJobIds"];
  const records = value["records"];
  return (
    isSafeUint32(value["snapshotVersion"]) &&
    isSafeUint32(value["capacity"]) &&
    isSafeUint32(value["ownerCapacity"]) &&
    isSafeUint32(value["autonomyJobStart"]) &&
    isSafeUint32(value["storeVersion"]) &&
    isSafeUint32(value["activeCount"]) &&
    isSafeUint32(value["reservedCount"]) &&
    isSafeUint32(value["autonomyRunningCount"]) &&
    isSafeUint32(value["currentTombstoneCount"]) &&
    isSafeUint32(value["cumulativeTerminalCount"]) &&
    Array.isArray(slots) &&
    isDenseArray(slots) &&
    slots.every(isJobCoreSlotSnapshot) &&
    Array.isArray(owners) &&
    isDenseArray(owners) &&
    owners.every(isJobCoreOwnerSnapshot) &&
    Array.isArray(free) &&
    isDenseArray(free) &&
    free.every(isSafeUint32) &&
    Array.isArray(records) &&
    isDenseArray(records)
  );
}

function isJobCoreSlotSnapshot(value: unknown): value is JobCoreSlotSnapshot {
  if (!isExactObject(value, JOB_SLOT_KEYS)) return false;
  return (
    isSafeUint32(value["jobId"]) &&
    isBinary(value["active"]) &&
    isSafeUint32(value["ownerIndex"]) &&
    isSafeUint32(value["ownerGeneration"]) &&
    isSafeUint32(value["jobKind"]) &&
    isSafeUint32(value["targetId"]) &&
    isByte(value["statusCode"]) &&
    isByte(value["stepCode"]) &&
    isByte(value["interruptionPolicyCode"]) &&
    isByte(value["failureReasonCode"]) &&
    isSafeTickValue(value["createdTick"]) &&
    isSafeTickValue(value["stepEnteredTick"]) &&
    isSafeUint32(value["stepTickCount"]) &&
    isSafeUint32(value["progressQ16"]) &&
    isSafeUint32(value["requiredWorkQ16"]) &&
    isSafeUint32(value["carriedDefId"]) &&
    isSafeUint32(value["carriedAmount"]) &&
    isSafeUint32(value["jobGeneration"]) &&
    isSafeUint32(value["slotGenerationCounter"]) &&
    isSafeUint32(value["slotVersion"]) &&
    isTokenStateCode(value["autonomyState"]) &&
    isTokenStateCode(value["autonomyOriginState"]) &&
    isBinary(value["originShadowPresent"]) &&
    isSafeUint32(value["originJobGeneration"]) &&
    isSafeUint32(value["originOwnerIndex"]) &&
    isSafeUint32(value["originOwnerGeneration"]) &&
    isSafeUint32(value["originJobKind"]) &&
    isSafeUint32(value["originTargetId"]) &&
    isByte(value["originStatusCode"]) &&
    isByte(value["originFailureReasonCode"]) &&
    isSafeTickValue(value["originCreatedTick"]) &&
    isSafeTickValue(value["originTerminalTick"]) &&
    isByte(value["originEffectPhase"]) &&
    isByte(value["terminalEffectPhase"]) &&
    isSafeUint32(value["adoptionReservationVersion"]) &&
    isSafeUint32(value["adoptionDriverVersion"]) &&
    isSafeUint32(value["adoptionSlotVersion"]) &&
    isSafeTickValue(value["lastMutationTick"]) &&
    isByte(value["originStepCode"]) &&
    isByte(value["originInterruptionPolicyCode"]) &&
    isSafeUint32(value["originStepTickCount"]) &&
    isSafeUint32(value["originProgressQ16"]) &&
    isSafeUint32(value["originRequiredWorkQ16"]) &&
    isSafeUint32(value["originCarriedDefId"]) &&
    isSafeUint32(value["originCarriedAmount"]) &&
    isSafeUint32(value["originAdoptionReservationVersion"]) &&
    isSafeUint32(value["originAdoptionDriverVersion"]) &&
    isSafeUint32(value["originAdoptionSlotVersion"]) &&
    isSafeTickValue(value["originLastMutationTick"])
  );
}

function isJobCoreOwnerSnapshot(value: unknown): value is JobCoreOwnerSnapshot {
  return (
    isExactObject(value, JOB_OWNER_KEYS) &&
    isSafeUint32(value["ownerIndex"]) &&
    isBinary(value["occupied"]) &&
    isSafeUint32(value["ownerGeneration"]) &&
    isSafeUint32(value["autonomyJobId"]) &&
    isSafeUint32(value["legacyLiveCount"])
  );
}

function isJobRecordSnapshotShape(value: unknown): value is JobRecordSnapshot {
  if (!isExactObject(value, JOB_RECORD_KEYS) || !isExactObject(value["owner"], ENTITY_KEYS))
    return false;
  const owner = value["owner"];
  return (
    isSafeUint32(value["jobId"]) &&
    isSafeUint32(owner["index"]) &&
    isSafeUint32(owner["generation"]) &&
    isSafeUint32(value["jobKind"]) &&
    isSafeUint32(value["targetId"]) &&
    isJobStatus(value["status"]) &&
    isJobStep(value["step"]) &&
    isJobInterruptionPolicy(value["interruptionPolicy"]) &&
    isJobFailureReason(value["failureReason"]) &&
    isSafeTickValue(value["createdTick"]) &&
    isSafeTickValue(value["stepEnteredTick"]) &&
    isSafeUint32(value["stepTickCount"]) &&
    isSafeUint32(value["progressQ16"]) &&
    isSafeUint32(value["requiredWorkQ16"]) &&
    isSafeUint32(value["carriedDefId"]) &&
    isSafeUint32(value["carriedAmount"])
  );
}

const JOB_SNAPSHOT_KEYS = [
  "snapshotVersion",
  "capacity",
  "ownerCapacity",
  "autonomyJobStart",
  "storeVersion",
  "activeCount",
  "reservedCount",
  "autonomyRunningCount",
  "currentTombstoneCount",
  "cumulativeTerminalCount",
  "freeAutonomyJobIds",
  "slots",
  "owners",
  "records",
] as const;
const JOB_OWNER_KEYS = [
  "ownerIndex",
  "occupied",
  "ownerGeneration",
  "autonomyJobId",
  "legacyLiveCount",
] as const;
const ENTITY_KEYS = ["index", "generation"] as const;
const JOB_RECORD_KEYS = [
  "jobId",
  "owner",
  "jobKind",
  "targetId",
  "status",
  "step",
  "interruptionPolicy",
  "failureReason",
  "createdTick",
  "stepEnteredTick",
  "stepTickCount",
  "progressQ16",
  "requiredWorkQ16",
  "carriedDefId",
  "carriedAmount",
] as const;
const JOB_SLOT_KEYS = [
  "jobId",
  "active",
  "ownerIndex",
  "ownerGeneration",
  "jobKind",
  "targetId",
  "statusCode",
  "stepCode",
  "interruptionPolicyCode",
  "failureReasonCode",
  "createdTick",
  "stepEnteredTick",
  "stepTickCount",
  "progressQ16",
  "requiredWorkQ16",
  "carriedDefId",
  "carriedAmount",
  "jobGeneration",
  "slotGenerationCounter",
  "slotVersion",
  "autonomyState",
  "autonomyOriginState",
  "originShadowPresent",
  "originJobGeneration",
  "originOwnerIndex",
  "originOwnerGeneration",
  "originJobKind",
  "originTargetId",
  "originStatusCode",
  "originFailureReasonCode",
  "originCreatedTick",
  "originTerminalTick",
  "originEffectPhase",
  "terminalEffectPhase",
  "adoptionReservationVersion",
  "adoptionDriverVersion",
  "adoptionSlotVersion",
  "lastMutationTick",
  "originStepCode",
  "originInterruptionPolicyCode",
  "originStepTickCount",
  "originProgressQ16",
  "originRequiredWorkQ16",
  "originCarriedDefId",
  "originCarriedAmount",
  "originAdoptionReservationVersion",
  "originAdoptionDriverVersion",
  "originAdoptionSlotVersion",
  "originLastMutationTick",
] as const;

function isExactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainObject(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  return true;
}

function isDenseArray(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) if (!(index in value)) return false;
  return true;
}

function isBinary(value: unknown): value is number {
  return value === 0 || value === 1;
}

function isByte(value: unknown): value is number {
  return isSafeUint32(value) && value <= 0xff;
}

function isTokenStateCode(value: unknown): value is number {
  return isSafeUint32(value) && value <= 3;
}

function isValidStatusCode(value: number): boolean {
  return value <= JOB_STATUS_CANCELED;
}
function isValidStepCode(value: number): boolean {
  return value <= JOB_STEP_COMPLETE;
}
function isValidPolicyCode(value: number): boolean {
  return value <= JOB_POLICY_EMERGENCY_ONLY;
}
function isValidFailureCode(value: number): boolean {
  return value <= JOB_FAILURE_CANCELLED;
}

function jobCoreSlotHashEntries(slot: JobCoreSlotSnapshot): readonly (readonly [string, number])[] {
  return [
    ["active", slot.active],
    ["ownerIndex", slot.ownerIndex],
    ["ownerGeneration", slot.ownerGeneration],
    ["jobKind", slot.jobKind],
    ["targetId", slot.targetId],
    ["statusCode", slot.statusCode],
    ["stepCode", slot.stepCode],
    ["policyCode", slot.interruptionPolicyCode],
    ["failureCode", slot.failureReasonCode],
    ["createdTick", slot.createdTick],
    ["stepEnteredTick", slot.stepEnteredTick],
    ["stepTickCount", slot.stepTickCount],
    ["progressQ16", slot.progressQ16],
    ["requiredWorkQ16", slot.requiredWorkQ16],
    ["carriedDefId", slot.carriedDefId],
    ["carriedAmount", slot.carriedAmount],
    ["jobGeneration", slot.jobGeneration],
    ["slotGenerationCounter", slot.slotGenerationCounter],
    ["slotVersion", slot.slotVersion],
    ["autonomyState", slot.autonomyState],
    ["autonomyOriginState", slot.autonomyOriginState],
    ["originShadowPresent", slot.originShadowPresent],
    ["originJobGeneration", slot.originJobGeneration],
    ["originOwnerIndex", slot.originOwnerIndex],
    ["originOwnerGeneration", slot.originOwnerGeneration],
    ["originJobKind", slot.originJobKind],
    ["originTargetId", slot.originTargetId],
    ["originStatusCode", slot.originStatusCode],
    ["originFailureCode", slot.originFailureReasonCode],
    ["originCreatedTick", slot.originCreatedTick],
    ["originTerminalTick", slot.originTerminalTick],
    ["originEffectPhase", slot.originEffectPhase],
    ["terminalEffectPhase", slot.terminalEffectPhase],
    ["adoptionReservationVersion", slot.adoptionReservationVersion],
    ["adoptionDriverVersion", slot.adoptionDriverVersion],
    ["adoptionSlotVersion", slot.adoptionSlotVersion],
    ["lastMutationTick", slot.lastMutationTick],
    ["originStepCode", slot.originStepCode],
    ["originPolicyCode", slot.originInterruptionPolicyCode],
    ["originStepTickCount", slot.originStepTickCount],
    ["originProgressQ16", slot.originProgressQ16],
    ["originRequiredWorkQ16", slot.originRequiredWorkQ16],
    ["originCarriedDefId", slot.originCarriedDefId],
    ["originCarriedAmount", slot.originCarriedAmount],
    ["originAdoptionReservationVersion", slot.originAdoptionReservationVersion],
    ["originAdoptionDriverVersion", slot.originAdoptionDriverVersion],
    ["originAdoptionSlotVersion", slot.originAdoptionSlotVersion],
    ["originLastMutationTick", slot.originLastMutationTick],
  ];
}

function isValidAutonomyTerminal(
  status: AutonomyTerminalPrepareInput["status"],
  reason: JobFailureReason,
): boolean {
  if (status === "completed") return reason === "none";
  if (status === "canceled") return reason === "cancelled";
  return reason !== "none" && reason !== "cancelled";
}

function resetPreparedAutonomyTerminal(
  output: PreparedAutonomyTerminal,
  storeVersion: number,
): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.expectedSlotVersion = 0;
  output.expectedJobCoreVersion = storeVersion;
  output.tick = 0;
  output.statusCode = JOB_STATUS_INACTIVE;
  output.failureReasonCode = JOB_FAILURE_NONE;
  output.effectPhase = 0;
  output.nextSlotVersion = 0;
  output.nextJobCoreVersion = storeVersion;
}

function resetAutonomyMutationOutput(
  output: AutonomyJobMutationIntoOutput,
  storeVersion: number,
): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.slotVersion = 0;
  output.version = storeVersion;
  output.progressQ16 = 0;
  output.readyToComplete = false;
}

function resetPreparedAutonomyCarriedStep(output: PreparedAutonomyCarriedStep): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.defId = JOB_NONE;
  output.amount = 0;
  output.stepCode = JOB_STEP_UNASSIGNED;
  output.tick = 0;
  output.nextSlotVersion = 0;
  output.nextJobCoreVersion = 0;
}

function resetPreparedAutonomyProgress(
  output: PreparedAutonomyProgress,
  storeVersion: number,
): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.tick = 0;
  output.workDeltaQ16 = 0;
  output.nextStepTickCount = 0;
  output.nextProgressQ16 = 0;
  output.readyToComplete = false;
  output.nextSlotVersion = 0;
  output.nextJobCoreVersion = storeVersion;
}

function encodeStatus(status: JobStatus): number {
  if (status === "ready") {
    return JOB_STATUS_READY;
  }

  if (status === "running") {
    return JOB_STATUS_RUNNING;
  }

  if (status === "completed") {
    return JOB_STATUS_COMPLETED;
  }

  if (status === "failed") {
    return JOB_STATUS_FAILED;
  }

  return JOB_STATUS_CANCELED;
}

function decodeStatus(code: number): JobStatus {
  if (code === JOB_STATUS_READY) {
    return "ready";
  }

  if (code === JOB_STATUS_RUNNING) {
    return "running";
  }

  if (code === JOB_STATUS_COMPLETED) {
    return "completed";
  }

  if (code === JOB_STATUS_FAILED) {
    return "failed";
  }

  return "canceled";
}

function isJobStatus(value: unknown): value is JobStatus {
  return (
    value === "ready" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "canceled"
  );
}

function encodeStep(step: JobDriverStep): number {
  if (step === "reserve") {
    return JOB_STEP_RESERVE;
  }

  if (step === "path_to_source") {
    return JOB_STEP_PATH_TO_SOURCE;
  }

  if (step === "interact") {
    return JOB_STEP_INTERACT;
  }

  if (step === "complete") {
    return JOB_STEP_COMPLETE;
  }

  return JOB_STEP_UNASSIGNED;
}

function decodeStep(code: number): JobDriverStep {
  if (code === JOB_STEP_RESERVE) {
    return "reserve";
  }

  if (code === JOB_STEP_PATH_TO_SOURCE) {
    return "path_to_source";
  }

  if (code === JOB_STEP_INTERACT) {
    return "interact";
  }

  if (code === JOB_STEP_COMPLETE) {
    return "complete";
  }

  return "unassigned";
}

function isJobStep(value: unknown): value is JobDriverStep {
  return (
    value === "unassigned" ||
    value === "reserve" ||
    value === "path_to_source" ||
    value === "interact" ||
    value === "complete"
  );
}

function encodePolicy(policy: JobInterruptionPolicy): number {
  if (policy === "at_safe_point") {
    return JOB_POLICY_AT_SAFE_POINT;
  }

  if (policy === "immediate") {
    return JOB_POLICY_IMMEDIATE;
  }

  if (policy === "emergency_only") {
    return JOB_POLICY_EMERGENCY_ONLY;
  }

  return JOB_POLICY_NEVER;
}

function decodePolicy(code: number): JobInterruptionPolicy {
  if (code === JOB_POLICY_AT_SAFE_POINT) {
    return "at_safe_point";
  }

  if (code === JOB_POLICY_IMMEDIATE) {
    return "immediate";
  }

  if (code === JOB_POLICY_EMERGENCY_ONLY) {
    return "emergency_only";
  }

  return "never";
}

function isJobInterruptionPolicy(value: unknown): value is JobInterruptionPolicy {
  return (
    value === "never" ||
    value === "at_safe_point" ||
    value === "immediate" ||
    value === "emergency_only"
  );
}

function encodeInterruptionKind(kind: JobInterruptionKind): number {
  if (kind === "immediate") {
    return JOB_INTERRUPT_IMMEDIATE;
  }

  if (kind === "emergency") {
    return JOB_INTERRUPT_EMERGENCY;
  }

  return JOB_INTERRUPT_SAFE_POINT;
}

function encodeFailureReason(reason: JobFailureReason): number {
  if (reason === "permission") {
    return JOB_FAILURE_PERMISSION;
  }

  if (reason === "material") {
    return JOB_FAILURE_MATERIAL;
  }

  if (reason === "reservation") {
    return JOB_FAILURE_RESERVATION;
  }

  if (reason === "path") {
    return JOB_FAILURE_PATH;
  }

  if (reason === "risk") {
    return JOB_FAILURE_RISK;
  }

  if (reason === "time") {
    return JOB_FAILURE_TIME;
  }

  if (reason === "target_state") {
    return JOB_FAILURE_TARGET_STATE;
  }

  if (reason === "cancelled") {
    return JOB_FAILURE_CANCELLED;
  }

  return JOB_FAILURE_NONE;
}

function decodeFailureReason(code: number): JobFailureReason {
  if (code === JOB_FAILURE_PERMISSION) {
    return "permission";
  }

  if (code === JOB_FAILURE_MATERIAL) {
    return "material";
  }

  if (code === JOB_FAILURE_RESERVATION) {
    return "reservation";
  }

  if (code === JOB_FAILURE_PATH) {
    return "path";
  }

  if (code === JOB_FAILURE_RISK) {
    return "risk";
  }

  if (code === JOB_FAILURE_TIME) {
    return "time";
  }

  if (code === JOB_FAILURE_TARGET_STATE) {
    return "target_state";
  }

  if (code === JOB_FAILURE_CANCELLED) {
    return "cancelled";
  }

  return "none";
}

function isJobFailureReason(value: unknown): value is JobFailureReason {
  return (
    value === "none" ||
    value === "permission" ||
    value === "material" ||
    value === "reservation" ||
    value === "path" ||
    value === "risk" ||
    value === "time" ||
    value === "target_state" ||
    value === "cancelled"
  );
}

function isIndexInRange(value: unknown, upperBound: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < upperBound
  );
}

function isSafeUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff
  );
}

function isSafeTickValue(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampUint32(value: number): number {
  return Math.min(0xffff_ffff, value);
}

function decodeTokenState(code: number): JobTokenState {
  if (code === 1) return "reserved";
  if (code === 2) return "running";
  if (code === 3) return "tombstone";
  return "free";
}

function resetJobInto(
  output: JobIntoOutput,
  version: number,
  activeCount: number,
  runningCount: number,
  reservedCount: number,
  currentTombstoneCount: number,
  cumulativeTerminalCount: number,
): void {
  output.ok = false;
  output.found = false;
  output.reason = undefined;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.jobKind = 0;
  output.targetId = 0;
  output.status = undefined;
  output.step = "unassigned";
  output.interruptionPolicy = "never";
  output.failureReason = "none";
  output.createdTick = 0;
  output.stepEnteredTick = 0;
  output.stepTickCount = 0;
  output.progressQ16 = 0;
  output.requiredWorkQ16 = 0;
  output.carriedDefId = JOB_NONE;
  output.carriedAmount = 0;
  output.slotVersion = 0;
  output.version = version;
  output.activeCount = activeCount;
  output.runningCount = runningCount;
  output.reservedCount = reservedCount;
  output.currentTombstoneCount = currentTombstoneCount;
  output.cumulativeTerminalCount = cumulativeTerminalCount;
  output.backlogCount = 0;
}

function resetCommittedJobInto(
  output: AutonomyCommittedJobIntoOutput,
  version: number,
  activeCount: number,
  runningCount: number,
  reservedCount: number,
  currentTombstoneCount: number,
  cumulativeTerminalCount: number,
): void {
  resetJobInto(
    output,
    version,
    activeCount,
    runningCount,
    reservedCount,
    currentTombstoneCount,
    cumulativeTerminalCount,
  );
  output.state = "free";
  output.terminalEffectPhase = 0;
  output.lastMutationTick = 0;
}
