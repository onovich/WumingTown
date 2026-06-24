import { performance } from "node:perf_hooks";

import {
  MAP_DIRECTION_MASK_EAST,
  MAP_DIRECTION_MASK_WEST,
  createMapGrid,
  createRegionRoomRebuilder,
  formatCanonicalWorldHash,
  mixUint32,
  type MapGrid,
  type RegionRoomRebuilder,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

export interface RegionRoomBenchmarkReport {
  readonly name: "region-room";
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly changedEdges: number;
  readonly dirtyQueuePeak: number;
  readonly rebuildBudgetPerTick: number;
  readonly drainTicks: number;
  readonly processedCells: number;
  readonly processedRegions: number;
  readonly mapUpdates: number;
  readonly remainingDirtyCells: number;
  readonly activeCellBacklog: number;
  readonly noSustainedGrowth: boolean;
  readonly navigationVersion: number;
  readonly regionVersion: number;
  readonly roomVersion: number;
  readonly regionGraphVersion: number;
  readonly processedChecksum: number;
  readonly regionRoomHash: string;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface RegionRoomBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly changedEdges: number;
  readonly dirtyQueuePeak: number;
  readonly rebuildBudgetPerTick: number;
  readonly drainTicks: number;
  readonly processedCells: number;
  readonly processedRegions: number;
  readonly mapUpdates: number;
  readonly remainingDirtyCells: number;
  readonly activeCellBacklog: number;
  readonly noSustainedGrowth: boolean;
  readonly navigationVersion: number;
  readonly regionVersion: number;
  readonly roomVersion: number;
  readonly regionGraphVersion: number;
  readonly processedChecksum: number;
  readonly regionRoomHash: string;
}

export interface SampledRegionRoomBenchmark {
  readonly name: "region-room";
  readonly report: RegionRoomBenchmarkReport;
  readonly invariants: RegionRoomBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runRegionRoomBenchmark(): RegionRoomBenchmarkReport {
  const width = 128;
  const height = 128;
  const chunkSize = 16;
  const rebuildBudgetPerTick = 256;
  const grid = createMapGrid({ width, height, chunkSize });
  const rebuild = createRegionRoomRebuilder(grid);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  markAllOrThrow(rebuild);
  const initial = drainRebuild(rebuild, rebuildBudgetPerTick);
  const changedEdges = applyWallPattern(grid, rebuild);
  const dirtyQueuePeak = rebuild.dirtyCellCount;
  const dirty = drainRebuild(rebuild, rebuildBudgetPerTick);
  const metrics = rebuild.createMetrics();
  const regionRoomHash = formatCanonicalWorldHash({
    fields: [...grid.createHashFields(), ...rebuild.createHashFields()],
    randomStreams: [],
    queuedCommands: [],
  });
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;
  const drainTicks = initial.drainTicks + dirty.drainTicks;
  const processedCells = initial.processedCells + dirty.processedCells;
  const processedRegions = initial.processedRegions + dirty.processedRegions;
  const mapUpdates = initial.mapUpdates + dirty.mapUpdates;
  const processedChecksum = mixUint32(initial.processedChecksum, dirty.processedChecksum);

  return {
    name: "region-room",
    width,
    height,
    chunkSize,
    changedEdges,
    dirtyQueuePeak,
    rebuildBudgetPerTick,
    drainTicks,
    processedCells,
    processedRegions,
    mapUpdates,
    remainingDirtyCells: metrics.dirtyCellCount,
    activeCellBacklog: metrics.activeCellBacklog,
    noSustainedGrowth: metrics.dirtyCellCount === 0 && metrics.activeCellBacklog === 0,
    navigationVersion: metrics.navigationVersion,
    regionVersion: metrics.regionVersion,
    roomVersion: metrics.roomVersion,
    regionGraphVersion: metrics.regionGraphVersion,
    processedChecksum,
    regionRoomHash,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function regionRoomInvariantsFromReport(
  report: RegionRoomBenchmarkReport,
): RegionRoomBenchmarkInvariants {
  return {
    width: report.width,
    height: report.height,
    chunkSize: report.chunkSize,
    changedEdges: report.changedEdges,
    dirtyQueuePeak: report.dirtyQueuePeak,
    rebuildBudgetPerTick: report.rebuildBudgetPerTick,
    drainTicks: report.drainTicks,
    processedCells: report.processedCells,
    processedRegions: report.processedRegions,
    mapUpdates: report.mapUpdates,
    remainingDirtyCells: report.remainingDirtyCells,
    activeCellBacklog: report.activeCellBacklog,
    noSustainedGrowth: report.noSustainedGrowth,
    navigationVersion: report.navigationVersion,
    regionVersion: report.regionVersion,
    roomVersion: report.roomVersion,
    regionGraphVersion: report.regionGraphVersion,
    processedChecksum: report.processedChecksum,
    regionRoomHash: report.regionRoomHash,
  };
}

function applyWallPattern(grid: MapGrid, rebuild: RegionRoomRebuilder): number {
  let changedEdges = 0;

  for (let y = 0; y < grid.height; y += 8) {
    for (let x = 7; x + 1 < grid.width; x += 16) {
      const west = grid.updateCell(x, y, { wallMask: MAP_DIRECTION_MASK_EAST });
      const east = grid.updateCell(x + 1, y, { wallMask: MAP_DIRECTION_MASK_WEST });

      if (!west.ok || !east.ok) {
        throw new Error("region-room benchmark wall update failed");
      }

      const marked = rebuild.markCellDirty(x, y);

      if (!marked.ok) {
        throw new Error(marked.reason);
      }

      changedEdges += west.changed || east.changed ? 1 : 0;
    }
  }

  return changedEdges;
}

function markAllOrThrow(rebuild: RegionRoomRebuilder): void {
  const marked = rebuild.markAllDirtyForLoad();

  if (!marked.ok) {
    throw new Error(marked.reason);
  }
}

function drainRebuild(
  rebuild: RegionRoomRebuilder,
  budget: number,
): {
  readonly drainTicks: number;
  readonly processedCells: number;
  readonly processedRegions: number;
  readonly mapUpdates: number;
  readonly processedChecksum: number;
} {
  let drainTicks = 0;
  let processedCells = 0;
  let processedRegions = 0;
  let mapUpdates = 0;
  let processedChecksum = 0;

  while (rebuild.dirtyCellCount > 0 || rebuild.createMetrics().activeCellBacklog > 0) {
    const processed = rebuild.processDirtyCells(budget);

    if (!processed.ok) {
      throw new Error(processed.reason);
    }

    drainTicks += 1;
    processedCells += processed.processedCells;
    processedRegions += processed.processedRegions;
    mapUpdates += processed.mapUpdates;
    processedChecksum = mixUint32(processedChecksum, processed.processedCells);
    processedChecksum = mixUint32(processedChecksum, processed.processedRegions);
    processedChecksum = mixUint32(processedChecksum, processed.remainingDirtyCells);
    processedChecksum = mixUint32(processedChecksum, processed.activeCellBacklog);
  }

  return {
    drainTicks,
    processedCells,
    processedRegions,
    mapUpdates,
    processedChecksum,
  };
}
