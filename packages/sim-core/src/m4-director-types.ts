import type { NamedRandomStreams } from "./deterministic-rng";

export const M4_DIRECTOR_NONE = 0xffff_ffff;

export const M4_DIRECTOR_CANDIDATE_INCIDENT = 1;
export const M4_DIRECTOR_CANDIDATE_RECOVERY = 2;

export const M4_DIRECTOR_THEME_LAMP = 1;
export const M4_DIRECTOR_THEME_EVIDENCE = 2;
export const M4_DIRECTOR_THEME_OBLIGATION = 3;
export const M4_DIRECTOR_THEME_CRISIS = 4;
export const M4_DIRECTOR_THEME_INJURY = 5;
export const M4_DIRECTOR_THEME_MENTAL = 6;
export const M4_DIRECTOR_THEME_CASE = 7;

export const M4_DIRECTOR_RECOVERY_NONE = 0;
export const M4_DIRECTOR_RECOVERY_LAMP_REPAIR = 1;
export const M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW = 2;
export const M4_DIRECTOR_RECOVERY_OBLIGATION_SETTLEMENT = 3;
export const M4_DIRECTOR_RECOVERY_REST_CARE = 4;

export const M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT = 1;
export const M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY = 2;
export const M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY = 3;
export const M4_DIRECTOR_COMMAND_OBLIGATION_SETTLEMENT_OPPORTUNITY = 4;
export const M4_DIRECTOR_COMMAND_REST_CARE_OPPORTUNITY = 5;

export type M4DirectorReason =
  | "director_id_out_of_range"
  | "director_value_out_of_range"
  | "director_basis_version_invalid"
  | "director_candidate_already_registered"
  | "director_candidate_not_registered"
  | "director_candidate_cap_invalid"
  | "director_selected_cap_invalid"
  | "director_output_too_small"
  | "director_stream_name_invalid"
  | "director_pressure_sampled"
  | "director_candidate_registered"
  | "director_recovery_window_opened"
  | "director_recovery_window_already_open"
  | "director_pressure_missing"
  | "director_candidate_cap_reached"
  | "director_selected_cap_reached"
  | "director_no_candidate"
  | "director_cooldown_active"
  | "director_pressure_rejected"
  | "director_time_rejected"
  | "director_incident_selected"
  | "director_recovery_selected"
  | "director_recovery_window_active"
  | "director_version_exhausted";

export interface M4DirectorPressureStoreOptions {
  readonly sampleCapacity: number;
  readonly candidateCapacity: number;
  readonly cooldownCapacity: number;
  readonly recoveryWindowCapacity: number;
  readonly traceCapacity: number;
}

export interface M4DirectorPressureSampleInput {
  readonly tick: number;
  readonly lampOwnerVersion: number;
  readonly evidenceOwnerVersion: number;
  readonly obligationOwnerVersion: number;
  readonly crisisOwnerVersion: number;
  readonly healthOwnerVersion: number;
  readonly relationshipOwnerVersion: number;
  readonly caseOwnerVersion: number;
  readonly lampPressure: number;
  readonly evidencePressure: number;
  readonly obligationPressure: number;
  readonly crisisPressure: number;
  readonly injuryPressure: number;
  readonly mentalRiskPressure: number;
  readonly unresolvedCasePressure: number;
}

export interface M4DirectorPressureSampleView extends M4DirectorPressureSampleInput {
  readonly sampleSequence: number;
  readonly totalPressure: number;
  readonly ownerVersion: number;
}

export interface M4DirectorCandidateInput {
  readonly candidateId: number;
  readonly candidateKind: number;
  readonly theme: number;
  readonly recoveryType: number;
  readonly score: number;
  readonly priority: number;
  readonly pressureMin: number;
  readonly cooldownKey: number;
  readonly cooldownTicks: number;
  readonly commandKind: number;
  readonly commandTargetId: number;
  readonly sourceOwnerVersion: number;
  readonly availableTick: number;
  readonly expiresTick: number;
}

export interface M4DirectorCandidateView extends M4DirectorCandidateInput {
  readonly candidateVersion: number;
  readonly ownerVersion: number;
}

export interface M4DirectorRecoveryWindowInput {
  readonly windowId: number;
  readonly recoveryType: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly sourceSampleVersion: number;
}

export interface M4DirectorRecoveryWindowView extends M4DirectorRecoveryWindowInput {
  readonly active: number;
  readonly windowVersion: number;
  readonly ownerVersion: number;
}

export interface M4DirectorSelectionQuery {
  readonly tick: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly streamName: string;
  readonly randomStreams: NamedRandomStreams;
}

export type M4DirectorSelectionResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly rejectedCooldownCount: number;
      readonly rejectedPressureCount: number;
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
      readonly reason: M4DirectorReason;
    }
  | { readonly ok: false; readonly reason: M4DirectorReason };

export type M4DirectorMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly ownerVersion: number;
      readonly reason: M4DirectorReason;
    }
  | { readonly ok: false; readonly reason: M4DirectorReason };

export interface M4DirectorTraceView {
  readonly sequence: number;
  readonly tick: number;
  readonly selectedCandidateId: number;
  readonly selectedCommandKind: number;
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly recoveryWindowActive: number;
  readonly reason: M4DirectorReason;
  readonly ownerVersion: number;
}

export interface M4DirectorMetrics {
  readonly ownerVersion: number;
  readonly pressureSampleCount: number;
  readonly activeIncidentCandidateCount: number;
  readonly activeRecoveryCandidateCount: number;
  readonly recoveryWindowCount: number;
  readonly activeRecoveryWindowId: number;
  readonly selectionCount: number;
  readonly lastCandidateVisits: number;
  readonly totalCandidateVisits: number;
  readonly cooldownWriteCount: number;
  readonly traceStoredCount: number;
  readonly nextTraceSequence: number;
}
