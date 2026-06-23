import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export { defineWorkspaceSmoke } from "@wuming-town/foundation";
export {
  DEF_BASE_ID_PATTERN,
  discoverContentFixtureRoots,
  formatContentDiagnostic,
  loadContentFixture,
  validateContentFixture,
} from "./content-fixtures";
export type {
  ContentDiagnostic,
  ContentFixture,
  ContentRawFile,
  ContentReference,
  ContentSourceLocation,
  ContentValidationOutcome,
  ValidatedContentFixture,
  ValidatedDefinitionFile,
  ValidatedLocaleFile,
  ValidatedPatchFile,
} from "./content-fixtures";

export const CONTENT_SCHEMA_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/content-schema",
  "package",
);
