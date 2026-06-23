/// <reference lib="dom" />

import { spawn } from "node:child_process";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { _electron as electron, type Page } from "playwright";
import { describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

const DESKTOP_DIST_ROOT = path.join(process.cwd(), "dist", "desktop");
const MAIN_ENTRY_PATH = path.join(
  process.cwd(),
  "apps",
  "desktop-electron",
  "dist",
  "main",
  "main.js",
);
const PACKAGED_EXE_PATH = path.join(DESKTOP_DIST_ROOT, "win-unpacked", "WumingTown.exe");
const MAIN_DIST_DIR = path.join(process.cwd(), "apps", "desktop-electron", "dist", "main");
const STALE_MAIN_OUTPUT_PATH = path.join(MAIN_DIST_DIR, "desktop-shell.e2e.test.js");
const PACKAGED_MAIN_DIR = path.join(
  DESKTOP_DIST_ROOT,
  "win-unpacked",
  "resources",
  "app",
  "dist",
  "main",
);
const PACKAGED_STALE_OUTPUT_PATH = path.join(PACKAGED_MAIN_DIR, "desktop-shell.e2e.test.js");

let mainBuildPromise: Promise<void> | undefined;
let packagedBuildPromise: Promise<void> | undefined;

describe("desktop Electron shell smoke", () => {
  it("launches the sandboxed shell against a Vite dev server", async () => {
    await ensureDesktopMainBuild();

    const appRoot = path.join(process.cwd(), "apps", "web");
    const server = await createServer({
      configFile: false,
      logLevel: "error",
      root: appRoot,
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: false,
      },
    });
    await server.listen();

    const electronApp = await electron.launch({
      args: [MAIN_ENTRY_PATH],
      env: {
        ...process.env,
        WM_DESKTOP_DEV_SERVER_URL: readServerUrl(server),
      },
    });

    try {
      const page = await electronApp.firstWindow();
      await assertShellReady(page, "electron");
      await assertRendererSandbox(page);
    } finally {
      await electronApp.close();
      await server.close();
    }
  }, 120000);

  it("launches the packaged Windows directory build", async () => {
    if (process.platform !== "win32") {
      return;
    }

    await ensureDesktopPackagedBuild();

    const appRoot = path.join(process.cwd(), "apps", "web");
    const server = await createServer({
      configFile: false,
      logLevel: "error",
      root: appRoot,
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: false,
      },
    });
    await server.listen();

    const electronApp = await electron.launch({
      executablePath: PACKAGED_EXE_PATH,
      env: {
        ...process.env,
        WM_DESKTOP_DEV_SERVER_URL: readServerUrl(server),
      },
    });

    try {
      const page = await electronApp.firstWindow();
      await assertShellReady(page, "electron");
      await assertRendererSandbox(page);
      assertPackagedRendererLoadedFromFile(page);
      await assertPackagedMainBundleSanitized();
    } finally {
      await electronApp.close();
      await server.close();
    }
  }, 180000);
});

async function assertRendererSandbox(page: Page): Promise<void> {
  const sandboxState = await page.evaluate(() => ({
    hasProcess: typeof Object.getOwnPropertyDescriptor(window, "process") !== "undefined",
    hasRequire: typeof Object.getOwnPropertyDescriptor(window, "require") !== "undefined",
    hasWumingBridge:
      typeof Object.getOwnPropertyDescriptor(window, "wumingTownPlatform") !== "undefined",
  }));

  expect(sandboxState).toStrictEqual({
    hasProcess: false,
    hasRequire: false,
    hasWumingBridge: true,
  });

  const saveListResult: unknown = await page.evaluate((): Promise<unknown> | undefined => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null;
    const isListMethod = (value: unknown): value is () => Promise<unknown> =>
      typeof value === "function";
    const descriptor = Object.getOwnPropertyDescriptor(window, "wumingTownPlatform");
    const bridge: unknown = descriptor?.value;
    if (!isRecord(bridge)) {
      return undefined;
    }

    const saveStore = bridge["saveStore"];
    if (!isRecord(saveStore)) {
      return undefined;
    }

    const listMethod = saveStore["list"];
    if (!isListMethod(listMethod)) {
      return undefined;
    }

    return listMethod();
  });
  expect(saveListResult).toStrictEqual({
    error: {
      code: "unavailable",
      message: "Electron placeholder ports are not implemented yet.",
    },
    ok: false,
  });
}

async function assertShellReady(page: Page, expectedHostKind: string): Promise<void> {
  await page.waitForSelector("[data-shell-ready='true']");

  const debugPayload = await readDebugPayload(page);
  expect(debugPayload["platformHost"]).toMatchObject({
    contextIsolation: true,
    kind: expectedHostKind,
    nodeIntegration: false,
    sandboxedRenderer: true,
  });
}

async function ensureDesktopMainBuild(): Promise<void> {
  mainBuildPromise ??= runCommand("pnpm", [
    "--filter",
    "@wuming-town/desktop-electron",
    "build:main",
  ]);
  await mainBuildPromise;
}

async function ensureDesktopPackagedBuild(): Promise<void> {
  packagedBuildPromise ??= (async (): Promise<void> => {
    await mkdir(DESKTOP_DIST_ROOT, {
      recursive: true,
    });
    await seedStaleMainOutput();
    await runCommand("pnpm", ["build:desktop"]);
  })();
  await packagedBuildPromise;
}

async function seedStaleMainOutput(): Promise<void> {
  await rm(MAIN_DIST_DIR, {
    force: true,
    recursive: true,
  });
  await mkdir(MAIN_DIST_DIR, {
    recursive: true,
  });
  await writeFile(STALE_MAIN_OUTPUT_PATH, "export const stale = true;\n", "utf8");
}

async function assertPackagedMainBundleSanitized(): Promise<void> {
  expect(await pathExists(path.join(MAIN_DIST_DIR, "main.js"))).toBe(true);
  expect(await pathExists(STALE_MAIN_OUTPUT_PATH)).toBe(false);
  expect(await pathExists(path.join(PACKAGED_MAIN_DIR, "main.js"))).toBe(true);
  expect(await pathExists(PACKAGED_STALE_OUTPUT_PATH)).toBe(false);
}

function assertPackagedRendererLoadedFromFile(page: Page): void {
  expect(page.url().startsWith("file:///")).toBe(true);
}

async function readDebugPayload(page: Page): Promise<Record<string, unknown>> {
  await page.waitForFunction((): boolean => {
    const debugNode = document.getElementById("wm-shell-debug");
    if (debugNode === null) {
      return false;
    }

    const debugText = debugNode.textContent;
    return typeof debugText === "string" && debugText.length > 0;
  });
  const debugText = await page.locator("#wm-shell-debug").textContent();
  expect(debugText).not.toBeNull();
  return parseDebugPayload(debugText ?? "{}");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDebugPayload(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error("Unexpected desktop debug payload.");
  }

  return parsed;
}

function readServerUrl(server: ViteDevServer): string {
  const localUrl = server.resolvedUrls?.local[0];
  if (localUrl === undefined) {
    throw new Error("Vite dev server did not expose a local URL.");
  }

  return localUrl;
}

async function runCommand(command: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${String(code)}`));
    });
  });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
