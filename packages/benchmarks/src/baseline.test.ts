import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { compareBenchmarkToBaseline } from "./baseline";
import {
  parseIsolatedBenchmarkChildReport,
  runBenchmarksCli,
  type BenchmarkCliReport,
} from "./cli-lib";
import {
  createBenchmarkStats,
  type SampledEmptyTickBenchmark,
  type SampledEntityStoreBenchmark,
} from "./benchmarks";

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

  it("runs a filtered suite in one isolated Node child and records process metadata", () => {
    const artifactDirectory = mkdtempSync(path.join(tmpdir(), "wuming-town-cli-test-"));

    try {
      const exitCode = runBenchmarksCli([
        "--filter",
        "empty-tick",
        "--samples",
        "1",
        "--warmup",
        "0",
        "--artifacts-dir",
        artifactDirectory,
      ]);
      const artifactText = readFileSync(
        path.join(artifactDirectory, "benchmark-results.json"),
        "utf8",
      );
      const parsed: unknown = JSON.parse(artifactText);

      if (
        !isRecord(parsed) ||
        parsed["schemaVersion"] !== 1 ||
        !isRecord(parsed["invocation"]) ||
        !isRecord(parsed["execution"]) ||
        !isRecord(parsed["environment"]) ||
        !Array.isArray(parsed["results"])
      ) {
        throw new Error("benchmark CLI test expected schema version 1");
      }
      const invocation = parsed["invocation"];
      const execution = parsed["execution"];
      const environment = parsed["environment"];
      const results: readonly unknown[] = parsed["results"];
      const result = results[0];

      if (
        !isRecord(result) ||
        !isRecord(result["suiteProcess"]) ||
        !isRecord(result["comparison"]) ||
        (result["comparison"]["status"] !== "ok" &&
          result["comparison"]["status"] !== "warn" &&
          result["comparison"]["status"] !== "fail") ||
        !Array.isArray(result["sampleElapsedMs"])
      ) {
        throw new Error("benchmark CLI test expected one isolated result");
      }
      const suiteProcess = result["suiteProcess"];
      const comparison = result["comparison"];
      const sampleElapsedMs: readonly unknown[] = result["sampleElapsedMs"];
      const expectedExitCode = comparison["status"] === "fail" ? 1 : 0;

      expect(exitCode).toBe(expectedExitCode);
      expect(invocation).toHaveProperty("exitCode", expectedExitCode);
      expect(execution).toStrictEqual({
        mode: "isolated-node-per-suite",
        suiteProcessCount: 1,
      });
      expect(environment).toHaveProperty("hostKeySha256", expect.stringMatching(/^[A-F0-9]{64}$/u));
      expect(result).toHaveProperty("name", "empty-tick");
      expect(sampleElapsedMs).toHaveLength(1);
      expect(suiteProcess).not.toHaveProperty("processId", process.pid);
      expect(suiteProcess).toHaveProperty("exitCode", expectedExitCode);
      expect(suiteProcess).toHaveProperty(
        "artifactFileSha256",
        expect.stringMatching(/^[A-F0-9]{64}$/u),
      );
    } finally {
      rmSync(artifactDirectory, { force: true, recursive: true });
    }
  });

  it("fails closed on a malformed isolated child artifact", () => {
    expect(() =>
      parseIsolatedBenchmarkChildReport("{}", {
        name: "empty-tick",
        sampleCount: 1,
        warmupCount: 0,
      }),
    ).toThrow("invalid schema");
  });

  it("parses a fully shaped isolated child with exact raw-sample statistics", () => {
    const fixture = createValidIsolatedChildArtifact();
    const parsed = parseIsolatedBenchmarkChildReport(JSON.stringify(fixture), {
      name: "entity-store",
      sampleCount: 3,
      warmupCount: 0,
    });

    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]?.stats).toStrictEqual(fixture.results[0]?.stats);
  });

  it.each([
    ["sampleCount", 4],
    ["minElapsedMs", 0],
    ["medianElapsedMs", 0],
    ["maxElapsedMs", 3],
    ["meanElapsedMs", 1.5],
  ])("rejects a finite %s mismatch against raw samples", (field, value) => {
    const fixture = createValidIsolatedChildArtifact();
    const stats = readFixtureStats(fixture);

    stats[field] = value;
    if (field === "medianElapsedMs") {
      expect(fixture.results[0]?.sampleElapsedMs[1]).toBe(1.419);
      expect(value).toBe(0);
    }

    expect(() =>
      parseIsolatedBenchmarkChildReport(JSON.stringify(fixture), {
        name: "entity-store",
        sampleCount: 3,
        warmupCount: 0,
      }),
    ).toThrow(
      "benchmark child artifact for entity-store sample statistics do not match raw samples",
    );
  });

  it.each(["string", "null", "json-nonfinite"])("rejects %s-shaped sample statistics", (shape) => {
    const fixture = createValidIsolatedChildArtifact();
    const result = readFixtureResult(fixture);

    if (shape === "string") {
      result["stats"] = "invalid";
    } else if (shape === "null") {
      result["stats"] = null;
    } else {
      readFixtureStats(fixture)["medianElapsedMs"] = Number.NaN;
    }

    const artifactText = JSON.stringify(fixture);
    if (shape === "json-nonfinite") {
      expect(artifactText).toContain('"medianElapsedMs":null');
    }

    expect(() =>
      parseIsolatedBenchmarkChildReport(artifactText, {
        name: "entity-store",
        sampleCount: 3,
        warmupCount: 0,
      }),
    ).toThrow("benchmark child artifact for entity-store has invalid sample statistics");
  });
});

function createValidIsolatedChildArtifact(): BenchmarkCliReport {
  const sampledFixture = createEntityStoreResult(1.419);
  const sampled = {
    ...sampledFixture,
    stats: createBenchmarkStats(sampledFixture.sampleElapsedMs),
  };
  const comparison = compareBenchmarkToBaseline(sampled, {
    name: "entity-store",
    medianElapsedMs: 244.507,
    warnRegressionPercent: 10,
    failRegressionPercent: 20,
    invariants: sampled.invariants,
  });

  return {
    schemaVersion: 1,
    generatedAt: "2026-07-12T00:00:00.000Z",
    baselinePath: "packages/benchmarks/baseline.json",
    artifactPath: "synthetic/benchmark-results.json",
    sampleCount: 3,
    warmupCount: 0,
    invocation: {
      command: "corepack pnpm bench --filter entity-store",
      exitCode: 0,
    },
    execution: {
      mode: "isolated-suite-child",
      suiteProcessCount: 1,
    },
    hashing: {
      schemaVersion: 1,
      canonicalPayloadSha256: "A".repeat(64),
      canonicalPayloadDescription: "synthetic fixture payload",
      artifactFileSha256Path: "synthetic/benchmark-results.json.sha256",
      artifactFileSha256Description: "synthetic fixture file",
    },
    environment: {
      nodeVersion: process.version,
      pnpmVersion: "11.8.0",
      osRelease: "synthetic",
      platform: process.platform,
      arch: process.arch,
      cpuModel: "synthetic",
      cpuCount: 1,
      hostKeySha256: "B".repeat(64),
      processId: 42,
      gitCommit: "c".repeat(40),
    },
    results: [
      {
        ...sampled,
        comparison,
        suiteProcess: {
          processId: 42,
          exitCode: 0,
          command: "corepack pnpm bench --filter entity-store --samples 3 --warmup 0",
          artifactFileSha256: "D".repeat(64),
          artifactSidecarSha256: "E".repeat(64),
          canonicalPayloadSha256: "F".repeat(64),
        },
      },
    ],
  };
}

function readFixtureResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value["results"]) || !isRecord(value["results"][0])) {
    throw new Error("test fixture expected one result");
  }

  return value["results"][0];
}

function readFixtureStats(value: unknown): Record<string, unknown> {
  const result = readFixtureResult(value);

  if (!isRecord(result["stats"])) {
    throw new Error("test fixture expected sample statistics");
  }

  return result["stats"];
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
