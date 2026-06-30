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
import type {
  CommandBlockedReason,
  CommandResultMessage,
  ProtocolRejection,
  PrioritizeLampWorkPayload,
  QueueSimpleBuildPayload,
} from "@wuming-town/sim-protocol";
import {
  createShellHudElement,
  createShellStore,
  getEntityTile,
  type ShellOnboardingState,
  type ShellBuildModeState,
  type ShellLocaleState,
  type ShellPlayableCommandTemplateState,
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
  createPlayableCommandSurface,
  createPlayableWorldReadModel,
  createProjectedPlayableDebugState,
  patchPlayableActionFromProjection,
} from "./playable-worker-projection";
import { WEB_PRODUCT_GATE_READ_MODEL } from "./product-gate-fixture";
import { createShellReleaseGateInfo, readShellBrowserLabel } from "./product-gate-harness";
import { createShellSettingsController, readDiagnosticsVisibility } from "./shell-locale";
import {
  createWebSimulationWorkerSession,
  drainWebPlayableCommandsToTerminal,
  readWebPlayableProjection,
  sendWebPlayableCommandBatch,
  startWebPlayableWorkerScenario,
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

const PLAYABLE_DRAIN_STEP_TICKS = 15;
const PLAYABLE_DRAIN_MAX_TICK_SPAN = 360;

export async function mountWebClientShell(rootElement: HTMLElement): Promise<MountedWebShell> {
  prepareDocumentChrome();
  const platformPorts = resolvePlatformPorts();
  const settingsController = createShellSettingsController();
  const diagnosticsVisible = readDiagnosticsVisibility(window.location.search);
  const workerSession = createWebSimulationWorkerSession({
    sessionId: "wm0152-web-shell",
  });
  const initialReadModel = WEB_PRODUCT_GATE_READ_MODEL;
  const releaseGate = createShellReleaseGateInfo({
    browserLabel: readShellBrowserLabel(navigator.userAgent),
    crossOriginIsolated: window.crossOriginIsolated,
  });
  const recentStructuredErrors: M6DiagnosticEntryInput[] = [];
  let diagnosticState = createInitialDiagnosticDebugState(platformPorts.host);
  let playableProjection: ReturnType<typeof readWebPlayableProjection> = undefined;
  let nextLampCommandOrdinal = 1;
  let nextBuildCommandOrdinal = 1;
  const pendingCommands = new Map<string, ShellPlayableCommandTemplateState>();
  const activePlayableCommandIds = new Set<string>();
  let playableDrainAbortController: AbortController | undefined;
  let playableDrainRunId = 0;

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
    selectedEntityId: initialReadModel.selectedEntityId,
    inspectedTile: getEntityTile(initialReadModel, initialReadModel.selectedEntityId),
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
        createProjectedPlayableDebugState(
          playableProjection,
          store.getSnapshot().playableAction,
          store.getSnapshot().readModel,
        ),
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
        async onPrioritizeLampWork(command): Promise<void> {
          await dispatchPlayableCommand(command);
        },
        async onQueueSimpleBuild(command): Promise<void> {
          await setBuildMode("inactive");
          await dispatchPlayableCommand(command);
        },
        async onSetBuildMode(mode): Promise<void> {
          await setBuildMode(mode);
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
      if (activeRenderer !== undefined && !isSyncingRendererProjection) {
        syncRendererProjection(store.getSnapshot());
      }
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
    const nextProjection = readWebPlayableProjection(message);
    if (nextProjection !== undefined) {
      playableProjection = nextProjection;
      syncRendererProjection(store.getSnapshot());
    }
  });
  const unsubscribeReliableSession = workerSession.subscribeReliable((message) => {
    if (message.kind !== "CommandResult") {
      return;
    }

    handleCommandResult(message);
  });
  startWebPlayableWorkerScenario(workerSession, "5");

  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = Math.max(shellFrame.clientWidth, 1);
    const nextHeight = Math.max(shellFrame.clientHeight, 1);
    renderer.resize(nextWidth, nextHeight, readDevicePixelRatio());
    syncDebug(
      renderer.readDebugState(),
      store.getSnapshot(),
      createProjectedPlayableDebugState(
        playableProjection,
        store.getSnapshot().playableAction,
        store.getSnapshot().readModel,
      ),
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
    createProjectedPlayableDebugState(
      playableProjection,
      store.getSnapshot().playableAction,
      store.getSnapshot().readModel,
    ),
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
      createProjectedPlayableDebugState(
        playableProjection,
        store.getSnapshot().playableAction,
        store.getSnapshot().readModel,
      ),
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
        createProjectedPlayableDebugState(
          playableProjection,
          nextState.playableAction,
          nextState.readModel,
        ),
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
  }

  function syncRendererProjection(currentState: ShellState): void {
    const nextReadModel =
      playableProjection === undefined
        ? currentState.readModel
        : createPlayableWorldReadModel({
            baseReadModel: WEB_PRODUCT_GATE_READ_MODEL,
            projection: playableProjection,
            buildMode: currentState.buildMode,
            hoverTile: currentState.hoverTile,
            selectedEntityId: currentState.selectedEntityId,
          });
    const playableAction = patchPlayableActionFromProjection(
      currentState.playableAction,
      playableProjection,
    );
    const nextState: ShellState = {
      ...currentState,
      inspectedTile:
        currentState.selectedEntityId === undefined
          ? currentState.inspectedTile
          : getEntityTile(nextReadModel, currentState.selectedEntityId),
      ...(playableProjection === undefined
        ? {}
        : {
            playableCommandSurface: createPlayableCommandSurface(playableProjection),
          }),
      ...(playableAction === undefined ? {} : { playableAction }),
      readModel: nextReadModel,
    };
    store.setState(nextState);
    const activeRenderer = rendererRef.current;
    if (activeRenderer !== undefined) {
      isSyncingRendererProjection = true;
      try {
        activeRenderer.setReadModel(nextReadModel);
      } finally {
        isSyncingRendererProjection = false;
      }
      syncDebug(
        activeRenderer.readDebugState(),
        nextState,
        createProjectedPlayableDebugState(
          playableProjection,
          nextState.playableAction,
          nextReadModel,
        ),
        platformPorts.host,
        storageController.readDebugState(),
        diagnosticState,
      );
    }
  }

  function dispatchPlayableCommand(command: ShellPlayableCommandTemplateState): Promise<void> {
    const commandId =
      command.actionId === "prioritize-lamp-work"
        ? `wm0152-lamp-${String(nextLampCommandOrdinal).padStart(3, "0")}`
        : `wm0152-build-${String(nextBuildCommandOrdinal).padStart(3, "0")}`;
    if (command.actionId === "prioritize-lamp-work") {
      nextLampCommandOrdinal += 1;
    } else {
      nextBuildCommandOrdinal += 1;
    }

    pendingCommands.set(commandId, command);
    if (command.actionId === "prioritize-lamp-work") {
      const payload = command.payload;
      if (!isPrioritizeLampWorkPayload(payload)) {
        pendingCommands.delete(commandId);
        recordStructuredError(recentStructuredErrors, "playable_lamp_payload_invalid", {
          message: "HUD lamp command template did not carry a PrioritizeLampWork payload.",
        });
        return Promise.resolve();
      }
      sendWebPlayableCommandBatch(workerSession, [
        {
          commandId,
          kind: "PrioritizeLampWork",
          basis: command.commandBasis,
          payload,
        },
      ]);
    } else {
      const payload = command.payload;
      if (!isQueueSimpleBuildPayload(payload)) {
        pendingCommands.delete(commandId);
        recordStructuredError(recentStructuredErrors, "playable_build_payload_invalid", {
          message: "HUD build command template did not carry a QueueSimpleBuild payload.",
        });
        return Promise.resolve();
      }
      sendWebPlayableCommandBatch(workerSession, [
        {
          commandId,
          kind: "QueueSimpleBuild",
          basis: command.commandBasis,
          payload,
        },
      ]);
    }
    const currentState = store.getSnapshot();
    store.setState({
      ...currentState,
      lastInputLabel: `Action queued ${commandId}`,
    });
    return Promise.resolve();
  }

  function setBuildMode(mode: ShellBuildModeState): Promise<void> {
    const currentState = store.getSnapshot();
    store.setState({
      ...currentState,
      buildMode: mode,
    });
    syncRendererProjection(store.getSnapshot());
    return Promise.resolve();
  }

  function handleCommandResult(message: CommandResultMessage): void {
    if (message.payload.commandResults.length === 0 && message.payload.batchReason === undefined) {
      return;
    }

    const currentState = store.getSnapshot();
    const nextAction = readLatestCommandAction(
      message,
      currentState.playableAction,
      pendingCommands,
    );
    if (nextAction === undefined) {
      return;
    }

    store.setState({
      ...currentState,
      lastInputLabel: `${nextAction.status === "accepted" ? "Accepted" : "Rejected"} ${nextAction.commandId}`,
      playableAction: nextAction,
    });
    syncRendererProjection(store.getSnapshot());
    if (nextAction.status === "accepted") {
      drainPlayableCommand(nextAction.commandId);
    }
  }

  function drainPlayableCommand(commandId: string): void {
    activePlayableCommandIds.add(commandId);
    restartPlayableDrain();
  }

  function restartPlayableDrain(): void {
    if (isDestroyed) {
      return;
    }

    const commandIds = [...activePlayableCommandIds];
    if (commandIds.length === 0) {
      return;
    }

    playableDrainAbortController?.abort(new Error("Playable drain superseded."));
    const controller = new AbortController();
    playableDrainAbortController = controller;
    playableDrainRunId += 1;
    const drainRunId = playableDrainRunId;
    const currentTick = playableProjection?.basis.tick ?? 0;

    void drainWebPlayableCommandsToTerminal(workerSession, {
      commandIds,
      maxTargetTick: Math.max(
        PLAYABLE_DRAIN_MAX_TICK_SPAN,
        currentTick + PLAYABLE_DRAIN_MAX_TICK_SPAN,
      ),
      stepTicks: PLAYABLE_DRAIN_STEP_TICKS,
      signal: controller.signal,
    })
      .then((result) => {
        if (isDestroyed || drainRunId !== playableDrainRunId) {
          return;
        }

        playableDrainAbortController = undefined;
        playableProjection = result.projection;
        for (const terminalCommandId of result.terminalCommandIds) {
          activePlayableCommandIds.delete(terminalCommandId);
        }
        syncRendererProjection(store.getSnapshot());

        if (result.status === "max_target_reached") {
          recordStructuredError(recentStructuredErrors, "playable_drain_max_target_reached", {
            message: `Playable drain reached tick ${String(result.targetTick)} with active commands: ${result.activeCommandIds.join(",")}`,
          });
        }
      })
      .catch((error: unknown) => {
        if (isDestroyed || drainRunId !== playableDrainRunId || controller.signal.aborted) {
          return;
        }

        playableDrainAbortController = undefined;
        recordStructuredError(recentStructuredErrors, "playable_drain_failed", {
          message: readUnknownReason(error),
        });
      });
  }

  async function teardownMountedShell(): Promise<void> {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;

    window.removeEventListener("pagehide", pageHideListener);
    unsubscribeWorkerSession();
    unsubscribeReliableSession();
    playableDrainAbortController?.abort(new Error("Mounted Web shell destroyed."));
    playableDrainAbortController = undefined;
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
  shellState: Pick<ShellState, "diagnosticsVisible" | "locale" | "playableAction" | "uiScale">,
  playableState: ReturnType<typeof createProjectedPlayableDebugState> | undefined,
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
    ...(playableState === undefined ? {} : { playable: playableState }),
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

function readLatestCommandAction(
  message: CommandResultMessage,
  fallback: ShellPlayableActionState | undefined,
  pendingCommands: Map<string, ShellPlayableCommandTemplateState>,
): ShellPlayableActionState | undefined {
  const commandResult = message.payload.commandResults[message.payload.commandResults.length - 1];
  const pendingCommand =
    commandResult === undefined
      ? [...pendingCommands.values()][pendingCommands.size - 1]
      : pendingCommands.get(commandResult.commandId);
  if (pendingCommand === undefined) {
    return fallback;
  }
  if (commandResult === undefined) {
    if (message.payload.batchReason === undefined) {
      return fallback;
    }
    pendingCommands.delete([...pendingCommands.keys()][pendingCommands.size - 1] ?? "");
    return {
      actionId: pendingCommand.actionId,
      adapterId: "wm0152-authoritative-worker-session",
      authority: "simulation-worker-projection",
      commandId: "batch-rejected",
      reasonCode: message.payload.batchReason.code,
      reasonDetail: message.payload.batchReason.detail,
      reasonSource: "command_result",
      status: "rejected",
      targetEntityId: pendingCommand.targetEntityId,
      targetLabel: pendingCommand.targetLabel,
    };
  }
  if (!pendingCommands.delete(commandResult.commandId)) {
    return fallback;
  }

  if (commandResult.status === "rejected") {
    const reason = commandResult.reason;
    return {
      actionId: pendingCommand.actionId,
      adapterId: "wm0152-authoritative-worker-session",
      authority: "simulation-worker-projection",
      commandId: commandResult.commandId,
      reasonCode: reason.code,
      reasonDetail: readCommandReasonDetail(reason),
      reasonSource: reason.source,
      status: "rejected",
      targetEntityId: pendingCommand.targetEntityId,
      targetLabel: pendingCommand.targetLabel,
    };
  }

  return {
    actionId: pendingCommand.actionId,
    adapterId: "wm0152-authoritative-worker-session",
    authority: "simulation-worker-projection",
    commandId: commandResult.commandId,
    markerState: commandResult.initialState,
    ...(commandResult.blockedReason === undefined
      ? {}
      : {
          reasonCode: commandResult.blockedReason.code,
          reasonDetail: readCommandReasonDetail(commandResult.blockedReason),
          reasonSource: commandResult.blockedReason.source,
        }),
    status: "accepted",
    targetEntityId: pendingCommand.targetEntityId,
    targetLabel: pendingCommand.targetLabel,
  };
}

function isPrioritizeLampWorkPayload(payload: unknown): payload is PrioritizeLampWorkPayload {
  return (
    isRecord(payload) &&
    isRecord(payload["target"]) &&
    typeof payload["requestedAction"] === "string" &&
    typeof payload["priorityBand"] === "number"
  );
}

function isQueueSimpleBuildPayload(payload: unknown): payload is QueueSimpleBuildPayload {
  return (
    isRecord(payload) &&
    isRecord(payload["blueprint"]) &&
    isRecord(payload["anchorCell"]) &&
    typeof payload["orientation"] === "number" &&
    typeof payload["priorityBand"] === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCommandReasonDetail(
  reason: CommandBlockedReason | ProtocolRejection | undefined,
): string {
  if (reason === undefined) {
    return "";
  }

  if ("detail" in reason) {
    return reason.detail;
  }

  return reason.code
    .split("_")
    .map((segment: string) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
