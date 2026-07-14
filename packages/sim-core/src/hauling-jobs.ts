import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import {
  JOB_NONE,
  commitPreparedAutonomyCarriedStep,
  commitPreparedAutonomyTerminal,
  type JobCoreStore,
  type JobTokenIntoOutput,
  type JobFailureReason,
  type JobInterruptionKind,
  type AutonomyJobMutationIntoOutput,
  type AutonomyCommittedJobIntoOutput,
  type JobCoreReason,
  type PreparedAutonomyCarriedStep,
  type PreparedAutonomyTerminal,
} from "./job-core";
import {
  HAULING_CLAIM_FACTS_DESCRIPTOR,
  HAULING_CLAIM_FACTS_MANIFEST_VERSION,
  HAULING_CLAIM_FACTS_WORK_TYPE,
  HAULING_CLAIM_POLICY_KIND,
  HAULING_CLAIM_POLICY_VERSION,
  HAULING_CLAIM_TRANSITION_TARGET_SLOT,
  HAUL_TRANSFER_AMOUNT_FACT_CODE,
  isExactAdoptionClaimPrefix,
  releaseStoredAutonomyClaimsInto,
  resetDriverAdoptionOutput,
  type DriverAdoptionOutput,
  type ExistingClaimsAdoptionControl,
  type HaulingClaimFactsIntoOutput,
  type NewlyAdoptedRollbackControl,
} from "./autonomy-claim-facts";
import {
  commitPreparedItemStackQuantityAddition,
  commitPreparedItemStackQuantityRemoval,
  type ItemStackReadScratch,
  type ItemStackQuantityAdditionPrepareInput,
  type ItemStackQuantityRemovalPrepareInput,
  type ItemStackIntoOutput,
  type ItemStackReason,
  type ItemStackStore,
  type PreparedItemStackQuantityRemoval,
} from "./item-stack-store";
import {
  RESERVATION_CAPACITY,
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

export const HAULING_JOB_KIND = 1;
export const HAULING_JOB_SNAPSHOT_VERSION = 4;

const HAUL_STEP_UNASSIGNED = 0;
const HAUL_STEP_CREATED = 1;
const HAUL_STEP_RESERVED = 2;
const HAUL_STEP_PICKED_UP = 3;
const HAUL_STEP_DELIVERED = 4;
const HAUL_STEP_CANCELED = 5;
const HAUL_STEP_FAILED = 6;

const ORIGIN_OWNER_INDEX = 0;
const ORIGIN_OWNER_GENERATION = 1;
const ORIGIN_SOURCE_SLOT_ID = 2;
const ORIGIN_DESTINATION_SLOT_ID = 3;
const ORIGIN_SOURCE_ITEM_INDEX = 4;
const ORIGIN_SOURCE_ITEM_GENERATION = 5;
const ORIGIN_DESTINATION_STORAGE_INDEX = 6;
const ORIGIN_DESTINATION_STORAGE_GENERATION = 7;
const ORIGIN_SOURCE_INTERACTION_SPOT_ID = 8;
const ORIGIN_DESTINATION_INTERACTION_SPOT_ID = 9;
const ORIGIN_SOURCE_STACK_ID = 10;
const ORIGIN_DESTINATION_STACK_ID = 11;
const ORIGIN_DEF_ID = 12;
const ORIGIN_DESTINATION_CAPACITY = 13;
const ORIGIN_AMOUNT = 14;
const ORIGIN_JOB_GENERATION = 15;
const ORIGIN_RESERVATION_VERSION = 16;
const ORIGIN_U32_STRIDE = 17;
const ORIGIN_CREATED_TICK = 0;
const ORIGIN_STEP_ENTERED_TICK = 1;
const ORIGIN_LAST_EFFECT_TICK = 2;
const ORIGIN_TICK_STRIDE = 3;
const ORIGIN_STEP_CODE = 0;
const ORIGIN_PICKUP_ONCE = 1;
const ORIGIN_PENDING_OUTCOME = 2;
const ORIGIN_PENDING_FAILURE = 3;
const ORIGIN_PENDING_INTERRUPTION = 4;
const ORIGIN_CODE_STRIDE = 5;

export type HaulingStep =
  | "unassigned"
  | "created"
  | "reserved"
  | "picked_up"
  | "delivered"
  | "canceled"
  | "failed";

export type HaulingReason =
  | "hauling_job_id_out_of_range"
  | "hauling_job_already_active"
  | "hauling_job_not_active"
  | "hauling_owner_invalid"
  | "hauling_slot_invalid"
  | "hauling_amount_invalid"
  | "hauling_source_unavailable"
  | "hauling_destination_unavailable"
  | "hauling_def_mismatch"
  | "hauling_step_invalid"
  | "hauling_item_mutation_failed"
  | "hauling_job_core_failed"
  | "hauling_version_exhausted"
  | "hauling_interruption_denied"
  | ReservationReason;

export type HaulingMutationResult =
  | { readonly ok: true; readonly jobId: number; readonly version: number }
  | { readonly ok: false; readonly reason: HaulingReason };

export interface HaulingJobCreateInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly sourceSlotId: number;
  readonly destinationSlotId: number;
  readonly amount: number;
  readonly createdTick: number;
}

export interface HaulingJobView extends HaulingJobCreateInput {
  readonly step: HaulingStep;
  readonly carriedDefId: number;
  readonly carriedAmount: number;
}

export interface HaulingClaimAdoptionInput extends HaulingJobCreateInput {
  readonly sourceStackId: number;
  readonly destinationStackId: number;
  readonly defId: number;
  readonly sourceItem: EntityId;
  readonly destinationStorage: EntityId;
  readonly sourceInteractionSpotId: number;
  readonly destinationInteractionSpotId: number;
  readonly destinationCapacity: number;
  readonly readClaimIds: Uint32Array;
  readonly readClaimEpochs: Uint32Array;
  readonly claims: ReservationClaimsIntoOutput;
  readonly claimFacts: HaulingClaimFactsIntoOutput;
  readonly claimFactsBasis: HaulingClaimFactsBasis;
}

export interface HaulingClaimFactsBasis {
  readonly descriptor: number;
  readonly workType: number;
  readonly offerId: number;
  readonly opaqueTargetId: number;
  readonly offerOwnerVersion: number;
  readonly offerRowVersion: number;
  readonly offerIndexVersion: number;
  readonly mappingRowVersion: number;
  readonly mappingIndexVersion: number;
  readonly sourceRowVersion: number;
  readonly destinationRowVersion: number;
  readonly storageIndexVersion: number;
  readonly sourceDirtyBacklog: number;
  readonly destinationDirtyBacklog: number;
  readonly sourceInteractionCellIndex: number;
  readonly destinationInteractionCellIndex: number;
  readonly itemRowVersion: number;
  readonly itemStoreVersion: number;
  readonly reservationVersion: number;
}

export interface HaulingClaimAdoptionOutput extends DriverAdoptionOutput {
  ownerIndex: number;
  ownerGeneration: number;
  jobCoreReservedCount: number;
  jobCoreActiveCount: number;
  jobCoreRunningCount: number;
  jobCoreCurrentTombstoneCount: number;
  jobCoreCumulativeTerminalCount: number;
  driverReservedCount: number;
  driverPickedUpCount: number;
  driverDeliveredCount: number;
  driverCanceledCount: number;
  driverFailedCount: number;
  cumulativeDeliveredCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
}

export interface HaulingAdoptedPickupInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly expectedCurrentLedgerVersion: number;
  readonly tick: number;
  readonly itemRemoval: ItemStackQuantityRemovalPrepareInput;
  readonly sourceSlot: StorageSlotIntoOutput;
  readonly sourceDirty: StorageSlotDirtyPrepareInput;
}

export type HaulingAdoptedTerminalOutcome = "delivered" | "canceled" | "failed";

export interface HaulingAdoptedTerminalInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly expectedCurrentLedgerVersion: number;
  readonly tick: number;
  readonly outcome: HaulingAdoptedTerminalOutcome;
  readonly failureReason: JobFailureReason;
  readonly interruptionKind?: JobInterruptionKind;
  readonly targetItem: ItemStackQuantityAdditionPrepareInput;
  readonly targetSlot: StorageSlotIntoOutput;
  readonly targetDirty: StorageSlotDirtyPrepareInput;
}

export interface HaulingResumeCleanupInput {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly owner: EntityId;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly expectedCurrentLedgerVersion: number;
  readonly tick: number;
  readonly outcome: HaulingAdoptedTerminalOutcome;
  readonly failureReason: JobFailureReason;
  readonly interruptionKind?: JobInterruptionKind;
}

export interface HaulingAdoptedMutationOutput {
  ok: boolean;
  reason: HaulingReason | JobCoreReason | ItemStackReason | StorageLogisticsReason | undefined;
  jobId: number;
  jobGeneration: number;
  jobSlotVersion: number;
  jobCoreVersion: number;
  driverVersion: number;
  itemRowVersion: number;
  itemStoreVersion: number;
  storageRowVersion: number;
  storageIndexVersion: number;
  storageDirtyBacklog: number;
  reservationVersion: number;
  alreadyCommitted: boolean;
  cleanupPending: boolean;
  terminalOutcome: HaulingAdoptedTerminalOutcome | undefined;
  releasedClaimCount: number;
}

export interface HaulingAdoptedJobIntoOutput {
  ok: boolean;
  reason: HaulingReason | undefined;
  active: boolean;
  jobId: number;
  jobGeneration: number;
  ownerIndex: number;
  ownerGeneration: number;
  sourceSlotId: number;
  destinationSlotId: number;
  sourceItemIndex: number;
  sourceItemGeneration: number;
  destinationStorageIndex: number;
  destinationStorageGeneration: number;
  sourceInteractionSpotId: number;
  destinationInteractionSpotId: number;
  sourceStackId: number;
  destinationStackId: number;
  defId: number;
  destinationCapacity: number;
  readonly claimIds: Uint32Array;
  readonly claimEpochs: Uint32Array;
  readonly claimCreatedTicks: Float64Array;
  readonly claimLeaseExpiryTicks: Float64Array;
  amount: number;
  createdTick: number;
  stepEnteredTick: number;
  step: HaulingStep;
  carriedDefId: number;
  carriedAmount: number;
  jobSlotVersion: number;
  driverVersion: number;
  reservationVersion: number;
  effectPhase: number;
  pickupCommitted: boolean;
  cleanupPending: boolean;
  terminalOutcome: HaulingAdoptedTerminalOutcome | undefined;
  pendingTerminalFailure: number;
  pendingInterruptionKind: number;
  lastEffectTick: number;
  activeCount: number;
  reservedCount: number;
  pickedUpCount: number;
  deliveredCount: number;
  canceledCount: number;
  failedCount: number;
  cumulativeDeliveredCount: number;
  cumulativeCanceledCount: number;
  cumulativeFailedCount: number;
  originShadowPresent: boolean;
  originOwnerIndex: number;
  originOwnerGeneration: number;
  originSourceSlotId: number;
  originDestinationSlotId: number;
  originSourceItemIndex: number;
  originSourceItemGeneration: number;
  originDestinationStorageIndex: number;
  originDestinationStorageGeneration: number;
  originSourceInteractionSpotId: number;
  originDestinationInteractionSpotId: number;
  originSourceStackId: number;
  originDestinationStackId: number;
  originDefId: number;
  originDestinationCapacity: number;
  originAmount: number;
  originCreatedTick: number;
  originStepEnteredTick: number;
  originJobGeneration: number;
  originReservationVersion: number;
  originStep: HaulingStep;
  originPickupCommitted: boolean;
  originLastEffectTick: number;
  originTerminalOutcome: HaulingAdoptedTerminalOutcome | undefined;
  originPendingTerminalFailure: number;
  originPendingInterruptionKind: number;
}

export interface HaulingJobSnapshotRow {
  readonly jobId: number;
  readonly active: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly sourceSlotId: number;
  readonly destinationSlotId: number;
  readonly sourceItemIndex: number;
  readonly sourceItemGeneration: number;
  readonly destinationStorageIndex: number;
  readonly destinationStorageGeneration: number;
  readonly sourceInteractionSpotId: number;
  readonly destinationInteractionSpotId: number;
  readonly sourceStackId: number;
  readonly destinationStackId: number;
  readonly defId: number;
  readonly destinationCapacity: number;
  readonly amount: number;
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
  readonly carriedDefId: number;
  readonly carriedAmount: number;
  readonly pickupOnce: number;
  readonly lastEffectTick: number;
  readonly pendingTerminalOutcome: number;
  readonly pendingTerminalFailure: number;
  readonly pendingInterruptionKind: number;
  readonly originShadowPresent: number;
  readonly originOwnerIndex: number;
  readonly originOwnerGeneration: number;
  readonly originSourceSlotId: number;
  readonly originDestinationSlotId: number;
  readonly originSourceItemIndex: number;
  readonly originSourceItemGeneration: number;
  readonly originDestinationStorageIndex: number;
  readonly originDestinationStorageGeneration: number;
  readonly originSourceInteractionSpotId: number;
  readonly originDestinationInteractionSpotId: number;
  readonly originSourceStackId: number;
  readonly originDestinationStackId: number;
  readonly originDefId: number;
  readonly originDestinationCapacity: number;
  readonly originAmount: number;
  readonly originCreatedTick: number;
  readonly originStepEnteredTick: number;
  readonly originJobGeneration: number;
  readonly originReservationVersion: number;
  readonly originStepCode: number;
  readonly originPickupOnce: number;
  readonly originLastEffectTick: number;
  readonly originPendingTerminalOutcome: number;
  readonly originPendingTerminalFailure: number;
  readonly originPendingInterruptionKind: number;
}

export interface HaulingJobSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly cumulativeDeliveredCount: number;
  readonly cumulativeCanceledCount: number;
  readonly cumulativeFailedCount: number;
  readonly rows: readonly HaulingJobSnapshotRow[];
}

export interface HaulingJobSnapshot extends HaulingJobSnapshotInput {
  readonly snapshotVersion: typeof HAULING_JOB_SNAPSHOT_VERSION;
}

export type HaulingRestoreResult =
  | { readonly ok: true; readonly version: number; readonly activeCount: number }
  | { readonly ok: false; readonly reason: "hauling_snapshot_invalid" };

export interface HaulingMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly pickedUpCount: number;
  readonly deliveredCount: number;
  readonly canceledCount: number;
  readonly failedCount: number;
  readonly cumulativeDeliveredCount: number;
  readonly cumulativeCanceledCount: number;
  readonly cumulativeFailedCount: number;
}

export class HaulingJobStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly ownerIndexes: Uint32Array;
  private readonly ownerGenerations: Uint32Array;
  private readonly sourceSlotIds: Uint32Array;
  private readonly destinationSlotIds: Uint32Array;
  private readonly sourceItemIndexes: Uint32Array;
  private readonly sourceItemGenerations: Uint32Array;
  private readonly destinationStorageIndexes: Uint32Array;
  private readonly destinationStorageGenerations: Uint32Array;
  private readonly sourceInteractionSpotIds: Uint32Array;
  private readonly destinationInteractionSpotIds: Uint32Array;
  private readonly sourceStackIds: Uint32Array;
  private readonly destinationStackIds: Uint32Array;
  private readonly defIds: Uint32Array;
  private readonly destinationCapacities: Uint32Array;
  private readonly amounts: Uint32Array;
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
  private activeCount = 0;
  private storeVersion = 0;
  private cumulativeDeliveredCount = 0;
  private cumulativeCanceledCount = 0;
  private cumulativeFailedCount = 0;
  private readonly jobTokenOutput: JobTokenIntoOutput;
  private readonly releaseIds: Uint32Array;
  private readonly releaseEpochs: Uint32Array;
  private readonly releaseOutput: ReservationReleaseIntoOutput;
  private readonly releaseOwnerScratch: { index: number; generation: number };
  private readonly preparedTerminal: PreparedAutonomyTerminal;
  private readonly jobMutationOutput: AutonomyJobMutationIntoOutput;
  private readonly preparedPickupCore: PreparedAutonomyCarriedStep;
  private readonly preparedPickupItem: PreparedItemStackQuantityRemoval;
  private readonly preparedSourceDirty: PreparedStorageSlotDirty;
  private readonly sourceSlotScratch: StorageSlotIntoOutput;
  private readonly itemStackScratch: ItemStackIntoOutput;
  private readonly itemReadScratch: ItemStackReadScratch;
  private readonly pickupOnce: Uint8Array;
  private readonly lastEffectTicks: Float64Array;
  private readonly claimReadIds: Uint32Array;
  private readonly claimReadEpochs: Uint32Array;
  private readonly pendingTerminalOutcomes: Uint8Array;
  private readonly pendingTerminalFailures: Uint8Array;
  private readonly pendingInterruptionKinds: Uint8Array;
  private readonly preparedTerminalItem: PreparedItemStackQuantityRemoval;
  private readonly preparedTerminalDirty: PreparedStorageSlotDirty;
  private readonly terminalSlotScratch: StorageSlotIntoOutput;
  private readonly terminalItemScratch: ItemStackIntoOutput;
  private readonly terminalItemReadScratch: ItemStackReadScratch;
  private readonly committedJobOutput: AutonomyCommittedJobIntoOutput;
  private readonly originShadowPresent: Uint8Array;
  private readonly originU32: Uint32Array;
  private readonly originTicks: Float64Array;
  private readonly originCodes: Uint8Array;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "hauling job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.ownerIndexes = new Uint32Array(capacity);
    this.ownerGenerations = new Uint32Array(capacity);
    this.sourceSlotIds = new Uint32Array(capacity);
    this.destinationSlotIds = new Uint32Array(capacity);
    this.sourceItemIndexes = new Uint32Array(capacity);
    this.sourceItemGenerations = new Uint32Array(capacity);
    this.destinationStorageIndexes = new Uint32Array(capacity);
    this.destinationStorageGenerations = new Uint32Array(capacity);
    this.sourceInteractionSpotIds = new Uint32Array(capacity);
    this.destinationInteractionSpotIds = new Uint32Array(capacity);
    this.sourceStackIds = new Uint32Array(capacity);
    this.destinationStackIds = new Uint32Array(capacity);
    this.defIds = new Uint32Array(capacity);
    this.destinationCapacities = new Uint32Array(capacity);
    this.amounts = new Uint32Array(capacity);
    this.createdTicks = new Float64Array(capacity);
    this.stepEnteredTicks = new Float64Array(capacity);
    this.jobGenerations = new Uint32Array(capacity);
    this.jobSlotVersions = new Uint32Array(capacity);
    this.claimIds = new Uint32Array(capacity * 4);
    this.claimIds.fill(JOB_NONE);
    this.claimEpochs = new Uint32Array(capacity * 4);
    this.claimCreatedTicks = new Float64Array(capacity * 4);
    this.claimLeaseExpiryTicks = new Float64Array(capacity * 4);
    this.reservationVersions = new Uint32Array(capacity);
    this.effectPhases = new Uint8Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.carriedDefIds = new Uint32Array(capacity);
    this.carriedAmounts = new Uint32Array(capacity);
    this.carriedDefIds.fill(JOB_NONE);
    this.jobTokenOutput = createJobTokenOutput();
    this.releaseIds = new Uint32Array(8);
    this.releaseIds.fill(JOB_NONE);
    this.releaseEpochs = new Uint32Array(8);
    this.releaseOutput = createReleaseOutput();
    this.releaseOwnerScratch = { index: 0, generation: 0 };
    this.preparedTerminal = createPreparedTerminal();
    this.jobMutationOutput = createJobMutationOutput();
    this.preparedPickupCore = createPreparedCarriedStep();
    this.preparedPickupItem = createPreparedItemRemoval();
    this.preparedSourceDirty = createPreparedStorageDirty();
    this.sourceSlotScratch = createStorageSlotOutput();
    this.itemStackScratch = createItemStackOutput();
    this.itemReadScratch = { entity: { index: 0, generation: 0 } };
    this.pickupOnce = new Uint8Array(capacity);
    this.lastEffectTicks = new Float64Array(capacity);
    this.claimReadIds = new Uint32Array(8);
    this.claimReadIds.fill(JOB_NONE);
    this.claimReadEpochs = new Uint32Array(8);
    this.pendingTerminalOutcomes = new Uint8Array(capacity);
    this.pendingTerminalFailures = new Uint8Array(capacity);
    this.pendingInterruptionKinds = new Uint8Array(capacity);
    this.preparedTerminalItem = createPreparedItemRemoval();
    this.preparedTerminalDirty = createPreparedStorageDirty();
    this.terminalSlotScratch = createStorageSlotOutput();
    this.terminalItemScratch = createItemStackOutput();
    this.terminalItemReadScratch = { entity: { index: 0, generation: 0 } };
    this.committedJobOutput = createCommittedJobOutput();
    this.originShadowPresent = new Uint8Array(capacity);
    this.originU32 = new Uint32Array(capacity * ORIGIN_U32_STRIDE);
    this.originTicks = new Float64Array(capacity * ORIGIN_TICK_STRIDE);
    this.originCodes = new Uint8Array(capacity * ORIGIN_CODE_STRIDE);
  }

  adoptExistingClaimsInto(
    control: ExistingClaimsAdoptionControl,
    input: HaulingClaimAdoptionInput,
    jobCore: JobCoreStore,
    output: HaulingClaimAdoptionOutput,
  ): void {
    resetHaulingAdoptionOutput(output);
    const claims = input.claims;
    if (control.expectedDriverVersion > 0xffff_fffd) {
      output.reason = "hauling_version_exhausted";
      return;
    }
    if (
      !isExactHaulingAdoptionPreflight(control, input, this.capacity) ||
      control.expectedDriverVersion !== this.storeVersion ||
      input.jobId !== control.jobId ||
      input.owner.index !== control.ownerIndex ||
      input.owner.generation !== control.ownerGeneration ||
      this.active[control.jobId] === 1 ||
      !matchesHaulingResolverFacts(input, control.reservationReadVersion) ||
      !isExactAdoptionClaimPrefix(control, claims, 4) ||
      !matchesReadClaimPrefix(control, input.readClaimIds, input.readClaimEpochs, claims, 4) ||
      claims.channelCodes[0] !== RESERVATION_ITEM_QUANTITY ||
      claims.channelCodes[1] !== RESERVATION_CAPACITY ||
      claims.channelCodes[2] !== RESERVATION_INTERACTION_SPOT ||
      claims.channelCodes[3] !== RESERVATION_INTERACTION_SPOT ||
      !matchesTarget(claims, 0, input.sourceItem) ||
      !matchesTarget(claims, 2, input.sourceItem) ||
      !matchesTarget(claims, 1, input.destinationStorage) ||
      !matchesTarget(claims, 3, input.destinationStorage) ||
      claims.slotIds[1] !== input.destinationSlotId ||
      claims.amounts[0] !== input.amount ||
      claims.amounts[1] !== input.amount ||
      claims.slotIds[2] !== input.sourceInteractionSpotId ||
      claims.slotIds[3] !== input.destinationInteractionSpotId
    ) {
      output.reason = "hauling_adoption_preflight_failed";
      return;
    }
    jobCore.readAutonomyJobTokenInto(
      control.jobId,
      control.jobGeneration,
      input.owner,
      control.expectedJobSlotVersion,
      this.jobTokenOutput,
    );
    if (
      !this.jobTokenOutput.ok ||
      this.jobTokenOutput.state !== "reserved" ||
      this.jobTokenOutput.version !== control.expectedJobCoreVersion ||
      !this.matchesReservedDriverOrigin(control.jobId)
    ) {
      output.reason = "hauling_adoption_preflight_failed";
      return;
    }
    const preserveTerminalOrigin = this.jobTokenOutput.originShadowPresent;
    jobCore.createRunningJobScalarsInto(
      control.jobId,
      control.jobGeneration,
      input.owner.index,
      input.owner.generation,
      HAULING_JOB_KIND,
      input.destinationSlotId,
      "path_to_source",
      "immediate",
      0,
      control.claimCreatedTick,
      control.adoptionTick,
      control.reservationReadVersion,
      control.expectedDriverVersion,
      control.expectedJobSlotVersion,
      control.expectedJobCoreVersion,
      this.jobTokenOutput,
    );
    if (!isSuccessfulJobTokenOutput(this.jobTokenOutput)) {
      output.reason = this.jobTokenOutput.reason;
      return;
    }
    if (preserveTerminalOrigin) this.captureTerminalOrigin(control.jobId);
    else this.clearOriginShadow(control.jobId);
    this.writeAdopted(control, input);
    this.storeVersion += 1;
    this.writeHaulingAdoptionSuccess(output);
  }

  rollbackNewlyAdoptedInto(
    control: NewlyAdoptedRollbackControl,
    jobCore: JobCoreStore,
    output: HaulingClaimAdoptionOutput,
  ): void {
    resetHaulingAdoptionOutput(output);
    const jobId = control.jobId;
    if (
      !isExactHaulingRollbackControl(control, this.capacity, jobCore.version) ||
      this.active[jobId] !== 1 ||
      this.jobGenerations[jobId] !== control.jobGeneration ||
      this.ownerIndexes[jobId] !== control.ownerIndex ||
      this.ownerGenerations[jobId] !== control.ownerGeneration ||
      this.stepCodes[jobId] !== HAUL_STEP_RESERVED ||
      this.carriedDefIds[jobId] !== JOB_NONE ||
      this.carriedAmounts[jobId] !== 0 ||
      this.effectPhases[jobId] !== 0 ||
      this.pickupOnce[jobId] !== 0 ||
      this.createdTicks[jobId] !== control.claimCreatedTick ||
      this.stepEnteredTicks[jobId] !== control.adoptionTick ||
      this.lastEffectTicks[jobId] !== control.adoptionTick ||
      this.reservationVersions[jobId] !== control.reservationReadVersion ||
      this.pendingTerminalOutcomes[jobId] !== 0 ||
      this.pendingTerminalFailures[jobId] !== 0 ||
      this.pendingInterruptionKinds[jobId] !== 0 ||
      this.jobSlotVersions[jobId] !== control.expectedAdoptedJobSlotVersion ||
      this.storeVersion !== control.expectedAdoptedDriverVersion ||
      !sameClaims(
        this.claimIds,
        this.claimEpochs,
        this.claimCreatedTicks,
        this.claimLeaseExpiryTicks,
        jobId,
        4,
        control,
      )
    ) {
      output.reason = "hauling_rollback_preflight_failed";
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
    if (this.originShadowPresent[jobId] === 1) {
      this.restoreTerminalOrigin(jobId, this.jobTokenOutput.slotVersion);
    } else {
      this.clearRolledBackRow(jobId, this.jobTokenOutput.slotVersion);
    }
    this.activeCount -= 1;
    this.storeVersion += 1;
    this.writeHaulingAdoptionSuccess(output);
  }

  createJob(
    input: HaulingJobCreateInput,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateCreate(input, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "hauling_job_already_active" };
    }
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }
    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: HAULING_JOB_KIND,
        targetId: input.destinationSlotId,
        initialStep: "reserve",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: input.createdTick,
      },
      registry,
    );

    if (!created.ok) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.active[input.jobId] = 1;
    this.ownerIndexes[input.jobId] = input.owner.index;
    this.ownerGenerations[input.jobId] = input.owner.generation;
    this.sourceSlotIds[input.jobId] = input.sourceSlotId;
    this.destinationSlotIds[input.jobId] = input.destinationSlotId;
    this.amounts[input.jobId] = input.amount;
    this.createdTicks[input.jobId] = input.createdTick;
    this.stepEnteredTicks[input.jobId] = input.createdTick;
    this.jobGenerations[input.jobId] = 0;
    this.stepCodes[input.jobId] = HAUL_STEP_CREATED;
    this.carriedDefIds[input.jobId] = JOB_NONE;
    this.carriedAmounts[input.jobId] = 0;
    this.activeCount += 1;
    return this.finish(input.jobId);
  }

  reserveBeforePickup(
    jobId: number,
    tick: number,
    registry: EntityRegistry,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }
    if (!isSafeTick(tick) || tick > Number.MAX_SAFE_INTEGER - 300) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }
    const context = this.readReservationContext(jobId, items, storage, ledger);
    if (!context.ok) {
      return context;
    }

    const acquired = ledger.acquire(
      {
        owner: this.readOwner(jobId),
        jobId,
        createdTick: tick,
        leaseExpiryTick: tick + 300,
        claims: [
          {
            channel: "item_quantity",
            item: context.sourceStack.entity,
            amount: context.amount,
            availableAmount: context.sourceStack.quantity,
          },
          {
            channel: "capacity",
            target: context.destination.storage,
            capacityId: context.destination.slotId,
            amount: context.amount,
            capacity: context.destination.capacity - context.destination.quantity,
          },
          {
            channel: "interaction_spot",
            target: context.sourceStack.entity,
            spotId: context.source.interactionCellIndex,
          },
          {
            channel: "interaction_spot",
            target: context.destination.storage,
            spotId: context.destination.interactionCellIndex,
          },
        ],
      },
      registry,
    );

    if (!acquired.ok) {
      return { ok: false, reason: acquired.reason };
    }

    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      const released = ledger.releaseClaims(acquired.claimIds);
      if (!released.ok) {
        return { ok: false, reason: released.reason };
      }
      storage.markSlotDirty(context.source.slotId);
      storage.markSlotDirty(context.destination.slotId);
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.stepCodes[jobId] = HAUL_STEP_RESERVED;
    const claimBase = jobId * 4;
    for (let index = 0; index < 4; index += 1) {
      this.claimIds[claimBase + index] = acquired.claimIds[index] ?? JOB_NONE;
      this.claimEpochs[claimBase + index] = acquired.version;
      this.claimCreatedTicks[claimBase + index] = tick;
      this.claimLeaseExpiryTicks[claimBase + index] = tick + 300;
    }
    this.reservationVersions[jobId] = acquired.version;
    storage.markSlotDirty(context.source.slotId);
    storage.markSlotDirty(context.destination.slotId);
    return this.finish(jobId);
  }

  pickupAdoptedInto(
    input: HaulingAdoptedPickupInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: HaulingAdoptedMutationOutput,
  ): void {
    resetAdoptedMutationOutput(output);
    const jobId = input.jobId;
    if (
      !isIndexInRange(jobId, this.capacity) ||
      input.jobGeneration === 0 ||
      this.active[jobId] !== 1 ||
      this.jobGenerations[jobId] !== input.jobGeneration ||
      this.ownerIndexes[jobId] !== input.owner.index ||
      this.ownerGenerations[jobId] !== input.owner.generation
    ) {
      output.reason = "hauling_step_invalid";
      return;
    }
    const alreadyCommitted =
      (this.pickupOnce[jobId] ?? 0) === 1 &&
      this.effectPhases[jobId] === 1 &&
      this.stepCodes[jobId] === HAUL_STEP_PICKED_UP;
    if (
      this.jobSlotVersions[jobId] !== input.expectedJobSlotVersion ||
      jobCore.version !== input.expectedJobCoreVersion ||
      this.storeVersion !== input.expectedDriverVersion ||
      (!alreadyCommitted && this.stepCodes[jobId] !== HAUL_STEP_RESERVED) ||
      !isSafeTick(input.tick) ||
      input.tick < (this.createdTicks[jobId] ?? 0) ||
      input.tick < (this.stepEnteredTicks[jobId] ?? 0) ||
      !this.matchesCommittedRunningJob(input, jobCore, alreadyCommitted)
    ) {
      output.reason = "hauling_step_invalid";
      return;
    }
    if (this.storeVersion === 0xffff_ffff) {
      output.reason = "hauling_version_exhausted";
      return;
    }
    const removal = input.itemRemoval;
    if (
      !this.matchesStoredActiveClaims(
        jobId,
        input.owner,
        input.jobGeneration,
        input.expectedCurrentLedgerVersion,
        ledger,
        claims,
      ) ||
      claims.targetIndexes[0] !== removal.entityIndex ||
      claims.targetGenerations[0] !== removal.entityGeneration ||
      claims.amounts[0] !== removal.ownedReservedQuantity ||
      removal.ownedReservedQuantity !== (this.amounts[jobId] ?? 0) ||
      removal.amount !== (this.amounts[jobId] ?? 0) ||
      removal.stackId !== (this.sourceStackIds[jobId] ?? JOB_NONE) ||
      removal.defId !== (this.defIds[jobId] ?? JOB_NONE)
    ) {
      output.reason = "hauling_source_unavailable";
      return;
    }
    items.readStackInto(removal.stackId, ledger, this.itemReadScratch, this.itemStackScratch);
    if (!matchesItemRemoval(this.itemStackScratch, removal, input.expectedCurrentLedgerVersion)) {
      output.reason = "hauling_source_unavailable";
      return;
    }
    const sourceSlotId = this.sourceSlotIds[jobId] ?? 0;
    storage.readSlotInto(sourceSlotId, this.sourceSlotScratch);
    if (!matchesSourceSlot(this.sourceSlotScratch, input.sourceSlot, removal)) {
      output.reason = "hauling_source_unavailable";
      return;
    }
    if (alreadyCommitted) {
      writeAdoptedPickupSuccess(
        input,
        this.jobSlotVersions[jobId] ?? 0,
        jobCore.version,
        this.storeVersion,
        this.itemStackScratch.rowVersion,
        this.itemStackScratch.storeVersion,
        this.sourceSlotScratch.rowVersion,
        this.sourceSlotScratch.indexVersion,
        this.sourceSlotScratch.dirtyBacklog,
        input.expectedCurrentLedgerVersion,
        true,
        output,
      );
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
    if (
      input.sourceDirty.slotId !== sourceSlotId ||
      input.sourceDirty.expectedRowVersion !== input.sourceSlot.rowVersion ||
      input.sourceDirty.expectedIndexVersion !== input.sourceSlot.indexVersion ||
      input.sourceDirty.expectedDirtyBacklog !== input.sourceSlot.dirtyBacklog ||
      input.sourceDirty.expectedDirtyQueued !== input.sourceSlot.dirtyQueued
    ) {
      output.reason = "hauling_source_unavailable";
      return;
    }
    storage.prepareSlotDirtyInto(input.sourceDirty, this.preparedSourceDirty);
    if (!this.preparedSourceDirty.ok) {
      output.reason = this.preparedSourceDirty.reason;
      return;
    }

    writeAdoptedPickupSuccess(
      input,
      this.preparedPickupCore.nextSlotVersion,
      this.preparedPickupCore.nextJobCoreVersion,
      input.expectedDriverVersion + 1,
      this.preparedPickupItem.nextRowVersion,
      this.preparedPickupItem.nextStoreVersion,
      this.preparedSourceDirty.rowVersion,
      this.preparedSourceDirty.indexVersion,
      this.preparedSourceDirty.nextDirtyBacklog,
      input.expectedCurrentLedgerVersion,
      false,
      output,
    );
    if (this.preparedSourceDirty.alreadyQueued) {
      this.commitAdoptedPickupCoalesce(input, items, storage, jobCore);
    } else {
      this.commitAdoptedPickupAppend(input, items, storage, jobCore);
    }
  }

  terminalAdoptedInto(
    input: HaulingAdoptedTerminalInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    claims: ReservationClaimsIntoOutput,
    output: HaulingAdoptedMutationOutput,
  ): void {
    resetAdoptedMutationOutput(output);
    const jobId = input.jobId;
    const phase = isIndexInRange(jobId, this.capacity) ? (this.effectPhases[jobId] ?? 0) : 0;
    if (phase === 2) {
      output.reason = "hauling_step_invalid";
      return;
    }
    const requiredDriverHeadroom = phase === 0 || phase === 1 ? 2 : phase === 2 ? 1 : 0;
    if (
      isSafeUint32(input.expectedDriverVersion) &&
      input.expectedDriverVersion > 0xffff_ffff - requiredDriverHeadroom
    ) {
      output.reason = "hauling_version_exhausted";
      return;
    }
    if (!this.matchesTerminalCaller(input, jobCore, phase)) {
      output.reason = "hauling_step_invalid";
      return;
    }
    if (
      !isValidTerminalInput(
        input,
        phase,
        this.pendingTerminalOutcomes[jobId] ?? 0,
        this.pendingTerminalFailures[jobId] ?? 0,
        this.pendingInterruptionKinds[jobId] ?? 0,
      )
    ) {
      output.reason = "hauling_step_invalid";
      return;
    }
    if (phase !== 3 && !this.hasTerminalCounterHeadroom(input.outcome)) {
      output.reason = "hauling_version_exhausted";
      return;
    }
    if (phase === 3) {
      writeAdoptedTerminalSuccess(
        input,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        input.expectedDriverVersion,
        0,
        0,
        0,
        0,
        0,
        input.expectedCurrentLedgerVersion,
        true,
        false,
        0,
        output,
      );
      return;
    }
    const status = terminalStatus(input.outcome);
    jobCore.prepareAutonomyTerminalScalarsInto(
      jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.tick,
      status,
      input.failureReason,
      3,
      input.interruptionKind,
      this.preparedTerminal,
    );
    if (!this.preparedTerminal.ok) {
      output.reason = this.preparedTerminal.reason;
      return;
    }
    if (
      (phase === 0 || phase === 1) &&
      !this.readAndValidateTerminalClaims(input, ledger, claims, output)
    )
      return;
    if (phase === 1 && !this.prepareTerminalDomainEffect(input, items, storage, ledger, output))
      return;

    if (phase === 1) {
      writeAdoptedTerminalSuccess(
        input,
        this.jobSlotVersions[jobId] ?? 0,
        jobCore.version,
        input.expectedDriverVersion + 1,
        this.preparedTerminalItem.nextRowVersion,
        this.preparedTerminalItem.nextStoreVersion,
        this.preparedTerminalDirty.rowVersion,
        this.preparedTerminalDirty.indexVersion,
        this.preparedTerminalDirty.nextDirtyBacklog,
        input.expectedCurrentLedgerVersion,
        false,
        true,
        0,
        output,
      );
      if (this.preparedTerminalDirty.alreadyQueued) {
        this.commitTerminalDomainCoalesce(input, items, storage);
      } else {
        this.commitTerminalDomainAppend(input, items, storage);
      }
    } else if (phase === 0) {
      this.commitTerminalWithoutDomainEffect(input);
      writeAdoptedTerminalSuccess(
        input,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
        input.expectedDriverVersion + 1,
        0,
        0,
        0,
        0,
        0,
        input.expectedCurrentLedgerVersion,
        false,
        true,
        0,
        output,
      );
    }
    if (!this.releaseClaimsForTerminal(jobId, ledger, input.expectedCurrentLedgerVersion)) {
      output.ok = false;
      output.reason = this.releaseOutput.reason ?? "reservation_claim_not_active";
      output.cleanupPending = true;
      return;
    }

    writeAdoptedTerminalSuccess(
      input,
      this.preparedTerminal.nextSlotVersion,
      this.preparedTerminal.nextJobCoreVersion,
      this.storeVersion + 1,
      phase === 1 ? this.preparedTerminalItem.nextRowVersion : 0,
      phase === 1 ? this.preparedTerminalItem.nextStoreVersion : 0,
      phase === 1 ? this.preparedTerminalDirty.rowVersion : 0,
      phase === 1 ? this.preparedTerminalDirty.indexVersion : 0,
      phase === 1 ? this.preparedTerminalDirty.nextDirtyBacklog : 0,
      this.releaseOutput.version,
      false,
      false,
      this.releaseOutput.releasedCount,
      output,
    );
    this.commitTerminalTail(input, jobCore);
  }

  resumeCleanupInto(
    input: HaulingResumeCleanupInput,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
    output: HaulingAdoptedMutationOutput,
  ): void {
    resetAdoptedMutationOutput(output);
    const jobId = input.jobId;
    if (
      !isIndexInRange(jobId, this.capacity) ||
      this.effectPhases[jobId] !== 2 ||
      !this.matchesResumeCleanup(input, jobCore) ||
      !isValidTerminalInput(
        input,
        2,
        this.pendingTerminalOutcomes[jobId] ?? 0,
        this.pendingTerminalFailures[jobId] ?? 0,
        this.pendingInterruptionKinds[jobId] ?? 0,
      ) ||
      !this.hasTerminalCounterHeadroom(input.outcome)
    ) {
      output.reason = "hauling_step_invalid";
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
      terminalStatus(input.outcome),
      input.failureReason,
      3,
      input.interruptionKind,
      this.preparedTerminal,
    );
    if (!this.preparedTerminal.ok) {
      output.reason = this.preparedTerminal.reason;
      return;
    }
    writeAdoptedTerminalSuccess(
      input,
      input.expectedJobSlotVersion,
      input.expectedJobCoreVersion,
      input.expectedDriverVersion,
      0,
      0,
      0,
      0,
      0,
      input.expectedCurrentLedgerVersion,
      false,
      true,
      0,
      output,
    );
    if (!this.releaseClaimsForTerminal(jobId, ledger, input.expectedCurrentLedgerVersion)) {
      output.ok = false;
      output.reason = this.releaseOutput.reason ?? "reservation_claim_not_active";
      return;
    }
    writeAdoptedTerminalSuccess(
      input,
      this.preparedTerminal.nextSlotVersion,
      this.preparedTerminal.nextJobCoreVersion,
      input.expectedDriverVersion + 1,
      0,
      0,
      0,
      0,
      0,
      this.releaseOutput.version,
      false,
      false,
      this.releaseOutput.releasedCount,
      output,
    );
    this.commitTerminalTail(input, jobCore);
  }

  pickup(
    jobId: number,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateStep(jobId, HAUL_STEP_RESERVED);
    if (!validation.ok) {
      return validation;
    }

    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }

    const source = storage.readSlot(this.sourceSlotIds[jobId] ?? 0);
    if (source === undefined) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    const removed = items.removeQuantity(source.stackId, this.amounts[jobId] ?? 0, source.defId);
    if (!removed.ok) {
      return { ok: false, reason: "hauling_item_mutation_failed" };
    }

    const generation = this.jobGenerations[jobId] ?? 0;
    const carriedOk =
      generation === 0
        ? jobCore.setCarriedState(jobId, source.defId, this.amounts[jobId] ?? 0).ok
        : this.setAutonomyCarried(jobId, source.defId, this.amounts[jobId] ?? 0, tick, jobCore);
    if (!carriedOk) {
      const restored = items.addQuantity(source.stackId, this.amounts[jobId] ?? 0, source.defId);
      if (!restored.ok) {
        throw new Error(`failed to rollback pickup quantity: ${restored.reason}`);
      }
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    const enteredOk =
      generation === 0
        ? jobCore.enterStep(jobId, "interact", tick).ok
        : this.enterAutonomyStep(jobId, "interact", tick, jobCore);
    if (!enteredOk) {
      const restored = items.addQuantity(source.stackId, this.amounts[jobId] ?? 0, source.defId);
      if (!restored.ok) {
        throw new Error(`failed to rollback pickup quantity: ${restored.reason}`);
      }
      const clearedOk =
        generation === 0
          ? jobCore.setCarriedState(jobId, JOB_NONE, 0).ok
          : this.setAutonomyCarried(jobId, JOB_NONE, 0, tick, jobCore);
      if (!clearedOk) {
        throw new Error("failed to rollback pickup carried state");
      }
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.carriedDefIds[jobId] = source.defId;
    this.carriedAmounts[jobId] = this.amounts[jobId] ?? 0;
    this.stepCodes[jobId] = HAUL_STEP_PICKED_UP;
    storage.markSlotDirty(source.slotId);
    return this.finish(jobId);
  }

  deliver(
    jobId: number,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateStep(jobId, HAUL_STEP_PICKED_UP);
    if (!validation.ok) {
      return validation;
    }
    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }

    const destination = storage.readSlot(this.destinationSlotIds[jobId] ?? 0);
    if (destination === undefined) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    const generation = this.jobGenerations[jobId] ?? 0;
    if (!isSafeTick(tick)) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    if (generation === 0) {
      return this.deliverLegacy(jobId, tick, destination, items, storage, ledger, jobCore);
    }
    if (!this.prepareAutonomyTerminal(jobId, tick, "completed", "none", jobCore)) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    if ((this.effectPhases[jobId] ?? 0) === 0) {
      const added = items.addQuantity(
        destination.stackId,
        this.carriedAmounts[jobId] ?? 0,
        this.carriedDefIds[jobId] ?? 0,
      );
      if (!added.ok) return { ok: false, reason: "hauling_item_mutation_failed" };
      this.carriedDefIds[jobId] = JOB_NONE;
      this.carriedAmounts[jobId] = 0;
      this.effectPhases[jobId] = 1;
      this.storeVersion += 1;
    }
    if (!this.releaseClaimsForTerminal(jobId, ledger)) {
      return { ok: false, reason: this.releaseOutput.reason ?? "reservation_claim_not_active" };
    }
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.effectPhases[jobId] = 2;
    this.stepCodes[jobId] = HAUL_STEP_DELIVERED;
    this.clearLegacyClaimAudit(jobId);
    storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
    storage.markSlotDirty(destination.slotId);
    return this.finish(jobId);
  }

  cancel(
    jobId: number,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if (this.isTerminalStep(jobId)) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }

    if ((this.jobGenerations[jobId] ?? 0) === 0) {
      return this.cancelLegacy(jobId, tick, items, storage, ledger, jobCore);
    }
    if (!this.prepareAutonomyTerminal(jobId, tick, "canceled", "cancelled", jobCore)) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    if ((this.effectPhases[jobId] ?? 0) === 0) {
      const returned = this.returnCarriedToSource(jobId, items, storage);
      if (!returned.ok) return returned;
      this.clearCarried(jobId);
      this.effectPhases[jobId] = 1;
      this.storeVersion += 1;
    }
    if (!this.releaseClaimsForTerminal(jobId, ledger)) {
      return { ok: false, reason: this.releaseOutput.reason ?? "reservation_claim_not_active" };
    }
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.effectPhases[jobId] = 2;
    this.stepCodes[jobId] = HAUL_STEP_CANCELED;
    this.clearLegacyClaimAudit(jobId);
    storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
    storage.markSlotDirty(this.destinationSlotIds[jobId] ?? 0);
    return this.finish(jobId);
  }

  fail(
    jobId: number,
    tick: number,
    reason: JobFailureReason,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if (this.isTerminalStep(jobId)) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }

    if ((this.jobGenerations[jobId] ?? 0) === 0) {
      return this.failLegacy(jobId, tick, reason, items, storage, ledger, jobCore);
    }
    if (!this.prepareAutonomyTerminal(jobId, tick, "failed", reason, jobCore)) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    if ((this.effectPhases[jobId] ?? 0) === 0) {
      const returned = this.returnCarriedToSource(jobId, items, storage);
      if (!returned.ok) return returned;
      this.clearCarried(jobId);
      this.effectPhases[jobId] = 1;
      this.storeVersion += 1;
    }
    if (!this.releaseClaimsForTerminal(jobId, ledger)) {
      return { ok: false, reason: this.releaseOutput.reason ?? "reservation_claim_not_active" };
    }
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.effectPhases[jobId] = 2;
    this.stepCodes[jobId] = HAUL_STEP_FAILED;
    this.clearLegacyClaimAudit(jobId);
    storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
    storage.markSlotDirty(this.destinationSlotIds[jobId] ?? 0);
    return this.finish(jobId);
  }

  interrupt(
    jobId: number,
    kind: JobInterruptionKind,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }
    if (this.isTerminalStep(jobId)) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      return { ok: false, reason: "hauling_step_invalid" };
    }
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }

    if ((this.jobGenerations[jobId] ?? 0) > 0) {
      if (!this.prepareAutonomyTerminal(jobId, tick, "canceled", "cancelled", jobCore, kind)) {
        return {
          ok: false,
          reason:
            this.preparedTerminal.reason === "job_interruption_denied"
              ? "hauling_interruption_denied"
              : "hauling_job_core_failed",
        };
      }
      if ((this.effectPhases[jobId] ?? 0) === 0) {
        const returned = this.returnCarriedToSource(jobId, items, storage);
        if (!returned.ok) return returned;
        this.clearCarried(jobId);
        this.effectPhases[jobId] = 1;
        this.storeVersion += 1;
      }
      if (!this.releaseClaimsForTerminal(jobId, ledger)) {
        return { ok: false, reason: this.releaseOutput.reason ?? "reservation_claim_not_active" };
      }
      commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
      this.effectPhases[jobId] = 2;
      this.stepCodes[jobId] = HAUL_STEP_CANCELED;
      storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
      storage.markSlotDirty(this.destinationSlotIds[jobId] ?? 0);
      return this.finish(jobId);
    }

    const returned = this.returnCarriedToSource(jobId, items, storage);
    if (!returned.ok) {
      return returned;
    }

    const interrupted = jobCore.requestInterruption(jobId, kind, tick, ledger);
    if (!interrupted.ok) {
      this.rollbackReturnedToCarried(
        jobId,
        returned.returnedAmount,
        returned.returnedDefId,
        items,
        storage,
      );
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    if (!interrupted.interrupted) {
      this.rollbackReturnedToCarried(
        jobId,
        returned.returnedAmount,
        returned.returnedDefId,
        items,
        storage,
      );
      return { ok: false, reason: "hauling_interruption_denied" };
    }

    this.clearCarried(jobId);
    this.stepCodes[jobId] = HAUL_STEP_CANCELED;
    storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
    storage.markSlotDirty(this.destinationSlotIds[jobId] ?? 0);
    return this.finish(jobId);
  }

  private matchesTerminalCaller(
    input: HaulingAdoptedTerminalInput,
    jobCore: JobCoreStore,
    phase: number,
  ): boolean {
    const jobId = input.jobId;
    const requiredDriverHeadroom = phase === 0 || phase === 1 ? 2 : phase === 2 ? 1 : 0;
    const committedMatches =
      phase === 3
        ? this.matchesCommittedTerminalJob(input, jobCore)
        : this.matchesCommittedTerminalRunningJob(input, jobCore, phase);
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
      (phase !== 3 || input.expectedCurrentLedgerVersion === this.reservationVersions[jobId]) &&
      isSafeTick(input.tick) &&
      input.tick >= (this.createdTicks[jobId] ?? 0) &&
      input.tick >= (this.stepEnteredTicks[jobId] ?? 0) &&
      input.tick >= (this.lastEffectTicks[jobId] ?? 0) &&
      committedMatches &&
      ((phase === 3 && this.active[jobId] === 0 && this.isTerminalStep(jobId)) ||
        ((phase === 0 || phase === 1 || phase === 2) && this.active[jobId] === 1))
    );
  }

  private matchesResumeCleanup(input: HaulingResumeCleanupInput, jobCore: JobCoreStore): boolean {
    const jobId = input.jobId;
    return (
      input.jobGeneration > 0 &&
      this.active[jobId] === 1 &&
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
      this.matchesCommittedTerminalRunningJob(input, jobCore, 2)
    );
  }

  private hasTerminalCounterHeadroom(outcome: HaulingAdoptedTerminalOutcome): boolean {
    if (outcome === "delivered") return this.cumulativeDeliveredCount < 0xffff_ffff;
    if (outcome === "canceled") return this.cumulativeCanceledCount < 0xffff_ffff;
    return this.cumulativeFailedCount < 0xffff_ffff;
  }

  private commitTerminalTail(
    input: HaulingAdoptedTerminalInput | HaulingResumeCleanupInput,
    jobCore: JobCoreStore,
  ): void {
    const jobId = input.jobId;
    commitPreparedAutonomyTerminal(jobCore, this.preparedTerminal);
    this.jobSlotVersions[jobId] = this.preparedTerminal.nextSlotVersion;
    this.reservationVersions[jobId] = this.releaseOutput.version;
    this.stepCodes[jobId] = encodeTerminalStep(input.outcome);
    this.stepEnteredTicks[jobId] = input.tick;
    if (input.outcome === "delivered") this.cumulativeDeliveredCount += 1;
    else if (input.outcome === "canceled") this.cumulativeCanceledCount += 1;
    else this.cumulativeFailedCount += 1;
    this.effectPhases[jobId] = 3;
    this.active[jobId] = 0;
    this.activeCount -= 1;
    const base = jobId * 4;
    for (let index = 0; index < 4; index += 1) {
      this.claimIds[base + index] = JOB_NONE;
      this.claimEpochs[base + index] = 0;
      this.claimCreatedTicks[base + index] = 0;
      this.claimLeaseExpiryTicks[base + index] = 0;
    }
    this.clearOriginShadow(jobId);
    this.storeVersion += 1;
  }

  private matchesCommittedRunningJob(
    input: HaulingAdoptedPickupInput,
    jobCore: JobCoreStore,
    alreadyCommitted: boolean,
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
      this.matchesCommittedIdentity(
        input.jobId,
        input.jobGeneration,
        input.owner,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
      ) &&
      this.committedJobOutput.state === "running" &&
      this.committedJobOutput.status === "running" &&
      this.committedJobOutput.step === (alreadyCommitted ? "interact" : "path_to_source") &&
      this.committedJobOutput.interruptionPolicy === "immediate" &&
      this.committedJobOutput.failureReason === "none" &&
      this.committedJobOutput.createdTick === (this.createdTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.stepEnteredTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.lastMutationTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.stepTickCount === 0 &&
      this.committedJobOutput.progressQ16 === 0 &&
      this.committedJobOutput.requiredWorkQ16 === 0 &&
      this.committedJobOutput.carriedDefId ===
        (alreadyCommitted ? (this.carriedDefIds[input.jobId] ?? JOB_NONE) : JOB_NONE) &&
      this.committedJobOutput.carriedAmount ===
        (alreadyCommitted ? (this.carriedAmounts[input.jobId] ?? 0) : 0) &&
      this.committedJobOutput.terminalEffectPhase === 0
    );
  }

  private matchesCommittedTerminalRunningJob(
    input: HaulingAdoptedTerminalInput | HaulingResumeCleanupInput,
    jobCore: JobCoreStore,
    phase: number,
  ): boolean {
    jobCore.readCommittedAutonomyJobInto(
      input.jobId,
      input.jobGeneration,
      input.owner.index,
      input.owner.generation,
      input.expectedJobSlotVersion,
      this.committedJobOutput,
    );
    const pickedUp = this.pickupOnce[input.jobId] === 1;
    const expectedStepTick = this.stepEnteredTicks[input.jobId] ?? 0;
    return (
      this.matchesCommittedIdentity(
        input.jobId,
        input.jobGeneration,
        input.owner,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
      ) &&
      this.committedJobOutput.state === "running" &&
      this.committedJobOutput.status === "running" &&
      this.committedJobOutput.step === (pickedUp ? "interact" : "path_to_source") &&
      this.committedJobOutput.interruptionPolicy === "immediate" &&
      this.committedJobOutput.failureReason === "none" &&
      this.committedJobOutput.createdTick === (this.createdTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.stepEnteredTick === expectedStepTick &&
      this.committedJobOutput.lastMutationTick === expectedStepTick &&
      this.committedJobOutput.stepTickCount === 0 &&
      this.committedJobOutput.progressQ16 === 0 &&
      this.committedJobOutput.requiredWorkQ16 === 0 &&
      this.committedJobOutput.carriedAmount === (pickedUp ? (this.amounts[input.jobId] ?? 0) : 0) &&
      (pickedUp
        ? this.committedJobOutput.carriedDefId === (this.defIds[input.jobId] ?? JOB_NONE)
        : this.committedJobOutput.carriedDefId === JOB_NONE) &&
      this.committedJobOutput.terminalEffectPhase === 0 &&
      (phase !== 0 || !pickedUp)
    );
  }

  private matchesCommittedTerminalJob(
    input: HaulingAdoptedTerminalInput,
    jobCore: JobCoreStore,
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
      this.matchesCommittedIdentity(
        input.jobId,
        input.jobGeneration,
        input.owner,
        input.expectedJobSlotVersion,
        input.expectedJobCoreVersion,
      ) &&
      this.committedJobOutput.state === "tombstone" &&
      this.committedJobOutput.status === terminalStatus(input.outcome) &&
      this.committedJobOutput.step === "complete" &&
      this.committedJobOutput.interruptionPolicy === "immediate" &&
      this.committedJobOutput.failureReason === input.failureReason &&
      this.committedJobOutput.terminalEffectPhase === 3 &&
      this.committedJobOutput.createdTick === (this.createdTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.stepEnteredTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.lastMutationTick === (this.stepEnteredTicks[input.jobId] ?? 0) &&
      this.committedJobOutput.stepTickCount === 0 &&
      this.committedJobOutput.progressQ16 === 0 &&
      this.committedJobOutput.requiredWorkQ16 === 0 &&
      this.committedJobOutput.carriedDefId === JOB_NONE &&
      this.committedJobOutput.carriedAmount === 0
    );
  }

  private matchesCommittedIdentity(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    expectedJobCoreVersion: number,
  ): boolean {
    return (
      this.committedJobOutput.ok &&
      this.committedJobOutput.found &&
      this.committedJobOutput.jobId === jobId &&
      this.committedJobOutput.jobGeneration === jobGeneration &&
      this.committedJobOutput.ownerIndex === owner.index &&
      this.committedJobOutput.ownerGeneration === owner.generation &&
      this.committedJobOutput.slotVersion === expectedSlotVersion &&
      this.committedJobOutput.jobKind === HAULING_JOB_KIND &&
      this.committedJobOutput.targetId === (this.destinationSlotIds[jobId] ?? JOB_NONE) &&
      this.committedJobOutput.version === expectedJobCoreVersion
    );
  }

  private matchesStoredActiveClaims(
    jobId: number,
    owner: EntityId,
    jobGeneration: number,
    expectedLedgerVersion: number,
    ledger: ReservationLedger,
    claims: ReservationClaimsIntoOutput,
  ): boolean {
    copyStoredClaimPrefix(
      this.claimIds,
      this.claimEpochs,
      jobId * 4,
      4,
      this.claimReadIds,
      this.claimReadEpochs,
    );
    ledger.readActiveClaimsInto(
      this.claimReadIds,
      this.claimReadEpochs,
      4,
      owner,
      jobId,
      jobGeneration,
      expectedLedgerVersion,
      claims,
    );
    const amount = this.amounts[jobId] ?? 0;
    return (
      claims.ok &&
      claims.claimCount === 4 &&
      claims.version === expectedLedgerVersion &&
      matchesStoredClaimRows(
        this.claimIds,
        this.claimEpochs,
        this.claimCreatedTicks,
        this.claimLeaseExpiryTicks,
        jobId * 4,
        claims,
        4,
      ) &&
      claims.channelCodes[0] === RESERVATION_ITEM_QUANTITY &&
      claims.channelCodes[1] === RESERVATION_CAPACITY &&
      claims.channelCodes[2] === RESERVATION_INTERACTION_SPOT &&
      claims.channelCodes[3] === RESERVATION_INTERACTION_SPOT &&
      claims.hasTargetFlags[0] === 1 &&
      claims.hasTargetFlags[1] === 1 &&
      claims.hasTargetFlags[2] === 1 &&
      claims.hasTargetFlags[3] === 1 &&
      claims.targetIndexes[0] === this.sourceItemIndexes[jobId] &&
      claims.targetGenerations[0] === this.sourceItemGenerations[jobId] &&
      claims.targetIndexes[2] === this.sourceItemIndexes[jobId] &&
      claims.targetGenerations[2] === this.sourceItemGenerations[jobId] &&
      claims.targetIndexes[1] === this.destinationStorageIndexes[jobId] &&
      claims.targetGenerations[1] === this.destinationStorageGenerations[jobId] &&
      claims.targetIndexes[3] === this.destinationStorageIndexes[jobId] &&
      claims.targetGenerations[3] === this.destinationStorageGenerations[jobId] &&
      claims.amounts[0] === amount &&
      claims.amounts[1] === amount &&
      claims.amounts[2] === 0 &&
      claims.amounts[3] === 0 &&
      claims.cellIndexes[0] === JOB_NONE &&
      claims.cellIndexes[1] === JOB_NONE &&
      claims.cellIndexes[2] === JOB_NONE &&
      claims.cellIndexes[3] === JOB_NONE &&
      claims.slotIds[0] === JOB_NONE &&
      claims.slotIds[1] === this.destinationSlotIds[jobId] &&
      claims.slotIds[2] === this.sourceInteractionSpotIds[jobId] &&
      claims.slotIds[3] === this.destinationInteractionSpotIds[jobId]
    );
  }

  private readAndValidateTerminalClaims(
    input: HaulingAdoptedTerminalInput,
    ledger: ReservationLedger,
    claims: ReservationClaimsIntoOutput,
    output: HaulingAdoptedMutationOutput,
  ): boolean {
    const jobId = input.jobId;
    if (
      !this.matchesStoredActiveClaims(
        jobId,
        input.owner,
        input.jobGeneration,
        input.expectedCurrentLedgerVersion,
        ledger,
        claims,
      )
    ) {
      output.reason = claims.reason ?? "hauling_source_unavailable";
      return false;
    }
    return true;
  }

  private prepareTerminalDomainEffect(
    input: HaulingAdoptedTerminalInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    output: HaulingAdoptedMutationOutput,
  ): boolean {
    const jobId = input.jobId;
    const amount = this.carriedAmounts[jobId] ?? 0;
    const defId = this.carriedDefIds[jobId] ?? JOB_NONE;
    if (
      this.stepCodes[jobId] !== HAUL_STEP_PICKED_UP ||
      this.pickupOnce[jobId] !== 1 ||
      amount === 0 ||
      defId === JOB_NONE
    ) {
      output.reason = "hauling_step_invalid";
      return false;
    }
    const targetSlotId =
      input.outcome === "delivered"
        ? (this.destinationSlotIds[jobId] ?? 0)
        : (this.sourceSlotIds[jobId] ?? 0);
    const targetStackId =
      input.outcome === "delivered"
        ? (this.destinationStackIds[jobId] ?? JOB_NONE)
        : (this.sourceStackIds[jobId] ?? JOB_NONE);
    storage.readSlotInto(targetSlotId, this.terminalSlotScratch);
    if (
      !matchesTerminalSlot(this.terminalSlotScratch, input.targetSlot, input.targetItem) ||
      input.targetItem.stackId !== targetStackId ||
      input.targetItem.defId !== (this.defIds[jobId] ?? JOB_NONE) ||
      input.targetDirty.slotId !== targetSlotId ||
      !matchesDirtyBasis(input.targetDirty, input.targetSlot)
    ) {
      output.reason = "hauling_slot_invalid";
      return false;
    }
    items.readStackInto(
      input.targetItem.stackId,
      ledger,
      this.terminalItemReadScratch,
      this.terminalItemScratch,
    );
    if (
      !matchesItemAddition(
        this.terminalItemScratch,
        input.targetItem,
        input.expectedCurrentLedgerVersion,
      ) ||
      input.targetItem.amount !== amount ||
      input.targetItem.defId !== defId
    ) {
      output.reason = "hauling_item_mutation_failed";
      return false;
    }
    items.prepareAutonomousQuantityAdditionInto(
      input.targetItem,
      ledger,
      this.preparedTerminalItem,
    );
    if (!this.preparedTerminalItem.ok) {
      output.reason = this.preparedTerminalItem.reason;
      return false;
    }
    storage.prepareSlotDirtyInto(input.targetDirty, this.preparedTerminalDirty);
    if (!this.preparedTerminalDirty.ok) {
      output.reason = this.preparedTerminalDirty.reason;
      return false;
    }
    return true;
  }

  private commitAdoptedPickupAppend(
    input: HaulingAdoptedPickupInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    jobCore: JobCoreStore,
  ): void {
    commitPreparedItemStackQuantityRemoval(items, this.preparedPickupItem);
    commitPreparedAutonomyCarriedStep(jobCore, this.preparedPickupCore);
    commitPreparedStorageDirtyAppend(storage, this.preparedSourceDirty);
    this.commitPickupDriverTail(input);
  }

  private commitAdoptedPickupCoalesce(
    input: HaulingAdoptedPickupInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    jobCore: JobCoreStore,
  ): void {
    commitPreparedItemStackQuantityRemoval(items, this.preparedPickupItem);
    commitPreparedAutonomyCarriedStep(jobCore, this.preparedPickupCore);
    commitPreparedStorageDirtyCoalesce(storage, this.preparedSourceDirty);
    this.commitPickupDriverTail(input);
  }

  private commitPickupDriverTail(input: HaulingAdoptedPickupInput): void {
    const jobId = input.jobId;
    this.carriedDefIds[jobId] = this.preparedPickupItem.defId;
    this.carriedAmounts[jobId] = this.preparedPickupItem.amount;
    this.jobSlotVersions[jobId] = this.preparedPickupCore.nextSlotVersion;
    this.stepEnteredTicks[jobId] = input.tick;
    this.stepCodes[jobId] = HAUL_STEP_PICKED_UP;
    this.effectPhases[jobId] = 1;
    this.pickupOnce[jobId] = 1;
    this.lastEffectTicks[jobId] = input.tick;
    this.storeVersion = input.expectedDriverVersion + 1;
  }

  private commitTerminalDomainAppend(
    input: HaulingAdoptedTerminalInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
  ): void {
    commitPreparedItemStackQuantityAddition(items, this.preparedTerminalItem);
    commitPreparedStorageDirtyAppend(storage, this.preparedTerminalDirty);
    this.commitTerminalDomainTail(input);
  }

  private commitTerminalDomainCoalesce(
    input: HaulingAdoptedTerminalInput,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
  ): void {
    commitPreparedItemStackQuantityAddition(items, this.preparedTerminalItem);
    commitPreparedStorageDirtyCoalesce(storage, this.preparedTerminalDirty);
    this.commitTerminalDomainTail(input);
  }

  private commitTerminalDomainTail(input: HaulingAdoptedTerminalInput): void {
    const jobId = input.jobId;
    this.clearCarried(jobId);
    this.effectPhases[jobId] = 2;
    this.pendingTerminalOutcomes[jobId] = encodeTerminalOutcome(input.outcome);
    this.pendingTerminalFailures[jobId] = encodeFailureReason(input.failureReason);
    this.pendingInterruptionKinds[jobId] = encodeInterruptionKind(input.interruptionKind);
    this.lastEffectTicks[jobId] = input.tick;
    this.storeVersion = input.expectedDriverVersion + 1;
  }

  private commitTerminalWithoutDomainEffect(input: HaulingAdoptedTerminalInput): void {
    const jobId = input.jobId;
    this.effectPhases[jobId] = 2;
    this.pendingTerminalOutcomes[jobId] = encodeTerminalOutcome(input.outcome);
    this.pendingTerminalFailures[jobId] = encodeFailureReason(input.failureReason);
    this.pendingInterruptionKinds[jobId] = encodeInterruptionKind(input.interruptionKind);
    this.lastEffectTicks[jobId] = input.tick;
    this.storeVersion = input.expectedDriverVersion + 1;
  }

  readJob(jobId: number): HaulingJobView | undefined {
    if (!this.isActiveJob(jobId) || (this.jobGenerations[jobId] ?? 0) !== 0) {
      return undefined;
    }

    return {
      jobId,
      owner: this.readOwner(jobId),
      sourceSlotId: this.sourceSlotIds[jobId] ?? 0,
      destinationSlotId: this.destinationSlotIds[jobId] ?? 0,
      amount: this.amounts[jobId] ?? 0,
      createdTick: this.createdTicks[jobId] ?? 0,
      step: decodeStep(this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED),
      carriedDefId: this.carriedDefIds[jobId] ?? JOB_NONE,
      carriedAmount: this.carriedAmounts[jobId] ?? 0,
    };
  }

  readAdoptedJobInto(
    jobId: number,
    jobGeneration: number,
    owner: EntityId,
    expectedSlotVersion: number,
    output: HaulingAdoptedJobIntoOutput,
  ): void {
    resetAdoptedJobOutput(output, this.storeVersion);
    if (
      output.claimIds.length !== 4 ||
      output.claimEpochs.length !== 4 ||
      output.claimCreatedTicks.length !== 4 ||
      output.claimLeaseExpiryTicks.length !== 4 ||
      !isIndexInRange(jobId, this.capacity) ||
      jobGeneration === 0 ||
      this.jobGenerations[jobId] !== jobGeneration ||
      this.ownerIndexes[jobId] !== owner.index ||
      this.ownerGenerations[jobId] !== owner.generation ||
      this.jobSlotVersions[jobId] !== expectedSlotVersion
    ) {
      output.reason = "hauling_step_invalid";
      return;
    }
    output.ok = true;
    output.active = this.active[jobId] === 1;
    output.jobId = jobId;
    output.jobGeneration = jobGeneration;
    output.ownerIndex = owner.index;
    output.ownerGeneration = owner.generation;
    output.sourceSlotId = this.sourceSlotIds[jobId] ?? 0;
    output.destinationSlotId = this.destinationSlotIds[jobId] ?? 0;
    output.sourceItemIndex = this.sourceItemIndexes[jobId] ?? 0;
    output.sourceItemGeneration = this.sourceItemGenerations[jobId] ?? 0;
    output.destinationStorageIndex = this.destinationStorageIndexes[jobId] ?? 0;
    output.destinationStorageGeneration = this.destinationStorageGenerations[jobId] ?? 0;
    output.sourceInteractionSpotId = this.sourceInteractionSpotIds[jobId] ?? 0;
    output.destinationInteractionSpotId = this.destinationInteractionSpotIds[jobId] ?? 0;
    output.sourceStackId = this.sourceStackIds[jobId] ?? 0;
    output.destinationStackId = this.destinationStackIds[jobId] ?? 0;
    output.defId = this.defIds[jobId] ?? 0;
    output.destinationCapacity = this.destinationCapacities[jobId] ?? 0;
    const claimBase = jobId * 4;
    for (let index = 0; index < 4; index += 1) {
      output.claimIds[index] = this.claimIds[claimBase + index] ?? JOB_NONE;
      output.claimEpochs[index] = this.claimEpochs[claimBase + index] ?? 0;
      output.claimCreatedTicks[index] = this.claimCreatedTicks[claimBase + index] ?? 0;
      output.claimLeaseExpiryTicks[index] = this.claimLeaseExpiryTicks[claimBase + index] ?? 0;
    }
    output.amount = this.amounts[jobId] ?? 0;
    output.createdTick = this.createdTicks[jobId] ?? 0;
    output.stepEnteredTick = this.stepEnteredTicks[jobId] ?? 0;
    output.step = decodeStep(this.stepCodes[jobId] ?? 0);
    output.carriedDefId = this.carriedDefIds[jobId] ?? JOB_NONE;
    output.carriedAmount = this.carriedAmounts[jobId] ?? 0;
    output.jobSlotVersion = expectedSlotVersion;
    output.reservationVersion = this.reservationVersions[jobId] ?? 0;
    output.effectPhase = this.effectPhases[jobId] ?? 0;
    output.pickupCommitted = this.pickupOnce[jobId] === 1;
    output.cleanupPending = this.effectPhases[jobId] === 2;
    output.terminalOutcome = decodeTerminalOutcome(this.pendingTerminalOutcomes[jobId] ?? 0);
    output.pendingTerminalFailure = this.pendingTerminalFailures[jobId] ?? 0;
    output.pendingInterruptionKind = this.pendingInterruptionKinds[jobId] ?? 0;
    output.lastEffectTick = this.lastEffectTicks[jobId] ?? 0;
    output.activeCount = this.activeCount;
    for (let rowId = 0; rowId < this.capacity; rowId += 1) {
      const step = this.stepCodes[rowId] ?? 0;
      if ((this.active[rowId] ?? 0) === 1) {
        output.reservedCount += step === HAUL_STEP_RESERVED ? 1 : 0;
        output.pickedUpCount += step === HAUL_STEP_PICKED_UP ? 1 : 0;
      }
      output.deliveredCount += step === HAUL_STEP_DELIVERED ? 1 : 0;
      output.canceledCount += step === HAUL_STEP_CANCELED ? 1 : 0;
      output.failedCount += step === HAUL_STEP_FAILED ? 1 : 0;
      const originStep = this.originCodes[rowId * ORIGIN_CODE_STRIDE + ORIGIN_STEP_CODE] ?? 0;
      output.deliveredCount +=
        this.originShadowPresent[rowId] === 1 && originStep === HAUL_STEP_DELIVERED ? 1 : 0;
      output.canceledCount +=
        this.originShadowPresent[rowId] === 1 && originStep === HAUL_STEP_CANCELED ? 1 : 0;
      output.failedCount +=
        this.originShadowPresent[rowId] === 1 && originStep === HAUL_STEP_FAILED ? 1 : 0;
    }
    output.cumulativeDeliveredCount = this.cumulativeDeliveredCount;
    output.cumulativeCanceledCount = this.cumulativeCanceledCount;
    output.cumulativeFailedCount = this.cumulativeFailedCount;
    const originU32 = jobId * ORIGIN_U32_STRIDE;
    const originTick = jobId * ORIGIN_TICK_STRIDE;
    const originCode = jobId * ORIGIN_CODE_STRIDE;
    output.originShadowPresent = this.originShadowPresent[jobId] === 1;
    output.originOwnerIndex = this.originU32[originU32 + ORIGIN_OWNER_INDEX] ?? 0;
    output.originOwnerGeneration = this.originU32[originU32 + ORIGIN_OWNER_GENERATION] ?? 0;
    output.originSourceSlotId = this.originU32[originU32 + ORIGIN_SOURCE_SLOT_ID] ?? 0;
    output.originDestinationSlotId = this.originU32[originU32 + ORIGIN_DESTINATION_SLOT_ID] ?? 0;
    output.originSourceItemIndex = this.originU32[originU32 + ORIGIN_SOURCE_ITEM_INDEX] ?? 0;
    output.originSourceItemGeneration =
      this.originU32[originU32 + ORIGIN_SOURCE_ITEM_GENERATION] ?? 0;
    output.originDestinationStorageIndex =
      this.originU32[originU32 + ORIGIN_DESTINATION_STORAGE_INDEX] ?? 0;
    output.originDestinationStorageGeneration =
      this.originU32[originU32 + ORIGIN_DESTINATION_STORAGE_GENERATION] ?? 0;
    output.originSourceInteractionSpotId =
      this.originU32[originU32 + ORIGIN_SOURCE_INTERACTION_SPOT_ID] ?? 0;
    output.originDestinationInteractionSpotId =
      this.originU32[originU32 + ORIGIN_DESTINATION_INTERACTION_SPOT_ID] ?? 0;
    output.originSourceStackId = this.originU32[originU32 + ORIGIN_SOURCE_STACK_ID] ?? 0;
    output.originDestinationStackId = this.originU32[originU32 + ORIGIN_DESTINATION_STACK_ID] ?? 0;
    output.originDefId = this.originU32[originU32 + ORIGIN_DEF_ID] ?? 0;
    output.originDestinationCapacity = this.originU32[originU32 + ORIGIN_DESTINATION_CAPACITY] ?? 0;
    output.originAmount = this.originU32[originU32 + ORIGIN_AMOUNT] ?? 0;
    output.originCreatedTick = this.originTicks[originTick + ORIGIN_CREATED_TICK] ?? 0;
    output.originStepEnteredTick = this.originTicks[originTick + ORIGIN_STEP_ENTERED_TICK] ?? 0;
    output.originJobGeneration = this.originU32[originU32 + ORIGIN_JOB_GENERATION] ?? 0;
    output.originReservationVersion = this.originU32[originU32 + ORIGIN_RESERVATION_VERSION] ?? 0;
    output.originStep = decodeStep(this.originCodes[originCode + ORIGIN_STEP_CODE] ?? 0);
    output.originPickupCommitted = this.originCodes[originCode + ORIGIN_PICKUP_ONCE] === 1;
    output.originLastEffectTick = this.originTicks[originTick + ORIGIN_LAST_EFFECT_TICK] ?? 0;
    output.originTerminalOutcome = decodeTerminalOutcome(
      this.originCodes[originCode + ORIGIN_PENDING_OUTCOME] ?? 0,
    );
    output.originPendingTerminalFailure =
      this.originCodes[originCode + ORIGIN_PENDING_FAILURE] ?? 0;
    output.originPendingInterruptionKind =
      this.originCodes[originCode + ORIGIN_PENDING_INTERRUPTION] ?? 0;
  }

  createSnapshot(): HaulingJobSnapshot {
    const rows: HaulingJobSnapshotRow[] = [];
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const base = jobId * 4;
      const originU32 = jobId * ORIGIN_U32_STRIDE;
      const originTick = jobId * ORIGIN_TICK_STRIDE;
      const originCode = jobId * ORIGIN_CODE_STRIDE;
      rows.push({
        jobId,
        active: this.active[jobId] ?? 0,
        ownerIndex: this.ownerIndexes[jobId] ?? 0,
        ownerGeneration: this.ownerGenerations[jobId] ?? 0,
        sourceSlotId: this.sourceSlotIds[jobId] ?? 0,
        destinationSlotId: this.destinationSlotIds[jobId] ?? 0,
        sourceItemIndex: this.sourceItemIndexes[jobId] ?? 0,
        sourceItemGeneration: this.sourceItemGenerations[jobId] ?? 0,
        destinationStorageIndex: this.destinationStorageIndexes[jobId] ?? 0,
        destinationStorageGeneration: this.destinationStorageGenerations[jobId] ?? 0,
        sourceInteractionSpotId: this.sourceInteractionSpotIds[jobId] ?? 0,
        destinationInteractionSpotId: this.destinationInteractionSpotIds[jobId] ?? 0,
        sourceStackId: this.sourceStackIds[jobId] ?? 0,
        destinationStackId: this.destinationStackIds[jobId] ?? 0,
        defId: this.defIds[jobId] ?? 0,
        destinationCapacity: this.destinationCapacities[jobId] ?? 0,
        amount: this.amounts[jobId] ?? 0,
        createdTick: this.createdTicks[jobId] ?? 0,
        stepEnteredTick: this.stepEnteredTicks[jobId] ?? 0,
        jobGeneration: this.jobGenerations[jobId] ?? 0,
        jobSlotVersion: this.jobSlotVersions[jobId] ?? 0,
        claimIds: [
          this.claimIds[base] ?? JOB_NONE,
          this.claimIds[base + 1] ?? JOB_NONE,
          this.claimIds[base + 2] ?? JOB_NONE,
          this.claimIds[base + 3] ?? JOB_NONE,
        ],
        claimEpochs: [
          this.claimEpochs[base] ?? 0,
          this.claimEpochs[base + 1] ?? 0,
          this.claimEpochs[base + 2] ?? 0,
          this.claimEpochs[base + 3] ?? 0,
        ],
        claimCreatedTicks: [
          this.claimCreatedTicks[base] ?? 0,
          this.claimCreatedTicks[base + 1] ?? 0,
          this.claimCreatedTicks[base + 2] ?? 0,
          this.claimCreatedTicks[base + 3] ?? 0,
        ],
        claimLeaseExpiryTicks: [
          this.claimLeaseExpiryTicks[base] ?? 0,
          this.claimLeaseExpiryTicks[base + 1] ?? 0,
          this.claimLeaseExpiryTicks[base + 2] ?? 0,
          this.claimLeaseExpiryTicks[base + 3] ?? 0,
        ],
        reservationVersion: this.reservationVersions[jobId] ?? 0,
        effectPhase: this.effectPhases[jobId] ?? 0,
        stepCode: this.stepCodes[jobId] ?? 0,
        carriedDefId: this.carriedDefIds[jobId] ?? JOB_NONE,
        carriedAmount: this.carriedAmounts[jobId] ?? 0,
        pickupOnce: this.pickupOnce[jobId] ?? 0,
        lastEffectTick: this.lastEffectTicks[jobId] ?? 0,
        pendingTerminalOutcome: this.pendingTerminalOutcomes[jobId] ?? 0,
        pendingTerminalFailure: this.pendingTerminalFailures[jobId] ?? 0,
        pendingInterruptionKind: this.pendingInterruptionKinds[jobId] ?? 0,
        originShadowPresent: this.originShadowPresent[jobId] ?? 0,
        originOwnerIndex: this.originU32[originU32 + ORIGIN_OWNER_INDEX] ?? 0,
        originOwnerGeneration: this.originU32[originU32 + ORIGIN_OWNER_GENERATION] ?? 0,
        originSourceSlotId: this.originU32[originU32 + ORIGIN_SOURCE_SLOT_ID] ?? 0,
        originDestinationSlotId: this.originU32[originU32 + ORIGIN_DESTINATION_SLOT_ID] ?? 0,
        originSourceItemIndex: this.originU32[originU32 + ORIGIN_SOURCE_ITEM_INDEX] ?? 0,
        originSourceItemGeneration: this.originU32[originU32 + ORIGIN_SOURCE_ITEM_GENERATION] ?? 0,
        originDestinationStorageIndex:
          this.originU32[originU32 + ORIGIN_DESTINATION_STORAGE_INDEX] ?? 0,
        originDestinationStorageGeneration:
          this.originU32[originU32 + ORIGIN_DESTINATION_STORAGE_GENERATION] ?? 0,
        originSourceInteractionSpotId:
          this.originU32[originU32 + ORIGIN_SOURCE_INTERACTION_SPOT_ID] ?? 0,
        originDestinationInteractionSpotId:
          this.originU32[originU32 + ORIGIN_DESTINATION_INTERACTION_SPOT_ID] ?? 0,
        originSourceStackId: this.originU32[originU32 + ORIGIN_SOURCE_STACK_ID] ?? 0,
        originDestinationStackId: this.originU32[originU32 + ORIGIN_DESTINATION_STACK_ID] ?? 0,
        originDefId: this.originU32[originU32 + ORIGIN_DEF_ID] ?? 0,
        originDestinationCapacity: this.originU32[originU32 + ORIGIN_DESTINATION_CAPACITY] ?? 0,
        originAmount: this.originU32[originU32 + ORIGIN_AMOUNT] ?? 0,
        originCreatedTick: this.originTicks[originTick + ORIGIN_CREATED_TICK] ?? 0,
        originStepEnteredTick: this.originTicks[originTick + ORIGIN_STEP_ENTERED_TICK] ?? 0,
        originJobGeneration: this.originU32[originU32 + ORIGIN_JOB_GENERATION] ?? 0,
        originReservationVersion: this.originU32[originU32 + ORIGIN_RESERVATION_VERSION] ?? 0,
        originStepCode: this.originCodes[originCode + ORIGIN_STEP_CODE] ?? 0,
        originPickupOnce: this.originCodes[originCode + ORIGIN_PICKUP_ONCE] ?? 0,
        originLastEffectTick: this.originTicks[originTick + ORIGIN_LAST_EFFECT_TICK] ?? 0,
        originPendingTerminalOutcome: this.originCodes[originCode + ORIGIN_PENDING_OUTCOME] ?? 0,
        originPendingTerminalFailure: this.originCodes[originCode + ORIGIN_PENDING_FAILURE] ?? 0,
        originPendingInterruptionKind:
          this.originCodes[originCode + ORIGIN_PENDING_INTERRUPTION] ?? 0,
      });
    }
    return {
      snapshotVersion: HAULING_JOB_SNAPSHOT_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      cumulativeDeliveredCount: this.cumulativeDeliveredCount,
      cumulativeCanceledCount: this.cumulativeCanceledCount,
      cumulativeFailedCount: this.cumulativeFailedCount,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): HaulingRestoreResult {
    if (!isHaulingSnapshot(snapshot, this.capacity)) {
      return { ok: false, reason: "hauling_snapshot_invalid" };
    }
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const row = snapshot.rows[jobId];
      if (row === undefined) continue;
      const base = jobId * 4;
      const originU32 = jobId * ORIGIN_U32_STRIDE;
      const originTick = jobId * ORIGIN_TICK_STRIDE;
      const originCode = jobId * ORIGIN_CODE_STRIDE;
      this.active[jobId] = row.active;
      this.ownerIndexes[jobId] = row.ownerIndex;
      this.ownerGenerations[jobId] = row.ownerGeneration;
      this.sourceSlotIds[jobId] = row.sourceSlotId;
      this.destinationSlotIds[jobId] = row.destinationSlotId;
      this.sourceItemIndexes[jobId] = row.sourceItemIndex;
      this.sourceItemGenerations[jobId] = row.sourceItemGeneration;
      this.destinationStorageIndexes[jobId] = row.destinationStorageIndex;
      this.destinationStorageGenerations[jobId] = row.destinationStorageGeneration;
      this.sourceInteractionSpotIds[jobId] = row.sourceInteractionSpotId;
      this.destinationInteractionSpotIds[jobId] = row.destinationInteractionSpotId;
      this.sourceStackIds[jobId] = row.sourceStackId;
      this.destinationStackIds[jobId] = row.destinationStackId;
      this.defIds[jobId] = row.defId;
      this.destinationCapacities[jobId] = row.destinationCapacity;
      this.amounts[jobId] = row.amount;
      this.createdTicks[jobId] = row.createdTick;
      this.stepEnteredTicks[jobId] = row.stepEnteredTick;
      this.jobGenerations[jobId] = row.jobGeneration;
      this.jobSlotVersions[jobId] = row.jobSlotVersion;
      for (let index = 0; index < 4; index += 1) {
        this.claimIds[base + index] = row.claimIds[index] ?? JOB_NONE;
        this.claimEpochs[base + index] = row.claimEpochs[index] ?? 0;
        this.claimCreatedTicks[base + index] = row.claimCreatedTicks[index] ?? 0;
        this.claimLeaseExpiryTicks[base + index] = row.claimLeaseExpiryTicks[index] ?? 0;
      }
      this.reservationVersions[jobId] = row.reservationVersion;
      this.effectPhases[jobId] = row.effectPhase;
      this.stepCodes[jobId] = row.stepCode;
      this.carriedDefIds[jobId] = row.carriedDefId;
      this.carriedAmounts[jobId] = row.carriedAmount;
      this.pickupOnce[jobId] = row.pickupOnce;
      this.lastEffectTicks[jobId] = row.lastEffectTick;
      this.pendingTerminalOutcomes[jobId] = row.pendingTerminalOutcome;
      this.pendingTerminalFailures[jobId] = row.pendingTerminalFailure;
      this.pendingInterruptionKinds[jobId] = row.pendingInterruptionKind;
      this.originShadowPresent[jobId] = row.originShadowPresent;
      this.originU32[originU32 + ORIGIN_OWNER_INDEX] = row.originOwnerIndex;
      this.originU32[originU32 + ORIGIN_OWNER_GENERATION] = row.originOwnerGeneration;
      this.originU32[originU32 + ORIGIN_SOURCE_SLOT_ID] = row.originSourceSlotId;
      this.originU32[originU32 + ORIGIN_DESTINATION_SLOT_ID] = row.originDestinationSlotId;
      this.originU32[originU32 + ORIGIN_SOURCE_ITEM_INDEX] = row.originSourceItemIndex;
      this.originU32[originU32 + ORIGIN_SOURCE_ITEM_GENERATION] = row.originSourceItemGeneration;
      this.originU32[originU32 + ORIGIN_DESTINATION_STORAGE_INDEX] =
        row.originDestinationStorageIndex;
      this.originU32[originU32 + ORIGIN_DESTINATION_STORAGE_GENERATION] =
        row.originDestinationStorageGeneration;
      this.originU32[originU32 + ORIGIN_SOURCE_INTERACTION_SPOT_ID] =
        row.originSourceInteractionSpotId;
      this.originU32[originU32 + ORIGIN_DESTINATION_INTERACTION_SPOT_ID] =
        row.originDestinationInteractionSpotId;
      this.originU32[originU32 + ORIGIN_SOURCE_STACK_ID] = row.originSourceStackId;
      this.originU32[originU32 + ORIGIN_DESTINATION_STACK_ID] = row.originDestinationStackId;
      this.originU32[originU32 + ORIGIN_DEF_ID] = row.originDefId;
      this.originU32[originU32 + ORIGIN_DESTINATION_CAPACITY] = row.originDestinationCapacity;
      this.originU32[originU32 + ORIGIN_AMOUNT] = row.originAmount;
      this.originU32[originU32 + ORIGIN_JOB_GENERATION] = row.originJobGeneration;
      this.originU32[originU32 + ORIGIN_RESERVATION_VERSION] = row.originReservationVersion;
      this.originTicks[originTick + ORIGIN_CREATED_TICK] = row.originCreatedTick;
      this.originTicks[originTick + ORIGIN_STEP_ENTERED_TICK] = row.originStepEnteredTick;
      this.originTicks[originTick + ORIGIN_LAST_EFFECT_TICK] = row.originLastEffectTick;
      this.originCodes[originCode + ORIGIN_STEP_CODE] = row.originStepCode;
      this.originCodes[originCode + ORIGIN_PICKUP_ONCE] = row.originPickupOnce;
      this.originCodes[originCode + ORIGIN_PENDING_OUTCOME] = row.originPendingTerminalOutcome;
      this.originCodes[originCode + ORIGIN_PENDING_FAILURE] = row.originPendingTerminalFailure;
      this.originCodes[originCode + ORIGIN_PENDING_INTERRUPTION] =
        row.originPendingInterruptionKind;
    }
    this.storeVersion = snapshot.storeVersion;
    this.activeCount = snapshot.activeCount;
    this.cumulativeDeliveredCount = snapshot.cumulativeDeliveredCount;
    this.cumulativeCanceledCount = snapshot.cumulativeCanceledCount;
    this.cumulativeFailedCount = snapshot.cumulativeFailedCount;
    return { ok: true, version: this.storeVersion, activeCount: this.activeCount };
  }

  createMetrics(): HaulingMetrics {
    let reservedCount = 0;
    let pickedUpCount = 0;
    let deliveredCount = 0;
    let canceledCount = 0;
    let failedCount = 0;

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const step = this.stepCodes[jobId] ?? 0;
      if ((this.active[jobId] ?? 0) === 1) {
        reservedCount += step === HAUL_STEP_RESERVED ? 1 : 0;
        pickedUpCount += step === HAUL_STEP_PICKED_UP ? 1 : 0;
      }
      deliveredCount += step === HAUL_STEP_DELIVERED ? 1 : 0;
      canceledCount += step === HAUL_STEP_CANCELED ? 1 : 0;
      failedCount += step === HAUL_STEP_FAILED ? 1 : 0;
      const originStep = this.originCodes[jobId * ORIGIN_CODE_STRIDE + ORIGIN_STEP_CODE] ?? 0;
      deliveredCount +=
        this.originShadowPresent[jobId] === 1 && originStep === HAUL_STEP_DELIVERED ? 1 : 0;
      canceledCount +=
        this.originShadowPresent[jobId] === 1 && originStep === HAUL_STEP_CANCELED ? 1 : 0;
      failedCount +=
        this.originShadowPresent[jobId] === 1 && originStep === HAUL_STEP_FAILED ? 1 : 0;
    }

    return {
      version: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount,
      pickedUpCount,
      deliveredCount,
      canceledCount,
      failedCount,
      cumulativeDeliveredCount: this.cumulativeDeliveredCount,
      cumulativeCanceledCount: this.cumulativeCanceledCount,
      cumulativeFailedCount: this.cumulativeFailedCount,
    };
  }

  private prepareAutonomyTerminal(
    jobId: number,
    tick: number,
    status: "completed" | "failed" | "canceled",
    failureReason: JobFailureReason,
    jobCore: JobCoreStore,
    interruptionKind?: JobInterruptionKind,
  ): boolean {
    jobCore.prepareAutonomyTerminalInto(
      {
        jobId,
        jobGeneration: this.jobGenerations[jobId] ?? 0,
        owner: this.readOwner(jobId),
        expectedSlotVersion: this.jobSlotVersions[jobId] ?? 0,
        expectedJobCoreVersion: jobCore.version,
        tick,
        status,
        failureReason,
        effectPhase: 2,
        ...(interruptionKind === undefined ? {} : { interruptionKind }),
      },
      this.preparedTerminal,
    );
    return this.preparedTerminal.ok;
  }

  private setAutonomyCarried(
    jobId: number,
    defId: number,
    amount: number,
    tick: number,
    jobCore: JobCoreStore,
  ): boolean {
    jobCore.setAutonomyCarriedStateInto(
      jobId,
      this.jobGenerations[jobId] ?? 0,
      this.readOwner(jobId),
      this.jobSlotVersions[jobId] ?? 0,
      jobCore.version,
      defId,
      amount,
      tick,
      this.jobMutationOutput,
    );
    if (this.jobMutationOutput.ok) {
      this.jobSlotVersions[jobId] = this.jobMutationOutput.slotVersion;
    }
    return this.jobMutationOutput.ok;
  }

  private enterAutonomyStep(
    jobId: number,
    step: "path_to_source" | "interact",
    tick: number,
    jobCore: JobCoreStore,
  ): boolean {
    jobCore.enterAutonomyStepInto(
      jobId,
      this.jobGenerations[jobId] ?? 0,
      this.readOwner(jobId),
      this.jobSlotVersions[jobId] ?? 0,
      jobCore.version,
      step,
      tick,
      this.jobMutationOutput,
    );
    if (this.jobMutationOutput.ok) {
      this.jobSlotVersions[jobId] = this.jobMutationOutput.slotVersion;
    }
    return this.jobMutationOutput.ok;
  }

  private deliverLegacy(
    jobId: number,
    tick: number,
    destination: NonNullable<ReturnType<StorageLogisticsIndex["readSlot"]>>,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const amount = this.carriedAmounts[jobId] ?? 0;
    const defId = this.carriedDefIds[jobId] ?? 0;
    const added = items.addQuantity(destination.stackId, amount, defId);
    if (!added.ok) return { ok: false, reason: "hauling_item_mutation_failed" };
    const completed = jobCore.completeJob(jobId, tick, ledger);
    if (!completed.ok) {
      const removed = items.removeQuantity(destination.stackId, amount, defId);
      if (!removed.ok) throw new Error(`failed to rollback delivery quantity: ${removed.reason}`);
      return { ok: false, reason: "hauling_job_core_failed" };
    }
    this.clearCarried(jobId);
    this.stepCodes[jobId] = HAUL_STEP_DELIVERED;
    this.clearLegacyClaimAudit(jobId);
    this.cumulativeDeliveredCount += 1;
    storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
    storage.markSlotDirty(destination.slotId);
    return this.finish(jobId);
  }

  private cancelLegacy(
    jobId: number,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const returned = this.returnCarriedToSource(jobId, items, storage);
    if (!returned.ok) return returned;
    const canceled = jobCore.cancelJob(jobId, tick, ledger);
    if (!canceled.ok) {
      this.rollbackReturnedToCarried(
        jobId,
        returned.returnedAmount,
        returned.returnedDefId,
        items,
        storage,
      );
      return { ok: false, reason: "hauling_job_core_failed" };
    }
    this.clearCarried(jobId);
    this.stepCodes[jobId] = HAUL_STEP_CANCELED;
    this.clearLegacyClaimAudit(jobId);
    this.cumulativeCanceledCount += 1;
    storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
    storage.markSlotDirty(this.destinationSlotIds[jobId] ?? 0);
    return this.finish(jobId);
  }

  private failLegacy(
    jobId: number,
    tick: number,
    reason: JobFailureReason,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const returned = this.returnCarriedToSource(jobId, items, storage);
    if (!returned.ok) return returned;
    const failed = jobCore.failJob(jobId, tick, reason, ledger);
    if (!failed.ok) {
      this.rollbackReturnedToCarried(
        jobId,
        returned.returnedAmount,
        returned.returnedDefId,
        items,
        storage,
      );
      return { ok: false, reason: "hauling_job_core_failed" };
    }
    this.clearCarried(jobId);
    this.stepCodes[jobId] = HAUL_STEP_FAILED;
    this.clearLegacyClaimAudit(jobId);
    this.cumulativeFailedCount += 1;
    storage.markSlotDirty(this.sourceSlotIds[jobId] ?? 0);
    storage.markSlotDirty(this.destinationSlotIds[jobId] ?? 0);
    return this.finish(jobId);
  }

  private returnCarriedToSource(
    jobId: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
  ):
    | { readonly ok: true; readonly returnedAmount: number; readonly returnedDefId: number }
    | { readonly ok: false; readonly reason: HaulingReason } {
    if ((this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED) !== HAUL_STEP_PICKED_UP) {
      return { ok: true, returnedAmount: 0, returnedDefId: JOB_NONE };
    }

    const source = storage.readSlot(this.sourceSlotIds[jobId] ?? 0);
    if (source === undefined) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    const returnedAmount = this.carriedAmounts[jobId] ?? 0;
    const returnedDefId = this.carriedDefIds[jobId] ?? JOB_NONE;
    const returned = items.addQuantity(source.stackId, returnedAmount, returnedDefId);
    if (!returned.ok) {
      return { ok: false, reason: "hauling_item_mutation_failed" };
    }

    storage.markSlotDirty(source.slotId);
    return { ok: true, returnedAmount, returnedDefId };
  }

  private rollbackReturnedToCarried(
    jobId: number,
    returnedAmount: number,
    returnedDefId: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
  ): void {
    if (returnedAmount === 0) {
      return;
    }

    const source = storage.readSlot(this.sourceSlotIds[jobId] ?? 0);
    if (source === undefined) {
      throw new Error("failed to rollback returned haul quantity: source slot missing");
    }

    const removed = items.removeQuantity(source.stackId, returnedAmount, returnedDefId);
    if (!removed.ok) {
      throw new Error(`failed to rollback returned haul quantity: ${removed.reason}`);
    }
    storage.markSlotDirty(source.slotId);
  }

  private clearCarried(jobId: number): void {
    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
  }

  private readReservationContext(
    jobId: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
  ):
    | {
        readonly ok: true;
        readonly amount: number;
        readonly source: NonNullable<ReturnType<StorageLogisticsIndex["readSlot"]>>;
        readonly destination: NonNullable<ReturnType<StorageLogisticsIndex["readSlot"]>>;
        readonly sourceStack: NonNullable<ReturnType<ItemStackStore["readStack"]>>;
      }
    | { readonly ok: false; readonly reason: HaulingReason } {
    const validation = this.validateStep(jobId, HAUL_STEP_CREATED);
    if (!validation.ok) {
      return validation;
    }

    const amount = this.amounts[jobId] ?? 0;
    const source = storage.readSlot(this.sourceSlotIds[jobId] ?? 0);
    const destination = storage.readSlot(this.destinationSlotIds[jobId] ?? 0);
    if (source === undefined || destination === undefined) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    if (source.defId !== destination.defId) {
      return { ok: false, reason: "hauling_def_mismatch" };
    }

    const sourceStack = items.readStack(source.stackId, ledger);
    if (sourceStack === undefined || amount > sourceStack.availableQuantity) {
      return { ok: false, reason: "hauling_source_unavailable" };
    }

    if (amount > destination.availableCapacity) {
      return { ok: false, reason: "hauling_destination_unavailable" };
    }

    return { ok: true, amount, source, destination, sourceStack };
  }

  private validateCreate(
    input: HaulingJobCreateInput,
    registry: EntityRegistry,
  ): HaulingMutationResult {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "hauling_job_id_out_of_range" };
    }

    if (!registry.isAlive(input.owner)) {
      return { ok: false, reason: "hauling_owner_invalid" };
    }

    if (!isSafeUint32(input.sourceSlotId) || !isSafeUint32(input.destinationSlotId)) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    if (!isPositiveUint32(input.amount) || !isSafeTick(input.createdTick)) {
      return { ok: false, reason: "hauling_amount_invalid" };
    }

    return { ok: true, jobId: input.jobId, version: this.storeVersion };
  }

  private validateStep(jobId: number, expectedStep: number): HaulingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }

    if ((this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED) !== expectedStep) {
      return { ok: false, reason: "hauling_step_invalid" };
    }

    return { ok: true, jobId, version: this.storeVersion };
  }

  private validateActive(jobId: number): HaulingMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "hauling_job_not_active" };
    }

    return { ok: true, jobId, version: this.storeVersion };
  }

  private isActiveJob(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.active[jobId] ?? 0) === 1;
  }

  private isTerminalStep(jobId: number): boolean {
    const step = this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED;
    return step === HAUL_STEP_DELIVERED || step === HAUL_STEP_CANCELED || step === HAUL_STEP_FAILED;
  }

  private readOwner(jobId: number): EntityId {
    return {
      index: this.ownerIndexes[jobId] ?? 0,
      generation: this.ownerGenerations[jobId] ?? 0,
    };
  }

  private finish(jobId: number): HaulingMutationResult {
    if (this.storeVersion === 0xffff_ffff) {
      return { ok: false, reason: "hauling_version_exhausted" };
    }
    this.storeVersion += 1;
    return { ok: true, jobId, version: this.storeVersion };
  }

  private writeAdopted(
    control: ExistingClaimsAdoptionControl,
    input: HaulingClaimAdoptionInput,
  ): void {
    const jobId = control.jobId;
    const base = jobId * 4;
    this.active[jobId] = 1;
    this.ownerIndexes[jobId] = control.ownerIndex;
    this.ownerGenerations[jobId] = control.ownerGeneration;
    this.sourceSlotIds[jobId] = input.sourceSlotId;
    this.destinationSlotIds[jobId] = input.destinationSlotId;
    this.sourceItemIndexes[jobId] = input.sourceItem.index;
    this.sourceItemGenerations[jobId] = input.sourceItem.generation;
    this.destinationStorageIndexes[jobId] = input.destinationStorage.index;
    this.destinationStorageGenerations[jobId] = input.destinationStorage.generation;
    this.sourceInteractionSpotIds[jobId] = input.sourceInteractionSpotId;
    this.destinationInteractionSpotIds[jobId] = input.destinationInteractionSpotId;
    this.sourceStackIds[jobId] = input.sourceStackId;
    this.destinationStackIds[jobId] = input.destinationStackId;
    this.defIds[jobId] = input.defId;
    this.destinationCapacities[jobId] = input.destinationCapacity;
    this.amounts[jobId] = input.amount;
    this.createdTicks[jobId] = control.claimCreatedTick;
    this.stepEnteredTicks[jobId] = control.adoptionTick;
    this.jobGenerations[jobId] = control.jobGeneration;
    this.jobSlotVersions[jobId] = this.jobTokenOutput.slotVersion;
    this.stepCodes[jobId] = HAUL_STEP_RESERVED;
    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
    for (let index = 0; index < 4; index += 1) {
      this.claimIds[base + index] = control.claimIds[index] ?? JOB_NONE;
      this.claimEpochs[base + index] = control.claimEpochs[index] ?? 0;
      this.claimCreatedTicks[base + index] = control.claimCreatedTick;
      this.claimLeaseExpiryTicks[base + index] = control.claimLeaseExpiryTicks[index] ?? 0;
    }
    this.reservationVersions[jobId] = control.reservationReadVersion;
    this.activeCount += 1;
    this.effectPhases[jobId] = 0;
    this.pickupOnce[jobId] = 0;
    this.lastEffectTicks[jobId] = control.adoptionTick;
    this.pendingTerminalOutcomes[jobId] = 0;
    this.pendingTerminalFailures[jobId] = 0;
    this.pendingInterruptionKinds[jobId] = 0;
  }

  private matchesReservedDriverOrigin(jobId: number): boolean {
    if (!this.jobTokenOutput.originShadowPresent) return this.isCanonicalUnassignedRow(jobId);
    const expectedOutcome =
      this.jobTokenOutput.originStatus === "completed"
        ? 1
        : this.jobTokenOutput.originStatus === "canceled"
          ? 2
          : this.jobTokenOutput.originStatus === "failed"
            ? 3
            : 0;
    const base = jobId * 4;
    if (
      this.jobTokenOutput.originState !== "tombstone" ||
      expectedOutcome === 0 ||
      this.jobTokenOutput.originJobKind !== HAULING_JOB_KIND ||
      this.jobTokenOutput.originEffectPhase !== 3 ||
      this.active[jobId] !== 0 ||
      this.effectPhases[jobId] !== 3 ||
      this.jobGenerations[jobId] !== this.jobTokenOutput.originJobGeneration ||
      this.ownerIndexes[jobId] !== this.jobTokenOutput.originOwnerIndex ||
      this.ownerGenerations[jobId] !== this.jobTokenOutput.originOwnerGeneration ||
      this.destinationSlotIds[jobId] !== this.jobTokenOutput.originTargetId ||
      this.createdTicks[jobId] !== this.jobTokenOutput.originCreatedTick ||
      this.stepEnteredTicks[jobId] !== this.jobTokenOutput.originTerminalTick ||
      this.stepCodes[jobId] !== terminalStepForStoredOutcome(expectedOutcome) ||
      this.pendingTerminalOutcomes[jobId] !== expectedOutcome ||
      this.pendingTerminalFailures[jobId] !==
        encodeFailureReason(this.jobTokenOutput.originFailureReason) ||
      this.carriedDefIds[jobId] !== JOB_NONE ||
      this.carriedAmounts[jobId] !== 0 ||
      (this.lastEffectTicks[jobId] ?? 0) > (this.stepEnteredTicks[jobId] ?? 0) ||
      (expectedOutcome === 1 && this.pickupOnce[jobId] !== 1)
    )
      return false;
    for (let index = 0; index < 4; index += 1) {
      if (
        this.claimIds[base + index] !== JOB_NONE ||
        this.claimEpochs[base + index] !== 0 ||
        this.claimCreatedTicks[base + index] !== 0 ||
        this.claimLeaseExpiryTicks[base + index] !== 0
      )
        return false;
    }
    return true;
  }

  private isCanonicalUnassignedRow(jobId: number): boolean {
    const base = jobId * 4;
    if (
      this.active[jobId] !== 0 ||
      this.ownerIndexes[jobId] !== 0 ||
      this.ownerGenerations[jobId] !== 0 ||
      this.sourceSlotIds[jobId] !== 0 ||
      this.destinationSlotIds[jobId] !== 0 ||
      this.sourceItemIndexes[jobId] !== 0 ||
      this.sourceItemGenerations[jobId] !== 0 ||
      this.destinationStorageIndexes[jobId] !== 0 ||
      this.destinationStorageGenerations[jobId] !== 0 ||
      this.sourceInteractionSpotIds[jobId] !== 0 ||
      this.destinationInteractionSpotIds[jobId] !== 0 ||
      this.sourceStackIds[jobId] !== 0 ||
      this.destinationStackIds[jobId] !== 0 ||
      this.defIds[jobId] !== 0 ||
      this.destinationCapacities[jobId] !== 0 ||
      this.amounts[jobId] !== 0 ||
      this.createdTicks[jobId] !== 0 ||
      this.stepEnteredTicks[jobId] !== 0 ||
      this.jobGenerations[jobId] !== 0 ||
      this.reservationVersions[jobId] !== 0 ||
      this.effectPhases[jobId] !== 0 ||
      this.stepCodes[jobId] !== HAUL_STEP_UNASSIGNED ||
      this.carriedDefIds[jobId] !== JOB_NONE ||
      this.carriedAmounts[jobId] !== 0 ||
      this.pickupOnce[jobId] !== 0 ||
      this.lastEffectTicks[jobId] !== 0 ||
      this.pendingTerminalOutcomes[jobId] !== 0 ||
      this.pendingTerminalFailures[jobId] !== 0 ||
      this.pendingInterruptionKinds[jobId] !== 0 ||
      this.originShadowPresent[jobId] !== 0
    )
      return false;
    for (let index = 0; index < 4; index += 1) {
      if (
        this.claimIds[base + index] !== JOB_NONE ||
        this.claimEpochs[base + index] !== 0 ||
        this.claimCreatedTicks[base + index] !== 0 ||
        this.claimLeaseExpiryTicks[base + index] !== 0
      )
        return false;
    }
    return true;
  }

  private captureTerminalOrigin(jobId: number): void {
    const u32 = jobId * ORIGIN_U32_STRIDE;
    const tick = jobId * ORIGIN_TICK_STRIDE;
    const code = jobId * ORIGIN_CODE_STRIDE;
    this.originShadowPresent[jobId] = 1;
    this.originU32[u32 + ORIGIN_OWNER_INDEX] = this.ownerIndexes[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_OWNER_GENERATION] = this.ownerGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_SOURCE_SLOT_ID] = this.sourceSlotIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_DESTINATION_SLOT_ID] = this.destinationSlotIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_SOURCE_ITEM_INDEX] = this.sourceItemIndexes[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_SOURCE_ITEM_GENERATION] = this.sourceItemGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_DESTINATION_STORAGE_INDEX] =
      this.destinationStorageIndexes[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_DESTINATION_STORAGE_GENERATION] =
      this.destinationStorageGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_SOURCE_INTERACTION_SPOT_ID] =
      this.sourceInteractionSpotIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_DESTINATION_INTERACTION_SPOT_ID] =
      this.destinationInteractionSpotIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_SOURCE_STACK_ID] = this.sourceStackIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_DESTINATION_STACK_ID] = this.destinationStackIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_DEF_ID] = this.defIds[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_DESTINATION_CAPACITY] = this.destinationCapacities[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_AMOUNT] = this.amounts[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_JOB_GENERATION] = this.jobGenerations[jobId] ?? 0;
    this.originU32[u32 + ORIGIN_RESERVATION_VERSION] = this.reservationVersions[jobId] ?? 0;
    this.originTicks[tick + ORIGIN_CREATED_TICK] = this.createdTicks[jobId] ?? 0;
    this.originTicks[tick + ORIGIN_STEP_ENTERED_TICK] = this.stepEnteredTicks[jobId] ?? 0;
    this.originTicks[tick + ORIGIN_LAST_EFFECT_TICK] = this.lastEffectTicks[jobId] ?? 0;
    this.originCodes[code + ORIGIN_STEP_CODE] = this.stepCodes[jobId] ?? 0;
    this.originCodes[code + ORIGIN_PICKUP_ONCE] = this.pickupOnce[jobId] ?? 0;
    this.originCodes[code + ORIGIN_PENDING_OUTCOME] = this.pendingTerminalOutcomes[jobId] ?? 0;
    this.originCodes[code + ORIGIN_PENDING_FAILURE] = this.pendingTerminalFailures[jobId] ?? 0;
    this.originCodes[code + ORIGIN_PENDING_INTERRUPTION] =
      this.pendingInterruptionKinds[jobId] ?? 0;
  }

  private restoreTerminalOrigin(jobId: number, slotVersion: number): void {
    const u32 = jobId * ORIGIN_U32_STRIDE;
    const tick = jobId * ORIGIN_TICK_STRIDE;
    const code = jobId * ORIGIN_CODE_STRIDE;
    this.active[jobId] = 0;
    this.ownerIndexes[jobId] = this.originU32[u32 + ORIGIN_OWNER_INDEX] ?? 0;
    this.ownerGenerations[jobId] = this.originU32[u32 + ORIGIN_OWNER_GENERATION] ?? 0;
    this.sourceSlotIds[jobId] = this.originU32[u32 + ORIGIN_SOURCE_SLOT_ID] ?? 0;
    this.destinationSlotIds[jobId] = this.originU32[u32 + ORIGIN_DESTINATION_SLOT_ID] ?? 0;
    this.sourceItemIndexes[jobId] = this.originU32[u32 + ORIGIN_SOURCE_ITEM_INDEX] ?? 0;
    this.sourceItemGenerations[jobId] = this.originU32[u32 + ORIGIN_SOURCE_ITEM_GENERATION] ?? 0;
    this.destinationStorageIndexes[jobId] =
      this.originU32[u32 + ORIGIN_DESTINATION_STORAGE_INDEX] ?? 0;
    this.destinationStorageGenerations[jobId] =
      this.originU32[u32 + ORIGIN_DESTINATION_STORAGE_GENERATION] ?? 0;
    this.sourceInteractionSpotIds[jobId] =
      this.originU32[u32 + ORIGIN_SOURCE_INTERACTION_SPOT_ID] ?? 0;
    this.destinationInteractionSpotIds[jobId] =
      this.originU32[u32 + ORIGIN_DESTINATION_INTERACTION_SPOT_ID] ?? 0;
    this.sourceStackIds[jobId] = this.originU32[u32 + ORIGIN_SOURCE_STACK_ID] ?? 0;
    this.destinationStackIds[jobId] = this.originU32[u32 + ORIGIN_DESTINATION_STACK_ID] ?? 0;
    this.defIds[jobId] = this.originU32[u32 + ORIGIN_DEF_ID] ?? 0;
    this.destinationCapacities[jobId] = this.originU32[u32 + ORIGIN_DESTINATION_CAPACITY] ?? 0;
    this.amounts[jobId] = this.originU32[u32 + ORIGIN_AMOUNT] ?? 0;
    this.jobGenerations[jobId] = this.originU32[u32 + ORIGIN_JOB_GENERATION] ?? 0;
    this.reservationVersions[jobId] = this.originU32[u32 + ORIGIN_RESERVATION_VERSION] ?? 0;
    this.createdTicks[jobId] = this.originTicks[tick + ORIGIN_CREATED_TICK] ?? 0;
    this.stepEnteredTicks[jobId] = this.originTicks[tick + ORIGIN_STEP_ENTERED_TICK] ?? 0;
    this.lastEffectTicks[jobId] = this.originTicks[tick + ORIGIN_LAST_EFFECT_TICK] ?? 0;
    this.stepCodes[jobId] = this.originCodes[code + ORIGIN_STEP_CODE] ?? 0;
    this.pickupOnce[jobId] = this.originCodes[code + ORIGIN_PICKUP_ONCE] ?? 0;
    this.pendingTerminalOutcomes[jobId] = this.originCodes[code + ORIGIN_PENDING_OUTCOME] ?? 0;
    this.pendingTerminalFailures[jobId] = this.originCodes[code + ORIGIN_PENDING_FAILURE] ?? 0;
    this.pendingInterruptionKinds[jobId] =
      this.originCodes[code + ORIGIN_PENDING_INTERRUPTION] ?? 0;
    this.jobSlotVersions[jobId] = slotVersion;
    this.effectPhases[jobId] = 3;
    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
    const claimBase = jobId * 4;
    for (let index = 0; index < 4; index += 1) {
      this.claimIds[claimBase + index] = JOB_NONE;
      this.claimEpochs[claimBase + index] = 0;
      this.claimCreatedTicks[claimBase + index] = 0;
      this.claimLeaseExpiryTicks[claimBase + index] = 0;
    }
    this.clearOriginShadow(jobId);
  }

  private clearOriginShadow(jobId: number): void {
    const u32 = jobId * ORIGIN_U32_STRIDE;
    const tick = jobId * ORIGIN_TICK_STRIDE;
    const code = jobId * ORIGIN_CODE_STRIDE;
    this.originShadowPresent[jobId] = 0;
    for (let index = 0; index < ORIGIN_U32_STRIDE; index += 1) this.originU32[u32 + index] = 0;
    for (let index = 0; index < ORIGIN_TICK_STRIDE; index += 1) this.originTicks[tick + index] = 0;
    for (let index = 0; index < ORIGIN_CODE_STRIDE; index += 1) this.originCodes[code + index] = 0;
  }

  private clearLegacyClaimAudit(jobId: number): void {
    const base = jobId * 4;
    for (let index = 0; index < 4; index += 1) {
      this.claimIds[base + index] = JOB_NONE;
      this.claimEpochs[base + index] = 0;
      this.claimCreatedTicks[base + index] = 0;
      this.claimLeaseExpiryTicks[base + index] = 0;
    }
    this.reservationVersions[jobId] = 0;
  }

  private clearRolledBackRow(jobId: number, slotVersion: number): void {
    const base = jobId * 4;
    this.active[jobId] = 0;
    this.ownerIndexes[jobId] = 0;
    this.ownerGenerations[jobId] = 0;
    this.sourceSlotIds[jobId] = 0;
    this.destinationSlotIds[jobId] = 0;
    this.sourceItemIndexes[jobId] = 0;
    this.sourceItemGenerations[jobId] = 0;
    this.destinationStorageIndexes[jobId] = 0;
    this.destinationStorageGenerations[jobId] = 0;
    this.sourceInteractionSpotIds[jobId] = 0;
    this.destinationInteractionSpotIds[jobId] = 0;
    this.sourceStackIds[jobId] = 0;
    this.destinationStackIds[jobId] = 0;
    this.defIds[jobId] = 0;
    this.destinationCapacities[jobId] = 0;
    this.amounts[jobId] = 0;
    this.createdTicks[jobId] = 0;
    this.stepEnteredTicks[jobId] = 0;
    this.jobGenerations[jobId] = 0;
    this.jobSlotVersions[jobId] = slotVersion;
    for (let index = 0; index < 4; index += 1) {
      this.claimIds[base + index] = JOB_NONE;
      this.claimEpochs[base + index] = 0;
      this.claimCreatedTicks[base + index] = 0;
      this.claimLeaseExpiryTicks[base + index] = 0;
    }
    this.reservationVersions[jobId] = 0;
    this.effectPhases[jobId] = 0;
    this.stepCodes[jobId] = HAUL_STEP_UNASSIGNED;
    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
    this.pickupOnce[jobId] = 0;
    this.lastEffectTicks[jobId] = 0;
    this.pendingTerminalOutcomes[jobId] = 0;
    this.pendingTerminalFailures[jobId] = 0;
    this.pendingInterruptionKinds[jobId] = 0;
    this.clearOriginShadow(jobId);
  }

  private writeHaulingAdoptionSuccess(output: HaulingClaimAdoptionOutput): void {
    writeAdoptionSuccess(this.jobTokenOutput, this.storeVersion, this.activeCount, output);
    output.ownerIndex = this.jobTokenOutput.ownerIndex;
    output.ownerGeneration = this.jobTokenOutput.ownerGeneration;
    output.jobCoreReservedCount = this.jobTokenOutput.reservedCount;
    output.jobCoreActiveCount = this.jobTokenOutput.activeCount;
    output.jobCoreRunningCount = this.jobTokenOutput.runningCount;
    output.jobCoreCurrentTombstoneCount = this.jobTokenOutput.currentTombstoneCount;
    output.jobCoreCumulativeTerminalCount = this.jobTokenOutput.cumulativeTerminalCount;
    this.writeHaulingAdoptionMetrics(output);
  }

  private writeHaulingAdoptionMetrics(output: HaulingClaimAdoptionOutput): void {
    output.driverReservedCount = 0;
    output.driverPickedUpCount = 0;
    output.driverDeliveredCount = 0;
    output.driverCanceledCount = 0;
    output.driverFailedCount = 0;
    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      const step = this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED;
      if (this.active[jobId] === 1) {
        output.driverReservedCount += step === HAUL_STEP_RESERVED ? 1 : 0;
        output.driverPickedUpCount += step === HAUL_STEP_PICKED_UP ? 1 : 0;
      }
      output.driverDeliveredCount += step === HAUL_STEP_DELIVERED ? 1 : 0;
      output.driverCanceledCount += step === HAUL_STEP_CANCELED ? 1 : 0;
      output.driverFailedCount += step === HAUL_STEP_FAILED ? 1 : 0;
      const originStep = this.originCodes[jobId * ORIGIN_CODE_STRIDE + ORIGIN_STEP_CODE] ?? 0;
      output.driverDeliveredCount +=
        this.originShadowPresent[jobId] === 1 && originStep === HAUL_STEP_DELIVERED ? 1 : 0;
      output.driverCanceledCount +=
        this.originShadowPresent[jobId] === 1 && originStep === HAUL_STEP_CANCELED ? 1 : 0;
      output.driverFailedCount +=
        this.originShadowPresent[jobId] === 1 && originStep === HAUL_STEP_FAILED ? 1 : 0;
    }
    output.cumulativeDeliveredCount = this.cumulativeDeliveredCount;
    output.cumulativeCanceledCount = this.cumulativeCanceledCount;
    output.cumulativeFailedCount = this.cumulativeFailedCount;
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
      jobId * 4,
      4,
      this.releaseOwnerScratch,
      jobId,
      generation,
      expectedLedgerVersion,
      this.releaseIds,
      this.releaseEpochs,
      this.releaseOutput,
    );
    return this.releaseOutput.ok;
  }
}

export function createHaulingJobStore(capacity: number): HaulingJobStore {
  return new HaulingJobStore(capacity);
}

export function restoreHaulingJobStore(snapshot: HaulingJobSnapshotInput): HaulingJobStore {
  const store = createHaulingJobStore(snapshot.capacity);
  const restored = store.restoreFromSnapshot(snapshot);
  if (!restored.ok) throw new Error(restored.reason);
  return store;
}

export function createHaulingJobHashFields(
  snapshot: HaulingJobSnapshotInput,
  prefix = "hauling",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.storeVersion`, value: snapshot.storeVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
    { name: `${prefix}.cumulativeDeliveredCount`, value: snapshot.cumulativeDeliveredCount },
    { name: `${prefix}.cumulativeCanceledCount`, value: snapshot.cumulativeCanceledCount },
    { name: `${prefix}.cumulativeFailedCount`, value: snapshot.cumulativeFailedCount },
  ];
  for (let jobId = 0; jobId < snapshot.rows.length; jobId += 1) {
    const row = snapshot.rows[jobId];
    if (row === undefined) continue;
    const rowPrefix = `${prefix}.row.${String(jobId)}`;
    const values = [
      row.jobId,
      row.active,
      row.ownerIndex,
      row.ownerGeneration,
      row.sourceSlotId,
      row.destinationSlotId,
      row.sourceItemIndex,
      row.sourceItemGeneration,
      row.destinationStorageIndex,
      row.destinationStorageGeneration,
      row.sourceInteractionSpotId,
      row.destinationInteractionSpotId,
      row.sourceStackId,
      row.destinationStackId,
      row.defId,
      row.destinationCapacity,
      row.amount,
      row.createdTick,
      row.stepEnteredTick,
      row.jobGeneration,
      row.jobSlotVersion,
      row.reservationVersion,
      row.effectPhase,
      row.stepCode,
      row.carriedDefId,
      row.carriedAmount,
      row.pickupOnce,
      row.lastEffectTick,
      row.pendingTerminalOutcome,
      row.pendingTerminalFailure,
      row.pendingInterruptionKind,
      row.originShadowPresent,
      row.originOwnerIndex,
      row.originOwnerGeneration,
      row.originSourceSlotId,
      row.originDestinationSlotId,
      row.originSourceItemIndex,
      row.originSourceItemGeneration,
      row.originDestinationStorageIndex,
      row.originDestinationStorageGeneration,
      row.originSourceInteractionSpotId,
      row.originDestinationInteractionSpotId,
      row.originSourceStackId,
      row.originDestinationStackId,
      row.originDefId,
      row.originDestinationCapacity,
      row.originAmount,
      row.originCreatedTick,
      row.originStepEnteredTick,
      row.originJobGeneration,
      row.originReservationVersion,
      row.originStepCode,
      row.originPickupOnce,
      row.originLastEffectTick,
      row.originPendingTerminalOutcome,
      row.originPendingTerminalFailure,
      row.originPendingInterruptionKind,
    ];
    const names = [
      "jobId",
      "active",
      "ownerIndex",
      "ownerGeneration",
      "sourceSlotId",
      "destinationSlotId",
      "sourceItemIndex",
      "sourceItemGeneration",
      "destinationStorageIndex",
      "destinationStorageGeneration",
      "sourceInteractionSpotId",
      "destinationInteractionSpotId",
      "sourceStackId",
      "destinationStackId",
      "defId",
      "destinationCapacity",
      "amount",
      "createdTick",
      "stepEnteredTick",
      "jobGeneration",
      "jobSlotVersion",
      "reservationVersion",
      "effectPhase",
      "stepCode",
      "carriedDefId",
      "carriedAmount",
      "pickupOnce",
      "lastEffectTick",
      "pendingTerminalOutcome",
      "pendingTerminalFailure",
      "pendingInterruptionKind",
      "originShadowPresent",
      "originOwnerIndex",
      "originOwnerGeneration",
      "originSourceSlotId",
      "originDestinationSlotId",
      "originSourceItemIndex",
      "originSourceItemGeneration",
      "originDestinationStorageIndex",
      "originDestinationStorageGeneration",
      "originSourceInteractionSpotId",
      "originDestinationInteractionSpotId",
      "originSourceStackId",
      "originDestinationStackId",
      "originDefId",
      "originDestinationCapacity",
      "originAmount",
      "originCreatedTick",
      "originStepEnteredTick",
      "originJobGeneration",
      "originReservationVersion",
      "originStepCode",
      "originPickupOnce",
      "originLastEffectTick",
      "originPendingTerminalOutcome",
      "originPendingTerminalFailure",
      "originPendingInterruptionKind",
    ];
    for (let index = 0; index < names.length; index += 1) {
      fields.push({ name: `${rowPrefix}.${names[index] ?? "unknown"}`, value: values[index] ?? 0 });
    }
    for (let index = 0; index < 4; index += 1) {
      fields.push({
        name: `${rowPrefix}.claimId.${String(index)}`,
        value: row.claimIds[index] ?? JOB_NONE,
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
  }
  return fields;
}

function decodeStep(code: number): HaulingStep {
  if (code === HAUL_STEP_CREATED) {
    return "created";
  }
  if (code === HAUL_STEP_RESERVED) {
    return "reserved";
  }
  if (code === HAUL_STEP_PICKED_UP) {
    return "picked_up";
  }
  if (code === HAUL_STEP_DELIVERED) {
    return "delivered";
  }
  if (code === HAUL_STEP_CANCELED) {
    return "canceled";
  }
  if (code === HAUL_STEP_FAILED) {
    return "failed";
  }
  return "unassigned";
}

function decodeTerminalOutcome(code: number): HaulingAdoptedTerminalOutcome | undefined {
  if (code === 1) return "delivered";
  if (code === 2) return "canceled";
  if (code === 3) return "failed";
  return undefined;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isSafeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isSafeTick(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function matchesTarget(
  claims: ReservationClaimsIntoOutput,
  index: number,
  target: EntityId,
): boolean {
  return (
    claims.targetIndexes[index] === target.index &&
    claims.targetGenerations[index] === target.generation
  );
}

function matchesReadClaimPrefix(
  control: ExistingClaimsAdoptionControl,
  readIds: Uint32Array,
  readEpochs: Uint32Array,
  claims: ReservationClaimsIntoOutput,
  count: number,
): boolean {
  if (readIds.length !== 8 || readEpochs.length !== 8) return false;
  for (let index = 0; index < count; index += 1) {
    if (
      (readIds[index] ?? JOB_NONE) !== (control.claimIds[index] ?? JOB_NONE) ||
      (readEpochs[index] ?? 0) !== (control.claimEpochs[index] ?? 0) ||
      (readEpochs[index] ?? 0) !== (claims.allocationEpochs[index] ?? 0)
    )
      return false;
  }
  for (let index = count; index < 8; index += 1) {
    if ((readIds[index] ?? 0) !== JOB_NONE || (readEpochs[index] ?? 0) !== 0) return false;
  }
  return true;
}

function isExactHaulingAdoptionPreflight(
  control: ExistingClaimsAdoptionControl,
  input: HaulingClaimAdoptionInput,
  capacity: number,
): boolean {
  const claims = input.claims;
  if (
    !isIndexInRange(control.jobId, capacity) ||
    input.jobId !== control.jobId ||
    !isPositiveUint32(control.jobGeneration) ||
    !isSafeUint32(control.ownerIndex) ||
    !isPositiveUint32(control.ownerGeneration) ||
    !isSafeUint32(control.expectedJobSlotVersion) ||
    !isSafeUint32(control.expectedJobCoreVersion) ||
    !isSafeUint32(control.expectedDriverVersion) ||
    !isSafeUint32(control.reservationReadVersion) ||
    !isSafeTick(control.claimCreatedTick) ||
    !isSafeTick(control.adoptionTick) ||
    control.adoptionTick < control.claimCreatedTick ||
    input.createdTick !== control.claimCreatedTick ||
    input.owner.index !== control.ownerIndex ||
    input.owner.generation !== control.ownerGeneration ||
    !isSafeUint32(input.sourceSlotId) ||
    input.sourceSlotId === JOB_NONE ||
    !isSafeUint32(input.destinationSlotId) ||
    input.destinationSlotId === JOB_NONE ||
    input.sourceSlotId === input.destinationSlotId ||
    !isPositiveUint32(input.amount) ||
    !isSafeUint32(input.destinationCapacity) ||
    input.destinationCapacity < input.amount ||
    input.sourceStackId === JOB_NONE ||
    input.destinationStackId === JOB_NONE ||
    input.defId === JOB_NONE ||
    !isSafeUint32(input.sourceItem.index) ||
    !isPositiveUint32(input.sourceItem.generation) ||
    !isSafeUint32(input.destinationStorage.index) ||
    !isPositiveUint32(input.destinationStorage.generation) ||
    !isSafeUint32(input.sourceInteractionSpotId) ||
    input.sourceInteractionSpotId === JOB_NONE ||
    !isSafeUint32(input.destinationInteractionSpotId) ||
    input.destinationInteractionSpotId === JOB_NONE ||
    control.claimCount !== 4 ||
    control.claimIds.length !== 8 ||
    control.claimEpochs.length !== 8 ||
    control.claimLeaseExpiryTicks.length !== 8 ||
    input.readClaimIds.length !== 8 ||
    input.readClaimEpochs.length !== 8 ||
    !claims.ok ||
    claims.claimCount !== 4 ||
    claims.version !== control.reservationReadVersion
  )
    return false;
  for (let index = 0; index < 4; index += 1) {
    if (
      (claims.hasTargetFlags[index] ?? 0) !== 1 ||
      (claims.cellIndexes[index] ?? JOB_NONE) !== JOB_NONE ||
      (claims.createdTicks[index] ?? -1) !== control.claimCreatedTick ||
      (claims.leaseExpiryTicks[index] ?? -1) !== control.claimLeaseExpiryTicks[index]
    )
      return false;
  }
  return (
    (claims.slotIds[0] ?? JOB_NONE) === JOB_NONE &&
    (claims.slotIds[1] ?? JOB_NONE) === input.destinationSlotId &&
    (claims.slotIds[2] ?? JOB_NONE) === input.sourceInteractionSpotId &&
    (claims.slotIds[3] ?? JOB_NONE) === input.destinationInteractionSpotId &&
    (claims.amounts[0] ?? 0) === input.amount &&
    (claims.amounts[1] ?? 0) === input.amount &&
    (claims.amounts[2] ?? 0) === 0 &&
    (claims.amounts[3] ?? 0) === 0
  );
}

function matchesHaulingResolverFacts(
  input: HaulingClaimAdoptionInput,
  reservationVersion: number,
): boolean {
  const facts = input.claimFacts;
  const basis = input.claimFactsBasis;
  if (
    !facts.ok ||
    facts.reason !== undefined ||
    facts.channelCount !== 4 ||
    facts.sourceSlotId !== input.sourceSlotId ||
    facts.destinationSlotId !== input.destinationSlotId ||
    facts.sourceStackId !== input.sourceStackId ||
    facts.destinationStackId !== input.destinationStackId ||
    facts.defId !== input.defId ||
    facts.amount !== input.amount ||
    facts.limits[1] !== input.destinationCapacity ||
    facts.sourceEntityIndex !== input.sourceItem.index ||
    facts.sourceEntityGeneration !== input.sourceItem.generation ||
    facts.destinationEntityIndex !== input.destinationStorage.index ||
    facts.destinationEntityGeneration !== input.destinationStorage.generation ||
    facts.sourceInteractionSpotId !== input.sourceInteractionSpotId ||
    facts.destinationInteractionSpotId !== input.destinationInteractionSpotId ||
    facts.reservationVersion !== reservationVersion ||
    facts.descriptor !== basis.descriptor ||
    facts.workType !== basis.workType ||
    facts.offerId !== basis.offerId ||
    facts.opaqueTargetId !== basis.opaqueTargetId ||
    facts.offerOwnerVersion !== basis.offerOwnerVersion ||
    facts.offerRowVersion !== basis.offerRowVersion ||
    facts.offerIndexVersion !== basis.offerIndexVersion ||
    facts.mappingRowVersion !== basis.mappingRowVersion ||
    facts.mappingIndexVersion !== basis.mappingIndexVersion ||
    facts.sourceRowVersion !== basis.sourceRowVersion ||
    facts.destinationRowVersion !== basis.destinationRowVersion ||
    facts.indexVersion !== basis.storageIndexVersion ||
    facts.sourceDirtyBacklog !== basis.sourceDirtyBacklog ||
    facts.destinationDirtyBacklog !== basis.destinationDirtyBacklog ||
    facts.cellIndexes[2] !== basis.sourceInteractionCellIndex ||
    facts.cellIndexes[3] !== basis.destinationInteractionCellIndex ||
    facts.itemRowVersion !== basis.itemRowVersion ||
    facts.itemStoreVersion !== basis.itemStoreVersion ||
    facts.reservationVersion !== basis.reservationVersion ||
    facts.descriptor !== HAULING_CLAIM_FACTS_DESCRIPTOR ||
    facts.workType !== HAULING_CLAIM_FACTS_WORK_TYPE ||
    facts.manifestVersion !== HAULING_CLAIM_FACTS_MANIFEST_VERSION ||
    facts.policyKind !== HAULING_CLAIM_POLICY_KIND ||
    facts.policyVersion !== HAULING_CLAIM_POLICY_VERSION ||
    facts.factCount !== 1 ||
    facts.transitionTargetSlot !== HAULING_CLAIM_TRANSITION_TARGET_SLOT ||
    facts.channelCodes.length !== 8 ||
    facts.targetIndexes.length !== 8 ||
    facts.targetGenerations.length !== 8 ||
    facts.slotIds.length !== 8 ||
    facts.amounts.length !== 8 ||
    facts.limits.length !== 8 ||
    facts.cellIndexes.length !== 8 ||
    facts.domainIds.length !== 8 ||
    facts.factCodes.length !== 8 ||
    facts.factValues.length !== 8 ||
    !isPositiveUint32(facts.sourceRowVersion) ||
    !isPositiveUint32(facts.destinationRowVersion) ||
    !isPositiveUint32(facts.indexVersion) ||
    !isPositiveUint32(facts.offerOwnerVersion) ||
    !isPositiveUint32(facts.offerRowVersion) ||
    !isPositiveUint32(facts.offerIndexVersion) ||
    !isPositiveUint32(facts.itemRowVersion) ||
    !isPositiveUint32(facts.itemStoreVersion) ||
    !isPositiveUint32(facts.mappingRowVersion) ||
    !isPositiveUint32(facts.mappingIndexVersion) ||
    (facts.channelCodes[0] ?? 0) !== RESERVATION_ITEM_QUANTITY ||
    (facts.channelCodes[1] ?? 0) !== RESERVATION_CAPACITY ||
    (facts.channelCodes[2] ?? 0) !== RESERVATION_INTERACTION_SPOT ||
    (facts.channelCodes[3] ?? 0) !== RESERVATION_INTERACTION_SPOT ||
    (facts.targetIndexes[0] ?? JOB_NONE) !== input.sourceItem.index ||
    (facts.targetIndexes[2] ?? JOB_NONE) !== input.sourceItem.index ||
    (facts.targetIndexes[1] ?? JOB_NONE) !== input.destinationStorage.index ||
    (facts.targetIndexes[3] ?? JOB_NONE) !== input.destinationStorage.index ||
    (facts.targetGenerations[0] ?? 0) !== input.sourceItem.generation ||
    (facts.targetGenerations[2] ?? 0) !== input.sourceItem.generation ||
    (facts.targetGenerations[1] ?? 0) !== input.destinationStorage.generation ||
    (facts.targetGenerations[3] ?? 0) !== input.destinationStorage.generation ||
    (facts.slotIds[0] ?? 0) !== JOB_NONE ||
    (facts.slotIds[1] ?? 0) !== input.destinationSlotId ||
    (facts.slotIds[2] ?? 0) !== input.sourceInteractionSpotId ||
    (facts.slotIds[3] ?? 0) !== input.destinationInteractionSpotId ||
    (facts.amounts[0] ?? 0) !== input.amount ||
    (facts.amounts[1] ?? 0) !== input.amount ||
    (facts.amounts[2] ?? 0) !== 0 ||
    (facts.amounts[3] ?? 0) !== 0 ||
    (facts.limits[0] ?? 0) < input.amount ||
    facts.limits[1] < input.amount ||
    (facts.cellIndexes[0] ?? 0) !== JOB_NONE ||
    (facts.cellIndexes[1] ?? 0) !== JOB_NONE ||
    facts.cellIndexes[2] === JOB_NONE ||
    facts.cellIndexes[3] === JOB_NONE ||
    basis.sourceInteractionCellIndex === JOB_NONE ||
    basis.destinationInteractionCellIndex === JOB_NONE ||
    (facts.domainIds[0] ?? JOB_NONE) !== input.sourceStackId ||
    (facts.domainIds[1] ?? JOB_NONE) !== input.destinationSlotId ||
    (facts.domainIds[2] ?? JOB_NONE) !== input.sourceSlotId ||
    (facts.domainIds[3] ?? JOB_NONE) !== input.destinationSlotId ||
    (facts.factCodes[0] ?? 0) !== HAUL_TRANSFER_AMOUNT_FACT_CODE ||
    (facts.factValues[0] ?? 0) !== (input.amount | 0)
  )
    return false;
  for (let index = 4; index < 8; index += 1) {
    if (
      (facts.channelCodes[index] ?? 0) !== 0 ||
      (facts.targetIndexes[index] ?? 0) !== JOB_NONE ||
      (facts.targetGenerations[index] ?? 0) !== JOB_NONE ||
      (facts.slotIds[index] ?? 0) !== JOB_NONE ||
      (facts.amounts[index] ?? 0) !== 0 ||
      (facts.limits[index] ?? 0) !== 0 ||
      (facts.cellIndexes[index] ?? 0) !== JOB_NONE ||
      (facts.domainIds[index] ?? 0) !== JOB_NONE ||
      (facts.factCodes[index] ?? 0) !== 0 ||
      (facts.factValues[index] ?? 0) !== 0
    )
      return false;
  }
  return true;
}

function isExactHaulingRollbackControl(
  control: NewlyAdoptedRollbackControl,
  capacity: number,
  currentJobCoreVersion: number,
): boolean {
  if (
    !isIndexInRange(control.jobId, capacity) ||
    control.claimCount !== 4 ||
    control.claimIds.length !== 8 ||
    control.claimEpochs.length !== 8 ||
    control.claimLeaseExpiryTicks.length !== 8 ||
    !isSafeUint32(control.expectedJobSlotVersion) ||
    control.expectedJobSlotVersion > 0xffff_fffd ||
    !isSafeUint32(control.expectedAdoptedJobSlotVersion) ||
    control.expectedAdoptedJobSlotVersion !== control.expectedJobSlotVersion + 1 ||
    !isSafeUint32(control.expectedJobCoreVersion) ||
    control.expectedJobCoreVersion >= 0xffff_ffff ||
    currentJobCoreVersion !== control.expectedJobCoreVersion + 1 ||
    !isSafeUint32(control.expectedDriverVersion) ||
    control.expectedDriverVersion > 0xffff_fffd ||
    control.expectedAdoptedDriverVersion !== control.expectedDriverVersion + 1 ||
    control.expectedAdoptedDriverVersion >= 0xffff_ffff
  )
    return false;
  for (let index = 0; index < 4; index += 1) {
    if (
      (control.claimIds[index] ?? JOB_NONE) === JOB_NONE ||
      !isPositiveUint32(control.claimEpochs[index] ?? 0) ||
      !isSafeTick(control.claimLeaseExpiryTicks[index] ?? -1) ||
      (control.claimLeaseExpiryTicks[index] ?? -1) < control.claimCreatedTick
    )
      return false;
  }
  for (let index = 4; index < 8; index += 1) {
    if (
      (control.claimIds[index] ?? 0) !== JOB_NONE ||
      (control.claimEpochs[index] ?? 0) !== 0 ||
      (control.claimLeaseExpiryTicks[index] ?? 0) !== 0
    )
      return false;
  }
  return true;
}

function matchesStoredClaimRows(
  claimIds: Uint32Array,
  claimEpochs: Uint32Array,
  claimCreatedTicks: Float64Array,
  claimLeaseExpiryTicks: Float64Array,
  base: number,
  claims: ReservationClaimsIntoOutput,
  count: number,
): boolean {
  for (let index = 0; index < count; index += 1) {
    if (
      (claimIds[base + index] ?? JOB_NONE) === JOB_NONE ||
      (claimEpochs[base + index] ?? 0) !== (claims.allocationEpochs[index] ?? 0) ||
      (claimCreatedTicks[base + index] ?? -1) !== (claims.createdTicks[index] ?? -2) ||
      (claimLeaseExpiryTicks[base + index] ?? -1) !== (claims.leaseExpiryTicks[index] ?? -2)
    )
      return false;
  }
  return true;
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
    reservedCount: 0,
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

function createJobMutationOutput(): AutonomyJobMutationIntoOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: JOB_NONE,
    jobGeneration: 0,
    slotVersion: 0,
    version: 0,
    progressQ16: 0,
    readyToComplete: false,
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

function resetAdoptedMutationOutput(output: HaulingAdoptedMutationOutput): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.jobSlotVersion = 0;
  output.jobCoreVersion = 0;
  output.driverVersion = 0;
  output.itemRowVersion = 0;
  output.itemStoreVersion = 0;
  output.storageRowVersion = 0;
  output.storageIndexVersion = 0;
  output.storageDirtyBacklog = 0;
  output.reservationVersion = 0;
  output.alreadyCommitted = false;
  output.cleanupPending = false;
  output.terminalOutcome = undefined;
  output.releasedClaimCount = 0;
}

function resetAdoptedJobOutput(output: HaulingAdoptedJobIntoOutput, driverVersion: number): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.jobId = JOB_NONE;
  output.jobGeneration = 0;
  output.ownerIndex = 0;
  output.ownerGeneration = 0;
  output.sourceSlotId = 0;
  output.destinationSlotId = 0;
  output.sourceItemIndex = 0;
  output.sourceItemGeneration = 0;
  output.destinationStorageIndex = 0;
  output.destinationStorageGeneration = 0;
  output.sourceInteractionSpotId = 0;
  output.destinationInteractionSpotId = 0;
  output.sourceStackId = 0;
  output.destinationStackId = 0;
  output.defId = 0;
  output.destinationCapacity = 0;
  output.claimIds.fill(JOB_NONE);
  output.claimEpochs.fill(0);
  output.claimCreatedTicks.fill(0);
  output.claimLeaseExpiryTicks.fill(0);
  output.amount = 0;
  output.createdTick = 0;
  output.stepEnteredTick = 0;
  output.step = "unassigned";
  output.carriedDefId = JOB_NONE;
  output.carriedAmount = 0;
  output.jobSlotVersion = 0;
  output.driverVersion = driverVersion;
  output.reservationVersion = 0;
  output.effectPhase = 0;
  output.pickupCommitted = false;
  output.cleanupPending = false;
  output.terminalOutcome = undefined;
  output.pendingTerminalFailure = 0;
  output.pendingInterruptionKind = 0;
  output.lastEffectTick = 0;
  output.activeCount = 0;
  output.reservedCount = 0;
  output.pickedUpCount = 0;
  output.deliveredCount = 0;
  output.canceledCount = 0;
  output.failedCount = 0;
  output.cumulativeDeliveredCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
  output.originShadowPresent = false;
  output.originOwnerIndex = 0;
  output.originOwnerGeneration = 0;
  output.originSourceSlotId = 0;
  output.originDestinationSlotId = 0;
  output.originSourceItemIndex = 0;
  output.originSourceItemGeneration = 0;
  output.originDestinationStorageIndex = 0;
  output.originDestinationStorageGeneration = 0;
  output.originSourceInteractionSpotId = 0;
  output.originDestinationInteractionSpotId = 0;
  output.originSourceStackId = 0;
  output.originDestinationStackId = 0;
  output.originDefId = 0;
  output.originDestinationCapacity = 0;
  output.originAmount = 0;
  output.originCreatedTick = 0;
  output.originStepEnteredTick = 0;
  output.originJobGeneration = 0;
  output.originReservationVersion = 0;
  output.originStep = "unassigned";
  output.originPickupCommitted = false;
  output.originLastEffectTick = 0;
  output.originTerminalOutcome = undefined;
  output.originPendingTerminalFailure = 0;
  output.originPendingInterruptionKind = 0;
}

function createPreparedStorageDirty(): PreparedStorageSlotDirty {
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

function createStorageSlotOutput(): StorageSlotIntoOutput {
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

function createItemStackOutput(): ItemStackIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    stackId: 0,
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

function matchesItemRemoval(
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
    actual.reservationVersion === reservationVersion
  );
}

function matchesItemAddition(
  actual: ItemStackIntoOutput,
  expected: ItemStackQuantityAdditionPrepareInput,
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
    actual.capacity === expected.capacity &&
    actual.rowVersion === expected.expectedRowVersion &&
    actual.storeVersion === expected.expectedStoreVersion &&
    actual.reservationVersion === expected.expectedReservationVersion &&
    actual.reservationVersion === reservationVersion
  );
}

function matchesTerminalSlot(
  actual: StorageSlotIntoOutput,
  expected: StorageSlotIntoOutput,
  item: ItemStackQuantityAdditionPrepareInput,
): boolean {
  return (
    actual.ok &&
    expected.ok &&
    actual.active &&
    expected.active &&
    actual.slotId === expected.slotId &&
    actual.stackId === item.stackId &&
    actual.stackId === expected.stackId &&
    actual.defId === item.defId &&
    actual.defId === expected.defId &&
    actual.rowVersion === expected.rowVersion &&
    actual.indexVersion === expected.indexVersion &&
    actual.dirtyBacklog === expected.dirtyBacklog &&
    actual.dirtyQueued === expected.dirtyQueued &&
    actual.dirtyHead === expected.dirtyHead &&
    actual.dirtyCapacity === expected.dirtyCapacity &&
    actual.dirtyQueueIndex === expected.dirtyQueueIndex
  );
}

function matchesDirtyBasis(
  dirty: StorageSlotDirtyPrepareInput,
  slot: StorageSlotIntoOutput,
): boolean {
  return (
    dirty.expectedRowVersion === slot.rowVersion &&
    dirty.expectedIndexVersion === slot.indexVersion &&
    dirty.expectedDirtyBacklog === slot.dirtyBacklog &&
    dirty.expectedDirtyQueued === slot.dirtyQueued &&
    dirty.expectedDirtyHead === slot.dirtyHead &&
    dirty.expectedDirtyCapacity === slot.dirtyCapacity &&
    dirty.expectedDirtyQueueIndex === slot.dirtyQueueIndex
  );
}

function matchesSourceSlot(
  actual: StorageSlotIntoOutput,
  expected: StorageSlotIntoOutput,
  removal: ItemStackQuantityRemovalPrepareInput,
): boolean {
  return (
    actual.ok &&
    expected.ok &&
    actual.active &&
    expected.active &&
    actual.slotId === expected.slotId &&
    actual.stackId === removal.stackId &&
    actual.defId === removal.defId &&
    actual.stackId === expected.stackId &&
    actual.defId === expected.defId &&
    actual.rowVersion === expected.rowVersion &&
    actual.indexVersion === expected.indexVersion &&
    actual.dirtyBacklog === expected.dirtyBacklog &&
    actual.dirtyQueued === expected.dirtyQueued
  );
}

function writeAdoptedPickupSuccess(
  input: HaulingAdoptedPickupInput,
  jobSlotVersion: number,
  jobCoreVersion: number,
  driverVersion: number,
  itemRowVersion: number,
  itemStoreVersion: number,
  storageRowVersion: number,
  storageIndexVersion: number,
  storageDirtyBacklog: number,
  reservationVersion: number,
  alreadyCommitted: boolean,
  output: HaulingAdoptedMutationOutput,
): void {
  output.ok = true;
  output.jobId = input.jobId;
  output.jobGeneration = input.jobGeneration;
  output.jobSlotVersion = jobSlotVersion;
  output.jobCoreVersion = jobCoreVersion;
  output.driverVersion = driverVersion;
  output.itemRowVersion = itemRowVersion;
  output.itemStoreVersion = itemStoreVersion;
  output.storageRowVersion = storageRowVersion;
  output.storageIndexVersion = storageIndexVersion;
  output.storageDirtyBacklog = storageDirtyBacklog;
  output.reservationVersion = reservationVersion;
  output.alreadyCommitted = alreadyCommitted;
}

function writeAdoptedTerminalSuccess(
  input: HaulingAdoptedTerminalInput | HaulingResumeCleanupInput,
  jobSlotVersion: number,
  jobCoreVersion: number,
  driverVersion: number,
  itemRowVersion: number,
  itemStoreVersion: number,
  storageRowVersion: number,
  storageIndexVersion: number,
  storageDirtyBacklog: number,
  reservationVersion: number,
  alreadyCommitted: boolean,
  cleanupPending: boolean,
  releasedClaimCount: number,
  output: HaulingAdoptedMutationOutput,
): void {
  output.ok = true;
  output.jobId = input.jobId;
  output.jobGeneration = input.jobGeneration;
  output.jobSlotVersion = jobSlotVersion;
  output.jobCoreVersion = jobCoreVersion;
  output.driverVersion = driverVersion;
  output.itemRowVersion = itemRowVersion;
  output.itemStoreVersion = itemStoreVersion;
  output.storageRowVersion = storageRowVersion;
  output.storageIndexVersion = storageIndexVersion;
  output.storageDirtyBacklog = storageDirtyBacklog;
  output.reservationVersion = reservationVersion;
  output.alreadyCommitted = alreadyCommitted;
  output.cleanupPending = cleanupPending;
  output.terminalOutcome = input.outcome;
  output.releasedClaimCount = releasedClaimCount;
}

function terminalStatus(
  outcome: HaulingAdoptedTerminalOutcome,
): "completed" | "canceled" | "failed" {
  if (outcome === "delivered") return "completed";
  return outcome;
}

function encodeTerminalStep(outcome: HaulingAdoptedTerminalOutcome): number {
  if (outcome === "delivered") return HAUL_STEP_DELIVERED;
  if (outcome === "canceled") return HAUL_STEP_CANCELED;
  return HAUL_STEP_FAILED;
}

function encodeTerminalOutcome(outcome: HaulingAdoptedTerminalOutcome): number {
  if (outcome === "delivered") return 1;
  if (outcome === "canceled") return 2;
  return 3;
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

function encodeInterruptionKind(kind: JobInterruptionKind | undefined): number {
  if (kind === "safe_point") return 1;
  if (kind === "immediate") return 2;
  if (kind === "emergency") return 3;
  return 0;
}

function isValidTerminalInput(
  input: HaulingAdoptedTerminalInput | HaulingResumeCleanupInput,
  phase: number,
  storedOutcome: number,
  storedFailure: number,
  storedInterruption: number,
): boolean {
  if (phase === 0 && input.outcome === "delivered") return false;
  const validReason =
    input.outcome === "delivered"
      ? input.failureReason === "none" && input.interruptionKind === undefined
      : input.outcome === "canceled"
        ? input.failureReason === "cancelled"
        : input.failureReason !== "none" &&
          input.failureReason !== "cancelled" &&
          input.interruptionKind === undefined;
  if (!validReason) return false;
  if (phase === 0 || phase === 1) {
    return storedOutcome === 0 && storedFailure === 0 && storedInterruption === 0;
  }
  return (
    (phase === 2 || phase === 3) &&
    storedOutcome === encodeTerminalOutcome(input.outcome) &&
    storedFailure === encodeFailureReason(input.failureReason) &&
    storedInterruption === encodeInterruptionKind(input.interruptionKind)
  );
}

const HAULING_SNAPSHOT_KEYS = [
  "snapshotVersion",
  "capacity",
  "storeVersion",
  "activeCount",
  "cumulativeDeliveredCount",
  "cumulativeCanceledCount",
  "cumulativeFailedCount",
  "rows",
] as const;
const HAULING_ROW_KEYS = [
  "jobId",
  "active",
  "ownerIndex",
  "ownerGeneration",
  "sourceSlotId",
  "destinationSlotId",
  "sourceItemIndex",
  "sourceItemGeneration",
  "destinationStorageIndex",
  "destinationStorageGeneration",
  "sourceInteractionSpotId",
  "destinationInteractionSpotId",
  "sourceStackId",
  "destinationStackId",
  "defId",
  "destinationCapacity",
  "amount",
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
  "pickupOnce",
  "lastEffectTick",
  "pendingTerminalOutcome",
  "pendingTerminalFailure",
  "pendingInterruptionKind",
  "originShadowPresent",
  "originOwnerIndex",
  "originOwnerGeneration",
  "originSourceSlotId",
  "originDestinationSlotId",
  "originSourceItemIndex",
  "originSourceItemGeneration",
  "originDestinationStorageIndex",
  "originDestinationStorageGeneration",
  "originSourceInteractionSpotId",
  "originDestinationInteractionSpotId",
  "originSourceStackId",
  "originDestinationStackId",
  "originDefId",
  "originDestinationCapacity",
  "originAmount",
  "originCreatedTick",
  "originStepEnteredTick",
  "originJobGeneration",
  "originReservationVersion",
  "originStepCode",
  "originPickupOnce",
  "originLastEffectTick",
  "originPendingTerminalOutcome",
  "originPendingTerminalFailure",
  "originPendingInterruptionKind",
] as const;

function isHaulingSnapshot(value: unknown, capacity: number): value is HaulingJobSnapshotInput {
  if (
    !isExactRecord(value, HAULING_SNAPSHOT_KEYS) ||
    value["snapshotVersion"] !== HAULING_JOB_SNAPSHOT_VERSION ||
    value["capacity"] !== capacity ||
    !isSafeUint32Unknown(value["storeVersion"]) ||
    !isSafeUint32Unknown(value["activeCount"]) ||
    !isDenseArray(value["rows"], capacity) ||
    !isSafeUint32Unknown(value["cumulativeDeliveredCount"]) ||
    !isSafeUint32Unknown(value["cumulativeCanceledCount"]) ||
    !isSafeUint32Unknown(value["cumulativeFailedCount"]) ||
    value["rows"].length !== capacity
  )
    return false;
  let activeCount = 0;
  let deliveredCount = 0;
  let canceledCount = 0;
  let failedCount = 0;
  for (let jobId = 0; jobId < capacity; jobId += 1) {
    const row = value["rows"][jobId];
    if (!isHaulingSnapshotRow(row, jobId)) return false;
    activeCount += row.active;
    if (row.effectPhase === 3) {
      deliveredCount += row.pendingTerminalOutcome === 1 ? 1 : 0;
      canceledCount += row.pendingTerminalOutcome === 2 ? 1 : 0;
      failedCount += row.pendingTerminalOutcome === 3 ? 1 : 0;
    }
    if (row.originShadowPresent === 1) {
      deliveredCount += row.originPendingTerminalOutcome === 1 ? 1 : 0;
      canceledCount += row.originPendingTerminalOutcome === 2 ? 1 : 0;
      failedCount += row.originPendingTerminalOutcome === 3 ? 1 : 0;
    }
  }
  return (
    activeCount === value["activeCount"] &&
    deliveredCount <= value["cumulativeDeliveredCount"] &&
    canceledCount <= value["cumulativeCanceledCount"] &&
    failedCount <= value["cumulativeFailedCount"]
  );
}

function isHaulingSnapshotRow(value: unknown, jobId: number): value is HaulingJobSnapshotRow {
  if (
    !isExactRecord(value, HAULING_ROW_KEYS) ||
    value["jobId"] !== jobId ||
    (value["active"] !== 0 && value["active"] !== 1) ||
    !isSafeUint32Unknown(value["ownerIndex"]) ||
    !isSafeUint32Unknown(value["ownerGeneration"]) ||
    !isSafeUint32Unknown(value["sourceSlotId"]) ||
    !isSafeUint32Unknown(value["destinationSlotId"]) ||
    !isSafeUint32Unknown(value["sourceItemIndex"]) ||
    !isSafeUint32Unknown(value["sourceItemGeneration"]) ||
    !isSafeUint32Unknown(value["destinationStorageIndex"]) ||
    !isSafeUint32Unknown(value["destinationStorageGeneration"]) ||
    !isSafeUint32Unknown(value["sourceInteractionSpotId"]) ||
    !isSafeUint32Unknown(value["destinationInteractionSpotId"]) ||
    !isSafeUint32Unknown(value["sourceStackId"]) ||
    !isSafeUint32Unknown(value["destinationStackId"]) ||
    !isSafeUint32Unknown(value["defId"]) ||
    !isSafeUint32Unknown(value["destinationCapacity"]) ||
    !isSafeUint32Unknown(value["amount"]) ||
    !isSafeTickUnknown(value["createdTick"]) ||
    !isSafeTickUnknown(value["stepEnteredTick"]) ||
    value["stepEnteredTick"] < value["createdTick"] ||
    !isSafeUint32Unknown(value["jobGeneration"]) ||
    !isSafeUint32Unknown(value["jobSlotVersion"]) ||
    !isFourUint32Array(value["claimIds"]) ||
    !isFourUint32Array(value["claimEpochs"]) ||
    !isFourTickArray(value["claimCreatedTicks"]) ||
    !isFourTickArray(value["claimLeaseExpiryTicks"]) ||
    !isSafeUint32Unknown(value["reservationVersion"]) ||
    !isSafeUint32Unknown(value["effectPhase"]) ||
    value["effectPhase"] > 3 ||
    !isSafeUint32Unknown(value["stepCode"]) ||
    value["stepCode"] > HAUL_STEP_FAILED ||
    !isSafeUint32Unknown(value["carriedDefId"]) ||
    !isSafeUint32Unknown(value["carriedAmount"]) ||
    (value["pickupOnce"] !== 0 && value["pickupOnce"] !== 1) ||
    !isSafeTickUnknown(value["lastEffectTick"]) ||
    !isSafeUint32Unknown(value["pendingTerminalOutcome"]) ||
    value["pendingTerminalOutcome"] > 3 ||
    !isSafeUint32Unknown(value["pendingTerminalFailure"]) ||
    value["pendingTerminalFailure"] > 8 ||
    !isSafeUint32Unknown(value["pendingInterruptionKind"]) ||
    value["pendingInterruptionKind"] > 3 ||
    !isValidOriginShadow(value)
  )
    return false;
  if (value["jobGeneration"] === 0) return isLegacyOrVirginHaulingRow(value);
  if (
    value["ownerGeneration"] === 0 ||
    value["sourceItemGeneration"] === 0 ||
    value["destinationStorageGeneration"] === 0 ||
    value["jobSlotVersion"] === 0 ||
    value["defId"] === JOB_NONE ||
    value["destinationCapacity"] < value["amount"] ||
    value["amount"] === 0 ||
    value["sourceSlotId"] === value["destinationSlotId"] ||
    value["reservationVersion"] === 0 ||
    value["lastEffectTick"] < value["createdTick"]
  )
    return false;
  for (let left = 0; left < 4; left += 1) {
    for (let right = left + 1; right < 4; right += 1) {
      if (value["effectPhase"] < 3 && value["claimIds"][left] === value["claimIds"][right])
        return false;
    }
  }
  if (value["effectPhase"] < 3) {
    for (let index = 0; index < 4; index += 1) {
      if (
        value["claimIds"][index] === JOB_NONE ||
        value["claimEpochs"][index] === 0 ||
        value["claimCreatedTicks"][index] !== value["createdTick"] ||
        (value["claimLeaseExpiryTicks"][index] ?? -1) < (value["claimCreatedTicks"][index] ?? 0)
      )
        return false;
    }
  }
  if (value["effectPhase"] === 0) {
    return (
      value["active"] === 1 &&
      value["stepCode"] === HAUL_STEP_RESERVED &&
      value["pickupOnce"] === 0 &&
      value["carriedDefId"] === JOB_NONE &&
      value["carriedAmount"] === 0 &&
      value["pendingTerminalOutcome"] === 0 &&
      value["pendingTerminalFailure"] === 0 &&
      value["pendingInterruptionKind"] === 0 &&
      value["lastEffectTick"] === value["stepEnteredTick"]
    );
  }
  if (value["effectPhase"] === 1) {
    return (
      value["active"] === 1 &&
      value["stepCode"] === HAUL_STEP_PICKED_UP &&
      value["pickupOnce"] === 1 &&
      value["carriedDefId"] === value["defId"] &&
      value["carriedAmount"] === value["amount"] &&
      value["pendingTerminalOutcome"] === 0 &&
      value["pendingTerminalFailure"] === 0 &&
      value["pendingInterruptionKind"] === 0 &&
      value["lastEffectTick"] === value["stepEnteredTick"]
    );
  }
  if (value["effectPhase"] === 2) {
    return (
      value["active"] === 1 &&
      value["carriedDefId"] === JOB_NONE &&
      value["carriedAmount"] === 0 &&
      value["pendingTerminalOutcome"] > 0 &&
      value["lastEffectTick"] >= value["stepEnteredTick"] &&
      isValidStoredTerminalCodes(
        value["pendingTerminalOutcome"],
        value["pendingTerminalFailure"],
        value["pendingInterruptionKind"],
      ) &&
      (value["pendingTerminalOutcome"] !== 1 || value["pickupOnce"] === 1) &&
      ((value["pickupOnce"] === 0 && value["stepCode"] === HAUL_STEP_RESERVED) ||
        (value["pickupOnce"] === 1 && value["stepCode"] === HAUL_STEP_PICKED_UP))
    );
  }
  for (let index = 0; index < 4; index += 1) {
    if (
      value["claimIds"][index] !== JOB_NONE ||
      value["claimEpochs"][index] !== 0 ||
      value["claimCreatedTicks"][index] !== 0 ||
      value["claimLeaseExpiryTicks"][index] !== 0
    )
      return false;
  }
  return (
    value["active"] === 0 &&
    value["carriedDefId"] === JOB_NONE &&
    value["carriedAmount"] === 0 &&
    isValidStoredTerminalCodes(
      value["pendingTerminalOutcome"],
      value["pendingTerminalFailure"],
      value["pendingInterruptionKind"],
    ) &&
    (value["pendingTerminalOutcome"] !== 1 || value["pickupOnce"] === 1) &&
    value["stepEnteredTick"] >= value["lastEffectTick"] &&
    value["stepCode"] === terminalStepForStoredOutcome(value["pendingTerminalOutcome"])
  );
}

function isValidOriginShadow(row: Record<string, unknown>): boolean {
  if (
    (row["originShadowPresent"] !== 0 && row["originShadowPresent"] !== 1) ||
    !isSafeUint32Unknown(row["originOwnerIndex"]) ||
    !isSafeUint32Unknown(row["originOwnerGeneration"]) ||
    !isSafeUint32Unknown(row["originSourceSlotId"]) ||
    !isSafeUint32Unknown(row["originDestinationSlotId"]) ||
    !isSafeUint32Unknown(row["originSourceItemIndex"]) ||
    !isSafeUint32Unknown(row["originSourceItemGeneration"]) ||
    !isSafeUint32Unknown(row["originDestinationStorageIndex"]) ||
    !isSafeUint32Unknown(row["originDestinationStorageGeneration"]) ||
    !isSafeUint32Unknown(row["originSourceInteractionSpotId"]) ||
    !isSafeUint32Unknown(row["originDestinationInteractionSpotId"]) ||
    !isSafeUint32Unknown(row["originSourceStackId"]) ||
    !isSafeUint32Unknown(row["originDestinationStackId"]) ||
    !isSafeUint32Unknown(row["originDefId"]) ||
    !isSafeUint32Unknown(row["originDestinationCapacity"]) ||
    !isSafeUint32Unknown(row["originAmount"]) ||
    !isSafeTickUnknown(row["originCreatedTick"]) ||
    !isSafeTickUnknown(row["originStepEnteredTick"]) ||
    !isSafeUint32Unknown(row["originJobGeneration"]) ||
    !isSafeUint32Unknown(row["originReservationVersion"]) ||
    !isSafeUint32Unknown(row["originStepCode"]) ||
    (row["originPickupOnce"] !== 0 && row["originPickupOnce"] !== 1) ||
    !isSafeTickUnknown(row["originLastEffectTick"]) ||
    !isSafeUint32Unknown(row["originPendingTerminalOutcome"]) ||
    !isSafeUint32Unknown(row["originPendingTerminalFailure"]) ||
    !isSafeUint32Unknown(row["originPendingInterruptionKind"])
  )
    return false;
  if (row["originShadowPresent"] === 0) {
    return (
      row["originOwnerIndex"] === 0 &&
      row["originOwnerGeneration"] === 0 &&
      row["originSourceSlotId"] === 0 &&
      row["originDestinationSlotId"] === 0 &&
      row["originSourceItemIndex"] === 0 &&
      row["originSourceItemGeneration"] === 0 &&
      row["originDestinationStorageIndex"] === 0 &&
      row["originDestinationStorageGeneration"] === 0 &&
      row["originSourceInteractionSpotId"] === 0 &&
      row["originDestinationInteractionSpotId"] === 0 &&
      row["originSourceStackId"] === 0 &&
      row["originDestinationStackId"] === 0 &&
      row["originDefId"] === 0 &&
      row["originDestinationCapacity"] === 0 &&
      row["originAmount"] === 0 &&
      row["originCreatedTick"] === 0 &&
      row["originStepEnteredTick"] === 0 &&
      row["originJobGeneration"] === 0 &&
      row["originReservationVersion"] === 0 &&
      row["originStepCode"] === 0 &&
      row["originPickupOnce"] === 0 &&
      row["originLastEffectTick"] === 0 &&
      row["originPendingTerminalOutcome"] === 0 &&
      row["originPendingTerminalFailure"] === 0 &&
      row["originPendingInterruptionKind"] === 0
    );
  }
  const outcome = row["originPendingTerminalOutcome"];
  return (
    row["active"] === 1 &&
    typeof row["effectPhase"] === "number" &&
    row["effectPhase"] < 3 &&
    typeof row["jobGeneration"] === "number" &&
    row["originJobGeneration"] > 0 &&
    row["originJobGeneration"] < row["jobGeneration"] &&
    row["originOwnerGeneration"] > 0 &&
    row["originSourceItemGeneration"] > 0 &&
    row["originDestinationStorageGeneration"] > 0 &&
    row["originSourceSlotId"] !== row["originDestinationSlotId"] &&
    row["originSourceStackId"] !== JOB_NONE &&
    row["originDestinationStackId"] !== JOB_NONE &&
    row["originDefId"] !== JOB_NONE &&
    row["originAmount"] > 0 &&
    row["originDestinationCapacity"] >= row["originAmount"] &&
    row["originReservationVersion"] > 0 &&
    row["originCreatedTick"] <= row["originLastEffectTick"] &&
    row["originLastEffectTick"] <= row["originStepEnteredTick"] &&
    isValidStoredTerminalCodes(
      outcome,
      row["originPendingTerminalFailure"],
      row["originPendingInterruptionKind"],
    ) &&
    row["originStepCode"] === terminalStepForStoredOutcome(outcome) &&
    (outcome !== 1 || row["originPickupOnce"] === 1)
  );
}

function isLegacyOrVirginHaulingRow(row: Record<string, unknown>): boolean {
  const claimIds = row["claimIds"];
  const claimEpochs = row["claimEpochs"];
  const claimCreatedTicks = row["claimCreatedTicks"];
  const claimLeaseExpiryTicks = row["claimLeaseExpiryTicks"];
  if (
    !isFourUint32Array(claimIds) ||
    !isFourUint32Array(claimEpochs) ||
    !isFourTickArray(claimCreatedTicks) ||
    !isFourTickArray(claimLeaseExpiryTicks) ||
    row["effectPhase"] !== 0 ||
    row["pendingTerminalOutcome"] !== 0 ||
    row["pendingTerminalFailure"] !== 0 ||
    row["pendingInterruptionKind"] !== 0
  )
    return false;
  const createdTick = row["createdTick"];
  if (typeof createdTick !== "number") return false;
  if (row["active"] === 0) {
    for (let index = 0; index < 4; index += 1) {
      if (
        claimIds[index] !== JOB_NONE ||
        claimEpochs[index] !== 0 ||
        claimCreatedTicks[index] !== 0 ||
        claimLeaseExpiryTicks[index] !== 0
      )
        return false;
    }
    return (
      row["ownerIndex"] === 0 &&
      row["ownerGeneration"] === 0 &&
      row["sourceSlotId"] === 0 &&
      row["destinationSlotId"] === 0 &&
      row["sourceItemIndex"] === 0 &&
      row["sourceItemGeneration"] === 0 &&
      row["destinationStorageIndex"] === 0 &&
      row["destinationStorageGeneration"] === 0 &&
      row["sourceInteractionSpotId"] === 0 &&
      row["destinationInteractionSpotId"] === 0 &&
      row["sourceStackId"] === 0 &&
      row["destinationStackId"] === 0 &&
      row["defId"] === 0 &&
      row["destinationCapacity"] === 0 &&
      row["amount"] === 0 &&
      row["createdTick"] === 0 &&
      row["stepEnteredTick"] === 0 &&
      row["stepCode"] === HAUL_STEP_UNASSIGNED &&
      row["carriedDefId"] === JOB_NONE &&
      row["carriedAmount"] === 0 &&
      row["pickupOnce"] === 0 &&
      row["lastEffectTick"] === 0 &&
      row["reservationVersion"] === 0
    );
  }
  const hasClaims =
    row["stepCode"] === HAUL_STEP_RESERVED || row["stepCode"] === HAUL_STEP_PICKED_UP;
  const terminal =
    row["stepCode"] === HAUL_STEP_DELIVERED ||
    row["stepCode"] === HAUL_STEP_CANCELED ||
    row["stepCode"] === HAUL_STEP_FAILED;
  for (let index = 0; index < 4; index += 1) {
    if (hasClaims) {
      if (
        claimIds[index] === JOB_NONE ||
        claimEpochs[index] === 0 ||
        (claimCreatedTicks[index] ?? -1) < createdTick ||
        (claimLeaseExpiryTicks[index] ?? -1) < (claimCreatedTicks[index] ?? 0)
      )
        return false;
    } else if (
      claimIds[index] !== JOB_NONE ||
      claimEpochs[index] !== 0 ||
      claimCreatedTicks[index] !== 0 ||
      claimLeaseExpiryTicks[index] !== 0
    )
      return false;
  }
  return (
    typeof row["ownerGeneration"] === "number" &&
    row["ownerGeneration"] > 0 &&
    typeof row["amount"] === "number" &&
    row["amount"] > 0 &&
    typeof row["stepEnteredTick"] === "number" &&
    typeof row["createdTick"] === "number" &&
    row["stepEnteredTick"] >= row["createdTick"] &&
    (row["stepCode"] === HAUL_STEP_CREATED ||
      row["stepCode"] === HAUL_STEP_RESERVED ||
      row["stepCode"] === HAUL_STEP_PICKED_UP ||
      terminal) &&
    (row["stepCode"] === HAUL_STEP_PICKED_UP
      ? row["carriedDefId"] !== JOB_NONE && row["carriedAmount"] === row["amount"]
      : row["carriedDefId"] === JOB_NONE && row["carriedAmount"] === 0) &&
    (hasClaims
      ? typeof row["reservationVersion"] === "number" && row["reservationVersion"] > 0
      : row["reservationVersion"] === 0)
  );
}

function isValidStoredTerminalCodes(
  outcome: number,
  failure: number,
  interruption: number,
): boolean {
  if (outcome === 1) return failure === 0 && interruption === 0;
  if (outcome === 2) return failure === 8 && interruption <= 3;
  return outcome === 3 && failure > 0 && failure < 8 && interruption === 0;
}

function terminalStepForStoredOutcome(outcome: number): number {
  if (outcome === 1) return HAUL_STEP_DELIVERED;
  if (outcome === 2) return HAUL_STEP_CANCELED;
  if (outcome === 3) return HAUL_STEP_FAILED;
  return HAUL_STEP_UNASSIGNED;
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
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

function isDenseArray(value: unknown, length: number): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length !== length) return false;
  for (let index = 0; index < length; index += 1) if (!(index in value)) return false;
  return true;
}

function isSuccessfulJobTokenOutput(output: JobTokenIntoOutput): boolean {
  return output.ok;
}

function isFourUint32Array(value: unknown): value is readonly number[] {
  if (!Array.isArray(value) || value.length !== 4 || !isDenseArray(value, 4)) return false;
  for (let index = 0; index < 4; index += 1) {
    if (!isSafeUint32Unknown(value[index])) return false;
  }
  return true;
}

function isFourTickArray(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    isDenseArray(value, 4) &&
    isSafeTickUnknown(value[0]) &&
    isSafeTickUnknown(value[1]) &&
    isSafeTickUnknown(value[2]) &&
    isSafeTickUnknown(value[3])
  );
}

function isSafeUint32Unknown(value: unknown): value is number {
  return typeof value === "number" && isSafeUint32(value);
}

function isSafeTickUnknown(value: unknown): value is number {
  return typeof value === "number" && isSafeTick(value);
}

function copyStoredClaimPrefix(
  storedIds: Uint32Array,
  storedEpochs: Uint32Array,
  base: number,
  count: number,
  outputIds: Uint32Array,
  outputEpochs: Uint32Array,
): void {
  for (let index = 0; index < 8; index += 1) {
    outputIds[index] = index < count ? (storedIds[base + index] ?? JOB_NONE) : JOB_NONE;
    outputEpochs[index] = index < count ? (storedEpochs[base + index] ?? 0) : 0;
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

function resetHaulingAdoptionOutput(output: HaulingClaimAdoptionOutput): void {
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
  output.driverDeliveredCount = 0;
  output.driverCanceledCount = 0;
  output.driverFailedCount = 0;
  output.cumulativeDeliveredCount = 0;
  output.cumulativeCanceledCount = 0;
  output.cumulativeFailedCount = 0;
}

function sameClaims(
  ids: Uint32Array,
  epochs: Uint32Array,
  createdTicks: Float64Array,
  leaseExpiryTicks: Float64Array,
  jobId: number,
  count: number,
  control: ExistingClaimsAdoptionControl,
): boolean {
  const base = jobId * count;
  for (let index = 0; index < count; index += 1) {
    if (
      ids[base + index] !== control.claimIds[index] ||
      epochs[base + index] !== control.claimEpochs[index] ||
      createdTicks[base + index] !== control.claimCreatedTick ||
      leaseExpiryTicks[base + index] !== control.claimLeaseExpiryTicks[index]
    )
      return false;
  }
  return true;
}
