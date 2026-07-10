import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import {
  GAME_SESSION_NO_JOB,
  type GameSessionResidentActivity,
  type GameSessionResidentView,
  type GameSessionStructuredReason,
} from "./game-session-types";

const ACTIVITY_IDLE = 0;
const ACTIVITY_MOVING = 1;
const ACTIVITY_WORKING = 2;

const REASON_AWAITING_DRIVER = 0;
const REASON_INDEXED_WORK = 1;
const REASON_NO_INDEXED_WORK = 2;
const REASON_JOB_RESERVED = 3;
const REASON_JOB_WORKING = 4;
const REASON_JOB_COMPLETED = 5;
const REASON_JOB_FAILED = 6;

export type GameSessionResidentMutationResult =
  | { readonly ok: true; readonly residentId: number; readonly version: number }
  | {
      readonly ok: false;
      readonly reason:
        | "game_session.resident_id_out_of_range"
        | "game_session.resident_already_registered"
        | "game_session.resident_entity_invalid"
        | "game_session.resident_def_invalid";
    };

export class GameSessionResidentStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly entityIndexes: Uint32Array;
  private readonly entityGenerations: Uint32Array;
  private readonly defIds: Uint32Array;
  private readonly activityCodes: Uint8Array;
  private readonly currentJobIds: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private readonly ownerVersions: Uint32Array;
  private activeCountValue = 0;
  private storeVersion = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "game session resident capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.entityIndexes = new Uint32Array(capacity);
    this.entityGenerations = new Uint32Array(capacity);
    this.defIds = new Uint32Array(capacity);
    this.activityCodes = new Uint8Array(capacity);
    this.currentJobIds = new Uint32Array(capacity);
    this.currentJobIds.fill(GAME_SESSION_NO_JOB);
    this.reasonCodes = new Uint8Array(capacity);
    this.ownerVersions = new Uint32Array(capacity);
  }

  get version(): number {
    return this.storeVersion;
  }

  get activeCount(): number {
    return this.activeCountValue;
  }

  register(
    residentId: number,
    entity: EntityId,
    defId: number,
    registry: EntityRegistry,
  ): GameSessionResidentMutationResult {
    if (!isIndexInRange(residentId, this.capacity)) {
      return { ok: false, reason: "game_session.resident_id_out_of_range" };
    }

    if ((this.active[residentId] ?? 0) === 1) {
      return { ok: false, reason: "game_session.resident_already_registered" };
    }

    if (!registry.isAlive(entity)) {
      return { ok: false, reason: "game_session.resident_entity_invalid" };
    }

    if (!isUint32(defId)) {
      return { ok: false, reason: "game_session.resident_def_invalid" };
    }

    this.active[residentId] = 1;
    this.entityIndexes[residentId] = entity.index;
    this.entityGenerations[residentId] = entity.generation;
    this.defIds[residentId] = defId;
    this.activityCodes[residentId] = ACTIVITY_IDLE;
    this.currentJobIds[residentId] = GAME_SESSION_NO_JOB;
    this.reasonCodes[residentId] = REASON_AWAITING_DRIVER;
    this.activeCountValue += 1;
    return this.finish(residentId);
  }

  setIndexedWorkAvailable(
    residentId: number,
    available: boolean,
  ): GameSessionResidentMutationResult {
    if (!isIndexInRange(residentId, this.capacity) || (this.active[residentId] ?? 0) !== 1) {
      return { ok: false, reason: "game_session.resident_id_out_of_range" };
    }

    const nextReason = available ? REASON_INDEXED_WORK : REASON_NO_INDEXED_WORK;
    if ((this.reasonCodes[residentId] ?? REASON_AWAITING_DRIVER) === nextReason) {
      return { ok: true, residentId, version: this.storeVersion };
    }

    this.reasonCodes[residentId] = nextReason;
    return this.finish(residentId);
  }

  setJobState(
    residentId: number,
    currentJobId: number,
    activity: GameSessionResidentActivity,
    reason: Extract<
      GameSessionStructuredReason,
      | "game_session.job_reserved"
      | "game_session.job_working"
      | "game_session.job_completed"
      | "game_session.job_failed"
    >,
  ): GameSessionResidentMutationResult {
    if (!isIndexInRange(residentId, this.capacity) || (this.active[residentId] ?? 0) !== 1) {
      return { ok: false, reason: "game_session.resident_id_out_of_range" };
    }
    if (!isUint32(currentJobId)) {
      return { ok: false, reason: "game_session.resident_id_out_of_range" };
    }

    const activityCode = encodeActivity(activity);
    const reasonCode = encodeReason(reason);
    if (
      (this.currentJobIds[residentId] ?? GAME_SESSION_NO_JOB) === currentJobId &&
      (this.activityCodes[residentId] ?? ACTIVITY_IDLE) === activityCode &&
      (this.reasonCodes[residentId] ?? REASON_AWAITING_DRIVER) === reasonCode
    ) {
      return { ok: true, residentId, version: this.storeVersion };
    }

    this.currentJobIds[residentId] = currentJobId;
    this.activityCodes[residentId] = activityCode;
    this.reasonCodes[residentId] = reasonCode;
    return this.finish(residentId);
  }

  read(residentId: number): GameSessionResidentView | undefined {
    if (!isIndexInRange(residentId, this.capacity) || (this.active[residentId] ?? 0) !== 1) {
      return undefined;
    }

    return {
      residentId,
      entity: {
        index: this.entityIndexes[residentId] ?? 0,
        generation: this.entityGenerations[residentId] ?? 0,
      },
      defId: this.defIds[residentId] ?? 0,
      activity: decodeActivity(this.activityCodes[residentId] ?? ACTIVITY_IDLE),
      currentJobId: this.currentJobIds[residentId] ?? GAME_SESSION_NO_JOB,
      reason: decodeReason(this.reasonCodes[residentId] ?? REASON_AWAITING_DRIVER),
      ownerVersion: this.ownerVersions[residentId] ?? 0,
    };
  }

  private finish(residentId: number): GameSessionResidentMutationResult {
    this.storeVersion += 1;
    this.ownerVersions[residentId] = this.storeVersion;
    return { ok: true, residentId, version: this.storeVersion };
  }
}

export function createGameSessionResidentStore(capacity: number): GameSessionResidentStore {
  return new GameSessionResidentStore(capacity);
}

function decodeActivity(code: number): GameSessionResidentActivity {
  if (code === ACTIVITY_MOVING) {
    return "moving";
  }

  if (code === ACTIVITY_WORKING) {
    return "working";
  }

  return "idle";
}

function encodeActivity(activity: GameSessionResidentActivity): number {
  if (activity === "moving") return ACTIVITY_MOVING;
  if (activity === "working") return ACTIVITY_WORKING;
  return ACTIVITY_IDLE;
}

function decodeReason(code: number): GameSessionStructuredReason {
  if (code === REASON_INDEXED_WORK) {
    return "game_session.indexed_work_available";
  }

  if (code === REASON_NO_INDEXED_WORK) {
    return "game_session.no_indexed_work";
  }

  if (code === REASON_JOB_RESERVED) return "game_session.job_reserved";
  if (code === REASON_JOB_WORKING) return "game_session.job_working";
  if (code === REASON_JOB_COMPLETED) return "game_session.job_completed";
  if (code === REASON_JOB_FAILED) return "game_session.job_failed";

  return "game_session.awaiting_job_driver";
}

function encodeReason(reason: GameSessionStructuredReason): number {
  if (reason === "game_session.job_reserved") return REASON_JOB_RESERVED;
  if (reason === "game_session.job_working") return REASON_JOB_WORKING;
  if (reason === "game_session.job_completed") return REASON_JOB_COMPLETED;
  if (reason === "game_session.job_failed") return REASON_JOB_FAILED;
  if (reason === "game_session.indexed_work_available") return REASON_INDEXED_WORK;
  if (reason === "game_session.no_indexed_work") return REASON_NO_INDEXED_WORK;
  return REASON_AWAITING_DRIVER;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}
