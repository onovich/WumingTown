import { GAME_SESSION_PROJECTION_VERSION } from "./constants";
import { isNonNegativeSafeInteger, isRecord } from "./validation-helpers";

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

export type GameSessionInputRecord = Readonly<Partial<Record<GameSessionInputField, unknown>>>;

export interface GameSessionProjectionRequestV1 {
  readonly kind: "game_session";
  readonly version: typeof GAME_SESSION_PROJECTION_VERSION;
}

export type GameSessionProjectionContractV1 = GameSessionProjectionRequestV1;

export interface GameSessionEntityRefV1 {
  readonly index: number;
  readonly generation: number;
}

export interface GameSessionProjectionBasisV1 {
  readonly projectionVersion: typeof GAME_SESSION_PROJECTION_VERSION;
  readonly scenarioId: string;
  readonly contentManifestHash: string;
  readonly tick: number;
  readonly snapshotSequence: number;
  readonly previousSnapshotSequence: number | null;
  readonly worldHash: string;
  readonly readModelHash: string;
  readonly mapVersion: number;
  readonly reservationVersion: number;
  readonly jobVersion: number;
  readonly derivedIndexVersion: number;
}

export type GameSessionRenderKindV1 = "resident" | "resource" | "structure" | "lamp" | "build_site";

export type GameSessionAnimationStateV1 = "idle" | "moving" | "working" | "blocked" | "completed";

export interface GameSessionRenderEntityV1 {
  readonly entity: GameSessionEntityRefV1;
  readonly kind: GameSessionRenderKindV1;
  readonly renderDefId: number;
  readonly xQ16: number;
  readonly yQ16: number;
  readonly facing: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly animationState: GameSessionAnimationStateV1;
  readonly flags: number;
}

export interface GameSessionRenderProjectionV1 {
  readonly basis: GameSessionProjectionBasisV1;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly tileSizeQ16: number;
  readonly entities: readonly GameSessionRenderEntityV1[];
}

export type GameSessionDayPhaseV1 = "dawn" | "day" | "dusk" | "night";

export type GameSessionJobMarkerStateV1 =
  | "idle"
  | "claiming"
  | "moving"
  | "working"
  | "blocked"
  | "completed"
  | "failed";

export interface GameSessionStructuredReasonV1 {
  readonly code: string;
  readonly source:
    | "session"
    | "resident"
    | "resource"
    | "job"
    | "reservation"
    | "pathing"
    | "lamp"
    | "build";
  readonly parameters: readonly (string | number | boolean)[];
}

export interface GameSessionUiResidentV1 {
  readonly entity: GameSessionEntityRefV1;
  readonly residentId: number;
  readonly residentDefId: number;
  readonly cellIndex: number;
  readonly activity: "idle" | "moving" | "working";
  readonly jobState: GameSessionJobMarkerStateV1;
  readonly currentJobId: number | null;
  readonly progressQ16: number;
  readonly hunger: number;
  readonly rest: number;
  readonly comfort: number;
  readonly social: number;
  readonly safety: number;
  readonly ownerVersion: number;
  readonly reason?: GameSessionStructuredReasonV1;
}

export type GameSessionResourceKindV1 = "food" | "wood" | "stone" | "lamp_oil" | "other";

export interface GameSessionUiResourceV1 {
  readonly defId: number;
  readonly resourceKind: GameSessionResourceKindV1;
  readonly total: number;
  readonly available: number;
  readonly reserved: number;
  readonly ownerVersion: number;
}

export interface GameSessionUiJobMarkerV1 {
  readonly markerId: string;
  readonly jobId: number | null;
  readonly state: GameSessionJobMarkerStateV1;
  readonly owner?: GameSessionEntityRefV1;
  readonly target?: GameSessionEntityRefV1;
  readonly progressQ16: number;
  readonly reason?: GameSessionStructuredReasonV1;
}

export interface GameSessionAlertV1 {
  readonly alertId: string;
  readonly severity: "info" | "warning" | "critical";
  readonly reason: GameSessionStructuredReasonV1;
  readonly subject?: GameSessionEntityRefV1;
}

export type GameSessionSelectionDetailV1 =
  | GameSessionResidentSelectionDetailV1
  | GameSessionResourceSelectionDetailV1
  | GameSessionStructureSelectionDetailV1;

export interface GameSessionSelectionBasisV1 extends GameSessionProjectionBasisV1 {
  readonly version: 1;
  readonly ownerVersion: number;
}

export interface GameSessionResidentSelectionDetailV1 {
  readonly kind: "resident";
  readonly basis: GameSessionSelectionBasisV1;
  readonly resident: GameSessionUiResidentV1;
}

export interface GameSessionResourceSelectionDetailV1 {
  readonly kind: "resource";
  readonly basis: GameSessionSelectionBasisV1;
  readonly resource: GameSessionUiResourceV1;
}

export interface GameSessionStructureSelectionDetailV1 {
  readonly kind: "structure";
  readonly basis: GameSessionSelectionBasisV1;
  readonly entity: GameSessionEntityRefV1;
  readonly structureKind: "bed" | "lamp" | "build_site";
  readonly structureDefId: number;
  readonly cellIndex: number;
  readonly stateCode: number;
  readonly progressQ16: number;
  readonly reason?: GameSessionStructuredReasonV1;
}

export interface GameSessionUiProjectionV1 {
  readonly basis: GameSessionProjectionBasisV1;
  readonly paused: boolean;
  readonly requestedSpeed: 0 | 1 | 2 | 3;
  readonly effectiveTicksPerSecond: 0 | 30 | 60 | 90;
  readonly dayIndex: number;
  readonly tickOfDay: number;
  readonly ticksPerDay: number;
  readonly dayPhase: GameSessionDayPhaseV1;
  readonly daylightQ16: number;
  readonly residents: readonly GameSessionUiResidentV1[];
  readonly resources: readonly GameSessionUiResourceV1[];
  readonly jobs: readonly GameSessionUiJobMarkerV1[];
  readonly alerts: readonly GameSessionAlertV1[];
  readonly selectionDetail: GameSessionSelectionDetailV1 | null;
  readonly lampFuel: number;
  readonly lampStateCode: number;
  readonly buildProgressTicks: number;
  readonly buildRequiredTicks: number;
  readonly buildCompleted: boolean;
}

export function isGameSessionRecord(input: unknown): input is GameSessionInputRecord {
  return isRecord(input);
}

export function isNullablePreviousSequence(input: unknown, current: unknown): boolean {
  return (
    input === null ||
    (isNonNegativeSafeInteger(input) && isNonNegativeSafeInteger(current) && input < current)
  );
}

export function isPositiveInteger(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input > 0;
}

export function isUint32(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input <= 0xffff_ffff;
}

export function isQ16(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input <= 65_536;
}

export function isNeedValue(input: unknown): input is number {
  return isNonNegativeSafeInteger(input) && input <= 1_000;
}

export function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.length > 0;
}

export function isScalar(input: unknown): input is string | number | boolean {
  return typeof input === "string" || typeof input === "boolean" || Number.isSafeInteger(input);
}

export function isRequestedSpeed(input: unknown): input is 0 | 1 | 2 | 3 {
  return input === 0 || input === 1 || input === 2 || input === 3;
}

export function isEffectiveTicksPerSecond(input: unknown): input is 0 | 30 | 60 | 90 {
  return input === 0 || input === 30 || input === 60 || input === 90;
}

export function isFacing(input: unknown): input is 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return isNonNegativeSafeInteger(input) && input <= 7;
}

export function isRenderKind(input: unknown): boolean {
  return ["resident", "resource", "structure", "lamp", "build_site"].includes(String(input));
}

export function isAnimationState(input: unknown): boolean {
  return ["idle", "moving", "working", "blocked", "completed"].includes(String(input));
}

export function isDayPhase(input: unknown): boolean {
  return input === "dawn" || input === "day" || input === "dusk" || input === "night";
}

export function isResidentActivity(input: unknown): boolean {
  return input === "idle" || input === "moving" || input === "working";
}

export function isJobState(input: unknown): boolean {
  return ["idle", "claiming", "moving", "working", "blocked", "completed", "failed"].includes(
    String(input),
  );
}

export function isResourceKind(input: unknown): boolean {
  return ["food", "wood", "stone", "lamp_oil", "other"].includes(String(input));
}

export function isReasonSource(input: unknown): boolean {
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

export function isAlertSeverity(input: unknown): boolean {
  return input === "info" || input === "warning" || input === "critical";
}

export function isStructureKind(input: unknown): boolean {
  return input === "bed" || input === "lamp" || input === "build_site";
}

export function validateGameSessionEntity(input: unknown): input is GameSessionEntityRefV1 {
  return (
    isGameSessionRecord(input) &&
    isNonNegativeSafeInteger(input.index) &&
    isNonNegativeSafeInteger(input.generation)
  );
}

export function readEntityKey(input: unknown): string | undefined {
  if (!isGameSessionRecord(input) || !validateGameSessionEntity(input.entity)) return undefined;
  return `${String(input.entity.index)}:${String(input.entity.generation)}`;
}

export function readResidentKey(input: unknown): string | undefined {
  return isGameSessionRecord(input) && isNonNegativeSafeInteger(input.residentId)
    ? String(input.residentId)
    : undefined;
}

export function readResourceKey(input: unknown): string | undefined {
  return isGameSessionRecord(input) && isNonNegativeSafeInteger(input.defId)
    ? String(input.defId)
    : undefined;
}

export function readMarkerKey(input: unknown): string | undefined {
  return isGameSessionRecord(input) && isNonEmptyString(input.markerId)
    ? input.markerId
    : undefined;
}

export function readAlertKey(input: unknown): string | undefined {
  return isGameSessionRecord(input) && isNonEmptyString(input.alertId) ? input.alertId : undefined;
}
