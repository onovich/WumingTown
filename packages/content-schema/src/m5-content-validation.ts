import type { ContentDiagnostic } from "./content-fixtures";
import { validateContentFixture } from "./content-fixtures";
import {
  buildContentFixture,
  isJsonContentPath,
  validatePackFileSafety,
} from "./m5-content-pack-files";
import { parseManifest } from "./m5-content-manifest";
import {
  buildCounters,
  buildSemanticDefinitions,
  validateM5Semantics,
} from "./m5-content-semantics";
import {
  M5_DEFAULT_MAX_FILE_BYTES,
  M5_DEFAULT_MAX_PATH_SEGMENTS,
  M5_DEFAULT_MAX_TOTAL_BYTES,
  type M5ContentPack,
  type M5ContentManifest,
  type M5ContentValidationOptions,
  type M5ContentValidationOutcome,
  type ParsedM5File,
} from "./m5-content-validation-types";
import { fileLocation, parseContentDocument, rootLocation } from "./m5-content-validation-utils";

export { loadM5ContentPackFromDirectory } from "./m5-content-pack-files";
export {
  M5_CONTENT_SCHEMA_VERSION,
  M5_DEFAULT_MAX_FILE_BYTES,
  M5_DEFAULT_MAX_PATH_SEGMENTS,
  M5_DEFAULT_MAX_TOTAL_BYTES,
  M5_SUPPORTED_CAPABILITIES,
  M5_SUPPORTED_CONTENT_KINDS,
} from "./m5-content-validation-types";
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
} from "./m5-content-validation-types";

interface MeasuredM5File {
  readonly relativePath: string;
  readonly byteLength: number;
}

export function validateM5ContentPack(
  pack: M5ContentPack,
  options: M5ContentValidationOptions = {},
): M5ContentValidationOutcome {
  const diagnostics: ContentDiagnostic[] = [];
  const maxFileBytes = options.maxFileBytes ?? M5_DEFAULT_MAX_FILE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? M5_DEFAULT_MAX_TOTAL_BYTES;
  const maxPathSegments = options.maxPathSegments ?? M5_DEFAULT_MAX_PATH_SEGMENTS;
  const parsedFiles: ParsedM5File[] = [];
  const measuredFiles: MeasuredM5File[] = [];
  let byteCount = 0;

  for (const file of pack.files) {
    const byteLength = Buffer.byteLength(file.text, "utf8");
    measuredFiles.push({
      relativePath: file.relativePath,
      byteLength,
    });
    byteCount += byteLength;
    validatePackFileSafety(file, byteLength, maxFileBytes, maxPathSegments, diagnostics);

    if (isJsonContentPath(file.relativePath)) {
      const parsed = parseContentDocument(file.relativePath, file.text);
      if (parsed.ok) {
        parsedFiles.push({ file, json: parsed.json });
      } else {
        parsedFiles.push({
          file,
          json: undefined,
          parseError: parsed.error,
        });
      }
    }
  }

  if (byteCount > maxTotalBytes) {
    diagnostics.push({
      code: "m5_total_size_exceeded",
      message: `M5 content pack uses ${String(byteCount)} bytes; maximum is ${String(
        maxTotalBytes,
      )}`,
      location: rootLocation(pack.rootDir),
      relatedLocations: [],
    });
  }

  const manifest = parseManifest(
    pack.rootDir,
    parsedFiles,
    maxFileBytes,
    maxTotalBytes,
    diagnostics,
  );
  if (manifest !== undefined) {
    validateManifestDeclaredSizeLimits(
      manifest,
      pack.rootDir,
      measuredFiles,
      byteCount,
      maxFileBytes,
      maxTotalBytes,
      diagnostics,
    );
  }
  const fixture = buildContentFixture(pack.rootDir, parsedFiles, diagnostics);
  const genericResult = validateContentFixture(fixture);
  diagnostics.push(...genericResult.diagnostics);

  const semanticDefinitions = buildSemanticDefinitions(parsedFiles);
  diagnostics.push(...validateM5Semantics(semanticDefinitions, parsedFiles));

  const counters = buildCounters(byteCount, fixture, semanticDefinitions, diagnostics.length);
  if (
    manifest === undefined ||
    !genericResult.ok ||
    genericResult.fixture === undefined ||
    diagnostics.length > 0
  ) {
    return {
      ok: false,
      diagnostics,
      counters,
    };
  }

  return {
    ok: true,
    diagnostics: [],
    counters,
    pack: {
      rootDir: pack.rootDir,
      manifest,
      fixture: genericResult.fixture,
      counters,
    },
  };
}

function validateManifestDeclaredSizeLimits(
  manifest: M5ContentManifest,
  rootDir: string,
  measuredFiles: readonly MeasuredM5File[],
  byteCount: number,
  activeMaxFileBytes: number,
  activeMaxTotalBytes: number,
  diagnostics: ContentDiagnostic[],
): void {
  if (manifest.maxFileBytes < activeMaxFileBytes) {
    for (const file of measuredFiles) {
      if (file.byteLength > manifest.maxFileBytes) {
        diagnostics.push({
          code: "m5_file_size_exceeded",
          message: `${file.relativePath} is ${String(
            file.byteLength,
          )} bytes; manifest maximum is ${String(manifest.maxFileBytes)}`,
          location: fileLocation(file.relativePath),
          relatedLocations: [],
        });
      }
    }
  }

  if (manifest.maxTotalBytes < activeMaxTotalBytes && byteCount > manifest.maxTotalBytes) {
    diagnostics.push({
      code: "m5_total_size_exceeded",
      message: `M5 content pack uses ${String(byteCount)} bytes; manifest maximum is ${String(
        manifest.maxTotalBytes,
      )}`,
      location: rootLocation(rootDir),
      relatedLocations: [],
    });
  }
}
