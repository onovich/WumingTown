import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { PERSISTENCE_SMOKE } from "@wuming-town/persistence";
import { PLATFORM_SMOKE } from "@wuming-town/platform";

export const DESKTOP_ELECTRON_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/desktop-electron",
  "app",
);

export const DESKTOP_ELECTRON_PUBLIC_DEPENDENCIES: readonly string[] = [
  PERSISTENCE_SMOKE.packageName,
  PLATFORM_SMOKE.packageName,
];
