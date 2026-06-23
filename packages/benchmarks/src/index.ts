import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_CORE_SMOKE } from "@wuming-town/sim-core";
import { TESTKIT_SMOKE } from "@wuming-town/testkit";

export const BENCHMARKS_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/benchmarks",
  "package",
);

export const BENCHMARKS_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  TESTKIT_SMOKE.packageName,
];
