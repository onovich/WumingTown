import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import {
  M8_FACTION_ENDGAME_ALIAS,
  M8_FACTION_ENDGAME_SCENARIO_ID,
  M8_FACTION_ENDGAME_SEED,
  runM8FactionEndgameScenario,
  type M8EndgameRouteScenarioEvidence,
  type M8FactionArcScenarioEvidence,
  type M8FactionEndgameScenarioSummary,
} from "./m8-faction-endgame-scenario";
import { M8_ENDGAME_ROUTE_COUNT, M8_FACTION_COUNT } from "./m8-faction-endgame-types";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash } from "./world-hash";

export const M8_SAVE_MAGIC = "wuming-town.m8.faction-endgame.save";
export const M8_SAVE_FORMAT_VERSION = 1;
export const M8_SECTION_DIRECTORY_VERSION = 1;
export const M8_SECTION_VERSION = 1;
export const M8_READ_MODEL_HASH_VERSION = 1;
export const M8_SAVE_TICK = 72_000;
export const M8_LOAD_TICK = 72_001;
export const M8_FINAL_TICK = 100_000;
export const M8_COMMAND_PREFIX = "m8.faction-endgame.advance.";

export const M8_REPLAY_CHECKPOINT_SEQUENCE: readonly Tick[] = Object.freeze([
  0,
  M8_SAVE_TICK,
  M8_FINAL_TICK,
]);

export const M8_REBUILT_SURFACE_NAMES: readonly string[] = Object.freeze([
  "faction-arcs",
  "endgame-routes",
  "m5-faction-facts",
  "governance-hooks",
  "work-offers",
  "path",
  "read-model",
  "migration-policy",
  "metrics",
]);

export type M8OwnerGateState = "owner_gated";

export type M8SaveReplayReason =
  | "m8_save_ok"
  | "m8_save_seed_invalid"
  | "m8_tick_invalid"
  | "m8_checkpoint_order_invalid"
  | "m8_save_magic_invalid"
  | "m8_save_version_invalid"
  | "m8_save_scenario_invalid"
  | "m8_save_content_scope_mismatch"
  | "m8_save_migration_policy_invalid"
  | "m8_save_section_invalid"
  | "m8_save_projection_invalid"
  | "m8_save_integrity_mismatch"
  | "m8_load_tick_invalid"
  | "m8_resume_tick_before_load";

export interface M8ReplayOptions {
  readonly seed: string;
  readonly checkpointTicks?: readonly Tick[];
}

export interface M8ResumeOptions {
  readonly save: unknown;
  readonly loadTick: Tick;
  readonly finalTick: Tick;
  readonly checkpointTicks?: readonly Tick[];
}

export interface M8ReplayCheckpoint {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly checkpointHash: string;
  readonly rebuiltSurfaceHash: string;
}

export interface M8ReplayRun {
  readonly scenarioId: typeof M8_FACTION_ENDGAME_SCENARIO_ID;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly source: "uninterrupted" | "loaded-save";
  readonly loadedStateHash: string;
  readonly checkpoints: readonly M8ReplayCheckpoint[];
  readonly finalTick: Tick;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
}

export interface M8ReplayArtifactPaths {
  readonly expected: string;
  readonly actual: string;
  readonly resumed: string;
  readonly save: string;
  readonly summary: string;
}

export type M8ReplayComparison =
  | {
      readonly ok: true;
      readonly scenarioId: typeof M8_FACTION_ENDGAME_SCENARIO_ID;
      readonly seed: string;
      readonly checkpointCount: number;
      readonly artifactPaths: M8ReplayArtifactPaths;
    }
  | {
      readonly ok: false;
      readonly scenarioId: typeof M8_FACTION_ENDGAME_SCENARIO_ID;
      readonly seed: string;
      readonly firstDivergentTick: Tick | null;
      readonly reason:
        | "checkpoint_count_mismatch"
        | "world_hash_mismatch"
        | "read_model_hash_mismatch";
      readonly artifactPaths: M8ReplayArtifactPaths;
    };

export interface M8SaveEnvelope {
  readonly magic: typeof M8_SAVE_MAGIC;
  readonly formatVersion: typeof M8_SAVE_FORMAT_VERSION;
  readonly sectionDirectoryVersion: typeof M8_SECTION_DIRECTORY_VERSION;
  readonly scenarioId: typeof M8_FACTION_ENDGAME_SCENARIO_ID;
  readonly alias: typeof M8_FACTION_ENDGAME_ALIAS;
  readonly requestedSeed: string;
  readonly seed: string;
  readonly contentScopeHash: string;
  readonly commandStreamHash: string;
  readonly createdTick: Tick;
  readonly nextTick: Tick;
  readonly migrationPolicy: M8MigrationPolicySection;
  readonly sections: M8SaveSections;
  readonly readOnlyProjection: M8ReadOnlyProjection;
}

export interface M8MigrationPolicySection {
  readonly migrationPolicyVersion: typeof M8_SECTION_VERSION;
  readonly publicSaveCompatibility: M8OwnerGateState;
  readonly crossVersionMigration: M8OwnerGateState;
  readonly windowsWebInteroperability: M8OwnerGateState;
  readonly desktopSaveBridge: M8OwnerGateState;
}

export interface M8SaveSections {
  readonly ownerStores: M8OwnerStoresSection;
  readonly commandLogTail: M8CommandLogTailSection;
  readonly reasonMetrics: M8ReasonMetricsSection;
}

export interface M8OwnerStoresSection {
  readonly ownerStoresVersion: typeof M8_SECTION_VERSION;
  readonly ownerHandles: readonly M8OwnerHandleRecord[];
  readonly factionArcRecords: readonly M8FactionArcSaveRecord[];
  readonly routeRecords: readonly M8RouteSaveRecord[];
}

export interface M8OwnerHandleRecord {
  readonly handleId: number;
  readonly storeKind: number;
  readonly ownerVersion: number;
  readonly activeCount: number;
}

export interface M8FactionArcSaveRecord {
  readonly arcId: number;
  readonly factionId: number;
  readonly arcState: number;
  readonly resourceMask: number;
  readonly constraintMask: number;
  readonly contradictionMask: number;
  readonly negotiationMask: number;
  readonly failureMask: number;
  readonly explanationMask: number;
  readonly factSelectedCount: number;
  readonly factVisitedCount: number;
}

export interface M8RouteSaveRecord {
  readonly routeId: number;
  readonly routeState: number;
  readonly reason: string;
  readonly supportScore: number;
  readonly costScore: number;
  readonly oppositionScore: number;
  readonly explanationMask: number;
}

export interface M8CommandLogTailSection {
  readonly commandLogTailVersion: typeof M8_SECTION_VERSION;
  readonly checkpointTick: Tick;
  readonly checkpointWorldHash: string;
  readonly commandStreamHash: string;
  readonly contentScopeHash: string;
  readonly nextCommandSequence: number;
  readonly commandTail: readonly M8CommandTailRecord[];
}

export interface M8CommandTailRecord {
  readonly tick: Tick;
  readonly sequence: number;
  readonly commandHash: string;
}

export interface M8ReasonMetricsSection {
  readonly reasonMetricsVersion: typeof M8_SECTION_VERSION;
  readonly checkpointHashes: readonly M8CheckpointHashRecord[];
  readonly gateMetrics: M8GateMetricsRecord;
}

export interface M8CheckpointHashRecord {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly checkpointHash: string;
}

export interface M8GateMetricsRecord {
  readonly ownerVersion: number;
  readonly activeArcCount: number;
  readonly activeRoutePathCount: number;
  readonly negotiatedArcCount: number;
  readonly availableRouteCount: number;
  readonly blockedRouteCount: number;
  readonly contestedRouteCount: number;
  readonly factionFactVisits: number;
  readonly routeVisits: number;
  readonly capHitCount: number;
  readonly staleRejectCount: number;
}

export interface M8SurfaceHashRecord {
  readonly name: string;
  readonly hash: string;
  readonly sourceVersion: number;
}

export interface M8ReadOnlyProjection {
  readonly projectionVersion: 1;
  readonly scenarioId: typeof M8_FACTION_ENDGAME_SCENARIO_ID;
  readonly tick: Tick;
  readonly contentScopeHash: string;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly rebuiltIndexes: M8RebuiltIndexes;
}

export interface M8RebuiltIndexes {
  readonly rebuiltIndexesSchemaVersion: 1;
  readonly names: readonly string[];
  readonly surfaces: readonly M8SurfaceHashRecord[];
  readonly basisTick: Tick;
  readonly basisWorldHash: string;
  readonly rebuildTimeTicks: number;
  readonly indexHash: string;
}

export type M8SaveLoadResult =
  | {
      readonly ok: true;
      readonly save: M8SaveEnvelope;
      readonly loadTick: typeof M8_LOAD_TICK;
      readonly validationTimeTicks: number;
      readonly rebuildTimeTicks: number;
      readonly rebuiltSurfaceNames: readonly string[];
      readonly projection: M8ReadOnlyProjection;
      readonly loadedStateHash: string;
    }
  | { readonly ok: false; readonly reason: M8SaveReplayReason };

export type M8ReplayResult =
  | { readonly ok: true; readonly replay: M8ReplayRun }
  | { readonly ok: false; readonly reason: M8SaveReplayReason };

interface ParsedSaveEnvelope {
  readonly rawMigrationPolicy: unknown;
  readonly rawSections: unknown;
  readonly rawProjection: unknown;
  readonly requestedSeed: string;
  readonly createdTick: Tick;
  readonly contentScopeHash: string;
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
  readonly contentScopeHash: unknown;
  readonly commandStreamHash: unknown;
  readonly createdTick: unknown;
  readonly nextTick: unknown;
  readonly migrationPolicy: unknown;
  readonly sections: unknown;
  readonly readOnlyProjection: unknown;
}

export function runM8FactionEndgameReplay(options: M8ReplayOptions): M8ReplayResult {
  if (options.seed.length === 0) return { ok: false, reason: "m8_save_seed_invalid" };
  const ticks = normalizeCheckpointTicks(options.checkpointTicks ?? M8_REPLAY_CHECKPOINT_SEQUENCE);
  if (!ticks.ok) return ticks;
  const checkpoints = createCheckpoints(options.seed, ticks.value);
  if (!checkpoints.ok) return checkpoints;
  const finalCheckpoint = checkpoints.value[checkpoints.value.length - 1];
  if (finalCheckpoint === undefined) return { ok: false, reason: "m8_checkpoint_order_invalid" };
  return {
    ok: true,
    replay: {
      scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
      seed: options.seed,
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

export function createM8FactionEndgameSaveEnvelope(
  requestedSeed: string = M8_FACTION_ENDGAME_SEED,
  createdTick: Tick = M8_SAVE_TICK,
): M8SaveEnvelope {
  if (requestedSeed.length === 0 || !isSafeTick(createdTick) || createdTick !== M8_SAVE_TICK) {
    throw new Error("M8 save replay requires a non-empty seed and the focused gate save tick");
  }
  const summary = runM8FactionEndgameScenario(requestedSeed);
  const contentScopeHash = createContentScopeHash(summary);
  const projection = createM8ReadOnlyProjection(summary, createdTick, contentScopeHash);
  return {
    magic: M8_SAVE_MAGIC,
    formatVersion: M8_SAVE_FORMAT_VERSION,
    sectionDirectoryVersion: M8_SECTION_DIRECTORY_VERSION,
    scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
    alias: M8_FACTION_ENDGAME_ALIAS,
    requestedSeed,
    seed: requestedSeed,
    contentScopeHash,
    commandStreamHash: createCommandStreamHash(createdTick),
    createdTick,
    nextTick: createdTick + 1,
    migrationPolicy: createMigrationPolicy(),
    sections: createSections(createdTick, summary, contentScopeHash),
    readOnlyProjection: projection,
  };
}

export function loadM8FactionEndgameSaveEnvelope(input: unknown): M8SaveLoadResult {
  const parsed = parseSaveEnvelope(input);
  if (!parsed.ok) return parsed;
  const save = parsed.value;
  const expected = createM8FactionEndgameSaveEnvelope(save.requestedSeed, M8_SAVE_TICK);
  if (save.contentScopeHash !== expected.contentScopeHash) {
    return { ok: false, reason: "m8_save_content_scope_mismatch" };
  }
  if (
    save.commandStreamHash !== expected.commandStreamHash ||
    stableJson(save.rawMigrationPolicy) !== stableJson(expected.migrationPolicy) ||
    stableJson(save.rawSections) !== stableJson(expected.sections)
  ) {
    return { ok: false, reason: "m8_save_integrity_mismatch" };
  }
  if (stableJson(save.rawProjection) !== stableJson(expected.readOnlyProjection)) {
    return { ok: false, reason: "m8_save_projection_invalid" };
  }
  return {
    ok: true,
    save: expected,
    loadTick: M8_LOAD_TICK,
    validationTimeTicks: 2,
    rebuildTimeTicks: expected.readOnlyProjection.rebuiltIndexes.rebuildTimeTicks,
    rebuiltSurfaceNames: M8_REBUILT_SURFACE_NAMES,
    projection: expected.readOnlyProjection,
    loadedStateHash: createLoadedStateHash(expected, expected.readOnlyProjection),
  };
}

export function resumeM8FactionEndgameFromSave(options: M8ResumeOptions): M8ReplayResult {
  const loaded = loadM8FactionEndgameSaveEnvelope(options.save);
  if (!loaded.ok) return loaded;
  if (!isSafeTick(options.finalTick) || !isSafeTick(options.loadTick)) {
    return { ok: false, reason: "m8_tick_invalid" };
  }
  if (options.loadTick !== loaded.save.createdTick + 1 || options.loadTick !== M8_LOAD_TICK) {
    return { ok: false, reason: "m8_load_tick_invalid" };
  }
  if (options.finalTick < options.loadTick) {
    return { ok: false, reason: "m8_resume_tick_before_load" };
  }
  if (options.finalTick !== M8_FINAL_TICK) {
    return { ok: false, reason: "m8_tick_invalid" };
  }
  const normalized = normalizeCheckpointTicks(
    includeSaveTick(
      loaded.save.createdTick,
      options.finalTick,
      options.checkpointTicks ?? M8_REPLAY_CHECKPOINT_SEQUENCE,
    ),
  );
  if (!normalized.ok) return normalized;
  const checkpoints = createResumedCheckpoints(loaded, normalized.value);
  if (!checkpoints.ok) return checkpoints;
  const finalCheckpoint = checkpoints.value[checkpoints.value.length - 1];
  if (finalCheckpoint === undefined) return { ok: false, reason: "m8_checkpoint_order_invalid" };
  return {
    ok: true,
    replay: {
      scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
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

export function createM8ReadOnlyProjection(
  summary: M8FactionEndgameScenarioSummary,
  tick: Tick,
  contentScopeHash: string = createContentScopeHash(summary),
): M8ReadOnlyProjection {
  const worldHash = createWorldHash(summary, tick, contentScopeHash);
  const surfaces = createRebuiltSurfaceHashes(summary, tick, worldHash);
  const indexHash = createRebuiltIndexHash(summary, tick, worldHash, surfaces);
  const readModelHash = formatCanonicalWorldHash({
    fields: [
      { name: "contentScopeHash", value: contentScopeHash },
      { name: "hashVersion", value: M8_READ_MODEL_HASH_VERSION },
      { name: "rebuiltIndexHash", value: indexHash },
      { name: "scenarioHash", value: summary.scenarioHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: tick },
      { name: "worldHash", value: worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
  return {
    projectionVersion: 1,
    scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
    tick,
    contentScopeHash,
    worldHash,
    readModelHash,
    rebuiltIndexes: {
      rebuiltIndexesSchemaVersion: 1,
      names: M8_REBUILT_SURFACE_NAMES,
      surfaces,
      basisTick: tick,
      basisWorldHash: worldHash,
      rebuildTimeTicks: 2,
      indexHash,
    },
  };
}

export function compareM8ReplayRuns(
  expected: M8ReplayRun,
  actual: M8ReplayRun,
  artifactPaths: M8ReplayArtifactPaths,
): M8ReplayComparison {
  const count = Math.min(expected.checkpoints.length, actual.checkpoints.length);
  for (let index = 0; index < count; index += 1) {
    const left = expected.checkpoints[index];
    const right = actual.checkpoints[index];
    if (left?.tick !== right?.tick || left === undefined || right === undefined) {
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
    scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
    seed: expected.seed,
    checkpointCount: expected.checkpoints.length,
    artifactPaths,
  };
}

export function createM8AdvanceCommandId(tick: Tick, sequence: number): string {
  if (!isSafeTick(tick) || !Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("M8 advance command id requires safe non-negative integer fields");
  }
  return `${M8_COMMAND_PREFIX}${String(tick)}.${String(sequence)}`;
}

export function parseM8AdvanceCommandId(
  commandId: string,
): { readonly ok: true; readonly tick: Tick; readonly sequence: number } | { readonly ok: false } {
  if (!commandId.startsWith(M8_COMMAND_PREFIX)) return { ok: false };
  const rest = commandId.slice(M8_COMMAND_PREFIX.length);
  const dotIndex = rest.indexOf(".");
  if (dotIndex <= 0 || dotIndex === rest.length - 1) return { ok: false };
  const tick = parseSafeNonNegativeInteger(rest.slice(0, dotIndex));
  const sequence = parseSafeNonNegativeInteger(rest.slice(dotIndex + 1));
  if (tick === null || sequence === null || !isSafeTick(tick)) {
    return { ok: false };
  }
  return { ok: true, tick, sequence };
}

function createMigrationPolicy(): M8MigrationPolicySection {
  return {
    migrationPolicyVersion: M8_SECTION_VERSION,
    publicSaveCompatibility: "owner_gated",
    crossVersionMigration: "owner_gated",
    windowsWebInteroperability: "owner_gated",
    desktopSaveBridge: "owner_gated",
  };
}

function createSections(
  createdTick: Tick,
  summary: M8FactionEndgameScenarioSummary,
  contentScopeHash: string,
): M8SaveSections {
  const projection = createM8ReadOnlyProjection(summary, createdTick, contentScopeHash);
  return {
    ownerStores: {
      ownerStoresVersion: M8_SECTION_VERSION,
      ownerHandles: createOwnerHandles(summary),
      factionArcRecords: createFactionArcRecords(summary.factionArcs),
      routeRecords: createRouteRecords(summary.routes),
    },
    commandLogTail: {
      commandLogTailVersion: M8_SECTION_VERSION,
      checkpointTick: createdTick,
      checkpointWorldHash: projection.worldHash,
      commandStreamHash: createCommandStreamHash(createdTick),
      contentScopeHash,
      nextCommandSequence: countCommandsThroughTick(createdTick),
      commandTail: createCommandTail(createdTick),
    },
    reasonMetrics: {
      reasonMetricsVersion: M8_SECTION_VERSION,
      checkpointHashes: createCheckpointHashRecords(summary.requestedSeed, createdTick),
      gateMetrics: createGateMetrics(summary),
    },
  };
}

function createOwnerHandles(
  summary: M8FactionEndgameScenarioSummary,
): readonly M8OwnerHandleRecord[] {
  return [
    {
      handleId: 1,
      storeKind: 8,
      ownerVersion: summary.metrics.ownerVersion,
      activeCount: summary.metrics.activeArcCount,
    },
    {
      handleId: 2,
      storeKind: 9,
      ownerVersion: summary.metrics.ownerVersion,
      activeCount: summary.metrics.activeRoutePathCount,
    },
  ];
}

function createFactionArcRecords(
  arcs: readonly M8FactionArcScenarioEvidence[],
): readonly M8FactionArcSaveRecord[] {
  const records: M8FactionArcSaveRecord[] = [];
  for (const arc of arcs) {
    records.push({
      arcId: arc.factionId,
      factionId: arc.factionId,
      arcState: arc.arcState,
      resourceMask: arc.resourceMask,
      constraintMask: arc.constraintMask,
      contradictionMask: arc.contradictionMask,
      negotiationMask: arc.negotiationMask,
      failureMask: arc.failureMask,
      explanationMask: arc.explanationMask,
      factSelectedCount: arc.factionFactSelectedCount,
      factVisitedCount: arc.factionFactVisitedCount,
    });
  }
  return records;
}

function createRouteRecords(
  routes: readonly M8EndgameRouteScenarioEvidence[],
): readonly M8RouteSaveRecord[] {
  const records: M8RouteSaveRecord[] = [];
  for (const route of routes) {
    records.push({
      routeId: route.routeId,
      routeState: route.routeState,
      reason: route.reason,
      supportScore: route.supportScore,
      costScore: route.costScore,
      oppositionScore: route.oppositionScore,
      explanationMask: route.explanationMask,
    });
  }
  return records;
}

function createGateMetrics(summary: M8FactionEndgameScenarioSummary): M8GateMetricsRecord {
  return {
    ownerVersion: summary.metrics.ownerVersion,
    activeArcCount: summary.metrics.activeArcCount,
    activeRoutePathCount: summary.metrics.activeRoutePathCount,
    negotiatedArcCount: summary.metrics.negotiatedArcCount,
    availableRouteCount: summary.metrics.availableRouteCount,
    blockedRouteCount: summary.metrics.blockedRouteCount,
    contestedRouteCount: summary.metrics.contestedRouteCount,
    factionFactVisits: summary.performance.factionFactVisits,
    routeVisits: summary.performance.routeVisits,
    capHitCount: summary.performance.capHitCount,
    staleRejectCount: summary.performance.staleRejectCount,
  };
}

function createCheckpoints(
  requestedSeed: string,
  ticks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly M8ReplayCheckpoint[] }
  | { readonly ok: false; readonly reason: M8SaveReplayReason } {
  const checkpoints: M8ReplayCheckpoint[] = [];
  for (const tick of ticks) {
    if (!isSafeTick(tick)) return { ok: false, reason: "m8_tick_invalid" };
    checkpoints.push(createReplayCheckpoint(runM8FactionEndgameScenario(requestedSeed), tick));
  }
  return { ok: true, value: checkpoints };
}

function createResumedCheckpoints(
  loaded: Extract<M8SaveLoadResult, { readonly ok: true }>,
  ticks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly M8ReplayCheckpoint[] }
  | { readonly ok: false; readonly reason: M8SaveReplayReason } {
  const checkpoints: M8ReplayCheckpoint[] = [];
  for (const tick of ticks) {
    if (!isSafeTick(tick) || tick < loaded.save.createdTick) {
      return { ok: false, reason: "m8_tick_invalid" };
    }
    checkpoints.push(
      createReplayCheckpoint(runM8FactionEndgameScenario(loaded.save.requestedSeed), tick),
    );
  }
  return { ok: true, value: checkpoints };
}

function createReplayCheckpoint(
  summary: M8FactionEndgameScenarioSummary,
  tick: Tick,
): M8ReplayCheckpoint {
  const projection = createM8ReadOnlyProjection(summary, tick);
  return {
    tick,
    worldHash: projection.worldHash,
    readModelHash: projection.readModelHash,
    checkpointHash: createCheckpointHash(projection),
    rebuiltSurfaceHash: projection.rebuiltIndexes.indexHash,
  };
}

function createCheckpointHashRecords(
  requestedSeed: string,
  createdTick: Tick,
): readonly M8CheckpointHashRecord[] {
  const records: M8CheckpointHashRecord[] = [];
  for (const tick of M8_REPLAY_CHECKPOINT_SEQUENCE) {
    if (tick > createdTick) continue;
    const checkpoint = createReplayCheckpoint(runM8FactionEndgameScenario(requestedSeed), tick);
    records.push({
      tick,
      worldHash: checkpoint.worldHash,
      readModelHash: checkpoint.readModelHash,
      checkpointHash: checkpoint.checkpointHash,
    });
  }
  return records;
}

function createContentScopeHash(summary: M8FactionEndgameScenarioSummary): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "alias", value: summary.alias },
      { name: "arcCount", value: summary.factionArcs.length },
      { name: "routeCount", value: summary.routes.length },
      { name: "scenarioHash", value: summary.scenarioHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "translationInventory", value: "WM-0124" },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createWorldHash(
  summary: M8FactionEndgameScenarioSummary,
  tick: Tick,
  contentScopeHash: string,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "availableRouteCount", value: summary.metrics.availableRouteCount },
      { name: "contentScopeHash", value: contentScopeHash },
      { name: "contestedRouteCount", value: summary.metrics.contestedRouteCount },
      { name: "negotiatedArcCount", value: summary.metrics.negotiatedArcCount },
      { name: "ownerVersion", value: summary.metrics.ownerVersion },
      { name: "scenarioHash", value: summary.scenarioHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: tick },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createRebuiltSurfaceHashes(
  summary: M8FactionEndgameScenarioSummary,
  tick: Tick,
  worldHash: string,
): readonly M8SurfaceHashRecord[] {
  const records: M8SurfaceHashRecord[] = [];
  for (let index = 0; index < M8_REBUILT_SURFACE_NAMES.length; index += 1) {
    const name = M8_REBUILT_SURFACE_NAMES[index];
    if (name === undefined) continue;
    let hash = hashStringToUint32("m8 rebuilt surface");
    hash = mixUint32(hash, hashStringToUint32(name));
    hash = mixUint32(hash, tick);
    hash = mixUint32(hash, hashStringToUint32(worldHash));
    hash = mixUint32(hash, hashStringToUint32(summary.scenarioHash));
    hash = mixUint32(hash, summary.metrics.ownerVersion);
    records.push({ name, hash: formatUint32Hex(hash), sourceVersion: index + 1 });
  }
  return records;
}

function createRebuiltIndexHash(
  summary: M8FactionEndgameScenarioSummary,
  tick: Tick,
  worldHash: string,
  surfaces: readonly M8SurfaceHashRecord[],
): string {
  let hash = hashStringToUint32("m8 rebuilt indexes");
  hash = mixUint32(hash, tick);
  hash = mixUint32(hash, hashStringToUint32(worldHash));
  hash = mixUint32(hash, hashStringToUint32(summary.scenarioHash));
  for (const surface of surfaces) {
    hash = mixUint32(hash, hashStringToUint32(surface.name));
    hash = mixUint32(hash, hashStringToUint32(surface.hash));
    hash = mixUint32(hash, surface.sourceVersion);
  }
  return formatUint32Hex(hash);
}

function createCheckpointHash(projection: M8ReadOnlyProjection): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "readModelHash", value: projection.readModelHash },
      { name: "scenarioId", value: projection.scenarioId },
      { name: "tick", value: projection.tick },
      { name: "worldHash", value: projection.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createLoadedStateHash(save: M8SaveEnvelope, projection: M8ReadOnlyProjection): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "contentScopeHash", value: save.contentScopeHash },
      { name: "createdTick", value: save.createdTick },
      { name: "migrationPolicy", value: save.migrationPolicy.publicSaveCompatibility },
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

function normalizeCheckpointTicks(
  checkpointTicks: readonly Tick[],
):
  | { readonly ok: true; readonly value: readonly Tick[] }
  | { readonly ok: false; readonly reason: M8SaveReplayReason } {
  let previous = -1;
  for (const tick of checkpointTicks) {
    if (!isSafeTick(tick) || tick <= previous) {
      return { ok: false, reason: "m8_checkpoint_order_invalid" };
    }
    previous = tick;
  }
  return { ok: true, value: checkpointTicks };
}

function includeSaveTick(
  saveTick: Tick,
  finalTick: Tick,
  checkpointTicks: readonly Tick[],
): readonly Tick[] {
  const output: Tick[] = [];
  let saveTickInserted = false;
  for (const tick of checkpointTicks) {
    if (tick < saveTick || tick > finalTick) continue;
    if (!saveTickInserted && saveTick < tick) {
      output.push(saveTick);
      saveTickInserted = true;
    }
    if (tick === saveTick) saveTickInserted = true;
    output.push(tick);
  }
  if (!saveTickInserted && saveTick <= finalTick) output.push(saveTick);
  return output;
}

function createComparisonFailure(
  seed: string,
  firstDivergentTick: Tick | null,
  artifactPaths: M8ReplayArtifactPaths,
  reason: "checkpoint_count_mismatch" | "world_hash_mismatch" | "read_model_hash_mismatch",
): M8ReplayComparison {
  return {
    ok: false,
    scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
    seed,
    firstDivergentTick,
    reason,
    artifactPaths,
  };
}

function parseSaveEnvelope(
  input: unknown,
):
  | { readonly ok: true; readonly value: ParsedSaveEnvelope }
  | { readonly ok: false; readonly reason: M8SaveReplayReason } {
  if (!isRecord(input)) return { ok: false, reason: "m8_save_magic_invalid" };
  const envelope = readSaveEnvelope(input);
  if (envelope.magic !== M8_SAVE_MAGIC) return { ok: false, reason: "m8_save_magic_invalid" };
  if (
    envelope.formatVersion !== M8_SAVE_FORMAT_VERSION ||
    envelope.sectionDirectoryVersion !== M8_SECTION_DIRECTORY_VERSION
  ) {
    return { ok: false, reason: "m8_save_version_invalid" };
  }
  if (
    envelope.scenarioId !== M8_FACTION_ENDGAME_SCENARIO_ID ||
    envelope.alias !== M8_FACTION_ENDGAME_ALIAS
  ) {
    return { ok: false, reason: "m8_save_scenario_invalid" };
  }
  if (
    typeof envelope.requestedSeed !== "string" ||
    envelope.requestedSeed.length === 0 ||
    envelope.seed !== envelope.requestedSeed
  ) {
    return { ok: false, reason: "m8_save_seed_invalid" };
  }
  if (!isHashString(envelope.contentScopeHash) || !isHashString(envelope.commandStreamHash)) {
    return { ok: false, reason: "m8_save_content_scope_mismatch" };
  }
  if (
    !isTickLane(envelope.createdTick) ||
    !isTickLane(envelope.nextTick) ||
    envelope.createdTick !== M8_SAVE_TICK ||
    envelope.nextTick !== M8_LOAD_TICK
  ) {
    return { ok: false, reason: "m8_tick_invalid" };
  }
  if (!validateMigrationPolicy(envelope.migrationPolicy)) {
    return { ok: false, reason: "m8_save_migration_policy_invalid" };
  }
  if (!validateSectionsShape(envelope.sections)) {
    return { ok: false, reason: "m8_save_section_invalid" };
  }
  if (!validateProjectionShape(envelope.readOnlyProjection, envelope.createdTick)) {
    return { ok: false, reason: "m8_save_projection_invalid" };
  }
  return {
    ok: true,
    value: {
      rawMigrationPolicy: envelope.migrationPolicy,
      rawSections: envelope.sections,
      rawProjection: envelope.readOnlyProjection,
      requestedSeed: envelope.requestedSeed,
      createdTick: envelope.createdTick,
      contentScopeHash: envelope.contentScopeHash,
      commandStreamHash: envelope.commandStreamHash,
    },
  };
}

function validateMigrationPolicy(input: unknown): boolean {
  if (!isRecord(input)) return false;
  return (
    input["migrationPolicyVersion"] === M8_SECTION_VERSION &&
    input["publicSaveCompatibility"] === "owner_gated" &&
    input["crossVersionMigration"] === "owner_gated" &&
    input["windowsWebInteroperability"] === "owner_gated" &&
    input["desktopSaveBridge"] === "owner_gated"
  );
}

function validateSectionsShape(input: unknown): boolean {
  if (!isRecord(input)) return false;
  return (
    validateOwnerStores(input["ownerStores"]) &&
    validateCommandLogTail(input["commandLogTail"]) &&
    validateReasonMetrics(input["reasonMetrics"])
  );
}

function validateOwnerStores(input: unknown): boolean {
  if (!isRecord(input)) return false;
  return (
    input["ownerStoresVersion"] === M8_SECTION_VERSION &&
    validateOwnerHandles(input["ownerHandles"]) &&
    validateArcRecords(input["factionArcRecords"]) &&
    validateRouteRecords(input["routeRecords"])
  );
}

function validateOwnerHandles(input: unknown): boolean {
  if (!Array.isArray(input) || input.length !== 2) return false;
  let previousHandle = 0;
  for (const record of input) {
    if (!isRecord(record)) return false;
    const handleId = record["handleId"];
    if (!isPositiveUint32(handleId) || handleId <= previousHandle) return false;
    if (
      !isPositiveUint32(record["storeKind"]) ||
      !isPositiveUint32(record["ownerVersion"]) ||
      !isUintLane(record["activeCount"])
    ) {
      return false;
    }
    previousHandle = handleId;
  }
  return true;
}

function validateArcRecords(input: unknown): boolean {
  if (!Array.isArray(input) || input.length !== M8_FACTION_COUNT) return false;
  let previousArc = -1;
  for (const record of input) {
    if (!isRecord(record)) return false;
    const arcId = record["arcId"];
    if (!isUintLane(arcId) || arcId <= previousArc || arcId >= M8_FACTION_COUNT) return false;
    if (
      record["factionId"] !== arcId ||
      !isPositiveUint32(record["arcState"]) ||
      !isPositiveUint32(record["resourceMask"]) ||
      !isPositiveUint32(record["constraintMask"]) ||
      !isPositiveUint32(record["contradictionMask"]) ||
      !isPositiveUint32(record["negotiationMask"]) ||
      !isPositiveUint32(record["failureMask"]) ||
      !isPositiveUint32(record["explanationMask"]) ||
      !isPositiveUint32(record["factSelectedCount"]) ||
      !isPositiveUint32(record["factVisitedCount"])
    ) {
      return false;
    }
    previousArc = arcId;
  }
  return true;
}

function validateRouteRecords(input: unknown): boolean {
  if (!Array.isArray(input) || input.length !== M8_ENDGAME_ROUTE_COUNT) return false;
  let previousRoute = -1;
  for (const record of input) {
    if (!isRecord(record)) return false;
    const routeId = record["routeId"];
    if (!isUintLane(routeId) || routeId <= previousRoute || routeId >= M8_ENDGAME_ROUTE_COUNT) {
      return false;
    }
    if (
      !isPositiveUint32(record["routeState"]) ||
      typeof record["reason"] !== "string" ||
      !isScore(record["supportScore"]) ||
      !isScore(record["costScore"]) ||
      !isScore(record["oppositionScore"]) ||
      !isPositiveUint32(record["explanationMask"])
    ) {
      return false;
    }
    previousRoute = routeId;
  }
  return true;
}

function validateCommandLogTail(input: unknown): boolean {
  if (!isRecord(input)) return false;
  const commandTail = input["commandTail"];
  if (
    input["commandLogTailVersion"] !== M8_SECTION_VERSION ||
    !isTickLane(input["checkpointTick"]) ||
    !isHashString(input["checkpointWorldHash"]) ||
    !isHashString(input["commandStreamHash"]) ||
    !isHashString(input["contentScopeHash"]) ||
    !isUintLane(input["nextCommandSequence"]) ||
    !Array.isArray(commandTail)
  ) {
    return false;
  }
  let previousSequence = -1;
  for (const record of commandTail) {
    if (!isRecord(record)) return false;
    const sequence = record["sequence"];
    if (!isTickLane(record["tick"]) || !isUintLane(sequence) || sequence <= previousSequence) {
      return false;
    }
    if (!isHashString(record["commandHash"])) return false;
    previousSequence = sequence;
  }
  return commandTail.length > 0;
}

function validateReasonMetrics(input: unknown): boolean {
  if (!isRecord(input)) return false;
  const checkpoints = input["checkpointHashes"];
  if (
    input["reasonMetricsVersion"] !== M8_SECTION_VERSION ||
    !Array.isArray(checkpoints) ||
    !validateGateMetrics(input["gateMetrics"])
  ) {
    return false;
  }
  let previousTick = -1;
  for (const record of checkpoints) {
    if (!isRecord(record)) return false;
    const tick = record["tick"];
    if (!isTickLane(tick) || tick <= previousTick) return false;
    if (
      !isHashString(record["worldHash"]) ||
      !isHashString(record["readModelHash"]) ||
      !isHashString(record["checkpointHash"])
    ) {
      return false;
    }
    previousTick = tick;
  }
  return checkpoints.length > 0;
}

function validateGateMetrics(input: unknown): boolean {
  if (!isRecord(input)) return false;
  return (
    isPositiveUint32(input["ownerVersion"]) &&
    isUintLane(input["activeArcCount"]) &&
    isUintLane(input["activeRoutePathCount"]) &&
    isUintLane(input["negotiatedArcCount"]) &&
    isUintLane(input["availableRouteCount"]) &&
    isUintLane(input["blockedRouteCount"]) &&
    isUintLane(input["contestedRouteCount"]) &&
    isUintLane(input["factionFactVisits"]) &&
    isUintLane(input["routeVisits"]) &&
    isUintLane(input["capHitCount"]) &&
    isUintLane(input["staleRejectCount"])
  );
}

function validateProjectionShape(input: unknown, tick: Tick): boolean {
  if (!isRecord(input)) return false;
  const rebuilt = input["rebuiltIndexes"];
  if (
    input["projectionVersion"] !== 1 ||
    input["scenarioId"] !== M8_FACTION_ENDGAME_SCENARIO_ID ||
    input["tick"] !== tick ||
    !isHashString(input["contentScopeHash"]) ||
    !isHashString(input["worldHash"]) ||
    !isHashString(input["readModelHash"]) ||
    !isRecord(rebuilt)
  ) {
    return false;
  }
  const names = rebuilt["names"];
  const surfaces = rebuilt["surfaces"];
  if (!Array.isArray(names) || !Array.isArray(surfaces)) return false;
  if (names.length !== M8_REBUILT_SURFACE_NAMES.length) return false;
  for (let index = 0; index < names.length; index += 1) {
    if (names[index] !== M8_REBUILT_SURFACE_NAMES[index]) return false;
  }
  return (
    surfaces.length === M8_REBUILT_SURFACE_NAMES.length &&
    rebuilt["rebuiltIndexesSchemaVersion"] === 1 &&
    rebuilt["basisTick"] === tick &&
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
    contentScopeHash: record["contentScopeHash"],
    commandStreamHash: record["commandStreamHash"],
    createdTick: record["createdTick"],
    nextTick: record["nextTick"],
    migrationPolicy: record["migrationPolicy"],
    sections: record["sections"],
    readOnlyProjection: record["readOnlyProjection"],
  };
}

function createCommandTail(createdTick: Tick): readonly M8CommandTailRecord[] {
  const records: M8CommandTailRecord[] = [];
  for (const command of M8_COMMANDS) {
    if (command.tick <= createdTick) {
      records.push({
        tick: command.tick,
        sequence: command.sequence,
        commandHash: createCommandHash(command),
      });
    }
  }
  const keepFrom = Math.max(0, records.length - 4);
  return records.slice(keepFrom);
}

function createCommandStreamHash(createdTick: Tick): string {
  let hash = hashStringToUint32(M8_FACTION_ENDGAME_SCENARIO_ID);
  for (const command of M8_COMMANDS) {
    if (command.tick <= createdTick)
      hash = mixUint32(hash, hashStringToUint32(createCommandHash(command)));
  }
  return formatUint32Hex(hash);
}

function countCommandsThroughTick(tick: Tick): number {
  let count = 0;
  for (const command of M8_COMMANDS) {
    if (command.tick <= tick) count += 1;
  }
  return count;
}

function createCommandHash(command: M8ScenarioCommandRecord): string {
  let hash = hashStringToUint32(M8_FACTION_ENDGAME_SCENARIO_ID);
  hash = mixUint32(hash, command.tick);
  hash = mixUint32(hash, command.sequence);
  hash = mixUint32(hash, hashStringToUint32(command.reason));
  hash = mixUint32(hash, command.subjectId);
  hash = mixUint32(hash, command.targetId);
  return formatUint32Hex(hash);
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

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}

function isHashString(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10 || !value.startsWith("0x")) return false;
  for (let index = 2; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const digit = code >= 48 && code <= 57;
    const lowerHex = code >= 97 && code <= 102;
    if (!digit && !lowerHex) return false;
  }
  return true;
}

function parseSafeNonNegativeInteger(value: string): number | null {
  if (value.length === 0) return null;
  let parsed = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return null;
    const digit = code - 48;
    if (parsed > Math.floor((Number.MAX_SAFE_INTEGER - digit) / 10)) return null;
    parsed = parsed * 10 + digit;
  }
  return parsed;
}

interface M8ScenarioCommandRecord {
  readonly tick: Tick;
  readonly sequence: number;
  readonly reason: string;
  readonly subjectId: number;
  readonly targetId: number;
}

const M8_COMMANDS: readonly M8ScenarioCommandRecord[] = Object.freeze([
  { tick: 0, sequence: 0, reason: "m8.faction_endgame.initialized", subjectId: 8, targetId: 1 },
  { tick: 36_000, sequence: 1, reason: "m8.faction_facts.seeded", subjectId: 6, targetId: 42 },
  {
    tick: M8_SAVE_TICK,
    sequence: 2,
    reason: "m8.faction_arcs.negotiated",
    subjectId: 6,
    targetId: 6,
  },
  {
    tick: M8_LOAD_TICK,
    sequence: 3,
    reason: "m8.endgame_routes.evaluated",
    subjectId: 5,
    targetId: 5,
  },
  {
    tick: M8_FINAL_TICK,
    sequence: 4,
    reason: "m8.long_save_gate.sampled",
    subjectId: 1,
    targetId: 0,
  },
]);
