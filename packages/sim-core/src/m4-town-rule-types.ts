export const M4_TOWN_RULE_NONE = 0xffff_ffff;

export const M4_TOWN_RULE_SCOPE_TRAVELER = 1;
export const M4_TOWN_RULE_SCOPE_RESIDENT = 2;
export const M4_TOWN_RULE_SCOPE_ROLE = 3;

export const M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION = 1;
export const M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK = 2;

export const M4_TOWN_RULE_ACTION_CONFIRM_NAME = 1;
export const M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK = 2;

export const M4_TOWN_RULE_EXCEPTION_EMERGENCY = 1;
export const M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY = 2;

export const M4_TOWN_RULE_ENFORCEMENT_NIGHT_WATCH = 1;
export const M4_TOWN_RULE_ENFORCEMENT_KEEPER = 2;

export const M4_TOWN_RULE_LEGITIMACY_PLAYER_TEMPORARY = 1;
export const M4_TOWN_RULE_LEGITIMACY_CHRONICLE_CONFIRMED = 2;

export const M4_TOWN_RULE_PENALTY_WARNING = 1;
export const M4_TOWN_RULE_PENALTY_DENY_ENTRY = 2;

export const M4_TOWN_RULE_STATE_ACTIVE = 1;
export const M4_TOWN_RULE_STATE_SUSPENDED = 2;
export const M4_TOWN_RULE_STATE_RETIRED = 3;

export const M4_TOWN_RULE_DEFAULT_TRIGGER_CAPACITY = 16;
export const M4_TOWN_RULE_DEFAULT_ACTION_CAPACITY = 16;

export type M4TownRuleReason =
  | "town_rule_id_out_of_range"
  | "town_rule_already_registered"
  | "town_rule_not_registered"
  | "town_rule_value_out_of_range"
  | "town_rule_time_window_invalid"
  | "town_rule_terminal_state"
  | "town_rule_candidate_cap_invalid"
  | "town_rule_output_too_small"
  | "town_rule_candidates_indexed"
  | "town_rule_no_candidate"
  | "town_rule_candidate_cap_reached"
  | "town_rule_scan_cap_reached"
  | "town_rule_compliance_allowed"
  | "town_rule_rejected_unknown"
  | "town_rule_rejected_need"
  | "town_rule_rejected_relationship"
  | "town_rule_rejected_fear"
  | "town_rule_rejected_emergency_exception"
  | "town_rule_rejected_confirmed_identity_exception"
  | "town_rule_rejected_obligation_pressure"
  | "town_rule_enforcement_cost_applied"
  | "town_rule_version_exhausted";

export interface M4TownRuleStoreOptions {
  readonly ruleCapacity: number;
  readonly subjectCapacity: number;
  readonly regionCapacity: number;
  readonly triggerCapacity?: number;
  readonly actionCapacity?: number;
}

export interface M4TownRuleInput {
  readonly ruleId: number;
  readonly subjectScope: number;
  readonly timeStartTick: number;
  readonly timeEndTick: number;
  readonly regionId: number;
  readonly trigger: number;
  readonly action: number;
  readonly exception: number;
  readonly enforcementMethod: number;
  readonly enforcementCost: number;
  readonly legitimacySource: number;
  readonly penalty: number;
}

export interface M4TownRuleView extends M4TownRuleInput {
  readonly state: number;
  readonly ruleVersion: number;
  readonly ownerVersion: number;
}

export interface M4TownRuleComplianceContext {
  readonly subjectId: number;
  readonly regionId: number;
  readonly trigger: number;
  readonly action: number;
  readonly tick: number;
  readonly knowsRule: number;
  readonly needPressure: number;
  readonly relationshipPressure: number;
  readonly fear: number;
  readonly enforcementRisk: number;
  readonly emergency: number;
  readonly confirmedIdentity: number;
  readonly obligationPressure: number;
  readonly candidateCap: number;
  readonly scanCap: number;
}

export type M4TownRuleMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly ruleId: number;
      readonly ownerVersion: number;
      readonly reason: M4TownRuleReason;
    }
  | { readonly ok: false; readonly reason: M4TownRuleReason };

export type M4TownRuleComplianceResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly scanCapHit: boolean;
      readonly selectedRuleId: number;
      readonly enforcementCost: number;
      readonly ownerVersion: number;
      readonly reason: M4TownRuleReason;
    }
  | { readonly ok: false; readonly reason: M4TownRuleReason };

export interface M4TownRuleMetrics {
  readonly ownerVersion: number;
  readonly activeCount: number;
  readonly complianceIndexedCount: number;
  readonly lastComplianceCandidateVisits: number;
  readonly totalComplianceCandidateVisits: number;
  readonly enforcementCostTotal: number;
}
