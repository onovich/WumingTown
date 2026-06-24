import { describe, expect, it } from "vitest";

import {
  WORK_OFFER_NONE,
  createReasonTraceStore,
  createWorkOfferIndex,
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
