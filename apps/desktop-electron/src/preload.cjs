const { contextBridge } = require("electron");

const unavailableError = Object.freeze({
  code: "unavailable",
  message: "Electron placeholder ports are not implemented yet.",
});

function createUnavailableResult() {
  return Promise.resolve({
    error: unavailableError,
    ok: false,
  });
}

const platformBridge = Object.freeze({
  host: Object.freeze({
    contextIsolation: true,
    kind: "electron",
    nodeIntegration: false,
    sandboxedRenderer: true,
  }),
  mods: Object.freeze({
    importArchive() {
      return createUnavailableResult();
    },
    listPackages() {
      return createUnavailableResult();
    },
  }),
  saveStore: Object.freeze({
    list() {
      return createUnavailableResult();
    },
    read() {
      return createUnavailableResult();
    },
    remove() {
      return createUnavailableResult();
    },
    writeAtomic() {
      return createUnavailableResult();
    },
  }),
});

contextBridge.exposeInMainWorld("wumingTownPlatform", platformBridge);
