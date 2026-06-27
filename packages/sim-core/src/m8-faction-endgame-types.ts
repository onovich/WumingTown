export const M8_FACTION_ENDGAME_NONE = 0xffff_ffff;

export const M8_FACTION_REGISTRY_OFFICE = 0;
export const M8_FACTION_NINE_INNS_GUILD = 1;
export const M8_FACTION_MOUNTAIN_CONTRACT_FAMILIES = 2;
export const M8_FACTION_NIGHT_MARKET_GUESTS = 3;
export const M8_FACTION_RETURN_LAMP_SOCIETY = 4;
export const M8_FACTION_TOWN_COUNCIL_POSTS = 5;
export const M8_FACTION_COUNT = 6;
export const M8_FACTION_MASK_ALL = (1 << M8_FACTION_COUNT) - 1;

export const M8_ENDGAME_ROUTE_HUMAN_TOWN = 0;
export const M8_ENDGAME_ROUTE_COHABITATION_TOWN = 1;
export const M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN = 2;
export const M8_ENDGAME_ROUTE_UNLIT_TOWN = 3;
export const M8_ENDGAME_ROUTE_MIGRATION = 4;
export const M8_ENDGAME_ROUTE_COUNT = 5;

export const M8_FACTION_ARC_STATE_SEEDED = 1;
export const M8_FACTION_ARC_STATE_NEGOTIATED = 2;
export const M8_FACTION_ARC_STATE_FAILED = 3;

export const M8_ENDGAME_ROUTE_STATE_SEEDED = 1;
export const M8_ENDGAME_ROUTE_STATE_AVAILABLE = 2;
export const M8_ENDGAME_ROUTE_STATE_BLOCKED = 3;
export const M8_ENDGAME_ROUTE_STATE_CONTESTED = 4;

export const M8_FACTION_RESOURCE_LEGAL_RECOGNITION = 1;
export const M8_FACTION_RESOURCE_TRADE_SUPPLY = 1 << 1;
export const M8_FACTION_RESOURCE_LOCAL_KNOWLEDGE = 1 << 2;
export const M8_FACTION_RESOURCE_CONTRACT_SERVICE = 1 << 3;
export const M8_FACTION_RESOURCE_MEMORIAL_TRUST = 1 << 4;
export const M8_FACTION_RESOURCE_COUNCIL_AUTHORITY = 1 << 5;
export const M8_FACTION_RESOURCE_MASK_ALL =
  M8_FACTION_RESOURCE_LEGAL_RECOGNITION |
  M8_FACTION_RESOURCE_TRADE_SUPPLY |
  M8_FACTION_RESOURCE_LOCAL_KNOWLEDGE |
  M8_FACTION_RESOURCE_CONTRACT_SERVICE |
  M8_FACTION_RESOURCE_MEMORIAL_TRUST |
  M8_FACTION_RESOURCE_COUNCIL_AUTHORITY;

export const M8_FACTION_CONSTRAINT_CENSORSHIP_RISK = 1;
export const M8_FACTION_CONSTRAINT_DEBT_COMMERCIALIZATION = 1 << 1;
export const M8_FACTION_CONSTRAINT_INHERITED_CLAIMS = 1 << 2;
export const M8_FACTION_CONSTRAINT_LONG_DEBT_TERMS = 1 << 3;
export const M8_FACTION_CONSTRAINT_MEMORIAL_DUTY = 1 << 4;
export const M8_FACTION_CONSTRAINT_COERCIVE_POLICY = 1 << 5;
export const M8_FACTION_CONSTRAINT_MASK_ALL =
  M8_FACTION_CONSTRAINT_CENSORSHIP_RISK |
  M8_FACTION_CONSTRAINT_DEBT_COMMERCIALIZATION |
  M8_FACTION_CONSTRAINT_INHERITED_CLAIMS |
  M8_FACTION_CONSTRAINT_LONG_DEBT_TERMS |
  M8_FACTION_CONSTRAINT_MEMORIAL_DUTY |
  M8_FACTION_CONSTRAINT_COERCIVE_POLICY;

export const M8_ENDGAME_EXPLANATION_CHRONICLE = 1;
export const M8_ENDGAME_EXPLANATION_OBLIGATION = 1 << 1;
export const M8_ENDGAME_EXPLANATION_ORDINANCE = 1 << 2;
export const M8_ENDGAME_EXPLANATION_COUNTEREVIDENCE = 1 << 3;
export const M8_ENDGAME_EXPLANATION_ACCIDENT_REVIEW = 1 << 4;
export const M8_ENDGAME_REQUIRED_EXPLANATION_MASK =
  M8_ENDGAME_EXPLANATION_CHRONICLE |
  M8_ENDGAME_EXPLANATION_OBLIGATION |
  M8_ENDGAME_EXPLANATION_ORDINANCE;
export const M8_ENDGAME_EXPLANATION_MASK_ALL =
  M8_ENDGAME_REQUIRED_EXPLANATION_MASK |
  M8_ENDGAME_EXPLANATION_COUNTEREVIDENCE |
  M8_ENDGAME_EXPLANATION_ACCIDENT_REVIEW;

export type M8FactionEndgameReason =
  | "m8_faction_endgame_arc_id_out_of_range"
  | "m8_faction_endgame_route_id_out_of_range"
  | "m8_faction_endgame_faction_id_out_of_range"
  | "m8_faction_endgame_state_invalid"
  | "m8_faction_endgame_state_transition_invalid"
  | "m8_faction_endgame_mask_invalid"
  | "m8_faction_endgame_score_invalid"
  | "m8_faction_endgame_source_version_invalid"
  | "m8_faction_endgame_owner_version_exhausted"
  | "m8_faction_endgame_arc_already_registered"
  | "m8_faction_endgame_arc_registered"
  | "m8_faction_endgame_arc_transitioned"
  | "m8_faction_endgame_route_already_registered"
  | "m8_faction_endgame_route_registered"
  | "m8_faction_endgame_query_cap_invalid"
  | "m8_faction_endgame_query_output_too_small"
  | "m8_faction_endgame_query_stale_basis"
  | "m8_faction_endgame_query_indexed"
  | "m8_faction_endgame_query_no_candidate"
  | "m8_faction_endgame_query_cap_reached"
  | "m8_faction_endgame_query_scan_cap_reached"
  | "m8_faction_endgame_route_available"
  | "m8_faction_endgame_route_blocked_low_support"
  | "m8_faction_endgame_route_blocked_missing_explanation"
  | "m8_faction_endgame_route_contested";

export interface M8FactionArcInput {
  readonly arcId: number;
  readonly factionId: number;
  readonly resourceMask: number;
  readonly constraintMask: number;
  readonly contradictionMask: number;
  readonly negotiationMask: number;
  readonly failureMask: number;
  readonly explanationMask: number;
  readonly factionOwnerVersion: number;
  readonly governanceOwnerVersion: number;
  readonly chronicleOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly ordinanceOwnerVersion: number;
  readonly sourceEventId: number;
  readonly sourceOwnerVersion: number;
  readonly priority: number;
  readonly stableSequence: number;
}

export interface M8FactionArcView extends M8FactionArcInput {
  readonly state: number;
  readonly arcVersion: number;
  readonly ownerVersion: number;
}

export interface M8FactionArcTransitionInput {
  readonly arcId: number;
  readonly expectedOwnerVersion: number;
  readonly nextState: number;
  readonly tick: number;
}

export interface M8EndgameRouteInput {
  readonly routeId: number;
  readonly supportScore: number;
  readonly costScore: number;
  readonly oppositionScore: number;
  readonly explanationMask: number;
  readonly factionSupportMask: number;
  readonly factionOppositionMask: number;
  readonly lampBoundaryScore: number;
  readonly chronicleScore: number;
  readonly obligationPressure: number;
  readonly ordinanceLegitimacy: number;
  readonly socialTrustScore: number;
  readonly productionScore: number;
  readonly factionOwnerVersion: number;
  readonly governanceOwnerVersion: number;
  readonly chronicleOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly ordinanceOwnerVersion: number;
  readonly sourceEventId: number;
  readonly sourceOwnerVersion: number;
  readonly priority: number;
  readonly stableSequence: number;
}

export interface M8EndgameRouteView extends M8EndgameRouteInput {
  readonly routePathId: number;
  readonly state: number;
  readonly routeVersion: number;
  readonly ownerVersion: number;
}

export interface M8FactionArcQuery {
  readonly factionId: number;
  readonly expectedOwnerVersion: number;
  readonly candidateCap: number;
  readonly scanCap: number;
}

export interface M8EndgameRouteEvaluationQuery {
  readonly routeId: number;
  readonly expectedOwnerVersion: number;
  readonly minSupportScore: number;
  readonly maxCostScore: number;
  readonly maxOppositionScore: number;
  readonly requiredExplanationMask: number;
  readonly candidateCap: number;
  readonly scanCap: number;
}

export type M8FactionEndgameMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly ownerVersion: number;
      readonly reason: M8FactionEndgameReason;
    }
  | { readonly ok: false; readonly reason: M8FactionEndgameReason };

export type M8FactionArcQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly scanCapHit: boolean;
      readonly ownerVersion: number;
      readonly reason: M8FactionEndgameReason;
    }
  | { readonly ok: false; readonly reason: M8FactionEndgameReason };

export type M8EndgameRouteEvaluationResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly scanCapHit: boolean;
      readonly routeState: number;
      readonly supportScore: number;
      readonly costScore: number;
      readonly oppositionScore: number;
      readonly explanationMask: number;
      readonly ownerVersion: number;
      readonly reason: M8FactionEndgameReason;
    }
  | { readonly ok: false; readonly reason: M8FactionEndgameReason };

export interface M8FactionEndgameMetrics {
  readonly ownerVersion: number;
  readonly activeArcCount: number;
  readonly activeRoutePathCount: number;
  readonly indexedArcCount: number;
  readonly indexedRoutePathCount: number;
  readonly negotiatedArcCount: number;
  readonly failedArcCount: number;
  readonly availableRouteCount: number;
  readonly blockedRouteCount: number;
  readonly contestedRouteCount: number;
  readonly lastQueryVisits: number;
  readonly totalQueryVisits: number;
  readonly lastQuerySelected: number;
  readonly queryCapHitCount: number;
  readonly staleBasisRejectCount: number;
}

export interface M8FactionEndgameStoreOptions {
  readonly arcCapacity: number;
  readonly routePathCapacity: number;
}
