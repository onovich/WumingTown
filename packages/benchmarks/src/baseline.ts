import type { BenchmarkInvariantMap, BenchmarkName, SampledBenchmarkResult } from "./benchmarks";

export const BENCHMARK_BASELINE_SCHEMA_VERSION = 1;

export interface BenchmarkBaselineEntry<Name extends BenchmarkName> {
  readonly name: Name;
  readonly medianElapsedMs: number;
  readonly warnRegressionPercent: number;
  readonly failRegressionPercent: number;
  readonly invariants: BenchmarkInvariantMap[Name];
}

export interface BenchmarkBaselineFile {
  readonly schemaVersion: typeof BENCHMARK_BASELINE_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly benchmarks: {
    readonly "empty-tick": BenchmarkBaselineEntry<"empty-tick">;
    readonly "entity-store": BenchmarkBaselineEntry<"entity-store">;
    readonly "map-dirty": BenchmarkBaselineEntry<"map-dirty">;
  };
}

export type BenchmarkComparisonStatus = "ok" | "warn" | "fail";

export interface BenchmarkComparison<Name extends BenchmarkName> {
  readonly name: Name;
  readonly status: BenchmarkComparisonStatus;
  readonly actualMedianElapsedMs: number;
  readonly baselineMedianElapsedMs: number;
  readonly regressionPercent: number;
  readonly warnRegressionPercent: number;
  readonly failRegressionPercent: number;
  readonly invariantMismatches: readonly string[];
}

export function compareBenchmarkToBaseline(
  actual: Extract<SampledBenchmarkResult, { readonly name: "empty-tick" }>,
  baseline: BenchmarkBaselineEntry<"empty-tick">,
): BenchmarkComparison<"empty-tick">;
export function compareBenchmarkToBaseline(
  actual: Extract<SampledBenchmarkResult, { readonly name: "entity-store" }>,
  baseline: BenchmarkBaselineEntry<"entity-store">,
): BenchmarkComparison<"entity-store">;
export function compareBenchmarkToBaseline(
  actual: Extract<SampledBenchmarkResult, { readonly name: "map-dirty" }>,
  baseline: BenchmarkBaselineEntry<"map-dirty">,
): BenchmarkComparison<"map-dirty">;
export function compareBenchmarkToBaseline(
  actual: SampledBenchmarkResult,
  baseline: BenchmarkBaselineEntry<BenchmarkName>,
): BenchmarkComparison<BenchmarkName> {
  const invariantMismatches = collectInvariantMismatches(actual.invariants, baseline.invariants);
  const regressionPercent = calculateRegressionPercent(
    actual.stats.medianElapsedMs,
    baseline.medianElapsedMs,
  );
  const status = determineComparisonStatus(
    regressionPercent,
    baseline.warnRegressionPercent,
    baseline.failRegressionPercent,
    invariantMismatches.length > 0,
  );

  return {
    name: actual.name,
    status,
    actualMedianElapsedMs: actual.stats.medianElapsedMs,
    baselineMedianElapsedMs: baseline.medianElapsedMs,
    regressionPercent,
    warnRegressionPercent: baseline.warnRegressionPercent,
    failRegressionPercent: baseline.failRegressionPercent,
    invariantMismatches,
  };
}

function collectInvariantMismatches(
  actual: Record<string, boolean | number | string>,
  baseline: Record<string, boolean | number | string>,
): string[] {
  const mismatches: string[] = [];

  for (const key of Object.keys(baseline).sort()) {
    const actualValue = actual[key];
    const baselineValue = baseline[key];

    if (actualValue !== baselineValue) {
      mismatches.push(`${key}: expected ${String(baselineValue)}, received ${String(actualValue)}`);
    }
  }

  return mismatches;
}

function calculateRegressionPercent(actualMedianMs: number, baselineMedianMs: number): number {
  if (baselineMedianMs <= 0) {
    throw new Error("benchmark baseline median elapsed time must be greater than zero");
  }

  return ((actualMedianMs - baselineMedianMs) / baselineMedianMs) * 100;
}

function determineComparisonStatus(
  regressionPercent: number,
  warnRegressionPercent: number,
  failRegressionPercent: number,
  hasInvariantMismatch: boolean,
): BenchmarkComparisonStatus {
  if (hasInvariantMismatch || regressionPercent > failRegressionPercent) {
    return "fail";
  }

  if (regressionPercent > warnRegressionPercent) {
    return "warn";
  }

  return "ok";
}
