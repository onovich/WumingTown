import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WorldReadModel } from "@wuming-town/sim-protocol";

import { createShellHudElement } from "./shell-hud";
import { createShellStore, type ShellState } from "./shell-store";

const READ_MODEL: WorldReadModel = {
  sessionId: "session-ui",
  mapName: "Product Gate Basin",
  tileSize: 32,
  chunkSize: 8,
  mapWidth: 192,
  mapHeight: 192,
  town: {
    settlementName: "Wuming Town",
    phaseLabel: "Web product gate",
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

describe("shell-hud", () => {
  it("renders selected entity inspector content and release-gate metadata", () => {
    const state: ShellState = {
      readModel: READ_MODEL,
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
        copyLimits: ["Web remains demo-only."],
        releaseBoundary: "web-demo-windows-controlled-test",
        scopeLabel: "External test briefing",
        steps: [
          {
            body: "Read the fixture before changing plans.",
            id: "launch-input-time",
            title: "Launch, movement, input, time control",
          },
        ],
        summary: "Follow the first-run path through existing read-model surfaces.",
        title: "M7 first-run path",
      },
      canvasWidth: 1280,
      canvasHeight: 720,
      zoom: 1.25,
      lastInputLabel: "Ready",
      selectedEntityId: "entity-a",
      hoverTile: {
        x: 96,
        y: 80,
      },
    };
    const store = createShellStore(state);
    const noopAsync = (): Promise<void> => Promise.resolve();
    const noopImport: (file: File) => Promise<void> = () => Promise.resolve();
    const markup = renderToStaticMarkup(
      createShellHudElement(store, {
        onDeleteSave: noopAsync,
        onExportSave: noopAsync,
        onImportFile: noopImport,
        onLoadSave: noopAsync,
        onRefreshStorage: noopAsync,
        onSaveFixture: noopAsync,
      }),
    );

    expect(markup).toContain("Chronicler Lin");
    expect(markup).toContain("Ledger review");
    expect(markup).toContain("Keep the archive open until the route list is clear.");
    expect(markup).toContain("Canvas 1280 x 720");
    expect(markup).toContain("Web Product Gate");
    expect(markup).toContain("Chrome Stable, Edge Stable");
    expect(markup).toContain("Map 192 x 192");
    expect(markup).toContain("Storage Gate");
    expect(markup).toContain("M7 first-run path");
    expect(markup).toContain("Web storage ready for gate evidence.");
    expect(markup).toContain(
      "Blocked until the Electron preload exposes a reviewed save-store bridge.",
    );
  });
});
