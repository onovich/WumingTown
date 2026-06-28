import { createElement, useState, type CSSProperties, type ReactElement } from "react";

import {
  formatMessage,
  getLocaleDisplayName,
  type LocaleId,
  type ShellLocaleState,
} from "./localization";
import {
  SHELL_DESIGN_TOKENS,
  createCommandButtonStyle,
  createShellSurfaceStyle,
  shellTokenLayerStyle,
} from "./shell-design-tokens";
import { localizeShellFixtureText } from "./shell-read-model-localization";
import { ShellSettingsPanel } from "./shell-settings-panel";
import type {
  ShellSettingsActions,
  ShellState,
  ShellStorageActions,
  ShellStorageGateState,
} from "./shell-store";
import type { ShellUiScaleState } from "./shell-ui-scale";

export interface ShellMainMenuSurfaceProps {
  readonly compact: boolean;
  readonly cycleLabel: string;
  readonly settingsActions: ShellSettingsActions;
  readonly localeState: ShellLocaleState;
  readonly nextGoal: ShellState["readModel"]["town"]["alerts"][number] | undefined;
  readonly onDismiss: () => void;
  readonly phaseLabel: string;
  readonly phaseMeaning: string;
  readonly settlementName: string;
  readonly storageActions: Pick<ShellStorageActions, "onLoadSave">;
  readonly storageState: Pick<ShellStorageGateState, "saveSlots">;
  readonly uiScaleState: ShellUiScaleState;
}

type AlertSeverity = ShellState["readModel"]["town"]["alerts"][number]["severity"];
type MainMenuView = "home" | "settings";
type LocaleSelection = LocaleId | "system";
type NextGoal = ShellMainMenuSurfaceProps["nextGoal"];

interface LocalizedNextGoalCopy {
  readonly detail: string;
  readonly severity: AlertSeverity;
  readonly title: string;
}

export function ShellMainMenuSurface({
  compact,
  cycleLabel,
  settingsActions,
  localeState,
  nextGoal,
  onDismiss,
  phaseLabel,
  phaseMeaning,
  settlementName,
  storageActions,
  storageState,
  uiScaleState,
}: ShellMainMenuSurfaceProps): ReactElement {
  const [continuePending, setContinuePending] = useState(false);
  const [view, setView] = useState<MainMenuView>("home");
  const uiLocale = localeState.resolvedLocale;
  const continueAvailable = storageState.saveSlots.length > 0;
  const phaseDisplayLabel = localizeShellFixtureText(uiLocale, phaseLabel);

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
      "data-ui-slot": "hud.start-surface",
      "data-testid": "main-menu-surface",
      style: overlayStyle,
    },
    createElement(
      "div",
      {
        "data-view": view,
        "data-testid": "main-menu-panel",
        "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelPaper,
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
          localizeShellFixtureText(uiLocale, settlementName),
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
          phaseDisplayLabel,
          formatMessage(uiLocale, "ui.mainMenu.phaseHint"),
        ),
        createMetaCard(
          uiLocale,
          "ui.mainMenu.cycle",
          localizeShellFixtureText(uiLocale, cycleLabel),
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
            nextGoal,
            phaseMeaning,
            settingsActions,
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
            settingsActions,
            localeState,
            uiScaleState,
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
  nextGoal: NextGoal,
  phaseMeaning: string,
  settingsActions: ShellSettingsActions,
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
    createFirstPlayGuidance(uiLocale, phaseMeaning, nextGoal),
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
        createLocaleButton(settingsActions, localeState, "system"),
        createLocaleButton(settingsActions, localeState, "zh-CN"),
        createLocaleButton(settingsActions, localeState, "en"),
      ),
    ),
  );
}

function createFirstPlayGuidance(
  locale: LocaleId,
  phaseMeaning: string,
  nextGoal: NextGoal,
): ReactElement {
  const nextGoalCopy = localizeNextGoal(locale, nextGoal);

  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.mainMenu.firstPlay.title"),
      "data-testid": "main-menu-first-play-guidance",
      style: firstPlayPanelStyle,
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
        formatMessage(locale, "ui.mainMenu.firstPlay.title"),
      ),
      createElement(
        "p",
        {
          style: bodyStyle,
        },
        phaseMeaning,
      ),
    ),
    createElement(
      "div",
      {
        style: firstPlayGridStyle,
      },
      createGuidanceCard(
        formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal"),
        nextGoalCopy.title,
        nextGoalCopy.detail,
        nextGoalCopy.severity,
        "main-menu-next-goal",
      ),
      createGuidanceListCard(
        formatMessage(locale, "ui.mainMenu.firstPlay.actions"),
        [
          formatMessage(locale, "ui.mainMenu.firstPlay.action.newGame"),
          formatMessage(locale, "ui.mainMenu.firstPlay.action.select"),
          formatMessage(locale, "ui.mainMenu.firstPlay.action.camera"),
          formatMessage(locale, "ui.mainMenu.firstPlay.action.lampCommand"),
          formatMessage(locale, "ui.mainMenu.firstPlay.action.continue"),
          formatMessage(locale, "ui.mainMenu.firstPlay.action.settings"),
        ],
        "main-menu-available-actions",
      ),
      createGuidanceCard(
        formatMessage(locale, "ui.mainMenu.firstPlay.boundaryTitle"),
        formatMessage(locale, "ui.mainMenu.firstPlay.boundaryTitle"),
        formatMessage(locale, "ui.mainMenu.firstPlay.boundary"),
        "stable",
        "main-menu-guidance-boundary",
      ),
    ),
  );
}

function localizeNextGoal(locale: LocaleId, nextGoal: NextGoal): LocalizedNextGoalCopy {
  const severity = nextGoal?.severity ?? "stable";
  if (nextGoal === undefined) {
    return {
      detail: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.noneDetail"),
      severity,
      title: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.none"),
    };
  }

  if (locale === "en") {
    return {
      detail: nextGoal.detail,
      severity,
      title: nextGoal.label,
    };
  }

  if (isLanternPressure(nextGoal)) {
    return {
      detail: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.lanternDetail"),
      severity,
      title: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.lanternTitle"),
    };
  }

  if (severity === "danger") {
    return {
      detail: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.dangerDetail"),
      severity,
      title: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.dangerTitle"),
    };
  }

  if (severity === "warning") {
    return {
      detail: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.warningDetail"),
      severity,
      title: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.warningTitle"),
    };
  }

  return {
    detail: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.stableDetail"),
    severity,
    title: formatMessage(locale, "ui.mainMenu.firstPlay.nextGoal.stableTitle"),
  };
}

function isLanternPressure(nextGoal: NonNullable<NextGoal>): boolean {
  const source = `${nextGoal.label} ${nextGoal.detail}`.toLowerCase();
  return source.includes("lantern") || source.includes("lamp") || source.includes("light");
}

function createGuidanceCard(
  label: string,
  title: string,
  detail: string,
  severity: AlertSeverity,
  testId: string,
): ReactElement {
  return createElement(
    "section",
    {
      "data-severity": severity,
      "data-testid": testId,
      style: guidanceCardStyle,
    },
    createElement(
      "div",
      {
        style: guidanceLabelStyle,
      },
      label,
    ),
    createElement(
      "div",
      {
        style: guidanceTitleStyle,
      },
      title,
    ),
    createElement(
      "p",
      {
        style: guidanceDetailStyle,
      },
      detail,
    ),
  );
}

function createGuidanceListCard(
  label: string,
  items: readonly string[],
  testId: string,
): ReactElement {
  return createElement(
    "section",
    {
      "data-testid": testId,
      style: guidanceCardStyle,
    },
    createElement(
      "div",
      {
        style: guidanceLabelStyle,
      },
      label,
    ),
    createElement(
      "ul",
      {
        style: guidanceListStyle,
      },
      ...items.map((item) =>
        createElement(
          "li",
          {
            key: item,
            style: guidanceListItemStyle,
          },
          item,
        ),
      ),
    ),
  );
}

function createSettingsView(
  compact: boolean,
  continueAvailable: boolean,
  continuePending: boolean,
  settingsActions: ShellSettingsActions,
  localeState: ShellLocaleState,
  uiScaleState: ShellUiScaleState,
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
        actions: settingsActions,
        localeState,
        uiScaleState,
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
  settingsActions: ShellSettingsActions,
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
      "data-ui-slot": active
        ? SHELL_DESIGN_TOKENS.slot.buttonSecondaryActive
        : SHELL_DESIGN_TOKENS.slot.buttonSecondaryDefault,
      "data-testid": `main-menu-locale-${selection}`,
      "aria-pressed": active,
      onClick: (): void => {
        if (selection === "system") {
          void settingsActions.onUseSystemLocale();
          return;
        }

        void settingsActions.onUseManualLocale(selection);
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
      "data-ui-slot": disabled
        ? primary
          ? SHELL_DESIGN_TOKENS.slot.buttonPrimaryDisabled
          : SHELL_DESIGN_TOKENS.slot.buttonSecondaryDisabled
        : primary
          ? SHELL_DESIGN_TOKENS.slot.buttonPrimaryDefault
          : SHELL_DESIGN_TOKENS.slot.buttonSecondaryDefault,
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
  return createCommandButtonStyle(
    primary ? "primary" : "secondary",
    disabled ? "disabled" : "default",
  );
}

function localeButtonStyle(active: boolean): CSSProperties {
  return {
    ...createCommandButtonStyle("secondary", active ? "active" : "default"),
    minHeight: SHELL_DESIGN_TOKENS.button.minHeightCompact,
    padding: "10px 14px",
  };
}

const overlayStyle: CSSProperties = {
  ...shellTokenLayerStyle,
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
  ...createShellSurfaceStyle("ink", {
    gap: "20px",
    padding: "28px",
    radius: SHELL_DESIGN_TOKENS.radius.slip,
  }),
  alignSelf: "flex-start",
  boxSizing: "border-box",
  maxHeight: "calc(100% - 32px)",
  maxWidth: "520px",
  minWidth: "320px",
  overflowY: "auto",
  pointerEvents: "auto",
  position: "relative",
  width: "min(520px, 100%)",
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
  color: "rgba(245, 234, 210, 0.8)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: "16px",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  color: "var(--shell-color-text-inverse)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyRecord,
  fontSize: "36px",
  fontWeight: 700,
  lineHeight: "40px",
  margin: 0,
};

const bodyStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.78)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
  overflowWrap: "anywhere",
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
  ...createShellSurfaceStyle("agedPaper", {
    gap: "4px",
    padding: "12px 14px",
    radius: SHELL_DESIGN_TOKENS.radius.panel,
  }),
};

const metaLabelStyle: CSSProperties = {
  color: "var(--shell-color-text-muted)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const metaValueStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: "20px",
};

const metaDetailStyle: CSSProperties = {
  color: "var(--shell-color-text-warm)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "12px",
  lineHeight: "17px",
  overflowWrap: "anywhere",
};

const contentStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const detailStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.74)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  lineHeight: "18px",
  margin: 0,
  overflowWrap: "anywhere",
};

const localeSectionStyle: CSSProperties = {
  ...createShellSurfaceStyle("wood", {
    gap: "12px",
    padding: "14px",
    radius: SHELL_DESIGN_TOKENS.radius.slip,
  }),
};

const firstPlayPanelStyle: CSSProperties = {
  ...localeSectionStyle,
  gap: "14px",
};

const firstPlayGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "1fr",
};

const guidanceCardStyle: CSSProperties = {
  ...createShellSurfaceStyle("paper", {
    gap: "6px",
    padding: "10px 12px",
    radius: SHELL_DESIGN_TOKENS.radius.panel,
  }),
};

const guidanceLabelStyle: CSSProperties = {
  color: "var(--shell-color-text-muted)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const guidanceTitleStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: "19px",
};

const guidanceDetailStyle: CSSProperties = {
  color: "var(--shell-color-text-warm)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "12px",
  lineHeight: "17px",
  margin: 0,
  overflowWrap: "anywhere",
};

const guidanceListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  margin: 0,
  paddingLeft: "18px",
};

const guidanceListItemStyle: CSSProperties = {
  color: "var(--shell-color-text-warm)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "12px",
  lineHeight: "17px",
  overflowWrap: "anywhere",
};

const localeHeaderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const sectionTitleStyle: CSSProperties = {
  color: "inherit",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
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
