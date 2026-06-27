import type { PlatformHostInfo, PlatformPortError } from "@wuming-town/platform";

export type ElectronPreloadTopLevelKey = "host" | "mods" | "saveStore";
export type ElectronPreloadModKey = "importArchive" | "listPackages";
export type ElectronPreloadSaveStoreKey = "list" | "read" | "remove" | "writeAtomic";

export const ELECTRON_PRELOAD_TOP_LEVEL_KEYS: readonly ElectronPreloadTopLevelKey[] = Object.freeze(
  ["host", "mods", "saveStore"],
);

export const ELECTRON_PRELOAD_MOD_KEYS: readonly ElectronPreloadModKey[] = Object.freeze([
  "importArchive",
  "listPackages",
]);

export const ELECTRON_PRELOAD_SAVE_STORE_KEYS: readonly ElectronPreloadSaveStoreKey[] =
  Object.freeze(["list", "read", "remove", "writeAtomic"]);

export const ELECTRON_PRELOAD_DIAGNOSTIC_KEYS: readonly string[] = Object.freeze([]);

export const ELECTRON_PRELOAD_FORBIDDEN_KEYS: readonly string[] = Object.freeze([
  "clipboard",
  "dialog",
  "fs",
  "ipcRenderer",
  "nativeImage",
  "openExternal",
  "process",
  "require",
  "shell",
]);

export const ELECTRON_PRELOAD_HOST: PlatformHostInfo = Object.freeze({
  contextIsolation: true,
  kind: "electron",
  nodeIntegration: false,
  sandboxedRenderer: true,
});

export const ELECTRON_PRELOAD_UNAVAILABLE_ERROR: PlatformPortError = Object.freeze({
  code: "unavailable",
  message: "Electron placeholder ports are not implemented yet.",
});
