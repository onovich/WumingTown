import { describe, expect, it } from "vitest";

import { initializeGameSessionRuntime } from "./game-session-runtime";

import {
  NEED_ACTOR_NONE,
  NEED_LANE_COMFORT,
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_LANE_SOCIAL,
  M3_NEED_STORE_SNAPSHOT_VERSION,
  calculateNeedUrgencyBucket,
  commitPreparedChangedNeedLaneMutation,
  commitPreparedNoopNeedLaneMutation,
  createNeedStore,
  createNeedStoreHashFields,
  createNeedUrgencyIndex,
  createNeedUrgencyTraceStore,
  isReachableNeedPhaseResidue,
  restoreNeedStore,
  type NeedLane,
  type NeedLaneIntoOutput,
  type NeedLaneMutationPrepareInput,
  type NeedStore,
  type NeedUrgencyIndex,
  type PreparedNeedLaneMutation,
} from "./m3-needs";

describe("M3 NeedStore", () => {
  it("prepares exact lane versions before a non-failing autonomous commit", () => {
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 8 });
    store.registerActor(createActor({ actorId: 1, hunger: 300 }));
    const prepared = preparedNeedMutation();
    store.prepareLaneDeltaInto(
      {
        actorId: 1,
        lane: NEED_LANE_HUNGER,
        tick: 5,
        reason: "need.external_delta",
        expectedStoreVersion: store.version,
        expectedLaneVersion: store.readLaneOwnerVersion(1, NEED_LANE_HUNGER),
        expectedValue: 300,
        delta: 40,
      },
      prepared,
    );
    expect(prepared).toMatchObject({ ok: true, previousValue: 300, nextValue: 340 });
    commitPreparedChangedNeedLaneMutation(store, prepared);
    expect(store.readLaneValue(1, NEED_LANE_HUNGER)).toBe(340);
    store.prepareLaneDeltaInto(
      {
        actorId: 1,
        lane: NEED_LANE_HUNGER,
        tick: 6,
        reason: "need.external_delta",
        expectedStoreVersion: 1,
        expectedLaneVersion: 1,
        expectedValue: 300,
        delta: 40,
      },
      prepared,
    );
    expect(prepared).toMatchObject({ ok: false });
    expect(store.readLaneValue(1, NEED_LANE_HUNGER)).toBe(340);
  });

  it("fully resets reused prepare output and classifies malformed or stale bases", () => {
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 8 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 300 }))).toMatchObject({
      ok: true,
    });
    const output = preparedNeedMutation();
    const identity = output;
    const valid = {
      actorId: 0,
      lane: NEED_LANE_HUNGER,
      tick: 1,
      reason: "need.external_delta" as const,
      sourceSystemId: 1,
      sourceEventId: 2,
      expectedStoreVersion: 1,
      expectedLaneVersion: 1,
      expectedValue: 300,
      delta: 1,
    };
    const cases = [
      [{ ...valid, actorId: 2 }, "need_actor_out_of_range"],
      [{ ...valid, actorId: 1 }, "need_actor_not_registered"],
      [{ ...valid, lane: 5 }, "need_lane_out_of_range"],
      [{ ...valid, tick: -1 }, "need_tick_invalid"],
      [{ ...valid, sourceSystemId: -1 }, "need_source_invalid"],
      [{ ...valid, sourceEventId: 0x1_0000_0000 }, "need_source_invalid"],
      [{ ...valid, expectedStoreVersion: 0 }, "need_basis_mismatch"],
      [{ ...valid, expectedLaneVersion: 0 }, "need_basis_mismatch"],
      [{ ...valid, expectedValue: 301 }, "need_basis_mismatch"],
      [{ ...valid, delta: 0x8000_0000 }, "need_delta_out_of_range"],
    ] as const;
    for (const [input, reason] of cases) {
      poisonPreparedNeedMutation(output);
      const before = store.createSnapshot();
      callPrepareNeedForTest(store, input, output);
      expect(output).toStrictEqual({ ...preparedNeedMutation(), reason });
      expect(output).toBe(identity);
      expect(store.createSnapshot()).toStrictEqual(before);
    }
  });

  it("rejects stale ticks and all owner-derived reasons through the prepare root", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 4 });
    expect(store.registerActor(createActor({ actorId: 0, sourceTick: 5 }))).toMatchObject({
      ok: true,
    });
    const output = preparedNeedMutation();
    const base: NeedLaneMutationPrepareInput = {
      actorId: 0,
      lane: NEED_LANE_HUNGER,
      tick: 5,
      reason: "need.external_delta" as const,
      expectedStoreVersion: 1,
      expectedLaneVersion: 1,
      expectedValue: 360,
      delta: 1,
    };
    store.prepareLaneDeltaInto({ ...base, tick: 4 }, output);
    expect(output).toStrictEqual({ ...preparedNeedMutation(), reason: "need_tick_invalid" });
    for (const reason of [
      "need.initialized",
      "need.scheduled_decay",
      "need.clamped_min",
      "need.clamped_max",
    ] as const) {
      poisonPreparedNeedMutation(output);
      callPrepareNeedForTest(store, { ...base, reason }, output);
      expect(output).toStrictEqual({ ...preparedNeedMutation(), reason: "need_source_invalid" });
    }
  });

  it("prepares and commits an authoritative clamp noop at MAX without owner writes", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 4 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 0 }))).toMatchObject({ ok: true });
    Reflect.set(store, "storeVersion", 0xffff_ffff);
    const laneVersions: unknown = Reflect.get(store, "laneVersions");
    if (!(laneVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    laneVersions[0] = 0xffff_ffff;
    const before = store.createSnapshot();
    const output = preparedNeedMutation();
    const identity = output;
    store.prepareLaneDeltaInto(
      {
        actorId: 0,
        lane: NEED_LANE_HUNGER,
        tick: 1,
        reason: "need.external_delta",
        expectedStoreVersion: 0xffff_ffff,
        expectedLaneVersion: 0xffff_ffff,
        expectedValue: 0,
        delta: -1,
      },
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      changed: false,
      reasonCode: 4,
      previousStoreVersion: 0xffff_ffff,
      nextStoreVersion: 0xffff_ffff,
      previousLaneVersion: 0xffff_ffff,
      nextLaneVersion: 0xffff_ffff,
    });
    expect(output).toBe(identity);
    commitPreparedNoopNeedLaneMutation(store, output);
    expect(store.createSnapshot()).toStrictEqual(before);
  });

  it("prepares a changed FFFE to FFFF commit and rejects exhausted prepare bases", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 4 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 300 }))).toMatchObject({
      ok: true,
    });
    const laneVersions: unknown = Reflect.get(store, "laneVersions");
    if (!(laneVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    Reflect.set(store, "storeVersion", 0xffff_fffe);
    laneVersions[0] = 0xffff_fffe;
    const prepared = preparedNeedMutation();
    store.prepareLaneDeltaInto(
      {
        actorId: 0,
        lane: NEED_LANE_HUNGER,
        tick: 1,
        reason: "need.external_delta",
        expectedStoreVersion: 0xffff_fffe,
        expectedLaneVersion: 0xffff_fffe,
        expectedValue: 300,
        delta: 1,
      },
      prepared,
    );
    expect(prepared).toMatchObject({
      ok: true,
      changed: true,
      nextStoreVersion: 0xffff_ffff,
      nextLaneVersion: 0xffff_ffff,
    });
    commitPreparedChangedNeedLaneMutation(store, prepared);
    expect(store.createSnapshot()).toMatchObject({
      storeVersion: 0xffff_ffff,
      values: [301, 500, 650, 520, 700],
      laneVersions: [0xffff_ffff, 1, 1, 1, 1],
    });
    const before = store.createSnapshot();
    store.prepareLaneDeltaInto(
      {
        actorId: 0,
        lane: NEED_LANE_HUNGER,
        tick: 2,
        reason: "need.external_delta",
        expectedStoreVersion: 0xffff_ffff,
        expectedLaneVersion: 0xffff_ffff,
        expectedValue: 301,
        delta: 1,
      },
      prepared,
    );
    expect(prepared).toStrictEqual({ ...preparedNeedMutation(), reason: "need_version_exhausted" });
    expect(store.createSnapshot()).toStrictEqual(before);

    const laneOnly = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 4 });
    expect(laneOnly.registerActor(createActor({ actorId: 0 }))).toMatchObject({ ok: true });
    const laneOnlyVersions: unknown = Reflect.get(laneOnly, "laneVersions");
    if (!(laneOnlyVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    laneOnlyVersions[0] = 0xffff_ffff;
    const laneOnlyBefore = laneOnly.createSnapshot();
    laneOnly.prepareLaneDeltaInto(
      {
        actorId: 0,
        lane: NEED_LANE_HUNGER,
        tick: 1,
        reason: "need.external_delta",
        expectedStoreVersion: 1,
        expectedLaneVersion: 0xffff_ffff,
        expectedValue: 360,
        delta: 1,
      },
      prepared,
    );
    expect(prepared).toStrictEqual({ ...preparedNeedMutation(), reason: "need_version_exhausted" });
    expect(laneOnly.createSnapshot()).toStrictEqual(laneOnlyBefore);
  });

  it("allows one final register or lane bump and rejects exhausted writes atomically", () => {
    const register = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4 });
    Reflect.set(register, "storeVersion", 0xffff_fffe);
    expect(register.registerActor(createActor({ actorId: 0 }))).toMatchObject({
      ok: true,
      ownerVersion: 0xffff_ffff,
    });
    expect(register.createSnapshot()).toMatchObject({
      actorCount: 1,
      storeVersion: 0xffff_ffff,
      laneVersions: [
        0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0, 0, 0, 0, 0,
      ],
    });
    const registerBefore = register.createSnapshot();
    expect(register.registerActor(createActor({ actorId: 1 }))).toStrictEqual({
      ok: false,
      reason: "need_version_exhausted",
    });
    expect(register.createSnapshot()).toStrictEqual(registerBefore);

    const mutation = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 4 });
    expect(mutation.registerActor(createActor({ actorId: 0, hunger: 100 }))).toMatchObject({
      ok: true,
    });
    Reflect.set(mutation, "storeVersion", 0xffff_fffe);
    const laneVersions: unknown = Reflect.get(mutation, "laneVersions");
    if (!(laneVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    laneVersions[0] = 0xffff_fffe;
    expect(mutation.applyLaneDelta(changeInput(0, NEED_LANE_HUNGER, 1), 1)).toMatchObject({
      ok: true,
      ownerVersion: 0xffff_ffff,
    });
    const mutationBefore = mutation.createSnapshot();
    expect(mutation.setLane(changeInput(0, NEED_LANE_HUNGER, 2), 102)).toStrictEqual({
      ok: false,
      reason: "need_version_exhausted",
    });
    expect(mutation.createSnapshot()).toStrictEqual(mutationBefore);
  });
  it("owns fixed integer lanes and exposes O(1) actor self reads", () => {
    const store = createNeedStore({ actorCapacity: 4, updateIntervalTicks: 8 });

    expect(store.registerActor(createActor({ actorId: 1, hunger: 320, rest: 420 }))).toMatchObject({
      ok: true,
      ownerVersion: 1,
      reason: "need.initialized",
    });

    expect(store.readActorNeeds(1)).toEqual({
      actorId: 1,
      hunger: 320,
      rest: 420,
      comfort: 650,
      social: 520,
      safety: 700,
      ownerVersion: 1,
    });
    expect(store.readLaneValue(1, NEED_LANE_HUNGER)).toBe(320);
    expect(store.readLaneValue(1, NEED_LANE_REST)).toBe(420);
    expect(store.readLaneValue(1, NEED_LANE_COMFORT)).toBe(650);
    expect(store.readLaneValue(1, NEED_LANE_SOCIAL)).toBe(520);
    expect(store.readLaneValue(1, NEED_LANE_SAFETY)).toBe(700);
    expect(store.readActorNeeds(3)).toBeUndefined();
  });

  it("reuses and fully resets caller-owned lane reads including actor and lane zero", () => {
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 321 }))).toMatchObject({
      ok: true,
    });
    const output = poisonedLaneOutput();
    const identity = output;
    store.readLaneInto(0, NEED_LANE_HUNGER, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      active: true,
      actorId: 0,
      lane: NEED_LANE_HUNGER,
      value: 321,
      updatePhase: 0,
      laneVersion: 1,
      storeVersion: 1,
      sourceTick: 0,
      sourceSystemId: 0,
      sourceEventId: 0,
      previousValue: 321,
      delta: 0,
      changeReason: "need.initialized",
    });
    expect(output).toBe(identity);
    for (const actorId of [-1, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      poisonLaneOutput(output);
      store.readLaneInto(actorId, NEED_LANE_HUNGER, output);
      expect(output).toStrictEqual({
        ok: false,
        reason: "need_actor_out_of_range",
        active: false,
        actorId: 0,
        lane: NEED_LANE_HUNGER,
        value: 0,
        updatePhase: 0,
        laneVersion: 0,
        storeVersion: 1,
        sourceTick: 0,
        sourceSystemId: 0,
        sourceEventId: 0,
        previousValue: 0,
        delta: 0,
        changeReason: undefined,
      });
      expect(output).toBe(identity);
    }
  });

  it("allows authoritative noops at MAX and rejects changed legacy mutations atomically", () => {
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 100 }))).toMatchObject({
      ok: true,
    });
    Reflect.set(store, "storeVersion", 0xffff_ffff);
    const laneVersions: unknown = Reflect.get(store, "laneVersions");
    if (!(laneVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    laneVersions[0] = 0xffff_ffff;
    const before = store.createSnapshot();
    expect(store.setLane(changeInput(0, NEED_LANE_HUNGER, 1), 100)).toMatchObject({
      ok: true,
      changed: false,
    });
    expect(store.createSnapshot()).toStrictEqual(before);
    expect(store.applyLaneDelta(changeInput(0, NEED_LANE_HUNGER, 1), 1)).toStrictEqual({
      ok: false,
      reason: "need_version_exhausted",
    });
    expect(store.createSnapshot()).toStrictEqual(before);
  });

  it("preflights an entire scheduled batch before a later exhausted lane can mutate", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const laneVersions: unknown = Reflect.get(store, "laneVersions");
    if (!(laneVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    laneVersions[1] = 0xffff_ffff;
    const before = store.createSnapshot();
    expect(store.processScheduledUpdates(1, new Int32Array([-1, -1, 0, 0, 0]), 5)).toStrictEqual({
      ok: false,
      reason: "need_version_exhausted",
    });
    expect(store.createSnapshot()).toStrictEqual(before);
  });

  it("rejects a later scheduled stale tick and exhausted counters before any batch write", () => {
    const stale = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(stale.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const sourceTicks: unknown = Reflect.get(stale, "sourceTicks");
    if (!(sourceTicks instanceof Float64Array)) throw new Error("missing Need source ticks");
    sourceTicks[1] = 5;
    const staleBefore = stale.createSnapshot();
    expect(stale.processScheduledUpdates(4, new Int32Array([-1, -1, 0, 0, 0]), 5)).toStrictEqual({
      ok: false,
      reason: "need_tick_invalid",
    });
    expect(stale.createSnapshot()).toStrictEqual(staleBefore);

    const exhausted = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(exhausted.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    Reflect.set(exhausted, "scheduledUpdateCount", 0xffff_ffff);
    const exhaustedBefore = exhausted.createSnapshot();
    expect(
      exhausted.processScheduledUpdates(1, new Int32Array([-1, -1, 0, 0, 0]), 5),
    ).toStrictEqual({
      ok: false,
      reason: "need_version_exhausted",
    });
    expect(exhausted.createSnapshot()).toStrictEqual(exhaustedBefore);
  });

  it("rejects malformed scheduled cursors and links without writes or mirror notifications", () => {
    for (const field of ["scheduleCursors", "schedulePrevious"] as const) {
      const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
      expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
        ok: true,
      });
      const lane: unknown = Reflect.get(store, field);
      if (!(lane instanceof Int32Array)) throw new Error(`missing Need ${field}`);
      lane[0] = -2;
      const before = store.createSnapshot();
      const sink = createNeedUrgencyIndex({ actorCapacity: 1 });
      expect(
        store.processScheduledUpdates(1, new Int32Array([-1, 0, 0, 0, 0]), 1, sink),
      ).toStrictEqual({ ok: false, reason: "need_phase_out_of_range" });
      expect(store.createSnapshot()).toStrictEqual(before);
      expect(sink.createMetrics().dirtyBacklog).toBe(0);
    }
  });

  it("rejects a cross-phase next node before either partial or extended budgets can write", () => {
    for (const budget of [1, 2]) {
      const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 2 });
      expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
        ok: true,
      });
      const next = readNeedInt32Field(store, "scheduleNext");
      const previous = readNeedInt32Field(store, "schedulePrevious");
      next[0] = 1;
      previous[1] = 0;
      expectScheduledStructureReject(store, 2, budget);
    }
  });

  it.each([
    [
      "out-of-range",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleNext")[0] = 15;
      },
    ],
    [
      "inactive",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleNext")[0] = 5;
        readNeedInt32Field(store, "schedulePrevious")[5] = 0;
        readNeedUint8Field(store, "active")[1] = 0;
      },
    ],
    [
      "wrong-phase",
      (store: NeedStore): void => {
        readNeedUint32Field(store, "updatePhases")[1] = 1;
      },
    ],
    [
      "non-increasing",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 5;
        readNeedInt32Field(store, "scheduleNext")[5] = 4;
        readNeedInt32Field(store, "schedulePrevious")[4] = 5;
      },
    ],
    [
      "backlink-mismatch",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "schedulePrevious")[1] = 2;
      },
    ],
  ] as const)("rejects a %s post-budget cursor basis before writes", (_label, corrupt) => {
    const store = createScheduledStructureStore();
    corrupt(store);
    expectScheduledStructureReject(store, 2, 1);
  });

  it.each([
    [
      "inactive predecessor",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 10;
        readNeedUint8Field(store, "active")[1] = 0;
      },
    ],
    [
      "wrong-phase predecessor",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 10;
        readNeedUint32Field(store, "updatePhases")[9] = 1;
      },
    ],
    [
      "non-preceding predecessor",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 10;
        readNeedInt32Field(store, "schedulePrevious")[10] = 10;
      },
    ],
    [
      "forward-link mismatch",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 10;
        readNeedInt32Field(store, "scheduleNext")[9] = 8;
      },
    ],
    [
      "out-of-range head",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 10;
        readNeedInt32Field(store, "scheduleHeads")[0] = 15;
      },
    ],
    [
      "linked head predecessor",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 10;
        readNeedInt32Field(store, "schedulePrevious")[0] = 1;
      },
    ],
    [
      "head cursor with a predecessor",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 0;
        readNeedInt32Field(store, "schedulePrevious")[0] = 1;
      },
    ],
    [
      "mid cursor without a predecessor",
      (store: NeedStore): void => {
        readNeedInt32Field(store, "scheduleCursors")[0] = 10;
        readNeedInt32Field(store, "schedulePrevious")[10] = -1;
      },
    ],
  ] as const)("rejects a %s before writes", (_label, corrupt) => {
    const store = createScheduledStructureStore();
    corrupt(store);
    expectScheduledStructureReject(store, 2, 1);
  });

  it("persists the first unvisited cursor and wraps a completed chain to its validated head", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const deltas = new Int32Array([-1, -1, -1, -1, -1]);
    expect(store.processScheduledUpdates(1, deltas, 2)).toStrictEqual({
      ok: true,
      tick: 1,
      phase: 0,
      visitedCount: 2,
      changedCount: 2,
      budgetExhausted: true,
      version: 3,
    });
    expect(store.createSnapshot()).toMatchObject({
      scheduleCursors: [2],
      scheduledUpdateCount: 2,
      scheduledChangeCount: 2,
      lastScheduledVisitedCount: 2,
    });
    expect(store.processScheduledUpdates(2, deltas, 5)).toStrictEqual({
      ok: true,
      tick: 2,
      phase: 0,
      visitedCount: 3,
      changedCount: 3,
      budgetExhausted: false,
      version: 6,
    });
    expect(store.createSnapshot()).toMatchObject({
      scheduleCursors: [0],
      scheduledUpdateCount: 5,
      scheduledChangeCount: 5,
      lastScheduledVisitedCount: 3,
    });
  });

  it("checks nonzero clamp-noop ticks and permits unrelated MAX versions when changed is zero", () => {
    const stale = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(stale.registerActor(createActor({ actorId: 0, hunger: 0, phaseSeed: 0 }))).toMatchObject(
      { ok: true },
    );
    const ticks: unknown = Reflect.get(stale, "sourceTicks");
    if (!(ticks instanceof Float64Array)) throw new Error("missing Need source ticks");
    ticks[0] = 5;
    const staleBefore = stale.createSnapshot();
    expect(stale.processScheduledUpdates(4, new Int32Array([-1, 0, 0, 0, 0]), 1)).toStrictEqual({
      ok: false,
      reason: "need_tick_invalid",
    });
    expect(stale.createSnapshot()).toStrictEqual(staleBefore);

    const max = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(max.registerActor(createActor({ actorId: 0, hunger: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const laneVersions: unknown = Reflect.get(max, "laneVersions");
    if (!(laneVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    laneVersions[0] = 0xffff_ffff;
    Reflect.set(max, "storeVersion", 0xffff_ffff);
    Reflect.set(max, "scheduledChangeCount", 0xffff_ffff);
    expect(max.processScheduledUpdates(1, new Int32Array([-1, 0, 0, 0, 0]), 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 0,
      version: 0xffff_ffff,
    });
    expect(max.createMetrics()).toMatchObject({
      scheduledUpdateCount: 1,
      scheduledChangeCount: 0xffff_ffff,
      lastScheduledVisitedCount: 1,
    });

    const emptyPhase = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 8 });
    expect(emptyPhase.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    Reflect.set(emptyPhase, "scheduledUpdateCount", 0xffff_ffff);
    expect(emptyPhase.processScheduledUpdates(7, new Int32Array(5), 1)).toMatchObject({
      ok: true,
      visitedCount: 0,
      changedCount: 0,
    });
    expect(emptyPhase.createMetrics().lastScheduledVisitedCount).toBe(0);
  });

  it("advances all four scheduled headroom lanes from FFFE to FFFF then rejects atomically", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const laneVersions: unknown = Reflect.get(store, "laneVersions");
    if (!(laneVersions instanceof Uint32Array)) throw new Error("missing Need lane versions");
    Reflect.set(store, "storeVersion", 0xffff_fffe);
    Reflect.set(store, "scheduledUpdateCount", 0xffff_fffe);
    Reflect.set(store, "scheduledChangeCount", 0xffff_fffe);
    laneVersions[0] = 0xffff_fffe;
    expect(store.processScheduledUpdates(1, new Int32Array([-1, 0, 0, 0, 0]), 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 1,
      version: 0xffff_ffff,
    });
    expect(store.createSnapshot()).toMatchObject({
      storeVersion: 0xffff_ffff,
      scheduledUpdateCount: 0xffff_ffff,
      scheduledChangeCount: 0xffff_ffff,
      laneVersions: [0xffff_ffff, 1, 1, 1, 1],
    });
    const cursors: unknown = Reflect.get(store, "scheduleCursors");
    if (!(cursors instanceof Int32Array)) throw new Error("missing Need schedule cursors");
    cursors[0] = 0;
    const before = store.createSnapshot();
    expect(store.processScheduledUpdates(2, new Int32Array([-1, 0, 0, 0, 0]), 1)).toStrictEqual({
      ok: false,
      reason: "need_version_exhausted",
    });
    expect(store.createSnapshot()).toStrictEqual(before);
  });

  it("publishes dirty mirrors only after the complete scheduled batch is committed", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const sink = createNeedUrgencyIndex({ actorCapacity: 1 });
    const result = store.processScheduledUpdates(1, new Int32Array([-1, -1, 0, 0, 0]), 5, sink);
    expect(result).toMatchObject({ ok: true, changedCount: 2, version: 3 });
    expect(store.createMetrics()).toMatchObject({
      scheduledUpdateCount: 5,
      scheduledChangeCount: 2,
      lastScheduledVisitedCount: 5,
    });
    expect(sink.createMetrics().dirtyBacklog).toBe(2);
  });

  it.each([
    ["first", [1, 2, 3], 1, 0],
    ["middle", [0, 2, 3], 1, 1],
    ["last", [0, 1, 3], 3, 2],
  ] as const)(
    "keeps Need authority identical when the real urgency sink rejects the %s notification",
    (_position, actorIds, sinkCapacity, expectedDirtyBacklog) => {
      const control = createScheduledNeedStore(actorIds);
      const mirrored = createScheduledNeedStore(actorIds);
      const sink = createNeedUrgencyIndex({ actorCapacity: sinkCapacity });
      const deltas = new Int32Array([-1, 0, 0, 0, 0]);
      const controlResult = control.processScheduledUpdates(1, deltas, 15);
      const mirroredResult = mirrored.processScheduledUpdates(1, deltas, 15, sink);
      expect(mirroredResult).toStrictEqual(controlResult);
      expect(mirrored.createSnapshot()).toStrictEqual(control.createSnapshot());
      expect(sink.createMetrics().dirtyBacklog).toBe(expectedDirtyBacklog);
    },
  );

  it("rejects non-int32 scheduled runtime inputs before any write", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(store.registerActor(createActor({ actorId: 0 }))).toMatchObject({ ok: true });
    const before = store.createSnapshot();
    const malformed = [0, 0, 0, 0, 0.5];
    expect(callScheduledNeedForTest(store, malformed)).toStrictEqual({
      ok: false,
      reason: "need_delta_out_of_range",
    });
    expect(store.createSnapshot()).toStrictEqual(before);
  });

  it("rejects unsafe phase expressions and accepts the exact safe-integer boundary", () => {
    const rejected = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 97 });
    for (const phaseSeed of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const before = rejected.createSnapshot();
      expect(rejected.registerActor(createActor({ phaseSeed }))).toStrictEqual({
        ok: false,
        reason: "need_phase_out_of_range",
      });
      expect(rejected.createSnapshot()).toStrictEqual(before);
    }

    const overflow = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 97, phaseSalt: 2 });
    expect(
      overflow.registerActor(createActor({ phaseSeed: Number.MAX_SAFE_INTEGER })),
    ).toStrictEqual({
      ok: false,
      reason: "need_phase_out_of_range",
    });

    expect(() =>
      createNeedStore({ actorCapacity: 1, updateIntervalTicks: 97, phaseSalt: -1 }),
    ).toThrow("need phase salt must be uint32");
    expect(() =>
      createNeedStore({ actorCapacity: 1, updateIntervalTicks: 97, phaseSalt: 0x1_0000_0000 }),
    ).toThrow("need phase salt must be uint32");

    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 97, phaseSalt: 1 });
    const phaseSeed = Number.MAX_SAFE_INTEGER - (NEED_LANE_SAFETY + 1);
    expect(phaseSeed).toBeGreaterThan(0xffff_ffff);
    expect(store.registerActor(createActor({ phaseSeed }))).toMatchObject({ ok: true });
    const lanes: readonly NeedLane[] = [
      NEED_LANE_HUNGER,
      NEED_LANE_REST,
      NEED_LANE_COMFORT,
      NEED_LANE_SOCIAL,
      NEED_LANE_SAFETY,
    ];
    for (const lane of lanes) {
      const expected = (phaseSeed + lane) % 97;
      expect(store.readLaneUpdatePhase(0, lane)).toBe(expected);
    }
  });

  it("rejects owner-derived reasons and derives strict clamp reasons internally", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 1 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 10 }))).toMatchObject({
      ok: true,
    });
    for (const reason of [
      "need.initialized",
      "need.scheduled_decay",
      "need.clamped_min",
      "need.clamped_max",
    ] as const) {
      const before = store.createSnapshot();
      expect(
        store.applyLaneDelta({ actorId: 0, lane: NEED_LANE_HUNGER, tick: 1, reason }, -1),
      ).toStrictEqual({
        ok: false,
        reason: "need_source_invalid",
      });
      expect(store.createSnapshot()).toStrictEqual(before);
    }
    expect(store.applyLaneDelta(changeInput(0, NEED_LANE_HUNGER, 1), -10)).toMatchObject({
      ok: true,
      reason: "need.external_delta",
    });
    expect(store.setLane(changeInput(0, NEED_LANE_HUNGER, 2), 10)).toMatchObject({ ok: true });
    expect(store.applyLaneDelta(changeInput(0, NEED_LANE_HUNGER, 3), -11)).toMatchObject({
      ok: true,
      reason: "need.clamped_min",
    });
  });

  it("round trips strict v1 snapshots and hashes every authoritative lane", () => {
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4, phaseSalt: 19 });
    expect(store.registerActor(createActor({ actorId: 0 }))).toMatchObject({ ok: true });
    expect(store.applyLaneDelta(changeInput(0, NEED_LANE_HUNGER, 2), -10)).toMatchObject({
      ok: true,
    });
    const snapshot = store.createSnapshot();
    expect(snapshot.snapshotVersion).toBe(M3_NEED_STORE_SNAPSHOT_VERSION);
    expect(restoreNeedStore(snapshot).createSnapshot()).toStrictEqual(snapshot);
    const fields = createNeedStoreHashFields(snapshot);
    expect(fields.some((field) => field.name === "needs.storeVersion")).toBe(true);
    expect(fields.some((field) => field.name === "needs.actor.0.lane.0.laneVersion")).toBe(true);

    const target = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4, phaseSalt: 19 });
    const before = target.createSnapshot();
    const malformed = { ...snapshot, actorCount: 2 };
    expect(target.restoreFromSnapshot(malformed)).toStrictEqual({
      ok: false,
      reason: "need_snapshot_invalid",
    });
    expect(target.createSnapshot()).toStrictEqual(before);

    const impossibleCount = { ...snapshot, actorCount: 1, storeVersion: 0 };
    expect(target.restoreFromSnapshot(impossibleCount)).toStrictEqual({
      ok: false,
      reason: "need_snapshot_invalid",
    });
    expect(target.createSnapshot()).toStrictEqual(before);
  });

  it("round trips scheduled decay provenance and rejects forged source provenance atomically", () => {
    const source = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 2, phaseSalt: 1 });
    expect(source.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    expect(source.processScheduledUpdates(1, new Int32Array([0, -1, 0, 0, 0]), 5)).toMatchObject({
      ok: true,
      changedCount: 1,
    });
    const snapshot = source.createSnapshot();
    expect(snapshot.reasonCodes[NEED_LANE_REST]).toBe(1);
    expect(snapshot.sourceTicks[NEED_LANE_REST]).toBe(1);
    expect(snapshot.updatePhases[NEED_LANE_REST]).toBe(1);
    expect(restoreNeedStore(snapshot).createSnapshot()).toStrictEqual(snapshot);

    const target = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 2, phaseSalt: 1 });
    expect(target.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    for (const malformed of [
      {
        ...snapshot,
        sourceSystemIds: replaceNeedLane(snapshot.sourceSystemIds, NEED_LANE_REST, 1),
      },
      {
        ...snapshot,
        sourceEventIds: replaceNeedLane(snapshot.sourceEventIds, NEED_LANE_REST, 1),
      },
      {
        ...snapshot,
        sourceTicks: replaceNeedLane(snapshot.sourceTicks, NEED_LANE_REST, 2),
      },
    ]) {
      expectAtomicNeedRestoreReject(target, malformed, "need_snapshot_invalid");
    }
  });

  it("accepts wrapped reachable phase topology and rejects shuffled or unreachable residues", () => {
    const wrapped = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 4, phaseSalt: 1 });
    expect(wrapped.registerActor(createActor({ actorId: 0, phaseSeed: 3 }))).toMatchObject({
      ok: true,
    });
    expect(wrapped.createSnapshot().updatePhases).toStrictEqual([3, 0, 1, 2, 3]);
    expect(restoreNeedStore(wrapped.createSnapshot()).createSnapshot()).toStrictEqual(
      wrapped.createSnapshot(),
    );

    const shuffledSource = createNeedStore({
      actorCapacity: 1,
      updateIntervalTicks: 4,
      phaseSalt: 1,
    });
    expect(shuffledSource.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const shuffledSnapshot = shuffledSource.createSnapshot();
    const shuffledPhases = replaceNeedLane(shuffledSnapshot.updatePhases, 1, 2);
    shuffledPhases[2] = 1;
    expectAtomicNeedRestoreReject(
      wrapped,
      rebuildNeedScheduleForPhases(shuffledSnapshot, shuffledPhases),
      "need_snapshot_invalid",
    );

    const saltTwo = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 4, phaseSalt: 2 });
    expect(saltTwo.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const saltTwoSnapshot = saltTwo.createSnapshot();
    expectAtomicNeedRestoreReject(
      saltTwo,
      rebuildNeedScheduleForPhases(saltTwoSnapshot, [1, 2, 3, 0, 1]),
      "need_snapshot_invalid",
    );

    const zeroSalt = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4, phaseSalt: 0 });
    expect(zeroSalt.registerActor(createActor({ actorId: 0, phaseSeed: 99 }))).toMatchObject({
      ok: true,
    });
    expect(zeroSalt.registerActor(createActor({ actorId: 1, phaseSeed: 99 }))).toMatchObject({
      ok: true,
    });
    const zeroSaltSnapshot = zeroSalt.createSnapshot();
    expect(restoreNeedStore(zeroSaltSnapshot).createSnapshot()).toStrictEqual(zeroSaltSnapshot);
    const wrongOffsetPhases = Array.from(zeroSaltSnapshot.updatePhases);
    for (let lane = 0; lane < 5; lane += 1) wrongOffsetPhases[5 + lane] = lane % 4;
    expectAtomicNeedRestoreReject(
      zeroSalt,
      rebuildNeedScheduleForPhases(zeroSaltSnapshot, wrongOffsetPhases),
      "need_snapshot_invalid",
    );
  });

  it("computes phase residues with safe-number operands above uint32 without coercion", () => {
    const highSalt = 0x1_0000_0000;
    const highInterval = 0x2_0000_0000;
    expect(isReachableNeedPhaseResidue(highSalt, highInterval, 5, 5)).toBe(true);
    expect(isReachableNeedPhaseResidue(highSalt, highInterval, 5, 6)).toBe(false);
  });

  it("rejects strict snapshot reason, topology, counter, and schedule corruptions atomically", () => {
    const source = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4, phaseSalt: 19 });
    expect(source.registerActor(createActor({ actorId: 0 }))).toMatchObject({ ok: true });
    expect(source.applyLaneDelta(changeInput(0, NEED_LANE_HUNGER, 2), -10)).toMatchObject({
      ok: true,
    });
    const snapshot = source.createSnapshot();
    const target = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 4, phaseSalt: 19 });
    expect(target.registerActor(createActor({ actorId: 1 }))).toMatchObject({ ok: true });

    const corruptions: readonly (readonly [
      unknown,
      "need_snapshot_invalid" | "need_snapshot_version_unsupported",
    ])[] = [
      [{ ...snapshot, snapshotVersion: 99 }, "need_snapshot_version_unsupported"],
      [{ ...snapshot, extra: 1 }, "need_snapshot_invalid"],
      [withoutNeedSnapshotField(snapshot, "deltas"), "need_snapshot_invalid"],
      [{ ...snapshot, values: createSparseNeedLane(snapshot.values, 0) }, "need_snapshot_invalid"],
      [{ ...snapshot, actorCount: 0 }, "need_snapshot_invalid"],
      [{ ...snapshot, scheduledChangeCount: 2 }, "need_snapshot_invalid"],
      [{ ...snapshot, lastScheduledVisitedCount: 2 }, "need_snapshot_invalid"],
      [
        { ...snapshot, reasonCodes: replaceNeedLane(snapshot.reasonCodes, 0, 6) },
        "need_snapshot_invalid",
      ],
      [
        {
          ...snapshot,
          reasonCodes: replaceNeedLane(snapshot.reasonCodes, 0, 0),
          previousValues: replaceNeedLane(snapshot.previousValues, 0, 370),
          deltas: replaceNeedLane(snapshot.deltas, 0, -20),
        },
        "need_snapshot_invalid",
      ],
      [
        {
          ...snapshot,
          reasonCodes: replaceNeedLane(snapshot.reasonCodes, 0, 4),
        },
        "need_snapshot_invalid",
      ],
      [
        {
          ...snapshot,
          laneVersions: replaceNeedLane(snapshot.laneVersions, 1, 2),
        },
        "need_snapshot_invalid",
      ],
      [
        {
          ...snapshot,
          scheduleNext: replaceNeedLane(snapshot.scheduleNext, 0, 0),
        },
        "need_snapshot_invalid",
      ],
      [
        {
          ...snapshot,
          active: replaceNeedLane(snapshot.active, 1, 0),
          values: replaceNeedLane(snapshot.values, 5, 1),
        },
        "need_snapshot_invalid",
      ],
    ];
    for (const [malformed, reason] of corruptions) {
      expectAtomicNeedRestoreReject(target, malformed, reason);
    }
  });

  it("hashes Need headers, phases, actors, lanes, and links in exact physical order", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 2 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    const snapshot = store.createSnapshot();
    const fields = createNeedStoreHashFields(snapshot, "owner.needs");
    expect(readFieldNames(fields, 0, 13)).toStrictEqual([
      "owner.needs.snapshotVersion",
      "owner.needs.actorCapacity",
      "owner.needs.updateIntervalTicks",
      "owner.needs.phaseSalt",
      "owner.needs.actorCount",
      "owner.needs.storeVersion",
      "owner.needs.scheduledUpdateCount",
      "owner.needs.scheduledChangeCount",
      "owner.needs.lastScheduledVisitedCount",
      "owner.needs.phase.0.head",
      "owner.needs.phase.0.cursor",
      "owner.needs.phase.1.head",
      "owner.needs.phase.1.cursor",
    ]);
    expect(fields[13]?.name).toBe("owner.needs.actor.0.active");
    expect(readFieldNames(fields, 14, 25)).toStrictEqual([
      "owner.needs.actor.0.lane.0.value",
      "owner.needs.actor.0.lane.0.updatePhase",
      "owner.needs.actor.0.lane.0.laneVersion",
      "owner.needs.actor.0.lane.0.sourceTick",
      "owner.needs.actor.0.lane.0.sourceSystemId",
      "owner.needs.actor.0.lane.0.sourceEventId",
      "owner.needs.actor.0.lane.0.previousValue",
      "owner.needs.actor.0.lane.0.delta",
      "owner.needs.actor.0.lane.0.reasonCode",
      "owner.needs.actor.0.lane.0.next",
      "owner.needs.actor.0.lane.0.previous",
    ]);
    for (const changed of [
      { ...snapshot, storeVersion: snapshot.storeVersion + 1 },
      { ...snapshot, scheduledUpdateCount: 1 },
      { ...snapshot, scheduleCursors: replaceNeedLane(snapshot.scheduleCursors, 0, 0) },
      { ...snapshot, values: replaceNeedLane(snapshot.values, 0, 361) },
      { ...snapshot, laneVersions: replaceNeedLane(snapshot.laneVersions, 0, 2) },
      { ...snapshot, scheduleNext: replaceNeedLane(snapshot.scheduleNext, 0, -1) },
    ]) {
      expect(createNeedStoreHashFields(changed)).not.toStrictEqual(
        createNeedStoreHashFields(snapshot),
      );
    }
  });

  it("makes Need owner changes visible to actual GameSession world and read-model hashes", () => {
    const initialized = initializeGameSessionRuntime({ seed: "need-owner-hash" });
    if (!initialized.ok) throw new Error(initialized.reason);
    const runtime = initialized.runtime;
    const worldBefore = runtime.createWorldHash();
    const readBefore = runtime.createReadModelHash();
    expect(
      runtime.owners.needs.applyLaneDelta(changeInput(0, NEED_LANE_HUNGER, runtime.tick), -1),
    ).toMatchObject({ ok: true, changed: true });
    expect(runtime.createWorldHash()).not.toBe(worldBefore);
    expect(runtime.createReadModelHash()).not.toBe(readBefore);
  });

  it("runs deterministic phase-staggered scheduled updates from phase buckets", () => {
    const store = createNeedStore({ actorCapacity: 3, updateIntervalTicks: 8 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.registerActor(createActor({ actorId: 1, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });

    expect(store.readLaneUpdatePhase(0, NEED_LANE_HUNGER)).toBe(0);
    expect(store.readLaneUpdatePhase(0, NEED_LANE_REST)).toBe(1);
    expect(store.readLaneUpdatePhase(1, NEED_LANE_HUNGER)).toBe(5);
    expect(store.readLaneUpdatePhase(1, NEED_LANE_SAFETY)).toBe(1);

    const result = store.processScheduledUpdates(1, new Int32Array([-10, -20, -30, -40, -50]), 8);

    expect(result).toEqual({
      ok: true,
      tick: 1,
      phase: 1,
      visitedCount: 2,
      changedCount: 2,
      budgetExhausted: false,
      version: 4,
    });
    expect(store.readLaneValue(0, NEED_LANE_REST)).toBe(480);
    expect(store.readLaneValue(1, NEED_LANE_SAFETY)).toBe(650);
    expect(store.readLaneLastChange(0, NEED_LANE_REST)).toMatchObject({
      tick: 1,
      reason: "need.scheduled_decay",
      previousValue: 500,
      nextValue: 480,
      delta: -20,
      ownerVersion: 2,
    });
    expect(store.createMetrics()).toMatchObject({
      actorCount: 2,
      scheduledUpdateCount: 2,
      scheduledChangeCount: 2,
      lastScheduledVisitedCount: 2,
    });
  });

  it("advances a budgeted phase cursor before wrapping to the first lane again", () => {
    const store = createNeedStore({ actorCapacity: 1, updateIntervalTicks: 2 });
    expect(store.registerActor(createActor({ actorId: 0, phaseSeed: 0 }))).toMatchObject({
      ok: true,
    });

    const laneDeltas = new Int32Array([-10, 0, -30, 0, 0]);
    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 1,
      budgetExhausted: true,
    });
    expect(store.readLaneValue(0, NEED_LANE_HUNGER)).toBe(350);
    expect(store.readLaneValue(0, NEED_LANE_COMFORT)).toBe(650);

    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 1,
      budgetExhausted: true,
    });
    expect(store.readLaneValue(0, NEED_LANE_HUNGER)).toBe(350);
    expect(store.readLaneValue(0, NEED_LANE_COMFORT)).toBe(620);

    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 0,
      budgetExhausted: false,
    });
    expect(store.processScheduledUpdates(0, laneDeltas, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      changedCount: 1,
      budgetExhausted: true,
    });
    expect(store.readLaneValue(0, NEED_LANE_HUNGER)).toBe(340);
    expect(store.readLaneValue(0, NEED_LANE_COMFORT)).toBe(620);
  });

  it("clamps lane deltas and stores structured last-change reasons", () => {
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 5 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 100 }))).toMatchObject({
      ok: true,
    });

    expect(
      store.applyLaneDelta(
        {
          actorId: 0,
          lane: NEED_LANE_HUNGER,
          tick: 3,
          reason: "need.external_delta",
          sourceSystemId: 7,
          sourceEventId: 9,
        },
        -500,
      ),
    ).toMatchObject({
      ok: true,
      changed: true,
      value: 0,
      reason: "need.clamped_min",
    });
    expect(store.readLaneLastChange(0, NEED_LANE_HUNGER)).toEqual({
      tick: 3,
      reason: "need.clamped_min",
      sourceSystemId: 7,
      sourceEventId: 9,
      previousValue: 100,
      nextValue: 0,
      delta: -100,
      ownerVersion: 2,
    });
  });
});

describe("M3 NeedUrgencyIndex", () => {
  it("keeps the public markDirty result ABI exact while deduplicating queued lanes", () => {
    const index = createNeedUrgencyIndex({ actorCapacity: 1 });
    expect(index.markDirty(0, NEED_LANE_HUNGER)).toStrictEqual({
      ok: true,
      actorId: 0,
      lane: NEED_LANE_HUNGER,
      changed: false,
      value: 0,
      ownerVersion: 0,
      reason: "need.external_delta",
    });
    expect(index.markDirty(0, NEED_LANE_HUNGER)).toStrictEqual({
      ok: true,
      actorId: 0,
      lane: NEED_LANE_HUNGER,
      changed: false,
      value: 0,
      ownerVersion: 0,
      reason: "need.external_delta",
    });
    expect(index.createMetrics()).toMatchObject({ dirtyBacklog: 1, dirtyBacklogPeak: 1 });
    expect(index.markDirty(1, NEED_LANE_HUNGER)).toStrictEqual({
      ok: false,
      reason: "need_actor_out_of_range",
    });
  });

  it("rebuilds from NeedStore and returns bounded stable hunger candidates", () => {
    const fixture = createUrgencyFixture(30);
    const traces = createNeedUrgencyTraceStore(4);
    const output = new Uint32Array(12);

    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({
      indexedCount: 150,
      dirtyBacklog: 0,
    });
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 24,
          maxSelectedActors: 12,
        },
        output,
        traces,
      ),
    ).toEqual({
      ok: true,
      lane: NEED_LANE_HUNGER,
      selectedCount: 12,
      bucketCandidateCount: 30,
      visitedCount: 24,
      candidateCapHit: true,
      selectedCapHit: true,
      sourceVersion: 30,
      indexVersion: 1,
      traceSequence: 1,
    });
    expect([...output]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(traces.readNewest(0)).toMatchObject({
      sequence: 1,
      lane: NEED_LANE_HUNGER,
      selectedActorId: 0,
      reason: "trace.candidate_cap_reached",
      candidateCapHit: true,
      selectedCapHit: true,
    });
  });

  it("rejects stale dirty backlog and refreshes exact actor-lane keys", () => {
    const fixture = createUrgencyFixture(8);
    const output = new Uint32Array(4);
    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({ sourceVersion: 8 });

    const mutation = fixture.store.setLane(
      { actorId: 5, lane: NEED_LANE_HUNGER, tick: 4, reason: "need.manual_set" },
      10,
    );
    expect(mutation).toMatchObject({ ok: true, ownerVersion: 9 });
    expect(fixture.index.markMutationDirty(mutation)).toEqual(mutation);
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 8,
          maxSelectedActors: 4,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "need_dirty_backlog" });

    expect(fixture.index.refreshDirty(fixture.store, 1)).toMatchObject({
      ok: true,
      visitedCount: 1,
      budgetExhausted: false,
      version: 2,
    });
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 8,
          maxSelectedActors: 4,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 4,
      bucketCandidateCount: 8,
      visitedCount: 8,
      candidateCapHit: false,
      sourceVersion: 9,
    });
    expect([...output]).toEqual([5, 0, 1, 2]);
    expect(fixture.index.createMetrics()).toMatchObject({
      dirtyBacklog: 0,
      dirtyBacklogPeak: 1,
      refreshedCount: 1,
    });
  });

  it("keeps the mutation dirty helper explicit for changed and unchanged owner writes", () => {
    const fixture = createUrgencyFixture(4);
    const output = new Uint32Array(2);
    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({ sourceVersion: 4 });

    const unchanged = fixture.store.setLane(
      { actorId: 2, lane: NEED_LANE_HUNGER, tick: 5, reason: "need.manual_set" },
      102,
    );
    expect(unchanged).toMatchObject({ ok: true, changed: false });
    expect(fixture.index.markMutationDirty(unchanged)).toEqual(unchanged);
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 4,
          maxSelectedActors: 2,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      sourceVersion: 4,
      selectedCount: 2,
    });

    const changed = fixture.store.setLane(
      { actorId: 2, lane: NEED_LANE_HUNGER, tick: 6, reason: "need.manual_set" },
      50,
    );
    expect(changed).toMatchObject({ ok: true, changed: true, ownerVersion: 5 });
    expect(fixture.index.markMutationDirty(changed)).toEqual(changed);
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 1,
          candidateCap: 4,
          maxSelectedActors: 2,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "need_dirty_backlog" });
  });

  it("rebuilds deterministically after multiple owner-store changes", () => {
    const fixture = createUrgencyFixture(6);
    const firstOutput = new Uint32Array(3);
    const secondOutput = new Uint32Array(3);
    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({ indexedCount: 30 });
    expect(
      fixture.store.setLane(
        { actorId: 4, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.store.setLane(
        { actorId: 3, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.index.rebuildFromStore(fixture.store)).toMatchObject({
      sourceVersion: 8,
      rebuiltCount: 60,
      dirtyBacklog: 0,
    });
    expect(
      fixture.index.queryUrgentActors(
        {
          lane: NEED_LANE_REST,
          minUrgencyBucket: 1,
          candidateCap: 6,
          maxSelectedActors: 3,
        },
        firstOutput,
      ),
    ).toMatchObject({ ok: true, traceSequence: 0 });

    const replay = createUrgencyFixture(6);
    expect(replay.index.rebuildFromStore(replay.store)).toMatchObject({ indexedCount: 30 });
    expect(
      replay.store.setLane(
        { actorId: 4, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });
    expect(
      replay.store.setLane(
        { actorId: 3, lane: NEED_LANE_REST, tick: 10, reason: "need.manual_set" },
        20,
      ),
    ).toMatchObject({ ok: true });
    expect(replay.index.rebuildFromStore(replay.store)).toMatchObject({ sourceVersion: 8 });
    expect(
      replay.index.queryUrgentActors(
        {
          lane: NEED_LANE_REST,
          minUrgencyBucket: 1,
          candidateCap: 6,
          maxSelectedActors: 3,
        },
        secondOutput,
      ),
    ).toMatchObject({ ok: true });

    expect([...firstOutput]).toEqual([3, 4, 0]);
    expect([...secondOutput]).toEqual([...firstOutput]);
  });

  it("keeps urgency buckets integer and fixture-scale metrics bounded", () => {
    expect(calculateNeedUrgencyBucket(900)).toBe(0);
    expect(calculateNeedUrgencyBucket(650)).toBe(1);
    expect(calculateNeedUrgencyBucket(420)).toBe(2);
    expect(calculateNeedUrgencyBucket(260)).toBe(3);
    expect(calculateNeedUrgencyBucket(100)).toBe(4);

    const traces = createNeedUrgencyTraceStore(2);
    const output = new Uint32Array(2);
    const store = createNeedStore({ actorCapacity: 2, updateIntervalTicks: 5 });
    const index = createNeedUrgencyIndex({ actorCapacity: 2 });
    expect(store.registerActor(createActor({ actorId: 0, hunger: 900 }))).toMatchObject({
      ok: true,
    });
    expect(index.rebuildFromStore(store)).toMatchObject({ indexedCount: 5 });
    expect(
      index.queryUrgentActors(
        {
          lane: NEED_LANE_HUNGER,
          minUrgencyBucket: 3,
          candidateCap: 2,
          maxSelectedActors: 2,
        },
        output,
        traces,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 0,
      bucketCandidateCount: 0,
      visitedCount: 0,
    });
    expect([...output]).toEqual([NEED_ACTOR_NONE, NEED_ACTOR_NONE]);
    expect(traces.readNewest(0)).toMatchObject({
      reason: "need.urgency_no_candidate",
      selectedActorId: NEED_ACTOR_NONE,
    });
    expect(traces.createMetrics()).toEqual({
      capacity: 2,
      storedCount: 1,
      nextSequence: 2,
      backlogCount: 0,
    });
  });
});

function createActor(
  overrides: Partial<Parameters<NeedStore["registerActor"]>[0]> = {},
): Parameters<NeedStore["registerActor"]>[0] {
  return {
    actorId: 0,
    hunger: 360,
    rest: 500,
    comfort: 650,
    social: 520,
    safety: 700,
    sourceTick: 0,
    ...overrides,
  };
}

function changeInput(
  actorId: number,
  lane: 0 | 1 | 2 | 3 | 4,
  tick: number,
): Parameters<NeedStore["applyLaneDelta"]>[0] {
  return {
    actorId,
    lane,
    tick,
    reason: "need.external_delta",
    sourceSystemId: 1,
    sourceEventId: 2,
  };
}

function poisonedLaneOutput(): NeedLaneIntoOutput {
  return {
    ok: true,
    reason: "need_version_exhausted",
    active: true,
    actorId: 99,
    lane: NEED_LANE_SAFETY,
    value: 99,
    updatePhase: 99,
    laneVersion: 99,
    storeVersion: 99,
    sourceTick: 99,
    sourceSystemId: 99,
    sourceEventId: 99,
    previousValue: 99,
    delta: 99,
    changeReason: "need.clamped_max",
  };
}

function poisonLaneOutput(output: NeedLaneIntoOutput): void {
  output.ok = true;
  output.reason = "need_version_exhausted";
  output.active = true;
  output.actorId = 99;
  output.lane = NEED_LANE_SAFETY;
  output.value = 99;
  output.updatePhase = 99;
  output.laneVersion = 99;
  output.storeVersion = 99;
  output.sourceTick = 99;
  output.sourceSystemId = 99;
  output.sourceEventId = 99;
  output.previousValue = 99;
  output.delta = 99;
  output.changeReason = "need.clamped_max";
}

function preparedNeedMutation(): PreparedNeedLaneMutation {
  return {
    ok: false,
    reason: undefined,
    actorId: NEED_ACTOR_NONE,
    lane: NEED_LANE_HUNGER,
    tick: 0,
    previousValue: 0,
    nextValue: 0,
    sourceSystemId: 0,
    sourceEventId: 0,
    reasonCode: 0,
    changed: false,
    previousSourceTick: 0,
    previousSourceSystemId: 0,
    previousSourceEventId: 0,
    previousReasonCode: 0,
    previousStoreVersion: 0,
    previousLaneVersion: 0,
    nextStoreVersion: 0,
    nextLaneVersion: 0,
  };
}

function poisonPreparedNeedMutation(output: PreparedNeedLaneMutation): void {
  output.ok = true;
  output.reason = "need_version_exhausted";
  output.actorId = 99;
  output.lane = NEED_LANE_SAFETY;
  output.tick = 99;
  output.previousValue = 99;
  output.nextValue = 99;
  output.sourceSystemId = 99;
  output.sourceEventId = 99;
  output.reasonCode = 99;
  output.changed = true;
  output.previousSourceTick = 99;
  output.previousSourceSystemId = 99;
  output.previousSourceEventId = 99;
  output.previousReasonCode = 99;
  output.previousStoreVersion = 99;
  output.previousLaneVersion = 99;
  output.nextStoreVersion = 99;
  output.nextLaneVersion = 99;
}

function replaceNeedLane(values: readonly number[], index: number, value: number): number[] {
  const copy = Array.from(values);
  copy[index] = value;
  return copy;
}

function createSparseNeedLane(values: readonly number[], missingIndex: number): number[] {
  const copy = Array.from(values);
  Reflect.deleteProperty(copy, String(missingIndex));
  return copy;
}

function withoutNeedSnapshotField(
  snapshot: NeedStore["createSnapshot"] extends () => infer Snapshot ? Snapshot : never,
  field: string,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...snapshot };
  Reflect.deleteProperty(copy, field);
  return copy;
}

function expectAtomicNeedRestoreReject(
  store: NeedStore,
  malformed: unknown,
  reason: "need_snapshot_invalid" | "need_snapshot_version_unsupported",
): void {
  const before = store.createSnapshot();
  const hashBefore = createNeedStoreHashFields(before);
  expect(store.restoreFromSnapshot(malformed)).toStrictEqual({
    ok: false,
    reason,
  });
  expect(store.createSnapshot()).toStrictEqual(before);
  expect(createNeedStoreHashFields(store.createSnapshot())).toStrictEqual(hashBefore);
}

function rebuildNeedScheduleForPhases(
  snapshot: ReturnType<NeedStore["createSnapshot"]>,
  updatePhases: readonly number[],
): ReturnType<NeedStore["createSnapshot"]> {
  const heads = new Array<number>(snapshot.updateIntervalTicks).fill(-1);
  const tails = new Array<number>(snapshot.updateIntervalTicks).fill(-1);
  const next = new Array<number>(snapshot.values.length).fill(-1);
  const previous = new Array<number>(snapshot.values.length).fill(-1);
  for (let actorId = 0; actorId < snapshot.actorCapacity; actorId += 1) {
    if (snapshot.active[actorId] !== 1) continue;
    for (let lane = 0; lane < 5; lane += 1) {
      const key = actorId * 5 + lane;
      const phase = updatePhases[key] ?? -1;
      const tail = tails[phase] ?? -1;
      if (tail === -1) heads[phase] = key;
      else next[tail] = key;
      previous[key] = tail;
      tails[phase] = key;
    }
  }
  return {
    ...snapshot,
    updatePhases: Array.from(updatePhases),
    scheduleHeads: heads,
    scheduleCursors: new Array<number>(snapshot.updateIntervalTicks).fill(-1),
    scheduleNext: next,
    schedulePrevious: previous,
  };
}

function readFieldNames(
  fields: readonly { readonly name: string }[],
  start: number,
  end: number,
): string[] {
  const names: string[] = [];
  for (let index = start; index < end; index += 1) names.push(fields[index]?.name ?? "");
  return names;
}

function createUrgencyFixture(actorCount: number): {
  readonly store: NeedStore;
  readonly index: NeedUrgencyIndex;
} {
  const store = createNeedStore({ actorCapacity: actorCount, updateIntervalTicks: 8 });
  const index = createNeedUrgencyIndex({ actorCapacity: actorCount });

  for (let actorId = 0; actorId < actorCount; actorId += 1) {
    expect(
      store.registerActor(
        createActor({
          actorId,
          hunger: 100 + actorId,
          rest: 300 + actorId,
          comfort: 600 + actorId,
          social: 700 + actorId,
          safety: 800 + actorId,
        }),
      ),
    ).toMatchObject({ ok: true });
  }

  return { store, index };
}

function createScheduledNeedStore(actorIds: readonly number[]): NeedStore {
  const store = createNeedStore({ actorCapacity: 4, updateIntervalTicks: 1 });
  for (const actorId of actorIds) {
    expect(store.registerActor(createActor({ actorId, phaseSeed: 0 }))).toMatchObject({ ok: true });
  }
  return store;
}

function createScheduledStructureStore(): NeedStore {
  const store = createNeedStore({ actorCapacity: 3, updateIntervalTicks: 1 });
  for (let actorId = 0; actorId < 3; actorId += 1) {
    expect(store.registerActor(createActor({ actorId, phaseSeed: 0 }))).toMatchObject({ ok: true });
  }
  return store;
}

function expectScheduledStructureReject(store: NeedStore, tick: number, budget: number): void {
  const sink = createNeedUrgencyIndex({ actorCapacity: 4 });
  const before = store.createSnapshot();
  const hashBefore = createNeedStoreHashFields(before);
  expect(
    store.processScheduledUpdates(tick, new Int32Array([-1, -1, -1, -1, -1]), budget, sink),
  ).toStrictEqual({ ok: false, reason: "need_phase_out_of_range" });
  expect(store.createSnapshot()).toStrictEqual(before);
  expect(createNeedStoreHashFields(store.createSnapshot())).toStrictEqual(hashBefore);
  expect(sink.createMetrics().dirtyBacklog).toBe(0);
}

function readNeedInt32Field(store: NeedStore, field: string): Int32Array {
  const value: unknown = Reflect.get(store, field);
  if (!(value instanceof Int32Array)) throw new Error(`missing Need ${field}`);
  return value;
}

function readNeedUint8Field(store: NeedStore, field: string): Uint8Array {
  const value: unknown = Reflect.get(store, field);
  if (!(value instanceof Uint8Array)) throw new Error(`missing Need ${field}`);
  return value;
}

function readNeedUint32Field(store: NeedStore, field: string): Uint32Array {
  const value: unknown = Reflect.get(store, field);
  if (!(value instanceof Uint32Array)) throw new Error(`missing Need ${field}`);
  return value;
}

function callPrepareNeedForTest(
  store: NeedStore,
  input: unknown,
  output: PreparedNeedLaneMutation,
): void {
  const prepare: unknown = Reflect.get(store, "prepareLaneDeltaInto");
  if (typeof prepare !== "function") throw new Error("missing Need prepare root");
  Reflect.apply(prepare, store, [input, output]);
}

function callScheduledNeedForTest(store: NeedStore, laneDeltas: unknown): unknown {
  const scheduled: unknown = Reflect.get(store, "processScheduledUpdates");
  if (typeof scheduled !== "function") throw new Error("missing Need scheduled root");
  return Reflect.apply(scheduled, store, [1, laneDeltas, 5]);
}
