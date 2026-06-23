import { createElement, useSyncExternalStore, type CSSProperties, type ReactElement } from "react";

import { getSelectedEntity, type ShellState, type ShellStore } from "./shell-store";

export interface ShellHudRootProps {
  readonly store: ShellStore;
}

export function createShellHudElement(store: ShellStore): ReactElement {
  return createElement(ShellHudRoot, {
    store,
  });
}

export function ShellHudRoot({ store }: ShellHudRootProps): ReactElement {
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
  const selectedEntity = getSelectedEntity(state);
  const compactLayout = state.canvasWidth < 1040;

  return createElement(
    "div",
    {
      "data-shell-ready": "true",
      style: overlayRootStyle,
    },
    createElement(
      "section",
      {
        "aria-label": "Town status",
        style: compactLayout ? compactTopBarStyle : topBarStyle,
      },
      createElement(
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
          [
            state.readModel.town.cycleLabel,
            state.readModel.mapName,
            state.readModel.town.speedLabel,
          ].join(" · "),
        ),
      ),
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
        "aria-label": "Viewport and alerts",
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
              key: alert.label,
              style: alertChipStyle(alert.severity),
            },
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
          `Zoom ${String(Math.round(state.zoom * 100))}% · Hover ${formatHoverTile(state)}`,
        ),
        createElement(
          "div",
          {
            style: chipHintStyle,
          },
          `Input ${state.lastInputLabel}`,
        ),
      ),
    ),
    createElement(
      "aside",
      {
        "aria-label": "Selected entity inspector",
        "data-selected-entity": selectedEntity?.entityId ?? "",
        style: compactLayout ? compactInspectorStyle : inspectorStyle,
      },
      selectedEntity === undefined
        ? createEmptyInspector()
        : createInspectorContent(state, selectedEntity),
    ),
  );
}

function createEmptyInspector(): ReactElement {
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
      "Selected entity",
    ),
    createElement(
      "h2",
      {
        style: inspectorTitleStyle,
      },
      "No selection",
    ),
    createElement(
      "p",
      {
        style: bodyCopyStyle,
      },
      "Use the canvas to inspect a resident, lantern keeper, or visitor.",
    ),
  );
}

function createInspectorContent(
  state: ShellState,
  selectedEntity: NonNullable<ReturnType<typeof getSelectedEntity>>,
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
      `${selectedEntity.kind} · tile ${String(selectedEntity.tile.x)},${String(selectedEntity.tile.y)}`,
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
      [selectedEntity.inspector.roleLabel, selectedEntity.summary].join(" · "),
    ),
    createPairGrid([
      {
        label: "Current job",
        value: selectedEntity.inspector.currentJob,
      },
      {
        label: "Current step",
        value: selectedEntity.inspector.currentStep,
      },
      {
        label: "Mood",
        value: selectedEntity.inspector.moodLabel,
      },
      {
        label: "Health",
        value: selectedEntity.inspector.healthLabel,
      },
      {
        label: "Last input",
        value: state.lastInputLabel,
      },
      {
        label: "Decision",
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
        "Needs",
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
                `${String(need.value)}% · ${need.state}`,
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
      "Thoughts",
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
      "Why this matters",
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
  maxWidth: "420px",
  padding: "14px 16px",
};

const titleStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "28px",
  fontWeight: 650,
  lineHeight: "32px",
  margin: 0,
};

const eyebrowStyle: CSSProperties = {
  color: "#d5b87a",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const compactMetaStyle: CSSProperties = {
  color: "#c8c0af",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "13px",
  lineHeight: "18px",
};

const summaryGroupStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))",
  maxWidth: "520px",
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
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "11px",
  fontWeight: 600,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const chipValueStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "15px",
  fontWeight: 650,
  lineHeight: "20px",
};

const chipHintStyle: CSSProperties = {
  color: "#b7a992",
  fontFamily: "Inter, system-ui, sans-serif",
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
  flex: "1 1 auto",
  flexWrap: "wrap",
  gap: "10px",
};

const viewportInfoStyle: CSSProperties = {
  background: "rgba(18, 15, 11, 0.88)",
  border: "1px solid rgba(232, 206, 151, 0.18)",
  borderRadius: "8px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  justifyContent: "center",
  minWidth: "220px",
  padding: "12px 14px",
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
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "22px",
  fontWeight: 650,
  lineHeight: "26px",
  margin: 0,
};

const bodyCopyStyle: CSSProperties = {
  color: "#c8c0af",
  fontFamily: "Inter, system-ui, sans-serif",
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
  fontFamily: "Inter, system-ui, sans-serif",
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
  fontFamily: "Inter, system-ui, sans-serif",
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
  fontFamily: "Inter, system-ui, sans-serif",
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
