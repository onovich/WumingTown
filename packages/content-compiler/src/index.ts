import { CONTENT_SCHEMA_SMOKE } from "@wuming-town/content-schema";
import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export const CONTENT_COMPILER_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/content-compiler",
  "package",
);

export const CONTENT_COMPILER_PUBLIC_DEPENDENCIES: readonly string[] = [
  CONTENT_SCHEMA_SMOKE.packageName,
];
