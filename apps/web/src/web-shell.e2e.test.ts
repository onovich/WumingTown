/// <reference lib="dom" />

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

interface WebShellDebugPayload {
  readonly browserTargets: readonly string[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly centerWorldX: number;
  readonly centerWorldY: number;
  readonly diagnostics: WebDiagnosticDebugState;
  readonly fixtureId: string;
  readonly locale?: {
    readonly diagnosticsVisible: boolean;
    readonly manualLocale: string | null;
    readonly persistenceDiagnosticCode: string;
    readonly persistenceMode: string;
    readonly resolvedLocale: string;
    readonly source: string;
    readonly systemLocale: string;
  };
  readonly zoom: number;
  readonly runtimeBrowser: string;
  readonly runtimeCrossOriginIsolated: boolean;
  readonly selectedEntityId: string | undefined;
  readonly storageGate: {
    readonly diagnosticCode: string | undefined;
    readonly interoperabilityVerdict: "blocked" | "pending" | "proven";
    readonly lastActionLabel: string;
    readonly quotaAvailableBytes: number | null;
    readonly quotaBytes: number | null;
    readonly saveSlotCount: number;
    readonly statusTone: "danger" | "stable" | "warning";
    readonly storageKindLabel: string;
    readonly usageBytes: number | null;
  };
  readonly entityScreenPositions: readonly {
    readonly entityId: string;
    readonly x: number;
    readonly y: number;
  }[];
}

interface WebDiagnosticDebugState {
  readonly blockerCodes: readonly string[];
  readonly lastActionLabel: string;
  readonly lastPackageStatus: "blocked" | "error" | "exported" | "idle";
  readonly networkUploadEnabled: false;
  readonly packageKind: "m6-local-diagnostic-package";
  readonly recentErrorCount: number;
  readonly safeLogCount: number;
  readonly suggestedFileName: string;
  readonly telemetryEnabled: false;
  readonly webDownloadStatus: "available" | "blocked";
  readonly windowsHostPackageStatus: "available" | "blocked";
}

interface ResponsiveViewport {
  readonly width: number;
  readonly height: number;
}

type ResponsiveHudLayoutMode = "compact" | "desktop" | "medium";

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
  readonly layoutMode?: ResponsiveHudLayoutMode;
  readonly locale: "en" | "zh-CN";
  readonly metrics: Record<string, ResponsiveSelectorMetric>;
  readonly screenshotPath?: string;
  readonly shell: "web";
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

const WM0118_WEB_ARTIFACT_ROOT = path.join(process.cwd(), "coordination", "artifacts", "WM-0118");
const WM0118_WEB_SCREENSHOT_ROOT = path.join(WM0118_WEB_ARTIFACT_ROOT, "web");
const WM0135_WEB_LAYOUT_REPORT_PATH = path.join(
  process.cwd(),
  "coordination",
  "reports",
  "WM-0135-responsive-layout.md",
);

const SCREENSHOT_PATH = readScreenshotPath();
const EXPORTED_SAVE_PATH = path.join(path.dirname(SCREENSHOT_PATH), "m6-gate-slot.wtsave");
const DIAGNOSTIC_PACKAGE_PATH = path.join(
  path.dirname(SCREENSHOT_PATH),
  "wuming-town-m6-diagnostics.json",
);

describe("web shell smoke", () => {
  it("round-trips the Web gate save through OPFS export and import", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        deviceScaleFactor: 1,
        viewport: {
          width: 1280,
          height: 800,
        },
      });
      const page = await context.newPage();

      await page.goto(withQuery(serverUrl, "wmDiagnostics=1"), {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await assertDebugOverlayBaseline(page);

      await page.setViewportSize({
        width: 1180,
        height: 760,
      });
      await waitForHudText(page, "Canvas 1180 x 760");
      await waitForHudText(page, "Map 192 x 192");
      await waitForHudText(page, "Chrome Stable, Edge Stable");
      await waitForStorageStatus(page, "Web storage evidence is current.");

      const debugPayload = await readDebugPayload(page);
      expect(debugPayload.fixtureId).toBe("wm-0086-web-product-gate");
      expect(debugPayload.browserTargets).toContain("Chrome Stable");
      expect(debugPayload.browserTargets).toContain("Edge Stable");
      expect(debugPayload.storageGate.storageKindLabel).toBe("OPFS ready");
      expect(debugPayload.storageGate.interoperabilityVerdict).toBe("blocked");
      const targetEntity = debugPayload.entityScreenPositions.find(
        (entity) => entity.entityId === "lantern-keeper-shen",
      );
      expect(targetEntity).toBeDefined();
      await page.locator("[data-testid='world-canvas']").evaluate(
        (canvas: HTMLCanvasElement, point: { readonly x: number; readonly y: number }) => {
          const rect = canvas.getBoundingClientRect();
          canvas.dispatchEvent(
            new PointerEvent("pointerdown", {
              bubbles: true,
              clientX: rect.left + point.x,
              clientY: rect.top + point.y,
              pointerId: 1,
              pointerType: "mouse",
            }),
          );
          canvas.dispatchEvent(
            new PointerEvent("pointerup", {
              bubbles: true,
              clientX: rect.left + point.x,
              clientY: rect.top + point.y,
              pointerId: 1,
              pointerType: "mouse",
            }),
          );
        },
        {
          x: targetEntity?.x ?? 0,
          y: targetEntity?.y ?? 0,
        },
      );
      await waitForSelectedEntity(page, "lantern-keeper-shen");

      await page.keyboard.press("KeyD");
      await waitForHudText(page, "Keyboard KeyD");
      await page.getByTestId("storage-save-button").click();
      await waitForStorageStatus(page, "Saved the current shell evidence envelope into OPFS.");

      const afterSavePayload = await readDebugPayload(page);
      expect(afterSavePayload.storageGate.saveSlotCount).toBe(1);

      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("storage-export-button").click();
      const download = await downloadPromise;
      await mkdir(path.dirname(EXPORTED_SAVE_PATH), { recursive: true });
      await download.saveAs(EXPORTED_SAVE_PATH);
      const exportStat = await stat(EXPORTED_SAVE_PATH);
      expect(exportStat.size).toBeGreaterThan(0);
      await waitForStorageStatus(page, "Exported the gate save as a browser download.");

      await page.getByTestId("storage-delete-button").click();
      await waitForStorageStatus(page, "Deleted the local gate save.");

      const afterDeletePayload = await readDebugPayload(page);
      expect(afterDeletePayload.storageGate.saveSlotCount).toBe(0);

      await page.getByTestId("storage-import-input").setInputFiles(EXPORTED_SAVE_PATH);
      await waitForStorageStatus(
        page,
        "Imported the gate save into OPFS. Load it to restore the shell state.",
      );

      await page.getByTestId("storage-load-button").click();
      await waitForStorageStatus(page, "Loaded the gate save and restored the shell selection.");
      await waitForSelectedEntity(page, "lantern-keeper-shen");

      await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
      await page.screenshot({
        animations: "disabled",
        path: SCREENSHOT_PATH,
      });

      const screenshotStat = await stat(SCREENSHOT_PATH);
      expect(screenshotStat.size).toBeGreaterThan(0);

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("surfaces quota failure with structured diagnostics and preserves the previous save", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        deviceScaleFactor: 1,
        viewport: {
          width: 1280,
          height: 800,
        },
      });
      const page = await context.newPage();

      await page.goto(withQuery(serverUrl, "wmDiagnostics=1"), {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await assertDebugOverlayBaseline(page);
      await waitForStorageStatus(page, "Web storage evidence is current.");

      await page.getByTestId("storage-save-button").click();
      await waitForStorageStatus(page, "Saved the current shell evidence envelope into OPFS.");

      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("storage-export-button").click();
      const download = await downloadPromise;
      await mkdir(path.dirname(EXPORTED_SAVE_PATH), { recursive: true });
      await download.saveAs(EXPORTED_SAVE_PATH);
      await waitForStorageStatus(page, "Exported the gate save as a browser download.");

      await page.evaluate(() => {
        const originalStorage = navigator.storage;
        const getDirectory = originalStorage.getDirectory.bind(originalStorage);
        Object.defineProperty(navigator, "storage", {
          configurable: true,
          value: {
            estimate: (): Promise<{ quota: number; usage: number }> =>
              Promise.resolve({
                quota: 1024,
                usage: 992,
              }),
            getDirectory,
          },
        });
      });

      await page.getByTestId("storage-import-input").setInputFiles(EXPORTED_SAVE_PATH);
      await waitForStorageStatus(
        page,
        "Not enough browser storage is available for this save. Export or delete a save, then retry.",
      );

      const quotaPayload = await readDebugPayload(page);
      expect(quotaPayload.storageGate.diagnosticCode).toBe("quota_exceeded");
      expect(quotaPayload.storageGate.saveSlotCount).toBe(1);
      const diagnosticText = await page.getByTestId("storage-diagnostic").textContent();
      expect(diagnosticText).toContain("quota_exceeded");

      await page.getByTestId("storage-load-button").click();
      await waitForStorageStatus(page, "Loaded the gate save and restored the shell selection.");

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("validates M6 input and accessibility baseline cues", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        deviceScaleFactor: 1,
        locale: "en-US",
        viewport: {
          width: 1440,
          height: 900,
        },
      });
      const page = await context.newPage();

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(page, "en", "system");
      await assertAccessibilityBaseline(page);

      const debugPayload = await readDebugPayload(page);
      const targetEntity = findRequiredEntity(debugPayload, "lantern-keeper-shen");
      await clickCanvasPoint(page, targetEntity);
      await waitForSelectedEntity(page, "lantern-keeper-shen");

      await page.keyboard.press("Equal");
      await waitForHudText(page, "Keyboard Equal");
      await page.keyboard.press("ArrowLeft");
      await waitForHudText(page, "Keyboard ArrowLeft");

      await page.setViewportSize({
        width: 390,
        height: 720,
      });
      await page.waitForTimeout(150);
      await assertAccessibilityBaseline(page);

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("selects residents, structures, and empty tiles through the live viewport in windowed and fullscreen-equivalent sizes", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        locale: "en-US",
        viewport: {
          width: 1424,
          height: 861,
        },
      });
      const page = await context.newPage();

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(page, "en", "system");
      await page.getByTestId("main-menu-new-game").click();
      await waitForStartSurfaceClosed(page);

      let debugPayload = await readDebugPayload(page);
      await clickCanvasPoint(page, findRequiredEntity(debugPayload, "lantern-keeper-shen"));
      await waitForSelectedEntity(page, "lantern-keeper-shen");
      expect(await page.getByTestId("player-selected-detail").textContent()).toContain(
        "Lantern Keeper Shen",
      );

      const emptyPoint = await findInspectableCanvasPoint(page, debugPayload);
      await clickCanvasPoint(page, emptyPoint);
      await waitForInspectedTile(page);
      expect(await page.getByTestId("player-selected-detail").textContent()).toContain(
        "Tile inspection",
      );
      expect(await page.getByTestId("player-selected-detail").textContent()).toContain("Terrain");

      await page.setViewportSize({
        width: 2560,
        height: 1369,
      });
      await waitForTimeout(page, 150);
      await assertTownHudViewportLayout(page, 2560, 1369);

      debugPayload = await readDebugPayload(page);
      await clickCanvasPoint(page, findRequiredEntity(debugPayload, "bridge-ledger-kiosk-04"));
      await waitForSelectedEntity(page, "bridge-ledger-kiosk-04");
      expect(await page.getByTestId("player-selected-detail").textContent()).toContain(
        "Bridge Ledger Kiosk 4",
      );

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("supports camera drag, wheel zoom, keyboard movement, reset, and click selection", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        locale: "en-US",
        viewport: {
          width: 1424,
          height: 861,
        },
      });
      const page = await context.newPage();

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(page, "en", "system");
      await page.getByTestId("main-menu-new-game").click();
      await waitForStartSurfaceClosed(page);
      await assertTownHudViewportLayout(page, 1424, 861);

      const baseline = await readDebugPayload(page);
      const dragStart = await readMapFocusViewportPoint(page, 0.48, 0.48);
      await assertViewportPointHitsCanvas(page, dragStart);
      await dragCanvasViewportPoint(page, dragStart, {
        x: dragStart.x + 180,
        y: dragStart.y + 72,
      });
      await waitForHudText(page, "Drag pan");
      const dragged = await readDebugPayload(page);
      expect(Math.abs(dragged.centerWorldX - baseline.centerWorldX)).toBeGreaterThan(20);
      expect(Math.abs(dragged.centerWorldY - baseline.centerWorldY)).toBeGreaterThan(8);

      const wheelPoint = await readMapFocusViewportPoint(page, 0.55, 0.46);
      await page.mouse.move(wheelPoint.x, wheelPoint.y);
      await page.mouse.wheel(0, -360);
      await waitForHudText(page, "Zoom");
      const zoomed = await readDebugPayload(page);
      expect(zoomed.zoom).toBeGreaterThan(dragged.zoom);

      await page.keyboard.press("ArrowRight");
      await waitForHudText(page, "Keyboard ArrowRight");
      const keyboardMoved = await readDebugPayload(page);
      expect(keyboardMoved.centerWorldX).toBeGreaterThan(zoomed.centerWorldX);

      await page.keyboard.press("Home");
      await waitForHudText(page, "Camera reset");
      const reset = await readDebugPayload(page);
      expect(reset.zoom).toBeCloseTo(baseline.zoom, 5);
      expect(reset.centerWorldX).toBeCloseTo(baseline.centerWorldX, 5);
      expect(reset.centerWorldY).toBeCloseTo(baseline.centerWorldY, 5);

      const clickableEntity = await findReachableEntityPoint(page, reset);
      await clickCanvasViewportPoint(page, clickableEntity);
      await waitForSelectedEntity(page, clickableEntity.entityId);

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("downloads a redacted local M6 diagnostic package", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        deviceScaleFactor: 1,
        viewport: {
          width: 1280,
          height: 800,
        },
      });
      const page = await context.newPage();

      await page.goto(withQuery(serverUrl, "wmDiagnostics=1"), {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await assertDebugOverlayBaseline(page);
      await page.evaluate(() => {
        window.dispatchEvent(
          new ErrorEvent("error", {
            message:
              "Synthetic diagnostic failure at C:\\Users\\Beacon\\save.wtsave with token=abc123.",
          }),
        );
      });

      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("diagnostic-export-button").click();
      const download = await downloadPromise;
      await mkdir(path.dirname(DIAGNOSTIC_PACKAGE_PATH), {
        recursive: true,
      });
      await download.saveAs(DIAGNOSTIC_PACKAGE_PATH);

      const packageText = await readFile(DIAGNOSTIC_PACKAGE_PATH, "utf8");
      const diagnosticPackage = expectRecord(JSON.parse(packageText), "diagnostic package");
      expect(diagnosticPackage["packageKind"]).toBe("m6-local-diagnostic-package");
      expect(diagnosticPackage["schemaVersion"]).toBe(1);

      const privacy = expectRecord(diagnosticPackage["privacy"], "diagnostic privacy");
      expect(privacy["telemetry"]).toBe(false);
      expect(privacy["networkUpload"]).toBe(false);
      expect(privacy["includesPrivatePaths"]).toBe(false);
      expect(privacy["includesFullSaveContents"]).toBe(false);

      const hashes = expectRecord(diagnosticPackage["hashes"], "diagnostic hashes");
      expect(hashes["commandStreamHash"]).toBe("0x81d37435");
      expect(hashes["contentManifestHash"]).toBe("0xe55d3015");
      expect(hashes["finalReadModelHash"]).toBe("0x9ba83cb7");
      expect(hashes["m4RegressionReadModelHash"]).toBe("0xce261d9d");

      const packagePath = expectRecord(diagnosticPackage["packagePath"], "diagnostic path");
      expect(expectRecord(packagePath["webDownload"], "web diagnostic path")["status"]).toBe(
        "available",
      );
      expect(
        expectRecord(packagePath["windowsHostFilePackage"], "windows diagnostic path")["status"],
      ).toBe("blocked");

      const rawPackage = JSON.stringify(diagnosticPackage);
      expect(rawPackage).not.toContain("C:\\Users");
      expect(rawPackage).not.toContain("Beacon");
      expect(rawPackage).not.toContain("abc123");
      expect(rawPackage).toContain("[redacted-path]");
      expect(rawPackage).toContain("[redacted-secret]");

      const debugPayload = await readDebugPayload(page);
      expect(debugPayload.diagnostics).toMatchObject({
        lastPackageStatus: "exported",
        networkUploadEnabled: false,
        packageKind: "m6-local-diagnostic-package",
        recentErrorCount: 1,
        safeLogCount: 2,
        telemetryEnabled: false,
        webDownloadStatus: "available",
        windowsHostPackageStatus: "blocked",
      });
      expect(debugPayload.diagnostics.suggestedFileName).toBe("wuming-town-m6-diagnostics.json");

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("keeps the main menu viewport-bounded and scroll-reachable at compact viewports", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        locale: "en-US",
        viewport: {
          width: 390,
          height: 720,
        },
      });
      const page = await context.newPage();

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(page, "en", "system");
      await assertCompactStartSurfaceLayout(page, 390, 720);
      await assertCompactStartSurfaceLayout(page, 800, 720);

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("keeps the default player HUD viewport-bounded and panels reachable at 1424x861 and 390x720", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        locale: "en-US",
        viewport: {
          width: 1424,
          height: 861,
        },
      });
      const page = await context.newPage();

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(page, "en", "system");
      await page.getByTestId("main-menu-new-game").click();
      await waitForStartSurfaceClosed(page);

      await assertTownHudViewportLayout(page, 1424, 861);
      await assertTownHudViewportLayout(page, 390, 720);

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("validates the M8 responsive viewport matrix and records reviewer artifacts", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();
    const artifacts: ResponsiveLayoutArtifact[] = [];

    try {
      await collectResponsiveLocaleArtifacts(
        browser,
        serverUrl,
        {
          expectedLocale: "en",
          playwrightLocale: "en-US",
        },
        artifacts,
      );
      await collectResponsiveLocaleArtifacts(
        browser,
        serverUrl,
        {
          expectedLocale: "zh-CN",
          playwrightLocale: "zh-TW",
        },
        artifacts,
      );
      await collectResponsiveDebugArtifacts(browser, serverUrl, artifacts);
      await mkdir(path.dirname(WM0135_WEB_LAYOUT_REPORT_PATH), {
        recursive: true,
      });
      await writeFile(
        WM0135_WEB_LAYOUT_REPORT_PATH,
        formatResponsiveLayoutArtifactMarkdown(artifacts),
        "utf8",
      );
    } finally {
      await browser.close();
      await server.close();
    }
  }, 420000);

  it("defaults locale by browser language and persists manual display overrides across reload", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const englishContext = await browser.newContext({
        locale: "en-US",
        viewport: {
          width: 1280,
          height: 800,
        },
      });
      const englishPage = await englishContext.newPage();
      await englishPage.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await englishPage.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(englishPage, "en", "system");
      await waitForUiScale(englishPage, "standard");
      await assertStartSurfaceBaseline(englishPage, "en");
      await englishContext.close();

      const chineseContext = await browser.newContext({
        locale: "zh-TW",
        viewport: {
          width: 1280,
          height: 800,
        },
      });
      const chinesePage = await chineseContext.newPage();
      await chinesePage.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await chinesePage.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(chinesePage, "zh-CN", "system");
      await waitForUiScale(chinesePage, "standard");
      await assertStartSurfaceBaseline(chinesePage, "zh-CN");
      await chinesePage.getByTestId("main-menu-locale-en").click();
      await waitForLocale(chinesePage, "en", "manual");
      await waitForHudText(chinesePage, "New Game");
      await chinesePage.getByTestId("main-menu-settings").click();
      await chinesePage.getByTestId("ui-scale-select").selectOption("large");
      await waitForUiScale(chinesePage, "large");
      await chinesePage.getByTestId("main-menu-back").click();
      await chinesePage.getByTestId("main-menu-settings").waitFor();
      await chinesePage.reload({
        waitUntil: "networkidle",
      });
      await chinesePage.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(chinesePage, "en", "manual");
      await waitForUiScale(chinesePage, "large");
      await waitForHudText(chinesePage, "New Game");

      await chineseContext.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

  it("keeps the shell readable when large UI scale is selected at compact viewports", async () => {
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

    const serverUrl = readServerUrl(server);
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        locale: "zh-TW",
        viewport: {
          width: 390,
          height: 720,
        },
      });
      const page = await context.newPage();

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
      await waitForLocale(page, "zh-CN", "system");
      await page.getByTestId("main-menu-settings").click();
      await page.getByTestId("ui-scale-select").selectOption("large");
      await waitForUiScale(page, "large");
      await page.getByTestId("main-menu-back").click();
      await page.getByTestId("main-menu-settings").waitFor();

      await assertCompactStartSurfaceLayout(page, 390, 720);
      await page.getByTestId("main-menu-new-game").click();
      await waitForStartSurfaceClosed(page);
      await assertTownHudViewportLayout(page, 390, 720, "zh-CN");

      await context.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);
});

async function assertAccessibilityBaseline(page: import("playwright").Page): Promise<void> {
  const shellText = await page.locator("[data-shell-ready='true']").textContent();
  expect(shellText ?? "").toContain("Wuming Town");
  expect(shellText ?? "").not.toContain("Web Product Gate");
  await waitForUiScale(page, "standard");
  if ((await page.getByTestId("main-menu-surface").count()) > 0) {
    expect(shellText ?? "").toContain("Main menu");
    await assertStartSurfaceBaseline(page, "en");
    await page.getByTestId("main-menu-new-game").click();
    await waitForStartSurfaceClosed(page);
  }
  await assertPlayerHudBaseline(page);
  await waitForHudText(page, "Display settings");
  await assertContrastBaseline(page);

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

  expect(await page.getByTestId("storage-panel").count()).toBe(0);
  expect(await page.locator("[data-release-gate-fixture='wm-0086-web-product-gate']").count()).toBe(
    0,
  );
  const mediaCueCount = await page.locator("audio, video").count();
  expect(mediaCueCount).toBe(0);

  const activeAnimationCount = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState !== "finished").length,
  );
  expect(activeAnimationCount).toBe(0);

  const overflow = await page.evaluate(() => {
    const selectors = [
      "button",
      "[aria-label='Main menu']",
      "[aria-label='Town status']",
      "[aria-label='Town alerts']",
      "[aria-label='Display settings']",
      "[aria-label='Selected entity inspector']",
    ];
    const offenders: string[] = [];
    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (rect.width <= 0 || rect.height <= 0 || style.visibility === "hidden") {
          continue;
        }

        if (element.scrollWidth - element.clientWidth > 8) {
          offenders.push(selector);
        }
      }
    }

    return {
      documentOverflowX:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders,
    };
  });
  expect(overflow.documentOverflowX).toBeLessThanOrEqual(1);
  expect(overflow.offenders).toStrictEqual([]);
}

async function assertPlayerHudBaseline(page: import("playwright").Page): Promise<void> {
  await assertPlayerHudStructure(page);
  expect(await page.getByTestId("debug-overlay").count()).toBe(0);
  await assertCommandPlaceholderAccessibility(page);

  const hudText = await page.getByTestId("player-hud").textContent();
  const goalText = await page.getByTestId("player-next-goal").textContent();
  expect(hudText ?? "").not.toContain("Web Product Gate");
  expect(hudText ?? "").not.toContain("read-model fixture");
  expect(hudText ?? "").not.toContain("wm-0086-web-product-gate");
  expect(goalText ?? "").toContain("Lantern corridor gap");
  const nightRiskTier = await page
    .getByTestId("player-night-risk")
    .getAttribute("data-night-risk-tier");
  expect(nightRiskTier).toBe("strained");
}

async function assertPlayerHudStructure(page: import("playwright").Page): Promise<void> {
  expect(await page.getByTestId("player-hud").count()).toBe(1);
  expect(await page.getByTestId("player-alert-strip").count()).toBe(1);
  expect(await page.getByTestId("player-command-bar").count()).toBe(1);
  expect(await page.getByTestId("player-top-bar").count()).toBe(1);
  expect(await page.getByTestId("player-next-goal").count()).toBe(1);
  expect(await page.getByTestId("player-night-risk").count()).toBe(1);
  expect(await page.getByTestId("player-task-list").count()).toBe(1);
  expect(await page.getByTestId("player-event-list").count()).toBe(1);
  expect(await page.getByTestId("player-resident-watch").count()).toBe(1);
  expect(await page.locator("[data-testid='world-canvas']").count()).toBe(1);
}

async function assertPlayerHudLocaleState(
  page: import("playwright").Page,
  locale: "en" | "zh-CN",
): Promise<void> {
  await assertPlayerHudStructure(page);
  expect(await page.getByTestId("debug-overlay").count()).toBe(0);
  const activeLocale = await page.locator("[data-shell-ready='true']").getAttribute("data-locale");
  expect(activeLocale).toBe(locale);
  const nightRiskTier = await page
    .getByTestId("player-night-risk")
    .getAttribute("data-night-risk-tier");
  expect(nightRiskTier).toBe("strained");
  if (locale === "en") {
    const goalText = await page.getByTestId("player-next-goal").textContent();
    const hudText = await page.getByTestId("player-hud").textContent();
    expect(hudText ?? "").not.toContain("Web Product Gate");
    expect(hudText ?? "").not.toContain("read-model fixture");
    expect(hudText ?? "").not.toContain("wm-0086-web-product-gate");
    expect(goalText ?? "").toContain("Lantern corridor gap");
    return;
  }

  const hudText = await page.getByTestId("player-hud").textContent();
  expect(hudText ?? "").toContain("灯廊缺口");
  expect(hudText ?? "").toContain("桥路包裹已备妥");
  expect(hudText ?? "").toContain("编志所");
  expect(hudText ?? "").toContain("命令带");
  expect(hudText ?? "").toContain("灯路槽位");
  expect(hudText ?? "").toContain("米粮");
  expect(hudText ?? "").toContain("稳定");
  expect(hudText ?? "").toContain("无伤");
  expect(hudText ?? "").not.toContain("Command bar");
  expect(hudText ?? "").not.toContain("Lamp routes");
  expect(hudText ?? "").not.toContain("Lantern corridor gap");
  expect(hudText ?? "").not.toContain("Bridge parcels staged");
  expect(hudText ?? "").not.toContain("Chronicle office");
  expect(hudText ?? "").not.toContain("Rice");
  expect(hudText ?? "").not.toContain("Stable");
  expect(hudText ?? "").not.toContain("Unhurt");
}

async function assertCommandPlaceholderAccessibility(
  page: import("playwright").Page,
): Promise<void> {
  const commandBarSlot = await page.getByTestId("player-command-bar").getAttribute("data-ui-slot");
  expect(commandBarSlot).toBe("panel.wood.toolbar");

  for (const testId of [
    "player-command-lamp",
    "player-command-chronicle",
    "player-command-inspect",
  ] as const) {
    const button = page.getByTestId(testId);
    expect(await button.getAttribute("aria-disabled")).toBe("true");
    const describedBy = await button.getAttribute("aria-describedby");
    expect(describedBy).toMatch(/-detail$/u);
    const slot = await button.getAttribute("data-ui-slot");
    expect(slot === "button.primary.disabled" || slot === "button.secondary.disabled").toBe(true);
    const detailId = describedBy ?? "";
    const detailText = await page.locator(`#${detailId}`).textContent();
    expect((detailText ?? "").length).toBeGreaterThan(10);
  }
}

async function assertTownHudViewportLayout(
  page: import("playwright").Page,
  width: number,
  height: number,
  locale: "en" | "zh-CN" = "en",
): Promise<void> {
  await page.setViewportSize({
    width,
    height,
  });
  await waitForViewportSize(page, width, height);
  await assertPlayerHudLocaleState(page, locale);
  await assertDocumentOverflowWithinViewport(page);

  const expectedLayoutMode = readExpectedHudLayoutMode(width, height);
  await assertPlayerHudLayoutMode(page, expectedLayoutMode);
  await assertSelectorReachableWithoutCover(page, "[data-testid='player-top-bar']", width, height);
  await assertMapFocusArea(page, width, height, expectedLayoutMode);

  for (const testId of [
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

async function assertDebugOverlayBaseline(page: import("playwright").Page): Promise<void> {
  await waitForHudText(page, "Developer diagnostics");
  expect(await page.getByTestId("player-hud").count()).toBe(1);
  expect(await page.getByTestId("debug-overlay").count()).toBe(1);
  expect(await page.getByTestId("storage-panel").count()).toBe(1);
  expect(await page.locator("[data-release-gate-fixture='wm-0086-web-product-gate']").count()).toBe(
    1,
  );

  const overlayText = await page.getByTestId("debug-overlay").textContent();
  expect(overlayText ?? "").toContain("Debug-only overlay");
  expect(overlayText ?? "").toContain("wmDiagnostics=1");
  expect(overlayText ?? "").toContain("Web Product Gate");
  expect(overlayText ?? "").toContain("M5 first-season Web product-gate fixture");
}

async function assertOnboardingBaseline(
  page: import("playwright").Page,
  locale: "en" | "zh-CN",
): Promise<void> {
  const surface = page.getByTestId("main-menu-surface");
  expect(await surface.count()).toBe(1);
  const surfaceText = await surface.textContent();
  if (locale === "en") {
    expect(surfaceText ?? "").toContain("Wuming Town");
    expect(surfaceText ?? "").not.toContain("无明镇");
  } else {
    expect(surfaceText ?? "").toContain("无明镇");
    expect(surfaceText ?? "").not.toContain("Wuming Town");
  }
  expect(await page.getByTestId("main-menu-new-game").count()).toBe(1);
  expect(await page.getByTestId("main-menu-continue").count()).toBe(1);
  expect(await page.getByTestId("main-menu-settings").count()).toBe(1);
  expect(await page.getByTestId("main-menu-first-play-guidance").count()).toBe(1);
  expect(await page.getByTestId("main-menu-next-goal").count()).toBe(1);
  expect(await page.getByTestId("main-menu-available-actions").count()).toBe(1);
  expect(await page.getByTestId("main-menu-guidance-boundary").count()).toBe(1);
  expect(await page.getByTestId("main-menu-language").count()).toBe(1);
}

async function assertStartSurfaceBaseline(
  page: import("playwright").Page,
  locale: "en" | "zh-CN",
): Promise<void> {
  await assertOnboardingBaseline(page, locale);
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
  expect(surfaceText ?? "").not.toContain("read-model fixture");
  expect(surfaceText ?? "").not.toContain("wm-0086-web-product-gate");

  await page.getByTestId("main-menu-settings").click();
  await page.getByTestId("locale-select").waitFor();
  expect(await page.getByTestId("main-menu-back").count()).toBe(1);
  expect(await page.getByTestId("ui-scale-select").count()).toBe(1);
  await page.getByTestId("main-menu-back").click();
  await page.getByTestId("main-menu-settings").waitFor();
}

async function assertCompactStartSurfaceLayout(
  page: import("playwright").Page,
  width: number,
  height: number,
): Promise<void> {
  await page.setViewportSize({
    width,
    height,
  });
  await waitForViewportSize(page, width, height);
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
  ]) {
    await assertTestIdWithinViewport(page, testId, width, height);
  }

  await assertTestIdWithinViewport(page, "main-menu-locale-system", width, height);
  await assertTestIdWithinViewport(page, "main-menu-locale-zh-CN", width, height);
  await assertTestIdWithinViewport(page, "main-menu-locale-en", width, height);

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

async function collectResponsiveLocaleArtifacts(
  browser: import("playwright").Browser,
  serverUrl: string,
  localeCase: {
    readonly expectedLocale: "en" | "zh-CN";
    readonly playwrightLocale: string;
  },
  artifacts: ResponsiveLayoutArtifact[],
): Promise<void> {
  const initialViewport = WM0118_RESPONSIVE_VIEWPORTS[0];
  if (initialViewport === undefined) {
    throw new Error("WM-0118 viewport matrix was empty.");
  }

  const context = await browser.newContext({
    deviceScaleFactor: 1,
    locale: localeCase.playwrightLocale,
    viewport: initialViewport,
  });

  try {
    const page = await context.newPage();
    await page.goto(serverUrl, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("[data-shell-ready='true']");
    await waitForLocale(page, localeCase.expectedLocale, "system");
    await assertStartSurfaceBaseline(page, localeCase.expectedLocale);

    for (const viewport of WM0118_RESPONSIVE_VIEWPORTS) {
      await assertCompactStartSurfaceLayout(page, viewport.width, viewport.height);
      const screenshotPath = await maybeCaptureWebResponsiveScreenshot(
        page,
        "start-surface",
        localeCase.expectedLocale,
        viewport,
      );
      artifacts.push(
        await captureResponsiveLayoutArtifact(page, {
          locale: localeCase.expectedLocale,
          selectors: {
            availableActions: "[data-testid='main-menu-available-actions']",
            firstPlayGuidance: "[data-testid='main-menu-first-play-guidance']",
            guidanceBoundary: "[data-testid='main-menu-guidance-boundary']",
            languageSection: "[data-testid='main-menu-language']",
            nextGoal: "[data-testid='main-menu-next-goal']",
            panel: "[data-testid='main-menu-panel']",
          },
          shell: "web",
          source: "system",
          surface: "start-surface",
          viewport,
          ...(screenshotPath === undefined ? {} : { screenshotPath }),
        }),
      );
    }

    await page.getByTestId("main-menu-new-game").click();
    await waitForStartSurfaceClosed(page);

    for (const viewport of WM0118_RESPONSIVE_VIEWPORTS) {
      await assertTownHudViewportLayout(
        page,
        viewport.width,
        viewport.height,
        localeCase.expectedLocale,
      );
      const screenshotPath = await maybeCaptureWebResponsiveScreenshot(
        page,
        "player-hud",
        localeCase.expectedLocale,
        viewport,
      );
      artifacts.push(
        await captureResponsiveLayoutArtifact(page, {
          locale: localeCase.expectedLocale,
          selectors: {
            bottomDrawer: "[data-testid='player-bottom-drawer']",
            eventList: "[data-testid='player-event-list']",
            localeSettings: "[data-testid='locale-settings']",
            mapFocus: "[data-testid='player-map-focus']",
            nextGoal: "[data-testid='player-next-goal']",
            residentWatch: "[data-testid='player-resident-watch']",
            selectedDetail: "[data-testid='player-selected-detail']",
            taskList: "[data-testid='player-task-list']",
            topBar: "[data-testid='player-top-bar']",
            worldCanvas: "[data-testid='world-canvas']",
          },
          shell: "web",
          source: "system",
          surface: "player-hud",
          viewport,
          ...(screenshotPath === undefined ? {} : { screenshotPath }),
        }),
      );
    }
  } finally {
    await context.close();
  }
}

async function collectResponsiveDebugArtifacts(
  browser: import("playwright").Browser,
  serverUrl: string,
  artifacts: ResponsiveLayoutArtifact[],
): Promise<void> {
  const initialViewport = WM0118_RESPONSIVE_VIEWPORTS[0];
  if (initialViewport === undefined) {
    throw new Error("WM-0118 viewport matrix was empty.");
  }

  const context = await browser.newContext({
    deviceScaleFactor: 1,
    locale: "en-US",
    viewport: initialViewport,
  });

  try {
    const page = await context.newPage();
    await page.goto(withQuery(serverUrl, "wmDiagnostics=1"), {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("[data-shell-ready='true']");
    await waitForLocale(page, "en", "system");

    for (const viewport of WM0118_RESPONSIVE_VIEWPORTS) {
      await assertDebugOverlayViewportLayout(page, viewport.width, viewport.height);
      const screenshotPath = await maybeCaptureWebResponsiveScreenshot(
        page,
        "debug-overlay",
        "en",
        viewport,
      );
      artifacts.push(
        await captureResponsiveLayoutArtifact(page, {
          locale: "en",
          selectors: {
            debugOverlay: "[data-testid='debug-overlay']",
            eventList: "[data-testid='player-event-list']",
            mapFocus: "[data-testid='player-map-focus']",
            nextGoal: "[data-testid='player-next-goal']",
            residentWatch: "[data-testid='player-resident-watch']",
            selectedDetail: "[data-testid='player-selected-detail']",
            storagePanel: "[data-testid='storage-panel']",
            taskList: "[data-testid='player-task-list']",
            topBar: "[data-testid='player-top-bar']",
          },
          shell: "web",
          source: "system",
          surface: "debug-overlay",
          viewport,
          ...(screenshotPath === undefined ? {} : { screenshotPath }),
        }),
      );
    }
  } finally {
    await context.close();
  }
}

async function assertDebugOverlayViewportLayout(
  page: import("playwright").Page,
  width: number,
  height: number,
): Promise<void> {
  await page.setViewportSize({
    width,
    height,
  });
  await waitForViewportSize(page, width, height);
  await assertDebugOverlayBaseline(page);
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
    "[data-testid='player-selected-detail']",
    width,
    height,
  );
  await assertTallSelectorReachableWithoutCover(
    page,
    "[data-testid='storage-panel']",
    width,
    height,
  );
}

async function captureResponsiveLayoutArtifact(
  page: import("playwright").Page,
  options: {
    readonly locale: "en" | "zh-CN";
    readonly screenshotPath?: string;
    readonly selectors: Record<string, string>;
    readonly shell: "web";
    readonly source: "system";
    readonly surface: "debug-overlay" | "player-hud" | "start-surface";
    readonly viewport: ResponsiveViewport;
  },
): Promise<ResponsiveLayoutArtifact> {
  const metrics: Record<string, ResponsiveSelectorMetric> = {};
  for (const [label, selector] of Object.entries(options.selectors)) {
    if ((await page.locator(selector).count()) === 0) {
      continue;
    }
    metrics[label] = await readElementViewportMetrics(page, selector);
  }

  const overflow = await readDocumentOverflow(page);
  const diagnosticsVisible =
    (await page.locator("[data-shell-ready='true']").getAttribute("data-diagnostics-visible")) ===
    "true";
  const layoutMode =
    (await page.getByTestId("player-hud").count()) === 0
      ? undefined
      : readOptionalHudLayoutMode(
          await page.getByTestId("player-hud").getAttribute("data-layout-mode"),
        );

  return {
    diagnosticsVisible,
    documentOverflowX: overflow.documentOverflowX,
    documentOverflowY: overflow.documentOverflowY,
    ...(layoutMode === undefined ? {} : { layoutMode }),
    locale: options.locale,
    metrics,
    shell: options.shell,
    source: options.source,
    surface: options.surface,
    viewport: options.viewport,
    ...(options.screenshotPath === undefined ? {} : { screenshotPath: options.screenshotPath }),
  };
}

async function maybeCaptureWebResponsiveScreenshot(
  page: import("playwright").Page,
  surface: "debug-overlay" | "player-hud" | "start-surface",
  locale: "en" | "zh-CN",
  viewport: ResponsiveViewport,
): Promise<string | undefined> {
  if (!shouldCaptureWebResponsiveScreenshot(surface, locale, viewport)) {
    return undefined;
  }

  const screenshotPath = path.join(
    WM0118_WEB_SCREENSHOT_ROOT,
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

function shouldCaptureWebResponsiveScreenshot(
  surface: "debug-overlay" | "player-hud" | "start-surface",
  locale: "en" | "zh-CN",
  viewport: ResponsiveViewport,
): boolean {
  void surface;
  void locale;
  void viewport;
  return false;
}

function formatResponsiveLayoutArtifactMarkdown(
  artifacts: readonly ResponsiveLayoutArtifact[],
): string {
  const rows = artifacts.map(
    (artifact) =>
      `| ${artifact.surface} | ${artifact.locale} | ${String(artifact.viewport.width)}x${String(artifact.viewport.height)} | ${artifact.layoutMode ?? "n/a"} | ${String(artifact.documentOverflowX)}/${String(artifact.documentOverflowY)} | ${formatMetricSummary(artifact.metrics["topBar"] ?? artifact.metrics["panel"])} | ${formatMetricSummary(artifact.metrics["worldCanvas"])} | ${formatMetricSummary(artifact.metrics["mapFocus"])} | ${formatMetricSummary(artifact.metrics["bottomDrawer"])} |`,
  );

  return [
    "# WM-0135 Responsive Layout DOM Artifact",
    "",
    "Generated by `apps/web/src/web-shell.e2e.test.ts` during WM-0135 responsive matrix validation.",
    "The artifact records DOM metrics for required Web viewports in English, zh-CN, and explicit diagnostics mode.",
    "",
    "| Surface | Locale | Viewport | HUD layout | Doc overflow X/Y | Primary panel/top bar | World canvas | Map focus | Bottom drawer |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function formatMetricSummary(metric: ResponsiveSelectorMetric | undefined): string {
  if (metric === undefined) {
    return "n/a";
  }

  return `${String(Math.round(metric.width))}x${String(Math.round(metric.height))}@${String(
    Math.round(metric.left),
  )},${String(Math.round(metric.top))}`;
}

function readExpectedHudLayoutMode(width: number, height: number): ResponsiveHudLayoutMode {
  if (width < 760 || height < 680) {
    return "compact";
  }

  if (width < 1600 || height < 860) {
    return "medium";
  }

  return "desktop";
}

function readOptionalHudLayoutMode(value: string | null): ResponsiveHudLayoutMode | undefined {
  if (value === "compact" || value === "desktop" || value === "medium") {
    return value;
  }

  return undefined;
}

async function assertPlayerHudLayoutMode(
  page: import("playwright").Page,
  expectedMode: ResponsiveHudLayoutMode,
): Promise<void> {
  const actualMode = await page.getByTestId("player-hud").getAttribute("data-layout-mode");
  expect(actualMode).toBe(expectedMode);
}

async function assertMapFocusArea(
  page: import("playwright").Page,
  width: number,
  height: number,
  layoutMode: ResponsiveHudLayoutMode,
): Promise<void> {
  if (layoutMode === "compact") {
    expect(await page.getByTestId("player-map-focus").count()).toBe(0);
    return;
  }

  const focusMetrics = await readElementViewportMetrics(page, "[data-testid='player-map-focus']");
  expect(focusMetrics.left, "map focus left").toBeGreaterThanOrEqual(0);
  expect(focusMetrics.top, "map focus top").toBeGreaterThanOrEqual(0);
  expect(focusMetrics.right, "map focus right").toBeLessThanOrEqual(width + 1);
  expect(focusMetrics.bottom, "map focus bottom").toBeLessThanOrEqual(height + 1);
  expect(focusMetrics.width, "map focus width").toBeGreaterThanOrEqual(
    layoutMode === "medium" ? Math.min(520, width * 0.38) : Math.min(620, width * 0.34),
  );
  expect(focusMetrics.height, "map focus height").toBeGreaterThanOrEqual(
    layoutMode === "medium" ? Math.min(180, height * 0.24) : Math.min(260, height * 0.3),
  );

  const focusHit = await page
    .locator("[data-testid='player-map-focus']")
    .evaluate((element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(centerX, centerY);
      const hitElement = hit instanceof HTMLElement ? hit : null;
      const canvas = document.querySelector("[data-testid='world-canvas']");
      const canvasRect = canvas instanceof HTMLElement ? canvas.getBoundingClientRect() : null;
      return {
        canvasCoversPoint:
          canvasRect !== null &&
          centerX >= canvasRect.left &&
          centerX <= canvasRect.right &&
          centerY >= canvasRect.top &&
          centerY <= canvasRect.bottom,
        coveredByHud: hitElement?.closest("[data-testid='player-hud']") !== null,
        hitTag: hitElement?.tagName ?? null,
        hitTestId: hitElement?.getAttribute("data-testid") ?? null,
      };
    });
  expect(focusHit.canvasCoversPoint, `map focus canvas coverage ${JSON.stringify(focusHit)}`).toBe(
    true,
  );
  expect(focusHit.coveredByHud, `map focus covered ${JSON.stringify(focusHit)}`).toBe(false);

  if (layoutMode === "medium") {
    const drawerMetrics = await readElementViewportMetrics(
      page,
      "[data-testid='player-bottom-drawer']",
    );
    expect(drawerMetrics.left, "bottom drawer left").toBeGreaterThanOrEqual(0);
    expect(drawerMetrics.right, "bottom drawer right").toBeLessThanOrEqual(width + 1);
    expect(drawerMetrics.bottom, "bottom drawer bottom").toBeLessThanOrEqual(height + 1);
    expect(drawerMetrics.height, "bottom drawer stable height").toBeLessThanOrEqual(
      Math.min(270, height * 0.36) + 1,
    );
  } else {
    expect(await page.getByTestId("player-bottom-drawer").count()).toBe(0);
  }
}

async function waitForViewportSize(
  page: import("playwright").Page,
  width: number,
  height: number,
): Promise<void> {
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

async function assertDocumentOverflowWithinViewport(
  page: import("playwright").Page,
): Promise<void> {
  const overflow = await readDocumentOverflow(page);
  expect(overflow.documentOverflowX).toBeLessThanOrEqual(1);
  expect(overflow.documentOverflowY).toBeLessThanOrEqual(1);
}

async function readDocumentOverflow(page: import("playwright").Page): Promise<{
  readonly documentOverflowX: number;
  readonly documentOverflowY: number;
}> {
  return page.evaluate(() => ({
    documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    documentOverflowY:
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
}

function toRelativeArtifactPath(targetPath: string): string {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}

async function waitForStartSurfaceClosed(page: import("playwright").Page): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await page.getByTestId("main-menu-surface").count()) === 0) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Timed out waiting for the main menu surface to close.");
}

async function assertTestIdWithinViewport(
  page: import("playwright").Page,
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
  page: import("playwright").Page,
  testId: string,
  width: number,
  height: number,
): Promise<void> {
  await assertSelectorReachableWithoutCover(page, `[data-testid='${testId}']`, width, height);
}

async function assertSelectorReachableWithoutCover(
  page: import("playwright").Page,
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
  expect(metrics.top, `${selector} top ${JSON.stringify(metrics)}`).toBeGreaterThanOrEqual(0);
  expect(metrics.left, `${selector} left ${JSON.stringify(metrics)}`).toBeGreaterThanOrEqual(0);
  expect(metrics.right, `${selector} right ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(
    width + 1,
  );
  expect(metrics.bottom, `${selector} bottom ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(
    height + 1,
  );

  const hitInfo = await page.locator(selector).evaluate((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(centerX, centerY);
    const hitElement = hit instanceof HTMLElement ? hit : null;
    const sameTreeHit =
      hitElement !== null &&
      (hitElement === element || element.contains(hitElement) || hitElement.contains(element));
    return {
      contains: sameTreeHit,
      hitTag: hitElement?.tagName ?? null,
      hitContainsElement: hitElement?.contains(element) ?? false,
      hitDataShellReady: hitElement?.getAttribute("data-shell-ready") ?? null,
      hitClass: hitElement?.className ?? null,
      hitStyle: hitElement?.getAttribute("style")?.slice(0, 220) ?? null,
      hitTestId: hitElement?.getAttribute("data-testid") ?? null,
      hitUiSlot: hitElement?.getAttribute("data-ui-slot") ?? null,
      hitParentTestId: hitElement?.parentElement?.getAttribute("data-testid") ?? null,
      hitParentStyle: hitElement?.parentElement?.getAttribute("style")?.slice(0, 220) ?? null,
      parentTag: element.parentElement?.tagName ?? null,
      parentTestId: element.parentElement?.getAttribute("data-testid") ?? null,
      parentIsHit: hitElement === element.parentElement,
      point: {
        x: centerX,
        y: centerY,
      },
      rect: {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      },
    };
  });
  expect(hitInfo.contains, `${selector} uncovered: ${JSON.stringify(hitInfo)}`).toBe(true);
}

async function assertTallSelectorReachableWithoutCover(
  page: import("playwright").Page,
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
      const clip = readVisibleClip(element, viewportHeight);
      const visibleTop = Math.max(rect.top, clip.top);
      const visibleBottom = Math.min(rect.bottom, clip.bottom);
      const centerX = rect.left + rect.width / 2;
      const sampleY = visibleTop + Math.max((visibleBottom - visibleTop) / 2, 1);
      const hit = document.elementFromPoint(centerX, sampleY);
      return (
        hit instanceof HTMLElement &&
        (hit === element || element.contains(hit) || hit.contains(element))
      );

      function readVisibleClip(
        target: HTMLElement,
        height: number,
      ): { bottom: number; top: number } {
        let top = 1;
        let bottom = height - 1;
        let current = target.parentElement;

        while (current !== null) {
          const style = window.getComputedStyle(current);
          const clipsY =
            style.overflowY === "auto" ||
            style.overflowY === "scroll" ||
            style.overflowY === "hidden" ||
            style.overflow === "auto" ||
            style.overflow === "scroll" ||
            style.overflow === "hidden";
          if (clipsY) {
            const currentRect = current.getBoundingClientRect();
            top = Math.max(top, currentRect.top);
            bottom = Math.min(bottom, currentRect.bottom);
          }
          current = current.parentElement;
        }

        return { bottom, top };
      }
    }, height);
  expect(isUncovered, `${selector} uncovered`).toBe(true);
}

async function readElementViewportMetrics(
  page: import("playwright").Page,
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

async function clickCanvasPoint(
  page: import("playwright").Page,
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

async function clickCanvasViewportPoint(
  page: import("playwright").Page,
  point: { readonly x: number; readonly y: number },
): Promise<void> {
  await page
    .locator("[data-testid='world-canvas']")
    .evaluate((canvas: HTMLCanvasElement, target: { readonly x: number; readonly y: number }) => {
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: target.x,
          clientY: target.y,
          pointerId: 11,
          pointerType: "mouse",
        }),
      );
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: target.x,
          clientY: target.y,
          pointerId: 11,
          pointerType: "mouse",
        }),
      );
    }, point);
}

async function dragCanvasViewportPoint(
  page: import("playwright").Page,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.locator("[data-testid='world-canvas']").evaluate(
    (
      canvas: HTMLCanvasElement,
      points: {
        readonly end: { readonly x: number; readonly y: number };
        readonly start: { readonly x: number; readonly y: number };
      },
    ) => {
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: points.start.x,
          clientY: points.start.y,
          pointerId: 12,
          pointerType: "mouse",
        }),
      );
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: points.start.x + (points.end.x - points.start.x) / 2,
          clientY: points.start.y + (points.end.y - points.start.y) / 2,
          pointerId: 12,
          pointerType: "mouse",
        }),
      );
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: points.end.x,
          clientY: points.end.y,
          pointerId: 12,
          pointerType: "mouse",
        }),
      );
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: points.end.x,
          clientY: points.end.y,
          pointerId: 12,
          pointerType: "mouse",
        }),
      );
    },
    { end, start },
  );
}

async function readMapFocusViewportPoint(
  page: import("playwright").Page,
  widthRatio: number,
  heightRatio: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const box = await page.getByTestId("player-map-focus").boundingBox();
  if (box === null) {
    throw new Error("Expected a player map focus region.");
  }

  return {
    x: box.x + box.width * widthRatio,
    y: box.y + box.height * heightRatio,
  };
}

async function assertViewportPointHitsCanvas(
  page: import("playwright").Page,
  point: { readonly x: number; readonly y: number },
): Promise<void> {
  const hitInfo = await page.evaluate((target) => {
    const hit = document.elementFromPoint(target.x, target.y);
    const interactiveHudAncestor =
      hit instanceof HTMLElement
        ? hit.closest(
            "button,input,select,textarea,a,[role='button'],[data-ui-slot],[data-testid='main-menu-panel'],[data-testid='locale-settings'],[data-testid='ui-scale-settings'],[data-testid='storage-panel']",
          )
        : null;
    return {
      interactiveHudAncestorTestId:
        interactiveHudAncestor instanceof HTMLElement
          ? interactiveHudAncestor.getAttribute("data-testid")
          : null,
      pointerEvents: hit instanceof HTMLElement ? window.getComputedStyle(hit).pointerEvents : null,
      tagName: hit instanceof HTMLElement ? hit.tagName : null,
      testId: hit instanceof HTMLElement ? hit.getAttribute("data-testid") : null,
    };
  }, point);
  expect(hitInfo.interactiveHudAncestorTestId, `camera hit-test ${JSON.stringify(hitInfo)}`).toBe(
    null,
  );
}

async function findReachableEntityPoint(
  page: import("playwright").Page,
  payload: WebShellDebugPayload,
): Promise<{ readonly entityId: string; readonly x: number; readonly y: number }> {
  return page.evaluate((entityScreenPositions) => {
    const canvas = document.querySelector("[data-testid='world-canvas']");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Expected world canvas.");
    }

    const rect = canvas.getBoundingClientRect();
    for (const entity of entityScreenPositions) {
      const x = rect.left + entity.x;
      const y = rect.top + entity.y;
      if (x < rect.left + 18 || y < rect.top + 18 || x > rect.right - 18 || y > rect.bottom - 18) {
        continue;
      }

      const hit = document.elementFromPoint(x, y);
      const interactiveHudAncestor =
        hit instanceof HTMLElement
          ? hit.closest(
              "button,input,select,textarea,a,[role='button'],[data-ui-slot],[data-testid='main-menu-panel'],[data-testid='locale-settings'],[data-testid='ui-scale-settings'],[data-testid='storage-panel']",
            )
          : null;
      if (interactiveHudAncestor === null) {
        return {
          entityId: entity.entityId,
          x,
          y,
        };
      }
    }

    throw new Error("Unable to find an entity reachable by real mouse hit-testing.");
  }, payload.entityScreenPositions);
}

async function findInspectableCanvasPoint(
  page: import("playwright").Page,
  payload: WebShellDebugPayload,
): Promise<{ readonly x: number; readonly y: number }> {
  return page.evaluate((entityScreenPositions) => {
    const canvas = document.querySelector("[data-testid='world-canvas']");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Expected world canvas.");
    }

    const rect = canvas.getBoundingClientRect();
    const minimumDistanceSquared = 28 * 28;
    for (let y = rect.top + rect.height * 0.32; y <= rect.bottom - 24; y += 24) {
      for (let x = rect.left + rect.width * 0.36; x <= rect.right - 24; x += 24) {
        let nearEntity = false;
        for (const entity of entityScreenPositions) {
          const deltaX = entity.x - x;
          const deltaY = entity.y - y;
          if (deltaX * deltaX + deltaY * deltaY <= minimumDistanceSquared) {
            nearEntity = true;
            break;
          }
        }

        if (!nearEntity) {
          return {
            x: x - rect.left,
            y: y - rect.top,
          };
        }
      }
    }

    throw new Error("Unable to find an uncovered empty canvas point.");
  }, payload.entityScreenPositions);
}

function findRequiredEntity(
  payload: WebShellDebugPayload,
  entityId: string,
): { readonly x: number; readonly y: number } {
  const entity = payload.entityScreenPositions.find((candidate) => candidate.entityId === entityId);
  if (entity === undefined) {
    throw new Error(`Expected entity screen position for ${entityId}.`);
  }

  return entity;
}

async function readDebugPayload(page: import("playwright").Page): Promise<WebShellDebugPayload> {
  const debugText = await page.locator("#wm-shell-debug").textContent();
  expect(debugText).not.toBeNull();
  return parseDebugPayload(debugText ?? "{}");
}

async function waitForHudText(
  page: import("playwright").Page,
  expectedText: string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const hudText = await page.locator("[data-shell-ready='true']").textContent();
    if (hudText?.includes(expectedText) === true) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for HUD text: ${expectedText}`);
}

async function waitForStorageStatus(
  page: import("playwright").Page,
  expectedText: string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const statusText = await page.getByTestId("storage-status").textContent();
    if (statusText?.includes(expectedText) === true) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for storage status: ${expectedText}`);
}

async function waitForSelectedEntity(
  page: import("playwright").Page,
  expectedEntityId: string,
): Promise<void> {
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

async function waitForInspectedTile(page: import("playwright").Page): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const inspector = page.locator("[data-inspected-tile]").first();
    const selectedEntity = await inspector.getAttribute("data-selected-entity");
    const inspectedTile = await inspector.getAttribute("data-inspected-tile");
    if (selectedEntity === "" && typeof inspectedTile === "string" && inspectedTile.length > 0) {
      return inspectedTile;
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Timed out waiting for empty-tile inspection feedback.");
}

async function waitForTimeout(page: import("playwright").Page, durationMs: number): Promise<void> {
  await page.waitForTimeout(durationMs);
}

async function readContrastRatio(
  page: import("playwright").Page,
  selector: string,
): Promise<number> {
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

function readServerUrl(server: ViteDevServer): string {
  const localUrl = server.resolvedUrls?.local[0];
  if (localUrl === undefined) {
    throw new Error("Vite dev server did not expose a local URL.");
  }

  return localUrl;
}

async function waitForLocale(
  page: import("playwright").Page,
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
  page: import("playwright").Page,
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

async function assertContrastBaseline(page: import("playwright").Page): Promise<void> {
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

function withQuery(url: string, query: string): string {
  const nextUrl = new URL(url);
  const params = new URLSearchParams(query);
  for (const [key, value] of params.entries()) {
    nextUrl.searchParams.set(key, value);
  }

  return nextUrl.toString();
}

function parseDebugPayload(text: string): WebShellDebugPayload {
  const parsed: unknown = JSON.parse(text);
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed["browserTargets"]) ||
    typeof parsed["canvasWidth"] !== "number" ||
    typeof parsed["canvasHeight"] !== "number" ||
    typeof parsed["centerWorldX"] !== "number" ||
    typeof parsed["centerWorldY"] !== "number" ||
    !isRecord(parsed["diagnostics"]) ||
    typeof parsed["fixtureId"] !== "string" ||
    typeof parsed["runtimeBrowser"] !== "string" ||
    typeof parsed["runtimeCrossOriginIsolated"] !== "boolean" ||
    typeof parsed["zoom"] !== "number" ||
    !isRecord(parsed["storageGate"]) ||
    !Array.isArray(parsed["entityScreenPositions"])
  ) {
    throw new Error("Unexpected web shell debug payload.");
  }

  const storageGate = parsed["storageGate"];
  const diagnostics = parsed["diagnostics"];
  if (
    typeof storageGate["interoperabilityVerdict"] !== "string" ||
    typeof storageGate["lastActionLabel"] !== "string" ||
    typeof storageGate["saveSlotCount"] !== "number" ||
    typeof storageGate["statusTone"] !== "string" ||
    typeof storageGate["storageKindLabel"] !== "string"
  ) {
    throw new Error("Unexpected storage gate debug payload.");
  }
  if (
    !Array.isArray(diagnostics["blockerCodes"]) ||
    typeof diagnostics["lastActionLabel"] !== "string" ||
    typeof diagnostics["lastPackageStatus"] !== "string" ||
    diagnostics["networkUploadEnabled"] !== false ||
    diagnostics["packageKind"] !== "m6-local-diagnostic-package" ||
    typeof diagnostics["recentErrorCount"] !== "number" ||
    typeof diagnostics["safeLogCount"] !== "number" ||
    typeof diagnostics["suggestedFileName"] !== "string" ||
    diagnostics["telemetryEnabled"] !== false ||
    typeof diagnostics["webDownloadStatus"] !== "string" ||
    typeof diagnostics["windowsHostPackageStatus"] !== "string"
  ) {
    throw new Error("Unexpected diagnostic debug payload.");
  }

  const positions = parsed["entityScreenPositions"].map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry["entityId"] !== "string" ||
      typeof entry["x"] !== "number" ||
      typeof entry["y"] !== "number"
    ) {
      throw new Error("Unexpected entity screen position payload.");
    }

    return {
      entityId: entry["entityId"],
      x: entry["x"],
      y: entry["y"],
    };
  });

  return {
    browserTargets: parsed["browserTargets"].map((entry) => {
      if (typeof entry !== "string") {
        throw new Error("Unexpected browser target payload.");
      }

      return entry;
    }),
    canvasWidth: parsed["canvasWidth"],
    canvasHeight: parsed["canvasHeight"],
    centerWorldX: parsed["centerWorldX"],
    centerWorldY: parsed["centerWorldY"],
    diagnostics: {
      blockerCodes: diagnostics["blockerCodes"].map((entry) => {
        if (typeof entry !== "string") {
          throw new Error("Unexpected diagnostic blocker code.");
        }

        return entry;
      }),
      lastActionLabel: diagnostics["lastActionLabel"],
      lastPackageStatus: readDiagnosticPackageStatus(diagnostics["lastPackageStatus"]),
      networkUploadEnabled: false,
      packageKind: "m6-local-diagnostic-package",
      recentErrorCount: diagnostics["recentErrorCount"],
      safeLogCount: diagnostics["safeLogCount"],
      suggestedFileName: diagnostics["suggestedFileName"],
      telemetryEnabled: false,
      webDownloadStatus: readDiagnosticAvailability(diagnostics["webDownloadStatus"]),
      windowsHostPackageStatus: readDiagnosticAvailability(diagnostics["windowsHostPackageStatus"]),
    },
    fixtureId: parsed["fixtureId"],
    zoom: parsed["zoom"],
    runtimeBrowser: parsed["runtimeBrowser"],
    runtimeCrossOriginIsolated: parsed["runtimeCrossOriginIsolated"],
    selectedEntityId:
      typeof parsed["selectedEntityId"] === "string" ? parsed["selectedEntityId"] : undefined,
    storageGate: {
      diagnosticCode:
        typeof storageGate["diagnosticCode"] === "string"
          ? storageGate["diagnosticCode"]
          : undefined,
      interoperabilityVerdict:
        storageGate["interoperabilityVerdict"] === "blocked" ||
        storageGate["interoperabilityVerdict"] === "pending" ||
        storageGate["interoperabilityVerdict"] === "proven"
          ? storageGate["interoperabilityVerdict"]
          : "pending",
      lastActionLabel: storageGate["lastActionLabel"],
      quotaAvailableBytes:
        typeof storageGate["quotaAvailableBytes"] === "number"
          ? storageGate["quotaAvailableBytes"]
          : null,
      quotaBytes: typeof storageGate["quotaBytes"] === "number" ? storageGate["quotaBytes"] : null,
      saveSlotCount: storageGate["saveSlotCount"],
      statusTone:
        storageGate["statusTone"] === "danger" ||
        storageGate["statusTone"] === "stable" ||
        storageGate["statusTone"] === "warning"
          ? storageGate["statusTone"]
          : "warning",
      storageKindLabel: storageGate["storageKindLabel"],
      usageBytes: typeof storageGate["usageBytes"] === "number" ? storageGate["usageBytes"] : null,
    },
    entityScreenPositions: positions,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }

  return value;
}

function readDiagnosticAvailability(value: string): "available" | "blocked" {
  if (value === "available" || value === "blocked") {
    return value;
  }

  throw new Error(`Unexpected diagnostic availability: ${value}`);
}

function readDiagnosticPackageStatus(value: string): "blocked" | "error" | "exported" | "idle" {
  if (value === "blocked" || value === "error" || value === "exported" || value === "idle") {
    return value;
  }

  throw new Error(`Unexpected diagnostic status: ${value}`);
}

function readScreenshotPath(): string {
  const artifactRoot =
    process.env["WM_ARTIFACT_DIR"] ?? path.join(os.tmpdir(), "wuming-town", "WM-0088");
  return path.join(artifactRoot, "web-storage-shell", "web-shell-smoke.png");
}
