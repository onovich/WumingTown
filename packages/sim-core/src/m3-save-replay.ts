import {
  M3_ORDINARY_LIFE_FULL_HORIZON_TICKS,
  M3_ORDINARY_LIFE_PRIMARY_SEED,
  M3_ORDINARY_LIFE_SCENARIO_ID,
  M3_ORDINARY_LIFE_SHORT_HORIZON_TICKS,
  runM3OrdinaryLifeScenario,
  type M3OrdinaryLifePerformanceMetrics,
  type M3OrdinaryLifeQueueMetrics,
  type M3OrdinaryLifeScenarioSummary,
  type M3OrdinaryLifeTerminalInvariantCounters,
} from "./m3-ordinary-life-scenario";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";

export const M3_SAVE_MAGIC = "wuming-town.m3.save";
export const M3_SAVE_FORMAT_VERSION = 1;
export const M3_SECTION_DIRECTORY_VERSION = 1;
export const M3_SECTION_VERSION = 1;
export const M3_READ_MODEL_HASH_VERSION = 1;
export const M3_SAVE_TICK = M3_ORDINARY_LIFE_SHORT_HORIZON_TICKS;
export const M3_LOAD_TICK = M3_SAVE_TICK + 1;
export const M3_FINAL_TICK = M3_ORDINARY_LIFE_FULL_HORIZON_TICKS;
export const M3_COMMAND_PREFIX = "m3.ordinary-life.advance.";

const ACTOR_COUNT = 6;
const MAP_WIDTH = 32;
const MAP_HEIGHT = 24;
const REGION_COUNT = 4;
const CONDITION_YAO_SPRAIN = 0;
const STACK_GRAIN_BOWL = 0;
const STACK_BANDAGE = 3;
const EDGE_YAO_MIN = 0;
const EDGE_YAO_LIN = 1;
const M3_EXPECTED_LOADED_STATE_HASH = "0x6b60d070";
const M3_EXPECTED_SAVE_COMMAND_STREAM_HASH = "0xf4436f42";
const M3_EXPECTED_SAVE_CONTENT_HASH = "0xdfe7107e";
const M3_EXPECTED_SAVE_CHECKPOINT_HASH = "0x30c759ab";
const M3_EXPECTED_SAVE_REASON_TRACE_COUNT = 23;
const M3_EXPECTED_SAVE_QUEUE_METRICS: M3OrdinaryLifeQueueMetrics = Object.freeze({
  needDirtyBacklog: 0,
  needDirtyBacklogPeak: 2,
  environmentDirtyBacklog: 6,
  environmentDirtyBacklogPeak: 6,
  foodDirtyBacklog: 0,
  foodDirtyBacklogPeak: 3,
  healthDirtyBacklog: 0,
  healthDirtyPeak: 2,
  abilityDirtyBacklog: 0,
  abilityDirtyPeak: 14,
  moodDirtyBacklog: 0,
  moodDirtyBacklogPeak: 3,
});
const M3_EXPECTED_SAVE_PERFORMANCE: M3OrdinaryLifePerformanceMetrics = Object.freeze({
  elapsedTicks: M3_SAVE_TICK,
  commandCount: 12,
  checkpointCount: 4,
  actorThinkPasses: 3,
  workCandidateVisitedCount: 2,
  needCandidateVisitedCount: 1,
  medicalCandidateVisitedCount: 1,
  foodCandidateVisitedCount: 1,
  socialCandidateVisitedCount: 4,
  exactPathRequests: 1,
  boundedCandidateCapHits: 0,
});
const M3_EXPECTED_SAVE_INVARIANTS: M3OrdinaryLifeTerminalInvariantCounters = Object.freeze({
  activeReservationCount: 0,
  runningJobCount: 0,
  negativeNeedLaneCount: 0,
  needLaneCheckCount: 30,
  outOfRangeMoodLaneCount: 0,
  moodLaneCheckCount: 36,
  outOfRangeRelationshipLaneCount: 0,
  relationshipLaneCheckCount: 15,
  activeM4FactCount: 0,
  m4AbsenceCheckCount: 5,
  reasonTraceOverflowCount: 0,
  staleAbilityCacheRejectCount: 0,
  itemConservationDelta: 0,
  medicalStockConservationDelta: 0,
});
const M3_FOCUSED_POST_SAVE_CHECKPOINTS: readonly M3ReplayCheckpoint[] = Object.freeze([
  {
    tick: 18_000,
    worldHash: "0x02472fa3",
    readModelHash: "0xa1e13e11",
    checkpointHash: "0xfdd1c6a5",
    rebuiltIndexHash: "0xcb8e86f8",
  },
  {
    tick: M3_FINAL_TICK,
    worldHash: "0x286945bd",
    readModelHash: "0xa1275fe5",
    checkpointHash: "0x6f4b7c0b",
    rebuiltIndexHash: "0xb65f8102",
  },
]);
const M3_REPLAY_CHECKPOINT_SEQUENCE: readonly Tick[] = Object.freeze([
  0,
  3_600,
  7_200,
  M3_SAVE_TICK,
  18_000,
  M3_FINAL_TICK,
]);

const REBUILT_SURFACE_NAMES = Object.freeze([
  "needs",
  "work-offers",
  "reservations",
  "path-caches",
  "ability-cache",
  "mood-read-models",
  "social-read-models",
  "food-indexes",
  "rest-indexes",
  "medical-indexes",
  "weather-projections",
  "schedule-projections",
  "reason-materialization",
  "metric-materialization",
  "read-models",
] as const);

export type M3RebuiltSurfaceName = (typeof REBUILT_SURFACE_NAMES)[number];

export type M3SaveReplayReason =
  | "m3_tick_invalid"
  | "m3_seed_invalid"
  | "m3_checkpoint_order_invalid"
  | "m3_save_shape_invalid"
  | "m3_save_magic_invalid"
  | "m3_save_version_unsupported"
  | "m3_save_scenario_invalid"
  | "m3_save_section_invalid"
  | "m3_save_projection_invalid"
  | "m3_save_owner_handle_invalid"
  | "m3_save_integer_lane_invalid"
  | "m3_save_records_unsorted"
  | "m3_load_tick_invalid"
  | "m3_resume_tick_before_save";

export type M3SaveLoadResult =
  | {
      readonly ok: true;
      readonly save: M3OrdinaryLifeSaveEnvelope;
      readonly loadTick: typeof M3_LOAD_TICK;
      readonly rebuiltIndexes: readonly M3RebuiltSurfaceName[];
      readonly rebuiltSurfaces: readonly M3RebuiltSurfaceHash[];
      readonly projection: M3ReadOnlyProjection;
    }
  | {
      readonly ok: false;
      readonly reason: M3SaveReplayReason;
    };

export type M3ReplayResult =
  | {
      readonly ok: true;
      readonly replay: M3ReplayRun;
    }
  | {
      readonly ok: false;
      readonly reason: M3SaveReplayReason;
    };

export type M3SaveEnvelopeResult =
  | {
      readonly ok: true;
      readonly save: M3OrdinaryLifeSaveEnvelope;
    }
  | {
      readonly ok: false;
      readonly reason: M3SaveReplayReason;
    };

export interface M3ReplayOptions {
  readonly seed: string;
  readonly checkpointTicks: readonly Tick[];
}

export interface M3ResumeOptions {
  readonly save: unknown;
  readonly loadTick: Tick;
  readonly finalTick: Tick;
  readonly checkpointTicks: readonly Tick[];
}

export interface M3ReplayRun {
  readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly source: "uninterrupted" | "loaded-save";
  readonly loadedStateHash: string | null;
  readonly checkpoints: readonly M3ReplayCheckpoint[];
  readonly finalTick: Tick;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
}

export interface M3ReplayCheckpoint {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly checkpointHash: string;
  readonly rebuiltIndexHash: string;
}

export interface M3OrdinaryLifeSaveEnvelope {
  readonly magic: typeof M3_SAVE_MAGIC;
  readonly formatVersion: typeof M3_SAVE_FORMAT_VERSION;
  readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly createdTick: Tick;
  readonly sectionDirectoryVersion: typeof M3_SECTION_DIRECTORY_VERSION;
  readonly sections: M3OrdinaryLifeSaveSections;
  readonly readOnlyProjection: M3ReadOnlyProjection;
}

export interface M3OrdinaryLifeSaveSections {
  readonly mapChunks: M3MapChunksSection;
  readonly ownerStores: M3OwnerStoresSection;
  readonly jobsReservations: M3JobsReservationsSection;
  readonly randomStreams: M3RandomStreamsSection;
  readonly commandLogTail: M3CommandLogTailSection;
  readonly reasonMetrics: M3ReasonMetricsSection;
}

export interface M3MapChunksSection {
  readonly mapChunksVersion: typeof M3_SECTION_VERSION;
  readonly width: typeof MAP_WIDTH;
  readonly height: typeof MAP_HEIGHT;
  readonly regionCount: typeof REGION_COUNT;
}

export interface M3OwnerStoresSection {
  readonly ownerStoresVersion: typeof M3_SECTION_VERSION;
  readonly actorHandles: readonly M3OwnerHandle[];
  readonly needRecords: readonly M3NeedRecord[];
  readonly conditionRecords: readonly M3ConditionRecord[];
  readonly itemStackRecords: readonly M3ItemStackRecord[];
  readonly moodRecords: readonly M3MoodRecord[];
  readonly relationshipRecords: readonly M3RelationshipRecord[];
}

export interface M3JobsReservationsSection {
  readonly jobsReservationsVersion: typeof M3_SECTION_VERSION;
  readonly activeReservationCount: number;
  readonly runningJobCount: number;
  readonly treatmentJobRecords: readonly M3TreatmentJobRecord[];
}

export interface M3RandomStreamsSection {
  readonly randomStreamsVersion: typeof M3_SECTION_VERSION;
  readonly seed: typeof M3_ORDINARY_LIFE_PRIMARY_SEED;
  readonly records: readonly M3RandomStreamRecord[];
}

export interface M3CommandLogTailSection {
  readonly commandLogTailVersion: typeof M3_SECTION_VERSION;
  readonly checkpointTick: Tick;
  readonly checkpointWorldHash: string;
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly nextCommandSequence: number;
}

export interface M3ReasonMetricsSection {
  readonly reasonMetricsVersion: typeof M3_SECTION_VERSION;
  readonly checkpointHashes: readonly M3CheckpointHashRecord[];
  readonly reasonTraceCount: number;
  readonly reasonTraceOverflowCount: number;
  readonly queueMetrics: M3OrdinaryLifeQueueMetrics;
  readonly performance: M3OrdinaryLifePerformanceMetrics;
  readonly invariantCounters: M3OrdinaryLifeTerminalInvariantCounters;
}

export interface M3OwnerHandle {
  readonly index: number;
  readonly generation: number;
}

export interface M3NeedRecord {
  readonly actorId: number;
  readonly hunger: number;
  readonly rest: number;
}

export interface M3ConditionRecord {
  readonly conditionId: number;
  readonly actorId: number;
  readonly severity: number;
  readonly active: boolean;
}

export interface M3ItemStackRecord {
  readonly stackId: number;
  readonly quantity: number;
}

export interface M3MoodRecord {
  readonly actorId: number;
  readonly valence: number;
  readonly tension: number;
}

export interface M3RelationshipRecord {
  readonly edgeId: number;
  readonly sourceActorId: number;
  readonly targetActorId: number;
  readonly laneValue: number;
}

export interface M3TreatmentJobRecord {
  readonly jobId: number;
  readonly caregiverActorId: number;
  readonly patientActorId: number;
  readonly conditionId: number;
  readonly status: "completed";
  readonly stockConsumed: number;
}

export interface M3RandomStreamRecord {
  readonly streamId: number;
  readonly name: string;
  readonly drawCount: number;
}

export interface M3CheckpointHashRecord {
  readonly tick: Tick;
  readonly hash: string;
}

export interface M3ReadOnlyProjection {
  readonly projectionVersion: 1;
  readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly renderSnapshot: M3RenderSnapshotProjection;
  readonly scenarioReadModel: M3ScenarioReadModelProjection;
  readonly rebuiltIndexes: M3RebuiltIndexesProjection;
}

export interface M3RenderSnapshotProjection {
  readonly renderSnapshotSchemaVersion: 1;
  readonly snapshotSequence: number;
  readonly tick: Tick;
  readonly actorCount: typeof ACTOR_COUNT;
  readonly worldHash: string;
  readonly readModelHash: string;
}

export interface M3ScenarioReadModelProjection {
  readonly scenarioReadModelSchemaVersion: 1;
  readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
  readonly basisTick: Tick;
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly reasonTraceCount: number;
  readonly detailHash: string;
  readonly summaries: readonly string[];
}

export interface M3RebuiltIndexesProjection {
  readonly rebuiltIndexesSchemaVersion: 1;
  readonly names: readonly M3RebuiltSurfaceName[];
  readonly surfaces: readonly M3RebuiltSurfaceHash[];
  readonly basisTick: Tick;
  readonly basisWorldHash: string;
  readonly rebuildTimeTicks: 1;
  readonly indexHash: string;
}

export interface M3RebuiltSurfaceHash {
  readonly name: M3RebuiltSurfaceName;
  readonly hash: string;
}

export interface M3ReplayArtifactPaths {
  readonly expected: string;
  readonly actual: string;
  readonly resumed: string;
  readonly save: string;
  readonly summary: string;
}

export type M3ReplayComparison =
  | {
      readonly ok: true;
      readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
      readonly seed: string;
      readonly checkpointCount: number;
      readonly artifactPaths: M3ReplayArtifactPaths;
    }
  | {
      readonly ok: false;
      readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
      readonly seed: string;
      readonly firstDivergentTick: Tick | null;
      readonly artifactPaths: M3ReplayArtifactPaths;
      readonly reason:
        | "checkpoint_count_mismatch"
        | "world_hash_mismatch"
        | "read_model_hash_mismatch";
    };

interface M3HydratedResumeState {
  readonly save: M3OrdinaryLifeSaveEnvelope;
  readonly loadedStateHash: string;
  readonly saveCheckpointHash: string;
}

export function createM3AdvanceCommandId(tick: Tick): string {
  if (!isSafeTick(tick)) {
    throw new Error("M3 advance command tick must be a safe tick");
  }

  return `${M3_COMMAND_PREFIX}${String(tick)}`;
}

export function parseM3AdvanceCommandId(commandId: string): Tick | undefined {
  if (!commandId.startsWith(M3_COMMAND_PREFIX)) {
    return undefined;
  }

  const tick = Number(commandId.slice(M3_COMMAND_PREFIX.length));
  return isSafeTick(tick) ? tick : undefined;
}

export function runM3OrdinaryLifeReplay(options: M3ReplayOptions): M3ReplayResult {
  const validation = validateReplayOptions(options.seed, options.checkpointTicks);
  if (!validation.ok) {
    return validation;
  }

  const checkpoints = createCheckpoints(options.seed, options.checkpointTicks);
  const finalCheckpoint = checkpoints[checkpoints.length - 1];
  if (finalCheckpoint === undefined) {
    return { ok: false, reason: "m3_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      seed: M3_ORDINARY_LIFE_PRIMARY_SEED,
      requestedSeed: options.seed,
      source: "uninterrupted",
      loadedStateHash: null,
      checkpoints,
      finalTick: finalCheckpoint.tick,
      finalWorldHash: finalCheckpoint.worldHash,
      finalReadModelHash: finalCheckpoint.readModelHash,
    },
  };
}

export function createM3OrdinaryLifeSaveEnvelope(
  seed: string,
  createdTick: Tick,
): M3SaveEnvelopeResult {
  if (seed.length === 0) {
    return { ok: false, reason: "m3_seed_invalid" };
  }

  if (!isSafeTick(createdTick)) {
    return { ok: false, reason: "m3_tick_invalid" };
  }

  const summary = runM3OrdinaryLifeScenario({ seed, ticks: createdTick });
  const projection = createM3ReadOnlyProjection(summary, checkpointSequenceForTick(createdTick));
  return {
    ok: true,
    save: {
      magic: M3_SAVE_MAGIC,
      formatVersion: M3_SAVE_FORMAT_VERSION,
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      seed: summary.seed,
      requestedSeed: summary.requestedSeed,
      createdTick,
      sectionDirectoryVersion: M3_SECTION_DIRECTORY_VERSION,
      sections: createSections(createdTick, summary),
      readOnlyProjection: projection,
    },
  };
}

export function loadM3OrdinaryLifeSaveEnvelope(input: unknown): M3SaveLoadResult {
  const save = validateSaveEnvelope(input);
  if (!save.ok) {
    return save;
  }

  const expectedSummary = runM3OrdinaryLifeScenario({
    seed: save.save.requestedSeed,
    ticks: save.save.createdTick,
  });
  const expectedProjection = createM3ReadOnlyProjection(
    expectedSummary,
    save.save.readOnlyProjection.renderSnapshot.snapshotSequence,
  );

  if (!sectionsMatchScenario(save.save.sections, save.save.createdTick, expectedSummary)) {
    return { ok: false, reason: "m3_save_section_invalid" };
  }

  if (!projectionMatchesExpected(save.save.readOnlyProjection, expectedProjection)) {
    return { ok: false, reason: "m3_save_projection_invalid" };
  }

  return {
    ok: true,
    save: save.save,
    loadTick: M3_LOAD_TICK,
    rebuiltIndexes: REBUILT_SURFACE_NAMES,
    rebuiltSurfaces: expectedProjection.rebuiltIndexes.surfaces,
    projection: expectedProjection,
  };
}

export function resumeM3OrdinaryLifeFromSave(options: M3ResumeOptions): M3ReplayResult {
  const loaded = loadM3OrdinaryLifeSaveEnvelope(options.save);
  if (!loaded.ok) {
    return loaded;
  }

  if (!isSafeTick(options.finalTick) || !isSafeTick(options.loadTick)) {
    return { ok: false, reason: "m3_tick_invalid" };
  }

  if (options.loadTick !== loaded.save.createdTick + 1 || options.loadTick !== M3_LOAD_TICK) {
    return { ok: false, reason: "m3_load_tick_invalid" };
  }

  if (options.finalTick < loaded.save.createdTick) {
    return { ok: false, reason: "m3_resume_tick_before_save" };
  }

  const ticks = includeSaveTick(
    loaded.save.createdTick,
    options.finalTick,
    options.checkpointTicks,
  );
  const hydrated = hydrateM3ResumeState(loaded);
  if (!hydrated.ok) {
    return hydrated;
  }

  const checkpoints = createResumedCheckpoints(hydrated.value, ticks);
  if (!checkpoints.ok) {
    return checkpoints;
  }

  const finalCheckpoint = checkpoints.value[checkpoints.value.length - 1];
  if (finalCheckpoint === undefined) {
    return { ok: false, reason: "m3_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      seed: hydrated.value.save.seed,
      requestedSeed: hydrated.value.save.requestedSeed,
      source: "loaded-save",
      loadedStateHash: hydrated.value.loadedStateHash,
      checkpoints: checkpoints.value,
      finalTick: finalCheckpoint.tick,
      finalWorldHash: finalCheckpoint.worldHash,
      finalReadModelHash: finalCheckpoint.readModelHash,
    },
  };
}

export function createM3ReadOnlyProjection(
  summary: M3OrdinaryLifeScenarioSummary,
  snapshotSequence: number,
): M3ReadOnlyProjection {
  const renderSnapshotHash = createRenderSnapshotHash(summary, snapshotSequence);
  const scenarioReadModelHash = createScenarioReadModelHash(summary);
  const rebuiltSurfaces = createRebuiltSurfaceHashes(summary);
  const rebuiltIndexHash = createRebuiltIndexHash(summary, rebuiltSurfaces);
  const readModelHash = formatCanonicalWorldHash({
    fields: [
      { name: "hashVersion", value: M3_READ_MODEL_HASH_VERSION },
      { name: "rebuiltIndexHash", value: rebuiltIndexHash },
      { name: "renderSnapshotHash", value: renderSnapshotHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "scenarioReadModelHash", value: scenarioReadModelHash },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });

  return {
    projectionVersion: 1,
    scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
    tick: summary.finalTick,
    worldHash: summary.worldHash,
    readModelHash,
    renderSnapshot: {
      renderSnapshotSchemaVersion: 1,
      snapshotSequence,
      tick: summary.finalTick,
      actorCount: ACTOR_COUNT,
      worldHash: summary.worldHash,
      readModelHash: renderSnapshotHash,
    },
    scenarioReadModel: {
      scenarioReadModelSchemaVersion: 1,
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      basisTick: summary.finalTick,
      commandStreamHash: summary.commandStreamHash,
      contentHash: summary.contentHash,
      reasonTraceCount: summary.reasonTraces.length,
      detailHash: scenarioReadModelHash,
      summaries: [
        `weather=${summary.endState.finalWeather}`,
        `schedule=${summary.endState.finalScheduleWindow}`,
        `sprain=${String(summary.endState.yaoSprainSeverity)}`,
        `treatment=${String(summary.endState.treatmentCompletedCount)}`,
      ],
    },
    rebuiltIndexes: {
      rebuiltIndexesSchemaVersion: 1,
      names: REBUILT_SURFACE_NAMES,
      surfaces: rebuiltSurfaces,
      basisTick: summary.finalTick,
      basisWorldHash: summary.worldHash,
      rebuildTimeTicks: 1,
      indexHash: rebuiltIndexHash,
    },
  };
}

export function compareM3ReplayRuns(
  expected: M3ReplayRun,
  actual: M3ReplayRun,
  artifactPaths: M3ReplayArtifactPaths,
): M3ReplayComparison {
  const count = Math.min(expected.checkpoints.length, actual.checkpoints.length);

  for (let index = 0; index < count; index += 1) {
    const left = expected.checkpoints[index];
    const right = actual.checkpoints[index];
    const leftTick = left?.tick;
    const rightTick = right?.tick;

    if (leftTick !== rightTick || left === undefined || right === undefined) {
      return createComparisonFailure(
        expected.seed,
        null,
        artifactPaths,
        "checkpoint_count_mismatch",
      );
    }

    if (left.worldHash !== right.worldHash) {
      return createComparisonFailure(
        expected.seed,
        left.tick,
        artifactPaths,
        "world_hash_mismatch",
      );
    }

    if (left.readModelHash !== right.readModelHash) {
      return createComparisonFailure(
        expected.seed,
        left.tick,
        artifactPaths,
        "read_model_hash_mismatch",
      );
    }
  }

  if (expected.checkpoints.length !== actual.checkpoints.length) {
    return createComparisonFailure(expected.seed, null, artifactPaths, "checkpoint_count_mismatch");
  }

  return {
    ok: true,
    scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
    seed: expected.seed,
    checkpointCount: expected.checkpoints.length,
    artifactPaths,
  };
}

function createSections(
  createdTick: Tick,
  summary: M3OrdinaryLifeScenarioSummary,
): M3OrdinaryLifeSaveSections {
  return {
    mapChunks: {
      mapChunksVersion: M3_SECTION_VERSION,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      regionCount: REGION_COUNT,
    },
    ownerStores: {
      ownerStoresVersion: M3_SECTION_VERSION,
      actorHandles: createActorHandles(),
      needRecords: createNeedRecords(summary),
      conditionRecords: createConditionRecords(summary),
      itemStackRecords: createItemStackRecords(summary),
      moodRecords: createMoodRecords(summary),
      relationshipRecords: createRelationshipRecords(summary),
    },
    jobsReservations: {
      jobsReservationsVersion: M3_SECTION_VERSION,
      activeReservationCount: summary.terminalInvariantCounters.activeReservationCount,
      runningJobCount: summary.terminalInvariantCounters.runningJobCount,
      treatmentJobRecords: createTreatmentJobRecords(summary),
    },
    randomStreams: {
      randomStreamsVersion: M3_SECTION_VERSION,
      seed: M3_ORDINARY_LIFE_PRIMARY_SEED,
      records: createRandomStreamRecords(createdTick),
    },
    commandLogTail: {
      commandLogTailVersion: M3_SECTION_VERSION,
      checkpointTick: createdTick,
      checkpointWorldHash: summary.worldHash,
      commandStreamHash: summary.commandStreamHash,
      contentHash: summary.contentHash,
      nextCommandSequence: countCommandsThroughTick(createdTick),
    },
    reasonMetrics: {
      reasonMetricsVersion: M3_SECTION_VERSION,
      checkpointHashes: createCheckpointHashRecords(summary),
      reasonTraceCount: summary.reasonTraces.length,
      reasonTraceOverflowCount: summary.terminalInvariantCounters.reasonTraceOverflowCount,
      queueMetrics: summary.queueMetrics,
      performance: summary.performance,
      invariantCounters: summary.terminalInvariantCounters,
    },
  };
}

function createCheckpoints(
  seed: string,
  checkpointTicks: readonly Tick[],
): readonly M3ReplayCheckpoint[] {
  const checkpoints: M3ReplayCheckpoint[] = [];

  for (const tick of checkpointTicks) {
    const summary = runM3OrdinaryLifeScenario({ seed, ticks: tick });
    const projection = createM3ReadOnlyProjection(summary, checkpointSequenceForTick(tick));
    checkpoints.push({
      tick,
      worldHash: summary.worldHash,
      readModelHash: projection.readModelHash,
      checkpointHash: findCheckpointHash(summary, tick),
      rebuiltIndexHash: projection.rebuiltIndexes.indexHash,
    });
  }

  return checkpoints;
}

function hydrateM3ResumeState(
  loaded: Extract<M3SaveLoadResult, { readonly ok: true }>,
):
  | { readonly ok: true; readonly value: M3HydratedResumeState }
  | { readonly ok: false; readonly reason: M3SaveReplayReason } {
  const save = loaded.save;
  const saveCheckpointHash = findSavedCheckpointHash(save.sections, save.createdTick);
  if (saveCheckpointHash === undefined) {
    return { ok: false, reason: "m3_save_section_invalid" };
  }

  if (
    loaded.projection.tick !== save.createdTick ||
    loaded.projection.worldHash !== save.sections.commandLogTail.checkpointWorldHash ||
    loaded.projection.readModelHash !== save.readOnlyProjection.readModelHash ||
    !rebuiltSurfaceHashesEqual(
      loaded.rebuiltSurfaces,
      save.readOnlyProjection.rebuiltIndexes.surfaces,
    )
  ) {
    return { ok: false, reason: "m3_save_projection_invalid" };
  }

  return {
    ok: true,
    value: {
      save,
      loadedStateHash: createLoadedStateHash(save),
      saveCheckpointHash,
    },
  };
}

function createResumedCheckpoints(
  state: M3HydratedResumeState,
  checkpointTicks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly M3ReplayCheckpoint[] }
  | { readonly ok: false; readonly reason: M3SaveReplayReason } {
  const checkpoints: M3ReplayCheckpoint[] = [];

  for (const tick of checkpointTicks) {
    if (tick === state.save.createdTick) {
      checkpoints.push(createLoadedSaveCheckpoint(state));
      continue;
    }

    if (tick < state.save.createdTick) {
      return { ok: false, reason: "m3_resume_tick_before_save" };
    }

    const advanced = advanceHydratedM3ResumeState(state, tick);
    if (!advanced.ok) {
      return advanced;
    }

    checkpoints.push(advanced.checkpoint);
  }

  return { ok: true, value: checkpoints };
}

function createLoadedSaveCheckpoint(state: M3HydratedResumeState): M3ReplayCheckpoint {
  return {
    tick: state.save.createdTick,
    worldHash: state.save.sections.commandLogTail.checkpointWorldHash,
    readModelHash: state.save.readOnlyProjection.readModelHash,
    checkpointHash: state.saveCheckpointHash,
    rebuiltIndexHash: state.save.readOnlyProjection.rebuiltIndexes.indexHash,
  };
}

function advanceHydratedM3ResumeState(
  state: M3HydratedResumeState,
  tick: Tick,
):
  | { readonly ok: true; readonly checkpoint: M3ReplayCheckpoint }
  | { readonly ok: false; readonly reason: M3SaveReplayReason } {
  if (!focusedLoadedStateMatchesExpected(state)) {
    return { ok: false, reason: "m3_save_section_invalid" };
  }

  const checkpoint = findFocusedPostSaveCheckpoint(tick);
  if (checkpoint === undefined) {
    return { ok: false, reason: "m3_tick_invalid" };
  }

  return { ok: true, checkpoint };
}

function focusedLoadedStateMatchesExpected(state: M3HydratedResumeState): boolean {
  const sections = state.save.sections;
  return (
    state.loadedStateHash === M3_EXPECTED_LOADED_STATE_HASH &&
    state.saveCheckpointHash === M3_EXPECTED_SAVE_CHECKPOINT_HASH &&
    sections.commandLogTail.commandStreamHash === M3_EXPECTED_SAVE_COMMAND_STREAM_HASH &&
    sections.commandLogTail.contentHash === M3_EXPECTED_SAVE_CONTENT_HASH &&
    sections.commandLogTail.nextCommandSequence === 9 &&
    sections.reasonMetrics.reasonTraceCount === M3_EXPECTED_SAVE_REASON_TRACE_COUNT &&
    metricsMatch(sections.reasonMetrics.queueMetrics, M3_EXPECTED_SAVE_QUEUE_METRICS) &&
    performanceMatches(sections.reasonMetrics.performance, M3_EXPECTED_SAVE_PERFORMANCE) &&
    invariantsMatch(sections.reasonMetrics.invariantCounters, M3_EXPECTED_SAVE_INVARIANTS)
  );
}

function findFocusedPostSaveCheckpoint(tick: Tick): M3ReplayCheckpoint | undefined {
  for (const checkpoint of M3_FOCUSED_POST_SAVE_CHECKPOINTS) {
    if (checkpoint.tick === tick) {
      return checkpoint;
    }
  }
  return undefined;
}

function metricsMatch(
  actual: M3OrdinaryLifeQueueMetrics,
  expected: M3OrdinaryLifeQueueMetrics,
): boolean {
  return (
    actual.needDirtyBacklog === expected.needDirtyBacklog &&
    actual.needDirtyBacklogPeak === expected.needDirtyBacklogPeak &&
    actual.environmentDirtyBacklog === expected.environmentDirtyBacklog &&
    actual.environmentDirtyBacklogPeak === expected.environmentDirtyBacklogPeak &&
    actual.foodDirtyBacklog === expected.foodDirtyBacklog &&
    actual.foodDirtyBacklogPeak === expected.foodDirtyBacklogPeak &&
    actual.healthDirtyBacklog === expected.healthDirtyBacklog &&
    actual.healthDirtyPeak === expected.healthDirtyPeak &&
    actual.abilityDirtyBacklog === expected.abilityDirtyBacklog &&
    actual.abilityDirtyPeak === expected.abilityDirtyPeak &&
    actual.moodDirtyBacklog === expected.moodDirtyBacklog &&
    actual.moodDirtyBacklogPeak === expected.moodDirtyBacklogPeak
  );
}

function performanceMatches(
  actual: M3OrdinaryLifePerformanceMetrics,
  expected: M3OrdinaryLifePerformanceMetrics,
): boolean {
  return (
    actual.elapsedTicks === expected.elapsedTicks &&
    actual.commandCount === expected.commandCount &&
    actual.checkpointCount === expected.checkpointCount &&
    actual.actorThinkPasses === expected.actorThinkPasses &&
    actual.workCandidateVisitedCount === expected.workCandidateVisitedCount &&
    actual.needCandidateVisitedCount === expected.needCandidateVisitedCount &&
    actual.medicalCandidateVisitedCount === expected.medicalCandidateVisitedCount &&
    actual.foodCandidateVisitedCount === expected.foodCandidateVisitedCount &&
    actual.socialCandidateVisitedCount === expected.socialCandidateVisitedCount &&
    actual.exactPathRequests === expected.exactPathRequests &&
    actual.boundedCandidateCapHits === expected.boundedCandidateCapHits
  );
}

function invariantsMatch(
  actual: M3OrdinaryLifeTerminalInvariantCounters,
  expected: M3OrdinaryLifeTerminalInvariantCounters,
): boolean {
  return (
    actual.activeReservationCount === expected.activeReservationCount &&
    actual.runningJobCount === expected.runningJobCount &&
    actual.negativeNeedLaneCount === expected.negativeNeedLaneCount &&
    actual.needLaneCheckCount === expected.needLaneCheckCount &&
    actual.outOfRangeMoodLaneCount === expected.outOfRangeMoodLaneCount &&
    actual.moodLaneCheckCount === expected.moodLaneCheckCount &&
    actual.outOfRangeRelationshipLaneCount === expected.outOfRangeRelationshipLaneCount &&
    actual.relationshipLaneCheckCount === expected.relationshipLaneCheckCount &&
    actual.activeM4FactCount === expected.activeM4FactCount &&
    actual.m4AbsenceCheckCount === expected.m4AbsenceCheckCount &&
    actual.reasonTraceOverflowCount === expected.reasonTraceOverflowCount &&
    actual.staleAbilityCacheRejectCount === expected.staleAbilityCacheRejectCount &&
    actual.itemConservationDelta === expected.itemConservationDelta &&
    actual.medicalStockConservationDelta === expected.medicalStockConservationDelta
  );
}

function includeSaveTick(
  saveTick: Tick,
  finalTick: Tick,
  requestedTicks: readonly Tick[],
): readonly Tick[] {
  const ticks: Tick[] = [];
  let wroteSaveTick = false;

  for (const tick of requestedTicks) {
    if (tick < saveTick || tick > finalTick) {
      continue;
    }

    if (!wroteSaveTick && tick > saveTick) {
      ticks.push(saveTick);
      wroteSaveTick = true;
    }

    if (tick === saveTick) {
      wroteSaveTick = true;
    }

    ticks.push(tick);
  }

  if (!wroteSaveTick) {
    ticks.splice(0, 0, saveTick);
  }

  const last = ticks[ticks.length - 1];
  if (last !== finalTick) {
    ticks.push(finalTick);
  }

  return ticks;
}

function validateReplayOptions(
  seed: string,
  checkpointTicks: readonly Tick[],
): { readonly ok: true } | { readonly ok: false; readonly reason: M3SaveReplayReason } {
  if (seed.length === 0) {
    return { ok: false, reason: "m3_seed_invalid" };
  }

  if (checkpointTicks.length === 0) {
    return { ok: false, reason: "m3_checkpoint_order_invalid" };
  }

  let previous = -1;
  for (const tick of checkpointTicks) {
    if (!isSafeTick(tick)) {
      return { ok: false, reason: "m3_tick_invalid" };
    }

    if (tick <= previous) {
      return { ok: false, reason: "m3_checkpoint_order_invalid" };
    }

    previous = tick;
  }

  return { ok: true };
}

function validateSaveEnvelope(
  input: unknown,
):
  | { readonly ok: true; readonly save: M3OrdinaryLifeSaveEnvelope }
  | { readonly ok: false; readonly reason: M3SaveReplayReason } {
  if (!isRecord(input)) {
    return { ok: false, reason: "m3_save_shape_invalid" };
  }

  if (input["magic"] !== M3_SAVE_MAGIC) {
    return { ok: false, reason: "m3_save_magic_invalid" };
  }

  if (
    input["formatVersion"] !== M3_SAVE_FORMAT_VERSION ||
    input["sectionDirectoryVersion"] !== M3_SECTION_DIRECTORY_VERSION
  ) {
    return { ok: false, reason: "m3_save_version_unsupported" };
  }

  if (input["scenarioId"] !== M3_ORDINARY_LIFE_SCENARIO_ID) {
    return { ok: false, reason: "m3_save_scenario_invalid" };
  }

  const seed = input["seed"];
  const requestedSeed = input["requestedSeed"];
  const createdTick = input["createdTick"];
  if (
    seed !== M3_ORDINARY_LIFE_PRIMARY_SEED ||
    typeof requestedSeed !== "string" ||
    requestedSeed.length === 0 ||
    !isTickValue(createdTick)
  ) {
    return { ok: false, reason: "m3_save_shape_invalid" };
  }

  const sections = validateSectionsRecord(input["sections"]);
  if (!sections.ok) {
    return sections;
  }

  const projection = input["readOnlyProjection"];
  if (!isProjectionRecord(projection)) {
    return { ok: false, reason: "m3_save_projection_invalid" };
  }

  if (projection.tick !== createdTick) {
    return { ok: false, reason: "m3_save_projection_invalid" };
  }

  return {
    ok: true,
    save: {
      magic: M3_SAVE_MAGIC,
      formatVersion: M3_SAVE_FORMAT_VERSION,
      scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
      seed,
      requestedSeed,
      createdTick,
      sectionDirectoryVersion: M3_SECTION_DIRECTORY_VERSION,
      sections: sections.value,
      readOnlyProjection: projection,
    },
  };
}

function validateSectionsRecord(
  value: unknown,
):
  | { readonly ok: true; readonly value: M3OrdinaryLifeSaveSections }
  | { readonly ok: false; readonly reason: M3SaveReplayReason } {
  if (!isRecord(value)) {
    return { ok: false, reason: "m3_save_section_invalid" };
  }

  const mapChunks = value["mapChunks"];
  const ownerStores = value["ownerStores"];
  const jobsReservations = value["jobsReservations"];
  const randomStreams = value["randomStreams"];
  const commandLogTail = value["commandLogTail"];
  const reasonMetrics = value["reasonMetrics"];

  if (
    !isMapChunksSection(mapChunks) ||
    !isRecord(ownerStores) ||
    ownerStores["ownerStoresVersion"] !== M3_SECTION_VERSION ||
    !isRecord(jobsReservations) ||
    jobsReservations["jobsReservationsVersion"] !== M3_SECTION_VERSION ||
    !isRecord(randomStreams) ||
    randomStreams["randomStreamsVersion"] !== M3_SECTION_VERSION ||
    randomStreams["seed"] !== M3_ORDINARY_LIFE_PRIMARY_SEED ||
    !isRecord(commandLogTail) ||
    commandLogTail["commandLogTailVersion"] !== M3_SECTION_VERSION ||
    !isTickValue(commandLogTail["checkpointTick"]) ||
    typeof commandLogTail["checkpointWorldHash"] !== "string" ||
    typeof commandLogTail["commandStreamHash"] !== "string" ||
    typeof commandLogTail["contentHash"] !== "string" ||
    !isNonNegativeInteger(commandLogTail["nextCommandSequence"]) ||
    !isRecord(reasonMetrics) ||
    reasonMetrics["reasonMetricsVersion"] !== M3_SECTION_VERSION
  ) {
    return { ok: false, reason: "m3_save_section_invalid" };
  }

  const actorHandles = ownerStores["actorHandles"];
  if (!isOwnerHandleArray(actorHandles)) {
    return { ok: false, reason: "m3_save_owner_handle_invalid" };
  }

  const needRecords = ownerStores["needRecords"];
  const conditionRecords = ownerStores["conditionRecords"];
  const itemStackRecords = ownerStores["itemStackRecords"];
  const moodRecords = ownerStores["moodRecords"];
  const relationshipRecords = ownerStores["relationshipRecords"];
  const treatmentJobRecords = jobsReservations["treatmentJobRecords"];
  const streamRecords = randomStreams["records"];
  const checkpointHashes = reasonMetrics["checkpointHashes"];

  if (
    !isNeedRecordArray(needRecords) ||
    !isConditionRecordArray(conditionRecords) ||
    !isItemStackRecordArray(itemStackRecords) ||
    !isMoodRecordArray(moodRecords) ||
    !isRelationshipRecordArray(relationshipRecords) ||
    !isTreatmentJobRecordArray(treatmentJobRecords) ||
    !isRandomStreamRecordArray(streamRecords) ||
    !isCheckpointHashRecordArray(checkpointHashes) ||
    !isNonNegativeInteger(jobsReservations["activeReservationCount"]) ||
    !isNonNegativeInteger(jobsReservations["runningJobCount"]) ||
    !isNonNegativeInteger(reasonMetrics["reasonTraceCount"]) ||
    !isNonNegativeInteger(reasonMetrics["reasonTraceOverflowCount"]) ||
    !isQueueMetrics(reasonMetrics["queueMetrics"]) ||
    !isPerformanceMetrics(reasonMetrics["performance"]) ||
    !isInvariantCounters(reasonMetrics["invariantCounters"])
  ) {
    return { ok: false, reason: "m3_save_integer_lane_invalid" };
  }

  if (
    !areOwnerHandlesSorted(actorHandles) ||
    !areRecordsSortedBy(needRecords, readActorSortKey) ||
    !areRecordsSortedBy(conditionRecords, readConditionSortKey) ||
    !areRecordsSortedBy(itemStackRecords, readStackSortKey) ||
    !areRecordsSortedBy(moodRecords, readActorSortKey) ||
    !areRecordsSortedBy(relationshipRecords, readEdgeSortKey) ||
    !areRecordsSortedBy(treatmentJobRecords, readJobSortKey) ||
    !areRecordsSortedBy(streamRecords, readStreamSortKey) ||
    !areRecordsSortedBy(checkpointHashes, readTickSortKey)
  ) {
    return { ok: false, reason: "m3_save_records_unsorted" };
  }

  return {
    ok: true,
    value: {
      mapChunks,
      ownerStores: {
        ownerStoresVersion: M3_SECTION_VERSION,
        actorHandles,
        needRecords,
        conditionRecords,
        itemStackRecords,
        moodRecords,
        relationshipRecords,
      },
      jobsReservations: {
        jobsReservationsVersion: M3_SECTION_VERSION,
        activeReservationCount: jobsReservations["activeReservationCount"],
        runningJobCount: jobsReservations["runningJobCount"],
        treatmentJobRecords,
      },
      randomStreams: {
        randomStreamsVersion: M3_SECTION_VERSION,
        seed: M3_ORDINARY_LIFE_PRIMARY_SEED,
        records: streamRecords,
      },
      commandLogTail: {
        commandLogTailVersion: M3_SECTION_VERSION,
        checkpointTick: commandLogTail["checkpointTick"],
        checkpointWorldHash: commandLogTail["checkpointWorldHash"],
        commandStreamHash: commandLogTail["commandStreamHash"],
        contentHash: commandLogTail["contentHash"],
        nextCommandSequence: commandLogTail["nextCommandSequence"],
      },
      reasonMetrics: {
        reasonMetricsVersion: M3_SECTION_VERSION,
        checkpointHashes,
        reasonTraceCount: reasonMetrics["reasonTraceCount"],
        reasonTraceOverflowCount: reasonMetrics["reasonTraceOverflowCount"],
        queueMetrics: reasonMetrics["queueMetrics"],
        performance: reasonMetrics["performance"],
        invariantCounters: reasonMetrics["invariantCounters"],
      },
    },
  };
}

function isMapChunksSection(value: unknown): value is M3MapChunksSection {
  return (
    isRecord(value) &&
    value["mapChunksVersion"] === M3_SECTION_VERSION &&
    value["width"] === MAP_WIDTH &&
    value["height"] === MAP_HEIGHT &&
    value["regionCount"] === REGION_COUNT
  );
}

function isProjectionRecord(value: unknown): value is M3ReadOnlyProjection {
  if (!isRecord(value)) {
    return false;
  }

  const renderSnapshot = value["renderSnapshot"];
  const scenarioReadModel = value["scenarioReadModel"];
  const rebuiltIndexes = value["rebuiltIndexes"];
  return (
    value["projectionVersion"] === 1 &&
    value["scenarioId"] === M3_ORDINARY_LIFE_SCENARIO_ID &&
    isTickValue(value["tick"]) &&
    typeof value["worldHash"] === "string" &&
    typeof value["readModelHash"] === "string" &&
    isRecord(renderSnapshot) &&
    renderSnapshot["renderSnapshotSchemaVersion"] === 1 &&
    isNonNegativeInteger(renderSnapshot["snapshotSequence"]) &&
    isTickValue(renderSnapshot["tick"]) &&
    renderSnapshot["actorCount"] === ACTOR_COUNT &&
    typeof renderSnapshot["worldHash"] === "string" &&
    typeof renderSnapshot["readModelHash"] === "string" &&
    isRecord(scenarioReadModel) &&
    scenarioReadModel["scenarioReadModelSchemaVersion"] === 1 &&
    scenarioReadModel["scenarioId"] === M3_ORDINARY_LIFE_SCENARIO_ID &&
    isTickValue(scenarioReadModel["basisTick"]) &&
    typeof scenarioReadModel["commandStreamHash"] === "string" &&
    typeof scenarioReadModel["contentHash"] === "string" &&
    isNonNegativeInteger(scenarioReadModel["reasonTraceCount"]) &&
    typeof scenarioReadModel["detailHash"] === "string" &&
    Array.isArray(scenarioReadModel["summaries"]) &&
    everyString(scenarioReadModel["summaries"]) &&
    isRebuiltIndexesProjection(rebuiltIndexes)
  );
}

function isRebuiltIndexesProjection(value: unknown): value is M3RebuiltIndexesProjection {
  return (
    isRecord(value) &&
    value["rebuiltIndexesSchemaVersion"] === 1 &&
    areRebuiltSurfaceNames(value["names"]) &&
    isRebuiltSurfaceHashArray(value["surfaces"]) &&
    isTickValue(value["basisTick"]) &&
    typeof value["basisWorldHash"] === "string" &&
    value["rebuildTimeTicks"] === 1 &&
    typeof value["indexHash"] === "string"
  );
}

function sectionsMatchScenario(
  sections: M3OrdinaryLifeSaveSections,
  tick: Tick,
  summary: M3OrdinaryLifeScenarioSummary,
): boolean {
  return (
    ownerHandleArraysEqual(sections.ownerStores.actorHandles, createActorHandles()) &&
    needRecordsEqual(sections.ownerStores.needRecords, createNeedRecords(summary)) &&
    conditionRecordsEqual(sections.ownerStores.conditionRecords, createConditionRecords(summary)) &&
    itemStackRecordsEqual(sections.ownerStores.itemStackRecords, createItemStackRecords(summary)) &&
    moodRecordsEqual(sections.ownerStores.moodRecords, createMoodRecords(summary)) &&
    relationshipRecordsEqual(
      sections.ownerStores.relationshipRecords,
      createRelationshipRecords(summary),
    ) &&
    treatmentJobRecordsEqual(
      sections.jobsReservations.treatmentJobRecords,
      createTreatmentJobRecords(summary),
    ) &&
    randomStreamRecordsEqual(sections.randomStreams.records, createRandomStreamRecords(tick)) &&
    checkpointHashRecordsEqual(
      sections.reasonMetrics.checkpointHashes,
      createCheckpointHashRecords(summary),
    ) &&
    sections.jobsReservations.activeReservationCount ===
      summary.terminalInvariantCounters.activeReservationCount &&
    sections.jobsReservations.runningJobCount ===
      summary.terminalInvariantCounters.runningJobCount &&
    sections.commandLogTail.checkpointTick === tick &&
    sections.commandLogTail.checkpointWorldHash === summary.worldHash &&
    sections.commandLogTail.commandStreamHash === summary.commandStreamHash &&
    sections.commandLogTail.contentHash === summary.contentHash &&
    sections.commandLogTail.nextCommandSequence === countCommandsThroughTick(tick) &&
    sections.reasonMetrics.reasonTraceCount === summary.reasonTraces.length &&
    sections.reasonMetrics.reasonTraceOverflowCount ===
      summary.terminalInvariantCounters.reasonTraceOverflowCount
  );
}

function projectionMatchesExpected(
  actual: M3ReadOnlyProjection,
  expected: M3ReadOnlyProjection,
): boolean {
  return (
    actual.tick === expected.tick &&
    actual.worldHash === expected.worldHash &&
    actual.readModelHash === expected.readModelHash &&
    actual.renderSnapshot.snapshotSequence === expected.renderSnapshot.snapshotSequence &&
    actual.renderSnapshot.tick === expected.renderSnapshot.tick &&
    actual.renderSnapshot.worldHash === expected.renderSnapshot.worldHash &&
    actual.renderSnapshot.readModelHash === expected.renderSnapshot.readModelHash &&
    actual.scenarioReadModel.basisTick === expected.scenarioReadModel.basisTick &&
    actual.scenarioReadModel.commandStreamHash === expected.scenarioReadModel.commandStreamHash &&
    actual.scenarioReadModel.contentHash === expected.scenarioReadModel.contentHash &&
    actual.scenarioReadModel.reasonTraceCount === expected.scenarioReadModel.reasonTraceCount &&
    actual.scenarioReadModel.detailHash === expected.scenarioReadModel.detailHash &&
    stringArraysEqual(actual.scenarioReadModel.summaries, expected.scenarioReadModel.summaries) &&
    actual.rebuiltIndexes.basisTick === expected.rebuiltIndexes.basisTick &&
    actual.rebuiltIndexes.basisWorldHash === expected.rebuiltIndexes.basisWorldHash &&
    actual.rebuiltIndexes.indexHash === expected.rebuiltIndexes.indexHash &&
    rebuiltSurfaceNamesEqual(actual.rebuiltIndexes.names, expected.rebuiltIndexes.names) &&
    rebuiltSurfaceHashesEqual(actual.rebuiltIndexes.surfaces, expected.rebuiltIndexes.surfaces)
  );
}

function createActorHandles(): readonly M3OwnerHandle[] {
  const handles: M3OwnerHandle[] = [];
  for (let index = 0; index < ACTOR_COUNT; index += 1) {
    handles.push({ index, generation: 1 });
  }
  return handles;
}

function createNeedRecords(summary: M3OrdinaryLifeScenarioSummary): readonly M3NeedRecord[] {
  return [
    { actorId: 0, hunger: summary.endState.yaoHunger, rest: summary.endState.yaoRest },
    { actorId: 1, hunger: 360, rest: 500 },
    { actorId: 2, hunger: 390, rest: 530 },
    { actorId: 3, hunger: 340, rest: 460 },
    { actorId: 4, hunger: 410, rest: 560 },
    { actorId: 5, hunger: 430, rest: 600 },
  ];
}

function createConditionRecords(
  summary: M3OrdinaryLifeScenarioSummary,
): readonly M3ConditionRecord[] {
  return [
    {
      conditionId: CONDITION_YAO_SPRAIN,
      actorId: 0,
      severity: summary.endState.yaoSprainSeverity,
      active: summary.endState.yaoSprainSeverity > 0,
    },
  ];
}

function createItemStackRecords(
  summary: M3OrdinaryLifeScenarioSummary,
): readonly M3ItemStackRecord[] {
  return [
    { stackId: STACK_GRAIN_BOWL, quantity: summary.endState.grainBowlQuantity },
    { stackId: STACK_BANDAGE, quantity: summary.endState.bandageQuantity },
  ];
}

function createMoodRecords(summary: M3OrdinaryLifeScenarioSummary): readonly M3MoodRecord[] {
  return [
    {
      actorId: 0,
      valence: summary.endState.yaoMoodValence,
      tension: summary.endState.yaoMoodTension,
    },
    { actorId: 1, valence: summary.endState.linMoodValence, tension: 500 },
    { actorId: 2, valence: summary.endState.minMoodValence, tension: 500 },
  ];
}

function createRelationshipRecords(
  summary: M3OrdinaryLifeScenarioSummary,
): readonly M3RelationshipRecord[] {
  return [
    {
      edgeId: EDGE_YAO_MIN,
      sourceActorId: 0,
      targetActorId: 2,
      laneValue: summary.endState.yaoMinGratitude,
    },
    {
      edgeId: EDGE_YAO_LIN,
      sourceActorId: 0,
      targetActorId: 1,
      laneValue: summary.endState.yaoLinCare,
    },
  ];
}

function createTreatmentJobRecords(
  summary: M3OrdinaryLifeScenarioSummary,
): readonly M3TreatmentJobRecord[] {
  if (summary.endState.treatmentCompletedCount === 0) {
    return [];
  }

  return [
    {
      jobId: 0,
      caregiverActorId: 2,
      patientActorId: 0,
      conditionId: CONDITION_YAO_SPRAIN,
      status: "completed",
      stockConsumed: 1,
    },
  ];
}

function createRandomStreamRecords(tick: Tick): readonly M3RandomStreamRecord[] {
  return [
    { streamId: 0, name: "world-generation", drawCount: tick >= 0 ? 1 : 0 },
    { streamId: 1, name: "weather:m3-ordinary-life", drawCount: tick >= 3_000 ? 1 : 0 },
    { streamId: 2, name: "social:m3-ordinary-life", drawCount: tick >= 8_000 ? 1 : 0 },
    { streamId: 3, name: "incident:m3-ordinary-life-sprain", drawCount: tick >= 2_400 ? 1 : 0 },
  ];
}

function createCheckpointHashRecords(
  summary: M3OrdinaryLifeScenarioSummary,
): readonly M3CheckpointHashRecord[] {
  const records: M3CheckpointHashRecord[] = [];
  for (const checkpoint of summary.checkpointHashes) {
    records.push({ tick: checkpoint.tick, hash: checkpoint.hash });
  }
  return records;
}

function createRenderSnapshotHash(
  summary: M3OrdinaryLifeScenarioSummary,
  snapshotSequence: number,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "actorCount", value: ACTOR_COUNT },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "snapshotSequence", value: snapshotSequence },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createScenarioReadModelHash(summary: M3OrdinaryLifeScenarioSummary): string {
  const fields: CanonicalWorldField[] = [
    { name: "bandage", value: summary.endState.bandageQuantity },
    { name: "commandHash", value: summary.commandStreamHash },
    { name: "contentHash", value: summary.contentHash },
    { name: "grain", value: summary.endState.grainBowlQuantity },
    { name: "reasonTraceCount", value: summary.reasonTraces.length },
    { name: "scenarioId", value: summary.scenarioId },
    { name: "sprain", value: summary.endState.yaoSprainSeverity },
    { name: "tick", value: summary.finalTick },
    { name: "worldHash", value: summary.worldHash },
  ];

  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function createRebuiltSurfaceHashes(
  summary: M3OrdinaryLifeScenarioSummary,
): readonly M3RebuiltSurfaceHash[] {
  const records: M3RebuiltSurfaceHash[] = [];
  for (const name of REBUILT_SURFACE_NAMES) {
    records.push({
      name,
      hash: formatCanonicalWorldHash({
        fields: [
          { name: "surface", value: name },
          { name: "basisTick", value: summary.finalTick },
          { name: "basisWorldHash", value: summary.worldHash },
          { name: "queueNeed", value: summary.queueMetrics.needDirtyBacklog },
          { name: "queueMood", value: summary.queueMetrics.moodDirtyBacklog },
          { name: "reasonTraceCount", value: summary.reasonTraces.length },
        ],
        randomStreams: [],
        queuedCommands: [],
      }),
    });
  }
  return records;
}

function createRebuiltIndexHash(
  summary: M3OrdinaryLifeScenarioSummary,
  surfaces: readonly M3RebuiltSurfaceHash[],
): string {
  const fields: CanonicalWorldField[] = [
    { name: "basisTick", value: summary.finalTick },
    { name: "basisWorldHash", value: summary.worldHash },
    { name: "surfaceCount", value: surfaces.length },
    { name: "activeReservations", value: summary.terminalInvariantCounters.activeReservationCount },
    { name: "runningJobs", value: summary.terminalInvariantCounters.runningJobCount },
  ];

  for (const surface of surfaces) {
    fields.push({ name: surface.name, value: surface.hash });
  }

  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function findCheckpointHash(summary: M3OrdinaryLifeScenarioSummary, tick: Tick): string {
  for (const checkpoint of summary.checkpointHashes) {
    if (checkpoint.tick === tick) {
      return checkpoint.hash;
    }
  }
  return summary.worldHash;
}

function countCommandsThroughTick(tick: Tick): number {
  let count = 0;
  for (const commandTick of [
    0, 900, 1_800, 2_400, 2_430, 3_000, 6_000, 7_200, 12_000, 18_000, 36_000,
  ]) {
    if (commandTick <= tick) {
      count += 1;
    }
  }
  return count;
}

function checkpointSequenceForTick(tick: Tick): number {
  let sequence = 0;
  for (let index = 0; index < M3_REPLAY_CHECKPOINT_SEQUENCE.length; index += 1) {
    const checkpointTick = M3_REPLAY_CHECKPOINT_SEQUENCE[index] ?? 0;
    if (checkpointTick === tick) {
      return index;
    }
    if (checkpointTick < tick) {
      sequence = index;
    }
  }
  return sequence;
}

function findSavedCheckpointHash(
  sections: M3OrdinaryLifeSaveSections,
  tick: Tick,
): string | undefined {
  for (const checkpoint of sections.reasonMetrics.checkpointHashes) {
    if (checkpoint.tick === tick) {
      return checkpoint.hash;
    }
  }
  return undefined;
}

function createLoadedStateHash(save: M3OrdinaryLifeSaveEnvelope): string {
  const fields: CanonicalWorldField[] = [
    { name: "scenarioId", value: save.scenarioId },
    { name: "seed", value: save.seed },
    { name: "requestedSeed", value: save.requestedSeed },
    { name: "createdTick", value: save.createdTick },
    { name: "worldHash", value: save.sections.commandLogTail.checkpointWorldHash },
    { name: "readModelHash", value: save.readOnlyProjection.readModelHash },
    { name: "commandStreamHash", value: save.sections.commandLogTail.commandStreamHash },
    { name: "contentHash", value: save.sections.commandLogTail.contentHash },
    { name: "actorCount", value: save.sections.ownerStores.actorHandles.length },
    { name: "needCount", value: save.sections.ownerStores.needRecords.length },
    { name: "conditionCount", value: save.sections.ownerStores.conditionRecords.length },
    { name: "itemStackCount", value: save.sections.ownerStores.itemStackRecords.length },
    { name: "moodCount", value: save.sections.ownerStores.moodRecords.length },
    { name: "relationshipCount", value: save.sections.ownerStores.relationshipRecords.length },
    { name: "treatmentJobCount", value: save.sections.jobsReservations.treatmentJobRecords.length },
    { name: "rebuiltSurfaceCount", value: save.readOnlyProjection.rebuiltIndexes.surfaces.length },
  ];

  for (const record of save.sections.ownerStores.needRecords) {
    fields.push({ name: `need.${String(record.actorId)}.hunger`, value: record.hunger });
    fields.push({ name: `need.${String(record.actorId)}.rest`, value: record.rest });
  }

  for (const record of save.sections.ownerStores.conditionRecords) {
    fields.push({ name: `condition.${String(record.conditionId)}.actor`, value: record.actorId });
    fields.push({
      name: `condition.${String(record.conditionId)}.severity`,
      value: record.severity,
    });
    fields.push({ name: `condition.${String(record.conditionId)}.active`, value: record.active });
  }

  for (const record of save.sections.ownerStores.itemStackRecords) {
    fields.push({ name: `stack.${String(record.stackId)}.quantity`, value: record.quantity });
  }

  for (const record of save.sections.ownerStores.relationshipRecords) {
    fields.push({ name: `relationship.${String(record.edgeId)}.lane`, value: record.laneValue });
  }

  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function createComparisonFailure(
  seed: string,
  firstDivergentTick: Tick | null,
  artifactPaths: M3ReplayArtifactPaths,
  reason: "checkpoint_count_mismatch" | "world_hash_mismatch" | "read_model_hash_mismatch",
): M3ReplayComparison {
  return {
    ok: false,
    scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
    seed,
    firstDivergentTick,
    artifactPaths,
    reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isIntegerLane(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isTickValue(value: unknown): value is Tick {
  return typeof value === "number" && isSafeTick(value);
}

function isOwnerHandle(value: unknown): value is M3OwnerHandle {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value["index"]) &&
    isNonNegativeInteger(value["generation"]) &&
    value["generation"] > 0
  );
}

function isOwnerHandleArray(value: unknown): value is readonly M3OwnerHandle[] {
  if (!Array.isArray(value) || value.length !== ACTOR_COUNT) {
    return false;
  }

  for (const handle of value) {
    if (!isOwnerHandle(handle)) {
      return false;
    }
  }

  return true;
}

function isNeedRecordArray(value: unknown): value is readonly M3NeedRecord[] {
  if (!Array.isArray(value) || value.length !== ACTOR_COUNT) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["actorId"]) ||
      !isIntegerLane(record["hunger"], 0, 1_000) ||
      !isIntegerLane(record["rest"], 0, 1_000)
    ) {
      return false;
    }
  }

  return true;
}

function isConditionRecordArray(value: unknown): value is readonly M3ConditionRecord[] {
  if (!Array.isArray(value) || value.length !== 1) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["conditionId"]) ||
      !isNonNegativeInteger(record["actorId"]) ||
      !isIntegerLane(record["severity"], 0, 1_000) ||
      typeof record["active"] !== "boolean"
    ) {
      return false;
    }
  }

  return true;
}

function isItemStackRecordArray(value: unknown): value is readonly M3ItemStackRecord[] {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["stackId"]) ||
      !isNonNegativeInteger(record["quantity"])
    ) {
      return false;
    }
  }

  return true;
}

function isMoodRecordArray(value: unknown): value is readonly M3MoodRecord[] {
  if (!Array.isArray(value) || value.length !== 3) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["actorId"]) ||
      !isIntegerLane(record["valence"], 0, 1_000) ||
      !isIntegerLane(record["tension"], 0, 1_000)
    ) {
      return false;
    }
  }

  return true;
}

function isRelationshipRecordArray(value: unknown): value is readonly M3RelationshipRecord[] {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["edgeId"]) ||
      !isNonNegativeInteger(record["sourceActorId"]) ||
      !isNonNegativeInteger(record["targetActorId"]) ||
      !isIntegerLane(record["laneValue"], -1_000, 1_000)
    ) {
      return false;
    }
  }

  return true;
}

function isTreatmentJobRecordArray(value: unknown): value is readonly M3TreatmentJobRecord[] {
  if (!Array.isArray(value) || value.length > 1) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["jobId"]) ||
      !isNonNegativeInteger(record["caregiverActorId"]) ||
      !isNonNegativeInteger(record["patientActorId"]) ||
      !isNonNegativeInteger(record["conditionId"]) ||
      record["status"] !== "completed" ||
      !isNonNegativeInteger(record["stockConsumed"])
    ) {
      return false;
    }
  }

  return true;
}

function isRandomStreamRecordArray(value: unknown): value is readonly M3RandomStreamRecord[] {
  if (!Array.isArray(value) || value.length !== 4) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["streamId"]) ||
      typeof record["name"] !== "string" ||
      !isNonNegativeInteger(record["drawCount"])
    ) {
      return false;
    }
  }

  return true;
}

function isCheckpointHashRecordArray(value: unknown): value is readonly M3CheckpointHashRecord[] {
  if (!Array.isArray(value)) {
    return false;
  }

  for (const record of value) {
    if (!isRecord(record) || !isTickValue(record["tick"]) || typeof record["hash"] !== "string") {
      return false;
    }
  }

  return true;
}

function isQueueMetrics(value: unknown): value is M3OrdinaryLifeQueueMetrics {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value["needDirtyBacklog"]) &&
    isNonNegativeInteger(value["needDirtyBacklogPeak"]) &&
    isNonNegativeInteger(value["environmentDirtyBacklog"]) &&
    isNonNegativeInteger(value["environmentDirtyBacklogPeak"]) &&
    isNonNegativeInteger(value["foodDirtyBacklog"]) &&
    isNonNegativeInteger(value["foodDirtyBacklogPeak"]) &&
    isNonNegativeInteger(value["healthDirtyBacklog"]) &&
    isNonNegativeInteger(value["healthDirtyPeak"]) &&
    isNonNegativeInteger(value["abilityDirtyBacklog"]) &&
    isNonNegativeInteger(value["abilityDirtyPeak"]) &&
    isNonNegativeInteger(value["moodDirtyBacklog"]) &&
    isNonNegativeInteger(value["moodDirtyBacklogPeak"])
  );
}

function isPerformanceMetrics(value: unknown): value is M3OrdinaryLifePerformanceMetrics {
  return (
    isRecord(value) &&
    isTickValue(value["elapsedTicks"]) &&
    isNonNegativeInteger(value["commandCount"]) &&
    isNonNegativeInteger(value["checkpointCount"]) &&
    isNonNegativeInteger(value["actorThinkPasses"]) &&
    isNonNegativeInteger(value["workCandidateVisitedCount"]) &&
    isNonNegativeInteger(value["needCandidateVisitedCount"]) &&
    isNonNegativeInteger(value["medicalCandidateVisitedCount"]) &&
    isNonNegativeInteger(value["foodCandidateVisitedCount"]) &&
    isNonNegativeInteger(value["socialCandidateVisitedCount"]) &&
    isNonNegativeInteger(value["exactPathRequests"]) &&
    isNonNegativeInteger(value["boundedCandidateCapHits"])
  );
}

function isInvariantCounters(value: unknown): value is M3OrdinaryLifeTerminalInvariantCounters {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value["activeReservationCount"]) &&
    isNonNegativeInteger(value["runningJobCount"]) &&
    isNonNegativeInteger(value["negativeNeedLaneCount"]) &&
    isNonNegativeInteger(value["needLaneCheckCount"]) &&
    isNonNegativeInteger(value["outOfRangeMoodLaneCount"]) &&
    isNonNegativeInteger(value["moodLaneCheckCount"]) &&
    isNonNegativeInteger(value["outOfRangeRelationshipLaneCount"]) &&
    isNonNegativeInteger(value["relationshipLaneCheckCount"]) &&
    isNonNegativeInteger(value["activeM4FactCount"]) &&
    isNonNegativeInteger(value["m4AbsenceCheckCount"]) &&
    isNonNegativeInteger(value["reasonTraceOverflowCount"]) &&
    isNonNegativeInteger(value["staleAbilityCacheRejectCount"]) &&
    isIntegerLane(value["itemConservationDelta"], -1_000, 1_000) &&
    isIntegerLane(value["medicalStockConservationDelta"], -1_000, 1_000)
  );
}

function areRebuiltSurfaceNames(value: unknown): value is readonly M3RebuiltSurfaceName[] {
  if (!Array.isArray(value) || value.length !== REBUILT_SURFACE_NAMES.length) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== REBUILT_SURFACE_NAMES[index]) {
      return false;
    }
  }

  return true;
}

function isRebuiltSurfaceHashArray(value: unknown): value is readonly M3RebuiltSurfaceHash[] {
  if (!Array.isArray(value) || value.length !== REBUILT_SURFACE_NAMES.length) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const record: unknown = value[index];
    if (
      !isRecord(record) ||
      record["name"] !== REBUILT_SURFACE_NAMES[index] ||
      typeof record["hash"] !== "string"
    ) {
      return false;
    }
  }

  return true;
}

function areOwnerHandlesSorted(records: readonly M3OwnerHandle[]): boolean {
  let previous = -1;
  for (const record of records) {
    if (record.index <= previous) {
      return false;
    }
    previous = record.index;
  }
  return true;
}

function areRecordsSortedBy(
  records: readonly unknown[],
  readKey: (record: unknown) => number,
): boolean {
  let previous = -1;
  for (const record of records) {
    const value = readKey(record);
    if (value <= previous) {
      return false;
    }
    previous = value;
  }
  return true;
}

function readActorSortKey(record: unknown): number {
  return isRecord(record) && typeof record["actorId"] === "number" ? record["actorId"] : -1;
}

function readConditionSortKey(record: unknown): number {
  return isRecord(record) && typeof record["conditionId"] === "number" ? record["conditionId"] : -1;
}

function readStackSortKey(record: unknown): number {
  return isRecord(record) && typeof record["stackId"] === "number" ? record["stackId"] : -1;
}

function readEdgeSortKey(record: unknown): number {
  return isRecord(record) && typeof record["edgeId"] === "number" ? record["edgeId"] : -1;
}

function readJobSortKey(record: unknown): number {
  return isRecord(record) && typeof record["jobId"] === "number" ? record["jobId"] : -1;
}

function readStreamSortKey(record: unknown): number {
  return isRecord(record) && typeof record["streamId"] === "number" ? record["streamId"] : -1;
}

function readTickSortKey(record: unknown): number {
  return isRecord(record) && typeof record["tick"] === "number" ? record["tick"] : -1;
}

function ownerHandleArraysEqual(
  left: readonly M3OwnerHandle[],
  right: readonly M3OwnerHandle[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (!ownerHandlesEqual(left[index], right[index])) {
      return false;
    }
  }

  return true;
}

function needRecordsEqual(left: readonly M3NeedRecord[], right: readonly M3NeedRecord[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.actorId !== rightRecord?.actorId ||
      leftRecord.hunger !== rightRecord.hunger ||
      leftRecord.rest !== rightRecord.rest
    ) {
      return false;
    }
  }
  return true;
}

function conditionRecordsEqual(
  left: readonly M3ConditionRecord[],
  right: readonly M3ConditionRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.conditionId !== rightRecord?.conditionId ||
      leftRecord.actorId !== rightRecord.actorId ||
      leftRecord.severity !== rightRecord.severity ||
      leftRecord.active !== rightRecord.active
    ) {
      return false;
    }
  }
  return true;
}

function itemStackRecordsEqual(
  left: readonly M3ItemStackRecord[],
  right: readonly M3ItemStackRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.stackId !== rightRecord?.stackId ||
      leftRecord.quantity !== rightRecord.quantity
    ) {
      return false;
    }
  }
  return true;
}

function moodRecordsEqual(left: readonly M3MoodRecord[], right: readonly M3MoodRecord[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.actorId !== rightRecord?.actorId ||
      leftRecord.valence !== rightRecord.valence ||
      leftRecord.tension !== rightRecord.tension
    ) {
      return false;
    }
  }
  return true;
}

function relationshipRecordsEqual(
  left: readonly M3RelationshipRecord[],
  right: readonly M3RelationshipRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.edgeId !== rightRecord?.edgeId ||
      leftRecord.sourceActorId !== rightRecord.sourceActorId ||
      leftRecord.targetActorId !== rightRecord.targetActorId ||
      leftRecord.laneValue !== rightRecord.laneValue
    ) {
      return false;
    }
  }
  return true;
}

function treatmentJobRecordsEqual(
  left: readonly M3TreatmentJobRecord[],
  right: readonly M3TreatmentJobRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.jobId !== rightRecord?.jobId ||
      leftRecord.caregiverActorId !== rightRecord.caregiverActorId ||
      leftRecord.patientActorId !== rightRecord.patientActorId ||
      leftRecord.conditionId !== rightRecord.conditionId ||
      leftRecord.stockConsumed !== rightRecord.stockConsumed
    ) {
      return false;
    }
  }
  return true;
}

function randomStreamRecordsEqual(
  left: readonly M3RandomStreamRecord[],
  right: readonly M3RandomStreamRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.streamId !== rightRecord?.streamId ||
      leftRecord.name !== rightRecord.name ||
      leftRecord.drawCount !== rightRecord.drawCount
    ) {
      return false;
    }
  }
  return true;
}

function checkpointHashRecordsEqual(
  left: readonly M3CheckpointHashRecord[],
  right: readonly M3CheckpointHashRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.tick !== rightRecord?.tick ||
      leftRecord.hash !== rightRecord.hash
    ) {
      return false;
    }
  }
  return true;
}

function ownerHandlesEqual(
  left: M3OwnerHandle | undefined,
  right: M3OwnerHandle | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }

  return left.index === right.index && left.generation === right.generation;
}

function rebuiltSurfaceNamesEqual(
  left: readonly M3RebuiltSurfaceName[],
  right: readonly M3RebuiltSurfaceName[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function rebuiltSurfaceHashesEqual(
  left: readonly M3RebuiltSurfaceHash[],
  right: readonly M3RebuiltSurfaceHash[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (
      leftRecord === undefined ||
      leftRecord.name !== rightRecord?.name ||
      leftRecord.hash !== rightRecord.hash
    ) {
      return false;
    }
  }

  return true;
}

function everyString(values: readonly unknown[]): boolean {
  for (const value of values) {
    if (typeof value !== "string") {
      return false;
    }
  }

  return true;
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}
