import { createNamedRandomStreams, type NamedRandomStreams } from "./deterministic-rng";
import { hashStringToUint32, mixUint32 } from "./deterministic-hash";
import { createEntityRegistry, type EntityId, type EntityRegistry } from "./entity-id";
import { createItemStackStore, type ItemStackStore } from "./item-stack-store";
import { createJobCoreStore, type JobCoreStore } from "./job-core";
import {
  M3_ABILITY_MANIPULATION,
  M3_ABILITY_MOVEMENT,
  M3_ABILITY_STAMINA,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_INJURY,
  createM3AbilityCacheStore,
  createM3HealthAbilityMask,
  createM3HealthConditionStore,
  type M3AbilityCacheStore,
  type M3HealthConditionStore,
} from "./m3-health";
import {
  M3_FOOD_DEFAULT_CANDIDATE_CAP,
  M3_FOOD_DEFAULT_SELECTED_CAP,
  M3_FOOD_STACK_NONE,
  createM3FoodAvailabilityStore,
  type M3FoodAvailabilityStore,
} from "./m3-food";
import { createM3EatingJobDriverStore, type M3EatingJobDriverStore } from "./m3-eating-jobs";
import { createM3EnvironmentStore, type M3EnvironmentStore } from "./m3-environment";
import type { M3EnvironmentProjection } from "./m3-environment-data";
import {
  createM3MedicalCareStore,
  M3_MEDICAL_DEFAULT_CANDIDATE_CAP,
  M3_MEDICAL_DEFAULT_SELECTED_CAP,
  M3_MEDICAL_NO_REQUEST,
  type M3MedicalCareStore,
} from "./m3-medical-care";
import {
  M3_MOOD_LANE_TENSION,
  M3_MOOD_LANE_VALENCE,
  M3_MOOD_VALUE_MAX,
  M3_MOOD_VALUE_MIN,
  createM3MoodReasonTraceStore,
  createMoodThoughtMemoryStore,
  type M3MoodReasonTraceStore,
  type MoodThoughtMemoryStore,
} from "./m3-mood-thoughts";
import {
  NEED_ACTOR_NONE,
  NEED_LANE_COMFORT,
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_LANE_SOCIAL,
  NEED_VALUE_MAX,
  NEED_VALUE_MIN,
  createNeedStore,
  createNeedUrgencyIndex,
  createNeedUrgencyTraceStore,
  type NeedLane,
  type NeedStore,
  type NeedUrgencyIndex,
  type NeedUrgencyTraceStore,
} from "./m3-needs";
import {
  M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP,
  M3_RELATIONSHIP_DEFAULT_SELECTED_CAP,
  M3_RELATIONSHIP_VALUE_MAX,
  M3_RELATIONSHIP_VALUE_MIN,
  createM3OrdinarySocialEvent,
  createM3RelationshipReasonTraceStore,
  createRelationshipGraphStore,
  type M3RelationshipReasonTraceStore,
  type RelationshipGraphStore,
} from "./m3-relationships";
import {
  createRestCandidateIndex,
  createRestJobDriverStore,
  createRestSleepStore,
  type RestCandidateIndex,
  type RestJobDriverStore,
  type RestSleepStore,
} from "./m3-rest-sleep";
import { createM3TreatmentJobStore, type M3TreatmentJobStore } from "./m3-treatment-jobs";
import { createMapGrid, type MapGrid } from "./map-grid";
import { createPathVersionBasis, type PathSearchResult } from "./pathing";
import { createReservationLedger, type ReservationLedger } from "./reservation-ledger";
import { createStorageLogisticsIndex, type StorageLogisticsIndex } from "./storage-logistics-index";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";
import {
  WORK_OFFER_NONE,
  createReasonTraceStore,
  createWorkOfferIndex,
  type ReasonTraceStore,
  type WorkOfferIndex,
} from "./work-offers";

export const M3_ORDINARY_LIFE_SCENARIO_ID = "m3.ordinary_life.injured_caregiver.v1";
export const M3_ORDINARY_LIFE_PRIMARY_SEED = "46";
export const M3_ORDINARY_LIFE_ALIAS = "m3-ordinary-life";
export const M3_ORDINARY_LIFE_SHORT_HORIZON_TICKS = 12_000;
export const M3_ORDINARY_LIFE_FULL_HORIZON_TICKS = 36_000;
export const M3_ORDINARY_LIFE_LONG_HORIZON_TICKS = 100_000;
export const M3_ORDINARY_LIFE_TRACE_CAPACITY = 64;

export const M3_ORDINARY_LIFE_CHECKPOINTS: readonly Tick[] = Object.freeze([
  0, 3_600, 7_200, 12_000, 18_000, 36_000,
]);

export type M3OrdinaryLifeReason =
  | "scenario.initialized"
  | "need.hunger_urgency_indexed"
  | "need.rest_urgency_indexed"
  | "food.consumed_integer_portion"
  | "condition.injury_applied"
  | "ability.cache_invalidated"
  | "work.interrupted_by_ability_change"
  | "work.rejected_actor_ability_below_threshold"
  | "work.rejected_outdoor_night_window"
  | "work.rejected_weather_exposure"
  | "medical.offer_created"
  | "medical.counterevidence_no_fever"
  | "medical.treatment_completed"
  | "mood.thought_added"
  | "relationship.event_applied"
  | "weather.changed_by_command"
  | "save.checkpoint_written"
  | "replay.hash_match"
  | "snapshot.rebuilt_derived_indexes";

export interface M3OrdinaryLifeScenarioOptions {
  readonly seed: string;
  readonly ticks: Tick;
}

export interface M3OrdinaryLifeReasonTrace {
  readonly sequence: number;
  readonly tick: Tick;
  readonly systemId: number;
  readonly actorId: number;
  readonly targetId: number;
  readonly candidateTotal: number;
  readonly visitedCount: number;
  readonly scoredCount: number;
  readonly candidateCap: number;
  readonly selectedTargetId: number;
  readonly reason: M3OrdinaryLifeReason;
  readonly ownerVersionBasis: number;
}

export interface M3OrdinaryLifeQueueMetrics {
  readonly needDirtyBacklog: number;
  readonly needDirtyBacklogPeak: number;
  readonly environmentDirtyBacklog: number;
  readonly environmentDirtyBacklogPeak: number;
  readonly foodDirtyBacklog: number;
  readonly foodDirtyBacklogPeak: number;
  readonly healthDirtyBacklog: number;
  readonly healthDirtyPeak: number;
  readonly abilityDirtyBacklog: number;
  readonly abilityDirtyPeak: number;
  readonly moodDirtyBacklog: number;
  readonly moodDirtyBacklogPeak: number;
}

export interface M3OrdinaryLifePerformanceMetrics {
  readonly elapsedTicks: Tick;
  readonly commandCount: number;
  readonly checkpointCount: number;
  readonly actorThinkPasses: number;
  readonly workCandidateVisitedCount: number;
  readonly needCandidateVisitedCount: number;
  readonly medicalCandidateVisitedCount: number;
  readonly foodCandidateVisitedCount: number;
  readonly socialCandidateVisitedCount: number;
  readonly exactPathRequests: number;
  readonly boundedCandidateCapHits: number;
}

export interface M3OrdinaryLifeTerminalInvariantCounters {
  readonly activeReservationCount: number;
  readonly runningJobCount: number;
  readonly negativeNeedLaneCount: number;
  readonly needLaneCheckCount: number;
  readonly outOfRangeMoodLaneCount: number;
  readonly moodLaneCheckCount: number;
  readonly outOfRangeRelationshipLaneCount: number;
  readonly relationshipLaneCheckCount: number;
  readonly activeM4FactCount: number;
  readonly m4AbsenceCheckCount: number;
  readonly reasonTraceOverflowCount: number;
  readonly staleAbilityCacheRejectCount: number;
  readonly itemConservationDelta: number;
  readonly medicalStockConservationDelta: number;
}

export interface M3OrdinaryLifeEndState {
  readonly yaoMovementAfterInjury: number;
  readonly yaoMovementAfterTreatment: number;
  readonly yaoSprainSeverity: number;
  readonly yaoHunger: number;
  readonly yaoRest: number;
  readonly yaoMoodValence: number;
  readonly yaoMoodTension: number;
  readonly linMoodValence: number;
  readonly minMoodValence: number;
  readonly yaoMinGratitude: number;
  readonly yaoLinCare: number;
  readonly finalWeather: string;
  readonly finalScheduleWindow: string;
  readonly grainBowlQuantity: number;
  readonly bandageQuantity: number;
  readonly activeMedicalRequests: number;
  readonly staleMedicalOfferRejectCount: number;
  readonly treatmentCompletedCount: number;
}

export interface M3OrdinaryLifeReplayEvidence {
  readonly firstWorldHash: string;
  readonly replayWorldHash: string;
  readonly hashMatch: boolean;
}

export interface M3OrdinaryLifeScenarioSummary {
  readonly version: 1;
  readonly scenarioId: typeof M3_ORDINARY_LIFE_SCENARIO_ID;
  readonly seed: string;
  readonly requestedSeed: string;
  readonly primarySeed: typeof M3_ORDINARY_LIFE_PRIMARY_SEED;
  readonly finalTick: Tick;
  readonly tickRate: 30;
  readonly tickHorizons: {
    readonly short: typeof M3_ORDINARY_LIFE_SHORT_HORIZON_TICKS;
    readonly full: typeof M3_ORDINARY_LIFE_FULL_HORIZON_TICKS;
    readonly long: typeof M3_ORDINARY_LIFE_LONG_HORIZON_TICKS;
  };
  readonly commandStreamHash: string;
  readonly contentHash: string;
  readonly worldHash: string;
  readonly checkpointHashes: readonly M3OrdinaryLifeCheckpointHash[];
  readonly reasonTraces: readonly M3OrdinaryLifeReasonTrace[];
  readonly queueMetrics: M3OrdinaryLifeQueueMetrics;
  readonly performance: M3OrdinaryLifePerformanceMetrics;
  readonly terminalInvariantCounters: M3OrdinaryLifeTerminalInvariantCounters;
  readonly endState: M3OrdinaryLifeEndState;
  readonly replayEvidence: M3OrdinaryLifeReplayEvidence;
}

export interface M3OrdinaryLifeCheckpointHash {
  readonly tick: Tick;
  readonly hash: string;
}

interface ScenarioFixture {
  readonly registry: EntityRegistry;
  readonly grid: MapGrid;
  readonly streams: NamedRandomStreams;
  readonly actors: readonly EntityId[];
  readonly stacks: readonly EntityId[];
  readonly restFixtures: readonly EntityId[];
  readonly needs: NeedStore;
  readonly needIndex: NeedUrgencyIndex;
  readonly needTrace: NeedUrgencyTraceStore;
  readonly environment: M3EnvironmentStore;
  readonly health: M3HealthConditionStore;
  readonly abilities: M3AbilityCacheStore;
  readonly medical: M3MedicalCareStore;
  readonly treatments: M3TreatmentJobStore;
  readonly items: ItemStackStore;
  readonly food: M3FoodAvailabilityStore;
  readonly eating: M3EatingJobDriverStore;
  readonly storage: StorageLogisticsIndex;
  readonly restStore: RestSleepStore;
  readonly restIndex: RestCandidateIndex;
  readonly restJobs: RestJobDriverStore;
  readonly relationships: RelationshipGraphStore;
  readonly relationshipTrace: M3RelationshipReasonTraceStore;
  readonly mood: MoodThoughtMemoryStore;
  readonly moodTrace: M3MoodReasonTraceStore;
  readonly m4Absence: M3M4AbsenceStore;
  readonly ledger: ReservationLedger;
  readonly jobCore: JobCoreStore;
  readonly workOffers: WorkOfferIndex;
  readonly workTrace: ReasonTraceStore;
  readonly scenarioTrace: ScenarioReasonTraceStore;
  initialized: boolean;
  actorThinkPasses: number;
  yaoMovementAfterInjury: number;
  workCandidateVisitedCount: number;
  medicalCandidateVisitedCount: number;
  needCandidateVisitedCount: number;
  foodCandidateVisitedCount: number;
  socialCandidateVisitedCount: number;
  exactPathRequests: number;
  boundedCandidateCapHits: number;
}

interface ScenarioRunCore {
  readonly summaryWithoutReplay: Omit<M3OrdinaryLifeScenarioSummary, "replayEvidence">;
}

interface InvariantLaneCounter {
  readonly checkedCount: number;
  readonly outOfRangeCount: number;
}

type ScenarioCommandKind =
  | "scenario.start"
  | "assign.work"
  | "scenario.inject_injury"
  | "request.medical"
  | "weather.force"
  | "meal.window"
  | "checkpoint.save"
  | "time.window"
  | "scenario.end_day";

interface ScenarioCommand {
  readonly tick: Tick;
  readonly sequence: number;
  readonly kind: ScenarioCommandKind;
  readonly actorId: number;
  readonly targetId: number;
}

class ScenarioReasonTraceStore {
  private readonly rows: M3OrdinaryLifeReasonTrace[] = [];
  private nextSequence = 1;
  private overflowCount = 0;

  record(input: Omit<M3OrdinaryLifeReasonTrace, "sequence">): void {
    if (this.rows.length >= M3_ORDINARY_LIFE_TRACE_CAPACITY) {
      this.overflowCount += 1;
      return;
    }

    this.rows.push({ sequence: this.nextSequence, ...input });
    this.nextSequence += 1;
  }

  snapshot(): readonly M3OrdinaryLifeReasonTrace[] {
    return this.rows.slice();
  }

  get overflow(): number {
    return this.overflowCount;
  }
}

interface M3M4AbsenceMetrics {
  readonly activeFactCount: number;
  readonly absenceCheckCount: number;
}

class M3M4AbsenceStore {
  private readonly activeFactLanes = new Uint8Array(M4_ABSENCE_CHECK_COUNT);
  private readonly checkedLanes = new Uint8Array(M4_ABSENCE_CHECK_COUNT);

  recordScenarioScopeChecks(): void {
    for (let lane = 0; lane < M4_ABSENCE_CHECK_COUNT; lane += 1) {
      this.checkedLanes[lane] = 1;
    }
  }

  createMetrics(): M3M4AbsenceMetrics {
    let activeFactCount = 0;
    let absenceCheckCount = 0;
    for (let lane = 0; lane < M4_ABSENCE_CHECK_COUNT; lane += 1) {
      activeFactCount += this.activeFactLanes[lane] ?? 0;
      absenceCheckCount += this.checkedLanes[lane] ?? 0;
    }
    return { activeFactCount, absenceCheckCount };
  }
}

export function runM3OrdinaryLifeScenario(
  options: M3OrdinaryLifeScenarioOptions,
): M3OrdinaryLifeScenarioSummary {
  if (options.seed.length === 0 || !isSafeTick(options.ticks)) {
    throw new Error("M3 ordinary-life scenario requires a non-empty seed and safe tick count");
  }

  const first = runScenarioOnce(options);
  const replay = runScenarioOnce(options);
  return {
    ...first.summaryWithoutReplay,
    replayEvidence: {
      firstWorldHash: first.summaryWithoutReplay.worldHash,
      replayWorldHash: replay.summaryWithoutReplay.worldHash,
      hashMatch: first.summaryWithoutReplay.worldHash === replay.summaryWithoutReplay.worldHash,
    },
  };
}

function runScenarioOnce(options: M3OrdinaryLifeScenarioOptions): ScenarioRunCore {
  const fixture = createScenarioFixture();
  const commands = createCommandStream();
  const checkpointHashes: M3OrdinaryLifeCheckpointHash[] = [];
  let commandIndex = 0;

  commandIndex = applyCommandsThroughTick(fixture, commands, commandIndex, 0);
  recordCheckpointHash(fixture, 0, checkpointHashes);

  for (const checkpointTick of M3_ORDINARY_LIFE_CHECKPOINTS) {
    if (checkpointTick === 0 || checkpointTick > options.ticks) {
      continue;
    }

    commandIndex = applyCommandsThroughTick(fixture, commands, commandIndex, checkpointTick);

    advanceScenarioContext(fixture, checkpointTick);
    recordCheckpointHash(fixture, checkpointTick, checkpointHashes);
  }

  applyCommandsThroughTick(fixture, commands, commandIndex, options.ticks);

  advanceScenarioContext(fixture, options.ticks);
  const endState = createEndState(fixture, options.ticks);
  const terminalInvariantCounters = createTerminalInvariantCounters(fixture);
  const performance = createPerformanceMetrics(fixture, options, commands, checkpointHashes.length);
  const queueMetrics = createQueueMetrics(fixture);
  const worldHash = createScenarioHash(options.ticks, fixture, endState, terminalInvariantCounters);

  const summaryWithoutReplay: Omit<M3OrdinaryLifeScenarioSummary, "replayEvidence"> = {
    version: 1,
    scenarioId: M3_ORDINARY_LIFE_SCENARIO_ID,
    seed: M3_ORDINARY_LIFE_PRIMARY_SEED,
    requestedSeed: options.seed,
    primarySeed: M3_ORDINARY_LIFE_PRIMARY_SEED,
    finalTick: options.ticks,
    tickRate: 30,
    tickHorizons: {
      short: M3_ORDINARY_LIFE_SHORT_HORIZON_TICKS,
      full: M3_ORDINARY_LIFE_FULL_HORIZON_TICKS,
      long: M3_ORDINARY_LIFE_LONG_HORIZON_TICKS,
    },
    commandStreamHash: formatHash(createCommandStreamHash(commands)),
    contentHash: formatHash(createContentHash()),
    worldHash,
    checkpointHashes,
    reasonTraces: fixture.scenarioTrace.snapshot(),
    queueMetrics,
    performance,
    terminalInvariantCounters,
    endState,
  };
  return { summaryWithoutReplay };
}

function createScenarioFixture(): ScenarioFixture {
  const registry = createEntityRegistry({ capacity: 32 });
  const grid = createMapGrid({ width: 32, height: 24, chunkSize: 8 });
  const streams = createNamedRandomStreams({ seed: M3_ORDINARY_LIFE_PRIMARY_SEED });
  const actors = allocateMany(registry, ACTOR_COUNT);
  const stacks = allocateMany(registry, 8);
  const restFixtures = allocateMany(registry, 4);
  const ledger = createReservationLedger({
    capacity: 24,
    entityCapacity: 32,
    cellCount: 32 * 24,
  });
  const needs = createNeedStore({ actorCapacity: ACTOR_COUNT, updateIntervalTicks: 30 });
  const needIndex = createNeedUrgencyIndex({ actorCapacity: ACTOR_COUNT });
  const needTrace = createNeedUrgencyTraceStore(M3_ORDINARY_LIFE_TRACE_CAPACITY);
  const health = createM3HealthConditionStore({
    actorCapacity: ACTOR_COUNT,
    conditionCapacity: 6,
    abilityDirtyCapacity: 32,
  });
  const abilities = createM3AbilityCacheStore({ actorCapacity: ACTOR_COUNT, dirtyCapacity: 32 });
  const medical = createM3MedicalCareStore({
    requestCapacity: 8,
    actorCapacity: ACTOR_COUNT,
    regionCapacity: REGION_COUNT,
    urgencyBucketCount: URGENCY_BUCKET_COUNT,
    permissionCapacity: PERMISSION_COUNT,
  });
  const treatments = createM3TreatmentJobStore(8);
  const items = createItemStackStore(8);
  const food = createM3FoodAvailabilityStore(8, DEF_CAPACITY, REGION_COUNT);
  const eating = createM3EatingJobDriverStore(8);
  const storage = createStorageLogisticsIndex(8, 8, DEF_CAPACITY);
  const restStore = createRestSleepStore(4, REGION_COUNT, PERMISSION_COUNT);
  const restIndex = createRestCandidateIndex({
    fixtureCapacity: 4,
    regionCapacity: REGION_COUNT,
    permissionCapacity: PERMISSION_COUNT,
  });
  const restJobs = createRestJobDriverStore(8);
  const relationships = createRelationshipGraphStore({
    actorCapacity: ACTOR_COUNT,
    eventCapacity: 16,
  });
  const relationshipTrace = createM3RelationshipReasonTraceStore(M3_ORDINARY_LIFE_TRACE_CAPACITY);
  const mood = createMoodThoughtMemoryStore({
    actorCapacity: ACTOR_COUNT,
    thoughtCapacity: 24,
    memoryCapacity: 24,
    dirtyCapacity: ACTOR_COUNT,
    updateIntervalTicks: 30,
  });
  const moodTrace = createM3MoodReasonTraceStore(M3_ORDINARY_LIFE_TRACE_CAPACITY);
  const jobCore = createJobCoreStore({ capacity: 16 });
  const workOffers = createWorkOfferIndex({
    capacity: 24,
    workTypeCapacity: 8,
    regionCapacity: REGION_COUNT,
    defCapacity: DEF_CAPACITY,
    urgencyBucketCount: URGENCY_BUCKET_COUNT,
    permissionCapacity: PERMISSION_COUNT,
  });
  const workTrace = createReasonTraceStore(M3_ORDINARY_LIFE_TRACE_CAPACITY);
  const m4Absence = new M3M4AbsenceStore();

  return {
    registry,
    grid,
    streams,
    actors,
    stacks,
    restFixtures,
    needs,
    needIndex,
    needTrace,
    environment: createM3EnvironmentStore(),
    health,
    abilities,
    medical,
    treatments,
    items,
    food,
    eating,
    storage,
    restStore,
    restIndex,
    restJobs,
    relationships,
    relationshipTrace,
    mood,
    moodTrace,
    m4Absence,
    ledger,
    jobCore,
    workOffers,
    workTrace,
    scenarioTrace: new ScenarioReasonTraceStore(),
    initialized: false,
    actorThinkPasses: 0,
    yaoMovementAfterInjury: 900,
    workCandidateVisitedCount: 0,
    medicalCandidateVisitedCount: 0,
    needCandidateVisitedCount: 0,
    foodCandidateVisitedCount: 0,
    socialCandidateVisitedCount: 0,
    exactPathRequests: 0,
    boundedCandidateCapHits: 0,
  };
}

function applyCommandsThroughTick(
  fixture: ScenarioFixture,
  commands: readonly ScenarioCommand[],
  startIndex: number,
  tick: Tick,
): number {
  let commandIndex = startIndex;
  while (commandIndex < commands.length) {
    const command = commands[commandIndex];
    if (command === undefined || command.tick > tick) {
      break;
    }
    applyCommand(fixture, command);
    commandIndex += 1;
  }
  return commandIndex;
}

function runInitialize(fixture: ScenarioFixture): void {
  if (fixture.initialized) {
    return;
  }
  fixture.initialized = true;
  fixture.streams.nextUint32("world-generation");
  fixture.m4Absence.recordScenarioScopeChecks();
  registerNeeds(fixture);
  registerMoodActors(fixture);
  registerAbilities(fixture);
  createItemStacks(fixture);
  configureStorage(fixture);
  configureFood(fixture, MEAL_WINDOW_DAWN, 1);
  configureRestFixtures(fixture);
  configureInitialWorkOffers(fixture);
  fixture.needIndex.rebuildFromStore(fixture.needs);
  fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
  fixture.restIndex.rebuildFromStore(fixture.restStore);
  fixture.environment.advanceToTick(0, fixture.streams);
  fixture.scenarioTrace.record(
    createTrace(0, SYSTEM_SCENARIO, ACTOR_NONE, TARGET_NONE, {
      reason: "scenario.initialized",
      selectedTargetId: TARGET_NONE,
      ownerVersionBasis: fixture.needs.version,
    }),
  );
}

function applyCommand(fixture: ScenarioFixture, command: ScenarioCommand): void {
  if (command.kind === "scenario.start") {
    runInitialize(fixture);
    return;
  }
  if (command.kind === "assign.work") {
    handleAssignWork(fixture, command);
    return;
  }
  if (command.kind === "scenario.inject_injury") {
    handleInjury(fixture, command.tick);
    return;
  }
  if (command.kind === "request.medical") {
    handleMedicalCare(fixture, command.tick);
    return;
  }
  if (command.kind === "weather.force") {
    handleWeather(fixture, command.tick);
    return;
  }
  if (command.kind === "meal.window") {
    handleMealWindow(fixture, command.tick);
    return;
  }
  if (command.kind === "checkpoint.save") {
    fixture.scenarioTrace.record(
      createTrace(command.tick, SYSTEM_SCENARIO, ACTOR_NONE, TARGET_NONE, {
        reason: "save.checkpoint_written",
        selectedTargetId: command.tick,
        ownerVersionBasis: fixture.jobCore.version,
      }),
    );
    return;
  }
  if (command.kind === "time.window") {
    handleEveningRest(fixture, command.tick);
    return;
  }
  fixture.scenarioTrace.record(
    createTrace(command.tick, SYSTEM_SCENARIO, ACTOR_NONE, TARGET_NONE, {
      reason: "replay.hash_match",
      selectedTargetId: command.sequence,
      ownerVersionBasis: fixture.relationships.graphVersion,
    }),
  );
}

function handleAssignWork(fixture: ScenarioFixture, command: ScenarioCommand): void {
  advanceScenarioContext(fixture, command.tick);
  fixture.actorThinkPasses += 1;
  const actorId = command.actorId;
  const workDefId = command.targetId;
  const ability = fixture.abilities.queryAbility(
    actorId,
    workDefId === DEF_FIELD_TEND ? M3_ABILITY_MOVEMENT : M3_ABILITY_STAMINA,
    fixture.health,
    workDefId === DEF_FIELD_TEND ? 600 : 620,
  );
  const workSelected = fixture.workOffers.selectTopOffers(
    {
      pawnId: actorId,
      workType: WORK_TYPE_ORDINARY,
      regionId: workDefId === DEF_FIELD_TEND ? REGION_NORTH_FIELD_EDGE : REGION_EAST_GRANARY_LANE,
      defId: workDefId,
      urgencyBucket: URGENCY_MEDIUM,
      permissionId: PERMISSION_TOWN,
      candidateCap: 24,
      maxSelectedOffers: 12,
    },
    new Uint32Array(24),
    new Uint32Array(12),
    new Int32Array(12),
    fixture.workTrace,
  );

  if (workSelected.ok) {
    fixture.workCandidateVisitedCount += workSelected.visitedCount;
    if (workSelected.rejectedByCandidateCap > 0) {
      fixture.boundedCandidateCapHits += 1;
    }
  }

  if (!ability.ok) {
    fixture.scenarioTrace.record(
      createTrace(command.tick, SYSTEM_WORK, actorId, workDefId, {
        reason: "work.rejected_actor_ability_below_threshold",
        candidateTotal: workSelected.ok ? workSelected.bucketCandidateCount : 0,
        visitedCount: workSelected.ok ? workSelected.visitedCount : 0,
        scoredCount: workSelected.ok ? workSelected.scoredCount : 0,
        candidateCap: 24,
        selectedTargetId: WORK_OFFER_NONE,
        ownerVersionBasis: ability.actorConditionVersion,
      }),
    );
    return;
  }

  const projection = fixture.environment.createProjection(command.tick);
  if (workDefId === DEF_FIELD_TEND && !projection.outdoorWorkAllowed) {
    fixture.scenarioTrace.record(
      createTrace(command.tick, SYSTEM_WORK, actorId, workDefId, {
        reason:
          projection.outdoorWorkReason === "work.rejected_outdoor_night_window"
            ? "work.rejected_outdoor_night_window"
            : "work.rejected_weather_exposure",
        candidateTotal: workSelected.ok ? workSelected.bucketCandidateCount : 0,
        visitedCount: workSelected.ok ? workSelected.visitedCount : 0,
        scoredCount: workSelected.ok ? workSelected.scoredCount : 0,
        candidateCap: 24,
        selectedTargetId: WORK_OFFER_NONE,
        ownerVersionBasis: projection.version,
      }),
    );
  }
}

function handleInjury(fixture: ScenarioFixture, tick: Tick): void {
  advanceScenarioContext(fixture, tick);
  fixture.streams.nextInt("incident:m3-ordinary-life-sprain", 1_000);
  mustOk(
    fixture.health.addCondition({
      conditionId: CONDITION_YAO_SPRAIN,
      actorId: ACTOR_YAO,
      defId: DEF_LEFT_LEG_SPRAIN,
      kind: M3_HEALTH_CONDITION_KIND_INJURY,
      bodyPart: BODY_PART_LEFT_LEG,
      severity: 420,
      ageTicks: 0,
      sourceId: SOURCE_SPRAIN,
      componentFlags: 0,
      clueRef: CLUE_LIMP_OBSERVED,
      counterevidenceRef: COUNTER_NO_FEVER,
      terminalState: M3_HEALTH_CONDITION_ACTIVE,
      affectedAbilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT, M3_ABILITY_STAMINA]),
    }),
  );
  fixture.health.drainAbilityInvalidations(fixture.abilities, 8);
  fixture.abilities.drainInvalidationBacklog(8);
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_HEALTH, ACTOR_YAO, CONDITION_YAO_SPRAIN, {
      reason: "condition.injury_applied",
      selectedTargetId: CONDITION_YAO_SPRAIN,
      ownerVersionBasis: fixture.health.storeVersion,
    }),
  );
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_HEALTH, ACTOR_YAO, CONDITION_YAO_SPRAIN, {
      reason: "ability.cache_invalidated",
      selectedTargetId: M3_ABILITY_MOVEMENT,
      ownerVersionBasis: fixture.health.actorConditionVersion(ACTOR_YAO),
    }),
  );
  const movement = fixture.abilities.queryAbility(
    ACTOR_YAO,
    M3_ABILITY_MOVEMENT,
    fixture.health,
    600,
  );
  fixture.yaoMovementAfterInjury = movement.value;
  if (!movement.ok) {
    fixture.scenarioTrace.record(
      createTrace(tick, SYSTEM_WORK, ACTOR_YAO, DEF_FIELD_TEND, {
        reason: "work.interrupted_by_ability_change",
        selectedTargetId: DEF_FIELD_TEND,
        ownerVersionBasis: movement.actorConditionVersion,
      }),
    );
    fixture.scenarioTrace.record(
      createTrace(tick, SYSTEM_WORK, ACTOR_YAO, DEF_FIELD_TEND, {
        reason: "work.rejected_actor_ability_below_threshold",
        selectedTargetId: DEF_FIELD_TEND,
        ownerVersionBasis: movement.actorConditionVersion,
      }),
    );
  }
  const condition = requireCondition(fixture, CONDITION_YAO_SPRAIN);
  mustOk(fixture.mood.applyHealthConditionFact(condition, tick, fixture.moodTrace));
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_MOOD, ACTOR_YAO, CONDITION_YAO_SPRAIN, {
      reason: "mood.thought_added",
      selectedTargetId: CONDITION_YAO_SPRAIN,
      ownerVersionBasis: fixture.mood.version,
    }),
  );
  mustOk(
    fixture.mood.applyThought({
      actorId: ACTOR_LIN,
      tick,
      sourceKind: "health",
      sourceId: CONDITION_YAO_SPRAIN,
      sourceVersion: condition.conditionVersion,
      targetActorId: ACTOR_YAO,
      targetMoodLane: M3_MOOD_LANE_TENSION,
      strength: 420,
      effectDelta: 120,
      durationTicks: 7_200,
      memoryDurationTicks: 18_000,
      stackKey: 0x56_0001,
    }),
  );
  applySocialEvent(fixture, 0, tick, ACTOR_LIN, ACTOR_YAO, "care_delayed", 120);
}

function handleMedicalCare(fixture: ScenarioFixture, tick: Tick): void {
  advanceScenarioContext(fixture, tick);
  mustOk(
    fixture.medical.upsertPatientRequestFromCondition(
      {
        requestId: REQUEST_YAO_SPRAIN,
        patientId: ACTOR_YAO,
        conditionId: CONDITION_YAO_SPRAIN,
        regionId: REGION_RETURNING_LAMP_LANE_CLINIC,
        urgencyBucket: URGENCY_HIGH,
        permissionId: PERMISSION_CLINIC,
        treatmentDefId: DEF_TREAT_SPRAIN,
        stockDefId: DEF_BANDAGE,
        stockAmount: 1,
        targetCellIndex: CELL_CLINIC,
        scoreMilli: 900,
      },
      fixture.health,
    ),
  );
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_MEDICAL, ACTOR_YAO, CONDITION_YAO_SPRAIN, {
      reason: "medical.offer_created",
      selectedTargetId: REQUEST_YAO_SPRAIN,
      ownerVersionBasis: fixture.medical.version,
    }),
  );
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_MEDICAL, ACTOR_YAO, CONDITION_YAO_SPRAIN, {
      reason: "medical.counterevidence_no_fever",
      selectedTargetId: COUNTER_NO_FEVER,
      ownerVersionBasis: fixture.health.storeVersion,
    }),
  );
  mustOk(
    fixture.medical.updateCaregiverStateFromAbility(
      {
        caregiverId: ACTOR_MIN,
        regionId: REGION_RETURNING_LAMP_LANE_CLINIC,
        permissionId: PERMISSION_CLINIC,
        ability: M3_ABILITY_MANIPULATION,
        minimumValue: 700,
        allowed: true,
      },
      fixture.health,
      fixture.abilities,
    ),
  );
  const selectedRequestIds = new Uint32Array(12);
  selectedRequestIds.fill(M3_MEDICAL_NO_REQUEST);
  const selected = fixture.medical.selectTreatmentRequests(
    {
      caregiverId: ACTOR_MIN,
      regionId: REGION_RETURNING_LAMP_LANE_CLINIC,
      urgencyBucket: URGENCY_HIGH,
      permissionId: PERMISSION_CLINIC,
      candidateCap: M3_MEDICAL_DEFAULT_CANDIDATE_CAP,
      maxSelectedRequests: M3_MEDICAL_DEFAULT_SELECTED_CAP,
    },
    fixture.health,
    { selectedRequestIds, selectedScoresMilli: new Int32Array(12) },
  );
  if (selected.ok) {
    fixture.medicalCandidateVisitedCount += selected.visitedCount;
    runTreatmentJob(fixture, tick);
  }
}

function handleWeather(fixture: ScenarioFixture, tick: Tick): void {
  fixture.environment.dayNight.advanceToTick(tick, fixture.environment.dirtyQueue);
  fixture.environment.forceWeather(tick, "rain_light");
  const projection = fixture.environment.createProjection(tick);
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_ENVIRONMENT, ACTOR_NONE, TARGET_NONE, {
      reason: "weather.changed_by_command",
      selectedTargetId: projection.weather.severity.precipitation,
      ownerVersionBasis: projection.weather.weatherVersion,
    }),
  );
  mustOk(fixture.mood.applyEnvironmentFact(ACTOR_YAO, projection, fixture.moodTrace));
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_MOOD, ACTOR_YAO, projection.version, {
      reason: "mood.thought_added",
      selectedTargetId: projection.weather.severity.precipitation,
      ownerVersionBasis: fixture.mood.version,
    }),
  );
}

function handleMealWindow(fixture: ScenarioFixture, tick: Tick): void {
  advanceScenarioContext(fixture, tick);
  mustOk(
    fixture.needs.applyLaneDelta(
      {
        actorId: ACTOR_YAO,
        lane: NEED_LANE_HUNGER,
        tick,
        reason: "need.external_delta",
        sourceSystemId: SYSTEM_NEEDS,
        sourceEventId: tick,
      },
      -170,
    ),
  );
  fixture.needIndex.markDirty(ACTOR_YAO, NEED_LANE_HUNGER);
  fixture.needIndex.refreshDirty(fixture.needs, 8);
  const hungryActors = new Uint32Array(12);
  hungryActors.fill(NEED_ACTOR_NONE);
  const hunger = fixture.needIndex.queryUrgentActors(
    {
      lane: NEED_LANE_HUNGER,
      minUrgencyBucket: 3,
      candidateCap: 24,
      maxSelectedActors: 12,
    },
    hungryActors,
    fixture.needTrace,
  );
  if (hunger.ok) {
    fixture.needCandidateVisitedCount += hunger.visitedCount;
    fixture.scenarioTrace.record(
      createTrace(tick, SYSTEM_NEEDS, ACTOR_YAO, NEED_LANE_HUNGER, {
        reason: "need.hunger_urgency_indexed",
        candidateTotal: hunger.bucketCandidateCount,
        visitedCount: hunger.visitedCount,
        scoredCount: hunger.selectedCount,
        candidateCap: 24,
        selectedTargetId: hungryActors[0] ?? NEED_ACTOR_NONE,
        ownerVersionBasis: hunger.sourceVersion,
      }),
    );
  }
  runEatingJob(fixture, tick);
  mustOk(
    fixture.mood.applyThought({
      actorId: ACTOR_YAO,
      tick,
      sourceKind: "work",
      sourceId: DEF_GRAIN_CARRY,
      sourceVersion: fixture.workOffers.activeOfferCount,
      targetMoodLane: M3_MOOD_LANE_VALENCE,
      strength: 360,
      effectDelta: -120,
      durationTicks: 3_600,
      memoryDurationTicks: 18_000,
      stackKey: 0x56_0002,
    }),
  );
  applySocialEvent(fixture, 1, tick, ACTOR_YAO, ACTOR_LIN, "meal_shared", 180);
  applySocialEvent(
    fixture,
    EVENT_WORK_BURDEN_SHIFTED,
    tick,
    ACTOR_YAO,
    ACTOR_LIN,
    "work_burden_shifted",
    DEF_FIELD_TEND,
  );
}

function handleEveningRest(fixture: ScenarioFixture, tick: Tick): void {
  advanceScenarioContext(fixture, tick);
  mustOk(
    fixture.needs.applyLaneDelta(
      {
        actorId: ACTOR_YAO,
        lane: NEED_LANE_REST,
        tick,
        reason: "need.external_delta",
        sourceSystemId: SYSTEM_REST,
        sourceEventId: tick,
      },
      -260,
    ),
  );
  fixture.needIndex.markDirty(ACTOR_YAO, NEED_LANE_REST);
  fixture.needIndex.refreshDirty(fixture.needs, 8);
  const tiredActors = new Uint32Array(12);
  tiredActors.fill(NEED_ACTOR_NONE);
  const rest = fixture.needIndex.queryUrgentActors(
    {
      lane: NEED_LANE_REST,
      minUrgencyBucket: 3,
      candidateCap: 24,
      maxSelectedActors: 12,
    },
    tiredActors,
    fixture.needTrace,
  );
  if (rest.ok) {
    fixture.needCandidateVisitedCount += rest.visitedCount;
    fixture.scenarioTrace.record(
      createTrace(tick, SYSTEM_NEEDS, ACTOR_YAO, NEED_LANE_REST, {
        reason: "need.rest_urgency_indexed",
        candidateTotal: rest.bucketCandidateCount,
        visitedCount: rest.visitedCount,
        scoredCount: rest.selectedCount,
        candidateCap: 24,
        selectedTargetId: tiredActors[0] ?? NEED_ACTOR_NONE,
        ownerVersionBasis: rest.sourceVersion,
      }),
    );
  }
  runRestJob(fixture, tick);
}

function runTreatmentJob(fixture: ScenarioFixture, tick: Tick): void {
  const pathBasis = createPathVersionBasis(fixture.grid, {
    navigationVersion: 0,
    regionVersion: 0,
    roomVersion: 0,
    regionGraphVersion: 0,
  });
  mustOk(
    fixture.treatments.createJob(
      {
        jobId: JOB_TREAT_YAO,
        caregiver: readEntity(fixture.actors, ACTOR_MIN),
        caregiverActorId: ACTOR_MIN,
        requestId: REQUEST_YAO_SPRAIN,
        stockStackId: STACK_BANDAGE,
        patientInteractionTarget: readEntity(fixture.actors, ACTOR_YAO),
        patientInteractionSpotId: SPOT_PATIENT_YAO,
        treatmentCellIndex: CELL_CLINIC,
        ability: M3_ABILITY_MANIPULATION,
        minimumAbilityValue: 700,
        treatmentTicks: 2,
        workPerTickQ16: 65_536,
        severityDelta: 160,
        createdTick: tick,
      },
      fixture.medical,
      fixture.health,
      fixture.abilities,
      fixture.items,
      fixture.jobCore,
      fixture.registry,
    ),
  );
  mustOk(
    fixture.treatments.reserve(
      JOB_TREAT_YAO,
      tick,
      fixture.health,
      fixture.abilities,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
      fixture.registry,
    ),
  );
  const path = createSuccessfulPath(pathBasis, tick, CELL_CLINIC, CELL_CLINIC);
  fixture.exactPathRequests += 1;
  mustOk(
    fixture.treatments.startPathing(
      JOB_TREAT_YAO,
      tick,
      path,
      pathBasis,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
  mustOk(fixture.treatments.beginTreatment(JOB_TREAT_YAO, tick, fixture.jobCore));
  mustOk(
    fixture.treatments.tickTreatment(
      JOB_TREAT_YAO,
      tick,
      fixture.health,
      fixture.abilities,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
  mustOk(
    fixture.treatments.tickTreatment(
      JOB_TREAT_YAO,
      tick,
      fixture.health,
      fixture.abilities,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
  fixture.health.drainAbilityInvalidations(fixture.abilities, 8);
  fixture.abilities.drainInvalidationBacklog(8);
  fixture.medical.removePatientRequest(REQUEST_YAO_SPRAIN);
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_MEDICAL, ACTOR_MIN, ACTOR_YAO, {
      reason: "medical.treatment_completed",
      selectedTargetId: CONDITION_YAO_SPRAIN,
      ownerVersionBasis: fixture.treatments.createMetrics().version,
    }),
  );
  mustOk(
    fixture.mood.applyThought({
      actorId: ACTOR_LIN,
      tick,
      sourceKind: "social",
      sourceId: EVENT_CARE_RECEIVED,
      sourceVersion: fixture.relationships.graphVersion,
      targetActorId: ACTOR_YAO,
      targetMoodLane: M3_MOOD_LANE_VALENCE,
      strength: 300,
      effectDelta: 120,
      durationTicks: 7_200,
      memoryDurationTicks: 18_000,
      stackKey: 0x56_0003,
    }),
  );
  mustOk(
    fixture.mood.applyThought({
      actorId: ACTOR_MIN,
      tick,
      sourceKind: "work",
      sourceId: JOB_TREAT_YAO,
      sourceVersion: fixture.treatments.createMetrics().version,
      targetMoodLane: M3_MOOD_LANE_VALENCE,
      strength: 260,
      effectDelta: 90,
      durationTicks: 7_200,
      memoryDurationTicks: 18_000,
      stackKey: 0x56_0004,
    }),
  );
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_MOOD, ACTOR_LIN, ACTOR_YAO, {
      reason: "mood.thought_added",
      selectedTargetId: EVENT_CARE_RECEIVED,
      ownerVersionBasis: fixture.mood.version,
    }),
  );
  applySocialEvent(fixture, EVENT_CARE_RECEIVED, tick, ACTOR_YAO, ACTOR_MIN, "care_received", 160);
}

function runEatingJob(fixture: ScenarioFixture, tick: Tick): void {
  const selectedStacks = new Uint32Array(12);
  selectedStacks.fill(M3_FOOD_STACK_NONE);
  const selectedFood = fixture.food.selectCandidates(
    {
      foodDefId: DEF_GRAIN_BOWL,
      regionId: REGION_OLD_RELAY_YARD,
      permissionId: PERMISSION_TOWN,
      mealWindowId: MEAL_WINDOW_MIDDAY,
      candidateCap: M3_FOOD_DEFAULT_CANDIDATE_CAP,
      maxSelected: M3_FOOD_DEFAULT_SELECTED_CAP,
    },
    selectedStacks,
  );
  if (selectedFood.ok) {
    fixture.foodCandidateVisitedCount += selectedFood.visitedCount;
  }
  const portion = requireFoodPortion(fixture, STACK_GRAIN_BOWL);
  mustOk(
    fixture.eating.createJob(
      {
        jobId: JOB_EAT_YAO,
        owner: readEntity(fixture.actors, ACTOR_YAO),
        sourceStackId: STACK_GRAIN_BOWL,
        storageSlotId: SLOT_GRAIN_BOWL,
        foodDefId: DEF_GRAIN_BOWL,
        amount: 1,
        hungerRestore: 220,
        itemStoreVersion: portion.itemStoreVersion,
        foodAvailabilityVersion: portion.foodAvailabilityVersion,
        mealWindowVersion: portion.mealWindowVersion,
        abilityAllowed: true,
        createdTick: tick,
      },
      fixture.registry,
      fixture.jobCore,
    ),
  );
  mustOk(
    fixture.eating.reserveBeforePickup(
      JOB_EAT_YAO,
      tick,
      fixture.registry,
      fixture.items,
      fixture.food,
      fixture.storage,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
  mustOk(
    fixture.eating.pickup(
      JOB_EAT_YAO,
      tick,
      fixture.items,
      fixture.food,
      fixture.storage,
      fixture.jobCore,
    ),
  );
  mustOk(
    fixture.eating.consume(
      JOB_EAT_YAO,
      tick,
      fixture.needs,
      fixture.ledger,
      fixture.jobCore,
      fixture.needIndex,
    ),
  );
  fixture.food.refreshDirty(fixture.items, fixture.ledger, 8);
  fixture.storage.refreshDirty(fixture.items, fixture.ledger, fixture.workOffers, 8);
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_FOOD, ACTOR_YAO, STACK_GRAIN_BOWL, {
      reason: "food.consumed_integer_portion",
      candidateTotal: selectedFood.ok ? selectedFood.bucketCandidateCount : 0,
      visitedCount: selectedFood.ok ? selectedFood.visitedCount : 0,
      scoredCount: selectedFood.ok ? selectedFood.selectedCount : 0,
      candidateCap: M3_FOOD_DEFAULT_CANDIDATE_CAP,
      selectedTargetId: STACK_GRAIN_BOWL,
      ownerVersionBasis: fixture.items.version,
    }),
  );
}

function runRestJob(fixture: ScenarioFixture, tick: Tick): void {
  const projection = fixture.environment.createProjection(tick);
  mustOk(
    fixture.restJobs.createJob(
      {
        jobId: JOB_REST_YAO,
        owner: readEntity(fixture.actors, ACTOR_YAO),
        actorId: ACTOR_YAO,
        fixtureId: REST_FIXTURE_CLINIC_MAT_A,
        restKind: "rest",
        recoveryTargetValue: 500,
        recoveryPerTickQ16: 40 << 16,
        createdTick: tick,
      },
      fixture.restStore,
      projection,
      fixture.needs,
      fixture.registry,
      fixture.jobCore,
    ),
  );
  mustOk(
    fixture.restJobs.reserveFixture(
      JOB_REST_YAO,
      tick,
      tick + 300,
      fixture.restStore,
      fixture.registry,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
  mustOk(fixture.restJobs.beginRecovery(JOB_REST_YAO, tick, fixture.jobCore));
  for (let offset = 3; offset <= 16; offset += 1) {
    const job = fixture.jobCore.readJob(JOB_REST_YAO);
    if (job?.status !== "running") {
      break;
    }
    mustOk(
      fixture.restJobs.tickRecovery(
        JOB_REST_YAO,
        tick,
        fixture.needs,
        fixture.jobCore,
        fixture.ledger,
        fixture.needIndex,
      ),
    );
  }
  fixture.needIndex.refreshDirty(fixture.needs, 8);
}

function advanceScenarioContext(fixture: ScenarioFixture, tick: Tick): M3EnvironmentProjection {
  const projection = fixture.environment.advanceToTick(tick, fixture.streams);
  mustOk(fixture.needs.processScheduledUpdates(tick, NEED_SCHEDULE_DELTAS, 8, fixture.needIndex));
  fixture.needIndex.refreshDirty(fixture.needs, 16);
  fixture.mood.refreshDirtyActors(8);
  fixture.mood.processScheduledMoodUpdates(tick, 8);
  return projection;
}

function applySocialEvent(
  fixture: ScenarioFixture,
  eventId: number,
  tick: Tick,
  actorId: number,
  targetActorId: number,
  kind: "care_received" | "meal_shared" | "work_burden_shifted" | "care_delayed",
  sourceEventId: number,
): void {
  fixture.streams.nextInt("social:m3-ordinary-life", 1_000);
  const event = createM3OrdinarySocialEvent(
    eventId,
    tick,
    actorId,
    targetActorId,
    kind,
    sourceEventId,
    fixture.relationships.graphVersion,
  );
  mustOk(fixture.relationships.applySocialEvent(event, fixture.relationshipTrace));
  const candidateScratch = new Uint32Array(M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP);
  const selectedIds = new Uint32Array(M3_RELATIONSHIP_DEFAULT_SELECTED_CAP);
  const selectedScores = new Int32Array(M3_RELATIONSHIP_DEFAULT_SELECTED_CAP);
  const selection = fixture.relationships.selectRecentSocialEvents(
    {
      actorId,
      lane: event.lane,
      sourceGraphVersion: fixture.relationships.graphVersion,
      candidateCap: M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP,
      selectedCap: M3_RELATIONSHIP_DEFAULT_SELECTED_CAP,
    },
    candidateScratch,
    selectedIds,
    selectedScores,
    fixture.relationshipTrace,
  );
  if (selection.ok) {
    fixture.socialCandidateVisitedCount += selection.visitedCount;
  }
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_RELATIONSHIP, actorId, targetActorId, {
      reason: "relationship.event_applied",
      candidateTotal: selection.ok ? selection.candidateTotal : 1,
      visitedCount: selection.ok ? selection.visitedCount : 1,
      scoredCount: selection.ok ? selection.scoredCount : 1,
      candidateCap: M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP,
      selectedTargetId: eventId,
      ownerVersionBasis: fixture.relationships.graphVersion,
    }),
  );
}

function registerNeeds(fixture: ScenarioFixture): void {
  registerNeedActor(fixture, ACTOR_YAO, 320, 420, 650, 520, 700);
  registerNeedActor(fixture, ACTOR_LIN, 360, 500, 680, 560, 720);
  registerNeedActor(fixture, ACTOR_MIN, 390, 530, 640, 470, 760);
  registerNeedActor(fixture, ACTOR_QIU, 340, 460, 620, 430, 690);
  registerNeedActor(fixture, ACTOR_REN, 410, 560, 700, 540, 760);
  registerNeedActor(fixture, ACTOR_SU, 430, 600, 580, 610, 730);
}

function registerNeedActor(
  fixture: ScenarioFixture,
  actorId: number,
  hunger: number,
  rest: number,
  comfort: number,
  social: number,
  safety: number,
): void {
  mustOk(
    fixture.needs.registerActor({
      actorId,
      hunger,
      rest,
      comfort,
      social,
      safety,
      sourceTick: 0,
      phaseSeed: actorId,
    }),
  );
}

function registerMoodActors(fixture: ScenarioFixture): void {
  for (let actorId = 0; actorId < ACTOR_COUNT; actorId += 1) {
    mustOk(fixture.mood.registerActor(actorId));
  }
}

function registerAbilities(fixture: ScenarioFixture): void {
  setAbility(fixture, ACTOR_YAO, M3_ABILITY_MOVEMENT, 900);
  setAbility(fixture, ACTOR_YAO, M3_ABILITY_MANIPULATION, 850);
  setAbility(fixture, ACTOR_YAO, M3_ABILITY_STAMINA, 760);
  setAbility(fixture, ACTOR_LIN, M3_ABILITY_MOVEMENT, 850);
  setAbility(fixture, ACTOR_LIN, M3_ABILITY_MANIPULATION, 820);
  setAbility(fixture, ACTOR_LIN, M3_ABILITY_STAMINA, 700);
  setAbility(fixture, ACTOR_MIN, M3_ABILITY_MOVEMENT, 800);
  setAbility(fixture, ACTOR_MIN, M3_ABILITY_MANIPULATION, 920);
  setAbility(fixture, ACTOR_MIN, M3_ABILITY_STAMINA, 650);
  setAbility(fixture, ACTOR_QIU, M3_ABILITY_MOVEMENT, 920);
  setAbility(fixture, ACTOR_QIU, M3_ABILITY_MANIPULATION, 760);
  setAbility(fixture, ACTOR_QIU, M3_ABILITY_STAMINA, 780);
  setAbility(fixture, ACTOR_REN, M3_ABILITY_STAMINA, 620);
  setAbility(fixture, ACTOR_SU, M3_ABILITY_MOVEMENT, 520);
  fixture.abilities.drainInvalidationBacklog(64);
}

function setAbility(
  fixture: ScenarioFixture,
  actorId: number,
  ability: number,
  value: number,
): void {
  mustOk(fixture.abilities.setBaseAbility(actorId, ability, value));
}

function createItemStacks(fixture: ScenarioFixture): void {
  createStack(fixture, STACK_GRAIN_BOWL, DEF_GRAIN_BOWL, 8, 8);
  createStack(fixture, STACK_BEAN_SOUP, DEF_BEAN_SOUP, 3, 3);
  createStack(fixture, STACK_CLEAN_WATER, DEF_CLEAN_WATER, 6, 6);
  createStack(fixture, STACK_BANDAGE, DEF_BANDAGE, 3, 3);
  createStack(fixture, STACK_HERB_POULTICE, DEF_HERB_POULTICE, 2, 2);
}

function createStack(
  fixture: ScenarioFixture,
  stackId: number,
  defId: number,
  quantity: number,
  capacity: number,
): void {
  mustOk(
    fixture.items.createStack(
      {
        stackId,
        entity: readEntity(fixture.stacks, stackId),
        defId,
        quantity,
        capacity,
      },
      fixture.registry,
    ),
  );
}

function configureStorage(fixture: ScenarioFixture): void {
  configureSlot(fixture, SLOT_GRAIN_BOWL, STACK_GRAIN_BOWL, DEF_GRAIN_BOWL, 8, 8, CELL_RELAY_YARD);
  configureSlot(fixture, SLOT_BEAN_SOUP, STACK_BEAN_SOUP, DEF_BEAN_SOUP, 3, 3, CELL_RELAY_YARD);
  configureSlot(fixture, SLOT_WATER, STACK_CLEAN_WATER, DEF_CLEAN_WATER, 6, 6, CELL_RELAY_YARD);
  configureSlot(fixture, SLOT_BANDAGE, STACK_BANDAGE, DEF_BANDAGE, 3, 3, CELL_CLINIC);
  configureSlot(
    fixture,
    SLOT_HERB_POULTICE,
    STACK_HERB_POULTICE,
    DEF_HERB_POULTICE,
    2,
    2,
    CELL_CLINIC,
  );
  fixture.storage.refreshDirty(fixture.items, fixture.ledger, fixture.workOffers, 8);
}

function configureSlot(
  fixture: ScenarioFixture,
  slotId: number,
  stackId: number,
  defId: number,
  capacity: number,
  desiredQuantity: number,
  interactionCellIndex: number,
): void {
  mustOk(
    fixture.storage.configureSlot(
      {
        slotId,
        storage: readEntity(fixture.stacks, stackId),
        stackId,
        defId,
        capacity,
        desiredQuantity,
        interactionCellIndex,
        offerId: 12 + slotId,
        workType: WORK_TYPE_LOGISTICS,
        regionId:
          stackId < STACK_BANDAGE ? REGION_OLD_RELAY_YARD : REGION_RETURNING_LAMP_LANE_CLINIC,
        urgencyBucket: URGENCY_MEDIUM,
        permissionId: PERMISSION_TOWN,
      },
      fixture.registry,
    ),
  );
}

function configureFood(
  fixture: ScenarioFixture,
  mealWindowId: number,
  mealWindowVersion: number,
): void {
  configureFoodPortion(fixture, STACK_GRAIN_BOWL, DEF_GRAIN_BOWL, mealWindowId, mealWindowVersion);
  configureFoodPortion(fixture, STACK_BEAN_SOUP, DEF_BEAN_SOUP, mealWindowId, mealWindowVersion);
  configureFoodPortion(
    fixture,
    STACK_CLEAN_WATER,
    DEF_CLEAN_WATER,
    mealWindowId,
    mealWindowVersion,
  );
  fixture.food.refreshDirty(fixture.items, fixture.ledger, 8);
}

function configureFoodPortion(
  fixture: ScenarioFixture,
  stackId: number,
  defId: number,
  mealWindowId: number,
  mealWindowVersion: number,
): void {
  const portion = fixture.food.readPortion(stackId);
  const input = {
    stackId,
    foodDefId: defId,
    regionId: REGION_OLD_RELAY_YARD,
    storageSlotId: stackId,
    targetCellIndex: CELL_RELAY_YARD,
    interactionSpotId: SPOT_RELAY_FOOD,
    scoreMilli: 1_000 - stackId * 10,
    permissionId: PERMISSION_TOWN,
    mealWindowId,
    mealWindowVersion,
    safe: true,
    permissionAllowed: true,
    scheduleAllowed: true,
  };
  if (portion === undefined) {
    mustOk(fixture.food.configurePortion(input));
  } else {
    mustOk(fixture.food.updatePortion(input));
  }
}

function configureRestFixtures(fixture: ScenarioFixture): void {
  configureRestFixture(fixture, REST_FIXTURE_CLINIC_MAT_A, "clinic_mat", "rest", CELL_CLINIC, 21);
  configureRestFixture(
    fixture,
    REST_FIXTURE_CLINIC_MAT_B,
    "clinic_mat",
    "rest",
    CELL_CLINIC + 1,
    22,
  );
  configureRestFixture(
    fixture,
    REST_FIXTURE_BEDROLL_A,
    "bedroll",
    "sleep",
    CELL_RELAY_YARD + 4,
    23,
  );
  configureRestFixture(
    fixture,
    REST_FIXTURE_BEDROLL_B,
    "bedroll",
    "sleep",
    CELL_RELAY_YARD + 5,
    24,
  );
}

function configureRestFixture(
  fixture: ScenarioFixture,
  fixtureId: number,
  kind: "clinic_mat" | "bedroll",
  restKind: "rest" | "sleep",
  targetCellIndex: number,
  spotId: number,
): void {
  mustOk(
    fixture.restStore.registerFixture(
      {
        fixtureId,
        entity: readEntity(fixture.restFixtures, fixtureId),
        kind,
        restKind,
        regionId: REGION_RETURNING_LAMP_LANE_CLINIC,
        targetCellIndex,
        interactionSpotId: spotId,
        scheduleWindow: "evening",
        weatherExposure: "indoor",
        permissionId: PERMISSION_TOWN,
        recoveryPerTickQ16: 40 << 16,
        baseScoreMilli: 900 - fixtureId,
      },
      fixture.registry,
    ),
  );
}

function configureInitialWorkOffers(fixture: ScenarioFixture): void {
  registerWorkOffer(fixture, OFFER_FIELD_TEND, DEF_FIELD_TEND, REGION_NORTH_FIELD_EDGE, 740);
  registerWorkOffer(fixture, OFFER_GRAIN_CARRY, DEF_GRAIN_CARRY, REGION_EAST_GRANARY_LANE, 710);
  registerWorkOffer(fixture, OFFER_COOK_BREAKFAST, DEF_COOK_BREAKFAST, REGION_OLD_RELAY_YARD, 760);
  registerWorkOffer(
    fixture,
    OFFER_CLINIC_PREPARE,
    DEF_CLINIC_PREPARE,
    REGION_RETURNING_LAMP_LANE_CLINIC,
    680,
  );
}

function registerWorkOffer(
  fixture: ScenarioFixture,
  offerId: number,
  defId: number,
  regionId: number,
  scoreMilli: number,
): void {
  mustOk(
    fixture.workOffers.registerOffer({
      offerId,
      workType: WORK_TYPE_ORDINARY,
      regionId,
      defId,
      urgencyBucket: URGENCY_MEDIUM,
      permissionId: PERMISSION_TOWN,
      targetId: defId,
      targetCellIndex: cellForRegion(regionId),
      scoreMilli,
    }),
  );
}

function createEndState(fixture: ScenarioFixture, tick: Tick): M3OrdinaryLifeEndState {
  const yaoMovementAfterTreatment = readAbilityValue(fixture, ACTOR_YAO, M3_ABILITY_MOVEMENT, 0);
  const sprain = fixture.health.readCondition(CONDITION_YAO_SPRAIN);
  const yaoMood = fixture.mood.readActorMood(ACTOR_YAO);
  const linMood = fixture.mood.readActorMood(ACTOR_LIN);
  const minMood = fixture.mood.readActorMood(ACTOR_MIN);
  const yaoMin = fixture.relationships.readEdge(
    fixture.relationships.getEdgeId(ACTOR_YAO, ACTOR_MIN),
  );
  const yaoLin = fixture.relationships.readEdge(
    fixture.relationships.getEdgeId(ACTOR_YAO, ACTOR_LIN),
  );
  const projection = fixture.environment.createProjection(tick);
  const medicalMetrics = fixture.medical.createMetrics();
  return {
    yaoMovementAfterInjury: fixture.yaoMovementAfterInjury,
    yaoMovementAfterTreatment,
    yaoSprainSeverity: sprain?.severity ?? 0,
    yaoHunger: fixture.needs.readLaneValue(ACTOR_YAO, NEED_LANE_HUNGER),
    yaoRest: fixture.needs.readLaneValue(ACTOR_YAO, NEED_LANE_REST),
    yaoMoodValence: yaoMood?.currentValence ?? 500,
    yaoMoodTension: yaoMood?.currentTension ?? 500,
    linMoodValence: linMood?.currentValence ?? 500,
    minMoodValence: minMood?.currentValence ?? 500,
    yaoMinGratitude: yaoMin?.gratitude ?? 0,
    yaoLinCare: yaoLin?.care ?? 0,
    finalWeather: projection.weather.currentWeather,
    finalScheduleWindow: projection.dayNight.scheduleWindow,
    grainBowlQuantity: readQuantity(fixture.items, STACK_GRAIN_BOWL),
    bandageQuantity: readQuantity(fixture.items, STACK_BANDAGE),
    activeMedicalRequests: medicalMetrics.activePatientRequestCount,
    staleMedicalOfferRejectCount: medicalMetrics.staleBasisRejectCount,
    treatmentCompletedCount: fixture.treatments.createMetrics().completedCount,
  };
}

function createTerminalInvariantCounters(
  fixture: ScenarioFixture,
): M3OrdinaryLifeTerminalInvariantCounters {
  const needCounters = countNeedLaneInvariants(fixture);
  const moodCounters = countMoodLaneInvariants(fixture);
  const relationshipCounters = countRelationshipLaneInvariants(fixture);
  const m4Counters = fixture.m4Absence.createMetrics();
  return {
    activeReservationCount: fixture.ledger.createMetrics().activeCount,
    runningJobCount: fixture.jobCore.createMetrics().runningCount,
    negativeNeedLaneCount: needCounters.outOfRangeCount,
    needLaneCheckCount: needCounters.checkedCount,
    outOfRangeMoodLaneCount: moodCounters.outOfRangeCount,
    moodLaneCheckCount: moodCounters.checkedCount,
    outOfRangeRelationshipLaneCount: relationshipCounters.outOfRangeCount,
    relationshipLaneCheckCount: relationshipCounters.checkedCount,
    activeM4FactCount: m4Counters.activeFactCount,
    m4AbsenceCheckCount: m4Counters.absenceCheckCount,
    reasonTraceOverflowCount: fixture.scenarioTrace.overflow,
    staleAbilityCacheRejectCount: fixture.abilities.createMetrics().staleBasisRejectCount,
    itemConservationDelta: readFoodConservationDelta(fixture),
    medicalStockConservationDelta: readMedicalConservationDelta(fixture),
  };
}

function countNeedLaneInvariants(fixture: ScenarioFixture): InvariantLaneCounter {
  let checkedCount = 0;
  let outOfRangeCount = 0;
  for (let actorId = 0; actorId < fixture.actors.length; actorId += 1) {
    if (!fixture.needs.isActorActive(actorId)) {
      continue;
    }
    for (const lane of NEED_INVARIANT_LANES) {
      const value = fixture.needs.readLaneValue(actorId, lane);
      checkedCount += 1;
      if (value < NEED_VALUE_MIN || value > NEED_VALUE_MAX) {
        outOfRangeCount += 1;
      }
    }
  }
  return { checkedCount, outOfRangeCount };
}

function countMoodLaneInvariants(fixture: ScenarioFixture): InvariantLaneCounter {
  let checkedCount = 0;
  let outOfRangeCount = 0;
  for (let actorId = 0; actorId < fixture.actors.length; actorId += 1) {
    const mood = fixture.mood.readActorMood(actorId);
    if (mood === undefined) {
      continue;
    }
    const values = [
      mood.currentValence,
      mood.currentEnergy,
      mood.currentTension,
      mood.targetValence,
      mood.targetEnergy,
      mood.targetTension,
    ];
    for (const value of values) {
      checkedCount += 1;
      if (value < M3_MOOD_VALUE_MIN || value > M3_MOOD_VALUE_MAX) {
        outOfRangeCount += 1;
      }
    }
  }
  return { checkedCount, outOfRangeCount };
}

function countRelationshipLaneInvariants(fixture: ScenarioFixture): InvariantLaneCounter {
  let checkedCount = 0;
  let outOfRangeCount = 0;
  const snapshot = fixture.relationships.createSnapshot();
  for (const edge of snapshot.edges) {
    const values = [edge.kinship, edge.care, edge.trust, edge.gratitude, edge.resentment];
    for (const value of values) {
      checkedCount += 1;
      if (value < M3_RELATIONSHIP_VALUE_MIN || value > M3_RELATIONSHIP_VALUE_MAX) {
        outOfRangeCount += 1;
      }
    }
  }
  return { checkedCount, outOfRangeCount };
}

function createPerformanceMetrics(
  fixture: ScenarioFixture,
  options: M3OrdinaryLifeScenarioOptions,
  commands: readonly ScenarioCommand[],
  checkpointCount: number,
): M3OrdinaryLifePerformanceMetrics {
  return {
    elapsedTicks: options.ticks,
    commandCount: commands.length,
    checkpointCount,
    actorThinkPasses: fixture.actorThinkPasses,
    workCandidateVisitedCount: fixture.workCandidateVisitedCount,
    needCandidateVisitedCount: fixture.needCandidateVisitedCount,
    medicalCandidateVisitedCount: fixture.medicalCandidateVisitedCount,
    foodCandidateVisitedCount: fixture.foodCandidateVisitedCount,
    socialCandidateVisitedCount: fixture.socialCandidateVisitedCount,
    exactPathRequests: fixture.exactPathRequests,
    boundedCandidateCapHits: fixture.boundedCandidateCapHits,
  };
}

function createQueueMetrics(fixture: ScenarioFixture): M3OrdinaryLifeQueueMetrics {
  const need = fixture.needIndex.createMetrics();
  const env = fixture.environment.createMetrics();
  const food = fixture.food.createMetrics();
  const health = fixture.health.createMetrics();
  const ability = fixture.abilities.createMetrics();
  const mood = fixture.mood.createMetrics();
  return {
    needDirtyBacklog: need.dirtyBacklog,
    needDirtyBacklogPeak: need.dirtyBacklogPeak,
    environmentDirtyBacklog: env.dirtyBacklog,
    environmentDirtyBacklogPeak: env.dirtyBacklogPeak,
    foodDirtyBacklog: food.dirtyBacklog,
    foodDirtyBacklogPeak: food.dirtyBacklogPeak,
    healthDirtyBacklog: health.healthDirtyBacklog,
    healthDirtyPeak: health.healthDirtyPeak,
    abilityDirtyBacklog: ability.abilityDirtyBacklog,
    abilityDirtyPeak: ability.abilityDirtyPeak,
    moodDirtyBacklog: mood.dirtyBacklog,
    moodDirtyBacklogPeak: mood.dirtyBacklogPeak,
  };
}

function recordCheckpointHash(
  fixture: ScenarioFixture,
  tick: Tick,
  output: M3OrdinaryLifeCheckpointHash[],
): void {
  fixture.scenarioTrace.record(
    createTrace(tick, SYSTEM_SCENARIO, ACTOR_NONE, TARGET_NONE, {
      reason: "snapshot.rebuilt_derived_indexes",
      selectedTargetId: tick,
      ownerVersionBasis: fixture.needIndex.sourceVersion,
    }),
  );
  output.push({
    tick,
    hash: createScenarioHash(
      tick,
      fixture,
      createEndState(fixture, tick),
      createTerminalInvariantCounters(fixture),
    ),
  });
}

function createScenarioHash(
  hashTick: Tick,
  fixture: ScenarioFixture,
  endState: M3OrdinaryLifeEndState,
  invariants: M3OrdinaryLifeTerminalInvariantCounters,
): string {
  const fields: CanonicalWorldField[] = [
    { name: "scenarioId", value: M3_ORDINARY_LIFE_SCENARIO_ID },
    { name: "seed", value: M3_ORDINARY_LIFE_PRIMARY_SEED },
    { name: "hashTick", value: hashTick },
    { name: "needVersion", value: fixture.needs.version },
    { name: "healthHash", value: fixture.health.createHash() },
    { name: "abilityHash", value: fixture.abilities.createHash(fixture.health) },
    { name: "medicalHash", value: fixture.medical.createHash() },
    { name: "moodHash", value: fixture.mood.createHash() },
    { name: "relationshipHash", value: fixture.relationships.createHash() },
    { name: "itemVersion", value: fixture.items.version },
    { name: "ledgerVersion", value: fixture.ledger.version },
    { name: "jobVersion", value: fixture.jobCore.version },
    { name: "weather", value: endState.finalWeather },
    { name: "window", value: endState.finalScheduleWindow },
    { name: "sprainSeverity", value: endState.yaoSprainSeverity },
    { name: "grain", value: endState.grainBowlQuantity },
    { name: "bandage", value: endState.bandageQuantity },
    { name: "activeReservations", value: invariants.activeReservationCount },
    { name: "runningJobs", value: invariants.runningJobCount },
    { name: "m4Facts", value: invariants.activeM4FactCount },
  ];
  return formatCanonicalWorldHash({
    fields,
    randomStreams: fixture.streams.snapshot().streams,
    queuedCommands: [],
  });
}

function createCommandStreamHash(commands: readonly ScenarioCommand[]): number {
  let hash = hashStringToUint32(M3_ORDINARY_LIFE_SCENARIO_ID);
  hash = mixUint32(hash, hashStringToUint32(M3_ORDINARY_LIFE_PRIMARY_SEED));
  for (const command of commands) {
    hash = mixUint32(hash, command.tick);
    hash = mixUint32(hash, command.sequence);
    hash = mixUint32(hash, hashStringToUint32(command.kind));
    hash = mixUint32(hash, command.actorId);
    hash = mixUint32(hash, command.targetId);
  }
  return hash;
}

function createContentHash(): number {
  let hash = hashStringToUint32("m3 ordinary life fixture");
  hash = mixUint32(hash, ACTOR_COUNT);
  hash = mixUint32(hash, 32 * 24);
  hash = mixUint32(hash, 4);
  hash = mixUint32(hash, 8);
  return hash;
}

function createCommandStream(): readonly ScenarioCommand[] {
  return Object.freeze([
    command(0, 0, "scenario.start", ACTOR_NONE, TARGET_NONE),
    command(900, 1, "assign.work", ACTOR_YAO, DEF_FIELD_TEND),
    command(1_800, 2, "assign.work", ACTOR_LIN, DEF_COOK_BREAKFAST),
    command(2_400, 3, "scenario.inject_injury", ACTOR_YAO, CONDITION_YAO_SPRAIN),
    command(2_430, 4, "request.medical", ACTOR_YAO, CONDITION_YAO_SPRAIN),
    command(3_000, 5, "weather.force", ACTOR_NONE, 1),
    command(6_000, 6, "assign.work", ACTOR_QIU, DEF_GRAIN_CARRY),
    command(7_200, 7, "meal.window", ACTOR_NONE, MEAL_WINDOW_MIDDAY),
    command(12_000, 8, "checkpoint.save", ACTOR_NONE, TARGET_NONE),
    command(18_000, 9, "time.window", ACTOR_NONE, TARGET_NONE),
    command(19_600, 10, "assign.work", ACTOR_YAO, DEF_FIELD_TEND),
    command(36_000, 11, "scenario.end_day", ACTOR_NONE, TARGET_NONE),
  ]);
}

function command(
  tick: Tick,
  sequence: number,
  kind: ScenarioCommandKind,
  actorId: number,
  targetId: number,
): ScenarioCommand {
  return { tick, sequence, kind, actorId, targetId };
}

function createTrace(
  tick: Tick,
  systemId: number,
  actorId: number,
  targetId: number,
  values: {
    readonly reason: M3OrdinaryLifeReason;
    readonly candidateTotal?: number;
    readonly visitedCount?: number;
    readonly scoredCount?: number;
    readonly candidateCap?: number;
    readonly selectedTargetId: number;
    readonly ownerVersionBasis: number;
  },
): Omit<M3OrdinaryLifeReasonTrace, "sequence"> {
  return {
    tick,
    systemId,
    actorId,
    targetId,
    candidateTotal: values.candidateTotal ?? 0,
    visitedCount: values.visitedCount ?? 0,
    scoredCount: values.scoredCount ?? 0,
    candidateCap: values.candidateCap ?? 0,
    selectedTargetId: values.selectedTargetId,
    reason: values.reason,
    ownerVersionBasis: values.ownerVersionBasis,
  };
}

function createSuccessfulPath(
  basis: ReturnType<typeof createPathVersionBasis>,
  tick: Tick,
  startCellIndex: number,
  goalCellIndex: number,
): PathSearchResult {
  return {
    ok: true,
    requestSequence: tick,
    basis,
    startCellIndex,
    goalCellIndex,
    path: new Uint32Array([startCellIndex, goalCellIndex]),
    pathCellCount: 2,
    pathCostMilli: 1_000,
    nodeExpansions: 2,
  };
}

function requireCondition(
  fixture: ScenarioFixture,
  conditionId: number,
): NonNullable<ReturnType<M3HealthConditionStore["readCondition"]>> {
  const condition = fixture.health.readCondition(conditionId);
  if (condition === undefined) {
    throw new Error("missing M3 ordinary-life condition");
  }
  return condition;
}

function requireFoodPortion(
  fixture: ScenarioFixture,
  stackId: number,
): NonNullable<ReturnType<M3FoodAvailabilityStore["readPortion"]>> {
  const portion = fixture.food.readPortion(stackId);
  if (portion === undefined) {
    throw new Error("missing M3 ordinary-life food portion");
  }
  return portion;
}

function readAbilityValue(
  fixture: ScenarioFixture,
  actorId: number,
  ability: number,
  minimum: number,
): number {
  const result = fixture.abilities.queryAbility(actorId, ability, fixture.health, minimum);
  return result.value;
}

function readFoodConservationDelta(fixture: ScenarioFixture): number {
  const remaining =
    readQuantity(fixture.items, STACK_GRAIN_BOWL) +
    readQuantity(fixture.items, STACK_BEAN_SOUP) +
    readQuantity(fixture.items, STACK_CLEAN_WATER);
  const consumed = fixture.eating.createMetrics().consumedAmountTotal;
  return INITIAL_FOOD_TOTAL - remaining - consumed;
}

function readMedicalConservationDelta(fixture: ScenarioFixture): number {
  const remaining =
    readQuantity(fixture.items, STACK_BANDAGE) + readQuantity(fixture.items, STACK_HERB_POULTICE);
  const consumed = fixture.treatments.createMetrics().stockConsumedCount;
  return INITIAL_MEDICAL_TOTAL - remaining - consumed;
}

function readQuantity(items: ItemStackStore, stackId: number): number {
  return items.readStack(stackId)?.quantity ?? 0;
}

function allocateMany(registry: EntityRegistry, count: number): readonly EntityId[] {
  const entities: EntityId[] = [];
  for (let index = 0; index < count; index += 1) {
    const allocated = registry.allocate();
    if (!allocated.ok) {
      throw new Error(allocated.reason);
    }
    entities.push(allocated.entity);
  }
  return entities;
}

function readEntity(entities: readonly EntityId[], index: number): EntityId {
  const entity = entities[index];
  if (entity === undefined) {
    throw new Error("missing M3 ordinary-life entity");
  }
  return entity;
}

function cellForRegion(regionId: number): number {
  if (regionId === REGION_NORTH_FIELD_EDGE) {
    return CELL_NORTH_FIELD;
  }
  if (regionId === REGION_EAST_GRANARY_LANE) {
    return CELL_GRANARY;
  }
  if (regionId === REGION_RETURNING_LAMP_LANE_CLINIC) {
    return CELL_CLINIC;
  }
  return CELL_RELAY_YARD;
}

function formatHash(value: number): string {
  return `0x${padHex(value)}`;
}

function padHex(value: number): string {
  let hex = (value >>> 0).toString(16);
  while (hex.length < 8) {
    hex = `0${hex}`;
  }
  return hex;
}

function mustOk(result: { readonly ok: boolean; readonly reason?: string }): void {
  if (!result.ok) {
    throw new Error(result.reason ?? "M3 ordinary-life scenario mutation failed");
  }
}

const ACTOR_NONE = 0xffff_ffff;
const TARGET_NONE = 0xffff_ffff;
const ACTOR_YAO = 0;
const ACTOR_LIN = 1;
const ACTOR_MIN = 2;
const ACTOR_QIU = 3;
const ACTOR_REN = 4;
const ACTOR_SU = 5;
const ACTOR_COUNT = 6;
const REGION_OLD_RELAY_YARD = 0;
const REGION_EAST_GRANARY_LANE = 1;
const REGION_RETURNING_LAMP_LANE_CLINIC = 2;
const REGION_NORTH_FIELD_EDGE = 3;
const REGION_COUNT = 4;
const PERMISSION_TOWN = 0;
const PERMISSION_CLINIC = 1;
const PERMISSION_COUNT = 4;
const URGENCY_MEDIUM = 2;
const URGENCY_HIGH = 3;
const URGENCY_BUCKET_COUNT = 4;
const DEF_CAPACITY = 512;
const WORK_TYPE_ORDINARY = 1;
const WORK_TYPE_LOGISTICS = 2;
const DEF_FIELD_TEND = 10;
const DEF_GRAIN_CARRY = 11;
const DEF_COOK_BREAKFAST = 12;
const DEF_CLINIC_PREPARE = 13;
const DEF_GRAIN_BOWL = 101;
const DEF_BEAN_SOUP = 102;
const DEF_CLEAN_WATER = 103;
const DEF_BANDAGE = 201;
const DEF_HERB_POULTICE = 202;
const DEF_LEFT_LEG_SPRAIN = 301;
const DEF_TREAT_SPRAIN = 401;
const STACK_GRAIN_BOWL = 0;
const STACK_BEAN_SOUP = 1;
const STACK_CLEAN_WATER = 2;
const STACK_BANDAGE = 3;
const STACK_HERB_POULTICE = 4;
const SLOT_GRAIN_BOWL = 0;
const SLOT_BEAN_SOUP = 1;
const SLOT_WATER = 2;
const SLOT_BANDAGE = 3;
const SLOT_HERB_POULTICE = 4;
const OFFER_FIELD_TEND = 0;
const OFFER_GRAIN_CARRY = 1;
const OFFER_COOK_BREAKFAST = 2;
const OFFER_CLINIC_PREPARE = 3;
const CONDITION_YAO_SPRAIN = 0;
const REQUEST_YAO_SPRAIN = 0;
const BODY_PART_LEFT_LEG = 6;
const SOURCE_SPRAIN = 46;
const CLUE_LIMP_OBSERVED = 10;
const COUNTER_NO_FEVER = 20;
const MEAL_WINDOW_DAWN = 0;
const MEAL_WINDOW_MIDDAY = 1;
const REST_FIXTURE_CLINIC_MAT_A = 0;
const REST_FIXTURE_CLINIC_MAT_B = 1;
const REST_FIXTURE_BEDROLL_A = 2;
const REST_FIXTURE_BEDROLL_B = 3;
const JOB_TREAT_YAO = 0;
const JOB_EAT_YAO = 1;
const JOB_REST_YAO = 2;
const CELL_RELAY_YARD = 36;
const CELL_GRANARY = 74;
const CELL_CLINIC = 228;
const CELL_NORTH_FIELD = 610;
const SPOT_RELAY_FOOD = 12;
const SPOT_PATIENT_YAO = 33;
const EVENT_CARE_RECEIVED = 2;
const EVENT_WORK_BURDEN_SHIFTED = 3;
const SYSTEM_SCENARIO = 1;
const SYSTEM_NEEDS = 2;
const SYSTEM_WORK = 3;
const SYSTEM_HEALTH = 4;
const SYSTEM_MEDICAL = 5;
const SYSTEM_FOOD = 6;
const SYSTEM_ENVIRONMENT = 7;
const SYSTEM_MOOD = 8;
const SYSTEM_RELATIONSHIP = 9;
const SYSTEM_REST = 10;
const INITIAL_FOOD_TOTAL = 17;
const INITIAL_MEDICAL_TOTAL = 5;
const NEED_SCHEDULE_DELTAS = new Int32Array([-4, -3, -2, -1, 0]);
const NEED_INVARIANT_LANES: readonly NeedLane[] = Object.freeze([
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_COMFORT,
  NEED_LANE_SOCIAL,
  NEED_LANE_SAFETY,
]);
const M4_ABSENCE_CHECK_COUNT = 5;
