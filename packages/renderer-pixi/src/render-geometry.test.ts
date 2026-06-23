import { describe, expect, it } from "vitest";

import type { WorldReadModel } from "@wuming-town/sim-protocol";

import {
  createFittedViewport,
  findEntityAtScreenPoint,
  readEntityScreenPositions,
  screenToTile,
  tileToScreenCenter,
  zoomViewportAtPoint,
} from "./render-geometry";

const READ_MODEL: WorldReadModel = {
  sessionId: "session-smoke",
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
    alerts: [],
    resources: [],
  },
  chunks: [],
  entities: [
    {
      entityId: "entity-a",
      displayName: "沈墨",
      kind: "resident",
      tile: {
        x: 6,
        y: 4,
      },
      colorHex: 0xf4d35e,
      summary: "巡夜中",
      inspector: {
        roleLabel: "守灯人",
        currentJob: "巡灯",
        currentStep: "前往东街",
        moodLabel: "平稳",
        healthLabel: "良好",
        lastDecision: "优先补灯油",
        explainers: [],
        thoughts: [],
        needs: [],
      },
    },
  ],
  selectedEntityId: "entity-a",
};

describe("render-geometry", () => {
  it("fits the map into the canvas and resolves tile coordinates", () => {
    const viewport = createFittedViewport(READ_MODEL, 960, 640);
    const primaryEntity = READ_MODEL.entities.at(0);
    if (primaryEntity === undefined) {
      throw new Error("Expected a primary entity in the smoke read model.");
    }
    const entityScreenPoint = tileToScreenCenter(viewport, READ_MODEL, primaryEntity.tile);
    const tile = screenToTile(viewport, READ_MODEL, entityScreenPoint);

    expect(tile).toStrictEqual({
      x: 6,
      y: 4,
    });
  });

  it("finds entity selection from screen points", () => {
    const viewport = createFittedViewport(READ_MODEL, 960, 640);
    const screenPoint = readEntityScreenPositions(viewport, READ_MODEL).at(0);
    if (screenPoint === undefined) {
      throw new Error("Expected at least one projected entity.");
    }

    expect(findEntityAtScreenPoint(viewport, READ_MODEL, screenPoint)).toBe("entity-a");
  });

  it("keeps an anchored point stable while zooming", () => {
    const viewport = createFittedViewport(READ_MODEL, 960, 640);
    const primaryEntity = READ_MODEL.entities.at(0);
    if (primaryEntity === undefined) {
      throw new Error("Expected a primary entity in the smoke read model.");
    }
    const anchor = tileToScreenCenter(viewport, READ_MODEL, primaryEntity.tile);
    const zoomedViewport = zoomViewportAtPoint(viewport, READ_MODEL, anchor, viewport.zoom * 1.2);
    const zoomedTile = screenToTile(zoomedViewport, READ_MODEL, anchor);

    expect(zoomedTile).toStrictEqual({
      x: 6,
      y: 4,
    });
  });
});
