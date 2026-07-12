export const AUTONOMY_REASON_NONE = 0;

export const AUTONOMY_REASON_IDLE_OFF_SHIFT = 100;
export const AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER = 101;
export const AUTONOMY_REASON_IDLE_RETRY_BACKOFF = 102;
export const AUTONOMY_REASON_IDLE_DECISION_DEFERRED = 103;

export const AUTONOMY_REASON_NEED_HUNGER_EMERGENCY = 200;
export const AUTONOMY_REASON_NEED_REST_PRIORITY = 201;
export const AUTONOMY_REASON_NEED_SAFETY_EMERGENCY = 202;
export const AUTONOMY_REASON_NEED_HEALTH_EMERGENCY = 203;

export const AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED = 300;
export const AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED = 301;
export const AUTONOMY_REASON_CAPABILITY_STALE_BASIS = 302;
export const AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED = 303;
export const AUTONOMY_REASON_CAPABILITY_ALLOWED = 304;

export const AUTONOMY_REASON_OFFER_EMPTY_BUCKET = 400;
export const AUTONOMY_REASON_OFFER_STALE_OWNER = 401;
export const AUTONOMY_REASON_OFFER_CANDIDATE_CAP = 402;
export const AUTONOMY_REASON_OFFER_RETAINED_CAP = 403;
export const AUTONOMY_REASON_OFFER_SELECTED = 404;

export const AUTONOMY_REASON_PATH_NO_ROUTE = 500;
export const AUTONOMY_REASON_PATH_STALE_BASIS = 501;
export const AUTONOMY_REASON_PATH_NODE_BUDGET = 502;
export const AUTONOMY_REASON_PATH_ROUTE_CAPACITY = 503;
export const AUTONOMY_REASON_PATH_EXACT_CAP = 504;
export const AUTONOMY_REASON_PATH_SELECTED = 505;

export const AUTONOMY_REASON_RESERVATION_CONFLICT = 600;
export const AUTONOMY_REASON_RESERVATION_INSUFFICIENT_AMOUNT = 601;
export const AUTONOMY_REASON_RESERVATION_STALE_TARGET = 602;
export const AUTONOMY_REASON_RESERVATION_OUTPUT_INVALID = 603;
export const AUTONOMY_REASON_RESERVATION_ACQUIRED = 604;

export const AUTONOMY_REASON_BLOCKED_TARGET_BUSY = 700;
export const AUTONOMY_REASON_BLOCKED_MATERIAL_MISSING = 701;
export const AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED = 702;

export const AUTONOMY_REASON_FAILED_TARGET_DESTROYED = 800;
export const AUTONOMY_REASON_FAILED_RESOURCE_LOST = 801;
export const AUTONOMY_REASON_FAILED_INVARIANT = 802;

export const AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY = 900;
export const AUTONOMY_REASON_INTERRUPTED_SHIFT_END = 901;
export const AUTONOMY_REASON_INTERRUPTED_DANGER = 902;

export type AutonomyReasonCode =
  | typeof AUTONOMY_REASON_NONE
  | typeof AUTONOMY_REASON_IDLE_OFF_SHIFT
  | typeof AUTONOMY_REASON_IDLE_NO_INDEXED_OFFER
  | typeof AUTONOMY_REASON_IDLE_RETRY_BACKOFF
  | typeof AUTONOMY_REASON_IDLE_DECISION_DEFERRED
  | typeof AUTONOMY_REASON_NEED_HUNGER_EMERGENCY
  | typeof AUTONOMY_REASON_NEED_REST_PRIORITY
  | typeof AUTONOMY_REASON_NEED_SAFETY_EMERGENCY
  | typeof AUTONOMY_REASON_NEED_HEALTH_EMERGENCY
  | typeof AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED
  | typeof AUTONOMY_REASON_CAPABILITY_TREATMENT_DENIED
  | typeof AUTONOMY_REASON_CAPABILITY_STALE_BASIS
  | typeof AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED
  | typeof AUTONOMY_REASON_CAPABILITY_ALLOWED
  | typeof AUTONOMY_REASON_OFFER_EMPTY_BUCKET
  | typeof AUTONOMY_REASON_OFFER_STALE_OWNER
  | typeof AUTONOMY_REASON_OFFER_CANDIDATE_CAP
  | typeof AUTONOMY_REASON_OFFER_RETAINED_CAP
  | typeof AUTONOMY_REASON_OFFER_SELECTED
  | typeof AUTONOMY_REASON_PATH_NO_ROUTE
  | typeof AUTONOMY_REASON_PATH_STALE_BASIS
  | typeof AUTONOMY_REASON_PATH_NODE_BUDGET
  | typeof AUTONOMY_REASON_PATH_ROUTE_CAPACITY
  | typeof AUTONOMY_REASON_PATH_EXACT_CAP
  | typeof AUTONOMY_REASON_PATH_SELECTED
  | typeof AUTONOMY_REASON_RESERVATION_CONFLICT
  | typeof AUTONOMY_REASON_RESERVATION_INSUFFICIENT_AMOUNT
  | typeof AUTONOMY_REASON_RESERVATION_STALE_TARGET
  | typeof AUTONOMY_REASON_RESERVATION_OUTPUT_INVALID
  | typeof AUTONOMY_REASON_RESERVATION_ACQUIRED
  | typeof AUTONOMY_REASON_BLOCKED_TARGET_BUSY
  | typeof AUTONOMY_REASON_BLOCKED_MATERIAL_MISSING
  | typeof AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED
  | typeof AUTONOMY_REASON_FAILED_TARGET_DESTROYED
  | typeof AUTONOMY_REASON_FAILED_RESOURCE_LOST
  | typeof AUTONOMY_REASON_FAILED_INVARIANT
  | typeof AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY
  | typeof AUTONOMY_REASON_INTERRUPTED_SHIFT_END
  | typeof AUTONOMY_REASON_INTERRUPTED_DANGER;

export const AUTONOMY_REASON_SOURCE_NONE = 0;
export const AUTONOMY_REASON_SOURCE_IDLE = 1;
export const AUTONOMY_REASON_SOURCE_NEED = 2;
export const AUTONOMY_REASON_SOURCE_SCHEDULE = 3;
export const AUTONOMY_REASON_SOURCE_CAPABILITY = 4;
export const AUTONOMY_REASON_SOURCE_PERMISSION = 5;
export const AUTONOMY_REASON_SOURCE_OFFER = 6;
export const AUTONOMY_REASON_SOURCE_PATH = 7;
export const AUTONOMY_REASON_SOURCE_RESERVATION = 8;
export const AUTONOMY_REASON_SOURCE_JOB = 9;
export const AUTONOMY_REASON_SOURCE_SYSTEM = 10;
export type AutonomyReasonSource = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const AUTONOMY_SUGGESTION_NONE = 0;
export const AUTONOMY_SUGGESTION_INSPECT_RESIDENT = 1;
export const AUTONOMY_SUGGESTION_INSPECT_TARGET = 2;
export const AUTONOMY_SUGGESTION_INSPECT_RESOURCE = 3;
export const AUTONOMY_SUGGESTION_INSPECT_SCHEDULE = 4;
export const AUTONOMY_SUGGESTION_INSPECT_CAPABILITY = 5;
export type AutonomySuggestion = 0 | 1 | 2 | 3 | 4 | 5;

export const AUTONOMY_REASON_REF_NONE = 0xffff_ffff;
export const AUTONOMY_REASON_PARAM_CAP = 6;

export interface AutonomyReasonOutput {
  code: AutonomyReasonCode;
  source: AutonomyReasonSource;
  subjectIndex: number;
  subjectGeneration: number;
  targetIndex: number;
  targetGeneration: number;
  parameterCount: number;
  parameter0: number;
  parameter1: number;
  parameter2: number;
  parameter3: number;
  parameter4: number;
  parameter5: number;
  ownerBasis: number;
  suggestion: AutonomySuggestion;
}

export function resetAutonomyReason(output: AutonomyReasonOutput): void {
  writeAutonomyReason(
    output,
    AUTONOMY_REASON_NONE,
    AUTONOMY_REASON_SOURCE_NONE,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    AUTONOMY_REASON_REF_NONE,
    0,
    0,
    AUTONOMY_SUGGESTION_NONE,
    0,
    0,
    0,
    0,
    0,
    0,
  );
}

export function writeAutonomyReason(
  output: AutonomyReasonOutput,
  code: AutonomyReasonCode,
  source: AutonomyReasonSource,
  subjectIndex: number,
  subjectGeneration: number,
  targetIndex: number,
  targetGeneration: number,
  parameterCount: number,
  ownerBasis: number,
  suggestion: AutonomySuggestion,
  parameter0: number,
  parameter1: number,
  parameter2: number,
  parameter3: number,
  parameter4: number,
  parameter5: number,
): void {
  output.code = code;
  output.source = source;
  output.subjectIndex = subjectIndex;
  output.subjectGeneration = subjectGeneration;
  output.targetIndex = targetIndex;
  output.targetGeneration = targetGeneration;
  output.parameterCount = parameterCount;
  output.parameter0 = parameterCount > 0 ? parameter0 : 0;
  output.parameter1 = parameterCount > 1 ? parameter1 : 0;
  output.parameter2 = parameterCount > 2 ? parameter2 : 0;
  output.parameter3 = parameterCount > 3 ? parameter3 : 0;
  output.parameter4 = parameterCount > 4 ? parameter4 : 0;
  output.parameter5 = parameterCount > 5 ? parameter5 : 0;
  output.ownerBasis = ownerBasis;
  output.suggestion = suggestion;
}

export function copyAutonomyReason(
  source: AutonomyReasonOutput,
  target: AutonomyReasonOutput,
): void {
  writeAutonomyReason(
    target,
    source.code,
    source.source,
    source.subjectIndex,
    source.subjectGeneration,
    source.targetIndex,
    source.targetGeneration,
    source.parameterCount,
    source.ownerBasis,
    source.suggestion,
    source.parameter0,
    source.parameter1,
    source.parameter2,
    source.parameter3,
    source.parameter4,
    source.parameter5,
  );
}

export function isValidAutonomyReason(reason: AutonomyReasonOutput): boolean {
  return isValidAutonomyReasonFields(
    reason.code,
    reason.source,
    reason.subjectIndex,
    reason.subjectGeneration,
    reason.targetIndex,
    reason.targetGeneration,
    reason.parameterCount,
    reason.parameter0,
    reason.parameter1,
    reason.parameter2,
    reason.parameter3,
    reason.parameter4,
    reason.parameter5,
    reason.ownerBasis,
    reason.suggestion,
  );
}

export function isValidAutonomyReasonFields(
  code: number,
  source: number,
  subjectIndex: number,
  subjectGeneration: number,
  targetIndex: number,
  targetGeneration: number,
  parameterCount: number,
  parameter0: number,
  parameter1: number,
  parameter2: number,
  parameter3: number,
  parameter4: number,
  parameter5: number,
  ownerBasis: number,
  suggestion: number,
): boolean {
  const structurallyValid =
    isValidReasonHeader(code, source, ownerBasis, suggestion) &&
    isOptionalEntityRef(subjectIndex, subjectGeneration) &&
    isOptionalEntityRef(targetIndex, targetGeneration) &&
    isValidReasonParameters(
      parameterCount,
      parameter0,
      parameter1,
      parameter2,
      parameter3,
      parameter4,
      parameter5,
    );
  if (!structurallyValid) return false;
  if (code !== AUTONOMY_REASON_NONE) return true;
  return (
    subjectIndex === AUTONOMY_REASON_REF_NONE &&
    subjectGeneration === AUTONOMY_REASON_REF_NONE &&
    targetIndex === AUTONOMY_REASON_REF_NONE &&
    targetGeneration === AUTONOMY_REASON_REF_NONE &&
    parameterCount === 0 &&
    ownerBasis === 0 &&
    suggestion === AUTONOMY_SUGGESTION_NONE
  );
}

export function isAutonomyReasonCode(code: number): code is AutonomyReasonCode {
  return (
    code === AUTONOMY_REASON_NONE ||
    (code >= AUTONOMY_REASON_IDLE_OFF_SHIFT && code <= AUTONOMY_REASON_IDLE_DECISION_DEFERRED) ||
    (code >= AUTONOMY_REASON_NEED_HUNGER_EMERGENCY &&
      code <= AUTONOMY_REASON_NEED_HEALTH_EMERGENCY) ||
    (code >= AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED &&
      code <= AUTONOMY_REASON_CAPABILITY_ALLOWED) ||
    (code >= AUTONOMY_REASON_OFFER_EMPTY_BUCKET && code <= AUTONOMY_REASON_OFFER_SELECTED) ||
    (code >= AUTONOMY_REASON_PATH_NO_ROUTE && code <= AUTONOMY_REASON_PATH_SELECTED) ||
    (code >= AUTONOMY_REASON_RESERVATION_CONFLICT &&
      code <= AUTONOMY_REASON_RESERVATION_ACQUIRED) ||
    (code >= AUTONOMY_REASON_BLOCKED_TARGET_BUSY &&
      code <= AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED) ||
    (code >= AUTONOMY_REASON_FAILED_TARGET_DESTROYED && code <= AUTONOMY_REASON_FAILED_INVARIANT) ||
    (code >= AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY &&
      code <= AUTONOMY_REASON_INTERRUPTED_DANGER)
  );
}

export function isOptionalEntityRef(index: number, generation: number): boolean {
  if (index === AUTONOMY_REASON_REF_NONE || generation === AUTONOMY_REASON_REF_NONE) {
    return index === AUTONOMY_REASON_REF_NONE && generation === AUTONOMY_REASON_REF_NONE;
  }
  return isStoredEntityIndex(index) && isStoredGeneration(generation);
}

export function isStoredEntityIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < AUTONOMY_REASON_REF_NONE;
}

export function isStoredGeneration(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value < AUTONOMY_REASON_REF_NONE;
}

export function isUint32(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

export function isInt32(value: number): boolean {
  return Number.isInteger(value) && value >= -0x8000_0000 && value <= 0x7fff_ffff;
}

function isReasonSource(value: number): value is AutonomyReasonSource {
  return Number.isInteger(value) && value >= AUTONOMY_REASON_SOURCE_NONE && value <= 10;
}

function isSuggestion(value: number): value is AutonomySuggestion {
  return Number.isInteger(value) && value >= AUTONOMY_SUGGESTION_NONE && value <= 5;
}

function isValidReasonHeader(
  code: number,
  source: number,
  ownerBasis: number,
  suggestion: number,
): boolean {
  return (
    isAutonomyReasonCode(code) &&
    isReasonSource(source) &&
    reasonSourceMatches(code, source) &&
    isUint32(ownerBasis) &&
    isSuggestion(suggestion)
  );
}

function isValidReasonParameters(
  count: number,
  parameter0: number,
  parameter1: number,
  parameter2: number,
  parameter3: number,
  parameter4: number,
  parameter5: number,
): boolean {
  return (
    Number.isInteger(count) &&
    count >= 0 &&
    count <= AUTONOMY_REASON_PARAM_CAP &&
    isInt32(parameter0) &&
    isInt32(parameter1) &&
    isInt32(parameter2) &&
    isInt32(parameter3) &&
    isInt32(parameter4) &&
    isInt32(parameter5) &&
    (count > 0 || parameter0 === 0) &&
    (count > 1 || parameter1 === 0) &&
    (count > 2 || parameter2 === 0) &&
    (count > 3 || parameter3 === 0) &&
    (count > 4 || parameter4 === 0) &&
    (count > 5 || parameter5 === 0)
  );
}

function reasonSourceMatches(code: AutonomyReasonCode, source: AutonomyReasonSource): boolean {
  const groupedSource = readGroupedReasonSource(code);
  if (code === AUTONOMY_REASON_NONE || groupedSource !== AUTONOMY_REASON_SOURCE_NONE) {
    return source === groupedSource;
  }
  return specialReasonSourceMatches(code, source);
}

function readGroupedReasonSource(code: AutonomyReasonCode): AutonomyReasonSource {
  if (code === AUTONOMY_REASON_NONE) return AUTONOMY_REASON_SOURCE_NONE;
  if (code >= AUTONOMY_REASON_IDLE_OFF_SHIFT && code <= AUTONOMY_REASON_IDLE_DECISION_DEFERRED) {
    return AUTONOMY_REASON_SOURCE_IDLE;
  }
  if (
    code >= AUTONOMY_REASON_NEED_HUNGER_EMERGENCY &&
    code <= AUTONOMY_REASON_NEED_HEALTH_EMERGENCY
  ) {
    return AUTONOMY_REASON_SOURCE_NEED;
  }
  if (code >= AUTONOMY_REASON_OFFER_EMPTY_BUCKET && code <= AUTONOMY_REASON_OFFER_SELECTED) {
    return AUTONOMY_REASON_SOURCE_OFFER;
  }
  if (code >= AUTONOMY_REASON_PATH_NO_ROUTE && code <= AUTONOMY_REASON_PATH_SELECTED) {
    return AUTONOMY_REASON_SOURCE_PATH;
  }
  if (
    code >= AUTONOMY_REASON_RESERVATION_CONFLICT &&
    code <= AUTONOMY_REASON_RESERVATION_ACQUIRED
  ) {
    return AUTONOMY_REASON_SOURCE_RESERVATION;
  }
  return AUTONOMY_REASON_SOURCE_NONE;
}

function specialReasonSourceMatches(
  code: AutonomyReasonCode,
  source: AutonomyReasonSource,
): boolean {
  if (code === AUTONOMY_REASON_CAPABILITY_PERMISSION_DENIED)
    return source === AUTONOMY_REASON_SOURCE_PERMISSION;
  if (
    code >= AUTONOMY_REASON_CAPABILITY_MOVEMENT_DENIED &&
    code <= AUTONOMY_REASON_CAPABILITY_ALLOWED
  )
    return source === AUTONOMY_REASON_SOURCE_CAPABILITY;
  if (code === AUTONOMY_REASON_BLOCKED_SCHEDULE_CLOSED) {
    return source === AUTONOMY_REASON_SOURCE_SCHEDULE;
  }
  if (
    code >= AUTONOMY_REASON_BLOCKED_TARGET_BUSY &&
    code <= AUTONOMY_REASON_BLOCKED_MATERIAL_MISSING
  ) {
    return source === AUTONOMY_REASON_SOURCE_JOB;
  }
  if (code === AUTONOMY_REASON_FAILED_INVARIANT) {
    return source === AUTONOMY_REASON_SOURCE_SYSTEM;
  }
  if (
    code >= AUTONOMY_REASON_FAILED_TARGET_DESTROYED &&
    code <= AUTONOMY_REASON_FAILED_RESOURCE_LOST
  ) {
    return source === AUTONOMY_REASON_SOURCE_JOB;
  }
  if (code === AUTONOMY_REASON_INTERRUPTED_NEED_EMERGENCY) {
    return source === AUTONOMY_REASON_SOURCE_NEED;
  }
  if (code === AUTONOMY_REASON_INTERRUPTED_SHIFT_END) {
    return source === AUTONOMY_REASON_SOURCE_SCHEDULE;
  }
  return source === AUTONOMY_REASON_SOURCE_SYSTEM;
}
