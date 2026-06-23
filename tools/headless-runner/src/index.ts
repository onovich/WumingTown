import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_CORE_SMOKE } from "@wuming-town/sim-core";
import { TESTKIT_SMOKE } from "@wuming-town/testkit";

export const HEADLESS_RUNNER_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/headless-runner",
  "tool",
);

export const HEADLESS_RUNNER_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  TESTKIT_SMOKE.packageName,
];
