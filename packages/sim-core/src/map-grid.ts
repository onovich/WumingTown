import { createMapGridHashFields } from "./map-grid-hash";
import type { CanonicalWorldField } from "./world-hash";

export const MAP_GRID_SNAPSHOT_VERSION = 1;
export const DEFAULT_WALK_COST_MILLI = 1_000;
export const MAP_TERRAIN_BLOCKED = 1;
export const MAP_DIRECTION_NORTH = 0;
export const MAP_DIRECTION_EAST = 1;
export const MAP_DIRECTION_SOUTH = 2;
export const MAP_DIRECTION_WEST = 3;
export const MAP_DIRECTION_MASK_NORTH = 1 << MAP_DIRECTION_NORTH;
export const MAP_DIRECTION_MASK_EAST = 1 << MAP_DIRECTION_EAST;
export const MAP_DIRECTION_MASK_SOUTH = 1 << MAP_DIRECTION_SOUTH;
export const MAP_DIRECTION_MASK_WEST = 1 << MAP_DIRECTION_WEST;
export const MAP_DIRECTION_MASK_CARDINAL =
  MAP_DIRECTION_MASK_NORTH |
  MAP_DIRECTION_MASK_EAST |
  MAP_DIRECTION_MASK_SOUTH |
  MAP_DIRECTION_MASK_WEST;

export type MapGridReason =
  | "map_coordinate_out_of_range"
  | "map_cell_index_out_of_range"
  | "map_direction_out_of_range"
  | "map_cells_not_cardinal_neighbors"
  | "map_value_out_of_range"
  | "map_budget_out_of_range"
  | "map_dirty_output_too_small"
  | "map_version_exhausted";

export interface MapGridOptions {
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly defaultWalkCostMilli?: number;
}

export interface MapCellUpdate {
  readonly terrain?: number;
  readonly occupancy?: number;
  readonly walkCostMilli?: number;
  readonly wallMask?: number;
  readonly doorMask?: number;
  readonly regionId?: number;
  readonly roomId?: number;
}

export interface MapCellView {
  readonly cellIndex: number;
  readonly chunkIndex: number;
  readonly terrain: number;
  readonly occupancy: number;
  readonly walkCostMilli: number;
  readonly wallMask: number;
  readonly doorMask: number;
  readonly regionId: number;
  readonly roomId: number;
  readonly cellVersion: number;
}

export type MapCellReadResult =
  | {
      readonly ok: true;
      readonly cell: MapCellView;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<MapGridReason, "map_coordinate_out_of_range">;
    };

export type MapCellIndexReadResult =
  | {
      readonly ok: true;
      readonly cell: MapCellView;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<MapGridReason, "map_cell_index_out_of_range">;
    };

export type MapMovementResult =
  | {
      readonly ok: true;
      readonly passable: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        MapGridReason,
        | "map_cell_index_out_of_range"
        | "map_direction_out_of_range"
        | "map_cells_not_cardinal_neighbors"
      >;
    };

export type MapCellUpdateResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly cellIndex: number;
      readonly chunkIndex: number;
      readonly cellVersion: number;
      readonly chunkVersion: number;
      readonly dirtyQueued: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: MapGridReason;
    };

export type MapDirtyProcessResult =
  | {
      readonly ok: true;
      readonly processedCount: number;
      readonly remainingCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        MapGridReason,
        "map_budget_out_of_range" | "map_dirty_output_too_small"
      >;
    };

export interface MapGridSnapshot {
  readonly version: typeof MAP_GRID_SNAPSHOT_VERSION;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly chunkColumns: number;
  readonly chunkRows: number;
  readonly cellCount: number;
  readonly chunkCount: number;
  readonly globalVersion: number;
  readonly dirtyChunkCount: number;
  readonly terrain: Uint16Array;
  readonly occupancy: Int32Array;
  readonly walkCostMilli: Uint32Array;
  readonly wallMask: Uint8Array;
  readonly doorMask: Uint8Array;
  readonly regionId: Uint32Array;
  readonly roomId: Uint32Array;
  readonly cellVersion: Uint32Array;
  readonly chunkVersion: Uint32Array;
  readonly chunkDirty: Uint8Array;
  readonly dirtyChunks: Uint32Array;
}

type NumericLane = Uint8Array | Uint16Array | Uint32Array | Int32Array;

export class MapGrid {
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly chunkColumns: number;
  readonly chunkRows: number;
  readonly cellCount: number;
  readonly chunkCount: number;

  private readonly terrain: Uint16Array;
  private readonly occupancy: Int32Array;
  private readonly walkCostMilli: Uint32Array;
  private readonly wallMask: Uint8Array;
  private readonly doorMask: Uint8Array;
  private readonly regionId: Uint32Array;
  private readonly roomId: Uint32Array;
  private readonly cellVersion: Uint32Array;
  private readonly chunkVersion: Uint32Array;
  private readonly chunkDirty: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private dirtyHead = 0;
  private dirtyTail = 0;
  private queuedDirtyChunks = 0;
  private version = 0;

  constructor(options: MapGridOptions) {
    this.width = requirePositiveSafeInteger(options.width, "map width");
    this.height = requirePositiveSafeInteger(options.height, "map height");
    this.chunkSize = requirePositiveSafeInteger(options.chunkSize, "map chunk size");
    this.cellCount = requirePositiveSafeInteger(this.width * this.height, "map cell count");
    this.chunkColumns = Math.ceil(this.width / this.chunkSize);
    this.chunkRows = Math.ceil(this.height / this.chunkSize);
    this.chunkCount = requirePositiveSafeInteger(
      this.chunkColumns * this.chunkRows,
      "map chunk count",
    );

    const defaultWalkCost = requireUint32(options.defaultWalkCostMilli ?? DEFAULT_WALK_COST_MILLI);

    this.terrain = new Uint16Array(this.cellCount);
    this.occupancy = new Int32Array(this.cellCount);
    this.walkCostMilli = new Uint32Array(this.cellCount);
    this.wallMask = new Uint8Array(this.cellCount);
    this.doorMask = new Uint8Array(this.cellCount);
    this.regionId = new Uint32Array(this.cellCount);
    this.roomId = new Uint32Array(this.cellCount);
    this.cellVersion = new Uint32Array(this.cellCount);
    this.chunkVersion = new Uint32Array(this.chunkCount);
    this.chunkDirty = new Uint8Array(this.chunkCount);
    this.dirtyQueue = new Uint32Array(this.chunkCount);
    this.walkCostMilli.fill(defaultWalkCost);
  }

  get globalVersion(): number {
    return this.version;
  }

  get dirtyChunkCount(): number {
    return this.queuedDirtyChunks;
  }

  readCell(x: number, y: number): MapCellReadResult {
    const cellIndex = this.cellIndexOf(x, y);

    if (cellIndex < 0) {
      return { ok: false, reason: "map_coordinate_out_of_range" };
    }

    return {
      ok: true,
      cell: this.readCellAtIndex(cellIndex),
    };
  }

  readCellByIndex(cellIndex: number): MapCellIndexReadResult {
    if (!this.isCellIndexInRange(cellIndex)) {
      return { ok: false, reason: "map_cell_index_out_of_range" };
    }

    return {
      ok: true,
      cell: this.readCellAtIndex(cellIndex),
    };
  }

  updateCellByIndex(cellIndex: number, update: MapCellUpdate): MapCellUpdateResult {
    if (!this.isCellIndexInRange(cellIndex)) {
      return { ok: false, reason: "map_cell_index_out_of_range" };
    }

    return this.updateCellByValidIndex(cellIndex, update);
  }

  updateCell(x: number, y: number, update: MapCellUpdate): MapCellUpdateResult {
    const cellIndex = this.cellIndexOf(x, y);

    if (cellIndex < 0) {
      return { ok: false, reason: "map_coordinate_out_of_range" };
    }

    return this.updateCellByValidIndex(cellIndex, update);
  }

  isCellPassableByIndex(cellIndex: number): MapMovementResult {
    if (!this.isCellIndexInRange(cellIndex)) {
      return { ok: false, reason: "map_cell_index_out_of_range" };
    }

    return {
      ok: true,
      passable: this.isCellPassableUnchecked(cellIndex),
    };
  }

  canMoveCardinalByIndex(cellIndex: number, direction: number): MapMovementResult {
    if (!this.isCellIndexInRange(cellIndex)) {
      return { ok: false, reason: "map_cell_index_out_of_range" };
    }

    if (!isDirection(direction)) {
      return { ok: false, reason: "map_direction_out_of_range" };
    }

    const neighborIndex = this.neighborIndex(cellIndex, direction);

    if (neighborIndex < 0) {
      return {
        ok: true,
        passable: false,
      };
    }

    return {
      ok: true,
      passable: this.canMoveBetweenUnchecked(cellIndex, neighborIndex, direction),
    };
  }

  canMoveBetweenCardinalNeighbors(fromCellIndex: number, toCellIndex: number): MapMovementResult {
    if (!this.isCellIndexInRange(fromCellIndex) || !this.isCellIndexInRange(toCellIndex)) {
      return { ok: false, reason: "map_cell_index_out_of_range" };
    }

    const direction = this.directionBetweenCardinalNeighbors(fromCellIndex, toCellIndex);

    if (direction < 0) {
      return { ok: false, reason: "map_cells_not_cardinal_neighbors" };
    }

    return {
      ok: true,
      passable: this.canMoveBetweenUnchecked(fromCellIndex, toCellIndex, direction),
    };
  }

  processDirtyChunks(budget: number, processedChunks: Uint32Array): MapDirtyProcessResult {
    if (!Number.isSafeInteger(budget) || budget < 0) {
      return { ok: false, reason: "map_budget_out_of_range" };
    }

    if (processedChunks.length < budget) {
      return { ok: false, reason: "map_dirty_output_too_small" };
    }

    let processedCount = 0;
    while (processedCount < budget && this.queuedDirtyChunks > 0) {
      const chunkIndex = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.chunkCount;
      this.queuedDirtyChunks -= 1;
      this.chunkDirty[chunkIndex] = 0;
      processedChunks[processedCount] = chunkIndex;
      processedCount += 1;
    }

    return {
      ok: true,
      processedCount,
      remainingCount: this.queuedDirtyChunks,
    };
  }

  createSnapshot(): MapGridSnapshot {
    return {
      version: MAP_GRID_SNAPSHOT_VERSION,
      width: this.width,
      height: this.height,
      chunkSize: this.chunkSize,
      chunkColumns: this.chunkColumns,
      chunkRows: this.chunkRows,
      cellCount: this.cellCount,
      chunkCount: this.chunkCount,
      globalVersion: this.version,
      dirtyChunkCount: this.queuedDirtyChunks,
      terrain: new Uint16Array(this.terrain),
      occupancy: new Int32Array(this.occupancy),
      walkCostMilli: new Uint32Array(this.walkCostMilli),
      wallMask: new Uint8Array(this.wallMask),
      doorMask: new Uint8Array(this.doorMask),
      regionId: new Uint32Array(this.regionId),
      roomId: new Uint32Array(this.roomId),
      cellVersion: new Uint32Array(this.cellVersion),
      chunkVersion: new Uint32Array(this.chunkVersion),
      chunkDirty: new Uint8Array(this.chunkDirty),
      dirtyChunks: this.copyDirtyQueue(),
    };
  }

  createHashFields(prefix = "map"): CanonicalWorldField[] {
    return createMapGridHashFields(this.createSnapshot(), prefix);
  }

  private readCellAtIndex(cellIndex: number): MapCellView {
    return {
      cellIndex,
      chunkIndex: this.chunkIndexForCellIndex(cellIndex),
      terrain: this.terrain[cellIndex] ?? 0,
      occupancy: this.occupancy[cellIndex] ?? 0,
      walkCostMilli: this.walkCostMilli[cellIndex] ?? 0,
      wallMask: this.wallMask[cellIndex] ?? 0,
      doorMask: this.doorMask[cellIndex] ?? 0,
      regionId: this.regionId[cellIndex] ?? 0,
      roomId: this.roomId[cellIndex] ?? 0,
      cellVersion: this.cellVersion[cellIndex] ?? 0,
    };
  }

  private createUpdateResult(
    changed: boolean,
    dirtyQueued: boolean,
    cellIndex: number,
    chunkIndex: number,
  ): MapCellUpdateResult {
    return {
      ok: true,
      changed,
      cellIndex,
      chunkIndex,
      cellVersion: this.cellVersion[cellIndex] ?? 0,
      chunkVersion: this.chunkVersion[chunkIndex] ?? 0,
      dirtyQueued,
    };
  }

  private applyCellUpdate(cellIndex: number, update: MapCellUpdate): boolean {
    let changed = false;
    changed = setUint16Lane(this.terrain, cellIndex, update.terrain) || changed;
    changed = setInt32Lane(this.occupancy, cellIndex, update.occupancy) || changed;
    changed = setUint32Lane(this.walkCostMilli, cellIndex, update.walkCostMilli) || changed;
    changed = setUint8Lane(this.wallMask, cellIndex, update.wallMask) || changed;
    changed = setUint8Lane(this.doorMask, cellIndex, update.doorMask) || changed;
    changed = setUint32Lane(this.regionId, cellIndex, update.regionId) || changed;
    changed = setUint32Lane(this.roomId, cellIndex, update.roomId) || changed;
    return changed;
  }

  private wouldChangeCell(cellIndex: number, update: MapCellUpdate): boolean {
    return (
      wouldSetLane(this.terrain, cellIndex, update.terrain) ||
      wouldSetLane(this.occupancy, cellIndex, update.occupancy) ||
      wouldSetLane(this.walkCostMilli, cellIndex, update.walkCostMilli) ||
      wouldSetLane(this.wallMask, cellIndex, update.wallMask) ||
      wouldSetLane(this.doorMask, cellIndex, update.doorMask) ||
      wouldSetLane(this.regionId, cellIndex, update.regionId) ||
      wouldSetLane(this.roomId, cellIndex, update.roomId)
    );
  }

  private updateCellByValidIndex(cellIndex: number, update: MapCellUpdate): MapCellUpdateResult {
    if (!isValidUpdate(update)) {
      return { ok: false, reason: "map_value_out_of_range" };
    }

    const chunkIndex = this.chunkIndexForCellIndex(cellIndex);
    const changed = this.wouldChangeCell(cellIndex, update);

    if (!changed) {
      return this.createUpdateResult(false, false, cellIndex, chunkIndex);
    }

    if (this.version >= 0xffff_ffff) {
      return { ok: false, reason: "map_version_exhausted" };
    }

    this.applyCellUpdate(cellIndex, update);
    this.version += 1;
    this.cellVersion[cellIndex] = this.version;
    this.chunkVersion[chunkIndex] = this.version;
    const dirtyQueued = this.markChunkDirty(chunkIndex);
    return this.createUpdateResult(true, dirtyQueued, cellIndex, chunkIndex);
  }

  private markChunkDirty(chunkIndex: number): boolean {
    if (this.chunkDirty[chunkIndex] === 1) {
      return false;
    }

    this.chunkDirty[chunkIndex] = 1;
    this.dirtyQueue[this.dirtyTail] = chunkIndex;
    this.dirtyTail = (this.dirtyTail + 1) % this.chunkCount;
    this.queuedDirtyChunks += 1;
    return true;
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

  private isCellIndexInRange(cellIndex: number): boolean {
    return Number.isSafeInteger(cellIndex) && cellIndex >= 0 && cellIndex < this.cellCount;
  }

  private neighborIndex(cellIndex: number, direction: number): number {
    const x = cellIndex % this.width;

    if (direction === MAP_DIRECTION_NORTH) {
      return cellIndex >= this.width ? cellIndex - this.width : -1;
    }

    if (direction === MAP_DIRECTION_EAST) {
      return x + 1 < this.width ? cellIndex + 1 : -1;
    }

    if (direction === MAP_DIRECTION_SOUTH) {
      return cellIndex + this.width < this.cellCount ? cellIndex + this.width : -1;
    }

    return x > 0 ? cellIndex - 1 : -1;
  }

  private directionBetweenCardinalNeighbors(fromCellIndex: number, toCellIndex: number): number {
    if (toCellIndex === fromCellIndex - this.width) {
      return MAP_DIRECTION_NORTH;
    }

    if (
      toCellIndex === fromCellIndex + 1 &&
      Math.floor(toCellIndex / this.width) === Math.floor(fromCellIndex / this.width)
    ) {
      return MAP_DIRECTION_EAST;
    }

    if (toCellIndex === fromCellIndex + this.width) {
      return MAP_DIRECTION_SOUTH;
    }

    if (
      toCellIndex === fromCellIndex - 1 &&
      Math.floor(toCellIndex / this.width) === Math.floor(fromCellIndex / this.width)
    ) {
      return MAP_DIRECTION_WEST;
    }

    return -1;
  }

  private canMoveBetweenUnchecked(
    fromCellIndex: number,
    toCellIndex: number,
    direction: number,
  ): boolean {
    if (
      !this.isCellPassableUnchecked(fromCellIndex) ||
      !this.isCellPassableUnchecked(toCellIndex)
    ) {
      return false;
    }

    const fromMask = directionMask(direction);
    const toMask = directionMask(oppositeDirection(direction));
    const fromBlocked =
      ((this.wallMask[fromCellIndex] ?? 0) | (this.doorMask[fromCellIndex] ?? 0)) & fromMask;
    const toBlocked =
      ((this.wallMask[toCellIndex] ?? 0) | (this.doorMask[toCellIndex] ?? 0)) & toMask;
    return fromBlocked === 0 && toBlocked === 0;
  }

  private isCellPassableUnchecked(cellIndex: number): boolean {
    return (
      (this.terrain[cellIndex] ?? 0) !== MAP_TERRAIN_BLOCKED &&
      (this.walkCostMilli[cellIndex] ?? 0) > 0
    );
  }

  private chunkIndexForCellIndex(cellIndex: number): number {
    const x = cellIndex % this.width;
    const y = Math.floor(cellIndex / this.width);
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkY = Math.floor(y / this.chunkSize);
    return chunkY * this.chunkColumns + chunkX;
  }

  private copyDirtyQueue(): Uint32Array {
    const dirtyChunks = new Uint32Array(this.queuedDirtyChunks);
    let readIndex = this.dirtyHead;

    for (let index = 0; index < this.queuedDirtyChunks; index += 1) {
      dirtyChunks[index] = this.dirtyQueue[readIndex] ?? 0;
      readIndex = (readIndex + 1) % this.chunkCount;
    }

    return dirtyChunks;
  }
}

export function createMapGrid(options: MapGridOptions): MapGrid {
  return new MapGrid(options);
}

function isValidUpdate(update: MapCellUpdate): boolean {
  return (
    isOptionalUint16(update.terrain) &&
    isOptionalInt32(update.occupancy) &&
    isOptionalUint32(update.walkCostMilli) &&
    isOptionalDirectionMask(update.wallMask) &&
    isOptionalDirectionMask(update.doorMask) &&
    isOptionalUint32(update.regionId) &&
    isOptionalUint32(update.roomId)
  );
}

function setUint16Lane(lane: Uint16Array, index: number, value: number | undefined): boolean {
  if (value === undefined || lane[index] === value) {
    return false;
  }

  lane[index] = value;
  return true;
}

function setUint32Lane(lane: Uint32Array, index: number, value: number | undefined): boolean {
  if (value === undefined || lane[index] === value) {
    return false;
  }

  lane[index] = value;
  return true;
}

function setInt32Lane(lane: Int32Array, index: number, value: number | undefined): boolean {
  if (value === undefined || lane[index] === value) {
    return false;
  }

  lane[index] = value;
  return true;
}

function setUint8Lane(lane: Uint8Array, index: number, value: number | undefined): boolean {
  if (value === undefined || lane[index] === value) {
    return false;
  }

  lane[index] = value;
  return true;
}

function wouldSetLane(lane: NumericLane, index: number, value: number | undefined): boolean {
  return value !== undefined && lane[index] !== value;
}

function isOptionalUint16(value: number | undefined): boolean {
  return value === undefined || (Number.isSafeInteger(value) && value >= 0 && value <= 0xffff);
}

function isOptionalUint32(value: number | undefined): boolean {
  return value === undefined || isUint32(value);
}

function isOptionalInt32(value: number | undefined): boolean {
  return (
    value === undefined ||
    (Number.isSafeInteger(value) && value >= -0x8000_0000 && value <= 0x7fff_ffff)
  );
}

function isOptionalDirectionMask(value: number | undefined): boolean {
  return (
    value === undefined ||
    (Number.isSafeInteger(value) && value >= 0 && value <= MAP_DIRECTION_MASK_CARDINAL)
  );
}

function requirePositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}

function requireUint32(value: number): number {
  if (!isUint32(value)) {
    throw new Error("map walk cost must be an unsigned 32-bit integer");
  }

  return value;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isDirection(value: number): boolean {
  return (
    value === MAP_DIRECTION_NORTH ||
    value === MAP_DIRECTION_EAST ||
    value === MAP_DIRECTION_SOUTH ||
    value === MAP_DIRECTION_WEST
  );
}

function directionMask(direction: number): number {
  return 1 << direction;
}

function oppositeDirection(direction: number): number {
  return (direction + 2) & 3;
}
