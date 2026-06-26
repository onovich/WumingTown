export const M5_FACTION_GOVERNANCE_NONE = 0xffff_ffff;

export const M5_FACTION_FACT_KIND_LEGAL_STANCE = 1;
export const M5_FACTION_FACT_KIND_TRADE_STANCE = 2;
export const M5_FACTION_FACT_KIND_DEBT_STANCE = 3;
export const M5_FACTION_FACT_KIND_LEGITIMACY = 4;
export const M5_FACTION_FACT_KIND_FEAR_MEMORY = 5;
export const M5_FACTION_FACT_KIND_MEMORY_EVENT = 6;
export const M5_FACTION_FACT_KIND_KNOWN_CLAIM = 7;

export const M5_FACTION_FACT_MASK_LEGAL_STANCE = 1;
export const M5_FACTION_FACT_MASK_TRADE_STANCE = 1 << 1;
export const M5_FACTION_FACT_MASK_DEBT_STANCE = 1 << 2;
export const M5_FACTION_FACT_MASK_LEGITIMACY = 1 << 3;
export const M5_FACTION_FACT_MASK_FEAR_MEMORY = 1 << 4;
export const M5_FACTION_FACT_MASK_MEMORY_EVENT = 1 << 5;
export const M5_FACTION_FACT_MASK_KNOWN_CLAIM = 1 << 6;
export const M5_FACTION_FACT_MASK_ALL =
  M5_FACTION_FACT_MASK_LEGAL_STANCE |
  M5_FACTION_FACT_MASK_TRADE_STANCE |
  M5_FACTION_FACT_MASK_DEBT_STANCE |
  M5_FACTION_FACT_MASK_LEGITIMACY |
  M5_FACTION_FACT_MASK_FEAR_MEMORY |
  M5_FACTION_FACT_MASK_MEMORY_EVENT |
  M5_FACTION_FACT_MASK_KNOWN_CLAIM;

export const M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY = 1;
export const M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY = 2;
export const M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY = 3;
export const M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE = 4;
export const M5_GOVERNANCE_HOOK_RISK_FLAG = 5;

export const M5_GOVERNANCE_HOOK_MASK_COUNCIL_POST_AUTHORITY = 1;
export const M5_GOVERNANCE_HOOK_MASK_TEMPORARY_POLICY_AUTHORITY = 1 << 1;
export const M5_GOVERNANCE_HOOK_MASK_ENFORCEMENT_CAPACITY = 1 << 2;
export const M5_GOVERNANCE_HOOK_MASK_LEGITIMACY_SOURCE = 1 << 3;
export const M5_GOVERNANCE_HOOK_MASK_RISK_FLAG = 1 << 4;
export const M5_GOVERNANCE_HOOK_MASK_ALL =
  M5_GOVERNANCE_HOOK_MASK_COUNCIL_POST_AUTHORITY |
  M5_GOVERNANCE_HOOK_MASK_TEMPORARY_POLICY_AUTHORITY |
  M5_GOVERNANCE_HOOK_MASK_ENFORCEMENT_CAPACITY |
  M5_GOVERNANCE_HOOK_MASK_LEGITIMACY_SOURCE |
  M5_GOVERNANCE_HOOK_MASK_RISK_FLAG;

export const M5_GOVERNANCE_COUNCIL_POST_LAMPKEEPER = 1;
export const M5_GOVERNANCE_COUNCIL_POST_CHRONICLER = 2;
export const M5_GOVERNANCE_COUNCIL_POST_MEDIC = 3;
export const M5_GOVERNANCE_COUNCIL_POST_NIGHT_WATCH_LEAD = 4;

export const M5_GOVERNANCE_RISK_FLAG_CORRUPTION = 1;
export const M5_GOVERNANCE_RISK_FLAG_CENSORSHIP = 1 << 1;
export const M5_GOVERNANCE_RISK_FLAG_OVERREACH = 1 << 2;
export const M5_GOVERNANCE_RISK_FLAG_ALL =
  M5_GOVERNANCE_RISK_FLAG_CORRUPTION |
  M5_GOVERNANCE_RISK_FLAG_CENSORSHIP |
  M5_GOVERNANCE_RISK_FLAG_OVERREACH;

export type M5FactionReason =
  | "m5_faction_fact_id_out_of_range"
  | "m5_faction_faction_id_out_of_range"
  | "m5_faction_subject_id_invalid"
  | "m5_faction_kind_invalid"
  | "m5_faction_value_invalid"
  | "m5_faction_source_event_invalid"
  | "m5_faction_source_version_invalid"
  | "m5_faction_owner_version_exhausted"
  | "m5_faction_fact_indexed"
  | "m5_faction_query_mask_invalid"
  | "m5_faction_query_cap_invalid"
  | "m5_faction_query_output_too_small"
  | "m5_faction_query_stale_basis"
  | "m5_faction_query_indexed"
  | "m5_faction_query_no_candidate"
  | "m5_faction_query_cap_reached"
  | "m5_faction_query_scan_cap_reached";

export type M5GovernanceReason =
  | "m5_governance_hook_id_out_of_range"
  | "m5_governance_policy_id_invalid"
  | "m5_governance_hook_kind_invalid"
  | "m5_governance_authority_actor_invalid"
  | "m5_governance_reference_invalid"
  | "m5_governance_score_invalid"
  | "m5_governance_risk_flags_invalid"
  | "m5_governance_window_invalid"
  | "m5_governance_source_event_invalid"
  | "m5_governance_source_version_invalid"
  | "m5_governance_owner_version_exhausted"
  | "m5_governance_hook_indexed"
  | "m5_governance_query_mask_invalid"
  | "m5_governance_query_cap_invalid"
  | "m5_governance_query_output_too_small"
  | "m5_governance_query_stale_basis"
  | "m5_governance_query_no_candidate"
  | "m5_governance_query_allowed"
  | "m5_governance_query_cap_reached"
  | "m5_governance_query_scan_cap_reached"
  | "m5_governance_query_risk_blocked"
  | "m5_governance_query_insufficient_legitimacy";

export interface M5FactionFactStoreOptions {
  readonly factCapacity: number;
  readonly factionCapacity: number;
}

export interface M5FactionFactInput {
  readonly factId: number;
  readonly factionId: number;
  readonly subjectId: number;
  readonly kind: number;
  readonly value: number;
  readonly sourceEventId: number;
  readonly sourceOwnerVersion: number;
  readonly chronicleOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly tick: number;
  readonly priority: number;
  readonly stableOwnerId: number;
  readonly stableSequence: number;
}

export interface M5FactionFactView extends M5FactionFactInput {
  readonly factVersion: number;
  readonly ownerVersion: number;
}

export type M5FactionMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly factId: number;
      readonly ownerVersion: number;
      readonly reason: M5FactionReason;
    }
  | { readonly ok: false; readonly reason: M5FactionReason };

export interface M5FactionFactQuery {
  readonly factionId: number;
  readonly expectedOwnerVersion: number;
  readonly subjectId: number;
  readonly kindMask: number;
  readonly minValue: number;
  readonly candidateCap: number;
  readonly scanCap: number;
}

export type M5FactionFactQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly scanCapHit: boolean;
      readonly ownerVersion: number;
      readonly reason: M5FactionReason;
    }
  | { readonly ok: false; readonly reason: M5FactionReason };

export interface M5FactionMetrics {
  readonly ownerVersion: number;
  readonly activeFactCount: number;
  readonly indexedFactCount: number;
  readonly legalFactCount: number;
  readonly tradeFactCount: number;
  readonly debtFactCount: number;
  readonly legitimacyFactCount: number;
  readonly fearMemoryFactCount: number;
  readonly memoryEventFactCount: number;
  readonly knownClaimFactCount: number;
  readonly lastQueryVisits: number;
  readonly totalQueryVisits: number;
  readonly lastQuerySelected: number;
  readonly queryCapHitCount: number;
  readonly staleBasisRejectCount: number;
}

export interface M5GovernanceHookStoreOptions {
  readonly hookCapacity: number;
  readonly policyCapacity: number;
}

export interface M5GovernanceHookInput {
  readonly hookId: number;
  readonly policyId: number;
  readonly hookKind: number;
  readonly authorityActorId: number;
  readonly councilPostId: number;
  readonly temporaryPolicyId: number;
  readonly enforcementCapacity: number;
  readonly legitimacySourceId: number;
  readonly legitimacyScore: number;
  readonly riskFlags: number;
  readonly townRuleOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly chronicleOwnerVersion: number;
  readonly sourceEventId: number;
  readonly sourceOwnerVersion: number;
  readonly startsAtTick: number;
  readonly expiresAtTick: number;
  readonly priority: number;
  readonly stableOwnerId: number;
  readonly stableSequence: number;
}

export interface M5GovernanceHookView extends M5GovernanceHookInput {
  readonly hookVersion: number;
  readonly ownerVersion: number;
}

export type M5GovernanceMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly hookId: number;
      readonly ownerVersion: number;
      readonly reason: M5GovernanceReason;
    }
  | { readonly ok: false; readonly reason: M5GovernanceReason };

export interface M5GovernanceHookQuery {
  readonly policyId: number;
  readonly expectedOwnerVersion: number;
  readonly tick: number;
  readonly hookKindMask: number;
  readonly minLegitimacyScore: number;
  readonly blockedRiskFlags: number;
  readonly candidateCap: number;
  readonly scanCap: number;
}

export type M5GovernanceHookQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly scanCapHit: boolean;
      readonly allowed: boolean;
      readonly policyPressureScore: number;
      readonly enforcementCapacity: number;
      readonly legitimacyScore: number;
      readonly riskFlags: number;
      readonly ownerVersion: number;
      readonly reason: M5GovernanceReason;
    }
  | { readonly ok: false; readonly reason: M5GovernanceReason };

export interface M5GovernanceMetrics {
  readonly ownerVersion: number;
  readonly activeHookCount: number;
  readonly indexedHookCount: number;
  readonly councilPostAuthorityCount: number;
  readonly temporaryPolicyAuthorityCount: number;
  readonly enforcementCapacityCount: number;
  readonly legitimacySourceCount: number;
  readonly riskFlagCount: number;
  readonly lastQueryVisits: number;
  readonly totalQueryVisits: number;
  readonly lastQuerySelected: number;
  readonly queryCapHitCount: number;
  readonly staleBasisRejectCount: number;
  readonly riskBlockedCount: number;
  readonly insufficientLegitimacyCount: number;
}
