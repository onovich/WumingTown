import type {
  ContentDiagnostic,
  ContentSourceLocation,
  ValidatedContentFixture,
} from "./content-fixtures";

export const M5_CONTENT_SCHEMA_VERSION = 1;
export const M5_DEFAULT_MAX_FILE_BYTES = 64 * 1024;
export const M5_DEFAULT_MAX_TOTAL_BYTES = 512 * 1024;
export const M5_DEFAULT_MAX_PATH_SEGMENTS = 8;

export const M5_SUPPORTED_CONTENT_KINDS = [
  "m5.anomaly",
  "m5.faction_hook",
  "m5.governance_hook",
  "m5.season_event",
  "m5.catalog_entry",
] as const;

export const M5_SUPPORTED_CAPABILITIES = [
  "data:def",
  "data:locale",
  "data:patch",
  "content:m5-alpha",
] as const;

export type M5ContentKind = (typeof M5_SUPPORTED_CONTENT_KINDS)[number];
export type M5ContentCapability = (typeof M5_SUPPORTED_CAPABILITIES)[number];

export interface M5ContentPackFile {
  readonly relativePath: string;
  readonly text: string;
  readonly byteLength?: number;
}

export interface M5ContentPack {
  readonly rootDir: string;
  readonly files: readonly M5ContentPackFile[];
}

export interface M5ContentManifest {
  readonly schemaVersion: typeof M5_CONTENT_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly capabilities: readonly M5ContentCapability[];
  readonly contentKinds: readonly M5ContentKind[];
  readonly locales: readonly string[];
  readonly dependencies: readonly string[];
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
}

export interface M5ValidatedContentPack {
  readonly rootDir: string;
  readonly manifest: M5ContentManifest;
  readonly fixture: ValidatedContentFixture;
  readonly counters: M5ContentValidationCounters;
}

export interface M5ContentValidationCounters {
  readonly fileCount: number;
  readonly definitionCount: number;
  readonly localeCount: number;
  readonly patchCount: number;
  readonly byteCount: number;
  readonly anomalyCount: number;
  readonly factionHookCount: number;
  readonly governanceHookCount: number;
  readonly seasonEventCount: number;
  readonly catalogEntryCount: number;
  readonly diagnosticCount: number;
}

export interface M5ContentValidationOutcome {
  readonly ok: boolean;
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly pack?: M5ValidatedContentPack;
  readonly counters: M5ContentValidationCounters;
}

export interface M5ContentValidationOptions {
  readonly maxFileBytes?: number;
  readonly maxTotalBytes?: number;
  readonly maxPathSegments?: number;
}

export interface ParsedM5File {
  readonly file: M5ContentPackFile;
  readonly json: unknown;
  readonly parseError?: string;
}

export interface M5SemanticDefinition {
  readonly id: string;
  readonly kind: string;
  readonly schemaVersion: number;
  readonly locations: {
    readonly schemaVersion: ContentSourceLocation;
    readonly id: ContentSourceLocation;
    readonly kind: ContentSourceLocation;
  };
}

export function parseM5Kind(kind: string): M5ContentKind | undefined {
  for (const supportedKind of M5_SUPPORTED_CONTENT_KINDS) {
    if (kind === supportedKind) {
      return supportedKind;
    }
  }
  return undefined;
}

export function parseM5Capability(capability: string): M5ContentCapability | undefined {
  for (const supportedCapability of M5_SUPPORTED_CAPABILITIES) {
    if (capability === supportedCapability) {
      return supportedCapability;
    }
  }
  return undefined;
}
