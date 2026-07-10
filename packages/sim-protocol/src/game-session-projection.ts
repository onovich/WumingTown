import { GAME_SESSION_PROJECTION_VERSION } from "./constants";

export interface GameSessionProjectionRequestV1 {
  readonly kind: "game_session";
  readonly version: typeof GAME_SESSION_PROJECTION_VERSION;
}

export type GameSessionProjectionContractV1 = GameSessionProjectionRequestV1;

export interface GameSessionEntityRefV1 {
  readonly index: number;
  readonly generation: number;
}

export interface GameSessionProjectionBasisV1 {
  readonly projectionVersion: typeof GAME_SESSION_PROJECTION_VERSION;
  readonly scenarioId: string;
  readonly contentManifestHash: string;
  readonly tick: number;
  readonly snapshotSequence: number;
  readonly previousSnapshotSequence: number | null;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly mapVersion: number;
  readonly reservationVersion: number;
  readonly jobVersion: number;
  readonly derivedIndexVersion: number;
}

export type GameSessionRenderKindV1 = "resident" | "resource" | "structure" | "lamp" | "build_site";

export type GameSessionAnimationStateV1 = "idle" | "moving" | "working" | "blocked" | "completed";

export interface GameSessionRenderEntityV1 {
  readonly entity: GameSessionEntityRefV1;
  readonly kind: GameSessionRenderKindV1;
  readonly renderDefId: number;
  readonly xQ16: number;
  readonly yQ16: number;
  readonly facing: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly animationState: GameSessionAnimationStateV1;
  readonly flags: number;
}

export interface GameSessionRenderProjectionV1 {
  readonly basis: GameSessionProjectionBasisV1;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly tileSizeQ16: number;
  readonly entities: readonly GameSessionRenderEntityV1[];
}

export type GameSessionDayPhaseV1 = "dawn" | "day" | "dusk" | "night";

export type GameSessionJobMarkerStateV1 =
  | "idle"
  | "claiming"
  | "moving"
  | "working"
  | "blocked"
  | "completed"
  | "failed";

export interface GameSessionStructuredReasonV1 {
  readonly code: string;
  readonly source:
    | "session"
    | "resident"
    | "resource"
    | "job"
    | "reservation"
    | "pathing"
    | "lamp"
    | "build";
  readonly parameters: readonly (string | number | boolean)[];
}

export interface GameSessionUiResidentV1 {
  readonly entity: GameSessionEntityRefV1;
  readonly residentId: number;
  readonly residentDefId: number;
  readonly cellIndex: number;
  readonly activity: "idle" | "moving" | "working";
  readonly jobState: GameSessionJobMarkerStateV1;
  readonly currentJobId: number | null;
  readonly progressQ16: number;
  readonly hunger: number;
  readonly rest: number;
  readonly comfort: number;
  readonly social: number;
  readonly safety: number;
  readonly ownerVersion: number;
  readonly reason?: GameSessionStructuredReasonV1;
}

export type GameSessionResourceKindV1 = "food" | "wood" | "stone" | "lamp_oil" | "other";

export interface GameSessionUiResourceV1 {
  readonly defId: number;
  readonly resourceKind: GameSessionResourceKindV1;
  readonly total: number;
  readonly available: number;
  readonly reserved: number;
  readonly ownerVersion: number;
}

export interface GameSessionUiJobMarkerV1 {
  readonly markerId: string;
  readonly jobId: number | null;
  readonly state: GameSessionJobMarkerStateV1;
  readonly owner?: GameSessionEntityRefV1;
  readonly target?: GameSessionEntityRefV1;
  readonly progressQ16: number;
  readonly reason?: GameSessionStructuredReasonV1;
}

export interface GameSessionAlertV1 {
  readonly alertId: string;
  readonly severity: "info" | "warning" | "critical";
  readonly reason: GameSessionStructuredReasonV1;
  readonly subject?: GameSessionEntityRefV1;
}

export type GameSessionSelectionDetailV1 =
  | GameSessionResidentSelectionDetailV1
  | GameSessionResourceSelectionDetailV1
  | GameSessionStructureSelectionDetailV1;

export interface GameSessionSelectionBasisV1 {
  readonly version: 1;
  readonly snapshotSequence: number;
  readonly ownerVersion: number;
}

export interface GameSessionResidentSelectionDetailV1 {
  readonly kind: "resident";
  readonly basis: GameSessionSelectionBasisV1;
  readonly resident: GameSessionUiResidentV1;
}

export interface GameSessionResourceSelectionDetailV1 {
  readonly kind: "resource";
  readonly basis: GameSessionSelectionBasisV1;
  readonly resource: GameSessionUiResourceV1;
}

export interface GameSessionStructureSelectionDetailV1 {
  readonly kind: "structure";
  readonly basis: GameSessionSelectionBasisV1;
  readonly entity: GameSessionEntityRefV1;
  readonly structureKind: "bed" | "lamp" | "build_site";
  readonly structureDefId: number;
  readonly cellIndex: number;
  readonly stateCode: number;
  readonly progressQ16: number;
  readonly reason?: GameSessionStructuredReasonV1;
}

export interface GameSessionUiProjectionV1 {
  readonly basis: GameSessionProjectionBasisV1;
  readonly paused: boolean;
  readonly requestedSpeed: 0 | 1 | 2 | 3;
  readonly effectiveTicksPerSecond: 0 | 30 | 60 | 90;
  readonly dayIndex: number;
  readonly tickOfDay: number;
  readonly ticksPerDay: number;
  readonly dayPhase: GameSessionDayPhaseV1;
  readonly daylightQ16: number;
  readonly residents: readonly GameSessionUiResidentV1[];
  readonly resources: readonly GameSessionUiResourceV1[];
  readonly jobs: readonly GameSessionUiJobMarkerV1[];
  readonly alerts: readonly GameSessionAlertV1[];
  readonly selectionDetail: GameSessionSelectionDetailV1 | null;
  readonly lampFuel: number;
  readonly lampStateCode: number;
  readonly buildProgressTicks: number;
  readonly buildRequiredTicks: number;
  readonly buildCompleted: boolean;
}
