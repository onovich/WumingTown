import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { PERSISTENCE_SMOKE } from "@wuming-town/persistence";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export const PLATFORM_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/platform",
  "package",
);

export const PLATFORM_PUBLIC_DEPENDENCIES: readonly string[] = [
  PERSISTENCE_SMOKE.packageName,
  SIM_PROTOCOL_SMOKE.packageName,
];
