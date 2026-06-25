import {
  M4_BORROWED_SHADOW_EVIDENCE_NONE,
  M4_BORROWED_SHADOW_MIN_CONTAINMENT,
  M4_BORROWED_SHADOW_MIN_GAP_SCORE,
  M4_BORROWED_SHADOW_MIN_NEGOTIATION,
  M4_BORROWED_SHADOW_NONE,
  M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT,
  M4_BORROWED_SHADOW_RESOLUTION_NEGOTIATION,
  M4_BORROWED_SHADOW_STATE_ACTIVATED,
  M4_BORROWED_SHADOW_STATE_EMPTY,
  M4_BORROWED_SHADOW_STATE_ESCALATED,
  M4_BORROWED_SHADOW_STATE_FAILED,
  M4_BORROWED_SHADOW_STATE_RESOLVED,
  M4_BORROWED_SHADOW_STATE_TRACE,
  M4_BORROWED_SHADOW_TERMINAL_ABORTED,
  M4_BORROWED_SHADOW_TERMINAL_CONTAINED,
  M4_BORROWED_SHADOW_TERMINAL_HARM,
  M4_BORROWED_SHADOW_TERMINAL_NEGOTIATED,
  M4_BORROWED_SHADOW_TERMINAL_NONE,
  M4_BORROWED_SHADOW_TRACE_ACTIVATION,
  M4_BORROWED_SHADOW_TRACE_ESCALATION,
  M4_BORROWED_SHADOW_TRACE_FAILURE,
  M4_BORROWED_SHADOW_TRACE_LOW_RISK_EVIDENCE,
  M4_BORROWED_SHADOW_TRACE_RESOLUTION,
  type M4BorrowedShadowActivateInput,
  type M4BorrowedShadowActivationBasis,
  type M4BorrowedShadowCandidateQuery,
  type M4BorrowedShadowCandidateQueryResult,
  type M4BorrowedShadowCandidateView,
  type M4BorrowedShadowCrisisView,
  type M4BorrowedShadowFailureInput,
  type M4BorrowedShadowMetrics,
  type M4BorrowedShadowMutationResult,
  type M4BorrowedShadowReason,
  type M4BorrowedShadowResolutionInput,
  type M4BorrowedShadowStoreOptions,
  type M4BorrowedShadowTraceInput,
  type M4BorrowedShadowTraceView,
} from "./m4-borrowed-shadow-types";
import { M4_EVIDENCE_TIER_CONFIRMED } from "./m4-chronicle-types";

export class M4BorrowedShadowCrisisStore {
  readonly candidateCapacity: number;
  readonly crisisCapacity: number;
  readonly traceCapacity: number;

  private readonly candidateActive: Uint8Array;
  private readonly candidateTargets: Uint32Array;
  private readonly candidateLamps: Uint32Array;
  private readonly candidateCases: Uint32Array;
  private readonly candidateHypotheses: Uint32Array;
  private readonly lampGapScores: Uint32Array;
  private readonly humanClaims: Uint32Array;
  private readonly lampGapSourceVersions: Uint32Array;
  private readonly lampGapIndexVersions: Uint32Array;
  private readonly identitySupportTiers: Uint16Array;
  private readonly identitySupportScores: Uint32Array;
  private readonly identityClassCounts: Uint8Array;
  private readonly identityConfirmed: Uint8Array;
  private readonly evidenceOwnerVersions: Uint32Array;
  private readonly obligationOwnerVersions: Uint32Array;
  private readonly obligationDuePressures: Uint32Array;
  private readonly townRuleOwnerVersions: Uint32Array;
  private readonly nightWatchPolicyKnown: Uint8Array;
  private readonly candidateVersions: Uint32Array;
  private readonly candidateNext: Int32Array;
  private readonly candidatePrevious: Int32Array;
  private candidateHead = -1;

  private readonly crisisRegistered: Uint8Array;
  private readonly crisisStates: Uint8Array;
  private readonly crisisTargets: Uint32Array;
  private readonly crisisLamps: Uint32Array;
  private readonly crisisCases: Uint32Array;
  private readonly crisisHypotheses: Uint32Array;
  private readonly crisisLampGapSourceVersions: Uint32Array;
  private readonly crisisLampGapIndexVersions: Uint32Array;
  private readonly crisisEvidenceOwnerVersions: Uint32Array;
  private readonly crisisObligationOwnerVersions: Uint32Array;
  private readonly crisisTownRuleOwnerVersions: Uint32Array;
  private readonly activationTicks: Uint32Array;
  private readonly crisisTraceTicks: Uint32Array;
  private readonly escalationTicks: Uint32Array;
  private readonly terminalTicks: Uint32Array;
  private readonly lowRiskEvidenceCounts: Uint16Array;
  private readonly escalationLevels: Uint8Array;
  private readonly resolutionMethods: Uint8Array;
  private readonly terminalReasons: Uint8Array;
  private readonly crisisVersions: Uint32Array;

  private readonly traceSequences: Uint32Array;
  private readonly traceCrisisIds: Uint32Array;
  private readonly traceEventKinds: Uint8Array;
  private readonly traceEvidenceKinds: Uint8Array;
  private readonly traceTicks: Uint32Array;
  private readonly traceStates: Uint8Array;
  private readonly traceTerminalReasons: Uint8Array;
  private readonly traceOwnerVersions: Uint32Array;
  private readonly traceReasonCodes: Uint8Array;
  private traceCursor = 0;
  private traceStored = 0;
  private nextTraceSequence = 1;

  private ownerVersionValue = 0;
  private activeCandidateCountValue = 0;
  private activeCrisisCountValue = 0;
  private resolvedCrisisCountValue = 0;
  private failedCrisisCountValue = 0;
  private lowRiskEvidenceTotal = 0;
  private lastCandidateVisits = 0;
  private totalCandidateVisits = 0;

  constructor(options: M4BorrowedShadowStoreOptions) {
    this.candidateCapacity = requirePositive(options.candidateCapacity, "candidate capacity");
    this.crisisCapacity = requirePositive(options.crisisCapacity, "crisis capacity");
    this.traceCapacity = requirePositive(options.traceCapacity, "trace capacity");
    this.candidateActive = new Uint8Array(this.candidateCapacity);
    this.candidateTargets = filledUint32(this.candidateCapacity);
    this.candidateLamps = filledUint32(this.candidateCapacity);
    this.candidateCases = filledUint32(this.candidateCapacity);
    this.candidateHypotheses = filledUint32(this.candidateCapacity);
    this.lampGapScores = new Uint32Array(this.candidateCapacity);
    this.humanClaims = new Uint32Array(this.candidateCapacity);
    this.lampGapSourceVersions = new Uint32Array(this.candidateCapacity);
    this.lampGapIndexVersions = new Uint32Array(this.candidateCapacity);
    this.identitySupportTiers = new Uint16Array(this.candidateCapacity);
    this.identitySupportScores = new Uint32Array(this.candidateCapacity);
    this.identityClassCounts = new Uint8Array(this.candidateCapacity);
    this.identityConfirmed = new Uint8Array(this.candidateCapacity);
    this.evidenceOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.obligationOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.obligationDuePressures = new Uint32Array(this.candidateCapacity);
    this.townRuleOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.nightWatchPolicyKnown = new Uint8Array(this.candidateCapacity);
    this.candidateVersions = new Uint32Array(this.candidateCapacity);
    this.candidateNext = filledInt32(this.candidateCapacity);
    this.candidatePrevious = filledInt32(this.candidateCapacity);
    this.crisisRegistered = new Uint8Array(this.crisisCapacity);
    this.crisisStates = new Uint8Array(this.crisisCapacity);
    this.crisisTargets = filledUint32(this.crisisCapacity);
    this.crisisLamps = filledUint32(this.crisisCapacity);
    this.crisisCases = filledUint32(this.crisisCapacity);
    this.crisisHypotheses = filledUint32(this.crisisCapacity);
    this.crisisLampGapSourceVersions = new Uint32Array(this.crisisCapacity);
    this.crisisLampGapIndexVersions = new Uint32Array(this.crisisCapacity);
    this.crisisEvidenceOwnerVersions = new Uint32Array(this.crisisCapacity);
    this.crisisObligationOwnerVersions = new Uint32Array(this.crisisCapacity);
    this.crisisTownRuleOwnerVersions = new Uint32Array(this.crisisCapacity);
    this.activationTicks = filledUint32(this.crisisCapacity);
    this.crisisTraceTicks = filledUint32(this.crisisCapacity);
    this.escalationTicks = filledUint32(this.crisisCapacity);
    this.terminalTicks = filledUint32(this.crisisCapacity);
    this.lowRiskEvidenceCounts = new Uint16Array(this.crisisCapacity);
    this.escalationLevels = new Uint8Array(this.crisisCapacity);
    this.resolutionMethods = new Uint8Array(this.crisisCapacity);
    this.terminalReasons = new Uint8Array(this.crisisCapacity);
    this.crisisVersions = new Uint32Array(this.crisisCapacity);
    this.traceSequences = new Uint32Array(this.traceCapacity);
    this.traceCrisisIds = filledUint32(this.traceCapacity);
    this.traceEventKinds = new Uint8Array(this.traceCapacity);
    this.traceEvidenceKinds = new Uint8Array(this.traceCapacity);
    this.traceTicks = filledUint32(this.traceCapacity);
    this.traceStates = new Uint8Array(this.traceCapacity);
    this.traceTerminalReasons = new Uint8Array(this.traceCapacity);
    this.traceOwnerVersions = new Uint32Array(this.traceCapacity);
    this.traceReasonCodes = new Uint8Array(this.traceCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  registerActivationCandidate(
    input: M4BorrowedShadowActivationBasis,
  ): M4BorrowedShadowMutationResult {
    const valid = this.validateCandidate(input);
    if (!valid.ok) return valid;
    if ((this.candidateActive[input.candidateId] ?? 0) === 1) {
      return { ok: false, reason: "borrowed_shadow_candidate_already_registered" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.writeCandidate(input, nextVersion.ownerVersion);
    this.linkCandidate(input.candidateId);
    this.activeCandidateCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "borrowed_shadow_activation_candidates_indexed",
    };
  }

  queryActivationCandidates(
    query: M4BorrowedShadowCandidateQuery,
    outputCandidateIds: Uint32Array,
  ): M4BorrowedShadowCandidateQueryResult {
    const valid = validateCandidateQuery(query, outputCandidateIds);
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
      if ((this.lampGapScores[current] ?? 0) >= query.minLampGapScore) {
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

  activateCandidate(input: M4BorrowedShadowActivateInput): M4BorrowedShadowMutationResult {
    if (!isIndex(input.candidateId, this.candidateCapacity)) {
      return { ok: false, reason: "borrowed_shadow_candidate_id_out_of_range" };
    }
    if (!isIndex(input.crisisId, this.crisisCapacity)) {
      return { ok: false, reason: "borrowed_shadow_crisis_id_out_of_range" };
    }
    if ((this.candidateActive[input.candidateId] ?? 0) === 0) {
      return { ok: false, reason: "borrowed_shadow_candidate_not_registered" };
    }
    if ((this.crisisRegistered[input.crisisId] ?? 0) === 1) {
      return { ok: false, reason: "borrowed_shadow_crisis_already_registered" };
    }
    if (!isUint32(input.tick)) return { ok: false, reason: "borrowed_shadow_value_out_of_range" };
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
      M4_BORROWED_SHADOW_TRACE_ACTIVATION,
      M4_BORROWED_SHADOW_EVIDENCE_NONE,
      input.tick,
      "borrowed_shadow_activated",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "borrowed_shadow_activated",
    };
  }

  recordLowRiskEvidence(input: M4BorrowedShadowTraceInput): M4BorrowedShadowMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if (!isSmallEvidence(input.evidenceKind))
      return { ok: false, reason: "borrowed_shadow_value_out_of_range" };
    const state = this.crisisStates[input.crisisId] ?? M4_BORROWED_SHADOW_STATE_EMPTY;
    if (state !== M4_BORROWED_SHADOW_STATE_ACTIVATED && state !== M4_BORROWED_SHADOW_STATE_TRACE) {
      return { ok: false, reason: "borrowed_shadow_terminal_state" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.crisisStates[input.crisisId] = M4_BORROWED_SHADOW_STATE_TRACE;
    this.crisisTraceTicks[input.crisisId] = input.tick;
    this.lowRiskEvidenceCounts[input.crisisId] =
      (this.lowRiskEvidenceCounts[input.crisisId] ?? 0) + 1;
    this.lowRiskEvidenceTotal += 1;
    this.crisisVersions[input.crisisId] = nextVersion.ownerVersion;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      input.crisisId,
      M4_BORROWED_SHADOW_TRACE_LOW_RISK_EVIDENCE,
      input.evidenceKind,
      input.tick,
      "borrowed_shadow_low_risk_evidence_recorded",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "borrowed_shadow_low_risk_evidence_recorded",
    };
  }

  escalateCrisis(crisisId: number, tick: number): M4BorrowedShadowMutationResult {
    const valid = this.validateOpenCrisis(crisisId, tick);
    if (!valid.ok) return valid;
    if ((this.lowRiskEvidenceCounts[crisisId] ?? 0) === 0) {
      return { ok: false, reason: "borrowed_shadow_escalation_requires_evidence" };
    }
    const state = this.crisisStates[crisisId] ?? M4_BORROWED_SHADOW_STATE_EMPTY;
    if (state !== M4_BORROWED_SHADOW_STATE_TRACE) {
      return { ok: false, reason: "borrowed_shadow_terminal_state" };
    }
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.crisisStates[crisisId] = M4_BORROWED_SHADOW_STATE_ESCALATED;
    this.escalationTicks[crisisId] = tick;
    this.escalationLevels[crisisId] = (this.escalationLevels[crisisId] ?? 0) + 1;
    this.crisisVersions[crisisId] = nextVersion.ownerVersion;
    this.ownerVersionValue = nextVersion.ownerVersion;
    this.recordTrace(
      crisisId,
      M4_BORROWED_SHADOW_TRACE_ESCALATION,
      M4_BORROWED_SHADOW_EVIDENCE_NONE,
      tick,
      "borrowed_shadow_escalated",
    );
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "borrowed_shadow_escalated",
    };
  }

  resolveCrisis(input: M4BorrowedShadowResolutionInput): M4BorrowedShadowMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if (
      (this.crisisStates[input.crisisId] ?? M4_BORROWED_SHADOW_STATE_EMPTY) !==
      M4_BORROWED_SHADOW_STATE_ESCALATED
    ) {
      return { ok: false, reason: "borrowed_shadow_resolution_requirements_unmet" };
    }
    const reason = resolutionReason(input);
    if (reason === undefined)
      return { ok: false, reason: "borrowed_shadow_resolution_requirements_unmet" };
    return this.finishCrisis(
      input.crisisId,
      input.tick,
      input.method,
      reason.terminal,
      reason.reason,
    );
  }

  failCrisis(input: M4BorrowedShadowFailureInput): M4BorrowedShadowMutationResult {
    const valid = this.validateOpenCrisis(input.crisisId, input.tick);
    if (!valid.ok) return valid;
    if (
      input.terminalReason !== M4_BORROWED_SHADOW_TERMINAL_HARM &&
      input.terminalReason !== M4_BORROWED_SHADOW_TERMINAL_ABORTED
    ) {
      return { ok: false, reason: "borrowed_shadow_value_out_of_range" };
    }
    if (
      input.terminalReason === M4_BORROWED_SHADOW_TERMINAL_HARM &&
      (this.crisisStates[input.crisisId] ?? M4_BORROWED_SHADOW_STATE_EMPTY) !==
        M4_BORROWED_SHADOW_STATE_ESCALATED
    ) {
      return { ok: false, reason: "borrowed_shadow_escalation_requires_evidence" };
    }
    return this.finishCrisis(
      input.crisisId,
      input.tick,
      0,
      input.terminalReason,
      "borrowed_shadow_failed",
    );
  }

  readCandidate(candidateId: number): M4BorrowedShadowCandidateView | undefined {
    if (
      !isIndex(candidateId, this.candidateCapacity) ||
      (this.candidateActive[candidateId] ?? 0) === 0
    )
      return undefined;
    return this.createCandidateView(candidateId);
  }

  readCrisis(crisisId: number): M4BorrowedShadowCrisisView | undefined {
    if (!isIndex(crisisId, this.crisisCapacity) || (this.crisisRegistered[crisisId] ?? 0) === 0)
      return undefined;
    return {
      crisisId,
      state: this.crisisStates[crisisId] ?? 0,
      targetActorId: this.crisisTargets[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      lampId: this.crisisLamps[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      caseId: this.crisisCases[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      hypothesisId: this.crisisHypotheses[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      lampGapSourceVersion: this.crisisLampGapSourceVersions[crisisId] ?? 0,
      lampGapIndexVersion: this.crisisLampGapIndexVersions[crisisId] ?? 0,
      evidenceOwnerVersion: this.crisisEvidenceOwnerVersions[crisisId] ?? 0,
      obligationOwnerVersion: this.crisisObligationOwnerVersions[crisisId] ?? 0,
      townRuleOwnerVersion: this.crisisTownRuleOwnerVersions[crisisId] ?? 0,
      activationTick: this.activationTicks[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      traceTick: this.crisisTraceTicks[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      escalationTick: this.escalationTicks[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      terminalTick: this.terminalTicks[crisisId] ?? M4_BORROWED_SHADOW_NONE,
      lowRiskEvidenceCount: this.lowRiskEvidenceCounts[crisisId] ?? 0,
      escalationLevel: this.escalationLevels[crisisId] ?? 0,
      resolutionMethod: this.resolutionMethods[crisisId] ?? 0,
      terminalReason: this.terminalReasons[crisisId] ?? 0,
      crisisVersion: this.crisisVersions[crisisId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readTrace(ageFromNewest: number): M4BorrowedShadowTraceView | undefined {
    if (!isIndex(ageFromNewest, this.traceStored)) return undefined;
    const slot = (this.traceCursor + this.traceCapacity - 1 - ageFromNewest) % this.traceCapacity;
    return {
      sequence: this.traceSequences[slot] ?? 0,
      crisisId: this.traceCrisisIds[slot] ?? M4_BORROWED_SHADOW_NONE,
      eventKind: this.traceEventKinds[slot] ?? 0,
      evidenceKind: this.traceEvidenceKinds[slot] ?? 0,
      tick: this.traceTicks[slot] ?? M4_BORROWED_SHADOW_NONE,
      crisisState: this.traceStates[slot] ?? 0,
      terminalReason: this.traceTerminalReasons[slot] ?? 0,
      ownerVersion: this.traceOwnerVersions[slot] ?? 0,
      reason: decodeReason(this.traceReasonCodes[slot] ?? 0),
    };
  }

  createMetrics(): M4BorrowedShadowMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      activeCandidateCount: this.activeCandidateCountValue,
      activeCrisisCount: this.activeCrisisCountValue,
      resolvedCrisisCount: this.resolvedCrisisCountValue,
      failedCrisisCount: this.failedCrisisCountValue,
      lowRiskEvidenceCount: this.lowRiskEvidenceTotal,
      lastCandidateVisits: this.lastCandidateVisits,
      totalCandidateVisits: this.totalCandidateVisits,
      traceStoredCount: this.traceStored,
      nextTraceSequence: this.nextTraceSequence,
    };
  }

  private finishCrisis(
    crisisId: number,
    tick: number,
    method: number,
    terminal: number,
    reason: M4BorrowedShadowReason,
  ): M4BorrowedShadowMutationResult {
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    const resolved =
      terminal === M4_BORROWED_SHADOW_TERMINAL_CONTAINED ||
      terminal === M4_BORROWED_SHADOW_TERMINAL_NEGOTIATED;
    this.crisisStates[crisisId] = resolved
      ? M4_BORROWED_SHADOW_STATE_RESOLVED
      : M4_BORROWED_SHADOW_STATE_FAILED;
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
      resolved ? M4_BORROWED_SHADOW_TRACE_RESOLUTION : M4_BORROWED_SHADOW_TRACE_FAILURE,
      M4_BORROWED_SHADOW_EVIDENCE_NONE,
      tick,
      reason,
    );
    return { ok: true, changed: true, ownerVersion: this.ownerVersionValue, reason };
  }

  private validateCandidate(
    input: M4BorrowedShadowActivationBasis,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4BorrowedShadowReason } {
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "borrowed_shadow_candidate_id_out_of_range" };
    if (
      !isUint32(input.targetActorId) ||
      !isUint32(input.lampId) ||
      !isUint32(input.identityCaseId) ||
      !isUint32(input.identityHypothesisId)
    )
      return { ok: false, reason: "borrowed_shadow_value_out_of_range" };
    if (
      input.lampGapSourceVersion === 0 ||
      input.lampGapIndexVersion === 0 ||
      input.evidenceOwnerVersion === 0
    )
      return { ok: false, reason: "borrowed_shadow_basis_version_invalid" };
    if (
      !isUint32(input.lampGapSourceVersion) ||
      !isUint32(input.lampGapIndexVersion) ||
      !isUint32(input.evidenceOwnerVersion)
    )
      return { ok: false, reason: "borrowed_shadow_basis_version_invalid" };
    return isScore(input.lampGapScore) &&
      isScore(input.humanClaim) &&
      isEvidenceSupportTier(input.identitySupportTier) &&
      isScore(input.identitySupportScore) &&
      isIdentityClassCount(input.identityIndependentClassCount) &&
      isFlag(input.identityConfirmed) &&
      isUint32(input.obligationOwnerVersion) &&
      isScore(input.obligationDuePressure) &&
      isUint32(input.townRuleOwnerVersion) &&
      isFlag(input.nightWatchPolicyKnown)
      ? { ok: true }
      : { ok: false, reason: "borrowed_shadow_value_out_of_range" };
  }

  private validateOpenCrisis(
    crisisId: number,
    tick: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4BorrowedShadowReason } {
    if (!isIndex(crisisId, this.crisisCapacity))
      return { ok: false, reason: "borrowed_shadow_crisis_id_out_of_range" };
    if ((this.crisisRegistered[crisisId] ?? 0) === 0)
      return { ok: false, reason: "borrowed_shadow_crisis_not_registered" };
    if (!isUint32(tick)) return { ok: false, reason: "borrowed_shadow_value_out_of_range" };
    const state = this.crisisStates[crisisId] ?? 0;
    return state === M4_BORROWED_SHADOW_STATE_RESOLVED || state === M4_BORROWED_SHADOW_STATE_FAILED
      ? { ok: false, reason: "borrowed_shadow_terminal_state" }
      : { ok: true };
  }

  private readActivationPrevention(candidateId: number): M4BorrowedShadowReason | undefined {
    if ((this.lampGapScores[candidateId] ?? 0) < M4_BORROWED_SHADOW_MIN_GAP_SCORE)
      return "borrowed_shadow_activation_prevented_lamp_gap";
    return (this.identityConfirmed[candidateId] ?? 0) === 1
      ? "borrowed_shadow_activation_prevented_identity_confirmed"
      : undefined;
  }

  private writeCandidate(input: M4BorrowedShadowActivationBasis, version: number): void {
    this.candidateActive[input.candidateId] = 1;
    this.candidateTargets[input.candidateId] = input.targetActorId;
    this.candidateLamps[input.candidateId] = input.lampId;
    this.candidateCases[input.candidateId] = input.identityCaseId;
    this.candidateHypotheses[input.candidateId] = input.identityHypothesisId;
    this.lampGapScores[input.candidateId] = input.lampGapScore;
    this.humanClaims[input.candidateId] = input.humanClaim;
    this.lampGapSourceVersions[input.candidateId] = input.lampGapSourceVersion;
    this.lampGapIndexVersions[input.candidateId] = input.lampGapIndexVersion;
    this.identitySupportTiers[input.candidateId] = input.identitySupportTier;
    this.identitySupportScores[input.candidateId] = input.identitySupportScore;
    this.identityClassCounts[input.candidateId] = input.identityIndependentClassCount;
    this.identityConfirmed[input.candidateId] = input.identityConfirmed;
    this.evidenceOwnerVersions[input.candidateId] = input.evidenceOwnerVersion;
    this.obligationOwnerVersions[input.candidateId] = input.obligationOwnerVersion;
    this.obligationDuePressures[input.candidateId] = input.obligationDuePressure;
    this.townRuleOwnerVersions[input.candidateId] = input.townRuleOwnerVersion;
    this.nightWatchPolicyKnown[input.candidateId] = input.nightWatchPolicyKnown;
    this.candidateVersions[input.candidateId] = version;
  }

  private createCandidateView(candidateId: number): M4BorrowedShadowCandidateView {
    return {
      candidateId,
      targetActorId: this.candidateTargets[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      lampId: this.candidateLamps[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      lampGapScore: this.lampGapScores[candidateId] ?? 0,
      humanClaim: this.humanClaims[candidateId] ?? 0,
      lampGapSourceVersion: this.lampGapSourceVersions[candidateId] ?? 0,
      lampGapIndexVersion: this.lampGapIndexVersions[candidateId] ?? 0,
      identityCaseId: this.candidateCases[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      identityHypothesisId: this.candidateHypotheses[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      identitySupportTier: this.identitySupportTiers[candidateId] ?? 0,
      identitySupportScore: this.identitySupportScores[candidateId] ?? 0,
      identityIndependentClassCount: this.identityClassCounts[candidateId] ?? 0,
      identityConfirmed: this.identityConfirmed[candidateId] ?? 0,
      evidenceOwnerVersion: this.evidenceOwnerVersions[candidateId] ?? 0,
      obligationOwnerVersion: this.obligationOwnerVersions[candidateId] ?? 0,
      obligationDuePressure: this.obligationDuePressures[candidateId] ?? 0,
      townRuleOwnerVersion: this.townRuleOwnerVersions[candidateId] ?? 0,
      nightWatchPolicyKnown: this.nightWatchPolicyKnown[candidateId] ?? 0,
      candidateVersion: this.candidateVersions[candidateId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  private writeActivatedCrisis(input: M4BorrowedShadowActivateInput, version: number): void {
    this.crisisRegistered[input.crisisId] = 1;
    this.crisisStates[input.crisisId] = M4_BORROWED_SHADOW_STATE_ACTIVATED;
    this.crisisTargets[input.crisisId] =
      this.candidateTargets[input.candidateId] ?? M4_BORROWED_SHADOW_NONE;
    this.crisisLamps[input.crisisId] =
      this.candidateLamps[input.candidateId] ?? M4_BORROWED_SHADOW_NONE;
    this.crisisCases[input.crisisId] =
      this.candidateCases[input.candidateId] ?? M4_BORROWED_SHADOW_NONE;
    this.crisisHypotheses[input.crisisId] =
      this.candidateHypotheses[input.candidateId] ?? M4_BORROWED_SHADOW_NONE;
    this.crisisLampGapSourceVersions[input.crisisId] =
      this.lampGapSourceVersions[input.candidateId] ?? 0;
    this.crisisLampGapIndexVersions[input.crisisId] =
      this.lampGapIndexVersions[input.candidateId] ?? 0;
    this.crisisEvidenceOwnerVersions[input.crisisId] =
      this.evidenceOwnerVersions[input.candidateId] ?? 0;
    this.crisisObligationOwnerVersions[input.crisisId] =
      this.obligationOwnerVersions[input.candidateId] ?? 0;
    this.crisisTownRuleOwnerVersions[input.crisisId] =
      this.townRuleOwnerVersions[input.candidateId] ?? 0;
    this.activationTicks[input.crisisId] = input.tick;
    this.terminalReasons[input.crisisId] = M4_BORROWED_SHADOW_TERMINAL_NONE;
    this.crisisVersions[input.crisisId] = version;
  }

  private linkCandidate(candidateId: number): void {
    let current = this.candidateHead;
    let previous = -1;
    const score = this.lampGapScores[candidateId] ?? 0;
    while (current >= 0 && candidateBefore(current, candidateId, score, this.lampGapScores)) {
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
    reason: M4BorrowedShadowReason,
  ): void {
    const slot = this.traceCursor;
    this.traceSequences[slot] = this.nextTraceSequence;
    this.traceCrisisIds[slot] = crisisId;
    this.traceEventKinds[slot] = eventKind;
    this.traceEvidenceKinds[slot] = evidenceKind;
    this.traceTicks[slot] = tick;
    this.traceStates[slot] = this.crisisStates[crisisId] ?? 0;
    this.traceTerminalReasons[slot] = this.terminalReasons[crisisId] ?? 0;
    this.traceOwnerVersions[slot] = this.ownerVersionValue;
    this.traceReasonCodes[slot] = encodeReason(reason);
    this.traceCursor = (this.traceCursor + 1) % this.traceCapacity;
    this.traceStored = Math.min(this.traceCapacity, this.traceStored + 1);
    this.nextTraceSequence += 1;
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "borrowed_shadow_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "borrowed_shadow_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }
}

export function createM4BorrowedShadowCrisisStore(
  options: M4BorrowedShadowStoreOptions,
): M4BorrowedShadowCrisisStore {
  return new M4BorrowedShadowCrisisStore(options);
}

function resolutionReason(
  input: M4BorrowedShadowResolutionInput,
): { readonly terminal: number; readonly reason: M4BorrowedShadowReason } | undefined {
  if (
    input.method === M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT &&
    input.lampGapClosed === 1 &&
    input.identityConfirmed === 1 &&
    input.containmentScore >= M4_BORROWED_SHADOW_MIN_CONTAINMENT
  ) {
    return {
      terminal: M4_BORROWED_SHADOW_TERMINAL_CONTAINED,
      reason: "borrowed_shadow_resolved_contained",
    };
  }
  if (
    input.method === M4_BORROWED_SHADOW_RESOLUTION_NEGOTIATION &&
    input.identityConfirmed === 1 &&
    input.negotiationScore >= M4_BORROWED_SHADOW_MIN_NEGOTIATION
  ) {
    return {
      terminal: M4_BORROWED_SHADOW_TERMINAL_NEGOTIATED,
      reason: "borrowed_shadow_resolved_negotiated",
    };
  }
  return undefined;
}

function validateCandidateQuery(
  query: M4BorrowedShadowCandidateQuery,
  output: Uint32Array,
): { readonly ok: true } | { readonly ok: false; readonly reason: M4BorrowedShadowReason } {
  if (!isPositive(query.candidateCap))
    return { ok: false, reason: "borrowed_shadow_candidate_cap_invalid" };
  if (!isPositive(query.selectedCap))
    return { ok: false, reason: "borrowed_shadow_selected_cap_invalid" };
  if (output.length < query.selectedCap)
    return { ok: false, reason: "borrowed_shadow_output_too_small" };
  return isScore(query.minLampGapScore)
    ? { ok: true }
    : { ok: false, reason: "borrowed_shadow_value_out_of_range" };
}

function candidateReason(
  selected: number,
  candidateCapHit: boolean,
  selectedCapHit: boolean,
): M4BorrowedShadowReason {
  if (candidateCapHit) return "borrowed_shadow_activation_candidate_cap_reached";
  if (selectedCapHit) return "borrowed_shadow_activation_selected_cap_reached";
  return selected === 0
    ? "borrowed_shadow_activation_no_candidate"
    : "borrowed_shadow_activation_candidates_indexed";
}

function candidateBefore(
  current: number,
  next: number,
  nextScore: number,
  scores: Uint32Array,
): boolean {
  const currentScore = scores[current] ?? 0;
  return currentScore !== nextScore ? currentScore > nextScore : current < next;
}

function isSmallEvidence(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 4;
}

function isScore(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

function isFlag(value: number): boolean {
  return value === 0 || value === 1;
}

function isEvidenceSupportTier(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= M4_EVIDENCE_TIER_CONFIRMED;
}

function isIdentityClassCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 4;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function requirePositive(value: number, label: string): number {
  if (!isPositive(value)) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M4_BORROWED_SHADOW_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M4_BORROWED_SHADOW_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}

function encodeReason(reason: M4BorrowedShadowReason): number {
  if (reason === "borrowed_shadow_low_risk_evidence_recorded") return 1;
  if (reason === "borrowed_shadow_escalated") return 2;
  if (reason === "borrowed_shadow_resolved_contained") return 3;
  if (reason === "borrowed_shadow_resolved_negotiated") return 4;
  if (reason === "borrowed_shadow_failed") return 5;
  return 0;
}

function decodeReason(code: number): M4BorrowedShadowReason {
  if (code === 1) return "borrowed_shadow_low_risk_evidence_recorded";
  if (code === 2) return "borrowed_shadow_escalated";
  if (code === 3) return "borrowed_shadow_resolved_contained";
  if (code === 4) return "borrowed_shadow_resolved_negotiated";
  if (code === 5) return "borrowed_shadow_failed";
  return "borrowed_shadow_activated";
}
