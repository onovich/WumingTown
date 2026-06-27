import { createElement, type CSSProperties, type ReactElement } from "react";

import { formatMessage, type LocaleId, type MessageKey } from "./localization";
import type { ShellOnboardingState } from "./shell-store";

export interface ShellOnboardingPanelProps {
  readonly compact: boolean;
  readonly locale: LocaleId;
  readonly state: ShellOnboardingState;
}

const ONBOARDING_STEP_KEYS = [
  {
    body: "ui.onboarding.step1.body",
    title: "ui.onboarding.step1.title",
  },
  {
    body: "ui.onboarding.step2.body",
    title: "ui.onboarding.step2.title",
  },
  {
    body: "ui.onboarding.step3.body",
    title: "ui.onboarding.step3.title",
  },
] as const satisfies readonly {
  readonly body: MessageKey;
  readonly title: MessageKey;
}[];

const COPY_LIMIT_KEYS = [
  "ui.onboarding.copyLimit.scope",
  "ui.onboarding.copyLimit.release",
  "ui.onboarding.copyLimit.privacy",
  "ui.onboarding.copyLimit.save",
] as const satisfies readonly MessageKey[];

export function ShellOnboardingPanel({
  compact,
  locale,
  state,
}: ShellOnboardingPanelProps): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": formatMessage(locale, "ui.onboarding.aria"),
      "data-authority-boundary": state.authorityBoundary,
      "data-release-boundary": state.releaseBoundary,
      "data-testid": "onboarding-panel",
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
        formatMessage(locale, "ui.onboarding.scopeLabel"),
      ),
      createElement(
        "div",
        {
          style: titleStyle,
        },
        formatMessage(locale, "ui.onboarding.title"),
      ),
      createElement(
        "p",
        {
          style: bodyStyle,
        },
        formatMessage(locale, "ui.onboarding.summary"),
      ),
    ),
    createElement(
      "div",
      {
        style: boundaryGridStyle,
      },
      createBoundaryLine(locale, "ui.onboarding.authority", state.authorityBoundary),
      createBoundaryLine(locale, "ui.onboarding.release", state.releaseBoundary),
    ),
    createElement(
      "ol",
      {
        style: stepListStyle,
      },
      ...ONBOARDING_STEP_KEYS.map((step, index) => createStep(locale, step, index)),
    ),
    createElement(
      "ul",
      {
        "data-testid": "onboarding-copy-limits",
        style: copyLimitListStyle,
      },
      ...COPY_LIMIT_KEYS.map((copyLimitKey) =>
        createElement(
          "li",
          {
            key: copyLimitKey,
            style: copyLimitItemStyle,
          },
          formatMessage(locale, copyLimitKey),
        ),
      ),
    ),
  );
}

function createBoundaryLine(locale: LocaleId, labelKey: MessageKey, value: string): ReactElement {
  return createElement(
    "div",
    {
      style: boundaryLineStyle,
    },
    createElement(
      "span",
      {
        style: boundaryLabelStyle,
      },
      formatMessage(locale, labelKey),
    ),
    createElement(
      "span",
      {
        style: boundaryValueStyle,
      },
      value,
    ),
  );
}

function createStep(
  locale: LocaleId,
  step: {
    readonly body: MessageKey;
    readonly title: MessageKey;
  },
  index: number,
): ReactElement {
  return createElement(
    "li",
    {
      "data-onboarding-step": String(index + 1),
      "data-testid": "onboarding-step",
      key: step.title,
      style: stepItemStyle,
    },
    createElement(
      "span",
      {
        style: stepNumberStyle,
      },
      String(index + 1),
    ),
    createElement(
      "span",
      {
        style: stepTextStyle,
      },
      createElement(
        "span",
        {
          style: stepTitleStyle,
        },
        formatMessage(locale, step.title),
      ),
      createElement(
        "span",
        {
          style: stepBodyStyle,
        },
        formatMessage(locale, step.body),
      ),
    ),
  );
}

const panelStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.035)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  overflowWrap: "anywhere",
  padding: "10px 12px",
};

const compactPanelStyle: CSSProperties = {
  ...panelStyle,
  maxHeight: "180px",
  overflowY: "auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const eyebrowStyle: CSSProperties = {
  color: "#d5b87a",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: "14px",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: "18px",
};

const bodyStyle: CSSProperties = {
  color: "#c8c0af",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "12px",
  lineHeight: "16px",
  margin: 0,
};

const boundaryGridStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const boundaryLineStyle: CSSProperties = {
  background: "rgba(0, 0, 0, 0.14)",
  border: "1px solid rgba(232, 206, 151, 0.1)",
  borderRadius: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
  padding: "6px 8px",
};

const boundaryLabelStyle: CSSProperties = {
  color: "#d3cab6",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "10px",
  fontWeight: 700,
  lineHeight: "14px",
  textTransform: "uppercase",
};

const boundaryValueStyle: CSSProperties = {
  color: "#f2e7d1",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "11px",
  fontWeight: 650,
  lineHeight: "15px",
};

const stepListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const stepItemStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "20px minmax(0, 1fr)",
};

const stepNumberStyle: CSSProperties = {
  alignItems: "center",
  background: "rgba(213, 184, 122, 0.14)",
  border: "1px solid rgba(213, 184, 122, 0.2)",
  borderRadius: "999px",
  color: "#f2e7d1",
  display: "flex",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "11px",
  fontWeight: 700,
  height: "20px",
  justifyContent: "center",
  lineHeight: "20px",
  width: "20px",
};

const stepTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
};

const stepTitleStyle: CSSProperties = {
  color: "#f7eed7",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: "16px",
};

const stepBodyStyle: CSSProperties = {
  color: "#b7a992",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "11px",
  lineHeight: "15px",
};

const copyLimitListStyle: CSSProperties = {
  color: "#d8cfbc",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  margin: 0,
  paddingLeft: "18px",
};

const copyLimitItemStyle: CSSProperties = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "11px",
  lineHeight: "15px",
};
