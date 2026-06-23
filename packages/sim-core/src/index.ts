import { CONTENT_SCHEMA_SMOKE } from "@wuming-town/content-schema";
import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export const SIM_CORE_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-core",
  "package",
);

export const SIM_CORE_ALLOWED_INPUTS: readonly string[] = [CONTENT_SCHEMA_SMOKE.packageName];
