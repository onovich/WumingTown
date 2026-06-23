import { app, BrowserWindow } from "electron";
import { access } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DESKTOP_APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PRELOAD_ENTRY_PATH = path.join(DESKTOP_APP_ROOT, "src", "preload.cjs");
const RENDERER_INDEX_PATH = path.join(DESKTOP_APP_ROOT, "dist", "renderer", "index.html");
const DEV_SERVER_URL_ENV = "WM_DESKTOP_DEV_SERVER_URL";

void app
  .whenReady()
  .then(async () => {
    registerApplicationLifecycle();
    await openMainWindow();
  })
  .catch((error: unknown) => {
    console.error("Failed to start the Electron shell.", error);
    app.exit(1);
  });

async function openMainWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#120f0b",
    height: 900,
    show: false,
    title: "Wuming Town",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_ENTRY_PATH,
      sandbox: true,
    },
    width: 1440,
  });

  registerNavigationGuards(mainWindow);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  await loadRenderer(mainWindow);
}

async function loadRenderer(mainWindow: BrowserWindow): Promise<void> {
  const devServerUrl = process.env[DEV_SERVER_URL_ENV];
  if (typeof devServerUrl === "string" && devServerUrl.length > 0) {
    const launchUrl = new URL("./", devServerUrl);
    launchUrl.searchParams.set("wmDesktop", "1");
    await mainWindow.loadURL(launchUrl.toString());
    return;
  }

  await access(RENDERER_INDEX_PATH);
  const launchUrl = pathToFileURL(RENDERER_INDEX_PATH);
  launchUrl.searchParams.set("wmDesktop", "1");
  await mainWindow.loadURL(launchUrl.toString());
}

function registerApplicationLifecycle(): void {
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openMainWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

function registerNavigationGuards(mainWindow: BrowserWindow): void {
  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "deny",
  }));
  mainWindow.webContents.on("will-navigate", (event, nextUrl) => {
    if (nextUrl !== mainWindow.webContents.getURL()) {
      event.preventDefault();
    }
  });
}
