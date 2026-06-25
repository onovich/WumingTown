export const M4_OBLIGATION_NONE = 0xffff_ffff;

export const M4_OBLIGATION_TYPE_MATERIAL = 1;
export const M4_OBLIGATION_TYPE_WITNESS = 2;
export const M4_OBLIGATION_TYPE_IDENTITY = 3;
export const M4_OBLIGATION_TYPE_PROTECTION = 4;

export const M4_OBLIGATION_CONDITION_LAMP_OIL_DUTY = 1;
export const M4_OBLIGATION_CONDITION_LODGING_WITNESS_DUTY = 2;
export const M4_OBLIGATION_CONDITION_NAME_CONFIRMATION = 3;

export const M4_OBLIGATION_ACTION_DELIVER_OIL = 1;
export const M4_OBLIGATION_ACTION_GIVE_TESTIMONY = 2;
export const M4_OBLIGATION_ACTION_CONFIRM_NAME = 3;

export const M4_OBLIGATION_VIOLATION_LAMP_GAP_RISK = 1;
export const M4_OBLIGATION_VIOLATION_EVIDENCE_WITHHELD = 2;
export const M4_OBLIGATION_VIOLATION_IDENTITY_UNCONFIRMED = 3;

export const M4_OBLIGATION_STATE_ACTIVE = 1;
export const M4_OBLIGATION_STATE_FULFILLED = 2;
export const M4_OBLIGATION_STATE_VIOLATED = 3;

export const M4_OBLIGATION_VISIBILITY_PUBLIC = 1;
export const M4_OBLIGATION_VISIBILITY_ROLE = 2;
export const M4_OBLIGATION_VISIBILITY_PRIVATE = 3;

export const M4_OBLIGATION_INHERITANCE_PERSONAL = 1;
export const M4_OBLIGATION_INHERITANCE_ROLE = 2;
export const M4_OBLIGATION_INHERITANCE_HOUSEHOLD = 3;

export type M4ObligationReason =
  | "obligation_id_out_of_range"
  | "obligation_already_registered"
  | "obligation_not_registered"
  | "obligation_terminal_state"
  | "obligation_value_out_of_range"
  | "obligation_due_window_invalid"
  | "obligation_state_invalid"
  | "obligation_candidate_cap_invalid"
  | "obligation_output_too_small"
  | "obligation_due_candidates_indexed"
  | "obligation_due_no_candidate"
  | "obligation_due_candidate_cap_reached"
  | "obligation_due_scan_cap_reached"
  | "obligation_fulfilled"
  | "obligation_violated"
  | "obligation_version_exhausted";

export interface M4ObligationStoreOptions {
  readonly obligationCapacity: number;
  readonly actorCapacity: number;
}

export interface M4ObligationInput {
  readonly obligationId: number;
  readonly creditorId: number;
  readonly debtorId: number;
  readonly obligationType: number;
  readonly condition: number;
  readonly dueStartTick: number;
  readonly dueEndTick: number;
  readonly visibility: number;
  readonly inheritanceBasis: number;
  readonly fulfillmentAction: number;
  readonly violationConsequence: number;
  readonly sourceEventId: number;
}

export interface M4ObligationView extends M4ObligationInput {
  readonly state: number;
  readonly fulfilledTick: number;
  readonly violatedTick: number;
  readonly obligationVersion: number;
  readonly ownerVersion: number;
}

export type M4ObligationMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly obligationId: number;
      readonly ownerVersion: number;
      readonly reason: M4ObligationReason;
    }
  | { readonly ok: false; readonly reason: M4ObligationReason };

export interface M4ObligationDueQuery {
  readonly debtorId: number;
  readonly windowStartTick: number;
  readonly windowEndTick: number;
  readonly candidateCap: number;
  readonly scanCap: number;
}

export type M4ObligationDueQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly scanCapHit: boolean;
      readonly ownerVersion: number;
      readonly reason: M4ObligationReason;
    }
  | { readonly ok: false; readonly reason: M4ObligationReason };

export interface M4ObligationMetrics {
  readonly ownerVersion: number;
  readonly activeCount: number;
  readonly dueIndexedCount: number;
  readonly fulfilledCount: number;
  readonly violatedCount: number;
  readonly lastDueCandidateVisits: number;
  readonly totalDueCandidateVisits: number;
}

export function m4IsIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

export function m4IsUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

export function m4IsPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function m4RequirePositiveSafeInteger(value: number, label: string): number {
  if (!m4IsPositiveSafeInteger(value)) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}
