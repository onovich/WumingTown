import { describe, expect, it } from "vitest";

import { compareBenchmarkToBaseline } from "./baseline";
import type { SampledEmptyTickBenchmark, SampledEntityStoreBenchmark } from "./benchmarks";

describe("benchmark baseline comparison", () => {
  it("passes when invariants match and median runtime stays within budget", () => {
    const actual = createEmptyTickResult(8.3);

    const comparison = compareBenchmarkToBaseline(actual, {
      name: "empty-tick",
      medianElapsedMs: 8.2,
      warnRegressionPercent: 10,
      failRegressionPercent: 20,
      invariants: actual.invariants,
    });

    expect(comparison.status).toBe("ok");
    expect(comparison.invariantMismatches).toStrictEqual([]);
  });

  it("warns before fail threshold and fails after fail threshold", () => {
    const warning = compareBenchmarkToBaseline(createEntityStoreResult(262), {
      name: "entity-store",
      medianElapsedMs: 240,
      warnRegressionPercent: 5,
      failRegressionPercent: 15,
      invariants: createEntityStoreResult(240).invariants,
    });

    const failure = compareBenchmarkToBaseline(createEntityStoreResult(280), {
      name: "entity-store",
      medianElapsedMs: 240,
      warnRegressionPercent: 5,
      failRegressionPercent: 15,
      invariants: createEntityStoreResult(240).invariants,
    });

    expect(warning.status).toBe("warn");
    expect(failure.status).toBe("fail");
  });

  it("fails when deterministic benchmark invariants change", () => {
    const actual = createEmptyTickResult(8.1);

    const comparison = compareBenchmarkToBaseline(actual, {
      name: "empty-tick",
      medianElapsedMs: 8.2,
      warnRegressionPercent: 10,
      failRegressionPercent: 20,
      invariants: {
        ...actual.invariants,
        worldHash: "0xdeadbeef",
      },
    });

    expect(comparison.status).toBe("fail");
    expect(comparison.invariantMismatches).toStrictEqual([
      "worldHash: expected 0xdeadbeef, received 0x74d843e0",
    ]);
  });
});

function createEmptyTickResult(medianElapsedMs: number): SampledEmptyTickBenchmark {
  return {
    name: "empty-tick",
    report: {
      name: "empty-tick",
      requestedTicks: 1_000_000,
      advancedTicks: 1_000_000,
      elapsedMs: medianElapsedMs,
      heapUsedBeforeBytes: 0,
      heapUsedAfterBytes: 0,
      heapDeltaBytes: 0,
      summary: {
        version: 2,
        ticksPerSecond: 30,
        ticksPerDay: 36_000,
        seed: "1",
        seedHash: "0x340ca71c",
        finalTick: 1_000_000,
        paused: false,
        speed: 1,
        queuedCommandCount: 0,
        appliedCommandCount: 0,
        commandHash: "0x340ca71c",
        worldHash: "0x74d843e0",
        randomStreamCount: 1,
      },
    },
    invariants: {
      requestedTicks: 1_000_000,
      advancedTicks: 1_000_000,
      finalTick: 1_000_000,
      commandHash: "0x340ca71c",
      worldHash: "0x74d843e0",
      randomStreamCount: 1,
    },
    sampleElapsedMs: [medianElapsedMs - 0.1, medianElapsedMs, medianElapsedMs + 0.1],
    stats: {
      sampleCount: 3,
      minElapsedMs: medianElapsedMs - 0.1,
      medianElapsedMs,
      maxElapsedMs: medianElapsedMs + 0.1,
      meanElapsedMs: medianElapsedMs,
    },
  };
}

function createEntityStoreResult(medianElapsedMs: number): SampledEntityStoreBenchmark {
  return {
    name: "entity-store",
    report: {
      name: "entity-store",
      capacity: 8_192,
      queuedCommands: 8_192,
      commitResultCount: 8_192,
      appliedCommands: 8_192,
      failedCommands: 0,
      attachedComponents: 8_192,
      iterationChecksum: 134_209_536,
      elapsedMs: medianElapsedMs,
      heapUsedBeforeBytes: 0,
      heapUsedAfterBytes: 0,
      heapDeltaBytes: 0,
    },
    invariants: {
      capacity: 8_192,
      queuedCommands: 8_192,
      commitResultCount: 8_192,
      appliedCommands: 8_192,
      failedCommands: 0,
      attachedComponents: 8_192,
      iterationChecksum: 134_209_536,
    },
    sampleElapsedMs: [medianElapsedMs - 1, medianElapsedMs, medianElapsedMs + 1],
    stats: {
      sampleCount: 3,
      minElapsedMs: medianElapsedMs - 1,
      medianElapsedMs,
      maxElapsedMs: medianElapsedMs + 1,
      meanElapsedMs: medianElapsedMs,
    },
  };
}
