/// <reference lib="dom" />

import { createRoot } from "react-dom/client";

import {
  createPixiWorldRenderer,
  type PixiWorldRendererDebugState,
} from "@wuming-town/renderer-pixi";
import { createShellHudElement, createShellStore, type ShellState } from "@wuming-town/ui-react";

import { WEB_SHELL_SMOKE_READ_MODEL } from "./smoke-read-model";

export type WebShellDebugPayload = PixiWorldRendererDebugState;

export interface MountedWebShell {
  destroy(): Promise<void>;
}

export async function mountWebClientShell(rootElement: HTMLElement): Promise<MountedWebShell> {
  prepareDocumentChrome();

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
    canvasWidth: Math.max(shellFrame.clientWidth, 1),
    canvasHeight: Math.max(shellFrame.clientHeight, 1),
    zoom: 1,
    lastInputLabel: "Booting shell",
    selectedEntityId: WEB_SHELL_SMOKE_READ_MODEL.selectedEntityId,
    hoverTile: undefined,
  };
  const store = createShellStore(initialState);
  const reactRoot = createRoot(hudHost);
  reactRoot.render(createShellHudElement(store));

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
        syncDebug(activeRenderer.readDebugState());
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
        syncDebug(activeRenderer.readDebugState());
      }
    },
  });
  rendererRef.current = renderer;

  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = Math.max(shellFrame.clientWidth, 1);
    const nextHeight = Math.max(shellFrame.clientHeight, 1);
    renderer.resize(nextWidth, nextHeight, readDevicePixelRatio());
    syncDebug(renderer.readDebugState());
  });
  resizeObserver.observe(shellFrame);

  renderer.resize(shellFrame.clientWidth, shellFrame.clientHeight, readDevicePixelRatio());
  syncDebug(renderer.readDebugState());

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

function syncDebug(debugState: PixiWorldRendererDebugState): void {
  const debugPayload: WebShellDebugPayload = debugState;
  const debugNode = document.getElementById("wm-shell-debug");
  if (debugNode !== null) {
    debugNode.textContent = JSON.stringify(debugPayload);
  }
}
