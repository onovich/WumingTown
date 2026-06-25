import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import { type ItemStackStore } from "./item-stack-store";
import { type JobCoreStore, type JobFailureReason, type JobInterruptionKind } from "./job-core";
import {
  M3_HEALTH_CONDITION_RECOVERING,
  M3_HEALTH_CONDITION_RESOLVED,
  type M3AbilityCacheStore,
  type M3HealthConditionStore,
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
import type { ReservationLedger, ReservationReason } from "./reservation-ledger";

export const M3_TREATMENT_JOB_KIND = 53;
export const M3_TREATMENT_SNAPSHOT_VERSION = 1;

const TREATMENT_STEP_CREATED = 1;
const TREATMENT_STEP_RESERVED = 2;
const TREATMENT_STEP_PATHING = 3;
const TREATMENT_STEP_TREATING = 4;
const TREATMENT_STEP_COMPLETED = 5;
const TREATMENT_STEP_CANCELED = 6;
const TREATMENT_STEP_FAILED = 7;

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
  | "medical.rejected_no_stock"
  | "medical.rejected_stale_owner_state"
  | "medical.rejected_invalid_condition"
  | "medical.rejected_caregiver_ability"
  | "path.no_route_to_patient"
  | "path.stale_basis"
  | ReservationReason
  | M3MedicalReason;

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

export interface M3TreatmentMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly treatingCount: number;
  readonly completedCount: number;
  readonly canceledCount: number;
  readonly failedCount: number;
  readonly conditionDeltaCount: number;
  readonly stockConsumedCount: number;
  readonly reservationCleanupCount: number;
  readonly pathFailureCount: number;
  readonly staleBasisRejectCount: number;
}

export type M3TreatmentJobSnapshot = M3TreatmentJobView;

export interface M3TreatmentStoreSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly conditionDeltaCount: number;
  readonly stockConsumedCount: number;
  readonly reservationCleanupCount: number;
  readonly pathFailureCount: number;
  readonly staleBasisRejectCount: number;
  readonly records: readonly M3TreatmentJobSnapshot[];
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
  private readonly createdTicks: Uint32Array;
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
  private readonly reservationVersions: Uint32Array;
  private readonly progressQ16: Uint32Array;
  private readonly deltaApplied: Uint8Array;
  private readonly stepCodes: Uint8Array;
  private readonly terminalReasons: Uint16Array;
  private activeCount = 0;
  private storeVersion = 0;
  private conditionDeltaCount = 0;
  private stockConsumedCount = 0;
  private cleanupCount = 0;
  private pathFailureCount = 0;
  private staleRejectCount = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "M3 treatment job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.caregiverIndexes = new Uint32Array(capacity);
    this.caregiverGenerations = new Uint32Array(capacity);
    this.caregiverActorIds = new Uint32Array(capacity);
    this.requestIds = new Uint32Array(capacity);
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
    this.createdTicks = new Uint32Array(capacity);
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
    this.reservationVersions = new Uint32Array(capacity);
    this.progressQ16 = new Uint32Array(capacity);
    this.deltaApplied = new Uint8Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.terminalReasons = new Uint16Array(capacity);
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
      this.setTerminalFailure(jobId, "medical.job_core_failed");
      return { ok: false, reason: "medical.job_core_failed" };
    }
    this.reservationVersions[jobId] = ledger.version;
    this.stepCodes[jobId] = TREATMENT_STEP_RESERVED;
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
    if (!ticked.readyToComplete) {
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
    this.stepCodes[jobId] = TREATMENT_STEP_CANCELED;
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
    this.stepCodes[jobId] = TREATMENT_STEP_CANCELED;
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
    this.stepCodes[jobId] = TREATMENT_STEP_FAILED;
    this.terminalReasons[jobId] = encodeReason("medical.rejected_invalid_condition");
    return this.finish(jobId, "medical.rejected_invalid_condition");
  }

  readJob(jobId: number): M3TreatmentJobView | undefined {
    if (!this.isActive(jobId)) {
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
    let reservedCount = 0;
    let treatingCount = 0;
    let completedCount = 0;
    let canceledCount = 0;
    let failedCount = 0;
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      if ((this.active[jobId] ?? 0) === 1) {
        const step = this.stepCodes[jobId] ?? 0;
        reservedCount += step === TREATMENT_STEP_RESERVED ? 1 : 0;
        treatingCount += step === TREATMENT_STEP_TREATING ? 1 : 0;
        completedCount += step === TREATMENT_STEP_COMPLETED ? 1 : 0;
        canceledCount += step === TREATMENT_STEP_CANCELED ? 1 : 0;
        failedCount += step === TREATMENT_STEP_FAILED ? 1 : 0;
      }
    }
    return {
      version: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount,
      treatingCount,
      completedCount,
      canceledCount,
      failedCount,
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
    this.stepCodes[jobId] = TREATMENT_STEP_COMPLETED;
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
    const records: M3TreatmentJobSnapshot[] = [];
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const record = this.readJob(jobId);
      if (record !== undefined) {
        records.push(record);
      }
    }
    return {
      snapshotVersion: M3_TREATMENT_SNAPSHOT_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      conditionDeltaCount: this.conditionDeltaCount,
      stockConsumedCount: this.stockConsumedCount,
      reservationCleanupCount: this.cleanupCount,
      pathFailureCount: this.pathFailureCount,
      staleBasisRejectCount: this.staleRejectCount,
      records,
    };
  }

  restoreFromSnapshot(snapshot: M3TreatmentStoreSnapshotInput): M3TreatmentRestoreResult {
    if (snapshot.snapshotVersion !== M3_TREATMENT_SNAPSHOT_VERSION) {
      return { ok: false, reason: "medical.snapshot_version_unsupported" };
    }
    if (
      snapshot.capacity !== this.capacity ||
      snapshot.activeCount !== snapshot.records.length ||
      !isNonNegativeSafeInteger(snapshot.storeVersion)
    ) {
      return { ok: false, reason: "medical.snapshot_shape_invalid" };
    }
    this.clearAll();
    this.storeVersion = snapshot.storeVersion;
    this.conditionDeltaCount = snapshot.conditionDeltaCount;
    this.stockConsumedCount = snapshot.stockConsumedCount;
    this.cleanupCount = snapshot.reservationCleanupCount;
    this.pathFailureCount = snapshot.pathFailureCount;
    this.staleRejectCount = snapshot.staleBasisRejectCount;
    for (const record of snapshot.records) {
      if (!this.restoreRecord(record)) {
        this.clearAll();
        return { ok: false, reason: "medical.snapshot_record_invalid" };
      }
    }
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
    this.setTerminalFailure(jobId, reason);
    return this.finish(jobId, reason);
  }

  private setTerminalFailure(jobId: number, reason: M3TreatmentReason): void {
    this.stepCodes[jobId] = TREATMENT_STEP_FAILED;
    this.terminalReasons[jobId] = encodeReason(reason);
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

  private restoreRecord(record: M3TreatmentJobSnapshot): boolean {
    if (
      !isIndexInRange(record.jobId, this.capacity) ||
      this.active[record.jobId] === 1 ||
      !isNonNegativeSafeInteger(record.createdTick) ||
      !isNonNegativeSafeInteger(record.progressQ16)
    ) {
      return false;
    }
    const stepCode = encodeStep(record.step);
    if (stepCode === 0) {
      return false;
    }
    this.active[record.jobId] = 1;
    this.caregiverIndexes[record.jobId] = record.caregiver.index;
    this.caregiverGenerations[record.jobId] = record.caregiver.generation;
    this.caregiverActorIds[record.jobId] = record.caregiverActorId;
    this.requestIds[record.jobId] = record.requestId;
    this.stockStackIds[record.jobId] = record.stockStackId;
    this.patientTargetIndexes[record.jobId] = record.patientInteractionTarget.index;
    this.patientTargetGenerations[record.jobId] = record.patientInteractionTarget.generation;
    this.patientInteractionSpotIds[record.jobId] = record.patientInteractionSpotId;
    this.treatmentCellIndexes[record.jobId] = record.treatmentCellIndex;
    this.abilities[record.jobId] = record.ability;
    this.minimumAbilityValues[record.jobId] = record.minimumAbilityValue;
    this.treatmentTicks[record.jobId] = record.treatmentTicks;
    this.workPerTickQ16[record.jobId] = record.workPerTickQ16;
    this.severityDeltas[record.jobId] = record.severityDelta;
    this.createdTicks[record.jobId] = record.createdTick;
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
    this.reservationVersions[record.jobId] = record.reservationVersion;
    this.progressQ16[record.jobId] = record.progressQ16;
    this.deltaApplied[record.jobId] = record.deltaApplied ? 1 : 0;
    this.stepCodes[record.jobId] = stepCode;
    this.terminalReasons[record.jobId] = encodeReason(record.terminalReason);
    this.activeCount += 1;
    return true;
  }

  private clearAll(): void {
    this.active.fill(0);
    this.caregiverIndexes.fill(0);
    this.caregiverGenerations.fill(0);
    this.caregiverActorIds.fill(0);
    this.requestIds.fill(0);
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
    this.reservationVersions.fill(0);
    this.progressQ16.fill(0);
    this.deltaApplied.fill(0);
    this.stepCodes.fill(0);
    this.terminalReasons.fill(0);
    this.activeCount = 0;
    this.storeVersion = 0;
    this.conditionDeltaCount = 0;
    this.stockConsumedCount = 0;
    this.cleanupCount = 0;
    this.pathFailureCount = 0;
    this.staleRejectCount = 0;
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

function encodeStep(step: M3TreatmentStep): number {
  if (step === "created") {
    return TREATMENT_STEP_CREATED;
  }
  if (step === "reserved") {
    return TREATMENT_STEP_RESERVED;
  }
  if (step === "pathing_to_patient") {
    return TREATMENT_STEP_PATHING;
  }
  if (step === "treating") {
    return TREATMENT_STEP_TREATING;
  }
  if (step === "completed") {
    return TREATMENT_STEP_COMPLETED;
  }
  if (step === "canceled") {
    return TREATMENT_STEP_CANCELED;
  }
  if (step === "failed") {
    return TREATMENT_STEP_FAILED;
  }
  return 0;
}

function encodeReason(reason: M3TreatmentReason): number {
  switch (reason) {
    case "medical.treatment_created":
      return 0;
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

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSeverity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}
