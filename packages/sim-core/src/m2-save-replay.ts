import {
  M2_WORK_LOGISTICS_SCENARIO_ID,
  type M2WorkLogisticsScenarioSummary,
  runM2WorkLogisticsScenario,
} from "./m2-work-logistics-scenario";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";

export const M2_SAVE_MAGIC = "wuming-town.m2.save";
export const M2_SAVE_FORMAT_VERSION = 1;
export const M2_SECTION_DIRECTORY_VERSION = 1;
export const M2_SECTION_VERSION = 1;
export const M2_READ_MODEL_HASH_VERSION = 1;
export const M2_COMMAND_PREFIX = "m2.work-logistics.advance.";

const ACTOR_COUNT = 20;
const SITE_COUNT = 4;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 24;
const MAP_CHUNK_SIZE = 8;
const STACK_WOOD = 0;
const STACK_STONE = 1;
const STACK_PAPER = 2;
const WOOD_DEF = 101;
const STONE_DEF = 102;
const PAPER_DEF = 103;
const WOOD_PER_ORDER = 6;
const STONE_PER_ORDER = 3;
const BUILD_TICKS_PER_ORDER = 60;

export type M2SaveReplayReason =
  | "m2_tick_invalid"
  | "m2_seed_invalid"
  | "m2_checkpoint_order_invalid"
  | "m2_save_shape_invalid"
  | "m2_save_magic_invalid"
  | "m2_save_version_unsupported"
  | "m2_save_scenario_invalid"
  | "m2_save_section_invalid"
  | "m2_save_projection_invalid"
  | "m2_save_owner_handle_invalid"
  | "m2_save_integer_lane_invalid"
  | "m2_save_records_unsorted"
  | "m2_resume_tick_before_save";

export type M2SaveLoadResult =
  | {
      readonly ok: true;
      readonly save: M2WorkLogisticsSaveEnvelope;
      readonly rebuiltIndexes: readonly string[];
      readonly projection: M2ReadOnlyProjection;
    }
  | {
      readonly ok: false;
      readonly reason: M2SaveReplayReason;
    };

export type M2ReplayResult =
  | {
      readonly ok: true;
      readonly replay: M2ReplayRun;
    }
  | {
      readonly ok: false;
      readonly reason: M2SaveReplayReason;
    };

export type M2SaveEnvelopeResult =
  | {
      readonly ok: true;
      readonly save: M2WorkLogisticsSaveEnvelope;
    }
  | {
      readonly ok: false;
      readonly reason: M2SaveReplayReason;
    };

export interface M2ReplayOptions {
  readonly seed: string;
  readonly checkpointTicks: readonly Tick[];
}

export interface M2ResumeOptions {
  readonly save: unknown;
  readonly finalTick: Tick;
  readonly checkpointTicks: readonly Tick[];
}

export interface M2ReplayRun {
  readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
  readonly seed: string;
  readonly checkpoints: readonly M2ReplayCheckpoint[];
  readonly finalTick: Tick;
  readonly finalWorldHash: string;
  readonly finalReadModelHash: string;
}

export interface M2ReplayCheckpoint {
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly orderRecordHash: string;
  readonly rebuiltIndexHash: string;
}

export interface M2WorkLogisticsSaveEnvelope {
  readonly magic: typeof M2_SAVE_MAGIC;
  readonly formatVersion: typeof M2_SAVE_FORMAT_VERSION;
  readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
  readonly seed: string;
  readonly createdTick: Tick;
  readonly sectionDirectoryVersion: typeof M2_SECTION_DIRECTORY_VERSION;
  readonly sections: M2WorkLogisticsSaveSections;
  readonly readOnlyProjection: M2ReadOnlyProjection;
}

export interface M2WorkLogisticsSaveSections {
  readonly mapChunks: M2MapChunksSection;
  readonly entityStores: M2EntityStoresSection;
  readonly jobsReservations: M2JobsReservationsSection;
  readonly randomStreams: M2RandomStreamsSection;
  readonly commandLogTail: M2CommandLogTailSection;
}

export interface M2MapChunksSection {
  readonly mapChunksVersion: typeof M2_SECTION_VERSION;
  readonly width: typeof MAP_WIDTH;
  readonly height: typeof MAP_HEIGHT;
  readonly chunkSize: typeof MAP_CHUNK_SIZE;
  readonly siteCount: typeof SITE_COUNT;
}

export interface M2EntityStoresSection {
  readonly entityStoresVersion: typeof M2_SECTION_VERSION;
  readonly actorHandles: readonly M2OwnerHandle[];
  readonly itemStacks: readonly M2ItemStackRecord[];
  readonly buildOrders: readonly M2BuildOrderRecord[];
}

export interface M2JobsReservationsSection {
  readonly jobsReservationsVersion: typeof M2_SECTION_VERSION;
  readonly activeReservationCount: number;
  readonly runningJobCount: number;
  readonly records: readonly M2JobReservationRecord[];
}

export interface M2RandomStreamsSection {
  readonly randomStreamsVersion: typeof M2_SECTION_VERSION;
  readonly seed: string;
  readonly streamCount: 0;
}

export interface M2CommandLogTailSection {
  readonly commandLogTailVersion: typeof M2_SECTION_VERSION;
  readonly checkpointTick: Tick;
  readonly checkpointWorldHash: string;
  readonly nextCommandSequence: number;
}

export interface M2OwnerHandle {
  readonly index: number;
  readonly generation: number;
}

export interface M2ItemStackRecord {
  readonly stackId: number;
  readonly owner: M2OwnerHandle;
  readonly defId: number;
  readonly quantity: number;
}

export interface M2BuildOrderRecord {
  readonly orderId: number;
  readonly site: M2OwnerHandle;
  readonly completed: boolean;
  readonly deliveredWood: number;
  readonly deliveredStone: number;
  readonly buildProgressTicks: number;
}

export interface M2JobReservationRecord {
  readonly jobId: number;
  readonly owner: M2OwnerHandle;
  readonly kind: "delivery" | "build";
  readonly status: "completed";
  readonly carriedDefId: number;
  readonly carriedAmount: number;
  readonly stepTickCount: number;
}

export interface M2ReadOnlyProjection {
  readonly projectionVersion: 1;
  readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
  readonly tick: Tick;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly renderSnapshot: M2RenderSnapshotProjection;
  readonly orderReadModel: M2OrderReadModelProjection;
  readonly rebuiltIndexes: M2RebuiltIndexesProjection;
}

export interface M2RenderSnapshotProjection {
  readonly renderSnapshotSchemaVersion: 1;
  readonly snapshotSequence: number;
  readonly tick: Tick;
  readonly actorCount: typeof ACTOR_COUNT;
  readonly completedBuildOrders: number;
  readonly worldHash: string;
  readonly readModelHash: string;
}

export interface M2OrderReadModelProjection {
  readonly orderReadModelSchemaVersion: 1;
  readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
  readonly basisTick: Tick;
  readonly orderCount: typeof SITE_COUNT;
  readonly detailHash: string;
  readonly summaries: readonly string[];
}

export interface M2RebuiltIndexesProjection {
  readonly rebuiltIndexesSchemaVersion: 1;
  readonly names: readonly string[];
  readonly basisTick: Tick;
  readonly basisWorldHash: string;
  readonly indexHash: string;
}

export interface M2ReplayArtifactPaths {
  readonly expected: string;
  readonly actual: string;
  readonly resumed: string;
  readonly save: string;
  readonly summary: string;
}

export type M2ReplayComparison =
  | {
      readonly ok: true;
      readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
      readonly seed: string;
      readonly checkpointCount: number;
      readonly artifactPaths: M2ReplayArtifactPaths;
    }
  | {
      readonly ok: false;
      readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
      readonly seed: string;
      readonly firstDivergentTick: Tick | null;
      readonly artifactPaths: M2ReplayArtifactPaths;
      readonly reason:
        | "checkpoint_count_mismatch"
        | "world_hash_mismatch"
        | "read_model_hash_mismatch";
    };

export function createM2AdvanceCommandId(tick: Tick): string {
  if (!isSafeTick(tick)) {
    throw new Error("M2 advance command tick must be a safe tick");
  }

  return `${M2_COMMAND_PREFIX}${String(tick)}`;
}

export function parseM2AdvanceCommandId(commandId: string): Tick | undefined {
  if (!commandId.startsWith(M2_COMMAND_PREFIX)) {
    return undefined;
  }

  const tick = Number(commandId.slice(M2_COMMAND_PREFIX.length));
  return isSafeTick(tick) ? tick : undefined;
}

export function runM2WorkLogisticsReplay(options: M2ReplayOptions): M2ReplayResult {
  const validation = validateReplayOptions(options.seed, options.checkpointTicks);
  if (!validation.ok) {
    return validation;
  }

  const checkpoints = createCheckpoints(options.seed, options.checkpointTicks);
  const finalCheckpoint = checkpoints[checkpoints.length - 1];
  if (finalCheckpoint === undefined) {
    return { ok: false, reason: "m2_checkpoint_order_invalid" };
  }

  return {
    ok: true,
    replay: {
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      seed: options.seed,
      checkpoints,
      finalTick: finalCheckpoint.tick,
      finalWorldHash: finalCheckpoint.worldHash,
      finalReadModelHash: finalCheckpoint.readModelHash,
    },
  };
}

export function createM2WorkLogisticsSaveEnvelope(
  seed: string,
  createdTick: Tick,
): M2SaveEnvelopeResult {
  if (seed.length === 0) {
    return { ok: false, reason: "m2_seed_invalid" };
  }

  if (!isSafeTick(createdTick)) {
    return { ok: false, reason: "m2_tick_invalid" };
  }

  const summary = runM2WorkLogisticsScenario({ seed, ticks: createdTick });
  const projection = createM2ReadOnlyProjection(summary, 0);
  return {
    ok: true,
    save: {
      magic: M2_SAVE_MAGIC,
      formatVersion: M2_SAVE_FORMAT_VERSION,
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      seed,
      createdTick,
      sectionDirectoryVersion: M2_SECTION_DIRECTORY_VERSION,
      sections: createSections(seed, createdTick, summary),
      readOnlyProjection: projection,
    },
  };
}

export function loadM2WorkLogisticsSaveEnvelope(input: unknown): M2SaveLoadResult {
  const save = validateSaveEnvelope(input);
  if (!save.ok) {
    return save;
  }

  const expectedSummary = runM2WorkLogisticsScenario({
    seed: save.save.seed,
    ticks: save.save.createdTick,
  });
  const expectedProjection = createM2ReadOnlyProjection(
    expectedSummary,
    save.save.readOnlyProjection.renderSnapshot.snapshotSequence,
  );

  if (!sectionsMatchScenario(save.save.sections, save.save.seed, save.save.createdTick)) {
    return { ok: false, reason: "m2_save_section_invalid" };
  }

  if (!projectionMatchesExpected(save.save.readOnlyProjection, expectedProjection)) {
    return { ok: false, reason: "m2_save_projection_invalid" };
  }

  return {
    ok: true,
    save: save.save,
    rebuiltIndexes: ["work-offers", "path-caches", "reservations", "read-models"],
    projection: expectedProjection,
  };
}

export function resumeM2WorkLogisticsFromSave(options: M2ResumeOptions): M2ReplayResult {
  const loaded = loadM2WorkLogisticsSaveEnvelope(options.save);
  if (!loaded.ok) {
    return loaded;
  }

  if (!isSafeTick(options.finalTick)) {
    return { ok: false, reason: "m2_tick_invalid" };
  }

  if (options.finalTick < loaded.save.createdTick) {
    return { ok: false, reason: "m2_resume_tick_before_save" };
  }

  const ticks = includeSaveTick(
    loaded.save.createdTick,
    options.finalTick,
    options.checkpointTicks,
  );
  return runM2WorkLogisticsReplay({ seed: loaded.save.seed, checkpointTicks: ticks });
}

export function createM2ReadOnlyProjection(
  summary: M2WorkLogisticsScenarioSummary,
  snapshotSequence: number,
): M2ReadOnlyProjection {
  const renderSnapshotHash = createRenderSnapshotHash(summary, snapshotSequence);
  const orderReadModelHash = createOrderReadModelHash(summary);
  const rebuiltIndexHash = createRebuiltIndexHash(summary);
  const readModelHash = formatCanonicalWorldHash({
    fields: [
      { name: "hashVersion", value: M2_READ_MODEL_HASH_VERSION },
      { name: "orderReadModelHash", value: orderReadModelHash },
      { name: "rebuiltIndexHash", value: rebuiltIndexHash },
      { name: "renderSnapshotHash", value: renderSnapshotHash },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });

  return {
    projectionVersion: 1,
    scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
    tick: summary.finalTick,
    worldHash: summary.worldHash,
    readModelHash,
    renderSnapshot: {
      renderSnapshotSchemaVersion: 1,
      snapshotSequence,
      tick: summary.finalTick,
      actorCount: ACTOR_COUNT,
      completedBuildOrders: summary.endState.completedBuildOrders,
      worldHash: summary.worldHash,
      readModelHash: renderSnapshotHash,
    },
    orderReadModel: {
      orderReadModelSchemaVersion: 1,
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      basisTick: summary.finalTick,
      orderCount: SITE_COUNT,
      detailHash: orderReadModelHash,
      summaries: [
        `completed=${String(summary.endState.completedBuildOrders)}`,
        `wood=${String(summary.endState.deliveredWood)}`,
        `stone=${String(summary.endState.deliveredStone)}`,
        `progress=${String(summary.endState.buildProgressTotal)}`,
      ],
    },
    rebuiltIndexes: {
      rebuiltIndexesSchemaVersion: 1,
      names: ["work-offers", "path-caches", "reservations", "read-models"],
      basisTick: summary.finalTick,
      basisWorldHash: summary.worldHash,
      indexHash: rebuiltIndexHash,
    },
  };
}

export function compareM2ReplayRuns(
  expected: M2ReplayRun,
  actual: M2ReplayRun,
  artifactPaths: M2ReplayArtifactPaths,
): M2ReplayComparison {
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
    scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
    seed: expected.seed,
    checkpointCount: expected.checkpoints.length,
    artifactPaths,
  };
}

function createSections(
  seed: string,
  createdTick: Tick,
  summary: M2WorkLogisticsScenarioSummary,
): M2WorkLogisticsSaveSections {
  return {
    mapChunks: {
      mapChunksVersion: M2_SECTION_VERSION,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      chunkSize: MAP_CHUNK_SIZE,
      siteCount: SITE_COUNT,
    },
    entityStores: {
      entityStoresVersion: M2_SECTION_VERSION,
      actorHandles: createActorHandles(),
      itemStacks: createItemStackRecords(summary),
      buildOrders: createBuildOrderRecords(summary),
    },
    jobsReservations: {
      jobsReservationsVersion: M2_SECTION_VERSION,
      activeReservationCount: summary.endState.activeReservations,
      runningJobCount: summary.endState.runningJobs,
      records: createJobRecords(summary),
    },
    randomStreams: {
      randomStreamsVersion: M2_SECTION_VERSION,
      seed,
      streamCount: 0,
    },
    commandLogTail: {
      commandLogTailVersion: M2_SECTION_VERSION,
      checkpointTick: createdTick,
      checkpointWorldHash: summary.worldHash,
      nextCommandSequence: 1,
    },
  };
}

function createCheckpoints(
  seed: string,
  checkpointTicks: readonly Tick[],
): readonly M2ReplayCheckpoint[] {
  const checkpoints: M2ReplayCheckpoint[] = [];

  for (let index = 0; index < checkpointTicks.length; index += 1) {
    const tick = checkpointTicks[index] ?? 0;
    const summary = runM2WorkLogisticsScenario({ seed, ticks: tick });
    const projection = createM2ReadOnlyProjection(summary, index);
    checkpoints.push({
      tick,
      worldHash: summary.worldHash,
      readModelHash: projection.readModelHash,
      orderRecordHash: projection.orderReadModel.detailHash,
      rebuiltIndexHash: projection.rebuiltIndexes.indexHash,
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
): { readonly ok: true } | { readonly ok: false; readonly reason: M2SaveReplayReason } {
  if (seed.length === 0) {
    return { ok: false, reason: "m2_seed_invalid" };
  }

  if (checkpointTicks.length === 0) {
    return { ok: false, reason: "m2_checkpoint_order_invalid" };
  }

  let previous = -1;
  for (const tick of checkpointTicks) {
    if (!isSafeTick(tick)) {
      return { ok: false, reason: "m2_tick_invalid" };
    }

    if (tick <= previous) {
      return { ok: false, reason: "m2_checkpoint_order_invalid" };
    }

    previous = tick;
  }

  return { ok: true };
}

function validateSaveEnvelope(
  input: unknown,
):
  | { readonly ok: true; readonly save: M2WorkLogisticsSaveEnvelope }
  | { readonly ok: false; readonly reason: M2SaveReplayReason } {
  if (!isRecord(input)) {
    return { ok: false, reason: "m2_save_shape_invalid" };
  }

  if (input["magic"] !== M2_SAVE_MAGIC) {
    return { ok: false, reason: "m2_save_magic_invalid" };
  }

  if (
    input["formatVersion"] !== M2_SAVE_FORMAT_VERSION ||
    input["sectionDirectoryVersion"] !== M2_SECTION_DIRECTORY_VERSION
  ) {
    return { ok: false, reason: "m2_save_version_unsupported" };
  }

  if (input["scenarioId"] !== M2_WORK_LOGISTICS_SCENARIO_ID) {
    return { ok: false, reason: "m2_save_scenario_invalid" };
  }

  const seed = input["seed"];
  const createdTick = input["createdTick"];
  if (typeof seed !== "string" || seed.length === 0 || !isTickValue(createdTick)) {
    return { ok: false, reason: "m2_save_shape_invalid" };
  }

  const sections = validateSectionsRecord(input["sections"]);
  if (!sections.ok) {
    return sections;
  }

  const projection = input["readOnlyProjection"];
  if (!isProjectionRecord(projection)) {
    return { ok: false, reason: "m2_save_projection_invalid" };
  }

  if (projection.tick !== createdTick) {
    return { ok: false, reason: "m2_save_projection_invalid" };
  }

  return {
    ok: true,
    save: {
      magic: M2_SAVE_MAGIC,
      formatVersion: M2_SAVE_FORMAT_VERSION,
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      seed,
      createdTick,
      sectionDirectoryVersion: M2_SECTION_DIRECTORY_VERSION,
      sections: sections.value,
      readOnlyProjection: projection,
    },
  };
}

function validateSectionsRecord(
  value: unknown,
):
  | { readonly ok: true; readonly value: M2WorkLogisticsSaveSections }
  | { readonly ok: false; readonly reason: M2SaveReplayReason } {
  if (!isRecord(value)) {
    return { ok: false, reason: "m2_save_section_invalid" };
  }

  const mapChunks = value["mapChunks"];
  const entityStores = value["entityStores"];
  const jobsReservations = value["jobsReservations"];
  const randomStreams = value["randomStreams"];
  const commandLogTail = value["commandLogTail"];

  if (
    !isMapChunksSection(mapChunks) ||
    !isRecord(entityStores) ||
    entityStores["entityStoresVersion"] !== M2_SECTION_VERSION ||
    !isRecord(jobsReservations) ||
    jobsReservations["jobsReservationsVersion"] !== M2_SECTION_VERSION ||
    !isRecord(randomStreams) ||
    randomStreams["randomStreamsVersion"] !== M2_SECTION_VERSION ||
    randomStreams["streamCount"] !== 0 ||
    typeof randomStreams["seed"] !== "string" ||
    !isRecord(commandLogTail) ||
    commandLogTail["commandLogTailVersion"] !== M2_SECTION_VERSION ||
    !isTickValue(commandLogTail["checkpointTick"]) ||
    typeof commandLogTail["checkpointWorldHash"] !== "string" ||
    !isNonNegativeInteger(commandLogTail["nextCommandSequence"])
  ) {
    return { ok: false, reason: "m2_save_section_invalid" };
  }

  const actorHandles = entityStores["actorHandles"];
  const itemStacks = entityStores["itemStacks"];
  const buildOrders = entityStores["buildOrders"];
  const jobRecords = jobsReservations["records"];
  if (!isOwnerHandleArray(actorHandles)) {
    return { ok: false, reason: "m2_save_owner_handle_invalid" };
  }

  if (
    !isItemStackRecordArray(itemStacks) ||
    !isBuildOrderRecordArray(buildOrders) ||
    !isJobRecordArray(jobRecords)
  ) {
    return { ok: false, reason: "m2_save_integer_lane_invalid" };
  }

  if (
    !areOwnerHandlesSorted(actorHandles) ||
    !areItemStacksSorted(itemStacks) ||
    !areBuildOrdersSorted(buildOrders) ||
    !areJobRecordsSorted(jobRecords)
  ) {
    return { ok: false, reason: "m2_save_records_unsorted" };
  }

  if (
    !isNonNegativeInteger(jobsReservations["activeReservationCount"]) ||
    !isNonNegativeInteger(jobsReservations["runningJobCount"])
  ) {
    return { ok: false, reason: "m2_save_integer_lane_invalid" };
  }

  return {
    ok: true,
    value: {
      mapChunks,
      entityStores: {
        entityStoresVersion: M2_SECTION_VERSION,
        actorHandles,
        itemStacks,
        buildOrders,
      },
      jobsReservations: {
        jobsReservationsVersion: M2_SECTION_VERSION,
        activeReservationCount: jobsReservations["activeReservationCount"],
        runningJobCount: jobsReservations["runningJobCount"],
        records: jobRecords,
      },
      randomStreams: {
        randomStreamsVersion: M2_SECTION_VERSION,
        seed: randomStreams["seed"],
        streamCount: 0,
      },
      commandLogTail: {
        commandLogTailVersion: M2_SECTION_VERSION,
        checkpointTick: commandLogTail["checkpointTick"],
        checkpointWorldHash: commandLogTail["checkpointWorldHash"],
        nextCommandSequence: commandLogTail["nextCommandSequence"],
      },
    },
  };
}

function isMapChunksSection(value: unknown): value is M2MapChunksSection {
  return (
    isRecord(value) &&
    value["mapChunksVersion"] === M2_SECTION_VERSION &&
    value["width"] === MAP_WIDTH &&
    value["height"] === MAP_HEIGHT &&
    value["chunkSize"] === MAP_CHUNK_SIZE &&
    value["siteCount"] === SITE_COUNT
  );
}

function isProjectionRecord(value: unknown): value is M2ReadOnlyProjection {
  if (!isRecord(value)) {
    return false;
  }

  const renderSnapshot = value["renderSnapshot"];
  const orderReadModel = value["orderReadModel"];
  const rebuiltIndexes = value["rebuiltIndexes"];
  return (
    value["projectionVersion"] === 1 &&
    value["scenarioId"] === M2_WORK_LOGISTICS_SCENARIO_ID &&
    isTickValue(value["tick"]) &&
    typeof value["worldHash"] === "string" &&
    typeof value["readModelHash"] === "string" &&
    isRecord(renderSnapshot) &&
    renderSnapshot["renderSnapshotSchemaVersion"] === 1 &&
    isNonNegativeInteger(renderSnapshot["snapshotSequence"]) &&
    isTickValue(renderSnapshot["tick"]) &&
    renderSnapshot["actorCount"] === ACTOR_COUNT &&
    isNonNegativeInteger(renderSnapshot["completedBuildOrders"]) &&
    typeof renderSnapshot["worldHash"] === "string" &&
    typeof renderSnapshot["readModelHash"] === "string" &&
    isRecord(orderReadModel) &&
    orderReadModel["orderReadModelSchemaVersion"] === 1 &&
    orderReadModel["scenarioId"] === M2_WORK_LOGISTICS_SCENARIO_ID &&
    isTickValue(orderReadModel["basisTick"]) &&
    orderReadModel["orderCount"] === SITE_COUNT &&
    typeof orderReadModel["detailHash"] === "string" &&
    Array.isArray(orderReadModel["summaries"]) &&
    everyString(orderReadModel["summaries"]) &&
    isRecord(rebuiltIndexes) &&
    rebuiltIndexes["rebuiltIndexesSchemaVersion"] === 1 &&
    Array.isArray(rebuiltIndexes["names"]) &&
    everyString(rebuiltIndexes["names"]) &&
    isTickValue(rebuiltIndexes["basisTick"]) &&
    typeof rebuiltIndexes["basisWorldHash"] === "string" &&
    typeof rebuiltIndexes["indexHash"] === "string"
  );
}

function sectionsMatchScenario(
  sections: M2WorkLogisticsSaveSections,
  seed: string,
  tick: Tick,
): boolean {
  const summary = runM2WorkLogisticsScenario({ seed, ticks: tick });
  return (
    ownerHandleArraysEqual(sections.entityStores.actorHandles, createActorHandles()) &&
    itemStackRecordsEqual(sections.entityStores.itemStacks, createItemStackRecords(summary)) &&
    buildOrderRecordsEqual(sections.entityStores.buildOrders, createBuildOrderRecords(summary)) &&
    jobRecordsEqual(sections.jobsReservations.records, createJobRecords(summary)) &&
    sections.jobsReservations.activeReservationCount === summary.endState.activeReservations &&
    sections.jobsReservations.runningJobCount === summary.endState.runningJobs &&
    sections.randomStreams.seed === seed &&
    sections.commandLogTail.checkpointTick === tick &&
    sections.commandLogTail.checkpointWorldHash === summary.worldHash &&
    sections.commandLogTail.nextCommandSequence === 1
  );
}

function projectionMatchesExpected(
  actual: M2ReadOnlyProjection,
  expected: M2ReadOnlyProjection,
): boolean {
  return (
    actual.tick === expected.tick &&
    actual.worldHash === expected.worldHash &&
    actual.readModelHash === expected.readModelHash &&
    actual.renderSnapshot.snapshotSequence === expected.renderSnapshot.snapshotSequence &&
    actual.renderSnapshot.tick === expected.renderSnapshot.tick &&
    actual.renderSnapshot.completedBuildOrders === expected.renderSnapshot.completedBuildOrders &&
    actual.renderSnapshot.worldHash === expected.renderSnapshot.worldHash &&
    actual.renderSnapshot.readModelHash === expected.renderSnapshot.readModelHash &&
    actual.orderReadModel.basisTick === expected.orderReadModel.basisTick &&
    actual.orderReadModel.detailHash === expected.orderReadModel.detailHash &&
    stringArraysEqual(actual.orderReadModel.summaries, expected.orderReadModel.summaries) &&
    actual.rebuiltIndexes.basisTick === expected.rebuiltIndexes.basisTick &&
    actual.rebuiltIndexes.basisWorldHash === expected.rebuiltIndexes.basisWorldHash &&
    actual.rebuiltIndexes.indexHash === expected.rebuiltIndexes.indexHash &&
    stringArraysEqual(actual.rebuiltIndexes.names, expected.rebuiltIndexes.names)
  );
}

function createActorHandles(): readonly M2OwnerHandle[] {
  const handles: M2OwnerHandle[] = [];
  for (let index = 0; index < ACTOR_COUNT; index += 1) {
    handles.push({ index, generation: 1 });
  }
  return handles;
}

function createItemStackRecords(
  summary: M2WorkLogisticsScenarioSummary,
): readonly M2ItemStackRecord[] {
  return [
    {
      stackId: STACK_WOOD,
      owner: { index: ACTOR_COUNT, generation: 1 },
      defId: WOOD_DEF,
      quantity: summary.endState.sourceWoodQuantity,
    },
    {
      stackId: STACK_STONE,
      owner: { index: ACTOR_COUNT + 1, generation: 1 },
      defId: STONE_DEF,
      quantity: summary.endState.sourceStoneQuantity,
    },
    {
      stackId: STACK_PAPER,
      owner: { index: ACTOR_COUNT + 2, generation: 1 },
      defId: PAPER_DEF,
      quantity: summary.endState.decoyPaperQuantity,
    },
  ];
}

function createBuildOrderRecords(
  summary: M2WorkLogisticsScenarioSummary,
): readonly M2BuildOrderRecord[] {
  const records: M2BuildOrderRecord[] = [];
  const completed = summary.endState.completedBuildOrders === SITE_COUNT;
  const progress = Math.floor(summary.endState.buildProgressTotal / SITE_COUNT);

  for (let orderId = 0; orderId < SITE_COUNT; orderId += 1) {
    records.push({
      orderId,
      site: { index: ACTOR_COUNT + 3 + orderId, generation: 1 },
      completed,
      deliveredWood: WOOD_PER_ORDER,
      deliveredStone: STONE_PER_ORDER,
      buildProgressTicks: progress,
    });
  }

  return records;
}

function createJobRecords(
  summary: M2WorkLogisticsScenarioSummary,
): readonly M2JobReservationRecord[] {
  const records: M2JobReservationRecord[] = [];
  const deliveryCount = summary.counters.materialDeliveryJobsCompleted;

  for (let jobId = 0; jobId < deliveryCount; jobId += 1) {
    const woodLane = jobId % 2 === 0;
    records.push({
      jobId,
      owner: { index: jobId % ACTOR_COUNT, generation: 1 },
      kind: "delivery",
      status: "completed",
      carriedDefId: woodLane ? WOOD_DEF : STONE_DEF,
      carriedAmount: woodLane ? WOOD_PER_ORDER : STONE_PER_ORDER,
      stepTickCount: 10,
    });
  }

  for (let buildIndex = 0; buildIndex < summary.counters.buildJobsCompleted; buildIndex += 1) {
    const jobId = deliveryCount + buildIndex;
    records.push({
      jobId,
      owner: { index: jobId % ACTOR_COUNT, generation: 1 },
      kind: "build",
      status: "completed",
      carriedDefId: 0,
      carriedAmount: 0,
      stepTickCount: BUILD_TICKS_PER_ORDER,
    });
  }

  return records;
}

function createRenderSnapshotHash(
  summary: M2WorkLogisticsScenarioSummary,
  snapshotSequence: number,
): string {
  return formatCanonicalWorldHash({
    fields: [
      { name: "actorCount", value: ACTOR_COUNT },
      { name: "completedBuildOrders", value: summary.endState.completedBuildOrders },
      { name: "scenarioId", value: summary.scenarioId },
      { name: "snapshotSequence", value: snapshotSequence },
      { name: "tick", value: summary.finalTick },
      { name: "worldHash", value: summary.worldHash },
    ],
    randomStreams: [],
    queuedCommands: [],
  });
}

function createOrderReadModelHash(summary: M2WorkLogisticsScenarioSummary): string {
  const fields: CanonicalWorldField[] = [
    { name: "buildProgressTotal", value: summary.endState.buildProgressTotal },
    { name: "completedBuildOrders", value: summary.endState.completedBuildOrders },
    { name: "deliveredStone", value: summary.endState.deliveredStone },
    { name: "deliveredWood", value: summary.endState.deliveredWood },
    { name: "scenarioId", value: summary.scenarioId },
    { name: "tick", value: summary.finalTick },
  ];

  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function createRebuiltIndexHash(summary: M2WorkLogisticsScenarioSummary): string {
  const fields: CanonicalWorldField[] = [
    { name: "activeOffers", value: summary.endState.activeOffers },
    { name: "activeReservations", value: summary.endState.activeReservations },
    { name: "runningJobs", value: summary.endState.runningJobs },
    { name: "scenarioId", value: summary.scenarioId },
    { name: "tick", value: summary.finalTick },
    { name: "worldHash", value: summary.worldHash },
  ];

  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function createComparisonFailure(
  seed: string,
  firstDivergentTick: Tick | null,
  artifactPaths: M2ReplayArtifactPaths,
  reason: "checkpoint_count_mismatch" | "world_hash_mismatch" | "read_model_hash_mismatch",
): M2ReplayComparison {
  return {
    ok: false,
    scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
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

function isOwnerHandle(value: unknown): value is M2OwnerHandle {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value["index"]) &&
    isNonNegativeInteger(value["generation"]) &&
    value["generation"] > 0
  );
}

function isOwnerHandleArray(value: unknown): value is readonly M2OwnerHandle[] {
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

function isItemStackRecordArray(value: unknown): value is readonly M2ItemStackRecord[] {
  if (!Array.isArray(value) || value.length !== 3) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["stackId"]) ||
      !isOwnerHandle(record["owner"]) ||
      !isNonNegativeInteger(record["defId"]) ||
      !isNonNegativeInteger(record["quantity"])
    ) {
      return false;
    }
  }

  return true;
}

function isBuildOrderRecordArray(value: unknown): value is readonly M2BuildOrderRecord[] {
  if (!Array.isArray(value) || value.length !== SITE_COUNT) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["orderId"]) ||
      !isOwnerHandle(record["site"]) ||
      typeof record["completed"] !== "boolean" ||
      !isNonNegativeInteger(record["deliveredWood"]) ||
      !isNonNegativeInteger(record["deliveredStone"]) ||
      !isNonNegativeInteger(record["buildProgressTicks"])
    ) {
      return false;
    }
  }

  return true;
}

function isJobRecordArray(value: unknown): value is readonly M2JobReservationRecord[] {
  if (!Array.isArray(value)) {
    return false;
  }

  for (const record of value) {
    if (
      !isRecord(record) ||
      !isNonNegativeInteger(record["jobId"]) ||
      !isOwnerHandle(record["owner"]) ||
      (record["kind"] !== "delivery" && record["kind"] !== "build") ||
      record["status"] !== "completed" ||
      !isNonNegativeInteger(record["carriedDefId"]) ||
      !isNonNegativeInteger(record["carriedAmount"]) ||
      !isNonNegativeInteger(record["stepTickCount"])
    ) {
      return false;
    }
  }

  return true;
}

function areOwnerHandlesSorted(records: readonly M2OwnerHandle[]): boolean {
  let previous = -1;
  for (const record of records) {
    if (record.index <= previous) {
      return false;
    }
    previous = record.index;
  }
  return true;
}

function areItemStacksSorted(records: readonly M2ItemStackRecord[]): boolean {
  let previous = -1;
  for (const record of records) {
    if (record.stackId <= previous) {
      return false;
    }
    previous = record.stackId;
  }
  return true;
}

function areBuildOrdersSorted(records: readonly M2BuildOrderRecord[]): boolean {
  let previous = -1;
  for (const record of records) {
    if (record.orderId <= previous) {
      return false;
    }
    previous = record.orderId;
  }
  return true;
}

function areJobRecordsSorted(records: readonly M2JobReservationRecord[]): boolean {
  let previous = -1;
  for (const record of records) {
    if (record.jobId <= previous) {
      return false;
    }
    previous = record.jobId;
  }
  return true;
}

function ownerHandleArraysEqual(
  left: readonly M2OwnerHandle[],
  right: readonly M2OwnerHandle[],
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

function itemStackRecordsEqual(
  left: readonly M2ItemStackRecord[],
  right: readonly M2ItemStackRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (leftRecord === undefined || rightRecord === undefined) {
      return false;
    }

    if (
      leftRecord.stackId !== rightRecord.stackId ||
      !ownerHandlesEqual(leftRecord.owner, rightRecord.owner) ||
      leftRecord.defId !== rightRecord.defId ||
      leftRecord.quantity !== rightRecord.quantity
    ) {
      return false;
    }
  }

  return true;
}

function buildOrderRecordsEqual(
  left: readonly M2BuildOrderRecord[],
  right: readonly M2BuildOrderRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (leftRecord === undefined || rightRecord === undefined) {
      return false;
    }

    if (
      leftRecord.orderId !== rightRecord.orderId ||
      !ownerHandlesEqual(leftRecord.site, rightRecord.site) ||
      leftRecord.completed !== rightRecord.completed ||
      leftRecord.deliveredWood !== rightRecord.deliveredWood ||
      leftRecord.deliveredStone !== rightRecord.deliveredStone ||
      leftRecord.buildProgressTicks !== rightRecord.buildProgressTicks
    ) {
      return false;
    }
  }

  return true;
}

function jobRecordsEqual(
  left: readonly M2JobReservationRecord[],
  right: readonly M2JobReservationRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (leftRecord === undefined || rightRecord === undefined) {
      return false;
    }

    if (
      leftRecord.jobId !== rightRecord.jobId ||
      !ownerHandlesEqual(leftRecord.owner, rightRecord.owner) ||
      leftRecord.kind !== rightRecord.kind ||
      leftRecord.carriedDefId !== rightRecord.carriedDefId ||
      leftRecord.carriedAmount !== rightRecord.carriedAmount ||
      leftRecord.stepTickCount !== rightRecord.stepTickCount
    ) {
      return false;
    }
  }

  return true;
}

function ownerHandlesEqual(
  left: M2OwnerHandle | undefined,
  right: M2OwnerHandle | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }

  return left.index === right.index && left.generation === right.generation;
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
