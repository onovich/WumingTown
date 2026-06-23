import { type EntityId, type EntityRegistry } from "./entity-id";
import { type Int32ComponentStore } from "./component-store";
import {
  COMMAND_ALLOCATE,
  COMMAND_ATTACH_I32,
  COMMAND_DESTROY,
  COMMAND_DETACH_I32,
  COMMAND_SET_I32,
  commandPriority,
  isCommandCode,
  type CommandCode,
  type QueueStructuralCommandResult,
  type StructuralCommandKind,
  type StructuralCommandReason,
  type StructuralCommandResult,
  type StructuralCommitReport,
} from "./structural-command-types";

export type {
  QueueStructuralCommandResult,
  StructuralCommandKind,
  StructuralCommandReason,
  StructuralCommandResult,
  StructuralCommitReport,
} from "./structural-command-types";

export interface StructuralCommandBufferOptions {
  readonly capacity: number;
}

export class StructuralCommandBuffer {
  readonly capacity: number;

  private readonly kinds: Uint8Array;
  private readonly indexes: Int32Array;
  private readonly generations: Uint32Array;
  private readonly values: Int32Array;
  private readonly sequences: Uint32Array;
  private readonly orderedSlots: Uint32Array;
  private count = 0;
  private nextSequence = 0;

  constructor(options: StructuralCommandBufferOptions) {
    if (!Number.isSafeInteger(options.capacity) || options.capacity <= 0) {
      throw new Error("command buffer capacity must be a positive safe integer");
    }

    this.capacity = options.capacity;
    this.kinds = new Uint8Array(options.capacity);
    this.indexes = new Int32Array(options.capacity);
    this.generations = new Uint32Array(options.capacity);
    this.values = new Int32Array(options.capacity);
    this.sequences = new Uint32Array(options.capacity);
    this.orderedSlots = new Uint32Array(options.capacity);
  }

  get queuedCount(): number {
    return this.count;
  }

  queueAllocate(): QueueStructuralCommandResult {
    return this.record(COMMAND_ALLOCATE, -1, 0, 0);
  }

  queueDestroy(entity: EntityId): QueueStructuralCommandResult {
    return this.record(COMMAND_DESTROY, entity.index, entity.generation, 0);
  }

  queueAttachInt32(entity: EntityId, value: number): QueueStructuralCommandResult {
    return this.record(COMMAND_ATTACH_I32, entity.index, entity.generation, value);
  }

  queueDetachInt32(entity: EntityId): QueueStructuralCommandResult {
    return this.record(COMMAND_DETACH_I32, entity.index, entity.generation, 0);
  }

  queueSetInt32(entity: EntityId, value: number): QueueStructuralCommandResult {
    return this.record(COMMAND_SET_I32, entity.index, entity.generation, value);
  }

  commit(registry: EntityRegistry, componentStore: Int32ComponentStore): StructuralCommitReport {
    this.orderQueuedSlots();

    const results: StructuralCommandResult[] = [];
    let appliedCount = 0;
    let failedCount = 0;

    for (let cursor = 0; cursor < this.count; cursor += 1) {
      const slot = this.orderedSlots[cursor] ?? 0;
      const result = this.applySlot(slot, registry, componentStore);
      results.push(result);

      if (result.ok) {
        appliedCount += 1;
      } else {
        failedCount += 1;
      }
    }

    this.clear();
    return {
      appliedCount,
      failedCount,
      results,
    };
  }

  clear(): void {
    this.count = 0;
  }

  private record(
    kind: CommandCode,
    index: number,
    generation: number,
    value: number,
  ): QueueStructuralCommandResult {
    if (this.count >= this.capacity) {
      return {
        ok: false,
        reason: "command_buffer_capacity_exhausted",
      };
    }

    const slot = this.count;
    const sequence = this.nextSequence;
    this.kinds[slot] = kind;
    this.indexes[slot] = index;
    this.generations[slot] = generation;
    this.values[slot] = value;
    this.sequences[slot] = sequence;
    this.count += 1;
    this.nextSequence += 1;

    return {
      ok: true,
      sequence,
    };
  }

  private orderQueuedSlots(): void {
    for (let slot = 0; slot < this.count; slot += 1) {
      this.orderedSlots[slot] = slot;
    }

    for (let cursor = 1; cursor < this.count; cursor += 1) {
      const selectedSlot = this.orderedSlots[cursor] ?? 0;
      let scan = cursor - 1;

      while (scan >= 0 && this.compareSlots(selectedSlot, this.orderedSlots[scan] ?? 0) < 0) {
        this.orderedSlots[scan + 1] = this.orderedSlots[scan] ?? 0;
        scan -= 1;
      }

      this.orderedSlots[scan + 1] = selectedSlot;
    }
  }

  private compareSlots(leftSlot: number, rightSlot: number): number {
    const leftPriority = commandPriority(this.readKind(leftSlot));
    const rightPriority = commandPriority(this.readKind(rightSlot));

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftIndex = this.indexes[leftSlot] ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = this.indexes[rightSlot] ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return (this.sequences[leftSlot] ?? 0) - (this.sequences[rightSlot] ?? 0);
  }

  private applySlot(
    slot: number,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): StructuralCommandResult {
    const kind = this.readKind(slot);

    if (kind === COMMAND_ALLOCATE) {
      return this.applyAllocate(slot, registry);
    }

    const entity = this.readEntity(slot);

    if (kind === COMMAND_DESTROY) {
      return this.applyDestroy(slot, entity, registry, componentStore);
    }

    if (kind === COMMAND_ATTACH_I32) {
      return this.applyAttach(slot, entity, registry, componentStore);
    }

    if (kind === COMMAND_DETACH_I32) {
      return this.applyDetach(slot, entity, registry, componentStore);
    }

    return this.applySet(slot, entity, registry, componentStore);
  }

  private applyAllocate(slot: number, registry: EntityRegistry): StructuralCommandResult {
    const result = registry.allocate();
    const sequence = this.sequences[slot] ?? 0;

    if (!result.ok) {
      return {
        ok: false,
        sequence,
        kind: "allocate",
        reason: result.reason,
      };
    }

    return {
      ok: true,
      sequence,
      kind: "allocate",
      entity: result.entity,
    };
  }

  private applyDestroy(
    slot: number,
    entity: EntityId,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): StructuralCommandResult {
    const result = registry.destroy(entity);
    const sequence = this.sequences[slot] ?? 0;

    if (!result.ok) {
      return {
        ok: false,
        sequence,
        kind: "destroy",
        reason: result.reason,
      };
    }

    componentStore.removeByIndex(entity.index);
    return {
      ok: true,
      sequence,
      kind: "destroy",
      entity,
      value: result.nextGeneration,
    };
  }

  private applyAttach(
    slot: number,
    entity: EntityId,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): StructuralCommandResult {
    const result = componentStore.attach(entity, registry, this.values[slot] ?? 0);
    return this.componentResult(slot, "attach-i32", result, entity);
  }

  private applyDetach(
    slot: number,
    entity: EntityId,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): StructuralCommandResult {
    const result = componentStore.detach(entity, registry);
    return this.componentResult(slot, "detach-i32", result, entity);
  }

  private applySet(
    slot: number,
    entity: EntityId,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): StructuralCommandResult {
    const result = componentStore.set(entity, registry, this.values[slot] ?? 0);
    return this.componentResult(slot, "set-i32", result, entity);
  }

  private componentResult(
    slot: number,
    kind: StructuralCommandKind,
    result:
      | { readonly ok: true }
      | { readonly ok: false; readonly reason: StructuralCommandReason },
    entity: EntityId,
  ): StructuralCommandResult {
    const sequence = this.sequences[slot] ?? 0;

    if (!result.ok) {
      return {
        ok: false,
        sequence,
        kind,
        reason: result.reason,
      };
    }

    return {
      ok: true,
      sequence,
      kind,
      entity,
    };
  }

  private readEntity(slot: number): EntityId {
    return {
      index: this.indexes[slot] ?? -1,
      generation: this.generations[slot] ?? 0,
    };
  }

  private readKind(slot: number): CommandCode {
    const kind = this.kinds[slot];

    if (isCommandCode(kind)) {
      return kind;
    }

    throw new Error("unknown structural command kind");
  }
}

export function createStructuralCommandBuffer(
  options: StructuralCommandBufferOptions,
): StructuralCommandBuffer {
  return new StructuralCommandBuffer(options);
}
