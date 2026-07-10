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
import { SIMULATION_TO_MAIN_MESSAGE_KIND } from "@wuming-town/sim-protocol";
import {
  createShellHudElement,
  createShellStore,
  getEntityTile,
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
import {
  createGameSessionLifecycleReadModel,
  createGameSessionWorldReadModel,
  createProjectedGameSessionDebugState,
  createWebGameSessionProjectionAssembler,
  type ProjectedGameSessionDebugState,
  type WebGameSessionFrameUpdate,
  type WebGameSessionProjectionFrame,
} from "./playable-worker-projection";
import { createShellReleaseGateInfo, readShellBrowserLabel } from "./product-gate-harness";
import { createShellSettingsController, readDiagnosticsVisibility } from "./shell-locale";
import {
  createWebSimulationWorkerSession,
  readWebGameSessionRenderProjection,
  readWebGameSessionUiProjection,
  startWebGameSession,
} from "./simulation-worker-session";
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
  readonly gameSession?: ProjectedGameSessionDebugState;
  readonly gameSessionFailure?: {
    readonly code: string;
    readonly detail: string;
  };
  readonly gameSessionLifecycle: string;
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
  const workerSession = createWebSimulationWorkerSession({
    sessionId: "wm0165-web-game-session",
  });
  const initialReadModel = createGameSessionLifecycleReadModel(
    workerSession.sessionId,
    "connecting",
  );
  const releaseGate = createShellReleaseGateInfo({
    browserLabel: readShellBrowserLabel(navigator.userAgent),
    crossOriginIsolated: window.crossOriginIsolated,
  });
  const recentStructuredErrors: M6DiagnosticEntryInput[] = [];
  let diagnosticState = createInitialDiagnosticDebugState(platformPorts.host);
  const gameSessionAssembler = createWebGameSessionProjectionAssembler();
  let gameSessionFrame: WebGameSessionProjectionFrame | undefined;
  let gameSessionFailure: { readonly code: string; readonly detail: string } | undefined;
  let gameSessionLifecycle = workerSession.getState();
  let localSelectionInitialized = false;
  let lastRequestedSelectionId: string | null | undefined;

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
  let isSyncingRendererProjection = false;
  let isDestroyed = false;

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
    selectedEntityId: undefined,
    inspectedTile: undefined,
    hoverTile: undefined,
    buildMode: "inactive",
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
        readGameSessionDebugState(),
        gameSessionLifecycle,
        gameSessionFailure,
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
        onPrioritizeLampWork: rejectUnavailablePr1Command,
        onQueueSimpleBuild: rejectUnavailablePr1Command,
        onSetBuildMode: () => Promise.resolve(),
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
    shouldIgnoreInputTarget: (target) => shouldIgnoreCameraInputTarget(target, hudHost),
    onSelectionChange(entityId: string | undefined, inputLabel: string, inspectedTile): void {
      localSelectionInitialized = true;
      const currentState = store.getSnapshot();
      store.setState({
        ...currentState,
        inspectedTile,
        lastInputLabel: inputLabel,
        selectedEntityId: entityId,
      });
      const activeRenderer = rendererRef.current;
      if (activeRenderer !== undefined && !isSyncingRendererProjection) {
        syncRendererProjection(store.getSnapshot());
      }
      requestGameSessionSelectionDetail(entityId);
    },
    onStateChange(nextRendererState): void {
      const currentState = store.getSnapshot();
      const nextState = {
        ...currentState,
        canvasWidth: nextRendererState.canvasWidth,
        canvasHeight: nextRendererState.canvasHeight,
        hoverTile: nextRendererState.hoverTile,
        inspectedTile: nextRendererState.inspectedTile,
        lastInputLabel: nextRendererState.lastInputLabel,
        selectedEntityId: nextRendererState.selectedEntityId,
        zoom: nextRendererState.zoom,
      } satisfies ShellState;
      store.setState(nextState);
      const activeRenderer = rendererRef.current;
      if (activeRenderer !== undefined && !isSyncingRendererProjection) {
        syncRendererProjection(nextState);
      }
    },
  });
  rendererRef.current = renderer;
  void storageController.refresh();
  const unsubscribeWorkerSession = workerSession.subscribe((message) => {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError) {
      failGameSession(message.payload.reason.code, message.payload.reason.detail);
      return;
    }
    const renderProjection = readWebGameSessionRenderProjection(message);
    if (renderProjection !== undefined) {
      consumeGameSessionFrameUpdate(gameSessionAssembler.pushRender(renderProjection));
      return;
    }
    const uiProjection = readWebGameSessionUiProjection(message);
    if (uiProjection !== undefined) {
      consumeGameSessionFrameUpdate(gameSessionAssembler.pushUi(uiProjection));
    }
  });
  const unsubscribeWorkerLifecycle = workerSession.subscribeLifecycle((event) => {
    gameSessionLifecycle = event.state;
    const activeRenderer = rendererRef.current;
    if (activeRenderer !== undefined) {
      syncDebug(
        activeRenderer.readDebugState(),
        store.getSnapshot(),
        readGameSessionDebugState(),
        gameSessionLifecycle,
        gameSessionFailure,
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
  });
  startWebGameSession(workerSession);

  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = Math.max(shellFrame.clientWidth, 1);
    const nextHeight = Math.max(shellFrame.clientHeight, 1);
    renderer.resize(nextWidth, nextHeight, readDevicePixelRatio());
    syncDebug(
      renderer.readDebugState(),
      store.getSnapshot(),
      readGameSessionDebugState(),
      gameSessionLifecycle,
      gameSessionFailure,
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
    readGameSessionDebugState(),
    gameSessionLifecycle,
    gameSessionFailure,
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
      readGameSessionDebugState(),
      gameSessionLifecycle,
      gameSessionFailure,
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
        readGameSessionDebugState(),
        gameSessionLifecycle,
        gameSessionFailure,
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
  }

  function readGameSessionDebugState(): ProjectedGameSessionDebugState | undefined {
    return gameSessionFrame === undefined
      ? undefined
      : createProjectedGameSessionDebugState(gameSessionFrame);
  }

  function consumeGameSessionFrameUpdate(update: WebGameSessionFrameUpdate): void {
    if (update.status === "pending") {
      return;
    }
    if (update.status === "invalid") {
      failGameSession("InvalidPayload", update.detail);
      return;
    }
    if (workerSession.getState() !== "active") {
      failGameSession("LifecycleError", "GameSession projection arrived before exact Ready");
      return;
    }
    gameSessionFrame = update.frame;
    gameSessionFailure = undefined;
    syncRendererProjection(store.getSnapshot());
  }

  function syncRendererProjection(currentState: ShellState): void {
    const nextReadModel =
      gameSessionFrame === undefined
        ? createGameSessionLifecycleReadModel(
            workerSession.sessionId,
            gameSessionFailure === undefined ? "connecting" : "fatal",
            gameSessionFailure?.detail,
          )
        : createGameSessionWorldReadModel({
            frame: gameSessionFrame,
            selectedEntityId: localSelectionInitialized
              ? (currentState.selectedEntityId ?? null)
              : currentState.selectedEntityId,
          });
    const nextSelectedEntityId =
      nextReadModel.selectedEntityId.length === 0 ? undefined : nextReadModel.selectedEntityId;
    const nextState: ShellState = {
      ...currentState,
      inspectedTile: getEntityTile(nextReadModel, nextSelectedEntityId),
      readModel: nextReadModel,
      selectedEntityId: nextSelectedEntityId,
    };
    store.setState(nextState);
    if (gameSessionFrame !== undefined) {
      localSelectionInitialized = true;
    }
    const activeRenderer = rendererRef.current;
    if (activeRenderer !== undefined) {
      isSyncingRendererProjection = true;
      try {
        activeRenderer.setReadModel(nextReadModel);
        activeRenderer.setSelectedEntityId(nextSelectedEntityId);
      } finally {
        isSyncingRendererProjection = false;
      }
      syncDebug(
        activeRenderer.readDebugState(),
        nextState,
        readGameSessionDebugState(),
        gameSessionLifecycle,
        gameSessionFailure,
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
    requestGameSessionSelectionDetail(nextSelectedEntityId);
  }

  function requestGameSessionSelectionDetail(entityId: string | undefined): void {
    const requestKey = entityId ?? null;
    if (workerSession.getState() !== "active" || requestKey === lastRequestedSelectionId) {
      return;
    }
    lastRequestedSelectionId = requestKey;
    workerSession.requestUiDetail({
      subject: entityId === undefined ? { kind: "session" } : { kind: "entity", entityId },
    });
  }

  function failGameSession(code: string, detail: string): void {
    gameSessionFailure = { code, detail };
    gameSessionFrame = undefined;
    gameSessionAssembler.reset();
    gameSessionLifecycle = "fatal";
    recordStructuredError(recentStructuredErrors, "game_session_fatal", { message: detail });
    if (workerSession.getState() !== "fatal" && workerSession.getState() !== "destroyed") {
      workerSession.destroy();
      gameSessionLifecycle = "fatal";
    }
    syncRendererProjection(store.getSnapshot());
  }

  function rejectUnavailablePr1Command(): Promise<void> {
    recordStructuredError(recentStructuredErrors, "game_session_command_unavailable", {
      message: "PR-1 GameSession does not expose lamp or build commands.",
    });
    return Promise.resolve();
  }

  async function teardownMountedShell(): Promise<void> {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;

    window.removeEventListener("pagehide", pageHideListener);
    unsubscribeWorkerSession();
    unsubscribeWorkerLifecycle();
    workerSession.destroy();
    window.removeEventListener("error", windowErrorListener);
    window.removeEventListener("unhandledrejection", unhandledRejectionListener);
    resizeObserver.disconnect();
    reactRoot.unmount();
    await renderer.destroy();
    rootElement.replaceChildren();
  }

  const pageHideListener = (): void => {
    void teardownMountedShell();
  };
  window.addEventListener("pagehide", pageHideListener, { once: true });

  return {
    async destroy(): Promise<void> {
      await teardownMountedShell();
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
  shellState: Pick<ShellState, "diagnosticsVisible" | "locale" | "uiScale">,
  gameSessionState: ProjectedGameSessionDebugState | undefined,
  gameSessionLifecycle: string,
  gameSessionFailure: { readonly code: string; readonly detail: string } | undefined,
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
    ...(gameSessionState === undefined ? {} : { gameSession: gameSessionState }),
    ...(gameSessionFailure === undefined ? {} : { gameSessionFailure }),
    gameSessionLifecycle,
    runtimeBrowser: releaseGate.runtimeBrowser,
    runtimeCrossOriginIsolated: releaseGate.runtimeCrossOriginIsolated,
    storageGate,
  };
  const debugNode = document.getElementById("wm-shell-debug");
  if (debugNode !== null) {
    debugNode.textContent = JSON.stringify(debugPayload);
  }
}
