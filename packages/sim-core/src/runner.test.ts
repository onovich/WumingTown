import { describe, expect, it } from "vitest";

import {
  advanceHeadlessTicks,
  createHeadlessRunner,
  queueHeadlessCommand,
  runHeadlessTicks,
  setHeadlessPaused,
  setHeadlessSpeed,
  stepHeadlessFrames,
  summarizeHeadlessRun,
} from "./index";

describe("deterministic headless fixed-tick runner", () => {
  it("advances exactly the requested number of ticks", () => {
    const summary = runHeadlessTicks("1", 1_000);

    expect(summary.finalTick).toBe(1_000);
    expect(summary.ticksPerSecond).toBe(30);
    expect(summary.ticksPerDay).toBe(36_000);
    expect(summary.appliedCommandCount).toBe(0);
  });

  it("repeats the same seed and command stream in the same build", () => {
    const first = createCommandedRun();
    const second = createCommandedRun();

    expect(summarizeHeadlessRun(first)).toStrictEqual(summarizeHeadlessRun(second));
  });

  it("keeps paused frames from advancing ticks", () => {
    const runner = createHeadlessRunner({ seed: "pause-seed" });

    setHeadlessPaused(runner, true);
    expect(stepHeadlessFrames(runner, 10)).toBe(0);
    expect(runner.tick).toBe(0);

    setHeadlessPaused(runner, false);
    setHeadlessSpeed(runner, 3);
    expect(stepHeadlessFrames(runner, 4)).toBe(12);
    expect(runner.tick).toBe(12);

    setHeadlessSpeed(runner, 0);
    expect(stepHeadlessFrames(runner, 5)).toBe(0);
    expect(runner.tick).toBe(12);
  });

  it("applies queued commands in stable tick and insertion order", () => {
    const runner = createHeadlessRunner({ seed: "commands" });

    expect(queueHeadlessCommand(runner, { tick: 2, commandId: "first", kind: "noop" }).ok).toBe(
      true,
    );
    expect(queueHeadlessCommand(runner, { tick: 2, commandId: "second", kind: "noop" }).ok).toBe(
      true,
    );

    advanceHeadlessTicks(runner, 2);
    expect(runner.appliedCommandCount).toBe(0);

    advanceHeadlessTicks(runner, 1);
    expect(runner.appliedCommandCount).toBe(2);
    expect(summarizeHeadlessRun(runner).finalTick).toBe(3);
  });

  it("runs one million empty ticks with bounded deterministic summary shape", () => {
    const summary = runHeadlessTicks("1", 1_000_000);

    expect(summary).toStrictEqual({
      version: 1,
      ticksPerSecond: 30,
      ticksPerDay: 36_000,
      seed: "1",
      seedHash: summary.seedHash,
      finalTick: 1_000_000,
      paused: false,
      speed: 1,
      queuedCommandCount: 0,
      appliedCommandCount: 0,
      commandHash: summary.commandHash,
      worldHash: summary.worldHash,
    });
    expect(summary.seedHash).toMatch(/^0x[0-9a-f]{8}$/u);
    expect(summary.commandHash).toMatch(/^0x[0-9a-f]{8}$/u);
    expect(summary.worldHash).toMatch(/^0x[0-9a-f]{8}$/u);
  });
});

function createCommandedRun(): ReturnType<typeof createHeadlessRunner> {
  const runner = createHeadlessRunner({ seed: "repeatable" });

  queueOrThrow(runner, 0, "start");
  queueOrThrow(runner, 5, "middle");
  queueOrThrow(runner, 9, "end");
  advanceHeadlessTicks(runner, 10);

  return runner;
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
