import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import {
  advanceHeadlessTicks,
  compareReplayCheckpoints,
  createHeadlessReplayCheckpoint,
  createHeadlessRunner,
  queueHeadlessCommand,
  summarizeHeadlessRun,
} from "../packages/sim-core/src/index.ts";

const DEFAULT_SEED = "WM-0010-long-run";
const DEFAULT_SEGMENT_TICKS = 5_000;
const DEFAULT_SEGMENT_COUNT = 24;

export function runReplayDiagnostics(options = {}) {
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

    const summary = {
      ok: true,
      seed,
      firstDivergentTick,
      segmentTicks,
      segmentCount,
      cleanCheckpointCount: cleanComparison.checkpointCount,
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
          seed: result.seed,
          cleanCheckpointCount: result.cleanCheckpointCount,
          perturbedFirstDivergentTick: result.perturbedFirstDivergence.tick,
          artifactPaths: result.artifactPaths,
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

  return {
    expected: path.join(artifactDir, "expected-checkpoints.json"),
    actual: path.join(artifactDir, "actual-checkpoints.json"),
    perturbed: path.join(artifactDir, "perturbed-checkpoints.json"),
    summary: path.join(artifactDir, "replay-diagnostics-summary.json"),
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
  };
}

function writeJson(targetPath, value) {
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toRelativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}
