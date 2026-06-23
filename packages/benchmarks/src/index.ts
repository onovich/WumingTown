import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { performance } from "node:perf_hooks";

import {
  SIM_CORE_SMOKE,
  advanceHeadlessTicks,
  createHeadlessRunner,
  createEntityRegistry,
  createInt32ComponentStore,
  createStructuralCommandBuffer,
  summarizeHeadlessRun,
  type EntityId,
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

export interface EntityStoreBenchmarkReport {
  readonly name: "entity-store";
  readonly capacity: number;
  readonly queuedCommands: number;
  readonly appliedCommands: number;
  readonly failedCommands: number;
  readonly attachedComponents: number;
  readonly iterationChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
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

export function runEntityStoreBenchmark(): EntityStoreBenchmarkReport {
  const capacity = 8_192;
  const registry = createEntityRegistry({ capacity });
  const store = createInt32ComponentStore({ capacity });
  const buffer = createStructuralCommandBuffer({ capacity });
  const entities: EntityId[] = [];
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  for (let index = 0; index < capacity; index += 1) {
    const allocation = registry.allocate();

    if (!allocation.ok) {
      throw new Error(allocation.reason);
    }

    const entity = allocation.entity;
    const attached = store.attach(entity, registry, index);

    if (!attached.ok) {
      throw new Error(attached.reason);
    }

    entities.push(entity);
  }

  for (let index = capacity - 1; index >= 0; index -= 1) {
    const entity = entities[index];

    if (entity === undefined) {
      throw new Error("missing benchmark entity");
    }

    const queued = buffer.queueSetInt32(entity, index * 3);

    if (!queued.ok) {
      throw new Error(queued.reason);
    }
  }

  const report = buffer.commit(registry, store);
  let iterationChecksum = 0;

  store.forEachAttachedAscending(registry, (entity, value) => {
    iterationChecksum = (iterationChecksum + entity.index + value) >>> 0;
  });

  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "entity-store",
    capacity,
    queuedCommands: capacity,
    appliedCommands: report.appliedCount,
    failedCommands: report.failedCount,
    attachedComponents: store.activeCount,
    iterationChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function runBenchmarksCli(argv: readonly string[]): number {
  const parsed = parseBenchmarkArgs(argv);

  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  if (parsed.filter === "entity-store") {
    const report = runEntityStoreBenchmark();

    if (report.appliedCommands !== report.queuedCommands || report.failedCommands !== 0) {
      console.error("entity-store benchmark did not apply every queued command");
      return 1;
    }

    console.log(JSON.stringify(report, undefined, 2));
    return 0;
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

type BenchmarkFilter = "empty-tick" | "entity-store";

type BenchmarkArgsResult =
  | {
      readonly ok: true;
      readonly filter: BenchmarkFilter;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

function parseBenchmarkArgs(argv: readonly string[]): BenchmarkArgsResult {
  if (argv.length === 0) {
    return {
      ok: true,
      filter: "empty-tick",
    };
  }

  if (argv.length === 2 && argv[0] === "--filter" && argv[1] === "empty-tick") {
    return {
      ok: true,
      filter: "empty-tick",
    };
  }

  if (argv.length === 2 && argv[0] === "--filter" && argv[1] === "entity-store") {
    return {
      ok: true,
      filter: "entity-store",
    };
  }

  if (argv.length === 1 && argv[0] === "--filter=empty-tick") {
    return {
      ok: true,
      filter: "empty-tick",
    };
  }

  if (argv.length === 1 && argv[0] === "--filter=entity-store") {
    return {
      ok: true,
      filter: "entity-store",
    };
  }

  return {
    ok: false,
    error: "Unsupported benchmark arguments. Use --filter empty-tick or --filter entity-store.",
  };
}
