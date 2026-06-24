import { hashStringToUint32, mixUint32 } from "./deterministic-hash";
import type { CanonicalWorldField } from "./world-hash";
import {
  MAP_DIRECTION_EAST,
  MAP_DIRECTION_NORTH,
  MAP_DIRECTION_SOUTH,
  MAP_DIRECTION_WEST,
  type MapGrid,
} from "./map-grid";

export const REGION_ROOM_REBUILD_SNAPSHOT_VERSION = 1;

export type RegionRoomReason =
  | "region_room_coordinate_out_of_range"
  | "region_room_cell_index_out_of_range"
  | "region_room_budget_out_of_range"
  | "region_room_dirty_queue_full"
  | "region_room_active_queue_full"
  | "region_room_version_exhausted"
  | "region_room_id_exhausted"
  | "region_room_map_update_failed";

export interface RegionRoomMarkResult {
  readonly ok: true;
  readonly enqueuedCells: number;
  readonly dirtyCellCount: number;
  readonly navigationVersion: number;
  readonly regionVersion: number;
  readonly roomVersion: number;
}

export type RegionRoomMutationResult =
  | RegionRoomMarkResult
  | {
      readonly ok: false;
      readonly reason: RegionRoomReason;
    };

export type RegionRoomProcessResult =
  | {
      readonly ok: true;
      readonly processedCells: number;
      readonly processedRegions: number;
      readonly skippedCells: number;
      readonly mapUpdates: number;
      readonly remainingDirtyCells: number;
      readonly activeCellBacklog: number;
      readonly navigationVersion: number;
      readonly regionVersion: number;
      readonly roomVersion: number;
      readonly regionGraphVersion: number;
    }
  | {
      readonly ok: false;
      readonly reason: RegionRoomReason;
    };

export interface RegionRoomCellBasis {
  readonly cellIndex: number;
  readonly regionId: number;
  readonly roomId: number;
  readonly navigationVersion: number;
  readonly regionVersion: number;
  readonly roomVersion: number;
  readonly regionGraphVersion: number;
}

export interface RegionGraphBasis {
  readonly navigationVersion: number;
  readonly regionVersion: number;
  readonly regionGraphVersion: number;
  readonly regionCount: number;
  readonly edgeCount: 0;
}

export interface RegionRoomMetrics {
  readonly navigationVersion: number;
  readonly regionVersion: number;
  readonly roomVersion: number;
  readonly regionGraphVersion: number;
  readonly dirtyCellCount: number;
  readonly activeCellBacklog: number;
  readonly nextRegionId: number;
  readonly nextRoomId: number;
  readonly processedCellsTotal: number;
  readonly processedRegionsTotal: number;
  readonly mapUpdatesTotal: number;
  readonly skippedCellsTotal: number;
}

export interface RegionRoomSnapshot extends RegionRoomMetrics {
  readonly version: typeof REGION_ROOM_REBUILD_SNAPSHOT_VERSION;
  readonly cellRebuildVersion: Uint32Array;
  readonly dirtyCells: Uint32Array;
}

export class RegionRoomRebuilder {
  readonly grid: MapGrid;

  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private readonly activeQueue: Uint32Array;
  private readonly visitedEpoch: Uint32Array;
  private readonly cellRebuildVersion: Uint32Array;
  private dirtyHead = 0;
  private dirtyTail = 0;
  private queuedDirtyCells = 0;
  private activeHead = 0;
  private activeTail = 0;
  private activeRegionId = 0;
  private activeRoomId = 0;
  private activeNavigationVersion = 0;
  private activeEpoch = 0;
  private nextRegionIdValue = 1;
  private nextRoomIdValue = 1;
  private navigationVersionValue = 0;
  private regionVersionValue = 0;
  private roomVersionValue = 0;
  private regionGraphVersionValue = 0;
  private processedCellsTotalValue = 0;
  private processedRegionsTotalValue = 0;
  private mapUpdatesTotalValue = 0;
  private skippedCellsTotalValue = 0;

  constructor(grid: MapGrid) {
    this.grid = grid;
    this.dirtyQueued = new Uint8Array(grid.cellCount);
    this.dirtyQueue = new Uint32Array(grid.cellCount);
    this.activeQueue = new Uint32Array(grid.cellCount);
    this.visitedEpoch = new Uint32Array(grid.cellCount);
    this.cellRebuildVersion = new Uint32Array(grid.cellCount);
  }

  get navigationVersion(): number {
    return this.navigationVersionValue;
  }

  get regionVersion(): number {
    return this.regionVersionValue;
  }

  get roomVersion(): number {
    return this.roomVersionValue;
  }

  get regionGraphVersion(): number {
    return this.regionGraphVersionValue;
  }

  get dirtyCellCount(): number {
    return this.queuedDirtyCells;
  }

  markCellDirty(x: number, y: number): RegionRoomMutationResult {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
      return { ok: false, reason: "region_room_coordinate_out_of_range" };
    }

    if (x < 0 || y < 0 || x >= this.grid.width || y >= this.grid.height) {
      return { ok: false, reason: "region_room_coordinate_out_of_range" };
    }

    return this.markCellDirtyByIndex(y * this.grid.width + x);
  }

  markCellDirtyByIndex(cellIndex: number): RegionRoomMutationResult {
    if (!this.isCellIndexInRange(cellIndex)) {
      return { ok: false, reason: "region_room_cell_index_out_of_range" };
    }

    const bumped = this.bumpNavigationVersions();

    if (!bumped.ok) {
      return bumped;
    }

    let enqueuedCells = 0;
    const center = this.enqueueDirtyCell(cellIndex);

    if (!center.ok) {
      return center;
    }

    enqueuedCells += center.enqueued ? 1 : 0;

    for (let direction = 0; direction < 4; direction += 1) {
      const neighborIndex = this.neighborIndex(cellIndex, direction);

      if (neighborIndex >= 0) {
        const neighbor = this.enqueueDirtyCell(neighborIndex);

        if (!neighbor.ok) {
          return neighbor;
        }

        enqueuedCells += neighbor.enqueued ? 1 : 0;
      }
    }

    return this.createMarkResult(enqueuedCells);
  }

  markAllDirtyForLoad(): RegionRoomMutationResult {
    const bumped = this.bumpNavigationVersions();

    if (!bumped.ok) {
      return bumped;
    }

    let enqueuedCells = 0;

    for (let cellIndex = 0; cellIndex < this.grid.cellCount; cellIndex += 1) {
      const enqueued = this.enqueueDirtyCell(cellIndex);

      if (!enqueued.ok) {
        return enqueued;
      }

      enqueuedCells += enqueued.enqueued ? 1 : 0;
    }

    return this.createMarkResult(enqueuedCells);
  }

  processDirtyCells(budget: number): RegionRoomProcessResult {
    if (!Number.isSafeInteger(budget) || budget < 0) {
      return { ok: false, reason: "region_room_budget_out_of_range" };
    }

    let processedCells = 0;
    let processedRegions = 0;
    let skippedCells = 0;
    let mapUpdates = 0;

    while (processedCells < budget) {
      if (!this.hasActiveRegion()) {
        const started = this.startNextDirtyRegion();

        if (!started.ok) {
          return started;
        }

        if (started.done) {
          break;
        }

        skippedCells += started.skippedCells;
        mapUpdates += started.mapUpdates;

        if (started.processedCells > 0) {
          processedCells += started.processedCells;
          continue;
        }

        if (!this.hasActiveRegion()) {
          continue;
        }
      }

      const processed = this.processActiveCell();

      if (!processed.ok) {
        return processed;
      }

      processedCells += 1;
      mapUpdates += processed.mapUpdates;

      if (processed.regionCompleted) {
        processedRegions += 1;
      }
    }

    this.processedCellsTotalValue += processedCells;
    this.processedRegionsTotalValue += processedRegions;
    this.mapUpdatesTotalValue += mapUpdates;
    this.skippedCellsTotalValue += skippedCells;

    return {
      ok: true,
      processedCells,
      processedRegions,
      skippedCells,
      mapUpdates,
      remainingDirtyCells: this.queuedDirtyCells,
      activeCellBacklog: this.activeTail - this.activeHead,
      navigationVersion: this.navigationVersionValue,
      regionVersion: this.regionVersionValue,
      roomVersion: this.roomVersionValue,
      regionGraphVersion: this.regionGraphVersionValue,
    };
  }

  readCellBasisByIndex(cellIndex: number): RegionRoomCellBasis | undefined {
    const cell = this.grid.readCellByIndex(cellIndex);

    if (!cell.ok) {
      return undefined;
    }

    return {
      cellIndex,
      regionId: cell.cell.regionId,
      roomId: cell.cell.roomId,
      navigationVersion: this.navigationVersionValue,
      regionVersion: this.regionVersionValue,
      roomVersion: this.roomVersionValue,
      regionGraphVersion: this.regionGraphVersionValue,
    };
  }

  createRegionGraphBasis(): RegionGraphBasis {
    return {
      navigationVersion: this.navigationVersionValue,
      regionVersion: this.regionVersionValue,
      regionGraphVersion: this.regionGraphVersionValue,
      regionCount: this.nextRegionIdValue - 1,
      edgeCount: 0,
    };
  }

  createMetrics(): RegionRoomMetrics {
    return {
      navigationVersion: this.navigationVersionValue,
      regionVersion: this.regionVersionValue,
      roomVersion: this.roomVersionValue,
      regionGraphVersion: this.regionGraphVersionValue,
      dirtyCellCount: this.queuedDirtyCells,
      activeCellBacklog: this.activeTail - this.activeHead,
      nextRegionId: this.nextRegionIdValue,
      nextRoomId: this.nextRoomIdValue,
      processedCellsTotal: this.processedCellsTotalValue,
      processedRegionsTotal: this.processedRegionsTotalValue,
      mapUpdatesTotal: this.mapUpdatesTotalValue,
      skippedCellsTotal: this.skippedCellsTotalValue,
    };
  }

  createSnapshot(): RegionRoomSnapshot {
    return {
      version: REGION_ROOM_REBUILD_SNAPSHOT_VERSION,
      ...this.createMetrics(),
      cellRebuildVersion: new Uint32Array(this.cellRebuildVersion),
      dirtyCells: this.copyDirtyQueue(),
    };
  }

  createHashFields(prefix = "regionRoom"): CanonicalWorldField[] {
    const snapshot = this.createSnapshot();

    return [
      { name: `${prefix}.version`, value: snapshot.version },
      { name: `${prefix}.navigationVersion`, value: snapshot.navigationVersion },
      { name: `${prefix}.regionVersion`, value: snapshot.regionVersion },
      { name: `${prefix}.roomVersion`, value: snapshot.roomVersion },
      { name: `${prefix}.regionGraphVersion`, value: snapshot.regionGraphVersion },
      { name: `${prefix}.dirtyCellCount`, value: snapshot.dirtyCellCount },
      { name: `${prefix}.activeCellBacklog`, value: snapshot.activeCellBacklog },
      { name: `${prefix}.nextRegionId`, value: snapshot.nextRegionId },
      { name: `${prefix}.nextRoomId`, value: snapshot.nextRoomId },
      { name: `${prefix}.processedCellsTotal`, value: snapshot.processedCellsTotal },
      { name: `${prefix}.processedRegionsTotal`, value: snapshot.processedRegionsTotal },
      { name: `${prefix}.mapUpdatesTotal`, value: snapshot.mapUpdatesTotal },
      { name: `${prefix}.skippedCellsTotal`, value: snapshot.skippedCellsTotal },
      {
        name: `${prefix}.cellRebuildVersionHash`,
        value: hashUint32Lane(snapshot.cellRebuildVersion),
      },
      { name: `${prefix}.dirtyCellsHash`, value: hashUint32Lane(snapshot.dirtyCells) },
    ];
  }

  private startNextDirtyRegion():
    | {
        readonly ok: true;
        readonly done: boolean;
        readonly processedCells: number;
        readonly skippedCells: number;
        readonly mapUpdates: number;
      }
    | {
        readonly ok: false;
        readonly reason: RegionRoomReason;
      } {
    while (this.queuedDirtyCells > 0) {
      const cellIndex = this.dequeueDirtyCell();

      if ((this.cellRebuildVersion[cellIndex] ?? 0) === this.navigationVersionValue) {
        return { ok: true, done: false, processedCells: 0, skippedCells: 1, mapUpdates: 0 };
      }

      if (!this.isPassable(cellIndex)) {
        const cleared = this.writeCellRegionRoom(cellIndex, 0, 0);

        if (!cleared.ok) {
          return cleared;
        }

        this.cellRebuildVersion[cellIndex] = this.navigationVersionValue;
        return {
          ok: true,
          done: false,
          processedCells: 1,
          skippedCells: 0,
          mapUpdates: cleared.mapUpdates,
        };
      }

      const allocated = this.startActiveRegion(cellIndex);

      if (!allocated.ok) {
        return allocated;
      }

      return { ok: true, done: false, processedCells: 0, skippedCells: 0, mapUpdates: 0 };
    }

    return { ok: true, done: true, processedCells: 0, skippedCells: 0, mapUpdates: 0 };
  }

  private processActiveCell():
    | {
        readonly ok: true;
        readonly mapUpdates: number;
        readonly regionCompleted: boolean;
      }
    | {
        readonly ok: false;
        readonly reason: RegionRoomReason;
      } {
    const cellIndex = this.activeQueue[this.activeHead] ?? 0;
    this.activeHead += 1;
    let mapUpdates = 0;

    if (this.isPassable(cellIndex)) {
      const written = this.writeCellRegionRoom(cellIndex, this.activeRegionId, this.activeRoomId);

      if (!written.ok) {
        return written;
      }

      mapUpdates += written.mapUpdates;
      this.cellRebuildVersion[cellIndex] = this.activeNavigationVersion;

      for (let direction = 0; direction < 4; direction += 1) {
        const neighborIndex = this.neighborIndex(cellIndex, direction);

        if (neighborIndex >= 0 && this.canMove(cellIndex, neighborIndex)) {
          const queued = this.enqueueActiveCell(neighborIndex);

          if (!queued.ok) {
            return queued;
          }
        }
      }
    } else {
      const cleared = this.writeCellRegionRoom(cellIndex, 0, 0);

      if (!cleared.ok) {
        return cleared;
      }

      mapUpdates += cleared.mapUpdates;
      this.cellRebuildVersion[cellIndex] = this.activeNavigationVersion;
    }

    if (this.activeHead >= this.activeTail) {
      this.clearActiveRegion();
      return { ok: true, mapUpdates, regionCompleted: true };
    }

    return { ok: true, mapUpdates, regionCompleted: false };
  }

  private startActiveRegion(
    cellIndex: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: RegionRoomReason } {
    if (this.nextRegionIdValue > 0xffff_ffff || this.nextRoomIdValue > 0xffff_ffff) {
      return { ok: false, reason: "region_room_id_exhausted" };
    }

    this.activeRegionId = this.nextRegionIdValue;
    this.activeRoomId = this.nextRoomIdValue;
    this.nextRegionIdValue += 1;
    this.nextRoomIdValue += 1;
    this.activeNavigationVersion = this.navigationVersionValue;
    this.activeHead = 0;
    this.activeTail = 0;
    this.activeEpoch += 1;

    if (this.activeEpoch > 0xffff_ffff) {
      return { ok: false, reason: "region_room_version_exhausted" };
    }

    return this.enqueueActiveCell(cellIndex);
  }

  private clearActiveRegion(): void {
    this.activeHead = 0;
    this.activeTail = 0;
    this.activeRegionId = 0;
    this.activeRoomId = 0;
    this.activeNavigationVersion = 0;
  }

  private hasActiveRegion(): boolean {
    return this.activeRegionId !== 0 && this.activeHead < this.activeTail;
  }

  private enqueueActiveCell(
    cellIndex: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: RegionRoomReason } {
    if ((this.visitedEpoch[cellIndex] ?? 0) === this.activeEpoch) {
      return { ok: true };
    }

    if (this.activeTail >= this.activeQueue.length) {
      return { ok: false, reason: "region_room_active_queue_full" };
    }

    this.visitedEpoch[cellIndex] = this.activeEpoch;
    this.activeQueue[this.activeTail] = cellIndex;
    this.activeTail += 1;
    return { ok: true };
  }

  private enqueueDirtyCell(
    cellIndex: number,
  ):
    | { readonly ok: true; readonly enqueued: boolean }
    | { readonly ok: false; readonly reason: RegionRoomReason } {
    if (this.dirtyQueued[cellIndex] === 1) {
      return { ok: true, enqueued: false };
    }

    if (this.queuedDirtyCells >= this.dirtyQueue.length) {
      return { ok: false, reason: "region_room_dirty_queue_full" };
    }

    this.dirtyQueued[cellIndex] = 1;
    this.dirtyQueue[this.dirtyTail] = cellIndex;
    this.dirtyTail = (this.dirtyTail + 1) % this.dirtyQueue.length;
    this.queuedDirtyCells += 1;
    return { ok: true, enqueued: true };
  }

  private dequeueDirtyCell(): number {
    const cellIndex = this.dirtyQueue[this.dirtyHead] ?? 0;
    this.dirtyQueued[cellIndex] = 0;
    this.dirtyHead = (this.dirtyHead + 1) % this.dirtyQueue.length;
    this.queuedDirtyCells -= 1;
    return cellIndex;
  }

  private bumpNavigationVersions():
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: RegionRoomReason } {
    if (
      this.navigationVersionValue >= 0xffff_ffff ||
      this.regionVersionValue >= 0xffff_ffff ||
      this.roomVersionValue >= 0xffff_ffff ||
      this.regionGraphVersionValue >= 0xffff_ffff
    ) {
      return { ok: false, reason: "region_room_version_exhausted" };
    }

    this.navigationVersionValue += 1;
    this.regionVersionValue += 1;
    this.roomVersionValue += 1;
    this.regionGraphVersionValue += 1;
    return { ok: true };
  }

  private createMarkResult(enqueuedCells: number): RegionRoomMarkResult {
    return {
      ok: true,
      enqueuedCells,
      dirtyCellCount: this.queuedDirtyCells,
      navigationVersion: this.navigationVersionValue,
      regionVersion: this.regionVersionValue,
      roomVersion: this.roomVersionValue,
    };
  }

  private writeCellRegionRoom(
    cellIndex: number,
    regionId: number,
    roomId: number,
  ):
    | { readonly ok: true; readonly mapUpdates: number }
    | { readonly ok: false; readonly reason: RegionRoomReason } {
    const update = this.grid.updateCellByIndex(cellIndex, { regionId, roomId });

    if (!update.ok) {
      return { ok: false, reason: "region_room_map_update_failed" };
    }

    return { ok: true, mapUpdates: update.changed ? 1 : 0 };
  }

  private isPassable(cellIndex: number): boolean {
    const result = this.grid.isCellPassableByIndex(cellIndex);
    return result.ok && result.passable;
  }

  private canMove(fromCellIndex: number, toCellIndex: number): boolean {
    const result = this.grid.canMoveBetweenCardinalNeighbors(fromCellIndex, toCellIndex);
    return result.ok && result.passable;
  }

  private neighborIndex(cellIndex: number, direction: number): number {
    const x = cellIndex % this.grid.width;

    if (direction === MAP_DIRECTION_NORTH) {
      return cellIndex >= this.grid.width ? cellIndex - this.grid.width : -1;
    }

    if (direction === MAP_DIRECTION_EAST) {
      return x + 1 < this.grid.width ? cellIndex + 1 : -1;
    }

    if (direction === MAP_DIRECTION_SOUTH) {
      return cellIndex + this.grid.width < this.grid.cellCount ? cellIndex + this.grid.width : -1;
    }

    if (direction === MAP_DIRECTION_WEST) {
      return x > 0 ? cellIndex - 1 : -1;
    }

    return -1;
  }

  private isCellIndexInRange(cellIndex: number): boolean {
    return Number.isSafeInteger(cellIndex) && cellIndex >= 0 && cellIndex < this.grid.cellCount;
  }

  private copyDirtyQueue(): Uint32Array {
    const dirtyCells = new Uint32Array(this.queuedDirtyCells);
    let readIndex = this.dirtyHead;

    for (let index = 0; index < this.queuedDirtyCells; index += 1) {
      dirtyCells[index] = this.dirtyQueue[readIndex] ?? 0;
      readIndex = (readIndex + 1) % this.dirtyQueue.length;
    }

    return dirtyCells;
  }
}

export function createRegionRoomRebuilder(grid: MapGrid): RegionRoomRebuilder {
  return new RegionRoomRebuilder(grid);
}

function hashUint32Lane(lane: Uint32Array): number {
  let hash = mixUint32(hashStringToUint32("wuming-town:region-room:lane"), lane.length);

  for (const value of lane) {
    hash = mixUint32(hash, value);
  }

  return hash;
}
