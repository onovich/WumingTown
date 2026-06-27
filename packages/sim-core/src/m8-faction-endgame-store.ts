import {
  M8_ENDGAME_EXPLANATION_MASK_ALL,
  M8_ENDGAME_ROUTE_COUNT,
  M8_ENDGAME_ROUTE_STATE_AVAILABLE,
  M8_ENDGAME_ROUTE_STATE_BLOCKED,
  M8_ENDGAME_ROUTE_STATE_CONTESTED,
  M8_ENDGAME_ROUTE_STATE_SEEDED,
  M8_FACTION_ARC_STATE_FAILED,
  M8_FACTION_ARC_STATE_NEGOTIATED,
  M8_FACTION_ARC_STATE_SEEDED,
  M8_FACTION_CONSTRAINT_MASK_ALL,
  M8_FACTION_COUNT,
  M8_FACTION_ENDGAME_NONE,
  M8_FACTION_MASK_ALL,
  M8_FACTION_RESOURCE_MASK_ALL,
  type M8EndgameRouteEvaluationQuery,
  type M8EndgameRouteEvaluationResult,
  type M8EndgameRouteInput,
  type M8EndgameRouteView,
  type M8FactionArcInput,
  type M8FactionArcQuery,
  type M8FactionArcQueryResult,
  type M8FactionArcTransitionInput,
  type M8FactionArcView,
  type M8FactionEndgameMetrics,
  type M8FactionEndgameMutationResult,
  type M8FactionEndgameReason,
  type M8FactionEndgameStoreOptions,
} from "./m8-faction-endgame-types";

export class M8FactionEndgameStore {
  readonly arcCapacity: number;
  readonly routePathCapacity: number;

  private readonly arcActive: Uint8Array;
  private readonly arcFactionIds: Uint32Array;
  private readonly arcStates: Uint8Array;
  private readonly arcResourceMasks: Uint32Array;
  private readonly arcConstraintMasks: Uint32Array;
  private readonly arcContradictionMasks: Uint32Array;
  private readonly arcNegotiationMasks: Uint32Array;
  private readonly arcFailureMasks: Uint32Array;
  private readonly arcExplanationMasks: Uint32Array;
  private readonly arcFactionOwnerVersions: Uint32Array;
  private readonly arcGovernanceOwnerVersions: Uint32Array;
  private readonly arcChronicleOwnerVersions: Uint32Array;
  private readonly arcObligationOwnerVersions: Uint32Array;
  private readonly arcOrdinanceOwnerVersions: Uint32Array;
  private readonly arcSourceEvents: Uint32Array;
  private readonly arcSourceOwnerVersions: Uint32Array;
  private readonly arcVersions: Uint32Array;
  private readonly arcPriorities: Uint16Array;
  private readonly arcStableSequences: Uint32Array;
  private readonly arcHeadsByFaction: Int32Array;
  private readonly arcNext: Int32Array;
  private readonly arcPrevious: Int32Array;
  private readonly routeActive: Uint8Array;
  private readonly routeIds: Uint32Array;
  private readonly routeStates: Uint8Array;
  private readonly routeSupportScores: Uint16Array;
  private readonly routeCostScores: Uint16Array;
  private readonly routeOppositionScores: Uint16Array;
  private readonly routeExplanationMasks: Uint32Array;
  private readonly routeFactionSupportMasks: Uint32Array;
  private readonly routeFactionOppositionMasks: Uint32Array;
  private readonly routeLampBoundaryScores: Uint16Array;
  private readonly routeChronicleScores: Uint16Array;
  private readonly routeObligationPressures: Uint16Array;
  private readonly routeOrdinanceLegitimacies: Uint16Array;
  private readonly routeSocialTrustScores: Uint16Array;
  private readonly routeProductionScores: Uint16Array;
  private readonly routeFactionOwnerVersions: Uint32Array;
  private readonly routeGovernanceOwnerVersions: Uint32Array;
  private readonly routeChronicleOwnerVersions: Uint32Array;
  private readonly routeObligationOwnerVersions: Uint32Array;
  private readonly routeOrdinanceOwnerVersions: Uint32Array;
  private readonly routeSourceEvents: Uint32Array;
  private readonly routeSourceOwnerVersions: Uint32Array;
  private readonly routeVersions: Uint32Array;
  private readonly routePriorities: Uint16Array;
  private readonly routeStableSequences: Uint32Array;
  private readonly routeHeadsByRoute: Int32Array;
  private readonly routeNext: Int32Array;
  private readonly routePrevious: Int32Array;
  private activeArcCountValue = 0;
  private activeRoutePathCountValue = 0;
  private indexedArcCountValue = 0;
  private indexedRoutePathCountValue = 0;
  private negotiatedArcCountValue = 0;
  private failedArcCountValue = 0;
  private availableRouteCountValue = 0;
  private blockedRouteCountValue = 0;
  private contestedRouteCountValue = 0;
  private ownerVersionValue = 0;
  private lastQueryVisitsValue = 0;
  private totalQueryVisitsValue = 0;
  private lastQuerySelectedValue = 0;
  private queryCapHitCountValue = 0;
  private staleBasisRejectCountValue = 0;

  constructor(options: M8FactionEndgameStoreOptions) {
    this.arcCapacity = requirePositive(options.arcCapacity, "arc capacity");
    this.routePathCapacity = requirePositive(options.routePathCapacity, "route path capacity");
    this.arcActive = new Uint8Array(this.arcCapacity);
    this.arcFactionIds = filledUint32(this.arcCapacity);
    this.arcStates = new Uint8Array(this.arcCapacity);
    this.arcResourceMasks = new Uint32Array(this.arcCapacity);
    this.arcConstraintMasks = new Uint32Array(this.arcCapacity);
    this.arcContradictionMasks = new Uint32Array(this.arcCapacity);
    this.arcNegotiationMasks = new Uint32Array(this.arcCapacity);
    this.arcFailureMasks = new Uint32Array(this.arcCapacity);
    this.arcExplanationMasks = new Uint32Array(this.arcCapacity);
    this.arcFactionOwnerVersions = new Uint32Array(this.arcCapacity);
    this.arcGovernanceOwnerVersions = new Uint32Array(this.arcCapacity);
    this.arcChronicleOwnerVersions = new Uint32Array(this.arcCapacity);
    this.arcObligationOwnerVersions = new Uint32Array(this.arcCapacity);
    this.arcOrdinanceOwnerVersions = new Uint32Array(this.arcCapacity);
    this.arcSourceEvents = filledUint32(this.arcCapacity);
    this.arcSourceOwnerVersions = new Uint32Array(this.arcCapacity);
    this.arcVersions = new Uint32Array(this.arcCapacity);
    this.arcPriorities = new Uint16Array(this.arcCapacity);
    this.arcStableSequences = filledUint32(this.arcCapacity);
    this.arcHeadsByFaction = filledInt32(M8_FACTION_COUNT);
    this.arcNext = filledInt32(this.arcCapacity);
    this.arcPrevious = filledInt32(this.arcCapacity);
    this.routeActive = new Uint8Array(this.routePathCapacity);
    this.routeIds = filledUint32(this.routePathCapacity);
    this.routeStates = new Uint8Array(this.routePathCapacity);
    this.routeSupportScores = new Uint16Array(this.routePathCapacity);
    this.routeCostScores = new Uint16Array(this.routePathCapacity);
    this.routeOppositionScores = new Uint16Array(this.routePathCapacity);
    this.routeExplanationMasks = new Uint32Array(this.routePathCapacity);
    this.routeFactionSupportMasks = new Uint32Array(this.routePathCapacity);
    this.routeFactionOppositionMasks = new Uint32Array(this.routePathCapacity);
    this.routeLampBoundaryScores = new Uint16Array(this.routePathCapacity);
    this.routeChronicleScores = new Uint16Array(this.routePathCapacity);
    this.routeObligationPressures = new Uint16Array(this.routePathCapacity);
    this.routeOrdinanceLegitimacies = new Uint16Array(this.routePathCapacity);
    this.routeSocialTrustScores = new Uint16Array(this.routePathCapacity);
    this.routeProductionScores = new Uint16Array(this.routePathCapacity);
    this.routeFactionOwnerVersions = new Uint32Array(this.routePathCapacity);
    this.routeGovernanceOwnerVersions = new Uint32Array(this.routePathCapacity);
    this.routeChronicleOwnerVersions = new Uint32Array(this.routePathCapacity);
    this.routeObligationOwnerVersions = new Uint32Array(this.routePathCapacity);
    this.routeOrdinanceOwnerVersions = new Uint32Array(this.routePathCapacity);
    this.routeSourceEvents = filledUint32(this.routePathCapacity);
    this.routeSourceOwnerVersions = new Uint32Array(this.routePathCapacity);
    this.routeVersions = new Uint32Array(this.routePathCapacity);
    this.routePriorities = new Uint16Array(this.routePathCapacity);
    this.routeStableSequences = filledUint32(this.routePathCapacity);
    this.routeHeadsByRoute = filledInt32(M8_ENDGAME_ROUTE_COUNT);
    this.routeNext = filledInt32(this.routePathCapacity);
    this.routePrevious = filledInt32(this.routePathCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  registerFactionArc(input: M8FactionArcInput): M8FactionEndgameMutationResult {
    const valid = this.validateArcInput(input);
    if (!valid.ok) return valid;
    if ((this.arcActive[input.arcId] ?? 0) === 1) {
      return { ok: false, reason: "m8_faction_endgame_arc_already_registered" };
    }
    const version = this.nextVersion();
    if (!version.ok) return version;
    this.activeArcCountValue += 1;
    this.linkArc(input.arcId, input.factionId, input.priority, input.stableSequence);
    this.writeArc(input, version.ownerVersion);
    this.ownerVersionValue = version.ownerVersion;
    return this.changed("m8_faction_endgame_arc_registered");
  }

  transitionFactionArc(input: M8FactionArcTransitionInput): M8FactionEndgameMutationResult {
    if (!isIndex(input.arcId, this.arcCapacity))
      return { ok: false, reason: "m8_faction_endgame_arc_id_out_of_range" };
    if ((this.arcActive[input.arcId] ?? 0) === 0)
      return { ok: false, reason: "m8_faction_endgame_arc_id_out_of_range" };
    if (input.expectedOwnerVersion !== this.ownerVersionValue) {
      this.staleBasisRejectCountValue += 1;
      return { ok: false, reason: "m8_faction_endgame_query_stale_basis" };
    }
    if (!isArcTerminalState(input.nextState))
      return { ok: false, reason: "m8_faction_endgame_state_invalid" };
    if ((this.arcStates[input.arcId] ?? 0) !== M8_FACTION_ARC_STATE_SEEDED)
      return { ok: false, reason: "m8_faction_endgame_state_transition_invalid" };
    if (!isUint32(input.tick)) return { ok: false, reason: "m8_faction_endgame_score_invalid" };
    const version = this.nextVersion();
    if (!version.ok) return version;
    this.arcStates[input.arcId] = input.nextState;
    this.arcVersions[input.arcId] = version.ownerVersion;
    this.ownerVersionValue = version.ownerVersion;
    if (input.nextState === M8_FACTION_ARC_STATE_NEGOTIATED) this.negotiatedArcCountValue += 1;
    if (input.nextState === M8_FACTION_ARC_STATE_FAILED) this.failedArcCountValue += 1;
    return this.changed("m8_faction_endgame_arc_transitioned");
  }

  registerRoutePath(input: M8EndgameRouteInput): M8FactionEndgameMutationResult {
    const pathId = input.routeId;
    const valid = this.validateRouteInput(input, pathId);
    if (!valid.ok) return valid;
    if ((this.routeActive[pathId] ?? 0) === 1) {
      return { ok: false, reason: "m8_faction_endgame_route_already_registered" };
    }
    const version = this.nextVersion();
    if (!version.ok) return version;
    this.activeRoutePathCountValue += 1;
    this.linkRoute(pathId, input.routeId, input.priority, input.stableSequence);
    this.writeRoute(pathId, input, version.ownerVersion);
    this.ownerVersionValue = version.ownerVersion;
    return this.changed("m8_faction_endgame_route_registered");
  }

  queryFactionArcs(query: M8FactionArcQuery, outputArcIds: Uint32Array): M8FactionArcQueryResult {
    const valid = this.validateArcQuery(query, outputArcIds);
    if (!valid.ok) return valid;
    if (query.expectedOwnerVersion !== this.ownerVersionValue) {
      this.staleBasisRejectCountValue += 1;
      return { ok: false, reason: "m8_faction_endgame_query_stale_basis" };
    }
    clearOutput(outputArcIds, query.candidateCap);
    const selection = this.selectArcLane(query, outputArcIds);
    this.recordQueryMetrics(selection.visited, selection.selected, selection.capHit);
    return {
      ok: true,
      selectedCount: selection.selected,
      visitedCount: selection.visited,
      candidateCapHit: selection.candidateCapHit,
      scanCapHit: selection.scanCapHit,
      ownerVersion: this.ownerVersionValue,
      reason: queryReason(selection),
    };
  }

  evaluateRoute(
    query: M8EndgameRouteEvaluationQuery,
    outputRoutePathIds: Uint32Array,
  ): M8EndgameRouteEvaluationResult {
    const valid = this.validateRouteQuery(query, outputRoutePathIds);
    if (!valid.ok) return valid;
    if (query.expectedOwnerVersion !== this.ownerVersionValue) {
      this.staleBasisRejectCountValue += 1;
      return { ok: false, reason: "m8_faction_endgame_query_stale_basis" };
    }
    clearOutput(outputRoutePathIds, query.candidateCap);
    const selection = this.selectRouteLane(query, outputRoutePathIds);
    this.recordQueryMetrics(selection.visited, selection.selected, selection.capHit);
    if (selection.selected === 0 || selection.scanCapHit || selection.candidateCapHit) {
      return this.routeResult(queryReason(selection), selection, M8_ENDGAME_ROUTE_STATE_BLOCKED);
    }
    const selectedPathId = outputRoutePathIds[0] ?? M8_FACTION_ENDGAME_NONE;
    const routeReason = this.deriveRouteReason(query, selectedPathId);
    const routeState = reasonToRouteState(routeReason);
    const version = this.nextVersion();
    if (!version.ok) return version;
    this.setRouteState(selectedPathId, routeState, version.ownerVersion);
    this.ownerVersionValue = version.ownerVersion;
    return this.routeResult(routeReason, selection, routeState);
  }

  readFactionArc(arcId: number): M8FactionArcView | undefined {
    if (!isIndex(arcId, this.arcCapacity) || (this.arcActive[arcId] ?? 0) === 0) return undefined;
    return {
      arcId,
      factionId: this.arcFactionIds[arcId] ?? M8_FACTION_ENDGAME_NONE,
      resourceMask: this.arcResourceMasks[arcId] ?? 0,
      constraintMask: this.arcConstraintMasks[arcId] ?? 0,
      contradictionMask: this.arcContradictionMasks[arcId] ?? 0,
      negotiationMask: this.arcNegotiationMasks[arcId] ?? 0,
      failureMask: this.arcFailureMasks[arcId] ?? 0,
      explanationMask: this.arcExplanationMasks[arcId] ?? 0,
      factionOwnerVersion: this.arcFactionOwnerVersions[arcId] ?? 0,
      governanceOwnerVersion: this.arcGovernanceOwnerVersions[arcId] ?? 0,
      chronicleOwnerVersion: this.arcChronicleOwnerVersions[arcId] ?? 0,
      obligationOwnerVersion: this.arcObligationOwnerVersions[arcId] ?? 0,
      ordinanceOwnerVersion: this.arcOrdinanceOwnerVersions[arcId] ?? 0,
      sourceEventId: this.arcSourceEvents[arcId] ?? M8_FACTION_ENDGAME_NONE,
      sourceOwnerVersion: this.arcSourceOwnerVersions[arcId] ?? 0,
      priority: this.arcPriorities[arcId] ?? 0,
      stableSequence: this.arcStableSequences[arcId] ?? M8_FACTION_ENDGAME_NONE,
      state: this.arcStates[arcId] ?? 0,
      arcVersion: this.arcVersions[arcId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readRoutePath(routePathId: number): M8EndgameRouteView | undefined {
    if (!isIndex(routePathId, this.routePathCapacity) || (this.routeActive[routePathId] ?? 0) === 0)
      return undefined;
    return {
      routePathId,
      routeId: this.routeIds[routePathId] ?? M8_FACTION_ENDGAME_NONE,
      supportScore: this.routeSupportScores[routePathId] ?? 0,
      costScore: this.routeCostScores[routePathId] ?? 0,
      oppositionScore: this.routeOppositionScores[routePathId] ?? 0,
      explanationMask: this.routeExplanationMasks[routePathId] ?? 0,
      factionSupportMask: this.routeFactionSupportMasks[routePathId] ?? 0,
      factionOppositionMask: this.routeFactionOppositionMasks[routePathId] ?? 0,
      lampBoundaryScore: this.routeLampBoundaryScores[routePathId] ?? 0,
      chronicleScore: this.routeChronicleScores[routePathId] ?? 0,
      obligationPressure: this.routeObligationPressures[routePathId] ?? 0,
      ordinanceLegitimacy: this.routeOrdinanceLegitimacies[routePathId] ?? 0,
      socialTrustScore: this.routeSocialTrustScores[routePathId] ?? 0,
      productionScore: this.routeProductionScores[routePathId] ?? 0,
      factionOwnerVersion: this.routeFactionOwnerVersions[routePathId] ?? 0,
      governanceOwnerVersion: this.routeGovernanceOwnerVersions[routePathId] ?? 0,
      chronicleOwnerVersion: this.routeChronicleOwnerVersions[routePathId] ?? 0,
      obligationOwnerVersion: this.routeObligationOwnerVersions[routePathId] ?? 0,
      ordinanceOwnerVersion: this.routeOrdinanceOwnerVersions[routePathId] ?? 0,
      sourceEventId: this.routeSourceEvents[routePathId] ?? M8_FACTION_ENDGAME_NONE,
      sourceOwnerVersion: this.routeSourceOwnerVersions[routePathId] ?? 0,
      priority: this.routePriorities[routePathId] ?? 0,
      stableSequence: this.routeStableSequences[routePathId] ?? M8_FACTION_ENDGAME_NONE,
      state: this.routeStates[routePathId] ?? 0,
      routeVersion: this.routeVersions[routePathId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  createMetrics(): M8FactionEndgameMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeArcCount: this.activeArcCountValue,
      activeRoutePathCount: this.activeRoutePathCountValue,
      indexedArcCount: this.indexedArcCountValue,
      indexedRoutePathCount: this.indexedRoutePathCountValue,
      negotiatedArcCount: this.negotiatedArcCountValue,
      failedArcCount: this.failedArcCountValue,
      availableRouteCount: this.availableRouteCountValue,
      blockedRouteCount: this.blockedRouteCountValue,
      contestedRouteCount: this.contestedRouteCountValue,
      lastQueryVisits: this.lastQueryVisitsValue,
      totalQueryVisits: this.totalQueryVisitsValue,
      lastQuerySelected: this.lastQuerySelectedValue,
      queryCapHitCount: this.queryCapHitCountValue,
      staleBasisRejectCount: this.staleBasisRejectCountValue,
    };
  }

  private routeResult(
    reason: M8FactionEndgameReason,
    selection: LaneSelection,
    routeState: number,
  ): M8EndgameRouteEvaluationResult {
    const pathId = selection.selected > 0 ? selection.firstSelected : M8_FACTION_ENDGAME_NONE;
    return {
      ok: true,
      selectedCount: selection.selected,
      visitedCount: selection.visited,
      candidateCapHit: selection.candidateCapHit,
      scanCapHit: selection.scanCapHit,
      routeState,
      supportScore: isIndex(pathId, this.routePathCapacity)
        ? (this.routeSupportScores[pathId] ?? 0)
        : 0,
      costScore: isIndex(pathId, this.routePathCapacity) ? (this.routeCostScores[pathId] ?? 0) : 0,
      oppositionScore: isIndex(pathId, this.routePathCapacity)
        ? (this.routeOppositionScores[pathId] ?? 0)
        : 0,
      explanationMask: isIndex(pathId, this.routePathCapacity)
        ? (this.routeExplanationMasks[pathId] ?? 0)
        : 0,
      ownerVersion: this.ownerVersionValue,
      reason,
    };
  }

  private deriveRouteReason(
    query: M8EndgameRouteEvaluationQuery,
    pathId: number,
  ): M8FactionEndgameReason {
    const explanationMask = this.routeExplanationMasks[pathId] ?? 0;
    if ((explanationMask & query.requiredExplanationMask) !== query.requiredExplanationMask) {
      return "m8_faction_endgame_route_blocked_missing_explanation";
    }
    if ((this.routeSupportScores[pathId] ?? 0) < query.minSupportScore) {
      return "m8_faction_endgame_route_blocked_low_support";
    }
    if (
      (this.routeCostScores[pathId] ?? 0) > query.maxCostScore ||
      (this.routeOppositionScores[pathId] ?? 0) > query.maxOppositionScore
    ) {
      return "m8_faction_endgame_route_contested";
    }
    return "m8_faction_endgame_route_available";
  }

  private setRouteState(pathId: number, nextState: number, version: number): void {
    const previous = this.routeStates[pathId] ?? M8_ENDGAME_ROUTE_STATE_SEEDED;
    if (previous === M8_ENDGAME_ROUTE_STATE_AVAILABLE) this.availableRouteCountValue -= 1;
    if (previous === M8_ENDGAME_ROUTE_STATE_BLOCKED) this.blockedRouteCountValue -= 1;
    if (previous === M8_ENDGAME_ROUTE_STATE_CONTESTED) this.contestedRouteCountValue -= 1;
    this.routeStates[pathId] = nextState;
    this.routeVersions[pathId] = version;
    if (nextState === M8_ENDGAME_ROUTE_STATE_AVAILABLE) this.availableRouteCountValue += 1;
    if (nextState === M8_ENDGAME_ROUTE_STATE_BLOCKED) this.blockedRouteCountValue += 1;
    if (nextState === M8_ENDGAME_ROUTE_STATE_CONTESTED) this.contestedRouteCountValue += 1;
  }

  private validateArcInput(
    input: M8FactionArcInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M8FactionEndgameReason } {
    if (!isIndex(input.arcId, this.arcCapacity))
      return { ok: false, reason: "m8_faction_endgame_arc_id_out_of_range" };
    if (!isIndex(input.factionId, M8_FACTION_COUNT))
      return { ok: false, reason: "m8_faction_endgame_faction_id_out_of_range" };
    if (
      !isMask(input.resourceMask, M8_FACTION_RESOURCE_MASK_ALL) ||
      !isMask(input.constraintMask, M8_FACTION_CONSTRAINT_MASK_ALL) ||
      !isMask(input.contradictionMask, M8_FACTION_MASK_ALL) ||
      !isMask(input.negotiationMask, M8_FACTION_MASK_ALL) ||
      !isMask(input.failureMask, M8_FACTION_MASK_ALL) ||
      !isMask(input.explanationMask, M8_ENDGAME_EXPLANATION_MASK_ALL)
    ) {
      return { ok: false, reason: "m8_faction_endgame_mask_invalid" };
    }
    return validateVersions(input);
  }

  private validateRouteInput(
    input: M8EndgameRouteInput,
    pathId: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M8FactionEndgameReason } {
    if (!isIndex(pathId, this.routePathCapacity) || !isIndex(input.routeId, M8_ENDGAME_ROUTE_COUNT))
      return { ok: false, reason: "m8_faction_endgame_route_id_out_of_range" };
    if (
      !isScore(input.supportScore) ||
      !isScore(input.costScore) ||
      !isScore(input.oppositionScore) ||
      !isScore(input.lampBoundaryScore) ||
      !isScore(input.chronicleScore) ||
      !isScore(input.obligationPressure) ||
      !isScore(input.ordinanceLegitimacy) ||
      !isScore(input.socialTrustScore) ||
      !isScore(input.productionScore) ||
      !isScore(input.priority)
    ) {
      return { ok: false, reason: "m8_faction_endgame_score_invalid" };
    }
    if (
      !isMask(input.explanationMask, M8_ENDGAME_EXPLANATION_MASK_ALL) ||
      !isMask(input.factionSupportMask, M8_FACTION_MASK_ALL) ||
      !isOptionalMask(input.factionOppositionMask, M8_FACTION_MASK_ALL)
    ) {
      return { ok: false, reason: "m8_faction_endgame_mask_invalid" };
    }
    return validateVersions(input);
  }

  private validateArcQuery(
    query: M8FactionArcQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M8FactionEndgameReason } {
    if (!isIndex(query.factionId, M8_FACTION_COUNT))
      return { ok: false, reason: "m8_faction_endgame_faction_id_out_of_range" };
    return validateQueryShape(
      query.expectedOwnerVersion,
      query.candidateCap,
      query.scanCap,
      output,
    );
  }

  private validateRouteQuery(
    query: M8EndgameRouteEvaluationQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M8FactionEndgameReason } {
    if (!isIndex(query.routeId, M8_ENDGAME_ROUTE_COUNT))
      return { ok: false, reason: "m8_faction_endgame_route_id_out_of_range" };
    if (
      !isScore(query.minSupportScore) ||
      !isScore(query.maxCostScore) ||
      !isScore(query.maxOppositionScore)
    ) {
      return { ok: false, reason: "m8_faction_endgame_score_invalid" };
    }
    if (!isMask(query.requiredExplanationMask, M8_ENDGAME_EXPLANATION_MASK_ALL))
      return { ok: false, reason: "m8_faction_endgame_mask_invalid" };
    return validateQueryShape(
      query.expectedOwnerVersion,
      query.candidateCap,
      query.scanCap,
      output,
    );
  }

  private writeArc(input: M8FactionArcInput, version: number): void {
    const id = input.arcId;
    this.arcActive[id] = 1;
    this.arcFactionIds[id] = input.factionId;
    this.arcStates[id] = M8_FACTION_ARC_STATE_SEEDED;
    this.arcResourceMasks[id] = input.resourceMask;
    this.arcConstraintMasks[id] = input.constraintMask;
    this.arcContradictionMasks[id] = input.contradictionMask;
    this.arcNegotiationMasks[id] = input.negotiationMask;
    this.arcFailureMasks[id] = input.failureMask;
    this.arcExplanationMasks[id] = input.explanationMask;
    this.arcFactionOwnerVersions[id] = input.factionOwnerVersion;
    this.arcGovernanceOwnerVersions[id] = input.governanceOwnerVersion;
    this.arcChronicleOwnerVersions[id] = input.chronicleOwnerVersion;
    this.arcObligationOwnerVersions[id] = input.obligationOwnerVersion;
    this.arcOrdinanceOwnerVersions[id] = input.ordinanceOwnerVersion;
    this.arcSourceEvents[id] = input.sourceEventId;
    this.arcSourceOwnerVersions[id] = input.sourceOwnerVersion;
    this.arcPriorities[id] = input.priority;
    this.arcStableSequences[id] = input.stableSequence;
    this.arcVersions[id] = version;
  }

  private writeRoute(pathId: number, input: M8EndgameRouteInput, version: number): void {
    this.routeActive[pathId] = 1;
    this.routeIds[pathId] = input.routeId;
    this.routeStates[pathId] = M8_ENDGAME_ROUTE_STATE_SEEDED;
    this.routeSupportScores[pathId] = input.supportScore;
    this.routeCostScores[pathId] = input.costScore;
    this.routeOppositionScores[pathId] = input.oppositionScore;
    this.routeExplanationMasks[pathId] = input.explanationMask;
    this.routeFactionSupportMasks[pathId] = input.factionSupportMask;
    this.routeFactionOppositionMasks[pathId] = input.factionOppositionMask;
    this.routeLampBoundaryScores[pathId] = input.lampBoundaryScore;
    this.routeChronicleScores[pathId] = input.chronicleScore;
    this.routeObligationPressures[pathId] = input.obligationPressure;
    this.routeOrdinanceLegitimacies[pathId] = input.ordinanceLegitimacy;
    this.routeSocialTrustScores[pathId] = input.socialTrustScore;
    this.routeProductionScores[pathId] = input.productionScore;
    this.routeFactionOwnerVersions[pathId] = input.factionOwnerVersion;
    this.routeGovernanceOwnerVersions[pathId] = input.governanceOwnerVersion;
    this.routeChronicleOwnerVersions[pathId] = input.chronicleOwnerVersion;
    this.routeObligationOwnerVersions[pathId] = input.obligationOwnerVersion;
    this.routeOrdinanceOwnerVersions[pathId] = input.ordinanceOwnerVersion;
    this.routeSourceEvents[pathId] = input.sourceEventId;
    this.routeSourceOwnerVersions[pathId] = input.sourceOwnerVersion;
    this.routePriorities[pathId] = input.priority;
    this.routeStableSequences[pathId] = input.stableSequence;
    this.routeVersions[pathId] = version;
  }

  private selectArcLane(query: M8FactionArcQuery, output: Uint32Array): LaneSelection {
    let current = this.arcHeadsByFaction[query.factionId] ?? -1;
    return selectLane(current, query.candidateCap, query.scanCap, output, (id) => {
      current = this.arcNext[id] ?? -1;
      return current;
    });
  }

  private selectRouteLane(
    query: M8EndgameRouteEvaluationQuery,
    output: Uint32Array,
  ): LaneSelection {
    let current = this.routeHeadsByRoute[query.routeId] ?? -1;
    return selectLane(current, query.candidateCap, query.scanCap, output, (id) => {
      current = this.routeNext[id] ?? -1;
      return current;
    });
  }

  private recordQueryMetrics(visited: number, selected: number, capHit: boolean): void {
    this.lastQueryVisitsValue = visited;
    this.totalQueryVisitsValue += visited;
    this.lastQuerySelectedValue = selected;
    if (capHit) this.queryCapHitCountValue += 1;
  }

  private linkArc(
    arcId: number,
    factionId: number,
    priority: number,
    stableSequence: number,
  ): void {
    let current = this.arcHeadsByFaction[factionId] ?? -1;
    let previous = -1;
    while (
      current >= 0 &&
      laneBefore(
        this.arcPriorities[current] ?? 0,
        this.arcStableSequences[current] ?? 0,
        current,
        priority,
        stableSequence,
        arcId,
      )
    ) {
      previous = current;
      current = this.arcNext[current] ?? -1;
    }
    this.arcPrevious[arcId] = previous;
    this.arcNext[arcId] = current;
    if (previous >= 0) this.arcNext[previous] = arcId;
    else this.arcHeadsByFaction[factionId] = arcId;
    if (current >= 0) this.arcPrevious[current] = arcId;
    this.indexedArcCountValue += 1;
  }

  private linkRoute(
    pathId: number,
    routeId: number,
    priority: number,
    stableSequence: number,
  ): void {
    let current = this.routeHeadsByRoute[routeId] ?? -1;
    let previous = -1;
    while (
      current >= 0 &&
      laneBefore(
        this.routePriorities[current] ?? 0,
        this.routeStableSequences[current] ?? 0,
        current,
        priority,
        stableSequence,
        pathId,
      )
    ) {
      previous = current;
      current = this.routeNext[current] ?? -1;
    }
    this.routePrevious[pathId] = previous;
    this.routeNext[pathId] = current;
    if (previous >= 0) this.routeNext[previous] = pathId;
    else this.routeHeadsByRoute[routeId] = pathId;
    if (current >= 0) this.routePrevious[current] = pathId;
    this.indexedRoutePathCountValue += 1;
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "m8_faction_endgame_owner_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "m8_faction_endgame_owner_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private changed(reason: M8FactionEndgameReason): M8FactionEndgameMutationResult {
    return { ok: true, changed: true, ownerVersion: this.ownerVersionValue, reason };
  }
}

export function createM8FactionEndgameStore(
  options: M8FactionEndgameStoreOptions,
): M8FactionEndgameStore {
  return new M8FactionEndgameStore(options);
}

interface LaneSelection {
  readonly selected: number;
  readonly visited: number;
  readonly firstSelected: number;
  readonly candidateCapHit: boolean;
  readonly scanCapHit: boolean;
  readonly capHit: boolean;
}

function selectLane(
  first: number,
  candidateCap: number,
  scanCap: number,
  output: Uint32Array,
  next: (id: number) => number,
): LaneSelection {
  let current = first;
  let visited = 0;
  let selected = 0;
  let firstSelected = M8_FACTION_ENDGAME_NONE;
  let candidateCapHit = false;
  let scanCapHit = false;
  while (current >= 0) {
    if (visited >= scanCap) {
      scanCapHit = true;
      break;
    }
    visited += 1;
    if (selected >= candidateCap) {
      candidateCapHit = true;
      break;
    }
    output[selected] = current;
    if (selected === 0) firstSelected = current;
    selected += 1;
    current = next(current);
  }
  return {
    selected,
    visited,
    firstSelected,
    candidateCapHit,
    scanCapHit,
    capHit: candidateCapHit || scanCapHit,
  };
}

function queryReason(selection: LaneSelection): M8FactionEndgameReason {
  if (selection.scanCapHit) return "m8_faction_endgame_query_scan_cap_reached";
  if (selection.candidateCapHit) return "m8_faction_endgame_query_cap_reached";
  return selection.selected === 0
    ? "m8_faction_endgame_query_no_candidate"
    : "m8_faction_endgame_query_indexed";
}

function reasonToRouteState(reason: M8FactionEndgameReason): number {
  if (reason === "m8_faction_endgame_route_available") return M8_ENDGAME_ROUTE_STATE_AVAILABLE;
  if (reason === "m8_faction_endgame_route_contested") return M8_ENDGAME_ROUTE_STATE_CONTESTED;
  return M8_ENDGAME_ROUTE_STATE_BLOCKED;
}

function validateVersions(input: {
  readonly factionOwnerVersion: number;
  readonly governanceOwnerVersion: number;
  readonly chronicleOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly ordinanceOwnerVersion: number;
  readonly sourceEventId: number;
  readonly sourceOwnerVersion: number;
  readonly priority: number;
  readonly stableSequence: number;
}): { readonly ok: true } | { readonly ok: false; readonly reason: M8FactionEndgameReason } {
  if (
    !isPositiveUint32(input.factionOwnerVersion) ||
    !isPositiveUint32(input.governanceOwnerVersion) ||
    !isPositiveUint32(input.chronicleOwnerVersion) ||
    !isPositiveUint32(input.obligationOwnerVersion) ||
    !isPositiveUint32(input.ordinanceOwnerVersion) ||
    !isPositiveUint32(input.sourceOwnerVersion)
  ) {
    return { ok: false, reason: "m8_faction_endgame_source_version_invalid" };
  }
  return isEntityId(input.sourceEventId) &&
    isScore(input.priority) &&
    isEntityId(input.stableSequence)
    ? { ok: true }
    : { ok: false, reason: "m8_faction_endgame_score_invalid" };
}

function validateQueryShape(
  expectedOwnerVersion: number,
  candidateCap: number,
  scanCap: number,
  output: Uint32Array,
): { readonly ok: true } | { readonly ok: false; readonly reason: M8FactionEndgameReason } {
  if (!isUint32(expectedOwnerVersion))
    return { ok: false, reason: "m8_faction_endgame_source_version_invalid" };
  if (!isPositive(candidateCap) || !isPositive(scanCap))
    return { ok: false, reason: "m8_faction_endgame_query_cap_invalid" };
  return output.length >= candidateCap
    ? { ok: true }
    : { ok: false, reason: "m8_faction_endgame_query_output_too_small" };
}

function laneBefore(
  currentPriority: number,
  currentSequence: number,
  currentId: number,
  nextPriority: number,
  nextSequence: number,
  nextId: number,
): boolean {
  if (currentPriority !== nextPriority) return currentPriority > nextPriority;
  if (currentSequence !== nextSequence) return currentSequence < nextSequence;
  return currentId < nextId;
}

function isArcTerminalState(value: number): boolean {
  return value === M8_FACTION_ARC_STATE_NEGOTIATED || value === M8_FACTION_ARC_STATE_FAILED;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isEntityId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < M8_FACTION_ENDGAME_NONE;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function isPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isScore(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}

function isMask(value: number, allowed: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= allowed;
}

function isOptionalMask(value: number, allowed: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= allowed;
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M8_FACTION_ENDGAME_NONE;
}

function requirePositive(value: number, label: string): number {
  if (!isPositive(value)) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M8_FACTION_ENDGAME_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}
