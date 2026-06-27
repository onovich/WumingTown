import { describe, expect, it } from "vitest";

import {
  M8_FINAL_TICK,
  M8_LOAD_TICK,
  M8_REBUILT_SURFACE_NAMES,
  M8_REPLAY_CHECKPOINT_SEQUENCE,
  M8_SAVE_TICK,
  compareM8ReplayRuns,
  createM8AdvanceCommandId,
  createM8FactionEndgameSaveEnvelope,
  loadM8FactionEndgameSaveEnvelope,
  parseM8AdvanceCommandId,
  resumeM8FactionEndgameFromSave,
  runM8FactionEndgameReplay,
  type M8FactionArcSaveRecord,
  type M8ReplayCheckpoint,
  type M8RouteSaveRecord,
  type M8SaveEnvelope,
} from "./index";

describe("M8 long-save and migration gate", () => {
  it("resumes the focused M8 owner slice with matching long-save hashes", () => {
    const expected = runM8FactionEndgameReplay({
      seed: "123",
      checkpointTicks: M8_REPLAY_CHECKPOINT_SEQUENCE,
    });
    const save = createM8FactionEndgameSaveEnvelope("123", M8_SAVE_TICK);
    const resumed = resumeM8FactionEndgameFromSave({
      save,
      loadTick: M8_LOAD_TICK,
      finalTick: M8_FINAL_TICK,
      checkpointTicks: M8_REPLAY_CHECKPOINT_SEQUENCE,
    });

    expect(expected.ok).toBe(true);
    expect(resumed.ok).toBe(true);
    if (!expected.ok || !resumed.ok) return;

    expect(resumed.replay.source).toBe("loaded-save");
    expect(resumed.replay.loadedStateHash).not.toBe("0x00000000");
    expect(resumed.replay.finalWorldHash).toBe(expected.replay.finalWorldHash);
    expect(resumed.replay.finalReadModelHash).toBe(expected.replay.finalReadModelHash);

    const expectedResumeCheckpoints: M8ReplayCheckpoint[] = [];
    for (const checkpoint of expected.replay.checkpoints) {
      if (checkpoint.tick >= M8_SAVE_TICK) expectedResumeCheckpoints.push(checkpoint);
    }
    expect(resumed.replay.checkpoints).toEqual(expectedResumeCheckpoints);
  });

  it("keeps migration and interoperability policy owner-gated in the save evidence", () => {
    const save = createM8FactionEndgameSaveEnvelope("123", M8_SAVE_TICK);
    const loaded = loadM8FactionEndgameSaveEnvelope(save);

    expect(save.migrationPolicy).toEqual({
      migrationPolicyVersion: 1,
      publicSaveCompatibility: "owner_gated",
      crossVersionMigration: "owner_gated",
      windowsWebInteroperability: "owner_gated",
      desktopSaveBridge: "owner_gated",
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.loadTick).toBe(M8_LOAD_TICK);
    expect(loaded.validationTimeTicks).toBe(2);
    expect(loaded.rebuildTimeTicks).toBe(2);
    expect(loaded.rebuiltSurfaceNames).toEqual(M8_REBUILT_SURFACE_NAMES);
    expect(save.sections.ownerStores.factionArcRecords).toHaveLength(6);
    expect(save.sections.ownerStores.routeRecords).toHaveLength(5);
    expect(save.sections.commandLogTail.commandTail).toHaveLength(3);
  });

  it("rejects saves and resumes outside the focused WM-0125 gate ticks", () => {
    expect(() => createM8FactionEndgameSaveEnvelope("123", 1)).toThrow(
      "M8 save replay requires a non-empty seed and the focused gate save tick",
    );

    const save = createM8FactionEndgameSaveEnvelope("123", M8_SAVE_TICK);
    expect(loadM8FactionEndgameSaveEnvelope({ ...save, createdTick: 1, nextTick: 2 })).toEqual({
      ok: false,
      reason: "m8_tick_invalid",
    });
    expect(loadM8FactionEndgameSaveEnvelope({ ...save, nextTick: M8_LOAD_TICK + 1 })).toEqual({
      ok: false,
      reason: "m8_tick_invalid",
    });
    expect(
      resumeM8FactionEndgameFromSave({
        save,
        loadTick: M8_LOAD_TICK,
        finalTick: M8_SAVE_TICK,
        checkpointTicks: M8_REPLAY_CHECKPOINT_SEQUENCE,
      }),
    ).toEqual({ ok: false, reason: "m8_resume_tick_before_load" });
    expect(
      resumeM8FactionEndgameFromSave({
        save,
        loadTick: M8_LOAD_TICK,
        finalTick: M8_LOAD_TICK,
        checkpointTicks: M8_REPLAY_CHECKPOINT_SEQUENCE,
      }),
    ).toEqual({ ok: false, reason: "m8_tick_invalid" });
  });

  it("rejects public compatibility and Windows/Web claims without owner approval", () => {
    const save = createM8FactionEndgameSaveEnvelope("123", M8_SAVE_TICK);

    expect(
      loadM8FactionEndgameSaveEnvelope({
        ...save,
        migrationPolicy: {
          ...save.migrationPolicy,
          publicSaveCompatibility: "approved",
        },
      }),
    ).toEqual({ ok: false, reason: "m8_save_migration_policy_invalid" });

    expect(
      loadM8FactionEndgameSaveEnvelope({
        ...save,
        migrationPolicy: {
          ...save.migrationPolicy,
          windowsWebInteroperability: "approved",
        },
      }),
    ).toEqual({ ok: false, reason: "m8_save_migration_policy_invalid" });
  });

  it("validates scenario identity owner rows command tail and projection in scratch", () => {
    const save = createM8FactionEndgameSaveEnvelope("123", M8_SAVE_TICK);

    expect(loadM8FactionEndgameSaveEnvelope({ ...save, scenarioId: "wrong" })).toEqual({
      ok: false,
      reason: "m8_save_scenario_invalid",
    });
    expect(loadM8FactionEndgameSaveEnvelope({ ...save, formatVersion: 99 })).toEqual({
      ok: false,
      reason: "m8_save_version_invalid",
    });
    expect(loadM8FactionEndgameSaveEnvelope({ ...save, contentScopeHash: "0x00000001" })).toEqual({
      ok: false,
      reason: "m8_save_content_scope_mismatch",
    });

    const unsortedArcs = withArcRecords(save, [
      must(save.sections.ownerStores.factionArcRecords[1]),
      must(save.sections.ownerStores.factionArcRecords[0]),
      must(save.sections.ownerStores.factionArcRecords[2]),
      must(save.sections.ownerStores.factionArcRecords[3]),
      must(save.sections.ownerStores.factionArcRecords[4]),
      must(save.sections.ownerStores.factionArcRecords[5]),
    ]);
    expect(loadM8FactionEndgameSaveEnvelope(unsortedArcs)).toEqual({
      ok: false,
      reason: "m8_save_section_invalid",
    });

    expect(
      loadM8FactionEndgameSaveEnvelope(withRouteRecord(save, 0, { supportScore: -1 })),
    ).toEqual({
      ok: false,
      reason: "m8_save_section_invalid",
    });

    const commandTamper = {
      ...save,
      sections: {
        ...save.sections,
        commandLogTail: {
          ...save.sections.commandLogTail,
          commandStreamHash: "0x00000001",
        },
      },
    };
    expect(loadM8FactionEndgameSaveEnvelope(commandTamper)).toEqual({
      ok: false,
      reason: "m8_save_integrity_mismatch",
    });

    expect(
      loadM8FactionEndgameSaveEnvelope({
        ...save,
        readOnlyProjection: {
          ...save.readOnlyProjection,
          readModelHash: "0x00000001",
        },
      }),
    ).toEqual({ ok: false, reason: "m8_save_projection_invalid" });
  });

  it("names the first divergent M8 replay tick", () => {
    const expected = runM8FactionEndgameReplay({
      seed: "123",
      checkpointTicks: M8_REPLAY_CHECKPOINT_SEQUENCE,
    });
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;

    const diverged: M8ReplayCheckpoint[] = [];
    for (const checkpoint of expected.replay.checkpoints) {
      if (checkpoint.tick === M8_SAVE_TICK) {
        diverged.push({ ...checkpoint, worldHash: "0x00000001" });
      } else {
        diverged.push(checkpoint);
      }
    }

    expect(
      compareM8ReplayRuns(
        expected.replay,
        { ...expected.replay, checkpoints: diverged },
        {
          expected: "expected.json",
          actual: "actual.json",
          resumed: "resumed.json",
          save: "save.json",
          summary: "summary.json",
        },
      ),
    ).toMatchObject({
      ok: false,
      firstDivergentTick: M8_SAVE_TICK,
      reason: "world_hash_mismatch",
    });
  });

  it("uses deterministic M8 advance command ids", () => {
    const commandId = createM8AdvanceCommandId(M8_LOAD_TICK, 3);
    expect(commandId).toBe("m8.faction-endgame.advance.72001.3");
    expect(parseM8AdvanceCommandId(commandId)).toEqual({
      ok: true,
      tick: M8_LOAD_TICK,
      sequence: 3,
    });
    expect(parseM8AdvanceCommandId("m8.faction-endgame.advance.bad")).toEqual({ ok: false });
    expect(parseM8AdvanceCommandId("m8.faction-endgame.advance.72001.3junk")).toEqual({
      ok: false,
    });
    expect(parseM8AdvanceCommandId("m8.faction-endgame.advance.72001junk.3")).toEqual({
      ok: false,
    });
  });
});

function withArcRecords(
  save: M8SaveEnvelope,
  factionArcRecords: readonly M8FactionArcSaveRecord[],
): M8SaveEnvelope {
  return {
    ...save,
    sections: {
      ...save.sections,
      ownerStores: {
        ...save.sections.ownerStores,
        factionArcRecords,
      },
    },
  };
}

function withRouteRecord(
  save: M8SaveEnvelope,
  index: number,
  patch: Partial<M8RouteSaveRecord>,
): M8SaveEnvelope {
  const routeRecords: M8RouteSaveRecord[] = [];
  for (let rowIndex = 0; rowIndex < save.sections.ownerStores.routeRecords.length; rowIndex += 1) {
    const row = must(save.sections.ownerStores.routeRecords[rowIndex]);
    if (rowIndex === index) routeRecords.push({ ...row, ...patch });
    else routeRecords.push(row);
  }

  return {
    ...save,
    sections: {
      ...save.sections,
      ownerStores: {
        ...save.sections.ownerStores,
        routeRecords,
      },
    },
  };
}

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("test fixture row missing");
  return value;
}
