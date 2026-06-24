import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { MapGrid } from "./map-grid";
import {
  SpatialIndex,
  type SpatialIndexMetrics,
  type SpatialIndexQueryResult,
} from "./spatial-index";

export const LOCATION_NONE = 0;
export const LOCATION_MAP = 1;
export const LOCATION_CONTAINER = 2;

export type LocationKind = typeof LOCATION_NONE | typeof LOCATION_MAP | typeof LOCATION_CONTAINER;
export type LocationCleanupReason = "despawn" | "destroy";

export type LocationStoreReason =
  | "location_entity_index_out_of_range"
  | "location_entity_not_alive"
  | "location_entity_generation_mismatch"
  | "location_container_not_alive"
  | "location_container_generation_mismatch"
  | "location_container_self_reference"
  | "location_coordinate_out_of_range"
  | "location_slot_out_of_range"
  | "location_cell_occupied"
  | "location_occupancy_conflict"
  | "location_region_out_of_range"
  | "location_map_update_failed"
  | "location_destroy_failed";

export type LocationMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly version: number;
      readonly indexRemovedCount: number;
      readonly indexAddedCount: number;
      readonly occupancyClearedCount: number;
      readonly occupancySetCount: number;
      readonly reservationCleanupCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: LocationStoreReason;
    };

export type LocationDestroyResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly version: number;
      readonly nextGeneration: number;
      readonly indexRemovedCount: number;
      readonly occupancyClearedCount: number;
      readonly reservationCleanupCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: LocationStoreReason;
    };

export type LocationReadResult =
  | {
      readonly ok: true;
      readonly location: LocationView;
    }
  | {
      readonly ok: false;
      readonly reason: LocationStoreReason;
    };

type LocationValidationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: LocationStoreReason;
    };

type LocationGridUpdateResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: LocationStoreReason;
    };

export interface LocationView {
  readonly kind: LocationKind;
  readonly entity: EntityId;
  readonly x: number;
  readonly y: number;
  readonly cellIndex: number;
  readonly chunkIndex: number;
  readonly regionId: number;
  readonly containerIndex: number;
  readonly containerGeneration: number;
  readonly slot: number;
}

export interface LocationLifecycleHooks {
  releaseReservationsForEntity(entity: EntityId, reason: LocationCleanupReason): number;
}

export interface LocationStoreOptions {
  readonly capacity: number;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly regionCapacity?: number;
  readonly lifecycleHooks?: LocationLifecycleHooks;
}

export interface LocationStoreMetrics {
  readonly version: number;
  readonly mapMembershipCount: number;
  readonly containerMembershipCount: number;
  readonly noneCount: number;
  readonly cleanupCount: number;
  readonly reservationCleanupCount: number;
  readonly occupancySetCount: number;
  readonly occupancyClearedCount: number;
  readonly indexAddedCount: number;
  readonly indexRemovedCount: number;
  readonly spatial: SpatialIndexMetrics;
}

export class LocationStore {
  readonly capacity: number;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly chunkColumns: number;
  readonly chunkRows: number;
  readonly cellCount: number;
  readonly chunkCount: number;
  readonly regionCapacity: number;
  readonly spatialIndex: SpatialIndex;

  private readonly kind: Uint8Array;
  private readonly generations: Uint32Array;
  private readonly x: Int32Array;
  private readonly y: Int32Array;
  private readonly cellIndex: Uint32Array;
  private readonly chunkIndex: Uint32Array;
  private readonly regionId: Uint32Array;
  private readonly containerIndex: Uint32Array;
  private readonly containerGeneration: Uint32Array;
  private readonly slot: Uint32Array;
  private readonly lifecycleHooks: LocationLifecycleHooks | undefined;
  private storeVersion = 0;
  private mapCount = 0;
  private containerCount = 0;
  private cleanupTotal = 0;
  private reservationCleanupTotal = 0;
  private occupancySetTotal = 0;
  private occupancyClearedTotal = 0;
  private indexAddedTotal = 0;
  private indexRemovedTotal = 0;

  constructor(options: LocationStoreOptions) {
    assertValidCapacity(options.capacity, "location capacity");
    this.width = requirePositiveSafeInteger(options.width, "location map width");
    this.height = requirePositiveSafeInteger(options.height, "location map height");
    this.chunkSize = requirePositiveSafeInteger(options.chunkSize, "location chunk size");
    this.capacity = options.capacity;
    this.cellCount = requirePositiveSafeInteger(this.width * this.height, "location cell count");
    this.chunkColumns = Math.ceil(this.width / this.chunkSize);
    this.chunkRows = Math.ceil(this.height / this.chunkSize);
    this.chunkCount = requirePositiveSafeInteger(
      this.chunkColumns * this.chunkRows,
      "location chunk count",
    );
    this.regionCapacity = requirePositiveSafeInteger(
      options.regionCapacity ?? this.cellCount + 1,
      "region capacity",
    );
    this.kind = new Uint8Array(options.capacity);
    this.generations = new Uint32Array(options.capacity);
    this.x = new Int32Array(options.capacity);
    this.y = new Int32Array(options.capacity);
    this.cellIndex = new Uint32Array(options.capacity);
    this.chunkIndex = new Uint32Array(options.capacity);
    this.regionId = new Uint32Array(options.capacity);
    this.containerIndex = new Uint32Array(options.capacity);
    this.containerGeneration = new Uint32Array(options.capacity);
    this.slot = new Uint32Array(options.capacity);
    this.lifecycleHooks = options.lifecycleHooks;
    this.spatialIndex = new SpatialIndex({
      capacity: options.capacity,
      cellCount: this.cellCount,
      chunkCount: this.chunkCount,
      regionCapacity: this.regionCapacity,
    });
  }

  get version(): number {
    return this.storeVersion;
  }

  get mapMembershipCount(): number {
    return this.mapCount;
  }

  get containerMembershipCount(): number {
    return this.containerCount;
  }

  placeOnMap(
    entity: EntityId,
    registry: EntityRegistry,
    grid: MapGrid,
    x: number,
    y: number,
  ): LocationMutationResult {
    const validation = this.validateEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    const target = this.resolveMapTarget(grid, x, y, occupancyValue(entity.index));

    if (!target.ok) {
      return target;
    }

    const previousKind = this.kind[entity.index] ?? LOCATION_NONE;
    const previousCell = this.cellIndex[entity.index] ?? 0;
    const previousChunk = this.chunkIndex[entity.index] ?? 0;
    const previousRegion = this.regionId[entity.index] ?? 0;

    if (
      previousKind === LOCATION_MAP &&
      previousCell === target.cellIndex &&
      previousRegion === target.regionId
    ) {
      return this.createMutationResult(false, 0, 0, 0, 0, 0);
    }

    let indexRemovedCount = 0;
    let occupancyClearedCount = 0;

    if (previousKind === LOCATION_MAP) {
      const removed = this.removeFromSpatialIndex(
        entity.index,
        previousCell,
        previousChunk,
        previousRegion,
      );

      if (!removed.ok) {
        return { ok: false, reason: "location_region_out_of_range" };
      }

      indexRemovedCount = 1;
    } else if (previousKind === LOCATION_CONTAINER) {
      this.containerCount -= 1;
    }

    const setOccupancy = setGridOccupancy(grid, x, y, occupancyValue(entity.index));

    if (!setOccupancy.ok) {
      return setOccupancy;
    }

    if (previousKind === LOCATION_MAP && previousCell !== target.cellIndex) {
      const cleared = this.clearPreviousMapOccupancy(grid, entity.index);

      if (!cleared.ok) {
        return cleared;
      }

      occupancyClearedCount = cleared.changed ? 1 : 0;
    }

    const inserted = this.spatialIndex.insert(
      entity.index,
      entity.generation,
      target.cellIndex,
      target.chunkIndex,
      target.regionId,
    );

    if (!inserted.ok) {
      return { ok: false, reason: "location_region_out_of_range" };
    }

    this.kind[entity.index] = LOCATION_MAP;
    this.generations[entity.index] = entity.generation;
    this.x[entity.index] = x;
    this.y[entity.index] = y;
    this.cellIndex[entity.index] = target.cellIndex;
    this.chunkIndex[entity.index] = target.chunkIndex;
    this.regionId[entity.index] = target.regionId;
    this.clearContainerLanes(entity.index);

    if (previousKind !== LOCATION_MAP) {
      this.mapCount += 1;
    }

    return this.commitMutation(
      true,
      indexRemovedCount,
      1,
      occupancyClearedCount,
      setOccupancy.changed ? 1 : 0,
      0,
    );
  }

  placeInContainer(
    entity: EntityId,
    registry: EntityRegistry,
    grid: MapGrid,
    container: EntityId,
    slot: number,
  ): LocationMutationResult {
    const validation = this.validateEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    const containerValidation = this.validateContainer(entity, container, registry, slot);

    if (!containerValidation.ok) {
      return containerValidation;
    }

    const previousKind = this.kind[entity.index] ?? LOCATION_NONE;

    if (
      previousKind === LOCATION_CONTAINER &&
      this.containerIndex[entity.index] === container.index &&
      this.containerGeneration[entity.index] === container.generation &&
      this.slot[entity.index] === slot
    ) {
      return this.createMutationResult(false, 0, 0, 0, 0, 0);
    }

    let indexRemovedCount = 0;
    let occupancyClearedCount = 0;

    if (previousKind === LOCATION_MAP) {
      const removed = this.removeFromSpatialIndex(
        entity.index,
        this.cellIndex[entity.index] ?? 0,
        this.chunkIndex[entity.index] ?? 0,
        this.regionId[entity.index] ?? 0,
      );

      if (!removed.ok) {
        return { ok: false, reason: "location_region_out_of_range" };
      }

      const cleared = this.clearPreviousMapOccupancy(grid, entity.index);

      if (!cleared.ok) {
        return cleared;
      }

      indexRemovedCount = 1;
      occupancyClearedCount = cleared.changed ? 1 : 0;
      this.mapCount -= 1;
      this.containerCount += 1;
    } else if (previousKind === LOCATION_NONE) {
      this.containerCount += 1;
    }

    this.kind[entity.index] = LOCATION_CONTAINER;
    this.generations[entity.index] = entity.generation;
    this.clearMapLanes(entity.index);
    this.containerIndex[entity.index] = container.index;
    this.containerGeneration[entity.index] = container.generation;
    this.slot[entity.index] = slot;

    return this.commitMutation(true, indexRemovedCount, 0, occupancyClearedCount, 0, 0);
  }

  clearLocation(
    entity: EntityId,
    registry: EntityRegistry,
    grid: MapGrid,
    reason: LocationCleanupReason,
  ): LocationMutationResult {
    const validation = this.validateEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    const reservationCleanupCount = this.releaseReservations(entity, reason);
    const previousKind = this.kind[entity.index] ?? LOCATION_NONE;

    if (previousKind === LOCATION_NONE) {
      return this.commitMutation(false, 0, 0, 0, 0, reservationCleanupCount);
    }

    let indexRemovedCount = 0;
    let occupancyClearedCount = 0;

    if (previousKind === LOCATION_MAP) {
      const removed = this.removeFromSpatialIndex(
        entity.index,
        this.cellIndex[entity.index] ?? 0,
        this.chunkIndex[entity.index] ?? 0,
        this.regionId[entity.index] ?? 0,
      );

      if (!removed.ok) {
        return { ok: false, reason: "location_region_out_of_range" };
      }

      const cleared = this.clearPreviousMapOccupancy(grid, entity.index);

      if (!cleared.ok) {
        return cleared;
      }

      indexRemovedCount = 1;
      occupancyClearedCount = cleared.changed ? 1 : 0;
      this.mapCount -= 1;
    } else {
      this.containerCount -= 1;
    }

    this.clearAllLanes(entity.index);
    this.cleanupTotal += 1;
    return this.commitMutation(
      true,
      indexRemovedCount,
      0,
      occupancyClearedCount,
      0,
      reservationCleanupCount,
    );
  }

  destroyAndCleanup(
    entity: EntityId,
    registry: EntityRegistry,
    grid: MapGrid,
  ): LocationDestroyResult {
    const cleared = this.clearLocation(entity, registry, grid, "destroy");

    if (!cleared.ok) {
      return cleared;
    }

    const destroyed = registry.destroy(entity);

    if (!destroyed.ok) {
      return { ok: false, reason: "location_destroy_failed" };
    }

    return {
      ok: true,
      changed: cleared.changed,
      version: cleared.version,
      nextGeneration: destroyed.nextGeneration,
      indexRemovedCount: cleared.indexRemovedCount,
      occupancyClearedCount: cleared.occupancyClearedCount,
      reservationCleanupCount: cleared.reservationCleanupCount,
    };
  }

  read(entity: EntityId, registry: EntityRegistry): LocationReadResult {
    const validation = this.validateEntity(entity, registry);

    if (!validation.ok) {
      return validation;
    }

    return {
      ok: true,
      location: {
        kind: this.readKind(entity.index),
        entity,
        x: this.x[entity.index] ?? 0,
        y: this.y[entity.index] ?? 0,
        cellIndex: this.cellIndex[entity.index] ?? 0,
        chunkIndex: this.chunkIndex[entity.index] ?? 0,
        regionId: this.regionId[entity.index] ?? 0,
        containerIndex: this.containerIndex[entity.index] ?? 0,
        containerGeneration: this.containerGeneration[entity.index] ?? 0,
        slot: this.slot[entity.index] ?? 0,
      },
    };
  }

  queryCell(
    x: number,
    y: number,
    outputIndexes: Uint32Array,
    outputGenerations?: Uint32Array,
  ): SpatialIndexQueryResult {
    const cellIndex = this.cellIndexOf(x, y);

    if (cellIndex < 0) {
      return { ok: false, reason: "spatial_cell_out_of_range" };
    }

    return this.spatialIndex.queryCell(cellIndex, outputIndexes, outputGenerations);
  }

  queryChunk(
    chunkIndex: number,
    outputIndexes: Uint32Array,
    outputGenerations?: Uint32Array,
  ): SpatialIndexQueryResult {
    return this.spatialIndex.queryChunk(chunkIndex, outputIndexes, outputGenerations);
  }

  queryRegion(
    regionId: number,
    outputIndexes: Uint32Array,
    outputGenerations?: Uint32Array,
  ): SpatialIndexQueryResult {
    return this.spatialIndex.queryRegion(regionId, outputIndexes, outputGenerations);
  }

  createMetrics(): LocationStoreMetrics {
    return {
      version: this.storeVersion,
      mapMembershipCount: this.mapCount,
      containerMembershipCount: this.containerCount,
      noneCount: this.capacity - this.mapCount - this.containerCount,
      cleanupCount: this.cleanupTotal,
      reservationCleanupCount: this.reservationCleanupTotal,
      occupancySetCount: this.occupancySetTotal,
      occupancyClearedCount: this.occupancyClearedTotal,
      indexAddedCount: this.indexAddedTotal,
      indexRemovedCount: this.indexRemovedTotal,
      spatial: this.spatialIndex.createMetrics(),
    };
  }

  private validateEntity(entity: EntityId, registry: EntityRegistry): LocationValidationResult {
    if (!isIndexInRange(entity.index, this.capacity)) {
      return { ok: false, reason: "location_entity_index_out_of_range" };
    }

    const validation = registry.validate(entity);

    if (validation.ok) {
      return { ok: true };
    }

    if (validation.reason === "entity_generation_mismatch") {
      return { ok: false, reason: "location_entity_generation_mismatch" };
    }

    return { ok: false, reason: "location_entity_not_alive" };
  }

  private validateContainer(
    entity: EntityId,
    container: EntityId,
    registry: EntityRegistry,
    slot: number,
  ): LocationValidationResult {
    if (entity.index === container.index && entity.generation === container.generation) {
      return { ok: false, reason: "location_container_self_reference" };
    }

    if (!Number.isSafeInteger(slot) || slot < 0 || slot > 0xffff_ffff) {
      return { ok: false, reason: "location_slot_out_of_range" };
    }

    const validation = registry.validate(container);

    if (validation.ok) {
      return { ok: true };
    }

    if (validation.reason === "entity_generation_mismatch") {
      return { ok: false, reason: "location_container_generation_mismatch" };
    }

    return { ok: false, reason: "location_container_not_alive" };
  }

  private resolveMapTarget(
    grid: MapGrid,
    x: number,
    y: number,
    expectedOccupancy: number,
  ):
    | {
        readonly ok: true;
        readonly cellIndex: number;
        readonly chunkIndex: number;
        readonly regionId: number;
      }
    | {
        readonly ok: false;
        readonly reason: LocationStoreReason;
      } {
    const cell = grid.readCell(x, y);

    if (!cell.ok) {
      return { ok: false, reason: "location_coordinate_out_of_range" };
    }

    if (cell.cell.occupancy !== 0 && cell.cell.occupancy !== expectedOccupancy) {
      return { ok: false, reason: "location_cell_occupied" };
    }

    if (!isIndexInRange(cell.cell.regionId, this.regionCapacity)) {
      return { ok: false, reason: "location_region_out_of_range" };
    }

    return {
      ok: true,
      cellIndex: cell.cell.cellIndex,
      chunkIndex: cell.cell.chunkIndex,
      regionId: cell.cell.regionId,
    };
  }

  private removeFromSpatialIndex(
    entityIndex: number,
    cellIndex: number,
    chunkIndex: number,
    regionId: number,
  ): ReturnType<SpatialIndex["remove"]> {
    return this.spatialIndex.remove(entityIndex, cellIndex, chunkIndex, regionId);
  }

  private clearPreviousMapOccupancy(grid: MapGrid, entityIndex: number): LocationGridUpdateResult {
    const x = this.x[entityIndex] ?? 0;
    const y = this.y[entityIndex] ?? 0;
    const cell = grid.readCell(x, y);

    if (!cell.ok) {
      return { ok: false, reason: "location_coordinate_out_of_range" };
    }

    if (cell.cell.occupancy === 0) {
      return { ok: true, changed: false };
    }

    if (cell.cell.occupancy !== occupancyValue(entityIndex)) {
      return { ok: false, reason: "location_occupancy_conflict" };
    }

    return setGridOccupancy(grid, x, y, 0);
  }

  private commitMutation(
    changed: boolean,
    indexRemovedCount: number,
    indexAddedCount: number,
    occupancyClearedCount: number,
    occupancySetCount: number,
    reservationCleanupCount: number,
  ): LocationMutationResult {
    if (changed || reservationCleanupCount > 0) {
      this.storeVersion += 1;
    }

    this.indexRemovedTotal += indexRemovedCount;
    this.indexAddedTotal += indexAddedCount;
    this.occupancyClearedTotal += occupancyClearedCount;
    this.occupancySetTotal += occupancySetCount;
    this.reservationCleanupTotal += reservationCleanupCount;

    return this.createMutationResult(
      changed,
      indexRemovedCount,
      indexAddedCount,
      occupancyClearedCount,
      occupancySetCount,
      reservationCleanupCount,
    );
  }

  private createMutationResult(
    changed: boolean,
    indexRemovedCount: number,
    indexAddedCount: number,
    occupancyClearedCount: number,
    occupancySetCount: number,
    reservationCleanupCount: number,
  ): LocationMutationResult {
    return {
      ok: true,
      changed,
      version: this.storeVersion,
      indexRemovedCount,
      indexAddedCount,
      occupancyClearedCount,
      occupancySetCount,
      reservationCleanupCount,
    };
  }

  private releaseReservations(entity: EntityId, reason: LocationCleanupReason): number {
    return this.lifecycleHooks?.releaseReservationsForEntity(entity, reason) ?? 0;
  }

  private cellIndexOf(x: number, y: number): number {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
      return -1;
    }

    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return -1;
    }

    return y * this.width + x;
  }

  private clearMapLanes(index: number): void {
    this.x[index] = 0;
    this.y[index] = 0;
    this.cellIndex[index] = 0;
    this.chunkIndex[index] = 0;
    this.regionId[index] = 0;
  }

  private clearContainerLanes(index: number): void {
    this.containerIndex[index] = 0;
    this.containerGeneration[index] = 0;
    this.slot[index] = 0;
  }

  private clearAllLanes(index: number): void {
    this.kind[index] = LOCATION_NONE;
    this.generations[index] = 0;
    this.clearMapLanes(index);
    this.clearContainerLanes(index);
  }

  private readKind(index: number): LocationKind {
    const kind = this.kind[index] ?? LOCATION_NONE;

    if (kind === LOCATION_MAP) {
      return LOCATION_MAP;
    }

    if (kind === LOCATION_CONTAINER) {
      return LOCATION_CONTAINER;
    }

    return LOCATION_NONE;
  }
}

export function createLocationStore(options: LocationStoreOptions): LocationStore {
  return new LocationStore(options);
}

function setGridOccupancy(
  grid: MapGrid,
  x: number,
  y: number,
  occupancy: number,
): LocationGridUpdateResult {
  const update = grid.updateCell(x, y, { occupancy });

  if (!update.ok) {
    return { ok: false, reason: "location_map_update_failed" };
  }

  return {
    ok: true,
    changed: update.changed,
  };
}

function occupancyValue(entityIndex: number): number {
  return entityIndex + 1;
}

function requirePositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}
