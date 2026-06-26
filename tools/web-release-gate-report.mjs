import { gzipSync } from "node:zlib";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import harnessData from "../apps/web/src/product-gate-harness.data.json" with { type: "json" };

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DIST_DIR = path.join(REPO_ROOT, "apps", "desktop-electron", "dist", "renderer");
const REPORT_PATH = path.join(DIST_DIR, harnessData.buildReportFileName);

const files = await collectFiles(DIST_DIR);
const fileSummaries = [];
let totalBytes = 0;
let totalEstimatedGzipBytes = 0;
let runtimeDeliverableBytes = 0;
let runtimeDeliverableEstimatedGzipBytes = 0;

for (const filePath of files) {
  const relativePath = path.relative(DIST_DIR, filePath).replaceAll("\\", "/");
  const fileBytes = await readFile(filePath);
  const rawBytes = fileBytes.byteLength;
  const gzipBytes = gzipSync(fileBytes).byteLength;
  const isSourceMap = relativePath.endsWith(".map");
  totalBytes += rawBytes;
  totalEstimatedGzipBytes += gzipBytes;
  if (!isSourceMap) {
    runtimeDeliverableBytes += rawBytes;
    runtimeDeliverableEstimatedGzipBytes += gzipBytes;
  }
  fileSummaries.push({
    relativePath,
    rawBytes,
    estimatedGzipBytes: gzipBytes,
    sourceMap: isSourceMap,
  });
}

fileSummaries.sort((left, right) => right.rawBytes - left.rawBytes);

const report = {
  harnessId: harnessData.fixtureId,
  fixture: {
    label: harnessData.fixtureLabel,
    mapWidth: harnessData.mapWidth,
    mapHeight: harnessData.mapHeight,
    visibleActors: harnessData.visibleActors,
    targetActiveActors: harnessData.targetActiveActors,
    targetTotalEntities: harnessData.targetTotalEntities,
  },
  evidence: {
    primary: harnessData.primaryEvidence,
    regression: harnessData.regressionEvidence,
    strategyPaths: harnessData.strategyPaths,
  },
  browserTargets: harnessData.browserTargets,
  buildAssumptions: {
    bundleBudgetMb: harnessData.bundleBudgetMb,
    assetPolicy: harnessData.assetPolicy,
    authorityBoundary: harnessData.authorityBoundary,
    expectedHeadersForSharedArrayBuffer: harnessData.expectedHeaders,
    fallbackWithoutIsolation: harnessData.sabFallback,
    gzipEstimateNote:
      "estimatedGzipBytes is a local gzip proxy for release-gate tracking, not a CDN guarantee.",
    bundleComparisonNote:
      "Use runtimeDeliverableEstimatedGzipBytes for the Web download budget; sourcemaps stay in the internal artifact set.",
  },
  output: {
    distDir: path.relative(REPO_ROOT, DIST_DIR).replaceAll("\\", "/"),
    fileCount: fileSummaries.length,
    totalRawBytes: totalBytes,
    totalEstimatedGzipBytes,
    runtimeDeliverableBytes,
    runtimeDeliverableEstimatedGzipBytes,
    files: fileSummaries,
  },
};

await mkdir(DIST_DIR, { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  [
    `Web release-gate report: ${path.relative(REPO_ROOT, REPORT_PATH).replaceAll("\\", "/")}`,
    `fixture=${harnessData.fixtureId}`,
    `rawBytes=${String(totalBytes)}`,
    `estimatedGzipBytes=${String(totalEstimatedGzipBytes)}`,
    `runtimeEstimatedGzipBytes=${String(runtimeDeliverableEstimatedGzipBytes)}`,
  ].join(" | "),
);

async function collectFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      const entryStats = await stat(entryPath);
      if (entryStats.size > 0) {
        files.push(entryPath);
      }
    }
  }

  return files;
}
