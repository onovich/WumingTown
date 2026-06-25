import { describe, expect, it } from "vitest";

import { M2_WORK_LOGISTICS_SCENARIO_ID } from "./m2-work-logistics-scenario";
import {
  compareM2ReplayRuns,
  createM2AdvanceCommandId,
  createM2WorkLogisticsSaveEnvelope,
  loadM2WorkLogisticsSaveEnvelope,
  parseM2AdvanceCommandId,
  resumeM2WorkLogisticsFromSave,
  runM2WorkLogisticsReplay,
  type M2ReplayArtifactPaths,
  type M2ReplayRun,
  type M2WorkLogisticsSaveEnvelope,
} from "./m2-save-replay";

describe("M2 work/logistics save replay harness", () => {
  it("resumes a validated save to the same final hash as uninterrupted replay", () => {
    const uninterrupted = readReplay(
      runM2WorkLogisticsReplay({ seed: "2", checkpointTicks: [6_000, 20_000] }),
    );
    const save = readSave(createM2WorkLogisticsSaveEnvelope("2", 6_000));
    const loaded = loadM2WorkLogisticsSaveEnvelope(save);

    expect(save.sections.entityStores.actorHandles).toHaveLength(20);
    expectRecordIds(save.sections.entityStores.buildOrders, [0, 1, 2, 3]);
    expectRecordIds(save.sections.jobsReservations.records, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(loaded).toMatchObject({
      ok: true,
      rebuiltIndexes: ["work-offers", "path-caches", "reservations", "read-models"],
    });

    const resumed = readReplay(
      resumeM2WorkLogisticsFromSave({
        save,
        finalTick: 20_000,
        checkpointTicks: [6_000, 20_000],
      }),
    );

    expect(resumed.finalTick).toBe(uninterrupted.finalTick);
    expect(resumed.finalWorldHash).toBe(uninterrupted.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(uninterrupted.finalReadModelHash);
    expect(resumed.checkpoints[resumed.checkpoints.length - 1]).toStrictEqual(
      uninterrupted.checkpoints[uninterrupted.checkpoints.length - 1],
    );
  });

  it("fails closed on malformed future unsorted or cross-scenario save envelopes", () => {
    const save = readSave(createM2WorkLogisticsSaveEnvelope("2", 6_000));
    const futureVersion = { ...save, formatVersion: 2 };
    const wrongScenario = { ...save, scenarioId: "m1.hauling_building.road_lantern_frame.v1" };
    const unsortedJobs = {
      ...save,
      sections: {
        ...save.sections,
        jobsReservations: {
          ...save.sections.jobsReservations,
          records: [
            save.sections.jobsReservations.records[1] ?? failMissingRecord(),
            save.sections.jobsReservations.records[0] ?? failMissingRecord(),
          ],
        },
      },
    };
    const invalidOwnerHandle = {
      ...save,
      sections: {
        ...save.sections,
        entityStores: {
          ...save.sections.entityStores,
          actorHandles: [{ index: 0, generation: 0 }],
        },
      },
    };
    const invalidIntegerLane = {
      ...save,
      sections: {
        ...save.sections,
        entityStores: {
          ...save.sections.entityStores,
          itemStacks: [
            {
              ...(save.sections.entityStores.itemStacks[0] ?? failMissingRecord()),
              quantity: -1,
            },
            save.sections.entityStores.itemStacks[1] ?? failMissingRecord(),
            save.sections.entityStores.itemStacks[2] ?? failMissingRecord(),
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

    expect(loadM2WorkLogisticsSaveEnvelope({})).toStrictEqual({
      ok: false,
      reason: "m2_save_magic_invalid",
    });
    expect(loadM2WorkLogisticsSaveEnvelope(futureVersion)).toStrictEqual({
      ok: false,
      reason: "m2_save_version_unsupported",
    });
    expect(loadM2WorkLogisticsSaveEnvelope(wrongScenario)).toStrictEqual({
      ok: false,
      reason: "m2_save_scenario_invalid",
    });
    expect(loadM2WorkLogisticsSaveEnvelope(unsortedJobs)).toStrictEqual({
      ok: false,
      reason: "m2_save_records_unsorted",
    });
    expect(loadM2WorkLogisticsSaveEnvelope(invalidOwnerHandle)).toStrictEqual({
      ok: false,
      reason: "m2_save_owner_handle_invalid",
    });
    expect(loadM2WorkLogisticsSaveEnvelope(invalidIntegerLane)).toStrictEqual({
      ok: false,
      reason: "m2_save_integer_lane_invalid",
    });
    expect(loadM2WorkLogisticsSaveEnvelope(mutatedProjection)).toStrictEqual({
      ok: false,
      reason: "m2_save_projection_invalid",
    });
    expect(loadM2WorkLogisticsSaveEnvelope(mutatedCommandLog)).toStrictEqual({
      ok: false,
      reason: "m2_save_section_invalid",
    });
  });

  it("keeps rebuilt read models isolated from authoritative resume state", () => {
    const save = readSave(createM2WorkLogisticsSaveEnvelope("2", 6_000));
    const loaded = loadM2WorkLogisticsSaveEnvelope(save);
    if (!loaded.ok) {
      throw new Error(loaded.reason);
    }

    const copiedProjection = {
      ...loaded.projection.orderReadModel,
      summaries: ["tampered outside authority"],
    };
    expect(copiedProjection.summaries).toStrictEqual(["tampered outside authority"]);

    const resumed = readReplay(
      resumeM2WorkLogisticsFromSave({
        save,
        finalTick: 20_000,
        checkpointTicks: [6_000, 20_000],
      }),
    );
    const expected = readReplay(
      runM2WorkLogisticsReplay({ seed: "2", checkpointTicks: [6_000, 20_000] }),
    );

    expect(resumed.finalWorldHash).toBe(expected.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(expected.finalReadModelHash);
  });

  it("reports first divergent tick and artifact paths for parity diagnostics", () => {
    const expected = readReplay(runM2WorkLogisticsReplay(baseReplayOptions()));
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
    const compared = compareM2ReplayRuns(expected, actual, artifactPaths());

    expect(compared).toStrictEqual({
      ok: false,
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      seed: "2",
      firstDivergentTick: 6_000,
      artifactPaths: artifactPaths(),
      reason: "read_model_hash_mismatch",
    });
  });

  it("uses deterministic advance command ids for Worker/headless parity streams", () => {
    const commandId = createM2AdvanceCommandId(20_000);
    expect(commandId).toBe("m2.work-logistics.advance.20000");
    expect(parseM2AdvanceCommandId(commandId)).toBe(20_000);
    expect(parseM2AdvanceCommandId("noop")).toBeUndefined();
  });
});

function baseReplayOptions(): {
  readonly seed: string;
  readonly checkpointTicks: readonly number[];
} {
  return { seed: "2", checkpointTicks: [0, 6_000, 20_000] };
}

function artifactPaths(): M2ReplayArtifactPaths {
  return {
    expected: "coordination/artifacts/WM-0040/m2-save-replay/expected.json",
    actual: "coordination/artifacts/WM-0040/m2-save-replay/actual.json",
    resumed: "coordination/artifacts/WM-0040/m2-save-replay/resumed.json",
    save: "coordination/artifacts/WM-0040/m2-save-replay/save.json",
    summary: "coordination/artifacts/WM-0040/m2-save-replay/summary.json",
  };
}

function readReplay(result: ReturnType<typeof runM2WorkLogisticsReplay>): M2ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readSave(
  result: ReturnType<typeof createM2WorkLogisticsSaveEnvelope>,
): M2WorkLogisticsSaveEnvelope {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function failMissingCheckpoint(): never {
  throw new Error("missing checkpoint");
}

function failMissingRecord(): never {
  throw new Error("missing record");
}

function expectRecordIds(
  records: readonly { readonly orderId?: number; readonly jobId?: number }[],
  expectedIds: readonly number[],
): void {
  expect(records).toHaveLength(expectedIds.length);

  for (let index = 0; index < expectedIds.length; index += 1) {
    const record = records[index] ?? failMissingRecord();
    const id = record.orderId ?? record.jobId;
    expect(id).toBe(expectedIds[index]);
  }
}
