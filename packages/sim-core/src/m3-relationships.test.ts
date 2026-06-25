import { describe, expect, it } from "vitest";

import {
  M3_MOOD_LANE_TENSION,
  M3_MOOD_LANE_VALENCE,
  M3_RELATIONSHIP_LANE_GRATITUDE,
  M3_RELATIONSHIP_LANE_KINSHIP,
  M3_RELATIONSHIP_LANE_RESENTMENT,
  M3_RELATIONSHIP_LANE_TRUST,
  M3_RELATIONSHIP_SNAPSHOT_VERSION,
  createM3OrdinarySocialEvent,
  createM3RelationshipReasonTraceStore,
  createRelationshipGraphStore,
  type M3RelationshipEventInput,
} from "./index";

describe("m3-relationships", () => {
  it("applies structured ordinary-life social events to stable integer edges", () => {
    const graph = createRelationshipGraphStore({ actorCapacity: 6, eventCapacity: 8 });
    const trace = createM3RelationshipReasonTraceStore(8);

    const result = graph.applySocialEvent(
      createM3OrdinarySocialEvent(0, 2_800, ACTOR_YAO, ACTOR_MIN, "care_received", 240, 3),
      trace,
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "relationship.edge_created",
      edgeId: ACTOR_YAO * 6 + ACTOR_MIN,
      eventId: 0,
      appliedValue: 120,
    });
    expect(graph.readEdge(result.ok ? result.edgeId : 0)).toMatchObject({
      actorId: ACTOR_YAO,
      targetActorId: ACTOR_MIN,
      gratitude: 120,
      sourceTick: 2_800,
      sourceEventId: 240,
      gratitudeSourceTick: 2_800,
      gratitudeSourceEventId: 240,
    });
    expect(graph.readEvent(0)).toMatchObject({
      eventId: 0,
      kind: "care_received",
      lane: M3_RELATIONSHIP_LANE_GRATITUDE,
      delta: 120,
      sourceOwnerVersion: 3,
      reason: "relationship.event_applied",
    });
    expect(trace.readNewest(0)).toMatchObject({
      reason: "relationship.event_applied",
      sourceEventId: 240,
      candidateTotal: 1,
    });
    expect(graph.createMetrics()).toMatchObject({
      activeEdgeCount: 1,
      socialEventCount: 1,
      socialEventApplyCount: 1,
    });
  });

  it("uses bounded indexed candidate lanes with stable ordering and cap evidence", () => {
    const graph = createRelationshipGraphStore({ actorCapacity: 6, eventCapacity: 8 });
    const trace = createM3RelationshipReasonTraceStore(8);
    apply(graph, eventInput(0, 100, 30, ACTOR_YAO, ACTOR_MIN, 20));
    apply(graph, eventInput(1, 300, 10, ACTOR_YAO, ACTOR_LIN, 80));
    apply(graph, eventInput(2, 200, 20, ACTOR_YAO, ACTOR_MIN, 60));

    const candidateScratch = new Uint32Array(2);
    const selected = new Uint32Array(2);
    const scores = new Int32Array(2);
    const result = graph.selectRecentSocialEvents(
      {
        actorId: ACTOR_YAO,
        lane: M3_RELATIONSHIP_LANE_GRATITUDE,
        sourceGraphVersion: graph.graphVersion,
        candidateCap: 2,
        selectedCap: 2,
      },
      candidateScratch,
      selected,
      scores,
      trace,
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "trace.candidate_cap_reached",
      candidateTotal: 3,
      visitedCount: 2,
      selectedCount: 2,
      candidateCapHit: true,
    });
    expect([...candidateScratch]).toEqual([1, 2]);
    expect([...selected]).toEqual([1, 2]);
    expect(scores[0]).toBeGreaterThan(scores[1] ?? 0);
    expect(trace.readNewest(0)).toMatchObject({
      reason: "trace.candidate_cap_reached",
      candidateTotal: 3,
      visitedCount: 2,
      selectedTargetId: 1,
    });
    expect(graph.createMetrics()).toMatchObject({
      candidateQueryCount: 1,
      candidateVisitedCount: 2,
      candidateCapHitCount: 1,
      selectedEventCount: 2,
    });
  });

  it("queries relationship edge lanes without scanning unrelated edges", () => {
    const graph = createRelationshipGraphStore({ actorCapacity: 6, eventCapacity: 8 });
    const trace = createM3RelationshipReasonTraceStore(8);
    apply(graph, eventInput(0, 100, 30, ACTOR_YAO, ACTOR_MIN, 300));
    apply(graph, eventInput(1, 110, 31, ACTOR_YAO, ACTOR_LIN, 700));
    apply(graph, {
      eventId: 2,
      tick: 120,
      actorId: ACTOR_YAO,
      targetActorId: ACTOR_LIN,
      kind: "meal_shared",
      lane: M3_RELATIONSHIP_LANE_KINSHIP,
      delta: 1_000,
      sourceEventId: 32,
      sourceOwnerVersion: 1,
      reason: "relationship.event_applied",
    });
    apply(
      graph,
      createM3OrdinarySocialEvent(3, 130, ACTOR_YAO, ACTOR_MIN, "work_burden_shifted", 33, 1),
    );

    const candidateScratch = new Uint32Array(1);
    const selected = new Uint32Array(1);
    const scores = new Int32Array(1);
    expect(
      graph.selectRelationshipEdges(
        {
          actorId: ACTOR_YAO,
          lane: M3_RELATIONSHIP_LANE_GRATITUDE,
          sourceGraphVersion: graph.graphVersion,
          candidateCap: 1,
          selectedCap: 1,
        },
        candidateScratch,
        selected,
        scores,
        trace,
      ),
    ).toMatchObject({
      ok: true,
      reason: "trace.candidate_cap_reached",
      candidateTotal: 2,
      visitedCount: 1,
      selectedCount: 1,
    });
    expect([...candidateScratch]).toEqual([ACTOR_YAO * 6 + ACTOR_LIN]);
    expect([...selected]).toEqual([ACTOR_YAO * 6 + ACTOR_LIN]);
    expect(scores[0]).toBe(700);
    expect(graph.readEdge(ACTOR_YAO * 6 + ACTOR_LIN)).toMatchObject({
      kinship: 1_000,
      gratitude: 700,
    });
    expect(graph.readEdge(ACTOR_YAO * 6 + ACTOR_MIN)).toMatchObject({
      care: 45,
      gratitude: 300,
    });
    expect(trace.readNewest(0)).toMatchObject({
      reason: "trace.candidate_cap_reached",
      candidateTotal: 2,
      selectedTargetId: ACTOR_YAO * 6 + ACTOR_LIN,
    });
  });

  it("materializes scenario-facing explanation and mood input data without text authority", () => {
    const graph = createRelationshipGraphStore({ actorCapacity: 6, eventCapacity: 8 });
    apply(
      graph,
      createM3OrdinarySocialEvent(0, 2_800, ACTOR_YAO, ACTOR_MIN, "meal_shared", 280, 1),
    );
    apply(
      graph,
      createM3OrdinarySocialEvent(1, 3_600, ACTOR_YAO, ACTOR_MIN, "care_delayed", 360, 2),
    );

    expect(
      graph.createExplanation(ACTOR_YAO, ACTOR_MIN, M3_RELATIONSHIP_LANE_TRUST, 4, 4),
    ).toMatchObject({
      actorId: ACTOR_YAO,
      targetActorId: ACTOR_MIN,
      trust: 70,
      sourceTick: 2_800,
      sourceEventId: 280,
      recentEventCount: 1,
      newestEventId: 0,
      candidateTotal: 1,
      visitedCount: 1,
      candidateCap: 4,
      candidateCapHit: false,
      reason: "relationship.explanation_fact_source_trust_recent_events",
    });
    expect(graph.createMoodThoughtInputForEvent(0, 1_800, 7_200)).toMatchObject({
      actorId: ACTOR_YAO,
      sourceKind: "social",
      sourceId: 0,
      targetActorId: ACTOR_MIN,
      targetMoodLane: M3_MOOD_LANE_VALENCE,
      effectDelta: 70,
      durationTicks: 1_800,
      memoryDurationTicks: 7_200,
    });
    expect(graph.createMoodThoughtInputForEvent(1, 1_800, 0)).toMatchObject({
      actorId: ACTOR_YAO,
      sourceKind: "social",
      sourceId: 1,
      targetActorId: ACTOR_MIN,
      targetMoodLane: M3_MOOD_LANE_TENSION,
      effectDelta: 90,
    });
    expect(graph.readEvent(1)).toMatchObject({
      lane: M3_RELATIONSHIP_LANE_RESENTMENT,
      delta: 90,
    });
    expect(graph.readEdge(ACTOR_YAO * 6 + ACTOR_MIN)).toMatchObject({
      sourceEventId: 360,
      trustSourceEventId: 280,
      resentmentSourceEventId: 360,
    });
  });

  it("bounds sparse explanation traversal and records cap evidence", () => {
    const graph = createRelationshipGraphStore({ actorCapacity: 4, eventCapacity: 24 });
    const trace = createM3RelationshipReasonTraceStore(8);
    for (let eventId = 0; eventId < 16; eventId += 1) {
      apply(
        graph,
        createM3OrdinarySocialEvent(
          eventId,
          2_000 + eventId,
          ACTOR_YAO,
          ACTOR_LIN,
          "meal_shared",
          2_000 + eventId,
          eventId + 1,
        ),
      );
    }
    apply(
      graph,
      createM3OrdinarySocialEvent(16, 1_000, ACTOR_YAO, ACTOR_MIN, "meal_shared", 1_000, 17),
    );

    const explanation = graph.createExplanation(
      ACTOR_YAO,
      ACTOR_MIN,
      M3_RELATIONSHIP_LANE_TRUST,
      4,
      16,
      trace,
    );

    expect(explanation).toMatchObject({
      actorId: ACTOR_YAO,
      targetActorId: ACTOR_MIN,
      trust: 70,
      sourceTick: 1_000,
      sourceEventId: 1_000,
      recentEventCount: 0,
      visitedCount: 16,
      candidateTotal: 17,
      candidateCap: 16,
      candidateCapHit: true,
    });
    expect(trace.readNewest(0)).toMatchObject({
      reason: "trace.candidate_cap_reached",
      candidateTotal: 17,
      visitedCount: 16,
      scoredCount: 0,
      sourceEventId: 1_000,
    });
    expect(graph.createMetrics()).toMatchObject({
      candidateQueryCount: 1,
      candidateVisitedCount: 16,
      candidateCapHitCount: 1,
      selectedEventCount: 0,
    });
  });

  it("keeps deterministic snapshot and hash shapes stable across replay", () => {
    const first = runReplayFixture();
    const second = runReplayFixture();

    expect(first.hash).toBe(second.hash);
    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.snapshot).toMatchObject({
      snapshotVersion: M3_RELATIONSHIP_SNAPSHOT_VERSION,
      actorCapacity: 6,
      eventCapacity: 8,
      graphVersion: 4,
    });
    const edgeIds: number[] = [];
    for (const edge of first.snapshot.edges) {
      edgeIds.push(edge.edgeId);
    }
    const eventIds: number[] = [];
    for (const event of first.snapshot.events) {
      eventIds.push(event.eventId);
    }
    expect(edgeIds).toEqual([1, 2]);
    expect(eventIds).toEqual([0, 1, 2, 3]);
  });

  it("rejects invalid facts and stale index basis with structured reasons", () => {
    const graph = createRelationshipGraphStore({ actorCapacity: 3, eventCapacity: 2 });
    expect(
      graph.applySocialEvent(
        createM3OrdinarySocialEvent(0, 10, ACTOR_YAO, ACTOR_YAO, "care_received", 1, 1),
      ),
    ).toEqual({ ok: false, reason: "relationship.self_edge_rejected" });
    apply(graph, createM3OrdinarySocialEvent(0, 20, ACTOR_YAO, ACTOR_MIN, "care_received", 2, 1));
    expect(
      graph.applySocialEvent(
        createM3OrdinarySocialEvent(0, 30, ACTOR_YAO, ACTOR_MIN, "care_received", 3, 1),
      ),
    ).toEqual({ ok: false, reason: "relationship.event_rejected_duplicate" });

    const candidateScratch = new Uint32Array(1);
    const selected = new Uint32Array(1);
    const scores = new Int32Array(1);
    expect(
      graph.selectRecentSocialEvents(
        {
          actorId: ACTOR_YAO,
          lane: M3_RELATIONSHIP_LANE_GRATITUDE,
          sourceGraphVersion: graph.graphVersion - 1,
          candidateCap: 1,
          selectedCap: 1,
        },
        candidateScratch,
        selected,
        scores,
      ),
    ).toEqual({ ok: false, reason: "relationship.index_stale_basis" });
    expect(selected[0]).toBe(0);
  });

  it("rejects malformed social event kinds before writing facts", () => {
    const graph = createRelationshipGraphStore({ actorCapacity: 3, eventCapacity: 2 });

    expect(
      graph.applySocialEvent({
        eventId: 0,
        tick: 20,
        actorId: ACTOR_YAO,
        targetActorId: ACTOR_MIN,
        kind: "not_a_social_event",
        lane: M3_RELATIONSHIP_LANE_TRUST,
        delta: 40,
        sourceEventId: 99,
        sourceOwnerVersion: 1,
        reason: "relationship.event_applied",
      }),
    ).toEqual({ ok: false, reason: "relationship.event_kind_out_of_range" });
    expect(graph.readEvent(0)).toBeUndefined();
    expect(graph.readEdge(ACTOR_YAO * 3 + ACTOR_MIN)).toBeUndefined();
    expect(graph.createMetrics()).toMatchObject({
      activeEdgeCount: 0,
      socialEventCount: 0,
      socialEventApplyCount: 0,
    });
  });
});

const ACTOR_YAO = 0;
const ACTOR_LIN = 1;
const ACTOR_MIN = 2;

function apply(
  graph: ReturnType<typeof createRelationshipGraphStore>,
  input: M3RelationshipEventInput,
): void {
  const result = graph.applySocialEvent(input);
  if (!result.ok) {
    throw new Error(result.reason);
  }
}

function eventInput(
  eventId: number,
  tick: number,
  sourceEventId: number,
  actorId: number,
  targetActorId: number,
  delta: number,
): M3RelationshipEventInput {
  return {
    eventId,
    tick,
    actorId,
    targetActorId,
    kind: "care_received",
    lane: M3_RELATIONSHIP_LANE_GRATITUDE,
    delta,
    sourceEventId,
    sourceOwnerVersion: 1,
    reason: "relationship.event_applied",
  };
}

function runReplayFixture(): {
  readonly hash: number;
  readonly snapshot: ReturnType<ReturnType<typeof createRelationshipGraphStore>["createSnapshot"]>;
} {
  const graph = createRelationshipGraphStore({ actorCapacity: 6, eventCapacity: 8 });
  apply(
    graph,
    createM3OrdinarySocialEvent(0, 2_800, ACTOR_YAO, ACTOR_MIN, "care_received", 280, 1),
  );
  apply(graph, createM3OrdinarySocialEvent(1, 3_000, ACTOR_YAO, ACTOR_LIN, "meal_shared", 300, 2));
  apply(graph, createM3OrdinarySocialEvent(2, 3_600, ACTOR_YAO, ACTOR_MIN, "care_delayed", 360, 3));
  apply(
    graph,
    createM3OrdinarySocialEvent(3, 4_200, ACTOR_YAO, ACTOR_LIN, "work_burden_shifted", 420, 4),
  );
  return {
    hash: graph.createHash(),
    snapshot: graph.createSnapshot(),
  };
}
