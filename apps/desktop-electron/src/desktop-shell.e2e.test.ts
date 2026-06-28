/// <reference lib="dom" />

import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { _electron as electron, type ElectronApplication, type Page } from "playwright";
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

interface ResponsiveViewport {
  readonly width: number;
  readonly height: number;
}

interface ResponsiveSelectorMetric {
  readonly bottom: number;
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly height: number;
  readonly left: number;
  readonly overflowX: number;
  readonly overflowY: number;
  readonly right: number;
  readonly scrollHeight: number;
  readonly scrollWidth: number;
  readonly top: number;
  readonly width: number;
}

interface ResponsiveLayoutArtifact {
  readonly diagnosticsVisible: boolean;
  readonly documentOverflowX: number;
  readonly documentOverflowY: number;
  readonly locale: "en" | "zh-CN";
  readonly metrics: Record<string, ResponsiveSelectorMetric>;
  readonly screenshotPath?: string;
  readonly shell: "desktop";
  readonly source: "system";
  readonly surface: "debug-overlay" | "player-hud" | "start-surface";
  readonly viewport: ResponsiveViewport;
}

const WM0118_RESPONSIVE_VIEWPORTS: readonly ResponsiveViewport[] = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1424, height: 861 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1369 },
  { width: 2560, height: 1440 },
];

const WM0118_DESKTOP_ARTIFACT_ROOT = path.join(
  process.cwd(),
  "coordination",
  "artifacts",
  "WM-0118",
);
const WM0118_DESKTOP_LAYOUT_PATH = path.join(
  WM0118_DESKTOP_ARTIFACT_ROOT,
  "desktop-responsive-layout.json",
);
const WM0118_DESKTOP_SCREENSHOT_ROOT = path.join(WM0118_DESKTOP_ARTIFACT_ROOT, "desktop");

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

  it("defaults locale by renderer language and persists manual display overrides across restart", async () => {
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
        await waitForUiScale(englishPage, "standard");
        await assertDesktopStartSurfaceBaseline(englishPage, "en");
        await englishPage.getByTestId("main-menu-new-game").click();
        await waitForDesktopStartSurfaceClosed(englishPage);
        await assertDesktopPlayerHudBaseline(englishPage);
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
        await waitForUiScale(chinesePage, "standard");
        await assertDesktopStartSurfaceBaseline(chinesePage, "zh-CN");
        await chinesePage.getByTestId("main-menu-locale-en").click();
        await waitForLocale(chinesePage, "en", "manual");
        await waitForHudText(chinesePage, "New Game");
        await chinesePage.getByTestId("main-menu-settings").click();
        await chinesePage.getByTestId("ui-scale-select").selectOption("large");
        await waitForUiScale(chinesePage, "large");
        await chinesePage.getByTestId("main-menu-back").click();
        await chinesePage.getByTestId("main-menu-settings").waitFor();
        await assertDesktopStartSurfaceViewportLayout(chineseApp, chinesePage, 390, 720);
        await chinesePage.getByTestId("main-menu-new-game").click();
        await waitForDesktopStartSurfaceClosed(chinesePage);
        await assertDesktopTownHudViewportLayout(chineseApp, chinesePage, 390, 720, "en");
        await assertDesktopPlayerHudBaseline(chinesePage);
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
        await waitForUiScale(persistedPage, "large");
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

  it("validates the desktop M8 responsive viewport matrix and records reviewer artifacts", async () => {
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

    const artifacts: ResponsiveLayoutArtifact[] = [];

    try {
      await collectDesktopResponsiveLocaleArtifacts(
        readServerUrl(server),
        {
          expectedLocale: "en",
          playwrightLocale: "en-US",
        },
        artifacts,
      );
      await collectDesktopResponsiveLocaleArtifacts(
        readServerUrl(server),
        {
          expectedLocale: "zh-CN",
          playwrightLocale: "zh-TW",
        },
        artifacts,
      );
      await collectDesktopResponsiveDebugArtifacts(readServerUrl(server), artifacts);
      await mkdir(path.dirname(WM0118_DESKTOP_LAYOUT_PATH), {
        recursive: true,
      });
      await writeFile(
        WM0118_DESKTOP_LAYOUT_PATH,
        `${JSON.stringify(artifacts, null, 2)}\n`,
        "utf8",
      );
    } finally {
      await server.close();
    }
  }, 300000);
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

  await assertDesktopDebugOverlayBaseline(page);
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
  await waitForUiScale(page, "standard");
  if ((await page.getByTestId("main-menu-surface").count()) > 0) {
    await assertDesktopStartSurfaceBaseline(page, "en");
    await page.getByTestId("main-menu-new-game").click();
    await waitForDesktopStartSurfaceClosed(page);
  }
  await assertDesktopPlayerHudStructure(page);
  await waitForHudText(page, "Display settings");
  await assertContrastBaseline(page);
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

async function assertDesktopPlayerHudBaseline(page: Page): Promise<void> {
  await assertDesktopPlayerHudLocaleState(page, "en");
}

async function assertDesktopPlayerHudStructure(page: Page): Promise<void> {
  expect(await page.getByTestId("player-hud").count()).toBe(1);
  expect(await page.getByTestId("player-top-bar").count()).toBe(1);
  expect(await page.getByTestId("player-next-goal").count()).toBe(1);
  expect(await page.getByTestId("player-night-risk").count()).toBe(1);
  expect(await page.getByTestId("player-task-list").count()).toBe(1);
  expect(await page.getByTestId("player-event-list").count()).toBe(1);
  expect(await page.getByTestId("player-resident-watch").count()).toBe(1);
  expect(await page.locator("[data-testid='world-canvas']").count()).toBe(1);
}

async function assertDesktopPlayerHudLocaleState(
  page: Page,
  locale: "en" | "zh-CN",
): Promise<void> {
  await assertDesktopPlayerHudStructure(page);
  expect(await page.getByTestId("debug-overlay").count()).toBe(0);
  const activeLocale = await page.locator("[data-shell-ready='true']").getAttribute("data-locale");
  expect(activeLocale).toBe(locale);
  const nightRiskTier = await page
    .getByTestId("player-night-risk")
    .getAttribute("data-night-risk-tier");
  expect(nightRiskTier).toBe("strained");
  if (locale === "en") {
    const goalText = await page.getByTestId("player-next-goal").textContent();
    expect(goalText ?? "").toContain("Lantern corridor gap");
  }
}

async function assertDesktopDebugOverlayBaseline(page: Page): Promise<void> {
  expect(await page.getByTestId("player-hud").count()).toBe(1);
  expect(await page.getByTestId("debug-overlay").count()).toBe(1);
  expect(await page.getByTestId("storage-panel").count()).toBe(1);
  const overlayText = await page.getByTestId("debug-overlay").textContent();
  expect(overlayText ?? "").toContain("wmDiagnostics=1");
  expect(overlayText ?? "").toContain("Web Product Gate");
}

async function assertDesktopOnboardingBaseline(page: Page): Promise<void> {
  const surface = page.getByTestId("main-menu-surface");
  expect(await surface.count()).toBe(1);
  const surfaceText = await surface.textContent();
  expect(surfaceText ?? "").toContain("Wuming Town");
  expect(await page.getByTestId("main-menu-new-game").count()).toBe(1);
  expect(await page.getByTestId("main-menu-continue").count()).toBe(1);
  expect(await page.getByTestId("main-menu-settings").count()).toBe(1);
  expect(await page.getByTestId("main-menu-first-play-guidance").count()).toBe(1);
  expect(await page.getByTestId("main-menu-next-goal").count()).toBe(1);
  expect(await page.getByTestId("main-menu-available-actions").count()).toBe(1);
  expect(await page.getByTestId("main-menu-guidance-boundary").count()).toBe(1);
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
    expect(surfaceText ?? "").toContain("First-play guidance");
    expect(surfaceText ?? "").toContain("Available actions");
    expect(surfaceText ?? "").toContain("Next goal");
  } else {
    expect(surfaceText ?? "").toContain("主菜单");
    expect(surfaceText ?? "").toContain("新游戏");
    expect(surfaceText ?? "").toContain("设置");
    expect(surfaceText ?? "").toContain("首次游玩指引");
    expect(surfaceText ?? "").toContain("可用行动");
    expect(surfaceText ?? "").toContain("下一目标");
    expect(surfaceText ?? "").toContain("黄昏守望");
    expect(surfaceText ?? "").toContain("补上灯火缺口");
    expect(surfaceText ?? "").toContain("先确认灯火覆盖、路线证据与守夜义务");
    expect(surfaceText ?? "").not.toContain("Dusk watch");
    expect(surfaceText ?? "").not.toContain("Lantern corridor gap");
    expect(surfaceText ?? "").not.toContain("The east market lane may lose light before curfew.");
  }
  expect(surfaceText ?? "").not.toContain("Web Product Gate");

  await page.getByTestId("main-menu-settings").click();
  await page.getByTestId("locale-select").waitFor();
  expect(await page.getByTestId("main-menu-back").count()).toBe(1);
  expect(await page.getByTestId("ui-scale-select").count()).toBe(1);
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

async function collectDesktopResponsiveLocaleArtifacts(
  serverUrl: string,
  localeCase: {
    readonly expectedLocale: "en" | "zh-CN";
    readonly playwrightLocale: string;
  },
  artifacts: ResponsiveLayoutArtifact[],
): Promise<void> {
  const userDataRoot = await mkdtemp(path.join(os.tmpdir(), "wuming-town-wm-0118-desktop-"));
  const initialViewport = WM0118_RESPONSIVE_VIEWPORTS[0];
  if (initialViewport === undefined) {
    throw new Error("WM-0118 viewport matrix was empty.");
  }

  const electronApp = await electron.launch({
    args: [`--lang=${localeCase.playwrightLocale}`, MAIN_ENTRY_PATH],
    env: {
      ...process.env,
      WM_DESKTOP_DEV_SERVER_URL: serverUrl,
      WM_DESKTOP_USER_DATA_DIR: userDataRoot,
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await resizeDesktopViewport(electronApp, page, initialViewport);
    await page.waitForSelector("[data-shell-ready='true']");
    await waitForLocale(page, localeCase.expectedLocale, "system");
    await assertDesktopStartSurfaceBaseline(page, localeCase.expectedLocale);

    for (const viewport of WM0118_RESPONSIVE_VIEWPORTS) {
      await assertDesktopStartSurfaceViewportLayout(
        electronApp,
        page,
        viewport.width,
        viewport.height,
      );
      const screenshotPath = await maybeCaptureDesktopResponsiveScreenshot(
        page,
        "start-surface",
        localeCase.expectedLocale,
        viewport,
      );
      artifacts.push(
        await captureDesktopResponsiveLayoutArtifact(page, {
          locale: localeCase.expectedLocale,
          selectors: {
            availableActions: "[data-testid='main-menu-available-actions']",
            firstPlayGuidance: "[data-testid='main-menu-first-play-guidance']",
            guidanceBoundary: "[data-testid='main-menu-guidance-boundary']",
            languageSection: "[data-testid='main-menu-language']",
            nextGoal: "[data-testid='main-menu-next-goal']",
            panel: "[data-testid='main-menu-panel']",
          },
          shell: "desktop",
          source: "system",
          surface: "start-surface",
          viewport,
          ...(screenshotPath === undefined ? {} : { screenshotPath }),
        }),
      );
    }

    await page.getByTestId("main-menu-new-game").click();
    await waitForDesktopStartSurfaceClosed(page);

    for (const viewport of WM0118_RESPONSIVE_VIEWPORTS) {
      await assertDesktopTownHudViewportLayout(
        electronApp,
        page,
        viewport.width,
        viewport.height,
        localeCase.expectedLocale,
      );
      const screenshotPath = await maybeCaptureDesktopResponsiveScreenshot(
        page,
        "player-hud",
        localeCase.expectedLocale,
        viewport,
      );
      artifacts.push(
        await captureDesktopResponsiveLayoutArtifact(page, {
          locale: localeCase.expectedLocale,
          selectors: {
            eventList: "[data-testid='player-event-list']",
            localeSettings: "[data-testid='locale-settings']",
            nextGoal: "[data-testid='player-next-goal']",
            residentWatch: "[data-testid='player-resident-watch']",
            selectedDetail: "[data-testid='player-selected-detail']",
            taskList: "[data-testid='player-task-list']",
            topBar: "[data-testid='player-top-bar']",
            worldCanvas: "[data-testid='world-canvas']",
          },
          shell: "desktop",
          source: "system",
          surface: "player-hud",
          viewport,
          ...(screenshotPath === undefined ? {} : { screenshotPath }),
        }),
      );
    }
  } finally {
    await electronApp.close();
    await rm(userDataRoot, {
      force: true,
      recursive: true,
    });
  }
}

async function collectDesktopResponsiveDebugArtifacts(
  serverUrl: string,
  artifacts: ResponsiveLayoutArtifact[],
): Promise<void> {
  const userDataRoot = await mkdtemp(path.join(os.tmpdir(), "wuming-town-wm-0118-debug-"));
  const initialViewport = WM0118_RESPONSIVE_VIEWPORTS[0];
  if (initialViewport === undefined) {
    throw new Error("WM-0118 viewport matrix was empty.");
  }

  const electronApp = await electron.launch({
    args: ["--lang=en-US", MAIN_ENTRY_PATH],
    env: {
      ...process.env,
      WM_DESKTOP_DEV_SERVER_URL: serverUrl,
      WM_DESKTOP_QUERY: "wmDiagnostics=1",
      WM_DESKTOP_USER_DATA_DIR: userDataRoot,
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await resizeDesktopViewport(electronApp, page, initialViewport);
    await page.waitForSelector("[data-shell-ready='true']");
    await waitForLocale(page, "en", "system");

    for (const viewport of WM0118_RESPONSIVE_VIEWPORTS) {
      await assertDesktopDebugOverlayViewportLayout(
        electronApp,
        page,
        viewport.width,
        viewport.height,
      );
      const screenshotPath = await maybeCaptureDesktopResponsiveScreenshot(
        page,
        "debug-overlay",
        "en",
        viewport,
      );
      artifacts.push(
        await captureDesktopResponsiveLayoutArtifact(page, {
          locale: "en",
          selectors: {
            debugOverlay: "[data-testid='debug-overlay']",
            eventList: "[data-testid='player-event-list']",
            nextGoal: "[data-testid='player-next-goal']",
            residentWatch: "[data-testid='player-resident-watch']",
            selectedDetail: "[data-testid='player-selected-detail']",
            storagePanel: "[data-testid='storage-panel']",
            taskList: "[data-testid='player-task-list']",
            topBar: "[data-testid='player-top-bar']",
          },
          shell: "desktop",
          source: "system",
          surface: "debug-overlay",
          viewport,
          ...(screenshotPath === undefined ? {} : { screenshotPath }),
        }),
      );
    }
  } finally {
    await electronApp.close();
    await rm(userDataRoot, {
      force: true,
      recursive: true,
    });
  }
}

async function assertDesktopStartSurfaceViewportLayout(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  await resizeDesktopViewport(electronApp, page, {
    height,
    width,
  });
  await page.getByTestId("main-menu-panel").waitFor();

  const panelMetrics = await readElementViewportMetrics(page, "[data-testid='main-menu-panel']");
  expect(panelMetrics.top).toBeGreaterThanOrEqual(0);
  expect(panelMetrics.left).toBeGreaterThanOrEqual(0);
  expect(panelMetrics.right).toBeLessThanOrEqual(width + 1);
  expect(panelMetrics.bottom).toBeLessThanOrEqual(height + 1);
  expect(panelMetrics.overflowX).toBeLessThanOrEqual(1);
  await assertDocumentOverflowWithinViewport(page);

  for (const testId of [
    "main-menu-first-play-guidance",
    "main-menu-next-goal",
    "main-menu-available-actions",
    "main-menu-guidance-boundary",
    "main-menu-language",
    "main-menu-locale-system",
    "main-menu-locale-zh-CN",
    "main-menu-locale-en",
  ]) {
    await assertTestIdWithinViewport(page, testId, width, height);
  }

  await page.getByTestId("main-menu-settings").click();
  await page.getByTestId("locale-select").scrollIntoViewIfNeeded();
  await assertTestIdWithinViewport(page, "main-menu-back", width, height);
  await assertTestIdWithinViewport(page, "locale-select", width, height);
  await assertTestIdWithinViewport(page, "locale-source", width, height);
  await assertTestIdWithinViewport(page, "locale-current", width, height);
  await assertTestIdWithinViewport(page, "locale-persistence", width, height);
  await assertTestIdWithinViewport(page, "ui-scale-select", width, height);
  await assertTestIdWithinViewport(page, "ui-scale-current", width, height);
  await assertTestIdWithinViewport(page, "ui-scale-persistence", width, height);
  await assertTestIdWithinViewport(page, "display-boundary", width, height);
  await page.getByTestId("main-menu-back").click();
  await page.getByTestId("main-menu-settings").waitFor();
}

async function assertDesktopTownHudViewportLayout(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
  height: number,
  locale: "en" | "zh-CN",
): Promise<void> {
  await resizeDesktopViewport(electronApp, page, {
    height,
    width,
  });
  await assertDesktopPlayerHudLocaleState(page, locale);
  await assertDocumentOverflowWithinViewport(page);

  for (const testId of [
    "player-top-bar",
    "player-next-goal",
    "player-task-list",
    "player-event-list",
    "player-resident-watch",
    "ui-scale-settings",
  ]) {
    await assertTestIdReachableWithoutCover(page, testId, width, height);
  }
  await assertTallSelectorReachableWithoutCover(
    page,
    "[data-testid='player-selected-detail']",
    width,
    height,
  );
  await assertTallSelectorReachableWithoutCover(
    page,
    "[data-testid='locale-settings']",
    width,
    height,
  );

  const worldCanvasMetrics = await readElementViewportMetrics(page, "[data-testid='world-canvas']");
  expect(worldCanvasMetrics.left).toBeLessThanOrEqual(1);
  expect(worldCanvasMetrics.top).toBeLessThanOrEqual(1);
  expect(worldCanvasMetrics.right).toBeGreaterThanOrEqual(width - 1);
  expect(worldCanvasMetrics.bottom).toBeGreaterThanOrEqual(height - 1);
}

async function assertDesktopDebugOverlayViewportLayout(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  await resizeDesktopViewport(electronApp, page, {
    height,
    width,
  });
  await assertDesktopDebugOverlayBaseline(page);
  await assertDocumentOverflowWithinViewport(page);

  for (const testId of [
    "player-top-bar",
    "player-next-goal",
    "player-task-list",
    "player-event-list",
    "player-resident-watch",
  ]) {
    await assertTestIdReachableWithoutCover(page, testId, width, height);
  }
  await assertTallSelectorReachableWithoutCover(
    page,
    "[data-testid='storage-panel']",
    width,
    height,
  );
  await assertTallSelectorReachableWithoutCover(
    page,
    "[data-testid='player-selected-detail']",
    width,
    height,
  );
}

async function captureDesktopResponsiveLayoutArtifact(
  page: Page,
  options: {
    readonly locale: "en" | "zh-CN";
    readonly screenshotPath?: string;
    readonly selectors: Record<string, string>;
    readonly shell: "desktop";
    readonly source: "system";
    readonly surface: "debug-overlay" | "player-hud" | "start-surface";
    readonly viewport: ResponsiveViewport;
  },
): Promise<ResponsiveLayoutArtifact> {
  const metrics: Record<string, ResponsiveSelectorMetric> = {};
  for (const [label, selector] of Object.entries(options.selectors)) {
    metrics[label] = await readElementViewportMetrics(page, selector);
  }

  const overflow = await readDocumentOverflow(page);
  const diagnosticsVisible =
    (await page.locator("[data-shell-ready='true']").getAttribute("data-diagnostics-visible")) ===
    "true";

  return {
    diagnosticsVisible,
    documentOverflowX: overflow.documentOverflowX,
    documentOverflowY: overflow.documentOverflowY,
    locale: options.locale,
    metrics,
    shell: options.shell,
    source: options.source,
    surface: options.surface,
    viewport: options.viewport,
    ...(options.screenshotPath === undefined ? {} : { screenshotPath: options.screenshotPath }),
  };
}

async function maybeCaptureDesktopResponsiveScreenshot(
  page: Page,
  surface: "debug-overlay" | "player-hud" | "start-surface",
  locale: "en" | "zh-CN",
  viewport: ResponsiveViewport,
): Promise<string | undefined> {
  if (!shouldCaptureDesktopResponsiveScreenshot(surface, locale, viewport)) {
    return undefined;
  }

  const screenshotPath = path.join(
    WM0118_DESKTOP_SCREENSHOT_ROOT,
    `${surface}-${locale}-${String(viewport.width)}x${String(viewport.height)}.png`,
  );
  await mkdir(path.dirname(screenshotPath), {
    recursive: true,
  });
  await page.screenshot({
    animations: "disabled",
    path: screenshotPath,
  });
  return toRelativeArtifactPath(screenshotPath);
}

function shouldCaptureDesktopResponsiveScreenshot(
  surface: "debug-overlay" | "player-hud" | "start-surface",
  locale: "en" | "zh-CN",
  viewport: ResponsiveViewport,
): boolean {
  return (
    (surface === "start-surface" &&
      locale === "zh-CN" &&
      viewport.width === 1424 &&
      viewport.height === 861) ||
    (surface === "player-hud" &&
      locale === "en" &&
      viewport.width === 2560 &&
      viewport.height === 1369) ||
    (surface === "debug-overlay" &&
      locale === "en" &&
      viewport.width === 1424 &&
      viewport.height === 861)
  );
}

async function resizeDesktopViewport(
  electronApp: ElectronApplication,
  page: Page,
  viewport: ResponsiveViewport,
): Promise<void> {
  const browserWindow = await electronApp.browserWindow(page);
  await browserWindow.evaluate(
    (
      windowRef: {
        readonly isDestroyed: () => boolean;
        readonly setContentSize: (width: number, height: number) => void;
      },
      size: ResponsiveViewport,
    ) => {
      if (!windowRef.isDestroyed()) {
        windowRef.setContentSize(size.width, size.height);
      }
    },
    viewport,
  );
  await waitForViewportSize(page, viewport.width, viewport.height);
}

async function waitForViewportSize(page: Page, width: number, height: number): Promise<void> {
  await page.waitForFunction(
    (size: ResponsiveViewport) =>
      Math.abs(window.innerWidth - size.width) <= 1 &&
      Math.abs(window.innerHeight - size.height) <= 1,
    {
      height,
      width,
    },
  );
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.waitForTimeout(100);
}

async function assertDocumentOverflowWithinViewport(page: Page): Promise<void> {
  const overflow = await readDocumentOverflow(page);
  expect(overflow.documentOverflowX).toBeLessThanOrEqual(1);
  expect(overflow.documentOverflowY).toBeLessThanOrEqual(1);
}

async function readDocumentOverflow(page: Page): Promise<{
  readonly documentOverflowX: number;
  readonly documentOverflowY: number;
}> {
  return page.evaluate(() => ({
    documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    documentOverflowY:
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
}

async function assertTestIdWithinViewport(
  page: Page,
  testId: string,
  width: number,
  height: number,
): Promise<void> {
  await page.locator(`[data-testid='${testId}']`).evaluate((element: HTMLElement) => {
    element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  });
  await page.waitForTimeout(50);
  const metrics = await readElementViewportMetrics(page, `[data-testid='${testId}']`);
  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(width + 1);
  expect(metrics.bottom).toBeLessThanOrEqual(height + 1);
  expect(metrics.overflowX).toBeLessThanOrEqual(1);
}

async function assertTestIdReachableWithoutCover(
  page: Page,
  testId: string,
  width: number,
  height: number,
): Promise<void> {
  await assertSelectorReachableWithoutCover(page, `[data-testid='${testId}']`, width, height);
}

async function assertSelectorReachableWithoutCover(
  page: Page,
  selector: string,
  width: number,
  height: number,
): Promise<void> {
  await page.locator(selector).evaluate((element: HTMLElement) => {
    element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  });
  await page.waitForTimeout(80);

  const metrics = await readElementViewportMetrics(page, selector);
  expect(metrics.top, `${selector} top`).toBeGreaterThanOrEqual(0);
  expect(metrics.left, `${selector} left`).toBeGreaterThanOrEqual(0);
  expect(metrics.right, `${selector} right`).toBeLessThanOrEqual(width + 1);
  expect(metrics.bottom, `${selector} bottom`).toBeLessThanOrEqual(height + 1);

  const isUncovered = await page.locator(selector).evaluate((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(centerX, centerY);
    return hit instanceof HTMLElement && (hit === element || element.contains(hit));
  });
  expect(isUncovered, `${selector} uncovered`).toBe(true);
}

async function assertTallSelectorReachableWithoutCover(
  page: Page,
  selector: string,
  width: number,
  height: number,
): Promise<void> {
  await page.locator(selector).evaluate((element: HTMLElement) => {
    element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  });
  await page.waitForTimeout(80);

  const metrics = await readElementViewportMetrics(page, selector);
  expect(metrics.left, `${selector} left`).toBeGreaterThanOrEqual(0);
  expect(metrics.right, `${selector} right`).toBeLessThanOrEqual(width + 1);
  expect(metrics.bottom, `${selector} bottom`).toBeGreaterThan(0);
  expect(metrics.top, `${selector} top`).toBeLessThan(height);

  const isUncovered = await page
    .locator(selector)
    .evaluate((element: HTMLElement, viewportHeight: number) => {
      const rect = element.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, 1);
      const visibleBottom = Math.min(rect.bottom, viewportHeight - 1);
      const centerX = rect.left + rect.width / 2;
      const sampleY = visibleTop + Math.max((visibleBottom - visibleTop) / 2, 1);
      const hit = document.elementFromPoint(centerX, sampleY);
      return hit instanceof HTMLElement && (hit === element || element.contains(hit));
    }, height);
  expect(isUncovered, `${selector} uncovered`).toBe(true);
}

async function readElementViewportMetrics(
  page: Page,
  selector: string,
): Promise<ResponsiveSelectorMetric> {
  const metrics = await page.locator(selector).evaluate((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      height: rect.height,
      left: rect.left,
      overflowX: element.scrollWidth - element.clientWidth,
      overflowY: element.scrollHeight - element.clientHeight,
      right: rect.right,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      top: rect.top,
      width: rect.width,
    };
  });

  return metrics;
}

function toRelativeArtifactPath(targetPath: string): string {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
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

async function readContrastRatio(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((element: HTMLElement) => {
    const foreground = parseColor(window.getComputedStyle(element).color);
    const background = readNearestOpaqueBackground(element);
    return calculateContrastRatio(foreground, background);

    function readNearestOpaqueBackground(target: HTMLElement): Color {
      let current: HTMLElement | null = target;
      while (current !== null) {
        const candidate = parseColor(window.getComputedStyle(current).backgroundColor);
        if (candidate.alpha >= 0.85) {
          return candidate;
        }
        current = current.parentElement;
      }

      return {
        alpha: 1,
        blue: 255,
        green: 255,
        red: 255,
      };
    }

    function calculateContrastRatio(foregroundColor: Color, backgroundColor: Color): number {
      const foregroundLuminance = relativeLuminance(foregroundColor);
      const backgroundLuminance = relativeLuminance(backgroundColor);
      const lighter = Math.max(foregroundLuminance, backgroundLuminance);
      const darker = Math.min(foregroundLuminance, backgroundLuminance);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function relativeLuminance(color: Color): number {
      const red = linearize(color.red / 255);
      const green = linearize(color.green / 255);
      const blue = linearize(color.blue / 255);
      return red * 0.2126 + green * 0.7152 + blue * 0.0722;
    }

    function linearize(channel: number): number {
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }

    function parseColor(value: string): Color {
      const colorPattern =
        /rgba?\((?<red>\d+),\s*(?<green>\d+),\s*(?<blue>\d+)(?:,\s*(?<alpha>[\d.]+))?\)/u;
      const match = colorPattern.exec(value);
      if (match?.groups === undefined) {
        throw new Error(`Unsupported CSS color: ${value}`);
      }

      return {
        alpha: match.groups["alpha"] === undefined ? 1 : Number(match.groups["alpha"]),
        blue: Number(match.groups["blue"]),
        green: Number(match.groups["green"]),
        red: Number(match.groups["red"]),
      };
    }
  });
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

async function waitForUiScale(
  page: Page,
  expectedScale: "standard" | "large" | "extra-large",
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const scale = await page.locator("[data-shell-ready='true']").getAttribute("data-ui-scale");
    if (scale === expectedScale) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for ui scale ${expectedScale}.`);
}

async function assertContrastBaseline(page: Page): Promise<void> {
  for (const check of [
    { selector: "[data-testid='player-next-goal']", minimumRatio: 7 },
    { selector: "[data-testid='player-event-list']", minimumRatio: 7 },
    { selector: "[data-testid='locale-current']", minimumRatio: 4.5 },
    { selector: "[data-testid='ui-scale-current']", minimumRatio: 4.5 },
    { selector: "[data-testid='main-menu-panel'] h1", minimumRatio: 7 },
  ]) {
    if ((await page.locator(check.selector).count()) === 0) {
      continue;
    }
    const ratio = await readContrastRatio(page, check.selector);
    expect(ratio, `${check.selector} contrast`).toBeGreaterThanOrEqual(check.minimumRatio);
  }
}

interface Color {
  readonly alpha: number;
  readonly blue: number;
  readonly green: number;
  readonly red: number;
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
