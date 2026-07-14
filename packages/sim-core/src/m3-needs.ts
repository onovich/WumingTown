import { assertValidCapacity } from "./entity-id";
import { isSafeTick, type Tick } from "./time";
import type { CanonicalWorldField } from "./world-hash";

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
  | "need_basis_mismatch"
  | "need_source_invalid"
  | "need_version_exhausted"
  | "need_tick_invalid"
  | "need_phase_out_of_range"
  | "need_interval_invalid"
  | "need_candidate_cap_invalid"
  | "need_selected_cap_invalid"
  | "need_candidate_buffer_too_small"
  | "need_dirty_backlog"
  | "need_trace_capacity_invalid"
  | "need_snapshot_invalid"
  | "need_snapshot_version_unsupported";

const NEED_CHANGED_COMMIT = Symbol("need-changed-commit");
const NEED_NOOP_COMMIT = Symbol("need-noop-commit");
const NEED_URGENCY_MARK_DIRTY = Symbol("need-urgency-mark-dirty");

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

export interface NeedLaneMutationPrepareInput extends NeedChangeInput {
  readonly expectedStoreVersion: number;
  readonly expectedLaneVersion: number;
  readonly expectedValue: number;
  readonly delta: number;
}

export interface PreparedNeedLaneMutation {
  ok: boolean;
  reason: NeedReason | undefined;
  actorId: number;
  lane: NeedLane;
  tick: Tick;
  previousValue: number;
  nextValue: number;
  sourceSystemId: number;
  sourceEventId: number;
  reasonCode: number;
  changed: boolean;
  previousSourceTick: Tick;
  previousSourceSystemId: number;
  previousSourceEventId: number;
  previousReasonCode: number;
  previousStoreVersion: number;
  previousLaneVersion: number;
  nextStoreVersion: number;
  nextLaneVersion: number;
}

export interface NeedLaneIntoOutput {
  ok: boolean;
  reason: NeedReason | undefined;
  active: boolean;
  actorId: number;
  lane: NeedLane;
  value: number;
  updatePhase: number;
  laneVersion: number;
  storeVersion: number;
  sourceTick: Tick;
  sourceSystemId: number;
  sourceEventId: number;
  previousValue: number;
  delta: number;
  changeReason: NeedChangeReason | undefined;
}

export interface NeedStoreSnapshot {
  readonly snapshotVersion: typeof M3_NEED_STORE_SNAPSHOT_VERSION;
  readonly actorCapacity: number;
  readonly updateIntervalTicks: number;
  readonly phaseSalt: number;
  readonly actorCount: number;
  readonly storeVersion: number;
  readonly scheduledUpdateCount: number;
  readonly scheduledChangeCount: number;
  readonly lastScheduledVisitedCount: number;
  readonly active: readonly number[];
  readonly values: readonly number[];
  readonly updatePhases: readonly number[];
  readonly laneVersions: readonly number[];
  readonly sourceTicks: readonly number[];
  readonly sourceSystemIds: readonly number[];
  readonly sourceEventIds: readonly number[];
  readonly previousValues: readonly number[];
  readonly deltas: readonly number[];
  readonly reasonCodes: readonly number[];
  readonly scheduleHeads: readonly number[];
  readonly scheduleCursors: readonly number[];
  readonly scheduleNext: readonly number[];
  readonly schedulePrevious: readonly number[];
}

export type NeedStoreRestoreResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "need_snapshot_invalid" | "need_snapshot_version_unsupported";
    };

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
  private readonly scheduledChangedKeys: Uint32Array;
  private readonly scheduledNextValues: Uint16Array;
  private readonly scheduledReasonCodes: Uint8Array;
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
    if (!isSafeUint32Number(this.phaseSalt)) {
      throw new Error("need phase salt must be uint32");
    }
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
    this.scheduledChangedKeys = new Uint32Array(laneCapacity);
    this.scheduledNextValues = new Uint16Array(laneCapacity);
    this.scheduledReasonCodes = new Uint8Array(laneCapacity);
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
    if (this.storeVersion === 0xffff_ffff || this.actorCountValue === 0xffff_ffff) {
      return { ok: false, reason: "need_version_exhausted" };
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

  prepareLaneDeltaInto(
    input: NeedLaneMutationPrepareInput,
    output: PreparedNeedLaneMutation,
  ): void {
    resetPreparedNeedMutation(output);
    if (!isIndexInRange(input.actorId, this.actorCapacity)) {
      output.reason = "need_actor_out_of_range";
      return;
    }
    if ((this.active[input.actorId] ?? 0) !== 1) {
      output.reason = "need_actor_not_registered";
      return;
    }
    if (!isNeedLane(input.lane)) {
      output.reason = "need_lane_out_of_range";
      return;
    }
    if (!isSafeTick(input.tick)) {
      output.reason = "need_tick_invalid";
      return;
    }
    const key = createLaneKey(input.actorId, input.lane);
    const current = this.values[key] ?? 0;
    if (input.tick < (this.sourceTicks[key] ?? 0)) {
      output.reason = "need_tick_invalid";
      return;
    }
    const sourceSystemId = input.sourceSystemId ?? 0;
    const sourceEventId = input.sourceEventId ?? 0;
    if (!isSafeUint32Number(sourceSystemId) || !isSafeUint32Number(sourceEventId)) {
      output.reason = "need_source_invalid";
      return;
    }
    if (!isCallerNeedChangeReason(input.reason)) {
      output.reason = "need_source_invalid";
      return;
    }
    if (
      !isSafeUint32Number(input.expectedStoreVersion) ||
      !isSafeUint32Number(input.expectedLaneVersion) ||
      !isNeedValue(input.expectedValue)
    ) {
      output.reason = "need_basis_mismatch";
      return;
    }
    if (
      input.expectedStoreVersion !== this.storeVersion ||
      input.expectedLaneVersion !== (this.laneVersions[key] ?? 0) ||
      input.expectedValue !== current
    ) {
      output.reason = "need_basis_mismatch";
      return;
    }
    if (!isInt32(input.delta)) {
      output.reason = "need_delta_out_of_range";
      return;
    }
    const unclamped = current + input.delta;
    const next = clampNeedValue(unclamped);
    const changed = next !== current;
    if (
      changed &&
      (this.storeVersion === 0xffff_ffff || (this.laneVersions[key] ?? 0) === 0xffff_ffff)
    ) {
      output.reason = "need_version_exhausted";
      return;
    }
    let reason = input.reason;
    if (unclamped < NEED_VALUE_MIN) reason = "need.clamped_min";
    else if (unclamped > NEED_VALUE_MAX) reason = "need.clamped_max";
    output.ok = true;
    output.actorId = input.actorId;
    output.lane = input.lane;
    output.tick = input.tick;
    output.previousValue = current;
    output.nextValue = next;
    output.sourceSystemId = sourceSystemId;
    output.sourceEventId = sourceEventId;
    output.reasonCode = encodeNeedChangeReason(reason);
    output.changed = changed;
    output.previousSourceTick = this.sourceTicks[key] ?? 0;
    output.previousSourceSystemId = this.sourceSystemIds[key] ?? 0;
    output.previousSourceEventId = this.sourceEventIds[key] ?? 0;
    output.previousReasonCode = this.reasonCodes[key] ?? 0;
    output.previousStoreVersion = this.storeVersion;
    output.previousLaneVersion = this.laneVersions[key] ?? 0;
    output.nextStoreVersion = this.storeVersion + (changed ? 1 : 0);
    output.nextLaneVersion = (this.laneVersions[key] ?? 0) + (changed ? 1 : 0);
  }

  [NEED_CHANGED_COMMIT](prepared: PreparedNeedLaneMutation): void {
    const key = createLaneKey(prepared.actorId, prepared.lane);
    this.values[key] = prepared.nextValue;
    this.sourceTicks[key] = prepared.tick;
    this.sourceSystemIds[key] = prepared.sourceSystemId;
    this.sourceEventIds[key] = prepared.sourceEventId;
    this.previousValues[key] = prepared.previousValue;
    this.deltas[key] = prepared.nextValue - prepared.previousValue;
    this.reasonCodes[key] = prepared.reasonCode;
    this.storeVersion = prepared.nextStoreVersion;
    this.laneVersions[key] = prepared.nextLaneVersion;
  }

  [NEED_NOOP_COMMIT](prepared: PreparedNeedLaneMutation): void {
    void prepared;
    // A clamped/no-delta mutation is an authoritative zero-write commit.
  }

  readLaneInto(actorId: number, lane: NeedLane, output: NeedLaneIntoOutput): void {
    resetNeedLaneInto(output, this.storeVersion);
    if (!isIndexInRange(actorId, this.actorCapacity)) {
      output.reason = "need_actor_out_of_range";
      return;
    }
    output.actorId = actorId;
    if (!isNeedLane(lane)) {
      output.reason = "need_lane_out_of_range";
      return;
    }
    output.lane = lane;
    if ((this.active[actorId] ?? 0) !== 1) {
      output.reason = "need_actor_not_registered";
      return;
    }
    const key = createLaneKey(actorId, lane);
    output.ok = true;
    output.active = true;
    output.value = this.values[key] ?? 0;
    output.updatePhase = this.updatePhases[key] ?? 0;
    output.laneVersion = this.laneVersions[key] ?? 0;
    output.sourceTick = this.sourceTicks[key] ?? 0;
    output.sourceSystemId = this.sourceSystemIds[key] ?? 0;
    output.sourceEventId = this.sourceEventIds[key] ?? 0;
    output.previousValue = this.previousValues[key] ?? 0;
    output.delta = this.deltas[key] ?? 0;
    output.changeReason = decodeNeedChangeReason(this.reasonCodes[key] ?? 0);
  }

  processScheduledUpdates(
    tick: Tick,
    laneDeltas: Int32Array,
    budget: number,
    dirtySink?: NeedUrgencyIndex,
  ): NeedScheduleResult {
    if (!isSafeTickNumber(tick)) {
      return { ok: false, reason: "need_tick_invalid" };
    }

    if (laneDeltas.length < NEED_LANE_COUNT || !isPositiveSafeInteger(budget)) {
      return { ok: false, reason: "need_delta_out_of_range" };
    }
    for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
      if (!isInt32(laneDeltas[lane] ?? Number.NaN)) {
        return { ok: false, reason: "need_delta_out_of_range" };
      }
    }

    const phase = tick % this.updateIntervalTicks;
    const head = this.scheduleHeads[phase] ?? -1;
    let current = this.scheduleCursors[phase] ?? -1;
    let visited = 0;
    let changed = 0;

    if (current === -1) {
      current = head;
    }
    if (!this.isExactScheduledCursorBasis(phase, head, current)) {
      return { ok: false, reason: "need_phase_out_of_range" };
    }

    for (; current >= 0 && visited < budget; ) {
      const actorId = Math.floor(current / NEED_LANE_COUNT);
      const laneValue = current - actorId * NEED_LANE_COUNT;
      const next = this.scheduleNext[current] ?? -1;
      const delta = laneDeltas[laneValue] ?? 0;

      if (delta !== 0) {
        if (tick < (this.sourceTicks[current] ?? 0)) {
          return { ok: false, reason: "need_tick_invalid" };
        }
        const previous = this.values[current] ?? 0;
        const unclamped = previous + delta;
        const nextValue = clampNeedValue(unclamped);
        if (nextValue !== previous) {
          this.scheduledChangedKeys[changed] = current;
          this.scheduledNextValues[changed] = nextValue;
          this.scheduledReasonCodes[changed] = encodeNeedChangeReason(
            unclamped < NEED_VALUE_MIN
              ? "need.clamped_min"
              : unclamped > NEED_VALUE_MAX
                ? "need.clamped_max"
                : "need.scheduled_decay",
          );
          changed += 1;
        }
      }

      visited += 1;
      current = next;
      if (current >= 0 && !this.isExactScheduledCursorBasis(phase, head, current)) {
        return { ok: false, reason: "need_phase_out_of_range" };
      }
    }

    for (let index = 0; index < changed; index += 1) {
      const key = this.scheduledChangedKeys[index] ?? 0;
      if (tick < (this.sourceTicks[key] ?? 0)) {
        return { ok: false, reason: "need_tick_invalid" };
      }
      if ((this.laneVersions[key] ?? 0) === 0xffff_ffff) {
        return { ok: false, reason: "need_version_exhausted" };
      }
    }

    if (
      this.storeVersion > 0xffff_ffff - changed ||
      this.scheduledUpdateCount > 0xffff_ffff - visited ||
      this.scheduledChangeCount > 0xffff_ffff - changed
    ) {
      return { ok: false, reason: "need_version_exhausted" };
    }

    for (let index = 0; index < changed; index += 1) {
      const key = this.scheduledChangedKeys[index] ?? 0;
      const previous = this.values[key] ?? 0;
      const nextValue = this.scheduledNextValues[index] ?? previous;
      this.values[key] = nextValue;
      this.sourceTicks[key] = tick;
      this.sourceSystemIds[key] = 0;
      this.sourceEventIds[key] = 0;
      this.previousValues[key] = previous;
      this.deltas[key] = nextValue - previous;
      this.reasonCodes[key] = this.scheduledReasonCodes[index] ?? 0;
      this.storeVersion += 1;
      this.laneVersions[key] = (this.laneVersions[key] ?? 0) + 1;
    }

    this.scheduleCursors[phase] = current >= 0 ? current : head;
    this.scheduledUpdateCount += visited;
    this.scheduledChangeCount += changed;
    this.lastScheduledVisitedCount = visited;
    if (dirtySink !== undefined) this.publishScheduledDirty(dirtySink, changed);
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

  private isExactScheduledCursorBasis(phase: number, head: number, current: number): boolean {
    const length = this.scheduleNext.length;
    if (!isScheduleKeyOrNone(head, length) || !isScheduleKeyOrNone(current, length)) return false;
    if (head === -1) return current === -1;
    const headActorId = Math.floor(head / NEED_LANE_COUNT);
    if (
      (this.active[headActorId] ?? 0) !== 1 ||
      (this.updatePhases[head] ?? -1) !== phase ||
      (this.schedulePrevious[head] ?? -2) !== -1 ||
      current === -1
    )
      return false;

    const actorId = Math.floor(current / NEED_LANE_COUNT);
    const laneValue = current - actorId * NEED_LANE_COUNT;
    const previous = this.schedulePrevious[current] ?? -2;
    const next = this.scheduleNext[current] ?? -2;
    if (
      !isNeedLane(laneValue) ||
      (this.active[actorId] ?? 0) !== 1 ||
      (this.updatePhases[current] ?? -1) !== phase ||
      !isScheduleKeyOrNone(previous, length) ||
      !isScheduleKeyOrNone(next, length) ||
      (current === head) !== (previous === -1)
    )
      return false;
    if (previous >= 0) {
      const previousActorId = Math.floor(previous / NEED_LANE_COUNT);
      if (
        previous >= current ||
        (this.active[previousActorId] ?? 0) !== 1 ||
        (this.updatePhases[previous] ?? -1) !== phase ||
        (this.scheduleNext[previous] ?? -1) !== current
      )
        return false;
    }
    if (next >= 0) {
      const nextActorId = Math.floor(next / NEED_LANE_COUNT);
      if (
        next <= current ||
        (this.active[nextActorId] ?? 0) !== 1 ||
        (this.updatePhases[next] ?? -1) !== phase ||
        (this.schedulePrevious[next] ?? -1) !== current
      )
        return false;
    }
    return true;
  }

  private publishScheduledDirty(dirtySink: NeedUrgencyIndex, changed: number): void {
    for (let index = 0; index < changed; index += 1) {
      const key = this.scheduledChangedKeys[index] ?? 0;
      const actorId = Math.floor(key / NEED_LANE_COUNT);
      const laneValue = key - actorId * NEED_LANE_COUNT;
      if (isNeedLane(laneValue)) dirtySink[NEED_URGENCY_MARK_DIRTY](actorId, laneValue);
    }
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

  createSnapshot(): NeedStoreSnapshot {
    return {
      snapshotVersion: M3_NEED_STORE_SNAPSHOT_VERSION,
      actorCapacity: this.actorCapacity,
      updateIntervalTicks: this.updateIntervalTicks,
      phaseSalt: this.phaseSalt,
      actorCount: this.actorCountValue,
      storeVersion: this.storeVersion,
      scheduledUpdateCount: this.scheduledUpdateCount,
      scheduledChangeCount: this.scheduledChangeCount,
      lastScheduledVisitedCount: this.lastScheduledVisitedCount,
      active: Array.from(this.active),
      values: Array.from(this.values),
      updatePhases: Array.from(this.updatePhases),
      laneVersions: Array.from(this.laneVersions),
      sourceTicks: Array.from(this.sourceTicks),
      sourceSystemIds: Array.from(this.sourceSystemIds),
      sourceEventIds: Array.from(this.sourceEventIds),
      previousValues: Array.from(this.previousValues),
      deltas: Array.from(this.deltas),
      reasonCodes: Array.from(this.reasonCodes),
      scheduleHeads: Array.from(this.scheduleHeads),
      scheduleCursors: Array.from(this.scheduleCursors),
      scheduleNext: Array.from(this.scheduleNext),
      schedulePrevious: Array.from(this.schedulePrevious),
    };
  }

  restoreFromSnapshot(snapshot: unknown): NeedStoreRestoreResult {
    const validation = validateNeedStoreSnapshot(
      snapshot,
      this.actorCapacity,
      this.updateIntervalTicks,
      this.phaseSalt,
    );
    if (typeof validation === "string") return { ok: false, reason: validation };
    const value = validation;
    this.active.set(value.active);
    this.values.set(value.values);
    this.updatePhases.set(value.updatePhases);
    this.laneVersions.set(value.laneVersions);
    this.sourceTicks.set(value.sourceTicks);
    this.sourceSystemIds.set(value.sourceSystemIds);
    this.sourceEventIds.set(value.sourceEventIds);
    this.previousValues.set(value.previousValues);
    this.deltas.set(value.deltas);
    this.reasonCodes.set(value.reasonCodes);
    this.scheduleHeads.set(value.scheduleHeads);
    this.scheduleCursors.set(value.scheduleCursors);
    this.scheduleNext.set(value.scheduleNext);
    this.schedulePrevious.set(value.schedulePrevious);
    this.actorCountValue = value.actorCount;
    this.storeVersion = value.storeVersion;
    this.scheduledUpdateCount = value.scheduledUpdateCount;
    this.scheduledChangeCount = value.scheduledChangeCount;
    this.lastScheduledVisitedCount = value.lastScheduledVisitedCount;
    return { ok: true };
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

    if (!changed) {
      return {
        ok: true,
        actorId: input.actorId,
        lane: input.lane,
        changed: false,
        value: current,
        ownerVersion: this.storeVersion,
        reason,
      };
    }
    if (this.storeVersion === 0xffff_ffff || (this.laneVersions[key] ?? 0) === 0xffff_ffff) {
      return { ok: false, reason: "need_version_exhausted" };
    }

    this.values[key] = nextValue;
    this.sourceTicks[key] = input.tick;
    this.sourceSystemIds[key] = input.sourceSystemId ?? 0;
    this.sourceEventIds[key] = input.sourceEventId ?? 0;
    this.previousValues[key] = current;
    this.deltas[key] = nextValue - current;
    this.reasonCodes[key] = encodeNeedChangeReason(reason);
    this.storeVersion += 1;
    this.laneVersions[key] = (this.laneVersions[key] ?? 0) + 1;
    return {
      ok: true,
      actorId: input.actorId,
      lane: input.lane,
      changed: true,
      value: nextValue,
      ownerVersion: this.storeVersion,
      reason,
    };
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

    const phaseSeed = input.phaseSeed ?? input.actorId;
    if (
      !isNonNegativeSafeInteger(phaseSeed) ||
      !isSafeUpdatePhaseExpression(input.actorId, NEED_LANE_COUNT - 1, phaseSeed, this.phaseSalt)
    ) {
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
    if (!isIndexInRange(input.actorId, this.actorCapacity)) {
      return { ok: false, reason: "need_actor_out_of_range" };
    }
    if ((this.active[input.actorId] ?? 0) !== 1) {
      return { ok: false, reason: "need_actor_not_registered" };
    }

    if (!isNeedLane(input.lane)) {
      return { ok: false, reason: "need_lane_out_of_range" };
    }

    if (!isSafeTickNumber(input.tick)) {
      return { ok: false, reason: "need_tick_invalid" };
    }
    const key = createLaneKey(input.actorId, input.lane);
    if (input.tick < (this.sourceTicks[key] ?? 0)) {
      return { ok: false, reason: "need_tick_invalid" };
    }
    if (
      !isCallerNeedChangeReason(input.reason) ||
      !isSafeUint32Number(input.sourceSystemId ?? 0) ||
      !isSafeUint32Number(input.sourceEventId ?? 0)
    ) {
      return { ok: false, reason: "need_source_invalid" };
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
    const reason = this[NEED_URGENCY_MARK_DIRTY](actorId, lane);
    if (reason !== undefined) return { ok: false, reason };

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

  [NEED_URGENCY_MARK_DIRTY](actorId: number, lane: number): NeedReason | undefined {
    if (!isIndexInRange(actorId, this.actorCapacity)) {
      return "need_actor_out_of_range";
    }

    if (!isNeedLane(lane)) {
      return "need_lane_out_of_range";
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

    return undefined;
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

export function restoreNeedStore(snapshot: NeedStoreSnapshot): NeedStore {
  const store = createNeedStore({
    actorCapacity: snapshot.actorCapacity,
    updateIntervalTicks: snapshot.updateIntervalTicks,
    phaseSalt: snapshot.phaseSalt,
  });
  const result = store.restoreFromSnapshot(snapshot);
  if (!result.ok) throw new Error(result.reason);
  return store;
}

export function commitPreparedChangedNeedLaneMutation(
  store: NeedStore,
  prepared: PreparedNeedLaneMutation,
): void {
  store[NEED_CHANGED_COMMIT](prepared);
}

export function commitPreparedNoopNeedLaneMutation(
  store: NeedStore,
  prepared: PreparedNeedLaneMutation,
): void {
  store[NEED_NOOP_COMMIT](prepared);
}

export function createNeedStoreHashFields(
  snapshot: NeedStoreSnapshot,
  prefix = "needs",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.actorCapacity`, value: snapshot.actorCapacity },
    { name: `${prefix}.updateIntervalTicks`, value: snapshot.updateIntervalTicks },
    { name: `${prefix}.phaseSalt`, value: snapshot.phaseSalt },
    { name: `${prefix}.actorCount`, value: snapshot.actorCount },
    { name: `${prefix}.storeVersion`, value: snapshot.storeVersion },
    { name: `${prefix}.scheduledUpdateCount`, value: snapshot.scheduledUpdateCount },
    { name: `${prefix}.scheduledChangeCount`, value: snapshot.scheduledChangeCount },
    { name: `${prefix}.lastScheduledVisitedCount`, value: snapshot.lastScheduledVisitedCount },
  ];
  for (let phase = 0; phase < snapshot.updateIntervalTicks; phase += 1) {
    const phasePrefix = `${prefix}.phase.${String(phase)}`;
    fields.push({ name: `${phasePrefix}.head`, value: snapshot.scheduleHeads[phase] ?? -1 });
    fields.push({ name: `${phasePrefix}.cursor`, value: snapshot.scheduleCursors[phase] ?? -1 });
  }
  for (let actorId = 0; actorId < snapshot.actorCapacity; actorId += 1) {
    const actorPrefix = `${prefix}.actor.${String(actorId)}`;
    fields.push({ name: `${actorPrefix}.active`, value: snapshot.active[actorId] ?? 0 });
    for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
      appendNeedLaneHashFields(fields, snapshot, actorId, lane, actorPrefix);
    }
  }
  return fields;
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

function isSafeUpdatePhaseExpression(
  actorId: number,
  lane: number,
  phaseSeed: number,
  phaseSalt: number,
): boolean {
  const actorOffset = actorId * NEED_LANE_COUNT + lane;
  if (!Number.isSafeInteger(actorOffset) || actorOffset < 0) return false;
  if (phaseSalt === 0) return true;
  return phaseSeed <= Math.floor((Number.MAX_SAFE_INTEGER - actorOffset) / phaseSalt);
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isScheduleKeyOrNone(value: number, capacity: number): boolean {
  return value === -1 || (Number.isSafeInteger(value) && value >= 0 && value < capacity);
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

function resetPreparedNeedMutation(output: PreparedNeedLaneMutation): void {
  output.ok = false;
  output.reason = undefined;
  output.actorId = NEED_ACTOR_NONE;
  output.lane = NEED_LANE_HUNGER;
  output.tick = 0;
  output.previousValue = 0;
  output.nextValue = 0;
  output.sourceSystemId = 0;
  output.sourceEventId = 0;
  output.reasonCode = 0;
  output.changed = false;
  output.previousSourceTick = 0;
  output.previousSourceSystemId = 0;
  output.previousSourceEventId = 0;
  output.previousReasonCode = 0;
  output.previousStoreVersion = 0;
  output.previousLaneVersion = 0;
  output.nextStoreVersion = 0;
  output.nextLaneVersion = 0;
}

function isSafeTickNumber(value: number): value is Tick {
  return isSafeTick(value);
}

function isSafeUint32Number(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff
  );
}

function isInt32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= -0x8000_0000 && value <= 0x7fff_ffff;
}

function isCallerNeedChangeReason(value: unknown): value is NeedChangeReason {
  return value === "need.external_delta" || value === "need.manual_set";
}

function resetNeedLaneInto(output: NeedLaneIntoOutput, storeVersion: number): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.actorId = 0;
  output.lane = NEED_LANE_HUNGER;
  output.value = 0;
  output.updatePhase = 0;
  output.laneVersion = 0;
  output.storeVersion = storeVersion;
  output.sourceTick = 0;
  output.sourceSystemId = 0;
  output.sourceEventId = 0;
  output.previousValue = 0;
  output.delta = 0;
  output.changeReason = undefined;
}

const NEED_SNAPSHOT_KEYS = [
  "snapshotVersion",
  "actorCapacity",
  "updateIntervalTicks",
  "phaseSalt",
  "actorCount",
  "storeVersion",
  "scheduledUpdateCount",
  "scheduledChangeCount",
  "lastScheduledVisitedCount",
  "active",
  "values",
  "updatePhases",
  "laneVersions",
  "sourceTicks",
  "sourceSystemIds",
  "sourceEventIds",
  "previousValues",
  "deltas",
  "reasonCodes",
  "scheduleHeads",
  "scheduleCursors",
  "scheduleNext",
  "schedulePrevious",
] as const;

function validateNeedStoreSnapshot(
  snapshot: unknown,
  actorCapacity: number,
  updateIntervalTicks: number,
  phaseSalt: number,
): NeedStoreSnapshot | "need_snapshot_invalid" | "need_snapshot_version_unsupported" {
  if (!isPlainNeedRecord(snapshot)) return "need_snapshot_invalid";
  if (snapshot["snapshotVersion"] !== M3_NEED_STORE_SNAPSHOT_VERSION) {
    return "need_snapshot_version_unsupported";
  }
  if (!hasExactNeedKeys(snapshot, NEED_SNAPSHOT_KEYS)) return "need_snapshot_invalid";
  if (!hasNeedSnapshotValueTypes(snapshot, actorCapacity, updateIntervalTicks)) {
    return "need_snapshot_invalid";
  }
  if (
    snapshot.actorCapacity !== actorCapacity ||
    snapshot.updateIntervalTicks !== updateIntervalTicks ||
    snapshot.phaseSalt !== phaseSalt
  )
    return "need_snapshot_invalid";
  const value = snapshot;
  let activeCount = 0;
  for (let actorId = 0; actorId < actorCapacity; actorId += 1) {
    const active = value.active[actorId];
    if (active !== 0 && active !== 1) return "need_snapshot_invalid";
    if (active === 1) activeCount += 1;
    for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
      const key = actorId * NEED_LANE_COUNT + lane;
      if (!validateNeedLaneSnapshot(value, key, active === 1, updateIntervalTicks)) {
        return "need_snapshot_invalid";
      }
    }
    if (
      active === 1 &&
      !hasCanonicalNeedUpdatePhases(value.updatePhases, actorId, updateIntervalTicks, phaseSalt)
    )
      return "need_snapshot_invalid";
  }
  if (
    activeCount !== value.actorCount ||
    value.actorCount > value.storeVersion ||
    value.scheduledChangeCount > value.scheduledUpdateCount ||
    value.scheduledChangeCount > value.storeVersion - value.actorCount ||
    value.lastScheduledVisitedCount > value.scheduledUpdateCount
  )
    return "need_snapshot_invalid";
  if (
    activeCount === 0 &&
    (value.storeVersion !== 0 ||
      value.scheduledUpdateCount !== 0 ||
      value.scheduledChangeCount !== 0 ||
      value.lastScheduledVisitedCount !== 0)
  ) {
    return "need_snapshot_invalid";
  }
  if (value.scheduledUpdateCount === 0) {
    for (let phase = 0; phase < value.updateIntervalTicks; phase += 1) {
      if (value.scheduleCursors[phase] !== -1) return "need_snapshot_invalid";
    }
  }
  const maxPhaseChainLength = validateNeedScheduleSnapshot(value);
  if (maxPhaseChainLength < 0 || value.lastScheduledVisitedCount > maxPhaseChainLength) {
    return "need_snapshot_invalid";
  }
  return validateNeedVersionTopology(value) ? value : "need_snapshot_invalid";
}

function hasNeedSnapshotValueTypes(
  snapshot: Record<string, unknown>,
  actorCapacity: number,
  updateIntervalTicks: number,
): snapshot is Record<string, unknown> & NeedStoreSnapshot {
  const laneCapacity = actorCapacity * NEED_LANE_COUNT;
  if (
    !isSafeUint32Number(snapshot["actorCount"]) ||
    !isSafeUint32Number(snapshot["storeVersion"]) ||
    !isSafeUint32Number(snapshot["scheduledUpdateCount"]) ||
    !isSafeUint32Number(snapshot["scheduledChangeCount"]) ||
    !isSafeUint32Number(snapshot["lastScheduledVisitedCount"]) ||
    !isDenseNeedArray(snapshot["active"], actorCapacity) ||
    !isDenseNeedArray(snapshot["scheduleHeads"], updateIntervalTicks) ||
    !isDenseNeedArray(snapshot["scheduleCursors"], updateIntervalTicks)
  ) {
    return false;
  }
  for (const name of NEED_LANE_SNAPSHOT_KEYS) {
    if (!isDenseNeedArray(snapshot[name], laneCapacity)) return false;
  }
  return true;
}

const NEED_LANE_SNAPSHOT_KEYS = [
  "values",
  "updatePhases",
  "laneVersions",
  "sourceTicks",
  "sourceSystemIds",
  "sourceEventIds",
  "previousValues",
  "deltas",
  "reasonCodes",
  "scheduleNext",
  "schedulePrevious",
] as const;

function validateNeedLaneSnapshot(
  snapshot: NeedStoreSnapshot,
  key: number,
  active: boolean,
  interval: number,
): boolean {
  const value = snapshot.values[key] ?? -1;
  const phase = snapshot.updatePhases[key] ?? -1;
  const laneVersion = snapshot.laneVersions[key] ?? -1;
  const tick = snapshot.sourceTicks[key] ?? -1;
  const system = snapshot.sourceSystemIds[key] ?? -1;
  const event = snapshot.sourceEventIds[key] ?? -1;
  const previous = snapshot.previousValues[key] ?? -1;
  const delta = snapshot.deltas[key] ?? Number.NaN;
  const reason = snapshot.reasonCodes[key] ?? -1;
  const next = snapshot.scheduleNext[key] ?? -2;
  const prior = snapshot.schedulePrevious[key] ?? -2;
  if (!active)
    return (
      value === 0 &&
      phase === 0 &&
      laneVersion === 0 &&
      tick === 0 &&
      system === 0 &&
      event === 0 &&
      previous === 0 &&
      delta === 0 &&
      reason === 0 &&
      next === -1 &&
      prior === -1
    );
  return (
    isNeedValue(value) &&
    isIndexInRange(phase, interval) &&
    isSafeUint32Number(laneVersion) &&
    laneVersion > 0 &&
    laneVersion <= snapshot.storeVersion &&
    isSafeTick(tick) &&
    isSafeUint32Number(system) &&
    isSafeUint32Number(event) &&
    isNeedValue(previous) &&
    isInt32(delta) &&
    previous + delta === value &&
    isCanonicalNeedLaneReason(
      reason,
      value,
      previous,
      delta,
      system,
      event,
      tick,
      phase,
      interval,
    ) &&
    Number.isSafeInteger(next) &&
    next >= -1 &&
    next < snapshot.values.length &&
    Number.isSafeInteger(prior) &&
    prior >= -1 &&
    prior < snapshot.values.length
  );
}

function validateNeedScheduleSnapshot(snapshot: NeedStoreSnapshot): number {
  const seen = new Uint8Array(snapshot.values.length);
  let maxPhaseChainLength = 0;
  for (let phase = 0; phase < snapshot.updateIntervalTicks; phase += 1) {
    let key = snapshot.scheduleHeads[phase] ?? -2;
    let previous = -1;
    let guard = 0;
    while (key >= 0) {
      if (
        key >= snapshot.values.length ||
        seen[key] === 1 ||
        snapshot.updatePhases[key] !== phase ||
        snapshot.schedulePrevious[key] !== previous ||
        (previous >= 0 && key <= previous)
      )
        return -1;
      seen[key] = 1;
      previous = key;
      key = snapshot.scheduleNext[key] ?? -2;
      guard += 1;
      if (guard > snapshot.values.length) return -1;
    }
    if (key !== -1) return -1;
    if (guard > maxPhaseChainLength) maxPhaseChainLength = guard;
    const cursor = snapshot.scheduleCursors[phase] ?? -2;
    if (
      cursor !== -1 &&
      (cursor < 0 ||
        cursor >= seen.length ||
        seen[cursor] !== 1 ||
        snapshot.updatePhases[cursor] !== phase)
    )
      return -1;
  }
  for (let key = 0; key < snapshot.values.length; key += 1) {
    const actorId = Math.floor(key / NEED_LANE_COUNT);
    if ((snapshot.active[actorId] === 1) !== (seen[key] === 1)) return -1;
  }
  return maxPhaseChainLength;
}

function validateNeedVersionTopology(snapshot: NeedStoreSnapshot): boolean {
  const mutationCount = snapshot.storeVersion - snapshot.actorCount;
  let saturatedLaneVersionSum = 0;
  let laneVersionModulo = 0;
  for (let actorId = 0; actorId < snapshot.actorCapacity; actorId += 1) {
    if (snapshot.active[actorId] !== 1) continue;
    const baseKey = actorId * NEED_LANE_COUNT;
    for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
      const laneVersion = snapshot.laneVersions[baseKey + lane] ?? 0;
      laneVersionModulo = (laneVersionModulo + (laneVersion % NEED_LANE_COUNT)) % NEED_LANE_COUNT;
      if (saturatedLaneVersionSum < mutationCount) {
        saturatedLaneVersionSum += Math.min(laneVersion, mutationCount - saturatedLaneVersionSum);
      }
    }
  }
  return (
    saturatedLaneVersionSum >= mutationCount &&
    (laneVersionModulo - (mutationCount % NEED_LANE_COUNT) + NEED_LANE_COUNT) % NEED_LANE_COUNT ===
      0
  );
}

function isCanonicalNeedLaneReason(
  reasonCode: number,
  value: number,
  previousValue: number,
  delta: number,
  sourceSystemId: number,
  sourceEventId: number,
  sourceTick: number,
  updatePhase: number,
  updateIntervalTicks: number,
): boolean {
  if (reasonCode === 0) {
    return delta === 0 && value === previousValue && sourceSystemId === 0 && sourceEventId === 0;
  }
  if (reasonCode === 4) {
    return value === NEED_VALUE_MIN && previousValue > NEED_VALUE_MIN && delta < 0;
  }
  if (reasonCode === 5) {
    return value === NEED_VALUE_MAX && previousValue < NEED_VALUE_MAX && delta > 0;
  }
  if (reasonCode === 1) {
    return (
      delta !== 0 &&
      sourceSystemId === 0 &&
      sourceEventId === 0 &&
      sourceTick % updateIntervalTicks === updatePhase
    );
  }
  return reasonCode >= 2 && reasonCode <= 3 && delta !== 0;
}

function hasCanonicalNeedUpdatePhases(
  updatePhases: readonly number[],
  actorId: number,
  updateIntervalTicks: number,
  phaseSalt: number,
): boolean {
  const actorKey = actorId * NEED_LANE_COUNT;
  const laneZero = updatePhases[actorKey] ?? -1;
  let expected = laneZero;
  for (let lane = 0; lane < NEED_LANE_COUNT; lane += 1) {
    if (updatePhases[actorKey + lane] !== expected) return false;
    expected = expected === updateIntervalTicks - 1 ? 0 : expected + 1;
  }
  const actorOffset = actorKey % updateIntervalTicks;
  return isReachableNeedPhaseResidue(phaseSalt, updateIntervalTicks, actorOffset, laneZero);
}

/** @internal Package-local strict snapshot proof; not exported from the package root. */
export function isReachableNeedPhaseResidue(
  phaseSalt: number,
  updateIntervalTicks: number,
  actorOffset: number,
  laneZero: number,
): boolean {
  if (
    !Number.isSafeInteger(phaseSalt) ||
    phaseSalt < 0 ||
    !isPositiveSafeInteger(updateIntervalTicks) ||
    !isIndexInRange(actorOffset, updateIntervalTicks) ||
    !isIndexInRange(laneZero, updateIntervalTicks)
  )
    return false;
  const difference =
    laneZero >= actorOffset
      ? laneZero - actorOffset
      : updateIntervalTicks - (actorOffset - laneZero);
  return difference % greatestCommonDivisor(phaseSalt, updateIntervalTicks) === 0;
}

function greatestCommonDivisor(left: number, right: number): number {
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function isPlainNeedRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactNeedKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  return true;
}

function isDenseNeedArray(value: unknown, length: number): value is readonly number[] {
  if (!Array.isArray(value) || value.length !== length || Object.keys(value).length !== length)
    return false;
  for (let index = 0; index < length; index += 1)
    if (typeof value[index] !== "number") return false;
  return true;
}

function appendNeedLaneHashFields(
  fields: CanonicalWorldField[],
  snapshot: NeedStoreSnapshot,
  actorId: number,
  lane: number,
  actorPrefix: string,
): void {
  const key = actorId * NEED_LANE_COUNT + lane;
  const lanePrefix = `${actorPrefix}.lane.${String(lane)}`;
  fields.push({ name: `${lanePrefix}.value`, value: snapshot.values[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.updatePhase`, value: snapshot.updatePhases[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.laneVersion`, value: snapshot.laneVersions[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.sourceTick`, value: snapshot.sourceTicks[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.sourceSystemId`, value: snapshot.sourceSystemIds[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.sourceEventId`, value: snapshot.sourceEventIds[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.previousValue`, value: snapshot.previousValues[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.delta`, value: snapshot.deltas[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.reasonCode`, value: snapshot.reasonCodes[key] ?? 0 });
  fields.push({ name: `${lanePrefix}.next`, value: snapshot.scheduleNext[key] ?? -1 });
  fields.push({ name: `${lanePrefix}.previous`, value: snapshot.schedulePrevious[key] ?? -1 });
}
