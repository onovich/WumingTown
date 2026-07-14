import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { ReservationLedger } from "./reservation-ledger";
import type { CanonicalWorldField } from "./world-hash";

export const ITEM_STACK_SNAPSHOT_VERSION = 2;

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
  | "item_stack_def_mismatch"
  | "item_stack_version_mismatch"
  | "item_stack_version_exhausted"
  | "item_stack_reservation_conflict";

const ITEM_STACK_COMMIT = Symbol("item-stack-commit");

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
  readonly rowVersion: number;
  readonly storeVersion: number;
  readonly reservationVersion: number;
}

export interface ItemStackSnapshotRow {
  readonly stackId: number;
  readonly active: number;
  readonly entityIndex: number;
  readonly entityGeneration: number;
  readonly defId: number;
  readonly quantity: number;
  readonly capacity: number;
  readonly rowVersion: number;
}

export interface ItemStackSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly rows: readonly ItemStackSnapshotRow[];
}

export interface ItemStackSnapshot extends ItemStackSnapshotInput {
  readonly snapshotVersion: typeof ITEM_STACK_SNAPSHOT_VERSION;
}

export type ItemStackRestoreResult =
  | { readonly ok: true; readonly version: number; readonly activeCount: number }
  | {
      readonly ok: false;
      readonly reason: "item_stack_snapshot_invalid" | "item_stack_snapshot_version_unsupported";
    };

export interface ItemStackIntoOutput {
  ok: boolean;
  reason: ItemStackReason | undefined;
  active: boolean;
  stackId: number;
  entityIndex: number;
  entityGeneration: number;
  defId: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  capacity: number;
  rowVersion: number;
  storeVersion: number;
  reservationVersion: number;
}

export interface ItemStackReadScratch {
  readonly entity: { index: number; generation: number };
}

export interface ItemStackQuantityRemovalPrepareInput {
  readonly stackId: number;
  readonly entityIndex: number;
  readonly entityGeneration: number;
  readonly defId: number;
  readonly quantity: number;
  readonly reservedQuantity: number;
  readonly ownedReservedQuantity: number;
  readonly availableQuantity: number;
  readonly capacity: number;
  readonly amount: number;
  readonly expectedRowVersion: number;
  readonly expectedStoreVersion: number;
  readonly expectedReservationVersion: number;
}

export interface ItemStackQuantityAdditionPrepareInput {
  readonly stackId: number;
  readonly entityIndex: number;
  readonly entityGeneration: number;
  readonly defId: number;
  readonly quantity: number;
  readonly capacity: number;
  readonly amount: number;
  readonly expectedRowVersion: number;
  readonly expectedStoreVersion: number;
  readonly expectedReservationVersion: number;
}

export interface PreparedItemStackQuantityRemoval {
  ok: boolean;
  reason: ItemStackReason | undefined;
  stackId: number;
  entityIndex: number;
  entityGeneration: number;
  defId: number;
  amount: number;
  previousQuantity: number;
  nextQuantity: number;
  capacity: number;
  previousRowVersion: number;
  nextRowVersion: number;
  previousStoreVersion: number;
  nextStoreVersion: number;
  reservationVersion: number;
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
  private readonly rowVersions: Uint32Array;
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
    this.rowVersions = new Uint32Array(capacity);
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
    if (this.storeVersion === 0xffff_ffff || this.activeCount === 0xffff_ffff) {
      return { ok: false, reason: "item_stack_version_exhausted" };
    }

    this.active[input.stackId] = 1;
    this.entityIndexes[input.stackId] = input.entity.index;
    this.entityGenerations[input.stackId] = input.entity.generation;
    this.defIds[input.stackId] = input.defId;
    this.quantities[input.stackId] = input.quantity;
    this.capacities[input.stackId] = input.capacity;
    this.rowVersions[input.stackId] = 1;
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
    if (!this.hasSingleMutationHeadroom(stackId)) {
      return { ok: false, reason: "item_stack_version_exhausted" };
    }

    this.quantities[stackId] = next;
    this.rowVersions[stackId] = (this.rowVersions[stackId] ?? 0) + 1;
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
    if (!this.hasSingleMutationHeadroom(stackId)) {
      return { ok: false, reason: "item_stack_version_exhausted" };
    }

    this.quantities[stackId] = current - amount;
    this.rowVersions[stackId] = (this.rowVersions[stackId] ?? 0) + 1;
    return this.finish(stackId);
  }

  transferQuantity(
    sourceStackId: number,
    destinationStackId: number,
    amount: number,
  ): ItemStackMutationResult {
    if (!isPositiveUint32(amount)) {
      return { ok: false, reason: "item_stack_quantity_invalid" };
    }
    if (!this.isActiveStackId(sourceStackId) || !this.isActiveStackId(destinationStackId)) {
      return { ok: false, reason: "item_stack_not_active" };
    }
    if ((this.defIds[sourceStackId] ?? 0) !== (this.defIds[destinationStackId] ?? 0)) {
      return { ok: false, reason: "item_stack_def_mismatch" };
    }
    const sourceQuantity = this.quantities[sourceStackId] ?? 0;
    if (amount > sourceQuantity) {
      return { ok: false, reason: "item_stack_quantity_underflow" };
    }
    if (sourceStackId === destinationStackId) {
      if (this.storeVersion > 0xffff_fffd || (this.rowVersions[sourceStackId] ?? 0) > 0xffff_fffd)
        return { ok: false, reason: "item_stack_version_exhausted" };
      this.rowVersions[sourceStackId] = (this.rowVersions[sourceStackId] ?? 0) + 2;
      this.storeVersion += 2;
      return { ok: true, stackId: destinationStackId, version: this.storeVersion };
    }
    const destinationQuantity = this.quantities[destinationStackId] ?? 0;
    if (amount > (this.capacities[destinationStackId] ?? 0) - destinationQuantity) {
      return { ok: false, reason: "item_stack_capacity_exceeded" };
    }
    if (
      this.storeVersion > 0xffff_fffd ||
      (this.rowVersions[sourceStackId] ?? 0) === 0xffff_ffff ||
      (this.rowVersions[destinationStackId] ?? 0) === 0xffff_ffff
    )
      return { ok: false, reason: "item_stack_version_exhausted" };
    this.quantities[sourceStackId] = sourceQuantity - amount;
    this.rowVersions[sourceStackId] = (this.rowVersions[sourceStackId] ?? 0) + 1;
    this.quantities[destinationStackId] = destinationQuantity + amount;
    this.rowVersions[destinationStackId] = (this.rowVersions[destinationStackId] ?? 0) + 1;
    this.storeVersion += 2;
    return { ok: true, stackId: destinationStackId, version: this.storeVersion };
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
      rowVersion: this.rowVersions[stackId] ?? 0,
      storeVersion: this.storeVersion,
      reservationVersion: ledger?.version ?? 0,
    };
  }

  readStackInto(
    stackId: number,
    ledger: ReservationLedger,
    scratch: ItemStackReadScratch,
    output: ItemStackIntoOutput,
  ): void {
    output.ok = false;
    output.reason = undefined;
    output.active = false;
    output.stackId = 0;
    output.entityIndex = 0;
    output.entityGeneration = 0;
    output.defId = 0;
    output.quantity = 0;
    output.reservedQuantity = 0;
    output.availableQuantity = 0;
    output.capacity = 0;
    output.rowVersion = 0;
    output.storeVersion = this.storeVersion;
    output.reservationVersion = ledger.version;
    if (!isIndexInRange(stackId, this.capacity)) {
      output.reason = "item_stack_id_out_of_range";
      return;
    }
    output.stackId = stackId;
    if ((this.active[stackId] ?? 0) !== 1) {
      output.reason = "item_stack_not_active";
      return;
    }
    const entityIndex = this.entityIndexes[stackId] ?? 0;
    const entityGeneration = this.entityGenerations[stackId] ?? 0;
    const quantity = this.quantities[stackId] ?? 0;
    scratch.entity.index = entityIndex;
    scratch.entity.generation = entityGeneration;
    const reservedQuantity = ledger.reservedAmountForItem(scratch.entity);
    output.ok = true;
    output.active = true;
    output.entityIndex = entityIndex;
    output.entityGeneration = entityGeneration;
    output.defId = this.defIds[stackId] ?? 0;
    output.quantity = quantity;
    output.reservedQuantity = reservedQuantity;
    output.availableQuantity = quantity > reservedQuantity ? quantity - reservedQuantity : 0;
    output.capacity = this.capacities[stackId] ?? 0;
    output.rowVersion = this.rowVersions[stackId] ?? 0;
  }

  prepareAutonomousQuantityRemovalInto(
    input: ItemStackQuantityRemovalPrepareInput,
    ledger: ReservationLedger,
    scratch: ItemStackReadScratch,
    output: PreparedItemStackQuantityRemoval,
  ): void {
    resetPreparedRemoval(output);
    const invalidReason = invalidRemovalPrepareInputReason(input);
    if (invalidReason !== undefined) {
      output.reason = invalidReason;
      return;
    }
    if (!this.isActiveStackId(input.stackId)) {
      output.reason = "item_stack_not_active";
      return;
    }
    scratch.entity.index = this.entityIndexes[input.stackId] ?? 0;
    scratch.entity.generation = this.entityGenerations[input.stackId] ?? 0;
    const authoritativeReservedQuantity = ledger.reservedAmountForItem(scratch.entity);
    if (
      input.expectedStoreVersion !== this.storeVersion ||
      input.expectedRowVersion !== (this.rowVersions[input.stackId] ?? 0) ||
      input.expectedReservationVersion !== ledger.version
    ) {
      output.reason = "item_stack_version_mismatch";
      return;
    }
    if (this.storeVersion === 0xffff_ffff || input.expectedRowVersion === 0xffff_ffff) {
      output.reason = "item_stack_version_exhausted";
      return;
    }
    if (
      input.entityIndex !== (this.entityIndexes[input.stackId] ?? 0) ||
      input.entityGeneration !== (this.entityGenerations[input.stackId] ?? 0) ||
      input.defId !== (this.defIds[input.stackId] ?? 0)
    ) {
      output.reason = "item_stack_def_mismatch";
      return;
    }
    const quantity = this.quantities[input.stackId] ?? 0;
    const capacity = this.capacities[input.stackId] ?? 0;
    if (input.quantity !== quantity || input.capacity !== capacity) {
      output.reason = "item_stack_version_mismatch";
      return;
    }
    if (
      input.reservedQuantity !== authoritativeReservedQuantity ||
      input.reservedQuantity > quantity ||
      input.ownedReservedQuantity > input.reservedQuantity ||
      input.availableQuantity !== quantity - input.reservedQuantity
    ) {
      output.reason = "item_stack_reservation_conflict";
      return;
    }
    if (
      !isPositiveUint32(input.amount) ||
      input.amount > input.availableQuantity + input.ownedReservedQuantity
    ) {
      output.reason =
        input.amount > input.availableQuantity + input.ownedReservedQuantity
          ? "item_stack_reservation_conflict"
          : "item_stack_quantity_invalid";
      return;
    }
    output.ok = true;
    output.stackId = input.stackId;
    output.entityIndex = input.entityIndex;
    output.entityGeneration = input.entityGeneration;
    output.defId = input.defId;
    output.amount = input.amount;
    output.previousQuantity = quantity;
    output.nextQuantity = quantity - input.amount;
    output.capacity = capacity;
    output.previousRowVersion = input.expectedRowVersion;
    output.nextRowVersion = input.expectedRowVersion + 1;
    output.previousStoreVersion = input.expectedStoreVersion;
    output.nextStoreVersion = input.expectedStoreVersion + 1;
    output.reservationVersion = input.expectedReservationVersion;
  }

  prepareAutonomousQuantityAdditionInto(
    input: ItemStackQuantityAdditionPrepareInput,
    ledger: ReservationLedger,
    output: PreparedItemStackQuantityRemoval,
  ): void {
    resetPreparedRemoval(output);
    const invalidReason = invalidAdditionPrepareInputReason(input);
    if (invalidReason !== undefined) {
      output.reason = invalidReason;
      return;
    }
    if (!this.isActiveStackId(input.stackId)) {
      output.reason = "item_stack_not_active";
      return;
    }
    if (
      input.expectedStoreVersion !== this.storeVersion ||
      input.expectedRowVersion !== (this.rowVersions[input.stackId] ?? 0) ||
      input.expectedReservationVersion !== ledger.version
    ) {
      output.reason = "item_stack_version_mismatch";
      return;
    }
    if (this.storeVersion === 0xffff_ffff || input.expectedRowVersion === 0xffff_ffff) {
      output.reason = "item_stack_version_exhausted";
      return;
    }
    if (
      input.entityIndex !== (this.entityIndexes[input.stackId] ?? 0) ||
      input.entityGeneration !== (this.entityGenerations[input.stackId] ?? 0) ||
      input.defId !== (this.defIds[input.stackId] ?? 0)
    ) {
      output.reason = "item_stack_def_mismatch";
      return;
    }
    const quantity = this.quantities[input.stackId] ?? 0;
    const capacity = this.capacities[input.stackId] ?? 0;
    if (input.quantity !== quantity || input.capacity !== capacity) {
      output.reason = "item_stack_version_mismatch";
      return;
    }
    if (!isPositiveUint32(input.amount) || input.amount > capacity - quantity) {
      output.reason =
        input.amount > capacity - quantity
          ? "item_stack_capacity_exceeded"
          : "item_stack_quantity_invalid";
      return;
    }
    output.ok = true;
    output.stackId = input.stackId;
    output.entityIndex = input.entityIndex;
    output.entityGeneration = input.entityGeneration;
    output.defId = input.defId;
    output.amount = input.amount;
    output.previousQuantity = quantity;
    output.nextQuantity = quantity + input.amount;
    output.capacity = capacity;
    output.previousRowVersion = input.expectedRowVersion;
    output.nextRowVersion = input.expectedRowVersion + 1;
    output.previousStoreVersion = input.expectedStoreVersion;
    output.nextStoreVersion = input.expectedStoreVersion + 1;
    output.reservationVersion = input.expectedReservationVersion;
  }

  [ITEM_STACK_COMMIT](prepared: PreparedItemStackQuantityRemoval): void {
    this.quantities[prepared.stackId] = prepared.nextQuantity;
    this.rowVersions[prepared.stackId] = prepared.nextRowVersion;
    this.storeVersion = prepared.nextStoreVersion;
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

  createSnapshot(): ItemStackSnapshot {
    const rows: ItemStackSnapshotRow[] = [];
    for (let stackId = 0; stackId < this.capacity; stackId += 1) {
      rows.push({
        stackId,
        active: this.active[stackId] ?? 0,
        entityIndex: this.entityIndexes[stackId] ?? 0,
        entityGeneration: this.entityGenerations[stackId] ?? 0,
        defId: this.defIds[stackId] ?? 0,
        quantity: this.quantities[stackId] ?? 0,
        capacity: this.capacities[stackId] ?? 0,
        rowVersion: this.rowVersions[stackId] ?? 0,
      });
    }
    return {
      snapshotVersion: ITEM_STACK_SNAPSHOT_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): ItemStackRestoreResult {
    if (!isPlainItemSnapshot(snapshot)) {
      if (isObject(snapshot) && snapshot["snapshotVersion"] !== ITEM_STACK_SNAPSHOT_VERSION) {
        return { ok: false, reason: "item_stack_snapshot_version_unsupported" };
      }
      return { ok: false, reason: "item_stack_snapshot_invalid" };
    }
    if (snapshot.capacity !== this.capacity || snapshot.rows.length !== this.capacity) {
      return { ok: false, reason: "item_stack_snapshot_invalid" };
    }
    let activeCount = 0;
    let activeRowVersionTotal = 0;
    for (let stackId = 0; stackId < this.capacity; stackId += 1) {
      const row = snapshot.rows[stackId];
      if (
        row?.stackId !== stackId ||
        row.rowVersion > snapshot.storeVersion ||
        (row.active === 1 &&
          (row.capacity === 0 || row.quantity > row.capacity || row.rowVersion === 0)) ||
        (row.active === 0 &&
          (row.entityIndex !== 0 ||
            row.entityGeneration !== 0 ||
            row.defId !== 0 ||
            row.quantity !== 0 ||
            row.capacity !== 0 ||
            row.rowVersion !== 0))
      ) {
        return { ok: false, reason: "item_stack_snapshot_invalid" };
      }
      if (row.active === 1) {
        if (row.rowVersion > 0xffff_ffff - activeRowVersionTotal) {
          return { ok: false, reason: "item_stack_snapshot_invalid" };
        }
        activeRowVersionTotal += row.rowVersion;
      }
      activeCount += row.active;
    }
    if (activeCount !== snapshot.activeCount || activeRowVersionTotal !== snapshot.storeVersion) {
      return { ok: false, reason: "item_stack_snapshot_invalid" };
    }
    for (let stackId = 0; stackId < this.capacity; stackId += 1) {
      const row = snapshot.rows[stackId];
      if (row === undefined) continue;
      this.active[stackId] = row.active;
      this.entityIndexes[stackId] = row.entityIndex;
      this.entityGenerations[stackId] = row.entityGeneration;
      this.defIds[stackId] = row.defId;
      this.quantities[stackId] = row.quantity;
      this.capacities[stackId] = row.capacity;
      this.rowVersions[stackId] = row.rowVersion;
    }
    this.storeVersion = snapshot.storeVersion;
    this.activeCount = snapshot.activeCount;
    return { ok: true, version: this.storeVersion, activeCount: this.activeCount };
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

    if (registry?.isAlive(input.entity) === false) {
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

  private hasSingleMutationHeadroom(stackId: number): boolean {
    return this.storeVersion < 0xffff_ffff && (this.rowVersions[stackId] ?? 0) < 0xffff_ffff;
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

function resetPreparedRemoval(output: PreparedItemStackQuantityRemoval): void {
  output.ok = false;
  output.reason = undefined;
  output.stackId = 0;
  output.entityIndex = 0;
  output.entityGeneration = 0;
  output.defId = 0;
  output.amount = 0;
  output.previousQuantity = 0;
  output.nextQuantity = 0;
  output.capacity = 0;
  output.previousRowVersion = 0;
  output.nextRowVersion = 0;
  output.previousStoreVersion = 0;
  output.nextStoreVersion = 0;
  output.reservationVersion = 0;
}

function invalidRemovalPrepareInputReason(
  input: ItemStackQuantityRemovalPrepareInput,
): ItemStackReason | undefined {
  if (!isSafeUint32(input.stackId)) return "item_stack_id_out_of_range";
  if (!isSafeUint32(input.entityIndex) || !isSafeUint32(input.entityGeneration))
    return "item_stack_entity_invalid";
  if (!isSafeUint32(input.defId)) return "item_stack_def_invalid";
  if (
    !isSafeUint32(input.quantity) ||
    !isSafeUint32(input.reservedQuantity) ||
    !isSafeUint32(input.ownedReservedQuantity) ||
    !isSafeUint32(input.availableQuantity) ||
    !isPositiveUint32(input.amount)
  )
    return "item_stack_quantity_invalid";
  if (!isSafeUint32(input.capacity)) return "item_stack_capacity_invalid";
  if (
    !isSafeUint32(input.expectedRowVersion) ||
    !isSafeUint32(input.expectedStoreVersion) ||
    !isSafeUint32(input.expectedReservationVersion)
  )
    return "item_stack_version_mismatch";
  return undefined;
}

function invalidAdditionPrepareInputReason(
  input: ItemStackQuantityAdditionPrepareInput,
): ItemStackReason | undefined {
  if (!isSafeUint32(input.stackId)) return "item_stack_id_out_of_range";
  if (!isSafeUint32(input.entityIndex) || !isSafeUint32(input.entityGeneration))
    return "item_stack_entity_invalid";
  if (!isSafeUint32(input.defId)) return "item_stack_def_invalid";
  if (!isSafeUint32(input.quantity) || !isPositiveUint32(input.amount))
    return "item_stack_quantity_invalid";
  if (!isSafeUint32(input.capacity)) return "item_stack_capacity_invalid";
  if (
    !isSafeUint32(input.expectedRowVersion) ||
    !isSafeUint32(input.expectedStoreVersion) ||
    !isSafeUint32(input.expectedReservationVersion)
  )
    return "item_stack_version_mismatch";
  return undefined;
}

export function commitPreparedItemStackQuantityRemoval(
  store: ItemStackStore,
  prepared: PreparedItemStackQuantityRemoval,
): void {
  store[ITEM_STACK_COMMIT](prepared);
}

export function commitPreparedItemStackQuantityAddition(
  store: ItemStackStore,
  prepared: PreparedItemStackQuantityRemoval,
): void {
  store[ITEM_STACK_COMMIT](prepared);
}

export function createItemStackStore(capacity: number): ItemStackStore {
  return new ItemStackStore(capacity);
}

export function restoreItemStackStore(snapshot: ItemStackSnapshotInput): ItemStackStore {
  const store = createItemStackStore(snapshot.capacity);
  const restored = store.restoreFromSnapshot(snapshot);
  if (!restored.ok) throw new Error(restored.reason);
  return store;
}

export function createItemStackHashFields(
  snapshot: ItemStackSnapshotInput,
  prefix = "items",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.storeVersion`, value: snapshot.storeVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
  ];
  for (let index = 0; index < snapshot.rows.length; index += 1) {
    const row = snapshot.rows[index];
    if (row === undefined) continue;
    const rowPrefix = `${prefix}.row.${String(index)}`;
    fields.push({ name: `${rowPrefix}.stackId`, value: row.stackId });
    fields.push({ name: `${rowPrefix}.active`, value: row.active });
    fields.push({ name: `${rowPrefix}.entityIndex`, value: row.entityIndex });
    fields.push({ name: `${rowPrefix}.entityGeneration`, value: row.entityGeneration });
    fields.push({ name: `${rowPrefix}.defId`, value: row.defId });
    fields.push({ name: `${rowPrefix}.quantity`, value: row.quantity });
    fields.push({ name: `${rowPrefix}.capacity`, value: row.capacity });
    fields.push({ name: `${rowPrefix}.rowVersion`, value: row.rowVersion });
  }
  return fields;
}

const ITEM_SNAPSHOT_KEYS = [
  "snapshotVersion",
  "capacity",
  "storeVersion",
  "activeCount",
  "rows",
] as const;
const ITEM_ROW_KEYS = [
  "stackId",
  "active",
  "entityIndex",
  "entityGeneration",
  "defId",
  "quantity",
  "capacity",
  "rowVersion",
] as const;

function isPlainItemSnapshot(value: unknown): value is ItemStackSnapshotInput {
  if (!hasExactItemKeys(value, ITEM_SNAPSHOT_KEYS)) return false;
  const rows = value["rows"];
  return (
    value["snapshotVersion"] === ITEM_STACK_SNAPSHOT_VERSION &&
    isSafeUint32Unknown(value["capacity"]) &&
    isSafeUint32Unknown(value["storeVersion"]) &&
    isSafeUint32Unknown(value["activeCount"]) &&
    Array.isArray(rows) &&
    isDenseItemArray(rows) &&
    rows.every(isItemSnapshotRow)
  );
}

function isItemSnapshotRow(value: unknown): value is ItemStackSnapshotRow {
  return (
    hasExactItemKeys(value, ITEM_ROW_KEYS) &&
    isSafeUint32Unknown(value["stackId"]) &&
    (value["active"] === 0 || value["active"] === 1) &&
    isSafeUint32Unknown(value["entityIndex"]) &&
    isSafeUint32Unknown(value["entityGeneration"]) &&
    isSafeUint32Unknown(value["defId"]) &&
    isSafeUint32Unknown(value["quantity"]) &&
    isSafeUint32Unknown(value["capacity"]) &&
    isSafeUint32Unknown(value["rowVersion"])
  );
}

function hasExactItemKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (!isObject(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  return true;
}

function isDenseItemArray(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) if (!(index in value)) return false;
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeUint32Unknown(value: unknown): value is number {
  return typeof value === "number" && isSafeUint32(value);
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
