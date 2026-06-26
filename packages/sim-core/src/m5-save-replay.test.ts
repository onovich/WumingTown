import { describe, expect, it } from "vitest";

import {
  M5_FINAL_TICK,
  M5_LOAD_TICK,
  M5_REBUILT_SURFACE_NAMES,
  M5_REPLAY_CHECKPOINT_SEQUENCE,
  M5_SAVE_TICK,
  compareM5ReplayRuns,
  createM5AdvanceCommandId,
  createM5AlphaContentSaveEnvelope,
  loadM5AlphaContentSaveEnvelope,
  parseM5AdvanceCommandId,
  resumeM5AlphaContentFromSave,
  runM5AlphaContentReplay,
  type M5AnomalySaveRecord,
  type M5ReplayCheckpoint,
  type M5SaveEnvelope,
  type M5SeasonSaveRecord,
} from "./index";

describe("M5 alpha content focused save replay", () => {
  it("resumes from a checkpoint with matching uninterrupted hashes", () => {
    const expected = runM5AlphaContentReplay({
      seed: "5",
      checkpointTicks: M5_REPLAY_CHECKPOINT_SEQUENCE,
    });
    const save = createM5AlphaContentSaveEnvelope("5", M5_SAVE_TICK);
    const resumed = resumeM5AlphaContentFromSave({
      save,
      loadTick: M5_LOAD_TICK,
      finalTick: M5_FINAL_TICK,
      checkpointTicks: M5_REPLAY_CHECKPOINT_SEQUENCE,
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

    const expectedResumeCheckpoints: M5ReplayCheckpoint[] = [];
    for (const checkpoint of expected.replay.checkpoints) {
      if (checkpoint.tick >= M5_SAVE_TICK) {
        expectedResumeCheckpoints.push(checkpoint);
      }
    }
    expect(resumed.replay.checkpoints).toEqual(expectedResumeCheckpoints);
  });

  it("validates envelope identity content manifest versions and integer lanes", () => {
    const save = createM5AlphaContentSaveEnvelope("5", M5_SAVE_TICK);

    expect(loadM5AlphaContentSaveEnvelope({ ...save, scenarioId: "wrong" })).toEqual({
      ok: false,
      reason: "m5_save_scenario_invalid",
    });
    expect(loadM5AlphaContentSaveEnvelope({ ...save, seed: "999" })).toEqual({
      ok: false,
      reason: "m5_save_seed_mismatch",
    });
    expect(loadM5AlphaContentSaveEnvelope({ ...save, formatVersion: 99 })).toEqual({
      ok: false,
      reason: "m5_save_version_invalid",
    });
    expect(loadM5AlphaContentSaveEnvelope({ ...save, contentManifestHash: "0x00000001" })).toEqual({
      ok: false,
      reason: "m5_save_content_manifest_mismatch",
    });

    const zeroVersion = withAnomalyRecord(save, 1, { ownerVersion: 0 });
    expect(loadM5AlphaContentSaveEnvelope(zeroVersion)).toEqual({
      ok: false,
      reason: "m5_save_section_invalid",
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
            must(save.sections.ownerStores.ownerHandles[4]),
            must(save.sections.ownerStores.ownerHandles[5]),
            must(save.sections.ownerStores.ownerHandles[6]),
          ],
        },
      },
    };
    expect(loadM5AlphaContentSaveEnvelope(unsortedHandles)).toEqual({
      ok: false,
      reason: "m5_save_section_invalid",
    });
  });

  it("rejects command random stream season and projection tampering in scratch load", () => {
    const save = createM5AlphaContentSaveEnvelope("5", M5_SAVE_TICK);

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
    expect(loadM5AlphaContentSaveEnvelope(commandTamper)).toEqual({
      ok: false,
      reason: "m5_save_integrity_mismatch",
    });

    const streamTamper = {
      ...save,
      sections: {
        ...save.sections,
        randomStreams: {
          ...save.sections.randomStreams,
          streamPositions: [
            {
              ...must(save.sections.randomStreams.streamPositions[0]),
              drawCount: -1,
            },
          ],
        },
      },
    };
    expect(loadM5AlphaContentSaveEnvelope(streamTamper)).toEqual({
      ok: false,
      reason: "m5_save_section_invalid",
    });

    const seasonTamper = withSeasonRecord(save, 0, { totalCandidateVisits: -1 });
    expect(loadM5AlphaContentSaveEnvelope(seasonTamper)).toEqual({
      ok: false,
      reason: "m5_save_section_invalid",
    });

    const projectionTamper = {
      ...save,
      readOnlyProjection: {
        ...save.readOnlyProjection,
        readModelHash: "0x00000001",
      },
    };
    expect(loadM5AlphaContentSaveEnvelope(projectionTamper)).toEqual({
      ok: false,
      reason: "m5_save_projection_invalid",
    });
  });

  it("reports rebuilt M5 surfaces and save-shaped owner rows before resumed ticks", () => {
    const save = createM5AlphaContentSaveEnvelope("5", M5_SAVE_TICK);
    const loaded = loadM5AlphaContentSaveEnvelope(save);

    expect(save.contentManifestHash).toBe("0xe55d3015");
    expect(save.commandStreamHash).toBe("0x81d37435");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }

    expect(loaded.loadTick).toBe(M5_LOAD_TICK);
    expect(loaded.validationTimeTicks).toBe(2);
    expect(loaded.rebuildTimeTicks).toBe(2);
    expect(loaded.rebuiltSurfaceNames).toEqual(M5_REBUILT_SURFACE_NAMES);
    expect(loaded.projection.rebuiltIndexes.names).toEqual(M5_REBUILT_SURFACE_NAMES);
    expect(loaded.projection.rebuiltIndexes.surfaces).toHaveLength(M5_REBUILT_SURFACE_NAMES.length);
    expect(save.sections.ownerStores.ownerHandles).toHaveLength(7);
    expect(save.sections.ownerStores.anomalyRecords).toHaveLength(3);
    expect(save.sections.randomStreams.streamPositions).toMatchObject([
      {
        streamName: "m5-alpha-season-events",
      },
    ]);
    expect(save.sections.commandLogTail.commandTail).toHaveLength(6);

    let previousRowId = -1;
    for (const row of save.sections.reasonMetrics.reviewRows) {
      expect(row.rowId).toBeGreaterThan(previousRowId);
      previousRowId = row.rowId;
    }
  });

  it("names the first divergent replay tick", () => {
    const expected = runM5AlphaContentReplay({
      seed: "5",
      checkpointTicks: M5_REPLAY_CHECKPOINT_SEQUENCE,
    });
    expect(expected.ok).toBe(true);
    if (!expected.ok) {
      return;
    }

    const diverged: M5ReplayCheckpoint[] = [];
    for (const checkpoint of expected.replay.checkpoints) {
      if (checkpoint.tick === M5_SAVE_TICK) {
        diverged.push({ ...checkpoint, worldHash: "0x00000001" });
      } else {
        diverged.push(checkpoint);
      }
    }
    const comparison = compareM5ReplayRuns(
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
      firstDivergentTick: M5_SAVE_TICK,
      reason: "world_hash_mismatch",
    });
  });

  it("uses deterministic advance command ids", () => {
    const commandId = createM5AdvanceCommandId(M5_LOAD_TICK, 15);
    expect(commandId).toBe("m5.alpha-content-framework.advance.12001.15");
    expect(parseM5AdvanceCommandId(commandId)).toEqual({
      ok: true,
      tick: M5_LOAD_TICK,
      sequence: 15,
    });
    expect(parseM5AdvanceCommandId("m5.alpha-content-framework.advance.bad")).toEqual({
      ok: false,
    });
  });
});

function withAnomalyRecord(
  save: M5SaveEnvelope,
  index: number,
  patch: Partial<M5AnomalySaveRecord>,
): M5SaveEnvelope {
  const anomalyRecords: M5AnomalySaveRecord[] = [];
  for (
    let rowIndex = 0;
    rowIndex < save.sections.ownerStores.anomalyRecords.length;
    rowIndex += 1
  ) {
    const row = must(save.sections.ownerStores.anomalyRecords[rowIndex]);
    if (rowIndex === index) {
      anomalyRecords.push({ ...row, ...patch });
    } else {
      anomalyRecords.push(row);
    }
  }

  return {
    ...save,
    sections: {
      ...save.sections,
      ownerStores: {
        ...save.sections.ownerStores,
        anomalyRecords,
      },
    },
  };
}

function withSeasonRecord(
  save: M5SaveEnvelope,
  index: number,
  patch: Partial<M5SeasonSaveRecord>,
): M5SaveEnvelope {
  const seasonRecords: M5SeasonSaveRecord[] = [];
  for (let rowIndex = 0; rowIndex < save.sections.ownerStores.seasonRecords.length; rowIndex += 1) {
    const row = must(save.sections.ownerStores.seasonRecords[rowIndex]);
    if (rowIndex === index) {
      seasonRecords.push({ ...row, ...patch });
    } else {
      seasonRecords.push(row);
    }
  }

  return {
    ...save,
    sections: {
      ...save.sections,
      ownerStores: {
        ...save.sections.ownerStores,
        seasonRecords,
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
