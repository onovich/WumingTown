import { describe, expect, it } from "vitest";

import { createMapGrid } from "./map-grid";
import {
  M4_LAMP_DEFAULT_DIRTY_DRAIN_BUDGET,
  M4_LAMP_MAINTENANCE_NEEDS_FUEL,
  M4_LAMP_MAINTENANCE_OK,
  M4_LAMP_NONE,
  M4_LAMP_TAG_BOUNDARY,
  M4_LAMP_TAG_ROAD,
  commitPreparedM4LampMutation,
  createM4LampNetworkHashFields,
  createM4LampNetworkStore,
  type M4LampDirtyKeyOutput,
  type M4LampDirtyKeyView,
  type M4LampNetworkStore,
  type M4LampRegisterInput,
  type M4LampIntoOutput,
  type M4LampPrepareInput,
  type PreparedM4LampMutation,
} from "./m4-lamp-network";
import {
  M4_LAMP_GAP_DEFAULT_CANDIDATE_CAP,
  M4_LAMP_GAP_DEFAULT_SELECTED_CAP,
  createM4LampGapIndex,
  createM4LampGapTraceStore,
} from "./m4-lamp-gap-index";

describe("M4 authoritative lamp network owner store", () => {
  it("prepares and commits exact lamp-owned fields with dirty queue snapshot coverage", () => {
    const { store } = createLampFixture(4);
    drainDirty(store, 8);
    const read = lampInto();
    store.readLampInto(2, read);
    const prepared = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 10, reason: "lamp.fuel_changed" }),
      prepared,
    );
    expect(prepared).toMatchObject({ ok: true, dirtyMode: "append" });
    commitPreparedM4LampMutation(store, prepared);
    const snapshot = store.createSnapshot();
    expect(snapshot).toMatchObject({
      version: 2,
      dirtyCount: 1,
      nextDirtySequence: prepared.nextNextDirtySequence,
    });
    expect(snapshot.dirtyQueued[2]).toBe(1);
    expect(snapshot.dirtySequences[2]).toBe(prepared.nextDirtySequence);
  });
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

  it("fully resets caller-owned reads while preserving valid inactive query ids", () => {
    const store = createM4LampNetworkStore({ lampCapacity: 2, groupCapacity: 2, dirtyCapacity: 2 });
    expect(store.registerGroup(1)).toMatchObject({ ok: true });
    const output = lampInto();
    const identity = output;
    poisonLampInto(output);
    store.readLampInto(-1, output);
    expect(output).toStrictEqual({
      ...lampInto(),
      reason: "lamp_id_out_of_range",
      lampId: M4_LAMP_NONE,
      ownerVersion: 1,
      dirtyCapacity: 2,
      nextDirtySequence: 1,
    });
    poisonLampInto(output);
    store.readLampInto(0, output);
    expect(output).toStrictEqual({
      ...lampInto(),
      reason: "lamp_not_registered",
      lampId: 0,
      ownerVersion: 1,
      dirtyCapacity: 2,
      nextDirtySequence: 1,
    });
    expect(output).toBe(identity);
  });

  it("publishes every active Lamp and dirty-header field into the same output", () => {
    const { store } = createLampFixture(1);
    const output = lampInto();
    const identity = output;
    store.readLampInto(0, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      active: true,
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
      lampVersion: 3,
      ownerVersion: 3,
      groupVersion: 3,
      dirtyQueued: true,
      dirtyReason: "lamp.registered",
      dirtySequence: 1,
      dirtyCapacity: 1,
      dirtyHead: 0,
      dirtyCount: 1,
      nextDirtySequence: 2,
    });
    expect(output).toBe(identity);
  });

  it("rejects invalid prepare identities and scalar domains with a fully reset payload", () => {
    const { store } = createLampFixture(1);
    drainDirty(store, 1);
    const read = lampInto();
    store.readLampInto(0, read);
    const output = preparedLamp();
    const badMaintenance = lampPrepare(read);
    Reflect.set(badMaintenance, "nextMaintenanceState", 99);
    const cases: readonly [M4LampPrepareInput, string][] = [
      [lampPrepare(read, { lampId: -1 }), "lamp_id_out_of_range"],
      [lampPrepare(read, { expectedGroupId: 99 }), "lamp_group_out_of_range"],
      [lampPrepare(read, { expectedOwnerVersion: 0.5 }), "lamp_value_out_of_range"],
      [lampPrepare(read, { nextFuel: -1 }), "lamp_value_out_of_range"],
      [badMaintenance, "lamp_value_out_of_range"],
      [
        lampPrepare(read, {
          nextFuel: read.fuel + 1,
          reason: "lamp.maintenance_changed",
        }),
        "lamp_value_out_of_range",
      ],
    ];
    for (const [input, reason] of cases) {
      poisonPreparedLamp(output);
      store.prepareRefillOrMaintenanceInto(input, output);
      expect(output).toStrictEqual({ ...preparedLamp(), reason });
    }
  });

  it("freezes every prepare basis and resets reused prepared output", () => {
    const { store } = createLampFixture(2);
    drainDirty(store, 2);
    const read = lampInto();
    store.readLampInto(0, read);
    const base = lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" });
    const fields: readonly (keyof M4LampPrepareInput)[] = [
      "expectedGroupId",
      "expectedOwnerVersion",
      "expectedLampVersion",
      "expectedGroupVersion",
      "expectedFuel",
      "expectedWick",
      "expectedDamage",
      "expectedMaintenanceState",
      "expectedDirtySequence",
      "expectedDirtyCapacity",
      "expectedDirtyHead",
      "expectedDirtyCount",
      "expectedNextDirtySequence",
    ];
    const output = preparedLamp();
    const identity = output;
    for (const field of fields) {
      poisonPreparedLamp(output);
      const stale = { ...base };
      const current: unknown = Reflect.get(base, field);
      if (typeof current !== "number") throw new Error("expected numeric Lamp basis");
      Reflect.set(stale, field, current + 1);
      store.prepareRefillOrMaintenanceInto(stale, output);
      expect(output).toStrictEqual({
        ...preparedLamp(),
        reason: "lamp_projection_stale_basis",
      });
      expect(output).toBe(identity);
    }
    for (const input of [
      { ...base, expectedDirtyQueued: true },
      { ...base, expectedDirtyReason: "lamp.damage_changed" as const },
    ]) {
      poisonPreparedLamp(output);
      store.prepareRefillOrMaintenanceInto(input, output);
      expect(output).toStrictEqual({
        ...preparedLamp(),
        reason: "lamp_projection_stale_basis",
      });
    }
  });

  it("rejects invalid operation reasons and value directions before mutation", () => {
    const { store } = createLampFixture(1);
    drainDirty(store, 1);
    const read = lampInto();
    store.readLampInto(0, read);
    const before = store.createSnapshot();
    const output = preparedLamp();
    const invalid: readonly M4LampPrepareInput[] = [
      lampPrepare(read, { nextFuel: read.fuel - 1, reason: "lamp.fuel_changed" }),
      lampPrepare(read, { nextWick: read.wick - 1, reason: "lamp.wick_changed" }),
      lampPrepare(read, { nextDamage: read.damage + 1, reason: "lamp.damage_changed" }),
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.damage_changed" }),
    ];
    for (const input of invalid) {
      store.prepareRefillOrMaintenanceInto(input, output);
      expect(output.reason).toBe("lamp_value_out_of_range");
      expect(store.createSnapshot()).toStrictEqual(before);
    }
    const forged = lampPrepare(read);
    Reflect.set(forged, "reason", "lamp.registered");
    store.prepareRefillOrMaintenanceInto(forged, output);
    expect(output.reason).toBe("lamp_value_out_of_range");
    expect(store.createSnapshot()).toStrictEqual(before);
  });

  it("commits append and coalesce payloads exactly and preserves drained history", () => {
    const { store } = createLampFixture(2);
    drainDirty(store, 2);
    const read = lampInto();
    store.readLampInto(0, read);
    const append = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" }),
      append,
    );
    expect(append).toMatchObject({
      ok: true,
      changed: true,
      dirtyMode: "append",
      previousDirtyQueued: false,
      nextDirtyQueued: true,
      previousDirtyCount: 0,
      nextDirtyCount: 1,
      previousDirtyCapacity: 2,
      nextDirtyCapacity: 2,
    });
    commitPreparedM4LampMutation(store, append);
    store.readLampInto(0, read);
    const coalesce = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextWick: read.wick + 1, reason: "lamp.wick_changed" }),
      coalesce,
    );
    expect(coalesce).toMatchObject({
      ok: true,
      dirtyMode: "coalesce",
      previousDirtyCount: 1,
      nextDirtyCount: 1,
      previousNextDirtySequence: append.nextNextDirtySequence,
      nextNextDirtySequence: append.nextNextDirtySequence,
    });
    commitPreparedM4LampMutation(store, coalesce);
    const beforeDrain = store.createSnapshot();
    drainDirty(store, 1);
    const drained = store.createSnapshot();
    expect(drained.dirtyCount).toBe(0);
    expect(drained.dirtyQueue).toStrictEqual(beforeDrain.dirtyQueue);
    expect(drained.dirtyReasons).toStrictEqual(beforeDrain.dirtyReasons);
    expect(drained.dirtySequences).toStrictEqual(beforeDrain.dirtySequences);
  });

  it("allows authoritative noop at MAX and rejects new writes without mutation", () => {
    const { store } = createLampFixture(1);
    drainDirty(store, 1);
    setLampVersionState(store, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff);
    const read = lampInto();
    store.readLampInto(0, read);
    const before = store.createSnapshot();
    const noop = preparedLamp();
    store.prepareRefillOrMaintenanceInto(lampPrepare(read), noop);
    expect(noop).toMatchObject({ ok: true, changed: false, dirtyMode: "none" });
    commitPreparedM4LampMutation(store, noop);
    expect(store.createSnapshot()).toStrictEqual(before);
    const changed = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" }),
      changed,
    );
    expect(changed).toStrictEqual({ ...preparedLamp(), reason: "lamp_version_exhausted" });
    expect(store.createSnapshot()).toStrictEqual(before);
  });

  it("advances owner, row, group, and append sequence from FFFE to FFFF", () => {
    const { store } = createLampFixture(1);
    drainDirty(store, 1);
    setLampVersionState(store, 0xffff_fffe, 0xffff_fffe, 0xffff_fffe, 0xffff_fffe);
    const read = lampInto();
    store.readLampInto(0, read);
    const prepared = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" }),
      prepared,
    );
    expect(prepared).toMatchObject({
      ok: true,
      nextOwnerVersion: 0xffff_ffff,
      nextLampVersion: 0xffff_ffff,
      nextGroupVersion: 0xffff_ffff,
      nextNextDirtySequence: 0xffff_ffff,
    });
    commitPreparedM4LampMutation(store, prepared);
    expect(store.createSnapshot()).toMatchObject({
      ownerVersion: 0xffff_ffff,
      nextDirtySequence: 0xffff_ffff,
    });
  });

  it("rejects prepare queue-full and independently non-advancing row stamps", () => {
    const store = createM4LampNetworkStore({ lampCapacity: 2, groupCapacity: 2, dirtyCapacity: 1 });
    expect(store.registerGroup(1)).toMatchObject({ ok: true });
    expect(store.registerLamp(createLampInput({ lampId: 0 }))).toMatchObject({ ok: true });
    drainDirty(store, 1);
    expect(store.registerLamp(createLampInput({ lampId: 1 }))).toMatchObject({ ok: true });
    const read = lampInto();
    store.readLampInto(0, read);
    const output = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" }),
      output,
    );
    expect(output.reason).toBe("lamp_dirty_queue_full");

    drainDirty(store, 1);
    setLampVersionState(store, 0xffff_fffe, 0xffff_ffff, 0xffff_fffe, read.nextDirtySequence);
    store.readLampInto(0, read);
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" }),
      output,
    );
    expect(output.reason).toBe("lamp_version_exhausted");
    setLampVersionState(store, 0xffff_fffe, 0xffff_fffe, 0xffff_ffff, read.nextDirtySequence);
    store.readLampInto(0, read);
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" }),
      output,
    );
    expect(output.reason).toBe("lamp_version_exhausted");
  });

  it("coalesces at dirty-sequence MAX and appends through a wrapped ring tail", () => {
    const { store } = createLampFixture(2);
    drainDirty(store, 1);
    const queue: unknown = Reflect.get(store, "dirtyQueue");
    if (!(queue instanceof Uint32Array)) throw new Error("missing Lamp dirty ring");
    queue[0] = 77;
    const read = lampInto();
    store.readLampInto(0, read);
    const append = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextFuel: read.fuel + 1, reason: "lamp.fuel_changed" }),
      append,
    );
    expect(append).toMatchObject({ dirtyMode: "append", appendTail: 0, nextDirtyCount: 2 });
    commitPreparedM4LampMutation(store, append);
    expect(store.createSnapshot().dirtyQueue[0]).toBe(0);

    Reflect.set(store, "dirtySequence", 0xffff_ffff);
    store.readLampInto(0, read);
    const coalesce = preparedLamp();
    store.prepareRefillOrMaintenanceInto(
      lampPrepare(read, { nextWick: read.wick + 1, reason: "lamp.wick_changed" }),
      coalesce,
    );
    expect(coalesce).toMatchObject({
      ok: true,
      dirtyMode: "coalesce",
      previousNextDirtySequence: 0xffff_ffff,
      nextNextDirtySequence: 0xffff_ffff,
    });
  });

  it("rejects legacy append sequence exhaustion before any owner write", () => {
    const store = createM4LampNetworkStore({ lampCapacity: 2, groupCapacity: 2, dirtyCapacity: 2 });
    expect(store.registerGroup(1)).toMatchObject({ ok: true });
    Reflect.set(store, "dirtySequence", 0xffff_ffff);
    const beforeRegister = store.createSnapshot();
    expect(store.registerLamp(createLampInput({ lampId: 0 }))).toEqual({
      ok: false,
      reason: "lamp_version_exhausted",
    });
    expect(store.createSnapshot()).toStrictEqual(beforeRegister);

    Reflect.set(store, "dirtySequence", 1);
    expect(store.registerLamp(createLampInput({ lampId: 0 }))).toMatchObject({ ok: true });
    Reflect.set(store, "dirtySequence", 0xffff_ffff);
    expect(
      store.setRuleFields({ lampId: 0, fuel: 801, reason: "lamp.fuel_changed" }),
    ).toMatchObject({
      ok: true,
      changed: true,
    });
    expect(store.createSnapshot().nextDirtySequence).toBe(0xffff_ffff);
    drainDirty(store, 1);
    const beforeSet = store.createSnapshot();
    expect(store.setRuleFields({ lampId: 0, fuel: 802, reason: "lamp.fuel_changed" })).toEqual({
      ok: false,
      reason: "lamp_version_exhausted",
    });
    expect(store.createSnapshot()).toStrictEqual(beforeSet);
  });

  it("hashes every v2 Lamp row and physical dirty-ring lane deterministically", () => {
    const { store } = createLampFixture(2);
    const snapshot = store.createSnapshot();
    expect(snapshot).toMatchObject({ version: 2, dirtyCapacity: 2 });
    const fields = createM4LampNetworkHashFields(snapshot, "owner.lamp");
    const names = new Set<string>();
    for (const field of fields) names.add(field.name);
    expect(names.size).toBe(fields.length);
    expect(fields).toStrictEqual(createM4LampNetworkHashFields(snapshot, "owner.lamp"));
    const changedQueue = new Uint32Array(snapshot.dirtyQueue);
    changedQueue[0] = 1;
    expect(
      createM4LampNetworkHashFields({ ...snapshot, dirtyQueue: changedQueue }, "owner.lamp"),
    ).not.toStrictEqual(fields);
    const changedReason = new Uint8Array(snapshot.dirtyReasons);
    changedReason[0] = 4;
    expect(
      createM4LampNetworkHashFields({ ...snapshot, dirtyReasons: changedReason }, "owner.lamp"),
    ).not.toStrictEqual(fields);
    const changedSequence = new Uint32Array(snapshot.dirtySequences);
    changedSequence[0] = (changedSequence[0] ?? 0) + 1;
    expect(
      createM4LampNetworkHashFields({ ...snapshot, dirtySequences: changedSequence }, "owner.lamp"),
    ).not.toStrictEqual(fields);
    expect(
      createM4LampNetworkHashFields({ ...snapshot, dirtyHead: 1 }, "owner.lamp"),
    ).not.toStrictEqual(fields);
    expect(
      createM4LampNetworkHashFields({ ...snapshot, dirtyCount: 0 }, "owner.lamp"),
    ).not.toStrictEqual(fields);
    expect(
      createM4LampNetworkHashFields({ ...snapshot, nextDirtySequence: 99 }, "owner.lamp"),
    ).not.toStrictEqual(fields);
    expect(
      createM4LampNetworkHashFields({ ...snapshot, dirtyCapacity: 3 }, "owner.lamp"),
    ).not.toStrictEqual(fields);
    const changedQueued = new Uint8Array(snapshot.dirtyQueued);
    changedQueued[0] = changedQueued[0] === 1 ? 0 : 1;
    expect(
      createM4LampNetworkHashFields({ ...snapshot, dirtyQueued: changedQueued }, "owner.lamp"),
    ).not.toStrictEqual(fields);
  });

  it("publishes exact v2 lane lengths and canonical never-registered rows", () => {
    const store = createM4LampNetworkStore({ lampCapacity: 2, groupCapacity: 2, dirtyCapacity: 3 });
    const snapshot = store.createSnapshot();
    expect(snapshot.version).toBe(2);
    expect(snapshot.active).toHaveLength(2);
    expect(snapshot.groupActive).toHaveLength(2);
    expect(snapshot.groupLampCounts).toHaveLength(2);
    expect(snapshot.groupVersions).toHaveLength(2);
    for (const lane of [
      snapshot.groupIds,
      snapshot.cellIndexes,
      snapshot.roomIds,
      snapshot.chunkIndexes,
      snapshot.tagMasks,
      snapshot.fuels,
      snapshot.wicks,
      snapshot.damages,
      snapshot.maintenanceStates,
      snapshot.humanClaims,
      snapshot.shadowGaps,
      snapshot.lampVersions,
      snapshot.dirtyQueued,
      snapshot.dirtyReasons,
      snapshot.dirtySequences,
    ]) {
      expect(lane).toHaveLength(2);
    }
    expect(snapshot.dirtyQueue).toHaveLength(3);
    expect([...snapshot.active]).toStrictEqual([0, 0]);
    expect([...snapshot.groupIds]).toStrictEqual([M4_LAMP_NONE, M4_LAMP_NONE]);
    expect([...snapshot.cellIndexes]).toStrictEqual([M4_LAMP_NONE, M4_LAMP_NONE]);
    expect([...snapshot.roomIds]).toStrictEqual([M4_LAMP_NONE, M4_LAMP_NONE]);
    expect([...snapshot.chunkIndexes]).toStrictEqual([M4_LAMP_NONE, M4_LAMP_NONE]);
    expect([...snapshot.dirtyQueued]).toStrictEqual([0, 0]);
    expect([...snapshot.dirtyReasons]).toStrictEqual([0, 0]);
    expect([...snapshot.dirtySequences]).toStrictEqual([0, 0]);
  });
});

function lampInto(): M4LampIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    lampId: M4_LAMP_NONE,
    groupId: M4_LAMP_NONE,
    cellIndex: M4_LAMP_NONE,
    roomId: M4_LAMP_NONE,
    chunkIndex: M4_LAMP_NONE,
    tagMask: 0,
    fuel: 0,
    wick: 0,
    damage: 0,
    maintenanceState: M4_LAMP_MAINTENANCE_OK,
    humanClaim: 0,
    shadowGap: 0,
    lampVersion: 0,
    ownerVersion: 0,
    groupVersion: 0,
    dirtyQueued: false,
    dirtyReason: "lamp.registered",
    dirtySequence: 0,
    dirtyCapacity: 0,
    dirtyHead: 0,
    dirtyCount: 0,
    nextDirtySequence: 0,
  };
}

function preparedLamp(): PreparedM4LampMutation {
  return {
    ok: false,
    reason: undefined,
    lampId: M4_LAMP_NONE,
    groupId: M4_LAMP_NONE,
    changed: false,
    operationReasonCode: 0,
    previousFuel: 0,
    nextFuel: 0,
    previousWick: 0,
    nextWick: 0,
    previousDamage: 0,
    nextDamage: 0,
    previousMaintenanceState: M4_LAMP_MAINTENANCE_OK,
    nextMaintenanceState: M4_LAMP_MAINTENANCE_OK,
    previousOwnerVersion: 0,
    nextOwnerVersion: 0,
    previousLampVersion: 0,
    nextLampVersion: 0,
    previousGroupVersion: 0,
    nextGroupVersion: 0,
    previousDirtyQueued: false,
    nextDirtyQueued: false,
    previousDirtyReasonCode: 0,
    nextDirtyReasonCode: 0,
    previousDirtySequence: 0,
    nextDirtySequence: 0,
    previousDirtyHead: 0,
    nextDirtyHead: 0,
    previousDirtyCount: 0,
    nextDirtyCount: 0,
    previousDirtyCapacity: 0,
    nextDirtyCapacity: 0,
    previousNextDirtySequence: 0,
    nextNextDirtySequence: 0,
    dirtyMode: "none",
    appendTail: 0,
    nextDirtyPeak: 0,
  };
}

function lampPrepare(
  read: M4LampIntoOutput,
  overrides: Partial<M4LampPrepareInput> = {},
): M4LampPrepareInput {
  return {
    lampId: read.lampId,
    expectedGroupId: read.groupId,
    expectedOwnerVersion: read.ownerVersion,
    expectedLampVersion: read.lampVersion,
    expectedGroupVersion: read.groupVersion,
    expectedFuel: read.fuel,
    expectedWick: read.wick,
    expectedDamage: read.damage,
    expectedMaintenanceState: read.maintenanceState,
    expectedDirtyQueued: read.dirtyQueued,
    expectedDirtyReason: read.dirtyReason,
    expectedDirtySequence: read.dirtySequence,
    expectedDirtyCapacity: read.dirtyCapacity,
    expectedDirtyHead: read.dirtyHead,
    expectedDirtyCount: read.dirtyCount,
    expectedNextDirtySequence: read.nextDirtySequence,
    nextFuel: read.fuel,
    nextWick: read.wick,
    nextDamage: read.damage,
    nextMaintenanceState: read.maintenanceState,
    reason: "lamp.maintenance_changed",
    ...overrides,
  };
}

function poisonLampInto(output: M4LampIntoOutput): void {
  output.ok = true;
  output.reason = "lamp_projection_stale_basis";
  output.active = true;
  output.lampId = 77;
  output.groupId = 77;
  output.cellIndex = 77;
  output.roomId = 77;
  output.chunkIndex = 77;
  output.tagMask = 77;
  output.fuel = 77;
  output.wick = 77;
  output.damage = 77;
  output.maintenanceState = M4_LAMP_MAINTENANCE_NEEDS_FUEL;
  output.humanClaim = 77;
  output.shadowGap = 77;
  output.lampVersion = 77;
  output.ownerVersion = 77;
  output.groupVersion = 77;
  output.dirtyQueued = true;
  output.dirtyReason = "lamp.damage_changed";
  output.dirtySequence = 77;
  output.dirtyCapacity = 77;
  output.dirtyHead = 77;
  output.dirtyCount = 77;
  output.nextDirtySequence = 77;
}

function poisonPreparedLamp(output: PreparedM4LampMutation): void {
  const poisoned = preparedLamp();
  for (const key of Object.keys(poisoned)) {
    const value: unknown = Reflect.get(poisoned, key);
    if (typeof value === "number") Reflect.set(output, key, 77);
    else if (typeof value === "boolean") Reflect.set(output, key, true);
    else if (key === "dirtyMode") Reflect.set(output, key, "append");
    else if (key === "reason") Reflect.set(output, key, "lamp_dirty_queue_full");
  }
}

function setLampVersionState(
  store: M4LampNetworkStore,
  ownerVersion: number,
  lampVersion: number,
  groupVersion: number,
  dirtySequence: number,
): void {
  Reflect.set(store, "ownerVersionValue", ownerVersion);
  Reflect.set(store, "dirtySequence", dirtySequence);
  const lampVersions: unknown = Reflect.get(store, "lampVersions");
  const groupVersions: unknown = Reflect.get(store, "groupVersions");
  if (!(lampVersions instanceof Uint32Array) || !(groupVersions instanceof Uint32Array)) {
    throw new Error("missing Lamp version lanes");
  }
  lampVersions[0] = lampVersion;
  groupVersions[1] = groupVersion;
}

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
