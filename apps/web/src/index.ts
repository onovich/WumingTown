import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { PLATFORM_SMOKE } from "@wuming-town/platform";
import { RENDERER_PIXI_SMOKE } from "@wuming-town/renderer-pixi";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";
import { UI_REACT_SMOKE } from "@wuming-town/ui-react";

export const WEB_APP_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke("@wuming-town/web", "app");

export const WEB_APP_PUBLIC_DEPENDENCIES: readonly string[] = [
  PLATFORM_SMOKE.packageName,
  RENDERER_PIXI_SMOKE.packageName,
  SIM_PROTOCOL_SMOKE.packageName,
  UI_REACT_SMOKE.packageName,
];
