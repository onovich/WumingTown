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

export const BENCHMARKS_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/benchmarks",
  "package",
);

export const BENCHMARKS_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  TESTKIT_SMOKE.packageName,
];

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

export function runBenchmarksCli(argv: readonly string[]): number {
  const parsed = parseBenchmarkArgs(argv);

  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const report = runEmptyTickBenchmark({
    seed: "1",
    ticks: 1_000_000,
  });

  if (report.advancedTicks !== report.requestedTicks) {
    console.error("empty-tick benchmark did not advance the requested tick count");
    return 1;
  }

  console.log(JSON.stringify(report, undefined, 2));
  return 0;
}

type BenchmarkArgsResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

function parseBenchmarkArgs(argv: readonly string[]): BenchmarkArgsResult {
  if (argv.length === 0) {
    return {
      ok: true,
    };
  }

  if (argv.length === 2 && argv[0] === "--filter" && argv[1] === "empty-tick") {
    return {
      ok: true,
    };
  }

  if (argv.length === 1 && argv[0] === "--filter=empty-tick") {
    return {
      ok: true,
    };
  }

  return {
    ok: false,
    error: "Unsupported benchmark arguments. Use --filter empty-tick.",
  };
}
