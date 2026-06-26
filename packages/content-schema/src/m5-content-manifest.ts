import { DEF_BASE_ID_PATTERN, type ContentDiagnostic } from "./content-fixtures";
import {
  readInteger,
  readOptionalInteger,
  readOptionalStringArray,
  readString,
  readStringArray,
  validateKnownFields,
} from "./m5-content-manifest-readers";
import { isLocalePath, isManifestPath } from "./m5-content-pack-files";
import {
  M5_CONTENT_SCHEMA_VERSION,
  type M5ContentCapability,
  type M5ContentKind,
  type M5ContentManifest,
  type ParsedM5File,
  parseM5Capability,
  parseM5Kind,
} from "./m5-content-validation-types";
import { asRecord, fieldLocation, fileLocation, rootLocation } from "./m5-content-validation-utils";

export function parseManifest(
  rootDir: string,
  parsedFiles: readonly ParsedM5File[],
  defaultMaxFileBytes: number,
  defaultMaxTotalBytes: number,
  diagnostics: ContentDiagnostic[],
): M5ContentManifest | undefined {
  const manifestFiles = parsedFiles.filter((entry) => isManifestPath(entry.file.relativePath));
  if (manifestFiles.length === 0) {
    diagnostics.push({
      code: "m5_manifest_missing",
      message: "M5 content pack requires manifest.json or manifest.json5",
      location: rootLocation(rootDir),
      relatedLocations: [],
    });
    return undefined;
  }

  if (manifestFiles.length > 1) {
    const [first, ...remaining] = manifestFiles;
    diagnostics.push({
      code: "m5_manifest_duplicate",
      message: "M5 content pack has multiple manifests",
      location: first ? fileLocation(first.file.relativePath) : rootLocation(rootDir),
      relatedLocations: remaining.map((entry) => fileLocation(entry.file.relativePath)),
    });
    return undefined;
  }

  const manifestFile = manifestFiles[0];
  if (manifestFile === undefined) {
    return undefined;
  }

  if (manifestFile.parseError !== undefined) {
    diagnostics.push({
      code: "m5_manifest_syntax",
      message: manifestFile.parseError,
      location: fileLocation(manifestFile.file.relativePath),
      relatedLocations: [],
    });
    return undefined;
  }

  const data = asRecord(manifestFile.json);
  if (data === undefined) {
    diagnostics.push({
      code: "m5_manifest_invalid_shape",
      message: "M5 manifest must be an object",
      location: fileLocation(manifestFile.file.relativePath),
      relatedLocations: [],
    });
    return undefined;
  }

  validateKnownFields(
    data,
    [
      "schemaVersion",
      "id",
      "version",
      "displayName",
      "capabilities",
      "contentKinds",
      "locales",
      "dependencies",
      "maxFileBytes",
      "maxTotalBytes",
    ],
    "m5_manifest_unknown_field",
    manifestFile.file.relativePath,
    diagnostics,
  );

  const schemaVersion = readInteger(
    data,
    "schemaVersion",
    manifestFile.file.relativePath,
    diagnostics,
  );
  const id = readString(data, "id", manifestFile.file.relativePath, diagnostics);
  const version = readString(data, "version", manifestFile.file.relativePath, diagnostics);
  const displayName = readString(data, "displayName", manifestFile.file.relativePath, diagnostics);
  const capabilities = readStringArray(
    data,
    "capabilities",
    manifestFile.file.relativePath,
    diagnostics,
  );
  const contentKinds = readStringArray(
    data,
    "contentKinds",
    manifestFile.file.relativePath,
    diagnostics,
  );
  const locales = readStringArray(data, "locales", manifestFile.file.relativePath, diagnostics);
  const dependencies =
    readOptionalStringArray(data, "dependencies", manifestFile.file.relativePath, diagnostics) ??
    [];
  const maxFileBytes =
    readOptionalInteger(data, "maxFileBytes", manifestFile.file.relativePath, diagnostics) ??
    defaultMaxFileBytes;
  const maxTotalBytes =
    readOptionalInteger(data, "maxTotalBytes", manifestFile.file.relativePath, diagnostics) ??
    defaultMaxTotalBytes;

  if (
    schemaVersion === undefined ||
    id === undefined ||
    version === undefined ||
    displayName === undefined ||
    capabilities === undefined ||
    contentKinds === undefined ||
    locales === undefined
  ) {
    return undefined;
  }

  if (schemaVersion !== M5_CONTENT_SCHEMA_VERSION) {
    diagnostics.push({
      code: "m5_manifest_schema_version_unsupported",
      message: `M5 manifest schemaVersion must be ${String(M5_CONTENT_SCHEMA_VERSION)}`,
      location: fieldLocation(manifestFile.file.relativePath),
      relatedLocations: [],
    });
  }

  if (!DEF_BASE_ID_PATTERN.test(id)) {
    diagnostics.push({
      code: "m5_manifest_invalid_id",
      message: `Invalid M5 manifest id ${id}`,
      location: fieldLocation(manifestFile.file.relativePath),
      relatedLocations: [],
    });
  }

  const manifestCapabilities = parseManifestCapabilities(
    capabilities,
    manifestFile.file.relativePath,
    diagnostics,
  );
  const manifestContentKinds = parseManifestContentKinds(
    contentKinds,
    manifestFile.file.relativePath,
    diagnostics,
  );
  validateManifestLocales(locales, parsedFiles, manifestFile.file.relativePath, diagnostics);
  validateManifestDependencies(dependencies, manifestFile.file.relativePath, diagnostics);

  if (maxFileBytes <= 0 || maxFileBytes > defaultMaxFileBytes) {
    diagnostics.push({
      code: "m5_manifest_invalid_size_limit",
      message: `maxFileBytes must be between 1 and ${String(defaultMaxFileBytes)}`,
      location: fieldLocation(manifestFile.file.relativePath),
      relatedLocations: [],
    });
  }

  if (maxTotalBytes <= 0 || maxTotalBytes > defaultMaxTotalBytes) {
    diagnostics.push({
      code: "m5_manifest_invalid_size_limit",
      message: `maxTotalBytes must be between 1 and ${String(defaultMaxTotalBytes)}`,
      location: fieldLocation(manifestFile.file.relativePath),
      relatedLocations: [],
    });
  }

  if (
    manifestCapabilities === undefined ||
    manifestContentKinds === undefined ||
    diagnostics.some((diagnostic) => diagnostic.code.startsWith("m5_manifest_"))
  ) {
    return undefined;
  }

  return {
    schemaVersion: M5_CONTENT_SCHEMA_VERSION,
    id,
    version,
    displayName,
    capabilities: manifestCapabilities,
    contentKinds: manifestContentKinds,
    locales,
    dependencies,
    maxFileBytes,
    maxTotalBytes,
  };
}

function parseManifestCapabilities(
  capabilities: readonly string[],
  filePath: string,
  diagnostics: ContentDiagnostic[],
): readonly M5ContentCapability[] | undefined {
  const accepted: M5ContentCapability[] = [];
  for (const capability of capabilities) {
    const supportedCapability = parseM5Capability(capability);
    if (supportedCapability === undefined) {
      diagnostics.push({
        code: "m5_unsupported_capability",
        message: `Unsupported M5 content capability ${capability}`,
        location: fieldLocation(filePath),
        relatedLocations: [],
      });
      continue;
    }
    accepted.push(supportedCapability);
  }
  return accepted.length === capabilities.length ? accepted : undefined;
}

function parseManifestContentKinds(
  kinds: readonly string[],
  filePath: string,
  diagnostics: ContentDiagnostic[],
): readonly M5ContentKind[] | undefined {
  const accepted: M5ContentKind[] = [];
  for (const kind of kinds) {
    const supportedKind = parseM5Kind(kind);
    if (supportedKind === undefined) {
      diagnostics.push({
        code: "m5_unsupported_content_kind",
        message: `Unsupported M5 content kind ${kind}`,
        location: fieldLocation(filePath),
        relatedLocations: [],
      });
      continue;
    }
    accepted.push(supportedKind);
  }
  return accepted.length === kinds.length ? accepted : undefined;
}

function validateManifestLocales(
  locales: readonly string[],
  parsedFiles: readonly ParsedM5File[],
  filePath: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (locales.length === 0) {
    diagnostics.push({
      code: "m5_manifest_invalid_shape",
      message: "M5 manifest locales must not be empty",
      location: fieldLocation(filePath),
      relatedLocations: [],
    });
  }

  const localeFiles = new Set(
    parsedFiles
      .filter((entry) => isLocalePath(entry.file.relativePath))
      .map((entry) => entry.file.relativePath),
  );
  for (const locale of locales) {
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
      diagnostics.push({
        code: "m5_manifest_invalid_locale",
        message: `Invalid locale ${locale}`,
        location: fieldLocation(filePath),
        relatedLocations: [],
      });
      continue;
    }

    const jsonPath = `locales/${locale}.json`;
    const json5Path = `locales/${locale}.json5`;
    if (!localeFiles.has(jsonPath) && !localeFiles.has(json5Path)) {
      diagnostics.push({
        code: "m5_manifest_missing_locale_file",
        message: `Missing locale file for ${locale}`,
        location: fieldLocation(filePath),
        relatedLocations: [],
      });
    }
  }
}

function validateManifestDependencies(
  dependencies: readonly string[],
  filePath: string,
  diagnostics: ContentDiagnostic[],
): void {
  for (const dependency of dependencies) {
    if (/^https?:\/\//i.test(dependency)) {
      diagnostics.push({
        code: "m5_remote_dependency_forbidden",
        message: `Remote dependency ${dependency} is forbidden`,
        location: fieldLocation(filePath),
        relatedLocations: [],
      });
    }
  }
}
