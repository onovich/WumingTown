/// <reference lib="dom" />

import {
  buildM6DiagnosticPackage,
  encodeM6DiagnosticPackage,
  type M6DiagnosticEntryInput,
  type M6DiagnosticPackage,
  type PlatformHostInfo,
} from "@wuming-town/platform";
import type { PixiWorldRendererDebugState } from "@wuming-town/renderer-pixi";

import {
  WEB_PRODUCT_GATE_HARNESS,
  createShellReleaseGateInfo,
  readShellBrowserLabel,
} from "./product-gate-harness";
import type { WebStorageDebugState } from "./web-storage-gate";

export interface WebDiagnosticDebugState {
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

export function createInitialDiagnosticDebugState(
  platformHost: PlatformHostInfo,
): WebDiagnosticDebugState {
  const blockerCodes =
    platformHost.kind === "electron" ? ["windows_host_diagnostics_bridge_blocked"] : [];

  return {
    blockerCodes,
    lastActionLabel: "Diagnostics idle",
    lastPackageStatus: "idle",
    networkUploadEnabled: false,
    packageKind: "m6-local-diagnostic-package",
    recentErrorCount: 0,
    safeLogCount: 0,
    suggestedFileName: "wuming-town-m6-diagnostics.json",
    telemetryEnabled: false,
    webDownloadStatus: "available",
    windowsHostPackageStatus: "blocked",
  };
}

export function buildShellDiagnosticPackage(input: {
  readonly platformHost: PlatformHostInfo;
  readonly recentStructuredErrors: readonly M6DiagnosticEntryInput[];
  readonly rendererDebug: PixiWorldRendererDebugState;
  readonly storageGate: WebStorageDebugState;
}): M6DiagnosticPackage {
  const releaseGate = createShellReleaseGateInfo({
    browserLabel: readShellBrowserLabel(navigator.userAgent),
    crossOriginIsolated: window.crossOriginIsolated,
  });
  const generatedAtUnixMs = Date.now();

  return buildM6DiagnosticPackage({
    blockers: [
      {
        code: "windows_host_diagnostics_bridge_blocked",
        impact:
          "Windows host file diagnostics remain blocked until a reviewed narrow diagnostics bridge exists.",
        message:
          "Renderer-local diagnostic package is available; broad filesystem or IPC access is not exposed.",
      },
    ],
    build: {
      appVersion: "0.0.0",
      gitCommit: "runtime-not-embedded",
      taskId: "WM-0093",
    },
    generatedAtUnixMs,
    hashes: {
      commandStreamHash: WEB_PRODUCT_GATE_HARNESS.primaryEvidence.commandStreamHash ?? "invalid",
      contentManifestHash: WEB_PRODUCT_GATE_HARNESS.primaryEvidence.contentHash ?? "invalid",
      finalReadModelHash: WEB_PRODUCT_GATE_HARNESS.primaryEvidence.finalReadModelHash,
      m4RegressionReadModelHash: WEB_PRODUCT_GATE_HARNESS.regressionEvidence.finalReadModelHash,
    },
    packagePath: {
      suggestedFileName: "wuming-town-m6-diagnostics.json",
      webDownloadAvailable: true,
      windowsHostPackageAvailable: false,
    },
    platform: {
      browserTargets: releaseGate.browserTargets,
      crossOriginIsolated: releaseGate.runtimeCrossOriginIsolated,
      host: input.platformHost,
      runtimeBrowser: releaseGate.runtimeBrowser,
    },
    recentErrors: input.recentStructuredErrors,
    safeLogs: [
      {
        code: "shell_ready",
        detail: {
          canvasHeight: input.rendererDebug.canvasHeight,
          canvasWidth: input.rendererDebug.canvasWidth,
          selectedEntityId: input.rendererDebug.selectedEntityId,
        },
        level: "info",
        message: "M6 product gate shell ready.",
        timestampUnixMs: generatedAtUnixMs,
      },
      {
        code: "storage_gate",
        detail: {
          interoperabilityVerdict: input.storageGate.interoperabilityVerdict,
          lastActionLabel: input.storageGate.lastActionLabel,
          saveSlotCount: input.storageGate.saveSlotCount,
          storageKindLabel: input.storageGate.storageKindLabel,
        },
        level: "info",
        message: "M6 storage gate diagnostic summary.",
        timestampUnixMs: generatedAtUnixMs,
      },
    ],
    scenario: {
      finalTick: WEB_PRODUCT_GATE_HARNESS.primaryEvidence.finalTick,
      fixtureId: WEB_PRODUCT_GATE_HARNESS.fixtureId,
      scenarioId: WEB_PRODUCT_GATE_HARNESS.primaryEvidence.scenarioId,
    },
  });
}

export function readDiagnosticDebugState(
  diagnosticPackage: M6DiagnosticPackage,
  lastActionLabel: string,
): WebDiagnosticDebugState {
  return {
    blockerCodes: diagnosticPackage.blockers.map((blocker) => blocker.code),
    lastActionLabel,
    lastPackageStatus:
      diagnosticPackage.packagePath.webDownload.status === "available" ? "exported" : "blocked",
    networkUploadEnabled: diagnosticPackage.privacy.networkUpload,
    packageKind: diagnosticPackage.packageKind,
    recentErrorCount: diagnosticPackage.recentErrors.length,
    safeLogCount: diagnosticPackage.safeLogs.length,
    suggestedFileName: diagnosticPackage.packagePath.suggestedFileName,
    telemetryEnabled: diagnosticPackage.privacy.telemetry,
    webDownloadStatus:
      diagnosticPackage.packagePath.webDownload.status === "available" ? "available" : "blocked",
    windowsHostPackageStatus:
      diagnosticPackage.packagePath.windowsHostFilePackage.status === "available"
        ? "available"
        : "blocked",
  };
}

export function recordStructuredError(
  recentStructuredErrors: M6DiagnosticEntryInput[],
  code: string,
  detail: Readonly<Record<string, unknown>>,
): void {
  recentStructuredErrors.push({
    code,
    detail,
    level: "error",
    message:
      typeof detail["message"] === "string"
        ? detail["message"]
        : "A renderer diagnostic event was captured.",
    timestampUnixMs: Date.now(),
  });

  if (recentStructuredErrors.length > 16) {
    recentStructuredErrors.shift();
  }
}

export function readUnknownReason(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === "string") {
    return reason;
  }

  return "Unknown promise rejection reason.";
}

export function triggerDiagnosticDownload(diagnosticPackage: M6DiagnosticPackage): void {
  const bytes = encodeM6DiagnosticPackage(diagnosticPackage);
  const blob = new Blob([cloneBytes(bytes)], {
    type: "application/vnd.wuming-town.m6-diagnostics+json",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = diagnosticPackage.packagePath.suggestedFileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function createDiagnosticDock(): {
  readonly button: HTMLButtonElement;
  readonly element: HTMLElement;
  update(state: WebDiagnosticDebugState): void;
} {
  const element = document.createElement("section");
  element.setAttribute("aria-label", "Local diagnostics");
  element.style.cssText =
    "position:absolute;left:16px;top:132px;z-index:4;display:flex;align-items:center;gap:8px;pointer-events:auto;background:rgba(18,15,11,0.88);border:1px solid rgba(232,206,151,0.18);border-radius:8px;padding:8px 10px;box-shadow:0 10px 24px rgba(0,0,0,0.24);";

  const button = document.createElement("button");
  button.dataset["testid"] = "diagnostic-export-button";
  button.style.cssText =
    "background:#ead4a0;border:none;border-radius:6px;color:#1a1712;cursor:pointer;font-family:Inter,system-ui,sans-serif;font-size:12px;font-weight:700;padding:8px 10px;";
  button.textContent = "Diagnostics";
  button.type = "button";

  const status = document.createElement("div");
  status.dataset["testid"] = "diagnostic-status";
  status.style.cssText =
    "color:#d8cfbc;font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:16px;max-width:220px;";

  element.append(button, status);

  return {
    button,
    element,
    update(state: WebDiagnosticDebugState): void {
      status.dataset["diagnosticStatus"] = state.lastPackageStatus;
      status.textContent = `${state.lastActionLabel} | ${state.windowsHostPackageStatus.toUpperCase()}`;
    },
  };
}

function cloneBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
