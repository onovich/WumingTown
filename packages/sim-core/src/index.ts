import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
export {
  DEFAULT_WALK_COST_MILLI,
  MAP_DIRECTION_EAST,
  MAP_DIRECTION_MASK_CARDINAL,
  MAP_DIRECTION_MASK_EAST,
  MAP_DIRECTION_MASK_NORTH,
  MAP_DIRECTION_MASK_SOUTH,
  MAP_DIRECTION_MASK_WEST,
  MAP_DIRECTION_NORTH,
  MAP_DIRECTION_SOUTH,
  MAP_DIRECTION_WEST,
  MAP_GRID_SNAPSHOT_VERSION,
  MAP_TERRAIN_BLOCKED,
  MapGrid,
  createMapGrid,
} from "./map-grid";
export {
  REGION_ROOM_REBUILD_SNAPSHOT_VERSION,
  RegionRoomRebuilder,
  createRegionRoomRebuilder,
} from "./region-room-rebuild";
export {
  LOCATION_CONTAINER,
  LOCATION_MAP,
  LOCATION_NONE,
  LocationStore,
  createLocationStore,
} from "./location-store";
export {
  RESERVATION_CAPACITY,
  RESERVATION_CELL,
  RESERVATION_ENTITY,
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  RESERVATION_LEDGER_SNAPSHOT_VERSION,
  ReservationLedger,
  createReservationLedger,
  restoreReservationLedger,
} from "./reservation-ledger";
export { createMapGridHashFields } from "./map-grid-hash";
export {
  NamedRandomStreams,
  RANDOM_STREAMS_SNAPSHOT_VERSION,
  createNamedRandomStreams,
  restoreNamedRandomStreams,
} from "./deterministic-rng";
export { compareReplayCheckpoints } from "./replay-diagnostics";
export {
  CANONICAL_WORLD_HASH_VERSION,
  formatCanonicalWorldHash,
  hashCanonicalWorld,
} from "./world-hash";
export { Int32ComponentStore, createInt32ComponentStore } from "./component-store";
export {
  EntityRegistry,
  MAX_ENTITY_GENERATION,
  createEntityRegistry,
  sameEntity,
} from "./entity-id";
export { SpatialIndex, createSpatialIndex } from "./spatial-index";
export {
  HEADLESS_SUMMARY_VERSION,
  HEADLESS_SNAPSHOT_VERSION,
  advanceHeadlessTicks,
  createHeadlessReplayCheckpoint,
  createHeadlessRunner,
  queueHeadlessCommand,
  restoreHeadlessRunner,
  runHeadlessTicks,
  serializeHeadlessRunner,
  setHeadlessPaused,
  setHeadlessSpeed,
  stepHeadlessFrames,
  summarizeHeadlessRun,
} from "./runner";
export {
  StructuralCommandBuffer,
  createStructuralCommandBuffer,
  createStructuralCommandResultView,
  readStructuralCommandResult,
} from "./structural-commands";
export type {
  ComponentReadResult,
  ComponentStoreReason,
  ComponentStoreResult,
  Int32ComponentStoreOptions,
} from "./component-store";
export type {
  EntityAllocationResult,
  EntityDestroyResult,
  EntityId,
  EntityRegistryOptions,
  EntityRegistryReason,
  EntityValidationResult,
} from "./entity-id";
export { TICKS_PER_DAY, TICKS_PER_SECOND, isSafeTick, requireSafeTick } from "./time";
export type {
  HeadlessCommandInput,
  HeadlessQueuedCommand,
  HeadlessRunnerSnapshot,
  HeadlessRunSummary,
  HeadlessRunnerOptions,
  HeadlessRunnerState,
  QueueCommandResult,
} from "./runner";
export type {
  QueueStructuralCommandResult,
  StructuralCommandKind,
  StructuralCommandReason,
  StructuralCommandResult,
  StructuralCommandResultView,
  StructuralCommitReport,
} from "./structural-commands";
export type {
  NamedRandomStreamsOptions,
  RandomStreamSnapshot,
  RandomStreamsSnapshot,
} from "./deterministic-rng";
export type { RunnerSpeed, Tick } from "./time";
export type {
  ReplayCheckpoint,
  ReplayComparisonResult,
  ReplayDivergence,
  ReplayDivergenceReason,
} from "./replay-diagnostics";
export type {
  CanonicalCommandEntry,
  CanonicalWorldField,
  CanonicalWorldHashInput,
} from "./world-hash";
export type {
  MapCellReadResult,
  MapCellIndexReadResult,
  MapCellUpdate,
  MapCellUpdateResult,
  MapCellView,
  MapDirtyProcessResult,
  MapGridOptions,
  MapGridReason,
  MapGridSnapshot,
  MapMovementResult,
} from "./map-grid";
export type {
  RegionGraphBasis,
  RegionRoomCellBasis,
  RegionRoomMarkResult,
  RegionRoomMetrics,
  RegionRoomMutationResult,
  RegionRoomProcessResult,
  RegionRoomReason,
  RegionRoomSnapshot,
} from "./region-room-rebuild";
export type {
  LocationCleanupReason,
  LocationDestroyResult,
  LocationKind,
  LocationLifecycleHooks,
  LocationMutationResult,
  LocationReadResult,
  LocationStoreMetrics,
  LocationStoreOptions,
  LocationStoreReason,
  LocationView,
} from "./location-store";
export type {
  ReservationAcquireResult,
  ReservationChannel,
  ReservationChannelCode,
  ReservationClaimRequest,
  ReservationLedgerMetrics,
  ReservationLedgerOptions,
  ReservationLedgerSnapshot,
  ReservationReason,
  ReservationRecordSnapshot,
  ReservationRecordView,
  ReservationReleaseResult,
  ReservationTransactionRequest,
} from "./reservation-ledger";
export type {
  SpatialIndexMetrics,
  SpatialIndexMutationResult,
  SpatialIndexOptions,
  SpatialIndexQueryResult,
  SpatialIndexReason,
} from "./spatial-index";

export const SIM_CORE_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-core",
  "package",
);

export const SIM_CORE_ALLOWED_INPUTS: readonly string[] = ["@wuming-town/content-schema"];
