import { describe, expect, it } from "vitest";

import {
  NEED_ACTOR_NONE,
  NEED_LANE_COMFORT,
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_LANE_SOCIAL,
  calculateNeedUrgencyBucket,
  createNeedStore,
  createNeedUrgencyIndex,
  createNeedUrgencyTraceStore,
  type NeedStore,
  type NeedUrgencyIndex,
} from "./m3-needs";

describe("M3 NeedStore", () => {
  it("owns fixed integer lanes and exposes O(1) actor self reads", () => {
    const store = createNeedStore({ actorCapacity: 4, updateIntervalTicks: 8 });

    expect(store.registerActor(createActor({ actorId: 1, hunger: 320, rest: 420 }))).toMatchObject({
      ok: true,
      ownerVersion: 1,
      reason: "need.initialized",
    });

    expect(store.readActorNeeds(1)).toEqual({
      actorId: 1,
      hunger: 320,
      rest: 420,
      comfort: 650,
      social: 520,
      safety: 700,
      ownerVersion: 1,
    });
    expect(store.readLaneValue(1, NEED_LANE_HUNGER)).toBe(320);
    expect(store.readLaneValue(1, NEED_LANE_REST)).toBe(420);
    expect(store.readLaneValue(1, NEED_LANE_COMFORT)).toBe(650);
    expect(store.readLaneValue(1, NEED_LANE_SOCIAL)).toBe(520);
    expect(store.readLaneValue(1, NEED_LANE_SAFETY)).toBe(700);
    expect(store.readActorNeeds(3)).toBeUndefined();
  });

  it("runs deterministic phase-staggered scheduled updates from phase buckets", () => {
    const store = createNeedStore({ actorCapacity: 3, updateIntervalTicks: 8 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.registerActor(createActor({ actorId: 1, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });

    expect(store.readLaneUpdatePhase(0, NEED_LANE_HUNGER)).toBe(0);
    expect(store.readLaneUpdatePhase(0, NEED_LANE_REST)).toBe(1);
    expect(store.readLaneUpdatePhase(1, NEED_LANE_HUNGER)).toBe(5);
    expect(store.readLaneUpdatePhase(1, NEED_LANE_SAFETY)).toBe(1);

    const result = store.processScheduledUpdates(1, new Int32Array([-10, -20, -30, -40, -50]), 8);

    expect(result).toEqual({
      ok: true,
      tick: 1,
      phase: 1,
      visitedCount: 2,
      changedCount: 2,
      budgetExhausted: false,
      version: 4,
    });
    expect(store.readLaneValue(0, NEED_LANE_REST)).toBe(480);
    expect(store.readLaneValue(1, NEED_LANE_SAFETY)).toBe(650);
    expect(store.readLaneLastChange(0, NEED_LANE_REST)).toMatchObject({
      tick: 1,
      reason: "need.scheduled_decay",
      previousValue: 500,
      nextValue: 480,
      delta: -20,
      ownerVersion: 3,
    });
    expect(store.createMetrics()).toMatchObject({
      actorCount: 2,
      scheduledUpdateCount: 2,
      scheduledChangeCount: 2,
      lastScheduledVisitedCount: 2,
    });
  });

  it("advances a budgeted phase cursor before wrapping to the first lane again", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 2 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });

    const laneDeltas = new Int32Array([-10, 0, -30, 0, 0]);
    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 1,
      budgetExhausted: true,
    });
    expect(store.readLaneValue(0, NEED_LANE_HUNGER)).toBe(350);
    expect(store.readLaneValue(0, NEED_LANE_COMFORT)).toBe(650);

    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 1,
      budgetExhausted: true,
    });
    expect(store.readLaneValue(0, NEED_LANE_HUNGER)).toBe(350);
    expect(store.readLaneValue(0, NEED_LANE_COMFORT)).toBe(620);

    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 0,
      budgetExhausted: false,
    });
    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 1,
      budgetExhausted: true,
    });
    expect(store.readLaneValue(0, NEED_LANE_HUNGER)).toBe(340);
    expect(store.readLaneValue(0, NEED_LANE_COMFORT)).toBe(620);
  });

  it("clamps lane deltas and stores structured last-change reasons", () => {
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 5 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 100 }))).toMatchObject({
      ok: true,
    });

    expect(
      store.applyLaneDelta(
        {
          actorId: 0,
          lane: NEED_LANE_HUNGER,
          tick: 3,
          reason: "need.external_delta",
          sourceSystemId: 7,
          sourceEventId: 9,
        },
        -500,
      ),
    ).toMatchObject({
      ok: true,
      changed: true,
      value: 0,
      reason: "need.clamped_min",
    });
    expect(store.readLaneLastChange(0, NEED_LANE_HUNGER)).toEqual({
      tick: 3,
      reason: "need.clamped_min",
      sourceSystemId: 7,
      sourceEventId: 9,
      previousValue: 100,
      nextValue: 0,
      delta: -100,
      ownerVersion: 2,
    });
  });
});

describe("M3 NeedUrgencyIndex", () => {
  it("rebuilds from NeedStore and returns bounded stable hunger candidates", () => {
    const fixture = createUrgencyFixture(30);
    const traces = createNeedUrgencyTraceStore(4);
    const output = new Uint32Array(12);

    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({
      indexedCount: 150,
      dirtyBacklog: 0,
    });
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 24,
          maxSelectedActors: 12,
        },
        output,
        traces,
      ),
    ).toEqual({
      ok: true,
      lane: NEED_LANE_HUNGER,
      selectedCount: 12,
      bucketCandidateCount: 30,
      visitedCount: 24,
      candidateCapHit: true,
      selectedCapHit: true,
      sourceVersion: 30,
      indexVersion: 1,
      traceSequence: 1,
    });
    expect([...output]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(traces.readNewest(0)).toMatchObject({
      sequence: 1,
      lane: NEED_LANE_HUNGER,
      selectedActorId: 0,
      reason: "trace.candidate_cap_reached",
      candidateCapHit: true,
      selectedCapHit: true,
    });
  });

  it("rejects stale dirty backlog and refreshes exact actor-lane keys", () => {
    const fixture = createUrgencyFixture(8);
    const output = new Uint32Array(4);
    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({ sourceVersion: 8 });

    const mutation = fixture.store.setLane(
      { actorId: 5, lane: NEED_LANE_HUNGER, tick: 4, reason: "need.manual_set" },
      10,
    );
    expect(mutation).toMatchObject({ ok: true, ownerVersion: 9 });
    expect(fixture.index.markMutationDirty(mutation)).toEqual(mutation);
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 8,
          maxSelectedActors: 4,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "need_dirty_backlog" });

    expect(fixture.index.refreshDirty(fixture.store, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      budgetExhausted: false,
      version: 2,
    });
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 8,
          maxSelectedActors: 4,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 4,
      bucketCandidateCount: 8,
      visitedCount: 8,
      candidateCapHit: false,
      sourceVersion: 9,
    });
    expect([...output]).toEqual([5, 0, 1, 2]);
    expect(fixture.index.createMetrics()).toMatchObject({
      dirtyBacklog: 0,
      dirtyBacklogPeak: 1,
      refreshedCount: 1,
    });
  });

  it("keeps the mutation dirty helper explicit for changed and unchanged owner writes", () => {
    const fixture = createUrgencyFixture(4);
    const output = new Uint32Array(2);
    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({ sourceVersion: 4 });

    const unchanged = fixture.store.setLane(
      { actorId: 2, lane: NEED_LANE_HUNGER, tick: 5, reason: "need.manual_set" },
      102,
    );
    expect(unchanged).toMatchObject({ ok: true, changed: false });
    expect(fixture.index.markMutationDirty(unchanged)).toEqual(unchanged);
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 4,
          maxSelectedActors: 2,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      sourceVersion: 4,
      selectedCount: 2,
    });

    const changed = fixture.store.setLane(
      { actorId: 2, lane: NEED_LANE_HUNGER, tick: 6, reason: "need.manual_set" },
      50,
    );
    expect(changed).toMatchObject({ ok: true, changed: true, ownerVersion: 5 });
    expect(fixture.index.markMutationDirty(changed)).toEqual(changed);
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 4,
          maxSelectedActors: 2,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "need_dirty_backlog" });
  });

  it("rebuilds deterministically after multiple owner-store changes", () => {
    const fixture = createUrgencyFixture(6);
    const firstOutput = new Uint32Array(3);
    const secondOutput = new Uint32Array(3);
    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({ indexedCount: 30 });
    expect(
      fixture.store.setLane(
        { actorId: 4, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.store.setLane(
        { actorId: 3, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({
      sourceVersion: 8,
      rebuiltCount: 60,
      dirtyBacklog: 0,
    });
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_REST,
          minUrgencyBucket: 1,
          candidateCap: 6,
          maxSelectedActors: 3,
        },
        firstOutput,
      ),
    ).toMatchObject({ ok: true, traceSequence: 0 });

    const replay = createUrgencyFixture(6);
    expect(replay.index.rebuildFromStore(replay.store)).toMatchObject({ indexedCount: 30 });
    expect(
      replay.store.setLane(
        { actorId: 4, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });
    expect(
      replay.store.setLane(
        { actorId: 3, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });
    expect(replay.index.rebuildFromStore(replay.store)).toMatchObject({ sourceVersion: 8 });
    expect(
      replay.index.queryUrgentActors(
        {
          lane: NEED_LANE_REST,
          minUrgencyBucket: 1,
          candidateCap: 6,
          maxSelectedActors: 3,
        },
        secondOutput,
      ),
    ).toMatchObject({ ok: true });

    expect([...firstOutput]).toEqual([3, 4, 0]);
    expect([...secondOutput]).toEqual([...firstOutput]);
  });

  it("keeps urgency buckets integer and fixture-scale metrics bounded", () => {
    expect(calculateNeedUrgencyBucket(900)).toBe(0);
    expect(calculateNeedUrgencyBucket(650)).toBe(1);
    expect(calculateNeedUrgencyBucket(420)).toBe(2);
    expect(calculateNeedUrgencyBucket(260)).toBe(3);
    expect(calculateNeedUrgencyBucket(100)).toBe(4);

    const traces = createNeedUrgencyTraceStore(2);
    const output = new Uint32Array(2);
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 5 });
    const index = createNeedUrgencyIndex({ actorCapacity: 2 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 900 }))).toMatchObject({
      ok: true,
    });
    expect(index.rebuildFromStore(store)).toMatchObject({ indexedCount: 5 });
    expect(
      index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 3,
          candidateCap: 2,
          maxSelectedActors: 2,
        },
        output,
        traces,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 0,
      bucketCandidateCount: 0,
      visitedCount: 0,
    });
    expect([...output]).toEqual([NEED_ACTOR_NONE, NEED_ACTOR_NONE]);
    expect(traces.readNewest(0)).toMatchObject({
      reason: "need.urgency_no_candidate",
      selectedActorId: NEED_ACTOR_NONE,
    });
    expect(traces.createMetrics()).toEqual({
      capacity: 2,
      storedCount: 1,
      nextSequence: 2,
      backlogCount: 0,
    });
  });
});

function createActor(
  overrides: Partial<Parameters<NeedStore["registerActor"]>[0]> = {},
): Parameters<NeedStore["registerActor"]>[0] {
  return {
    actorId: 0,
    hunger: 360,
    rest: 500,
    comfort: 650,
    social: 520,
    safety: 700,
    sourceTick: 0,
    ...overrides,
  };
}

function createUrgencyFixture(actorCount: number): {
  readonly store: NeedStore;
  readonly index: NeedUrgencyIndex;
} {
  const store = createNeedStore({ actorCapacity: actorCount, updateIntervalTicks: 8 });
  const index = createNeedUrgencyIndex({ actorCapacity: actorCount });

  for (let actorId = 0; actorId < actorCount; actorId += 1) {
    expect(
      store.registerActor(
        createActor({
          actorId,
          hunger: 100 + actorId,
          rest: 300 + actorId,
          comfort: 600 + actorId,
          social: 700 + actorId,
          safety: 800 + actorId,
        }),
      ),
    ).toMatchObject({ ok: true });
  }

  return { store, index };
}
