/// <reference lib="dom" />

import { mkdir, readFile, stat } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

interface WebShellDebugPayload {
  readonly browserTargets: readonly string[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly diagnostics: WebDiagnosticDebugState;
  readonly fixtureId: string;
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

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");

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

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
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
      await waitForHudText(page, "Canvas 1440 x 900");
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
      await waitForHudText(page, "Canvas 390 x 720");
      await assertAccessibilityBaseline(page);

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

      await page.goto(serverUrl, {
        waitUntil: "networkidle",
      });
      await page.waitForSelector("[data-shell-ready='true']");
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
});

async function assertAccessibilityBaseline(page: import("playwright").Page): Promise<void> {
  const shellText = await page.locator("[data-shell-ready='true']").textContent();
  expect(shellText ?? "").toContain("M5 first-season Web product-gate fixture");
  expect(shellText ?? "").toContain("m5.alpha_content_framework.first_season.v1");
  expect(shellText ?? "").toContain("Wuming Town");
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

  const storageStatusText = await page.getByTestId("storage-status").textContent();
  const interoperabilityText = await page.getByTestId("storage-interoperability").textContent();
  expect(storageStatusText ?? "").toContain("Web storage");
  expect(interoperabilityText ?? "").toContain("BLOCKED");

  const mediaCueCount = await page.locator("audio, video").count();
  expect(mediaCueCount).toBe(0);

  const activeAnimationCount = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState !== "finished").length,
  );
  expect(activeAnimationCount).toBe(0);

  const overflow = await page.evaluate(() => {
    const selectors = [
      "button",
      "[aria-label='Town status']",
      "[aria-label='Viewport and alerts']",
      "[aria-label='Web product gate harness']",
      "[aria-label='Selected entity inspector']",
      "[data-testid='storage-status']",
      "[data-testid='storage-interoperability']",
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

function readServerUrl(server: ViteDevServer): string {
  const localUrl = server.resolvedUrls?.local[0];
  if (localUrl === undefined) {
    throw new Error("Vite dev server did not expose a local URL.");
  }

  return localUrl;
}

function parseDebugPayload(text: string): WebShellDebugPayload {
  const parsed: unknown = JSON.parse(text);
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed["browserTargets"]) ||
    typeof parsed["canvasWidth"] !== "number" ||
    typeof parsed["canvasHeight"] !== "number" ||
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
