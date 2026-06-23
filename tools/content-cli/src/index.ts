import { CONTENT_COMPILER_SMOKE } from "@wuming-town/content-compiler";
import { CONTENT_SCHEMA_SMOKE } from "@wuming-town/content-schema";
import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export const CONTENT_CLI_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/content-cli",
  "tool",
);

export const CONTENT_CLI_PUBLIC_DEPENDENCIES: readonly string[] = [
  CONTENT_COMPILER_SMOKE.packageName,
  CONTENT_SCHEMA_SMOKE.packageName,
];
