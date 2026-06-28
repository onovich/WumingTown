/// <reference lib="dom" />

import {
  createDefaultShellUiScaleState,
  createShellLocaleState,
  createShellUiScaleState,
  loadLocalePreference,
  loadUiScalePreference,
  readNavigatorLocaleCandidates,
  writeManualLocalePreference,
  writeSystemLocalePreference,
  writeUiScalePreference,
  type LocaleId,
  type LocaleStorageLike,
  type ShellLocaleState,
  type ShellSettingsActions,
  type ShellUiScaleState,
  type UiScaleId,
} from "@wuming-town/ui-react";

export interface ShellSettingsControllerState {
  readonly locale: ShellLocaleState;
  readonly uiScale: ShellUiScaleState;
}

export interface ShellSettingsController {
  readonly actions: ShellSettingsActions;
  readState(): ShellSettingsControllerState;
}

export function createShellSettingsController(): ShellSettingsController {
  const candidates = readNavigatorLocaleCandidates(window.navigator);
  const storage = readLocaleStorage(window);
  let localeState = readInitialLocaleState(storage, candidates);
  let uiScaleState = readInitialUiScaleState(storage);

  return {
    actions: {
      onUseManualLocale(locale: LocaleId): Promise<void> {
        const result = writeManualLocalePreference(storage, locale);
        localeState = createShellLocaleState(result.preference, candidates, result.persistence);
        return Promise.resolve();
      },
      onUseSystemLocale(): Promise<void> {
        const result = writeSystemLocalePreference(storage);
        localeState = createShellLocaleState(result.preference, candidates, result.persistence);
        return Promise.resolve();
      },
      onUseUiScale(scale: UiScaleId): Promise<void> {
        const result = writeUiScalePreference(storage, scale);
        uiScaleState = createShellUiScaleState(result.preference, result.persistence);
        return Promise.resolve();
      },
    },
    readState(): ShellSettingsControllerState {
      return {
        locale: localeState,
        uiScale: uiScaleState,
      };
    },
  };
}

export function readDiagnosticsVisibility(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("wmDiagnostics") === "1";
}

function readInitialLocaleState(
  storage: LocaleStorageLike | undefined,
  candidates: readonly string[],
): ShellLocaleState {
  const result = loadLocalePreference(storage);
  return createShellLocaleState(result.preference, candidates, result.persistence);
}

function readInitialUiScaleState(storage: LocaleStorageLike | undefined): ShellUiScaleState {
  const result = loadUiScalePreference(storage);
  if (result.preference.scale === "standard" && result.persistence.diagnosticCode === "none") {
    return createDefaultShellUiScaleState();
  }

  return createShellUiScaleState(result.preference, result.persistence);
}

function readLocaleStorage(view: Window): LocaleStorageLike | undefined {
  try {
    return view.localStorage;
  } catch {
    return undefined;
  }
}
