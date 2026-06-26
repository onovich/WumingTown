import { performance } from "node:perf_hooks";

import {
  createMapGrid,
  formatCanonicalWorldHash,
  mixUint32,
  type MapGrid,
} from "@wuming-town/sim-core";
import type { BenchmarkSampleStats } from "./benchmarks";

export interface MapDirtyBenchmarkReport {
  readonly name: "map-dirty";
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly changedCells: number;
  readonly dirtyQueuePeak: number;
  readonly rebuildBudgetPerTick: number;
  readonly drainTicks: number;
  readonly processedChunks: number;
  readonly remainingDirtyChunks: number;
  readonly finalGlobalVersion: number;
  readonly processedChecksum: number;
  readonly mapHash: string;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface MapDirtyBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly changedCells: number;
  readonly dirtyQueuePeak: number;
  readonly rebuildBudgetPerTick: number;
  readonly drainTicks: number;
  readonly processedChunks: number;
  readonly remainingDirtyChunks: number;
  readonly finalGlobalVersion: number;
  readonly processedChecksum: number;
  readonly mapHash: string;
}

export interface SampledMapDirtyBenchmark {
  readonly name: "map-dirty";
  readonly report: MapDirtyBenchmarkReport;
  readonly invariants: MapDirtyBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

const MAP_DIRTY_TIMED_PASS_COUNT = 16;
const MAP_DIRTY_WIDTH = 256;
const MAP_DIRTY_HEIGHT = 256;
const MAP_DIRTY_CHUNK_SIZE = 32;
const MAP_DIRTY_REBUILD_BUDGET_PER_TICK = 8;

interface MapDirtyBenchmarkPassReport {
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly changedCells: number;
  readonly dirtyQueuePeak: number;
  readonly rebuildBudgetPerTick: number;
  readonly drainTicks: number;
  readonly processedChunks: number;
  readonly remainingDirtyChunks: number;
  readonly finalGlobalVersion: number;
  readonly processedChecksum: number;
  readonly mapHash: string;
  readonly elapsedMs: number;
}

export function runMapDirtyBenchmark(): MapDirtyBenchmarkReport {
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  let totalElapsedMs = 0;
  let lastPass: MapDirtyBenchmarkPassReport | undefined;

  // Average identical passes to reduce sub-ms timing noise without changing the path.
  for (let index = 0; index < MAP_DIRTY_TIMED_PASS_COUNT; index += 1) {
    lastPass = runMapDirtyPass();
    totalElapsedMs += lastPass.elapsedMs;
  }

  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  if (lastPass === undefined) {
    throw new Error("map-dirty benchmark pass did not produce a report");
  }

  return {
    name: "map-dirty",
    ...lastPass,
    elapsedMs: totalElapsedMs / MAP_DIRTY_TIMED_PASS_COUNT,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

function runMapDirtyPass(): MapDirtyBenchmarkPassReport {
  const grid = createMapGrid({
    width: MAP_DIRTY_WIDTH,
    height: MAP_DIRTY_HEIGHT,
    chunkSize: MAP_DIRTY_CHUNK_SIZE,
  });
  const processedOutput = new Uint32Array(MAP_DIRTY_REBUILD_BUDGET_PER_TICK);
  const startedAtMs = performance.now();
  let changedCells = 0;

  for (let chunkY = 0; chunkY < grid.chunkRows; chunkY += 1) {
    for (let chunkX = 0; chunkX < grid.chunkColumns; chunkX += 1) {
      changedCells += dirtyCellsInsideChunk(grid, chunkX, chunkY, MAP_DIRTY_CHUNK_SIZE);
    }
  }

  const dirtyQueuePeak = grid.dirtyChunkCount;
  let processedChunks = 0;
  let processedChecksum = 0;
  let drainTicks = 0;

  while (grid.dirtyChunkCount > 0) {
    const processed = grid.processDirtyChunks(MAP_DIRTY_REBUILD_BUDGET_PER_TICK, processedOutput);

    if (!processed.ok) {
      throw new Error(processed.reason);
    }

    for (let index = 0; index < processed.processedCount; index += 1) {
      processedChecksum = mixUint32(processedChecksum, processedOutput[index] ?? 0);
    }

    processedChunks += processed.processedCount;
    drainTicks += 1;
  }

  const mapHash = formatCanonicalWorldHash({
    fields: grid.createHashFields(),
    randomStreams: [],
    queuedCommands: [],
  });
  const elapsedMs = performance.now() - startedAtMs;

  return {
    width: MAP_DIRTY_WIDTH,
    height: MAP_DIRTY_HEIGHT,
    chunkSize: MAP_DIRTY_CHUNK_SIZE,
    changedCells,
    dirtyQueuePeak,
    rebuildBudgetPerTick: MAP_DIRTY_REBUILD_BUDGET_PER_TICK,
    drainTicks,
    processedChunks,
    remainingDirtyChunks: grid.dirtyChunkCount,
    finalGlobalVersion: grid.globalVersion,
    processedChecksum,
    mapHash,
    elapsedMs,
  };
}

export function mapDirtyInvariantsFromReport(
  report: MapDirtyBenchmarkReport,
): MapDirtyBenchmarkInvariants {
  return {
    width: report.width,
    height: report.height,
    chunkSize: report.chunkSize,
    changedCells: report.changedCells,
    dirtyQueuePeak: report.dirtyQueuePeak,
    rebuildBudgetPerTick: report.rebuildBudgetPerTick,
    drainTicks: report.drainTicks,
    processedChunks: report.processedChunks,
    remainingDirtyChunks: report.remainingDirtyChunks,
    finalGlobalVersion: report.finalGlobalVersion,
    processedChecksum: report.processedChecksum,
    mapHash: report.mapHash,
  };
}

function dirtyCellsInsideChunk(
  grid: MapGrid,
  chunkX: number,
  chunkY: number,
  chunkSize: number,
): number {
  let changedCells = 0;
  const baseX = chunkX * chunkSize;
  const baseY = chunkY * chunkSize;

  for (let localY = 0; localY < 4; localY += 1) {
    for (let localX = 0; localX < 4; localX += 1) {
      const update = grid.updateCell(baseX + localX, baseY + localY, {
        terrain: (localX + localY + chunkX + chunkY) & 0xffff,
        walkCostMilli: 1_000 + localX + localY,
        regionId: chunkY * grid.chunkColumns + chunkX + 1,
        roomId: localY * 4 + localX + 1,
      });

      if (!update.ok) {
        throw new Error(update.reason);
      }

      if (update.changed) {
        changedCells += 1;
      }
    }
  }

  return changedCells;
}
