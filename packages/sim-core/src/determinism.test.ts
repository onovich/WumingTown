import { describe, expect, it } from "vitest";

import {
  advanceHeadlessTicks,
  compareReplayCheckpoints,
  createHeadlessReplayCheckpoint,
  createHeadlessRunner,
  createNamedRandomStreams,
  formatCanonicalWorldHash,
  queueHeadlessCommand,
  restoreHeadlessRunner,
  serializeHeadlessRunner,
  summarizeHeadlessRun,
  type ReplayCheckpoint,
} from "./index";

describe("deterministic RNG streams, world hashing, and replay diagnostics", () => {
  it("requires every random draw to name an explicit stream", () => {
    const first = createNamedRandomStreams({ seed: "rng-seed" });
    const second = createNamedRandomStreams({ seed: "rng-seed" });

    const firstCombat = first.nextUint32("combat");
    const firstSocial = first.nextUint32("social");
    const secondSocial = second.nextUint32("social");

    expect(firstCombat).not.toBe(firstSocial);
    expect(firstSocial).toBe(secondSocial);
    expect(() => first.nextUint32("")).toThrow("random stream name");
  });

  it("keeps RNG state stable across a headless serialize and restore round trip", () => {
    const original = createHeadlessRunner({ seed: "round-trip" });
    queueOrThrow(original, 7, "late-command");
    advanceHeadlessTicks(original, 5);

    const restored = restoreHeadlessRunner(serializeHeadlessRunner(original));

    advanceHeadlessTicks(original, 8);
    advanceHeadlessTicks(restored, 8);

    expect(summarizeHeadlessRun(restored)).toStrictEqual(summarizeHeadlessRun(original));
    expect(summarizeHeadlessRun(restored).randomStreamCount).toBe(1);
  });

  it("rejects headless restores with mismatched or invalid RNG stream snapshots", () => {
    const runner = createHeadlessRunner({ seed: "snapshot-owner" });
    advanceHeadlessTicks(runner, 1);
    const snapshot = serializeHeadlessRunner(runner);

    expect(() =>
      restoreHeadlessRunner({
        ...snapshot,
        randomStreams: {
          ...snapshot.randomStreams,
          seed: "different-owner",
        },
      }),
    ).toThrow("random stream seed mismatch");

    expect(() =>
      restoreHeadlessRunner({
        ...snapshot,
        randomStreams: {
          ...snapshot.randomStreams,
          streams: [{ name: "story-director", state: 0, draws: 1 }],
        },
      }),
    ).toThrow("random stream state must not be zero");
  });

  it("hashes canonical world state without presentation state or input ordering accidents", () => {
    const firstHash = formatCanonicalWorldHash({
      fields: [
        { name: "tick", value: 12 },
        { name: "seed", value: "canonical" },
        { name: "paused", value: false },
      ],
      randomStreams: [
        { name: "social", state: 10, draws: 1 },
        { name: "combat", state: 20, draws: 3 },
      ],
      queuedCommands: [
        { tick: 4, sequence: 1, commandHash: 30 },
        { tick: 2, sequence: 0, commandHash: 40 },
      ],
      presentation: {
        cameraX: 100,
        selectedEntity: "ignored",
      },
    });

    const secondHash = formatCanonicalWorldHash({
      fields: [
        { name: "paused", value: false },
        { name: "seed", value: "canonical" },
        { name: "tick", value: 12 },
      ],
      randomStreams: [
        { name: "combat", state: 20, draws: 3 },
        { name: "social", state: 10, draws: 1 },
      ],
      queuedCommands: [
        { tick: 2, sequence: 0, commandHash: 40 },
        { tick: 4, sequence: 1, commandHash: 30 },
      ],
      presentation: {
        selectedEntity: "different-ignored",
        cameraX: -500,
      },
    });

    expect(firstHash).toBe(secondHash);
  });

  it("rejects duplicate canonical field and random stream names", () => {
    expect(() =>
      formatCanonicalWorldHash({
        fields: [
          { name: "tick", value: 1 },
          { name: "tick", value: 2 },
        ],
        randomStreams: [],
        queuedCommands: [],
      }),
    ).toThrow("field names must be unique");

    expect(() =>
      formatCanonicalWorldHash({
        fields: [],
        randomStreams: [
          { name: "combat", state: 10, draws: 1 },
          { name: "combat", state: 20, draws: 2 },
        ],
        queuedCommands: [],
      }),
    ).toThrow("random stream names must be unique");
  });

  it("reports the first divergent replay checkpoint for a perturbed replay", () => {
    const expected = buildReplayCheckpoints("replay-seed");
    const actual: ReplayCheckpoint[] = [];

    for (const checkpoint of expected) {
      actual.push({
        tick: checkpoint.tick,
        worldHash: checkpoint.worldHash,
        commandHash: checkpoint.commandHash,
      });
    }

    const target = actual[2];
    if (target === undefined) {
      throw new Error("test setup expected a third checkpoint");
    }

    actual[2] = {
      tick: target.tick,
      worldHash: "0xdeadbeef",
      commandHash: target.commandHash,
    };

    const comparison = compareReplayCheckpoints(expected, actual);

    expect(comparison.ok).toBe(false);
    if (!comparison.ok) {
      expect(comparison.divergence).toStrictEqual({
        checkpointIndex: 2,
        reason: "world_hash_mismatch",
        expectedTick: 6,
        actualTick: 6,
        expectedWorldHash: expected[2]?.worldHash,
        actualWorldHash: "0xdeadbeef",
        expectedCommandHash: expected[2]?.commandHash,
        actualCommandHash: target.commandHash,
      });
    }
  });
});

function buildReplayCheckpoints(seed: string): ReplayCheckpoint[] {
  const runner = createHeadlessRunner({ seed });
  const checkpoints: ReplayCheckpoint[] = [];

  queueOrThrow(runner, 3, "first");
  queueOrThrow(runner, 6, "second");
  checkpoints.push(createHeadlessReplayCheckpoint(runner));

  for (let segment = 0; segment < 4; segment += 1) {
    advanceHeadlessTicks(runner, 3);
    checkpoints.push(createHeadlessReplayCheckpoint(runner));
  }

  return checkpoints;
}

function queueOrThrow(
  runner: ReturnType<typeof createHeadlessRunner>,
  tick: number,
  commandId: string,
): void {
  const result = queueHeadlessCommand(runner, { tick, commandId, kind: "noop" });

  if (!result.ok) {
    throw new Error(result.reason);
  }
}
