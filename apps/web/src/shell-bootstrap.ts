/// <reference lib="dom" />

import { createRoot } from "react-dom/client";

import { resolvePlatformPorts, type PlatformHostInfo } from "@wuming-town/platform";
import {
  createPixiWorldRenderer,
  type PixiWorldRendererDebugState,
} from "@wuming-town/renderer-pixi";
import { createShellHudElement, createShellStore, type ShellState } from "@wuming-town/ui-react";

import { createShellReleaseGateInfo, readShellBrowserLabel } from "./product-gate-harness";
import { WEB_SHELL_SMOKE_READ_MODEL } from "./smoke-read-model";
import {
  createInitialStorageGateState,
  createWebStorageGateController,
  type WebStorageDebugState,
} from "./web-storage-gate";

export interface WebShellDebugPayload extends PixiWorldRendererDebugState {
  readonly browserTargets: readonly string[];
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

  const shellFrame = document.createElement("div");
  shellFrame.style.cssText =
    "position:fixed;inset:0;overflow:hidden;background:linear-gradient(180deg,#120f0b 0%,#1a1712 100%);";

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:absolute;inset:0;";

  const hudHost = document.createElement("div");
  hudHost.style.cssText = "position:absolute;inset:0;";

  shellFrame.append(canvasHost, hudHost);
  rootElement.replaceChildren(shellFrame);

  const initialState: ShellState = {
    readModel: WEB_SHELL_SMOKE_READ_MODEL,
    releaseGate,
    storageGate: createInitialStorageGateState(),
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
      );
    },
    platformPorts,
    store,
  });
  const reactRoot = createRoot(hudHost);
  reactRoot.render(createShellHudElement(store, storageController.actions));

  const rendererRef: {
    current: Awaited<ReturnType<typeof createPixiWorldRenderer>> | undefined;
  } = {
    current: undefined,
  };

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
    syncDebug(renderer.readDebugState(), platformPorts.host, storageController.readDebugState());
  });
  resizeObserver.observe(shellFrame);

  renderer.resize(shellFrame.clientWidth, shellFrame.clientHeight, readDevicePixelRatio());
  syncDebug(renderer.readDebugState(), platformPorts.host, storageController.readDebugState());

  return {
    async destroy(): Promise<void> {
      resizeObserver.disconnect();
      reactRoot.unmount();
      await renderer.destroy();
      rootElement.replaceChildren();
    },
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
): void {
  const releaseGate = createShellReleaseGateInfo({
    browserLabel: readShellBrowserLabel(navigator.userAgent),
    crossOriginIsolated: window.crossOriginIsolated,
  });
  const debugPayload: WebShellDebugPayload = {
    ...debugState,
    browserTargets: releaseGate.browserTargets,
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
