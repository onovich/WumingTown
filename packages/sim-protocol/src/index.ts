import { CONTENT_SCHEMA_SMOKE } from "@wuming-town/content-schema";
import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export const SIM_PROTOCOL_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-protocol",
  "package",
);

export const SIM_PROTOCOL_PUBLIC_INPUTS: readonly string[] = [CONTENT_SCHEMA_SMOKE.packageName];
