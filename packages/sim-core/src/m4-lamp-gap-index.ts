import {
  M4_LAMP_NONE,
  type M4LampMutationResult,
  type M4LampNetworkStore,
  type M4LampReason,
} from "./m4-lamp-network";

export const M4_LAMP_GAP_DEFAULT_CANDIDATE_CAP = 24;
export const M4_LAMP_GAP_DEFAULT_SELECTED_CAP = 12;

export type M4LampGapTraceReason =
  | "lamp_gap_candidates_indexed"
  | "lamp_gap_no_candidate"
  | "trace.candidate_cap_reached"
  | "trace.selected_cap_reached";

export type M4LampGapReason =
  | M4LampReason
  | "lamp_gap_candidate_cap_invalid"
  | "lamp_gap_selected_cap_invalid"
  | "lamp_gap_output_too_small"
  | "lamp_gap_index_dirty_backlog"
  | "lamp_gap_index_rebuild_required"
  | "lamp_gap_dirty_budget_invalid"
  | "lamp_gap_group_out_of_range"
  | "lamp_gap_room_out_of_range"
  | "lamp_gap_trace_capacity_invalid";

export interface M4LampGapIndexOptions {
  readonly lampCapacity: number;
  readonly groupCapacity?: number;
  readonly roomCapacity?: number;
  readonly dirtyCapacity?: number;
}

export interface M4LampGapQuery {
  readonly roomId?: number;
  readonly groupId?: number;
  readonly candidateCap: number;
  readonly maxSelectedLamps: number;
}

export type M4LampGapQueryResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly sourceVersion: number;
      readonly indexVersion: number;
      readonly traceSequence: number;
    }
  | { readonly ok: false; readonly reason: M4LampGapReason };

export type M4LampGapRefreshResult =
  | {
      readonly ok: true;
      readonly refreshedCount: number;
      readonly remainingCount: number;
      readonly sourceVersion: number;
      readonly indexVersion: number;
    }
  | { readonly ok: false; readonly reason: M4LampGapReason };

export interface M4LampGapIndexMetrics {
  readonly indexVersion: number;
  readonly sourceVersion: number;
  readonly activeGapCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
  readonly rebuildRequired: boolean;
  readonly missedDirtyCount: number;
  readonly refreshedCount: number;
  readonly rebuiltCount: number;
  readonly fullRebuildLampScans: number;
  readonly lastQueryVisitedCount: number;
  readonly totalQueryVisitedCount: number;
  readonly queryCount: number;
}

export interface M4LampGapTraceInput {
  readonly roomId: number;
  readonly groupId: number;
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly selectedLampId: number;
  readonly candidateCapHit: boolean;
  readonly selectedCapHit: boolean;
  readonly sourceVersion: number;
  readonly indexVersion: number;
  readonly reason: M4LampGapTraceReason;
}

export interface M4LampGapTraceView extends M4LampGapTraceInput {
  readonly sequence: number;
}

export interface M4LampGapTraceMetrics {
  readonly capacity: number;
  readonly storedCount: number;
  readonly nextSequence: number;
  readonly backlogCount: number;
}

export class M4LampGapIndex {
  readonly lampCapacity: number;
  readonly groupCapacity: number;
  readonly roomCapacity: number;
  readonly compositeBucketCount: number;
  readonly dirtyCapacity: number;

  private readonly globalLinked: Uint8Array;
  private readonly groupLinked: Uint8Array;
  private readonly roomLinked: Uint8Array;
  private readonly compositeLinked: Uint8Array;
  private readonly scores: Uint32Array;
  private readonly lampVersions: Uint32Array;
  private readonly indexedGroupIds: Uint32Array;
  private readonly indexedRoomIds: Uint32Array;
  private readonly globalNextByLamp: Int32Array;
  private readonly globalPreviousByLamp: Int32Array;
  private readonly groupHeadByGroup: Int32Array;
  private readonly groupNextByLamp: Int32Array;
  private readonly groupPreviousByLamp: Int32Array;
  private readonly groupCounts: Uint32Array;
  private readonly roomHeadByRoom: Int32Array;
  private readonly roomNextByLamp: Int32Array;
  private readonly roomPreviousByLamp: Int32Array;
  private readonly roomCounts: Uint32Array;
  private readonly compositeHeadByKey: Int32Array;
  private readonly compositeNextByLamp: Int32Array;
  private readonly compositePreviousByLamp: Int32Array;
  private readonly compositeCounts: Uint32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private globalHead = -1;
  private activeGapCountValue = 0;
  private missedDirtyCountValue = 0;
  private refreshedCountValue = 0;
  private rebuiltCountValue = 0;
  private fullRebuildLampScans = 0;
  private lastQueryVisitedCount = 0;
  private totalQueryVisitedCount = 0;
  private queryCount = 0;
  private sourceVersionValue = 0;
  private indexVersionValue = 0;
  private rebuildRequiredValue = false;

  constructor(options: M4LampGapIndexOptions) {
    this.lampCapacity = requirePositiveSafeInteger(options.lampCapacity, "lamp gap capacity");
    this.groupCapacity = requirePositiveSafeInteger(
      options.groupCapacity ?? options.lampCapacity,
      "lamp gap group capacity",
    );
    this.roomCapacity = requirePositiveSafeInteger(
      options.roomCapacity ?? options.lampCapacity,
      "lamp gap room capacity",
    );
    this.compositeBucketCount = requirePositiveSafeInteger(
      this.groupCapacity * this.roomCapacity,
      "lamp gap composite bucket count",
    );
    this.dirtyCapacity = requirePositiveSafeInteger(
      options.dirtyCapacity ?? options.lampCapacity,
      "lamp gap dirty capacity",
    );
    this.globalLinked = new Uint8Array(this.lampCapacity);
    this.groupLinked = new Uint8Array(this.lampCapacity);
    this.roomLinked = new Uint8Array(this.lampCapacity);
    this.compositeLinked = new Uint8Array(this.lampCapacity);
    this.scores = new Uint32Array(this.lampCapacity);
    this.lampVersions = new Uint32Array(this.lampCapacity);
    this.indexedGroupIds = new Uint32Array(this.lampCapacity);
    this.indexedRoomIds = new Uint32Array(this.lampCapacity);
    this.indexedGroupIds.fill(M4_LAMP_NONE);
    this.indexedRoomIds.fill(M4_LAMP_NONE);
    this.globalNextByLamp = createEmptyLinks(this.lampCapacity);
    this.globalPreviousByLamp = createEmptyLinks(this.lampCapacity);
    this.groupHeadByGroup = createEmptyLinks(this.groupCapacity);
    this.groupNextByLamp = createEmptyLinks(this.lampCapacity);
    this.groupPreviousByLamp = createEmptyLinks(this.lampCapacity);
    this.groupCounts = new Uint32Array(this.groupCapacity);
    this.roomHeadByRoom = createEmptyLinks(this.roomCapacity);
    this.roomNextByLamp = createEmptyLinks(this.lampCapacity);
    this.roomPreviousByLamp = createEmptyLinks(this.lampCapacity);
    this.roomCounts = new Uint32Array(this.roomCapacity);
    this.compositeHeadByKey = createEmptyLinks(this.compositeBucketCount);
    this.compositeNextByLamp = createEmptyLinks(this.lampCapacity);
    this.compositePreviousByLamp = createEmptyLinks(this.lampCapacity);
    this.compositeCounts = new Uint32Array(this.compositeBucketCount);
    this.dirtyQueued = new Uint8Array(this.lampCapacity);
    this.dirtyQueue = new Uint32Array(this.dirtyCapacity);
  }

  get indexVersion(): number {
    return this.indexVersionValue;
  }

  get sourceVersion(): number {
    return this.sourceVersionValue;
  }

  markLampDirty(lampId: number): M4LampMutationResult {
    if (!isIndexInRange(lampId, this.lampCapacity)) {
      return { ok: false, reason: "lamp_id_out_of_range" };
    }

    if ((this.dirtyQueued[lampId] ?? 0) === 0) {
      if (this.dirtyCount >= this.dirtyCapacity) {
        this.rebuildRequiredValue = true;
        this.missedDirtyCountValue += 1;
        return { ok: false, reason: "lamp_dirty_queue_full" };
      }

      const tail = (this.dirtyHead + this.dirtyCount) % this.dirtyCapacity;
      this.dirtyQueue[tail] = lampId;
      this.dirtyQueued[lampId] = 1;
      this.dirtyCount += 1;
      if (this.dirtyCount > this.dirtyPeak) {
        this.dirtyPeak = this.dirtyCount;
      }
    }

    return {
      ok: true,
      lampId,
      groupId: M4_LAMP_NONE,
      changed: false,
      ownerVersion: this.sourceVersionValue,
      lampVersion: 0,
      reason: "lamp.shadow_gap_changed",
    };
  }

  markMutationDirty(mutation: M4LampMutationResult): M4LampMutationResult {
    if (!mutation.ok || !mutation.changed) {
      return mutation;
    }

    const dirty = this.markLampDirty(mutation.lampId);
    if (!dirty.ok) {
      return dirty;
    }

    return mutation;
  }

  refreshDirty(store: M4LampNetworkStore, budget: number): M4LampGapRefreshResult {
    if (!isNonNegativeSafeInteger(budget)) {
      return { ok: false, reason: "lamp_gap_dirty_budget_invalid" };
    }

    let refreshed = 0;
    while (this.dirtyCount > 0 && refreshed < budget) {
      const lampId = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.dirtyCapacity;
      this.dirtyCount -= 1;
      this.dirtyQueued[lampId] = 0;
      this.refreshLamp(store, lampId);
      refreshed += 1;
    }

    if (refreshed > 0) {
      this.refreshedCountValue += refreshed;
      this.indexVersionValue += 1;
    }

    if (this.dirtyCount === 0 && !this.rebuildRequiredValue) {
      this.sourceVersionValue = store.ownerVersion;
    }

    return {
      ok: true,
      refreshedCount: refreshed,
      remainingCount: this.dirtyCount,
      sourceVersion: this.sourceVersionValue,
      indexVersion: this.indexVersionValue,
    };
  }

  rebuildFromStore(store: M4LampNetworkStore): M4LampGapIndexMetrics {
    this.clearIndex();
    let scanned = 0;

    for (let lampId = 0; lampId < this.lampCapacity; lampId += 1) {
      scanned += 1;
      if (store.isLampActive(lampId) && store.getLampShadowGap(lampId) > 0) {
        this.linkLamp(store, lampId);
      }
    }

    this.dirtyHead = 0;
    this.dirtyCount = 0;
    this.dirtyQueued.fill(0);
    this.rebuildRequiredValue = false;
    this.fullRebuildLampScans += scanned;
    this.rebuiltCountValue += 1;
    this.indexVersionValue += 1;
    this.sourceVersionValue = store.ownerVersion;
    return this.createMetrics();
  }

  queryActiveGaps(
    store: M4LampNetworkStore,
    query: M4LampGapQuery,
    outputLampIds: Uint32Array,
    traceStore?: M4LampGapTraceStore,
  ): M4LampGapQueryResult {
    void store;
    const validation = validateGapQuery(query, outputLampIds);
    if (!validation.ok) {
      return validation;
    }

    const scope = this.createQueryScope(query);
    if (!scope.ok) {
      return scope;
    }

    if (this.dirtyCount > 0) {
      return { ok: false, reason: "lamp_gap_index_dirty_backlog" };
    }

    if (this.rebuildRequiredValue) {
      return { ok: false, reason: "lamp_gap_index_rebuild_required" };
    }

    clearUint32(outputLampIds, query.maxSelectedLamps, M4_LAMP_NONE);
    let current = scope.head;
    let visited = 0;
    let selected = 0;
    let stoppedByCandidateCap = false;
    let stoppedBySelectedCap = false;

    while (current >= 0) {
      if (visited >= query.candidateCap) {
        stoppedByCandidateCap = true;
        break;
      }

      visited += 1;
      if (selected < query.maxSelectedLamps) {
        outputLampIds[selected] = current;
        selected += 1;
      } else {
        stoppedBySelectedCap = true;
      }

      current = scope.nextByLamp[current] ?? -1;
    }

    this.lastQueryVisitedCount = visited;
    this.totalQueryVisitedCount += visited;
    this.queryCount += 1;
    const selectedCapHit =
      stoppedBySelectedCap ||
      (selected === query.maxSelectedLamps &&
        scope.bucketCandidateCount > selected &&
        query.candidateCap > selected);
    const reason = readTraceReason(selected, stoppedByCandidateCap, selectedCapHit);
    const traceSequence =
      traceStore?.recordGapQuery({
        roomId: query.roomId ?? M4_LAMP_NONE,
        groupId: query.groupId ?? M4_LAMP_NONE,
        visitedCount: visited,
        selectedCount: selected,
        candidateCap: query.candidateCap,
        selectedCap: query.maxSelectedLamps,
        selectedLampId: selected > 0 ? (outputLampIds[0] ?? M4_LAMP_NONE) : M4_LAMP_NONE,
        candidateCapHit: stoppedByCandidateCap,
        selectedCapHit,
        sourceVersion: this.sourceVersionValue,
        indexVersion: this.indexVersionValue,
        reason,
      }) ?? 0;

    return {
      ok: true,
      selectedCount: selected,
      visitedCount: visited,
      candidateCapHit: stoppedByCandidateCap,
      selectedCapHit,
      sourceVersion: this.sourceVersionValue,
      indexVersion: this.indexVersionValue,
      traceSequence,
    };
  }

  createMetrics(): M4LampGapIndexMetrics {
    return {
      indexVersion: this.indexVersionValue,
      sourceVersion: this.sourceVersionValue,
      activeGapCount: this.activeGapCountValue,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
      rebuildRequired: this.rebuildRequiredValue,
      missedDirtyCount: this.missedDirtyCountValue,
      refreshedCount: this.refreshedCountValue,
      rebuiltCount: this.rebuiltCountValue,
      fullRebuildLampScans: this.fullRebuildLampScans,
      lastQueryVisitedCount: this.lastQueryVisitedCount,
      totalQueryVisitedCount: this.totalQueryVisitedCount,
      queryCount: this.queryCount,
    };
  }

  private refreshLamp(store: M4LampNetworkStore, lampId: number): void {
    if ((this.globalLinked[lampId] ?? 0) === 1) {
      this.unlinkLamp(lampId);
    }

    if (store.isLampActive(lampId) && store.getLampShadowGap(lampId) > 0) {
      this.linkLamp(store, lampId);
    }
  }

  private linkLamp(store: M4LampNetworkStore, lampId: number): void {
    const score = store.getLampShadowGap(lampId);
    this.scores[lampId] = score;
    this.lampVersions[lampId] = store.getLampVersion(lampId);
    const groupId = store.getLampGroupId(lampId);
    const roomId = store.getLampRoomId(lampId);
    this.indexedGroupIds[lampId] = groupId;
    this.indexedRoomIds[lampId] = roomId;
    this.globalHead = insertLampSorted(
      this.globalHead,
      this.globalNextByLamp,
      this.globalPreviousByLamp,
      this.globalLinked,
      this.scores,
      lampId,
      score,
    );

    if (isIndexInRange(groupId, this.groupCapacity)) {
      this.groupHeadByGroup[groupId] = insertLampSorted(
        this.groupHeadByGroup[groupId] ?? -1,
        this.groupNextByLamp,
        this.groupPreviousByLamp,
        this.groupLinked,
        this.scores,
        lampId,
        score,
      );
      this.groupCounts[groupId] = (this.groupCounts[groupId] ?? 0) + 1;
    }

    if (isIndexInRange(roomId, this.roomCapacity)) {
      this.roomHeadByRoom[roomId] = insertLampSorted(
        this.roomHeadByRoom[roomId] ?? -1,
        this.roomNextByLamp,
        this.roomPreviousByLamp,
        this.roomLinked,
        this.scores,
        lampId,
        score,
      );
      this.roomCounts[roomId] = (this.roomCounts[roomId] ?? 0) + 1;
    }

    if (isIndexInRange(groupId, this.groupCapacity) && isIndexInRange(roomId, this.roomCapacity)) {
      const key = this.createCompositeKey(groupId, roomId);
      this.compositeHeadByKey[key] = insertLampSorted(
        this.compositeHeadByKey[key] ?? -1,
        this.compositeNextByLamp,
        this.compositePreviousByLamp,
        this.compositeLinked,
        this.scores,
        lampId,
        score,
      );
      this.compositeCounts[key] = (this.compositeCounts[key] ?? 0) + 1;
    }

    this.activeGapCountValue += 1;
  }

  private unlinkLamp(lampId: number): void {
    const groupId = this.indexedGroupIds[lampId] ?? M4_LAMP_NONE;
    const roomId = this.indexedRoomIds[lampId] ?? M4_LAMP_NONE;
    this.globalHead = removeLampLinked(
      this.globalHead,
      this.globalNextByLamp,
      this.globalPreviousByLamp,
      this.globalLinked,
      lampId,
    );

    if (isIndexInRange(groupId, this.groupCapacity)) {
      this.groupHeadByGroup[groupId] = removeLampLinked(
        this.groupHeadByGroup[groupId] ?? -1,
        this.groupNextByLamp,
        this.groupPreviousByLamp,
        this.groupLinked,
        lampId,
      );
      this.groupCounts[groupId] = Math.max(0, (this.groupCounts[groupId] ?? 0) - 1);
    }

    if (isIndexInRange(roomId, this.roomCapacity)) {
      this.roomHeadByRoom[roomId] = removeLampLinked(
        this.roomHeadByRoom[roomId] ?? -1,
        this.roomNextByLamp,
        this.roomPreviousByLamp,
        this.roomLinked,
        lampId,
      );
      this.roomCounts[roomId] = Math.max(0, (this.roomCounts[roomId] ?? 0) - 1);
    }

    if (isIndexInRange(groupId, this.groupCapacity) && isIndexInRange(roomId, this.roomCapacity)) {
      const key = this.createCompositeKey(groupId, roomId);
      this.compositeHeadByKey[key] = removeLampLinked(
        this.compositeHeadByKey[key] ?? -1,
        this.compositeNextByLamp,
        this.compositePreviousByLamp,
        this.compositeLinked,
        lampId,
      );
      this.compositeCounts[key] = Math.max(0, (this.compositeCounts[key] ?? 0) - 1);
    }

    this.scores[lampId] = 0;
    this.lampVersions[lampId] = 0;
    this.indexedGroupIds[lampId] = M4_LAMP_NONE;
    this.indexedRoomIds[lampId] = M4_LAMP_NONE;
    this.activeGapCountValue -= 1;
  }

  private clearIndex(): void {
    this.globalLinked.fill(0);
    this.groupLinked.fill(0);
    this.roomLinked.fill(0);
    this.compositeLinked.fill(0);
    this.scores.fill(0);
    this.lampVersions.fill(0);
    this.indexedGroupIds.fill(M4_LAMP_NONE);
    this.indexedRoomIds.fill(M4_LAMP_NONE);
    this.globalNextByLamp.fill(-1);
    this.globalPreviousByLamp.fill(-1);
    this.groupHeadByGroup.fill(-1);
    this.groupNextByLamp.fill(-1);
    this.groupPreviousByLamp.fill(-1);
    this.groupCounts.fill(0);
    this.roomHeadByRoom.fill(-1);
    this.roomNextByLamp.fill(-1);
    this.roomPreviousByLamp.fill(-1);
    this.roomCounts.fill(0);
    this.compositeHeadByKey.fill(-1);
    this.compositeNextByLamp.fill(-1);
    this.compositePreviousByLamp.fill(-1);
    this.compositeCounts.fill(0);
    this.globalHead = -1;
    this.activeGapCountValue = 0;
  }

  private createQueryScope(query: M4LampGapQuery):
    | {
        readonly ok: true;
        readonly head: number;
        readonly nextByLamp: Int32Array;
        readonly bucketCandidateCount: number;
      }
    | { readonly ok: false; readonly reason: M4LampGapReason } {
    if (query.groupId !== undefined && !isIndexInRange(query.groupId, this.groupCapacity)) {
      return { ok: false, reason: "lamp_gap_group_out_of_range" };
    }

    if (query.roomId !== undefined && !isIndexInRange(query.roomId, this.roomCapacity)) {
      return { ok: false, reason: "lamp_gap_room_out_of_range" };
    }

    if (query.groupId !== undefined && query.roomId !== undefined) {
      const key = this.createCompositeKey(query.groupId, query.roomId);
      return {
        ok: true,
        head: this.compositeHeadByKey[key] ?? -1,
        nextByLamp: this.compositeNextByLamp,
        bucketCandidateCount: this.compositeCounts[key] ?? 0,
      };
    }

    if (query.groupId !== undefined) {
      return {
        ok: true,
        head: this.groupHeadByGroup[query.groupId] ?? -1,
        nextByLamp: this.groupNextByLamp,
        bucketCandidateCount: this.groupCounts[query.groupId] ?? 0,
      };
    }

    if (query.roomId !== undefined) {
      return {
        ok: true,
        head: this.roomHeadByRoom[query.roomId] ?? -1,
        nextByLamp: this.roomNextByLamp,
        bucketCandidateCount: this.roomCounts[query.roomId] ?? 0,
      };
    }

    return {
      ok: true,
      head: this.globalHead,
      nextByLamp: this.globalNextByLamp,
      bucketCandidateCount: this.activeGapCountValue,
    };
  }

  private createCompositeKey(groupId: number, roomId: number): number {
    return groupId * this.roomCapacity + roomId;
  }
}

export class M4LampGapTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly roomIds: Uint32Array;
  private readonly groupIds: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly selectedCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedCaps: Uint32Array;
  private readonly selectedLampIds: Uint32Array;
  private readonly candidateCapHits: Uint8Array;
  private readonly selectedCapHits: Uint8Array;
  private readonly sourceVersions: Uint32Array;
  private readonly indexVersions: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity: number) {
    this.capacity = requirePositiveSafeInteger(capacity, "lamp gap trace capacity");
    this.sequences = new Uint32Array(capacity);
    this.roomIds = new Uint32Array(capacity);
    this.groupIds = new Uint32Array(capacity);
    this.visitedCounts = new Uint32Array(capacity);
    this.selectedCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedCaps = new Uint32Array(capacity);
    this.selectedLampIds = new Uint32Array(capacity);
    this.selectedLampIds.fill(M4_LAMP_NONE);
    this.candidateCapHits = new Uint8Array(capacity);
    this.selectedCapHits = new Uint8Array(capacity);
    this.sourceVersions = new Uint32Array(capacity);
    this.indexVersions = new Uint32Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
  }

  recordGapQuery(input: M4LampGapTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;

    this.sequences[slot] = sequence;
    this.roomIds[slot] = input.roomId;
    this.groupIds[slot] = input.groupId;
    this.visitedCounts[slot] = input.visitedCount;
    this.selectedCounts[slot] = input.selectedCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedCaps[slot] = input.selectedCap;
    this.selectedLampIds[slot] = input.selectedLampId;
    this.candidateCapHits[slot] = input.candidateCapHit ? 1 : 0;
    this.selectedCapHits[slot] = input.selectedCapHit ? 1 : 0;
    this.sourceVersions[slot] = input.sourceVersion;
    this.indexVersions[slot] = input.indexVersion;
    this.reasonCodes[slot] = encodeTraceReason(input.reason);
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): M4LampGapTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }

    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    return {
      sequence: this.sequences[slot] ?? 0,
      roomId: this.roomIds[slot] ?? M4_LAMP_NONE,
      groupId: this.groupIds[slot] ?? M4_LAMP_NONE,
      visitedCount: this.visitedCounts[slot] ?? 0,
      selectedCount: this.selectedCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedCap: this.selectedCaps[slot] ?? 0,
      selectedLampId: this.selectedLampIds[slot] ?? M4_LAMP_NONE,
      candidateCapHit: (this.candidateCapHits[slot] ?? 0) === 1,
      selectedCapHit: (this.selectedCapHits[slot] ?? 0) === 1,
      sourceVersion: this.sourceVersions[slot] ?? 0,
      indexVersion: this.indexVersions[slot] ?? 0,
      reason: decodeTraceReason(this.reasonCodes[slot] ?? 0),
    };
  }

  createMetrics(): M4LampGapTraceMetrics {
    return {
      capacity: this.capacity,
      storedCount: this.stored,
      nextSequence: this.nextSequence,
      backlogCount: 0,
    };
  }
}

export function createM4LampGapIndex(options: M4LampGapIndexOptions): M4LampGapIndex {
  return new M4LampGapIndex(options);
}

export function createM4LampGapTraceStore(capacity: number): M4LampGapTraceStore {
  return new M4LampGapTraceStore(capacity);
}

function validateGapQuery(
  query: M4LampGapQuery,
  outputLampIds: Uint32Array,
): { readonly ok: true } | { readonly ok: false; readonly reason: M4LampGapReason } {
  if (!isPositiveSafeInteger(query.candidateCap)) {
    return { ok: false, reason: "lamp_gap_candidate_cap_invalid" };
  }

  if (!isPositiveSafeInteger(query.maxSelectedLamps)) {
    return { ok: false, reason: "lamp_gap_selected_cap_invalid" };
  }

  if (outputLampIds.length < query.maxSelectedLamps) {
    return { ok: false, reason: "lamp_gap_output_too_small" };
  }

  return { ok: true };
}

function isGapBefore(
  currentLampId: number,
  nextLampId: number,
  nextScore: number,
  scores: Uint32Array,
): boolean {
  const currentScore = scores[currentLampId] ?? 0;

  if (currentScore !== nextScore) {
    return currentScore > nextScore;
  }

  return currentLampId < nextLampId;
}

function readTraceReason(
  selected: number,
  candidateCapHit: boolean,
  selectedCapHit: boolean,
): M4LampGapTraceReason {
  if (candidateCapHit) {
    return "trace.candidate_cap_reached";
  }

  if (selectedCapHit) {
    return "trace.selected_cap_reached";
  }

  if (selected === 0) {
    return "lamp_gap_no_candidate";
  }

  return "lamp_gap_candidates_indexed";
}

function clearUint32(values: Uint32Array, count: number, fill: number): void {
  for (let index = 0; index < count; index += 1) {
    values[index] = fill;
  }
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

function insertLampSorted(
  head: number,
  nextByLamp: Int32Array,
  previousByLamp: Int32Array,
  linked: Uint8Array,
  scores: Uint32Array,
  lampId: number,
  score: number,
): number {
  let current = head;
  let previous = -1;

  while (current >= 0 && isGapBefore(current, lampId, score, scores)) {
    previous = current;
    current = nextByLamp[current] ?? -1;
  }

  previousByLamp[lampId] = previous;
  nextByLamp[lampId] = current;

  if (previous >= 0) {
    nextByLamp[previous] = lampId;
  } else {
    head = lampId;
  }

  if (current >= 0) {
    previousByLamp[current] = lampId;
  }

  linked[lampId] = 1;
  return head;
}

function removeLampLinked(
  head: number,
  nextByLamp: Int32Array,
  previousByLamp: Int32Array,
  linked: Uint8Array,
  lampId: number,
): number {
  if ((linked[lampId] ?? 0) === 0) {
    return head;
  }

  const previous = previousByLamp[lampId] ?? -1;
  const next = nextByLamp[lampId] ?? -1;

  if (previous >= 0) {
    nextByLamp[previous] = next;
  } else {
    head = next;
  }

  if (next >= 0) {
    previousByLamp[next] = previous;
  }

  nextByLamp[lampId] = -1;
  previousByLamp[lampId] = -1;
  linked[lampId] = 0;
  return head;
}

function encodeTraceReason(reason: M4LampGapTraceReason): number {
  if (reason === "lamp_gap_no_candidate") {
    return 1;
  }

  if (reason === "trace.candidate_cap_reached") {
    return 2;
  }

  if (reason === "trace.selected_cap_reached") {
    return 3;
  }

  return 0;
}

function decodeTraceReason(code: number): M4LampGapTraceReason {
  if (code === 1) {
    return "lamp_gap_no_candidate";
  }

  if (code === 2) {
    return "trace.candidate_cap_reached";
  }

  if (code === 3) {
    return "trace.selected_cap_reached";
  }

  return "lamp_gap_candidates_indexed";
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function requirePositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}
