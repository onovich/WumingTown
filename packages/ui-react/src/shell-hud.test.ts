import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CommandBasis, WorldReadModel } from "@wuming-town/sim-protocol";

import { createShellHudElement } from "./shell-hud";
import { localizeShellLastInputLabel } from "./shell-read-model-localization";
import { createDefaultShellLocaleState } from "./localization";
import { createDefaultShellUiScaleState } from "./shell-ui-scale";
import {
  createShellStore,
  type ShellPlayableCommandSurfaceState,
  type ShellState,
} from "./shell-store";

const COMMAND_BASIS: CommandBasis = {
  playableCommandContractVersion: 1,
  basisTick: 120,
  basisSnapshotSequence: 8,
  basisReadModelHash: "read-model-hash",
  contentManifestHash: "content-hash",
  targetVersion: 3,
  mapVersion: 2,
  reservationVersion: 1,
  jobVersion: 4,
};

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
  chunks: [
    {
      chunkId: "fixture-slice-inspected-tile",
      originTile: {
        x: 104,
        y: 100,
      },
      width: 1,
      height: 1,
      terrain: ["lantern-glow"],
    },
  ],
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
    expect(markup).toContain("Current phase");
    expect(markup).toContain("First-play guidance");
    expect(markup).toContain("Available actions");
    expect(markup).toContain("Next goal");
    expect(markup).toContain("Lantern gap");
    expect(markup).toContain("East Market Lantern Post, a pawn, or a map tile");
    expect(markup).toContain("Lamp chain");
    expect(markup).toContain("Build chain");
    expect(markup).toContain("accepted and rejected commands show structured status");
    expect(markup).toContain("Build mode");
    expect(markup).toContain(
      "Player guidance stays on the player surface; internal tools remain separate",
    );
    expect(markup).not.toContain("read-model fixture");
    expect(markup).not.toContain("fixture");
    expect(markup).not.toContain("developer diagnostics");
    expect(markup).not.toContain("debug information");
    expect(markup).not.toContain("wm-0086-web-product-gate");
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
    expect(markup).toContain("首次游玩指引");
    expect(markup).toContain("可用行动");
    expect(markup).toContain("下一目标");
    expect(markup).toContain("黄昏守望");
    expect(markup).toContain("补上灯火缺口");
    expect(markup).toContain("先确认灯火覆盖、路线证据与守夜义务");
    expect(markup).toContain("选择目标：点击东市灯柱");
    expect(markup).toContain("灯火链路");
    expect(markup).toContain("建造链路");
    expect(markup).toContain("结构化状态、进度、完成或阻塞原因");
    expect(markup).toContain("建造模式");
    expect(markup).toContain("玩家指引保留在玩家界面");
    expect(markup).not.toContain("本地补灯");
    expect(markup).not.toContain("本地行动");
    expect(markup).not.toContain("HUD");
    expect(markup).not.toContain("Worker");
    expect(markup).not.toContain("Dusk watch");
    expect(markup).not.toContain("Lantern gap");
    expect(markup).not.toContain("East street fuel window");
    expect(markup).not.toContain("read-model fixture");
    expect(markup).not.toContain("fixture");
    expect(markup).not.toContain("开发诊断");
    expect(markup).not.toContain("调试信息");
    expect(markup).not.toContain("wm-0086-web-product-gate");
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
    expect(markup).toContain("Next goal");
    expect(markup).toContain("Night risk");
    expect(markup).toContain("Events and watchpoints");
    expect(markup).toContain("Residents to watch");
    expect(markup).toContain("Command bar");
    expect(markup).toContain('data-testid="player-attention-queue"');
    expect(markup).toContain('data-testid="player-settings-toggle"');
    expect(markup).not.toContain('data-testid="locale-settings"');
    expect(markup).toContain("Prioritize lamp work");
    expect(markup).toContain('data-testid="player-command-bar"');
    expect(markup).toContain('data-ui-slot="panel.paper.primary"');
    expect(markup).toContain('data-ui-slot="button.primary.disabled"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Developer diagnostics");
    expect(markup).toContain("Debug-only overlay");
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
    expect(markup).toContain("\u547d\u4ee4\u5e26");
    expect(markup).toContain("\u4f18\u5148\u8865\u706f");
    expect(markup).toContain("\u4e8b\u4ef6\u4e0e\u89c2\u5bdf\u70b9");
    expect(markup).toContain("\u706f\u5eca\u7f3a\u53e3");
    expect(markup).not.toContain("Command bar");
    expect(markup).not.toContain("Prioritize lamp work");
    expect(markup).not.toContain("Lantern corridor gap");
    expect(markup).not.toContain("Bridge parcels staged");
    expect(markup).not.toContain("Chronicle office");
    expect(markup).not.toContain("Rice");
    expect(markup).not.toContain("Unhurt");

    expect(localizeShellLastInputLabel("zh-CN", "Camera drag")).toBe("\u62d6\u62fd\u5e73\u79fb");
    expect(localizeShellLastInputLabel("zh-CN", "Camera reset")).toBe("\u76f8\u673a\u590d\u4f4d");
    expect(localizeShellLastInputLabel("zh-CN", "Action queued wm0138-lamp-priority-001")).toBe(
      "\u5df2\u6392\u5165\uff1awm0138-lamp-priority-001",
    );
  });

  it("renders authoritative Worker lamp feedback with visible progress", () => {
    const state = {
      ...createShellState(createDefaultShellLocaleState(["en-US"]), createLampPriorityReadModel()),
      diagnosticsVisible: true,
      lastInputLabel: "Action queued wm0152-lamp-001",
      playableCommandSurface: createPlayableCommandSurfaceState(),
      playableAction: {
        actionId: "prioritize-lamp-work",
        adapterId: "wm0152-authoritative-worker-session",
        authority: "simulation-worker-projection",
        commandId: "wm0152-lamp-001",
        markerState: "moving",
        progressPercent: 32,
        status: "accepted",
        targetEntityId: "east-market-lantern-post",
        targetLabel: "East Market Lantern Post",
      },
    } satisfies ShellState;
    const markup = renderShell(state);

    expect(markup).toContain('data-testid="player-action-feedback"');
    expect(markup).toContain('data-action-authority="simulation-worker-projection"');
    expect(markup).toContain('data-action-marker-state="moving"');
    expect(markup).toContain('data-command-state="queued"');
    expect(markup).toContain('data-reason-code=""');
    expect(markup).toContain('data-target-entity="east-market-lantern-post"');
    expect(markup).toContain('data-ui-slot="button.primary.active"');
    expect(markup).toContain("Authoritative command accepted");
    expect(markup).toContain("State: Moving");
    expect(markup).toContain("Progress: 32%");
    expect(markup).toContain("Command id: wm0152-lamp-001");
  });

  it("renders zh-CN objective-action HUD with authoritative lamp feedback", () => {
    const state = {
      ...createShellState(createDefaultShellLocaleState(["zh-CN"]), createLampPriorityReadModel()),
      diagnosticsVisible: true,
      lastInputLabel: "Action queued wm0152-lamp-001",
      playableCommandSurface: createPlayableCommandSurfaceState(),
      playableAction: {
        actionId: "prioritize-lamp-work",
        adapterId: "wm0152-authoritative-worker-session",
        authority: "simulation-worker-projection",
        commandId: "wm0152-lamp-001",
        markerState: "working",
        progressPercent: 64,
        status: "accepted",
        targetEntityId: "east-market-lantern-post",
        targetLabel: "East Market Lantern Post",
      },
    } satisfies ShellState;
    const markup = renderShell(state);

    expect(markup).toContain('data-testid="player-next-goal"');
    expect(markup).toContain("\u4f18\u5148\u8865\u706f");
    expect(markup).toContain('data-testid="player-settings-toggle"');
    expect(markup).toContain('data-testid="player-action-feedback"');
    expect(markup).toContain('data-command-state="queued"');
    expect(markup).toContain('data-action-marker-state="working"');
    expect(markup).toContain("wm0152-lamp-001");
    expect(markup).toContain("东市灯柱");
    expect(markup).toContain("工作中");
    expect(markup).not.toContain("East Market Lantern Post");
    expect(markup).not.toContain("Working");
  });

  it("renders localized empty-tile inspection feedback when no entity is selected", () => {
    const state = {
      ...createShellState(createDefaultShellLocaleState(["en-US"]), FIXTURE_SLICE_READ_MODEL),
      diagnosticsVisible: true,
      inspectedTile: {
        x: 104,
        y: 100,
      },
      lastInputLabel: "Canvas inspect 104,100",
      selectedEntityId: undefined,
    } satisfies ShellState;
    const markup = renderShell(state);

    expect(markup).toContain("Tile inspection");
    expect(markup).toContain("Inspect tile 104,100");
    expect(markup).toContain("Terrain");
    expect(markup).toContain("Lantern glow");
    expect(markup).toContain("East market and bridge road");
    expect(markup).toContain('data-testid="player-selected-detail"');
  });

  it("selects desktop, medium, and compact HUD layout modes from viewport size", () => {
    const baseState = createShellState(createDefaultShellLocaleState(["en-US"]));

    expect(
      renderShell({
        ...baseState,
        canvasWidth: 1600,
        canvasHeight: 900,
        diagnosticsVisible: true,
      }),
    ).toContain('data-layout-mode="desktop"');
    expect(
      renderShell({
        ...baseState,
        canvasWidth: 1424,
        canvasHeight: 861,
        diagnosticsVisible: true,
      }),
    ).toContain('data-layout-mode="medium"');
    expect(
      renderShell({
        ...baseState,
        canvasWidth: 390,
        canvasHeight: 720,
        diagnosticsVisible: true,
      }),
    ).toContain('data-layout-mode="compact"');
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
    inspectedTile: {
      x: 96,
      y: 80,
    },
    hoverTile: {
      x: 96,
      y: 80,
    },
    buildMode: "inactive",
  };
}

function createLampPriorityReadModel(): WorldReadModel {
  return {
    ...READ_MODEL,
    entities: [
      ...READ_MODEL.entities,
      {
        entityId: "east-market-lantern-post",
        displayName: "East Market Lantern Post",
        kind: "structure",
        tile: {
          x: 104,
          y: 88,
        },
        colorHex: 0xf6bd60,
        summary: "Authoritative lamp gap is awaiting player action.",
        inspector: {
          roleLabel: "Lamp structure",
          currentJob: "Build placement",
          currentStep: "Select this structure or enter build mode",
          moodLabel: "Stable",
          healthLabel: "Structural",
          lastDecision: "Select this structure or enter build mode",
          explainers: ["This structure is rendered from the authoritative Worker projection."],
          thoughts: ["UI reads projection state only and does not own structure mutation."],
          needs: [],
        },
      },
      {
        entityId: "lamp-keeper-test",
        displayName: "Lantern Keeper Shen",
        kind: "lantern-keeper",
        tile: {
          x: 98,
          y: 82,
        },
        colorHex: 0xe8b957,
        summary: "Checking lantern oil boundaries before curfew.",
        inspector: {
          roleLabel: "Lantern patrol",
          currentJob: "Lamp route review",
          currentStep: "Verify east-market lantern gap",
          moodLabel: "Ready",
          healthLabel: "Unhurt",
          lastDecision: "Walk the dim lane before the watch bell.",
          explainers: ["The east market lane is still the weakest glow path."],
          thoughts: ["Keep the lamp count separate from bridge parcels."],
          needs: [
            {
              label: "Oil",
              value: 64,
              state: "low",
            },
          ],
        },
      },
    ],
    selectedEntityId: "east-market-lantern-post",
  };
}

function createPlayableCommandSurfaceState(): ShellPlayableCommandSurfaceState {
  return {
    currentTick: 120,
    lampCommands: [
      {
        actionId: "prioritize-lamp-work",
        commandKind: "PrioritizeLampWork",
        commandBasis: COMMAND_BASIS,
        payload: {
          target: {
            kind: "lamp_gap",
            gapId: "east-market-gap",
            anchorCell: {
              x: 12,
              y: 7,
              cellIndex: 124,
            },
          },
          requestedAction: "auto",
          priorityBand: 1,
        },
        available: true,
        targetEntityId: "east-market-lantern-post",
        targetLabel: "East Market Lantern Post",
        targetTile: {
          x: 120,
          y: 92,
        },
      },
    ],
    buildPlacements: [
      {
        anchorTile: {
          x: 120,
          y: 92,
        },
        footprintTiles: [
          {
            x: 120,
            y: 92,
          },
        ],
        interactionTiles: [
          {
            x: 120,
            y: 92,
          },
        ],
        valid: true,
        command: {
          actionId: "queue-simple-build",
          commandKind: "QueueSimpleBuild",
          commandBasis: COMMAND_BASIS,
          payload: {
            blueprint: {
              kind: "simple_lamp_post",
              blueprintDefId: 1,
            },
            anchorCell: {
              x: 12,
              y: 7,
              cellIndex: 124,
            },
            orientation: 0,
            priorityBand: 1,
          },
          available: true,
          targetEntityId: "east-market-lantern-post",
          targetLabel: "East Market Lantern Post",
          targetTile: {
            x: 120,
            y: 92,
          },
        },
      },
    ],
  };
}

function renderShell(state: ShellState): string {
  const store = createShellStore(state);
  const noopAsync = (): Promise<void> => Promise.resolve();
  const noopSetLocale: (locale: "en" | "zh-CN") => Promise<void> = () => Promise.resolve();
  const noopSetUiScale: (scale: "standard" | "large" | "extra-large") => Promise<void> = () =>
    Promise.resolve();
  const noopImport: (file: File) => Promise<void> = () => Promise.resolve();
  const noopCommand = (): Promise<void> => Promise.resolve();
  const noopSetBuildMode = (): Promise<void> => Promise.resolve();

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
      {
        onPrioritizeLampWork: noopCommand,
        onQueueSimpleBuild: noopCommand,
        onSetBuildMode: noopSetBuildMode,
      },
    ),
  );
}
