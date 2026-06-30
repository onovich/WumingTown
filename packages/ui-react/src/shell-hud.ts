import {
  createElement,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from "react";

import type {
  EntityTaskReadModel,
  TerrainKind,
  TileCoordinate,
  WorldEntityReadModel,
  WorldJobMarkerState,
  WorldStructuredJobKind,
} from "@wuming-town/sim-protocol";

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
import {
  getSelectedEntity,
  type ShellPlayableCommandSurfaceState,
  type ShellPlayableCommandTemplateState,
  type ShellPlayablePlacementPreviewState,
  type ShellState,
  type ShellStore,
} from "./shell-store";
import type { ShellCommandActions, ShellSettingsActions, ShellStorageActions } from "./shell-store";

type AlertSeverity = ShellState["readModel"]["town"]["alerts"][number]["severity"];
type HudLayoutMode = "compact" | "desktop" | "medium";
type NeedState = WorldEntityReadModel["inspector"]["needs"][number]["state"];
type NightRiskTier = ShellNightRiskTier;

export interface ShellHudRootProps {
  readonly commandActions: ShellCommandActions;
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

interface HudCommandSpec {
  readonly actionId: "placeholder" | "prioritize-lamp-work" | "queue-simple-build";
  readonly commandState: "needs-placement" | "needs-selection" | "placeholder" | "queued" | "ready";
  readonly command?: ShellPlayableCommandTemplateState;
  readonly description: string;
  readonly disabled: boolean;
  readonly modeAction?: "activate-build-mode" | "deactivate-build-mode";
  readonly testId: string;
  readonly title: string;
  readonly tone: "primary" | "secondary";
  readonly visualState: "active" | "default" | "disabled";
}

export function createShellHudElement(
  store: ShellStore,
  storageActions: ShellStorageActions,
  settingsActions: ShellSettingsActions,
  commandActions: ShellCommandActions,
): ReactElement {
  return createElement(ShellHudRoot, {
    commandActions,
    settingsActions,
    store,
    storageActions,
  });
}

export function ShellHudRoot({
  commandActions,
  settingsActions,
  store,
  storageActions,
}: ShellHudRootProps): ReactElement {
  const [startSurfaceDismissed, setStartSurfaceDismissed] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
  const selectedEntity = getSelectedEntity(state);
  const hudLayoutMode = readHudLayoutMode(state.canvasWidth, state.canvasHeight);
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
          compact: hudLayoutMode !== "desktop",
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
  const commandSpecs = readCommandSpecs(state, selectedEntity, uiLocale);

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
          "data-layout-mode": hudLayoutMode,
          "data-ui-slot": "hud.shell",
          "data-testid": "player-hud",
          key: "player-hud",
          style: hudLayerStyle,
        },
        createTopBar(state, playerHud, uiLocale, hudLayoutMode, settingsVisible, () => {
          setSettingsVisible((current) => !current);
        }),
        createAlertStrip(state, uiLocale, hudLayoutMode),
        hudLayoutMode === "desktop"
          ? createDesktopHudBody(state, playerHud, selectedEntity, uiLocale, commandSpecs)
          : hudLayoutMode === "medium"
            ? createMediumHudBody(state, playerHud, selectedEntity, uiLocale, commandSpecs)
            : createCompactHudBody(state, playerHud, selectedEntity, uiLocale, commandSpecs),
        createCommandBar(state, commandSpecs, uiLocale, commandActions, hudLayoutMode),
        settingsVisible
          ? createSettingsSurface(state, uiLocale, hudLayoutMode, settingsActions, () => {
              setSettingsVisible(false);
            })
          : null,
        state.diagnosticsVisible ? createDebugOverlay(state, storageActions, hudLayoutMode) : null,
      ),
    ),
  );
}

function createTopBar(
  state: ShellState,
  playerHud: PlayerHudModel,
  locale: LocaleId,
  layoutMode: HudLayoutMode,
  settingsVisible: boolean,
  onToggleSettings: () => void,
): ReactElement {
  if (layoutMode === "compact") {
    return createElement(
      "section",
      {
        "aria-label": formatMessage(locale, "ui.surface.topBar"),
        "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
        "data-testid": "player-top-bar",
        style: compactTopBarStyle,
      },
      createIdentityCard(state, locale, playerHud, true),
      createSecondaryToolbar(locale, settingsVisible, onToggleSettings),
    );
  }

  if (layoutMode === "medium") {
    return createElement(
      "section",
      {
        "aria-label": formatMessage(locale, "ui.surface.topBar"),
        "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
        "data-testid": "player-top-bar",
        style: mediumTopBarStyle,
      },
      createIdentityCard(state, locale, playerHud, false),
      createElement(
        "div",
        {
          style: mediumTopBarAsideStyle,
        },
        createNightRiskBadge(playerHud.nightRisk.tier, locale, false),
        createResourceStrip(state, locale),
        createSecondaryToolbar(locale, settingsVisible, onToggleSettings),
      ),
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
      createSecondaryToolbar(locale, settingsVisible, onToggleSettings),
    ),
  );
}

function createAlertStrip(
  state: ShellState,
  locale: LocaleId,
  layoutMode: HudLayoutMode,
): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.surface.alerts"),
      "data-testid": "player-alert-strip",
      style:
        layoutMode === "compact"
          ? compactAlertStripStyle
          : layoutMode === "medium"
            ? mediumAlertStripStyle
            : alertStripStyle,
    },
    ...state.readModel.town.alerts
      .slice(0, layoutMode === "compact" ? 1 : layoutMode === "medium" ? 2 : 3)
      .map((alert) =>
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
  commandSpecs: readonly HudCommandSpec[],
): ReactElement {
  return createElement(
    "div",
    {
      style: desktopHudBodyStyle,
    },
    createElement(
      "aside",
      {
        "data-testid": "player-objective-rail",
        style: desktopHudColumnStyle,
      },
      createObjectiveCard(state, playerHud, selectedEntity, commandSpecs, locale),
      createAttentionQueue(state, playerHud.taskEntities, locale),
    ),
    createElement("div", {
      "data-testid": "player-map-focus",
      style: desktopMapLaneStyle,
    }),
    createElement(
      "aside",
      {
        "aria-label": formatMessage(locale, "ui.inspector.aria"),
        "data-inspected-tile": formatTileCoordinate(state.inspectedTile),
        "data-selected-entity": selectedEntity?.entityId ?? "",
        style: desktopHudColumnStyle,
      },
      createInspectorCard(state, selectedEntity, locale, false),
      createResidentAttentionCard(playerHud.residentItems, locale),
    ),
  );
}

function createMediumHudBody(
  state: ShellState,
  playerHud: PlayerHudModel,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  commandSpecs: readonly HudCommandSpec[],
): ReactElement {
  return createElement(
    "div",
    {
      "data-testid": "player-medium-layout",
      style: mediumHudBodyStyle,
    },
    createElement("div", {
      "data-testid": "player-map-focus",
      style: mediumMapFocusStyle,
    }),
    createElement(
      "aside",
      {
        "aria-label": formatMessage(locale, "ui.inspector.aria"),
        "data-inspected-tile": formatTileCoordinate(state.inspectedTile),
        "data-selected-entity": selectedEntity?.entityId ?? "",
        style: mediumSideRailStyle,
      },
      createObjectiveCard(state, playerHud, selectedEntity, commandSpecs, locale),
      createInspectorCard(state, selectedEntity, locale, true),
      createAttentionQueue(state, playerHud.taskEntities, locale),
      createResidentAttentionCard(playerHud.residentItems, locale),
    ),
  );
}

function createCompactHudBody(
  state: ShellState,
  playerHud: PlayerHudModel,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  commandSpecs: readonly HudCommandSpec[],
): ReactElement {
  return createElement(
    "div",
    {
      style: compactHudBodyStyle,
    },
    createNightRiskBadge(playerHud.nightRisk.tier, locale, true),
    createResourceSummaryCard(state, locale),
    createObjectiveCard(state, playerHud, selectedEntity, commandSpecs, locale),
    createAttentionQueue(state, playerHud.taskEntities, locale),
    createResidentAttentionCard(playerHud.residentItems, locale),
    createElement(
      "aside",
      {
        "aria-label": formatMessage(locale, "ui.inspector.aria"),
        "data-inspected-tile": formatTileCoordinate(state.inspectedTile),
        "data-selected-entity": selectedEntity?.entityId ?? "",
        style: compactInspectorPanelStyle,
      },
      createInspectorCard(state, selectedEntity, locale, true),
    ),
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

function createObjectiveCard(
  state: ShellState,
  model: PlayerHudModel,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  commandSpecs: readonly HudCommandSpec[],
  locale: LocaleId,
): ReactElement {
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
  const primaryCommand = commandSpecs[0];
  const selectedTargetLabel =
    selectedEntity === undefined
      ? formatMessage(locale, "ui.inspector.noSelection.title")
      : localizeShellFixtureText(locale, selectedEntity.displayName);

  return createElement(
    "section",
    {
      "data-testid": "player-next-goal",
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelPaper,
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
        style: objectiveSummaryStyle,
      },
      createObjectiveSummarySlip(formatMessage(locale, "ui.hud.phase"), model.phaseMeaning, false),
      createObjectiveSummarySlip(
        formatMessage(locale, "ui.hud.cycle"),
        localizeShellFixtureText(locale, state.readModel.town.cycleLabel),
        false,
      ),
      createObjectiveSummarySlip(
        formatMessage(locale, "ui.hud.nightRisk"),
        formatNightRisk(model.nightRisk.tier, locale),
        true,
      ),
    ),
    createElement(
      "div",
      {
        style: stackSectionStyle,
      },
      createElement(
        "div",
        {
          style: sectionEyebrowStyle,
        },
        formatMessage(locale, "ui.mainMenu.firstPlay.actions"),
      ),
      createElement(
        "div",
        {
          style: objectiveActionStyle(primaryCommand?.visualState ?? "disabled"),
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
            primaryCommand?.title ?? formatMessage(locale, "ui.hud.command.lamp"),
          ),
          createElement(
            "div",
            {
              style:
                primaryCommand === undefined
                  ? sectionHintStyle
                  : severityBadgeStyle(
                      primaryCommand.visualState === "active"
                        ? "stable"
                        : primaryCommand.disabled
                          ? "warning"
                          : "stable",
                    ),
            },
            selectedTargetLabel,
          ),
        ),
        createElement(
          "p",
          {
            style: bodyTextStyle,
          },
          primaryCommand?.description ??
            formatMessage(locale, "ui.hud.command.playable.lamp.needsSelection"),
        ),
      ),
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

function createObjectiveSummarySlip(label: string, value: string, inverse: boolean): ReactElement {
  return createElement(
    "div",
    {
      style: objectiveSummarySlipStyle,
    },
    createElement(
      "div",
      {
        style: inverse ? sectionEyebrowInverseStyle : sectionEyebrowStyle,
      },
      label,
    ),
    createElement(
      "div",
      {
        style: inverse ? rowValueStyle : pairValueStyle,
      },
      value,
    ),
  );
}

function createAttentionQueue(
  state: ShellState,
  taskEntities: readonly WorldEntityReadModel[],
  locale: LocaleId,
): ReactElement {
  const alerts = state.readModel.town.alerts.slice(0, 2);
  return createElement(
    "section",
    {
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelToolbar,
      "data-testid": "player-attention-queue",
      style: inkCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.events"),
      formatMessage(locale, "ui.hud.tasksHint"),
      "neutral",
      true,
    ),
    createElement(
      "div",
      {
        style: rowStackStyle,
      },
      ...alerts.map((alert) =>
        createElement(
          "div",
          {
            "aria-label": `${formatAlertSeverity(alert.severity, locale)}: ${localizeShellFixtureText(locale, alert.label)}. ${localizeShellFixtureText(locale, alert.detail)}`,
            "data-alert-severity": alert.severity,
            "data-ui-slot": SHELL_DESIGN_TOKENS.slot.panelAlert,
            key: `${alert.severity}:${alert.label}:attention`,
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
              style: rowValueStyle,
            },
            localizeShellFixtureText(locale, alert.detail),
          ),
        ),
      ),
      ...taskEntities.slice(0, 2).map((entity) =>
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

function createInspectorCard(
  state: ShellState,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  compact: boolean,
): ReactElement {
  if (selectedEntity === undefined) {
    if (state.inspectedTile !== undefined) {
      return createTileInspectorCard(state, state.inspectedTile, locale, compact);
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

  const structuredTask = selectedEntity.inspector.task;
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
        value:
          structuredTask === undefined
            ? localizeShellFixtureText(locale, selectedEntity.inspector.currentJob)
            : formatStructuredJobKind(structuredTask.jobKind, locale),
      },
      {
        label: formatMessage(locale, "ui.inspector.currentStep"),
        value:
          structuredTask === undefined
            ? localizeShellFixtureText(locale, selectedEntity.inspector.currentStep)
            : localizeShellFixtureText(locale, structuredTask.stepLabel),
      },
      ...(structuredTask === undefined
        ? []
        : [
            {
              label: formatMessage(locale, "ui.inspector.target"),
              value: localizeShellFixtureText(locale, structuredTask.targetLabel),
            },
            {
              label: formatMessage(locale, "ui.inspector.progress"),
              value: formatStructuredProgress(structuredTask.progressPercent, locale),
            },
            {
              label: formatMessage(locale, "ui.inspector.taskState"),
              value: formatStructuredTaskState(structuredTask.state, locale),
            },
            {
              label: formatMessage(locale, "ui.inspector.reason"),
              value:
                structuredTask.reason === undefined
                  ? formatMessage(locale, "ui.inspector.reasonNone")
                  : `${structuredTask.reason.code} · ${localizeShellFixtureText(locale, structuredTask.reason.detail)}`,
            },
          ]),
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

function createTileInspectorCard(
  state: ShellState,
  inspectedTile: TileCoordinate,
  locale: LocaleId,
  compact: boolean,
): ReactElement {
  const terrain = readTerrainKindAtTile(state.readModel, inspectedTile);

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
        kind: formatMessage(locale, "ui.inspector.tileFocus"),
        tileLabel: formatMessage(locale, "ui.inspector.tile"),
        x: String(inspectedTile.x),
        y: String(inspectedTile.y),
      }),
    ),
    createElement(
      "div",
      {
        style: cardTitleStyle,
      },
      formatMessage(locale, "ui.inspector.tileInspection"),
    ),
    createElement(
      "p",
      {
        style: bodyTextStyle,
      },
      formatMessage(locale, "ui.inspector.tileInspection.body"),
    ),
    createPairGrid(locale, [
      {
        label: formatMessage(locale, "ui.inspector.lastInput"),
        value: localizeShellLastInputLabel(locale, state.lastInputLabel),
      },
      {
        label: formatMessage(locale, "ui.hud.map"),
        value: localizeShellFixtureText(locale, state.readModel.mapName),
      },
      {
        label: formatMessage(locale, "ui.inspector.terrain"),
        value:
          terrain === undefined
            ? formatMessage(locale, "ui.inspector.terrainUnknown")
            : formatTerrainKind(terrain, locale),
      },
    ]),
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
  layoutMode: HudLayoutMode,
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
      style:
        layoutMode === "compact"
          ? compactDebugOverlayStyle
          : layoutMode === "medium"
            ? mediumDebugOverlayStyle
            : debugOverlayStyle,
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
        "Developer diagnostics",
      ),
      createElement(
        "div",
        {
          style: debugHintStyle,
        },
        "Debug-only overlay. Active because wmDiagnostics=1. Product Gate, storage, and diagnostic evidence stay out of the default player HUD.",
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

function createSecondaryToolbar(
  locale: LocaleId,
  settingsVisible: boolean,
  onToggleSettings: () => void,
): ReactElement {
  return createElement(
    "div",
    {
      style: secondaryToolbarStyle,
    },
    createElement(
      "button",
      {
        "aria-expanded": settingsVisible ? "true" : "false",
        "data-testid": "player-settings-toggle",
        "data-ui-slot": settingsVisible
          ? SHELL_DESIGN_TOKENS.slot.buttonSecondaryActive
          : SHELL_DESIGN_TOKENS.slot.buttonSecondaryDefault,
        onClick: onToggleSettings,
        style: secondaryToolbarButtonStyle(settingsVisible),
        type: "button",
      },
      settingsVisible
        ? formatMessage(locale, "ui.mainMenu.action.back")
        : formatMessage(locale, "ui.settings.title"),
    ),
  );
}

function createSettingsSurface(
  state: ShellState,
  locale: LocaleId,
  layoutMode: HudLayoutMode,
  settingsActions: ShellSettingsActions,
  onClose: () => void,
): ReactElement {
  return createElement(
    "aside",
    {
      "aria-label": formatMessage(locale, "ui.settings.aria"),
      "data-testid": "player-settings-surface",
      style:
        layoutMode === "compact"
          ? compactSettingsSurfaceStyle
          : layoutMode === "medium"
            ? mediumSettingsSurfaceStyle
            : settingsSurfaceStyle,
    },
    createElement(
      "div",
      {
        style: secondarySurfaceHeaderStyle,
      },
      createElement(
        "div",
        {
          style: sectionTitleStyle,
        },
        formatMessage(locale, "ui.settings.title"),
      ),
      createElement(
        "button",
        {
          "data-testid": "player-settings-close",
          "data-ui-slot": SHELL_DESIGN_TOKENS.slot.buttonSecondaryDefault,
          onClick: onClose,
          style: secondaryToolbarButtonStyle(false),
          type: "button",
        },
        formatMessage(locale, "ui.mainMenu.action.back"),
      ),
    ),
    createElement(ShellSettingsPanel, {
      actions: settingsActions,
      localeState: state.locale,
      uiScaleState: state.uiScale,
    }),
  );
}

function createCommandBar(
  state: ShellState,
  commandSpecs: readonly HudCommandSpec[],
  locale: LocaleId,
  commandActions: ShellCommandActions,
  layoutMode: HudLayoutMode,
): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.hud.commandBar"),
      "data-testid": "player-command-bar",
      "data-ui-slot": SHELL_DESIGN_TOKENS.slot.commandBar,
      style:
        layoutMode === "compact"
          ? compactCommandBarStyle
          : layoutMode === "medium"
            ? mediumCommandBarStyle
            : commandBarStyle,
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
        style: layoutMode === "compact" ? compactCommandBarGroupStyle : commandBarGroupStyle,
      },
      ...commandSpecs.map((spec) =>
        createElement(
          "button",
          {
            "aria-describedby": `${spec.testId}-detail`,
            "aria-disabled": spec.disabled ? "true" : "false",
            "data-command-state": spec.commandState,
            "data-testid": spec.testId,
            "data-ui-slot": readCommandButtonSlot(spec.tone, spec.visualState),
            disabled: spec.disabled,
            key: spec.testId,
            onClick: (event): void => {
              event.preventDefault();
              if (spec.disabled) {
                return;
              }

              if (spec.command !== undefined) {
                if (spec.actionId === "prioritize-lamp-work") {
                  void commandActions.onPrioritizeLampWork(spec.command);
                } else if (spec.actionId === "queue-simple-build") {
                  void commandActions.onQueueSimpleBuild(spec.command);
                }
                return;
              }

              if (spec.modeAction === "activate-build-mode") {
                void commandActions.onSetBuildMode("place-simple-lamp-post");
                return;
              }

              if (spec.modeAction === "deactivate-build-mode") {
                void commandActions.onSetBuildMode("inactive");
              }
            },
            style: commandButtonStyle(spec.tone, spec.visualState),
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
    state.playableAction === undefined
      ? null
      : createPlayableActionFeedback(state, locale, layoutMode),
  );
}

function readCommandSpecs(
  state: ShellState,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
): readonly HudCommandSpec[] {
  const lampCommand = readSelectedLampCommand(
    state.playableCommandSurface,
    selectedEntity?.entityId,
  );
  const queuedLampCommand =
    lampCommand !== undefined &&
    state.playableAction?.actionId === "prioritize-lamp-work" &&
    state.playableAction.status === "accepted" &&
    state.playableAction.markerState !== "blocked" &&
    state.playableAction.markerState !== "completed" &&
    state.playableAction.targetEntityId === lampCommand.targetEntityId;
  const lampDescription =
    lampCommand === undefined
      ? formatMessage(locale, "ui.hud.command.playable.lamp.authoritativeNeedsSelection")
      : queuedLampCommand
        ? formatMessage(locale, "ui.hud.command.playable.lamp.authoritativeQueued", {
            target: localizeShellFixtureText(locale, lampCommand.targetLabel),
          })
        : lampCommand.available
          ? formatMessage(locale, "ui.hud.command.playable.lamp.authoritativeReady", {
              target: localizeShellFixtureText(locale, lampCommand.targetLabel),
            })
          : formatMessage(locale, "ui.hud.command.playable.blocked", {
              reason: formatCommandReason(
                lampCommand.blockedReasonCode,
                lampCommand.blockedReasonDetail,
                locale,
              ),
            });
  const hoveredPlacement = readHoveredPlacementPreview(
    state.playableCommandSurface,
    state.hoverTile,
  );
  const queuedBuildCommand =
    state.playableAction?.actionId === "queue-simple-build" &&
    state.playableAction.status === "accepted" &&
    state.playableAction.markerState !== "blocked" &&
    state.playableAction.markerState !== "completed";
  const buildTitle =
    state.buildMode === "place-simple-lamp-post" && hoveredPlacement?.valid === true
      ? formatMessage(locale, "ui.hud.command.build")
      : formatMessage(locale, "ui.hud.command.buildMode");
  const buildSpec: HudCommandSpec = queuedBuildCommand
    ? {
        actionId: "queue-simple-build",
        commandState: "queued",
        description: formatMessage(locale, "ui.hud.command.playable.build.queued", {
          target: localizeShellFixtureText(locale, state.playableAction.targetLabel),
        }),
        disabled: true,
        testId: "player-command-build",
        title: formatMessage(locale, "ui.hud.command.build"),
        tone: "primary",
        visualState: "active",
      }
    : state.buildMode === "place-simple-lamp-post"
      ? hoveredPlacement !== undefined &&
        hoveredPlacement.valid &&
        hoveredPlacement.command.available
        ? {
            actionId: "queue-simple-build",
            command: hoveredPlacement.command,
            commandState: "ready",
            description: formatMessage(locale, "ui.hud.command.playable.build.ready", {
              target: localizeShellFixtureText(locale, hoveredPlacement.command.targetLabel),
              tile: formatTile(hoveredPlacement.anchorTile),
            }),
            disabled: false,
            testId: "player-command-build",
            title: formatMessage(locale, "ui.hud.command.build"),
            tone: "primary",
            visualState: "default",
          }
        : {
            actionId: "queue-simple-build",
            commandState: "needs-placement",
            description: readBuildDescription(locale, hoveredPlacement, state.hoverTile),
            disabled: false,
            modeAction: "deactivate-build-mode",
            testId: "player-command-build",
            title: buildTitle,
            tone: "primary",
            visualState: "active",
          }
      : state.playableCommandSurface !== undefined &&
          state.playableCommandSurface.buildPlacements.length > 0
        ? {
            actionId: "queue-simple-build",
            commandState: "ready",
            description: formatMessage(locale, "ui.hud.command.playable.build.modeReady"),
            disabled: false,
            modeAction: "activate-build-mode",
            testId: "player-command-build",
            title: buildTitle,
            tone: "primary",
            visualState: "default",
          }
        : {
            actionId: "queue-simple-build",
            commandState: "needs-selection",
            description: formatMessage(locale, "ui.hud.command.playable.build.needsSelection"),
            disabled: true,
            testId: "player-command-build",
            title: buildTitle,
            tone: "primary",
            visualState: "disabled",
          };

  return [
    {
      actionId: "prioritize-lamp-work",
      ...(lampCommand === undefined ? {} : { command: lampCommand }),
      commandState: queuedLampCommand
        ? "queued"
        : lampCommand?.available
          ? "ready"
          : "needs-selection",
      description: lampDescription,
      disabled: !lampCommand?.available,
      testId: "player-command-lamp",
      title: formatMessage(locale, "ui.hud.command.lamp"),
      tone: "primary",
      visualState: queuedLampCommand ? "active" : lampCommand?.available ? "default" : "disabled",
    },
    buildSpec,
    {
      actionId: "placeholder",
      commandState: "placeholder",
      description: formatMessage(locale, "ui.hud.command.placeholder.chronicle"),
      disabled: true,
      testId: "player-command-chronicle",
      title: formatMessage(locale, "ui.hud.command.chronicle"),
      tone: "secondary",
      visualState: "disabled",
    },
    {
      actionId: "placeholder",
      commandState: "placeholder",
      description: formatMessage(locale, "ui.hud.command.placeholder.inspect"),
      disabled: true,
      testId: "player-command-inspect",
      title: formatMessage(locale, "ui.hud.command.inspect"),
      tone: "secondary",
      visualState: "disabled",
    },
  ];
}

function createPlayableActionFeedback(
  state: ShellState,
  locale: LocaleId,
  layoutMode: HudLayoutMode,
): ReactElement | null {
  const action = state.playableAction;
  if (action === undefined) {
    return null;
  }

  const target = localizeShellFixtureText(locale, action.targetLabel);
  const reasonText =
    action.reasonCode === undefined
      ? formatMessage(locale, "ui.inspector.reasonNone")
      : `${action.reasonCode} · ${localizeShellFixtureText(locale, action.reasonDetail ?? action.reasonCode)}`;
  const stateText =
    action.status === "rejected"
      ? formatMessage(locale, "ui.hud.actionFeedback.rejected")
      : action.markerState === undefined
        ? formatMessage(locale, "ui.hud.actionFeedback.accepted")
        : formatStructuredTaskState(action.markerState, locale);
  return createElement(
    "div",
    {
      "data-action-authority": action.authority,
      "data-action-marker-state": action.markerState ?? "",
      "data-action-status": action.status,
      "data-adapter-id": action.adapterId,
      "data-reason-code": action.reasonCode ?? "",
      "data-target-entity": action.targetEntityId ?? "",
      "data-testid": "player-action-feedback",
      style: layoutMode === "medium" ? mediumActionFeedbackStyle : actionFeedbackStyle,
    },
    createElement(
      "div",
      {
        style: layoutMode === "medium" ? mediumActionFeedbackTitleStyle : actionFeedbackTitleStyle,
      },
      action.status === "rejected"
        ? formatMessage(locale, "ui.hud.actionFeedback.titleRejected")
        : formatMessage(locale, "ui.hud.actionFeedback.titleAccepted"),
    ),
    createElement(
      "div",
      {
        style: layoutMode === "medium" ? mediumActionFeedbackBodyStyle : actionFeedbackBodyStyle,
      },
      formatMessage(locale, "ui.hud.actionFeedback.body", {
        state: stateText,
        target,
      }),
    ),
    createElement(
      "div",
      {
        style: actionFeedbackMetaStyle,
      },
      formatMessage(locale, "ui.hud.actionFeedback.state", {
        state: stateText,
      }),
    ),
    createElement(
      "div",
      {
        style: actionFeedbackMetaStyle,
      },
      formatMessage(locale, "ui.hud.actionFeedback.reason", {
        reasonCode: reasonText,
      }),
    ),
    createElement(
      "div",
      {
        style: actionFeedbackMetaStyle,
      },
      action.progressPercent === undefined
        ? formatMessage(locale, "ui.hud.actionFeedback.progressNone")
        : formatMessage(locale, "ui.hud.actionFeedback.progress", {
            progress: String(action.progressPercent),
          }),
    ),
    createElement(
      "div",
      {
        style: actionFeedbackMetaStyle,
      },
      formatMessage(locale, "ui.hud.actionFeedback.commandId", {
        commandId: action.commandId,
      }),
    ),
  );
}

function readSelectedLampCommand(
  surface: ShellPlayableCommandSurfaceState | undefined,
  selectedEntityId: string | undefined,
): ShellPlayableCommandTemplateState | undefined {
  if (surface === undefined || selectedEntityId === undefined) {
    return undefined;
  }

  return surface.lampCommands.find((command) => command.targetEntityId === selectedEntityId);
}

function readHoveredPlacementPreview(
  surface: ShellPlayableCommandSurfaceState | undefined,
  hoverTile: TileCoordinate | undefined,
): ShellPlayablePlacementPreviewState | undefined {
  if (surface === undefined || hoverTile === undefined) {
    return undefined;
  }

  return surface.buildPlacements.find(
    (placement) =>
      matchesTile(placement.anchorTile, hoverTile) ||
      placement.footprintTiles.some((tile) => matchesTile(tile, hoverTile)) ||
      placement.interactionTiles.some((tile) => matchesTile(tile, hoverTile)),
  );
}

function readBuildDescription(
  locale: LocaleId,
  placement: ShellPlayablePlacementPreviewState | undefined,
  hoverTile: TileCoordinate | undefined,
): string {
  if (placement === undefined) {
    const tile = hoverTile === undefined ? "?" : formatTile(hoverTile);
    return formatMessage(
      locale,
      hoverTile === undefined
        ? "ui.hud.command.playable.build.modeActive"
        : "ui.hud.command.playable.build.invalidHover",
      {
        tile,
      },
    );
  }

  if (!placement.valid || !placement.command.available) {
    return formatMessage(locale, "ui.hud.command.playable.blocked", {
      reason: formatCommandReason(
        placement.blockedReasonCode ?? placement.command.blockedReasonCode,
        placement.blockedReasonDetail ?? placement.command.blockedReasonDetail,
        locale,
      ),
    });
  }

  return formatMessage(locale, "ui.hud.command.playable.build.ready", {
    target: localizeShellFixtureText(locale, placement.command.targetLabel),
    tile: formatTile(placement.anchorTile),
  });
}

function formatCommandReason(
  reasonCode: string | undefined,
  reasonDetail: string | undefined,
  locale: LocaleId,
): string {
  if (reasonCode === undefined) {
    return formatMessage(locale, "ui.inspector.reasonNone");
  }

  return reasonDetail === undefined
    ? reasonCode
    : `${reasonCode} · ${localizeShellFixtureText(locale, reasonDetail)}`;
}

function formatTile(tile: TileCoordinate): string {
  return `${String(tile.x)},${String(tile.y)}`;
}

function matchesTile(left: TileCoordinate, right: TileCoordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

function readCommandButtonSlot(
  tone: "primary" | "secondary",
  state: "active" | "default" | "disabled",
): string {
  if (tone === "primary") {
    return state === "active"
      ? SHELL_DESIGN_TOKENS.slot.buttonPrimaryActive
      : state === "default"
        ? SHELL_DESIGN_TOKENS.slot.buttonPrimaryDefault
        : SHELL_DESIGN_TOKENS.slot.buttonPrimaryDisabled;
  }

  return state === "active"
    ? SHELL_DESIGN_TOKENS.slot.buttonSecondaryActive
    : state === "default"
      ? SHELL_DESIGN_TOKENS.slot.buttonSecondaryDefault
      : SHELL_DESIGN_TOKENS.slot.buttonSecondaryDisabled;
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

function formatStructuredJobKind(jobKind: WorldStructuredJobKind, locale: LocaleId): string {
  switch (jobKind) {
    case "lamp_refill":
      return formatMessage(locale, "ui.task.job.lampRefill");
    case "build_site_delivery":
      return formatMessage(locale, "ui.task.job.buildDelivery");
    case "build_site_construction":
      return formatMessage(locale, "ui.task.job.buildConstruction");
  }
}

function formatStructuredTaskState(
  state: EntityTaskReadModel["state"] | WorldJobMarkerState,
  locale: LocaleId,
): string {
  switch (state) {
    case "idle":
      return formatMessage(locale, "ui.task.state.idle");
    case "queued":
      return formatMessage(locale, "ui.task.state.queued");
    case "claimable":
      return formatMessage(locale, "ui.task.state.claimable");
    case "claimed":
      return formatMessage(locale, "ui.task.state.claimed");
    case "moving":
      return formatMessage(locale, "ui.task.state.moving");
    case "working":
      return formatMessage(locale, "ui.task.state.working");
    case "blocked":
      return formatMessage(locale, "ui.task.state.blocked");
    case "completed":
      return formatMessage(locale, "ui.task.state.completed");
    case "failed":
      return formatMessage(locale, "ui.task.state.failed");
    case "canceled":
      return formatMessage(locale, "ui.task.state.canceled");
  }
}

function formatStructuredProgress(progressPercent: number | undefined, locale: LocaleId): string {
  if (progressPercent === undefined) {
    return formatMessage(locale, "ui.inspector.progressNone");
  }

  return formatMessage(locale, "ui.inspector.progressValue", {
    progress: String(progressPercent),
  });
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

function formatTerrainKind(kind: TerrainKind, locale: LocaleId): string {
  switch (kind) {
    case "brush":
      return formatMessage(locale, "ui.terrain.brush");
    case "earth":
      return formatMessage(locale, "ui.terrain.earth");
    case "lantern-glow":
      return formatMessage(locale, "ui.terrain.lanternGlow");
    case "path":
      return formatMessage(locale, "ui.terrain.path");
    case "water":
      return formatMessage(locale, "ui.terrain.water");
  }
}

function formatHoverTile(state: ShellState): string {
  if (state.hoverTile === undefined) {
    return "none";
  }

  return `${String(state.hoverTile.x)},${String(state.hoverTile.y)}`;
}

function formatTileCoordinate(tile: TileCoordinate | undefined): string {
  if (tile === undefined) {
    return "";
  }

  return `${String(tile.x)},${String(tile.y)}`;
}

function readTerrainKindAtTile(
  readModel: ShellState["readModel"],
  tile: TileCoordinate,
): TerrainKind | undefined {
  for (const chunk of readModel.chunks) {
    const localX = tile.x - chunk.originTile.x;
    const localY = tile.y - chunk.originTile.y;
    if (localX < 0 || localY < 0 || localX >= chunk.width || localY >= chunk.height) {
      continue;
    }

    return chunk.terrain[localY * chunk.width + localX];
  }

  return undefined;
}

function readHudLayoutMode(width: number, height: number): HudLayoutMode {
  if (width < 760 || height < 680) {
    return "compact";
  }

  if (width < 1600 || height < 860) {
    return "medium";
  }

  return "desktop";
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
  gridTemplateRows: "auto auto minmax(0, 1fr) auto",
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

const mediumTopBarStyle: CSSProperties = {
  ...topBarStyle,
  alignItems: "stretch",
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

const mediumTopBarAsideStyle: CSSProperties = {
  alignItems: "stretch",
  display: "grid",
  flex: "1 1 auto",
  gap: SHELL_DESIGN_TOKENS.space.md,
  gridTemplateColumns: "minmax(140px, 170px) minmax(0, 1fr)",
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

const mediumAlertStripStyle: CSSProperties = {
  ...alertStripStyle,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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

const mediumHudBodyStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.md,
  gridTemplateColumns: "minmax(0, 1fr) minmax(296px, 336px)",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

const mediumMapFocusStyle: CSSProperties = {
  gridColumn: "1",
  gridRow: "1",
  minHeight: 0,
  minWidth: 0,
  pointerEvents: "none",
};

const mediumSideRailStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.md,
  gridColumn: "2",
  minHeight: 0,
  overflowY: "auto",
  paddingRight: SHELL_DESIGN_TOKENS.space.xs,
  pointerEvents: "auto",
  scrollbarGutter: "stable",
};

const compactHudBodyStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.md,
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

const settingsSurfaceStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  pointerEvents: "auto",
  position: "absolute",
  right: SHELL_DESIGN_TOKENS.space.lg,
  top: "88px",
  width: "min(340px, calc(100% - 32px))",
  zIndex: 5,
};

const mediumSettingsSurfaceStyle: CSSProperties = {
  ...settingsSurfaceStyle,
  right: "16px",
  top: "104px",
};

const compactSettingsSurfaceStyle: CSSProperties = {
  ...settingsSurfaceStyle,
  left: "16px",
  right: "16px",
  top: "136px",
  width: "auto",
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

const objectiveSummaryStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
};

const objectiveSummarySlipStyle: CSSProperties = {
  ...createShellSurfaceStyle("agedPaper", {
    gap: SHELL_DESIGN_TOKENS.space.xs,
    minHeight: "68px",
    padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
    radius: SHELL_DESIGN_TOKENS.radius.panel,
  }),
  boxShadow:
    "inset 0 1px 0 rgba(255, 249, 235, 0.38), inset 2px 0 0 rgba(126, 111, 85, 0.3), 0 4px 10px rgba(0, 0, 0, 0.08)",
};

function objectiveActionStyle(state: HudCommandSpec["visualState"]): CSSProperties {
  const accent =
    state === "active"
      ? "rgba(47, 111, 78, 0.42)"
      : state === "disabled"
        ? "rgba(181, 122, 34, 0.38)"
        : "rgba(217, 150, 58, 0.42)";
  return {
    background: "rgba(106, 74, 47, 0.08)",
    border: `1px solid ${accent}`,
    borderRadius: SHELL_DESIGN_TOKENS.radius.panel,
    display: "flex",
    flexDirection: "column",
    gap: SHELL_DESIGN_TOKENS.space.xs,
    padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
  };
}

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
  bottom: "156px",
  left: "352px",
  maxHeight: "min(320px, calc(100% - 188px))",
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

const mediumDebugOverlayStyle: CSSProperties = {
  ...debugOverlayStyle,
  bottom: "292px",
  left: "16px",
  maxHeight: "min(220px, calc(100% - 324px))",
  right: "368px",
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

const compactCommandBarStyle: CSSProperties = {
  ...commandBarStyle,
  marginBottom: SHELL_DESIGN_TOKENS.space.xs,
  padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
};

const mediumCommandBarStyle: CSSProperties = {
  ...commandBarStyle,
  gap: SHELL_DESIGN_TOKENS.space.xs,
  padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
};

const commandBarGroupStyle: CSSProperties = {
  display: "grid",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const compactCommandBarGroupStyle: CSSProperties = {
  ...commandBarGroupStyle,
  gap: SHELL_DESIGN_TOKENS.space.xs,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const commandDetailStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.72)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: SHELL_DESIGN_TOKENS.font.caption,
  fontWeight: 400,
  lineHeight: "16px",
  overflowWrap: "anywhere",
};

function commandButtonStyle(
  tone: "primary" | "secondary",
  state: "active" | "default" | "disabled",
): CSSProperties {
  return {
    ...createCommandButtonStyle(tone, state),
    minWidth: 0,
  };
}

const actionFeedbackStyle: CSSProperties = {
  background: "rgba(18, 15, 11, 0.32)",
  border: "1px solid rgba(217, 150, 58, 0.42)",
  borderRadius: SHELL_DESIGN_TOKENS.radius.control,
  display: "flex",
  flexDirection: "column",
  gap: SHELL_DESIGN_TOKENS.space.xs,
  padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
};

const mediumActionFeedbackStyle: CSSProperties = {
  ...actionFeedbackStyle,
  columnGap: SHELL_DESIGN_TOKENS.space.md,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  padding: `${SHELL_DESIGN_TOKENS.space.xs} ${SHELL_DESIGN_TOKENS.space.md}`,
  rowGap: SHELL_DESIGN_TOKENS.space.xs,
};

const actionFeedbackTitleStyle: CSSProperties = {
  ...rowTitleStyle,
};

const mediumActionFeedbackTitleStyle: CSSProperties = {
  ...actionFeedbackTitleStyle,
  gridColumn: "1 / -1",
};

const actionFeedbackBodyStyle: CSSProperties = {
  ...commandDetailStyle,
};

const mediumActionFeedbackBodyStyle: CSSProperties = {
  ...actionFeedbackBodyStyle,
  gridColumn: "1 / -1",
};

const actionFeedbackMetaStyle: CSSProperties = {
  color: "rgba(245, 234, 210, 0.68)",
  fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
  fontSize: "11px",
  lineHeight: "15px",
  overflowWrap: "anywhere",
};

const secondaryToolbarStyle: CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  justifyContent: "flex-end",
  width: "100%",
};

function secondaryToolbarButtonStyle(active: boolean): CSSProperties {
  return {
    ...createCommandButtonStyle("secondary", active ? "active" : "default"),
    alignItems: "center",
    minHeight: SHELL_DESIGN_TOKENS.button.minHeightCompact,
    padding: `10px ${SHELL_DESIGN_TOKENS.space.md}`,
    width: "auto",
  };
}

const secondarySurfaceHeaderStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: SHELL_DESIGN_TOKENS.space.sm,
  justifyContent: "space-between",
};

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
