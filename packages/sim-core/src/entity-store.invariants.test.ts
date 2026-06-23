import { describe, expect, it } from "vitest";

import {
  createEntityRegistry,
  createInt32ComponentStore,
  createStructuralCommandBuffer,
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
    expect(store.has(first)).toBe(false);
    expect(store.has(reused)).toBe(false);
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

    registry.forEachAliveAscending((entity) => {
      liveIndexes.push(entity.index);
    });
    store.forEachAttachedAscending(registry, (entity, value) => {
      componentPairs.push(`${String(entity.index)}:${String(value)}`);
    });

    expect(liveIndexes).toStrictEqual([0, 2, 4]);
    expect(componentPairs).toStrictEqual(["0:10", "2:20", "4:40"]);
  });

  it("defers structural changes until an explicit commit phase", () => {
    const registry = createEntityRegistry({ capacity: 2 });
    const store = createInt32ComponentStore({ capacity: 2 });
    const buffer = createStructuralCommandBuffer({ capacity: 4 });
    const entity = allocateOrThrow(registry);

    expect(buffer.queueAttachInt32(entity, 7).ok).toBe(true);
    expect(store.has(entity)).toBe(false);

    const attachReport = buffer.commit(registry, store);
    expect(attachReport.appliedCount).toBe(1);
    expect(store.read(entity)).toStrictEqual({ ok: true, value: 7 });

    expect(buffer.queueDestroy(entity).ok).toBe(true);
    expect(registry.isAlive(entity)).toBe(true);

    const destroyReport = buffer.commit(registry, store);
    expect(destroyReport.appliedCount).toBe(1);
    expect(registry.isAlive(entity)).toBe(false);
    expect(store.has(entity)).toBe(false);
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
    expect(store.read(first)).toStrictEqual({ ok: true, value: 9 });
    expect(store.read(second)).toStrictEqual({ ok: true, value: 20 });
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
  for (const result of report.results) {
    if (result.ok && result.kind === "allocate" && result.entity !== undefined) {
      return result.entity;
    }
  }

  throw new Error("expected an allocation result");
}

function readResultSequences(report: StructuralCommitReport): number[] {
  const sequences: number[] = [];

  for (const result of report.results) {
    sequences.push(result.sequence);
  }

  return sequences;
}

function missingEntity(): EntityId {
  throw new Error("missing test entity");
}
