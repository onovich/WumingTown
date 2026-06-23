import type { TileCoordinate, WorldReadModel } from "@wuming-town/sim-protocol";

export interface RendererViewportState {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly zoom: number;
  readonly centerWorldX: number;
  readonly centerWorldY: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface ScreenEntityPosition extends ScreenPoint {
  readonly entityId: string;
}

const FIT_PADDING_PX = 48;
const MIN_ZOOM = 0.9;
const MAX_ZOOM = 2.8;
const ENTITY_HIT_RADIUS_PX = 18;

export function createFittedViewport(
  readModel: WorldReadModel,
  canvasWidth: number,
  canvasHeight: number,
): RendererViewportState {
  const safeCanvasWidth = Math.max(canvasWidth, 1);
  const safeCanvasHeight = Math.max(canvasHeight, 1);
  const mapWidthPixels = readModel.mapWidth * readModel.tileSize;
  const mapHeightPixels = readModel.mapHeight * readModel.tileSize;
  const availableWidth = Math.max(safeCanvasWidth - FIT_PADDING_PX * 2, 1);
  const availableHeight = Math.max(safeCanvasHeight - FIT_PADDING_PX * 2, 1);
  const fittedZoom = Math.min(availableWidth / mapWidthPixels, availableHeight / mapHeightPixels);
  const zoom = clamp(MIN_ZOOM, fittedZoom, MAX_ZOOM);

  return clampViewport(readModel, {
    canvasWidth: safeCanvasWidth,
    canvasHeight: safeCanvasHeight,
    zoom,
    centerWorldX: mapWidthPixels / 2,
    centerWorldY: mapHeightPixels / 2,
  });
}

export function resizeViewport(
  previous: RendererViewportState,
  readModel: WorldReadModel,
  canvasWidth: number,
  canvasHeight: number,
): RendererViewportState {
  return clampViewport(readModel, {
    ...previous,
    canvasWidth: Math.max(canvasWidth, 1),
    canvasHeight: Math.max(canvasHeight, 1),
  });
}

export function panViewport(
  previous: RendererViewportState,
  readModel: WorldReadModel,
  deltaWorldX: number,
  deltaWorldY: number,
): RendererViewportState {
  return clampViewport(readModel, {
    ...previous,
    centerWorldX: previous.centerWorldX + deltaWorldX,
    centerWorldY: previous.centerWorldY + deltaWorldY,
  });
}

export function zoomViewportAtPoint(
  previous: RendererViewportState,
  readModel: WorldReadModel,
  anchor: ScreenPoint,
  nextZoom: number,
): RendererViewportState {
  const zoom = clamp(MIN_ZOOM, nextZoom, MAX_ZOOM);
  const anchorWorldX =
    previous.centerWorldX + (anchor.x - previous.canvasWidth / 2) / previous.zoom;
  const anchorWorldY =
    previous.centerWorldY + (anchor.y - previous.canvasHeight / 2) / previous.zoom;
  const centerWorldX = anchorWorldX - (anchor.x - previous.canvasWidth / 2) / zoom;
  const centerWorldY = anchorWorldY - (anchor.y - previous.canvasHeight / 2) / zoom;

  return clampViewport(readModel, {
    ...previous,
    zoom,
    centerWorldX,
    centerWorldY,
  });
}

export function worldToScreen(
  viewport: RendererViewportState,
  worldX: number,
  worldY: number,
): ScreenPoint {
  return {
    x: (worldX - viewport.centerWorldX) * viewport.zoom + viewport.canvasWidth / 2,
    y: (worldY - viewport.centerWorldY) * viewport.zoom + viewport.canvasHeight / 2,
  };
}

export function screenToTile(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  point: ScreenPoint,
): TileCoordinate | undefined {
  const worldX = viewport.centerWorldX + (point.x - viewport.canvasWidth / 2) / viewport.zoom;
  const worldY = viewport.centerWorldY + (point.y - viewport.canvasHeight / 2) / viewport.zoom;
  if (worldX < 0 || worldY < 0) {
    return undefined;
  }

  const tileX = Math.floor(worldX / readModel.tileSize);
  const tileY = Math.floor(worldY / readModel.tileSize);
  if (tileX < 0 || tileY < 0 || tileX >= readModel.mapWidth || tileY >= readModel.mapHeight) {
    return undefined;
  }

  return {
    x: tileX,
    y: tileY,
  };
}

export function findEntityAtScreenPoint(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  point: ScreenPoint,
): string | undefined {
  let nearestEntityId: string | undefined;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const entity of readModel.entities) {
    const entityPoint = tileToScreenCenter(viewport, readModel, entity.tile);
    const distanceX = entityPoint.x - point.x;
    const distanceY = entityPoint.y - point.y;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;

    if (
      distanceSquared <= ENTITY_HIT_RADIUS_PX * ENTITY_HIT_RADIUS_PX &&
      distanceSquared < nearestDistanceSquared
    ) {
      nearestEntityId = entity.entityId;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearestEntityId;
}

export function readEntityScreenPositions(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
): readonly ScreenEntityPosition[] {
  const positions: ScreenEntityPosition[] = [];

  for (const entity of readModel.entities) {
    const screenPoint = tileToScreenCenter(viewport, readModel, entity.tile);
    positions.push({
      entityId: entity.entityId,
      x: screenPoint.x,
      y: screenPoint.y,
    });
  }

  return positions;
}

export function tileToScreenCenter(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  tile: TileCoordinate,
): ScreenPoint {
  const worldX = tile.x * readModel.tileSize + readModel.tileSize / 2;
  const worldY = tile.y * readModel.tileSize + readModel.tileSize / 2;
  return worldToScreen(viewport, worldX, worldY);
}

function clampViewport(
  readModel: WorldReadModel,
  viewport: RendererViewportState,
): RendererViewportState {
  const mapWidthPixels = readModel.mapWidth * readModel.tileSize;
  const mapHeightPixels = readModel.mapHeight * readModel.tileSize;
  const halfViewWidth = viewport.canvasWidth / viewport.zoom / 2;
  const halfViewHeight = viewport.canvasHeight / viewport.zoom / 2;
  const minCenterX = Math.min(halfViewWidth, mapWidthPixels / 2);
  const maxCenterX = Math.max(mapWidthPixels - halfViewWidth, mapWidthPixels / 2);
  const minCenterY = Math.min(halfViewHeight, mapHeightPixels / 2);
  const maxCenterY = Math.max(mapHeightPixels - halfViewHeight, mapHeightPixels / 2);

  return {
    ...viewport,
    centerWorldX: clamp(minCenterX, viewport.centerWorldX, maxCenterX),
    centerWorldY: clamp(minCenterY, viewport.centerWorldY, maxCenterY),
  };
}

function clamp(minimum: number, value: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
