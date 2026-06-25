import { describe, expect, it } from "vitest";

import {
  MAP_TERRAIN_BLOCKED,
  M3_FOOD_DEFAULT_CANDIDATE_CAP,
  M3_FOOD_DEFAULT_EXACT_PATH_CAP,
  M3_FOOD_DEFAULT_SELECTED_CAP,
  NEED_LANE_HUNGER,
  calculateM3FoodConservationTotal,
  createEntityRegistry,
  createGridPathfinder,
  createItemStackStore,
  createJobCoreStore,
  createM3EatingJobDriverStore,
  createM3FoodAvailabilityStore,
  createMapGrid,
  createNeedStore,
  createNeedUrgencyIndex,
  createPathVersionBasis,
  createReservationLedger,
  createStorageLogisticsIndex,
  createWorkOfferIndex,
  resolveM3FoodPathCandidate,
  type EntityId,
  type M3FoodPortionInput,
  type PathVersionBasis,
  type StorageSlotInput,
} from "./index";

describe("M3 food availability and eating logistics", () => {
  it("selects edible resources through bounded indexed candidates and Top-K path evidence", () => {
    const fixture = createFoodFixture(30);
    const grid = createMapGrid({ width: 8, height: 4, chunkSize: 4 });
    const pathfinder = createGridPathfinder(grid.cellCount);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);

    const selected = resolveM3FoodPathCandidate(fixture.food, pathfinder, grid, {
      originCellIndex: 0,
      query: {
        foodDefId: GRAIN_BOWL,
        regionId: REGION_YARD,
        permissionId: PUBLIC_PERMISSION,
        mealWindowId: MIDDAY_MEAL,
        candidateCap: M3_FOOD_DEFAULT_CANDIDATE_CAP,
        maxSelected: M3_FOOD_DEFAULT_SELECTED_CAP,
      },
      maxExactPaths: M3_FOOD_DEFAULT_EXACT_PATH_CAP,
      basis: createBasis(grid),
      issuedTick: 10,
      requestSequenceStart: 1,
      stackIdBuffer: new Uint32Array(M3_FOOD_DEFAULT_SELECTED_CAP),
    });

    expect(selected).toMatchObject({
      ok: true,
      stackId: 0,
      candidateCount: 30,
      visitedCount: 24,
      selectedCount: 12,
      exactPathCount: 4,
      candidateCapHit: true,
      exactPathCapHit: true,
      reason: "trace.candidate_cap_reached",
    });
    expect(fixture.food.createMetrics()).toMatchObject({
      indexedCandidateCount: 30,
      lastCandidateCount: 30,
      lastVisitedCount: 24,
      lastSelectedCount: 12,
      lastExactPathCount: 4,
      lastCandidateCapHit: true,
    });
  });

  it("reserves item quantity and interaction spot atomically before pickup", () => {
    const fixture = createFoodFixture(1);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 0, 0)).toMatchObject({ ok: true });

    const stack = fixture.items.readStack(0) ?? failMissingStack();
    expect(
      fixture.ledger.acquire(
        {
          owner: fixture.actors[1] ?? failMissingEntity(),
          jobId: 99,
          createdTick: 1,
          leaseExpiryTick: 300,
          claims: [
            {
              channel: "interaction_spot",
              target: stack.entity,
              spotId: 20,
            },
          ],
        },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });

    expect(
      fixture.eating.reserveBeforePickup(
        0,
        2,
        fixture.registry,
        fixture.items,
        fixture.food,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "reservation.interaction_spot_conflict" });
    expect(fixture.ledger.createMetrics()).toMatchObject({
      activeCount: 1,
      itemQuantityReservationCount: 0,
      interactionReservationCount: 1,
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 1 });
    expect(fixture.eating.readJob(0)).toMatchObject({ step: "created", carriedAmount: 0 });
  });

  it("consumes exactly one integer portion once and conserves storage carried consumed lanes", () => {
    const fixture = createFoodFixture(1, 3);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(totalFood(fixture)).toBe(3);

    expect(reserve(fixture, 0, 1)).toMatchObject({ ok: true, reason: "food.job_reserved" });
    expect(pickup(fixture, 0, 2)).toMatchObject({ ok: true, reason: "food.job_picked_up" });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(totalFood(fixture)).toBe(3);

    expect(
      fixture.eating.consume(
        0,
        3,
        fixture.needs,
        fixture.ledger,
        fixture.jobCore,
        fixture.needIndex,
      ),
    ).toMatchObject({ ok: true, reason: "food.consumed_integer_portion" });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.eating.readJob(0)).toMatchObject({
      step: "consumed",
      carriedAmount: 0,
      consumedDefId: GRAIN_BOWL,
      consumedAmount: 1,
      terminalReason: "food.consumed_integer_portion",
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({ status: "completed", carriedAmount: 0 });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.needs.readLaneValue(0, NEED_LANE_HUNGER)).toBe(360);
    expect(totalFood(fixture)).toBe(3);

    expect(
      fixture.eating.consume(0, 4, fixture.needs, fixture.ledger, fixture.jobCore),
    ).toStrictEqual({ ok: false, reason: "eating_step_invalid" });
    expect(totalFood(fixture)).toBe(3);
  });

  it("returns carried food and releases reservations on cancellation after pickup", () => {
    const fixture = createFoodFixture(1, 2);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(reserve(fixture, 0, 1)).toMatchObject({ ok: true });
    expect(pickup(fixture, 0, 2)).toMatchObject({ ok: true });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 1 });

    expect(
      fixture.eating.cancel(
        0,
        3,
        fixture.items,
        fixture.food,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "food.job_canceled" });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.eating.readJob(0)).toMatchObject({
      step: "canceled",
      carriedAmount: 0,
      consumedAmount: 0,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(totalFood(fixture)).toBe(2);
  });

  it("rejects out-of-range hunger restore before job state can split", () => {
    const fixture = createFoodFixture(1, 2);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);

    expect(createEatingJobFromPortion(fixture, 0, 0, 0, true, 0xffff_ffff)).toStrictEqual({
      ok: false,
      reason: "eating_need_delta_invalid",
    });

    expect(fixture.eating.readJob(0)).toBeUndefined();
    expect(fixture.jobCore.readJob(0)).toBeUndefined();
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.needs.readLaneValue(0, NEED_LANE_HUNGER)).toBe(280);
    expect(totalFood(fixture)).toBe(2);
  });

  it("does not complete or release reservations when consume need validation fails", () => {
    const fixture = createFoodFixture(1, 2);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 1, 0)).toMatchObject({ ok: true });
    expect(reserve(fixture, 0, 1)).toMatchObject({ ok: true });
    expect(pickup(fixture, 0, 2)).toMatchObject({ ok: true });

    expect(
      fixture.eating.consume(0, 3, fixture.needs, fixture.ledger, fixture.jobCore),
    ).toStrictEqual({ ok: false, reason: "eating_need_mutation_failed" });

    expect(fixture.eating.readJob(0)).toMatchObject({
      step: "picked_up",
      carriedDefId: GRAIN_BOWL,
      carriedAmount: 1,
      consumedAmount: 0,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({
      status: "running",
      step: "interact",
      carriedDefId: GRAIN_BOWL,
      carriedAmount: 1,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 1 });
    expect(totalFood(fixture)).toBe(2);
  });

  it("emits structured no-food permission schedule ability stale-owner and path reasons", () => {
    const emptyFixture = createFoodFixture(0);
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    expect(
      resolveM3FoodPathCandidate(emptyFixture.food, createGridPathfinder(grid.cellCount), grid, {
        originCellIndex: 0,
        query: {
          foodDefId: GRAIN_BOWL,
          regionId: REGION_YARD,
          permissionId: PUBLIC_PERMISSION,
          mealWindowId: MIDDAY_MEAL,
          candidateCap: 4,
          maxSelected: 2,
        },
        maxExactPaths: 2,
        basis: createBasis(grid),
        issuedTick: 0,
        requestSequenceStart: 1,
        stackIdBuffer: new Uint32Array(2),
      }),
    ).toMatchObject({ ok: false, reason: "food.rejected_no_available_portion" });

    const permissionFixture = createFoodFixture(1, 1, { permissionAllowed: false });
    permissionFixture.food.rebuildFromStores(permissionFixture.items, permissionFixture.ledger);
    expect(createEatingJobFromPortion(permissionFixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(reserve(permissionFixture, 0, 1)).toStrictEqual({
      ok: false,
      reason: "food.rejected_permission",
    });

    const scheduleFixture = createFoodFixture(1, 1, { scheduleAllowed: false });
    scheduleFixture.food.rebuildFromStores(scheduleFixture.items, scheduleFixture.ledger);
    expect(createEatingJobFromPortion(scheduleFixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(reserve(scheduleFixture, 0, 1)).toStrictEqual({
      ok: false,
      reason: "food.rejected_schedule",
    });

    const abilityFixture = createFoodFixture(1);
    abilityFixture.food.rebuildFromStores(abilityFixture.items, abilityFixture.ledger);
    expect(createEatingJobFromPortion(abilityFixture, 0, 0, 0, false)).toStrictEqual({
      ok: false,
      reason: "food.rejected_ability",
    });

    const staleFixture = createFoodFixture(1);
    staleFixture.food.rebuildFromStores(staleFixture.items, staleFixture.ledger);
    expect(createEatingJobFromPortion(staleFixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(staleFixture.items.addQuantity(0, 1, GRAIN_BOWL)).toMatchObject({ ok: true });
    staleFixture.food.markStackDirty(0);
    staleFixture.food.refreshDirty(staleFixture.items, staleFixture.ledger, 1);
    expect(reserve(staleFixture, 0, 2)).toStrictEqual({
      ok: false,
      reason: "food.rejected_stale_owner",
    });

    const blockedGrid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    expect(blockedGrid.updateCell(1, 0, { terrain: MAP_TERRAIN_BLOCKED })).toMatchObject({
      ok: true,
    });
    const pathFixture = createFoodFixture(1, 1, { targetCellIndex: 1 });
    pathFixture.food.rebuildFromStores(pathFixture.items, pathFixture.ledger);
    expect(
      resolveM3FoodPathCandidate(
        pathFixture.food,
        createGridPathfinder(blockedGrid.cellCount),
        blockedGrid,
        {
          originCellIndex: 0,
          query: {
            foodDefId: GRAIN_BOWL,
            regionId: REGION_YARD,
            permissionId: PUBLIC_PERMISSION,
            mealWindowId: MIDDAY_MEAL,
            candidateCap: 4,
            maxSelected: 2,
          },
          maxExactPaths: 2,
          basis: createBasis(blockedGrid),
          issuedTick: 0,
          requestSequenceStart: 1,
          stackIdBuffer: new Uint32Array(2),
        },
      ),
    ).toMatchObject({
      ok: false,
      reason: "path.no_route_to_food",
      pathReason: "path_goal_blocked",
      exactPathCount: 1,
    });
  });
});

const GRAIN_BOWL = 1;
const REGION_YARD = 0;
const PUBLIC_PERMISSION = 0;
const MIDDAY_MEAL = 1;

interface FoodFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly food: ReturnType<typeof createM3FoodAvailabilityStore>;
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly jobCore: ReturnType<typeof createJobCoreStore>;
  readonly eating: ReturnType<typeof createM3EatingJobDriverStore>;
  readonly needs: ReturnType<typeof createNeedStore>;
  readonly needIndex: ReturnType<typeof createNeedUrgencyIndex>;
  readonly actors: readonly EntityId[];
}

function createFoodFixture(
  stackCount: number,
  quantity = 1,
  overrides: Partial<M3FoodPortionInput> = {},
): FoodFixture {
  const capacity = Math.max(1, stackCount);
  const registry = createEntityRegistry({ capacity: 96 });
  const actors = [allocate(registry), allocate(registry)];
  const stackEntities = allocateMany(registry, capacity);
  const storageEntities = allocateMany(registry, capacity);
  const items = createItemStackStore(capacity);
  const storage = createStorageLogisticsIndex(capacity, capacity, 4);
  const offers = createWorkOfferIndex({
    capacity,
    workTypeCapacity: 2,
    regionCapacity: 4,
    defCapacity: 4,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });
  const food = createM3FoodAvailabilityStore(capacity, 4, 4);
  const ledger = createReservationLedger({ capacity: 128, entityCapacity: 96, cellCount: 64 });
  const jobCore = createJobCoreStore({ capacity: 8 });
  const eating = createM3EatingJobDriverStore(8);
  const needs = createNeedStore({ actorCapacity: 8, updateIntervalTicks: 8 });
  const needIndex = createNeedUrgencyIndex({ actorCapacity: 8 });

  expect(
    needs.registerActor({
      actorId: 0,
      hunger: 280,
      rest: 500,
      comfort: 650,
      social: 520,
      safety: 700,
      sourceTick: 0,
    }),
  ).toMatchObject({ ok: true });

  for (let stackId = 0; stackId < stackCount; stackId += 1) {
    const stackEntity = stackEntities[stackId] ?? failMissingEntity();
    const storageEntity = storageEntities[stackId] ?? failMissingEntity();
    expect(
      items.createStack(
        {
          stackId,
          entity: stackEntity,
          defId: GRAIN_BOWL,
          quantity,
          capacity: quantity + 8,
        },
        registry,
      ),
    ).toMatchObject({ ok: true });
    expect(
      storage.configureSlot(createSlot(stackId, storageEntity, quantity + 8), registry),
    ).toMatchObject({
      ok: true,
    });
    expect(
      food.configurePortion({
        stackId,
        foodDefId: GRAIN_BOWL,
        regionId: REGION_YARD,
        storageSlotId: stackId,
        targetCellIndex: overrides.targetCellIndex ?? stackId % 16,
        interactionSpotId: 20,
        scoreMilli: 10_000 - stackId,
        permissionId: PUBLIC_PERMISSION,
        mealWindowId: MIDDAY_MEAL,
        mealWindowVersion: 1,
        safe: true,
        permissionAllowed: true,
        scheduleAllowed: true,
        ...overrides,
      }),
    ).toMatchObject({ ok: true });
  }

  storage.refreshDirty(items, ledger, offers, capacity);
  return {
    registry,
    items,
    food,
    storage,
    offers,
    ledger,
    jobCore,
    eating,
    needs,
    needIndex,
    actors,
  };
}

function createEatingJobFromPortion(
  fixture: FoodFixture,
  jobId: number,
  actorIndex: number,
  stackId: number,
  abilityAllowed = true,
  hungerRestore = 80,
): ReturnType<FoodFixture["eating"]["createJob"]> {
  const portion = fixture.food.readPortion(stackId) ?? failMissingPortion();
  return fixture.eating.createJob(
    {
      jobId,
      owner: fixture.actors[actorIndex] ?? failMissingEntity(),
      sourceStackId: stackId,
      storageSlotId: portion.storageSlotId,
      foodDefId: portion.foodDefId,
      amount: 1,
      hungerRestore,
      itemStoreVersion: portion.itemStoreVersion,
      foodAvailabilityVersion: portion.foodAvailabilityVersion,
      mealWindowVersion: portion.mealWindowVersion,
      abilityAllowed,
      createdTick: 0,
    },
    fixture.registry,
    fixture.jobCore,
  );
}

function reserve(
  fixture: FoodFixture,
  jobId: number,
  tick: number,
): ReturnType<FoodFixture["eating"]["reserveBeforePickup"]> {
  return fixture.eating.reserveBeforePickup(
    jobId,
    tick,
    fixture.registry,
    fixture.items,
    fixture.food,
    fixture.storage,
    fixture.ledger,
    fixture.jobCore,
  );
}

function pickup(
  fixture: FoodFixture,
  jobId: number,
  tick: number,
): ReturnType<FoodFixture["eating"]["pickup"]> {
  return fixture.eating.pickup(
    jobId,
    tick,
    fixture.items,
    fixture.food,
    fixture.storage,
    fixture.jobCore,
  );
}

function totalFood(fixture: FoodFixture): number {
  return calculateM3FoodConservationTotal(
    fixture.items,
    fixture.eating,
    GRAIN_BOWL,
    fixture.items.capacity,
  );
}

function createSlot(slotId: number, storageEntity: EntityId, capacity: number): StorageSlotInput {
  return {
    slotId,
    storage: storageEntity,
    stackId: slotId,
    defId: GRAIN_BOWL,
    capacity,
    desiredQuantity: 0,
    interactionCellIndex: 20,
    offerId: slotId,
    workType: 0,
    regionId: REGION_YARD,
    urgencyBucket: 0,
    permissionId: PUBLIC_PERMISSION,
  };
}

function createBasis(grid: ReturnType<typeof createMapGrid>): PathVersionBasis {
  return createPathVersionBasis(grid, {
    navigationVersion: 1,
    regionVersion: 1,
    roomVersion: 1,
    regionGraphVersion: 1,
  });
}

function allocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.entity;
}

function allocateMany(
  registry: ReturnType<typeof createEntityRegistry>,
  count: number,
): readonly EntityId[] {
  const entities: EntityId[] = [];
  for (let index = 0; index < count; index += 1) {
    entities.push(allocate(registry));
  }
  return entities;
}

function failMissingEntity(): never {
  throw new Error("missing entity");
}

function failMissingStack(): never {
  throw new Error("missing stack");
}

function failMissingPortion(): never {
  throw new Error("missing portion");
}
