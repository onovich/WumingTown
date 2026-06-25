import { describe, expect, it } from "vitest";

import { M3_ORDINARY_LIFE_SCENARIO_ID } from "./m3-ordinary-life-scenario";
import {
  M3_FINAL_TICK,
  M3_LOAD_TICK,
  M3_SAVE_TICK,
  compareM3ReplayRuns,
  createM3AdvanceCommandId,
  createM3OrdinaryLifeSaveEnvelope,
  loadM3OrdinaryLifeSaveEnvelope,
  parseM3AdvanceCommandId,
  resumeM3OrdinaryLifeFromSave,
  runM3OrdinaryLifeReplay,
  type M3OrdinaryLifeSaveEnvelope,
  type M3ReplayArtifactPaths,
  type M3ReplayCheckpoint,
  type M3ReplayRun,
} from "./m3-save-replay";

describe("M3 ordinary-life save replay harness", () => {
  it("resumes the 12000 tick checkpoint at 12001 to the same full-day hash", () => {
    const uninterrupted = readReplay(
      runM3OrdinaryLifeReplay({
        seed: "3",
        checkpointTicks: [0, 3_600, 7_200, M3_SAVE_TICK, 18_000, M3_FINAL_TICK],
      }),
    );
    const expectedResume = filterReplayCheckpoints(uninterrupted, [
      M3_SAVE_TICK,
      18_000,
      M3_FINAL_TICK,
    ]);
    const save = readSave(createM3OrdinaryLifeSaveEnvelope("3", M3_SAVE_TICK));
    const loaded = loadM3OrdinaryLifeSaveEnvelope(save);

    expect(save.createdTick).toBe(12_000);
    expect(save.sections.commandLogTail.checkpointTick).toBe(12_000);
    expect(save.sections.ownerStores.actorHandles).toHaveLength(6);
    expectRecordIds(save.sections.ownerStores.needRecords, [0, 1, 2, 3, 4, 5], "actorId");
    expectRecordIds(save.sections.ownerStores.conditionRecords, [0], "conditionId");
    expectRecordIds(save.sections.ownerStores.itemStackRecords, [0, 3], "stackId");
    expectRecordIds(save.sections.jobsReservations.treatmentJobRecords, [0], "jobId");
    expect(loaded).toMatchObject({
      ok: true,
      loadTick: M3_LOAD_TICK,
      rebuiltIndexes: [
        "needs",
        "work-offers",
        "reservations",
        "path-caches",
        "ability-cache",
        "mood-read-models",
        "social-read-models",
        "food-indexes",
        "rest-indexes",
        "medical-indexes",
        "weather-projections",
        "schedule-projections",
        "reason-materialization",
        "metric-materialization",
        "read-models",
      ],
    });

    const resumed = readReplay(
      resumeM3OrdinaryLifeFromSave({
        save,
        loadTick: M3_LOAD_TICK,
        finalTick: M3_FINAL_TICK,
        checkpointTicks: [M3_SAVE_TICK, 18_000, M3_FINAL_TICK],
      }),
    );

    expect(resumed.finalTick).toBe(uninterrupted.finalTick);
    expect(resumed.finalWorldHash).toBe(uninterrupted.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(uninterrupted.finalReadModelHash);
    expect(resumed.finalReadModelHash).toBe(expectedResume.finalReadModelHash);
    expect(resumed.source).toBe("loaded-save");
    expect(resumed.loadedStateHash).toMatch(/^0x[0-9a-f]{8}$/u);
    expect(resumed.checkpoints).toStrictEqual(expectedResume.checkpoints);
    expect(resumed.checkpoints[resumed.checkpoints.length - 1]?.worldHash).toBe(
      uninterrupted.checkpoints[uninterrupted.checkpoints.length - 1]?.worldHash,
    );
  });

  it("rejects coherent loaded metric tampering instead of replaying from seed", () => {
    const save = readSave(createM3OrdinaryLifeSaveEnvelope("3", M3_SAVE_TICK));
    const uninterrupted = readReplay(
      runM3OrdinaryLifeReplay({
        seed: "3",
        checkpointTicks: [0, 3_600, 7_200, M3_SAVE_TICK, M3_FINAL_TICK],
      }),
    );
    const expectedResume = filterReplayCheckpoints(uninterrupted, [M3_SAVE_TICK, M3_FINAL_TICK]);
    const tampered = {
      ...save,
      sections: {
        ...save.sections,
        reasonMetrics: {
          ...save.sections.reasonMetrics,
          queueMetrics: {
            ...save.sections.reasonMetrics.queueMetrics,
            needDirtyBacklogPeak: save.sections.reasonMetrics.queueMetrics.needDirtyBacklogPeak + 1,
          },
        },
      },
    };

    expect(loadM3OrdinaryLifeSaveEnvelope(tampered)).toMatchObject({ ok: true });
    expect(
      resumeM3OrdinaryLifeFromSave({
        save: tampered,
        loadTick: M3_LOAD_TICK,
        finalTick: M3_FINAL_TICK,
        checkpointTicks: [M3_SAVE_TICK, M3_FINAL_TICK],
      }),
    ).toStrictEqual({ ok: false, reason: "m3_save_section_invalid" });

    const seedReplay = readReplay(
      runM3OrdinaryLifeReplay({
        seed: "3",
        checkpointTicks: [0, 3_600, 7_200, M3_SAVE_TICK, M3_FINAL_TICK],
      }),
    );
    expect(seedReplay.finalReadModelHash).toBe(expectedResume.finalReadModelHash);
  });

  it("fails closed on malformed future unsorted cross-scenario and stale saves", () => {
    const save = readSave(createM3OrdinaryLifeSaveEnvelope("3", M3_SAVE_TICK));
    const futureVersion = { ...save, formatVersion: 2 };
    const wrongScenario = { ...save, scenarioId: "m2.work_logistics.lantern_yard.v1" };
    const invalidOwnerHandle = {
      ...save,
      sections: {
        ...save.sections,
        ownerStores: {
          ...save.sections.ownerStores,
          actorHandles: [{ index: 0, generation: 0 }],
        },
      },
    };
    const invalidIntegerLane = {
      ...save,
      sections: {
        ...save.sections,
        ownerStores: {
          ...save.sections.ownerStores,
          needRecords: [
            {
              ...(save.sections.ownerStores.needRecords[0] ?? failMissingRecord()),
              hunger: -1,
            },
            save.sections.ownerStores.needRecords[1] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[2] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[3] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[4] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[5] ?? failMissingRecord(),
          ],
        },
      },
    };
    const unsortedNeeds = {
      ...save,
      sections: {
        ...save.sections,
        ownerStores: {
          ...save.sections.ownerStores,
          needRecords: [
            save.sections.ownerStores.needRecords[1] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[0] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[2] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[3] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[4] ?? failMissingRecord(),
            save.sections.ownerStores.needRecords[5] ?? failMissingRecord(),
          ],
        },
      },
    };
    const mutatedProjection = {
      ...save,
      readOnlyProjection: {
        ...save.readOnlyProjection,
        worldHash: "0x00000000",
      },
    };
    const mutatedCommandLog = {
      ...save,
      sections: {
        ...save.sections,
        commandLogTail: {
          ...save.sections.commandLogTail,
          checkpointWorldHash: "0x00000000",
        },
      },
    };

    expect(loadM3OrdinaryLifeSaveEnvelope({})).toStrictEqual({
      ok: false,
      reason: "m3_save_magic_invalid",
    });
    expect(loadM3OrdinaryLifeSaveEnvelope(futureVersion)).toStrictEqual({
      ok: false,
      reason: "m3_save_version_unsupported",
    });
    expect(loadM3OrdinaryLifeSaveEnvelope(wrongScenario)).toStrictEqual({
      ok: false,
      reason: "m3_save_scenario_invalid",
    });
    expect(loadM3OrdinaryLifeSaveEnvelope(invalidOwnerHandle)).toStrictEqual({
      ok: false,
      reason: "m3_save_owner_handle_invalid",
    });
    expect(loadM3OrdinaryLifeSaveEnvelope(invalidIntegerLane)).toStrictEqual({
      ok: false,
      reason: "m3_save_integer_lane_invalid",
    });
    expect(loadM3OrdinaryLifeSaveEnvelope(unsortedNeeds)).toStrictEqual({
      ok: false,
      reason: "m3_save_records_unsorted",
    });
    expect(loadM3OrdinaryLifeSaveEnvelope(mutatedProjection)).toStrictEqual({
      ok: false,
      reason: "m3_save_projection_invalid",
    });
    expect(loadM3OrdinaryLifeSaveEnvelope(mutatedCommandLog)).toStrictEqual({
      ok: false,
      reason: "m3_save_section_invalid",
    });
    expect(
      resumeM3OrdinaryLifeFromSave({
        save,
        loadTick: M3_SAVE_TICK,
        finalTick: M3_FINAL_TICK,
        checkpointTicks: [M3_SAVE_TICK, M3_FINAL_TICK],
      }),
    ).toStrictEqual({ ok: false, reason: "m3_load_tick_invalid" });
  });

  it("keeps rebuilt read models and surface hashes isolated from authoritative resume state", () => {
    const save = readSave(createM3OrdinaryLifeSaveEnvelope("3", M3_SAVE_TICK));
    const loaded = loadM3OrdinaryLifeSaveEnvelope(save);
    if (!loaded.ok) {
      throw new Error(loaded.reason);
    }

    const copiedProjection = {
      ...loaded.projection.scenarioReadModel,
      summaries: ["tampered outside authority"],
    };
    const copiedSurface = {
      ...(loaded.rebuiltSurfaces[0] ?? failMissingRecord()),
      hash: "0x00000000",
    };
    expect(copiedProjection.summaries).toStrictEqual(["tampered outside authority"]);
    expect(copiedSurface.hash).toBe("0x00000000");

    const resumed = readReplay(
      resumeM3OrdinaryLifeFromSave({
        save,
        loadTick: M3_LOAD_TICK,
        finalTick: M3_FINAL_TICK,
        checkpointTicks: [M3_SAVE_TICK, M3_FINAL_TICK],
      }),
    );
    const expected = readReplay(
      runM3OrdinaryLifeReplay({
        seed: "3",
        checkpointTicks: [0, 3_600, 7_200, M3_SAVE_TICK, M3_FINAL_TICK],
      }),
    );
    const expectedResume = filterReplayCheckpoints(expected, [M3_SAVE_TICK, M3_FINAL_TICK]);

    expect(resumed.finalWorldHash).toBe(expectedResume.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(expectedResume.finalReadModelHash);
    expect(resumed.source).toBe("loaded-save");
  });

  it("reports first divergent tick and artifact paths for M3 diagnostics", () => {
    const expected = readReplay(runM3OrdinaryLifeReplay(baseReplayOptions()));
    const actual = {
      ...expected,
      checkpoints: [
        expected.checkpoints[0] ?? failMissingCheckpoint(),
        {
          ...(expected.checkpoints[1] ?? failMissingCheckpoint()),
          readModelHash: "0x00000000",
        },
        expected.checkpoints[2] ?? failMissingCheckpoint(),
      ],
    };
    const compared = compareM3ReplayRuns(expected, actual, artifactPaths());

    expect(compared).toStrictEqual({
      ok: false,
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      seed: "46",
      firstDivergentTick: M3_SAVE_TICK,
      artifactPaths: artifactPaths(),
      reason: "read_model_hash_mismatch",
    });
  });

  it("uses deterministic advance command ids for future parity command streams", () => {
    const commandId = createM3AdvanceCommandId(M3_FINAL_TICK);
    expect(commandId).toBe("m3.ordinary-life.advance.36000");
    expect(parseM3AdvanceCommandId(commandId)).toBe(M3_FINAL_TICK);
    expect(parseM3AdvanceCommandId("noop")).toBeUndefined();
  });
});

function baseReplayOptions(): {
  readonly seed: string;
  readonly checkpointTicks: readonly number[];
} {
  return { seed: "3", checkpointTicks: [0, M3_SAVE_TICK, M3_FINAL_TICK] };
}

function artifactPaths(): M3ReplayArtifactPaths {
  return {
    expected: "coordination/artifacts/WM-0057/m3-save-replay/expected.json",
    actual: "coordination/artifacts/WM-0057/m3-save-replay/actual.json",
    resumed: "coordination/artifacts/WM-0057/m3-save-replay/resumed.json",
    save: "coordination/artifacts/WM-0057/m3-save-replay/save.json",
    summary: "coordination/artifacts/WM-0057/m3-save-replay/summary.json",
  };
}

function readReplay(result: ReturnType<typeof runM3OrdinaryLifeReplay>): M3ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readSave(
  result: ReturnType<typeof createM3OrdinaryLifeSaveEnvelope>,
): M3OrdinaryLifeSaveEnvelope {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function filterReplayCheckpoints(
  replay: M3ReplayRun,
  checkpointTicks: readonly number[],
): M3ReplayRun {
  const checkpoints: M3ReplayCheckpoint[] = [];
  for (const checkpoint of replay.checkpoints) {
    if (checkpointTicks.includes(checkpoint.tick)) {
      checkpoints.push(checkpoint);
    }
  }

  const finalCheckpoint = checkpoints[checkpoints.length - 1] ?? failMissingCheckpoint();
  return {
    ...replay,
    checkpoints,
    finalTick: finalCheckpoint.tick,
    finalWorldHash: finalCheckpoint.worldHash,
    finalReadModelHash: finalCheckpoint.readModelHash,
  };
}

function failMissingCheckpoint(): never {
  throw new Error("missing checkpoint");
}

function failMissingRecord(): never {
  throw new Error("missing record");
}

function expectRecordIds<T extends string>(
  records: readonly Record<T, number>[],
  expectedIds: readonly number[],
  key: T,
): void {
  expect(records).toHaveLength(expectedIds.length);

  for (let index = 0; index < expectedIds.length; index += 1) {
    const record = records[index] ?? failMissingRecord();
    expect(record[key]).toBe(expectedIds[index]);
  }
}
