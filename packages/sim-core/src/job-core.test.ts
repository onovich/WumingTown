import { describe, expect, it } from "vitest";

import { createEntityRegistry } from "./entity-id";
import type { EntityId } from "./entity-id";
import {
  JOB_CORE_SNAPSHOT_VERSION,
  JOB_NONE,
  createJobCoreHashFields,
  createJobCoreStore,
  restoreJobCoreStore,
  type JobCreateInput,
  type JobFailureReason,
} from "./job-core";
import { createReservationLedger } from "./reservation-ledger";
import { formatCanonicalWorldHash } from "./world-hash";

describe("JobCoreStore", () => {
  it("records explicit enter, tick and complete fields without hidden execution state", () => {
    const { owner, store } = createFixture();
    expect(store.createJob(createJob({ owner, requiredWorkQ16: 10 }), undefined)).toMatchObject({
      ok: true,
      jobId: 0,
    });

    expect(store.enterStep(0, "interact", 5)).toMatchObject({ ok: true });
    expect(store.tickJob(0, 6, 4)).toMatchObject({
      ok: true,
      jobId: 0,
      progressQ16: 4,
      readyToComplete: false,
    });
    expect(store.tickJob(0, 7, 6)).toMatchObject({
      ok: true,
      jobId: 0,
      progressQ16: 10,
      readyToComplete: true,
    });

    const completed = store.completeJob(0, 8);
    expect(completed).toMatchObject({
      ok: true,
      releasedReservations: 0,
      clearedCarriedAmount: 0,
    });
    expect(store.readJob(0)).toMatchObject({
      status: "completed",
      step: "complete",
      failureReason: "none",
      stepEnteredTick: 8,
      stepTickCount: 2,
      progressQ16: 10,
      requiredWorkQ16: 10,
    });
  });

  it("applies interruption policies and shares cancellation cleanup", () => {
    const { owner, registry, store } = createFixture();
    const ledger = createReservationLedger({ capacity: 8, entityCapacity: 4, cellCount: 16 });
    expect(
      store.createJob(createJob({ jobId: 0, owner, interruptionPolicy: "never" }), registry),
    ).toMatchObject({
      ok: true,
    });
    expect(store.requestInterruption(0, "emergency", 1, ledger)).toEqual({
      ok: true,
      interrupted: false,
      jobId: 0,
      version: 1,
      reason: "job_interruption_denied",
    });

    expect(
      store.createJob(createJob({ jobId: 1, owner, interruptionPolicy: "immediate" }), registry),
    ).toMatchObject({ ok: true });
    expect(store.enterStep(1, "interact", 2)).toMatchObject({ ok: true });
    expect(store.setCarriedState(1, 7, 3)).toMatchObject({ ok: true });
    expect(
      ledger.acquire(
        {
          owner,
          jobId: 1,
          createdTick: 2,
          leaseExpiryTick: 20,
          claims: [{ channel: "cell", cellIndex: 3 }],
        },
        registry,
      ),
    ).toMatchObject({ ok: true });

    expect(store.requestInterruption(1, "immediate", 3, ledger)).toMatchObject({
      ok: true,
      interrupted: true,
      releasedReservations: 1,
      clearedCarriedAmount: 3,
    });
    expect(store.readJob(1)).toMatchObject({
      status: "canceled",
      failureReason: "cancelled",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(ledger.createMetrics().activeCount).toBe(0);
  });

  it("honors safe-point and emergency-only interruption policy boundaries", () => {
    const { owner, store } = createFixture();
    expect(
      store.createJob(createJob({ jobId: 0, owner, interruptionPolicy: "at_safe_point" })),
    ).toMatchObject({ ok: true });
    expect(store.requestInterruption(0, "immediate", 1)).toMatchObject({
      ok: true,
      interrupted: false,
      reason: "job_interruption_denied",
    });
    expect(store.requestInterruption(0, "safe_point", 2)).toMatchObject({
      ok: true,
      interrupted: true,
    });

    expect(
      store.createJob(createJob({ jobId: 1, owner, interruptionPolicy: "emergency_only" })),
    ).toMatchObject({ ok: true });
    expect(store.requestInterruption(1, "safe_point", 3)).toMatchObject({
      ok: true,
      interrupted: false,
      reason: "job_interruption_denied",
    });
    expect(store.requestInterruption(1, "emergency", 4)).toMatchObject({
      ok: true,
      interrupted: true,
    });
  });

  it("stores structured failure reason classes", () => {
    const reasons: readonly JobFailureReason[] = [
      "permission",
      "material",
      "reservation",
      "path",
      "risk",
      "time",
      "target_state",
    ];
    const { owner, store } = createFixture(16);

    for (let index = 0; index < reasons.length; index += 1) {
      const reason = reasons[index] ?? "path";
      expect(store.createJob(createJob({ jobId: index, owner }))).toMatchObject({ ok: true });
      expect(store.failJob(index, index + 10, reason)).toMatchObject({ ok: true });
      expect(store.readJob(index)).toMatchObject({
        status: "failed",
        failureReason: reason,
      });
    }
  });

  it("round trips save/load at the same explicit step and preserves canonical job hash", () => {
    const { owner, registry, store } = createFixture();
    expect(
      store.createJob(
        createJob({
          owner,
          requiredWorkQ16: 20,
          interruptionPolicy: "at_safe_point",
          createdTick: 4,
        }),
        registry,
      ),
    ).toMatchObject({ ok: true });
    expect(store.enterStep(0, "path_to_source", 5)).toMatchObject({ ok: true });
    expect(store.tickJob(0, 6, 7)).toMatchObject({ ok: true });
    expect(store.setCarriedState(0, 11, 2)).toMatchObject({ ok: true });

    const snapshot = store.createSnapshot();
    const hashBefore = hashJobSnapshot(snapshot);
    const restored = restoreJobCoreStore(snapshot, registry);
    const hashAfter = hashJobSnapshot(restored.createSnapshot());

    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    expect(hashAfter).toBe(hashBefore);
    expect(restored.readJob(0)).toMatchObject({
      status: "running",
      step: "path_to_source",
      interruptionPolicy: "at_safe_point",
      progressQ16: 7,
      carriedDefId: 11,
      carriedAmount: 2,
    });
  });

  it("fails unsupported restore input closed without clearing existing jobs", () => {
    const { owner, store } = createFixture();
    expect(store.createJob(createJob({ owner }))).toMatchObject({ ok: true });
    const snapshot = store.createSnapshot();
    const restored = store.restoreFromSnapshot({
      ...snapshot,
      snapshotVersion: JOB_CORE_SNAPSHOT_VERSION + 1,
    });

    expect(restored).toEqual({ ok: false, reason: "job_snapshot_version_unsupported" });
    expect(store.readJob(0)).toMatchObject({
      status: "ready",
      owner,
    });
  });

  it("rejects malformed restore payloads without throwing or mutating existing jobs", () => {
    const { owner, store } = createFixture();
    expect(store.createJob(createJob({ owner }))).toMatchObject({ ok: true });
    const snapshot = store.createSnapshot();
    const firstRecord = snapshot.records[0];

    if (firstRecord === undefined) {
      throw new Error("expected fixture snapshot record");
    }

    expect(
      restoreUnknown(store, {
        snapshotVersion: JOB_CORE_SNAPSHOT_VERSION,
        capacity: snapshot.capacity,
        storeVersion: snapshot.storeVersion,
        activeCount: snapshot.activeCount,
      }),
    ).toEqual({ ok: false, reason: "job_snapshot_shape_invalid" });
    expect(store.readJob(0)).toMatchObject({ status: "ready", owner });

    expect(
      restoreUnknown(store, {
        ...snapshot,
        records: [
          {
            ...firstRecord,
            owner: undefined,
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "job_snapshot_record_invalid" });
    expect(store.readJob(0)).toMatchObject({ status: "ready", owner });

    expect(
      restoreUnknown(store, {
        ...snapshot,
        storeVersion: "bad",
      }),
    ).toEqual({ ok: false, reason: "job_snapshot_shape_invalid" });
    expect(store.createSnapshot()).toStrictEqual(snapshot);
  });
});

function createFixture(capacity = 8): {
  readonly owner: EntityId;
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly store: ReturnType<typeof createJobCoreStore>;
} {
  const registry = createEntityRegistry({ capacity: 4 });
  const allocated = registry.allocate();

  if (!allocated.ok) {
    throw new Error(allocated.reason);
  }

  return {
    owner: allocated.entity,
    registry,
    store: createJobCoreStore({ capacity }),
  };
}

function createJob(overrides: Partial<JobCreateInput> = {}): JobCreateInput {
  return {
    jobId: 0,
    owner: { index: 0, generation: 1 },
    jobKind: 1,
    targetId: 10,
    initialStep: "reserve",
    interruptionPolicy: "immediate",
    requiredWorkQ16: 0,
    createdTick: 0,
    ...overrides,
  };
}

function hashJobSnapshot(
  snapshot: ReturnType<ReturnType<typeof createJobCoreStore>["createSnapshot"]>,
): string {
  return formatCanonicalWorldHash({
    fields: createJobCoreHashFields(snapshot),
    randomStreams: [],
    queuedCommands: [],
  });
}

function restoreUnknown(
  store: ReturnType<typeof createJobCoreStore>,
  payload: unknown,
): ReturnType<ReturnType<typeof createJobCoreStore>["restoreFromSnapshot"]> {
  return store.restoreFromSnapshot(payload);
}
