export const M4_CHRONICLE_NONE = 0xffff_ffff;

export const M4_CHRONICLE_CASE_STATUS_OPEN = 1;
export const M4_CHRONICLE_CASE_STATUS_CLOSED = 2;

export const M4_CHRONICLE_CHANGE_CASE_OPENED = 1;
export const M4_CHRONICLE_CHANGE_SOURCE_ADDED = 2;
export const M4_CHRONICLE_CHANGE_EVIDENCE_ADDED = 3;
export const M4_CHRONICLE_CHANGE_HYPOTHESIS_ADDED = 4;
export const M4_CHRONICLE_CHANGE_CONTRADICTION_ADDED = 5;
export const M4_CHRONICLE_CHANGE_CONTRADICTION_RESOLVED = 6;
export const M4_CHRONICLE_CHANGE_RULE_CONFIRMED = 7;
export const M4_CHRONICLE_CHANGE_DISSEMINATED = 8;

export const M4_EVIDENCE_CLASS_OBSERVATION = 1;
export const M4_EVIDENCE_CLASS_TESTIMONY = 2;
export const M4_EVIDENCE_CLASS_TRACE = 3;
export const M4_EVIDENCE_CLASS_SOURCE = 4;

export const M4_EVIDENCE_SOURCE_PERSON = 1;
export const M4_EVIDENCE_SOURCE_SCENE = 2;
export const M4_EVIDENCE_SOURCE_ARCHIVE = 3;
export const M4_EVIDENCE_SOURCE_OBJECT = 4;

export const M4_EVIDENCE_TIER_NONE = 0;
export const M4_EVIDENCE_TIER_RUMOR = 1;
export const M4_EVIDENCE_TIER_THIN = 2;
export const M4_EVIDENCE_TIER_CREDIBLE = 3;
export const M4_EVIDENCE_TIER_HIGHLY_CREDIBLE = 4;
export const M4_EVIDENCE_TIER_CONFIRMED = 5;

export const M4_CONTRADICTION_SEVERITY_MINOR = 1;
export const M4_CONTRADICTION_SEVERITY_MAJOR = 2;
export const M4_CONTRADICTION_SEVERITY_FATAL = 3;

export const M4_KNOWLEDGE_KIND_HYPOTHESIS = 1;
export const M4_KNOWLEDGE_KIND_CONFIRMED_RULE = 2;
export const M4_KNOWLEDGE_KIND_TEMPORARY_POLICY = 3;

export const M4_EVIDENCE_DEFAULT_CANDIDATE_CAP = 32;
export const M4_EVIDENCE_DEFAULT_SELECTED_CAP = 16;

export type M4ChronicleReason =
  | "chronicle_id_out_of_range"
  | "chronicle_case_not_registered"
  | "chronicle_case_already_registered"
  | "chronicle_case_closed"
  | "chronicle_status_invalid"
  | "chronicle_value_out_of_range"
  | "chronicle_version_capacity_full"
  | "chronicle_version_exhausted"
  | "evidence_source_not_registered"
  | "evidence_source_already_registered"
  | "evidence_row_not_registered"
  | "evidence_row_already_registered"
  | "evidence_hypothesis_not_registered"
  | "evidence_hypothesis_already_registered"
  | "evidence_contradiction_not_registered"
  | "evidence_contradiction_already_registered"
  | "evidence_confirmed_rule_not_registered"
  | "evidence_confirmed_rule_already_registered"
  | "evidence_class_invalid"
  | "evidence_source_kind_invalid"
  | "evidence_quality_invalid"
  | "evidence_case_mismatch"
  | "evidence_support_invalid"
  | "evidence_candidate_cap_invalid"
  | "evidence_selected_cap_invalid"
  | "evidence_output_too_small"
  | "evidence_support_below_threshold"
  | "evidence_independent_class_insufficient"
  | "evidence_fatal_contradiction_unresolved"
  | "evidence_trace_capacity_invalid"
  | "knowledge_resident_out_of_range"
  | "knowledge_subject_kind_invalid"
  | "knowledge_dirty_queue_full"
  | "knowledge_dirty_budget_invalid"
  | "knowledge_dirty_output_too_small";

export type M4ChronicleChangeKind =
  | typeof M4_CHRONICLE_CHANGE_CASE_OPENED
  | typeof M4_CHRONICLE_CHANGE_SOURCE_ADDED
  | typeof M4_CHRONICLE_CHANGE_EVIDENCE_ADDED
  | typeof M4_CHRONICLE_CHANGE_HYPOTHESIS_ADDED
  | typeof M4_CHRONICLE_CHANGE_CONTRADICTION_ADDED
  | typeof M4_CHRONICLE_CHANGE_CONTRADICTION_RESOLVED
  | typeof M4_CHRONICLE_CHANGE_RULE_CONFIRMED
  | typeof M4_CHRONICLE_CHANGE_DISSEMINATED;

export type M4EvidenceClass =
  | typeof M4_EVIDENCE_CLASS_OBSERVATION
  | typeof M4_EVIDENCE_CLASS_TESTIMONY
  | typeof M4_EVIDENCE_CLASS_TRACE
  | typeof M4_EVIDENCE_CLASS_SOURCE;

export type M4EvidenceSourceKind =
  | typeof M4_EVIDENCE_SOURCE_PERSON
  | typeof M4_EVIDENCE_SOURCE_SCENE
  | typeof M4_EVIDENCE_SOURCE_ARCHIVE
  | typeof M4_EVIDENCE_SOURCE_OBJECT;

export type M4EvidenceSupportTier =
  | typeof M4_EVIDENCE_TIER_NONE
  | typeof M4_EVIDENCE_TIER_RUMOR
  | typeof M4_EVIDENCE_TIER_THIN
  | typeof M4_EVIDENCE_TIER_CREDIBLE
  | typeof M4_EVIDENCE_TIER_HIGHLY_CREDIBLE
  | typeof M4_EVIDENCE_TIER_CONFIRMED;

export type M4ContradictionSeverity =
  | typeof M4_CONTRADICTION_SEVERITY_MINOR
  | typeof M4_CONTRADICTION_SEVERITY_MAJOR
  | typeof M4_CONTRADICTION_SEVERITY_FATAL;

export type M4KnowledgeSubjectKind =
  | typeof M4_KNOWLEDGE_KIND_HYPOTHESIS
  | typeof M4_KNOWLEDGE_KIND_CONFIRMED_RULE
  | typeof M4_KNOWLEDGE_KIND_TEMPORARY_POLICY;

export interface M4ChronicleVersionRecorder {
  recordVersion(
    caseId: number,
    changeKind: M4ChronicleChangeKind,
    subjectId: number,
    tick: number,
  ):
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: M4ChronicleReason };
}

export function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

export function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

export function requirePositiveSafeInteger(value: number, label: string): number {
  if (!isPositiveSafeInteger(value)) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}

export function isEvidenceClass(value: number): value is M4EvidenceClass {
  return (
    value === M4_EVIDENCE_CLASS_OBSERVATION ||
    value === M4_EVIDENCE_CLASS_TESTIMONY ||
    value === M4_EVIDENCE_CLASS_TRACE ||
    value === M4_EVIDENCE_CLASS_SOURCE
  );
}

export function isEvidenceSourceKind(value: number): value is M4EvidenceSourceKind {
  return (
    value === M4_EVIDENCE_SOURCE_PERSON ||
    value === M4_EVIDENCE_SOURCE_SCENE ||
    value === M4_EVIDENCE_SOURCE_ARCHIVE ||
    value === M4_EVIDENCE_SOURCE_OBJECT
  );
}

export function isContradictionSeverity(value: number): value is M4ContradictionSeverity {
  return (
    value === M4_CONTRADICTION_SEVERITY_MINOR ||
    value === M4_CONTRADICTION_SEVERITY_MAJOR ||
    value === M4_CONTRADICTION_SEVERITY_FATAL
  );
}

export function isKnowledgeSubjectKind(value: number): value is M4KnowledgeSubjectKind {
  return (
    value === M4_KNOWLEDGE_KIND_HYPOTHESIS ||
    value === M4_KNOWLEDGE_KIND_CONFIRMED_RULE ||
    value === M4_KNOWLEDGE_KIND_TEMPORARY_POLICY
  );
}
