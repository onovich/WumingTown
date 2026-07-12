import { describe, expect, it } from "vitest";

import {
  MAP_TERRAIN_BLOCKED,
  M3_FOOD_DEFAULT_CANDIDATE_CAP,
  M3_FOOD_DEFAULT_EXACT_PATH_CAP,
  M3_FOOD_DEFAULT_SELECTED_CAP,
  M3_FOOD_STACK_NONE,
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
  it("reads reusable flat portion facts and exposes dirty backlog without a version advance", () => {
    const fixture = createFoodFixture(1, 3);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const output = createFoodPortionIntoOutput();
    const identity = output;
    const legacy = fixture.food.readPortion(0) ?? failMissingPortion();

    fixture.food.readPortionInto(0, output);
    expect(output).toEqual({
      ok: true,
      reason: undefined,
      ...legacy,
      active: true,
      dirtyBacklog: 0,
    });
    expect(output).toBe(identity);

    const versionBeforeDirty = fixture.food.version;
    expect(fixture.food.markStackDirty(0)).toEqual({
      ok: true,
      stackId: 0,
      version: versionBeforeDirty,
    });
    expect(fixture.food.version).toBe(versionBeforeDirty);
    fixture.food.readPortionInto(0, output);
    expect(output).toMatchObject({
      ok: true,
      reason: undefined,
      stackId: 0,
      foodAvailabilityVersion: versionBeforeDirty,
      active: true,
      linkedCandidate: true,
      dirtyBacklog: 1,
    });
    expect(output).toBe(identity);

    const dirtyStore = createM3FoodAvailabilityStore(2, 4, 4);
    expect(
      dirtyStore.configurePortion({
        stackId: 0,
        foodDefId: GRAIN_BOWL,
        regionId: REGION_YARD,
        storageSlotId: 0,
        targetCellIndex: 0,
        interactionSpotId: 20,
        scoreMilli: 10_000,
        permissionId: PUBLIC_PERMISSION,
        mealWindowId: MIDDAY_MEAL,
        mealWindowVersion: 1,
        safe: true,
        permissionAllowed: true,
        scheduleAllowed: true,
      }),
    ).toEqual({ ok: true, stackId: 0, version: 1 });
    expect(dirtyStore.createMetrics()).toMatchObject({ version: 1, dirtyBacklog: 1 });

    dirtyStore.readPortionInto(1, output);
    expect(output).toEqual({
      ok: false,
      reason: "food_stack_not_registered",
      stackId: 1,
      foodDefId: 0,
      regionId: 0,
      storageSlotId: 0,
      targetCellIndex: 0,
      interactionSpotId: 0,
      scoreMilli: 0,
      permissionId: 0,
      mealWindowId: 0,
      mealWindowVersion: 0,
      safe: false,
      permissionAllowed: false,
      scheduleAllowed: false,
      availableAmount: 0,
      itemStoreVersion: 0,
      foodAvailabilityVersion: 1,
      active: false,
      linkedCandidate: false,
      dirtyBacklog: 1,
    });
    expect(output).toBe(identity);

    dirtyStore.readPortionInto(-1, output);
    expect(output).toEqual({
      ok: false,
      reason: "food_stack_id_out_of_range",
      stackId: -1,
      foodDefId: 0,
      regionId: 0,
      storageSlotId: 0,
      targetCellIndex: 0,
      interactionSpotId: 0,
      scoreMilli: 0,
      permissionId: 0,
      mealWindowId: 0,
      mealWindowVersion: 0,
      safe: false,
      permissionAllowed: false,
      scheduleAllowed: false,
      availableAmount: 0,
      itemStoreVersion: 0,
      foodAvailabilityVersion: 1,
      active: false,
      linkedCandidate: false,
      dirtyBacklog: 1,
    });
    expect(output).toBe(identity);
  });

  it("selects caller-owned food candidates in stable score and source-row order", () => {
    const fixture = createFoodFixture(3, 2);
    updateFoodPortionConfig(fixture, 0, {
      regionId: 2,
      interactionSpotId: 20,
      targetCellIndex: 9,
      scoreMilli: 900,
      permissionId: 1,
      mealWindowId: 3,
      mealWindowVersion: 11,
    });
    updateFoodPortionConfig(fixture, 1, {
      regionId: 2,
      interactionSpotId: 21,
      targetCellIndex: 1,
      scoreMilli: 900,
      permissionId: 1,
      mealWindowId: 3,
      mealWindowVersion: 12,
    });
    updateFoodPortionConfig(fixture, 2, {
      regionId: 2,
      interactionSpotId: 22,
      targetCellIndex: 7,
      scoreMilli: 1_000,
      permissionId: 1,
      mealWindowId: 3,
      mealWindowVersion: 13,
    });
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const query = createFoodCandidateQuery({
      regionId: 2,
      permissionId: 1,
      mealWindowId: 3,
    });
    const legacyIds = new Uint32Array(M3_FOOD_DEFAULT_SELECTED_CAP);
    const legacy = fixture.food.selectCandidates(query, legacyIds);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy food selection failure: ${legacy.reason}`);
    }

    const scratch = createFoodSelectionScratch();
    const output = createFoodSelectionOutput();
    const scratchIdentity = scratch;
    const stackLaneIdentity = scratch.stackIds;
    const outputIdentity = output;
    fixture.food.selectCandidatesInto(query, scratch, output);
    const first = fixture.food.readPortion(2) ?? failMissingPortion();

    expect(output).toEqual({
      ok: true,
      reason: legacy.reason,
      queryFoodDefId: query.foodDefId,
      queryRegionId: query.regionId,
      queryPermissionId: query.permissionId,
      queryMealWindowId: query.mealWindowId,
      candidateCap: query.candidateCap,
      maxSelected: query.maxSelected,
      bucketCandidateCount: legacy.bucketCandidateCount,
      visitedCount: legacy.visitedCount,
      selectedCount: legacy.selectedCount,
      candidateCapHit: legacy.candidateCapHit,
      selectedCapHit: legacy.selectedCapHit,
      selectedStackId: first.stackId,
      selectedFoodDefId: first.foodDefId,
      selectedRegionId: first.regionId,
      selectedStorageSlotId: first.storageSlotId,
      selectedTargetCellIndex: first.targetCellIndex,
      selectedInteractionSpotId: first.interactionSpotId,
      selectedScoreMilli: first.scoreMilli,
      selectedPermissionId: first.permissionId,
      selectedMealWindowId: first.mealWindowId,
      selectedMealWindowVersion: first.mealWindowVersion,
      selectedSafe: first.safe,
      selectedPermissionAllowed: first.permissionAllowed,
      selectedScheduleAllowed: first.scheduleAllowed,
      selectedAvailableAmount: first.availableAmount,
      sourceItemVersion: first.itemStoreVersion,
      selectedLinkedCandidate: first.linkedCandidate,
      foodAvailabilityVersion: first.foodAvailabilityVersion,
      dirtyBacklog: 0,
    });
    expect(Array.from(legacyIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.stackIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.scoreMillis.subarray(0, 3))).toEqual([1_000, 900, 900]);
    expect(Array.from(scratch.targetCellIndexes.subarray(0, 3))).toEqual([7, 9, 1]);
    expect(Array.from(scratch.itemStoreVersions.subarray(0, 3))).toEqual([
      fixture.items.version,
      fixture.items.version,
      fixture.items.version,
    ]);
    expect(Array.from(scratch.mealWindowVersions.subarray(0, 3))).toEqual([13, 11, 12]);
    expect(Array.from(scratch.permissionAllowedFlags.subarray(0, 3))).toEqual([1, 1, 1]);
    expect(Array.from(scratch.scheduleAllowedFlags.subarray(0, 3))).toEqual([1, 1, 1]);
    for (let index = 0; index < output.selectedCount; index += 1) {
      const stackId = scratch.stackIds[index] ?? M3_FOOD_STACK_NONE;
      const portion = fixture.food.readPortion(stackId) ?? failMissingPortion();
      expect(scratch.stackIds[index]).toBe(portion.stackId);
      expect(scratch.foodDefIds[index]).toBe(portion.foodDefId);
      expect(scratch.regionIds[index]).toBe(portion.regionId);
      expect(scratch.storageSlotIds[index]).toBe(portion.storageSlotId);
      expect(scratch.targetCellIndexes[index]).toBe(portion.targetCellIndex);
      expect(scratch.interactionSpotIds[index]).toBe(portion.interactionSpotId);
      expect(scratch.scoreMillis[index]).toBe(portion.scoreMilli);
      expect(scratch.permissionIds[index]).toBe(portion.permissionId);
      expect(scratch.mealWindowIds[index]).toBe(portion.mealWindowId);
      expect(scratch.mealWindowVersions[index]).toBe(portion.mealWindowVersion);
      expect(scratch.safeFlags[index]).toBe(portion.safe ? 1 : 0);
      expect(scratch.permissionAllowedFlags[index]).toBe(portion.permissionAllowed ? 1 : 0);
      expect(scratch.scheduleAllowedFlags[index]).toBe(portion.scheduleAllowed ? 1 : 0);
      expect(scratch.availableAmounts[index]).toBe(portion.availableAmount);
      expect(scratch.itemStoreVersions[index]).toBe(portion.itemStoreVersion);
      expect(scratch.linkedCandidateFlags[index]).toBe(portion.linkedCandidate ? 1 : 0);
    }
    expect(output).toBe(outputIdentity);
    expect(scratch).toBe(scratchIdentity);
    expect(scratch.stackIds).toBe(stackLaneIdentity);
  });

  it("honors smaller caller caps and the fixed 24/12 food bounds", () => {
    const fixture = createFoodFixture(30);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const scratch = createFoodSelectionScratch();
    const output = createFoodSelectionOutput();
    const fullQuery = createFoodCandidateQuery();

    fixture.food.selectCandidatesInto(fullQuery, scratch, output);
    expect(output).toMatchObject({
      ok: true,
      reason: "trace.candidate_cap_reached",
      bucketCandidateCount: 30,
      visitedCount: 24,
      selectedCount: 12,
      candidateCapHit: true,
      selectedCapHit: true,
      selectedStackId: 0,
      dirtyBacklog: 0,
    });
    expect(Array.from(scratch.stackIds)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const smallQuery = createFoodCandidateQuery({ candidateCap: 3, maxSelected: 2 });
    const legacyIds = new Uint32Array(M3_FOOD_DEFAULT_SELECTED_CAP);
    const legacy = fixture.food.selectCandidates(smallQuery, legacyIds);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy food selection failure: ${legacy.reason}`);
    }
    fixture.food.selectCandidatesInto(smallQuery, scratch, output);
    expect(output).toMatchObject({
      ok: true,
      reason: legacy.reason,
      bucketCandidateCount: legacy.bucketCandidateCount,
      visitedCount: legacy.visitedCount,
      selectedCount: legacy.selectedCount,
      candidateCapHit: legacy.candidateCapHit,
      selectedCapHit: legacy.selectedCapHit,
      candidateCap: 3,
      maxSelected: 2,
    });
    expect(Array.from(scratch.stackIds.subarray(0, 4))).toEqual([
      legacyIds[0],
      legacyIds[1],
      M3_FOOD_STACK_NONE,
      M3_FOOD_STACK_NONE,
    ]);
    expect(scratch.scoreMillis[2]).toBe(0);
    expect(scratch.itemStoreVersions[11]).toBe(0);
    expect(scratch.permissionAllowedFlags[11]).toBe(0);
  });

  it("rejects invalid caps and every undersized food scratch lane before traversal", () => {
    const fixture = createFoodFixture(1);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const metricsBefore = fixture.food.createMetrics();
    const invalidQueries = [
      {
        query: createFoodCandidateQuery({ candidateCap: 25 }),
        reason: "food_candidate_cap_invalid" as const,
      },
      {
        query: createFoodCandidateQuery({ maxSelected: 13 }),
        reason: "food_selected_cap_invalid" as const,
      },
    ];

    for (const invalid of invalidQueries) {
      const scratch = createFoodSelectionScratch();
      const output = createFoodSelectionOutput();
      fixture.food.selectCandidatesInto(invalid.query, scratch, output);
      expect(output).toEqual(
        createFoodSelectionResetOutput(invalid.query, fixture.food.version, 0, invalid.reason),
      );
      expectFoodSelectionScratchReset(scratch);
    }

    for (const lane of FOOD_SELECTION_SCRATCH_LANES) {
      const query = createFoodCandidateQuery();
      const scratch = createFoodSelectionScratch(lane);
      const output = createFoodSelectionOutput();
      fixture.food.selectCandidatesInto(query, scratch, output);
      expect(output).toEqual(
        createFoodSelectionResetOutput(
          query,
          fixture.food.version,
          0,
          "food_candidate_buffer_too_small",
        ),
      );
      expectFoodSelectionScratchReset(scratch);
    }
    expect(fixture.food.createMetrics()).toEqual(metricsBefore);
  });

  it("rejects a dirty food index even when its owner version did not advance", () => {
    const fixture = createFoodFixture(1);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const versionBeforeDirty = fixture.food.version;
    const metricsBefore = fixture.food.createMetrics();
    expect(fixture.food.markStackDirty(0)).toEqual({
      ok: true,
      stackId: 0,
      version: versionBeforeDirty,
    });
    const query = createFoodCandidateQuery();
    const scratch = createFoodSelectionScratch();
    const output = createFoodSelectionOutput();
    const outputIdentity = output;

    fixture.food.selectCandidatesInto(query, scratch, output);
    expect(output).toEqual(
      createFoodSelectionResetOutput(query, versionBeforeDirty, 1, "food_dirty_backlog"),
    );
    expect(output).toBe(outputIdentity);
    expectFoodSelectionScratchReset(scratch);
    expect(fixture.food.version).toBe(versionBeforeDirty);
    expect(fixture.food.createMetrics()).toMatchObject({
      lastCandidateCount: metricsBefore.lastCandidateCount,
      lastVisitedCount: metricsBefore.lastVisitedCount,
      lastSelectedCount: metricsBefore.lastSelectedCount,
      dirtyBacklog: 1,
    });
  });

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

type FoodPortionIntoOutput = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["readPortionInto"]
>[1];
type FoodCandidateQuery = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["selectCandidatesInto"]
>[0];
type FoodSelectionScratch = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["selectCandidatesInto"]
>[1];
type FoodSelectionOutput = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["selectCandidatesInto"]
>[2];
type FoodSelectionScratchLane = keyof FoodSelectionScratch;

const FOOD_SELECTION_SCRATCH_LANES: readonly FoodSelectionScratchLane[] = [
  "stackIds",
  "foodDefIds",
  "regionIds",
  "storageSlotIds",
  "targetCellIndexes",
  "interactionSpotIds",
  "scoreMillis",
  "permissionIds",
  "mealWindowIds",
  "mealWindowVersions",
  "safeFlags",
  "permissionAllowedFlags",
  "scheduleAllowedFlags",
  "availableAmounts",
  "itemStoreVersions",
  "linkedCandidateFlags",
];

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

function createFoodPortionIntoOutput(): FoodPortionIntoOutput {
  return {
    ok: true,
    reason: "food_score_invalid",
    stackId: 99,
    foodDefId: 99,
    regionId: 99,
    storageSlotId: 99,
    targetCellIndex: 99,
    interactionSpotId: 99,
    scoreMilli: 99,
    permissionId: 99,
    mealWindowId: 99,
    mealWindowVersion: 99,
    safe: true,
    permissionAllowed: true,
    scheduleAllowed: true,
    availableAmount: 99,
    itemStoreVersion: 99,
    foodAvailabilityVersion: 99,
    active: true,
    linkedCandidate: true,
    dirtyBacklog: 99,
  };
}

function createFoodCandidateQuery(overrides: Partial<FoodCandidateQuery> = {}): FoodCandidateQuery {
  return {
    foodDefId: GRAIN_BOWL,
    regionId: REGION_YARD,
    permissionId: PUBLIC_PERMISSION,
    mealWindowId: MIDDAY_MEAL,
    candidateCap: M3_FOOD_DEFAULT_CANDIDATE_CAP,
    maxSelected: M3_FOOD_DEFAULT_SELECTED_CAP,
    ...overrides,
  };
}

function createFoodSelectionScratch(
  undersizedLane?: FoodSelectionScratchLane,
): FoodSelectionScratch {
  return {
    stackIds: createPoisonedUint32Lane("stackIds", undersizedLane),
    foodDefIds: createPoisonedUint32Lane("foodDefIds", undersizedLane),
    regionIds: createPoisonedUint32Lane("regionIds", undersizedLane),
    storageSlotIds: createPoisonedUint32Lane("storageSlotIds", undersizedLane),
    targetCellIndexes: createPoisonedUint32Lane("targetCellIndexes", undersizedLane),
    interactionSpotIds: createPoisonedUint32Lane("interactionSpotIds", undersizedLane),
    scoreMillis: createPoisonedUint32Lane("scoreMillis", undersizedLane),
    permissionIds: createPoisonedUint32Lane("permissionIds", undersizedLane),
    mealWindowIds: createPoisonedUint32Lane("mealWindowIds", undersizedLane),
    mealWindowVersions: createPoisonedUint32Lane("mealWindowVersions", undersizedLane),
    safeFlags: createPoisonedUint8Lane("safeFlags", undersizedLane),
    permissionAllowedFlags: createPoisonedUint8Lane("permissionAllowedFlags", undersizedLane),
    scheduleAllowedFlags: createPoisonedUint8Lane("scheduleAllowedFlags", undersizedLane),
    availableAmounts: createPoisonedUint32Lane("availableAmounts", undersizedLane),
    itemStoreVersions: createPoisonedUint32Lane("itemStoreVersions", undersizedLane),
    linkedCandidateFlags: createPoisonedUint8Lane("linkedCandidateFlags", undersizedLane),
  };
}

function createPoisonedUint32Lane(
  lane: FoodSelectionScratchLane,
  undersizedLane: FoodSelectionScratchLane | undefined,
): Uint32Array {
  const capacity = lane === undersizedLane ? M3_FOOD_DEFAULT_SELECTED_CAP - 1 : 12;
  return new Uint32Array(capacity).fill(99);
}

function createPoisonedUint8Lane(
  lane: FoodSelectionScratchLane,
  undersizedLane: FoodSelectionScratchLane | undefined,
): Uint8Array {
  const capacity = lane === undersizedLane ? M3_FOOD_DEFAULT_SELECTED_CAP - 1 : 12;
  return new Uint8Array(capacity).fill(1);
}

function createFoodSelectionOutput(): FoodSelectionOutput {
  return {
    ok: true,
    reason: "food_score_invalid",
    queryFoodDefId: 99,
    queryRegionId: 99,
    queryPermissionId: 99,
    queryMealWindowId: 99,
    candidateCap: 99,
    maxSelected: 99,
    bucketCandidateCount: 99,
    visitedCount: 99,
    selectedCount: 99,
    candidateCapHit: true,
    selectedCapHit: true,
    selectedStackId: 99,
    selectedFoodDefId: 99,
    selectedRegionId: 99,
    selectedStorageSlotId: 99,
    selectedTargetCellIndex: 99,
    selectedInteractionSpotId: 99,
    selectedScoreMilli: 99,
    selectedPermissionId: 99,
    selectedMealWindowId: 99,
    selectedMealWindowVersion: 99,
    selectedSafe: true,
    selectedPermissionAllowed: true,
    selectedScheduleAllowed: true,
    selectedAvailableAmount: 99,
    sourceItemVersion: 99,
    selectedLinkedCandidate: true,
    foodAvailabilityVersion: 99,
    dirtyBacklog: 99,
  };
}

function createFoodSelectionResetOutput(
  query: FoodCandidateQuery,
  foodAvailabilityVersion: number,
  dirtyBacklog: number,
  reason: FoodSelectionOutput["reason"],
): FoodSelectionOutput {
  return {
    ok: false,
    reason,
    queryFoodDefId: query.foodDefId,
    queryRegionId: query.regionId,
    queryPermissionId: query.permissionId,
    queryMealWindowId: query.mealWindowId,
    candidateCap: query.candidateCap,
    maxSelected: query.maxSelected,
    bucketCandidateCount: 0,
    visitedCount: 0,
    selectedCount: 0,
    candidateCapHit: false,
    selectedCapHit: false,
    selectedStackId: M3_FOOD_STACK_NONE,
    selectedFoodDefId: 0,
    selectedRegionId: 0,
    selectedStorageSlotId: 0,
    selectedTargetCellIndex: 0,
    selectedInteractionSpotId: 0,
    selectedScoreMilli: 0,
    selectedPermissionId: 0,
    selectedMealWindowId: 0,
    selectedMealWindowVersion: 0,
    selectedSafe: false,
    selectedPermissionAllowed: false,
    selectedScheduleAllowed: false,
    selectedAvailableAmount: 0,
    sourceItemVersion: 0,
    selectedLinkedCandidate: false,
    foodAvailabilityVersion,
    dirtyBacklog,
  };
}

function expectFoodSelectionScratchReset(scratch: FoodSelectionScratch): void {
  for (const laneName of FOOD_SELECTION_SCRATCH_LANES) {
    const lane = scratch[laneName];
    const expected = laneName === "stackIds" ? M3_FOOD_STACK_NONE : 0;
    for (const value of lane) {
      expect(value).toBe(expected);
    }
  }
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

function updateFoodPortionConfig(
  fixture: FoodFixture,
  stackId: number,
  overrides: Partial<M3FoodPortionInput>,
): void {
  const portion = fixture.food.readPortion(stackId) ?? failMissingPortion();
  expect(
    fixture.food.updatePortion({
      stackId: portion.stackId,
      foodDefId: portion.foodDefId,
      regionId: portion.regionId,
      storageSlotId: portion.storageSlotId,
      targetCellIndex: portion.targetCellIndex,
      interactionSpotId: portion.interactionSpotId,
      scoreMilli: portion.scoreMilli,
      permissionId: portion.permissionId,
      mealWindowId: portion.mealWindowId,
      mealWindowVersion: portion.mealWindowVersion,
      safe: portion.safe,
      permissionAllowed: portion.permissionAllowed,
      scheduleAllowed: portion.scheduleAllowed,
      ...overrides,
    }),
  ).toMatchObject({ ok: true, stackId });
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
