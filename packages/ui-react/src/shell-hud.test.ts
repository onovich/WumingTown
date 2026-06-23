import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WorldReadModel } from "@wuming-town/sim-protocol";

import { createShellHudElement } from "./shell-hud";
import { createShellStore, type ShellState } from "./shell-store";

const READ_MODEL: WorldReadModel = {
  sessionId: "session-ui",
  mapName: "Smoke Basin",
  tileSize: 32,
  chunkSize: 8,
  mapWidth: 16,
  mapHeight: 12,
  town: {
    settlementName: "无明镇",
    phaseLabel: "黄昏总览",
    cycleLabel: "第三夜",
    speedLabel: "Paused",
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
      displayName: "沈墨",
      kind: "resident",
      tile: {
        x: 5,
        y: 3,
      },
      colorHex: 0xf4d35e,
      summary: "Patrolling lantern route",
      inspector: {
        roleLabel: "守灯人",
        currentJob: "Lantern patrol",
        currentStep: "Move to east gate",
        moodLabel: "Focused",
        healthLabel: "Stable",
        lastDecision: "Refuel east alley first",
        explainers: ["Fuel reserve there is lowest in the district."],
        thoughts: ["Keep the market lane bright before curfew."],
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
  it("renders selected entity inspector content from the read model", () => {
    const state: ShellState = {
      readModel: READ_MODEL,
      canvasWidth: 1280,
      canvasHeight: 720,
      zoom: 1.25,
      lastInputLabel: "Ready",
      selectedEntityId: "entity-a",
      hoverTile: {
        x: 5,
        y: 3,
      },
    };
    const store = createShellStore(state);
    const markup = renderToStaticMarkup(createShellHudElement(store));

    expect(markup).toContain("沈墨");
    expect(markup).toContain("Lantern patrol");
    expect(markup).toContain("Refuel east alley first");
    expect(markup).toContain("Canvas 1280 x 720");
  });
});
