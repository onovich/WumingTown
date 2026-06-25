export const M4_BORROWED_SHADOW_NONE = 0xffff_ffff;

export const M4_BORROWED_SHADOW_MIN_GAP_SCORE = 500;
export const M4_BORROWED_SHADOW_MIN_CONTAINMENT = 600;
export const M4_BORROWED_SHADOW_MIN_NEGOTIATION = 600;

export const M4_BORROWED_SHADOW_STATE_EMPTY = 0;
export const M4_BORROWED_SHADOW_STATE_ACTIVATED = 1;
export const M4_BORROWED_SHADOW_STATE_TRACE = 2;
export const M4_BORROWED_SHADOW_STATE_ESCALATED = 3;
export const M4_BORROWED_SHADOW_STATE_RESOLVED = 4;
export const M4_BORROWED_SHADOW_STATE_FAILED = 5;

export const M4_BORROWED_SHADOW_TRACE_ACTIVATION = 1;
export const M4_BORROWED_SHADOW_TRACE_LOW_RISK_EVIDENCE = 2;
export const M4_BORROWED_SHADOW_TRACE_ESCALATION = 3;
export const M4_BORROWED_SHADOW_TRACE_RESOLUTION = 4;
export const M4_BORROWED_SHADOW_TRACE_FAILURE = 5;

export const M4_BORROWED_SHADOW_EVIDENCE_NONE = 0;
export const M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT = 1;
export const M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH = 2;
export const M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME = 3;
export const M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE = 4;

export const M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT = 1;
export const M4_BORROWED_SHADOW_RESOLUTION_NEGOTIATION = 2;

export const M4_BORROWED_SHADOW_TERMINAL_NONE = 0;
export const M4_BORROWED_SHADOW_TERMINAL_CONTAINED = 1;
export const M4_BORROWED_SHADOW_TERMINAL_NEGOTIATED = 2;
export const M4_BORROWED_SHADOW_TERMINAL_HARM = 3;
export const M4_BORROWED_SHADOW_TERMINAL_ABORTED = 4;

export type M4BorrowedShadowReason =
  | "borrowed_shadow_candidate_id_out_of_range"
  | "borrowed_shadow_crisis_id_out_of_range"
  | "borrowed_shadow_candidate_already_registered"
  | "borrowed_shadow_candidate_not_registered"
  | "borrowed_shadow_crisis_already_registered"
  | "borrowed_shadow_crisis_not_registered"
  | "borrowed_shadow_candidate_cap_invalid"
  | "borrowed_shadow_selected_cap_invalid"
  | "borrowed_shadow_output_too_small"
  | "borrowed_shadow_value_out_of_range"
  | "borrowed_shadow_basis_version_invalid"
  | "borrowed_shadow_activation_candidates_indexed"
  | "borrowed_shadow_activation_candidate_cap_reached"
  | "borrowed_shadow_activation_selected_cap_reached"
  | "borrowed_shadow_activation_no_candidate"
  | "borrowed_shadow_activation_prevented_lamp_gap"
  | "borrowed_shadow_activation_prevented_identity_confirmed"
  | "borrowed_shadow_activated"
  | "borrowed_shadow_low_risk_evidence_recorded"
  | "borrowed_shadow_escalated"
  | "borrowed_shadow_escalation_requires_evidence"
  | "borrowed_shadow_resolved_contained"
  | "borrowed_shadow_resolved_negotiated"
  | "borrowed_shadow_resolution_requirements_unmet"
  | "borrowed_shadow_failed"
  | "borrowed_shadow_terminal_state"
  | "borrowed_shadow_version_exhausted";

export interface M4BorrowedShadowStoreOptions {
  readonly candidateCapacity: number;
  readonly crisisCapacity: number;
  readonly traceCapacity: number;
}

export interface M4BorrowedShadowActivationBasis {
  readonly candidateId: number;
  readonly targetActorId: number;
  readonly lampId: number;
  readonly lampGapScore: number;
  readonly humanClaim: number;
  readonly lampGapSourceVersion: number;
  readonly lampGapIndexVersion: number;
  readonly identityCaseId: number;
  readonly identityHypothesisId: number;
  readonly identitySupportTier: number;
  readonly identitySupportScore: number;
  readonly identityIndependentClassCount: number;
  readonly identityConfirmed: number;
  readonly evidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly obligationDuePressure: number;
  readonly townRuleOwnerVersion: number;
  readonly nightWatchPolicyKnown: number;
}

export interface M4BorrowedShadowCandidateView extends M4BorrowedShadowActivationBasis {
  readonly candidateVersion: number;
  readonly ownerVersion: number;
}

export interface M4BorrowedShadowCandidateQuery {
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly minLampGapScore: number;
}

export type M4BorrowedShadowCandidateQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly ownerVersion: number;
      readonly reason: M4BorrowedShadowReason;
    }
  | { readonly ok: false; readonly reason: M4BorrowedShadowReason };

export type M4BorrowedShadowMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly ownerVersion: number;
      readonly reason: M4BorrowedShadowReason;
    }
  | { readonly ok: false; readonly reason: M4BorrowedShadowReason };

export interface M4BorrowedShadowActivateInput {
  readonly candidateId: number;
  readonly crisisId: number;
  readonly tick: number;
}

export interface M4BorrowedShadowTraceInput {
  readonly crisisId: number;
  readonly evidenceKind: number;
  readonly tick: number;
}

export interface M4BorrowedShadowResolutionInput {
  readonly crisisId: number;
  readonly method: number;
  readonly tick: number;
  readonly lampGapClosed: number;
  readonly identityConfirmed: number;
  readonly containmentScore: number;
  readonly negotiationScore: number;
}

export interface M4BorrowedShadowFailureInput {
  readonly crisisId: number;
  readonly terminalReason: number;
  readonly tick: number;
}

export interface M4BorrowedShadowCrisisView {
  readonly crisisId: number;
  readonly state: number;
  readonly targetActorId: number;
  readonly lampId: number;
  readonly caseId: number;
  readonly hypothesisId: number;
  readonly lampGapSourceVersion: number;
  readonly lampGapIndexVersion: number;
  readonly evidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly townRuleOwnerVersion: number;
  readonly activationTick: number;
  readonly traceTick: number;
  readonly escalationTick: number;
  readonly terminalTick: number;
  readonly lowRiskEvidenceCount: number;
  readonly escalationLevel: number;
  readonly resolutionMethod: number;
  readonly terminalReason: number;
  readonly crisisVersion: number;
  readonly ownerVersion: number;
}

export interface M4BorrowedShadowTraceView {
  readonly sequence: number;
  readonly crisisId: number;
  readonly eventKind: number;
  readonly evidenceKind: number;
  readonly tick: number;
  readonly crisisState: number;
  readonly terminalReason: number;
  readonly ownerVersion: number;
  readonly reason: M4BorrowedShadowReason;
}

export interface M4BorrowedShadowMetrics {
  readonly ownerVersion: number;
  readonly activeCandidateCount: number;
  readonly activeCrisisCount: number;
  readonly resolvedCrisisCount: number;
  readonly failedCrisisCount: number;
  readonly lowRiskEvidenceCount: number;
  readonly lastCandidateVisits: number;
  readonly totalCandidateVisits: number;
  readonly traceStoredCount: number;
  readonly nextTraceSequence: number;
}
