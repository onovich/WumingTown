import { describe, expect, it } from "vitest";

import {
  LOCATION_CONTAINER,
  LOCATION_MAP,
  LOCATION_NONE,
  createEntityRegistry,
  createLocationStore,
  createMapGrid,
  type EntityId,
  type LocationCleanupReason,
  type LocationStoreOptions,
} from "./index";

describe("location store and spatial indexes", () => {
  it("maintains exactly one map or container membership per entity", () => {
    const { registry, grid, locations } = createFixture(4);
    const entity = allocateOrThrow(registry);
    const container = allocateOrThrow(registry);

    expect(locations.placeOnMap(entity, registry, grid, 1, 1)).toMatchObject({
      ok: true,
      changed: true,
      indexAddedCount: 1,
      occupancySetCount: 1,
    });
    expect(readKind(locations, entity, registry)).toBe(LOCATION_MAP);
    expect(readOccupancy(grid, 1, 1)).toBe(entity.index + 1);
    expect(locations.mapMembershipCount).toBe(1);
    expect(locations.containerMembershipCount).toBe(0);

    expect(locations.placeInContainer(entity, registry, grid, container, 7)).toMatchObject({
      ok: true,
      changed: true,
      indexRemovedCount: 1,
      occupancyClearedCount: 1,
    });
    expect(readKind(locations, entity, registry)).toBe(LOCATION_CONTAINER);
    expect(readOccupancy(grid, 1, 1)).toBe(0);
    expect(locations.mapMembershipCount).toBe(0);
    expect(locations.containerMembershipCount).toBe(1);

    expect(locations.placeOnMap(entity, registry, grid, 2, 2)).toMatchObject({
      ok: true,
      changed: true,
      indexAddedCount: 1,
      occupancySetCount: 1,
    });
    expect(readKind(locations, entity, registry)).toBe(LOCATION_MAP);
    expect(readOccupancy(grid, 2, 2)).toBe(entity.index + 1);
    expect(locations.mapMembershipCount).toBe(1);
    expect(locations.containerMembershipCount).toBe(0);
  });

  it("rejects occupied cells without changing the incoming entity", () => {
    const { registry, grid, locations } = createFixture(4);
    const first = allocateOrThrow(registry);
    const second = allocateOrThrow(registry);

    expect(locations.placeOnMap(first, registry, grid, 0, 0).ok).toBe(true);
    expect(locations.placeOnMap(second, registry, grid, 0, 0)).toStrictEqual({
      ok: false,
      reason: "location_cell_occupied",
    });
    expect(readKind(locations, second, registry)).toBe(LOCATION_NONE);
    expect(locations.mapMembershipCount).toBe(1);
  });

  it("moves entities between map cells and clears old indexed membership", () => {
    const { registry, grid, locations } = createFixture(4);
    const entity = allocateOrThrow(registry);
    const output = new Uint32Array(4);

    expect(locations.placeOnMap(entity, registry, grid, 1, 1).ok).toBe(true);
    expect(locations.placeOnMap(entity, registry, grid, 5, 1)).toMatchObject({
      ok: true,
      changed: true,
      indexRemovedCount: 1,
      indexAddedCount: 1,
      occupancyClearedCount: 1,
      occupancySetCount: 1,
    });

    expect(readOccupancy(grid, 1, 1)).toBe(0);
    expect(readOccupancy(grid, 5, 1)).toBe(entity.index + 1);
    expect(locations.queryCell(1, 1, output)).toStrictEqual({
      ok: true,
      count: 0,
      totalCount: 0,
      visitedCount: 0,
      truncated: false,
    });
    expect(locations.queryCell(5, 1, output)).toStrictEqual({
      ok: true,
      count: 1,
      totalCount: 1,
      visitedCount: 1,
      truncated: false,
    });
    expect(output[0]).toBe(entity.index);
  });

  it("iterates indexed chunk and region queries in stable entity-index order", () => {
    const { registry, grid, locations } = createFixture(8);
    const first = allocateOrThrow(registry);
    const second = allocateOrThrow(registry);
    const third = allocateOrThrow(registry);
    const output = new Uint32Array(8);
    const generations = new Uint32Array(8);

    expect(locations.placeOnMap(third, registry, grid, 2, 0).ok).toBe(true);
    expect(locations.placeOnMap(first, registry, grid, 0, 0).ok).toBe(true);
    expect(locations.placeOnMap(second, registry, grid, 1, 0).ok).toBe(true);

    const chunkResult = locations.queryChunk(0, output, generations);
    expect(chunkResult).toStrictEqual({
      ok: true,
      count: 3,
      totalCount: 3,
      visitedCount: 3,
      truncated: false,
    });
    expect(Array.from(output.slice(0, 3))).toStrictEqual([0, 1, 2]);
    expect(Array.from(generations.slice(0, 3))).toStrictEqual([1, 1, 1]);

    const regionResult = locations.queryRegion(0, output);
    expect(regionResult).toMatchObject({
      ok: true,
      count: 3,
      totalCount: 3,
      visitedCount: 3,
      truncated: false,
    });
    expect(Array.from(output.slice(0, 3))).toStrictEqual([0, 1, 2]);
  });

  it("rejects stale generations after direct destroy and slot reuse", () => {
    const registry = createEntityRegistry({ capacity: 1 });
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    const locations = createLocationStore({ capacity: 1, width: 4, height: 4, chunkSize: 2 });
    const stale = allocateOrThrow(registry);

    expect(locations.placeOnMap(stale, registry, grid, 1, 1).ok).toBe(true);
    expect(registry.destroy(stale).ok).toBe(true);
    const reused = allocateOrThrow(registry);

    expect(reused.index).toBe(stale.index);
    expect(reused.generation).toBe(stale.generation + 1);
    expect(locations.placeOnMap(stale, registry, grid, 2, 2)).toStrictEqual({
      ok: false,
      reason: "location_entity_generation_mismatch",
    });
  });

  it("cleans index, occupancy and reservation hooks on despawn and destroy", () => {
    const releaseCalls: string[] = [];
    const { registry, grid, locations } = createFixture(4, {
      releaseReservationsForEntity(entity: EntityId, reason: LocationCleanupReason): number {
        releaseCalls.push(`${String(entity.index)}:${reason}`);
        return 2;
      },
    });
    const despawned = allocateOrThrow(registry);
    const destroyed = allocateOrThrow(registry);
    const output = new Uint32Array(4);

    expect(locations.placeOnMap(despawned, registry, grid, 1, 1).ok).toBe(true);
    expect(locations.placeOnMap(destroyed, registry, grid, 2, 1).ok).toBe(true);
    expect(locations.clearLocation(despawned, registry, grid, "despawn")).toMatchObject({
      ok: true,
      changed: true,
      indexRemovedCount: 1,
      occupancyClearedCount: 1,
      reservationCleanupCount: 2,
    });
    expect(readOccupancy(grid, 1, 1)).toBe(0);
    expect(locations.queryCell(1, 1, output)).toMatchObject({ ok: true, totalCount: 0 });
    expect(readKind(locations, despawned, registry)).toBe(LOCATION_NONE);

    const destroyResult = locations.destroyAndCleanup(destroyed, registry, grid);
    expect(destroyResult).toMatchObject({
      ok: true,
      changed: true,
      nextGeneration: destroyed.generation + 1,
      indexRemovedCount: 1,
      occupancyClearedCount: 1,
      reservationCleanupCount: 2,
    });
    expect(readOccupancy(grid, 2, 1)).toBe(0);
    expect(registry.isAlive(destroyed)).toBe(false);
    expect(releaseCalls).toStrictEqual(["0:despawn", "1:destroy"]);
    expect(locations.createMetrics()).toMatchObject({
      mapMembershipCount: 0,
      containerMembershipCount: 0,
      cleanupCount: 2,
      reservationCleanupCount: 4,
      spatial: {
        indexedEntityCount: 0,
        backlogCount: 0,
      },
    });
  });

  it("keeps inert indexed entity pressure free of derived backlog growth", () => {
    const capacity = 2_048;
    const registry = createEntityRegistry({ capacity });
    const grid = createMapGrid({ width: 64, height: 64, chunkSize: 16 });
    const locations = createLocationStore({ capacity, width: 64, height: 64, chunkSize: 16 });

    for (let index = 0; index < capacity; index += 1) {
      const entity = allocateOrThrow(registry);
      const x = index % 64;
      const y = Math.floor(index / 64);
      const placed = locations.placeOnMap(entity, registry, grid, x, y);

      if (!placed.ok) {
        throw new Error(placed.reason);
      }
    }

    const metrics = locations.createMetrics();
    expect(metrics.mapMembershipCount).toBe(capacity);
    expect(metrics.spatial.indexedEntityCount).toBe(capacity);
    expect(metrics.spatial.backlogCount).toBe(0);
    expect(metrics.cleanupCount).toBe(0);
  });
});

function createFixture(
  capacity: number,
  lifecycleHooks?: Parameters<typeof createLocationStore>[0]["lifecycleHooks"],
): {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly grid: ReturnType<typeof createMapGrid>;
  readonly locations: ReturnType<typeof createLocationStore>;
} {
  const registry = createEntityRegistry({ capacity });
  const grid = createMapGrid({ width: 8, height: 8, chunkSize: 4 });
  const locationOptions: LocationStoreOptions = {
    capacity,
    width: 8,
    height: 8,
    chunkSize: 4,
  };
  const locations =
    lifecycleHooks === undefined
      ? createLocationStore(locationOptions)
      : createLocationStore({ ...locationOptions, lifecycleHooks });

  return { registry, grid, locations };
}

function allocateOrThrow(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.entity;
}

function readKind(
  locations: ReturnType<typeof createLocationStore>,
  entity: EntityId,
  registry: ReturnType<typeof createEntityRegistry>,
): number {
  const result = locations.read(entity, registry);

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.location.kind;
}

function readOccupancy(grid: ReturnType<typeof createMapGrid>, x: number, y: number): number {
  const result = grid.readCell(x, y);

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.cell.occupancy;
}
