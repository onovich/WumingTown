import type { Tick } from "./time";

export type ReplayDivergenceReason =
  | "checkpoint_count_mismatch"
  | "tick_mismatch"
  | "world_hash_mismatch"
  | "command_hash_mismatch";

export interface ReplayCheckpoint {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly commandHash: string;
}

export interface ReplayDivergence {
  readonly checkpointIndex: number;
  readonly reason: ReplayDivergenceReason;
  readonly expectedTick: Tick | undefined;
  readonly actualTick: Tick | undefined;
  readonly expectedWorldHash: string | undefined;
  readonly actualWorldHash: string | undefined;
  readonly expectedCommandHash: string | undefined;
  readonly actualCommandHash: string | undefined;
}

export type ReplayComparisonResult =
  | {
      readonly ok: true;
      readonly checkpointCount: number;
    }
  | {
      readonly ok: false;
      readonly divergence: ReplayDivergence;
    };

export function compareReplayCheckpoints(
  expected: readonly ReplayCheckpoint[],
  actual: readonly ReplayCheckpoint[],
): ReplayComparisonResult {
  const commonCount = expected.length < actual.length ? expected.length : actual.length;

  for (let index = 0; index < commonCount; index += 1) {
    const expectedCheckpoint = expected[index];
    const actualCheckpoint = actual[index];

    if (expectedCheckpoint === undefined || actualCheckpoint === undefined) {
      return createCountMismatch(index, expectedCheckpoint, actualCheckpoint);
    }

    if (expectedCheckpoint.tick !== actualCheckpoint.tick) {
      return createDivergence(index, "tick_mismatch", expectedCheckpoint, actualCheckpoint);
    }

    if (expectedCheckpoint.worldHash !== actualCheckpoint.worldHash) {
      return createDivergence(index, "world_hash_mismatch", expectedCheckpoint, actualCheckpoint);
    }

    if (expectedCheckpoint.commandHash !== actualCheckpoint.commandHash) {
      return createDivergence(index, "command_hash_mismatch", expectedCheckpoint, actualCheckpoint);
    }
  }

  if (expected.length !== actual.length) {
    return createCountMismatch(commonCount, expected[commonCount], actual[commonCount]);
  }

  return {
    ok: true,
    checkpointCount: expected.length,
  };
}

function createCountMismatch(
  checkpointIndex: number,
  expected: ReplayCheckpoint | undefined,
  actual: ReplayCheckpoint | undefined,
): ReplayComparisonResult {
  return createDivergence(checkpointIndex, "checkpoint_count_mismatch", expected, actual);
}

function createDivergence(
  checkpointIndex: number,
  reason: ReplayDivergenceReason,
  expected: ReplayCheckpoint | undefined,
  actual: ReplayCheckpoint | undefined,
): ReplayComparisonResult {
  return {
    ok: false,
    divergence: {
      checkpointIndex,
      reason,
      expectedTick: expected?.tick,
      actualTick: actual?.tick,
      expectedWorldHash: expected?.worldHash,
      actualWorldHash: actual?.worldHash,
      expectedCommandHash: expected?.commandHash,
      actualCommandHash: actual?.commandHash,
    },
  };
}
