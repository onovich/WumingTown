import { describe, expect, it } from "vitest";

import {
  DEFAULT_WALK_COST_MILLI,
  createMapGrid,
  formatCanonicalWorldHash,
  type CanonicalWorldField,
} from "./index";

describe("deterministic map grid and chunk dirty queues", () => {
  it("stores authoritative cell lanes in contiguous typed arrays", () => {
    const grid = createMapGrid({ width: 4, height: 3, chunkSize: 2 });
    const snapshot = grid.createSnapshot();

    expect(snapshot.cellCount).toBe(12);
    expect(snapshot.chunkCount).toBe(4);
    expect(snapshot.terrain).toBeInstanceOf(Uint16Array);
    expect(snapshot.occupancy).toBeInstanceOf(Int32Array);
    expect(snapshot.walkCostMilli).toBeInstanceOf(Uint32Array);
    expect(snapshot.wallMask).toBeInstanceOf(Uint8Array);
    expect(snapshot.doorMask).toBeInstanceOf(Uint8Array);
    expect(snapshot.regionId).toBeInstanceOf(Uint32Array);
    expect(snapshot.roomId).toBeInstanceOf(Uint32Array);
    expect(snapshot.cellVersion).toBeInstanceOf(Uint32Array);
    expect(snapshot.chunkVersion).toBeInstanceOf(Uint32Array);
    expect(snapshot.chunkDirty).toBeInstanceOf(Uint8Array);
    expect(grid.readCell(1, 1)).toStrictEqual({
      ok: true,
      cell: {
        cellIndex: 5,
        chunkIndex: 0,
        terrain: 0,
        occupancy: 0,
        walkCostMilli: DEFAULT_WALK_COST_MILLI,
        wallMask: 0,
        doorMask: 0,
        regionId: 0,
        roomId: 0,
        cellVersion: 0,
      },
    });
  });

  it("updates integer lanes with cell and chunk versions plus local dirty marks", () => {
    const grid = createMapGrid({ width: 8, height: 8, chunkSize: 4 });

    expect(
      grid.updateCell(5, 1, {
        terrain: 2,
        occupancy: 17,
        walkCostMilli: 1_500,
        wallMask: 0,
        doorMask: 0,
        regionId: 3,
        roomId: 9,
      }),
    ).toStrictEqual({
      ok: true,
      changed: true,
      cellIndex: 13,
      chunkIndex: 1,
      cellVersion: 1,
      chunkVersion: 1,
      dirtyQueued: true,
    });
    expect(grid.dirtyChunkCount).toBe(1);
    expect(grid.readCell(5, 1)).toStrictEqual({
      ok: true,
      cell: {
        cellIndex: 13,
        chunkIndex: 1,
        terrain: 2,
        occupancy: 17,
        walkCostMilli: 1_500,
        regionId: 3,
        roomId: 9,
        cellVersion: 1,
      },
    });
  });

  it("does not grow dirty queues or versions for unchanged writes", () => {
    const grid = createMapGrid({ width: 8, height: 8, chunkSize: 4 });

    expect(grid.updateCell(0, 0, { terrain: 1 }).ok).toBe(true);
    expect(grid.updateCell(0, 0, { terrain: 1 })).toStrictEqual({
      ok: true,
      changed: false,
      cellIndex: 0,
      chunkIndex: 0,
      cellVersion: 1,
      chunkVersion: 1,
      dirtyQueued: false,
    });
    expect(grid.globalVersion).toBe(1);
    expect(grid.dirtyChunkCount).toBe(1);

    const output = new Uint32Array(1);
    expect(grid.processDirtyChunks(1, output)).toStrictEqual({
      ok: true,
      processedCount: 1,
      remainingCount: 0,
    });
    expect(output[0]).toBe(0);
    expect(grid.dirtyChunkCount).toBe(0);
    expect(grid.updateCell(0, 0, { terrain: 1 })).toMatchObject({
      ok: true,
      changed: false,
    });
    expect(grid.dirtyChunkCount).toBe(0);
  });

  it("drains dirty chunks with an explicit per-tick budget", () => {
    const grid = createMapGrid({ width: 8, height: 8, chunkSize: 4 });

    expect(grid.updateCell(0, 0, { terrain: 1 }).ok).toBe(true);
    expect(grid.updateCell(5, 0, { terrain: 1 }).ok).toBe(true);
    expect(grid.updateCell(0, 5, { terrain: 1 }).ok).toBe(true);
    expect(grid.updateCell(7, 7, { terrain: 1 }).ok).toBe(true);

    const firstOutput = new Uint32Array(2);
    expect(grid.processDirtyChunks(2, firstOutput)).toStrictEqual({
      ok: true,
      processedCount: 2,
      remainingCount: 2,
    });
    expect(Array.from(firstOutput)).toStrictEqual([0, 1]);

    const secondOutput = new Uint32Array(4);
    expect(grid.processDirtyChunks(4, secondOutput)).toStrictEqual({
      ok: true,
      processedCount: 2,
      remainingCount: 0,
    });
    expect(Array.from(secondOutput.slice(0, 2))).toStrictEqual([2, 3]);
  });

  it("keeps snapshot arrays detached from live authoritative storage", () => {
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });

    expect(grid.updateCell(1, 1, { terrain: 4, walkCostMilli: 2_000 }).ok).toBe(true);
    const snapshot = grid.createSnapshot();
    snapshot.terrain[5] = 99;
    snapshot.walkCostMilli[5] = 99;

    expect(grid.readCell(1, 1)).toStrictEqual({
      ok: true,
      cell: {
        cellIndex: 5,
        chunkIndex: 0,
        terrain: 4,
        occupancy: 0,
        walkCostMilli: 2_000,
        wallMask: 0,
        doorMask: 0,
        regionId: 0,
        roomId: 0,
        cellVersion: 1,
      },
    });
  });

  it("feeds map state into canonical world hash in stable field order", () => {
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    expect(grid.updateCell(2, 1, { terrain: 7, walkCostMilli: 3_000 }).ok).toBe(true);
    expect(grid.updateCell(1, 3, { regionId: 5, roomId: 6 }).ok).toBe(true);

    const fields = grid.createHashFields();
    const reversedFields: CanonicalWorldField[] = [];
    for (let index = fields.length - 1; index >= 0; index -= 1) {
      const field = fields[index];
      if (field !== undefined) {
        reversedFields.push(field);
      }
    }

    const firstHash = formatCanonicalWorldHash({
      fields,
      randomStreams: [],
      queuedCommands: [],
    });
    const secondHash = formatCanonicalWorldHash({
      fields: reversedFields,
      randomStreams: [],
      queuedCommands: [],
    });

    expect(firstHash).toBe(secondHash);
  });

  it("reports structured reasons for invalid coordinates, values and dirty budgets", () => {
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });

    expect(grid.readCell(4, 0)).toStrictEqual({
      ok: false,
      reason: "map_coordinate_out_of_range",
    });
    expect(grid.updateCell(0, 0, { terrain: 0x1_0000 })).toStrictEqual({
      ok: false,
      reason: "map_value_out_of_range",
    });
    expect(grid.processDirtyChunks(-1, new Uint32Array(0))).toStrictEqual({
      ok: false,
      reason: "map_budget_out_of_range",
    });
    expect(grid.processDirtyChunks(2, new Uint32Array(1))).toStrictEqual({
      ok: false,
      reason: "map_dirty_output_too_small",
    });
  });
});
