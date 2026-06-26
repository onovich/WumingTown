import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import {
  advanceHeadlessTicks,
  compareM1ReplayRuns,
  compareM2ReplayRuns,
  compareM3ReplayRuns,
  compareM4ReplayRuns,
  compareReplayCheckpoints,
  createM1HaulingBuildingSaveEnvelope,
  createHeadlessReplayCheckpoint,
  createHeadlessRunner,
  createM2WorkLogisticsSaveEnvelope,
  createM3OrdinaryLifeSaveEnvelope,
  createM4CoreVerticalSliceSaveEnvelope,
  M3_FINAL_TICK,
  M3_LOAD_TICK,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M3_SAVE_TICK,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  M4_FINAL_TICK,
  M4_LOAD_TICK,
  M4_REPLAY_CHECKPOINT_SEQUENCE,
  M4_SAVE_TICK,
  M2_WORK_LOGISTICS_SCENARIO_ID,
  queueHeadlessCommand,
  loadM4CoreVerticalSliceSaveEnvelope,
  resumeM1HaulingBuildingFromSave,
  resumeM2WorkLogisticsFromSave,
  resumeM3OrdinaryLifeFromSave,
  resumeM4CoreVerticalSliceFromSave,
  runM1HaulingBuildingReplay,
  runM2WorkLogisticsReplay,
  runM3OrdinaryLifeReplay,
  runM4CoreVerticalSliceReplay,
  summarizeHeadlessRun,
} from "../packages/sim-core/src/index.ts";

const M1_SCENARIO_ID = "m1.hauling_building.road_lantern_frame.v1";
const M2_SCENARIO_FILTER = "m2-work-logistics";
const M3_SCENARIO_FILTER = "m3-ordinary-life";
const M4_SCENARIO_FILTER = "m4-core-vertical-slice";

const DEFAULT_SEED = "WM-0010-long-run";
const DEFAULT_M2_SEED = "2";
const DEFAULT_M3_SEED = "3";
const DEFAULT_M4_SEED = "4";
const DEFAULT_SEGMENT_TICKS = 5_000;
const DEFAULT_SEGMENT_COUNT = 24;

export function runReplayDiagnostics(options = {}) {
  if (options.scenario === M2_SCENARIO_FILTER) {
    return runM2ReplayDiagnostics(options);
  }

  if (options.scenario === M3_SCENARIO_FILTER) {
    return runM3ReplayDiagnostics(options);
  }

  if (options.scenario === M4_SCENARIO_FILTER) {
    return runM4ReplayDiagnostics(options);
  }

  if (options.scenario !== undefined && options.scenario !== "all") {
    const artifactPaths = createArtifactPaths(options.artifactRoot);
    mkdirSync(path.dirname(artifactPaths.summary), { recursive: true });
    return createReplayFailure(
      "unsupported_scenario",
      `Unsupported replay diagnostics scenario: ${options.scenario}`,
      {
        seed: options.seed ?? DEFAULT_SEED,
        firstDivergentTick: null,
        artifactPaths,
      },
      {
        scenarioId: options.scenario,
      },
    );
  }

  const seed = options.seed ?? DEFAULT_SEED;
  const segmentTicks = options.segmentTicks ?? DEFAULT_SEGMENT_TICKS;
  const segmentCount = options.segmentCount ?? DEFAULT_SEGMENT_COUNT;
  const artifactPaths = createArtifactPaths(options.artifactRoot);
  const failureContext = {
    seed,
    firstDivergentTick: null,
    artifactPaths,
  };

  mkdirSync(path.dirname(artifactPaths.summary), { recursive: true });

  try {
    const buildReplay = options.buildReplay ?? defaultBuildReplay;
    const cloneCheckpoints = options.cloneCheckpoints ?? defaultCloneCheckpoints;
    const compareCheckpoints = options.compareCheckpoints ?? compareReplayCheckpoints;
    const expected = buildReplay(seed, { segmentTicks, segmentCount });
    writeJson(artifactPaths.expected, expected);

    const cleanActual = buildReplay(seed, { segmentTicks, segmentCount });
    writeJson(artifactPaths.actual, cleanActual);

    const cleanComparison = compareCheckpoints(expected, cleanActual);

    if (!cleanComparison.ok) {
      return createReplayFailure(
        "clean_divergence",
        "Deterministic replay diverged unexpectedly.",
        failureContext,
        {
          firstDivergentTick:
            cleanComparison.divergence.actualTick ??
            cleanComparison.divergence.expectedTick ??
            null,
          divergence: cleanComparison.divergence,
        },
      );
    }

    const perturbed = cloneCheckpoints(cleanActual);
    const target = perturbed[2];

    if (target === undefined) {
      return createReplayFailure(
        "probe_setup_failure",
        "Replay probe did not create the required perturbation checkpoint.",
        failureContext,
      );
    }

    perturbed[2] = {
      tick: target.tick,
      worldHash: "0x00000000",
      commandHash: target.commandHash,
    };
    writeJson(artifactPaths.perturbed, perturbed);

    const perturbedComparison = compareCheckpoints(expected, perturbed);

    if (perturbedComparison.ok) {
      return createReplayFailure(
        "perturbed_not_detected",
        "Perturbed replay was not detected.",
        failureContext,
      );
    }

    const divergence = perturbedComparison.divergence;
    const firstDivergentTick = divergence.actualTick ?? divergence.expectedTick ?? null;

    if (
      divergence.checkpointIndex !== 2 ||
      divergence.reason !== "world_hash_mismatch" ||
      divergence.actualTick !== 10_000
    ) {
      return createReplayFailure(
        "perturbed_wrong_divergence",
        "Perturbed replay reported the wrong first divergence.",
        failureContext,
        {
          firstDivergentTick,
          divergence,
        },
      );
    }

    const m1Scenario = runM1ReplayDiagnostics(seed, artifactPaths.m1);

    if (!m1Scenario.ok) {
      return createReplayFailure(
        "m1_hauling_building_divergence",
        "M1 hauling-building save/replay diagnostics diverged.",
        failureContext,
        {
          scenarioId: M1_SCENARIO_ID,
          firstDivergentTick: m1Scenario.firstDivergentTick,
          divergence: m1Scenario,
        },
      );
    }

    const summary = {
      ok: true,
      seed,
      firstDivergentTick,
      segmentTicks,
      segmentCount,
      cleanCheckpointCount: cleanComparison.checkpointCount,
      m1Scenario,
      expectedFinalSummary: summarizeReplay(seed, {
        segmentTicks,
        segmentCount,
      }),
      actualFinalSummary: summarizeReplay(seed, {
        segmentTicks,
        segmentCount,
      }),
      perturbedFirstDivergence: {
        checkpointIndex: divergence.checkpointIndex,
        tick: divergence.actualTick,
        reason: divergence.reason,
      },
      artifactPaths: toRelativeArtifactPaths(artifactPaths),
    };

    writeJson(artifactPaths.summary, summary);
    return summary;
  } catch (error) {
    return createReplayFailure(
      "unexpected_error",
      "Replay diagnostics crashed before completing structured checks.",
      failureContext,
      {
        error,
      },
    );
  }
}

export function printReplayDiagnosticsResult(result) {
  if (result.ok) {
    console.log("Replay diagnostics passed.");
    console.log(
      JSON.stringify(
        {
          scenarioId: result.scenarioId ?? null,
          seed: result.seed,
          cleanCheckpointCount: result.cleanCheckpointCount ?? null,
          perturbedFirstDivergentTick: result.perturbedFirstDivergence?.tick ?? null,
          artifactPaths: result.artifactPaths,
          m1Scenario: result.m1Scenario ?? null,
          m2Scenario: result.m2Scenario ?? null,
          m3Scenario: result.m3Scenario ?? null,
          m4Scenario: result.m4Scenario ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.error(result.message);
  console.error(
    JSON.stringify(
      {
        seed: result.seed,
        scenarioId: result.scenarioId ?? null,
        firstDivergentTick: result.firstDivergentTick,
        failureKind: result.failureKind,
        artifactPaths: result.artifactPaths,
        divergence: result.divergence ?? null,
        error: result.error ?? null,
      },
      null,
      2,
    ),
  );
}

function defaultBuildReplay(seed, options) {
  const runner = buildRunner(seed, options);
  const checkpoints = [];
  checkpoints.push(createHeadlessReplayCheckpoint(runner));

  for (let segment = 0; segment < options.segmentCount; segment += 1) {
    advanceHeadlessTicks(runner, options.segmentTicks);
    checkpoints.push(createHeadlessReplayCheckpoint(runner));
  }

  return checkpoints;
}

function buildRunner(seed, options) {
  const runner = createHeadlessRunner({ seed });

  for (let segment = 0; segment < options.segmentCount; segment += 1) {
    const baseTick = segment * options.segmentTicks;
    queueOrThrow(runner, baseTick, `order-${segment}`);
    queueOrThrow(runner, baseTick + 1_500, `watch-${segment}`);
    queueOrThrow(runner, baseTick + options.segmentTicks - 1, `close-${segment}`);
  }

  return runner;
}

function summarizeReplay(seed, options) {
  const runner = buildRunner(seed, options);
  advanceHeadlessTicks(runner, options.segmentTicks * options.segmentCount);
  return summarizeHeadlessRun(runner);
}

function queueOrThrow(runner, tick, commandId) {
  const result = queueHeadlessCommand(runner, { tick, commandId, kind: "noop" });

  if (!result.ok) {
    throw new Error(result.reason);
  }
}

function defaultCloneCheckpoints(checkpoints) {
  const cloned = [];

  for (let index = 0; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index];

    if (checkpoint !== undefined) {
      cloned.push({
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        commandHash: checkpoint.commandHash,
      });
    }
  }

  return cloned;
}

function createReplayFailure(failureKind, message, failureContext, details = {}) {
  const failure = {
    ok: false,
    seed: failureContext.seed,
    scenarioId: details.scenarioId ?? null,
    firstDivergentTick: details.firstDivergentTick ?? null,
    failureKind,
    message,
    artifactPaths: toRelativeArtifactPaths(failureContext.artifactPaths),
    divergence: details.divergence ?? null,
    error: details.error === undefined ? null : serializeError(details.error),
  };

  writeJson(failureContext.artifactPaths.summary, failure);
  return failure;
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    name: "NonErrorThrow",
    message: String(error),
    stack: null,
  };
}

function createArtifactPaths(customArtifactRoot) {
  const artifactDir = path.join(resolveArtifactRoot(customArtifactRoot), "determinism");
  const m1Dir = path.join(resolveArtifactRoot(customArtifactRoot), "m1-save-replay");
  const m2Dir = path.join(resolveArtifactRoot(customArtifactRoot), "m2-save-replay");
  const m3Dir = path.join(resolveArtifactRoot(customArtifactRoot), "m3-save-replay");
  const m4Dir = path.join(resolveArtifactRoot(customArtifactRoot), "m4-save-replay");

  return {
    expected: path.join(artifactDir, "expected-checkpoints.json"),
    actual: path.join(artifactDir, "actual-checkpoints.json"),
    perturbed: path.join(artifactDir, "perturbed-checkpoints.json"),
    summary: path.join(artifactDir, "replay-diagnostics-summary.json"),
    m1: {
      expected: path.join(m1Dir, "expected.json"),
      actual: path.join(m1Dir, "actual.json"),
      resumed: path.join(m1Dir, "resumed.json"),
      save: path.join(m1Dir, "save.json"),
      summary: path.join(m1Dir, "summary.json"),
    },
    m2: {
      expected: path.join(m2Dir, "expected.json"),
      actual: path.join(m2Dir, "actual.json"),
      resumed: path.join(m2Dir, "resumed.json"),
      save: path.join(m2Dir, "save.json"),
      summary: path.join(m2Dir, "summary.json"),
    },
    m3: {
      expected: path.join(m3Dir, "expected.json"),
      actual: path.join(m3Dir, "actual.json"),
      resumed: path.join(m3Dir, "resumed.json"),
      save: path.join(m3Dir, "save.json"),
      summary: path.join(m3Dir, "summary.json"),
    },
    m4: {
      expected: path.join(m4Dir, "expected.json"),
      actual: path.join(m4Dir, "actual.json"),
      resumed: path.join(m4Dir, "resumed.json"),
      save: path.join(m4Dir, "save.json"),
      summary: path.join(m4Dir, "summary.json"),
    },
  };
}

function resolveArtifactRoot(customArtifactRoot) {
  if (customArtifactRoot !== undefined) {
    return path.resolve(process.cwd(), customArtifactRoot);
  }

  const configuredRoot = process.env["WM_ARTIFACT_DIR"];

  if (configuredRoot !== undefined && configuredRoot.length > 0) {
    return path.resolve(process.cwd(), configuredRoot);
  }

  return path.resolve(process.cwd(), "coordination", "artifacts", "WM-0010");
}

function toRelativeArtifactPaths(artifactPaths) {
  return {
    expected: toRelativePath(artifactPaths.expected),
    actual: toRelativePath(artifactPaths.actual),
    perturbed: toRelativePath(artifactPaths.perturbed),
    summary: toRelativePath(artifactPaths.summary),
    m1: {
      expected: toRelativePath(artifactPaths.m1.expected),
      actual: toRelativePath(artifactPaths.m1.actual),
      resumed: toRelativePath(artifactPaths.m1.resumed),
      save: toRelativePath(artifactPaths.m1.save),
      summary: toRelativePath(artifactPaths.m1.summary),
    },
    m2: {
      expected: toRelativePath(artifactPaths.m2.expected),
      actual: toRelativePath(artifactPaths.m2.actual),
      resumed: toRelativePath(artifactPaths.m2.resumed),
      save: toRelativePath(artifactPaths.m2.save),
      summary: toRelativePath(artifactPaths.m2.summary),
    },
    m3: {
      expected: toRelativePath(artifactPaths.m3.expected),
      actual: toRelativePath(artifactPaths.m3.actual),
      resumed: toRelativePath(artifactPaths.m3.resumed),
      save: toRelativePath(artifactPaths.m3.save),
      summary: toRelativePath(artifactPaths.m3.summary),
    },
    m4: {
      expected: toRelativePath(artifactPaths.m4.expected),
      actual: toRelativePath(artifactPaths.m4.actual),
      resumed: toRelativePath(artifactPaths.m4.resumed),
      save: toRelativePath(artifactPaths.m4.save),
      summary: toRelativePath(artifactPaths.m4.summary),
    },
  };
}

function writeJson(targetPath, value) {
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toRelativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}

function runM2ReplayDiagnostics(options) {
  const seed = options.seed ?? DEFAULT_M2_SEED;
  const artifactPaths = createArtifactPaths(
    options.artifactRoot ?? path.join("coordination", "artifacts", "WM-0040"),
  );
  const failureContext = {
    seed,
    firstDivergentTick: null,
    artifactPaths,
  };

  mkdirSync(path.dirname(artifactPaths.m2.summary), { recursive: true });
  mkdirSync(path.dirname(artifactPaths.summary), { recursive: true });

  try {
    const checkpointTicks = [0, 6_000, 20_000];
    const resumeCheckpointTicks = [6_000, 20_000];
    const expected = readM2Replay(runM2WorkLogisticsReplay({ seed, checkpointTicks }));
    const actual = readM2Replay(runM2WorkLogisticsReplay({ seed, checkpointTicks }));
    const expectedResume = readM2Replay(
      runM2WorkLogisticsReplay({ seed, checkpointTicks: resumeCheckpointTicks }),
    );
    const save = readM2Save(createM2WorkLogisticsSaveEnvelope(seed, 6_000));
    const resumed = readM2Replay(
      resumeM2WorkLogisticsFromSave({
        save,
        finalTick: 20_000,
        checkpointTicks: resumeCheckpointTicks,
      }),
    );

    writeJson(artifactPaths.m2.expected, expected);
    writeJson(artifactPaths.m2.actual, actual);
    writeJson(artifactPaths.m2.save, save);
    writeJson(artifactPaths.m2.resumed, resumed);

    const relativeArtifacts = {
      expected: toRelativePath(artifactPaths.m2.expected),
      actual: toRelativePath(artifactPaths.m2.actual),
      resumed: toRelativePath(artifactPaths.m2.resumed),
      save: toRelativePath(artifactPaths.m2.save),
      summary: toRelativePath(artifactPaths.m2.summary),
    };
    const comparison = compareM2ReplayRuns(expected, actual, relativeArtifacts);
    const resumedComparison = compareM2ReplayRuns(expectedResume, resumed, relativeArtifacts);

    if (!comparison.ok || !resumedComparison.ok) {
      const divergence = comparison.ok ? resumedComparison : comparison;
      return createReplayFailure(
        "m2_work_logistics_divergence",
        "M2 work/logistics save/replay diagnostics diverged.",
        failureContext,
        {
          scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
          firstDivergentTick: divergence.firstDivergentTick,
          divergence,
        },
      );
    }

    const m2Scenario = {
      ok: true,
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      seed,
      finalWorldHash: expected.finalWorldHash,
      finalReadModelHash: expected.finalReadModelHash,
      checkpointCount: expected.checkpoints.length,
      saveTick: save.createdTick,
      saveBytes: JSON.stringify(save).length,
      firstDivergentTick: null,
      rebuiltIndexes: ["work-offers", "path-caches", "reservations", "read-models"],
      artifactPaths: relativeArtifacts,
    };

    const summary = {
      ok: true,
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      seed,
      firstDivergentTick: null,
      m2Scenario,
      artifactPaths: toRelativeArtifactPaths(artifactPaths),
    };

    writeJson(artifactPaths.m2.summary, m2Scenario);
    writeJson(artifactPaths.summary, summary);
    return summary;
  } catch (error) {
    return createReplayFailure(
      "unexpected_error",
      "M2 replay diagnostics crashed before completing structured checks.",
      failureContext,
      {
        scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
        error,
      },
    );
  }
}

function runM3ReplayDiagnostics(options) {
  const seed = options.seed ?? DEFAULT_M3_SEED;
  const artifactPaths = createArtifactPaths(
    options.artifactRoot ?? path.join("coordination", "artifacts", "WM-0057"),
  );
  const failureContext = {
    seed,
    firstDivergentTick: null,
    artifactPaths,
  };

  mkdirSync(path.dirname(artifactPaths.m3.summary), { recursive: true });
  mkdirSync(path.dirname(artifactPaths.summary), { recursive: true });

  try {
    const checkpointTicks = [0, 3_600, 7_200, M3_SAVE_TICK, 18_000, M3_FINAL_TICK];
    const resumeCheckpointTicks = [M3_SAVE_TICK, 18_000, M3_FINAL_TICK];
    const expected = readM3Replay(runM3OrdinaryLifeReplay({ seed, checkpointTicks }));
    const actual = readM3Replay(runM3OrdinaryLifeReplay({ seed, checkpointTicks }));
    const expectedResume = filterReplayRunToTicks(expected, resumeCheckpointTicks);
    const save = readM3Save(createM3OrdinaryLifeSaveEnvelope(seed, M3_SAVE_TICK));
    const resumed = readM3Replay(
      resumeM3OrdinaryLifeFromSave({
        save,
        loadTick: M3_LOAD_TICK,
        finalTick: M3_FINAL_TICK,
        checkpointTicks: resumeCheckpointTicks,
      }),
    );

    writeJson(artifactPaths.m3.expected, expected);
    writeJson(artifactPaths.m3.actual, actual);
    writeJson(artifactPaths.m3.save, save);
    writeJson(artifactPaths.m3.resumed, resumed);

    const relativeArtifacts = {
      expected: toRelativePath(artifactPaths.m3.expected),
      actual: toRelativePath(artifactPaths.m3.actual),
      resumed: toRelativePath(artifactPaths.m3.resumed),
      save: toRelativePath(artifactPaths.m3.save),
      summary: toRelativePath(artifactPaths.m3.summary),
    };
    const comparison = compareM3ReplayRuns(expected, actual, relativeArtifacts);
    const resumedComparison = compareM3ReplayRuns(expectedResume, resumed, relativeArtifacts);

    if (!comparison.ok || !resumedComparison.ok) {
      const divergence = comparison.ok ? resumedComparison : comparison;
      return createReplayFailure(
        "m3_ordinary_life_divergence",
        "M3 ordinary-life save/replay diagnostics diverged.",
        failureContext,
        {
          scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
          firstDivergentTick: divergence.firstDivergentTick,
          divergence,
        },
      );
    }

    const m3Scenario = {
      ok: true,
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      seed: save.seed,
      requestedSeed: seed,
      finalWorldHash: expected.finalWorldHash,
      finalReadModelHash: expected.finalReadModelHash,
      resumedFinalWorldHash: resumed.finalWorldHash,
      resumedFinalReadModelHash: resumed.finalReadModelHash,
      resumedSource: resumed.source,
      loadedStateHash: resumed.loadedStateHash,
      checkpointCount: expected.checkpoints.length,
      checkpointHashes: expected.checkpoints.map((checkpoint) => ({
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        readModelHash: checkpoint.readModelHash,
        checkpointHash: checkpoint.checkpointHash,
      })),
      saveTick: save.createdTick,
      loadTick: M3_LOAD_TICK,
      finalTick: M3_FINAL_TICK,
      saveBytes: JSON.stringify(save).length,
      rebuildTimeTicks: save.readOnlyProjection.rebuiltIndexes.rebuildTimeTicks,
      rebuiltIndexes: save.readOnlyProjection.rebuiltIndexes.names,
      rebuiltSurfaces: save.readOnlyProjection.rebuiltIndexes.surfaces,
      firstDivergentTick: null,
      artifactPaths: relativeArtifacts,
    };

    const summary = {
      ok: true,
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      seed: save.seed,
      requestedSeed: seed,
      firstDivergentTick: null,
      m3Scenario,
      artifactPaths: toRelativeArtifactPaths(artifactPaths),
    };

    writeJson(artifactPaths.m3.summary, m3Scenario);
    writeJson(artifactPaths.summary, summary);
    return summary;
  } catch (error) {
    return createReplayFailure(
      "unexpected_error",
      "M3 replay diagnostics crashed before completing structured checks.",
      failureContext,
      {
        scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
        error,
      },
    );
  }
}

function runM4ReplayDiagnostics(options) {
  const seed = options.seed ?? DEFAULT_M4_SEED;
  const artifactPaths = createArtifactPaths(
    options.artifactRoot ?? path.join("coordination", "artifacts", "WM-0068"),
  );
  const failureContext = {
    seed,
    firstDivergentTick: null,
    artifactPaths,
  };

  mkdirSync(path.dirname(artifactPaths.m4.summary), { recursive: true });
  mkdirSync(path.dirname(artifactPaths.summary), { recursive: true });

  try {
    const checkpointTicks = M4_REPLAY_CHECKPOINT_SEQUENCE;
    const resumeCheckpointTicks = [M4_SAVE_TICK, 18_000, M4_FINAL_TICK];
    const expected = readM4Replay(runM4CoreVerticalSliceReplay({ seed, checkpointTicks }));
    const actual = readM4Replay(runM4CoreVerticalSliceReplay({ seed, checkpointTicks }));
    const expectedResume = filterReplayRunToTicks(expected, resumeCheckpointTicks);
    const save = createM4CoreVerticalSliceSaveEnvelope(seed, M4_SAVE_TICK);
    const loaded = readM4Load(loadM4CoreVerticalSliceSaveEnvelope(save));
    const resumed = readM4Replay(
      resumeM4CoreVerticalSliceFromSave({
        save,
        loadTick: M4_LOAD_TICK,
        finalTick: M4_FINAL_TICK,
        checkpointTicks: resumeCheckpointTicks,
      }),
    );

    writeJson(artifactPaths.m4.expected, expected);
    writeJson(artifactPaths.m4.actual, actual);
    writeJson(artifactPaths.m4.save, save);
    writeJson(artifactPaths.m4.resumed, resumed);

    const relativeArtifacts = {
      expected: toRelativePath(artifactPaths.m4.expected),
      actual: toRelativePath(artifactPaths.m4.actual),
      resumed: toRelativePath(artifactPaths.m4.resumed),
      save: toRelativePath(artifactPaths.m4.save),
      summary: toRelativePath(artifactPaths.m4.summary),
    };
    const comparison = compareM4ReplayRuns(expected, actual, relativeArtifacts);
    const resumedComparison = compareM4ReplayRuns(expectedResume, resumed, relativeArtifacts);

    if (!comparison.ok || !resumedComparison.ok) {
      const divergence = comparison.ok ? resumedComparison : comparison;
      return createReplayFailure(
        "m4_core_vertical_slice_divergence",
        "M4 core vertical slice save/replay diagnostics diverged.",
        failureContext,
        {
          scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
          firstDivergentTick: divergence.firstDivergentTick,
          divergence,
        },
      );
    }

    const m4Scenario = {
      ok: true,
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      seed: save.seed,
      requestedSeed: seed,
      finalWorldHash: expected.finalWorldHash,
      finalReadModelHash: expected.finalReadModelHash,
      resumedFinalWorldHash: resumed.finalWorldHash,
      resumedFinalReadModelHash: resumed.finalReadModelHash,
      resumedSource: resumed.source,
      loadedStateHash: resumed.loadedStateHash,
      checkpointCount: expected.checkpoints.length,
      checkpointHashes: expected.checkpoints.map((checkpoint) => ({
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        readModelHash: checkpoint.readModelHash,
        checkpointHash: checkpoint.checkpointHash,
      })),
      saveTick: save.createdTick,
      loadTick: M4_LOAD_TICK,
      finalTick: M4_FINAL_TICK,
      saveBytes: JSON.stringify(save).length,
      loadValidationTimeTicks: loaded.validationTimeTicks,
      rebuildTimeTicks: loaded.rebuildTimeTicks,
      rebuiltSurfaceNames: loaded.rebuiltSurfaceNames,
      rebuiltSurfaces: loaded.projection.rebuiltIndexes.surfaces,
      commandTail: save.sections.commandLogTail.commandTail,
      saveCheckpointHashes: save.sections.reasonMetrics.checkpointHashes,
      firstDivergentTick: null,
      artifactPaths: relativeArtifacts,
    };

    const summary = {
      ok: true,
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      seed: save.seed,
      requestedSeed: seed,
      firstDivergentTick: null,
      m4Scenario,
      artifactPaths: toRelativeArtifactPaths(artifactPaths),
    };

    writeJson(artifactPaths.m4.summary, m4Scenario);
    writeJson(artifactPaths.summary, summary);
    return summary;
  } catch (error) {
    return createReplayFailure(
      "unexpected_error",
      "M4 replay diagnostics crashed before completing structured checks.",
      failureContext,
      {
        scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
        error,
      },
    );
  }
}

function runM1ReplayDiagnostics(seed, artifactPaths) {
  mkdirSync(path.dirname(artifactPaths.summary), { recursive: true });

  const checkpointTicks = [0, 2_400, 100_000];
  const expected = readM1Replay(runM1HaulingBuildingReplay({ seed: "1", checkpointTicks }));
  const actual = readM1Replay(runM1HaulingBuildingReplay({ seed: "1", checkpointTicks }));
  const expectedResume = readM1Replay(
    runM1HaulingBuildingReplay({ seed: "1", checkpointTicks: [2_400, 100_000] }),
  );
  const save = readM1Save(createM1HaulingBuildingSaveEnvelope("1", 2_400));
  const resumed = readM1Replay(
    resumeM1HaulingBuildingFromSave({
      save,
      finalTick: 100_000,
      checkpointTicks: [2_400, 100_000],
    }),
  );

  writeJson(artifactPaths.expected, expected);
  writeJson(artifactPaths.actual, actual);
  writeJson(artifactPaths.save, save);
  writeJson(artifactPaths.resumed, resumed);

  const comparison = compareM1ReplayRuns(expected, actual, {
    expected: toRelativePath(artifactPaths.expected),
    actual: toRelativePath(artifactPaths.actual),
    resumed: toRelativePath(artifactPaths.resumed),
    save: toRelativePath(artifactPaths.save),
    summary: toRelativePath(artifactPaths.summary),
  });
  const resumedComparison = compareM1ReplayRuns(expectedResume, resumed, {
    expected: toRelativePath(artifactPaths.expected),
    actual: toRelativePath(artifactPaths.actual),
    resumed: toRelativePath(artifactPaths.resumed),
    save: toRelativePath(artifactPaths.save),
    summary: toRelativePath(artifactPaths.summary),
  });

  const summary = {
    ok: comparison.ok && resumedComparison.ok,
    scenarioId: M1_SCENARIO_ID,
    seed: "1",
    requestedSeed: seed,
    finalWorldHash: expected.finalWorldHash,
    finalReadModelHash: expected.finalReadModelHash,
    checkpointCount: expected.checkpoints.length,
    saveTick: save.createdTick,
    firstDivergentTick:
      comparison.ok && resumedComparison.ok
        ? null
        : comparison.ok
          ? resumedComparison.firstDivergentTick
          : comparison.firstDivergentTick,
    artifactPaths: {
      expected: toRelativePath(artifactPaths.expected),
      actual: toRelativePath(artifactPaths.actual),
      resumed: toRelativePath(artifactPaths.resumed),
      save: toRelativePath(artifactPaths.save),
      summary: toRelativePath(artifactPaths.summary),
    },
  };

  writeJson(artifactPaths.summary, summary);
  return summary;
}

function readM1Replay(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readM1Save(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function readM2Replay(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readM2Save(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function readM3Replay(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readM3Save(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.save;
}

function readM4Replay(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function readM4Load(result) {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result;
}

function filterReplayRunToTicks(replay, checkpointTicks) {
  const checkpoints = [];
  for (const checkpoint of replay.checkpoints) {
    if (checkpointTicks.includes(checkpoint.tick)) {
      checkpoints.push(checkpoint);
    }
  }

  const finalCheckpoint = checkpoints[checkpoints.length - 1];
  if (finalCheckpoint === undefined) {
    throw new Error("filtered replay has no checkpoints");
  }

  return {
    ...replay,
    checkpoints,
    finalTick: finalCheckpoint.tick,
    finalWorldHash: finalCheckpoint.worldHash,
    finalReadModelHash: finalCheckpoint.readModelHash,
  };
}
