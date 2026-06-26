#!/usr/bin/env node
/* global document, HTMLCanvasElement, PerformanceNavigationTiming, PerformanceObserver, PointerEvent, performance, requestAnimationFrame */
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DIST_DIR = path.join(REPO_ROOT, "apps", "desktop-electron", "dist", "renderer");
const BUILD_REPORT_PATH = path.join(DIST_DIR, "wm-release-gate-report.json");
const DEFAULT_OUTPUT_PATH = path.join(
  os.tmpdir(),
  "wuming-town",
  "WM-0087",
  "web-performance-gate.json",
);
const DEFAULT_FRAME_SAMPLE_DURATION_MS = 8_000;
const DEFAULT_INTERACTION_PASSES = 3;
const DEFAULT_IDLE_BETWEEN_SAMPLES_MS = 300;
const MEMORY_SAMPLE_LABELS = Object.freeze([
  "post-ready",
  "after-pass-1",
  "after-pass-2",
  "after-pass-3",
  "post-idle",
]);

const BROWSER_CONFIGS = Object.freeze([
  {
    id: "chrome-stable",
    label: "Chrome Stable",
    executablePath: path.join(
      "C:",
      "Program Files",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe",
    ),
  },
  {
    id: "edge-stable",
    label: "Edge Stable",
    executablePath: path.join(
      "C:",
      "Program Files (x86)",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe",
    ),
  },
]);

const options = readOptions(process.argv.slice(2));
const buildReport = await readJsonFile(BUILD_REPORT_PATH);
await assertPathExists(DIST_DIR, "Expected built Web renderer output. Run pnpm build:web first.");

const server = await startStaticServer(DIST_DIR);

try {
  const browserResults = [];
  for (const browserConfig of BROWSER_CONFIGS) {
    await assertPathExists(
      browserConfig.executablePath,
      `Expected ${browserConfig.label} at ${browserConfig.executablePath}.`,
    );
    browserResults.push(await measureBrowser(browserConfig, server.url));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT.replaceAll("\\", "/"),
    distDir: DIST_DIR.replaceAll("\\", "/"),
    buildReportPath: BUILD_REPORT_PATH.replaceAll("\\", "/"),
    browserCount: browserResults.length,
    options: {
      frameSampleDurationMs: options.frameSampleDurationMs,
      interactionPasses: options.interactionPasses,
      idleBetweenSamplesMs: options.idleBetweenSamplesMs,
    },
    build: buildReport,
    browsers: browserResults,
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Web performance gate report: ${options.outputPath}`);
  for (const browserResult of browserResults) {
    console.log(
      [
        browserResult.browser,
        `readyMs=${formatNumber(browserResult.navigation.shellReadyMs)}`,
        `interactionP95Ms=${formatNumber(browserResult.interactions.latencyP95Ms)}`,
        `frameP95Ms=${formatNumber(browserResult.frameStats.frameDeltaP95Ms)}`,
        `heapDeltaMb=${formatNumber(browserResult.memory.jsHeapDeltaMb)}`,
      ].join(" | "),
    );
  }
} finally {
  await server.close();
}

function readOptions(args) {
  let outputPath = DEFAULT_OUTPUT_PATH;
  let frameSampleDurationMs = DEFAULT_FRAME_SAMPLE_DURATION_MS;
  let interactionPasses = DEFAULT_INTERACTION_PASSES;
  let idleBetweenSamplesMs = DEFAULT_IDLE_BETWEEN_SAMPLES_MS;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--output") {
      outputPath = readRequiredValue(args, index);
      index += 1;
      continue;
    }
    if (arg === "--frame-sample-ms") {
      frameSampleDurationMs = readPositiveInteger(readRequiredValue(args, index), arg);
      index += 1;
      continue;
    }
    if (arg === "--interaction-passes") {
      interactionPasses = readPositiveInteger(readRequiredValue(args, index), arg);
      index += 1;
      continue;
    }
    if (arg === "--idle-between-samples-ms") {
      idleBetweenSamplesMs = readPositiveInteger(readRequiredValue(args, index), arg);
      index += 1;
      continue;
    }

    throw new Error(
      `Unsupported argument ${arg}. Use --output <path>, --frame-sample-ms <n>, --interaction-passes <n>, or --idle-between-samples-ms <n>.`,
    );
  }

  return {
    outputPath: path.resolve(outputPath),
    frameSampleDurationMs,
    interactionPasses,
    idleBetweenSamplesMs,
  };
}

function readRequiredValue(args, index) {
  const value = args[index + 1];
  if (value === undefined) {
    throw new Error(`Missing value for ${args[index]}.`);
  }
  return value;
}

function readPositiveInteger(raw, label) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} requires a positive safe integer.`);
  }
  return value;
}

async function measureBrowser(browserConfig, serverUrl) {
  const browser = await chromium.launch({
    executablePath: browserConfig.executablePath,
    headless: true,
    args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"],
  });

  try {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: {
        width: 1280,
        height: 800,
      },
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send("HeapProfiler.enable");

    const shellReadyStart = Date.now();
    await page.goto(serverUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-shell-ready='true']", { timeout: 60_000 });
    const shellReadyMs = Date.now() - shellReadyStart;
    await waitForDebugPayload(page);

    const debugPayload = await readDebugPayload(page);
    await page.evaluate(
      ({ durationMs }) => {
        globalThis.__wmFrameProbe = new Promise((resolve) => {
          const frameDeltas = [];
          const longTaskDurations = [];
          let observer = null;
          if (typeof PerformanceObserver === "function") {
            observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              for (const entry of entries) {
                if (typeof entry.duration === "number") {
                  longTaskDurations.push(entry.duration);
                }
              }
            });
            try {
              observer.observe({ type: "longtask", buffered: true });
            } catch {
              observer.disconnect();
              observer = null;
            }
          }

          let startedAt = 0;
          let previousFrame = 0;
          const step = (timestamp) => {
            if (startedAt === 0) {
              startedAt = timestamp;
              previousFrame = timestamp;
              requestAnimationFrame(step);
              return;
            }

            frameDeltas.push(timestamp - previousFrame);
            previousFrame = timestamp;

            if (timestamp - startedAt >= durationMs) {
              observer?.disconnect();
              resolve({ frameDeltas, longTaskDurations });
              return;
            }

            requestAnimationFrame(step);
          };

          requestAnimationFrame(step);
        });
      },
      {
        durationMs: options.frameSampleDurationMs,
      },
    );

    const memorySamples = [];
    memorySamples.push(await readMemorySample(session, page, MEMORY_SAMPLE_LABELS[0]));

    const interactionLatencies = [];
    for (let passIndex = 0; passIndex < options.interactionPasses; passIndex += 1) {
      const targets = readInteractionTargets(debugPayload.entityScreenPositions, passIndex);
      for (const target of targets) {
        interactionLatencies.push(
          await selectEntityAndMeasureLatency(page, target.x, target.y, target.entityId),
        );
      }

      await page.waitForTimeout(options.idleBetweenSamplesMs);
      const label = MEMORY_SAMPLE_LABELS[passIndex + 1] ?? `after-pass-${String(passIndex + 1)}`;
      memorySamples.push(await readMemorySample(session, page, label));
    }

    await page.waitForTimeout(options.idleBetweenSamplesMs);
    memorySamples.push(await readMemorySample(session, page, MEMORY_SAMPLE_LABELS.at(-1)));

    const navigation = await page.evaluate(() => {
      const navigationEntry = performance.getEntriesByType("navigation")[0];
      const resourceEntries = performance.getEntriesByType("resource");
      const resourceSummary = {
        requestCount: resourceEntries.length,
        transferSize: 0,
        encodedBodySize: 0,
        decodedBodySize: 0,
      };

      for (const entry of resourceEntries) {
        resourceSummary.transferSize += Number(entry.transferSize ?? 0);
        resourceSummary.encodedBodySize += Number(entry.encodedBodySize ?? 0);
        resourceSummary.decodedBodySize += Number(entry.decodedBodySize ?? 0);
      }

      if (!(navigationEntry instanceof PerformanceNavigationTiming)) {
        return {
          domContentLoadedMs: null,
          loadEventEndMs: null,
          responseEndMs: null,
          resourceSummary,
        };
      }

      return {
        domContentLoadedMs: navigationEntry.domContentLoadedEventEnd,
        loadEventEndMs: navigationEntry.loadEventEnd,
        responseEndMs: navigationEntry.responseEnd,
        resourceSummary,
      };
    });

    const userAgentSpecificMemory = await page.evaluate(async () => {
      if (typeof performance.measureUserAgentSpecificMemory !== "function") {
        return {
          available: false,
          bytes: null,
          error: "measureUserAgentSpecificMemory unavailable",
        };
      }

      try {
        const result = await performance.measureUserAgentSpecificMemory();
        return {
          available: true,
          bytes: result.bytes,
          error: null,
        };
      } catch (error) {
        return {
          available: true,
          bytes: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const frameProbe = await page.evaluate(() => globalThis.__wmFrameProbe);
    await context.close();

    return {
      browser: browserConfig.label,
      executablePath: browserConfig.executablePath.replaceAll("\\", "/"),
      debug: {
        fixtureId: debugPayload.fixtureId,
        runtimeBrowser: debugPayload.runtimeBrowser,
        runtimeCrossOriginIsolated: debugPayload.runtimeCrossOriginIsolated,
        selectedEntityId: debugPayload.selectedEntityId ?? null,
        visibleEntityCount: debugPayload.entityScreenPositions.length,
      },
      navigation: {
        shellReadyMs,
        domContentLoadedMs: navigation.domContentLoadedMs,
        loadEventEndMs: navigation.loadEventEndMs,
        responseEndMs: navigation.responseEndMs,
        requestCount: navigation.resourceSummary.requestCount,
        transferSizeBytes: navigation.resourceSummary.transferSize,
        encodedBodySizeBytes: navigation.resourceSummary.encodedBodySize,
        decodedBodySizeBytes: navigation.resourceSummary.decodedBodySize,
      },
      interactions: {
        sampleCount: interactionLatencies.length,
        latencyMedianMs: percentile(interactionLatencies, 50),
        latencyP95Ms: percentile(interactionLatencies, 95),
        latencyMaxMs: maxOf(interactionLatencies),
      },
      frameStats: {
        frameSampleCount: frameProbe.frameDeltas.length,
        frameDeltaMedianMs: percentile(frameProbe.frameDeltas, 50),
        frameDeltaP95Ms: percentile(frameProbe.frameDeltas, 95),
        frameDeltaMaxMs: maxOf(frameProbe.frameDeltas),
        longTaskCount: frameProbe.longTaskDurations.length,
        longTaskP95Ms:
          frameProbe.longTaskDurations.length > 0
            ? percentile(frameProbe.longTaskDurations, 95)
            : null,
        longTaskMaxMs:
          frameProbe.longTaskDurations.length > 0 ? maxOf(frameProbe.longTaskDurations) : null,
      },
      memory: {
        sampleCount: memorySamples.length,
        samples: memorySamples,
        jsHeapStartMb: memorySamples[0]?.jsHeapUsedMb ?? null,
        jsHeapEndMb: memorySamples.at(-1)?.jsHeapUsedMb ?? null,
        jsHeapPeakMb: maxOf(memorySamples.map((sample) => sample.jsHeapUsedMb)),
        jsHeapDeltaMb: calculateDelta(
          memorySamples[0]?.jsHeapUsedMb ?? null,
          memorySamples.at(-1)?.jsHeapUsedMb ?? null,
        ),
        userAgentSpecificMemory,
      },
    };
  } finally {
    await browser.close();
  }
}

async function waitForDebugPayload(page) {
  await page.waitForFunction(() => {
    const node = document.getElementById("wm-shell-debug");
    return typeof node?.textContent === "string" && node.textContent.trim().length > 0;
  });
}

async function readDebugPayload(page) {
  return page.evaluate(() => {
    const node = document.getElementById("wm-shell-debug");
    if (node === null || typeof node.textContent !== "string" || node.textContent.length === 0) {
      throw new Error("Missing #wm-shell-debug payload.");
    }

    const parsed = JSON.parse(node.textContent);
    if (
      !parsed ||
      !Array.isArray(parsed.entityScreenPositions) ||
      typeof parsed.fixtureId !== "string" ||
      typeof parsed.runtimeBrowser !== "string" ||
      typeof parsed.runtimeCrossOriginIsolated !== "boolean"
    ) {
      throw new Error("Unexpected web shell debug payload.");
    }

    return parsed;
  });
}

function readInteractionTargets(entityScreenPositions, passIndex) {
  const targets = entityScreenPositions.map((entry) => ({
    entityId: entry.entityId,
    x: entry.x,
    y: entry.y,
  }));

  if (passIndex % 2 === 1) {
    targets.reverse();
  }

  return targets;
}

async function selectEntityAndMeasureLatency(page, x, y, expectedEntityId) {
  return page.evaluate(
    ({ expectedId, pointX, pointY }) =>
      new Promise((resolve, reject) => {
        const canvas = document.querySelector("[data-testid='world-canvas']");
        if (!(canvas instanceof HTMLCanvasElement)) {
          reject(new Error("Expected world canvas."));
          return;
        }

        const start = performance.now();
        const rect = canvas.getBoundingClientRect();
        const finishBy = start + 5_000;

        const check = () => {
          const selectedNode = document.querySelector("[data-selected-entity]");
          const selectedEntityId = selectedNode?.getAttribute("data-selected-entity");
          if (selectedEntityId === expectedId) {
            resolve(performance.now() - start);
            return;
          }

          if (performance.now() > finishBy) {
            reject(new Error(`Timed out waiting for ${expectedId}.`));
            return;
          }

          requestAnimationFrame(check);
        };

        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            clientX: rect.left + pointX,
            clientY: rect.top + pointY,
            pointerId: 1,
            pointerType: "mouse",
          }),
        );
        canvas.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            clientX: rect.left + pointX,
            clientY: rect.top + pointY,
            pointerId: 1,
            pointerType: "mouse",
          }),
        );
        requestAnimationFrame(check);
      }),
    {
      expectedId: expectedEntityId,
      pointX: x,
      pointY: y,
    },
  );
}

async function readMemorySample(session, page, label) {
  try {
    await session.send("HeapProfiler.collectGarbage");
  } catch {
    // Chrome/Edge can refuse explicit GC in some modes; keep the sample anyway.
  }

  const heapUsage = await session.send("Runtime.getHeapUsage");
  const pageHeap = await page.evaluate(() => {
    const value = performance.memory;
    if (
      value === undefined ||
      typeof value.usedJSHeapSize !== "number" ||
      typeof value.totalJSHeapSize !== "number" ||
      typeof value.jsHeapSizeLimit !== "number"
    ) {
      return null;
    }

    return {
      usedJSHeapSize: value.usedJSHeapSize,
      totalJSHeapSize: value.totalJSHeapSize,
      jsHeapSizeLimit: value.jsHeapSizeLimit,
    };
  });

  return {
    label,
    rendererUsedSizeBytes: heapUsage.usedSize,
    rendererTotalSizeBytes: heapUsage.totalSize,
    jsHeapUsedMb: toMegabytes(heapUsage.usedSize),
    jsHeapTotalMb: toMegabytes(heapUsage.totalSize),
    pageHeapUsedMb: pageHeap === null ? null : toMegabytes(pageHeap.usedJSHeapSize),
    pageHeapTotalMb: pageHeap === null ? null : toMegabytes(pageHeap.totalJSHeapSize),
    pageHeapLimitMb: pageHeap === null ? null : toMegabytes(pageHeap.jsHeapSizeLimit),
  };
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = (percentileValue / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lower === undefined || upper === undefined) {
    return null;
  }
  if (lowerIndex === upperIndex) {
    return roundToThreeDecimals(lower);
  }

  const weight = rank - lowerIndex;
  return roundToThreeDecimals(lower + (upper - lower) * weight);
}

function maxOf(values) {
  if (values.length === 0) {
    return null;
  }

  let maxValue = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value > maxValue) {
      maxValue = value;
    }
  }
  return Number.isFinite(maxValue) ? roundToThreeDecimals(maxValue) : null;
}

function calculateDelta(start, end) {
  if (start === null || end === null) {
    return null;
  }
  return roundToThreeDecimals(end - start);
}

function toMegabytes(bytes) {
  return roundToThreeDecimals(bytes / (1024 * 1024));
}

function roundToThreeDecimals(value) {
  return Math.round(value * 1000) / 1000;
}

function formatNumber(value) {
  return value === null ? "n/a" : value.toFixed(3);
}

async function startStaticServer(rootDir) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decodedPathname = decodeURIComponent(requestUrl.pathname);
      const relativePath = decodedPathname === "/" ? "index.html" : decodedPathname.slice(1);
      const resolvedPath = path.resolve(rootDir, relativePath);

      if (!resolvedPath.startsWith(rootDir)) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }

      const fileStats = await stat(resolvedPath);
      if (!fileStats.isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not Found");
        return;
      }

      const body = await readFile(resolvedPath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": readContentType(resolvedPath),
      });
      response.end(body);
    } catch (error) {
      const code = error?.code === "ENOENT" ? 404 : 500;
      response.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(code === 404 ? "Not Found" : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address for Web performance gate.");
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}/`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

function readContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".map":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function readJsonFile(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function assertPathExists(targetPath, message) {
  try {
    await stat(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(message, { cause: error });
    }
    throw error;
  }
}
