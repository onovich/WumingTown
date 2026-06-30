import { describe, expect, it } from "vitest";

import type { WorldReadModel } from "@wuming-town/sim-protocol";

import {
  createFittedViewport,
  findEntityAtScreenPoint,
  panViewport,
  readEntityActivityScreenProjection,
  readEntityScreenPositions,
  readFocusMarkerScreenPoint,
  readPathScreenPoints,
  readSemanticAreaScreenRect,
  screenToTile,
  tileToScreenBounds,
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
      activity: {
        state: "moving",
        label: "前往东街灯点",
        detail: "沿主路赶往灯架",
        intentLabel: "补灯油",
        pathTiles: [
          { x: 6, y: 4 },
          { x: 7, y: 4 },
          { x: 8, y: 4 },
        ],
        targetTile: { x: 8, y: 4 },
      },
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
  semanticAreas: [
    {
      areaId: "hall",
      kind: "structure",
      label: "Archive hall",
      originTile: { x: 4, y: 3 },
      width: 3,
      height: 2,
      emphasisTile: { x: 5, y: 4 },
    },
  ],
  focusMarkers: [
    {
      markerId: "lamp-frame",
      kind: "selectable",
      label: "Lamp frame",
      tile: { x: 8, y: 4 },
      entityId: "entity-a",
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

  it("keeps camera panning bounded by the read-model map", () => {
    const viewport = createFittedViewport(READ_MODEL, 320, 240);
    const farLeft = panViewport(viewport, READ_MODEL, -100000, 0);
    const farRight = panViewport(viewport, READ_MODEL, 100000, 0);

    expect(farLeft.centerWorldX).toBeGreaterThanOrEqual(0);
    expect(farLeft.centerWorldX).toBeLessThan(viewport.centerWorldX);
    expect(farRight.centerWorldX).toBeGreaterThan(viewport.centerWorldX);
    expect(farLeft.centerWorldY).toBe(viewport.centerWorldY);
  });

  it("returns to fitted camera geometry when refit with the same canvas", () => {
    const viewport = createFittedViewport(READ_MODEL, 320, 240);
    const panned = panViewport(viewport, READ_MODEL, 100000, 100000);
    const reset = createFittedViewport(READ_MODEL, panned.canvasWidth, panned.canvasHeight);

    expect(reset).toStrictEqual(viewport);
  });

  it("projects semantic areas, focus markers, and tile bounds into screen space", () => {
    const viewport = createFittedViewport(READ_MODEL, 960, 640);
    const area = READ_MODEL.semanticAreas?.at(0);
    const marker = READ_MODEL.focusMarkers?.at(0);
    if (area === undefined || marker === undefined) {
      throw new Error("Expected semantic area and focus marker fixture data.");
    }

    const areaRect = readSemanticAreaScreenRect(viewport, READ_MODEL, area);
    const markerPoint = readFocusMarkerScreenPoint(viewport, READ_MODEL, marker);
    const tileBounds = tileToScreenBounds(viewport, READ_MODEL, marker.tile);

    expect(areaRect.width).toBeGreaterThan(0);
    expect(areaRect.height).toBeGreaterThan(0);
    expect(markerPoint.x).toBeGreaterThan(areaRect.x);
    expect(markerPoint.y).toBeGreaterThan(areaRect.y);
    expect(markerPoint.x).toBeCloseTo(tileBounds.x + tileBounds.width / 2, 4);
    expect(markerPoint.y).toBeCloseTo(tileBounds.y + tileBounds.height / 2, 4);
  });

  it("projects pawn intent paths and target markers from read-model activity", () => {
    const viewport = createFittedViewport(READ_MODEL, 960, 640);
    const entity = READ_MODEL.entities.at(0);
    if (entity === undefined) {
      throw new Error("Expected an entity fixture.");
    }

    const activityProjection = readEntityActivityScreenProjection(viewport, READ_MODEL, entity);
    if (activityProjection === undefined) {
      throw new Error("Expected moving activity projection.");
    }

    const pathPoints = readPathScreenPoints(viewport, READ_MODEL, entity.activity?.pathTiles ?? []);

    expect(activityProjection.path).toHaveLength(3);
    expect(pathPoints.at(0)?.x).toBeCloseTo(activityProjection.center.x, 4);
    expect(activityProjection.target?.x).toBeGreaterThan(activityProjection.center.x);
    expect(activityProjection.badgeAnchor.y).toBeLessThan(activityProjection.center.y);
  });
});
