import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import {
  HAULING_BUILDING_SCENARIO_ID,
  SIM_CORE_SMOKE,
  isSafeTick,
  runHaulingBuildingScenario,
  runHeadlessTicks,
  type HaulingBuildingScenarioSummary,
  type HeadlessRunSummary,
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
  readonly scenario?: "hauling-building";
}

export type HeadlessCliResult =
  | {
      readonly ok: true;
      readonly summary: HeadlessRunSummary | HaulingBuildingScenarioSummary;
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

  const summary =
    parsed.options.scenario === "hauling-building"
      ? runHaulingBuildingScenario({ seed: parsed.options.seed, ticks: parsed.options.ticks })
      : runHeadlessTicks(parsed.options.seed, parsed.options.ticks);
  io.writeLine(JSON.stringify(summary, undefined, 2));
  return 0;
}

export function parseHeadlessCliOptions(argv: readonly string[]): HeadlessCliResultOptions {
  let seed: string | undefined;
  let ticks: number | undefined;
  let scenario: "hauling-building" | undefined;
  let index = 0;

  while (index < argv.length) {
    const arg = argv[index];

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
      if (value !== "hauling-building") {
        return failedOptions(
          `--scenario currently supports only hauling-building (${HAULING_BUILDING_SCENARIO_ID})`,
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

function failedOptions(error: string): HeadlessCliResultOptions {
  return {
    ok: false,
    error,
  };
}
