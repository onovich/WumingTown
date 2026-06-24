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

export function runMapDirtyBenchmark(): MapDirtyBenchmarkReport {
  const width = 256;
  const height = 256;
  const chunkSize = 32;
  const rebuildBudgetPerTick = 8;
  const grid = createMapGrid({ width, height, chunkSize });
  const processedOutput = new Uint32Array(rebuildBudgetPerTick);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  let changedCells = 0;

  for (let chunkY = 0; chunkY < grid.chunkRows; chunkY += 1) {
    for (let chunkX = 0; chunkX < grid.chunkColumns; chunkX += 1) {
      changedCells += dirtyCellsInsideChunk(grid, chunkX, chunkY, chunkSize);
    }
  }

  const dirtyQueuePeak = grid.dirtyChunkCount;
  let processedChunks = 0;
  let processedChecksum = 0;
  let drainTicks = 0;

  while (grid.dirtyChunkCount > 0) {
    const processed = grid.processDirtyChunks(rebuildBudgetPerTick, processedOutput);

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
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "map-dirty",
    width,
    height,
    chunkSize,
    changedCells,
    dirtyQueuePeak,
    rebuildBudgetPerTick,
    drainTicks,
    processedChunks,
    remainingDirtyChunks: grid.dirtyChunkCount,
    finalGlobalVersion: grid.globalVersion,
    processedChecksum,
    mapHash,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
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
