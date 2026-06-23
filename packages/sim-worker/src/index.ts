import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_CORE_SMOKE } from "@wuming-town/sim-core";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export const SIM_WORKER_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-worker",
  "package",
);

export const SIM_WORKER_PUBLIC_DEPENDENCIES: readonly string[] = [
  SIM_CORE_SMOKE.packageName,
  SIM_PROTOCOL_SMOKE.packageName,
];
