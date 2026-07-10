import type { EntityId } from "./entity-id";
import type { RunnerSpeed, Tick } from "./time";

export const GAME_SESSION_RUNTIME_VERSION = 1;
export const GAME_SESSION_PROJECTION_BASIS_VERSION = 1;
export const GAME_SESSION_COMMAND_QUEUE_CAPACITY = 128;
export const GAME_SESSION_NO_JOB = 0xffff_ffff;

export const PR1_INTEGRATED_GAME_SESSION_ALIAS = "pr1-integrated-gamesession";
export const PR1_INTEGRATED_GAME_SESSION_ID = "post-m8.pr1_integrated_gamesession.v1";
export const PR1_CONTENT_MANIFEST_HASH = "0xf625e427";

export const PR1_RESOURCE_FOOD = 1;
export const PR1_RESOURCE_WOOD = 2;
export const PR1_RESOURCE_STONE = 3;
export const PR1_RESOURCE_LAMP_OIL = 4;
export const PR1_BLUEPRINT_SIMPLE_SHELTER = 200;

export const GAME_SESSION_PHASE_ORDER = [
  "apply_commands",
  "refresh_derived_indexes",
  "select_indexed_work",
  "acquire_reservations",
  "advance_explicit_jobs",
  "advance_town_owners",
  "cleanup_terminal_state",
  "update_projection_metrics_hash_basis",
] as const;

export type GameSessionPhase = (typeof GAME_SESSION_PHASE_ORDER)[number];

export type GameSessionResidentActivity = "idle" | "moving" | "working";

export type GameSessionStructuredReason =
  | "game_session.awaiting_job_driver"
  | "game_session.indexed_work_available"
  | "game_session.no_indexed_work"
  | "game_session.job_reserved"
  | "game_session.job_working"
  | "game_session.job_completed"
  | "game_session.job_failed";

export interface GameSessionResidentStart {
  readonly defId: number;
  readonly x: number;
  readonly y: number;
  readonly hunger: number;
  readonly rest: number;
  readonly comfort: number;
  readonly social: number;
  readonly safety: number;
}

export interface GameSessionResourceStart {
  readonly defId: number;
  readonly quantity: number;
  readonly capacity: number;
  readonly storageX: number;
  readonly storageY: number;
}

export interface GameSessionBedStart {
  readonly x: number;
  readonly y: number;
}

export interface GameSessionLampStart {
  readonly x: number;
  readonly y: number;
  readonly fuel: number;
  readonly wick: number;
}

export interface GameSessionBuildSiteStart {
  readonly anchorX: number;
  readonly anchorY: number;
  readonly requiredWood: number;
  readonly requiredStone: number;
  readonly buildRequiredTicks: number;
  readonly blueprintDefId: number;
}

export interface GameSessionScenarioDefinition {
  readonly scenarioId: string;
  readonly contentManifestHash: string;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly mapChunkSize: number;
  readonly residents: readonly GameSessionResidentStart[];
  readonly resources: readonly GameSessionResourceStart[];
  readonly beds: readonly GameSessionBedStart[];
  readonly lamp: GameSessionLampStart;
  readonly buildSite: GameSessionBuildSiteStart;
}

export interface GameSessionRuntimeOptions {
  readonly seed: string;
  readonly scenario?: GameSessionScenarioDefinition;
}

export interface GameSessionCommandInput {
  readonly tick: Tick;
  readonly commandId: string;
  readonly kind: "noop";
}

export interface GameSessionQueuedCommand extends GameSessionCommandInput {
  readonly sequence: number;
  readonly commandHash: number;
}

export type GameSessionQueueCommandResult =
  | { readonly ok: true; readonly command: GameSessionQueuedCommand }
  | {
      readonly ok: false;
      readonly reason:
        | "game_session.command_tick_invalid"
        | "game_session.command_id_invalid"
        | "game_session.command_order_invalid"
        | "game_session.command_queue_full";
    };

export interface GameSessionAdvanceResult {
  readonly requestedTicks: Tick;
  readonly advancedTicks: Tick;
  readonly finalTick: Tick;
  readonly paused: boolean;
}

export interface GameSessionResidentView {
  readonly residentId: number;
  readonly entity: EntityId;
  readonly defId: number;
  readonly activity: GameSessionResidentActivity;
  readonly currentJobId: number;
  readonly reason: GameSessionStructuredReason;
  readonly ownerVersion: number;
}

export interface GameSessionDerivedIndexBasis {
  readonly version: number;
  readonly mapVersion: number;
  readonly locationVersion: number;
  readonly itemVersion: number;
  readonly storageIndexVersion: number;
  readonly reservationVersion: number;
  readonly jobVersion: number;
  readonly workOfferCount: number;
  readonly needOwnerVersion: number;
  readonly needIndexVersion: number;
  readonly restOwnerVersion: number;
  readonly restIndexVersion: number;
  readonly lampOwnerVersion: number;
  readonly buildOwnerVersion: number;
  readonly pathMapVersion: number;
  readonly pathNavigationVersion: number;
  readonly pathRegionVersion: number;
  readonly pathRoomVersion: number;
  readonly pathRegionGraphVersion: number;
}

export interface GameSessionProjectionBasis {
  readonly projectionBasisVersion: typeof GAME_SESSION_PROJECTION_BASIS_VERSION;
  readonly scenarioId: string;
  readonly contentManifestHash: string;
  readonly tick: Tick;
  readonly snapshotSequence: number;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly mapVersion: number;
  readonly locationVersion: number;
  readonly reservationVersion: number;
  readonly jobVersion: number;
  readonly derivedIndexVersion: number;
}

export type GameSessionRenderEntityKind = "resident" | "resource" | "bed" | "lamp" | "build_site";

export interface GameSessionRenderEntity {
  readonly entity: EntityId;
  readonly kind: GameSessionRenderEntityKind;
  readonly defId: number;
  readonly xQ16: number;
  readonly yQ16: number;
  readonly flags: number;
}

export interface GameSessionRenderProjection {
  readonly readOnly: true;
  readonly basis: GameSessionProjectionBasis;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly entities: readonly GameSessionRenderEntity[];
}

export interface GameSessionUiResident {
  readonly residentId: number;
  readonly entity: EntityId;
  readonly defId: number;
  readonly cellIndex: number;
  readonly activity: GameSessionResidentActivity;
  readonly currentJobId: number;
  readonly hunger: number;
  readonly rest: number;
  readonly comfort: number;
  readonly social: number;
  readonly safety: number;
  readonly reason: GameSessionStructuredReason;
}

export type GameSessionConservationCheckpoint = "observational" | "terminal";

export interface GameSessionUiResource {
  readonly defId: number;
  readonly total: number;
  readonly available: number;
  readonly reserved: number;
}

export interface GameSessionUiProjection {
  readonly readOnly: true;
  readonly basis: GameSessionProjectionBasis;
  readonly paused: boolean;
  readonly requestedSpeed: RunnerSpeed;
  readonly dayIndex: number;
  readonly tickOfDay: number;
  readonly residents: readonly GameSessionUiResident[];
  readonly resources: readonly GameSessionUiResource[];
  readonly activeJobCount: number;
  readonly activeReservationCount: number;
  readonly lampFuel: number;
  readonly lampMaintenanceState: number;
  readonly buildProgressTicks: number;
  readonly buildRequiredTicks: number;
  readonly buildCompleted: boolean;
  readonly alerts: readonly GameSessionStructuredReason[];
}

export type GameSessionConservationDivergenceCode =
  | "game_session.jobs_leaked"
  | "game_session.reservations_leaked"
  | "game_session.path_queue_leaked"
  | "game_session.command_queue_not_drained"
  | "game_session.resource_conservation_failed";

export interface GameSessionConservationDivergence {
  readonly code: GameSessionConservationDivergenceCode;
  readonly tick: Tick;
  readonly subjectId: number;
  readonly expected: number;
  readonly actual: number;
}

export interface GameSessionResourceConservationRow {
  readonly defId: number;
  readonly initial: number;
  readonly current: number;
  readonly delta: number;
}

export interface GameSessionConservationReport {
  readonly ok: boolean;
  readonly tick: Tick;
  readonly activeJobs: number;
  readonly activeReservations: number;
  readonly pendingCommands: number;
  readonly pendingPaths: number;
  readonly mapDirtyBacklog: number;
  readonly lampDirtyBacklog: number;
  readonly needDirtyBacklog: number;
  readonly restDirtyBacklog: number;
  readonly storageDirtyBacklog: number;
  readonly environmentDirtyBacklog: number;
  readonly workOfferBacklog: number;
  readonly resources: readonly GameSessionResourceConservationRow[];
  readonly firstDivergence: GameSessionConservationDivergence | null;
}

export interface GameSessionMetrics {
  readonly tick: Tick;
  readonly ticksAdvanced: number;
  readonly commandQueueDepth: number;
  readonly commandBacklogPeak: number;
  readonly appliedCommandCount: number;
  readonly workOfferProbeCount: number;
  readonly workOfferVisitedCount: number;
  readonly pathRequestCount: number;
  readonly pathAcceptedCount: number;
  readonly pathStaleRejectedCount: number;
  readonly pathNodeExpansions: number;
  readonly activeJobCount: number;
  readonly activeJobPeak: number;
  readonly jobTerminalCount: number;
  readonly activeReservationCount: number;
  readonly activeReservationPeak: number;
  readonly reservationAcquiredCount: number;
  readonly reservationReleasedCount: number;
  readonly reservationConflictCount: number;
  readonly resourceConservationDelta: number;
  readonly projectionBuildCount: number;
  readonly projectionBacklog: 0;
  readonly phaseViolationCount: number;
  readonly fullWorldPawnScanCount: 0;
  readonly unconditionalResultObjectCallCount: 0;
  readonly needScheduledUpdateCallCount: 0;
  readonly eventResultObjectCallCount: number;
}

export interface Pr1IntegratedGameSessionScenarioOptions {
  readonly seed: string;
  readonly ticks: Tick;
}

export interface Pr1IntegratedGameSessionScenarioSummary {
  readonly version: typeof GAME_SESSION_RUNTIME_VERSION;
  readonly scenarioId: typeof PR1_INTEGRATED_GAME_SESSION_ID;
  readonly contentManifestHash: string;
  readonly seed: string;
  readonly ticksPerSecond: 30;
  readonly finalTick: Tick;
  readonly residentCount: number;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly resources: readonly GameSessionResourceConservationRow[];
  readonly conservation: GameSessionConservationReport;
  readonly metrics: GameSessionMetrics;
}
