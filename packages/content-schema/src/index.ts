import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export { defineWorkspaceSmoke } from "@wuming-town/foundation";
export {
  DEF_BASE_ID_PATTERN,
  discoverContentFixtureRoots,
  formatContentDiagnostic,
  loadContentFixture,
  validateContentFixture,
} from "./content-fixtures";
export {
  M5_CONTENT_SCHEMA_VERSION,
  M5_DEFAULT_MAX_FILE_BYTES,
  M5_DEFAULT_MAX_PATH_SEGMENTS,
  M5_DEFAULT_MAX_TOTAL_BYTES,
  M5_SUPPORTED_CAPABILITIES,
  M5_SUPPORTED_CONTENT_KINDS,
  loadM5ContentPackFromDirectory,
  validateM5ContentPack,
} from "./m5-content-validation";
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
export type {
  M5ContentCapability,
  M5ContentKind,
  M5ContentManifest,
  M5ContentPack,
  M5ContentPackFile,
  M5ContentValidationCounters,
  M5ContentValidationOptions,
  M5ContentValidationOutcome,
  M5ValidatedContentPack,
} from "./m5-content-validation";

export const CONTENT_SCHEMA_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/content-schema",
  "package",
);
