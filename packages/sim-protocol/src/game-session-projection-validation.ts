import { GAME_SESSION_PROJECTION_VERSION, SIMULATION_PROTOCOL_REASON_CODE } from "./constants";
import type {
  GameSessionEntityRefV1,
  GameSessionProjectionBasisV1,
  GameSessionProjectionRequestV1,
  GameSessionRenderProjectionV1,
  GameSessionUiProjectionV1,
} from "./game-session-projection";
import type { ProtocolRejection } from "./types";
import { isNonNegativeSafeInteger, isRecord } from "./validation-helpers";

const Q16_ONE = 65_536;
const MAX_RENDER_ROWS = 65_536;
const MAX_UI_ROWS = 4_096;

type GameSessionInputField =
  | "activity"
  | "alertId"
  | "alerts"
  | "animationState"
  | "available"
  | "basis"
  | "buildCompleted"
  | "buildProgressTicks"
  | "buildRequiredTicks"
  | "cellIndex"
  | "code"
  | "comfort"
  | "contentManifestHash"
  | "currentJobId"
  | "dayIndex"
  | "daylightQ16"
  | "dayPhase"
  | "defId"
  | "derivedIndexVersion"
  | "effectiveTicksPerSecond"
  | "entities"
  | "entity"
  | "facing"
  | "flags"
  | "generation"
  | "hunger"
  | "index"
  | "jobId"
  | "jobs"
  | "jobState"
  | "jobVersion"
  | "kind"
  | "lampFuel"
  | "lampStateCode"
  | "mapHeight"
  | "mapVersion"
  | "mapWidth"
  | "markerId"
  | "owner"
  | "ownerVersion"
  | "parameters"
  | "paused"
  | "previousSnapshotSequence"
  | "progressQ16"
  | "projectionVersion"
  | "readModelHash"
  | "reason"
  | "renderDefId"
  | "requestedSpeed"
  | "reservationVersion"
  | "reserved"
  | "resident"
  | "residentDefId"
  | "residentId"
  | "residents"
  | "resource"
  | "resourceKind"
  | "resources"
  | "rest"
  | "safety"
  | "scenarioId"
  | "selectionDetail"
  | "severity"
  | "snapshotSequence"
  | "social"
  | "source"
  | "state"
  | "stateCode"
  | "structureDefId"
  | "structureKind"
  | "subject"
  | "target"
  | "tick"
  | "tickOfDay"
  | "ticksPerDay"
  | "tileSizeQ16"
  | "total"
  | "version"
  | "worldHash"
  | "xQ16"
  | "yQ16";

type GameSessionInputRecord = Readonly<Partial<Record<GameSessionInputField, unknown>>>;

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
    return invalid("GameSession projection request version is unsupported");
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
    const detail = validateSelectionDetail(input.selectionDetail);
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
  return sameBasis(render.basis, ui.basis)
    ? VALID
    : invalid("GameSession render and UI projection basis is incoherent");
}

export function sameGameSessionProjectionBasis(
  left: GameSessionProjectionBasisV1,
  right: GameSessionProjectionBasisV1,
): boolean {
  return sameBasis(left, right);
}

function validateBasis(input: unknown): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input)) return invalid("GameSession projection basis must be an object");
  if (
    input.projectionVersion !== GAME_SESSION_PROJECTION_VERSION ||
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
  if (!isGameSessionRecord(input) || !validateEntity(input.entity)) {
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
  if (!isGameSessionRecord(input) || !validateEntity(input.entity)) {
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
    (input.owner !== undefined && !validateEntity(input.owner)) ||
    (input.target !== undefined && !validateEntity(input.target))
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
    (input.subject !== undefined && !validateEntity(input.subject))
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

function validateSelectionDetail(input: unknown): GameSessionProjectionValidationResult {
  if (!isGameSessionRecord(input) || !isGameSessionRecord(input.basis)) {
    return invalid("GameSession selection detail is malformed");
  }
  const basis = input.basis;
  if (
    basis.version !== 1 ||
    !isNonNegativeSafeInteger(basis.snapshotSequence) ||
    !isNonNegativeSafeInteger(basis.ownerVersion)
  ) {
    return invalid("GameSession selection detail basis is malformed");
  }
  if (input.kind === "resident") return validateResident(input.resident);
  if (input.kind === "resource") return validateResource(input.resource);
  if (
    input.kind !== "structure" ||
    !validateEntity(input.entity) ||
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

function sameBasis(
  left: GameSessionProjectionBasisV1,
  right: GameSessionProjectionBasisV1,
): boolean {
  return (
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

function isGameSessionRecord(input: unknown): input is GameSessionInputRecord {
  return isRecord(input);
}

function validateEntity(input: unknown): input is GameSessionEntityRefV1 {
  return (
    isGameSessionRecord(input) &&
    isNonNegativeSafeInteger(input.index) &&
    isNonNegativeSafeInteger(input.generation)
  );
}

function readEntityKey(input: unknown): string | undefined {
  if (!isGameSessionRecord(input) || !validateEntity(input.entity)) return undefined;
  const entity = input.entity;
  return `${String(entity.index)}:${String(entity.generation)}`;
}

function readResidentKey(input: unknown): string | undefined {
  if (!isGameSessionRecord(input) || !isNonNegativeSafeInteger(input.residentId)) {
    return undefined;
  }
  return String(input.residentId);
}

function readResourceKey(input: unknown): string | undefined {
  return isGameSessionRecord(input) && isNonNegativeSafeInteger(input.defId)
    ? String(input.defId)
    : undefined;
}

function readMarkerKey(input: unknown): string | undefined {
  return isGameSessionRecord(input) && isNonEmptyString(input.markerId)
    ? input.markerId
    : undefined;
}

function readAlertKey(input: unknown): string | undefined {
  return isGameSessionRecord(input) && isNonEmptyString(input.alertId) ? input.alertId : undefined;
}

function isNullablePreviousSequence(input: unknown, current: unknown): boolean {
  return (
    input === null ||
    (isNonNegativeSafeInteger(input) && isNonNegativeSafeInteger(current) && input < current)
  );
}

function isPositiveInteger(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input > 0;
}

function isUint32(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input <= 0xffff_ffff;
}

function isQ16(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input <= Q16_ONE;
}

function isNeedValue(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input <= 1_000;
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.length > 0;
}

function isScalar(input: unknown): input is string | number | boolean {
  return typeof input === "string" || typeof input === "boolean" || Number.isSafeInteger(input);
}

function isRequestedSpeed(input: unknown): input is 0 | 1 | 2 | 3 {
  return input === 0 || input === 1 || input === 2 || input === 3;
}

function isEffectiveTicksPerSecond(input: unknown): input is 0 | 30 | 60 | 90 {
  return input === 0 || input === 30 || input === 60 || input === 90;
}

function isFacing(input: unknown): input is 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return isNonNegativeSafeInteger(input) && input <= 7;
}

function isRenderKind(input: unknown): boolean {
  return ["resident", "resource", "structure", "lamp", "build_site"].includes(String(input));
}

function isAnimationState(input: unknown): boolean {
  return ["idle", "moving", "working", "blocked", "completed"].includes(String(input));
}

function isDayPhase(input: unknown): boolean {
  return input === "dawn" || input === "day" || input === "dusk" || input === "night";
}

function isResidentActivity(input: unknown): boolean {
  return input === "idle" || input === "moving" || input === "working";
}

function isJobState(input: unknown): boolean {
  return ["idle", "claiming", "moving", "working", "blocked", "completed", "failed"].includes(
    String(input),
  );
}

function isResourceKind(input: unknown): boolean {
  return ["food", "wood", "stone", "lamp_oil", "other"].includes(String(input));
}

function isReasonSource(input: unknown): boolean {
  return [
    "session",
    "resident",
    "resource",
    "job",
    "reservation",
    "pathing",
    "lamp",
    "build",
  ].includes(String(input));
}

function isAlertSeverity(input: unknown): boolean {
  return input === "info" || input === "warning" || input === "critical";
}

function isStructureKind(input: unknown): boolean {
  return input === "bed" || input === "lamp" || input === "build_site";
}

function invalid(detail: string): GameSessionProjectionValidationResult {
  return {
    ok: false,
    reason: { code: SIMULATION_PROTOCOL_REASON_CODE.InvalidPayload, detail },
  };
}

const VALID: GameSessionProjectionValidationResult = { ok: true };
