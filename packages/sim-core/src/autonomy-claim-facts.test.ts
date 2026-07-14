import { describe, expect, it } from "vitest";

import {
  HAULING_CLAIM_FACTS_DESCRIPTOR,
  HAULING_CLAIM_FACTS_WORK_TYPE,
  createHaulingClaimFactsHashFields,
  createHaulingClaimFactsIndex,
  readFoodClaimFactsInto,
  restoreHaulingClaimFactsIndex,
  type FoodClaimFactsIntoOutput,
  type HaulingClaimFactsIntoOutput,
  type HaulingClaimFactsInput,
} from "./autonomy-claim-facts";
import { createEntityRegistry, type EntityId } from "./entity-id";
import {
  commitPreparedItemStackQuantityAddition,
  commitPreparedItemStackQuantityRemoval,
  createItemStackHashFields,
  createItemStackStore,
  restoreItemStackStore,
  type ItemStackIntoOutput,
} from "./item-stack-store";
import type {
  ItemStackReadScratch,
  ItemStackQuantityAdditionPrepareInput,
  ItemStackQuantityRemovalPrepareInput,
  ItemStackSnapshot,
  PreparedItemStackQuantityRemoval,
} from "./index";
import { createM3FoodAvailabilityStore, type M3FoodPortionIntoOutput } from "./m3-food";
import { createReservationLedger } from "./reservation-ledger";
import { createStorageLogisticsIndex, type StorageSlotIntoOutput } from "./storage-logistics-index";
import { createWorkOfferIndex, type WorkOfferReadIntoOutput } from "./work-offers";
import { formatCanonicalWorldHash } from "./world-hash";

type ItemStackStoreFixture = ReturnType<typeof createItemStackStore>;
type ItemStackSnapshotRow = ItemStackSnapshot["rows"][number];
type HaulingFactsStoreFixture = ReturnType<typeof createHaulingClaimFactsIndex>;
type HaulingFactsSnapshot = ReturnType<HaulingFactsStoreFixture["createSnapshot"]>;
type HaulingFactsSnapshotRow = HaulingFactsSnapshot["rows"][number];

interface HaulingFactsFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly sourceItem: EntityId;
  readonly destinationItem: EntityId;
  readonly sourceStorage: EntityId;
  readonly destinationStorage: EntityId;
  readonly items: ItemStackStoreFixture;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
  readonly facts: HaulingFactsStoreFixture;
  readonly item: ItemStackIntoOutput;
  readonly input: HaulingClaimFactsInput;
  readonly scratch: {
    readonly offer: WorkOfferReadIntoOutput;
    readonly source: StorageSlotIntoOutput;
    readonly destination: StorageSlotIntoOutput;
    readonly item: ItemStackIntoOutput;
    readonly itemRead: ItemStackReadScratch;
  };
}

describe("autonomy claim facts", () => {
  it("reads exact food and ItemStack facts without treating stackId as an entity", () => {
    const registry = createEntityRegistry({ capacity: 16 });
    const item = registry.allocate();
    if (!item.ok) throw new Error("entity fixture failed");
    const items = createItemStackStore(8);
    const ledger = createReservationLedger({ capacity: 8, entityCapacity: 16, cellCount: 64 });
    const food = createM3FoodAvailabilityStore(8, 8, 4);
    expect(
      items.createStack({ stackId: 3, entity: item.entity, defId: 5, quantity: 9, capacity: 12 }),
    ).toMatchObject({ ok: true });
    expect(
      food.configurePortion({
        stackId: 3,
        foodDefId: 5,
        hungerRestore: 40,
        regionId: 1,
        storageSlotId: 2,
        targetCellIndex: 17,
        interactionSpotId: 4,
        scoreMilli: 900,
        permissionId: 0,
        mealWindowId: 1,
        mealWindowVersion: 2,
        safe: true,
        permissionAllowed: true,
        scheduleAllowed: true,
      }),
    ).toMatchObject({ ok: true });
    food.rebuildFromStores(items, ledger);
    const scratch = {
      item: createItemOutput(),
      itemRead: itemReadScratch(),
      portion: createPortionOutput(),
    };
    const output = createFoodOutput();
    readFoodClaimFactsInto(3, food.version, items, food, ledger, scratch, output);
    expect(output).toMatchObject({
      ok: true,
      stackId: 3,
      itemEntityIndex: item.entity.index,
      itemEntityGeneration: item.entity.generation,
      foodDefId: 5,
      quantity: 9,
      availableQuantity: 9,
      hungerRestore: 40,
      itemRowVersion: 1,
      itemStoreVersion: items.version,
      foodAvailabilityVersion: food.version,
      reservationVersion: ledger.version,
    });
  });

  it("prepares every ItemStack check before a non-failing quantity commit", () => {
    const registry = createEntityRegistry({ capacity: 4 });
    const item = registry.allocate();
    if (!item.ok) throw new Error("entity fixture failed");
    const items = createItemStackStore(2);
    const ledger = createReservationLedger({ capacity: 4, entityCapacity: 4, cellCount: 4 });
    items.createStack({ stackId: 1, entity: item.entity, defId: 2, quantity: 8, capacity: 10 });
    const read = createItemOutput();
    const readScratch = itemReadScratch();
    items.readStackInto(1, ledger, readScratch, read);
    const prepared = createPreparedRemoval();
    items.prepareAutonomousQuantityRemovalInto(
      {
        stackId: 1,
        entityIndex: read.entityIndex,
        entityGeneration: read.entityGeneration,
        defId: read.defId,
        quantity: read.quantity,
        reservedQuantity: read.reservedQuantity,
        ownedReservedQuantity: 0,
        availableQuantity: read.availableQuantity,
        capacity: read.capacity,
        amount: 3,
        expectedRowVersion: read.rowVersion,
        expectedStoreVersion: read.storeVersion,
        expectedReservationVersion: read.reservationVersion,
      },
      ledger,
      readScratch,
      prepared,
    );
    expect(prepared).toMatchObject({ ok: true, previousQuantity: 8, nextQuantity: 5 });
    commitPreparedItemStackQuantityRemoval(items, prepared);
    items.readStackInto(1, ledger, readScratch, read);
    expect(read).toMatchObject({ quantity: 5, rowVersion: 2, storeVersion: 2 });
  });

  it("fully resets caller-owned ItemStack reads before validating the query id", () => {
    const fixture = createItemPrepareFixture();
    const invalidStackIds = [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 0x1_0000_0000, 2];
    for (const stackId of invalidStackIds) {
      const output = poisonItemOutput();
      const identity = output;
      fixture.items.readStackInto(stackId, fixture.ledger, fixture.scratch, output);
      expect(output).toBe(identity);
      expect(output).toStrictEqual({
        ...createItemOutput(),
        reason: "item_stack_id_out_of_range",
        storeVersion: fixture.items.version,
        reservationVersion: fixture.ledger.version,
      });
    }

    const inactive = poisonItemOutput();
    fixture.items.readStackInto(1, fixture.ledger, fixture.scratch, inactive);
    expect(inactive).toStrictEqual({
      ...createItemOutput(),
      reason: "item_stack_not_active",
      stackId: 1,
      storeVersion: fixture.items.version,
      reservationVersion: fixture.ledger.version,
    });
  });

  it("round trips ItemStack row versions and hashes equal values with different bases differently", () => {
    const items = createItemStackStore(2);
    items.createStack({
      stackId: 1,
      entity: { index: 2, generation: 3 },
      defId: 4,
      quantity: 5,
      capacity: 8,
    });
    const snapshot = items.createSnapshot();
    expect(restoreItemStackStore(snapshot).createSnapshot()).toStrictEqual(snapshot);
    const row = snapshot.rows[1];
    if (row === undefined) throw new Error("missing item row");
    const rebased = itemSnapshotWithActiveRowVersions(
      snapshot,
      snapshot.storeVersion + 1,
      0,
      row.rowVersion + 1,
    );
    expect(hashItemSnapshot(rebased)).not.toBe(hashItemSnapshot(snapshot));
    expect(restoreItemStackStore(rebased).createSnapshot()).toStrictEqual(rebased);
  });

  it("resets caller-owned ItemStack prepare output and rejects every unsafe removal scalar", () => {
    const cases: readonly [
      string,
      (input: ItemStackQuantityRemovalPrepareInput) => void,
      string,
    ][] = [
      [
        "negative reservation version",
        (input): void => void Reflect.set(input, "expectedReservationVersion", -1),
        "item_stack_version_mismatch",
      ],
      [
        "fractional reservation version",
        (input): void => void Reflect.set(input, "expectedReservationVersion", 0.5),
        "item_stack_version_mismatch",
      ],
      [
        "NaN reservation version",
        (input): void => void Reflect.set(input, "expectedReservationVersion", Number.NaN),
        "item_stack_version_mismatch",
      ],
      [
        "infinite reservation version",
        (input): void =>
          void Reflect.set(input, "expectedReservationVersion", Number.POSITIVE_INFINITY),
        "item_stack_version_mismatch",
      ],
      [
        "wide reservation version",
        (input): void => void Reflect.set(input, "expectedReservationVersion", 0x1_0000_0000),
        "item_stack_version_mismatch",
      ],
      [
        "negative reserved",
        (input): void => void Reflect.set(input, "reservedQuantity", -1),
        "item_stack_quantity_invalid",
      ],
      [
        "fractional reserved",
        (input): void => void Reflect.set(input, "reservedQuantity", 0.5),
        "item_stack_quantity_invalid",
      ],
      [
        "wide reserved",
        (input): void => void Reflect.set(input, "reservedQuantity", 0x1_0000_0000),
        "item_stack_quantity_invalid",
      ],
      [
        "negative owned",
        (input): void => void Reflect.set(input, "ownedReservedQuantity", -1),
        "item_stack_quantity_invalid",
      ],
      [
        "fractional owned",
        (input): void => void Reflect.set(input, "ownedReservedQuantity", 0.5),
        "item_stack_quantity_invalid",
      ],
      [
        "wide owned",
        (input): void => void Reflect.set(input, "ownedReservedQuantity", 0x1_0000_0000),
        "item_stack_quantity_invalid",
      ],
      [
        "negative available",
        (input): void => void Reflect.set(input, "availableQuantity", -1),
        "item_stack_quantity_invalid",
      ],
      [
        "fractional available",
        (input): void => void Reflect.set(input, "availableQuantity", 0.5),
        "item_stack_quantity_invalid",
      ],
      [
        "wide available",
        (input): void => void Reflect.set(input, "availableQuantity", 0x1_0000_0000),
        "item_stack_quantity_invalid",
      ],
    ];
    for (const [, mutate, reason] of cases) {
      const fixture = createItemPrepareFixture();
      const input = { ...fixture.removal };
      mutate(input);
      const prepared = poisonPreparedRemoval();
      const identity = prepared;
      fixture.items.prepareAutonomousQuantityRemovalInto(
        input,
        fixture.ledger,
        fixture.scratch,
        prepared,
      );
      expect(prepared).toBe(identity);
      expect(prepared).toStrictEqual({ ...createPreparedRemoval(), reason });
    }
  });

  it("binds removal to the live ledger and rejects stale or conflicting reservation algebra", () => {
    const cases: readonly [
      string,
      (input: ItemStackQuantityRemovalPrepareInput) => void,
      string,
    ][] = [
      [
        "stale ledger",
        (input): void =>
          void Reflect.set(
            input,
            "expectedReservationVersion",
            input.expectedReservationVersion + 1,
          ),
        "item_stack_version_mismatch",
      ],
      [
        "fabricated reserved",
        (input): void => void Reflect.set(input, "reservedQuantity", 1),
        "item_stack_reservation_conflict",
      ],
      [
        "reserved above quantity",
        (input): void => void Reflect.set(input, "reservedQuantity", input.quantity + 1),
        "item_stack_reservation_conflict",
      ],
      [
        "owned above reserved",
        (input): void =>
          void Reflect.set(input, "ownedReservedQuantity", input.reservedQuantity + 1),
        "item_stack_reservation_conflict",
      ],
      [
        "fabricated available",
        (input): void => void Reflect.set(input, "availableQuantity", input.availableQuantity + 1),
        "item_stack_reservation_conflict",
      ],
      [
        "amount outside custody",
        (input): void =>
          void Reflect.set(
            input,
            "amount",
            input.availableQuantity + input.ownedReservedQuantity + 1,
          ),
        "item_stack_reservation_conflict",
      ],
    ];
    for (const [, mutate, reason] of cases) {
      const fixture = createItemPrepareFixture();
      const input = { ...fixture.removal };
      mutate(input);
      const before = fixture.items.createSnapshot();
      const prepared = createPreparedRemoval();
      fixture.scratch.entity.index = 99;
      fixture.scratch.entity.generation = 99;
      fixture.items.prepareAutonomousQuantityRemovalInto(
        input,
        fixture.ledger,
        fixture.scratch,
        prepared,
      );
      expect(prepared).toStrictEqual({ ...createPreparedRemoval(), reason });
      expect(fixture.scratch.entity).toStrictEqual({
        index: fixture.read.entityIndex,
        generation: fixture.read.entityGeneration,
      });
      expect(fixture.items.createSnapshot()).toStrictEqual(before);
    }
  });

  it("binds addition to the live ledger and resets invalid caller-owned output", () => {
    const cases: readonly [
      string,
      (input: ItemStackQuantityAdditionPrepareInput) => void,
      string,
    ][] = [
      [
        "stale ledger",
        (input): void =>
          void Reflect.set(
            input,
            "expectedReservationVersion",
            input.expectedReservationVersion + 1,
          ),
        "item_stack_version_mismatch",
      ],
      [
        "negative quantity",
        (input): void => void Reflect.set(input, "quantity", -1),
        "item_stack_quantity_invalid",
      ],
      [
        "fractional capacity",
        (input): void => void Reflect.set(input, "capacity", 0.5),
        "item_stack_capacity_invalid",
      ],
      [
        "zero amount",
        (input): void => void Reflect.set(input, "amount", 0),
        "item_stack_quantity_invalid",
      ],
      [
        "wide amount",
        (input): void => void Reflect.set(input, "amount", 0x1_0000_0000),
        "item_stack_quantity_invalid",
      ],
    ];
    for (const [, mutate, reason] of cases) {
      const fixture = createItemPrepareFixture();
      const input = { ...fixture.addition };
      mutate(input);
      const prepared = poisonPreparedRemoval();
      const before = fixture.items.createSnapshot();
      fixture.items.prepareAutonomousQuantityAdditionInto(input, fixture.ledger, prepared);
      expect(prepared).toStrictEqual({ ...createPreparedRemoval(), reason });
      expect(fixture.items.createSnapshot()).toStrictEqual(before);
    }
  });

  it("commits autonomous add and remove with one exact version bump through max", () => {
    const removalFixture = createItemPrepareFixture();
    const removed = createPreparedRemoval();
    removalFixture.items.prepareAutonomousQuantityRemovalInto(
      removalFixture.removal,
      removalFixture.ledger,
      removalFixture.scratch,
      removed,
    );
    expect(removed).toMatchObject({ ok: true, nextRowVersion: 2, nextStoreVersion: 2 });
    commitPreparedItemStackQuantityRemoval(removalFixture.items, removed);
    expect(removalFixture.items.createSnapshot()).toMatchObject({ storeVersion: 2 });

    const additionFixture = createItemPrepareFixture();
    const added = createPreparedRemoval();
    additionFixture.items.prepareAutonomousQuantityAdditionInto(
      additionFixture.addition,
      additionFixture.ledger,
      added,
    );
    expect(added).toMatchObject({ ok: true, nextRowVersion: 2, nextStoreVersion: 2 });
    commitPreparedItemStackQuantityAddition(additionFixture.items, added);

    for (const mode of ["remove", "add"] as const) {
      const fixture = createItemPrepareFixture();
      const snapshot = fixture.items.createSnapshot();
      const maxBasis = itemSnapshotWithVersions(snapshot, 0xffff_fffe, 0xffff_fffe);
      expect(fixture.items.restoreFromSnapshot(maxBasis)).toMatchObject({ ok: true });
      fixture.items.readStackInto(0, fixture.ledger, fixture.scratch, fixture.read);
      const prepared = createPreparedRemoval();
      if (mode === "remove") {
        fixture.items.prepareAutonomousQuantityRemovalInto(
          removalInputFromRead(fixture.read, 1),
          fixture.ledger,
          fixture.scratch,
          prepared,
        );
        commitPreparedItemStackQuantityRemoval(fixture.items, prepared);
      } else {
        fixture.items.prepareAutonomousQuantityAdditionInto(
          additionInputFromRead(fixture.read, 1),
          fixture.ledger,
          prepared,
        );
        commitPreparedItemStackQuantityAddition(fixture.items, prepared);
      }
      expect(prepared).toMatchObject({
        ok: true,
        nextRowVersion: 0xffff_ffff,
        nextStoreVersion: 0xffff_ffff,
      });
      fixture.items.readStackInto(0, fixture.ledger, fixture.scratch, fixture.read);
      const rejected = poisonPreparedRemoval();
      if (mode === "remove")
        fixture.items.prepareAutonomousQuantityRemovalInto(
          removalInputFromRead(fixture.read, 1),
          fixture.ledger,
          fixture.scratch,
          rejected,
        );
      else
        fixture.items.prepareAutonomousQuantityAdditionInto(
          additionInputFromRead(fixture.read, 1),
          fixture.ledger,
          rejected,
        );
      expect(rejected).toStrictEqual({
        ...createPreparedRemoval(),
        reason: "item_stack_version_exhausted",
      });
    }
  });

  it("keeps legacy mutations and distinct or same-row transfers atomic at version boundaries", () => {
    const distinct = createTransferFixture();
    expect(distinct.items.transferQuantity(0, 1, 3)).toMatchObject({ ok: true, version: 4 });
    expect(distinct.items.createSnapshot().rows).toMatchObject([
      { quantity: 5, rowVersion: 2 },
      { quantity: 5, rowVersion: 2 },
    ]);

    const same = createItemPrepareFixture();
    const sameBefore = same.items.createSnapshot();
    expect(same.items.transferQuantity(0, 0, 3)).toMatchObject({ ok: true, version: 3 });
    expect(same.items.createSnapshot().rows[0]).toMatchObject({ quantity: 8, rowVersion: 3 });
    expect(same.items.version).toBe(sameBefore.storeVersion + 2);

    const boundedDistinct = createTransferFixture();
    const boundedSnapshot = boundedDistinct.items.createSnapshot();
    expect(
      boundedDistinct.items.restoreFromSnapshot(
        itemSnapshotWithActiveRowVersions(boundedSnapshot, 0xffff_fffd, 0xffff_fffc, 1),
      ),
    ).toMatchObject({ ok: true });
    expect(boundedDistinct.items.transferQuantity(0, 1, 1)).toMatchObject({
      ok: true,
      version: 0xffff_ffff,
    });

    const boundedSame = createItemPrepareFixture();
    expect(
      boundedSame.items.restoreFromSnapshot(
        itemSnapshotWithVersions(boundedSame.items.createSnapshot(), 0xffff_fffd, 0xffff_fffd),
      ),
    ).toMatchObject({ ok: true });
    expect(boundedSame.items.transferQuantity(0, 0, 1)).toMatchObject({
      ok: true,
      version: 0xffff_ffff,
    });

    const exhaustedSame = createItemPrepareFixture();
    expect(
      exhaustedSame.items.restoreFromSnapshot(
        itemSnapshotWithVersions(exhaustedSame.items.createSnapshot(), 0xffff_fffe, 0xffff_fffe),
      ),
    ).toMatchObject({ ok: true });
    const exhaustedBefore = exhaustedSame.items.createSnapshot();
    expect(exhaustedSame.items.transferQuantity(0, 0, 1)).toMatchObject({
      ok: false,
      reason: "item_stack_version_exhausted",
    });
    expect(exhaustedSame.items.createSnapshot()).toStrictEqual(exhaustedBefore);

    for (const [sourceDef, destinationDef, amount, destinationQuantity, reason] of [
      [4, 5, 1, 2, "item_stack_def_mismatch"],
      [4, 4, 9, 2, "item_stack_quantity_underflow"],
      [4, 4, 3, 7, "item_stack_capacity_exceeded"],
    ] as const) {
      const fixture = createTransferFixture(sourceDef, destinationDef, destinationQuantity);
      const before = fixture.items.createSnapshot();
      expect(fixture.items.transferQuantity(0, 1, amount)).toMatchObject({ ok: false, reason });
      expect(fixture.items.createSnapshot()).toStrictEqual(before);
    }
  });

  it("rejects max-version legacy writes and atomically restores strict max snapshots", () => {
    const createAtMax = createItemStackStore(2);
    expect(
      createAtMax.createStack({
        stackId: 0,
        entity: { index: 1, generation: 1 },
        defId: 1,
        quantity: 1,
        capacity: 2,
      }),
    ).toMatchObject({ ok: true });
    expect(
      createAtMax.restoreFromSnapshot(
        itemSnapshotWithActiveRowVersions(
          createAtMax.createSnapshot(),
          0xffff_fffe,
          0xffff_fffe,
          0,
        ),
      ),
    ).toMatchObject({ ok: true });
    expect(
      createAtMax.createStack({
        stackId: 1,
        entity: { index: 2, generation: 1 },
        defId: 1,
        quantity: 1,
        capacity: 2,
      }),
    ).toMatchObject({ ok: true, version: 0xffff_ffff });

    for (const mode of ["add", "remove"] as const) {
      const legacy = createItemPrepareFixture();
      expect(
        legacy.items.restoreFromSnapshot(
          itemSnapshotWithVersions(legacy.items.createSnapshot(), 0xffff_fffe, 0xffff_fffe),
        ),
      ).toMatchObject({ ok: true });
      expect(
        mode === "add" ? legacy.items.addQuantity(0, 1) : legacy.items.removeQuantity(0, 1),
      ).toMatchObject({ ok: true, version: 0xffff_ffff });
    }

    const fixture = createItemPrepareFixture();
    const maxSnapshot = itemSnapshotWithVersions(
      fixture.items.createSnapshot(),
      0xffff_ffff,
      0xffff_ffff,
    );
    expect(fixture.items.restoreFromSnapshot(maxSnapshot)).toMatchObject({ ok: true });
    expect(restoreItemStackStore(maxSnapshot).createSnapshot()).toStrictEqual(maxSnapshot);
    const before = fixture.items.createSnapshot();
    const hashBefore = createItemStackHashFields(before);
    expect(
      fixture.items.createStack({
        stackId: 1,
        entity: { index: 3, generation: 1 },
        defId: 1,
        quantity: 1,
        capacity: 1,
      }),
    ).toMatchObject({ ok: false, reason: "item_stack_version_exhausted" });
    expect(fixture.items.addQuantity(0, 1)).toMatchObject({
      ok: false,
      reason: "item_stack_version_exhausted",
    });
    expect(fixture.items.removeQuantity(0, 1)).toMatchObject({
      ok: false,
      reason: "item_stack_version_exhausted",
    });
    expect(fixture.items.createSnapshot()).toStrictEqual(before);
    expect(createItemStackHashFields(fixture.items.createSnapshot())).toStrictEqual(hashBefore);

    const activeRow = before.rows[0];
    const inactiveRow = before.rows[1];
    if (activeRow === undefined || inactiveRow === undefined)
      throw new Error("item snapshot fixture missing rows");
    const malformed = itemSnapshotWithRows(
      before,
      before.storeVersion,
      {
        ...activeRow,
        capacity: 0,
      },
      inactiveRow,
    );
    expect(fixture.items.restoreFromSnapshot(malformed)).toMatchObject({ ok: false });
    expect(fixture.items.createSnapshot()).toStrictEqual(before);
    expect(createItemStackHashFields(fixture.items.createSnapshot())).toStrictEqual(hashBefore);
  });

  it("rejects every non-canonical ItemStack version distribution atomically", () => {
    const destination = createTransferFixture().items;
    const valid = destination.createSnapshot();
    const row0 = valid.rows[0];
    const row1 = valid.rows[1];
    if (row0 === undefined || row1 === undefined)
      throw new Error("item version fixture missing rows");

    const emptyStore = createItemStackStore(2);
    const empty = emptyStore.createSnapshot();
    const emptyRow0 = empty.rows[0];
    const emptyRow1 = empty.rows[1];
    if (emptyRow0 === undefined || emptyRow1 === undefined)
      throw new Error("empty item version fixture missing rows");
    expectItemRestoreRejectedAtomically(emptyStore, { ...empty, storeVersion: 1 });
    expectItemRestoreRejectedAtomically(emptyStore, {
      ...empty,
      storeVersion: 0xffff_ffff,
    });

    const invalidSnapshots: readonly ItemStackSnapshot[] = [
      itemSnapshotWithRows(valid, 3, row0, row1),
      itemSnapshotWithRows(valid, 1, row0, row1),
      itemSnapshotWithRows(
        valid,
        0xffff_ffff,
        { ...row0, rowVersion: 0xffff_ffff },
        { ...row1, rowVersion: 1 },
      ),
      itemSnapshotWithRows(
        valid,
        0xffff_fffd,
        { ...row0, rowVersion: 0xffff_fffd },
        { ...row1, rowVersion: 0xffff_fffd },
      ),
      itemSnapshotWithRows(valid, 1, { ...row0, rowVersion: 0 }, row1),
    ];
    for (const snapshot of invalidSnapshots) {
      expectItemRestoreRejectedAtomically(destination, snapshot);
    }

    const inactiveRowVersion = itemSnapshotWithRows(
      empty,
      0,
      { ...emptyRow0, rowVersion: 1 },
      emptyRow1,
    );
    expectItemRestoreRejectedAtomically(emptyStore, inactiveRowVersion);
  });

  it("resolves the construction-approved Hauling descriptor to four exact claim channels", () => {
    const fixture = createHaulingFactsFixture();
    const output = createHaulingOutput();
    fixture.facts.readClaimFactsInto(
      fixture.input,
      fixture.offers,
      fixture.storage,
      fixture.items,
      fixture.ledger,
      fixture.scratch,
      output,
    );
    expect({
      offer: fixture.scratch.offer,
      source: fixture.scratch.source,
      destination: fixture.scratch.destination,
      item: fixture.scratch.item,
    }).toMatchObject({
      offer: {
        ok: true,
        ownerVersion: fixture.input.expectedOfferOwnerVersion,
        rowVersion: fixture.input.expectedOfferRowVersion,
        indexVersion: fixture.input.expectedOfferIndexVersion,
        regionId: fixture.input.expectedOfferRegionId,
        defId: fixture.input.expectedOfferDefId,
        urgencyBucket: fixture.input.expectedOfferUrgencyBucket,
        permissionId: fixture.input.expectedOfferPermissionId,
        targetCellIndex: fixture.input.expectedOfferTargetCellIndex,
        scoreMilli: fixture.input.expectedOfferScoreMilli,
      },
      source: {
        ok: true,
        rowVersion: fixture.input.expectedSourceRowVersion,
        indexVersion: fixture.input.expectedStorageIndexVersion,
        dirtyBacklog: fixture.input.expectedSourceDirtyBacklog,
      },
      destination: {
        ok: true,
        rowVersion: fixture.input.expectedDestinationRowVersion,
        indexVersion: fixture.input.expectedStorageIndexVersion,
        dirtyBacklog: fixture.input.expectedDestinationDirtyBacklog,
      },
      item: {
        ok: true,
        rowVersion: fixture.input.expectedItemRowVersion,
        storeVersion: fixture.input.expectedItemStoreVersion,
        reservationVersion: fixture.input.expectedReservationVersion,
      },
    });
    expect(output.reason).toBeUndefined();
    expect(output).toMatchObject({
      ok: true,
      descriptor: HAULING_CLAIM_FACTS_DESCRIPTOR,
      workType: HAULING_CLAIM_FACTS_WORK_TYPE,
      offerId: 7,
      opaqueTargetId: fixture.input.opaqueTargetId,
      sourceStackId: 2,
      destinationStackId: 3,
      sourceEntityIndex: fixture.sourceItem.index,
      sourceEntityGeneration: fixture.sourceItem.generation,
      destinationEntityIndex: fixture.destinationStorage.index,
      destinationEntityGeneration: fixture.destinationStorage.generation,
      itemRowVersion: fixture.item.rowVersion,
      itemStoreVersion: fixture.item.storeVersion,
      reservationVersion: fixture.ledger.version,
    });
    expect(output.sourceEntityIndex).not.toBe(fixture.sourceStorage.index);
    expect(Array.from(output.channelCodes)).toStrictEqual([3, 5, 4, 4, 0, 0, 0, 0]);
    expect(Array.from(output.targetIndexes).slice(0, 4)).toStrictEqual([
      fixture.sourceItem.index,
      fixture.destinationStorage.index,
      fixture.sourceItem.index,
      fixture.destinationStorage.index,
    ]);
    expect(Array.from(output.slotIds)).toStrictEqual([
      0xffff_ffff, 3, 21, 22, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    ]);
    expect(Array.from(output.targetGenerations).slice(4)).toStrictEqual([
      0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    ]);
    expect(Array.from(output.targetIndexes).slice(4)).toStrictEqual([
      0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    ]);
    expect(Array.from(output.amounts)).toStrictEqual([4, 4, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(output.limits)).toStrictEqual([6, 20, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(output.cellIndexes)).toStrictEqual([
      0xffff_ffff, 0xffff_ffff, 11, 12, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    ]);
    expect(Array.from(output.domainIds)).toStrictEqual([
      2, 3, 2, 3, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    ]);
    expect(output).toMatchObject({
      channelCount: 4,
      policyKind: 1,
      policyVersion: 1,
      factCount: 1,
      transitionTargetSlot: 2,
    });
    expect(Array.from(output.factCodes)).toStrictEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(output.factValues)).toStrictEqual([4, 0, 0, 0, 0, 0, 0, 0]);
  });

  it.each([
    [
      "descriptor",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({ ...input, descriptor: 99 }),
    ],
    [
      "work type",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({ ...input, workType: 1 }),
    ],
    [
      "offer id",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({ ...input, offerId: 6 }),
    ],
    [
      "offer opaque target",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        opaqueTargetId: input.opaqueTargetId + 1,
      }),
    ],
    [
      "offer owner",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferOwnerVersion: input.expectedOfferOwnerVersion + 1,
      }),
    ],
    [
      "offer row",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferRowVersion: input.expectedOfferRowVersion + 1,
      }),
    ],
    [
      "offer index",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferIndexVersion: input.expectedOfferIndexVersion + 1,
      }),
    ],
    [
      "offer region",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferRegionId: input.expectedOfferRegionId + 1,
      }),
    ],
    [
      "offer def",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferDefId: input.expectedOfferDefId + 1,
      }),
    ],
    [
      "offer urgency",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferUrgencyBucket: input.expectedOfferUrgencyBucket + 1,
      }),
    ],
    [
      "offer permission",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferPermissionId: input.expectedOfferPermissionId + 1,
      }),
    ],
    [
      "offer target cell",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferTargetCellIndex: input.expectedOfferTargetCellIndex + 1,
      }),
    ],
    [
      "offer score",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedOfferScoreMilli: input.expectedOfferScoreMilli + 1,
      }),
    ],
    [
      "mapping row",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedMappingRowVersion: input.expectedMappingRowVersion + 1,
      }),
    ],
    [
      "mapping index",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedMappingIndexVersion: input.expectedMappingIndexVersion + 1,
      }),
    ],
    [
      "source row",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedSourceRowVersion: input.expectedSourceRowVersion + 1,
      }),
    ],
    [
      "destination row",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedDestinationRowVersion: input.expectedDestinationRowVersion + 1,
      }),
    ],
    [
      "storage index",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedStorageIndexVersion: input.expectedStorageIndexVersion + 1,
      }),
    ],
    [
      "source backlog",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedSourceDirtyBacklog: input.expectedSourceDirtyBacklog + 1,
      }),
    ],
    [
      "destination backlog",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedDestinationDirtyBacklog: input.expectedDestinationDirtyBacklog + 1,
      }),
    ],
    [
      "item row",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedItemRowVersion: input.expectedItemRowVersion + 1,
      }),
    ],
    [
      "item store",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedItemStoreVersion: input.expectedItemStoreVersion + 1,
      }),
    ],
    [
      "reservation",
      (input: HaulingClaimFactsInput): HaulingClaimFactsInput => ({
        ...input,
        expectedReservationVersion: input.expectedReservationVersion + 1,
      }),
    ],
  ] as const)("fails closed for stale or foreign Hauling %s", (_name, mutate): void => {
    const fixture = createHaulingFactsFixture();
    const output = createHaulingOutput();
    fixture.facts.readClaimFactsInto(
      mutate(fixture.input),
      fixture.offers,
      fixture.storage,
      fixture.items,
      fixture.ledger,
      fixture.scratch,
      output,
    );
    expect(output.ok).toBe(false);
    expect(Array.from(output.channelCodes)).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it.each([2, 3])(
    "fails closed while mapped storage slot %i is dirty, even with a current backlog",
    (dirtySlotId): void => {
      const fixture = createHaulingFactsFixture();
      const output = createHaulingOutput();
      const claimLaneIdentities = [
        output.channelCodes,
        output.targetIndexes,
        output.targetGenerations,
        output.slotIds,
        output.amounts,
        output.limits,
        output.cellIndexes,
        output.domainIds,
      ];
      const manifestLaneIdentities = [output.factCodes, output.factValues];
      fixture.facts.readClaimFactsInto(
        fixture.input,
        fixture.offers,
        fixture.storage,
        fixture.items,
        fixture.ledger,
        fixture.scratch,
        output,
      );
      expect(output.ok).toBe(true);
      expect(fixture.storage.markSlotDirty(dirtySlotId)).toMatchObject({ ok: true });
      const dirtySlot = createStorageOutput();
      fixture.storage.readSlotInto(dirtySlotId, dirtySlot);
      expect(dirtySlot).toMatchObject({ dirtyQueued: true, dirtyBacklog: 1 });
      fixture.facts.readClaimFactsInto(
        {
          ...fixture.input,
          expectedSourceDirtyBacklog: dirtySlot.dirtyBacklog,
          expectedDestinationDirtyBacklog: dirtySlot.dirtyBacklog,
        },
        fixture.offers,
        fixture.storage,
        fixture.items,
        fixture.ledger,
        fixture.scratch,
        output,
      );
      expectHaulingOutputReset(output);
      const currentClaimLanes = [
        output.channelCodes,
        output.targetIndexes,
        output.targetGenerations,
        output.slotIds,
        output.amounts,
        output.limits,
        output.cellIndexes,
        output.domainIds,
      ];
      const currentManifestLanes = [output.factCodes, output.factValues];
      for (let index = 0; index < claimLaneIdentities.length; index += 1) {
        expect(currentClaimLanes[index]).toBe(claimLaneIdentities[index]);
      }
      for (let index = 0; index < manifestLaneIdentities.length; index += 1) {
        expect(currentManifestLanes[index]).toBe(manifestLaneIdentities[index]);
      }
    },
  );

  it("binds the WorkOffer def to the mapped storage and ItemStack def", () => {
    const fixture = createHaulingFactsFixture(4, 6, 20, 0);
    const output = createHaulingOutput();
    fixture.facts.readClaimFactsInto(
      fixture.input,
      fixture.offers,
      fixture.storage,
      fixture.items,
      fixture.ledger,
      fixture.scratch,
      output,
    );
    expectHaulingOutputReset(output);
  });

  it("preserves caller output identity and rejects short Hauling lanes", () => {
    const fixture = createHaulingFactsFixture();
    const output = createHaulingOutput();
    const identities = [
      output.channelCodes,
      output.targetIndexes,
      output.targetGenerations,
      output.slotIds,
      output.amounts,
      output.limits,
      output.cellIndexes,
      output.domainIds,
      output.factCodes,
      output.factValues,
    ];
    fixture.facts.readClaimFactsInto(
      fixture.input,
      fixture.offers,
      fixture.storage,
      fixture.items,
      fixture.ledger,
      fixture.scratch,
      output,
    );
    expect(output.channelCodes).toBe(identities[0]);
    expect(output.targetIndexes).toBe(identities[1]);
    expect(output.targetGenerations).toBe(identities[2]);
    expect(output.slotIds).toBe(identities[3]);
    expect(output.amounts).toBe(identities[4]);
    expect(output.limits).toBe(identities[5]);
    expect(output.cellIndexes).toBe(identities[6]);
    expect(output.domainIds).toBe(identities[7]);
    expect(output.factCodes).toBe(identities[8]);
    expect(output.factValues).toBe(identities[9]);
    const short = { ...createHaulingOutput(), channelCodes: new Uint8Array(7) };
    fixture.facts.readClaimFactsInto(
      fixture.input,
      fixture.offers,
      fixture.storage,
      fixture.items,
      fixture.ledger,
      fixture.scratch,
      short,
    );
    expect(short).toMatchObject({
      ok: false,
      reason: "hauling_claim_output_invalid",
      channelCount: 0,
    });
    const shortFacts = { ...createHaulingOutput(), factValues: new Int32Array(7) };
    fixture.facts.readClaimFactsInto(
      fixture.input,
      fixture.offers,
      fixture.storage,
      fixture.items,
      fixture.ledger,
      fixture.scratch,
      shortFacts,
    );
    expect(shortFacts).toMatchObject({
      ok: false,
      reason: "hauling_claim_output_invalid",
      factCount: 0,
    });
  });

  it("round trips and hashes the exact Hauling spot mapping owner", () => {
    const fixture = createHaulingFactsFixture();
    const snapshot = fixture.facts.createSnapshot();
    expect(restoreHaulingClaimFactsIndex(snapshot).createSnapshot()).toStrictEqual(snapshot);
    const mappedRow = snapshot.rows[7];
    if (mappedRow === undefined) throw new Error("hauling snapshot fixture missing row");
    const changed = replaceHaulingSnapshotRow(snapshot, 7, {
      ...mappedRow,
      sourceInteractionSpotId: mappedRow.sourceInteractionSpotId + 1,
    });
    expect(hashHaulingSnapshot(changed)).not.toBe(hashHaulingSnapshot(snapshot));
    const before = fixture.facts.createSnapshot();
    expect(
      fixture.facts.restoreFromSnapshot(
        replaceHaulingSnapshotRow(snapshot, 7, { ...mappedRow, descriptor: 99 }),
      ),
    ).toBe(false);
    expect(fixture.facts.createSnapshot()).toStrictEqual(before);
  });

  it("writes the uint32 transfer amount as an exact signed Int32 manifest bit pattern", () => {
    const fixture = createHaulingFactsFixture(0xffff_ffff, 0xffff_ffff, 0xffff_ffff);
    const output = createHaulingOutput();
    fixture.facts.readClaimFactsInto(
      fixture.input,
      fixture.offers,
      fixture.storage,
      fixture.items,
      fixture.ledger,
      fixture.scratch,
      output,
    );
    expect(output).toMatchObject({ ok: true, factCount: 1 });
    expect(output.factCodes[0]).toBe(1);
    expect(output.factValues[0]).toBe(-1);
    expect(Array.from(output.factValues).slice(1)).toStrictEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("requires exact mapping refs and preserves zero writes on configure rejection", () => {
    const facts = createHaulingClaimFactsIndex(8);
    const valid = {
      offerId: 1,
      descriptor: HAULING_CLAIM_FACTS_DESCRIPTOR,
      workType: HAULING_CLAIM_FACTS_WORK_TYPE,
      opaqueTargetId: 9,
      sourceSlotId: 2,
      destinationSlotId: 3,
      sourceInteractionSpotId: 4,
      destinationInteractionSpotId: 5,
    };
    const before = facts.createSnapshot();
    expect(facts.configure({ ...valid, sourceSlotId: 0xffff_ffff })).toBe(false);
    expect(facts.configure({ ...valid, destinationSlotId: 2 })).toBe(false);
    expect(facts.configure({ ...valid, sourceInteractionSpotId: 0xffff_ffff })).toBe(false);
    expect(facts.configure({ ...valid, opaqueTargetId: 0xffff_ffff })).toBe(false);
    expect(facts.createSnapshot()).toStrictEqual(before);
  });

  it("restores only an indexVersion equal to the checked sum of mapping row versions", () => {
    const fixture = createHaulingFactsFixture();
    expect(
      fixture.facts.configure({
        offerId: 6,
        descriptor: HAULING_CLAIM_FACTS_DESCRIPTOR,
        workType: HAULING_CLAIM_FACTS_WORK_TYPE,
        opaqueTargetId: 902,
        sourceSlotId: 4,
        destinationSlotId: 5,
        sourceInteractionSpotId: 23,
        destinationInteractionSpotId: 24,
      }),
    ).toBe(true);
    const snapshot = fixture.facts.createSnapshot();
    const firstRow = snapshot.rows[7];
    const secondRow = snapshot.rows[6];
    if (firstRow === undefined || secondRow === undefined)
      throw new Error("hauling version fixture missing rows");
    expect(snapshot).toMatchObject({ indexVersion: 2 });
    expect(restoreHaulingClaimFactsIndex(snapshot).createSnapshot()).toStrictEqual(snapshot);
    for (const indexVersion of [1, 3]) {
      const before = fixture.facts.createSnapshot();
      expect(fixture.facts.restoreFromSnapshot({ ...snapshot, indexVersion })).toBe(false);
      expect(fixture.facts.createSnapshot()).toStrictEqual(before);
    }
    const exhausted = replaceHaulingSnapshotRow(
      replaceHaulingSnapshotRow({ ...snapshot, indexVersion: 0xffff_ffff }, 7, {
        ...firstRow,
        rowVersion: 0xffff_fffe,
      }),
      6,
      { ...secondRow, rowVersion: 1 },
    );
    expect(fixture.facts.restoreFromSnapshot(exhausted)).toBe(true);
    const beforeExhaustedConfigure = fixture.facts.createSnapshot();
    expect(
      fixture.facts.configure({
        offerId: 5,
        descriptor: HAULING_CLAIM_FACTS_DESCRIPTOR,
        workType: HAULING_CLAIM_FACTS_WORK_TYPE,
        opaqueTargetId: 903,
        sourceSlotId: 5,
        destinationSlotId: 6,
        sourceInteractionSpotId: 25,
        destinationInteractionSpotId: 26,
      }),
    ).toBe(false);
    expect(fixture.facts.createSnapshot()).toStrictEqual(beforeExhaustedConfigure);
    const invalidOpaqueTarget = replaceHaulingSnapshotRow(snapshot, 7, {
      ...firstRow,
      opaqueTargetId: 0xffff_ffff,
    });
    expect(fixture.facts.restoreFromSnapshot(invalidOpaqueTarget)).toBe(false);
    expect(fixture.facts.createSnapshot()).toStrictEqual(beforeExhaustedConfigure);
  });
});

function createItemOutput(): ItemStackIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    stackId: 0,
    entityIndex: 0,
    entityGeneration: 0,
    defId: 0,
    quantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    capacity: 0,
    rowVersion: 0,
    storeVersion: 0,
    reservationVersion: 0,
  };
}

function poisonItemOutput(): ItemStackIntoOutput {
  return {
    ok: true,
    reason: "item_stack_capacity_exceeded",
    active: true,
    stackId: 99,
    entityIndex: 99,
    entityGeneration: 99,
    defId: 99,
    quantity: 99,
    reservedQuantity: 99,
    availableQuantity: 99,
    capacity: 99,
    rowVersion: 99,
    storeVersion: 99,
    reservationVersion: 99,
  };
}

function createPreparedRemoval(): PreparedItemStackQuantityRemoval {
  return {
    ok: false,
    reason: undefined,
    stackId: 0,
    entityIndex: 0,
    entityGeneration: 0,
    defId: 0,
    amount: 0,
    previousQuantity: 0,
    nextQuantity: 0,
    capacity: 0,
    previousRowVersion: 0,
    nextRowVersion: 0,
    previousStoreVersion: 0,
    nextStoreVersion: 0,
    reservationVersion: 0,
  };
}

function poisonPreparedRemoval(): PreparedItemStackQuantityRemoval {
  return {
    ok: true,
    reason: "item_stack_capacity_exceeded",
    stackId: 99,
    entityIndex: 99,
    entityGeneration: 99,
    defId: 99,
    amount: 99,
    previousQuantity: 99,
    nextQuantity: 99,
    capacity: 99,
    previousRowVersion: 99,
    nextRowVersion: 99,
    previousStoreVersion: 99,
    nextStoreVersion: 99,
    reservationVersion: 99,
  };
}

function createItemPrepareFixture(): {
  items: ReturnType<typeof createItemStackStore>;
  ledger: ReturnType<typeof createReservationLedger>;
  read: ItemStackIntoOutput;
  scratch: ReturnType<typeof itemReadScratch>;
  removal: ItemStackQuantityRemovalPrepareInput;
  addition: ItemStackQuantityAdditionPrepareInput;
} {
  const items = createItemStackStore(2);
  const ledger = createReservationLedger({ capacity: 4, entityCapacity: 8, cellCount: 8 });
  expect(
    items.createStack({
      stackId: 0,
      entity: { index: 2, generation: 3 },
      defId: 4,
      quantity: 8,
      capacity: 10,
    }),
  ).toMatchObject({ ok: true });
  const read = createItemOutput();
  const scratch = itemReadScratch();
  items.readStackInto(0, ledger, scratch, read);
  return {
    items,
    ledger,
    read,
    scratch,
    removal: removalInputFromRead(read, 3),
    addition: additionInputFromRead(read, 2),
  };
}

function removalInputFromRead(
  read: ItemStackIntoOutput,
  amount: number,
): ItemStackQuantityRemovalPrepareInput {
  return {
    stackId: read.stackId,
    entityIndex: read.entityIndex,
    entityGeneration: read.entityGeneration,
    defId: read.defId,
    quantity: read.quantity,
    reservedQuantity: read.reservedQuantity,
    ownedReservedQuantity: 0,
    availableQuantity: read.availableQuantity,
    capacity: read.capacity,
    amount,
    expectedRowVersion: read.rowVersion,
    expectedStoreVersion: read.storeVersion,
    expectedReservationVersion: read.reservationVersion,
  };
}

function additionInputFromRead(
  read: ItemStackIntoOutput,
  amount: number,
): ItemStackQuantityAdditionPrepareInput {
  return {
    stackId: read.stackId,
    entityIndex: read.entityIndex,
    entityGeneration: read.entityGeneration,
    defId: read.defId,
    quantity: read.quantity,
    capacity: read.capacity,
    amount,
    expectedRowVersion: read.rowVersion,
    expectedStoreVersion: read.storeVersion,
    expectedReservationVersion: read.reservationVersion,
  };
}

function itemSnapshotWithVersions(
  snapshot: ItemStackSnapshot,
  storeVersion: number,
  rowVersion: number,
): ItemStackSnapshot {
  const first = snapshot.rows[0];
  const second = snapshot.rows[1];
  if (first === undefined || second === undefined)
    throw new Error("item snapshot fixture requires two rows");
  return itemSnapshotWithRows(
    snapshot,
    storeVersion,
    first.active === 1 ? { ...first, rowVersion } : first,
    second.active === 1 ? { ...second, rowVersion } : second,
  );
}

function itemSnapshotWithActiveRowVersions(
  snapshot: ItemStackSnapshot,
  storeVersion: number,
  firstRowVersion: number,
  secondRowVersion: number,
): ItemStackSnapshot {
  const first = snapshot.rows[0];
  const second = snapshot.rows[1];
  if (first === undefined || second === undefined)
    throw new Error("item snapshot fixture requires two rows");
  return itemSnapshotWithRows(
    snapshot,
    storeVersion,
    first.active === 1 ? { ...first, rowVersion: firstRowVersion } : first,
    second.active === 1 ? { ...second, rowVersion: secondRowVersion } : second,
  );
}

function itemSnapshotWithRows(
  snapshot: ItemStackSnapshot,
  storeVersion: number,
  first: ItemStackSnapshotRow,
  second: ItemStackSnapshotRow,
): ItemStackSnapshot {
  return { ...snapshot, storeVersion, rows: [first, second] };
}

function hashItemSnapshot(snapshot: ItemStackSnapshot): string {
  return formatCanonicalWorldHash({
    fields: createItemStackHashFields(snapshot),
    randomStreams: [],
    queuedCommands: [],
  });
}

function replaceHaulingSnapshotRow(
  snapshot: HaulingFactsSnapshot,
  offerId: number,
  replacement: HaulingFactsSnapshotRow,
): HaulingFactsSnapshot {
  const rows: HaulingFactsSnapshotRow[] = [];
  for (let index = 0; index < snapshot.rows.length; index += 1) {
    const row = snapshot.rows[index];
    if (row === undefined) throw new Error("hauling snapshot fixture has a sparse row");
    rows.push(index === offerId ? replacement : row);
  }
  return { ...snapshot, rows };
}

function hashHaulingSnapshot(snapshot: HaulingFactsSnapshot): string {
  return formatCanonicalWorldHash({
    fields: createHaulingClaimFactsHashFields(snapshot),
    randomStreams: [],
    queuedCommands: [],
  });
}

function expectItemRestoreRejectedAtomically(
  store: ItemStackStoreFixture,
  snapshot: unknown,
): void {
  const before = store.createSnapshot();
  const hashBefore = hashItemSnapshot(before);
  expect(store.restoreFromSnapshot(snapshot)).toMatchObject({ ok: false });
  expect(store.createSnapshot()).toStrictEqual(before);
  expect(hashItemSnapshot(store.createSnapshot())).toBe(hashBefore);
}

function createTransferFixture(
  sourceDef = 4,
  destinationDef = 4,
  destinationQuantity = 2,
): { items: ReturnType<typeof createItemStackStore> } {
  const items = createItemStackStore(2);
  expect(
    items.createStack({
      stackId: 0,
      entity: { index: 1, generation: 1 },
      defId: sourceDef,
      quantity: 8,
      capacity: 10,
    }),
  ).toMatchObject({ ok: true });
  expect(
    items.createStack({
      stackId: 1,
      entity: { index: 2, generation: 1 },
      defId: destinationDef,
      quantity: destinationQuantity,
      capacity: 8,
    }),
  ).toMatchObject({ ok: true });
  return { items };
}

function itemReadScratch(): ItemStackReadScratch {
  return { entity: { index: 0, generation: 0 } };
}

function createPortionOutput(): M3FoodPortionIntoOutput {
  return {
    ok: false,
    reason: undefined,
    stackId: 0,
    foodDefId: 0,
    hungerRestore: 0,
    regionId: 0,
    storageSlotId: 0,
    targetCellIndex: 0,
    interactionSpotId: 0,
    scoreMilli: 0,
    permissionId: 0,
    mealWindowId: 0,
    mealWindowVersion: 0,
    safe: false,
    permissionAllowed: false,
    scheduleAllowed: false,
    availableAmount: 0,
    itemStoreVersion: 0,
    foodAvailabilityVersion: 0,
    active: false,
    linkedCandidate: false,
    dirtyBacklog: 0,
  };
}

function createFoodOutput(): FoodClaimFactsIntoOutput {
  return {
    ok: false,
    reason: undefined,
    stackId: 0,
    itemEntityIndex: 0,
    itemEntityGeneration: 0,
    foodDefId: 0,
    quantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    capacity: 0,
    hungerRestore: 0,
    storageSlotId: 0,
    targetCellIndex: 0,
    interactionSpotId: 0,
    itemRowVersion: 0,
    itemStoreVersion: 0,
    foodAvailabilityVersion: 0,
    reservationVersion: 0,
  };
}

function createHaulingFactsFixture(
  amount = 4,
  sourceQuantity = 6,
  destinationCapacity = 20,
  offerDefId = 1,
): HaulingFactsFixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const sourceItemResult = registry.allocate();
  const destinationItemResult = registry.allocate();
  const sourceStorageResult = registry.allocate();
  const destinationStorageResult = registry.allocate();
  if (
    !sourceItemResult.ok ||
    !destinationItemResult.ok ||
    !sourceStorageResult.ok ||
    !destinationStorageResult.ok
  )
    throw new Error("hauling entity fixture failed");
  const sourceItem = sourceItemResult.entity;
  const destinationItem = destinationItemResult.entity;
  const sourceStorage = sourceStorageResult.entity;
  const destinationStorage = destinationStorageResult.entity;
  const items = createItemStackStore(8);
  items.createStack({
    stackId: 2,
    entity: sourceItem,
    defId: 1,
    quantity: sourceQuantity,
    capacity: sourceQuantity,
  });
  items.createStack({
    stackId: 3,
    entity: destinationItem,
    defId: 1,
    quantity: 0,
    capacity: destinationCapacity,
  });
  const ledger = createReservationLedger({ capacity: 8, entityCapacity: 16, cellCount: 64 });
  const storage = createStorageLogisticsIndex(8, 8);
  storage.configureSlot({
    slotId: 2,
    storage: sourceStorage,
    stackId: 2,
    defId: 1,
    capacity: sourceQuantity,
    desiredQuantity: 0,
    interactionCellIndex: 11,
    offerId: 2,
    workType: 0,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
  });
  storage.configureSlot({
    slotId: 3,
    storage: destinationStorage,
    stackId: 3,
    defId: 1,
    capacity: destinationCapacity,
    desiredQuantity: destinationCapacity,
    interactionCellIndex: 12,
    offerId: 3,
    workType: 0,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
  });
  const offers = createWorkOfferIndex({
    capacity: 8,
    workTypeCapacity: 2,
    regionCapacity: 2,
    defCapacity: 2,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });
  storage.refreshDirty(items, ledger, offers, 8);
  offers.registerOffer({
    offerId: 7,
    workType: HAULING_CLAIM_FACTS_WORK_TYPE,
    regionId: 0,
    defId: offerDefId,
    urgencyBucket: 0,
    permissionId: 0,
    targetId: 901,
    targetCellIndex: 12,
    scoreMilli: 500,
  });
  const offer = createOfferOutput();
  offers.readOfferInto(7, offer);
  const source = createStorageOutput();
  storage.readSlotInto(2, source);
  const destination = createStorageOutput();
  storage.readSlotInto(3, destination);
  const item = createItemOutput();
  const itemRead = itemReadScratch();
  items.readStackInto(2, ledger, itemRead, item);
  const facts = createHaulingClaimFactsIndex(8);
  const opaqueTargetId = offer.targetId;
  if (
    !facts.configure({
      offerId: 7,
      descriptor: HAULING_CLAIM_FACTS_DESCRIPTOR,
      workType: HAULING_CLAIM_FACTS_WORK_TYPE,
      opaqueTargetId,
      sourceSlotId: 2,
      destinationSlotId: 3,
      sourceInteractionSpotId: 21,
      destinationInteractionSpotId: 22,
    })
  )
    throw new Error("hauling mapping fixture failed");
  const factsSnapshot = facts.createSnapshot();
  const mapping = factsSnapshot.rows[7];
  if (mapping === undefined) throw new Error("hauling mapping row missing");
  const input: HaulingClaimFactsInput = {
    descriptor: HAULING_CLAIM_FACTS_DESCRIPTOR,
    workType: HAULING_CLAIM_FACTS_WORK_TYPE,
    offerId: 7,
    opaqueTargetId,
    sourceSlotId: 2,
    destinationSlotId: 3,
    amount,
    expectedOfferOwnerVersion: offer.ownerVersion,
    expectedOfferRowVersion: offer.rowVersion,
    expectedOfferIndexVersion: offer.indexVersion,
    expectedOfferRegionId: offer.regionId,
    expectedOfferDefId: offer.defId,
    expectedOfferUrgencyBucket: offer.urgencyBucket,
    expectedOfferPermissionId: offer.permissionId,
    expectedOfferTargetCellIndex: offer.targetCellIndex,
    expectedOfferScoreMilli: offer.scoreMilli,
    expectedMappingRowVersion: mapping.rowVersion,
    expectedMappingIndexVersion: factsSnapshot.indexVersion,
    expectedSourceRowVersion: source.rowVersion,
    expectedDestinationRowVersion: destination.rowVersion,
    expectedStorageIndexVersion: source.indexVersion,
    expectedSourceDirtyBacklog: source.dirtyBacklog,
    expectedDestinationDirtyBacklog: destination.dirtyBacklog,
    expectedItemRowVersion: item.rowVersion,
    expectedItemStoreVersion: item.storeVersion,
    expectedReservationVersion: item.reservationVersion,
  };
  return {
    registry,
    sourceItem,
    destinationItem,
    sourceStorage,
    destinationStorage,
    items,
    ledger,
    storage,
    offers,
    facts,
    item,
    input,
    scratch: {
      offer: createOfferOutput(),
      source: createStorageOutput(),
      destination: createStorageOutput(),
      item: createItemOutput(),
      itemRead: itemReadScratch(),
    },
  };
}

function createHaulingOutput(): HaulingClaimFactsIntoOutput {
  return {
    ok: false,
    reason: undefined,
    sourceSlotId: 0,
    destinationSlotId: 0,
    sourceStackId: 0,
    destinationStackId: 0,
    defId: 0,
    amount: 0,
    sourceEntityIndex: 0,
    sourceEntityGeneration: 0,
    destinationEntityIndex: 0,
    destinationEntityGeneration: 0,
    sourceInteractionSpotId: 0,
    destinationInteractionSpotId: 0,
    sourceRowVersion: 0,
    destinationRowVersion: 0,
    indexVersion: 0,
    descriptor: 0,
    workType: 0,
    offerId: 0,
    opaqueTargetId: 0,
    offerOwnerVersion: 0,
    offerRowVersion: 0,
    offerIndexVersion: 0,
    sourceDirtyBacklog: 0,
    destinationDirtyBacklog: 0,
    itemRowVersion: 0,
    itemStoreVersion: 0,
    reservationVersion: 0,
    manifestVersion: 0,
    policyKind: 0,
    policyVersion: 0,
    factCount: 0,
    transitionTargetSlot: 0,
    mappingRowVersion: 0,
    mappingIndexVersion: 0,
    channelCount: 0,
    factCodes: new Uint8Array(8),
    factValues: new Int32Array(8),
    channelCodes: new Uint8Array(8),
    targetIndexes: new Uint32Array(8),
    targetGenerations: new Uint32Array(8),
    slotIds: new Uint32Array(8),
    amounts: new Uint32Array(8),
    limits: new Uint32Array(8),
    cellIndexes: new Uint32Array(8),
    domainIds: new Uint32Array(8),
  };
}

function expectHaulingOutputReset(output: HaulingClaimFactsIntoOutput): void {
  expect(output).toMatchObject({
    ok: false,
    sourceSlotId: 0,
    destinationSlotId: 0,
    sourceStackId: 0,
    destinationStackId: 0,
    defId: 0,
    amount: 0,
    sourceEntityIndex: 0,
    sourceEntityGeneration: 0,
    destinationEntityIndex: 0,
    destinationEntityGeneration: 0,
    sourceInteractionSpotId: 0,
    destinationInteractionSpotId: 0,
    sourceRowVersion: 0,
    destinationRowVersion: 0,
    indexVersion: 0,
    descriptor: 0,
    workType: 0,
    offerId: 0,
    opaqueTargetId: 0,
    offerOwnerVersion: 0,
    offerRowVersion: 0,
    offerIndexVersion: 0,
    sourceDirtyBacklog: 0,
    destinationDirtyBacklog: 0,
    itemRowVersion: 0,
    itemStoreVersion: 0,
    reservationVersion: 0,
    manifestVersion: 0,
    policyKind: 0,
    policyVersion: 0,
    factCount: 0,
    transitionTargetSlot: 0,
    mappingRowVersion: 0,
    mappingIndexVersion: 0,
    channelCount: 0,
  });
  expect(Array.from(output.channelCodes)).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  expect(Array.from(output.targetIndexes)).toStrictEqual([
    0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    0xffff_ffff,
  ]);
  expect(Array.from(output.targetGenerations)).toStrictEqual([
    0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    0xffff_ffff,
  ]);
  expect(Array.from(output.slotIds)).toStrictEqual([
    0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    0xffff_ffff,
  ]);
  expect(Array.from(output.cellIndexes)).toStrictEqual([
    0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    0xffff_ffff,
  ]);
  expect(Array.from(output.domainIds)).toStrictEqual([
    0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff,
    0xffff_ffff,
  ]);
  expect(Array.from(output.amounts)).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  expect(Array.from(output.limits)).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  expect(Array.from(output.factCodes)).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  expect(Array.from(output.factValues)).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0]);
}

function createOfferOutput(): WorkOfferReadIntoOutput {
  return {
    ok: false,
    reason: undefined,
    offerId: 0,
    ownerVersion: 0,
    rowVersion: 0,
    indexVersion: 0,
    workType: 0,
    regionId: 0,
    defId: 0,
    urgencyBucket: 0,
    permissionId: 0,
    targetId: 0,
    targetCellIndex: 0,
    scoreMilli: 0,
  };
}

function createStorageOutput(): StorageSlotIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    slotId: 0,
    storageIndex: 0,
    storageGeneration: 0,
    stackId: 0,
    defId: 0,
    capacity: 0,
    desiredQuantity: 0,
    interactionCellIndex: 0,
    offerId: 0,
    workType: 0,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
    quantity: 0,
    reservedSupply: 0,
    reservedCapacity: 0,
    availableSupply: 0,
    availableCapacity: 0,
    demandQuantity: 0,
    offerActive: false,
    rowVersion: 0,
    indexVersion: 0,
    dirtyBacklog: 0,
    dirtyQueued: false,
    dirtyHead: 0,
    dirtyCapacity: 0,
    dirtyQueueIndex: 0,
  };
}
