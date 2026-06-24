import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { ReservationLedger } from "./reservation-ledger";

export const ITEM_STACK_SNAPSHOT_VERSION = 1;

export type ItemStackReason =
  | "item_stack_id_out_of_range"
  | "item_stack_already_active"
  | "item_stack_not_active"
  | "item_stack_entity_invalid"
  | "item_stack_def_invalid"
  | "item_stack_quantity_invalid"
  | "item_stack_capacity_invalid"
  | "item_stack_quantity_underflow"
  | "item_stack_capacity_exceeded"
  | "item_stack_def_mismatch";

export type ItemStackMutationResult =
  | { readonly ok: true; readonly stackId: number; readonly version: number }
  | { readonly ok: false; readonly reason: ItemStackReason };

export interface ItemStackCreateInput {
  readonly stackId: number;
  readonly entity: EntityId;
  readonly defId: number;
  readonly quantity: number;
  readonly capacity: number;
}

export interface ItemStackView extends ItemStackCreateInput {
  readonly reservedQuantity: number;
  readonly availableQuantity: number;
}

export interface ItemStackMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly totalQuantity: number;
}

export class ItemStackStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly entityIndexes: Uint32Array;
  private readonly entityGenerations: Uint32Array;
  private readonly defIds: Uint32Array;
  private readonly quantities: Uint32Array;
  private readonly capacities: Uint32Array;
  private activeCount = 0;
  private storeVersion = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "item stack capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.entityIndexes = new Uint32Array(capacity);
    this.entityGenerations = new Uint32Array(capacity);
    this.defIds = new Uint32Array(capacity);
    this.quantities = new Uint32Array(capacity);
    this.capacities = new Uint32Array(capacity);
  }

  get version(): number {
    return this.storeVersion;
  }

  get stackCount(): number {
    return this.activeCount;
  }

  createStack(input: ItemStackCreateInput, registry?: EntityRegistry): ItemStackMutationResult {
    const validation = this.validateCreate(input, registry);

    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.stackId] ?? 0) === 1) {
      return { ok: false, reason: "item_stack_already_active" };
    }

    this.active[input.stackId] = 1;
    this.entityIndexes[input.stackId] = input.entity.index;
    this.entityGenerations[input.stackId] = input.entity.generation;
    this.defIds[input.stackId] = input.defId;
    this.quantities[input.stackId] = input.quantity;
    this.capacities[input.stackId] = input.capacity;
    this.activeCount += 1;
    return this.finish(input.stackId);
  }

  addQuantity(stackId: number, amount: number, expectedDefId?: number): ItemStackMutationResult {
    const validation = this.validateQuantityMutation(stackId, amount, expectedDefId);

    if (!validation.ok) {
      return validation;
    }

    const next = (this.quantities[stackId] ?? 0) + amount;
    if (next > (this.capacities[stackId] ?? 0)) {
      return { ok: false, reason: "item_stack_capacity_exceeded" };
    }

    this.quantities[stackId] = next;
    return this.finish(stackId);
  }

  removeQuantity(stackId: number, amount: number, expectedDefId?: number): ItemStackMutationResult {
    const validation = this.validateQuantityMutation(stackId, amount, expectedDefId);

    if (!validation.ok) {
      return validation;
    }

    const current = this.quantities[stackId] ?? 0;
    if (amount > current) {
      return { ok: false, reason: "item_stack_quantity_underflow" };
    }

    this.quantities[stackId] = current - amount;
    return this.finish(stackId);
  }

  transferQuantity(
    sourceStackId: number,
    destinationStackId: number,
    amount: number,
  ): ItemStackMutationResult {
    const source = this.readStack(sourceStackId);
    const destination = this.readStack(destinationStackId);

    if (source === undefined || destination === undefined) {
      return { ok: false, reason: "item_stack_not_active" };
    }

    if (source.defId !== destination.defId) {
      return { ok: false, reason: "item_stack_def_mismatch" };
    }

    const removed = this.removeQuantity(sourceStackId, amount, source.defId);
    if (!removed.ok) {
      return removed;
    }

    const added = this.addQuantity(destinationStackId, amount, source.defId);
    if (!added.ok) {
      const restored = this.addQuantity(sourceStackId, amount, source.defId);
      if (!restored.ok) {
        throw new Error(`failed to restore item transfer: ${restored.reason}`);
      }
      return added;
    }

    return added;
  }

  readStack(stackId: number, ledger?: ReservationLedger): ItemStackView | undefined {
    if (!this.isActiveStackId(stackId)) {
      return undefined;
    }

    const entity = this.readEntity(stackId);
    const quantity = this.quantities[stackId] ?? 0;
    const reservedQuantity = ledger?.reservedAmountForItem(entity) ?? 0;
    const availableQuantity = quantity > reservedQuantity ? quantity - reservedQuantity : 0;
    return {
      stackId,
      entity,
      defId: this.defIds[stackId] ?? 0,
      quantity,
      capacity: this.capacities[stackId] ?? 0,
      reservedQuantity,
      availableQuantity,
    };
  }

  createMetrics(): ItemStackMetrics {
    let totalQuantity = 0;

    for (let stackId = 0; stackId < this.capacity; stackId += 1) {
      if ((this.active[stackId] ?? 0) === 1) {
        totalQuantity += this.quantities[stackId] ?? 0;
      }
    }

    return {
      version: this.storeVersion,
      activeCount: this.activeCount,
      totalQuantity,
    };
  }

  private validateCreate(
    input: ItemStackCreateInput,
    registry: EntityRegistry | undefined,
  ): ItemStackMutationResult {
    if (!isIndexInRange(input.stackId, this.capacity)) {
      return { ok: false, reason: "item_stack_id_out_of_range" };
    }

    if (!isSafeUint32(input.entity.index) || !isSafeUint32(input.entity.generation)) {
      return { ok: false, reason: "item_stack_entity_invalid" };
    }

    if (registry !== undefined && !registry.isAlive(input.entity)) {
      return { ok: false, reason: "item_stack_entity_invalid" };
    }

    if (!isSafeUint32(input.defId)) {
      return { ok: false, reason: "item_stack_def_invalid" };
    }

    if (!isSafeUint32(input.quantity)) {
      return { ok: false, reason: "item_stack_quantity_invalid" };
    }

    if (!isPositiveUint32(input.capacity) || input.quantity > input.capacity) {
      return { ok: false, reason: "item_stack_capacity_invalid" };
    }

    return { ok: true, stackId: input.stackId, version: this.storeVersion };
  }

  private validateQuantityMutation(
    stackId: number,
    amount: number,
    expectedDefId: number | undefined,
  ): ItemStackMutationResult {
    if (!this.isActiveStackId(stackId)) {
      return { ok: false, reason: "item_stack_not_active" };
    }

    if (!isPositiveUint32(amount)) {
      return { ok: false, reason: "item_stack_quantity_invalid" };
    }

    if (expectedDefId !== undefined && (this.defIds[stackId] ?? 0) !== expectedDefId) {
      return { ok: false, reason: "item_stack_def_mismatch" };
    }

    return { ok: true, stackId, version: this.storeVersion };
  }

  private isActiveStackId(stackId: number): boolean {
    return isIndexInRange(stackId, this.capacity) && (this.active[stackId] ?? 0) === 1;
  }

  private readEntity(stackId: number): EntityId {
    return {
      index: this.entityIndexes[stackId] ?? 0,
      generation: this.entityGenerations[stackId] ?? 0,
    };
  }

  private finish(stackId: number): ItemStackMutationResult {
    this.storeVersion += 1;
    return { ok: true, stackId, version: this.storeVersion };
  }
}

export function createItemStackStore(capacity: number): ItemStackStore {
  return new ItemStackStore(capacity);
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
