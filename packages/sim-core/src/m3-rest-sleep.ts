import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { JobCoreStore, JobFailureReason, JobInterruptionKind } from "./job-core";
import {
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_VALUE_MAX,
  type NeedDirtySink,
  type NeedStore,
} from "./m3-needs";
import type { M3EnvironmentProjection, M3ScheduleWindowId } from "./m3-environment-data";
import type { MapGrid } from "./map-grid";
import {
  type GridPathfinder,
  type PathCandidate,
  type PathSearchResult,
  type PathVersionBasis,
  resolveTopKPathCandidates,
} from "./pathing";
import type { ReservationLedger, ReservationReason } from "./reservation-ledger";
import { isSafeTick, type Tick } from "./time";

export const M3_REST_SLEEP_STORE_VERSION = 1;
export const M3_REST_SLEEP_TRACE_CAPACITY = 64;
export const M3_REST_FIXTURE_NONE = 0xffff_ffff;
export const M3_REST_SLEEP_JOB_KIND = 4;
export const M3_REST_DEFAULT_CANDIDATE_CAP = 24;
export const M3_REST_DEFAULT_SELECTED_CAP = 12;
export const M3_REST_DEFAULT_EXACT_PATH_CAP = 4;
export const M3_REST_URGENCY_THRESHOLD = 260;
export const M3_REST_EMERGENCY_THRESHOLD = 180;

const REST_KIND_REST = 0;
const REST_KIND_SLEEP = 1;
const REST_KIND_COUNT = 2;

const WEATHER_EXPOSURE_INDOOR = 0;
const WEATHER_EXPOSURE_OUTDOOR = 1;
const WEATHER_EXPOSURE_COUNT = 2;

const SCHEDULE_DAWN = 0;
const SCHEDULE_DAYTIME = 1;
const SCHEDULE_EVENING = 2;
const SCHEDULE_NIGHT = 3;
const SCHEDULE_COUNT = 4;

const REST_JOB_INACTIVE = 0;
const REST_JOB_CREATED = 1;
const REST_JOB_PATHING_TO_FIXTURE = 2;
const REST_JOB_RESTING = 3;
const REST_JOB_SLEEPING = 4;
const REST_JOB_COMPLETE = 5;
const REST_JOB_FAILED = 6;
const REST_JOB_CANCELLED = 7;

const REST_REASON_NONE = 0;
const REST_REASON_SELECTED = 1;
const REST_REASON_COMPLETED = 2;
const REST_REASON_NO_SPOT = 3;
const REST_REASON_SCHEDULE = 4;
const REST_REASON_WEATHER = 5;
const REST_REASON_PATH = 6;
const REST_REASON_RESERVATION = 7;
const REST_REASON_ABILITY = 8;
const REST_REASON_EMERGENCY = 9;
const REST_REASON_NOT_TIRED = 10;
const REST_REASON_INTERRUPTED = 11;
const REST_REASON_INTERRUPT_DENIED = 12;
const REST_REASON_CANDIDATE_CAP = 13;
const REST_REASON_JOB_CORE = 14;
const REST_REASON_NEED = 15;
const REST_REASON_STEP = 16;
const REST_REASON_FIXTURE_ID_OUT_OF_RANGE = 17;
const REST_REASON_FIXTURE_ALREADY_ACTIVE = 18;
const REST_REASON_FIXTURE_NOT_ACTIVE = 19;
const REST_REASON_FIXTURE_ENTITY_INVALID = 20;
const REST_REASON_FIXTURE_INPUT_INVALID = 21;
const REST_REASON_JOB_ID_OUT_OF_RANGE = 22;
const REST_REASON_JOB_ALREADY_ACTIVE = 23;
const REST_REASON_JOB_NOT_ACTIVE = 24;
const REST_REASON_TICK_INVALID = 25;
const REST_REASON_RESERVATION_BASE = 64;

export type RestKind = "rest" | "sleep";
export type RestFixtureKind = "clinic_mat" | "bedroll";
export type RestFixtureWeatherExposure = "indoor" | "outdoor";

export type RestSleepReason =
  | "rest.none"
  | "rest.selected_indexed_path"
  | "rest.completed"
  | "rest.rejected_no_indexed_candidate"
  | "rest.rejected_schedule_window"
  | "rest.rejected_weather_exposure"
  | "path.no_route_to_rest_fixture"
  | "rest.rejected_reservation"
  | "rest.rejected_ability"
  | "rest.rejected_emergency_need"
  | "rest.rejected_actor_not_tired"
  | "job.interrupted_safe_point"
  | "job.interruption_denied"
  | "trace.candidate_cap_reached"
  | "rest.job_core_failed"
  | "rest.need_update_failed"
  | "rest.step_invalid"
  | "rest.fixture_id_out_of_range"
  | "rest.fixture_already_active"
  | "rest.fixture_not_active"
  | "rest.fixture_entity_invalid"
  | "rest.fixture_input_invalid"
  | "rest.job_id_out_of_range"
  | "rest.job_already_active"
  | "rest.job_not_active"
  | "rest.tick_invalid"
  | ReservationReason;

const RESERVATION_REASON_VALUES: readonly string[] = [
  "reservation_transaction_empty",
  "reservation_ledger_capacity_exhausted",
  "reservation_owner_index_out_of_range",
  "reservation_owner_not_alive",
  "reservation_owner_generation_mismatch",
  "reservation_target_index_out_of_range",
  "reservation_target_not_alive",
  "reservation_target_generation_mismatch",
  "reservation_job_id_invalid",
  "reservation_created_tick_invalid",
  "reservation_lease_expiry_invalid",
  "reservation_amount_invalid",
  "reservation_available_amount_invalid",
  "reservation_capacity_invalid",
  "reservation_insufficient_amount",
  "reservation_insufficient_capacity",
  "reservation_cell_out_of_range",
  "reservation_slot_out_of_range",
  "reservation_entity_conflict",
  "reservation_cell_conflict",
  "reservation_interaction_conflict",
  "reservation_item_quantity_conflict",
  "reservation_capacity_conflict",
  "reservation_duplicate_target",
  "reservation_claim_id_invalid",
  "reservation_claim_not_active",
  "reservation_snapshot_version_unsupported",
];

export type RestSleepMutationResult =
  | { readonly ok: true; readonly id: number; readonly version: number }
  | { readonly ok: false; readonly reason: RestSleepReason };

export type RestSelectionResult =
  | {
      readonly ok: true;
      readonly actorId: number;
      readonly fixtureId: number;
      readonly selectedPath: PathSearchResult;
      readonly candidateTotal: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly exactPathCount: number;
      readonly nodeExpansions: number;
      readonly candidateCapHit: boolean;
      readonly exactPathCapHit: boolean;
      readonly traceSequence: number;
      readonly reason: Extract<RestSleepReason, "rest.selected_indexed_path">;
    }
  | {
      readonly ok: false;
      readonly actorId: number;
      readonly candidateTotal: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly exactPathCount: number;
      readonly nodeExpansions: number;
      readonly traceSequence: number;
      readonly reason: RestSleepReason;
    };

export interface RestFixtureInput {
  readonly fixtureId: number;
  readonly entity: EntityId;
  readonly kind: RestFixtureKind;
  readonly restKind: RestKind;
  readonly regionId: number;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly weatherExposure: RestFixtureWeatherExposure;
  readonly permissionId: number;
  readonly recoveryPerTickQ16: number;
  readonly baseScoreMilli: number;
}

export interface RestFixtureView extends RestFixtureInput {
  readonly ownerVersion: number;
}

export interface RestFixtureIntoOutput {
  ok: boolean;
  reason: RestSleepReason | undefined;
  fixtureId: number;
  active: boolean;
  entityIndex: number;
  entityGeneration: number;
  kind: RestFixtureKind | undefined;
  restKind: RestKind | undefined;
  regionId: number;
  targetCellIndex: number;
  interactionSpotId: number;
  scheduleWindow: M3ScheduleWindowId | undefined;
  weatherExposure: RestFixtureWeatherExposure | undefined;
  permissionId: number;
  recoveryPerTickQ16: number;
  baseScoreMilli: number;
  ownerVersion: number;
  storeVersion: number;
}

export interface RestSleepMetrics {
  readonly version: number;
  readonly activeFixtureCount: number;
  readonly activeJobCount: number;
  readonly candidateIndexedCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
  readonly selectionCount: number;
  readonly candidateVisitedCount: number;
  readonly exactPathRequestCount: number;
  readonly pathFailureCount: number;
  readonly reservationAttemptCount: number;
  readonly cleanupReleaseCount: number;
  readonly completedJobCount: number;
  readonly cancelledJobCount: number;
  readonly interruptedJobCount: number;
}

export interface RestCandidateIndexOptions {
  readonly fixtureCapacity: number;
  readonly regionCapacity: number;
  readonly permissionCapacity: number;
}

export interface RestCandidateQuery {
  readonly regionId: number;
  readonly restKind: RestKind;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly weatherExposure: RestFixtureWeatherExposure;
  readonly permissionId: number;
  readonly candidateCap: number;
  readonly maxSelectedFixtures: number;
}

export interface RestCandidateEnvironmentBasis {
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly scheduleWindowVersion: number;
  readonly weatherExposure: RestFixtureWeatherExposure;
  readonly outdoorWorkAllowed: boolean;
  readonly weatherVersion: number;
  readonly weatherSourceVersion: number;
}

export interface RestCandidateSelectionIntoScratch {
  readonly fixtureReadOutput: RestFixtureIntoOutput;
  readonly fixtureIds: Uint32Array;
  readonly entityIndexes: Uint32Array;
  readonly entityGenerations: Uint32Array;
  readonly fixtureKindCodes: Uint8Array;
  readonly restKindCodes: Uint8Array;
  readonly regionIds: Uint32Array;
  readonly targetCellIndexes: Uint32Array;
  readonly interactionSpotIds: Uint32Array;
  readonly scheduleCodes: Uint8Array;
  readonly weatherCodes: Uint8Array;
  readonly permissionIds: Uint32Array;
  readonly recoveryPerTickQ16s: Uint32Array;
  readonly scoreMillis: Uint32Array;
  readonly cachedFixtureVersions: Uint32Array;
  readonly currentFixtureOwnerVersions: Uint32Array;
  readonly linkedCandidateFlags: Uint8Array;
}

export interface RestCandidateSelectionIntoOutput {
  ok: boolean;
  reason: RestSleepReason | undefined;
  queryRegionId: number;
  queryRestKind: RestKind | undefined;
  queryScheduleWindow: M3ScheduleWindowId | undefined;
  queryWeatherExposure: RestFixtureWeatherExposure | undefined;
  queryPermissionId: number;
  candidateCap: number;
  maxSelectedFixtures: number;
  environmentScheduleWindow: M3ScheduleWindowId | undefined;
  scheduleWindowVersion: number;
  environmentWeatherExposure: RestFixtureWeatherExposure | undefined;
  outdoorWorkAllowed: boolean;
  weatherVersion: number;
  weatherSourceVersion: number;
  candidateTotal: number;
  visitedCount: number;
  selectedCount: number;
  candidateCapHit: boolean;
  selectedCapHit: boolean;
  selectedFixtureId: number;
  selectedEntityIndex: number;
  selectedEntityGeneration: number;
  selectedFixtureKind: RestFixtureKind | undefined;
  selectedRestKind: RestKind | undefined;
  selectedRegionId: number;
  selectedTargetCellIndex: number;
  selectedInteractionSpotId: number;
  selectedScheduleWindow: M3ScheduleWindowId | undefined;
  selectedWeatherExposure: RestFixtureWeatherExposure | undefined;
  selectedPermissionId: number;
  selectedRecoveryPerTickQ16: number;
  selectedScoreMilli: number;
  selectedCachedFixtureVersion: number;
  selectedCurrentFixtureOwnerVersion: number;
  selectedLinkedCandidate: boolean;
  restStoreVersion: number;
  sourceVersion: number;
  indexVersion: number;
  dirtyBacklog: number;
}

export type RestCandidateQueryResult =
  | {
      readonly ok: true;
      readonly reason: RestSleepReason;
      readonly candidateTotal: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly sourceVersion: number;
      readonly indexVersion: number;
      readonly traceSequence: number;
    }
  | { readonly ok: false; readonly reason: RestSleepReason };

export interface RestSelectionInput {
  readonly actorId: number;
  readonly originCellIndex: number;
  readonly regionId: number;
  readonly restKind: RestKind;
  readonly permissionId: number;
  readonly issuedTick: Tick;
  readonly requestSequenceStart: number;
  readonly needStore: NeedStore;
  readonly environment: M3EnvironmentProjection;
  readonly restStore: RestSleepStore;
  readonly restIndex: RestCandidateIndex;
  readonly pathfinder: GridPathfinder;
  readonly grid: MapGrid;
  readonly pathBasis: PathVersionBasis;
  readonly outputFixtureIds: Uint32Array;
  readonly pathCandidateScratch: PathCandidate[];
  readonly traceStore?: RestSleepTraceStore;
  readonly actorCanRest?: boolean;
  readonly weatherExposure?: RestFixtureWeatherExposure;
  readonly emergencyNeedThreshold?: number;
  readonly restUrgencyThreshold?: number;
  readonly candidateCap?: number;
  readonly maxSelectedFixtures?: number;
  readonly maxExactPaths?: number;
  readonly maxNodeExpansions?: number;
}

export interface RestJobCreateInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly restKind: RestKind;
  readonly recoveryTargetValue: number;
  readonly recoveryPerTickQ16: number;
  readonly createdTick: Tick;
  readonly interruptionPolicy?: "never" | "at_safe_point" | "immediate" | "emergency_only";
}

export type RestJobStep =
  | "inactive"
  | "created"
  | "pathing_to_fixture"
  | "resting"
  | "sleeping"
  | "complete"
  | "failed"
  | "cancelled";

export interface RestJobView {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly restKind: RestKind;
  readonly step: RestJobStep;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly environmentVersion: number;
  readonly needOwnerVersion: number;
  readonly reservationVersion: number;
  readonly fixtureClaimId: number;
  readonly interactionClaimId: number;
  readonly recoveryTargetValue: number;
  readonly recoveryPerTickQ16: number;
  readonly recoveryProgressQ16: number;
  readonly stepEnteredTick: Tick;
  readonly terminalReason: RestSleepReason;
}

export interface RestJobDriverSnapshot {
  readonly snapshotVersion: typeof M3_REST_SLEEP_STORE_VERSION;
  readonly capacity: number;
  readonly storeVersion: number;
  readonly activeCount: number;
  readonly records: readonly RestJobView[];
}

export interface RestTraceInput {
  readonly tick: Tick;
  readonly actorId: number;
  readonly fixtureId: number;
  readonly candidateTotal: number;
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly exactPathCount: number;
  readonly exactPathCap: number;
  readonly nodeExpansions: number;
  readonly sourceRestVersion: number;
  readonly environmentVersion: number;
  readonly reservationVersion: number;
  readonly reason: RestSleepReason;
}

export interface RestTraceView extends RestTraceInput {
  readonly sequence: number;
}

export class RestSleepStore {
  readonly fixtureCapacity: number;
  readonly regionCapacity: number;
  readonly permissionCapacity: number;

  private readonly active: Uint8Array;
  private readonly entityIndexes: Uint32Array;
  private readonly entityGenerations: Uint32Array;
  private readonly kindCodes: Uint8Array;
  private readonly restKindCodes: Uint8Array;
  private readonly regionIds: Uint32Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly interactionSpotIds: Uint32Array;
  private readonly scheduleCodes: Uint8Array;
  private readonly weatherCodes: Uint8Array;
  private readonly permissionIds: Uint32Array;
  private readonly recoveryPerTickQ16: Uint32Array;
  private readonly baseScoreMilli: Uint32Array;
  private readonly ownerVersions: Uint32Array;
  private activeFixtureCount = 0;
  private storeVersion = 0;

  constructor(fixtureCapacity: number, regionCapacity: number, permissionCapacity: number) {
    assertValidCapacity(fixtureCapacity, "rest fixture capacity");
    assertValidCapacity(regionCapacity, "rest region capacity");
    assertValidCapacity(permissionCapacity, "rest permission capacity");
    this.fixtureCapacity = fixtureCapacity;
    this.regionCapacity = regionCapacity;
    this.permissionCapacity = permissionCapacity;
    this.active = new Uint8Array(fixtureCapacity);
    this.entityIndexes = new Uint32Array(fixtureCapacity);
    this.entityGenerations = new Uint32Array(fixtureCapacity);
    this.kindCodes = new Uint8Array(fixtureCapacity);
    this.restKindCodes = new Uint8Array(fixtureCapacity);
    this.regionIds = new Uint32Array(fixtureCapacity);
    this.targetCellIndexes = new Uint32Array(fixtureCapacity);
    this.interactionSpotIds = new Uint32Array(fixtureCapacity);
    this.scheduleCodes = new Uint8Array(fixtureCapacity);
    this.weatherCodes = new Uint8Array(fixtureCapacity);
    this.permissionIds = new Uint32Array(fixtureCapacity);
    this.recoveryPerTickQ16 = new Uint32Array(fixtureCapacity);
    this.baseScoreMilli = new Uint32Array(fixtureCapacity);
    this.ownerVersions = new Uint32Array(fixtureCapacity);
  }

  get version(): number {
    return this.storeVersion;
  }

  get activeCount(): number {
    return this.activeFixtureCount;
  }

  registerFixture(input: RestFixtureInput, registry?: EntityRegistry): RestSleepMutationResult {
    const validation = this.validateFixtureInput(input, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.fixtureId] ?? 0) === 1) {
      return { ok: false, reason: "rest.fixture_already_active" };
    }

    this.active[input.fixtureId] = 1;
    this.entityIndexes[input.fixtureId] = input.entity.index;
    this.entityGenerations[input.fixtureId] = input.entity.generation;
    this.kindCodes[input.fixtureId] = encodeFixtureKind(input.kind);
    this.restKindCodes[input.fixtureId] = encodeRestKind(input.restKind);
    this.regionIds[input.fixtureId] = input.regionId;
    this.targetCellIndexes[input.fixtureId] = input.targetCellIndex;
    this.interactionSpotIds[input.fixtureId] = input.interactionSpotId;
    this.scheduleCodes[input.fixtureId] = encodeScheduleWindow(input.scheduleWindow);
    this.weatherCodes[input.fixtureId] = encodeWeatherExposure(input.weatherExposure);
    this.permissionIds[input.fixtureId] = input.permissionId;
    this.recoveryPerTickQ16[input.fixtureId] = input.recoveryPerTickQ16;
    this.baseScoreMilli[input.fixtureId] = input.baseScoreMilli;
    this.activeFixtureCount += 1;
    this.storeVersion += 1;
    this.ownerVersions[input.fixtureId] = this.storeVersion;
    return { ok: true, id: input.fixtureId, version: this.storeVersion };
  }

  removeFixture(fixtureId: number): RestSleepMutationResult {
    if (!this.isFixtureActive(fixtureId)) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    this.active[fixtureId] = 0;
    this.activeFixtureCount -= 1;
    this.storeVersion += 1;
    this.ownerVersions[fixtureId] = this.storeVersion;
    return { ok: true, id: fixtureId, version: this.storeVersion };
  }

  readFixture(fixtureId: number): RestFixtureView | undefined {
    if (!this.isFixtureActive(fixtureId)) {
      return undefined;
    }

    return {
      fixtureId,
      entity: this.readFixtureEntity(fixtureId),
      kind: decodeFixtureKind(this.kindCodes[fixtureId] ?? 0),
      restKind: decodeRestKind(this.restKindCodes[fixtureId] ?? 0),
      regionId: this.regionIds[fixtureId] ?? 0,
      targetCellIndex: this.targetCellIndexes[fixtureId] ?? 0,
      interactionSpotId: this.interactionSpotIds[fixtureId] ?? 0,
      scheduleWindow: decodeScheduleWindow(this.scheduleCodes[fixtureId] ?? 0),
      weatherExposure: decodeWeatherExposure(this.weatherCodes[fixtureId] ?? 0),
      permissionId: this.permissionIds[fixtureId] ?? 0,
      recoveryPerTickQ16: this.recoveryPerTickQ16[fixtureId] ?? 0,
      baseScoreMilli: this.baseScoreMilli[fixtureId] ?? 0,
      ownerVersion: this.ownerVersions[fixtureId] ?? 0,
    };
  }

  readFixtureInto(fixtureId: number, output: RestFixtureIntoOutput): void {
    this.resetFixtureInto(fixtureId, output);
    if (!isIndexInRange(fixtureId, this.fixtureCapacity)) {
      output.reason = "rest.fixture_id_out_of_range";
      return;
    }
    if ((this.active[fixtureId] ?? 0) !== 1) {
      output.reason = "rest.fixture_not_active";
      return;
    }

    output.ok = true;
    output.active = true;
    output.entityIndex = this.entityIndexes[fixtureId] ?? 0;
    output.entityGeneration = this.entityGenerations[fixtureId] ?? 0;
    output.kind = decodeFixtureKind(this.kindCodes[fixtureId] ?? 0);
    output.restKind = decodeRestKind(this.restKindCodes[fixtureId] ?? 0);
    output.regionId = this.regionIds[fixtureId] ?? 0;
    output.targetCellIndex = this.targetCellIndexes[fixtureId] ?? 0;
    output.interactionSpotId = this.interactionSpotIds[fixtureId] ?? 0;
    output.scheduleWindow = decodeScheduleWindow(this.scheduleCodes[fixtureId] ?? 0);
    output.weatherExposure = decodeWeatherExposure(this.weatherCodes[fixtureId] ?? 0);
    output.permissionId = this.permissionIds[fixtureId] ?? 0;
    output.recoveryPerTickQ16 = this.recoveryPerTickQ16[fixtureId] ?? 0;
    output.baseScoreMilli = this.baseScoreMilli[fixtureId] ?? 0;
    output.ownerVersion = this.ownerVersions[fixtureId] ?? 0;
  }

  isFixtureActive(fixtureId: number): boolean {
    return isIndexInRange(fixtureId, this.fixtureCapacity) && (this.active[fixtureId] ?? 0) === 1;
  }

  readFixtureEntity(fixtureId: number): EntityId {
    return {
      index: this.entityIndexes[fixtureId] ?? 0,
      generation: this.entityGenerations[fixtureId] ?? 0,
    };
  }

  readFixtureBaseScore(fixtureId: number): number {
    return this.baseScoreMilli[fixtureId] ?? 0;
  }

  readFixtureOwnerVersion(fixtureId: number): number {
    return this.ownerVersions[fixtureId] ?? 0;
  }

  readFixtureBucketKey(fixtureId: number): number {
    if (!this.isFixtureActive(fixtureId)) {
      return -1;
    }

    return createRestBucketKey(
      this.regionIds[fixtureId] ?? 0,
      this.restKindCodes[fixtureId] ?? 0,
      this.scheduleCodes[fixtureId] ?? 0,
      this.weatherCodes[fixtureId] ?? 0,
      this.permissionIds[fixtureId] ?? 0,
      this.regionCapacity,
      this.permissionCapacity,
    );
  }

  createMetrics(): Pick<RestSleepMetrics, "version" | "activeFixtureCount"> {
    return { version: this.storeVersion, activeFixtureCount: this.activeFixtureCount };
  }

  private validateFixtureInput(
    input: RestFixtureInput,
    registry: EntityRegistry | undefined,
  ): RestSleepMutationResult {
    if (!isIndexInRange(input.fixtureId, this.fixtureCapacity)) {
      return { ok: false, reason: "rest.fixture_id_out_of_range" };
    }

    if (registry !== undefined && !registry.isAlive(input.entity)) {
      return { ok: false, reason: "rest.fixture_entity_invalid" };
    }

    if (
      !isIndexInRange(input.regionId, this.regionCapacity) ||
      !isSafeUint32(input.targetCellIndex) ||
      !isSafeUint32(input.interactionSpotId) ||
      !isIndexInRange(input.permissionId, this.permissionCapacity) ||
      !isPositiveUint32(input.recoveryPerTickQ16) ||
      !isSafeUint32(input.baseScoreMilli)
    ) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    return { ok: true, id: input.fixtureId, version: this.storeVersion };
  }

  private resetFixtureInto(fixtureId: number, output: RestFixtureIntoOutput): void {
    output.ok = false;
    output.reason = undefined;
    output.fixtureId = fixtureId;
    output.active = false;
    output.entityIndex = 0;
    output.entityGeneration = 0;
    output.kind = undefined;
    output.restKind = undefined;
    output.regionId = 0;
    output.targetCellIndex = 0;
    output.interactionSpotId = 0;
    output.scheduleWindow = undefined;
    output.weatherExposure = undefined;
    output.permissionId = 0;
    output.recoveryPerTickQ16 = 0;
    output.baseScoreMilli = 0;
    output.ownerVersion = 0;
    output.storeVersion = this.storeVersion;
  }
}

export class RestCandidateIndex {
  readonly fixtureCapacity: number;
  readonly regionCapacity: number;
  readonly permissionCapacity: number;

  private readonly linked: Uint8Array;
  private readonly bucketKeys: Int32Array;
  private readonly fixtureVersions: Uint32Array;
  private readonly bucketHeads: Int32Array;
  private readonly bucketCounts: Uint32Array;
  private readonly aggregateCounts: Uint32Array;
  private readonly scheduleCounts: Uint32Array;
  private readonly aggregateKeys: Int32Array;
  private readonly scheduleKeys: Int32Array;
  private readonly nextByFixture: Int32Array;
  private readonly previousByFixture: Int32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private indexedCount = 0;
  private selectionCount = 0;
  private candidateVisitedCount = 0;
  private indexVersion = 0;
  private sourceVersion = 0;

  constructor(options: RestCandidateIndexOptions) {
    assertValidCapacity(options.fixtureCapacity, "rest candidate fixture capacity");
    assertValidCapacity(options.regionCapacity, "rest candidate region capacity");
    assertValidCapacity(options.permissionCapacity, "rest candidate permission capacity");
    this.fixtureCapacity = options.fixtureCapacity;
    this.regionCapacity = options.regionCapacity;
    this.permissionCapacity = options.permissionCapacity;
    const bucketCount =
      options.regionCapacity *
      REST_KIND_COUNT *
      SCHEDULE_COUNT *
      WEATHER_EXPOSURE_COUNT *
      options.permissionCapacity;
    const aggregateCount = options.regionCapacity * REST_KIND_COUNT * options.permissionCapacity;
    const scheduleCount =
      options.regionCapacity * REST_KIND_COUNT * SCHEDULE_COUNT * options.permissionCapacity;
    this.linked = new Uint8Array(options.fixtureCapacity);
    this.bucketKeys = new Int32Array(options.fixtureCapacity);
    this.bucketKeys.fill(-1);
    this.fixtureVersions = new Uint32Array(options.fixtureCapacity);
    this.bucketHeads = new Int32Array(bucketCount);
    this.bucketHeads.fill(-1);
    this.bucketCounts = new Uint32Array(bucketCount);
    this.aggregateCounts = new Uint32Array(aggregateCount);
    this.scheduleCounts = new Uint32Array(scheduleCount);
    this.aggregateKeys = new Int32Array(options.fixtureCapacity);
    this.scheduleKeys = new Int32Array(options.fixtureCapacity);
    this.aggregateKeys.fill(-1);
    this.scheduleKeys.fill(-1);
    this.nextByFixture = new Int32Array(options.fixtureCapacity);
    this.previousByFixture = new Int32Array(options.fixtureCapacity);
    this.nextByFixture.fill(-1);
    this.previousByFixture.fill(-1);
    this.dirtyQueued = new Uint8Array(options.fixtureCapacity);
    this.dirtyQueue = new Uint32Array(options.fixtureCapacity);
  }

  rebuildFromStore(store: RestSleepStore): RestSleepMetrics {
    this.clearIndex();

    for (let fixtureId = 0; fixtureId < this.fixtureCapacity; fixtureId += 1) {
      if (store.isFixtureActive(fixtureId)) {
        this.linkFixture(store, fixtureId);
      }
    }

    this.dirtyHead = 0;
    this.dirtyCount = 0;
    this.dirtyQueued.fill(0);
    this.indexVersion += 1;
    this.sourceVersion = store.version;
    return this.createMetrics(store);
  }

  markFixtureDirty(fixtureId: number): RestSleepMutationResult {
    if (!isIndexInRange(fixtureId, this.fixtureCapacity)) {
      return { ok: false, reason: "rest.fixture_id_out_of_range" };
    }

    if ((this.dirtyQueued[fixtureId] ?? 0) === 0) {
      const tail = (this.dirtyHead + this.dirtyCount) % this.dirtyQueue.length;
      this.dirtyQueue[tail] = fixtureId;
      this.dirtyQueued[fixtureId] = 1;
      this.dirtyCount += 1;
      if (this.dirtyCount > this.dirtyPeak) {
        this.dirtyPeak = this.dirtyCount;
      }
    }

    return { ok: true, id: fixtureId, version: this.indexVersion };
  }

  refreshDirty(store: RestSleepStore, budget: number): RestSleepMutationResult {
    if (!isPositiveUint32(budget)) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    let refreshed = 0;
    while (this.dirtyCount > 0 && refreshed < budget) {
      const fixtureId = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.dirtyQueue.length;
      this.dirtyCount -= 1;
      this.dirtyQueued[fixtureId] = 0;
      this.unlinkFixture(fixtureId);
      if (store.isFixtureActive(fixtureId)) {
        this.linkFixture(store, fixtureId);
      }
      refreshed += 1;
    }

    if (refreshed > 0) {
      this.indexVersion += 1;
    }

    if (this.dirtyCount === 0) {
      this.sourceVersion = store.version;
    }

    return { ok: true, id: refreshed, version: this.indexVersion };
  }

  selectCandidatesInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    store: RestSleepStore,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    this.resetCandidateSelectionInto(query, environment, store, scratch, output);
    if (!this.validateCandidateSelectionInto(query, environment, scratch, output)) {
      return;
    }
    if (this.dirtyCount > 0 || this.sourceVersion !== store.version) {
      output.reason = "rest.fixture_input_invalid";
      return;
    }

    const storeVersion = store.version;
    const sourceVersion = this.sourceVersion;
    const ownerIndexVersion = this.indexVersion;
    const restKindCode = encodeRestKind(query.restKind);
    const scheduleCode = encodeScheduleWindow(query.scheduleWindow);
    const weatherCode = encodeWeatherExposure(query.weatherExposure);
    if (
      !this.collectCandidatesInto(
        query,
        restKindCode,
        scheduleCode,
        weatherCode,
        store,
        storeVersion,
        scratch,
        output,
      )
    ) {
      this.failCandidateSelectionInto(query, environment, store, scratch, output);
      return;
    }

    if (
      !this.isCandidateSelectionBasisCurrent(
        store,
        environment,
        scratch,
        output,
        output.selectedCount,
        storeVersion,
        sourceVersion,
        ownerIndexVersion,
      )
    ) {
      this.failCandidateSelectionInto(query, environment, store, scratch, output);
      return;
    }

    this.finishCandidateSelectionInto(
      query,
      restKindCode,
      scheduleCode,
      weatherCode,
      scratch,
      output,
    );
  }

  selectCandidates(
    query: RestCandidateQuery,
    outputFixtureIds: Uint32Array,
    traceStore?: RestSleepTraceStore,
    traceInput?: Pick<
      RestTraceInput,
      "tick" | "actorId" | "sourceRestVersion" | "environmentVersion" | "reservationVersion"
    >,
  ): RestCandidateQueryResult {
    const validation = this.validateQuery(query, outputFixtureIds);
    if (!validation.ok) {
      return validation;
    }

    if (this.dirtyCount > 0) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    clearUint32(outputFixtureIds, query.maxSelectedFixtures, M3_REST_FIXTURE_NONE);
    const restKindCode = encodeRestKind(query.restKind);
    const scheduleCode = encodeScheduleWindow(query.scheduleWindow);
    const weatherCode = encodeWeatherExposure(query.weatherExposure);
    const bucketKey = createRestBucketKey(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      this.regionCapacity,
      this.permissionCapacity,
    );
    const candidateTotal = this.bucketCounts[bucketKey] ?? 0;
    let current = this.bucketHeads[bucketKey] ?? -1;
    let visited = 0;
    let selected = 0;

    while (current >= 0 && visited < query.candidateCap) {
      if (selected < query.maxSelectedFixtures) {
        outputFixtureIds[selected] = current;
        selected += 1;
      }
      visited += 1;
      current = this.nextByFixture[current] ?? -1;
    }

    this.selectionCount += 1;
    this.candidateVisitedCount += visited;
    const candidateCapHit = candidateTotal > visited;
    const selectedCapHit = visited > selected;
    const reason = this.resolveSelectionReason(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      candidateTotal,
      candidateCapHit,
    );
    const traceSequence =
      traceStore !== undefined && traceInput !== undefined
        ? traceStore.record({
            ...traceInput,
            fixtureId:
              selected > 0 ? (outputFixtureIds[0] ?? M3_REST_FIXTURE_NONE) : M3_REST_FIXTURE_NONE,
            candidateTotal,
            visitedCount: visited,
            selectedCount: selected,
            candidateCap: query.candidateCap,
            selectedCap: query.maxSelectedFixtures,
            exactPathCount: 0,
            exactPathCap: 0,
            nodeExpansions: 0,
            reason,
          })
        : 0;

    return {
      ok: true,
      reason,
      candidateTotal,
      visitedCount: visited,
      selectedCount: selected,
      candidateCapHit,
      selectedCapHit,
      sourceVersion: this.sourceVersion,
      indexVersion: this.indexVersion,
      traceSequence,
    };
  }

  createMetrics(store?: RestSleepStore): RestSleepMetrics {
    return {
      version: this.indexVersion,
      activeFixtureCount: store?.activeCount ?? 0,
      activeJobCount: 0,
      candidateIndexedCount: this.indexedCount,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
      selectionCount: this.selectionCount,
      candidateVisitedCount: this.candidateVisitedCount,
      exactPathRequestCount: 0,
      pathFailureCount: 0,
      reservationAttemptCount: 0,
      cleanupReleaseCount: 0,
      completedJobCount: 0,
      cancelledJobCount: 0,
      interruptedJobCount: 0,
    };
  }

  private linkFixture(store: RestSleepStore, fixtureId: number): void {
    const bucketKey = store.readFixtureBucketKey(fixtureId);
    if (bucketKey < 0) {
      return;
    }

    let current = this.bucketHeads[bucketKey] ?? -1;
    let previous = -1;

    while (current >= 0 && isRestFixtureBefore(store, current, fixtureId)) {
      previous = current;
      current = this.nextByFixture[current] ?? -1;
    }

    this.previousByFixture[fixtureId] = previous;
    this.nextByFixture[fixtureId] = current;

    if (previous >= 0) {
      this.nextByFixture[previous] = fixtureId;
    } else {
      this.bucketHeads[bucketKey] = fixtureId;
    }

    if (current >= 0) {
      this.previousByFixture[current] = fixtureId;
    }

    this.bucketKeys[fixtureId] = bucketKey;
    this.fixtureVersions[fixtureId] = store.readFixtureOwnerVersion(fixtureId);
    this.linked[fixtureId] = 1;
    this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 0) + 1;
    this.linkAggregateCounts(store, fixtureId);
    this.indexedCount += 1;
  }

  private unlinkFixture(fixtureId: number): void {
    if ((this.linked[fixtureId] ?? 0) !== 1) {
      return;
    }

    const bucketKey = this.bucketKeys[fixtureId] ?? -1;
    const previous = this.previousByFixture[fixtureId] ?? -1;
    const next = this.nextByFixture[fixtureId] ?? -1;

    if (bucketKey >= 0) {
      if (previous >= 0) {
        this.nextByFixture[previous] = next;
      } else {
        this.bucketHeads[bucketKey] = next;
      }

      if (next >= 0) {
        this.previousByFixture[next] = previous;
      }

      this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 1) - 1;
    }

    this.unlinkAggregateCounts(fixtureId);
    this.linked[fixtureId] = 0;
    this.bucketKeys[fixtureId] = -1;
    this.fixtureVersions[fixtureId] = 0;
    this.previousByFixture[fixtureId] = -1;
    this.nextByFixture[fixtureId] = -1;
    this.indexedCount -= 1;
  }

  private linkAggregateCounts(store: RestSleepStore, fixtureId: number): void {
    const fixture = store.readFixture(fixtureId);
    if (fixture === undefined) {
      return;
    }
    const restKindCode = encodeRestKind(fixture.restKind);
    const scheduleCode = encodeScheduleWindow(fixture.scheduleWindow);
    const aggregateKey = createAggregateKey(
      fixture.regionId,
      restKindCode,
      fixture.permissionId,
      this.permissionCapacity,
    );
    const scheduleKey = createScheduleKey(
      fixture.regionId,
      restKindCode,
      scheduleCode,
      fixture.permissionId,
      this.permissionCapacity,
    );
    this.aggregateKeys[fixtureId] = aggregateKey;
    this.scheduleKeys[fixtureId] = scheduleKey;
    this.aggregateCounts[aggregateKey] = (this.aggregateCounts[aggregateKey] ?? 0) + 1;
    this.scheduleCounts[scheduleKey] = (this.scheduleCounts[scheduleKey] ?? 0) + 1;
  }

  private unlinkAggregateCounts(fixtureId: number): void {
    const aggregateKey = this.aggregateKeys[fixtureId] ?? -1;
    const scheduleKey = this.scheduleKeys[fixtureId] ?? -1;

    if (aggregateKey >= 0) {
      this.aggregateCounts[aggregateKey] = (this.aggregateCounts[aggregateKey] ?? 1) - 1;
      this.aggregateKeys[fixtureId] = -1;
    }

    if (scheduleKey >= 0) {
      this.scheduleCounts[scheduleKey] = (this.scheduleCounts[scheduleKey] ?? 1) - 1;
      this.scheduleKeys[fixtureId] = -1;
    }
  }

  private validateCandidateSelectionInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): boolean {
    if (
      !isIndexInRange(query.regionId, this.regionCapacity) ||
      !isIndexInRange(query.permissionId, this.permissionCapacity) ||
      !isPositiveUint32(query.candidateCap) ||
      query.candidateCap > M3_REST_DEFAULT_CANDIDATE_CAP ||
      !isPositiveUint32(query.maxSelectedFixtures) ||
      query.maxSelectedFixtures > M3_REST_DEFAULT_SELECTED_CAP ||
      !isSafeUint32(environment.scheduleWindowVersion) ||
      !isSafeUint32(environment.weatherVersion) ||
      !isSafeUint32(environment.weatherSourceVersion) ||
      !hasRestSelectionScratchCapacity(scratch)
    ) {
      output.reason = "rest.fixture_input_invalid";
      return false;
    }
    if (query.scheduleWindow !== environment.scheduleWindow) {
      output.reason = "rest.rejected_schedule_window";
      return false;
    }
    if (
      query.weatherExposure !== environment.weatherExposure ||
      (query.weatherExposure === "outdoor" && !environment.outdoorWorkAllowed)
    ) {
      output.reason = "rest.rejected_weather_exposure";
      return false;
    }
    return true;
  }

  private resetCandidateSelectionInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    store: RestSleepStore,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    store.readFixtureInto(M3_REST_FIXTURE_NONE, scratch.fixtureReadOutput);
    resetRestSelectionScratch(scratch);
    output.ok = false;
    output.reason = undefined;
    output.queryRegionId = query.regionId;
    output.queryRestKind = query.restKind;
    output.queryScheduleWindow = query.scheduleWindow;
    output.queryWeatherExposure = query.weatherExposure;
    output.queryPermissionId = query.permissionId;
    output.candidateCap = query.candidateCap;
    output.maxSelectedFixtures = query.maxSelectedFixtures;
    output.environmentScheduleWindow = environment.scheduleWindow;
    output.scheduleWindowVersion = environment.scheduleWindowVersion;
    output.environmentWeatherExposure = environment.weatherExposure;
    output.outdoorWorkAllowed = environment.outdoorWorkAllowed;
    output.weatherVersion = environment.weatherVersion;
    output.weatherSourceVersion = environment.weatherSourceVersion;
    output.candidateTotal = 0;
    output.visitedCount = 0;
    output.selectedCount = 0;
    output.candidateCapHit = false;
    output.selectedCapHit = false;
    output.selectedFixtureId = M3_REST_FIXTURE_NONE;
    output.selectedEntityIndex = 0;
    output.selectedEntityGeneration = 0;
    output.selectedFixtureKind = undefined;
    output.selectedRestKind = undefined;
    output.selectedRegionId = 0;
    output.selectedTargetCellIndex = 0;
    output.selectedInteractionSpotId = 0;
    output.selectedScheduleWindow = undefined;
    output.selectedWeatherExposure = undefined;
    output.selectedPermissionId = 0;
    output.selectedRecoveryPerTickQ16 = 0;
    output.selectedScoreMilli = 0;
    output.selectedCachedFixtureVersion = 0;
    output.selectedCurrentFixtureOwnerVersion = 0;
    output.selectedLinkedCandidate = false;
    output.restStoreVersion = store.version;
    output.sourceVersion = this.sourceVersion;
    output.indexVersion = this.indexVersion;
    output.dirtyBacklog = this.dirtyCount;
  }

  private failCandidateSelectionInto(
    query: RestCandidateQuery,
    environment: RestCandidateEnvironmentBasis,
    store: RestSleepStore,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    this.resetCandidateSelectionInto(query, environment, store, scratch, output);
    output.reason = "rest.fixture_input_invalid";
  }

  private collectCandidatesInto(
    query: RestCandidateQuery,
    restKindCode: number,
    scheduleCode: number,
    weatherCode: number,
    store: RestSleepStore,
    storeVersion: number,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): boolean {
    const bucketKey = createRestBucketKey(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      this.regionCapacity,
      this.permissionCapacity,
    );
    const candidateTotal = this.bucketCounts[bucketKey] ?? 0;
    let current = this.bucketHeads[bucketKey] ?? -1;
    let visited = 0;
    let selected = 0;
    while (current >= 0 && visited < query.candidateCap) {
      store.readFixtureInto(current, scratch.fixtureReadOutput);
      if (!this.isFixtureReadCurrent(current, storeVersion, scratch.fixtureReadOutput)) {
        return false;
      }
      if (selected < query.maxSelectedFixtures) {
        this.writeCandidateIntoScratch(current, selected, scratch);
        selected += 1;
      }
      visited += 1;
      current = this.nextByFixture[current] ?? -1;
    }
    output.candidateTotal = candidateTotal;
    output.visitedCount = visited;
    output.selectedCount = selected;
    output.candidateCapHit = candidateTotal > visited;
    output.selectedCapHit = visited > selected;
    return true;
  }

  private isFixtureReadCurrent(
    fixtureId: number,
    storeVersion: number,
    fixture: RestFixtureIntoOutput,
  ): boolean {
    return (
      fixture.ok &&
      fixture.active &&
      fixture.fixtureId === fixtureId &&
      fixture.storeVersion === storeVersion &&
      fixture.ownerVersion === (this.fixtureVersions[fixtureId] ?? 0) &&
      (this.linked[fixtureId] ?? 0) === 1
    );
  }

  private writeCandidateIntoScratch(
    fixtureId: number,
    selectedIndex: number,
    scratch: RestCandidateSelectionIntoScratch,
  ): void {
    const fixture = scratch.fixtureReadOutput;
    scratch.fixtureIds[selectedIndex] = fixtureId;
    scratch.entityIndexes[selectedIndex] = fixture.entityIndex;
    scratch.entityGenerations[selectedIndex] = fixture.entityGeneration;
    scratch.fixtureKindCodes[selectedIndex] = encodeOptionalFixtureKind(fixture.kind);
    scratch.restKindCodes[selectedIndex] = encodeOptionalRestKind(fixture.restKind);
    scratch.regionIds[selectedIndex] = fixture.regionId;
    scratch.targetCellIndexes[selectedIndex] = fixture.targetCellIndex;
    scratch.interactionSpotIds[selectedIndex] = fixture.interactionSpotId;
    scratch.scheduleCodes[selectedIndex] = encodeOptionalScheduleWindow(fixture.scheduleWindow);
    scratch.weatherCodes[selectedIndex] = encodeOptionalWeatherExposure(fixture.weatherExposure);
    scratch.permissionIds[selectedIndex] = fixture.permissionId;
    scratch.recoveryPerTickQ16s[selectedIndex] = fixture.recoveryPerTickQ16;
    scratch.scoreMillis[selectedIndex] = fixture.baseScoreMilli;
    scratch.cachedFixtureVersions[selectedIndex] = this.fixtureVersions[fixtureId] ?? 0;
    scratch.currentFixtureOwnerVersions[selectedIndex] = fixture.ownerVersion;
    scratch.linkedCandidateFlags[selectedIndex] = this.linked[fixtureId] ?? 0;
  }

  private isCandidateSelectionBasisCurrent(
    store: RestSleepStore,
    environment: RestCandidateEnvironmentBasis,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
    selectedCount: number,
    storeVersion: number,
    sourceOwnerVersion: number,
    ownerIndexVersion: number,
  ): boolean {
    if (
      store.version !== storeVersion ||
      this.sourceVersion !== sourceOwnerVersion ||
      this.indexVersion !== ownerIndexVersion ||
      this.dirtyCount !== 0 ||
      output.restStoreVersion !== storeVersion ||
      output.sourceVersion !== sourceOwnerVersion ||
      output.indexVersion !== ownerIndexVersion ||
      output.dirtyBacklog !== 0 ||
      !isRestEnvironmentBasisCurrent(environment, output)
    ) {
      return false;
    }
    for (let index = 0; index < selectedCount; index += 1) {
      const fixtureId = scratch.fixtureIds[index] ?? M3_REST_FIXTURE_NONE;
      store.readFixtureInto(fixtureId, scratch.fixtureReadOutput);
      if (
        !this.isCandidateScratchRowCurrent(fixtureId, index, storeVersion, environment, scratch)
      ) {
        return false;
      }
    }
    return true;
  }

  private isCandidateScratchRowCurrent(
    fixtureId: number,
    selectedIndex: number,
    storeVersion: number,
    environment: RestCandidateEnvironmentBasis,
    scratch: RestCandidateSelectionIntoScratch,
  ): boolean {
    const fixture = scratch.fixtureReadOutput;
    return (
      this.isFixtureReadCurrent(fixtureId, storeVersion, fixture) &&
      fixture.entityIndex === (scratch.entityIndexes[selectedIndex] ?? 0) &&
      fixture.entityGeneration === (scratch.entityGenerations[selectedIndex] ?? 0) &&
      encodeOptionalFixtureKind(fixture.kind) === (scratch.fixtureKindCodes[selectedIndex] ?? 0) &&
      encodeOptionalRestKind(fixture.restKind) === (scratch.restKindCodes[selectedIndex] ?? 0) &&
      fixture.regionId === (scratch.regionIds[selectedIndex] ?? 0) &&
      fixture.targetCellIndex === (scratch.targetCellIndexes[selectedIndex] ?? 0) &&
      fixture.interactionSpotId === (scratch.interactionSpotIds[selectedIndex] ?? 0) &&
      encodeOptionalScheduleWindow(fixture.scheduleWindow) ===
        (scratch.scheduleCodes[selectedIndex] ?? 0) &&
      encodeOptionalWeatherExposure(fixture.weatherExposure) ===
        (scratch.weatherCodes[selectedIndex] ?? 0) &&
      fixture.permissionId === (scratch.permissionIds[selectedIndex] ?? 0) &&
      fixture.recoveryPerTickQ16 === (scratch.recoveryPerTickQ16s[selectedIndex] ?? 0) &&
      fixture.baseScoreMilli === (scratch.scoreMillis[selectedIndex] ?? 0) &&
      encodeScheduleWindow(environment.scheduleWindow) ===
        (scratch.scheduleCodes[selectedIndex] ?? 0) &&
      encodeWeatherExposure(environment.weatherExposure) ===
        (scratch.weatherCodes[selectedIndex] ?? 0) &&
      fixture.ownerVersion === (scratch.cachedFixtureVersions[selectedIndex] ?? 0) &&
      fixture.ownerVersion === (scratch.currentFixtureOwnerVersions[selectedIndex] ?? 0) &&
      (scratch.linkedCandidateFlags[selectedIndex] ?? 0) === 1
    );
  }

  private finishCandidateSelectionInto(
    query: RestCandidateQuery,
    restKindCode: number,
    scheduleCode: number,
    weatherCode: number,
    scratch: RestCandidateSelectionIntoScratch,
    output: RestCandidateSelectionIntoOutput,
  ): void {
    output.ok = true;
    output.reason = this.resolveSelectionReason(
      query.regionId,
      restKindCode,
      scheduleCode,
      weatherCode,
      query.permissionId,
      output.candidateTotal,
      output.candidateCapHit,
    );
    if (output.selectedCount > 0) {
      copyFirstRestCandidateIntoOutput(scratch, output);
    }
    this.selectionCount += 1;
    this.candidateVisitedCount += output.visitedCount;
  }

  private resolveSelectionReason(
    regionId: number,
    restKindCode: number,
    scheduleCode: number,
    weatherCode: number,
    permissionId: number,
    candidateTotal: number,
    candidateCapHit: boolean,
  ): RestSleepReason {
    if (candidateCapHit) {
      return "trace.candidate_cap_reached";
    }

    if (candidateTotal > 0) {
      return "rest.selected_indexed_path";
    }

    const aggregateKey = createAggregateKey(
      regionId,
      restKindCode,
      permissionId,
      this.permissionCapacity,
    );
    if ((this.aggregateCounts[aggregateKey] ?? 0) === 0) {
      return "rest.rejected_no_indexed_candidate";
    }

    const scheduleKey = createScheduleKey(
      regionId,
      restKindCode,
      scheduleCode,
      permissionId,
      this.permissionCapacity,
    );
    if ((this.scheduleCounts[scheduleKey] ?? 0) === 0) {
      return "rest.rejected_schedule_window";
    }

    void weatherCode;
    return "rest.rejected_weather_exposure";
  }

  private validateQuery(
    query: RestCandidateQuery,
    outputFixtureIds: Uint32Array,
  ): RestCandidateQueryResult {
    if (
      !isIndexInRange(query.regionId, this.regionCapacity) ||
      !isIndexInRange(query.permissionId, this.permissionCapacity) ||
      !isPositiveUint32(query.candidateCap) ||
      !isPositiveUint32(query.maxSelectedFixtures) ||
      outputFixtureIds.length < query.maxSelectedFixtures
    ) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    return {
      ok: true,
      reason: "rest.none",
      candidateTotal: 0,
      visitedCount: 0,
      selectedCount: 0,
      candidateCapHit: false,
      selectedCapHit: false,
      sourceVersion: this.sourceVersion,
      indexVersion: this.indexVersion,
      traceSequence: 0,
    };
  }

  private clearIndex(): void {
    this.linked.fill(0);
    this.bucketKeys.fill(-1);
    this.fixtureVersions.fill(0);
    this.bucketHeads.fill(-1);
    this.bucketCounts.fill(0);
    this.aggregateCounts.fill(0);
    this.scheduleCounts.fill(0);
    this.aggregateKeys.fill(-1);
    this.scheduleKeys.fill(-1);
    this.nextByFixture.fill(-1);
    this.previousByFixture.fill(-1);
    this.indexedCount = 0;
  }
}

export class RestJobDriverStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly ownerIndexes: Uint32Array;
  private readonly ownerGenerations: Uint32Array;
  private readonly actorIds: Uint32Array;
  private readonly fixtureIds: Uint32Array;
  private readonly restKindCodes: Uint8Array;
  private readonly stepCodes: Uint8Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly interactionSpotIds: Uint32Array;
  private readonly scheduleCodes: Uint8Array;
  private readonly environmentVersions: Uint32Array;
  private readonly needOwnerVersions: Uint32Array;
  private readonly reservationVersions: Uint32Array;
  private readonly fixtureClaimIds: Uint32Array;
  private readonly interactionClaimIds: Uint32Array;
  private readonly recoveryTargetValues: Uint16Array;
  private readonly recoveryPerTickQ16: Uint32Array;
  private readonly recoveryProgressQ16: Uint32Array;
  private readonly stepEnteredTicks: Float64Array;
  private readonly terminalReasonCodes: Uint8Array;
  private activeCount = 0;
  private storeVersion = 0;
  private reservationAttemptCount = 0;
  private cleanupReleaseCount = 0;
  private completedJobCount = 0;
  private cancelledJobCount = 0;
  private interruptedJobCount = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "rest job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.ownerIndexes = new Uint32Array(capacity);
    this.ownerGenerations = new Uint32Array(capacity);
    this.actorIds = new Uint32Array(capacity);
    this.fixtureIds = new Uint32Array(capacity);
    this.restKindCodes = new Uint8Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.targetCellIndexes = new Uint32Array(capacity);
    this.interactionSpotIds = new Uint32Array(capacity);
    this.scheduleCodes = new Uint8Array(capacity);
    this.environmentVersions = new Uint32Array(capacity);
    this.needOwnerVersions = new Uint32Array(capacity);
    this.reservationVersions = new Uint32Array(capacity);
    this.fixtureClaimIds = new Uint32Array(capacity);
    this.interactionClaimIds = new Uint32Array(capacity);
    this.recoveryTargetValues = new Uint16Array(capacity);
    this.recoveryPerTickQ16 = new Uint32Array(capacity);
    this.recoveryProgressQ16 = new Uint32Array(capacity);
    this.stepEnteredTicks = new Float64Array(capacity);
    this.terminalReasonCodes = new Uint8Array(capacity);
    this.fixtureIds.fill(M3_REST_FIXTURE_NONE);
    this.fixtureClaimIds.fill(M3_REST_FIXTURE_NONE);
    this.interactionClaimIds.fill(M3_REST_FIXTURE_NONE);
  }

  createJob(
    input: RestJobCreateInput,
    restStore: RestSleepStore,
    environment: M3EnvironmentProjection,
    needStore: NeedStore,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const validation = this.validateCreateInput(input, restStore, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "rest.job_already_active" };
    }

    const fixture = restStore.readFixture(input.fixtureId);
    if (fixture === undefined) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    const currentRest = needStore.readLaneValue(input.actorId, NEED_LANE_REST);
    const requiredWorkQ16 =
      input.recoveryTargetValue > currentRest ? (input.recoveryTargetValue - currentRest) << 16 : 1;
    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: M3_REST_SLEEP_JOB_KIND,
        targetId: input.fixtureId,
        initialStep: "reserve",
        interruptionPolicy: input.interruptionPolicy ?? defaultPolicy(input.restKind),
        requiredWorkQ16,
        createdTick: input.createdTick,
      },
      registry,
    );

    if (!created.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.active[input.jobId] = 1;
    this.ownerIndexes[input.jobId] = input.owner.index;
    this.ownerGenerations[input.jobId] = input.owner.generation;
    this.actorIds[input.jobId] = input.actorId;
    this.fixtureIds[input.jobId] = input.fixtureId;
    this.restKindCodes[input.jobId] = encodeRestKind(input.restKind);
    this.stepCodes[input.jobId] = REST_JOB_CREATED;
    this.targetCellIndexes[input.jobId] = fixture.targetCellIndex;
    this.interactionSpotIds[input.jobId] = fixture.interactionSpotId;
    this.scheduleCodes[input.jobId] = encodeScheduleWindow(fixture.scheduleWindow);
    this.environmentVersions[input.jobId] = environment.version;
    this.needOwnerVersions[input.jobId] = needStore.readLaneOwnerVersion(
      input.actorId,
      NEED_LANE_REST,
    );
    this.reservationVersions[input.jobId] = 0;
    this.fixtureClaimIds[input.jobId] = M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[input.jobId] = M3_REST_FIXTURE_NONE;
    this.recoveryTargetValues[input.jobId] = input.recoveryTargetValue;
    this.recoveryPerTickQ16[input.jobId] = input.recoveryPerTickQ16;
    this.recoveryProgressQ16[input.jobId] = 0;
    this.stepEnteredTicks[input.jobId] = input.createdTick;
    this.terminalReasonCodes[input.jobId] = REST_REASON_NONE;
    this.activeCount += 1;
    return this.finish(input.jobId);
  }

  reserveFixture(
    jobId: number,
    tick: Tick,
    leaseExpiryTick: Tick,
    restStore: RestSleepStore,
    registry: EntityRegistry,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const ready = this.validateStep(jobId, REST_JOB_CREATED, tick);
    if (!ready.ok) {
      return ready;
    }

    const fixtureId = this.fixtureIds[jobId] ?? M3_REST_FIXTURE_NONE;
    const fixture = restStore.readFixture(fixtureId);
    if (fixture === undefined) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    this.reservationAttemptCount += 1;
    const acquired = ledger.acquire(
      {
        owner: this.readOwner(jobId),
        jobId,
        createdTick: tick,
        leaseExpiryTick,
        claims: [
          { channel: "entity", target: fixture.entity },
          {
            channel: "interaction_spot",
            target: fixture.entity,
            spotId: fixture.interactionSpotId,
          },
        ],
      },
      registry,
    );

    if (!acquired.ok) {
      return { ok: false, reason: acquired.reason };
    }

    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      const released = ledger.releaseClaims(acquired.claimIds);
      if (!released.ok) {
        return { ok: false, reason: released.reason };
      }
      this.cleanupReleaseCount += released.releasedCount;
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.fixtureClaimIds[jobId] = acquired.claimIds[0] ?? M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = acquired.claimIds[1] ?? M3_REST_FIXTURE_NONE;
    this.reservationVersions[jobId] = acquired.version;
    this.stepCodes[jobId] = REST_JOB_PATHING_TO_FIXTURE;
    this.stepEnteredTicks[jobId] = tick;
    return this.finish(jobId);
  }

  beginRecovery(jobId: number, tick: Tick, jobCore: JobCoreStore): RestSleepMutationResult {
    const ready = this.validateStep(jobId, REST_JOB_PATHING_TO_FIXTURE, tick);
    if (!ready.ok) {
      return ready;
    }

    const entered = jobCore.enterStep(jobId, "interact", tick);
    if (!entered.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.stepCodes[jobId] =
      (this.restKindCodes[jobId] ?? REST_KIND_REST) === REST_KIND_SLEEP
        ? REST_JOB_SLEEPING
        : REST_JOB_RESTING;
    this.stepEnteredTicks[jobId] = tick;
    return this.finish(jobId);
  }

  tickRecovery(
    jobId: number,
    tick: Tick,
    needStore: NeedStore,
    jobCore: JobCoreStore,
    ledger: ReservationLedger,
    dirtySink?: NeedDirtySink,
  ): RestSleepMutationResult {
    const validation = this.validateRecoveryStep(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const deltaQ16 = this.recoveryPerTickQ16[jobId] ?? 0;
    const actorId = this.actorIds[jobId] ?? 0;
    const targetValue = this.recoveryTargetValues[jobId] ?? NEED_VALUE_MAX;
    const currentRest = needStore.readLaneValue(actorId, NEED_LANE_REST);
    const previousProgress = this.recoveryProgressQ16[jobId] ?? 0;
    const nextProgress = clampUint32(previousProgress + deltaQ16);
    const previousWhole = previousProgress >>> 16;
    const nextWhole = nextProgress >>> 16;
    const rawDelta = nextWhole > previousWhole ? nextWhole - previousWhole : 0;
    const recoveryDelta = Math.min(
      rawDelta,
      targetValue > currentRest ? targetValue - currentRest : 0,
    );

    if (recoveryDelta > 0 && !needStore.isActorActive(actorId)) {
      return { ok: false, reason: "rest.need_update_failed" };
    }

    const ticked = jobCore.tickJob(jobId, tick, deltaQ16);
    if (!ticked.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.recoveryProgressQ16[jobId] = nextProgress;

    if (recoveryDelta > 0) {
      const mutation = needStore.applyLaneDelta(
        {
          actorId,
          lane: NEED_LANE_REST,
          tick,
          reason: "need.external_delta",
          sourceSystemId: M3_REST_SLEEP_JOB_KIND,
          sourceEventId: jobId,
        },
        recoveryDelta,
      );
      if (!mutation.ok) {
        return { ok: false, reason: "rest.need_update_failed" };
      }
      dirtySink?.markDirty(actorId, NEED_LANE_REST);
      this.needOwnerVersions[jobId] = mutation.ownerVersion;
    }

    const updatedRest = needStore.readLaneValue(actorId, NEED_LANE_REST);
    if (updatedRest >= targetValue || ticked.readyToComplete) {
      return this.complete(jobId, tick, ledger, jobCore);
    }

    return this.finish(jobId);
  }

  cancel(
    jobId: number,
    tick: Tick,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const validation = this.validateTerminalInput(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const cancelled = jobCore.cancelJob(jobId, tick, ledger);
    if (!cancelled.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.cleanupReleaseCount += cancelled.releasedReservations;
    this.cancelledJobCount += 1;
    this.markTerminal(jobId, REST_JOB_CANCELLED, "job.interrupted_safe_point", tick);
    return this.finish(jobId);
  }

  fail(
    jobId: number,
    tick: Tick,
    reason: RestSleepReason,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const validation = this.validateTerminalInput(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const failed = jobCore.failJob(jobId, tick, mapRestFailureToJob(reason), ledger);
    if (!failed.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.cleanupReleaseCount += failed.releasedReservations;
    this.markTerminal(jobId, REST_JOB_FAILED, reason, tick);
    return this.finish(jobId);
  }

  interrupt(
    jobId: number,
    kind: JobInterruptionKind,
    tick: Tick,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const validation = this.validateTerminalInput(jobId, tick);
    if (!validation.ok) {
      return validation;
    }

    const interrupted = jobCore.requestInterruption(jobId, kind, tick, ledger);
    if (!interrupted.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    if (!interrupted.interrupted) {
      return { ok: false, reason: "job.interruption_denied" };
    }

    this.cleanupReleaseCount += interrupted.releasedReservations;
    this.cancelledJobCount += 1;
    this.interruptedJobCount += 1;
    this.markTerminal(jobId, REST_JOB_CANCELLED, "job.interrupted_safe_point", tick);
    return this.finish(jobId);
  }

  readJob(jobId: number): RestJobView | undefined {
    if (!this.isActiveJob(jobId)) {
      return undefined;
    }

    return this.createJobView(jobId);
  }

  createSnapshot(): RestJobDriverSnapshot {
    const records: RestJobView[] = [];

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      if ((this.active[jobId] ?? 0) === 1) {
        records.push(this.createJobView(jobId));
      }
    }

    return {
      snapshotVersion: M3_REST_SLEEP_STORE_VERSION,
      capacity: this.capacity,
      storeVersion: this.storeVersion,
      activeCount: this.activeCount,
      records,
    };
  }

  restoreFromSnapshot(snapshot: unknown): RestSleepMutationResult {
    const shape = validateRestJobSnapshotShape(snapshot, this.capacity);
    if (!shape.ok) {
      return shape;
    }

    this.clearAll();
    for (const record of shape.snapshot.records) {
      this.restoreRecord(record);
    }
    this.storeVersion = shape.snapshot.storeVersion;
    return { ok: true, id: this.activeCount, version: this.storeVersion };
  }

  createMetrics(): Pick<
    RestSleepMetrics,
    | "version"
    | "activeJobCount"
    | "reservationAttemptCount"
    | "cleanupReleaseCount"
    | "completedJobCount"
    | "cancelledJobCount"
    | "interruptedJobCount"
  > {
    return {
      version: this.storeVersion,
      activeJobCount: this.activeCount,
      reservationAttemptCount: this.reservationAttemptCount,
      cleanupReleaseCount: this.cleanupReleaseCount,
      completedJobCount: this.completedJobCount,
      cancelledJobCount: this.cancelledJobCount,
      interruptedJobCount: this.interruptedJobCount,
    };
  }

  private complete(
    jobId: number,
    tick: Tick,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): RestSleepMutationResult {
    const completed = jobCore.completeJob(jobId, tick, ledger);
    if (!completed.ok) {
      return { ok: false, reason: "rest.job_core_failed" };
    }

    this.cleanupReleaseCount += completed.releasedReservations;
    this.completedJobCount += 1;
    this.markTerminal(jobId, REST_JOB_COMPLETE, "rest.completed", tick);
    return this.finish(jobId);
  }

  private validateCreateInput(
    input: RestJobCreateInput,
    restStore: RestSleepStore,
    registry: EntityRegistry,
  ): RestSleepMutationResult {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "rest.job_id_out_of_range" };
    }

    if (!registry.isAlive(input.owner)) {
      return { ok: false, reason: "rest.fixture_entity_invalid" };
    }

    const fixture = restStore.readFixture(input.fixtureId);
    if (fixture?.restKind !== input.restKind) {
      return { ok: false, reason: "rest.fixture_not_active" };
    }

    if (
      !isSafeUint32(input.actorId) ||
      !isSafeTick(input.createdTick) ||
      !isNeedValue(input.recoveryTargetValue) ||
      !isPositiveUint32(input.recoveryPerTickQ16)
    ) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }

    return { ok: true, id: input.jobId, version: this.storeVersion };
  }

  private validateStep(jobId: number, step: number, tick: Tick): RestSleepMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "rest.job_not_active" };
    }

    if ((this.stepCodes[jobId] ?? REST_JOB_INACTIVE) !== step) {
      return { ok: false, reason: "rest.step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "rest.tick_invalid" };
    }

    return { ok: true, id: jobId, version: this.storeVersion };
  }

  private validateRecoveryStep(jobId: number, tick: Tick): RestSleepMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "rest.job_not_active" };
    }

    const step = this.stepCodes[jobId] ?? REST_JOB_INACTIVE;
    if (step !== REST_JOB_RESTING && step !== REST_JOB_SLEEPING) {
      return { ok: false, reason: "rest.step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "rest.tick_invalid" };
    }

    return { ok: true, id: jobId, version: this.storeVersion };
  }

  private validateTerminalInput(jobId: number, tick: Tick): RestSleepMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "rest.job_not_active" };
    }

    if (isTerminalRestStep(this.stepCodes[jobId] ?? REST_JOB_INACTIVE)) {
      return { ok: false, reason: "rest.step_invalid" };
    }

    if (!isSafeTick(tick)) {
      return { ok: false, reason: "rest.tick_invalid" };
    }

    return { ok: true, id: jobId, version: this.storeVersion };
  }

  private markTerminal(jobId: number, step: number, reason: RestSleepReason, tick: Tick): void {
    this.stepCodes[jobId] = step;
    this.terminalReasonCodes[jobId] = encodeRestReason(reason);
    this.fixtureClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.interactionClaimIds[jobId] = M3_REST_FIXTURE_NONE;
    this.stepEnteredTicks[jobId] = tick;
  }

  private createJobView(jobId: number): RestJobView {
    return {
      jobId,
      owner: this.readOwner(jobId),
      actorId: this.actorIds[jobId] ?? 0,
      fixtureId: this.fixtureIds[jobId] ?? M3_REST_FIXTURE_NONE,
      restKind: decodeRestKind(this.restKindCodes[jobId] ?? REST_KIND_REST),
      step: decodeRestJobStep(this.stepCodes[jobId] ?? REST_JOB_INACTIVE),
      targetCellIndex: this.targetCellIndexes[jobId] ?? 0,
      interactionSpotId: this.interactionSpotIds[jobId] ?? 0,
      scheduleWindow: decodeScheduleWindow(this.scheduleCodes[jobId] ?? 0),
      environmentVersion: this.environmentVersions[jobId] ?? 0,
      needOwnerVersion: this.needOwnerVersions[jobId] ?? 0,
      reservationVersion: this.reservationVersions[jobId] ?? 0,
      fixtureClaimId: this.fixtureClaimIds[jobId] ?? M3_REST_FIXTURE_NONE,
      interactionClaimId: this.interactionClaimIds[jobId] ?? M3_REST_FIXTURE_NONE,
      recoveryTargetValue: this.recoveryTargetValues[jobId] ?? 0,
      recoveryPerTickQ16: this.recoveryPerTickQ16[jobId] ?? 0,
      recoveryProgressQ16: this.recoveryProgressQ16[jobId] ?? 0,
      stepEnteredTick: this.stepEnteredTicks[jobId] ?? 0,
      terminalReason: decodeRestReason(this.terminalReasonCodes[jobId] ?? REST_REASON_NONE),
    };
  }

  private restoreRecord(record: RestJobView): void {
    this.active[record.jobId] = 1;
    this.ownerIndexes[record.jobId] = record.owner.index;
    this.ownerGenerations[record.jobId] = record.owner.generation;
    this.actorIds[record.jobId] = record.actorId;
    this.fixtureIds[record.jobId] = record.fixtureId;
    this.restKindCodes[record.jobId] = encodeRestKind(record.restKind);
    this.stepCodes[record.jobId] = encodeRestJobStep(record.step);
    this.targetCellIndexes[record.jobId] = record.targetCellIndex;
    this.interactionSpotIds[record.jobId] = record.interactionSpotId;
    this.scheduleCodes[record.jobId] = encodeScheduleWindow(record.scheduleWindow);
    this.environmentVersions[record.jobId] = record.environmentVersion;
    this.needOwnerVersions[record.jobId] = record.needOwnerVersion;
    this.reservationVersions[record.jobId] = record.reservationVersion;
    this.fixtureClaimIds[record.jobId] = record.fixtureClaimId;
    this.interactionClaimIds[record.jobId] = record.interactionClaimId;
    this.recoveryTargetValues[record.jobId] = record.recoveryTargetValue;
    this.recoveryPerTickQ16[record.jobId] = record.recoveryPerTickQ16;
    this.recoveryProgressQ16[record.jobId] = record.recoveryProgressQ16;
    this.stepEnteredTicks[record.jobId] = record.stepEnteredTick;
    this.terminalReasonCodes[record.jobId] = encodeRestReason(record.terminalReason);
    this.activeCount += 1;
  }

  private clearAll(): void {
    this.active.fill(0);
    this.fixtureIds.fill(M3_REST_FIXTURE_NONE);
    this.fixtureClaimIds.fill(M3_REST_FIXTURE_NONE);
    this.interactionClaimIds.fill(M3_REST_FIXTURE_NONE);
    this.stepCodes.fill(REST_JOB_INACTIVE);
    this.activeCount = 0;
    this.storeVersion = 0;
  }

  private isActiveJob(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.active[jobId] ?? 0) === 1;
  }

  private readOwner(jobId: number): EntityId {
    return {
      index: this.ownerIndexes[jobId] ?? 0,
      generation: this.ownerGenerations[jobId] ?? 0,
    };
  }

  private finish(jobId: number): RestSleepMutationResult {
    this.storeVersion += 1;
    return { ok: true, id: jobId, version: this.storeVersion };
  }
}

export class RestSleepTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly ticks: Float64Array;
  private readonly actorIds: Uint32Array;
  private readonly fixtureIds: Uint32Array;
  private readonly candidateTotals: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly selectedCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedCaps: Uint32Array;
  private readonly exactPathCounts: Uint32Array;
  private readonly exactPathCaps: Uint32Array;
  private readonly nodeExpansions: Uint32Array;
  private readonly sourceRestVersions: Uint32Array;
  private readonly environmentVersions: Uint32Array;
  private readonly reservationVersions: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity = M3_REST_SLEEP_TRACE_CAPACITY) {
    assertValidCapacity(capacity, "rest trace capacity");
    this.capacity = capacity;
    this.sequences = new Uint32Array(capacity);
    this.ticks = new Float64Array(capacity);
    this.actorIds = new Uint32Array(capacity);
    this.fixtureIds = new Uint32Array(capacity);
    this.candidateTotals = new Uint32Array(capacity);
    this.visitedCounts = new Uint32Array(capacity);
    this.selectedCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedCaps = new Uint32Array(capacity);
    this.exactPathCounts = new Uint32Array(capacity);
    this.exactPathCaps = new Uint32Array(capacity);
    this.nodeExpansions = new Uint32Array(capacity);
    this.sourceRestVersions = new Uint32Array(capacity);
    this.environmentVersions = new Uint32Array(capacity);
    this.reservationVersions = new Uint32Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
    this.fixtureIds.fill(M3_REST_FIXTURE_NONE);
  }

  record(input: RestTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;
    this.sequences[slot] = sequence;
    this.ticks[slot] = input.tick;
    this.actorIds[slot] = input.actorId;
    this.fixtureIds[slot] = input.fixtureId;
    this.candidateTotals[slot] = input.candidateTotal;
    this.visitedCounts[slot] = input.visitedCount;
    this.selectedCounts[slot] = input.selectedCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedCaps[slot] = input.selectedCap;
    this.exactPathCounts[slot] = input.exactPathCount;
    this.exactPathCaps[slot] = input.exactPathCap;
    this.nodeExpansions[slot] = input.nodeExpansions;
    this.sourceRestVersions[slot] = input.sourceRestVersion;
    this.environmentVersions[slot] = input.environmentVersion;
    this.reservationVersions[slot] = input.reservationVersion;
    this.reasonCodes[slot] = encodeRestReason(input.reason);
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): RestTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }

    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    return {
      sequence: this.sequences[slot] ?? 0,
      tick: this.ticks[slot] ?? 0,
      actorId: this.actorIds[slot] ?? 0,
      fixtureId: this.fixtureIds[slot] ?? M3_REST_FIXTURE_NONE,
      candidateTotal: this.candidateTotals[slot] ?? 0,
      visitedCount: this.visitedCounts[slot] ?? 0,
      selectedCount: this.selectedCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedCap: this.selectedCaps[slot] ?? 0,
      exactPathCount: this.exactPathCounts[slot] ?? 0,
      exactPathCap: this.exactPathCaps[slot] ?? 0,
      nodeExpansions: this.nodeExpansions[slot] ?? 0,
      sourceRestVersion: this.sourceRestVersions[slot] ?? 0,
      environmentVersion: this.environmentVersions[slot] ?? 0,
      reservationVersion: this.reservationVersions[slot] ?? 0,
      reason: decodeRestReason(this.reasonCodes[slot] ?? REST_REASON_NONE),
    };
  }

  createMetrics(): { readonly capacity: number; readonly storedCount: number } {
    return { capacity: this.capacity, storedCount: this.stored };
  }
}

export function selectPathResolvedRestFixture(input: RestSelectionInput): RestSelectionResult {
  const emergencyThreshold = input.emergencyNeedThreshold ?? M3_REST_EMERGENCY_THRESHOLD;
  const restThreshold = input.restUrgencyThreshold ?? M3_REST_URGENCY_THRESHOLD;
  const restValue = input.needStore.readLaneValue(input.actorId, NEED_LANE_REST);
  const sourceRestVersion = input.needStore.readLaneOwnerVersion(input.actorId, NEED_LANE_REST);
  const reservationVersion = 0;

  if (!(input.actorCanRest ?? true)) {
    return createSelectionFailure(input, "rest.rejected_ability", sourceRestVersion, 0);
  }

  if (restValue >= restThreshold) {
    return createSelectionFailure(input, "rest.rejected_actor_not_tired", sourceRestVersion, 0);
  }

  if (
    input.needStore.readLaneValue(input.actorId, NEED_LANE_HUNGER) < emergencyThreshold ||
    input.needStore.readLaneValue(input.actorId, NEED_LANE_SAFETY) < emergencyThreshold
  ) {
    return createSelectionFailure(input, "rest.rejected_emergency_need", sourceRestVersion, 0);
  }

  const candidateCap = input.candidateCap ?? M3_REST_DEFAULT_CANDIDATE_CAP;
  const maxSelected = input.maxSelectedFixtures ?? M3_REST_DEFAULT_SELECTED_CAP;
  const maxExactPaths = input.maxExactPaths ?? M3_REST_DEFAULT_EXACT_PATH_CAP;
  const candidates = input.restIndex.selectCandidates(
    {
      regionId: input.regionId,
      restKind: input.restKind,
      scheduleWindow: input.environment.dayNight.scheduleWindow,
      weatherExposure: input.weatherExposure ?? "indoor",
      permissionId: input.permissionId,
      candidateCap,
      maxSelectedFixtures: maxSelected,
    },
    input.outputFixtureIds,
  );

  if (!candidates.ok) {
    return createSelectionFailure(input, candidates.reason, sourceRestVersion, 0);
  }

  if (candidates.selectedCount === 0) {
    const sequence = recordSelectionTrace(input, {
      sourceRestVersion,
      reservationVersion,
      candidateTotal: candidates.candidateTotal,
      visitedCount: candidates.visitedCount,
      selectedCount: candidates.selectedCount,
      candidateCap,
      selectedCap: maxSelected,
      exactPathCount: 0,
      exactPathCap: maxExactPaths,
      nodeExpansions: 0,
      fixtureId: M3_REST_FIXTURE_NONE,
      reason: candidates.reason,
    });
    return {
      ok: false,
      actorId: input.actorId,
      candidateTotal: candidates.candidateTotal,
      visitedCount: candidates.visitedCount,
      selectedCount: candidates.selectedCount,
      exactPathCount: 0,
      nodeExpansions: 0,
      traceSequence: sequence,
      reason: candidates.reason,
    };
  }

  input.pathCandidateScratch.length = 0;
  for (let index = 0; index < candidates.selectedCount; index += 1) {
    const fixtureId = input.outputFixtureIds[index] ?? M3_REST_FIXTURE_NONE;
    const fixture = input.restStore.readFixture(fixtureId);
    if (fixture !== undefined) {
      input.pathCandidateScratch.push({
        candidateId: fixtureId,
        targetCellIndex: fixture.targetCellIndex,
        scoreMilli: fixture.baseScoreMilli,
      });
    }
  }

  const pathOptions = {
    originCellIndex: input.originCellIndex,
    candidates: input.pathCandidateScratch,
    maxExactPaths,
    basis: input.pathBasis,
    issuedTick: input.issuedTick,
    requestSequenceStart: input.requestSequenceStart,
  };
  const pathing =
    input.maxNodeExpansions === undefined
      ? resolveTopKPathCandidates(input.pathfinder, input.grid, pathOptions)
      : resolveTopKPathCandidates(input.pathfinder, input.grid, {
          ...pathOptions,
          maxNodeExpansions: input.maxNodeExpansions,
        });

  if (!pathing.ok) {
    return createSelectionFailure(input, "path.no_route_to_rest_fixture", sourceRestVersion, 0);
  }

  const selectedPath = firstSuccessfulPath(pathing.results);
  const reason: RestSleepReason =
    selectedPath === undefined ? "path.no_route_to_rest_fixture" : "rest.selected_indexed_path";
  const selectedFixtureId =
    selectedPath?.goalCellIndex !== undefined
      ? findFixtureForGoal(input, candidates.selectedCount, selectedPath.goalCellIndex)
      : M3_REST_FIXTURE_NONE;
  const traceSequence = recordSelectionTrace(input, {
    sourceRestVersion,
    reservationVersion,
    candidateTotal: candidates.candidateTotal,
    visitedCount: candidates.visitedCount,
    selectedCount: candidates.selectedCount,
    candidateCap,
    selectedCap: maxSelected,
    exactPathCount: pathing.exactPathCount,
    exactPathCap: maxExactPaths,
    nodeExpansions: pathing.nodeExpansions,
    fixtureId: selectedFixtureId,
    reason: candidates.candidateCapHit ? "trace.candidate_cap_reached" : reason,
  });

  if (selectedPath === undefined) {
    return {
      ok: false,
      actorId: input.actorId,
      candidateTotal: candidates.candidateTotal,
      visitedCount: candidates.visitedCount,
      selectedCount: candidates.selectedCount,
      exactPathCount: pathing.exactPathCount,
      nodeExpansions: pathing.nodeExpansions,
      traceSequence,
      reason,
    };
  }

  return {
    ok: true,
    actorId: input.actorId,
    fixtureId: selectedFixtureId,
    selectedPath,
    candidateTotal: candidates.candidateTotal,
    visitedCount: candidates.visitedCount,
    selectedCount: candidates.selectedCount,
    exactPathCount: pathing.exactPathCount,
    nodeExpansions: pathing.nodeExpansions,
    candidateCapHit: candidates.candidateCapHit,
    exactPathCapHit: pathing.capHitCount > 0,
    traceSequence,
    reason: "rest.selected_indexed_path",
  };
}

export function createRestSleepStore(
  fixtureCapacity: number,
  regionCapacity: number,
  permissionCapacity: number,
): RestSleepStore {
  return new RestSleepStore(fixtureCapacity, regionCapacity, permissionCapacity);
}

export function createRestCandidateIndex(options: RestCandidateIndexOptions): RestCandidateIndex {
  return new RestCandidateIndex(options);
}

export function createRestJobDriverStore(capacity: number): RestJobDriverStore {
  return new RestJobDriverStore(capacity);
}

export function createRestSleepTraceStore(capacity?: number): RestSleepTraceStore {
  return new RestSleepTraceStore(capacity);
}

function createSelectionFailure(
  input: RestSelectionInput,
  reason: RestSleepReason,
  sourceRestVersion: number,
  reservationVersion: number,
): RestSelectionResult {
  const sequence = recordSelectionTrace(input, {
    sourceRestVersion,
    reservationVersion,
    candidateTotal: 0,
    visitedCount: 0,
    selectedCount: 0,
    candidateCap: input.candidateCap ?? M3_REST_DEFAULT_CANDIDATE_CAP,
    selectedCap: input.maxSelectedFixtures ?? M3_REST_DEFAULT_SELECTED_CAP,
    exactPathCount: 0,
    exactPathCap: input.maxExactPaths ?? M3_REST_DEFAULT_EXACT_PATH_CAP,
    nodeExpansions: 0,
    fixtureId: M3_REST_FIXTURE_NONE,
    reason,
  });
  return {
    ok: false,
    actorId: input.actorId,
    candidateTotal: 0,
    visitedCount: 0,
    selectedCount: 0,
    exactPathCount: 0,
    nodeExpansions: 0,
    traceSequence: sequence,
    reason,
  };
}

function recordSelectionTrace(
  input: RestSelectionInput,
  trace: Omit<RestTraceInput, "tick" | "actorId" | "environmentVersion"> & {
    readonly environmentVersion?: number;
  },
): number {
  return (
    input.traceStore?.record({
      tick: input.issuedTick,
      actorId: input.actorId,
      fixtureId: trace.fixtureId,
      candidateTotal: trace.candidateTotal,
      visitedCount: trace.visitedCount,
      selectedCount: trace.selectedCount,
      candidateCap: trace.candidateCap,
      selectedCap: trace.selectedCap,
      exactPathCount: trace.exactPathCount,
      exactPathCap: trace.exactPathCap,
      nodeExpansions: trace.nodeExpansions,
      sourceRestVersion: trace.sourceRestVersion,
      environmentVersion: trace.environmentVersion ?? input.environment.version,
      reservationVersion: trace.reservationVersion,
      reason: trace.reason,
    }) ?? 0
  );
}

function firstSuccessfulPath(results: readonly PathSearchResult[]): PathSearchResult | undefined {
  for (const result of results) {
    if (result.ok) {
      return result;
    }
  }

  return undefined;
}

function findFixtureForGoal(
  input: RestSelectionInput,
  selectedCount: number,
  goalCellIndex: number,
): number {
  for (let index = 0; index < selectedCount; index += 1) {
    const fixtureId = input.outputFixtureIds[index] ?? M3_REST_FIXTURE_NONE;
    const fixture = input.restStore.readFixture(fixtureId);
    if (fixture?.targetCellIndex === goalCellIndex) {
      return fixtureId;
    }
  }

  return M3_REST_FIXTURE_NONE;
}

function validateRestJobSnapshotShape(
  snapshot: unknown,
  capacity: number,
):
  | { readonly ok: true; readonly snapshot: RestJobDriverSnapshot }
  | { readonly ok: false; readonly reason: RestSleepReason } {
  if (!isPlainObject(snapshot)) {
    return { ok: false, reason: "rest.fixture_input_invalid" };
  }

  const snapshotVersion = snapshot["snapshotVersion"];
  const snapshotCapacity = snapshot["capacity"];
  const storeVersion = snapshot["storeVersion"];
  const activeCount = snapshot["activeCount"];
  const records = snapshot["records"];

  if (
    snapshotVersion !== M3_REST_SLEEP_STORE_VERSION ||
    snapshotCapacity !== capacity ||
    !isSafeUint32(storeVersion) ||
    !isSafeUint32(activeCount) ||
    !Array.isArray(records) ||
    records.length !== activeCount
  ) {
    return { ok: false, reason: "rest.fixture_input_invalid" };
  }

  const typedRecords: RestJobView[] = [];
  let lastJobId = -1;
  for (const record of records) {
    if (!isRestJobView(record, capacity) || record.jobId <= lastJobId) {
      return { ok: false, reason: "rest.fixture_input_invalid" };
    }
    typedRecords.push(record);
    lastJobId = record.jobId;
  }

  return {
    ok: true,
    snapshot: {
      snapshotVersion: M3_REST_SLEEP_STORE_VERSION,
      capacity,
      storeVersion,
      activeCount,
      records: typedRecords,
    },
  };
}

function isRestJobView(record: unknown, capacity: number): record is RestJobView {
  if (!isPlainObject(record)) {
    return false;
  }

  const owner = record["owner"];
  if (!isPlainObject(owner)) {
    return false;
  }

  return (
    isIndexInRange(record["jobId"], capacity) &&
    isSafeUint32(owner["index"]) &&
    isSafeUint32(owner["generation"]) &&
    isSafeUint32(record["actorId"]) &&
    isSafeUint32(record["fixtureId"]) &&
    isRestKind(record["restKind"]) &&
    isRestJobStep(record["step"]) &&
    isSafeUint32(record["targetCellIndex"]) &&
    isSafeUint32(record["interactionSpotId"]) &&
    isScheduleWindow(record["scheduleWindow"]) &&
    isSafeUint32(record["environmentVersion"]) &&
    isSafeUint32(record["needOwnerVersion"]) &&
    isSafeUint32(record["reservationVersion"]) &&
    isSafeUint32(record["fixtureClaimId"]) &&
    isSafeUint32(record["interactionClaimId"]) &&
    isNeedValue(record["recoveryTargetValue"]) &&
    isSafeUint32(record["recoveryPerTickQ16"]) &&
    isSafeUint32(record["recoveryProgressQ16"]) &&
    isSafeTickValue(record["stepEnteredTick"]) &&
    isRestSleepReason(record["terminalReason"])
  );
}

function isRestEnvironmentBasisCurrent(
  environment: RestCandidateEnvironmentBasis,
  output: RestCandidateSelectionIntoOutput,
): boolean {
  return (
    output.queryScheduleWindow === environment.scheduleWindow &&
    output.queryWeatherExposure === environment.weatherExposure &&
    output.environmentScheduleWindow === environment.scheduleWindow &&
    output.scheduleWindowVersion === environment.scheduleWindowVersion &&
    output.environmentWeatherExposure === environment.weatherExposure &&
    output.outdoorWorkAllowed === environment.outdoorWorkAllowed &&
    output.weatherVersion === environment.weatherVersion &&
    output.weatherSourceVersion === environment.weatherSourceVersion
  );
}

function hasRestSelectionScratchCapacity(scratch: RestCandidateSelectionIntoScratch): boolean {
  return (
    scratch.fixtureIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.entityIndexes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.entityGenerations.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.fixtureKindCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.restKindCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.regionIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.targetCellIndexes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.interactionSpotIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.scheduleCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.weatherCodes.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.permissionIds.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.recoveryPerTickQ16s.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.scoreMillis.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.cachedFixtureVersions.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.currentFixtureOwnerVersions.length >= M3_REST_DEFAULT_SELECTED_CAP &&
    scratch.linkedCandidateFlags.length >= M3_REST_DEFAULT_SELECTED_CAP
  );
}

function resetRestSelectionScratch(scratch: RestCandidateSelectionIntoScratch): void {
  for (let index = 0; index < M3_REST_DEFAULT_SELECTED_CAP; index += 1) {
    scratch.fixtureIds[index] = M3_REST_FIXTURE_NONE;
    scratch.entityIndexes[index] = 0;
    scratch.entityGenerations[index] = 0;
    scratch.fixtureKindCodes[index] = 0;
    scratch.restKindCodes[index] = 0;
    scratch.regionIds[index] = 0;
    scratch.targetCellIndexes[index] = 0;
    scratch.interactionSpotIds[index] = 0;
    scratch.scheduleCodes[index] = 0;
    scratch.weatherCodes[index] = 0;
    scratch.permissionIds[index] = 0;
    scratch.recoveryPerTickQ16s[index] = 0;
    scratch.scoreMillis[index] = 0;
    scratch.cachedFixtureVersions[index] = 0;
    scratch.currentFixtureOwnerVersions[index] = 0;
    scratch.linkedCandidateFlags[index] = 0;
  }
}

function copyFirstRestCandidateIntoOutput(
  scratch: RestCandidateSelectionIntoScratch,
  output: RestCandidateSelectionIntoOutput,
): void {
  output.selectedFixtureId = scratch.fixtureIds[0] ?? M3_REST_FIXTURE_NONE;
  output.selectedEntityIndex = scratch.entityIndexes[0] ?? 0;
  output.selectedEntityGeneration = scratch.entityGenerations[0] ?? 0;
  output.selectedFixtureKind = decodeFixtureKind(scratch.fixtureKindCodes[0] ?? 0);
  output.selectedRestKind = decodeRestKind(scratch.restKindCodes[0] ?? 0);
  output.selectedRegionId = scratch.regionIds[0] ?? 0;
  output.selectedTargetCellIndex = scratch.targetCellIndexes[0] ?? 0;
  output.selectedInteractionSpotId = scratch.interactionSpotIds[0] ?? 0;
  output.selectedScheduleWindow = decodeScheduleWindow(scratch.scheduleCodes[0] ?? 0);
  output.selectedWeatherExposure = decodeWeatherExposure(scratch.weatherCodes[0] ?? 0);
  output.selectedPermissionId = scratch.permissionIds[0] ?? 0;
  output.selectedRecoveryPerTickQ16 = scratch.recoveryPerTickQ16s[0] ?? 0;
  output.selectedScoreMilli = scratch.scoreMillis[0] ?? 0;
  output.selectedCachedFixtureVersion = scratch.cachedFixtureVersions[0] ?? 0;
  output.selectedCurrentFixtureOwnerVersion = scratch.currentFixtureOwnerVersions[0] ?? 0;
  output.selectedLinkedCandidate = (scratch.linkedCandidateFlags[0] ?? 0) === 1;
}

function isRestFixtureBefore(
  store: RestSleepStore,
  currentFixtureId: number,
  nextFixtureId: number,
): boolean {
  const currentScore = store.readFixtureBaseScore(currentFixtureId);
  const nextScore = store.readFixtureBaseScore(nextFixtureId);

  if (currentScore !== nextScore) {
    return currentScore > nextScore;
  }

  return currentFixtureId < nextFixtureId;
}

function createRestBucketKey(
  regionId: number,
  restKindCode: number,
  scheduleCode: number,
  weatherCode: number,
  permissionId: number,
  regionCapacity: number,
  permissionCapacity: number,
): number {
  if (
    !isIndexInRange(regionId, regionCapacity) ||
    !isIndexInRange(restKindCode, REST_KIND_COUNT) ||
    !isIndexInRange(scheduleCode, SCHEDULE_COUNT) ||
    !isIndexInRange(weatherCode, WEATHER_EXPOSURE_COUNT) ||
    !isIndexInRange(permissionId, permissionCapacity)
  ) {
    return -1;
  }

  return (
    (((regionId * REST_KIND_COUNT + restKindCode) * SCHEDULE_COUNT + scheduleCode) *
      WEATHER_EXPOSURE_COUNT +
      weatherCode) *
      permissionCapacity +
    permissionId
  );
}

function createAggregateKey(
  regionId: number,
  restKindCode: number,
  permissionId: number,
  permissionCapacity: number,
): number {
  return (regionId * REST_KIND_COUNT + restKindCode) * permissionCapacity + permissionId;
}

function createScheduleKey(
  regionId: number,
  restKindCode: number,
  scheduleCode: number,
  permissionId: number,
  permissionCapacity: number,
): number {
  return (
    ((regionId * REST_KIND_COUNT + restKindCode) * SCHEDULE_COUNT + scheduleCode) *
      permissionCapacity +
    permissionId
  );
}

function encodeRestKind(kind: RestKind): number {
  return kind === "sleep" ? REST_KIND_SLEEP : REST_KIND_REST;
}

function encodeOptionalRestKind(kind: RestKind | undefined): number {
  return kind === undefined ? REST_KIND_REST : encodeRestKind(kind);
}

function decodeRestKind(code: number): RestKind {
  return code === REST_KIND_SLEEP ? "sleep" : "rest";
}

function isRestKind(value: unknown): value is RestKind {
  return value === "rest" || value === "sleep";
}

function encodeFixtureKind(kind: RestFixtureKind): number {
  return kind === "bedroll" ? 1 : 0;
}

function encodeOptionalFixtureKind(kind: RestFixtureKind | undefined): number {
  return kind === undefined ? 0 : encodeFixtureKind(kind);
}

function decodeFixtureKind(code: number): RestFixtureKind {
  return code === 1 ? "bedroll" : "clinic_mat";
}

function encodeWeatherExposure(exposure: RestFixtureWeatherExposure): number {
  return exposure === "outdoor" ? WEATHER_EXPOSURE_OUTDOOR : WEATHER_EXPOSURE_INDOOR;
}

function encodeOptionalWeatherExposure(exposure: RestFixtureWeatherExposure | undefined): number {
  return exposure === undefined ? WEATHER_EXPOSURE_INDOOR : encodeWeatherExposure(exposure);
}

function decodeWeatherExposure(code: number): RestFixtureWeatherExposure {
  return code === WEATHER_EXPOSURE_OUTDOOR ? "outdoor" : "indoor";
}

function encodeScheduleWindow(window: M3ScheduleWindowId): number {
  if (window === "daytime") {
    return SCHEDULE_DAYTIME;
  }
  if (window === "evening") {
    return SCHEDULE_EVENING;
  }
  if (window === "night") {
    return SCHEDULE_NIGHT;
  }
  return SCHEDULE_DAWN;
}

function encodeOptionalScheduleWindow(window: M3ScheduleWindowId | undefined): number {
  return window === undefined ? SCHEDULE_DAWN : encodeScheduleWindow(window);
}

function decodeScheduleWindow(code: number): M3ScheduleWindowId {
  if (code === SCHEDULE_DAYTIME) {
    return "daytime";
  }
  if (code === SCHEDULE_EVENING) {
    return "evening";
  }
  if (code === SCHEDULE_NIGHT) {
    return "night";
  }
  return "dawn";
}

function isScheduleWindow(value: unknown): value is M3ScheduleWindowId {
  return value === "dawn" || value === "daytime" || value === "evening" || value === "night";
}

function decodeRestJobStep(code: number): RestJobStep {
  if (code === REST_JOB_CREATED) {
    return "created";
  }
  if (code === REST_JOB_PATHING_TO_FIXTURE) {
    return "pathing_to_fixture";
  }
  if (code === REST_JOB_RESTING) {
    return "resting";
  }
  if (code === REST_JOB_SLEEPING) {
    return "sleeping";
  }
  if (code === REST_JOB_COMPLETE) {
    return "complete";
  }
  if (code === REST_JOB_FAILED) {
    return "failed";
  }
  if (code === REST_JOB_CANCELLED) {
    return "cancelled";
  }
  return "inactive";
}

function encodeRestJobStep(step: RestJobStep): number {
  if (step === "created") {
    return REST_JOB_CREATED;
  }
  if (step === "pathing_to_fixture") {
    return REST_JOB_PATHING_TO_FIXTURE;
  }
  if (step === "resting") {
    return REST_JOB_RESTING;
  }
  if (step === "sleeping") {
    return REST_JOB_SLEEPING;
  }
  if (step === "complete") {
    return REST_JOB_COMPLETE;
  }
  if (step === "failed") {
    return REST_JOB_FAILED;
  }
  if (step === "cancelled") {
    return REST_JOB_CANCELLED;
  }
  return REST_JOB_INACTIVE;
}

function isRestJobStep(value: unknown): value is RestJobStep {
  return (
    value === "inactive" ||
    value === "created" ||
    value === "pathing_to_fixture" ||
    value === "resting" ||
    value === "sleeping" ||
    value === "complete" ||
    value === "failed" ||
    value === "cancelled"
  );
}

function isTerminalRestStep(step: number): boolean {
  return step === REST_JOB_COMPLETE || step === REST_JOB_FAILED || step === REST_JOB_CANCELLED;
}

function defaultPolicy(kind: RestKind): "at_safe_point" | "emergency_only" {
  return kind === "sleep" ? "emergency_only" : "at_safe_point";
}

function mapRestFailureToJob(reason: RestSleepReason): JobFailureReason {
  if (reason === "path.no_route_to_rest_fixture") {
    return "path";
  }
  if (reason === "rest.rejected_reservation") {
    return "reservation";
  }
  if (reason === "rest.rejected_ability") {
    return "permission";
  }
  if (reason === "rest.rejected_emergency_need") {
    return "risk";
  }
  if (reason === "rest.rejected_schedule_window" || reason === "rest.rejected_weather_exposure") {
    return "time";
  }
  return "target_state";
}

function encodeRestReason(reason: RestSleepReason): number {
  if (reason === "rest.selected_indexed_path") {
    return REST_REASON_SELECTED;
  }
  if (reason === "rest.completed") {
    return REST_REASON_COMPLETED;
  }
  if (reason === "rest.rejected_no_indexed_candidate") {
    return REST_REASON_NO_SPOT;
  }
  if (reason === "rest.rejected_schedule_window") {
    return REST_REASON_SCHEDULE;
  }
  if (reason === "rest.rejected_weather_exposure") {
    return REST_REASON_WEATHER;
  }
  if (reason === "path.no_route_to_rest_fixture") {
    return REST_REASON_PATH;
  }
  if (reason === "rest.rejected_reservation") {
    return REST_REASON_RESERVATION;
  }
  if (reason === "rest.rejected_ability") {
    return REST_REASON_ABILITY;
  }
  if (reason === "rest.rejected_emergency_need") {
    return REST_REASON_EMERGENCY;
  }
  if (reason === "rest.rejected_actor_not_tired") {
    return REST_REASON_NOT_TIRED;
  }
  if (reason === "job.interrupted_safe_point") {
    return REST_REASON_INTERRUPTED;
  }
  if (reason === "job.interruption_denied") {
    return REST_REASON_INTERRUPT_DENIED;
  }
  if (reason === "trace.candidate_cap_reached") {
    return REST_REASON_CANDIDATE_CAP;
  }
  if (reason === "rest.job_core_failed") {
    return REST_REASON_JOB_CORE;
  }
  if (reason === "rest.need_update_failed") {
    return REST_REASON_NEED;
  }
  if (reason === "rest.step_invalid") {
    return REST_REASON_STEP;
  }
  if (reason === "rest.fixture_id_out_of_range") {
    return REST_REASON_FIXTURE_ID_OUT_OF_RANGE;
  }
  if (reason === "rest.fixture_already_active") {
    return REST_REASON_FIXTURE_ALREADY_ACTIVE;
  }
  if (reason === "rest.fixture_not_active") {
    return REST_REASON_FIXTURE_NOT_ACTIVE;
  }
  if (reason === "rest.fixture_entity_invalid") {
    return REST_REASON_FIXTURE_ENTITY_INVALID;
  }
  if (reason === "rest.fixture_input_invalid") {
    return REST_REASON_FIXTURE_INPUT_INVALID;
  }
  if (reason === "rest.job_id_out_of_range") {
    return REST_REASON_JOB_ID_OUT_OF_RANGE;
  }
  if (reason === "rest.job_already_active") {
    return REST_REASON_JOB_ALREADY_ACTIVE;
  }
  if (reason === "rest.job_not_active") {
    return REST_REASON_JOB_NOT_ACTIVE;
  }
  if (reason === "rest.tick_invalid") {
    return REST_REASON_TICK_INVALID;
  }
  const reservationReasonIndex = indexOfReservationReason(reason);
  if (reservationReasonIndex >= 0) {
    return REST_REASON_RESERVATION_BASE + reservationReasonIndex;
  }
  return REST_REASON_NONE;
}

function decodeRestReason(code: number): RestSleepReason {
  if (code === REST_REASON_SELECTED) {
    return "rest.selected_indexed_path";
  }
  if (code === REST_REASON_COMPLETED) {
    return "rest.completed";
  }
  if (code === REST_REASON_NO_SPOT) {
    return "rest.rejected_no_indexed_candidate";
  }
  if (code === REST_REASON_SCHEDULE) {
    return "rest.rejected_schedule_window";
  }
  if (code === REST_REASON_WEATHER) {
    return "rest.rejected_weather_exposure";
  }
  if (code === REST_REASON_PATH) {
    return "path.no_route_to_rest_fixture";
  }
  if (code === REST_REASON_RESERVATION) {
    return "rest.rejected_reservation";
  }
  if (code === REST_REASON_ABILITY) {
    return "rest.rejected_ability";
  }
  if (code === REST_REASON_EMERGENCY) {
    return "rest.rejected_emergency_need";
  }
  if (code === REST_REASON_NOT_TIRED) {
    return "rest.rejected_actor_not_tired";
  }
  if (code === REST_REASON_INTERRUPTED) {
    return "job.interrupted_safe_point";
  }
  if (code === REST_REASON_INTERRUPT_DENIED) {
    return "job.interruption_denied";
  }
  if (code === REST_REASON_CANDIDATE_CAP) {
    return "trace.candidate_cap_reached";
  }
  if (code === REST_REASON_JOB_CORE) {
    return "rest.job_core_failed";
  }
  if (code === REST_REASON_NEED) {
    return "rest.need_update_failed";
  }
  if (code === REST_REASON_STEP) {
    return "rest.step_invalid";
  }
  if (code === REST_REASON_FIXTURE_ID_OUT_OF_RANGE) {
    return "rest.fixture_id_out_of_range";
  }
  if (code === REST_REASON_FIXTURE_ALREADY_ACTIVE) {
    return "rest.fixture_already_active";
  }
  if (code === REST_REASON_FIXTURE_NOT_ACTIVE) {
    return "rest.fixture_not_active";
  }
  if (code === REST_REASON_FIXTURE_ENTITY_INVALID) {
    return "rest.fixture_entity_invalid";
  }
  if (code === REST_REASON_FIXTURE_INPUT_INVALID) {
    return "rest.fixture_input_invalid";
  }
  if (code === REST_REASON_JOB_ID_OUT_OF_RANGE) {
    return "rest.job_id_out_of_range";
  }
  if (code === REST_REASON_JOB_ALREADY_ACTIVE) {
    return "rest.job_already_active";
  }
  if (code === REST_REASON_JOB_NOT_ACTIVE) {
    return "rest.job_not_active";
  }
  if (code === REST_REASON_TICK_INVALID) {
    return "rest.tick_invalid";
  }
  const reservationReasonIndex = code - REST_REASON_RESERVATION_BASE;
  if (reservationReasonIndex >= 0 && reservationReasonIndex < RESERVATION_REASON_VALUES.length) {
    const reservationReason = RESERVATION_REASON_VALUES[reservationReasonIndex];
    if (isRestSleepReason(reservationReason)) {
      return reservationReason;
    }
  }
  return "rest.none";
}

function isRestSleepReason(value: unknown): value is RestSleepReason {
  return typeof value === "string" && (isLocalRestSleepReason(value) || isReservationReason(value));
}

function isLocalRestSleepReason(value: string): boolean {
  return (
    value === "rest.none" ||
    value === "rest.selected_indexed_path" ||
    value === "rest.completed" ||
    value === "rest.rejected_no_indexed_candidate" ||
    value === "rest.rejected_schedule_window" ||
    value === "rest.rejected_weather_exposure" ||
    value === "path.no_route_to_rest_fixture" ||
    value === "rest.rejected_reservation" ||
    value === "rest.rejected_ability" ||
    value === "rest.rejected_emergency_need" ||
    value === "rest.rejected_actor_not_tired" ||
    value === "job.interrupted_safe_point" ||
    value === "job.interruption_denied" ||
    value === "trace.candidate_cap_reached" ||
    value === "rest.job_core_failed" ||
    value === "rest.need_update_failed" ||
    value === "rest.step_invalid" ||
    value === "rest.fixture_id_out_of_range" ||
    value === "rest.fixture_already_active" ||
    value === "rest.fixture_not_active" ||
    value === "rest.fixture_entity_invalid" ||
    value === "rest.fixture_input_invalid" ||
    value === "rest.job_id_out_of_range" ||
    value === "rest.job_already_active" ||
    value === "rest.job_not_active" ||
    value === "rest.tick_invalid"
  );
}

function isReservationReason(value: string): boolean {
  return indexOfReservationReason(value) >= 0;
}

function indexOfReservationReason(value: string): number {
  for (let index = 0; index < RESERVATION_REASON_VALUES.length; index += 1) {
    if (RESERVATION_REASON_VALUES[index] === value) {
      return index;
    }
  }

  return -1;
}

function clearUint32(values: Uint32Array, count: number, fill: number): void {
  for (let index = 0; index < count; index += 1) {
    values[index] = fill;
  }
}

function isNeedValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= NEED_VALUE_MAX
  );
}

function isSafeTickValue(value: unknown): value is Tick {
  return typeof value === "number" && isSafeTick(value);
}

function isIndexInRange(value: unknown, upperBound: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < upperBound
  );
}

function isSafeUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff
  );
}

function isPositiveUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff
  );
}

function clampUint32(value: number): number {
  return Math.min(0xffff_ffff, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
