import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
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

export const SIM_CORE_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-core",
  "package",
);

export const SIM_CORE_ALLOWED_INPUTS: readonly string[] = ["@wuming-town/content-schema"];
