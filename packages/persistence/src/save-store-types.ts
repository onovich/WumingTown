export type SaveStoreErrorCode =
  | "integrity_mismatch"
  | "invalid_envelope"
  | "invalid_save_id"
  | "io_failure"
  | "quota_exceeded"
  | "save_not_found"
  | "storage_unavailable";

export type SaveStoreDiagnosticValue = boolean | number | string | null;

export interface SaveStoreError {
  readonly code: SaveStoreErrorCode;
  readonly detail: Readonly<Record<string, SaveStoreDiagnosticValue>>;
  readonly message: string;
  readonly recoverable: boolean;
  readonly userMessage: string;
}

export type SaveStoreResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly error: SaveStoreError;
      readonly ok: false;
    };

export interface SaveStoreQuotaEstimate {
  readonly availableBytes: number | null;
  readonly quotaBytes: number | null;
  readonly usageBytes: number | null;
}

export interface SaveSummary {
  readonly checksumSha256Hex: string;
  readonly id: string;
  readonly sizeBytes: number;
  readonly updatedAtUnixMs: number;
}

export interface SaveExportPayload {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly suggestedFileName: string;
  readonly summary: SaveSummary;
}

export interface SaveStoreStatus {
  readonly available: boolean;
  readonly kind: "opfs";
  readonly quota: SaveStoreQuotaEstimate;
}

export interface SaveWriteRequest {
  readonly data: Uint8Array;
  readonly id: string;
}

export interface SaveStorePort {
  describe(): Promise<SaveStoreResult<SaveStoreStatus>>;
  export(id: string): Promise<SaveStoreResult<SaveExportPayload>>;
  list(): Promise<SaveStoreResult<readonly SaveSummary[]>>;
  read(id: string): Promise<SaveStoreResult<Uint8Array>>;
  remove(id: string): Promise<SaveStoreResult<undefined>>;
  writeAtomic(request: SaveWriteRequest): Promise<SaveStoreResult<SaveSummary>>;
}

export interface StorageDirectoryLike {
  entries(): AsyncIterable<readonly [string, StorageDirectoryEntryLike]>;
  getDirectoryHandle(
    name: string,
    options?: { readonly create?: boolean },
  ): Promise<StorageDirectoryLike>;
  getFileHandle(name: string, options?: { readonly create?: boolean }): Promise<StorageFileLike>;
  removeEntry(
    name: string,
    options?: {
      readonly recursive?: boolean;
    },
  ): Promise<void>;
}

export interface StorageFileLike {
  createWritable(): Promise<StorageWritableLike>;
  getFile(): Promise<Blob>;
}

export interface StorageWritableLike {
  close(): Promise<void>;
  truncate(size: number): Promise<void>;
  write(data: BlobPart): Promise<void>;
}

export type StorageDirectoryEntryLike = StorageDirectoryLike | StorageFileLike;

export interface OpfsSaveStoreOptions {
  readonly estimateProvider?: () => Promise<SaveStoreQuotaEstimate>;
  readonly nowProvider?: () => number;
  readonly rootProvider: () => Promise<StorageDirectoryLike>;
}
