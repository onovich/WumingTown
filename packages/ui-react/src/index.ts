import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export { createShellHudElement, ShellHudRoot, type ShellHudRootProps } from "./shell-hud";
export { ShellOnboardingPanel, type ShellOnboardingPanelProps } from "./shell-onboarding-panel";
export {
  localizeShellFixtureText,
  localizeShellLastInputLabel,
  validateShellFixtureLocalization,
} from "./shell-read-model-localization";
export { ShellSettingsPanel, type ShellSettingsPanelProps } from "./shell-settings-panel";
export { ShellStoragePanel, type ShellStoragePanelProps } from "./shell-storage-panel";
export {
  createShellStore,
  getEntityTile,
  getSelectedEntity,
  type ShellCommandActions,
  type ShellBuildModeState,
  type ShellOnboardingState,
  type ShellOnboardingStep,
  type ShellPlayableActionState,
  type ShellPlayableCommandSurfaceState,
  type ShellPlayableCommandTemplateState,
  type ShellPlayablePlacementPreviewState,
  type ShellReleaseGateInfo,
  type ShellReleaseGateLine,
  type ShellSettingsActions,
  type ShellStorageActions,
  type ShellStorageDiagnosticState,
  type ShellStorageGateState,
  type ShellStorageSlotState,
  type ShellUiScaleActions,
  type ShellState,
  type ShellStore,
} from "./shell-store";
export {
  createDefaultShellLocaleState,
  createShellLocaleState,
  formatMessage,
  getLocaleDisplayName,
  isDiagnosticsLocalizationKey,
  listSupportedLocales,
  loadLocalePreference,
  LOCALE_PREFERENCE_STORAGE_KEY,
  readNavigatorLocaleCandidates,
  resolveSystemLocale,
  validateLocalizationCatalogs,
  writeManualLocalePreference,
  writeSystemLocalePreference,
  type LocaleId,
  type LocalePersistenceDiagnosticCode,
  type LocalePersistenceMode,
  type LocalePersistenceState,
  type LocalePreferenceV1,
  type LocaleSource,
  type LocaleStorageLike,
  type MessageKey,
  type NavigatorLanguageLike,
  type ShellLocaleState,
} from "./localization";
export {
  createDefaultShellUiScaleState,
  createShellUiScaleState,
  loadUiScalePreference,
  SUPPORTED_UI_SCALES,
  UI_SCALE_STORAGE_KEY,
  writeUiScalePreference,
  type ShellUiScaleState,
  type UiScaleId,
  type UiScalePreferenceV1,
} from "./shell-ui-scale";

export const UI_REACT_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/ui-react",
  "package",
);

export const UI_REACT_READ_MODEL_SOURCE: string = SIM_PROTOCOL_SMOKE.packageName;
