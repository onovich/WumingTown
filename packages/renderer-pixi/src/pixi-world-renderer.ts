/// <reference lib="dom" />

import "pixi.js/unsafe-eval";
import { Application, Container, Graphics } from "pixi.js";

import type {
  TileCoordinate,
  TerrainKind,
  WorldEntityReadModel,
  WorldJobMarkerReadModel,
  WorldReadModel,
} from "@wuming-town/sim-protocol";

import {
  createFittedViewport,
  findEntityAtScreenPoint,
  panViewport,
  readEntityScreenPositions,
  resizeViewport,
  screenToTile,
  type RendererViewportState,
  type ScreenEntityPosition,
  type ScreenPoint,
  zoomViewportAtPoint,
} from "./render-geometry";

export interface RendererStateSnapshot {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly zoom: number;
  readonly lastInputLabel: string;
  readonly selectedEntityId: string | undefined;
  readonly inspectedTile: TileCoordinate | undefined;
  readonly hoverTile: TileCoordinate | undefined;
}

export interface PixiWorldRendererDebugState {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly centerWorldX: number;
  readonly centerWorldY: number;
  readonly zoom: number;
  readonly selectedEntityId: string | undefined;
  readonly entityScreenPositions: readonly ScreenEntityPosition[];
}

export interface CreatePixiWorldRendererOptions {
  readonly container: HTMLElement;
  readonly inputTarget?: HTMLElement;
  readonly readModel: WorldReadModel;
  readonly selectedEntityId?: string;
  readonly onSelectionChange?: (
    entityId: string | undefined,
    inputLabel: string,
    inspectedTile: TileCoordinate | undefined,
  ) => void;
  readonly onStateChange?: (state: RendererStateSnapshot) => void;
  readonly shouldIgnoreInputTarget?: (target: EventTarget | null) => boolean;
}

export interface PixiWorldRenderer {
  readonly canvas: HTMLCanvasElement;
  resize(width: number, height: number, devicePixelRatio: number): void;
  setReadModel(readModel: WorldReadModel): void;
  setSelectedEntityId(entityId: string | undefined): void;
  readDebugState(): PixiWorldRendererDebugState;
  destroy(): Promise<void>;
}

const TERRAIN_COLORS: Record<TerrainKind, number> = {
  path: 0x8d7352,
  earth: 0x5a4634,
  brush: 0x3f5b3a,
  water: 0x254a63,
  "lantern-glow": 0x8f6b1a,
};
const TERRAIN_EMBELLISH_COLORS: Record<TerrainKind, number> = {
  path: 0xcfb481,
  earth: 0x715843,
  brush: 0x7b9c64,
  water: 0x7db7d6,
  "lantern-glow": 0xffdf87,
};

const ENTITY_RADIUS_PX = 9;
const PAN_STEP_TILES = 2;
const DRAG_START_THRESHOLD_PX = 6;
const TARGET_MARKER_RADIUS_PX = 10;

interface CameraDragState {
  readonly pointerId: number;
  readonly startPoint: ScreenPoint;
  readonly previousPoint: ScreenPoint;
  readonly moved: boolean;
}

interface StaticLayerSignature {
  readonly chunkSize: number;
  readonly chunks: WorldReadModel["chunks"];
  readonly focusMarkers: WorldReadModel["focusMarkers"];
  readonly mapHeight: number;
  readonly mapWidth: number;
  readonly semanticAreas: WorldReadModel["semanticAreas"];
  readonly tileSize: number;
}

export async function createPixiWorldRenderer(
  options: CreatePixiWorldRendererOptions,
): Promise<PixiWorldRenderer> {
  const app = new Application();
  const devicePixelRatio = 1;
  await app.init({
    antialias: false,
    autoDensity: true,
    background: 0x120f0b,
    height: Math.max(options.container.clientHeight, 1),
    resolution: devicePixelRatio,
    width: Math.max(options.container.clientWidth, 1),
  });

  const canvas = app.canvas;
  const inputTarget = options.inputTarget ?? options.container;
  inputTarget.style.touchAction = "none";
  options.container.style.touchAction = "none";
  canvas.setAttribute("data-testid", "world-canvas");
  canvas.style.display = "block";
  canvas.style.height = "100%";
  canvas.style.outline = "none";
  canvas.style.touchAction = "none";
  canvas.style.width = "100%";
  canvas.tabIndex = 0;

  options.container.replaceChildren(canvas);

  const worldRoot = new Container();
  const terrainLayer = new Container();
  const semanticLayer = new Container();
  const intentLayer = new Container();
  const entityLayer = new Container();
  const focusMarkerLayer = new Container();
  const jobMarkerLayer = new Container();
  const overlayLayer = new Container();
  worldRoot.addChild(terrainLayer);
  worldRoot.addChild(semanticLayer);
  worldRoot.addChild(intentLayer);
  worldRoot.addChild(entityLayer);
  worldRoot.addChild(focusMarkerLayer);
  worldRoot.addChild(jobMarkerLayer);
  worldRoot.addChild(overlayLayer);
  app.stage.addChild(worldRoot);

  let currentReadModel = options.readModel;
  let viewport = createFittedViewport(
    currentReadModel,
    Math.max(options.container.clientWidth, 1),
    Math.max(options.container.clientHeight, 1),
  );
  let hoverTile: TileCoordinate | undefined;
  let selectedEntityId: string | undefined =
    options.selectedEntityId ?? currentReadModel.selectedEntityId;
  let inspectedTile: TileCoordinate | undefined = readEntityTile(
    currentReadModel,
    selectedEntityId,
  );
  let lastInputLabel = "Ready";
  let userAdjustedViewport = false;
  let dragState: CameraDragState | undefined;
  let currentStaticLayerSignature = readStaticLayerSignature(currentReadModel);

  rebuildStaticReadModelGraphics();
  rebuildDynamicReadModelGraphics();

  const selectionGraphic = new Graphics();
  const hoverGraphic = new Graphics();
  overlayLayer.addChild(selectionGraphic);
  overlayLayer.addChild(hoverGraphic);

  const onPointerMove = (event: PointerEvent): void => {
    if (dragState === undefined && shouldIgnoreInputEvent(event)) {
      return;
    }

    const point = readRelativePoint(event, canvas);
    if (dragState?.pointerId === event.pointerId) {
      const deltaX = point.x - dragState.previousPoint.x;
      const deltaY = point.y - dragState.previousPoint.y;
      const totalDeltaX = point.x - dragState.startPoint.x;
      const totalDeltaY = point.y - dragState.startPoint.y;
      const shouldDrag =
        dragState.moved ||
        totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY >=
          DRAG_START_THRESHOLD_PX * DRAG_START_THRESHOLD_PX;

      if (shouldDrag) {
        event.preventDefault();
        dragState = {
          pointerId: dragState.pointerId,
          previousPoint: point,
          startPoint: dragState.startPoint,
          moved: true,
        };
        if (deltaX !== 0 || deltaY !== 0) {
          userAdjustedViewport = true;
          viewport = panViewport(
            viewport,
            currentReadModel,
            -deltaX / viewport.zoom,
            -deltaY / viewport.zoom,
          );
          lastInputLabel = "Camera drag";
          applyViewport(app, worldRoot, viewport, devicePixelRatio);
          drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
        }

        hoverTile = screenToTile(viewport, currentReadModel, point);
        drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
        emitStateChange();
        return;
      }
    }

    const tile = screenToTile(viewport, currentReadModel, point);
    if (
      tile?.x === hoverTile?.x &&
      tile?.y === hoverTile?.y &&
      tile !== undefined &&
      hoverTile !== undefined
    ) {
      return;
    }

    hoverTile = tile;
    drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
    emitStateChange();
  };

  const onPointerLeave = (): void => {
    if (dragState !== undefined) {
      return;
    }

    hoverTile = undefined;
    drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
    emitStateChange();
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    const wasDrag = dragState.moved;
    dragState = undefined;
    releaseCanvasPointerCapture(options.container, event.pointerId);
    if (wasDrag) {
      event.preventDefault();
      emitStateChange();
      return;
    }

    selectCanvasPoint(readRelativePoint(event, canvas));
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    dragState = undefined;
    releaseCanvasPointerCapture(options.container, event.pointerId);
    emitStateChange();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (shouldIgnoreInputEvent(event)) {
      return;
    }

    canvas.focus();
    const point = readRelativePoint(event, canvas);
    dragState = {
      moved: false,
      pointerId: event.pointerId,
      previousPoint: point,
      startPoint: point,
    };
    captureCanvasPointer(options.container, event.pointerId);
  };

  const onWheel = (event: WheelEvent): void => {
    if (shouldIgnoreInputEvent(event)) {
      return;
    }

    event.preventDefault();
    userAdjustedViewport = true;
    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
    viewport = zoomViewportAtPoint(
      viewport,
      currentReadModel,
      readRelativePoint(event, canvas),
      viewport.zoom * zoomFactor,
    );
    lastInputLabel = `Wheel zoom ${String(Math.round(viewport.zoom * 100))}%`;
    applyViewport(app, worldRoot, viewport, devicePixelRatio);
    drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
    drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
    emitStateChange();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    let nextViewport: RendererViewportState;
    const panStep = currentReadModel.tileSize * PAN_STEP_TILES;

    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        nextViewport = panViewport(viewport, currentReadModel, 0, -panStep);
        break;
      case "ArrowDown":
      case "KeyS":
        nextViewport = panViewport(viewport, currentReadModel, 0, panStep);
        break;
      case "ArrowLeft":
      case "KeyA":
        nextViewport = panViewport(viewport, currentReadModel, -panStep, 0);
        break;
      case "ArrowRight":
      case "KeyD":
        nextViewport = panViewport(viewport, currentReadModel, panStep, 0);
        break;
      case "Equal":
      case "NumpadAdd":
        nextViewport = zoomViewportAtPoint(
          viewport,
          currentReadModel,
          {
            x: viewport.canvasWidth / 2,
            y: viewport.canvasHeight / 2,
          },
          viewport.zoom * 1.12,
        );
        break;
      case "Minus":
      case "NumpadSubtract":
        nextViewport = zoomViewportAtPoint(
          viewport,
          currentReadModel,
          {
            x: viewport.canvasWidth / 2,
            y: viewport.canvasHeight / 2,
          },
          viewport.zoom * 0.9,
        );
        break;
      case "Digit0":
      case "Home":
      case "Numpad0":
        event.preventDefault();
        resetCamera();
        return;
      default:
        return;
    }

    event.preventDefault();
    userAdjustedViewport = true;
    viewport = nextViewport;
    lastInputLabel = `Keyboard ${event.code}`;
    applyViewport(app, worldRoot, viewport, devicePixelRatio);
    drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
    drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
    emitStateChange();
  };

  inputTarget.addEventListener("pointermove", onPointerMove);
  inputTarget.addEventListener("pointerleave", onPointerLeave);
  inputTarget.addEventListener("pointerdown", onPointerDown);
  inputTarget.addEventListener("pointerup", onPointerUp);
  inputTarget.addEventListener("pointercancel", onPointerCancel);
  inputTarget.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);

  applyViewport(app, worldRoot, viewport, devicePixelRatio);
  drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
  drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
  emitStateChange();

  return {
    canvas,
    resize(width: number, height: number, nextDevicePixelRatio: number): void {
      viewport = userAdjustedViewport
        ? resizeViewport(viewport, currentReadModel, width, height)
        : createFittedViewport(currentReadModel, width, height);
      applyViewport(app, worldRoot, viewport, nextDevicePixelRatio);
      drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
      drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
      emitStateChange();
    },
    setReadModel(readModel: WorldReadModel): void {
      const nextStaticLayerSignature = readStaticLayerSignature(readModel);
      const shouldRebuildStaticLayers = !matchesStaticLayerSignature(
        currentStaticLayerSignature,
        nextStaticLayerSignature,
      );
      currentReadModel = readModel;
      currentStaticLayerSignature = nextStaticLayerSignature;
      if (!userAdjustedViewport) {
        viewport = createFittedViewport(readModel, viewport.canvasWidth, viewport.canvasHeight);
        applyViewport(app, worldRoot, viewport, devicePixelRatio);
      } else {
        viewport = resizeViewport(viewport, readModel, viewport.canvasWidth, viewport.canvasHeight);
        applyViewport(app, worldRoot, viewport, devicePixelRatio);
      }
      if (selectedEntityId !== undefined) {
        inspectedTile = readEntityTile(readModel, selectedEntityId);
      }
      if (shouldRebuildStaticLayers) {
        rebuildStaticReadModelGraphics();
      }
      rebuildDynamicReadModelGraphics();
      drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
      drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
      emitStateChange();
    },
    setSelectedEntityId(entityId: string | undefined): void {
      if (entityId === selectedEntityId) {
        return;
      }

      selectedEntityId = entityId;
      inspectedTile = readEntityTile(currentReadModel, selectedEntityId);
      drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
      emitStateChange();
    },
    readDebugState(): PixiWorldRendererDebugState {
      return {
        canvasWidth: viewport.canvasWidth,
        canvasHeight: viewport.canvasHeight,
        centerWorldX: viewport.centerWorldX,
        centerWorldY: viewport.centerWorldY,
        zoom: viewport.zoom,
        selectedEntityId,
        entityScreenPositions: readEntityScreenPositions(viewport, currentReadModel),
      };
    },
    destroy(): Promise<void> {
      inputTarget.removeEventListener("pointermove", onPointerMove);
      inputTarget.removeEventListener("pointerleave", onPointerLeave);
      inputTarget.removeEventListener("pointerdown", onPointerDown);
      inputTarget.removeEventListener("pointerup", onPointerUp);
      inputTarget.removeEventListener("pointercancel", onPointerCancel);
      inputTarget.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      app.destroy(true);
      return Promise.resolve();
    },
  };

  function emitStateChange(): void {
    const nextState: RendererStateSnapshot = {
      canvasWidth: viewport.canvasWidth,
      canvasHeight: viewport.canvasHeight,
      zoom: viewport.zoom,
      lastInputLabel,
      selectedEntityId,
      inspectedTile,
      hoverTile,
    };
    options.onStateChange?.(nextState);
  }

  function selectCanvasPoint(point: ScreenPoint): void {
    const entityId = findEntityAtScreenPoint(viewport, currentReadModel, point);
    if (entityId !== selectedEntityId) {
      selectedEntityId = entityId;
    }

    const tile = screenToTile(viewport, currentReadModel, point);
    inspectedTile = tile;
    lastInputLabel =
      entityId !== undefined
        ? `Canvas select ${entityId}`
        : tile !== undefined
          ? `Canvas inspect ${String(tile.x)},${String(tile.y)}`
          : "Canvas pointer";
    drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
    options.onSelectionChange?.(entityId, lastInputLabel, inspectedTile);
    emitStateChange();
  }

  function resetCamera(): void {
    userAdjustedViewport = false;
    viewport = createFittedViewport(currentReadModel, viewport.canvasWidth, viewport.canvasHeight);
    lastInputLabel = "Camera reset";
    applyViewport(app, worldRoot, viewport, devicePixelRatio);
    drawSelectionGraphic(selectionGraphic, selectedEntityId, inspectedTile, currentReadModel);
    drawHoverGraphic(hoverGraphic, hoverTile, currentReadModel);
    emitStateChange();
  }

  function shouldIgnoreInputEvent(event: Event): boolean {
    return options.shouldIgnoreInputTarget?.(event.target) === true;
  }

  function rebuildStaticReadModelGraphics(): void {
    replaceLayerGraphics(terrainLayer, () => buildTerrainGraphics(terrainLayer, currentReadModel));
    replaceLayerGraphics(semanticLayer, () =>
      buildSemanticAreaGraphics(semanticLayer, currentReadModel),
    );
    replaceLayerGraphics(focusMarkerLayer, () =>
      buildFocusMarkerGraphics(focusMarkerLayer, currentReadModel),
    );
  }

  function rebuildDynamicReadModelGraphics(): void {
    replaceLayerGraphics(intentLayer, () => buildIntentGraphics(intentLayer, currentReadModel));
    replaceLayerGraphics(entityLayer, () => buildEntityGraphics(entityLayer, currentReadModel));
    replaceLayerGraphics(jobMarkerLayer, () =>
      buildJobMarkerGraphics(jobMarkerLayer, currentReadModel),
    );
  }
}

function applyViewport(
  app: Application,
  worldRoot: Container,
  viewport: RendererViewportState,
  devicePixelRatio: number,
): void {
  app.renderer.resolution = devicePixelRatio;
  app.renderer.resize(viewport.canvasWidth, viewport.canvasHeight);
  worldRoot.scale.set(viewport.zoom);
  worldRoot.position.set(
    viewport.canvasWidth / 2 - viewport.centerWorldX * viewport.zoom,
    viewport.canvasHeight / 2 - viewport.centerWorldY * viewport.zoom,
  );
}

function buildTerrainGraphics(layer: Container, readModel: WorldReadModel): void {
  for (const chunk of readModel.chunks) {
    const chunkGraphic = new Graphics();
    const chunkOriginX = chunk.originTile.x * readModel.tileSize;
    const chunkOriginY = chunk.originTile.y * readModel.tileSize;

    for (let tileY = 0; tileY < chunk.height; tileY += 1) {
      for (let tileX = 0; tileX < chunk.width; tileX += 1) {
        const terrain = chunk.terrain[tileY * chunk.width + tileX] ?? "earth";
        const worldTileX = chunk.originTile.x + tileX;
        const worldTileY = chunk.originTile.y + tileY;
        drawTerrainTile(
          chunkGraphic,
          readModel,
          terrain,
          chunkOriginX + tileX * readModel.tileSize,
          chunkOriginY + tileY * readModel.tileSize,
          worldTileX,
          worldTileY,
        );
      }
    }

    chunkGraphic.rect(
      chunkOriginX,
      chunkOriginY,
      chunk.width * readModel.tileSize,
      chunk.height * readModel.tileSize,
    );
    chunkGraphic.stroke({
      color: 0x2b2117,
      pixelLine: true,
      width: 2,
    });
    layer.addChild(chunkGraphic);
  }
}

function buildSemanticAreaGraphics(layer: Container, readModel: WorldReadModel): void {
  for (const area of readModel.semanticAreas ?? []) {
    const graphic = new Graphics();
    const originX = area.originTile.x * readModel.tileSize;
    const originY = area.originTile.y * readModel.tileSize;
    const width = area.width * readModel.tileSize;
    const height = area.height * readModel.tileSize;

    graphic.rect(originX, originY, width, height);
    switch (area.kind) {
      case "structure":
        graphic.fill({
          alpha: 0.28,
          color: 0xa58b68,
        });
        graphic.stroke({
          color: 0x423224,
          pixelLine: true,
          width: 2,
        });
        drawDoorEmphasis(graphic, readModel, area.emphasisTile);
        break;
      case "lamp-coverage":
        graphic.fill({
          alpha: 0.14,
          color: 0xf5d06a,
        });
        graphic.stroke({
          color: 0xf5d06a,
          pixelLine: true,
          width: 2,
        });
        drawCoverageGrid(graphic, originX, originY, width, height, readModel.tileSize);
        break;
      case "dark-gap":
        graphic.fill({
          alpha: 0.3,
          color: 0x0b0c10,
        });
        graphic.stroke({
          color: 0x7c8aa5,
          pixelLine: true,
          width: 2,
        });
        drawDiagonalHatch(graphic, originX, originY, width, height, readModel.tileSize, 0x7c8aa5);
        break;
      case "blocked-area":
        graphic.fill({
          alpha: 0.22,
          color: 0x7e1f18,
        });
        graphic.stroke({
          color: 0xf2d0b0,
          pixelLine: true,
          width: 2,
        });
        drawBlockCrosses(graphic, originX, originY, width, height, readModel.tileSize);
        break;
    }

    layer.addChild(graphic);
  }
}

function buildIntentGraphics(layer: Container, readModel: WorldReadModel): void {
  for (const entity of readModel.entities) {
    const activity = entity.activity;
    if (activity === undefined) {
      continue;
    }

    const graphic = new Graphics();
    const pathTiles = activity.pathTiles ?? [];
    if (pathTiles.length > 1) {
      drawIntentPath(graphic, readModel, pathTiles);
    }

    if (activity.targetTile !== undefined) {
      drawActivityTargetMarker(graphic, readModel, activity);
    }

    if (activity.progressPercent !== undefined) {
      drawActivityProgress(graphic, readModel, activity);
    }

    layer.addChild(graphic);
  }
}

function buildEntityGraphics(layer: Container, readModel: WorldReadModel): void {
  for (const entity of readModel.entities) {
    const marker = new Container();
    const bodyGraphic = new Graphics();
    drawEntityMarker(bodyGraphic, entity);
    marker.addChild(bodyGraphic);

    if (entity.activity !== undefined) {
      const badgeGraphic = new Graphics();
      drawEntityStateBadge(badgeGraphic, entity.activity.state);
      marker.addChild(badgeGraphic);
    }

    marker.position.set(
      entity.tile.x * readModel.tileSize + readModel.tileSize / 2,
      entity.tile.y * readModel.tileSize + readModel.tileSize / 2,
    );
    layer.addChild(marker);
  }
}

function buildFocusMarkerGraphics(layer: Container, readModel: WorldReadModel): void {
  for (const marker of readModel.focusMarkers ?? []) {
    const graphic = new Graphics();
    drawFocusMarker(graphic, readModel, marker);
    layer.addChild(graphic);
  }
}

function buildJobMarkerGraphics(layer: Container, readModel: WorldReadModel): void {
  for (const marker of readModel.jobMarkers ?? []) {
    const graphic = new Graphics();
    drawJobMarker(graphic, readModel, marker);
    layer.addChild(graphic);
  }
}

function drawSelectionGraphic(
  graphic: Graphics,
  selectedEntityId: string | undefined,
  inspectedTile: TileCoordinate | undefined,
  readModel: WorldReadModel,
): void {
  graphic.clear();
  if (inspectedTile !== undefined) {
    const bounds = tileWorldBounds(readModel, inspectedTile);
    graphic.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    graphic.fill({
      alpha: 0.16,
      color: 0xf7b538,
    });
    drawTileCorners(graphic, bounds.x, bounds.y, bounds.width, bounds.height, 0xf7b538, 5, 3);
  }

  if (selectedEntityId === undefined) {
    return;
  }

  const entity = readEntity(readModel, selectedEntityId);
  if (entity === undefined) {
    return;
  }

  const worldX = entity.tile.x * readModel.tileSize + readModel.tileSize / 2;
  const worldY = entity.tile.y * readModel.tileSize + readModel.tileSize / 2;
  drawEntitySelectionOutline(graphic, entity, worldX, worldY);
}

function drawHoverGraphic(
  graphic: Graphics,
  hoverTile: TileCoordinate | undefined,
  readModel: WorldReadModel,
): void {
  graphic.clear();
  if (hoverTile === undefined) {
    return;
  }

  const bounds = tileWorldBounds(readModel, hoverTile);
  drawTileCorners(graphic, bounds.x, bounds.y, bounds.width, bounds.height, 0xf5e6bf, 4, 2);
  graphic.circle(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 2);
  graphic.fill(0xf5e6bf);
}

function readRelativePoint(event: MouseEvent, canvas: HTMLCanvasElement): ScreenPoint {
  const canvasRect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top,
  };
}

function releaseCanvasPointerCapture(element: HTMLElement, pointerId: number): void {
  if (!element.hasPointerCapture(pointerId)) {
    return;
  }

  element.releasePointerCapture(pointerId);
}

function captureCanvasPointer(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic PointerEvents in tests do not always create an active browser pointer.
  }
}

function drawEntityMarker(graphic: Graphics, entity: WorldEntityReadModel): void {
  switch (entity.kind) {
    case "structure":
      graphic.rect(-11, -11, 22, 22);
      break;
    case "visitor":
      graphic.poly([0, -12, 10, 0, 0, 12, -10, 0]);
      break;
    case "lantern-keeper":
      graphic.circle(0, 0, ENTITY_RADIUS_PX + 1);
      graphic.circle(0, 0, ENTITY_RADIUS_PX - 4);
      break;
    case "resident":
      graphic.circle(0, 0, ENTITY_RADIUS_PX);
      break;
  }

  graphic.fill(entity.colorHex);
  graphic.stroke({
    color: 0x20160f,
    pixelLine: true,
    width: 3,
  });
}

function drawEntityStateBadge(
  graphic: Graphics,
  state: NonNullable<WorldEntityReadModel["activity"]>["state"],
): void {
  graphic.rect(-9, -24, 18, 14);
  graphic.fill({
    alpha: 0.92,
    color: readActivityAccent(state),
  });
  graphic.stroke({
    color: 0x1b140e,
    pixelLine: true,
    width: 2,
  });

  switch (state) {
    case "idle":
      graphic.rect(-4, -20, 3, 6);
      graphic.rect(1, -20, 3, 6);
      break;
    case "moving":
      graphic.poly([-5, -21, 3, -17, -5, -13, -2, -17]);
      break;
    case "working":
      graphic.rect(-4, -20, 4, 7);
      graphic.rect(-1, -19, 6, 2);
      graphic.rect(2, -22, 2, 10);
      break;
    case "blocked":
      graphic.moveTo(-4, -20);
      graphic.lineTo(4, -14);
      graphic.moveTo(4, -20);
      graphic.lineTo(-4, -14);
      graphic.stroke({
        color: 0xf9f2df,
        pixelLine: true,
        width: 2,
      });
      return;
    case "completed":
      graphic.moveTo(-4, -17);
      graphic.lineTo(-1, -14);
      graphic.lineTo(5, -20);
      graphic.stroke({
        color: 0xf9f2df,
        pixelLine: true,
        width: 2,
      });
      return;
  }

  graphic.fill(0xf9f2df);
}

function drawEntitySelectionOutline(
  graphic: Graphics,
  entity: WorldEntityReadModel,
  worldX: number,
  worldY: number,
): void {
  switch (entity.kind) {
    case "structure":
      graphic.rect(worldX - 15, worldY - 15, 30, 30);
      break;
    case "visitor":
      graphic.poly([
        worldX,
        worldY - 16,
        worldX + 14,
        worldY,
        worldX,
        worldY + 16,
        worldX - 14,
        worldY,
      ]);
      break;
    case "lantern-keeper":
      graphic.circle(worldX, worldY, ENTITY_RADIUS_PX + 8);
      break;
    case "resident":
      graphic.circle(worldX, worldY, ENTITY_RADIUS_PX + 6);
      break;
  }

  graphic.stroke({
    color: 0xf7b538,
    pixelLine: true,
    width: 3,
  });
}

function drawTerrainTile(
  graphic: Graphics,
  readModel: WorldReadModel,
  terrain: TerrainKind,
  x: number,
  y: number,
  worldTileX: number,
  worldTileY: number,
): void {
  const variation = ((worldTileX * 13 + worldTileY * 7) % 5) - 2;
  const baseColor = adjustColor(TERRAIN_COLORS[terrain], variation * 0.04);
  const accentColor = TERRAIN_EMBELLISH_COLORS[terrain];
  const tileSize = readModel.tileSize;

  graphic.rect(x, y, tileSize, tileSize);
  graphic.fill(baseColor);

  switch (terrain) {
    case "path":
      graphic.rect(x + tileSize * 0.18, y + tileSize * 0.38, tileSize * 0.64, tileSize * 0.22);
      graphic.fill(accentColor);
      if ((worldTileX + worldTileY) % 3 === 0) {
        graphic.rect(x + tileSize * 0.45, y + tileSize * 0.2, tileSize * 0.1, tileSize * 0.6);
        graphic.fill(adjustColor(accentColor, 0.08));
      }
      break;
    case "brush":
      graphic.circle(x + tileSize * 0.34, y + tileSize * 0.34, tileSize * 0.12);
      graphic.circle(x + tileSize * 0.66, y + tileSize * 0.62, tileSize * 0.1);
      graphic.fill(accentColor);
      break;
    case "water":
      graphic.rect(x + tileSize * 0.15, y + tileSize * 0.32, tileSize * 0.7, tileSize * 0.1);
      graphic.rect(x + tileSize * 0.24, y + tileSize * 0.58, tileSize * 0.52, tileSize * 0.1);
      graphic.fill(accentColor);
      break;
    case "lantern-glow":
      graphic.rect(x + tileSize * 0.18, y + tileSize * 0.18, tileSize * 0.64, tileSize * 0.64);
      graphic.fill({
        alpha: 0.28,
        color: accentColor,
      });
      graphic.circle(x + tileSize / 2, y + tileSize / 2, tileSize * 0.12);
      graphic.fill(accentColor);
      break;
    case "earth":
      if ((worldTileX + worldTileY) % 4 === 0) {
        graphic.rect(x + tileSize * 0.22, y + tileSize * 0.22, tileSize * 0.14, tileSize * 0.14);
        graphic.rect(x + tileSize * 0.62, y + tileSize * 0.58, tileSize * 0.12, tileSize * 0.12);
        graphic.fill(accentColor);
      }
      break;
  }
}

function drawDoorEmphasis(
  graphic: Graphics,
  readModel: WorldReadModel,
  emphasisTile: TileCoordinate | undefined,
): void {
  if (emphasisTile === undefined) {
    return;
  }

  const bounds = tileWorldBounds(readModel, emphasisTile);
  graphic.rect(bounds.x + bounds.width * 0.2, bounds.y, bounds.width * 0.6, bounds.height * 0.16);
  graphic.fill(0xead7b0);
}

function drawCoverageGrid(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  tileSize: number,
): void {
  for (let offsetX = x + tileSize; offsetX < x + width; offsetX += tileSize * 2) {
    graphic.moveTo(offsetX, y);
    graphic.lineTo(offsetX, y + height);
  }
  for (let offsetY = y + tileSize; offsetY < y + height; offsetY += tileSize * 2) {
    graphic.moveTo(x, offsetY);
    graphic.lineTo(x + width, offsetY);
  }
  graphic.stroke({
    alpha: 0.35,
    color: 0xffefaa,
    pixelLine: true,
    width: 1,
  });
}

function drawDiagonalHatch(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  tileSize: number,
  color: number,
): void {
  const diagonalSpan = width + height;
  for (let offset = -height; offset < diagonalSpan; offset += tileSize * 1.5) {
    graphic.moveTo(x + offset, y + height);
    graphic.lineTo(x + offset + height, y);
  }
  graphic.stroke({
    alpha: 0.45,
    color,
    pixelLine: true,
    width: 1,
  });
}

function drawBlockCrosses(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  tileSize: number,
): void {
  for (let offsetX = x + tileSize * 0.5; offsetX < x + width; offsetX += tileSize * 1.5) {
    for (let offsetY = y + tileSize * 0.5; offsetY < y + height; offsetY += tileSize * 1.5) {
      graphic.moveTo(offsetX - 4, offsetY - 4);
      graphic.lineTo(offsetX + 4, offsetY + 4);
      graphic.moveTo(offsetX + 4, offsetY - 4);
      graphic.lineTo(offsetX - 4, offsetY + 4);
    }
  }
  graphic.stroke({
    alpha: 0.6,
    color: 0xf2d0b0,
    pixelLine: true,
    width: 1,
  });
}

function drawIntentPath(
  graphic: Graphics,
  readModel: WorldReadModel,
  pathTiles: readonly TileCoordinate[],
): void {
  const firstStep = pathTiles.at(0);
  if (firstStep === undefined) {
    return;
  }

  const firstWorld = tileWorldCenter(readModel, firstStep);
  graphic.moveTo(firstWorld.x, firstWorld.y);
  for (let index = 1; index < pathTiles.length; index += 1) {
    const step = pathTiles[index];
    if (step === undefined) {
      continue;
    }

    const world = tileWorldCenter(readModel, step);
    graphic.lineTo(world.x, world.y);
  }
  graphic.stroke({
    color: 0xf9f2df,
    pixelLine: true,
    width: 3,
  });

  for (const step of pathTiles.slice(1)) {
    const world = tileWorldCenter(readModel, step);
    graphic.circle(world.x, world.y, 2.5);
    graphic.fill(0x2f9f68);
  }
}

function drawActivityTargetMarker(
  graphic: Graphics,
  readModel: WorldReadModel,
  activity: NonNullable<WorldEntityReadModel["activity"]>,
): void {
  const targetTile = activity.targetTile;
  if (targetTile === undefined) {
    return;
  }

  const center = tileWorldCenter(readModel, targetTile);
  const accent = readActivityAccent(activity.state);
  switch (activity.state) {
    case "idle":
      graphic.rect(center.x - TARGET_MARKER_RADIUS_PX, center.y - TARGET_MARKER_RADIUS_PX, 20, 20);
      break;
    case "moving":
      graphic.poly([
        center.x,
        center.y - TARGET_MARKER_RADIUS_PX - 2,
        center.x + TARGET_MARKER_RADIUS_PX + 2,
        center.y,
        center.x,
        center.y + TARGET_MARKER_RADIUS_PX + 2,
        center.x - TARGET_MARKER_RADIUS_PX - 2,
        center.y,
      ]);
      break;
    case "working":
      graphic.rect(center.x - 12, center.y - 12, 24, 24);
      graphic.circle(center.x, center.y, 4);
      break;
    case "blocked":
      graphic.moveTo(center.x - 10, center.y - 10);
      graphic.lineTo(center.x + 10, center.y + 10);
      graphic.moveTo(center.x + 10, center.y - 10);
      graphic.lineTo(center.x - 10, center.y + 10);
      graphic.stroke({
        color: 0xf7e7d0,
        pixelLine: true,
        width: 3,
      });
      return;
    case "completed":
      graphic.circle(center.x, center.y, 12);
      graphic.moveTo(center.x - 5, center.y);
      graphic.lineTo(center.x - 1, center.y + 4);
      graphic.lineTo(center.x + 6, center.y - 5);
      graphic.stroke({
        color: 0xf7e7d0,
        pixelLine: true,
        width: 3,
      });
      break;
  }

  graphic.stroke({
    color: accent,
    pixelLine: true,
    width: 3,
  });
}

function drawActivityProgress(
  graphic: Graphics,
  readModel: WorldReadModel,
  activity: NonNullable<WorldEntityReadModel["activity"]>,
): void {
  const targetTile = activity.targetTile;
  if (targetTile === undefined) {
    return;
  }

  const bounds = tileWorldBounds(readModel, targetTile);
  const progressWidth = bounds.width * 1.2;
  const progressX = bounds.x - (progressWidth - bounds.width) / 2;
  const progressY = bounds.y - 8;
  graphic.rect(progressX, progressY, progressWidth, 6);
  graphic.fill(0x1b140e);
  graphic.stroke({
    color: 0xf5e6bf,
    pixelLine: true,
    width: 1,
  });
  graphic.rect(
    progressX + 1,
    progressY + 1,
    ((progressWidth - 2) * Math.max(0, Math.min(activity.progressPercent ?? 0, 100))) / 100,
    4,
  );
  graphic.fill(readActivityAccent(activity.state));
}

function drawFocusMarker(
  graphic: Graphics,
  readModel: WorldReadModel,
  marker: NonNullable<WorldReadModel["focusMarkers"]>[number],
): void {
  const bounds = tileWorldBounds(readModel, marker.tile);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  switch (marker.kind) {
    case "selectable":
      drawTileCorners(graphic, bounds.x, bounds.y, bounds.width, bounds.height, 0xf5e6bf, 5, 2);
      graphic.circle(centerX, centerY, 2.5);
      graphic.fill(0xf5e6bf);
      return;
    case "blocked":
      graphic.poly([
        centerX,
        centerY - 9,
        centerX + 9,
        centerY,
        centerX,
        centerY + 9,
        centerX - 9,
        centerY,
      ]);
      graphic.stroke({
        color: 0xf2d0b0,
        pixelLine: true,
        width: 2,
      });
      graphic.moveTo(centerX - 4, centerY - 4);
      graphic.lineTo(centerX + 4, centerY + 4);
      graphic.moveTo(centerX + 4, centerY - 4);
      graphic.lineTo(centerX - 4, centerY + 4);
      graphic.stroke({
        color: 0xf2d0b0,
        pixelLine: true,
        width: 2,
      });
      return;
    case "completed":
      graphic.circle(centerX, centerY, 9);
      graphic.stroke({
        color: 0x7dd3a6,
        pixelLine: true,
        width: 2,
      });
      graphic.moveTo(centerX - 4, centerY);
      graphic.lineTo(centerX - 1, centerY + 3);
      graphic.lineTo(centerX + 4, centerY - 4);
      graphic.stroke({
        color: 0x7dd3a6,
        pixelLine: true,
        width: 2,
      });
      return;
  }
}

function drawJobMarker(
  graphic: Graphics,
  readModel: WorldReadModel,
  marker: WorldJobMarkerReadModel,
): void {
  const bounds = tileWorldBounds(readModel, marker.tile);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const accent = readMarkerAccent(marker.state);

  switch (marker.state) {
    case "queued":
    case "claimable":
      drawTileCorners(
        graphic,
        bounds.x - 2,
        bounds.y - 2,
        bounds.width + 4,
        bounds.height + 4,
        accent,
        7,
        2,
      );
      graphic.circle(centerX, centerY, 3);
      graphic.fill(accent);
      break;
    case "claimed":
      graphic.rect(centerX - 9, centerY - 9, 18, 18);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      graphic.moveTo(centerX - 5, centerY);
      graphic.lineTo(centerX + 5, centerY);
      graphic.moveTo(centerX, centerY - 5);
      graphic.lineTo(centerX, centerY + 5);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      break;
    case "moving":
      graphic.poly([
        centerX,
        centerY - 11,
        centerX + 11,
        centerY,
        centerX,
        centerY + 11,
        centerX - 11,
        centerY,
      ]);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      break;
    case "working":
      graphic.circle(centerX, centerY, 12);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      drawMarkerProgressRing(graphic, centerX, centerY, marker.progressPercent ?? 0, accent);
      break;
    case "blocked":
    case "failed":
    case "canceled":
      graphic.poly([
        centerX,
        centerY - 10,
        centerX + 10,
        centerY,
        centerX,
        centerY + 10,
        centerX - 10,
        centerY,
      ]);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      graphic.moveTo(centerX - 4, centerY - 4);
      graphic.lineTo(centerX + 4, centerY + 4);
      graphic.moveTo(centerX + 4, centerY - 4);
      graphic.lineTo(centerX - 4, centerY + 4);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      break;
    case "completed":
      graphic.circle(centerX, centerY, 11);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      graphic.moveTo(centerX - 4, centerY);
      graphic.lineTo(centerX - 1, centerY + 3);
      graphic.lineTo(centerX + 5, centerY - 4);
      graphic.stroke({
        color: accent,
        pixelLine: true,
        width: 2,
      });
      break;
  }

  if (marker.progressPercent !== undefined && marker.state !== "working") {
    drawMarkerProgressBar(
      graphic,
      bounds.x,
      bounds.y - 10,
      bounds.width,
      marker.progressPercent,
      accent,
    );
  }
}

function drawTileCorners(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  cornerLength: number,
  strokeWidth: number,
): void {
  graphic.moveTo(x, y + cornerLength);
  graphic.lineTo(x, y);
  graphic.lineTo(x + cornerLength, y);
  graphic.moveTo(x + width - cornerLength, y);
  graphic.lineTo(x + width, y);
  graphic.lineTo(x + width, y + cornerLength);
  graphic.moveTo(x, y + height - cornerLength);
  graphic.lineTo(x, y + height);
  graphic.lineTo(x + cornerLength, y + height);
  graphic.moveTo(x + width - cornerLength, y + height);
  graphic.lineTo(x + width, y + height);
  graphic.lineTo(x + width, y + height - cornerLength);
  graphic.stroke({
    color,
    pixelLine: true,
    width: strokeWidth,
  });
}

function readActivityAccent(state: NonNullable<WorldEntityReadModel["activity"]>["state"]): number {
  switch (state) {
    case "idle":
      return 0xc9d2e4;
    case "moving":
      return 0x5fd1ff;
    case "working":
      return 0xf5d06a;
    case "blocked":
      return 0xff8b6a;
    case "completed":
      return 0x7dd3a6;
  }
}

function readMarkerAccent(state: WorldJobMarkerReadModel["state"]): number {
  switch (state) {
    case "queued":
      return 0xc9d2e4;
    case "claimable":
      return 0xf5d06a;
    case "claimed":
      return 0x8fd3ff;
    case "moving":
      return 0x5fd1ff;
    case "working":
      return 0xf5d06a;
    case "blocked":
    case "failed":
    case "canceled":
      return 0xff8b6a;
    case "completed":
      return 0x7dd3a6;
  }
}

function drawMarkerProgressBar(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  progressPercent: number,
  color: number,
): void {
  const clampedPercent = Math.max(0, Math.min(progressPercent, 100));
  graphic.rect(x, y, width, 5);
  graphic.fill(0x1b140e);
  graphic.stroke({
    color: 0xf5e6bf,
    pixelLine: true,
    width: 1,
  });
  graphic.rect(x + 1, y + 1, ((width - 2) * clampedPercent) / 100, 3);
  graphic.fill(color);
}

function drawMarkerProgressRing(
  graphic: Graphics,
  centerX: number,
  centerY: number,
  progressPercent: number,
  color: number,
): void {
  const clampedPercent = Math.max(0, Math.min(progressPercent, 100));
  if (clampedPercent <= 0) {
    return;
  }

  const sweep = (Math.PI * 2 * clampedPercent) / 100;
  graphic.arc(centerX, centerY, 9, -Math.PI / 2, -Math.PI / 2 + sweep);
  graphic.stroke({
    color,
    pixelLine: true,
    width: 3,
  });
}

function tileWorldCenter(
  readModel: WorldReadModel,
  tile: TileCoordinate,
): { readonly x: number; readonly y: number } {
  return {
    x: tile.x * readModel.tileSize + readModel.tileSize / 2,
    y: tile.y * readModel.tileSize + readModel.tileSize / 2,
  };
}

function tileWorldBounds(
  readModel: WorldReadModel,
  tile: TileCoordinate,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  return {
    x: tile.x * readModel.tileSize,
    y: tile.y * readModel.tileSize,
    width: readModel.tileSize,
    height: readModel.tileSize,
  };
}

function adjustColor(color: number, amount: number): number {
  const red = clampChannel(((color >> 16) & 0xff) / 255 + amount);
  const green = clampChannel(((color >> 8) & 0xff) / 255 + amount);
  const blue = clampChannel((color & 0xff) / 255 + amount);
  return (Math.round(red * 255) << 16) | (Math.round(green * 255) << 8) | Math.round(blue * 255);
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

function replaceLayerGraphics(layer: Container, rebuild: () => void): void {
  const removedChildren = layer.removeChildren();
  for (const child of removedChildren) {
    child.destroy({ children: true });
  }
  rebuild();
}

function readStaticLayerSignature(readModel: WorldReadModel): StaticLayerSignature {
  return {
    chunkSize: readModel.chunkSize,
    chunks: readModel.chunks,
    focusMarkers: readModel.focusMarkers,
    mapHeight: readModel.mapHeight,
    mapWidth: readModel.mapWidth,
    semanticAreas: readModel.semanticAreas,
    tileSize: readModel.tileSize,
  };
}

function matchesStaticLayerSignature(
  previous: StaticLayerSignature,
  next: StaticLayerSignature,
): boolean {
  return (
    previous.tileSize === next.tileSize &&
    previous.chunkSize === next.chunkSize &&
    previous.mapWidth === next.mapWidth &&
    previous.mapHeight === next.mapHeight &&
    previous.chunks === next.chunks &&
    previous.semanticAreas === next.semanticAreas &&
    previous.focusMarkers === next.focusMarkers
  );
}

function readEntity(readModel: WorldReadModel, entityId: string): WorldEntityReadModel | undefined {
  for (const entity of readModel.entities) {
    if (entity.entityId === entityId) {
      return entity;
    }
  }

  return undefined;
}

function readEntityTile(
  readModel: WorldReadModel,
  entityId: string | undefined,
): TileCoordinate | undefined {
  return entityId === undefined ? undefined : readEntity(readModel, entityId)?.tile;
}
