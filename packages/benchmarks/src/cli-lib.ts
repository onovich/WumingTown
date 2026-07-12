import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, hostname, release, tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  BENCHMARK_BASELINE_SCHEMA_VERSION,
  compareBenchmarkToBaseline,
  type BenchmarkBaselineEntry,
  type BenchmarkBaselineFile,
  type BenchmarkComparison,
} from "./baseline";
import {
  DEFAULT_BENCHMARK_NAMES,
  DEFAULT_BENCHMARK_SAMPLE_COUNT,
  DEFAULT_BENCHMARK_WARMUP_COUNT,
  createBenchmarkStats,
  sampleBenchmark,
  type BenchmarkName,
  type SampledBenchmarkResult,
} from "./benchmarks";

export interface BenchmarkCliReport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly baselinePath: string;
  readonly artifactPath: string;
  readonly sampleCount: number;
  readonly warmupCount: number;
  readonly invocation: BenchmarkInvocationMetadata;
  readonly execution: BenchmarkExecutionMetadata;
  readonly hashing: BenchmarkArtifactHashing;
  readonly environment: BenchmarkEnvironmentMetadata;
  readonly results: readonly BenchmarkCliResult[];
}

export interface BenchmarkEnvironmentMetadata {
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly osRelease: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpuCount: number;
  readonly hostKeySha256: string;
  readonly processId: number;
  readonly gitCommit: string;
}

export interface BenchmarkInvocationMetadata {
  readonly command: string;
  readonly exitCode: number;
}

export interface BenchmarkExecutionMetadata {
  readonly mode: "isolated-node-per-suite" | "isolated-suite-child";
  readonly suiteProcessCount: number;
}

export interface BenchmarkArtifactHashing {
  readonly schemaVersion: 1;
  readonly canonicalPayloadSha256: string;
  readonly canonicalPayloadDescription: string;
  readonly artifactFileSha256Path: string;
  readonly artifactFileSha256Description: string;
}

export type BenchmarkCliResult = SampledBenchmarkResult & {
  readonly comparison: BenchmarkComparison<BenchmarkName>;
  readonly suiteProcess: BenchmarkSuiteProcessMetadata;
};

export interface BenchmarkSuiteProcessMetadata {
  readonly processId: number;
  readonly exitCode: number;
  readonly command: string;
  readonly artifactFileSha256: string;
  readonly artifactSidecarSha256: string;
  readonly canonicalPayloadSha256: string;
}

interface ParsedBenchmarkArgs {
  readonly filter: BenchmarkName | undefined;
  readonly sampleCount: number;
  readonly warmupCount: number;
  readonly baselinePath: string;
  readonly artifactPath: string;
}

const ISOLATED_CHILD_ENV = "WM_BENCHMARK_ISOLATED_CHILD";
const BENCHMARK_CLI_ENTRY_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));
const TYPESCRIPT_LOADER_URL = new URL(
  "../../../tools/register-ts-extension-loader.mjs",
  import.meta.url,
).href;

export function runBenchmarksCli(argv: readonly string[]): number {
  const parsed = parseBenchmarkArgs(argv);

  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const baseline = loadBenchmarkBaseline(parsed.value.baselinePath);
  const isolatedChild = process.env[ISOLATED_CHILD_ENV] === "1";
  const environment = createBenchmarkEnvironmentMetadata();

  if (isolatedChild && parsed.value.filter === undefined) {
    console.error("isolated benchmark child requires one --filter");
    return 1;
  }

  const results = isolatedChild
    ? createInProcessResults(parsed.value, baseline)
    : runIsolatedBenchmarkSuites(parsed.value, baseline, environment);
  const exitCode = results.some((result) => result.comparison.status === "fail") ? 1 : 0;

  const artifactHashPath = createArtifactHashPath(parsed.value.artifactPath);
  const reportPayload: Omit<BenchmarkCliReport, "hashing"> = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baselinePath: toRelativePath(parsed.value.baselinePath),
    artifactPath: toRelativePath(parsed.value.artifactPath),
    sampleCount: parsed.value.sampleCount,
    warmupCount: parsed.value.warmupCount,
    invocation: {
      command: formatBenchmarkCommand(argv),
      exitCode,
    },
    execution: {
      mode: isolatedChild ? "isolated-suite-child" : "isolated-node-per-suite",
      suiteProcessCount: results.length,
    },
    environment,
    results,
  };
  const report: BenchmarkCliReport = {
    ...reportPayload,
    hashing: {
      schemaVersion: 1,
      canonicalPayloadSha256: createSha256(`${JSON.stringify(reportPayload, undefined, 2)}\n`),
      canonicalPayloadDescription:
        "SHA-256 of benchmark-results.json payload before hashing metadata is added.",
      artifactFileSha256Path: toRelativePath(artifactHashPath),
      artifactFileSha256Description:
        "Actual SHA-256 of benchmark-results.json is written to this sidecar after the JSON artifact is written.",
    },
  };
  const artifactText = `${JSON.stringify(report, undefined, 2)}\n`;
  const artifactFileSha256 = createSha256(artifactText);

  mkdirSync(path.dirname(parsed.value.artifactPath), { recursive: true });
  writeFileSync(parsed.value.artifactPath, artifactText, "utf8");
  writeFileSync(
    artifactHashPath,
    `${artifactFileSha256}  ${path.basename(parsed.value.artifactPath)}\n`,
    "utf8",
  );

  printBenchmarkSummary(results, report.artifactPath);
  return exitCode;
}

function createInProcessResults(
  parsed: ParsedBenchmarkArgs,
  baseline: BenchmarkBaselineFile,
): readonly BenchmarkCliResult[] {
  const filter = parsed.filter;

  if (filter === undefined) {
    throw new Error("isolated benchmark child requires one named suite");
  }

  const sampled = sampleNamedBenchmark(filter, parsed.sampleCount, parsed.warmupCount);
  const comparison = compareAgainstNamedBaseline(sampled, baseline);

  const result = {
    ...sampled,
    comparison,
    suiteProcess: {
      processId: process.pid,
      exitCode: comparison.status === "fail" ? 1 : 0,
      command: formatBenchmarkCommand(process.argv.slice(2)),
      artifactFileSha256: "recorded-by-parent",
      artifactSidecarSha256: "recorded-by-parent",
      canonicalPayloadSha256: "recorded-by-parent",
    },
  };

  return [result];
}

function runIsolatedBenchmarkSuites(
  parsed: ParsedBenchmarkArgs,
  baseline: BenchmarkBaselineFile,
  environment: BenchmarkEnvironmentMetadata,
): readonly BenchmarkCliResult[] {
  const names = parsed.filter === undefined ? DEFAULT_BENCHMARK_NAMES : [parsed.filter];
  const results: BenchmarkCliResult[] = [];

  for (const name of names) {
    results.push(runIsolatedBenchmarkSuite(name, parsed, baseline, environment));
  }

  return results;
}

function runIsolatedBenchmarkSuite(
  name: BenchmarkName,
  parsed: ParsedBenchmarkArgs,
  baseline: BenchmarkBaselineFile,
  environment: BenchmarkEnvironmentMetadata,
): BenchmarkCliResult {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "wuming-town-benchmark-"));
  const childArtifactPath = path.join(temporaryDirectory, "benchmark-results.json");
  const childSidecarPath = createArtifactHashPath(childArtifactPath);

  try {
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--import",
        TYPESCRIPT_LOADER_URL,
        BENCHMARK_CLI_ENTRY_PATH,
        "--filter",
        name,
        "--samples",
        String(parsed.sampleCount),
        "--warmup",
        String(parsed.warmupCount),
        "--baseline",
        parsed.baselinePath,
        "--artifacts-dir",
        temporaryDirectory,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          [ISOLATED_CHILD_ENV]: "1",
        },
        maxBuffer: 16 * 1024 * 1024,
        shell: false,
        windowsHide: true,
      },
    );

    if (child.error !== undefined) {
      throw child.error;
    }

    if (child.status !== 0 && child.status !== 1) {
      throw new Error(
        `benchmark child ${name} exited without a reportable status: ${String(child.status)}`,
      );
    }

    if (!existsSync(childArtifactPath) || !existsSync(childSidecarPath)) {
      const diagnostics = [child.stdout, child.stderr]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join("\n")
        .trim();
      throw new Error(
        `benchmark child ${name} omitted its artifact or sidecar${diagnostics.length === 0 ? "" : `: ${diagnostics}`}`,
      );
    }

    const artifactText = readFileSync(childArtifactPath, "utf8");
    const sidecarText = readFileSync(childSidecarPath, "utf8");
    const childReport = parseIsolatedBenchmarkChildReport(artifactText, {
      name,
      sampleCount: parsed.sampleCount,
      warmupCount: parsed.warmupCount,
    });
    const childResult = childReport.results[0];

    if (childResult === undefined) {
      throw new Error(`benchmark child ${name} did not publish one result`);
    }

    validateChildEnvironment(name, childReport.environment, environment);
    validateChildArtifactHashes(name, childReport, artifactText, sidecarText);

    const expectedExitCode = childResult.comparison.status === "fail" ? 1 : 0;
    const parentComparison = compareAgainstNamedBaseline(childResult, baseline);

    if (child.status !== expectedExitCode || childReport.invocation.exitCode !== expectedExitCode) {
      throw new Error(`benchmark child ${name} exit code disagrees with its comparison`);
    }

    if (JSON.stringify(parentComparison) !== JSON.stringify(childResult.comparison)) {
      throw new Error(`benchmark child ${name} comparison disagrees with the parent baseline`);
    }

    return {
      ...childResult,
      comparison: parentComparison,
      suiteProcess: {
        processId: childReport.environment.processId,
        exitCode: child.status,
        command: childReport.invocation.command,
        artifactFileSha256: createSha256(artifactText),
        artifactSidecarSha256: createSha256(sidecarText),
        canonicalPayloadSha256: childReport.hashing.canonicalPayloadSha256,
      },
    };
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

export function parseIsolatedBenchmarkChildReport(
  artifactText: string,
  expected: {
    readonly name: BenchmarkName;
    readonly sampleCount: number;
    readonly warmupCount: number;
  },
): BenchmarkCliReport {
  const parsed: unknown = JSON.parse(artifactText);

  if (!isRecord(parsed) || parsed["schemaVersion"] !== 1) {
    throw new Error("benchmark child artifact has an invalid schema");
  }

  if (
    parsed["sampleCount"] !== expected.sampleCount ||
    parsed["warmupCount"] !== expected.warmupCount
  ) {
    throw new Error("benchmark child artifact changed sampling options");
  }

  const execution = parsed["execution"];
  const environment = parsed["environment"];
  const invocation = parsed["invocation"];
  const hashing = parsed["hashing"];
  const results = parsed["results"];

  if (
    !isRecord(execution) ||
    execution["mode"] !== "isolated-suite-child" ||
    execution["suiteProcessCount"] !== 1 ||
    !isRecord(environment) ||
    typeof environment["processId"] !== "number" ||
    !Number.isInteger(environment["processId"]) ||
    !isRecord(invocation) ||
    typeof invocation["command"] !== "string" ||
    invocation["command"].length === 0 ||
    (invocation["exitCode"] !== 0 && invocation["exitCode"] !== 1) ||
    !isRecord(hashing) ||
    typeof hashing["canonicalPayloadSha256"] !== "string" ||
    typeof hashing["artifactFileSha256Path"] !== "string" ||
    !Array.isArray(results) ||
    results.length !== 1 ||
    !isRecord(results[0]) ||
    results[0]["name"] !== expected.name
  ) {
    throw new Error(`benchmark child artifact for ${expected.name} failed isolation validation`);
  }

  const result = results[0];
  const samples = result["sampleElapsedMs"];
  const stats = result["stats"];
  const report = result["report"];
  const invariants = result["invariants"];
  const comparison = result["comparison"];
  const suiteProcess = result["suiteProcess"];

  if (
    !isFiniteNumberArray(samples) ||
    samples.length !== expected.sampleCount ||
    samples.length === 0
  ) {
    throw new Error(`benchmark child artifact for ${expected.name} omitted raw samples`);
  }

  if (
    !isRecord(stats) ||
    !isFiniteNumber(stats["sampleCount"]) ||
    !Number.isInteger(stats["sampleCount"]) ||
    !isFiniteNumber(stats["minElapsedMs"]) ||
    !isFiniteNumber(stats["medianElapsedMs"]) ||
    !isFiniteNumber(stats["maxElapsedMs"]) ||
    !isFiniteNumber(stats["meanElapsedMs"])
  ) {
    throw new Error(`benchmark child artifact for ${expected.name} has invalid sample statistics`);
  }

  const recomputedStats = createBenchmarkStats(samples);

  if (
    !Object.is(stats["sampleCount"], recomputedStats.sampleCount) ||
    !Object.is(stats["minElapsedMs"], recomputedStats.minElapsedMs) ||
    !Object.is(stats["medianElapsedMs"], recomputedStats.medianElapsedMs) ||
    !Object.is(stats["maxElapsedMs"], recomputedStats.maxElapsedMs) ||
    !Object.is(stats["meanElapsedMs"], recomputedStats.meanElapsedMs)
  ) {
    throw new Error(
      `benchmark child artifact for ${expected.name} sample statistics do not match raw samples`,
    );
  }

  if (
    !isRecord(report) ||
    report["name"] !== expected.name ||
    !isRecord(invariants) ||
    !isRecord(comparison) ||
    comparison["name"] !== expected.name ||
    (comparison["status"] !== "ok" &&
      comparison["status"] !== "warn" &&
      comparison["status"] !== "fail") ||
    !isRecord(suiteProcess) ||
    suiteProcess["processId"] !== environment["processId"]
  ) {
    throw new Error(`benchmark child artifact for ${expected.name} omitted raw samples`);
  }

  // The boundary checks above validate every field used by orchestration before
  // retaining the child payload under its existing public report type.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated external JSON boundary
  return parsed as unknown as BenchmarkCliReport;
}

function validateChildEnvironment(
  name: BenchmarkName,
  child: BenchmarkEnvironmentMetadata,
  parent: BenchmarkEnvironmentMetadata,
): void {
  if (
    child.processId === parent.processId ||
    child.nodeVersion !== parent.nodeVersion ||
    child.pnpmVersion !== parent.pnpmVersion ||
    child.osRelease !== parent.osRelease ||
    child.platform !== parent.platform ||
    child.arch !== parent.arch ||
    child.cpuModel !== parent.cpuModel ||
    child.cpuCount !== parent.cpuCount ||
    child.hostKeySha256 !== parent.hostKeySha256 ||
    child.gitCommit !== parent.gitCommit
  ) {
    throw new Error(`benchmark child ${name} environment disagrees with its parent`);
  }
}

function validateChildArtifactHashes(
  name: BenchmarkName,
  report: BenchmarkCliReport,
  artifactText: string,
  sidecarText: string,
): void {
  const artifactFileSha256 = createSha256(artifactText);
  const expectedSidecar = `${artifactFileSha256}  benchmark-results.json\n`;
  const payload: Omit<BenchmarkCliReport, "hashing"> = {
    schemaVersion: report.schemaVersion,
    generatedAt: report.generatedAt,
    baselinePath: report.baselinePath,
    artifactPath: report.artifactPath,
    sampleCount: report.sampleCount,
    warmupCount: report.warmupCount,
    invocation: report.invocation,
    execution: report.execution,
    environment: report.environment,
    results: report.results,
  };
  const canonicalPayloadSha256 = createSha256(`${JSON.stringify(payload, undefined, 2)}\n`);

  if (
    sidecarText !== expectedSidecar ||
    report.hashing.canonicalPayloadSha256 !== canonicalPayloadSha256 ||
    !report.hashing.artifactFileSha256Path.endsWith("benchmark-results.json.sha256")
  ) {
    throw new Error(`benchmark child ${name} artifact hash validation failed`);
  }
}

function parseBenchmarkArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly value: ParsedBenchmarkArgs }
  | { readonly ok: false; readonly error: string } {
  let filter: BenchmarkName | undefined;
  let sampleCount = DEFAULT_BENCHMARK_SAMPLE_COUNT;
  let warmupCount = DEFAULT_BENCHMARK_WARMUP_COUNT;
  let baselinePath = path.join(process.cwd(), "packages", "benchmarks", "baseline.json");
  let artifactPath = path.join(
    resolveArtifactRoot("WM-0083"),
    "benchmarks",
    "benchmark-results.json",
  );
  let artifactPathWasConfigured = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--filter") {
      const value = argv[index + 1];

      if (!isBenchmarkName(value)) {
        return failedArgs(
          "Unsupported benchmark filter. Use empty-tick, entity-store, logistics-10k, m1-hauling-building-long-run, m2-pathing-invalidation, m2-work-logistics-long-run, m3-ordinary-life-long-run, m4-core-vertical-slice-long-run, m5-alpha-content-long-run, map-dirty, pathing-100, reservations, region-room, spatial-index, or work-offers.",
        );
      }

      filter = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--filter=") === true) {
      const value = arg.slice("--filter=".length);

      if (!isBenchmarkName(value)) {
        return failedArgs(
          "Unsupported benchmark filter. Use empty-tick, entity-store, logistics-10k, m1-hauling-building-long-run, m2-pathing-invalidation, m2-work-logistics-long-run, m3-ordinary-life-long-run, m4-core-vertical-slice-long-run, m5-alpha-content-long-run, map-dirty, pathing-100, reservations, region-room, spatial-index, or work-offers.",
        );
      }

      filter = value;
      continue;
    }

    if (arg === "--samples") {
      const value = argv[index + 1];
      const parsedSampleCount = Number(value);

      if (!Number.isInteger(parsedSampleCount) || parsedSampleCount <= 0) {
        return failedArgs("--samples requires a positive integer");
      }

      sampleCount = parsedSampleCount;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--samples=") === true) {
      const parsedSampleCount = Number(arg.slice("--samples=".length));

      if (!Number.isInteger(parsedSampleCount) || parsedSampleCount <= 0) {
        return failedArgs("--samples requires a positive integer");
      }

      sampleCount = parsedSampleCount;
      continue;
    }

    if (arg === "--warmup") {
      const value = argv[index + 1];
      const parsedWarmupCount = Number(value);

      if (!Number.isInteger(parsedWarmupCount) || parsedWarmupCount < 0) {
        return failedArgs("--warmup requires a non-negative integer");
      }

      warmupCount = parsedWarmupCount;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--warmup=") === true) {
      const parsedWarmupCount = Number(arg.slice("--warmup=".length));

      if (!Number.isInteger(parsedWarmupCount) || parsedWarmupCount < 0) {
        return failedArgs("--warmup requires a non-negative integer");
      }

      warmupCount = parsedWarmupCount;
      continue;
    }

    if (arg === "--baseline") {
      const value = argv[index + 1];

      if (value === undefined || value.length === 0) {
        return failedArgs("--baseline requires a path");
      }

      baselinePath = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--baseline=") === true) {
      const value = arg.slice("--baseline=".length);

      if (value.length === 0) {
        return failedArgs("--baseline requires a path");
      }

      baselinePath = path.resolve(process.cwd(), value);
      continue;
    }

    if (arg === "--artifacts-dir") {
      const value = argv[index + 1];

      if (value === undefined || value.length === 0) {
        return failedArgs("--artifacts-dir requires a path");
      }

      artifactPath = path.resolve(process.cwd(), value, "benchmark-results.json");
      artifactPathWasConfigured = true;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--artifacts-dir=") === true) {
      const value = arg.slice("--artifacts-dir=".length);

      if (value.length === 0) {
        return failedArgs("--artifacts-dir requires a path");
      }

      artifactPath = path.resolve(process.cwd(), value, "benchmark-results.json");
      artifactPathWasConfigured = true;
      continue;
    }

    return failedArgs(
      "Unsupported benchmark arguments. Use --filter, --samples, --warmup, --baseline, or --artifacts-dir.",
    );
  }

  if (!artifactPathWasConfigured && filter === "logistics-10k") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0026"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "work-offers") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0024"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "pathing-100") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0022"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "reservations") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0023"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "region-room") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0021"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "spatial-index") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0020"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (
    !artifactPathWasConfigured &&
    (filter === "m2-pathing-invalidation" || filter === "m2-work-logistics-long-run")
  ) {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0042"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "m3-ordinary-life-long-run") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0059"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "m4-core-vertical-slice-long-run") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0070"),
      "benchmarks",
      "benchmark-results.json",
    );
  } else if (!artifactPathWasConfigured && filter === "m5-alpha-content-long-run") {
    artifactPath = path.join(
      resolveArtifactRoot("WM-0083"),
      "benchmarks",
      "benchmark-results.json",
    );
  }

  return {
    ok: true,
    value: {
      filter,
      sampleCount,
      warmupCount,
      baselinePath,
      artifactPath,
    },
  };
}

function loadBenchmarkBaseline(filePath: string): BenchmarkBaselineFile {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));

  if (!isRecord(parsed)) {
    throw new Error("benchmark baseline file must contain an object");
  }

  if (parsed["schemaVersion"] !== BENCHMARK_BASELINE_SCHEMA_VERSION) {
    throw new Error("unsupported benchmark baseline schema version");
  }

  if (typeof parsed["generatedAt"] !== "string") {
    throw new Error("benchmark baseline file must include generatedAt");
  }

  const rawBenchmarks = parsed["benchmarks"];

  if (!isRecord(rawBenchmarks)) {
    throw new Error("benchmark baseline file must include benchmarks");
  }

  return {
    schemaVersion: BENCHMARK_BASELINE_SCHEMA_VERSION,
    generatedAt: parsed["generatedAt"],
    benchmarks: {
      "empty-tick": parseEmptyTickBaselineEntry(rawBenchmarks["empty-tick"]),
      "entity-store": parseEntityStoreBaselineEntry(rawBenchmarks["entity-store"]),
      "logistics-10k": parseLogistics10kBaselineEntry(rawBenchmarks["logistics-10k"]),
      "m1-hauling-building-long-run": parseM1HaulingBuildingLongRunBaselineEntry(
        rawBenchmarks["m1-hauling-building-long-run"],
      ),
      "m2-pathing-invalidation": parseM2PathingInvalidationBaselineEntry(
        rawBenchmarks["m2-pathing-invalidation"],
      ),
      "m2-work-logistics-long-run": parseM2WorkLogisticsLongRunBaselineEntry(
        rawBenchmarks["m2-work-logistics-long-run"],
      ),
      "m3-ordinary-life-long-run": parseM3OrdinaryLifeLongRunBaselineEntry(
        rawBenchmarks["m3-ordinary-life-long-run"],
      ),
      "m4-core-vertical-slice-long-run": parseM4CoreVerticalSliceLongRunBaselineEntry(
        rawBenchmarks["m4-core-vertical-slice-long-run"],
      ),
      "m5-alpha-content-long-run": parseM5AlphaContentLongRunBaselineEntry(
        rawBenchmarks["m5-alpha-content-long-run"],
      ),
      "map-dirty": parseMapDirtyBaselineEntry(rawBenchmarks["map-dirty"]),
      "pathing-100": parsePathing100BaselineEntry(rawBenchmarks["pathing-100"]),
      reservations: parseReservationsBaselineEntry(rawBenchmarks["reservations"]),
      "region-room": parseRegionRoomBaselineEntry(rawBenchmarks["region-room"]),
      "spatial-index": parseSpatialIndexBaselineEntry(rawBenchmarks["spatial-index"]),
      "work-offers": parseWorkOffersBaselineEntry(rawBenchmarks["work-offers"]),
    },
  };
}

function parseEmptyTickBaselineEntry(value: unknown): BenchmarkBaselineEntry<"empty-tick"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry empty-tick must be an object");
  }

  if (value["name"] !== "empty-tick") {
    throw new Error("benchmark baseline entry empty-tick must declare the same name");
  }

  return {
    name: "empty-tick",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "empty-tick.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "empty-tick.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "empty-tick.failRegressionPercent",
    ),
    invariants: parseEmptyTickBaselineInvariants(requireRecord(value["invariants"], "empty-tick")),
  };
}

function parseEntityStoreBaselineEntry(value: unknown): BenchmarkBaselineEntry<"entity-store"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry entity-store must be an object");
  }

  if (value["name"] !== "entity-store") {
    throw new Error("benchmark baseline entry entity-store must declare the same name");
  }

  return {
    name: "entity-store",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "entity-store.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "entity-store.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "entity-store.failRegressionPercent",
    ),
    invariants: parseEntityStoreBaselineInvariants(
      requireRecord(value["invariants"], "entity-store"),
    ),
  };
}

function parseLogistics10kBaselineEntry(value: unknown): BenchmarkBaselineEntry<"logistics-10k"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry logistics-10k must be an object");
  }

  if (value["name"] !== "logistics-10k") {
    throw new Error("benchmark baseline entry logistics-10k must declare the same name");
  }

  return {
    name: "logistics-10k",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "logistics-10k.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "logistics-10k.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "logistics-10k.failRegressionPercent",
    ),
    invariants: parseLogistics10kBaselineInvariants(
      requireRecord(value["invariants"], "logistics-10k"),
    ),
  };
}

function parseM1HaulingBuildingLongRunBaselineEntry(
  value: unknown,
): BenchmarkBaselineEntry<"m1-hauling-building-long-run"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry m1-hauling-building-long-run must be an object");
  }

  if (value["name"] !== "m1-hauling-building-long-run") {
    throw new Error(
      "benchmark baseline entry m1-hauling-building-long-run must declare the same name",
    );
  }

  return {
    name: "m1-hauling-building-long-run",
    medianElapsedMs: requireNumber(
      value["medianElapsedMs"],
      "m1-hauling-building-long-run.medianElapsedMs",
    ),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "m1-hauling-building-long-run.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "m1-hauling-building-long-run.failRegressionPercent",
    ),
    invariants: parseM1HaulingBuildingLongRunBaselineInvariants(
      requireRecord(value["invariants"], "m1-hauling-building-long-run"),
    ),
  };
}

function parseM2PathingInvalidationBaselineEntry(
  value: unknown,
): BenchmarkBaselineEntry<"m2-pathing-invalidation"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry m2-pathing-invalidation must be an object");
  }

  if (value["name"] !== "m2-pathing-invalidation") {
    throw new Error("benchmark baseline entry m2-pathing-invalidation must declare the same name");
  }

  return {
    name: "m2-pathing-invalidation",
    medianElapsedMs: requireNumber(
      value["medianElapsedMs"],
      "m2-pathing-invalidation.medianElapsedMs",
    ),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "m2-pathing-invalidation.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "m2-pathing-invalidation.failRegressionPercent",
    ),
    invariants: parseM2PathingInvalidationBaselineInvariants(
      requireRecord(value["invariants"], "m2-pathing-invalidation"),
    ),
  };
}

function parseM2WorkLogisticsLongRunBaselineEntry(
  value: unknown,
): BenchmarkBaselineEntry<"m2-work-logistics-long-run"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry m2-work-logistics-long-run must be an object");
  }

  if (value["name"] !== "m2-work-logistics-long-run") {
    throw new Error(
      "benchmark baseline entry m2-work-logistics-long-run must declare the same name",
    );
  }

  return {
    name: "m2-work-logistics-long-run",
    medianElapsedMs: requireNumber(
      value["medianElapsedMs"],
      "m2-work-logistics-long-run.medianElapsedMs",
    ),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "m2-work-logistics-long-run.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "m2-work-logistics-long-run.failRegressionPercent",
    ),
    invariants: parseM2WorkLogisticsLongRunBaselineInvariants(
      requireRecord(value["invariants"], "m2-work-logistics-long-run"),
    ),
  };
}

function parseM3OrdinaryLifeLongRunBaselineEntry(
  value: unknown,
): BenchmarkBaselineEntry<"m3-ordinary-life-long-run"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry m3-ordinary-life-long-run must be an object");
  }

  if (value["name"] !== "m3-ordinary-life-long-run") {
    throw new Error(
      "benchmark baseline entry m3-ordinary-life-long-run must declare the same name",
    );
  }

  return {
    name: "m3-ordinary-life-long-run",
    medianElapsedMs: requireNumber(
      value["medianElapsedMs"],
      "m3-ordinary-life-long-run.medianElapsedMs",
    ),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "m3-ordinary-life-long-run.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "m3-ordinary-life-long-run.failRegressionPercent",
    ),
    invariants: parseM3OrdinaryLifeLongRunBaselineInvariants(
      requireRecord(value["invariants"], "m3-ordinary-life-long-run"),
    ),
  };
}

function parseM4CoreVerticalSliceLongRunBaselineEntry(
  value: unknown,
): BenchmarkBaselineEntry<"m4-core-vertical-slice-long-run"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry m4-core-vertical-slice-long-run must be an object");
  }

  if (value["name"] !== "m4-core-vertical-slice-long-run") {
    throw new Error(
      "benchmark baseline entry m4-core-vertical-slice-long-run must declare the same name",
    );
  }

  return {
    name: "m4-core-vertical-slice-long-run",
    medianElapsedMs: requireNumber(
      value["medianElapsedMs"],
      "m4-core-vertical-slice-long-run.medianElapsedMs",
    ),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "m4-core-vertical-slice-long-run.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "m4-core-vertical-slice-long-run.failRegressionPercent",
    ),
    invariants: parseM4CoreVerticalSliceLongRunBaselineInvariants(
      requireRecord(value["invariants"], "m4-core-vertical-slice-long-run"),
    ),
  };
}

function parseM5AlphaContentLongRunBaselineEntry(
  value: unknown,
): BenchmarkBaselineEntry<"m5-alpha-content-long-run"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry m5-alpha-content-long-run must be an object");
  }

  if (value["name"] !== "m5-alpha-content-long-run") {
    throw new Error(
      "benchmark baseline entry m5-alpha-content-long-run must declare the same name",
    );
  }

  return {
    name: "m5-alpha-content-long-run",
    medianElapsedMs: requireNumber(
      value["medianElapsedMs"],
      "m5-alpha-content-long-run.medianElapsedMs",
    ),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "m5-alpha-content-long-run.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "m5-alpha-content-long-run.failRegressionPercent",
    ),
    invariants: parseM5AlphaContentLongRunBaselineInvariants(
      requireRecord(value["invariants"], "m5-alpha-content-long-run"),
    ),
  };
}

function parseMapDirtyBaselineEntry(value: unknown): BenchmarkBaselineEntry<"map-dirty"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry map-dirty must be an object");
  }

  if (value["name"] !== "map-dirty") {
    throw new Error("benchmark baseline entry map-dirty must declare the same name");
  }

  return {
    name: "map-dirty",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "map-dirty.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "map-dirty.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "map-dirty.failRegressionPercent",
    ),
    invariants: parseMapDirtyBaselineInvariants(requireRecord(value["invariants"], "map-dirty")),
  };
}

function parseReservationsBaselineEntry(value: unknown): BenchmarkBaselineEntry<"reservations"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry reservations must be an object");
  }

  if (value["name"] !== "reservations") {
    throw new Error("benchmark baseline entry reservations must declare the same name");
  }

  return {
    name: "reservations",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "reservations.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "reservations.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "reservations.failRegressionPercent",
    ),
    invariants: parseReservationsBaselineInvariants(
      requireRecord(value["invariants"], "reservations"),
    ),
  };
}

function parsePathing100BaselineEntry(value: unknown): BenchmarkBaselineEntry<"pathing-100"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry pathing-100 must be an object");
  }

  if (value["name"] !== "pathing-100") {
    throw new Error("benchmark baseline entry pathing-100 must declare the same name");
  }

  return {
    name: "pathing-100",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "pathing-100.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "pathing-100.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "pathing-100.failRegressionPercent",
    ),
    invariants: parsePathing100BaselineInvariants(
      requireRecord(value["invariants"], "pathing-100"),
    ),
  };
}

function parseRegionRoomBaselineEntry(value: unknown): BenchmarkBaselineEntry<"region-room"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry region-room must be an object");
  }

  if (value["name"] !== "region-room") {
    throw new Error("benchmark baseline entry region-room must declare the same name");
  }

  return {
    name: "region-room",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "region-room.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "region-room.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "region-room.failRegressionPercent",
    ),
    invariants: parseRegionRoomBaselineInvariants(
      requireRecord(value["invariants"], "region-room"),
    ),
  };
}

function parseSpatialIndexBaselineEntry(value: unknown): BenchmarkBaselineEntry<"spatial-index"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry spatial-index must be an object");
  }

  if (value["name"] !== "spatial-index") {
    throw new Error("benchmark baseline entry spatial-index must declare the same name");
  }

  return {
    name: "spatial-index",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "spatial-index.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "spatial-index.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "spatial-index.failRegressionPercent",
    ),
    invariants: parseSpatialIndexBaselineInvariants(
      requireRecord(value["invariants"], "spatial-index"),
    ),
  };
}

function parseWorkOffersBaselineEntry(value: unknown): BenchmarkBaselineEntry<"work-offers"> {
  if (!isRecord(value)) {
    throw new Error("benchmark baseline entry work-offers must be an object");
  }

  if (value["name"] !== "work-offers") {
    throw new Error("benchmark baseline entry work-offers must declare the same name");
  }

  return {
    name: "work-offers",
    medianElapsedMs: requireNumber(value["medianElapsedMs"], "work-offers.medianElapsedMs"),
    warnRegressionPercent: requireNumber(
      value["warnRegressionPercent"],
      "work-offers.warnRegressionPercent",
    ),
    failRegressionPercent: requireNumber(
      value["failRegressionPercent"],
      "work-offers.failRegressionPercent",
    ),
    invariants: parseWorkOffersBaselineInvariants(
      requireRecord(value["invariants"], "work-offers"),
    ),
  };
}

function parseEmptyTickBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"empty-tick">["invariants"] {
  return {
    requestedTicks: requireNumber(value["requestedTicks"], "empty-tick.requestedTicks"),
    advancedTicks: requireNumber(value["advancedTicks"], "empty-tick.advancedTicks"),
    finalTick: requireNumber(value["finalTick"], "empty-tick.finalTick"),
    commandHash: requireString(value["commandHash"], "empty-tick.commandHash"),
    worldHash: requireString(value["worldHash"], "empty-tick.worldHash"),
    randomStreamCount: requireNumber(value["randomStreamCount"], "empty-tick.randomStreamCount"),
  };
}

function parseEntityStoreBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"entity-store">["invariants"] {
  return {
    capacity: requireNumber(value["capacity"], "entity-store.capacity"),
    queuedCommands: requireNumber(value["queuedCommands"], "entity-store.queuedCommands"),
    commitResultCount: requireNumber(value["commitResultCount"], "entity-store.commitResultCount"),
    appliedCommands: requireNumber(value["appliedCommands"], "entity-store.appliedCommands"),
    failedCommands: requireNumber(value["failedCommands"], "entity-store.failedCommands"),
    attachedComponents: requireNumber(
      value["attachedComponents"],
      "entity-store.attachedComponents",
    ),
    iterationChecksum: requireNumber(value["iterationChecksum"], "entity-store.iterationChecksum"),
  };
}

function parseLogistics10kBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"logistics-10k">["invariants"] {
  return {
    sourceSlotCount: requireNumber(value["sourceSlotCount"], "logistics-10k.sourceSlotCount"),
    destinationSlotCount: requireNumber(
      value["destinationSlotCount"],
      "logistics-10k.destinationSlotCount",
    ),
    pawnCount: requireNumber(value["pawnCount"], "logistics-10k.pawnCount"),
    candidateCap: requireNumber(value["candidateCap"], "logistics-10k.candidateCap"),
    selectedCap: requireNumber(value["selectedCap"], "logistics-10k.selectedCap"),
    totalBucketCandidates: requireNumber(
      value["totalBucketCandidates"],
      "logistics-10k.totalBucketCandidates",
    ),
    visitedCandidates: requireNumber(value["visitedCandidates"], "logistics-10k.visitedCandidates"),
    selectedOffers: requireNumber(value["selectedOffers"], "logistics-10k.selectedOffers"),
    candidateCapHits: requireNumber(value["candidateCapHits"], "logistics-10k.candidateCapHits"),
    haulingJobs: requireNumber(value["haulingJobs"], "logistics-10k.haulingJobs"),
    deliveredJobs: requireNumber(value["deliveredJobs"], "logistics-10k.deliveredJobs"),
    finalActiveClaims: requireNumber(value["finalActiveClaims"], "logistics-10k.finalActiveClaims"),
    initialQuantity: requireNumber(value["initialQuantity"], "logistics-10k.initialQuantity"),
    finalQuantity: requireNumber(value["finalQuantity"], "logistics-10k.finalQuantity"),
    activeSupplySlots: requireNumber(value["activeSupplySlots"], "logistics-10k.activeSupplySlots"),
    activeDemandSlots: requireNumber(value["activeDemandSlots"], "logistics-10k.activeDemandSlots"),
    dirtyBacklog: requireNumber(value["dirtyBacklog"], "logistics-10k.dirtyBacklog"),
    selectionChecksum: requireNumber(value["selectionChecksum"], "logistics-10k.selectionChecksum"),
    quantityChecksum: requireNumber(value["quantityChecksum"], "logistics-10k.quantityChecksum"),
  };
}

function parseM1HaulingBuildingLongRunBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"m1-hauling-building-long-run">["invariants"] {
  return {
    scenarioId: requireString(value["scenarioId"], "m1-hauling-building-long-run.scenarioId"),
    scenarioSeed: requireString(value["scenarioSeed"], "m1-hauling-building-long-run.scenarioSeed"),
    finalTick: requireNumber(value["finalTick"], "m1-hauling-building-long-run.finalTick"),
    saveTick: requireNumber(value["saveTick"], "m1-hauling-building-long-run.saveTick"),
    completedBuildingCount: requireNumber(
      value["completedBuildingCount"],
      "m1-hauling-building-long-run.completedBuildingCount",
    ),
    idleSampleCount: requireNumber(
      value["idleSampleCount"],
      "m1-hauling-building-long-run.idleSampleCount",
    ),
    idleFirstSampleTick: requireNumber(
      value["idleFirstSampleTick"],
      "m1-hauling-building-long-run.idleFirstSampleTick",
    ),
    idleLastSampleTick: requireNumber(
      value["idleLastSampleTick"],
      "m1-hauling-building-long-run.idleLastSampleTick",
    ),
    idleStateHashStable: requireBoolean(
      value["idleStateHashStable"],
      "m1-hauling-building-long-run.idleStateHashStable",
    ),
    idleMaxDemandOfferCount: requireNumber(
      value["idleMaxDemandOfferCount"],
      "m1-hauling-building-long-run.idleMaxDemandOfferCount",
    ),
    idleMaxBuildOfferCount: requireNumber(
      value["idleMaxBuildOfferCount"],
      "m1-hauling-building-long-run.idleMaxBuildOfferCount",
    ),
    idleMaxActiveOfferCount: requireNumber(
      value["idleMaxActiveOfferCount"],
      "m1-hauling-building-long-run.idleMaxActiveOfferCount",
    ),
    idleMaxActiveReservationCount: requireNumber(
      value["idleMaxActiveReservationCount"],
      "m1-hauling-building-long-run.idleMaxActiveReservationCount",
    ),
    idleMaxRunningJobCount: requireNumber(
      value["idleMaxRunningJobCount"],
      "m1-hauling-building-long-run.idleMaxRunningJobCount",
    ),
    finalWorldHash: requireString(
      value["finalWorldHash"],
      "m1-hauling-building-long-run.finalWorldHash",
    ),
    finalReadModelHash: requireString(
      value["finalReadModelHash"],
      "m1-hauling-building-long-run.finalReadModelHash",
    ),
    replayMatches: requireBoolean(
      value["replayMatches"],
      "m1-hauling-building-long-run.replayMatches",
    ),
    saveRoundTripMatches: requireBoolean(
      value["saveRoundTripMatches"],
      "m1-hauling-building-long-run.saveRoundTripMatches",
    ),
    noReservationLeaks: requireBoolean(
      value["noReservationLeaks"],
      "m1-hauling-building-long-run.noReservationLeaks",
    ),
    noStaleEntityReferences: requireBoolean(
      value["noStaleEntityReferences"],
      "m1-hauling-building-long-run.noStaleEntityReferences",
    ),
    noNegativeResources: requireBoolean(
      value["noNegativeResources"],
      "m1-hauling-building-long-run.noNegativeResources",
    ),
    noQueueGrowth: requireBoolean(
      value["noQueueGrowth"],
      "m1-hauling-building-long-run.noQueueGrowth",
    ),
    noHashDivergence: requireBoolean(
      value["noHashDivergence"],
      "m1-hauling-building-long-run.noHashDivergence",
    ),
    materialConserved: requireBoolean(
      value["materialConserved"],
      "m1-hauling-building-long-run.materialConserved",
    ),
  };
}

function parseM2PathingInvalidationBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"m2-pathing-invalidation">["invariants"] {
  return {
    scenarioId: requireString(value["scenarioId"], "m2-pathing-invalidation.scenarioId"),
    scenarioSeed: requireString(value["scenarioSeed"], "m2-pathing-invalidation.scenarioSeed"),
    width: requireNumber(value["width"], "m2-pathing-invalidation.width"),
    height: requireNumber(value["height"], "m2-pathing-invalidation.height"),
    requestCount: requireNumber(value["requestCount"], "m2-pathing-invalidation.requestCount"),
    staleProbeCount: requireNumber(
      value["staleProbeCount"],
      "m2-pathing-invalidation.staleProbeCount",
    ),
    processedRequests: requireNumber(
      value["processedRequests"],
      "m2-pathing-invalidation.processedRequests",
    ),
    acceptedResults: requireNumber(
      value["acceptedResults"],
      "m2-pathing-invalidation.acceptedResults",
    ),
    staleRejectedResults: requireNumber(
      value["staleRejectedResults"],
      "m2-pathing-invalidation.staleRejectedResults",
    ),
    reachedPaths: requireNumber(value["reachedPaths"], "m2-pathing-invalidation.reachedPaths"),
    nodeExpansions: requireNumber(
      value["nodeExpansions"],
      "m2-pathing-invalidation.nodeExpansions",
    ),
    queueBacklogPeak: requireNumber(
      value["queueBacklogPeak"],
      "m2-pathing-invalidation.queueBacklogPeak",
    ),
    finalQueueBacklog: requireNumber(
      value["finalQueueBacklog"],
      "m2-pathing-invalidation.finalQueueBacklog",
    ),
    pathChecksum: requireNumber(value["pathChecksum"], "m2-pathing-invalidation.pathChecksum"),
  };
}

function parseM2WorkLogisticsLongRunBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"m2-work-logistics-long-run">["invariants"] {
  return {
    scenarioId: requireString(value["scenarioId"], "m2-work-logistics-long-run.scenarioId"),
    scenarioSeed: requireString(value["scenarioSeed"], "m2-work-logistics-long-run.scenarioSeed"),
    finalTick: requireNumber(value["finalTick"], "m2-work-logistics-long-run.finalTick"),
    saveTick: requireNumber(value["saveTick"], "m2-work-logistics-long-run.saveTick"),
    actorCount: requireNumber(value["actorCount"], "m2-work-logistics-long-run.actorCount"),
    completedBuildOrders: requireNumber(
      value["completedBuildOrders"],
      "m2-work-logistics-long-run.completedBuildOrders",
    ),
    deliveredWood: requireNumber(
      value["deliveredWood"],
      "m2-work-logistics-long-run.deliveredWood",
    ),
    deliveredStone: requireNumber(
      value["deliveredStone"],
      "m2-work-logistics-long-run.deliveredStone",
    ),
    buildProgressTotal: requireNumber(
      value["buildProgressTotal"],
      "m2-work-logistics-long-run.buildProgressTotal",
    ),
    materialDeliveryJobsCreated: requireNumber(
      value["materialDeliveryJobsCreated"],
      "m2-work-logistics-long-run.materialDeliveryJobsCreated",
    ),
    materialDeliveryJobsCompleted: requireNumber(
      value["materialDeliveryJobsCompleted"],
      "m2-work-logistics-long-run.materialDeliveryJobsCompleted",
    ),
    buildJobsCreated: requireNumber(
      value["buildJobsCreated"],
      "m2-work-logistics-long-run.buildJobsCreated",
    ),
    buildJobsCompleted: requireNumber(
      value["buildJobsCompleted"],
      "m2-work-logistics-long-run.buildJobsCompleted",
    ),
    demandOfferPeak: requireNumber(
      value["demandOfferPeak"],
      "m2-work-logistics-long-run.demandOfferPeak",
    ),
    buildOfferPeak: requireNumber(
      value["buildOfferPeak"],
      "m2-work-logistics-long-run.buildOfferPeak",
    ),
    actorsUsed: requireNumber(value["actorsUsed"], "m2-work-logistics-long-run.actorsUsed"),
    terminalSampleCount: requireNumber(
      value["terminalSampleCount"],
      "m2-work-logistics-long-run.terminalSampleCount",
    ),
    terminalFirstSampleTick: requireNumber(
      value["terminalFirstSampleTick"],
      "m2-work-logistics-long-run.terminalFirstSampleTick",
    ),
    terminalLastSampleTick: requireNumber(
      value["terminalLastSampleTick"],
      "m2-work-logistics-long-run.terminalLastSampleTick",
    ),
    terminalStateStable: requireBoolean(
      value["terminalStateStable"],
      "m2-work-logistics-long-run.terminalStateStable",
    ),
    terminalMaxActiveReservationCount: requireNumber(
      value["terminalMaxActiveReservationCount"],
      "m2-work-logistics-long-run.terminalMaxActiveReservationCount",
    ),
    terminalMaxActiveOfferCount: requireNumber(
      value["terminalMaxActiveOfferCount"],
      "m2-work-logistics-long-run.terminalMaxActiveOfferCount",
    ),
    terminalMaxRunningJobCount: requireNumber(
      value["terminalMaxRunningJobCount"],
      "m2-work-logistics-long-run.terminalMaxRunningJobCount",
    ),
    finalWorldHash: requireString(
      value["finalWorldHash"],
      "m2-work-logistics-long-run.finalWorldHash",
    ),
    finalReadModelHash: requireString(
      value["finalReadModelHash"],
      "m2-work-logistics-long-run.finalReadModelHash",
    ),
    replayMatches: requireBoolean(
      value["replayMatches"],
      "m2-work-logistics-long-run.replayMatches",
    ),
    saveRoundTripMatches: requireBoolean(
      value["saveRoundTripMatches"],
      "m2-work-logistics-long-run.saveRoundTripMatches",
    ),
    noReservationLeaks: requireBoolean(
      value["noReservationLeaks"],
      "m2-work-logistics-long-run.noReservationLeaks",
    ),
    noStaleOffers: requireBoolean(
      value["noStaleOffers"],
      "m2-work-logistics-long-run.noStaleOffers",
    ),
    noNegativeResources: requireBoolean(
      value["noNegativeResources"],
      "m2-work-logistics-long-run.noNegativeResources",
    ),
    noQueueGrowth: requireBoolean(
      value["noQueueGrowth"],
      "m2-work-logistics-long-run.noQueueGrowth",
    ),
    noHashDivergence: requireBoolean(
      value["noHashDivergence"],
      "m2-work-logistics-long-run.noHashDivergence",
    ),
    materialConserved: requireBoolean(
      value["materialConserved"],
      "m2-work-logistics-long-run.materialConserved",
    ),
  };
}

function parseM3OrdinaryLifeLongRunBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"m3-ordinary-life-long-run">["invariants"] {
  return {
    scenarioId: requireString(value["scenarioId"], "m3-ordinary-life-long-run.scenarioId"),
    scenarioSeed: requireString(value["scenarioSeed"], "m3-ordinary-life-long-run.scenarioSeed"),
    requestedSeed: requireString(value["requestedSeed"], "m3-ordinary-life-long-run.requestedSeed"),
    finalTick: requireNumber(value["finalTick"], "m3-ordinary-life-long-run.finalTick"),
    saveTick: requireNumber(value["saveTick"], "m3-ordinary-life-long-run.saveTick"),
    loadTick: requireNumber(value["loadTick"], "m3-ordinary-life-long-run.loadTick"),
    tickRate: requireNumber(value["tickRate"], "m3-ordinary-life-long-run.tickRate"),
    checkpointCount: requireNumber(
      value["checkpointCount"],
      "m3-ordinary-life-long-run.checkpointCount",
    ),
    commandStreamHash: requireString(
      value["commandStreamHash"],
      "m3-ordinary-life-long-run.commandStreamHash",
    ),
    contentHash: requireString(value["contentHash"], "m3-ordinary-life-long-run.contentHash"),
    finalWorldHash: requireString(
      value["finalWorldHash"],
      "m3-ordinary-life-long-run.finalWorldHash",
    ),
    finalReadModelHash: requireString(
      value["finalReadModelHash"],
      "m3-ordinary-life-long-run.finalReadModelHash",
    ),
    needUpdateCount: requireNumber(
      value["needUpdateCount"],
      "m3-ordinary-life-long-run.needUpdateCount",
    ),
    conditionUpdateCount: requireNumber(
      value["conditionUpdateCount"],
      "m3-ordinary-life-long-run.conditionUpdateCount",
    ),
    abilityCacheInvalidationCount: requireNumber(
      value["abilityCacheInvalidationCount"],
      "m3-ordinary-life-long-run.abilityCacheInvalidationCount",
    ),
    thoughtEventCount: requireNumber(
      value["thoughtEventCount"],
      "m3-ordinary-life-long-run.thoughtEventCount",
    ),
    socialEventCount: requireNumber(
      value["socialEventCount"],
      "m3-ordinary-life-long-run.socialEventCount",
    ),
    actorThinkPasses: requireNumber(
      value["actorThinkPasses"],
      "m3-ordinary-life-long-run.actorThinkPasses",
    ),
    totalCandidateVisitedCount: requireNumber(
      value["totalCandidateVisitedCount"],
      "m3-ordinary-life-long-run.totalCandidateVisitedCount",
    ),
    boundedCandidateCapHits: requireNumber(
      value["boundedCandidateCapHits"],
      "m3-ordinary-life-long-run.boundedCandidateCapHits",
    ),
    exactPathRequests: requireNumber(
      value["exactPathRequests"],
      "m3-ordinary-life-long-run.exactPathRequests",
    ),
    pathNodeCount: requireNumber(value["pathNodeCount"], "m3-ordinary-life-long-run.pathNodeCount"),
    reservationCleanupActiveCount: requireNumber(
      value["reservationCleanupActiveCount"],
      "m3-ordinary-life-long-run.reservationCleanupActiveCount",
    ),
    saveLoadRebuiltSurfaceCount: requireNumber(
      value["saveLoadRebuiltSurfaceCount"],
      "m3-ordinary-life-long-run.saveLoadRebuiltSurfaceCount",
    ),
    workerRenderSnapshotBytes: requireNumber(
      value["workerRenderSnapshotBytes"],
      "m3-ordinary-life-long-run.workerRenderSnapshotBytes",
    ),
    workerScenarioReadModelBytes: requireNumber(
      value["workerScenarioReadModelBytes"],
      "m3-ordinary-life-long-run.workerScenarioReadModelBytes",
    ),
    workerProjectionBytes: requireNumber(
      value["workerProjectionBytes"],
      "m3-ordinary-life-long-run.workerProjectionBytes",
    ),
    terminalSampleCount: requireNumber(
      value["terminalSampleCount"],
      "m3-ordinary-life-long-run.terminalSampleCount",
    ),
    terminalFirstSampleTick: requireNumber(
      value["terminalFirstSampleTick"],
      "m3-ordinary-life-long-run.terminalFirstSampleTick",
    ),
    terminalLastSampleTick: requireNumber(
      value["terminalLastSampleTick"],
      "m3-ordinary-life-long-run.terminalLastSampleTick",
    ),
    maxQueueBacklog: requireNumber(
      value["maxQueueBacklog"],
      "m3-ordinary-life-long-run.maxQueueBacklog",
    ),
    maxActiveReservationCount: requireNumber(
      value["maxActiveReservationCount"],
      "m3-ordinary-life-long-run.maxActiveReservationCount",
    ),
    maxRunningJobCount: requireNumber(
      value["maxRunningJobCount"],
      "m3-ordinary-life-long-run.maxRunningJobCount",
    ),
    finalWeather: requireString(value["finalWeather"], "m3-ordinary-life-long-run.finalWeather"),
    finalScheduleWindow: requireString(
      value["finalScheduleWindow"],
      "m3-ordinary-life-long-run.finalScheduleWindow",
    ),
    yaoMovementAfterInjury: requireNumber(
      value["yaoMovementAfterInjury"],
      "m3-ordinary-life-long-run.yaoMovementAfterInjury",
    ),
    yaoMovementAfterTreatment: requireNumber(
      value["yaoMovementAfterTreatment"],
      "m3-ordinary-life-long-run.yaoMovementAfterTreatment",
    ),
    yaoSprainSeverity: requireNumber(
      value["yaoSprainSeverity"],
      "m3-ordinary-life-long-run.yaoSprainSeverity",
    ),
    yaoMoodValence: requireNumber(
      value["yaoMoodValence"],
      "m3-ordinary-life-long-run.yaoMoodValence",
    ),
    yaoMoodTension: requireNumber(
      value["yaoMoodTension"],
      "m3-ordinary-life-long-run.yaoMoodTension",
    ),
    linMoodValence: requireNumber(
      value["linMoodValence"],
      "m3-ordinary-life-long-run.linMoodValence",
    ),
    minMoodValence: requireNumber(
      value["minMoodValence"],
      "m3-ordinary-life-long-run.minMoodValence",
    ),
    yaoMinGratitude: requireNumber(
      value["yaoMinGratitude"],
      "m3-ordinary-life-long-run.yaoMinGratitude",
    ),
    yaoLinCare: requireNumber(value["yaoLinCare"], "m3-ordinary-life-long-run.yaoLinCare"),
    treatmentCompletedCount: requireNumber(
      value["treatmentCompletedCount"],
      "m3-ordinary-life-long-run.treatmentCompletedCount",
    ),
    activeMedicalRequests: requireNumber(
      value["activeMedicalRequests"],
      "m3-ordinary-life-long-run.activeMedicalRequests",
    ),
    staleMedicalOfferRejectCount: requireNumber(
      value["staleMedicalOfferRejectCount"],
      "m3-ordinary-life-long-run.staleMedicalOfferRejectCount",
    ),
    grainBowlQuantity: requireNumber(
      value["grainBowlQuantity"],
      "m3-ordinary-life-long-run.grainBowlQuantity",
    ),
    bandageQuantity: requireNumber(
      value["bandageQuantity"],
      "m3-ordinary-life-long-run.bandageQuantity",
    ),
    replayMatches: requireBoolean(
      value["replayMatches"],
      "m3-ordinary-life-long-run.replayMatches",
    ),
    saveRoundTripMatches: requireBoolean(
      value["saveRoundTripMatches"],
      "m3-ordinary-life-long-run.saveRoundTripMatches",
    ),
    noReservationLeaks: requireBoolean(
      value["noReservationLeaks"],
      "m3-ordinary-life-long-run.noReservationLeaks",
    ),
    noStaleOffers: requireBoolean(
      value["noStaleOffers"],
      "m3-ordinary-life-long-run.noStaleOffers",
    ),
    noRunningJobLeaks: requireBoolean(
      value["noRunningJobLeaks"],
      "m3-ordinary-life-long-run.noRunningJobLeaks",
    ),
    noNegativeNeedsResources: requireBoolean(
      value["noNegativeNeedsResources"],
      "m3-ordinary-life-long-run.noNegativeNeedsResources",
    ),
    noAbilityCacheDivergence: requireBoolean(
      value["noAbilityCacheDivergence"],
      "m3-ordinary-life-long-run.noAbilityCacheDivergence",
    ),
    noConditionDrift: requireBoolean(
      value["noConditionDrift"],
      "m3-ordinary-life-long-run.noConditionDrift",
    ),
    noMoodRelationshipDrift: requireBoolean(
      value["noMoodRelationshipDrift"],
      "m3-ordinary-life-long-run.noMoodRelationshipDrift",
    ),
    noQueueGrowth: requireBoolean(
      value["noQueueGrowth"],
      "m3-ordinary-life-long-run.noQueueGrowth",
    ),
    noHashDivergence: requireBoolean(
      value["noHashDivergence"],
      "m3-ordinary-life-long-run.noHashDivergence",
    ),
    noM4Facts: requireBoolean(value["noM4Facts"], "m3-ordinary-life-long-run.noM4Facts"),
    itemConserved: requireBoolean(
      value["itemConserved"],
      "m3-ordinary-life-long-run.itemConserved",
    ),
    medicalStockConserved: requireBoolean(
      value["medicalStockConserved"],
      "m3-ordinary-life-long-run.medicalStockConserved",
    ),
  };
}

function parseM4CoreVerticalSliceLongRunBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"m4-core-vertical-slice-long-run">["invariants"] {
  return {
    scenarioId: requireString(value["scenarioId"], "m4-core-vertical-slice-long-run.scenarioId"),
    scenarioSeed: requireString(
      value["scenarioSeed"],
      "m4-core-vertical-slice-long-run.scenarioSeed",
    ),
    requestedSeed: requireString(
      value["requestedSeed"],
      "m4-core-vertical-slice-long-run.requestedSeed",
    ),
    finalTick: requireNumber(value["finalTick"], "m4-core-vertical-slice-long-run.finalTick"),
    saveTick: requireNumber(value["saveTick"], "m4-core-vertical-slice-long-run.saveTick"),
    loadTick: requireNumber(value["loadTick"], "m4-core-vertical-slice-long-run.loadTick"),
    tickRate: requireNumber(value["tickRate"], "m4-core-vertical-slice-long-run.tickRate"),
    checkpointCount: requireNumber(
      value["checkpointCount"],
      "m4-core-vertical-slice-long-run.checkpointCount",
    ),
    commandStreamHash: requireString(
      value["commandStreamHash"],
      "m4-core-vertical-slice-long-run.commandStreamHash",
    ),
    contentHash: requireString(value["contentHash"], "m4-core-vertical-slice-long-run.contentHash"),
    finalWorldHash: requireString(
      value["finalWorldHash"],
      "m4-core-vertical-slice-long-run.finalWorldHash",
    ),
    finalReadModelHash: requireString(
      value["finalReadModelHash"],
      "m4-core-vertical-slice-long-run.finalReadModelHash",
    ),
    lampDirtyBacklogPeak: requireNumber(
      value["lampDirtyBacklogPeak"],
      "m4-core-vertical-slice-long-run.lampDirtyBacklogPeak",
    ),
    lampDirtyBacklogFinal: requireNumber(
      value["lampDirtyBacklogFinal"],
      "m4-core-vertical-slice-long-run.lampDirtyBacklogFinal",
    ),
    activeGapCount: requireNumber(
      value["activeGapCount"],
      "m4-core-vertical-slice-long-run.activeGapCount",
    ),
    evidenceSupportCandidateVisits: requireNumber(
      value["evidenceSupportCandidateVisits"],
      "m4-core-vertical-slice-long-run.evidenceSupportCandidateVisits",
    ),
    evidenceConfirmedRuleCount: requireNumber(
      value["evidenceConfirmedRuleCount"],
      "m4-core-vertical-slice-long-run.evidenceConfirmedRuleCount",
    ),
    disseminationDirtyBacklogFinal: requireNumber(
      value["disseminationDirtyBacklogFinal"],
      "m4-core-vertical-slice-long-run.disseminationDirtyBacklogFinal",
    ),
    obligationDueIndexedCount: requireNumber(
      value["obligationDueIndexedCount"],
      "m4-core-vertical-slice-long-run.obligationDueIndexedCount",
    ),
    obligationViolatedCount: requireNumber(
      value["obligationViolatedCount"],
      "m4-core-vertical-slice-long-run.obligationViolatedCount",
    ),
    townRuleComplianceCandidateVisits: requireNumber(
      value["townRuleComplianceCandidateVisits"],
      "m4-core-vertical-slice-long-run.townRuleComplianceCandidateVisits",
    ),
    crisisTransitionCount: requireNumber(
      value["crisisTransitionCount"],
      "m4-core-vertical-slice-long-run.crisisTransitionCount",
    ),
    directorCandidateVisits: requireNumber(
      value["directorCandidateVisits"],
      "m4-core-vertical-slice-long-run.directorCandidateVisits",
    ),
    directorRecoveryWindowCount: requireNumber(
      value["directorRecoveryWindowCount"],
      "m4-core-vertical-slice-long-run.directorRecoveryWindowCount",
    ),
    reasonTraceCapacity: requireNumber(
      value["reasonTraceCapacity"],
      "m4-core-vertical-slice-long-run.reasonTraceCapacity",
    ),
    reasonTraceStoredCount: requireNumber(
      value["reasonTraceStoredCount"],
      "m4-core-vertical-slice-long-run.reasonTraceStoredCount",
    ),
    saveLoadRebuiltSurfaceCount: requireNumber(
      value["saveLoadRebuiltSurfaceCount"],
      "m4-core-vertical-slice-long-run.saveLoadRebuiltSurfaceCount",
    ),
    workerRenderSnapshotBytes: requireNumber(
      value["workerRenderSnapshotBytes"],
      "m4-core-vertical-slice-long-run.workerRenderSnapshotBytes",
    ),
    workerScenarioReadModelBytes: requireNumber(
      value["workerScenarioReadModelBytes"],
      "m4-core-vertical-slice-long-run.workerScenarioReadModelBytes",
    ),
    workerProjectionBytes: requireNumber(
      value["workerProjectionBytes"],
      "m4-core-vertical-slice-long-run.workerProjectionBytes",
    ),
    terminalSampleCount: requireNumber(
      value["terminalSampleCount"],
      "m4-core-vertical-slice-long-run.terminalSampleCount",
    ),
    terminalFirstSampleTick: requireNumber(
      value["terminalFirstSampleTick"],
      "m4-core-vertical-slice-long-run.terminalFirstSampleTick",
    ),
    terminalLastSampleTick: requireNumber(
      value["terminalLastSampleTick"],
      "m4-core-vertical-slice-long-run.terminalLastSampleTick",
    ),
    replayMatches: requireBoolean(
      value["replayMatches"],
      "m4-core-vertical-slice-long-run.replayMatches",
    ),
    saveRoundTripMatches: requireBoolean(
      value["saveRoundTripMatches"],
      "m4-core-vertical-slice-long-run.saveRoundTripMatches",
    ),
    workerProjectionMatches: requireBoolean(
      value["workerProjectionMatches"],
      "m4-core-vertical-slice-long-run.workerProjectionMatches",
    ),
    noLampDirtyBacklogGrowth: requireBoolean(
      value["noLampDirtyBacklogGrowth"],
      "m4-core-vertical-slice-long-run.noLampDirtyBacklogGrowth",
    ),
    noEvidenceDrift: requireBoolean(
      value["noEvidenceDrift"],
      "m4-core-vertical-slice-long-run.noEvidenceDrift",
    ),
    noDisseminationBacklogGrowth: requireBoolean(
      value["noDisseminationBacklogGrowth"],
      "m4-core-vertical-slice-long-run.noDisseminationBacklogGrowth",
    ),
    noObligationLeaks: requireBoolean(
      value["noObligationLeaks"],
      "m4-core-vertical-slice-long-run.noObligationLeaks",
    ),
    noInvalidCrisisTransitions: requireBoolean(
      value["noInvalidCrisisTransitions"],
      "m4-core-vertical-slice-long-run.noInvalidCrisisTransitions",
    ),
    noDirectorRecoveryWindowViolation: requireBoolean(
      value["noDirectorRecoveryWindowViolation"],
      "m4-core-vertical-slice-long-run.noDirectorRecoveryWindowViolation",
    ),
    noReasonTraceOverflow: requireBoolean(
      value["noReasonTraceOverflow"],
      "m4-core-vertical-slice-long-run.noReasonTraceOverflow",
    ),
    noM0ToM3Regression: requireBoolean(
      value["noM0ToM3Regression"],
      "m4-core-vertical-slice-long-run.noM0ToM3Regression",
    ),
    noQueueGrowth: requireBoolean(
      value["noQueueGrowth"],
      "m4-core-vertical-slice-long-run.noQueueGrowth",
    ),
    noHashDivergence: requireBoolean(
      value["noHashDivergence"],
      "m4-core-vertical-slice-long-run.noHashDivergence",
    ),
  };
}

function parseM5AlphaContentLongRunBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"m5-alpha-content-long-run">["invariants"] {
  return {
    scenarioId: requireString(value["scenarioId"], "m5-alpha-content-long-run.scenarioId"),
    scenarioSeed: requireString(value["scenarioSeed"], "m5-alpha-content-long-run.scenarioSeed"),
    requestedSeed: requireString(value["requestedSeed"], "m5-alpha-content-long-run.requestedSeed"),
    finalTick: requireNumber(value["finalTick"], "m5-alpha-content-long-run.finalTick"),
    saveTick: requireNumber(value["saveTick"], "m5-alpha-content-long-run.saveTick"),
    loadTick: requireNumber(value["loadTick"], "m5-alpha-content-long-run.loadTick"),
    tickRate: requireNumber(value["tickRate"], "m5-alpha-content-long-run.tickRate"),
    checkpointCount: requireNumber(
      value["checkpointCount"],
      "m5-alpha-content-long-run.checkpointCount",
    ),
    commandStreamHash: requireString(
      value["commandStreamHash"],
      "m5-alpha-content-long-run.commandStreamHash",
    ),
    contentManifestHash: requireString(
      value["contentManifestHash"],
      "m5-alpha-content-long-run.contentManifestHash",
    ),
    finalWorldHash: requireString(
      value["finalWorldHash"],
      "m5-alpha-content-long-run.finalWorldHash",
    ),
    finalReadModelHash: requireString(
      value["finalReadModelHash"],
      "m5-alpha-content-long-run.finalReadModelHash",
    ),
    contentDefinitionCount: requireNumber(
      value["contentDefinitionCount"],
      "m5-alpha-content-long-run.contentDefinitionCount",
    ),
    catalogEntryCount: requireNumber(
      value["catalogEntryCount"],
      "m5-alpha-content-long-run.catalogEntryCount",
    ),
    contentValidationFailureCount: requireNumber(
      value["contentValidationFailureCount"],
      "m5-alpha-content-long-run.contentValidationFailureCount",
    ),
    anomalyDefinitionCount: requireNumber(
      value["anomalyDefinitionCount"],
      "m5-alpha-content-long-run.anomalyDefinitionCount",
    ),
    anomalyActivationCandidateVisits: requireNumber(
      value["anomalyActivationCandidateVisits"],
      "m5-alpha-content-long-run.anomalyActivationCandidateVisits",
    ),
    anomalyTransitionCount: requireNumber(
      value["anomalyTransitionCount"],
      "m5-alpha-content-long-run.anomalyTransitionCount",
    ),
    thirdKnockResolvedCount: requireNumber(
      value["thirdKnockResolvedCount"],
      "m5-alpha-content-long-run.thirdKnockResolvedCount",
    ),
    oldBridgeResolvedCount: requireNumber(
      value["oldBridgeResolvedCount"],
      "m5-alpha-content-long-run.oldBridgeResolvedCount",
    ),
    factionCandidateVisits: requireNumber(
      value["factionCandidateVisits"],
      "m5-alpha-content-long-run.factionCandidateVisits",
    ),
    governanceCandidateVisits: requireNumber(
      value["governanceCandidateVisits"],
      "m5-alpha-content-long-run.governanceCandidateVisits",
    ),
    factionSelectedFactCount: requireNumber(
      value["factionSelectedFactCount"],
      "m5-alpha-content-long-run.factionSelectedFactCount",
    ),
    governanceSelectedHookCount: requireNumber(
      value["governanceSelectedHookCount"],
      "m5-alpha-content-long-run.governanceSelectedHookCount",
    ),
    eventPoolCandidateCount: requireNumber(
      value["eventPoolCandidateCount"],
      "m5-alpha-content-long-run.eventPoolCandidateCount",
    ),
    eventTransitionCount: requireNumber(
      value["eventTransitionCount"],
      "m5-alpha-content-long-run.eventTransitionCount",
    ),
    eventCooldownWriteCount: requireNumber(
      value["eventCooldownWriteCount"],
      "m5-alpha-content-long-run.eventCooldownWriteCount",
    ),
    eventPreconditionFailureCount: requireNumber(
      value["eventPreconditionFailureCount"],
      "m5-alpha-content-long-run.eventPreconditionFailureCount",
    ),
    saveLoadRebuiltSurfaceCount: requireNumber(
      value["saveLoadRebuiltSurfaceCount"],
      "m5-alpha-content-long-run.saveLoadRebuiltSurfaceCount",
    ),
    workerProjectionBytes: requireNumber(
      value["workerProjectionBytes"],
      "m5-alpha-content-long-run.workerProjectionBytes",
    ),
    workerProjectionSurfaceCount: requireNumber(
      value["workerProjectionSurfaceCount"],
      "m5-alpha-content-long-run.workerProjectionSurfaceCount",
    ),
    workerProjectionHash: requireString(
      value["workerProjectionHash"],
      "m5-alpha-content-long-run.workerProjectionHash",
    ),
    workerReadModelHash: requireString(
      value["workerReadModelHash"],
      "m5-alpha-content-long-run.workerReadModelHash",
    ),
    terminalSampleCount: requireNumber(
      value["terminalSampleCount"],
      "m5-alpha-content-long-run.terminalSampleCount",
    ),
    terminalFirstSampleTick: requireNumber(
      value["terminalFirstSampleTick"],
      "m5-alpha-content-long-run.terminalFirstSampleTick",
    ),
    terminalLastSampleTick: requireNumber(
      value["terminalLastSampleTick"],
      "m5-alpha-content-long-run.terminalLastSampleTick",
    ),
    replayMatches: requireBoolean(
      value["replayMatches"],
      "m5-alpha-content-long-run.replayMatches",
    ),
    saveRoundTripMatches: requireBoolean(
      value["saveRoundTripMatches"],
      "m5-alpha-content-long-run.saveRoundTripMatches",
    ),
    workerProjectionMatches: requireBoolean(
      value["workerProjectionMatches"],
      "m5-alpha-content-long-run.workerProjectionMatches",
    ),
    noContentValidationDrift: requireBoolean(
      value["noContentValidationDrift"],
      "m5-alpha-content-long-run.noContentValidationDrift",
    ),
    noAnomalyLeaks: requireBoolean(
      value["noAnomalyLeaks"],
      "m5-alpha-content-long-run.noAnomalyLeaks",
    ),
    noFactionGovernanceHiddenAuthority: requireBoolean(
      value["noFactionGovernanceHiddenAuthority"],
      "m5-alpha-content-long-run.noFactionGovernanceHiddenAuthority",
    ),
    noEventQueueGrowth: requireBoolean(
      value["noEventQueueGrowth"],
      "m5-alpha-content-long-run.noEventQueueGrowth",
    ),
    noM0ToM4Regression: requireBoolean(
      value["noM0ToM4Regression"],
      "m5-alpha-content-long-run.noM0ToM4Regression",
    ),
    noQueueGrowth: requireBoolean(
      value["noQueueGrowth"],
      "m5-alpha-content-long-run.noQueueGrowth",
    ),
    noHashDivergence: requireBoolean(
      value["noHashDivergence"],
      "m5-alpha-content-long-run.noHashDivergence",
    ),
    m6StopSignVerdict: requireString(
      value["m6StopSignVerdict"],
      "m5-alpha-content-long-run.m6StopSignVerdict",
    ),
    m6Created: requireBoolean(value["m6Created"], "m5-alpha-content-long-run.m6Created"),
  };
}

function parseMapDirtyBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"map-dirty">["invariants"] {
  return {
    width: requireNumber(value["width"], "map-dirty.width"),
    height: requireNumber(value["height"], "map-dirty.height"),
    chunkSize: requireNumber(value["chunkSize"], "map-dirty.chunkSize"),
    changedCells: requireNumber(value["changedCells"], "map-dirty.changedCells"),
    dirtyQueuePeak: requireNumber(value["dirtyQueuePeak"], "map-dirty.dirtyQueuePeak"),
    rebuildBudgetPerTick: requireNumber(
      value["rebuildBudgetPerTick"],
      "map-dirty.rebuildBudgetPerTick",
    ),
    drainTicks: requireNumber(value["drainTicks"], "map-dirty.drainTicks"),
    processedChunks: requireNumber(value["processedChunks"], "map-dirty.processedChunks"),
    remainingDirtyChunks: requireNumber(
      value["remainingDirtyChunks"],
      "map-dirty.remainingDirtyChunks",
    ),
    finalGlobalVersion: requireNumber(value["finalGlobalVersion"], "map-dirty.finalGlobalVersion"),
    processedChecksum: requireNumber(value["processedChecksum"], "map-dirty.processedChecksum"),
    mapHash: requireString(value["mapHash"], "map-dirty.mapHash"),
  };
}

function parseReservationsBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"reservations">["invariants"] {
  return {
    ownerCount: requireNumber(value["ownerCount"], "reservations.ownerCount"),
    itemTargetCount: requireNumber(value["itemTargetCount"], "reservations.itemTargetCount"),
    capacityTargetCount: requireNumber(
      value["capacityTargetCount"],
      "reservations.capacityTargetCount",
    ),
    transactionAttempts: requireNumber(
      value["transactionAttempts"],
      "reservations.transactionAttempts",
    ),
    acceptedTransactions: requireNumber(
      value["acceptedTransactions"],
      "reservations.acceptedTransactions",
    ),
    rejectedTransactions: requireNumber(
      value["rejectedTransactions"],
      "reservations.rejectedTransactions",
    ),
    releasedByCleanup: requireNumber(value["releasedByCleanup"], "reservations.releasedByCleanup"),
    finalActiveClaims: requireNumber(value["finalActiveClaims"], "reservations.finalActiveClaims"),
    conflictCount: requireNumber(value["conflictCount"], "reservations.conflictCount"),
    itemQuantityReservationCount: requireNumber(
      value["itemQuantityReservationCount"],
      "reservations.itemQuantityReservationCount",
    ),
    capacityReservationCount: requireNumber(
      value["capacityReservationCount"],
      "reservations.capacityReservationCount",
    ),
    transactionChecksum: requireNumber(
      value["transactionChecksum"],
      "reservations.transactionChecksum",
    ),
    cleanupChecksum: requireNumber(value["cleanupChecksum"], "reservations.cleanupChecksum"),
  };
}

function parsePathing100BaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"pathing-100">["invariants"] {
  return {
    width: requireNumber(value["width"], "pathing-100.width"),
    height: requireNumber(value["height"], "pathing-100.height"),
    requestCount: requireNumber(value["requestCount"], "pathing-100.requestCount"),
    staleProbeCount: requireNumber(value["staleProbeCount"], "pathing-100.staleProbeCount"),
    processedRequests: requireNumber(value["processedRequests"], "pathing-100.processedRequests"),
    acceptedResults: requireNumber(value["acceptedResults"], "pathing-100.acceptedResults"),
    staleRejectedResults: requireNumber(
      value["staleRejectedResults"],
      "pathing-100.staleRejectedResults",
    ),
    reachedPaths: requireNumber(value["reachedPaths"], "pathing-100.reachedPaths"),
    nodeExpansions: requireNumber(value["nodeExpansions"], "pathing-100.nodeExpansions"),
    queueBacklogPeak: requireNumber(value["queueBacklogPeak"], "pathing-100.queueBacklogPeak"),
    finalQueueBacklog: requireNumber(value["finalQueueBacklog"], "pathing-100.finalQueueBacklog"),
    pathChecksum: requireNumber(value["pathChecksum"], "pathing-100.pathChecksum"),
  };
}

function parseRegionRoomBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"region-room">["invariants"] {
  return {
    width: requireNumber(value["width"], "region-room.width"),
    height: requireNumber(value["height"], "region-room.height"),
    chunkSize: requireNumber(value["chunkSize"], "region-room.chunkSize"),
    changedEdges: requireNumber(value["changedEdges"], "region-room.changedEdges"),
    dirtyQueuePeak: requireNumber(value["dirtyQueuePeak"], "region-room.dirtyQueuePeak"),
    rebuildBudgetPerTick: requireNumber(
      value["rebuildBudgetPerTick"],
      "region-room.rebuildBudgetPerTick",
    ),
    drainTicks: requireNumber(value["drainTicks"], "region-room.drainTicks"),
    processedCells: requireNumber(value["processedCells"], "region-room.processedCells"),
    processedRegions: requireNumber(value["processedRegions"], "region-room.processedRegions"),
    mapUpdates: requireNumber(value["mapUpdates"], "region-room.mapUpdates"),
    remainingDirtyCells: requireNumber(
      value["remainingDirtyCells"],
      "region-room.remainingDirtyCells",
    ),
    activeCellBacklog: requireNumber(value["activeCellBacklog"], "region-room.activeCellBacklog"),
    noSustainedGrowth: requireBoolean(value["noSustainedGrowth"], "region-room.noSustainedGrowth"),
    navigationVersion: requireNumber(value["navigationVersion"], "region-room.navigationVersion"),
    regionVersion: requireNumber(value["regionVersion"], "region-room.regionVersion"),
    roomVersion: requireNumber(value["roomVersion"], "region-room.roomVersion"),
    regionGraphVersion: requireNumber(
      value["regionGraphVersion"],
      "region-room.regionGraphVersion",
    ),
    processedChecksum: requireNumber(value["processedChecksum"], "region-room.processedChecksum"),
    regionRoomHash: requireString(value["regionRoomHash"], "region-room.regionRoomHash"),
  };
}

function parseSpatialIndexBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"spatial-index">["invariants"] {
  return {
    entityCount: requireNumber(value["entityCount"], "spatial-index.entityCount"),
    capacity: requireNumber(value["capacity"], "spatial-index.capacity"),
    width: requireNumber(value["width"], "spatial-index.width"),
    height: requireNumber(value["height"], "spatial-index.height"),
    chunkSize: requireNumber(value["chunkSize"], "spatial-index.chunkSize"),
    queryCount: requireNumber(value["queryCount"], "spatial-index.queryCount"),
    movedEntities: requireNumber(value["movedEntities"], "spatial-index.movedEntities"),
    cleanupCount: requireNumber(value["cleanupCount"], "spatial-index.cleanupCount"),
    finalMapMemberships: requireNumber(
      value["finalMapMemberships"],
      "spatial-index.finalMapMemberships",
    ),
    finalIndexedEntities: requireNumber(
      value["finalIndexedEntities"],
      "spatial-index.finalIndexedEntities",
    ),
    finalBacklogCount: requireNumber(value["finalBacklogCount"], "spatial-index.finalBacklogCount"),
    occupancySetCount: requireNumber(value["occupancySetCount"], "spatial-index.occupancySetCount"),
    occupancyClearedCount: requireNumber(
      value["occupancyClearedCount"],
      "spatial-index.occupancyClearedCount",
    ),
    indexAddedCount: requireNumber(value["indexAddedCount"], "spatial-index.indexAddedCount"),
    indexRemovedCount: requireNumber(value["indexRemovedCount"], "spatial-index.indexRemovedCount"),
    queryChecksum: requireNumber(value["queryChecksum"], "spatial-index.queryChecksum"),
    movementChecksum: requireNumber(value["movementChecksum"], "spatial-index.movementChecksum"),
    cleanupChecksum: requireNumber(value["cleanupChecksum"], "spatial-index.cleanupChecksum"),
  };
}

function parseWorkOffersBaselineInvariants(
  value: Record<string, unknown>,
): BenchmarkBaselineEntry<"work-offers">["invariants"] {
  return {
    pawnCount: requireNumber(value["pawnCount"], "work-offers.pawnCount"),
    offerCount: requireNumber(value["offerCount"], "work-offers.offerCount"),
    offersPerPawnBucket: requireNumber(
      value["offersPerPawnBucket"],
      "work-offers.offersPerPawnBucket",
    ),
    candidateCap: requireNumber(value["candidateCap"], "work-offers.candidateCap"),
    selectedCap: requireNumber(value["selectedCap"], "work-offers.selectedCap"),
    allEntityScanEquivalent: requireNumber(
      value["allEntityScanEquivalent"],
      "work-offers.allEntityScanEquivalent",
    ),
    totalBucketCandidates: requireNumber(
      value["totalBucketCandidates"],
      "work-offers.totalBucketCandidates",
    ),
    visitedCandidates: requireNumber(value["visitedCandidates"], "work-offers.visitedCandidates"),
    scoredCandidates: requireNumber(value["scoredCandidates"], "work-offers.scoredCandidates"),
    selectedOffers: requireNumber(value["selectedOffers"], "work-offers.selectedOffers"),
    candidateCapHits: requireNumber(value["candidateCapHits"], "work-offers.candidateCapHits"),
    traceCapacity: requireNumber(value["traceCapacity"], "work-offers.traceCapacity"),
    storedTraceCount: requireNumber(value["storedTraceCount"], "work-offers.storedTraceCount"),
    indexActiveOffers: requireNumber(value["indexActiveOffers"], "work-offers.indexActiveOffers"),
    selectionChecksum: requireNumber(value["selectionChecksum"], "work-offers.selectionChecksum"),
  };
}

function sampleNamedBenchmark(
  name: BenchmarkName,
  sampleCount: number,
  warmupCount: number,
): SampledBenchmarkResult {
  if (name === "empty-tick") {
    return sampleBenchmark("empty-tick", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "entity-store") {
    return sampleBenchmark("entity-store", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "logistics-10k") {
    return sampleBenchmark("logistics-10k", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "m1-hauling-building-long-run") {
    return sampleBenchmark("m1-hauling-building-long-run", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "m2-pathing-invalidation") {
    return sampleBenchmark("m2-pathing-invalidation", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "m2-work-logistics-long-run") {
    return sampleBenchmark("m2-work-logistics-long-run", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "m3-ordinary-life-long-run") {
    return sampleBenchmark("m3-ordinary-life-long-run", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "m4-core-vertical-slice-long-run") {
    return sampleBenchmark("m4-core-vertical-slice-long-run", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "m5-alpha-content-long-run") {
    return sampleBenchmark("m5-alpha-content-long-run", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "map-dirty") {
    return sampleBenchmark("map-dirty", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "pathing-100") {
    return sampleBenchmark("pathing-100", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "reservations") {
    return sampleBenchmark("reservations", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "region-room") {
    return sampleBenchmark("region-room", {
      sampleCount,
      warmupCount,
    });
  }

  if (name === "spatial-index") {
    return sampleBenchmark("spatial-index", {
      sampleCount,
      warmupCount,
    });
  }

  return sampleBenchmark("work-offers", {
    sampleCount,
    warmupCount,
  });
}

function compareAgainstNamedBaseline(
  result: SampledBenchmarkResult,
  baseline: BenchmarkBaselineFile,
): BenchmarkComparison<BenchmarkName> {
  if (result.name === "empty-tick") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["empty-tick"]);
  }

  if (result.name === "entity-store") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["entity-store"]);
  }

  if (result.name === "logistics-10k") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["logistics-10k"]);
  }

  if (result.name === "m1-hauling-building-long-run") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["m1-hauling-building-long-run"]);
  }

  if (result.name === "m2-pathing-invalidation") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["m2-pathing-invalidation"]);
  }

  if (result.name === "m2-work-logistics-long-run") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["m2-work-logistics-long-run"]);
  }

  if (result.name === "m3-ordinary-life-long-run") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["m3-ordinary-life-long-run"]);
  }

  if (result.name === "m4-core-vertical-slice-long-run") {
    return compareBenchmarkToBaseline(
      result,
      baseline.benchmarks["m4-core-vertical-slice-long-run"],
    );
  }

  if (result.name === "m5-alpha-content-long-run") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["m5-alpha-content-long-run"]);
  }

  if (result.name === "map-dirty") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["map-dirty"]);
  }

  if (result.name === "pathing-100") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["pathing-100"]);
  }

  if (result.name === "reservations") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks.reservations);
  }

  if (result.name === "region-room") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["region-room"]);
  }

  if (result.name === "spatial-index") {
    return compareBenchmarkToBaseline(result, baseline.benchmarks["spatial-index"]);
  }

  return compareBenchmarkToBaseline(result, baseline.benchmarks["work-offers"]);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} invariants must be an object`);
  }

  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }

  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }

  return value;
}

function formatMs(value: number): string {
  return `${value.toFixed(3)}ms`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function printBenchmarkSummary(results: readonly BenchmarkCliResult[], artifactPath: string): void {
  const failures = results.filter((result) => result.comparison.status === "fail");
  const warnings = results.filter((result) => result.comparison.status === "warn");
  const output = failures.length > 0 ? console.error : console.log;

  output(
    failures.length > 0
      ? "Benchmark baseline comparison failed."
      : warnings.length > 0
        ? "Benchmark baseline comparison passed with warnings."
        : "Benchmark baseline comparison passed.",
  );

  for (const result of results) {
    const comparison = result.comparison;
    const mismatchSuffix =
      comparison.invariantMismatches.length === 0
        ? ""
        : `; invariants: ${comparison.invariantMismatches.join(", ")}`;

    output(
      `- ${result.name}: ${comparison.status.toUpperCase()} median=${formatMs(comparison.actualMedianElapsedMs)} baseline=${formatMs(comparison.baselineMedianElapsedMs)} regression=${formatPercent(comparison.regressionPercent)} warn>${formatPercent(comparison.warnRegressionPercent)} fail>${formatPercent(comparison.failRegressionPercent)}${mismatchSuffix}`,
    );
  }

  output(`Artifact: ${artifactPath}`);
}

function resolveArtifactRoot(defaultTask = "WM-0010"): string {
  const configuredRoot = process.env["WM_ARTIFACT_DIR"];

  if (configuredRoot !== undefined && configuredRoot.length > 0) {
    return path.resolve(process.cwd(), configuredRoot);
  }

  return path.resolve(process.cwd(), "coordination", "artifacts", defaultTask);
}

function toRelativePath(targetPath: string): string {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}

function createArtifactHashPath(artifactPath: string): string {
  return `${artifactPath}.sha256`;
}

function createSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

function createBenchmarkEnvironmentMetadata(): BenchmarkEnvironmentMetadata {
  const cpuList = cpus();
  return {
    nodeVersion: process.version,
    pnpmVersion: readCommandOutput("pnpm", ["--version"]),
    osRelease: release(),
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpuList[0]?.model ?? "unknown",
    cpuCount: cpuList.length,
    hostKeySha256: createHostKeySha256(),
    processId: process.pid,
    gitCommit: readCommandOutput("git", ["rev-parse", "HEAD"]),
  };
}

function createHostKeySha256(): string {
  const cpuModel = cpus()[0]?.model ?? "unknown";
  return createSha256([hostname(), release(), process.arch, cpuModel].join("\n"));
}

function formatBenchmarkCommand(argv: readonly string[]): string {
  return ["corepack", "pnpm", "bench", ...argv].map(formatCommandToken).join(" ");
}

function formatCommandToken(value: string): string {
  return /[\s"]/u.test(value) ? JSON.stringify(value) : value;
}

function failedArgs(error: string): { readonly ok: false; readonly error: string } {
  return {
    ok: false,
    error,
  };
}

function isBenchmarkName(value: string | undefined): value is BenchmarkName {
  return (
    value === "empty-tick" ||
    value === "entity-store" ||
    value === "logistics-10k" ||
    value === "m1-hauling-building-long-run" ||
    value === "m2-pathing-invalidation" ||
    value === "m2-work-logistics-long-run" ||
    value === "m3-ordinary-life-long-run" ||
    value === "m4-core-vertical-slice-long-run" ||
    value === "m5-alpha-content-long-run" ||
    value === "map-dirty" ||
    value === "pathing-100" ||
    value === "reservations" ||
    value === "region-room" ||
    value === "spatial-index" ||
    value === "work-offers"
  );
}

function readCommandOutput(command: string, args: readonly string[]): string {
  const invocation = createCommandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0 || typeof result.stdout !== "string") {
    return "unknown";
  }

  return result.stdout.trim() || "unknown";
}

function createCommandInvocation(
  command: string,
  args: readonly string[],
): { readonly command: string; readonly args: readonly string[] } {
  if (process.platform === "win32" && command === "pnpm") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", ["pnpm", ...args].join(" ")],
    };
  }

  return {
    command,
    args: [...args],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}
