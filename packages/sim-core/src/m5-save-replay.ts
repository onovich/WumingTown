import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import {
  M5_ALPHA_CONTENT_ALIAS,
  M5_ALPHA_CONTENT_EXPECTED_TICKS,
  M5_ALPHA_CONTENT_SCENARIO_ID,
  deriveM5AlphaContentScenarioSeed,
  runM5AlphaContentScenario,
  type M5AlphaContentScenarioReason,
  type M5AlphaContentScenarioSummary,
} from "./m5-alpha-content-scenario";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash } from "./world-hash";

export const M5_SAVE_MAGIC = "wuming-town.m5.alpha-content-framework.save";
export const M5_SAVE_FORMAT_VERSION = 1;
export const M5_SECTION_DIRECTORY_VERSION = 1;
export const M5_SECTION_VERSION = 1;
export const M5_READ_MODEL_HASH_VERSION = 1;
export const M5_SAVE_TICK = 12_000;
export const M5_LOAD_TICK = 12_001;
export const M5_FINAL_TICK = M5_ALPHA_CONTENT_EXPECTED_TICKS;
export const M5_COMMAND_PREFIX = "m5.alpha-content-framework.advance.";

export const M5_REPLAY_CHECKPOINT_SEQUENCE: readonly Tick[] = Object.freeze([
  0,
  3_600,
  7_200,
  M5_SAVE_TICK,
  18_000,
  M5_FINAL_TICK,
]);

export const M5_REBUILT_SURFACE_NAMES: readonly string[] = Object.freeze([
  "anomaly-roster",
  "borrowed-shadow",
  "third-knock",
  "old-bridge",
  "faction-governance",
  "season-events",
  "content-validation",
  "work-offers",
  "path",
  "read-model",
  "review",
  "metrics",
]);

export type M5SaveReplayReason =
  | "m5_save_ok"
  | "m5_save_seed_invalid"
  | "m5_tick_invalid"
  | "m5_checkpoint_order_invalid"
  | "m5_save_magic_invalid"
  | "m5_save_version_invalid"
  | "m5_save_scenario_invalid"
  | "m5_save_seed_mismatch"
  | "m5_save_content_manifest_mismatch"
  | "m5_save_section_invalid"
  | "m5_save_projection_invalid"
  | "m5_save_integrity_mismatch"
  | "m5_load_tick_invalid"
  | "m5_resume_tick_before_save";

export interface M5ReplayOptions {
  readonly seed: string;
  readonly checkpointTicks?: readonly Tick[];
}

export interface M5ResumeOptions {
  readonly save: unknown;
  readonly loadTick: Tick;
  readonly finalTick: Tick;
  readonly checkpointTicks?: readonly Tick[];
}

export interface M5ReplayCheckpoint {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly checkpointHash: string;
  readonly rebuiltSurfaceHash: string;
}

export interface M5ReplayRun {
  readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly source: "uninterrupted" | "loaded-save";
  readonly loadedStateHash: string;
  readonly checkpoints: readonly M5ReplayCheckpoint[];
  readonly finalTick: Tick;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
}

export interface M5ReplayArtifactPaths {
  readonly expectedPath: string;
  readonly actualPath: string;
  readonly diffPath: string;
}

export type M5ReplayComparison =
  | {
      readonly ok: true;
      readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
      readonly seed: string;
      readonly checkpointCount: number;
      readonly artifactPaths: M5ReplayArtifactPaths;
    }
  | {
      readonly ok: false;
      readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
      readonly seed: string;
      readonly firstDivergentTick: Tick | null;
      readonly reason:
        | "checkpoint_count_mismatch"
        | "world_hash_mismatch"
        | "read_model_hash_mismatch";
      readonly artifactPaths: M5ReplayArtifactPaths;
    };

export interface M5SaveEnvelope {
  readonly magic: typeof M5_SAVE_MAGIC;
  readonly formatVersion: typeof M5_SAVE_FORMAT_VERSION;
  readonly sectionDirectoryVersion: typeof M5_SECTION_DIRECTORY_VERSION;
  readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
  readonly alias: typeof M5_ALPHA_CONTENT_ALIAS;
  readonly requestedSeed: string;
  readonly seed: string;
  readonly contentManifestHash: string;
  readonly commandStreamHash: string;
  readonly createdTick: Tick;
  readonly nextTick: Tick;
  readonly sections: M5SaveSections;
  readonly readOnlyProjection: M5ReadOnlyProjection;
}

export interface M5SaveSections {
  readonly ownerStores: M5OwnerStoresSection;
  readonly contentValidation: M5ContentValidationSection;
  readonly randomStreams: M5RandomStreamsSection;
  readonly commandLogTail: M5CommandLogTailSection;
  readonly reasonMetrics: M5ReasonMetricsSection;
}

export interface M5OwnerStoresSection {
  readonly ownerStoresVersion: typeof M5_SECTION_VERSION;
  readonly ownerHandles: readonly M5OwnerHandleRecord[];
  readonly anomalyRecords: readonly M5AnomalySaveRecord[];
  readonly factionRecords: readonly M5FactionSaveRecord[];
  readonly governanceRecords: readonly M5GovernanceSaveRecord[];
  readonly seasonRecords: readonly M5SeasonSaveRecord[];
}

export interface M5OwnerHandleRecord {
  readonly handleId: number;
  readonly storeKind: number;
  readonly ownerVersion: number;
  readonly activeCount: number;
}

export interface M5AnomalySaveRecord {
  readonly recordId: number;
  readonly anomalyKind: number;
  readonly selectedCandidateId: number;
  readonly activeCrisisCount: number;
  readonly resolvedCrisisCount: number;
  readonly evidenceKindCount: number;
  readonly terminalReason: number;
  readonly reviewTick: Tick;
  readonly ownerVersion: number;
  readonly queryVisitedCount: number;
  readonly candidateCapHit: number;
}

export interface M5FactionSaveRecord {
  readonly factKind: number;
  readonly selectedCount: number;
  readonly activeFactCount: number;
  readonly queryVisitedCount: number;
  readonly ownerVersion: number;
  readonly reason: string;
}

export interface M5GovernanceSaveRecord {
  readonly hookKind: number;
  readonly selectedCount: number;
  readonly activeHookCount: number;
  readonly queryVisitedCount: number;
  readonly allowed: number;
  readonly ownerVersion: number;
  readonly reason: string;
}

export interface M5SeasonSaveRecord {
  readonly recordId: number;
  readonly selectionCount: number;
  readonly totalCandidateVisits: number;
  readonly activeIncidentCandidateCount: number;
  readonly activeRecoveryCandidateCount: number;
  readonly preconditionFailureCount: number;
  readonly cooldownWriteCount: number;
  readonly freshnessWriteCount: number;
  readonly ownerVersion: number;
  readonly reason: string;
}

export interface M5ContentValidationSection {
  readonly contentValidationVersion: typeof M5_SECTION_VERSION;
  readonly contentManifestHash: string;
  readonly definitionCount: number;
  readonly catalogEntryCount: number;
  readonly reviewNoteCount: number;
  readonly blockedCatalogEntryCount: number;
  readonly blockedReasonCount: number;
}

export interface M5RandomStreamsSection {
  readonly randomStreamsVersion: typeof M5_SECTION_VERSION;
  readonly streamPositions: readonly M5RandomStreamPositionRecord[];
}

export interface M5RandomStreamPositionRecord {
  readonly streamName: string;
  readonly drawCount: number;
  readonly position: number;
  readonly stateHash: string;
}

export interface M5CommandLogTailSection {
  readonly commandLogTailVersion: typeof M5_SECTION_VERSION;
  readonly checkpointTick: Tick;
  readonly checkpointWorldHash: string;
  readonly commandStreamHash: string;
  readonly contentManifestHash: string;
  readonly nextCommandSequence: number;
  readonly commandTail: readonly M5CommandTailRecord[];
}

export interface M5CommandTailRecord {
  readonly tick: Tick;
  readonly sequence: number;
  readonly commandHash: string;
}

export interface M5ReasonMetricsSection {
  readonly reasonMetricsVersion: typeof M5_SECTION_VERSION;
  readonly checkpointHashes: readonly M5CheckpointHashRecord[];
  readonly reviewRows: readonly M5ReviewRowRecord[];
  readonly queueMetrics: M5QueueMetricsRecord;
}

export interface M5CheckpointHashRecord {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly checkpointHash: string;
}

export interface M5ReviewRowRecord {
  readonly rowId: number;
  readonly sourceKind: number;
  readonly sourceId: number;
  readonly tick: Tick;
  readonly ownerVersion: number;
  readonly reason: string;
}

export interface M5QueueMetricsRecord {
  readonly anomalyCandidateVisits: number;
  readonly factionCandidateVisits: number;
  readonly governanceCandidateVisits: number;
  readonly seasonCandidateVisits: number;
  readonly seasonPreconditionFailures: number;
  readonly capHitCount: number;
}

export interface M5SurfaceHashRecord {
  readonly name: string;
  readonly hash: string;
  readonly sourceVersion: number;
}

export interface M5ReadOnlyProjection {
  readonly projectionVersion: 1;
  readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
  readonly tick: Tick;
  readonly contentManifestHash: string;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly renderSnapshot: M5RenderSnapshot;
  readonly scenarioReadModel: M5ScenarioReadModel;
  readonly rebuiltIndexes: M5RebuiltIndexes;
}

export interface M5RenderSnapshot {
  readonly renderSnapshotSchemaVersion: 1;
  readonly snapshotSequence: number;
  readonly tick: Tick;
  readonly anomalyCount: number;
  readonly strategyPathCount: number;
  readonly worldHash: string;
  readonly readModelHash: string;
}

export interface M5ScenarioReadModel {
  readonly scenarioReadModelSchemaVersion: 1;
  readonly scenarioId: typeof M5_ALPHA_CONTENT_SCENARIO_ID;
  readonly basisTick: Tick;
  readonly commandStreamHash: string;
  readonly contentManifestHash: string;
  readonly thirdKnockReviewReason: string;
  readonly oldBridgeReviewReason: string;
  readonly seasonSelectionCount: number;
  readonly detailHash: string;
  readonly summaries: readonly string[];
}

export interface M5RebuiltIndexes {
  readonly rebuiltIndexesSchemaVersion: 1;
  readonly names: readonly string[];
  readonly surfaces: readonly M5SurfaceHashRecord[];
  readonly basisTick: Tick;
  readonly basisWorldHash: string;
  readonly rebuildTimeTicks: number;
  readonly indexHash: string;
}

export type M5SaveLoadResult =
  | {
      readonly ok: true;
      readonly save: M5SaveEnvelope;
      readonly loadTick: typeof M5_LOAD_TICK;
      readonly validationTimeTicks: number;
      readonly rebuildTimeTicks: number;
      readonly rebuiltSurfaceNames: readonly string[];
      readonly projection: M5ReadOnlyProjection;
      readonly loadedStateHash: string;
    }
  | { readonly ok: false; readonly reason: M5SaveReplayReason };

export type M5ReplayResult =
  | { readonly ok: true; readonly replay: M5ReplayRun }
  | { readonly ok: false; readonly reason: M5SaveReplayReason };

type M5CheckpointBuildResult =
  | { readonly ok: true; readonly value: readonly M5ReplayCheckpoint[] }
  | { readonly ok: false; readonly reason: M5SaveReplayReason };

type M5FactionQueryOk = Extract<
  M5AlphaContentScenarioSummary["factionGovernance"]["factionQuery"],
  { readonly ok: true }
>;
type M5GovernanceQueryOk = Extract<
  M5AlphaContentScenarioSummary["factionGovernance"]["governanceAllowed"],
  { readonly ok: true }
>;
type M5SeasonSelectionOk = Extract<
  M5AlphaContentScenarioSummary["season"]["incidentSelection"],
  { readonly ok: true }
>;

interface M5ParsedSaveEnvelope {
  readonly rawSections: unknown;
  readonly rawProjection: unknown;
  readonly requestedSeed: string;
  readonly createdTick: Tick;
  readonly contentManifestHash: string;
  readonly commandStreamHash: string;
}

interface UnknownSaveEnvelope {
  readonly magic: unknown;
  readonly formatVersion: unknown;
  readonly sectionDirectoryVersion: unknown;
  readonly scenarioId: unknown;
  readonly alias: unknown;
  readonly requestedSeed: unknown;
  readonly seed: unknown;
  readonly contentManifestHash: unknown;
  readonly commandStreamHash: unknown;
  readonly createdTick: unknown;
  readonly nextTick: unknown;
  readonly sections: unknown;
  readonly readOnlyProjection: unknown;
}

interface UnknownSaveSections {
  readonly ownerStores: unknown;
  readonly contentValidation: unknown;
  readonly randomStreams: unknown;
  readonly commandLogTail: unknown;
  readonly reasonMetrics: unknown;
}

export function runM5AlphaContentReplay(options: M5ReplayOptions): M5ReplayResult {
  if (options.seed.length === 0) {
    return { ok: false, reason: "m5_save_seed_invalid" };
  }

  const ticks = normalizeCheckpointTicks(options.checkpointTicks ?? M5_REPLAY_CHECKPOINT_SEQUENCE);
  if (!ticks.ok) {
    return ticks;
  }

  const checkpoints = createCheckpoints(options.seed, ticks.value);
  if (!checkpoints.ok) {
    return checkpoints;
  }

  const finalCheckpoint = checkpoints.value[checkpoints.value.length - 1];
  if (finalCheckpoint === undefined) {
    return { ok: false, reason: "m5_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      seed: deriveM5AlphaContentScenarioSeed(options.seed),
      requestedSeed: options.seed,
      source: "uninterrupted",
      loadedStateHash: "0x00000000",
      checkpoints: checkpoints.value,
      finalTick: finalCheckpoint.tick,
      finalWorldHash: finalCheckpoint.worldHash,
      finalReadModelHash: finalCheckpoint.readModelHash,
    },
  };
}

export function createM5AlphaContentSaveEnvelope(
  requestedSeed: string,
  createdTick: Tick = M5_SAVE_TICK,
): M5SaveEnvelope {
  if (requestedSeed.length === 0 || !isSafeTick(createdTick)) {
    throw new Error("M5 save replay requires a non-empty seed and safe save tick");
  }

  const summary = runM5AlphaContentScenario({ seed: requestedSeed, ticks: createdTick });
  const projection = createM5ReadOnlyProjection(summary, checkpointSequenceForTick(createdTick));
  const sections = createSections(createdTick, summary);

  return {
    magic: M5_SAVE_MAGIC,
    formatVersion: M5_SAVE_FORMAT_VERSION,
    sectionDirectoryVersion: M5_SECTION_DIRECTORY_VERSION,
    scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
    alias: M5_ALPHA_CONTENT_ALIAS,
    requestedSeed,
    seed: summary.authoritativeScenarioSeed,
    contentManifestHash: summary.contentHash,
    commandStreamHash: summary.commandStreamHash,
    createdTick,
    nextTick: createdTick + 1,
    sections,
    readOnlyProjection: projection,
  };
}

export function loadM5AlphaContentSaveEnvelope(input: unknown): M5SaveLoadResult {
  const parsed = parseSaveEnvelope(input);
  if (!parsed.ok) {
    return parsed;
  }

  const save = parsed.value;
  const expected = createM5AlphaContentSaveEnvelope(save.requestedSeed, save.createdTick);
  if (save.contentManifestHash !== expected.contentManifestHash) {
    return { ok: false, reason: "m5_save_content_manifest_mismatch" };
  }

  if (
    save.commandStreamHash !== expected.commandStreamHash ||
    stableJson(save.rawSections) !== stableJson(expected.sections)
  ) {
    return { ok: false, reason: "m5_save_integrity_mismatch" };
  }

  if (stableJson(save.rawProjection) !== stableJson(expected.readOnlyProjection)) {
    return { ok: false, reason: "m5_save_projection_invalid" };
  }

  const loadedStateHash = createLoadedStateHash(expected, expected.readOnlyProjection);
  return {
    ok: true,
    save: expected,
    loadTick: M5_LOAD_TICK,
    validationTimeTicks: 2,
    rebuildTimeTicks: expected.readOnlyProjection.rebuiltIndexes.rebuildTimeTicks,
    rebuiltSurfaceNames: M5_REBUILT_SURFACE_NAMES,
    projection: expected.readOnlyProjection,
    loadedStateHash,
  };
}

export function resumeM5AlphaContentFromSave(options: M5ResumeOptions): M5ReplayResult {
  const loaded = loadM5AlphaContentSaveEnvelope(options.save);
  if (!loaded.ok) {
    return loaded;
  }

  if (!isSafeTick(options.finalTick) || !isSafeTick(options.loadTick)) {
    return { ok: false, reason: "m5_tick_invalid" };
  }

  if (options.loadTick !== loaded.save.createdTick + 1 || options.loadTick !== M5_LOAD_TICK) {
    return { ok: false, reason: "m5_load_tick_invalid" };
  }

  if (options.finalTick < loaded.save.createdTick) {
    return { ok: false, reason: "m5_resume_tick_before_save" };
  }

  const ticks = includeSaveTick(
    loaded.save.createdTick,
    options.finalTick,
    options.checkpointTicks ?? M5_REPLAY_CHECKPOINT_SEQUENCE,
  );
  const normalized = normalizeCheckpointTicks(ticks);
  if (!normalized.ok) {
    return normalized;
  }

  const checkpoints = createResumedCheckpoints(loaded, normalized.value);
  if (!checkpoints.ok) {
    return checkpoints;
  }

  const finalCheckpoint = checkpoints.value[checkpoints.value.length - 1];
  if (finalCheckpoint === undefined) {
    return { ok: false, reason: "m5_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      seed: loaded.save.seed,
      requestedSeed: loaded.save.requestedSeed,
      source: "loaded-save",
      loadedStateHash: loaded.loadedStateHash,
      checkpoints: checkpoints.value,
      finalTick: finalCheckpoint.tick,
      finalWorldHash: finalCheckpoint.worldHash,
      finalReadModelHash: finalCheckpoint.readModelHash,
    },
  };
}

export function createM5ReadOnlyProjection(
  summary: M5AlphaContentScenarioSummary,
  snapshotSequence: number,
): M5ReadOnlyProjection {
  const renderSnapshotHash = createRenderSnapshotHash(summary, snapshotSequence);
  const scenarioReadModelHash = createScenarioReadModelHash(summary);
  const rebuiltSurfaces = createRebuiltSurfaceHashes(summary);
  const rebuiltIndexHash = createRebuiltIndexHash(summary, rebuiltSurfaces);
  const readModelHash = formatCanonicalWorldHash({
    fields: [
      { name: "contentManifestHash", value: summary.contentHash },
      { name: "hashVersion", value: M5_READ_MODEL_HASH_VERSION },
      { name: "rebuiltIndexHash", value: rebuiltIndexHash },
      { name: "renderSnapshotHash", value: renderSnapshotHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "scenarioReadModelHash", value: scenarioReadModelHash },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.finalWorldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });

  return {
    projectionVersion: 1,
    scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
    tick: summary.finalTick,
    contentManifestHash: summary.contentHash,
    worldHash: summary.finalWorldHash,
    readModelHash,
    renderSnapshot: {
      renderSnapshotSchemaVersion: 1,
      snapshotSequence,
      tick: summary.finalTick,
      anomalyCount: summary.roster.definitionCount,
      strategyPathCount: summary.strategyPaths.length,
      worldHash: summary.finalWorldHash,
      readModelHash: renderSnapshotHash,
    },
    scenarioReadModel: {
      scenarioReadModelSchemaVersion: 1,
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      basisTick: summary.finalTick,
      commandStreamHash: summary.commandStreamHash,
      contentManifestHash: summary.contentHash,
      thirdKnockReviewReason: summary.thirdKnock.review.reason,
      oldBridgeReviewReason: summary.oldBridge.review.reason,
      seasonSelectionCount: summary.season.metrics.selectionCount,
      detailHash: scenarioReadModelHash,
      summaries: [
        `catalog=${String(summary.contentCatalog.catalogEntryCount)}`,
        `anomalies=${String(summary.roster.definitionCount)}`,
        `thirdKnock=${summary.thirdKnock.review.reason}`,
        `oldBridge=${summary.oldBridge.review.reason}`,
        `seasonSelections=${String(summary.season.metrics.selectionCount)}`,
      ],
    },
    rebuiltIndexes: {
      rebuiltIndexesSchemaVersion: 1,
      names: M5_REBUILT_SURFACE_NAMES,
      surfaces: rebuiltSurfaces,
      basisTick: summary.finalTick,
      basisWorldHash: summary.finalWorldHash,
      rebuildTimeTicks: 2,
      indexHash: rebuiltIndexHash,
    },
  };
}

export function compareM5ReplayRuns(
  expected: M5ReplayRun,
  actual: M5ReplayRun,
  artifactPaths: M5ReplayArtifactPaths,
): M5ReplayComparison {
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
    scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
    seed: expected.seed,
    checkpointCount: expected.checkpoints.length,
    artifactPaths,
  };
}

export function createM5AdvanceCommandId(tick: Tick, sequence: number): string {
  if (!isSafeTick(tick) || !Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("M5 advance command id requires safe non-negative integer fields");
  }

  return `${M5_COMMAND_PREFIX}${String(tick)}.${String(sequence)}`;
}

export function parseM5AdvanceCommandId(
  commandId: string,
): { readonly ok: true; readonly tick: Tick; readonly sequence: number } | { readonly ok: false } {
  if (!commandId.startsWith(M5_COMMAND_PREFIX)) {
    return { ok: false };
  }

  const rest = commandId.slice(M5_COMMAND_PREFIX.length);
  const dotIndex = rest.indexOf(".");
  if (dotIndex <= 0 || dotIndex === rest.length - 1) {
    return { ok: false };
  }

  const tick = Number.parseInt(rest.slice(0, dotIndex), 10);
  const sequence = Number.parseInt(rest.slice(dotIndex + 1), 10);
  if (!isSafeTick(tick) || !Number.isSafeInteger(sequence) || sequence < 0) {
    return { ok: false };
  }

  return { ok: true, tick, sequence };
}

function createSections(createdTick: Tick, summary: M5AlphaContentScenarioSummary): M5SaveSections {
  return {
    ownerStores: {
      ownerStoresVersion: M5_SECTION_VERSION,
      ownerHandles: createOwnerHandles(summary),
      anomalyRecords: createAnomalyRecords(summary),
      factionRecords: createFactionRecords(summary),
      governanceRecords: createGovernanceRecords(summary),
      seasonRecords: createSeasonRecords(summary),
    },
    contentValidation: {
      contentValidationVersion: M5_SECTION_VERSION,
      contentManifestHash: summary.contentHash,
      definitionCount: summary.contentCatalog.definitionCount,
      catalogEntryCount: summary.contentCatalog.catalogEntryCount,
      reviewNoteCount: summary.contentCatalog.reviewNoteCount,
      blockedCatalogEntryCount: summary.contentCatalog.blockedCatalogEntryCount,
      blockedReasonCount: summary.contentCatalog.blockedReasonCount,
    },
    randomStreams: {
      randomStreamsVersion: M5_SECTION_VERSION,
      streamPositions: createRandomStreamPositions(summary),
    },
    commandLogTail: {
      commandLogTailVersion: M5_SECTION_VERSION,
      checkpointTick: createdTick,
      checkpointWorldHash: summary.finalWorldHash,
      commandStreamHash: summary.commandStreamHash,
      contentManifestHash: summary.contentHash,
      nextCommandSequence: countCommandsThroughTick(createdTick),
      commandTail: createCommandTail(createdTick),
    },
    reasonMetrics: {
      reasonMetricsVersion: M5_SECTION_VERSION,
      checkpointHashes: createCheckpointHashRecords(summary.requestedSeed, createdTick),
      reviewRows: createReviewRows(summary),
      queueMetrics: createQueueMetrics(summary),
    },
  };
}

function createOwnerHandles(
  summary: M5AlphaContentScenarioSummary,
): readonly M5OwnerHandleRecord[] {
  return [
    {
      handleId: 1,
      storeKind: 1,
      ownerVersion: summary.contentCatalog.definitionCount,
      activeCount: summary.contentCatalog.catalogEntryCount,
    },
    {
      handleId: 2,
      storeKind: 2,
      ownerVersion: summary.roster.rosterVersion,
      activeCount: summary.roster.definitionCount,
    },
    {
      handleId: 3,
      storeKind: 3,
      ownerVersion: summary.thirdKnock.metrics.ownerVersion,
      activeCount: summary.thirdKnock.metrics.resolvedCrisisCount,
    },
    {
      handleId: 4,
      storeKind: 4,
      ownerVersion: summary.oldBridge.metrics.ownerVersion,
      activeCount: summary.oldBridge.metrics.resolvedCrisisCount,
    },
    {
      handleId: 5,
      storeKind: 5,
      ownerVersion: summary.factionGovernance.factionMetrics.ownerVersion,
      activeCount: summary.factionGovernance.factionMetrics.activeFactCount,
    },
    {
      handleId: 6,
      storeKind: 6,
      ownerVersion: summary.factionGovernance.governanceMetrics.ownerVersion,
      activeCount: summary.factionGovernance.governanceMetrics.activeHookCount,
    },
    {
      handleId: 7,
      storeKind: 7,
      ownerVersion: summary.season.metrics.ownerVersion,
      activeCount:
        summary.season.metrics.activeIncidentCandidateCount +
        summary.season.metrics.activeRecoveryCandidateCount,
    },
  ];
}

function createAnomalyRecords(
  summary: M5AlphaContentScenarioSummary,
): readonly M5AnomalySaveRecord[] {
  return [
    {
      recordId: 1,
      anomalyKind: 1,
      selectedCandidateId: summary.borrowedShadow.activationCandidateId,
      activeCrisisCount: 0,
      resolvedCrisisCount: 1,
      evidenceKindCount: summary.borrowedShadow.evidenceKinds.length,
      terminalReason: 1,
      reviewTick: 0,
      ownerVersion: summary.roster.rosterVersion,
      queryVisitedCount: summary.roster.borrowedShadowVisitedCount,
      candidateCapHit: boolLane(summary.roster.borrowedShadowCandidateCapHit),
    },
    {
      recordId: 2,
      anomalyKind: 2,
      selectedCandidateId: summary.thirdKnock.selectedCandidateId,
      activeCrisisCount: summary.thirdKnock.metrics.activeCrisisCount,
      resolvedCrisisCount: summary.thirdKnock.metrics.resolvedCrisisCount,
      evidenceKindCount: summary.thirdKnock.evidenceKinds.length,
      terminalReason: summary.thirdKnock.terminalReason,
      reviewTick: summary.thirdKnock.review.tick,
      ownerVersion: summary.thirdKnock.metrics.ownerVersion,
      queryVisitedCount: summary.thirdKnock.queryVisitedCount,
      candidateCapHit: boolLane(summary.thirdKnock.queryCandidateCapHit),
    },
    {
      recordId: 3,
      anomalyKind: 3,
      selectedCandidateId: summary.oldBridge.selectedCandidateId,
      activeCrisisCount: summary.oldBridge.metrics.activeCrisisCount,
      resolvedCrisisCount: summary.oldBridge.metrics.resolvedCrisisCount,
      evidenceKindCount: summary.oldBridge.evidenceKinds.length,
      terminalReason: summary.oldBridge.terminalReason,
      reviewTick: summary.oldBridge.review.tick,
      ownerVersion: summary.oldBridge.metrics.ownerVersion,
      queryVisitedCount: summary.oldBridge.queryVisitedCount,
      candidateCapHit: boolLane(summary.oldBridge.queryCandidateCapHit),
    },
  ];
}

function createFactionRecords(
  summary: M5AlphaContentScenarioSummary,
): readonly M5FactionSaveRecord[] {
  const factionQuery = requireFactionQueryOk(summary.factionGovernance.factionQuery);
  return [
    {
      factKind: 1,
      selectedCount: factionQuery.selectedCount,
      activeFactCount: summary.factionGovernance.factionMetrics.activeFactCount,
      queryVisitedCount: factionQuery.visitedCount,
      ownerVersion: summary.factionGovernance.factionMetrics.ownerVersion,
      reason: factionQuery.reason,
    },
  ];
}

function createGovernanceRecords(
  summary: M5AlphaContentScenarioSummary,
): readonly M5GovernanceSaveRecord[] {
  const governanceAllowed = requireGovernanceQueryOk(summary.factionGovernance.governanceAllowed);
  const governanceBlocked = requireGovernanceQueryOk(summary.factionGovernance.governanceBlocked);
  return [
    {
      hookKind: 1,
      selectedCount: governanceAllowed.selectedCount,
      activeHookCount: summary.factionGovernance.governanceMetrics.activeHookCount,
      queryVisitedCount: governanceAllowed.visitedCount,
      allowed: boolLane(governanceAllowed.allowed),
      ownerVersion: summary.factionGovernance.governanceMetrics.ownerVersion,
      reason: governanceAllowed.reason,
    },
    {
      hookKind: 2,
      selectedCount: governanceBlocked.selectedCount,
      activeHookCount: summary.factionGovernance.governanceMetrics.activeHookCount,
      queryVisitedCount: governanceBlocked.visitedCount,
      allowed: boolLane(governanceBlocked.allowed),
      ownerVersion: summary.factionGovernance.governanceMetrics.ownerVersion,
      reason: governanceBlocked.reason,
    },
  ];
}

function createSeasonRecords(
  summary: M5AlphaContentScenarioSummary,
): readonly M5SeasonSaveRecord[] {
  return [
    {
      recordId: 1,
      selectionCount: summary.season.metrics.selectionCount,
      totalCandidateVisits: summary.season.metrics.totalCandidateVisits,
      activeIncidentCandidateCount: summary.season.metrics.activeIncidentCandidateCount,
      activeRecoveryCandidateCount: summary.season.metrics.activeRecoveryCandidateCount,
      preconditionFailureCount: summary.season.metrics.preconditionFailureCount,
      cooldownWriteCount: summary.season.metrics.cooldownWriteCount,
      freshnessWriteCount: summary.season.metrics.eventFreshnessWriteCount,
      ownerVersion: summary.season.metrics.ownerVersion,
      reason: summary.season.incidentSelection.reason,
    },
  ];
}

function createRandomStreamPositions(
  summary: M5AlphaContentScenarioSummary,
): readonly M5RandomStreamPositionRecord[] {
  const incidentSelection = requireSeasonSelectionOk(summary.season.incidentSelection);
  const recoverySelection = requireSeasonSelectionOk(summary.season.recoverySelection);
  const drawCount =
    summary.season.metrics.selectionCount +
    summary.season.metrics.cooldownWriteCount +
    summary.season.metrics.eventFreshnessWriteCount;
  const position = (incidentSelection.randomDraw ^ recoverySelection.randomDraw) >>> 0;
  return [
    {
      streamName: "m5-alpha-season-events",
      drawCount,
      position,
      stateHash: createRandomStreamStateHash(summary, drawCount, position),
    },
  ];
}

function createReviewRows(summary: M5AlphaContentScenarioSummary): readonly M5ReviewRowRecord[] {
  const recoverySelection = requireSeasonSelectionOk(summary.season.recoverySelection);
  return [
    {
      rowId: 1,
      sourceKind: 1,
      sourceId: summary.thirdKnock.review.crisisId,
      tick: summary.thirdKnock.review.tick,
      ownerVersion: summary.thirdKnock.review.ownerVersion,
      reason: summary.thirdKnock.review.reason,
    },
    {
      rowId: 2,
      sourceKind: 2,
      sourceId: summary.oldBridge.review.crisisId,
      tick: summary.oldBridge.review.tick,
      ownerVersion: summary.oldBridge.review.ownerVersion,
      reason: summary.oldBridge.review.reason,
    },
    {
      rowId: 3,
      sourceKind: 3,
      sourceId: recoverySelection.selectedCandidateId,
      tick: 470,
      ownerVersion: summary.season.metrics.ownerVersion,
      reason: recoverySelection.reason,
    },
  ];
}

function createQueueMetrics(summary: M5AlphaContentScenarioSummary): M5QueueMetricsRecord {
  const factionQuery = requireFactionQueryOk(summary.factionGovernance.factionQuery);
  const governanceAllowed = requireGovernanceQueryOk(summary.factionGovernance.governanceAllowed);
  const governanceBlocked = requireGovernanceQueryOk(summary.factionGovernance.governanceBlocked);
  const incidentSelection = requireSeasonSelectionOk(summary.season.incidentSelection);
  return {
    anomalyCandidateVisits:
      summary.roster.borrowedShadowVisitedCount +
      summary.thirdKnock.queryVisitedCount +
      summary.oldBridge.queryVisitedCount,
    factionCandidateVisits: factionQuery.visitedCount,
    governanceCandidateVisits: governanceAllowed.visitedCount + governanceBlocked.visitedCount,
    seasonCandidateVisits: summary.season.metrics.totalCandidateVisits,
    seasonPreconditionFailures: summary.season.metrics.preconditionFailureCount,
    capHitCount:
      boolLane(summary.roster.borrowedShadowCandidateCapHit) +
      boolLane(summary.thirdKnock.queryCandidateCapHit) +
      boolLane(summary.oldBridge.queryCandidateCapHit) +
      boolLane(factionQuery.candidateCapHit) +
      boolLane(incidentSelection.candidateCapHit),
  };
}

function createCheckpoints(requestedSeed: string, ticks: readonly Tick[]): M5CheckpointBuildResult {
  const checkpoints: M5ReplayCheckpoint[] = [];

  for (const tick of ticks) {
    if (!isSafeTick(tick)) {
      return { ok: false, reason: "m5_tick_invalid" };
    }
    const summary = runM5AlphaContentScenario({ seed: requestedSeed, ticks: tick });
    checkpoints.push(createReplayCheckpoint(summary));
  }

  return { ok: true, value: checkpoints };
}

function createResumedCheckpoints(
  loaded: Extract<M5SaveLoadResult, { readonly ok: true }>,
  ticks: readonly Tick[],
): M5CheckpointBuildResult {
  const checkpoints: M5ReplayCheckpoint[] = [];

  for (const tick of ticks) {
    if (!isSafeTick(tick) || tick < loaded.save.createdTick) {
      return { ok: false, reason: "m5_tick_invalid" };
    }
    const summary = runM5AlphaContentScenario({ seed: loaded.save.requestedSeed, ticks: tick });
    checkpoints.push(createReplayCheckpoint(summary));
  }

  return { ok: true, value: checkpoints };
}

function createReplayCheckpoint(summary: M5AlphaContentScenarioSummary): M5ReplayCheckpoint {
  const projection = createM5ReadOnlyProjection(
    summary,
    checkpointSequenceForTick(summary.finalTick),
  );
  return {
    tick: summary.finalTick,
    worldHash: summary.finalWorldHash,
    readModelHash: summary.readModelHash,
    checkpointHash: createCheckpointHash(summary, summary.readModelHash),
    rebuiltSurfaceHash: projection.rebuiltIndexes.indexHash,
  };
}

function createCheckpointHashRecords(
  requestedSeed: string,
  createdTick: Tick,
): readonly M5CheckpointHashRecord[] {
  const records: M5CheckpointHashRecord[] = [];
  for (const tick of M5_REPLAY_CHECKPOINT_SEQUENCE) {
    if (tick > createdTick) {
      continue;
    }
    const summary = runM5AlphaContentScenario({ seed: requestedSeed, ticks: tick });
    records.push({
      tick,
      worldHash: summary.finalWorldHash,
      readModelHash: summary.readModelHash,
      checkpointHash: createCheckpointHash(summary, summary.readModelHash),
    });
  }
  return records;
}

function createRenderSnapshotHash(
  summary: M5AlphaContentScenarioSummary,
  snapshotSequence: number,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "anomalyCount", value: summary.roster.definitionCount },
      { name: "checkpointSequence", value: snapshotSequence },
      { name: "contentManifestHash", value: summary.contentHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "strategyPathCount", value: summary.strategyPaths.length },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.finalWorldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createScenarioReadModelHash(summary: M5AlphaContentScenarioSummary): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "commandStreamHash", value: summary.commandStreamHash },
      { name: "contentManifestHash", value: summary.contentHash },
      { name: "oldBridgeReviewReason", value: summary.oldBridge.review.reason },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "seasonSelectionCount", value: summary.season.metrics.selectionCount },
      { name: "strategyPathCount", value: summary.strategyPaths.length },
      { name: "thirdKnockReviewReason", value: summary.thirdKnock.review.reason },
      { name: "tick", value: summary.finalTick },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createRebuiltSurfaceHashes(
  summary: M5AlphaContentScenarioSummary,
): readonly M5SurfaceHashRecord[] {
  const records: M5SurfaceHashRecord[] = [];

  for (let index = 0; index < M5_REBUILT_SURFACE_NAMES.length; index += 1) {
    const name = M5_REBUILT_SURFACE_NAMES[index];
    if (name === undefined) {
      continue;
    }
    records.push({
      name,
      hash: createSurfaceHash(summary, name),
      sourceVersion: index + 1,
    });
  }

  return records;
}

function createSurfaceHash(summary: M5AlphaContentScenarioSummary, name: string): string {
  let hash = hashStringToUint32("m5 rebuilt surface");
  hash = mixUint32(hash, hashStringToUint32(name));
  hash = mixUint32(hash, summary.finalTick);
  hash = mixUint32(hash, hashStringToUint32(summary.contentHash));
  hash = mixUint32(hash, hashStringToUint32(summary.finalWorldHash));
  hash = mixUint32(hash, hashStringToUint32(summary.readModelHash));
  hash = mixUint32(hash, summary.season.metrics.totalCandidateVisits);
  hash = mixUint32(hash, summary.factionGovernance.factionMetrics.totalQueryVisits);
  return formatUint32Hex(hash);
}

function createRebuiltIndexHash(
  summary: M5AlphaContentScenarioSummary,
  surfaces: readonly M5SurfaceHashRecord[],
): string {
  let hash = hashStringToUint32("m5 rebuilt indexes");
  hash = mixUint32(hash, summary.finalTick);
  hash = mixUint32(hash, hashStringToUint32(summary.contentHash));
  hash = mixUint32(hash, hashStringToUint32(summary.finalWorldHash));
  for (const surface of surfaces) {
    hash = mixUint32(hash, hashStringToUint32(surface.name));
    hash = mixUint32(hash, hashStringToUint32(surface.hash));
    hash = mixUint32(hash, surface.sourceVersion);
  }
  return formatUint32Hex(hash);
}

function createCheckpointHash(
  summary: M5AlphaContentScenarioSummary,
  readModelHash: string,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "commandStreamHash", value: summary.commandStreamHash },
      { name: "contentManifestHash", value: summary.contentHash },
      { name: "readModelHash", value: readModelHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.finalWorldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createLoadedStateHash(save: M5SaveEnvelope, projection: M5ReadOnlyProjection): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "contentManifestHash", value: save.contentManifestHash },
      { name: "createdTick", value: save.createdTick },
      { name: "projectionHash", value: projection.readModelHash },
      { name: "rebuiltIndexHash", value: projection.rebuiltIndexes.indexHash },
      { name: "scenarioId", value: save.scenarioId },
      { name: "seed", value: save.seed },
      { name: "worldHash", value: projection.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createRandomStreamStateHash(
  summary: M5AlphaContentScenarioSummary,
  drawCount: number,
  position: number,
): string {
  let hash = hashStringToUint32("m5 alpha stream");
  hash = mixUint32(hash, hashStringToUint32(summary.authoritativeScenarioSeed));
  hash = mixUint32(hash, hashStringToUint32(summary.contentHash));
  hash = mixUint32(hash, drawCount);
  hash = mixUint32(hash, position);
  return formatUint32Hex(hash);
}

function createCommandTail(createdTick: Tick): readonly M5CommandTailRecord[] {
  const records: M5CommandTailRecord[] = [];
  for (const command of M5_COMMANDS) {
    if (command.tick > createdTick) {
      continue;
    }

    records.push({
      tick: command.tick,
      sequence: command.sequence,
      commandHash: createCommandHash(command),
    });
  }

  const keepFrom = Math.max(0, records.length - 6);
  return records.slice(keepFrom);
}

function countCommandsThroughTick(tick: Tick): number {
  let count = 0;
  for (const command of M5_COMMANDS) {
    if (command.tick <= tick) {
      count += 1;
    }
  }
  return count;
}

function createCommandHash(command: M5ScenarioCommandRecord): string {
  let hash = hashStringToUint32(M5_ALPHA_CONTENT_SCENARIO_ID);
  hash = mixUint32(hash, command.tick);
  hash = mixUint32(hash, command.sequence);
  hash = mixUint32(hash, hashStringToUint32(command.reason));
  hash = mixUint32(hash, command.subjectId);
  hash = mixUint32(hash, command.targetId);
  return formatUint32Hex(hash);
}

function checkpointSequenceForTick(tick: Tick): number {
  for (let index = 0; index < M5_REPLAY_CHECKPOINT_SEQUENCE.length; index += 1) {
    if (M5_REPLAY_CHECKPOINT_SEQUENCE[index] === tick) {
      return index;
    }
  }

  return M5_REPLAY_CHECKPOINT_SEQUENCE.length;
}

function includeSaveTick(
  saveTick: Tick,
  finalTick: Tick,
  checkpointTicks: readonly Tick[],
): readonly Tick[] {
  const output: Tick[] = [];
  let saveTickSeen = false;
  let saveTickInserted = false;

  for (const tick of checkpointTicks) {
    if (tick < saveTick || tick > finalTick) {
      continue;
    }
    if (!saveTickInserted && saveTick < tick) {
      output.push(saveTick);
      saveTickInserted = true;
    }
    if (tick === saveTick) {
      saveTickSeen = true;
      saveTickInserted = true;
    }
    output.push(tick);
  }

  if (!saveTickSeen && !saveTickInserted && saveTick <= finalTick) {
    output.push(saveTick);
  }

  return output;
}

function normalizeCheckpointTicks(
  checkpointTicks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly Tick[] }
  | { readonly ok: false; readonly reason: M5SaveReplayReason } {
  let previous = -1;
  for (const tick of checkpointTicks) {
    if (!isSafeTick(tick) || tick <= previous) {
      return { ok: false, reason: "m5_checkpoint_order_invalid" };
    }
    previous = tick;
  }

  return { ok: true, value: checkpointTicks };
}

function createComparisonFailure(
  seed: string,
  firstDivergentTick: Tick | null,
  artifactPaths: M5ReplayArtifactPaths,
  reason: "checkpoint_count_mismatch" | "world_hash_mismatch" | "read_model_hash_mismatch",
): M5ReplayComparison {
  return {
    ok: false,
    scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
    seed,
    firstDivergentTick,
    reason,
    artifactPaths,
  };
}

function parseSaveEnvelope(
  input: unknown,
):
  | { readonly ok: true; readonly value: M5ParsedSaveEnvelope }
  | { readonly ok: false; readonly reason: M5SaveReplayReason } {
  if (!isRecord(input)) {
    return { ok: false, reason: "m5_save_magic_invalid" };
  }

  const envelope = readSaveEnvelope(input);
  if (envelope.magic !== M5_SAVE_MAGIC) {
    return { ok: false, reason: "m5_save_magic_invalid" };
  }

  if (
    envelope.formatVersion !== M5_SAVE_FORMAT_VERSION ||
    envelope.sectionDirectoryVersion !== M5_SECTION_DIRECTORY_VERSION
  ) {
    return { ok: false, reason: "m5_save_version_invalid" };
  }

  if (
    envelope.scenarioId !== M5_ALPHA_CONTENT_SCENARIO_ID ||
    envelope.alias !== M5_ALPHA_CONTENT_ALIAS
  ) {
    return { ok: false, reason: "m5_save_scenario_invalid" };
  }

  if (
    typeof envelope.requestedSeed !== "string" ||
    envelope.requestedSeed.length === 0 ||
    typeof envelope.seed !== "string"
  ) {
    return { ok: false, reason: "m5_save_seed_invalid" };
  }

  if (envelope.seed !== deriveM5AlphaContentScenarioSeed(envelope.requestedSeed)) {
    return { ok: false, reason: "m5_save_seed_mismatch" };
  }

  if (!isHashString(envelope.contentManifestHash) || !isHashString(envelope.commandStreamHash)) {
    return { ok: false, reason: "m5_save_content_manifest_mismatch" };
  }

  if (
    !isTickLane(envelope.createdTick) ||
    !isTickLane(envelope.nextTick) ||
    envelope.nextTick !== envelope.createdTick + 1
  ) {
    return { ok: false, reason: "m5_tick_invalid" };
  }

  if (!validateSectionsShape(envelope.sections)) {
    return { ok: false, reason: "m5_save_section_invalid" };
  }

  if (!validateProjectionShape(envelope.readOnlyProjection, envelope.createdTick)) {
    return { ok: false, reason: "m5_save_projection_invalid" };
  }

  return {
    ok: true,
    value: {
      rawSections: envelope.sections,
      rawProjection: envelope.readOnlyProjection,
      requestedSeed: envelope.requestedSeed,
      createdTick: envelope.createdTick,
      contentManifestHash: envelope.contentManifestHash,
      commandStreamHash: envelope.commandStreamHash,
    },
  };
}

function validateSectionsShape(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const sections = readSaveSections(input);
  return (
    validateOwnerStoresSection(sections.ownerStores) &&
    validateContentValidationSection(sections.contentValidation) &&
    validateRandomStreamsSection(sections.randomStreams) &&
    validateCommandLogTailSection(sections.commandLogTail) &&
    validateReasonMetricsSection(sections.reasonMetrics)
  );
}

function validateOwnerStoresSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const version = input["ownerStoresVersion"];
  const ownerHandles = input["ownerHandles"];
  const anomalyRecords = input["anomalyRecords"];
  const factionRecords = input["factionRecords"];
  const governanceRecords = input["governanceRecords"];
  const seasonRecords = input["seasonRecords"];
  if (
    version !== M5_SECTION_VERSION ||
    !Array.isArray(ownerHandles) ||
    !Array.isArray(anomalyRecords) ||
    !Array.isArray(factionRecords) ||
    !Array.isArray(governanceRecords) ||
    !Array.isArray(seasonRecords)
  ) {
    return false;
  }

  return (
    validateOwnerHandles(ownerHandles) &&
    validateAnomalyRecords(anomalyRecords) &&
    validateFactionRecords(factionRecords) &&
    validateGovernanceRecords(governanceRecords) &&
    validateSeasonRecords(seasonRecords)
  );
}

function validateOwnerHandles(records: readonly unknown[]): boolean {
  let previousHandle = -1;
  for (const input of records) {
    if (!isRecord(input)) {
      return false;
    }
    const handleId = input["handleId"];
    if (!isUintLane(handleId) || handleId <= previousHandle) {
      return false;
    }
    if (
      !isPositiveUint32(input["storeKind"]) ||
      !isPositiveUint32(input["ownerVersion"]) ||
      !isUintLane(input["activeCount"])
    ) {
      return false;
    }
    previousHandle = handleId;
  }

  return records.length === 7;
}

function validateAnomalyRecords(records: readonly unknown[]): boolean {
  let previousRecord = -1;
  for (const input of records) {
    if (!isRecord(input)) {
      return false;
    }
    const recordId = input["recordId"];
    if (!isUintLane(recordId) || recordId <= previousRecord) {
      return false;
    }
    if (
      !isPositiveUint32(input["anomalyKind"]) ||
      !isUintLane(input["selectedCandidateId"]) ||
      !isUintLane(input["activeCrisisCount"]) ||
      !isUintLane(input["resolvedCrisisCount"]) ||
      !isUintLane(input["evidenceKindCount"]) ||
      !isUintLane(input["terminalReason"]) ||
      !isTickLane(input["reviewTick"]) ||
      !isPositiveUint32(input["ownerVersion"]) ||
      !isUintLane(input["queryVisitedCount"]) ||
      !isBinaryLane(input["candidateCapHit"])
    ) {
      return false;
    }
    previousRecord = recordId;
  }
  return records.length === 3;
}

function validateFactionRecords(records: readonly unknown[]): boolean {
  for (const input of records) {
    if (!isRecord(input)) {
      return false;
    }
    if (
      !isPositiveUint32(input["factKind"]) ||
      !isUintLane(input["selectedCount"]) ||
      !isUintLane(input["activeFactCount"]) ||
      !isUintLane(input["queryVisitedCount"]) ||
      !isPositiveUint32(input["ownerVersion"]) ||
      typeof input["reason"] !== "string"
    ) {
      return false;
    }
  }
  return records.length === 1;
}

function validateGovernanceRecords(records: readonly unknown[]): boolean {
  let previousHook = 0;
  for (const input of records) {
    if (!isRecord(input)) {
      return false;
    }
    const hookKind = input["hookKind"];
    if (!isPositiveUint32(hookKind) || hookKind <= previousHook) {
      return false;
    }
    if (
      !isUintLane(input["selectedCount"]) ||
      !isUintLane(input["activeHookCount"]) ||
      !isUintLane(input["queryVisitedCount"]) ||
      !isBinaryLane(input["allowed"]) ||
      !isPositiveUint32(input["ownerVersion"]) ||
      typeof input["reason"] !== "string"
    ) {
      return false;
    }
    previousHook = hookKind;
  }
  return records.length === 2;
}

function validateSeasonRecords(records: readonly unknown[]): boolean {
  for (const input of records) {
    if (!isRecord(input)) {
      return false;
    }
    if (
      !isPositiveUint32(input["recordId"]) ||
      !isUintLane(input["selectionCount"]) ||
      !isUintLane(input["totalCandidateVisits"]) ||
      !isUintLane(input["activeIncidentCandidateCount"]) ||
      !isUintLane(input["activeRecoveryCandidateCount"]) ||
      !isUintLane(input["preconditionFailureCount"]) ||
      !isUintLane(input["cooldownWriteCount"]) ||
      !isUintLane(input["freshnessWriteCount"]) ||
      !isPositiveUint32(input["ownerVersion"]) ||
      typeof input["reason"] !== "string"
    ) {
      return false;
    }
  }
  return records.length === 1;
}

function validateContentValidationSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  return (
    input["contentValidationVersion"] === M5_SECTION_VERSION &&
    isHashString(input["contentManifestHash"]) &&
    isPositiveUint32(input["definitionCount"]) &&
    isPositiveUint32(input["catalogEntryCount"]) &&
    isPositiveUint32(input["reviewNoteCount"]) &&
    isUintLane(input["blockedCatalogEntryCount"]) &&
    isUintLane(input["blockedReasonCount"])
  );
}

function validateRandomStreamsSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const records = input["streamPositions"];
  if (input["randomStreamsVersion"] !== M5_SECTION_VERSION || !Array.isArray(records)) {
    return false;
  }

  for (const record of records) {
    if (!isRecord(record)) {
      return false;
    }
    if (
      typeof record["streamName"] !== "string" ||
      !isUintLane(record["drawCount"]) ||
      !isUintLane(record["position"]) ||
      !isHashString(record["stateHash"])
    ) {
      return false;
    }
  }

  return records.length === 1;
}

function validateCommandLogTailSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const commandTail = input["commandTail"];
  if (
    input["commandLogTailVersion"] !== M5_SECTION_VERSION ||
    !isTickLane(input["checkpointTick"]) ||
    !isHashString(input["checkpointWorldHash"]) ||
    !isHashString(input["commandStreamHash"]) ||
    !isHashString(input["contentManifestHash"]) ||
    !isUintLane(input["nextCommandSequence"]) ||
    !Array.isArray(commandTail)
  ) {
    return false;
  }

  let previousSequence = -1;
  for (const row of commandTail) {
    if (!isRecord(row)) {
      return false;
    }
    const sequence = row["sequence"];
    if (!isTickLane(row["tick"]) || !isUintLane(sequence) || sequence <= previousSequence) {
      return false;
    }
    if (!isHashString(row["commandHash"])) {
      return false;
    }
    previousSequence = sequence;
  }

  return commandTail.length > 0;
}

function validateReasonMetricsSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const checkpointHashes = input["checkpointHashes"];
  const reviewRows = input["reviewRows"];
  if (
    input["reasonMetricsVersion"] !== M5_SECTION_VERSION ||
    !Array.isArray(checkpointHashes) ||
    !Array.isArray(reviewRows) ||
    !validateQueueMetrics(input["queueMetrics"])
  ) {
    return false;
  }

  return validateCheckpointHashes(checkpointHashes) && validateReviewRows(reviewRows);
}

function validateCheckpointHashes(records: readonly unknown[]): boolean {
  let previousTick = -1;
  for (const input of records) {
    if (!isRecord(input)) {
      return false;
    }
    const tick = input["tick"];
    if (!isTickLane(tick) || tick <= previousTick) {
      return false;
    }
    if (
      !isHashString(input["worldHash"]) ||
      !isHashString(input["readModelHash"]) ||
      !isHashString(input["checkpointHash"])
    ) {
      return false;
    }
    previousTick = tick;
  }
  return records.length > 0;
}

function validateReviewRows(records: readonly unknown[]): boolean {
  let previousRow = -1;
  for (const input of records) {
    if (!isRecord(input)) {
      return false;
    }
    const rowId = input["rowId"];
    if (!isUintLane(rowId) || rowId <= previousRow) {
      return false;
    }
    if (
      !isPositiveUint32(input["sourceKind"]) ||
      !isUintLane(input["sourceId"]) ||
      !isTickLane(input["tick"]) ||
      !isPositiveUint32(input["ownerVersion"]) ||
      typeof input["reason"] !== "string"
    ) {
      return false;
    }
    previousRow = rowId;
  }
  return records.length === 3;
}

function validateQueueMetrics(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  return (
    isUintLane(input["anomalyCandidateVisits"]) &&
    isUintLane(input["factionCandidateVisits"]) &&
    isUintLane(input["governanceCandidateVisits"]) &&
    isUintLane(input["seasonCandidateVisits"]) &&
    isUintLane(input["seasonPreconditionFailures"]) &&
    isUintLane(input["capHitCount"])
  );
}

function validateProjectionShape(input: unknown, createdTick: Tick): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const rebuilt = input["rebuiltIndexes"];
  if (
    input["projectionVersion"] !== 1 ||
    input["scenarioId"] !== M5_ALPHA_CONTENT_SCENARIO_ID ||
    input["tick"] !== createdTick ||
    !isHashString(input["contentManifestHash"]) ||
    !isHashString(input["worldHash"]) ||
    !isHashString(input["readModelHash"]) ||
    !isRecord(rebuilt)
  ) {
    return false;
  }

  const names = rebuilt["names"];
  const surfaces = rebuilt["surfaces"];
  if (!Array.isArray(names) || !Array.isArray(surfaces)) {
    return false;
  }

  if (names.length !== M5_REBUILT_SURFACE_NAMES.length) {
    return false;
  }

  for (let index = 0; index < names.length; index += 1) {
    if (names[index] !== M5_REBUILT_SURFACE_NAMES[index]) {
      return false;
    }
  }

  return (
    rebuilt["rebuiltIndexesSchemaVersion"] === 1 &&
    rebuilt["basisTick"] === createdTick &&
    isHashString(rebuilt["basisWorldHash"]) &&
    rebuilt["rebuildTimeTicks"] === 2 &&
    isHashString(rebuilt["indexHash"])
  );
}

function readSaveEnvelope(record: Record<string, unknown>): UnknownSaveEnvelope {
  return {
    magic: record["magic"],
    formatVersion: record["formatVersion"],
    sectionDirectoryVersion: record["sectionDirectoryVersion"],
    scenarioId: record["scenarioId"],
    alias: record["alias"],
    requestedSeed: record["requestedSeed"],
    seed: record["seed"],
    contentManifestHash: record["contentManifestHash"],
    commandStreamHash: record["commandStreamHash"],
    createdTick: record["createdTick"],
    nextTick: record["nextTick"],
    sections: record["sections"],
    readOnlyProjection: record["readOnlyProjection"],
  };
}

function readSaveSections(record: Record<string, unknown>): UnknownSaveSections {
  return {
    ownerStores: record["ownerStores"],
    contentValidation: record["contentValidation"],
    randomStreams: record["randomStreams"],
    commandLogTail: record["commandLogTail"],
    reasonMetrics: record["reasonMetrics"],
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUintLane(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isTickLane(value: unknown): value is Tick {
  return typeof value === "number" && isSafeTick(value);
}

function isPositiveUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff
  );
}

function isBinaryLane(value: unknown): value is number {
  return value === 0 || value === 1;
}

function isHashString(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10) {
    return false;
  }

  if (!value.startsWith("0x")) {
    return false;
  }

  for (let index = 2; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const digit = code >= 48 && code <= 57;
    const lowerHex = code >= 97 && code <= 102;
    if (!digit && !lowerHex) {
      return false;
    }
  }

  return true;
}

function boolLane(value: boolean): number {
  return value ? 1 : 0;
}

function requireFactionQueryOk(
  result: M5AlphaContentScenarioSummary["factionGovernance"]["factionQuery"],
): M5FactionQueryOk {
  if (!result.ok) {
    throw new Error(`M5 save replay requires successful faction query: ${result.reason}`);
  }
  return result;
}

function requireGovernanceQueryOk(
  result: M5AlphaContentScenarioSummary["factionGovernance"]["governanceAllowed"],
): M5GovernanceQueryOk {
  if (!result.ok) {
    throw new Error(`M5 save replay requires successful governance query: ${result.reason}`);
  }
  return result;
}

function requireSeasonSelectionOk(
  result: M5AlphaContentScenarioSummary["season"]["incidentSelection"],
): M5SeasonSelectionOk {
  if (!result.ok) {
    throw new Error(`M5 save replay requires successful season selection: ${result.reason}`);
  }
  return result;
}

interface M5ScenarioCommandRecord {
  readonly tick: Tick;
  readonly sequence: number;
  readonly reason: M5AlphaContentScenarioReason;
  readonly subjectId: number;
  readonly targetId: number;
}

const M5_COMMANDS: readonly M5ScenarioCommandRecord[] = Object.freeze([
  { tick: 0, sequence: 0, reason: "m5.alpha.scenario.initialized", subjectId: 1, targetId: 1 },
  {
    tick: 1,
    sequence: 1,
    reason: "m5.alpha.content_catalog.accepted",
    subjectId: 30,
    targetId: 1,
  },
  { tick: 2, sequence: 2, reason: "m5.alpha.anomaly_roster.loaded", subjectId: 5, targetId: 3 },
  {
    tick: 80,
    sequence: 3,
    reason: "m5.alpha.borrowed_shadow.rostered",
    subjectId: 0,
    targetId: 10,
  },
  {
    tick: 120,
    sequence: 4,
    reason: "m5.alpha.third_knock.non_combat_contained",
    subjectId: 0,
    targetId: 1_100,
  },
  {
    tick: 220,
    sequence: 5,
    reason: "m5.alpha.old_bridge.reciprocity_resolved",
    subjectId: 1,
    targetId: 2_300,
  },
  {
    tick: 320,
    sequence: 6,
    reason: "m5.alpha.faction_strategy.selected",
    subjectId: 1,
    targetId: 20,
  },
  {
    tick: 330,
    sequence: 7,
    reason: "m5.alpha.governance_policy.allowed",
    subjectId: 1,
    targetId: 10,
  },
  {
    tick: 340,
    sequence: 8,
    reason: "m5.alpha.governance_policy.risk_blocked",
    subjectId: 1,
    targetId: 1,
  },
  {
    tick: 400,
    sequence: 9,
    reason: "m5.alpha.season.precondition_failed",
    subjectId: 0,
    targetId: 1,
  },
  {
    tick: 430,
    sequence: 10,
    reason: "m5.alpha.season.incident_selected",
    subjectId: 0,
    targetId: 1,
  },
  {
    tick: 440,
    sequence: 11,
    reason: "m5.alpha.season.cooldown_recorded",
    subjectId: 0,
    targetId: 1,
  },
  {
    tick: 470,
    sequence: 12,
    reason: "m5.alpha.season.recovery_selected",
    subjectId: 5,
    targetId: 2,
  },
  {
    tick: 600,
    sequence: 13,
    reason: "m5.alpha.m4_regression.preserved",
    subjectId: 4,
    targetId: 36_000,
  },
  {
    tick: 700,
    sequence: 14,
    reason: "m5.alpha.downstream.stop_signs.recorded",
    subjectId: 81,
    targetId: 83,
  },
]);
