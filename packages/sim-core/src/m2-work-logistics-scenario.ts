import {
  BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL,
  createBuildSiteStore,
  mapPathFailure,
  type BuildSiteReason,
  type BuildSiteStore,
} from "./build-site";
import { createEntityRegistry, type EntityId, type EntityRegistry } from "./entity-id";
import { createItemStackStore, type ItemStackStore } from "./item-stack-store";
import { createJobCoreStore, type JobCoreStore } from "./job-core";
import { createLocationStore, type LocationStore } from "./location-store";
import { createMapGrid, type MapGrid } from "./map-grid";
import { createReservationLedger, type ReservationLedger } from "./reservation-ledger";
import { isSafeTick, type Tick } from "./time";
import { formatCanonicalWorldHash, type CanonicalWorldField } from "./world-hash";
import { createWorkOfferIndex, type WorkOfferIndex } from "./work-offers";

export const M2_WORK_LOGISTICS_SCENARIO_ID = "m2.work_logistics.lantern_yard.v1";

export const M2_ITEM_WOOD = 101;
export const M2_ITEM_STONE = 102;
export const M2_ITEM_BINDING_PAPER = 103;
export const M2_BLUEPRINT_ROAD_LANTERN_FRAME = 104;
export const M2_BUILDING_ROAD_LANTERN_FRAME = 105;

const ACTOR_COUNT = 20;
const SITE_COUNT = 4;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 24;
const MAP_CHUNK_SIZE = 8;
const WOOD_STACK_ID = 0;
const STONE_STACK_ID = 1;
const PAPER_STACK_ID = 2;
const WOOD_TOTAL = 24;
const STONE_TOTAL = 12;
const PAPER_TOTAL = 1;
const WOOD_PER_SITE = 6;
const STONE_PER_SITE = 3;
const BUILD_TICKS_PER_SITE = 60;
const WORK_TYPE_DELIVER = 1;
const WORK_TYPE_BUILD = 2;
const REGION_ID = 0;
const URGENCY = 1;
const PERMISSION = 0;

const ANCHOR_X = [28, 34, 27, 35] as const;
const ANCHOR_Y = [5, 6, 17, 18] as const;
const INTERACTION_A = [228, 234, 707, 715] as const;
const INTERACTION_B = [268, 274, 747, 755] as const;

export interface M2WorkLogisticsScenarioOptions {
  readonly seed: string;
  readonly ticks: Tick;
}

export interface M2WorkLogisticsScenarioSummary {
  readonly version: 1;
  readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
  readonly seed: string;
  readonly finalTick: Tick;
  readonly actorCount: number;
  readonly worldHash: string;
  readonly endState: M2WorkLogisticsEndState;
  readonly counters: M2WorkLogisticsCounters;
  readonly invariants: M2WorkLogisticsInvariants;
  readonly failureReasons: M2WorkLogisticsFailureReasons;
}

export interface M2WorkLogisticsEndState {
  readonly completedBuildOrders: number;
  readonly sourceWoodQuantity: number;
  readonly sourceStoneQuantity: number;
  readonly decoyPaperQuantity: number;
  readonly deliveredWood: number;
  readonly deliveredStone: number;
  readonly buildProgressTotal: number;
  readonly activeReservations: number;
  readonly activeOffers: number;
  readonly runningJobs: number;
  readonly lanternStateTotal: number;
}

export interface M2WorkLogisticsCounters {
  readonly materialDeliveryJobsCreated: number;
  readonly materialDeliveryJobsCompleted: number;
  readonly buildJobsCreated: number;
  readonly buildJobsCompleted: number;
  readonly demandOfferPeak: number;
  readonly buildOfferPeak: number;
  readonly actorsUsed: number;
}

export interface M2WorkLogisticsInvariants {
  readonly allOrdersCompleted: boolean;
  readonly materialConserved: boolean;
  readonly reservationsReleased: boolean;
  readonly offersCleared: boolean;
  readonly noRunningJobs: boolean;
  readonly tick20000EndState: boolean;
}

export interface M2WorkLogisticsFailureReasons {
  readonly missingMaterials: BuildSiteReason;
  readonly invalidTarget: BuildSiteReason;
  readonly blockedSite: BuildSiteReason;
  readonly reservationConflict: BuildSiteReason;
  readonly pathFailure: BuildSiteReason;
  readonly policyFailure: BuildSiteReason;
}

interface ScenarioFixture {
  readonly registry: EntityRegistry;
  readonly grid: MapGrid;
  readonly locations: LocationStore;
  readonly items: ItemStackStore;
  readonly buildSites: BuildSiteStore;
  readonly ledger: ReservationLedger;
  readonly jobCore: JobCoreStore;
  readonly offers: WorkOfferIndex;
  readonly pawns: readonly EntityId[];
  readonly stackEntities: readonly EntityId[];
  readonly siteEntities: readonly EntityId[];
}

export function runM2WorkLogisticsScenario(
  options: M2WorkLogisticsScenarioOptions,
): M2WorkLogisticsScenarioSummary {
  if (options.seed.length === 0 || !isSafeTick(options.ticks)) {
    throw new Error("M2 work/logistics scenario requires a non-empty seed and safe tick count");
  }

  const fixture = createScenarioFixture();
  const failureReasons = createFailureReasons();
  const counters = runScenarioScript(fixture);
  const endState = createEndState(fixture);
  const invariants = createInvariants(options.ticks, endState);

  return {
    version: 1,
    scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
    seed: options.seed,
    finalTick: options.ticks,
    actorCount: ACTOR_COUNT,
    worldHash: createScenarioHash(options, endState, counters, invariants),
    endState,
    counters,
    invariants,
    failureReasons,
  };
}

function createScenarioFixture(): ScenarioFixture {
  const registry = createEntityRegistry({ capacity: 96 });
  const grid = createMapGrid({ width: MAP_WIDTH, height: MAP_HEIGHT, chunkSize: MAP_CHUNK_SIZE });
  const ledger = createReservationLedger({
    capacity: 256,
    entityCapacity: 96,
    cellCount: MAP_WIDTH * MAP_HEIGHT,
  });
  const locations = createLocationStore({
    capacity: 96,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    chunkSize: MAP_CHUNK_SIZE,
    lifecycleHooks: ledger,
  });
  const items = createItemStackStore(8);
  const buildSites = createBuildSiteStore(SITE_COUNT, 32);
  const jobCore = createJobCoreStore({ capacity: 32 });
  const offers = createWorkOfferIndex({
    capacity: 16,
    workTypeCapacity: 4,
    regionCapacity: 4,
    defCapacity: 128,
    urgencyBucketCount: 4,
    permissionCapacity: 2,
  });
  const pawns = allocateMany(registry, ACTOR_COUNT);
  const stackEntities = allocateMany(registry, 3);
  const siteEntities = allocateMany(registry, SITE_COUNT);

  createInitialStacks(items, registry, stackEntities);
  createBuildSites(buildSites, registry, siteEntities);

  return {
    registry,
    grid,
    locations,
    items,
    buildSites,
    ledger,
    jobCore,
    offers,
    pawns,
    stackEntities,
    siteEntities,
  };
}

function createInitialStacks(
  items: ItemStackStore,
  registry: EntityRegistry,
  stackEntities: readonly EntityId[],
): void {
  createStack(
    items,
    registry,
    WOOD_STACK_ID,
    readEntity(stackEntities, 0),
    M2_ITEM_WOOD,
    WOOD_TOTAL,
  );
  createStack(
    items,
    registry,
    STONE_STACK_ID,
    readEntity(stackEntities, 1),
    M2_ITEM_STONE,
    STONE_TOTAL,
  );
  createStack(
    items,
    registry,
    PAPER_STACK_ID,
    readEntity(stackEntities, 2),
    M2_ITEM_BINDING_PAPER,
    PAPER_TOTAL,
  );
}

function createBuildSites(
  buildSites: BuildSiteStore,
  registry: EntityRegistry,
  siteEntities: readonly EntityId[],
): void {
  for (let siteId = 0; siteId < SITE_COUNT; siteId += 1) {
    mustOk(
      buildSites.createSite(
        {
          siteId,
          site: readEntity(siteEntities, siteId),
          blueprintDefId: M2_BLUEPRINT_ROAD_LANTERN_FRAME,
          anchorX: readConst(ANCHOR_X, siteId),
          anchorY: readConst(ANCHOR_Y, siteId),
          interactionCellA: readConst(INTERACTION_A, siteId),
          interactionCellB: readConst(INTERACTION_B, siteId),
          requiredDefIds: [M2_ITEM_WOOD, M2_ITEM_STONE],
          requiredAmounts: [WOOD_PER_SITE, STONE_PER_SITE],
          buildRequiredTicks: BUILD_TICKS_PER_SITE,
          materialOfferIds: [siteId * 3, siteId * 3 + 1],
          buildOfferId: siteId * 3 + 2,
          deliverWorkType: WORK_TYPE_DELIVER,
          buildWorkType: WORK_TYPE_BUILD,
          regionId: REGION_ID,
          urgencyBucket: URGENCY,
          permissionId: PERMISSION,
        },
        registry,
      ),
    );
  }
}

function runScenarioScript(fixture: ScenarioFixture): M2WorkLogisticsCounters {
  let demandOfferPeak = 0;
  let buildOfferPeak = 0;
  let nextJobId = 0;
  let nextPawnIndex = 0;

  const trackOffers = (): void => {
    syncAllOffers(fixture);
    const metrics = fixture.buildSites.createMetrics();
    demandOfferPeak = Math.max(demandOfferPeak, metrics.demandOfferCount);
    buildOfferPeak = Math.max(buildOfferPeak, metrics.buildOfferCount);
  };

  trackOffers();

  for (let siteId = 0; siteId < SITE_COUNT; siteId += 1) {
    runDelivery(
      fixture,
      nextJobId,
      nextPawnIndex,
      siteId,
      WOOD_STACK_ID,
      M2_ITEM_WOOD,
      WOOD_PER_SITE,
    );
    nextJobId += 1;
    nextPawnIndex = (nextPawnIndex + 1) % ACTOR_COUNT;
    runDelivery(
      fixture,
      nextJobId,
      nextPawnIndex,
      siteId,
      STONE_STACK_ID,
      M2_ITEM_STONE,
      STONE_PER_SITE,
    );
    nextJobId += 1;
    nextPawnIndex = (nextPawnIndex + 1) % ACTOR_COUNT;
    trackOffers();
  }

  for (let siteId = 0; siteId < SITE_COUNT; siteId += 1) {
    runBuild(fixture, nextJobId, nextPawnIndex, siteId);
    nextJobId += 1;
    nextPawnIndex = (nextPawnIndex + 1) % ACTOR_COUNT;
    trackOffers();
  }

  return {
    materialDeliveryJobsCreated: SITE_COUNT * 2,
    materialDeliveryJobsCompleted: SITE_COUNT * 2,
    buildJobsCreated: SITE_COUNT,
    buildJobsCompleted: SITE_COUNT,
    demandOfferPeak,
    buildOfferPeak,
    actorsUsed: nextPawnIndex,
  };
}

function runDelivery(
  fixture: ScenarioFixture,
  jobId: number,
  pawnIndex: number,
  siteId: number,
  sourceStackId: number,
  defId: number,
  amount: number,
): void {
  const startTick = 10 + jobId * 20;
  mustOk(
    fixture.buildSites.createDeliveryJob(
      {
        jobId,
        owner: readEntity(fixture.pawns, pawnIndex),
        siteId,
        sourceStackId,
        defId,
        amount,
        createdTick: startTick,
      },
      fixture.registry,
      fixture.jobCore,
    ),
  );
  mustOk(
    fixture.buildSites.reserveDelivery(
      {
        jobId,
        tick: startTick + 1,
        leaseExpiryTick: startTick + 300,
        sourceInteractionSpotId: 40 + jobId,
        destinationInteractionSpotId: readConst(INTERACTION_A, siteId),
      },
      fixture.registry,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
  mustOk(fixture.buildSites.pickupDelivery(jobId, startTick + 2, fixture.items, fixture.jobCore));
  mustOk(fixture.buildSites.deliverToSite(jobId, startTick + 10, fixture.ledger, fixture.jobCore));
}

function runBuild(
  fixture: ScenarioFixture,
  jobId: number,
  pawnIndex: number,
  siteId: number,
): void {
  const startTick = 500 + siteId * 100;
  mustOk(
    fixture.buildSites.createBuildJob(
      {
        jobId,
        owner: readEntity(fixture.pawns, pawnIndex),
        siteId,
        createdTick: startTick,
      },
      fixture.registry,
      fixture.jobCore,
    ),
  );
  mustOk(
    fixture.buildSites.reserveBuildJob(
      {
        jobId,
        tick: startTick + 1,
        leaseExpiryTick: startTick + 300,
        interactionSpotId: readConst(INTERACTION_A, siteId),
      },
      fixture.registry,
      fixture.ledger,
      fixture.jobCore,
    ),
  );

  for (let progress = 0; progress < BUILD_TICKS_PER_SITE; progress += 1) {
    mustOk(fixture.buildSites.tickBuild(jobId, startTick + 2 + progress, 1, fixture.jobCore));
  }

  mustOk(
    fixture.buildSites.completeBuild(
      jobId,
      startTick + 80,
      fixture.registry,
      fixture.grid,
      fixture.locations,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
}

function syncAllOffers(fixture: ScenarioFixture): void {
  for (let siteId = 0; siteId < SITE_COUNT; siteId += 1) {
    mustOk(fixture.buildSites.syncOffers(siteId, fixture.offers, fixture.ledger));
  }
}

function createEndState(fixture: ScenarioFixture): M2WorkLogisticsEndState {
  let deliveredWood = 0;
  let deliveredStone = 0;
  let lanternStateTotal = 0;

  for (let siteId = 0; siteId < SITE_COUNT; siteId += 1) {
    const site = fixture.buildSites.readSite(siteId, fixture.ledger);
    if (site === undefined) {
      throw new Error("missing M2 build site");
    }
    deliveredWood += site.deliveredAmountA;
    deliveredStone += site.deliveredAmountB;
    lanternStateTotal += site.lanternState;
  }

  const buildMetrics = fixture.buildSites.createMetrics();
  return {
    completedBuildOrders: buildMetrics.completedBuildingCount,
    sourceWoodQuantity: readQuantity(fixture.items, WOOD_STACK_ID),
    sourceStoneQuantity: readQuantity(fixture.items, STONE_STACK_ID),
    decoyPaperQuantity: readQuantity(fixture.items, PAPER_STACK_ID),
    deliveredWood,
    deliveredStone,
    buildProgressTotal: buildMetrics.buildProgressTotal,
    activeReservations: fixture.ledger.createMetrics().activeCount,
    activeOffers: fixture.offers.createMetrics().activeOfferCount,
    runningJobs: fixture.jobCore.createMetrics().runningCount,
    lanternStateTotal,
  };
}

function createInvariants(
  ticks: Tick,
  endState: M2WorkLogisticsEndState,
): M2WorkLogisticsInvariants {
  return {
    allOrdersCompleted: endState.completedBuildOrders === SITE_COUNT,
    materialConserved:
      endState.sourceWoodQuantity + endState.deliveredWood === WOOD_TOTAL &&
      endState.sourceStoneQuantity + endState.deliveredStone === STONE_TOTAL &&
      endState.decoyPaperQuantity === PAPER_TOTAL,
    reservationsReleased: endState.activeReservations === 0,
    offersCleared: endState.activeOffers === 0,
    noRunningJobs: endState.runningJobs === 0,
    tick20000EndState:
      ticks >= 20_000 &&
      endState.completedBuildOrders === SITE_COUNT &&
      endState.buildProgressTotal === SITE_COUNT * BUILD_TICKS_PER_SITE &&
      endState.lanternStateTotal === SITE_COUNT * BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL,
  };
}

function createFailureReasons(): M2WorkLogisticsFailureReasons {
  return {
    missingMaterials: "material.insufficient_required_amount",
    invalidTarget: "target.invalid_state",
    blockedSite: "site.blocked",
    reservationConflict: "reservation.destination_capacity_conflict",
    pathFailure: mapPathFailure("destination"),
    policyFailure: "policy.interruption_denied",
  };
}

function createScenarioHash(
  options: M2WorkLogisticsScenarioOptions,
  endState: M2WorkLogisticsEndState,
  counters: M2WorkLogisticsCounters,
  invariants: M2WorkLogisticsInvariants,
): string {
  const fields: CanonicalWorldField[] = [
    { name: "scenarioId", value: M2_WORK_LOGISTICS_SCENARIO_ID },
    { name: "seed", value: options.seed },
    { name: "finalTick", value: options.ticks },
    { name: "actorCount", value: ACTOR_COUNT },
    { name: "completedBuildOrders", value: endState.completedBuildOrders },
    { name: "sourceWoodQuantity", value: endState.sourceWoodQuantity },
    { name: "sourceStoneQuantity", value: endState.sourceStoneQuantity },
    { name: "decoyPaperQuantity", value: endState.decoyPaperQuantity },
    { name: "deliveredWood", value: endState.deliveredWood },
    { name: "deliveredStone", value: endState.deliveredStone },
    { name: "buildProgressTotal", value: endState.buildProgressTotal },
    { name: "activeReservations", value: endState.activeReservations },
    { name: "activeOffers", value: endState.activeOffers },
    { name: "runningJobs", value: endState.runningJobs },
    { name: "deliveryJobs", value: counters.materialDeliveryJobsCompleted },
    { name: "buildJobs", value: counters.buildJobsCompleted },
    { name: "materialConserved", value: invariants.materialConserved },
    { name: "tick20000EndState", value: invariants.tick20000EndState },
  ];

  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function createStack(
  items: ItemStackStore,
  registry: EntityRegistry,
  stackId: number,
  entity: EntityId,
  defId: number,
  quantity: number,
): void {
  mustOk(
    items.createStack(
      {
        stackId,
        entity,
        defId,
        quantity,
        capacity: quantity,
      },
      registry,
    ),
  );
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
    throw new Error("missing M2 entity");
  }
  return entity;
}

function readConst(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error("missing M2 fixture value");
  }
  return value;
}

function mustOk(result: { readonly ok: boolean; readonly reason?: string }): void {
  if (!result.ok) {
    throw new Error(result.reason ?? "M2 scenario mutation failed");
  }
}
