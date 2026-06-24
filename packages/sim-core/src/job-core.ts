import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import { type CanonicalWorldField } from "./world-hash";
import type { ReservationLedger } from "./reservation-ledger";

export const JOB_CORE_SNAPSHOT_VERSION = 1;
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
  | "job_snapshot_version_unsupported"
  | "job_snapshot_shape_invalid"
  | "job_snapshot_record_invalid";

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

export interface JobCoreSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
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

interface JobCoreSnapshotCandidate {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly records: readonly unknown[];
}

type JobSnapshotShapeResult =
  | {
      readonly ok: true;
      readonly snapshot: JobCoreSnapshotCandidate;
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

  private readonly active: Uint8Array;
  private readonly ownerIndex: Uint32Array;
  private readonly ownerGeneration: Uint32Array;
  private readonly jobKind: Uint32Array;
  private readonly targetId: Uint32Array;
  private readonly statusCode: Uint8Array;
  private readonly stepCode: Uint8Array;
  private readonly interruptionPolicyCode: Uint8Array;
  private readonly failureReasonCode: Uint8Array;
  private readonly createdTick: Uint32Array;
  private readonly stepEnteredTick: Uint32Array;
  private readonly stepTickCount: Uint32Array;
  private readonly progressQ16: Uint32Array;
  private readonly requiredWorkQ16: Uint32Array;
  private readonly carriedDefId: Uint32Array;
  private readonly carriedAmount: Uint32Array;
  private activeCount = 0;
  private terminalCount = 0;
  private storeVersion = 0;

  constructor(options: JobCoreStoreOptions) {
    assertValidCapacity(options.capacity, "job core capacity");
    this.capacity = options.capacity;
    this.active = new Uint8Array(options.capacity);
    this.ownerIndex = new Uint32Array(options.capacity);
    this.ownerGeneration = new Uint32Array(options.capacity);
    this.jobKind = new Uint32Array(options.capacity);
    this.targetId = new Uint32Array(options.capacity);
    this.statusCode = new Uint8Array(options.capacity);
    this.stepCode = new Uint8Array(options.capacity);
    this.interruptionPolicyCode = new Uint8Array(options.capacity);
    this.failureReasonCode = new Uint8Array(options.capacity);
    this.createdTick = new Uint32Array(options.capacity);
    this.stepEnteredTick = new Uint32Array(options.capacity);
    this.stepTickCount = new Uint32Array(options.capacity);
    this.progressQ16 = new Uint32Array(options.capacity);
    this.requiredWorkQ16 = new Uint32Array(options.capacity);
    this.carriedDefId = new Uint32Array(options.capacity);
    this.carriedAmount = new Uint32Array(options.capacity);
    this.carriedDefId.fill(JOB_NONE);
  }

  get activeJobCount(): number {
    return this.activeCount;
  }

  get version(): number {
    return this.storeVersion;
  }

  createJob(input: JobCreateInput, registry?: EntityRegistry): JobCoreMutationResult {
    const validation = this.validateCreateInput(input, registry);

    if (!validation.ok) {
      return validation;
    }

    if (this.active[input.jobId] === 1) {
      return { ok: false, reason: "job_already_active" };
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
    this.activeCount += 1;
    return this.finishMutation(input.jobId);
  }

  enterStep(jobId: number, step: JobDriverStep, tick: number): JobCoreMutationResult {
    const validation = this.validateActiveJob(jobId);

    if (!validation.ok) {
      return validation;
    }

    if (!isSafeUint32(tick)) {
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

    if (!isSafeUint32(tick)) {
      return { ok: false, reason: "job_tick_invalid" };
    }

    if (!isSafeUint32(workDeltaQ16)) {
      return { ok: false, reason: "job_progress_invalid" };
    }

    this.stepTickCount[jobId] = (this.stepTickCount[jobId] ?? 0) + 1;
    this.progressQ16[jobId] = clampUint32((this.progressQ16[jobId] ?? 0) + workDeltaQ16);
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

    if (!isSafeUint32(tick)) {
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

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      if ((this.active[jobId] ?? 0) === 1) {
        records.push(this.createRecordView(jobId));
      }
    }

    return {
      snapshotVersion: JOB_CORE_SNAPSHOT_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      records,
    };
  }

  restoreFromSnapshot(snapshot: unknown, registry?: EntityRegistry): JobSnapshotResult {
    const shape = this.validateSnapshotShape(snapshot);
    if (!shape.ok) {
      return shape;
    }

    const scratch = createJobCoreStore({ capacity: this.capacity });
    const validated = scratch.restoreRecords(shape.snapshot, registry);

    if (!validated.ok) {
      return validated;
    }

    this.clearAll();
    const restored = this.restoreRecords(shape.snapshot, registry);

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

    if (!isSafeUint32(tick)) {
      return { ok: false, reason: "job_tick_invalid" };
    }

    this.statusCode[jobId] = statusCode;
    this.stepCode[jobId] = JOB_STEP_COMPLETE;
    this.failureReasonCode[jobId] = encodeFailureReason(reason);
    this.stepEnteredTick[jobId] = tick;
    const cleanup = this.cleanupJob(jobId, reservationLedger);
    this.terminalCount += 1;
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

    if (reservationLedger !== undefined) {
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

  private restoreRecords(
    snapshot: JobCoreSnapshotCandidate,
    registry: EntityRegistry | undefined,
  ): JobSnapshotResult {
    let lastJobId = -1;

    for (const candidate of snapshot.records) {
      if (!this.isValidSnapshotRecord(candidate)) {
        return { ok: false, reason: "job_snapshot_record_invalid" };
      }

      const record = candidate;
      if (record.jobId <= lastJobId) {
        return { ok: false, reason: "job_snapshot_record_invalid" };
      }

      const created = this.createJob(
        {
          jobId: record.jobId,
          owner: record.owner,
          jobKind: record.jobKind,
          targetId: record.targetId,
          initialStep: record.step,
          interruptionPolicy: record.interruptionPolicy,
          requiredWorkQ16: record.requiredWorkQ16,
          createdTick: record.createdTick,
        },
        registry,
      );

      if (!created.ok) {
        return { ok: false, reason: "job_snapshot_record_invalid" };
      }

      this.statusCode[record.jobId] = encodeStatus(record.status);
      this.stepCode[record.jobId] = encodeStep(record.step);
      this.failureReasonCode[record.jobId] = encodeFailureReason(record.failureReason);
      this.stepEnteredTick[record.jobId] = record.stepEnteredTick;
      this.stepTickCount[record.jobId] = record.stepTickCount;
      this.progressQ16[record.jobId] = record.progressQ16;
      this.carriedDefId[record.jobId] = record.carriedDefId;
      this.carriedAmount[record.jobId] = record.carriedAmount;

      if (isTerminalStatus(this.statusCode[record.jobId] ?? JOB_STATUS_INACTIVE)) {
        this.terminalCount += 1;
      }

      lastJobId = record.jobId;
    }

    this.storeVersion = snapshot.storeVersion;
    return {
      ok: true,
      version: this.storeVersion,
      activeCount: this.activeCount,
    };
  }

  private validateCreateInput(
    input: JobCreateInput,
    registry: EntityRegistry | undefined,
  ): JobCoreMutationResult {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "job_id_out_of_range" };
    }

    if (!isSafeUint32(input.owner.index) || !isSafeUint32(input.owner.generation)) {
      return { ok: false, reason: "job_owner_invalid" };
    }

    if (registry !== undefined && !registry.isAlive(input.owner)) {
      return { ok: false, reason: "job_owner_invalid" };
    }

    if (!isSafeUint32(input.jobKind)) {
      return { ok: false, reason: "job_kind_invalid" };
    }

    if (!isSafeUint32(input.targetId) || input.targetId >= JOB_NONE) {
      return { ok: false, reason: "job_target_invalid" };
    }

    if (encodeStep(input.initialStep) === JOB_STEP_UNASSIGNED) {
      return { ok: false, reason: "job_step_invalid" };
    }

    if (!isSafeUint32(input.requiredWorkQ16) || !isSafeUint32(input.createdTick)) {
      return { ok: false, reason: "job_progress_invalid" };
    }

    return { ok: true, jobId: input.jobId, version: this.storeVersion };
  }

  private validateActiveJob(jobId: number): JobCoreMutationResult {
    if (!isIndexInRange(jobId, this.capacity)) {
      return { ok: false, reason: "job_id_out_of_range" };
    }

    if ((this.active[jobId] ?? 0) !== 1) {
      return { ok: false, reason: "job_not_active" };
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

    const capacity = snapshot["capacity"];
    const storeVersion = snapshot["storeVersion"];
    const activeCount = snapshot["activeCount"];
    const records = snapshot["records"];

    if (
      !isSafeUint32(capacity) ||
      capacity !== this.capacity ||
      !isSafeUint32(storeVersion) ||
      !isSafeUint32(activeCount) ||
      activeCount > this.capacity ||
      !Array.isArray(records) ||
      records.length !== activeCount
    ) {
      return { ok: false, reason: "job_snapshot_shape_invalid" };
    }

    return {
      ok: true,
      snapshot: {
        snapshotVersion,
        capacity,
        storeVersion,
        activeCount,
        records,
      },
    };
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
      isSafeUint32(createdTick) &&
      isSafeUint32(stepEnteredTick) &&
      isSafeUint32(stepTickCount) &&
      isSafeUint32(progressQ16) &&
      isSafeUint32(requiredWorkQ16) &&
      isSafeUint32(carriedDefId) &&
      isSafeUint32(carriedAmount)
    );
  }

  private isActiveJobId(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.active[jobId] ?? 0) === 1;
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

  private finishMutation(jobId: number): JobCoreMutationResult {
    return { ok: true, jobId, version: this.bumpVersion() };
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
    this.activeCount = 0;
    this.terminalCount = 0;
    this.storeVersion = 0;
  }
}

export function createJobCoreStore(options: JobCoreStoreOptions): JobCoreStore {
  return new JobCoreStore(options);
}

export function restoreJobCoreStore(
  snapshot: JobCoreSnapshotInput,
  registry?: EntityRegistry,
): JobCoreStore {
  const store = createJobCoreStore({ capacity: snapshot.capacity });
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
    { name: `${prefix}.storeVersion`, value: snapshot.storeVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
    { name: `${prefix}.recordCount`, value: snapshot.records.length },
  ];

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

function isTerminalStatus(statusCode: number): boolean {
  return (
    statusCode === JOB_STATUS_COMPLETED ||
    statusCode === JOB_STATUS_FAILED ||
    statusCode === JOB_STATUS_CANCELED
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampUint32(value: number): number {
  return Math.min(0xffff_ffff, value);
}
