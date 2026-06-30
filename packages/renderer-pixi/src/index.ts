import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export {
  createPixiWorldRenderer,
  type CreatePixiWorldRendererOptions,
  type PixiWorldRenderer,
  type PixiWorldRendererDebugState,
  type RendererStateSnapshot,
} from "./pixi-world-renderer";
export {
  createFittedViewport,
  findEntityAtScreenPoint,
  panViewport,
  readEntityActivityScreenProjection,
  readEntityScreenPositions,
  readFocusMarkerScreenPoint,
  readPathScreenPoints,
  readSemanticAreaScreenRect,
  resizeViewport,
  screenToTile,
  type RendererViewportState,
  type ScreenEntityActivityProjection,
  type ScreenEntityPosition,
  type ScreenPoint,
  type ScreenRect,
  tileToScreenBounds,
  tileToScreenCenter,
  zoomViewportAtPoint,
} from "./render-geometry";

export const RENDERER_PIXI_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/renderer-pixi",
  "package",
);

export const RENDERER_PIXI_READ_MODEL_SOURCE: string = SIM_PROTOCOL_SMOKE.packageName;
