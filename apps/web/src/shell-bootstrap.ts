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
  type ShellLocaleState,
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
import { createShellLocaleController, readDiagnosticsVisibility } from "./shell-locale";
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
  readonly locale: {
    readonly diagnosticsVisible: boolean;
    readonly manualLocale: string | null;
    readonly persistenceDiagnosticCode: string;
    readonly persistenceMode: string;
    readonly resolvedLocale: string;
    readonly source: string;
    readonly systemLocale: string;
  };
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
  const localeController = createShellLocaleController();
  const diagnosticsVisible = readDiagnosticsVisibility(window.location.search);
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

  applyDocumentLocale(localeController.readState());
  const initialState: ShellState = {
    readModel: WEB_SHELL_SMOKE_READ_MODEL,
    releaseGate,
    storageGate: createInitialStorageGateState(),
    onboarding: createM8OnboardingState(),
    locale: localeController.readState(),
    diagnosticsVisible,
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
        store.getSnapshot(),
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
  if (diagnosticsVisible) {
    shellFrame.append(diagnosticDock.element);
  }
  const reactRoot = createRoot(hudHost);
  reactRoot.render(
    createShellHudElement(store, storageController.actions, {
      async onUseManualLocale(locale): Promise<void> {
        await localeController.actions.onUseManualLocale(locale);
        syncLocaleState();
      },
      async onUseSystemLocale(): Promise<void> {
        await localeController.actions.onUseSystemLocale();
        syncLocaleState();
      },
    }),
  );
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
          store.getSnapshot(),
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
          store.getSnapshot(),
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
      store.getSnapshot(),
      platformPorts.host,
      storageController.readDebugState(),
      diagnosticState,
    );
  });
  resizeObserver.observe(shellFrame);

  renderer.resize(shellFrame.clientWidth, shellFrame.clientHeight, readDevicePixelRatio());
  syncDebug(
    renderer.readDebugState(),
    store.getSnapshot(),
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
      store.getSnapshot(),
      platformPorts.host,
      storageController.readDebugState(),
      diagnosticState,
    );
  }

  function syncLocaleState(): void {
    const currentState = store.getSnapshot();
    const localeState = localeController.readState();
    applyDocumentLocale(localeState);
    const nextState = {
      ...currentState,
      locale: localeState,
    };
    store.setState(nextState);
    const activeRenderer = rendererRef.current;
    if (activeRenderer !== undefined) {
      syncDebug(
        activeRenderer.readDebugState(),
        nextState,
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
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

function applyDocumentLocale(localeState: ShellLocaleState): void {
  document.documentElement.lang = localeState.resolvedLocale;
  document.documentElement.dir = "ltr";
  document.body.dataset["locale"] = localeState.resolvedLocale;
}

function createM8OnboardingState(): ShellOnboardingState {
  return {
    authorityBoundary: "read-model-only",
    releaseBoundary: "web-demo-windows-controlled-test",
  };
}

function prepareDocumentChrome(): void {
  document.body.style.margin = "0";
  document.body.style.background = "#120f0b";
  document.body.style.color = "#f7eed7";
  document.body.style.fontFamily = '"Noto Sans SC", "Segoe UI", sans-serif';
  document.body.style.overflow = "hidden";
}

function readDevicePixelRatio(): number {
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
}

function syncDebug(
  debugState: PixiWorldRendererDebugState,
  shellState: Pick<ShellState, "diagnosticsVisible" | "locale">,
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
    locale: {
      diagnosticsVisible: shellState.diagnosticsVisible,
      manualLocale: shellState.locale.manualLocale ?? null,
      persistenceDiagnosticCode: shellState.locale.persistence.diagnosticCode,
      persistenceMode: shellState.locale.persistence.mode,
      resolvedLocale: shellState.locale.resolvedLocale,
      source: shellState.locale.source,
      systemLocale: shellState.locale.systemLocale,
    },
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
