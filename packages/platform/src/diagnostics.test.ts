import { describe, expect, it } from "vitest";

import {
  buildM6DiagnosticPackage,
  serializeM6DiagnosticPackage,
  type M6DiagnosticPackageInput,
} from "./index";

const BASE_INPUT: M6DiagnosticPackageInput = {
  blockers: [
    {
      code: "windows_host_diagnostics_bridge_blocked",
      impact: "Windows host file package is blocked for M6 until a reviewed bridge exists.",
      message: "Renderer-local diagnostic package remains available.",
    },
  ],
  build: {
    appVersion: "0.0.0",
    gitCommit: "runtime-not-embedded",
    taskId: "WM-0093",
  },
  generatedAtUnixMs: 1_797_981_120_000,
  hashes: {
    commandStreamHash: "0x81d37435",
    contentManifestHash: "0xe55d3015",
    finalReadModelHash: "0x9ba83cb7",
    m4RegressionReadModelHash: "0xce261d9d",
  },
  packagePath: {
    suggestedFileName: "wuming-town-m6-diagnostics.json",
    webDownloadAvailable: true,
    windowsHostPackageAvailable: false,
  },
  platform: {
    browserTargets: ["Chrome Stable", "Edge Stable"],
    crossOriginIsolated: false,
    host: {
      contextIsolation: false,
      kind: "web",
      nodeIntegration: false,
      sandboxedRenderer: false,
    },
    runtimeBrowser: "Chrome-family browser",
  },
  recentErrors: [
    {
      code: "quota_exceeded",
      detail: {
        authorizationHeader: "Bearer should-not-leak",
        localPath: "C:\\Users\\Beacon\\Documents\\save.wtsave",
        saveContents: '{"full":"save"}',
        slotCount: 1,
      },
      level: "warning",
      message:
        "OPFS quota failed near C:\\Users\\Beacon\\Documents\\save.wtsave with token=abc123.",
      timestampUnixMs: 1_797_981_120_001,
    },
  ],
  safeLogs: [
    {
      code: "shell_ready",
      detail: {
        canvasHeight: 900,
        canvasWidth: 1440,
        selectedEntityId: "lantern-keeper-shen",
      },
      level: "info",
      message: "M6 product gate shell ready.",
      timestampUnixMs: 1_797_981_120_002,
    },
  ],
  scenario: {
    finalTick: 100000,
    fixtureId: "wm-0086-web-product-gate",
    scenarioId: "m5.alpha_content_framework.first_season.v1",
  },
};

describe("M6 local diagnostic package", () => {
  it("captures product-gate evidence without telemetry or host file access", () => {
    const pkg = buildM6DiagnosticPackage(BASE_INPUT);

    expect(pkg).toMatchObject({
      packageKind: "m6-local-diagnostic-package",
      privacy: {
        includesFullSaveContents: false,
        includesPrivatePaths: false,
        networkUpload: false,
        telemetry: false,
      },
      schemaVersion: 1,
    });
    expect(pkg.hashes).toStrictEqual({
      commandStreamHash: "0x81d37435",
      contentManifestHash: "0xe55d3015",
      finalReadModelHash: "0x9ba83cb7",
      m4RegressionReadModelHash: "0xce261d9d",
    });
    expect(pkg.scenario).toMatchObject({
      finalTick: 100000,
      fixtureId: "wm-0086-web-product-gate",
      scenarioId: "m5.alpha_content_framework.first_season.v1",
    });
    expect(pkg.packagePath.webDownload.status).toBe("available");
    expect(pkg.packagePath.windowsHostFilePackage.status).toBe("blocked");
    expect(pkg.blockers.map((blocker) => blocker.code)).toContain(
      "windows_host_diagnostics_bridge_blocked",
    );
  });

  it("redacts local paths, secrets and full-save-like fields", () => {
    const pkg = buildM6DiagnosticPackage(BASE_INPUT);
    const serialized = serializeM6DiagnosticPackage(pkg);

    expect(serialized).not.toContain("C:\\Users");
    expect(serialized).not.toContain("Beacon");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("Bearer should-not-leak");
    expect(serialized).not.toContain('{"full":"save"}');
    expect(serialized).toContain("[redacted-path]");
    expect(serialized).toContain("[redacted-secret]");
    expect(serialized).toContain("[redacted-unsafe-field]");
  });
});
