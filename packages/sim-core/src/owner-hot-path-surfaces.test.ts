import * as ts from "typescript";
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
  isSafeTick,
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
import {
  directionMask as auditMapDirectionMask,
  oppositeDirection as auditMapOppositeDirection,
} from "./map-grid";
import {
  abilityMaskFor as auditM3AbilityMaskFor,
  clampAbilityValue as auditM3ClampAbilityValue,
  isAbilityLane as auditM3IsAbilityLane,
  isIndexInRange as auditM3IsIndexInRange,
  isSeverity as auditM3IsSeverity,
  laneIndex as auditM3LaneIndex,
} from "./m3-health";
import {
  isCellIndexInRange as auditPathIsCellIndexInRange,
  isPositiveSafeInteger as auditPathIsPositiveSafeInteger,
  isSafeNonNegativeInteger as auditPathIsSafeNonNegativeInteger,
} from "./pathing";
import {
  isIndexInRange as auditReservationIsIndexInRange,
  isPositiveUint32 as auditReservationIsPositiveUint32,
  isSafeUint32 as auditReservationIsSafeUint32,
  readPreparedChannelCode as auditReservationReadPreparedChannelCode,
} from "./reservation-ledger";
import {
  clearSelection as auditWorkOfferClearSelection,
  createCompositeKey as auditWorkOfferCreateCompositeKey,
  insertSorted as auditWorkOfferInsertSorted,
  insertTopOffer as auditWorkOfferInsertTopOffer,
  isBetterOffer as auditWorkOfferIsBetterOffer,
  isIndexInRange as auditWorkOfferIsIndexInRange,
  isInt32 as auditWorkOfferIsInt32,
  isPositiveSafeInteger as auditWorkOfferIsPositiveSafeInteger,
  isSafeNonNegativeInteger as auditWorkOfferIsSafeNonNegativeInteger,
  isUint32 as auditWorkOfferIsUint32,
  removeLinked as auditWorkOfferRemoveLinked,
} from "./work-offers";

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
    if (!legacy.ok) throw new Error("expected legacy path success");

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
    expect(Array.from(route.slice(0, output.pathCellCount))).toEqual(Array.from(legacy.path));
    expect(output.pathCostMilli).toBe(legacy.pathCostMilli);
    expect(output.nodeExpansions).toBe(legacy.nodeExpansions);
    expect(legacyCell).not.toHaveBeenCalled();
    expect(legacyMove).not.toHaveBeenCalled();
    expect(legacyRead).not.toHaveBeenCalled();
    expect(output).toBe(outputIdentity);
    expect(route).toBe(routeIdentity);

    const shortRoute = new Uint32Array([777]);
    const shortRouteIdentity = shortRoute;
    pathfinder.findPathInto(grid, request, shortRoute, output);
    expect(output).toMatchObject({
      ok: false,
      reason: "path_output_capacity_exceeded",
      requestSequence: request.requestSequence,
      startCellIndex: request.startCellIndex,
      goalCellIndex: request.goalCellIndex,
      mapVersion: request.basis.mapVersion,
      navigationVersion: request.basis.navigationVersion,
      regionVersion: request.basis.regionVersion,
      roomVersion: request.basis.roomVersion,
      regionGraphVersion: request.basis.regionGraphVersion,
      pathCellCount: 7,
      pathCostMilli: legacy.pathCostMilli,
      nodeExpansions: legacy.nodeExpansions,
    });
    expect(Array.from(shortRoute)).toEqual([777]);
    expect(shortRoute).toBe(shortRouteIdentity);
    expect(output).toBe(outputIdentity);

    const trivialRequest = createPathRequest(grid.globalVersion, 5, 5);
    const zeroRoute = new Uint32Array(0);
    const zeroRouteIdentity = zeroRoute;
    pathfinder.findPathInto(grid, trivialRequest, zeroRoute, output);
    expect(output).toMatchObject({
      ok: false,
      reason: "path_output_capacity_exceeded",
      requestSequence: trivialRequest.requestSequence,
      startCellIndex: trivialRequest.startCellIndex,
      goalCellIndex: trivialRequest.goalCellIndex,
      mapVersion: trivialRequest.basis.mapVersion,
      navigationVersion: trivialRequest.basis.navigationVersion,
      regionVersion: trivialRequest.basis.regionVersion,
      roomVersion: trivialRequest.basis.roomVersion,
      regionGraphVersion: trivialRequest.basis.regionGraphVersion,
      pathCellCount: 1,
      pathCostMilli: 0,
      nodeExpansions: 0,
    });
    expect(Array.from(zeroRoute)).toEqual([]);
    expect(zeroRoute).toBe(zeroRouteIdentity);
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

  it("closes all Into hot call chains over allocation-free audited sources", () => {
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
    const registry = createEntityRegistry({ capacity: 2 });
    const targets: HotAuditTargets = {
      map,
      pathfinder,
      offers,
      ledger,
      registry,
      health,
      abilities,
    };
    const roots = createRootHotAuditEntries(targets);
    const classHelpers = createClassHelperHotAuditEntries(targets);
    const freeHelpers = createFreeHelperHotAuditEntries();
    const entries = [...roots, ...classHelpers, ...freeHelpers];
    const labels = new Set<string>();
    for (const entry of entries) labels.add(entry.label);

    expect(roots).toHaveLength(11);
    expect(classHelpers).toHaveLength(42);
    expect(freeHelpers).toHaveLength(27);
    expect(entries).toHaveLength(80);
    expect(labels.size).toBe(80);

    const resolver = createHotAuditResolver(entries);
    for (const entry of entries) {
      const category = containsForbiddenHotConstruction(entry.source);
      expect(
        category,
        `${entry.label}: ${category ?? "no forbidden construction"}`,
      ).toBeUndefined();
      const unresolved = findUnresolvedHotCall(entry, resolver);
      expect(unresolved, `${entry.label}: ${unresolved ?? "call chain closed"}`).toBeUndefined();
    }
  });

  it("detects every forbidden construction category without rejecting scalar hot syntax", () => {
    for (const fixture of FORBIDDEN_HOT_CONSTRUCTION_FIXTURES) {
      expect(containsForbiddenHotConstruction(fixture.source), fixture.label).toBe(
        fixture.category,
      );
    }
    for (const fixture of ALLOWED_HOT_SYNTAX_FIXTURES) {
      expect(
        containsForbiddenHotConstruction(fixture.source),
        `${fixture.label}: scalar syntax must remain allowed`,
      ).toBeUndefined();
    }

    const hiddenHelperEntry: HotSourceAuditEntry = {
      label: "regression.hiddenHelper",
      moduleName: "path",
      callName: "regression",
      source: "function regression() { hiddenHelper(); }",
    };
    expect(
      findUnresolvedHotCall(hiddenHelperEntry, createHotAuditResolver([])),
      "otherwise-valid hiddenHelper() must fail transitive closure",
    ).toBe("unresolved project call hiddenHelper");

    for (const callName of ["get", "set", "fill"]) {
      const fakeReceiverEntry: HotSourceAuditEntry = {
        label: `regression.fake.${callName}`,
        moduleName: "path",
        callName: "regression",
        source: `function regression(fake) { fake.${callName}(); }`,
      };
      expect(containsForbiddenHotConstruction(fakeReceiverEntry.source)).toBeUndefined();
      expect(
        findUnresolvedHotCall(fakeReceiverEntry, createHotAuditResolver([])),
        `fake.${callName} must not enter the typed-array/Map native allowlist`,
      ).toBe(`unresolved project call fake.${callName}`);
    }

    const foreignFailInternalEntry: HotSourceAuditEntry = {
      label: "GridPathfinder.regression",
      moduleName: "path",
      ownerName: "GridPathfinder",
      callName: "regression",
      source: "function regression() { failInternal('unexpected'); }",
    };
    expect(containsForbiddenHotConstruction(foreignFailInternalEntry.source)).toBeUndefined();
    expect(
      findUnresolvedHotCall(foreignFailInternalEntry, createHotAuditResolver([])),
      "failInternal is allowed only for the reviewed ReservationLedger.allocateClaimId sink",
    ).toBe("unresolved project call failInternal");
  });
});

type HotAuditModuleName = "map" | "path" | "work" | "reservation" | "m3";

interface HotAuditTargets {
  readonly map: ReturnType<typeof createMapGrid>;
  readonly pathfinder: ReturnType<typeof createGridPathfinder>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly health: ReturnType<typeof createM3HealthConditionStore>;
  readonly abilities: ReturnType<typeof createM3AbilityCacheStore>;
}

interface HotSourceAuditEntry {
  readonly label: string;
  readonly moduleName: HotAuditModuleName;
  readonly ownerName?: string;
  readonly callName: string;
  readonly source: string;
}

interface HotAuditResolver {
  readonly labels: ReadonlySet<string>;
  readonly classLabels: ReadonlyMap<string, string>;
  readonly freeLabels: ReadonlyMap<string, string>;
}

interface ParsedHotSource {
  readonly sourceFile: ts.SourceFile;
  readonly body: ts.Block;
}

interface HotCall {
  readonly kind: "bare" | "this" | "property" | "indirect";
  readonly callName: string;
  readonly receiver?: string;
}

interface ForbiddenHotConstructionFixture {
  readonly label: string;
  readonly source: string;
  readonly category: string;
}

interface AllowedHotSyntaxFixture {
  readonly label: string;
  readonly source: string;
}

const FORBIDDEN_PROPERTY_CALLS = new Set([
  "toString",
  "concat",
  "join",
  "map",
  "filter",
  "reduce",
  "flatMap",
  "slice",
  "split",
  "replace",
]);

const ALLOWED_TYPED_ARRAY_FILL_RECEIVERS = new Set([
  "claimIdOutput",
  "this.seenEpoch",
  "this.closedEpoch",
]);

const ALLOWED_MAP_RECEIVERS = new Set([
  "this.entityClaims",
  "this.cellClaims",
  "this.itemQuantityAmounts",
  "this.interactionClaims",
  "this.capacityAmounts",
]);

const FORBIDDEN_HOT_CONSTRUCTION_FIXTURES: readonly ForbiddenHotConstructionFixture[] = [
  {
    label: "new object",
    source: "function audit() { const value = new Date(); }",
    category: "new expression",
  },
  {
    label: "new typed array",
    source: "function audit() { const value = new Uint32Array(1); }",
    category: "new expression",
  },
  {
    label: "Array call",
    source: "function audit() { const value = Array(1); }",
    category: "forbidden call Array",
  },
  {
    label: "object literal assignment",
    source: "function audit() { const value = { count: 1 }; }",
    category: "object literal",
  },
  {
    label: "object literal return",
    source: "function audit() { return { count: 1 }; }",
    category: "object literal",
  },
  {
    label: "object literal argument",
    source: "function audit() { consume({ count: 1 }); }",
    category: "object literal",
  },
  {
    label: "array literal assignment",
    source: "function audit() { const value = [1]; }",
    category: "array literal",
  },
  {
    label: "array literal return",
    source: "function audit() { return [1]; }",
    category: "array literal",
  },
  {
    label: "array literal argument",
    source: "function audit() { consume([1]); }",
    category: "array literal",
  },
  {
    label: "nested arrow",
    source: "function audit() { const nested = () => 1; }",
    category: "nested arrow function",
  },
  {
    label: "nested function declaration",
    source: "function audit() { function nested() { return 1; } }",
    category: "nested function",
  },
  {
    label: "nested function expression",
    source: "function audit() { const nested = function named() { return 1; }; }",
    category: "nested function",
  },
  {
    label: "nested class declaration",
    source: "function audit() { class Nested {} }",
    category: "nested class",
  },
  {
    label: "nested class expression",
    source: "function audit() { const Nested = class {}; }",
    category: "nested class",
  },
  {
    label: "template expression",
    source: "function audit(name) { const value = `hello ${name}`; }",
    category: "template literal",
  },
  {
    label: "no-substitution backtick",
    source: "function audit() { const value = `literal`; }",
    category: "template literal",
  },
  {
    label: "tagged template",
    source: "function audit(value) { tag`value ${value}`; }",
    category: "tagged template",
  },
  {
    label: "regex literal",
    source: "function audit(value) { return /value/u.test(value); }",
    category: "regex literal",
  },
  {
    label: "String conversion",
    source: "function audit(value) { return String(value); }",
    category: "forbidden call String",
  },
  {
    label: "toString call",
    source: "function audit(value) { return value.toString(); }",
    category: "forbidden call .toString",
  },
  {
    label: "concat call",
    source: "function audit(value) { return value.concat('x'); }",
    category: "forbidden call .concat",
  },
  {
    label: "join call",
    source: "function audit(value) { return value.join(','); }",
    category: "forbidden call .join",
  },
  ...createForbiddenPropertyCallFixtures(),
  ...createForbiddenFactoryCallFixtures(),
  {
    label: "string literal left plus",
    source: "function audit(value) { return 'prefix' + value; }",
    category: "string-producing plus",
  },
  {
    label: "string literal right plus",
    source: "function audit(value) { return value + 'suffix'; }",
    category: "string-producing plus",
  },
  {
    label: "string plus equals",
    source: "function audit(value) { value += 'suffix'; }",
    category: "string-producing plus-equals",
  },
];

const ALLOWED_HOT_SYNTAX_FIXTURES: readonly AllowedHotSyntaxFixture[] = [
  { label: "numeric plus", source: "function audit(left, right) { return left + right; }" },
  { label: "numeric plus equals", source: "function audit(value) { value += 1; }" },
  {
    label: "bitwise operators",
    source: "function audit(left, right) { return (left | right) & 3; }",
  },
  {
    label: "property writes",
    source: "function audit(output) { output.ok = false; output.count = 1; }",
  },
  {
    label: "typed index writes",
    source: "function audit(lane, index, value) { lane[index] = value; }",
  },
  {
    label: "control blocks",
    source: "function audit(output, value) { if (value > 0) { output.ok = true; } }",
  },
  {
    label: "constant reason string",
    source: "function audit(output) { output.reason = 'constant_reason'; }",
  },
];

function createRootHotAuditEntries(targets: HotAuditTargets): readonly HotSourceAuditEntry[] {
  return [
    classAuditEntry("MapGrid", "map", targets.map, "readMovementCellByIndexInto"),
    classAuditEntry("MapGrid", "map", targets.map, "canMoveBetweenCardinalNeighborsInto"),
    classAuditEntry("GridPathfinder", "path", targets.pathfinder, "findPathInto"),
    classAuditEntry("WorkOfferIndex", "work", targets.offers, "registerOfferInto"),
    classAuditEntry("WorkOfferIndex", "work", targets.offers, "updateOfferInto"),
    classAuditEntry("WorkOfferIndex", "work", targets.offers, "removeOfferInto"),
    classAuditEntry("WorkOfferIndex", "work", targets.offers, "readOfferInto"),
    classAuditEntry("WorkOfferIndex", "work", targets.offers, "selectTopOffersInto"),
    classAuditEntry("ReservationLedger", "reservation", targets.ledger, "acquireInto"),
    classAuditEntry("M3HealthConditionStore", "m3", targets.health, "computeAbilityPenaltyInto"),
    classAuditEntry("M3AbilityCacheStore", "m3", targets.abilities, "queryAbilityInto"),
  ];
}

function createClassHelperHotAuditEntries(
  targets: HotAuditTargets,
): readonly HotSourceAuditEntry[] {
  return [
    ...classAuditEntries("MapGrid", "map", targets.map, [
      "isCellIndexInRange",
      "isCellPassableUnchecked",
      "directionBetweenCardinalNeighbors",
      "canMoveBetweenUnchecked",
    ]),
    ...classAuditEntries("GridPathfinder", "path", targets.pathfinder, [
      "resetIntoOutput",
      "validateRequestReason",
      "tryRelaxNeighborInto",
      "readPassableMovementCellInto",
      "writeFoundPathInto",
      "selectBestOpenIndex",
      "nextSearchEpoch",
      "heuristicMilli",
      "neighborIndex",
    ]),
    ...classAuditEntries("WorkOfferIndex", "work", targets.offers, [
      "resetMutationInto",
      "resetReadInto",
      "resetSelectionInto",
      "writeMutationSuccess",
      "validateVersionedInputReason",
      "validateKeyReason",
      "validateSelectionIntoReason",
      "canAdvanceVersions",
      "advanceVersions",
      "writeOffer",
      "insertOffer",
      "removeOfferFromCurrentBucket",
      "createCompositeKeyForOffer",
    ]),
    ...classAuditEntries("ReservationLedger", "reservation", targets.ledger, [
      "resetAcquireIntoOutput",
      "hasAcquireScratchCapacity",
      "validateTransactionHeaderInto",
      "validateEntityReason",
      "prepareClaimInto",
      "writePreparedClaimInto",
      "addToTargetIndexInto",
      "allocateClaimId",
      "linkOwner",
      "linkTarget",
      "incrementChannelCount",
      "encodeSlotKey",
    ]),
    ...classAuditEntries("EntityRegistry", "reservation", targets.registry, [
      "isIndexActive",
      "generationAt",
    ]),
    classAuditEntry("M3HealthConditionStore", "m3", targets.health, "actorConditionVersion"),
    classAuditEntry("M3AbilityCacheStore", "m3", targets.abilities, "resetAbilityIntoOutput"),
  ];
}

function createFreeHelperHotAuditEntries(): readonly HotSourceAuditEntry[] {
  return [
    functionAuditEntry("map", auditMapDirectionMask),
    functionAuditEntry("map", auditMapOppositeDirection),
    functionAuditEntry("path", auditPathIsCellIndexInRange),
    functionAuditEntry("path", auditPathIsPositiveSafeInteger),
    functionAuditEntry("path", auditPathIsSafeNonNegativeInteger),
    functionAuditEntry("work", auditWorkOfferCreateCompositeKey),
    functionAuditEntry("work", auditWorkOfferInsertSorted),
    functionAuditEntry("work", auditWorkOfferRemoveLinked),
    functionAuditEntry("work", auditWorkOfferInsertTopOffer),
    functionAuditEntry("work", auditWorkOfferClearSelection),
    functionAuditEntry("work", auditWorkOfferIsBetterOffer),
    functionAuditEntry("work", auditWorkOfferIsIndexInRange),
    functionAuditEntry("work", auditWorkOfferIsPositiveSafeInteger),
    functionAuditEntry("work", auditWorkOfferIsSafeNonNegativeInteger),
    functionAuditEntry("work", auditWorkOfferIsUint32),
    functionAuditEntry("work", auditWorkOfferIsInt32),
    functionAuditEntry("reservation", auditReservationReadPreparedChannelCode),
    functionAuditEntry("reservation", auditReservationIsPositiveUint32),
    functionAuditEntry("reservation", auditReservationIsSafeUint32),
    functionAuditEntry("reservation", auditReservationIsIndexInRange),
    functionAuditEntry("reservation", isSafeTick, "time.isSafeTick"),
    functionAuditEntry("m3", auditM3AbilityMaskFor),
    functionAuditEntry("m3", auditM3LaneIndex),
    functionAuditEntry("m3", auditM3IsIndexInRange),
    functionAuditEntry("m3", auditM3IsAbilityLane),
    functionAuditEntry("m3", auditM3IsSeverity),
    functionAuditEntry("m3", auditM3ClampAbilityValue),
  ];
}

function classAuditEntries(
  ownerName: string,
  moduleName: HotAuditModuleName,
  target: object,
  methodNames: readonly string[],
): readonly HotSourceAuditEntry[] {
  const entries: HotSourceAuditEntry[] = [];
  for (const methodName of methodNames) {
    entries.push(classAuditEntry(ownerName, moduleName, target, methodName));
  }
  return entries;
}

function classAuditEntry(
  ownerName: string,
  moduleName: HotAuditModuleName,
  target: object,
  methodName: string,
): HotSourceAuditEntry {
  return {
    label: `${ownerName}.${methodName}`,
    moduleName,
    ownerName,
    callName: methodName,
    source: readMethodSource(target, methodName),
  };
}

function functionAuditEntry(
  moduleName: HotAuditModuleName,
  callable: { readonly name: string },
  label = `${moduleName}.${callable.name}`,
): HotSourceAuditEntry {
  return {
    label,
    moduleName,
    callName: callable.name,
    source: Function.prototype.toString.call(callable),
  };
}

function createHotAuditResolver(entries: readonly HotSourceAuditEntry[]): HotAuditResolver {
  const labels = new Set<string>();
  const classLabels = new Map<string, string>();
  const freeLabels = new Map<string, string>();
  for (const entry of entries) {
    labels.add(entry.label);
    if (entry.ownerName === undefined) {
      freeLabels.set(`${entry.moduleName}.${entry.callName}`, entry.label);
    } else {
      classLabels.set(`${entry.ownerName}.${entry.callName}`, entry.label);
    }
  }
  return { labels, classLabels, freeLabels };
}

function containsForbiddenHotConstruction(source: string): string | undefined {
  const parsed = parseHotSource(source);
  let found: string | undefined;
  function visit(node: ts.Node): void {
    if (found !== undefined) return;
    found = forbiddenHotConstructionForNode(node);
    if (found === undefined) ts.forEachChild(node, visit);
  }
  visit(parsed.body);
  return found;
}

function forbiddenHotConstructionForNode(node: ts.Node): string | undefined {
  if (ts.isNewExpression(node)) return "new expression";
  if (ts.isObjectLiteralExpression(node)) return "object literal";
  if (ts.isArrayLiteralExpression(node)) return "array literal";
  if (ts.isArrowFunction(node)) return "nested arrow function";
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return "nested function";
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) return "nested class";
  if (ts.isTaggedTemplateExpression(node)) return "tagged template";
  if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return "template literal";
  }
  if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) return "regex literal";
  if (ts.isCallExpression(node)) return forbiddenHotCall(node);
  if (ts.isBinaryExpression(node)) return forbiddenHotStringBinary(node);
  return undefined;
}

function forbiddenHotCall(node: ts.CallExpression): string | undefined {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) {
    if (
      expression.text === "Array" ||
      expression.text === "Object" ||
      expression.text === "String"
    ) {
      return `forbidden call ${expression.text}`;
    }
    return undefined;
  }
  if (!ts.isPropertyAccessExpression(expression)) return undefined;
  const receiver = expression.expression.getText();
  const callName = expression.name.text;
  if (receiver === "Array" && (callName === "from" || callName === "of")) {
    return `forbidden call Array.${callName}`;
  }
  if (
    receiver === "Object" &&
    (callName === "create" || callName === "assign" || callName === "fromEntries")
  ) {
    return `forbidden call Object.${callName}`;
  }
  if (receiver === "JSON" && callName === "stringify") return "forbidden call JSON.stringify";
  return FORBIDDEN_PROPERTY_CALLS.has(callName) ? `forbidden call .${callName}` : undefined;
}

function forbiddenHotStringBinary(node: ts.BinaryExpression): string | undefined {
  if (
    node.operatorToken.kind !== ts.SyntaxKind.PlusToken &&
    node.operatorToken.kind !== ts.SyntaxKind.PlusEqualsToken
  ) {
    return undefined;
  }
  if (!isSyntacticallyStringProducing(node.left) && !isSyntacticallyStringProducing(node.right)) {
    return undefined;
  }
  return node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken
    ? "string-producing plus-equals"
    : "string-producing plus";
}

function isSyntacticallyStringProducing(node: ts.Expression): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return true;
  }
  if (ts.isParenthesizedExpression(node)) return isSyntacticallyStringProducing(node.expression);
  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return isSyntacticallyStringProducing(node.expression);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return isSyntacticallyStringProducing(node.left) || isSyntacticallyStringProducing(node.right);
  }
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === "String";
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const callName = node.expression.name.text;
  if (callName === "toString" || callName === "concat" || callName === "join") return true;
  if (node.expression.expression.getText() === "JSON" && callName === "stringify") return true;
  return ts.isCallExpression(node.expression.expression)
    ? isSyntacticallyStringProducing(node.expression.expression)
    : false;
}

function findUnresolvedHotCall(
  entry: HotSourceAuditEntry,
  resolver: HotAuditResolver,
): string | undefined {
  for (const call of collectHotCalls(entry.source)) {
    if (call.kind === "this") {
      const key = `${entry.ownerName ?? "<free>"}.${call.callName}`;
      if (!resolver.classLabels.has(key)) return `unresolved project call ${key}`;
      continue;
    }
    if (call.kind === "bare") {
      if (call.callName === "failInternal") {
        // acquireInto's complete capacity precheck makes this invariant sink unreachable after
        // validation; the throwing branch itself is intentionally outside the allocation-free claim.
        if (entry.label === "ReservationLedger.allocateClaimId") continue;
        return "unresolved project call failInternal";
      }
      const key = `${entry.moduleName}.${call.callName}`;
      if (!resolver.freeLabels.has(key)) return `unresolved project call ${call.callName}`;
      continue;
    }
    if (call.kind === "property" && isAllowedNativeHotCall(call)) continue;
    if (call.kind === "property") {
      const receiver = call.receiver ?? "<missing>";
      const targetLabel = PROJECT_OBJECT_HOT_CALLS.get(`${receiver}.${call.callName}`);
      if (targetLabel !== undefined && resolver.labels.has(targetLabel)) continue;
    }
    return `unresolved project call ${call.receiver ?? "<indirect>"}.${call.callName}`;
  }
  return undefined;
}

function collectHotCalls(source: string): readonly HotCall[] {
  const parsed = parseHotSource(source);
  const calls: HotCall[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) calls.push(readHotCall(node, parsed.sourceFile));
    ts.forEachChild(node, visit);
  }
  visit(parsed.body);
  return calls;
}

function readHotCall(node: ts.CallExpression, sourceFile: ts.SourceFile): HotCall {
  const transformedImportCallName = readTransformedImportCallName(node.expression);
  if (transformedImportCallName !== undefined) {
    return { kind: "bare", callName: transformedImportCallName };
  }
  if (ts.isIdentifier(node.expression)) {
    return { kind: "bare", callName: node.expression.text };
  }
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return { kind: "indirect", callName: node.expression.getText(sourceFile) };
  }
  const receiverNode = node.expression.expression;
  const callName = node.expression.name.text;
  return receiverNode.kind === ts.SyntaxKind.ThisKeyword
    ? { kind: "this", callName }
    : { kind: "property", receiver: receiverNode.getText(sourceFile), callName };
}

function readTransformedImportCallName(expression: ts.LeftHandSideExpression): string | undefined {
  if (!ts.isParenthesizedExpression(expression)) return undefined;
  const inner = expression.expression;
  if (
    !ts.isBinaryExpression(inner) ||
    inner.operatorToken.kind !== ts.SyntaxKind.CommaToken ||
    !ts.isNumericLiteral(inner.left) ||
    inner.left.text !== "0" ||
    !ts.isPropertyAccessExpression(inner.right) ||
    !ts.isIdentifier(inner.right.expression) ||
    !inner.right.expression.text.startsWith("__vite_ssr_import_")
  ) {
    return undefined;
  }
  return inner.right.name.text;
}

const PROJECT_OBJECT_HOT_CALLS = new Map<string, string>([
  ["grid.readMovementCellByIndexInto", "MapGrid.readMovementCellByIndexInto"],
  ["grid.canMoveBetweenCardinalNeighborsInto", "MapGrid.canMoveBetweenCardinalNeighborsInto"],
  ["registry.isIndexActive", "EntityRegistry.isIndexActive"],
  ["registry.generationAt", "EntityRegistry.generationAt"],
  ["conditionStore.actorConditionVersion", "M3HealthConditionStore.actorConditionVersion"],
  ["conditionStore.computeAbilityPenaltyInto", "M3HealthConditionStore.computeAbilityPenaltyInto"],
]);

function isAllowedNativeHotCall(call: HotCall): boolean {
  if (call.receiver === "Number") return call.callName === "isSafeInteger";
  if (call.receiver === "Math") {
    return (
      call.callName === "abs" ||
      call.callName === "floor" ||
      call.callName === "max" ||
      call.callName === "min"
    );
  }
  if (call.receiver === undefined) return false;
  if (call.callName === "fill") return ALLOWED_TYPED_ARRAY_FILL_RECEIVERS.has(call.receiver);
  if (call.callName === "get" || call.callName === "set") {
    return ALLOWED_MAP_RECEIVERS.has(call.receiver);
  }
  return false;
}

function parseHotSource(source: string): ParsedHotSource {
  const freeFunction = source.trimStart().startsWith("function ");
  const sourceText = freeFunction ? source : `class HotAuditWrapper { ${source} }`;
  const sourceFile = ts.createSourceFile(
    "hot-source-audit.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (freeFunction) {
    const statement = sourceFile.statements[0];
    if (
      statement !== undefined &&
      ts.isFunctionDeclaration(statement) &&
      statement.body !== undefined
    ) {
      return { sourceFile, body: statement.body };
    }
  } else {
    const statement = sourceFile.statements[0];
    const member =
      statement !== undefined && ts.isClassDeclaration(statement)
        ? statement.members[0]
        : undefined;
    if (member !== undefined && ts.isMethodDeclaration(member) && member.body !== undefined) {
      return { sourceFile, body: member.body };
    }
  }
  throw new Error("unable to parse hot source wrapper");
}

function createForbiddenPropertyCallFixtures(): readonly ForbiddenHotConstructionFixture[] {
  const fixtures: ForbiddenHotConstructionFixture[] = [];
  for (const callName of ["map", "filter", "reduce", "flatMap", "slice", "split", "replace"]) {
    fixtures.push({
      label: `${callName} call`,
      source: `function audit(value) { return value.${callName}(); }`,
      category: `forbidden call .${callName}`,
    });
  }
  return fixtures;
}

function createForbiddenFactoryCallFixtures(): readonly ForbiddenHotConstructionFixture[] {
  const definitions: readonly (readonly [string, string])[] = [
    ["Array.from", "function audit(value) { return Array.from(value); }"],
    ["Array.of", "function audit(value) { return Array.of(value); }"],
    ["Object", "function audit(value) { return Object(value); }"],
    ["Object.create", "function audit(value) { return Object.create(value); }"],
    ["Object.assign", "function audit(value) { return Object.assign(value); }"],
    ["Object.fromEntries", "function audit(value) { return Object.fromEntries(value); }"],
    ["JSON.stringify", "function audit(value) { return JSON.stringify(value); }"],
  ];
  const fixtures: ForbiddenHotConstructionFixture[] = [];
  for (const [callName, source] of definitions) {
    fixtures.push({
      label: `${callName} call`,
      source,
      category: `forbidden call ${callName}`,
    });
  }
  return fixtures;
}

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
