import { describe, expect, it } from "vitest";

import {
  MAP_TERRAIN_BLOCKED,
  createGridPathfinder,
  createMapGrid,
  createPathVersionBasis,
  createRegionRoomRebuilder,
  type MapGrid,
  type PathVersionBasis,
  type RegionRoomRebuilder,
} from "./index";
import {
  WORK_OFFER_NONE,
  createReasonTraceStore,
  createWorkOfferIndex,
  selectPathResolvedWorkOffer,
  type WorkOfferInput,
  type WorkOfferQuery,
} from "./work-offers";

describe("WorkOfferIndex", () => {
  it("registers, updates and removes offers through exact composite buckets", () => {
    const index = createTestIndex(16);
    expect(index.registerOffer(createOffer({ offerId: 3, regionId: 2 }))).toEqual({ ok: true });

    const output = new Uint32Array(4);
    expect(index.queryCandidates(createQuery({ regionId: 2 }), output)).toEqual({
      ok: true,
      count: 1,
      bucketCandidateCount: 1,
      visitedCount: 1,
      candidateCapHit: false,
      outputTruncated: false,
    });
    expect([...output.slice(0, 1)]).toEqual([3]);

    expect(index.updateOffer(createOffer({ offerId: 3, regionId: 4, scoreMilli: 8_000 }))).toEqual({
      ok: true,
    });
    expect(index.queryCandidates(createQuery({ regionId: 2 }), output)).toMatchObject({
      ok: true,
      count: 0,
      bucketCandidateCount: 0,
    });
    expect(index.queryCandidates(createQuery({ regionId: 4 }), output)).toMatchObject({
      ok: true,
      count: 1,
      bucketCandidateCount: 1,
    });
    expect(index.readOffer(3)?.scoreMilli).toBe(8_000);

    expect(index.removeOffer(3)).toEqual({ ok: true });
    expect(index.queryCandidates(createQuery({ regionId: 4 }), output)).toMatchObject({
      ok: true,
      count: 0,
      bucketCandidateCount: 0,
    });
    expect(index.createMetrics().activeOfferCount).toBe(0);
  });

  it("separates candidates by work type, region, def, urgency and permission", () => {
    const index = createTestIndex(16);
    expect(index.registerOffer(createOffer({ offerId: 1, permissionId: 1 }))).toEqual({ ok: true });
    expect(index.registerOffer(createOffer({ offerId: 2, permissionId: 2 }))).toEqual({ ok: true });
    expect(
      index.registerOffer(createOffer({ offerId: 3, urgencyBucket: 2, permissionId: 1 })),
    ).toEqual({
      ok: true,
    });

    const output = new Uint32Array(4);
    expect(index.queryCandidates(createQuery({ permissionId: 1 }), output)).toMatchObject({
      ok: true,
      count: 1,
      bucketCandidateCount: 1,
    });
    expect(output[0]).toBe(1);

    expect(index.queryCandidates(createQuery({ permissionId: 2 }), output)).toMatchObject({
      ok: true,
      count: 1,
      bucketCandidateCount: 1,
    });
    expect(output[0]).toBe(2);

    expect(
      index.queryCandidates(createQuery({ urgencyBucket: 2, permissionId: 1 }), output),
    ).toMatchObject({
      ok: true,
      count: 1,
      bucketCandidateCount: 1,
    });
    expect(output[0]).toBe(3);
  });

  it("bounds candidate lookup without traversing the full bucket", () => {
    const index = createTestIndex(16);

    for (let offerId = 0; offerId < 6; offerId += 1) {
      expect(index.registerOffer(createOffer({ offerId }))).toEqual({ ok: true });
    }

    const output = new Uint32Array(3);
    expect(index.queryCandidates(createQuery({ candidateCap: 3 }), output)).toEqual({
      ok: true,
      count: 3,
      bucketCandidateCount: 6,
      visitedCount: 3,
      candidateCapHit: true,
      outputTruncated: true,
    });
    expect([...output]).toEqual([0, 1, 2]);
  });

  it("selects top offers only from the bounded candidate input", () => {
    const index = createTestIndex(16);
    const scores = [1_000, 9_000, 4_000, 9_000, 20_000, 30_000];

    for (let offerId = 0; offerId < scores.length; offerId += 1) {
      expect(
        index.registerOffer(createOffer({ offerId, scoreMilli: scores[offerId] ?? 0 })),
      ).toEqual({
        ok: true,
      });
    }

    const candidateScratch = new Uint32Array(4);
    const selectedOfferIds = new Uint32Array(2);
    const selectedScores = new Int32Array(2);
    const result = index.selectTopOffers(
      {
        ...createQuery({ candidateCap: 4 }),
        pawnId: 7,
        maxSelectedOffers: 2,
      },
      candidateScratch,
      selectedOfferIds,
      selectedScores,
    );

    expect(result).toEqual({
      ok: true,
      selectedCount: 2,
      bucketCandidateCount: 6,
      visitedCount: 4,
      scoredCount: 4,
      rejectedByCandidateCap: 2,
      traceSequence: 0,
    });
    expect([...selectedOfferIds]).toEqual([1, 3]);
    expect([...selectedScores]).toEqual([9_000, 9_000]);
  });

  it("records bounded reason traces in newest-first ring order", () => {
    const index = createTestIndex(16);
    const traces = createReasonTraceStore(2);
    const candidateScratch = new Uint32Array(2);
    const selectedOfferIds = new Uint32Array(1);
    const selectedScores = new Int32Array(1);

    for (let offerId = 0; offerId < 4; offerId += 1) {
      expect(index.registerOffer(createOffer({ offerId, scoreMilli: 1_000 + offerId }))).toEqual({
        ok: true,
      });
    }

    for (let pawnId = 10; pawnId < 13; pawnId += 1) {
      expect(
        index.selectTopOffers(
          {
            ...createQuery({ candidateCap: 2 }),
            pawnId,
            maxSelectedOffers: 1,
          },
          candidateScratch,
          selectedOfferIds,
          selectedScores,
          traces,
        ),
      ).toMatchObject({ ok: true, rejectedByCandidateCap: 2 });
    }

    expect(traces.createMetrics()).toEqual({
      capacity: 2,
      storedCount: 2,
      nextSequence: 4,
      backlogCount: 0,
    });
    expect(traces.readNewest(0)).toMatchObject({
      sequence: 3,
      pawnId: 12,
      bucketCandidateCount: 4,
      visitedCount: 2,
      scoredCount: 2,
      candidateCap: 2,
      selectedCap: 1,
      selectedOfferId: 1,
      selectedScoreMilli: 1_001,
      rejectedByCandidateCap: 2,
      reason: "work_offer_candidate_cap",
    });
    expect(traces.readNewest(1)?.sequence).toBe(2);
    expect(traces.readNewest(2)).toBeUndefined();
  });

  it("records no-candidate traces with a stable none sentinel", () => {
    const index = createTestIndex(4);
    const traces = createReasonTraceStore(4);
    const result = index.selectTopOffers(
      {
        ...createQuery({ candidateCap: 2 }),
        pawnId: 99,
        maxSelectedOffers: 1,
      },
      new Uint32Array(2),
      new Uint32Array(1),
      new Int32Array(1),
      traces,
    );

    expect(result).toMatchObject({
      ok: true,
      selectedCount: 0,
      bucketCandidateCount: 0,
      rejectedByCandidateCap: 0,
      traceSequence: 1,
    });
    expect(traces.readNewest(0)).toMatchObject({
      selectedOfferId: WORK_OFFER_NONE,
      reason: "work_offer_no_candidate",
    });
  });

  it("path-resolves only indexed Top-K work candidates with deterministic ordering", () => {
    const fixture = createWorkPathFixture(8, 4);
    const index = createTestIndex(12);

    for (let offerId = 0; offerId < 6; offerId += 1) {
      expect(
        index.registerOffer(
          createOffer({
            offerId,
            regionId: fixture.originRegionId,
            targetCellIndex: offerId + 1,
            scoreMilli: offerId === 3 || offerId === 4 ? 9_000 : 1_000 + offerId,
          }),
        ),
      ).toEqual({ ok: true });
    }

    expect(index.registerOffer(createOffer({ offerId: 10, workType: 2 }))).toEqual({ ok: true });

    const result = selectPathResolvedWorkOffer(
      index,
      fixture.grid,
      createGridPathfinder(fixture.grid.cellCount),
      {
        ...createQuery({
          regionId: fixture.originRegionId,
          candidateCap: 6,
        }),
        pawnId: 1,
        maxSelectedOffers: 3,
        originCellIndex: 0,
        originRegionId: fixture.originRegionId,
        issuedTick: 4,
        requestSequenceStart: 100,
        basis: fixture.basis,
        currentBasis: fixture.basis,
        maxExactPaths: 2,
      },
      createPathScratch(6, 3),
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "work_path_selected",
      selectedOfferId: 3,
      bucketCandidateCount: 6,
      visitedCount: 6,
      scoredCount: 6,
      selectedCount: 3,
      rejectedByCandidateCap: 0,
      exactPathCount: 1,
      exactPathCapHit: true,
    });
  });

  it("rejects stale path basis before exposing a selected work path", () => {
    const fixture = createWorkPathFixture(6, 4);
    const index = createTestIndex(4);

    expect(
      index.registerOffer(
        createOffer({
          offerId: 0,
          regionId: fixture.originRegionId,
          targetCellIndex: fixture.grid.cellCount - 1,
          scoreMilli: 9_000,
        }),
      ),
    ).toEqual({ ok: true });

    expect(fixture.grid.updateCell(1, 0, { walkCostMilli: 2_000 }).ok).toBe(true);
    const changedBasis = basisFrom(fixture.grid, fixture.rebuild);
    const result = selectPathResolvedWorkOffer(
      index,
      fixture.grid,
      createGridPathfinder(fixture.grid.cellCount),
      {
        ...createQuery({ regionId: fixture.originRegionId, candidateCap: 1 }),
        pawnId: 2,
        maxSelectedOffers: 1,
        originCellIndex: 0,
        originRegionId: fixture.originRegionId,
        issuedTick: 5,
        requestSequenceStart: 200,
        basis: fixture.basis,
        currentBasis: changedBasis,
        maxExactPaths: 1,
      },
      createPathScratch(1, 1),
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "work_path_version_basis_stale",
      selectedOfferId: WORK_OFFER_NONE,
      staleRejectedCount: 1,
      exactPathCount: 1,
    });
  });

  it("distinguishes region-unreachable, blocked and node-budget work path reasons", () => {
    const regionFixture = createWorkPathFixture(6, 3);
    const regionIndex = createTestIndex(4);
    expect(
      regionIndex.registerOffer(
        createOffer({
          offerId: 0,
          regionId: regionFixture.originRegionId,
          targetCellIndex: 5,
          scoreMilli: 9_000,
        }),
      ),
    ).toEqual({ ok: true });

    for (let y = 0; y < regionFixture.grid.height; y += 1) {
      expect(regionFixture.grid.updateCell(3, y, { terrain: MAP_TERRAIN_BLOCKED }).ok).toBe(true);
      expect(regionFixture.rebuild.markCellDirty(3, y)).toMatchObject({ ok: true });
    }

    drainRegionRoom(regionFixture.rebuild);
    const regionChangedBasis = basisFrom(regionFixture.grid, regionFixture.rebuild);
    expect(
      selectPathResolvedWorkOffer(
        regionIndex,
        regionFixture.grid,
        createGridPathfinder(regionFixture.grid.cellCount),
        {
          ...createQuery({ regionId: regionFixture.originRegionId, candidateCap: 1 }),
          pawnId: 3,
          maxSelectedOffers: 1,
          originCellIndex: 0,
          originRegionId: regionFixture.originRegionId,
          issuedTick: 6,
          requestSequenceStart: 300,
          basis: regionChangedBasis,
          currentBasis: regionChangedBasis,
          maxExactPaths: 1,
        },
        createPathScratch(1, 1),
      ),
    ).toMatchObject({
      ok: true,
      reason: "work_path_region_unreachable",
      regionRejectedCount: 1,
      exactPathCount: 0,
    });

    const blockedFixture = createWorkPathFixture(4, 4);
    const blockedIndex = createTestIndex(4);
    expect(blockedFixture.grid.updateCell(1, 0, { terrain: MAP_TERRAIN_BLOCKED }).ok).toBe(true);
    const blockedBasis = basisFrom(blockedFixture.grid, blockedFixture.rebuild);
    expect(
      blockedIndex.registerOffer(
        createOffer({
          offerId: 0,
          regionId: blockedFixture.originRegionId,
          targetCellIndex: 1,
          scoreMilli: 9_000,
        }),
      ),
    ).toEqual({ ok: true });
    expect(
      selectPathResolvedWorkOffer(
        blockedIndex,
        blockedFixture.grid,
        createGridPathfinder(blockedFixture.grid.cellCount),
        {
          ...createQuery({ regionId: blockedFixture.originRegionId, candidateCap: 1 }),
          pawnId: 4,
          maxSelectedOffers: 1,
          originCellIndex: 0,
          originRegionId: blockedFixture.originRegionId,
          issuedTick: 7,
          requestSequenceStart: 400,
          basis: blockedBasis,
          currentBasis: blockedBasis,
          maxExactPaths: 1,
        },
        createPathScratch(1, 1),
      ),
    ).toMatchObject({
      ok: true,
      reason: "work_path_blocked",
      blockedRejectedCount: 1,
      exactPathCount: 0,
    });

    const budgetFixture = createWorkPathFixture(8, 8);
    const budgetIndex = createTestIndex(4);
    expect(
      budgetIndex.registerOffer(
        createOffer({
          offerId: 0,
          regionId: budgetFixture.originRegionId,
          targetCellIndex: 63,
          scoreMilli: 9_000,
        }),
      ),
    ).toEqual({ ok: true });
    expect(
      selectPathResolvedWorkOffer(
        budgetIndex,
        budgetFixture.grid,
        createGridPathfinder(budgetFixture.grid.cellCount),
        {
          ...createQuery({ regionId: budgetFixture.originRegionId, candidateCap: 1 }),
          pawnId: 5,
          maxSelectedOffers: 1,
          originCellIndex: 0,
          originRegionId: budgetFixture.originRegionId,
          issuedTick: 8,
          requestSequenceStart: 500,
          basis: budgetFixture.basis,
          currentBasis: budgetFixture.basis,
          maxExactPaths: 1,
          maxNodeExpansions: 1,
        },
        createPathScratch(1, 1),
      ),
    ).toMatchObject({
      ok: true,
      reason: "work_path_node_budget_exhausted",
      nodeBudgetRejectedCount: 1,
      exactPathCount: 1,
    });
  });
});

function createTestIndex(capacity: number): ReturnType<typeof createWorkOfferIndex> {
  return createWorkOfferIndex({
    capacity,
    workTypeCapacity: 4,
    regionCapacity: 8,
    defCapacity: 4,
    urgencyBucketCount: 4,
    permissionCapacity: 4,
  });
}

function createOffer(overrides: Partial<WorkOfferInput> = {}): WorkOfferInput {
  return {
    offerId: 0,
    workType: 1,
    regionId: 2,
    defId: 1,
    urgencyBucket: 1,
    permissionId: 1,
    targetId: 100,
    targetCellIndex: 200,
    scoreMilli: 1_000,
    ...overrides,
  };
}

function createQuery(overrides: Partial<WorkOfferQuery> = {}): WorkOfferQuery {
  return {
    workType: 1,
    regionId: 2,
    defId: 1,
    urgencyBucket: 1,
    permissionId: 1,
    candidateCap: 8,
    ...overrides,
  };
}

function createWorkPathFixture(
  width: number,
  height: number,
): {
  readonly grid: MapGrid;
  readonly rebuild: RegionRoomRebuilder;
  readonly basis: PathVersionBasis;
  readonly originRegionId: number;
} {
  const grid = createMapGrid({ width, height, chunkSize: Math.max(width, height) });
  const rebuild = createRegionRoomRebuilder(grid);
  expect(rebuild.markAllDirtyForLoad()).toMatchObject({ ok: true });
  drainRegionRoom(rebuild);
  const origin = grid.readCellByIndex(0);

  if (!origin.ok) {
    throw new Error(origin.reason);
  }

  return {
    grid,
    rebuild,
    basis: basisFrom(grid, rebuild),
    originRegionId: origin.cell.regionId,
  };
}

function basisFrom(grid: MapGrid, rebuild: RegionRoomRebuilder): PathVersionBasis {
  return createPathVersionBasis(grid, {
    navigationVersion: rebuild.navigationVersion,
    regionVersion: rebuild.regionVersion,
    roomVersion: rebuild.roomVersion,
    regionGraphVersion: rebuild.regionGraphVersion,
  });
}

function createPathScratch(
  candidateCap: number,
  selectedCap: number,
): {
  readonly candidateOfferIds: Uint32Array;
  readonly selectedOfferIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
} {
  return {
    candidateOfferIds: new Uint32Array(candidateCap),
    selectedOfferIds: new Uint32Array(selectedCap),
    selectedScoresMilli: new Int32Array(selectedCap),
  };
}

function drainRegionRoom(rebuild: RegionRoomRebuilder): void {
  let guard = 0;

  while (guard < 256) {
    const processed = rebuild.processDirtyCells(128);

    if (!processed.ok) {
      throw new Error(processed.reason);
    }

    if (processed.remainingDirtyCells === 0 && processed.activeCellBacklog === 0) {
      return;
    }

    guard += 1;
  }

  throw new Error("work-offer path-selection region-room drain guard exhausted");
}
