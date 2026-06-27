/// <reference lib="dom" />

import { createRoot } from "react-dom/client";

import {
  resolvePlatformPorts,
  type M6DiagnosticEntryInput,
  type PlatformHostInfo,
} from "@wuming-town/platform";
import {
  createPixiWorldRenderer,
  type PixiWorldRendererDebugState,
} from "@wuming-town/renderer-pixi";
import {
  createShellHudElement,
  createShellStore,
  type ShellOnboardingState,
  type ShellState,
} from "@wuming-town/ui-react";

import {
  buildShellDiagnosticPackage,
  createDiagnosticDock,
  createInitialDiagnosticDebugState,
  readDiagnosticDebugState,
  readUnknownReason,
  recordStructuredError,
  triggerDiagnosticDownload,
  type WebDiagnosticDebugState,
} from "./diagnostic-package-gate";
import { createShellReleaseGateInfo, readShellBrowserLabel } from "./product-gate-harness";
import { WEB_SHELL_SMOKE_READ_MODEL } from "./smoke-read-model";
import {
  createInitialStorageGateState,
  createWebStorageGateController,
  type WebStorageDebugState,
} from "./web-storage-gate";

export interface WebShellDebugPayload extends PixiWorldRendererDebugState {
  readonly browserTargets: readonly string[];
  readonly diagnostics: WebDiagnosticDebugState;
  readonly fixtureId: string;
  readonly platformHost: PlatformHostInfo;
  readonly runtimeBrowser: string;
  readonly runtimeCrossOriginIsolated: boolean;
  readonly storageGate: WebStorageDebugState;
}

export interface MountedWebShell {
  destroy(): Promise<void>;
}

export async function mountWebClientShell(rootElement: HTMLElement): Promise<MountedWebShell> {
  prepareDocumentChrome();
  const platformPorts = resolvePlatformPorts();
  const releaseGate = createShellReleaseGateInfo({
    browserLabel: readShellBrowserLabel(navigator.userAgent),
    crossOriginIsolated: window.crossOriginIsolated,
  });
  const recentStructuredErrors: M6DiagnosticEntryInput[] = [];
  let diagnosticState = createInitialDiagnosticDebugState(platformPorts.host);

  const shellFrame = document.createElement("div");
  shellFrame.style.cssText =
    "position:fixed;inset:0;overflow:hidden;background:linear-gradient(180deg,#120f0b 0%,#1a1712 100%);";

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:absolute;inset:0;";

  const hudHost = document.createElement("div");
  hudHost.style.cssText = "position:absolute;inset:0;";

  const rendererRef: {
    current: Awaited<ReturnType<typeof createPixiWorldRenderer>> | undefined;
  } = {
    current: undefined,
  };

  shellFrame.append(canvasHost, hudHost);
  rootElement.replaceChildren(shellFrame);

  const initialState: ShellState = {
    readModel: WEB_SHELL_SMOKE_READ_MODEL,
    releaseGate,
    storageGate: createInitialStorageGateState(),
    onboarding: createM7OnboardingState(),
    canvasWidth: Math.max(shellFrame.clientWidth, 1),
    canvasHeight: Math.max(shellFrame.clientHeight, 1),
    zoom: 1,
    lastInputLabel: "Booting shell",
    selectedEntityId: WEB_SHELL_SMOKE_READ_MODEL.selectedEntityId,
    hoverTile: undefined,
  };
  const store = createShellStore(initialState);
  const storageController = createWebStorageGateController({
    onStorageGateStateChange: () => {
      const activeRenderer = rendererRef.current;
      if (activeRenderer === undefined) {
        return;
      }

      syncDebug(
        activeRenderer.readDebugState(),
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    },
    platformPorts,
    store,
  });
  const diagnosticDock = createDiagnosticDock();
  diagnosticDock.button.addEventListener("click", () => {
    exportDiagnostics();
  });
  diagnosticDock.update(diagnosticState);
  shellFrame.append(diagnosticDock.element);
  const reactRoot = createRoot(hudHost);
  reactRoot.render(createShellHudElement(store, storageController.actions));
  const windowErrorListener = (event: ErrorEvent): void => {
    recordStructuredError(recentStructuredErrors, "window_error", {
      message: event.message,
    });
  };
  const unhandledRejectionListener = (event: PromiseRejectionEvent): void => {
    recordStructuredError(recentStructuredErrors, "unhandled_rejection", {
      message: readUnknownReason(event.reason),
    });
  };
  window.addEventListener("error", windowErrorListener);
  window.addEventListener("unhandledrejection", unhandledRejectionListener);

  const renderer = await createPixiWorldRenderer({
    container: canvasHost,
    readModel: WEB_SHELL_SMOKE_READ_MODEL,
    selectedEntityId: WEB_SHELL_SMOKE_READ_MODEL.selectedEntityId,
    onSelectionChange(entityId: string | undefined, inputLabel: string): void {
      const currentState = store.getSnapshot();
      store.setState({
        ...currentState,
        lastInputLabel: inputLabel,
        selectedEntityId: entityId,
      });
      const activeRenderer = rendererRef.current;
      if (activeRenderer !== undefined) {
        syncDebug(
          activeRenderer.readDebugState(),
          platformPorts.host,
          storageController.readDebugState(),
          diagnosticState,
        );
      }
    },
    onStateChange(nextRendererState): void {
      const currentState = store.getSnapshot();
      store.setState({
        ...currentState,
        canvasWidth: nextRendererState.canvasWidth,
        canvasHeight: nextRendererState.canvasHeight,
        hoverTile: nextRendererState.hoverTile,
        lastInputLabel: nextRendererState.lastInputLabel,
        selectedEntityId: nextRendererState.selectedEntityId,
        zoom: nextRendererState.zoom,
      });
      const activeRenderer = rendererRef.current;
      if (activeRenderer !== undefined) {
        syncDebug(
          activeRenderer.readDebugState(),
          platformPorts.host,
          storageController.readDebugState(),
          diagnosticState,
        );
      }
    },
  });
  rendererRef.current = renderer;
  void storageController.refresh();

  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = Math.max(shellFrame.clientWidth, 1);
    const nextHeight = Math.max(shellFrame.clientHeight, 1);
    renderer.resize(nextWidth, nextHeight, readDevicePixelRatio());
    syncDebug(
      renderer.readDebugState(),
      platformPorts.host,
      storageController.readDebugState(),
      diagnosticState,
    );
  });
  resizeObserver.observe(shellFrame);

  renderer.resize(shellFrame.clientWidth, shellFrame.clientHeight, readDevicePixelRatio());
  syncDebug(
    renderer.readDebugState(),
    platformPorts.host,
    storageController.readDebugState(),
    diagnosticState,
  );

  function exportDiagnostics(): void {
    const activeRenderer = rendererRef.current;
    if (activeRenderer === undefined) {
      recordStructuredError(recentStructuredErrors, "diagnostic_renderer_unavailable", {
        message: "Renderer debug state was unavailable during diagnostic export.",
      });
      diagnosticState = {
        ...diagnosticState,
        lastActionLabel: "Diagnostic export failed",
        lastPackageStatus: "error",
        recentErrorCount: recentStructuredErrors.length,
      };
      diagnosticDock.update(diagnosticState);
      return;
    }

    const diagnosticPackage = buildShellDiagnosticPackage({
      platformHost: platformPorts.host,
      recentStructuredErrors,
      rendererDebug: activeRenderer.readDebugState(),
      storageGate: storageController.readDebugState(),
    });
    triggerDiagnosticDownload(diagnosticPackage);
    diagnosticState = readDiagnosticDebugState(diagnosticPackage, "Diagnostic package exported");
    diagnosticDock.update(diagnosticState);
    syncDebug(
      activeRenderer.readDebugState(),
      platformPorts.host,
      storageController.readDebugState(),
      diagnosticState,
    );
  }

  return {
    async destroy(): Promise<void> {
      window.removeEventListener("error", windowErrorListener);
      window.removeEventListener("unhandledrejection", unhandledRejectionListener);
      resizeObserver.disconnect();
      reactRoot.unmount();
      await renderer.destroy();
      rootElement.replaceChildren();
    },
  };
}

function createM7OnboardingState(): ShellOnboardingState {
  return {
    authorityBoundary: "read-model-only",
    copyLimits: [
      "Copy limit: explains existing M5/M6 surfaces only; no M8 tutorial volume.",
      "Release limit: Web remains demo-only; Windows remains unsigned controlled external test.",
      "Privacy limit: no telemetry, accounts, paid service, crash upload or public feedback flow.",
      "Save limit: public save compatibility remains draft/gated until owner approval.",
    ],
    releaseBoundary: "web-demo-windows-controlled-test",
    scopeLabel: "External test briefing",
    steps: [
      {
        body: "Confirm shell ready, select a resident, use keyboard pan/zoom and read speed/time labels before interpreting outcomes.",
        id: "launch-input-time",
        title: "Launch, movement, input, time control",
      },
      {
        body: "Inspect current job, current step, needs, thoughts and decision text before changing the plan.",
        id: "residents-work-hauling-building",
        title: "Residents, work, hauling and building",
      },
      {
        body: "Use Web OPFS save/export/import and local diagnostic download; Windows host save and diagnostic bridges remain blocked.",
        id: "saving-diagnostics",
        title: "Saving and diagnostics",
      },
      {
        body: "Read warning/stable alerts, lantern corridor gap and night-risk cues as current evidence, not final balance.",
        id: "events-lamps",
        title: "Events and lamps",
      },
      {
        body: "Treat hypotheses, confirmed rules and temporary policies as source-backed knowledge rather than hidden truth.",
        id: "chronicle-rules-evidence",
        title: "Chronicle, town rules and evidence",
      },
      {
        body: "When work, pathing, rules or storage fail, look for reason codes and details before retrying or reporting.",
        id: "structured-failure-explanations",
        title: "Structured failure explanations",
      },
    ],
    summary:
      "Follow launch, movement/input, time control, residents/work, hauling/building, saving, events, lamps, Chronicle, town rules, evidence and structured reasons.",
    title: "M7 first-run path",
  };
}

function prepareDocumentChrome(): void {
  document.body.style.margin = "0";
  document.body.style.background = "#120f0b";
  document.body.style.color = "#f7eed7";
  document.body.style.fontFamily = "Inter, system-ui, sans-serif";
  document.body.style.overflow = "hidden";
}

function readDevicePixelRatio(): number {
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
}

function syncDebug(
  debugState: PixiWorldRendererDebugState,
  platformHost: PlatformHostInfo,
  storageGate: WebStorageDebugState,
  diagnostics: WebDiagnosticDebugState,
): void {
  const releaseGate = createShellReleaseGateInfo({
    browserLabel: readShellBrowserLabel(navigator.userAgent),
    crossOriginIsolated: window.crossOriginIsolated,
  });
  const debugPayload: WebShellDebugPayload = {
    ...debugState,
    browserTargets: releaseGate.browserTargets,
    diagnostics,
    fixtureId: releaseGate.fixtureId,
    platformHost,
    runtimeBrowser: releaseGate.runtimeBrowser,
    runtimeCrossOriginIsolated: releaseGate.runtimeCrossOriginIsolated,
    storageGate,
  };
  const debugNode = document.getElementById("wm-shell-debug");
  if (debugNode !== null) {
    debugNode.textContent = JSON.stringify(debugPayload);
  }
}
