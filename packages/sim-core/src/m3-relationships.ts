import { mixUint32 } from "./deterministic-hash";
import { assertValidCapacity } from "./entity-id";
import {
  M3_MOOD_LANE_TENSION,
  M3_MOOD_LANE_VALENCE,
  type M3MoodThoughtInput,
} from "./m3-mood-thoughts";
import { requireSafeTick, type Tick } from "./time";

export const M3_RELATIONSHIP_SNAPSHOT_VERSION = 1;
export const M3_RELATIONSHIP_EDGE_NONE = 0xffff_ffff;
export const M3_SOCIAL_EVENT_NONE = 0xffff_ffff;
export const M3_RELATIONSHIP_DEFAULT_EVENT_CAPACITY = 64;
export const M3_RELATIONSHIP_DEFAULT_TRACE_CAPACITY = 64;
export const M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP = 16;
export const M3_RELATIONSHIP_DEFAULT_SELECTED_CAP = 8;
export const M3_RELATIONSHIP_VALUE_MIN = -1_000;
export const M3_RELATIONSHIP_VALUE_MAX = 1_000;
export const M3_RELATIONSHIP_LANE_KINSHIP = 0;
export const M3_RELATIONSHIP_LANE_CARE = 1;
export const M3_RELATIONSHIP_LANE_TRUST = 2;
export const M3_RELATIONSHIP_LANE_GRATITUDE = 3;
export const M3_RELATIONSHIP_LANE_RESENTMENT = 4;
export const M3_RELATIONSHIP_LANE_COUNT = 5;

export type M3RelationshipLane =
  | typeof M3_RELATIONSHIP_LANE_KINSHIP
  | typeof M3_RELATIONSHIP_LANE_CARE
  | typeof M3_RELATIONSHIP_LANE_TRUST
  | typeof M3_RELATIONSHIP_LANE_GRATITUDE
  | typeof M3_RELATIONSHIP_LANE_RESENTMENT;

export type M3SocialEventKind =
  | "care_received"
  | "meal_shared"
  | "work_burden_shifted"
  | "care_delayed";

export type M3RelationshipReason =
  | "relationship.edge_created"
  | "relationship.edge_updated"
  | "relationship.event_applied"
  | "relationship.event_rejected_duplicate"
  | "relationship.actor_out_of_range"
  | "relationship.target_out_of_range"
  | "relationship.self_edge_rejected"
  | "relationship.event_out_of_range"
  | "relationship.lane_out_of_range"
  | "relationship.value_out_of_range"
  | "relationship.source_out_of_range"
  | "relationship.event_kind_out_of_range"
  | "relationship.index_stale_basis"
  | "relationship.query_buffer_too_small"
  | "relationship.explanation_fact_source_trust_recent_events"
  | "trace.candidate_cap_reached";

export interface M3RelationshipStoreOptions {
  readonly actorCapacity: number;
  readonly eventCapacity?: number;
}

export interface M3RelationshipEventInput {
  readonly eventId: number;
  readonly tick: Tick;
  readonly actorId: number;
  readonly targetActorId: number;
  readonly kind: string;
  readonly lane: M3RelationshipLane;
  readonly delta: number;
  readonly sourceEventId: number;
  readonly sourceOwnerVersion: number;
  readonly reason: M3RelationshipReason;
}

export interface M3RelationshipEdgeView {
  readonly edgeId: number;
  readonly actorId: number;
  readonly targetActorId: number;
  readonly kinship: number;
  readonly care: number;
  readonly trust: number;
  readonly gratitude: number;
  readonly resentment: number;
  readonly sourceTick: Tick;
  readonly sourceEventId: number;
  readonly kinshipSourceTick: Tick;
  readonly kinshipSourceEventId: number;
  readonly careSourceTick: Tick;
  readonly careSourceEventId: number;
  readonly trustSourceTick: Tick;
  readonly trustSourceEventId: number;
  readonly gratitudeSourceTick: Tick;
  readonly gratitudeSourceEventId: number;
  readonly resentmentSourceTick: Tick;
  readonly resentmentSourceEventId: number;
  readonly edgeVersion: number;
}

export interface M3SocialEventView extends M3RelationshipEventInput {
  readonly eventVersion: number;
  readonly graphVersion: number;
  readonly edgeId: number;
  readonly appliedValue: number;
}

export type M3RelationshipMutationResult =
  | {
      readonly ok: true;
      readonly reason: M3RelationshipReason;
      readonly edgeId: number;
      readonly eventId: number;
      readonly graphVersion: number;
      readonly edgeVersion: number;
      readonly appliedValue: number;
    }
  | { readonly ok: false; readonly reason: M3RelationshipReason };

export interface M3RelationshipQuery {
  readonly actorId: number;
  readonly lane: M3RelationshipLane;
  readonly sourceGraphVersion: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
}

export type M3RelationshipSelectionResult =
  | {
      readonly ok: true;
      readonly reason: M3RelationshipReason;
      readonly candidateTotal: number;
      readonly visitedCount: number;
      readonly scoredCount: number;
      readonly selectedCount: number;
      readonly candidateCapHit: boolean;
      readonly traceSequence: number;
    }
  | { readonly ok: false; readonly reason: M3RelationshipReason };

export interface M3RelationshipExplanationView {
  readonly actorId: number;
  readonly targetActorId: number;
  readonly edgeId: number;
  readonly trust: number;
  readonly sourceTick: Tick;
  readonly sourceEventId: number;
  readonly sourceGraphVersion: number;
  readonly recentEventCount: number;
  readonly newestEventId: number;
  readonly candidateTotal: number;
  readonly visitedCount: number;
  readonly scoredCount: number;
  readonly candidateCap: number;
  readonly candidateCapHit: boolean;
  readonly reason: M3RelationshipReason;
}

export interface M3RelationshipMetrics {
  readonly graphVersion: number;
  readonly activeEdgeCount: number;
  readonly socialEventCount: number;
  readonly socialEventApplyCount: number;
  readonly candidateQueryCount: number;
  readonly candidateVisitedCount: number;
  readonly candidateCapHitCount: number;
  readonly selectedEventCount: number;
}

export interface M3RelationshipSnapshot {
  readonly snapshotVersion: typeof M3_RELATIONSHIP_SNAPSHOT_VERSION;
  readonly actorCapacity: number;
  readonly eventCapacity: number;
  readonly graphVersion: number;
  readonly edges: readonly M3RelationshipEdgeView[];
  readonly events: readonly M3SocialEventView[];
}

export interface M3RelationshipTraceInput {
  readonly tick: Tick;
  readonly actorId: number;
  readonly targetActorId: number;
  readonly lane: M3RelationshipLane;
  readonly candidateTotal: number;
  readonly visitedCount: number;
  readonly scoredCount: number;
  readonly candidateCap: number;
  readonly selectedTargetId: number;
  readonly sourceEventId: number;
  readonly sourceGraphVersion: number;
  readonly reason: M3RelationshipReason;
  readonly graphVersion: number;
}

export interface M3RelationshipTraceView extends M3RelationshipTraceInput {
  readonly sequence: number;
}

export interface M3RelationshipTraceMetrics {
  readonly capacity: number;
  readonly storedCount: number;
  readonly nextSequence: number;
}

type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: M3RelationshipReason };

export class RelationshipGraphStore {
  readonly actorCapacity: number;
  readonly eventCapacity: number;
  readonly edgeCapacity: number;

  private readonly edgeActive: Uint8Array;
  private readonly edgeValues: Int16Array;
  private readonly edgeVersions: Uint32Array;
  private readonly edgeSourceTicks: Float64Array;
  private readonly edgeSourceEventIds: Uint32Array;
  private readonly edgeLaneSourceTicks: Float64Array;
  private readonly edgeLaneSourceEventIds: Uint32Array;
  private readonly edgeLaneLinked: Uint8Array;
  private readonly edgeLaneNext: Int32Array;
  private readonly edgeLanePrevious: Int32Array;
  private readonly edgeLaneHeads: Int32Array;
  private readonly edgeLaneCounts: Uint32Array;
  private readonly eventActive: Uint8Array;
  private readonly eventTicks: Float64Array;
  private readonly eventActorIds: Uint32Array;
  private readonly eventTargetActorIds: Uint32Array;
  private readonly eventKinds: Uint8Array;
  private readonly eventLanes: Uint8Array;
  private readonly eventDeltas: Int16Array;
  private readonly eventSourceIds: Uint32Array;
  private readonly eventSourceVersions: Uint32Array;
  private readonly eventReasons: Uint8Array;
  private readonly eventVersions: Uint32Array;
  private readonly eventEdgeIds: Uint32Array;
  private readonly eventAppliedValues: Int16Array;
  private readonly eventLaneNext: Int32Array;
  private readonly eventLanePrevious: Int32Array;
  private readonly eventLaneHeads: Int32Array;
  private readonly eventLaneCounts: Uint32Array;
  private graphVersionValue = 0;
  private activeEdgeCountValue = 0;
  private socialEventCountValue = 0;
  private socialEventApplyCount = 0;
  private candidateQueryCount = 0;
  private candidateVisitedCount = 0;
  private candidateCapHitCount = 0;
  private selectedEventCount = 0;

  constructor(options: M3RelationshipStoreOptions) {
    assertValidCapacity(options.actorCapacity, "M3 relationship actor capacity");
    const eventCapacity = options.eventCapacity ?? M3_RELATIONSHIP_DEFAULT_EVENT_CAPACITY;
    assertValidCapacity(eventCapacity, "M3 relationship event capacity");
    const edgeCapacity = options.actorCapacity * options.actorCapacity;
    assertValidCapacity(edgeCapacity, "M3 relationship edge capacity");
    this.actorCapacity = options.actorCapacity;
    this.eventCapacity = eventCapacity;
    this.edgeCapacity = edgeCapacity;
    this.edgeActive = new Uint8Array(edgeCapacity);
    this.edgeValues = new Int16Array(edgeCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.edgeVersions = new Uint32Array(edgeCapacity);
    this.edgeSourceTicks = new Float64Array(edgeCapacity);
    this.edgeSourceEventIds = new Uint32Array(edgeCapacity);
    this.edgeLaneSourceTicks = new Float64Array(edgeCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.edgeLaneSourceEventIds = new Uint32Array(edgeCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.edgeLaneLinked = new Uint8Array(edgeCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.edgeLaneNext = createEmptyLinks(edgeCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.edgeLanePrevious = createEmptyLinks(edgeCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.edgeLaneHeads = createEmptyLinks(options.actorCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.edgeLaneCounts = new Uint32Array(options.actorCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.eventActive = new Uint8Array(eventCapacity);
    this.eventTicks = new Float64Array(eventCapacity);
    this.eventActorIds = new Uint32Array(eventCapacity);
    this.eventTargetActorIds = new Uint32Array(eventCapacity);
    this.eventKinds = new Uint8Array(eventCapacity);
    this.eventLanes = new Uint8Array(eventCapacity);
    this.eventDeltas = new Int16Array(eventCapacity);
    this.eventSourceIds = new Uint32Array(eventCapacity);
    this.eventSourceVersions = new Uint32Array(eventCapacity);
    this.eventReasons = new Uint8Array(eventCapacity);
    this.eventVersions = new Uint32Array(eventCapacity);
    this.eventEdgeIds = new Uint32Array(eventCapacity);
    this.eventAppliedValues = new Int16Array(eventCapacity);
    this.eventLaneNext = createEmptyLinks(eventCapacity);
    this.eventLanePrevious = createEmptyLinks(eventCapacity);
    this.eventLaneHeads = createEmptyLinks(options.actorCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.eventLaneCounts = new Uint32Array(options.actorCapacity * M3_RELATIONSHIP_LANE_COUNT);
    this.eventEdgeIds.fill(M3_RELATIONSHIP_EDGE_NONE);
  }

  get graphVersion(): number {
    return this.graphVersionValue;
  }

  getEdgeId(actorId: number, targetActorId: number): number {
    if (!this.isValidEdgeActors(actorId, targetActorId)) {
      return M3_RELATIONSHIP_EDGE_NONE;
    }
    return edgeIdFor(actorId, targetActorId, this.actorCapacity);
  }

  applySocialEvent(
    input: M3RelationshipEventInput,
    traceStore?: M3RelationshipReasonTraceStore,
  ): M3RelationshipMutationResult {
    const validation = this.validateEventInput(input);
    if (!validation.ok) {
      return validation;
    }
    if ((this.eventActive[input.eventId] ?? 0) === 1) {
      return { ok: false, reason: "relationship.event_rejected_duplicate" };
    }
    const safeTick = requireSafeTick(input.tick, "M3 relationship event tick");
    const edgeId = edgeIdFor(input.actorId, input.targetActorId, this.actorCapacity);
    const laneOffset = edgeLaneOffset(edgeId, input.lane);
    const previousValue = this.edgeValues[laneOffset] ?? 0;
    const nextValue = clampRelationshipValue(previousValue + input.delta);
    const wasEdgeActive = (this.edgeActive[edgeId] ?? 0) === 1;
    const eventKind = normalizeEventKind(input.kind);
    if (eventKind === undefined) {
      return { ok: false, reason: "relationship.event_kind_out_of_range" };
    }

    if (!wasEdgeActive) {
      this.edgeActive[edgeId] = 1;
      this.activeEdgeCountValue += 1;
    }
    this.edgeValues[laneOffset] = nextValue;
    this.edgeSourceTicks[edgeId] = safeTick;
    this.edgeSourceEventIds[edgeId] = input.sourceEventId;
    this.edgeLaneSourceTicks[laneOffset] = safeTick;
    this.edgeLaneSourceEventIds[laneOffset] = input.sourceEventId;
    this.graphVersionValue += 1;
    this.edgeVersions[edgeId] = this.graphVersionValue;
    this.refreshEdgeLaneLink(edgeId, input.actorId, input.lane, previousValue, nextValue);
    this.writeEvent(input, eventKind, safeTick, edgeId, nextValue);
    this.insertEventLaneLink(input.eventId, input.actorId, input.lane);
    this.socialEventCountValue += 1;
    this.socialEventApplyCount += 1;
    traceStore?.record({
      tick: safeTick,
      actorId: input.actorId,
      targetActorId: input.targetActorId,
      lane: input.lane,
      candidateTotal: 1,
      visitedCount: 1,
      scoredCount: 1,
      candidateCap: 1,
      selectedTargetId: input.eventId,
      sourceEventId: input.sourceEventId,
      sourceGraphVersion: input.sourceOwnerVersion,
      reason: "relationship.event_applied",
      graphVersion: this.graphVersionValue,
    });
    return {
      ok: true,
      reason: wasEdgeActive ? "relationship.edge_updated" : "relationship.edge_created",
      edgeId,
      eventId: input.eventId,
      graphVersion: this.graphVersionValue,
      edgeVersion: this.edgeVersions[edgeId] ?? 0,
      appliedValue: nextValue,
    };
  }

  selectRecentSocialEvents(
    query: M3RelationshipQuery,
    candidateScratch: Uint32Array,
    selectedEventIds: Uint32Array,
    selectedScores: Int32Array,
    traceStore?: M3RelationshipReasonTraceStore,
  ): M3RelationshipSelectionResult {
    const validation = this.validateQuery(
      query,
      candidateScratch,
      selectedEventIds,
      selectedScores,
    );
    if (!validation.ok) {
      return validation;
    }
    if (query.sourceGraphVersion !== this.graphVersionValue) {
      return { ok: false, reason: "relationship.index_stale_basis" };
    }
    clearSelection(selectedEventIds, selectedScores, query.selectedCap);
    const headKey = actorLaneKey(query.actorId, query.lane);
    const candidateTotal = this.eventLaneCounts[headKey] ?? 0;
    let current = this.eventLaneHeads[headKey] ?? -1;
    let visitedCount = 0;
    let scoredCount = 0;
    let selectedCount = 0;

    while (current >= 0 && visitedCount < query.candidateCap) {
      candidateScratch[visitedCount] = current;
      const score = this.scoreEvent(current);
      selectedCount = insertSelectedEvent(
        current,
        score,
        selectedEventIds,
        selectedScores,
        selectedCount,
        query.selectedCap,
        this,
      );
      visitedCount += 1;
      scoredCount += 1;
      current = this.eventLaneNext[current] ?? -1;
    }
    const capHit = candidateTotal > visitedCount;
    this.candidateQueryCount += 1;
    this.candidateVisitedCount += visitedCount;
    this.selectedEventCount += selectedCount;
    if (capHit) {
      this.candidateCapHitCount += 1;
    }
    const reason: M3RelationshipReason = capHit
      ? "trace.candidate_cap_reached"
      : "relationship.explanation_fact_source_trust_recent_events";
    const traceSequence =
      traceStore?.record({
        tick: selectedCount > 0 ? (this.eventTicks[selectedEventIds[0] ?? 0] ?? 0) : 0,
        actorId: query.actorId,
        targetActorId:
          selectedCount > 0
            ? (this.eventTargetActorIds[selectedEventIds[0] ?? 0] ?? M3_SOCIAL_EVENT_NONE)
            : M3_SOCIAL_EVENT_NONE,
        lane: query.lane,
        candidateTotal,
        visitedCount,
        scoredCount,
        candidateCap: query.candidateCap,
        selectedTargetId:
          selectedCount > 0 ? (selectedEventIds[0] ?? M3_SOCIAL_EVENT_NONE) : M3_SOCIAL_EVENT_NONE,
        sourceEventId: selectedCount > 0 ? (this.eventSourceIds[selectedEventIds[0] ?? 0] ?? 0) : 0,
        sourceGraphVersion: query.sourceGraphVersion,
        reason,
        graphVersion: this.graphVersionValue,
      }) ?? 0;
    return {
      ok: true,
      reason,
      candidateTotal,
      visitedCount,
      scoredCount,
      selectedCount,
      candidateCapHit: capHit,
      traceSequence,
    };
  }

  selectRelationshipEdges(
    query: M3RelationshipQuery,
    candidateScratch: Uint32Array,
    selectedEdgeIds: Uint32Array,
    selectedScores: Int32Array,
    traceStore?: M3RelationshipReasonTraceStore,
  ): M3RelationshipSelectionResult {
    const validation = this.validateQuery(query, candidateScratch, selectedEdgeIds, selectedScores);
    if (!validation.ok) {
      return validation;
    }
    if (query.sourceGraphVersion !== this.graphVersionValue) {
      return { ok: false, reason: "relationship.index_stale_basis" };
    }
    clearSelection(selectedEdgeIds, selectedScores, query.selectedCap);
    const headKey = actorLaneKey(query.actorId, query.lane);
    const candidateTotal = this.edgeLaneCounts[headKey] ?? 0;
    let current = this.edgeLaneHeads[headKey] ?? -1;
    let visitedCount = 0;
    let scoredCount = 0;
    let selectedCount = 0;

    while (current >= 0 && visitedCount < query.candidateCap) {
      candidateScratch[visitedCount] = current;
      const score = this.scoreEdge(current, query.lane);
      selectedCount = insertSelectedEdge(
        current,
        score,
        selectedEdgeIds,
        selectedScores,
        selectedCount,
        query.selectedCap,
        this.actorCapacity,
      );
      visitedCount += 1;
      scoredCount += 1;
      current = this.edgeLaneNext[edgeLaneOffset(current, query.lane)] ?? -1;
    }
    const capHit = candidateTotal > visitedCount;
    this.candidateQueryCount += 1;
    this.candidateVisitedCount += visitedCount;
    this.selectedEventCount += selectedCount;
    if (capHit) {
      this.candidateCapHitCount += 1;
    }
    const selectedEdgeId =
      selectedCount > 0
        ? (selectedEdgeIds[0] ?? M3_RELATIONSHIP_EDGE_NONE)
        : M3_RELATIONSHIP_EDGE_NONE;
    const reason: M3RelationshipReason = capHit
      ? "trace.candidate_cap_reached"
      : "relationship.explanation_fact_source_trust_recent_events";
    const traceSequence =
      traceStore?.record({
        tick:
          selectedEdgeId !== M3_RELATIONSHIP_EDGE_NONE
            ? (this.edgeLaneSourceTicks[edgeLaneOffset(selectedEdgeId, query.lane)] ?? 0)
            : 0,
        actorId: query.actorId,
        targetActorId:
          selectedEdgeId !== M3_RELATIONSHIP_EDGE_NONE
            ? selectedEdgeId % this.actorCapacity
            : M3_SOCIAL_EVENT_NONE,
        lane: query.lane,
        candidateTotal,
        visitedCount,
        scoredCount,
        candidateCap: query.candidateCap,
        selectedTargetId: selectedEdgeId,
        sourceEventId:
          selectedEdgeId !== M3_RELATIONSHIP_EDGE_NONE
            ? (this.edgeLaneSourceEventIds[edgeLaneOffset(selectedEdgeId, query.lane)] ?? 0)
            : 0,
        sourceGraphVersion: query.sourceGraphVersion,
        reason,
        graphVersion: this.graphVersionValue,
      }) ?? 0;
    return {
      ok: true,
      reason,
      candidateTotal,
      visitedCount,
      scoredCount,
      selectedCount,
      candidateCapHit: capHit,
      traceSequence,
    };
  }

  readEdge(edgeId: number): M3RelationshipEdgeView | undefined {
    if (!isIndexInRange(edgeId, this.edgeCapacity) || (this.edgeActive[edgeId] ?? 0) !== 1) {
      return undefined;
    }
    const actorId = Math.trunc(edgeId / this.actorCapacity);
    const targetActorId = edgeId % this.actorCapacity;
    return {
      edgeId,
      actorId,
      targetActorId,
      kinship: this.edgeValues[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_KINSHIP)] ?? 0,
      care: this.edgeValues[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_CARE)] ?? 0,
      trust: this.edgeValues[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_TRUST)] ?? 0,
      gratitude: this.edgeValues[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_GRATITUDE)] ?? 0,
      resentment: this.edgeValues[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_RESENTMENT)] ?? 0,
      sourceTick: this.edgeSourceTicks[edgeId] ?? 0,
      sourceEventId: this.edgeSourceEventIds[edgeId] ?? 0,
      kinshipSourceTick:
        this.edgeLaneSourceTicks[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_KINSHIP)] ?? 0,
      kinshipSourceEventId:
        this.edgeLaneSourceEventIds[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_KINSHIP)] ?? 0,
      careSourceTick:
        this.edgeLaneSourceTicks[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_CARE)] ?? 0,
      careSourceEventId:
        this.edgeLaneSourceEventIds[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_CARE)] ?? 0,
      trustSourceTick:
        this.edgeLaneSourceTicks[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_TRUST)] ?? 0,
      trustSourceEventId:
        this.edgeLaneSourceEventIds[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_TRUST)] ?? 0,
      gratitudeSourceTick:
        this.edgeLaneSourceTicks[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_GRATITUDE)] ?? 0,
      gratitudeSourceEventId:
        this.edgeLaneSourceEventIds[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_GRATITUDE)] ?? 0,
      resentmentSourceTick:
        this.edgeLaneSourceTicks[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_RESENTMENT)] ?? 0,
      resentmentSourceEventId:
        this.edgeLaneSourceEventIds[edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_RESENTMENT)] ?? 0,
      edgeVersion: this.edgeVersions[edgeId] ?? 0,
    };
  }

  readEvent(eventId: number): M3SocialEventView | undefined {
    if (!isIndexInRange(eventId, this.eventCapacity) || (this.eventActive[eventId] ?? 0) !== 1) {
      return undefined;
    }
    const lane = this.eventLanes[eventId] ?? M3_RELATIONSHIP_LANE_KINSHIP;
    return {
      eventId,
      tick: this.eventTicks[eventId] ?? 0,
      actorId: this.eventActorIds[eventId] ?? 0,
      targetActorId: this.eventTargetActorIds[eventId] ?? 0,
      kind: decodeEventKind(this.eventKinds[eventId] ?? 0),
      lane: isRelationshipLane(lane) ? lane : M3_RELATIONSHIP_LANE_KINSHIP,
      delta: this.eventDeltas[eventId] ?? 0,
      sourceEventId: this.eventSourceIds[eventId] ?? 0,
      sourceOwnerVersion: this.eventSourceVersions[eventId] ?? 0,
      reason: decodeRelationshipReason(this.eventReasons[eventId] ?? 0),
      eventVersion: this.eventVersions[eventId] ?? 0,
      graphVersion: this.graphVersionValue,
      edgeId: this.eventEdgeIds[eventId] ?? M3_RELATIONSHIP_EDGE_NONE,
      appliedValue: this.eventAppliedValues[eventId] ?? 0,
    };
  }

  createExplanation(
    actorId: number,
    targetActorId: number,
    recentLane: M3RelationshipLane,
    recentEventCap: number,
    candidateCap = M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP,
    traceStore?: M3RelationshipReasonTraceStore,
  ): M3RelationshipExplanationView | undefined {
    if (
      !this.isValidEdgeActors(actorId, targetActorId) ||
      !isRelationshipLane(recentLane) ||
      !isPositiveSafeInteger(recentEventCap) ||
      !isPositiveSafeInteger(candidateCap)
    ) {
      return undefined;
    }
    const edgeId = edgeIdFor(actorId, targetActorId, this.actorCapacity);
    const edge = this.readEdge(edgeId);
    if (edge === undefined) {
      return undefined;
    }
    let current = this.eventLaneHeads[actorLaneKey(actorId, recentLane)] ?? -1;
    const actualRecentEventCap = Math.min(recentEventCap, M3_RELATIONSHIP_DEFAULT_SELECTED_CAP);
    const actualCandidateCap = Math.min(candidateCap, M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP);
    const candidateTotal = this.eventLaneCounts[actorLaneKey(actorId, recentLane)] ?? 0;
    let recentEventCount = 0;
    let visitedCount = 0;
    let newestEventId = M3_SOCIAL_EVENT_NONE;
    while (
      current >= 0 &&
      visitedCount < actualCandidateCap &&
      recentEventCount < actualRecentEventCap
    ) {
      visitedCount += 1;
      if ((this.eventTargetActorIds[current] ?? M3_SOCIAL_EVENT_NONE) === targetActorId) {
        if (newestEventId === M3_SOCIAL_EVENT_NONE) {
          newestEventId = current;
        }
        recentEventCount += 1;
      }
      current = this.eventLaneNext[current] ?? -1;
    }
    const candidateCapHit = current >= 0 && visitedCount >= actualCandidateCap;
    const trustSourceOffset = edgeLaneOffset(edgeId, M3_RELATIONSHIP_LANE_TRUST);
    const trustSourceTick = this.edgeLaneSourceTicks[trustSourceOffset] ?? 0;
    const trustSourceEventId = this.edgeLaneSourceEventIds[trustSourceOffset] ?? 0;
    this.candidateQueryCount += 1;
    this.candidateVisitedCount += visitedCount;
    this.selectedEventCount += recentEventCount;
    if (candidateCapHit) {
      this.candidateCapHitCount += 1;
    }
    traceStore?.record({
      tick: trustSourceTick,
      actorId,
      targetActorId,
      lane: recentLane,
      candidateTotal,
      visitedCount,
      scoredCount: recentEventCount,
      candidateCap: actualCandidateCap,
      selectedTargetId: newestEventId,
      sourceEventId: trustSourceEventId,
      sourceGraphVersion: this.graphVersionValue,
      reason: candidateCapHit
        ? "trace.candidate_cap_reached"
        : "relationship.explanation_fact_source_trust_recent_events",
      graphVersion: this.graphVersionValue,
    });
    return {
      actorId,
      targetActorId,
      edgeId,
      trust: edge.trust,
      sourceTick: trustSourceTick,
      sourceEventId: trustSourceEventId,
      sourceGraphVersion: this.graphVersionValue,
      recentEventCount,
      newestEventId,
      candidateTotal,
      visitedCount,
      scoredCount: recentEventCount,
      candidateCap: actualCandidateCap,
      candidateCapHit,
      reason: "relationship.explanation_fact_source_trust_recent_events",
    };
  }

  createMoodThoughtInputForEvent(
    eventId: number,
    durationTicks: number,
    memoryDurationTicks: number,
  ): M3MoodThoughtInput | undefined {
    const event = this.readEvent(eventId);
    if (event === undefined || !isPositiveSafeInteger(durationTicks)) {
      return undefined;
    }
    const isResentment = event.lane === M3_RELATIONSHIP_LANE_RESENTMENT;
    const effectDelta = isResentment ? event.delta : event.delta >= 0 ? event.delta : -event.delta;
    const input: M3MoodThoughtInput = {
      actorId: event.actorId,
      tick: event.tick,
      sourceKind: "social",
      sourceId: event.eventId,
      sourceVersion: event.eventVersion,
      targetActorId: event.targetActorId,
      targetMoodLane: isResentment ? M3_MOOD_LANE_TENSION : M3_MOOD_LANE_VALENCE,
      strength: clampPositiveMoodStrength(absInt(event.delta) * 2),
      effectDelta: isResentment ? absInt(effectDelta) : effectDelta,
      durationTicks,
      stackKey: 0x50_0000 + event.eventId,
    };
    if (memoryDurationTicks > 0) {
      return { ...input, memoryDurationTicks };
    }
    return input;
  }

  createMetrics(): M3RelationshipMetrics {
    return {
      graphVersion: this.graphVersionValue,
      activeEdgeCount: this.activeEdgeCountValue,
      socialEventCount: this.socialEventCountValue,
      socialEventApplyCount: this.socialEventApplyCount,
      candidateQueryCount: this.candidateQueryCount,
      candidateVisitedCount: this.candidateVisitedCount,
      candidateCapHitCount: this.candidateCapHitCount,
      selectedEventCount: this.selectedEventCount,
    };
  }

  createSnapshot(): M3RelationshipSnapshot {
    const edges: M3RelationshipEdgeView[] = [];
    const events: M3SocialEventView[] = [];
    for (let edgeId = 0; edgeId < this.edgeCapacity; edgeId += 1) {
      const edge = this.readEdge(edgeId);
      if (edge !== undefined) {
        edges.push(edge);
      }
    }
    for (let eventId = 0; eventId < this.eventCapacity; eventId += 1) {
      const event = this.readEvent(eventId);
      if (event !== undefined) {
        events.push(event);
      }
    }
    return {
      snapshotVersion: M3_RELATIONSHIP_SNAPSHOT_VERSION,
      actorCapacity: this.actorCapacity,
      eventCapacity: this.eventCapacity,
      graphVersion: this.graphVersionValue,
      edges,
      events,
    };
  }

  createHash(): number {
    let hash = mixUint32(0x811c_9dc5, M3_RELATIONSHIP_SNAPSHOT_VERSION);
    hash = mixUint32(hash, this.actorCapacity);
    hash = mixUint32(hash, this.eventCapacity);
    hash = mixUint32(hash, this.graphVersionValue);
    for (let edgeId = 0; edgeId < this.edgeCapacity; edgeId += 1) {
      if ((this.edgeActive[edgeId] ?? 0) === 1) {
        hash = mixUint32(hash, edgeId);
        for (let lane = 0; lane < M3_RELATIONSHIP_LANE_COUNT; lane += 1) {
          const laneOffset = edgeLaneOffset(edgeId, lane);
          hash = mixUint32(hash, this.edgeValues[laneOffset] ?? 0);
          hash = mixTick(hash, this.edgeLaneSourceTicks[laneOffset] ?? 0);
          hash = mixUint32(hash, this.edgeLaneSourceEventIds[laneOffset] ?? 0);
        }
        hash = mixTick(hash, this.edgeSourceTicks[edgeId] ?? 0);
        hash = mixUint32(hash, this.edgeSourceEventIds[edgeId] ?? 0);
        hash = mixUint32(hash, this.edgeVersions[edgeId] ?? 0);
      }
    }
    for (let eventId = 0; eventId < this.eventCapacity; eventId += 1) {
      if ((this.eventActive[eventId] ?? 0) === 1) {
        hash = mixUint32(hash, eventId);
        hash = mixTick(hash, this.eventTicks[eventId] ?? 0);
        hash = mixUint32(hash, this.eventActorIds[eventId] ?? 0);
        hash = mixUint32(hash, this.eventTargetActorIds[eventId] ?? 0);
        hash = mixUint32(hash, this.eventKinds[eventId] ?? 0);
        hash = mixUint32(hash, this.eventLanes[eventId] ?? 0);
        hash = mixUint32(hash, this.eventDeltas[eventId] ?? 0);
        hash = mixUint32(hash, this.eventSourceIds[eventId] ?? 0);
        hash = mixUint32(hash, this.eventSourceVersions[eventId] ?? 0);
        hash = mixUint32(hash, this.eventReasons[eventId] ?? 0);
        hash = mixUint32(hash, this.eventVersions[eventId] ?? 0);
        hash = mixUint32(hash, this.eventEdgeIds[eventId] ?? 0);
        hash = mixUint32(hash, this.eventAppliedValues[eventId] ?? 0);
      }
    }
    return hash;
  }

  eventCompareForSelection(leftEventId: number, rightEventId: number): number {
    const leftKind = this.eventKinds[leftEventId] ?? 0;
    const rightKind = this.eventKinds[rightEventId] ?? 0;
    if (leftKind !== rightKind) {
      return leftKind - rightKind;
    }
    const leftTarget = this.eventTargetActorIds[leftEventId] ?? 0;
    const rightTarget = this.eventTargetActorIds[rightEventId] ?? 0;
    if (leftTarget !== rightTarget) {
      return leftTarget - rightTarget;
    }
    return leftEventId - rightEventId;
  }

  private validateEventInput(input: M3RelationshipEventInput): ValidationResult {
    if (!isIndexInRange(input.eventId, this.eventCapacity)) {
      return { ok: false, reason: "relationship.event_out_of_range" };
    }
    if (!isIndexInRange(input.actorId, this.actorCapacity)) {
      return { ok: false, reason: "relationship.actor_out_of_range" };
    }
    if (!isIndexInRange(input.targetActorId, this.actorCapacity)) {
      return { ok: false, reason: "relationship.target_out_of_range" };
    }
    if (input.actorId === input.targetActorId) {
      return { ok: false, reason: "relationship.self_edge_rejected" };
    }
    if (!isRelationshipLane(input.lane)) {
      return { ok: false, reason: "relationship.lane_out_of_range" };
    }
    if (!isRelationshipValue(input.delta)) {
      return { ok: false, reason: "relationship.value_out_of_range" };
    }
    if (
      !isNonNegativeUint32(input.sourceEventId) ||
      !isNonNegativeUint32(input.sourceOwnerVersion)
    ) {
      return { ok: false, reason: "relationship.source_out_of_range" };
    }
    return { ok: true };
  }

  private validateQuery(
    query: M3RelationshipQuery,
    candidateScratch: Uint32Array,
    selectedEventIds: Uint32Array,
    selectedScores: Int32Array,
  ): ValidationResult {
    if (!isIndexInRange(query.actorId, this.actorCapacity)) {
      return { ok: false, reason: "relationship.actor_out_of_range" };
    }
    if (!isRelationshipLane(query.lane)) {
      return { ok: false, reason: "relationship.lane_out_of_range" };
    }
    if (
      !isPositiveSafeInteger(query.candidateCap) ||
      !isPositiveSafeInteger(query.selectedCap) ||
      query.candidateCap > M3_RELATIONSHIP_DEFAULT_CANDIDATE_CAP ||
      query.selectedCap > M3_RELATIONSHIP_DEFAULT_SELECTED_CAP ||
      candidateScratch.length < query.candidateCap ||
      selectedEventIds.length < query.selectedCap ||
      selectedScores.length < query.selectedCap
    ) {
      return { ok: false, reason: "relationship.query_buffer_too_small" };
    }
    return { ok: true };
  }

  private isValidEdgeActors(actorId: number, targetActorId: number): boolean {
    return (
      isIndexInRange(actorId, this.actorCapacity) &&
      isIndexInRange(targetActorId, this.actorCapacity) &&
      actorId !== targetActorId
    );
  }

  private writeEvent(
    input: M3RelationshipEventInput,
    eventKind: M3SocialEventKind,
    tick: Tick,
    edgeId: number,
    appliedValue: number,
  ): void {
    this.eventActive[input.eventId] = 1;
    this.eventTicks[input.eventId] = tick;
    this.eventActorIds[input.eventId] = input.actorId;
    this.eventTargetActorIds[input.eventId] = input.targetActorId;
    this.eventKinds[input.eventId] = encodeEventKind(eventKind);
    this.eventLanes[input.eventId] = input.lane;
    this.eventDeltas[input.eventId] = input.delta;
    this.eventSourceIds[input.eventId] = input.sourceEventId;
    this.eventSourceVersions[input.eventId] = input.sourceOwnerVersion;
    this.eventReasons[input.eventId] = encodeRelationshipReason(input.reason);
    this.eventVersions[input.eventId] = this.graphVersionValue;
    this.eventEdgeIds[input.eventId] = edgeId;
    this.eventAppliedValues[input.eventId] = appliedValue;
  }

  private refreshEdgeLaneLink(
    edgeId: number,
    actorId: number,
    lane: M3RelationshipLane,
    previousValue: number,
    nextValue: number,
  ): void {
    const linkKey = edgeLaneOffset(edgeId, lane);
    const isLinked = (this.edgeLaneLinked[linkKey] ?? 0) === 1;
    if (previousValue === 0 && nextValue !== 0 && !isLinked) {
      this.insertEdgeLaneLink(edgeId, actorId, lane);
    } else if (previousValue !== 0 && nextValue === 0 && isLinked) {
      this.removeEdgeLaneLink(edgeId, actorId, lane);
    }
  }

  private insertEdgeLaneLink(edgeId: number, actorId: number, lane: M3RelationshipLane): void {
    const headKey = actorLaneKey(actorId, lane);
    const linkKey = edgeLaneOffset(edgeId, lane);
    let current = this.edgeLaneHeads[headKey] ?? -1;
    let previous = -1;
    while (current >= 0 && current < edgeId) {
      previous = current;
      current = this.edgeLaneNext[edgeLaneOffset(current, lane)] ?? -1;
    }
    this.edgeLaneLinked[linkKey] = 1;
    this.edgeLanePrevious[linkKey] = previous;
    this.edgeLaneNext[linkKey] = current;
    if (previous >= 0) {
      this.edgeLaneNext[edgeLaneOffset(previous, lane)] = edgeId;
    } else {
      this.edgeLaneHeads[headKey] = edgeId;
    }
    if (current >= 0) {
      this.edgeLanePrevious[edgeLaneOffset(current, lane)] = edgeId;
    }
    this.edgeLaneCounts[headKey] = (this.edgeLaneCounts[headKey] ?? 0) + 1;
  }

  private removeEdgeLaneLink(edgeId: number, actorId: number, lane: M3RelationshipLane): void {
    const headKey = actorLaneKey(actorId, lane);
    const linkKey = edgeLaneOffset(edgeId, lane);
    const previous = this.edgeLanePrevious[linkKey] ?? -1;
    const next = this.edgeLaneNext[linkKey] ?? -1;
    if (previous >= 0) {
      this.edgeLaneNext[edgeLaneOffset(previous, lane)] = next;
    } else {
      this.edgeLaneHeads[headKey] = next;
    }
    if (next >= 0) {
      this.edgeLanePrevious[edgeLaneOffset(next, lane)] = previous;
    }
    this.edgeLaneLinked[linkKey] = 0;
    this.edgeLanePrevious[linkKey] = -1;
    this.edgeLaneNext[linkKey] = -1;
    this.edgeLaneCounts[headKey] = Math.max(0, (this.edgeLaneCounts[headKey] ?? 0) - 1);
  }

  private insertEventLaneLink(eventId: number, actorId: number, lane: M3RelationshipLane): void {
    const headKey = actorLaneKey(actorId, lane);
    let current = this.eventLaneHeads[headKey] ?? -1;
    let previous = -1;
    while (current >= 0 && isEventBefore(current, eventId, this)) {
      previous = current;
      current = this.eventLaneNext[current] ?? -1;
    }
    this.eventLanePrevious[eventId] = previous;
    this.eventLaneNext[eventId] = current;
    if (previous >= 0) {
      this.eventLaneNext[previous] = eventId;
    } else {
      this.eventLaneHeads[headKey] = eventId;
    }
    if (current >= 0) {
      this.eventLanePrevious[current] = eventId;
    }
    this.eventLaneCounts[headKey] = (this.eventLaneCounts[headKey] ?? 0) + 1;
  }

  private scoreEvent(eventId: number): number {
    const delta = absInt(this.eventDeltas[eventId] ?? 0);
    const kindPriority = 4 - (this.eventKinds[eventId] ?? 0);
    return delta * 10 + kindPriority;
  }

  private scoreEdge(edgeId: number, lane: M3RelationshipLane): number {
    return absInt(this.edgeValues[edgeLaneOffset(edgeId, lane)] ?? 0);
  }
}

export class M3RelationshipReasonTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly ticks: Float64Array;
  private readonly actorIds: Uint32Array;
  private readonly targetActorIds: Uint32Array;
  private readonly lanes: Uint8Array;
  private readonly candidateTotals: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly scoredCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedTargetIds: Uint32Array;
  private readonly sourceEventIds: Uint32Array;
  private readonly sourceGraphVersions: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private readonly graphVersions: Uint32Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity = M3_RELATIONSHIP_DEFAULT_TRACE_CAPACITY) {
    assertValidCapacity(capacity, "M3 relationship trace capacity");
    this.capacity = capacity;
    this.sequences = new Uint32Array(capacity);
    this.ticks = new Float64Array(capacity);
    this.actorIds = new Uint32Array(capacity);
    this.targetActorIds = new Uint32Array(capacity);
    this.lanes = new Uint8Array(capacity);
    this.candidateTotals = new Uint32Array(capacity);
    this.visitedCounts = new Uint32Array(capacity);
    this.scoredCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedTargetIds = new Uint32Array(capacity);
    this.sourceEventIds = new Uint32Array(capacity);
    this.sourceGraphVersions = new Uint32Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
    this.graphVersions = new Uint32Array(capacity);
    this.targetActorIds.fill(M3_SOCIAL_EVENT_NONE);
    this.selectedTargetIds.fill(M3_SOCIAL_EVENT_NONE);
  }

  record(input: M3RelationshipTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;
    this.sequences[slot] = sequence;
    this.ticks[slot] = input.tick;
    this.actorIds[slot] = input.actorId;
    this.targetActorIds[slot] = input.targetActorId;
    this.lanes[slot] = input.lane;
    this.candidateTotals[slot] = input.candidateTotal;
    this.visitedCounts[slot] = input.visitedCount;
    this.scoredCounts[slot] = input.scoredCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedTargetIds[slot] = input.selectedTargetId;
    this.sourceEventIds[slot] = input.sourceEventId;
    this.sourceGraphVersions[slot] = input.sourceGraphVersion;
    this.reasonCodes[slot] = encodeRelationshipReason(input.reason);
    this.graphVersions[slot] = input.graphVersion;
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): M3RelationshipTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }
    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    const lane = this.lanes[slot] ?? M3_RELATIONSHIP_LANE_KINSHIP;
    return {
      sequence: this.sequences[slot] ?? 0,
      tick: this.ticks[slot] ?? 0,
      actorId: this.actorIds[slot] ?? 0,
      targetActorId: this.targetActorIds[slot] ?? M3_SOCIAL_EVENT_NONE,
      lane: isRelationshipLane(lane) ? lane : M3_RELATIONSHIP_LANE_KINSHIP,
      candidateTotal: this.candidateTotals[slot] ?? 0,
      visitedCount: this.visitedCounts[slot] ?? 0,
      scoredCount: this.scoredCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedTargetId: this.selectedTargetIds[slot] ?? M3_SOCIAL_EVENT_NONE,
      sourceEventId: this.sourceEventIds[slot] ?? 0,
      sourceGraphVersion: this.sourceGraphVersions[slot] ?? 0,
      reason: decodeRelationshipReason(this.reasonCodes[slot] ?? 0),
      graphVersion: this.graphVersions[slot] ?? 0,
    };
  }

  createMetrics(): M3RelationshipTraceMetrics {
    return {
      capacity: this.capacity,
      storedCount: this.stored,
      nextSequence: this.nextSequence,
    };
  }
}

export function createRelationshipGraphStore(
  options: M3RelationshipStoreOptions,
): RelationshipGraphStore {
  return new RelationshipGraphStore(options);
}

export function createM3RelationshipReasonTraceStore(
  capacity?: number,
): M3RelationshipReasonTraceStore {
  return new M3RelationshipReasonTraceStore(capacity);
}

export function createM3OrdinarySocialEvent(
  eventId: number,
  tick: Tick,
  actorId: number,
  targetActorId: number,
  kind: M3SocialEventKind,
  sourceEventId: number,
  sourceOwnerVersion: number,
): M3RelationshipEventInput {
  const encodedKind = encodeEventKind(kind);
  return {
    eventId,
    tick,
    actorId,
    targetActorId,
    kind,
    lane: defaultLaneForKind(encodedKind),
    delta: defaultDeltaForKind(encodedKind),
    sourceEventId,
    sourceOwnerVersion,
    reason: "relationship.event_applied",
  };
}

function insertSelectedEvent(
  eventId: number,
  score: number,
  selectedEventIds: Uint32Array,
  selectedScores: Int32Array,
  selectedCount: number,
  selectedCap: number,
  store: RelationshipGraphStore,
): number {
  let insertAt = 0;
  while (
    insertAt < selectedCount &&
    isSelectedBefore(
      selectedEventIds[insertAt] ?? 0,
      selectedScores[insertAt] ?? 0,
      eventId,
      score,
      store,
    )
  ) {
    insertAt += 1;
  }
  if (insertAt >= selectedCap) {
    return selectedCount;
  }
  const nextCount = Math.min(selectedCount + 1, selectedCap);
  for (let index = nextCount - 1; index > insertAt; index -= 1) {
    selectedEventIds[index] = selectedEventIds[index - 1] ?? M3_SOCIAL_EVENT_NONE;
    selectedScores[index] = selectedScores[index - 1] ?? 0;
  }
  selectedEventIds[insertAt] = eventId;
  selectedScores[insertAt] = score;
  return nextCount;
}

function insertSelectedEdge(
  edgeId: number,
  score: number,
  selectedEdgeIds: Uint32Array,
  selectedScores: Int32Array,
  selectedCount: number,
  selectedCap: number,
  actorCapacity: number,
): number {
  let insertAt = 0;
  while (
    insertAt < selectedCount &&
    isSelectedEdgeBefore(
      selectedEdgeIds[insertAt] ?? 0,
      selectedScores[insertAt] ?? 0,
      edgeId,
      score,
      actorCapacity,
    )
  ) {
    insertAt += 1;
  }
  if (insertAt >= selectedCap) {
    return selectedCount;
  }
  const nextCount = Math.min(selectedCount + 1, selectedCap);
  for (let index = nextCount - 1; index > insertAt; index -= 1) {
    selectedEdgeIds[index] = selectedEdgeIds[index - 1] ?? M3_RELATIONSHIP_EDGE_NONE;
    selectedScores[index] = selectedScores[index - 1] ?? 0;
  }
  selectedEdgeIds[insertAt] = edgeId;
  selectedScores[insertAt] = score;
  return nextCount;
}

function isSelectedBefore(
  selectedEventId: number,
  selectedScore: number,
  candidateEventId: number,
  candidateScore: number,
  store: RelationshipGraphStore,
): boolean {
  if (selectedScore !== candidateScore) {
    return selectedScore > candidateScore;
  }
  return store.eventCompareForSelection(selectedEventId, candidateEventId) <= 0;
}

function isSelectedEdgeBefore(
  selectedEdgeId: number,
  selectedScore: number,
  candidateEdgeId: number,
  candidateScore: number,
  actorCapacity: number,
): boolean {
  if (selectedScore !== candidateScore) {
    return selectedScore > candidateScore;
  }
  const selectedTarget = selectedEdgeId % actorCapacity;
  const candidateTarget = candidateEdgeId % actorCapacity;
  if (selectedTarget !== candidateTarget) {
    return selectedTarget < candidateTarget;
  }
  return selectedEdgeId <= candidateEdgeId;
}

function isEventBefore(
  currentEventId: number,
  nextEventId: number,
  store: RelationshipGraphStore,
): boolean {
  const current = store.readEvent(currentEventId);
  const next = store.readEvent(nextEventId);
  if (current === undefined || next === undefined) {
    return currentEventId < nextEventId;
  }
  if (current.tick !== next.tick) {
    return current.tick > next.tick;
  }
  if (current.sourceEventId !== next.sourceEventId) {
    return current.sourceEventId < next.sourceEventId;
  }
  if (current.actorId !== next.actorId) {
    return current.actorId < next.actorId;
  }
  if (current.targetActorId !== next.targetActorId) {
    return current.targetActorId < next.targetActorId;
  }
  return currentEventId < nextEventId;
}

function clearSelection(
  selectedEventIds: Uint32Array,
  selectedScores: Int32Array,
  selectedCap: number,
): void {
  for (let index = 0; index < selectedCap; index += 1) {
    selectedEventIds[index] = M3_SOCIAL_EVENT_NONE;
    selectedScores[index] = 0;
  }
}

function defaultLaneForKind(kind: number): M3RelationshipLane {
  if (kind === 1) {
    return M3_RELATIONSHIP_LANE_TRUST;
  }
  if (kind === 2) {
    return M3_RELATIONSHIP_LANE_CARE;
  }
  if (kind === 3) {
    return M3_RELATIONSHIP_LANE_RESENTMENT;
  }
  return M3_RELATIONSHIP_LANE_GRATITUDE;
}

function defaultDeltaForKind(kind: number): number {
  if (kind === 1) {
    return 70;
  }
  if (kind === 2) {
    return 45;
  }
  if (kind === 3) {
    return 90;
  }
  return 120;
}

function edgeIdFor(actorId: number, targetActorId: number, actorCapacity: number): number {
  return actorId * actorCapacity + targetActorId;
}

function edgeLaneOffset(edgeId: number, lane: number): number {
  return edgeId * M3_RELATIONSHIP_LANE_COUNT + lane;
}

function actorLaneKey(actorId: number, lane: number): number {
  return actorId * M3_RELATIONSHIP_LANE_COUNT + lane;
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

function mixTick(hash: number, tick: Tick): number {
  return mixUint32(mixUint32(hash, tick % 0x1_0000_0000), Math.trunc(tick / 0x1_0000_0000));
}

function clampRelationshipValue(value: number): number {
  if (value < M3_RELATIONSHIP_VALUE_MIN) {
    return M3_RELATIONSHIP_VALUE_MIN;
  }
  if (value > M3_RELATIONSHIP_VALUE_MAX) {
    return M3_RELATIONSHIP_VALUE_MAX;
  }
  return value;
}

function clampPositiveMoodStrength(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1_000) {
    return 1_000;
  }
  return value;
}

function absInt(value: number): number {
  return value < 0 ? -value : value;
}

function isRelationshipLane(value: number): value is M3RelationshipLane {
  return isIndexInRange(value, M3_RELATIONSHIP_LANE_COUNT);
}

function isRelationshipValue(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= M3_RELATIONSHIP_VALUE_MIN &&
    value <= M3_RELATIONSHIP_VALUE_MAX
  );
}

function normalizeEventKind(value: string): M3SocialEventKind | undefined {
  if (
    value === "care_received" ||
    value === "meal_shared" ||
    value === "work_burden_shifted" ||
    value === "care_delayed"
  ) {
    return value;
  }
  return undefined;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function encodeEventKind(kind: M3SocialEventKind): number {
  if (kind === "meal_shared") {
    return 1;
  }
  if (kind === "work_burden_shifted") {
    return 2;
  }
  if (kind === "care_delayed") {
    return 3;
  }
  return 0;
}

function decodeEventKind(code: number): M3SocialEventKind {
  if (code === 1) {
    return "meal_shared";
  }
  if (code === 2) {
    return "work_burden_shifted";
  }
  if (code === 3) {
    return "care_delayed";
  }
  return "care_received";
}

function encodeRelationshipReason(reason: M3RelationshipReason): number {
  switch (reason) {
    case "relationship.edge_updated":
      return 1;
    case "relationship.event_applied":
      return 2;
    case "relationship.event_rejected_duplicate":
      return 3;
    case "relationship.explanation_fact_source_trust_recent_events":
      return 4;
    case "trace.candidate_cap_reached":
      return 5;
    default:
      return 0;
  }
}

function decodeRelationshipReason(code: number): M3RelationshipReason {
  switch (code) {
    case 1:
      return "relationship.edge_updated";
    case 2:
      return "relationship.event_applied";
    case 3:
      return "relationship.event_rejected_duplicate";
    case 4:
      return "relationship.explanation_fact_source_trust_recent_events";
    case 5:
      return "trace.candidate_cap_reached";
    default:
      return "relationship.edge_created";
  }
}
