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
  logistics10kInvariantsFromReport,
  runLogistics10kBenchmark,
  type Logistics10kBenchmarkInvariants,
  type Logistics10kBenchmarkReport,
  type SampledLogistics10kBenchmark,
} from "./logistics-10k-benchmark";
import {
  m1HaulingBuildingLongRunInvariantsFromReport,
  runM1HaulingBuildingLongRunBenchmark,
  type M1HaulingBuildingLongRunBenchmarkInvariants,
  type M1HaulingBuildingLongRunBenchmarkReport,
  type SampledM1HaulingBuildingLongRunBenchmark,
} from "./m1-hauling-building-long-run-benchmark";
import {
  runSpatialIndexBenchmark,
  spatialIndexInvariantsFromReport,
  type SampledSpatialIndexBenchmark,
  type SpatialIndexBenchmarkInvariants,
  type SpatialIndexBenchmarkReport,
} from "./spatial-index-benchmark";
import {
  pathing100InvariantsFromReport,
  runPathing100Benchmark,
  type Pathing100BenchmarkInvariants,
  type Pathing100BenchmarkReport,
  type SampledPathing100Benchmark,
} from "./pathing-100-benchmark";
import {
  regionRoomInvariantsFromReport,
  runRegionRoomBenchmark,
  type RegionRoomBenchmarkInvariants,
  type RegionRoomBenchmarkReport,
  type SampledRegionRoomBenchmark,
} from "./region-room-benchmark";
import {
  reservationsInvariantsFromReport,
  runReservationsBenchmark,
  type ReservationsBenchmarkInvariants,
  type ReservationsBenchmarkReport,
  type SampledReservationsBenchmark,
} from "./reservations-benchmark";
import {
  runWorkOffersBenchmark,
  workOffersInvariantsFromReport,
  type SampledWorkOffersBenchmark,
  type WorkOffersBenchmarkInvariants,
  type WorkOffersBenchmarkReport,
} from "./work-offers-benchmark";

export { runEntityStoreBenchmark } from "./entity-store-benchmark";
export { runLogistics10kBenchmark } from "./logistics-10k-benchmark";
export { runM1HaulingBuildingLongRunBenchmark } from "./m1-hauling-building-long-run-benchmark";
export { runPathing100Benchmark } from "./pathing-100-benchmark";
export { runRegionRoomBenchmark } from "./region-room-benchmark";
export { runReservationsBenchmark } from "./reservations-benchmark";
export { runSpatialIndexBenchmark } from "./spatial-index-benchmark";
export { runWorkOffersBenchmark } from "./work-offers-benchmark";

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

export type BenchmarkName =
  | "empty-tick"
  | "entity-store"
  | "logistics-10k"
  | "m1-hauling-building-long-run"
  | "map-dirty"
  | "pathing-100"
  | "reservations"
  | "region-room"
  | "spatial-index"
  | "work-offers";

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
  | Logistics10kBenchmarkReport
  | M1HaulingBuildingLongRunBenchmarkReport
  | MapDirtyBenchmarkReport
  | Pathing100BenchmarkReport
  | ReservationsBenchmarkReport
  | RegionRoomBenchmarkReport
  | SpatialIndexBenchmarkReport
  | WorkOffersBenchmarkReport;
export type BenchmarkInvariants =
  | EmptyTickBenchmarkInvariants
  | EntityStoreBenchmarkInvariants
  | Logistics10kBenchmarkInvariants
  | M1HaulingBuildingLongRunBenchmarkInvariants
  | MapDirtyBenchmarkInvariants
  | Pathing100BenchmarkInvariants
  | ReservationsBenchmarkInvariants
  | RegionRoomBenchmarkInvariants
  | SpatialIndexBenchmarkInvariants
  | WorkOffersBenchmarkInvariants;
export type SampledBenchmarkResult =
  | SampledEmptyTickBenchmark
  | SampledEntityStoreBenchmark
  | SampledLogistics10kBenchmark
  | SampledM1HaulingBuildingLongRunBenchmark
  | SampledMapDirtyBenchmark
  | SampledPathing100Benchmark
  | SampledReservationsBenchmark
  | SampledRegionRoomBenchmark
  | SampledSpatialIndexBenchmark
  | SampledWorkOffersBenchmark;

export interface BenchmarkReportMap {
  readonly "empty-tick": EmptyTickBenchmarkReport;
  readonly "entity-store": EntityStoreBenchmarkReport;
  readonly "logistics-10k": Logistics10kBenchmarkReport;
  readonly "m1-hauling-building-long-run": M1HaulingBuildingLongRunBenchmarkReport;
  readonly "map-dirty": MapDirtyBenchmarkReport;
  readonly "pathing-100": Pathing100BenchmarkReport;
  readonly reservations: ReservationsBenchmarkReport;
  readonly "region-room": RegionRoomBenchmarkReport;
  readonly "spatial-index": SpatialIndexBenchmarkReport;
  readonly "work-offers": WorkOffersBenchmarkReport;
}

export interface BenchmarkInvariantMap {
  readonly "empty-tick": EmptyTickBenchmarkInvariants;
  readonly "entity-store": EntityStoreBenchmarkInvariants;
  readonly "logistics-10k": Logistics10kBenchmarkInvariants;
  readonly "m1-hauling-building-long-run": M1HaulingBuildingLongRunBenchmarkInvariants;
  readonly "map-dirty": MapDirtyBenchmarkInvariants;
  readonly "pathing-100": Pathing100BenchmarkInvariants;
  readonly reservations: ReservationsBenchmarkInvariants;
  readonly "region-room": RegionRoomBenchmarkInvariants;
  readonly "spatial-index": SpatialIndexBenchmarkInvariants;
  readonly "work-offers": WorkOffersBenchmarkInvariants;
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
  report: Logistics10kBenchmarkReport,
): Logistics10kBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: M1HaulingBuildingLongRunBenchmarkReport,
): M1HaulingBuildingLongRunBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: MapDirtyBenchmarkReport,
): MapDirtyBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: Pathing100BenchmarkReport,
): Pathing100BenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: ReservationsBenchmarkReport,
): ReservationsBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: RegionRoomBenchmarkReport,
): RegionRoomBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: SpatialIndexBenchmarkReport,
): SpatialIndexBenchmarkInvariants;
export function benchmarkInvariantsFromReport(
  report: WorkOffersBenchmarkReport,
): WorkOffersBenchmarkInvariants;
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

  if (report.name === "logistics-10k") {
    return logistics10kInvariantsFromReport(report);
  }

  if (report.name === "m1-hauling-building-long-run") {
    return m1HaulingBuildingLongRunInvariantsFromReport(report);
  }

  if (report.name === "map-dirty") {
    return mapDirtyInvariantsFromReport(report);
  }

  if (report.name === "pathing-100") {
    return pathing100InvariantsFromReport(report);
  }

  if (report.name === "reservations") {
    return reservationsInvariantsFromReport(report);
  }

  if (report.name === "region-room") {
    return regionRoomInvariantsFromReport(report);
  }

  if (report.name === "spatial-index") {
    return spatialIndexInvariantsFromReport(report);
  }

  return workOffersInvariantsFromReport(report);
}

export function runBenchmarkByName(name: "empty-tick"): EmptyTickBenchmarkReport;
export function runBenchmarkByName(name: "entity-store"): EntityStoreBenchmarkReport;
export function runBenchmarkByName(name: "logistics-10k"): Logistics10kBenchmarkReport;
export function runBenchmarkByName(
  name: "m1-hauling-building-long-run",
): M1HaulingBuildingLongRunBenchmarkReport;
export function runBenchmarkByName(name: "map-dirty"): MapDirtyBenchmarkReport;
export function runBenchmarkByName(name: "pathing-100"): Pathing100BenchmarkReport;
export function runBenchmarkByName(name: "reservations"): ReservationsBenchmarkReport;
export function runBenchmarkByName(name: "region-room"): RegionRoomBenchmarkReport;
export function runBenchmarkByName(name: "spatial-index"): SpatialIndexBenchmarkReport;
export function runBenchmarkByName(name: "work-offers"): WorkOffersBenchmarkReport;
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

  if (name === "logistics-10k") {
    return runLogistics10kBenchmark();
  }

  if (name === "m1-hauling-building-long-run") {
    return runM1HaulingBuildingLongRunBenchmark();
  }

  if (name === "map-dirty") {
    return runMapDirtyBenchmark();
  }

  if (name === "pathing-100") {
    return runPathing100Benchmark();
  }

  if (name === "reservations") {
    return runReservationsBenchmark();
  }

  if (name === "region-room") {
    return runRegionRoomBenchmark();
  }

  if (name === "spatial-index") {
    return runSpatialIndexBenchmark();
  }

  return runWorkOffersBenchmark();
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
  name: "logistics-10k",
  options?: BenchmarkSamplingOptions,
): SampledLogistics10kBenchmark;
export function sampleBenchmark(
  name: "m1-hauling-building-long-run",
  options?: BenchmarkSamplingOptions,
): SampledM1HaulingBuildingLongRunBenchmark;
export function sampleBenchmark(
  name: "map-dirty",
  options?: BenchmarkSamplingOptions,
): SampledMapDirtyBenchmark;
export function sampleBenchmark(
  name: "pathing-100",
  options?: BenchmarkSamplingOptions,
): SampledPathing100Benchmark;
export function sampleBenchmark(
  name: "reservations",
  options?: BenchmarkSamplingOptions,
): SampledReservationsBenchmark;
export function sampleBenchmark(
  name: "region-room",
  options?: BenchmarkSamplingOptions,
): SampledRegionRoomBenchmark;
export function sampleBenchmark(
  name: "spatial-index",
  options?: BenchmarkSamplingOptions,
): SampledSpatialIndexBenchmark;
export function sampleBenchmark(
  name: "work-offers",
  options?: BenchmarkSamplingOptions,
): SampledWorkOffersBenchmark;
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
    } else if (name === "logistics-10k") {
      runBenchmarkByName("logistics-10k");
    } else if (name === "m1-hauling-building-long-run") {
      runBenchmarkByName("m1-hauling-building-long-run");
    } else if (name === "map-dirty") {
      runBenchmarkByName("map-dirty");
    } else if (name === "pathing-100") {
      runBenchmarkByName("pathing-100");
    } else if (name === "reservations") {
      runBenchmarkByName("reservations");
    } else if (name === "region-room") {
      runBenchmarkByName("region-room");
    } else if (name === "spatial-index") {
      runBenchmarkByName("spatial-index");
    } else {
      runBenchmarkByName("work-offers");
    }
  }

  if (name === "empty-tick") {
    return sampleEmptyTickBenchmark(sampleCount);
  }

  if (name === "entity-store") {
    return sampleEntityStoreBenchmark(sampleCount);
  }

  if (name === "logistics-10k") {
    return sampleLogistics10kBenchmark(sampleCount);
  }

  if (name === "m1-hauling-building-long-run") {
    return sampleM1HaulingBuildingLongRunBenchmark(sampleCount);
  }

  if (name === "map-dirty") {
    return sampleMapDirtyBenchmark(sampleCount);
  }

  if (name === "pathing-100") {
    return samplePathing100Benchmark(sampleCount);
  }

  if (name === "reservations") {
    return sampleReservationsBenchmark(sampleCount);
  }

  if (name === "region-room") {
    return sampleRegionRoomBenchmark(sampleCount);
  }

  if (name === "spatial-index") {
    return sampleSpatialIndexBenchmark(sampleCount);
  }

  return sampleWorkOffersBenchmark(sampleCount);
}

export function runDefaultBenchmarkSuite(
  options: BenchmarkSamplingOptions = {},
): readonly SampledBenchmarkResult[] {
  return [
    sampleBenchmark("empty-tick", options),
    sampleBenchmark("entity-store", options),
    sampleBenchmark("logistics-10k", options),
    sampleBenchmark("m1-hauling-building-long-run", options),
    sampleBenchmark("map-dirty", options),
    sampleBenchmark("pathing-100", options),
    sampleBenchmark("reservations", options),
    sampleBenchmark("region-room", options),
    sampleBenchmark("spatial-index", options),
    sampleBenchmark("work-offers", options),
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

function sampleLogistics10kBenchmark(sampleCount: number): SampledLogistics10kBenchmark {
  const reports: Logistics10kBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runLogistics10kBenchmark());
  }

  return {
    name: "logistics-10k",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("logistics-10k", reports),
    sampleElapsedMs: reports.map((report) => report.elapsedMs),
    stats: createBenchmarkStats(reports.map((report) => report.elapsedMs)),
  };
}

function sampleM1HaulingBuildingLongRunBenchmark(
  sampleCount: number,
): SampledM1HaulingBuildingLongRunBenchmark {
  const reports: M1HaulingBuildingLongRunBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runM1HaulingBuildingLongRunBenchmark());
  }

  return {
    name: "m1-hauling-building-long-run",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("m1-hauling-building-long-run", reports),
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

function samplePathing100Benchmark(sampleCount: number): SampledPathing100Benchmark {
  const reports: Pathing100BenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runPathing100Benchmark());
  }

  return {
    name: "pathing-100",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("pathing-100", reports),
    sampleElapsedMs: reports.map((report) => report.elapsedMs),
    stats: createBenchmarkStats(reports.map((report) => report.elapsedMs)),
  };
}

function sampleReservationsBenchmark(sampleCount: number): SampledReservationsBenchmark {
  const reports: ReservationsBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runReservationsBenchmark());
  }

  return {
    name: "reservations",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("reservations", reports),
    sampleElapsedMs: reports.map((report) => report.elapsedMs),
    stats: createBenchmarkStats(reports.map((report) => report.elapsedMs)),
  };
}

function sampleRegionRoomBenchmark(sampleCount: number): SampledRegionRoomBenchmark {
  const reports: RegionRoomBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runRegionRoomBenchmark());
  }

  return {
    name: "region-room",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("region-room", reports),
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

function sampleWorkOffersBenchmark(sampleCount: number): SampledWorkOffersBenchmark {
  const reports: WorkOffersBenchmarkReport[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    reports.push(runWorkOffersBenchmark());
  }

  return {
    name: "work-offers",
    report: reports[reports.length - 1] ?? failMissingReport(),
    invariants: validateInvariantConsistency("work-offers", reports),
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
  name: "logistics-10k",
  reports: readonly Logistics10kBenchmarkReport[],
): Logistics10kBenchmarkInvariants;
function validateInvariantConsistency(
  name: "m1-hauling-building-long-run",
  reports: readonly M1HaulingBuildingLongRunBenchmarkReport[],
): M1HaulingBuildingLongRunBenchmarkInvariants;
function validateInvariantConsistency(
  name: "map-dirty",
  reports: readonly MapDirtyBenchmarkReport[],
): MapDirtyBenchmarkInvariants;
function validateInvariantConsistency(
  name: "pathing-100",
  reports: readonly Pathing100BenchmarkReport[],
): Pathing100BenchmarkInvariants;
function validateInvariantConsistency(
  name: "reservations",
  reports: readonly ReservationsBenchmarkReport[],
): ReservationsBenchmarkInvariants;
function validateInvariantConsistency(
  name: "region-room",
  reports: readonly RegionRoomBenchmarkReport[],
): RegionRoomBenchmarkInvariants;
function validateInvariantConsistency(
  name: "spatial-index",
  reports: readonly SpatialIndexBenchmarkReport[],
): SpatialIndexBenchmarkInvariants;
function validateInvariantConsistency(
  name: "work-offers",
  reports: readonly WorkOffersBenchmarkReport[],
): WorkOffersBenchmarkInvariants;
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

  if (report.name === "logistics-10k") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "m1-hauling-building-long-run") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "map-dirty") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "pathing-100") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "reservations") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "region-room") {
    return benchmarkInvariantsFromReport(report);
  }

  if (report.name === "spatial-index") {
    return benchmarkInvariantsFromReport(report);
  }

  return benchmarkInvariantsFromReport(report);
}
