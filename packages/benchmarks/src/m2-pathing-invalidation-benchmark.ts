import { performance } from "node:perf_hooks";

import {
  MAP_TERRAIN_BLOCKED,
  M2_WORK_LOGISTICS_SCENARIO_ID,
  createGridPathfinder,
  createMapGrid,
  createPathRequestBatcher,
  createPathVersionBasis,
  createRegionRoomRebuilder,
  mixUint32,
  type PathSearchResult,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

const SCENARIO_SEED = "2";

export interface M2PathingInvalidationBenchmarkReport {
  readonly name: "m2-pathing-invalidation";
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly width: number;
  readonly height: number;
  readonly requestCount: number;
  readonly staleProbeCount: number;
  readonly processedRequests: number;
  readonly acceptedResults: number;
  readonly staleRejectedResults: number;
  readonly reachedPaths: number;
  readonly nodeExpansions: number;
  readonly queueBacklogPeak: number;
  readonly finalQueueBacklog: number;
  readonly pathChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M2PathingInvalidationBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly scenarioId: string;
  readonly scenarioSeed: string;
  readonly width: number;
  readonly height: number;
  readonly requestCount: number;
  readonly staleProbeCount: number;
  readonly processedRequests: number;
  readonly acceptedResults: number;
  readonly staleRejectedResults: number;
  readonly reachedPaths: number;
  readonly nodeExpansions: number;
  readonly queueBacklogPeak: number;
  readonly finalQueueBacklog: number;
  readonly pathChecksum: number;
}

export interface SampledM2PathingInvalidationBenchmark {
  readonly name: "m2-pathing-invalidation";
  readonly report: M2PathingInvalidationBenchmarkReport;
  readonly invariants: M2PathingInvalidationBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM2PathingInvalidationBenchmark(): M2PathingInvalidationBenchmarkReport {
  const width = 40;
  const height = 24;
  const requestCount = 100;
  const staleProbeCount = 1;
  const grid = createMapGrid({ width, height, chunkSize: 8 });
  carveDeterministicBarriers(grid);
  const rebuild = createRegionRoomRebuilder(grid);
  const loaded = rebuild.markAllDirtyForLoad();

  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }

  drainRegionRoom(rebuild);
  const basis = createPathVersionBasis(grid, {
    navigationVersion: rebuild.navigationVersion,
    regionVersion: rebuild.regionVersion,
    roomVersion: rebuild.roomVersion,
    regionGraphVersion: rebuild.regionGraphVersion,
  });
  const pathfinder = createGridPathfinder(grid.cellCount);
  const batcher = createPathRequestBatcher(128, pathfinder);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  for (let index = 0; index < requestCount; index += 1) {
    const startX = (index * 3) % width;
    const goalX = (index * 11 + 5) % width;
    const enqueued = batcher.enqueue({
      requestSequence: index,
      issuedTick: index,
      startCellIndex: startX,
      goalCellIndex: (height - 1) * width + goalX,
      basis,
      maxNodeExpansions: 2_048,
    });

    if (!enqueued.ok) {
      throw new Error(enqueued.reason);
    }
  }

  let reachedPaths = 0;
  let pathChecksum = 0;

  while (batcher.queuedCount > 0) {
    const processed = batcher.processNext(grid);

    if (!processed.ok || !processed.processed) {
      throw new Error(processed.ok ? "missing M2 pathing benchmark result" : processed.reason);
    }

    const committed = batcher.commitResult(processed.result, basis);

    if (!committed.ok) {
      throw new Error(committed.reason);
    }

    if (processed.result.ok) {
      reachedPaths += 1;
    }

    pathChecksum = mixPathResult(pathChecksum, processed.result);
  }

  const staleEnqueued = batcher.enqueue({
    requestSequence: requestCount,
    issuedTick: requestCount,
    startCellIndex: 0,
    goalCellIndex: grid.cellCount - 1,
    basis,
    maxNodeExpansions: 2_048,
  });

  if (!staleEnqueued.ok) {
    throw new Error(staleEnqueued.reason);
  }

  const staleProcessed = batcher.processNext(grid);

  if (!staleProcessed.ok || !staleProcessed.processed) {
    throw new Error(staleProcessed.ok ? "missing M2 stale path result" : staleProcessed.reason);
  }

  const changed = grid.updateCell(1, 0, { terrain: MAP_TERRAIN_BLOCKED });

  if (!changed.ok) {
    throw new Error(changed.reason);
  }

  const marked = rebuild.markCellDirtyByIndex(1);

  if (!marked.ok) {
    throw new Error(marked.reason);
  }

  drainRegionRoom(rebuild);
  const changedBasis = createPathVersionBasis(grid, {
    navigationVersion: rebuild.navigationVersion,
    regionVersion: rebuild.regionVersion,
    roomVersion: rebuild.roomVersion,
    regionGraphVersion: rebuild.regionGraphVersion,
  });
  const staleCommitted = batcher.commitResult(staleProcessed.result, changedBasis);

  if (staleCommitted.ok) {
    throw new Error("M2 pathing stale probe unexpectedly committed");
  }

  pathChecksum = mixPathResult(pathChecksum, staleProcessed.result);
  const metrics = batcher.createMetrics();
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "m2-pathing-invalidation",
    scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
    scenarioSeed: SCENARIO_SEED,
    width,
    height,
    requestCount,
    staleProbeCount,
    processedRequests: metrics.processedCount,
    acceptedResults: metrics.acceptedResultCount,
    staleRejectedResults: metrics.staleRejectedCount,
    reachedPaths,
    nodeExpansions: metrics.nodeExpansionTotal,
    queueBacklogPeak: metrics.queueBacklogPeak,
    finalQueueBacklog: metrics.queuedCount,
    pathChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m2PathingInvalidationInvariantsFromReport(
  report: M2PathingInvalidationBenchmarkReport,
): M2PathingInvalidationBenchmarkInvariants {
  return {
    scenarioId: report.scenarioId,
    scenarioSeed: report.scenarioSeed,
    width: report.width,
    height: report.height,
    requestCount: report.requestCount,
    staleProbeCount: report.staleProbeCount,
    processedRequests: report.processedRequests,
    acceptedResults: report.acceptedResults,
    staleRejectedResults: report.staleRejectedResults,
    reachedPaths: report.reachedPaths,
    nodeExpansions: report.nodeExpansions,
    queueBacklogPeak: report.queueBacklogPeak,
    finalQueueBacklog: report.finalQueueBacklog,
    pathChecksum: report.pathChecksum,
  };
}

function carveDeterministicBarriers(grid: ReturnType<typeof createMapGrid>): void {
  for (let y = 0; y < grid.height; y += 1) {
    if (y !== 5 && y !== 11 && y !== 17) {
      setBlocked(grid, 10, y);
      setBlocked(grid, 20, y);
      setBlocked(grid, 30, y);
    }
  }
}

function setBlocked(grid: ReturnType<typeof createMapGrid>, x: number, y: number): void {
  const updated = grid.updateCell(x, y, { terrain: MAP_TERRAIN_BLOCKED });

  if (!updated.ok) {
    throw new Error(updated.reason);
  }
}

function mixPathResult(checksum: number, result: PathSearchResult): number {
  let next = mixUint32(checksum, result.requestSequence);
  next = mixUint32(next, result.nodeExpansions);
  next = mixUint32(next, result.ok ? 1 : 0);

  if (result.ok) {
    next = mixUint32(next, result.pathCellCount);
    next = mixUint32(next, result.pathCostMilli);
    next = mixUint32(next, result.path[0] ?? 0);
    next = mixUint32(next, result.path[result.pathCellCount - 1] ?? 0);
  }

  return next;
}

function drainRegionRoom(rebuild: ReturnType<typeof createRegionRoomRebuilder>): void {
  let guard = 0;

  while (guard < 512) {
    const processed = rebuild.processDirtyCells(256);

    if (!processed.ok) {
      throw new Error(processed.reason);
    }

    if (processed.remainingDirtyCells === 0 && processed.activeCellBacklog === 0) {
      return;
    }

    guard += 1;
  }

  throw new Error("M2 pathing invalidation benchmark region-room drain guard exhausted");
}
