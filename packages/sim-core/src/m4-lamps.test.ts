import { describe, expect, it } from "vitest";

import { createMapGrid } from "./map-grid";
import {
  M4_LAMP_DEFAULT_DIRTY_DRAIN_BUDGET,
  M4_LAMP_MAINTENANCE_NEEDS_FUEL,
  M4_LAMP_MAINTENANCE_OK,
  M4_LAMP_TAG_BOUNDARY,
  M4_LAMP_TAG_ROAD,
  createM4LampNetworkStore,
  type M4LampDirtyKeyOutput,
  type M4LampDirtyKeyView,
  type M4LampNetworkStore,
  type M4LampRegisterInput,
} from "./m4-lamp-network";
import {
  M4_LAMP_GAP_DEFAULT_CANDIDATE_CAP,
  M4_LAMP_GAP_DEFAULT_SELECTED_CAP,
  createM4LampGapIndex,
  createM4LampGapTraceStore,
} from "./m4-lamp-gap-index";

describe("M4 authoritative lamp network owner store", () => {
  it("owns integer lamp rule fields and drains deterministic exact dirty keys", () => {
    const first = createLampFixture(8);
    const second = createLampFixture(8);
    drainDirty(first.store, 8);
    drainDirty(second.store, 8);

    const mutation = first.store.setRuleFields({
      lampId: 2,
      fuel: 410,
      wick: 730,
      damage: 90,
      maintenanceState: M4_LAMP_MAINTENANCE_NEEDS_FUEL,
      humanClaim: 220,
      shadowGap: 510,
      reason: "lamp.shadow_gap_changed",
    });
    const replayMutation = second.store.setRuleFields({
      lampId: 2,
      fuel: 410,
      wick: 730,
      damage: 90,
      maintenanceState: M4_LAMP_MAINTENANCE_NEEDS_FUEL,
      humanClaim: 220,
      shadowGap: 510,
      reason: "lamp.shadow_gap_changed",
    });

    expect(mutation).toMatchObject({
      ok: true,
      lampId: 2,
      groupId: 1,
      changed: true,
      reason: "lamp.shadow_gap_changed",
    });
    expect(replayMutation).toEqual(mutation);

    const dirty = drainDirty(first.store, M4_LAMP_DEFAULT_DIRTY_DRAIN_BUDGET);
    const replayDirty = drainDirty(second.store, M4_LAMP_DEFAULT_DIRTY_DRAIN_BUDGET);
    expect(dirty).toEqual(replayDirty);
    expect(dirty).toEqual([
      {
        sequence: 9,
        lampId: 2,
        groupId: 1,
        cellIndex: 10,
        roomId: 102,
        chunkIndex: 0,
        projectionKey: 3,
        lampVersion: 11,
        ownerVersion: 11,
        reason: "lamp.shadow_gap_changed",
      },
    ]);
    expect(first.store.readLamp(2)).toMatchObject({
      fuel: 410,
      wick: 730,
      damage: 90,
      maintenanceState: M4_LAMP_MAINTENANCE_NEEDS_FUEL,
      humanClaim: 220,
      shadowGap: 510,
      ownerVersion: 11,
    });
    expect(first.store.createMetrics()).toMatchObject({
      dirtyBacklog: 0,
      dirtyBacklogPeak: 8,
      dirtyDrainCount: 2,
      dirtyDrainedKeyCount: 9,
      normalTickVisitedLampCount: 1,
      normalTickVisitedCellCount: 1,
      fullMapDiffusionCount: 0,
    });
  });

  it("keeps visual projections read-only and rejects stale projection bases", () => {
    const { store } = createLampFixture(4);
    drainDirty(store, 8);
    const projection = store.createVisualProjection();
    expect(projection.readOnly).toBe(true);
    expect(projection.rowCount).toBe(4);
    expect(projection.rows[1]).toMatchObject({
      lampId: 1,
      visualLight: 600,
      basisLampVersion: 4,
    });

    expect(store.rejectVisualProjectionMutation()).toEqual({
      ok: false,
      reason: "lamp_projection_read_only",
    });
    expect(
      store.setRuleFields({
        lampId: 1,
        humanClaim: 250,
        shadowGap: 440,
        reason: "lamp.human_claim_changed",
      }),
    ).toMatchObject({ ok: true, changed: true });
    expect(store.validateProjectionBasis(projection)).toEqual({
      ok: false,
      reason: "lamp_projection_stale_basis",
    });
    expect(store.readLamp(1)).toMatchObject({ humanClaim: 250, shadowGap: 440 });
  });

  it("reports structured reasons for invalid commands and bounded dirty outputs", () => {
    const store = createM4LampNetworkStore({ lampCapacity: 2, groupCapacity: 2, dirtyCapacity: 1 });
    expect(store.registerLamp(createLampInput({ lampId: 0, groupId: 1 }))).toEqual({
      ok: false,
      reason: "lamp_group_not_registered",
    });
    expect(store.registerGroup(1)).toMatchObject({ ok: true });
    expect(store.registerLamp(createLampInput({ lampId: 0, groupId: 1 }))).toMatchObject({
      ok: true,
    });
    expect(
      store.setRuleFields({
        lampId: 0,
        shadowGap: -1,
        reason: "lamp.shadow_gap_changed",
      }),
    ).toEqual({ ok: false, reason: "lamp_value_out_of_range" });
    expect(store.processDirtyLamps(2, new Array<M4LampDirtyKeyOutput>(1))).toEqual({
      ok: false,
      reason: "lamp_dirty_output_too_small",
    });
    expect(store.registerLamp(createLampInput({ lampId: 1, groupId: 1 }))).toEqual({
      ok: false,
      reason: "lamp_dirty_queue_full",
    });
    expect(store.createMetrics()).toMatchObject({ activeLampCount: 1, dirtyBacklog: 1 });
  });
});

describe("M4 lamp gap index", () => {
  it("returns active shadow-gap candidates through indexed Top-K caps", () => {
    const { store } = createLampFixture(30);
    const index = createM4LampGapIndex({ lampCapacity: 30 });
    const traces = createM4LampGapTraceStore(4);
    const output = new Uint32Array(M4_LAMP_GAP_DEFAULT_SELECTED_CAP);

    expect(index.rebuildFromStore(store)).toMatchObject({
      activeGapCount: 30,
      fullRebuildLampScans: 30,
      sourceVersion: 32,
    });
    expect(
      index.queryActiveGaps(
        store,
        {
          candidateCap: M4_LAMP_GAP_DEFAULT_CANDIDATE_CAP,
          maxSelectedLamps: M4_LAMP_GAP_DEFAULT_SELECTED_CAP,
        },
        output,
        traces,
      ),
    ).toEqual({
      ok: true,
      selectedCount: 12,
      visitedCount: 24,
      candidateCapHit: true,
      selectedCapHit: true,
      sourceVersion: 32,
      indexVersion: 1,
      traceSequence: 1,
    });
    expect([...output]).toEqual([29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18]);
    expect(traces.readNewest(0)).toMatchObject({
      selectedLampId: 29,
      reason: "trace.candidate_cap_reached",
      candidateCapHit: true,
    });
  });

  it("rejects stale gap reads until exact dirty lamp refresh drains", () => {
    const { store } = createLampFixture(8);
    const index = createM4LampGapIndex({ lampCapacity: 8 });
    const output = new Uint32Array(4);
    expect(index.rebuildFromStore(store)).toMatchObject({ sourceVersion: 10 });

    const mutation = store.setRuleFields({
      lampId: 2,
      shadowGap: 1_000,
      reason: "lamp.shadow_gap_changed",
    });
    expect(index.markMutationDirty(mutation)).toEqual(mutation);
    expect(
      index.queryActiveGaps(
        store,
        {
          candidateCap: 8,
          maxSelectedLamps: 4,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "lamp_gap_index_dirty_backlog" });

    expect(index.refreshDirty(store, 1)).toEqual({
      ok: true,
      refreshedCount: 1,
      remainingCount: 0,
      sourceVersion: 11,
      indexVersion: 2,
    });
    expect(
      index.queryActiveGaps(
        store,
        {
          candidateCap: 8,
          maxSelectedLamps: 4,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 4,
      visitedCount: 8,
      candidateCapHit: false,
      sourceVersion: 11,
    });
    expect([...output]).toEqual([2, 7, 6, 5]);
    expect(index.createMetrics()).toMatchObject({
      dirtyBacklog: 0,
      dirtyBacklogPeak: 1,
      refreshedCount: 1,
      fullRebuildLampScans: 8,
    });
  });

  it("requires rebuild instead of publishing stale source after dirty overflow", () => {
    const { store } = createLampFixture(3);
    const index = createM4LampGapIndex({ lampCapacity: 3, dirtyCapacity: 1 });
    const output = new Uint32Array(3);
    expect(index.rebuildFromStore(store)).toMatchObject({
      activeGapCount: 3,
      sourceVersion: 5,
    });

    const firstMutation = store.setRuleFields({
      lampId: 0,
      shadowGap: 700,
      reason: "lamp.shadow_gap_changed",
    });
    expect(index.markMutationDirty(firstMutation)).toEqual(firstMutation);
    const missedMutation = store.setRuleFields({
      lampId: 1,
      shadowGap: 900,
      reason: "lamp.shadow_gap_changed",
    });
    expect(index.markMutationDirty(missedMutation)).toEqual({
      ok: false,
      reason: "lamp_dirty_queue_full",
    });

    expect(index.refreshDirty(store, 1)).toEqual({
      ok: true,
      refreshedCount: 1,
      remainingCount: 0,
      sourceVersion: 5,
      indexVersion: 2,
    });
    expect(
      index.queryActiveGaps(
        store,
        {
          candidateCap: 3,
          maxSelectedLamps: 3,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "lamp_gap_index_rebuild_required" });
    expect(index.createMetrics()).toMatchObject({
      rebuildRequired: true,
      missedDirtyCount: 1,
    });

    expect(index.rebuildFromStore(store)).toMatchObject({
      rebuildRequired: false,
      sourceVersion: store.ownerVersion,
    });
    expect(
      index.queryActiveGaps(
        store,
        {
          candidateCap: 3,
          maxSelectedLamps: 3,
        },
        output,
      ),
    ).toMatchObject({ ok: true, selectedCount: 3, sourceVersion: store.ownerVersion });
    expect([...output]).toEqual([1, 0, 2]);
  });

  it("uses scoped room and group buckets before applying candidate caps", () => {
    const store = createScopedLampStore();
    const index = createM4LampGapIndex({
      lampCapacity: 6,
      groupCapacity: 3,
      roomCapacity: 10,
    });
    const traces = createM4LampGapTraceStore(4);
    const output = new Uint32Array(3);
    expect(index.rebuildFromStore(store)).toMatchObject({ activeGapCount: 6 });

    expect(
      index.queryActiveGaps(
        store,
        {
          roomId: 7,
          candidateCap: 2,
          maxSelectedLamps: 2,
        },
        output,
      ),
    ).toEqual({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      candidateCapHit: false,
      selectedCapHit: false,
      sourceVersion: store.ownerVersion,
      indexVersion: 1,
      traceSequence: 0,
    });
    expect([...output.slice(0, 2)]).toEqual([0, 1]);

    expect(
      index.queryActiveGaps(
        store,
        {
          groupId: 1,
          candidateCap: 3,
          maxSelectedLamps: 3,
        },
        output,
      ),
    ).toMatchObject({ ok: true, selectedCount: 3, visitedCount: 3 });
    expect([...output]).toEqual([0, 1, 5]);

    expect(
      index.queryActiveGaps(
        store,
        {
          groupId: 1,
          roomId: 7,
          candidateCap: 3,
          maxSelectedLamps: 1,
        },
        output,
        traces,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 2,
      candidateCapHit: false,
      selectedCapHit: true,
      traceSequence: 1,
    });
    expect(traces.readNewest(0)).toMatchObject({
      selectedLampId: 0,
      reason: "trace.selected_cap_reached",
      selectedCapHit: true,
    });
  });

  it("does not perform full-map normal-tick diffusion for lamp dirty work", () => {
    const { store } = createLampFixture(16);
    const index = createM4LampGapIndex({ lampCapacity: 16 });
    drainDirty(store, 32);
    expect(index.rebuildFromStore(store)).toMatchObject({ fullRebuildLampScans: 16 });

    const mutation = store.setRuleFields({
      lampId: 9,
      humanClaim: 0,
      shadowGap: 900,
      reason: "lamp.human_claim_changed",
    });
    expect(index.markMutationDirty(mutation)).toEqual(mutation);
    const dirty = drainDirty(store, 32);
    expect(dirty).toHaveLength(1);
    expect(index.refreshDirty(store, 1)).toMatchObject({
      ok: true,
      refreshedCount: 1,
    });
    expect(store.createMetrics()).toMatchObject({
      normalTickVisitedLampCount: 1,
      normalTickVisitedCellCount: 1,
      fullMapDiffusionCount: 0,
    });
    expect(index.createMetrics()).toMatchObject({
      refreshedCount: 1,
      fullRebuildLampScans: 16,
      lastQueryVisitedCount: 0,
    });
  });
});

function createLampFixture(lampCount: number): { readonly store: M4LampNetworkStore } {
  const map = createMapGrid({ width: 8, height: 8, chunkSize: 4 });
  for (let lampId = 0; lampId < lampCount; lampId += 1) {
    const cellIndex = 8 + lampId;
    expect(map.updateCellByIndex(cellIndex, { roomId: 100 + lampId })).toMatchObject({
      ok: true,
      changed: true,
    });
  }

  const store = createM4LampNetworkStore({
    lampCapacity: lampCount,
    groupCapacity: 4,
    dirtyCapacity: lampCount,
  });
  expect(store.registerGroup(1)).toMatchObject({ ok: true });
  expect(store.registerGroup(2)).toMatchObject({ ok: true });

  for (let lampId = 0; lampId < lampCount; lampId += 1) {
    expect(
      store.registerLampAtMapCell({
        ...createLampInput({
          lampId,
          groupId: lampId < 4 ? 1 : 2,
          cellIndex: 8 + lampId,
          shadowGap: 100 + lampId,
        }),
        map,
      }),
    ).toMatchObject({ ok: true });
  }

  return { store };
}

function createScopedLampStore(): M4LampNetworkStore {
  const store = createM4LampNetworkStore({
    lampCapacity: 6,
    groupCapacity: 3,
    dirtyCapacity: 6,
  });
  expect(store.registerGroup(1)).toMatchObject({ ok: true });
  expect(store.registerGroup(2)).toMatchObject({ ok: true });
  const lamps: readonly M4LampRegisterInput[] = [
    createLampInput({ lampId: 0, groupId: 1, roomId: 7, shadowGap: 10 }),
    createLampInput({ lampId: 1, groupId: 1, roomId: 7, shadowGap: 9 }),
    createLampInput({ lampId: 2, groupId: 2, roomId: 8, shadowGap: 100 }),
    createLampInput({ lampId: 3, groupId: 2, roomId: 8, shadowGap: 99 }),
    createLampInput({ lampId: 4, groupId: 2, roomId: 8, shadowGap: 98 }),
    createLampInput({ lampId: 5, groupId: 1, roomId: 9, shadowGap: 8 }),
  ];

  for (const lamp of lamps) {
    expect(store.registerLamp(lamp)).toMatchObject({ ok: true });
  }

  return store;
}

function createLampInput(overrides: Partial<M4LampRegisterInput> = {}): M4LampRegisterInput {
  return {
    lampId: 0,
    groupId: 1,
    cellIndex: 8,
    roomId: 100,
    chunkIndex: 0,
    tagMask: M4_LAMP_TAG_ROAD | M4_LAMP_TAG_BOUNDARY,
    fuel: 800,
    wick: 700,
    damage: 0,
    maintenanceState: M4_LAMP_MAINTENANCE_OK,
    humanClaim: 600,
    shadowGap: 100,
    ...overrides,
  };
}

function drainDirty(store: M4LampNetworkStore, budget: number): M4LampDirtyKeyView[] {
  const output: M4LampDirtyKeyOutput[] = [];
  for (let index = 0; index < budget; index += 1) {
    output.push(createEmptyDirtyKey());
  }
  const result = store.processDirtyLamps(budget, output);
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) {
    return [];
  }

  return output.slice(0, result.processedCount);
}

function createEmptyDirtyKey(): M4LampDirtyKeyView {
  return {
    sequence: 0,
    lampId: 0,
    groupId: 0,
    cellIndex: 0,
    roomId: 0,
    chunkIndex: 0,
    projectionKey: 0,
    lampVersion: 0,
    ownerVersion: 0,
    reason: "lamp.registered",
  };
}
