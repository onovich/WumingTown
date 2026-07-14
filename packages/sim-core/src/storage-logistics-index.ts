import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { ItemStackStore } from "./item-stack-store";
import type { ReservationLedger } from "./reservation-ledger";
import type { WorkOfferIndex } from "./work-offers";
import type { CanonicalWorldField } from "./world-hash";

export const STORAGE_LOGISTICS_SNAPSHOT_VERSION = 1;
export const STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES = 24;

export type StorageLogisticsReason =
  | "storage_slot_id_out_of_range"
  | "storage_slot_already_registered"
  | "storage_slot_not_registered"
  | "storage_entity_invalid"
  | "storage_stack_invalid"
  | "storage_def_invalid"
  | "storage_capacity_invalid"
  | "storage_interaction_cell_invalid"
  | "storage_offer_invalid"
  | "storage_candidate_buffer_too_small"
  | "storage_dirty_basis_mismatch"
  | "storage_version_exhausted"
  | "storage_snapshot_invalid";

const STORAGE_DIRTY_APPEND_COMMIT = Symbol("storage-dirty-append-commit");
const STORAGE_DIRTY_COALESCE_COMMIT = Symbol("storage-dirty-coalesce-commit");

export type StorageLogisticsMutationResult =
  | { readonly ok: true; readonly version: number }
  | { readonly ok: false; readonly reason: StorageLogisticsReason };

export interface StorageSlotInput {
  readonly slotId: number;
  readonly storage: EntityId;
  readonly stackId: number;
  readonly defId: number;
  readonly capacity: number;
  readonly desiredQuantity: number;
  readonly interactionCellIndex: number;
  readonly offerId: number;
  readonly workType: number;
  readonly regionId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
}

export interface StorageSlotView extends StorageSlotInput {
  readonly quantity: number;
  readonly reservedSupply: number;
  readonly reservedCapacity: number;
  readonly availableSupply: number;
  readonly availableCapacity: number;
  readonly demandQuantity: number;
  readonly offerActive: boolean;
  readonly rowVersion: number;
  readonly indexVersion: number;
  readonly dirtyBacklog: number;
  readonly dirtyQueued: boolean;
  readonly dirtyHead: number;
}

export interface StorageSlotIntoOutput {
  ok: boolean;
  reason: StorageLogisticsReason | undefined;
  active: boolean;
  slotId: number;
  storageIndex: number;
  storageGeneration: number;
  stackId: number;
  defId: number;
  capacity: number;
  desiredQuantity: number;
  interactionCellIndex: number;
  offerId: number;
  workType: number;
  regionId: number;
  urgencyBucket: number;
  permissionId: number;
  quantity: number;
  reservedSupply: number;
  reservedCapacity: number;
  availableSupply: number;
  availableCapacity: number;
  demandQuantity: number;
  offerActive: boolean;
  rowVersion: number;
  indexVersion: number;
  dirtyBacklog: number;
  dirtyQueued: boolean;
  dirtyHead: number;
  dirtyCapacity: number;
  dirtyQueueIndex: number;
}

export interface StorageSlotDirtyPrepareInput {
  readonly slotId: number;
  readonly expectedRowVersion: number;
  readonly expectedIndexVersion: number;
  readonly expectedDirtyBacklog: number;
  readonly expectedDirtyQueued: boolean;
  readonly expectedDirtyHead: number;
  readonly expectedDirtyCapacity: number;
  readonly expectedDirtyQueueIndex: number;
}

export interface PreparedStorageSlotDirty {
  ok: boolean;
  reason: StorageLogisticsReason | undefined;
  slotId: number;
  alreadyQueued: boolean;
  queueIndex: number;
  rowVersion: number;
  indexVersion: number;
  previousDirtyBacklog: number;
  nextDirtyBacklog: number;
  previousDirtyHead: number;
  nextDirtyHead: number;
  dirtyCapacity: number;
}

export interface StorageLogisticsSnapshotRow {
  readonly slotId: number;
  readonly active: number;
  readonly storageIndex: number;
  readonly storageGeneration: number;
  readonly stackId: number;
  readonly defId: number;
  readonly capacity: number;
  readonly desiredQuantity: number;
  readonly interactionCellIndex: number;
  readonly offerId: number;
  readonly workType: number;
  readonly regionId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
  readonly quantity: number;
  readonly reservedSupply: number;
  readonly reservedCapacity: number;
  readonly availableSupply: number;
  readonly availableCapacity: number;
  readonly demandQuantity: number;
  readonly offerActive: number;
  readonly rowVersion: number;
  readonly supplyNext: number;
  readonly supplyPrevious: number;
  readonly demandNext: number;
  readonly demandPrevious: number;
  readonly supplyLinked: number;
  readonly demandLinked: number;
  readonly dirtyQueued: number;
}

export interface StorageLogisticsSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly stackCapacity: number;
  readonly defCapacity: number;
  readonly indexVersion: number;
  readonly activeCount: number;
  readonly refreshedCount: number;
  readonly indexedSupplyCount: number;
  readonly indexedDemandCount: number;
  readonly dirtyHead: number;
  readonly dirtyCount: number;
  readonly stackToSlot: readonly number[];
  readonly supplyHeadByDef: readonly number[];
  readonly demandHeadByDef: readonly number[];
  readonly dirtyQueue: readonly number[];
  readonly rows: readonly StorageLogisticsSnapshotRow[];
}

export interface StorageLogisticsSnapshot extends StorageLogisticsSnapshotInput {
  readonly snapshotVersion: typeof STORAGE_LOGISTICS_SNAPSHOT_VERSION;
}

export interface StorageLogisticsMetrics {
  readonly version: number;
  readonly activeSlotCount: number;
  readonly dirtyBacklog: number;
  readonly refreshedSlotCount: number;
  readonly activeSupplySlots: number;
  readonly activeDemandSlots: number;
  readonly indexedSupplySlots: number;
  readonly indexedDemandSlots: number;
}

export interface StorageLogisticsRefreshResult extends StorageLogisticsMetrics {
  readonly ok: boolean;
  readonly reason: StorageLogisticsReason | undefined;
  readonly refreshedCount: number;
}

export type StorageCandidateSelectionResult =
  | {
      readonly ok: true;
      readonly defId: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly candidateCapHit: boolean;
      readonly version: number;
    }
  | { readonly ok: false; readonly reason: StorageLogisticsReason };

export interface StorageSupplySelectionScratch {
  readonly slotIds: Uint32Array;
  readonly stackIds: Uint32Array;
  readonly rowVersions: Uint32Array;
  readonly availableSupplies: Uint32Array;
  readonly linkedFlags: Uint8Array;
}

export interface StorageSupplySelectionIntoOutput {
  ok: boolean;
  reason: StorageLogisticsReason | undefined;
  queryDefId: number;
  candidateCap: number;
  visitedCount: number;
  selectedCount: number;
  candidateCapHit: boolean;
  indexVersion: number;
  dirtyBacklog: number;
}

type CandidateKind = "supply" | "demand";

export class StorageLogisticsIndex {
  readonly capacity: number;
  readonly stackCapacity: number;
  readonly defCapacity: number;

  private readonly active: Uint8Array;
  private readonly storageIndexes: Uint32Array;
  private readonly storageGenerations: Uint32Array;
  private readonly stackIds: Uint32Array;
  private readonly stackToSlot: Int32Array;
  private readonly defIds: Uint32Array;
  private readonly capacities: Uint32Array;
  private readonly desiredQuantities: Uint32Array;
  private readonly interactionCellIndexes: Uint32Array;
  private readonly offerIds: Uint32Array;
  private readonly workTypes: Uint32Array;
  private readonly regionIds: Uint32Array;
  private readonly urgencyBuckets: Uint32Array;
  private readonly permissionIds: Uint32Array;
  private readonly quantities: Uint32Array;
  private readonly reservedSupplies: Uint32Array;
  private readonly reservedCapacities: Uint32Array;
  private readonly availableSupplies: Uint32Array;
  private readonly availableCapacities: Uint32Array;
  private readonly demandQuantities: Uint32Array;
  private readonly offerActive: Uint8Array;
  private readonly rowVersions: Uint32Array;
  private readonly supplyHeadByDef: Int32Array;
  private readonly demandHeadByDef: Int32Array;
  private readonly supplyNextBySlot: Int32Array;
  private readonly supplyPreviousBySlot: Int32Array;
  private readonly demandNextBySlot: Int32Array;
  private readonly demandPreviousBySlot: Int32Array;
  private readonly supplyLinked: Uint8Array;
  private readonly demandLinked: Uint8Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private readonly refreshSeen: Uint8Array;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private activeCount = 0;
  private refreshedCount = 0;
  private indexedSupplyCount = 0;
  private indexedDemandCount = 0;
  private indexVersion = 0;

  constructor(capacity: number, stackCapacity: number, defCapacity = stackCapacity) {
    assertValidCapacity(capacity, "storage logistics capacity");
    assertValidCapacity(stackCapacity, "storage logistics stack capacity");
    assertValidCapacity(defCapacity, "storage logistics def capacity");
    this.capacity = capacity;
    this.stackCapacity = stackCapacity;
    this.defCapacity = defCapacity;
    this.active = new Uint8Array(capacity);
    this.storageIndexes = new Uint32Array(capacity);
    this.storageGenerations = new Uint32Array(capacity);
    this.stackIds = new Uint32Array(capacity);
    this.stackToSlot = new Int32Array(stackCapacity);
    this.stackToSlot.fill(-1);
    this.defIds = new Uint32Array(capacity);
    this.capacities = new Uint32Array(capacity);
    this.desiredQuantities = new Uint32Array(capacity);
    this.interactionCellIndexes = new Uint32Array(capacity);
    this.offerIds = new Uint32Array(capacity);
    this.workTypes = new Uint32Array(capacity);
    this.regionIds = new Uint32Array(capacity);
    this.urgencyBuckets = new Uint32Array(capacity);
    this.permissionIds = new Uint32Array(capacity);
    this.quantities = new Uint32Array(capacity);
    this.reservedSupplies = new Uint32Array(capacity);
    this.reservedCapacities = new Uint32Array(capacity);
    this.availableSupplies = new Uint32Array(capacity);
    this.availableCapacities = new Uint32Array(capacity);
    this.demandQuantities = new Uint32Array(capacity);
    this.offerActive = new Uint8Array(capacity);
    this.rowVersions = new Uint32Array(capacity);
    this.supplyHeadByDef = new Int32Array(defCapacity);
    this.demandHeadByDef = new Int32Array(defCapacity);
    this.supplyNextBySlot = new Int32Array(capacity);
    this.supplyPreviousBySlot = new Int32Array(capacity);
    this.demandNextBySlot = new Int32Array(capacity);
    this.demandPreviousBySlot = new Int32Array(capacity);
    this.supplyLinked = new Uint8Array(capacity);
    this.demandLinked = new Uint8Array(capacity);
    this.supplyHeadByDef.fill(-1);
    this.demandHeadByDef.fill(-1);
    this.supplyNextBySlot.fill(-1);
    this.supplyPreviousBySlot.fill(-1);
    this.demandNextBySlot.fill(-1);
    this.demandPreviousBySlot.fill(-1);
    this.dirtyQueued = new Uint8Array(capacity);
    this.dirtyQueue = new Uint32Array(capacity);
    this.refreshSeen = new Uint8Array(capacity);
  }

  configureSlot(
    input: StorageSlotInput,
    registry?: EntityRegistry,
  ): StorageLogisticsMutationResult {
    const validation = this.validateInput(input, registry);

    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.slotId] ?? 0) === 1) {
      return { ok: false, reason: "storage_slot_already_registered" };
    }
    if ((this.stackToSlot[input.stackId] ?? -1) !== -1) {
      return { ok: false, reason: "storage_stack_invalid" };
    }
    if (this.indexVersion === 0xffff_ffff || this.activeCount === 0xffff_ffff) {
      return { ok: false, reason: "storage_version_exhausted" };
    }

    this.active[input.slotId] = 1;
    this.storageIndexes[input.slotId] = input.storage.index;
    this.storageGenerations[input.slotId] = input.storage.generation;
    this.stackIds[input.slotId] = input.stackId;
    this.stackToSlot[input.stackId] = input.slotId;
    this.defIds[input.slotId] = input.defId;
    this.capacities[input.slotId] = input.capacity;
    this.desiredQuantities[input.slotId] = input.desiredQuantity;
    this.interactionCellIndexes[input.slotId] = input.interactionCellIndex;
    this.offerIds[input.slotId] = input.offerId;
    this.workTypes[input.slotId] = input.workType;
    this.regionIds[input.slotId] = input.regionId;
    this.urgencyBuckets[input.slotId] = input.urgencyBucket;
    this.permissionIds[input.slotId] = input.permissionId;
    this.availableCapacities[input.slotId] = input.capacity;
    this.demandQuantities[input.slotId] = input.desiredQuantity;
    this.activeCount += 1;
    this.rowVersions[input.slotId] = 1;
    if (input.desiredQuantity > 0) this.linkCandidateSlot("demand", input.slotId);
    this.markSlotDirty(input.slotId);
    this.indexVersion += 1;
    return { ok: true, version: this.indexVersion };
  }

  markStackDirty(stackId: number): StorageLogisticsMutationResult {
    if (!isIndexInRange(stackId, this.stackCapacity)) {
      return { ok: false, reason: "storage_stack_invalid" };
    }

    const slotId = this.stackToSlot[stackId] ?? -1;
    if (slotId < 0) {
      return { ok: false, reason: "storage_slot_not_registered" };
    }

    this.markSlotDirty(slotId);
    return { ok: true, version: this.indexVersion };
  }

  markSlotDirty(slotId: number): StorageLogisticsMutationResult {
    if (!this.isActiveSlot(slotId)) {
      return { ok: false, reason: "storage_slot_not_registered" };
    }

    if ((this.dirtyQueued[slotId] ?? 0) === 0) {
      const tail = (this.dirtyHead + this.dirtyCount) % this.capacity;
      this.dirtyQueue[tail] = slotId;
      this.dirtyQueued[slotId] = 1;
      this.dirtyCount += 1;
    }

    return { ok: true, version: this.indexVersion };
  }

  prepareSlotDirtyInto(
    input: StorageSlotDirtyPrepareInput,
    output: PreparedStorageSlotDirty,
  ): void {
    resetPreparedStorageDirty(output);
    const slotId = input.slotId;
    if (!isIndexInRange(slotId, this.capacity)) {
      output.reason = "storage_slot_id_out_of_range";
      return;
    }
    if (!this.isActiveSlot(slotId)) {
      output.reason = "storage_slot_not_registered";
      return;
    }
    if (!isValidStorageDirtyPrepareInput(input, this.capacity)) {
      output.reason = "storage_dirty_basis_mismatch";
      return;
    }
    const queued = (this.dirtyQueued[slotId] ?? 0) === 1;
    if (
      input.expectedRowVersion !== (this.rowVersions[slotId] ?? 0) ||
      input.expectedIndexVersion !== this.indexVersion ||
      input.expectedDirtyBacklog !== this.dirtyCount ||
      input.expectedDirtyQueued !== queued ||
      input.expectedDirtyHead !== this.dirtyHead ||
      input.expectedDirtyCapacity !== this.capacity
    ) {
      output.reason = "storage_dirty_basis_mismatch";
      return;
    }
    const queueIndex = queued
      ? this.findDirtyQueueIndex(slotId)
      : (this.dirtyHead + this.dirtyCount) % this.capacity;
    if (input.expectedDirtyQueueIndex !== queueIndex || queueIndex < 0) {
      output.reason = "storage_dirty_basis_mismatch";
      return;
    }
    if (!queued && this.dirtyCount >= this.capacity) {
      output.reason = "storage_candidate_buffer_too_small";
      return;
    }
    output.ok = true;
    output.slotId = slotId;
    output.alreadyQueued = queued;
    output.queueIndex = queueIndex;
    output.rowVersion = input.expectedRowVersion;
    output.indexVersion = input.expectedIndexVersion;
    output.previousDirtyBacklog = input.expectedDirtyBacklog;
    output.nextDirtyBacklog = input.expectedDirtyBacklog + (queued ? 0 : 1);
    output.previousDirtyHead = input.expectedDirtyHead;
    output.nextDirtyHead = input.expectedDirtyHead;
    output.dirtyCapacity = input.expectedDirtyCapacity;
  }

  [STORAGE_DIRTY_APPEND_COMMIT](prepared: PreparedStorageSlotDirty): void {
    this.dirtyQueue[prepared.queueIndex] = prepared.slotId;
    this.dirtyQueued[prepared.slotId] = 1;
    this.dirtyCount = prepared.nextDirtyBacklog;
  }

  [STORAGE_DIRTY_COALESCE_COMMIT](_prepared: PreparedStorageSlotDirty): void {
    void _prepared;
    // The exact queue entry is already authoritative; coalescing is a zero-write commit.
  }

  refreshDirty(
    items: ItemStackStore,
    ledger: ReservationLedger,
    offers: WorkOfferIndex,
    budget: number,
  ): StorageLogisticsRefreshResult {
    if (!isSafeUint32(budget)) {
      return this.createRefreshResult(false, "storage_candidate_buffer_too_small", 0);
    }
    const batchCount = Math.min(this.dirtyCount, budget);
    const failure = this.validateRefreshBatch(batchCount);
    if (failure !== undefined) return this.createRefreshResult(false, failure, 0);

    for (let offset = 0; offset < batchCount; offset += 1) {
      const queueIndex = (this.dirtyHead + offset) % this.capacity;
      const slotId = this.dirtyQueue[queueIndex] ?? 0;
      this.dirtyQueued[slotId] = 0;
      this.refreshSlot(slotId, items, ledger, offers);
      this.rowVersions[slotId] = (this.rowVersions[slotId] ?? 0) + 1;
    }
    if (batchCount > 0) {
      this.dirtyHead = (this.dirtyHead + batchCount) % this.capacity;
      this.dirtyCount -= batchCount;
      this.indexVersion += 1;
      this.refreshedCount += batchCount;
    }
    return this.createRefreshResult(true, undefined, batchCount);
  }

  readSlot(slotId: number): StorageSlotView | undefined {
    if (!this.isActiveSlot(slotId)) {
      return undefined;
    }

    return {
      slotId,
      storage: {
        index: this.storageIndexes[slotId] ?? 0,
        generation: this.storageGenerations[slotId] ?? 0,
      },
      stackId: this.stackIds[slotId] ?? 0,
      defId: this.defIds[slotId] ?? 0,
      capacity: this.capacities[slotId] ?? 0,
      desiredQuantity: this.desiredQuantities[slotId] ?? 0,
      interactionCellIndex: this.interactionCellIndexes[slotId] ?? 0,
      offerId: this.offerIds[slotId] ?? 0,
      workType: this.workTypes[slotId] ?? 0,
      regionId: this.regionIds[slotId] ?? 0,
      urgencyBucket: this.urgencyBuckets[slotId] ?? 0,
      permissionId: this.permissionIds[slotId] ?? 0,
      quantity: this.quantities[slotId] ?? 0,
      reservedSupply: this.reservedSupplies[slotId] ?? 0,
      reservedCapacity: this.reservedCapacities[slotId] ?? 0,
      availableSupply: this.availableSupplies[slotId] ?? 0,
      availableCapacity: this.availableCapacities[slotId] ?? 0,
      demandQuantity: this.demandQuantities[slotId] ?? 0,
      offerActive: (this.offerActive[slotId] ?? 0) === 1,
      rowVersion: this.rowVersions[slotId] ?? 0,
      indexVersion: this.indexVersion,
      dirtyBacklog: this.dirtyCount,
      dirtyQueued: (this.dirtyQueued[slotId] ?? 0) === 1,
      dirtyHead: this.dirtyHead,
    };
  }

  readSlotInto(slotId: number, output: StorageSlotIntoOutput): void {
    resetStorageSlotInto(0, this.indexVersion, this.dirtyCount, output);
    if (!isIndexInRange(slotId, this.capacity)) {
      output.reason = "storage_slot_id_out_of_range";
      return;
    }
    output.slotId = slotId;
    if ((this.active[slotId] ?? 0) !== 1) {
      output.reason = "storage_slot_not_registered";
      return;
    }
    output.ok = true;
    output.active = true;
    output.storageIndex = this.storageIndexes[slotId] ?? 0;
    output.storageGeneration = this.storageGenerations[slotId] ?? 0;
    output.stackId = this.stackIds[slotId] ?? 0;
    output.defId = this.defIds[slotId] ?? 0;
    output.capacity = this.capacities[slotId] ?? 0;
    output.desiredQuantity = this.desiredQuantities[slotId] ?? 0;
    output.interactionCellIndex = this.interactionCellIndexes[slotId] ?? 0;
    output.offerId = this.offerIds[slotId] ?? 0;
    output.workType = this.workTypes[slotId] ?? 0;
    output.regionId = this.regionIds[slotId] ?? 0;
    output.urgencyBucket = this.urgencyBuckets[slotId] ?? 0;
    output.permissionId = this.permissionIds[slotId] ?? 0;
    output.quantity = this.quantities[slotId] ?? 0;
    output.reservedSupply = this.reservedSupplies[slotId] ?? 0;
    output.reservedCapacity = this.reservedCapacities[slotId] ?? 0;
    output.availableSupply = this.availableSupplies[slotId] ?? 0;
    output.availableCapacity = this.availableCapacities[slotId] ?? 0;
    output.demandQuantity = this.demandQuantities[slotId] ?? 0;
    output.offerActive = (this.offerActive[slotId] ?? 0) === 1;
    output.rowVersion = this.rowVersions[slotId] ?? 0;
    output.dirtyQueued = (this.dirtyQueued[slotId] ?? 0) === 1;
    output.dirtyHead = this.dirtyHead;
    output.dirtyCapacity = this.capacity;
    output.dirtyQueueIndex = output.dirtyQueued
      ? this.findDirtyQueueIndex(slotId)
      : (this.dirtyHead + this.dirtyCount) % this.capacity;
  }

  private findDirtyQueueIndex(slotId: number): number {
    for (let offset = 0; offset < this.dirtyCount; offset += 1) {
      const index = (this.dirtyHead + offset) % this.capacity;
      if ((this.dirtyQueue[index] ?? 0) === slotId) return index;
    }
    return -1;
  }

  selectSupplySlots(
    defId: number,
    maxSlots: number,
    outputSlotIds: Uint32Array,
  ): StorageCandidateSelectionResult {
    return this.selectCandidateSlots("supply", defId, maxSlots, outputSlotIds);
  }

  selectSupplySlotsInto(
    defId: number,
    candidateCap: number,
    scratch: StorageSupplySelectionScratch,
    output: StorageSupplySelectionIntoOutput,
  ): void {
    resetSupplySelection(defId, candidateCap, this.indexVersion, this.dirtyCount, scratch, output);
    if (!hasValidSupplySelectionShape(candidateCap, scratch)) {
      output.reason = "storage_candidate_buffer_too_small";
      return;
    }
    if (!isIndexInRange(defId, this.defCapacity)) {
      output.reason = "storage_def_invalid";
      return;
    }
    if (this.dirtyCount !== 0) {
      output.reason = "storage_dirty_basis_mismatch";
      return;
    }

    const startVersion = this.indexVersion;
    this.captureSupplySelection(defId, candidateCap, scratch, output);
    output.indexVersion = this.indexVersion;
    output.dirtyBacklog = this.dirtyCount;
    if (
      output.indexVersion !== startVersion ||
      output.dirtyBacklog !== 0 ||
      !this.matchesCapturedSupplySelection(defId, scratch, output.selectedCount)
    ) {
      clearSupplySelectionLanes(scratch);
      output.ok = false;
      output.reason = "storage_dirty_basis_mismatch";
      output.visitedCount = 0;
      output.selectedCount = 0;
      output.candidateCapHit = false;
      return;
    }
    output.ok = true;
  }

  selectDemandSlots(
    defId: number,
    maxSlots: number,
    outputSlotIds: Uint32Array,
  ): StorageCandidateSelectionResult {
    return this.selectCandidateSlots("demand", defId, maxSlots, outputSlotIds);
  }

  createMetrics(): StorageLogisticsMetrics {
    let activeSupplySlots = 0;
    let activeDemandSlots = 0;

    for (let slotId = 0; slotId < this.capacity; slotId += 1) {
      if ((this.active[slotId] ?? 0) === 1) {
        if ((this.availableSupplies[slotId] ?? 0) > 0) {
          activeSupplySlots += 1;
        }
        if ((this.demandQuantities[slotId] ?? 0) > 0) {
          activeDemandSlots += 1;
        }
      }
    }

    return {
      version: this.indexVersion,
      activeSlotCount: this.activeCount,
      dirtyBacklog: this.dirtyCount,
      refreshedSlotCount: this.refreshedCount,
      activeSupplySlots,
      activeDemandSlots,
      indexedSupplySlots: this.indexedSupplyCount,
      indexedDemandSlots: this.indexedDemandCount,
    };
  }

  createSnapshot(): StorageLogisticsSnapshot {
    const rows: StorageLogisticsSnapshotRow[] = [];
    const stackToSlot: number[] = [];
    const supplyHeadByDef: number[] = [];
    const demandHeadByDef: number[] = [];
    const dirtyQueue: number[] = [];
    for (let slotId = 0; slotId < this.capacity; slotId += 1) rows.push(this.snapshotRow(slotId));
    for (let index = 0; index < this.stackCapacity; index += 1)
      stackToSlot.push(this.stackToSlot[index] ?? -1);
    for (let index = 0; index < this.defCapacity; index += 1) {
      supplyHeadByDef.push(this.supplyHeadByDef[index] ?? -1);
      demandHeadByDef.push(this.demandHeadByDef[index] ?? -1);
    }
    for (let index = 0; index < this.capacity; index += 1)
      dirtyQueue.push(this.dirtyQueue[index] ?? 0);
    return {
      snapshotVersion: STORAGE_LOGISTICS_SNAPSHOT_VERSION,
      capacity: this.capacity,
      stackCapacity: this.stackCapacity,
      defCapacity: this.defCapacity,
      indexVersion: this.indexVersion,
      activeCount: this.activeCount,
      refreshedCount: this.refreshedCount,
      indexedSupplyCount: this.indexedSupplyCount,
      indexedDemandCount: this.indexedDemandCount,
      dirtyHead: this.dirtyHead,
      dirtyCount: this.dirtyCount,
      stackToSlot,
      supplyHeadByDef,
      demandHeadByDef,
      dirtyQueue,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): StorageLogisticsMutationResult {
    if (
      !isStorageSnapshot(snapshot) ||
      snapshot.capacity !== this.capacity ||
      snapshot.stackCapacity !== this.stackCapacity ||
      snapshot.defCapacity !== this.defCapacity ||
      snapshot.rows.length !== this.capacity ||
      snapshot.stackToSlot.length !== this.stackCapacity ||
      snapshot.supplyHeadByDef.length !== this.defCapacity ||
      snapshot.demandHeadByDef.length !== this.defCapacity ||
      snapshot.dirtyQueue.length !== this.capacity ||
      snapshot.dirtyHead >= this.capacity ||
      snapshot.dirtyCount > this.capacity ||
      !isValidStorageSnapshotState(snapshot)
    ) {
      return { ok: false, reason: "storage_snapshot_invalid" };
    }
    for (let slotId = 0; slotId < this.capacity; slotId += 1) {
      const row = snapshot.rows[slotId];
      if (row === undefined) continue;
      this.restoreRow(row);
    }
    for (let index = 0; index < this.stackCapacity; index += 1)
      this.stackToSlot[index] = snapshot.stackToSlot[index] ?? -1;
    for (let index = 0; index < this.defCapacity; index += 1) {
      this.supplyHeadByDef[index] = snapshot.supplyHeadByDef[index] ?? -1;
      this.demandHeadByDef[index] = snapshot.demandHeadByDef[index] ?? -1;
    }
    for (let index = 0; index < this.capacity; index += 1)
      this.dirtyQueue[index] = snapshot.dirtyQueue[index] ?? 0;
    this.indexVersion = snapshot.indexVersion;
    this.activeCount = snapshot.activeCount;
    this.refreshedCount = snapshot.refreshedCount;
    this.indexedSupplyCount = snapshot.indexedSupplyCount;
    this.indexedDemandCount = snapshot.indexedDemandCount;
    this.dirtyHead = snapshot.dirtyHead;
    this.dirtyCount = snapshot.dirtyCount;
    return { ok: true, version: this.indexVersion };
  }

  private snapshotRow(slotId: number): StorageLogisticsSnapshotRow {
    return {
      slotId,
      active: this.active[slotId] ?? 0,
      storageIndex: this.storageIndexes[slotId] ?? 0,
      storageGeneration: this.storageGenerations[slotId] ?? 0,
      stackId: this.stackIds[slotId] ?? 0,
      defId: this.defIds[slotId] ?? 0,
      capacity: this.capacities[slotId] ?? 0,
      desiredQuantity: this.desiredQuantities[slotId] ?? 0,
      interactionCellIndex: this.interactionCellIndexes[slotId] ?? 0,
      offerId: this.offerIds[slotId] ?? 0,
      workType: this.workTypes[slotId] ?? 0,
      regionId: this.regionIds[slotId] ?? 0,
      urgencyBucket: this.urgencyBuckets[slotId] ?? 0,
      permissionId: this.permissionIds[slotId] ?? 0,
      quantity: this.quantities[slotId] ?? 0,
      reservedSupply: this.reservedSupplies[slotId] ?? 0,
      reservedCapacity: this.reservedCapacities[slotId] ?? 0,
      availableSupply: this.availableSupplies[slotId] ?? 0,
      availableCapacity: this.availableCapacities[slotId] ?? 0,
      demandQuantity: this.demandQuantities[slotId] ?? 0,
      offerActive: this.offerActive[slotId] ?? 0,
      rowVersion: this.rowVersions[slotId] ?? 0,
      supplyNext: this.supplyNextBySlot[slotId] ?? -1,
      supplyPrevious: this.supplyPreviousBySlot[slotId] ?? -1,
      demandNext: this.demandNextBySlot[slotId] ?? -1,
      demandPrevious: this.demandPreviousBySlot[slotId] ?? -1,
      supplyLinked: this.supplyLinked[slotId] ?? 0,
      demandLinked: this.demandLinked[slotId] ?? 0,
      dirtyQueued: this.dirtyQueued[slotId] ?? 0,
    };
  }

  private restoreRow(row: StorageLogisticsSnapshotRow): void {
    const id = row.slotId;
    this.active[id] = row.active;
    this.storageIndexes[id] = row.storageIndex;
    this.storageGenerations[id] = row.storageGeneration;
    this.stackIds[id] = row.stackId;
    this.defIds[id] = row.defId;
    this.capacities[id] = row.capacity;
    this.desiredQuantities[id] = row.desiredQuantity;
    this.interactionCellIndexes[id] = row.interactionCellIndex;
    this.offerIds[id] = row.offerId;
    this.workTypes[id] = row.workType;
    this.regionIds[id] = row.regionId;
    this.urgencyBuckets[id] = row.urgencyBucket;
    this.permissionIds[id] = row.permissionId;
    this.quantities[id] = row.quantity;
    this.reservedSupplies[id] = row.reservedSupply;
    this.reservedCapacities[id] = row.reservedCapacity;
    this.availableSupplies[id] = row.availableSupply;
    this.availableCapacities[id] = row.availableCapacity;
    this.demandQuantities[id] = row.demandQuantity;
    this.offerActive[id] = row.offerActive;
    this.rowVersions[id] = row.rowVersion;
    this.supplyNextBySlot[id] = row.supplyNext;
    this.supplyPreviousBySlot[id] = row.supplyPrevious;
    this.demandNextBySlot[id] = row.demandNext;
    this.demandPreviousBySlot[id] = row.demandPrevious;
    this.supplyLinked[id] = row.supplyLinked;
    this.demandLinked[id] = row.demandLinked;
    this.dirtyQueued[id] = row.dirtyQueued;
  }

  private refreshSlot(
    slotId: number,
    items: ItemStackStore,
    ledger: ReservationLedger,
    offers: WorkOfferIndex,
  ): void {
    const stack = items.readStack(this.stackIds[slotId] ?? 0, ledger);
    if (stack === undefined) {
      this.clearDerived(slotId, offers);
      return;
    }

    const storage = {
      index: this.storageIndexes[slotId] ?? 0,
      generation: this.storageGenerations[slotId] ?? 0,
    };
    const quantity = stack.quantity;
    const reservedSupply = stack.reservedQuantity;
    const reservedCapacity = ledger.reservedAmountForCapacity(storage, slotId);
    const capacity = this.capacities[slotId] ?? 0;
    const desired = this.desiredQuantities[slotId] ?? 0;
    const unreservedCapacity =
      capacity > quantity + reservedCapacity ? capacity - quantity - reservedCapacity : 0;
    const remainingDemand =
      desired > quantity + reservedCapacity ? desired - quantity - reservedCapacity : 0;
    const demand = Math.min(unreservedCapacity, remainingDemand);

    this.quantities[slotId] = quantity;
    this.reservedSupplies[slotId] = reservedSupply;
    this.reservedCapacities[slotId] = reservedCapacity;
    this.availableSupplies[slotId] = stack.availableQuantity;
    this.availableCapacities[slotId] = unreservedCapacity;
    this.demandQuantities[slotId] = demand;
    this.syncSupplyOffer(slotId, stack.availableQuantity, offers);
    this.syncCandidateBuckets(slotId);
  }

  private syncSupplyOffer(slotId: number, available: number, offers: WorkOfferIndex): void {
    const active = (this.offerActive[slotId] ?? 0) === 1;
    const offerId = this.offerIds[slotId] ?? 0;

    if (available === 0) {
      if (active) {
        const removed = offers.removeOffer(offerId);
        if (removed.ok) {
          this.offerActive[slotId] = 0;
        }
      }
      return;
    }

    const input = {
      offerId,
      workType: this.workTypes[slotId] ?? 0,
      regionId: this.regionIds[slotId] ?? 0,
      defId: this.defIds[slotId] ?? 0,
      urgencyBucket: this.urgencyBuckets[slotId] ?? 0,
      permissionId: this.permissionIds[slotId] ?? 0,
      targetId: slotId,
      targetCellIndex: this.interactionCellIndexes[slotId] ?? 0,
      scoreMilli: 1_000 + available,
    };
    const changed = active ? offers.updateOffer(input) : offers.registerOffer(input);
    if (changed.ok) {
      this.offerActive[slotId] = 1;
    }
  }

  private clearDerived(slotId: number, offers: WorkOfferIndex): void {
    if ((this.offerActive[slotId] ?? 0) === 1) {
      const removed = offers.removeOffer(this.offerIds[slotId] ?? 0);
      if (removed.ok) {
        this.offerActive[slotId] = 0;
      }
    }

    this.quantities[slotId] = 0;
    this.reservedSupplies[slotId] = 0;
    this.reservedCapacities[slotId] = 0;
    this.availableSupplies[slotId] = 0;
    this.availableCapacities[slotId] = 0;
    this.demandQuantities[slotId] = 0;
    this.unlinkCandidateSlot("supply", slotId);
    this.unlinkCandidateSlot("demand", slotId);
  }

  private selectCandidateSlots(
    kind: CandidateKind,
    defId: number,
    maxSlots: number,
    outputSlotIds: Uint32Array,
  ): StorageCandidateSelectionResult {
    if (!isIndexInRange(defId, this.defCapacity)) {
      return { ok: false, reason: "storage_def_invalid" };
    }

    if (!isSafeUint32(maxSlots) || maxSlots > outputSlotIds.length) {
      return { ok: false, reason: "storage_candidate_buffer_too_small" };
    }

    const nextBySlot = this.readCandidateNext(kind);
    let slotId = this.readCandidateHead(kind, defId);
    let visitedCount = 0;
    let selectedCount = 0;

    while (slotId >= 0 && visitedCount < maxSlots) {
      outputSlotIds[selectedCount] = slotId;
      selectedCount += 1;
      visitedCount += 1;
      slotId = nextBySlot[slotId] ?? -1;
    }

    return {
      ok: true,
      defId,
      visitedCount,
      selectedCount,
      candidateCapHit: slotId >= 0,
      version: this.indexVersion,
    };
  }

  private captureSupplySelection(
    defId: number,
    candidateCap: number,
    scratch: StorageSupplySelectionScratch,
    output: StorageSupplySelectionIntoOutput,
  ): void {
    let slotId = this.supplyHeadByDef[defId] ?? -1;
    let selectedCount = 0;
    for (let index = 0; index < candidateCap && slotId >= 0; index += 1) {
      scratch.slotIds[selectedCount] = slotId;
      scratch.stackIds[selectedCount] = this.stackIds[slotId] ?? 0;
      scratch.rowVersions[selectedCount] = this.rowVersions[slotId] ?? 0;
      scratch.availableSupplies[selectedCount] = this.availableSupplies[slotId] ?? 0;
      scratch.linkedFlags[selectedCount] = this.supplyLinked[slotId] ?? 0;
      selectedCount += 1;
      slotId = this.supplyNextBySlot[slotId] ?? -1;
    }
    output.visitedCount = selectedCount;
    output.selectedCount = selectedCount;
    output.candidateCapHit = slotId >= 0;
  }

  private matchesCapturedSupplySelection(
    defId: number,
    scratch: StorageSupplySelectionScratch,
    selectedCount: number,
  ): boolean {
    for (let index = 0; index < selectedCount; index += 1) {
      const slotId = scratch.slotIds[index] ?? 0;
      const capturedAvailableSupply = scratch.availableSupplies[index] ?? 0;
      const capturedLinked = scratch.linkedFlags[index] ?? 0;
      if (
        (this.active[slotId] ?? 0) !== 1 ||
        (this.defIds[slotId] ?? 0) !== defId ||
        (this.stackIds[slotId] ?? 0) !== (scratch.stackIds[index] ?? 0) ||
        (this.rowVersions[slotId] ?? 0) !== (scratch.rowVersions[index] ?? 0) ||
        capturedAvailableSupply === 0 ||
        (this.availableSupplies[slotId] ?? 0) !== capturedAvailableSupply ||
        capturedLinked !== 1 ||
        (this.supplyLinked[slotId] ?? 0) !== 1
      ) {
        return false;
      }
    }
    return true;
  }

  private syncCandidateBuckets(slotId: number): void {
    this.syncCandidateBucket("supply", slotId, (this.availableSupplies[slotId] ?? 0) > 0);
    this.syncCandidateBucket("demand", slotId, (this.demandQuantities[slotId] ?? 0) > 0);
  }

  private syncCandidateBucket(kind: CandidateKind, slotId: number, shouldBeLinked: boolean): void {
    const linked = this.isCandidateLinked(kind, slotId);

    if (shouldBeLinked) {
      if (!linked) {
        this.linkCandidateSlot(kind, slotId);
      }
      return;
    }

    if (linked) {
      this.unlinkCandidateSlot(kind, slotId);
    }
  }

  private linkCandidateSlot(kind: CandidateKind, slotId: number): void {
    const defId = this.defIds[slotId] ?? 0;
    if (!isIndexInRange(defId, this.defCapacity)) {
      return;
    }

    if (this.isCandidateLinked(kind, slotId)) {
      return;
    }

    const nextBySlot = this.readCandidateNext(kind);
    const previousBySlot = this.readCandidatePrevious(kind);
    const linked = this.readCandidateLinked(kind);
    let current = this.readCandidateHead(kind, defId);
    let previous = -1;

    while (current >= 0 && current < slotId) {
      previous = current;
      current = nextBySlot[current] ?? -1;
    }

    previousBySlot[slotId] = previous;
    nextBySlot[slotId] = current;

    if (previous >= 0) {
      nextBySlot[previous] = slotId;
    } else {
      this.writeCandidateHead(kind, defId, slotId);
    }

    if (current >= 0) {
      previousBySlot[current] = slotId;
    }

    linked[slotId] = 1;
    this.incrementIndexedCount(kind, 1);
  }

  private unlinkCandidateSlot(kind: CandidateKind, slotId: number): void {
    if (!this.isCandidateLinked(kind, slotId)) {
      return;
    }

    const nextBySlot = this.readCandidateNext(kind);
    const previousBySlot = this.readCandidatePrevious(kind);
    const linked = this.readCandidateLinked(kind);
    const defId = this.defIds[slotId] ?? 0;
    const previous = previousBySlot[slotId] ?? -1;
    const next = nextBySlot[slotId] ?? -1;

    if (previous >= 0) {
      nextBySlot[previous] = next;
    } else if (isIndexInRange(defId, this.defCapacity)) {
      this.writeCandidateHead(kind, defId, next);
    }

    if (next >= 0) {
      previousBySlot[next] = previous;
    }

    linked[slotId] = 0;
    nextBySlot[slotId] = -1;
    previousBySlot[slotId] = -1;
    this.incrementIndexedCount(kind, -1);
  }

  private readCandidateHead(kind: CandidateKind, defId: number): number {
    return kind === "supply"
      ? (this.supplyHeadByDef[defId] ?? -1)
      : (this.demandHeadByDef[defId] ?? -1);
  }

  private writeCandidateHead(kind: CandidateKind, defId: number, slotId: number): void {
    if (kind === "supply") {
      this.supplyHeadByDef[defId] = slotId;
    } else {
      this.demandHeadByDef[defId] = slotId;
    }
  }

  private readCandidateNext(kind: CandidateKind): Int32Array {
    return kind === "supply" ? this.supplyNextBySlot : this.demandNextBySlot;
  }

  private readCandidatePrevious(kind: CandidateKind): Int32Array {
    return kind === "supply" ? this.supplyPreviousBySlot : this.demandPreviousBySlot;
  }

  private readCandidateLinked(kind: CandidateKind): Uint8Array {
    return kind === "supply" ? this.supplyLinked : this.demandLinked;
  }

  private isCandidateLinked(kind: CandidateKind, slotId: number): boolean {
    return (this.readCandidateLinked(kind)[slotId] ?? 0) === 1;
  }

  private incrementIndexedCount(kind: CandidateKind, delta: 1 | -1): void {
    if (kind === "supply") {
      this.indexedSupplyCount += delta;
    } else {
      this.indexedDemandCount += delta;
    }
  }

  private validateInput(
    input: StorageSlotInput,
    registry: EntityRegistry | undefined,
  ): StorageLogisticsMutationResult {
    if (!isIndexInRange(input.slotId, this.capacity)) {
      return { ok: false, reason: "storage_slot_id_out_of_range" };
    }

    if (!isIndexInRange(input.stackId, this.stackCapacity)) {
      return { ok: false, reason: "storage_stack_invalid" };
    }

    if (
      !isSafeUint32(input.storage.index) ||
      !isPositiveUint32(input.storage.generation) ||
      (registry !== undefined && !registry.isAlive(input.storage))
    ) {
      return { ok: false, reason: "storage_entity_invalid" };
    }

    if (!isIndexInRange(input.defId, this.defCapacity)) {
      return { ok: false, reason: "storage_def_invalid" };
    }

    if (
      !isPositiveUint32(input.capacity) ||
      !isSafeUint32(input.desiredQuantity) ||
      input.desiredQuantity > input.capacity
    ) {
      return { ok: false, reason: "storage_capacity_invalid" };
    }

    if (!isSafeUint32(input.interactionCellIndex)) {
      return { ok: false, reason: "storage_interaction_cell_invalid" };
    }

    if (!isSafeUint32(input.offerId)) {
      return { ok: false, reason: "storage_offer_invalid" };
    }

    if (
      !isSafeUint32(input.workType) ||
      !isSafeUint32(input.regionId) ||
      !isSafeUint32(input.urgencyBucket) ||
      !isSafeUint32(input.permissionId)
    ) {
      return { ok: false, reason: "storage_offer_invalid" };
    }

    return { ok: true, version: this.indexVersion };
  }

  private isActiveSlot(slotId: number): boolean {
    return isIndexInRange(slotId, this.capacity) && (this.active[slotId] ?? 0) === 1;
  }

  private validateRefreshBatch(batchCount: number): StorageLogisticsReason | undefined {
    if (batchCount === 0) return undefined;
    if (this.indexVersion === 0xffff_ffff || batchCount > 0xffff_ffff - this.refreshedCount) {
      return "storage_version_exhausted";
    }
    for (let offset = 0; offset < batchCount; offset += 1) {
      const queueIndex = (this.dirtyHead + offset) % this.capacity;
      const slotId = this.dirtyQueue[queueIndex] ?? this.capacity;
      if (
        !this.isActiveSlot(slotId) ||
        (this.dirtyQueued[slotId] ?? 0) !== 1 ||
        (this.rowVersions[slotId] ?? 0) === 0xffff_ffff ||
        (this.refreshSeen[slotId] ?? 0) === 1
      ) {
        this.clearRefreshSeen(offset);
        return (this.rowVersions[slotId] ?? 0) === 0xffff_ffff
          ? "storage_version_exhausted"
          : "storage_dirty_basis_mismatch";
      }
      this.refreshSeen[slotId] = 1;
    }
    this.clearRefreshSeen(batchCount);
    return undefined;
  }

  private clearRefreshSeen(count: number): void {
    for (let offset = 0; offset < count; offset += 1) {
      const queueIndex = (this.dirtyHead + offset) % this.capacity;
      const slotId = this.dirtyQueue[queueIndex] ?? this.capacity;
      if (slotId < this.capacity) this.refreshSeen[slotId] = 0;
    }
  }

  private createRefreshResult(
    ok: boolean,
    reason: StorageLogisticsReason | undefined,
    refreshedCount: number,
  ): StorageLogisticsRefreshResult {
    const metrics = this.createMetrics();
    return { ok, reason, refreshedCount, ...metrics };
  }
}

function resetStorageSlotInto(
  slotId: number,
  indexVersion: number,
  dirtyBacklog: number,
  output: StorageSlotIntoOutput,
): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.slotId = slotId;
  output.storageIndex = 0;
  output.storageGeneration = 0;
  output.stackId = 0;
  output.defId = 0;
  output.capacity = 0;
  output.desiredQuantity = 0;
  output.interactionCellIndex = 0;
  output.offerId = 0;
  output.workType = 0;
  output.regionId = 0;
  output.urgencyBucket = 0;
  output.permissionId = 0;
  output.quantity = 0;
  output.reservedSupply = 0;
  output.reservedCapacity = 0;
  output.availableSupply = 0;
  output.availableCapacity = 0;
  output.demandQuantity = 0;
  output.offerActive = false;
  output.rowVersion = 0;
  output.indexVersion = indexVersion;
  output.dirtyBacklog = dirtyBacklog;
  output.dirtyQueued = false;
  output.dirtyHead = 0;
  output.dirtyCapacity = 0;
  output.dirtyQueueIndex = 0;
}

function resetPreparedStorageDirty(output: PreparedStorageSlotDirty): void {
  output.ok = false;
  output.reason = undefined;
  output.slotId = 0;
  output.alreadyQueued = false;
  output.queueIndex = 0;
  output.rowVersion = 0;
  output.indexVersion = 0;
  output.previousDirtyBacklog = 0;
  output.nextDirtyBacklog = 0;
  output.previousDirtyHead = 0;
  output.nextDirtyHead = 0;
  output.dirtyCapacity = 0;
}

function isValidStorageDirtyPrepareInput(
  input: StorageSlotDirtyPrepareInput,
  capacity: number,
): boolean {
  return (
    isSafeUint32(input.expectedRowVersion) &&
    isSafeUint32(input.expectedIndexVersion) &&
    isSafeUint32(input.expectedDirtyBacklog) &&
    input.expectedDirtyBacklog <= capacity &&
    typeof input.expectedDirtyQueued === "boolean" &&
    isSafeUint32(input.expectedDirtyHead) &&
    input.expectedDirtyHead < capacity &&
    input.expectedDirtyCapacity === capacity &&
    isSafeUint32(input.expectedDirtyQueueIndex) &&
    input.expectedDirtyQueueIndex < capacity
  );
}

export function commitPreparedStorageDirtyAppend(
  index: StorageLogisticsIndex,
  prepared: PreparedStorageSlotDirty,
): void {
  index[STORAGE_DIRTY_APPEND_COMMIT](prepared);
}

export function commitPreparedStorageDirtyCoalesce(
  index: StorageLogisticsIndex,
  prepared: PreparedStorageSlotDirty,
): void {
  index[STORAGE_DIRTY_COALESCE_COMMIT](prepared);
}

export function createStorageLogisticsIndex(
  capacity: number,
  stackCapacity: number,
  defCapacity?: number,
): StorageLogisticsIndex {
  return new StorageLogisticsIndex(capacity, stackCapacity, defCapacity);
}

export function restoreStorageLogisticsIndex(
  snapshot: StorageLogisticsSnapshotInput,
): StorageLogisticsIndex {
  const index = createStorageLogisticsIndex(
    snapshot.capacity,
    snapshot.stackCapacity,
    snapshot.defCapacity,
  );
  const restored = index.restoreFromSnapshot(snapshot);
  if (!restored.ok) throw new Error(restored.reason);
  return index;
}

export function createStorageLogisticsHashFields(
  snapshot: StorageLogisticsSnapshotInput,
  prefix = "storage",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.stackCapacity`, value: snapshot.stackCapacity },
    { name: `${prefix}.defCapacity`, value: snapshot.defCapacity },
    { name: `${prefix}.indexVersion`, value: snapshot.indexVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
    { name: `${prefix}.refreshedCount`, value: snapshot.refreshedCount },
    { name: `${prefix}.indexedSupplyCount`, value: snapshot.indexedSupplyCount },
    { name: `${prefix}.indexedDemandCount`, value: snapshot.indexedDemandCount },
    { name: `${prefix}.dirtyHead`, value: snapshot.dirtyHead },
    { name: `${prefix}.dirtyCount`, value: snapshot.dirtyCount },
  ];
  appendNumberArrayHash(fields, `${prefix}.stackToSlot`, snapshot.stackToSlot);
  appendNumberArrayHash(fields, `${prefix}.supplyHead`, snapshot.supplyHeadByDef);
  appendNumberArrayHash(fields, `${prefix}.demandHead`, snapshot.demandHeadByDef);
  appendNumberArrayHash(fields, `${prefix}.dirtyQueue`, snapshot.dirtyQueue);
  for (let index = 0; index < snapshot.rows.length; index += 1) {
    const row = snapshot.rows[index];
    if (row === undefined) continue;
    const p = `${prefix}.row.${String(index)}`;
    for (const [name, value] of storageRowHashEntries(row))
      fields.push({ name: `${p}.${name}`, value });
  }
  return fields;
}

function appendNumberArrayHash(
  fields: CanonicalWorldField[],
  prefix: string,
  values: readonly number[],
): void {
  for (let index = 0; index < values.length; index += 1) {
    fields.push({ name: `${prefix}.${String(index)}`, value: values[index] ?? -1 });
  }
}

function storageRowHashEntries(
  row: StorageLogisticsSnapshotRow,
): readonly (readonly [string, number])[] {
  return [
    ["slotId", row.slotId],
    ["active", row.active],
    ["storageIndex", row.storageIndex],
    ["storageGeneration", row.storageGeneration],
    ["stackId", row.stackId],
    ["defId", row.defId],
    ["capacity", row.capacity],
    ["desiredQuantity", row.desiredQuantity],
    ["interactionCellIndex", row.interactionCellIndex],
    ["offerId", row.offerId],
    ["workType", row.workType],
    ["regionId", row.regionId],
    ["urgencyBucket", row.urgencyBucket],
    ["permissionId", row.permissionId],
    ["quantity", row.quantity],
    ["reservedSupply", row.reservedSupply],
    ["reservedCapacity", row.reservedCapacity],
    ["availableSupply", row.availableSupply],
    ["availableCapacity", row.availableCapacity],
    ["demandQuantity", row.demandQuantity],
    ["offerActive", row.offerActive],
    ["rowVersion", row.rowVersion],
    ["supplyNext", row.supplyNext],
    ["supplyPrevious", row.supplyPrevious],
    ["demandNext", row.demandNext],
    ["demandPrevious", row.demandPrevious],
    ["supplyLinked", row.supplyLinked],
    ["demandLinked", row.demandLinked],
    ["dirtyQueued", row.dirtyQueued],
  ];
}

const STORAGE_SNAPSHOT_KEYS = [
  "snapshotVersion",
  "capacity",
  "stackCapacity",
  "defCapacity",
  "indexVersion",
  "activeCount",
  "refreshedCount",
  "indexedSupplyCount",
  "indexedDemandCount",
  "dirtyHead",
  "dirtyCount",
  "stackToSlot",
  "supplyHeadByDef",
  "demandHeadByDef",
  "dirtyQueue",
  "rows",
] as const;
const STORAGE_ROW_KEYS = [
  "slotId",
  "active",
  "storageIndex",
  "storageGeneration",
  "stackId",
  "defId",
  "capacity",
  "desiredQuantity",
  "interactionCellIndex",
  "offerId",
  "workType",
  "regionId",
  "urgencyBucket",
  "permissionId",
  "quantity",
  "reservedSupply",
  "reservedCapacity",
  "availableSupply",
  "availableCapacity",
  "demandQuantity",
  "offerActive",
  "rowVersion",
  "supplyNext",
  "supplyPrevious",
  "demandNext",
  "demandPrevious",
  "supplyLinked",
  "demandLinked",
  "dirtyQueued",
] as const;

function isStorageSnapshot(value: unknown): value is StorageLogisticsSnapshotInput {
  if (!hasExactStorageKeys(value, STORAGE_SNAPSHOT_KEYS)) return false;
  const rows = value["rows"];
  const stack = value["stackToSlot"];
  const supply = value["supplyHeadByDef"];
  const demand = value["demandHeadByDef"];
  const dirty = value["dirtyQueue"];
  return (
    value["snapshotVersion"] === STORAGE_LOGISTICS_SNAPSHOT_VERSION &&
    isUint(value["capacity"]) &&
    isUint(value["stackCapacity"]) &&
    isUint(value["defCapacity"]) &&
    isUint(value["indexVersion"]) &&
    isUint(value["activeCount"]) &&
    isUint(value["refreshedCount"]) &&
    isUint(value["indexedSupplyCount"]) &&
    isUint(value["indexedDemandCount"]) &&
    isUint(value["dirtyHead"]) &&
    isUint(value["dirtyCount"]) &&
    isDenseStorageArray(rows) &&
    rows.every(isStorageSnapshotRow) &&
    isDenseStorageArray(stack) &&
    stack.every(isSignedIndex) &&
    isDenseStorageArray(supply) &&
    supply.every(isSignedIndex) &&
    isDenseStorageArray(demand) &&
    demand.every(isSignedIndex) &&
    isDenseStorageArray(dirty) &&
    dirty.every(isUint)
  );
}

function isStorageSnapshotRow(value: unknown): value is StorageLogisticsSnapshotRow {
  if (!hasExactStorageKeys(value, STORAGE_ROW_KEYS)) return false;
  for (const key of [
    "slotId",
    "storageIndex",
    "storageGeneration",
    "stackId",
    "defId",
    "capacity",
    "desiredQuantity",
    "interactionCellIndex",
    "offerId",
    "workType",
    "regionId",
    "urgencyBucket",
    "permissionId",
    "quantity",
    "reservedSupply",
    "reservedCapacity",
    "availableSupply",
    "availableCapacity",
    "demandQuantity",
    "rowVersion",
  ] as const)
    if (!isUint(value[key])) return false;
  return (
    isBit(value["active"]) &&
    isBit(value["offerActive"]) &&
    isBit(value["supplyLinked"]) &&
    isBit(value["demandLinked"]) &&
    isBit(value["dirtyQueued"]) &&
    isSignedIndex(value["supplyNext"]) &&
    isSignedIndex(value["supplyPrevious"]) &&
    isSignedIndex(value["demandNext"]) &&
    isSignedIndex(value["demandPrevious"])
  );
}

function isValidStorageSnapshotState(snapshot: StorageLogisticsSnapshotInput): boolean {
  if (
    snapshot.capacity === 0 ||
    snapshot.stackCapacity === 0 ||
    snapshot.defCapacity === 0 ||
    snapshot.dirtyHead >= snapshot.capacity ||
    snapshot.dirtyCount > snapshot.capacity ||
    snapshot.activeCount > snapshot.indexVersion ||
    snapshot.indexVersion - snapshot.activeCount > snapshot.refreshedCount
  ) {
    return false;
  }
  const seenStacks = new Uint8Array(snapshot.stackCapacity);
  const refreshBatchCount = snapshot.indexVersion - snapshot.activeCount;
  let activeCount = 0;
  let dirtyCount = 0;
  let refreshedCount = 0;
  let maximumRowRefreshCount = 0;
  for (let slotId = 0; slotId < snapshot.capacity; slotId += 1) {
    const row = snapshot.rows[slotId];
    if (row?.slotId !== slotId) return false;
    if (row.active === 0) {
      if (!isCanonicalInactiveStorageRow(row)) return false;
      continue;
    }
    if (!isValidActiveStorageRow(row, snapshot)) return false;
    if (seenStacks[row.stackId] === 1 || snapshot.stackToSlot[row.stackId] !== slotId) {
      return false;
    }
    seenStacks[row.stackId] = 1;
    activeCount += 1;
    dirtyCount += row.dirtyQueued;
    const rowRefreshes = row.rowVersion - 1;
    if (rowRefreshes > 0xffff_ffff - refreshedCount) return false;
    refreshedCount += rowRefreshes;
    if (rowRefreshes > maximumRowRefreshCount) maximumRowRefreshCount = rowRefreshes;
  }
  if (
    activeCount !== snapshot.activeCount ||
    dirtyCount !== snapshot.dirtyCount ||
    refreshedCount !== snapshot.refreshedCount ||
    maximumRowRefreshCount > refreshBatchCount ||
    refreshBatchCount > snapshot.refreshedCount ||
    snapshot.dirtyHead !== snapshot.refreshedCount % snapshot.capacity ||
    !hasExactStorageStackReverse(snapshot, seenStacks) ||
    !hasExactStorageCandidateChains(snapshot, "supply") ||
    !hasExactStorageCandidateChains(snapshot, "demand") ||
    !hasExactStorageDirtyQueue(snapshot)
  ) {
    return false;
  }
  return true;
}

function isCanonicalInactiveStorageRow(row: StorageLogisticsSnapshotRow): boolean {
  return (
    row.storageIndex === 0 &&
    row.storageGeneration === 0 &&
    row.stackId === 0 &&
    row.defId === 0 &&
    row.capacity === 0 &&
    row.desiredQuantity === 0 &&
    row.interactionCellIndex === 0 &&
    row.offerId === 0 &&
    row.workType === 0 &&
    row.regionId === 0 &&
    row.urgencyBucket === 0 &&
    row.permissionId === 0 &&
    row.quantity === 0 &&
    row.reservedSupply === 0 &&
    row.reservedCapacity === 0 &&
    row.availableSupply === 0 &&
    row.availableCapacity === 0 &&
    row.demandQuantity === 0 &&
    row.offerActive === 0 &&
    row.rowVersion === 0 &&
    row.supplyNext === -1 &&
    row.supplyPrevious === -1 &&
    row.demandNext === -1 &&
    row.demandPrevious === -1 &&
    row.supplyLinked === 0 &&
    row.demandLinked === 0 &&
    row.dirtyQueued === 0
  );
}

function isValidActiveStorageRow(
  row: StorageLogisticsSnapshotRow,
  snapshot: StorageLogisticsSnapshotInput,
): boolean {
  if (
    row.storageGeneration === 0 ||
    row.stackId >= snapshot.stackCapacity ||
    row.defId >= snapshot.defCapacity ||
    row.capacity === 0 ||
    row.desiredQuantity > row.capacity ||
    row.rowVersion === 0 ||
    row.rowVersion > snapshot.indexVersion ||
    row.reservedSupply > row.quantity
  ) {
    return false;
  }
  if (
    row.rowVersion > 1 &&
    row.quantity === 0 &&
    row.reservedSupply === 0 &&
    row.reservedCapacity === 0 &&
    row.availableSupply === 0 &&
    row.availableCapacity === 0 &&
    row.demandQuantity === 0 &&
    row.supplyLinked === 0 &&
    row.demandLinked === 0
  ) {
    return true;
  }
  const availableSupply = row.quantity - row.reservedSupply;
  const availableCapacity =
    row.capacity > row.quantity + row.reservedCapacity
      ? row.capacity - row.quantity - row.reservedCapacity
      : 0;
  const demandAfterItems =
    row.desiredQuantity > row.quantity + row.reservedCapacity
      ? row.desiredQuantity - row.quantity - row.reservedCapacity
      : 0;
  const demandQuantity = Math.min(availableCapacity, demandAfterItems);
  return (
    row.availableSupply === availableSupply &&
    row.availableCapacity === availableCapacity &&
    row.demandQuantity === demandQuantity &&
    row.supplyLinked === (availableSupply > 0 ? 1 : 0) &&
    row.demandLinked === (demandQuantity > 0 ? 1 : 0)
  );
}

function hasExactStorageStackReverse(
  snapshot: StorageLogisticsSnapshotInput,
  seenStacks: Uint8Array,
): boolean {
  for (let stackId = 0; stackId < snapshot.stackCapacity; stackId += 1) {
    const slotId = snapshot.stackToSlot[stackId] ?? -1;
    if (slotId === -1) {
      if (seenStacks[stackId] !== 0) return false;
      continue;
    }
    const row = snapshot.rows[slotId];
    if (
      slotId >= snapshot.capacity ||
      row?.active !== 1 ||
      row.stackId !== stackId ||
      seenStacks[stackId] !== 1
    ) {
      return false;
    }
  }
  return true;
}

function hasExactStorageCandidateChains(
  snapshot: StorageLogisticsSnapshotInput,
  kind: CandidateKind,
): boolean {
  const seen = new Uint8Array(snapshot.capacity);
  let visitedCount = 0;
  for (let defId = 0; defId < snapshot.defCapacity; defId += 1) {
    let previous = -1;
    let slotId = readSnapshotCandidateHead(snapshot, kind, defId);
    while (slotId >= 0) {
      if (slotId >= snapshot.capacity || seen[slotId] === 1 || slotId <= previous) return false;
      const row = snapshot.rows[slotId];
      if (
        row?.active !== 1 ||
        row.defId !== defId ||
        readSnapshotCandidateLinked(row, kind) !== 1 ||
        readSnapshotCandidatePrevious(row, kind) !== previous
      ) {
        return false;
      }
      seen[slotId] = 1;
      visitedCount += 1;
      previous = slotId;
      slotId = readSnapshotCandidateNext(row, kind);
    }
  }
  const expectedCount =
    kind === "supply" ? snapshot.indexedSupplyCount : snapshot.indexedDemandCount;
  if (visitedCount !== expectedCount) return false;
  for (let slotId = 0; slotId < snapshot.capacity; slotId += 1) {
    const row = snapshot.rows[slotId];
    if (row === undefined) return false;
    const linked = readSnapshotCandidateLinked(row, kind);
    if (linked !== seen[slotId]) return false;
    if (linked === 0) {
      if (
        readSnapshotCandidateNext(row, kind) !== -1 ||
        readSnapshotCandidatePrevious(row, kind) !== -1
      ) {
        return false;
      }
    }
  }
  return true;
}

function readSnapshotCandidateHead(
  snapshot: StorageLogisticsSnapshotInput,
  kind: CandidateKind,
  defId: number,
): number {
  return kind === "supply"
    ? (snapshot.supplyHeadByDef[defId] ?? -1)
    : (snapshot.demandHeadByDef[defId] ?? -1);
}

function readSnapshotCandidateNext(row: StorageLogisticsSnapshotRow, kind: CandidateKind): number {
  return kind === "supply" ? row.supplyNext : row.demandNext;
}

function readSnapshotCandidatePrevious(
  row: StorageLogisticsSnapshotRow,
  kind: CandidateKind,
): number {
  return kind === "supply" ? row.supplyPrevious : row.demandPrevious;
}

function readSnapshotCandidateLinked(
  row: StorageLogisticsSnapshotRow,
  kind: CandidateKind,
): number {
  return kind === "supply" ? row.supplyLinked : row.demandLinked;
}

function hasExactStorageDirtyQueue(snapshot: StorageLogisticsSnapshotInput): boolean {
  const seen = new Uint8Array(snapshot.capacity);
  for (let physical = 0; physical < snapshot.capacity; physical += 1) {
    const slotId = snapshot.dirtyQueue[physical];
    if (slotId === undefined || slotId >= snapshot.capacity) return false;
  }
  for (let offset = 0; offset < snapshot.dirtyCount; offset += 1) {
    const queueIndex = (snapshot.dirtyHead + offset) % snapshot.capacity;
    const slotId = snapshot.dirtyQueue[queueIndex];
    if (slotId === undefined || seen[slotId] === 1) return false;
    const row = snapshot.rows[slotId];
    if (row?.active !== 1 || row.dirtyQueued !== 1) return false;
    seen[slotId] = 1;
  }
  for (let slotId = 0; slotId < snapshot.capacity; slotId += 1) {
    const row = snapshot.rows[slotId];
    if (row === undefined || row.dirtyQueued !== seen[slotId]) return false;
  }
  return true;
}

function hasExactStorageKeys(
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
function isDenseStorageArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) if (!(index in value)) return false;
  return true;
}
function isUint(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff
  );
}
function isSignedIndex(value: unknown): value is number {
  return value === -1 || isUint(value);
}
function isBit(value: unknown): value is number {
  return value === 0 || value === 1;
}

function resetSupplySelection(
  defId: number,
  candidateCap: number,
  indexVersion: number,
  dirtyBacklog: number,
  scratch: StorageSupplySelectionScratch,
  output: StorageSupplySelectionIntoOutput,
): void {
  clearSupplySelectionLanes(scratch);
  output.ok = false;
  output.reason = undefined;
  output.queryDefId = defId;
  output.candidateCap = candidateCap;
  output.visitedCount = 0;
  output.selectedCount = 0;
  output.candidateCapHit = false;
  output.indexVersion = indexVersion;
  output.dirtyBacklog = dirtyBacklog;
}

function clearSupplySelectionLanes(scratch: StorageSupplySelectionScratch): void {
  for (let index = 0; index < STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES; index += 1) {
    scratch.slotIds[index] = 0;
    scratch.stackIds[index] = 0;
    scratch.rowVersions[index] = 0;
    scratch.availableSupplies[index] = 0;
    scratch.linkedFlags[index] = 0;
  }
}

function hasValidSupplySelectionShape(
  candidateCap: number,
  scratch: StorageSupplySelectionScratch,
): boolean {
  return (
    Number.isSafeInteger(candidateCap) &&
    candidateCap > 0 &&
    candidateCap <= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    scratch.slotIds.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    scratch.stackIds.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    scratch.rowVersions.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    scratch.availableSupplies.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    scratch.linkedFlags.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES
  );
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isSafeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}
