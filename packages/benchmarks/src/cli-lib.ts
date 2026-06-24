import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import {
  BENCHMARK_BASELINE_SCHEMA_VERSION,
  compareBenchmarkToBaseline,
  type BenchmarkBaselineEntry,
  type BenchmarkBaselineFile,
  type BenchmarkComparison,
} from "./baseline";
import {
  DEFAULT_BENCHMARK_SAMPLE_COUNT,
  DEFAULT_BENCHMARK_WARMUP_COUNT,
  runDefaultBenchmarkSuite,
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
  readonly environment: {
    readonly nodeVersion: string;
    readonly platform: NodeJS.Platform;
    readonly arch: string;
  };
  readonly results: readonly BenchmarkCliResult[];
}

export interface BenchmarkCliResult {
  readonly name: BenchmarkName;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: SampledBenchmarkResult["stats"];
  readonly invariants: SampledBenchmarkResult["invariants"];
  readonly comparison: BenchmarkComparison<BenchmarkName>;
}

interface ParsedBenchmarkArgs {
  readonly filter: BenchmarkName | undefined;
  readonly sampleCount: number;
  readonly warmupCount: number;
  readonly baselinePath: string;
  readonly artifactPath: string;
}

export function runBenchmarksCli(argv: readonly string[]): number {
  const parsed = parseBenchmarkArgs(argv);

  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const baseline = loadBenchmarkBaseline(parsed.value.baselinePath);
  const sampledResults =
    parsed.value.filter === undefined
      ? runDefaultBenchmarkSuite({
          sampleCount: parsed.value.sampleCount,
          warmupCount: parsed.value.warmupCount,
        })
      : [
          sampleNamedBenchmark(
            parsed.value.filter,
            parsed.value.sampleCount,
            parsed.value.warmupCount,
          ),
        ];

  const results = sampledResults.map((result) => ({
    name: result.name,
    sampleElapsedMs: result.sampleElapsedMs,
    stats: result.stats,
    invariants: result.invariants,
    comparison: compareAgainstNamedBaseline(result, baseline),
  }));

  const report: BenchmarkCliReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baselinePath: toRelativePath(parsed.value.baselinePath),
    artifactPath: toRelativePath(parsed.value.artifactPath),
    sampleCount: parsed.value.sampleCount,
    warmupCount: parsed.value.warmupCount,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    results,
  };

  mkdirSync(path.dirname(parsed.value.artifactPath), { recursive: true });
  writeFileSync(parsed.value.artifactPath, `${JSON.stringify(report, undefined, 2)}\n`, "utf8");

  printBenchmarkSummary(results, report.artifactPath);
  return results.some((result) => result.comparison.status === "fail") ? 1 : 0;
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
  let artifactPath = path.join(resolveArtifactRoot(), "benchmarks", "benchmark-results.json");
  let artifactPathWasConfigured = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--filter") {
      const value = argv[index + 1];

      if (!isBenchmarkName(value)) {
        return failedArgs(
          "Unsupported benchmark filter. Use empty-tick, entity-store, map-dirty, pathing-100, reservations, region-room, spatial-index, or work-offers.",
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
          "Unsupported benchmark filter. Use empty-tick, entity-store, map-dirty, pathing-100, reservations, region-room, spatial-index, or work-offers.",
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

  if (!artifactPathWasConfigured && filter === "work-offers") {
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
    value === "map-dirty" ||
    value === "pathing-100" ||
    value === "reservations" ||
    value === "region-room" ||
    value === "spatial-index" ||
    value === "work-offers"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
