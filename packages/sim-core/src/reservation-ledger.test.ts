import { describe, expect, it } from "vitest";

import {
  RESERVATION_CAPACITY,
  RESERVATION_CELL,
  RESERVATION_CLAIM_NONE,
  RESERVATION_ENTITY,
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  RESERVATION_LEDGER_SNAPSHOT_VERSION,
  createEntityRegistry,
  createJobCoreStore,
  createLocationStore,
  createMapGrid,
  createReservationLedger,
  initializeGameSessionRuntime,
  restoreReservationLedger,
  type EntityId,
  type ReservationAcquireIntoOutput,
  type ReservationAcquireIntoScratch,
  type ReservationClaimRequest,
  type ReservationClaimsIntoOutput,
  type ReservationLedgerSnapshotInput,
  type ReservationReleaseIntoOutput,
  type ReservationTransactionRequest,
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

  it("normalizes legacy generation zero and protects positive-generation claims", () => {
    const { registry, ledger, owner } = createFixture();
    const legacy = acquireOrThrow(ledger, registry, request(owner, 200, 1));
    const autonomous = acquireOrThrow(ledger, registry, request(owner, 201, 2, 17));
    expect(ledger.readRecord(legacy.claimIds[0] ?? -1)).toMatchObject({
      jobGeneration: 0,
      allocationEpoch: 1,
    });
    expect(ledger.readRecord(autonomous.claimIds[0] ?? -1)).toMatchObject({
      jobGeneration: 17,
      allocationEpoch: 2,
    });
    expect(ledger.createSnapshot()).toMatchObject({
      snapshotVersion: RESERVATION_LEDGER_SNAPSHOT_VERSION,
      records: [
        { jobGeneration: 0, allocationEpoch: 1 },
        { jobGeneration: 17, allocationEpoch: 2 },
      ],
    });
    expect(ledger.acquire(request(owner, 202, 3, 0), registry)).toStrictEqual({
      ok: false,
      reason: "reservation_claim_job_generation_mismatch",
    });

    expect(ledger.releaseReservationsForOwnerJob(owner, 201)).toMatchObject({
      ok: true,
      releasedCount: 0,
    });
    expect(ledger.activeCount).toBe(2);
    expect(ledger.releaseReservationsForOwnerJob(owner, 200)).toMatchObject({
      ok: true,
      releasedCount: 1,
    });
    const output = createReleaseIntoOutput();
    ledger.releaseClaimsInto(
      Uint32Array.of(autonomous.claimIds[0] ?? RESERVATION_CLAIM_NONE),
      Uint32Array.of(2),
      1,
      owner,
      201,
      17,
      ledger.version,
      output,
    );
    expect(output).toMatchObject({ ok: true, releasedCount: 1, activeCount: 0 });
  });

  it("reads all five exact claim channels into reusable fourteen-lane output", () => {
    const { registry, ledger, owner, item, buildSite } = createFixture();
    const createdTick = 0x1_0000_0000 + 5;
    const acquired = acquireOrThrow(ledger, registry, {
      owner,
      jobId: 210,
      jobGeneration: 9,
      createdTick,
      leaseExpiryTick: createdTick + 20,
      claims: [
        { channel: "entity", target: buildSite },
        { channel: "cell", cellIndex: 7 },
        { channel: "item_quantity", item, amount: 2, availableAmount: 8 },
        { channel: "interaction_spot", target: buildSite, spotId: 3 },
        { channel: "capacity", target: buildSite, capacityId: 4, amount: 3, capacity: 9 },
      ],
    });
    const claimIds = new Uint32Array(8);
    const epochs = new Uint32Array(8);
    claimIds.fill(77);
    epochs.fill(88);
    for (let index = 0; index < acquired.claimIds.length; index += 1) {
      claimIds[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
      epochs[index] = acquired.version;
    }
    const inputIdsBefore = claimIds.slice();
    const inputEpochsBefore = epochs.slice();
    const output = createClaimsIntoOutput();
    const identities = readClaimsLaneIdentities(output);
    output.channelCodes.fill(255);
    output.createdTicks.fill(-1);

    ledger.readActiveClaimsInto(claimIds, epochs, 5, owner, 210, 9, ledger.version, output);

    expect(output).toMatchObject({
      ok: true,
      claimCount: 5,
      version: 1,
      activeCount: 5,
    });
    expect([...output.channelCodes]).toEqual([
      RESERVATION_ENTITY,
      RESERVATION_CELL,
      RESERVATION_ITEM_QUANTITY,
      RESERVATION_INTERACTION_SPOT,
      RESERVATION_CAPACITY,
      0,
      0,
      0,
    ]);
    expect([...output.hasTargetFlags]).toEqual([1, 0, 1, 1, 1, 0, 0, 0]);
    expect([...output.cellIndexes]).toEqual([
      RESERVATION_CLAIM_NONE,
      7,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
    ]);
    expect([...output.slotIds]).toEqual([
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      3,
      4,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
    ]);
    expect([...output.amounts]).toEqual([0, 0, 2, 0, 3, 0, 0, 0]);
    expect([...output.jobGenerations]).toEqual([9, 9, 9, 9, 9, 0, 0, 0]);
    expect([...output.allocationEpochs]).toEqual([1, 1, 1, 1, 1, 0, 0, 0]);
    expect([...output.createdTicks]).toEqual([
      createdTick,
      createdTick,
      createdTick,
      createdTick,
      createdTick,
      0,
      0,
      0,
    ]);
    expectClaimsLaneIdentities(output, identities);
    expect(claimIds).toStrictEqual(inputIdsBefore);
    expect(epochs).toStrictEqual(inputEpochsBefore);
  });

  it("rejects exact release prefix failures before any claim or metric mutation", () => {
    const { registry, ledger, owner } = createFixture();
    const acquired = acquireOrThrow(ledger, registry, {
      owner,
      jobId: 220,
      jobGeneration: 5,
      createdTick: 1,
      leaseExpiryTick: 20,
      claims: [
        { channel: "cell", cellIndex: 10 },
        { channel: "cell", cellIndex: 11 },
        { channel: "cell", cellIndex: 12 },
      ],
    });
    const ids = Uint32Array.from(acquired.claimIds);
    const epochs = new Uint32Array([1, 1, 1]);
    const output = createReleaseIntoOutput();
    const beforeSnapshot = ledger.createSnapshot();
    const beforeMetrics = ledger.createMetrics();
    const assertFailure = (
      claimIds: Uint32Array,
      expectedEpochs: Uint32Array,
      count: number,
      expectedOwner: EntityId,
      jobId: number,
      generation: number,
      version: number,
      reason: string,
      claimIndex = RESERVATION_CLAIM_NONE,
    ): void => {
      ledger.releaseClaimsInto(
        claimIds,
        expectedEpochs,
        count,
        expectedOwner,
        jobId,
        generation,
        version,
        output,
      );
      expect(output).toMatchObject({ ok: false, reason, claimIndex, releasedCount: 0 });
      expect(ledger.createSnapshot()).toStrictEqual(beforeSnapshot);
      expect(ledger.createMetrics()).toStrictEqual(beforeMetrics);
    };

    for (const count of [0, -1, 1.5, 9]) {
      assertFailure(ids, epochs, count, owner, 220, 5, 1, "reservation_claim_count_invalid");
    }
    assertFailure(
      ids.subarray(0, 2),
      epochs,
      3,
      owner,
      220,
      5,
      1,
      "reservation_claim_count_invalid",
    );
    assertFailure(
      new Uint32Array([ids[0] ?? 0, ids[0] ?? 0, ids[2] ?? 0]),
      epochs,
      3,
      owner,
      220,
      5,
      1,
      "reservation_claim_duplicate",
      1,
    );
    for (let index = 0; index < 3; index += 1) {
      const invalid = ids.slice();
      invalid[index] = RESERVATION_CLAIM_NONE;
      assertFailure(invalid, epochs, 3, owner, 220, 5, 1, "reservation_claim_id_invalid", index);
    }
    assertFailure(
      ids,
      epochs,
      3,
      { ...owner, generation: owner.generation + 1 },
      220,
      5,
      1,
      "reservation_claim_owner_mismatch",
      0,
    );
    assertFailure(ids, epochs, 3, owner, 221, 5, 1, "reservation_claim_job_mismatch", 0);
    assertFailure(ids, epochs, 3, owner, 220, 6, 1, "reservation_claim_job_generation_mismatch", 0);
    assertFailure(
      ids,
      new Uint32Array([1, 2, 1]),
      3,
      owner,
      220,
      5,
      1,
      "reservation_claim_epoch_mismatch",
      1,
    );
    assertFailure(ids, epochs, 3, owner, 220, 5, 0, "reservation_ledger_version_mismatch");
  });

  it("rejects exact read failures without writing a partial prefix", () => {
    const { registry, ledger, owner } = createFixture();
    const acquired = acquireOrThrow(ledger, registry, {
      owner,
      jobId: 225,
      jobGeneration: 6,
      createdTick: 1,
      leaseExpiryTick: 20,
      claims: [
        { channel: "cell", cellIndex: 13 },
        { channel: "cell", cellIndex: 14 },
        { channel: "cell", cellIndex: 15 },
      ],
    });
    const ids = Uint32Array.from(acquired.claimIds);
    const output = createClaimsIntoOutput();
    const identities = readClaimsLaneIdentities(output);
    output.channelCodes.fill(99);
    output.jobIds.fill(99);

    ledger.readActiveClaimsInto(ids, new Uint32Array([1, 2, 1]), 3, owner, 225, 6, 1, output);

    expect(output).toMatchObject({
      ok: false,
      reason: "reservation_claim_epoch_mismatch",
      claimIndex: 1,
      claimId: ids[1],
      claimCount: 0,
      version: 1,
      activeCount: 3,
    });
    expect([...output.channelCodes]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...output.jobIds]).toEqual([
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
    ]);
    expectClaimsLaneIdentities(output, identities);

    const malformed = { ...createClaimsIntoOutput(), channelCodes: new Uint8Array(7) };
    ledger.readActiveClaimsInto(ids, new Uint32Array([1, 1, 1]), 3, owner, 225, 6, 1, malformed);
    expect(malformed).toMatchObject({
      ok: false,
      reason: "reservation_claim_output_too_small",
      claimCount: 0,
    });
    expect(ledger.activeCount).toBe(3);
  });

  it("releases full-capacity exact claims in reverse and preserves allocation order", () => {
    const registry = createEntityRegistry({ capacity: 2 });
    const owner = allocateOrThrow(registry);
    const ledger = createReservationLedger({ capacity: 8, entityCapacity: 2, cellCount: 32 });
    const claims: ReservationClaimRequest[] = [];
    for (let cellIndex = 0; cellIndex < 8; cellIndex += 1) {
      claims.push({ channel: "cell", cellIndex });
    }
    const acquired = acquireOrThrow(ledger, registry, {
      owner,
      jobId: 230,
      jobGeneration: 4,
      createdTick: 1,
      leaseExpiryTick: 10,
      claims,
    });
    const ids = Uint32Array.from(acquired.claimIds);
    const epochs = new Uint32Array(8);
    epochs.fill(acquired.version);
    const output = createReleaseIntoOutput();
    const identity = output;
    ledger.releaseClaimsInto(ids, epochs, 8, owner, 230, 4, 1, output);
    expect(output).toMatchObject({ ok: true, releasedCount: 8, version: 2, activeCount: 0 });
    expect(output).toBe(identity);
    expect(ledger.createMetrics()).toMatchObject({ releasedCount: 8, activeCount: 0 });

    const reacquired = acquireOrThrow(ledger, registry, {
      owner,
      jobId: 231,
      jobGeneration: 5,
      createdTick: 2,
      leaseExpiryTick: 11,
      claims,
    });
    expect(reacquired.claimIds).toEqual(acquired.claimIds);
    expect(reacquired.version).toBe(3);
    for (const claimId of reacquired.claimIds) {
      expect(ledger.readRecord(claimId)?.allocationEpoch).toBe(3);
    }
  });

  it("rejects recycled claim and job-slot ABA while accepting current exact custody", () => {
    const { registry, ledger, owner } = createFixture();
    const first = acquireOrThrow(ledger, registry, request(owner, 240, 5, 1));
    const firstId = first.claimIds[0] ?? RESERVATION_CLAIM_NONE;
    const released = createReleaseIntoOutput();
    ledger.releaseClaimsInto(
      Uint32Array.of(firstId),
      Uint32Array.of(1),
      1,
      owner,
      240,
      1,
      1,
      released,
    );
    expect(released.ok).toBe(true);
    const second = acquireOrThrow(ledger, registry, request(owner, 240, 6, 2));
    expect(second.claimIds[0]).toBe(firstId);
    expect(ledger.readRecord(firstId)).toMatchObject({ jobGeneration: 2, allocationEpoch: 3 });

    const stale = createReleaseIntoOutput();
    ledger.releaseClaimsInto(
      Uint32Array.of(firstId),
      Uint32Array.of(1),
      1,
      owner,
      240,
      2,
      3,
      stale,
    );
    expect(stale).toMatchObject({ ok: false, reason: "reservation_claim_epoch_mismatch" });
    ledger.releaseClaimsInto(
      Uint32Array.of(firstId),
      Uint32Array.of(3),
      1,
      owner,
      240,
      1,
      3,
      stale,
    );
    expect(stale).toMatchObject({
      ok: false,
      reason: "reservation_claim_job_generation_mismatch",
    });
    expect(ledger.releaseReservationsForOwnerJob(owner, 240)).toMatchObject({
      ok: true,
      releasedCount: 0,
    });
    ledger.releaseClaimsInto(
      Uint32Array.of(firstId),
      Uint32Array.of(3),
      1,
      owner,
      240,
      2,
      3,
      stale,
    );
    expect(stale).toMatchObject({ ok: true, releasedCount: 1, activeCount: 0 });
  });

  it("increments snapshot schema and rejects old, mixed, future and wrapped custody", () => {
    const { registry, ledger, owner } = createFixture();
    acquireOrThrow(ledger, registry, request(owner, 250, 8, 3));
    const snapshot = ledger.createSnapshot();
    expect(snapshot.snapshotVersion).toBe(2);
    expect(restoreReservationLedger(snapshot, registry).createSnapshot()).toStrictEqual(snapshot);
    expect(ledger.restoreFromSnapshot({ ...snapshot, snapshotVersion: 1 }, registry)).toStrictEqual(
      {
        ok: false,
        reason: "reservation_snapshot_version_unsupported",
      },
    );
    const record = snapshot.records[0] ?? failMissingRecord();
    const { allocationEpoch: _epoch, ...oldRecord } = record;
    void _epoch;
    const mixed = { ...snapshot, records: [oldRecord] };
    // @ts-expect-error Deliberately exercises a schema-v2 record with the epoch lane omitted.
    expect(ledger.restoreFromSnapshot(mixed, registry)).toMatchObject({
      ok: false,
      reason: "reservation_claim_epoch_mismatch",
    });
    for (const allocationEpoch of [0, snapshot.ledgerVersion + 1, 0x1_0000_0000]) {
      expect(
        ledger.restoreFromSnapshot(
          { ...snapshot, records: [{ ...record, allocationEpoch }] },
          registry,
        ),
      ).toMatchObject({ ok: false, reason: "reservation_claim_epoch_mismatch" });
    }
    expect(
      ledger.restoreFromSnapshot(
        { ...snapshot, records: [{ ...record, jobGeneration: 0x1_0000_0000 }] },
        registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_claim_job_generation_mismatch" });
  });

  it("enforces fffc-through-ffff acquire and release version boundaries", () => {
    for (const baseVersion of [0xffff_fffc, 0xffff_fffd]) {
      const { registry, ledger, owner } = createFixture();
      restoreVersionOrThrow(ledger, registry, baseVersion);
      const acquired = acquireOrThrow(ledger, registry, request(owner, 260, 1, 7));
      const claimId = acquired.claimIds[0] ?? RESERVATION_CLAIM_NONE;
      expect(acquired.version).toBe(baseVersion + 1);
      expect(ledger.readRecord(claimId)?.allocationEpoch).toBe(baseVersion + 1);
      const output = createReleaseIntoOutput();
      ledger.releaseClaimsInto(
        Uint32Array.of(claimId),
        Uint32Array.of(baseVersion + 1),
        1,
        owner,
        260,
        7,
        baseVersion + 1,
        output,
      );
      expect(output).toMatchObject({ ok: true, version: baseVersion + 2, activeCount: 0 });
    }

    for (const version of [0xffff_fffe, 0xffff_ffff]) {
      const { registry, ledger, owner } = createFixture();
      restoreVersionOrThrow(ledger, registry, version);
      const before = ledger.createMetrics();
      expect(ledger.acquire(request(owner, 261, 2, 7), registry)).toStrictEqual({
        ok: false,
        reason: "reservation_ledger_version_exhausted",
      });
      const claimIds = new Uint32Array(1);
      const output = createAcquireIntoOutput();
      ledger.acquireInto(
        request(owner, 262, 3, 7),
        registry,
        createAcquireIntoScratch(1),
        claimIds,
        output,
      );
      expect(output).toMatchObject({
        ok: false,
        reason: "reservation_ledger_version_exhausted",
        version,
      });
      expect(claimIds[0]).toBe(RESERVATION_CLAIM_NONE);
      expect(ledger.createMetrics()).toStrictEqual(before);
    }

    const { registry, ledger, owner } = createFixture();
    const acquired = acquireOrThrow(ledger, registry, request(owner, 263, 4, 7));
    const snapshot = ledger.createSnapshot();
    restoreSnapshotOrThrow(ledger, { ...snapshot, ledgerVersion: 0xffff_ffff }, registry);
    const claimId = acquired.claimIds[0] ?? RESERVATION_CLAIM_NONE;
    const readOutput = createClaimsIntoOutput();
    ledger.readActiveClaimsInto(
      Uint32Array.of(claimId),
      Uint32Array.of(1),
      1,
      owner,
      263,
      7,
      0xffff_ffff,
      readOutput,
    );
    expect(readOutput.ok).toBe(true);
    const releaseOutput = createReleaseIntoOutput();
    ledger.releaseClaimsInto(
      Uint32Array.of(claimId),
      Uint32Array.of(1),
      1,
      owner,
      263,
      7,
      0xffff_ffff,
      releaseOutput,
    );
    expect(releaseOutput).toMatchObject({
      ok: false,
      reason: "reservation_ledger_version_exhausted",
      releasedCount: 0,
    });
    expect(ledger.activeCount).toBe(1);
  });

  it("hashes job generation and allocation epoch as independent canonical facts", () => {
    const generationA = createRuntimeOrThrow("reservation-hash-generation");
    const generationB = createRuntimeOrThrow("reservation-hash-generation");
    acquireRuntimeCell(generationA, 270, 1, 20);
    acquireRuntimeCell(generationB, 270, 2, 20);
    expect(generationA.createWorldHash()).not.toBe(generationB.createWorldHash());
    expect(generationA.createReadModelHash()).not.toBe(generationB.createReadModelHash());

    const epochA = createRuntimeOrThrow("reservation-hash-epoch");
    const epochB = createRuntimeOrThrow("reservation-hash-epoch");
    const targetA = acquireRuntimeCell(epochA, 271, 3, 21);
    const unrelatedA = acquireRuntimeCell(epochA, 272, undefined, 22);
    epochA.owners.reservations.releaseClaims(unrelatedA.claimIds);
    const unrelatedB = acquireRuntimeCell(epochB, 272, undefined, 22);
    epochB.owners.reservations.releaseClaims(unrelatedB.claimIds);
    const targetB = acquireRuntimeCell(epochB, 271, 3, 21);
    expect(targetA.claimIds).toEqual(targetB.claimIds);
    expect(epochA.owners.reservations.version).toBe(epochB.owners.reservations.version);
    expect(epochA.owners.reservations.readRecord(0)?.allocationEpoch).toBe(1);
    expect(epochB.owners.reservations.readRecord(0)?.allocationEpoch).toBe(3);
    expect(epochA.createWorldHash()).not.toBe(epochB.createWorldHash());
    expect(epochA.createReadModelHash()).not.toBe(epochB.createReadModelHash());
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

type TestLedger = ReturnType<typeof createReservationLedger>;
type TestRegistry = ReturnType<typeof createEntityRegistry>;
type AcquiredReservation = Extract<ReturnType<TestLedger["acquire"]>, { readonly ok: true }>;
type TestGameSessionRuntime = Extract<
  ReturnType<typeof initializeGameSessionRuntime>,
  { readonly ok: true }
>["runtime"];
type ClaimsLaneIdentities = ReturnType<typeof readClaimsLaneIdentities>;

function request(
  owner: EntityId,
  jobId: number,
  cellIndex: number,
  jobGeneration?: number,
): ReservationTransactionRequest {
  const base = {
    owner,
    jobId,
    createdTick: 1,
    leaseExpiryTick: 30,
    claims: [{ channel: "cell" as const, cellIndex }],
  };
  return jobGeneration === undefined ? base : { ...base, jobGeneration };
}

function acquireOrThrow(
  ledger: TestLedger,
  registry: TestRegistry,
  transaction: ReservationTransactionRequest,
): AcquiredReservation {
  const result = ledger.acquire(transaction, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function createReleaseIntoOutput(): ReservationReleaseIntoOutput {
  return {
    ok: false,
    reason: undefined,
    claimIndex: 0,
    claimId: 0,
    releasedCount: 0,
    version: 0,
    activeCount: 0,
  };
}

function createClaimsIntoOutput(): ReservationClaimsIntoOutput {
  return {
    ok: false,
    reason: undefined,
    claimIndex: 0,
    claimId: 0,
    claimCount: 0,
    version: 0,
    activeCount: 0,
    channelCodes: new Uint8Array(8),
    ownerIndexes: new Uint32Array(8),
    ownerGenerations: new Uint32Array(8),
    jobIds: new Uint32Array(8),
    jobGenerations: new Uint32Array(8),
    hasTargetFlags: new Uint8Array(8),
    targetIndexes: new Uint32Array(8),
    targetGenerations: new Uint32Array(8),
    cellIndexes: new Uint32Array(8),
    slotIds: new Uint32Array(8),
    amounts: new Uint32Array(8),
    allocationEpochs: new Uint32Array(8),
    createdTicks: new Float64Array(8),
    leaseExpiryTicks: new Float64Array(8),
  };
}

function readClaimsLaneIdentities(output: ReservationClaimsIntoOutput): readonly object[] {
  return [
    output.channelCodes,
    output.ownerIndexes,
    output.ownerGenerations,
    output.jobIds,
    output.jobGenerations,
    output.hasTargetFlags,
    output.targetIndexes,
    output.targetGenerations,
    output.cellIndexes,
    output.slotIds,
    output.amounts,
    output.allocationEpochs,
    output.createdTicks,
    output.leaseExpiryTicks,
  ];
}

function expectClaimsLaneIdentities(
  output: ReservationClaimsIntoOutput,
  identities: ClaimsLaneIdentities,
): void {
  const after = readClaimsLaneIdentities(output);
  for (let index = 0; index < identities.length; index += 1) {
    expect(after[index]).toBe(identities[index]);
  }
}

function createAcquireIntoScratch(capacity: number): ReservationAcquireIntoScratch {
  return {
    channelCodes: new Uint8Array(capacity),
    keys: new Float64Array(capacity),
    amounts: new Uint32Array(capacity),
    limits: new Uint32Array(capacity),
    targetIndexes: new Uint32Array(capacity),
    targetGenerations: new Uint32Array(capacity),
    hasTargets: new Uint8Array(capacity),
    slots: new Uint32Array(capacity),
  };
}

function createAcquireIntoOutput(): ReservationAcquireIntoOutput {
  return {
    ok: false,
    reason: undefined,
    claimIndex: 0,
    conflictingClaimId: 0,
    claimCount: 0,
    version: 0,
    activeCount: 0,
  };
}

function restoreVersionOrThrow(
  ledger: TestLedger,
  registry: TestRegistry,
  ledgerVersion: number,
): void {
  restoreSnapshotOrThrow(ledger, { ...ledger.createSnapshot(), ledgerVersion }, registry);
}

function restoreSnapshotOrThrow(
  ledger: TestLedger,
  snapshot: ReservationLedgerSnapshotInput,
  registry: TestRegistry,
): void {
  const restored = ledger.restoreFromSnapshot(snapshot, registry);
  if (!restored.ok) throw new Error(restored.reason);
}

function createRuntimeOrThrow(seed: string): TestGameSessionRuntime {
  const initialized = initializeGameSessionRuntime({ seed });
  if (!initialized.ok) throw new Error(initialized.reason);
  return initialized.runtime;
}

function acquireRuntimeCell(
  runtime: TestGameSessionRuntime,
  jobId: number,
  jobGeneration: number | undefined,
  cellIndex: number,
): AcquiredReservation {
  const resident = runtime.owners.residents.read(0);
  if (resident === undefined) throw new Error("missing resident zero");
  return acquireOrThrow(
    runtime.owners.reservations,
    runtime.owners.entities,
    request(resident.entity, jobId, cellIndex, jobGeneration),
  );
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
