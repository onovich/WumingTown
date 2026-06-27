import { createElement, useState, type CSSProperties, type ReactElement } from "react";

import {
  formatMessage,
  getLocaleDisplayName,
  type LocaleId,
  type ShellLocaleState,
} from "./localization";
import { ShellSettingsPanel } from "./shell-settings-panel";
import type { ShellLocaleActions, ShellStorageActions, ShellStorageGateState } from "./shell-store";

export interface ShellMainMenuSurfaceProps {
  readonly compact: boolean;
  readonly cycleLabel: string;
  readonly localeActions: ShellLocaleActions;
  readonly localeState: ShellLocaleState;
  readonly onDismiss: () => void;
  readonly phaseLabel: string;
  readonly settlementName: string;
  readonly storageActions: Pick<ShellStorageActions, "onLoadSave">;
  readonly storageState: Pick<ShellStorageGateState, "saveSlots">;
}

type MainMenuView = "home" | "settings";
type LocaleSelection = LocaleId | "system";

export function ShellMainMenuSurface({
  compact,
  cycleLabel,
  localeActions,
  localeState,
  onDismiss,
  phaseLabel,
  settlementName,
  storageActions,
  storageState,
}: ShellMainMenuSurfaceProps): ReactElement {
  const [continuePending, setContinuePending] = useState(false);
  const [view, setView] = useState<MainMenuView>("home");
  const uiLocale = localeState.resolvedLocale;
  const continueAvailable = storageState.saveSlots.length > 0;

  async function handleContinue(): Promise<void> {
    if (!continueAvailable || continuePending) {
      return;
    }

    setContinuePending(true);
    try {
      await storageActions.onLoadSave();
      onDismiss();
    } finally {
      setContinuePending(false);
    }
  }

  return createElement(
    "section",
    {
      "aria-label": formatMessage(uiLocale, "ui.mainMenu.aria"),
      "data-testid": "main-menu-surface",
      style: overlayStyle,
    },
    createElement(
      "div",
      {
        "data-view": view,
        "data-testid": "main-menu-panel",
        style: compact ? compactPanelStyle : panelStyle,
      },
      createElement(
        "div",
        {
          style: headerStyle,
        },
        createElement(
          "div",
          {
            style: eyebrowStyle,
          },
          formatMessage(uiLocale, "ui.mainMenu.badge"),
        ),
        createElement(
          "h1",
          {
            style: titleStyle,
          },
          settlementName,
        ),
        createElement(
          "p",
          {
            style: bodyStyle,
          },
          formatMessage(uiLocale, "ui.mainMenu.summary"),
        ),
      ),
      createElement(
        "div",
        {
          style: compact ? compactMetaGridStyle : metaGridStyle,
        },
        createMetaCard(
          uiLocale,
          "ui.mainMenu.phase",
          phaseLabel,
          formatMessage(uiLocale, "ui.mainMenu.phaseHint"),
        ),
        createMetaCard(
          uiLocale,
          "ui.mainMenu.cycle",
          cycleLabel,
          formatMessage(uiLocale, "ui.mainMenu.cycleHint"),
        ),
        createMetaCard(
          uiLocale,
          "ui.mainMenu.language",
          getLocaleDisplayName(localeState.resolvedLocale, uiLocale),
          formatMessage(uiLocale, "ui.mainMenu.languageHint"),
        ),
      ),
      view === "home"
        ? createHomeView(
            compact,
            continueAvailable,
            continuePending,
            localeActions,
            localeState,
            onDismiss,
            () => {
              void handleContinue();
            },
            () => {
              setView("settings");
            },
          )
        : createSettingsView(
            compact,
            continueAvailable,
            continuePending,
            localeActions,
            localeState,
            onDismiss,
            () => {
              void handleContinue();
            },
            () => {
              setView("home");
            },
          ),
    ),
  );
}

function createHomeView(
  compact: boolean,
  continueAvailable: boolean,
  continuePending: boolean,
  localeActions: ShellLocaleActions,
  localeState: ShellLocaleState,
  onDismiss: () => void,
  onContinue: () => void,
  onOpenSettings: () => void,
): ReactElement {
  const uiLocale = localeState.resolvedLocale;

  return createElement(
    "div",
    {
      style: contentStackStyle,
    },
    createElement(
      "div",
      {
        style: buttonGroupStyle(compact),
      },
      createActionButton(formatMessage(uiLocale, "ui.mainMenu.action.newGame"), {
        onClick: onDismiss,
        primary: true,
        testId: "main-menu-new-game",
      }),
      createActionButton(
        continuePending
          ? formatMessage(uiLocale, "ui.mainMenu.action.continuePending")
          : formatMessage(uiLocale, "ui.mainMenu.action.continue"),
        {
          disabled: !continueAvailable || continuePending,
          onClick: onContinue,
          testId: "main-menu-continue",
        },
      ),
      createActionButton(formatMessage(uiLocale, "ui.mainMenu.action.settings"), {
        onClick: onOpenSettings,
        testId: "main-menu-settings",
      }),
    ),
    createElement(
      "p",
      {
        "data-testid": "main-menu-continue-status",
        style: detailStyle,
      },
      formatMessage(
        uiLocale,
        continueAvailable ? "ui.mainMenu.continue.ready" : "ui.mainMenu.continue.empty",
      ),
    ),
    createElement(
      "section",
      {
        "aria-label": formatMessage(uiLocale, "ui.mainMenu.language"),
        "data-testid": "main-menu-language",
        style: localeSectionStyle,
      },
      createElement(
        "div",
        {
          style: localeHeaderStyle,
        },
        createElement(
          "div",
          {
            style: sectionTitleStyle,
          },
          formatMessage(uiLocale, "ui.mainMenu.language"),
        ),
        createElement(
          "p",
          {
            style: bodyStyle,
          },
          formatMessage(uiLocale, "ui.mainMenu.languageHint"),
        ),
      ),
      createElement(
        "div",
        {
          style: segmentedRowStyle,
        },
        createLocaleButton(localeActions, localeState, "system"),
        createLocaleButton(localeActions, localeState, "zh-CN"),
        createLocaleButton(localeActions, localeState, "en"),
      ),
    ),
  );
}

function createSettingsView(
  compact: boolean,
  continueAvailable: boolean,
  continuePending: boolean,
  localeActions: ShellLocaleActions,
  localeState: ShellLocaleState,
  onDismiss: () => void,
  onContinue: () => void,
  onBack: () => void,
): ReactElement {
  const uiLocale = localeState.resolvedLocale;

  return createElement(
    "div",
    {
      style: contentStackStyle,
    },
    createElement(
      "div",
      {
        style: headerStyle,
      },
      createElement(
        "div",
        {
          style: sectionTitleStyle,
        },
        formatMessage(uiLocale, "ui.mainMenu.settings.title"),
      ),
      createElement(
        "p",
        {
          style: bodyStyle,
        },
        formatMessage(uiLocale, "ui.mainMenu.settings.summary"),
      ),
    ),
    createElement(
      "div",
      {
        style: compact ? compactSettingsLayoutStyle : settingsLayoutStyle,
      },
      createElement(ShellSettingsPanel, {
        actions: localeActions,
        state: localeState,
      }),
      createElement(
        "p",
        {
          style: detailStyle,
        },
        formatMessage(uiLocale, "ui.mainMenu.settings.hint"),
      ),
    ),
    createElement(
      "div",
      {
        style: buttonGroupStyle(compact),
      },
      createActionButton(formatMessage(uiLocale, "ui.mainMenu.action.back"), {
        onClick: onBack,
        testId: "main-menu-back",
      }),
      createActionButton(formatMessage(uiLocale, "ui.mainMenu.action.newGame"), {
        onClick: onDismiss,
        primary: true,
        testId: "main-menu-new-game",
      }),
      createActionButton(
        continuePending
          ? formatMessage(uiLocale, "ui.mainMenu.action.continuePending")
          : formatMessage(uiLocale, "ui.mainMenu.action.continue"),
        {
          disabled: !continueAvailable || continuePending,
          onClick: onContinue,
          testId: "main-menu-continue",
        },
      ),
    ),
  );
}

function createMetaCard(
  locale: LocaleId,
  labelKey: "ui.mainMenu.cycle" | "ui.mainMenu.language" | "ui.mainMenu.phase",
  value: string,
  detail: string,
): ReactElement {
  return createElement(
    "div",
    {
      style: metaCardStyle,
    },
    createElement(
      "div",
      {
        style: metaLabelStyle,
      },
      formatMessage(locale, labelKey),
    ),
    createElement(
      "div",
      {
        style: metaValueStyle,
      },
      value,
    ),
    createElement(
      "div",
      {
        style: metaDetailStyle,
      },
      detail,
    ),
  );
}

function createLocaleButton(
  localeActions: ShellLocaleActions,
  localeState: ShellLocaleState,
  selection: LocaleSelection,
): ReactElement {
  const uiLocale = localeState.resolvedLocale;
  const active =
    selection === "system"
      ? localeState.source === "system"
      : localeState.source === "manual" && localeState.manualLocale === selection;
  const label =
    selection === "system"
      ? formatMessage(uiLocale, "ui.mainMenu.language.system")
      : getLocaleDisplayName(selection, uiLocale);

  return createElement(
    "button",
    {
      "data-active": active ? "true" : "false",
      "data-testid": `main-menu-locale-${selection}`,
      onClick: (): void => {
        if (selection === "system") {
          void localeActions.onUseSystemLocale();
          return;
        }

        void localeActions.onUseManualLocale(selection);
      },
      style: localeButtonStyle(active),
      type: "button",
    },
    label,
  );
}

function createActionButton(
  label: string,
  options: {
    readonly disabled?: boolean;
    readonly onClick: () => void;
    readonly primary?: boolean;
    readonly testId: string;
  },
): ReactElement {
  const { disabled = false, onClick, primary = false, testId } = options;

  return createElement(
    "button",
    {
      "data-testid": testId,
      disabled,
      onClick,
      style: actionButtonStyle(primary, disabled),
      type: "button",
    },
    label,
  );
}

function buttonGroupStyle(compact: boolean): CSSProperties {
  return {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))",
  };
}

function actionButtonStyle(primary: boolean, disabled: boolean): CSSProperties {
  return {
    background: disabled
      ? "rgba(58, 48, 37, 0.6)"
      : primary
        ? "linear-gradient(180deg, #7e5832 0%, #5a3e25 100%)"
        : "rgba(241, 230, 204, 0.12)",
    border: `1px solid ${primary ? "rgba(241, 230, 204, 0.18)" : "rgba(126, 111, 85, 0.48)"}`,
    borderRadius: "12px",
    color: disabled ? "rgba(245, 234, 210, 0.48)" : "#f5ead2",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: "20px",
    minHeight: "52px",
    padding: "14px 16px",
    textAlign: "left",
    transition: "background 120ms ease, border-color 120ms ease, transform 120ms ease",
  };
}

function localeButtonStyle(active: boolean): CSSProperties {
  return {
    background: active ? "rgba(217, 150, 58, 0.18)" : "rgba(255, 255, 255, 0.04)",
    border: `1px solid ${active ? "rgba(217, 150, 58, 0.72)" : "rgba(232, 206, 151, 0.18)"}`,
    borderRadius: "999px",
    color: "#f5ead2",
    cursor: "pointer",
    fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "18px",
    minHeight: "42px",
    padding: "10px 14px",
  };
}

const overlayStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  inset: 0,
  justifyContent: "flex-start",
  overflowY: "auto",
  padding: "16px",
  pointerEvents: "none",
  position: "absolute",
};

const panelStyle: CSSProperties = {
  alignSelf: "flex-start",
  background: "linear-gradient(180deg, rgba(34, 27, 20, 0.96) 0%, rgba(18, 15, 11, 0.96) 100%)",
  border: "1px solid rgba(217, 150, 58, 0.26)",
  borderRadius: "24px",
  boxSizing: "border-box",
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.36)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  maxHeight: "calc(100dvh - 32px)",
  maxWidth: "520px",
  minWidth: "320px",
  overflowY: "auto",
  padding: "28px",
  pointerEvents: "auto",
  position: "relative",
  width: "min(520px, calc(100vw - 32px))",
};

const compactPanelStyle: CSSProperties = {
  ...panelStyle,
  gap: "16px",
  maxWidth: "none",
  minWidth: 0,
  padding: "20px",
  width: "100%",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const eyebrowStyle: CSSProperties = {
  color: "#d5b87a",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  lineHeight: "16px",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  color: "#f5ead2",
  fontFamily: '"Noto Serif SC", "Noto Sans SC", serif',
  fontSize: "36px",
  fontWeight: 700,
  lineHeight: "40px",
  margin: 0,
};

const bodyStyle: CSSProperties = {
  color: "#d6c8b2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
};

const metaGridStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const compactMetaGridStyle: CSSProperties = {
  ...metaGridStyle,
  gridTemplateColumns: "1fr",
};

const metaCardStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
  padding: "12px 14px",
};

const metaLabelStyle: CSSProperties = {
  color: "#d3cab6",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const metaValueStyle: CSSProperties = {
  color: "#f5ead2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: "20px",
};

const metaDetailStyle: CSSProperties = {
  color: "#b9aa92",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  lineHeight: "17px",
};

const contentStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const detailStyle: CSSProperties = {
  color: "#c8baa2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  margin: 0,
};

const localeSectionStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.035)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "14px",
};

const localeHeaderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const sectionTitleStyle: CSSProperties = {
  color: "#f5ead2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "22px",
};

const segmentedRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const settingsLayoutStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)",
};

const compactSettingsLayoutStyle: CSSProperties = {
  alignItems: "stretch",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};
