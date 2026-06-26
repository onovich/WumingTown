import type { NamedRandomStreams } from "./deterministic-rng";

export const M5_SEASON_EVENT_NONE = 0xffff_ffff;
export const M5_SEASON_EVENT_POOL_FIRST_SEASON = 1;

export const M5_SEASON_EVENT_KIND_INCIDENT = 1;
export const M5_SEASON_EVENT_KIND_RECOVERY = 2;

export const M5_SEASON_EVENT_THEME_RESOURCE_PRESSURE = 1;
export const M5_SEASON_EVENT_THEME_REGISTRATION_PRESSURE = 2;
export const M5_SEASON_EVENT_THEME_MARKET_NIGHT = 3;
export const M5_SEASON_EVENT_THEME_BRIDGE_ROUTE_PRESSURE = 4;
export const M5_SEASON_EVENT_THEME_ARCHIVE_DAMAGE_RISK = 5;

export const M5_SEASON_RECOVERY_NONE = 0;
export const M5_SEASON_RECOVERY_RESOURCE = 1;
export const M5_SEASON_RECOVERY_REGISTRATION = 2;
export const M5_SEASON_RECOVERY_MARKET = 3;
export const M5_SEASON_RECOVERY_BRIDGE_ROUTE = 4;
export const M5_SEASON_RECOVERY_ARCHIVE = 5;

export const M5_SEASON_COMMAND_SCHEDULE_EVENT = 1;
export const M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY = 2;
export const M5_SEASON_COMMAND_REGISTRATION_OPPORTUNITY = 3;
export const M5_SEASON_COMMAND_MARKET_NIGHT_OPPORTUNITY = 4;
export const M5_SEASON_COMMAND_BRIDGE_ROUTE_OPPORTUNITY = 5;
export const M5_SEASON_COMMAND_ARCHIVE_REPAIR_OPPORTUNITY = 6;

export const M5_SEASON_PRECONDITION_RESOURCE_PRESSURE = 1;
export const M5_SEASON_PRECONDITION_REGISTRATION_PRESSURE = 1 << 1;
export const M5_SEASON_PRECONDITION_MARKET_NIGHT = 1 << 2;
export const M5_SEASON_PRECONDITION_BRIDGE_ROUTE = 1 << 3;
export const M5_SEASON_PRECONDITION_ARCHIVE_RISK = 1 << 4;
export const M5_SEASON_PRECONDITION_ALL =
  M5_SEASON_PRECONDITION_RESOURCE_PRESSURE |
  M5_SEASON_PRECONDITION_REGISTRATION_PRESSURE |
  M5_SEASON_PRECONDITION_MARKET_NIGHT |
  M5_SEASON_PRECONDITION_BRIDGE_ROUTE |
  M5_SEASON_PRECONDITION_ARCHIVE_RISK;

export type M5SeasonEventReason =
  | "m5_season_event_id_out_of_range"
  | "m5_season_event_value_out_of_range"
  | "m5_season_event_basis_version_invalid"
  | "m5_season_event_pool_id_invalid"
  | "m5_season_event_candidate_already_registered"
  | "m5_season_event_candidate_not_registered"
  | "m5_season_event_candidate_registered"
  | "m5_season_event_recovery_window_opened"
  | "m5_season_event_recovery_window_already_open"
  | "m5_season_event_query_stale_basis"
  | "m5_season_event_candidate_cap_invalid"
  | "m5_season_event_selected_cap_invalid"
  | "m5_season_event_output_too_small"
  | "m5_season_event_stream_name_invalid"
  | "m5_season_event_candidate_cap_reached"
  | "m5_season_event_selected_cap_reached"
  | "m5_season_event_no_candidate"
  | "m5_season_event_cooldown_active"
  | "m5_season_event_precondition_failed"
  | "m5_season_event_freshness_rejected"
  | "m5_season_event_time_rejected"
  | "m5_season_event_incident_selected"
  | "m5_season_event_recovery_selected"
  | "m5_season_event_recovery_window_active"
  | "m5_season_event_wrong_recovery_type"
  | "m5_season_event_version_exhausted";

export interface M5SeasonEventPoolStoreOptions {
  readonly candidateCapacity: number;
  readonly cooldownCapacity: number;
  readonly recoveryWindowCapacity: number;
  readonly preconditionFailureCapacity: number;
}

export interface M5SeasonEventCandidateInput {
  readonly candidateId: number;
  readonly poolId: number;
  readonly candidateKind: number;
  readonly theme: number;
  readonly recoveryType: number;
  readonly score: number;
  readonly priority: number;
  readonly cooldownKey: number;
  readonly cooldownTicks: number;
  readonly freshnessWindowTicks: number;
  readonly commandKind: number;
  readonly commandTargetId: number;
  readonly sourceEventDefId: number;
  readonly anomalyOwnerVersion: number;
  readonly factionOwnerVersion: number;
  readonly governanceOwnerVersion: number;
  readonly seasonOwnerVersion: number;
  readonly resourceOwnerVersion: number;
  readonly recoveryBasisVersion: number;
  readonly availableTick: number;
  readonly expiresTick: number;
  readonly preconditionMask: number;
  readonly stableOwnerId: number;
  readonly stableSequence: number;
}

export interface M5SeasonEventCandidateView extends M5SeasonEventCandidateInput {
  readonly candidateVersion: number;
  readonly ownerVersion: number;
}

export interface M5SeasonRecoveryWindowInput {
  readonly windowId: number;
  readonly recoveryType: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly sourceCandidateVersion: number;
}

export interface M5SeasonRecoveryWindowView extends M5SeasonRecoveryWindowInput {
  readonly active: number;
  readonly windowVersion: number;
  readonly ownerVersion: number;
}

export interface M5SeasonEventSelectionQuery {
  readonly poolId: number;
  readonly expectedPoolVersion: number;
  readonly tick: number;
  readonly satisfiedPreconditionMask: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly streamName: string;
  readonly randomStreams: NamedRandomStreams;
}

export type M5SeasonEventSelectionResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly rejectedCooldownCount: number;
      readonly rejectedPreconditionCount: number;
      readonly rejectedFreshnessCount: number;
      readonly rejectedTimeCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly recoveryWindowActive: boolean;
      readonly selectedCandidateId: number;
      readonly selectedCommandKind: number;
      readonly selectedCommandTargetId: number;
      readonly selectedRecoveryType: number;
      readonly randomChoiceIndex: number;
      readonly randomDraw: number;
      readonly ownerVersion: number;
      readonly reason: M5SeasonEventReason;
    }
  | { readonly ok: false; readonly reason: M5SeasonEventReason };

export type M5SeasonEventMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly ownerVersion: number;
      readonly reason: M5SeasonEventReason;
    }
  | { readonly ok: false; readonly reason: M5SeasonEventReason };

export interface M5SeasonPreconditionFailureView {
  readonly sequence: number;
  readonly tick: number;
  readonly candidateId: number;
  readonly missingPreconditionMask: number;
  readonly reason: M5SeasonEventReason;
  readonly ownerVersion: number;
}

export interface M5SeasonEventMetrics {
  readonly ownerVersion: number;
  readonly activeIncidentCandidateCount: number;
  readonly activeRecoveryCandidateCount: number;
  readonly recoveryWindowCount: number;
  readonly activeRecoveryWindowId: number;
  readonly selectionCount: number;
  readonly lastCandidateVisits: number;
  readonly totalCandidateVisits: number;
  readonly cooldownWriteCount: number;
  readonly eventFreshnessWriteCount: number;
  readonly preconditionFailureCount: number;
  readonly preconditionFailureStoredCount: number;
  readonly nextPreconditionFailureSequence: number;
}
