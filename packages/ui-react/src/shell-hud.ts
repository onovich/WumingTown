import {
  createElement,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { WorldEntityReadModel } from "@wuming-town/sim-protocol";

import { formatMessage, type LocaleId } from "./localization";
import {
  SHELL_DESIGN_TOKENS,
  createCommandButtonStyle,
  createHairlineRuleStyle,
  createNightRiskSurfaceStyle,
  createShellSurfaceStyle,
  createStatusBadgeStyle,
  createTrendBadgeStyle,
  shellTokenLayerStyle,
  type ShellNightRiskTier,
} from "./shell-design-tokens";
import {
  localizeShellFixtureText,
  localizeShellLastInputLabel,
} from "./shell-read-model-localization";
import { ShellMainMenuSurface } from "./shell-main-menu-surface";
import { ShellSettingsPanel } from "./shell-settings-panel";
import { ShellStoragePanel } from "./shell-storage-panel";
import { getSelectedEntity, type ShellState, type ShellStore } from "./shell-store";
import type { ShellSettingsActions, ShellStorageActions } from "./shell-store";

type AlertSeverity = ShellState["readModel"]["town"]["alerts"][number]["severity"];
type NeedState = WorldEntityReadModel["inspector"]["needs"][number]["state"];
type NightRiskTier = ShellNightRiskTier;

export interface ShellHudRootProps {
  readonly settingsActions: ShellSettingsActions;
  readonly store: ShellStore;
  readonly storageActions: ShellStorageActions;
}

interface ResidentAttentionItem {
  readonly entity: WorldEntityReadModel;
  readonly stateLabel: string;
  readonly tone: AlertSeverity;
  readonly topNeed: WorldEntityReadModel["inspector"]["needs"][number] | undefined;
}

interface PlayerHudModel {
  readonly nextGoal: ShellState["readModel"]["town"]["alerts"][number] | undefined;
  readonly nightRisk: {
    readonly reasons: readonly string[];
    readonly tier: NightRiskTier;
  };
  readonly phaseMeaning: string;
  readonly residentItems: readonly ResidentAttentionItem[];
  readonly taskEntities: readonly WorldEntityReadModel[];
}

export function createShellHudElement(
  store: ShellStore,
  storageActions: ShellStorageActions,
  settingsActions: ShellSettingsActions,
): ReactElement {
  return createElement(ShellHudRoot, {
    settingsActions,
    store,
    storageActions,
  });
}

export function ShellHudRoot({
  settingsActions,
  store,
  storageActions,
}: ShellHudRootProps): ReactElement {
  const [startSurfaceDismissed, setStartSurfaceDismissed] = useState(false);
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
  const selectedEntity = getSelectedEntity(state);
  const compactLayout = state.canvasWidth < 1040;
  const uiLocale = state.locale.resolvedLocale;
  const uiScalePreference = state.uiScale.preference;
  const uiScaleFactor = state.uiScale.factor;
  const startSurfaceVisible = !state.diagnosticsVisible && !startSurfaceDismissed;
  const startNextGoal = selectPriorityAlert(state.readModel.town.alerts);
  const startPhaseMeaning = readPhaseMeaning(state.readModel.town.phaseLabel, uiLocale);

  if (startSurfaceVisible) {
    return createElement(
      "div",
      {
        "data-diagnostics-visible": "false",
        "data-locale": uiLocale,
        "data-locale-source": state.locale.source,
        "data-shell-ready": "true",
        "data-ui-scale": uiScalePreference,
        "data-ui-scale-factor": String(uiScaleFactor),
        style: overlayRootStyle,
      },
      createElement(
        "div",
        {
          style: scaleLayerStyle(uiScaleFactor),
        },
        createElement(ShellMainMenuSurface, {
          compact: compactLayout,
          cycleLabel: state.readModel.town.cycleLabel,
          settingsActions,
          localeState: state.locale,
          nextGoal: startNextGoal,
          onDismiss: () => {
            setStartSurfaceDismissed(true);
          },
          phaseLabel: state.readModel.town.phaseLabel,
          phaseMeaning: startPhaseMeaning,
          settlementName: state.readModel.town.settlementName,
          storageActions,
          storageState: state.storageGate,
          uiScaleState: state.uiScale,
        }),
      ),
    );
  }

  const playerHud = createPlayerHudModel(state, selectedEntity, uiLocale);

  return createElement(
    "div",
    {
      "data-diagnostics-visible": state.diagnosticsVisible ? "true" : "false",
      "data-locale": uiLocale,
      "data-locale-source": state.locale.source,
      "data-shell-ready": "true",
      "data-ui-scale": uiScalePreference,
      "data-ui-scale-factor": String(uiScaleFactor),
      style: overlayRootStyle,
    },
    createElement(
      "div",
      {
        style: scaleLayerStyle(uiScaleFactor),
      },
      createElement(
        "section",
        {
          "aria-label": formatMessage(uiLocale, "ui.hud.aria"),
          "data-ui-slot": "hud.shell",
          "data-testid": "player-hud",
          key: "player-hud",
          style: hudLayerStyle,
        },
        createTopBar(state, playerHud, uiLocale, compactLayout),
        createAlertStrip(state, uiLocale, compactLayout),
        compactLayout
          ? createCompactHudBody(state, playerHud, selectedEntity, uiLocale, settingsActions)
          : createDesktopHudBody(state, playerHud, selectedEntity, uiLocale, settingsActions),
        state.diagnosticsVisible ? createDebugOverlay(state, storageActions, compactLayout) : null,
      ),
    ),
  );
}

function createTopBar(
  state: ShellState,
  playerHud: PlayerHudModel,
  locale: LocaleId,
  compactLayout: boolean,
): ReactElement {
  if (compactLayout) {
    return createElement(
      "section",
      {
        "aria-label": formatMessage(locale, "ui.surface.topBar"),
        "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
        "data-testid": "player-top-bar",
        style: compactTopBarStyle,
      },
      createIdentityCard(state, locale, playerHud, true),
    );
  }

  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.surface.topBar"),
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      "data-testid": "player-top-bar",
      style: topBarStyle,
    },
    createIdentityCard(state, locale, playerHud, false),
    createElement(
      "div",
      {
        style: topBarAsideStyle,
      },
      createNightRiskBadge(playerHud.nightRisk.tier, locale, false),
      createResourceStrip(state, locale),
    ),
  );
}

function createAlertStrip(
  state: ShellState,
  locale: LocaleId,
  compactLayout: boolean,
): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.surface.alerts"),
      "data-testid": "player-alert-strip",
      style: compactLayout ? compactAlertStripStyle : alertStripStyle,
    },
    ...state.readModel.town.alerts.slice(0, compactLayout ? 1 : 3).map((alert) =>
      createElement(
        "article",
        {
          "aria-label": `${formatAlertSeverity(alert.severity, locale)}: ${localizeShellFixtureText(locale, alert.label)}. ${localizeShellFixtureText(locale, alert.detail)}`,
          "data-alert-severity": alert.severity,
          "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelAlert,
          key: `${alert.severity}:${alert.label}:strip`,
          style: alertSlipStyle(alert.severity),
        },
        createElement(
          "div",
          {
            style: rowHeaderStyle,
          },
          createElement(
            "div",
            {
              style: rowTitleStyle,
            },
            localizeShellFixtureText(locale, alert.label),
          ),
          createElement(
            "div",
            {
              style: severityBadgeStyle(alert.severity),
            },
            formatAlertSeverity(alert.severity, locale).toUpperCase(),
          ),
        ),
      ),
    ),
  );
}

function createDesktopHudBody(
  state: ShellState,
  playerHud: PlayerHudModel,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  settingsActions: ShellSettingsActions,
): ReactElement {
  return createElement(
    "div",
    {
      style: desktopHudBodyStyle,
    },
    createElement(
      "div",
      {
        style: desktopHudColumnStyle,
      },
      createCurrentStateCard(state, playerHud.phaseMeaning, locale),
      createNextGoalCard(playerHud, locale),
      createCommandBarPlaceholder(locale),
      createTaskCard(playerHud.taskEntities, locale),
      createEventCard(state, locale),
    ),
    createElement("div", {
      style: desktopMapLaneStyle,
    }),
    createElement(
      "aside",
      {
        "aria-label": formatMessage(locale, "ui.inspector.aria"),
        "data-selected-entity": selectedEntity?.entityId ?? "",
        style: desktopHudColumnStyle,
      },
      createInspectorCard(state, selectedEntity, locale, false),
      createResidentAttentionCard(playerHud.residentItems, locale),
      createElement(ShellSettingsPanel, {
        actions: settingsActions,
        localeState: state.locale,
        uiScaleState: state.uiScale,
      }),
    ),
  );
}

function createCompactHudBody(
  state: ShellState,
  playerHud: PlayerHudModel,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  settingsActions: ShellSettingsActions,
): ReactElement {
  return createElement(
    "div",
    {
      style: compactHudBodyStyle,
    },
    createNightRiskBadge(playerHud.nightRisk.tier, locale, true),
    createCurrentStateCard(state, playerHud.phaseMeaning, locale),
    createResourceSummaryCard(state, locale),
    createNextGoalCard(playerHud, locale),
    createCommandBarPlaceholder(locale),
    createTaskCard(playerHud.taskEntities, locale),
    createEventCard(state, locale),
    createResidentAttentionCard(playerHud.residentItems, locale),
    createElement(
      "aside",
      {
        "aria-label": formatMessage(locale, "ui.inspector.aria"),
        "data-selected-entity": selectedEntity?.entityId ?? "",
        style: compactInspectorPanelStyle,
      },
      createInspectorCard(state, selectedEntity, locale, true),
    ),
    createElement(ShellSettingsPanel, {
      actions: settingsActions,
      localeState: state.locale,
      uiScaleState: state.uiScale,
    }),
  );
}

function createResourceStrip(state: ShellState, locale: LocaleId): ReactElement {
  return createElement(
    "div",
    {
      style: summaryGroupStyle,
    },
    ...state.readModel.town.resources.map((resource) =>
      createElement(
        "div",
        {
          key: resource.label,
          "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelPaper,
          style: resourceCardStyle,
        },
        createElement(
          "div",
          {
            style: resourceHeaderStyle,
          },
          createElement(
            "span",
            {
              style: sectionEyebrowStyle,
            },
            localizeShellFixtureText(locale, resource.label),
          ),
          createElement(
            "span",
            {
              style: trendBadgeStyle(resource.trend),
            },
            formatResourceTrend(resource.trend, locale),
          ),
        ),
        createElement(
          "div",
          {
            style: resourceValueStyle,
          },
          `${String(resource.amount)}${localizeShellFixtureText(locale, resource.unit)}`,
        ),
      ),
    ),
  );
}

function createResourceSummaryCard(state: ShellState, locale: LocaleId): ReactElement {
  return createElement(
    "section",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      style: resourceBandStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.surface.topBar"),
      formatMessage(locale, "ui.hud.map"),
      "neutral",
      true,
    ),
    createResourceStrip(state, locale),
  );
}

function createCurrentStateCard(
  state: ShellState,
  phaseMeaning: string,
  locale: LocaleId,
): ReactElement {
  return createElement(
    "section",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelPaper,
      style: paperCardStyle,
    },
    createSectionHeader(formatMessage(locale, "ui.hud.currentState"), phaseMeaning),
    createDefinitionStack([
      {
        label: formatMessage(locale, "ui.hud.phase"),
        value: localizeShellFixtureText(locale, state.readModel.town.phaseLabel),
      },
      {
        label: formatMessage(locale, "ui.hud.cycle"),
        value: localizeShellFixtureText(locale, state.readModel.town.cycleLabel),
      },
      {
        label: formatMessage(locale, "ui.hud.speed"),
        value: localizeShellFixtureText(locale, state.readModel.town.speedLabel),
      },
      {
        label: formatMessage(locale, "ui.hud.map"),
        value: localizeShellFixtureText(locale, state.readModel.mapName),
      },
    ]),
  );
}

function createNextGoalCard(model: PlayerHudModel, locale: LocaleId): ReactElement {
  const nextGoal = model.nextGoal;
  const title =
    nextGoal === undefined
      ? formatMessage(locale, "ui.hud.nextGoal.none")
      : localizeShellFixtureText(locale, nextGoal.label);
  const detail =
    nextGoal === undefined
      ? formatMessage(locale, "ui.hud.nextGoal.noneDetail")
      : localizeShellFixtureText(locale, nextGoal.detail);
  const severity = nextGoal?.severity ?? "stable";

  return createElement(
    "section",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelPaper,
      "data-testid": "player-next-goal",
      style: paperCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.nextGoal"),
      formatAlertSeverity(severity, locale),
      severity,
    ),
    createElement(
      "div",
      {
        style: keyOutcomeStyle,
      },
      title,
    ),
    createElement(
      "p",
      {
        style: bodyTextStyle,
      },
      detail,
    ),
    createElement(
      "div",
      {
        style: reasonListStyle,
      },
      ...model.nightRisk.reasons.map((reason) =>
        createElement(
          "div",
          {
            key: reason,
            style: inlineReasonStyle,
          },
          reason,
        ),
      ),
    ),
  );
}

function createTaskCard(
  taskEntities: readonly WorldEntityReadModel[],
  locale: LocaleId,
): ReactElement {
  return createElement(
    "section",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      "data-testid": "player-task-list",
      style: inkCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.tasks"),
      formatMessage(locale, "ui.hud.tasksHint"),
      "neutral",
      true,
    ),
    createElement(
      "div",
      {
        style: rowStackStyle,
      },
      ...taskEntities.map((entity) =>
        createElement(
          "div",
          {
            key: entity.entityId,
            style: infoRowStyle,
          },
          createElement(
            "div",
            {
              style: rowHeaderStyle,
            },
            createElement(
              "div",
              {
                style: rowTitleStyle,
              },
              localizeShellFixtureText(locale, entity.displayName),
            ),
            createElement(
              "div",
              {
                style: mutedInverseTextStyle,
              },
              localizeShellFixtureText(locale, entity.inspector.roleLabel),
            ),
          ),
          createElement(
            "div",
            {
              style: rowValueStyle,
            },
            localizeShellFixtureText(locale, entity.inspector.currentJob),
          ),
          createElement(
            "div",
            {
              style: mutedInverseTextStyle,
            },
            localizeShellFixtureText(locale, entity.inspector.currentStep),
          ),
        ),
      ),
    ),
  );
}

function createEventCard(state: ShellState, locale: LocaleId): ReactElement {
  return createElement(
    "section",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      "data-testid": "player-event-list",
      style: inkCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.events"),
      formatMessage(locale, "ui.hud.eventsHint"),
      "neutral",
      true,
    ),
    createElement(
      "div",
      {
        style: rowStackStyle,
      },
      ...state.readModel.town.alerts.map((alert) =>
        createElement(
          "div",
          {
            "aria-label": `${formatAlertSeverity(alert.severity, locale)}: ${localizeShellFixtureText(locale, alert.label)}. ${localizeShellFixtureText(locale, alert.detail)}`,
            "data-alert-severity": alert.severity,
            "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelAlert,
            key: `${alert.severity}:${alert.label}`,
            style: alertRowStyle(alert.severity),
          },
          createElement(
            "div",
            {
              style: rowHeaderStyle,
            },
            createElement(
              "div",
              {
                style: rowTitleStyle,
              },
              localizeShellFixtureText(locale, alert.label),
            ),
            createElement(
              "div",
              {
                style: severityBadgeStyle(alert.severity),
              },
              formatAlertSeverity(alert.severity, locale).toUpperCase(),
            ),
          ),
          createElement(
            "div",
            {
              style: mutedInverseTextStyle,
            },
            localizeShellFixtureText(locale, alert.detail),
          ),
        ),
      ),
    ),
  );
}

function createInspectorCard(
  state: ShellState,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  compact: boolean,
): ReactElement {
  if (selectedEntity === undefined) {
    return createElement(
      "section",
      {
        "data-testid": "player-selected-detail",
        "data-ui-slot": SHELL_DESIGN_TOKENS.slot.inspector,
        style: compact ? compactInspectorCardStyle : paperCardStyle,
      },
      createSectionHeader(
        formatMessage(locale, "ui.hud.selected"),
        formatMessage(locale, "ui.inspector.selected"),
      ),
      createElement(
        "div",
        {
          style: emptyStateTitleStyle,
        },
        formatMessage(locale, "ui.inspector.noSelection.title"),
      ),
      createElement(
        "p",
        {
          style: bodyTextStyle,
        },
        formatMessage(locale, "ui.inspector.noSelection.body"),
      ),
    );
  }

  return createElement(
    "section",
    {
      "data-testid": "player-selected-detail",
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.inspector,
      style: compact ? compactInspectorCardStyle : paperCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.selected"),
      formatMessage(locale, "ui.inspector.location", {
        kind: formatEntityKind(selectedEntity.kind, locale),
        tileLabel: formatMessage(locale, "ui.inspector.tile"),
        x: String(selectedEntity.tile.x),
        y: String(selectedEntity.tile.y),
      }),
    ),
    createElement(
      "div",
      {
        style: cardTitleStyle,
      },
      localizeShellFixtureText(locale, selectedEntity.displayName),
    ),
    createElement(
      "div",
      {
        style: mutedTextStyle,
      },
      formatMessage(locale, "ui.inspector.roleSummary", {
        role: localizeShellFixtureText(locale, selectedEntity.inspector.roleLabel),
        summary: localizeShellFixtureText(locale, selectedEntity.summary),
      }),
    ),
    createPairGrid(locale, [
      {
        label: formatMessage(locale, "ui.inspector.currentJob"),
        value: localizeShellFixtureText(locale, selectedEntity.inspector.currentJob),
      },
      {
        label: formatMessage(locale, "ui.inspector.currentStep"),
        value: localizeShellFixtureText(locale, selectedEntity.inspector.currentStep),
      },
      {
        label: formatMessage(locale, "ui.inspector.mood"),
        value: localizeShellFixtureText(locale, selectedEntity.inspector.moodLabel),
      },
      {
        label: formatMessage(locale, "ui.inspector.health"),
        value: localizeShellFixtureText(locale, selectedEntity.inspector.healthLabel),
      },
      {
        label: formatMessage(locale, "ui.inspector.lastInput"),
        value: localizeShellLastInputLabel(locale, state.lastInputLabel),
      },
      {
        label: formatMessage(locale, "ui.inspector.decision"),
        value: localizeShellFixtureText(locale, selectedEntity.inspector.lastDecision),
      },
    ]),
    createNeedSection(selectedEntity, locale),
    createBulletSection(
      formatMessage(locale, "ui.inspector.why"),
      selectedEntity.inspector.explainers.map((item) => localizeShellFixtureText(locale, item)),
      false,
    ),
    createBulletSection(
      formatMessage(locale, "ui.inspector.thoughts"),
      selectedEntity.inspector.thoughts.map((item) => localizeShellFixtureText(locale, item)),
      false,
    ),
  );
}

function createResidentAttentionCard(
  residentItems: readonly ResidentAttentionItem[],
  locale: LocaleId,
): ReactElement {
  return createElement(
    "section",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      "data-testid": "player-resident-watch",
      style: inkCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.residents"),
      formatMessage(locale, "ui.hud.residentsHint"),
      "neutral",
      true,
    ),
    createElement(
      "div",
      {
        style: rowStackStyle,
      },
      ...residentItems.map((item) =>
        createElement(
          "div",
          {
            "aria-label": `${localizeShellFixtureText(locale, item.entity.displayName)}. ${item.stateLabel}. ${localizeShellFixtureText(locale, item.entity.inspector.currentStep)}`,
            "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelAlert,
            key: item.entity.entityId,
            style: residentRowStyle(item.tone),
          },
          createElement(
            "div",
            {
              style: rowHeaderStyle,
            },
            createElement(
              "div",
              {
                style: rowTitleStyle,
              },
              localizeShellFixtureText(locale, item.entity.displayName),
            ),
            createElement(
              "div",
              {
                style: severityBadgeStyle(item.tone),
              },
              item.stateLabel,
            ),
          ),
          createElement(
            "div",
            {
              style: mutedInverseTextStyle,
            },
            formatMessage(locale, "ui.hud.residentStep", {
              role: localizeShellFixtureText(locale, item.entity.inspector.roleLabel),
              step: localizeShellFixtureText(locale, item.entity.inspector.currentStep),
            }),
          ),
          item.topNeed === undefined
            ? null
            : createElement(
                "div",
                {
                  style: mutedInverseTextStyle,
                },
                formatMessage(locale, "ui.inspector.needSummary", {
                  label: localizeShellFixtureText(locale, item.topNeed.label),
                  value: String(item.topNeed.value),
                  state: formatNeedState(item.topNeed.state, locale),
                }),
              ),
        ),
      ),
    ),
  );
}

function createNeedSection(entity: WorldEntityReadModel, locale: LocaleId): ReactElement {
  return createElement(
    "section",
    {
      style: stackSectionStyle,
    },
    createElement(
      "div",
      {
        style: sectionEyebrowStyle,
      },
      formatMessage(locale, "ui.inspector.needs"),
    ),
    createElement(
      "div",
      {
        style: needStackStyle,
      },
      ...entity.inspector.needs.map((need) =>
        createElement(
          "div",
          {
            key: need.label,
            style: needRowStyle,
          },
          createElement(
            "div",
            {
              style: rowHeaderStyle,
            },
            createElement(
              "span",
              {
                style: sectionEyebrowStyle,
              },
              localizeShellFixtureText(locale, need.label),
            ),
            createElement(
              "span",
              {
                style: mutedTextStyle,
              },
              formatMessage(locale, "ui.inspector.needSummary", {
                label: localizeShellFixtureText(locale, need.label),
                value: String(need.value),
                state: formatNeedState(need.state, locale),
              }),
            ),
          ),
          createElement("div", {
            style: meterTrackStyle,
            children: createElement("div", {
              style: meterFillStyle(need),
            }),
          }),
        ),
      ),
    ),
  );
}

function createBulletSection(
  title: string,
  items: readonly string[],
  inverse: boolean,
): ReactElement {
  return createElement(
    "section",
    {
      style: stackSectionStyle,
    },
    createElement(
      "div",
      {
        style: inverse ? sectionEyebrowInverseStyle : sectionEyebrowStyle,
      },
      title,
    ),
    createElement(
      "ul",
      {
        style: bulletListStyle,
      },
      ...items.map((item) =>
        createElement(
          "li",
          {
            key: item,
            style: inverse ? bulletItemInverseStyle : bulletItemStyle,
          },
          item,
        ),
      ),
    ),
  );
}

function createPairGrid(
  locale: LocaleId,
  items: readonly {
    readonly label: string;
    readonly value: string;
  }[],
): ReactElement {
  return createElement(
    "div",
    {
      style: pairGridStyle,
    },
    ...items.map((item) =>
      createElement(
        "div",
        {
          key: item.label,
          style: pairCellStyle,
        },
        createElement(
          "div",
          {
            style: sectionEyebrowStyle,
          },
          item.label,
        ),
        createElement(
          "div",
          {
            style: locale === "zh-CN" ? pairValueZhStyle : pairValueStyle,
          },
          item.value,
        ),
      ),
    ),
  );
}

function createDebugOverlay(
  state: ShellState,
  storageActions: ShellStorageActions,
  compactLayout: boolean,
): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Developer diagnostics",
      "data-browser-targets": state.releaseGate.browserTargets.join(","),
      "data-cross-origin-isolated": state.releaseGate.runtimeCrossOriginIsolated ? "true" : "false",
      "data-release-gate-fixture": state.releaseGate.fixtureId,
      "data-testid": "debug-overlay",
      "data-ui-slot": "panel.debug.overlay",
      style: compactLayout ? compactDebugOverlayStyle : debugOverlayStyle,
    },
    createElement(
      "div",
      {
        style: debugHeaderStyle,
      },
      createElement(
        "div",
        {
          style: debugTitleStyle,
        },
        "Debug overlay",
      ),
      createElement(
        "div",
        {
          style: debugHintStyle,
        },
        "Active because wmDiagnostics=1. Product Gate, storage, and diagnostic evidence stay out of the default player HUD.",
      ),
    ),
    createElement(
      "div",
      {
        style: debugViewportStyle,
      },
      createElement(
        "div",
        {
          style: sectionEyebrowInverseStyle,
        },
        state.releaseGate.title,
      ),
      createElement(
        "div",
        {
          style: debugHintStyle,
        },
        `${state.releaseGate.runtimeBrowser} · targets ${state.releaseGate.browserTargets.join(", ")}`,
      ),
      createElement(
        "div",
        {
          style: debugHintStyle,
        },
        `Canvas ${String(state.canvasWidth)} x ${String(state.canvasHeight)} · Zoom ${String(Math.round(state.zoom * 100))}% · Hover ${formatHoverTile(state)}`,
      ),
      createElement(
        "div",
        {
          style: debugHintStyle,
        },
        `Input ${state.lastInputLabel}`,
      ),
    ),
    createElement(
      "div",
      {
        style: rowStackStyle,
      },
      ...state.releaseGate.sections.map((section) =>
        createElement(
          "div",
          {
            key: section.label,
            style: debugRowStyle,
          },
          createElement(
            "div",
            {
              style: sectionEyebrowInverseStyle,
            },
            section.label,
          ),
          createElement(
            "div",
            {
              style: rowTitleStyle,
            },
            section.value,
          ),
          createElement(
            "div",
            {
              style: debugHintStyle,
            },
            section.detail,
          ),
        ),
      ),
    ),
    createElement(ShellStoragePanel, {
      actions: storageActions,
      state: state.storageGate,
    }),
  );
}

function createIdentityCard(
  state: ShellState,
  locale: LocaleId,
  model: PlayerHudModel,
  compact: boolean,
): ReactElement {
  const compactMeta = compact
    ? formatMessage(locale, "ui.surface.topBarMeta", {
        cycle: localizeShellFixtureText(locale, state.readModel.town.cycleLabel),
        map: localizeShellFixtureText(locale, state.readModel.town.speedLabel),
        speed: formatNightRisk(model.nightRisk.tier, locale),
      })
    : formatMessage(locale, "ui.surface.topBarMeta", {
        cycle: localizeShellFixtureText(locale, state.readModel.town.cycleLabel),
        map: localizeShellFixtureText(locale, state.readModel.mapName),
        speed: localizeShellFixtureText(locale, state.readModel.town.speedLabel),
      });
  return createElement(
    "div",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      style: compact ? compactIdentityCardStyle : identityCardStyle,
    },
    createElement(
      "div",
      {
        style: sectionEyebrowInverseStyle,
      },
      localizeShellFixtureText(locale, state.readModel.town.phaseLabel),
    ),
    createElement(
      "h1",
      {
        style: identityTitleStyle,
      },
      localizeShellFixtureText(locale, state.readModel.town.settlementName),
    ),
    createElement(
      "div",
      {
        style: identityMetaStyle,
      },
      compactMeta,
    ),
    compact
      ? null
      : createElement(
          "div",
          {
            style: identityMetaStyle,
          },
          formatMessage(locale, "ui.hud.phaseRiskSummary", {
            phaseMeaning: model.phaseMeaning,
            nightRisk: formatNightRisk(model.nightRisk.tier, locale),
            nightRiskLabel: formatMessage(locale, "ui.hud.nightRisk"),
          }),
        ),
  );
}

function createNightRiskBadge(
  tier: NightRiskTier,
  locale: LocaleId,
  compact: boolean,
): ReactElement {
  return createElement(
    "div",
    {
      "aria-label": `${formatMessage(locale, "ui.hud.nightRisk")}: ${formatNightRisk(tier, locale)}`,
      "data-testid": "player-night-risk",
      "data-night-risk-tier": tier,
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      style: compact ? compactNightRiskBadgeStyle(tier) : nightRiskBadgeStyle(tier),
    },
    createElement(
      "div",
      {
        style: sectionEyebrowInverseStyle,
      },
      formatMessage(locale, "ui.hud.nightRisk"),
    ),
    createElement(
      "div",
      {
        style: nightRiskValueStyle,
      },
      formatNightRisk(tier, locale),
    ),
  );
}

function createSectionHeader(
  title: string,
  hint: string,
  tone: AlertSeverity | "neutral" = "neutral",
  inverse = false,
): ReactElement {
  return createElement(
    "div",
    {
      style: sectionHeaderStyle,
    },
    createElement(
      "div",
      {
        style: sectionTitleStyle,
      },
      title,
    ),
    createElement(
      "div",
      {
        style:
          tone === "neutral"
            ? inverse
              ? sectionHintInverseStyle
              : sectionHintStyle
            : severityBadgeStyle(tone),
      },
      hint,
    ),
  );
}

function createCommandBarPlaceholder(locale: LocaleId): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.hud.commandBar"),
      "data-testid": "player-command-bar",
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.commandBar,
      style: commandBarStyle,
    },
    createElement(
      "div",
      {
        style: sectionHeaderStyle,
      },
      createElement(
        "div",
        {
          style: sectionTitleStyle,
        },
        formatMessage(locale, "ui.hud.commandBar"),
      ),
      createElement(
        "div",
        {
          style: sectionHintInverseStyle,
        },
        formatMessage(locale, "ui.hud.commandBarHint"),
      ),
    ),
    createElement(
      "div",
      {
        style: commandBarGroupStyle,
      },
      ...readCommandSpecs(locale).map((spec) =>
        createElement(
          "button",
          {
            "aria-describedby": `${spec.testId}-detail`,
            "aria-disabled": true,
            "data-command-state": "placeholder",
            "data-testid": spec.testId,
            "data-ui-slot":
              spec.tone === "primary"
                ? SHELL_DESIGN_TOKENS.slot.buttonPrimaryDisabled
                : SHELL_DESIGN_TOKENS.slot.buttonSecondaryDisabled,
            key: spec.testId,
            onClick: (event): void => {
              event.preventDefault();
            },
            style: commandButtonStyle(spec.tone),
            type: "button",
          },
          createElement(
            "span",
            {
              style: rowTitleStyle,
            },
            spec.title,
          ),
          createElement(
            "span",
            {
              id: `${spec.testId}-detail`,
              style: commandDetailStyle,
            },
            spec.description,
          ),
        ),
      ),
    ),
  );
}

function readCommandSpecs(locale: LocaleId): readonly {
  readonly description: string;
  readonly testId: string;
  readonly title: string;
  readonly tone: "primary" | "secondary";
}[] {
  return [
    {
      description: formatMessage(locale, "ui.hud.command.placeholder.lamp"),
      testId: "player-command-lamp",
      title: formatMessage(locale, "ui.hud.command.lamp"),
      tone: "primary",
    },
    {
      description: formatMessage(locale, "ui.hud.command.placeholder.chronicle"),
      testId: "player-command-chronicle",
      title: formatMessage(locale, "ui.hud.command.chronicle"),
      tone: "secondary",
    },
    {
      description: formatMessage(locale, "ui.hud.command.placeholder.inspect"),
      testId: "player-command-inspect",
      title: formatMessage(locale, "ui.hud.command.inspect"),
      tone: "secondary",
    },
  ];
}

function createDefinitionStack(
  items: readonly {
    readonly label: string;
    readonly value: string;
  }[],
): ReactElement {
  return createElement(
    "div",
    {
      style: definitionStackStyle,
    },
    ...items.map((item) =>
      createElement(
        "div",
        {
          key: item.label,
          style: definitionRowStyle,
        },
        createElement(
          "div",
          {
            style: sectionEyebrowStyle,
          },
          item.label,
        ),
        createElement(
          "div",
          {
            style: definitionValueStyle,
          },
          item.value,
        ),
      ),
    ),
  );
}

function createPlayerHudModel(
  state: ShellState,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
): PlayerHudModel {
  const taskEntities = collectTaskEntities(state, selectedEntity);
  return {
    nextGoal: selectPriorityAlert(state.readModel.town.alerts),
    nightRisk: createNightRiskModel(state, locale),
    phaseMeaning: readPhaseMeaning(state.readModel.town.phaseLabel, locale),
    residentItems: collectResidentAttention(state, selectedEntity, locale),
    taskEntities,
  };
}

function collectTaskEntities(
  state: ShellState,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
): readonly WorldEntityReadModel[] {
  const entities = [...state.readModel.entities];
  entities.sort((left, right) => {
    return (
      measureEntityPriority(right, selectedEntity?.entityId) -
      measureEntityPriority(left, selectedEntity?.entityId)
    );
  });
  return entities.slice(0, 3);
}

function collectResidentAttention(
  state: ShellState,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
): readonly ResidentAttentionItem[] {
  const items = state.readModel.entities
    .filter((entity) => entity.entityId !== selectedEntity?.entityId)
    .map((entity) => ({
      entity,
      stateLabel: readEntityStateLabel(entity, locale),
      tone: readEntityTone(entity),
      topNeed: selectTopNeed(entity),
    }))
    .sort((left, right) => {
      return (
        measureEntityPriority(right.entity, selectedEntity?.entityId) -
        measureEntityPriority(left.entity, selectedEntity?.entityId)
      );
    });
  return items.slice(0, 3);
}

function selectPriorityAlert(
  alerts: readonly ShellState["readModel"]["town"]["alerts"][number][],
): ShellState["readModel"]["town"]["alerts"][number] | undefined {
  let bestAlert: ShellState["readModel"]["town"]["alerts"][number] | undefined;
  let bestScore = -1;
  for (const alert of alerts) {
    const score = alert.severity === "danger" ? 3 : alert.severity === "warning" ? 2 : 1;
    if (score > bestScore) {
      bestAlert = alert;
      bestScore = score;
    }
  }
  return bestAlert;
}

function createNightRiskModel(state: ShellState, locale: LocaleId): PlayerHudModel["nightRisk"] {
  let dangerCount = 0;
  let warningCount = 0;
  const reasons: string[] = [];

  for (const alert of state.readModel.town.alerts) {
    if (alert.severity === "danger") {
      dangerCount += 1;
    }
    if (alert.severity === "warning") {
      warningCount += 1;
    }
    if (alert.severity !== "stable" && reasons.length < 2) {
      reasons.push(localizeShellFixtureText(locale, alert.label));
    }
  }

  if (reasons.length < 2) {
    for (const resource of state.readModel.town.resources) {
      if (resource.trend === "falling") {
        reasons.push(
          `${localizeShellFixtureText(locale, resource.label)} ${formatResourceTrend(resource.trend, locale)}`,
        );
        if (reasons.length >= 2) {
          break;
        }
      }
    }
  }

  const tier: NightRiskTier =
    dangerCount > 0
      ? "breach"
      : warningCount >= 2
        ? "strained"
        : warningCount === 1
          ? "watch"
          : "stable";

  return {
    reasons:
      reasons.length > 0 ? reasons : [formatMessage(locale, "ui.hud.nightRisk.noneDetected")],
    tier,
  };
}

function readPhaseMeaning(phaseLabel: string, locale: LocaleId): string {
  const normalized = phaseLabel.trim().toLowerCase();
  if (normalized.includes("dawn")) {
    return formatMessage(locale, "ui.hud.phaseMeaning.dawn");
  }
  if (normalized.includes("day")) {
    return formatMessage(locale, "ui.hud.phaseMeaning.day");
  }
  if (normalized.includes("dusk")) {
    return formatMessage(locale, "ui.hud.phaseMeaning.dusk");
  }
  if (normalized.includes("night")) {
    return formatMessage(locale, "ui.hud.phaseMeaning.night");
  }
  return formatMessage(locale, "ui.hud.phaseMeaning.default");
}

function readEntityStateLabel(entity: WorldEntityReadModel, locale: LocaleId): string {
  const topNeed = selectTopNeed(entity);
  if (topNeed !== undefined) {
    return `${localizeShellFixtureText(locale, topNeed.label)} ${formatNeedState(topNeed.state, locale)}`;
  }
  return formatMessage(locale, "ui.hud.residentSteady");
}

function selectTopNeed(
  entity: WorldEntityReadModel,
): WorldEntityReadModel["inspector"]["needs"][number] | undefined {
  const needs = [...entity.inspector.needs];
  needs.sort((left, right) => measureNeedPriority(right) - measureNeedPriority(left));
  return needs[0];
}

function measureNeedPriority(need: WorldEntityReadModel["inspector"]["needs"][number]): number {
  const stateWeight = need.state === "low" ? 300 : need.state === "high" ? 200 : 100;
  return stateWeight + need.value;
}

function readEntityTone(entity: WorldEntityReadModel): AlertSeverity {
  if (entity.inspector.healthLabel !== "Stable" && entity.inspector.healthLabel !== "Unhurt") {
    return "danger";
  }

  for (const need of entity.inspector.needs) {
    if (need.state === "low" && need.value <= 35) {
      return "danger";
    }
  }

  for (const need of entity.inspector.needs) {
    if (need.state !== "steady") {
      return "warning";
    }
  }

  return "stable";
}

function measureEntityPriority(
  entity: WorldEntityReadModel,
  selectedEntityId: string | undefined,
): number {
  let score = entity.entityId === selectedEntityId ? 1000 : 0;
  score += entity.kind === "resident" ? 80 : entity.kind === "lantern-keeper" ? 70 : 55;
  score +=
    readEntityTone(entity) === "danger" ? 90 : readEntityTone(entity) === "warning" ? 50 : 20;
  score +=
    entity.inspector.healthLabel === "Stable" || entity.inspector.healthLabel === "Unhurt" ? 0 : 30;
  score += entity.inspector.currentJob.length > 0 ? 12 : 0;
  score += entity.inspector.currentStep.length > 0 ? 8 : 0;
  return score;
}

function formatAlertSeverity(severity: AlertSeverity, locale: LocaleId): string {
  switch (severity) {
    case "danger":
      return formatMessage(locale, "ui.alert.severity.danger");
    case "stable":
      return formatMessage(locale, "ui.alert.severity.stable");
    case "warning":
      return formatMessage(locale, "ui.alert.severity.warning");
  }
}

function formatNeedState(state: NeedState, locale: LocaleId): string {
  switch (state) {
    case "high":
      return formatMessage(locale, "ui.need.state.high");
    case "low":
      return formatMessage(locale, "ui.need.state.low");
    case "steady":
      return formatMessage(locale, "ui.need.state.steady");
  }
}

function formatNightRisk(tier: NightRiskTier, locale: LocaleId): string {
  switch (tier) {
    case "breach":
      return formatMessage(locale, "ui.hud.nightRisk.breach");
    case "strained":
      return formatMessage(locale, "ui.hud.nightRisk.strained");
    case "watch":
      return formatMessage(locale, "ui.hud.nightRisk.watch");
    case "stable":
      return formatMessage(locale, "ui.hud.nightRisk.stable");
  }
}

function formatResourceTrend(
  trend: ShellState["readModel"]["town"]["resources"][number]["trend"],
  locale: LocaleId,
): string {
  switch (trend) {
    case "falling":
      return formatMessage(locale, "ui.hud.resourceTrend.falling");
    case "rising":
      return formatMessage(locale, "ui.hud.resourceTrend.rising");
    case "steady":
      return formatMessage(locale, "ui.hud.resourceTrend.steady");
  }
}

function formatEntityKind(kind: WorldEntityReadModel["kind"], locale: LocaleId): string {
  switch (kind) {
    case "lantern-keeper":
      return formatMessage(locale, "ui.entityKind.lanternKeeper");
    case "resident":
      return formatMessage(locale, "ui.entityKind.resident");
    case "structure":
      return formatMessage(locale, "ui.entityKind.structure");
    case "visitor":
      return formatMessage(locale, "ui.entityKind.visitor");
  }
}

function formatHoverTile(state: ShellState): string {
  if (state.hoverTile === undefined) {
    return "none";
  }

  return `${String(state.hoverTile.x)},${String(state.hoverTile.y)}`;
}

const overlayRootStyle: CSSProperties = {
  ...shellTokenLayerStyle,
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
};

function scaleLayerStyle(factor: number): CSSProperties {
  return {
    height: `${String(100 / factor)}%`,
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    position: "absolute",
    transform: `scale(${String(factor)})`,
    transformOrigin: "top left",
    width: `${String(100 / factor)}%`,
  };
}

const hudLayerStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.md,
  gridTemplateRows: "auto auto minmax(0, 1fr)",
  height: "100%",
  inset: 0,
  minHeight: 0,
  overflow: "hidden",
  padding: SHELL_DESIGN_TOKENS.space.lg,
  pointerEvents: "none",
  position: "absolute",
  zIndex: 2,
};

const topBarStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: SHELL_DESIGN_TOKENS.space.lg,
  justifyContent: "space-between",
  minWidth: 0,
  overflowX: "hidden",
  pointerEvents: "auto",
  width: "100%",
};

const compactTopBarStyle: CSSProperties = {
  ...topBarStyle,
  alignItems: "stretch",
  flexDirection: "column",
};

const topBarAsideStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.md,
  maxWidth: "680px",
  minWidth: 0,
};

const alertStripStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  minWidth: 0,
  pointerEvents: "auto",
};

const compactAlertStripStyle: CSSProperties = {
  ...alertStripStyle,
  gridTemplateColumns: "1fr",
};

const desktopHudBodyStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.lg,
  gridTemplateColumns: "minmax(280px, 320px) minmax(0, 1fr) minmax(280px, 320px)",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

const desktopHudColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.md,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: SHELL_DESIGN_TOKENS.space.xs,
  pointerEvents: "auto",
  position: "relative",
  scrollbarGutter: "stable",
};

const compactHudBodyStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.md,
  height: "calc(100vh - 380px)",
  maxHeight: "calc(100vh - 380px)",
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  paddingRight: SHELL_DESIGN_TOKENS.space.xs,
  pointerEvents: "auto",
  position: "relative",
  scrollbarGutter: "stable",
};

const desktopMapLaneStyle: CSSProperties = {
  minWidth: 0,
  pointerEvents: "none",
};

const compactInspectorPanelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.md,
};

const identityCardStyle: CSSProperties = {
  ...createShellSurfaceStyle("wood", {
    gap: SHELL_DESIGN_TOKENS.space.sm,
    padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.lg}`,
    radius: SHELL_DESIGN_TOKENS.radius.slip,
  }),
  boxSizing: "border-box",
  flex: "0 1 420px",
  width: "min(420px, 100%)",
};

const compactIdentityCardStyle: CSSProperties = {
  ...identityCardStyle,
  flex: "0 0 auto",
  width: "100%",
};

const identityTitleStyle: CSSProperties = {
  color: "var(--shell-color-text-inverse)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyRecord,
  fontSize: "28px",
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "32px",
  margin: 0,
};

const identityMetaStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.86)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const summaryGroupStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
  minWidth: 0,
  width: "100%",
};

const paperCardStyle: CSSProperties = createShellSurfaceStyle("paper", {
  gap: SHELL_DESIGN_TOKENS.space.sm,
  padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.lg}`,
});

const compactInspectorCardStyle: CSSProperties = {
  ...paperCardStyle,
  maxHeight: "60%",
  overflowY: "auto",
  paddingRight: SHELL_DESIGN_TOKENS.space.md,
  scrollbarGutter: "stable",
};

const inkCardStyle: CSSProperties = createShellSurfaceStyle("ink", {
  gap: SHELL_DESIGN_TOKENS.space.sm,
  padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.lg}`,
});

const resourceBandStyle: CSSProperties = createShellSurfaceStyle("wood", {
  gap: SHELL_DESIGN_TOKENS.space.sm,
  padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.md}`,
});

const resourceCardStyle: CSSProperties = {
  ...createShellSurfaceStyle("agedPaper", {
    gap: "6px",
    minHeight: "74px",
    padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.md}`,
    radius: SHELL_DESIGN_TOKENS.radius.slip,
  }),
  boxShadow:
    "inset 0 1px 0 rgba(255, 249, 235, 0.42), inset 3px 0 0 rgba(217, 150, 58, 0.56), 0 6px 12px rgba(0, 0, 0, 0.12)",
};

const resourceHeaderStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  justifyContent: "space-between",
};

const resourceValueStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.panelTitle,
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "22px",
};

const sectionHeaderStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  justifyContent: "space-between",
};

const sectionTitleStyle: CSSProperties = {
  color: "inherit",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.bodyLarge,
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "20px",
};

const sectionHintStyle: CSSProperties = {
  color: "var(--shell-color-text-muted)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.caption,
  fontWeight: 600,
  lineHeight: "16px",
  overflowWrap: "anywhere",
};

const sectionHintInverseStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.78)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.caption,
  fontWeight: 600,
  lineHeight: "16px",
  overflowWrap: "anywhere",
};

const sectionEyebrowStyle: CSSProperties = {
  color: "var(--shell-color-text-muted)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "11px",
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  letterSpacing: 0,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const sectionEyebrowInverseStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.82)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "11px",
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  letterSpacing: 0,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const keyOutcomeStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyRecord,
  fontSize: "20px",
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "24px",
  overflowWrap: "anywhere",
};

const bodyTextStyle: CSSProperties = {
  color: "var(--shell-color-text-warm)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  lineHeight: "18px",
  margin: 0,
  overflowWrap: "anywhere",
};

const mutedTextStyle: CSSProperties = {
  color: "var(--shell-color-text-muted)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const mutedInverseTextStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.78)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const rowStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.sm,
};

const infoRowStyle: CSSProperties = createHairlineRuleStyle("rgba(245, 234, 210, 0.12)");

const rowHeaderStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  justifyContent: "space-between",
};

const rowTitleStyle: CSSProperties = {
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "15px",
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "20px",
  overflowWrap: "anywhere",
};

const rowValueStyle: CSSProperties = {
  color: "var(--shell-color-text-inverse)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.body,
  fontWeight: 600,
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const reasonListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: SHELL_DESIGN_TOKENS.space.sm,
};

const inlineReasonStyle: CSSProperties = {
  background: "rgba(106, 74, 47, 0.1)",
  border: "1px solid rgba(126, 111, 85, 0.24)",
  borderRadius: SHELL_DESIGN_TOKENS.radius.control,
  color: "var(--shell-color-text-warm)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.caption,
  lineHeight: "16px",
  overflowWrap: "anywhere",
  padding: "6px 10px",
};

const definitionStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.sm,
};

const definitionRowStyle: CSSProperties = createHairlineRuleStyle("rgba(126, 111, 85, 0.2)");

const definitionValueStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.body,
  fontWeight: 600,
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const pairGridStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const pairCellStyle: CSSProperties = {
  ...createShellSurfaceStyle("agedPaper", {
    gap: SHELL_DESIGN_TOKENS.space.xs,
    minHeight: "72px",
    padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
    radius: SHELL_DESIGN_TOKENS.radius.panel,
  }),
  boxShadow:
    "inset 0 1px 0 rgba(255, 249, 235, 0.38), inset 2px 0 0 rgba(126, 111, 85, 0.3), 0 4px 10px rgba(0, 0, 0, 0.08)",
};

const pairValueStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const pairValueZhStyle: CSSProperties = {
  ...pairValueStyle,
  lineHeight: "20px",
};

const stackSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.sm,
};

const needStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.sm,
};

const needRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const meterTrackStyle: CSSProperties = {
  background: "rgba(36, 30, 24, 0.12)",
  borderRadius: SHELL_DESIGN_TOKENS.radius.control,
  height: "8px",
  overflow: "hidden",
};

const bulletListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
};

const bulletItemStyle: CSSProperties = {
  color: "var(--shell-color-text-warm)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const bulletItemInverseStyle: CSSProperties = {
  color: "var(--shell-color-text-inverse)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "13px",
  lineHeight: "18px",
  overflowWrap: "anywhere",
};

const cardTitleStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyRecord,
  fontSize: SHELL_DESIGN_TOKENS.font.phase,
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "26px",
  overflowWrap: "anywhere",
};

const emptyStateTitleStyle: CSSProperties = {
  color: "var(--shell-color-text-primary)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyRecord,
  fontSize: SHELL_DESIGN_TOKENS.font.panelTitle,
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "22px",
  overflowWrap: "anywhere",
};

const debugOverlayStyle: CSSProperties = {
  ...createShellSurfaceStyle("debug", {
    gap: SHELL_DESIGN_TOKENS.space.md,
    padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.lg}`,
    radius: SHELL_DESIGN_TOKENS.radius.slip,
  }),
  bottom: "16px",
  left: "352px",
  maxHeight: "min(360px, calc(100% - 32px))",
  overflowY: "auto",
  pointerEvents: "auto",
  position: "absolute",
  right: "352px",
};

const compactDebugOverlayStyle: CSSProperties = {
  ...debugOverlayStyle,
  bottom: "236px",
  left: "16px",
  maxHeight: "min(220px, calc(100% - 252px))",
  right: "16px",
};

const debugHeaderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const debugTitleStyle: CSSProperties = {
  color: "var(--shell-color-text-inverse)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.panelTitle,
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "22px",
};

const debugHintStyle: CSSProperties = {
  color: "#A9D6FF",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.caption,
  lineHeight: "16px",
  overflowWrap: "anywhere",
};

const debugViewportStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(169, 214, 255, 0.12)",
  borderRadius: SHELL_DESIGN_TOKENS.radius.panel,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
};

const debugRowStyle: CSSProperties = createHairlineRuleStyle("rgba(169, 214, 255, 0.12)");

const commandBarStyle: CSSProperties = {
  ...createShellSurfaceStyle("wood", {
    gap: SHELL_DESIGN_TOKENS.space.sm,
    padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.lg}`,
    radius: SHELL_DESIGN_TOKENS.radius.slip,
  }),
  pointerEvents: "auto",
};

const commandBarGroupStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const commandDetailStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.72)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.caption,
  fontWeight: 400,
  lineHeight: "16px",
  overflowWrap: "anywhere",
};

function commandButtonStyle(tone: "primary" | "secondary"): CSSProperties {
  return {
    ...createCommandButtonStyle(tone, "disabled"),
    minWidth: 0,
  };
}

function trendBadgeStyle(
  trend: ShellState["readModel"]["town"]["resources"][number]["trend"],
): CSSProperties {
  return createTrendBadgeStyle(trend);
}

function severityBadgeStyle(severity: AlertSeverity): CSSProperties {
  return createStatusBadgeStyle(severity);
}

function alertSlipStyle(severity: AlertSeverity): CSSProperties {
  const accent =
    severity === "danger"
      ? "var(--shell-color-status-danger)"
      : severity === "warning"
        ? "var(--shell-color-border-lamp)"
        : "var(--shell-color-status-stable)";
  return {
    ...createShellSurfaceStyle("agedPaper", {
      gap: SHELL_DESIGN_TOKENS.space.xs,
      padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
      radius: SHELL_DESIGN_TOKENS.radius.slip,
    }),
    boxShadow: `inset 3px 0 0 ${accent}, inset 0 1px 0 rgba(255, 249, 235, 0.42), 0 6px 12px rgba(0, 0, 0, 0.1)`,
  };
}

function alertRowStyle(severity: AlertSeverity): CSSProperties {
  return {
    ...alertSlipStyle(severity),
    gap: SHELL_DESIGN_TOKENS.space.xs,
  };
}

function residentRowStyle(severity: AlertSeverity): CSSProperties {
  return {
    ...alertSlipStyle(severity),
    background:
      severity === "danger"
        ? "linear-gradient(180deg, rgba(237, 219, 196, 0.98) 0%, rgba(221, 199, 170, 0.98) 100%)"
        : "linear-gradient(180deg, rgba(228, 208, 164, 0.98) 0%, rgba(214, 188, 146, 0.98) 100%)",
  };
}

function nightRiskBadgeStyle(tier: NightRiskTier): CSSProperties {
  return {
    ...createNightRiskSurfaceStyle(tier),
    minWidth: "160px",
  };
}

function compactNightRiskBadgeStyle(tier: NightRiskTier): CSSProperties {
  return {
    ...nightRiskBadgeStyle(tier),
    minWidth: "0",
    width: "100%",
  };
}

const nightRiskValueStyle: CSSProperties = {
  color: "var(--shell-color-text-inverse)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyRecord,
  fontSize: SHELL_DESIGN_TOKENS.font.panelTitle,
  fontWeight: SHELL_DESIGN_TOKENS.font.strong,
  lineHeight: "22px",
};

function meterFillStyle(need: WorldEntityReadModel["inspector"]["needs"][number]): CSSProperties {
  const background =
    need.state === "low"
      ? "var(--shell-color-status-danger)"
      : need.state === "high"
        ? "var(--shell-color-status-watch)"
        : "var(--shell-color-status-stable)";
  return {
    background,
    height: "100%",
    width: `${String(Math.max(0, Math.min(need.value, 100)))}%`,
  };
}
