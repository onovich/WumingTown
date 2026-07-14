import { describe, expect, it } from "vitest";

import {
  BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL,
  HAULING_BUILDING_SCENARIO_ID,
  MAP_TERRAIN_BLOCKED,
  M1_ITEM_PAPER,
  M1_ITEM_STONE,
  M1_ITEM_WOOD,
  createBuildSiteStore,
  createEntityRegistry,
  createGridPathfinder,
  createItemStackStore,
  createJobCoreStore,
  createLocationStore,
  createMapGrid,
  createPathVersionBasis,
  createReservationLedger,
  createWorkOfferIndex,
  mapPathFailure,
  runHaulingBuildingScenario,
  type EntityId,
} from "./index";
import {
  M2_WORK_LOGISTICS_SCENARIO_ID,
  runM2WorkLogisticsScenario,
} from "./m2-work-logistics-scenario";

describe("minimal build-site material delivery and construction", () => {
  it("registers material demand offers and gates build offers until buffers are full", () => {
    const fixture = createFixture();

    expect(fixture.buildSites.syncOffers(0, fixture.offers, fixture.ledger)).toMatchObject({
      ok: true,
    });
    expect(fixture.buildSites.createMetrics()).toMatchObject({
      demandOfferCount: 2,
      buildOfferCount: 0,
    });
    expect(fixture.buildSites.readBuildOrder(0, fixture.ledger)).toMatchObject({
      orderId: 0,
      active: true,
      completed: false,
      remainingDemandA: 6,
      remainingDemandB: 2,
      materialDemandOfferAActive: true,
      materialDemandOfferBActive: true,
      buildOfferActive: false,
      buildProgressTicks: 0,
      buildRequiredTicks: 120,
    });
    expect(fixture.offers.createMetrics().activeOfferCount).toBe(2);
    expect(
      fixture.buildSites.createBuildJob(
        {
          jobId: 6,
          owner: fixture.pawns[0] ?? failMissingEntity(),
          siteId: 0,
          createdTick: 1,
        },
        fixture.registry,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "material.insufficient_required_amount" });
  });

  it("converts carried material into site inventory exactly once", () => {
    const fixture = createFixture();

    runDelivery(fixture, 0, 0, WOOD_STACK_ID, M1_ITEM_WOOD, 4, 10);

    expect(fixture.items.readStack(WOOD_STACK_ID)).toMatchObject({ quantity: 2 });
    expect(fixture.buildSites.readSite(0, fixture.ledger)).toMatchObject({
      deliveredAmountA: 4,
      remainingDemandA: 2,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.jobCore.readJob(0)).toMatchObject({ carriedAmount: 0, status: "completed" });

    expect(fixture.buildSites.deliverToSite(0, 31, fixture.ledger, fixture.jobCore)).toStrictEqual({
      ok: false,
      reason: "site.job_step_invalid",
    });
    expect(fixture.buildSites.readSite(0, fixture.ledger)).toMatchObject({ deliveredAmountA: 4 });
    expect(totalMaterial(fixture)).toBe(9);
  });

  it("uses integer build ticks and commits one road lantern frame result", () => {
    const fixture = createFixture();

    deliverAllMaterials(fixture);
    expect(fixture.buildSites.syncOffers(0, fixture.offers, fixture.ledger)).toMatchObject({
      ok: true,
    });
    expect(fixture.buildSites.createMetrics()).toMatchObject({
      demandOfferCount: 0,
      buildOfferCount: 1,
    });

    runBuild(fixture, 4, 0, 100);
    expect(fixture.buildSites.syncOffers(0, fixture.offers, fixture.ledger)).toMatchObject({
      ok: true,
    });

    const site = fixture.buildSites.readSite(0, fixture.ledger);
    expect(site).toMatchObject({
      active: false,
      completed: true,
      buildProgressTicks: 120,
      lanternState: BUILD_SITE_LANTERN_STATE_UNLIT_PENDING_FUEL,
    });
    expect(fixture.grid.readCell(12, 7)).toMatchObject({ ok: true, cell: { occupancy: 7 } });
    expect(fixture.buildSites.createMetrics()).toMatchObject({ completedBuildingCount: 1 });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.jobCore.createMetrics().runningCount).toBe(0);
    expect(fixture.offers.createMetrics().activeOfferCount).toBe(0);
    expect(fixture.buildSites.readBuildOrder(0, fixture.ledger)).toMatchObject({
      active: false,
      completed: true,
      remainingDemandA: 0,
      remainingDemandB: 0,
      materialDemandOfferAActive: false,
      materialDemandOfferBActive: false,
      buildOfferActive: false,
      buildProgressTicks: 120,
    });
  });

  it("distinguishes missing material, decoy, reservation, path, blocked and invalid states", () => {
    const fixture = createFixture(8);

    expect(
      fixture.buildSites.createBuildJob(
        {
          jobId: 0,
          owner: fixture.pawns[0] ?? failMissingEntity(),
          siteId: 0,
          createdTick: 1,
        },
        fixture.registry,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "material.insufficient_required_amount" });

    expect(
      fixture.buildSites.createDeliveryJob(
        {
          jobId: 1,
          owner: fixture.pawns[0] ?? failMissingEntity(),
          siteId: 0,
          sourceStackId: PAPER_STACK_ID,
          defId: M1_ITEM_PAPER,
          amount: 1,
          createdTick: 2,
        },
        fixture.registry,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "material.def_not_required" });

    reserveDeliveryOnly(fixture, 2, 0, WOOD_STACK_ID, M1_ITEM_WOOD, 6, 3);
    const extraWood = allocate(fixture.registry);
    createStack(fixture.items, fixture.registry, EXTRA_WOOD_STACK_ID, extraWood, M1_ITEM_WOOD, 1);
    expect(
      fixture.buildSites.createDeliveryJob(
        {
          jobId: 3,
          owner: fixture.pawns[1] ?? failMissingEntity(),
          siteId: 0,
          sourceStackId: EXTRA_WOOD_STACK_ID,
          defId: M1_ITEM_WOOD,
          amount: 1,
          createdTick: 4,
        },
        fixture.registry,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.buildSites.reserveDelivery(
        {
          jobId: 3,
          tick: 5,
          leaseExpiryTick: 90,
          sourceInteractionSpotId: 21,
          destinationInteractionSpotId: 140,
        },
        fixture.registry,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "reservation.destination_capacity_conflict" });

    expect(readPathFailure()).toBe("path.no_route_to_destination");
    expect(createInvalidBlueprintFixture()).toStrictEqual({
      ok: false,
      reason: "target.invalid_state",
    });

    const blocked = createFixture();
    deliverAllMaterials(blocked);
    startBuildAndTickToReady(blocked, 4, 0, 100);
    expect(blocked.grid.updateCell(12, 7, { occupancy: 99 })).toMatchObject({ ok: true });
    expect(
      blocked.buildSites.completeBuild(
        4,
        230,
        blocked.registry,
        blocked.grid,
        blocked.locations,
        blocked.ledger,
        blocked.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "site.blocked" });
  });

  it("m2-build-production-orders releases reservations when reserve transitions fail", () => {
    const deliveryFixture = createFixture();
    const rejectedTick = 0;

    expect(
      deliveryFixture.buildSites.createDeliveryJob(
        {
          jobId: 0,
          owner: deliveryFixture.pawns[0] ?? failMissingEntity(),
          siteId: 0,
          sourceStackId: WOOD_STACK_ID,
          defId: M1_ITEM_WOOD,
          amount: 4,
          createdTick: 1,
        },
        deliveryFixture.registry,
        deliveryFixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      deliveryFixture.buildSites.reserveDelivery(
        {
          jobId: 0,
          tick: rejectedTick,
          leaseExpiryTick: rejectedTick + 100,
          sourceInteractionSpotId: 20,
          destinationInteractionSpotId: 123,
        },
        deliveryFixture.registry,
        deliveryFixture.items,
        deliveryFixture.ledger,
        deliveryFixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "job_core.failed" });
    expect(deliveryFixture.ledger.createMetrics()).toMatchObject({
      activeCount: 0,
      acquiredCount: 4,
      releasedCount: 4,
    });
    expect(deliveryFixture.buildSites.readJob(0)).toMatchObject({ step: "created" });
    expect(deliveryFixture.buildSites.readBuildOrder(0, deliveryFixture.ledger)).toMatchObject({
      reservedCapacityA: 0,
    });

    const buildFixture = createFixture();
    deliverAllMaterials(buildFixture);
    expect(
      buildFixture.buildSites.createBuildJob(
        {
          jobId: 4,
          owner: buildFixture.pawns[1] ?? failMissingEntity(),
          siteId: 0,
          createdTick: 100,
        },
        buildFixture.registry,
        buildFixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      buildFixture.buildSites.reserveBuildJob(
        {
          jobId: 4,
          tick: rejectedTick,
          leaseExpiryTick: rejectedTick + 100,
          interactionSpotId: 123,
        },
        buildFixture.registry,
        buildFixture.ledger,
        buildFixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "job_core.failed" });
    expect(buildFixture.ledger.createMetrics()).toMatchObject({
      activeCount: 0,
      acquiredCount: 14,
      releasedCount: 14,
    });
    expect(buildFixture.buildSites.readJob(4)).toMatchObject({ step: "created" });
  });

  it("m2-build-production-orders reports explicit policy interruption failures", () => {
    const fixture = createFixture();

    deliverAllMaterials(fixture);
    expect(
      fixture.buildSites.createBuildJob(
        {
          jobId: 4,
          owner: fixture.pawns[0] ?? failMissingEntity(),
          siteId: 0,
          createdTick: 100,
        },
        fixture.registry,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.buildSites.requestInterruption(
        {
          jobId: 4,
          kind: "immediate",
          tick: 101,
        },
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "policy.interruption_denied" });
    expect(fixture.buildSites.readJob(4)).toMatchObject({ step: "created" });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
  });

  it("m2-build-production-orders runs the focused M2 scaffold scenario", () => {
    const summary = runM2WorkLogisticsScenario({ seed: "2", ticks: 20_000 });

    expect(summary.scenarioId).toBe(M2_WORK_LOGISTICS_SCENARIO_ID);
    expect(summary.finalTick).toBe(20_000);
    expect(summary.actorCount).toBe(20);
    expect(summary.endState).toMatchObject({
      completedBuildOrders: 4,
      activeReservations: 0,
      activeOffers: 0,
      runningJobs: 0,
      sourceWoodQuantity: 0,
      sourceStoneQuantity: 0,
      decoyPaperQuantity: 1,
    });
    expect(summary.invariants).toMatchObject({
      allOrdersCompleted: true,
      materialConserved: true,
      reservationsReleased: true,
      offersCleared: true,
      noRunningJobs: true,
      tick20000EndState: true,
    });
    expect(summary.failureReasons).toMatchObject({
      missingMaterials: "material.insufficient_required_amount",
      invalidTarget: "target.invalid_state",
      blockedSite: "site.blocked",
      reservationConflict: "reservation.destination_capacity_conflict",
      pathFailure: "path.no_route_to_destination",
      policyFailure: "policy.interruption_denied",
    });
  });

  it("runs the M1 hauling-building scenario to the required stable end state", () => {
    const summary = runHaulingBuildingScenario({ seed: "1", ticks: 100_000 });

    expect(summary.scenarioId).toBe(HAULING_BUILDING_SCENARIO_ID);
    expect(summary.finalTick).toBe(100_000);
    expect(summary.expectedTick2400Reached).toBe(true);
    expect(summary.longRunStable).toBe(true);
    expect(summary.idleWindow).toMatchObject({
      sampled: true,
      hashStable: true,
      noQueueGrowth: true,
      noStaleEntityReferences: true,
      maxActiveOfferCount: 0,
      maxActiveReservationCount: 0,
      maxRunningJobCount: 0,
    });
    expect(summary.endState).toMatchObject({
      completedBuildingCount: 1,
      sourceWoodQuantity: 0,
      sourceStoneQuantity: 0,
      decoyPaperQuantity: 1,
      deliveredWood: 6,
      deliveredStone: 2,
      pawnCarriedAmount: 0,
      activeReservationCount: 0,
      runningJobCount: 0,
      staleOfferCount: 0,
    });
    expect(summary.invariants).toMatchObject({
      materialConserved: true,
      buildCompletedExactlyOnce: true,
      reservationsReleased: true,
      noCarriedItems: true,
      noRunningJobs: true,
      noStaleOffers: true,
      tick2400EndState: true,
    });
    expect(summary.failureReasons).toMatchObject({
      missingMaterials: "material.insufficient_required_amount",
      decoyRejected: "material.def_not_required",
      reservationConflict: "reservation.destination_capacity_conflict",
      blockedSite: "site.blocked",
      pathFailure: "path.no_route_to_destination",
      invalidBlueprintState: "target.invalid_state",
    });
  });
});

const WOOD_STACK_ID = 0;
const STONE_STACK_ID = 1;
const PAPER_STACK_ID = 2;
const EXTRA_WOOD_STACK_ID = 3;

interface Fixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly grid: ReturnType<typeof createMapGrid>;
  readonly locations: ReturnType<typeof createLocationStore>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly buildSites: ReturnType<typeof createBuildSiteStore>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly jobCore: ReturnType<typeof createJobCoreStore>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
  readonly pawns: readonly EntityId[];
  readonly stacks: readonly EntityId[];
  readonly site: EntityId;
}

function createFixture(woodQuantity = 6): Fixture {
  const registry = createEntityRegistry({ capacity: 32 });
  const grid = createMapGrid({ width: 16, height: 12, chunkSize: 8 });
  const ledger = createReservationLedger({ capacity: 96, entityCapacity: 32, cellCount: 192 });
  const locations = createLocationStore({
    capacity: 32,
    width: 16,
    height: 12,
    chunkSize: 8,
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
  const stacks = [allocate(registry), allocate(registry), allocate(registry)];
  const site = allocate(registry);

  createStack(
    items,
    registry,
    WOOD_STACK_ID,
    stacks[0] ?? failMissingEntity(),
    M1_ITEM_WOOD,
    woodQuantity,
  );
  createStack(items, registry, STONE_STACK_ID, stacks[1] ?? failMissingEntity(), M1_ITEM_STONE, 2);
  createStack(items, registry, PAPER_STACK_ID, stacks[2] ?? failMissingEntity(), M1_ITEM_PAPER, 1);
  expect(
    buildSites.createSite(
      {
        siteId: 0,
        site,
        blueprintDefId: 4,
        anchorX: 12,
        anchorY: 7,
        interactionCellA: 123,
        interactionCellB: 140,
        requiredDefIds: [M1_ITEM_WOOD, M1_ITEM_STONE],
        requiredAmounts: [6, 2],
        buildRequiredTicks: 120,
        materialOfferIds: [0, 1],
        buildOfferId: 2,
        deliverWorkType: 1,
        buildWorkType: 2,
        regionId: 0,
        urgencyBucket: 1,
        permissionId: 0,
      },
      registry,
    ),
  ).toMatchObject({ ok: true });

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
    stacks,
    site,
  };
}

function createStack(
  items: ReturnType<typeof createItemStackStore>,
  registry: ReturnType<typeof createEntityRegistry>,
  stackId: number,
  entity: EntityId,
  defId: number,
  quantity: number,
): void {
  expect(
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
  ).toMatchObject({ ok: true });
}

function runDelivery(
  fixture: Fixture,
  jobId: number,
  pawnIndex: number,
  sourceStackId: number,
  defId: number,
  amount: number,
  startTick: number,
): void {
  reserveDeliveryOnly(fixture, jobId, pawnIndex, sourceStackId, defId, amount, startTick);
  expect(
    fixture.buildSites.pickupDelivery(jobId, startTick + 2, fixture.items, fixture.jobCore),
  ).toMatchObject({ ok: true });
  expect(
    fixture.buildSites.deliverToSite(jobId, startTick + 20, fixture.ledger, fixture.jobCore),
  ).toMatchObject({ ok: true });
}

function reserveDeliveryOnly(
  fixture: Fixture,
  jobId: number,
  pawnIndex: number,
  sourceStackId: number,
  defId: number,
  amount: number,
  startTick: number,
): void {
  expect(
    fixture.buildSites.createDeliveryJob(
      {
        jobId,
        owner: fixture.pawns[pawnIndex] ?? failMissingEntity(),
        siteId: 0,
        sourceStackId,
        defId,
        amount,
        createdTick: startTick,
      },
      fixture.registry,
      fixture.jobCore,
    ),
  ).toMatchObject({ ok: true });
  expect(
    fixture.buildSites.reserveDelivery(
      {
        jobId,
        tick: startTick + 1,
        leaseExpiryTick: startTick + 100,
        sourceInteractionSpotId: 20 + jobId,
        destinationInteractionSpotId: 123,
      },
      fixture.registry,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
    ),
  ).toMatchObject({ ok: true });
}

function deliverAllMaterials(fixture: Fixture): void {
  runDelivery(fixture, 0, 0, WOOD_STACK_ID, M1_ITEM_WOOD, 4, 10);
  runDelivery(fixture, 1, 1, WOOD_STACK_ID, M1_ITEM_WOOD, 2, 40);
  runDelivery(fixture, 2, 0, STONE_STACK_ID, M1_ITEM_STONE, 2, 70);
}

function runBuild(fixture: Fixture, jobId: number, pawnIndex: number, startTick: number): void {
  startBuildAndTickToReady(fixture, jobId, pawnIndex, startTick);
  expect(
    fixture.buildSites.completeBuild(
      jobId,
      startTick + 130,
      fixture.registry,
      fixture.grid,
      fixture.locations,
      fixture.ledger,
      fixture.jobCore,
    ),
  ).toMatchObject({ ok: true });
}

function startBuildAndTickToReady(
  fixture: Fixture,
  jobId: number,
  pawnIndex: number,
  startTick: number,
): void {
  expect(
    fixture.buildSites.createBuildJob(
      {
        jobId,
        owner: fixture.pawns[pawnIndex] ?? failMissingEntity(),
        siteId: 0,
        createdTick: startTick,
      },
      fixture.registry,
      fixture.jobCore,
    ),
  ).toMatchObject({ ok: true });
  expect(
    fixture.buildSites.reserveBuildJob(
      {
        jobId,
        tick: startTick + 1,
        leaseExpiryTick: startTick + 200,
        interactionSpotId: 123,
      },
      fixture.registry,
      fixture.ledger,
      fixture.jobCore,
    ),
  ).toMatchObject({ ok: true });

  for (let tick = 0; tick < 120; tick += 1) {
    expect(
      fixture.buildSites.tickBuild(jobId, startTick + 2 + tick, 1, fixture.jobCore),
    ).toMatchObject({
      ok: true,
    });
  }
}

function readPathFailure(): string {
  const grid = createMapGrid({ width: 3, height: 3, chunkSize: 3 });
  expect(grid.updateCell(2, 2, { terrain: MAP_TERRAIN_BLOCKED })).toMatchObject({ ok: true });
  const pathfinder = createGridPathfinder(grid.cellCount);
  const result = pathfinder.findPath(grid, {
    requestSequence: 1,
    issuedTick: 1,
    startCellIndex: 0,
    goalCellIndex: 8,
    basis: createPathVersionBasis(grid, {
      navigationVersion: 0,
      regionVersion: 0,
      roomVersion: 0,
      regionGraphVersion: 0,
    }),
  });

  expect(result).toMatchObject({ ok: false, reason: "path_goal_blocked" });
  return mapPathFailure("destination");
}

function createInvalidBlueprintFixture(): ReturnType<
  ReturnType<typeof createBuildSiteStore>["createSite"]
> {
  const registry = createEntityRegistry({ capacity: 4 });
  const store = createBuildSiteStore(1, 1);
  const site = allocate(registry);
  return store.createSite(
    {
      siteId: 0,
      site,
      blueprintDefId: 4,
      anchorX: 0,
      anchorY: 0,
      interactionCellA: 1,
      interactionCellB: 2,
      requiredDefIds: [M1_ITEM_WOOD, M1_ITEM_STONE],
      requiredAmounts: [0, 2],
      buildRequiredTicks: 120,
      materialOfferIds: [0, 1],
      buildOfferId: 2,
      deliverWorkType: 1,
      buildWorkType: 2,
      regionId: 0,
      urgencyBucket: 1,
      permissionId: 0,
    },
    registry,
  );
}

function totalMaterial(fixture: Fixture): number {
  const site = fixture.buildSites.readSite(0, fixture.ledger);
  return (
    (fixture.items.readStack(WOOD_STACK_ID)?.quantity ?? 0) +
    (fixture.items.readStack(STONE_STACK_ID)?.quantity ?? 0) +
    (fixture.items.readStack(PAPER_STACK_ID)?.quantity ?? 0) +
    (site?.deliveredAmountA ?? 0) +
    (site?.deliveredAmountB ?? 0)
  );
}

function allocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const allocated = registry.allocate();
  if (!allocated.ok) {
    throw new Error(allocated.reason);
  }
  return allocated.entity;
}

function failMissingEntity(): never {
  throw new Error("missing entity");
}
