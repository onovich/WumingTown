#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import {
  advanceHeadlessTicks,
  compareReplayCheckpoints,
  createHeadlessReplayCheckpoint,
  createHeadlessRunner,
  summarizeHeadlessRun,
  queueHeadlessCommand,
} from "../packages/sim-core/src/index.ts";

const seed = "WM-0010-long-run";
const expected = buildReplay(seed);
const cleanActual = buildReplay(seed);
const cleanComparison = compareReplayCheckpoints(expected, cleanActual);
const artifactDir = path.join(resolveArtifactRoot(), "determinism");
const expectedPath = path.join(artifactDir, "expected-checkpoints.json");
const actualPath = path.join(artifactDir, "actual-checkpoints.json");
const perturbedPath = path.join(artifactDir, "perturbed-checkpoints.json");
const summaryPath = path.join(artifactDir, "replay-diagnostics-summary.json");

mkdirSync(artifactDir, { recursive: true });
writeJson(expectedPath, expected);
writeJson(actualPath, cleanActual);

if (!cleanComparison.ok) {
  const failure = {
    seed,
    firstDivergentTick:
      cleanComparison.divergence.actualTick ?? cleanComparison.divergence.expectedTick,
    divergence: cleanComparison.divergence,
    artifactPaths: {
      expected: toRelativePath(expectedPath),
      actual: toRelativePath(actualPath),
    },
  };
  writeJson(summaryPath, failure);
  console.error("Deterministic replay diverged unexpectedly.");
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
}

const perturbed = cloneCheckpoints(cleanActual);
const target = perturbed[2];

if (target === undefined) {
  console.error("Replay probe did not create the required perturbation checkpoint.");
  process.exit(1);
}

perturbed[2] = {
  tick: target.tick,
  worldHash: "0x00000000",
  commandHash: target.commandHash,
};
writeJson(perturbedPath, perturbed);

const perturbedComparison = compareReplayCheckpoints(expected, perturbed);

if (perturbedComparison.ok) {
  console.error("Perturbed replay was not detected.");
  process.exit(1);
}

const divergence = perturbedComparison.divergence;
if (
  divergence.checkpointIndex !== 2 ||
  divergence.reason !== "world_hash_mismatch" ||
  divergence.actualTick !== 10_000
) {
  console.error("Perturbed replay reported the wrong first divergence:");
  console.error(JSON.stringify(divergence, null, 2));
  process.exit(1);
}

const expectedFinalSummary = summarizeReplay(seed);
const actualFinalSummary = summarizeReplay(seed);

const summary = {
  seed,
  segmentTicks: 5_000,
  segmentCount: 24,
  cleanCheckpointCount: cleanComparison.checkpointCount,
  expectedFinalSummary,
  actualFinalSummary,
  perturbedFirstDivergence: {
    checkpointIndex: divergence.checkpointIndex,
    tick: divergence.actualTick,
    reason: divergence.reason,
  },
  artifactPaths: {
    expected: toRelativePath(expectedPath),
    actual: toRelativePath(actualPath),
    perturbed: toRelativePath(perturbedPath),
  },
};
writeJson(summaryPath, summary);

console.log("Replay diagnostics passed.");
console.log(
  JSON.stringify(
    {
      seed,
      cleanCheckpointCount: cleanComparison.checkpointCount,
      perturbedFirstDivergentTick: divergence.actualTick,
      artifactPaths: summary.artifactPaths,
    },
    null,
    2,
  ),
);

function buildReplay(seed) {
  const runner = buildRunner(seed);
  const checkpoints = [];
  checkpoints.push(createHeadlessReplayCheckpoint(runner));

  for (let segment = 0; segment < 24; segment += 1) {
    advanceHeadlessTicks(runner, 5_000);
    checkpoints.push(createHeadlessReplayCheckpoint(runner));
  }

  return checkpoints;
}

function buildRunner(seed) {
  const runner = createHeadlessRunner({ seed });

  for (let segment = 0; segment < 24; segment += 1) {
    const baseTick = segment * 5_000;
    queueOrThrow(runner, baseTick, `order-${segment}`);
    queueOrThrow(runner, baseTick + 1_500, `watch-${segment}`);
    queueOrThrow(runner, baseTick + 4_999, `close-${segment}`);
  }

  return runner;
}

function summarizeReplay(seed) {
  const runner = buildRunner(seed);
  advanceHeadlessTicks(runner, 24 * 5_000);
  return summarizeHeadlessRun(runner);
}

function queueOrThrow(runner, tick, commandId) {
  const result = queueHeadlessCommand(runner, { tick, commandId, kind: "noop" });

  if (!result.ok) {
    throw new Error(result.reason);
  }
}

function cloneCheckpoints(checkpoints) {
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

function resolveArtifactRoot() {
  const configuredRoot = process.env.WM_ARTIFACT_DIR;

  if (configuredRoot !== undefined && configuredRoot.length > 0) {
    return path.resolve(process.cwd(), configuredRoot);
  }

  return path.resolve(process.cwd(), "coordination", "artifacts", "WM-0010");
}

function writeJson(targetPath, value) {
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toRelativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}
