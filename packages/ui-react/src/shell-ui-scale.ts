import type { LocalePersistenceState, LocaleStorageLike } from "./localization";

export const SUPPORTED_UI_SCALES = ["standard", "large", "extra-large"] as const;

export type UiScaleId = (typeof SUPPORTED_UI_SCALES)[number];

export interface UiScalePreferenceV1 {
  readonly scale: UiScaleId;
  readonly version: 1;
}

export interface UiScalePreferenceLoadResult {
  readonly persistence: LocalePersistenceState;
  readonly preference: UiScalePreferenceV1;
}

export interface UiScalePreferenceWriteResult {
  readonly persistence: LocalePersistenceState;
  readonly preference: UiScalePreferenceV1;
}

export interface ShellUiScaleState {
  readonly factor: number;
  readonly preference: UiScaleId;
  readonly persistence: LocalePersistenceState;
}

export const UI_SCALE_STORAGE_KEY = "wuming-town.ui-scale.v1";

const DEFAULT_UI_SCALE_PREFERENCE: UiScalePreferenceV1 = Object.freeze({
  scale: "standard",
  version: 1,
});

const UI_SCALE_FACTORS: Readonly<Record<UiScaleId, number>> = Object.freeze({
  "extra-large": 1.2,
  large: 1.1,
  standard: 1,
});

export function createDefaultShellUiScaleState(): ShellUiScaleState {
  return createShellUiScaleState(DEFAULT_UI_SCALE_PREFERENCE, {
    diagnosticCode: "none",
    mode: "persistent",
  });
}

export function createShellUiScaleState(
  preference: UiScalePreferenceV1,
  persistence: LocalePersistenceState,
): ShellUiScaleState {
  return {
    factor: UI_SCALE_FACTORS[preference.scale],
    persistence,
    preference: preference.scale,
  };
}

export function loadUiScalePreference(
  storage: LocaleStorageLike | undefined,
): UiScalePreferenceLoadResult {
  if (storage === undefined) {
    return {
      persistence: {
        diagnosticCode: "storage_unavailable",
        mode: "session-only",
      },
      preference: DEFAULT_UI_SCALE_PREFERENCE,
    };
  }

  try {
    const rawValue = storage.getItem(UI_SCALE_STORAGE_KEY);
    if (rawValue === null) {
      return {
        persistence: {
          diagnosticCode: "none",
          mode: "persistent",
        },
        preference: DEFAULT_UI_SCALE_PREFERENCE,
      };
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isUiScalePreferenceV1(parsedValue)) {
      return {
        persistence: {
          diagnosticCode: "preference_invalid",
          mode: "persistent",
        },
        preference: DEFAULT_UI_SCALE_PREFERENCE,
      };
    }

    return {
      persistence: {
        diagnosticCode: "none",
        mode: "persistent",
      },
      preference: parsedValue,
    };
  } catch {
    return {
      persistence: {
        diagnosticCode: "preference_invalid",
        mode: "persistent",
      },
      preference: DEFAULT_UI_SCALE_PREFERENCE,
    };
  }
}

export function writeUiScalePreference(
  storage: LocaleStorageLike | undefined,
  scale: UiScaleId,
): UiScalePreferenceWriteResult {
  const preference: UiScalePreferenceV1 = {
    scale,
    version: 1,
  };

  if (storage === undefined) {
    return {
      persistence: {
        diagnosticCode: "storage_unavailable",
        mode: "session-only",
      },
      preference,
    };
  }

  try {
    storage.setItem(UI_SCALE_STORAGE_KEY, JSON.stringify(preference));
    return {
      persistence: {
        diagnosticCode: "none",
        mode: "persistent",
      },
      preference,
    };
  } catch {
    return {
      persistence: {
        diagnosticCode: "write_failed",
        mode: "session-only",
      },
      preference,
    };
  }
}

function isUiScalePreferenceV1(value: unknown): value is UiScalePreferenceV1 {
  if (!isRecord(value)) {
    return false;
  }

  return value["version"] === 1 && isUiScaleId(value["scale"]);
}

function isUiScaleId(value: unknown): value is UiScaleId {
  return value === "standard" || value === "large" || value === "extra-large";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
