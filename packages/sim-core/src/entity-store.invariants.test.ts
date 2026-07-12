import { describe, expect, it } from "vitest";

import {
  createEntityRegistry,
  createInt32ComponentStore,
  createStructuralCommandBuffer,
  createStructuralCommandResultView,
  readStructuralCommandResult,
  sameEntity,
  type EntityId,
  type StructuralCommitReport,
} from "./index";

describe("entity handles and component stores", () => {
  it("prevents destroyed handles from aliasing reused slots", () => {
    const registry = createEntityRegistry({ capacity: 1 });
    const store = createInt32ComponentStore({ capacity: 1 });
    const buffer = createStructuralCommandBuffer({ capacity: 4 });
    const first = allocateOrThrow(registry);

    expect(store.attach(first, registry, 10).ok).toBe(true);
    expect(buffer.queueDestroy(first).ok).toBe(true);
    expect(buffer.queueAllocate().ok).toBe(true);

    const report = buffer.commit(registry, store);
    const reused = findAllocatedEntity(report);

    expect(reused.index).toBe(first.index);
    expect(reused.generation).toBe(first.generation + 1);
    expect(sameEntity(reused, first)).toBe(false);
    expect(registry.isAlive(first)).toBe(false);
    expect(registry.isAlive(reused)).toBe(true);
    expect(store.has(first, registry)).toBe(false);
    expect(store.has(reused, registry)).toBe(false);
  });

  it("rejects stale component reads after direct destroy and slot reuse", () => {
    const registry = createEntityRegistry({ capacity: 1 });
    const store = createInt32ComponentStore({ capacity: 1 });
    const stale = allocateOrThrow(registry);

    expect(store.attach(stale, registry, 99).ok).toBe(true);
    expect(registry.destroy(stale).ok).toBe(true);
    const reused = allocateOrThrow(registry);

    expect(reused.index).toBe(stale.index);
    expect(reused.generation).toBe(stale.generation + 1);
    expect(store.has(stale, registry)).toBe(false);
    expect(store.read(stale, registry)).toStrictEqual({
      ok: false,
      reason: "component_entity_generation_mismatch",
    });
    expect(store.read(reused, registry)).toStrictEqual({
      ok: false,
      reason: "component_missing",
    });
  });

  it("iterates active entities and attached components in ascending index order", () => {
    const registry = createEntityRegistry({ capacity: 5 });
    const store = createInt32ComponentStore({ capacity: 5 });
    const entities = allocateMany(registry, 5);

    expect(registry.destroy(entities[3] ?? missingEntity()).ok).toBe(true);
    expect(registry.destroy(entities[1] ?? missingEntity()).ok).toBe(true);
    expect(store.attach(entities[4] ?? missingEntity(), registry, 40).ok).toBe(true);
    expect(store.attach(entities[0] ?? missingEntity(), registry, 10).ok).toBe(true);
    expect(store.attach(entities[2] ?? missingEntity(), registry, 20).ok).toBe(true);

    const liveIndexes: number[] = [];
    const componentPairs: string[] = [];

    registry.forEachAliveAscending((index) => {
      liveIndexes.push(index);
    });
    store.forEachAttachedAscending(registry, (index, generation, value) => {
      componentPairs.push(`${String(index)}:${String(generation)}:${String(value)}`);
    });

    expect(liveIndexes).toStrictEqual([0, 2, 4]);
    expect(componentPairs).toStrictEqual(["0:1:10", "2:1:20", "4:1:40"]);
  });

  it("defers structural changes until an explicit commit phase", () => {
    const registry = createEntityRegistry({ capacity: 2 });
    const store = createInt32ComponentStore({ capacity: 2 });
    const buffer = createStructuralCommandBuffer({ capacity: 4 });
    const entity = allocateOrThrow(registry);

    expect(buffer.queueAttachInt32(entity, 7).ok).toBe(true);
    expect(store.has(entity, registry)).toBe(false);

    const attachReport = buffer.commit(registry, store);
    expect(attachReport.appliedCount).toBe(1);
    expect(store.read(entity, registry)).toStrictEqual({ ok: true, value: 7 });

    expect(buffer.queueDestroy(entity).ok).toBe(true);
    expect(registry.isAlive(entity)).toBe(true);

    const destroyReport = buffer.commit(registry, store);
    expect(destroyReport.appliedCount).toBe(1);
    expect(registry.isAlive(entity)).toBe(false);
    expect(store.has(entity, registry)).toBe(false);
  });

  it("resolves command conflicts by kind, entity index, then insertion sequence", () => {
    const registry = createEntityRegistry({ capacity: 3 });
    const store = createInt32ComponentStore({ capacity: 3 });
    const buffer = createStructuralCommandBuffer({ capacity: 8 });
    const first = allocateOrThrow(registry);
    const second = allocateOrThrow(registry);

    expect(store.attach(first, registry, 1).ok).toBe(true);
    expect(buffer.queueSetInt32(first, 9)).toStrictEqual({ ok: true, sequence: 0 });
    expect(buffer.queueDetachInt32(first)).toStrictEqual({ ok: true, sequence: 1 });
    expect(buffer.queueAttachInt32(first, 5)).toStrictEqual({ ok: true, sequence: 2 });
    expect(buffer.queueAttachInt32(second, 20)).toStrictEqual({ ok: true, sequence: 3 });

    const report = buffer.commit(registry, store);

    expect(readResultSequences(report)).toStrictEqual([1, 2, 3, 0]);
    expect(store.read(first, registry)).toStrictEqual({ ok: true, value: 9 });
    expect(store.read(second, registry)).toStrictEqual({ ok: true, value: 20 });
  });

  it("preserves priority, signed Int32 index, and sequence order at capacity", () => {
    const registry = createEntityRegistry({ capacity: 3 });
    const store = createInt32ComponentStore({ capacity: 3 });
    const buffer = createStructuralCommandBuffer({ capacity: 10 });
    const first = allocateOrThrow(registry);
    const second = allocateOrThrow(registry);

    expect(store.attach(first, registry, 10).ok).toBe(true);
    expect(store.attach(second, registry, 20).ok).toBe(true);
    expect(buffer.queueSetInt32(second, 30)).toStrictEqual({ ok: true, sequence: 0 });
    expect(buffer.queueAllocate()).toStrictEqual({ ok: true, sequence: 1 });
    expect(buffer.queueDestroy({ index: 2_147_483_647, generation: 1 })).toStrictEqual({
      ok: true,
      sequence: 2,
    });
    expect(buffer.queueDetachInt32({ index: -2_147_483_648, generation: 1 })).toStrictEqual({
      ok: true,
      sequence: 3,
    });
    expect(buffer.queueAttachInt32(second, 40)).toStrictEqual({ ok: true, sequence: 4 });
    expect(buffer.queueSetInt32(first, 50)).toStrictEqual({ ok: true, sequence: 5 });
    expect(buffer.queueDestroy(first)).toStrictEqual({ ok: true, sequence: 6 });
    expect(buffer.queueDetachInt32(first)).toStrictEqual({ ok: true, sequence: 7 });
    expect(buffer.queueAttachInt32(first, 80)).toStrictEqual({ ok: true, sequence: 8 });
    expect(buffer.queueSetInt32(first, 90)).toStrictEqual({ ok: true, sequence: 9 });
    expect(buffer.queueAllocate()).toStrictEqual({
      ok: false,
      reason: "command_buffer_capacity_exhausted",
    });

    const report = buffer.commit(registry, store);

    expect(readResultSequences(report)).toStrictEqual([6, 2, 3, 7, 8, 4, 5, 9, 0, 1]);
    expect(Array.from(report.kinds.subarray(0, report.resultCount))).toStrictEqual([
      2, 2, 4, 4, 3, 3, 5, 5, 5, 1,
    ]);
    expect(Array.from(report.indexes.subarray(0, report.resultCount))).toStrictEqual([
      0, 2_147_483_647, -2_147_483_648, 0, 0, 1, 0, 0, 1, 0,
    ]);
  });

  it("reuses fixed ordering storage across reverse and repeated-index commits", () => {
    const registry = createEntityRegistry({ capacity: 4 });
    const store = createInt32ComponentStore({ capacity: 4 });
    const buffer = createStructuralCommandBuffer({ capacity: 4 });
    const entities = allocateMany(registry, 4);

    for (let index = 0; index < entities.length; index += 1) {
      const entity = entities[index] ?? missingEntity();
      expect(store.attach(entity, registry, index).ok).toBe(true);
    }

    for (let index = entities.length - 1; index >= 0; index -= 1) {
      const entity = entities[index] ?? missingEntity();
      expect(buffer.queueSetInt32(entity, 10 + index).ok).toBe(true);
    }

    const reverseReport = buffer.commit(registry, store);
    expect(readResultSequences(reverseReport)).toStrictEqual([3, 2, 1, 0]);

    expect(buffer.queueSetInt32(entities[2] ?? missingEntity(), 100)).toStrictEqual({
      ok: true,
      sequence: 4,
    });
    expect(buffer.queueSetInt32(entities[2] ?? missingEntity(), 200)).toStrictEqual({
      ok: true,
      sequence: 5,
    });
    expect(buffer.queueSetInt32(entities[0] ?? missingEntity(), 300)).toStrictEqual({
      ok: true,
      sequence: 6,
    });
    expect(buffer.queueSetInt32(entities[3] ?? missingEntity(), 400)).toStrictEqual({
      ok: true,
      sequence: 7,
    });

    const reusedReport = buffer.commit(registry, store);
    expect(readResultSequences(reusedReport)).toStrictEqual([6, 4, 5, 7]);
    expect(store.read(entities[2] ?? missingEntity(), registry)).toStrictEqual({
      ok: true,
      value: 200,
    });
  });

  it("rejects queued Int32 command values before typed-array storage", () => {
    const registry = createEntityRegistry({ capacity: 1 });
    const store = createInt32ComponentStore({ capacity: 1 });
    const buffer = createStructuralCommandBuffer({ capacity: 2 });
    const entity = allocateOrThrow(registry);

    expect(buffer.queueAttachInt32(entity, 2_147_483_648)).toStrictEqual({
      ok: false,
      reason: "command_value_out_of_range",
    });
    expect(buffer.queueSetInt32(entity, -2_147_483_649)).toStrictEqual({
      ok: false,
      reason: "command_value_out_of_range",
    });

    const report = buffer.commit(registry, store);
    expect(report.resultCount).toBe(0);
    expect(store.read(entity, registry)).toStrictEqual({
      ok: false,
      reason: "component_missing",
    });
  });

  it("exposes commit evidence through reusable typed result buffers", () => {
    const registry = createEntityRegistry({ capacity: 1 });
    const store = createInt32ComponentStore({ capacity: 1 });
    const buffer = createStructuralCommandBuffer({ capacity: 2 });
    const entity = allocateOrThrow(registry);

    expect(buffer.queueAttachInt32(entity, 5)).toStrictEqual({ ok: true, sequence: 0 });
    expect(buffer.queueSetInt32(entity, 8)).toStrictEqual({ ok: true, sequence: 1 });

    const report = buffer.commit(registry, store);
    const view = createStructuralCommandResultView();

    expect(report.resultCount).toBe(2);
    expect(readStructuralCommandResult(report, 0, view)).toBe(true);
    expect(view).toStrictEqual({
      ok: true,
      sequence: 0,
      kind: "attach-i32",
      index: entity.index,
      generation: entity.generation,
      value: 5,
      reason: "none",
    });
    expect(readStructuralCommandResult(report, 1, view)).toBe(true);
    expect(view).toStrictEqual({
      ok: true,
      sequence: 1,
      kind: "set-i32",
      index: entity.index,
      generation: entity.generation,
      value: 8,
      reason: "none",
    });
  });

  it("covers allocation, destruction, reuse, and capacity boundaries across small capacities", () => {
    for (let capacity = 1; capacity <= 8; capacity += 1) {
      const registry = createEntityRegistry({ capacity });
      const allocated = allocateMany(registry, capacity);

      expect(registry.allocate()).toStrictEqual({
        ok: false,
        reason: "entity_capacity_exhausted",
      });

      for (const entity of allocated) {
        expect(registry.destroy(entity).ok).toBe(true);
        expect(registry.isAlive(entity)).toBe(false);
      }

      for (let count = 0; count < capacity; count += 1) {
        const reused = allocateOrThrow(registry);
        expect(reused.generation).toBe(2);
      }
    }
  });

  it("reports bounded store and command buffer failures with structured reasons", () => {
    const registry = createEntityRegistry({ capacity: 2 });
    const store = createInt32ComponentStore({ capacity: 1 });
    const buffer = createStructuralCommandBuffer({ capacity: 1 });
    const first = allocateOrThrow(registry);
    const second = allocateOrThrow(registry);

    expect(store.attach(second, registry, 1)).toStrictEqual({
      ok: false,
      reason: "component_index_out_of_range",
    });
    expect(buffer.queueDestroy(first)).toStrictEqual({ ok: true, sequence: 0 });
    expect(buffer.queueDestroy(first)).toStrictEqual({
      ok: false,
      reason: "command_buffer_capacity_exhausted",
    });
  });
});

function allocateOrThrow(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.entity;
}

function allocateMany(
  registry: ReturnType<typeof createEntityRegistry>,
  count: number,
): EntityId[] {
  const entities: EntityId[] = [];

  for (let index = 0; index < count; index += 1) {
    entities.push(allocateOrThrow(registry));
  }

  return entities;
}

function findAllocatedEntity(report: StructuralCommitReport): EntityId {
  const view = createStructuralCommandResultView();

  for (let ordinal = 0; ordinal < report.resultCount; ordinal += 1) {
    if (readStructuralCommandResult(report, ordinal, view) && view.ok && view.kind === "allocate") {
      return {
        index: view.index,
        generation: view.generation,
      };
    }
  }

  throw new Error("expected an allocation result");
}

function readResultSequences(report: StructuralCommitReport): number[] {
  const sequences: number[] = [];

  for (let ordinal = 0; ordinal < report.resultCount; ordinal += 1) {
    sequences.push(report.sequences[ordinal] ?? 0);
  }

  return sequences;
}

function missingEntity(): EntityId {
  throw new Error("missing test entity");
}
