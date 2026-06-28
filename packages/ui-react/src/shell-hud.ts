import {
  createElement,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { WorldEntityReadModel } from "@wuming-town/sim-protocol";

import { formatMessage, type LocaleId } from "./localization";
import { ShellMainMenuSurface } from "./shell-main-menu-surface";
import { ShellSettingsPanel } from "./shell-settings-panel";
import { ShellStoragePanel } from "./shell-storage-panel";
import { getSelectedEntity, type ShellState, type ShellStore } from "./shell-store";
import type { ShellLocaleActions, ShellStorageActions } from "./shell-store";

type AlertSeverity = ShellState["readModel"]["town"]["alerts"][number]["severity"];
type NeedState = WorldEntityReadModel["inspector"]["needs"][number]["state"];
type NightRiskTier = "stable" | "watch" | "strained" | "breach";

export interface ShellHudRootProps {
  readonly localeActions: ShellLocaleActions;
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
  localeActions: ShellLocaleActions,
): ReactElement {
  return createElement(ShellHudRoot, {
    localeActions,
    store,
    storageActions,
  });
}

export function ShellHudRoot({
  localeActions,
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
        style: overlayRootStyle,
      },
      createElement(ShellMainMenuSurface, {
        compact: compactLayout,
        cycleLabel: state.readModel.town.cycleLabel,
        localeActions,
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
      }),
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
      style: overlayRootStyle,
    },
    createElement(
      "section",
      {
        "aria-label": formatMessage(uiLocale, "ui.hud.aria"),
        "data-testid": "player-hud",
        key: "player-hud",
        style: hudLayerStyle,
      },
      createTopBar(state, playerHud, uiLocale, compactLayout),
      compactLayout
        ? createCompactHudBody(state, playerHud, selectedEntity, uiLocale, localeActions)
        : createDesktopHudBody(state, playerHud, selectedEntity, uiLocale, localeActions),
      state.diagnosticsVisible ? createDebugOverlay(state, storageActions, compactLayout) : null,
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
        style: compactTopBarStyle,
      },
      createIdentityCard(state, locale, playerHud, true),
    );
  }

  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.surface.topBar"),
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

function createDesktopHudBody(
  state: ShellState,
  playerHud: PlayerHudModel,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  localeActions: ShellLocaleActions,
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
        actions: localeActions,
        state: state.locale,
      }),
    ),
  );
}

function createCompactHudBody(
  state: ShellState,
  playerHud: PlayerHudModel,
  selectedEntity: ReturnType<typeof getSelectedEntity>,
  locale: LocaleId,
  localeActions: ShellLocaleActions,
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
    createTaskCard(playerHud.taskEntities, locale),
    createEventCard(state, locale),
    createResidentAttentionCard(playerHud.residentItems, locale),
    createElement(ShellSettingsPanel, {
      actions: localeActions,
      state: state.locale,
    }),
    createElement(
      "aside",
      {
        "aria-label": formatMessage(locale, "ui.inspector.aria"),
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
            resource.label,
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
          `${String(resource.amount)}${resource.unit}`,
        ),
      ),
    ),
  );
}

function createResourceSummaryCard(state: ShellState, locale: LocaleId): ReactElement {
  return createElement(
    "section",
    {
      style: paperCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.surface.topBar"),
      formatMessage(locale, "ui.hud.map"),
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
      style: paperCardStyle,
    },
    createSectionHeader(formatMessage(locale, "ui.hud.currentState"), phaseMeaning),
    createDefinitionStack([
      {
        label: formatMessage(locale, "ui.hud.phase"),
        value: state.readModel.town.phaseLabel,
      },
      {
        label: formatMessage(locale, "ui.hud.cycle"),
        value: state.readModel.town.cycleLabel,
      },
      {
        label: formatMessage(locale, "ui.hud.speed"),
        value: state.readModel.town.speedLabel,
      },
      {
        label: formatMessage(locale, "ui.hud.map"),
        value: state.readModel.mapName,
      },
    ]),
  );
}

function createNextGoalCard(model: PlayerHudModel, locale: LocaleId): ReactElement {
  const nextGoal = model.nextGoal;
  const title =
    nextGoal === undefined ? formatMessage(locale, "ui.hud.nextGoal.none") : nextGoal.label;
  const detail =
    nextGoal === undefined ? formatMessage(locale, "ui.hud.nextGoal.noneDetail") : nextGoal.detail;
  const severity = nextGoal?.severity ?? "stable";

  return createElement(
    "section",
    {
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
      "data-testid": "player-task-list",
      style: inkCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.tasks"),
      formatMessage(locale, "ui.hud.tasksHint"),
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
              entity.displayName,
            ),
            createElement(
              "div",
              {
                style: mutedInverseTextStyle,
              },
              entity.inspector.roleLabel,
            ),
          ),
          createElement(
            "div",
            {
              style: rowValueStyle,
            },
            entity.inspector.currentJob,
          ),
          createElement(
            "div",
            {
              style: mutedInverseTextStyle,
            },
            entity.inspector.currentStep,
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
      "data-testid": "player-event-list",
      style: inkCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.events"),
      formatMessage(locale, "ui.hud.eventsHint"),
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
            "data-alert-severity": alert.severity,
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
              alert.label,
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
            alert.detail,
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
      style: compact ? compactInspectorCardStyle : paperCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.selected"),
      `${formatEntityKind(selectedEntity.kind, locale)} · ${formatMessage(locale, "ui.inspector.tile")} ${String(selectedEntity.tile.x)},${String(selectedEntity.tile.y)}`,
    ),
    createElement(
      "div",
      {
        style: cardTitleStyle,
      },
      selectedEntity.displayName,
    ),
    createElement(
      "div",
      {
        style: mutedTextStyle,
      },
      `${selectedEntity.inspector.roleLabel} · ${selectedEntity.summary}`,
    ),
    createPairGrid(locale, [
      {
        label: formatMessage(locale, "ui.inspector.currentJob"),
        value: selectedEntity.inspector.currentJob,
      },
      {
        label: formatMessage(locale, "ui.inspector.currentStep"),
        value: selectedEntity.inspector.currentStep,
      },
      {
        label: formatMessage(locale, "ui.inspector.mood"),
        value: selectedEntity.inspector.moodLabel,
      },
      {
        label: formatMessage(locale, "ui.inspector.health"),
        value: selectedEntity.inspector.healthLabel,
      },
      {
        label: formatMessage(locale, "ui.inspector.lastInput"),
        value: state.lastInputLabel,
      },
      {
        label: formatMessage(locale, "ui.inspector.decision"),
        value: selectedEntity.inspector.lastDecision,
      },
    ]),
    createNeedSection(selectedEntity, locale),
    createBulletSection(
      formatMessage(locale, "ui.inspector.why"),
      selectedEntity.inspector.explainers,
      false,
    ),
    createBulletSection(
      formatMessage(locale, "ui.inspector.thoughts"),
      selectedEntity.inspector.thoughts,
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
      "data-testid": "player-resident-watch",
      style: inkCardStyle,
    },
    createSectionHeader(
      formatMessage(locale, "ui.hud.residents"),
      formatMessage(locale, "ui.hud.residentsHint"),
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
            key: item.entity.entityId,
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
              item.entity.displayName,
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
            `${item.entity.inspector.roleLabel} · ${item.entity.inspector.currentStep}`,
          ),
          item.topNeed === undefined
            ? null
            : createElement(
                "div",
                {
                  style: mutedInverseTextStyle,
                },
                `${item.topNeed.label}: ${String(item.topNeed.value)}% · ${formatNeedState(item.topNeed.state, locale)}`,
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
              need.label,
            ),
            createElement(
              "span",
              {
                style: mutedTextStyle,
              },
              `${String(need.value)}% · ${formatNeedState(need.state, locale)}`,
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
        cycle: state.readModel.town.cycleLabel,
        map: state.readModel.town.speedLabel,
        speed: formatNightRisk(model.nightRisk.tier, locale),
      })
    : formatMessage(locale, "ui.surface.topBarMeta", {
        cycle: state.readModel.town.cycleLabel,
        map: state.readModel.mapName,
        speed: state.readModel.town.speedLabel,
      });
  return createElement(
    "div",
    {
      style: compact ? compactIdentityCardStyle : identityCardStyle,
    },
    createElement(
      "div",
      {
        style: sectionEyebrowInverseStyle,
      },
      state.readModel.town.phaseLabel,
    ),
    createElement(
      "h1",
      {
        style: identityTitleStyle,
      },
      state.readModel.town.settlementName,
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
          `${model.phaseMeaning} · ${formatMessage(locale, "ui.hud.nightRisk")}: ${formatNightRisk(model.nightRisk.tier, locale)}`,
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
      "data-testid": "player-night-risk",
      "data-night-risk-tier": tier,
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
        style: tone === "neutral" ? sectionHintStyle : severityBadgeStyle(tone),
      },
      hint,
    ),
  );
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
      reasons.push(alert.label);
    }
  }

  if (reasons.length < 2) {
    for (const resource of state.readModel.town.resources) {
      if (resource.trend === "falling") {
        reasons.push(`${resource.label} ${formatResourceTrend(resource.trend, locale)}`);
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
    return `${topNeed.label} ${formatNeedState(topNeed.state, locale)}`;
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
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
};

const hudLayerStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "grid",
  gap: "16px",
  gridTemplateRows: "auto minmax(0, 1fr)",
  height: "100%",
  inset: 0,
  padding: "16px",
  pointerEvents: "none",
  position: "absolute",
};

const topBarStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: "16px",
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
  right: "16px",
};

const topBarAsideStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "12px",
  maxWidth: "680px",
  minWidth: 0,
};

const desktopHudBodyStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "minmax(280px, 320px) minmax(0, 1fr) minmax(280px, 320px)",
  minHeight: 0,
  pointerEvents: "none",
};

const desktopHudColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minHeight: 0,
  overflowY: "auto",
  paddingRight: "4px",
  pointerEvents: "auto",
  scrollbarGutter: "stable",
};

const compactHudBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minHeight: 0,
  overflowY: "auto",
  paddingRight: "4px",
  pointerEvents: "auto",
  scrollbarGutter: "stable",
};

const desktopMapLaneStyle: CSSProperties = {
  minWidth: 0,
  pointerEvents: "none",
};

const compactInspectorPanelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const identityCardStyle: CSSProperties = {
  background: "rgba(37, 33, 27, 0.94)",
  border: "1px solid rgba(217, 150, 58, 0.35)",
  borderRadius: "8px",
  boxSizing: "border-box",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  display: "flex",
  flex: "0 1 420px",
  flexDirection: "column",
  gap: "8px",
  maxWidth: "100%",
  minWidth: 0,
  padding: "16px",
  width: "min(420px, 100%)",
};

const compactIdentityCardStyle: CSSProperties = {
  ...identityCardStyle,
  flex: "0 0 auto",
  width: "100%",
};

const identityTitleStyle: CSSProperties = {
  color: "#f5ead2",
  fontFamily: '"Noto Serif SC", "Noto Sans SC", serif',
  fontSize: "28px",
  fontWeight: 700,
  lineHeight: "32px",
  margin: 0,
};

const identityMetaStyle: CSSProperties = {
  color: "#d8c9aa",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
};

const summaryGroupStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
  minWidth: 0,
  width: "100%",
};

const paperCardStyle: CSSProperties = {
  background: "rgba(241, 230, 204, 0.94)",
  border: "1px solid rgba(126, 111, 85, 0.4)",
  borderRadius: "8px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
  color: "#241e18",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "14px 16px",
};

const compactInspectorCardStyle: CSSProperties = {
  ...paperCardStyle,
  maxHeight: "60vh",
  overflowY: "auto",
  paddingRight: "12px",
  scrollbarGutter: "stable",
};

const inkCardStyle: CSSProperties = {
  background: "rgba(37, 33, 27, 0.94)",
  border: "1px solid rgba(126, 111, 85, 0.42)",
  borderRadius: "8px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  color: "#f5ead2",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "14px 16px",
};

const resourceCardStyle: CSSProperties = {
  background: "rgba(241, 230, 204, 0.94)",
  border: "1px solid rgba(126, 111, 85, 0.36)",
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minHeight: "74px",
  padding: "12px 14px",
};

const resourceHeaderStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: "8px",
  justifyContent: "space-between",
};

const resourceValueStyle: CSSProperties = {
  color: "#241e18",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "22px",
};

const sectionHeaderStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: "8px",
  justifyContent: "space-between",
};

const sectionTitleStyle: CSSProperties = {
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "20px",
};

const sectionHintStyle: CSSProperties = {
  color: "#6e6254",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  fontWeight: 600,
  lineHeight: "16px",
};

const sectionEyebrowStyle: CSSProperties = {
  color: "#6e6254",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const sectionEyebrowInverseStyle: CSSProperties = {
  color: "#d8c9aa",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const keyOutcomeStyle: CSSProperties = {
  color: "#241e18",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "20px",
  fontWeight: 700,
  lineHeight: "24px",
};

const bodyTextStyle: CSSProperties = {
  color: "#40372c",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  margin: 0,
};

const mutedTextStyle: CSSProperties = {
  color: "#5e5245",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
};

const mutedInverseTextStyle: CSSProperties = {
  color: "#d8c9aa",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
};

const rowStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const infoRowStyle: CSSProperties = {
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  paddingTop: "10px",
};

const rowHeaderStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: "8px",
  justifyContent: "space-between",
};

const rowTitleStyle: CSSProperties = {
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: "20px",
};

const rowValueStyle: CSSProperties = {
  color: "#f5ead2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "18px",
};

const reasonListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const inlineReasonStyle: CSSProperties = {
  background: "rgba(106, 74, 47, 0.12)",
  border: "1px solid rgba(126, 111, 85, 0.24)",
  borderRadius: "999px",
  color: "#40372c",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  lineHeight: "16px",
  padding: "6px 10px",
};

const definitionStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const definitionRowStyle: CSSProperties = {
  borderTop: "1px solid rgba(126, 111, 85, 0.18)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  paddingTop: "8px",
};

const definitionValueStyle: CSSProperties = {
  color: "#241e18",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "18px",
};

const pairGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const pairCellStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.42)",
  border: "1px solid rgba(126, 111, 85, 0.18)",
  borderRadius: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minHeight: "72px",
  padding: "10px 12px",
};

const pairValueStyle: CSSProperties = {
  color: "#241e18",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "18px",
};

const pairValueZhStyle: CSSProperties = {
  ...pairValueStyle,
  lineHeight: "20px",
};

const stackSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const needStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const needRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const meterTrackStyle: CSSProperties = {
  background: "rgba(36, 30, 24, 0.1)",
  borderRadius: "999px",
  height: "8px",
  overflow: "hidden",
};

const bulletListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
};

const bulletItemStyle: CSSProperties = {
  color: "#40372c",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
};

const bulletItemInverseStyle: CSSProperties = {
  color: "#f5ead2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
};

const cardTitleStyle: CSSProperties = {
  color: "#241e18",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "26px",
};

const emptyStateTitleStyle: CSSProperties = {
  color: "#241e18",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "22px",
};

const debugOverlayStyle: CSSProperties = {
  background: "rgba(16, 21, 28, 0.96)",
  border: "1px solid rgba(169, 214, 255, 0.18)",
  borderRadius: "8px",
  bottom: "16px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.28)",
  color: "#a9d6ff",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  left: "352px",
  maxHeight: "min(360px, calc(100vh - 32px))",
  overflowY: "auto",
  padding: "14px 16px",
  pointerEvents: "auto",
  position: "absolute",
  right: "352px",
};

const compactDebugOverlayStyle: CSSProperties = {
  ...debugOverlayStyle,
  bottom: "236px",
  left: "16px",
  maxHeight: "220px",
  right: "16px",
};

const debugHeaderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const debugTitleStyle: CSSProperties = {
  color: "#f5ead2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "22px",
};

const debugHintStyle: CSSProperties = {
  color: "#a9d6ff",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  lineHeight: "16px",
};

const debugViewportStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(169, 214, 255, 0.12)",
  borderRadius: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "10px 12px",
};

const debugRowStyle: CSSProperties = {
  borderTop: "1px solid rgba(169, 214, 255, 0.12)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  paddingTop: "10px",
};

function trendBadgeStyle(
  trend: ShellState["readModel"]["town"]["resources"][number]["trend"],
): CSSProperties {
  const color = trend === "falling" ? "#A33B32" : trend === "rising" ? "#2F6F4E" : "#7E6F55";
  return {
    background: "rgba(255, 255, 255, 0.5)",
    border: `1px solid ${color}`,
    borderRadius: "999px",
    color,
    fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "15px",
    padding: "3px 8px",
    textTransform: "uppercase",
  };
}

function severityBadgeStyle(severity: AlertSeverity): CSSProperties {
  const config =
    severity === "danger"
      ? {
          background: "rgba(163, 59, 50, 0.16)",
          borderColor: "rgba(163, 59, 50, 0.52)",
          color: "#f5d4d0",
        }
      : severity === "warning"
        ? {
            background: "rgba(181, 122, 34, 0.16)",
            borderColor: "rgba(217, 150, 58, 0.46)",
            color: "#f2dfbc",
          }
        : {
            background: "rgba(47, 111, 78, 0.16)",
            borderColor: "rgba(47, 111, 78, 0.46)",
            color: "#d6eedf",
          };

  return {
    background: config.background,
    border: `1px solid ${config.borderColor}`,
    borderRadius: "999px",
    color: config.color,
    fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "15px",
    padding: "3px 8px",
    textTransform: "uppercase",
  };
}

function alertRowStyle(severity: AlertSeverity): CSSProperties {
  return {
    ...infoRowStyle,
    borderTop:
      severity === "danger"
        ? "1px solid rgba(163, 59, 50, 0.4)"
        : severity === "warning"
          ? "1px solid rgba(217, 150, 58, 0.32)"
          : "1px solid rgba(47, 111, 78, 0.28)",
  };
}

function nightRiskBadgeStyle(tier: NightRiskTier): CSSProperties {
  const borderColor =
    tier === "breach"
      ? "rgba(163, 59, 50, 0.56)"
      : tier === "strained"
        ? "rgba(181, 122, 34, 0.52)"
        : tier === "watch"
          ? "rgba(217, 150, 58, 0.42)"
          : "rgba(47, 111, 78, 0.42)";
  return {
    background: "rgba(37, 33, 27, 0.94)",
    border: `1px solid ${borderColor}`,
    borderRadius: "8px",
    boxSizing: "border-box",
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: "160px",
    padding: "12px 14px",
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
  color: "#f5ead2",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "22px",
};

function meterFillStyle(need: WorldEntityReadModel["inspector"]["needs"][number]): CSSProperties {
  const background =
    need.state === "low" ? "#A33B32" : need.state === "high" ? "#B57A22" : "#2F6F4E";
  return {
    background,
    height: "100%",
    width: `${String(Math.max(0, Math.min(need.value, 100)))}%`,
  };
}
