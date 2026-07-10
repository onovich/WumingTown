import { GAME_SESSION_PROJECTION_VERSION, SIMULATION_PROTOCOL_REASON_CODE } from "./constants";
import {
  isAlertSeverity,
  isAnimationState,
  isDayPhase,
  isEffectiveTicksPerSecond,
  isFacing,
  isGameSessionRecord,
  isJobState,
  isNeedValue,
  isNonEmptyString,
  isNullablePreviousSequence,
  isPositiveInteger,
  isQ16,
  isReasonSource,
  isRenderKind,
  isRequestedSpeed,
  isResidentActivity,
  isResourceKind,
  isScalar,
  isStructureKind,
  isUint32,
  readAlertKey,
  readEntityKey,
  readMarkerKey,
  readResidentKey,
  readResourceKey,
  validateGameSessionEntity,
  type GameSessionInputRecord,
  type GameSessionProjectionBasisV1,
  type GameSessionProjectionRequestV1,
  type GameSessionRenderProjectionV1,
  type GameSessionUiProjectionV1,
} from "./game-session-projection";
import type { ProtocolRejection } from "./types";
import { isNonNegativeSafeInteger } from "./validation-helpers";

const MAX_RENDER_ROWS = 65_536;
const MAX_UI_ROWS = 4_096;

export type GameSessionProjectionValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ProtocolRejection };

export function validateGameSessionProjectionRequest(
  input: unknown,
): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input) || input.kind !== "game_session") {
    return invalid("GameSession projection request kind must be game_session");
  }
  if (input.version !== GAME_SESSION_PROJECTION_VERSION) {
    return unsupported("GameSession projection request version is unsupported");
  }
  return VALID;
}

export function validateGameSessionReadyContract(
  input: unknown,
  request: GameSessionProjectionRequestV1,
): GameSessionProjectionValidationResult {
  const contract = validateGameSessionProjectionRequest(input);
  if (!contract.ok) return contract;
  if (
    !isGameSessionRecord(input) ||
    input.kind !== request.kind ||
    input.version !== request.version
  ) {
    return invalid("Ready projection contract does not match the requested contract");
  }
  return VALID;
}

export function validateGameSessionRenderProjectionV1(
  input: unknown,
): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input)) {
    return invalid("GameSession render projection must be an object");
  }
  const basis = validateBasis(input.basis);
  if (!basis.ok) return basis;
  if (
    !isPositiveInteger(input.mapWidth) ||
    !isPositiveInteger(input.mapHeight) ||
    !isPositiveInteger(input.tileSizeQ16) ||
    !Array.isArray(input.entities) ||
    input.entities.length > MAX_RENDER_ROWS
  ) {
    return invalid("GameSession render map fields or entity lane are malformed");
  }
  return validateUniqueRows(input.entities, validateRenderEntity, readEntityKey);
}

export function validateGameSessionUiProjectionV1(
  input: unknown,
): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input)) return invalid("GameSession UI projection must be an object");
  const basis = validateBasis(input.basis);
  if (!basis.ok) return basis;
  if (
    typeof input.paused !== "boolean" ||
    !isRequestedSpeed(input.requestedSpeed) ||
    !isEffectiveTicksPerSecond(input.effectiveTicksPerSecond) ||
    !isNonNegativeSafeInteger(input.dayIndex) ||
    !isNonNegativeSafeInteger(input.tickOfDay) ||
    !isPositiveInteger(input.ticksPerDay) ||
    input.tickOfDay >= input.ticksPerDay ||
    !isDayPhase(input.dayPhase) ||
    !isQ16(input.daylightQ16)
  ) {
    return invalid("GameSession UI time or scheduler fields are malformed");
  }
  if (
    !Array.isArray(input.residents) ||
    input.residents.length < 8 ||
    input.residents.length > MAX_UI_ROWS
  ) {
    return invalid("GameSession UI projection requires a bounded eight-resident lane");
  }
  const residents = validateUniqueRows(input.residents, validateResident, readResidentKey);
  if (!residents.ok) return residents;
  if (!Array.isArray(input.resources) || input.resources.length > MAX_UI_ROWS) {
    return invalid("GameSession UI resource lane is malformed");
  }
  const resources = validateUniqueRows(input.resources, validateResource, readResourceKey);
  if (!resources.ok) return resources;
  if (!hasRequiredResourceKinds(input.resources)) {
    return invalid("GameSession UI resources must include food, wood, stone, and lamp oil");
  }
  if (!Array.isArray(input.jobs) || input.jobs.length > MAX_UI_ROWS) {
    return invalid("GameSession UI job lane is malformed");
  }
  const jobs = validateUniqueRows(input.jobs, validateJob, readMarkerKey);
  if (!jobs.ok) return jobs;
  if (!Array.isArray(input.alerts) || input.alerts.length > MAX_UI_ROWS) {
    return invalid("GameSession UI alert lane is malformed");
  }
  const alerts = validateUniqueRows(input.alerts, validateAlert, readAlertKey);
  if (!alerts.ok) return alerts;
  if (input.selectionDetail !== null) {
    const detail = validateSelectionDetail(input.selectionDetail, input.basis);
    if (!detail.ok) return detail;
  }
  if (
    !isNonNegativeSafeInteger(input.lampFuel) ||
    !isNonNegativeSafeInteger(input.lampStateCode) ||
    !isNonNegativeSafeInteger(input.buildProgressTicks) ||
    !isNonNegativeSafeInteger(input.buildRequiredTicks) ||
    typeof input.buildCompleted !== "boolean"
  ) {
    return invalid("GameSession UI lamp or build facts are malformed");
  }
  return VALID;
}

export function validateGameSessionAlertsV1(input: unknown): GameSessionProjectionValidationResult {
  if (!Array.isArray(input) || input.length > MAX_UI_ROWS) {
    return invalid("GameSession alert lane is malformed");
  }
  return validateUniqueRows(input, validateAlert, readAlertKey);
}

export function validateCoherentGameSessionProjectionPair(
  render: GameSessionRenderProjectionV1,
  ui: GameSessionUiProjectionV1,
): GameSessionProjectionValidationResult {
  return sameBasisRecord(render.basis, ui.basis)
    ? VALID
    : invalid("GameSession render and UI projection basis is incoherent");
}

export function sameGameSessionProjectionBasis(
  left: GameSessionProjectionBasisV1,
  right: GameSessionProjectionBasisV1,
): boolean {
  return sameBasisRecord(left, right);
}

function validateBasis(input: unknown): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input)) return invalid("GameSession projection basis must be an object");
  if (input.projectionVersion !== GAME_SESSION_PROJECTION_VERSION) {
    return unsupported("GameSession projection basis version is unsupported");
  }
  if (
    !isNonEmptyString(input.scenarioId) ||
    !isNonEmptyString(input.contentManifestHash) ||
    !isNonNegativeSafeInteger(input.tick) ||
    !isNonNegativeSafeInteger(input.snapshotSequence) ||
    !isNullablePreviousSequence(input.previousSnapshotSequence, input.snapshotSequence) ||
    !isNonEmptyString(input.worldHash) ||
    !isNonEmptyString(input.readModelHash) ||
    !isNonNegativeSafeInteger(input.mapVersion) ||
    !isNonNegativeSafeInteger(input.reservationVersion) ||
    !isNonNegativeSafeInteger(input.jobVersion) ||
    !isNonNegativeSafeInteger(input.derivedIndexVersion)
  ) {
    return invalid("GameSession projection basis is malformed or unsupported");
  }
  return VALID;
}

function validateRenderEntity(input: unknown): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input) || !validateGameSessionEntity(input.entity)) {
    return invalid("GameSession render entity reference is malformed");
  }
  if (
    !isRenderKind(input.kind) ||
    !isNonNegativeSafeInteger(input.renderDefId) ||
    !isNonNegativeSafeInteger(input.xQ16) ||
    !isNonNegativeSafeInteger(input.yQ16) ||
    !isFacing(input.facing) ||
    !isAnimationState(input.animationState) ||
    !isUint32(input.flags)
  ) {
    return invalid("GameSession render entity row is malformed");
  }
  return VALID;
}

function validateResident(input: unknown): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input) || !validateGameSessionEntity(input.entity)) {
    return invalid("GameSession resident entity is malformed");
  }
  if (
    !isNonNegativeSafeInteger(input.residentId) ||
    !isNonNegativeSafeInteger(input.residentDefId) ||
    !isNonNegativeSafeInteger(input.cellIndex) ||
    !isResidentActivity(input.activity) ||
    !isJobState(input.jobState) ||
    !(input.currentJobId === null || isNonNegativeSafeInteger(input.currentJobId)) ||
    !isQ16(input.progressQ16) ||
    !isNeedValue(input.hunger) ||
    !isNeedValue(input.rest) ||
    !isNeedValue(input.comfort) ||
    !isNeedValue(input.social) ||
    !isNeedValue(input.safety) ||
    !isNonNegativeSafeInteger(input.ownerVersion)
  ) {
    return invalid("GameSession resident row is malformed");
  }
  return input.reason === undefined ? VALID : validateReason(input.reason);
}

function validateResource(input: unknown): GameSessionProjectionValidationResult {
  if (
    !isGameSessionRecord(input) ||
    !isNonNegativeSafeInteger(input.defId) ||
    !isResourceKind(input.resourceKind) ||
    !isNonNegativeSafeInteger(input.total) ||
    !isNonNegativeSafeInteger(input.available) ||
    !isNonNegativeSafeInteger(input.reserved) ||
    input.available + input.reserved > input.total ||
    !isNonNegativeSafeInteger(input.ownerVersion)
  ) {
    return invalid("GameSession resource row is malformed");
  }
  return VALID;
}

function validateJob(input: unknown): GameSessionProjectionValidationResult {
  if (
    !isGameSessionRecord(input) ||
    !isNonEmptyString(input.markerId) ||
    !(input.jobId === null || isNonNegativeSafeInteger(input.jobId)) ||
    !isJobState(input.state) ||
    !isQ16(input.progressQ16) ||
    (input.owner !== undefined && !validateGameSessionEntity(input.owner)) ||
    (input.target !== undefined && !validateGameSessionEntity(input.target))
  ) {
    return invalid("GameSession job marker row is malformed");
  }
  return input.reason === undefined ? VALID : validateReason(input.reason);
}

function validateAlert(input: unknown): GameSessionProjectionValidationResult {
  if (
    !isGameSessionRecord(input) ||
    !isNonEmptyString(input.alertId) ||
    !isAlertSeverity(input.severity) ||
    (input.subject !== undefined && !validateGameSessionEntity(input.subject))
  ) {
    return invalid("GameSession alert row is malformed");
  }
  return validateReason(input.reason);
}

function validateReason(input: unknown): GameSessionProjectionValidationResult {
  if (
    !isGameSessionRecord(input) ||
    !isNonEmptyString(input.code) ||
    !isReasonSource(input.source) ||
    !Array.isArray(input.parameters) ||
    input.parameters.length > 16
  ) {
    return invalid("GameSession structured reason is malformed");
  }
  for (const parameter of input.parameters) {
    if (!isScalar(parameter)) return invalid("GameSession reason parameter is malformed");
  }
  return VALID;
}

function validateSelectionDetail(
  input: unknown,
  containingBasis: unknown,
): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input) || !isGameSessionRecord(input.basis)) {
    return invalid("GameSession selection detail is malformed");
  }
  const basis = input.basis;
  const projectionBasis = validateBasis(basis);
  if (!projectionBasis.ok) return projectionBasis;
  if (basis.version !== 1 || !isNonNegativeSafeInteger(basis.ownerVersion)) {
    return invalid("GameSession selection detail basis is malformed");
  }
  if (!isGameSessionRecord(containingBasis) || !sameBasisRecord(basis, containingBasis)) {
    return invalid("GameSession selection detail basis is stale or foreign");
  }
  if (input.kind === "resident") return validateResident(input.resident);
  if (input.kind === "resource") return validateResource(input.resource);
  if (
    input.kind !== "structure" ||
    !validateGameSessionEntity(input.entity) ||
    !isStructureKind(input.structureKind) ||
    !isNonNegativeSafeInteger(input.structureDefId) ||
    !isNonNegativeSafeInteger(input.cellIndex) ||
    !isNonNegativeSafeInteger(input.stateCode) ||
    !isQ16(input.progressQ16)
  ) {
    return invalid("GameSession structure selection detail is malformed");
  }
  return input.reason === undefined ? VALID : validateReason(input.reason);
}

function validateUniqueRows(
  rows: readonly unknown[],
  validate: (input: unknown) => GameSessionProjectionValidationResult,
  readKey: (input: unknown) => string | undefined,
): GameSessionProjectionValidationResult {
  const keys = new Set<string>();
  for (const row of rows) {
    const result = validate(row);
    if (!result.ok) return result;
    const key = readKey(row);
    if (key === undefined || keys.has(key))
      return invalid("GameSession row identity is duplicated");
    keys.add(key);
  }
  return VALID;
}

function hasRequiredResourceKinds(rows: readonly unknown[]): boolean {
  let mask = 0;
  for (const row of rows) {
    if (!isGameSessionRecord(row)) continue;
    if (row.resourceKind === "food") mask |= 1;
    else if (row.resourceKind === "wood") mask |= 2;
    else if (row.resourceKind === "stone") mask |= 4;
    else if (row.resourceKind === "lamp_oil") mask |= 8;
  }
  return mask === 15;
}

function sameBasisRecord(left: GameSessionInputRecord, right: GameSessionInputRecord): boolean {
  return (
    left.projectionVersion === right.projectionVersion &&
    left.scenarioId === right.scenarioId &&
    left.contentManifestHash === right.contentManifestHash &&
    left.tick === right.tick &&
    left.snapshotSequence === right.snapshotSequence &&
    left.previousSnapshotSequence === right.previousSnapshotSequence &&
    left.worldHash === right.worldHash &&
    left.readModelHash === right.readModelHash &&
    left.mapVersion === right.mapVersion &&
    left.reservationVersion === right.reservationVersion &&
    left.jobVersion === right.jobVersion &&
    left.derivedIndexVersion === right.derivedIndexVersion
  );
}

function invalid(detail: string): GameSessionProjectionValidationResult {
  return {
    ok: false,
    reason: { code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload, detail },
  };
}

function unsupported(detail: string): GameSessionProjectionValidationResult {
  return {
    ok: false,
    reason: { code: SIMULATION_PROTOCOL_REASON_CODE.UnsupportedSchemaVersion, detail },
  };
}

const VALID: GameSessionProjectionValidationResult = { ok: true };
