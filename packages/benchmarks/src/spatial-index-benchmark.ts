import { performance } from "node:perf_hooks";

import {
  createEntityRegistry,
  createLocationStore,
  createMapGrid,
  mixUint32,
  type EntityId,
  type SpatialIndexQueryResult,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

export interface SpatialIndexBenchmarkReport {
  readonly name: "spatial-index";
  readonly entityCount: number;
  readonly capacity: number;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly queryCount: number;
  readonly movedEntities: number;
  readonly cleanupCount: number;
  readonly finalMapMemberships: number;
  readonly finalIndexedEntities: number;
  readonly finalBacklogCount: number;
  readonly occupancySetCount: number;
  readonly occupancyClearedCount: number;
  readonly indexAddedCount: number;
  readonly indexRemovedCount: number;
  readonly queryChecksum: number;
  readonly movementChecksum: number;
  readonly cleanupChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface SpatialIndexBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly entityCount: number;
  readonly capacity: number;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly queryCount: number;
  readonly movedEntities: number;
  readonly cleanupCount: number;
  readonly finalMapMemberships: number;
  readonly finalIndexedEntities: number;
  readonly finalBacklogCount: number;
  readonly occupancySetCount: number;
  readonly occupancyClearedCount: number;
  readonly indexAddedCount: number;
  readonly indexRemovedCount: number;
  readonly queryChecksum: number;
  readonly movementChecksum: number;
  readonly cleanupChecksum: number;
}

export interface SampledSpatialIndexBenchmark {
  readonly name: "spatial-index";
  readonly report: SpatialIndexBenchmarkReport;
  readonly invariants: SpatialIndexBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runSpatialIndexBenchmark(): SpatialIndexBenchmarkReport {
  const entityCount = 50_000;
  const capacity = entityCount;
  const width = 256;
  const height = 256;
  const chunkSize = 32;
  const movedEntities = 1_024;
  const cleanupCount = 512;
  const registry = createEntityRegistry({ capacity });
  const grid = createMapGrid({ width, height, chunkSize });
  const locations = createLocationStore({ capacity, width, height, chunkSize });
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  const entities = new Array<EntityId>(entityCount);

  for (let index = 0; index < entityCount; index += 1) {
    const entity = allocateOrThrow(registry);
    entities[index] = entity;
    placeOrThrow(locations, entity, registry, grid, index);
  }

  let queryCount = 0;
  let queryChecksum = 0;
  const smallOutput = new Uint32Array(64);
  const regionOutput = new Uint32Array(entityCount);

  for (let index = 0; index < 128; index += 1) {
    const query = locations.queryCell(index, 0, smallOutput);
    queryChecksum = mixQueryChecksum(queryChecksum, query, smallOutput);
    queryCount += 1;
  }

  for (let chunkIndex = 0; chunkIndex < 16; chunkIndex += 1) {
    const query = locations.queryChunk(chunkIndex, regionOutput);
    queryChecksum = mixQueryChecksum(queryChecksum, query, regionOutput);
    queryCount += 1;
  }

  const regionQuery = locations.queryRegion(0, regionOutput);
  queryChecksum = mixQueryChecksum(queryChecksum, regionQuery, regionOutput);
  queryCount += 1;

  let movementChecksum = 0;
  for (let index = 0; index < movedEntities; index += 1) {
    const entity = entities[index] ?? failMissingEntity(index);
    const targetCell = entityCount + index;
    const result = locations.placeOnMap(
      entity,
      registry,
      grid,
      targetCell % width,
      Math.floor(targetCell / width),
    );

    if (!result.ok) {
      throw new Error(result.reason);
    }

    movementChecksum = mixUint32(movementChecksum, result.version);
    movementChecksum = mixUint32(movementChecksum, targetCell);
  }

  let cleanupChecksum = 0;
  for (let index = 0; index < cleanupCount; index += 1) {
    const entity = entities[entityCount - 1 - index] ?? failMissingEntity(index);
    const result = locations.clearLocation(entity, registry, grid, "despawn");

    if (!result.ok) {
      throw new Error(result.reason);
    }

    cleanupChecksum = mixUint32(cleanupChecksum, result.version);
    cleanupChecksum = mixUint32(cleanupChecksum, entity.index);
  }

  const metrics = locations.createMetrics();
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "spatial-index",
    entityCount,
    capacity,
    width,
    height,
    chunkSize,
    queryCount,
    movedEntities,
    cleanupCount,
    finalMapMemberships: metrics.mapMembershipCount,
    finalIndexedEntities: metrics.spatial.indexedEntityCount,
    finalBacklogCount: metrics.spatial.backlogCount,
    occupancySetCount: metrics.occupancySetCount,
    occupancyClearedCount: metrics.occupancyClearedCount,
    indexAddedCount: metrics.indexAddedCount,
    indexRemovedCount: metrics.indexRemovedCount,
    queryChecksum,
    movementChecksum,
    cleanupChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function spatialIndexInvariantsFromReport(
  report: SpatialIndexBenchmarkReport,
): SpatialIndexBenchmarkInvariants {
  return {
    entityCount: report.entityCount,
    capacity: report.capacity,
    width: report.width,
    height: report.height,
    chunkSize: report.chunkSize,
    queryCount: report.queryCount,
    movedEntities: report.movedEntities,
    cleanupCount: report.cleanupCount,
    finalMapMemberships: report.finalMapMemberships,
    finalIndexedEntities: report.finalIndexedEntities,
    finalBacklogCount: report.finalBacklogCount,
    occupancySetCount: report.occupancySetCount,
    occupancyClearedCount: report.occupancyClearedCount,
    indexAddedCount: report.indexAddedCount,
    indexRemovedCount: report.indexRemovedCount,
    queryChecksum: report.queryChecksum,
    movementChecksum: report.movementChecksum,
    cleanupChecksum: report.cleanupChecksum,
  };
}

function allocateOrThrow(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.entity;
}

function placeOrThrow(
  locations: ReturnType<typeof createLocationStore>,
  entity: EntityId,
  registry: ReturnType<typeof createEntityRegistry>,
  grid: ReturnType<typeof createMapGrid>,
  cellIndex: number,
): void {
  const result = locations.placeOnMap(
    entity,
    registry,
    grid,
    cellIndex % 256,
    Math.floor(cellIndex / 256),
  );

  if (!result.ok) {
    throw new Error(result.reason);
  }
}

function mixQueryChecksum(
  checksum: number,
  query: SpatialIndexQueryResult,
  output: Uint32Array,
): number {
  if (!query.ok) {
    throw new Error(query.reason);
  }

  let mixed = mixUint32(checksum, query.count);
  mixed = mixUint32(mixed, query.totalCount);
  mixed = mixUint32(mixed, query.visitedCount);

  for (let index = 0; index < query.count; index += 1) {
    mixed = mixUint32(mixed, output[index] ?? 0);
  }

  return mixed;
}

function failMissingEntity(index: number): never {
  throw new Error(`missing benchmark entity ${String(index)}`);
}
