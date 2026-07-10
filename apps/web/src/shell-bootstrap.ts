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
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  type GameSessionProjectionBasisV1,
  type GameSessionRenderEntityV1,
  type GameSessionSelectionDetailV1,
  type GameSessionUiResourceV1,
} from "@wuming-town/sim-protocol";
import {
  createShellHudElement,
  createShellStore,
  getEntityTile,
  type ShellOnboardingState,
  type ShellLocaleState,
  type ShellReleaseGateInfo,
  type ShellStorageActions,
  type ShellStorageGateState,
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
  createWebGameSessionProjectionAssembler,
  type WebGameSessionFrameUpdate,
  type WebGameSessionProjectionFrame,
} from "./playable-worker-projection";
import { createShellSettingsController, readDiagnosticsVisibility } from "./shell-locale";
import {
  createWebSimulationWorkerSession,
  readWebGameSessionRenderProjection,
  readWebGameSessionUiProjection,
  startWebGameSession,
} from "./simulation-worker-session";
import type { WebStorageDebugState } from "./web-storage-gate";

interface ProjectedGameSessionDebugState {
  readonly basis: GameSessionProjectionBasisV1;
  readonly jobMarkerCount: number;
  readonly renderEntities: readonly {
    readonly entityId: string;
    readonly kind: GameSessionRenderEntityV1["kind"];
  }[];
  readonly projectionSource: "game-session-worker";
  readonly renderEntityCount: number;
  readonly residentCount: number;
  readonly resourceCount: number;
  readonly selectionDetailKind: GameSessionSelectionDetailV1["kind"] | null;
  readonly selectedResource?: {
    readonly available: number;
    readonly reserved: number;
    readonly resourceKind: GameSessionUiResourceV1["resourceKind"];
    readonly total: number;
  };
}

interface ShellStorageController {
  readonly actions: ShellStorageActions;
  readDebugState(): WebStorageDebugState;
  refresh(): Promise<void>;
}

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
  let historicalStorageModule: typeof import("./web-storage-gate") | undefined;
  if (diagnosticsVisible) {
    historicalStorageModule = await import("./web-storage-gate");
  }
  const workerSession = createWebSimulationWorkerSession({
    sessionId: "wm0165-web-game-session",
  });
  const initialReadModel = createGameSessionLifecycleReadModel(
    workerSession.sessionId,
    "connecting",
  );
  const releaseGate = await readShellReleaseGateInfo(diagnosticsVisible);
  const recentStructuredErrors: M6DiagnosticEntryInput[] = [];
  let diagnosticState = createInitialDiagnosticDebugState(platformPorts.host);
  const gameSessionAssembler = createWebGameSessionProjectionAssembler();
  let gameSessionFrame: WebGameSessionProjectionFrame | undefined;
  let gameSessionFailure: { readonly code: string; readonly detail: string } | undefined;
  let gameSessionLifecycle = workerSession.getState();
  let localSelectionInitialized = false;
  let initialCameraFramed = false;
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
    storageGate:
      historicalStorageModule?.createInitialStorageGateState() ??
      createUnsupportedGameSessionStorageState(),
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
  const storageController: ShellStorageController =
    historicalStorageModule === undefined
      ? createUnsupportedGameSessionStorageController()
      : historicalStorageModule.createWebStorageGateController({
          onStorageGateStateChange: () => {
            const activeRenderer = rendererRef.current;
            if (activeRenderer === undefined) return;
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
        if (
          !initialCameraFramed &&
          gameSessionFrame !== undefined &&
          nextState.inspectedTile !== undefined
        ) {
          activeRenderer.frameInitialView(nextState.inspectedTile, 2);
          initialCameraFramed = true;
        }
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

function createProjectedGameSessionDebugState(
  frame: WebGameSessionProjectionFrame,
): ProjectedGameSessionDebugState {
  const selectedResource =
    frame.ui.selectionDetail?.kind === "resource" ? frame.ui.selectionDetail.resource : undefined;
  return {
    basis: frame.basis,
    jobMarkerCount: frame.ui.jobs.length,
    projectionSource: "game-session-worker",
    renderEntities: frame.render.entities.map((entity) => ({
      entityId: `${String(entity.entity.index)}:${String(entity.entity.generation)}`,
      kind: entity.kind,
    })),
    renderEntityCount: frame.render.entities.length,
    residentCount: frame.ui.residents.length,
    resourceCount: frame.ui.resources.length,
    selectionDetailKind: frame.ui.selectionDetail?.kind ?? null,
    ...(selectedResource === undefined
      ? {}
      : {
          selectedResource: {
            available: selectedResource.available,
            reserved: selectedResource.reserved,
            resourceKind: selectedResource.resourceKind,
            total: selectedResource.total,
          },
        }),
  };
}

function syncDebug(
  debugState: PixiWorldRendererDebugState,
  shellState: Pick<ShellState, "diagnosticsVisible" | "locale" | "releaseGate" | "uiScale">,
  gameSessionState: ProjectedGameSessionDebugState | undefined,
  gameSessionLifecycle: string,
  gameSessionFailure: { readonly code: string; readonly detail: string } | undefined,
  platformHost: PlatformHostInfo,
  storageGate: WebStorageDebugState,
  diagnostics: WebDiagnosticDebugState,
): void {
  const releaseGate = shellState.releaseGate;
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

async function readShellReleaseGateInfo(
  diagnosticsVisible: boolean,
): Promise<ShellReleaseGateInfo> {
  const browserLabel = readBrowserLabel(navigator.userAgent);
  if (diagnosticsVisible) {
    const { createShellReleaseGateInfo } = await import("./product-gate-harness");
    return createShellReleaseGateInfo({
      browserLabel,
      crossOriginIsolated: window.crossOriginIsolated,
    });
  }
  return {
    fixtureId: "pr1-game-session-worker",
    title: "PR-1 GameSession",
    browserTargets: ["Chrome Stable", "Edge Stable"],
    runtimeBrowser: browserLabel,
    runtimeCrossOriginIsolated: window.crossOriginIsolated,
    sections: [
      {
        label: "Authority",
        value: "Simulation Worker",
        detail: "Schema-v3 GameSession projection v1; Web is a read-only presentation consumer.",
      },
      {
        label: "Save",
        value: "Authoritative restore unsupported",
        detail: "Local shell evidence does not restore runtime state, jobs, resources, or time.",
      },
    ],
  };
}

function readBrowserLabel(userAgent: string): string {
  if (userAgent.includes("Edg/")) return "Edge-family browser";
  if (userAgent.includes("Chrome/")) return "Chrome-family browser";
  return "Unknown browser shell";
}

function createUnsupportedGameSessionStorageState(): ShellStorageGateState {
  return {
    diagnostic: undefined,
    interoperabilityDetail:
      "No reviewed GameSession runtime snapshot bridge exists for Web or Windows.",
    interoperabilityVerdict: "blocked",
    lastActionLabel: "Authoritative restore unavailable",
    quotaAvailableBytes: null,
    quotaBytes: null,
    saveId: "game-session-runtime-unsupported",
    saveSlots: [],
    scopeNote: "Default gameplay does not load historical gate envelopes as town state.",
    statusDetail: "Authoritative GameSession save/load is outside the reviewed PR-1 contract.",
    statusTone: "warning",
    storageKindLabel: "Runtime restore unavailable",
    usageBytes: null,
    userMessage: "No gameplay runtime was saved or restored.",
  };
}

function createUnsupportedGameSessionStorageController(): ShellStorageController {
  const noAction = (): Promise<void> => Promise.resolve();
  return {
    actions: {
      onDeleteSave: noAction,
      onExportSave: noAction,
      onImportFile: noAction,
      onLoadSave: noAction,
      onRefreshStorage: noAction,
      onSaveFixture: noAction,
    },
    readDebugState(): WebStorageDebugState {
      return {
        diagnosticCode: "game_session_runtime_restore_unsupported",
        interoperabilityVerdict: "blocked",
        lastActionLabel: "Authoritative restore unavailable",
        quotaAvailableBytes: null,
        quotaBytes: null,
        saveSlotCount: 0,
        statusTone: "warning",
        storageKindLabel: "Runtime restore unavailable",
        usageBytes: null,
      };
    },
    refresh: noAction,
  };
}
