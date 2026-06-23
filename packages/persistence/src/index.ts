import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export const PERSISTENCE_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/persistence",
  "package",
);

export const PERSISTENCE_PROTOCOL_SOURCE: string = SIM_PROTOCOL_SMOKE.packageName;
