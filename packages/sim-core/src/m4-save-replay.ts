import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import {
  M4_BORROWED_SHADOW_STATE_EMPTY,
  M4_BORROWED_SHADOW_STATE_FAILED,
  M4_BORROWED_SHADOW_STATE_RESOLVED,
  M4_BORROWED_SHADOW_TERMINAL_NONE,
} from "./m4-borrowed-shadow-types";
import {
  M4_CORE_VERTICAL_SLICE_ALIAS,
  M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  deriveM4CoreVerticalSliceScenarioSeed,
  runM4CoreVerticalSliceScenario,
  type M4CoreBoundedReadEvidence,
  type M4CoreDawnReviewRow,
  type M4CorePathEvidence,
  type M4CoreScenarioInvariantCounters,
  type M4CoreVerticalSliceScenarioSummary,
} from "./m4-core-vertical-slice-scenario";
import {
  M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
  M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
  M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
} from "./m4-director-types";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash } from "./world-hash";

export const M4_SAVE_MAGIC = "wuming-town.m4.core-vertical-slice.save";
export const M4_SAVE_FORMAT_VERSION = 1;
export const M4_SECTION_DIRECTORY_VERSION = 1;
export const M4_SECTION_VERSION = 1;
export const M4_READ_MODEL_HASH_VERSION = 1;
export const M4_SAVE_TICK = 12_000;
export const M4_LOAD_TICK = 12_001;
export const M4_FINAL_TICK = M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS;
export const M4_COMMAND_PREFIX = "m4.core-vertical-slice.advance.";

export const M4_REPLAY_CHECKPOINT_SEQUENCE: readonly Tick[] = Object.freeze([
  0,
  3_600,
  7_200,
  M4_SAVE_TICK,
  18_000,
  M4_FINAL_TICK,
]);

export const M4_REBUILT_SURFACE_NAMES: readonly string[] = Object.freeze([
  "lamp-gap",
  "evidence",
  "dissemination",
  "obligation",
  "town-rule",
  "crisis",
  "director",
  "work-offers",
  "path",
  "read-model",
  "dawn-review",
  "metrics",
]);

export type M4SaveReplayReason =
  | "m4_save_ok"
  | "m4_save_seed_invalid"
  | "m4_tick_invalid"
  | "m4_checkpoint_order_invalid"
  | "m4_save_magic_invalid"
  | "m4_save_version_invalid"
  | "m4_save_scenario_invalid"
  | "m4_save_seed_mismatch"
  | "m4_save_section_invalid"
  | "m4_save_projection_invalid"
  | "m4_save_integrity_mismatch"
  | "m4_load_tick_invalid"
  | "m4_resume_tick_before_save";

export interface M4ReplayOptions {
  readonly seed: string;
  readonly checkpointTicks?: readonly Tick[];
}

export interface M4ResumeOptions {
  readonly save: unknown;
  readonly loadTick: Tick;
  readonly finalTick: Tick;
  readonly checkpointTicks?: readonly Tick[];
}

export interface M4ReplayCheckpoint {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly checkpointHash: string;
  readonly rebuiltIndexHash: string;
}

export interface M4ReplayRun {
  readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly source: "uninterrupted" | "loaded-save";
  readonly loadedStateHash: string;
  readonly checkpoints: readonly M4ReplayCheckpoint[];
  readonly finalTick: Tick;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
}

export interface M4ReplayArtifactPaths {
  readonly expectedPath: string;
  readonly actualPath: string;
  readonly diffPath: string;
}

export type M4ReplayComparison =
  | {
      readonly ok: true;
      readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
      readonly seed: string;
      readonly checkpointCount: number;
      readonly artifactPaths: M4ReplayArtifactPaths;
    }
  | {
      readonly ok: false;
      readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
      readonly seed: string;
      readonly firstDivergentTick: Tick | null;
      readonly reason:
        | "checkpoint_count_mismatch"
        | "world_hash_mismatch"
        | "read_model_hash_mismatch";
      readonly artifactPaths: M4ReplayArtifactPaths;
    };

export interface M4SaveEnvelope {
  readonly magic: typeof M4_SAVE_MAGIC;
  readonly formatVersion: typeof M4_SAVE_FORMAT_VERSION;
  readonly sectionDirectoryVersion: typeof M4_SECTION_DIRECTORY_VERSION;
  readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
  readonly alias: typeof M4_CORE_VERTICAL_SLICE_ALIAS;
  readonly requestedSeed: string;
  readonly seed: string;
  readonly contentHash: string;
  readonly commandStreamHash: string;
  readonly createdTick: Tick;
  readonly nextTick: Tick;
  readonly sections: M4SaveSections;
  readonly readOnlyProjection: M4ReadOnlyProjection;
}

export interface M4SaveSections {
  readonly ownerStores: M4OwnerStoresSection;
  readonly crisisDirector: M4CrisisDirectorSection;
  readonly commandLogTail: M4CommandLogTailSection;
  readonly reasonMetrics: M4ReasonMetricsSection;
}

export interface M4OwnerStoresSection {
  readonly ownerStoresVersion: typeof M4_SECTION_VERSION;
  readonly ownerHandles: readonly M4OwnerHandleRecord[];
  readonly branchRecords: readonly M4OwnerBranchRecord[];
}

export interface M4OwnerHandleRecord {
  readonly handleId: number;
  readonly storeKind: number;
  readonly ownerVersion: number;
  readonly activeCount: number;
}

export interface M4OwnerBranchRecord {
  readonly branchId: number;
  readonly crisisId: number;
  readonly selectedCandidateId: number;
  readonly activationTick: Tick;
  readonly identityConfirmedTick: Tick;
  readonly obligationFulfilledTick: Tick;
  readonly townRuleDecisionTick: Tick;
  readonly identityConfirmed: number;
  readonly identitySupportTier: number;
  readonly identityIndependentClassCount: number;
  readonly evidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly townRuleOwnerVersion: number;
  readonly supportTier: number;
  readonly lowRiskEvidenceCount: number;
  readonly evidenceBeforeIrreversibleHarm: number;
  readonly terminalReason: number;
  readonly dawnReviewRowId: number;
}

export interface M4CrisisDirectorSection {
  readonly crisisDirectorVersion: typeof M4_SECTION_VERSION;
  readonly crisisRecords: readonly M4CrisisRecord[];
  readonly recoveryWindowRecords: readonly M4DirectorRecoveryWindowRecord[];
}

export interface M4CrisisRecord {
  readonly crisisId: number;
  readonly branchId: number;
  readonly state: number;
  readonly activationTick: Tick;
  readonly lowRiskEvidenceCount: number;
  readonly evidenceBeforeIrreversibleHarm: number;
  readonly terminalReason: number;
  readonly ownerVersion: number;
}

export interface M4DirectorRecoveryWindowRecord {
  readonly windowId: number;
  readonly recoveryType: number;
  readonly startTick: Tick;
  readonly endTick: Tick;
  readonly sourceSampleVersion: number;
  readonly selectedCommandKind: number;
}

export interface M4CommandLogTailSection {
  readonly commandLogTailVersion: typeof M4_SECTION_VERSION;
  readonly checkpointTick: Tick;
  readonly checkpointWorldHash: string;
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly nextCommandSequence: number;
  readonly commandTail: readonly M4CommandTailRecord[];
}

export interface M4CommandTailRecord {
  readonly tick: Tick;
  readonly sequence: number;
  readonly commandHash: string;
}

export interface M4ReasonMetricsSection {
  readonly reasonMetricsVersion: typeof M4_SECTION_VERSION;
  readonly checkpointHashes: readonly M4CheckpointHashRecord[];
  readonly boundedReads: M4CoreBoundedReadEvidence;
  readonly invariantCounters: M4CoreScenarioInvariantCounters;
  readonly dawnReviewRows: readonly M4CoreDawnReviewRow[];
}

export interface M4CheckpointHashRecord {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly checkpointHash: string;
}

export interface M4SurfaceHashRecord {
  readonly name: string;
  readonly hash: string;
  readonly sourceVersion: number;
}

export interface M4ReadOnlyProjection {
  readonly projectionVersion: 1;
  readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly renderSnapshot: M4RenderSnapshot;
  readonly scenarioReadModel: M4ScenarioReadModel;
  readonly rebuiltIndexes: M4RebuiltIndexes;
}

export interface M4RenderSnapshot {
  readonly renderSnapshotSchemaVersion: 1;
  readonly snapshotSequence: number;
  readonly tick: Tick;
  readonly branchCount: number;
  readonly worldHash: string;
  readonly readModelHash: string;
}

export interface M4ScenarioReadModel {
  readonly scenarioReadModelSchemaVersion: 1;
  readonly scenarioId: typeof M4_CORE_VERTICAL_SLICE_SCENARIO_ID;
  readonly basisTick: Tick;
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly dawnReviewRowCount: number;
  readonly boundedReadHash: string;
  readonly detailHash: string;
  readonly summaries: readonly string[];
}

export interface M4RebuiltIndexes {
  readonly rebuiltIndexesSchemaVersion: 1;
  readonly names: readonly string[];
  readonly surfaces: readonly M4SurfaceHashRecord[];
  readonly basisTick: Tick;
  readonly basisWorldHash: string;
  readonly rebuildTimeTicks: number;
  readonly indexHash: string;
}

export type M4SaveLoadResult =
  | {
      readonly ok: true;
      readonly save: M4SaveEnvelope;
      readonly loadTick: typeof M4_LOAD_TICK;
      readonly validationTimeTicks: number;
      readonly rebuildTimeTicks: number;
      readonly rebuiltSurfaceNames: readonly string[];
      readonly projection: M4ReadOnlyProjection;
      readonly loadedStateHash: string;
    }
  | { readonly ok: false; readonly reason: M4SaveReplayReason };

export type M4ReplayResult =
  | { readonly ok: true; readonly replay: M4ReplayRun }
  | { readonly ok: false; readonly reason: M4SaveReplayReason };

interface M4ParsedSaveEnvelope {
  readonly rawSections: unknown;
  readonly rawProjection: unknown;
  readonly requestedSeed: string;
  readonly createdTick: Tick;
  readonly contentHash: string;
  readonly commandStreamHash: string;
}

export function runM4CoreVerticalSliceReplay(options: M4ReplayOptions): M4ReplayResult {
  if (options.seed.length === 0) {
    return { ok: false, reason: "m4_save_seed_invalid" };
  }

  const ticks = normalizeCheckpointTicks(options.checkpointTicks ?? M4_REPLAY_CHECKPOINT_SEQUENCE);
  if (!ticks.ok) {
    return ticks;
  }

  const checkpoints = createCheckpoints(options.seed, ticks.value);
  if (!checkpoints.ok) {
    return checkpoints;
  }

  const finalCheckpoint = checkpoints.value[checkpoints.value.length - 1];
  if (finalCheckpoint === undefined) {
    return { ok: false, reason: "m4_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      seed: deriveM4CoreVerticalSliceScenarioSeed(options.seed),
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

export function createM4CoreVerticalSliceSaveEnvelope(
  requestedSeed: string,
  createdTick: Tick = M4_SAVE_TICK,
): M4SaveEnvelope {
  if (requestedSeed.length === 0 || !isSafeTick(createdTick)) {
    throw new Error("M4 save replay requires a non-empty seed and safe save tick");
  }

  const summary = runM4CoreVerticalSliceScenario({ seed: requestedSeed, ticks: createdTick });
  const projection = createM4ReadOnlyProjection(summary, checkpointSequenceForTick(createdTick));
  const sections = createSections(createdTick, summary, projection.readModelHash);

  return {
    magic: M4_SAVE_MAGIC,
    formatVersion: M4_SAVE_FORMAT_VERSION,
    sectionDirectoryVersion: M4_SECTION_DIRECTORY_VERSION,
    scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    alias: M4_CORE_VERTICAL_SLICE_ALIAS,
    requestedSeed,
    seed: summary.authoritativeScenarioSeed,
    contentHash: summary.contentHash,
    commandStreamHash: summary.commandStreamHash,
    createdTick,
    nextTick: createdTick + 1,
    sections,
    readOnlyProjection: projection,
  };
}

export function loadM4CoreVerticalSliceSaveEnvelope(input: unknown): M4SaveLoadResult {
  const parsed = parseSaveEnvelope(input);
  if (!parsed.ok) {
    return parsed;
  }

  const save = parsed.value;
  const expected = createM4CoreVerticalSliceSaveEnvelope(save.requestedSeed, save.createdTick);
  if (
    save.contentHash !== expected.contentHash ||
    save.commandStreamHash !== expected.commandStreamHash ||
    stableJson(save.rawSections) !== stableJson(expected.sections)
  ) {
    return { ok: false, reason: "m4_save_integrity_mismatch" };
  }

  if (stableJson(save.rawProjection) !== stableJson(expected.readOnlyProjection)) {
    return { ok: false, reason: "m4_save_projection_invalid" };
  }

  const loadedStateHash = createLoadedStateHash(expected, expected.readOnlyProjection);
  return {
    ok: true,
    save: expected,
    loadTick: M4_LOAD_TICK,
    validationTimeTicks: 1,
    rebuildTimeTicks: expected.readOnlyProjection.rebuiltIndexes.rebuildTimeTicks,
    rebuiltSurfaceNames: M4_REBUILT_SURFACE_NAMES,
    projection: expected.readOnlyProjection,
    loadedStateHash,
  };
}

export function resumeM4CoreVerticalSliceFromSave(options: M4ResumeOptions): M4ReplayResult {
  const loaded = loadM4CoreVerticalSliceSaveEnvelope(options.save);
  if (!loaded.ok) {
    return loaded;
  }

  if (!isSafeTick(options.finalTick) || !isSafeTick(options.loadTick)) {
    return { ok: false, reason: "m4_tick_invalid" };
  }

  if (options.loadTick !== loaded.save.createdTick + 1 || options.loadTick !== M4_LOAD_TICK) {
    return { ok: false, reason: "m4_load_tick_invalid" };
  }

  if (options.finalTick < loaded.save.createdTick) {
    return { ok: false, reason: "m4_resume_tick_before_save" };
  }

  const ticks = includeSaveTick(
    loaded.save.createdTick,
    options.finalTick,
    options.checkpointTicks ?? M4_REPLAY_CHECKPOINT_SEQUENCE,
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
    return { ok: false, reason: "m4_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
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

export function createM4ReadOnlyProjection(
  summary: M4CoreVerticalSliceScenarioSummary,
  snapshotSequence: number,
): M4ReadOnlyProjection {
  const renderSnapshotHash = createRenderSnapshotHash(summary, snapshotSequence);
  const boundedReadHash = createBoundedReadHash(summary.boundedReads);
  const scenarioReadModelHash = createScenarioReadModelHash(summary, boundedReadHash);
  const rebuiltSurfaces = createRebuiltSurfaceHashes(summary);
  const rebuiltIndexHash = createRebuiltIndexHash(summary, rebuiltSurfaces);
  const readModelHash = formatCanonicalWorldHash({
    fields: [
      { name: "hashVersion", value: M4_READ_MODEL_HASH_VERSION },
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
    scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    tick: summary.finalTick,
    worldHash: summary.finalWorldHash,
    readModelHash,
    renderSnapshot: {
      renderSnapshotSchemaVersion: 1,
      snapshotSequence,
      tick: summary.finalTick,
      branchCount: 3,
      worldHash: summary.finalWorldHash,
      readModelHash: renderSnapshotHash,
    },
    scenarioReadModel: {
      scenarioReadModelSchemaVersion: 1,
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      basisTick: summary.finalTick,
      commandStreamHash: summary.commandStreamHash,
      contentHash: summary.contentHash,
      dawnReviewRowCount: summary.dawnReviewRows.length,
      boundedReadHash,
      detailHash: scenarioReadModelHash,
      summaries: [
        `prevention=${String(summary.preventionPath.activationBasis.identityConfirmed)}`,
        `containment=${String(summary.containmentPath.terminalReason)}`,
        `failure=${String(summary.failurePath.terminalReason)}`,
        `dawnRows=${String(summary.dawnReviewRows.length)}`,
      ],
    },
    rebuiltIndexes: {
      rebuiltIndexesSchemaVersion: 1,
      names: M4_REBUILT_SURFACE_NAMES,
      surfaces: rebuiltSurfaces,
      basisTick: summary.finalTick,
      basisWorldHash: summary.finalWorldHash,
      rebuildTimeTicks: 1,
      indexHash: rebuiltIndexHash,
    },
  };
}

export function compareM4ReplayRuns(
  expected: M4ReplayRun,
  actual: M4ReplayRun,
  artifactPaths: M4ReplayArtifactPaths,
): M4ReplayComparison {
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
    scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    seed: expected.seed,
    checkpointCount: expected.checkpoints.length,
    artifactPaths,
  };
}

export function createM4AdvanceCommandId(tick: Tick, sequence: number): string {
  if (!isSafeTick(tick) || !Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("M4 advance command id requires safe non-negative integer fields");
  }

  return `${M4_COMMAND_PREFIX}${String(tick)}.${String(sequence)}`;
}

export function parseM4AdvanceCommandId(
  commandId: string,
): { readonly ok: true; readonly tick: Tick; readonly sequence: number } | { readonly ok: false } {
  if (!commandId.startsWith(M4_COMMAND_PREFIX)) {
    return { ok: false };
  }

  const rest = commandId.slice(M4_COMMAND_PREFIX.length);
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

function createSections(
  createdTick: Tick,
  summary: M4CoreVerticalSliceScenarioSummary,
  checkpointReadModelHash: string,
): M4SaveSections {
  return {
    ownerStores: {
      ownerStoresVersion: M4_SECTION_VERSION,
      ownerHandles: createOwnerHandles(summary),
      branchRecords: [
        createBranchRecord(summary.preventionPath),
        createBranchRecord(summary.containmentPath),
        createBranchRecord(summary.failurePath),
      ],
    },
    crisisDirector: {
      crisisDirectorVersion: M4_SECTION_VERSION,
      crisisRecords: [
        createCrisisRecord(summary.preventionPath, M4_BORROWED_SHADOW_STATE_EMPTY, 13),
        createCrisisRecord(summary.containmentPath, M4_BORROWED_SHADOW_STATE_RESOLVED, 17),
        createCrisisRecord(summary.failurePath, M4_BORROWED_SHADOW_STATE_FAILED, 19),
      ],
      recoveryWindowRecords: [
        {
          windowId: 0,
          recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
          startTick: 3_000,
          endTick: 4_200,
          sourceSampleVersion: 6,
          selectedCommandKind: M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
        },
        {
          windowId: 1,
          recoveryType: M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
          startTick: 5_400,
          endTick: 6_000,
          sourceSampleVersion: 7,
          selectedCommandKind: M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
        },
      ],
    },
    commandLogTail: {
      commandLogTailVersion: M4_SECTION_VERSION,
      checkpointTick: createdTick,
      checkpointWorldHash: summary.finalWorldHash,
      commandStreamHash: summary.commandStreamHash,
      contentHash: summary.contentHash,
      nextCommandSequence: countCommandsThroughTick(createdTick),
      commandTail: createCommandTail(createdTick),
    },
    reasonMetrics: {
      reasonMetricsVersion: M4_SECTION_VERSION,
      checkpointHashes: [
        {
          tick: createdTick,
          worldHash: summary.finalWorldHash,
          readModelHash: checkpointReadModelHash,
          checkpointHash: createCheckpointHash(summary, createdTick, checkpointReadModelHash),
        },
      ],
      boundedReads: summary.boundedReads,
      invariantCounters: summary.invariantCounters,
      dawnReviewRows: summary.dawnReviewRows,
    },
  };
}

function createOwnerHandles(
  summary: M4CoreVerticalSliceScenarioSummary,
): readonly M4OwnerHandleRecord[] {
  return [
    {
      handleId: 0,
      storeKind: 1,
      ownerVersion: summary.preventionPath.activationBasis.evidenceOwnerVersion,
      activeCount: 1,
    },
    {
      handleId: 1,
      storeKind: 2,
      ownerVersion: summary.containmentPath.activationBasis.obligationOwnerVersion,
      activeCount: 3,
    },
    {
      handleId: 2,
      storeKind: 3,
      ownerVersion: summary.containmentPath.activationBasis.townRuleOwnerVersion,
      activeCount: 2,
    },
    {
      handleId: 3,
      storeKind: 4,
      ownerVersion: 19,
      activeCount: 2,
    },
  ];
}

function createBranchRecord(path: M4CorePathEvidence): M4OwnerBranchRecord {
  return {
    branchId: path.branchId,
    crisisId: path.crisisId,
    selectedCandidateId: path.selectedCandidateId,
    activationTick: path.activationTick,
    identityConfirmedTick: path.identityConfirmedTick,
    obligationFulfilledTick: path.obligationFulfilledTick,
    townRuleDecisionTick: path.townRuleDecisionTick,
    identityConfirmed: path.activationBasis.identityConfirmed,
    identitySupportTier: path.activationBasis.identitySupportTier,
    identityIndependentClassCount: path.activationBasis.identityIndependentClassCount,
    evidenceOwnerVersion: path.activationBasis.evidenceOwnerVersion,
    obligationOwnerVersion: path.activationBasis.obligationOwnerVersion,
    townRuleOwnerVersion: path.activationBasis.townRuleOwnerVersion,
    supportTier: path.supportTier,
    lowRiskEvidenceCount: path.lowRiskEvidenceCount,
    evidenceBeforeIrreversibleHarm: path.evidenceBeforeIrreversibleHarm ? 1 : 0,
    terminalReason: path.terminalReason,
    dawnReviewRowId: path.dawnReviewRowId,
  };
}

function createCrisisRecord(
  path: M4CorePathEvidence,
  state: number,
  ownerVersion: number,
): M4CrisisRecord {
  return {
    crisisId: path.crisisId,
    branchId: path.branchId,
    state,
    activationTick: path.activationTick,
    lowRiskEvidenceCount: path.lowRiskEvidenceCount,
    evidenceBeforeIrreversibleHarm: path.evidenceBeforeIrreversibleHarm ? 1 : 0,
    terminalReason:
      state === M4_BORROWED_SHADOW_STATE_EMPTY
        ? M4_BORROWED_SHADOW_TERMINAL_NONE
        : path.terminalReason,
    ownerVersion,
  };
}

function createCheckpoints(
  seed: string,
  checkpointTicks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly M4ReplayCheckpoint[] }
  | { readonly ok: false; readonly reason: M4SaveReplayReason } {
  const checkpoints: M4ReplayCheckpoint[] = [];

  for (const tick of checkpointTicks) {
    const summary = runM4CoreVerticalSliceScenario({ seed, ticks: tick });
    const projection = createM4ReadOnlyProjection(summary, checkpointSequenceForTick(tick));
    checkpoints.push({
      tick,
      worldHash: summary.finalWorldHash,
      readModelHash: projection.readModelHash,
      checkpointHash: createCheckpointHash(summary, tick, projection.readModelHash),
      rebuiltIndexHash: projection.rebuiltIndexes.indexHash,
    });
  }

  return { ok: true, value: checkpoints };
}

function createResumedCheckpoints(
  loaded: Extract<M4SaveLoadResult, { readonly ok: true }>,
  checkpointTicks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly M4ReplayCheckpoint[] }
  | { readonly ok: false; readonly reason: M4SaveReplayReason } {
  const checkpoints: M4ReplayCheckpoint[] = [];

  for (const tick of checkpointTicks) {
    if (tick === loaded.save.createdTick) {
      const saved = loaded.save.sections.reasonMetrics.checkpointHashes[0];
      if (saved === undefined) {
        return { ok: false, reason: "m4_save_section_invalid" };
      }

      checkpoints.push({
        tick,
        worldHash: saved.worldHash,
        readModelHash: loaded.projection.readModelHash,
        checkpointHash: saved.checkpointHash,
        rebuiltIndexHash: loaded.projection.rebuiltIndexes.indexHash,
      });
      continue;
    }

    const summary = runM4CoreVerticalSliceScenario({
      seed: loaded.save.requestedSeed,
      ticks: tick,
    });
    const projection = createM4ReadOnlyProjection(summary, checkpointSequenceForTick(tick));
    checkpoints.push({
      tick,
      worldHash: summary.finalWorldHash,
      readModelHash: projection.readModelHash,
      checkpointHash: createCheckpointHash(summary, tick, projection.readModelHash),
      rebuiltIndexHash: projection.rebuiltIndexes.indexHash,
    });
  }

  return { ok: true, value: checkpoints };
}

function normalizeCheckpointTicks(
  checkpointTicks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly Tick[] }
  | { readonly ok: false; readonly reason: M4SaveReplayReason } {
  if (checkpointTicks.length === 0) {
    return { ok: false, reason: "m4_checkpoint_order_invalid" };
  }

  const normalized: Tick[] = [];
  let previous = -1;
  for (const tick of checkpointTicks) {
    if (!isSafeTick(tick) || tick <= previous) {
      return { ok: false, reason: "m4_checkpoint_order_invalid" };
    }

    normalized.push(tick);
    previous = tick;
  }

  return { ok: true, value: normalized };
}

function includeSaveTick(
  saveTick: Tick,
  finalTick: Tick,
  checkpointTicks: readonly Tick[],
): readonly Tick[] {
  const ticks: Tick[] = [];
  let insertedSaveTick = false;

  for (const tick of checkpointTicks) {
    if (tick > finalTick) {
      continue;
    }

    if (!insertedSaveTick && tick > saveTick) {
      ticks.push(saveTick);
      insertedSaveTick = true;
    }

    if (tick >= saveTick) {
      if (tick === saveTick) {
        insertedSaveTick = true;
      }
      ticks.push(tick);
    }
  }

  if (!insertedSaveTick) {
    ticks.push(saveTick);
  }

  if (ticks[ticks.length - 1] !== finalTick) {
    ticks.push(finalTick);
  }

  return ticks;
}

interface UnknownSaveEnvelope {
  readonly magic: unknown;
  readonly formatVersion: unknown;
  readonly sectionDirectoryVersion: unknown;
  readonly scenarioId: unknown;
  readonly alias: unknown;
  readonly requestedSeed: unknown;
  readonly seed: unknown;
  readonly contentHash: unknown;
  readonly commandStreamHash: unknown;
  readonly createdTick: unknown;
  readonly nextTick: unknown;
  readonly sections: unknown;
  readonly readOnlyProjection: unknown;
}

interface UnknownSaveSections {
  readonly ownerStores: unknown;
  readonly crisisDirector: unknown;
  readonly commandLogTail: unknown;
  readonly reasonMetrics: unknown;
}

interface UnknownOwnerStoresSection {
  readonly ownerStoresVersion: unknown;
  readonly ownerHandles: unknown;
  readonly branchRecords: unknown;
}

interface UnknownOwnerHandleRecord {
  readonly handleId: unknown;
  readonly storeKind: unknown;
  readonly ownerVersion: unknown;
  readonly activeCount: unknown;
}

interface UnknownOwnerBranchRecord {
  readonly branchId: unknown;
  readonly crisisId: unknown;
  readonly selectedCandidateId: unknown;
  readonly activationTick: unknown;
  readonly identityConfirmedTick: unknown;
  readonly obligationFulfilledTick: unknown;
  readonly townRuleDecisionTick: unknown;
  readonly identityConfirmed: unknown;
  readonly identitySupportTier: unknown;
  readonly identityIndependentClassCount: unknown;
  readonly evidenceOwnerVersion: unknown;
  readonly obligationOwnerVersion: unknown;
  readonly townRuleOwnerVersion: unknown;
  readonly supportTier: unknown;
  readonly lowRiskEvidenceCount: unknown;
  readonly evidenceBeforeIrreversibleHarm: unknown;
  readonly terminalReason: unknown;
  readonly dawnReviewRowId: unknown;
}

interface UnknownCrisisDirectorSection {
  readonly crisisDirectorVersion: unknown;
  readonly crisisRecords: unknown;
  readonly recoveryWindowRecords: unknown;
}

interface UnknownCrisisRecord {
  readonly crisisId: unknown;
  readonly branchId: unknown;
  readonly state: unknown;
  readonly activationTick: unknown;
  readonly lowRiskEvidenceCount: unknown;
  readonly evidenceBeforeIrreversibleHarm: unknown;
  readonly terminalReason: unknown;
  readonly ownerVersion: unknown;
}

interface UnknownRecoveryWindowRecord {
  readonly windowId: unknown;
  readonly recoveryType: unknown;
  readonly startTick: unknown;
  readonly endTick: unknown;
  readonly sourceSampleVersion: unknown;
  readonly selectedCommandKind: unknown;
}

interface UnknownCommandLogTailSection {
  readonly commandLogTailVersion: unknown;
  readonly checkpointTick: unknown;
  readonly checkpointWorldHash: unknown;
  readonly commandStreamHash: unknown;
  readonly contentHash: unknown;
  readonly nextCommandSequence: unknown;
  readonly commandTail: unknown;
}

interface UnknownCommandTailRecord {
  readonly tick: unknown;
  readonly sequence: unknown;
  readonly commandHash: unknown;
}

interface UnknownReasonMetricsSection {
  readonly reasonMetricsVersion: unknown;
  readonly checkpointHashes: unknown;
  readonly boundedReads: unknown;
  readonly invariantCounters: unknown;
  readonly dawnReviewRows: unknown;
}

interface UnknownCheckpointHashRecord {
  readonly tick: unknown;
  readonly worldHash: unknown;
  readonly readModelHash: unknown;
  readonly checkpointHash: unknown;
}

interface UnknownDawnReviewRow {
  readonly rowId: unknown;
  readonly branchId: unknown;
  readonly tick: unknown;
  readonly sourceKind: unknown;
  readonly sourceId: unknown;
  readonly ownerVersion: unknown;
  readonly reason: unknown;
}

interface UnknownReadOnlyProjection {
  readonly projectionVersion: unknown;
  readonly scenarioId: unknown;
  readonly tick: unknown;
  readonly worldHash: unknown;
  readonly readModelHash: unknown;
  readonly rebuiltIndexes: unknown;
}

interface UnknownRebuiltIndexes {
  readonly rebuiltIndexesSchemaVersion: unknown;
  readonly names: unknown;
  readonly surfaces: unknown;
  readonly basisTick: unknown;
  readonly basisWorldHash: unknown;
  readonly rebuildTimeTicks: unknown;
  readonly indexHash: unknown;
}

interface UnknownBoundedReads {
  readonly lampGapVisited: unknown;
  readonly lampGapCandidateCap: unknown;
  readonly chronicleEvidenceVisited: unknown;
  readonly chronicleEvidenceCandidateCap: unknown;
  readonly obligationVisited: unknown;
  readonly obligationScanCap: unknown;
  readonly townRuleVisited: unknown;
  readonly townRuleScanCap: unknown;
  readonly crisisCandidateVisited: unknown;
  readonly crisisCandidateCap: unknown;
  readonly directorVisited: unknown;
  readonly directorCandidateCap: unknown;
}

interface UnknownInvariantCounters {
  readonly preventionPathCount: unknown;
  readonly containmentPathCount: unknown;
  readonly failurePathCount: unknown;
  readonly lowRiskEvidenceBeforeHarmCount: unknown;
  readonly dawnReviewSourceRowCount: unknown;
  readonly directFactMutationByDirectorCount: unknown;
  readonly m0ToM3RegressionCount: unknown;
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
    contentHash: record["contentHash"],
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
    crisisDirector: record["crisisDirector"],
    commandLogTail: record["commandLogTail"],
    reasonMetrics: record["reasonMetrics"],
  };
}

function readOwnerStoresSection(record: Record<string, unknown>): UnknownOwnerStoresSection {
  return {
    ownerStoresVersion: record["ownerStoresVersion"],
    ownerHandles: record["ownerHandles"],
    branchRecords: record["branchRecords"],
  };
}

function readOwnerHandleRecord(record: Record<string, unknown>): UnknownOwnerHandleRecord {
  return {
    handleId: record["handleId"],
    storeKind: record["storeKind"],
    ownerVersion: record["ownerVersion"],
    activeCount: record["activeCount"],
  };
}

function readOwnerBranchRecord(record: Record<string, unknown>): UnknownOwnerBranchRecord {
  return {
    branchId: record["branchId"],
    crisisId: record["crisisId"],
    selectedCandidateId: record["selectedCandidateId"],
    activationTick: record["activationTick"],
    identityConfirmedTick: record["identityConfirmedTick"],
    obligationFulfilledTick: record["obligationFulfilledTick"],
    townRuleDecisionTick: record["townRuleDecisionTick"],
    identityConfirmed: record["identityConfirmed"],
    identitySupportTier: record["identitySupportTier"],
    identityIndependentClassCount: record["identityIndependentClassCount"],
    evidenceOwnerVersion: record["evidenceOwnerVersion"],
    obligationOwnerVersion: record["obligationOwnerVersion"],
    townRuleOwnerVersion: record["townRuleOwnerVersion"],
    supportTier: record["supportTier"],
    lowRiskEvidenceCount: record["lowRiskEvidenceCount"],
    evidenceBeforeIrreversibleHarm: record["evidenceBeforeIrreversibleHarm"],
    terminalReason: record["terminalReason"],
    dawnReviewRowId: record["dawnReviewRowId"],
  };
}

function readCrisisDirectorSection(record: Record<string, unknown>): UnknownCrisisDirectorSection {
  return {
    crisisDirectorVersion: record["crisisDirectorVersion"],
    crisisRecords: record["crisisRecords"],
    recoveryWindowRecords: record["recoveryWindowRecords"],
  };
}

function readCrisisRecord(record: Record<string, unknown>): UnknownCrisisRecord {
  return {
    crisisId: record["crisisId"],
    branchId: record["branchId"],
    state: record["state"],
    activationTick: record["activationTick"],
    lowRiskEvidenceCount: record["lowRiskEvidenceCount"],
    evidenceBeforeIrreversibleHarm: record["evidenceBeforeIrreversibleHarm"],
    terminalReason: record["terminalReason"],
    ownerVersion: record["ownerVersion"],
  };
}

function readRecoveryWindowRecord(record: Record<string, unknown>): UnknownRecoveryWindowRecord {
  return {
    windowId: record["windowId"],
    recoveryType: record["recoveryType"],
    startTick: record["startTick"],
    endTick: record["endTick"],
    sourceSampleVersion: record["sourceSampleVersion"],
    selectedCommandKind: record["selectedCommandKind"],
  };
}

function readCommandLogTailSection(record: Record<string, unknown>): UnknownCommandLogTailSection {
  return {
    commandLogTailVersion: record["commandLogTailVersion"],
    checkpointTick: record["checkpointTick"],
    checkpointWorldHash: record["checkpointWorldHash"],
    commandStreamHash: record["commandStreamHash"],
    contentHash: record["contentHash"],
    nextCommandSequence: record["nextCommandSequence"],
    commandTail: record["commandTail"],
  };
}

function readCommandTailRecord(record: Record<string, unknown>): UnknownCommandTailRecord {
  return {
    tick: record["tick"],
    sequence: record["sequence"],
    commandHash: record["commandHash"],
  };
}

function readReasonMetricsSection(record: Record<string, unknown>): UnknownReasonMetricsSection {
  return {
    reasonMetricsVersion: record["reasonMetricsVersion"],
    checkpointHashes: record["checkpointHashes"],
    boundedReads: record["boundedReads"],
    invariantCounters: record["invariantCounters"],
    dawnReviewRows: record["dawnReviewRows"],
  };
}

function readCheckpointHashRecord(record: Record<string, unknown>): UnknownCheckpointHashRecord {
  return {
    tick: record["tick"],
    worldHash: record["worldHash"],
    readModelHash: record["readModelHash"],
    checkpointHash: record["checkpointHash"],
  };
}

function readDawnReviewRow(record: Record<string, unknown>): UnknownDawnReviewRow {
  return {
    rowId: record["rowId"],
    branchId: record["branchId"],
    tick: record["tick"],
    sourceKind: record["sourceKind"],
    sourceId: record["sourceId"],
    ownerVersion: record["ownerVersion"],
    reason: record["reason"],
  };
}

function readReadOnlyProjection(record: Record<string, unknown>): UnknownReadOnlyProjection {
  return {
    projectionVersion: record["projectionVersion"],
    scenarioId: record["scenarioId"],
    tick: record["tick"],
    worldHash: record["worldHash"],
    readModelHash: record["readModelHash"],
    rebuiltIndexes: record["rebuiltIndexes"],
  };
}

function readRebuiltIndexes(record: Record<string, unknown>): UnknownRebuiltIndexes {
  return {
    rebuiltIndexesSchemaVersion: record["rebuiltIndexesSchemaVersion"],
    names: record["names"],
    surfaces: record["surfaces"],
    basisTick: record["basisTick"],
    basisWorldHash: record["basisWorldHash"],
    rebuildTimeTicks: record["rebuildTimeTicks"],
    indexHash: record["indexHash"],
  };
}

function readBoundedReads(record: Record<string, unknown>): UnknownBoundedReads {
  return {
    lampGapVisited: record["lampGapVisited"],
    lampGapCandidateCap: record["lampGapCandidateCap"],
    chronicleEvidenceVisited: record["chronicleEvidenceVisited"],
    chronicleEvidenceCandidateCap: record["chronicleEvidenceCandidateCap"],
    obligationVisited: record["obligationVisited"],
    obligationScanCap: record["obligationScanCap"],
    townRuleVisited: record["townRuleVisited"],
    townRuleScanCap: record["townRuleScanCap"],
    crisisCandidateVisited: record["crisisCandidateVisited"],
    crisisCandidateCap: record["crisisCandidateCap"],
    directorVisited: record["directorVisited"],
    directorCandidateCap: record["directorCandidateCap"],
  };
}

function readInvariantCounters(record: Record<string, unknown>): UnknownInvariantCounters {
  return {
    preventionPathCount: record["preventionPathCount"],
    containmentPathCount: record["containmentPathCount"],
    failurePathCount: record["failurePathCount"],
    lowRiskEvidenceBeforeHarmCount: record["lowRiskEvidenceBeforeHarmCount"],
    dawnReviewSourceRowCount: record["dawnReviewSourceRowCount"],
    directFactMutationByDirectorCount: record["directFactMutationByDirectorCount"],
    m0ToM3RegressionCount: record["m0ToM3RegressionCount"],
  };
}

function parseSaveEnvelope(
  input: unknown,
):
  | { readonly ok: true; readonly value: M4ParsedSaveEnvelope }
  | { readonly ok: false; readonly reason: M4SaveReplayReason } {
  if (!isRecord(input)) {
    return { ok: false, reason: "m4_save_section_invalid" };
  }

  const envelope = readSaveEnvelope(input);
  if (envelope.magic !== M4_SAVE_MAGIC) {
    return { ok: false, reason: "m4_save_magic_invalid" };
  }

  if (
    envelope.formatVersion !== M4_SAVE_FORMAT_VERSION ||
    envelope.sectionDirectoryVersion !== M4_SECTION_DIRECTORY_VERSION
  ) {
    return { ok: false, reason: "m4_save_version_invalid" };
  }

  if (
    envelope.scenarioId !== M4_CORE_VERTICAL_SLICE_SCENARIO_ID ||
    envelope.alias !== M4_CORE_VERTICAL_SLICE_ALIAS
  ) {
    return { ok: false, reason: "m4_save_scenario_invalid" };
  }

  if (
    typeof envelope.requestedSeed !== "string" ||
    envelope.requestedSeed.length === 0 ||
    envelope.seed !== deriveM4CoreVerticalSliceScenarioSeed(envelope.requestedSeed)
  ) {
    return { ok: false, reason: "m4_save_seed_mismatch" };
  }

  if (
    !isTickLane(envelope.createdTick) ||
    envelope.nextTick !== envelope.createdTick + 1 ||
    !isHashString(envelope.contentHash) ||
    !isHashString(envelope.commandStreamHash)
  ) {
    return { ok: false, reason: "m4_save_section_invalid" };
  }

  if (!validateSectionsShape(envelope.sections)) {
    return { ok: false, reason: "m4_save_section_invalid" };
  }

  if (!validateProjectionShape(envelope.readOnlyProjection, envelope.createdTick)) {
    return { ok: false, reason: "m4_save_projection_invalid" };
  }

  return {
    ok: true,
    value: {
      rawSections: envelope.sections,
      rawProjection: envelope.readOnlyProjection,
      requestedSeed: envelope.requestedSeed,
      createdTick: envelope.createdTick,
      contentHash: envelope.contentHash,
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
    validateCrisisDirectorSection(sections.crisisDirector) &&
    validateCommandLogTailSection(sections.commandLogTail) &&
    validateReasonMetricsSection(sections.reasonMetrics)
  );
}

function validateOwnerStoresSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const section = readOwnerStoresSection(input);
  if (section.ownerStoresVersion !== M4_SECTION_VERSION) {
    return false;
  }

  if (!Array.isArray(section.ownerHandles) || !Array.isArray(section.branchRecords)) {
    return false;
  }

  let previousHandle = -1;
  for (const handleInput of section.ownerHandles) {
    if (!isRecord(handleInput)) {
      return false;
    }
    const handle = readOwnerHandleRecord(handleInput);
    if (!isUintLane(handle.handleId) || handle.handleId <= previousHandle) {
      return false;
    }
    if (
      !isPositiveUint32(handle.storeKind) ||
      !isPositiveUint32(handle.ownerVersion) ||
      !isUintLane(handle.activeCount)
    ) {
      return false;
    }
    previousHandle = handle.handleId;
  }

  let previousBranch = -1;
  for (const rowInput of section.branchRecords) {
    if (!isRecord(rowInput)) {
      return false;
    }
    const row = readOwnerBranchRecord(rowInput);
    if (!isUintLane(row.branchId) || row.branchId <= previousBranch) {
      return false;
    }

    if (
      !isUintLane(row.crisisId) ||
      !isUintLane(row.selectedCandidateId) ||
      !isTickLane(row.activationTick) ||
      !isTickLane(row.identityConfirmedTick) ||
      !isTickLane(row.obligationFulfilledTick) ||
      !isTickLane(row.townRuleDecisionTick) ||
      !isBinaryLane(row.identityConfirmed) ||
      !isUintLane(row.identitySupportTier) ||
      !isSmallEvidenceClassCount(row.identityIndependentClassCount) ||
      !isPositiveUint32(row.evidenceOwnerVersion) ||
      !isPositiveUint32(row.obligationOwnerVersion) ||
      !isPositiveUint32(row.townRuleOwnerVersion) ||
      !isUintLane(row.supportTier) ||
      !isUintLane(row.lowRiskEvidenceCount) ||
      !isBinaryLane(row.evidenceBeforeIrreversibleHarm) ||
      !isUintLane(row.terminalReason) ||
      !isUintLane(row.dawnReviewRowId)
    ) {
      return false;
    }
    previousBranch = row.branchId;
  }

  return section.branchRecords.length === 3;
}

function validateCrisisDirectorSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const section = readCrisisDirectorSection(input);
  if (section.crisisDirectorVersion !== M4_SECTION_VERSION) {
    return false;
  }

  if (!Array.isArray(section.crisisRecords) || !Array.isArray(section.recoveryWindowRecords)) {
    return false;
  }

  let previousCrisis = -1;
  for (const rowInput of section.crisisRecords) {
    if (!isRecord(rowInput)) {
      return false;
    }
    const row = readCrisisRecord(rowInput);
    if (!isUintLane(row.crisisId) || row.crisisId <= previousCrisis) {
      return false;
    }
    if (
      !isUintLane(row.branchId) ||
      !isUintLane(row.state) ||
      !isTickLane(row.activationTick) ||
      !isUintLane(row.lowRiskEvidenceCount) ||
      !isBinaryLane(row.evidenceBeforeIrreversibleHarm) ||
      !isUintLane(row.terminalReason) ||
      !isPositiveUint32(row.ownerVersion)
    ) {
      return false;
    }
    previousCrisis = row.crisisId;
  }

  let previousWindow = -1;
  for (const rowInput of section.recoveryWindowRecords) {
    if (!isRecord(rowInput)) {
      return false;
    }
    const row = readRecoveryWindowRecord(rowInput);
    if (!isUintLane(row.windowId) || row.windowId <= previousWindow) {
      return false;
    }
    if (
      !isUintLane(row.recoveryType) ||
      !isTickLane(row.startTick) ||
      !isTickLane(row.endTick) ||
      row.endTick < row.startTick ||
      !isPositiveUint32(row.sourceSampleVersion) ||
      !isUintLane(row.selectedCommandKind)
    ) {
      return false;
    }
    previousWindow = row.windowId;
  }

  return section.crisisRecords.length === 3;
}

function validateCommandLogTailSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const section = readCommandLogTailSection(input);
  if (section.commandLogTailVersion !== M4_SECTION_VERSION) {
    return false;
  }

  if (
    !isTickLane(section.checkpointTick) ||
    !isHashString(section.checkpointWorldHash) ||
    !isHashString(section.commandStreamHash) ||
    !isHashString(section.contentHash) ||
    !isUintLane(section.nextCommandSequence) ||
    !Array.isArray(section.commandTail)
  ) {
    return false;
  }

  let previousSequence = -1;
  for (const rowInput of section.commandTail) {
    if (!isRecord(rowInput)) {
      return false;
    }
    const row = readCommandTailRecord(rowInput);
    if (!isTickLane(row.tick) || !isUintLane(row.sequence) || row.sequence <= previousSequence) {
      return false;
    }
    if (!isHashString(row.commandHash)) {
      return false;
    }
    previousSequence = row.sequence;
  }

  return true;
}

function validateReasonMetricsSection(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const section = readReasonMetricsSection(input);
  if (section.reasonMetricsVersion !== M4_SECTION_VERSION) {
    return false;
  }

  if (!Array.isArray(section.checkpointHashes) || !Array.isArray(section.dawnReviewRows)) {
    return false;
  }

  if (
    !validateBoundedReads(section.boundedReads) ||
    !validateInvariantCounters(section.invariantCounters)
  ) {
    return false;
  }

  let previousTick = -1;
  for (const rowInput of section.checkpointHashes) {
    if (!isRecord(rowInput)) {
      return false;
    }
    const row = readCheckpointHashRecord(rowInput);
    if (!isTickLane(row.tick) || row.tick <= previousTick) {
      return false;
    }
    if (
      !isHashString(row.worldHash) ||
      !isHashString(row.readModelHash) ||
      !isHashString(row.checkpointHash)
    ) {
      return false;
    }
    previousTick = row.tick;
  }

  let previousRowId = -1;
  for (const rowInput of section.dawnReviewRows) {
    if (!isRecord(rowInput)) {
      return false;
    }
    const row = readDawnReviewRow(rowInput);
    if (!isUintLane(row.rowId) || row.rowId <= previousRowId) {
      return false;
    }
    if (
      !isUintLane(row.branchId) ||
      !isTickLane(row.tick) ||
      !isUintLane(row.sourceKind) ||
      !isUintLane(row.sourceId) ||
      !isUintLane(row.ownerVersion) ||
      typeof row.reason !== "string"
    ) {
      return false;
    }
    previousRowId = row.rowId;
  }

  return true;
}

function validateProjectionShape(input: unknown, createdTick: Tick): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const projection = readReadOnlyProjection(input);
  if (projection.projectionVersion !== 1) {
    return false;
  }

  if (
    projection.scenarioId !== M4_CORE_VERTICAL_SLICE_SCENARIO_ID ||
    projection.tick !== createdTick ||
    !isHashString(projection.worldHash) ||
    !isHashString(projection.readModelHash)
  ) {
    return false;
  }

  if (!isRecord(projection.rebuiltIndexes)) {
    return false;
  }

  const rebuilt = readRebuiltIndexes(projection.rebuiltIndexes);
  if (!Array.isArray(rebuilt.names) || !Array.isArray(rebuilt.surfaces)) {
    return false;
  }

  const names = rebuilt.names;
  if (names.length !== M4_REBUILT_SURFACE_NAMES.length) {
    return false;
  }

  for (let index = 0; index < names.length; index += 1) {
    if (names[index] !== M4_REBUILT_SURFACE_NAMES[index]) {
      return false;
    }
  }

  return (
    rebuilt.rebuiltIndexesSchemaVersion === 1 &&
    rebuilt.basisTick === createdTick &&
    isHashString(rebuilt.basisWorldHash) &&
    rebuilt.rebuildTimeTicks === 1 &&
    isHashString(rebuilt.indexHash)
  );
}

function validateBoundedReads(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const reads = readBoundedReads(input);
  return (
    isUintLane(reads.lampGapVisited) &&
    isPositiveUint32(reads.lampGapCandidateCap) &&
    reads.lampGapVisited <= reads.lampGapCandidateCap &&
    isUintLane(reads.chronicleEvidenceVisited) &&
    isPositiveUint32(reads.chronicleEvidenceCandidateCap) &&
    reads.chronicleEvidenceVisited <= reads.chronicleEvidenceCandidateCap &&
    isUintLane(reads.obligationVisited) &&
    isPositiveUint32(reads.obligationScanCap) &&
    reads.obligationVisited <= reads.obligationScanCap &&
    isUintLane(reads.townRuleVisited) &&
    isPositiveUint32(reads.townRuleScanCap) &&
    reads.townRuleVisited <= reads.townRuleScanCap &&
    isUintLane(reads.crisisCandidateVisited) &&
    isPositiveUint32(reads.crisisCandidateCap) &&
    reads.crisisCandidateVisited <= reads.crisisCandidateCap &&
    isUintLane(reads.directorVisited) &&
    isPositiveUint32(reads.directorCandidateCap) &&
    reads.directorVisited <= reads.directorCandidateCap
  );
}

function validateInvariantCounters(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const counters = readInvariantCounters(input);
  return (
    isUintLane(counters.preventionPathCount) &&
    isUintLane(counters.containmentPathCount) &&
    isUintLane(counters.failurePathCount) &&
    isUintLane(counters.lowRiskEvidenceBeforeHarmCount) &&
    isUintLane(counters.dawnReviewSourceRowCount) &&
    isUintLane(counters.directFactMutationByDirectorCount) &&
    isUintLane(counters.m0ToM3RegressionCount)
  );
}

function createRenderSnapshotHash(
  summary: M4CoreVerticalSliceScenarioSummary,
  snapshotSequence: number,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "branchCount", value: 3 },
      { name: "checkpointSequence", value: snapshotSequence },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.finalWorldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createScenarioReadModelHash(
  summary: M4CoreVerticalSliceScenarioSummary,
  boundedReadHash: string,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "boundedReadHash", value: boundedReadHash },
      { name: "commandStreamHash", value: summary.commandStreamHash },
      { name: "containmentTerminal", value: summary.containmentPath.terminalReason },
      { name: "dawnRows", value: summary.dawnReviewRows.length },
      { name: "failureTerminal", value: summary.failurePath.terminalReason },
      {
        name: "preventionIdentityConfirmed",
        value: summary.preventionPath.activationBasis.identityConfirmed,
      },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: summary.finalTick },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createBoundedReadHash(reads: M4CoreBoundedReadEvidence): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "chronicleEvidenceCap", value: reads.chronicleEvidenceCandidateCap },
      { name: "chronicleEvidenceVisited", value: reads.chronicleEvidenceVisited },
      { name: "crisisCap", value: reads.crisisCandidateCap },
      { name: "crisisVisited", value: reads.crisisCandidateVisited },
      { name: "directorCap", value: reads.directorCandidateCap },
      { name: "directorVisited", value: reads.directorVisited },
      { name: "lampGapCap", value: reads.lampGapCandidateCap },
      { name: "lampGapVisited", value: reads.lampGapVisited },
      { name: "obligationCap", value: reads.obligationScanCap },
      { name: "obligationVisited", value: reads.obligationVisited },
      { name: "townRuleCap", value: reads.townRuleScanCap },
      { name: "townRuleVisited", value: reads.townRuleVisited },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createRebuiltSurfaceHashes(
  summary: M4CoreVerticalSliceScenarioSummary,
): readonly M4SurfaceHashRecord[] {
  const records: M4SurfaceHashRecord[] = [];

  for (let index = 0; index < M4_REBUILT_SURFACE_NAMES.length; index += 1) {
    const name = M4_REBUILT_SURFACE_NAMES[index];
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

function createSurfaceHash(summary: M4CoreVerticalSliceScenarioSummary, name: string): string {
  let hash = hashStringToUint32("m4 rebuilt surface");
  hash = mixUint32(hash, hashStringToUint32(name));
  hash = mixUint32(hash, summary.finalTick);
  hash = mixUint32(hash, hashStringToUint32(summary.finalWorldHash));
  hash = mixUint32(hash, hashStringToUint32(summary.readModelHash));
  hash = mixUint32(hash, summary.dawnReviewRows.length);
  hash = mixUint32(hash, summary.boundedReads.lampGapVisited);
  hash = mixUint32(hash, summary.boundedReads.directorVisited);
  return formatUint32Hex(hash);
}

function createRebuiltIndexHash(
  summary: M4CoreVerticalSliceScenarioSummary,
  surfaces: readonly M4SurfaceHashRecord[],
): string {
  let hash = hashStringToUint32("m4 rebuilt indexes");
  hash = mixUint32(hash, summary.finalTick);
  hash = mixUint32(hash, hashStringToUint32(summary.finalWorldHash));
  for (const surface of surfaces) {
    hash = mixUint32(hash, hashStringToUint32(surface.name));
    hash = mixUint32(hash, hashStringToUint32(surface.hash));
    hash = mixUint32(hash, surface.sourceVersion);
  }
  return formatUint32Hex(hash);
}

function createCheckpointHash(
  summary: M4CoreVerticalSliceScenarioSummary,
  tick: Tick,
  readModelHash: string,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "commandStreamHash", value: summary.commandStreamHash },
      { name: "contentHash", value: summary.contentHash },
      { name: "readModelHash", value: readModelHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: tick },
      { name: "worldHash", value: summary.finalWorldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createLoadedStateHash(save: M4SaveEnvelope, projection: M4ReadOnlyProjection): string {
  return formatCanonicalWorldHash({
    fields: [
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

function createCommandTail(createdTick: Tick): readonly M4CommandTailRecord[] {
  const records: M4CommandTailRecord[] = [];
  for (const command of M4_COMMANDS) {
    if (command.tick > createdTick) {
      continue;
    }

    records.push({
      tick: command.tick,
      sequence: command.sequence,
      commandHash: createCommandHash(command),
    });
  }

  const keepFrom = Math.max(0, records.length - 4);
  return records.slice(keepFrom);
}

function countCommandsThroughTick(tick: Tick): number {
  let count = 0;
  for (const command of M4_COMMANDS) {
    if (command.tick <= tick) {
      count += 1;
    }
  }
  return count;
}

function createCommandHash(command: M4ScenarioCommandRecord): string {
  let hash = hashStringToUint32(M4_CORE_VERTICAL_SLICE_SCENARIO_ID);
  hash = mixUint32(hash, command.tick);
  hash = mixUint32(hash, command.sequence);
  hash = mixUint32(hash, hashStringToUint32(command.reason));
  hash = mixUint32(hash, command.subjectId);
  hash = mixUint32(hash, command.targetId);
  return formatUint32Hex(hash);
}

function checkpointSequenceForTick(tick: Tick): number {
  for (let index = 0; index < M4_REPLAY_CHECKPOINT_SEQUENCE.length; index += 1) {
    if (M4_REPLAY_CHECKPOINT_SEQUENCE[index] === tick) {
      return index;
    }
  }

  return M4_REPLAY_CHECKPOINT_SEQUENCE.length;
}

function createComparisonFailure(
  seed: string,
  firstDivergentTick: Tick | null,
  artifactPaths: M4ReplayArtifactPaths,
  reason: "checkpoint_count_mismatch" | "world_hash_mismatch" | "read_model_hash_mismatch",
): M4ReplayComparison {
  return {
    ok: false,
    scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
    seed,
    firstDivergentTick,
    reason,
    artifactPaths,
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

function isSmallEvidenceClassCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4;
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

interface M4ScenarioCommandRecord {
  readonly tick: Tick;
  readonly sequence: number;
  readonly reason: string;
  readonly subjectId: number;
  readonly targetId: number;
}

const M4_COMMANDS: readonly M4ScenarioCommandRecord[] = Object.freeze([
  { tick: 0, sequence: 0, reason: "m4.scenario.initialized", subjectId: 0, targetId: 0 },
  { tick: 600, sequence: 1, reason: "m4.lamp_gap.candidate_selected", subjectId: 1, targetId: 1 },
  {
    tick: 700,
    sequence: 2,
    reason: "m4.chronicle.identity_rule_confirmed",
    subjectId: 1,
    targetId: 4,
  },
  { tick: 800, sequence: 3, reason: "m4.obligation.lamp_oil_fulfilled", subjectId: 2, targetId: 0 },
  {
    tick: 900,
    sequence: 4,
    reason: "m4.town_rule.night_knock_complied",
    subjectId: 3,
    targetId: 1,
  },
  {
    tick: 1_000,
    sequence: 5,
    reason: "m4.borrowed_shadow.activation_prevented",
    subjectId: 4,
    targetId: 0,
  },
  {
    tick: 1_300,
    sequence: 6,
    reason: "m4.borrowed_shadow.contained_non_combat",
    subjectId: 4,
    targetId: 1,
  },
  {
    tick: 1_600,
    sequence: 7,
    reason: "m4.borrowed_shadow.accident_review_terminal",
    subjectId: 5,
    targetId: 2,
  },
  {
    tick: 3_200,
    sequence: 8,
    reason: "m4.director.recovery_window_selected",
    subjectId: 6,
    targetId: 2,
  },
  {
    tick: 36_000,
    sequence: 9,
    reason: "m4.m3_regression.baseline_preserved",
    subjectId: 7,
    targetId: 0,
  },
]);
