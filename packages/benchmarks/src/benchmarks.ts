import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { performance } from "node:perf_hooks";

import {
  SIM_CORE_SMOKE,
  advanceHeadlessTicks,
  createHeadlessRunner,
  summarizeHeadlessRun,
  type HeadlessRunSummary,
} from "@wuming-town/sim-core";
import { TESTKIT_SMOKE } from "@wuming-town/testkit";

import { runEntityStoreBenchmark } from "./entity-store-benchmark";
import {
  mapDirtyInvariantsFromReport,
  runMapDirtyBenchmark,
  type MapDirtyBenchmarkInvariants,
  type MapDirtyBenchmarkReport,
  type SampledMapDirtyBenchmark,
} from "./map-dirty-benchmark";
import {
  runSpatialIndexBenchmark,
  spatialIndexInvariantsFromReport,
  type SampledSpatialIndexBenchmark,
  type SpatialIndexBenchmarkInvariants,
  type SpatialIndexBenchmarkReport,
} from "./spatial-index-benchmark";

export { runEntityStoreBenchmark } from "./entity-store-benchmark";
export { runSpatialIndexBenchmark } from "./spatial-index-benchmark";

export const BENCHMARKS_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/benchmarks",
  "package",
);

export const BENCHMARKS_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  TESTKIT_SMOKE.packageName,
];

export const DEFAULT_BENCHMARK_SAMPLE_COUNT = 5;
export const DEFAULT_BENCHMARK_WARMUP_COUNT = 1;

export type BenchmarkName = "empty-tick" | "entity-store" | "map-dirty" | "spatial-index";

export interface EmptyTickBenchmarkOptions {
  readonly seed: string;
  readonly ticks: number;
}

export interface EmptyTickBenchmarkReport {
  readonly name: "empty-tick";
  readonly requestedTicks: number;
  readonly advancedTicks: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
  readonly summary: HeadlessRunSummary;
}

export interface EntityStoreBenchmarkReport {
  readonly name: "entity-store";
  readonly capacity: number;
  readonly queuedCommands: number;
  readonly commitResultCount: number;
  readonly appliedCommands: number;
  readonly failedCommands: number;
  readonly attachedComponents: number;
  readonly iterationChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface EmptyTickBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly requestedTicks: number;
  readonly advancedTicks: number;
  readonly finalTick: number;
  readonly commandHash: string;
  readonly worldHash: string;
  readonly randomStreamCount: number;
}

export interface EntityStoreBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly capacity: number;
  readonly queuedCommands: number;
  readonly commitResultCount: number;
  readonly appliedCommands: number;
  readonly failedCommands: number;
  readonly attachedComponents: number;
  readonly iterationChecksum: number;
}

export interface BenchmarkSampleStats {
  readonly sampleCount: number;
  readonly minElapsedMs: number;
  readonly medianElapsedMs: number;
  readonly maxElapsedMs: number;
  readonly meanElapsedMs: number;
}

export interface BenchmarkSamplingOptions {
  readonly sampleCount?: number;
  readonly warmupCount?: number;
}

export interface SampledEmptyTickBenchmark {
  readonly name: "empty-tick";
  readonly report: EmptyTickBenchmarkReport;
  readonly invariants: EmptyTickBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export interface SampledEntityStoreBenchmark {
  readonly name: "entity-store";
  readonly report: EntityStoreBenchmarkReport;
  readonly invariants: EntityStoreBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export type BenchmarkReport =
  | EmptyTickBenchmarkReport
  | EntityStoreBenchmarkReport
  | MapDirtyBenchmarkReport
  | SpatialIndexBenchmarkReport;
export type BenchmarkInvariants =
  | EmptyTickBenchmarkInvariants
  | EntityStoreBenchmarkInvariants
  | MapDirtyBenchmarkInvariants
  | SpatialIndexBenchmarkInvariants;
export type SampledBenchmarkResult =
  | SampledEmptyTickBenchmark
  | SampledEntityStoreBenchmark
  | SampledMapDirtyBenchmark
  | SampledSpatialIndexBenchmark;

export interface BenchmarkReportMap {
  readonly "empty-tick": EmptyTickBenchmarkReport;
  readonly "entity-store": EntityStoreBenchmarkReport;
  readonly "map-dirty": MapDirtyBenchmarkReport;
  readonly "spatial-index": SpatialIndexBenchmarkReport;
}

export interface BenchmarkInvariantMap {
  readonly "empty-tick": EmptyTickBenchmarkInvariants;
  readonly "entity-store": EntityStoreBenchmarkInvariants;
  readonly "map-dirty": MapDirtyBenchmarkInvariants;
  readonly "spatial-index": SpatialIndexBenchmarkInvariants;
}

export function runEmptyTickBenchmark(
  options: EmptyTickBenchmarkOptions,
): EmptyTickBenchmarkReport {
  const runner = createHeadlessRunner({ seed: options.seed });
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  const advancedTicks = advanceHeadlessTicks(runner, options.ticks);
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "empty-tick",
    requestedTicks: options.ticks,
    advancedTicks,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
    summary: summarizeHeadlessRun(runner),
  };
}

export function benchmarkInvariantsFromReport(
  report: EmptyTickBenchmarkReport,
): EmptyTickBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: EntityStoreBenchmarkReport,
): EntityStoreBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: MapDirtyBenchmarkReport,
): MapDirtyBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: SpatialIndexBenchmarkReport,
): SpatialIndexBenchmarkInvariants;
export function benchmarkInvariantsFromReport(report: BenchmarkReport): BenchmarkInvariants {
  if (report.name === "empty-tick") {
    return {
      requestedTicks: report.requestedTicks,
      advancedTicks: report.advancedTicks,
      finalTick: report.summary.finalTick,
      commandHash: report.summary.commandHash,
      worldHash: report.summary.worldHash,
      randomStreamCount: report.summary.randomStreamCount,
    };
  }

  if (report.name === "entity-store") {
    return {
      capacity: report.capacity,
      queuedCommands: report.queuedCommands,
      commitResultCount: report.commitResultCount,
      appliedCommands: report.appliedCommands,
      failedCommands: report.failedCommands,
      attachedComponents: report.attachedComponents,
      iterationChecksum: report.iterationChecksum,
    };
  }

  if (report.name === "map-dirty") {
    return mapDirtyInvariantsFromReport(report);
  }

  return spatialIndexInvariantsFromReport(report);
}

export function runBenchmarkByName(name: "empty-tick"): EmptyTickBenchmarkReport;
export function runBenchmarkByName(name: "entity-store"): EntityStoreBenchmarkReport;
export function runBenchmarkByName(name: "map-dirty"): MapDirtyBenchmarkReport;
export function runBenchmarkByName(name: "spatial-index"): SpatialIndexBenchmarkReport;
export function runBenchmarkByName(name: BenchmarkName): BenchmarkReport {
  if (name === "empty-tick") {
    return runEmptyTickBenchmark({
      seed: "1",
      ticks: 1_000_000,
    });
  }

  if (name === "entity-store") {
    return runEntityStoreBenchmark();
  }

  if (name === "map-dirty") {
    return runMapDirtyBenchmark();
  }

  return runSpatialIndexBenchmark();
}

export function sampleBenchmark(
  name: "empty-tick",
  options?: BenchmarkSamplingOptions,
): SampledEmptyTickBenchmark;
export function sampleBenchmark(
  name: "entity-store",
  options?: BenchmarkSamplingOptions,
): SampledEntityStoreBenchmark;
export function sampleBenchmark(
  name: "map-dirty",
  options?: BenchmarkSamplingOptions,
): SampledMapDirtyBenchmark;
export function sampleBenchmark(
  name: "spatial-index",
  options?: BenchmarkSamplingOptions,
): SampledSpatialIndexBenchmark;
export function sampleBenchmark(
  name: BenchmarkName,
  options: BenchmarkSamplingOptions = {},
): SampledBenchmarkResult {
  const sampleCount = options.sampleCount ?? DEFAULT_BENCHMARK_SAMPLE_COUNT;
  const warmupCount = options.warmupCount ?? DEFAULT_BENCHMARK_WARMUP_COUNT;
  validateSamplingOptions(sampleCount, warmupCount);

  for (let index = 0; index < warmupCount; index += 1) {
    if (name === "empty-tick") {
      runBenchmarkByName("empty-tick");
    } else if (name === "entity-store") {
      runBenchmarkByName("entity-store");
    } else if (name === "map-dirty") {
      runBenchmarkByName("map-dirty");
    } else {
      runBenchmarkByName("spatial-index");
    }
  }

  if (name === "empty-tick") {
    return sampleEmptyTickBenchmark(sampleCount);
  }

  if (name === "entity-store") {
    return sampleEntityStoreBenchmark(sampleCount);
  }

  if (name === "map-dirty") {
    return sampleMapDirtyBenchmark(sampleCount);
  }

  return sampleSpatialIndexBenchmark(sampleCount);
}

export function runDefaultBenchmarkSuite(
  options: BenchmarkSamplingOptions = {},
): readonly SampledBenchmarkResult[] {
  return [
    sampleBenchmark("empty-tick", options),
    sampleBenchmark("entity-store", options),
    sampleBenchmark("map-dirty", options),
    sampleBenchmark("spatial-index", options),
  ];
}

function sampleEmptyTickBenchmark(sampleCount: number): SampledEmptyTickBenchmark {
  const reports: EmptyTickBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runEmptyTickBenchmark({ seed: "1", ticks: 1_000_000 }));
  }

  return {
    name: "empty-tick",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("empty-tick", reports),
    sampleElapsedMs: reports.map((report) => report.elapsedMs),
    stats: createBenchmarkStats(reports.map((report) => report.elapsedMs)),
  };
}

function sampleEntityStoreBenchmark(sampleCount: number): SampledEntityStoreBenchmark {
  const reports: EntityStoreBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runEntityStoreBenchmark());
  }

  return {
    name: "entity-store",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("entity-store", reports),
    sampleElapsedMs: reports.map((report) => report.elapsedMs),
    stats: createBenchmarkStats(reports.map((report) => report.elapsedMs)),
  };
}

function sampleMapDirtyBenchmark(sampleCount: number): SampledMapDirtyBenchmark {
  const reports: MapDirtyBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runMapDirtyBenchmark());
  }

  return {
    name: "map-dirty",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("map-dirty", reports),
    sampleElapsedMs: reports.map((report) => report.elapsedMs),
    stats: createBenchmarkStats(reports.map((report) => report.elapsedMs)),
  };
}

function sampleSpatialIndexBenchmark(sampleCount: number): SampledSpatialIndexBenchmark {
  const reports: SpatialIndexBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runSpatialIndexBenchmark());
  }

  return {
    name: "spatial-index",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("spatial-index", reports),
    sampleElapsedMs: reports.map((report) => report.elapsedMs),
    stats: createBenchmarkStats(reports.map((report) => report.elapsedMs)),
  };
}

function validateSamplingOptions(sampleCount: number, warmupCount: number): void {
  if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
    throw new Error("benchmark sampleCount must be a positive integer");
  }

  if (!Number.isInteger(warmupCount) || warmupCount < 0) {
    throw new Error("benchmark warmupCount must be a non-negative integer");
  }
}

function validateInvariantConsistency(
  name: "empty-tick",
  reports: readonly EmptyTickBenchmarkReport[],
): EmptyTickBenchmarkInvariants;
function validateInvariantConsistency(
  name: "entity-store",
  reports: readonly EntityStoreBenchmarkReport[],
): EntityStoreBenchmarkInvariants;
function validateInvariantConsistency(
  name: "map-dirty",
  reports: readonly MapDirtyBenchmarkReport[],
): MapDirtyBenchmarkInvariants;
function validateInvariantConsistency(
  name: "spatial-index",
  reports: readonly SpatialIndexBenchmarkReport[],
): SpatialIndexBenchmarkInvariants;
function validateInvariantConsistency(
  name: BenchmarkName,
  reports: readonly BenchmarkReport[],
): BenchmarkInvariants {
  const firstReport = reports[0];

  if (firstReport === undefined) {
    throw new Error(`benchmark ${name} did not produce a report`);
  }

  const expectedSignature = JSON.stringify(readInvariantUnion(firstReport));

  for (let index = 1; index < reports.length; index += 1) {
    const report = reports[index];

    if (report === undefined) {
      throw new Error(`benchmark ${name} sample ${String(index)} is missing`);
    }

    const actualSignature = JSON.stringify(readInvariantUnion(report));

    if (actualSignature !== expectedSignature) {
      throw new Error(`benchmark ${name} changed deterministic invariants across samples`);
    }
  }

  return readInvariantUnion(firstReport);
}

function createBenchmarkStats(sampleElapsedMs: readonly number[]): BenchmarkSampleStats {
  if (sampleElapsedMs.length === 0) {
    throw new Error("benchmark stats require at least one sample");
  }

  const sorted = [...sampleElapsedMs].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);
  const minElapsedMs = sorted[0];
  const maxElapsedMs = sorted[sorted.length - 1];
  const medianElapsedMs =
    sorted.length % 2 === 1
      ? sorted[middleIndex]
      : ((sorted[middleIndex - 1] ?? 0) + (sorted[middleIndex] ?? 0)) / 2;
  const sumElapsedMs = sorted.reduce((sum, value) => sum + value, 0);

  if (minElapsedMs === undefined || maxElapsedMs === undefined || medianElapsedMs === undefined) {
    throw new Error("benchmark stats expected populated sample bounds");
  }

  return {
    sampleCount: sampleElapsedMs.length,
    minElapsedMs,
    medianElapsedMs,
    maxElapsedMs,
    meanElapsedMs: sumElapsedMs / sampleElapsedMs.length,
  };
}

function failMissingReport(): never {
  throw new Error("benchmark sample report is missing");
}

function readInvariantUnion(report: BenchmarkReport): BenchmarkInvariants {
  if (report.name === "empty-tick") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "entity-store") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "map-dirty") {
    return benchmarkInvariantsFromReport(report);
  }

  return benchmarkInvariantsFromReport(report);
}
