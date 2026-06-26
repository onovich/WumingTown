import {
  type OpfsSaveStoreOptions,
  type SaveExportPayload,
  type SaveStoreError,
  type SaveStorePort,
  type SaveStoreQuotaEstimate,
  type SaveStoreResult,
  type SaveStoreStatus,
  type SaveSummary,
  type SaveWriteRequest,
  type StorageDirectoryEntryLike,
  type StorageDirectoryLike,
  type StorageFileLike,
  type StorageWritableLike,
} from "./save-store-types";
import { computeSha256Hex } from "./m6-gate-save";

const ACTIVE_SLOT_A = "a.bin";
const ACTIVE_SLOT_B = "b.bin";
const MANIFEST_FILE_NAME = "manifest.json";
const SAVE_FILE_MEDIA_TYPE = "application/vnd.wuming-town.m6-gate+json";
const SAVE_ROOT_DIRECTORY_NAME = "m6-gate-saves";
const SAVE_SCOPE_DIRECTORY_NAME = "wuming-town";
const VALID_SAVE_ID = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

interface BrowserDirectoryLike {
  readonly entries: (() => AsyncIterable<readonly [string, unknown]>) | undefined;
  getDirectoryHandle(
    name: string,
    options?: {
      readonly create?: boolean;
    },
  ): Promise<BrowserDirectoryLike>;
  getFileHandle(
    name: string,
    options?: {
      readonly create?: boolean;
    },
  ): Promise<BrowserFileLike>;
  removeEntry(
    name: string,
    options?: {
      readonly recursive?: boolean;
    },
  ): Promise<void>;
}

interface BrowserFileLike {
  createWritable(): Promise<BrowserWritableLike>;
  getFile(): Promise<Blob>;
}

interface BrowserStorageEstimate {
  readonly quota: number | undefined;
  readonly usage: number | undefined;
}

interface BrowserStorageLike {
  readonly estimate: (() => Promise<BrowserStorageEstimate>) | undefined;
  readonly getDirectory: (() => Promise<BrowserDirectoryLike>) | undefined;
}

interface BrowserWritableLike {
  close(): Promise<void>;
  truncate(size: number): Promise<void>;
  write(data: BlobPart): Promise<void>;
}

interface SaveSlotManifest {
  readonly activeSlot: typeof ACTIVE_SLOT_A | typeof ACTIVE_SLOT_B;
  readonly checksumSha256Hex: string;
  readonly sizeBytes: number;
  readonly updatedAtUnixMs: number;
}

class SaveStoreFailure extends Error implements SaveStoreError {
  public readonly code: SaveStoreError["code"];
  public readonly detail: Readonly<Record<string, string | number | boolean | null>>;
  public readonly recoverable: boolean;
  public readonly userMessage: string;

  public constructor(input: SaveStoreError) {
    super(input.message);
    this.code = input.code;
    this.detail = Object.freeze({
      ...input.detail,
    });
    this.name = "SaveStoreFailure";
    this.recoverable = input.recoverable;
    this.userMessage = input.userMessage;
  }
}

export function createBrowserOpfsSaveStore(): SaveStorePort {
  const rootProvider = async (): Promise<StorageDirectoryLike> => {
    const storage = readBrowserStorage();
    if (storage?.getDirectory === undefined) {
      throw createSaveStoreError({
        code: "storage_unavailable",
        detail: {
          hostKind: "web",
          opfsSupported: false,
        },
        message: "The browser does not expose the Origin Private File System API.",
        recoverable: false,
        userMessage:
          "This browser cannot open the local save folder required for the Web product gate.",
      });
    }

    const originRoot = await storage.getDirectory();
    const appRoot = await originRoot.getDirectoryHandle(SAVE_SCOPE_DIRECTORY_NAME, {
      create: true,
    });
    const saveRoot = await appRoot.getDirectoryHandle(SAVE_ROOT_DIRECTORY_NAME, {
      create: true,
    });
    return wrapBrowserDirectoryHandle(saveRoot);
  };

  const estimateProvider = async (): Promise<SaveStoreQuotaEstimate> => {
    const storage = readBrowserStorage();
    if (storage?.estimate === undefined) {
      return {
        availableBytes: null,
        quotaBytes: null,
        usageBytes: null,
      };
    }

    const estimate = await storage.estimate();
    const quotaBytes = typeof estimate.quota === "number" ? Math.max(0, estimate.quota) : null;
    const usageBytes = typeof estimate.usage === "number" ? Math.max(0, estimate.usage) : null;
    return {
      availableBytes:
        quotaBytes !== null && usageBytes !== null ? Math.max(0, quotaBytes - usageBytes) : null,
      quotaBytes,
      usageBytes,
    };
  };

  return createOpfsSaveStore({
    estimateProvider,
    rootProvider,
  });
}

export function createOpfsSaveStore(options: OpfsSaveStoreOptions): SaveStorePort {
  const estimateProvider =
    options.estimateProvider ??
    ((): Promise<SaveStoreQuotaEstimate> =>
      Promise.resolve({
        availableBytes: null,
        quotaBytes: null,
        usageBytes: null,
      }));
  const nowProvider = options.nowProvider ?? ((): number => Date.now());

  return Object.freeze<SaveStorePort>({
    describe(): Promise<SaveStoreResult<SaveStoreStatus>> {
      return runSaveOperation(async () => {
        await options.rootProvider();
        return {
          available: true,
          kind: "opfs",
          quota: await estimateProvider(),
        };
      });
    },
    export(id: string): Promise<SaveStoreResult<SaveExportPayload>> {
      return runSaveOperation(async () => {
        const summary = await readSummary(options.rootProvider, id);
        const bytes = await readSaveBytes(options.rootProvider, id);
        return {
          bytes,
          mediaType: SAVE_FILE_MEDIA_TYPE,
          suggestedFileName: `wuming-town-${id}.wtsave`,
          summary,
        };
      });
    },
    list(): Promise<SaveStoreResult<readonly SaveSummary[]>> {
      return runSaveOperation(async () => {
        const root = await options.rootProvider();
        const summaries: SaveSummary[] = [];
        for await (const entry of root.entries()) {
          const [entryName, handle] = entry;
          if (!isDirectoryHandle(handle) || !VALID_SAVE_ID.test(entryName)) {
            continue;
          }

          summaries.push(await readSummaryFromDirectory(entryName, handle));
        }

        summaries.sort((left, right) => right.updatedAtUnixMs - left.updatedAtUnixMs);
        return summaries;
      });
    },
    read(id: string): Promise<SaveStoreResult<Uint8Array>> {
      return runSaveOperation(() => readSaveBytes(options.rootProvider, id));
    },
    remove(id: string): Promise<SaveStoreResult<undefined>> {
      return runSaveOperation(async () => {
        validateSaveId(id);
        const root = await options.rootProvider();
        try {
          await root.removeEntry(id, {
            recursive: true,
          });
        } catch (error) {
          throw translateStorageError(error, {
            defaultCode: "save_not_found",
            defaultDetail: {
              saveId: id,
            },
            defaultMessage: `Save ${id} does not exist.`,
            defaultRecoverable: true,
            defaultUserMessage: "That save slot is already gone.",
          });
        }

        return undefined;
      });
    },
    writeAtomic(request: SaveWriteRequest): Promise<SaveStoreResult<SaveSummary>> {
      return runSaveOperation(async () => {
        validateSaveId(request.id);
        await ensureQuota(estimateProvider, request.id, request.data.byteLength);

        const root = await options.rootProvider();
        const saveDirectory = await root.getDirectoryHandle(request.id, {
          create: true,
        });
        const currentManifest = await readOptionalManifest(saveDirectory);
        const nextSlot =
          currentManifest?.activeSlot === ACTIVE_SLOT_A ? ACTIVE_SLOT_B : ACTIVE_SLOT_A;
        const nextHandle = await saveDirectory.getFileHandle(nextSlot, {
          create: true,
        });
        const writable = await nextHandle.createWritable();
        await writable.truncate(0);
        await writable.write(cloneBytes(request.data));
        await writable.close();

        const checksumSha256Hex = await computeSha256Hex(request.data);
        const manifest: SaveSlotManifest = {
          activeSlot: nextSlot,
          checksumSha256Hex,
          sizeBytes: request.data.byteLength,
          updatedAtUnixMs: nowProvider(),
        };
        await writeManifest(saveDirectory, manifest);
        return toSaveSummary(request.id, manifest);
      });
    },
  });
}

async function ensureQuota(
  estimateProvider: () => Promise<SaveStoreQuotaEstimate>,
  saveId: string,
  requestedBytes: number,
): Promise<void> {
  const estimate = await estimateProvider();
  const availableBytes = estimate.availableBytes;
  if (availableBytes === null || requestedBytes <= availableBytes) {
    return;
  }

  throw createSaveStoreError({
    code: "quota_exceeded",
    detail: {
      availableBytes,
      quotaBytes: estimate.quotaBytes,
      requestedBytes,
      saveId,
      usageBytes: estimate.usageBytes,
    },
    message: `Writing ${String(requestedBytes)} bytes would exceed the available browser storage quota.`,
    recoverable: true,
    userMessage:
      "Not enough browser storage is available for this save. Export or delete a save, then retry.",
  });
}

function createSaveStoreError(input: SaveStoreError): SaveStoreFailure {
  return new SaveStoreFailure(input);
}

function isDirectoryHandle(value: StorageDirectoryEntryLike): value is StorageDirectoryLike {
  if (!("entries" in value)) {
    return false;
  }

  return typeof value.entries === "function";
}

function readBrowserStorage(): BrowserStorageLike | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  const rawStorage: unknown = navigator.storage;
  if (!isRecord(rawStorage)) {
    return undefined;
  }

  const estimateMethod = rawStorage["estimate"];
  const getDirectoryMethod = rawStorage["getDirectory"];

  return {
    estimate: isCallable(estimateMethod)
      ? (): Promise<BrowserStorageEstimate> => callBrowserEstimate(estimateMethod, rawStorage)
      : undefined,
    getDirectory: isCallable(getDirectoryMethod)
      ? (): Promise<BrowserDirectoryLike> =>
          callBrowserDirectoryGetter(getDirectoryMethod, rawStorage)
      : undefined,
  };
}

async function readManifest(directory: StorageDirectoryLike): Promise<SaveSlotManifest> {
  const manifestHandle = await directory.getFileHandle(MANIFEST_FILE_NAME);
  const bytes = await readFileBytes(manifestHandle);
  const parsed: unknown = JSON.parse(textDecoder.decode(bytes));
  if (!isManifest(parsed)) {
    throw createSaveStoreError({
      code: "io_failure",
      detail: {
        fileName: MANIFEST_FILE_NAME,
      },
      message: "The save manifest is malformed.",
      recoverable: false,
      userMessage: "The local save manifest is damaged and cannot be read.",
    });
  }

  return parsed;
}

async function readOptionalManifest(
  directory: StorageDirectoryLike,
): Promise<SaveSlotManifest | undefined> {
  try {
    return await readManifest(directory);
  } catch (error) {
    if (isSaveStoreError(error) && error.code !== "io_failure") {
      throw error;
    }

    return undefined;
  }
}

async function readSaveBytes(
  rootProvider: () => Promise<StorageDirectoryLike>,
  id: string,
): Promise<Uint8Array> {
  validateSaveId(id);
  const root = await rootProvider();
  const saveDirectory = await readSaveDirectory(root, id);
  const manifest = await readManifest(saveDirectory);
  const fileHandle = await saveDirectory.getFileHandle(manifest.activeSlot);
  const bytes = await readFileBytes(fileHandle);
  if (bytes.byteLength !== manifest.sizeBytes) {
    throw createSaveStoreError({
      code: "integrity_mismatch",
      detail: {
        actualSizeBytes: bytes.byteLength,
        expectedSizeBytes: manifest.sizeBytes,
        saveId: id,
      },
      message: `Save ${id} size ${String(bytes.byteLength)} did not match manifest size ${String(manifest.sizeBytes)}.`,
      recoverable: false,
      userMessage: "The local save data is inconsistent and could not be loaded.",
    });
  }

  const checksumSha256Hex = await computeSha256Hex(bytes);
  if (checksumSha256Hex !== manifest.checksumSha256Hex) {
    throw createSaveStoreError({
      code: "integrity_mismatch",
      detail: {
        actualChecksumSha256Hex: checksumSha256Hex,
        expectedChecksumSha256Hex: manifest.checksumSha256Hex,
        saveId: id,
      },
      message: `Save ${id} failed its checksum integrity check.`,
      recoverable: false,
      userMessage: "The local save data failed its integrity check.",
    });
  }

  return bytes;
}

async function readSaveDirectory(
  root: StorageDirectoryLike,
  id: string,
): Promise<StorageDirectoryLike> {
  try {
    return await root.getDirectoryHandle(id);
  } catch (error) {
    throw translateStorageError(error, {
      defaultCode: "save_not_found",
      defaultDetail: {
        saveId: id,
      },
      defaultMessage: `Save ${id} does not exist.`,
      defaultRecoverable: true,
      defaultUserMessage: "The requested save slot was not found.",
    });
  }
}

async function readSummary(
  rootProvider: () => Promise<StorageDirectoryLike>,
  id: string,
): Promise<SaveSummary> {
  validateSaveId(id);
  const root = await rootProvider();
  const saveDirectory = await readSaveDirectory(root, id);
  return readSummaryFromDirectory(id, saveDirectory);
}

async function readSummaryFromDirectory(
  id: string,
  directory: StorageDirectoryLike,
): Promise<SaveSummary> {
  return toSaveSummary(id, await readManifest(directory));
}

async function readFileBytes(fileHandle: StorageFileLike): Promise<Uint8Array> {
  const file = await fileHandle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

async function runSaveOperation<T>(execute: () => Promise<T>): Promise<SaveStoreResult<T>> {
  try {
    return {
      ok: true,
      value: await execute(),
    };
  } catch (error) {
    return {
      error: toSaveStoreError(error),
      ok: false,
    };
  }
}

function toSaveStoreError(error: unknown): SaveStoreError {
  if (isSaveStoreError(error)) {
    return error;
  }

  return createSaveStoreError({
    code: "io_failure",
    detail: {},
    message: error instanceof Error ? error.message : "Unknown save-store failure.",
    recoverable: false,
    userMessage: "The browser could not finish the requested save operation.",
  });
}

function toSaveSummary(id: string, manifest: SaveSlotManifest): SaveSummary {
  return Object.freeze({
    checksumSha256Hex: manifest.checksumSha256Hex,
    id,
    sizeBytes: manifest.sizeBytes,
    updatedAtUnixMs: manifest.updatedAtUnixMs,
  });
}

function translateStorageError(
  error: unknown,
  defaults: {
    readonly defaultCode: SaveStoreError["code"];
    readonly defaultDetail: SaveStoreError["detail"];
    readonly defaultMessage: string;
    readonly defaultRecoverable: boolean;
    readonly defaultUserMessage: string;
  },
): SaveStoreFailure {
  if (isSaveStoreError(error)) {
    return error;
  }

  if (isQuotaExceededError(error)) {
    return createSaveStoreError({
      code: "quota_exceeded",
      detail: defaults.defaultDetail,
      message: error instanceof Error ? error.message : defaults.defaultMessage,
      recoverable: true,
      userMessage: "The browser storage quota was exceeded. Export or delete a save, then retry.",
    });
  }

  return createSaveStoreError({
    code: defaults.defaultCode,
    detail: defaults.defaultDetail,
    message: error instanceof Error ? error.message : defaults.defaultMessage,
    recoverable: defaults.defaultRecoverable,
    userMessage: defaults.defaultUserMessage,
  });
}

function validateSaveId(id: string): void {
  if (VALID_SAVE_ID.test(id)) {
    return;
  }

  throw createSaveStoreError({
    code: "invalid_save_id",
    detail: {
      saveId: id,
    },
    message: `Save id ${id} is invalid for local storage.`,
    recoverable: false,
    userMessage: "The save slot id is invalid for local browser storage.",
  });
}

async function writeManifest(
  directory: StorageDirectoryLike,
  manifest: SaveSlotManifest,
): Promise<void> {
  const fileHandle = await directory.getFileHandle(MANIFEST_FILE_NAME, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.truncate(0);
  await writable.write(cloneBytes(textEncoder.encode(JSON.stringify(manifest))));
  await writable.close();
}

function cloneBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function isManifest(value: unknown): value is SaveSlotManifest {
  return (
    isRecord(value) &&
    (value["activeSlot"] === ACTIVE_SLOT_A || value["activeSlot"] === ACTIVE_SLOT_B) &&
    typeof value["checksumSha256Hex"] === "string" &&
    typeof value["sizeBytes"] === "number" &&
    typeof value["updatedAtUnixMs"] === "number"
  );
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof Error && error.name === "QuotaExceededError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSaveStoreError(error: unknown): error is SaveStoreFailure {
  return error instanceof SaveStoreFailure;
}

function isCallable(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

function callBrowserDirectoryGetter(
  method: (...args: never[]) => unknown,
  storage: object,
): Promise<BrowserDirectoryLike> {
  return Promise.resolve(method.call(storage)).then((directory: unknown) =>
    toBrowserDirectoryLike(directory),
  );
}

function callBrowserEstimate(
  method: (...args: never[]) => unknown,
  storage: object,
): Promise<BrowserStorageEstimate> {
  return Promise.resolve(method.call(storage)).then((estimate: unknown) =>
    toBrowserStorageEstimate(estimate),
  );
}

function isBrowserDirectoryLike(value: unknown): value is BrowserDirectoryLike {
  return (
    isRecord(value) &&
    typeof value["getDirectoryHandle"] === "function" &&
    typeof value["getFileHandle"] === "function" &&
    typeof value["removeEntry"] === "function"
  );
}

function isBrowserFileLike(value: unknown): value is BrowserFileLike {
  return (
    isRecord(value) &&
    typeof value["createWritable"] === "function" &&
    typeof value["getFile"] === "function"
  );
}

function toBrowserDirectoryLike(value: unknown): BrowserDirectoryLike {
  if (!isBrowserDirectoryLike(value)) {
    throw createSaveStoreError({
      code: "storage_unavailable",
      detail: {
        opfsSupported: false,
      },
      message: "The browser did not return a usable OPFS directory handle.",
      recoverable: false,
      userMessage: "This browser cannot access the local save folder for the Web product gate.",
    });
  }

  return value;
}

function toBrowserStorageEstimate(value: unknown): BrowserStorageEstimate {
  if (!isRecord(value)) {
    return {
      quota: undefined,
      usage: undefined,
    };
  }

  return {
    quota: typeof value["quota"] === "number" ? value["quota"] : undefined,
    usage: typeof value["usage"] === "number" ? value["usage"] : undefined,
  };
}

function wrapBrowserDirectoryHandle(handle: BrowserDirectoryLike): StorageDirectoryLike {
  return {
    entries(): AsyncIterable<readonly [string, StorageDirectoryEntryLike]> {
      return readBrowserDirectoryEntries(handle);
    },
    async getDirectoryHandle(
      name: string,
      options?: {
        readonly create?: boolean;
      },
    ): Promise<StorageDirectoryLike> {
      return wrapBrowserDirectoryHandle(await handle.getDirectoryHandle(name, options));
    },
    async getFileHandle(
      name: string,
      options?: {
        readonly create?: boolean;
      },
    ): Promise<StorageFileLike> {
      return wrapBrowserFileHandle(await handle.getFileHandle(name, options));
    },
    removeEntry(
      name: string,
      options?: {
        readonly recursive?: boolean;
      },
    ): Promise<void> {
      return handle.removeEntry(name, options);
    },
  };
}

function wrapBrowserFileHandle(handle: BrowserFileLike): StorageFileLike {
  return {
    createWritable(): Promise<StorageWritableLike> {
      return handle.createWritable();
    },
    getFile(): Promise<Blob> {
      return handle.getFile();
    },
  };
}

async function* readBrowserDirectoryEntries(
  handle: BrowserDirectoryLike,
): AsyncIterable<readonly [string, StorageDirectoryEntryLike]> {
  const entries = handle.entries;
  if (entries === undefined) {
    throw createSaveStoreError({
      code: "storage_unavailable",
      detail: {},
      message: "The browser directory handle does not expose iterable entries.",
      recoverable: false,
      userMessage: "This browser cannot enumerate local save slots for the Web product gate.",
    });
  }

  for await (const entry of entries.call(handle)) {
    const [name, child] = entry;
    if (typeof name !== "string") {
      continue;
    }

    if (isBrowserDirectoryLike(child)) {
      const wrapped: readonly [string, StorageDirectoryEntryLike] = [
        name,
        wrapBrowserDirectoryHandle(child),
      ];
      yield wrapped;
      continue;
    }

    if (isBrowserFileLike(child)) {
      const wrapped: readonly [string, StorageDirectoryEntryLike] = [
        name,
        wrapBrowserFileHandle(child),
      ];
      yield wrapped;
    }
  }
}
