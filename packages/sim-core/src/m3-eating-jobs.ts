import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import {
  JOB_NONE,
  commitPreparedAutonomyCarriedStep,
  commitPreparedAutonomyTerminal,
  type JobCoreStore,
  type JobCoreReason,
  type JobFailureReason,
  type JobInterruptionKind,
  type AutonomyCommittedJobIntoOutput,
  type JobTokenIntoOutput,
  type PreparedAutonomyCarriedStep,
  type PreparedAutonomyTerminal,
} from "./job-core";
import {
  isExactAdoptionClaimPrefix,
  releaseStoredAutonomyClaimsInto,
  resetDriverAdoptionOutput,
  type DriverAdoptionOutput,
  type ExistingClaimsAdoptionControl,
  type NewlyAdoptedRollbackControl,
} from "./autonomy-claim-facts";
import {
  commitPreparedItemStackQuantityAddition,
  commitPreparedItemStackQuantityRemoval,
  type ItemStackIntoOutput,
  type ItemStackReason,
  type ItemStackQuantityAdditionPrepareInput,
  type ItemStackQuantityRemovalPrepareInput,
  type ItemStackReadScratch,
  type ItemStackStore,
  type PreparedItemStackQuantityRemoval,
} from "./item-stack-store";
import {
  NEED_LANE_HUNGER,
  commitPreparedChangedNeedLaneMutation,
  type NeedDirtySink,
  type NeedLaneMutationPrepareInput,
  type NeedReason,
  type NeedStore,
  type PreparedNeedLaneMutation,
} from "./m3-needs";
import {
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  type ReservationClaimsIntoOutput,
  type ReservationLedger,
  type ReservationReason,
  type ReservationReleaseIntoOutput,
} from "./reservation-ledger";
import type { StorageLogisticsIndex } from "./storage-logistics-index";
import { isSafeTick, type Tick } from "./time";
import type { M3FoodAvailabilityStore, M3FoodPortionView } from "./m3-food";
import type { CanonicalWorldField } from "./world-hash";

export const M3_EATING_JOB_KIND = 3;
export const M3_EATING_JOB_SNAPSHOT_VERSION = 2;

const EATING_STEP_UNASSIGNED = 0;
const EATING_STEP_CREATED = 1;
const EATING_STEP_RESERVED = 2;
const EATING_STEP_PICKED_UP = 3;
const EATING_STEP_CONSUMED = 4;
const EATING_STEP_CANCELED = 5;
const EATING_STEP_FAILED = 6;
const NEED_DELTA_MAX = 0x7fff_ffff;

export type M3EatingStep =
  | "unassigned"
  | "created"
  | "reserved"
  | "picked_up"
  | "consumed"
  | "canceled"
  | "failed";

export type M3EatingReason =
  | "food.job_created"
  | "food.job_reserved"
  | "food.job_picked_up"
  | "food.consumed_integer_portion"
  | "food.job_canceled"
  | "food.job_failed"
  | "eating_job_id_out_of_range"
  | "eating_job_already_active"
  | "eating_job_not_active"
  | "eating_owner_invalid"
  | "eating_stack_invalid"
  | "eating_amount_invalid"
  | "eating_need_delta_invalid"
  | "eating_tick_invalid"
  | "eating_step_invalid"
  | "eating_item_mutation_failed"
  | "eating_need_mutation_failed"
  | "eating_job_core_failed"
  | "eating_version_exhausted"
  | "food.rejected_no_available_portion"
  | "food.rejected_permission"
  | "food.rejected_schedule"
  | "food.rejected_ability"
  | "food.rejected_stale_owner"
  | "reservation.item_quantity_conflict"
  | "reservation.interaction_spot_conflict"
  | "reservation.insufficient_amount"
  | "reservation.failed";

export type M3EatingMutationResult =
  | {
      readonly ok: true;
      readonly jobId: number;
      readonly version: number;
      readonly reason: M3EatingReason;
    }
  | { readonly ok: false; readonly reason: M3EatingReason };

export interface M3EatingJobCreateInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly sourceStackId: number;
  readonly storageSlotId: number;
  readonly foodDefId: number;
  readonly amount: number;
  readonly hungerRestore: number;
  readonly itemStoreVersion: number;
  readonly foodAvailabilityVersion: number;
  readonly mealWindowVersion: number;
  readonly abilityAllowed: boolean;
  readonly createdTick: Tick;
}

export interface M3EatingJobView extends M3EatingJobCreateInput {
  readonly step: M3EatingStep;
  readonly carriedDefId: number;
  readonly carriedAmount: number;
  readonly consumedDefId: number;
  readonly consumedAmount: number;
  readonly terminalReason: M3EatingReason;
}

export interface M3EatingClaimAdoptionInput extends M3EatingJobCreateInput {
  readonly itemEntity: EntityId;
  readonly interactionSpotId: number;
  readonly readClaimIds: Uint32Array;
  readonly readClaimEpochs: Uint32Array;
  readonly claims: ReservationClaimsIntoOutput;
}

export interface M3EatingClaimAdoptionOutput extends DriverAdoptionOutput {
  ownerIndex: number;
  ownerGeneration: number;
  jobCoreReservedCount: number;
  jobCoreActiveCount: number;
  jobCoreRunningCount: number;
  jobCoreCurrentTombstoneCount: number;
  jobCoreCumulativeTerminalCount: number;
  driverReservedCount: number;
  driverPickedUpCount: number;
  driverConsumedCount: number;
  driverCanceledCount: number;
  driverFailedCount: number;
  driverInterruptedCount: number;
  currentInterruptedJobs: number;
  reservationAttemptCount: number;
  reservationFailureCount: number;
  cumulativeConsumedCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  cumulativeInterruptedCount: number;
  consumedAmountTotal: number;
}

export interface M3EatingAdoptedPickupInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly expectedCurrentLedgerVersion: number;
  readonly tick: Tick;
  readonly itemRemoval: ItemStackQuantityRemovalPrepareInput;
}

export interface M3EatingAdoptedConsumeInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly expectedCurrentLedgerVersion: number;
  readonly tick: Tick;
  readonly needMutation: NeedLaneMutationPrepareInput;
}

export type M3EatingAdoptedTerminalOutcome = "canceled" | "failed" | "interrupted";

export interface M3EatingAdoptedTerminalInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly expectedCurrentLedgerVersion: number;
  readonly tick: Tick;
  readonly outcome: M3EatingAdoptedTerminalOutcome;
  readonly failureReason: JobFailureReason;
  readonly interruptionKind?: JobInterruptionKind;
  readonly itemAddition: ItemStackQuantityAdditionPrepareInput;
}

export interface M3EatingResumeCleanupInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly expectedCurrentLedgerVersion: number;
  readonly tick: Tick;
  readonly outcome: M3EatingAdoptedTerminalOutcome | "consumed";
  readonly failureReason: JobFailureReason;
  readonly interruptionKind?: JobInterruptionKind;
}

export interface M3EatingAdoptedMutationOutput {
  ok: boolean;
  reason:
    | M3EatingReason
    | ReservationReason
    | JobCoreReason
    | NeedReason
    | ItemStackReason
    | undefined;
  jobId: number;
  jobGeneration: number;
  jobSlotVersion: number;
  jobCoreVersion: number;
  driverVersion: number;
  reservationVersion: number;
  itemRowVersion: number;
  itemStoreVersion: number;
  needLaneVersion: number;
  needStoreVersion: number;
  cleanupPending: boolean;
  alreadyCommitted: boolean;
  releasedClaimCount: number;
  terminalOutcome: M3EatingAdoptedTerminalOutcome | "consumed" | undefined;
}

export interface M3EatingMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly pickedUpCount: number;
  readonly consumedCount: number;
  readonly canceledCount: number;
  readonly failedCount: number;
  readonly interruptedCount: number;
  readonly currentInterruptedJobs: number;
  readonly reservationAttemptCount: number;
  readonly reservationFailureCount: number;
  readonly consumedAmountTotal: number;
}

export interface M3EatingAdoptedJobIntoOutput {
  ok: boolean;
  reason: M3EatingReason | undefined;
  active: boolean;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  sourceStackId: number;
  storageSlotId: number;
  foodDefId: number;
  amount: number;
  hungerRestore: number;
  itemEntityIndex: number;
  itemEntityGeneration: number;
  interactionSpotId: number;
  itemStoreVersion: number;
  foodAvailabilityVersion: number;
  mealWindowVersion: number;
  abilityAllowed: boolean;
  readonly claimIds: Uint32Array;
  readonly claimEpochs: Uint32Array;
  readonly claimCreatedTicks: Float64Array;
  readonly claimLeaseExpiryTicks: Float64Array;
  createdTick: number;
  stepEnteredTick: number;
  step: M3EatingStep;
  carriedDefId: number;
  carriedAmount: number;
  consumedDefId: number;
  consumedAmount: number;
  jobSlotVersion: number;
  driverVersion: number;
  reservationVersion: number;
  effectPhase: number;
  cleanupPending: number;
  returnedOnce: number;
  pickupCommitted: boolean;
  lastEffectTick: number;
  pendingOutcome: M3EatingAdoptedTerminalOutcome | "consumed" | undefined;
  pendingFailure: JobFailureReason;
  pendingInterruption: JobInterruptionKind | undefined;
  terminalReason: M3EatingReason;
  activeCount: number;
  reservedCount: number;
  pickedUpCount: number;
  consumedCount: number;
  canceledCount: number;
  failedCount: number;
  interruptedCount: number;
  currentInterruptedJobs: number;
  reservationAttemptCount: number;
  reservationFailureCount: number;
  cumulativeConsumedCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  cumulativeInterruptedCount: number;
  consumedAmountTotal: number;
}

export interface M3EatingJobSnapshotRow {
  readonly jobId: number;
  readonly active: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly sourceStackId: number;
  readonly storageSlotId: number;
  readonly foodDefId: number;
  readonly amount: number;
  readonly hungerRestore: number;
  readonly itemEntityIndex: number;
  readonly itemEntityGeneration: number;
  readonly interactionSpotId: number;
  readonly itemStoreVersion: number;
  readonly foodAvailabilityVersion: number;
  readonly mealWindowVersion: number;
  readonly abilityAllowed: number;
  readonly createdTick: number;
  readonly stepEnteredTick: number;
  readonly jobGeneration: number;
  readonly jobSlotVersion: number;
  readonly claimIds: readonly number[];
  readonly claimEpochs: readonly number[];
  readonly claimCreatedTicks: readonly number[];
  readonly claimLeaseExpiryTicks: readonly number[];
  readonly reservationVersion: number;
  readonly effectPhase: number;
  readonly stepCode: number;
  readonly cleanupPending: number;
  readonly returnedOnce: number;
  readonly carriedDefId: number;
  readonly carriedAmount: number;
  readonly consumedDefId: number;
  readonly consumedAmount: number;
  readonly terminalReasonCode: number;
  readonly pickupOnce: number;
  readonly lastEffectTick: number;
  readonly pendingTerminalOutcome: number;
  readonly pendingTerminalFailure: number;
  readonly pendingInterruptionKind: number;
}

export interface M3EatingJobSnapshot {
  readonly snapshotVersion: typeof M3_EATING_JOB_SNAPSHOT_VERSION;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly reservationAttempts: number;
  readonly reservationFailures: number;
  readonly consumedAmountTotal: number;
  readonly cumulativeCanceledCount: number;
  readonly cumulativeConsumedCount: number;
  readonly cumulativeFailedCount: number;
  readonly cumulativeInterruptedCount: number;
  readonly rows: readonly M3EatingJobSnapshotRow[];
}

export type M3EatingRestoreResult =
  | { readonly ok: true; readonly version: number; readonly activeCount: number }
  | { readonly ok: false; readonly reason: "eating_snapshot_invalid" };

export class M3EatingJobDriverStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly ownerIndexes: Uint32Array;
  private readonly ownerGenerations: Uint32Array;
  private readonly sourceStackIds: Uint32Array;
  private readonly itemEntityIndexes: Uint32Array;
  private readonly itemEntityGenerations: Uint32Array;
  private readonly interactionSpotIds: Uint32Array;
  private readonly storageSlotIds: Uint32Array;
  private readonly foodDefIds: Uint32Array;
  private readonly amounts: Uint32Array;
  private readonly hungerRestores: Uint32Array;
  private readonly itemStoreVersions: Uint32Array;
  private readonly foodAvailabilityVersions: Uint32Array;
  private readonly mealWindowVersions: Uint32Array;
  private readonly abilityAllowedFlags: Uint8Array;
  private readonly createdTicks: Float64Array;
  private readonly stepEnteredTicks: Float64Array;
  private readonly jobGenerations: Uint32Array;
  private readonly jobSlotVersions: Uint32Array;
  private readonly claimIds: Uint32Array;
  private readonly claimEpochs: Uint32Array;
  private readonly claimCreatedTicks: Float64Array;
  private readonly claimLeaseExpiryTicks: Float64Array;
  private readonly reservationVersions: Uint32Array;
  private readonly effectPhases: Uint8Array;
  private readonly stepCodes: Uint8Array;
  private readonly carriedDefIds: Uint32Array;
  private readonly carriedAmounts: Uint32Array;
  private readonly consumedDefIds: Uint32Array;
  private readonly consumedAmounts: Uint32Array;
  private readonly terminalReasonCodes: Uint8Array;
  private activeCount = 0;
  private storeVersion = 0;
  private reservationAttempts = 0;
  private reservationFailures = 0;
  private consumedAmountTotal = 0;
  private readonly jobTokenOutput: JobTokenIntoOutput;
  private readonly releaseClaimIds: Uint32Array;
  private readonly releaseClaimEpochs: Uint32Array;
  private readonly releaseOutput: ReservationReleaseIntoOutput;
  private readonly pickupOnce: Uint8Array;
  private readonly lastEffectTicks: Float64Array;
  private readonly claimReadIds: Uint32Array;
  private readonly claimReadEpochs: Uint32Array;
  private readonly preparedPickupItem: PreparedItemStackQuantityRemoval;
  private readonly preparedPickupCore: PreparedAutonomyCarriedStep;
  private readonly preparedConsumeNeed: PreparedNeedLaneMutation;
  private readonly preparedTerminal: PreparedAutonomyTerminal;
  private readonly preparedReturnItem: PreparedItemStackQuantityRemoval;
  private readonly itemScratch: ItemStackIntoOutput;
  private readonly itemReadScratch: ItemStackReadScratch;
  private readonly pendingTerminalOutcomes: Uint8Array;
  private readonly pendingTerminalFailures: Uint8Array;
  private readonly pendingInterruptionKinds: Uint8Array;
  private readonly cleanupPendingFlags: Uint8Array;
  private readonly returnedOnceFlags: Uint8Array;
  private readonly committedJobOutput: AutonomyCommittedJobIntoOutput;
  private readonly releaseOwnerScratch: { index: number; generation: number };
  private cumulativeConsumedCount = 0;
  private cumulativeCanceledCount = 0;
  private cumulativeFailedCount = 0;
  private cumulativeInterruptedCount = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "m3 eating job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.ownerIndexes = new Uint32Array(capacity);
    this.ownerGenerations = new Uint32Array(capacity);
    this.sourceStackIds = new Uint32Array(capacity);
    this.itemEntityIndexes = new Uint32Array(capacity);
    this.itemEntityGenerations = new Uint32Array(capacity);
    this.interactionSpotIds = new Uint32Array(capacity);
    this.storageSlotIds = new Uint32Array(capacity);
    this.foodDefIds = new Uint32Array(capacity);
    this.amounts = new Uint32Array(capacity);
    this.hungerRestores = new Uint32Array(capacity);
    this.itemStoreVersions = new Uint32Array(capacity);
    this.foodAvailabilityVersions = new Uint32Array(capacity);
    this.mealWindowVersions = new Uint32Array(capacity);
    this.abilityAllowedFlags = new Uint8Array(capacity);
    this.createdTicks = new Float64Array(capacity);
    this.stepEnteredTicks = new Float64Array(capacity);
    this.jobGenerations = new Uint32Array(capacity);
    this.jobSlotVersions = new Uint32Array(capacity);
    this.claimIds = new Uint32Array(capacity * 2);
    this.claimEpochs = new Uint32Array(capacity * 2);
    this.claimCreatedTicks = new Float64Array(capacity * 2);
    this.claimLeaseExpiryTicks = new Float64Array(capacity * 2);
    this.claimIds.fill(JOB_NONE);
    this.reservationVersions = new Uint32Array(capacity);
    this.effectPhases = new Uint8Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.carriedDefIds = new Uint32Array(capacity);
    this.carriedAmounts = new Uint32Array(capacity);
    this.consumedDefIds = new Uint32Array(capacity);
    this.consumedAmounts = new Uint32Array(capacity);
    this.terminalReasonCodes = new Uint8Array(capacity);
    this.carriedDefIds.fill(JOB_NONE);
    this.consumedDefIds.fill(JOB_NONE);
    this.jobTokenOutput = createJobTokenOutput();
    this.releaseClaimIds = new Uint32Array(8);
    this.releaseClaimIds.fill(JOB_NONE);
    this.releaseClaimEpochs = new Uint32Array(8);
    this.releaseOutput = createReleaseOutput();
    this.pickupOnce = new Uint8Array(capacity);
    this.lastEffectTicks = new Float64Array(capacity);
    this.claimReadIds = new Uint32Array(8);
    this.claimReadIds.fill(JOB_NONE);
    this.claimReadEpochs = new Uint32Array(8);
    this.preparedPickupItem = createPreparedItemRemoval();
    this.preparedPickupCore = createPreparedCarriedStep();
    this.preparedConsumeNeed = createPreparedNeedMutation();
    this.preparedTerminal = createPreparedTerminal();
    this.preparedReturnItem = createPreparedItemRemoval();
    this.itemScratch = createItemOutput();
    this.itemReadScratch = { entity: { index: 0, generation: 0 } };
    this.pendingTerminalOutcomes = new Uint8Array(capacity);
    this.pendingTerminalFailures = new Uint8Array(capacity);
    this.pendingInterruptionKinds = new Uint8Array(capacity);
    this.cleanupPendingFlags = new Uint8Array(capacity);
    this.returnedOnceFlags = new Uint8Array(capacity);
    this.committedJobOutput = createCommittedJobOutput();
    this.releaseOwnerScratch = { index: 0, generation: 0 };
  }

  adoptExistingClaimsInto(
    control: ExistingClaimsAdoptionControl,
    input: M3EatingClaimAdoptionInput,
    jobCore: JobCoreStore,
    output: M3EatingClaimAdoptionOutput,
  ): void {
    resetEatingAdoptionOutput(output);
    if (control.expectedDriverVersion > 0xffff_fffd) {
      output.reason = "eating_version_exhausted";
      return;
    }
    if (
      !isExactEatingAdoptionPreflight(control, input, this.capacity) ||
      control.expectedDriverVersion !== this.storeVersion ||
      control.expectedDriverVersion > 0xffff_fffd ||
      input.jobId !== control.jobId ||
      input.owner.index !== control.ownerIndex ||
      input.owner.generation !== control.ownerGeneration ||
      this.active[control.jobId] === 1 ||
      !isExactAdoptionClaimPrefix(control, input.claims, 2) ||
      !matchesEatingReadClaimPrefix(
        control,
        input.readClaimIds,
        input.readClaimEpochs,
        input.claims,
      ) ||
      (input.claims.channelCodes[0] ?? 0) !== RESERVATION_ITEM_QUANTITY ||
      (input.claims.channelCodes[1] ?? 0) !== RESERVATION_INTERACTION_SPOT ||
      (input.claims.targetIndexes[0] ?? 0) !== input.itemEntity.index ||
      (input.claims.targetGenerations[0] ?? 0) !== input.itemEntity.generation ||
      (input.claims.targetIndexes[1] ?? 0) !== input.itemEntity.index ||
      (input.claims.targetGenerations[1] ?? 0) !== input.itemEntity.generation ||
      (input.claims.slotIds[1] ?? 0) !== input.interactionSpotId ||
      (input.claims.amounts[0] ?? 0) !== input.amount
    ) {
      output.reason = "eating_adoption_preflight_failed";
      return;
    }
    jobCore.createRunningJobScalarsInto(
      control.jobId,
      control.jobGeneration,
      input.owner.index,
      input.owner.generation,
      M3_EATING_JOB_KIND,
      input.sourceStackId,
      "path_to_source",
      "at_safe_point",
      0,
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
    this.writeAdopted(control, input);
    this.storeVersion += 1;
    this.writeEatingAdoptionSuccess(output);
  }

  rollbackNewlyAdoptedInto(
    control: NewlyAdoptedRollbackControl,
    jobCore: JobCoreStore,
    output: M3EatingClaimAdoptionOutput,
  ): void {
    resetEatingAdoptionOutput(output);
    const jobId = control.jobId;
    if (control.expectedAdoptedDriverVersion === 0xffff_ffff) {
      output.reason = "eating_version_exhausted";
      return;
    }
    if (
      !isExactEatingRollbackControl(control, this.capacity, jobCore.version) ||
      this.active[jobId] !== 1 ||
      this.jobGenerations[jobId] !== control.jobGeneration ||
      this.ownerIndexes[jobId] !== control.ownerIndex ||
      this.ownerGenerations[jobId] !== control.ownerGeneration ||
      this.stepCodes[jobId] !== EATING_STEP_RESERVED ||
      this.carriedDefIds[jobId] !== JOB_NONE ||
      this.carriedAmounts[jobId] !== 0 ||
      this.consumedDefIds[jobId] !== JOB_NONE ||
      this.consumedAmounts[jobId] !== 0 ||
      this.effectPhases[jobId] !== 0 ||
      this.pickupOnce[jobId] !== 0 ||
      this.cleanupPendingFlags[jobId] !== 0 ||
      this.returnedOnceFlags[jobId] !== 0 ||
      this.terminalReasonCodes[jobId] !== 0 ||
      this.createdTicks[jobId] !== control.claimCreatedTick ||
      this.stepEnteredTicks[jobId] !== control.adoptionTick ||
      this.lastEffectTicks[jobId] !== control.adoptionTick ||
      this.reservationVersions[jobId] !== control.reservationReadVersion ||
      this.pendingTerminalOutcomes[jobId] !== 0 ||
      this.pendingTerminalFailures[jobId] !== 0 ||
      this.pendingInterruptionKinds[jobId] !== 0 ||
      this.jobSlotVersions[jobId] !== control.expectedAdoptedJobSlotVersion ||
      this.storeVersion !== control.expectedAdoptedDriverVersion ||
      !sameStoredClaims(
        this.claimIds,
        this.claimEpochs,
        this.claimCreatedTicks,
        this.claimLeaseExpiryTicks,
        jobId,
        2,
        control,
      )
    ) {
      output.reason = "eating_rollback_preflight_failed";
      return;
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
    this.jobSlotVersions[jobId] = this.jobTokenOutput.slotVersion;
    this.jobGenerations[jobId] = 0;
    this.active[jobId] = 0;
    this.activeCount -= 1;
    this.storeVersion += 1;
    this.writeEatingAdoptionSuccess(output);
  }

  pickupAdoptedInto(
    input: M3EatingAdoptedPickupInput,
    items: ItemStackStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3EatingAdoptedMutationOutput,
  ): void {
    resetAdoptedMutationOutput(output);
    const jobId = input.jobId;
    const phase = isIndexInRange(jobId, this.capacity) ? (this.effectPhases[jobId] ?? 0) : 0;
    if (isIndexInRange(jobId, this.capacity) && this.cleanupPendingFlags[jobId] === 1) {
      output.reason = "eating_step_invalid";
      return;
    }
    if (phase === 1 && this.pickupOnce[jobId] === 1) {
      if (
        !this.matchesAdoptedCaller(input, jobCore, EATING_STEP_PICKED_UP, 0) ||
        !this.matchesCommittedRunningJob(input, jobCore, "interact") ||
        !this.readExactClaims(input, ledger, claims)
      ) {
        output.reason = "eating_step_invalid";
        return;
      }
      writeAdoptedMutationSuccess(
        input,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        input.expectedDriverVersion,
        input.expectedCurrentLedgerVersion,
        0,
        0,
        0,
        0,
        false,
        true,
        0,
        output,
      );
      return;
    }
    if (isSafeUint32(input.expectedDriverVersion) && input.expectedDriverVersion === 0xffff_ffff) {
      output.reason = "eating_version_exhausted";
      return;
    }
    if (
      !this.matchesAdoptedCaller(input, jobCore, EATING_STEP_RESERVED, 1) ||
      this.effectPhases[jobId] !== 0 ||
      !this.readExactClaims(input, ledger, claims)
    ) {
      output.reason = "eating_step_invalid";
      return;
    }
    const removal = input.itemRemoval;
    items.readStackInto(removal.stackId, ledger, this.itemReadScratch, this.itemScratch);
    if (
      !matchesEatingItem(this.itemScratch, removal, input.expectedCurrentLedgerVersion) ||
      removal.stackId !== this.sourceStackIds[jobId] ||
      removal.defId !== this.foodDefIds[jobId] ||
      removal.amount !== this.amounts[jobId] ||
      claims.amounts[0] !== removal.amount ||
      claims.targetIndexes[0] !== removal.entityIndex ||
      claims.targetGenerations[0] !== removal.entityGeneration
    ) {
      output.reason = "eating_item_mutation_failed";
      return;
    }
    items.prepareAutonomousQuantityRemovalInto(
      removal,
      ledger,
      this.itemReadScratch,
      this.preparedPickupItem,
    );
    if (!this.preparedPickupItem.ok) {
      output.reason = this.preparedPickupItem.reason;
      return;
    }
    jobCore.prepareAutonomyCarriedStepInto(
      jobId,
      input.jobGeneration,
      input.owner,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      removal.defId,
      removal.amount,
      "interact",
      input.tick,
      this.preparedPickupCore,
    );
    if (!this.preparedPickupCore.ok) {
      output.reason = this.preparedPickupCore.reason;
      return;
    }
    writeAdoptedMutationSuccess(
      input,
      this.preparedPickupCore.nextSlotVersion,
      this.preparedPickupCore.nextJobCoreVersion,
      input.expectedDriverVersion + 1,
      input.expectedCurrentLedgerVersion,
      this.preparedPickupItem.nextRowVersion,
      this.preparedPickupItem.nextStoreVersion,
      0,
      0,
      false,
      false,
      0,
      output,
    );
    commitPreparedItemStackQuantityRemoval(items, this.preparedPickupItem);
    commitPreparedAutonomyCarriedStep(jobCore, this.preparedPickupCore);
    this.carriedDefIds[jobId] = removal.defId;
    this.carriedAmounts[jobId] = removal.amount;
    this.jobSlotVersions[jobId] = this.preparedPickupCore.nextSlotVersion;
    this.stepEnteredTicks[jobId] = input.tick;
    this.stepCodes[jobId] = EATING_STEP_PICKED_UP;
    this.effectPhases[jobId] = 1;
    this.pickupOnce[jobId] = 1;
    this.lastEffectTicks[jobId] = input.tick;
    this.storeVersion = input.expectedDriverVersion + 1;
  }

  consumeAdoptedInto(
    input: M3EatingAdoptedConsumeInput,
    needs: NeedStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3EatingAdoptedMutationOutput,
  ): void {
    resetAdoptedMutationOutput(output);
    const jobId = input.jobId;
    const phase = isIndexInRange(jobId, this.capacity) ? (this.effectPhases[jobId] ?? 0) : 0;
    if (isIndexInRange(jobId, this.capacity) && this.cleanupPendingFlags[jobId] === 1) {
      output.reason = "eating_step_invalid";
      return;
    }
    const requiredHeadroom = phase === 1 ? 2 : 0;
    if (
      isSafeUint32(input.expectedDriverVersion) &&
      input.expectedDriverVersion > 0xffff_ffff - requiredHeadroom
    ) {
      output.reason = "eating_version_exhausted";
      return;
    }
    if (!this.matchesAdoptedCaller(input, jobCore, EATING_STEP_PICKED_UP, requiredHeadroom)) {
      output.reason = "eating_step_invalid";
      return;
    }
    if (phase === 3) {
      if (!this.matchesCommittedTerminalJob(input, jobCore, "completed", "none")) {
        output.reason = "eating_step_invalid";
        return;
      }
      writeAdoptedMutationSuccess(
        input,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        input.expectedDriverVersion,
        this.reservationVersions[jobId] ?? input.expectedCurrentLedgerVersion,
        0,
        0,
        0,
        0,
        false,
        true,
        0,
        output,
      );
      output.terminalOutcome = "consumed";
      return;
    }
    if (phase !== 1) {
      output.reason = "eating_step_invalid";
      return;
    }
    jobCore.prepareAutonomyTerminalScalarsInto(
      jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      "completed",
      "none",
      3,
      undefined,
      this.preparedTerminal,
    );
    if (!this.preparedTerminal.ok) {
      output.reason = this.preparedTerminal.reason;
      return;
    }
    if (
      !this.readExactClaims(input, ledger, claims) ||
      input.needMutation.actorId !== input.owner.index ||
      input.needMutation.lane !== NEED_LANE_HUNGER ||
      input.needMutation.delta !== (this.hungerRestores[jobId] ?? 0) ||
      input.needMutation.tick !== input.tick
    ) {
      output.reason = "eating_need_mutation_failed";
      return;
    }
    needs.prepareLaneDeltaInto(input.needMutation, this.preparedConsumeNeed);
    if (!this.preparedConsumeNeed.ok || !this.preparedConsumeNeed.changed) {
      output.reason = this.preparedConsumeNeed.reason ?? "eating_need_mutation_failed";
      return;
    }
    const amount = this.carriedAmounts[jobId] ?? 0;
    if (
      this.consumedAmountTotal > 0xffff_ffff - amount ||
      this.cumulativeConsumedCount === 0xffff_ffff
    ) {
      output.reason = "eating_version_exhausted";
      return;
    }
    writeAdoptedMutationSuccess(
      input,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.expectedDriverVersion + 1,
      input.expectedCurrentLedgerVersion,
      0,
      0,
      this.preparedConsumeNeed.nextLaneVersion,
      this.preparedConsumeNeed.nextStoreVersion,
      true,
      false,
      0,
      output,
    );
    commitPreparedChangedNeedLaneMutation(needs, this.preparedConsumeNeed);
    this.consumedDefIds[jobId] = this.carriedDefIds[jobId] ?? JOB_NONE;
    this.consumedAmounts[jobId] = amount;
    this.consumedAmountTotal += amount;
    this.cumulativeConsumedCount += 1;
    this.clearCarried(jobId);
    this.effectPhases[jobId] = 2;
    this.cleanupPendingFlags[jobId] = 1;
    this.returnedOnceFlags[jobId] = 0;
    this.pendingTerminalOutcomes[jobId] = 4;
    this.pendingTerminalFailures[jobId] = 0;
    this.pendingInterruptionKinds[jobId] = 0;
    this.lastEffectTicks[jobId] = input.tick;
    this.storeVersion = input.expectedDriverVersion + 1;
    if (!this.releaseClaimsForTerminal(jobId, ledger, input.expectedCurrentLedgerVersion)) {
      output.ok = false;
      output.reason = this.releaseOutput.reason ?? "reservation.failed";
      output.cleanupPending = true;
      output.terminalOutcome = "consumed";
      return;
    }
    writeAdoptedMutationSuccess(
      input,
      this.preparedTerminal.nextSlotVersion,
      this.preparedTerminal.nextJobCoreVersion,
      this.storeVersion + 1,
      this.releaseOutput.version,
      0,
      0,
      this.preparedConsumeNeed.nextLaneVersion,
      this.preparedConsumeNeed.nextStoreVersion,
      false,
      false,
      this.releaseOutput.releasedCount,
      output,
    );
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.jobSlotVersions[jobId] = this.preparedTerminal.nextSlotVersion;
    this.reservationVersions[jobId] = this.releaseOutput.version;
    this.effectPhases[jobId] = 3;
    this.cleanupPendingFlags[jobId] = 0;
    this.stepCodes[jobId] = EATING_STEP_CONSUMED;
    this.stepEnteredTicks[jobId] = input.tick;
    this.terminalReasonCodes[jobId] = encodeEatingReason("food.consumed_integer_portion");
    this.active[jobId] = 0;
    this.activeCount -= 1;
    clearStoredClaims(
      this.claimIds,
      this.claimEpochs,
      this.claimCreatedTicks,
      this.claimLeaseExpiryTicks,
      jobId * 2,
      2,
    );
    this.storeVersion += 1;
    output.terminalOutcome = "consumed";
  }

  terminalAdoptedInto(
    input: M3EatingAdoptedTerminalInput,
    items: ItemStackStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: M3EatingAdoptedMutationOutput,
  ): void {
    resetAdoptedMutationOutput(output);
    const jobId = input.jobId;
    const phase = isIndexInRange(jobId, this.capacity) ? (this.effectPhases[jobId] ?? 0) : 0;
    if (isIndexInRange(jobId, this.capacity) && this.cleanupPendingFlags[jobId] === 1) {
      output.reason = "eating_step_invalid";
      return;
    }
    if (phase === 3) {
      if (!this.matchesEatingTerminalDuplicate(input, jobCore)) {
        output.reason = "eating_step_invalid";
        return;
      }
      writeAdoptedMutationSuccess(
        input,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        input.expectedDriverVersion,
        this.reservationVersions[jobId] ?? input.expectedCurrentLedgerVersion,
        0,
        0,
        0,
        0,
        false,
        true,
        0,
        output,
      );
      output.terminalOutcome = input.outcome;
      return;
    }
    const expectedStep = phase === 0 ? EATING_STEP_RESERVED : EATING_STEP_PICKED_UP;
    const headroom = phase === 0 || phase === 1 ? 2 : 0;
    if (
      isSafeUint32(input.expectedDriverVersion) &&
      input.expectedDriverVersion > 0xffff_ffff - headroom
    ) {
      output.reason = "eating_version_exhausted";
      return;
    }
    if (
      (phase !== 0 && phase !== 1) ||
      !this.matchesAdoptedCaller(input, jobCore, expectedStep, headroom)
    ) {
      output.reason = "eating_step_invalid";
      return;
    }
    if (!isValidEatingTerminalInput(input) || !this.readExactClaims(input, ledger, claims)) {
      output.reason = "eating_step_invalid";
      return;
    }
    jobCore.prepareAutonomyTerminalScalarsInto(
      jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      input.outcome === "failed" ? "failed" : "canceled",
      input.failureReason,
      3,
      input.interruptionKind,
      this.preparedTerminal,
    );
    if (!this.preparedTerminal.ok) {
      output.reason = this.preparedTerminal.reason;
      return;
    }
    if (!this.hasTerminalCounterHeadroom(input.outcome)) {
      output.reason = "eating_version_exhausted";
      return;
    }
    if (phase === 1) {
      const addition = input.itemAddition;
      if (!this.matchesEatingReturnItem(jobId, addition, input.expectedCurrentLedgerVersion)) {
        output.reason = "eating_item_mutation_failed";
        return;
      }
      items.prepareAutonomousQuantityAdditionInto(addition, ledger, this.preparedReturnItem);
      if (!this.preparedReturnItem.ok) {
        output.reason = this.preparedReturnItem.reason;
        return;
      }
      writeAdoptedMutationSuccess(
        input,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        input.expectedDriverVersion + 1,
        input.expectedCurrentLedgerVersion,
        this.preparedReturnItem.nextRowVersion,
        this.preparedReturnItem.nextStoreVersion,
        0,
        0,
        true,
        false,
        0,
        output,
      );
      commitPreparedItemStackQuantityAddition(items, this.preparedReturnItem);
      this.clearCarried(jobId);
      this.commitEatingCleanupIntent(input);
    } else {
      this.commitEatingCleanupIntent(input);
      writeAdoptedMutationSuccess(
        input,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        this.storeVersion,
        input.expectedCurrentLedgerVersion,
        0,
        0,
        0,
        0,
        true,
        false,
        0,
        output,
      );
    }
    output.terminalOutcome = input.outcome;
    if (!this.releaseClaimsForTerminal(jobId, ledger, input.expectedCurrentLedgerVersion)) {
      output.ok = false;
      output.reason = this.releaseOutput.reason ?? "reservation.failed";
      return;
    }
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.jobSlotVersions[jobId] = this.preparedTerminal.nextSlotVersion;
    this.reservationVersions[jobId] = this.releaseOutput.version;
    this.stepCodes[jobId] = input.outcome === "failed" ? EATING_STEP_FAILED : EATING_STEP_CANCELED;
    this.stepEnteredTicks[jobId] = input.tick;
    this.terminalReasonCodes[jobId] = encodeEatingReason(
      input.outcome === "failed" ? "food.job_failed" : "food.job_canceled",
    );
    this.effectPhases[jobId] = 3;
    this.cleanupPendingFlags[jobId] = 0;
    this.active[jobId] = 0;
    this.activeCount -= 1;
    clearStoredClaims(
      this.claimIds,
      this.claimEpochs,
      this.claimCreatedTicks,
      this.claimLeaseExpiryTicks,
      jobId * 2,
      2,
    );
    this.storeVersion += 1;
    writeAdoptedMutationSuccess(
      input,
      this.preparedTerminal.nextSlotVersion,
      this.preparedTerminal.nextJobCoreVersion,
      this.storeVersion,
      this.releaseOutput.version,
      0,
      0,
      0,
      0,
      false,
      false,
      this.releaseOutput.releasedCount,
      output,
    );
    output.terminalOutcome = input.outcome;
  }

  resumeCleanupInto(
    input: M3EatingResumeCleanupInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: M3EatingAdoptedMutationOutput,
  ): void {
    resetAdoptedMutationOutput(output);
    const jobId = input.jobId;
    if (
      !isIndexInRange(jobId, this.capacity) ||
      this.cleanupPendingFlags[jobId] !== 1 ||
      this.effectPhases[jobId] !== 2 ||
      !this.matchesPendingCleanup(input) ||
      !this.matchesResumeCaller(input, jobCore)
    ) {
      output.reason = "eating_step_invalid";
      return;
    }
    jobCore.prepareAutonomyTerminalScalarsInto(
      jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      input.outcome === "consumed"
        ? "completed"
        : input.outcome === "failed"
          ? "failed"
          : "canceled",
      input.failureReason,
      3,
      input.interruptionKind,
      this.preparedTerminal,
    );
    if (!this.preparedTerminal.ok) {
      output.reason = this.preparedTerminal.reason;
      return;
    }
    writeResumeCleanupSuccess(
      input,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.expectedDriverVersion,
      input.expectedCurrentLedgerVersion,
      true,
      0,
      output,
    );
    if (!this.releaseClaimsForTerminal(jobId, ledger, input.expectedCurrentLedgerVersion)) {
      output.ok = false;
      output.reason = this.releaseOutput.reason ?? "reservation.failed";
      output.terminalOutcome = input.outcome;
      return;
    }
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.jobSlotVersions[jobId] = this.preparedTerminal.nextSlotVersion;
    this.reservationVersions[jobId] = this.releaseOutput.version;
    this.effectPhases[jobId] = 3;
    this.cleanupPendingFlags[jobId] = 0;
    this.stepCodes[jobId] =
      input.outcome === "consumed"
        ? EATING_STEP_CONSUMED
        : input.outcome === "failed"
          ? EATING_STEP_FAILED
          : EATING_STEP_CANCELED;
    this.stepEnteredTicks[jobId] = input.tick;
    this.terminalReasonCodes[jobId] = encodeEatingReason(
      input.outcome === "consumed"
        ? "food.consumed_integer_portion"
        : input.outcome === "failed"
          ? "food.job_failed"
          : "food.job_canceled",
    );
    this.active[jobId] = 0;
    this.activeCount -= 1;
    clearStoredClaims(
      this.claimIds,
      this.claimEpochs,
      this.claimCreatedTicks,
      this.claimLeaseExpiryTicks,
      jobId * 2,
      2,
    );
    this.storeVersion += 1;
    writeResumeCleanupSuccess(
      input,
      this.preparedTerminal.nextSlotVersion,
      this.preparedTerminal.nextJobCoreVersion,
      this.storeVersion,
      this.releaseOutput.version,
      false,
      this.releaseOutput.releasedCount,
      output,
    );
    output.terminalOutcome = input.outcome;
  }

  createJob(
    input: M3EatingJobCreateInput,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const validation = this.validateCreate(input, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "eating_job_already_active" };
    }

    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: M3_EATING_JOB_KIND,
        targetId: input.sourceStackId,
        initialStep: "reserve",
        interruptionPolicy: "at_safe_point",
        requiredWorkQ16: 0,
        createdTick: input.createdTick,
      },
      registry,
    );
    if (!created.ok) {
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.active[input.jobId] = 1;
    this.ownerIndexes[input.jobId] = input.owner.index;
    this.ownerGenerations[input.jobId] = input.owner.generation;
    this.sourceStackIds[input.jobId] = input.sourceStackId;
    this.storageSlotIds[input.jobId] = input.storageSlotId;
    this.foodDefIds[input.jobId] = input.foodDefId;
    this.amounts[input.jobId] = input.amount;
    this.hungerRestores[input.jobId] = input.hungerRestore;
    this.itemStoreVersions[input.jobId] = input.itemStoreVersion;
    this.foodAvailabilityVersions[input.jobId] = input.foodAvailabilityVersion;
    this.mealWindowVersions[input.jobId] = input.mealWindowVersion;
    this.abilityAllowedFlags[input.jobId] = input.abilityAllowed ? 1 : 0;
    this.createdTicks[input.jobId] = input.createdTick;
    this.stepEnteredTicks[input.jobId] = input.createdTick;
    this.jobGenerations[input.jobId] = 0;
    this.jobSlotVersions[input.jobId] = 0;
    this.stepCodes[input.jobId] = EATING_STEP_CREATED;
    this.carriedDefIds[input.jobId] = JOB_NONE;
    this.carriedAmounts[input.jobId] = 0;
    this.consumedDefIds[input.jobId] = JOB_NONE;
    this.consumedAmounts[input.jobId] = 0;
    this.terminalReasonCodes[input.jobId] = encodeEatingReason("food.job_created");
    this.activeCount += 1;
    return this.finish(input.jobId, "food.job_created");
  }

  reserveBeforePickup(
    jobId: number,
    tick: Tick,
    registry: EntityRegistry,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const context = this.readReservationContext(jobId, items, food, storage, ledger);
    if (!context.ok) {
      return context;
    }

    this.reservationAttempts += 1;
    const acquired = ledger.acquire(
      {
        owner: this.readOwner(jobId),
        jobId,
        createdTick: tick,
        leaseExpiryTick: tick + 300,
        claims: [
          {
            channel: "item_quantity",
            item: context.stack.entity,
            amount: context.amount,
            availableAmount: context.stack.quantity,
          },
          {
            channel: "interaction_spot",
            target: context.stack.entity,
            spotId: context.portion.interactionSpotId,
          },
        ],
      },
      registry,
    );

    if (!acquired.ok) {
      this.reservationFailures += 1;
      return { ok: false, reason: mapReservationReason(acquired.reason) };
    }

    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      const released = ledger.releaseClaims(acquired.claimIds);
      if (!released.ok) {
        return { ok: false, reason: mapReservationReason(released.reason) };
      }
      food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
      storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.stepCodes[jobId] = EATING_STEP_RESERVED;
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return this.finish(jobId, "food.job_reserved");
  }

  pickup(
    jobId: number,
    tick: Tick,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const validation = this.validateStep(jobId, EATING_STEP_RESERVED);
    if (!validation.ok) {
      return validation;
    }

    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "eating_step_invalid" };
    }

    if (!isSafeUint32(tick)) {
      return { ok: false, reason: "eating_tick_invalid" };
    }

    const amount = this.amounts[jobId] ?? 0;
    const defId = this.foodDefIds[jobId] ?? 0;
    const removed = items.removeQuantity(this.sourceStackIds[jobId] ?? 0, amount, defId);
    if (!removed.ok) {
      return { ok: false, reason: "eating_item_mutation_failed" };
    }

    const carried = jobCore.setCarriedState(jobId, defId, amount);
    if (!carried.ok) {
      rollbackItemAdd(items, this.sourceStackIds[jobId] ?? 0, amount, defId);
      return { ok: false, reason: "eating_job_core_failed" };
    }

    const entered = jobCore.enterStep(jobId, "interact", tick);
    if (!entered.ok) {
      rollbackItemAdd(items, this.sourceStackIds[jobId] ?? 0, amount, defId);
      rollbackCarriedClear(jobCore, jobId);
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.carriedDefIds[jobId] = defId;
    this.carriedAmounts[jobId] = amount;
    this.stepCodes[jobId] = EATING_STEP_PICKED_UP;
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return this.finish(jobId, "food.job_picked_up");
  }

  consume(
    jobId: number,
    tick: Tick,
    needs: NeedStore,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    dirtySink?: NeedDirtySink,
  ): M3EatingMutationResult {
    const validation = this.validateStep(jobId, EATING_STEP_PICKED_UP);
    if (!validation.ok) {
      return validation;
    }

    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "eating_step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "eating_tick_invalid" };
    }

    const owner = this.readOwner(jobId);
    if ((this.effectPhases[jobId] ?? 0) === 0) {
      if (!needs.isActorActive(owner.index))
        return { ok: false, reason: "eating_need_mutation_failed" };
      const hungerRestore = this.hungerRestores[jobId] ?? 0;
      if (!isNonNegativeNeedDelta(hungerRestore))
        return { ok: false, reason: "eating_need_delta_invalid" };
      const needChanged = needs.applyLaneDelta(
        {
          actorId: owner.index,
          lane: NEED_LANE_HUNGER,
          tick,
          reason: "need.external_delta",
          sourceSystemId: M3_EATING_JOB_KIND,
          sourceEventId: jobId,
        },
        hungerRestore,
      );
      if (!needChanged.ok) return { ok: false, reason: "eating_need_mutation_failed" };
      if (needChanged.changed) dirtySink?.markDirty(needChanged.actorId, needChanged.lane);
      const amount = this.carriedAmounts[jobId] ?? 0;
      this.consumedDefIds[jobId] = this.carriedDefIds[jobId] ?? JOB_NONE;
      this.consumedAmounts[jobId] = amount;
      this.consumedAmountTotal += amount;
      this.clearCarried(jobId);
      this.effectPhases[jobId] = 1;
      this.storeVersion += 1;
    }

    if (!this.releaseClaimsForTerminal(jobId, ledger)) {
      return { ok: false, reason: "reservation.failed" };
    }
    const completed = jobCore.completeJob(
      jobId,
      tick,
      (this.jobGenerations[jobId] ?? 0) === 0 ? ledger : undefined,
    );
    if (!completed.ok) {
      return { ok: false, reason: "eating_job_core_failed" };
    }
    this.effectPhases[jobId] = 2;
    this.stepCodes[jobId] = EATING_STEP_CONSUMED;
    return this.finish(jobId, "food.consumed_integer_portion");
  }

  cancel(
    jobId: number,
    tick: Tick,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    return this.finishNonConsumedTerminal(
      jobId,
      tick,
      "food.job_canceled",
      "cancelled",
      items,
      food,
      storage,
      ledger,
      jobCore,
    );
  }

  fail(
    jobId: number,
    tick: Tick,
    reason: JobFailureReason,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    return this.finishNonConsumedTerminal(
      jobId,
      tick,
      "food.job_failed",
      reason,
      items,
      food,
      storage,
      ledger,
      jobCore,
    );
  }

  readJob(jobId: number): M3EatingJobView | undefined {
    if (!this.isActiveJob(jobId)) {
      return undefined;
    }

    return {
      jobId,
      owner: this.readOwner(jobId),
      sourceStackId: this.sourceStackIds[jobId] ?? 0,
      storageSlotId: this.storageSlotIds[jobId] ?? 0,
      foodDefId: this.foodDefIds[jobId] ?? 0,
      amount: this.amounts[jobId] ?? 0,
      hungerRestore: this.hungerRestores[jobId] ?? 0,
      itemStoreVersion: this.itemStoreVersions[jobId] ?? 0,
      foodAvailabilityVersion: this.foodAvailabilityVersions[jobId] ?? 0,
      mealWindowVersion: this.mealWindowVersions[jobId] ?? 0,
      abilityAllowed: (this.abilityAllowedFlags[jobId] ?? 0) === 1,
      createdTick: this.createdTicks[jobId] ?? 0,
      step: decodeStep(this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED),
      carriedDefId: this.carriedDefIds[jobId] ?? JOB_NONE,
      carriedAmount: this.carriedAmounts[jobId] ?? 0,
      consumedDefId: this.consumedDefIds[jobId] ?? JOB_NONE,
      consumedAmount: this.consumedAmounts[jobId] ?? 0,
      terminalReason: decodeEatingReason(this.terminalReasonCodes[jobId] ?? 0),
    };
  }

  readAdoptedJobInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    output: M3EatingAdoptedJobIntoOutput,
  ): void {
    resetEatingAdoptedJobOutput(output, this.storeVersion);
    if (
      !isIndexInRange(jobId, this.capacity) ||
      jobGeneration === 0 ||
      this.jobGenerations[jobId] !== jobGeneration ||
      this.ownerIndexes[jobId] !== owner.index ||
      this.ownerGenerations[jobId] !== owner.generation ||
      this.jobSlotVersions[jobId] !== expectedSlotVersion ||
      output.claimIds.length !== 2 ||
      output.claimEpochs.length !== 2 ||
      output.claimCreatedTicks.length !== 2 ||
      output.claimLeaseExpiryTicks.length !== 2
    ) {
      output.reason = "eating_step_invalid";
      return;
    }
    output.ok = true;
    output.active = this.active[jobId] === 1;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = owner.index;
    output.ownerGeneration = owner.generation;
    output.sourceStackId = this.sourceStackIds[jobId] ?? 0;
    output.storageSlotId = this.storageSlotIds[jobId] ?? 0;
    output.foodDefId = this.foodDefIds[jobId] ?? 0;
    output.amount = this.amounts[jobId] ?? 0;
    output.hungerRestore = this.hungerRestores[jobId] ?? 0;
    output.itemEntityIndex = this.itemEntityIndexes[jobId] ?? 0;
    output.itemEntityGeneration = this.itemEntityGenerations[jobId] ?? 0;
    output.interactionSpotId = this.interactionSpotIds[jobId] ?? 0;
    output.itemStoreVersion = this.itemStoreVersions[jobId] ?? 0;
    output.foodAvailabilityVersion = this.foodAvailabilityVersions[jobId] ?? 0;
    output.mealWindowVersion = this.mealWindowVersions[jobId] ?? 0;
    output.abilityAllowed = this.abilityAllowedFlags[jobId] === 1;
    const base = jobId * 2;
    output.claimIds[0] = this.claimIds[base] ?? JOB_NONE;
    output.claimIds[1] = this.claimIds[base + 1] ?? JOB_NONE;
    output.claimEpochs[0] = this.claimEpochs[base] ?? 0;
    output.claimEpochs[1] = this.claimEpochs[base + 1] ?? 0;
    output.claimCreatedTicks[0] = this.claimCreatedTicks[base] ?? 0;
    output.claimCreatedTicks[1] = this.claimCreatedTicks[base + 1] ?? 0;
    output.claimLeaseExpiryTicks[0] = this.claimLeaseExpiryTicks[base] ?? 0;
    output.claimLeaseExpiryTicks[1] = this.claimLeaseExpiryTicks[base + 1] ?? 0;
    output.createdTick = this.createdTicks[jobId] ?? 0;
    output.stepEnteredTick = this.stepEnteredTicks[jobId] ?? 0;
    output.step = decodeStep(this.stepCodes[jobId] ?? 0);
    output.carriedDefId = this.carriedDefIds[jobId] ?? JOB_NONE;
    output.carriedAmount = this.carriedAmounts[jobId] ?? 0;
    output.consumedDefId = this.consumedDefIds[jobId] ?? JOB_NONE;
    output.consumedAmount = this.consumedAmounts[jobId] ?? 0;
    output.jobSlotVersion = expectedSlotVersion;
    output.driverVersion = this.storeVersion;
    output.reservationVersion = this.reservationVersions[jobId] ?? 0;
    output.effectPhase = this.effectPhases[jobId] ?? 0;
    output.cleanupPending = this.cleanupPendingFlags[jobId] ?? 0;
    output.returnedOnce = this.returnedOnceFlags[jobId] ?? 0;
    output.pickupCommitted = this.pickupOnce[jobId] === 1;
    output.lastEffectTick = this.lastEffectTicks[jobId] ?? 0;
    output.pendingOutcome = decodeEatingTerminalOutcome(this.pendingTerminalOutcomes[jobId] ?? 0);
    output.pendingFailure = decodeEatingFailure(this.pendingTerminalFailures[jobId] ?? 0);
    output.pendingInterruption = decodeEatingInterruption(
      this.pendingInterruptionKinds[jobId] ?? 0,
    );
    output.terminalReason = decodeEatingReason(this.terminalReasonCodes[jobId] ?? 0);
    this.writeReadMetrics(output);
    output.reservationAttemptCount = this.reservationAttempts;
    output.reservationFailureCount = this.reservationFailures;
    output.cumulativeConsumedCount = this.cumulativeConsumedCount;
    output.cumulativeCanceledCount = this.cumulativeCanceledCount;
    output.cumulativeFailedCount = this.cumulativeFailedCount;
    output.cumulativeInterruptedCount = this.cumulativeInterruptedCount;
    output.consumedAmountTotal = this.consumedAmountTotal;
  }

  createSnapshot(): M3EatingJobSnapshot {
    const rows: M3EatingJobSnapshotRow[] = [];
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const base = jobId * 2;
      rows.push({
        jobId,
        active: this.active[jobId] ?? 0,
        ownerIndex: this.ownerIndexes[jobId] ?? 0,
        ownerGeneration: this.ownerGenerations[jobId] ?? 0,
        sourceStackId: this.sourceStackIds[jobId] ?? 0,
        storageSlotId: this.storageSlotIds[jobId] ?? 0,
        foodDefId: this.foodDefIds[jobId] ?? 0,
        amount: this.amounts[jobId] ?? 0,
        hungerRestore: this.hungerRestores[jobId] ?? 0,
        itemEntityIndex: this.itemEntityIndexes[jobId] ?? 0,
        itemEntityGeneration: this.itemEntityGenerations[jobId] ?? 0,
        interactionSpotId: this.interactionSpotIds[jobId] ?? 0,
        itemStoreVersion: this.itemStoreVersions[jobId] ?? 0,
        foodAvailabilityVersion: this.foodAvailabilityVersions[jobId] ?? 0,
        mealWindowVersion: this.mealWindowVersions[jobId] ?? 0,
        abilityAllowed: this.abilityAllowedFlags[jobId] ?? 0,
        createdTick: this.createdTicks[jobId] ?? 0,
        stepEnteredTick: this.stepEnteredTicks[jobId] ?? 0,
        jobGeneration: this.jobGenerations[jobId] ?? 0,
        jobSlotVersion: this.jobSlotVersions[jobId] ?? 0,
        claimIds: [this.claimIds[base] ?? JOB_NONE, this.claimIds[base + 1] ?? JOB_NONE],
        claimEpochs: [this.claimEpochs[base] ?? 0, this.claimEpochs[base + 1] ?? 0],
        claimCreatedTicks: [
          this.claimCreatedTicks[base] ?? 0,
          this.claimCreatedTicks[base + 1] ?? 0,
        ],
        claimLeaseExpiryTicks: [
          this.claimLeaseExpiryTicks[base] ?? 0,
          this.claimLeaseExpiryTicks[base + 1] ?? 0,
        ],
        reservationVersion: this.reservationVersions[jobId] ?? 0,
        effectPhase: this.effectPhases[jobId] ?? 0,
        cleanupPending: this.cleanupPendingFlags[jobId] ?? 0,
        returnedOnce: this.returnedOnceFlags[jobId] ?? 0,
        stepCode: this.stepCodes[jobId] ?? 0,
        carriedDefId: this.carriedDefIds[jobId] ?? JOB_NONE,
        carriedAmount: this.carriedAmounts[jobId] ?? 0,
        consumedDefId: this.consumedDefIds[jobId] ?? JOB_NONE,
        consumedAmount: this.consumedAmounts[jobId] ?? 0,
        terminalReasonCode: this.terminalReasonCodes[jobId] ?? 0,
        pickupOnce: this.pickupOnce[jobId] ?? 0,
        lastEffectTick: this.lastEffectTicks[jobId] ?? 0,
        pendingTerminalOutcome: this.pendingTerminalOutcomes[jobId] ?? 0,
        pendingTerminalFailure: this.pendingTerminalFailures[jobId] ?? 0,
        pendingInterruptionKind: this.pendingInterruptionKinds[jobId] ?? 0,
      });
    }
    return {
      snapshotVersion: M3_EATING_JOB_SNAPSHOT_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      reservationAttempts: this.reservationAttempts,
      reservationFailures: this.reservationFailures,
      consumedAmountTotal: this.consumedAmountTotal,
      cumulativeConsumedCount: this.cumulativeConsumedCount,
      cumulativeCanceledCount: this.cumulativeCanceledCount,
      cumulativeFailedCount: this.cumulativeFailedCount,
      cumulativeInterruptedCount: this.cumulativeInterruptedCount,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): M3EatingRestoreResult {
    if (!isM3EatingSnapshot(snapshot, this.capacity)) {
      return { ok: false, reason: "eating_snapshot_invalid" };
    }
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const row = snapshot.rows[jobId];
      if (row === undefined) continue;
      const base = jobId * 2;
      this.active[jobId] = row.active;
      this.ownerIndexes[jobId] = row.ownerIndex;
      this.ownerGenerations[jobId] = row.ownerGeneration;
      this.sourceStackIds[jobId] = row.sourceStackId;
      this.storageSlotIds[jobId] = row.storageSlotId;
      this.foodDefIds[jobId] = row.foodDefId;
      this.amounts[jobId] = row.amount;
      this.hungerRestores[jobId] = row.hungerRestore;
      this.itemEntityIndexes[jobId] = row.itemEntityIndex;
      this.itemEntityGenerations[jobId] = row.itemEntityGeneration;
      this.interactionSpotIds[jobId] = row.interactionSpotId;
      this.itemStoreVersions[jobId] = row.itemStoreVersion;
      this.foodAvailabilityVersions[jobId] = row.foodAvailabilityVersion;
      this.mealWindowVersions[jobId] = row.mealWindowVersion;
      this.abilityAllowedFlags[jobId] = row.abilityAllowed;
      this.createdTicks[jobId] = row.createdTick;
      this.stepEnteredTicks[jobId] = row.stepEnteredTick;
      this.jobGenerations[jobId] = row.jobGeneration;
      this.jobSlotVersions[jobId] = row.jobSlotVersion;
      this.claimIds[base] = row.claimIds[0] ?? JOB_NONE;
      this.claimIds[base + 1] = row.claimIds[1] ?? JOB_NONE;
      this.claimEpochs[base] = row.claimEpochs[0] ?? 0;
      this.claimEpochs[base + 1] = row.claimEpochs[1] ?? 0;
      this.claimCreatedTicks[base] = row.claimCreatedTicks[0] ?? 0;
      this.claimCreatedTicks[base + 1] = row.claimCreatedTicks[1] ?? 0;
      this.claimLeaseExpiryTicks[base] = row.claimLeaseExpiryTicks[0] ?? 0;
      this.claimLeaseExpiryTicks[base + 1] = row.claimLeaseExpiryTicks[1] ?? 0;
      this.reservationVersions[jobId] = row.reservationVersion;
      this.effectPhases[jobId] = row.effectPhase;
      this.cleanupPendingFlags[jobId] = row.cleanupPending;
      this.returnedOnceFlags[jobId] = row.returnedOnce;
      this.stepCodes[jobId] = row.stepCode;
      this.carriedDefIds[jobId] = row.carriedDefId;
      this.carriedAmounts[jobId] = row.carriedAmount;
      this.consumedDefIds[jobId] = row.consumedDefId;
      this.consumedAmounts[jobId] = row.consumedAmount;
      this.terminalReasonCodes[jobId] = row.terminalReasonCode;
      this.pickupOnce[jobId] = row.pickupOnce;
      this.lastEffectTicks[jobId] = row.lastEffectTick;
      this.pendingTerminalOutcomes[jobId] = row.pendingTerminalOutcome;
      this.pendingTerminalFailures[jobId] = row.pendingTerminalFailure;
      this.pendingInterruptionKinds[jobId] = row.pendingInterruptionKind;
    }
    this.storeVersion = snapshot.storeVersion;
    this.activeCount = snapshot.activeCount;
    this.reservationAttempts = snapshot.reservationAttempts;
    this.reservationFailures = snapshot.reservationFailures;
    this.consumedAmountTotal = snapshot.consumedAmountTotal;
    this.cumulativeConsumedCount = snapshot.cumulativeConsumedCount;
    this.cumulativeCanceledCount = snapshot.cumulativeCanceledCount;
    this.cumulativeFailedCount = snapshot.cumulativeFailedCount;
    this.cumulativeInterruptedCount = snapshot.cumulativeInterruptedCount;
    return { ok: true, version: this.storeVersion, activeCount: this.activeCount };
  }

  createMetrics(): M3EatingMetrics {
    let reservedCount = 0;
    let pickedUpCount = 0;
    let consumedCount = 0;
    let canceledCount = 0;
    let failedCount = 0;
    let interruptedCount = 0;

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const step = this.stepCodes[jobId] ?? 0;
      if ((this.active[jobId] ?? 0) === 1) {
        reservedCount += step === EATING_STEP_RESERVED ? 1 : 0;
        pickedUpCount += step === EATING_STEP_PICKED_UP ? 1 : 0;
      } else {
        consumedCount += step === EATING_STEP_CONSUMED ? 1 : 0;
        canceledCount +=
          step === EATING_STEP_CANCELED && this.pendingTerminalOutcomes[jobId] !== 3 ? 1 : 0;
        interruptedCount +=
          step === EATING_STEP_CANCELED && this.pendingTerminalOutcomes[jobId] === 3 ? 1 : 0;
        failedCount += step === EATING_STEP_FAILED ? 1 : 0;
      }
    }

    return {
      version: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount,
      pickedUpCount,
      consumedCount,
      canceledCount,
      failedCount,
      interruptedCount,
      currentInterruptedJobs: interruptedCount,
      reservationAttemptCount: this.reservationAttempts,
      reservationFailureCount: this.reservationFailures,
      consumedAmountTotal: this.consumedAmountTotal,
    };
  }

  private readReservationContext(
    jobId: number,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
  ):
    | {
        readonly ok: true;
        readonly amount: number;
        readonly portion: M3FoodPortionView;
        readonly stack: NonNullable<ReturnType<ItemStackStore["readStack"]>>;
      }
    | { readonly ok: false; readonly reason: M3EatingReason } {
    const validation = this.validateStep(jobId, EATING_STEP_CREATED);
    if (!validation.ok) {
      return validation;
    }
    if ((this.abilityAllowedFlags[jobId] ?? 0) !== 1) {
      return { ok: false, reason: "food.rejected_ability" };
    }

    const portion = food.readPortion(this.sourceStackIds[jobId] ?? 0);
    if (portion === undefined || portion.availableAmount < (this.amounts[jobId] ?? 0)) {
      return { ok: false, reason: "food.rejected_no_available_portion" };
    }
    if (!portion.permissionAllowed || !portion.safe) {
      return { ok: false, reason: "food.rejected_permission" };
    }
    if (!portion.scheduleAllowed) {
      return { ok: false, reason: "food.rejected_schedule" };
    }
    if (
      portion.itemStoreVersion !== (this.itemStoreVersions[jobId] ?? 0) ||
      portion.foodAvailabilityVersion !== (this.foodAvailabilityVersions[jobId] ?? 0) ||
      portion.mealWindowVersion !== (this.mealWindowVersions[jobId] ?? 0)
    ) {
      return { ok: false, reason: "food.rejected_stale_owner" };
    }
    if (storage.readSlot(this.storageSlotIds[jobId] ?? 0) === undefined) {
      return { ok: false, reason: "food.rejected_stale_owner" };
    }

    const stack = items.readStack(this.sourceStackIds[jobId] ?? 0, ledger);
    if (stack === undefined || stack.availableQuantity < (this.amounts[jobId] ?? 0)) {
      return { ok: false, reason: "food.rejected_no_available_portion" };
    }

    return { ok: true, amount: this.amounts[jobId] ?? 0, portion, stack };
  }

  private finishNonConsumedTerminal(
    jobId: number,
    tick: Tick,
    terminalReason: M3EatingReason,
    jobReason: JobFailureReason,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): M3EatingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if (this.isTerminalStep(jobId)) {
      return { ok: false, reason: "eating_step_invalid" };
    }
    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "eating_step_invalid" };
    }

    const returned = this.returnCarried(jobId, items, food, storage);
    if (!returned.ok) {
      return returned;
    }

    if (!this.releaseClaimsForTerminal(jobId, ledger)) {
      this.rollbackReturned(
        jobId,
        returned.returnedAmount,
        returned.returnedDefId,
        items,
        food,
        storage,
      );
      return { ok: false, reason: "reservation.failed" };
    }
    const terminal =
      terminalReason === "food.job_canceled"
        ? jobCore.cancelJob(
            jobId,
            tick,
            (this.jobGenerations[jobId] ?? 0) === 0 ? ledger : undefined,
          )
        : jobCore.failJob(
            jobId,
            tick,
            jobReason,
            (this.jobGenerations[jobId] ?? 0) === 0 ? ledger : undefined,
          );
    if (!terminal.ok) {
      this.rollbackReturned(
        jobId,
        returned.returnedAmount,
        returned.returnedDefId,
        items,
        food,
        storage,
      );
      return { ok: false, reason: "eating_job_core_failed" };
    }

    this.clearCarried(jobId);
    this.stepCodes[jobId] =
      terminalReason === "food.job_canceled" ? EATING_STEP_CANCELED : EATING_STEP_FAILED;
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return this.finish(jobId, terminalReason);
  }

  private returnCarried(
    jobId: number,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
  ):
    | { readonly ok: true; readonly returnedAmount: number; readonly returnedDefId: number }
    | { readonly ok: false; readonly reason: M3EatingReason } {
    if ((this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED) !== EATING_STEP_PICKED_UP) {
      return { ok: true, returnedAmount: 0, returnedDefId: JOB_NONE };
    }

    const amount = this.carriedAmounts[jobId] ?? 0;
    const defId = this.carriedDefIds[jobId] ?? JOB_NONE;
    const returned = items.addQuantity(this.sourceStackIds[jobId] ?? 0, amount, defId);
    if (!returned.ok) {
      return { ok: false, reason: "eating_item_mutation_failed" };
    }
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
    return { ok: true, returnedAmount: amount, returnedDefId: defId };
  }

  private rollbackReturned(
    jobId: number,
    amount: number,
    defId: number,
    items: ItemStackStore,
    food: M3FoodAvailabilityStore,
    storage: StorageLogisticsIndex,
  ): void {
    if (amount === 0) {
      return;
    }
    const removed = items.removeQuantity(this.sourceStackIds[jobId] ?? 0, amount, defId);
    if (!removed.ok) {
      throw new Error(`failed to rollback returned eating quantity: ${removed.reason}`);
    }
    food.markStackDirty(this.sourceStackIds[jobId] ?? 0);
    storage.markSlotDirty(this.storageSlotIds[jobId] ?? 0);
  }

  private validateCreate(
    input: M3EatingJobCreateInput,
    registry: EntityRegistry,
  ): M3EatingMutationResult {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "eating_job_id_out_of_range" };
    }
    if (!registry.isAlive(input.owner)) {
      return { ok: false, reason: "eating_owner_invalid" };
    }
    if (!isSafeUint32(input.sourceStackId) || !isSafeUint32(input.storageSlotId)) {
      return { ok: false, reason: "eating_stack_invalid" };
    }
    if (!isPositiveUint32(input.amount)) {
      return { ok: false, reason: "eating_amount_invalid" };
    }
    if (!isNonNegativeNeedDelta(input.hungerRestore)) {
      return { ok: false, reason: "eating_need_delta_invalid" };
    }
    if (!input.abilityAllowed) {
      return { ok: false, reason: "food.rejected_ability" };
    }
    if (!isSafeUint32(input.createdTick)) {
      return { ok: false, reason: "eating_tick_invalid" };
    }
    return { ok: true, jobId: input.jobId, version: this.storeVersion, reason: "food.job_created" };
  }

  private validateStep(jobId: number, expectedStep: number): M3EatingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if ((this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED) !== expectedStep) {
      return { ok: false, reason: "eating_step_invalid" };
    }
    return { ok: true, jobId, version: this.storeVersion, reason: "food.job_created" };
  }

  private validateActive(jobId: number): M3EatingMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "eating_job_not_active" };
    }
    return { ok: true, jobId, version: this.storeVersion, reason: "food.job_created" };
  }

  private isActiveJob(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.active[jobId] ?? 0) === 1;
  }

  private isTerminalStep(jobId: number): boolean {
    const step = this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED;
    return (
      step === EATING_STEP_CONSUMED || step === EATING_STEP_CANCELED || step === EATING_STEP_FAILED
    );
  }

  private readOwner(jobId: number): EntityId {
    return {
      index: this.ownerIndexes[jobId] ?? 0,
      generation: this.ownerGenerations[jobId] ?? 0,
    };
  }

  private clearCarried(jobId: number): void {
    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
  }

  private finish(jobId: number, reason: M3EatingReason): M3EatingMutationResult {
    this.terminalReasonCodes[jobId] = encodeEatingReason(reason);
    this.storeVersion += 1;
    return { ok: true, jobId, version: this.storeVersion, reason };
  }

  private writeAdopted(
    control: ExistingClaimsAdoptionControl,
    input: M3EatingClaimAdoptionInput,
  ): void {
    const jobId = control.jobId;
    this.active[jobId] = 1;
    this.ownerIndexes[jobId] = control.ownerIndex;
    this.ownerGenerations[jobId] = control.ownerGeneration;
    this.sourceStackIds[jobId] = input.sourceStackId;
    this.itemEntityIndexes[jobId] = input.itemEntity.index;
    this.itemEntityGenerations[jobId] = input.itemEntity.generation;
    this.interactionSpotIds[jobId] = input.interactionSpotId;
    this.storageSlotIds[jobId] = input.storageSlotId;
    this.foodDefIds[jobId] = input.foodDefId;
    this.amounts[jobId] = input.amount;
    this.hungerRestores[jobId] = input.hungerRestore;
    this.itemStoreVersions[jobId] = input.itemStoreVersion;
    this.foodAvailabilityVersions[jobId] = input.foodAvailabilityVersion;
    this.mealWindowVersions[jobId] = input.mealWindowVersion;
    this.abilityAllowedFlags[jobId] = input.abilityAllowed ? 1 : 0;
    this.createdTicks[jobId] = control.claimCreatedTick;
    this.stepEnteredTicks[jobId] = control.adoptionTick;
    this.jobGenerations[jobId] = control.jobGeneration;
    this.jobSlotVersions[jobId] = this.jobTokenOutput.slotVersion;
    this.stepCodes[jobId] = EATING_STEP_RESERVED;
    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
    this.consumedDefIds[jobId] = JOB_NONE;
    this.consumedAmounts[jobId] = 0;
    this.terminalReasonCodes[jobId] = 0;
    this.effectPhases[jobId] = 0;
    this.pickupOnce[jobId] = 0;
    this.lastEffectTicks[jobId] = control.adoptionTick;
    this.pendingTerminalOutcomes[jobId] = 0;
    this.pendingTerminalFailures[jobId] = 0;
    this.pendingInterruptionKinds[jobId] = 0;
    this.cleanupPendingFlags[jobId] = 0;
    this.returnedOnceFlags[jobId] = 0;
    const base = jobId * 2;
    this.claimIds[base] = control.claimIds[0] ?? JOB_NONE;
    this.claimIds[base + 1] = control.claimIds[1] ?? JOB_NONE;
    this.claimEpochs[base] = control.claimEpochs[0] ?? 0;
    this.claimEpochs[base + 1] = control.claimEpochs[1] ?? 0;
    this.claimCreatedTicks[base] = input.claims.createdTicks[0] ?? 0;
    this.claimCreatedTicks[base + 1] = input.claims.createdTicks[1] ?? 0;
    this.claimLeaseExpiryTicks[base] = control.claimLeaseExpiryTicks[0] ?? 0;
    this.claimLeaseExpiryTicks[base + 1] = control.claimLeaseExpiryTicks[1] ?? 0;
    this.reservationVersions[jobId] = control.reservationReadVersion;
    this.activeCount += 1;
  }

  private matchesAdoptedCaller(
    input: M3EatingAdoptedPickupInput | M3EatingAdoptedConsumeInput | M3EatingAdoptedTerminalInput,
    jobCore: JobCoreStore,
    expectedStep: number,
    requiredDriverHeadroom: number,
  ): boolean {
    const jobId = input.jobId;
    const phase = isIndexInRange(jobId, this.capacity) ? (this.effectPhases[jobId] ?? 0) : 0;
    return (
      isIndexInRange(jobId, this.capacity) &&
      input.jobGeneration > 0 &&
      this.jobGenerations[jobId] === input.jobGeneration &&
      this.ownerIndexes[jobId] === input.owner.index &&
      this.ownerGenerations[jobId] === input.owner.generation &&
      this.jobSlotVersions[jobId] === input.expectedJobSlotVersion &&
      jobCore.version === input.expectedJobCoreVersion &&
      this.storeVersion === input.expectedDriverVersion &&
      isSafeUint32(input.expectedJobSlotVersion) &&
      isSafeUint32(input.expectedJobCoreVersion) &&
      isSafeUint32(input.expectedDriverVersion) &&
      input.expectedDriverVersion <= 0xffff_ffff - requiredDriverHeadroom &&
      isSafeUint32(input.expectedCurrentLedgerVersion) &&
      isSafeTick(input.tick) &&
      input.tick >= (this.createdTicks[jobId] ?? 0) &&
      input.tick >= (this.stepEnteredTicks[jobId] ?? 0) &&
      input.tick >= (this.lastEffectTicks[jobId] ?? 0) &&
      (phase !== 3 ||
        input.expectedCurrentLedgerVersion === (this.reservationVersions[jobId] ?? 0)) &&
      (phase === 3
        ? this.active[jobId] === 0 && this.stepCodes[jobId] === EATING_STEP_CONSUMED
        : this.active[jobId] === 1 && this.stepCodes[jobId] === expectedStep)
    );
  }

  private matchesPendingEatingTerminal(input: M3EatingAdoptedTerminalInput): boolean {
    return (
      this.pendingTerminalOutcomes[input.jobId] === encodeEatingTerminalOutcome(input.outcome) &&
      this.pendingTerminalFailures[input.jobId] === encodeEatingFailure(input.failureReason) &&
      this.pendingInterruptionKinds[input.jobId] ===
        encodeEatingInterruption(input.interruptionKind)
    );
  }

  private matchesEatingTerminalDuplicate(
    input: M3EatingAdoptedTerminalInput,
    jobCore: JobCoreStore,
  ): boolean {
    const jobId = input.jobId;
    const terminalStep = input.outcome === "failed" ? EATING_STEP_FAILED : EATING_STEP_CANCELED;
    return (
      isIndexInRange(jobId, this.capacity) &&
      input.jobGeneration > 0 &&
      this.jobGenerations[jobId] === input.jobGeneration &&
      this.active[jobId] === 0 &&
      this.ownerIndexes[jobId] === input.owner.index &&
      this.ownerGenerations[jobId] === input.owner.generation &&
      this.jobSlotVersions[jobId] === input.expectedJobSlotVersion &&
      jobCore.version === input.expectedJobCoreVersion &&
      this.storeVersion === input.expectedDriverVersion &&
      input.expectedCurrentLedgerVersion === (this.reservationVersions[jobId] ?? 0) &&
      isSafeUint32(input.expectedJobSlotVersion) &&
      isSafeUint32(input.expectedJobCoreVersion) &&
      isSafeUint32(input.expectedDriverVersion) &&
      isSafeUint32(input.expectedCurrentLedgerVersion) &&
      this.stepCodes[jobId] === terminalStep &&
      this.matchesPendingEatingTerminal(input) &&
      this.matchesCommittedTerminalJob(
        input,
        jobCore,
        input.outcome === "failed" ? "failed" : "canceled",
        input.failureReason,
      ) &&
      isSafeTick(input.tick) &&
      input.tick >= (this.lastEffectTicks[jobId] ?? 0)
    );
  }

  private matchesResumeCaller(input: M3EatingResumeCleanupInput, jobCore: JobCoreStore): boolean {
    const jobId = input.jobId;
    const expectedStep = this.pickupOnce[jobId] === 1 ? "interact" : "path_to_source";
    return (
      input.jobGeneration > 0 &&
      this.jobGenerations[jobId] === input.jobGeneration &&
      this.ownerIndexes[jobId] === input.owner.index &&
      this.ownerGenerations[jobId] === input.owner.generation &&
      this.jobSlotVersions[jobId] === input.expectedJobSlotVersion &&
      this.storeVersion === input.expectedDriverVersion &&
      input.expectedDriverVersion < 0xffff_ffff &&
      jobCore.version === input.expectedJobCoreVersion &&
      isSafeUint32(input.expectedCurrentLedgerVersion) &&
      isSafeTick(input.tick) &&
      input.tick >= (this.lastEffectTicks[jobId] ?? 0) &&
      this.matchesCommittedRunningJob(input, jobCore, expectedStep)
    );
  }

  private matchesPendingCleanup(input: M3EatingResumeCleanupInput): boolean {
    const outcomeCode =
      input.outcome === "consumed" ? 4 : encodeEatingTerminalOutcome(input.outcome);
    return (
      this.pendingTerminalOutcomes[input.jobId] === outcomeCode &&
      this.pendingTerminalFailures[input.jobId] === encodeEatingFailure(input.failureReason) &&
      this.pendingInterruptionKinds[input.jobId] ===
        encodeEatingInterruption(input.interruptionKind) &&
      (input.outcome === "consumed"
        ? input.failureReason === "none" && input.interruptionKind === undefined
        : isValidResumeTerminalInput(input))
    );
  }

  private matchesCommittedRunningJob(
    input: M3EatingAdoptedPickupInput | M3EatingAdoptedConsumeInput | M3EatingResumeCleanupInput,
    jobCore: JobCoreStore,
    expectedStep: "path_to_source" | "interact",
  ): boolean {
    jobCore.readCommittedAutonomyJobInto(
      input.jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      this.committedJobOutput,
    );
    return (
      this.committedJobOutput.ok &&
      this.committedJobOutput.state === "running" &&
      this.committedJobOutput.status === "running" &&
      this.committedJobOutput.step === expectedStep &&
      this.committedJobOutput.jobKind === M3_EATING_JOB_KIND &&
      this.committedJobOutput.targetId === (this.sourceStackIds[input.jobId] ?? JOB_NONE) &&
      this.committedJobOutput.createdTick === (this.createdTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.stepEnteredTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.lastMutationTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.carriedDefId ===
        (expectedStep === "interact" ? (this.foodDefIds[input.jobId] ?? JOB_NONE) : JOB_NONE) &&
      this.committedJobOutput.carriedAmount ===
        (expectedStep === "interact" ? (this.amounts[input.jobId] ?? 0) : 0) &&
      this.committedJobOutput.version === input.expectedJobCoreVersion
    );
  }

  private matchesCommittedTerminalJob(
    input: M3EatingAdoptedConsumeInput | M3EatingAdoptedTerminalInput,
    jobCore: JobCoreStore,
    expectedStatus: "completed" | "canceled" | "failed",
    expectedFailure: JobFailureReason,
  ): boolean {
    jobCore.readCommittedAutonomyJobInto(
      input.jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      this.committedJobOutput,
    );
    return (
      this.committedJobOutput.ok &&
      this.committedJobOutput.state === "tombstone" &&
      this.committedJobOutput.status === expectedStatus &&
      this.committedJobOutput.step === "complete" &&
      this.committedJobOutput.failureReason === expectedFailure &&
      this.committedJobOutput.terminalEffectPhase === 3 &&
      this.committedJobOutput.jobKind === M3_EATING_JOB_KIND &&
      this.committedJobOutput.targetId === (this.sourceStackIds[input.jobId] ?? JOB_NONE) &&
      this.committedJobOutput.createdTick === (this.createdTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.stepEnteredTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.lastMutationTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.carriedDefId === JOB_NONE &&
      this.committedJobOutput.carriedAmount === 0 &&
      this.committedJobOutput.version === input.expectedJobCoreVersion
    );
  }

  private matchesEatingReturnItem(
    jobId: number,
    addition: ItemStackQuantityAdditionPrepareInput,
    expectedLedgerVersion: number,
  ): boolean {
    return (
      addition.stackId === this.sourceStackIds[jobId] &&
      addition.entityIndex === this.itemEntityIndexes[jobId] &&
      addition.entityGeneration === this.itemEntityGenerations[jobId] &&
      addition.defId === this.carriedDefIds[jobId] &&
      addition.amount === this.carriedAmounts[jobId] &&
      addition.expectedReservationVersion === expectedLedgerVersion
    );
  }

  private commitEatingCleanupIntent(input: M3EatingAdoptedTerminalInput): void {
    const jobId = input.jobId;
    this.effectPhases[jobId] = 2;
    this.pendingTerminalOutcomes[jobId] = encodeEatingTerminalOutcome(input.outcome);
    this.pendingTerminalFailures[jobId] = encodeEatingFailure(input.failureReason);
    this.pendingInterruptionKinds[jobId] = encodeEatingInterruption(input.interruptionKind);
    this.cleanupPendingFlags[jobId] = 1;
    this.returnedOnceFlags[jobId] = this.pickupOnce[jobId] === 1 ? 1 : 0;
    this.lastEffectTicks[jobId] = input.tick;
    if (input.outcome === "failed") this.cumulativeFailedCount += 1;
    else if (input.outcome === "interrupted") this.cumulativeInterruptedCount += 1;
    else this.cumulativeCanceledCount += 1;
    this.storeVersion = input.expectedDriverVersion + 1;
  }

  private hasTerminalCounterHeadroom(outcome: M3EatingAdoptedTerminalOutcome): boolean {
    if (outcome === "failed") return this.cumulativeFailedCount < 0xffff_ffff;
    if (outcome === "interrupted") return this.cumulativeInterruptedCount < 0xffff_ffff;
    return this.cumulativeCanceledCount < 0xffff_ffff;
  }

  private writeReadMetrics(output: M3EatingAdoptedJobIntoOutput): void {
    output.activeCount = this.activeCount;
    output.reservedCount = 0;
    output.pickedUpCount = 0;
    output.consumedCount = 0;
    output.canceledCount = 0;
    output.failedCount = 0;
    output.interruptedCount = 0;
    output.currentInterruptedJobs = 0;
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const step = this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED;
      if (this.active[jobId] === 1) {
        output.reservedCount += step === EATING_STEP_RESERVED ? 1 : 0;
        output.pickedUpCount += step === EATING_STEP_PICKED_UP ? 1 : 0;
      } else {
        output.consumedCount += step === EATING_STEP_CONSUMED ? 1 : 0;
        output.canceledCount +=
          step === EATING_STEP_CANCELED && this.pendingTerminalOutcomes[jobId] !== 3 ? 1 : 0;
        output.interruptedCount +=
          step === EATING_STEP_CANCELED && this.pendingTerminalOutcomes[jobId] === 3 ? 1 : 0;
        output.failedCount += step === EATING_STEP_FAILED ? 1 : 0;
      }
    }
    output.currentInterruptedJobs = output.interruptedCount;
  }

  private writeEatingAdoptionSuccess(output: M3EatingClaimAdoptionOutput): void {
    writeAdoptionSuccess(this.jobTokenOutput, this.storeVersion, this.activeCount, output);
    output.jobCoreReservedCount = this.jobTokenOutput.reservedCount;
    output.ownerIndex = this.jobTokenOutput.ownerIndex;
    output.ownerGeneration = this.jobTokenOutput.ownerGeneration;
    output.jobCoreActiveCount = this.jobTokenOutput.activeCount;
    output.jobCoreRunningCount = this.jobTokenOutput.runningCount;
    output.jobCoreCurrentTombstoneCount = this.jobTokenOutput.currentTombstoneCount;
    output.jobCoreCumulativeTerminalCount = this.jobTokenOutput.cumulativeTerminalCount;
    output.driverReservedCount = 0;
    output.driverPickedUpCount = 0;
    output.driverConsumedCount = 0;
    output.driverCanceledCount = 0;
    output.driverFailedCount = 0;
    output.driverInterruptedCount = 0;
    output.currentInterruptedJobs = 0;
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const step = this.stepCodes[jobId] ?? EATING_STEP_UNASSIGNED;
      if (this.active[jobId] === 1) {
        output.driverReservedCount += step === EATING_STEP_RESERVED ? 1 : 0;
        output.driverPickedUpCount += step === EATING_STEP_PICKED_UP ? 1 : 0;
      } else {
        output.driverConsumedCount += step === EATING_STEP_CONSUMED ? 1 : 0;
        output.driverCanceledCount +=
          step === EATING_STEP_CANCELED && this.pendingTerminalOutcomes[jobId] !== 3 ? 1 : 0;
        output.driverInterruptedCount +=
          step === EATING_STEP_CANCELED && this.pendingTerminalOutcomes[jobId] === 3 ? 1 : 0;
        output.driverFailedCount += step === EATING_STEP_FAILED ? 1 : 0;
      }
    }
    output.currentInterruptedJobs = output.driverInterruptedCount;
    output.reservationAttemptCount = this.reservationAttempts;
    output.reservationFailureCount = this.reservationFailures;
    output.cumulativeConsumedCount = this.cumulativeConsumedCount;
    output.cumulativeCanceledCount = this.cumulativeCanceledCount;
    output.cumulativeFailedCount = this.cumulativeFailedCount;
    output.cumulativeInterruptedCount = this.cumulativeInterruptedCount;
    output.consumedAmountTotal = this.consumedAmountTotal;
  }

  private readExactClaims(
    input: M3EatingAdoptedPickupInput | M3EatingAdoptedConsumeInput | M3EatingAdoptedTerminalInput,
    ledger: ReservationLedger,
    claims: ReservationClaimsIntoOutput,
  ): boolean {
    const base = input.jobId * 2;
    for (let index = 0; index < 8; index += 1) {
      this.claimReadIds[index] = index < 2 ? (this.claimIds[base + index] ?? JOB_NONE) : JOB_NONE;
      this.claimReadEpochs[index] = index < 2 ? (this.claimEpochs[base + index] ?? 0) : 0;
    }
    ledger.readActiveClaimsInto(
      this.claimReadIds,
      this.claimReadEpochs,
      2,
      input.owner,
      input.jobId,
      input.jobGeneration,
      input.expectedCurrentLedgerVersion,
      claims,
    );
    if (
      !claims.ok ||
      claims.claimCount !== 2 ||
      claims.version !== input.expectedCurrentLedgerVersion
    )
      return false;
    for (let index = 0; index < 2; index += 1) {
      if (
        (this.claimReadIds[index] ?? JOB_NONE) !== (this.claimIds[base + index] ?? JOB_NONE) ||
        (claims.allocationEpochs[index] ?? 0) !== (this.claimEpochs[base + index] ?? 0) ||
        (claims.ownerIndexes[index] ?? JOB_NONE) !== input.owner.index ||
        (claims.ownerGenerations[index] ?? 0) !== input.owner.generation ||
        (claims.jobIds[index] ?? JOB_NONE) !== input.jobId ||
        (claims.jobGenerations[index] ?? 0) !== input.jobGeneration ||
        (claims.hasTargetFlags[index] ?? 0) !== 1 ||
        (claims.targetIndexes[index] ?? JOB_NONE) !== this.itemEntityIndexes[input.jobId] ||
        (claims.targetGenerations[index] ?? 0) !== this.itemEntityGenerations[input.jobId] ||
        (claims.cellIndexes[index] ?? 0) !== JOB_NONE ||
        (claims.createdTicks[index] ?? 0) !== (this.claimCreatedTicks[base + index] ?? 0) ||
        (claims.leaseExpiryTicks[index] ?? 0) !== (this.claimLeaseExpiryTicks[base + index] ?? 0)
      )
        return false;
    }
    if (
      claims.channelCodes[0] !== RESERVATION_ITEM_QUANTITY ||
      claims.slotIds[0] !== JOB_NONE ||
      claims.amounts[0] !== this.amounts[input.jobId] ||
      claims.channelCodes[1] !== RESERVATION_INTERACTION_SPOT ||
      claims.slotIds[1] !== this.interactionSpotIds[input.jobId] ||
      claims.amounts[1] !== 0
    )
      return false;
    for (let index = 2; index < 8; index += 1) {
      if (
        (claims.channelCodes[index] ?? 0) !== 0 ||
        (claims.ownerIndexes[index] ?? 0) !== JOB_NONE ||
        (claims.ownerGenerations[index] ?? 0) !== 0 ||
        (claims.jobIds[index] ?? 0) !== JOB_NONE ||
        (claims.jobGenerations[index] ?? 0) !== 0 ||
        (claims.hasTargetFlags[index] ?? 0) !== 0 ||
        (claims.targetIndexes[index] ?? 0) !== JOB_NONE ||
        (claims.targetGenerations[index] ?? 0) !== 0 ||
        (claims.cellIndexes[index] ?? 0) !== JOB_NONE ||
        (claims.slotIds[index] ?? 0) !== JOB_NONE ||
        (claims.amounts[index] ?? 0) !== 0 ||
        (claims.allocationEpochs[index] ?? 0) !== 0 ||
        (claims.createdTicks[index] ?? 0) !== 0 ||
        (claims.leaseExpiryTicks[index] ?? 0) !== 0
      )
        return false;
    }
    return true;
  }

  private releaseClaimsForTerminal(
    jobId: number,
    ledger: ReservationLedger,
    expectedLedgerVersion = ledger.version,
  ): boolean {
    const generation = this.jobGenerations[jobId] ?? 0;
    if (generation === 0) return true;
    this.releaseOwnerScratch.index = this.ownerIndexes[jobId] ?? 0;
    this.releaseOwnerScratch.generation = this.ownerGenerations[jobId] ?? 0;
    releaseStoredAutonomyClaimsInto(
      ledger,
      this.claimIds,
      this.claimEpochs,
      jobId * 2,
      2,
      this.releaseOwnerScratch,
      jobId,
      generation,
      expectedLedgerVersion,
      this.releaseClaimIds,
      this.releaseClaimEpochs,
      this.releaseOutput,
    );
    return this.releaseOutput.ok;
  }
}

export function createM3EatingJobDriverStore(capacity: number): M3EatingJobDriverStore {
  return new M3EatingJobDriverStore(capacity);
}

export function restoreM3EatingJobDriverStore(
  snapshot: M3EatingJobSnapshot,
): M3EatingJobDriverStore {
  const store = createM3EatingJobDriverStore(snapshot.capacity);
  const restored = store.restoreFromSnapshot(snapshot);
  if (!restored.ok) throw new Error(restored.reason);
  return store;
}

export function createM3EatingJobHashFields(
  snapshot: M3EatingJobSnapshot,
  prefix = "m3Eating",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.storeVersion`, value: snapshot.storeVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
    { name: `${prefix}.reservationAttempts`, value: snapshot.reservationAttempts },
    { name: `${prefix}.reservationFailures`, value: snapshot.reservationFailures },
    { name: `${prefix}.consumedAmountTotal`, value: snapshot.consumedAmountTotal },
    { name: `${prefix}.cumulativeConsumedCount`, value: snapshot.cumulativeConsumedCount },
    { name: `${prefix}.cumulativeCanceledCount`, value: snapshot.cumulativeCanceledCount },
    { name: `${prefix}.cumulativeFailedCount`, value: snapshot.cumulativeFailedCount },
    { name: `${prefix}.cumulativeInterruptedCount`, value: snapshot.cumulativeInterruptedCount },
  ];
  for (let jobId = 0; jobId < snapshot.rows.length; jobId += 1) {
    const row = snapshot.rows[jobId];
    if (row === undefined) continue;
    const values = eatingSnapshotRowValues(row);
    for (let index = 0; index < EATING_ROW_SCALAR_KEYS.length; index += 1) {
      fields.push({
        name: `${prefix}.row.${String(jobId)}.${EATING_ROW_SCALAR_KEYS[index] ?? "unknown"}`,
        value: values[index] ?? 0,
      });
    }
    fields.push({ name: `${prefix}.row.${String(jobId)}.claimId.0`, value: row.claimIds[0] ?? 0 });
    fields.push({ name: `${prefix}.row.${String(jobId)}.claimId.1`, value: row.claimIds[1] ?? 0 });
    fields.push({
      name: `${prefix}.row.${String(jobId)}.claimEpoch.0`,
      value: row.claimEpochs[0] ?? 0,
    });
    fields.push({
      name: `${prefix}.row.${String(jobId)}.claimEpoch.1`,
      value: row.claimEpochs[1] ?? 0,
    });
    fields.push({
      name: `${prefix}.row.${String(jobId)}.claimCreatedTick.0`,
      value: row.claimCreatedTicks[0] ?? 0,
    });
    fields.push({
      name: `${prefix}.row.${String(jobId)}.claimCreatedTick.1`,
      value: row.claimCreatedTicks[1] ?? 0,
    });
    fields.push({
      name: `${prefix}.row.${String(jobId)}.claimLeaseExpiryTick.0`,
      value: row.claimLeaseExpiryTicks[0] ?? 0,
    });
    fields.push({
      name: `${prefix}.row.${String(jobId)}.claimLeaseExpiryTick.1`,
      value: row.claimLeaseExpiryTicks[1] ?? 0,
    });
  }
  return fields;
}

export function calculateM3FoodConservationTotal(
  items: ItemStackStore,
  eating: M3EatingJobDriverStore,
  foodDefId: number,
  stackCount: number,
): number {
  let total = 0;

  for (let stackId = 0; stackId < stackCount; stackId += 1) {
    const stack = items.readStack(stackId);
    if (stack?.defId === foodDefId) {
      total += stack.quantity;
    }
  }

  for (let jobId = 0; jobId < eating.capacity; jobId += 1) {
    const job = eating.readJob(jobId);
    if (job?.carriedDefId === foodDefId) {
      total += job.carriedAmount;
    }
    if (job?.consumedDefId === foodDefId) {
      total += job.consumedAmount;
    }
  }

  return total;
}

function mapReservationReason(reason: ReservationReason): M3EatingReason {
  if (reason === "reservation_item_quantity_conflict") {
    return "reservation.item_quantity_conflict";
  }
  if (reason === "reservation_interaction_conflict") {
    return "reservation.interaction_spot_conflict";
  }
  if (reason === "reservation_insufficient_amount") {
    return "reservation.insufficient_amount";
  }
  return "reservation.failed";
}

function rollbackItemAdd(
  items: ItemStackStore,
  stackId: number,
  amount: number,
  defId: number,
): void {
  const restored = items.addQuantity(stackId, amount, defId);
  if (!restored.ok) {
    throw new Error(`failed to rollback eating pickup quantity: ${restored.reason}`);
  }
}

function rollbackCarriedClear(jobCore: JobCoreStore, jobId: number): void {
  const cleared = jobCore.setCarriedState(jobId, JOB_NONE, 0);
  if (!cleared.ok) {
    throw new Error(`failed to rollback eating carried state: ${cleared.reason}`);
  }
}

function createJobTokenOutput(): JobTokenIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: JOB_NONE,
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

function createCommittedJobOutput(): AutonomyCommittedJobIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: JOB_NONE,
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
    carriedDefId: JOB_NONE,
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

function createReleaseOutput(): ReservationReleaseIntoOutput {
  return {
    ok: false,
    reason: undefined,
    claimIndex: JOB_NONE,
    claimId: JOB_NONE,
    releasedCount: 0,
    version: 0,
    activeCount: 0,
  };
}

function createPreparedItemRemoval(): PreparedItemStackQuantityRemoval {
  return {
    ok: false,
    reason: undefined,
    stackId: JOB_NONE,
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

function createPreparedCarriedStep(): PreparedAutonomyCarriedStep {
  return {
    ok: false,
    reason: undefined,
    jobId: JOB_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    defId: JOB_NONE,
    amount: 0,
    stepCode: 0,
    tick: 0,
    nextSlotVersion: 0,
    nextJobCoreVersion: 0,
  };
}

function createPreparedNeedMutation(): PreparedNeedLaneMutation {
  return {
    ok: false,
    reason: undefined,
    actorId: JOB_NONE,
    lane: NEED_LANE_HUNGER,
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

function createPreparedTerminal(): PreparedAutonomyTerminal {
  return {
    ok: false,
    reason: undefined,
    jobId: JOB_NONE,
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

function createItemOutput(): ItemStackIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    stackId: JOB_NONE,
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

function resetAdoptedMutationOutput(output: M3EatingAdoptedMutationOutput): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.jobSlotVersion = 0;
  output.jobCoreVersion = 0;
  output.driverVersion = 0;
  output.reservationVersion = 0;
  output.itemRowVersion = 0;
  output.itemStoreVersion = 0;
  output.needLaneVersion = 0;
  output.needStoreVersion = 0;
  output.cleanupPending = false;
  output.alreadyCommitted = false;
  output.releasedClaimCount = 0;
  output.terminalOutcome = undefined;
}

function writeAdoptedMutationSuccess(
  input: M3EatingAdoptedPickupInput | M3EatingAdoptedConsumeInput | M3EatingAdoptedTerminalInput,
  jobSlotVersion: number,
  jobCoreVersion: number,
  driverVersion: number,
  reservationVersion: number,
  itemRowVersion: number,
  itemStoreVersion: number,
  needLaneVersion: number,
  needStoreVersion: number,
  cleanupPending: boolean,
  alreadyCommitted: boolean,
  releasedClaimCount: number,
  output: M3EatingAdoptedMutationOutput,
): void {
  output.ok = true;
  output.jobId = input.jobId;
  output.jobGeneration = input.jobGeneration;
  output.jobSlotVersion = jobSlotVersion;
  output.jobCoreVersion = jobCoreVersion;
  output.driverVersion = driverVersion;
  output.reservationVersion = reservationVersion;
  output.itemRowVersion = itemRowVersion;
  output.itemStoreVersion = itemStoreVersion;
  output.needLaneVersion = needLaneVersion;
  output.needStoreVersion = needStoreVersion;
  output.cleanupPending = cleanupPending;
  output.alreadyCommitted = alreadyCommitted;
  output.releasedClaimCount = releasedClaimCount;
}

function writeResumeCleanupSuccess(
  input: M3EatingResumeCleanupInput,
  jobSlotVersion: number,
  jobCoreVersion: number,
  driverVersion: number,
  reservationVersion: number,
  cleanupPending: boolean,
  releasedClaimCount: number,
  output: M3EatingAdoptedMutationOutput,
): void {
  output.ok = true;
  output.jobId = input.jobId;
  output.jobGeneration = input.jobGeneration;
  output.jobSlotVersion = jobSlotVersion;
  output.jobCoreVersion = jobCoreVersion;
  output.driverVersion = driverVersion;
  output.reservationVersion = reservationVersion;
  output.cleanupPending = cleanupPending;
  output.releasedClaimCount = releasedClaimCount;
}

function matchesEatingReadClaimPrefix(
  control: ExistingClaimsAdoptionControl,
  readIds: Uint32Array,
  readEpochs: Uint32Array,
  claims: ReservationClaimsIntoOutput,
): boolean {
  if (readIds.length < 2 || readEpochs.length < 2) return false;
  for (let index = 0; index < 2; index += 1) {
    if (
      (readIds[index] ?? JOB_NONE) !== (control.claimIds[index] ?? JOB_NONE) ||
      (readEpochs[index] ?? 0) !== (control.claimEpochs[index] ?? 0) ||
      (readEpochs[index] ?? 0) !== (claims.allocationEpochs[index] ?? 0)
    )
      return false;
  }
  return true;
}

function isExactEatingAdoptionPreflight(
  control: ExistingClaimsAdoptionControl,
  input: M3EatingClaimAdoptionInput,
  capacity: number,
): boolean {
  if (
    !isIndexInRange(control.jobId, capacity) ||
    input.jobId !== control.jobId ||
    !isSafeUint32(control.jobGeneration) ||
    control.jobGeneration === 0 ||
    !isSafeUint32(control.ownerIndex) ||
    !isSafeUint32(control.ownerGeneration) ||
    control.ownerGeneration === 0 ||
    input.owner.index !== control.ownerIndex ||
    input.owner.generation !== control.ownerGeneration ||
    !isSafeUint32(input.sourceStackId) ||
    input.sourceStackId === JOB_NONE ||
    !isSafeUint32(input.storageSlotId) ||
    input.storageSlotId === JOB_NONE ||
    !isSafeUint32(input.foodDefId) ||
    input.foodDefId === JOB_NONE ||
    !isPositiveUint32(input.amount) ||
    !isNonNegativeNeedDelta(input.hungerRestore) ||
    !isSafeUint32(input.itemStoreVersion) ||
    !isSafeUint32(input.foodAvailabilityVersion) ||
    !isSafeUint32(input.mealWindowVersion) ||
    !isEatingAbilityAllowed(input.abilityAllowed) ||
    !isSafeTick(input.createdTick) ||
    input.createdTick !== control.claimCreatedTick ||
    !isSafeUint32(input.itemEntity.index) ||
    input.itemEntity.index === JOB_NONE ||
    !isPositiveUint32(input.itemEntity.generation) ||
    !isSafeUint32(input.interactionSpotId) ||
    input.interactionSpotId === JOB_NONE ||
    input.readClaimIds.length !== 8 ||
    input.readClaimEpochs.length !== 8
  )
    return false;
  const claims = input.claims;
  if (
    (claims.channelCodes[0] ?? 0) !== RESERVATION_ITEM_QUANTITY ||
    (claims.channelCodes[1] ?? 0) !== RESERVATION_INTERACTION_SPOT ||
    (claims.hasTargetFlags[0] ?? 0) !== 1 ||
    (claims.hasTargetFlags[1] ?? 0) !== 1 ||
    (claims.targetIndexes[0] ?? JOB_NONE) !== input.itemEntity.index ||
    (claims.targetIndexes[1] ?? JOB_NONE) !== input.itemEntity.index ||
    (claims.targetGenerations[0] ?? 0) !== input.itemEntity.generation ||
    (claims.targetGenerations[1] ?? 0) !== input.itemEntity.generation ||
    (claims.cellIndexes[0] ?? 0) !== JOB_NONE ||
    (claims.cellIndexes[1] ?? 0) !== JOB_NONE ||
    (claims.slotIds[0] ?? 0) !== JOB_NONE ||
    (claims.slotIds[1] ?? JOB_NONE) !== input.interactionSpotId ||
    (claims.amounts[0] ?? 0) !== input.amount ||
    (claims.amounts[1] ?? 0) !== 0
  )
    return false;
  for (let index = 2; index < 8; index += 1) {
    if ((input.readClaimIds[index] ?? 0) !== JOB_NONE || (input.readClaimEpochs[index] ?? 0) !== 0)
      return false;
  }
  return true;
}

function isExactEatingRollbackControl(
  control: NewlyAdoptedRollbackControl,
  capacity: number,
  currentJobCoreVersion: number,
): boolean {
  if (
    !isIndexInRange(control.jobId, capacity) ||
    control.claimCount !== 2 ||
    !isPositiveUint32(control.jobGeneration) ||
    !isSafeUint32(control.ownerIndex) ||
    !isPositiveUint32(control.ownerGeneration) ||
    !isSafeUint32(control.expectedJobSlotVersion) ||
    control.expectedJobSlotVersion > 0xffff_fffd ||
    control.expectedAdoptedJobSlotVersion !== control.expectedJobSlotVersion + 1 ||
    !isSafeUint32(control.expectedJobCoreVersion) ||
    control.expectedJobCoreVersion > 0xffff_fffd ||
    currentJobCoreVersion !== control.expectedJobCoreVersion + 1 ||
    !isSafeUint32(control.expectedDriverVersion) ||
    control.expectedDriverVersion > 0xffff_fffd ||
    control.expectedAdoptedDriverVersion !== control.expectedDriverVersion + 1 ||
    !isSafeUint32(control.reservationReadVersion) ||
    !isSafeTick(control.claimCreatedTick) ||
    !isSafeTick(control.adoptionTick) ||
    control.adoptionTick < control.claimCreatedTick ||
    control.claimIds.length !== 8 ||
    control.claimEpochs.length !== 8 ||
    control.claimLeaseExpiryTicks.length !== 8
  )
    return false;
  for (let index = 0; index < 2; index += 1) {
    if (
      (control.claimIds[index] ?? JOB_NONE) === JOB_NONE ||
      !isPositiveUint32(control.claimEpochs[index] ?? 0) ||
      !isSafeTick(control.claimLeaseExpiryTicks[index] ?? -1) ||
      (control.claimLeaseExpiryTicks[index] ?? -1) < control.claimCreatedTick
    )
      return false;
  }
  for (let index = 2; index < 8; index += 1) {
    if (
      (control.claimIds[index] ?? 0) !== JOB_NONE ||
      (control.claimEpochs[index] ?? 0) !== 0 ||
      (control.claimLeaseExpiryTicks[index] ?? 0) !== 0
    )
      return false;
  }
  return true;
}

function isValidEatingTerminalInput(input: M3EatingAdoptedTerminalInput): boolean {
  if (input.outcome === "canceled") {
    return input.failureReason === "cancelled" && input.interruptionKind === undefined;
  }
  if (input.outcome === "interrupted") {
    return input.failureReason === "cancelled" && input.interruptionKind !== undefined;
  }
  return (
    input.failureReason !== "none" &&
    input.failureReason !== "cancelled" &&
    input.interruptionKind === undefined
  );
}

function isValidResumeTerminalInput(input: M3EatingResumeCleanupInput): boolean {
  if (input.outcome === "canceled") {
    return input.failureReason === "cancelled" && input.interruptionKind === undefined;
  }
  if (input.outcome === "interrupted") {
    return input.failureReason === "cancelled" && input.interruptionKind !== undefined;
  }
  return (
    input.outcome === "failed" &&
    input.failureReason !== "none" &&
    input.failureReason !== "cancelled" &&
    input.interruptionKind === undefined
  );
}

function encodeEatingTerminalOutcome(outcome: M3EatingAdoptedTerminalOutcome): number {
  if (outcome === "canceled") return 1;
  if (outcome === "failed") return 2;
  return 3;
}

function encodeEatingFailure(reason: JobFailureReason): number {
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

function encodeEatingInterruption(kind: JobInterruptionKind | undefined): number {
  if (kind === "safe_point") return 1;
  if (kind === "immediate") return 2;
  if (kind === "emergency") return 3;
  return 0;
}

function decodeEatingTerminalOutcome(
  code: number,
): M3EatingAdoptedTerminalOutcome | "consumed" | undefined {
  if (code === 1) return "canceled";
  if (code === 2) return "failed";
  if (code === 3) return "interrupted";
  if (code === 4) return "consumed";
  return undefined;
}

function decodeEatingFailure(code: number): JobFailureReason {
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

function decodeEatingInterruption(code: number): JobInterruptionKind | undefined {
  if (code === 1) return "safe_point";
  if (code === 2) return "immediate";
  if (code === 3) return "emergency";
  return undefined;
}

function resetEatingAdoptedJobOutput(
  output: M3EatingAdoptedJobIntoOutput,
  driverVersion: number,
): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.sourceStackId = 0;
  output.storageSlotId = 0;
  output.foodDefId = 0;
  output.amount = 0;
  output.hungerRestore = 0;
  output.itemEntityIndex = 0;
  output.itemEntityGeneration = 0;
  output.interactionSpotId = 0;
  output.itemStoreVersion = 0;
  output.foodAvailabilityVersion = 0;
  output.mealWindowVersion = 0;
  output.abilityAllowed = false;
  output.claimIds.fill(JOB_NONE);
  output.claimEpochs.fill(0);
  output.claimCreatedTicks.fill(0);
  output.claimLeaseExpiryTicks.fill(0);
  output.createdTick = 0;
  output.stepEnteredTick = 0;
  output.step = "unassigned";
  output.carriedDefId = JOB_NONE;
  output.carriedAmount = 0;
  output.consumedDefId = JOB_NONE;
  output.consumedAmount = 0;
  output.jobSlotVersion = 0;
  output.driverVersion = driverVersion;
  output.reservationVersion = 0;
  output.effectPhase = 0;
  output.cleanupPending = 0;
  output.returnedOnce = 0;
  output.pickupCommitted = false;
  output.lastEffectTick = 0;
  output.pendingOutcome = undefined;
  output.pendingFailure = "none";
  output.pendingInterruption = undefined;
  output.terminalReason = "food.job_created";
  output.activeCount = 0;
  output.reservedCount = 0;
  output.pickedUpCount = 0;
  output.consumedCount = 0;
  output.canceledCount = 0;
  output.failedCount = 0;
  output.interruptedCount = 0;
  output.currentInterruptedJobs = 0;
  output.reservationAttemptCount = 0;
  output.reservationFailureCount = 0;
  output.cumulativeConsumedCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
  output.cumulativeInterruptedCount = 0;
  output.consumedAmountTotal = 0;
}

const EATING_SNAPSHOT_KEYS = [
  "snapshotVersion",
  "capacity",
  "storeVersion",
  "activeCount",
  "reservationAttempts",
  "reservationFailures",
  "consumedAmountTotal",
  "cumulativeConsumedCount",
  "cumulativeCanceledCount",
  "cumulativeFailedCount",
  "cumulativeInterruptedCount",
  "rows",
] as const;
const EATING_ROW_KEYS = [
  "jobId",
  "active",
  "ownerIndex",
  "ownerGeneration",
  "sourceStackId",
  "storageSlotId",
  "foodDefId",
  "amount",
  "hungerRestore",
  "itemEntityIndex",
  "itemEntityGeneration",
  "interactionSpotId",
  "itemStoreVersion",
  "foodAvailabilityVersion",
  "mealWindowVersion",
  "abilityAllowed",
  "createdTick",
  "stepEnteredTick",
  "jobGeneration",
  "jobSlotVersion",
  "claimIds",
  "claimEpochs",
  "claimCreatedTicks",
  "claimLeaseExpiryTicks",
  "reservationVersion",
  "effectPhase",
  "stepCode",
  "carriedDefId",
  "carriedAmount",
  "cleanupPending",
  "returnedOnce",
  "consumedDefId",
  "consumedAmount",
  "terminalReasonCode",
  "pickupOnce",
  "lastEffectTick",
  "pendingTerminalOutcome",
  "pendingTerminalFailure",
  "pendingInterruptionKind",
] as const;
const EATING_ROW_SCALAR_KEYS = [
  "jobId",
  "active",
  "ownerIndex",
  "ownerGeneration",
  "sourceStackId",
  "storageSlotId",
  "foodDefId",
  "amount",
  "hungerRestore",
  "itemEntityIndex",
  "itemEntityGeneration",
  "interactionSpotId",
  "itemStoreVersion",
  "foodAvailabilityVersion",
  "mealWindowVersion",
  "abilityAllowed",
  "createdTick",
  "stepEnteredTick",
  "jobGeneration",
  "jobSlotVersion",
  "reservationVersion",
  "effectPhase",
  "cleanupPending",
  "returnedOnce",
  "stepCode",
  "carriedDefId",
  "carriedAmount",
  "consumedDefId",
  "consumedAmount",
  "terminalReasonCode",
  "pickupOnce",
  "lastEffectTick",
  "pendingTerminalOutcome",
  "pendingTerminalFailure",
  "pendingInterruptionKind",
] as const;

function isM3EatingSnapshot(value: unknown, capacity: number): value is M3EatingJobSnapshot {
  if (
    !isEatingExactRecord(value, EATING_SNAPSHOT_KEYS) ||
    value["snapshotVersion"] !== M3_EATING_JOB_SNAPSHOT_VERSION ||
    value["capacity"] !== capacity ||
    !isEatingUint32(value["storeVersion"]) ||
    !isEatingUint32(value["activeCount"]) ||
    !isEatingUint32(value["reservationAttempts"]) ||
    !isEatingUint32(value["reservationFailures"]) ||
    value["reservationFailures"] > value["reservationAttempts"] ||
    !isEatingUint32(value["consumedAmountTotal"]) ||
    !isEatingUint32(value["cumulativeCanceledCount"]) ||
    !isEatingUint32(value["cumulativeFailedCount"]) ||
    !isEatingUint32(value["cumulativeInterruptedCount"]) ||
    !isEatingUint32(value["cumulativeConsumedCount"]) ||
    !isEatingDenseArray(value["rows"], capacity)
  )
    return false;
  let activeCount = 0;
  let consumedRows = 0;
  let canceledRows = 0;
  let failedRows = 0;
  let interruptedRows = 0;
  let currentConsumedAmount = 0;
  for (let jobId = 0; jobId < capacity; jobId += 1) {
    const row = value["rows"][jobId];
    if (!isM3EatingSnapshotRow(row, jobId)) return false;
    activeCount += row.active;
    if (row.effectPhase >= 2) {
      consumedRows += row.pendingTerminalOutcome === 4 ? 1 : 0;
      canceledRows += row.pendingTerminalOutcome === 1 ? 1 : 0;
      failedRows += row.pendingTerminalOutcome === 2 ? 1 : 0;
      interruptedRows += row.pendingTerminalOutcome === 3 ? 1 : 0;
      if (row.pendingTerminalOutcome === 4) {
        if (row.consumedAmount > 0xffff_ffff - currentConsumedAmount) return false;
        currentConsumedAmount += row.consumedAmount;
      }
    }
  }
  return (
    activeCount === value["activeCount"] &&
    consumedRows <= value["cumulativeConsumedCount"] &&
    canceledRows <= value["cumulativeCanceledCount"] &&
    failedRows <= value["cumulativeFailedCount"] &&
    interruptedRows <= value["cumulativeInterruptedCount"] &&
    currentConsumedAmount <= value["consumedAmountTotal"]
  );
}

function hasM3EatingSnapshotRowShape(
  value: unknown,
  jobId: number,
): value is M3EatingJobSnapshotRow {
  if (
    !isEatingExactRecord(value, EATING_ROW_KEYS) ||
    value["jobId"] !== jobId ||
    (value["active"] !== 0 && value["active"] !== 1) ||
    !isEatingUint32(value["ownerIndex"]) ||
    !isEatingUint32(value["ownerGeneration"]) ||
    !isEatingUint32(value["sourceStackId"]) ||
    !isEatingUint32(value["storageSlotId"]) ||
    !isEatingUint32(value["foodDefId"]) ||
    !isEatingUint32(value["amount"]) ||
    !isEatingUint32(value["hungerRestore"]) ||
    !isEatingUint32(value["itemEntityIndex"]) ||
    !isEatingUint32(value["itemEntityGeneration"]) ||
    !isEatingUint32(value["interactionSpotId"]) ||
    !isEatingUint32(value["itemStoreVersion"]) ||
    !isEatingUint32(value["foodAvailabilityVersion"]) ||
    !isEatingUint32(value["mealWindowVersion"]) ||
    (value["abilityAllowed"] !== 0 && value["abilityAllowed"] !== 1) ||
    !isEatingTick(value["createdTick"]) ||
    !isEatingTick(value["stepEnteredTick"]) ||
    value["stepEnteredTick"] < value["createdTick"] ||
    !isEatingUint32(value["jobGeneration"]) ||
    !isEatingUint32(value["jobSlotVersion"]) ||
    !isEatingPair(value["claimIds"]) ||
    !isEatingPair(value["claimEpochs"]) ||
    !isEatingTickPair(value["claimCreatedTicks"]) ||
    !isEatingTickPair(value["claimLeaseExpiryTicks"]) ||
    !isEatingUint32(value["reservationVersion"]) ||
    !isEatingUint32(value["effectPhase"]) ||
    value["effectPhase"] > 3 ||
    (value["cleanupPending"] !== 0 && value["cleanupPending"] !== 1) ||
    (value["returnedOnce"] !== 0 && value["returnedOnce"] !== 1) ||
    !isEatingUint32(value["stepCode"]) ||
    value["stepCode"] > EATING_STEP_FAILED ||
    !isEatingUint32(value["carriedDefId"]) ||
    !isEatingUint32(value["carriedAmount"]) ||
    !isEatingUint32(value["consumedDefId"]) ||
    !isEatingUint32(value["consumedAmount"]) ||
    !isEatingUint32(value["terminalReasonCode"]) ||
    value["terminalReasonCode"] > 5 ||
    (value["pickupOnce"] !== 0 && value["pickupOnce"] !== 1) ||
    !isEatingTick(value["lastEffectTick"]) ||
    !isEatingUint32(value["pendingTerminalOutcome"]) ||
    value["pendingTerminalOutcome"] > 4 ||
    !isEatingUint32(value["pendingTerminalFailure"]) ||
    value["pendingTerminalFailure"] > 8 ||
    !isEatingUint32(value["pendingInterruptionKind"]) ||
    value["pendingInterruptionKind"] > 3
  )
    return false;
  return true;
}

function isM3EatingSnapshotRow(value: unknown, jobId: number): value is M3EatingJobSnapshotRow {
  if (!hasM3EatingSnapshotRowShape(value, jobId)) return false;
  if (value.jobGeneration === 0)
    return isVirginEatingRow(value) || isRollbackShadowEatingRow(value);
  if (
    value.ownerGeneration === 0 ||
    value.itemEntityGeneration === 0 ||
    value.jobSlotVersion === 0 ||
    value.reservationVersion === 0 ||
    value.lastEffectTick < value.createdTick ||
    value.amount === 0 ||
    value.abilityAllowed !== 1 ||
    value.hungerRestore > NEED_DELTA_MAX ||
    value.sourceStackId === JOB_NONE ||
    value.storageSlotId === JOB_NONE ||
    value.foodDefId === JOB_NONE ||
    value.itemEntityIndex === JOB_NONE ||
    value.interactionSpotId === JOB_NONE
  )
    return false;
  if (value.effectPhase < 3 && (!hasEatingClaims(value) || value.claimIds[0] === value.claimIds[1]))
    return false;
  if (value.effectPhase <= 1 && value.lastEffectTick !== value.stepEnteredTick) return false;
  if (value.effectPhase === 0) return isReservedEatingRow(value);
  if (value.effectPhase === 1) return isPickedUpEatingRow(value);
  if (value.effectPhase === 2) return isCleanupPendingEatingRow(value);
  return isTerminalEatingRow(value);
}

function hasEatingClaims(row: M3EatingJobSnapshotRow): boolean {
  const firstCreatedTick = row.claimCreatedTicks[0];
  const secondCreatedTick = row.claimCreatedTicks[1];
  const firstLeaseExpiryTick = row.claimLeaseExpiryTicks[0];
  const secondLeaseExpiryTick = row.claimLeaseExpiryTicks[1];
  return (
    row.claimIds[0] !== JOB_NONE &&
    row.claimIds[1] !== JOB_NONE &&
    row.claimEpochs[0] !== 0 &&
    row.claimEpochs[1] !== 0 &&
    firstCreatedTick === row.createdTick &&
    secondCreatedTick === row.createdTick &&
    firstLeaseExpiryTick !== undefined &&
    secondLeaseExpiryTick !== undefined &&
    firstLeaseExpiryTick >= firstCreatedTick &&
    secondLeaseExpiryTick >= secondCreatedTick
  );
}

function isVirginEatingRow(row: M3EatingJobSnapshotRow): boolean {
  return (
    row.active === 0 &&
    row.ownerIndex === 0 &&
    row.ownerGeneration === 0 &&
    row.sourceStackId === 0 &&
    row.storageSlotId === 0 &&
    row.foodDefId === 0 &&
    row.amount === 0 &&
    row.hungerRestore === 0 &&
    row.itemEntityIndex === 0 &&
    row.itemEntityGeneration === 0 &&
    row.interactionSpotId === 0 &&
    row.itemStoreVersion === 0 &&
    row.foodAvailabilityVersion === 0 &&
    row.mealWindowVersion === 0 &&
    row.abilityAllowed === 0 &&
    row.createdTick === 0 &&
    row.stepEnteredTick === 0 &&
    row.jobSlotVersion === 0 &&
    row.claimIds[0] === JOB_NONE &&
    row.claimIds[1] === JOB_NONE &&
    row.claimEpochs[0] === 0 &&
    row.claimEpochs[1] === 0 &&
    row.claimCreatedTicks[0] === 0 &&
    row.claimCreatedTicks[1] === 0 &&
    row.claimLeaseExpiryTicks[0] === 0 &&
    row.claimLeaseExpiryTicks[1] === 0 &&
    row.reservationVersion === 0 &&
    row.effectPhase === 0 &&
    row.cleanupPending === 0 &&
    row.returnedOnce === 0 &&
    row.stepCode === EATING_STEP_UNASSIGNED &&
    row.carriedDefId === JOB_NONE &&
    row.carriedAmount === 0 &&
    row.consumedDefId === JOB_NONE &&
    row.consumedAmount === 0 &&
    row.terminalReasonCode === 0 &&
    row.pickupOnce === 0 &&
    row.lastEffectTick === 0 &&
    row.pendingTerminalOutcome === 0 &&
    row.pendingTerminalFailure === 0 &&
    row.pendingInterruptionKind === 0
  );
}

function isRollbackShadowEatingRow(row: M3EatingJobSnapshotRow): boolean {
  return (
    row.active === 0 &&
    row.ownerGeneration > 0 &&
    row.itemEntityGeneration > 0 &&
    row.amount > 0 &&
    row.jobSlotVersion > 0 &&
    row.reservationVersion > 0 &&
    row.stepCode === EATING_STEP_RESERVED &&
    row.effectPhase === 0 &&
    row.pickupOnce === 0 &&
    row.cleanupPending === 0 &&
    row.returnedOnce === 0 &&
    row.carriedDefId === JOB_NONE &&
    row.carriedAmount === 0 &&
    row.consumedDefId === JOB_NONE &&
    row.consumedAmount === 0 &&
    row.terminalReasonCode === 0 &&
    row.pendingTerminalOutcome === 0 &&
    row.pendingTerminalFailure === 0 &&
    row.pendingInterruptionKind === 0 &&
    row.stepEnteredTick >= row.createdTick &&
    row.lastEffectTick === row.stepEnteredTick &&
    hasEatingClaims(row)
  );
}

function isReservedEatingRow(row: M3EatingJobSnapshotRow): boolean {
  return (
    row.active === 1 &&
    row.stepCode === EATING_STEP_RESERVED &&
    row.pickupOnce === 0 &&
    row.cleanupPending === 0 &&
    row.returnedOnce === 0 &&
    row.carriedDefId === JOB_NONE &&
    row.carriedAmount === 0 &&
    row.consumedDefId === JOB_NONE &&
    row.consumedAmount === 0 &&
    row.terminalReasonCode === 0 &&
    row.pendingTerminalOutcome === 0 &&
    row.pendingTerminalFailure === 0 &&
    row.pendingInterruptionKind === 0
  );
}

function isPickedUpEatingRow(row: M3EatingJobSnapshotRow): boolean {
  return (
    row.active === 1 &&
    row.stepCode === EATING_STEP_PICKED_UP &&
    row.pickupOnce === 1 &&
    row.cleanupPending === 0 &&
    row.returnedOnce === 0 &&
    row.carriedDefId === row.foodDefId &&
    row.carriedAmount === row.amount &&
    row.consumedDefId === JOB_NONE &&
    row.consumedAmount === 0 &&
    row.terminalReasonCode === 0 &&
    row.pendingTerminalOutcome === 0 &&
    row.pendingTerminalFailure === 0 &&
    row.pendingInterruptionKind === 0
  );
}

function isCleanupPendingEatingRow(row: M3EatingJobSnapshotRow): boolean {
  if (
    row.active !== 1 ||
    row.cleanupPending !== 1 ||
    row.carriedDefId !== JOB_NONE ||
    row.carriedAmount !== 0 ||
    row.terminalReasonCode !== 0 ||
    !isValidStoredEatingOutcome(
      row.pendingTerminalOutcome,
      row.pendingTerminalFailure,
      row.pendingInterruptionKind,
    )
  )
    return false;
  if (row.pendingTerminalOutcome === 4) {
    return (
      row.pickupOnce === 1 &&
      row.returnedOnce === 0 &&
      row.stepCode === EATING_STEP_PICKED_UP &&
      row.consumedDefId === row.foodDefId &&
      row.consumedAmount === row.amount
    );
  }
  return (
    row.consumedDefId === JOB_NONE &&
    row.consumedAmount === 0 &&
    ((row.pickupOnce === 0 && row.returnedOnce === 0 && row.stepCode === EATING_STEP_RESERVED) ||
      (row.pickupOnce === 1 && row.returnedOnce === 1 && row.stepCode === EATING_STEP_PICKED_UP))
  );
}

function isTerminalEatingRow(row: M3EatingJobSnapshotRow): boolean {
  if (
    row.active !== 0 ||
    row.cleanupPending !== 0 ||
    row.carriedDefId !== JOB_NONE ||
    row.carriedAmount !== 0 ||
    row.claimIds[0] !== JOB_NONE ||
    row.claimIds[1] !== JOB_NONE ||
    row.claimEpochs[0] !== 0 ||
    row.claimEpochs[1] !== 0 ||
    row.claimCreatedTicks[0] !== 0 ||
    row.claimCreatedTicks[1] !== 0 ||
    row.claimLeaseExpiryTicks[0] !== 0 ||
    row.claimLeaseExpiryTicks[1] !== 0 ||
    !isValidStoredEatingOutcome(
      row.pendingTerminalOutcome,
      row.pendingTerminalFailure,
      row.pendingInterruptionKind,
    )
  )
    return false;
  if (row.pendingTerminalOutcome === 4) {
    return (
      row.stepCode === EATING_STEP_CONSUMED &&
      row.consumedDefId === row.foodDefId &&
      row.consumedAmount === row.amount &&
      row.pickupOnce === 1 &&
      row.returnedOnce === 0 &&
      row.terminalReasonCode === 3
    );
  }
  return (
    row.consumedDefId === JOB_NONE &&
    row.consumedAmount === 0 &&
    row.returnedOnce === row.pickupOnce &&
    row.stepCode ===
      (row.pendingTerminalOutcome === 2 ? EATING_STEP_FAILED : EATING_STEP_CANCELED) &&
    row.terminalReasonCode === (row.pendingTerminalOutcome === 2 ? 5 : 4)
  );
}

function isValidStoredEatingOutcome(
  outcome: number,
  failure: number,
  interruption: number,
): boolean {
  if (outcome === 1) return failure === 8 && interruption === 0;
  if (outcome === 2) return failure > 0 && failure < 8 && interruption === 0;
  if (outcome === 3) return failure === 8 && interruption > 0 && interruption <= 3;
  return outcome === 4 && failure === 0 && interruption === 0;
}

function isEatingExactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  return true;
}

function isEatingDenseArray(value: unknown, length: number): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length !== length) return false;
  for (let index = 0; index < length; index += 1) if (!(index in value)) return false;
  return true;
}

function isEatingPair(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isEatingDenseArray(value, 2) &&
    isEatingUint32(value[0]) &&
    isEatingUint32(value[1])
  );
}

function isEatingTickPair(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isEatingDenseArray(value, 2) &&
    isEatingTick(value[0]) &&
    isEatingTick(value[1])
  );
}

function isEatingUint32(value: unknown): value is number {
  return typeof value === "number" && isSafeUint32(value);
}

function isEatingAbilityAllowed(value: unknown): value is true {
  return value === true;
}

function isEatingTick(value: unknown): value is number {
  return typeof value === "number" && isSafeTick(value);
}

function eatingSnapshotRowValues(row: M3EatingJobSnapshotRow): readonly number[] {
  return [
    row.jobId,
    row.active,
    row.ownerIndex,
    row.ownerGeneration,
    row.sourceStackId,
    row.storageSlotId,
    row.foodDefId,
    row.amount,
    row.hungerRestore,
    row.itemEntityIndex,
    row.itemEntityGeneration,
    row.interactionSpotId,
    row.itemStoreVersion,
    row.foodAvailabilityVersion,
    row.mealWindowVersion,
    row.abilityAllowed,
    row.createdTick,
    row.stepEnteredTick,
    row.jobGeneration,
    row.jobSlotVersion,
    row.reservationVersion,
    row.effectPhase,
    row.cleanupPending,
    row.returnedOnce,
    row.stepCode,
    row.carriedDefId,
    row.carriedAmount,
    row.consumedDefId,
    row.consumedAmount,
    row.terminalReasonCode,
    row.pickupOnce,
    row.lastEffectTick,
    row.pendingTerminalOutcome,
    row.pendingTerminalFailure,
    row.pendingInterruptionKind,
  ];
}

function matchesEatingItem(
  actual: ItemStackIntoOutput,
  expected: ItemStackQuantityRemovalPrepareInput,
  reservationVersion: number,
): boolean {
  return (
    actual.ok &&
    actual.active &&
    actual.stackId === expected.stackId &&
    actual.entityIndex === expected.entityIndex &&
    actual.entityGeneration === expected.entityGeneration &&
    actual.defId === expected.defId &&
    actual.quantity === expected.quantity &&
    actual.reservedQuantity === expected.reservedQuantity &&
    actual.availableQuantity === expected.availableQuantity &&
    actual.capacity === expected.capacity &&
    actual.rowVersion === expected.expectedRowVersion &&
    actual.storeVersion === expected.expectedStoreVersion &&
    actual.reservationVersion === expected.expectedReservationVersion &&
    actual.reservationVersion === reservationVersion
  );
}

function clearStoredClaims(
  claimIds: Uint32Array,
  claimEpochs: Uint32Array,
  claimCreatedTicks: Float64Array,
  claimLeaseExpiryTicks: Float64Array,
  base: number,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    claimIds[base + index] = JOB_NONE;
    claimEpochs[base + index] = 0;
    claimCreatedTicks[base + index] = 0;
    claimLeaseExpiryTicks[base + index] = 0;
  }
}

function writeAdoptionSuccess(
  token: JobTokenIntoOutput,
  driverVersion: number,
  activeCount: number,
  output: DriverAdoptionOutput,
): void {
  output.ok = true;
  output.jobId = token.jobId;
  output.jobGeneration = token.jobGeneration;
  output.jobSlotVersion = token.slotVersion;
  output.jobCoreVersion = token.version;
  output.driverVersion = driverVersion;
  output.activeCount = activeCount;
}

function resetEatingAdoptionOutput(output: M3EatingClaimAdoptionOutput): void {
  resetDriverAdoptionOutput(output);
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.jobCoreReservedCount = 0;
  output.jobCoreActiveCount = 0;
  output.jobCoreRunningCount = 0;
  output.jobCoreCurrentTombstoneCount = 0;
  output.jobCoreCumulativeTerminalCount = 0;
  output.driverReservedCount = 0;
  output.driverPickedUpCount = 0;
  output.driverConsumedCount = 0;
  output.driverCanceledCount = 0;
  output.driverFailedCount = 0;
  output.driverInterruptedCount = 0;
  output.currentInterruptedJobs = 0;
  output.reservationAttemptCount = 0;
  output.reservationFailureCount = 0;
  output.cumulativeConsumedCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
  output.cumulativeInterruptedCount = 0;
  output.consumedAmountTotal = 0;
}

function sameStoredClaims(
  claimIds: Uint32Array,
  claimEpochs: Uint32Array,
  claimCreatedTicks: Float64Array,
  claimLeaseExpiryTicks: Float64Array,
  jobId: number,
  count: number,
  control: ExistingClaimsAdoptionControl,
): boolean {
  const base = jobId * count;
  for (let index = 0; index < count; index += 1) {
    if (
      (claimIds[base + index] ?? JOB_NONE) !== (control.claimIds[index] ?? JOB_NONE) ||
      (claimEpochs[base + index] ?? 0) !== (control.claimEpochs[index] ?? 0) ||
      (claimCreatedTicks[base + index] ?? 0) !== control.claimCreatedTick ||
      (claimLeaseExpiryTicks[base + index] ?? 0) !== (control.claimLeaseExpiryTicks[index] ?? 0)
    )
      return false;
  }
  return true;
}

function encodeEatingReason(reason: M3EatingReason): number {
  if (reason === "food.job_reserved") {
    return 1;
  }
  if (reason === "food.job_picked_up") {
    return 2;
  }
  if (reason === "food.consumed_integer_portion") {
    return 3;
  }
  if (reason === "food.job_canceled") {
    return 4;
  }
  if (reason === "food.job_failed") {
    return 5;
  }
  return 0;
}

function decodeEatingReason(code: number): M3EatingReason {
  if (code === 1) {
    return "food.job_reserved";
  }
  if (code === 2) {
    return "food.job_picked_up";
  }
  if (code === 3) {
    return "food.consumed_integer_portion";
  }
  if (code === 4) {
    return "food.job_canceled";
  }
  if (code === 5) {
    return "food.job_failed";
  }
  return "food.job_created";
}

function decodeStep(code: number): M3EatingStep {
  if (code === EATING_STEP_CREATED) {
    return "created";
  }
  if (code === EATING_STEP_RESERVED) {
    return "reserved";
  }
  if (code === EATING_STEP_PICKED_UP) {
    return "picked_up";
  }
  if (code === EATING_STEP_CONSUMED) {
    return "consumed";
  }
  if (code === EATING_STEP_CANCELED) {
    return "canceled";
  }
  if (code === EATING_STEP_FAILED) {
    return "failed";
  }
  return "unassigned";
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isSafeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isNonNegativeNeedDelta(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= NEED_DELTA_MAX;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}
