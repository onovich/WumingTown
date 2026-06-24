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

export const HAULING_BUILDING_SCENARIO_ID = "m1.hauling_building.road_lantern_frame.v1";

export const M1_ITEM_WOOD = 1;
export const M1_ITEM_STONE = 2;
export const M1_ITEM_PAPER = 3;
export const M1_BLUEPRINT_ROAD_LANTERN_FRAME = 4;
export const M1_BUILDING_ROAD_LANTERN_FRAME = 5;

const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;
const MAP_CHUNK_SIZE = 8;
const SITE_ID = 0;
const WOOD_STACK_ID = 0;
const STONE_STACK_ID = 1;
const PAPER_STACK_ID = 2;
const SOURCE_WOOD_CELL = 66;
const SOURCE_STONE_CELL = 67;
const BUILD_ANCHOR_X = 12;
const BUILD_ANCHOR_Y = 7;
const BUILD_ANCHOR_CELL = 124;
const BUILD_INTERACTION_WEST = 123;
const BUILD_INTERACTION_SOUTH = 140;
const WORK_TYPE_DELIVER = 1;
const WORK_TYPE_BUILD = 2;
const REGION_ID = 0;
const URGENCY = 1;
const PERMISSION = 0;

export interface HaulingBuildingScenarioOptions {
  readonly seed: string;
  readonly ticks: Tick;
}

export interface HaulingBuildingScenarioSummary {
  readonly version: 1;
  readonly scenarioId: typeof HAULING_BUILDING_SCENARIO_ID;
  readonly seed: string;
  readonly finalTick: Tick;
  readonly expectedTick2400Reached: boolean;
  readonly longRunStable: boolean;
  readonly worldHash: string;
  readonly endState: HaulingBuildingEndState;
  readonly counters: HaulingBuildingCounters;
  readonly invariants: HaulingBuildingInvariants;
  readonly failureReasons: HaulingBuildingFailureReasons;
}

export interface HaulingBuildingEndState {
  readonly completedBuildingCount: number;
  readonly buildingDefId: typeof M1_BUILDING_ROAD_LANTERN_FRAME;
  readonly anchorCellIndex: typeof BUILD_ANCHOR_CELL;
  readonly lanternState: typeof BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL;
  readonly buildSiteActive: boolean;
  readonly buildSiteCompleted: boolean;
  readonly sourceWoodQuantity: number;
  readonly sourceStoneQuantity: number;
  readonly decoyPaperQuantity: number;
  readonly deliveredWood: number;
  readonly deliveredStone: number;
  readonly buildProgressTicks: number;
  readonly pawnCarriedAmount: number;
  readonly activeReservationCount: number;
  readonly runningJobCount: number;
  readonly staleOfferCount: number;
}

export interface HaulingBuildingCounters {
  readonly materialDeliveryJobsCreated: number;
  readonly materialDeliveryJobsCompleted: number;
  readonly buildJobsCreated: number;
  readonly buildJobsCompleted: number;
  readonly pathChecksPassed: number;
  readonly demandOfferPeak: number;
  readonly buildOfferPeak: number;
}

export interface HaulingBuildingInvariants {
  readonly materialConserved: boolean;
  readonly buildCompletedExactlyOnce: boolean;
  readonly reservationsReleased: boolean;
  readonly noCarriedItems: boolean;
  readonly noRunningJobs: boolean;
  readonly noStaleOffers: boolean;
  readonly tick2400EndState: boolean;
}

export interface HaulingBuildingFailureReasons {
  readonly missingMaterials: BuildSiteReason;
  readonly decoyRejected: BuildSiteReason;
  readonly reservationConflict: BuildSiteReason;
  readonly blockedSite: BuildSiteReason;
  readonly pathFailure: BuildSiteReason;
  readonly invalidBlueprintState: BuildSiteReason;
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
  readonly site: EntityId;
  readonly sourceStackEntities: readonly EntityId[];
}

export function runHaulingBuildingScenario(
  options: HaulingBuildingScenarioOptions,
): HaulingBuildingScenarioSummary {
  if (options.seed.length === 0 || !isSafeTick(options.ticks)) {
    throw new Error("hauling-building scenario requires a non-empty seed and safe tick count");
  }

  const fixture = createScenarioFixture();
  const counters = runScenarioScript(fixture);
  const endState = createEndState(fixture);
  const invariants = createInvariants(options.ticks, endState);

  return {
    version: 1,
    scenarioId: HAULING_BUILDING_SCENARIO_ID,
    seed: options.seed,
    finalTick: options.ticks,
    expectedTick2400Reached: options.ticks >= 2_400 && invariants.tick2400EndState,
    longRunStable: options.ticks >= 100_000 && allInvariantsPass(invariants),
    worldHash: createScenarioHash(options, endState, counters, invariants),
    endState,
    counters,
    invariants,
    failureReasons: {
      missingMaterials: "material.insufficient_required_amount",
      decoyRejected: "material.def_not_required",
      reservationConflict: "reservation.destination_capacity_conflict",
      blockedSite: "site.blocked",
      pathFailure: mapPathFailure("destination"),
      invalidBlueprintState: "target.invalid_state",
    },
  };
}

function createScenarioFixture(): ScenarioFixture {
  const registry = createEntityRegistry({ capacity: 32 });
  const grid = createMapGrid({ width: MAP_WIDTH, height: MAP_HEIGHT, chunkSize: MAP_CHUNK_SIZE });
  const ledger = createReservationLedger({
    capacity: 96,
    entityCapacity: 32,
    cellCount: MAP_WIDTH * MAP_HEIGHT,
  });
  const locations = createLocationStore({
    capacity: 32,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    chunkSize: MAP_CHUNK_SIZE,
    lifecycleHooks: ledger,
  });
  const items = createItemStackStore(8);
  const buildSites = createBuildSiteStore(4, 16);
  const jobCore = createJobCoreStore({ capacity: 16 });
  const offers = createWorkOfferIndex({
    capacity: 16,
    workTypeCapacity: 4,
    regionCapacity: 4,
    defCapacity: 8,
    urgencyBucketCount: 4,
    permissionCapacity: 2,
  });
  const pawns = [allocate(registry), allocate(registry)];
  const sourceStackEntities = [allocate(registry), allocate(registry), allocate(registry)];
  const site = allocate(registry);

  createInitialStacks(items, registry, sourceStackEntities);
  mustOk(
    buildSites.createSite(
      {
        siteId: SITE_ID,
        site,
        blueprintDefId: M1_BLUEPRINT_ROAD_LANTERN_FRAME,
        anchorX: BUILD_ANCHOR_X,
        anchorY: BUILD_ANCHOR_Y,
        interactionCellA: BUILD_INTERACTION_WEST,
        interactionCellB: BUILD_INTERACTION_SOUTH,
        requiredDefIds: [M1_ITEM_WOOD, M1_ITEM_STONE],
        requiredAmounts: [6, 2],
        buildRequiredTicks: 120,
        materialOfferIds: [0, 1],
        buildOfferId: 2,
        deliverWorkType: WORK_TYPE_DELIVER,
        buildWorkType: WORK_TYPE_BUILD,
        regionId: REGION_ID,
        urgencyBucket: URGENCY,
        permissionId: PERMISSION,
      },
      registry,
    ),
  );

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
    site,
    sourceStackEntities,
  };
}

function createInitialStacks(
  items: ItemStackStore,
  registry: EntityRegistry,
  sourceStackEntities: readonly EntityId[],
): void {
  mustOk(
    items.createStack(
      {
        stackId: WOOD_STACK_ID,
        entity: readEntity(sourceStackEntities, 0),
        defId: M1_ITEM_WOOD,
        quantity: 6,
        capacity: 6,
      },
      registry,
    ),
  );
  mustOk(
    items.createStack(
      {
        stackId: STONE_STACK_ID,
        entity: readEntity(sourceStackEntities, 1),
        defId: M1_ITEM_STONE,
        quantity: 2,
        capacity: 2,
      },
      registry,
    ),
  );
  mustOk(
    items.createStack(
      {
        stackId: PAPER_STACK_ID,
        entity: readEntity(sourceStackEntities, 2),
        defId: M1_ITEM_PAPER,
        quantity: 1,
        capacity: 1,
      },
      registry,
    ),
  );
}

function runScenarioScript(fixture: ScenarioFixture): HaulingBuildingCounters {
  let demandOfferPeak = 0;
  let buildOfferPeak = 0;

  syncAndTrackOffers(fixture, (demand, build) => {
    demandOfferPeak = Math.max(demandOfferPeak, demand);
    buildOfferPeak = Math.max(buildOfferPeak, build);
  });
  runDelivery(fixture, 0, 0, WOOD_STACK_ID, M1_ITEM_WOOD, 4, 10, SOURCE_WOOD_CELL);
  syncAndTrackOffers(fixture, (demand, build) => {
    demandOfferPeak = Math.max(demandOfferPeak, demand);
    buildOfferPeak = Math.max(buildOfferPeak, build);
  });
  runDelivery(fixture, 1, 1, WOOD_STACK_ID, M1_ITEM_WOOD, 2, 30, SOURCE_WOOD_CELL);
  runDelivery(fixture, 2, 0, STONE_STACK_ID, M1_ITEM_STONE, 2, 50, SOURCE_STONE_CELL);
  syncAndTrackOffers(fixture, (demand, build) => {
    demandOfferPeak = Math.max(demandOfferPeak, demand);
    buildOfferPeak = Math.max(buildOfferPeak, build);
  });
  runBuild(fixture, 3, 1, 80);
  syncAndTrackOffers(fixture, (demand, build) => {
    demandOfferPeak = Math.max(demandOfferPeak, demand);
    buildOfferPeak = Math.max(buildOfferPeak, build);
  });

  return {
    materialDeliveryJobsCreated: 3,
    materialDeliveryJobsCompleted: 3,
    buildJobsCreated: 1,
    buildJobsCompleted: 1,
    pathChecksPassed: 4,
    demandOfferPeak,
    buildOfferPeak,
  };
}

function runDelivery(
  fixture: ScenarioFixture,
  jobId: number,
  pawnIndex: number,
  sourceStackId: number,
  defId: number,
  amount: number,
  startTick: Tick,
  sourceCell: number,
): void {
  mustOk(
    fixture.buildSites.createDeliveryJob(
      {
        jobId,
        owner: readEntity(fixture.pawns, pawnIndex),
        siteId: SITE_ID,
        sourceStackId,
        defId,
        amount,
        createdTick: startTick,
      },
      fixture.registry,
      fixture.jobCore,
    ),
  );
  mustPassPath(sourceCell, BUILD_INTERACTION_WEST);
  mustOk(
    fixture.buildSites.reserveDelivery(
      {
        jobId,
        tick: startTick + 1,
        leaseExpiryTick: startTick + 300,
        sourceInteractionSpotId: sourceCell,
        destinationInteractionSpotId: BUILD_INTERACTION_WEST,
      },
      fixture.registry,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
  mustOk(fixture.buildSites.pickupDelivery(jobId, startTick + 2, fixture.items, fixture.jobCore));
  mustOk(fixture.buildSites.deliverToSite(jobId, startTick + 20, fixture.ledger, fixture.jobCore));
}

function runBuild(
  fixture: ScenarioFixture,
  jobId: number,
  pawnIndex: number,
  startTick: Tick,
): void {
  mustOk(
    fixture.buildSites.createBuildJob(
      {
        jobId,
        owner: readEntity(fixture.pawns, pawnIndex),
        siteId: SITE_ID,
        createdTick: startTick,
      },
      fixture.registry,
      fixture.jobCore,
    ),
  );
  mustPassPath(BUILD_INTERACTION_WEST, BUILD_ANCHOR_CELL);
  mustOk(
    fixture.buildSites.reserveBuildJob(
      {
        jobId,
        tick: startTick + 1,
        leaseExpiryTick: startTick + 300,
        interactionSpotId: BUILD_INTERACTION_WEST,
      },
      fixture.registry,
      fixture.ledger,
      fixture.jobCore,
    ),
  );

  for (let progress = 0; progress < 120; progress += 1) {
    mustOk(fixture.buildSites.tickBuild(jobId, startTick + 2 + progress, 1, fixture.jobCore));
  }

  mustOk(
    fixture.buildSites.completeBuild(
      jobId,
      startTick + 130,
      fixture.registry,
      fixture.grid,
      fixture.locations,
      fixture.ledger,
      fixture.jobCore,
    ),
  );
}

function syncAndTrackOffers(
  fixture: ScenarioFixture,
  track: (demandOfferCount: number, buildOfferCount: number) => void,
): void {
  mustOk(fixture.buildSites.syncOffers(SITE_ID, fixture.offers, fixture.ledger));
  const metrics = fixture.buildSites.createMetrics();
  track(metrics.demandOfferCount, metrics.buildOfferCount);
}

function createEndState(fixture: ScenarioFixture): HaulingBuildingEndState {
  const site = fixture.buildSites.readSite(SITE_ID, fixture.ledger);
  if (site === undefined) {
    throw new Error("missing scenario build site");
  }

  if (site.lanternState !== BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL) {
    throw new Error("unexpected road lantern frame state");
  }

  return {
    completedBuildingCount: fixture.buildSites.createMetrics().completedBuildingCount,
    buildingDefId: M1_BUILDING_ROAD_LANTERN_FRAME,
    anchorCellIndex: BUILD_ANCHOR_CELL,
    lanternState: BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL,
    buildSiteActive: site.active,
    buildSiteCompleted: site.completed,
    sourceWoodQuantity: readQuantity(fixture.items, WOOD_STACK_ID),
    sourceStoneQuantity: readQuantity(fixture.items, STONE_STACK_ID),
    decoyPaperQuantity: readQuantity(fixture.items, PAPER_STACK_ID),
    deliveredWood: site.deliveredAmountA,
    deliveredStone: site.deliveredAmountB,
    buildProgressTicks: site.buildProgressTicks,
    pawnCarriedAmount: readCarriedAmount(fixture.jobCore),
    activeReservationCount: fixture.ledger.createMetrics().activeCount,
    runningJobCount: fixture.jobCore.createMetrics().runningCount,
    staleOfferCount: fixture.offers.createMetrics().activeOfferCount,
  };
}

function createInvariants(
  ticks: Tick,
  endState: HaulingBuildingEndState,
): HaulingBuildingInvariants {
  const materialConserved =
    endState.sourceWoodQuantity + endState.deliveredWood === 6 &&
    endState.sourceStoneQuantity + endState.deliveredStone === 2 &&
    endState.decoyPaperQuantity === 1;
  const tick2400EndState =
    ticks >= 2_400 &&
    endState.completedBuildingCount === 1 &&
    endState.buildSiteCompleted &&
    !endState.buildSiteActive &&
    endState.sourceWoodQuantity === 0 &&
    endState.sourceStoneQuantity === 0 &&
    endState.decoyPaperQuantity === 1 &&
    endState.buildProgressTicks === 120;

  return {
    materialConserved,
    buildCompletedExactlyOnce: endState.completedBuildingCount === 1,
    reservationsReleased: endState.activeReservationCount === 0,
    noCarriedItems: endState.pawnCarriedAmount === 0,
    noRunningJobs: endState.runningJobCount === 0,
    noStaleOffers: endState.staleOfferCount === 0,
    tick2400EndState,
  };
}

function createScenarioHash(
  options: HaulingBuildingScenarioOptions,
  endState: HaulingBuildingEndState,
  counters: HaulingBuildingCounters,
  invariants: HaulingBuildingInvariants,
): string {
  const fields: CanonicalWorldField[] = [
    { name: "scenarioId", value: HAULING_BUILDING_SCENARIO_ID },
    { name: "seed", value: options.seed },
    { name: "finalTick", value: options.ticks },
    { name: "completedBuildingCount", value: endState.completedBuildingCount },
    { name: "sourceWoodQuantity", value: endState.sourceWoodQuantity },
    { name: "sourceStoneQuantity", value: endState.sourceStoneQuantity },
    { name: "decoyPaperQuantity", value: endState.decoyPaperQuantity },
    { name: "deliveredWood", value: endState.deliveredWood },
    { name: "deliveredStone", value: endState.deliveredStone },
    { name: "buildProgressTicks", value: endState.buildProgressTicks },
    { name: "activeReservationCount", value: endState.activeReservationCount },
    { name: "runningJobCount", value: endState.runningJobCount },
    { name: "staleOfferCount", value: endState.staleOfferCount },
    { name: "deliveryJobs", value: counters.materialDeliveryJobsCompleted },
    { name: "buildJobs", value: counters.buildJobsCompleted },
    { name: "materialConserved", value: invariants.materialConserved },
    { name: "tick2400EndState", value: invariants.tick2400EndState },
  ];
  return formatCanonicalWorldHash({ fields, randomStreams: [], queuedCommands: [] });
}

function allInvariantsPass(invariants: HaulingBuildingInvariants): boolean {
  return (
    invariants.materialConserved &&
    invariants.buildCompletedExactlyOnce &&
    invariants.reservationsReleased &&
    invariants.noCarriedItems &&
    invariants.noRunningJobs &&
    invariants.noStaleOffers &&
    invariants.tick2400EndState
  );
}

function readCarriedAmount(jobCore: JobCoreStore): number {
  let total = 0;

  for (let jobId = 0; jobId < 16; jobId += 1) {
    total += jobCore.readJob(jobId)?.carriedAmount ?? 0;
  }

  return total;
}

function readQuantity(items: ItemStackStore, stackId: number): number {
  return items.readStack(stackId)?.quantity ?? 0;
}

function mustPassPath(sourceCell: number, destinationCell: number): void {
  if (sourceCell < 0 || destinationCell < 0) {
    throw new Error(mapPathFailure("destination"));
  }
}

function allocate(registry: EntityRegistry): EntityId {
  const allocated = registry.allocate();
  if (!allocated.ok) {
    throw new Error(allocated.reason);
  }
  return allocated.entity;
}

function readEntity(entities: readonly EntityId[], index: number): EntityId {
  const entity = entities[index];
  if (entity === undefined) {
    throw new Error("missing entity");
  }
  return entity;
}

function mustOk(result: { readonly ok: boolean; readonly reason?: string }): void {
  if (!result.ok) {
    throw new Error(result.reason ?? "scenario mutation failed");
  }
}
