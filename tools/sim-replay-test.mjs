#!/usr/bin/env node
import {
  advanceHeadlessTicks,
  compareReplayCheckpoints,
  createHeadlessReplayCheckpoint,
  createHeadlessRunner,
  queueHeadlessCommand,
} from "../packages/sim-core/src/index.ts";

const expected = buildReplay("WM-0008-replay");
const cleanActual = buildReplay("WM-0008-replay");
const cleanComparison = compareReplayCheckpoints(expected, cleanActual);

if (!cleanComparison.ok) {
  console.error("Expected replay diverged unexpectedly:");
  console.error(JSON.stringify(cleanComparison.divergence, null, 2));
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

const perturbedComparison = compareReplayCheckpoints(expected, perturbed);

if (perturbedComparison.ok) {
  console.error("Perturbed replay was not detected.");
  process.exit(1);
}

const divergence = perturbedComparison.divergence;
if (
  divergence.checkpointIndex !== 2 ||
  divergence.reason !== "world_hash_mismatch" ||
  divergence.actualTick !== 6
) {
  console.error("Perturbed replay reported the wrong first divergence:");
  console.error(JSON.stringify(divergence, null, 2));
  process.exit(1);
}

console.log(
  `Replay diagnostics passed: clean=${cleanComparison.checkpointCount} checkpoints, perturbed first divergence checkpoint=${divergence.checkpointIndex} tick=${String(divergence.actualTick)} reason=${divergence.reason}`,
);

function buildReplay(seed) {
  const runner = createHeadlessRunner({ seed });
  const checkpoints = [];

  queueOrThrow(runner, 3, "founding-order");
  queueOrThrow(runner, 6, "night-watch");
  checkpoints.push(createHeadlessReplayCheckpoint(runner));

  for (let segment = 0; segment < 4; segment += 1) {
    advanceHeadlessTicks(runner, 3);
    checkpoints.push(createHeadlessReplayCheckpoint(runner));
  }

  return checkpoints;
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
