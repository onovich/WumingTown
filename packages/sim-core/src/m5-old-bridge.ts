import {
  M5_ANOMALY_ACTIVATION_POLICY_OLD_BRIDGE_GUEST_RECIPROCITY,
  M5_ANOMALY_DEF_OLD_BRIDGE_GUEST,
  M5_ANOMALY_ROSTER_SNAPSHOT_VERSION,
  M5_ANOMALY_RULE_COMPONENT_OLD_BRIDGE_GUEST,
  M5_ANOMALY_STATE_OWNER_OLD_BRIDGE_GUEST_CRISIS,
  type M5AnomalyDefinitionView,
} from "./m5-anomaly-roster-types";
import {
  M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
  M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY,
  M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS,
  M5_OLD_BRIDGE_EVIDENCE_NONE,
  M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD,
  M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY,
  M5_OLD_BRIDGE_MIN_RECIPROCITY_SCORE,
  M5_OLD_BRIDGE_MIN_REROUTE_SCORE,
  M5_OLD_BRIDGE_MIN_SETTLEMENT_SCORE,
  M5_OLD_BRIDGE_NONE,
  M5_OLD_BRIDGE_RESOLUTION_OBLIGATION_SETTLEMENT,
  M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY,
  M5_OLD_BRIDGE_RESOLUTION_REROUTE,
  M5_OLD_BRIDGE_STATE_ACTIVATED,
  M5_OLD_BRIDGE_STATE_EMPTY,
  M5_OLD_BRIDGE_STATE_ESCALATED,
  M5_OLD_BRIDGE_STATE_FAILED,
  M5_OLD_BRIDGE_STATE_RESOLVED,
  M5_OLD_BRIDGE_STATE_TRACE,
  M5_OLD_BRIDGE_TERMINAL_ABORTED,
  M5_OLD_BRIDGE_TERMINAL_NONE,
  M5_OLD_BRIDGE_TERMINAL_OBLIGATION_SETTLED,
  M5_OLD_BRIDGE_TERMINAL_PASSAGE_DENIED,
  M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
  M5_OLD_BRIDGE_TERMINAL_REROUTED,
  M5_OLD_BRIDGE_TRACE_ACTIVATION,
  M5_OLD_BRIDGE_TRACE_ESCALATION,
  M5_OLD_BRIDGE_TRACE_FAILURE,
  M5_OLD_BRIDGE_TRACE_LOW_RISK_EVIDENCE,
  M5_OLD_BRIDGE_TRACE_RESOLUTION,
  type M5OldBridgeActivateInput,
  type M5OldBridgeActivationBasis,
  type M5OldBridgeCandidateQuery,
  type M5OldBridgeCandidateQueryResult,
  type M5OldBridgeCandidateView,
  type M5OldBridgeCrisisView,
  type M5OldBridgeFailureInput,
  type M5OldBridgeMetrics,
  type M5OldBridgeMutationResult,
  type M5OldBridgeReason,
  type M5OldBridgeResolutionInput,
  type M5OldBridgeReviewView,
  type M5OldBridgeStoreOptions,
  type M5OldBridgeTerminalCleanupResult,
  type M5OldBridgeTraceInput,
  type M5OldBridgeTraceView,
} from "./m5-old-bridge-types";

export const M5_OLD_BRIDGE_EVIDENCE_MASK =
  (1 << M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER) |
  (1 << M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS) |
  (1 << M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY) |
  (1 << M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY) |
  (1 << M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD);

export const M5_OLD_BRIDGE_NON_COMBAT_MASK =
  (1 << M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY) |
  (1 << M5_OLD_BRIDGE_RESOLUTION_REROUTE) |
  (1 << M5_OLD_BRIDGE_RESOLUTION_OBLIGATION_SETTLEMENT);

export class M5OldBridgeGuestCrisisStore {
  readonly candidateCapacity: number;
  readonly crisisCapacity: number;
  readonly traceCapacity: number;
  readonly reviewCapacity: number;

  private readonly candidateActive: Uint8Array;
  private readonly candidateDefIndexes: Uint32Array;
  private readonly candidateRosterVersions: Uint32Array;
  private readonly candidateContentManifestHashes: string[];
  private readonly crossingActors: Uint32Array;
  private readonly guestActors: Uint32Array;
  private readonly bridgeIds: Uint32Array;
  private readonly routeIds: Uint32Array;
  private readonly bridgeWindowIds: Uint32Array;
  private readonly seasonWindowIds: Uint32Array;
  private readonly bridgeWindowActive: Uint8Array;
  private readonly routePassable: Uint8Array;
  private readonly routeBasisVersions: Uint32Array;
  private readonly routeDelayScores: Uint32Array;
  private readonly bridgeLedgerVersions: Uint32Array;
  private readonly bridgeLedgerEntryIds: Uint32Array;
  private readonly bridgeLedgerMismatch: Uint8Array;
  private readonly preparedItemStackIds: Uint32Array;
  private readonly preparedItemDefIds: Uint32Array;
  private readonly preparedItemQuantities: Uint32Array;
  private readonly preparedForActors: Uint32Array;
  private readonly preparedItemOwnerVersions: Uint32Array;
  private readonly logisticsIndexVersions: Uint32Array;
  private readonly chronicleCaseIds: Uint32Array;
  private readonly chronicleHypothesisIds: Uint32Array;
  private readonly chronicleEvidenceOwnerVersions: Uint32Array;
  private readonly obligationOwnerVersions: Uint32Array;
  private readonly obligationIds: Uint32Array;
  private readonly obligationPressures: Uint32Array;
  private readonly factionFactOwnerVersions: Uint32Array;
  private readonly factionPressures: Uint32Array;
  private readonly seasonOwnerVersions: Uint32Array;
  private readonly oldFamilyRecordVersions: Uint32Array;
  private readonly merchantTestimonyScores: Uint32Array;
  private readonly oldFamilyOralRecordScores: Uint32Array;
  private readonly preparedItemScores: Uint32Array;
  private readonly reciprocityDebtScores: Uint32Array;
  private readonly selfServingToll: Uint8Array;
  private readonly candidatePriorities: Uint32Array;
  private readonly candidateStableOwnerIds: Uint32Array;
  private readonly candidateStableSequences: Uint32Array;
  private readonly candidateVersions: Uint32Array;
  private readonly candidateNext: Int32Array;
  private readonly candidatePrevious: Int32Array;
  private candidateHead = -1;

  private readonly crisisRegistered: Uint8Array;
  private readonly crisisStates: Uint8Array;
  private readonly crisisCrossingActors: Uint32Array;
  private readonly crisisGuestActors: Uint32Array;
  private readonly crisisBridgeIds: Uint32Array;
  private readonly crisisRouteIds: Uint32Array;
  private readonly crisisBridgeWindowIds: Uint32Array;
  private readonly crisisSeasonWindowIds: Uint32Array;
  private readonly crisisRouteBasisVersions: Uint32Array;
  private readonly crisisPreparedItemOwnerVersions: Uint32Array;
  private readonly crisisLogisticsIndexVersions: Uint32Array;
  private readonly crisisChronicleVersions: Uint32Array;
  private readonly crisisObligationVersions: Uint32Array;
  private readonly crisisFactionVersions: Uint32Array;
  private readonly crisisSeasonVersions: Uint32Array;
  private readonly activationTicks: Uint32Array;
  private readonly traceTicks: Uint32Array;
  private readonly escalationTicks: Uint32Array;
  private readonly terminalTicks: Uint32Array;
  private readonly lowRiskEvidenceCounts: Uint16Array;
  private readonly escalationLevels: Uint8Array;
  private readonly resolutionMethods: Uint8Array;
  private readonly terminalReasons: Uint8Array;
  private readonly crisisDebtScores: Uint32Array;
  private readonly crisisRouteDelayScores: Uint32Array;
  private readonly crisisObligationPressures: Uint32Array;
  private readonly cleanupPending: Uint8Array;
  private readonly cleanupNext: Int32Array;
  private readonly cleanupPrevious: Int32Array;
  private readonly crisisVersions: Uint32Array;
  private cleanupHead = -1;
  private cleanupTail = -1;

  private readonly traceSequences: Uint32Array;
  private readonly traceCrisisIds: Uint32Array;
  private readonly traceEventKinds: Uint8Array;
  private readonly traceEvidenceKinds: Uint8Array;
  private readonly traceTickValues: Uint32Array;
  private readonly traceStates: Uint8Array;
  private readonly traceTerminalReasons: Uint8Array;
  private readonly traceOwnerVersions: Uint32Array;
  private readonly traceReasonCodes: Uint8Array;
  private traceCursor = 0;
  private traceStored = 0;
  private nextTraceSequence = 1;

  private readonly reviewSequences: Uint32Array;
  private readonly reviewCrisisIds: Uint32Array;
  private readonly reviewTicks: Uint32Array;
  private readonly reviewMethods: Uint8Array;
  private readonly reviewTerminalReasons: Uint8Array;
  private readonly reviewEvidenceCounts: Uint16Array;
  private readonly reviewDebtScores: Uint32Array;
  private readonly reviewRouteDelayScores: Uint32Array;
  private readonly reviewObligationPressures: Uint32Array;
  private readonly reviewRouteVersions: Uint32Array;
  private readonly reviewPreparedVersions: Uint32Array;
  private readonly reviewFactionVersions: Uint32Array;
  private readonly reviewOwnerVersions: Uint32Array;
  private readonly reviewReasonCodes: Uint8Array;
  private reviewCursor = 0;
  private reviewStored = 0;
  private nextReviewSequence = 1;

  private ownerVersionValue = 0;
  private activeCandidateCountValue = 0;
  private activeCrisisCountValue = 0;
  private resolvedCrisisCountValue = 0;
  private failedCrisisCountValue = 0;
  private lowRiskEvidenceTotal = 0;
  private terminalCleanupPendingCountValue = 0;
  private lastCandidateVisits = 0;
  private totalCandidateVisits = 0;
  private candidateCapHitCount = 0;
  private terminalCleanupCapHitCount = 0;
  private rosterVersionValue = 0;
  private contentManifestHashValue = "";

  constructor(options: M5OldBridgeStoreOptions) {
    this.candidateCapacity = requirePositive(options.candidateCapacity, "candidate capacity");
    this.crisisCapacity = requirePositive(options.crisisCapacity, "crisis capacity");
    this.traceCapacity = requirePositive(options.traceCapacity, "trace capacity");
    this.reviewCapacity = requirePositive(options.reviewCapacity, "review capacity");
    this.candidateActive = new Uint8Array(this.candidateCapacity);
    this.candidateDefIndexes = filledUint32(this.candidateCapacity);
    this.candidateRosterVersions = new Uint32Array(this.candidateCapacity);
    this.candidateContentManifestHashes = Array.from({ length: this.candidateCapacity }, () => "");
    this.crossingActors = filledUint32(this.candidateCapacity);
    this.guestActors = filledUint32(this.candidateCapacity);
    this.bridgeIds = filledUint32(this.candidateCapacity);
    this.routeIds = filledUint32(this.candidateCapacity);
    this.bridgeWindowIds = filledUint32(this.candidateCapacity);
    this.seasonWindowIds = filledUint32(this.candidateCapacity);
    this.bridgeWindowActive = new Uint8Array(this.candidateCapacity);
    this.routePassable = new Uint8Array(this.candidateCapacity);
    this.routeBasisVersions = new Uint32Array(this.candidateCapacity);
    this.routeDelayScores = new Uint32Array(this.candidateCapacity);
    this.bridgeLedgerVersions = new Uint32Array(this.candidateCapacity);
    this.bridgeLedgerEntryIds = filledUint32(this.candidateCapacity);
    this.bridgeLedgerMismatch = new Uint8Array(this.candidateCapacity);
    this.preparedItemStackIds = filledUint32(this.candidateCapacity);
    this.preparedItemDefIds = filledUint32(this.candidateCapacity);
    this.preparedItemQuantities = new Uint32Array(this.candidateCapacity);
    this.preparedForActors = filledUint32(this.candidateCapacity);
    this.preparedItemOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.logisticsIndexVersions = new Uint32Array(this.candidateCapacity);
    this.chronicleCaseIds = filledUint32(this.candidateCapacity);
    this.chronicleHypothesisIds = filledUint32(this.candidateCapacity);
    this.chronicleEvidenceOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.obligationOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.obligationIds = filledUint32(this.candidateCapacity);
    this.obligationPressures = new Uint32Array(this.candidateCapacity);
    this.factionFactOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.factionPressures = new Uint32Array(this.candidateCapacity);
    this.seasonOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.oldFamilyRecordVersions = new Uint32Array(this.candidateCapacity);
    this.merchantTestimonyScores = new Uint32Array(this.candidateCapacity);
    this.oldFamilyOralRecordScores = new Uint32Array(this.candidateCapacity);
    this.preparedItemScores = new Uint32Array(this.candidateCapacity);
    this.reciprocityDebtScores = new Uint32Array(this.candidateCapacity);
    this.selfServingToll = new Uint8Array(this.candidateCapacity);
    this.candidatePriorities = new Uint32Array(this.candidateCapacity);
    this.candidateStableOwnerIds = filledUint32(this.candidateCapacity);
    this.candidateStableSequences = filledUint32(this.candidateCapacity);
    this.candidateVersions = new Uint32Array(this.candidateCapacity);
    this.candidateNext = filledInt32(this.candidateCapacity);
    this.candidatePrevious = filledInt32(this.candidateCapacity);
    this.crisisRegistered = new Uint8Array(this.crisisCapacity);
    this.crisisStates = new Uint8Array(this.crisisCapacity);
    this.crisisCrossingActors = filledUint32(this.crisisCapacity);
    this.crisisGuestActors = filledUint32(this.crisisCapacity);
    this.crisisBridgeIds = filledUint32(this.crisisCapacity);
    this.crisisRouteIds = filledUint32(this.crisisCapacity);
    this.crisisBridgeWindowIds = filledUint32(this.crisisCapacity);
    this.crisisSeasonWindowIds = filledUint32(this.crisisCapacity);
    this.crisisRouteBasisVersions = new Uint32Array(this.crisisCapacity);
    this.crisisPreparedItemOwnerVersions = new Uint32Array(this.crisisCapacity);
    this.crisisLogisticsIndexVersions = new Uint32Array(this.crisisCapacity);
    this.crisisChronicleVersions = new Uint32Array(this.crisisCapacity);
    this.crisisObligationVersions = new Uint32Array(this.crisisCapacity);
    this.crisisFactionVersions = new Uint32Array(this.crisisCapacity);
    this.crisisSeasonVersions = new Uint32Array(this.crisisCapacity);
    this.activationTicks = filledUint32(this.crisisCapacity);
    this.traceTicks = filledUint32(this.crisisCapacity);
    this.escalationTicks = filledUint32(this.crisisCapacity);
    this.terminalTicks = filledUint32(this.crisisCapacity);
    this.lowRiskEvidenceCounts = new Uint16Array(this.crisisCapacity);
    this.escalationLevels = new Uint8Array(this.crisisCapacity);
    this.resolutionMethods = new Uint8Array(this.crisisCapacity);
    this.terminalReasons = new Uint8Array(this.crisisCapacity);
    this.crisisDebtScores = new Uint32Array(this.crisisCapacity);
    this.crisisRouteDelayScores = new Uint32Array(this.crisisCapacity);
    this.crisisObligationPressures = new Uint32Array(this.crisisCapacity);
    this.cleanupPending = new Uint8Array(this.crisisCapacity);
    this.cleanupNext = filledInt32(this.crisisCapacity);
    this.cleanupPrevious = filledInt32(this.crisisCapacity);
    this.crisisVersions = new Uint32Array(this.crisisCapacity);
    this.traceSequences = new Uint32Array(this.traceCapacity);
    this.traceCrisisIds = filledUint32(this.traceCapacity);
    this.traceEventKinds = new Uint8Array(this.traceCapacity);
    this.traceEvidenceKinds = new Uint8Array(this.traceCapacity);
    this.traceTickValues = filledUint32(this.traceCapacity);
    this.traceStates = new Uint8Array(this.traceCapacity);
    this.traceTerminalReasons = new Uint8Array(this.traceCapacity);
    this.traceOwnerVersions = new Uint32Array(this.traceCapacity);
    this.traceReasonCodes = new Uint8Array(this.traceCapacity);
    this.reviewSequences = new Uint32Array(this.reviewCapacity);
    this.reviewCrisisIds = filledUint32(this.reviewCapacity);
    this.reviewTicks = filledUint32(this.reviewCapacity);
    this.reviewMethods = new Uint8Array(this.reviewCapacity);
    this.reviewTerminalReasons = new Uint8Array(this.reviewCapacity);
    this.reviewEvidenceCounts = new Uint16Array(this.reviewCapacity);
    this.reviewDebtScores = new Uint32Array(this.reviewCapacity);
    this.reviewRouteDelayScores = new Uint32Array(this.reviewCapacity);
    this.reviewObligationPressures = new Uint32Array(this.reviewCapacity);
    this.reviewRouteVersions = new Uint32Array(this.reviewCapacity);
    this.reviewPreparedVersions = new Uint32Array(this.reviewCapacity);
    this.reviewFactionVersions = new Uint32Array(this.reviewCapacity);
    this.reviewOwnerVersions = new Uint32Array(this.reviewCapacity);
    this.reviewReasonCodes = new Uint8Array(this.reviewCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  registerActivationCandidate(
    input: M5OldBridgeActivationBasis,
    definition: M5AnomalyDefinitionView,
  ): M5OldBridgeMutationResult {
    const valid = this.validateCandidate(input, definition);
    if (!valid.ok) return valid;
    if (!this.matchesPinnedBasis(input.rosterVersion, input.contentManifestHash))
      return { ok: false, reason: "old_bridge_stale_content_basis" };
    if ((this.candidateActive[input.candidateId] ?? 0) === 1)
      return { ok: false, reason: "old_bridge_candidate_already_registered" };
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.writeCandidate(input, nextVersion.ownerVersion);
    this.linkCandidate(input.candidateId);
    this.activeCandidateCountValue += 1;
    this.rosterVersionValue = input.rosterVersion;
    this.contentManifestHashValue = input.contentManifestHash;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "old_bridge_activation_candidate_indexed",
    };
  }

  queryActivationCandidates(
    query: M5OldBridgeCandidateQuery,
    outputCandidateIds: Uint32Array,
  ): M5OldBridgeCandidateQueryResult {
    const valid = this.validateCandidateQuery(query, outputCandidateIds);
    if (!valid.ok) return valid;
    clearOutput(outputCandidateIds, query.selectedCap);
    let current = this.candidateHead;
    let visited = 0;
    let selected = 0;
    let candidateCapHit = false;
    let selectedCapHit = false;
    while (current >= 0) {
      if (visited >= query.candidateCap) {
        candidateCapHit = true;
        break;
      }
      visited += 1;
      if ((this.reciprocityDebtScores[current] ?? 0) >= query.minReciprocityDebtScore) {
        if (selected < query.selectedCap) {
          outputCandidateIds[selected] = current;
          selected += 1;
        } else {
          selectedCapHit = true;
        }
      }
      current = this.candidateNext[current] ?? -1;
    }
    this.lastCandidateVisits = visited;
    this.totalCandidateVisits += visited;
    if (candidateCapHit) this.candidateCapHitCount += 1;
    return {
      ok: true,
      selectedCount: selected,
      visitedCount: visited,
      candidateCapHit,
      selectedCapHit,
      ownerVersion: this.ownerVersionValue,
      reason: candidateReason(selected, candidateCapHit, selectedCapHit),
    };
  }

  activateCandidate(input: M5OldBridgeActivateInput): M5OldBridgeMutationResult {
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "old_bridge_candidate_id_out_of_range" };
    if (!isIndex(input.crisisId, this.crisisCapacity))
      return { ok: false, reason: "old_bridge_crisis_id_out_of_range" };
    if ((this.candidateActive[input.candidateId] ?? 0) === 0)
      return { ok: false, reason: "old_bridge_candidate_not_registered" };
    if ((this.crisisRegistered[input.crisisId] ?? 0) === 1)
      return { ok: false, reason: "old_bridge_crisis_already_registered" };
    if (!isUint32(input.tick)) return { ok: false, reason: "old_bridge_value_out_of_range" };
    const prevention = this.readActivationPrevention(input.candidateId);
    if (prevention !== undefined) return { ok: false, reason: prevention };
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.writeActivatedCrisis(input, nextVersion.ownerVersion);
    this.unlinkCandidate(input.candidateId);
    this.activeCandidateCountValue -= 1;
    this.activeCrisisCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      input.crisisId,
      M5_OLD_BRIDGE_TRACE_ACTIVATION,
      M5_OLD_BRIDGE_EVIDENCE_NONE,
      input.tick,
      "old_bridge_activated",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "old_bridge_activated",
    };
  }

  recordLowRiskEvidence(input: M5OldBridgeTraceInput): M5OldBridgeMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if (!isEvidenceKind(input.evidenceKind))
      return { ok: false, reason: "old_bridge_value_out_of_range" };
    const state = this.crisisStates[input.crisisId] ?? M5_OLD_BRIDGE_STATE_EMPTY;
    if (state !== M5_OLD_BRIDGE_STATE_ACTIVATED && state !== M5_OLD_BRIDGE_STATE_TRACE)
      return { ok: false, reason: "old_bridge_terminal_state" };
    if ((this.lowRiskEvidenceCounts[input.crisisId] ?? 0) >= 0xffff)
      return { ok: false, reason: "old_bridge_low_risk_evidence_cap_reached" };
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.crisisStates[input.crisisId] = M5_OLD_BRIDGE_STATE_TRACE;
    this.traceTicks[input.crisisId] = input.tick;
    this.lowRiskEvidenceCounts[input.crisisId] =
      (this.lowRiskEvidenceCounts[input.crisisId] ?? 0) + 1;
    this.lowRiskEvidenceTotal += 1;
    this.crisisVersions[input.crisisId] = nextVersion.ownerVersion;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      input.crisisId,
      M5_OLD_BRIDGE_TRACE_LOW_RISK_EVIDENCE,
      input.evidenceKind,
      input.tick,
      "old_bridge_low_risk_evidence_recorded",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "old_bridge_low_risk_evidence_recorded",
    };
  }

  escalateCrisis(crisisId: number, tick: number): M5OldBridgeMutationResult {
    const valid = this.validateOpenCrisis(crisisId, tick);
    if (!valid.ok) return valid;
    if ((this.lowRiskEvidenceCounts[crisisId] ?? 0) === 0)
      return { ok: false, reason: "old_bridge_escalation_requires_evidence" };
    if ((this.crisisStates[crisisId] ?? 0) !== M5_OLD_BRIDGE_STATE_TRACE)
      return { ok: false, reason: "old_bridge_terminal_state" };
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.crisisStates[crisisId] = M5_OLD_BRIDGE_STATE_ESCALATED;
    this.escalationTicks[crisisId] = tick;
    this.escalationLevels[crisisId] = (this.escalationLevels[crisisId] ?? 0) + 1;
    this.crisisVersions[crisisId] = nextVersion.ownerVersion;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      crisisId,
      M5_OLD_BRIDGE_TRACE_ESCALATION,
      M5_OLD_BRIDGE_EVIDENCE_NONE,
      tick,
      "old_bridge_escalated",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "old_bridge_escalated",
    };
  }

  resolveCrisis(input: M5OldBridgeResolutionInput): M5OldBridgeMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if ((this.crisisStates[input.crisisId] ?? 0) !== M5_OLD_BRIDGE_STATE_ESCALATED)
      return { ok: false, reason: "old_bridge_resolution_requirements_unmet" };
    if (!validResolutionInput(input)) return { ok: false, reason: "old_bridge_value_out_of_range" };
    const reason = resolutionReason(input);
    if (reason === undefined)
      return { ok: false, reason: "old_bridge_resolution_requirements_unmet" };
    return this.finishCrisis(
      input.crisisId,
      input.tick,
      input.method,
      reason.terminal,
      reason.reason,
    );
  }

  failCrisis(input: M5OldBridgeFailureInput): M5OldBridgeMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if (
      input.terminalReason !== M5_OLD_BRIDGE_TERMINAL_PASSAGE_DENIED &&
      input.terminalReason !== M5_OLD_BRIDGE_TERMINAL_ABORTED
    )
      return { ok: false, reason: "old_bridge_value_out_of_range" };
    if (
      input.terminalReason === M5_OLD_BRIDGE_TERMINAL_PASSAGE_DENIED &&
      (this.crisisStates[input.crisisId] ?? 0) !== M5_OLD_BRIDGE_STATE_ESCALATED
    )
      return { ok: false, reason: "old_bridge_escalation_requires_evidence" };
    return this.finishCrisis(
      input.crisisId,
      input.tick,
      0,
      input.terminalReason,
      "old_bridge_failed",
    );
  }

  drainTerminalCleanup(
    cleanupCap: number,
    outputCrisisIds: Uint32Array,
  ): M5OldBridgeTerminalCleanupResult | { readonly ok: false; readonly reason: M5OldBridgeReason } {
    if (!isPositive(cleanupCap)) return { ok: false, reason: "old_bridge_cleanup_cap_invalid" };
    if (outputCrisisIds.length < cleanupCap)
      return { ok: false, reason: "old_bridge_cleanup_output_too_small" };
    let current = this.cleanupHead;
    let selected = 0;
    let visited = 0;
    while (current >= 0 && selected < cleanupCap) {
      selected += 1;
      visited += 1;
      current = this.cleanupNext[current] ?? -1;
    }
    const cleanupCapHit = current >= 0;
    if (selected > 0) {
      const nextVersion = this.nextVersion();
      if (!nextVersion.ok) return nextVersion;
      clearOutput(outputCrisisIds, cleanupCap);
      current = this.cleanupHead;
      let outputIndex = 0;
      while (current >= 0 && outputIndex < selected) {
        const next = this.cleanupNext[current] ?? -1;
        outputCrisisIds[outputIndex] = current;
        this.unlinkTerminalCleanup(current);
        outputIndex += 1;
        current = next;
      }
      if (cleanupCapHit) this.terminalCleanupCapHitCount += 1;
      this.ownerVersionValue = nextVersion.ownerVersion;
    } else {
      clearOutput(outputCrisisIds, cleanupCap);
    }
    return {
      ok: true,
      selectedCount: selected,
      visitedCount: visited,
      cleanupCapHit,
      ownerVersion: this.ownerVersionValue,
      reason:
        selected === 0
          ? "old_bridge_terminal_cleanup_no_candidate"
          : cleanupCapHit
            ? "old_bridge_terminal_cleanup_cap_reached"
            : "old_bridge_terminal_cleanup_drained",
    };
  }

  readCandidate(candidateId: number): M5OldBridgeCandidateView | undefined {
    if (
      !isIndex(candidateId, this.candidateCapacity) ||
      (this.candidateActive[candidateId] ?? 0) === 0
    )
      return undefined;
    return this.createCandidateView(candidateId);
  }

  readCrisis(crisisId: number): M5OldBridgeCrisisView | undefined {
    if (!isIndex(crisisId, this.crisisCapacity) || (this.crisisRegistered[crisisId] ?? 0) === 0)
      return undefined;
    return {
      crisisId,
      state: this.crisisStates[crisisId] ?? 0,
      crossingActorId: this.crisisCrossingActors[crisisId] ?? M5_OLD_BRIDGE_NONE,
      guestActorId: this.crisisGuestActors[crisisId] ?? M5_OLD_BRIDGE_NONE,
      bridgeId: this.crisisBridgeIds[crisisId] ?? M5_OLD_BRIDGE_NONE,
      routeId: this.crisisRouteIds[crisisId] ?? M5_OLD_BRIDGE_NONE,
      bridgeWindowId: this.crisisBridgeWindowIds[crisisId] ?? M5_OLD_BRIDGE_NONE,
      seasonWindowId: this.crisisSeasonWindowIds[crisisId] ?? M5_OLD_BRIDGE_NONE,
      routeBasisVersion: this.crisisRouteBasisVersions[crisisId] ?? 0,
      preparedItemOwnerVersion: this.crisisPreparedItemOwnerVersions[crisisId] ?? 0,
      logisticsIndexVersion: this.crisisLogisticsIndexVersions[crisisId] ?? 0,
      chronicleEvidenceOwnerVersion: this.crisisChronicleVersions[crisisId] ?? 0,
      obligationOwnerVersion: this.crisisObligationVersions[crisisId] ?? 0,
      factionFactOwnerVersion: this.crisisFactionVersions[crisisId] ?? 0,
      seasonOwnerVersion: this.crisisSeasonVersions[crisisId] ?? 0,
      activationTick: this.activationTicks[crisisId] ?? M5_OLD_BRIDGE_NONE,
      traceTick: this.traceTicks[crisisId] ?? M5_OLD_BRIDGE_NONE,
      escalationTick: this.escalationTicks[crisisId] ?? M5_OLD_BRIDGE_NONE,
      terminalTick: this.terminalTicks[crisisId] ?? M5_OLD_BRIDGE_NONE,
      lowRiskEvidenceCount: this.lowRiskEvidenceCounts[crisisId] ?? 0,
      escalationLevel: this.escalationLevels[crisisId] ?? 0,
      resolutionMethod: this.resolutionMethods[crisisId] ?? 0,
      terminalReason: this.terminalReasons[crisisId] ?? 0,
      reciprocityDebtScore: this.crisisDebtScores[crisisId] ?? 0,
      routeDelayScore: this.crisisRouteDelayScores[crisisId] ?? 0,
      obligationPressure: this.crisisObligationPressures[crisisId] ?? 0,
      cleanupPending: this.cleanupPending[crisisId] ?? 0,
      crisisVersion: this.crisisVersions[crisisId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readTrace(ageFromNewest: number): M5OldBridgeTraceView | undefined {
    if (!isIndex(ageFromNewest, this.traceStored)) return undefined;
    const slot = (this.traceCursor + this.traceCapacity - 1 - ageFromNewest) % this.traceCapacity;
    return {
      sequence: this.traceSequences[slot] ?? 0,
      crisisId: this.traceCrisisIds[slot] ?? M5_OLD_BRIDGE_NONE,
      eventKind: this.traceEventKinds[slot] ?? 0,
      evidenceKind: this.traceEvidenceKinds[slot] ?? 0,
      tick: this.traceTickValues[slot] ?? M5_OLD_BRIDGE_NONE,
      crisisState: this.traceStates[slot] ?? 0,
      terminalReason: this.traceTerminalReasons[slot] ?? 0,
      ownerVersion: this.traceOwnerVersions[slot] ?? 0,
      reason: decodeReason(this.traceReasonCodes[slot] ?? 0),
    };
  }

  readReview(ageFromNewest: number): M5OldBridgeReviewView | undefined {
    if (!isIndex(ageFromNewest, this.reviewStored)) return undefined;
    const slot =
      (this.reviewCursor + this.reviewCapacity - 1 - ageFromNewest) % this.reviewCapacity;
    return {
      sequence: this.reviewSequences[slot] ?? 0,
      crisisId: this.reviewCrisisIds[slot] ?? M5_OLD_BRIDGE_NONE,
      tick: this.reviewTicks[slot] ?? M5_OLD_BRIDGE_NONE,
      resolutionMethod: this.reviewMethods[slot] ?? 0,
      terminalReason: this.reviewTerminalReasons[slot] ?? 0,
      lowRiskEvidenceCount: this.reviewEvidenceCounts[slot] ?? 0,
      reciprocityDebtScore: this.reviewDebtScores[slot] ?? 0,
      routeDelayScore: this.reviewRouteDelayScores[slot] ?? 0,
      obligationPressure: this.reviewObligationPressures[slot] ?? 0,
      routeBasisVersion: this.reviewRouteVersions[slot] ?? 0,
      preparedItemOwnerVersion: this.reviewPreparedVersions[slot] ?? 0,
      factionFactOwnerVersion: this.reviewFactionVersions[slot] ?? 0,
      ownerVersion: this.reviewOwnerVersions[slot] ?? 0,
      reason: decodeReason(this.reviewReasonCodes[slot] ?? 0),
    };
  }

  createMetrics(): M5OldBridgeMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeCandidateCount: this.activeCandidateCountValue,
      activeCrisisCount: this.activeCrisisCountValue,
      resolvedCrisisCount: this.resolvedCrisisCountValue,
      failedCrisisCount: this.failedCrisisCountValue,
      lowRiskEvidenceCount: this.lowRiskEvidenceTotal,
      terminalCleanupPendingCount: this.terminalCleanupPendingCountValue,
      lastCandidateVisits: this.lastCandidateVisits,
      totalCandidateVisits: this.totalCandidateVisits,
      candidateCapHitCount: this.candidateCapHitCount,
      terminalCleanupCapHitCount: this.terminalCleanupCapHitCount,
      traceStoredCount: this.traceStored,
      reviewStoredCount: this.reviewStored,
    };
  }

  private finishCrisis(
    crisisId: number,
    tick: number,
    method: number,
    terminal: number,
    reason: M5OldBridgeReason,
  ): M5OldBridgeMutationResult {
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    const resolved =
      terminal === M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED ||
      terminal === M5_OLD_BRIDGE_TERMINAL_REROUTED ||
      terminal === M5_OLD_BRIDGE_TERMINAL_OBLIGATION_SETTLED;
    this.crisisStates[crisisId] = resolved
      ? M5_OLD_BRIDGE_STATE_RESOLVED
      : M5_OLD_BRIDGE_STATE_FAILED;
    this.terminalTicks[crisisId] = tick;
    this.resolutionMethods[crisisId] = method;
    this.terminalReasons[crisisId] = terminal;
    this.crisisVersions[crisisId] = nextVersion.ownerVersion;
    this.activeCrisisCountValue -= 1;
    if (resolved) this.resolvedCrisisCountValue += 1;
    else this.failedCrisisCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.linkTerminalCleanup(crisisId);
    this.recordTrace(
      crisisId,
      resolved ? M5_OLD_BRIDGE_TRACE_RESOLUTION : M5_OLD_BRIDGE_TRACE_FAILURE,
      M5_OLD_BRIDGE_EVIDENCE_NONE,
      tick,
      reason,
    );
    this.recordReview(crisisId, tick, method, terminal, reason);
    return { ok: true, changed: true, ownerVersion: this.ownerVersionValue, reason };
  }

  private validateCandidate(
    input: M5OldBridgeActivationBasis,
    definition: M5AnomalyDefinitionView,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5OldBridgeReason } {
    if (!validOldBridgeDefinition(definition))
      return { ok: false, reason: "old_bridge_definition_invalid" };
    if (
      input.defIndex !== definition.defIndex ||
      input.rosterVersion !== definition.rosterVersion ||
      input.contentManifestHash !== definition.contentManifestHash
    )
      return { ok: false, reason: "old_bridge_stale_content_basis" };
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "old_bridge_candidate_id_out_of_range" };
    if (!validBasisVersions(input))
      return { ok: false, reason: "old_bridge_basis_version_invalid" };
    return validCandidateNumbers(input)
      ? { ok: true }
      : { ok: false, reason: "old_bridge_value_out_of_range" };
  }

  private validateCandidateQuery(
    query: M5OldBridgeCandidateQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5OldBridgeReason } {
    if (
      query.rosterVersion !== this.rosterVersionValue ||
      query.contentManifestHash !== this.contentManifestHashValue
    )
      return { ok: false, reason: "old_bridge_stale_content_basis" };
    if (!isPositive(query.candidateCap))
      return { ok: false, reason: "old_bridge_candidate_cap_invalid" };
    if (!isPositive(query.selectedCap))
      return { ok: false, reason: "old_bridge_selected_cap_invalid" };
    if (output.length < query.selectedCap)
      return { ok: false, reason: "old_bridge_output_too_small" };
    return isScore(query.minReciprocityDebtScore)
      ? { ok: true }
      : { ok: false, reason: "old_bridge_value_out_of_range" };
  }

  private validateOpenCrisis(
    crisisId: number,
    tick: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5OldBridgeReason } {
    if (!isIndex(crisisId, this.crisisCapacity))
      return { ok: false, reason: "old_bridge_crisis_id_out_of_range" };
    if ((this.crisisRegistered[crisisId] ?? 0) === 0)
      return { ok: false, reason: "old_bridge_crisis_not_registered" };
    if (!isUint32(tick)) return { ok: false, reason: "old_bridge_value_out_of_range" };
    const state = this.crisisStates[crisisId] ?? 0;
    return state === M5_OLD_BRIDGE_STATE_RESOLVED || state === M5_OLD_BRIDGE_STATE_FAILED
      ? { ok: false, reason: "old_bridge_terminal_state" }
      : { ok: true };
  }

  private matchesPinnedBasis(rosterVersion: number, contentManifestHash: string): boolean {
    return (
      this.ownerVersionValue === 0 ||
      (rosterVersion === this.rosterVersionValue &&
        contentManifestHash === this.contentManifestHashValue)
    );
  }

  private readActivationPrevention(candidateId: number): M5OldBridgeReason | undefined {
    if ((this.bridgeWindowActive[candidateId] ?? 0) === 0)
      return "old_bridge_activation_prevented_outside_bridge_window";
    if ((this.routePassable[candidateId] ?? 0) === 0)
      return "old_bridge_activation_prevented_route_basis";
    return this.hasSafePreparedItem(candidateId)
      ? "old_bridge_activation_prevented_safe_prepared_item"
      : undefined;
  }

  private hasSafePreparedItem(candidateId: number): boolean {
    return (
      (this.preparedItemQuantities[candidateId] ?? 0) > 0 &&
      (this.preparedItemStackIds[candidateId] ?? M5_OLD_BRIDGE_NONE) !== M5_OLD_BRIDGE_NONE &&
      (this.preparedForActors[candidateId] ?? M5_OLD_BRIDGE_NONE) !==
        (this.crossingActors[candidateId] ?? M5_OLD_BRIDGE_NONE) &&
      (this.selfServingToll[candidateId] ?? 0) === 0 &&
      (this.preparedItemScores[candidateId] ?? 0) >= M5_OLD_BRIDGE_MIN_RECIPROCITY_SCORE
    );
  }

  private writeCandidate(input: M5OldBridgeActivationBasis, version: number): void {
    const id = input.candidateId;
    this.candidateActive[id] = 1;
    this.candidateDefIndexes[id] = input.defIndex;
    this.candidateRosterVersions[id] = input.rosterVersion;
    this.candidateContentManifestHashes[id] = input.contentManifestHash;
    this.crossingActors[id] = input.crossingActorId;
    this.guestActors[id] = input.guestActorId;
    this.bridgeIds[id] = input.bridgeId;
    this.routeIds[id] = input.routeId;
    this.bridgeWindowIds[id] = input.bridgeWindowId;
    this.seasonWindowIds[id] = input.seasonWindowId;
    this.bridgeWindowActive[id] = input.bridgeWindowActive;
    this.routePassable[id] = input.routePassable;
    this.routeBasisVersions[id] = input.routeBasisVersion;
    this.routeDelayScores[id] = input.routeDelayScore;
    this.bridgeLedgerVersions[id] = input.bridgeLedgerVersion;
    this.bridgeLedgerEntryIds[id] = input.bridgeLedgerEntryId;
    this.bridgeLedgerMismatch[id] = input.bridgeLedgerMismatch;
    this.preparedItemStackIds[id] = input.preparedItemStackId;
    this.preparedItemDefIds[id] = input.preparedItemDefId;
    this.preparedItemQuantities[id] = input.preparedItemQuantity;
    this.preparedForActors[id] = input.preparedForActorId;
    this.preparedItemOwnerVersions[id] = input.preparedItemOwnerVersion;
    this.logisticsIndexVersions[id] = input.logisticsIndexVersion;
    this.chronicleCaseIds[id] = input.chronicleCaseId;
    this.chronicleHypothesisIds[id] = input.chronicleHypothesisId;
    this.chronicleEvidenceOwnerVersions[id] = input.chronicleEvidenceOwnerVersion;
    this.obligationOwnerVersions[id] = input.obligationOwnerVersion;
    this.obligationIds[id] = input.obligationId;
    this.obligationPressures[id] = input.obligationPressure;
    this.factionFactOwnerVersions[id] = input.factionFactOwnerVersion;
    this.factionPressures[id] = input.factionPressure;
    this.seasonOwnerVersions[id] = input.seasonOwnerVersion;
    this.oldFamilyRecordVersions[id] = input.oldFamilyRecordVersion;
    this.merchantTestimonyScores[id] = input.merchantTestimonyScore;
    this.oldFamilyOralRecordScores[id] = input.oldFamilyOralRecordScore;
    this.preparedItemScores[id] = input.preparedItemScore;
    this.reciprocityDebtScores[id] = input.reciprocityDebtScore;
    this.selfServingToll[id] = input.selfServingToll;
    this.candidatePriorities[id] = input.priority;
    this.candidateStableOwnerIds[id] = input.stableOwnerId;
    this.candidateStableSequences[id] = input.stableSequence;
    this.candidateVersions[id] = version;
  }

  private createCandidateView(candidateId: number): M5OldBridgeCandidateView {
    return {
      candidateId,
      defIndex: this.candidateDefIndexes[candidateId] ?? M5_OLD_BRIDGE_NONE,
      rosterVersion: this.candidateRosterVersions[candidateId] ?? 0,
      contentManifestHash: this.candidateContentManifestHashes[candidateId] ?? "",
      crossingActorId: this.crossingActors[candidateId] ?? M5_OLD_BRIDGE_NONE,
      guestActorId: this.guestActors[candidateId] ?? M5_OLD_BRIDGE_NONE,
      bridgeId: this.bridgeIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      routeId: this.routeIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      bridgeWindowId: this.bridgeWindowIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      seasonWindowId: this.seasonWindowIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      bridgeWindowActive: this.bridgeWindowActive[candidateId] ?? 0,
      routePassable: this.routePassable[candidateId] ?? 0,
      routeBasisVersion: this.routeBasisVersions[candidateId] ?? 0,
      routeDelayScore: this.routeDelayScores[candidateId] ?? 0,
      bridgeLedgerVersion: this.bridgeLedgerVersions[candidateId] ?? 0,
      bridgeLedgerEntryId: this.bridgeLedgerEntryIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      bridgeLedgerMismatch: this.bridgeLedgerMismatch[candidateId] ?? 0,
      preparedItemStackId: this.preparedItemStackIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      preparedItemDefId: this.preparedItemDefIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      preparedItemQuantity: this.preparedItemQuantities[candidateId] ?? 0,
      preparedForActorId: this.preparedForActors[candidateId] ?? M5_OLD_BRIDGE_NONE,
      preparedItemOwnerVersion: this.preparedItemOwnerVersions[candidateId] ?? 0,
      logisticsIndexVersion: this.logisticsIndexVersions[candidateId] ?? 0,
      chronicleCaseId: this.chronicleCaseIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      chronicleHypothesisId: this.chronicleHypothesisIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      chronicleEvidenceOwnerVersion: this.chronicleEvidenceOwnerVersions[candidateId] ?? 0,
      obligationOwnerVersion: this.obligationOwnerVersions[candidateId] ?? 0,
      obligationId: this.obligationIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      obligationPressure: this.obligationPressures[candidateId] ?? 0,
      factionFactOwnerVersion: this.factionFactOwnerVersions[candidateId] ?? 0,
      factionPressure: this.factionPressures[candidateId] ?? 0,
      seasonOwnerVersion: this.seasonOwnerVersions[candidateId] ?? 0,
      oldFamilyRecordVersion: this.oldFamilyRecordVersions[candidateId] ?? 0,
      merchantTestimonyScore: this.merchantTestimonyScores[candidateId] ?? 0,
      oldFamilyOralRecordScore: this.oldFamilyOralRecordScores[candidateId] ?? 0,
      preparedItemScore: this.preparedItemScores[candidateId] ?? 0,
      reciprocityDebtScore: this.reciprocityDebtScores[candidateId] ?? 0,
      selfServingToll: this.selfServingToll[candidateId] ?? 0,
      priority: this.candidatePriorities[candidateId] ?? 0,
      stableOwnerId: this.candidateStableOwnerIds[candidateId] ?? M5_OLD_BRIDGE_NONE,
      stableSequence: this.candidateStableSequences[candidateId] ?? M5_OLD_BRIDGE_NONE,
      candidateVersion: this.candidateVersions[candidateId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  private writeActivatedCrisis(input: M5OldBridgeActivateInput, version: number): void {
    const candidateId = input.candidateId;
    const crisisId = input.crisisId;
    this.crisisRegistered[crisisId] = 1;
    this.crisisStates[crisisId] = M5_OLD_BRIDGE_STATE_ACTIVATED;
    this.crisisCrossingActors[crisisId] = this.crossingActors[candidateId] ?? M5_OLD_BRIDGE_NONE;
    this.crisisGuestActors[crisisId] = this.guestActors[candidateId] ?? M5_OLD_BRIDGE_NONE;
    this.crisisBridgeIds[crisisId] = this.bridgeIds[candidateId] ?? M5_OLD_BRIDGE_NONE;
    this.crisisRouteIds[crisisId] = this.routeIds[candidateId] ?? M5_OLD_BRIDGE_NONE;
    this.crisisBridgeWindowIds[crisisId] = this.bridgeWindowIds[candidateId] ?? M5_OLD_BRIDGE_NONE;
    this.crisisSeasonWindowIds[crisisId] = this.seasonWindowIds[candidateId] ?? M5_OLD_BRIDGE_NONE;
    this.crisisRouteBasisVersions[crisisId] = this.routeBasisVersions[candidateId] ?? 0;
    this.crisisPreparedItemOwnerVersions[crisisId] =
      this.preparedItemOwnerVersions[candidateId] ?? 0;
    this.crisisLogisticsIndexVersions[crisisId] = this.logisticsIndexVersions[candidateId] ?? 0;
    this.crisisChronicleVersions[crisisId] = this.chronicleEvidenceOwnerVersions[candidateId] ?? 0;
    this.crisisObligationVersions[crisisId] = this.obligationOwnerVersions[candidateId] ?? 0;
    this.crisisFactionVersions[crisisId] = this.factionFactOwnerVersions[candidateId] ?? 0;
    this.crisisSeasonVersions[crisisId] = this.seasonOwnerVersions[candidateId] ?? 0;
    this.crisisDebtScores[crisisId] = this.reciprocityDebtScores[candidateId] ?? 0;
    this.crisisRouteDelayScores[crisisId] = this.routeDelayScores[candidateId] ?? 0;
    this.crisisObligationPressures[crisisId] = this.obligationPressures[candidateId] ?? 0;
    this.activationTicks[crisisId] = input.tick;
    this.terminalReasons[crisisId] = M5_OLD_BRIDGE_TERMINAL_NONE;
    this.crisisVersions[crisisId] = version;
  }

  private linkCandidate(candidateId: number): void {
    let current = this.candidateHead;
    let previous = -1;
    while (current >= 0 && this.isCandidateBefore(current, candidateId)) {
      previous = current;
      current = this.candidateNext[current] ?? -1;
    }
    this.candidatePrevious[candidateId] = previous;
    this.candidateNext[candidateId] = current;
    if (previous >= 0) this.candidateNext[previous] = candidateId;
    else this.candidateHead = candidateId;
    if (current >= 0) this.candidatePrevious[current] = candidateId;
  }

  private unlinkCandidate(candidateId: number): void {
    const previous = this.candidatePrevious[candidateId] ?? -1;
    const next = this.candidateNext[candidateId] ?? -1;
    if (previous >= 0) this.candidateNext[previous] = next;
    else this.candidateHead = next;
    if (next >= 0) this.candidatePrevious[next] = previous;
    this.candidatePrevious[candidateId] = -1;
    this.candidateNext[candidateId] = -1;
    this.candidateActive[candidateId] = 0;
  }

  private linkTerminalCleanup(crisisId: number): void {
    if ((this.cleanupPending[crisisId] ?? 0) === 1) return;
    this.cleanupPending[crisisId] = 1;
    this.cleanupPrevious[crisisId] = this.cleanupTail;
    this.cleanupNext[crisisId] = -1;
    if (this.cleanupTail >= 0) this.cleanupNext[this.cleanupTail] = crisisId;
    else this.cleanupHead = crisisId;
    this.cleanupTail = crisisId;
    this.terminalCleanupPendingCountValue += 1;
  }

  private unlinkTerminalCleanup(crisisId: number): void {
    const previous = this.cleanupPrevious[crisisId] ?? -1;
    const next = this.cleanupNext[crisisId] ?? -1;
    if (previous >= 0) this.cleanupNext[previous] = next;
    else this.cleanupHead = next;
    if (next >= 0) this.cleanupPrevious[next] = previous;
    else this.cleanupTail = previous;
    this.cleanupPrevious[crisisId] = -1;
    this.cleanupNext[crisisId] = -1;
    this.cleanupPending[crisisId] = 0;
    this.terminalCleanupPendingCountValue -= 1;
  }

  private recordTrace(
    crisisId: number,
    eventKind: number,
    evidenceKind: number,
    tick: number,
    reason: M5OldBridgeReason,
  ): void {
    const slot = this.traceCursor;
    this.traceSequences[slot] = this.nextTraceSequence;
    this.traceCrisisIds[slot] = crisisId;
    this.traceEventKinds[slot] = eventKind;
    this.traceEvidenceKinds[slot] = evidenceKind;
    this.traceTickValues[slot] = tick;
    this.traceStates[slot] = this.crisisStates[crisisId] ?? 0;
    this.traceTerminalReasons[slot] = this.terminalReasons[crisisId] ?? 0;
    this.traceOwnerVersions[slot] = this.ownerVersionValue;
    this.traceReasonCodes[slot] = encodeReason(reason);
    this.traceCursor = (this.traceCursor + 1) % this.traceCapacity;
    this.traceStored = Math.min(this.traceCapacity, this.traceStored + 1);
    this.nextTraceSequence += 1;
  }

  private recordReview(
    crisisId: number,
    tick: number,
    method: number,
    terminal: number,
    reason: M5OldBridgeReason,
  ): void {
    const slot = this.reviewCursor;
    this.reviewSequences[slot] = this.nextReviewSequence;
    this.reviewCrisisIds[slot] = crisisId;
    this.reviewTicks[slot] = tick;
    this.reviewMethods[slot] = method;
    this.reviewTerminalReasons[slot] = terminal;
    this.reviewEvidenceCounts[slot] = this.lowRiskEvidenceCounts[crisisId] ?? 0;
    this.reviewDebtScores[slot] = this.crisisDebtScores[crisisId] ?? 0;
    this.reviewRouteDelayScores[slot] = this.crisisRouteDelayScores[crisisId] ?? 0;
    this.reviewObligationPressures[slot] = this.crisisObligationPressures[crisisId] ?? 0;
    this.reviewRouteVersions[slot] = this.crisisRouteBasisVersions[crisisId] ?? 0;
    this.reviewPreparedVersions[slot] = this.crisisPreparedItemOwnerVersions[crisisId] ?? 0;
    this.reviewFactionVersions[slot] = this.crisisFactionVersions[crisisId] ?? 0;
    this.reviewOwnerVersions[slot] = this.ownerVersionValue;
    this.reviewReasonCodes[slot] = encodeReason(reason);
    this.reviewCursor = (this.reviewCursor + 1) % this.reviewCapacity;
    this.reviewStored = Math.min(this.reviewCapacity, this.reviewStored + 1);
    this.nextReviewSequence += 1;
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "old_bridge_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "old_bridge_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private isCandidateBefore(current: number, next: number): boolean {
    const currentScore = this.reciprocityDebtScores[current] ?? 0;
    const nextScore = this.reciprocityDebtScores[next] ?? 0;
    if (currentScore !== nextScore) return currentScore > nextScore;
    const currentPriority = this.candidatePriorities[current] ?? 0;
    const nextPriority = this.candidatePriorities[next] ?? 0;
    if (currentPriority !== nextPriority) return currentPriority > nextPriority;
    const currentOwner = this.candidateStableOwnerIds[current] ?? M5_OLD_BRIDGE_NONE;
    const nextOwner = this.candidateStableOwnerIds[next] ?? M5_OLD_BRIDGE_NONE;
    if (currentOwner !== nextOwner) return currentOwner < nextOwner;
    const currentSequence = this.candidateStableSequences[current] ?? M5_OLD_BRIDGE_NONE;
    const nextSequence = this.candidateStableSequences[next] ?? M5_OLD_BRIDGE_NONE;
    return currentSequence !== nextSequence ? currentSequence < nextSequence : current < next;
  }
}

export function createM5OldBridgeGuestCrisisStore(
  options: M5OldBridgeStoreOptions,
): M5OldBridgeGuestCrisisStore {
  return new M5OldBridgeGuestCrisisStore(options);
}

export function validOldBridgeDefinition(definition: M5AnomalyDefinitionView): boolean {
  return (
    definition.defId === M5_ANOMALY_DEF_OLD_BRIDGE_GUEST &&
    definition.schemaVersion === M5_ANOMALY_ROSTER_SNAPSHOT_VERSION &&
    definition.ruleComponent === M5_ANOMALY_RULE_COMPONENT_OLD_BRIDGE_GUEST &&
    definition.activationPolicy === M5_ANOMALY_ACTIVATION_POLICY_OLD_BRIDGE_GUEST_RECIPROCITY &&
    definition.stateOwnerKind === M5_ANOMALY_STATE_OWNER_OLD_BRIDGE_GUEST_CRISIS &&
    definition.minActivationScore === M5_OLD_BRIDGE_MIN_RECIPROCITY_SCORE &&
    definition.evidenceClassMask === M5_OLD_BRIDGE_EVIDENCE_MASK &&
    definition.nonCombatResolutionMask === M5_OLD_BRIDGE_NON_COMBAT_MASK
  );
}

function resolutionReason(
  input: M5OldBridgeResolutionInput,
): { readonly terminal: number; readonly reason: M5OldBridgeReason } | undefined {
  if (
    input.method === M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY &&
    input.preparedItemDelivered === 1 &&
    input.reciprocityScore >= M5_OLD_BRIDGE_MIN_RECIPROCITY_SCORE
  )
    return {
      terminal: M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
      reason: "old_bridge_resolved_reciprocity",
    };
  if (
    input.method === M5_OLD_BRIDGE_RESOLUTION_REROUTE &&
    input.routeReplanned === 1 &&
    input.rerouteScore >= M5_OLD_BRIDGE_MIN_REROUTE_SCORE
  )
    return { terminal: M5_OLD_BRIDGE_TERMINAL_REROUTED, reason: "old_bridge_resolved_rerouted" };
  if (
    input.method === M5_OLD_BRIDGE_RESOLUTION_OBLIGATION_SETTLEMENT &&
    input.obligationSettled === 1 &&
    input.settlementScore >= M5_OLD_BRIDGE_MIN_SETTLEMENT_SCORE
  )
    return {
      terminal: M5_OLD_BRIDGE_TERMINAL_OBLIGATION_SETTLED,
      reason: "old_bridge_resolved_obligation_settled",
    };
  return undefined;
}

function validResolutionInput(input: M5OldBridgeResolutionInput): boolean {
  return (
    (input.method === M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY ||
      input.method === M5_OLD_BRIDGE_RESOLUTION_REROUTE ||
      input.method === M5_OLD_BRIDGE_RESOLUTION_OBLIGATION_SETTLEMENT) &&
    isFlag(input.preparedItemDelivered) &&
    isFlag(input.routeReplanned) &&
    isFlag(input.obligationSettled) &&
    isScore(input.reciprocityScore) &&
    isScore(input.rerouteScore) &&
    isScore(input.settlementScore)
  );
}

function validBasisVersions(input: M5OldBridgeActivationBasis): boolean {
  return (
    isPositiveUint32(input.routeBasisVersion) &&
    isPositiveUint32(input.bridgeLedgerVersion) &&
    isPositiveUint32(input.preparedItemOwnerVersion) &&
    isPositiveUint32(input.logisticsIndexVersion) &&
    isPositiveUint32(input.chronicleEvidenceOwnerVersion) &&
    isPositiveUint32(input.obligationOwnerVersion) &&
    isPositiveUint32(input.factionFactOwnerVersion) &&
    isPositiveUint32(input.seasonOwnerVersion) &&
    isPositiveUint32(input.oldFamilyRecordVersion)
  );
}

function validCandidateNumbers(input: M5OldBridgeActivationBasis): boolean {
  return (
    isUint32(input.defIndex) &&
    isPositiveUint32(input.rosterVersion) &&
    isHash(input.contentManifestHash) &&
    isConcreteUint32(input.crossingActorId) &&
    isConcreteUint32(input.guestActorId) &&
    isConcreteUint32(input.bridgeId) &&
    isConcreteUint32(input.routeId) &&
    isConcreteUint32(input.bridgeWindowId) &&
    isConcreteUint32(input.seasonWindowId) &&
    isFlag(input.bridgeWindowActive) &&
    isFlag(input.routePassable) &&
    isScore(input.routeDelayScore) &&
    isConcreteUint32(input.bridgeLedgerEntryId) &&
    isFlag(input.bridgeLedgerMismatch) &&
    isConcreteUint32(input.preparedItemDefId) &&
    validPreparedItemStack(input) &&
    isUint32(input.preparedItemQuantity) &&
    isConcreteUint32(input.preparedForActorId) &&
    isConcreteUint32(input.chronicleCaseId) &&
    isConcreteUint32(input.chronicleHypothesisId) &&
    isConcreteUint32(input.obligationId) &&
    isScore(input.obligationPressure) &&
    isScore(input.factionPressure) &&
    isScore(input.merchantTestimonyScore) &&
    isScore(input.oldFamilyOralRecordScore) &&
    isScore(input.preparedItemScore) &&
    isScore(input.reciprocityDebtScore) &&
    isFlag(input.selfServingToll) &&
    isUint32(input.priority) &&
    isConcreteUint32(input.stableOwnerId) &&
    isUint32(input.stableSequence)
  );
}

function validPreparedItemStack(input: M5OldBridgeActivationBasis): boolean {
  if (input.preparedItemQuantity === 0) return input.preparedItemStackId === M5_OLD_BRIDGE_NONE;
  return isConcreteUint32(input.preparedItemStackId);
}

function candidateReason(
  selected: number,
  candidateCapHit: boolean,
  selectedCapHit: boolean,
): M5OldBridgeReason {
  if (candidateCapHit) return "old_bridge_activation_candidate_cap_reached";
  if (selectedCapHit) return "old_bridge_activation_selected_cap_reached";
  return selected === 0
    ? "old_bridge_activation_no_candidate"
    : "old_bridge_activation_candidate_indexed";
}

function isEvidenceKind(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 5;
}

function isScore(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

function isFlag(value: number): boolean {
  return value === 0 || value === 1;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isConcreteUint32(value: number): boolean {
  return isUint32(value) && value !== M5_OLD_BRIDGE_NONE;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function isPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isHash(value: string): boolean {
  return value.length > 0 && value.length <= 128;
}

function requirePositive(value: number, label: string): number {
  if (!isPositive(value)) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M5_OLD_BRIDGE_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M5_OLD_BRIDGE_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}

function encodeReason(reason: M5OldBridgeReason): number {
  if (reason === "old_bridge_low_risk_evidence_recorded") return 1;
  if (reason === "old_bridge_escalated") return 2;
  if (reason === "old_bridge_resolved_reciprocity") return 3;
  if (reason === "old_bridge_resolved_rerouted") return 4;
  if (reason === "old_bridge_resolved_obligation_settled") return 5;
  if (reason === "old_bridge_failed") return 6;
  return 0;
}

function decodeReason(code: number): M5OldBridgeReason {
  if (code === 1) return "old_bridge_low_risk_evidence_recorded";
  if (code === 2) return "old_bridge_escalated";
  if (code === 3) return "old_bridge_resolved_reciprocity";
  if (code === 4) return "old_bridge_resolved_rerouted";
  if (code === 5) return "old_bridge_resolved_obligation_settled";
  if (code === 6) return "old_bridge_failed";
  return "old_bridge_activated";
}
