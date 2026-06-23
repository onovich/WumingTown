/// <reference lib="dom" />

import { mkdir, stat } from "node:fs/promises";
import * as path from "node:path";

import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

interface WebShellDebugPayload {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly zoom: number;
  readonly selectedEntityId: string | undefined;
  readonly entityScreenPositions: readonly {
    readonly entityId: string;
    readonly x: number;
    readonly y: number;
  }[];
}

const SCREENSHOT_PATH = path.join(
  process.cwd(),
  "coordination",
  "artifacts",
  "WM-0003",
  "web-shell-smoke.png",
);

describe("web shell smoke", () => {
  it("renders the Pixi map shell, updates selection via canvas input, and writes a deterministic screenshot", async () => {
    const appRoot = path.join(process.cwd(), "apps", "web");
    const server = await createServer({
      logLevel: "error",
      root: appRoot,
      server: {
        host: "127.0.0.1",
        port: 0,
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

      const debugPayload = await readDebugPayload(page);
      const targetEntity = debugPayload.entityScreenPositions.find(
        (entity) => entity.entityId === "scribe-lin",
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
      await waitForSelectedEntity(page, "scribe-lin");

      await page.keyboard.press("KeyD");
      await waitForHudText(page, "Keyboard KeyD");

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
});

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
    typeof parsed["canvasWidth"] !== "number" ||
    typeof parsed["canvasHeight"] !== "number" ||
    typeof parsed["zoom"] !== "number" ||
    !Array.isArray(parsed["entityScreenPositions"])
  ) {
    throw new Error("Unexpected web shell debug payload.");
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
    canvasWidth: parsed["canvasWidth"],
    canvasHeight: parsed["canvasHeight"],
    zoom: parsed["zoom"],
    selectedEntityId:
      typeof parsed["selectedEntityId"] === "string" ? parsed["selectedEntityId"] : undefined,
    entityScreenPositions: positions,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
