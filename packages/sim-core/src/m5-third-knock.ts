import {
  M5_ANOMALY_ACTIVATION_POLICY_THIRD_KNOCK_THRESHOLD_INVITATION,
  M5_ANOMALY_DEF_THIRD_KNOCK,
  M5_ANOMALY_ROSTER_SNAPSHOT_VERSION,
  M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK,
  M5_ANOMALY_STATE_OWNER_THIRD_KNOCK_CRISIS,
  type M5AnomalyDefinitionView,
} from "./m5-anomaly-roster-types";
import {
  M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH,
  M5_THIRD_KNOCK_EVIDENCE_NONE,
  M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
  M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
  M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
  M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT,
  M5_THIRD_KNOCK_MIN_CONTAINMENT_SCORE,
  M5_THIRD_KNOCK_MIN_INVITATION_SCORE,
  M5_THIRD_KNOCK_MIN_POLICY_SCORE,
  M5_THIRD_KNOCK_NONE,
  M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT,
  M5_THIRD_KNOCK_RESOLUTION_TEMPORARY_POLICY,
  M5_THIRD_KNOCK_STATE_ACTIVATED,
  M5_THIRD_KNOCK_STATE_EMPTY,
  M5_THIRD_KNOCK_STATE_ESCALATED,
  M5_THIRD_KNOCK_STATE_FAILED,
  M5_THIRD_KNOCK_STATE_RESOLVED,
  M5_THIRD_KNOCK_STATE_TRACE,
  M5_THIRD_KNOCK_TERMINAL_ABORTED,
  M5_THIRD_KNOCK_TERMINAL_CONTAINED,
  M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED,
  M5_THIRD_KNOCK_TERMINAL_NONE,
  M5_THIRD_KNOCK_TERMINAL_POLICY_BOUND,
  M5_THIRD_KNOCK_TRACE_ACTIVATION,
  M5_THIRD_KNOCK_TRACE_ESCALATION,
  M5_THIRD_KNOCK_TRACE_FAILURE,
  M5_THIRD_KNOCK_TRACE_LOW_RISK_EVIDENCE,
  M5_THIRD_KNOCK_TRACE_RESOLUTION,
  type M5ThirdKnockAccidentReviewView,
  type M5ThirdKnockActivateInput,
  type M5ThirdKnockActivationBasis,
  type M5ThirdKnockCandidateQuery,
  type M5ThirdKnockCandidateQueryResult,
  type M5ThirdKnockCandidateView,
  type M5ThirdKnockCrisisView,
  type M5ThirdKnockFailureInput,
  type M5ThirdKnockMetrics,
  type M5ThirdKnockMutationResult,
  type M5ThirdKnockReason,
  type M5ThirdKnockResolutionInput,
  type M5ThirdKnockStoreOptions,
  type M5ThirdKnockTraceInput,
  type M5ThirdKnockTraceView,
} from "./m5-third-knock-types";

export const M5_THIRD_KNOCK_EVIDENCE_MASK =
  (1 << M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS) |
  (1 << M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT) |
  (1 << M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS) |
  (1 << M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH) |
  (1 << M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE);

export const M5_THIRD_KNOCK_NON_COMBAT_MASK =
  (1 << M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT) | (1 << M5_THIRD_KNOCK_RESOLUTION_TEMPORARY_POLICY);

export class M5ThirdKnockCrisisStore {
  readonly candidateCapacity: number;
  readonly crisisCapacity: number;
  readonly traceCapacity: number;
  readonly accidentReviewCapacity: number;

  private readonly candidateActive: Uint8Array;
  private readonly candidateDefIndexes: Uint32Array;
  private readonly candidateRosterVersions: Uint32Array;
  private readonly candidateContentManifestHashes: string[];
  private readonly candidateResidentActors: Uint32Array;
  private readonly candidateGuestActors: Uint32Array;
  private readonly candidateDoors: Uint32Array;
  private readonly candidateThresholds: Uint32Array;
  private readonly candidateCases: Uint32Array;
  private readonly candidateHypotheses: Uint32Array;
  private readonly knockCounts: Uint8Array;
  private readonly answeredThirdKnock: Uint8Array;
  private readonly thresholdBasisVersions: Uint32Array;
  private readonly thresholdMarkCounts: Uint16Array;
  private readonly chronicleEvidenceOwnerVersions: Uint32Array;
  private readonly chronicleSupportScores: Uint32Array;
  private readonly chronicleClassCounts: Uint8Array;
  private readonly townRuleOwnerVersions: Uint32Array;
  private readonly knowsConfirmedRule: Uint8Array;
  private readonly temporaryPolicyActive: Uint8Array;
  private readonly obligationOwnerVersions: Uint32Array;
  private readonly obligationPressures: Uint32Array;
  private readonly guesthousePolicyVersions: Uint32Array;
  private readonly lodgingRegisterVersions: Uint32Array;
  private readonly lodgingRegisterMismatch: Uint8Array;
  private readonly witnessDisagreementScores: Uint32Array;
  private readonly priorKnockWitnessCounts: Uint16Array;
  private readonly invitationDebtScores: Uint32Array;
  private readonly candidatePriorities: Uint32Array;
  private readonly candidateStableOwnerIds: Uint32Array;
  private readonly candidateStableSequences: Uint32Array;
  private readonly candidateVersions: Uint32Array;
  private readonly candidateNext: Int32Array;
  private readonly candidatePrevious: Int32Array;
  private candidateHead = -1;

  private readonly crisisRegistered: Uint8Array;
  private readonly crisisStates: Uint8Array;
  private readonly crisisResidentActors: Uint32Array;
  private readonly crisisGuestActors: Uint32Array;
  private readonly crisisDoors: Uint32Array;
  private readonly crisisThresholds: Uint32Array;
  private readonly crisisCases: Uint32Array;
  private readonly crisisHypotheses: Uint32Array;
  private readonly crisisThresholdVersions: Uint32Array;
  private readonly crisisChronicleVersions: Uint32Array;
  private readonly crisisTownRuleVersions: Uint32Array;
  private readonly crisisObligationVersions: Uint32Array;
  private readonly crisisGuesthouseVersions: Uint32Array;
  private readonly crisisLodgingRegisterVersions: Uint32Array;
  private readonly activationTicks: Uint32Array;
  private readonly traceTicks: Uint32Array;
  private readonly escalationTicks: Uint32Array;
  private readonly terminalTicks: Uint32Array;
  private readonly lowRiskEvidenceCounts: Uint16Array;
  private readonly escalationLevels: Uint8Array;
  private readonly resolutionMethods: Uint8Array;
  private readonly terminalReasons: Uint8Array;
  private readonly crisisInvitationDebtScores: Uint32Array;
  private readonly crisisObligationPressures: Uint32Array;
  private readonly crisisVersions: Uint32Array;

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
  private readonly reviewObligationPressures: Uint32Array;
  private readonly reviewTownRuleVersions: Uint32Array;
  private readonly reviewGuesthouseVersions: Uint32Array;
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
  private lastCandidateVisits = 0;
  private totalCandidateVisits = 0;
  private candidateCapHitCount = 0;
  private rosterVersionValue = 0;
  private contentManifestHashValue = "";

  constructor(options: M5ThirdKnockStoreOptions) {
    this.candidateCapacity = requirePositive(options.candidateCapacity, "candidate capacity");
    this.crisisCapacity = requirePositive(options.crisisCapacity, "crisis capacity");
    this.traceCapacity = requirePositive(options.traceCapacity, "trace capacity");
    this.accidentReviewCapacity = requirePositive(
      options.accidentReviewCapacity,
      "accident review capacity",
    );
    this.candidateActive = new Uint8Array(this.candidateCapacity);
    this.candidateDefIndexes = filledUint32(this.candidateCapacity);
    this.candidateRosterVersions = new Uint32Array(this.candidateCapacity);
    this.candidateContentManifestHashes = Array.from({ length: this.candidateCapacity }, () => "");
    this.candidateResidentActors = filledUint32(this.candidateCapacity);
    this.candidateGuestActors = filledUint32(this.candidateCapacity);
    this.candidateDoors = filledUint32(this.candidateCapacity);
    this.candidateThresholds = filledUint32(this.candidateCapacity);
    this.candidateCases = filledUint32(this.candidateCapacity);
    this.candidateHypotheses = filledUint32(this.candidateCapacity);
    this.knockCounts = new Uint8Array(this.candidateCapacity);
    this.answeredThirdKnock = new Uint8Array(this.candidateCapacity);
    this.thresholdBasisVersions = new Uint32Array(this.candidateCapacity);
    this.thresholdMarkCounts = new Uint16Array(this.candidateCapacity);
    this.chronicleEvidenceOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.chronicleSupportScores = new Uint32Array(this.candidateCapacity);
    this.chronicleClassCounts = new Uint8Array(this.candidateCapacity);
    this.townRuleOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.knowsConfirmedRule = new Uint8Array(this.candidateCapacity);
    this.temporaryPolicyActive = new Uint8Array(this.candidateCapacity);
    this.obligationOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.obligationPressures = new Uint32Array(this.candidateCapacity);
    this.guesthousePolicyVersions = new Uint32Array(this.candidateCapacity);
    this.lodgingRegisterVersions = new Uint32Array(this.candidateCapacity);
    this.lodgingRegisterMismatch = new Uint8Array(this.candidateCapacity);
    this.witnessDisagreementScores = new Uint32Array(this.candidateCapacity);
    this.priorKnockWitnessCounts = new Uint16Array(this.candidateCapacity);
    this.invitationDebtScores = new Uint32Array(this.candidateCapacity);
    this.candidatePriorities = new Uint32Array(this.candidateCapacity);
    this.candidateStableOwnerIds = filledUint32(this.candidateCapacity);
    this.candidateStableSequences = filledUint32(this.candidateCapacity);
    this.candidateVersions = new Uint32Array(this.candidateCapacity);
    this.candidateNext = filledInt32(this.candidateCapacity);
    this.candidatePrevious = filledInt32(this.candidateCapacity);
    this.crisisRegistered = new Uint8Array(this.crisisCapacity);
    this.crisisStates = new Uint8Array(this.crisisCapacity);
    this.crisisResidentActors = filledUint32(this.crisisCapacity);
    this.crisisGuestActors = filledUint32(this.crisisCapacity);
    this.crisisDoors = filledUint32(this.crisisCapacity);
    this.crisisThresholds = filledUint32(this.crisisCapacity);
    this.crisisCases = filledUint32(this.crisisCapacity);
    this.crisisHypotheses = filledUint32(this.crisisCapacity);
    this.crisisThresholdVersions = new Uint32Array(this.crisisCapacity);
    this.crisisChronicleVersions = new Uint32Array(this.crisisCapacity);
    this.crisisTownRuleVersions = new Uint32Array(this.crisisCapacity);
    this.crisisObligationVersions = new Uint32Array(this.crisisCapacity);
    this.crisisGuesthouseVersions = new Uint32Array(this.crisisCapacity);
    this.crisisLodgingRegisterVersions = new Uint32Array(this.crisisCapacity);
    this.activationTicks = filledUint32(this.crisisCapacity);
    this.traceTicks = filledUint32(this.crisisCapacity);
    this.escalationTicks = filledUint32(this.crisisCapacity);
    this.terminalTicks = filledUint32(this.crisisCapacity);
    this.lowRiskEvidenceCounts = new Uint16Array(this.crisisCapacity);
    this.escalationLevels = new Uint8Array(this.crisisCapacity);
    this.resolutionMethods = new Uint8Array(this.crisisCapacity);
    this.terminalReasons = new Uint8Array(this.crisisCapacity);
    this.crisisInvitationDebtScores = new Uint32Array(this.crisisCapacity);
    this.crisisObligationPressures = new Uint32Array(this.crisisCapacity);
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
    this.reviewSequences = new Uint32Array(this.accidentReviewCapacity);
    this.reviewCrisisIds = filledUint32(this.accidentReviewCapacity);
    this.reviewTicks = filledUint32(this.accidentReviewCapacity);
    this.reviewMethods = new Uint8Array(this.accidentReviewCapacity);
    this.reviewTerminalReasons = new Uint8Array(this.accidentReviewCapacity);
    this.reviewEvidenceCounts = new Uint16Array(this.accidentReviewCapacity);
    this.reviewDebtScores = new Uint32Array(this.accidentReviewCapacity);
    this.reviewObligationPressures = new Uint32Array(this.accidentReviewCapacity);
    this.reviewTownRuleVersions = new Uint32Array(this.accidentReviewCapacity);
    this.reviewGuesthouseVersions = new Uint32Array(this.accidentReviewCapacity);
    this.reviewOwnerVersions = new Uint32Array(this.accidentReviewCapacity);
    this.reviewReasonCodes = new Uint8Array(this.accidentReviewCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  registerActivationCandidate(
    input: M5ThirdKnockActivationBasis,
    definition: M5AnomalyDefinitionView,
  ): M5ThirdKnockMutationResult {
    const valid = this.validateCandidate(input, definition);
    if (!valid.ok) return valid;
    if (!this.matchesPinnedBasis(input.rosterVersion, input.contentManifestHash))
      return { ok: false, reason: "third_knock_stale_content_basis" };
    if ((this.candidateActive[input.candidateId] ?? 0) === 1)
      return { ok: false, reason: "third_knock_candidate_already_registered" };
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
      reason: "third_knock_activation_candidate_indexed",
    };
  }

  queryActivationCandidates(
    query: M5ThirdKnockCandidateQuery,
    outputCandidateIds: Uint32Array,
  ): M5ThirdKnockCandidateQueryResult {
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
      if ((this.invitationDebtScores[current] ?? 0) >= query.minInvitationDebtScore) {
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

  activateCandidate(input: M5ThirdKnockActivateInput): M5ThirdKnockMutationResult {
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "third_knock_candidate_id_out_of_range" };
    if (!isIndex(input.crisisId, this.crisisCapacity))
      return { ok: false, reason: "third_knock_crisis_id_out_of_range" };
    if ((this.candidateActive[input.candidateId] ?? 0) === 0)
      return { ok: false, reason: "third_knock_candidate_not_registered" };
    if ((this.crisisRegistered[input.crisisId] ?? 0) === 1)
      return { ok: false, reason: "third_knock_crisis_already_registered" };
    if (!isUint32(input.tick)) return { ok: false, reason: "third_knock_value_out_of_range" };
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
      M5_THIRD_KNOCK_TRACE_ACTIVATION,
      M5_THIRD_KNOCK_EVIDENCE_NONE,
      input.tick,
      "third_knock_activated",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "third_knock_activated",
    };
  }

  recordLowRiskEvidence(input: M5ThirdKnockTraceInput): M5ThirdKnockMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if (!isEvidenceKind(input.evidenceKind))
      return { ok: false, reason: "third_knock_value_out_of_range" };
    const state = this.crisisStates[input.crisisId] ?? M5_THIRD_KNOCK_STATE_EMPTY;
    if (state !== M5_THIRD_KNOCK_STATE_ACTIVATED && state !== M5_THIRD_KNOCK_STATE_TRACE)
      return { ok: false, reason: "third_knock_terminal_state" };
    if ((this.lowRiskEvidenceCounts[input.crisisId] ?? 0) >= 0xffff)
      return { ok: false, reason: "third_knock_low_risk_evidence_cap_reached" };
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.crisisStates[input.crisisId] = M5_THIRD_KNOCK_STATE_TRACE;
    this.traceTicks[input.crisisId] = input.tick;
    this.lowRiskEvidenceCounts[input.crisisId] =
      (this.lowRiskEvidenceCounts[input.crisisId] ?? 0) + 1;
    this.lowRiskEvidenceTotal += 1;
    this.crisisVersions[input.crisisId] = nextVersion.ownerVersion;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      input.crisisId,
      M5_THIRD_KNOCK_TRACE_LOW_RISK_EVIDENCE,
      input.evidenceKind,
      input.tick,
      "third_knock_low_risk_evidence_recorded",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "third_knock_low_risk_evidence_recorded",
    };
  }

  escalateCrisis(crisisId: number, tick: number): M5ThirdKnockMutationResult {
    const valid = this.validateOpenCrisis(crisisId, tick);
    if (!valid.ok) return valid;
    if ((this.lowRiskEvidenceCounts[crisisId] ?? 0) === 0)
      return { ok: false, reason: "third_knock_escalation_requires_evidence" };
    if ((this.crisisStates[crisisId] ?? 0) !== M5_THIRD_KNOCK_STATE_TRACE)
      return { ok: false, reason: "third_knock_terminal_state" };
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.crisisStates[crisisId] = M5_THIRD_KNOCK_STATE_ESCALATED;
    this.escalationTicks[crisisId] = tick;
    this.escalationLevels[crisisId] = (this.escalationLevels[crisisId] ?? 0) + 1;
    this.crisisVersions[crisisId] = nextVersion.ownerVersion;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      crisisId,
      M5_THIRD_KNOCK_TRACE_ESCALATION,
      M5_THIRD_KNOCK_EVIDENCE_NONE,
      tick,
      "third_knock_escalated",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "third_knock_escalated",
    };
  }

  resolveCrisis(input: M5ThirdKnockResolutionInput): M5ThirdKnockMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if ((this.crisisStates[input.crisisId] ?? 0) !== M5_THIRD_KNOCK_STATE_ESCALATED)
      return { ok: false, reason: "third_knock_resolution_requirements_unmet" };
    if (!validResolutionInput(input))
      return { ok: false, reason: "third_knock_value_out_of_range" };
    const reason = resolutionReason(input);
    if (reason === undefined)
      return { ok: false, reason: "third_knock_resolution_requirements_unmet" };
    return this.finishCrisis(
      input.crisisId,
      input.tick,
      input.method,
      reason.terminal,
      reason.reason,
    );
  }

  failCrisis(input: M5ThirdKnockFailureInput): M5ThirdKnockMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if (
      input.terminalReason !== M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED &&
      input.terminalReason !== M5_THIRD_KNOCK_TERMINAL_ABORTED
    )
      return { ok: false, reason: "third_knock_value_out_of_range" };
    if (
      input.terminalReason === M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED &&
      (this.crisisStates[input.crisisId] ?? 0) !== M5_THIRD_KNOCK_STATE_ESCALATED
    )
      return { ok: false, reason: "third_knock_escalation_requires_evidence" };
    return this.finishCrisis(
      input.crisisId,
      input.tick,
      0,
      input.terminalReason,
      "third_knock_failed",
    );
  }

  readCandidate(candidateId: number): M5ThirdKnockCandidateView | undefined {
    if (
      !isIndex(candidateId, this.candidateCapacity) ||
      (this.candidateActive[candidateId] ?? 0) === 0
    )
      return undefined;
    return this.createCandidateView(candidateId);
  }

  readCrisis(crisisId: number): M5ThirdKnockCrisisView | undefined {
    if (!isIndex(crisisId, this.crisisCapacity) || (this.crisisRegistered[crisisId] ?? 0) === 0)
      return undefined;
    return {
      crisisId,
      state: this.crisisStates[crisisId] ?? 0,
      residentActorId: this.crisisResidentActors[crisisId] ?? M5_THIRD_KNOCK_NONE,
      guestActorId: this.crisisGuestActors[crisisId] ?? M5_THIRD_KNOCK_NONE,
      doorId: this.crisisDoors[crisisId] ?? M5_THIRD_KNOCK_NONE,
      thresholdId: this.crisisThresholds[crisisId] ?? M5_THIRD_KNOCK_NONE,
      chronicleCaseId: this.crisisCases[crisisId] ?? M5_THIRD_KNOCK_NONE,
      chronicleHypothesisId: this.crisisHypotheses[crisisId] ?? M5_THIRD_KNOCK_NONE,
      thresholdBasisVersion: this.crisisThresholdVersions[crisisId] ?? 0,
      chronicleEvidenceOwnerVersion: this.crisisChronicleVersions[crisisId] ?? 0,
      townRuleOwnerVersion: this.crisisTownRuleVersions[crisisId] ?? 0,
      obligationOwnerVersion: this.crisisObligationVersions[crisisId] ?? 0,
      guesthousePolicyVersion: this.crisisGuesthouseVersions[crisisId] ?? 0,
      lodgingRegisterVersion: this.crisisLodgingRegisterVersions[crisisId] ?? 0,
      activationTick: this.activationTicks[crisisId] ?? M5_THIRD_KNOCK_NONE,
      traceTick: this.traceTicks[crisisId] ?? M5_THIRD_KNOCK_NONE,
      escalationTick: this.escalationTicks[crisisId] ?? M5_THIRD_KNOCK_NONE,
      terminalTick: this.terminalTicks[crisisId] ?? M5_THIRD_KNOCK_NONE,
      lowRiskEvidenceCount: this.lowRiskEvidenceCounts[crisisId] ?? 0,
      escalationLevel: this.escalationLevels[crisisId] ?? 0,
      resolutionMethod: this.resolutionMethods[crisisId] ?? 0,
      terminalReason: this.terminalReasons[crisisId] ?? 0,
      invitationDebtScore: this.crisisInvitationDebtScores[crisisId] ?? 0,
      obligationPressure: this.crisisObligationPressures[crisisId] ?? 0,
      crisisVersion: this.crisisVersions[crisisId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readTrace(ageFromNewest: number): M5ThirdKnockTraceView | undefined {
    if (!isIndex(ageFromNewest, this.traceStored)) return undefined;
    const slot = (this.traceCursor + this.traceCapacity - 1 - ageFromNewest) % this.traceCapacity;
    return {
      sequence: this.traceSequences[slot] ?? 0,
      crisisId: this.traceCrisisIds[slot] ?? M5_THIRD_KNOCK_NONE,
      eventKind: this.traceEventKinds[slot] ?? 0,
      evidenceKind: this.traceEvidenceKinds[slot] ?? 0,
      tick: this.traceTickValues[slot] ?? M5_THIRD_KNOCK_NONE,
      crisisState: this.traceStates[slot] ?? 0,
      terminalReason: this.traceTerminalReasons[slot] ?? 0,
      ownerVersion: this.traceOwnerVersions[slot] ?? 0,
      reason: decodeReason(this.traceReasonCodes[slot] ?? 0),
    };
  }

  readAccidentReview(ageFromNewest: number): M5ThirdKnockAccidentReviewView | undefined {
    if (!isIndex(ageFromNewest, this.reviewStored)) return undefined;
    const slot =
      (this.reviewCursor + this.accidentReviewCapacity - 1 - ageFromNewest) %
      this.accidentReviewCapacity;
    return {
      sequence: this.reviewSequences[slot] ?? 0,
      crisisId: this.reviewCrisisIds[slot] ?? M5_THIRD_KNOCK_NONE,
      tick: this.reviewTicks[slot] ?? M5_THIRD_KNOCK_NONE,
      resolutionMethod: this.reviewMethods[slot] ?? 0,
      terminalReason: this.reviewTerminalReasons[slot] ?? 0,
      lowRiskEvidenceCount: this.reviewEvidenceCounts[slot] ?? 0,
      invitationDebtScore: this.reviewDebtScores[slot] ?? 0,
      obligationPressure: this.reviewObligationPressures[slot] ?? 0,
      townRuleOwnerVersion: this.reviewTownRuleVersions[slot] ?? 0,
      guesthousePolicyVersion: this.reviewGuesthouseVersions[slot] ?? 0,
      ownerVersion: this.reviewOwnerVersions[slot] ?? 0,
      reason: decodeReason(this.reviewReasonCodes[slot] ?? 0),
    };
  }

  createMetrics(): M5ThirdKnockMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeCandidateCount: this.activeCandidateCountValue,
      activeCrisisCount: this.activeCrisisCountValue,
      resolvedCrisisCount: this.resolvedCrisisCountValue,
      failedCrisisCount: this.failedCrisisCountValue,
      lowRiskEvidenceCount: this.lowRiskEvidenceTotal,
      lastCandidateVisits: this.lastCandidateVisits,
      totalCandidateVisits: this.totalCandidateVisits,
      candidateCapHitCount: this.candidateCapHitCount,
      traceStoredCount: this.traceStored,
      accidentReviewStoredCount: this.reviewStored,
    };
  }

  private finishCrisis(
    crisisId: number,
    tick: number,
    method: number,
    terminal: number,
    reason: M5ThirdKnockReason,
  ): M5ThirdKnockMutationResult {
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    const resolved =
      terminal === M5_THIRD_KNOCK_TERMINAL_CONTAINED ||
      terminal === M5_THIRD_KNOCK_TERMINAL_POLICY_BOUND;
    this.crisisStates[crisisId] = resolved
      ? M5_THIRD_KNOCK_STATE_RESOLVED
      : M5_THIRD_KNOCK_STATE_FAILED;
    this.terminalTicks[crisisId] = tick;
    this.resolutionMethods[crisisId] = method;
    this.terminalReasons[crisisId] = terminal;
    this.crisisVersions[crisisId] = nextVersion.ownerVersion;
    this.activeCrisisCountValue -= 1;
    if (resolved) this.resolvedCrisisCountValue += 1;
    else this.failedCrisisCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      crisisId,
      resolved ? M5_THIRD_KNOCK_TRACE_RESOLUTION : M5_THIRD_KNOCK_TRACE_FAILURE,
      M5_THIRD_KNOCK_EVIDENCE_NONE,
      tick,
      reason,
    );
    this.recordAccidentReview(crisisId, tick, method, terminal, reason);
    return { ok: true, changed: true, ownerVersion: this.ownerVersionValue, reason };
  }

  private validateCandidate(
    input: M5ThirdKnockActivationBasis,
    definition: M5AnomalyDefinitionView,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5ThirdKnockReason } {
    if (!validThirdKnockDefinition(definition))
      return { ok: false, reason: "third_knock_definition_invalid" };
    if (
      input.defIndex !== definition.defIndex ||
      input.rosterVersion !== definition.rosterVersion ||
      input.contentManifestHash !== definition.contentManifestHash
    )
      return { ok: false, reason: "third_knock_stale_content_basis" };
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "third_knock_candidate_id_out_of_range" };
    if (!validBasisVersions(input))
      return { ok: false, reason: "third_knock_basis_version_invalid" };
    return validCandidateNumbers(input)
      ? { ok: true }
      : { ok: false, reason: "third_knock_value_out_of_range" };
  }

  private validateCandidateQuery(
    query: M5ThirdKnockCandidateQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5ThirdKnockReason } {
    if (
      query.rosterVersion !== this.rosterVersionValue ||
      query.contentManifestHash !== this.contentManifestHashValue
    )
      return { ok: false, reason: "third_knock_stale_content_basis" };
    if (!isPositive(query.candidateCap))
      return { ok: false, reason: "third_knock_candidate_cap_invalid" };
    if (!isPositive(query.selectedCap))
      return { ok: false, reason: "third_knock_selected_cap_invalid" };
    if (output.length < query.selectedCap)
      return { ok: false, reason: "third_knock_output_too_small" };
    return isScore(query.minInvitationDebtScore)
      ? { ok: true }
      : { ok: false, reason: "third_knock_value_out_of_range" };
  }

  private validateOpenCrisis(
    crisisId: number,
    tick: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5ThirdKnockReason } {
    if (!isIndex(crisisId, this.crisisCapacity))
      return { ok: false, reason: "third_knock_crisis_id_out_of_range" };
    if ((this.crisisRegistered[crisisId] ?? 0) === 0)
      return { ok: false, reason: "third_knock_crisis_not_registered" };
    if (!isUint32(tick)) return { ok: false, reason: "third_knock_value_out_of_range" };
    const state = this.crisisStates[crisisId] ?? 0;
    return state === M5_THIRD_KNOCK_STATE_RESOLVED || state === M5_THIRD_KNOCK_STATE_FAILED
      ? { ok: false, reason: "third_knock_terminal_state" }
      : { ok: true };
  }

  private matchesPinnedBasis(rosterVersion: number, contentManifestHash: string): boolean {
    return (
      this.ownerVersionValue === 0 ||
      (rosterVersion === this.rosterVersionValue &&
        contentManifestHash === this.contentManifestHashValue)
    );
  }

  private readActivationPrevention(candidateId: number): M5ThirdKnockReason | undefined {
    if (
      (this.knockCounts[candidateId] ?? 0) < 3 ||
      (this.answeredThirdKnock[candidateId] ?? 0) === 0
    )
      return "third_knock_activation_prevented_prior_knocks";
    if (
      (this.knowsConfirmedRule[candidateId] ?? 0) === 1 ||
      (this.temporaryPolicyActive[candidateId] ?? 0) === 1
    )
      return "third_knock_activation_prevented_known_rule_or_policy";
    return (this.invitationDebtScores[candidateId] ?? 0) < M5_THIRD_KNOCK_MIN_INVITATION_SCORE
      ? "third_knock_activation_prevented_threshold"
      : undefined;
  }

  private writeCandidate(input: M5ThirdKnockActivationBasis, version: number): void {
    const id = input.candidateId;
    this.candidateActive[id] = 1;
    this.candidateDefIndexes[id] = input.defIndex;
    this.candidateRosterVersions[id] = input.rosterVersion;
    this.candidateContentManifestHashes[id] = input.contentManifestHash;
    this.candidateResidentActors[id] = input.residentActorId;
    this.candidateGuestActors[id] = input.guestActorId;
    this.candidateDoors[id] = input.doorId;
    this.candidateThresholds[id] = input.thresholdId;
    this.candidateCases[id] = input.chronicleCaseId;
    this.candidateHypotheses[id] = input.chronicleHypothesisId;
    this.knockCounts[id] = input.knockCount;
    this.answeredThirdKnock[id] = input.answeredThirdKnock;
    this.thresholdBasisVersions[id] = input.thresholdBasisVersion;
    this.thresholdMarkCounts[id] = input.thresholdMarkCount;
    this.chronicleEvidenceOwnerVersions[id] = input.chronicleEvidenceOwnerVersion;
    this.chronicleSupportScores[id] = input.chronicleSupportScore;
    this.chronicleClassCounts[id] = input.chronicleIndependentClassCount;
    this.townRuleOwnerVersions[id] = input.townRuleOwnerVersion;
    this.knowsConfirmedRule[id] = input.knowsConfirmedRule;
    this.temporaryPolicyActive[id] = input.temporaryPolicyActive;
    this.obligationOwnerVersions[id] = input.obligationOwnerVersion;
    this.obligationPressures[id] = input.obligationPressure;
    this.guesthousePolicyVersions[id] = input.guesthousePolicyVersion;
    this.lodgingRegisterVersions[id] = input.lodgingRegisterVersion;
    this.lodgingRegisterMismatch[id] = input.lodgingRegisterMismatch;
    this.witnessDisagreementScores[id] = input.witnessDisagreementScore;
    this.priorKnockWitnessCounts[id] = input.priorKnockWitnessCount;
    this.invitationDebtScores[id] = input.invitationDebtScore;
    this.candidatePriorities[id] = input.priority;
    this.candidateStableOwnerIds[id] = input.stableOwnerId;
    this.candidateStableSequences[id] = input.stableSequence;
    this.candidateVersions[id] = version;
  }

  private createCandidateView(candidateId: number): M5ThirdKnockCandidateView {
    return {
      candidateId,
      defIndex: this.candidateDefIndexes[candidateId] ?? M5_THIRD_KNOCK_NONE,
      rosterVersion: this.candidateRosterVersions[candidateId] ?? 0,
      contentManifestHash: this.candidateContentManifestHashes[candidateId] ?? "",
      residentActorId: this.candidateResidentActors[candidateId] ?? M5_THIRD_KNOCK_NONE,
      guestActorId: this.candidateGuestActors[candidateId] ?? M5_THIRD_KNOCK_NONE,
      doorId: this.candidateDoors[candidateId] ?? M5_THIRD_KNOCK_NONE,
      thresholdId: this.candidateThresholds[candidateId] ?? M5_THIRD_KNOCK_NONE,
      chronicleCaseId: this.candidateCases[candidateId] ?? M5_THIRD_KNOCK_NONE,
      chronicleHypothesisId: this.candidateHypotheses[candidateId] ?? M5_THIRD_KNOCK_NONE,
      knockCount: this.knockCounts[candidateId] ?? 0,
      answeredThirdKnock: this.answeredThirdKnock[candidateId] ?? 0,
      thresholdBasisVersion: this.thresholdBasisVersions[candidateId] ?? 0,
      thresholdMarkCount: this.thresholdMarkCounts[candidateId] ?? 0,
      chronicleEvidenceOwnerVersion: this.chronicleEvidenceOwnerVersions[candidateId] ?? 0,
      chronicleSupportScore: this.chronicleSupportScores[candidateId] ?? 0,
      chronicleIndependentClassCount: this.chronicleClassCounts[candidateId] ?? 0,
      townRuleOwnerVersion: this.townRuleOwnerVersions[candidateId] ?? 0,
      knowsConfirmedRule: this.knowsConfirmedRule[candidateId] ?? 0,
      temporaryPolicyActive: this.temporaryPolicyActive[candidateId] ?? 0,
      obligationOwnerVersion: this.obligationOwnerVersions[candidateId] ?? 0,
      obligationPressure: this.obligationPressures[candidateId] ?? 0,
      guesthousePolicyVersion: this.guesthousePolicyVersions[candidateId] ?? 0,
      lodgingRegisterVersion: this.lodgingRegisterVersions[candidateId] ?? 0,
      lodgingRegisterMismatch: this.lodgingRegisterMismatch[candidateId] ?? 0,
      witnessDisagreementScore: this.witnessDisagreementScores[candidateId] ?? 0,
      priorKnockWitnessCount: this.priorKnockWitnessCounts[candidateId] ?? 0,
      invitationDebtScore: this.invitationDebtScores[candidateId] ?? 0,
      priority: this.candidatePriorities[candidateId] ?? 0,
      stableOwnerId: this.candidateStableOwnerIds[candidateId] ?? M5_THIRD_KNOCK_NONE,
      stableSequence: this.candidateStableSequences[candidateId] ?? M5_THIRD_KNOCK_NONE,
      candidateVersion: this.candidateVersions[candidateId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  private writeActivatedCrisis(input: M5ThirdKnockActivateInput, version: number): void {
    const candidateId = input.candidateId;
    const crisisId = input.crisisId;
    this.crisisRegistered[crisisId] = 1;
    this.crisisStates[crisisId] = M5_THIRD_KNOCK_STATE_ACTIVATED;
    this.crisisResidentActors[crisisId] =
      this.candidateResidentActors[candidateId] ?? M5_THIRD_KNOCK_NONE;
    this.crisisGuestActors[crisisId] =
      this.candidateGuestActors[candidateId] ?? M5_THIRD_KNOCK_NONE;
    this.crisisDoors[crisisId] = this.candidateDoors[candidateId] ?? M5_THIRD_KNOCK_NONE;
    this.crisisThresholds[crisisId] = this.candidateThresholds[candidateId] ?? M5_THIRD_KNOCK_NONE;
    this.crisisCases[crisisId] = this.candidateCases[candidateId] ?? M5_THIRD_KNOCK_NONE;
    this.crisisHypotheses[crisisId] = this.candidateHypotheses[candidateId] ?? M5_THIRD_KNOCK_NONE;
    this.crisisThresholdVersions[crisisId] = this.thresholdBasisVersions[candidateId] ?? 0;
    this.crisisChronicleVersions[crisisId] = this.chronicleEvidenceOwnerVersions[candidateId] ?? 0;
    this.crisisTownRuleVersions[crisisId] = this.townRuleOwnerVersions[candidateId] ?? 0;
    this.crisisObligationVersions[crisisId] = this.obligationOwnerVersions[candidateId] ?? 0;
    this.crisisGuesthouseVersions[crisisId] = this.guesthousePolicyVersions[candidateId] ?? 0;
    this.crisisLodgingRegisterVersions[crisisId] = this.lodgingRegisterVersions[candidateId] ?? 0;
    this.crisisInvitationDebtScores[crisisId] = this.invitationDebtScores[candidateId] ?? 0;
    this.crisisObligationPressures[crisisId] = this.obligationPressures[candidateId] ?? 0;
    this.activationTicks[crisisId] = input.tick;
    this.terminalReasons[crisisId] = M5_THIRD_KNOCK_TERMINAL_NONE;
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

  private recordTrace(
    crisisId: number,
    eventKind: number,
    evidenceKind: number,
    tick: number,
    reason: M5ThirdKnockReason,
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

  private recordAccidentReview(
    crisisId: number,
    tick: number,
    method: number,
    terminal: number,
    reason: M5ThirdKnockReason,
  ): void {
    const slot = this.reviewCursor;
    this.reviewSequences[slot] = this.nextReviewSequence;
    this.reviewCrisisIds[slot] = crisisId;
    this.reviewTicks[slot] = tick;
    this.reviewMethods[slot] = method;
    this.reviewTerminalReasons[slot] = terminal;
    this.reviewEvidenceCounts[slot] = this.lowRiskEvidenceCounts[crisisId] ?? 0;
    this.reviewDebtScores[slot] = this.crisisInvitationDebtScores[crisisId] ?? 0;
    this.reviewObligationPressures[slot] = this.crisisObligationPressures[crisisId] ?? 0;
    this.reviewTownRuleVersions[slot] = this.crisisTownRuleVersions[crisisId] ?? 0;
    this.reviewGuesthouseVersions[slot] = this.crisisGuesthouseVersions[crisisId] ?? 0;
    this.reviewOwnerVersions[slot] = this.ownerVersionValue;
    this.reviewReasonCodes[slot] = encodeReason(reason);
    this.reviewCursor = (this.reviewCursor + 1) % this.accidentReviewCapacity;
    this.reviewStored = Math.min(this.accidentReviewCapacity, this.reviewStored + 1);
    this.nextReviewSequence += 1;
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "third_knock_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "third_knock_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private isCandidateBefore(current: number, next: number): boolean {
    const currentScore = this.invitationDebtScores[current] ?? 0;
    const nextScore = this.invitationDebtScores[next] ?? 0;
    if (currentScore !== nextScore) return currentScore > nextScore;
    const currentPriority = this.candidatePriorities[current] ?? 0;
    const nextPriority = this.candidatePriorities[next] ?? 0;
    if (currentPriority !== nextPriority) return currentPriority > nextPriority;
    const currentOwner = this.candidateStableOwnerIds[current] ?? M5_THIRD_KNOCK_NONE;
    const nextOwner = this.candidateStableOwnerIds[next] ?? M5_THIRD_KNOCK_NONE;
    if (currentOwner !== nextOwner) return currentOwner < nextOwner;
    const currentSequence = this.candidateStableSequences[current] ?? M5_THIRD_KNOCK_NONE;
    const nextSequence = this.candidateStableSequences[next] ?? M5_THIRD_KNOCK_NONE;
    return currentSequence !== nextSequence ? currentSequence < nextSequence : current < next;
  }
}

export function createM5ThirdKnockCrisisStore(
  options: M5ThirdKnockStoreOptions,
): M5ThirdKnockCrisisStore {
  return new M5ThirdKnockCrisisStore(options);
}

export function validThirdKnockDefinition(definition: M5AnomalyDefinitionView): boolean {
  return (
    definition.defId === M5_ANOMALY_DEF_THIRD_KNOCK &&
    definition.schemaVersion === M5_ANOMALY_ROSTER_SNAPSHOT_VERSION &&
    definition.ruleComponent === M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK &&
    definition.activationPolicy === M5_ANOMALY_ACTIVATION_POLICY_THIRD_KNOCK_THRESHOLD_INVITATION &&
    definition.stateOwnerKind === M5_ANOMALY_STATE_OWNER_THIRD_KNOCK_CRISIS &&
    definition.minActivationScore === M5_THIRD_KNOCK_MIN_INVITATION_SCORE &&
    definition.evidenceClassMask === M5_THIRD_KNOCK_EVIDENCE_MASK &&
    definition.nonCombatResolutionMask === M5_THIRD_KNOCK_NON_COMBAT_MASK
  );
}

function resolutionReason(
  input: M5ThirdKnockResolutionInput,
): { readonly terminal: number; readonly reason: M5ThirdKnockReason } | undefined {
  if (
    input.method === M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT &&
    input.thresholdSealed === 1 &&
    input.witnessesAligned === 1 &&
    input.containmentScore >= M5_THIRD_KNOCK_MIN_CONTAINMENT_SCORE
  )
    return {
      terminal: M5_THIRD_KNOCK_TERMINAL_CONTAINED,
      reason: "third_knock_resolved_contained",
    };
  if (
    input.method === M5_THIRD_KNOCK_RESOLUTION_TEMPORARY_POLICY &&
    input.policyPublished === 1 &&
    input.debtAcknowledged === 1 &&
    input.policyScore >= M5_THIRD_KNOCK_MIN_POLICY_SCORE
  )
    return {
      terminal: M5_THIRD_KNOCK_TERMINAL_POLICY_BOUND,
      reason: "third_knock_resolved_policy_bound",
    };
  return undefined;
}

function validResolutionInput(input: M5ThirdKnockResolutionInput): boolean {
  return (
    (input.method === M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT ||
      input.method === M5_THIRD_KNOCK_RESOLUTION_TEMPORARY_POLICY) &&
    isFlag(input.thresholdSealed) &&
    isFlag(input.witnessesAligned) &&
    isFlag(input.policyPublished) &&
    isFlag(input.debtAcknowledged) &&
    isScore(input.containmentScore) &&
    isScore(input.policyScore)
  );
}

function validBasisVersions(input: M5ThirdKnockActivationBasis): boolean {
  return (
    isPositiveUint32(input.thresholdBasisVersion) &&
    isPositiveUint32(input.chronicleEvidenceOwnerVersion) &&
    isPositiveUint32(input.townRuleOwnerVersion) &&
    isPositiveUint32(input.obligationOwnerVersion) &&
    isPositiveUint32(input.guesthousePolicyVersion) &&
    isPositiveUint32(input.lodgingRegisterVersion)
  );
}

function validCandidateNumbers(input: M5ThirdKnockActivationBasis): boolean {
  return (
    isUint32(input.defIndex) &&
    isPositiveUint32(input.rosterVersion) &&
    isHash(input.contentManifestHash) &&
    isConcreteUint32(input.residentActorId) &&
    isConcreteUint32(input.guestActorId) &&
    isConcreteUint32(input.doorId) &&
    isConcreteUint32(input.thresholdId) &&
    isConcreteUint32(input.chronicleCaseId) &&
    isConcreteUint32(input.chronicleHypothesisId) &&
    isUint8(input.knockCount) &&
    isFlag(input.answeredThirdKnock) &&
    isUint16(input.thresholdMarkCount) &&
    isScore(input.chronicleSupportScore) &&
    isSmallCount(input.chronicleIndependentClassCount) &&
    isFlag(input.knowsConfirmedRule) &&
    isFlag(input.temporaryPolicyActive) &&
    isScore(input.obligationPressure) &&
    isFlag(input.lodgingRegisterMismatch) &&
    isScore(input.witnessDisagreementScore) &&
    isUint16(input.priorKnockWitnessCount) &&
    isScore(input.invitationDebtScore) &&
    isUint32(input.priority) &&
    isConcreteUint32(input.stableOwnerId) &&
    isUint32(input.stableSequence)
  );
}

function candidateReason(
  selected: number,
  candidateCapHit: boolean,
  selectedCapHit: boolean,
): M5ThirdKnockReason {
  if (candidateCapHit) return "third_knock_activation_candidate_cap_reached";
  if (selectedCapHit) return "third_knock_activation_selected_cap_reached";
  return selected === 0
    ? "third_knock_activation_no_candidate"
    : "third_knock_activation_candidate_indexed";
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

function isSmallCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isUint8(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xff;
}

function isUint16(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isConcreteUint32(value: number): boolean {
  return isUint32(value) && value !== M5_THIRD_KNOCK_NONE;
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
  for (let index = 0; index < count; index += 1) output[index] = M5_THIRD_KNOCK_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M5_THIRD_KNOCK_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}

function encodeReason(reason: M5ThirdKnockReason): number {
  if (reason === "third_knock_low_risk_evidence_recorded") return 1;
  if (reason === "third_knock_escalated") return 2;
  if (reason === "third_knock_resolved_contained") return 3;
  if (reason === "third_knock_resolved_policy_bound") return 4;
  if (reason === "third_knock_failed") return 5;
  return 0;
}

function decodeReason(code: number): M5ThirdKnockReason {
  if (code === 1) return "third_knock_low_risk_evidence_recorded";
  if (code === 2) return "third_knock_escalated";
  if (code === 3) return "third_knock_resolved_contained";
  if (code === 4) return "third_knock_resolved_policy_bound";
  if (code === 5) return "third_knock_failed";
  return "third_knock_activated";
}
