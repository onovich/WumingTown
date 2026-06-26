import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import {
  HAULING_BUILDING_SCENARIO_ID,
  M2_WORK_LOGISTICS_SCENARIO_ID,
  M3_ORDINARY_LIFE_ALIAS,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M4_CORE_VERTICAL_SLICE_ALIAS,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  SIM_CORE_SMOKE,
  isSafeTick,
  runHaulingBuildingScenario,
  runHeadlessTicks,
  runM4CoreVerticalSliceScenario,
  runM3OrdinaryLifeScenario,
  runM2WorkLogisticsScenario,
  type HaulingBuildingScenarioSummary,
  type HeadlessRunSummary,
  type M4CoreVerticalSliceScenarioSummary,
  type M3OrdinaryLifeScenarioSummary,
  type M2WorkLogisticsScenarioSummary,
} from "@wuming-town/sim-core";
import { TESTKIT_SMOKE } from "@wuming-town/testkit";

export const HEADLESS_RUNNER_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/headless-runner",
  "tool",
);

export const HEADLESS_RUNNER_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  TESTKIT_SMOKE.packageName,
];

export interface HeadlessCliIo {
  writeLine(line: string): void;
  writeError(line: string): void;
}

export interface HeadlessCliOptions {
  readonly seed: string;
  readonly ticks: number;
  readonly scenario?:
    | "hauling-building"
    | "m2-work-logistics"
    | "m3-ordinary-life"
    | "m4-core-vertical-slice";
}

export type HeadlessCliResult =
  | {
      readonly ok: true;
      readonly summary:
        | HeadlessRunSummary
        | HaulingBuildingScenarioSummary
        | M3OrdinaryLifeScenarioSummary
        | M2WorkLogisticsScenarioSummary
        | M4CoreVerticalSliceScenarioSummary;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export function runHeadlessCli(argv: readonly string[], io: HeadlessCliIo): number {
  const parsed = parseHeadlessCliOptions(argv);

  if (!parsed.ok) {
    io.writeError(parsed.error);
    return 1;
  }

  const summary = runSelectedHeadlessScenario(parsed.options);
  io.writeLine(JSON.stringify(summary, undefined, 2));
  return 0;
}

export function parseHeadlessCliOptions(argv: readonly string[]): HeadlessCliResultOptions {
  let seed: string | undefined;
  let ticks: number | undefined;
  let scenario:
    | "hauling-building"
    | "m2-work-logistics"
    | "m3-ordinary-life"
    | "m4-core-vertical-slice"
    | undefined;
  let index = 0;

  while (index < argv.length) {
    const arg = argv[index];

    if (arg === "--") {
      index += 1;
      continue;
    }

    if (arg === "--seed") {
      const value = argv[index + 1];
      if (value === undefined || value.length === 0) {
        return failedOptions("--seed requires a non-empty value");
      }
      seed = value;
      index += 2;
      continue;
    }

    if (arg === "--ticks") {
      const value = argv[index + 1];
      if (value === undefined) {
        return failedOptions("--ticks requires a value");
      }

      const parsedTicks = Number(value);
      if (!isSafeTick(parsedTicks)) {
        return failedOptions("--ticks must be a non-negative safe integer");
      }

      ticks = parsedTicks;
      index += 2;
      continue;
    }

    if (arg === "--scenario") {
      const value = argv[index + 1];
      if (
        value !== "hauling-building" &&
        value !== "m2-work-logistics" &&
        value !== M3_ORDINARY_LIFE_ALIAS &&
        value !== M4_CORE_VERTICAL_SLICE_ALIAS
      ) {
        return failedOptions(
          `--scenario supports hauling-building (${HAULING_BUILDING_SCENARIO_ID}), m2-work-logistics (${M2_WORK_LOGISTICS_SCENARIO_ID}), ${M3_ORDINARY_LIFE_ALIAS} (${M3_ORDINARY_LIFE_SCENARIO_ID}), or ${M4_CORE_VERTICAL_SLICE_ALIAS} (${M4_CORE_VERTICAL_SLICE_SCENARIO_ID})`,
        );
      }

      scenario = value;
      index += 2;
      continue;
    }

    return failedOptions(`unsupported argument: ${arg ?? ""}`);
  }

  if (seed === undefined) {
    return failedOptions("--seed is required");
  }

  if (ticks === undefined) {
    return failedOptions("--ticks is required");
  }

  if (scenario === undefined) {
    return {
      ok: true,
      options: {
        seed,
        ticks,
      },
    };
  }

  return {
    ok: true,
    options: {
      seed,
      ticks,
      scenario,
    },
  };
}

type HeadlessCliResultOptions =
  | {
      readonly ok: true;
      readonly options: HeadlessCliOptions;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

function runSelectedHeadlessScenario(
  options: HeadlessCliOptions,
):
  | HeadlessRunSummary
  | HaulingBuildingScenarioSummary
  | M2WorkLogisticsScenarioSummary
  | M3OrdinaryLifeScenarioSummary
  | M4CoreVerticalSliceScenarioSummary {
  if (options.scenario === "hauling-building") {
    return runHaulingBuildingScenario({ seed: options.seed, ticks: options.ticks });
  }

  if (options.scenario === "m2-work-logistics") {
    return runM2WorkLogisticsScenario({ seed: options.seed, ticks: options.ticks });
  }

  if (options.scenario === M3_ORDINARY_LIFE_ALIAS) {
    return runM3OrdinaryLifeScenario({ seed: options.seed, ticks: options.ticks });
  }

  if (options.scenario === M4_CORE_VERTICAL_SLICE_ALIAS) {
    return runM4CoreVerticalSliceScenario({ seed: options.seed, ticks: options.ticks });
  }

  return runHeadlessTicks(options.seed, options.ticks);
}

function failedOptions(error: string): HeadlessCliResultOptions {
  return {
    ok: false,
    error,
  };
}
