/// <reference lib="dom" />

import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { _electron as electron, type Page } from "playwright";
import { describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

import {
  ELECTRON_PRELOAD_DIAGNOSTIC_KEYS,
  ELECTRON_PRELOAD_FORBIDDEN_KEYS,
  ELECTRON_PRELOAD_HOST,
  ELECTRON_PRELOAD_MOD_KEYS,
  ELECTRON_PRELOAD_SAVE_STORE_KEYS,
  ELECTRON_PRELOAD_TOP_LEVEL_KEYS,
  ELECTRON_PRELOAD_UNAVAILABLE_ERROR,
} from "./preload-contract";

const DESKTOP_DIST_ROOT = path.join(process.cwd(), "dist", "desktop");
const DESKTOP_PACKAGE_REPORT_PATH = path.join(DESKTOP_DIST_ROOT, "wm-desktop-package-report.json");
const WEB_RELEASE_GATE_REPORT_PATH = path.join(
  process.cwd(),
  "apps",
  "desktop-electron",
  "dist",
  "renderer",
  "wm-release-gate-report.json",
);
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
const PACKAGED_STALE_ARTIFACT_PATH = path.join(
  DESKTOP_DIST_ROOT,
  "win-unpacked",
  "wm-external-smoke-stale.txt",
);

let mainBuildPromise: Promise<void> | undefined;
let packagedBuildPromise: Promise<void> | undefined;

interface PreloadBridgeAudit {
  readonly diagnosticKeys: readonly string[];
  readonly forbiddenBridgeKeys: readonly string[];
  readonly host: unknown;
  readonly modKeys: readonly string[];
  readonly saveStoreKeys: readonly string[];
  readonly topLevelKeys: readonly string[];
}

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
      args: ["--lang=en-US", MAIN_ENTRY_PATH],
      env: {
        ...process.env,
        WM_DESKTOP_DEV_SERVER_URL: readServerUrl(server),
        WM_DESKTOP_QUERY: "wmDiagnostics=1",
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
      args: ["--lang=en-US"],
      executablePath: PACKAGED_EXE_PATH,
      env: {
        ...process.env,
        WM_DESKTOP_DEV_SERVER_URL: readServerUrl(server),
        WM_DESKTOP_QUERY: "wmDiagnostics=1",
      },
    });

    try {
      const page = await electronApp.firstWindow();
      await assertShellReady(page, "electron");
      await assertRendererSandbox(page);
      assertPackagedRendererLoadedFromFile(page);
      await assertPackagedMainBundleSanitized();
      await assertDesktopPackageReport();
      await assertWebReleaseGateReport();
    } finally {
      await electronApp.close();
      await server.close();
    }
  }, 180000);

  it("defaults locale by renderer language and persists manual override across restart", async () => {
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

    const userDataRoot = await mkdtemp(path.join(os.tmpdir(), "wuming-town-wm-0114-"));

    try {
      const englishApp = await electron.launch({
        args: ["--lang=en-US", MAIN_ENTRY_PATH],
        env: {
          ...process.env,
          WM_DESKTOP_DEV_SERVER_URL: readServerUrl(server),
          WM_DESKTOP_USER_DATA_DIR: path.join(userDataRoot, "en"),
        },
      });

      try {
        const englishPage = await englishApp.firstWindow();
        await englishPage.waitForSelector("[data-shell-ready='true']");
        await waitForLocale(englishPage, "en", "system");
        await assertDesktopStartSurfaceBaseline(englishPage, "en");
        expect(
          await englishPage
            .locator("[data-release-gate-fixture='wm-0086-web-product-gate']")
            .count(),
        ).toBe(0);
      } finally {
        await englishApp.close();
      }

      const chineseUserDataDir = path.join(userDataRoot, "zh");
      const chineseApp = await electron.launch({
        args: ["--lang=zh-TW", MAIN_ENTRY_PATH],
        env: {
          ...process.env,
          WM_DESKTOP_DEV_SERVER_URL: readServerUrl(server),
          WM_DESKTOP_USER_DATA_DIR: chineseUserDataDir,
        },
      });

      try {
        const chinesePage = await chineseApp.firstWindow();
        await chinesePage.waitForSelector("[data-shell-ready='true']");
        await waitForLocale(chinesePage, "zh-CN", "system");
        await assertDesktopStartSurfaceBaseline(chinesePage, "zh-CN");
        await chinesePage.getByTestId("main-menu-locale-en").click();
        await waitForLocale(chinesePage, "en", "manual");
        await waitForHudText(chinesePage, "New Game");
      } finally {
        await chineseApp.close();
      }

      const persistedApp = await electron.launch({
        args: ["--lang=zh-TW", MAIN_ENTRY_PATH],
        env: {
          ...process.env,
          WM_DESKTOP_DEV_SERVER_URL: readServerUrl(server),
          WM_DESKTOP_USER_DATA_DIR: chineseUserDataDir,
        },
      });

      try {
        const persistedPage = await persistedApp.firstWindow();
        await persistedPage.waitForSelector("[data-shell-ready='true']");
        await waitForLocale(persistedPage, "en", "manual");
        await waitForHudText(persistedPage, "New Game");
      } finally {
        await persistedApp.close();
      }
    } finally {
      await server.close();
      await rm(userDataRoot, {
        force: true,
        recursive: true,
      });
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
    error: ELECTRON_PRELOAD_UNAVAILABLE_ERROR,
    ok: false,
  });
  await assertPreloadBridgeAllowlist(page);
}

async function assertPreloadBridgeAllowlist(page: Page): Promise<void> {
  const rawAudit: unknown = await page.evaluate((forbiddenKeys: readonly string[]): unknown => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null;
    const readKeys = (value: unknown): readonly string[] =>
      isRecord(value) ? Object.keys(value).sort() : [];
    const descriptor = Object.getOwnPropertyDescriptor(window, "wumingTownPlatform");
    const bridge: unknown = descriptor?.value;
    if (!isRecord(bridge)) {
      return undefined;
    }

    return {
      diagnosticKeys: readKeys(bridge["diagnostics"]),
      forbiddenBridgeKeys: Object.keys(bridge)
        .filter((key) => forbiddenKeys.includes(key))
        .sort(),
      host: bridge["host"],
      modKeys: readKeys(bridge["mods"]),
      saveStoreKeys: readKeys(bridge["saveStore"]),
      topLevelKeys: Object.keys(bridge).sort(),
    };
  }, ELECTRON_PRELOAD_FORBIDDEN_KEYS);
  const audit = readPreloadBridgeAudit(rawAudit);

  expect(audit.topLevelKeys).toStrictEqual(sortStrings(ELECTRON_PRELOAD_TOP_LEVEL_KEYS));
  expect(audit.modKeys).toStrictEqual(sortStrings(ELECTRON_PRELOAD_MOD_KEYS));
  expect(audit.saveStoreKeys).toStrictEqual(sortStrings(ELECTRON_PRELOAD_SAVE_STORE_KEYS));
  expect(audit.diagnosticKeys).toStrictEqual(sortStrings(ELECTRON_PRELOAD_DIAGNOSTIC_KEYS));
  expect(audit.forbiddenBridgeKeys).toStrictEqual([]);
  expect(audit.host).toStrictEqual(ELECTRON_PRELOAD_HOST);
}

async function assertShellReady(page: Page, expectedHostKind: string): Promise<void> {
  await page.waitForSelector("[data-shell-ready='true']");

  const debugPayload = await readDebugPayload(page);
  expect(debugPayload["fixtureId"]).toBe("wm-0086-web-product-gate");
  expect(debugPayload["platformHost"]).toMatchObject({
    contextIsolation: true,
    kind: expectedHostKind,
    nodeIntegration: false,
    sandboxedRenderer: true,
  });

  const releaseGateText = await page
    .locator("[data-release-gate-fixture='wm-0086-web-product-gate']")
    .textContent();
  expect(releaseGateText ?? "").toContain("M5 first-season Web product-gate fixture");
  expect(releaseGateText ?? "").toContain("m5.alpha_content_framework.first_season.v1");
  await assertDesktopDiagnosticBaseline(page, debugPayload);
  await assertDesktopAccessibilityBaseline(page, debugPayload);
}

async function assertDesktopDiagnosticBaseline(
  page: Page,
  debugPayload: Record<string, unknown>,
): Promise<void> {
  const diagnostics = readRecord(debugPayload["diagnostics"], "desktop diagnostics");
  expect(diagnostics["packageKind"]).toBe("m6-local-diagnostic-package");
  expect(diagnostics["telemetryEnabled"]).toBe(false);
  expect(diagnostics["networkUploadEnabled"]).toBe(false);
  expect(diagnostics["webDownloadStatus"]).toBe("available");
  expect(diagnostics["windowsHostPackageStatus"]).toBe("blocked");
  expect(diagnostics["suggestedFileName"]).toBe("wuming-town-m6-diagnostics.json");

  const blockerCodes = diagnostics["blockerCodes"];
  if (!Array.isArray(blockerCodes)) {
    throw new Error("Desktop diagnostics did not expose blocker codes.");
  }
  expect(blockerCodes).toContain("windows_host_diagnostics_bridge_blocked");

  const diagnosticStatusText = await page.getByTestId("diagnostic-status").textContent();
  expect(diagnosticStatusText ?? "").toContain("Diagnostics idle");
  expect(diagnosticStatusText ?? "").toContain("BLOCKED");
}

async function assertDesktopAccessibilityBaseline(
  page: Page,
  debugPayload: Record<string, unknown>,
): Promise<void> {
  const shellText = await page.locator("[data-shell-ready='true']").textContent();
  expect(shellText ?? "").toContain("Wuming Town");
  if ((await page.getByTestId("main-menu-surface").count()) > 0) {
    await assertDesktopStartSurfaceBaseline(page, "en");
    await page.getByTestId("main-menu-new-game").click();
    await waitForDesktopStartSurfaceClosed(page);
  }
  await waitForHudText(page, "Language settings");
  expect(shellText ?? "").toContain("无明镇");

  const warningAlertText = await page
    .locator("[data-alert-severity='warning']")
    .first()
    .textContent();
  const stableAlertText = await page
    .locator("[data-alert-severity='stable']")
    .first()
    .textContent();
  expect(warningAlertText ?? "").toContain("WARNING");
  expect(warningAlertText ?? "").toContain("Lantern corridor gap");
  expect(stableAlertText ?? "").toContain("STABLE");

  const interoperabilityText = await page.getByTestId("storage-interoperability").textContent();
  expect(interoperabilityText ?? "").toContain("BLOCKED");

  const mediaCueCount = await page.locator("audio, video").count();
  expect(mediaCueCount).toBe(0);

  const activeAnimationCount = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState !== "finished").length,
  );
  expect(activeAnimationCount).toBe(0);

  const documentOverflowX = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(documentOverflowX).toBeLessThanOrEqual(1);

  const targetEntity = findRequiredEntity(debugPayload, "lantern-keeper-shen");
  await clickCanvasPoint(page, targetEntity);
  await waitForSelectedEntity(page, "lantern-keeper-shen");
  await page.keyboard.press("Equal");
  await waitForHudText(page, "Keyboard Equal");
  await page.keyboard.press("ArrowLeft");
  await waitForHudText(page, "Keyboard ArrowLeft");
}

async function assertDesktopOnboardingBaseline(page: Page): Promise<void> {
  const surface = page.getByTestId("main-menu-surface");
  expect(await surface.count()).toBe(1);
  const surfaceText = await surface.textContent();
  expect(surfaceText ?? "").toContain("Wuming Town");
  expect(await page.getByTestId("main-menu-new-game").count()).toBe(1);
  expect(await page.getByTestId("main-menu-continue").count()).toBe(1);
  expect(await page.getByTestId("main-menu-settings").count()).toBe(1);
  expect(await page.getByTestId("main-menu-language").count()).toBe(1);
}

async function assertDesktopStartSurfaceBaseline(
  page: Page,
  locale: "en" | "zh-CN",
): Promise<void> {
  await assertDesktopOnboardingBaseline(page);
  const surfaceText = await page.getByTestId("main-menu-surface").textContent();
  if (locale === "en") {
    expect(surfaceText ?? "").toContain("New Game");
    expect(surfaceText ?? "").toContain("Settings");
  } else {
    expect(surfaceText ?? "").toContain("主菜单");
    expect(surfaceText ?? "").toContain("新游戏");
    expect(surfaceText ?? "").toContain("设置");
  }

  await page.getByTestId("main-menu-settings").click();
  await page.getByTestId("locale-select").waitFor();
  expect(await page.getByTestId("main-menu-back").count()).toBe(1);
  await page.getByTestId("main-menu-back").click();
  await page.getByTestId("main-menu-settings").waitFor();
}

async function waitForDesktopStartSurfaceClosed(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await page.getByTestId("main-menu-surface").count()) === 0) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Timed out waiting for the desktop main menu surface to close.");
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
    await seedStalePackageOutput();
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

async function seedStalePackageOutput(): Promise<void> {
  await mkdir(path.dirname(PACKAGED_STALE_ARTIFACT_PATH), {
    recursive: true,
  });
  await writeFile(PACKAGED_STALE_ARTIFACT_PATH, "stale external smoke artifact\n", "utf8");
}

async function assertPackagedMainBundleSanitized(): Promise<void> {
  expect(await pathExists(path.join(MAIN_DIST_DIR, "main.js"))).toBe(true);
  expect(await pathExists(STALE_MAIN_OUTPUT_PATH)).toBe(false);
  expect(await pathExists(path.join(PACKAGED_MAIN_DIR, "main.js"))).toBe(true);
  expect(await pathExists(PACKAGED_STALE_OUTPUT_PATH)).toBe(false);
  expect(await pathExists(PACKAGED_STALE_ARTIFACT_PATH)).toBe(false);
}

async function assertDesktopPackageReport(): Promise<void> {
  const parsed: unknown = JSON.parse(await readFile(DESKTOP_PACKAGE_REPORT_PATH, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error("Unexpected desktop package report.");
  }

  const totalBytes = parsed["totalBytes"];
  const fileCount = parsed["fileCount"];
  const contentSha256Hex = parsed["contentSha256Hex"];
  const knownWarnings = parsed["knownWarnings"];
  const securityBoundary = parsed["securityBoundary"];

  if (
    typeof totalBytes !== "number" ||
    typeof fileCount !== "number" ||
    typeof contentSha256Hex !== "string" ||
    !Array.isArray(knownWarnings) ||
    !isRecord(securityBoundary)
  ) {
    throw new Error("Desktop package report has invalid metadata.");
  }

  expect(parsed["taskId"]).toBe("WM-0090");
  expect(parsed["packageKind"]).toBe("windows-unpacked-directory");
  expect(parsed["buildCommand"]).toBe("pnpm build:desktop");
  expect(parsed["artifactPath"]).toBe("dist/desktop/win-unpacked");
  expect(parsed["executablePath"]).toBe("dist/desktop/win-unpacked/WumingTown.exe");
  expect(parsed["rendererReportPath"]).toBe(
    "apps/desktop-electron/dist/renderer/wm-release-gate-report.json",
  );
  expect(totalBytes).toBeGreaterThan(0);
  expect(fileCount).toBeGreaterThan(0);
  expect(contentSha256Hex).toMatch(/^[0-9a-f]{64}$/u);
  expect(knownWarnings.length).toBeGreaterThanOrEqual(1);
  expect(securityBoundary).toMatchObject({
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    simulationAuthority: "simulation-worker-or-headless",
  });
}

async function assertWebReleaseGateReport(): Promise<void> {
  const parsed: unknown = JSON.parse(await readFile(WEB_RELEASE_GATE_REPORT_PATH, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error("Unexpected Web release-gate report.");
  }

  const fixture = readRecord(parsed["fixture"], "Web release-gate fixture");
  const output = readRecord(parsed["output"], "Web release-gate output");
  const buildAssumptions = readRecord(
    parsed["buildAssumptions"],
    "Web release-gate build assumptions",
  );
  const browserNames = readBrowserTargetNames(parsed["browserTargets"]);
  const runtimeDeliverableEstimatedGzipBytes = output["runtimeDeliverableEstimatedGzipBytes"];
  const bundleBudgetMb = buildAssumptions["bundleBudgetMb"];

  if (
    typeof runtimeDeliverableEstimatedGzipBytes !== "number" ||
    typeof bundleBudgetMb !== "number"
  ) {
    throw new Error("Web release-gate report has invalid size metadata.");
  }

  expect(parsed["harnessId"]).toBe("wm-0086-web-product-gate");
  expect(fixture["label"]).toBe("M5 first-season Web product-gate fixture");
  expect(output["distDir"]).toBe("apps/desktop-electron/dist/renderer");
  expect(runtimeDeliverableEstimatedGzipBytes).toBeGreaterThan(0);
  expect(runtimeDeliverableEstimatedGzipBytes).toBeLessThanOrEqual(bundleBudgetMb * 1024 * 1024);
  expect(browserNames).toContain("Chrome Stable");
  expect(browserNames).toContain("Edge Stable");
  expect(buildAssumptions["authorityBoundary"]).toBe(
    "Simulation Worker or headless remains the only world authority. Web UI, Pixi and React consume read-only fixture and projection data only.",
  );
  expect(buildAssumptions["fallbackWithoutIsolation"]).toContain(
    "SharedArrayBuffer remains optional.",
  );
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

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }

  return value;
}

function readBrowserTargetNames(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected browser targets to be an array.");
  }

  return value.map((target: unknown): string => {
    if (!isRecord(target) || typeof target["browser"] !== "string") {
      throw new Error("Expected browser target to include a browser name.");
    }

    return target["browser"];
  });
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDebugPayload(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error("Unexpected desktop debug payload.");
  }

  return parsed;
}

function readPreloadBridgeAudit(value: unknown): PreloadBridgeAudit {
  if (
    !isRecord(value) ||
    !isStringArray(value["diagnosticKeys"]) ||
    !isStringArray(value["forbiddenBridgeKeys"]) ||
    !isStringArray(value["modKeys"]) ||
    !isStringArray(value["saveStoreKeys"]) ||
    !isStringArray(value["topLevelKeys"])
  ) {
    throw new Error("Unexpected preload bridge audit payload.");
  }

  return {
    diagnosticKeys: value["diagnosticKeys"],
    forbiddenBridgeKeys: value["forbiddenBridgeKeys"],
    host: value["host"],
    modKeys: value["modKeys"],
    saveStoreKeys: value["saveStoreKeys"],
    topLevelKeys: value["topLevelKeys"],
  };
}

function sortStrings(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

function readServerUrl(server: ViteDevServer): string {
  const localUrl = server.resolvedUrls?.local[0];
  if (localUrl === undefined) {
    throw new Error("Vite dev server did not expose a local URL.");
  }

  return localUrl;
}

async function clickCanvasPoint(
  page: Page,
  point: { readonly x: number; readonly y: number },
): Promise<void> {
  await page
    .locator("[data-testid='world-canvas']")
    .evaluate((canvas: HTMLCanvasElement, target: { readonly x: number; readonly y: number }) => {
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: rect.left + target.x,
          clientY: rect.top + target.y,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: rect.left + target.x,
          clientY: rect.top + target.y,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
    }, point);
}

function findRequiredEntity(
  payload: Record<string, unknown>,
  entityId: string,
): { readonly x: number; readonly y: number } {
  const positions = payload["entityScreenPositions"];
  if (!Array.isArray(positions)) {
    throw new Error("Desktop debug payload did not include entity screen positions.");
  }

  for (const candidate of positions) {
    if (
      isRecord(candidate) &&
      candidate["entityId"] === entityId &&
      typeof candidate["x"] === "number" &&
      typeof candidate["y"] === "number"
    ) {
      return {
        x: candidate["x"],
        y: candidate["y"],
      };
    }
  }

  throw new Error(`Expected entity screen position for ${entityId}.`);
}

async function waitForHudText(page: Page, expectedText: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const hudText = await page.locator("[data-shell-ready='true']").textContent();
    if (hudText?.includes(expectedText) === true) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for HUD text: ${expectedText}`);
}

async function waitForSelectedEntity(page: Page, expectedEntityId: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const selectedEntity = await page
      .locator("[data-selected-entity]")
      .getAttribute("data-selected-entity");
    if (selectedEntity === expectedEntityId) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for selected entity ${expectedEntityId}`);
}

async function waitForLocale(
  page: Page,
  expectedLocale: "en" | "zh-CN",
  expectedSource: "manual" | "system",
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const locale = await page.locator("[data-shell-ready='true']").getAttribute("data-locale");
    const source = await page
      .locator("[data-shell-ready='true']")
      .getAttribute("data-locale-source");
    if (locale === expectedLocale && source === expectedSource) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for locale ${expectedLocale}/${expectedSource}.`);
}

async function runCommand(command: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const fullArgs = command === "pnpm" ? ["pnpm", ...args] : [...args];
    const executable = command === "pnpm" ? "corepack" : command;
    const child = spawn(executable, fullArgs, {
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${executable} ${fullArgs.join(" ")} exited with code ${String(code)}`));
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
