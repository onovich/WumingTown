import { describe, expect, it } from "vitest";

import {
  M4_FINAL_TICK,
  M4_LOAD_TICK,
  M4_REBUILT_SURFACE_NAMES,
  M4_REPLAY_CHECKPOINT_SEQUENCE,
  M4_SAVE_TICK,
  compareM4ReplayRuns,
  createM4AdvanceCommandId,
  createM4CoreVerticalSliceSaveEnvelope,
  loadM4CoreVerticalSliceSaveEnvelope,
  parseM4AdvanceCommandId,
  resumeM4CoreVerticalSliceFromSave,
  runM4CoreVerticalSliceReplay,
  type M4OwnerBranchRecord,
  type M4ReplayCheckpoint,
  type M4SaveEnvelope,
} from "./index";

describe("M4 core vertical slice save replay", () => {
  it("resumes from a checkpoint with matching uninterrupted hashes", () => {
    const expected = runM4CoreVerticalSliceReplay({
      seed: "4",
      checkpointTicks: M4_REPLAY_CHECKPOINT_SEQUENCE,
    });
    const save = createM4CoreVerticalSliceSaveEnvelope("4", M4_SAVE_TICK);
    const resumed = resumeM4CoreVerticalSliceFromSave({
      save,
      loadTick: M4_LOAD_TICK,
      finalTick: M4_FINAL_TICK,
      checkpointTicks: M4_REPLAY_CHECKPOINT_SEQUENCE,
    });

    expect(expected.ok).toBe(true);
    expect(resumed.ok).toBe(true);
    if (!expected.ok || !resumed.ok) {
      return;
    }

    expect(resumed.replay.source).toBe("loaded-save");
    expect(resumed.replay.loadedStateHash).not.toBe("0x00000000");
    expect(resumed.replay.finalWorldHash).toBe(expected.replay.finalWorldHash);
    expect(resumed.replay.finalReadModelHash).toBe(expected.replay.finalReadModelHash);
    const expectedResumeCheckpoints: M4ReplayCheckpoint[] = [];
    for (const checkpoint of expected.replay.checkpoints) {
      if (checkpoint.tick >= M4_SAVE_TICK) {
        expectedResumeCheckpoints.push(checkpoint);
      }
    }
    expect(resumed.replay.checkpoints).toEqual(expectedResumeCheckpoints);
  });

  it("validates envelope ids seeds versions and integer lanes before load succeeds", () => {
    const save = createM4CoreVerticalSliceSaveEnvelope("4", M4_SAVE_TICK);

    expect(loadM4CoreVerticalSliceSaveEnvelope({ ...save, scenarioId: "wrong" })).toEqual({
      ok: false,
      reason: "m4_save_scenario_invalid",
    });
    expect(loadM4CoreVerticalSliceSaveEnvelope({ ...save, seed: "999" })).toEqual({
      ok: false,
      reason: "m4_save_seed_mismatch",
    });
    expect(loadM4CoreVerticalSliceSaveEnvelope({ ...save, formatVersion: 99 })).toEqual({
      ok: false,
      reason: "m4_save_version_invalid",
    });

    const zeroVersion = withBranchRecord(save, 0, {
      evidenceOwnerVersion: 0,
    });
    expect(loadM4CoreVerticalSliceSaveEnvelope(zeroVersion)).toEqual({
      ok: false,
      reason: "m4_save_section_invalid",
    });

    const unsortedHandles = {
      ...save,
      sections: {
        ...save.sections,
        ownerStores: {
          ...save.sections.ownerStores,
          ownerHandles: [
            must(save.sections.ownerStores.ownerHandles[1]),
            must(save.sections.ownerStores.ownerHandles[0]),
            must(save.sections.ownerStores.ownerHandles[2]),
            must(save.sections.ownerStores.ownerHandles[3]),
          ],
        },
      },
    };
    expect(loadM4CoreVerticalSliceSaveEnvelope(unsortedHandles)).toEqual({
      ok: false,
      reason: "m4_save_section_invalid",
    });
  });

  it("rejects stale checkpoint hashes crisis rows director windows and projections", () => {
    const save = createM4CoreVerticalSliceSaveEnvelope("4", M4_SAVE_TICK);

    const commandHashTamper = {
      ...save,
      sections: {
        ...save.sections,
        commandLogTail: {
          ...save.sections.commandLogTail,
          commandStreamHash: "0x00000001",
        },
      },
    };
    expect(loadM4CoreVerticalSliceSaveEnvelope(commandHashTamper)).toEqual({
      ok: false,
      reason: "m4_save_integrity_mismatch",
    });

    const crisisTamper = {
      ...save,
      sections: {
        ...save.sections,
        crisisDirector: {
          ...save.sections.crisisDirector,
          crisisRecords: [
            {
              ...must(save.sections.crisisDirector.crisisRecords[0]),
              state: -1,
            },
            must(save.sections.crisisDirector.crisisRecords[1]),
            must(save.sections.crisisDirector.crisisRecords[2]),
          ],
        },
      },
    };
    expect(loadM4CoreVerticalSliceSaveEnvelope(crisisTamper)).toEqual({
      ok: false,
      reason: "m4_save_section_invalid",
    });

    const directorWindowTamper = {
      ...save,
      sections: {
        ...save.sections,
        crisisDirector: {
          ...save.sections.crisisDirector,
          recoveryWindowRecords: [
            {
              ...must(save.sections.crisisDirector.recoveryWindowRecords[0]),
              endTick: 1,
            },
            must(save.sections.crisisDirector.recoveryWindowRecords[1]),
          ],
        },
      },
    };
    expect(loadM4CoreVerticalSliceSaveEnvelope(directorWindowTamper)).toEqual({
      ok: false,
      reason: "m4_save_section_invalid",
    });

    const projectionTamper = {
      ...save,
      readOnlyProjection: {
        ...save.readOnlyProjection,
        readModelHash: "0x00000001",
      },
    };
    expect(loadM4CoreVerticalSliceSaveEnvelope(projectionTamper)).toEqual({
      ok: false,
      reason: "m4_save_projection_invalid",
    });
  });

  it("reports rebuilt surfaces and save-shaped M4 rows before resumed ticks", () => {
    const save = createM4CoreVerticalSliceSaveEnvelope("4", M4_SAVE_TICK);
    const loaded = loadM4CoreVerticalSliceSaveEnvelope(save);

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }

    expect(loaded.loadTick).toBe(M4_LOAD_TICK);
    expect(loaded.validationTimeTicks).toBe(1);
    expect(loaded.rebuildTimeTicks).toBe(1);
    expect(loaded.rebuiltSurfaceNames).toEqual(M4_REBUILT_SURFACE_NAMES);
    expect(loaded.projection.rebuiltIndexes.names).toEqual(M4_REBUILT_SURFACE_NAMES);
    expect(loaded.projection.rebuiltIndexes.surfaces).toHaveLength(M4_REBUILT_SURFACE_NAMES.length);
    const branchIds: number[] = [];
    for (const row of save.sections.ownerStores.branchRecords) {
      branchIds.push(row.branchId);
    }
    expect(branchIds).toEqual([1, 2, 3]);

    const crisisIds: number[] = [];
    for (const row of save.sections.crisisDirector.crisisRecords) {
      crisisIds.push(row.crisisId);
    }
    expect(crisisIds).toEqual([0, 1, 2]);

    let previousRowId = -1;
    for (const row of save.sections.reasonMetrics.dawnReviewRows) {
      expect(row.rowId).toBeGreaterThan(previousRowId);
      previousRowId = row.rowId;
    }
  });

  it("rejects bounded-read metric corruption in scratch validation", () => {
    const save = createM4CoreVerticalSliceSaveEnvelope("4", M4_SAVE_TICK);
    const tampered = {
      ...save,
      sections: {
        ...save.sections,
        reasonMetrics: {
          ...save.sections.reasonMetrics,
          boundedReads: {
            ...save.sections.reasonMetrics.boundedReads,
            lampGapVisited: save.sections.reasonMetrics.boundedReads.lampGapCandidateCap + 1,
          },
        },
      },
    };

    expect(loadM4CoreVerticalSliceSaveEnvelope(tampered)).toEqual({
      ok: false,
      reason: "m4_save_section_invalid",
    });
    expect(
      resumeM4CoreVerticalSliceFromSave({
        save: tampered,
        loadTick: M4_LOAD_TICK,
        finalTick: M4_FINAL_TICK,
        checkpointTicks: M4_REPLAY_CHECKPOINT_SEQUENCE,
      }),
    ).toEqual({ ok: false, reason: "m4_save_section_invalid" });
  });

  it("names the first divergent replay tick", () => {
    const expected = runM4CoreVerticalSliceReplay({
      seed: "4",
      checkpointTicks: M4_REPLAY_CHECKPOINT_SEQUENCE,
    });
    expect(expected.ok).toBe(true);
    if (!expected.ok) {
      return;
    }

    const diverged: M4ReplayCheckpoint[] = [];
    for (const checkpoint of expected.replay.checkpoints) {
      if (checkpoint.tick === M4_SAVE_TICK) {
        diverged.push({ ...checkpoint, worldHash: "0x00000001" });
      } else {
        diverged.push(checkpoint);
      }
    }
    const comparison = compareM4ReplayRuns(
      expected.replay,
      { ...expected.replay, checkpoints: diverged },
      {
        expectedPath: "expected.json",
        actualPath: "actual.json",
        diffPath: "diff.json",
      },
    );

    expect(comparison).toMatchObject({
      ok: false,
      firstDivergentTick: M4_SAVE_TICK,
      reason: "world_hash_mismatch",
    });
  });

  it("uses deterministic advance command ids", () => {
    const commandId = createM4AdvanceCommandId(M4_LOAD_TICK, 11);
    expect(commandId).toBe("m4.core-vertical-slice.advance.12001.11");
    expect(parseM4AdvanceCommandId(commandId)).toEqual({
      ok: true,
      tick: M4_LOAD_TICK,
      sequence: 11,
    });
    expect(parseM4AdvanceCommandId("m4.core-vertical-slice.advance.bad")).toEqual({
      ok: false,
    });
  });
});

function withBranchRecord(
  save: M4SaveEnvelope,
  index: number,
  patch: Partial<M4SaveEnvelope["sections"]["ownerStores"]["branchRecords"][number]>,
): M4SaveEnvelope {
  const branchRecords: M4OwnerBranchRecord[] = [];
  for (let rowIndex = 0; rowIndex < save.sections.ownerStores.branchRecords.length; rowIndex += 1) {
    const row = must(save.sections.ownerStores.branchRecords[rowIndex]);
    if (rowIndex === index) {
      branchRecords.push({ ...row, ...patch });
    } else {
      branchRecords.push(row);
    }
  }

  return {
    ...save,
    sections: {
      ...save.sections,
      ownerStores: {
        ...save.sections.ownerStores,
        branchRecords,
      },
    },
  };
}

function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("test fixture row missing");
  }
  return value;
}
