import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { ItemStackStore } from "./item-stack-store";
import type { ReservationLedger } from "./reservation-ledger";
import type { WorkOfferIndex } from "./work-offers";

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
  | "storage_candidate_buffer_too_small";

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
    this.activeCount += 1;
    this.markSlotDirty(input.slotId);
    return this.finish();
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

  refreshDirty(
    items: ItemStackStore,
    ledger: ReservationLedger,
    offers: WorkOfferIndex,
    budget: number,
  ): StorageLogisticsMetrics {
    let refreshed = 0;

    while (this.dirtyCount > 0 && refreshed < budget) {
      const slotId = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.capacity;
      this.dirtyCount -= 1;
      this.dirtyQueued[slotId] = 0;
      this.refreshSlot(slotId, items, ledger, offers);
      refreshed += 1;
    }

    if (refreshed > 0) {
      this.indexVersion += 1;
      this.refreshedCount += refreshed;
    }

    return this.createMetrics();
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
    };
  }

  selectSupplySlots(
    defId: number,
    maxSlots: number,
    outputSlotIds: Uint32Array,
  ): StorageCandidateSelectionResult {
    return this.selectCandidateSlots("supply", defId, maxSlots, outputSlotIds);
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

    if (registry !== undefined && !registry.isAlive(input.storage)) {
      return { ok: false, reason: "storage_entity_invalid" };
    }

    if (!isSafeUint32(input.defId)) {
      return { ok: false, reason: "storage_def_invalid" };
    }

    if (!isPositiveUint32(input.capacity) || input.desiredQuantity > input.capacity) {
      return { ok: false, reason: "storage_capacity_invalid" };
    }

    if (!isSafeUint32(input.interactionCellIndex)) {
      return { ok: false, reason: "storage_interaction_cell_invalid" };
    }

    if (!isSafeUint32(input.offerId)) {
      return { ok: false, reason: "storage_offer_invalid" };
    }

    return { ok: true, version: this.indexVersion };
  }

  private isActiveSlot(slotId: number): boolean {
    return isIndexInRange(slotId, this.capacity) && (this.active[slotId] ?? 0) === 1;
  }

  private finish(): StorageLogisticsMutationResult {
    this.indexVersion += 1;
    return { ok: true, version: this.indexVersion };
  }
}

export function createStorageLogisticsIndex(
  capacity: number,
  stackCapacity: number,
  defCapacity?: number,
): StorageLogisticsIndex {
  return new StorageLogisticsIndex(capacity, stackCapacity, defCapacity);
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
