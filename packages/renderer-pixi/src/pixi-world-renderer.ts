/// <reference lib="dom" />

import "pixi.js/unsafe-eval";
import { Application, Container, Graphics } from "pixi.js";

import type { TileCoordinate, TerrainKind, WorldReadModel } from "@wuming-town/sim-protocol";

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
  tileToScreenCenter,
  zoomViewportAtPoint,
} from "./render-geometry";

export interface RendererStateSnapshot {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly zoom: number;
  readonly lastInputLabel: string;
  readonly selectedEntityId: string | undefined;
  readonly hoverTile: TileCoordinate | undefined;
}

export interface PixiWorldRendererDebugState {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly zoom: number;
  readonly selectedEntityId: string | undefined;
  readonly entityScreenPositions: readonly ScreenEntityPosition[];
}

export interface CreatePixiWorldRendererOptions {
  readonly container: HTMLElement;
  readonly readModel: WorldReadModel;
  readonly selectedEntityId?: string;
  readonly onSelectionChange?: (entityId: string | undefined, inputLabel: string) => void;
  readonly onStateChange?: (state: RendererStateSnapshot) => void;
}

export interface PixiWorldRenderer {
  readonly canvas: HTMLCanvasElement;
  resize(width: number, height: number, devicePixelRatio: number): void;
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

const ENTITY_RADIUS_PX = 9;
const PAN_STEP_TILES = 2;

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
  const entityLayer = new Container();
  const overlayLayer = new Container();
  worldRoot.addChild(terrainLayer);
  worldRoot.addChild(entityLayer);
  worldRoot.addChild(overlayLayer);
  app.stage.addChild(worldRoot);

  let viewport = createFittedViewport(
    options.readModel,
    Math.max(options.container.clientWidth, 1),
    Math.max(options.container.clientHeight, 1),
  );
  let hoverTile: TileCoordinate | undefined;
  let selectedEntityId: string | undefined =
    options.selectedEntityId ?? options.readModel.selectedEntityId;
  let lastInputLabel = "Ready";
  let userAdjustedViewport = false;

  buildTerrainGraphics(terrainLayer, options.readModel);
  buildEntityGraphics(entityLayer, options.readModel);

  const selectionGraphic = new Graphics();
  const hoverGraphic = new Graphics();
  overlayLayer.addChild(selectionGraphic);
  overlayLayer.addChild(hoverGraphic);

  const onPointerMove = (event: PointerEvent): void => {
    const tile = screenToTile(viewport, options.readModel, readRelativePoint(event, canvas));
    if (
      tile?.x === hoverTile?.x &&
      tile?.y === hoverTile?.y &&
      tile !== undefined &&
      hoverTile !== undefined
    ) {
      return;
    }

    hoverTile = tile;
    drawHoverGraphic(hoverGraphic, hoverTile, options.readModel);
    emitStateChange();
  };

  const onPointerLeave = (): void => {
    hoverTile = undefined;
    drawHoverGraphic(hoverGraphic, hoverTile, options.readModel);
    emitStateChange();
  };

  const onPointerDown = (event: PointerEvent): void => {
    canvas.focus();
    const point = readRelativePoint(event, canvas);
    const entityId = findEntityAtScreenPoint(viewport, options.readModel, point);
    if (entityId !== selectedEntityId) {
      selectedEntityId = entityId;
      drawSelectionGraphic(selectionGraphic, selectedEntityId, viewport, options.readModel);
    }

    const tile = screenToTile(viewport, options.readModel, point);
    lastInputLabel =
      entityId !== undefined
        ? `Canvas select ${entityId}`
        : tile !== undefined
          ? `Canvas inspect ${String(tile.x)},${String(tile.y)}`
          : "Canvas pointer";
    options.onSelectionChange?.(entityId, lastInputLabel);
    emitStateChange();
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    userAdjustedViewport = true;
    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
    viewport = zoomViewportAtPoint(
      viewport,
      options.readModel,
      readRelativePoint(event, canvas),
      viewport.zoom * zoomFactor,
    );
    lastInputLabel = `Wheel zoom ${String(Math.round(viewport.zoom * 100))}%`;
    applyViewport(app, worldRoot, viewport, devicePixelRatio);
    drawSelectionGraphic(selectionGraphic, selectedEntityId, viewport, options.readModel);
    drawHoverGraphic(hoverGraphic, hoverTile, options.readModel);
    emitStateChange();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    let nextViewport: RendererViewportState;
    const panStep = options.readModel.tileSize * PAN_STEP_TILES;

    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        nextViewport = panViewport(viewport, options.readModel, 0, -panStep);
        break;
      case "ArrowDown":
      case "KeyS":
        nextViewport = panViewport(viewport, options.readModel, 0, panStep);
        break;
      case "ArrowLeft":
      case "KeyA":
        nextViewport = panViewport(viewport, options.readModel, -panStep, 0);
        break;
      case "ArrowRight":
      case "KeyD":
        nextViewport = panViewport(viewport, options.readModel, panStep, 0);
        break;
      case "Equal":
      case "NumpadAdd":
        nextViewport = zoomViewportAtPoint(
          viewport,
          options.readModel,
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
          options.readModel,
          {
            x: viewport.canvasWidth / 2,
            y: viewport.canvasHeight / 2,
          },
          viewport.zoom * 0.9,
        );
        break;
      default:
        return;
    }

    event.preventDefault();
    userAdjustedViewport = true;
    viewport = nextViewport;
    lastInputLabel = `Keyboard ${event.code}`;
    applyViewport(app, worldRoot, viewport, devicePixelRatio);
    drawSelectionGraphic(selectionGraphic, selectedEntityId, viewport, options.readModel);
    drawHoverGraphic(hoverGraphic, hoverTile, options.readModel);
    emitStateChange();
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);

  applyViewport(app, worldRoot, viewport, devicePixelRatio);
  drawSelectionGraphic(selectionGraphic, selectedEntityId, viewport, options.readModel);
  drawHoverGraphic(hoverGraphic, hoverTile, options.readModel);
  emitStateChange();

  return {
    canvas,
    resize(width: number, height: number, nextDevicePixelRatio: number): void {
      viewport = userAdjustedViewport
        ? resizeViewport(viewport, options.readModel, width, height)
        : createFittedViewport(options.readModel, width, height);
      applyViewport(app, worldRoot, viewport, nextDevicePixelRatio);
      drawSelectionGraphic(selectionGraphic, selectedEntityId, viewport, options.readModel);
      drawHoverGraphic(hoverGraphic, hoverTile, options.readModel);
      emitStateChange();
    },
    setSelectedEntityId(entityId: string | undefined): void {
      if (entityId === selectedEntityId) {
        return;
      }

      selectedEntityId = entityId;
      drawSelectionGraphic(selectionGraphic, selectedEntityId, viewport, options.readModel);
      emitStateChange();
    },
    readDebugState(): PixiWorldRendererDebugState {
      return {
        canvasWidth: viewport.canvasWidth,
        canvasHeight: viewport.canvasHeight,
        zoom: viewport.zoom,
        selectedEntityId,
        entityScreenPositions: readEntityScreenPositions(viewport, options.readModel),
      };
    },
    destroy(): Promise<void> {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("wheel", onWheel);
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
      hoverTile,
    };
    options.onStateChange?.(nextState);
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
        chunkGraphic.rect(
          chunkOriginX + tileX * readModel.tileSize,
          chunkOriginY + tileY * readModel.tileSize,
          readModel.tileSize,
          readModel.tileSize,
        );
        chunkGraphic.fill(TERRAIN_COLORS[terrain]);
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

function buildEntityGraphics(layer: Container, readModel: WorldReadModel): void {
  for (const entity of readModel.entities) {
    const marker = new Graphics();
    marker.circle(0, 0, ENTITY_RADIUS_PX);
    marker.fill(entity.colorHex);
    marker.stroke({
      color: 0x20160f,
      pixelLine: true,
      width: 3,
    });

    marker.position.set(
      entity.tile.x * readModel.tileSize + readModel.tileSize / 2,
      entity.tile.y * readModel.tileSize + readModel.tileSize / 2,
    );
    layer.addChild(marker);
  }
}

function drawSelectionGraphic(
  graphic: Graphics,
  selectedEntityId: string | undefined,
  viewport: RendererViewportState,
  readModel: WorldReadModel,
): void {
  graphic.clear();
  if (selectedEntityId === undefined) {
    return;
  }

  const entity = readModel.entities.find((candidate) => candidate.entityId === selectedEntityId);
  if (entity === undefined) {
    return;
  }

  const tilePoint = tileToScreenCenter(viewport, readModel, entity.tile);
  const worldX = viewport.centerWorldX + (tilePoint.x - viewport.canvasWidth / 2) / viewport.zoom;
  const worldY = viewport.centerWorldY + (tilePoint.y - viewport.canvasHeight / 2) / viewport.zoom;
  graphic.circle(worldX, worldY, ENTITY_RADIUS_PX + 5);
  graphic.stroke({
    color: 0xf7b538,
    pixelLine: true,
    width: 3,
  });
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

  graphic.rect(
    hoverTile.x * readModel.tileSize,
    hoverTile.y * readModel.tileSize,
    readModel.tileSize,
    readModel.tileSize,
  );
  graphic.stroke({
    color: 0xf5e6bf,
    pixelLine: true,
    width: 2,
  });
}

function readRelativePoint(event: MouseEvent, canvas: HTMLCanvasElement): ScreenPoint {
  const canvasRect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top,
  };
}
