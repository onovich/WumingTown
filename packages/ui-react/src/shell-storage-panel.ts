import { createElement, type ChangeEvent, type CSSProperties, type ReactElement } from "react";

import type { ShellStorageActions, ShellStorageGateState } from "./shell-store";

export interface ShellStoragePanelProps {
  readonly actions: ShellStorageActions;
  readonly state: ShellStorageGateState;
}

interface InputElementLike {
  readonly files: {
    readonly 0?: File;
    readonly length: number;
  } | null;
  value: string;
}

export function ShellStoragePanel({ actions, state }: ShellStoragePanelProps): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Web storage gate",
      "data-testid": "storage-panel",
      style: storagePanelStyle,
    },
    createElement(
      "div",
      {
        style: sectionHeaderStyle,
      },
      createElement(
        "div",
        {
          style: sectionLabelStyle,
        },
        "Storage Gate",
      ),
      createElement(
        "div",
        {
          style: bodyCopyStyle,
        },
        state.scopeNote,
      ),
    ),
    createElement(
      "div",
      {
        style: summaryGridStyle,
      },
      createSummaryRow("Storage", state.storageKindLabel),
      createSummaryRow("Quota", formatQuota(state)),
      createSummaryRow("Slots", `${String(state.saveSlots.length)} active slot(s)`),
      createSummaryRow("Last action", state.lastActionLabel),
    ),
    createElement(
      "div",
      {
        "data-testid": "storage-status",
        "data-storage-tone": state.statusTone,
        style: statusCardStyle(state.statusTone),
      },
      createElement(
        "div",
        {
          style: chipValueStyle,
        },
        state.userMessage,
      ),
      createElement(
        "div",
        {
          style: chipHintStyle,
        },
        state.statusDetail,
      ),
    ),
    createElement(
      "div",
      {
        "data-testid": "storage-interoperability",
        "data-verdict": state.interoperabilityVerdict,
        style: interoperabilityCardStyle,
      },
      createElement(
        "div",
        {
          style: chipLabelStyle,
        },
        "Windows interoperability",
      ),
      createElement(
        "div",
        {
          style: chipValueStyle,
        },
        state.interoperabilityVerdict.toUpperCase(),
      ),
      createElement(
        "div",
        {
          style: chipHintStyle,
        },
        state.interoperabilityDetail,
      ),
    ),
    createElement(
      "div",
      {
        style: buttonRowStyle,
      },
      createActionButton("storage-save-button", "Save fixture", actions.onSaveFixture),
      createActionButton("storage-load-button", "Load save", actions.onLoadSave),
      createActionButton("storage-export-button", "Export save", actions.onExportSave),
      createActionButton("storage-delete-button", "Delete save", actions.onDeleteSave),
      createActionButton("storage-refresh-button", "Refresh", actions.onRefreshStorage),
    ),
    createElement(
      "label",
      {
        style: importLabelStyle,
      },
      createElement(
        "span",
        {
          style: chipLabelStyle,
        },
        "Import save file",
      ),
      createElement("input", {
        "data-testid": "storage-import-input",
        accept: ".wtsave,application/vnd.wuming-town.m6-gate+json,application/json",
        onChange: (event: ChangeEvent<HTMLInputElement>): void => {
          const input = event.target;
          const file = readSelectedFile(input);
          if (file === undefined) {
            return;
          }

          void actions.onImportFile(file);
          if (input instanceof HTMLInputElement) {
            input.value = "";
          }
        },
        style: importInputStyle,
        type: "file",
      }),
    ),
    createElement(
      "ul",
      {
        "data-testid": "storage-slot-count",
        style: slotListStyle,
      },
      ...state.saveSlots.map((slot) =>
        createElement(
          "li",
          {
            key: slot.id,
            style: slotItemStyle,
          },
          createElement(
            "div",
            {
              style: chipValueStyle,
            },
            slot.id,
          ),
          createElement(
            "div",
            {
              style: chipHintStyle,
            },
            `${formatBytes(slot.sizeBytes)} | ${slot.checksumSha256Hex.slice(0, 12)}...`,
          ),
          createElement(
            "div",
            {
              style: chipHintStyle,
            },
            new Date(slot.updatedAtUnixMs).toISOString(),
          ),
        ),
      ),
    ),
    state.diagnostic === undefined
      ? createElement(
          "div",
          {
            "data-testid": "storage-diagnostic",
            style: hiddenDiagnosticStyle,
          },
          "",
        )
      : createElement(
          "pre",
          {
            "data-testid": "storage-diagnostic",
            style: diagnosticStyle,
          },
          JSON.stringify(
            {
              code: state.diagnostic.code,
              detail: state.diagnostic.detailJson,
              message: state.diagnostic.message,
              recoverable: state.diagnostic.recoverable,
              userMessage: state.diagnostic.userMessage,
            },
            null,
            2,
          ),
        ),
  );
}

function createActionButton(
  testId: string,
  label: string,
  action: () => Promise<void>,
): ReactElement {
  return createElement(
    "button",
    {
      "data-testid": testId,
      onClick: (): void => {
        void action();
      },
      style: actionButtonStyle,
      type: "button",
    },
    label,
  );
}

function createSummaryRow(label: string, value: string): ReactElement {
  return createElement(
    "div",
    {
      key: label,
      style: summaryCellStyle,
    },
    createElement(
      "div",
      {
        style: chipLabelStyle,
      },
      label,
    ),
    createElement(
      "div",
      {
        style: chipHintStyle,
      },
      value,
    ),
  );
}

function formatBytes(value: number | null): string {
  if (value === null) {
    return "unknown";
  }

  if (value < 1024) {
    return `${String(value)} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatQuota(state: ShellStorageGateState): string {
  return [
    `available ${formatBytes(state.quotaAvailableBytes)}`,
    `usage ${formatBytes(state.usageBytes)}`,
    `quota ${formatBytes(state.quotaBytes)}`,
  ].join(" | ");
}

function readSelectedFile(target: EventTarget | null): File | undefined {
  if (!isInputElementLike(target)) {
    return undefined;
  }

  const fileList = target.files;
  if (fileList === null || fileList.length === 0) {
    return undefined;
  }

  return fileList[0] ?? undefined;
}

function isInputElementLike(value: unknown): value is InputElementLike {
  return typeof value === "object" && value !== null && "files" in value && "value" in value;
}

const storagePanelStyle: CSSProperties = {
  background: "rgba(18, 15, 11, 0.92)",
  border: "1px solid rgba(232, 206, 151, 0.18)",
  borderRadius: "8px",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
  display: "flex",
  flex: "0 0 360px",
  flexDirection: "column",
  gap: "12px",
  maxWidth: "380px",
  padding: "12px 14px",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const summaryCellStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minHeight: "56px",
  padding: "10px 12px",
};

const interoperabilityCardStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "10px 12px",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const actionButtonStyle: CSSProperties = {
  background: "#ead4a0",
  border: "none",
  borderRadius: "6px",
  color: "#1a1712",
  cursor: "pointer",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "12px",
  fontWeight: 700,
  padding: "8px 10px",
};

const importLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const importInputStyle: CSSProperties = {
  color: "#d8cfbc",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "12px",
};

const slotListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  margin: 0,
  paddingLeft: "18px",
};

const slotItemStyle: CSSProperties = {
  color: "#d8cfbc",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "12px",
  lineHeight: "16px",
};

const diagnosticStyle: CSSProperties = {
  background: "rgba(0, 0, 0, 0.24)",
  border: "1px solid rgba(232, 206, 151, 0.12)",
  borderRadius: "6px",
  color: "#d8cfbc",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: "11px",
  lineHeight: "16px",
  margin: 0,
  overflowX: "auto",
  padding: "10px 12px",
  whiteSpace: "pre-wrap",
};

const hiddenDiagnosticStyle: CSSProperties = {
  display: "none",
};

const sectionLabelStyle: CSSProperties = {
  color: "#d3cab6",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: "16px",
  textTransform: "uppercase",
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
  fontSize: "14px",
  fontWeight: 650,
  lineHeight: "19px",
};

const chipHintStyle: CSSProperties = {
  color: "#b7a992",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "12px",
  lineHeight: "16px",
};

const bodyCopyStyle: CSSProperties = {
  color: "#c8c0af",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "13px",
  lineHeight: "18px",
  margin: 0,
};

function statusCardStyle(tone: ShellStorageGateState["statusTone"]): CSSProperties {
  const borderColor =
    tone === "danger"
      ? "rgba(233, 101, 78, 0.3)"
      : tone === "warning"
        ? "rgba(244, 181, 45, 0.28)"
        : "rgba(127, 176, 116, 0.28)";

  return {
    background: "rgba(255, 255, 255, 0.03)",
    border: `1px solid ${borderColor}`,
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "10px 12px",
  };
}
