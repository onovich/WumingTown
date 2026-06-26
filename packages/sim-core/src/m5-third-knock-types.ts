export const M5_THIRD_KNOCK_NONE = 0xffff_ffff;

export const M5_THIRD_KNOCK_MIN_INVITATION_SCORE = 600;
export const M5_THIRD_KNOCK_MIN_CONTAINMENT_SCORE = 600;
export const M5_THIRD_KNOCK_MIN_POLICY_SCORE = 600;

export const M5_THIRD_KNOCK_STATE_EMPTY = 0;
export const M5_THIRD_KNOCK_STATE_ACTIVATED = 1;
export const M5_THIRD_KNOCK_STATE_TRACE = 2;
export const M5_THIRD_KNOCK_STATE_ESCALATED = 3;
export const M5_THIRD_KNOCK_STATE_RESOLVED = 4;
export const M5_THIRD_KNOCK_STATE_FAILED = 5;

export const M5_THIRD_KNOCK_TRACE_ACTIVATION = 1;
export const M5_THIRD_KNOCK_TRACE_LOW_RISK_EVIDENCE = 2;
export const M5_THIRD_KNOCK_TRACE_ESCALATION = 3;
export const M5_THIRD_KNOCK_TRACE_RESOLUTION = 4;
export const M5_THIRD_KNOCK_TRACE_FAILURE = 5;

export const M5_THIRD_KNOCK_EVIDENCE_NONE = 0;
export const M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS = 1;
export const M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT = 2;
export const M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS = 3;
export const M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH = 4;
export const M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE = 5;

export const M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT = 1;
export const M5_THIRD_KNOCK_RESOLUTION_TEMPORARY_POLICY = 2;

export const M5_THIRD_KNOCK_TERMINAL_NONE = 0;
export const M5_THIRD_KNOCK_TERMINAL_CONTAINED = 1;
export const M5_THIRD_KNOCK_TERMINAL_POLICY_BOUND = 2;
export const M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED = 3;
export const M5_THIRD_KNOCK_TERMINAL_ABORTED = 4;

export type M5ThirdKnockReason =
  | "third_knock_definition_invalid"
  | "third_knock_stale_content_basis"
  | "third_knock_candidate_id_out_of_range"
  | "third_knock_crisis_id_out_of_range"
  | "third_knock_candidate_already_registered"
  | "third_knock_candidate_not_registered"
  | "third_knock_crisis_already_registered"
  | "third_knock_crisis_not_registered"
  | "third_knock_candidate_cap_invalid"
  | "third_knock_selected_cap_invalid"
  | "third_knock_output_too_small"
  | "third_knock_value_out_of_range"
  | "third_knock_basis_version_invalid"
  | "third_knock_activation_candidate_indexed"
  | "third_knock_activation_candidate_cap_reached"
  | "third_knock_activation_selected_cap_reached"
  | "third_knock_activation_no_candidate"
  | "third_knock_activation_prevented_prior_knocks"
  | "third_knock_activation_prevented_known_rule_or_policy"
  | "third_knock_activation_prevented_threshold"
  | "third_knock_activated"
  | "third_knock_low_risk_evidence_recorded"
  | "third_knock_escalated"
  | "third_knock_escalation_requires_evidence"
  | "third_knock_low_risk_evidence_cap_reached"
  | "third_knock_resolved_contained"
  | "third_knock_resolved_policy_bound"
  | "third_knock_resolution_requirements_unmet"
  | "third_knock_failed"
  | "third_knock_terminal_state"
  | "third_knock_version_exhausted";

export interface M5ThirdKnockStoreOptions {
  readonly candidateCapacity: number;
  readonly crisisCapacity: number;
  readonly traceCapacity: number;
  readonly accidentReviewCapacity: number;
}

export interface M5ThirdKnockActivationBasis {
  readonly candidateId: number;
  readonly defIndex: number;
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly residentActorId: number;
  readonly guestActorId: number;
  readonly doorId: number;
  readonly thresholdId: number;
  readonly chronicleCaseId: number;
  readonly chronicleHypothesisId: number;
  readonly knockCount: number;
  readonly answeredThirdKnock: number;
  readonly thresholdBasisVersion: number;
  readonly thresholdMarkCount: number;
  readonly chronicleEvidenceOwnerVersion: number;
  readonly chronicleSupportScore: number;
  readonly chronicleIndependentClassCount: number;
  readonly townRuleOwnerVersion: number;
  readonly knowsConfirmedRule: number;
  readonly temporaryPolicyActive: number;
  readonly obligationOwnerVersion: number;
  readonly obligationPressure: number;
  readonly guesthousePolicyVersion: number;
  readonly lodgingRegisterVersion: number;
  readonly lodgingRegisterMismatch: number;
  readonly witnessDisagreementScore: number;
  readonly priorKnockWitnessCount: number;
  readonly invitationDebtScore: number;
  readonly priority: number;
  readonly stableOwnerId: number;
  readonly stableSequence: number;
}

export interface M5ThirdKnockCandidateView extends M5ThirdKnockActivationBasis {
  readonly candidateVersion: number;
  readonly ownerVersion: number;
}

export interface M5ThirdKnockCandidateQuery {
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly minInvitationDebtScore: number;
}

export type M5ThirdKnockCandidateQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly ownerVersion: number;
      readonly reason: M5ThirdKnockReason;
    }
  | { readonly ok: false; readonly reason: M5ThirdKnockReason };

export type M5ThirdKnockMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly ownerVersion: number;
      readonly reason: M5ThirdKnockReason;
    }
  | { readonly ok: false; readonly reason: M5ThirdKnockReason };

export interface M5ThirdKnockActivateInput {
  readonly candidateId: number;
  readonly crisisId: number;
  readonly tick: number;
}

export interface M5ThirdKnockTraceInput {
  readonly crisisId: number;
  readonly evidenceKind: number;
  readonly tick: number;
}

export interface M5ThirdKnockResolutionInput {
  readonly crisisId: number;
  readonly method: number;
  readonly tick: number;
  readonly thresholdSealed: number;
  readonly witnessesAligned: number;
  readonly policyPublished: number;
  readonly debtAcknowledged: number;
  readonly containmentScore: number;
  readonly policyScore: number;
}

export interface M5ThirdKnockFailureInput {
  readonly crisisId: number;
  readonly terminalReason: number;
  readonly tick: number;
}

export interface M5ThirdKnockCrisisView {
  readonly crisisId: number;
  readonly state: number;
  readonly residentActorId: number;
  readonly guestActorId: number;
  readonly doorId: number;
  readonly thresholdId: number;
  readonly chronicleCaseId: number;
  readonly chronicleHypothesisId: number;
  readonly thresholdBasisVersion: number;
  readonly chronicleEvidenceOwnerVersion: number;
  readonly townRuleOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly guesthousePolicyVersion: number;
  readonly lodgingRegisterVersion: number;
  readonly activationTick: number;
  readonly traceTick: number;
  readonly escalationTick: number;
  readonly terminalTick: number;
  readonly lowRiskEvidenceCount: number;
  readonly escalationLevel: number;
  readonly resolutionMethod: number;
  readonly terminalReason: number;
  readonly invitationDebtScore: number;
  readonly obligationPressure: number;
  readonly crisisVersion: number;
  readonly ownerVersion: number;
}

export interface M5ThirdKnockTraceView {
  readonly sequence: number;
  readonly crisisId: number;
  readonly eventKind: number;
  readonly evidenceKind: number;
  readonly tick: number;
  readonly crisisState: number;
  readonly terminalReason: number;
  readonly ownerVersion: number;
  readonly reason: M5ThirdKnockReason;
}

export interface M5ThirdKnockAccidentReviewView {
  readonly sequence: number;
  readonly crisisId: number;
  readonly tick: number;
  readonly resolutionMethod: number;
  readonly terminalReason: number;
  readonly lowRiskEvidenceCount: number;
  readonly invitationDebtScore: number;
  readonly obligationPressure: number;
  readonly townRuleOwnerVersion: number;
  readonly guesthousePolicyVersion: number;
  readonly ownerVersion: number;
  readonly reason: M5ThirdKnockReason;
}

export interface M5ThirdKnockMetrics {
  readonly ownerVersion: number;
  readonly activeCandidateCount: number;
  readonly activeCrisisCount: number;
  readonly resolvedCrisisCount: number;
  readonly failedCrisisCount: number;
  readonly lowRiskEvidenceCount: number;
  readonly lastCandidateVisits: number;
  readonly totalCandidateVisits: number;
  readonly candidateCapHitCount: number;
  readonly traceStoredCount: number;
  readonly accidentReviewStoredCount: number;
}
