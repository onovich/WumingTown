import { describe, expect, it } from "vitest";

import {
  createDefaultShellUiScaleState,
  createShellUiScaleState,
  loadUiScalePreference,
  writeUiScalePreference,
} from "./shell-ui-scale";

describe("shell-ui-scale", () => {
  it("defaults to the standard UI scale", () => {
    expect(createDefaultShellUiScaleState()).toStrictEqual({
      factor: 1,
      persistence: {
        diagnosticCode: "none",
        mode: "persistent",
      },
      preference: "standard",
    });
  });

  it("loads a persisted large UI scale", () => {
    const storage = createStorage({
      "wuming-town.ui-scale.v1": JSON.stringify({
        scale: "large",
        version: 1,
      }),
    });

    const result = loadUiScalePreference(storage);

    expect(createShellUiScaleState(result.preference, result.persistence)).toStrictEqual({
      factor: 1.1,
      persistence: {
        diagnosticCode: "none",
        mode: "persistent",
      },
      preference: "large",
    });
  });

  it("falls back to standard when the saved preference is invalid", () => {
    const storage = createStorage({
      "wuming-town.ui-scale.v1": JSON.stringify({
        scale: "huge",
        version: 1,
      }),
    });

    const result = loadUiScalePreference(storage);

    expect(result).toStrictEqual({
      persistence: {
        diagnosticCode: "preference_invalid",
        mode: "persistent",
      },
      preference: {
        scale: "standard",
        version: 1,
      },
    });
  });

  it("persists a new UI scale when storage is available", () => {
    const storage = createStorage();

    const result = writeUiScalePreference(storage, "extra-large");

    expect(result).toStrictEqual({
      persistence: {
        diagnosticCode: "none",
        mode: "persistent",
      },
      preference: {
        scale: "extra-large",
        version: 1,
      },
    });
    expect(storage.getItem("wuming-town.ui-scale.v1")).toBe(
      JSON.stringify({
        scale: "extra-large",
        version: 1,
      }),
    );
  });
});

function createStorage(seed: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
