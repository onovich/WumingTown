import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import {
  createBrowserOpfsSaveStore,
  type SaveExportPayload,
  type SaveStoreDiagnosticValue,
  type SaveStoreError,
  type SaveStoreErrorCode,
  type SaveStoreResult,
  type SaveSummary as PersistenceSaveSummary,
  type SaveStoreStatus,
  PERSISTENCE_SMOKE,
} from "@wuming-town/persistence";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export const PLATFORM_BRIDGE_KEY = "wumingTownPlatform";

export {
  buildM6GateSaveEnvelope,
  decodeM6GateSaveEnvelope,
  encodeM6GateSaveEnvelope,
} from "@wuming-town/persistence";

export {
  buildM6DiagnosticPackage,
  encodeM6DiagnosticPackage,
  serializeM6DiagnosticPackage,
  type M6DiagnosticBlocker,
  type M6DiagnosticBlockerInput,
  type M6DiagnosticBuildInfo,
  type M6DiagnosticEntry,
  type M6DiagnosticEntryInput,
  type M6DiagnosticHashEvidence,
  type M6DiagnosticPackage,
  type M6DiagnosticPackageInput,
  type M6DiagnosticPackagePath,
  type M6DiagnosticPackagePathInput,
  type M6DiagnosticPlatformInfo,
  type M6DiagnosticSafeValue,
  type M6DiagnosticScenarioInfo,
  type M6DiagnosticSeverity,
  type M6DiagnosticStatus,
} from "./diagnostics";

export type PlatformHostKind = "electron" | "web";
export type PlatformPortErrorCode = SaveStoreErrorCode | "unavailable";

export interface PlatformHostInfo {
  readonly contextIsolation: boolean;
  readonly kind: PlatformHostKind;
  readonly nodeIntegration: boolean;
  readonly sandboxedRenderer: boolean;
}

export interface PlatformPortError {
  readonly code: PlatformPortErrorCode;
  readonly detail?: Readonly<Record<string, SaveStoreDiagnosticValue>>;
  readonly message: string;
  readonly recoverable?: boolean;
  readonly userMessage?: string;
}

export type PlatformCallResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly error: PlatformPortError;
      readonly ok: false;
    };

export interface PlatformSaveSummary {
  readonly checksumSha256Hex: string;
  readonly id: string;
  readonly sizeBytes: number;
  readonly updatedAtUnixMs: number;
}

export interface PlatformSaveWriteRequest {
  readonly data: Uint8Array;
  readonly id: string;
}

export interface PlatformSaveExportPayload {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly suggestedFileName: string;
  readonly summary: PlatformSaveSummary;
}

export interface PlatformSaveStoreStatus {
  readonly available: boolean;
  readonly kind: "opfs";
  readonly quota: {
    readonly availableBytes: number | null;
    readonly quotaBytes: number | null;
    readonly usageBytes: number | null;
  };
}

export interface PlatformModPackageSummary {
  readonly id: string;
  readonly version: string;
}

export interface PlatformSaveStorePort {
  describe?(): Promise<PlatformCallResult<PlatformSaveStoreStatus>>;
  export?(id: string): Promise<PlatformCallResult<PlatformSaveExportPayload>>;
  list(): Promise<PlatformCallResult<readonly PlatformSaveSummary[]>>;
  read(id: string): Promise<PlatformCallResult<ArrayBuffer>>;
  remove(id: string): Promise<PlatformCallResult<undefined>>;
  writeAtomic(request: PlatformSaveWriteRequest): Promise<PlatformCallResult<PlatformSaveSummary>>;
}

export interface PlatformModsPort {
  importArchive(
    archiveName: string,
    bytes: Uint8Array,
  ): Promise<PlatformCallResult<PlatformModPackageSummary>>;
  listPackages(): Promise<PlatformCallResult<readonly PlatformModPackageSummary[]>>;
}

export interface PlatformPorts {
  readonly host: PlatformHostInfo;
  readonly mods: PlatformModsPort;
  readonly saveStore: PlatformSaveStorePort;
}

export const PLATFORM_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/platform",
  "package",
);

export const PLATFORM_PUBLIC_DEPENDENCIES: readonly string[] = [
  PERSISTENCE_SMOKE.packageName,
  SIM_PROTOCOL_SMOKE.packageName,
];

const WEB_FALLBACK_HOST: PlatformHostInfo = Object.freeze({
  contextIsolation: false,
  kind: "web",
  nodeIntegration: false,
  sandboxedRenderer: false,
});

const WEB_SAVE_STORE = createBrowserOpfsSaveStore();

export function createUnavailablePlatformPorts(
  host: PlatformHostInfo,
  message: string,
): PlatformPorts {
  const error = Object.freeze<PlatformPortError>({
    code: "unavailable",
    detail: Object.freeze({}),
    message,
    recoverable: false,
    userMessage: message,
  });

  const unavailable = <T>(): Promise<PlatformCallResult<T>> =>
    Promise.resolve({
      error,
      ok: false,
    });

  return Object.freeze({
    host,
    mods: Object.freeze({
      async importArchive(): Promise<PlatformCallResult<PlatformModPackageSummary>> {
        return unavailable<PlatformModPackageSummary>();
      },
      async listPackages(): Promise<PlatformCallResult<readonly PlatformModPackageSummary[]>> {
        return unavailable<readonly PlatformModPackageSummary[]>();
      },
    }),
    saveStore: Object.freeze({
      async describe(): Promise<PlatformCallResult<PlatformSaveStoreStatus>> {
        return unavailable<PlatformSaveStoreStatus>();
      },
      async export(): Promise<PlatformCallResult<PlatformSaveExportPayload>> {
        return unavailable<PlatformSaveExportPayload>();
      },
      async list(): Promise<PlatformCallResult<readonly PlatformSaveSummary[]>> {
        return unavailable<readonly PlatformSaveSummary[]>();
      },
      async read(): Promise<PlatformCallResult<ArrayBuffer>> {
        return unavailable<ArrayBuffer>();
      },
      async remove(): Promise<PlatformCallResult<undefined>> {
        return unavailable<undefined>();
      },
      async writeAtomic(): Promise<PlatformCallResult<PlatformSaveSummary>> {
        return unavailable<PlatformSaveSummary>();
      },
    }),
  });
}

export function resolvePlatformPorts(): PlatformPorts {
  const bridge = readBridgeFromGlobal(globalThis);
  if (bridge !== undefined) {
    return bridge;
  }

  return Object.freeze({
    host: WEB_FALLBACK_HOST,
    mods: createUnavailablePlatformPorts(
      WEB_FALLBACK_HOST,
      "Native mod ports are unavailable in the browser shell.",
    ).mods,
    saveStore: createWebPlatformSaveStore(),
  });
}

function isHostInfo(value: unknown): value is PlatformHostInfo {
  return (
    isRecord(value) &&
    (value["kind"] === "electron" || value["kind"] === "web") &&
    typeof value["contextIsolation"] === "boolean" &&
    typeof value["nodeIntegration"] === "boolean" &&
    typeof value["sandboxedRenderer"] === "boolean"
  );
}

function isModsPort(value: unknown): value is PlatformModsPort {
  return (
    isRecord(value) &&
    typeof value["importArchive"] === "function" &&
    typeof value["listPackages"] === "function"
  );
}

function isPlatformPorts(value: unknown): value is PlatformPorts {
  return (
    isRecord(value) &&
    isHostInfo(value["host"]) &&
    isModsPort(value["mods"]) &&
    isSaveStorePort(value["saveStore"])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSaveStorePort(value: unknown): value is PlatformSaveStorePort {
  return (
    isRecord(value) &&
    typeof value["list"] === "function" &&
    typeof value["read"] === "function" &&
    typeof value["remove"] === "function" &&
    typeof value["writeAtomic"] === "function"
  );
}

function createWebPlatformSaveStore(): PlatformSaveStorePort {
  return Object.freeze({
    async describe(): Promise<PlatformCallResult<PlatformSaveStoreStatus>> {
      return mapSaveStoreResult(await WEB_SAVE_STORE.describe(), mapStatus);
    },
    async export(id: string): Promise<PlatformCallResult<PlatformSaveExportPayload>> {
      return mapSaveStoreResult(await WEB_SAVE_STORE.export(id), mapExportPayload);
    },
    async list(): Promise<PlatformCallResult<readonly PlatformSaveSummary[]>> {
      return mapSaveStoreResult(await WEB_SAVE_STORE.list(), mapSaveSummaries);
    },
    async read(id: string): Promise<PlatformCallResult<ArrayBuffer>> {
      return mapSaveStoreResult(await WEB_SAVE_STORE.read(id), toArrayBuffer);
    },
    async remove(id: string): Promise<PlatformCallResult<undefined>> {
      return mapSaveStoreResult(await WEB_SAVE_STORE.remove(id), (value) => value);
    },
    async writeAtomic(
      request: PlatformSaveWriteRequest,
    ): Promise<PlatformCallResult<PlatformSaveSummary>> {
      return mapSaveStoreResult(await WEB_SAVE_STORE.writeAtomic(request), mapSaveSummary);
    },
  });
}

function mapExportPayload(value: SaveExportPayload): PlatformSaveExportPayload {
  return Object.freeze({
    bytes: value.bytes,
    mediaType: value.mediaType,
    suggestedFileName: value.suggestedFileName,
    summary: mapSaveSummary(value.summary),
  });
}

function mapPlatformError(error: SaveStoreError): PlatformPortError {
  return Object.freeze({
    code: error.code,
    detail: Object.freeze({
      ...error.detail,
    }),
    message: error.message,
    recoverable: error.recoverable,
    userMessage: error.userMessage,
  });
}

function mapSaveStoreResult<TInput, TOutput>(
  result: SaveStoreResult<TInput>,
  mapValue: (value: TInput) => TOutput,
): PlatformCallResult<TOutput> {
  if (!result.ok) {
    return {
      error: mapPlatformError(result.error),
      ok: false,
    };
  }

  return {
    ok: true,
    value: mapValue(result.value),
  };
}

function mapSaveSummaries(
  value: readonly PersistenceSaveSummary[],
): readonly PlatformSaveSummary[] {
  return value.map(mapSaveSummary);
}

function mapSaveSummary(value: PersistenceSaveSummary): PlatformSaveSummary {
  return Object.freeze({
    checksumSha256Hex: value.checksumSha256Hex,
    id: value.id,
    sizeBytes: value.sizeBytes,
    updatedAtUnixMs: value.updatedAtUnixMs,
  });
}

function mapStatus(value: SaveStoreStatus): PlatformSaveStoreStatus {
  return Object.freeze({
    available: value.available,
    kind: value.kind,
    quota: Object.freeze({
      availableBytes: value.quota.availableBytes,
      quotaBytes: value.quota.quotaBytes,
      usageBytes: value.quota.usageBytes,
    }),
  });
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function readBridgeFromGlobal(value: unknown): PlatformPorts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const candidate = value[PLATFORM_BRIDGE_KEY];
  if (!isPlatformPorts(candidate)) {
    return undefined;
  }

  return candidate;
}
