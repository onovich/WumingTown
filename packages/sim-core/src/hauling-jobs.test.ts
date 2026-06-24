import { describe, expect, it } from "vitest";

import {
  JOB_NONE,
  createEntityRegistry,
  createHaulingJobStore,
  createItemStackStore,
  createJobCoreStore,
  createReservationLedger,
  createStorageLogisticsIndex,
  createWorkOfferIndex,
  type EntityId,
} from "./index";

describe("minimal item storage hauling jobs", () => {
  it("keeps item quantities integer-owned and rejects negative or duplicate transfers", () => {
    const fixture = createFixture();

    expect(fixture.items.removeQuantity(0, 7, WOOD_DEF)).toStrictEqual({
      ok: false,
      reason: "item_stack_quantity_underflow",
    });
    expect(fixture.items.addQuantity(1, 7, WOOD_DEF)).toStrictEqual({
      ok: false,
      reason: "item_stack_capacity_exceeded",
    });

    expect(fixture.items.transferQuantity(0, 1, 4)).toMatchObject({ ok: true });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.items.readStack(1)).toMatchObject({ quantity: 4 });
    expect(fixture.items.createMetrics().totalQuantity).toBe(6);
  });

  it("refreshes demand and supply indexes after stack and reservation changes", () => {
    const fixture = createFixture();
    refreshAll(fixture);

    expect(fixture.storage.readSlot(0)).toMatchObject({
      availableSupply: 6,
      demandQuantity: 0,
      offerActive: true,
    });
    expect(fixture.storage.readSlot(1)).toMatchObject({
      availableCapacity: 6,
      demandQuantity: 6,
    });
    expect(fixture.offers.createMetrics().activeOfferCount).toBe(1);

    expect(
      fixture.ledger.acquire(
        {
          owner: fixture.pawns[0] ?? failMissingPawn(),
          jobId: 10,
          createdTick: 1,
          leaseExpiryTick: 30,
          claims: [
            {
              channel: "item_quantity",
              item: fixture.stackEntities[0] ?? failMissingEntity(),
              amount: 4,
              availableAmount: 6,
            },
            {
              channel: "capacity",
              target: fixture.storageEntities[1] ?? failMissingEntity(),
              capacityId: 1,
              amount: 4,
              capacity: 6,
            },
          ],
        },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.storage.markStackDirty(0)).toMatchObject({ ok: true });
    expect(fixture.storage.markSlotDirty(1)).toMatchObject({ ok: true });
    refreshAll(fixture);

    expect(fixture.storage.readSlot(0)).toMatchObject({ availableSupply: 2 });
    expect(fixture.storage.readSlot(1)).toMatchObject({
      reservedCapacity: 4,
      availableCapacity: 2,
      demandQuantity: 2,
    });
  });

  it("reserves source amount, destination capacity and interaction spots before pickup", () => {
    const fixture = createFixture();
    refreshAll(fixture);

    expect(createHaul(fixture, 0, 0, 4)).toMatchObject({ ok: true });
    expect(
      fixture.hauling.reserveBeforePickup(
        0,
        2,
        fixture.registry,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.ledger.createMetrics()).toMatchObject({
      activeCount: 4,
      itemQuantityReservationCount: 1,
      capacityReservationCount: 1,
      interactionReservationCount: 2,
    });
    expect(fixture.ledger.reservedAmountForItem(fixture.stackEntities[0] ?? failMissingEntity())).toBe(4);
    expect(fixture.ledger.reservedAmountForCapacity(fixture.storageEntities[1] ?? failMissingEntity(), 1)).toBe(4);

    expect(fixture.hauling.pickup(0, 3, fixture.items, fixture.storage, fixture.jobCore)).toMatchObject({
      ok: true,
    });
    expect(fixture.items.readStack(0, fixture.ledger)).toMatchObject({
      quantity: 2,
      reservedQuantity: 4,
      availableQuantity: 0,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({ carriedDefId: WOOD_DEF, carriedAmount: 4 });
  });

  it("prevents multiple haulers from reserving the same quantity", () => {
    const fixture = createFixture();
    refreshAll(fixture);

    expect(createHaul(fixture, 0, 0, 4)).toMatchObject({ ok: true });
    expect(createHaul(fixture, 1, 1, 4)).toMatchObject({ ok: true });
    expect(
      fixture.hauling.reserveBeforePickup(
        0,
        1,
        fixture.registry,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    refreshAll(fixture);

    expect(
      fixture.hauling.reserveBeforePickup(
        1,
        2,
        fixture.registry,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "hauling_source_unavailable" });
    expect(fixture.ledger.reservedAmountForItem(fixture.stackEntities[0] ?? failMissingEntity())).toBe(4);
    expect(fixture.ledger.createMetrics().activeCount).toBe(4);
  });

  it("returns carried items and releases reservations when cancelled after pickup", () => {
    const fixture = createFixture();
    refreshAll(fixture);

    expect(createHaul(fixture, 0, 0, 4)).toMatchObject({ ok: true });
    expect(
      fixture.hauling.reserveBeforePickup(
        0,
        1,
        fixture.registry,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(fixture.hauling.pickup(0, 2, fixture.items, fixture.storage, fixture.jobCore)).toMatchObject({
      ok: true,
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });

    expect(
      fixture.hauling.cancel(
        0,
        3,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 6 });
    expect(fixture.items.readStack(1)).toMatchObject({ quantity: 0 });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.hauling.readJob(0)).toMatchObject({
      step: "canceled",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({
      status: "canceled",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(totalWood(fixture)).toBe(6);
  });
});

const WOOD_DEF = 1;

interface Fixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly jobCore: ReturnType<typeof createJobCoreStore>;
  readonly hauling: ReturnType<typeof createHaulingJobStore>;
  readonly pawns: readonly EntityId[];
  readonly stackEntities: readonly EntityId[];
  readonly storageEntities: readonly EntityId[];
}

function createFixture(): Fixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const pawns = [allocate(registry), allocate(registry)];
  const stackEntities = [allocate(registry), allocate(registry)];
  const storageEntities = [allocate(registry), allocate(registry)];
  const items = createItemStackStore(4);
  const storage = createStorageLogisticsIndex(4, 4);
  const offers = createWorkOfferIndex({
    capacity: 4,
    workTypeCapacity: 2,
    regionCapacity: 4,
    defCapacity: 4,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });

  expect(
    items.createStack({
      stackId: 0,
      entity: stackEntities[0] ?? failMissingEntity(),
      defId: WOOD_DEF,
      quantity: 6,
      capacity: 8,
    }),
  ).toMatchObject({ ok: true });
  expect(
    items.createStack({
      stackId: 1,
      entity: stackEntities[1] ?? failMissingEntity(),
      defId: WOOD_DEF,
      quantity: 0,
      capacity: 6,
    }),
  ).toMatchObject({ ok: true });

  configureSlot(storage, registry, 0, storageEntities[0] ?? failMissingEntity(), 0, 6, 0);
  configureSlot(storage, registry, 1, storageEntities[1] ?? failMissingEntity(), 1, 0, 6);

  return {
    registry,
    items,
    storage,
    offers,
    ledger: createReservationLedger({ capacity: 64, entityCapacity: 16, cellCount: 64 }),
    jobCore: createJobCoreStore({ capacity: 8 }),
    hauling: createHaulingJobStore(8),
    pawns,
    stackEntities,
    storageEntities,
  };
}

function configureSlot(
  storage: ReturnType<typeof createStorageLogisticsIndex>,
  registry: ReturnType<typeof createEntityRegistry>,
  slotId: number,
  storageEntity: EntityId,
  stackId: number,
  quantity: number,
  desiredQuantity: number,
): void {
  expect(
    storage.configureSlot(
      {
        slotId,
        storage: storageEntity,
        stackId,
        defId: WOOD_DEF,
        capacity: quantity + desiredQuantity,
        desiredQuantity,
        interactionCellIndex: slotId + 10,
        offerId: slotId,
        workType: 0,
        regionId: 0,
        urgencyBucket: 0,
        permissionId: 0,
      },
      registry,
    ),
  ).toMatchObject({ ok: true });
}

function createHaul(
  fixture: Fixture,
  jobId: number,
  pawnIndex: number,
  amount: number,
): ReturnType<Fixture["hauling"]["createJob"]> {
  return fixture.hauling.createJob(
    {
      jobId,
      owner: fixture.pawns[pawnIndex] ?? failMissingPawn(),
      sourceSlotId: 0,
      destinationSlotId: 1,
      amount,
      createdTick: 0,
    },
    fixture.registry,
    fixture.jobCore,
  );
}

function refreshAll(fixture: Fixture): void {
  fixture.storage.refreshDirty(fixture.items, fixture.ledger, fixture.offers, 8);
}

function totalWood(fixture: Fixture): number {
  const source = fixture.items.readStack(0)?.quantity ?? 0;
  const destination = fixture.items.readStack(1)?.quantity ?? 0;
  const job = fixture.hauling.readJob(0);
  return source + destination + (job?.carriedAmount ?? 0);
}

function allocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.entity;
}

function failMissingPawn(): never {
  throw new Error("missing pawn");
}

function failMissingEntity(): never {
  throw new Error("missing entity");
}
