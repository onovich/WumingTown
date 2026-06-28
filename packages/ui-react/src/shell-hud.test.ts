import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WorldReadModel } from "@wuming-town/sim-protocol";

import { createShellHudElement } from "./shell-hud";
import { createDefaultShellLocaleState } from "./localization";
import { createDefaultShellUiScaleState } from "./shell-ui-scale";
import { createShellStore, type ShellState } from "./shell-store";

const READ_MODEL: WorldReadModel = {
  sessionId: "session-ui",
  mapName: "Product Gate Basin",
  tileSize: 32,
  chunkSize: 8,
  mapWidth: 192,
  mapHeight: 192,
  town: {
    settlementName: "Wuming Town / 无明镇",
    phaseLabel: "Dusk watch",
    cycleLabel: "First season gate",
    speedLabel: "Read-only fixture",
    alerts: [
      {
        severity: "warning",
        label: "Lantern gap",
        detail: "East street fuel window under 3h",
      },
    ],
    resources: [
      {
        label: "Rice",
        amount: 23,
        unit: "d",
        trend: "steady",
      },
    ],
  },
  chunks: [],
  entities: [
    {
      entityId: "entity-a",
      displayName: "Chronicler Lin",
      kind: "resident",
      tile: {
        x: 96,
        y: 80,
      },
      colorHex: 0xf4d35e,
      summary: "Reviewing archive evidence",
      inspector: {
        roleLabel: "Chronicle office",
        currentJob: "Ledger review",
        currentStep: "Verify witness order",
        moodLabel: "Focused",
        healthLabel: "Stable",
        lastDecision: "Keep the archive open until the route list is clear.",
        explainers: ["The guest list still conflicts with one witness slip."],
        thoughts: ["Hold the lane until the archive and watch agree."],
        needs: [
          {
            label: "Rest",
            value: 38,
            state: "steady",
          },
        ],
      },
    },
  ],
  selectedEntityId: "entity-a",
};

const FIXTURE_SLICE_READ_MODEL: WorldReadModel = {
  sessionId: "session-ui-fixture-slice",
  mapName: "East market and bridge road",
  tileSize: 32,
  chunkSize: 8,
  mapWidth: 192,
  mapHeight: 192,
  town: {
    settlementName: "Wuming Town / 无明镇",
    phaseLabel: "Dusk watch",
    cycleLabel: "First season, curfew approach",
    speedLabel: "Paused",
    alerts: [
      {
        severity: "warning",
        label: "Lantern corridor gap",
        detail: "The east market lane may lose light before curfew.",
      },
      {
        severity: "stable",
        label: "Bridge parcels staged",
        detail: "Prepared goods are ready beside the old bridge route.",
      },
    ],
    resources: [
      {
        label: "Rice",
        amount: 36,
        unit: "d",
        trend: "steady",
      },
    ],
  },
  chunks: [],
  entities: [
    {
      entityId: "entity-fixture-a",
      displayName: "Chronicler Lin",
      kind: "resident",
      tile: {
        x: 96,
        y: 80,
      },
      colorHex: 0xf4d35e,
      summary: "Cross-checking debt ledgers and witness records before curfew.",
      inspector: {
        roleLabel: "Chronicle office",
        currentJob: "Ledger review",
        currentStep: "Verify north-gate witness order",
        moodLabel: "Alert",
        healthLabel: "Unhurt",
        lastDecision: "Delay archive sealing until the last road guest is registered.",
        explainers: ["Two pledge slips still disagree on creditor witness order."],
        thoughts: ["Keep faction debt separate from shrine records."],
        needs: [
          {
            label: "Clarity",
            value: 58,
            state: "steady",
          },
        ],
      },
    },
  ],
  selectedEntityId: "entity-fixture-a",
};

describe("shell-hud", () => {
  it("renders the default main menu surface without diagnostics harness copy", () => {
    const state = createShellState(createDefaultShellLocaleState(["en-US"]));
    const markup = renderShell(state);

    expect(markup).toContain("Main menu");
    expect(markup).toContain("New Game");
    expect(markup).toContain("Continue");
    expect(markup).toContain("Settings");
    expect(markup).toContain("Presentation language");
    expect(markup).toContain("UI scale");
    expect(markup).toContain("Current phase");
    expect(markup).toContain("First-play guidance");
    expect(markup).toContain("Available actions");
    expect(markup).toContain("Next goal");
    expect(markup).toContain("Lantern gap");
    expect(markup).toContain(
      "debug information appears only when diagnostics mode is explicitly enabled",
    );
    expect(markup).not.toContain("Web Product Gate");
    expect(markup).not.toContain("Storage Gate");
  });

  it("renders zh-CN shell chrome for the default main menu surface", () => {
    const state = createShellState(createDefaultShellLocaleState(["zh-TW"]));
    const markup = renderShell(state);

    expect(markup).toContain("主菜单");
    expect(markup).toContain("新游戏");
    expect(markup).toContain("继续");
    expect(markup).toContain("设置");
    expect(markup).toContain("界面语言");
    expect(markup).toContain("界面缩放");
    expect(markup).toContain("首次游玩指引");
    expect(markup).toContain("可用行动");
    expect(markup).toContain("下一目标");
    expect(markup).toContain("黄昏守望");
    expect(markup).toContain("补上灯火缺口");
    expect(markup).toContain("先确认灯火覆盖、路线证据与守夜义务");
    expect(markup).toContain("玩家引导与开发诊断分离");
    expect(markup).not.toContain("Dusk watch");
    expect(markup).not.toContain("Lantern gap");
    expect(markup).not.toContain("East street fuel window");
    expect(markup).not.toContain("Product Gate");
    expect(markup).not.toContain("Main menu");
    expect(markup).not.toContain("New Game");
    expect(markup).not.toContain("Settings");
  });

  it("renders the player HUD and gated debug overlay only when diagnostics are enabled", () => {
    const state = {
      ...createShellState(createDefaultShellLocaleState(["en-US"])),
      diagnosticsVisible: true,
    } satisfies ShellState;
    const markup = renderShell(state);

    expect(markup).toContain("Player HUD");
    expect(markup).toContain("Current state");
    expect(markup).toContain("Next goal");
    expect(markup).toContain("Night risk");
    expect(markup).toContain("Current tasks");
    expect(markup).toContain("Residents to watch");
    expect(markup).toContain("Debug overlay");
    expect(markup).toContain("Web Product Gate");
    expect(markup).not.toContain("Main menu");
  });

  it("localizes fixture-backed zh-CN player HUD text and input feedback", () => {
    const state = {
      ...createShellState(createDefaultShellLocaleState(["zh-TW"]), FIXTURE_SLICE_READ_MODEL),
      diagnosticsVisible: true,
      lastInputLabel: "Ready",
    } satisfies ShellState;
    const markup = renderShell(state);

    expect(markup).toContain("\u706f\u5eca\u7f3a\u53e3");
    expect(markup).toContain("\u6865\u8def\u5305\u88f9\u5df2\u5907\u59a5");
    expect(markup).toContain("\u7f16\u5fd7\u6240");
    expect(markup).toContain("\u7c73\u7cae");
    expect(markup).toContain("\u7a33\u5b9a");
    expect(markup).toContain("\u65e0\u4f24");
    expect(markup).toContain("\u5c31\u7eea");
    expect(markup).not.toContain("Lantern corridor gap");
    expect(markup).not.toContain("Bridge parcels staged");
    expect(markup).not.toContain("Chronicle office");
    expect(markup).not.toContain("Rice");
    expect(markup).not.toContain("Unhurt");
  });
});

function createShellState(
  locale: ReturnType<typeof createDefaultShellLocaleState>,
  readModel: WorldReadModel = READ_MODEL,
): ShellState {
  return {
    readModel,
    releaseGate: {
      fixtureId: "wm-0086-web-product-gate",
      title: "Web Product Gate",
      browserTargets: ["Chrome Stable", "Edge Stable"],
      runtimeBrowser: "Chrome-family browser",
      runtimeCrossOriginIsolated: false,
      sections: [
        {
          label: "Fixture",
          value: "M5 first-season Web product-gate fixture",
          detail: "Map 192 x 192 | 40 visible actors | 20000 total-entity target",
        },
      ],
    },
    storageGate: {
      diagnostic: undefined,
      interoperabilityDetail:
        "Blocked until the Electron preload exposes a reviewed save-store bridge.",
      interoperabilityVerdict: "blocked",
      lastActionLabel: "Idle",
      quotaAvailableBytes: 1024 * 1024,
      quotaBytes: 2 * 1024 * 1024,
      saveId: "m6-gate-slot",
      saveSlots: [
        {
          checksumSha256Hex: "1234567890abcdef1234567890abcdef",
          id: "m6-gate-slot",
          sizeBytes: 512,
          updatedAtUnixMs: 1_717_000_000_000,
        },
      ],
      scopeNote:
        "M6 gate envelope only. This does not promise public save compatibility beyond the product gate.",
      statusDetail: "OPFS available and ready for import/export evidence.",
      statusTone: "stable",
      storageKindLabel: "OPFS ready",
      usageBytes: 256 * 1024,
      userMessage: "Web storage ready for gate evidence.",
    },
    onboarding: {
      authorityBoundary: "read-model-only",
      releaseBoundary: "web-demo-windows-controlled-test",
    },
    locale,
    uiScale: createDefaultShellUiScaleState(),
    diagnosticsVisible: false,
    canvasWidth: 1280,
    canvasHeight: 720,
    zoom: 1.25,
    lastInputLabel: "Ready",
    selectedEntityId: readModel.selectedEntityId,
    hoverTile: {
      x: 96,
      y: 80,
    },
  };
}

function renderShell(state: ShellState): string {
  const store = createShellStore(state);
  const noopAsync = (): Promise<void> => Promise.resolve();
  const noopSetLocale: (locale: "en" | "zh-CN") => Promise<void> = () => Promise.resolve();
  const noopSetUiScale: (scale: "standard" | "large" | "extra-large") => Promise<void> = () =>
    Promise.resolve();
  const noopImport: (file: File) => Promise<void> = () => Promise.resolve();

  return renderToStaticMarkup(
    createShellHudElement(
      store,
      {
        onDeleteSave: noopAsync,
        onExportSave: noopAsync,
        onImportFile: noopImport,
        onLoadSave: noopAsync,
        onRefreshStorage: noopAsync,
        onSaveFixture: noopAsync,
      },
      {
        onUseManualLocale: noopSetLocale,
        onUseSystemLocale: noopAsync,
        onUseUiScale: noopSetUiScale,
      },
    ),
  );
}
