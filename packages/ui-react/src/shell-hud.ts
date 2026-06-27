import {
  createElement,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from "react";

import { formatMessage, type LocaleId } from "./localization";
import { ShellMainMenuSurface } from "./shell-main-menu-surface";
import { ShellSettingsPanel } from "./shell-settings-panel";
import { ShellStoragePanel } from "./shell-storage-panel";
import { getSelectedEntity, type ShellState, type ShellStore } from "./shell-store";
import type { ShellLocaleActions, ShellStorageActions } from "./shell-store";

export interface ShellHudRootProps {
  readonly localeActions: ShellLocaleActions;
  readonly store: ShellStore;
  readonly storageActions: ShellStorageActions;
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

  return createElement(
    "div",
    {
      "data-diagnostics-visible": state.diagnosticsVisible ? "true" : "false",
      "data-locale": state.locale.resolvedLocale,
      "data-locale-source": state.locale.source,
      "data-shell-ready": "true",
      style: overlayRootStyle,
    },
    startSurfaceVisible
      ? createElement(ShellMainMenuSurface, {
          compact: compactLayout,
          cycleLabel: state.readModel.town.cycleLabel,
          localeActions,
          localeState: state.locale,
          onDismiss: () => {
            setStartSurfaceDismissed(true);
          },
          phaseLabel: state.readModel.town.phaseLabel,
          settlementName: state.readModel.town.settlementName,
          storageActions,
          storageState: state.storageGate,
        })
      : [
          createElement(
            "section",
            {
              "aria-label": formatMessage(uiLocale, "ui.surface.topBar"),
              key: "top-bar",
              style: compactLayout ? compactTopBarStyle : topBarStyle,
            },
            createIdentityCard(state, uiLocale),
            createElement(ShellSettingsPanel, {
              actions: localeActions,
              state: state.locale,
            }),
            createElement(
              "div",
              {
                style: summaryGroupStyle,
              },
              ...state.readModel.town.resources.map((resource) =>
                createElement(
                  "div",
                  {
                    key: resource.label,
                    style: statChipStyle,
                  },
                  createElement(
                    "div",
                    {
                      style: chipLabelStyle,
                    },
                    resource.label,
                  ),
                  createElement(
                    "div",
                    {
                      style: chipValueStyle,
                    },
                    `${String(resource.amount)}${resource.unit}`,
                  ),
                  createElement(
                    "div",
                    {
                      style: chipHintStyle,
                    },
                    resource.trend,
                  ),
                ),
              ),
            ),
          ),
          createElement(
            "section",
            {
              "aria-label": formatMessage(uiLocale, "ui.surface.alerts"),
              key: "bottom-strip",
              style: compactLayout ? compactBottomStripStyle : bottomStripStyle,
            },
            createElement(
              "div",
              {
                style: calloutGroupStyle,
              },
              ...state.readModel.town.alerts.map((alert) =>
                createElement(
                  "div",
                  {
                    "aria-label": `${formatAlertSeverity(alert.severity, uiLocale)}: ${alert.label}`,
                    "data-alert-severity": alert.severity,
                    key: alert.label,
                    style: alertChipStyle(alert.severity),
                  },
                  createElement(
                    "div",
                    {
                      style: chipLabelStyle,
                    },
                    formatAlertSeverity(alert.severity, uiLocale).toUpperCase(),
                  ),
                  createElement(
                    "div",
                    {
                      style: chipValueStyle,
                    },
                    alert.label,
                  ),
                  createElement(
                    "div",
                    {
                      style: chipHintStyle,
                    },
                    alert.detail,
                  ),
                ),
              ),
            ),
            state.diagnosticsVisible ? createDiagnosticsSurface(state, storageActions) : null,
          ),
          createElement(
            "aside",
            {
              "aria-label": formatMessage(uiLocale, "ui.inspector.aria"),
              "data-selected-entity": selectedEntity?.entityId ?? "",
              key: "inspector",
              style: compactLayout ? compactInspectorStyle : inspectorStyle,
            },
            selectedEntity === undefined
              ? createEmptyInspector(uiLocale)
              : createInspectorContent(state, selectedEntity, uiLocale),
          ),
        ],
  );
}

function createDiagnosticsSurface(
  state: ShellState,
  storageActions: ShellStorageActions,
): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Developer diagnostics",
      "data-browser-targets": state.releaseGate.browserTargets.join(","),
      "data-cross-origin-isolated": state.releaseGate.runtimeCrossOriginIsolated ? "true" : "false",
      "data-release-gate-fixture": state.releaseGate.fixtureId,
      style: releaseGateCardStyle,
    },
    createElement(
      "div",
      {
        style: sectionLabelStyle,
      },
      state.releaseGate.title,
    ),
    createElement(
      "div",
      {
        style: chipHintStyle,
      },
      `${state.releaseGate.runtimeBrowser} | targets ${state.releaseGate.browserTargets.join(", ")}`,
    ),
    createElement(
      "div",
      {
        style: viewportInfoStyle,
      },
      createElement(
        "div",
        {
          style: chipLabelStyle,
        },
        `Canvas ${String(state.canvasWidth)} x ${String(state.canvasHeight)}`,
      ),
      createElement(
        "div",
        {
          style: chipHintStyle,
        },
        `Zoom ${String(Math.round(state.zoom * 100))}% | Hover ${formatHoverTile(state)}`,
      ),
      createElement(
        "div",
        {
          style: chipHintStyle,
        },
        `Input ${state.lastInputLabel}`,
      ),
    ),
    ...state.releaseGate.sections.map((section) =>
      createElement(
        "div",
        {
          key: section.label,
          style: releaseGateRowStyle,
        },
        createElement(
          "div",
          {
            style: chipLabelStyle,
          },
          section.label,
        ),
        createElement(
          "div",
          {
            style: chipValueStyle,
          },
          section.value,
        ),
        createElement(
          "div",
          {
            style: chipHintStyle,
          },
          section.detail,
        ),
      ),
    ),
    createElement(ShellStoragePanel, {
      actions: storageActions,
      state: state.storageGate,
    }),
  );
}

function createEmptyInspector(locale: LocaleId): ReactElement {
  return createElement(
    "div",
    {
      style: inspectorStackStyle,
    },
    createElement(
      "div",
      {
        style: eyebrowStyle,
      },
      formatMessage(locale, "ui.inspector.selected"),
    ),
    createElement(
      "h2",
      {
        style: inspectorTitleStyle,
      },
      formatMessage(locale, "ui.inspector.noSelection.title"),
    ),
    createElement(
      "p",
      {
        style: bodyCopyStyle,
      },
      formatMessage(locale, "ui.inspector.noSelection.body"),
    ),
  );
}

function createIdentityCard(state: ShellState, locale: LocaleId): ReactElement {
  return createElement(
    "div",
    {
      style: topBarIdentityStyle,
    },
    createElement(
      "div",
      {
        style: eyebrowStyle,
      },
      state.readModel.town.phaseLabel,
    ),
    createElement(
      "h1",
      {
        style: titleStyle,
      },
      state.readModel.town.settlementName,
    ),
    createElement(
      "div",
      {
        style: compactMetaStyle,
      },
      formatMessage(locale, "ui.surface.topBarMeta", {
        cycle: state.readModel.town.cycleLabel,
        map: state.readModel.mapName,
        speed: state.readModel.town.speedLabel,
      }),
    ),
  );
}

function createInspectorContent(
  state: ShellState,
  selectedEntity: NonNullable<ReturnType<typeof getSelectedEntity>>,
  locale: LocaleId,
): ReactElement {
  return createElement(
    "div",
    {
      style: inspectorStackStyle,
    },
    createElement(
      "div",
      {
        style: eyebrowStyle,
      },
      `${selectedEntity.kind} | ${formatMessage(locale, "ui.inspector.tile")} ${String(selectedEntity.tile.x)},${String(selectedEntity.tile.y)}`,
    ),
    createElement(
      "h2",
      {
        style: inspectorTitleStyle,
      },
      selectedEntity.displayName,
    ),
    createElement(
      "div",
      {
        style: compactMetaStyle,
      },
      `${selectedEntity.inspector.roleLabel} | ${selectedEntity.summary}`,
    ),
    createPairGrid([
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
    createElement(
      "section",
      {
        style: stackSectionStyle,
      },
      createElement(
        "div",
        {
          style: sectionLabelStyle,
        },
        formatMessage(locale, "ui.inspector.needs"),
      ),
      createElement(
        "div",
        {
          style: statListStyle,
        },
        ...selectedEntity.inspector.needs.map((need) =>
          createElement(
            "div",
            {
              key: need.label,
              style: needRowStyle,
            },
            createElement(
              "div",
              {
                style: needHeaderStyle,
              },
              createElement(
                "span",
                {
                  style: chipLabelStyle,
                },
                need.label,
              ),
              createElement(
                "span",
                {
                  style: chipHintStyle,
                },
                `${String(need.value)}% | ${need.state}`,
              ),
            ),
            createElement("div", {
              style: meterTrackStyle,
              children: createElement("div", {
                style: meterFillStyle(need.value),
              }),
            }),
          ),
        ),
      ),
    ),
    createStackSection(
      formatMessage(locale, "ui.inspector.thoughts"),
      selectedEntity.inspector.thoughts.map((thought) =>
        createElement(
          "li",
          {
            key: thought,
            style: listItemStyle,
          },
          thought,
        ),
      ),
    ),
    createStackSection(
      formatMessage(locale, "ui.inspector.why"),
      selectedEntity.inspector.explainers.map((explainer) =>
        createElement(
          "li",
          {
            key: explainer,
            style: listItemStyle,
          },
          explainer,
        ),
      ),
    ),
  );
}

function createPairGrid(
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
            style: chipLabelStyle,
          },
          item.label,
        ),
        createElement(
          "div",
          {
            style: pairValueStyle,
          },
          item.value,
        ),
      ),
    ),
  );
}

function createStackSection(title: string, children: readonly ReactElement[]): ReactElement {
  return createElement(
    "section",
    {
      style: stackSectionStyle,
    },
    createElement(
      "div",
      {
        style: sectionLabelStyle,
      },
      title,
    ),
    createElement(
      "ul",
      {
        style: listStyle,
      },
      ...children,
    ),
  );
}

function formatAlertSeverity(severity: "danger" | "stable" | "warning", locale: LocaleId): string {
  switch (severity) {
    case "danger":
      return formatMessage(locale, "ui.alert.severity.danger");
    case "stable":
      return formatMessage(locale, "ui.alert.severity.stable");
    case "warning":
      return formatMessage(locale, "ui.alert.severity.warning");
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

const topBarStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: "16px",
  justifyContent: "space-between",
  left: "16px",
  pointerEvents: "auto",
  position: "absolute",
  right: "336px",
  top: "16px",
};

const compactTopBarStyle: CSSProperties = {
  ...topBarStyle,
  alignItems: "stretch",
  flexDirection: "column",
  right: "16px",
};

const topBarIdentityStyle: CSSProperties = {
  background: "rgba(18, 15, 11, 0.88)",
  border: "1px solid rgba(232, 206, 151, 0.18)",
  borderRadius: "8px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  maxWidth: "360px",
  padding: "14px 16px",
};

const titleStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: '"Noto Serif SC", "Noto Sans SC", serif',
  fontSize: "28px",
  fontWeight: 650,
  lineHeight: "32px",
  margin: 0,
};

const eyebrowStyle: CSSProperties = {
  color: "#d5b87a",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const compactMetaStyle: CSSProperties = {
  color: "#c8c0af",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
};

const summaryGroupStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))",
  maxWidth: "420px",
  width: "100%",
};

const statChipStyle: CSSProperties = {
  background: "rgba(18, 15, 11, 0.88)",
  border: "1px solid rgba(232, 206, 151, 0.18)",
  borderRadius: "8px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minHeight: "74px",
  padding: "12px 14px",
};

const chipLabelStyle: CSSProperties = {
  color: "#d3cab6",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "11px",
  fontWeight: 600,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const chipValueStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "15px",
  fontWeight: 650,
  lineHeight: "20px",
};

const chipHintStyle: CSSProperties = {
  color: "#b7a992",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  lineHeight: "16px",
};

const bottomStripStyle: CSSProperties = {
  alignItems: "stretch",
  bottom: "16px",
  display: "flex",
  gap: "12px",
  left: "16px",
  pointerEvents: "auto",
  position: "absolute",
  right: "336px",
};

const compactBottomStripStyle: CSSProperties = {
  ...bottomStripStyle,
  alignItems: "stretch",
  bottom: "224px",
  flexDirection: "column",
  right: "16px",
};

const calloutGroupStyle: CSSProperties = {
  display: "flex",
  flex: "1 1 420px",
  flexWrap: "wrap",
  gap: "10px",
};

const viewportInfoStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(169, 214, 255, 0.12)",
  borderRadius: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  padding: "10px 12px",
};

const releaseGateCardStyle: CSSProperties = {
  background: "rgba(16, 21, 28, 0.94)",
  border: "1px solid rgba(169, 214, 255, 0.18)",
  borderRadius: "8px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  display: "flex",
  flex: "0 0 360px",
  flexDirection: "column",
  gap: "8px",
  maxHeight: "min(660px, calc(100vh - 48px))",
  maxWidth: "380px",
  overflowY: "auto",
  padding: "12px 14px",
};

const releaseGateRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const inspectorStyle: CSSProperties = {
  background: "rgba(16, 14, 12, 0.9)",
  borderLeft: "1px solid rgba(232, 206, 151, 0.18)",
  bottom: 0,
  pointerEvents: "auto",
  position: "absolute",
  right: 0,
  top: 0,
  width: "320px",
};

const compactInspectorStyle: CSSProperties = {
  ...inspectorStyle,
  borderLeft: "none",
  borderTop: "1px solid rgba(232, 206, 151, 0.18)",
  height: "208px",
  inset: "auto 0 0 0",
  width: "100%",
};

const inspectorStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  height: "100%",
  overflowY: "auto",
  padding: "18px 18px 20px",
};

const inspectorTitleStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "22px",
  fontWeight: 650,
  lineHeight: "26px",
  margin: 0,
};

const bodyCopyStyle: CSSProperties = {
  color: "#c8c0af",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  margin: 0,
};

const pairGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const pairCellStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minHeight: "72px",
  padding: "10px 12px",
};

const pairValueStyle: CSSProperties = {
  color: "#f2e7d1",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "18px",
};

const stackSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const sectionLabelStyle: CSSProperties = {
  color: "#d3cab6",
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: "16px",
  textTransform: "uppercase",
};

const statListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const needRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const needHeaderStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  justifyContent: "space-between",
};

const meterTrackStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  borderRadius: "999px",
  height: "7px",
  overflow: "hidden",
};

const listStyle: CSSProperties = {
  color: "#d8cfbc",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  margin: 0,
  paddingLeft: "18px",
};

const listItemStyle: CSSProperties = {
  fontFamily: '"Noto Sans SC", "Segoe UI", sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
};

function alertChipStyle(severity: "stable" | "warning" | "danger"): CSSProperties {
  const borderColor =
    severity === "danger"
      ? "rgba(233, 101, 78, 0.3)"
      : severity === "warning"
        ? "rgba(244, 181, 45, 0.28)"
        : "rgba(127, 176, 116, 0.28)";

  return {
    background: "rgba(18, 15, 11, 0.88)",
    border: `1px solid ${borderColor}`,
    borderRadius: "8px",
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxWidth: "240px",
    padding: "12px 14px",
  };
}

function meterFillStyle(value: number): CSSProperties {
  return {
    background: value >= 70 ? "#e9654e" : value >= 40 ? "#f4b52d" : "#8fd18f",
    height: "100%",
    width: `${String(Math.max(0, Math.min(value, 100)))}%`,
  };
}
