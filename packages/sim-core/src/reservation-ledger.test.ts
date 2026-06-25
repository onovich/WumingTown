import { describe, expect, it } from "vitest";

import {
  RESERVATION_ITEM_QUANTITY,
  createEntityRegistry,
  createJobCoreStore,
  createLocationStore,
  createMapGrid,
  createReservationLedger,
  restoreReservationLedger,
  type EntityId,
  type ReservationClaimRequest,
} from "./index";

describe("reservation ledger", () => {
  it("acquires multi-target transactions atomically without partial conflict state", () => {
    const { registry, ledger, owner, item, buildSite } = createFixture();
    const acquired = ledger.acquire(
      {
        owner,
        jobId: 10,
        createdTick: 12,
        leaseExpiryTick: 90,
        claims: [
          { channel: "item_quantity", item, amount: 4, availableAmount: 10 },
          { channel: "cell", cellIndex: 7 },
          { channel: "capacity", target: buildSite, capacityId: 0, amount: 4, capacity: 8 },
          { channel: "interaction_spot", target: buildSite, spotId: 1 },
        ],
      },
      registry,
    );

    expect(acquired).toMatchObject({ ok: true, activeCount: 4 });
    expect(ledger.reservedAmountForItem(item)).toBe(4);
    expect(ledger.reservedAmountForCapacity(buildSite, 0)).toBe(4);

    const before = ledger.createMetrics();
    const conflicted = ledger.acquire(
      {
        owner: allocateOrThrow(registry),
        jobId: 11,
        createdTick: 13,
        leaseExpiryTick: 91,
        claims: [
          { channel: "item_quantity", item, amount: 2, availableAmount: 10 },
          { channel: "cell", cellIndex: 7 },
        ],
      },
      registry,
    );

    expect(conflicted).toMatchObject({
      ok: false,
      reason: "reservation_cell_conflict",
      claimIndex: 1,
    });
    expect(ledger.createMetrics()).toMatchObject({
      activeCount: before.activeCount,
      itemQuantityReservationCount: before.itemQuantityReservationCount,
      cellReservationCount: before.cellReservationCount,
    });
    expect(ledger.reservedAmountForItem(item)).toBe(4);
  });

  it("distinguishes item quantity and capacity conflicts", () => {
    const { registry, ledger, owner, item, buildSite } = createFixture();

    expect(
      ledger.acquire(
        {
          owner,
          jobId: 20,
          createdTick: 1,
          leaseExpiryTick: 10,
          claims: [{ channel: "item_quantity", item, amount: 6, availableAmount: 6 }],
        },
        registry,
      ).ok,
    ).toBe(true);

    expect(
      ledger.acquire(
        {
          owner: allocateOrThrow(registry),
          jobId: 21,
          createdTick: 2,
          leaseExpiryTick: 11,
          claims: [{ channel: "item_quantity", item, amount: 1, availableAmount: 6 }],
        },
        registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_item_quantity_conflict" });

    expect(
      ledger.acquire(
        {
          owner: allocateOrThrow(registry),
          jobId: 22,
          createdTick: 2,
          leaseExpiryTick: 11,
          claims: [
            { channel: "capacity", target: buildSite, capacityId: 0, amount: 6, capacity: 8 },
          ],
        },
        registry,
      ).ok,
    ).toBe(true);

    expect(
      ledger.acquire(
        {
          owner: allocateOrThrow(registry),
          jobId: 23,
          createdTick: 3,
          leaseExpiryTick: 12,
          claims: [
            { channel: "capacity", target: buildSite, capacityId: 0, amount: 3, capacity: 8 },
          ],
        },
        registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_capacity_conflict" });
  });

  it("records owner, job, channel, amounts and lease metadata then releases explicitly", () => {
    const { registry, ledger, owner, item } = createFixture();
    const result = ledger.acquire(
      {
        owner,
        jobId: 30,
        createdTick: 40,
        leaseExpiryTick: 100,
        claims: [{ channel: "item_quantity", item, amount: 3, availableAmount: 5 }],
      },
      registry,
    );

    if (!result.ok) {
      throw new Error(result.reason);
    }

    const record = ledger.readRecord(result.claimIds[0] ?? -1);
    expect(record).toMatchObject({
      channel: "item_quantity",
      channelCode: RESERVATION_ITEM_QUANTITY,
      owner,
      target: item,
      jobId: 30,
      amount: 3,
      createdTick: 40,
      leaseExpiryTick: 100,
    });

    expect(ledger.releaseReservationsForOwnerJob(owner, 30)).toMatchObject({
      ok: true,
      releasedCount: 1,
      activeCount: 0,
    });
    expect(ledger.reservedAmountForItem(item)).toBe(0);
  });

  it("rejects stale entity generations before mutation", () => {
    const registry = createEntityRegistry({ capacity: 2 });
    const ledger = createReservationLedger({ capacity: 8, entityCapacity: 2, cellCount: 16 });
    const owner = allocateOrThrow(registry);
    const staleTarget = allocateOrThrow(registry);

    expect(registry.destroy(staleTarget).ok).toBe(true);
    const reused = allocateOrThrow(registry);
    expect(reused.index).toBe(staleTarget.index);
    expect(reused.generation).toBe(staleTarget.generation + 1);

    expect(
      ledger.acquire(
        {
          owner,
          jobId: 40,
          createdTick: 1,
          leaseExpiryTick: 2,
          claims: [{ channel: "entity", target: staleTarget }],
        },
        registry,
      ),
    ).toStrictEqual({
      ok: false,
      reason: "reservation_target_generation_mismatch",
      claimIndex: 0,
    });
    expect(ledger.activeCount).toBe(0);
  });

  it("connects destroy cleanup through the location lifecycle hook", () => {
    const registry = createEntityRegistry({ capacity: 4 });
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    const ledger = createReservationLedger({ capacity: 8, entityCapacity: 4, cellCount: 16 });
    const locations = createLocationStore({
      capacity: 4,
      width: 4,
      height: 4,
      chunkSize: 2,
      lifecycleHooks: ledger,
    });
    const owner = allocateOrThrow(registry);
    const target = allocateOrThrow(registry);

    expect(locations.placeOnMap(target, registry, grid, 1, 1).ok).toBe(true);
    expect(
      ledger.acquire(
        {
          owner,
          jobId: 50,
          createdTick: 1,
          leaseExpiryTick: 12,
          claims: [
            { channel: "entity", target },
            { channel: "interaction_spot", target, spotId: 0 },
          ],
        },
        registry,
      ).ok,
    ).toBe(true);
    expect(ledger.activeCount).toBe(2);

    expect(locations.destroyAndCleanup(target, registry, grid)).toMatchObject({
      ok: true,
      reservationCleanupCount: 2,
    });
    expect(ledger.activeCount).toBe(0);
    expect(ledger.createMetrics()).toMatchObject({ releasedCount: 2 });
  });

  it("round trips active claims through the reservation snapshot section", () => {
    const { registry, ledger, owner, item, buildSite } = createFixture();
    const acquired = ledger.acquire(
      {
        owner,
        jobId: 60,
        createdTick: 5,
        leaseExpiryTick: 45,
        claims: [
          { channel: "item_quantity", item, amount: 2, availableAmount: 10 },
          { channel: "capacity", target: buildSite, capacityId: 3, amount: 2, capacity: 4 },
          { channel: "cell", cellIndex: 4 },
        ],
      },
      registry,
    );

    expect(acquired.ok).toBe(true);
    const snapshot = ledger.createSnapshot();
    const restored = restoreReservationLedger(snapshot, registry);

    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    expect(restored.reservedAmountForItem(item)).toBe(2);
    expect(restored.reservedAmountForCapacity(buildSite, 3)).toBe(2);
  });

  it("rejects unsupported snapshot versions without mutating the current ledger", () => {
    const { registry, ledger, owner, item } = createFixture();
    const acquired = ledger.acquire(
      {
        owner,
        jobId: 70,
        createdTick: 5,
        leaseExpiryTick: 45,
        claims: [{ channel: "item_quantity", item, amount: 2, availableAmount: 10 }],
      },
      registry,
    );

    expect(acquired.ok).toBe(true);
    const before = ledger.createSnapshot();
    const unsupportedSnapshot = { ...before, snapshotVersion: 999 };

    expect(ledger.restoreFromSnapshot(unsupportedSnapshot, registry)).toStrictEqual({
      ok: false,
      reason: "reservation_snapshot_version_unsupported",
    });
    expect(ledger.createSnapshot()).toStrictEqual(before);
  });

  it("rejects invalid snapshot records without clearing existing claims", () => {
    const { registry, ledger, owner, item } = createFixture();
    const acquired = ledger.acquire(
      {
        owner,
        jobId: 80,
        createdTick: 5,
        leaseExpiryTick: 45,
        claims: [{ channel: "item_quantity", item, amount: 2, availableAmount: 10 }],
      },
      registry,
    );

    expect(acquired.ok).toBe(true);
    const before = ledger.createSnapshot();
    const firstRecord = before.records[0] ?? failMissingRecord();
    const invalidSnapshot = {
      ...before,
      records: [{ ...firstRecord, claimId: before.capacity }],
    };

    expect(ledger.restoreFromSnapshot(invalidSnapshot, registry)).toStrictEqual({
      ok: false,
      reason: "reservation_claim_id_invalid",
      claimId: before.capacity,
    });
    expect(ledger.createSnapshot()).toStrictEqual(before);
  });

  it("keeps deterministic contention bounded without leaked partials", () => {
    const registry = createEntityRegistry({ capacity: 16 });
    const owners = allocateMany(registry, 4);
    const targets = allocateMany(registry, 4);
    const ledger = createReservationLedger({ capacity: 64, entityCapacity: 16, cellCount: 32 });
    let state = 0x1234_5678;
    let accepted = 0;
    let rejected = 0;

    for (let step = 0; step < 128; step += 1) {
      state = nextDeterministic(state);
      const owner = owners[state % owners.length] ?? failMissingEntity();
      state = nextDeterministic(state);
      const target = targets[state % targets.length] ?? failMissingEntity();
      const beforeActive = ledger.activeCount;
      const beforeReserved = ledger.reservedAmountForCapacity(target, 0);
      const amount = (state % 3) + 1;
      const result = ledger.acquire(
        {
          owner,
          jobId: step,
          createdTick: step,
          leaseExpiryTick: step + 30,
          claims: [{ channel: "capacity", target, capacityId: 0, amount, capacity: 7 }],
        },
        registry,
      );

      if (result.ok) {
        accepted += 1;
      } else {
        rejected += 1;
        expect(ledger.activeCount).toBe(beforeActive);
        expect(ledger.reservedAmountForCapacity(target, 0)).toBe(beforeReserved);
      }

      expect(ledger.reservedAmountForCapacity(target, 0)).toBeLessThanOrEqual(7);

      if (step % 5 === 4) {
        const released = ledger.releaseReservationsForOwnerJob(owner, step - 4);
        expect(released.ok).toBe(true);
      }
    }

    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    expect(ledger.createMetrics().capacityReservationCount).toBe(ledger.activeCount);
  });

  it("keeps m2-reservation-contention multi-channel claims all-or-nothing", () => {
    const { registry, ledger, owner, item, buildSite } = createFixture();
    const acquired = ledger.acquire(
      {
        owner,
        jobId: 90,
        createdTick: 1,
        leaseExpiryTick: 60,
        claims: [
          { channel: "entity", target: buildSite },
          { channel: "cell", cellIndex: 9 },
          { channel: "item_quantity", item, amount: 4, availableAmount: 10 },
          { channel: "interaction_spot", target: buildSite, spotId: 2 },
          { channel: "capacity", target: buildSite, capacityId: 3, amount: 4, capacity: 8 },
        ],
      },
      registry,
    );

    expect(acquired).toMatchObject({ ok: true, activeCount: 5 });

    const assertConflictIsAtomic = (
      index: number,
      claim: ReservationClaimRequest,
      reason: string,
    ): void => {
      const before = ledger.createMetrics();
      const result = ledger.acquire(
        {
          owner: allocateOrThrow(registry),
          jobId: 91 + index,
          createdTick: 2 + index,
          leaseExpiryTick: 80 + index,
          claims: [{ channel: "cell", cellIndex: 20 + index }, claim],
        },
        registry,
      );

      expect(result).toMatchObject({
        ok: false,
        reason,
        claimIndex: 1,
      });
      expect(ledger.createMetrics()).toMatchObject({
        activeCount: before.activeCount,
        entityReservationCount: before.entityReservationCount,
        cellReservationCount: before.cellReservationCount,
        itemQuantityReservationCount: before.itemQuantityReservationCount,
        interactionReservationCount: before.interactionReservationCount,
        capacityReservationCount: before.capacityReservationCount,
      });
      expect(ledger.reservedAmountForItem(item)).toBe(4);
      expect(ledger.reservedAmountForCapacity(buildSite, 3)).toBe(4);
    };

    assertConflictIsAtomic(
      0,
      { channel: "entity", target: buildSite },
      "reservation_entity_conflict",
    );
    assertConflictIsAtomic(1, { channel: "cell", cellIndex: 9 }, "reservation_cell_conflict");
    assertConflictIsAtomic(
      2,
      { channel: "item_quantity", item, amount: 2, availableAmount: 5 },
      "reservation_item_quantity_conflict",
    );
    assertConflictIsAtomic(
      3,
      { channel: "interaction_spot", target: buildSite, spotId: 2 },
      "reservation_interaction_conflict",
    );
    assertConflictIsAtomic(
      4,
      { channel: "capacity", target: buildSite, capacityId: 3, amount: 2, capacity: 5 },
      "reservation_capacity_conflict",
    );
  });

  it("distinguishes m2-reservation-contention stale, invalid and insufficient reasons", () => {
    const { registry, ledger, owner, item, buildSite } = createFixture();
    const staleTarget = allocateOrThrow(registry);

    expect(registry.destroy(staleTarget).ok).toBe(true);
    expect(allocateOrThrow(registry).generation).toBe(staleTarget.generation + 1);

    expect(
      ledger.acquire(
        {
          owner: { index: 99, generation: 0 },
          jobId: 100,
          createdTick: 1,
          leaseExpiryTick: 2,
          claims: [{ channel: "cell", cellIndex: 1 }],
        },
        registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_owner_index_out_of_range" });
    expect(
      ledger.acquire(
        {
          owner,
          jobId: 101,
          createdTick: 1,
          leaseExpiryTick: 2,
          claims: [{ channel: "entity", target: staleTarget }],
        },
        registry,
      ),
    ).toMatchObject({
      ok: false,
      reason: "reservation_target_generation_mismatch",
      claimIndex: 0,
    });
    expect(
      ledger.acquire(
        {
          owner,
          jobId: 102,
          createdTick: 1,
          leaseExpiryTick: 2,
          claims: [{ channel: "item_quantity", item, amount: 6, availableAmount: 5 }],
        },
        registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_insufficient_amount", claimIndex: 0 });
    expect(
      ledger.acquire(
        {
          owner,
          jobId: 103,
          createdTick: 1,
          leaseExpiryTick: 2,
          claims: [
            { channel: "capacity", target: buildSite, capacityId: 0, amount: 9, capacity: 8 },
          ],
        },
        registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_insufficient_capacity", claimIndex: 0 });
    expect(
      ledger.acquire(
        {
          owner,
          jobId: 104,
          createdTick: 1,
          leaseExpiryTick: 2,
          claims: [{ channel: "item_quantity", item, amount: 0, availableAmount: 5 }],
        },
        registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_amount_invalid", claimIndex: 0 });
    expect(ledger.activeCount).toBe(0);
  });

  it("releases complete fail and cancel job claims without lease expiry control flow", () => {
    const registry = createEntityRegistry({ capacity: 16 });
    const owners = allocateMany(registry, 3);
    const target = allocateOrThrow(registry);
    const ledger = createReservationLedger({ capacity: 32, entityCapacity: 16, cellCount: 32 });
    const jobs = createJobCoreStore({ capacity: 3 });

    for (let jobId = 0; jobId < owners.length; jobId += 1) {
      const owner = owners[jobId] ?? failMissingEntity();
      expect(
        jobs.createJob(
          {
            jobId,
            owner,
            jobKind: 1,
            targetId: target.index,
            initialStep: "reserve",
            interruptionPolicy: "immediate",
            requiredWorkQ16: 0,
            createdTick: 1,
          },
          registry,
        ).ok,
      ).toBe(true);
      expect(
        ledger.acquire(
          {
            owner,
            jobId,
            createdTick: 1,
            leaseExpiryTick: 999,
            claims: [{ channel: "cell", cellIndex: jobId }],
          },
          registry,
        ).ok,
      ).toBe(true);
    }

    expect(jobs.setCarriedState(2, 7, 3).ok).toBe(true);
    expect(ledger.activeCount).toBe(3);
    expect(jobs.completeJob(0, 10, ledger)).toMatchObject({ ok: true, releasedReservations: 1 });
    expect(jobs.failJob(1, 11, "target_state", ledger)).toMatchObject({
      ok: true,
      releasedReservations: 1,
    });
    expect(jobs.cancelJob(2, 12, ledger)).toMatchObject({
      ok: true,
      releasedReservations: 1,
      clearedCarriedAmount: 3,
    });
    expect(ledger.createMetrics()).toMatchObject({ activeCount: 0, releasedCount: 3 });
  });

  it("load rebuilds reservation claims or clears them without retaining stale active indexes", () => {
    const { registry, ledger, owner, item, buildSite } = createFixture();
    const acquired = ledger.acquire(
      {
        owner,
        jobId: 110,
        createdTick: 5,
        leaseExpiryTick: 45,
        claims: [
          { channel: "item_quantity", item, amount: 2, availableAmount: 10 },
          { channel: "capacity", target: buildSite, capacityId: 3, amount: 2, capacity: 4 },
        ],
      },
      registry,
    );

    expect(acquired.ok).toBe(true);
    const snapshot = ledger.createSnapshot();
    expect(
      ledger.restoreFromSnapshot(
        { ...snapshot, ledgerVersion: snapshot.ledgerVersion + 1, activeCount: 0, records: [] },
        registry,
      ),
    ).toMatchObject({ ok: true, activeCount: 0 });
    expect(ledger.reservedAmountForItem(item)).toBe(0);
    expect(ledger.reservedAmountForCapacity(buildSite, 3)).toBe(0);

    expect(ledger.restoreFromSnapshot(snapshot, registry)).toMatchObject({
      ok: true,
      activeCount: 2,
    });
    expect(ledger.reservedAmountForItem(item)).toBe(2);
    expect(ledger.reservedAmountForCapacity(buildSite, 3)).toBe(2);
  });

  it("rejects snapshot active-count mismatches without clearing current claims", () => {
    const { registry, ledger, owner, item } = createFixture();
    const acquired = ledger.acquire(
      {
        owner,
        jobId: 120,
        createdTick: 5,
        leaseExpiryTick: 45,
        claims: [{ channel: "item_quantity", item, amount: 2, availableAmount: 10 }],
      },
      registry,
    );

    expect(acquired.ok).toBe(true);
    const before = ledger.createSnapshot();
    expect(ledger.restoreFromSnapshot({ ...before, activeCount: 0 }, registry)).toStrictEqual({
      ok: false,
      reason: "reservation_capacity_invalid",
    });
    expect(ledger.createSnapshot()).toStrictEqual(before);
  });
});

function createFixture(): {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly owner: EntityId;
  readonly item: EntityId;
  readonly buildSite: EntityId;
} {
  const registry = createEntityRegistry({ capacity: 16 });
  const owner = allocateOrThrow(registry);
  const item = allocateOrThrow(registry);
  const buildSite = allocateOrThrow(registry);
  const ledger = createReservationLedger({ capacity: 32, entityCapacity: 16, cellCount: 64 });
  return { registry, ledger, owner, item, buildSite };
}

function allocateMany(
  registry: ReturnType<typeof createEntityRegistry>,
  count: number,
): readonly EntityId[] {
  const entities: EntityId[] = [];

  for (let index = 0; index < count; index += 1) {
    entities.push(allocateOrThrow(registry));
  }

  return entities;
}

function allocateOrThrow(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.entity;
}

function nextDeterministic(state: number): number {
  return (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
}

function failMissingEntity(): never {
  throw new Error("missing deterministic fixture entity");
}

function failMissingRecord(): never {
  throw new Error("missing reservation snapshot record");
}
