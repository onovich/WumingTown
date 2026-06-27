import type { PlatformHostInfo } from "./index";

export type M6DiagnosticSeverity = "error" | "info" | "warning";
export type M6DiagnosticStatus = "available" | "blocked" | "not_applicable";
export type M6DiagnosticSafeValue = boolean | number | string | null;

export interface M6DiagnosticBuildInfo {
  readonly appVersion: string;
  readonly gitCommit: string;
  readonly taskId: string;
}

export interface M6DiagnosticPlatformInfo {
  readonly browserTargets: readonly string[];
  readonly crossOriginIsolated: boolean;
  readonly host: PlatformHostInfo;
  readonly runtimeBrowser: string;
}

export interface M6DiagnosticScenarioInfo {
  readonly finalTick: number;
  readonly fixtureId: string;
  readonly scenarioId: string;
}

export interface M6DiagnosticHashEvidence {
  readonly commandStreamHash: string;
  readonly contentManifestHash: string;
  readonly finalReadModelHash: string;
  readonly m4RegressionReadModelHash: string;
}

export interface M6DiagnosticEntryInput {
  readonly code: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly level: M6DiagnosticSeverity;
  readonly message: string;
  readonly timestampUnixMs: number;
}

export interface M6DiagnosticBlockerInput {
  readonly code: string;
  readonly impact: string;
  readonly message: string;
}

export interface M6DiagnosticPackagePathInput {
  readonly suggestedFileName: string;
  readonly webDownloadAvailable: boolean;
  readonly windowsHostPackageAvailable: boolean;
}

export interface M6DiagnosticPackageInput {
  readonly blockers: readonly M6DiagnosticBlockerInput[];
  readonly build: M6DiagnosticBuildInfo;
  readonly generatedAtUnixMs: number;
  readonly hashes: M6DiagnosticHashEvidence;
  readonly packagePath: M6DiagnosticPackagePathInput;
  readonly platform: M6DiagnosticPlatformInfo;
  readonly recentErrors: readonly M6DiagnosticEntryInput[];
  readonly safeLogs: readonly M6DiagnosticEntryInput[];
  readonly scenario: M6DiagnosticScenarioInfo;
}

export interface M6DiagnosticEntry {
  readonly code: string;
  readonly detail: Readonly<Record<string, M6DiagnosticSafeValue>>;
  readonly level: M6DiagnosticSeverity;
  readonly message: string;
  readonly timestampUnixMs: number;
}

export interface M6DiagnosticBlocker {
  readonly code: string;
  readonly impact: string;
  readonly message: string;
}

export interface M6DiagnosticPackagePath {
  readonly suggestedFileName: string;
  readonly webDownload: {
    readonly status: M6DiagnosticStatus;
  };
  readonly windowsHostFilePackage: {
    readonly reason: string;
    readonly status: M6DiagnosticStatus;
  };
}

export interface M6DiagnosticPackage {
  readonly blockers: readonly M6DiagnosticBlocker[];
  readonly build: M6DiagnosticBuildInfo;
  readonly generatedAtUnixMs: number;
  readonly hashes: M6DiagnosticHashEvidence;
  readonly packageKind: "m6-local-diagnostic-package";
  readonly packagePath: M6DiagnosticPackagePath;
  readonly platform: M6DiagnosticPlatformInfo;
  readonly privacy: {
    readonly includesFullSaveContents: false;
    readonly includesPrivatePaths: false;
    readonly networkUpload: false;
    readonly redactionPolicy: string;
    readonly telemetry: false;
  };
  readonly recentErrors: readonly M6DiagnosticEntry[];
  readonly safeLogs: readonly M6DiagnosticEntry[];
  readonly scenario: M6DiagnosticScenarioInfo;
  readonly schemaVersion: 1;
}

const MAX_ENTRIES = 16;
const MAX_DETAIL_KEYS = 12;
const MAX_TEXT_LENGTH = 240;
const REDACTED_PATH = "[redacted-path]";
const REDACTED_SECRET = "[redacted-secret]";
const REDACTED_UNSAFE_FIELD = "[redacted-unsafe-field]";

const UNSAFE_DETAIL_KEY_PARTS = [
  "authorization",
  "bytes",
  "content",
  "contents",
  "cookie",
  "data",
  "file",
  "path",
  "payload",
  "password",
  "raw",
  "save",
  "secret",
  "token",
] as const;

export function buildM6DiagnosticPackage(input: M6DiagnosticPackageInput): M6DiagnosticPackage {
  return Object.freeze({
    blockers: Object.freeze(input.blockers.slice(0, MAX_ENTRIES).map(sanitizeBlocker)),
    build: Object.freeze({
      appVersion: sanitizeText(input.build.appVersion),
      gitCommit: sanitizeText(input.build.gitCommit),
      taskId: sanitizeCode(input.build.taskId),
    }),
    generatedAtUnixMs: input.generatedAtUnixMs,
    hashes: Object.freeze({
      commandStreamHash: sanitizeHash(input.hashes.commandStreamHash),
      contentManifestHash: sanitizeHash(input.hashes.contentManifestHash),
      finalReadModelHash: sanitizeHash(input.hashes.finalReadModelHash),
      m4RegressionReadModelHash: sanitizeHash(input.hashes.m4RegressionReadModelHash),
    }),
    packageKind: "m6-local-diagnostic-package",
    packagePath: buildPackagePath(input.packagePath),
    platform: Object.freeze({
      browserTargets: Object.freeze(input.platform.browserTargets.map(sanitizeText)),
      crossOriginIsolated: input.platform.crossOriginIsolated,
      host: input.platform.host,
      runtimeBrowser: sanitizeText(input.platform.runtimeBrowser),
    }),
    privacy: Object.freeze({
      includesFullSaveContents: false,
      includesPrivatePaths: false,
      networkUpload: false,
      redactionPolicy:
        "Local paths, credential-like values and full-save-like fields are redacted before packaging.",
      telemetry: false,
    }),
    recentErrors: Object.freeze(input.recentErrors.slice(-MAX_ENTRIES).map(sanitizeEntry)),
    safeLogs: Object.freeze(input.safeLogs.slice(-MAX_ENTRIES).map(sanitizeEntry)),
    scenario: Object.freeze({
      finalTick: Math.max(0, Math.trunc(input.scenario.finalTick)),
      fixtureId: sanitizeCode(input.scenario.fixtureId),
      scenarioId: sanitizeCode(input.scenario.scenarioId),
    }),
    schemaVersion: 1,
  });
}

export function encodeM6DiagnosticPackage(pkg: M6DiagnosticPackage): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(pkg, null, 2)}\n`);
}

export function serializeM6DiagnosticPackage(pkg: M6DiagnosticPackage): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function buildPackagePath(input: M6DiagnosticPackagePathInput): M6DiagnosticPackagePath {
  return Object.freeze({
    suggestedFileName: sanitizeFileName(input.suggestedFileName),
    webDownload: Object.freeze({
      status: input.webDownloadAvailable ? "available" : "blocked",
    }),
    windowsHostFilePackage: Object.freeze({
      reason: input.windowsHostPackageAvailable
        ? "Reviewed host diagnostics bridge is available."
        : "Blocked until a reviewed narrow diagnostics bridge exists.",
      status: input.windowsHostPackageAvailable ? "available" : "blocked",
    }),
  });
}

function sanitizeBlocker(input: M6DiagnosticBlockerInput): M6DiagnosticBlocker {
  return Object.freeze({
    code: sanitizeCode(input.code),
    impact: sanitizeText(input.impact),
    message: sanitizeText(input.message),
  });
}

function sanitizeEntry(input: M6DiagnosticEntryInput): M6DiagnosticEntry {
  return Object.freeze({
    code: sanitizeCode(input.code),
    detail: sanitizeDetail(input.detail),
    level: input.level,
    message: sanitizeText(input.message),
    timestampUnixMs: Math.max(0, Math.trunc(input.timestampUnixMs)),
  });
}

function sanitizeDetail(
  detail: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, M6DiagnosticSafeValue>> {
  if (detail === undefined) {
    return Object.freeze({});
  }

  const safeEntries: Record<string, M6DiagnosticSafeValue> = {};
  for (const key of Object.keys(detail).sort().slice(0, MAX_DETAIL_KEYS)) {
    const safeKey = sanitizeCode(key);
    if (isUnsafeDetailKey(key)) {
      safeEntries[safeKey] = REDACTED_UNSAFE_FIELD;
      continue;
    }

    safeEntries[safeKey] = sanitizeValue(detail[key]);
  }

  return Object.freeze(safeEntries);
}

function sanitizeValue(value: unknown): M6DiagnosticSafeValue {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  return REDACTED_UNSAFE_FIELD;
}

function sanitizeCode(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/gu, "_");
  if (normalized.length === 0) {
    return "unknown";
  }

  return normalized.slice(0, 96);
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9_.-]+/gu, "-");
  if (normalized.length === 0) {
    return "wuming-town-m6-diagnostics.json";
  }

  return normalized.slice(0, 96);
}

function sanitizeHash(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (/^0x[0-9a-f]{8}$/u.test(normalized)) {
    return normalized;
  }

  if (/^[0-9a-f]{64}$/u.test(normalized)) {
    return normalized;
  }

  return "invalid";
}

function sanitizeText(value: string): string {
  const withoutSecrets = value.replace(
    /(authorization|api[_-]?key|password|secret|token)\s*[:=]\s*["']?[^"',\s}]+/giu,
    `$1=${REDACTED_SECRET}`,
  );
  const withoutFileUrls = withoutSecrets.replace(/file:\/\/\/?[^\s"'<>|)]+/giu, REDACTED_PATH);
  const withoutWindowsPaths = withoutFileUrls.replace(
    /[A-Za-z]:[\\/][^\s"'<>|)]+/gu,
    REDACTED_PATH,
  );
  const withoutUncPaths = withoutWindowsPaths.replace(
    /\\\\[A-Za-z0-9_.-]+\\[^\s"'<>|)]+/gu,
    REDACTED_PATH,
  );
  const withoutUnixPaths = withoutUncPaths.replace(
    /(^|[\s("'=])\/(?:Users|home|mnt|tmp|var|Volumes)\/[^\s"')<>|]+/gu,
    `$1${REDACTED_PATH}`,
  );
  const compacted = withoutUnixPaths.replace(/\s+/gu, " ").trim();
  if (compacted.length <= MAX_TEXT_LENGTH) {
    return compacted;
  }

  return `${compacted.slice(0, MAX_TEXT_LENGTH)}...`;
}

function isUnsafeDetailKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return UNSAFE_DETAIL_KEY_PARTS.some((part) => normalized.includes(part));
}
