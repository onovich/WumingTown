import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export const UI_REACT_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/ui-react",
  "package",
);

export const UI_REACT_READ_MODEL_SOURCE: string = SIM_PROTOCOL_SMOKE.packageName;
