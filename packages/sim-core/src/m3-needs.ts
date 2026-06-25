import { assertValidCapacity } from "./entity-id";
import { requireSafeTick, type Tick } from "./time";

export const M3_NEED_STORE_SNAPSHOT_VERSION = 1;
export const NEED_LANE_HUNGER = 0;
export const NEED_LANE_REST = 1;
export const NEED_LANE_COMFORT = 2;
export const NEED_LANE_SOCIAL = 3;
export const NEED_LANE_SAFETY = 4;
export const NEED_LANE_COUNT = 5;
export const NEED_VALUE_MIN = 0;
export const NEED_VALUE_MAX = 1_000;
export const NEED_URGENCY_BUCKET_COUNT = 5;
export const NEED_URGENCY_DEFAULT_CANDIDATE_CAP = 24;
export const NEED_URGENCY_DEFAULT_SELECTED_CAP = 12;
export const NEED_ACTOR_NONE = 0xffff_ffff;

export type NeedLane =
  | typeof NEED_LANE_HUNGER
  | typeof NEED_LANE_REST
  | typeof NEED_LANE_COMFORT
  | typeof NEED_LANE_SOCIAL
  | typeof NEED_LANE_SAFETY;

export type NeedChangeReason =
  | "need.initialized"
  | "need.scheduled_decay"
  | "need.external_delta"
  | "need.manual_set"
  | "need.clamped_min"
  | "need.clamped_max";

export type NeedUrgencyTraceReason =
  | "need.urgency_indexed"
  | "need.hunger_urgency_indexed"
  | "need.rest_urgency_indexed"
  | "trace.candidate_cap_reached"
  | "need.urgency_no_candidate";

export type NeedReason =
  | "need_actor_out_of_range"
  | "need_actor_already_registered"
  | "need_actor_not_registered"
  | "need_lane_out_of_range"
  | "need_value_out_of_range"
  | "need_delta_out_of_range"
  | "need_tick_invalid"
  | "need_phase_out_of_range"
  | "need_interval_invalid"
  | "need_candidate_cap_invalid"
  | "need_selected_cap_invalid"
  | "need_candidate_buffer_too_small"
  | "need_dirty_backlog"
  | "need_trace_capacity_invalid";

export type NeedMutationResult =
  | {
      readonly ok: true;
      readonly actorId: number;
      readonly lane: NeedLane;
      readonly changed: boolean;
      readonly value: number;
      readonly ownerVersion: number;
      readonly reason: NeedChangeReason;
    }
  | { readonly ok: false; readonly reason: NeedReason };

export type NeedScheduleResult =
  | {
      readonly ok: true;
      readonly tick: Tick;
      readonly phase: number;
      readonly visitedCount: number;
      readonly changedCount: number;
      readonly budgetExhausted: boolean;
      readonly version: number;
    }
  | { readonly ok: false; readonly reason: NeedReason };

export interface NeedStoreOptions {
  readonly actorCapacity: number;
  readonly updateIntervalTicks: number;
  readonly phaseSalt?: number;
}

export interface NeedActorInput {
  readonly actorId: number;
  readonly hunger: number;
  readonly rest: number;
  readonly comfort: number;
  readonly social: number;
  readonly safety: number;
  readonly sourceTick: Tick;
  readonly phaseSeed?: number;
}

export interface NeedChangeInput {
  readonly actorId: number;
  readonly lane: NeedLane;
  readonly tick: Tick;
  readonly reason: NeedChangeReason;
  readonly sourceSystemId?: number;
  readonly sourceEventId?: number;
}

export interface NeedLastChangeView {
  readonly tick: Tick;
  readonly reason: NeedChangeReason;
  readonly sourceSystemId: number;
  readonly sourceEventId: number;
  readonly previousValue: number;
  readonly nextValue: number;
  readonly delta: number;
  readonly ownerVersion: number;
}

export interface NeedActorView {
  readonly actorId: number;
  readonly hunger: number;
  readonly rest: number;
  readonly comfort: number;
  readonly social: number;
  readonly safety: number;
  readonly ownerVersion: number;
}

export interface NeedStoreMetrics {
  readonly version: number;
  readonly actorCount: number;
  readonly scheduledUpdateCount: number;
  readonly scheduledChangeCount: number;
  readonly lastScheduledVisitedCount: number;
  readonly dirtyBacklog: number;
}

export interface NeedDirtySink {
  markDirty(actorId: number, lane: NeedLane): NeedMutationResult;
}

export interface NeedUrgencyIndexOptions {
  readonly actorCapacity: number;
  readonly urgencyBucketCount?: number;
}

export interface NeedUrgencyQuery {
  readonly lane: NeedLane;
  readonly minUrgencyBucket: number;
  readonly candidateCap: number;
  readonly maxSelectedActors: number;
}

export type NeedUrgencyQueryResult =
  | {
      readonly ok: true;
      readonly lane: NeedLane;
      readonly selectedCount: number;
      readonly bucketCandidateCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly sourceVersion: number;
      readonly indexVersion: number;
      readonly traceSequence: number;
    }
  | { readonly ok: false; readonly reason: NeedReason };

export interface NeedUrgencyIndexMetrics {
  readonly indexVersion: number;
  readonly sourceVersion: number;
  readonly indexedCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
  readonly refreshedCount: number;
  readonly rebuiltCount: number;
}

export interface NeedUrgencyTraceInput {
  readonly lane: NeedLane;
  readonly minUrgencyBucket: number;
  readonly bucketCandidateCount: number;
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly candidateCapHit: boolean;
  readonly selectedCapHit: boolean;
  readonly selectedActorId: number;
  readonly sourceVersion: number;
  readonly indexVersion: number;
  readonly reason: NeedUrgencyTraceReason;
}

export interface NeedUrgencyTraceView extends NeedUrgencyTraceInput {
  readonly sequence: number;
}

export interface NeedUrgencyTraceMetrics {
  readonly capacity: number;
  readonly storedCount: number;
  readonly nextSequence: number;
  readonly backlogCount: number;
}

export class NeedStore {
  readonly actorCapacity: number;
  readonly updateIntervalTicks: number;

  private readonly active: Uint8Array;
  private readonly values: Uint16Array;
  private readonly updatePhases: Uint32Array;
  private readonly laneVersions: Uint32Array;
  private readonly sourceTicks: Float64Array;
  private readonly sourceSystemIds: Uint32Array;
  private readonly sourceEventIds: Uint32Array;
  private readonly previousValues: Uint16Array;
  private readonly deltas: Int32Array;
  private readonly reasonCodes: Uint8Array;
  private readonly scheduleHeads: Int32Array;
  private readonly scheduleCursors: Int32Array;
  private readonly scheduleNext: Int32Array;
  private readonly schedulePrevious: Int32Array;
  private readonly phaseSalt: number;
  private actorCountValue = 0;
  private storeVersion = 0;
  private scheduledUpdateCount = 0;
  private scheduledChangeCount = 0;
  private lastScheduledVisitedCount = 0;

  constructor(options: NeedStoreOptions) {
    assertValidCapacity(options.actorCapacity, "need actor capacity");
    if (!isPositiveSafeInteger(options.updateIntervalTicks)) {
      throw new Error("need update interval must be a positive safe integer");
    }

    this.actorCapacity = options.actorCapacity;
    this.updateIntervalTicks = options.updateIntervalTicks;
    this.phaseSalt = options.phaseSalt ?? 17;
    const laneCapacity = options.actorCapacity * NEED_LANE_COUNT;
    this.active = new Uint8Array(options.actorCapacity);
    this.values = new Uint16Array(laneCapacity);
    this.updatePhases = new Uint32Array(laneCapacity);
    this.laneVersions = new Uint32Array(laneCapacity);
    this.sourceTicks = new Float64Array(laneCapacity);
    this.sourceSystemIds = new Uint32Array(laneCapacity);
    this.sourceEventIds = new Uint32Array(laneCapacity);
    this.previousValues = new Uint16Array(laneCapacity);
    this.deltas = new Int32Array(laneCapacity);
    this.reasonCodes = new Uint8Array(laneCapacity);
    this.scheduleHeads = createEmptyLinks(options.updateIntervalTicks);
    this.scheduleCursors = createEmptyLinks(options.updateIntervalTicks);
    this.scheduleNext = createEmptyLinks(laneCapacity);
    this.schedulePrevious = createEmptyLinks(laneCapacity);
  }

  get version(): number {
    return this.storeVersion;
  }

  get actorCount(): number {
    return this.actorCountValue;
  }

  registerActor(input: NeedActorInput): NeedMutationResult {
    const validation = this.validateActorInput(input);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.actorId] ?? 0) === 1) {
      return { ok: false, reason: "need_actor_already_registered" };
    }

    this.active[input.actorId] = 1;
    this.actorCountValue += 1;
    this.writeInitialLane(input, NEED_LANE_HUNGER, input.hunger);
    this.writeInitialLane(input, NEED_LANE_REST, input.rest);
    this.writeInitialLane(input, NEED_LANE_COMFORT, input.comfort);
    this.writeInitialLane(input, NEED_LANE_SOCIAL, input.social);
    this.writeInitialLane(input, NEED_LANE_SAFETY, input.safety);
    this.storeVersion += 1;
    this.writeActorLaneVersions(input.actorId);
    return {
      ok: true,
      actorId: input.actorId,
      lane: NEED_LANE_SAFETY,
      changed: true,
      value: input.safety,
      ownerVersion: this.storeVersion,
      reason: "need.initialized",
    };
  }

  setLane(input: NeedChangeInput, value: number): NeedMutationResult {
    if (!isNeedValue(value)) {
      return { ok: false, reason: "need_value_out_of_range" };
    }

    return this.writeLane(input, value);
  }

  applyLaneDelta(input: NeedChangeInput, delta: number): NeedMutationResult {
    if (!isInt32(delta)) {
      return { ok: false, reason: "need_delta_out_of_range" };
    }

    const validation = this.validateChange(input);
    if (!validation.ok) {
      return validation;
    }

    const key = createLaneKey(input.actorId, input.lane);
    const current = this.values[key] ?? 0;
    const unclamped = current + delta;
    const next = clampNeedValue(unclamped);
    let reason = input.reason;

    if (unclamped < NEED_VALUE_MIN) {
      reason = "need.clamped_min";
    } else if (unclamped > NEED_VALUE_MAX) {
      reason = "need.clamped_max";
    }

    return this.writeValidatedLane(input, current, next, reason);
  }

  processScheduledUpdates(
    tick: Tick,
    laneDeltas: Int32Array,
    budget: number,
    dirtySink?: NeedDirtySink,
  ): NeedScheduleResult {
    if (!isSafeTickNumber(tick)) {
      return { ok: false, reason: "need_tick_invalid" };
    }

    if (laneDeltas.length < NEED_LANE_COUNT || !isPositiveSafeInteger(budget)) {
      return { ok: false, reason: "need_delta_out_of_range" };
    }

    const phase = tick % this.updateIntervalTicks;
    const head = this.scheduleHeads[phase] ?? -1;
    let current = this.scheduleCursors[phase] ?? -1;
    let visited = 0;
    let changed = 0;

    if (current < 0) {
      current = head;
    }

    while (current >= 0 && visited < budget) {
      const actorId = Math.floor(current / NEED_LANE_COUNT);
      const laneValue = current - actorId * NEED_LANE_COUNT;
      const next = this.scheduleNext[current] ?? -1;
      const delta = laneDeltas[laneValue] ?? 0;

      if (delta !== 0 && isNeedLane(laneValue) && (this.active[actorId] ?? 0) === 1) {
        const result = this.applyLaneDelta(
          {
            actorId,
            lane: laneValue,
            tick,
            reason: "need.scheduled_decay",
          },
          delta,
        );

        if (result.ok && result.changed) {
          changed += 1;
          dirtySink?.markDirty(actorId, laneValue);
        }
      }

      visited += 1;
      current = next;
    }

    this.scheduleCursors[phase] = current >= 0 ? current : head;
    this.scheduledUpdateCount += visited;
    this.scheduledChangeCount += changed;
    this.lastScheduledVisitedCount = visited;
    return {
      ok: true,
      tick,
      phase,
      visitedCount: visited,
      changedCount: changed,
      budgetExhausted: current >= 0,
      version: this.storeVersion,
    };
  }

  readActorNeeds(actorId: number): NeedActorView | undefined {
    if (!this.isActorActive(actorId)) {
      return undefined;
    }

    return {
      actorId,
      hunger: this.readLaneValue(actorId, NEED_LANE_HUNGER),
      rest: this.readLaneValue(actorId, NEED_LANE_REST),
      comfort: this.readLaneValue(actorId, NEED_LANE_COMFORT),
      social: this.readLaneValue(actorId, NEED_LANE_SOCIAL),
      safety: this.readLaneValue(actorId, NEED_LANE_SAFETY),
      ownerVersion: this.storeVersion,
    };
  }

  readLaneValue(actorId: number, lane: NeedLane): number {
    if (!this.isActorActive(actorId)) {
      return NEED_VALUE_MIN;
    }

    return this.values[createLaneKey(actorId, lane)] ?? NEED_VALUE_MIN;
  }

  readLaneOwnerVersion(actorId: number, lane: NeedLane): number {
    if (!this.isActorActive(actorId)) {
      return 0;
    }

    return this.laneVersions[createLaneKey(actorId, lane)] ?? 0;
  }

  readLaneLastChange(actorId: number, lane: NeedLane): NeedLastChangeView | undefined {
    if (!this.isActorActive(actorId)) {
      return undefined;
    }

    const key = createLaneKey(actorId, lane);
    const nextValue = this.values[key] ?? 0;
    const delta = this.deltas[key] ?? 0;
    return {
      tick: this.sourceTicks[key] ?? 0,
      reason: decodeNeedChangeReason(this.reasonCodes[key] ?? 0),
      sourceSystemId: this.sourceSystemIds[key] ?? 0,
      sourceEventId: this.sourceEventIds[key] ?? 0,
      previousValue: this.previousValues[key] ?? nextValue,
      nextValue,
      delta,
      ownerVersion: this.laneVersions[key] ?? 0,
    };
  }

  readLaneUpdatePhase(actorId: number, lane: NeedLane): number {
    if (!this.isActorActive(actorId)) {
      return 0;
    }

    return this.updatePhases[createLaneKey(actorId, lane)] ?? 0;
  }

  isActorActive(actorId: number): boolean {
    return isIndexInRange(actorId, this.actorCapacity) && (this.active[actorId] ?? 0) === 1;
  }

  createMetrics(): NeedStoreMetrics {
    return {
      version: this.storeVersion,
      actorCount: this.actorCountValue,
      scheduledUpdateCount: this.scheduledUpdateCount,
      scheduledChangeCount: this.scheduledChangeCount,
      lastScheduledVisitedCount: this.lastScheduledVisitedCount,
      dirtyBacklog: 0,
    };
  }

  private writeInitialLane(input: NeedActorInput, lane: NeedLane, value: number): void {
    const key = createLaneKey(input.actorId, lane);
    const phase = createUpdatePhase(
      input.actorId,
      lane,
      input.phaseSeed ?? input.actorId,
      this.phaseSalt,
      this.updateIntervalTicks,
    );

    this.values[key] = value;
    this.updatePhases[key] = phase;
    this.sourceTicks[key] = input.sourceTick;
    this.reasonCodes[key] = encodeNeedChangeReason("need.initialized");
    this.previousValues[key] = value;
    this.deltas[key] = 0;
    this.insertScheduledLane(key, phase);
  }

  private writeActorLaneVersions(actorId: number): void {
    const baseKey = actorId * NEED_LANE_COUNT;

    for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
      this.laneVersions[baseKey + lane] = this.storeVersion;
    }
  }

  private writeLane(input: NeedChangeInput, nextValue: number): NeedMutationResult {
    const validation = this.validateChange(input);
    if (!validation.ok) {
      return validation;
    }

    const current = this.values[createLaneKey(input.actorId, input.lane)] ?? 0;
    return this.writeValidatedLane(input, current, nextValue, input.reason);
  }

  private writeValidatedLane(
    input: NeedChangeInput,
    current: number,
    nextValue: number,
    reason: NeedChangeReason,
  ): NeedMutationResult {
    const changed = current !== nextValue;
    const key = createLaneKey(input.actorId, input.lane);

    this.values[key] = nextValue;
    this.sourceTicks[key] = input.tick;
    this.sourceSystemIds[key] = input.sourceSystemId ?? 0;
    this.sourceEventIds[key] = input.sourceEventId ?? 0;
    this.previousValues[key] = current;
    this.deltas[key] = nextValue - current;
    this.reasonCodes[key] = encodeNeedChangeReason(reason);
    return this.finish(input.actorId, input.lane, changed, nextValue, reason);
  }

  private finish(
    actorId: number,
    lane: NeedLane,
    changed: boolean,
    value: number,
    reason: NeedChangeReason,
  ): NeedMutationResult {
    if (changed) {
      this.storeVersion += 1;
    }

    this.laneVersions[createLaneKey(actorId, lane)] = this.storeVersion;
    return { ok: true, actorId, lane, changed, value, ownerVersion: this.storeVersion, reason };
  }

  private validateActorInput(input: NeedActorInput): NeedMutationResult {
    if (!isIndexInRange(input.actorId, this.actorCapacity)) {
      return { ok: false, reason: "need_actor_out_of_range" };
    }

    if (!isSafeTickNumber(input.sourceTick)) {
      return { ok: false, reason: "need_tick_invalid" };
    }

    if (
      !isNeedValue(input.hunger) ||
      !isNeedValue(input.rest) ||
      !isNeedValue(input.comfort) ||
      !isNeedValue(input.social) ||
      !isNeedValue(input.safety)
    ) {
      return { ok: false, reason: "need_value_out_of_range" };
    }

    if (input.phaseSeed !== undefined && !Number.isSafeInteger(input.phaseSeed)) {
      return { ok: false, reason: "need_phase_out_of_range" };
    }

    return {
      ok: true,
      actorId: input.actorId,
      lane: NEED_LANE_HUNGER,
      changed: false,
      value: 0,
      ownerVersion: this.storeVersion,
      reason: "need.initialized",
    };
  }

  private validateChange(input: NeedChangeInput): NeedMutationResult {
    if (!this.isActorActive(input.actorId)) {
      return { ok: false, reason: "need_actor_not_registered" };
    }

    if (!isNeedLane(input.lane)) {
      return { ok: false, reason: "need_lane_out_of_range" };
    }

    if (!isSafeTickNumber(input.tick)) {
      return { ok: false, reason: "need_tick_invalid" };
    }

    return {
      ok: true,
      actorId: input.actorId,
      lane: input.lane,
      changed: false,
      value: 0,
      ownerVersion: this.storeVersion,
      reason: input.reason,
    };
  }

  private insertScheduledLane(laneKey: number, phase: number): void {
    let current = this.scheduleHeads[phase] ?? -1;
    let previous = -1;

    while (current >= 0 && current < laneKey) {
      previous = current;
      current = this.scheduleNext[current] ?? -1;
    }

    this.schedulePrevious[laneKey] = previous;
    this.scheduleNext[laneKey] = current;

    if (previous >= 0) {
      this.scheduleNext[previous] = laneKey;
    } else {
      this.scheduleHeads[phase] = laneKey;
    }

    if (current >= 0) {
      this.schedulePrevious[current] = laneKey;
    }
  }
}

export class NeedUrgencyIndex {
  readonly actorCapacity: number;
  readonly urgencyBucketCount: number;

  private readonly linked: Uint8Array;
  private readonly buckets: Uint8Array;
  private readonly scores: Uint16Array;
  private readonly laneOwnerVersions: Uint32Array;
  private readonly bucketHeads: Int32Array;
  private readonly bucketCounts: Uint32Array;
  private readonly nextByLaneKey: Int32Array;
  private readonly previousByLaneKey: Int32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private indexedCount = 0;
  private refreshedCount = 0;
  private rebuiltCount = 0;
  private indexVersionValue = 0;
  private sourceVersionValue = 0;

  constructor(options: NeedUrgencyIndexOptions) {
    assertValidCapacity(options.actorCapacity, "need urgency actor capacity");
    const urgencyBucketCount = options.urgencyBucketCount ?? NEED_URGENCY_BUCKET_COUNT;
    if (urgencyBucketCount !== NEED_URGENCY_BUCKET_COUNT) {
      throw new Error("need urgency bucket count must match the M3 fixed bucket contract");
    }

    this.actorCapacity = options.actorCapacity;
    this.urgencyBucketCount = urgencyBucketCount;
    const laneCapacity = options.actorCapacity * NEED_LANE_COUNT;
    this.linked = new Uint8Array(laneCapacity);
    this.buckets = new Uint8Array(laneCapacity);
    this.scores = new Uint16Array(laneCapacity);
    this.laneOwnerVersions = new Uint32Array(laneCapacity);
    this.bucketHeads = createEmptyLinks(NEED_LANE_COUNT * urgencyBucketCount);
    this.bucketCounts = new Uint32Array(NEED_LANE_COUNT * urgencyBucketCount);
    this.nextByLaneKey = createEmptyLinks(laneCapacity);
    this.previousByLaneKey = createEmptyLinks(laneCapacity);
    this.dirtyQueued = new Uint8Array(laneCapacity);
    this.dirtyQueue = new Uint32Array(laneCapacity);
  }

  get indexVersion(): number {
    return this.indexVersionValue;
  }

  get sourceVersion(): number {
    return this.sourceVersionValue;
  }

  markDirty(actorId: number, lane: NeedLane): NeedMutationResult {
    if (!isIndexInRange(actorId, this.actorCapacity)) {
      return { ok: false, reason: "need_actor_out_of_range" };
    }

    if (!isNeedLane(lane)) {
      return { ok: false, reason: "need_lane_out_of_range" };
    }

    const key = createLaneKey(actorId, lane);
    if ((this.dirtyQueued[key] ?? 0) === 0) {
      const tail = (this.dirtyHead + this.dirtyCount) % this.dirtyQueue.length;
      this.dirtyQueue[tail] = key;
      this.dirtyQueued[key] = 1;
      this.dirtyCount += 1;

      if (this.dirtyCount > this.dirtyPeak) {
        this.dirtyPeak = this.dirtyCount;
      }
    }

    return {
      ok: true,
      actorId,
      lane,
      changed: false,
      value: 0,
      ownerVersion: this.sourceVersionValue,
      reason: "need.external_delta",
    };
  }

  markMutationDirty(mutation: NeedMutationResult): NeedMutationResult {
    if (!mutation.ok || !mutation.changed) {
      return mutation;
    }

    const dirty = this.markDirty(mutation.actorId, mutation.lane);
    if (!dirty.ok) {
      return dirty;
    }

    return mutation;
  }

  refreshDirty(store: NeedStore, budget: number): NeedScheduleResult {
    if (!isPositiveSafeInteger(budget)) {
      return { ok: false, reason: "need_delta_out_of_range" };
    }

    let refreshed = 0;

    while (this.dirtyCount > 0 && refreshed < budget) {
      const key = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.dirtyQueue.length;
      this.dirtyCount -= 1;
      this.dirtyQueued[key] = 0;
      this.refreshLaneKey(store, key);
      refreshed += 1;
    }

    if (refreshed > 0) {
      this.refreshedCount += refreshed;
      this.indexVersionValue += 1;
    }

    if (this.dirtyCount === 0) {
      this.sourceVersionValue = store.version;
    }

    return {
      ok: true,
      tick: 0,
      phase: 0,
      visitedCount: refreshed,
      changedCount: refreshed,
      budgetExhausted: this.dirtyCount > 0,
      version: this.indexVersionValue,
    };
  }

  rebuildFromStore(store: NeedStore): NeedUrgencyIndexMetrics {
    this.clearIndex();
    let rebuilt = 0;

    for (let actorId = 0; actorId < this.actorCapacity; actorId += 1) {
      if (store.isActorActive(actorId)) {
        for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
          if (isNeedLane(lane)) {
            this.linkLaneKey(store, createLaneKey(actorId, lane));
          }
          rebuilt += 1;
        }
      }
    }

    this.dirtyHead = 0;
    this.dirtyCount = 0;
    this.dirtyQueued.fill(0);
    this.rebuiltCount += rebuilt;
    this.indexVersionValue += 1;
    this.sourceVersionValue = store.version;
    return this.createMetrics();
  }

  queryUrgentActors(
    query: NeedUrgencyQuery,
    outputActorIds: Uint32Array,
    traceStore?: NeedUrgencyTraceStore,
  ): NeedUrgencyQueryResult {
    const validation = this.validateQuery(query, outputActorIds);
    if (!validation.ok) {
      return validation;
    }

    if (this.dirtyCount > 0) {
      return { ok: false, reason: "need_dirty_backlog" };
    }

    clearUint32(outputActorIds, query.maxSelectedActors, NEED_ACTOR_NONE);
    const totalCandidates = this.countCandidates(query.lane, query.minUrgencyBucket);
    let visited = 0;
    let selected = 0;

    for (let bucket = this.urgencyBucketCount - 1; bucket >= query.minUrgencyBucket; bucket -= 1) {
      let current = this.bucketHeads[createBucketKey(query.lane, bucket)] ?? -1;

      while (current >= 0 && visited < query.candidateCap) {
        if (selected < query.maxSelectedActors) {
          outputActorIds[selected] = Math.floor(current / NEED_LANE_COUNT);
          selected += 1;
        }

        visited += 1;
        current = this.nextByLaneKey[current] ?? -1;
      }

      if (visited >= query.candidateCap) {
        break;
      }
    }

    const candidateCapHit = totalCandidates > visited;
    const selectedCapHit = visited > selected;
    const reason = readUrgencyTraceReason(query.lane, totalCandidates, candidateCapHit);
    const traceSequence =
      traceStore?.recordNeedUrgencyQuery({
        lane: query.lane,
        minUrgencyBucket: query.minUrgencyBucket,
        bucketCandidateCount: totalCandidates,
        visitedCount: visited,
        selectedCount: selected,
        candidateCap: query.candidateCap,
        selectedCap: query.maxSelectedActors,
        candidateCapHit,
        selectedCapHit,
        selectedActorId: selected > 0 ? (outputActorIds[0] ?? NEED_ACTOR_NONE) : NEED_ACTOR_NONE,
        sourceVersion: this.sourceVersionValue,
        indexVersion: this.indexVersionValue,
        reason,
      }) ?? 0;

    return {
      ok: true,
      lane: query.lane,
      selectedCount: selected,
      bucketCandidateCount: totalCandidates,
      visitedCount: visited,
      candidateCapHit,
      selectedCapHit,
      sourceVersion: this.sourceVersionValue,
      indexVersion: this.indexVersionValue,
      traceSequence,
    };
  }

  createMetrics(): NeedUrgencyIndexMetrics {
    return {
      indexVersion: this.indexVersionValue,
      sourceVersion: this.sourceVersionValue,
      indexedCount: this.indexedCount,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
      refreshedCount: this.refreshedCount,
      rebuiltCount: this.rebuiltCount,
    };
  }

  private refreshLaneKey(store: NeedStore, key: number): void {
    if ((this.linked[key] ?? 0) === 1) {
      this.unlinkLaneKey(key);
    }

    this.linkLaneKey(store, key);
  }

  private linkLaneKey(store: NeedStore, key: number): void {
    const actorId = Math.floor(key / NEED_LANE_COUNT);
    const lane = key - actorId * NEED_LANE_COUNT;

    if (!store.isActorActive(actorId) || !isNeedLane(lane)) {
      return;
    }

    const value = store.readLaneValue(actorId, lane);
    const bucket = calculateNeedUrgencyBucket(value);
    const score = NEED_VALUE_MAX - value;
    const bucketKey = createBucketKey(lane, bucket);
    let current = this.bucketHeads[bucketKey] ?? -1;
    let previous = -1;

    while (current >= 0 && isUrgencyBefore(current, key, score, this.scores)) {
      previous = current;
      current = this.nextByLaneKey[current] ?? -1;
    }

    this.buckets[key] = bucket;
    this.scores[key] = score;
    this.laneOwnerVersions[key] = store.readLaneOwnerVersion(actorId, lane);
    this.previousByLaneKey[key] = previous;
    this.nextByLaneKey[key] = current;

    if (previous >= 0) {
      this.nextByLaneKey[previous] = key;
    } else {
      this.bucketHeads[bucketKey] = key;
    }

    if (current >= 0) {
      this.previousByLaneKey[current] = key;
    }

    this.linked[key] = 1;
    this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 0) + 1;
    this.indexedCount += 1;
  }

  private unlinkLaneKey(key: number): void {
    const actorId = Math.floor(key / NEED_LANE_COUNT);
    const lane = key - actorId * NEED_LANE_COUNT;
    if (!isNeedLane(lane)) {
      return;
    }

    const bucketKey = createBucketKey(lane, this.buckets[key] ?? 0);
    const previous = this.previousByLaneKey[key] ?? -1;
    const next = this.nextByLaneKey[key] ?? -1;

    if (previous >= 0) {
      this.nextByLaneKey[previous] = next;
    } else {
      this.bucketHeads[bucketKey] = next;
    }

    if (next >= 0) {
      this.previousByLaneKey[next] = previous;
    }

    this.linked[key] = 0;
    this.nextByLaneKey[key] = -1;
    this.previousByLaneKey[key] = -1;
    this.laneOwnerVersions[key] = 0;
    this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 1) - 1;
    this.indexedCount -= 1;
  }

  private clearIndex(): void {
    this.linked.fill(0);
    this.buckets.fill(0);
    this.scores.fill(0);
    this.laneOwnerVersions.fill(0);
    this.bucketHeads.fill(-1);
    this.bucketCounts.fill(0);
    this.nextByLaneKey.fill(-1);
    this.previousByLaneKey.fill(-1);
    this.indexedCount = 0;
  }

  private countCandidates(lane: NeedLane, minUrgencyBucket: number): number {
    let total = 0;

    for (let bucket = minUrgencyBucket; bucket < this.urgencyBucketCount; bucket += 1) {
      total += this.bucketCounts[createBucketKey(lane, bucket)] ?? 0;
    }

    return total;
  }

  private validateQuery(
    query: NeedUrgencyQuery,
    outputActorIds: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: NeedReason } {
    if (!isNeedLane(query.lane)) {
      return { ok: false, reason: "need_lane_out_of_range" };
    }

    if (!isIndexInRange(query.minUrgencyBucket, this.urgencyBucketCount)) {
      return { ok: false, reason: "need_phase_out_of_range" };
    }

    if (!isPositiveSafeInteger(query.candidateCap)) {
      return { ok: false, reason: "need_candidate_cap_invalid" };
    }

    if (!isPositiveSafeInteger(query.maxSelectedActors)) {
      return { ok: false, reason: "need_selected_cap_invalid" };
    }

    if (outputActorIds.length < query.maxSelectedActors) {
      return { ok: false, reason: "need_candidate_buffer_too_small" };
    }

    return { ok: true };
  }
}

export class NeedUrgencyTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly lanes: Uint8Array;
  private readonly minUrgencyBuckets: Uint8Array;
  private readonly bucketCandidateCounts: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly selectedCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedCaps: Uint32Array;
  private readonly candidateCapHits: Uint8Array;
  private readonly selectedCapHits: Uint8Array;
  private readonly selectedActorIds: Uint32Array;
  private readonly sourceVersions: Uint32Array;
  private readonly indexVersions: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity: number) {
    if (!isPositiveSafeInteger(capacity)) {
      throw new Error("need urgency trace capacity must be a positive safe integer");
    }

    this.capacity = capacity;
    this.sequences = new Uint32Array(capacity);
    this.lanes = new Uint8Array(capacity);
    this.minUrgencyBuckets = new Uint8Array(capacity);
    this.bucketCandidateCounts = new Uint32Array(capacity);
    this.visitedCounts = new Uint32Array(capacity);
    this.selectedCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedCaps = new Uint32Array(capacity);
    this.candidateCapHits = new Uint8Array(capacity);
    this.selectedCapHits = new Uint8Array(capacity);
    this.selectedActorIds = new Uint32Array(capacity);
    this.selectedActorIds.fill(NEED_ACTOR_NONE);
    this.sourceVersions = new Uint32Array(capacity);
    this.indexVersions = new Uint32Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
  }

  recordNeedUrgencyQuery(input: NeedUrgencyTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;

    this.sequences[slot] = sequence;
    this.lanes[slot] = input.lane;
    this.minUrgencyBuckets[slot] = input.minUrgencyBucket;
    this.bucketCandidateCounts[slot] = input.bucketCandidateCount;
    this.visitedCounts[slot] = input.visitedCount;
    this.selectedCounts[slot] = input.selectedCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedCaps[slot] = input.selectedCap;
    this.candidateCapHits[slot] = input.candidateCapHit ? 1 : 0;
    this.selectedCapHits[slot] = input.selectedCapHit ? 1 : 0;
    this.selectedActorIds[slot] = input.selectedActorId;
    this.sourceVersions[slot] = input.sourceVersion;
    this.indexVersions[slot] = input.indexVersion;
    this.reasonCodes[slot] = encodeUrgencyTraceReason(input.reason);
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): NeedUrgencyTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }

    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    const lane = this.lanes[slot] ?? 0;
    return {
      sequence: this.sequences[slot] ?? 0,
      lane: isNeedLane(lane) ? lane : NEED_LANE_HUNGER,
      minUrgencyBucket: this.minUrgencyBuckets[slot] ?? 0,
      bucketCandidateCount: this.bucketCandidateCounts[slot] ?? 0,
      visitedCount: this.visitedCounts[slot] ?? 0,
      selectedCount: this.selectedCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedCap: this.selectedCaps[slot] ?? 0,
      candidateCapHit: (this.candidateCapHits[slot] ?? 0) === 1,
      selectedCapHit: (this.selectedCapHits[slot] ?? 0) === 1,
      selectedActorId: this.selectedActorIds[slot] ?? NEED_ACTOR_NONE,
      sourceVersion: this.sourceVersions[slot] ?? 0,
      indexVersion: this.indexVersions[slot] ?? 0,
      reason: decodeUrgencyTraceReason(this.reasonCodes[slot] ?? 0),
    };
  }

  createMetrics(): NeedUrgencyTraceMetrics {
    return {
      capacity: this.capacity,
      storedCount: this.stored,
      nextSequence: this.nextSequence,
      backlogCount: 0,
    };
  }
}

export function createNeedStore(options: NeedStoreOptions): NeedStore {
  return new NeedStore(options);
}

export function createNeedUrgencyIndex(options: NeedUrgencyIndexOptions): NeedUrgencyIndex {
  return new NeedUrgencyIndex(options);
}

export function createNeedUrgencyTraceStore(capacity: number): NeedUrgencyTraceStore {
  return new NeedUrgencyTraceStore(capacity);
}

export function calculateNeedUrgencyBucket(value: number): number {
  if (value < 180) {
    return 4;
  }

  if (value < 300) {
    return 3;
  }

  if (value < 500) {
    return 2;
  }

  if (value < 700) {
    return 1;
  }

  return 0;
}

function createLaneKey(actorId: number, lane: NeedLane): number {
  return actorId * NEED_LANE_COUNT + lane;
}

function createBucketKey(lane: NeedLane, bucket: number): number {
  return lane * NEED_URGENCY_BUCKET_COUNT + bucket;
}

function createUpdatePhase(
  actorId: number,
  lane: NeedLane,
  phaseSeed: number,
  phaseSalt: number,
  intervalTicks: number,
): number {
  return (phaseSeed * phaseSalt + actorId * NEED_LANE_COUNT + lane) % intervalTicks;
}

function clampNeedValue(value: number): number {
  if (value < NEED_VALUE_MIN) {
    return NEED_VALUE_MIN;
  }

  if (value > NEED_VALUE_MAX) {
    return NEED_VALUE_MAX;
  }

  return value;
}

function isUrgencyBefore(
  currentKey: number,
  nextKey: number,
  nextScore: number,
  scores: Uint16Array,
): boolean {
  const currentScore = scores[currentKey] ?? 0;

  if (currentScore !== nextScore) {
    return currentScore > nextScore;
  }

  return currentKey < nextKey;
}

function clearUint32(values: Uint32Array, count: number, fill: number): void {
  for (let index = 0; index < count; index += 1) {
    values[index] = fill;
  }
}

function readUrgencyTraceReason(
  lane: NeedLane,
  totalCandidates: number,
  candidateCapHit: boolean,
): NeedUrgencyTraceReason {
  if (candidateCapHit) {
    return "trace.candidate_cap_reached";
  }

  if (totalCandidates === 0) {
    return "need.urgency_no_candidate";
  }

  if (lane === NEED_LANE_HUNGER) {
    return "need.hunger_urgency_indexed";
  }

  if (lane === NEED_LANE_REST) {
    return "need.rest_urgency_indexed";
  }

  return "need.urgency_indexed";
}

function encodeNeedChangeReason(reason: NeedChangeReason): number {
  if (reason === "need.scheduled_decay") {
    return 1;
  }

  if (reason === "need.external_delta") {
    return 2;
  }

  if (reason === "need.manual_set") {
    return 3;
  }

  if (reason === "need.clamped_min") {
    return 4;
  }

  if (reason === "need.clamped_max") {
    return 5;
  }

  return 0;
}

function decodeNeedChangeReason(code: number): NeedChangeReason {
  if (code === 1) {
    return "need.scheduled_decay";
  }

  if (code === 2) {
    return "need.external_delta";
  }

  if (code === 3) {
    return "need.manual_set";
  }

  if (code === 4) {
    return "need.clamped_min";
  }

  if (code === 5) {
    return "need.clamped_max";
  }

  return "need.initialized";
}

function encodeUrgencyTraceReason(reason: NeedUrgencyTraceReason): number {
  if (reason === "need.hunger_urgency_indexed") {
    return 1;
  }

  if (reason === "need.rest_urgency_indexed") {
    return 2;
  }

  if (reason === "trace.candidate_cap_reached") {
    return 3;
  }

  if (reason === "need.urgency_no_candidate") {
    return 4;
  }

  return 0;
}

function decodeUrgencyTraceReason(code: number): NeedUrgencyTraceReason {
  if (code === 1) {
    return "need.hunger_urgency_indexed";
  }

  if (code === 2) {
    return "need.rest_urgency_indexed";
  }

  if (code === 3) {
    return "trace.candidate_cap_reached";
  }

  if (code === 4) {
    return "need.urgency_no_candidate";
  }

  return "need.urgency_indexed";
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

function isNeedLane(value: number): value is NeedLane {
  return value >= 0 && value < NEED_LANE_COUNT && Number.isSafeInteger(value);
}

function isNeedValue(value: number): boolean {
  return Number.isSafeInteger(value) && value >= NEED_VALUE_MIN && value <= NEED_VALUE_MAX;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isSafeTickNumber(value: number): value is Tick {
  try {
    requireSafeTick(value, "need tick");
    return true;
  } catch {
    return false;
  }
}

function isInt32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= -0x8000_0000 && value <= 0x7fff_ffff;
}
