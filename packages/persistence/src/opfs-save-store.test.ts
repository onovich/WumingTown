import { describe, expect, it } from "vitest";

import {
  buildM6GateSaveEnvelope,
  decodeM6GateSaveEnvelope,
  encodeM6GateSaveEnvelope,
} from "./m6-gate-save";
import { createOpfsSaveStore } from "./opfs-save-store";
import type {
  SaveStoreQuotaEstimate,
  StorageDirectoryLike,
  StorageFileLike,
  StorageWritableLike,
} from "./save-store-types";

describe("opfs-save-store", () => {
  it("writes, lists, exports, reads and removes a gate save envelope", async () => {
    const root = new FakeDirectoryHandle("root");
    const store = createOpfsSaveStore({
      estimateProvider: (): Promise<SaveStoreQuotaEstimate> =>
        Promise.resolve({
          availableBytes: 1024 * 1024,
          quotaBytes: 1024 * 1024,
          usageBytes: 0,
        }),
      nowProvider: () => 1_717_000_000_000,
      rootProvider: (): Promise<StorageDirectoryLike> => Promise.resolve(root),
    });
    const firstBytes = await encodeM6GateSaveEnvelope(
      buildM6GateSaveEnvelope({
        fixtureId: "wm-0086-web-product-gate",
        lastInputLabel: "Keyboard KeyD",
        readModelHash: "0x9ba83cb7",
        releaseGateTitle: "Web Product Gate",
        runtimeBrowser: "Chrome Stable",
        savedAtUnixMs: 1_717_000_000_000,
        selectedEntityId: "lantern-keeper-shen",
      }),
    );

    const writeResult = await store.writeAtomic({
      data: firstBytes,
      id: "m6-gate-slot",
    });
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) {
      return;
    }

    const listResult = await store.list();
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) {
      return;
    }

    expect(listResult.value).toHaveLength(1);
    expect(listResult.value[0]?.id).toBe("m6-gate-slot");
    expect(listResult.value[0]?.sizeBytes).toBe(firstBytes.byteLength);

    const exportResult = await store.export("m6-gate-slot");
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) {
      return;
    }

    expect(exportResult.value.suggestedFileName).toBe("wuming-town-m6-gate-slot.wtsave");
    expect(exportResult.value.bytes).toStrictEqual(firstBytes);

    const readResult = await store.read("m6-gate-slot");
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) {
      return;
    }

    expect(readResult.value).toStrictEqual(firstBytes);

    const decoded = await decodeM6GateSaveEnvelope(readResult.value);
    expect(decoded.data.selectedEntityId).toBe("lantern-keeper-shen");

    const secondBytes = await encodeM6GateSaveEnvelope(
      buildM6GateSaveEnvelope({
        fixtureId: "wm-0086-web-product-gate",
        lastInputLabel: "Loaded imported save",
        readModelHash: "0x9ba83cb7",
        releaseGateTitle: "Web Product Gate",
        runtimeBrowser: "Edge Stable",
        savedAtUnixMs: 1_717_000_123_000,
        selectedEntityId: "archivist-mei",
      }),
    );
    const overwriteResult = await store.writeAtomic({
      data: secondBytes,
      id: "m6-gate-slot",
    });
    expect(overwriteResult.ok).toBe(true);
    if (!overwriteResult.ok) {
      return;
    }

    const rereadResult = await store.read("m6-gate-slot");
    expect(rereadResult.ok).toBe(true);
    if (!rereadResult.ok) {
      return;
    }

    const rereadDecoded = await decodeM6GateSaveEnvelope(rereadResult.value);
    expect(rereadDecoded.data.selectedEntityId).toBe("archivist-mei");

    const removeResult = await store.remove("m6-gate-slot");
    expect(removeResult).toStrictEqual({
      ok: true,
      value: undefined,
    });

    const finalListResult = await store.list();
    expect(finalListResult.ok).toBe(true);
    if (!finalListResult.ok) {
      return;
    }

    expect(finalListResult.value).toHaveLength(0);
  });

  it("fails closed on quota pressure and preserves the previous save", async () => {
    const root = new FakeDirectoryHandle("root");
    let estimate: SaveStoreQuotaEstimate = {
      availableBytes: 4096,
      quotaBytes: 4096,
      usageBytes: 0,
    };
    const store = createOpfsSaveStore({
      estimateProvider: (): Promise<SaveStoreQuotaEstimate> => Promise.resolve(estimate),
      rootProvider: (): Promise<StorageDirectoryLike> => Promise.resolve(root),
    });
    const smallBytes = await encodeM6GateSaveEnvelope(
      buildM6GateSaveEnvelope({
        fixtureId: "wm-0086-web-product-gate",
        lastInputLabel: "Ready",
        readModelHash: "0x9ba83cb7",
        releaseGateTitle: "Web Product Gate",
        runtimeBrowser: "Chrome Stable",
        savedAtUnixMs: 1_717_000_000_000,
        selectedEntityId: "lantern-keeper-shen",
      }),
    );
    const smallWrite = await store.writeAtomic({
      data: smallBytes,
      id: "m6-gate-slot",
    });
    expect(smallWrite.ok).toBe(true);

    estimate = {
      availableBytes: 64,
      quotaBytes: 4096,
      usageBytes: 4032,
    };
    const largeBytes = new Uint8Array(512);
    largeBytes.fill(7);
    const largeWrite = await store.writeAtomic({
      data: largeBytes,
      id: "m6-gate-slot",
    });
    expect(largeWrite.ok).toBe(false);
    if (largeWrite.ok) {
      return;
    }

    expect(largeWrite.error.code).toBe("quota_exceeded");
    expect(largeWrite.error.userMessage).toContain("Not enough browser storage");

    const readAfterFailure = await store.read("m6-gate-slot");
    expect(readAfterFailure.ok).toBe(true);
    if (!readAfterFailure.ok) {
      return;
    }

    expect(readAfterFailure.value).toStrictEqual(smallBytes);
  });

  it("rejects invalid save ids", async () => {
    const store = createOpfsSaveStore({
      rootProvider: (): Promise<StorageDirectoryLike> =>
        Promise.resolve(new FakeDirectoryHandle("root")),
    });
    const writeResult = await store.writeAtomic({
      data: new Uint8Array([1, 2, 3]),
      id: "../unsafe",
    });
    expect(writeResult.ok).toBe(false);
    if (writeResult.ok) {
      return;
    }

    expect(writeResult.error.code).toBe("invalid_save_id");
  });
});

class FakeDirectoryHandle implements StorageDirectoryLike {
  private readonly directories = new Map<string, FakeDirectoryHandle>();
  private readonly files = new Map<string, FakeFileHandle>();

  public constructor(private readonly name: string) {}

  public async *entries(): AsyncIterable<readonly [string, FakeDirectoryHandle | FakeFileHandle]> {
    await Promise.resolve();
    for (const entry of this.directories) {
      yield entry;
    }

    for (const entry of this.files) {
      yield entry;
    }
  }

  public async getDirectoryHandle(
    name: string,
    options?: { readonly create?: boolean },
  ): Promise<FakeDirectoryHandle> {
    await Promise.resolve();
    const existing = this.directories.get(name);
    if (existing !== undefined) {
      return existing;
    }

    if (options?.create === true) {
      const created = new FakeDirectoryHandle(name);
      this.directories.set(name, created);
      return created;
    }

    throw createNamedError("NotFoundError", `Directory ${this.name}/${name} was not found.`);
  }

  public async getFileHandle(
    name: string,
    options?: { readonly create?: boolean },
  ): Promise<FakeFileHandle> {
    await Promise.resolve();
    const existing = this.files.get(name);
    if (existing !== undefined) {
      return existing;
    }

    if (options?.create === true) {
      const created = new FakeFileHandle(name);
      this.files.set(name, created);
      return created;
    }

    throw createNamedError("NotFoundError", `File ${this.name}/${name} was not found.`);
  }

  public async removeEntry(
    name: string,
    options?: {
      readonly recursive?: boolean;
    },
  ): Promise<void> {
    await Promise.resolve();
    if (this.files.delete(name)) {
      return;
    }

    const directory = this.directories.get(name);
    if (directory === undefined) {
      throw createNamedError("NotFoundError", `Entry ${this.name}/${name} was not found.`);
    }

    if (
      options?.recursive !== true &&
      (directory.directories.size > 0 || directory.files.size > 0)
    ) {
      throw createNamedError("InvalidModificationError", "Directory is not empty.");
    }

    this.directories.delete(name);
  }
}

class FakeFileHandle implements StorageFileLike {
  private bytes = new Uint8Array(0);

  public constructor(private readonly name: string) {}

  public createWritable(): Promise<StorageWritableLike> {
    return Promise.resolve(new FakeWritable(this));
  }

  public getFile(): Promise<Blob> {
    return Promise.resolve(
      new File([this.bytes.buffer], this.name, {
        type: "application/octet-stream",
      }),
    );
  }

  public writeBytes(bytes: Uint8Array): void {
    this.bytes = new Uint8Array(bytes);
  }
}

class FakeWritable implements StorageWritableLike {
  private stagedBytes = new Uint8Array(0);

  public constructor(private readonly fileHandle: FakeFileHandle) {}

  public close(): Promise<void> {
    this.fileHandle.writeBytes(this.stagedBytes);
    return Promise.resolve();
  }

  public truncate(size: number): Promise<void> {
    this.stagedBytes = new Uint8Array(size);
    return Promise.resolve();
  }

  public async write(data: BlobPart): Promise<void> {
    if (data instanceof Uint8Array) {
      this.stagedBytes = new Uint8Array(data);
      return;
    }

    if (ArrayBuffer.isView(data)) {
      this.stagedBytes = new Uint8Array(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      );
      return;
    }

    if (data instanceof ArrayBuffer) {
      this.stagedBytes = new Uint8Array(data.slice(0));
      return;
    }

    if (typeof data === "string") {
      this.stagedBytes = new TextEncoder().encode(data);
      return;
    }

    if (data instanceof Blob) {
      this.stagedBytes = new Uint8Array(await data.arrayBuffer());
      return;
    }

    throw new Error("Unsupported blob part in fake writable.");
  }
}

function createNamedError(name: string, message: string): Error {
  const error = new Error(message);
  Object.defineProperty(error, "name", {
    value: name,
  });
  return error;
}
