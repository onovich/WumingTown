import {
  M4_CHRONICLE_CHANGE_CONTRADICTION_ADDED,
  M4_CHRONICLE_CHANGE_CONTRADICTION_RESOLVED,
  M4_CHRONICLE_CHANGE_EVIDENCE_ADDED,
  M4_CHRONICLE_CHANGE_HYPOTHESIS_ADDED,
  M4_CHRONICLE_CHANGE_RULE_CONFIRMED,
  M4_CHRONICLE_CHANGE_SOURCE_ADDED,
  M4_CHRONICLE_NONE,
  M4_CONTRADICTION_SEVERITY_FATAL,
  isContradictionSeverity,
  isEvidenceClass,
  isEvidenceSourceKind,
  isIndexInRange,
  isPositiveSafeInteger,
  isUint32,
  requirePositiveSafeInteger,
  type M4ChronicleReason,
  type M4ChronicleChangeKind,
  type M4ChronicleVersionRecorder,
  type M4EvidenceSupportTier,
} from "./m4-chronicle-types";
import {
  type M4EvidenceReasonTraceStore,
  type M4EvidenceTraceReason,
} from "./m4-chronicle-reason-trace";
import {
  calculateEvidenceScore,
  classMaskFor,
  countBits4,
  evidenceBefore,
  filledInt32,
  filledUint32,
  isQuality,
  supportTraceReason,
  tierForScore,
} from "./m4-evidence-support";
import type {
  M4EvidenceConfirmRuleResult,
  M4EvidenceContradictionInput,
  M4EvidenceFactStoreOptions,
  M4EvidenceHypothesisInput,
  M4EvidenceMetrics,
  M4EvidenceMutationResult,
  M4EvidenceRowInput,
  M4EvidenceSourceInput,
  M4EvidenceSupportResult,
} from "./m4-evidence-types";
type M4EvidenceConfirmationFailure = Extract<
  M4ChronicleReason,
  | "evidence_support_below_threshold"
  | "evidence_independent_class_insufficient"
  | "evidence_fatal_contradiction_unresolved"
>;
interface M4EvidenceSupportComputation {
  readonly caseId: number;
  readonly hypothesisId: number;
  readonly supportScore: number;
  readonly supportTier: M4EvidenceSupportTier;
  readonly independentClassCount: number;
  readonly independentClassMask: number;
  readonly candidateCount: number;
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly candidateCapHit: boolean;
  readonly selectedCapHit: boolean;
  readonly fatalUnresolvedContradictionCount: number;
}
export class M4EvidenceFactStore {
  readonly caseCapacity: number;
  readonly sourceCapacity: number;
  readonly evidenceCapacity: number;
  readonly hypothesisCapacity: number;
  readonly contradictionCapacity: number;
  readonly confirmedRuleCapacity: number;
  private readonly sourceActive: Uint8Array;
  private readonly sourceCaseIds: Uint32Array;
  private readonly sourceKinds: Uint8Array;
  private readonly sourceReliabilities: Uint32Array;
  private readonly sourceConflicts: Uint32Array;
  private readonly evidenceActive: Uint8Array;
  private readonly evidenceCaseIds: Uint32Array;
  private readonly evidenceHypothesisIds: Uint32Array;
  private readonly evidenceSourceIds: Uint32Array;
  private readonly evidenceClasses: Uint8Array;
  private readonly evidenceScores: Uint32Array;
  private readonly evidenceIndependenceKeys: Uint32Array;
  private readonly nextEvidenceByHypothesis: Int32Array;
  private readonly previousEvidenceByHypothesis: Int32Array;
  private readonly hypothesisActive: Uint8Array;
  private readonly hypothesisCaseIds: Uint32Array;
  private readonly hypothesisRuleSubjectIds: Uint32Array;
  private readonly hypothesisRequiredSupports: Uint32Array;
  private readonly hypothesisRequiredClassCounts: Uint8Array;
  private readonly hypothesisEvidenceHeads: Int32Array;
  private readonly hypothesisEvidenceCounts: Uint32Array;
  private readonly fatalContradictionCounts: Uint32Array;
  private readonly contradictionActive: Uint8Array;
  private readonly contradictionHypothesisIds: Uint32Array;
  private readonly contradictionSeverities: Uint8Array;
  private readonly contradictionResolved: Uint8Array;
  private readonly confirmedActive: Uint8Array;
  private readonly confirmedHypothesisIds: Uint32Array;
  private readonly confirmedSupportScores: Uint32Array;
  private readonly confirmedIndependentClassCounts: Uint8Array;
  private ownerVersionValue = 0;
  private sourceCountValue = 0;
  private evidenceCountValue = 0;
  private hypothesisCountValue = 0;
  private contradictionCountValue = 0;
  private confirmedCountValue = 0;
  private lastSupportVisits = 0;
  private totalSupportVisits = 0;
  constructor(options: M4EvidenceFactStoreOptions) {
    this.caseCapacity = requirePositiveSafeInteger(options.caseCapacity, "evidence case capacity");
    this.sourceCapacity = requirePositiveSafeInteger(
      options.sourceCapacity,
      "evidence source capacity",
    );
    this.evidenceCapacity = requirePositiveSafeInteger(
      options.evidenceCapacity,
      "evidence row capacity",
    );
    this.hypothesisCapacity = requirePositiveSafeInteger(
      options.hypothesisCapacity,
      "evidence hypothesis capacity",
    );
    this.contradictionCapacity = requirePositiveSafeInteger(
      options.contradictionCapacity,
      "evidence contradiction capacity",
    );
    this.confirmedRuleCapacity = requirePositiveSafeInteger(
      options.confirmedRuleCapacity,
      "confirmed rule capacity",
    );
    this.sourceActive = new Uint8Array(this.sourceCapacity);
    this.sourceCaseIds = filledUint32(this.sourceCapacity);
    this.sourceKinds = new Uint8Array(this.sourceCapacity);
    this.sourceReliabilities = new Uint32Array(this.sourceCapacity);
    this.sourceConflicts = new Uint32Array(this.sourceCapacity);
    this.evidenceActive = new Uint8Array(this.evidenceCapacity);
    this.evidenceCaseIds = filledUint32(this.evidenceCapacity);
    this.evidenceHypothesisIds = filledUint32(this.evidenceCapacity);
    this.evidenceSourceIds = filledUint32(this.evidenceCapacity);
    this.evidenceClasses = new Uint8Array(this.evidenceCapacity);
    this.evidenceScores = new Uint32Array(this.evidenceCapacity);
    this.evidenceIndependenceKeys = new Uint32Array(this.evidenceCapacity);
    this.nextEvidenceByHypothesis = filledInt32(this.evidenceCapacity);
    this.previousEvidenceByHypothesis = filledInt32(this.evidenceCapacity);
    this.hypothesisActive = new Uint8Array(this.hypothesisCapacity);
    this.hypothesisCaseIds = filledUint32(this.hypothesisCapacity);
    this.hypothesisRuleSubjectIds = filledUint32(this.hypothesisCapacity);
    this.hypothesisRequiredSupports = new Uint32Array(this.hypothesisCapacity);
    this.hypothesisRequiredClassCounts = new Uint8Array(this.hypothesisCapacity);
    this.hypothesisEvidenceHeads = filledInt32(this.hypothesisCapacity);
    this.hypothesisEvidenceCounts = new Uint32Array(this.hypothesisCapacity);
    this.fatalContradictionCounts = new Uint32Array(this.hypothesisCapacity);
    this.contradictionActive = new Uint8Array(this.contradictionCapacity);
    this.contradictionHypothesisIds = filledUint32(this.contradictionCapacity);
    this.contradictionSeverities = new Uint8Array(this.contradictionCapacity);
    this.contradictionResolved = new Uint8Array(this.contradictionCapacity);
    this.confirmedActive = new Uint8Array(this.confirmedRuleCapacity);
    this.confirmedHypothesisIds = filledUint32(this.confirmedRuleCapacity);
    this.confirmedSupportScores = new Uint32Array(this.confirmedRuleCapacity);
    this.confirmedIndependentClassCounts = new Uint8Array(this.confirmedRuleCapacity);
  }
  get ownerVersion(): number {
    return this.ownerVersionValue;
  }
  registerSource(
    input: M4EvidenceSourceInput,
    recorder?: M4ChronicleVersionRecorder,
  ): M4EvidenceMutationResult {
    if (!this.validateSource(input)) {
      return { ok: false, reason: "chronicle_value_out_of_range" };
    }
    if ((this.sourceActive[input.sourceId] ?? 0) === 1) {
      return { ok: false, reason: "evidence_source_already_registered" };
    }
    const mutation = this.beginMutation(
      recorder,
      input.caseId,
      M4_CHRONICLE_CHANGE_SOURCE_ADDED,
      input.sourceId,
      input.tick,
    );
    if (!mutation.ok) {
      return mutation;
    }
    this.sourceActive[input.sourceId] = 1;
    this.sourceCaseIds[input.sourceId] = input.caseId;
    this.sourceKinds[input.sourceId] = input.kind;
    this.sourceReliabilities[input.sourceId] = input.reliability;
    this.sourceConflicts[input.sourceId] = input.conflictOfInterest;
    this.sourceCountValue += 1;
    this.ownerVersionValue = mutation.ownerVersion;
    return { ok: true, changed: true, ownerVersion: mutation.ownerVersion };
  }
  registerHypothesis(
    input: M4EvidenceHypothesisInput,
    recorder?: M4ChronicleVersionRecorder,
  ): M4EvidenceMutationResult {
    if (!this.validateHypothesis(input)) {
      return { ok: false, reason: "chronicle_value_out_of_range" };
    }
    if ((this.hypothesisActive[input.hypothesisId] ?? 0) === 1) {
      return { ok: false, reason: "evidence_hypothesis_already_registered" };
    }
    const mutation = this.beginMutation(
      recorder,
      input.caseId,
      M4_CHRONICLE_CHANGE_HYPOTHESIS_ADDED,
      input.hypothesisId,
      input.tick,
    );
    if (!mutation.ok) {
      return mutation;
    }
    this.hypothesisActive[input.hypothesisId] = 1;
    this.hypothesisCaseIds[input.hypothesisId] = input.caseId;
    this.hypothesisRuleSubjectIds[input.hypothesisId] = input.ruleSubjectId;
    this.hypothesisRequiredSupports[input.hypothesisId] = input.requiredSupport;
    this.hypothesisRequiredClassCounts[input.hypothesisId] = input.requiredIndependentClassCount;
    this.hypothesisCountValue += 1;
    this.ownerVersionValue = mutation.ownerVersion;
    return { ok: true, changed: true, ownerVersion: mutation.ownerVersion };
  }
  registerEvidence(
    input: M4EvidenceRowInput,
    recorder?: M4ChronicleVersionRecorder,
  ): M4EvidenceMutationResult {
    const valid = this.validateEvidence(input);
    if (!valid.ok) {
      return valid;
    }
    if ((this.evidenceActive[input.evidenceId] ?? 0) === 1) {
      return { ok: false, reason: "evidence_row_already_registered" };
    }
    const mutation = this.beginMutation(
      recorder,
      input.caseId,
      M4_CHRONICLE_CHANGE_EVIDENCE_ADDED,
      input.evidenceId,
      input.tick,
    );
    if (!mutation.ok) {
      return mutation;
    }
    this.evidenceActive[input.evidenceId] = 1;
    this.evidenceCaseIds[input.evidenceId] = input.caseId;
    this.evidenceHypothesisIds[input.evidenceId] = input.hypothesisId;
    this.evidenceSourceIds[input.evidenceId] = input.sourceId;
    this.evidenceClasses[input.evidenceId] = input.evidenceClass;
    this.evidenceScores[input.evidenceId] = calculateEvidenceScore(input);
    this.evidenceIndependenceKeys[input.evidenceId] = input.independenceKey;
    this.insertEvidence(input.hypothesisId, input.evidenceId);
    this.evidenceCountValue += 1;
    this.ownerVersionValue = mutation.ownerVersion;
    return { ok: true, changed: true, ownerVersion: mutation.ownerVersion };
  }
  registerContradiction(
    input: M4EvidenceContradictionInput,
    recorder?: M4ChronicleVersionRecorder,
  ): M4EvidenceMutationResult {
    const valid = this.validateContradiction(input);
    if (!valid.ok) {
      return valid;
    }
    if ((this.contradictionActive[input.contradictionId] ?? 0) === 1) {
      return { ok: false, reason: "evidence_contradiction_already_registered" };
    }
    const mutation = this.beginMutation(
      recorder,
      input.caseId,
      M4_CHRONICLE_CHANGE_CONTRADICTION_ADDED,
      input.contradictionId,
      input.tick,
    );
    if (!mutation.ok) {
      return mutation;
    }
    this.contradictionActive[input.contradictionId] = 1;
    this.contradictionHypothesisIds[input.contradictionId] = input.hypothesisId;
    this.contradictionSeverities[input.contradictionId] = input.severity;
    this.contradictionCountValue += 1;
    if (input.severity === M4_CONTRADICTION_SEVERITY_FATAL) {
      this.fatalContradictionCounts[input.hypothesisId] =
        (this.fatalContradictionCounts[input.hypothesisId] ?? 0) + 1;
    }
    this.ownerVersionValue = mutation.ownerVersion;
    return { ok: true, changed: true, ownerVersion: mutation.ownerVersion };
  }
  resolveContradiction(
    contradictionId: number,
    tick: number,
    recorder?: M4ChronicleVersionRecorder,
  ): M4EvidenceMutationResult {
    if (
      !isIndexInRange(contradictionId, this.contradictionCapacity) ||
      (this.contradictionActive[contradictionId] ?? 0) === 0
    ) {
      return { ok: false, reason: "evidence_contradiction_not_registered" };
    }
    if ((this.contradictionResolved[contradictionId] ?? 0) === 1) {
      return { ok: true, changed: false, ownerVersion: this.ownerVersionValue };
    }
    if (!isUint32(tick)) {
      return { ok: false, reason: "chronicle_value_out_of_range" };
    }
    const hypothesisId = this.contradictionHypothesisIds[contradictionId] ?? M4_CHRONICLE_NONE;
    const caseId = this.hypothesisCaseIds[hypothesisId] ?? M4_CHRONICLE_NONE;
    const mutation = this.beginMutation(
      recorder,
      caseId,
      M4_CHRONICLE_CHANGE_CONTRADICTION_RESOLVED,
      contradictionId,
      tick,
    );
    if (!mutation.ok) {
      return mutation;
    }
    if ((this.contradictionSeverities[contradictionId] ?? 0) === M4_CONTRADICTION_SEVERITY_FATAL) {
      this.fatalContradictionCounts[hypothesisId] = Math.max(
        0,
        (this.fatalContradictionCounts[hypothesisId] ?? 0) - 1,
      );
    }
    this.contradictionResolved[contradictionId] = 1;
    this.ownerVersionValue = mutation.ownerVersion;
    return { ok: true, changed: true, ownerVersion: mutation.ownerVersion };
  }
  evaluateSupport(
    hypothesisId: number,
    candidateCap: number,
    selectedCap: number,
    traceStore?: M4EvidenceReasonTraceStore,
  ): M4EvidenceSupportResult {
    const valid = this.validateSupportRead(hypothesisId, candidateCap, selectedCap);
    if (!valid.ok) {
      return valid;
    }
    const support = this.calculateSupport(hypothesisId, candidateCap, selectedCap);
    this.publishSupportMetrics(support);
    const reason = supportTraceReason(
      support.supportTier,
      support.candidateCapHit,
      support.selectedCapHit,
    );
    const traceSequence = this.recordTrace(
      traceStore,
      hypothesisId,
      support.visitedCount,
      support.selectedCount,
      candidateCap,
      selectedCap,
      support.supportScore,
      support.supportTier,
      support.independentClassCount,
      support.fatalUnresolvedContradictionCount,
      reason,
    );
    return {
      ok: true,
      caseId: support.caseId,
      hypothesisId,
      supportScore: support.supportScore,
      supportTier: support.supportTier,
      independentClassCount: support.independentClassCount,
      independentClassMask: support.independentClassMask,
      candidateCount: support.candidateCount,
      visitedCount: support.visitedCount,
      candidateCapHit: support.candidateCapHit,
      selectedCapHit: support.selectedCapHit,
      fatalUnresolvedContradictionCount: support.fatalUnresolvedContradictionCount,
      traceSequence,
      ownerVersion: this.ownerVersionValue,
    };
  }
  confirmRuleFromHypothesis(
    ruleId: number,
    hypothesisId: number,
    candidateCap: number,
    selectedCap: number,
    tick: number,
    recorder?: M4ChronicleVersionRecorder,
    traceStore?: M4EvidenceReasonTraceStore,
  ): M4EvidenceConfirmRuleResult {
    if (!isIndexInRange(ruleId, this.confirmedRuleCapacity)) {
      return { ok: false, reason: "chronicle_id_out_of_range", traceSequence: 0 };
    }
    if ((this.confirmedActive[ruleId] ?? 0) === 1) {
      return { ok: false, reason: "evidence_confirmed_rule_already_registered", traceSequence: 0 };
    }
    if (!isUint32(tick)) {
      return { ok: false, reason: "chronicle_value_out_of_range", traceSequence: 0 };
    }
    const validSupportRead = this.validateSupportRead(hypothesisId, candidateCap, selectedCap);
    if (!validSupportRead.ok) {
      return { ok: false, reason: validSupportRead.reason, traceSequence: 0 };
    }
    const support = this.calculateSupport(hypothesisId, candidateCap, selectedCap);
    const failure = this.readConfirmationFailure(hypothesisId, support);
    if (failure !== undefined) {
      this.publishSupportMetrics(support);
      const sequence = this.recordTrace(
        traceStore,
        hypothesisId,
        support.visitedCount,
        Math.min(support.visitedCount, selectedCap),
        candidateCap,
        selectedCap,
        support.supportScore,
        support.supportTier,
        support.independentClassCount,
        support.fatalUnresolvedContradictionCount,
        failure,
      );
      return { ok: false, reason: failure, traceSequence: sequence };
    }
    const mutation = this.beginMutation(
      recorder,
      support.caseId,
      M4_CHRONICLE_CHANGE_RULE_CONFIRMED,
      ruleId,
      tick,
    );
    if (!mutation.ok) {
      return { ok: false, reason: mutation.reason, traceSequence: 0 };
    }
    this.confirmedActive[ruleId] = 1;
    this.confirmedHypothesisIds[ruleId] = hypothesisId;
    this.confirmedSupportScores[ruleId] = support.supportScore;
    this.confirmedIndependentClassCounts[ruleId] = support.independentClassCount;
    this.confirmedCountValue += 1;
    this.ownerVersionValue = mutation.ownerVersion;
    this.publishSupportMetrics(support);
    const traceReason = supportTraceReason(
      support.supportTier,
      support.candidateCapHit,
      support.selectedCapHit,
    );
    const traceSequence = this.recordTrace(
      traceStore,
      hypothesisId,
      support.visitedCount,
      support.selectedCount,
      candidateCap,
      selectedCap,
      support.supportScore,
      support.supportTier,
      support.independentClassCount,
      support.fatalUnresolvedContradictionCount,
      traceReason,
    );
    return {
      ok: true,
      ruleId,
      caseId: support.caseId,
      hypothesisId,
      supportScore: support.supportScore,
      independentClassCount: support.independentClassCount,
      ownerVersion: mutation.ownerVersion,
      traceSequence,
    };
  }
  isConfirmedRuleActive(ruleId: number): boolean {
    return (
      isIndexInRange(ruleId, this.confirmedRuleCapacity) &&
      (this.confirmedActive[ruleId] ?? 0) === 1
    );
  }
  createMetrics(): M4EvidenceMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      sourceCount: this.sourceCountValue,
      evidenceRowCount: this.evidenceCountValue,
      hypothesisCount: this.hypothesisCountValue,
      contradictionCount: this.contradictionCountValue,
      confirmedRuleCount: this.confirmedCountValue,
      lastSupportCandidateVisits: this.lastSupportVisits,
      totalSupportCandidateVisits: this.totalSupportVisits,
    };
  }
  private validateSource(input: M4EvidenceSourceInput): boolean {
    return (
      isIndexInRange(input.sourceId, this.sourceCapacity) &&
      isIndexInRange(input.caseId, this.caseCapacity) &&
      isEvidenceSourceKind(input.kind) &&
      isQuality(input.reliability) &&
      isQuality(input.conflictOfInterest) &&
      isUint32(input.tick)
    );
  }
  private validateHypothesis(input: M4EvidenceHypothesisInput): boolean {
    return (
      isIndexInRange(input.hypothesisId, this.hypothesisCapacity) &&
      isIndexInRange(input.caseId, this.caseCapacity) &&
      isUint32(input.ruleSubjectId) &&
      isPositiveSafeInteger(input.requiredSupport) &&
      input.requiredIndependentClassCount >= 1 &&
      input.requiredIndependentClassCount <= 4 &&
      isUint32(input.tick)
    );
  }
  private validateEvidence(
    input: M4EvidenceRowInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ChronicleReason } {
    if (
      !isIndexInRange(input.evidenceId, this.evidenceCapacity) ||
      !isIndexInRange(input.caseId, this.caseCapacity) ||
      !isIndexInRange(input.hypothesisId, this.hypothesisCapacity)
    ) {
      return { ok: false, reason: "chronicle_id_out_of_range" };
    }
    if ((this.hypothesisActive[input.hypothesisId] ?? 0) === 0) {
      return { ok: false, reason: "evidence_hypothesis_not_registered" };
    }
    if (
      !isIndexInRange(input.sourceId, this.sourceCapacity) ||
      (this.sourceActive[input.sourceId] ?? 0) === 0
    ) {
      return { ok: false, reason: "evidence_source_not_registered" };
    }
    if (!isEvidenceClass(input.evidenceClass)) {
      return { ok: false, reason: "evidence_class_invalid" };
    }
    if (
      input.caseId !== (this.hypothesisCaseIds[input.hypothesisId] ?? M4_CHRONICLE_NONE) ||
      input.caseId !== (this.sourceCaseIds[input.sourceId] ?? M4_CHRONICLE_NONE)
    ) {
      return { ok: false, reason: "evidence_case_mismatch" };
    }
    if (!isPositiveSafeInteger(input.supportWeight)) {
      return { ok: false, reason: "evidence_support_invalid" };
    }
    return isQuality(input.directness) &&
      isUint32(input.independenceKey) &&
      isQuality(input.preservationQuality) &&
      isQuality(input.perceptionQuality) &&
      isQuality(input.interestConflict) &&
      isUint32(input.tick)
      ? { ok: true }
      : { ok: false, reason: "evidence_quality_invalid" };
  }
  private validateContradiction(
    input: M4EvidenceContradictionInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ChronicleReason } {
    if (
      !isIndexInRange(input.contradictionId, this.contradictionCapacity) ||
      !isIndexInRange(input.hypothesisId, this.hypothesisCapacity) ||
      !isIndexInRange(input.caseId, this.caseCapacity)
    ) {
      return { ok: false, reason: "chronicle_id_out_of_range" };
    }
    if ((this.hypothesisActive[input.hypothesisId] ?? 0) === 0) {
      return { ok: false, reason: "evidence_hypothesis_not_registered" };
    }
    if (
      !isIndexInRange(input.evidenceId, this.evidenceCapacity) ||
      (this.evidenceActive[input.evidenceId] ?? 0) === 0
    ) {
      return { ok: false, reason: "evidence_row_not_registered" };
    }
    if (
      input.caseId !== (this.hypothesisCaseIds[input.hypothesisId] ?? M4_CHRONICLE_NONE) ||
      input.caseId !== (this.evidenceCaseIds[input.evidenceId] ?? M4_CHRONICLE_NONE) ||
      input.hypothesisId !== (this.evidenceHypothesisIds[input.evidenceId] ?? M4_CHRONICLE_NONE)
    ) {
      return { ok: false, reason: "evidence_case_mismatch" };
    }
    return isContradictionSeverity(input.severity) && isUint32(input.tick)
      ? { ok: true }
      : { ok: false, reason: "chronicle_value_out_of_range" };
  }
  private validateSupportRead(
    hypothesisId: number,
    candidateCap: number,
    selectedCap: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ChronicleReason } {
    if (
      !isIndexInRange(hypothesisId, this.hypothesisCapacity) ||
      (this.hypothesisActive[hypothesisId] ?? 0) === 0
    ) {
      return { ok: false, reason: "evidence_hypothesis_not_registered" };
    }
    if (!isPositiveSafeInteger(candidateCap)) {
      return { ok: false, reason: "evidence_candidate_cap_invalid" };
    }
    return isPositiveSafeInteger(selectedCap)
      ? { ok: true }
      : { ok: false, reason: "evidence_selected_cap_invalid" };
  }
  private readConfirmationFailure(
    hypothesisId: number,
    support: M4EvidenceSupportComputation,
  ): M4EvidenceConfirmationFailure | undefined {
    if (support.supportScore < (this.hypothesisRequiredSupports[hypothesisId] ?? 0)) {
      return "evidence_support_below_threshold";
    }
    if (support.independentClassCount < (this.hypothesisRequiredClassCounts[hypothesisId] ?? 0)) {
      return "evidence_independent_class_insufficient";
    }
    return support.fatalUnresolvedContradictionCount > 0
      ? "evidence_fatal_contradiction_unresolved"
      : undefined;
  }
  private insertEvidence(hypothesisId: number, evidenceId: number): void {
    const score = this.evidenceScores[evidenceId] ?? 0;
    let current = this.hypothesisEvidenceHeads[hypothesisId] ?? -1;
    let previous = -1;
    while (
      current >= 0 &&
      evidenceBefore(current, evidenceId, score, this.evidenceScores, this.evidenceClasses)
    ) {
      previous = current;
      current = this.nextEvidenceByHypothesis[current] ?? -1;
    }
    this.previousEvidenceByHypothesis[evidenceId] = previous;
    this.nextEvidenceByHypothesis[evidenceId] = current;
    if (previous >= 0) {
      this.nextEvidenceByHypothesis[previous] = evidenceId;
    } else {
      this.hypothesisEvidenceHeads[hypothesisId] = evidenceId;
    }
    if (current >= 0) {
      this.previousEvidenceByHypothesis[current] = evidenceId;
    }
    this.hypothesisEvidenceCounts[hypothesisId] =
      (this.hypothesisEvidenceCounts[hypothesisId] ?? 0) + 1;
  }
  private calculateSupport(
    hypothesisId: number,
    candidateCap: number,
    selectedCap: number,
  ): M4EvidenceSupportComputation {
    let current = this.hypothesisEvidenceHeads[hypothesisId] ?? -1;
    let visited = 0;
    let selected = 0;
    let score = 0;
    let classMask = 0;
    while (current >= 0 && visited < candidateCap) {
      visited += 1;
      if (selected < selectedCap) {
        score += this.evidenceScores[current] ?? 0;
        classMask |= classMaskFor(this.evidenceClasses[current] ?? 0);
        selected += 1;
      }
      current = this.nextEvidenceByHypothesis[current] ?? -1;
    }
    const candidateCount = this.hypothesisEvidenceCounts[hypothesisId] ?? 0;
    return {
      caseId: this.hypothesisCaseIds[hypothesisId] ?? M4_CHRONICLE_NONE,
      hypothesisId,
      supportScore: score,
      supportTier: tierForScore(score),
      independentClassCount: countBits4(classMask),
      independentClassMask: classMask,
      candidateCount,
      visitedCount: visited,
      selectedCount: selected,
      candidateCapHit: candidateCount > visited,
      selectedCapHit: candidateCount > selected,
      fatalUnresolvedContradictionCount: this.fatalContradictionCounts[hypothesisId] ?? 0,
    };
  }
  private publishSupportMetrics(support: M4EvidenceSupportComputation): void {
    this.lastSupportVisits = support.visitedCount;
    this.totalSupportVisits += support.visitedCount;
  }
  private recordTrace(
    traceStore: M4EvidenceReasonTraceStore | undefined,
    hypothesisId: number,
    visited: number,
    selected: number,
    candidateCap: number,
    selectedCap: number,
    score: number,
    tier: M4EvidenceSupportTier,
    classCount: number,
    fatalCount: number,
    reason: M4EvidenceTraceReason,
  ): number {
    return (
      traceStore?.recordEvidenceSupport({
        caseId: this.hypothesisCaseIds[hypothesisId] ?? M4_CHRONICLE_NONE,
        hypothesisId,
        visitedCount: visited,
        selectedCount: selected,
        candidateCap,
        selectedCap,
        supportScore: score,
        supportTier: tier,
        independentClassCount: classCount,
        fatalContradictionCount: fatalCount,
        ownerVersion: this.ownerVersionValue,
        reason,
      }) ?? 0
    );
  }
  private beginMutation(
    recorder: M4ChronicleVersionRecorder | undefined,
    caseId: number,
    changeKind: M4ChronicleChangeKind,
    subjectId: number,
    tick: number,
  ):
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: M4ChronicleReason } {
    if (!isUint32(tick)) {
      return { ok: false, reason: "chronicle_value_out_of_range" };
    }
    if (this.ownerVersionValue >= 0xffff_ffff) {
      return { ok: false, reason: "chronicle_version_exhausted" };
    }
    const recorded = recorder?.recordVersion(caseId, changeKind, subjectId, tick);
    if (recorded !== undefined && !recorded.ok) {
      return recorded;
    }
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }
}
export function createM4EvidenceFactStore(
  options: M4EvidenceFactStoreOptions,
): M4EvidenceFactStore {
  return new M4EvidenceFactStore(options);
}
