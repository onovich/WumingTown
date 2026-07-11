import { describe, expect, it, vi } from "vitest";

import {
  MAP_DIRECTION_MASK_EAST,
  MAP_TERRAIN_BLOCKED,
  M3_ABILITY_MOVEMENT,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_INJURY,
  RESERVATION_CLAIM_NONE,
  WORK_OFFER_NONE,
  createEntityRegistry,
  createGridPathfinder,
  createM3AbilityCacheStore,
  createM3HealthAbilityMask,
  createM3HealthConditionStore,
  createMapGrid,
  createReservationLedger,
  createWorkOfferIndex,
  type EntityId,
  type M3AbilityQueryResult,
  type M3AbilityQueryIntoOutput,
  type MapCardinalMovementIntoOutput,
  type MapMovementCellIntoOutput,
  type PathRequest,
  type PathSearchIntoOutput,
  type ReservationAcquireIntoOutput,
  type ReservationAcquireIntoScratch,
  type ReservationClaimRequest,
  type ReservationTransactionRequest,
  type WorkOfferMutationIntoOutput,
  type WorkOfferReadIntoOutput,
  type WorkOfferSelectionIntoOutput,
  type WorkOfferSelectionIntoScratch,
  type WorkOfferVersionedInput,
} from "./index";

describe("caller-owned owner hot-path surfaces", () => {
  it("reads MapGrid movement facts without mutation and resets every output lane", () => {
    const grid = createMapGrid({ width: 4, height: 3, chunkSize: 2 });
    const cell = createMovementCellOutput();
    const cardinal = createCardinalOutput();
    const cellIdentity = cell;
    const cardinalIdentity = cardinal;

    grid.readMovementCellByIndexInto(0, cell);
    expect(cell).toEqual({
      ok: true,
      reason: undefined,
      passable: true,
      walkCostMilli: 1000,
      cellVersion: 0,
    });
    expect(cell).toBe(cellIdentity);
    expect(grid.isCellPassableByIndex(0)).toEqual({ ok: true, passable: cell.passable });
    grid.readMovementCellByIndexInto(-1, cell);
    expect(cell).toEqual({
      ok: false,
      reason: "map_cell_index_out_of_range",
      passable: false,
      walkCostMilli: 0,
      cellVersion: 0,
    });
    expect(grid.isCellPassableByIndex(-1)).toEqual({
      ok: false,
      reason: "map_cell_index_out_of_range",
    });

    expect(grid.updateCellByIndex(1, { terrain: MAP_TERRAIN_BLOCKED }).ok).toBe(true);
    grid.readMovementCellByIndexInto(1, cell);
    const blockedCell = grid.readCellByIndex(1);
    expect(cell).toMatchObject({ ok: true, passable: false });
    if (blockedCell.ok) expect(cell.cellVersion).toBe(blockedCell.cell.cellVersion);
    expect(grid.isCellPassableByIndex(1)).toEqual({ ok: true, passable: cell.passable });
    grid.canMoveBetweenCardinalNeighborsInto(0, 1, cardinal);
    expect(cardinal).toEqual({ ok: true, reason: undefined, passable: false });
    expect(grid.canMoveBetweenCardinalNeighbors(0, 1)).toEqual({
      ok: true,
      passable: cardinal.passable,
    });
    expect(grid.updateCellByIndex(2, { walkCostMilli: 0 }).ok).toBe(true);
    grid.readMovementCellByIndexInto(2, cell);
    const zeroCostCell = grid.readCellByIndex(2);
    expect(cell).toMatchObject({ ok: true, passable: false, walkCostMilli: 0 });
    if (zeroCostCell.ok) expect(cell.cellVersion).toBe(zeroCostCell.cell.cellVersion);
    expect(grid.isCellPassableByIndex(2)).toEqual({ ok: true, passable: cell.passable });
    expect(grid.updateCellByIndex(4, { wallMask: MAP_DIRECTION_MASK_EAST }).ok).toBe(true);
    grid.canMoveBetweenCardinalNeighborsInto(4, 5, cardinal);
    expect(cardinal).toEqual({ ok: true, reason: undefined, passable: false });
    expect(grid.canMoveBetweenCardinalNeighbors(4, 5)).toEqual({
      ok: true,
      passable: cardinal.passable,
    });
    expect(grid.updateCellByIndex(4, { wallMask: 0, doorMask: MAP_DIRECTION_MASK_EAST }).ok).toBe(
      true,
    );
    grid.canMoveBetweenCardinalNeighborsInto(4, 5, cardinal);
    expect(cardinal).toEqual({ ok: true, reason: undefined, passable: false });
    expect(grid.canMoveBetweenCardinalNeighbors(4, 5)).toEqual({
      ok: true,
      passable: cardinal.passable,
    });
    grid.canMoveBetweenCardinalNeighborsInto(0, 2, cardinal);
    expect(cardinal).toEqual({
      ok: false,
      reason: "map_cells_not_cardinal_neighbors",
      passable: false,
    });
    expect(grid.canMoveBetweenCardinalNeighbors(0, 2)).toEqual({
      ok: false,
      reason: "map_cells_not_cardinal_neighbors",
    });
    grid.canMoveBetweenCardinalNeighborsInto(-1, 0, cardinal);
    expect(cardinal).toEqual({
      ok: false,
      reason: "map_cell_index_out_of_range",
      passable: false,
    });
    expect(cardinal).toBe(cardinalIdentity);

    const beforeVersion = grid.globalVersion;
    const beforeDirty = grid.dirtyChunkCount;
    const beforeSnapshot = grid.createSnapshot();
    const beforeHashFields = grid.createHashFields();
    for (let iteration = 0; iteration < 20; iteration += 1) {
      grid.readMovementCellByIndexInto(0, cell);
      grid.canMoveBetweenCardinalNeighborsInto(0, 4, cardinal);
    }
    expect(cell).toBe(cellIdentity);
    expect(cardinal).toBe(cardinalIdentity);
    expect(grid.globalVersion).toBe(beforeVersion);
    expect(grid.dirtyChunkCount).toBe(beforeDirty);
    expect(grid.createSnapshot()).toEqual(beforeSnapshot);
    expect(grid.createHashFields()).toEqual(beforeHashFields);
  });

  it("finds exact paths into a bounded route without legacy materializing reads", () => {
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    const pathfinder = createGridPathfinder(16);
    const request = createPathRequest(grid.globalVersion, 0, 15);
    const legacy = pathfinder.findPath(grid, request);
    expect(legacy.ok).toBe(true);

    const legacyCell = vi
      .spyOn(grid, "isCellPassableByIndex")
      .mockImplementation(() => failLegacyMapRead());
    const legacyMove = vi
      .spyOn(grid, "canMoveBetweenCardinalNeighbors")
      .mockImplementation(() => failLegacyMapRead());
    const legacyRead = vi.spyOn(grid, "readCellByIndex").mockImplementation(() => {
      throw new Error("legacy readCellByIndex called");
    });
    const route = new Uint32Array(16);
    const output = createPathOutput();
    const outputIdentity = output;
    const routeIdentity = route;
    pathfinder.findPathInto(grid, request, route, output);
    expect(output).toMatchObject({
      ok: true,
      reason: undefined,
      requestSequence: request.requestSequence,
      startCellIndex: request.startCellIndex,
      goalCellIndex: request.goalCellIndex,
      mapVersion: request.basis.mapVersion,
      navigationVersion: request.basis.navigationVersion,
      regionVersion: request.basis.regionVersion,
      roomVersion: request.basis.roomVersion,
      regionGraphVersion: request.basis.regionGraphVersion,
      pathCellCount: 7,
    });
    if (legacy.ok) {
      expect(Array.from(route.slice(0, output.pathCellCount))).toEqual(Array.from(legacy.path));
      expect(output.pathCostMilli).toBe(legacy.pathCostMilli);
      expect(output.nodeExpansions).toBe(legacy.nodeExpansions);
    }
    expect(legacyCell).not.toHaveBeenCalled();
    expect(legacyMove).not.toHaveBeenCalled();
    expect(legacyRead).not.toHaveBeenCalled();
    expect(output).toBe(outputIdentity);
    expect(route).toBe(routeIdentity);

    const shortRoute = new Uint32Array([777]);
    pathfinder.findPathInto(grid, request, shortRoute, output);
    expect(output).toMatchObject({
      ok: false,
      reason: "path_output_capacity_exceeded",
      pathCellCount: 0,
      pathCostMilli: 0,
    });
    expect(shortRoute[0]).toBe(777);
    expect(output).toBe(outputIdentity);

    const blockedRequest = createPathRequest(grid.globalVersion, 1, 15);
    pathfinder.findPathInto(grid, blockedRequest, route, output);
    expect(output).toMatchObject({
      ok: true,
      reason: undefined,
      startCellIndex: 1,
      pathCellCount: 6,
    });
    expect(output).toBe(outputIdentity);
  });

  it("binds WorkOffer owner and row versions to allocation-free selection", () => {
    const index = createWorkOfferIndex({
      capacity: 32,
      workTypeCapacity: 4,
      regionCapacity: 4,
      defCapacity: 4,
      urgencyBucketCount: 4,
      permissionCapacity: 4,
    });
    const mutation = createOfferMutationOutput();
    const read = createOfferReadOutput();
    const readIdentity = read;
    const first = createOffer(1, 100, 7, 8);
    index.registerOfferInto(first, mutation);
    expect(mutation).toMatchObject({ ok: true, ownerVersion: 7, rowVersion: 1, indexVersion: 1 });
    const mutationIdentity = mutation;
    index.updateOfferInto({ ...first, ownerVersion: 8, scoreMilli: 200 }, 7, 0, mutation);
    expect(mutation).toMatchObject({ ok: false, reason: "work_offer_row_version_mismatch" });
    expect(index.indexVersion).toBe(1);
    index.readOfferInto(1, read);
    expect(read).toMatchObject({ ok: true, ownerVersion: 7, rowVersion: 1, scoreMilli: 100 });
    expect(read).toBe(readIdentity);
    index.updateOfferInto({ ...first, ownerVersion: 8, scoreMilli: 200 }, 7, 1, mutation);
    expect(mutation).toMatchObject({ ok: true, ownerVersion: 8, rowVersion: 2, indexVersion: 2 });
    expect(mutation).toBe(mutationIdentity);

    index.registerOfferInto(createOffer(2, 300, 9, 10), mutation);
    index.registerOfferInto(createOffer(3, 300, 10, 9), mutation);
    const scratch = createOfferSelectionScratch();
    const selected = createOfferSelectionOutput();
    const selectedIdentity = selected;
    const selectionOptions = {
      pawnId: 4,
      workType: 1,
      regionId: 1,
      defId: 1,
      urgencyBucket: 1,
      permissionId: 1,
      candidateCap: 2,
      maxSelectedOffers: 2,
    };
    index.selectTopOffersInto(selectionOptions, scratch, selected);
    expect(selected).toMatchObject({
      ok: true,
      selectedCount: 2,
      bucketCandidateCount: 3,
      visitedCount: 2,
      rejectedByCandidateCap: 1,
      selectedOfferId: 2,
      selectedOwnerVersion: 9,
      selectedRowVersion: 1,
      selectedTargetId: 10,
      selectedIndexVersion: 4,
    });
    expect(selected).toBe(selectedIdentity);
    const legacyCandidateScratch = new Uint32Array(2);
    const legacySelectedIds = new Uint32Array(2);
    const legacySelectedScores = new Int32Array(2);
    const legacySelection = index.selectTopOffers(
      selectionOptions,
      legacyCandidateScratch,
      legacySelectedIds,
      legacySelectedScores,
    );
    expect(legacySelection).toMatchObject({
      ok: true,
      selectedCount: selected.selectedCount,
      bucketCandidateCount: selected.bucketCandidateCount,
      visitedCount: selected.visitedCount,
      scoredCount: selected.scoredCount,
      rejectedByCandidateCap: selected.rejectedByCandidateCap,
      rejectedBySelectedCap: selected.rejectedBySelectedCap,
    });
    expect(Array.from(legacySelectedIds)).toEqual(
      Array.from(scratch.selectedOfferIds.slice(0, selected.selectedCount)),
    );
    expect(Array.from(legacySelectedScores)).toEqual(
      Array.from(scratch.selectedScoresMilli.slice(0, selected.selectedCount)),
    );

    const versionBeforeInvalid = index.indexVersion;
    index.registerOfferInto({ ...createOffer(4, 1, 0, 12), ownerVersion: -1 }, mutation);
    expect(mutation).toMatchObject({
      ok: false,
      reason: "work_offer_owner_version_out_of_range",
      indexVersion: versionBeforeInvalid,
    });
    expect(index.indexVersion).toBe(versionBeforeInvalid);
    index.readOfferInto(99, read);
    expect(read).toMatchObject({
      ok: false,
      reason: "work_offer_id_out_of_range",
      targetId: 0,
      scoreMilli: 0,
      indexVersion: versionBeforeInvalid,
    });
    expect(read).toBe(readIdentity);

    const shortSelectionScratch = createOfferSelectionScratch();
    const tooSmallCandidateLane = new Uint32Array(1);
    const shortScratch: WorkOfferSelectionIntoScratch = {
      candidateOfferIds: tooSmallCandidateLane,
      selectedOfferIds: shortSelectionScratch.selectedOfferIds,
      selectedScoresMilli: shortSelectionScratch.selectedScoresMilli,
      selectedOwnerVersions: shortSelectionScratch.selectedOwnerVersions,
      selectedRowVersions: shortSelectionScratch.selectedRowVersions,
      selectedTargetIds: shortSelectionScratch.selectedTargetIds,
      selectedTargetCellIndexes: shortSelectionScratch.selectedTargetCellIndexes,
    };
    index.selectTopOffersInto(selectionOptions, shortScratch, selected);
    expect(selected).toMatchObject({
      ok: false,
      reason: "work_offer_candidate_buffer_too_small",
      selectedCount: 0,
      selectedOfferId: WORK_OFFER_NONE,
      selectedIndexVersion: versionBeforeInvalid,
    });
    expect(selected).toBe(selectedIdentity);

    index.removeOfferInto(2, 9, 0, mutation);
    expect(mutation.reason).toBe("work_offer_row_version_mismatch");
    index.removeOfferInto(2, 9, 1, mutation);
    expect(mutation).toMatchObject({ ok: true, rowVersion: 2, indexVersion: 5 });
    expect(index.registerOffer(createOffer(4, 1, 0, 12))).toEqual({ ok: true });
    expect(index.readOffer(4)).toMatchObject({ targetId: 12 });
  });

  it("validates every reservation claim before one allocation-free atomic commit", () => {
    const registry = createEntityRegistry({ capacity: 12 });
    const owner = allocate(registry);
    const targetA = allocate(registry);
    const targetB = allocate(registry);
    const targetC = allocate(registry);
    const targetD = allocate(registry);
    const contender = allocate(registry);
    const ledger = createReservationLedger({ capacity: 16, entityCapacity: 12, cellCount: 32 });
    const legacyLedger = createReservationLedger({
      capacity: 16,
      entityCapacity: 12,
      cellCount: 32,
    });
    const scratch = createReservationScratch(5);
    const claimIds = new Uint32Array(5);
    const output = createReservationOutput();
    const claims: readonly ReservationClaimRequest[] = [
      { channel: "entity", target: targetA },
      { channel: "cell", cellIndex: 5 },
      { channel: "item_quantity", item: targetB, amount: 2, availableAmount: 10 },
      { channel: "interaction_spot", target: targetC, spotId: 1 },
      { channel: "capacity", target: targetD, capacityId: 2, amount: 3, capacity: 10 },
    ];
    const request: ReservationTransactionRequest = {
      owner,
      jobId: 7,
      createdTick: 10,
      leaseExpiryTick: 100,
      claims,
    };
    const outputIdentity = output;
    const scratchIdentity = scratch;
    const legacyResult = legacyLedger.acquire(request, registry);
    const legacyEntityValidation = vi.spyOn(registry, "validate").mockImplementation(() => {
      throw new Error("legacy EntityRegistry.validate called");
    });
    ledger.acquireInto(request, registry, scratch, claimIds, output);
    expect(output).toMatchObject({ ok: true, claimCount: 5, version: 1, activeCount: 5 });
    expect(Array.from(claimIds)).toEqual([0, 1, 2, 3, 4]);
    expect(output).toBe(outputIdentity);
    expect(scratch).toBe(scratchIdentity);
    expect(legacyEntityValidation).not.toHaveBeenCalled();
    expect(legacyResult).toMatchObject({ ok: true, claimIds: [0, 1, 2, 3, 4], version: 1 });
    expect(ledger.createSnapshot()).toEqual(legacyLedger.createSnapshot());

    const conflictCases: readonly {
      readonly request: ReservationTransactionRequest;
      readonly reason: NonNullable<ReservationAcquireIntoOutput["reason"]>;
    }[] = [
      {
        request: transaction(contender, 8, [{ channel: "entity", target: targetA }]),
        reason: "reservation_entity_conflict",
      },
      {
        request: transaction(contender, 9, [{ channel: "cell", cellIndex: 5 }]),
        reason: "reservation_cell_conflict",
      },
      {
        request: transaction(contender, 10, [
          { channel: "item_quantity", item: targetB, amount: 9, availableAmount: 10 },
        ]),
        reason: "reservation_item_quantity_conflict",
      },
      {
        request: transaction(contender, 11, [
          { channel: "interaction_spot", target: targetC, spotId: 1 },
        ]),
        reason: "reservation_interaction_conflict",
      },
      {
        request: transaction(contender, 12, [
          { channel: "capacity", target: targetD, capacityId: 2, amount: 8, capacity: 10 },
        ]),
        reason: "reservation_capacity_conflict",
      },
    ];
    for (const conflictCase of conflictCases) {
      expectAcquireFailureAtomic(
        ledger,
        registry,
        conflictCase.request,
        scratch,
        claimIds,
        output,
        conflictCase.reason,
      );
      expect(output).toBe(outputIdentity);
      expect(scratch).toBe(scratchIdentity);
    }

    const partialConflict = transaction(contender, 13, [
      { channel: "cell", cellIndex: 8 },
      { channel: "cell", cellIndex: 5 },
    ]);
    expectAcquireFailureAtomic(
      ledger,
      registry,
      partialConflict,
      scratch,
      claimIds,
      output,
      "reservation_cell_conflict",
    );

    const invalidOwner: EntityId = { index: contender.index, generation: contender.generation + 1 };
    expectAcquireFailureAtomic(
      ledger,
      registry,
      transaction(invalidOwner, 14, [{ channel: "cell", cellIndex: 9 }]),
      scratch,
      claimIds,
      output,
      "reservation_owner_generation_mismatch",
    );
    expectAcquireFailureAtomic(
      ledger,
      registry,
      transaction(contender, 15, [{ channel: "cell", cellIndex: 99 }]),
      scratch,
      claimIds,
      output,
      "reservation_cell_out_of_range",
    );

    const smallScratch = createReservationScratch(0);
    const freeCellRequest = transaction(contender, 16, [{ channel: "cell", cellIndex: 9 }]);
    expectAcquireFailureAtomic(
      ledger,
      registry,
      freeCellRequest,
      smallScratch,
      claimIds,
      output,
      "reservation_scratch_capacity_exhausted",
    );
    const smallClaims = new Uint32Array(0);
    expectAcquireFailureAtomic(
      ledger,
      registry,
      freeCellRequest,
      scratch,
      smallClaims,
      output,
      "reservation_claim_output_too_small",
    );
    const duplicateRequest = transaction(contender, 17, [
      { channel: "cell", cellIndex: 8 },
      { channel: "cell", cellIndex: 8 },
    ]);
    expectAcquireFailureAtomic(
      ledger,
      registry,
      duplicateRequest,
      scratch,
      claimIds,
      output,
      "reservation_duplicate_target",
    );

    const tinyLedger = createReservationLedger({ capacity: 1, entityCapacity: 12, cellCount: 32 });
    const twoClaims = transaction(contender, 18, [
      { channel: "cell", cellIndex: 9 },
      { channel: "cell", cellIndex: 10 },
    ]);
    expectAcquireFailureAtomic(
      tinyLedger,
      registry,
      twoClaims,
      scratch,
      claimIds,
      output,
      "reservation_ledger_capacity_exhausted",
    );
    expect(legacyEntityValidation).not.toHaveBeenCalled();
  });

  it("reuses an ability result lane across rebuild, hit, denial and invalid queries", () => {
    const intoFixture = createAbilityFixture();
    const legacyFixture = createAbilityFixture();
    const health = intoFixture.health;
    const abilities = intoFixture.abilities;
    const legacyPenalty = vi.spyOn(health, "computeAbilityPenalty").mockImplementation(() => {
      throw new Error("legacy computeAbilityPenalty called");
    });
    const output = createAbilityOutput();
    const identity = output;
    const legacyRebuild = legacyFixture.abilities.queryAbility(
      1,
      M3_ABILITY_MOVEMENT,
      legacyFixture.health,
      600,
    );
    abilities.queryAbilityInto(1, M3_ABILITY_MOVEMENT, health, 600, output);
    expect(output).toMatchObject({
      ok: true,
      reason: "ability.cache_rebuilt",
      value: 700,
      visitedConditionCount: 1,
    });
    expectAbilityParity(output, legacyRebuild);
    const legacyHit = legacyFixture.abilities.queryAbility(
      1,
      M3_ABILITY_MOVEMENT,
      legacyFixture.health,
      600,
    );
    abilities.queryAbilityInto(1, M3_ABILITY_MOVEMENT, health, 600, output);
    expect(output).toMatchObject({
      ok: true,
      reason: "ability.cache_hit",
      visitedConditionCount: 0,
    });
    expectAbilityParity(output, legacyHit);
    const legacyDenied = legacyFixture.abilities.queryAbility(
      1,
      M3_ABILITY_MOVEMENT,
      legacyFixture.health,
      800,
    );
    abilities.queryAbilityInto(1, M3_ABILITY_MOVEMENT, health, 800, output);
    expect(output).toMatchObject({ ok: false, reason: "ability.rejected_below_threshold" });
    expectAbilityParity(output, legacyDenied);

    expect(health.updateCondition({ conditionId: 1, severity: 300 })).toMatchObject({ ok: true });
    expect(legacyFixture.health.updateCondition({ conditionId: 1, severity: 300 })).toMatchObject({
      ok: true,
    });
    health.drainAbilityInvalidations(abilities, 8);
    legacyFixture.health.drainAbilityInvalidations(legacyFixture.abilities, 8);
    const legacyStaleRebuild = legacyFixture.abilities.queryAbility(
      1,
      M3_ABILITY_MOVEMENT,
      legacyFixture.health,
      500,
    );
    abilities.queryAbilityInto(1, M3_ABILITY_MOVEMENT, health, 500, output);
    expect(output).toMatchObject({
      ok: true,
      reason: "ability.cache_rebuilt",
      value: 600,
      visitedConditionCount: 1,
    });
    expectAbilityParity(output, legacyStaleRebuild);

    const legacyInvalid = legacyFixture.abilities.queryAbility(
      9,
      M3_ABILITY_MOVEMENT,
      legacyFixture.health,
      1,
    );
    abilities.queryAbilityInto(9, M3_ABILITY_MOVEMENT, health, 1, output);
    expect(output).toMatchObject({ ok: false, reason: "ability.actor_out_of_range", value: 0 });
    expectAbilityParity(output, legacyInvalid);
    expect(output).toBe(identity);
    expect(legacyPenalty).not.toHaveBeenCalled();
  });

  it("contains no construction syntax in the Into hot methods and their class helpers", () => {
    const map = createMapGrid({ width: 2, height: 2, chunkSize: 1 });
    const pathfinder = createGridPathfinder(4);
    const offers = createWorkOfferIndex({
      capacity: 2,
      workTypeCapacity: 1,
      regionCapacity: 1,
      defCapacity: 1,
      urgencyBucketCount: 1,
      permissionCapacity: 1,
    });
    const ledger = createReservationLedger({ capacity: 2, entityCapacity: 2, cellCount: 2 });
    const health = createM3HealthConditionStore({
      actorCapacity: 2,
      conditionCapacity: 2,
      abilityDirtyCapacity: 2,
    });
    const abilities = createM3AbilityCacheStore({ actorCapacity: 2, dirtyCapacity: 2 });
    const sources = [
      map.readMovementCellByIndexInto.toString(),
      map.canMoveBetweenCardinalNeighborsInto.toString(),
      pathfinder.findPathInto.toString(),
      offers.registerOfferInto.toString(),
      offers.updateOfferInto.toString(),
      offers.removeOfferInto.toString(),
      offers.readOfferInto.toString(),
      offers.selectTopOffersInto.toString(),
      ledger.acquireInto.toString(),
      health.computeAbilityPenaltyInto.toString(),
      abilities.queryAbilityInto.toString(),
    ];
    const helperMethods: readonly (readonly [object, string])[] = [
      [map, "isCellIndexInRange"],
      [map, "isCellPassableUnchecked"],
      [map, "directionBetweenCardinalNeighbors"],
      [map, "canMoveBetweenUnchecked"],
      [pathfinder, "resetIntoOutput"],
      [pathfinder, "validateRequestReason"],
      [pathfinder, "tryRelaxNeighborInto"],
      [pathfinder, "readPassableMovementCellInto"],
      [pathfinder, "writeFoundPathInto"],
      [pathfinder, "selectBestOpenIndex"],
      [pathfinder, "nextSearchEpoch"],
      [pathfinder, "heuristicMilli"],
      [pathfinder, "neighborIndex"],
      [offers, "resetMutationInto"],
      [offers, "resetReadInto"],
      [offers, "resetSelectionInto"],
      [offers, "writeMutationSuccess"],
      [offers, "validateVersionedInputReason"],
      [offers, "validateKeyReason"],
      [offers, "validateSelectionIntoReason"],
      [offers, "canAdvanceVersions"],
      [offers, "advanceVersions"],
      [offers, "writeOffer"],
      [offers, "insertOffer"],
      [offers, "removeOfferFromCurrentBucket"],
      [ledger, "resetAcquireIntoOutput"],
      [ledger, "hasAcquireScratchCapacity"],
      [ledger, "validateTransactionHeaderInto"],
      [ledger, "validateEntityReason"],
      [ledger, "prepareClaimInto"],
      [ledger, "writePreparedClaimInto"],
      [ledger, "addToTargetIndexInto"],
      [ledger, "allocateClaimId"],
      [ledger, "linkOwner"],
      [ledger, "linkTarget"],
      [ledger, "incrementChannelCount"],
      [ledger, "encodeSlotKey"],
      [abilities, "resetAbilityIntoOutput"],
    ];
    for (const [target, methodName] of helperMethods) {
      sources.push(readMethodSource(target, methodName));
    }
    for (const source of sources) {
      expect(source).not.toMatch(/\bnew\s|\bArray\s*\(|=>|return\s*\{|`/u);
    }
  });
});

function createMovementCellOutput(): MapMovementCellIntoOutput {
  return { ok: false, reason: undefined, passable: false, walkCostMilli: 0, cellVersion: 0 };
}

function readMethodSource(target: object, methodName: string): string {
  const prototype = Reflect.getPrototypeOf(target);
  if (prototype === null) throw new Error(`missing prototype for ${methodName}`);
  const method: unknown = Reflect.get(prototype, methodName);
  if (typeof method !== "function") throw new Error(`missing method ${methodName}`);
  return Function.prototype.toString.call(method);
}

function createCardinalOutput(): MapCardinalMovementIntoOutput {
  return { ok: false, reason: undefined, passable: false };
}

function createPathRequest(mapVersion: number, start: number, goal: number): PathRequest {
  return {
    requestSequence: 1,
    issuedTick: 10,
    startCellIndex: start,
    goalCellIndex: goal,
    basis: {
      mapVersion,
      navigationVersion: 1,
      regionVersion: 1,
      roomVersion: 1,
      regionGraphVersion: 1,
    },
  };
}

function createPathOutput(): PathSearchIntoOutput {
  return {
    ok: false,
    reason: undefined,
    requestSequence: 0,
    startCellIndex: 0,
    goalCellIndex: 0,
    mapVersion: 0,
    navigationVersion: 0,
    regionVersion: 0,
    roomVersion: 0,
    regionGraphVersion: 0,
    pathCellCount: 0,
    pathCostMilli: 0,
    nodeExpansions: 0,
  };
}

function createOffer(
  id: number,
  score: number,
  ownerVersion: number,
  targetId: number,
): WorkOfferVersionedInput {
  return {
    offerId: id,
    workType: 1,
    regionId: 1,
    defId: 1,
    urgencyBucket: 1,
    permissionId: 1,
    targetId,
    targetCellIndex: targetId,
    scoreMilli: score,
    ownerVersion,
  };
}

function createOfferMutationOutput(): WorkOfferMutationIntoOutput {
  return {
    ok: false,
    reason: undefined,
    offerId: 0,
    ownerVersion: 0,
    rowVersion: 0,
    indexVersion: 0,
  };
}

function createOfferReadOutput(): WorkOfferReadIntoOutput {
  return {
    ...createOfferMutationOutput(),
    workType: 0,
    regionId: 0,
    defId: 0,
    urgencyBucket: 0,
    permissionId: 0,
    targetId: 0,
    targetCellIndex: 0,
    scoreMilli: 0,
  };
}

function createOfferSelectionScratch(): WorkOfferSelectionIntoScratch {
  return {
    candidateOfferIds: new Uint32Array(24),
    selectedOfferIds: new Uint32Array(12),
    selectedScoresMilli: new Int32Array(12),
    selectedOwnerVersions: new Uint32Array(12),
    selectedRowVersions: new Uint32Array(12),
    selectedTargetIds: new Uint32Array(12),
    selectedTargetCellIndexes: new Uint32Array(12),
  };
}

function createOfferSelectionOutput(): WorkOfferSelectionIntoOutput {
  return {
    ok: false,
    reason: undefined,
    selectedCount: 0,
    bucketCandidateCount: 0,
    visitedCount: 0,
    scoredCount: 0,
    rejectedByCandidateCap: 0,
    rejectedBySelectedCap: 0,
    selectedOfferId: WORK_OFFER_NONE,
    selectedOwnerVersion: 0,
    selectedRowVersion: 0,
    selectedIndexVersion: 0,
    selectedTargetId: 0,
    selectedTargetCellIndex: 0,
    selectedScoreMilli: 0,
  };
}

function allocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();
  if (!result.ok) throw new Error("entity allocation failed");
  return result.entity;
}

function createReservationScratch(capacity: number): ReservationAcquireIntoScratch {
  return {
    channelCodes: new Uint8Array(capacity),
    keys: new Float64Array(capacity),
    amounts: new Uint32Array(capacity),
    limits: new Uint32Array(capacity),
    targetIndexes: new Uint32Array(capacity),
    targetGenerations: new Uint32Array(capacity),
    hasTargets: new Uint8Array(capacity),
    slots: new Uint32Array(capacity),
  };
}

function createReservationOutput(): ReservationAcquireIntoOutput {
  return {
    ok: false,
    reason: undefined,
    claimIndex: RESERVATION_CLAIM_NONE,
    conflictingClaimId: RESERVATION_CLAIM_NONE,
    claimCount: 0,
    version: 0,
    activeCount: 0,
  };
}

function transaction(
  owner: EntityId,
  jobId: number,
  claims: readonly ReservationClaimRequest[],
): ReservationTransactionRequest {
  return { owner, jobId, createdTick: 20, leaseExpiryTick: 100, claims };
}

function expectAcquireFailureAtomic(
  ledger: ReturnType<typeof createReservationLedger>,
  registry: ReturnType<typeof createEntityRegistry>,
  request: ReservationTransactionRequest,
  scratch: ReservationAcquireIntoScratch,
  claimIds: Uint32Array,
  output: ReservationAcquireIntoOutput,
  reason: NonNullable<ReservationAcquireIntoOutput["reason"]>,
): void {
  const beforeSnapshot = ledger.createSnapshot();
  const beforeVersion = ledger.version;
  const beforeActiveCount = ledger.activeCount;
  claimIds.fill(123);
  ledger.acquireInto(request, registry, scratch, claimIds, output);
  expect(output).toMatchObject({
    ok: false,
    reason,
    claimCount: 0,
    version: beforeVersion,
    activeCount: beforeActiveCount,
  });
  expect(Array.from(claimIds).every((claimId) => claimId === RESERVATION_CLAIM_NONE)).toBe(true);
  expect(ledger.version).toBe(beforeVersion);
  expect(ledger.activeCount).toBe(beforeActiveCount);
  expect(ledger.createSnapshot()).toEqual(beforeSnapshot);
}

function createAbilityOutput(): M3AbilityQueryIntoOutput {
  return {
    ok: false,
    reason: "ability.actor_out_of_range",
    actorId: 0,
    ability: 0,
    value: 0,
    threshold: 0,
    baseValue: 0,
    conditionPenalty: 0,
    actorConditionVersion: 0,
    baseAbilityVersion: 0,
    visitedConditionCount: 0,
  };
}

function createAbilityFixture(): {
  readonly health: ReturnType<typeof createM3HealthConditionStore>;
  readonly abilities: ReturnType<typeof createM3AbilityCacheStore>;
} {
  const health = createM3HealthConditionStore({
    actorCapacity: 4,
    conditionCapacity: 4,
    abilityDirtyCapacity: 8,
  });
  const abilities = createM3AbilityCacheStore({ actorCapacity: 4, dirtyCapacity: 8 });
  expect(abilities.setBaseAbility(1, M3_ABILITY_MOVEMENT, 900)).toEqual({ ok: true });
  abilities.drainInvalidationBacklog(8);
  expect(
    health.addCondition({
      conditionId: 1,
      actorId: 1,
      defId: 1,
      kind: M3_HEALTH_CONDITION_KIND_INJURY,
      bodyPart: 1,
      severity: 200,
      ageTicks: 0,
      sourceId: 1,
      componentFlags: 0,
      clueRef: 0,
      counterevidenceRef: 0,
      terminalState: M3_HEALTH_CONDITION_ACTIVE,
      affectedAbilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT]),
    }),
  ).toMatchObject({ ok: true });
  health.drainAbilityInvalidations(abilities, 8);
  return { health, abilities };
}

function expectAbilityParity(output: M3AbilityQueryIntoOutput, legacy: M3AbilityQueryResult): void {
  expect(output).toMatchObject({
    ok: legacy.ok,
    reason: legacy.reason,
    actorId: legacy.actorId,
    ability: legacy.ability,
    value: legacy.value,
    actorConditionVersion: legacy.actorConditionVersion,
    baseAbilityVersion: legacy.baseAbilityVersion,
    visitedConditionCount: legacy.visitedConditionCount,
  });
  if (legacy.ok) {
    expect(output.baseValue).toBe(legacy.baseValue);
    expect(output.conditionPenalty).toBe(legacy.conditionPenalty);
  } else {
    expect(output.threshold).toBe(legacy.threshold);
  }
}

function failLegacyMapRead(): never {
  throw new Error("legacy materializing MapGrid method called");
}
