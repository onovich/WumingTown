import type { ItemStackIntoOutput, ItemStackReadScratch, ItemStackStore } from "./item-stack-store";
import type { M3FoodAvailabilityStore, M3FoodPortionIntoOutput } from "./m3-food";
import {
  RESERVATION_CAPACITY,
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  type ReservationLedger,
  type ReservationClaimsIntoOutput,
  type ReservationReleaseIntoOutput,
} from "./reservation-ledger";
import type { StorageLogisticsIndex, StorageSlotIntoOutput } from "./storage-logistics-index";
import type { WorkOfferIndex, WorkOfferReadIntoOutput } from "./work-offers";
import type { CanonicalWorldField } from "./world-hash";
import type { EntityId } from "./entity-id";

export const HAULING_CLAIM_FACTS_DESCRIPTOR = 1;
export const HAULING_CLAIM_FACTS_WORK_TYPE = 0;
export const HAULING_CLAIM_FACTS_MANIFEST_VERSION = 1;
export const HAULING_CLAIM_POLICY_KIND = 1;
export const HAULING_CLAIM_POLICY_VERSION = 1;
export const HAUL_TRANSFER_AMOUNT_FACT_CODE = 1;
export const HAULING_CLAIM_TRANSITION_TARGET_SLOT = 2;
export const HAULING_CLAIM_FACTS_SNAPSHOT_VERSION = 1;
const HAULING_CLAIM_NONE = 0xffff_ffff;

export type FoodClaimFactsReason =
  | "food_claim_stack_unavailable"
  | "food_claim_portion_unavailable"
  | "food_claim_basis_stale";

export interface FoodClaimFactsIntoOutput {
  ok: boolean;
  reason: FoodClaimFactsReason | undefined;
  stackId: number;
  itemEntityIndex: number;
  itemEntityGeneration: number;
  foodDefId: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  capacity: number;
  hungerRestore: number;
  storageSlotId: number;
  targetCellIndex: number;
  interactionSpotId: number;
  itemRowVersion: number;
  itemStoreVersion: number;
  foodAvailabilityVersion: number;
  reservationVersion: number;
}

export interface FoodClaimFactsScratch {
  readonly item: ItemStackIntoOutput;
  readonly itemRead: ItemStackReadScratch;
  readonly portion: M3FoodPortionIntoOutput;
}

export function readFoodClaimFactsInto(
  stackId: number,
  expectedFoodAvailabilityVersion: number,
  items: ItemStackStore,
  food: M3FoodAvailabilityStore,
  ledger: ReservationLedger,
  scratch: FoodClaimFactsScratch,
  output: FoodClaimFactsIntoOutput,
): void {
  resetFoodClaimFacts(stackId, output);
  items.readStackInto(stackId, ledger, scratch.itemRead, scratch.item);
  food.readPortionInto(stackId, scratch.portion);
  if (!scratch.item.ok) {
    output.reason = "food_claim_stack_unavailable";
    return;
  }
  if (!scratch.portion.ok || !scratch.portion.active) {
    output.reason = "food_claim_portion_unavailable";
    return;
  }
  if (
    scratch.portion.foodAvailabilityVersion !== expectedFoodAvailabilityVersion ||
    scratch.portion.itemStoreVersion !== scratch.item.storeVersion ||
    scratch.portion.availableAmount !== scratch.item.availableQuantity
  ) {
    output.reason = "food_claim_basis_stale";
    return;
  }
  output.ok = true;
  output.itemEntityIndex = scratch.item.entityIndex;
  output.itemEntityGeneration = scratch.item.entityGeneration;
  output.foodDefId = scratch.portion.foodDefId;
  output.quantity = scratch.item.quantity;
  output.reservedQuantity = scratch.item.reservedQuantity;
  output.availableQuantity = scratch.item.availableQuantity;
  output.capacity = scratch.item.capacity;
  output.hungerRestore = scratch.portion.hungerRestore;
  output.storageSlotId = scratch.portion.storageSlotId;
  output.targetCellIndex = scratch.portion.targetCellIndex;
  output.interactionSpotId = scratch.portion.interactionSpotId;
  output.itemRowVersion = scratch.item.rowVersion;
  output.itemStoreVersion = scratch.item.storeVersion;
  output.foodAvailabilityVersion = scratch.portion.foodAvailabilityVersion;
  output.reservationVersion = scratch.item.reservationVersion;
}

function resetFoodClaimFacts(stackId: number, output: FoodClaimFactsIntoOutput): void {
  output.ok = false;
  output.reason = undefined;
  output.stackId = stackId;
  output.itemEntityIndex = 0;
  output.itemEntityGeneration = 0;
  output.foodDefId = 0;
  output.quantity = 0;
  output.reservedQuantity = 0;
  output.availableQuantity = 0;
  output.capacity = 0;
  output.hungerRestore = 0;
  output.storageSlotId = 0;
  output.targetCellIndex = 0;
  output.interactionSpotId = 0;
  output.itemRowVersion = 0;
  output.itemStoreVersion = 0;
  output.foodAvailabilityVersion = 0;
  output.reservationVersion = 0;
}

export type HaulingClaimFactsReason =
  | "hauling_claim_source_unavailable"
  | "hauling_claim_destination_unavailable"
  | "hauling_claim_basis_stale"
  | "hauling_claim_amount_invalid"
  | "hauling_claim_descriptor_unmapped"
  | "hauling_claim_output_invalid";

export interface HaulingClaimFactsMappingInput {
  readonly offerId: number;
  readonly descriptor: number;
  readonly workType: number;
  readonly opaqueTargetId: number;
  readonly sourceSlotId: number;
  readonly destinationSlotId: number;
  readonly sourceInteractionSpotId: number;
  readonly destinationInteractionSpotId: number;
}

export interface HaulingClaimFactsInput {
  readonly descriptor: number;
  readonly workType: number;
  readonly offerId: number;
  readonly opaqueTargetId: number;
  readonly sourceSlotId: number;
  readonly destinationSlotId: number;
  readonly amount: number;
  readonly expectedOfferOwnerVersion: number;
  readonly expectedOfferRowVersion: number;
  readonly expectedOfferIndexVersion: number;
  readonly expectedOfferRegionId: number;
  readonly expectedOfferDefId: number;
  readonly expectedOfferUrgencyBucket: number;
  readonly expectedOfferPermissionId: number;
  readonly expectedOfferTargetCellIndex: number;
  readonly expectedOfferScoreMilli: number;
  readonly expectedMappingRowVersion: number;
  readonly expectedMappingIndexVersion: number;
  readonly expectedSourceRowVersion: number;
  readonly expectedDestinationRowVersion: number;
  readonly expectedStorageIndexVersion: number;
  readonly expectedSourceDirtyBacklog: number;
  readonly expectedDestinationDirtyBacklog: number;
  readonly expectedItemRowVersion: number;
  readonly expectedItemStoreVersion: number;
  readonly expectedReservationVersion: number;
}

export interface HaulingClaimFactsScratch {
  readonly offer: WorkOfferReadIntoOutput;
  readonly source: StorageSlotIntoOutput;
  readonly destination: StorageSlotIntoOutput;
  readonly item: ItemStackIntoOutput;
  readonly itemRead: ItemStackReadScratch;
}

export interface HaulingClaimFactsIntoOutput {
  ok: boolean;
  reason: HaulingClaimFactsReason | undefined;
  sourceSlotId: number;
  destinationSlotId: number;
  sourceStackId: number;
  destinationStackId: number;
  defId: number;
  amount: number;
  sourceEntityIndex: number;
  sourceEntityGeneration: number;
  destinationEntityIndex: number;
  destinationEntityGeneration: number;
  sourceInteractionSpotId: number;
  destinationInteractionSpotId: number;
  sourceRowVersion: number;
  destinationRowVersion: number;
  indexVersion: number;
  descriptor: number;
  workType: number;
  offerId: number;
  opaqueTargetId: number;
  offerOwnerVersion: number;
  offerRowVersion: number;
  offerIndexVersion: number;
  sourceDirtyBacklog: number;
  destinationDirtyBacklog: number;
  itemRowVersion: number;
  itemStoreVersion: number;
  reservationVersion: number;
  manifestVersion: number;
  readonly channelCodes: Uint8Array;
  readonly targetIndexes: Uint32Array;
  readonly targetGenerations: Uint32Array;
  readonly slotIds: Uint32Array;
  readonly amounts: Uint32Array;
  readonly limits: Uint32Array;
  readonly cellIndexes: Uint32Array;
  readonly domainIds: Uint32Array;
  policyKind: number;
  policyVersion: number;
  factCount: number;
  readonly factCodes: Uint8Array;
  readonly factValues: Int32Array;
  transitionTargetSlot: number;
  mappingRowVersion: number;
  mappingIndexVersion: number;
  channelCount: number;
}

export interface HaulingClaimFactsSnapshotRow extends HaulingClaimFactsMappingInput {
  readonly active: number;
  readonly rowVersion: number;
}

export interface HaulingClaimFactsSnapshot {
  readonly snapshotVersion: typeof HAULING_CLAIM_FACTS_SNAPSHOT_VERSION;
  readonly capacity: number;
  readonly indexVersion: number;
  readonly rows: readonly HaulingClaimFactsSnapshotRow[];
}

export class HaulingClaimFactsIndex {
  readonly capacity: number;
  private readonly active: Uint8Array;
  private readonly descriptors: Uint32Array;
  private readonly workTypes: Uint32Array;
  private readonly opaqueTargetIds: Uint32Array;
  private readonly sourceSlotIds: Uint32Array;
  private readonly destinationSlotIds: Uint32Array;
  private readonly sourceInteractionSpotIds: Uint32Array;
  private readonly destinationInteractionSpotIds: Uint32Array;
  private readonly rowVersions: Uint32Array;
  private indexVersion = 0;

  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0 || capacity > 0xffff_ffff) {
      throw new RangeError("hauling claim facts capacity invalid");
    }
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.descriptors = new Uint32Array(capacity);
    this.workTypes = new Uint32Array(capacity);
    this.opaqueTargetIds = new Uint32Array(capacity);
    this.sourceSlotIds = new Uint32Array(capacity);
    this.destinationSlotIds = new Uint32Array(capacity);
    this.sourceInteractionSpotIds = new Uint32Array(capacity);
    this.destinationInteractionSpotIds = new Uint32Array(capacity);
    this.rowVersions = new Uint32Array(capacity);
  }

  configure(input: HaulingClaimFactsMappingInput): boolean {
    const offerId = input.offerId;
    if (
      !Number.isSafeInteger(offerId) ||
      offerId < 0 ||
      offerId >= this.capacity ||
      input.descriptor !== HAULING_CLAIM_FACTS_DESCRIPTOR ||
      input.workType !== HAULING_CLAIM_FACTS_WORK_TYPE ||
      !isUint32(input.opaqueTargetId) ||
      !isUint32(input.sourceSlotId) ||
      !isUint32(input.destinationSlotId) ||
      !isUint32(input.sourceInteractionSpotId) ||
      !isUint32(input.destinationInteractionSpotId) ||
      input.opaqueTargetId === HAULING_CLAIM_NONE ||
      input.sourceSlotId === HAULING_CLAIM_NONE ||
      input.destinationSlotId === HAULING_CLAIM_NONE ||
      input.sourceInteractionSpotId === HAULING_CLAIM_NONE ||
      input.destinationInteractionSpotId === HAULING_CLAIM_NONE ||
      input.sourceSlotId === input.destinationSlotId ||
      this.indexVersion === 0xffff_ffff ||
      (this.rowVersions[offerId] ?? 0) === 0xffff_ffff
    )
      return false;
    this.active[offerId] = 1;
    this.descriptors[offerId] = input.descriptor;
    this.workTypes[offerId] = input.workType;
    this.opaqueTargetIds[offerId] = input.opaqueTargetId;
    this.sourceSlotIds[offerId] = input.sourceSlotId;
    this.destinationSlotIds[offerId] = input.destinationSlotId;
    this.sourceInteractionSpotIds[offerId] = input.sourceInteractionSpotId;
    this.destinationInteractionSpotIds[offerId] = input.destinationInteractionSpotId;
    this.rowVersions[offerId] = (this.rowVersions[offerId] ?? 0) + 1;
    this.indexVersion += 1;
    return true;
  }

  readClaimFactsInto(
    input: HaulingClaimFactsInput,
    offers: WorkOfferIndex,
    storage: StorageLogisticsIndex,
    items: ItemStackStore,
    ledger: ReservationLedger,
    scratch: HaulingClaimFactsScratch,
    output: HaulingClaimFactsIntoOutput,
  ): void {
    resetHauling(output);
    if (!hasExactHaulingOutputLanes(output)) {
      output.reason = "hauling_claim_output_invalid";
      return;
    }
    const offerId = input.offerId;
    if (
      !Number.isSafeInteger(offerId) ||
      offerId < 0 ||
      offerId >= this.capacity ||
      this.active[offerId] !== 1 ||
      input.descriptor !== HAULING_CLAIM_FACTS_DESCRIPTOR ||
      input.workType !== HAULING_CLAIM_FACTS_WORK_TYPE ||
      this.descriptors[offerId] !== input.descriptor ||
      this.workTypes[offerId] !== input.workType ||
      this.opaqueTargetIds[offerId] !== input.opaqueTargetId
    ) {
      output.reason = "hauling_claim_descriptor_unmapped";
      return;
    }
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 0xffff_ffff) {
      output.reason = "hauling_claim_amount_invalid";
      return;
    }
    const sourceSlotId = this.sourceSlotIds[offerId] ?? 0;
    const destinationSlotId = this.destinationSlotIds[offerId] ?? 0;
    if (
      input.sourceSlotId !== sourceSlotId ||
      input.destinationSlotId !== destinationSlotId ||
      input.expectedMappingRowVersion !== this.rowVersions[offerId] ||
      input.expectedMappingIndexVersion !== this.indexVersion
    ) {
      output.reason = "hauling_claim_basis_stale";
      return;
    }
    offers.readOfferInto(offerId, scratch.offer);
    storage.readSlotInto(sourceSlotId, scratch.source);
    storage.readSlotInto(destinationSlotId, scratch.destination);
    if (!scratch.source.ok || scratch.source.availableSupply < input.amount) {
      output.reason = "hauling_claim_source_unavailable";
      return;
    }
    if (!scratch.destination.ok || scratch.destination.availableCapacity < input.amount) {
      output.reason = "hauling_claim_destination_unavailable";
      return;
    }
    items.readStackInto(scratch.source.stackId, ledger, scratch.itemRead, scratch.item);
    if (
      !scratch.offer.ok ||
      scratch.offer.offerId !== offerId ||
      scratch.offer.workType !== input.workType ||
      scratch.offer.targetId !== input.opaqueTargetId ||
      scratch.offer.ownerVersion !== input.expectedOfferOwnerVersion ||
      scratch.offer.rowVersion !== input.expectedOfferRowVersion ||
      scratch.offer.indexVersion !== input.expectedOfferIndexVersion ||
      scratch.offer.regionId !== input.expectedOfferRegionId ||
      scratch.offer.defId !== input.expectedOfferDefId ||
      scratch.offer.urgencyBucket !== input.expectedOfferUrgencyBucket ||
      scratch.offer.permissionId !== input.expectedOfferPermissionId ||
      scratch.offer.targetCellIndex !== input.expectedOfferTargetCellIndex ||
      scratch.offer.scoreMilli !== input.expectedOfferScoreMilli ||
      scratch.offer.defId !== scratch.source.defId ||
      scratch.source.rowVersion !== input.expectedSourceRowVersion ||
      scratch.destination.rowVersion !== input.expectedDestinationRowVersion ||
      scratch.source.indexVersion !== input.expectedStorageIndexVersion ||
      scratch.destination.indexVersion !== input.expectedStorageIndexVersion ||
      scratch.source.dirtyBacklog !== input.expectedSourceDirtyBacklog ||
      scratch.destination.dirtyBacklog !== input.expectedDestinationDirtyBacklog ||
      scratch.source.dirtyQueued ||
      scratch.destination.dirtyQueued ||
      scratch.source.defId !== scratch.destination.defId ||
      !scratch.item.ok ||
      scratch.item.stackId !== scratch.source.stackId ||
      scratch.item.defId !== scratch.source.defId ||
      scratch.item.availableQuantity !== scratch.source.availableSupply ||
      scratch.item.rowVersion !== input.expectedItemRowVersion ||
      scratch.item.storeVersion !== input.expectedItemStoreVersion ||
      scratch.item.reservationVersion !== input.expectedReservationVersion
    ) {
      output.reason = "hauling_claim_basis_stale";
      return;
    }
    output.ok = true;
    output.sourceSlotId = sourceSlotId;
    output.destinationSlotId = destinationSlotId;
    output.sourceStackId = scratch.source.stackId;
    output.destinationStackId = scratch.destination.stackId;
    output.defId = scratch.source.defId;
    output.amount = input.amount;
    output.sourceEntityIndex = scratch.item.entityIndex;
    output.sourceEntityGeneration = scratch.item.entityGeneration;
    output.destinationEntityIndex = scratch.destination.storageIndex;
    output.destinationEntityGeneration = scratch.destination.storageGeneration;
    output.sourceInteractionSpotId = this.sourceInteractionSpotIds[offerId] ?? 0;
    output.destinationInteractionSpotId = this.destinationInteractionSpotIds[offerId] ?? 0;
    output.sourceRowVersion = scratch.source.rowVersion;
    output.destinationRowVersion = scratch.destination.rowVersion;
    output.indexVersion = scratch.source.indexVersion;
    output.descriptor = input.descriptor;
    output.workType = input.workType;
    output.offerId = input.offerId;
    output.opaqueTargetId = input.opaqueTargetId;
    output.offerOwnerVersion = scratch.offer.ownerVersion;
    output.offerRowVersion = scratch.offer.rowVersion;
    output.offerIndexVersion = scratch.offer.indexVersion;
    output.sourceDirtyBacklog = scratch.source.dirtyBacklog;
    output.destinationDirtyBacklog = scratch.destination.dirtyBacklog;
    output.itemRowVersion = scratch.item.rowVersion;
    output.itemStoreVersion = scratch.item.storeVersion;
    output.reservationVersion = scratch.item.reservationVersion;
    output.manifestVersion = HAULING_CLAIM_FACTS_MANIFEST_VERSION;
    output.policyKind = HAULING_CLAIM_POLICY_KIND;
    output.policyVersion = HAULING_CLAIM_POLICY_VERSION;
    output.factCount = 1;
    output.factCodes[0] = HAUL_TRANSFER_AMOUNT_FACT_CODE;
    output.factValues[0] = input.amount | 0;
    output.transitionTargetSlot = HAULING_CLAIM_TRANSITION_TARGET_SLOT;
    output.mappingRowVersion = this.rowVersions[offerId] ?? 0;
    output.mappingIndexVersion = this.indexVersion;
    output.channelCount = 4;
    writeHaulingClaimLanes(
      input.amount,
      scratch,
      this.sourceInteractionSpotIds[offerId] ?? 0,
      this.destinationInteractionSpotIds[offerId] ?? 0,
      output,
    );
  }

  createSnapshot(): HaulingClaimFactsSnapshot {
    const rows: HaulingClaimFactsSnapshotRow[] = [];
    for (let offerId = 0; offerId < this.capacity; offerId += 1) {
      rows.push({
        offerId,
        active: this.active[offerId] ?? 0,
        descriptor: this.descriptors[offerId] ?? 0,
        workType: this.workTypes[offerId] ?? 0,
        opaqueTargetId: this.opaqueTargetIds[offerId] ?? 0,
        sourceSlotId: this.sourceSlotIds[offerId] ?? 0,
        destinationSlotId: this.destinationSlotIds[offerId] ?? 0,
        sourceInteractionSpotId: this.sourceInteractionSpotIds[offerId] ?? 0,
        destinationInteractionSpotId: this.destinationInteractionSpotIds[offerId] ?? 0,
        rowVersion: this.rowVersions[offerId] ?? 0,
      });
    }
    return {
      snapshotVersion: HAULING_CLAIM_FACTS_SNAPSHOT_VERSION,
      capacity: this.capacity,
      indexVersion: this.indexVersion,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): boolean {
    if (!isHaulingClaimFactsSnapshot(snapshot, this.capacity)) return false;
    for (let offerId = 0; offerId < this.capacity; offerId += 1) {
      const row = snapshot.rows[offerId];
      if (row === undefined) return false;
      this.active[offerId] = row.active;
      this.descriptors[offerId] = row.descriptor;
      this.workTypes[offerId] = row.workType;
      this.opaqueTargetIds[offerId] = row.opaqueTargetId;
      this.sourceSlotIds[offerId] = row.sourceSlotId;
      this.destinationSlotIds[offerId] = row.destinationSlotId;
      this.sourceInteractionSpotIds[offerId] = row.sourceInteractionSpotId;
      this.destinationInteractionSpotIds[offerId] = row.destinationInteractionSpotId;
      this.rowVersions[offerId] = row.rowVersion;
    }
    this.indexVersion = snapshot.indexVersion;
    return true;
  }
}

export function createHaulingClaimFactsIndex(capacity: number): HaulingClaimFactsIndex {
  return new HaulingClaimFactsIndex(capacity);
}

export function restoreHaulingClaimFactsIndex(
  snapshot: HaulingClaimFactsSnapshot,
): HaulingClaimFactsIndex {
  const index = createHaulingClaimFactsIndex(snapshot.capacity);
  if (!index.restoreFromSnapshot(snapshot)) throw new Error("hauling claim facts snapshot invalid");
  return index;
}

export function createHaulingClaimFactsHashFields(
  snapshot: HaulingClaimFactsSnapshot,
  prefix = "haulingClaimFacts",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.indexVersion`, value: snapshot.indexVersion },
  ];
  for (let offerId = 0; offerId < snapshot.rows.length; offerId += 1) {
    const row = snapshot.rows[offerId];
    if (row === undefined) continue;
    const values = [
      row.offerId,
      row.active,
      row.descriptor,
      row.workType,
      row.opaqueTargetId,
      row.sourceSlotId,
      row.destinationSlotId,
      row.sourceInteractionSpotId,
      row.destinationInteractionSpotId,
      row.rowVersion,
    ];
    const names = [
      "offerId",
      "active",
      "descriptor",
      "workType",
      "opaqueTargetId",
      "sourceSlotId",
      "destinationSlotId",
      "sourceInteractionSpotId",
      "destinationInteractionSpotId",
      "rowVersion",
    ];
    for (let index = 0; index < names.length; index += 1) {
      fields.push({
        name: `${prefix}.row.${String(offerId)}.${names[index] ?? "unknown"}`,
        value: values[index] ?? 0,
      });
    }
  }
  return fields;
}

function resetHauling(output: HaulingClaimFactsIntoOutput): void {
  output.ok = false;
  output.reason = undefined;
  output.sourceSlotId = 0;
  output.destinationSlotId = 0;
  output.sourceStackId = 0;
  output.destinationStackId = 0;
  output.defId = 0;
  output.amount = 0;
  output.sourceEntityIndex = 0;
  output.sourceEntityGeneration = 0;
  output.destinationEntityIndex = 0;
  output.destinationEntityGeneration = 0;
  output.sourceInteractionSpotId = 0;
  output.destinationInteractionSpotId = 0;
  output.sourceRowVersion = 0;
  output.destinationRowVersion = 0;
  output.indexVersion = 0;
  output.descriptor = 0;
  output.workType = 0;
  output.offerId = 0;
  output.opaqueTargetId = 0;
  output.offerOwnerVersion = 0;
  output.offerRowVersion = 0;
  output.offerIndexVersion = 0;
  output.sourceDirtyBacklog = 0;
  output.destinationDirtyBacklog = 0;
  output.itemRowVersion = 0;
  output.itemStoreVersion = 0;
  output.reservationVersion = 0;
  output.manifestVersion = 0;
  output.policyKind = 0;
  output.policyVersion = 0;
  output.factCount = 0;
  output.transitionTargetSlot = 0;
  output.mappingRowVersion = 0;
  output.mappingIndexVersion = 0;
  output.channelCount = 0;
  resetClaimLanes(output);
  for (let index = 0; index < 8; index += 1) {
    output.factCodes[index] = 0;
    output.factValues[index] = 0;
  }
}

function hasExactHaulingOutputLanes(output: HaulingClaimFactsIntoOutput): boolean {
  return (
    output.channelCodes.length === 8 &&
    output.targetIndexes.length === 8 &&
    output.targetGenerations.length === 8 &&
    output.slotIds.length === 8 &&
    output.amounts.length === 8 &&
    output.limits.length === 8 &&
    output.cellIndexes.length === 8 &&
    output.domainIds.length === 8 &&
    output.factCodes.length === 8 &&
    output.factValues.length === 8
  );
}

function resetClaimLanes(output: HaulingClaimFactsIntoOutput): void {
  for (let index = 0; index < 8; index += 1) {
    output.channelCodes[index] = 0;
    output.targetIndexes[index] = HAULING_CLAIM_NONE;
    output.targetGenerations[index] = HAULING_CLAIM_NONE;
    output.slotIds[index] = HAULING_CLAIM_NONE;
    output.amounts[index] = 0;
    output.limits[index] = 0;
    output.cellIndexes[index] = HAULING_CLAIM_NONE;
    output.domainIds[index] = HAULING_CLAIM_NONE;
  }
}

function writeHaulingClaimLanes(
  amount: number,
  scratch: HaulingClaimFactsScratch,
  sourceSpotId: number,
  destinationSpotId: number,
  output: HaulingClaimFactsIntoOutput,
): void {
  output.channelCodes[0] = RESERVATION_ITEM_QUANTITY;
  output.channelCodes[1] = RESERVATION_CAPACITY;
  output.channelCodes[2] = RESERVATION_INTERACTION_SPOT;
  output.channelCodes[3] = RESERVATION_INTERACTION_SPOT;
  output.targetIndexes[0] = scratch.item.entityIndex;
  output.targetIndexes[1] = scratch.destination.storageIndex;
  output.targetIndexes[2] = scratch.item.entityIndex;
  output.targetIndexes[3] = scratch.destination.storageIndex;
  output.targetGenerations[0] = scratch.item.entityGeneration;
  output.targetGenerations[1] = scratch.destination.storageGeneration;
  output.targetGenerations[2] = scratch.item.entityGeneration;
  output.targetGenerations[3] = scratch.destination.storageGeneration;
  output.slotIds[1] = scratch.destination.slotId;
  output.slotIds[2] = sourceSpotId;
  output.slotIds[3] = destinationSpotId;
  output.amounts[0] = amount;
  output.amounts[1] = amount;
  output.limits[0] = scratch.item.quantity;
  output.limits[1] = scratch.destination.capacity - scratch.destination.quantity;
  output.cellIndexes[2] = scratch.source.interactionCellIndex;
  output.cellIndexes[3] = scratch.destination.interactionCellIndex;
  output.domainIds[0] = scratch.source.stackId;
  output.domainIds[1] = scratch.destination.slotId;
  output.domainIds[2] = scratch.source.slotId;
  output.domainIds[3] = scratch.destination.slotId;
}

function isUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff
  );
}

const HAULING_FACTS_SNAPSHOT_KEYS = ["snapshotVersion", "capacity", "indexVersion", "rows"];
const HAULING_FACTS_ROW_KEYS = [
  "offerId",
  "active",
  "descriptor",
  "workType",
  "opaqueTargetId",
  "sourceSlotId",
  "destinationSlotId",
  "sourceInteractionSpotId",
  "destinationInteractionSpotId",
  "rowVersion",
];

function isHaulingClaimFactsSnapshot(
  value: unknown,
  capacity: number,
): value is HaulingClaimFactsSnapshot {
  if (
    !isExactObject(value, HAULING_FACTS_SNAPSHOT_KEYS) ||
    value["snapshotVersion"] !== HAULING_CLAIM_FACTS_SNAPSHOT_VERSION ||
    value["capacity"] !== capacity ||
    !isUint32(value["indexVersion"]) ||
    !isDenseUnknownArray(value["rows"], capacity)
  )
    return false;
  let rowVersionSum = 0;
  for (let offerId = 0; offerId < capacity; offerId += 1) {
    const row = value["rows"][offerId];
    if (!isHaulingClaimFactsRow(row, offerId)) return false;
    if (rowVersionSum > 0xffff_ffff - row.rowVersion) return false;
    rowVersionSum += row.rowVersion;
  }
  return value["indexVersion"] === rowVersionSum;
}

function isHaulingClaimFactsRow(
  value: unknown,
  offerId: number,
): value is HaulingClaimFactsSnapshotRow {
  if (
    !isExactObject(value, HAULING_FACTS_ROW_KEYS) ||
    value["offerId"] !== offerId ||
    (value["active"] !== 0 && value["active"] !== 1)
  )
    return false;
  const keys = HAULING_FACTS_ROW_KEYS;
  for (let index = 2; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined || !isUint32(value[key])) return false;
  }
  if (value["active"] === 0) {
    for (let index = 2; index < keys.length; index += 1) {
      const key = keys[index];
      if (key !== undefined && value[key] !== 0) return false;
    }
    return true;
  }
  return (
    value["descriptor"] === HAULING_CLAIM_FACTS_DESCRIPTOR &&
    value["workType"] === HAULING_CLAIM_FACTS_WORK_TYPE &&
    value["opaqueTargetId"] !== HAULING_CLAIM_NONE &&
    value["sourceSlotId"] !== HAULING_CLAIM_NONE &&
    value["destinationSlotId"] !== HAULING_CLAIM_NONE &&
    value["sourceInteractionSpotId"] !== HAULING_CLAIM_NONE &&
    value["destinationInteractionSpotId"] !== HAULING_CLAIM_NONE &&
    value["sourceSlotId"] !== value["destinationSlotId"] &&
    isUint32(value["rowVersion"]) &&
    value["rowVersion"] > 0
  );
}

function isExactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
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

function isDenseUnknownArray(value: unknown, length: number): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length !== length) return false;
  for (let index = 0; index < length; index += 1) if (!(index in value)) return false;
  return true;
}

export interface ExistingClaimsAdoptionControl {
  readonly jobId: number;
  readonly jobGeneration: number;
  readonly ownerIndex: number;
  readonly ownerGeneration: number;
  readonly expectedJobSlotVersion: number;
  readonly expectedJobCoreVersion: number;
  readonly expectedDriverVersion: number;
  readonly claimCount: number;
  readonly claimIds: Uint32Array;
  readonly claimEpochs: Uint32Array;
  readonly claimLeaseExpiryTicks: Float64Array;
  readonly claimCreatedTick: number;
  readonly adoptionTick: number;
  readonly reservationReadVersion: number;
}

export interface NewlyAdoptedRollbackControl extends ExistingClaimsAdoptionControl {
  readonly expectedAdoptedJobSlotVersion: number;
  readonly expectedAdoptedDriverVersion: number;
}

export interface DriverAdoptionOutput {
  ok: boolean;
  reason: string | undefined;
  jobId: number;
  jobGeneration: number;
  jobSlotVersion: number;
  jobCoreVersion: number;
  driverVersion: number;
  activeCount: number;
}

export function isExactAdoptionClaimPrefix(
  control: ExistingClaimsAdoptionControl,
  claims: ReservationClaimsIntoOutput,
  expectedCount: number,
): boolean {
  if (
    control.claimCount !== expectedCount ||
    claims.claimCount !== expectedCount ||
    !claims.ok ||
    claims.version !== control.reservationReadVersion ||
    !hasExactAdoptionClaimLaneShape(claims) ||
    control.claimIds.length !== 8 ||
    control.claimEpochs.length !== 8 ||
    control.claimLeaseExpiryTicks.length !== 8 ||
    !Number.isSafeInteger(control.claimCreatedTick) ||
    control.claimCreatedTick < 0 ||
    !Number.isSafeInteger(control.adoptionTick) ||
    control.adoptionTick < control.claimCreatedTick
  )
    return false;
  for (let index = 0; index < expectedCount; index += 1) {
    if (
      (control.claimIds[index] ?? 0xffff_ffff) === 0xffff_ffff ||
      (control.claimEpochs[index] ?? 0) !== (claims.allocationEpochs[index] ?? 0) ||
      !Number.isSafeInteger(control.claimLeaseExpiryTicks[index]) ||
      (control.claimLeaseExpiryTicks[index] ?? -1) < control.claimCreatedTick ||
      (claims.ownerIndexes[index] ?? 0) !== control.ownerIndex ||
      (claims.ownerGenerations[index] ?? 0) !== control.ownerGeneration ||
      (claims.jobIds[index] ?? 0) !== control.jobId ||
      (claims.jobGenerations[index] ?? 0) !== control.jobGeneration ||
      (claims.createdTicks[index] ?? -1) !== control.claimCreatedTick ||
      (claims.leaseExpiryTicks[index] ?? -1) !== control.claimLeaseExpiryTicks[index]
    )
      return false;
  }
  for (let index = expectedCount; index < 8; index += 1) {
    if (
      (control.claimIds[index] ?? 0) !== 0xffff_ffff ||
      (control.claimEpochs[index] ?? 0) !== 0 ||
      (control.claimLeaseExpiryTicks[index] ?? 0) !== 0 ||
      (claims.channelCodes[index] ?? 0) !== 0 ||
      (claims.ownerIndexes[index] ?? 0) !== 0xffff_ffff ||
      (claims.ownerGenerations[index] ?? 0) !== 0 ||
      (claims.jobIds[index] ?? 0) !== 0xffff_ffff ||
      (claims.jobGenerations[index] ?? 0) !== 0 ||
      (claims.hasTargetFlags[index] ?? 0) !== 0 ||
      (claims.targetIndexes[index] ?? 0) !== 0xffff_ffff ||
      (claims.targetGenerations[index] ?? 0) !== 0 ||
      (claims.cellIndexes[index] ?? 0) !== 0xffff_ffff ||
      (claims.slotIds[index] ?? 0) !== 0xffff_ffff ||
      (claims.amounts[index] ?? 0) !== 0 ||
      (claims.allocationEpochs[index] ?? 0) !== 0 ||
      (claims.createdTicks[index] ?? 0) !== 0 ||
      (claims.leaseExpiryTicks[index] ?? 0) !== 0
    )
      return false;
  }
  return true;
}

function hasExactAdoptionClaimLaneShape(claims: ReservationClaimsIntoOutput): boolean {
  return (
    claims.channelCodes.length === 8 &&
    claims.ownerIndexes.length === 8 &&
    claims.ownerGenerations.length === 8 &&
    claims.jobIds.length === 8 &&
    claims.jobGenerations.length === 8 &&
    claims.hasTargetFlags.length === 8 &&
    claims.targetIndexes.length === 8 &&
    claims.targetGenerations.length === 8 &&
    claims.cellIndexes.length === 8 &&
    claims.slotIds.length === 8 &&
    claims.amounts.length === 8 &&
    claims.allocationEpochs.length === 8 &&
    claims.createdTicks.length === 8 &&
    claims.leaseExpiryTicks.length === 8
  );
}

export function resetDriverAdoptionOutput(output: DriverAdoptionOutput): void {
  output.ok = false;
  output.reason = undefined;
  output.jobId = 0xffff_ffff;
  output.jobGeneration = 0;
  output.jobSlotVersion = 0;
  output.jobCoreVersion = 0;
  output.driverVersion = 0;
  output.activeCount = 0;
}

export function releaseStoredAutonomyClaimsInto(
  ledger: ReservationLedger,
  storedClaimIds: Uint32Array,
  storedClaimEpochs: Uint32Array,
  storedBase: number,
  claimCount: number,
  owner: EntityId,
  jobId: number,
  jobGeneration: number,
  expectedLedgerVersion: number,
  scratchClaimIds: Uint32Array,
  scratchClaimEpochs: Uint32Array,
  output: ReservationReleaseIntoOutput,
): void {
  for (let index = 0; index < claimCount; index += 1) {
    scratchClaimIds[index] = storedClaimIds[storedBase + index] ?? 0xffff_ffff;
    scratchClaimEpochs[index] = storedClaimEpochs[storedBase + index] ?? 0;
  }
  ledger.releaseClaimsInto(
    scratchClaimIds,
    scratchClaimEpochs,
    claimCount,
    owner,
    jobId,
    jobGeneration,
    expectedLedgerVersion,
    output,
  );
}
