import { performance } from "node:perf_hooks";

import {
  createEntityRegistry,
  createInt32ComponentStore,
  createStructuralCommandBuffer,
  type EntityId,
} from "@wuming-town/sim-core";

import type { EntityStoreBenchmarkReport } from "./benchmarks";

export function runEntityStoreBenchmark(): EntityStoreBenchmarkReport {
  const capacity = 8_192;
  const registry = createEntityRegistry({ capacity });
  const store = createInt32ComponentStore({ capacity });
  const buffer = createStructuralCommandBuffer({ capacity });
  const entities: EntityId[] = [];
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  for (let index = 0; index < capacity; index += 1) {
    const allocation = registry.allocate();

    if (!allocation.ok) {
      throw new Error(allocation.reason);
    }

    const entity = allocation.entity;
    const attached = store.attach(entity, registry, index);

    if (!attached.ok) {
      throw new Error(attached.reason);
    }

    entities.push(entity);
  }

  for (let index = capacity - 1; index >= 0; index -= 1) {
    const entity = entities[index];

    if (entity === undefined) {
      throw new Error("missing benchmark entity");
    }

    const queued = buffer.queueSetInt32(entity, index * 3);

    if (!queued.ok) {
      throw new Error(queued.reason);
    }
  }

  const report = buffer.commit(registry, store);
  let iterationChecksum = 0;

  store.forEachAttachedAscending(registry, (index, generation, value) => {
    iterationChecksum = (iterationChecksum + index + generation + value) >>> 0;
  });

  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "entity-store",
    capacity,
    queuedCommands: capacity,
    commitResultCount: report.resultCount,
    appliedCommands: report.appliedCount,
    failedCommands: report.failedCount,
    attachedComponents: store.activeCount,
    iterationChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}
