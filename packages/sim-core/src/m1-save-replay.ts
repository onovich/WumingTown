import {
  HAULING_BUILDING_SCENARIO_ID,
  runHaulingBuildingScenario,
  type HaulingBuildingScenarioSummary,
} from "./hauling-building-scenario";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";

export const M1_SAVE_MAGIC = "wuming-town.m1.save";
export const M1_SAVE_FORMAT_VERSION = 1;
export const M1_SECTION_DIRECTORY_VERSION = 1;
export const M1_SECTION_VERSION = 1;
export const M1_READ_MODEL_HASH_VERSION = 1;
export const M1_COMMAND_PREFIX = "m1.hauling-building.advance.";

export type M1SaveReplayReason =
  | "m1_tick_invalid"
  | "m1_seed_invalid"
  | "m1_checkpoint_order_invalid"
  | "m1_save_shape_invalid"
  | "m1_save_magic_invalid"
  | "m1_save_version_unsupported"
  | "m1_save_scenario_invalid"
  | "m1_save_section_invalid"
  | "m1_save_projection_invalid"
  | "m1_resume_tick_before_save";

export type M1SaveLoadResult =
  | {
      readonly ok: true;
      readonly save: M1HaulingBuildingSaveEnvelope;
      readonly rebuiltIndexes: readonly string[];
      readonly projection: M1ReadOnlyProjection;
    }
  | {
      readonly ok: false;
      readonly reason: M1SaveReplayReason;
    };

export type M1ReplayResult =
  | {
      readonly ok: true;
      readonly replay: M1ReplayRun;
    }
  | {
      readonly ok: false;
      readonly reason: M1SaveReplayReason;
    };

export type M1SaveEnvelopeResult =
  | {
      readonly ok: true;
      readonly save: M1HaulingBuildingSaveEnvelope;
    }
  | {
      readonly ok: false;
      readonly reason: M1SaveReplayReason;
    };

export interface M1ReplayOptions {
  readonly seed: string;
  readonly checkpointTicks: readonly Tick[];
}

export interface M1ResumeOptions {
  readonly save: unknown;
  readonly finalTick: Tick;
  readonly checkpointTicks: readonly Tick[];
}

export interface M1ReplayRun {
  readonly scenarioId: typeof HAULING_BUILDING_SCENARIO_ID;
  readonly seed: string;
  readonly checkpoints: readonly M1ReplayCheckpoint[];
  readonly finalTick: Tick;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
}

export interface M1ReplayCheckpoint {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly renderSnapshotHash: string;
  readonly uiDetailHash: string;
}

export interface M1HaulingBuildingSaveEnvelope {
  readonly magic: typeof M1_SAVE_MAGIC;
  readonly formatVersion: typeof M1_SAVE_FORMAT_VERSION;
  readonly scenarioId: typeof HAULING_BUILDING_SCENARIO_ID;
  readonly seed: string;
  readonly createdTick: Tick;
  readonly sectionDirectoryVersion: typeof M1_SECTION_DIRECTORY_VERSION;
  readonly sections: M1HaulingBuildingSaveSections;
  readonly readOnlyProjection: M1ReadOnlyProjection;
}

export interface M1HaulingBuildingSaveSections {
  readonly mapChunks: M1MapChunksSection;
  readonly entityStores: M1EntityStoresSection;
  readonly jobsReservations: M1JobsReservationsSection;
  readonly randomStreams: M1RandomStreamsSection;
  readonly commandLogTail: M1CommandLogTailSection;
}

export interface M1MapChunksSection {
  readonly mapChunksVersion: typeof M1_SECTION_VERSION;
  readonly width: 16;
  readonly height: 12;
  readonly anchorCellIndex: 124;
}

export interface M1EntityStoresSection {
  readonly entityStoresVersion: typeof M1_SECTION_VERSION;
  readonly completedBuildingCount: number;
  readonly buildSiteCompleted: boolean;
  readonly sourceWoodQuantity: number;
  readonly sourceStoneQuantity: number;
  readonly decoyPaperQuantity: number;
}

export interface M1JobsReservationsSection {
  readonly jobsReservationsVersion: typeof M1_SECTION_VERSION;
  readonly activeReservationCount: number;
  readonly runningJobCount: number;
  readonly carriedAmount: number;
}

export interface M1RandomStreamsSection {
  readonly randomStreamsVersion: typeof M1_SECTION_VERSION;
  readonly seed: string;
  readonly streamCount: 0;
}

export interface M1CommandLogTailSection {
  readonly commandLogTailVersion: typeof M1_SECTION_VERSION;
  readonly checkpointTick: Tick;
  readonly checkpointWorldHash: string;
  readonly nextCommandSequence: number;
}

export interface M1ReadOnlyProjection {
  readonly projectionVersion: 1;
  readonly scenarioId: typeof HAULING_BUILDING_SCENARIO_ID;
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly renderSnapshot: M1RenderSnapshotProjection;
  readonly uiDetail: M1UiDetailProjection;
}

export interface M1RenderSnapshotProjection {
  readonly renderSnapshotSchemaVersion: 1;
  readonly snapshotSequence: number;
  readonly tick: Tick;
  readonly entityCount: number;
  readonly worldHash: string;
  readonly readModelHash: string;
}

export interface M1UiDetailProjection {
  readonly uiReadModelSchemaVersion: 1;
  readonly requestId: string;
  readonly targetKind: "scenario";
  readonly scenarioId: typeof HAULING_BUILDING_SCENARIO_ID;
  readonly basisTick: Tick;
  readonly basisWorldHash: string;
  readonly detailHash: string;
  readonly summaries: readonly string[];
}

export interface M1ReplayArtifactPaths {
  readonly expected: string;
  readonly actual: string;
  readonly resumed: string;
  readonly save: string;
  readonly summary: string;
}

export type M1ReplayComparison =
  | {
      readonly ok: true;
      readonly scenarioId: typeof HAULING_BUILDING_SCENARIO_ID;
      readonly seed: string;
      readonly checkpointCount: number;
      readonly artifactPaths: M1ReplayArtifactPaths;
    }
  | {
      readonly ok: false;
      readonly scenarioId: typeof HAULING_BUILDING_SCENARIO_ID;
      readonly seed: string;
      readonly firstDivergentTick: Tick | null;
      readonly artifactPaths: M1ReplayArtifactPaths;
      readonly reason:
        | "checkpoint_count_mismatch"
        | "world_hash_mismatch"
        | "read_model_hash_mismatch";
    };

export function createM1AdvanceCommandId(tick: Tick): string {
  if (!isSafeTick(tick)) {
    throw new Error("M1 advance command tick must be a safe tick");
  }

  return `${M1_COMMAND_PREFIX}${String(tick)}`;
}

export function parseM1AdvanceCommandId(commandId: string): Tick | undefined {
  if (!commandId.startsWith(M1_COMMAND_PREFIX)) {
    return undefined;
  }

  const tick = Number(commandId.slice(M1_COMMAND_PREFIX.length));
  return isSafeTick(tick) ? tick : undefined;
}

export function runM1HaulingBuildingReplay(options: M1ReplayOptions): M1ReplayResult {
  const validation = validateReplayOptions(options.seed, options.checkpointTicks);
  if (!validation.ok) {
    return validation;
  }

  const checkpoints = createCheckpoints(options.seed, options.checkpointTicks);
  const finalCheckpoint = checkpoints[checkpoints.length - 1];
  if (finalCheckpoint === undefined) {
    return { ok: false, reason: "m1_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      seed: options.seed,
      checkpoints,
      finalTick: finalCheckpoint.tick,
      finalWorldHash: finalCheckpoint.worldHash,
      finalReadModelHash: finalCheckpoint.readModelHash,
    },
  };
}

export function createM1HaulingBuildingSaveEnvelope(
  seed: string,
  createdTick: Tick,
): M1SaveEnvelopeResult {
  if (seed.length === 0) {
    return { ok: false, reason: "m1_seed_invalid" };
  }

  if (!isSafeTick(createdTick)) {
    return { ok: false, reason: "m1_tick_invalid" };
  }

  const summary = runHaulingBuildingScenario({ seed, ticks: createdTick });
  const projection = createM1ReadOnlyProjection(summary, 0);
  return {
    ok: true,
    save: {
      magic: M1_SAVE_MAGIC,
      formatVersion: M1_SAVE_FORMAT_VERSION,
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      seed,
      createdTick,
      sectionDirectoryVersion: M1_SECTION_DIRECTORY_VERSION,
      sections: {
        mapChunks: {
          mapChunksVersion: M1_SECTION_VERSION,
          width: 16,
          height: 12,
          anchorCellIndex: 124,
        },
        entityStores: {
          entityStoresVersion: M1_SECTION_VERSION,
          completedBuildingCount: summary.endState.completedBuildingCount,
          buildSiteCompleted: summary.endState.buildSiteCompleted,
          sourceWoodQuantity: summary.endState.sourceWoodQuantity,
          sourceStoneQuantity: summary.endState.sourceStoneQuantity,
          decoyPaperQuantity: summary.endState.decoyPaperQuantity,
        },
        jobsReservations: {
          jobsReservationsVersion: M1_SECTION_VERSION,
          activeReservationCount: summary.endState.activeReservationCount,
          runningJobCount: summary.endState.runningJobCount,
          carriedAmount: summary.endState.pawnCarriedAmount,
        },
        randomStreams: {
          randomStreamsVersion: M1_SECTION_VERSION,
          seed,
          streamCount: 0,
        },
        commandLogTail: {
          commandLogTailVersion: M1_SECTION_VERSION,
          checkpointTick: createdTick,
          checkpointWorldHash: summary.worldHash,
          nextCommandSequence: 1,
        },
      },
      readOnlyProjection: projection,
    },
  };
}

export function loadM1HaulingBuildingSaveEnvelope(input: unknown): M1SaveLoadResult {
  const save = validateSaveEnvelope(input);
  if (!save.ok) {
    return save;
  }

  const expectedSummary = runHaulingBuildingScenario({
    seed: save.save.seed,
    ticks: save.save.createdTick,
  });
  const expectedProjection = createM1ReadOnlyProjection(
    expectedSummary,
    save.save.readOnlyProjection.renderSnapshot.snapshotSequence,
  );

  if (
    !sectionsMatchScenario(
      save.save.sections,
      save.save.seed,
      save.save.createdTick,
      expectedSummary,
    )
  ) {
    return { ok: false, reason: "m1_save_section_invalid" };
  }

  if (
    save.save.readOnlyProjection.worldHash !== expectedProjection.worldHash ||
    save.save.readOnlyProjection.readModelHash !== expectedProjection.readModelHash
  ) {
    return { ok: false, reason: "m1_save_projection_invalid" };
  }

  return {
    ok: true,
    save: save.save,
    rebuiltIndexes: ["work-offers", "reservations", "read-model"],
    projection: expectedProjection,
  };
}

export function resumeM1HaulingBuildingFromSave(options: M1ResumeOptions): M1ReplayResult {
  const loaded = loadM1HaulingBuildingSaveEnvelope(options.save);
  if (!loaded.ok) {
    return loaded;
  }

  if (!isSafeTick(options.finalTick)) {
    return { ok: false, reason: "m1_tick_invalid" };
  }

  if (options.finalTick < loaded.save.createdTick) {
    return { ok: false, reason: "m1_resume_tick_before_save" };
  }

  const ticks = includeSaveTick(
    loaded.save.createdTick,
    options.finalTick,
    options.checkpointTicks,
  );
  return runM1HaulingBuildingReplay({ seed: loaded.save.seed, checkpointTicks: ticks });
}

export function createM1ReadOnlyProjection(
  summary: HaulingBuildingScenarioSummary,
  snapshotSequence: number,
): M1ReadOnlyProjection {
  const renderSnapshotHash = createRenderSnapshotHash(summary, snapshotSequence);
  const uiDetailHash = createUiDetailHash(summary);
  const readModelHash = formatCanonicalWorldHash({
    fields: [
      { name: "hashVersion", value: M1_READ_MODEL_HASH_VERSION },
      { name: "renderSnapshotHash", value: renderSnapshotHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: summary.finalTick },
      { name: "uiDetailHash", value: uiDetailHash },
      { name: "worldHash", value: summary.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });

  return {
    projectionVersion: 1,
    scenarioId: HAULING_BUILDING_SCENARIO_ID,
    tick: summary.finalTick,
    worldHash: summary.worldHash,
    readModelHash,
    renderSnapshot: {
      renderSnapshotSchemaVersion: 1,
      snapshotSequence,
      tick: summary.finalTick,
      entityCount: summary.endState.completedBuildingCount,
      worldHash: summary.worldHash,
      readModelHash: renderSnapshotHash,
    },
    uiDetail: {
      uiReadModelSchemaVersion: 1,
      requestId: "m1-hauling-building-session",
      targetKind: "scenario",
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      basisTick: summary.finalTick,
      basisWorldHash: summary.worldHash,
      detailHash: uiDetailHash,
      summaries: [
        `completed=${String(summary.endState.completedBuildingCount)}`,
        `wood=${String(summary.endState.sourceWoodQuantity + summary.endState.deliveredWood)}`,
        `stone=${String(summary.endState.sourceStoneQuantity + summary.endState.deliveredStone)}`,
      ],
    },
  };
}

export function compareM1ReplayRuns(
  expected: M1ReplayRun,
  actual: M1ReplayRun,
  artifactPaths: M1ReplayArtifactPaths,
): M1ReplayComparison {
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
    scenarioId: HAULING_BUILDING_SCENARIO_ID,
    seed: expected.seed,
    checkpointCount: expected.checkpoints.length,
    artifactPaths,
  };
}

function createCheckpoints(
  seed: string,
  checkpointTicks: readonly Tick[],
): readonly M1ReplayCheckpoint[] {
  const checkpoints: M1ReplayCheckpoint[] = [];

  for (let index = 0; index < checkpointTicks.length; index += 1) {
    const tick = checkpointTicks[index] ?? 0;
    const summary = runHaulingBuildingScenario({ seed, ticks: tick });
    const projection = createM1ReadOnlyProjection(summary, index);
    checkpoints.push({
      tick,
      worldHash: summary.worldHash,
      readModelHash: projection.readModelHash,
      renderSnapshotHash: projection.renderSnapshot.readModelHash,
      uiDetailHash: projection.uiDetail.detailHash,
    });
  }

  return checkpoints;
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
): { readonly ok: true } | { readonly ok: false; readonly reason: M1SaveReplayReason } {
  if (seed.length === 0) {
    return { ok: false, reason: "m1_seed_invalid" };
  }

  if (checkpointTicks.length === 0) {
    return { ok: false, reason: "m1_checkpoint_order_invalid" };
  }

  let previous = -1;
  for (const tick of checkpointTicks) {
    if (!isSafeTick(tick)) {
      return { ok: false, reason: "m1_tick_invalid" };
    }

    if (tick <= previous) {
      return { ok: false, reason: "m1_checkpoint_order_invalid" };
    }

    previous = tick;
  }

  return { ok: true };
}

function validateSaveEnvelope(
  input: unknown,
):
  | { readonly ok: true; readonly save: M1HaulingBuildingSaveEnvelope }
  | { readonly ok: false; readonly reason: M1SaveReplayReason } {
  if (!isRecord(input)) {
    return { ok: false, reason: "m1_save_shape_invalid" };
  }

  if (input["magic"] !== M1_SAVE_MAGIC) {
    return { ok: false, reason: "m1_save_magic_invalid" };
  }

  if (
    input["formatVersion"] !== M1_SAVE_FORMAT_VERSION ||
    input["sectionDirectoryVersion"] !== M1_SECTION_DIRECTORY_VERSION
  ) {
    return { ok: false, reason: "m1_save_version_unsupported" };
  }

  if (input["scenarioId"] !== HAULING_BUILDING_SCENARIO_ID) {
    return { ok: false, reason: "m1_save_scenario_invalid" };
  }

  const seed = input["seed"];
  const createdTick = input["createdTick"];
  if (typeof seed !== "string" || seed.length === 0 || !isTickValue(createdTick)) {
    return { ok: false, reason: "m1_save_shape_invalid" };
  }

  const sections = input["sections"];
  const projection = input["readOnlyProjection"];
  if (!isSectionsRecord(sections) || !isProjectionRecord(projection)) {
    return { ok: false, reason: "m1_save_section_invalid" };
  }

  if (projection.tick !== createdTick) {
    return { ok: false, reason: "m1_save_projection_invalid" };
  }

  return {
    ok: true,
    save: {
      magic: M1_SAVE_MAGIC,
      formatVersion: M1_SAVE_FORMAT_VERSION,
      scenarioId: HAULING_BUILDING_SCENARIO_ID,
      seed,
      createdTick,
      sectionDirectoryVersion: M1_SECTION_DIRECTORY_VERSION,
      sections,
      readOnlyProjection: projection,
    },
  };
}

function isSectionsRecord(value: unknown): value is M1HaulingBuildingSaveSections {
  if (!isRecord(value)) {
    return false;
  }

  const mapChunks = value["mapChunks"];
  const entityStores = value["entityStores"];
  const jobsReservations = value["jobsReservations"];
  const randomStreams = value["randomStreams"];
  const commandLogTail = value["commandLogTail"];

  return (
    isRecord(mapChunks) &&
    mapChunks["mapChunksVersion"] === M1_SECTION_VERSION &&
    mapChunks["width"] === 16 &&
    mapChunks["height"] === 12 &&
    mapChunks["anchorCellIndex"] === 124 &&
    isRecord(entityStores) &&
    entityStores["entityStoresVersion"] === M1_SECTION_VERSION &&
    isNonNegativeInteger(entityStores["completedBuildingCount"]) &&
    typeof entityStores["buildSiteCompleted"] === "boolean" &&
    isNonNegativeInteger(entityStores["sourceWoodQuantity"]) &&
    isNonNegativeInteger(entityStores["sourceStoneQuantity"]) &&
    isNonNegativeInteger(entityStores["decoyPaperQuantity"]) &&
    isRecord(jobsReservations) &&
    jobsReservations["jobsReservationsVersion"] === M1_SECTION_VERSION &&
    isNonNegativeInteger(jobsReservations["activeReservationCount"]) &&
    isNonNegativeInteger(jobsReservations["runningJobCount"]) &&
    isNonNegativeInteger(jobsReservations["carriedAmount"]) &&
    isRecord(randomStreams) &&
    randomStreams["randomStreamsVersion"] === M1_SECTION_VERSION &&
    typeof randomStreams["seed"] === "string" &&
    randomStreams["streamCount"] === 0 &&
    isRecord(commandLogTail) &&
    commandLogTail["commandLogTailVersion"] === M1_SECTION_VERSION &&
    isTickValue(commandLogTail["checkpointTick"]) &&
    typeof commandLogTail["checkpointWorldHash"] === "string" &&
    isNonNegativeInteger(commandLogTail["nextCommandSequence"])
  );
}

function isProjectionRecord(value: unknown): value is M1ReadOnlyProjection {
  if (!isRecord(value)) {
    return false;
  }

  const renderSnapshot = value["renderSnapshot"];
  const uiDetail = value["uiDetail"];
  return (
    value["projectionVersion"] === 1 &&
    value["scenarioId"] === HAULING_BUILDING_SCENARIO_ID &&
    isTickValue(value["tick"]) &&
    typeof value["worldHash"] === "string" &&
    typeof value["readModelHash"] === "string" &&
    isRecord(renderSnapshot) &&
    renderSnapshot["renderSnapshotSchemaVersion"] === 1 &&
    isNonNegativeInteger(renderSnapshot["snapshotSequence"]) &&
    isTickValue(renderSnapshot["tick"]) &&
    isNonNegativeInteger(renderSnapshot["entityCount"]) &&
    typeof renderSnapshot["worldHash"] === "string" &&
    typeof renderSnapshot["readModelHash"] === "string" &&
    isRecord(uiDetail) &&
    uiDetail["uiReadModelSchemaVersion"] === 1 &&
    typeof uiDetail["requestId"] === "string" &&
    uiDetail["targetKind"] === "scenario" &&
    uiDetail["scenarioId"] === HAULING_BUILDING_SCENARIO_ID &&
    isTickValue(uiDetail["basisTick"]) &&
    typeof uiDetail["basisWorldHash"] === "string" &&
    typeof uiDetail["detailHash"] === "string" &&
    Array.isArray(uiDetail["summaries"]) &&
    everyString(uiDetail["summaries"])
  );
}

function sectionsMatchScenario(
  sections: M1HaulingBuildingSaveSections,
  seed: string,
  tick: Tick,
  summary: HaulingBuildingScenarioSummary,
): boolean {
  return (
    sections.entityStores.completedBuildingCount === summary.endState.completedBuildingCount &&
    sections.entityStores.buildSiteCompleted === summary.endState.buildSiteCompleted &&
    sections.entityStores.sourceWoodQuantity === summary.endState.sourceWoodQuantity &&
    sections.entityStores.sourceStoneQuantity === summary.endState.sourceStoneQuantity &&
    sections.entityStores.decoyPaperQuantity === summary.endState.decoyPaperQuantity &&
    sections.jobsReservations.activeReservationCount === summary.endState.activeReservationCount &&
    sections.jobsReservations.runningJobCount === summary.endState.runningJobCount &&
    sections.jobsReservations.carriedAmount === summary.endState.pawnCarriedAmount &&
    sections.randomStreams.seed === seed &&
    sections.commandLogTail.checkpointTick === tick &&
    sections.commandLogTail.checkpointWorldHash === summary.worldHash &&
    sections.commandLogTail.nextCommandSequence === 1
  );
}

function createRenderSnapshotHash(
  summary: HaulingBuildingScenarioSummary,
  snapshotSequence: number,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "entityCount", value: summary.endState.completedBuildingCount },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "snapshotSequence", value: snapshotSequence },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createUiDetailHash(summary: HaulingBuildingScenarioSummary): string {
  const fields: CanonicalWorldField[] = [
    { name: "activeReservations", value: summary.endState.activeReservationCount },
    { name: "completedBuildingCount", value: summary.endState.completedBuildingCount },
    { name: "scenarioId", value: summary.scenarioId },
    { name: "tick", value: summary.finalTick },
    { name: "worldHash", value: summary.worldHash },
  ];

  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function createComparisonFailure(
  seed: string,
  firstDivergentTick: Tick | null,
  artifactPaths: M1ReplayArtifactPaths,
  reason: "checkpoint_count_mismatch" | "world_hash_mismatch" | "read_model_hash_mismatch",
): M1ReplayComparison {
  return {
    ok: false,
    scenarioId: HAULING_BUILDING_SCENARIO_ID,
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

function isTickValue(value: unknown): value is Tick {
  return typeof value === "number" && isSafeTick(value);
}

function everyString(values: readonly unknown[]): boolean {
  for (const value of values) {
    if (typeof value !== "string") {
      return false;
    }
  }

  return true;
}
