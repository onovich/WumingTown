/// <reference lib="dom" />

import {
  createShellLocaleState,
  loadLocalePreference,
  readNavigatorLocaleCandidates,
  writeManualLocalePreference,
  writeSystemLocalePreference,
  type LocaleId,
  type LocaleStorageLike,
  type ShellLocaleActions,
  type ShellLocaleState,
} from "@wuming-town/ui-react";

export interface ShellLocaleController {
  readonly actions: ShellLocaleActions;
  readState(): ShellLocaleState;
}

export function createShellLocaleController(): ShellLocaleController {
  const candidates = readNavigatorLocaleCandidates(window.navigator);
  const storage = readLocaleStorage(window);
  let state = readInitialLocaleState(storage, candidates);

  return {
    actions: {
      onUseManualLocale(locale: LocaleId): Promise<void> {
        const result = writeManualLocalePreference(storage, locale);
        state = createShellLocaleState(result.preference, candidates, result.persistence);
        return Promise.resolve();
      },
      onUseSystemLocale(): Promise<void> {
        const result = writeSystemLocalePreference(storage);
        state = createShellLocaleState(result.preference, candidates, result.persistence);
        return Promise.resolve();
      },
    },
    readState(): ShellLocaleState {
      return state;
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

function readLocaleStorage(view: Window): LocaleStorageLike | undefined {
  try {
    return view.localStorage;
  } catch {
    return undefined;
  }
}
