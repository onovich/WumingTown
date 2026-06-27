#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

const EXPECTED_M5_WORLD_HASH = "0xfba70a5c";
const EXPECTED_M5_READ_MODEL_HASH = "0x9ba83cb7";
const EXPECTED_M5_SCENARIO_ID = "m5.alpha_content_framework.first_season.v1";
const EXPECTED_WEB_HARNESS_ID = "wm-0086-web-product-gate";
const EXPECTED_BENCHMARK_BASELINE_PATH = "packages/benchmarks/baseline.json";
const EXPECTED_BENCHMARK_ARTIFACT_PATH =
  "coordination/artifacts/WM-0095/benchmarks/benchmark-results.json";
const EXPECTED_WARN_REGRESSION_PERCENT = 10;
const EXPECTED_FAIL_REGRESSION_PERCENT = 20;

const options = readOptions(process.argv.slice(2));
const benchmarkReport = await readJson(options.benchmarkReportPath);
const webReleaseReport = await readJson(options.webReleaseReportPath);
const webPerformanceReport = await readJson(options.webPerformanceReportPath);
const desktopPackageReport = await readJson(options.desktopPackageReportPath);
const smokeReportText = await readFile(options.smokeReportPath, "utf8");

const benchmarkSummary = readBenchmarkSummary(benchmarkReport);
const webReleaseSummary = readWebReleaseSummary(webReleaseReport);
const webPerformanceSummary = readWebPerformanceSummary(webPerformanceReport);
const desktopPackageSummary = readDesktopPackageSummary(desktopPackageReport);
const smokeCoverage = readSmokeCoverage(smokeReportText);

const reportPayload = {
  schemaVersion: 1,
  taskId: "WM-0095",
  generatedAt: new Date().toISOString(),
  sourceArtifacts: {
    benchmarkReportPath: toRelativePath(options.benchmarkReportPath),
    webReleaseReportPath: toRelativePath(options.webReleaseReportPath),
    webPerformanceReportPath: toRelativePath(options.webPerformanceReportPath),
    desktopPackageReportPath: toRelativePath(options.desktopPackageReportPath),
    smokeReportPath: toRelativePath(options.smokeReportPath),
  },
  acceptance: {
    headlessWorkerWebWindowsEvidence: true,
    m5HashesProtected: true,
    benchmarkThresholdsUnchanged: true,
    saveImportExportEvidenceRecorded: true,
    diagnosticEvidenceRecorded: true,
    noM7Work: true,
    noPublicReleaseUploadSigningOrTelemetry: true,
  },
  benchmark: benchmarkSummary,
  webBuild: webReleaseSummary,
  webPerformance: webPerformanceSummary,
  windowsPackage: desktopPackageSummary,
  smokeCoverage,
  verdictInputs: {
    m6ProductGateEvidenceReadyForDecision: true,
    webSameSpecPassProven: false,
    webSameSpecBlocker:
      "Current Web evidence is a product-gate shell and Worker projection path, not a measured 30 TPS / 20k-entity browser authority runtime.",
    windowsExternalTestBuildReady: true,
    unresolvedBlockers: [
      "Windows/Web save-container interoperability remains blocked until a reviewed desktop save bridge exists.",
      "Windows host-side diagnostic package writing remains blocked until a reviewed narrow diagnostics bridge exists.",
    ],
  },
};

const output = {
  ...reportPayload,
  hashing: {
    schemaVersion: 1,
    canonicalPayloadSha256: sha256(`${JSON.stringify(reportPayload, undefined, 2)}\n`),
    canonicalPayloadDescription:
      "SHA-256 of the WM-0095 consolidation payload before hashing metadata is added.",
    artifactFileSha256Path: toRelativePath(`${options.outputPath}.sha256`),
    artifactFileSha256Description:
      "Actual SHA-256 of m6-product-gate-consolidation.json after hashing metadata is added.",
  },
};

const outputText = `${JSON.stringify(output, undefined, 2)}\n`;
await mkdir(path.dirname(options.outputPath), { recursive: true });
await writeFile(options.outputPath, outputText, "utf8");
await writeFile(
  `${options.outputPath}.sha256`,
  `${sha256(outputText)}  ${path.basename(options.outputPath)}\n`,
  "utf8",
);

console.log(`M6 product-gate consolidation report: ${toRelativePath(options.outputPath)}`);
console.log(
  [
    `bench=${benchmarkSummary.failedCount === 0 ? "pass" : "fail"}`,
    `warnings=${String(benchmarkSummary.warningCount)}`,
    `m5World=${benchmarkSummary.m5.finalWorldHash}`,
    `m5Read=${benchmarkSummary.m5.finalReadModelHash}`,
    `webRuntimeGzip=${String(webReleaseSummary.runtimeDeliverableEstimatedGzipBytes)}`,
    `desktopBytes=${String(desktopPackageSummary.totalBytes)}`,
  ].join(" | "),
);

function readOptions(args) {
  const defaults = {
    benchmarkReportPath: path.resolve(
      process.cwd(),
      "coordination",
      "artifacts",
      "WM-0095",
      "benchmarks",
      "benchmark-results.json",
    ),
    webReleaseReportPath: path.resolve(
      process.cwd(),
      "apps",
      "desktop-electron",
      "dist",
      "renderer",
      "wm-release-gate-report.json",
    ),
    webPerformanceReportPath: path.resolve(
      process.cwd(),
      "coordination",
      "artifacts",
      "WM-0095",
      "web-performance-gate.json",
    ),
    desktopPackageReportPath: path.resolve(
      process.cwd(),
      "dist",
      "desktop",
      "wm-desktop-package-report.json",
    ),
    smokeReportPath: path.resolve(process.cwd(), "coordination", "reports", "WM-0094.md"),
    outputPath: path.resolve(
      process.cwd(),
      "coordination",
      "artifacts",
      "WM-0095",
      "m6-product-gate-consolidation.json",
    ),
  };

  const optionReaders = {
    "--benchmark-report": "benchmarkReportPath",
    "--web-release-report": "webReleaseReportPath",
    "--web-performance-report": "webPerformanceReportPath",
    "--desktop-package-report": "desktopPackageReportPath",
    "--smoke-report": "smokeReportPath",
    "--output": "outputPath",
  };
  const parsed = { ...defaults };

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const property = optionReaders[key];
    if (property === undefined) {
      throw new Error(`Unsupported argument ${String(key)}.`);
    }

    const value = args[index + 1];
    if (value === undefined || value.length === 0) {
      throw new Error(`${key} requires a path.`);
    }

    parsed[property] = path.resolve(process.cwd(), value);
    index += 1;
  }

  return parsed;
}

function readBenchmarkSummary(report) {
  assertEqual(report.baselinePath, EXPECTED_BENCHMARK_BASELINE_PATH, "benchmark baseline path");
  assertEqual(report.artifactPath, EXPECTED_BENCHMARK_ARTIFACT_PATH, "benchmark artifact path");

  const results = requireArray(report.results, "benchmark results");
  const summaries = results.map(readBenchmarkResultSummary);
  const failed = summaries.filter((result) => result.status === "fail");
  const warnings = summaries.filter((result) => result.status === "warn");

  if (failed.length > 0) {
    throw new Error(`Benchmark comparison failed: ${failed.map((item) => item.name).join(", ")}`);
  }

  const m5 = readM5BenchmarkSummary(results);
  return {
    artifactPath: requireString(report.artifactPath, "benchmark artifactPath"),
    sampleCount: requireNumber(report.sampleCount, "benchmark sampleCount"),
    warmupCount: requireNumber(report.warmupCount, "benchmark warmupCount"),
    gitCommit: requireString(
      requireRecord(report.environment, "benchmark environment").gitCommit,
      "benchmark environment gitCommit",
    ),
    resultCount: summaries.length,
    failedCount: failed.length,
    warningCount: warnings.length,
    warningNames: warnings.map((result) => result.name),
    results: summaries,
    m5,
  };
}

function readBenchmarkResultSummary(result) {
  const record = requireRecord(result, "benchmark result");
  const name = requireString(record.name, "benchmark result name");
  const comparison = requireRecord(record.comparison, `${name} comparison`);
  const status = requireString(comparison.status, `${name} comparison status`);
  const invariantMismatches = requireArray(
    comparison.invariantMismatches,
    `${name} invariant mismatches`,
  );

  if (status !== "ok" && status !== "warn" && status !== "fail") {
    throw new Error(`Unsupported benchmark status ${status} for ${name}.`);
  }

  if (invariantMismatches.length > 0) {
    throw new Error(`${name} reported invariant mismatches: ${invariantMismatches.join(", ")}`);
  }

  assertEqual(
    comparison.warnRegressionPercent,
    EXPECTED_WARN_REGRESSION_PERCENT,
    `${name} warning threshold`,
  );
  assertEqual(
    comparison.failRegressionPercent,
    EXPECTED_FAIL_REGRESSION_PERCENT,
    `${name} failure threshold`,
  );

  return {
    name,
    status,
    medianElapsedMs: requireNumber(
      comparison.actualMedianElapsedMs,
      `${name} actual median elapsed`,
    ),
    baselineMedianElapsedMs: requireNumber(
      comparison.baselineMedianElapsedMs,
      `${name} baseline median elapsed`,
    ),
    regressionPercent: requireNumber(comparison.regressionPercent, `${name} regression percent`),
  };
}

function readM5BenchmarkSummary(results) {
  const result = results.find(
    (candidate) =>
      requireRecord(candidate, "benchmark result").name === "m5-alpha-content-long-run",
  );
  if (result === undefined) {
    throw new Error("Missing m5-alpha-content-long-run benchmark result.");
  }

  const record = requireRecord(result, "m5 benchmark result");
  const report = requireRecord(record.report, "m5 benchmark report");
  const invariants = requireRecord(record.invariants, "m5 benchmark invariants");
  assertEqual(invariants.scenarioId, EXPECTED_M5_SCENARIO_ID, "M5 scenario id");
  assertEqual(invariants.finalWorldHash, EXPECTED_M5_WORLD_HASH, "M5 final world hash");
  assertEqual(invariants.finalReadModelHash, EXPECTED_M5_READ_MODEL_HASH, "M5 read-model hash");

  const protectedBooleans = [
    "replayMatches",
    "saveRoundTripMatches",
    "workerProjectionMatches",
    "noContentValidationDrift",
    "noAnomalyLeaks",
    "noFactionGovernanceHiddenAuthority",
    "noEventQueueGrowth",
    "noM0ToM4Regression",
    "noQueueGrowth",
    "noHashDivergence",
  ];
  for (const key of protectedBooleans) {
    assertEqual(invariants[key], true, `M5 invariant ${key}`);
  }
  assertEqual(invariants.m6Created, false, "M5 benchmark m6Created stop sign");

  return {
    scenarioId: requireString(invariants.scenarioId, "M5 scenario id"),
    requestedSeed: requireString(invariants.requestedSeed, "M5 requested seed"),
    scenarioSeed: requireString(invariants.scenarioSeed, "M5 scenario seed"),
    finalTick: requireNumber(invariants.finalTick, "M5 final tick"),
    finalWorldHash: requireString(invariants.finalWorldHash, "M5 final world hash"),
    finalReadModelHash: requireString(invariants.finalReadModelHash, "M5 final read-model hash"),
    contentManifestHash: requireString(invariants.contentManifestHash, "M5 content hash"),
    commandStreamHash: requireString(invariants.commandStreamHash, "M5 command stream hash"),
    saveLoadRebuildTimeMs: requireNumber(report.saveLoadRebuildTimeMs, "M5 save/load rebuild time"),
    workerProjectionBytes: requireNumber(
      invariants.workerProjectionBytes,
      "M5 Worker projection bytes",
    ),
    workerProjectionHash: requireString(
      invariants.workerProjectionHash,
      "M5 Worker projection hash",
    ),
    m6StopSignVerdict: requireString(invariants.m6StopSignVerdict, "M5 M6 stop-sign verdict"),
  };
}

function readWebReleaseSummary(report) {
  assertEqual(report.harnessId, EXPECTED_WEB_HARNESS_ID, "Web harness id");
  const fixture = requireRecord(report.fixture, "Web fixture");
  const output = requireRecord(report.output, "Web output");
  const assumptions = requireRecord(report.buildAssumptions, "Web assumptions");
  const evidence = requireRecord(report.evidence, "Web evidence");
  const primary = requireRecord(evidence.primary, "Web primary evidence");
  const browsers = requireArray(report.browserTargets, "Web browser targets").map((target) =>
    requireString(requireRecord(target, "Web browser target").browser, "Web browser"),
  );

  if (!browsers.includes("Chrome Stable") || !browsers.includes("Edge Stable")) {
    throw new Error("Web release-gate report must include Chrome Stable and Edge Stable targets.");
  }

  assertEqual(primary.scenarioId, EXPECTED_M5_SCENARIO_ID, "Web primary scenario");
  assertEqual(primary.finalReadModelHash, EXPECTED_M5_READ_MODEL_HASH, "Web primary read hash");

  const runtimeGzip = requireNumber(
    output.runtimeDeliverableEstimatedGzipBytes,
    "Web runtime gzip bytes",
  );
  const bundleBudgetMb = requireNumber(assumptions.bundleBudgetMb, "Web bundle budget");
  if (runtimeGzip <= 0 || runtimeGzip > bundleBudgetMb * 1024 * 1024) {
    throw new Error("Web runtime deliverable size is outside the recorded bundle budget.");
  }

  return {
    harnessId: requireString(report.harnessId, "Web harness id"),
    fixtureLabel: requireString(fixture.label, "Web fixture label"),
    targetActiveActors: requireNumber(fixture.targetActiveActors, "Web target active actors"),
    targetTotalEntities: requireNumber(fixture.targetTotalEntities, "Web target total entities"),
    distDir: requireString(output.distDir, "Web dist dir"),
    runtimeDeliverableBytes: requireNumber(
      output.runtimeDeliverableBytes,
      "Web runtime deliverable bytes",
    ),
    runtimeDeliverableEstimatedGzipBytes: runtimeGzip,
    bundleBudgetBytes: bundleBudgetMb * 1024 * 1024,
    browserTargets: browsers,
    authorityBoundary: requireString(assumptions.authorityBoundary, "Web authority boundary"),
    fallbackWithoutIsolation: requireString(
      assumptions.fallbackWithoutIsolation,
      "Web SAB fallback",
    ),
  };
}

function readWebPerformanceSummary(report) {
  const browsers = requireArray(report.browsers, "Web performance browsers").map(
    readBrowserPerformanceSummary,
  );
  const browserNames = browsers.map((browser) => browser.browser);

  if (!browserNames.includes("Chrome Stable") || !browserNames.includes("Edge Stable")) {
    throw new Error("Web performance report must include Chrome Stable and Edge Stable.");
  }

  return {
    browserCount: requireNumber(report.browserCount, "Web performance browser count"),
    options: requireRecord(report.options, "Web performance options"),
    browsers,
  };
}

function readBrowserPerformanceSummary(value) {
  const browser = requireRecord(value, "browser performance");
  const debug = requireRecord(browser.debug, "browser debug");
  const navigation = requireRecord(browser.navigation, "browser navigation");
  const interactions = requireRecord(browser.interactions, "browser interactions");
  const frameStats = requireRecord(browser.frameStats, "browser frame stats");
  const memory = requireRecord(browser.memory, "browser memory");

  assertEqual(debug.fixtureId, EXPECTED_WEB_HARNESS_ID, "browser fixture id");
  if (requireNumber(interactions.sampleCount, "interaction sample count") <= 0) {
    throw new Error("Browser performance report must include interaction samples.");
  }
  if (requireNumber(frameStats.frameSampleCount, "frame sample count") <= 0) {
    throw new Error("Browser performance report must include frame samples.");
  }
  if (requireNumber(memory.sampleCount, "memory sample count") <= 0) {
    throw new Error("Browser performance report must include memory samples.");
  }

  return {
    browser: requireString(browser.browser, "browser name"),
    fixtureId: requireString(debug.fixtureId, "browser fixture id"),
    runtimeCrossOriginIsolated: requireBoolean(
      debug.runtimeCrossOriginIsolated,
      "browser cross-origin isolated",
    ),
    visibleEntityCount: requireNumber(debug.visibleEntityCount, "browser visible entity count"),
    shellReadyMs: requireNumber(navigation.shellReadyMs, "browser shell-ready ms"),
    requestCount: requireNumber(navigation.requestCount, "browser request count"),
    interactionP95Ms: nullableNumber(interactions.latencyP95Ms, "browser interaction p95"),
    frameDeltaP95Ms: nullableNumber(frameStats.frameDeltaP95Ms, "browser frame p95"),
    longTaskCount: requireNumber(frameStats.longTaskCount, "browser long task count"),
    jsHeapStartMb: nullableNumber(memory.jsHeapStartMb, "browser heap start"),
    jsHeapEndMb: nullableNumber(memory.jsHeapEndMb, "browser heap end"),
    jsHeapPeakMb: nullableNumber(memory.jsHeapPeakMb, "browser heap peak"),
    jsHeapDeltaMb: nullableNumber(memory.jsHeapDeltaMb, "browser heap delta"),
  };
}

function readDesktopPackageSummary(report) {
  assertEqual(report.packageKind, "windows-unpacked-directory", "desktop package kind");
  assertEqual(report.taskId, "WM-0090", "desktop package source task");
  const security = requireRecord(report.securityBoundary, "desktop security boundary");
  assertEqual(security.contextIsolation, true, "desktop contextIsolation");
  assertEqual(security.nodeIntegration, false, "desktop nodeIntegration");
  assertEqual(security.sandbox, true, "desktop sandbox");
  assertEqual(
    security.simulationAuthority,
    "simulation-worker-or-headless",
    "desktop simulation authority",
  );

  return {
    packageKind: requireString(report.packageKind, "desktop package kind"),
    artifactPath: requireString(report.artifactPath, "desktop artifact path"),
    executablePath: requireString(report.executablePath, "desktop executable path"),
    totalBytes: requireNumber(report.totalBytes, "desktop total bytes"),
    fileCount: requireNumber(report.fileCount, "desktop file count"),
    contentSha256Hex: requireString(report.contentSha256Hex, "desktop package digest"),
    securityBoundary: security,
    knownWarnings: requireArray(report.knownWarnings, "desktop known warnings").map((warning) =>
      requireString(requireRecord(warning, "desktop warning").code, "desktop warning code"),
    ),
  };
}

function readSmokeCoverage(text) {
  const normalizedText = text.replace(/\s+/gu, " ");
  for (const token of [
    "save/export/import",
    "diagnostic download",
    "Windows diagnostics blocker",
    "M5 product-gate surfaces",
  ]) {
    if (!normalizedText.includes(token)) {
      throw new Error(`WM-0094 smoke report is missing expected token: ${token}`);
    }
  }

  return {
    sourceTask: "WM-0094",
    webLaunchSaveImportExportInputDiagnostics: true,
    desktopLaunchSandboxInputDiagnostics: true,
    m5ProductGateSurfaceVisible: true,
    windowsHostDiagnosticsBridgeStatus: "blocked-by-reviewed-WM-0093-boundary",
    windowsSaveInteroperabilityStatus: "blocked-by-reviewed-WM-0088-boundary",
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function requireRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function requireNumber(value, label) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number.`);
  }

  return value;
}

function nullableNumber(value, label) {
  if (value === null) {
    return null;
  }

  return requireNumber(value, label);
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${String(expected)} but found ${String(actual)}.`);
  }
}

function toRelativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}
