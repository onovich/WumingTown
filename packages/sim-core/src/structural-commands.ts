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
  isInt32,
  type CommandCode,
  type MutableStructuralCommitReport,
  type QueueStructuralCommandResult,
  type StructuralCommandReasonSlot,
  type StructuralCommandReason,
  type StructuralCommitReport,
} from "./structural-command-types";

export {
  createStructuralCommandResultView,
  readStructuralCommandResult,
} from "./structural-command-types";
export type {
  QueueStructuralCommandResult,
  StructuralCommandResultView,
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
  private readonly resultOk: Uint8Array;
  private readonly resultKinds: Uint8Array;
  private readonly resultSequences: Uint32Array;
  private readonly resultIndexes: Int32Array;
  private readonly resultGenerations: Uint32Array;
  private readonly resultValues: Float64Array;
  private readonly resultReasons: StructuralCommandReasonSlot[];
  private readonly report: MutableStructuralCommitReport;
  private readonly scratchEntity = { index: -1, generation: 0 };
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
    this.resultOk = new Uint8Array(options.capacity);
    this.resultKinds = new Uint8Array(options.capacity);
    this.resultSequences = new Uint32Array(options.capacity);
    this.resultIndexes = new Int32Array(options.capacity);
    this.resultGenerations = new Uint32Array(options.capacity);
    this.resultValues = new Float64Array(options.capacity);
    this.resultReasons = new Array<StructuralCommandReasonSlot>(options.capacity).fill("none");
    this.report = {
      appliedCount: 0,
      failedCount: 0,
      resultCount: 0,
      ok: this.resultOk,
      kinds: this.resultKinds,
      sequences: this.resultSequences,
      indexes: this.resultIndexes,
      generations: this.resultGenerations,
      values: this.resultValues,
      reasons: this.resultReasons,
    };
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
    if (!isInt32(value)) {
      return {
        ok: false,
        reason: "command_value_out_of_range",
      };
    }

    return this.record(COMMAND_ATTACH_I32, entity.index, entity.generation, value);
  }

  queueDetachInt32(entity: EntityId): QueueStructuralCommandResult {
    return this.record(COMMAND_DETACH_I32, entity.index, entity.generation, 0);
  }

  queueSetInt32(entity: EntityId, value: number): QueueStructuralCommandResult {
    if (!isInt32(value)) {
      return {
        ok: false,
        reason: "command_value_out_of_range",
      };
    }

    return this.record(COMMAND_SET_I32, entity.index, entity.generation, value);
  }

  commit(registry: EntityRegistry, componentStore: Int32ComponentStore): StructuralCommitReport {
    this.orderQueuedSlots();

    this.report.appliedCount = 0;
    this.report.failedCount = 0;
    this.report.resultCount = 0;

    for (let cursor = 0; cursor < this.count; cursor += 1) {
      const slot = this.orderedSlots[cursor] ?? 0;
      const ok = this.applySlot(slot, registry, componentStore);

      if (ok) {
        this.report.appliedCount += 1;
      } else {
        this.report.failedCount += 1;
      }
    }

    this.clear();
    return this.report;
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
  ): boolean {
    const kind = this.readKind(slot);

    if (kind === COMMAND_ALLOCATE) {
      return this.applyAllocate(slot, registry);
    }

    this.readEntityInto(slot);

    if (kind === COMMAND_DESTROY) {
      return this.applyDestroy(slot, registry, componentStore);
    }

    if (kind === COMMAND_ATTACH_I32) {
      return this.applyAttach(slot, registry, componentStore);
    }

    if (kind === COMMAND_DETACH_I32) {
      return this.applyDetach(slot, registry, componentStore);
    }

    return this.applySet(slot, registry, componentStore);
  }

  private applyAllocate(slot: number, registry: EntityRegistry): boolean {
    const result = registry.allocate();

    if (!result.ok) {
      this.recordResult(slot, COMMAND_ALLOCATE, false, -1, 0, 0, result.reason);
      return false;
    }

    this.recordResult(
      slot,
      COMMAND_ALLOCATE,
      true,
      result.entity.index,
      result.entity.generation,
      0,
      "none",
    );
    return true;
  }

  private applyDestroy(
    slot: number,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): boolean {
    const result = registry.destroy(this.scratchEntity);

    if (!result.ok) {
      this.recordResult(
        slot,
        COMMAND_DESTROY,
        false,
        this.scratchEntity.index,
        this.scratchEntity.generation,
        0,
        result.reason,
      );
      return false;
    }

    componentStore.removeByIndex(this.scratchEntity.index);
    this.recordResult(
      slot,
      COMMAND_DESTROY,
      true,
      this.scratchEntity.index,
      this.scratchEntity.generation,
      result.nextGeneration,
      "none",
    );
    return true;
  }

  private applyAttach(
    slot: number,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): boolean {
    const result = componentStore.attach(this.scratchEntity, registry, this.values[slot] ?? 0);
    return this.componentResult(slot, COMMAND_ATTACH_I32, result);
  }

  private applyDetach(
    slot: number,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): boolean {
    const result = componentStore.detach(this.scratchEntity, registry);
    return this.componentResult(slot, COMMAND_DETACH_I32, result);
  }

  private applySet(
    slot: number,
    registry: EntityRegistry,
    componentStore: Int32ComponentStore,
  ): boolean {
    const result = componentStore.set(this.scratchEntity, registry, this.values[slot] ?? 0);
    return this.componentResult(slot, COMMAND_SET_I32, result);
  }

  private componentResult(
    slot: number,
    kind: CommandCode,
    result:
      | { readonly ok: true }
      | { readonly ok: false; readonly reason: StructuralCommandReason },
  ): boolean {
    if (!result.ok) {
      this.recordResult(
        slot,
        kind,
        false,
        this.scratchEntity.index,
        this.scratchEntity.generation,
        0,
        result.reason,
      );
      return false;
    }

    this.recordResult(
      slot,
      kind,
      true,
      this.scratchEntity.index,
      this.scratchEntity.generation,
      this.values[slot] ?? 0,
      "none",
    );
    return true;
  }

  private recordResult(
    slot: number,
    kind: CommandCode,
    ok: boolean,
    index: number,
    generation: number,
    value: number,
    reason: StructuralCommandReasonSlot,
  ): void {
    const resultIndex = this.report.resultCount;
    this.resultOk[resultIndex] = ok ? 1 : 0;
    this.resultKinds[resultIndex] = kind;
    this.resultSequences[resultIndex] = this.sequences[slot] ?? 0;
    this.resultIndexes[resultIndex] = index;
    this.resultGenerations[resultIndex] = generation;
    this.resultValues[resultIndex] = value;
    this.resultReasons[resultIndex] = reason;
    this.report.resultCount += 1;
  }

  private readEntityInto(slot: number): void {
    this.scratchEntity.index = this.indexes[slot] ?? -1;
    this.scratchEntity.generation = this.generations[slot] ?? 0;
  }

  private readKind(slot: number): CommandCode {
    const kind = this.kinds[slot];

    if (isCommandCode(kind)) {
      return kind;
    }

    throw new Error("unknown structural command kind");
  }
}

export const createStructuralCommandBuffer = (
  options: StructuralCommandBufferOptions,
): StructuralCommandBuffer => new StructuralCommandBuffer(options);
