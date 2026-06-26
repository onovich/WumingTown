import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export { createShellHudElement, ShellHudRoot, type ShellHudRootProps } from "./shell-hud";
export { ShellStoragePanel, type ShellStoragePanelProps } from "./shell-storage-panel";
export {
  createShellStore,
  getSelectedEntity,
  type ShellReleaseGateInfo,
  type ShellReleaseGateLine,
  type ShellStorageActions,
  type ShellStorageDiagnosticState,
  type ShellStorageGateState,
  type ShellStorageSlotState,
  type ShellState,
  type ShellStore,
} from "./shell-store";

export const UI_REACT_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/ui-react",
  "package",
);

export const UI_REACT_READ_MODEL_SOURCE: string = SIM_PROTOCOL_SMOKE.packageName;
