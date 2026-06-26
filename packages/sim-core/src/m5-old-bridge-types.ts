export const M5_OLD_BRIDGE_NONE = 0xffff_ffff;

export const M5_OLD_BRIDGE_MIN_RECIPROCITY_SCORE = 600;
export const M5_OLD_BRIDGE_MIN_REROUTE_SCORE = 600;
export const M5_OLD_BRIDGE_MIN_SETTLEMENT_SCORE = 600;

export const M5_OLD_BRIDGE_STATE_EMPTY = 0;
export const M5_OLD_BRIDGE_STATE_ACTIVATED = 1;
export const M5_OLD_BRIDGE_STATE_TRACE = 2;
export const M5_OLD_BRIDGE_STATE_ESCALATED = 3;
export const M5_OLD_BRIDGE_STATE_RESOLVED = 4;
export const M5_OLD_BRIDGE_STATE_FAILED = 5;

export const M5_OLD_BRIDGE_TRACE_ACTIVATION = 1;
export const M5_OLD_BRIDGE_TRACE_LOW_RISK_EVIDENCE = 2;
export const M5_OLD_BRIDGE_TRACE_ESCALATION = 3;
export const M5_OLD_BRIDGE_TRACE_RESOLUTION = 4;
export const M5_OLD_BRIDGE_TRACE_FAILURE = 5;

export const M5_OLD_BRIDGE_EVIDENCE_NONE = 0;
export const M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER = 1;
export const M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS = 2;
export const M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY = 3;
export const M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY = 4;
export const M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD = 5;

export const M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY = 1;
export const M5_OLD_BRIDGE_RESOLUTION_REROUTE = 2;
export const M5_OLD_BRIDGE_RESOLUTION_OBLIGATION_SETTLEMENT = 3;

export const M5_OLD_BRIDGE_TERMINAL_NONE = 0;
export const M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED = 1;
export const M5_OLD_BRIDGE_TERMINAL_REROUTED = 2;
export const M5_OLD_BRIDGE_TERMINAL_OBLIGATION_SETTLED = 3;
export const M5_OLD_BRIDGE_TERMINAL_PASSAGE_DENIED = 4;
export const M5_OLD_BRIDGE_TERMINAL_ABORTED = 5;

export type M5OldBridgeReason =
  | "old_bridge_definition_invalid"
  | "old_bridge_stale_content_basis"
  | "old_bridge_candidate_id_out_of_range"
  | "old_bridge_crisis_id_out_of_range"
  | "old_bridge_candidate_already_registered"
  | "old_bridge_candidate_not_registered"
  | "old_bridge_crisis_already_registered"
  | "old_bridge_crisis_not_registered"
  | "old_bridge_candidate_cap_invalid"
  | "old_bridge_selected_cap_invalid"
  | "old_bridge_output_too_small"
  | "old_bridge_cleanup_cap_invalid"
  | "old_bridge_cleanup_output_too_small"
  | "old_bridge_value_out_of_range"
  | "old_bridge_basis_version_invalid"
  | "old_bridge_activation_candidate_indexed"
  | "old_bridge_activation_candidate_cap_reached"
  | "old_bridge_activation_selected_cap_reached"
  | "old_bridge_activation_no_candidate"
  | "old_bridge_activation_prevented_outside_bridge_window"
  | "old_bridge_activation_prevented_route_basis"
  | "old_bridge_activation_prevented_safe_prepared_item"
  | "old_bridge_activated"
  | "old_bridge_low_risk_evidence_recorded"
  | "old_bridge_low_risk_evidence_cap_reached"
  | "old_bridge_escalated"
  | "old_bridge_escalation_requires_evidence"
  | "old_bridge_resolved_reciprocity"
  | "old_bridge_resolved_rerouted"
  | "old_bridge_resolved_obligation_settled"
  | "old_bridge_resolution_requirements_unmet"
  | "old_bridge_failed"
  | "old_bridge_terminal_state"
  | "old_bridge_terminal_cleanup_drained"
  | "old_bridge_terminal_cleanup_cap_reached"
  | "old_bridge_terminal_cleanup_no_candidate"
  | "old_bridge_version_exhausted";

export interface M5OldBridgeStoreOptions {
  readonly candidateCapacity: number;
  readonly crisisCapacity: number;
  readonly traceCapacity: number;
  readonly reviewCapacity: number;
}

export interface M5OldBridgeActivationBasis {
  readonly candidateId: number;
  readonly defIndex: number;
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly crossingActorId: number;
  readonly guestActorId: number;
  readonly bridgeId: number;
  readonly routeId: number;
  readonly bridgeWindowId: number;
  readonly seasonWindowId: number;
  readonly bridgeWindowActive: number;
  readonly routePassable: number;
  readonly routeBasisVersion: number;
  readonly routeDelayScore: number;
  readonly bridgeLedgerVersion: number;
  readonly bridgeLedgerEntryId: number;
  readonly bridgeLedgerMismatch: number;
  readonly preparedItemStackId: number;
  readonly preparedItemDefId: number;
  readonly preparedItemQuantity: number;
  readonly preparedForActorId: number;
  readonly preparedItemOwnerVersion: number;
  readonly logisticsIndexVersion: number;
  readonly chronicleCaseId: number;
  readonly chronicleHypothesisId: number;
  readonly chronicleEvidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly obligationId: number;
  readonly obligationPressure: number;
  readonly factionFactOwnerVersion: number;
  readonly factionPressure: number;
  readonly seasonOwnerVersion: number;
  readonly oldFamilyRecordVersion: number;
  readonly merchantTestimonyScore: number;
  readonly oldFamilyOralRecordScore: number;
  readonly preparedItemScore: number;
  readonly reciprocityDebtScore: number;
  readonly selfServingToll: number;
  readonly priority: number;
  readonly stableOwnerId: number;
  readonly stableSequence: number;
}

export interface M5OldBridgeCandidateView extends M5OldBridgeActivationBasis {
  readonly candidateVersion: number;
  readonly ownerVersion: number;
}

export interface M5OldBridgeCandidateQuery {
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly minReciprocityDebtScore: number;
}

export type M5OldBridgeCandidateQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly ownerVersion: number;
      readonly reason: M5OldBridgeReason;
    }
  | { readonly ok: false; readonly reason: M5OldBridgeReason };

export type M5OldBridgeMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly ownerVersion: number;
      readonly reason: M5OldBridgeReason;
    }
  | { readonly ok: false; readonly reason: M5OldBridgeReason };

export interface M5OldBridgeActivateInput {
  readonly candidateId: number;
  readonly crisisId: number;
  readonly tick: number;
}

export interface M5OldBridgeTraceInput {
  readonly crisisId: number;
  readonly evidenceKind: number;
  readonly tick: number;
}

export interface M5OldBridgeResolutionInput {
  readonly crisisId: number;
  readonly method: number;
  readonly tick: number;
  readonly preparedItemDelivered: number;
  readonly routeReplanned: number;
  readonly obligationSettled: number;
  readonly reciprocityScore: number;
  readonly rerouteScore: number;
  readonly settlementScore: number;
}

export interface M5OldBridgeFailureInput {
  readonly crisisId: number;
  readonly terminalReason: number;
  readonly tick: number;
}

export interface M5OldBridgeTerminalCleanupResult {
  readonly ok: true;
  readonly selectedCount: number;
  readonly visitedCount: number;
  readonly cleanupCapHit: boolean;
  readonly ownerVersion: number;
  readonly reason: M5OldBridgeReason;
}

export interface M5OldBridgeCrisisView {
  readonly crisisId: number;
  readonly state: number;
  readonly crossingActorId: number;
  readonly guestActorId: number;
  readonly bridgeId: number;
  readonly routeId: number;
  readonly bridgeWindowId: number;
  readonly seasonWindowId: number;
  readonly routeBasisVersion: number;
  readonly preparedItemOwnerVersion: number;
  readonly logisticsIndexVersion: number;
  readonly chronicleEvidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly factionFactOwnerVersion: number;
  readonly seasonOwnerVersion: number;
  readonly activationTick: number;
  readonly traceTick: number;
  readonly escalationTick: number;
  readonly terminalTick: number;
  readonly lowRiskEvidenceCount: number;
  readonly escalationLevel: number;
  readonly resolutionMethod: number;
  readonly terminalReason: number;
  readonly reciprocityDebtScore: number;
  readonly routeDelayScore: number;
  readonly obligationPressure: number;
  readonly cleanupPending: number;
  readonly crisisVersion: number;
  readonly ownerVersion: number;
}

export interface M5OldBridgeTraceView {
  readonly sequence: number;
  readonly crisisId: number;
  readonly eventKind: number;
  readonly evidenceKind: number;
  readonly tick: number;
  readonly crisisState: number;
  readonly terminalReason: number;
  readonly ownerVersion: number;
  readonly reason: M5OldBridgeReason;
}

export interface M5OldBridgeReviewView {
  readonly sequence: number;
  readonly crisisId: number;
  readonly tick: number;
  readonly resolutionMethod: number;
  readonly terminalReason: number;
  readonly lowRiskEvidenceCount: number;
  readonly reciprocityDebtScore: number;
  readonly routeDelayScore: number;
  readonly obligationPressure: number;
  readonly routeBasisVersion: number;
  readonly preparedItemOwnerVersion: number;
  readonly factionFactOwnerVersion: number;
  readonly ownerVersion: number;
  readonly reason: M5OldBridgeReason;
}

export interface M5OldBridgeMetrics {
  readonly ownerVersion: number;
  readonly activeCandidateCount: number;
  readonly activeCrisisCount: number;
  readonly resolvedCrisisCount: number;
  readonly failedCrisisCount: number;
  readonly lowRiskEvidenceCount: number;
  readonly terminalCleanupPendingCount: number;
  readonly lastCandidateVisits: number;
  readonly totalCandidateVisits: number;
  readonly candidateCapHitCount: number;
  readonly terminalCleanupCapHitCount: number;
  readonly traceStoredCount: number;
  readonly reviewStoredCount: number;
}
