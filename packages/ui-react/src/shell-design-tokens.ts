import type { CSSProperties } from "react";

export type ShellAlertTone = "danger" | "stable" | "warning";
export type ShellButtonTone = "danger" | "primary" | "secondary";
export type ShellButtonVisualState = "active" | "default" | "disabled";
export type ShellNightRiskTier = "breach" | "stable" | "strained" | "watch";
export type ShellSurfaceTone = "agedPaper" | "debug" | "ink" | "paper" | "wood";
export type ShellResourceTrend = "falling" | "rising" | "steady";
type ShellTokenLayerStyle = CSSProperties & Record<`--${string}`, string>;

export const SHELL_DESIGN_TOKENS = {
  button: {
    minHeight: "48px",
    minHeightCompact: "40px",
  },
  color: {
    anomalyAccent: "#3E8C86",
    borderLamp: "#D9963A",
    borderRecord: "#7E6F55",
    canvasDay: "#D8C9AA",
    canvasDusk: "#6F5840",
    canvasNight: "#161411",
    debugSurface: "#10151C",
    statusContradicted: "#7B4B83",
    statusDanger: "#A33B32",
    statusStable: "#2F6F4E",
    statusUnknown: "#5D6580",
    statusWatch: "#B57A22",
    surfaceAgedPaper: "#D8C49B",
    surfaceInk: "#25211B",
    surfacePaper: "#F1E6CC",
    surfaceWood: "#6A4A2F",
    textInverse: "#F5EAD2",
    textMuted: "#6E6254",
    textPrimary: "#241E18",
    textWarm: "#40372C",
  },
  font: {
    body: "14px",
    bodyLarge: "16px",
    caption: "12px",
    familyRecord: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", "Times New Roman", serif',
    familyUi: '"Noto Sans SC", "Microsoft YaHei UI", "PingFang SC", "Segoe UI", sans-serif',
    panelTitle: "18px",
    phase: "22px",
    strong: 700,
  },
  radius: {
    control: "4px",
    panel: "6px",
    slip: "8px",
  },
  shadow: {
    panel: "0 14px 28px rgba(0, 0, 0, 0.22)",
    raised: "0 8px 16px rgba(0, 0, 0, 0.18)",
  },
  slot: {
    buttonDangerActive: "button.danger.active",
    buttonDangerDefault: "button.danger.default",
    buttonDangerDisabled: "button.danger.disabled",
    buttonPrimaryActive: "button.primary.active",
    buttonPrimaryDefault: "button.primary.default",
    buttonPrimaryDisabled: "button.primary.disabled",
    buttonSecondaryActive: "button.secondary.active",
    buttonSecondaryDefault: "button.secondary.default",
    buttonSecondaryDisabled: "button.secondary.disabled",
    commandBar: "panel.wood.toolbar",
    inspector: "panel.ledger.inspector",
    panelAlert: "panel.paper.alert",
    panelPaper: "panel.paper.primary",
    panelToolbar: "panel.wood.toolbar",
  },
  space: {
    lg: "16px",
    md: "12px",
    sm: "8px",
    xl: "24px",
    xs: "4px",
    xxl: "28px",
  },
} as const;

export const shellTokenLayerStyle: ShellTokenLayerStyle = {
  "--shell-color-anomaly-accent": SHELL_DESIGN_TOKENS.color.anomalyAccent,
  "--shell-color-border-lamp": SHELL_DESIGN_TOKENS.color.borderLamp,
  "--shell-color-border-record": SHELL_DESIGN_TOKENS.color.borderRecord,
  "--shell-color-canvas-day": SHELL_DESIGN_TOKENS.color.canvasDay,
  "--shell-color-canvas-dusk": SHELL_DESIGN_TOKENS.color.canvasDusk,
  "--shell-color-canvas-night": SHELL_DESIGN_TOKENS.color.canvasNight,
  "--shell-color-debug-surface": SHELL_DESIGN_TOKENS.color.debugSurface,
  "--shell-color-status-contradicted": SHELL_DESIGN_TOKENS.color.statusContradicted,
  "--shell-color-status-danger": SHELL_DESIGN_TOKENS.color.statusDanger,
  "--shell-color-status-stable": SHELL_DESIGN_TOKENS.color.statusStable,
  "--shell-color-status-unknown": SHELL_DESIGN_TOKENS.color.statusUnknown,
  "--shell-color-status-watch": SHELL_DESIGN_TOKENS.color.statusWatch,
  "--shell-color-surface-aged-paper": SHELL_DESIGN_TOKENS.color.surfaceAgedPaper,
  "--shell-color-surface-ink": SHELL_DESIGN_TOKENS.color.surfaceInk,
  "--shell-color-surface-paper": SHELL_DESIGN_TOKENS.color.surfacePaper,
  "--shell-color-surface-wood": SHELL_DESIGN_TOKENS.color.surfaceWood,
  "--shell-color-text-inverse": SHELL_DESIGN_TOKENS.color.textInverse,
  "--shell-color-text-muted": SHELL_DESIGN_TOKENS.color.textMuted,
  "--shell-color-text-primary": SHELL_DESIGN_TOKENS.color.textPrimary,
  "--shell-color-text-warm": SHELL_DESIGN_TOKENS.color.textWarm,
};

export function createShellSurfaceStyle(
  tone: ShellSurfaceTone,
  options: {
    readonly gap?: string;
    readonly minHeight?: string;
    readonly padding?: string;
    readonly radius?: string;
  } = {},
): CSSProperties {
  const {
    gap = SHELL_DESIGN_TOKENS.space.sm,
    minHeight,
    padding = `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.lg}`,
    radius = SHELL_DESIGN_TOKENS.radius.panel,
  } = options;
  const palette = readSurfacePalette(tone);

  return {
    background: palette.background,
    backgroundColor: palette.backgroundColor,
    border: `1px solid ${palette.border}`,
    borderRadius: radius,
    boxShadow: palette.shadow,
    color: palette.color,
    display: "flex",
    flexDirection: "column",
    gap,
    minHeight,
    minWidth: 0,
    overflow: "hidden",
    padding,
    pointerEvents: "auto",
  };
}

export function createStatusBadgeStyle(tone: ShellAlertTone): CSSProperties {
  const color = readStatusColor(tone);
  const background =
    tone === "danger"
      ? "rgba(163, 59, 50, 0.18)"
      : tone === "warning"
        ? "rgba(181, 122, 34, 0.18)"
        : "rgba(47, 111, 78, 0.16)";

  return {
    background,
    border: `1px solid ${color}`,
    borderRadius: SHELL_DESIGN_TOKENS.radius.control,
    color,
    fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
    fontSize: "11px",
    fontWeight: SHELL_DESIGN_TOKENS.font.strong,
    letterSpacing: 0,
    lineHeight: "15px",
    maxWidth: "100%",
    overflowWrap: "anywhere",
    padding: "3px 8px",
    textTransform: "uppercase",
  };
}

export function createTrendBadgeStyle(trend: ShellResourceTrend): CSSProperties {
  const color =
    trend === "falling"
      ? "var(--shell-color-status-danger)"
      : trend === "rising"
        ? "var(--shell-color-status-stable)"
        : "var(--shell-color-border-record)";

  return {
    background:
      trend === "falling"
        ? "rgba(163, 59, 50, 0.08)"
        : trend === "rising"
          ? "rgba(47, 111, 78, 0.08)"
          : "rgba(255, 255, 255, 0.5)",
    border: `1px solid ${color}`,
    borderRadius: SHELL_DESIGN_TOKENS.radius.control,
    color,
    fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
    fontSize: "11px",
    fontWeight: SHELL_DESIGN_TOKENS.font.strong,
    letterSpacing: 0,
    lineHeight: "15px",
    padding: "3px 8px",
    textTransform: "uppercase",
  };
}

export function createCommandButtonStyle(
  tone: ShellButtonTone,
  state: ShellButtonVisualState,
): CSSProperties {
  const slotTone = tone === "primary" ? "lamp" : tone === "danger" ? "danger" : "record";
  const accent =
    slotTone === "lamp"
      ? "var(--shell-color-border-lamp)"
      : slotTone === "danger"
        ? "var(--shell-color-status-danger)"
        : "var(--shell-color-border-record)";
  const background =
    state === "disabled"
      ? "linear-gradient(180deg, rgba(66, 50, 36, 0.76) 0%, rgba(45, 33, 23, 0.76) 100%)"
      : tone === "primary"
        ? "linear-gradient(180deg, rgba(125, 84, 42, 0.98) 0%, rgba(92, 61, 31, 0.98) 100%)"
        : tone === "danger"
          ? "linear-gradient(180deg, rgba(104, 46, 39, 0.96) 0%, rgba(79, 34, 29, 0.96) 100%)"
          : "linear-gradient(180deg, rgba(241, 230, 204, 0.96) 0%, rgba(222, 205, 171, 0.96) 100%)";
  const color =
    state === "disabled"
      ? "rgba(245, 234, 210, 0.62)"
      : tone === "secondary"
        ? "var(--shell-color-text-primary)"
        : "var(--shell-color-text-inverse)";

  return {
    alignItems: "flex-start",
    background,
    border: `1px solid ${accent}`,
    borderRadius: SHELL_DESIGN_TOKENS.radius.control,
    boxShadow:
      state === "active"
        ? `inset 0 0 0 1px rgba(255, 245, 221, 0.24), inset 0 1px 0 rgba(255, 234, 198, 0.18)`
        : `inset 0 1px 0 rgba(255, 244, 219, 0.12), ${SHELL_DESIGN_TOKENS.shadow.raised}`,
    color,
    cursor: state === "disabled" ? "not-allowed" : "pointer",
    display: "flex",
    flexDirection: "column",
    fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
    fontSize: SHELL_DESIGN_TOKENS.font.body,
    fontWeight: SHELL_DESIGN_TOKENS.font.strong,
    gap: SHELL_DESIGN_TOKENS.space.xs,
    justifyContent: "center",
    minHeight: SHELL_DESIGN_TOKENS.button.minHeight,
    minWidth: 0,
    padding: `${SHELL_DESIGN_TOKENS.space.sm} ${SHELL_DESIGN_TOKENS.space.md}`,
    textAlign: "left",
  };
}

export function createSelectStyle(): CSSProperties {
  return {
    background:
      "linear-gradient(180deg, rgba(241, 230, 204, 0.98) 0%, rgba(229, 213, 181, 0.98) 100%)",
    border: "1px solid rgba(126, 111, 85, 0.48)",
    borderRadius: SHELL_DESIGN_TOKENS.radius.control,
    color: "var(--shell-color-text-primary)",
    fontFamily: SHELL_DESIGN_TOKENS.font.familyUi,
    fontSize: "13px",
    fontWeight: 600,
    minHeight: SHELL_DESIGN_TOKENS.button.minHeightCompact,
    minWidth: 0,
    padding: "8px 10px",
    width: "100%",
  };
}

export function createHairlineRuleStyle(accent = "rgba(126, 111, 85, 0.24)"): CSSProperties {
  return {
    borderTop: `1px solid ${accent}`,
    display: "flex",
    flexDirection: "column",
    gap: SHELL_DESIGN_TOKENS.space.xs,
    paddingTop: SHELL_DESIGN_TOKENS.space.sm,
  };
}

export function createNightRiskSurfaceStyle(tier: ShellNightRiskTier): CSSProperties {
  const accent =
    tier === "breach"
      ? "var(--shell-color-status-danger)"
      : tier === "strained"
        ? "var(--shell-color-status-watch)"
        : tier === "watch"
          ? "var(--shell-color-border-lamp)"
          : "var(--shell-color-status-stable)";

  return {
    ...createShellSurfaceStyle("ink", {
      gap: SHELL_DESIGN_TOKENS.space.xs,
      padding: `${SHELL_DESIGN_TOKENS.space.md} ${SHELL_DESIGN_TOKENS.space.md}`,
      radius: SHELL_DESIGN_TOKENS.radius.slip,
    }),
    borderColor: accent,
    boxShadow: `inset 0 1px 0 rgba(255, 233, 202, 0.08), inset 3px 0 0 ${accent}, ${SHELL_DESIGN_TOKENS.shadow.panel}`,
  };
}

function readSurfacePalette(tone: ShellSurfaceTone): {
  readonly background: string;
  readonly backgroundColor: string;
  readonly border: string;
  readonly color: string;
  readonly shadow: string;
} {
  switch (tone) {
    case "agedPaper":
      return {
        background:
          "linear-gradient(180deg, rgba(228, 208, 164, 0.98) 0%, rgba(214, 188, 146, 0.98) 100%)",
        backgroundColor: SHELL_DESIGN_TOKENS.color.surfaceAgedPaper,
        border: "rgba(126, 111, 85, 0.52)",
        color: SHELL_DESIGN_TOKENS.color.textPrimary,
        shadow: SHELL_DESIGN_TOKENS.shadow.raised,
      };
    case "debug":
      return {
        background:
          "linear-gradient(180deg, rgba(16, 21, 28, 0.98) 0%, rgba(10, 15, 21, 0.98) 100%)",
        backgroundColor: SHELL_DESIGN_TOKENS.color.debugSurface,
        border: "rgba(169, 214, 255, 0.2)",
        color: "#A9D6FF",
        shadow: SHELL_DESIGN_TOKENS.shadow.panel,
      };
    case "ink":
      return {
        background:
          "linear-gradient(180deg, rgba(37, 33, 27, 0.98) 0%, rgba(22, 19, 15, 0.98) 100%)",
        backgroundColor: SHELL_DESIGN_TOKENS.color.surfaceInk,
        border: "rgba(126, 111, 85, 0.44)",
        color: SHELL_DESIGN_TOKENS.color.textInverse,
        shadow: SHELL_DESIGN_TOKENS.shadow.panel,
      };
    case "paper":
      return {
        background:
          "linear-gradient(180deg, rgba(241, 230, 204, 0.98) 0%, rgba(232, 217, 187, 0.98) 100%)",
        backgroundColor: SHELL_DESIGN_TOKENS.color.surfacePaper,
        border: "rgba(126, 111, 85, 0.42)",
        color: SHELL_DESIGN_TOKENS.color.textPrimary,
        shadow: SHELL_DESIGN_TOKENS.shadow.panel,
      };
    case "wood":
      return {
        background:
          "linear-gradient(180deg, rgba(106, 74, 47, 0.98) 0%, rgba(82, 55, 35, 0.98) 100%)",
        backgroundColor: SHELL_DESIGN_TOKENS.color.surfaceWood,
        border: "rgba(217, 150, 58, 0.36)",
        color: SHELL_DESIGN_TOKENS.color.textInverse,
        shadow: SHELL_DESIGN_TOKENS.shadow.panel,
      };
  }
}

function readStatusColor(tone: ShellAlertTone): string {
  switch (tone) {
    case "danger":
      return "var(--shell-color-status-danger)";
    case "warning":
      return "var(--shell-color-status-watch)";
    case "stable":
      return "var(--shell-color-status-stable)";
  }
}
