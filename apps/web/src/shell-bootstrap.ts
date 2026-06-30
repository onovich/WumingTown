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
  getEntityTile,
  type ShellOnboardingState,
  type ShellLocaleState,
  type ShellPlayableActionState,
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
import {
  createProjectedPlayableDebugState,
  createReviewedPlayableProjectionSession,
} from "./reviewed-playable-session";
import { createShellReleaseGateInfo, readShellBrowserLabel } from "./product-gate-harness";
import { createShellSettingsController, readDiagnosticsVisibility } from "./shell-locale";
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
  readonly playable?: ReturnType<typeof createProjectedPlayableDebugState>;
  readonly playableAction?: ShellPlayableActionState;
  readonly runtimeBrowser: string;
  readonly runtimeCrossOriginIsolated: boolean;
  readonly storageGate: WebStorageDebugState;
  readonly uiScale: {
    readonly factor: number;
    readonly persistenceDiagnosticCode: string;
    readonly persistenceMode: string;
    readonly preference: string;
  };
}

export interface MountedWebShell {
  destroy(): Promise<void>;
}

export async function mountWebClientShell(rootElement: HTMLElement): Promise<MountedWebShell> {
  prepareDocumentChrome();
  const platformPorts = resolvePlatformPorts();
  const settingsController = createShellSettingsController();
  const diagnosticsVisible = readDiagnosticsVisibility(window.location.search);
  const playableSession = createReviewedPlayableProjectionSession();
  const initialPlayableSnapshot = playableSession.readSnapshot();
  const initialReadModel = initialPlayableSnapshot.readModel;
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

  const settingsState = settingsController.readState();
  applyDocumentLocale(settingsState.locale);
  document.body.dataset["uiScale"] = settingsState.uiScale.preference;
  const initialState: ShellState = {
    readModel: initialReadModel,
    releaseGate,
    storageGate: createInitialStorageGateState(),
    onboarding: createM8OnboardingState(),
    locale: settingsState.locale,
    uiScale: settingsState.uiScale,
    diagnosticsVisible,
    canvasWidth: Math.max(shellFrame.clientWidth, 1),
    canvasHeight: Math.max(shellFrame.clientHeight, 1),
    zoom: 1,
    lastInputLabel: "Booting shell",
    selectedEntityId: initialReadModel.selectedEntityId,
    inspectedTile: getEntityTile(initialReadModel, initialReadModel.selectedEntityId),
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
        createProjectedPlayableDebugState(playableSession.readSnapshot()),
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
    createShellHudElement(
      store,
      storageController.actions,
      {
        async onUseManualLocale(locale): Promise<void> {
          await settingsController.actions.onUseManualLocale(locale);
          syncSettingsState();
        },
        async onUseSystemLocale(): Promise<void> {
          await settingsController.actions.onUseSystemLocale();
          syncSettingsState();
        },
        async onUseUiScale(scale): Promise<void> {
          await settingsController.actions.onUseUiScale(scale);
          syncSettingsState();
        },
      },
      {
        onPrioritizeLampWork(targetEntityId: string): Promise<void> {
          const currentState = store.getSnapshot();
          const playableAction = playableSession.queuePrioritizeLampWork(targetEntityId);
          const nextState: ShellState = {
            ...currentState,
            lastInputLabel: `Action queued ${playableAction.commandId}`,
            playableAction,
          };
          store.setState(nextState);
          syncRendererProjection(nextState);
          return Promise.resolve();
        },
        onQueueSimpleBuild(targetEntityId: string): Promise<void> {
          const currentState = store.getSnapshot();
          const playableAction = playableSession.queueSimpleBuild(targetEntityId);
          const nextState: ShellState = {
            ...currentState,
            lastInputLabel: `Action queued ${playableAction.commandId}`,
            playableAction,
          };
          store.setState(nextState);
          syncRendererProjection(nextState);
          return Promise.resolve();
        },
      },
    ),
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
    inputTarget: shellFrame,
    readModel: initialReadModel,
    selectedEntityId: initialReadModel.selectedEntityId,
    shouldIgnoreInputTarget: (target) => shouldIgnoreCameraInputTarget(target, hudHost),
    onSelectionChange(entityId: string | undefined, inputLabel: string, inspectedTile): void {
      const currentState = store.getSnapshot();
      store.setState({
        ...currentState,
        inspectedTile,
        lastInputLabel: inputLabel,
        selectedEntityId: entityId,
      });
      const activeRenderer = rendererRef.current;
      if (activeRenderer !== undefined) {
        syncDebug(
          activeRenderer.readDebugState(),
          store.getSnapshot(),
          createProjectedPlayableDebugState(playableSession.readSnapshot()),
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
        inspectedTile: nextRendererState.inspectedTile,
        lastInputLabel: nextRendererState.lastInputLabel,
        selectedEntityId: nextRendererState.selectedEntityId,
        zoom: nextRendererState.zoom,
      });
      const activeRenderer = rendererRef.current;
      if (activeRenderer !== undefined) {
        syncDebug(
          activeRenderer.readDebugState(),
          store.getSnapshot(),
          createProjectedPlayableDebugState(playableSession.readSnapshot()),
          platformPorts.host,
          storageController.readDebugState(),
          diagnosticState,
        );
      }
    },
  });
  rendererRef.current = renderer;
  void storageController.refresh();
  const unsubscribePlayableSession = playableSession.subscribe(() => {
    syncRendererProjection(store.getSnapshot());
  });

  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = Math.max(shellFrame.clientWidth, 1);
    const nextHeight = Math.max(shellFrame.clientHeight, 1);
    renderer.resize(nextWidth, nextHeight, readDevicePixelRatio());
    syncDebug(
      renderer.readDebugState(),
      store.getSnapshot(),
      createProjectedPlayableDebugState(playableSession.readSnapshot()),
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
    createProjectedPlayableDebugState(playableSession.readSnapshot()),
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
      createProjectedPlayableDebugState(playableSession.readSnapshot()),
      platformPorts.host,
      storageController.readDebugState(),
      diagnosticState,
    );
  }

  function syncSettingsState(): void {
    const currentState = store.getSnapshot();
    const nextSettingsState = settingsController.readState();
    applyDocumentLocale(nextSettingsState.locale);
    document.body.dataset["uiScale"] = nextSettingsState.uiScale.preference;
    const nextState = {
      ...currentState,
      locale: nextSettingsState.locale,
      uiScale: nextSettingsState.uiScale,
    };
    store.setState(nextState);
    const activeRenderer = rendererRef.current;
    if (activeRenderer !== undefined) {
      syncDebug(
        activeRenderer.readDebugState(),
        nextState,
        createProjectedPlayableDebugState(playableSession.readSnapshot()),
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
  }

  function syncRendererProjection(currentState: ShellState): void {
    const playableSnapshot = playableSession.readSnapshot(currentState.selectedEntityId);
    const nextReadModel = playableSnapshot.readModel;
    const nextState: ShellState = {
      ...currentState,
      inspectedTile:
        currentState.selectedEntityId === undefined
          ? currentState.inspectedTile
          : getEntityTile(nextReadModel, currentState.selectedEntityId),
      ...(playableSnapshot.latestCommand === undefined
        ? {}
        : {
            playableAction: playableSnapshot.latestCommand,
          }),
      readModel: nextReadModel,
    };
    store.setState(nextState);
    const activeRenderer = rendererRef.current;
    if (activeRenderer !== undefined) {
      activeRenderer.setReadModel(nextReadModel);
      syncDebug(
        activeRenderer.readDebugState(),
        nextState,
        createProjectedPlayableDebugState(playableSnapshot),
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
  }

  return {
    async destroy(): Promise<void> {
      unsubscribePlayableSession();
      playableSession.destroy();
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

function shouldIgnoreCameraInputTarget(target: EventTarget | null, hudHost: HTMLElement): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target === hudHost) {
    return false;
  }

  if (target.closest("[data-testid='world-canvas']") !== null) {
    return false;
  }

  if (
    target.closest(
      "button,input,select,textarea,a,[role='button'],[data-ui-slot],[data-testid='main-menu-panel'],[data-testid='locale-settings'],[data-testid='ui-scale-settings'],[data-testid='storage-panel']",
    ) !== null
  ) {
    return true;
  }

  return false;
}

function syncDebug(
  debugState: PixiWorldRendererDebugState,
  shellState: Pick<ShellState, "diagnosticsVisible" | "locale" | "playableAction" | "uiScale">,
  playableState: ReturnType<typeof createProjectedPlayableDebugState>,
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
    uiScale: {
      factor: shellState.uiScale.factor,
      persistenceDiagnosticCode: shellState.uiScale.persistence.diagnosticCode,
      persistenceMode: shellState.uiScale.persistence.mode,
      preference: shellState.uiScale.preference,
    },
    platformHost,
    playable: playableState,
    ...(shellState.playableAction === undefined
      ? {}
      : { playableAction: shellState.playableAction }),
    runtimeBrowser: releaseGate.runtimeBrowser,
    runtimeCrossOriginIsolated: releaseGate.runtimeCrossOriginIsolated,
    storageGate,
  };
  const debugNode = document.getElementById("wm-shell-debug");
  if (debugNode !== null) {
    debugNode.textContent = JSON.stringify(debugPayload);
  }
}
