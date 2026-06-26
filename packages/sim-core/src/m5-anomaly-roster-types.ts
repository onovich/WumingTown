import type { M4BorrowedShadowActivationBasis } from "./m4-borrowed-shadow-types";

export const M5_ANOMALY_ROSTER_SNAPSHOT_VERSION = 1;
export const M5_ANOMALY_NONE = 0xffff_ffff;

export const M5_ANOMALY_KIND = "m5.anomaly";
export const M5_ANOMALY_DEF_BORROWED_SHADOW = "core.anomaly.borrowed_shadow.v1";
export const M5_ANOMALY_DEF_THIRD_KNOCK = "core.anomaly.third_knock.v1";
export const M5_ANOMALY_DEF_OLD_BRIDGE_GUEST = "core.anomaly.old_bridge_guest.v1";

export const M5_ANOMALY_RULE_COMPONENT_BORROWED_SHADOW = 1;
export const M5_ANOMALY_ACTIVATION_POLICY_BORROWED_SHADOW_LAMP_IDENTITY = 1;
export const M5_ANOMALY_STATE_OWNER_BORROWED_SHADOW_CRISIS = 1;
export const M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK = 2;
export const M5_ANOMALY_ACTIVATION_POLICY_THIRD_KNOCK_THRESHOLD_INVITATION = 2;
export const M5_ANOMALY_STATE_OWNER_THIRD_KNOCK_CRISIS = 2;
export const M5_ANOMALY_RULE_COMPONENT_OLD_BRIDGE_GUEST = 3;
export const M5_ANOMALY_ACTIVATION_POLICY_OLD_BRIDGE_GUEST_RECIPROCITY = 3;
export const M5_ANOMALY_STATE_OWNER_OLD_BRIDGE_GUEST_CRISIS = 3;

export type M5AnomalyRosterReason =
  | "m5_anomaly_roster_already_loaded"
  | "m5_anomaly_roster_compiled"
  | "m5_anomaly_roster_not_loaded"
  | "m5_anomaly_roster_definition_id_out_of_range"
  | "m5_anomaly_roster_definition_not_registered"
  | "m5_anomaly_roster_definition_capacity_exceeded"
  | "m5_anomaly_roster_definition_order_invalid"
  | "m5_anomaly_roster_definition_duplicate"
  | "m5_anomaly_roster_missing_borrowed_shadow"
  | "m5_anomaly_roster_invalid_definition"
  | "m5_anomaly_roster_invalid_hash"
  | "m5_anomaly_roster_invalid_roster_version"
  | "m5_anomaly_roster_stale_content_basis"
  | "m5_anomaly_roster_candidate_id_out_of_range"
  | "m5_anomaly_roster_candidate_already_registered"
  | "m5_anomaly_roster_candidate_not_registered"
  | "m5_anomaly_roster_candidate_cap_invalid"
  | "m5_anomaly_roster_selected_cap_invalid"
  | "m5_anomaly_roster_output_too_small"
  | "m5_anomaly_roster_value_out_of_range"
  | "m5_anomaly_roster_basis_version_invalid"
  | "m5_anomaly_roster_activation_candidate_indexed"
  | "m5_anomaly_roster_activation_candidate_cap_reached"
  | "m5_anomaly_roster_activation_selected_cap_reached"
  | "m5_anomaly_roster_activation_no_candidate"
  | "m5_anomaly_roster_version_exhausted";

export interface M5CompiledAnomalyDefinitionInput {
  readonly defId: string;
  readonly defIndex: number;
  readonly contentDefIndex: number;
  readonly kind: string;
  readonly schemaVersion: number;
  readonly ruleComponent: number;
  readonly activationPolicy: number;
  readonly stateOwnerKind: number;
  readonly minActivationScore: number;
  readonly evidenceClassMask: number;
  readonly nonCombatResolutionMask: number;
  readonly validationBasisHash: string;
}

export interface M5CompiledAnomalyRosterInput {
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly validationBasis: string;
  readonly definitions: readonly M5CompiledAnomalyDefinitionInput[];
}

export interface M5AnomalyDefinitionView extends M5CompiledAnomalyDefinitionInput {
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly ownerVersion: number;
}

export interface M5AnomalyRosterStoreOptions {
  readonly definitionCapacity: number;
  readonly candidateCapacity: number;
}

export interface M5AnomalyRosterMutationResult {
  readonly ok: boolean;
  readonly changed?: boolean;
  readonly ownerVersion?: number;
  readonly reason: M5AnomalyRosterReason;
}

export interface M5AnomalyActivationCandidateInput {
  readonly candidateId: number;
  readonly defIndex: number;
  readonly stateOwnerId: number;
  readonly score: number;
  readonly priority: number;
  readonly stableOwnerId: number;
  readonly stableSequence: number;
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly borrowedShadowBasis: M4BorrowedShadowActivationBasis;
}

export interface M5AnomalyActivationCandidateView extends M5AnomalyActivationCandidateInput {
  readonly candidateVersion: number;
  readonly ownerVersion: number;
}

export interface M5AnomalyActivationCandidateQuery {
  readonly defIndex: number;
  readonly rosterVersion: number;
  readonly contentManifestHash: string;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly minScore: number;
}

export type M5AnomalyActivationCandidateQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly ownerVersion: number;
      readonly reason: M5AnomalyRosterReason;
    }
  | { readonly ok: false; readonly reason: M5AnomalyRosterReason };

export interface M5AnomalyRosterMetrics {
  readonly ownerVersion: number;
  readonly rosterVersion: number;
  readonly definitionCount: number;
  readonly activeCandidateCount: number;
  readonly lastCandidateVisits: number;
  readonly totalCandidateVisits: number;
  readonly candidateCapHitCount: number;
}
