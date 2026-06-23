import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { PERSISTENCE_SMOKE } from "@wuming-town/persistence";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export const PLATFORM_BRIDGE_KEY = "wumingTownPlatform";

export type PlatformHostKind = "electron" | "web";
export type PlatformPortErrorCode = "unavailable";

export interface PlatformHostInfo {
  readonly contextIsolation: boolean;
  readonly kind: PlatformHostKind;
  readonly nodeIntegration: boolean;
  readonly sandboxedRenderer: boolean;
}

export interface PlatformPortError {
  readonly code: PlatformPortErrorCode;
  readonly message: string;
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
  readonly id: string;
  readonly sizeBytes: number;
  readonly updatedAtUnixMs: number;
}

export interface PlatformSaveWriteRequest {
  readonly data: Uint8Array;
  readonly id: string;
}

export interface PlatformModPackageSummary {
  readonly id: string;
  readonly version: string;
}

export interface PlatformSaveStorePort {
  list(): Promise<PlatformCallResult<readonly PlatformSaveSummary[]>>;
  read(id: string): Promise<PlatformCallResult<ArrayBuffer>>;
  remove(id: string): Promise<PlatformCallResult<undefined>>;
  writeAtomic(request: PlatformSaveWriteRequest): Promise<PlatformCallResult<undefined>>;
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

export function createUnavailablePlatformPorts(
  host: PlatformHostInfo,
  message: string,
): PlatformPorts {
  const error = Object.freeze<PlatformPortError>({
    code: "unavailable",
    message,
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
      async list(): Promise<PlatformCallResult<readonly PlatformSaveSummary[]>> {
        return unavailable<readonly PlatformSaveSummary[]>();
      },
      async read(): Promise<PlatformCallResult<ArrayBuffer>> {
        return unavailable<ArrayBuffer>();
      },
      async remove(): Promise<PlatformCallResult<undefined>> {
        return unavailable<undefined>();
      },
      async writeAtomic(): Promise<PlatformCallResult<undefined>> {
        return unavailable<undefined>();
      },
    }),
  });
}

export function resolvePlatformPorts(): PlatformPorts {
  const bridge = readBridgeFromGlobal(globalThis);
  if (bridge !== undefined) {
    return bridge;
  }

  return createUnavailablePlatformPorts(
    WEB_FALLBACK_HOST,
    "Native save and mod ports are unavailable in the browser shell.",
  );
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
