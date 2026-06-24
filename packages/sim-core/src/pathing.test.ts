import { describe, expect, it } from "vitest";

import {
  MAP_TERRAIN_BLOCKED,
  createGridPathfinder,
  createMapGrid,
  createPathRequestBatcher,
  createPathVersionBasis,
  createRegionRoomRebuilder,
  resolveTopKPathCandidates,
  type MapGrid,
  type PathRequest,
  type PathSearchResult,
  type PathVersionBasis,
  type RegionRoomRebuilder,
} from "./index";

describe("versioned path request batching and Top-K pathing", () => {
  it("finds a local path around blocked terrain with stable cell output", () => {
    const { grid, basis } = createPathFixture(8, 8);
    blockVerticalWallWithGap(grid, 3, 4);
    const pathfinder = createGridPathfinder(grid.cellCount);
    const result = pathfinder.findPath(grid, createRequest(1, 0, 0, 63, basis));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.reason);
    }

    expect(result.pathCellCount).toBeGreaterThan(0);
    expect(result.path[0]).toBe(0);
    expect(result.path[result.pathCellCount - 1]).toBe(63);
    expect(result.pathCostMilli).toBeGreaterThan(0);
    expect(result.nodeExpansions).toBeGreaterThan(0);

    for (let index = 0; index < result.pathCellCount; index += 1) {
      const cellIndex = result.path[index] ?? 0;
      const cell = grid.readCellByIndex(cellIndex);
      expect(cell).toMatchObject({ ok: true });

      if (cell.ok) {
        expect(cell.cell.terrain).not.toBe(MAP_TERRAIN_BLOCKED);
      }
    }
  });

  it("rejects stale path results when map or navigation versions change before commit", () => {
    const { grid, rebuild, basis } = createPathFixture(6, 6);
    const pathfinder = createGridPathfinder(grid.cellCount);
    const batcher = createPathRequestBatcher(4, pathfinder);

    expect(batcher.enqueue(createRequest(7, 0, 0, 35, basis))).toMatchObject({
      ok: true,
      queuedCount: 1,
    });
    const processed = batcher.processNext(grid);
    expect(processed).toMatchObject({ ok: true, processed: true });
    const result = readProcessedResult(processed);

    expect(grid.updateCell(1, 0, { terrain: MAP_TERRAIN_BLOCKED }).ok).toBe(true);
    expect(rebuild.markCellDirtyByIndex(1)).toMatchObject({ ok: true });
    drainRegionRoom(rebuild);
    const changedBasis = basisFrom(grid, rebuild);

    expect(batcher.commitResult(result, changedBasis)).toStrictEqual({
      ok: false,
      accepted: false,
      reason: "path_stale_result",
      staleRejectedCount: 1,
    });
    expect(batcher.createMetrics()).toMatchObject({
      processedCount: 1,
      acceptedResultCount: 0,
      staleRejectedCount: 1,
    });
  });

  it("reports queue backlog while processing requests in enqueue order", () => {
    const { grid, basis } = createPathFixture(5, 5);
    const pathfinder = createGridPathfinder(grid.cellCount);
    const batcher = createPathRequestBatcher(3, pathfinder);

    expect(batcher.enqueue(createRequest(1, 0, 0, 24, basis))).toMatchObject({
      ok: true,
      queueBacklogPeak: 1,
    });
    expect(batcher.enqueue(createRequest(2, 0, 1, 23, basis))).toMatchObject({
      ok: true,
      queueBacklogPeak: 2,
    });
    expect(batcher.createMetrics()).toMatchObject({ queuedCount: 2, queueBacklogPeak: 2 });

    const first = readProcessedResult(batcher.processNext(grid));
    const second = readProcessedResult(batcher.processNext(grid));
    expect(first.requestSequence).toBe(1);
    expect(second.requestSequence).toBe(2);
    expect(batcher.processNext(grid)).toStrictEqual({
      ok: true,
      processed: false,
      queuedCount: 0,
    });
  });

  it("runs exact local pathing only for bounded Top-K candidates", () => {
    const { grid, basis } = createPathFixture(8, 8);
    const pathfinder = createGridPathfinder(grid.cellCount);
    const resolved = resolveTopKPathCandidates(pathfinder, grid, {
      originCellIndex: 0,
      issuedTick: 4,
      requestSequenceStart: 100,
      basis,
      maxExactPaths: 2,
      candidates: [
        { candidateId: 20, targetCellIndex: 8, scoreMilli: 3_000 },
        { candidateId: 10, targetCellIndex: 63, scoreMilli: 5_000 },
        { candidateId: 11, targetCellIndex: 56, scoreMilli: 5_000 },
        { candidateId: 30, targetCellIndex: 7, scoreMilli: 1_000 },
      ],
    });

    expect(resolved).toMatchObject({
      ok: true,
      candidateCount: 4,
      selectedCount: 2,
      exactPathCount: 2,
      capHitCount: 1,
    });

    if (!resolved.ok) {
      throw new Error(resolved.reason);
    }

    expect(readGoal(resolved.results[0])).toBe(63);
    expect(readGoal(resolved.results[1])).toBe(56);
  });

  it("reissues a fresh request after version changes instead of reusing an old complete path", () => {
    const { grid, rebuild, basis } = createPathFixture(6, 6);
    const pathfinder = createGridPathfinder(grid.cellCount);
    const batcher = createPathRequestBatcher(4, pathfinder);
    const oldResult = pathfinder.findPath(grid, createRequest(1, 0, 0, 35, basis));

    expect(grid.updateCell(2, 0, { terrain: MAP_TERRAIN_BLOCKED }).ok).toBe(true);
    expect(rebuild.markCellDirtyByIndex(2)).toMatchObject({ ok: true });
    drainRegionRoom(rebuild);
    const freshBasis = basisFrom(grid, rebuild);

    expect(batcher.commitResult(oldResult, freshBasis)).toMatchObject({
      ok: false,
      reason: "path_stale_result",
    });

    const freshResult = pathfinder.findPath(grid, createRequest(2, 1, 0, 35, freshBasis));
    expect(batcher.commitResult(freshResult, freshBasis)).toMatchObject({
      ok: true,
      accepted: true,
    });
  });
});

function createPathFixture(
  width: number,
  height: number,
): {
  readonly grid: MapGrid;
  readonly rebuild: RegionRoomRebuilder;
  readonly basis: PathVersionBasis;
} {
  const grid = createMapGrid({ width, height, chunkSize: Math.max(width, height) });
  const rebuild = createRegionRoomRebuilder(grid);
  expect(rebuild.markAllDirtyForLoad()).toMatchObject({ ok: true });
  drainRegionRoom(rebuild);
  return { grid, rebuild, basis: basisFrom(grid, rebuild) };
}

function basisFrom(grid: MapGrid, rebuild: RegionRoomRebuilder): PathVersionBasis {
  return createPathVersionBasis(grid, {
    navigationVersion: rebuild.navigationVersion,
    regionVersion: rebuild.regionVersion,
    roomVersion: rebuild.roomVersion,
    regionGraphVersion: rebuild.regionGraphVersion,
  });
}

function blockVerticalWallWithGap(grid: MapGrid, x: number, gapY: number): void {
  for (let y = 0; y < grid.height; y += 1) {
    if (y !== gapY) {
      expect(grid.updateCell(x, y, { terrain: MAP_TERRAIN_BLOCKED }).ok).toBe(true);
    }
  }
}

function createRequest(
  requestSequence: number,
  issuedTick: number,
  startCellIndex: number,
  goalCellIndex: number,
  basis: PathVersionBasis,
): PathRequest {
  return {
    requestSequence,
    issuedTick,
    startCellIndex,
    goalCellIndex,
    basis,
  };
}

function readProcessedResult(
  processed: ReturnType<ReturnType<typeof createPathRequestBatcher>["processNext"]>,
): PathSearchResult {
  if (!processed.ok || !processed.processed) {
    throw new Error("expected processed path result");
  }

  return processed.result;
}

function readGoal(result: PathSearchResult | undefined): number {
  if (result === undefined) {
    throw new Error("missing top-k path result");
  }

  return result.goalCellIndex;
}

function drainRegionRoom(rebuild: RegionRoomRebuilder): void {
  let guard = 0;

  while (guard < 256) {
    const processed = rebuild.processDirtyCells(128);

    if (!processed.ok) {
      throw new Error(processed.reason);
    }

    if (processed.remainingDirtyCells === 0 && processed.activeCellBacklog === 0) {
      return;
    }

    guard += 1;
  }

  throw new Error("region-room drain guard exhausted for pathing test");
}
