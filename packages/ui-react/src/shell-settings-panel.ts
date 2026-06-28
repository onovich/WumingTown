import { createElement, type CSSProperties, type ReactElement } from "react";

import {
  formatMessage,
  getLocaleDisplayName,
  type LocaleId,
  type MessageKey,
  type ShellLocaleState,
} from "./localization";
import type { ShellLocaleActions } from "./shell-store";

export interface ShellSettingsPanelProps {
  readonly actions: ShellLocaleActions;
  readonly state: ShellLocaleState;
}

export function ShellSettingsPanel({ actions, state }: ShellSettingsPanelProps): ReactElement {
  const uiLocale = state.resolvedLocale;
  const selectedValue = state.source === "manual" ? (state.manualLocale ?? "en") : "system";
  const systemLocaleLabel = getLocaleDisplayName(state.systemLocale, uiLocale);
  const persistenceKey = readPersistenceMessageKey(state.persistence.diagnosticCode);

  return createElement(
    "section",
    {
      "aria-label": formatMessage(uiLocale, "ui.settings.aria"),
      "data-locale-source": state.source,
      "data-testid": "locale-settings",
      style: panelStyle,
    },
    createElement(
      "div",
      {
        style: headerStyle,
      },
      createElement(
        "div",
        {
          style: titleStyle,
        },
        formatMessage(uiLocale, "ui.settings.title"),
      ),
      createElement(
        "p",
        {
          style: bodyStyle,
        },
        formatMessage(uiLocale, "ui.settings.description"),
      ),
    ),
    createElement(
      "label",
      {
        style: labelStyle,
      },
      createElement(
        "span",
        {
          style: eyebrowStyle,
        },
        formatMessage(uiLocale, "ui.settings.language"),
      ),
      createElement(
        "select",
        {
          "data-testid": "locale-select",
          onChange: (event): void => {
            const selection = readLocaleSelection(event.currentTarget);
            if (selection === "system") {
              void actions.onUseSystemLocale();
              return;
            }

            if (selection !== undefined) {
              void actions.onUseManualLocale(selection);
            }
          },
          style: selectStyle,
          value: selectedValue,
        },
        createElement(
          "option",
          {
            value: "system",
          },
          formatMessage(uiLocale, "ui.settings.option.system", {
            locale: systemLocaleLabel,
          }),
        ),
        ...(["zh-CN", "en"] as const).map((localeId) =>
          createElement(
            "option",
            {
              key: localeId,
              value: localeId,
            },
            getLocaleDisplayName(localeId, uiLocale),
          ),
        ),
      ),
    ),
    createElement(
      "div",
      {
        "data-testid": "locale-source",
        style: metaStyle,
      },
      formatMessage(
        uiLocale,
        state.source === "manual" ? "ui.settings.source.manual" : "ui.settings.source.system",
      ),
    ),
    createElement(
      "div",
      {
        "data-testid": "locale-current",
        style: metaStyle,
      },
      formatMessage(uiLocale, "ui.settings.currentLocale", {
        locale: getLocaleDisplayName(state.resolvedLocale, uiLocale),
      }),
    ),
    createElement(
      "div",
      {
        "data-testid": "locale-persistence",
        style: persistenceStyle(state.persistence.mode),
      },
      formatMessage(uiLocale, persistenceKey),
    ),
  );
}

function readPersistenceMessageKey(
  code: ShellLocaleState["persistence"]["diagnosticCode"],
): MessageKey {
  switch (code) {
    case "none":
      return "ui.settings.persistence.ready";
    case "preference_invalid":
      return "ui.settings.persistence.preference_invalid";
    case "storage_unavailable":
      return "ui.settings.persistence.storage_unavailable";
    case "write_failed":
      return "ui.settings.persistence.write_failed";
  }
}

function persistenceStyle(mode: ShellLocaleState["persistence"]["mode"]): CSSProperties {
  return {
    ...metaStyle,
    borderColor: mode === "session-only" ? "rgba(244, 181, 45, 0.28)" : "rgba(232, 206, 151, 0.12)",
  };
}

function readLocaleSelection(target: EventTarget | null): LocaleId | "system" | undefined {
  if (!(target instanceof HTMLSelectElement)) {
    return undefined;
  }

  const selectedValue: unknown = Reflect.get(target, "value");
  if (typeof selectedValue !== "string") {
    return undefined;
  }

  if (selectedValue === "system") {
    return "system";
  }

  return readLocaleId(selectedValue);
}

function readLocaleId(value: string): LocaleId | undefined {
  switch (value) {
    case "en":
      return "en";
    case "zh-CN":
      return "zh-CN";
    default:
      return undefined;
  }
}

const panelStyle: CSSProperties = {
  background: "rgba(18, 15, 11, 0.88)",
  border: "1px solid rgba(232, 206, 151, 0.18)",
  borderRadius: "8px",
  boxSizing: "border-box",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  maxWidth: "100%",
  minWidth: 0,
  padding: "14px 16px",
  width: "min(320px, 100%)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const titleStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: "20px",
};

const eyebrowStyle: CSSProperties = {
  color: "#d3cab6",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const bodyStyle: CSSProperties = {
  color: "#c8c0af",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  lineHeight: "17px",
  margin: 0,
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const selectStyle: CSSProperties = {
  background: "#f1e6cc",
  border: "1px solid rgba(232, 206, 151, 0.18)",
  borderRadius: "6px",
  color: "#241e18",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  fontWeight: 600,
  minWidth: 0,
  padding: "8px 10px",
  width: "100%",
};

const metaStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "6px",
  color: "#d8cfbc",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  lineHeight: "17px",
  padding: "8px 10px",
};
