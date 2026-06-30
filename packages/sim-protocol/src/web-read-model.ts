export type TerrainKind = "path" | "earth" | "brush" | "water" | "lantern-glow";
export type WorldSemanticAreaKind = "structure" | "lamp-coverage" | "dark-gap" | "blocked-area";
export type WorldFocusMarkerKind = "selectable" | "blocked" | "completed";
export type WorldEntityActivityState = "idle" | "moving" | "working" | "blocked" | "completed";

export interface TileCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface TownAlertReadModel {
  readonly severity: "stable" | "warning" | "danger";
  readonly label: string;
  readonly detail: string;
}

export interface ResourceSummaryReadModel {
  readonly label: string;
  readonly amount: number;
  readonly unit: string;
  readonly trend: "rising" | "steady" | "falling";
}

export interface TownOverviewReadModel {
  readonly settlementName: string;
  readonly phaseLabel: string;
  readonly cycleLabel: string;
  readonly speedLabel: string;
  readonly alerts: readonly TownAlertReadModel[];
  readonly resources: readonly ResourceSummaryReadModel[];
}

export interface EntityNeedReadModel {
  readonly label: string;
  readonly value: number;
  readonly state: "low" | "steady" | "high";
}

export interface EntityInspectorReadModel {
  readonly roleLabel: string;
  readonly currentJob: string;
  readonly currentStep: string;
  readonly moodLabel: string;
  readonly healthLabel: string;
  readonly lastDecision: string;
  readonly explainers: readonly string[];
  readonly thoughts: readonly string[];
  readonly needs: readonly EntityNeedReadModel[];
}

export type WorldEntityKind = "resident" | "visitor" | "lantern-keeper" | "structure";

export interface WorldEntityActivityReadModel {
  readonly state: WorldEntityActivityState;
  readonly label: string;
  readonly detail: string;
  readonly intentLabel?: string;
  readonly pathTiles?: readonly TileCoordinate[];
  readonly progressPercent?: number;
  readonly targetEntityId?: string;
  readonly targetTile?: TileCoordinate;
}

export interface WorldSemanticAreaReadModel {
  readonly areaId: string;
  readonly kind: WorldSemanticAreaKind;
  readonly label: string;
  readonly originTile: TileCoordinate;
  readonly width: number;
  readonly height: number;
  readonly emphasisTile?: TileCoordinate;
}

export interface WorldFocusMarkerReadModel {
  readonly markerId: string;
  readonly kind: WorldFocusMarkerKind;
  readonly label: string;
  readonly tile: TileCoordinate;
  readonly entityId?: string;
}

export interface WorldEntityReadModel {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: WorldEntityKind;
  readonly tile: TileCoordinate;
  readonly colorHex: number;
  readonly summary: string;
  readonly inspector: EntityInspectorReadModel;
  readonly activity?: WorldEntityActivityReadModel;
}

export interface WorldChunkReadModel {
  readonly chunkId: string;
  readonly originTile: TileCoordinate;
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly TerrainKind[];
}

export interface WorldReadModel {
  readonly sessionId: string;
  readonly mapName: string;
  readonly tileSize: number;
  readonly chunkSize: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly town: TownOverviewReadModel;
  readonly chunks: readonly WorldChunkReadModel[];
  readonly entities: readonly WorldEntityReadModel[];
  readonly semanticAreas?: readonly WorldSemanticAreaReadModel[];
  readonly focusMarkers?: readonly WorldFocusMarkerReadModel[];
  readonly selectedEntityId: string;
}
