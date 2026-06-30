import type {
  TileCoordinate,
  WorldEntityReadModel,
  WorldFocusMarkerReadModel,
  WorldReadModel,
  WorldSemanticAreaReadModel,
} from "@wuming-town/sim-protocol";

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

export interface ScreenRect extends ScreenPoint {
  readonly width: number;
  readonly height: number;
}

export interface ScreenEntityActivityProjection {
  readonly badgeAnchor: ScreenPoint;
  readonly center: ScreenPoint;
  readonly entityId: string;
  readonly path: readonly ScreenPoint[];
  readonly progressBar?: ScreenRect;
  readonly target?: ScreenPoint;
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

export function readSemanticAreaScreenRect(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  area: WorldSemanticAreaReadModel,
): ScreenRect {
  const topLeft = worldToScreen(
    viewport,
    area.originTile.x * readModel.tileSize,
    area.originTile.y * readModel.tileSize,
  );

  return {
    height: area.height * readModel.tileSize * viewport.zoom,
    width: area.width * readModel.tileSize * viewport.zoom,
    x: topLeft.x,
    y: topLeft.y,
  };
}

export function readFocusMarkerScreenPoint(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  marker: WorldFocusMarkerReadModel,
): ScreenPoint {
  return tileToScreenCenter(viewport, readModel, marker.tile);
}

export function readPathScreenPoints(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  pathTiles: readonly TileCoordinate[],
): readonly ScreenPoint[] {
  return pathTiles.map((tile) => tileToScreenCenter(viewport, readModel, tile));
}

export function readEntityActivityScreenProjection(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  entity: WorldEntityReadModel,
): ScreenEntityActivityProjection | undefined {
  const activity = entity.activity;
  if (activity === undefined) {
    return undefined;
  }

  const center = tileToScreenCenter(viewport, readModel, entity.tile);
  const path =
    activity.pathTiles === undefined
      ? []
      : readPathScreenPoints(viewport, readModel, activity.pathTiles);
  const target =
    activity.targetTile === undefined
      ? undefined
      : tileToScreenCenter(viewport, readModel, activity.targetTile);
  const progressBar =
    activity.progressPercent === undefined
      ? undefined
      : {
          height: 6,
          width: readModel.tileSize * 1.35 * viewport.zoom,
          x: center.x - (readModel.tileSize * 1.35 * viewport.zoom) / 2,
          y: center.y + readModel.tileSize * 0.62 * viewport.zoom,
        };

  return {
    badgeAnchor: {
      x: center.x,
      y: center.y - readModel.tileSize * 0.8 * viewport.zoom,
    },
    center,
    entityId: entity.entityId,
    path,
    ...(progressBar === undefined ? {} : { progressBar }),
    ...(target === undefined ? {} : { target }),
  };
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

export function tileToScreenBounds(
  viewport: RendererViewportState,
  readModel: WorldReadModel,
  tile: TileCoordinate,
): ScreenRect {
  const topLeft = worldToScreen(viewport, tile.x * readModel.tileSize, tile.y * readModel.tileSize);

  return {
    height: readModel.tileSize * viewport.zoom,
    width: readModel.tileSize * viewport.zoom,
    x: topLeft.x,
    y: topLeft.y,
  };
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
