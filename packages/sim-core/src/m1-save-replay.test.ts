import { describe, expect, it } from "vitest";

import {
  HAULING_BUILDING_SCENARIO_ID,
  compareM1ReplayRuns,
  createM1AdvanceCommandId,
  createM1HaulingBuildingSaveEnvelope,
  loadM1HaulingBuildingSaveEnvelope,
  parseM1AdvanceCommandId,
  resumeM1HaulingBuildingFromSave,
  runM1HaulingBuildingReplay,
  type M1HaulingBuildingSaveEnvelope,
  type M1ReplayArtifactPaths,
  type M1ReplayRun,
} from "./index";

describe("M1 hauling-building save replay harness", () => {
  it("resumes a validated save to the same final hash as uninterrupted replay", () => {
    const uninterrupted = readReplay(runM1HaulingBuildingReplay(baseReplayOptions()));
    const save = readSave(createM1HaulingBuildingSaveEnvelope("1", 2_400));
    const loaded = loadM1HaulingBuildingSaveEnvelope(save);

    expect(loaded).toMatchObject({
      ok: true,
      rebuiltIndexes: ["work-offers", "reservations", "read-model"],
    });

    const resumed = readReplay(
      resumeM1HaulingBuildingFromSave({
        save,
        finalTick: 100_000,
        checkpointTicks: [2_400, 50_000, 100_000],
      }),
    );

    expect(resumed.finalTick).toBe(uninterrupted.finalTick);
    expect(resumed.finalWorldHash).toBe(uninterrupted.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(uninterrupted.finalReadModelHash);
    expect(resumed.checkpoints[resumed.checkpoints.length - 1]).toStrictEqual(
      uninterrupted.checkpoints[uninterrupted.checkpoints.length - 1],
    );
  });

  it("fails closed on malformed or future save envelopes", () => {
    const save = readSave(createM1HaulingBuildingSaveEnvelope("1", 2_400));
    const futureVersion = { ...save, formatVersion: 2 };
    const mutatedProjection = {
      ...save,
      readOnlyProjection: {
        ...save.readOnlyProjection,
        worldHash: "0x00000000",
      },
    };
    const mutatedSection = {
      ...save,
      sections: {
        ...save.sections,
        commandLogTail: {
          ...save.sections.commandLogTail,
          checkpointWorldHash: "0x00000000",
        },
      },
    };

    expect(loadM1HaulingBuildingSaveEnvelope({})).toStrictEqual({
      ok: false,
      reason: "m1_save_magic_invalid",
    });
    expect(loadM1HaulingBuildingSaveEnvelope(futureVersion)).toStrictEqual({
      ok: false,
      reason: "m1_save_version_unsupported",
    });
    expect(loadM1HaulingBuildingSaveEnvelope(mutatedProjection)).toStrictEqual({
      ok: false,
      reason: "m1_save_projection_invalid",
    });
    expect(loadM1HaulingBuildingSaveEnvelope(mutatedSection)).toStrictEqual({
      ok: false,
      reason: "m1_save_section_invalid",
    });
  });

  it("keeps read-only projections isolated from authoritative resume state", () => {
    const save = readSave(createM1HaulingBuildingSaveEnvelope("1", 2_400));
    const loaded = loadM1HaulingBuildingSaveEnvelope(save);
    if (!loaded.ok) {
      throw new Error(loaded.reason);
    }

    const copiedUiProjection = {
      ...loaded.projection.uiDetail,
      summaries: ["tampered outside authority"],
    };
    expect(copiedUiProjection.summaries).toStrictEqual(["tampered outside authority"]);

    const resumed = readReplay(
      resumeM1HaulingBuildingFromSave({
        save,
        finalTick: 100_000,
        checkpointTicks: [2_400, 100_000],
      }),
    );
    const expected = readReplay(
      runM1HaulingBuildingReplay({ seed: "1", checkpointTicks: [2_400, 100_000] }),
    );

    expect(resumed.finalWorldHash).toBe(expected.finalWorldHash);
    expect(resumed.finalReadModelHash).toBe(expected.finalReadModelHash);
  });

  it("reports first divergent tick and artifact paths for parity diagnostics", () => {
    const expected = readReplay(runM1HaulingBuildingReplay(baseReplayOptions()));
    const actual = {
      ...expected,
      checkpoints: [
        expected.checkpoints[0] ?? failMissingCheckpoint(),
        {
          ...(expected.checkpoints[1] ?? failMissingCheckpoint()),
          worldHash: "0x00000000",
        },
        expected.checkpoints[2] ?? failMissingCheckpoint(),
      ],
    };
    const compared = compareM1ReplayRuns(expected, actual, artifactPaths());

    expect(compared).toStrictEqual({
      ok: false,
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      seed: "1",
      firstDivergentTick: 2_400,
      artifactPaths: artifactPaths(),
      reason: "world_hash_mismatch",
    });
  });

  it("uses deterministic advance command ids for Worker/headless parity streams", () => {
    const commandId = createM1AdvanceCommandId(100_000);
    expect(commandId).toBe("m1.hauling-building.advance.100000");
    expect(parseM1AdvanceCommandId(commandId)).toBe(100_000);
    expect(parseM1AdvanceCommandId("noop")).toBeUndefined();
  });
});

function baseReplayOptions(): {
  readonly seed: string;
  readonly checkpointTicks: readonly number[];
} {
  return { seed: "1", checkpointTicks: [0, 2_400, 100_000] };
}

function artifactPaths(): M1ReplayArtifactPaths {
  return {
    expected: "coordination/artifacts/WM-0028/m1/expected.json",
    actual: "coordination/artifacts/WM-0028/m1/actual.json",
    resumed: "coordination/artifacts/WM-0028/m1/resumed.json",
    save: "coordination/artifacts/WM-0028/m1/save.json",
    summary: "coordination/artifacts/WM-0028/m1/summary.json",
  };
}

function readReplay(result: ReturnType<typeof runM1HaulingBuildingReplay>): M1ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readSave(
  result: ReturnType<typeof createM1HaulingBuildingSaveEnvelope>,
): M1HaulingBuildingSaveEnvelope {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function failMissingCheckpoint(): never {
  throw new Error("missing checkpoint");
}
