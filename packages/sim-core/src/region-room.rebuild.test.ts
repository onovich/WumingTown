import { describe, expect, it } from "vitest";

import {
  MAP_DIRECTION_MASK_EAST,
  MAP_DIRECTION_MASK_WEST,
  MAP_TERRAIN_BLOCKED,
  createMapGrid,
  createRegionRoomRebuilder,
  type MapCellView,
  type MapGrid,
  type RegionRoomRebuilder,
} from "./index";

describe("incremental region and room rebuild", () => {
  it("merges rooms after local wall removal without synchronous full-map rebuild", () => {
    const { grid, rebuild } = createRebuiltFixture(6, 1, 3);

    closeEastWestWall(grid, 2, 0);
    expect(rebuild.markCellDirty(2, 0)).toMatchObject({ ok: true });
    drainOrThrow(rebuild, 2);
    const leftClosed = readCellOrThrow(grid, 1, 0);
    const rightClosed = readCellOrThrow(grid, 4, 0);

    expect(leftClosed.regionId).not.toBe(rightClosed.regionId);
    expect(rebuild.navigationVersion).toBeGreaterThan(1);

    openEastWestWall(grid, 2, 0);
    const marked = rebuild.markCellDirty(2, 0);
    expect(marked).toMatchObject({
      ok: true,
      enqueuedCells: 3,
    });
    expect(rebuild.dirtyCellCount).toBeGreaterThan(0);

    drainOrThrow(rebuild, 2);
    const leftOpen = readCellOrThrow(grid, 1, 0);
    const rightOpen = readCellOrThrow(grid, 4, 0);

    expect(leftOpen.regionId).toBe(rightOpen.regionId);
    expect(leftOpen.roomId).toBe(rightOpen.roomId);
  });

  it("toggles closed doors with monotonic navigation versions", () => {
    const { grid, rebuild } = createRebuiltFixture(5, 3, 5);
    const initialVersion = rebuild.navigationVersion;

    closeEastWestWall(grid, 1, 0);
    closeEastWestWall(grid, 1, 2);
    closeEastWestDoor(grid, 1, 1);
    expect(rebuild.markCellDirty(1, 1)).toMatchObject({ ok: true });
    expect(rebuild.navigationVersion).toBe(initialVersion + 1);
    drainOrThrow(rebuild, 3);

    const closedLeft = readCellOrThrow(grid, 0, 1);
    const closedRight = readCellOrThrow(grid, 3, 1);
    expect(closedLeft.regionId).not.toBe(closedRight.regionId);

    openEastWestDoor(grid, 1, 1);
    expect(rebuild.markCellDirty(1, 1)).toMatchObject({ ok: true });
    expect(rebuild.navigationVersion).toBe(initialVersion + 2);
    drainOrThrow(rebuild, 3);

    const openedLeft = readCellOrThrow(grid, 0, 1);
    const openedRight = readCellOrThrow(grid, 3, 1);
    const graphBasis = rebuild.createRegionGraphBasis();

    expect(openedLeft.regionId).toBe(openedRight.regionId);
    expect(openedLeft.roomId).toBe(openedRight.roomId);
    expect(graphBasis.navigationVersion).toBe(rebuild.navigationVersion);
    expect(graphBasis.regionGraphVersion).toBe(rebuild.regionGraphVersion);
    expect(graphBasis.regionCount).toBeGreaterThan(0);
  });

  it("handles cross-boundary movement when an edge changes across chunks", () => {
    const { grid, rebuild } = createRebuiltFixture(4, 2, 2);

    closeEastWestWall(grid, 1, 0);
    expect(rebuild.markCellDirty(1, 0)).toMatchObject({ ok: true });
    drainOrThrow(rebuild, 1);
    expect(grid.canMoveBetweenCardinalNeighbors(1, 2)).toStrictEqual({
      ok: true,
      passable: false,
    });

    openEastWestWall(grid, 1, 0);
    expect(rebuild.markCellDirty(1, 0)).toMatchObject({ ok: true });
    drainOrThrow(rebuild, 1);
    expect(grid.canMoveBetweenCardinalNeighbors(1, 2)).toStrictEqual({
      ok: true,
      passable: true,
    });
    expect(readCellOrThrow(grid, 0, 0).regionId).toBe(readCellOrThrow(grid, 3, 0).regionId);
  });

  it("keeps blocked terrain out of rooms and reports consistent room ids", () => {
    const grid = createMapGrid({ width: 3, height: 3, chunkSize: 3 });
    const rebuild = createRegionRoomRebuilder(grid);

    expect(grid.updateCell(1, 1, { terrain: MAP_TERRAIN_BLOCKED }).ok).toBe(true);
    expect(rebuild.markAllDirtyForLoad()).toMatchObject({ ok: true });
    drainOrThrow(rebuild, 2);

    const blocked = readCellOrThrow(grid, 1, 1);
    const corner = readCellOrThrow(grid, 0, 0);
    const opposite = readCellOrThrow(grid, 2, 2);
    const metrics = rebuild.createMetrics();

    expect(blocked.regionId).toBe(0);
    expect(blocked.roomId).toBe(0);
    expect(corner.regionId).toBe(opposite.regionId);
    expect(corner.roomId).toBe(opposite.roomId);
    expect(metrics.dirtyCellCount).toBe(0);
    expect(metrics.activeCellBacklog).toBe(0);
  });
});

function createRebuiltFixture(
  width: number,
  height: number,
  chunkSize: number,
): {
  readonly grid: MapGrid;
  readonly rebuild: RegionRoomRebuilder;
} {
  const grid = createMapGrid({ width, height, chunkSize });
  const rebuild = createRegionRoomRebuilder(grid);

  expect(rebuild.markAllDirtyForLoad()).toMatchObject({ ok: true });
  drainOrThrow(rebuild, 4);
  return { grid, rebuild };
}

function closeEastWestWall(grid: MapGrid, westX: number, y: number): void {
  expect(grid.updateCell(westX, y, { wallMask: MAP_DIRECTION_MASK_EAST }).ok).toBe(true);
  expect(grid.updateCell(westX + 1, y, { wallMask: MAP_DIRECTION_MASK_WEST }).ok).toBe(true);
}

function openEastWestWall(grid: MapGrid, westX: number, y: number): void {
  expect(grid.updateCell(westX, y, { wallMask: 0 }).ok).toBe(true);
  expect(grid.updateCell(westX + 1, y, { wallMask: 0 }).ok).toBe(true);
}

function closeEastWestDoor(grid: MapGrid, westX: number, y: number): void {
  expect(grid.updateCell(westX, y, { doorMask: MAP_DIRECTION_MASK_EAST }).ok).toBe(true);
  expect(grid.updateCell(westX + 1, y, { doorMask: MAP_DIRECTION_MASK_WEST }).ok).toBe(true);
}

function openEastWestDoor(grid: MapGrid, westX: number, y: number): void {
  expect(grid.updateCell(westX, y, { doorMask: 0 }).ok).toBe(true);
  expect(grid.updateCell(westX + 1, y, { doorMask: 0 }).ok).toBe(true);
}

function drainOrThrow(rebuild: RegionRoomRebuilder, budget: number): void {
  let guard = 0;

  while (guard < 256) {
    const processed = rebuild.processDirtyCells(budget);

    if (!processed.ok) {
      throw new Error(processed.reason);
    }

    if (processed.remainingDirtyCells === 0 && processed.activeCellBacklog === 0) {
      return;
    }

    guard += 1;
  }

  throw new Error("region-room drain guard exhausted");
}

function readCellOrThrow(grid: MapGrid, x: number, y: number): MapCellView {
  const result = grid.readCell(x, y);

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.cell;
}
