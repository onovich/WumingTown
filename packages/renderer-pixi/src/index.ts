import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export const RENDERER_PIXI_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/renderer-pixi",
  "package",
);

export const RENDERER_PIXI_READ_MODEL_SOURCE: string = SIM_PROTOCOL_SMOKE.packageName;
