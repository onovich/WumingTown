import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export { defineWorkspaceSmoke } from "@wuming-town/foundation";
export {
  compileContentFixture,
  compileContentFixtureByName,
  compileLoadedContentFixture,
  formatCompilationFailure,
} from "./compiler";
export type {
  CompiledContentDefinition,
  ContentCompilationCatalog,
  ContentCompilationOutcome,
} from "./compiler";

export const CONTENT_COMPILER_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/content-compiler",
  "package",
);

export const CONTENT_COMPILER_PUBLIC_DEPENDENCIES: readonly string[] = [
  "@wuming-town/content-schema",
];
