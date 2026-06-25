import { mixUint32 } from "./deterministic-hash";
import { assertValidCapacity } from "./entity-id";
import type { M3EnvironmentProjection } from "./m3-environment-data";
import {
  NEED_LANE_COMFORT,
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_LANE_SOCIAL,
  type NeedStore,
} from "./m3-needs";
import { requireSafeTick, type Tick } from "./time";
import type { M3HealthConditionView } from "./m3-health";

export const M3_MOOD_THOUGHT_MEMORY_SNAPSHOT_VERSION = 1;
export const M3_MOOD_LANE_VALENCE = 0;
export const M3_MOOD_LANE_ENERGY = 1;
export const M3_MOOD_LANE_TENSION = 2;
export const M3_MOOD_LANE_COUNT = 3;
export const M3_MOOD_VALUE_MIN = 0;
export const M3_MOOD_VALUE_MAX = 1_000;
export const M3_MOOD_BASELINE = 500;
export const M3_MOOD_ACTOR_NONE = 0xffff_ffff;
export const M3_MOOD_DEFAULT_THOUGHT_CAPACITY = 24;
export const M3_MOOD_DEFAULT_MEMORY_CAPACITY = 24;
export const M3_MOOD_DEFAULT_TRACE_CAPACITY = 64;

export type M3MoodLane =
  | typeof M3_MOOD_LANE_VALENCE
  | typeof M3_MOOD_LANE_ENERGY
  | typeof M3_MOOD_LANE_TENSION;

export type M3MoodSourceKind = "need" | "environment" | "health" | "work" | "social";

export type M3MoodReason =
  | "mood.actor_out_of_range"
  | "mood.actor_already_registered"
  | "mood.actor_not_registered"
  | "mood.lane_out_of_range"
  | "mood.value_out_of_range"
  | "mood.strength_out_of_range"
  | "mood.duration_out_of_range"
  | "mood.stack_key_out_of_range"
  | "mood.source_out_of_range"
  | "mood.dirty_queue_overflow"
  | "mood.thought_added"
  | "mood.thought_refreshed"
  | "mood.thought_evicted"
  | "mood.thought_expired"
  | "mood.memory_added"
  | "mood.memory_refreshed"
  | "mood.memory_evicted"
  | "mood.memory_expired"
  | "mood.target_recalculated"
  | "mood.current_converged"
  | "mood.need_fact_applied"
  | "mood.environment_fact_applied"
  | "mood.health_fact_applied"
  | "trace.candidate_cap_reached";

export interface M3MoodThoughtInput {
  readonly actorId: number;
  readonly tick: Tick;
  readonly sourceKind: M3MoodSourceKind;
  readonly sourceId: number;
  readonly sourceVersion: number;
  readonly targetActorId?: number;
  readonly targetMoodLane: M3MoodLane;
  readonly strength: number;
  readonly effectDelta: number;
  readonly durationTicks: number;
  readonly memoryDurationTicks?: number;
  readonly stackKey: number;
}

export interface M3MoodStoreOptions {
  readonly actorCapacity: number;
  readonly thoughtCapacity?: number;
  readonly memoryCapacity?: number;
  readonly dirtyCapacity?: number;
  readonly updateIntervalTicks: number;
  readonly phaseSalt?: number;
}

export type M3MoodMutationResult =
  | {
      readonly ok: true;
      readonly reason: M3MoodReason;
      readonly actorId: number;
      readonly storeVersion: number;
      readonly rowId: number;
    }
  | { readonly ok: false; readonly reason: M3MoodReason };

export interface M3MoodActorView {
  readonly actorId: number;
  readonly currentValence: number;
  readonly currentEnergy: number;
  readonly currentTension: number;
  readonly targetValence: number;
  readonly targetEnergy: number;
  readonly targetTension: number;
  readonly actorVersion: number;
}

export interface M3MoodRowView {
  readonly rowId: number;
  readonly sequence: number;
  readonly actorId: number;
  readonly sourceKind: M3MoodSourceKind;
  readonly sourceId: number;
  readonly sourceVersion: number;
  readonly createdTick: Tick;
  readonly expiresTick: Tick;
  readonly targetActorId: number;
  readonly targetMoodLane: M3MoodLane;
  readonly strength: number;
  readonly effectDelta: number;
  readonly durationTicks: number;
  readonly stackKey: number;
}

export interface M3MoodUpdateResult {
  readonly ok: true;
  readonly tick: Tick;
  readonly phase: number;
  readonly visitedCount: number;
  readonly changedCount: number;
  readonly expiredThoughtCount: number;
  readonly expiredMemoryCount: number;
  readonly budgetExhausted: boolean;
  readonly storeVersion: number;
}

export interface M3MoodMetrics {
  readonly storeVersion: number;
  readonly actorCount: number;
  readonly retainedThoughtCount: number;
  readonly retainedMemoryCount: number;
  readonly thoughtGenerationCount: number;
  readonly memoryGenerationCount: number;
  readonly thoughtEvictionCount: number;
  readonly memoryEvictionCount: number;
  readonly expiredThoughtCount: number;
  readonly expiredMemoryCount: number;
  readonly moodUpdateCount: number;
  readonly moodUpdateVisitedCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
}

export interface M3MoodTraceInput {
  readonly tick: Tick;
  readonly actorId: number;
  readonly candidateTotal: number;
  readonly visitedCount: number;
  readonly scoredCount: number;
  readonly candidateCap: number;
  readonly selectedTargetId: number;
  readonly sourceKind: M3MoodSourceKind;
  readonly sourceId: number;
  readonly sourceVersion: number;
  readonly reason: M3MoodReason;
  readonly storeVersion: number;
}

export interface M3MoodTraceView extends M3MoodTraceInput {
  readonly sequence: number;
}

export interface M3MoodTraceMetrics {
  readonly capacity: number;
  readonly storedCount: number;
  readonly nextSequence: number;
}

type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: M3MoodReason };

export class MoodThoughtMemoryStore {
  readonly actorCapacity: number;
  readonly thoughtCapacity: number;
  readonly memoryCapacity: number;
  readonly dirtyCapacity: number;
  readonly updateIntervalTicks: number;

  private readonly activeActors: Uint8Array;
  private readonly currentMood: Uint16Array;
  private readonly targetMood: Uint16Array;
  private readonly actorVersions: Uint32Array;
  private readonly updatePhases: Uint32Array;
  private readonly scheduleHeads: Int32Array;
  private readonly scheduleCursors: Int32Array;
  private readonly scheduleNext: Int32Array;
  private readonly schedulePrevious: Int32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyActors: Uint32Array;
  private readonly thoughts: M3Rows;
  private readonly memories: M3Rows;
  private actorCountValue = 0;
  private storeVersion = 0;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private nextSequence = 1;
  private thoughtGenerationCount = 0;
  private memoryGenerationCount = 0;
  private thoughtEvictionCount = 0;
  private memoryEvictionCount = 0;
  private expiredThoughtCount = 0;
  private expiredMemoryCount = 0;
  private moodUpdateCount = 0;
  private moodUpdateVisitedCount = 0;

  constructor(options: M3MoodStoreOptions) {
    assertValidCapacity(options.actorCapacity, "M3 mood actor capacity");
    this.thoughtCapacity = options.thoughtCapacity ?? M3_MOOD_DEFAULT_THOUGHT_CAPACITY;
    this.memoryCapacity = options.memoryCapacity ?? M3_MOOD_DEFAULT_MEMORY_CAPACITY;
    this.dirtyCapacity = options.dirtyCapacity ?? options.actorCapacity;
    assertValidCapacity(this.thoughtCapacity, "M3 thought capacity");
    assertValidCapacity(this.memoryCapacity, "M3 memory capacity");
    assertValidCapacity(this.dirtyCapacity, "M3 mood dirty capacity");
    if (!isPositiveSafeInteger(options.updateIntervalTicks)) {
      throw new Error("M3 mood update interval must be a positive safe integer");
    }

    this.actorCapacity = options.actorCapacity;
    this.updateIntervalTicks = options.updateIntervalTicks;
    this.activeActors = new Uint8Array(options.actorCapacity);
    this.currentMood = new Uint16Array(options.actorCapacity * M3_MOOD_LANE_COUNT);
    this.targetMood = new Uint16Array(options.actorCapacity * M3_MOOD_LANE_COUNT);
    this.actorVersions = new Uint32Array(options.actorCapacity);
    this.updatePhases = new Uint32Array(options.actorCapacity);
    this.scheduleHeads = createEmptyLinks(options.updateIntervalTicks);
    this.scheduleCursors = createEmptyLinks(options.updateIntervalTicks);
    this.scheduleNext = createEmptyLinks(options.actorCapacity);
    this.schedulePrevious = createEmptyLinks(options.actorCapacity);
    this.dirtyQueued = new Uint8Array(options.actorCapacity);
    this.dirtyActors = new Uint32Array(this.dirtyCapacity);
    this.thoughts = createRows(this.thoughtCapacity, options.actorCapacity);
    this.memories = createRows(this.memoryCapacity, options.actorCapacity);
    this.currentMood.fill(M3_MOOD_BASELINE);
    this.targetMood.fill(M3_MOOD_BASELINE);

    const phaseSalt = options.phaseSalt ?? 29;
    for (let actorId = 0; actorId < options.actorCapacity; actorId += 1) {
      this.updatePhases[actorId] = (actorId * phaseSalt) % options.updateIntervalTicks;
    }
  }

  get version(): number {
    return this.storeVersion;
  }

  registerActor(actorId: number): M3MoodMutationResult {
    if (!isIndexInRange(actorId, this.actorCapacity)) {
      return { ok: false, reason: "mood.actor_out_of_range" };
    }
    if ((this.activeActors[actorId] ?? 0) === 1) {
      return { ok: false, reason: "mood.actor_already_registered" };
    }
    this.activeActors[actorId] = 1;
    this.actorCountValue += 1;
    this.storeVersion += 1;
    this.actorVersions[actorId] = this.storeVersion;
    this.insertScheduledActor(actorId, this.updatePhases[actorId] ?? 0);
    return {
      ok: true,
      reason: "mood.target_recalculated",
      actorId,
      storeVersion: this.storeVersion,
      rowId: M3_MOOD_ACTOR_NONE,
    };
  }

  applyThought(
    input: M3MoodThoughtInput,
    traceStore?: M3MoodReasonTraceStore,
  ): M3MoodMutationResult {
    const validation = this.validateThoughtInput(input);
    if (!validation.ok) {
      return validation;
    }
    if (!this.canQueueDirty(input.actorId)) {
      return { ok: false, reason: "mood.dirty_queue_overflow" };
    }
    const existing = this.findStackedRow(this.thoughts, input.actorId, input.stackKey);
    const rowId = existing >= 0 ? existing : this.allocateRow(this.thoughts);
    const reason: M3MoodReason = existing >= 0 ? "mood.thought_refreshed" : "mood.thought_added";
    if (rowId < 0) {
      return { ok: false, reason: "mood.source_out_of_range" };
    }
    if ((this.thoughts.active[rowId] ?? 0) === 1 && existing < 0) {
      const evictedActorId = this.prepareEvictedRow(this.thoughts, rowId);
      this.thoughtEvictionCount += 1;
      if (evictedActorId !== input.actorId && this.isActorActive(evictedActorId)) {
        this.recalculateActorTarget(evictedActorId);
        this.markActorVersionChanged(evictedActorId);
      }
      traceStore?.record(this.createTraceInput(input, "mood.thought_evicted"));
    }
    this.writeRow(this.thoughts, rowId, input);
    if (existing < 0) {
      this.linkRow(this.thoughts, rowId, input.actorId);
    }
    this.thoughtGenerationCount += 1;
    this.storeVersion += 1;
    this.actorVersions[input.actorId] = this.storeVersion;
    this.markDirty(input.actorId);
    this.recalculateActorTarget(input.actorId);
    traceStore?.record(this.createTraceInput(input, reason));
    if (input.memoryDurationTicks !== undefined && input.memoryDurationTicks > 0) {
      this.recordMemory(input, traceStore);
    }
    return { ok: true, reason, actorId: input.actorId, storeVersion: this.storeVersion, rowId };
  }

  applyNeedFacts(
    actorId: number,
    needs: NeedStore,
    tick: Tick,
    traceStore?: M3MoodReasonTraceStore,
  ): number {
    const view = needs.readActorNeeds(actorId);
    if (view === undefined || !this.isActorActive(actorId)) {
      return 0;
    }
    let applied = 0;
    applied += this.applyNeedLaneThought(
      actorId,
      tick,
      NEED_LANE_HUNGER,
      view.hunger,
      view.ownerVersion,
      traceStore,
    );
    applied += this.applyNeedLaneThought(
      actorId,
      tick,
      NEED_LANE_REST,
      view.rest,
      view.ownerVersion,
      traceStore,
    );
    applied += this.applyNeedLaneThought(
      actorId,
      tick,
      NEED_LANE_COMFORT,
      view.comfort,
      view.ownerVersion,
      traceStore,
    );
    applied += this.applyNeedLaneThought(
      actorId,
      tick,
      NEED_LANE_SOCIAL,
      view.social,
      view.ownerVersion,
      traceStore,
    );
    applied += this.applyNeedLaneThought(
      actorId,
      tick,
      NEED_LANE_SAFETY,
      view.safety,
      view.ownerVersion,
      traceStore,
    );
    return applied;
  }

  applyEnvironmentFact(
    actorId: number,
    projection: M3EnvironmentProjection,
    traceStore?: M3MoodReasonTraceStore,
  ): M3MoodMutationResult {
    const precipitation = projection.weather.severity.precipitation;
    const tensionDelta = projection.moodContextCode > 0 ? 70 + integerDivide(precipitation, 10) : 0;
    const valenceDelta =
      projection.moodContextCode > 0 ? -40 - integerDivide(precipitation, 20) : 0;
    const input: M3MoodThoughtInput = {
      actorId,
      tick: projection.tick,
      sourceKind: "environment",
      sourceId: projection.version,
      sourceVersion: projection.weather.weatherVersion,
      targetMoodLane: tensionDelta > 0 ? M3_MOOD_LANE_TENSION : M3_MOOD_LANE_VALENCE,
      strength: clampMoodValue(Math.abs(tensionDelta > 0 ? tensionDelta : valenceDelta) * 2),
      effectDelta: tensionDelta > 0 ? tensionDelta : valenceDelta,
      durationTicks: 1_800,
      memoryDurationTicks: 7_200,
      stackKey: 0x30_0000 + projection.weather.weatherVersion,
    };
    const result = this.applyThought(input, traceStore);
    if (result.ok) {
      traceStore?.record(this.createTraceInput(input, "mood.environment_fact_applied"));
    }
    return result;
  }

  applyHealthConditionFact(
    condition: M3HealthConditionView,
    tick: Tick,
    traceStore?: M3MoodReasonTraceStore,
  ): M3MoodMutationResult {
    const strength = clampMoodValue(condition.severity);
    const input: M3MoodThoughtInput = {
      actorId: condition.actorId,
      tick,
      sourceKind: "health",
      sourceId: condition.conditionId,
      sourceVersion: condition.conditionVersion,
      targetMoodLane: M3_MOOD_LANE_VALENCE,
      strength,
      effectDelta: -integerDivide(strength, 2),
      durationTicks: 3_600,
      memoryDurationTicks: 18_000,
      stackKey: 0x20_0000 + condition.conditionId,
    };
    const result = this.applyThought(input, traceStore);
    if (result.ok) {
      traceStore?.record(this.createTraceInput(input, "mood.health_fact_applied"));
    }
    return result;
  }

  refreshDirtyActors(budget: number): number {
    if (!isPositiveSafeInteger(budget)) {
      return 0;
    }
    let refreshed = 0;
    while (this.dirtyCount > 0 && refreshed < budget) {
      const actorId = this.dirtyActors[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.dirtyCapacity;
      this.dirtyCount -= 1;
      this.dirtyQueued[actorId] = 0;
      if (this.isActorActive(actorId)) {
        this.recalculateActorTarget(actorId);
      }
      refreshed += 1;
    }
    return refreshed;
  }

  processScheduledMoodUpdates(tick: Tick, budget: number, maxStep = 16): M3MoodUpdateResult {
    const safeTick = requireSafeTick(tick, "M3 mood tick");
    if (!isPositiveSafeInteger(budget) || !isPositiveSafeInteger(maxStep)) {
      throw new Error("M3 mood update budget and step must be positive safe integers");
    }
    const phase = safeTick % this.updateIntervalTicks;
    const head = this.scheduleHeads[phase] ?? -1;
    let current = this.scheduleCursors[phase] ?? -1;
    let visited = 0;
    let changed = 0;
    let expiredThoughts = 0;
    let expiredMemories = 0;

    if (current < 0) {
      current = head;
    }
    while (current >= 0 && visited < budget) {
      const actorId = current;
      const next = this.scheduleNext[current] ?? -1;
      if (this.isActorActive(actorId)) {
        const thoughtExpiredForActor = this.expireRowsForActor(this.thoughts, actorId, safeTick);
        const memoryExpiredForActor = this.expireRowsForActor(this.memories, actorId, safeTick);
        expiredThoughts += thoughtExpiredForActor;
        expiredMemories += memoryExpiredForActor;
        if (thoughtExpiredForActor > 0) {
          this.recalculateActorTarget(actorId);
        }
        changed += this.convergeActorMood(actorId, maxStep);
      }
      visited += 1;
      current = next;
    }
    this.scheduleCursors[phase] = current >= 0 ? current : head;
    this.moodUpdateCount += changed;
    this.moodUpdateVisitedCount += visited;
    this.expiredThoughtCount += expiredThoughts;
    this.expiredMemoryCount += expiredMemories;
    return {
      ok: true,
      tick: safeTick,
      phase,
      visitedCount: visited,
      changedCount: changed,
      expiredThoughtCount: expiredThoughts,
      expiredMemoryCount: expiredMemories,
      budgetExhausted: current >= 0,
      storeVersion: this.storeVersion,
    };
  }

  readActorMood(actorId: number): M3MoodActorView | undefined {
    if (!this.isActorActive(actorId)) {
      return undefined;
    }
    return {
      actorId,
      currentValence:
        this.currentMood[laneIndex(actorId, M3_MOOD_LANE_VALENCE)] ?? M3_MOOD_BASELINE,
      currentEnergy: this.currentMood[laneIndex(actorId, M3_MOOD_LANE_ENERGY)] ?? M3_MOOD_BASELINE,
      currentTension:
        this.currentMood[laneIndex(actorId, M3_MOOD_LANE_TENSION)] ?? M3_MOOD_BASELINE,
      targetValence: this.targetMood[laneIndex(actorId, M3_MOOD_LANE_VALENCE)] ?? M3_MOOD_BASELINE,
      targetEnergy: this.targetMood[laneIndex(actorId, M3_MOOD_LANE_ENERGY)] ?? M3_MOOD_BASELINE,
      targetTension: this.targetMood[laneIndex(actorId, M3_MOOD_LANE_TENSION)] ?? M3_MOOD_BASELINE,
      actorVersion: this.actorVersions[actorId] ?? 0,
    };
  }

  readThought(rowId: number): M3MoodRowView | undefined {
    return this.readRow(this.thoughts, rowId);
  }

  readMemory(rowId: number): M3MoodRowView | undefined {
    return this.readRow(this.memories, rowId);
  }

  countThoughtsForActor(actorId: number): number {
    return this.countRowsForActor(this.thoughts, actorId);
  }

  countMemoriesForActor(actorId: number): number {
    return this.countRowsForActor(this.memories, actorId);
  }

  isActorActive(actorId: number): boolean {
    return isIndexInRange(actorId, this.actorCapacity) && (this.activeActors[actorId] ?? 0) === 1;
  }

  createMetrics(): M3MoodMetrics {
    return {
      storeVersion: this.storeVersion,
      actorCount: this.actorCountValue,
      retainedThoughtCount: this.thoughts.activeCount,
      retainedMemoryCount: this.memories.activeCount,
      thoughtGenerationCount: this.thoughtGenerationCount,
      memoryGenerationCount: this.memoryGenerationCount,
      thoughtEvictionCount: this.thoughtEvictionCount,
      memoryEvictionCount: this.memoryEvictionCount,
      expiredThoughtCount: this.expiredThoughtCount,
      expiredMemoryCount: this.expiredMemoryCount,
      moodUpdateCount: this.moodUpdateCount,
      moodUpdateVisitedCount: this.moodUpdateVisitedCount,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
    };
  }

  createHash(): number {
    let hash = mixUint32(0x811c_9dc5, M3_MOOD_THOUGHT_MEMORY_SNAPSHOT_VERSION);
    hash = mixUint32(hash, this.storeVersion);
    for (let actorId = 0; actorId < this.actorCapacity; actorId += 1) {
      hash = mixUint32(hash, this.activeActors[actorId] ?? 0);
      for (let lane = 0; lane < M3_MOOD_LANE_COUNT; lane += 1) {
        hash = mixUint32(hash, this.currentMood[laneIndex(actorId, lane)] ?? 0);
        hash = mixUint32(hash, this.targetMood[laneIndex(actorId, lane)] ?? 0);
      }
      hash = mixUint32(hash, this.actorVersions[actorId] ?? 0);
    }
    return mixRowsHash(mixRowsHash(hash, this.thoughts), this.memories);
  }

  private recordMemory(input: M3MoodThoughtInput, traceStore?: M3MoodReasonTraceStore): void {
    const memoryInput = createMemoryInput(input);
    const existing = this.findStackedRow(this.memories, input.actorId, input.stackKey);
    const rowId = existing >= 0 ? existing : this.allocateRow(this.memories);
    if (rowId < 0) {
      return;
    }
    if ((this.memories.active[rowId] ?? 0) === 1 && existing < 0) {
      const evictedActorId = this.prepareEvictedRow(this.memories, rowId);
      this.memoryEvictionCount += 1;
      if (evictedActorId !== input.actorId) {
        this.markActorVersionChanged(evictedActorId);
      }
      traceStore?.record(this.createTraceInput(input, "mood.memory_evicted"));
    }
    this.writeRow(this.memories, rowId, memoryInput);
    if (existing < 0) {
      this.linkRow(this.memories, rowId, input.actorId);
    }
    this.memoryGenerationCount += 1;
    traceStore?.record(
      this.createTraceInput(input, existing >= 0 ? "mood.memory_refreshed" : "mood.memory_added"),
    );
  }

  private applyNeedLaneThought(
    actorId: number,
    tick: Tick,
    lane: number,
    value: number,
    ownerVersion: number,
    traceStore?: M3MoodReasonTraceStore,
  ): number {
    if (value >= 360) {
      return 0;
    }
    const pressure = 360 - value;
    const input = createNeedThoughtInput(actorId, tick, lane, pressure, ownerVersion);
    const result = this.applyThought(input, traceStore);
    if (result.ok) {
      traceStore?.record(this.createTraceInput(input, "mood.need_fact_applied"));
      return 1;
    }
    return 0;
  }

  private validateThoughtInput(input: M3MoodThoughtInput): ValidationResult {
    if (!this.isActorActive(input.actorId)) {
      return { ok: false, reason: "mood.actor_not_registered" };
    }
    if (
      input.targetActorId !== undefined &&
      !isTargetActor(input.targetActorId, this.actorCapacity)
    ) {
      return { ok: false, reason: "mood.actor_out_of_range" };
    }
    if (!isMoodLane(input.targetMoodLane)) {
      return { ok: false, reason: "mood.lane_out_of_range" };
    }
    if (!isMoodValue(input.strength)) {
      return { ok: false, reason: "mood.strength_out_of_range" };
    }
    if (!isEffectDelta(input.effectDelta)) {
      return { ok: false, reason: "mood.value_out_of_range" };
    }
    if (!isPositiveSafeInteger(input.durationTicks)) {
      return { ok: false, reason: "mood.duration_out_of_range" };
    }
    if (
      input.memoryDurationTicks !== undefined &&
      !isPositiveSafeInteger(input.memoryDurationTicks)
    ) {
      return { ok: false, reason: "mood.duration_out_of_range" };
    }
    if (!isNonNegativeUint32(input.stackKey)) {
      return { ok: false, reason: "mood.stack_key_out_of_range" };
    }
    if (!isNonNegativeUint32(input.sourceId) || !isNonNegativeUint32(input.sourceVersion)) {
      return { ok: false, reason: "mood.source_out_of_range" };
    }
    requireSafeTick(input.tick, "M3 mood thought tick");
    return { ok: true };
  }

  private createTraceInput(input: M3MoodThoughtInput, reason: M3MoodReason): M3MoodTraceInput {
    return {
      tick: input.tick,
      actorId: input.actorId,
      candidateTotal: this.thoughts.activeCount,
      visitedCount: this.countRowsForActor(this.thoughts, input.actorId),
      scoredCount: this.countRowsForActor(this.thoughts, input.actorId),
      candidateCap: this.thoughtCapacity,
      selectedTargetId: input.targetActorId ?? M3_MOOD_ACTOR_NONE,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      sourceVersion: input.sourceVersion,
      reason,
      storeVersion: this.storeVersion,
    };
  }

  private writeRow(rows: M3Rows, rowId: number, input: M3MoodThoughtInput): void {
    rows.active[rowId] = 1;
    rows.actorIds[rowId] = input.actorId;
    rows.sourceKinds[rowId] = encodeSourceKind(input.sourceKind);
    rows.sourceIds[rowId] = input.sourceId;
    rows.sourceVersions[rowId] = input.sourceVersion;
    rows.createdTicks[rowId] = input.tick;
    rows.expiresTicks[rowId] = input.tick + input.durationTicks;
    rows.targetActorIds[rowId] = input.targetActorId ?? M3_MOOD_ACTOR_NONE;
    rows.targetMoodLanes[rowId] = input.targetMoodLane;
    rows.strengths[rowId] = input.strength;
    rows.effectDeltas[rowId] = input.effectDelta;
    rows.durationTicks[rowId] = input.durationTicks;
    rows.stackKeys[rowId] = input.stackKey;
    if ((rows.sequences[rowId] ?? 0) === 0) {
      rows.sequences[rowId] = this.nextSequence;
      this.nextSequence += 1;
    }
  }

  private readRow(rows: M3Rows, rowId: number): M3MoodRowView | undefined {
    if (!isIndexInRange(rowId, rows.capacity) || (rows.active[rowId] ?? 0) !== 1) {
      return undefined;
    }
    const lane = rows.targetMoodLanes[rowId] ?? M3_MOOD_LANE_VALENCE;
    return {
      rowId,
      sequence: rows.sequences[rowId] ?? 0,
      actorId: rows.actorIds[rowId] ?? 0,
      sourceKind: decodeSourceKind(rows.sourceKinds[rowId] ?? 0),
      sourceId: rows.sourceIds[rowId] ?? 0,
      sourceVersion: rows.sourceVersions[rowId] ?? 0,
      createdTick: rows.createdTicks[rowId] ?? 0,
      expiresTick: rows.expiresTicks[rowId] ?? 0,
      targetActorId: rows.targetActorIds[rowId] ?? M3_MOOD_ACTOR_NONE,
      targetMoodLane: isMoodLane(lane) ? lane : M3_MOOD_LANE_VALENCE,
      strength: rows.strengths[rowId] ?? 0,
      effectDelta: rows.effectDeltas[rowId] ?? 0,
      durationTicks: rows.durationTicks[rowId] ?? 0,
      stackKey: rows.stackKeys[rowId] ?? 0,
    };
  }

  private recalculateActorTarget(actorId: number): void {
    let valence = M3_MOOD_BASELINE;
    let energy = M3_MOOD_BASELINE;
    let tension = M3_MOOD_BASELINE;
    let current = this.thoughts.actorHeads[actorId] ?? -1;
    while (current >= 0) {
      const lane = this.thoughts.targetMoodLanes[current] ?? M3_MOOD_LANE_VALENCE;
      const delta = integerDivide(
        (this.thoughts.effectDeltas[current] ?? 0) * (this.thoughts.strengths[current] ?? 0),
        M3_MOOD_VALUE_MAX,
      );
      if (lane === M3_MOOD_LANE_VALENCE) {
        valence = clampMoodValue(valence + delta);
      } else if (lane === M3_MOOD_LANE_ENERGY) {
        energy = clampMoodValue(energy + delta);
      } else if (lane === M3_MOOD_LANE_TENSION) {
        tension = clampMoodValue(tension + delta);
      }
      current = this.thoughts.nextByActor[current] ?? -1;
    }
    this.targetMood[laneIndex(actorId, M3_MOOD_LANE_VALENCE)] = valence;
    this.targetMood[laneIndex(actorId, M3_MOOD_LANE_ENERGY)] = energy;
    this.targetMood[laneIndex(actorId, M3_MOOD_LANE_TENSION)] = tension;
  }

  private convergeActorMood(actorId: number, maxStep: number): number {
    let changed = 0;
    for (let lane = 0; lane < M3_MOOD_LANE_COUNT; lane += 1) {
      const key = laneIndex(actorId, lane);
      const current = this.currentMood[key] ?? M3_MOOD_BASELINE;
      const target = this.targetMood[key] ?? M3_MOOD_BASELINE;
      if (current !== target) {
        this.currentMood[key] = stepToward(current, target, maxStep);
        changed += 1;
      }
    }
    if (changed > 0) {
      this.storeVersion += 1;
      this.actorVersions[actorId] = this.storeVersion;
    }
    return changed;
  }

  private expireRowsForActor(rows: M3Rows, actorId: number, tick: Tick): number {
    let current = rows.actorHeads[actorId] ?? -1;
    let expired = 0;
    while (current >= 0) {
      const next = rows.nextByActor[current] ?? -1;
      if ((rows.expiresTicks[current] ?? 0) <= tick) {
        this.unlinkRow(rows, current);
        rows.active[current] = 0;
        rows.sequences[current] = 0;
        rows.activeCount -= 1;
        expired += 1;
        this.storeVersion += 1;
        this.actorVersions[actorId] = this.storeVersion;
      }
      current = next;
    }
    return expired;
  }

  private allocateRow(rows: M3Rows): number {
    for (let rowId = 0; rowId < rows.capacity; rowId += 1) {
      if ((rows.active[rowId] ?? 0) === 0) {
        rows.activeCount += 1;
        return rowId;
      }
    }
    return this.findEvictionRow(rows);
  }

  private prepareEvictedRow(rows: M3Rows, rowId: number): number {
    const evictedActorId = rows.actorIds[rowId] ?? M3_MOOD_ACTOR_NONE;
    this.unlinkRow(rows, rowId);
    rows.sequences[rowId] = 0;
    return evictedActorId;
  }

  private findEvictionRow(rows: M3Rows): number {
    let selected = -1;
    for (let rowId = 0; rowId < rows.capacity; rowId += 1) {
      if (
        (rows.active[rowId] ?? 0) === 1 &&
        (selected < 0 || isEvictionBefore(rows, rowId, selected))
      ) {
        selected = rowId;
      }
    }
    return selected;
  }

  private findStackedRow(rows: M3Rows, actorId: number, stackKey: number): number {
    let current = rows.actorHeads[actorId] ?? -1;
    while (current >= 0) {
      if ((rows.stackKeys[current] ?? 0) === stackKey) {
        return current;
      }
      current = rows.nextByActor[current] ?? -1;
    }
    return -1;
  }

  private linkRow(rows: M3Rows, rowId: number, actorId: number): void {
    let current = rows.actorHeads[actorId] ?? -1;
    let previous = -1;
    while (current >= 0 && current < rowId) {
      previous = current;
      current = rows.nextByActor[current] ?? -1;
    }
    rows.previousByActor[rowId] = previous;
    rows.nextByActor[rowId] = current;
    if (previous >= 0) {
      rows.nextByActor[previous] = rowId;
    } else {
      rows.actorHeads[actorId] = rowId;
    }
    if (current >= 0) {
      rows.previousByActor[current] = rowId;
    }
  }

  private unlinkRow(rows: M3Rows, rowId: number): void {
    const actorId = rows.actorIds[rowId] ?? 0;
    const previous = rows.previousByActor[rowId] ?? -1;
    const next = rows.nextByActor[rowId] ?? -1;
    if (previous >= 0) {
      rows.nextByActor[previous] = next;
    } else if (isIndexInRange(actorId, this.actorCapacity)) {
      rows.actorHeads[actorId] = next;
    }
    if (next >= 0) {
      rows.previousByActor[next] = previous;
    }
    rows.previousByActor[rowId] = -1;
    rows.nextByActor[rowId] = -1;
  }

  private countRowsForActor(rows: M3Rows, actorId: number): number {
    if (!isIndexInRange(actorId, this.actorCapacity)) {
      return 0;
    }
    let current = rows.actorHeads[actorId] ?? -1;
    let count = 0;
    while (current >= 0) {
      count += 1;
      current = rows.nextByActor[current] ?? -1;
    }
    return count;
  }

  private insertScheduledActor(actorId: number, phase: number): void {
    let current = this.scheduleHeads[phase] ?? -1;
    let previous = -1;
    while (current >= 0 && current < actorId) {
      previous = current;
      current = this.scheduleNext[current] ?? -1;
    }
    this.schedulePrevious[actorId] = previous;
    this.scheduleNext[actorId] = current;
    if (previous >= 0) {
      this.scheduleNext[previous] = actorId;
    } else {
      this.scheduleHeads[phase] = actorId;
    }
    if (current >= 0) {
      this.schedulePrevious[current] = actorId;
    }
  }

  private markActorVersionChanged(actorId: number): void {
    if (!this.isActorActive(actorId)) {
      return;
    }
    this.storeVersion += 1;
    this.actorVersions[actorId] = this.storeVersion;
  }

  private canQueueDirty(actorId: number): boolean {
    return (this.dirtyQueued[actorId] ?? 0) === 1 || this.dirtyCount < this.dirtyCapacity;
  }

  private markDirty(actorId: number): void {
    if ((this.dirtyQueued[actorId] ?? 0) === 1) {
      return;
    }
    const tail = (this.dirtyHead + this.dirtyCount) % this.dirtyCapacity;
    this.dirtyActors[tail] = actorId;
    this.dirtyQueued[actorId] = 1;
    this.dirtyCount += 1;
    if (this.dirtyCount > this.dirtyPeak) {
      this.dirtyPeak = this.dirtyCount;
    }
  }
}

export class M3MoodReasonTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly ticks: Float64Array;
  private readonly actorIds: Uint32Array;
  private readonly candidateTotals: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly scoredCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedTargetIds: Uint32Array;
  private readonly sourceKinds: Uint8Array;
  private readonly sourceIds: Uint32Array;
  private readonly sourceVersions: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private readonly storeVersions: Uint32Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity = M3_MOOD_DEFAULT_TRACE_CAPACITY) {
    assertValidCapacity(capacity, "M3 mood trace capacity");
    this.capacity = capacity;
    this.sequences = new Uint32Array(capacity);
    this.ticks = new Float64Array(capacity);
    this.actorIds = new Uint32Array(capacity);
    this.candidateTotals = new Uint32Array(capacity);
    this.visitedCounts = new Uint32Array(capacity);
    this.scoredCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedTargetIds = new Uint32Array(capacity);
    this.sourceKinds = new Uint8Array(capacity);
    this.sourceIds = new Uint32Array(capacity);
    this.sourceVersions = new Uint32Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
    this.storeVersions = new Uint32Array(capacity);
    this.selectedTargetIds.fill(M3_MOOD_ACTOR_NONE);
  }

  record(input: M3MoodTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;
    this.sequences[slot] = sequence;
    this.ticks[slot] = input.tick;
    this.actorIds[slot] = input.actorId;
    this.candidateTotals[slot] = input.candidateTotal;
    this.visitedCounts[slot] = input.visitedCount;
    this.scoredCounts[slot] = input.scoredCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedTargetIds[slot] = input.selectedTargetId;
    this.sourceKinds[slot] = encodeSourceKind(input.sourceKind);
    this.sourceIds[slot] = input.sourceId;
    this.sourceVersions[slot] = input.sourceVersion;
    this.reasonCodes[slot] = encodeMoodReason(input.reason);
    this.storeVersions[slot] = input.storeVersion;
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): M3MoodTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }
    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    return {
      sequence: this.sequences[slot] ?? 0,
      tick: this.ticks[slot] ?? 0,
      actorId: this.actorIds[slot] ?? 0,
      candidateTotal: this.candidateTotals[slot] ?? 0,
      visitedCount: this.visitedCounts[slot] ?? 0,
      scoredCount: this.scoredCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedTargetId: this.selectedTargetIds[slot] ?? M3_MOOD_ACTOR_NONE,
      sourceKind: decodeSourceKind(this.sourceKinds[slot] ?? 0),
      sourceId: this.sourceIds[slot] ?? 0,
      sourceVersion: this.sourceVersions[slot] ?? 0,
      reason: decodeMoodReason(this.reasonCodes[slot] ?? 0),
      storeVersion: this.storeVersions[slot] ?? 0,
    };
  }

  createMetrics(): M3MoodTraceMetrics {
    return {
      capacity: this.capacity,
      storedCount: this.stored,
      nextSequence: this.nextSequence,
    };
  }
}

export function createMoodThoughtMemoryStore(options: M3MoodStoreOptions): MoodThoughtMemoryStore {
  return new MoodThoughtMemoryStore(options);
}

export function createM3MoodReasonTraceStore(capacity?: number): M3MoodReasonTraceStore {
  return new M3MoodReasonTraceStore(capacity);
}

interface M3Rows {
  readonly capacity: number;
  activeCount: number;
  readonly active: Uint8Array;
  readonly actorIds: Uint32Array;
  readonly sourceKinds: Uint8Array;
  readonly sourceIds: Uint32Array;
  readonly sourceVersions: Uint32Array;
  readonly createdTicks: Float64Array;
  readonly expiresTicks: Float64Array;
  readonly targetActorIds: Uint32Array;
  readonly targetMoodLanes: Uint8Array;
  readonly strengths: Uint16Array;
  readonly effectDeltas: Int16Array;
  readonly durationTicks: Uint32Array;
  readonly stackKeys: Uint32Array;
  readonly sequences: Uint32Array;
  readonly actorHeads: Int32Array;
  readonly nextByActor: Int32Array;
  readonly previousByActor: Int32Array;
}

function createRows(capacity: number, actorCapacity: number): M3Rows {
  const rows = {
    capacity,
    activeCount: 0,
    active: new Uint8Array(capacity),
    actorIds: new Uint32Array(capacity),
    sourceKinds: new Uint8Array(capacity),
    sourceIds: new Uint32Array(capacity),
    sourceVersions: new Uint32Array(capacity),
    createdTicks: new Float64Array(capacity),
    expiresTicks: new Float64Array(capacity),
    targetActorIds: new Uint32Array(capacity),
    targetMoodLanes: new Uint8Array(capacity),
    strengths: new Uint16Array(capacity),
    effectDeltas: new Int16Array(capacity),
    durationTicks: new Uint32Array(capacity),
    stackKeys: new Uint32Array(capacity),
    sequences: new Uint32Array(capacity),
    actorHeads: createEmptyLinks(actorCapacity),
    nextByActor: createEmptyLinks(capacity),
    previousByActor: createEmptyLinks(capacity),
  };
  rows.targetActorIds.fill(M3_MOOD_ACTOR_NONE);
  return rows;
}

function createNeedThoughtInput(
  actorId: number,
  tick: Tick,
  needLane: number,
  pressure: number,
  ownerVersion: number,
): M3MoodThoughtInput {
  if (needLane === NEED_LANE_REST) {
    return createFactThought(
      actorId,
      tick,
      needLane,
      ownerVersion,
      M3_MOOD_LANE_ENERGY,
      -pressure,
      pressure,
    );
  }
  if (needLane === NEED_LANE_SAFETY || needLane === NEED_LANE_COMFORT) {
    return createFactThought(
      actorId,
      tick,
      needLane,
      ownerVersion,
      M3_MOOD_LANE_TENSION,
      pressure,
      pressure,
    );
  }
  return createFactThought(
    actorId,
    tick,
    needLane,
    ownerVersion,
    M3_MOOD_LANE_VALENCE,
    -pressure,
    pressure,
  );
}

function createFactThought(
  actorId: number,
  tick: Tick,
  sourceId: number,
  sourceVersion: number,
  targetMoodLane: M3MoodLane,
  effectDelta: number,
  strength: number,
): M3MoodThoughtInput {
  return {
    actorId,
    tick,
    sourceKind: "need",
    sourceId,
    sourceVersion,
    targetMoodLane,
    strength: clampMoodValue(strength * 2),
    effectDelta,
    durationTicks: 1_800,
    memoryDurationTicks: 7_200,
    stackKey: 0x10_0000 + sourceId,
  };
}

function createMemoryInput(input: M3MoodThoughtInput): M3MoodThoughtInput {
  const memoryInput: M3MoodThoughtInput = {
    actorId: input.actorId,
    tick: input.tick,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion,
    targetMoodLane: input.targetMoodLane,
    strength: input.strength,
    effectDelta: input.effectDelta,
    durationTicks: input.memoryDurationTicks ?? input.durationTicks,
    stackKey: input.stackKey,
  };
  if (input.targetActorId !== undefined) {
    return { ...memoryInput, targetActorId: input.targetActorId };
  }
  return memoryInput;
}

function mixRowsHash(hash: number, rows: M3Rows): number {
  let next = mixUint32(hash, rows.activeCount);
  for (let rowId = 0; rowId < rows.capacity; rowId += 1) {
    if ((rows.active[rowId] ?? 0) === 1) {
      next = mixUint32(next, rowId);
      next = mixUint32(next, rows.actorIds[rowId] ?? 0);
      next = mixUint32(next, rows.sourceKinds[rowId] ?? 0);
      next = mixUint32(next, rows.sourceIds[rowId] ?? 0);
      next = mixUint32(next, rows.sourceVersions[rowId] ?? 0);
      next = mixTick(next, rows.createdTicks[rowId] ?? 0);
      next = mixTick(next, rows.expiresTicks[rowId] ?? 0);
      next = mixUint32(next, rows.targetActorIds[rowId] ?? M3_MOOD_ACTOR_NONE);
      next = mixUint32(next, rows.targetMoodLanes[rowId] ?? 0);
      next = mixUint32(next, rows.strengths[rowId] ?? 0);
      next = mixUint32(next, rows.effectDeltas[rowId] ?? 0);
      next = mixUint32(next, rows.durationTicks[rowId] ?? 0);
      next = mixUint32(next, rows.stackKeys[rowId] ?? 0);
      next = mixUint32(next, rows.sequences[rowId] ?? 0);
    }
  }
  return next;
}

function isEvictionBefore(rows: M3Rows, candidate: number, selected: number): boolean {
  const candidateStrength = rows.strengths[candidate] ?? 0;
  const selectedStrength = rows.strengths[selected] ?? 0;
  if (candidateStrength !== selectedStrength) {
    return candidateStrength < selectedStrength;
  }
  const candidateExpires = rows.expiresTicks[candidate] ?? 0;
  const selectedExpires = rows.expiresTicks[selected] ?? 0;
  if (candidateExpires !== selectedExpires) {
    return candidateExpires < selectedExpires;
  }
  return (rows.sequences[candidate] ?? 0) < (rows.sequences[selected] ?? 0);
}

function stepToward(current: number, target: number, maxStep: number): number {
  if (current < target) {
    return Math.min(target, current + maxStep);
  }
  return Math.max(target, current - maxStep);
}

function laneIndex(actorId: number, lane: number): number {
  return actorId * M3_MOOD_LANE_COUNT + lane;
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

function mixTick(hash: number, tick: Tick): number {
  return mixUint32(mixUint32(hash, tick % 0x1_0000_0000), integerDivide(tick, 0x1_0000_0000));
}

function integerDivide(value: number, divisor: number): number {
  return Math.trunc(value / divisor);
}

function clampMoodValue(value: number): number {
  if (value < M3_MOOD_VALUE_MIN) {
    return M3_MOOD_VALUE_MIN;
  }
  if (value > M3_MOOD_VALUE_MAX) {
    return M3_MOOD_VALUE_MAX;
  }
  return value;
}

function isMoodLane(value: number): value is M3MoodLane {
  return Number.isSafeInteger(value) && value >= 0 && value < M3_MOOD_LANE_COUNT;
}

function isMoodValue(value: number): boolean {
  return Number.isSafeInteger(value) && value >= M3_MOOD_VALUE_MIN && value <= M3_MOOD_VALUE_MAX;
}

function isEffectDelta(value: number): boolean {
  return Number.isSafeInteger(value) && value >= -M3_MOOD_VALUE_MAX && value <= M3_MOOD_VALUE_MAX;
}

function isTargetActor(value: number, actorCapacity: number): boolean {
  return value === M3_MOOD_ACTOR_NONE || isIndexInRange(value, actorCapacity);
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function encodeSourceKind(kind: M3MoodSourceKind): number {
  if (kind === "environment") {
    return 1;
  }
  if (kind === "health") {
    return 2;
  }
  if (kind === "work") {
    return 3;
  }
  if (kind === "social") {
    return 4;
  }
  return 0;
}

function decodeSourceKind(code: number): M3MoodSourceKind {
  if (code === 1) {
    return "environment";
  }
  if (code === 2) {
    return "health";
  }
  if (code === 3) {
    return "work";
  }
  if (code === 4) {
    return "social";
  }
  return "need";
}

function encodeMoodReason(reason: M3MoodReason): number {
  switch (reason) {
    case "mood.thought_refreshed":
      return 1;
    case "mood.thought_evicted":
      return 2;
    case "mood.memory_added":
      return 3;
    case "mood.memory_refreshed":
      return 4;
    case "mood.memory_evicted":
      return 5;
    case "mood.target_recalculated":
      return 6;
    case "mood.current_converged":
      return 7;
    case "mood.need_fact_applied":
      return 8;
    case "mood.environment_fact_applied":
      return 9;
    case "mood.health_fact_applied":
      return 10;
    case "trace.candidate_cap_reached":
      return 11;
    default:
      return 0;
  }
}

function decodeMoodReason(code: number): M3MoodReason {
  switch (code) {
    case 1:
      return "mood.thought_refreshed";
    case 2:
      return "mood.thought_evicted";
    case 3:
      return "mood.memory_added";
    case 4:
      return "mood.memory_refreshed";
    case 5:
      return "mood.memory_evicted";
    case 6:
      return "mood.target_recalculated";
    case 7:
      return "mood.current_converged";
    case 8:
      return "mood.need_fact_applied";
    case 9:
      return "mood.environment_fact_applied";
    case 10:
      return "mood.health_fact_applied";
    case 11:
      return "trace.candidate_cap_reached";
    default:
      return "mood.thought_added";
  }
}
