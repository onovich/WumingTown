import { describe, expect, it } from "vitest";

import {
  JOB_NONE,
  HAULING_CLAIM_FACTS_DESCRIPTOR,
  HAULING_CLAIM_FACTS_MANIFEST_VERSION,
  HAULING_CLAIM_FACTS_WORK_TYPE,
  HAULING_CLAIM_POLICY_KIND,
  HAULING_CLAIM_POLICY_VERSION,
  HAULING_CLAIM_TRANSITION_TARGET_SLOT,
  HAUL_TRANSFER_AMOUNT_FACT_CODE,
  RESERVATION_CAPACITY,
  RESERVATION_CLAIM_NONE,
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES,
  createEntityRegistry,
  createHaulingJobHashFields,
  createHaulingJobStore,
  createItemStackStore,
  createJobCoreStore,
  createReservationLedger,
  createStorageLogisticsIndex,
  createWorkOfferIndex,
  initializeGameSessionRuntime,
  restoreHaulingJobStore,
  type CanonicalWorldField,
  type EntityId,
  type GameSessionRuntime,
  type StorageSlotInput,
  type HaulingClaimAdoptionOutput,
  type ReservationClaimsIntoOutput,
  type ItemStackIntoOutput,
  type HaulingAdoptedJobIntoOutput,
  type HaulingClaimFactsIntoOutput,
  type StorageSlotIntoOutput,
  type StorageSlotDirtyPrepareInput,
  type PreparedStorageSlotDirty,
  type StorageLogisticsSnapshot,
  type StorageLogisticsSnapshotRow,
  type StorageSupplySelectionIntoOutput,
  type StorageSupplySelectionScratch,
  type ExistingClaimsAdoptionControl,
  type HaulingAdoptedPickupInput,
  type HaulingAdoptedTerminalInput,
  type HaulingClaimFactsBasis,
  type JobTokenIntoOutput,
} from "./index";
import type { HaulingAdoptedMutationOutput } from "./hauling-jobs";
import {
  commitPreparedStorageDirtyAppend,
  commitPreparedStorageDirtyCoalesce,
  createStorageLogisticsHashFields,
  restoreStorageLogisticsIndex,
} from "./storage-logistics-index";
import { appendGameSessionOwnerHashFields } from "./game-session-hash-owner-fields";
import { formatCanonicalWorldHash } from "./world-hash";

describe("storage supply selection into", () => {
  it("rejects every short scratch lane and invalid cap after a complete poisoned reset", () => {
    const storage = createStorageLogisticsIndex(4, 4, 4);
    const laneNames = [
      "slotIds",
      "stackIds",
      "rowVersions",
      "availableSupplies",
      "linkedFlags",
    ] as const;
    for (const laneName of laneNames) {
      const scratch = supplySelectionScratch();
      const malformed: StorageSupplySelectionScratch = {
        slotIds: laneName === "slotIds" ? new Uint32Array(23) : scratch.slotIds,
        stackIds: laneName === "stackIds" ? new Uint32Array(23) : scratch.stackIds,
        rowVersions: laneName === "rowVersions" ? new Uint32Array(23) : scratch.rowVersions,
        availableSupplies:
          laneName === "availableSupplies" ? new Uint32Array(23) : scratch.availableSupplies,
        linkedFlags: laneName === "linkedFlags" ? new Uint8Array(23) : scratch.linkedFlags,
      };
      poisonSupplySelection(malformed);
      const output = supplySelectionOutput();
      const outputIdentity = output;
      storage.selectSupplySlotsInto(WOOD_DEF, 24, malformed, output);
      expect(output).toBe(outputIdentity);
      expect(output).toStrictEqual({
        ok: false,
        reason: "storage_candidate_buffer_too_small",
        queryDefId: WOOD_DEF,
        candidateCap: 24,
        visitedCount: 0,
        selectedCount: 0,
        candidateCapHit: false,
        indexVersion: 0,
        dirtyBacklog: 0,
      });
      expectSupplySelectionCleared(malformed);
    }
    for (const candidateCap of [0, 25]) {
      const scratch = supplySelectionScratch();
      poisonSupplySelection(scratch);
      const output = supplySelectionOutput();
      storage.selectSupplySlotsInto(WOOD_DEF, candidateCap, scratch, output);
      expect(output).toStrictEqual({
        ok: false,
        reason: "storage_candidate_buffer_too_small",
        queryDefId: WOOD_DEF,
        candidateCap,
        visitedCount: 0,
        selectedCount: 0,
        candidateCapHit: false,
        indexVersion: 0,
        dirtyBacklog: 0,
      });
      expectSupplySelectionCleared(scratch);
    }
    const scratch = supplySelectionScratch();
    poisonSupplySelection(scratch);
    const output = supplySelectionOutput();
    storage.selectSupplySlotsInto(4, 24, scratch, output);
    expect(output).toStrictEqual({
      ok: false,
      reason: "storage_def_invalid",
      queryDefId: 4,
      candidateCap: 24,
      visitedCount: 0,
      selectedCount: 0,
      candidateCapHit: false,
      indexVersion: 0,
      dirtyBacklog: 0,
    });
    expectSupplySelectionCleared(scratch);
  });

  it("rejects a dirty owner header before scanning and clears all 24 lanes", () => {
    const fixture = createSupplySelectionFixture(1, false);
    const scratch = supplySelectionScratch();
    poisonSupplySelection(scratch);
    const output = supplySelectionOutput();
    fixture.storage.selectSupplySlotsInto(WOOD_DEF, 24, scratch, output);
    expect(output).toStrictEqual({
      ok: false,
      reason: "storage_dirty_basis_mismatch",
      queryDefId: WOOD_DEF,
      candidateCap: 24,
      visitedCount: 0,
      selectedCount: 0,
      candidateCapHit: false,
      indexVersion: fixture.storage.createMetrics().version,
      dirtyBacklog: 1,
    });
    expectSupplySelectionCleared(scratch);
  });

  it("publishes zero and exactly 24 stable candidates with exact owner facts", () => {
    const empty = createStorageLogisticsIndex(4, 4, 4);
    const scratch = supplySelectionScratch();
    const output = supplySelectionOutput();
    empty.selectSupplySlotsInto(WOOD_DEF, 24, scratch, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      queryDefId: WOOD_DEF,
      candidateCap: 24,
      visitedCount: 0,
      selectedCount: 0,
      candidateCapHit: false,
      indexVersion: 0,
      dirtyBacklog: 0,
    });
    expectSupplySelectionCleared(scratch);

    const fixture = createSupplySelectionFixture(24, true);
    const identities = captureSupplySelectionIdentities(scratch);
    poisonSupplySelection(scratch);
    fixture.storage.selectSupplySlotsInto(WOOD_DEF, 24, scratch, output);
    expectSupplySelectionIdentities(scratch, identities);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      queryDefId: WOOD_DEF,
      candidateCap: 24,
      visitedCount: 24,
      selectedCount: 24,
      candidateCapHit: false,
      indexVersion: fixture.storage.createMetrics().version,
      dirtyBacklog: 0,
    });
    expect(Array.from(scratch.slotIds)).toStrictEqual(rangeValues(24, 0));
    expect(Array.from(scratch.stackIds)).toStrictEqual(rangeValues(24, 0));
    expect(Array.from(scratch.rowVersions)).toStrictEqual(repeatedValues(24, 2));
    expect(Array.from(scratch.availableSupplies)).toStrictEqual(rangeValues(24, 1));
    expect(Array.from(scratch.linkedFlags)).toStrictEqual(repeatedValues(24, 1));
  });

  it("caps a 25-candidate chain, preserves order, and resets unused poisoned tail lanes", () => {
    const fixture = createSupplySelectionFixture(25, true);
    const scratch = supplySelectionScratch();
    const output = supplySelectionOutput();
    fixture.storage.selectSupplySlotsInto(WOOD_DEF, 24, scratch, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      queryDefId: WOOD_DEF,
      candidateCap: 24,
      visitedCount: 24,
      selectedCount: 24,
      candidateCapHit: true,
      indexVersion: fixture.storage.createMetrics().version,
      dirtyBacklog: 0,
    });
    expect(Array.from(scratch.slotIds)).toStrictEqual(rangeValues(24, 0));

    poisonSupplySelection(scratch);
    output.ok = false;
    output.reason = "storage_snapshot_invalid";
    fixture.storage.selectSupplySlotsInto(WOOD_DEF, 3, scratch, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      queryDefId: WOOD_DEF,
      candidateCap: 3,
      visitedCount: 3,
      selectedCount: 3,
      candidateCapHit: true,
      indexVersion: fixture.storage.createMetrics().version,
      dirtyBacklog: 0,
    });
    expect(Array.from(scratch.slotIds.slice(0, 3))).toStrictEqual([0, 1, 2]);
    expect(Array.from(scratch.stackIds.slice(0, 3))).toStrictEqual([0, 1, 2]);
    expect(Array.from(scratch.rowVersions.slice(0, 3))).toStrictEqual([2, 2, 2]);
    expect(Array.from(scratch.availableSupplies.slice(0, 3))).toStrictEqual([1, 2, 3]);
    expect(Array.from(scratch.linkedFlags.slice(0, 3))).toStrictEqual([1, 1, 1]);
    expect(Array.from(scratch.slotIds.slice(3))).toStrictEqual(repeatedValues(21, 0));
    expect(Array.from(scratch.stackIds.slice(3))).toStrictEqual(repeatedValues(21, 0));
    expect(Array.from(scratch.rowVersions.slice(3))).toStrictEqual(repeatedValues(21, 0));
    expect(Array.from(scratch.availableSupplies.slice(3))).toStrictEqual(repeatedValues(21, 0));
    expect(Array.from(scratch.linkedFlags.slice(3))).toStrictEqual(repeatedValues(21, 0));
  });
});

describe("storage owner exact lifecycle", () => {
  it("supports slot zero and freezes append/coalesce dirty bases without version bumps", () => {
    const fixture = createStorageOwnerFixture(2);
    expect(
      fixture.storage.configureSlot(slotInput(0, { index: 4, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true, version: 1 });
    const slot = storageSlotOutput();
    fixture.storage.readSlotInto(0, slot);
    expect(slot).toMatchObject({ ok: true, slotId: 0, rowVersion: 1, dirtyQueued: true });
    const beforeCoalesce = fixture.storage.createSnapshot();
    const prepared = preparedStorageDirty();
    fixture.storage.prepareSlotDirtyInto(dirtyPrepareInput(slot), prepared);
    expect(prepared).toStrictEqual({
      ok: true,
      reason: undefined,
      slotId: 0,
      alreadyQueued: true,
      queueIndex: 0,
      rowVersion: 1,
      indexVersion: 1,
      previousDirtyBacklog: 1,
      nextDirtyBacklog: 1,
      previousDirtyHead: 0,
      nextDirtyHead: 0,
      dirtyCapacity: 2,
    });
    commitPreparedStorageDirtyCoalesce(fixture.storage, prepared);
    expect(fixture.storage.createSnapshot()).toStrictEqual(beforeCoalesce);

    expect(
      fixture.storage.refreshDirty(fixture.items, fixture.ledger, fixture.offers, 1),
    ).toMatchObject({ ok: true, refreshedCount: 1, version: 2, dirtyBacklog: 0 });
    const withTailResidue = {
      ...fixture.storage.createSnapshot(),
      dirtyQueue: [0, 1],
    };
    expect(fixture.storage.restoreFromSnapshot(withTailResidue)).toMatchObject({ ok: true });
    fixture.storage.readSlotInto(0, slot);
    const beforeAppend = fixture.storage.createSnapshot();
    expect(beforeAppend.dirtyQueue[1]).toBe(1);
    fixture.storage.prepareSlotDirtyInto(dirtyPrepareInput(slot), prepared);
    expect(prepared).toStrictEqual({
      ok: true,
      reason: undefined,
      slotId: 0,
      alreadyQueued: false,
      queueIndex: 1,
      rowVersion: 2,
      indexVersion: 2,
      previousDirtyBacklog: 0,
      nextDirtyBacklog: 1,
      previousDirtyHead: 1,
      nextDirtyHead: 1,
      dirtyCapacity: 2,
    });
    commitPreparedStorageDirtyAppend(fixture.storage, prepared);
    const afterAppend = fixture.storage.createSnapshot();
    expect(afterAppend.indexVersion).toBe(beforeAppend.indexVersion);
    expect(afterAppend.rows[0]?.rowVersion).toBe(beforeAppend.rows[0]?.rowVersion);
    expect(afterAppend).toMatchObject({ dirtyHead: 1, dirtyCount: 1, dirtyQueue: [0, 0] });
    expect(afterAppend.rows[0]?.dirtyQueued).toBe(1);
  });

  it("fully resets Into outputs and rejects inactive or stale dirty bases before writes", () => {
    const storage = createStorageLogisticsIndex(2, 2, 2);
    const slot = storageSlotOutput();
    poisonStorageSlotOutput(slot);
    const identity = slot;
    storage.readSlotInto(-1, slot);
    expect(slot).toBe(identity);
    expect(slot).toStrictEqual({
      ...storageSlotOutput(),
      reason: "storage_slot_id_out_of_range",
    });
    poisonStorageSlotOutput(slot);
    storage.readSlotInto(0, slot);
    expect(slot).toStrictEqual({
      ...storageSlotOutput(),
      reason: "storage_slot_not_registered",
      slotId: 0,
    });
    const inactivePrepared = preparedStorageDirty();
    poisonPreparedStorageDirty(inactivePrepared);
    storage.prepareSlotDirtyInto(
      {
        slotId: 0,
        expectedRowVersion: 0,
        expectedIndexVersion: 0,
        expectedDirtyBacklog: 0,
        expectedDirtyQueued: false,
        expectedDirtyHead: 0,
        expectedDirtyCapacity: 2,
        expectedDirtyQueueIndex: 0,
      },
      inactivePrepared,
    );
    expect(inactivePrepared).toStrictEqual({
      ...preparedStorageDirty(),
      reason: "storage_slot_not_registered",
    });
    expect(storage.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 0))).toMatchObject(
      { ok: true },
    );
    storage.readSlotInto(0, slot);
    const before = storage.createSnapshot();
    const basis = dirtyPrepareInput(slot);
    const staleInputs: readonly StorageSlotDirtyPrepareInput[] = [
      { ...basis, expectedRowVersion: basis.expectedRowVersion + 1 },
      { ...basis, expectedIndexVersion: basis.expectedIndexVersion + 1 },
      { ...basis, expectedDirtyBacklog: 0 },
      { ...basis, expectedDirtyQueued: false },
      { ...basis, expectedDirtyHead: 1 },
      { ...basis, expectedDirtyCapacity: 1 },
      { ...basis, expectedDirtyQueueIndex: 1 },
    ];
    for (const stale of staleInputs) {
      const prepared = preparedStorageDirty();
      poisonPreparedStorageDirty(prepared);
      const preparedIdentity = prepared;
      storage.prepareSlotDirtyInto(stale, prepared);
      expect(prepared).toBe(preparedIdentity);
      expect(prepared).toStrictEqual({
        ...preparedStorageDirty(),
        reason: "storage_dirty_basis_mismatch",
      });
      expect(storage.createSnapshot()).toStrictEqual(before);
    }

    const full = createStorageLogisticsIndex(2, 2, 2);
    expect(full.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 0))).toMatchObject({
      ok: true,
    });
    const queuedValue: unknown = Reflect.get(full, "dirtyQueued");
    if (!(queuedValue instanceof Uint8Array)) throw new Error("missing dirty queued lane");
    queuedValue[0] = 0;
    Reflect.set(full, "dirtyCount", 2);
    const beforeFull = full.createSnapshot();
    full.readSlotInto(0, slot);
    const fullPrepared = preparedStorageDirty();
    poisonPreparedStorageDirty(fullPrepared);
    full.prepareSlotDirtyInto(dirtyPrepareInput(slot), fullPrepared);
    expect(fullPrepared).toStrictEqual({
      ...preparedStorageDirty(),
      reason: "storage_candidate_buffer_too_small",
    });
    expect(full.createSnapshot()).toStrictEqual(beforeFull);
  });

  it("rejects every malformed configure scalar before owner mutation", () => {
    const base = slotInput(0, { index: 2, generation: 1 }, 0, 8, 0);
    const malformed: readonly StorageSlotInput[] = [
      { ...base, slotId: -1 },
      { ...base, stackId: 2 },
      { ...base, defId: 2 },
      { ...base, storage: { index: -1, generation: 1 } },
      { ...base, storage: { index: 2, generation: 0 } },
      { ...base, capacity: 0 },
      { ...base, desiredQuantity: 9 },
      { ...base, desiredQuantity: 0.5 },
      { ...base, interactionCellIndex: -1 },
      { ...base, offerId: -1 },
      { ...base, workType: -1 },
      { ...base, regionId: 0.5 },
      { ...base, urgencyBucket: Number.NaN },
      { ...base, permissionId: Number.POSITIVE_INFINITY },
    ];
    for (const input of malformed) {
      const storage = createStorageLogisticsIndex(2, 2, 2);
      const before = storage.createSnapshot();
      expect(storage.configureSlot(input).ok).toBe(false);
      expect(storage.createSnapshot()).toStrictEqual(before);
    }
  });

  it("preflights configuration and refresh version exhaustion atomically", () => {
    const fixture = createStorageOwnerFixture(2);
    expect(
      fixture.storage.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    const beforeDuplicate = fixture.storage.createSnapshot();
    expect(
      fixture.storage.configureSlot(slotInput(1, { index: 3, generation: 1 }, 0, 8, 0)),
    ).toStrictEqual({ ok: false, reason: "storage_stack_invalid" });
    expect(fixture.storage.createSnapshot()).toStrictEqual(beforeDuplicate);

    const maxSnapshot = withStorageSnapshotVersion(beforeDuplicate, 0xffff_ffff);
    const maxStorage = createStorageLogisticsIndex(2, 2, 2);
    expect(maxStorage.restoreFromSnapshot(maxSnapshot)).toMatchObject({ ok: true });
    const before = maxStorage.createSnapshot();
    expect(
      maxStorage.configureSlot(slotInput(1, { index: 3, generation: 1 }, 1, 8, 0)),
    ).toStrictEqual({ ok: false, reason: "storage_version_exhausted" });
    expect(maxStorage.markSlotDirty(0)).toMatchObject({ ok: true, version: 0xffff_ffff });
    const slot = storageSlotOutput();
    maxStorage.readSlotInto(0, slot);
    const prepared = preparedStorageDirty();
    maxStorage.prepareSlotDirtyInto(dirtyPrepareInput(slot), prepared);
    expect(prepared).toStrictEqual({
      ok: true,
      reason: undefined,
      slotId: 0,
      alreadyQueued: true,
      queueIndex: 0,
      rowVersion: 0xffff_ffff,
      indexVersion: 0xffff_ffff,
      previousDirtyBacklog: 1,
      nextDirtyBacklog: 1,
      previousDirtyHead: 0,
      nextDirtyHead: 0,
      dirtyCapacity: 2,
    });
    const offersBefore = captureWorkOfferState(fixture.offers);
    expect(maxStorage.refreshDirty(fixture.items, fixture.ledger, fixture.offers, 1)).toMatchObject(
      {
        ok: false,
        reason: "storage_version_exhausted",
        refreshedCount: 0,
        dirtyBacklog: 1,
      },
    );
    expect(maxStorage.createSnapshot()).toStrictEqual(before);
    expect(captureWorkOfferState(fixture.offers)).toStrictEqual(offersBefore);
  });

  it("allows the exact final version bumps and refreshes a batch with one index bump", () => {
    const fixture = createStorageOwnerFixture(3);
    expect(
      fixture.storage.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    const nearMax = withStorageSnapshotVersion(fixture.storage.createSnapshot(), 0xffff_fffe);
    const configured = createStorageLogisticsIndex(3, 3, 2);
    expect(configured.restoreFromSnapshot(nearMax)).toMatchObject({ ok: true });
    expect(
      configured.configureSlot(slotInput(1, { index: 3, generation: 1 }, 1, 8, 0)),
    ).toMatchObject({ ok: true, version: 0xffff_ffff });
    const configuredAtMax = configured.createSnapshot();
    expect(
      configured.configureSlot(slotInput(2, { index: 4, generation: 1 }, 2, 8, 0)),
    ).toStrictEqual({ ok: false, reason: "storage_version_exhausted" });
    expect(configured.createSnapshot()).toStrictEqual(configuredAtMax);

    const refreshed = createStorageLogisticsIndex(3, 3, 2);
    expect(refreshed.restoreFromSnapshot(nearMax)).toMatchObject({ ok: true });
    expect(refreshed.refreshDirty(fixture.items, fixture.ledger, fixture.offers, 1)).toMatchObject({
      ok: true,
      version: 0xffff_ffff,
      refreshedCount: 1,
      dirtyBacklog: 0,
    });
    expect(refreshed.createSnapshot().rows[0]?.rowVersion).toBe(0xffff_ffff);

    const batch = createStorageOwnerFixture(3);
    expect(
      batch.storage.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    expect(
      batch.storage.configureSlot(slotInput(1, { index: 3, generation: 1 }, 1, 8, 0)),
    ).toMatchObject({ ok: true });
    const beforeBatch = batch.storage.createSnapshot();
    const batchResult = batch.storage.refreshDirty(batch.items, batch.ledger, batch.offers, 2);
    const afterBatch = batch.storage.createSnapshot();
    expect(batchResult).toMatchObject({ ok: true, refreshedCount: 2 });
    expect(afterBatch.indexVersion).toBe(beforeBatch.indexVersion + 1);
    expect(afterBatch.refreshedCount).toBe(beforeBatch.refreshedCount + 2);
    expect(afterBatch.dirtyCount).toBe(0);
    expect(afterBatch.dirtyHead).toBe(2);
    expect(afterBatch.rows[0]?.rowVersion).toBe((beforeBatch.rows[0]?.rowVersion ?? 0) + 1);
    expect(afterBatch.rows[1]?.rowVersion).toBe((beforeBatch.rows[1]?.rowVersion ?? 0) + 1);
    expect(afterBatch.rows[0]?.dirtyQueued).toBe(0);
    expect(afterBatch.rows[1]?.dirtyQueued).toBe(0);
    expect(afterBatch.rows[1]).toMatchObject({
      quantity: 0,
      availableSupply: 0,
      availableCapacity: 0,
    });
  });

  it.each(["index", "row", "refreshed"] as const)(
    "rejects isolated %s refresh headroom exhaustion before Storage or WorkOffer writes",
    (counter) => {
      const fixture = createStorageOwnerFixture(2);
      expect(
        fixture.storage.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 0)),
      ).toMatchObject({ ok: true });
      if (counter === "index") Reflect.set(fixture.storage, "indexVersion", 0xffff_ffff);
      else if (counter === "refreshed") Reflect.set(fixture.storage, "refreshedCount", 0xffff_ffff);
      else {
        const rowVersionsValue: unknown = Reflect.get(fixture.storage, "rowVersions");
        if (!(rowVersionsValue instanceof Uint32Array)) throw new Error("missing row versions");
        rowVersionsValue[0] = 0xffff_ffff;
      }
      const before = fixture.storage.createSnapshot();
      const offersBefore = captureWorkOfferState(fixture.offers);
      expect(
        fixture.storage.refreshDirty(fixture.items, fixture.ledger, fixture.offers, 1),
      ).toMatchObject({
        ok: false,
        reason: "storage_version_exhausted",
        refreshedCount: 0,
        dirtyBacklog: 1,
      });
      expect(fixture.storage.createSnapshot()).toStrictEqual(before);
      expect(captureWorkOfferState(fixture.offers)).toStrictEqual(offersBefore);
    },
  );

  it("keeps WorkOffer zero-write while Storage tolerates exhausted register, update and remove", () => {
    const registerFixture = createStorageOwnerFixture(1);
    expect(
      registerFixture.storage.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    setWorkOfferVersionsForStorage(registerFixture.offers, 0, 0xffff_ffff, 0);
    const registerOfferBefore = captureWorkOfferState(registerFixture.offers);
    const registerStorageBefore = registerFixture.storage.createSnapshot();
    expect(
      registerFixture.storage.refreshDirty(
        registerFixture.items,
        registerFixture.ledger,
        registerFixture.offers,
        1,
      ),
    ).toMatchObject({ ok: true, refreshedCount: 1, dirtyBacklog: 0 });
    const registerStorageAfter = registerFixture.storage.createSnapshot();
    expect(captureWorkOfferState(registerFixture.offers)).toStrictEqual(registerOfferBefore);
    expect(registerStorageAfter).toMatchObject({
      indexVersion: registerStorageBefore.indexVersion + 1,
      dirtyCount: 0,
      refreshedCount: registerStorageBefore.refreshedCount + 1,
    });
    expect(registerStorageAfter.rows[0]).toMatchObject({
      rowVersion: (registerStorageBefore.rows[0]?.rowVersion ?? 0) + 1,
      quantity: 2,
      availableSupply: 2,
      offerActive: 0,
      dirtyQueued: 0,
    });

    const updateFixture = createStorageOwnerFixture(1);
    expect(
      updateFixture.storage.configureSlot(slotInput(0, { index: 3, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    expect(
      updateFixture.storage.refreshDirty(
        updateFixture.items,
        updateFixture.ledger,
        updateFixture.offers,
        1,
      ),
    ).toMatchObject({ ok: true });
    expect(updateFixture.items.addQuantity(0, 1)).toMatchObject({ ok: true });
    expect(updateFixture.storage.markSlotDirty(0)).toMatchObject({ ok: true });
    setWorkOfferVersionsForStorage(updateFixture.offers, 0, 0xffff_ffff, 1);
    const updateOfferBefore = captureWorkOfferState(updateFixture.offers);
    const updateStorageBefore = updateFixture.storage.createSnapshot();
    expect(
      updateFixture.storage.refreshDirty(
        updateFixture.items,
        updateFixture.ledger,
        updateFixture.offers,
        1,
      ),
    ).toMatchObject({ ok: true, refreshedCount: 1, dirtyBacklog: 0 });
    const updateStorageAfter = updateFixture.storage.createSnapshot();
    expect(captureWorkOfferState(updateFixture.offers)).toStrictEqual(updateOfferBefore);
    expect(updateStorageAfter.rows[0]).toMatchObject({
      rowVersion: (updateStorageBefore.rows[0]?.rowVersion ?? 0) + 1,
      quantity: 3,
      availableSupply: 3,
      offerActive: 1,
      dirtyQueued: 0,
    });

    const removeFixture = createStorageOwnerFixture(1);
    expect(
      removeFixture.storage.configureSlot(slotInput(0, { index: 4, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    expect(
      removeFixture.storage.refreshDirty(
        removeFixture.items,
        removeFixture.ledger,
        removeFixture.offers,
        1,
      ),
    ).toMatchObject({ ok: true });
    expect(removeFixture.items.removeQuantity(0, 2)).toMatchObject({ ok: true });
    expect(removeFixture.storage.markSlotDirty(0)).toMatchObject({ ok: true });
    setWorkOfferVersionsForStorage(removeFixture.offers, 0, 0xffff_ffff, 1);
    const removeOfferBefore = captureWorkOfferState(removeFixture.offers);
    const removeStorageBefore = removeFixture.storage.createSnapshot();
    expect(
      removeFixture.storage.refreshDirty(
        removeFixture.items,
        removeFixture.ledger,
        removeFixture.offers,
        1,
      ),
    ).toMatchObject({ ok: true, refreshedCount: 1, dirtyBacklog: 0 });
    const removeStorageAfter = removeFixture.storage.createSnapshot();
    expect(captureWorkOfferState(removeFixture.offers)).toStrictEqual(removeOfferBefore);
    expect(removeStorageAfter.rows[0]).toMatchObject({
      rowVersion: (removeStorageBefore.rows[0]?.rowVersion ?? 0) + 1,
      quantity: 0,
      availableSupply: 0,
      offerActive: 1,
      dirtyQueued: 0,
    });
  });

  it("validates the complete v1 state before atomic restore and hashes physical queue order", () => {
    const fixture = createSupplySelectionFixture(3, true);
    fixture.storage.markSlotDirty(1);
    fixture.storage.markSlotDirty(0);
    const valid = fixture.storage.createSnapshot();
    const target = createStorageLogisticsIndex(3, 3, 4);
    expect(target.restoreFromSnapshot(valid)).toMatchObject({ ok: true });
    const before = target.createSnapshot();
    const beforeHash = storageSnapshotHash(before);
    const corruptions: readonly StorageLogisticsSnapshot[] = [
      replaceStorageRow(valid, 2, { rowVersion: 0 }),
      { ...valid, stackToSlot: [-1, 1, 2] },
      replaceStorageRow(valid, 1, { stackId: 0 }),
      replaceStorageRow(valid, 0, { capacity: 0 }),
      replaceStorageRow(valid, 0, { desiredQuantity: 65 }),
      replaceStorageRow(valid, 0, { availableSupply: 99 }),
      replaceStorageRow(valid, 0, { supplyLinked: 0 }),
      { ...valid, supplyHeadByDef: [1, -1, -1, -1] },
      replaceStorageRow(valid, 1, { supplyPrevious: 2 }),
      replaceStorageRow(valid, 1, { supplyNext: 0 }),
      { ...valid, indexedSupplyCount: valid.indexedSupplyCount - 1 },
      { ...valid, refreshedCount: valid.refreshedCount + 1 },
      { ...valid, indexVersion: valid.activeCount - 1 },
      { ...valid, dirtyQueue: [3, valid.dirtyQueue[1] ?? 0, valid.dirtyQueue[2] ?? 0] },
      { ...valid, dirtyQueue: [1, 1, valid.dirtyQueue[2] ?? 0] },
      replaceStorageRow(valid, 1, { dirtyQueued: 0 }),
    ];
    for (const malformed of corruptions) {
      expect(target.restoreFromSnapshot(malformed)).toStrictEqual({
        ok: false,
        reason: "storage_snapshot_invalid",
      });
      expect(target.createSnapshot()).toStrictEqual(before);
      expect(storageSnapshotHash(target.createSnapshot())).toBe(beforeHash);
    }
    const otherFixture = createSupplySelectionFixture(3, true);
    otherFixture.storage.markSlotDirty(0);
    otherFixture.storage.markSlotDirty(1);
    const reorderedQueue = otherFixture.storage.createSnapshot();
    expect(target.restoreFromSnapshot(reorderedQueue)).toMatchObject({ ok: true });
    expect(restoreStorageLogisticsIndex(valid).createSnapshot()).toStrictEqual(valid);
    expect(restoreStorageLogisticsIndex(reorderedQueue).createSnapshot()).toStrictEqual(
      reorderedQueue,
    );
    expect({ ...reorderedQueue, dirtyQueue: valid.dirtyQueue }).toStrictEqual(valid);
    expect(storageSnapshotHash(reorderedQueue)).not.toBe(storageSnapshotHash(valid));
  });

  it("closes refresh-batch, schema, dense-array, and demand-chain restore invariants", () => {
    const fixture = createStorageOwnerFixture(3);
    expect(
      fixture.storage.configureSlot(slotInput(0, { index: 2, generation: 1 }, 0, 8, 4)),
    ).toMatchObject({ ok: true });
    expect(
      fixture.storage.configureSlot(slotInput(1, { index: 3, generation: 1 }, 1, 8, 0)),
    ).toMatchObject({ ok: true });
    expect(
      fixture.storage.refreshDirty(fixture.items, fixture.ledger, fixture.offers, 2),
    ).toMatchObject({
      ok: true,
      refreshedCount: 2,
    });
    const valid = fixture.storage.createSnapshot();
    expect(valid).toMatchObject({
      activeCount: 2,
      indexVersion: 3,
      refreshedCount: 2,
      dirtyHead: 2,
    });
    expect(valid.rows[1]).toMatchObject({
      rowVersion: 2,
      quantity: 0,
      availableCapacity: 0,
      demandQuantity: 0,
    });
    const target = createStorageLogisticsIndex(3, 3, 2);
    expect(target.restoreFromSnapshot(valid)).toMatchObject({ ok: true });
    expect(target.restoreFromSnapshot({ ...valid, indexVersion: 4 })).toMatchObject({ ok: true });
    const before = target.createSnapshot();
    const sparseRows = [...valid.rows];
    Reflect.deleteProperty(sparseRows, "1");
    const missingKey: Partial<StorageLogisticsSnapshot> = { ...valid };
    Reflect.deleteProperty(missingKey, "dirtyCount");
    const malformed: readonly unknown[] = [
      { ...valid, snapshotVersion: 2 },
      { ...valid, extra: 1 },
      missingKey,
      { ...valid, rows: sparseRows },
      { ...valid, rows: valid.rows.slice(0, 2) },
      { ...valid, indexVersion: 2 },
      replaceStorageRow(replaceStorageRow(valid, 0, { rowVersion: 3 }), 1, {
        rowVersion: 1,
        availableCapacity: 8,
      }),
      { ...valid, dirtyHead: 1 },
      { ...valid, demandHeadByDef: [1, -1] },
      replaceStorageRow(valid, 0, { demandNext: 0 }),
    ];
    for (const value of malformed) {
      expect(target.restoreFromSnapshot(value)).toStrictEqual({
        ok: false,
        reason: "storage_snapshot_invalid",
      });
      expect(target.createSnapshot()).toStrictEqual(before);
    }

    const fresh = createStorageLogisticsIndex(2, 2, 2);
    expect(fresh.configureSlot(slotInput(0, { index: 7, generation: 1 }, 0, 8, 0))).toMatchObject({
      ok: true,
    });
    const fakeSentinel = replaceStorageRow(fresh.createSnapshot(), 0, { availableCapacity: 0 });
    expect(fresh.restoreFromSnapshot(fakeSentinel)).toStrictEqual({
      ok: false,
      reason: "storage_snapshot_invalid",
    });
  });

  it("round trips reachable failed-offer and over-capacity derived rows", () => {
    const items = createItemStackStore(1);
    expect(
      items.createStack({
        stackId: 0,
        entity: { index: 6, generation: 1 },
        defId: WOOD_DEF,
        quantity: 10,
        capacity: 12,
      }),
    ).toMatchObject({ ok: true });
    const storage = createStorageLogisticsIndex(1, 1, 2);
    expect(
      storage.configureSlot({
        ...slotInput(0, { index: 7, generation: 1 }, 0, 8, 0),
        offerId: 99,
      }),
    ).toMatchObject({ ok: true });
    const ledger = createReservationLedger({ capacity: 2, entityCapacity: 16, cellCount: 16 });
    const offers = createWorkOfferIndex({
      capacity: 1,
      workTypeCapacity: 1,
      regionCapacity: 1,
      defCapacity: 2,
      urgencyBucketCount: 1,
      permissionCapacity: 1,
    });
    expect(storage.refreshDirty(items, ledger, offers, 1)).toMatchObject({ ok: true });
    const snapshot = storage.createSnapshot();
    expect(snapshot.rows[0]).toMatchObject({
      quantity: 10,
      capacity: 8,
      availableCapacity: 0,
      offerActive: 0,
      supplyLinked: 1,
    });
    expect(restoreStorageLogisticsIndex(snapshot).createSnapshot()).toStrictEqual(snapshot);
    const overReservedCapacity = replaceStorageRow(snapshot, 0, { reservedCapacity: 4 });
    expect(restoreStorageLogisticsIndex(overReservedCapacity).createSnapshot()).toStrictEqual(
      overReservedCapacity,
    );

    const staleOfferItems = createItemStackStore(1);
    expect(
      staleOfferItems.createStack({
        stackId: 0,
        entity: { index: 8, generation: 1 },
        defId: WOOD_DEF,
        quantity: 2,
        capacity: 8,
      }),
    ).toMatchObject({ ok: true });
    const staleOfferStorage = createStorageLogisticsIndex(1, 1, 2);
    expect(
      staleOfferStorage.configureSlot(slotInput(0, { index: 9, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    expect(staleOfferStorage.refreshDirty(staleOfferItems, ledger, offers, 1)).toMatchObject({
      ok: true,
    });
    expect(offers.removeOffer(0)).toMatchObject({ ok: true });
    expect(
      staleOfferItems.restoreFromSnapshot(createItemStackStore(1).createSnapshot()),
    ).toMatchObject({ ok: true });
    expect(staleOfferStorage.markSlotDirty(0)).toMatchObject({ ok: true });
    expect(staleOfferStorage.refreshDirty(staleOfferItems, ledger, offers, 1)).toMatchObject({
      ok: true,
    });
    const failedRemove = staleOfferStorage.createSnapshot();
    expect(failedRemove.rows[0]).toMatchObject({
      quantity: 0,
      availableSupply: 0,
      demandQuantity: 0,
      offerActive: 1,
      supplyLinked: 0,
      demandLinked: 0,
    });
    expect(restoreStorageLogisticsIndex(failedRemove).createSnapshot()).toStrictEqual(failedRemove);

    const zeroItems = createItemStackStore(1);
    expect(
      zeroItems.createStack({
        stackId: 0,
        entity: { index: 11, generation: 1 },
        defId: WOOD_DEF,
        quantity: 0,
        capacity: 8,
      }),
    ).toMatchObject({ ok: true });
    const zeroStorage = createStorageLogisticsIndex(1, 1, 2);
    expect(
      zeroStorage.configureSlot(slotInput(0, { index: 12, generation: 1 }, 0, 8, 0)),
    ).toMatchObject({ ok: true });
    expect(zeroStorage.refreshDirty(zeroItems, ledger, offers, 1)).toMatchObject({ ok: true });
    const zeroSnapshot = zeroStorage.createSnapshot();
    expect(zeroSnapshot.rows[0]).toMatchObject({
      rowVersion: 2,
      quantity: 0,
      availableCapacity: 8,
    });
    expect(restoreStorageLogisticsIndex(zeroSnapshot).createSnapshot()).toStrictEqual(zeroSnapshot);

    const empty = createStorageLogisticsIndex(2, 2, 2);
    const malformed = replaceStorageRow(empty.createSnapshot(), 1, { storageIndex: 1 });
    const before = empty.createSnapshot();
    expect(empty.restoreFromSnapshot(malformed)).toStrictEqual({
      ok: false,
      reason: "storage_snapshot_invalid",
    });
    expect(empty.createSnapshot()).toStrictEqual(before);
  });

  it("publishes unique item/storage hash names and independently tracks owner versions", () => {
    const baseline = createGameSessionRuntimeForStorageHash("storage-hash-baseline");
    const baselineFields = gameSessionOwnerHashFields(baseline);
    const baselineNames = hashFieldNames(baselineFields);
    expect(new Set(baselineNames).size).toBe(baselineNames.length);
    for (const name of [
      "audit.resource.0.item.rowVersion",
      "audit.resource.0.item.storeVersion",
      "audit.resource.0.item.reservationVersion",
      "audit.resource.0.storage.rowVersion",
      "audit.resource.0.storage.indexVersion",
      "audit.resource.0.storage.dirtyQueued",
      "audit.storage.row.0.rowVersion",
      "audit.storage.dirtyQueue.0",
    ]) {
      expect(baselineNames).toContain(name);
    }
    expect(baselineNames).not.toContain("audit.resource.0.rowVersion");
    expect(baseline.createWorldHash()).toMatch(/^0x[0-9a-f]{8}$/u);
    expect(baseline.createReadModelHash()).toMatch(/^0x[0-9a-f]{8}$/u);

    const itemOnly = createGameSessionRuntimeForStorageHash("storage-hash-baseline");
    const stackId = itemOnly.references.resourceStackIds[0];
    if (stackId === undefined) throw new Error("missing resource stack");
    expect(itemOnly.owners.items.removeQuantity(stackId, 1)).toMatchObject({ ok: true });
    expect(itemOnly.owners.items.addQuantity(stackId, 1)).toMatchObject({ ok: true });
    const itemFields = gameSessionOwnerHashFields(itemOnly);
    expect(hashFieldValue(itemFields, "audit.resource.0.item.rowVersion")).not.toBe(
      hashFieldValue(baselineFields, "audit.resource.0.item.rowVersion"),
    );
    expect(hashFieldValue(itemFields, "audit.resource.0.item.storeVersion")).not.toBe(
      hashFieldValue(baselineFields, "audit.resource.0.item.storeVersion"),
    );
    expect(hashFieldValue(itemFields, "audit.resource.0.storage.rowVersion")).toBe(
      hashFieldValue(baselineFields, "audit.resource.0.storage.rowVersion"),
    );
    expect(hashFieldValue(itemFields, "audit.resource.0.storage.indexVersion")).toBe(
      hashFieldValue(baselineFields, "audit.resource.0.storage.indexVersion"),
    );
    expect(itemOnly.createWorldHash()).not.toBe(baseline.createWorldHash());
    expect(itemOnly.createReadModelHash()).not.toBe(baseline.createReadModelHash());

    const storageOnly = createGameSessionRuntimeForStorageHash("storage-hash-baseline");
    expect(storageOnly.owners.storage.markSlotDirty(0)).toMatchObject({ ok: true });
    expect(
      storageOnly.owners.storage.refreshDirty(
        storageOnly.owners.items,
        storageOnly.owners.reservations,
        storageOnly.owners.workOffers,
        1,
      ),
    ).toMatchObject({ ok: true, refreshedCount: 1 });
    const storageFields = gameSessionOwnerHashFields(storageOnly);
    expect(hashFieldValue(storageFields, "audit.resource.0.storage.rowVersion")).not.toBe(
      hashFieldValue(baselineFields, "audit.resource.0.storage.rowVersion"),
    );
    expect(hashFieldValue(storageFields, "audit.resource.0.storage.indexVersion")).not.toBe(
      hashFieldValue(baselineFields, "audit.resource.0.storage.indexVersion"),
    );
    expect(hashFieldValue(storageFields, "audit.resource.0.item.rowVersion")).toBe(
      hashFieldValue(baselineFields, "audit.resource.0.item.rowVersion"),
    );
    expect(hashFieldValue(storageFields, "audit.resource.0.item.storeVersion")).toBe(
      hashFieldValue(baselineFields, "audit.resource.0.item.storeVersion"),
    );
    expect(storageOnly.createWorldHash()).not.toBe(baseline.createWorldHash());
    expect(storageOnly.createReadModelHash()).not.toBe(baseline.createReadModelHash());
  });
});

describe("minimal item storage hauling jobs", () => {
  it("round trips storage dirty lanes and hashes equal rows with different dirty bases differently", () => {
    const storage = createStorageLogisticsIndex(4, 4, 4);
    storage.configureSlot(slotInput(1, { index: 2, generation: 3 }, 1, 8, 4));
    const snapshot = storage.createSnapshot();
    const restored = restoreStorageLogisticsIndex(snapshot);
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    const shifted = { ...snapshot, dirtyHead: (snapshot.dirtyHead + 1) % snapshot.capacity };
    const hash = (value: typeof snapshot): string =>
      formatCanonicalWorldHash({
        fields: createStorageLogisticsHashFields(value),
        randomStreams: [],
        queuedCommands: [],
      });
    expect(hash(shifted)).not.toBe(hash(snapshot));
  });
  it("adopts and rolls back the exact four autonomous claims", () => {
    const fixture = createAdoptedPickupFixture(false);
    expect(fixture.adopted).toMatchObject({
      ok: true,
      jobGeneration: 1,
      jobSlotVersion: 2,
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobCoreReservedCount: 0,
      jobCoreActiveCount: 1,
      jobCoreRunningCount: 1,
      driverReservedCount: 1,
      driverPickedUpCount: 0,
    });
    const reservedSnapshot = fixture.hauling.createSnapshot();
    expect(restoreHaulingJobStore(reservedSnapshot).createSnapshot()).toStrictEqual(
      reservedSnapshot,
    );
    const reservedIdentityCorruption = {
      ...reservedSnapshot,
      rows: mapTestValues(reservedSnapshot.rows, (row) =>
        row.jobId === fixture.token.jobId ? { ...row, sourceItemGeneration: 0 } : row,
      ),
    };
    expect(fixture.hauling.restoreFromSnapshot(reservedIdentityCorruption)).toStrictEqual({
      ok: false,
      reason: "hauling_snapshot_invalid",
    });
    const rolled = driverOutput();
    fixture.hauling.rollbackNewlyAdoptedInto(
      {
        ...fixture.control,
        expectedAdoptedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: fixture.adopted.driverVersion,
      },
      fixture.core,
      rolled,
    );
    expect(rolled).toMatchObject({
      ok: true,
      jobSlotVersion: 3,
      activeCount: 0,
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobCoreReservedCount: 1,
      jobCoreActiveCount: 0,
      jobCoreRunningCount: 0,
      driverReservedCount: 0,
      driverPickedUpCount: 0,
    });
    expect(fixture.claims).toMatchObject({ ok: true, claimCount: 4 });
    expect(fixture.ledger.createMetrics().activeCount).toBe(4);
  });

  it("rejects an autonomous token outside hauling capacity before JobCore mutation", () => {
    const fixture = createAdoptedPickupFixture(false, 0, true, false, 4);
    expect(fixture.token.jobId).toBe(4);
    expect(fixture.adopted).toMatchObject({
      ok: false,
      reason: "hauling_adoption_preflight_failed",
    });
    expect(fixture.hauling.createSnapshot()).toStrictEqual(fixture.beforeAdoption);
    expect(fixture.core.createSnapshot()).toStrictEqual(fixture.beforeCoreAdoption);
  });

  it.each(["manifest", "mapping", "item", "reservation", "cell", "stack", "def"] as const)(
    "rejects stale or foreign %s resolver basis before adoption writes",
    (basis) => {
      const fixture = createAdoptedPickupFixture(false, 0, true, false, 8, (facts) => {
        if (basis === "manifest") facts.manifestVersion += 1;
        else if (basis === "mapping") facts.mappingIndexVersion += 1;
        else if (basis === "item") facts.sourceStackId += 1;
        else if (basis === "reservation") facts.reservationVersion += 1;
        else if (basis === "cell") facts.cellIndexes[2] = JOB_NONE;
        else if (basis === "stack") facts.sourceStackId = JOB_NONE;
        else facts.defId = JOB_NONE;
      });
      expect(fixture.adopted).toMatchObject({
        ok: false,
        reason: "hauling_adoption_preflight_failed",
      });
      expect(fixture.hauling.createSnapshot()).toStrictEqual(fixture.beforeAdoption);
      expect(fixture.core.createSnapshot()).toStrictEqual(fixture.beforeCoreAdoption);
    },
  );

  it("binds caller destination capacity to the resolver capacity limit", () => {
    const fixture = createAdoptedPickupFixture(false, 0, true, false, 8, undefined, 101, 21);
    expect(fixture.adopted).toMatchObject({
      ok: false,
      reason: "hauling_adoption_preflight_failed",
    });
    expect(fixture.hauling.createSnapshot()).toStrictEqual(fixture.beforeAdoption);
    expect(fixture.core.createSnapshot()).toStrictEqual(fixture.beforeCoreAdoption);
  });

  it("rejects delivered before pickup without releasing claims or completing JobCore", () => {
    const fixture = createAdoptedPickupFixture(false);
    const before = {
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      items: fixture.items.createSnapshot(),
    };
    const output = adoptedMutationOutput();
    const input = phaseZeroTerminalInput(fixture);
    fixture.hauling.terminalAdoptedInto(
      { ...input, outcome: "delivered", failureReason: "none" },
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect({
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      items: fixture.items.createSnapshot(),
    }).toStrictEqual(before);
  });

  it("accepts driver version fffd and rejects fffe and ffff before adoption writes", () => {
    const accepted = createAdoptedPickupFixture(false, 0xffff_fffd);
    expect(accepted.adopted).toMatchObject({ ok: true, driverVersion: 0xffff_fffe });
    const rolled = driverOutput();
    accepted.hauling.rollbackNewlyAdoptedInto(
      {
        ...accepted.control,
        expectedAdoptedJobSlotVersion: accepted.adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: accepted.adopted.driverVersion,
      },
      accepted.core,
      rolled,
    );
    expect(rolled).toMatchObject({ ok: true, driverVersion: 0xffff_ffff });
    for (const version of [0xffff_fffe, 0xffff_ffff]) {
      const rejected = createAdoptedPickupFixture(false, version, true);
      expect(rejected.adopted).toMatchObject({ ok: false, reason: "hauling_version_exhausted" });
      expect(rejected.hauling.createSnapshot()).toStrictEqual(rejected.beforeAdoption);
    }
  });

  it("preflights adopted pickup across ItemStack, driver and JobCore before any commit", () => {
    const registry = createEntityRegistry({ capacity: 16 });
    const owner = allocate(registry);
    const source = allocate(registry);
    const destination = allocate(registry);
    const sourceStorage = allocate(registry);
    const destinationItem = allocate(registry);
    const unrelatedOwner = allocate(registry);
    const core = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const token = tokenOutput();
    core.reserveAutonomyJobTokenInto(core.version, owner, token);
    const ledger = createReservationLedger({ capacity: 16, entityCapacity: 16, cellCount: 32 });
    const acquired = ledger.acquire(
      {
        owner,
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        createdTick: 0x1_0000_0001,
        leaseExpiryTick: 0x1_0000_0100,
        claims: [
          { channel: "item_quantity", item: source, amount: 4, availableAmount: 6 },
          { channel: "capacity", target: destination, capacityId: 3, amount: 4, capacity: 20 },
          { channel: "interaction_spot", target: source, spotId: 11 },
          { channel: "interaction_spot", target: destination, spotId: 12 },
        ],
      },
      registry,
    );
    if (!acquired.ok) throw new Error(acquired.reason);
    const ids = new Uint32Array(8);
    ids.fill(RESERVATION_CLAIM_NONE);
    const epochs = new Uint32Array(8);
    for (let index = 0; index < 4; index += 1) {
      ids[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
      epochs[index] = acquired.version;
    }
    const claims = haulingClaims(owner, source, destination, token.jobId, token.jobGeneration);
    ledger.readActiveClaimsInto(
      ids,
      epochs,
      4,
      owner,
      token.jobId,
      token.jobGeneration,
      acquired.version,
      claims,
    );
    const control = {
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      ownerIndex: owner.index,
      ownerGeneration: owner.generation,
      expectedJobSlotVersion: token.slotVersion,
      expectedJobCoreVersion: core.version,
      expectedDriverVersion: 0,
      claimCount: 4,
      claimIds: ids,
      claimEpochs: epochs,
      claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
      claimCreatedTick: 0x1_0000_0001,
      adoptionTick: 0x1_0000_0002,
      reservationReadVersion: acquired.version,
    };
    const hauling = createHaulingJobStore(8);
    const adopted = driverOutput();
    hauling.adoptExistingClaimsInto(
      control,
      {
        jobId: token.jobId,
        owner,
        sourceSlotId: 2,
        destinationSlotId: 3,
        amount: 4,
        createdTick: control.claimCreatedTick,
        sourceStackId: 2,
        destinationStackId: 3,
        defId: WOOD_DEF,
        sourceItem: source,
        destinationStorage: destination,
        sourceInteractionSpotId: 11,
        destinationInteractionSpotId: 12,
        destinationCapacity: 20,
        readClaimIds: ids,
        readClaimEpochs: epochs,
        claims,
        claimFacts: haulingClaimFacts(source, destination, acquired.version),
        claimFactsBasis: haulingFactsBasis(
          haulingClaimFacts(source, destination, acquired.version),
        ),
      },
      core,
      adopted,
    );
    const items = createItemStackStore(8);
    items.createStack({ stackId: 2, entity: source, defId: WOOD_DEF, quantity: 6, capacity: 8 });
    items.createStack({
      stackId: 3,
      entity: destinationItem,
      defId: WOOD_DEF,
      quantity: 0,
      capacity: 20,
    });
    const storage = createStorageLogisticsIndex(8, 8);
    storage.configureSlot(slotInput(2, sourceStorage, 2, 8, 0));
    storage.configureSlot(slotInput(3, destination, 3, 20, 20));
    const unrelated = ledger.acquire(
      {
        owner: unrelatedOwner,
        jobId: 1,
        createdTick: 2,
        leaseExpiryTick: 20,
        claims: [{ channel: "cell", cellIndex: 1 }],
      },
      registry,
    );
    if (!unrelated.ok) throw new Error(unrelated.reason);
    const offers = createWorkOfferIndex({
      capacity: 8,
      workTypeCapacity: 2,
      regionCapacity: 2,
      defCapacity: 2,
      urgencyBucketCount: 2,
      permissionCapacity: 2,
    });
    storage.refreshDirty(items, ledger, offers, 8);
    const stack = itemOutput();
    const readScratch = { entity: { index: 0, generation: 0 } };
    items.readStackInto(2, ledger, readScratch, stack);
    const sourceSlot = storageSlotOutput();
    storage.readSlotInto(2, sourceSlot);
    expect(sourceSlot).toMatchObject({ dirtyQueued: false, dirtyBacklog: 0 });
    const preparedDirty = {
      ok: false,
      reason: undefined,
      slotId: 0,
      alreadyQueued: false,
      queueIndex: 0,
      rowVersion: 0,
      indexVersion: 0,
      previousDirtyBacklog: 0,
      nextDirtyBacklog: 0,
      previousDirtyHead: 0,
      nextDirtyHead: 0,
      dirtyCapacity: 0,
    };
    storage.prepareSlotDirtyInto(
      {
        slotId: 2,
        expectedRowVersion: sourceSlot.rowVersion,
        expectedIndexVersion: sourceSlot.indexVersion,
        expectedDirtyBacklog: 0,
        expectedDirtyQueued: false,
        expectedDirtyHead: sourceSlot.dirtyHead,
        expectedDirtyCapacity: sourceSlot.dirtyCapacity,
        expectedDirtyQueueIndex: sourceSlot.dirtyQueueIndex,
      },
      preparedDirty,
    );
    expect(preparedDirty).toMatchObject({ ok: true, alreadyQueued: false, nextDirtyBacklog: 1 });
    commitPreparedStorageDirtyAppend(storage, preparedDirty);
    storage.readSlotInto(2, sourceSlot);
    storage.prepareSlotDirtyInto(
      {
        slotId: 2,
        expectedRowVersion: sourceSlot.rowVersion,
        expectedIndexVersion: sourceSlot.indexVersion,
        expectedDirtyBacklog: 1,
        expectedDirtyQueued: true,
        expectedDirtyHead: sourceSlot.dirtyHead,
        expectedDirtyCapacity: sourceSlot.dirtyCapacity,
        expectedDirtyQueueIndex: sourceSlot.dirtyQueueIndex,
      },
      preparedDirty,
    );
    expect(preparedDirty).toMatchObject({ ok: true, alreadyQueued: true, nextDirtyBacklog: 1 });
    const pickup = adoptedMutationOutput();
    const input = {
      jobId: adopted.jobId,
      jobGeneration: adopted.jobGeneration,
      owner,
      expectedJobSlotVersion: adopted.jobSlotVersion,
      expectedJobCoreVersion: adopted.jobCoreVersion,
      expectedDriverVersion: adopted.driverVersion,
      expectedCurrentLedgerVersion: unrelated.version,
      tick: 0x1_0000_0003,
      itemRemoval: {
        stackId: 2,
        entityIndex: stack.entityIndex,
        entityGeneration: stack.entityGeneration,
        defId: stack.defId,
        quantity: stack.quantity,
        reservedQuantity: 4,
        ownedReservedQuantity: 4,
        availableQuantity: 2,
        capacity: stack.capacity,
        amount: 4,
        expectedRowVersion: stack.rowVersion,
        expectedStoreVersion: stack.storeVersion,
        expectedReservationVersion: stack.reservationVersion,
      },
      sourceSlot,
      sourceDirty: {
        slotId: 2,
        expectedRowVersion: sourceSlot.rowVersion,
        expectedIndexVersion: sourceSlot.indexVersion,
        expectedDirtyBacklog: sourceSlot.dirtyBacklog,
        expectedDirtyQueued: sourceSlot.dirtyQueued,
        expectedDirtyHead: sourceSlot.dirtyHead,
        expectedDirtyCapacity: sourceSlot.dirtyCapacity,
        expectedDirtyQueueIndex: sourceSlot.dirtyQueueIndex,
      },
    };
    hauling.pickupAdoptedInto(
      { ...input, expectedCurrentLedgerVersion: acquired.version },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: false });
    hauling.pickupAdoptedInto(
      { ...input, expectedJobSlotVersion: input.expectedJobSlotVersion - 1 },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: false });
    hauling.pickupAdoptedInto(
      { ...input, tick: control.adoptionTick - 1 },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: false });
    hauling.pickupAdoptedInto(
      {
        ...input,
        itemRemoval: {
          ...input.itemRemoval,
          expectedRowVersion: input.itemRemoval.expectedRowVersion + 1,
        },
      },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: false });
    hauling.pickupAdoptedInto(
      { ...input, sourceSlot: { ...sourceSlot, rowVersion: sourceSlot.rowVersion + 1 } },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: false });
    expect(items.readStack(2)).toMatchObject({ quantity: 6 });
    expect(hauling.readJob(token.jobId)).toBeUndefined();

    hauling.pickupAdoptedInto(input, items, storage, ledger, core, claims, pickup);
    expect(pickup).toMatchObject({
      ok: true,
      jobSlotVersion: adopted.jobSlotVersion + 1,
      driverVersion: adopted.driverVersion + 1,
      itemRowVersion: stack.rowVersion + 1,
    });
    expect(items.readStack(2)).toMatchObject({ quantity: 2 });
    expect(hauling.readJob(token.jobId)).toBeUndefined();

    items.readStackInto(2, ledger, readScratch, stack);
    storage.readSlotInto(2, sourceSlot);
    const duplicate = {
      ...input,
      expectedJobSlotVersion: pickup.jobSlotVersion,
      expectedJobCoreVersion: pickup.jobCoreVersion,
      expectedDriverVersion: pickup.driverVersion,
      tick: input.tick + 1,
      itemRemoval: {
        ...input.itemRemoval,
        quantity: stack.quantity,
        reservedQuantity: stack.reservedQuantity,
        availableQuantity: stack.availableQuantity,
        expectedRowVersion: stack.rowVersion,
        expectedStoreVersion: stack.storeVersion,
        expectedReservationVersion: stack.reservationVersion,
      },
      sourceDirty: {
        slotId: 2,
        expectedRowVersion: sourceSlot.rowVersion,
        expectedIndexVersion: sourceSlot.indexVersion,
        expectedDirtyBacklog: sourceSlot.dirtyBacklog,
        expectedDirtyQueued: sourceSlot.dirtyQueued,
        expectedDirtyHead: sourceSlot.dirtyHead,
        expectedDirtyCapacity: sourceSlot.dirtyCapacity,
        expectedDirtyQueueIndex: sourceSlot.dirtyQueueIndex,
      },
    };
    hauling.pickupAdoptedInto(duplicate, items, storage, ledger, core, claims, pickup);
    expect(pickup).toMatchObject({ ok: true, alreadyCommitted: true });
    expect(items.readStack(2)).toMatchObject({ quantity: 2 });
    const pickupCommittedBasis = {
      jobSlotVersion: pickup.jobSlotVersion,
      jobCoreVersion: pickup.jobCoreVersion,
      driverVersion: pickup.driverVersion,
    };
    const committedPickupCore = core.createSnapshot();
    const mismatchedPickupCore = {
      ...committedPickupCore,
      slots: mapTestValues(committedPickupCore.slots, (row) =>
        row.jobId === token.jobId ? { ...row, targetId: row.targetId + 1 } : row,
      ),
      records: mapTestValues(committedPickupCore.records, (row) =>
        row.jobId === token.jobId ? { ...row, targetId: row.targetId + 1 } : row,
      ),
    };
    expect(core.restoreFromSnapshot(mismatchedPickupCore)).toMatchObject({ ok: true });
    const pickupMismatchBefore = {
      items: items.createSnapshot(),
      hauling: hauling.createSnapshot(),
      ledger: ledger.createSnapshot(),
      core: core.createSnapshot(),
    };
    hauling.pickupAdoptedInto(duplicate, items, storage, ledger, core, claims, pickup);
    expect(pickup).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect({
      items: items.createSnapshot(),
      hauling: hauling.createSnapshot(),
      ledger: ledger.createSnapshot(),
      core: core.createSnapshot(),
    }).toStrictEqual(pickupMismatchBefore);
    expect(core.restoreFromSnapshot(committedPickupCore)).toMatchObject({ ok: true });

    expect(
      hauling.deliver(token.jobId, input.tick + 2, items, storage, ledger, core),
    ).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    items.readStackInto(3, ledger, readScratch, stack);
    const destinationSlot = storageSlotOutput();
    storage.readSlotInto(3, destinationSlot);
    const terminalInput = {
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      owner,
      expectedJobSlotVersion: pickupCommittedBasis.jobSlotVersion,
      expectedJobCoreVersion: pickupCommittedBasis.jobCoreVersion,
      expectedDriverVersion: pickupCommittedBasis.driverVersion,
      expectedCurrentLedgerVersion: ledger.version,
      tick: input.tick + 2,
      outcome: "delivered" as const,
      failureReason: "none" as const,
      targetItem: {
        stackId: stack.stackId,
        entityIndex: stack.entityIndex,
        entityGeneration: stack.entityGeneration,
        defId: stack.defId,
        quantity: stack.quantity,
        capacity: stack.capacity,
        amount: 4,
        expectedRowVersion: stack.rowVersion,
        expectedStoreVersion: stack.storeVersion,
        expectedReservationVersion: stack.reservationVersion,
      },
      targetSlot: destinationSlot,
      targetDirty: {
        slotId: destinationSlot.slotId,
        expectedRowVersion: destinationSlot.rowVersion,
        expectedIndexVersion: destinationSlot.indexVersion,
        expectedDirtyBacklog: destinationSlot.dirtyBacklog,
        expectedDirtyQueued: destinationSlot.dirtyQueued,
        expectedDirtyHead: destinationSlot.dirtyHead,
        expectedDirtyCapacity: destinationSlot.dirtyCapacity,
        expectedDirtyQueueIndex: destinationSlot.dirtyQueueIndex,
      },
    };
    const releasableLedgerSnapshot = ledger.createSnapshot();
    expect(
      ledger.restoreFromSnapshot(
        { ...releasableLedgerSnapshot, ledgerVersion: 0xffff_ffff },
        registry,
      ),
    ).toMatchObject({ ok: true });
    hauling.terminalAdoptedInto(
      {
        ...terminalInput,
        expectedCurrentLedgerVersion: 0xffff_ffff,
        targetItem: { ...terminalInput.targetItem, expectedReservationVersion: 0xffff_ffff },
      },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({
      ok: false,
      cleanupPending: true,
      terminalOutcome: "delivered",
      releasedClaimCount: 0,
    });
    const cleanupPendingSnapshot = hauling.createSnapshot();
    expect(restoreHaulingJobStore(cleanupPendingSnapshot).createSnapshot()).toStrictEqual(
      cleanupPendingSnapshot,
    );
    expect(
      hauling.restoreFromSnapshot({
        ...cleanupPendingSnapshot,
        rows: mapTestValues(cleanupPendingSnapshot.rows, (row) =>
          row.jobId === token.jobId ? { ...row, pendingTerminalOutcome: 0 } : row,
        ),
      }),
    ).toStrictEqual({ ok: false, reason: "hauling_snapshot_invalid" });
    expect(items.readStack(3)).toMatchObject({ quantity: 4 });
    expect(hauling.createMetrics().activeCount).toBe(1);
    expect(core.createMetrics().activeCount).toBe(1);
    expect(ledger.restoreFromSnapshot(releasableLedgerSnapshot, registry)).toMatchObject({
      ok: true,
    });
    const cleanupDriverVersion = pickup.driverVersion;
    const cleanupUnrelated = ledger.acquire(
      {
        owner: unrelatedOwner,
        jobId: 2,
        createdTick: 3,
        leaseExpiryTick: 21,
        claims: [{ channel: "cell", cellIndex: 2 }],
      },
      registry,
    );
    if (!cleanupUnrelated.ok) throw new Error(cleanupUnrelated.reason);
    const cleanupOwnersBeforeStale = {
      items: items.createSnapshot(),
      storage: storage.createSnapshot(),
      core: core.createSnapshot(),
      ledger: ledger.createSnapshot(),
      metrics: hauling.createMetrics(),
    };
    hauling.terminalAdoptedInto(
      {
        ...terminalInput,
        expectedDriverVersion: cleanupDriverVersion,
        expectedCurrentLedgerVersion: releasableLedgerSnapshot.ledgerVersion,
        tick: terminalInput.tick + 1,
      },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect({
      items: items.createSnapshot(),
      storage: storage.createSnapshot(),
      core: core.createSnapshot(),
      ledger: ledger.createSnapshot(),
      metrics: hauling.createMetrics(),
    }).toStrictEqual(cleanupOwnersBeforeStale);
    hauling.resumeCleanupInto(
      {
        ...terminalInput,
        expectedDriverVersion: cleanupDriverVersion,
        expectedCurrentLedgerVersion: releasableLedgerSnapshot.ledgerVersion,
        tick: terminalInput.tick + 1,
      },
      ledger,
      core,
      pickup,
    );
    expect(pickup).toMatchObject({
      ok: false,
      cleanupPending: true,
      reason: "reservation_ledger_version_mismatch",
    });
    expect({
      items: items.createSnapshot(),
      storage: storage.createSnapshot(),
      core: core.createSnapshot(),
      ledger: ledger.createSnapshot(),
      metrics: hauling.createMetrics(),
    }).toStrictEqual(cleanupOwnersBeforeStale);
    hauling.resumeCleanupInto(
      {
        ...terminalInput,
        expectedDriverVersion: cleanupDriverVersion,
        expectedCurrentLedgerVersion: cleanupUnrelated.version,
        tick: terminalInput.tick + 2,
      },
      ledger,
      core,
      pickup,
    );
    expect(pickup).toMatchObject({
      ok: true,
      cleanupPending: false,
      terminalOutcome: "delivered",
      releasedClaimCount: 4,
    });
    expect(items.readStack(3)).toMatchObject({ quantity: 4 });
    expect(items.createMetrics().totalQuantity).toBe(6);
    expect(hauling.createMetrics().activeCount).toBe(0);
    const read = adoptedJobOutput();
    hauling.readAdoptedJobInto(
      token.jobId,
      token.jobGeneration,
      owner,
      pickup.jobSlotVersion,
      read,
    );
    expect(read).toMatchObject({
      ok: true,
      active: false,
      step: "delivered",
      effectPhase: 3,
      terminalOutcome: "delivered",
      carriedAmount: 0,
      reservationVersion: pickup.reservationVersion,
      deliveredCount: 1,
      cumulativeDeliveredCount: 1,
    });
    expect(Array.from(read.claimIds)).toStrictEqual([JOB_NONE, JOB_NONE, JOB_NONE, JOB_NONE]);
    const haulingSnapshot = hauling.createSnapshot();
    expect(restoreHaulingJobStore(haulingSnapshot).createSnapshot()).toStrictEqual(haulingSnapshot);
    const haulingHash = (value: typeof haulingSnapshot): string =>
      formatCanonicalWorldHash({
        fields: createHaulingJobHashFields(value),
        randomStreams: [],
        queuedCommands: [],
      });
    const changedRows = mapTestValues(haulingSnapshot.rows, (row) =>
      row.jobId === token.jobId ? { ...row, lastEffectTick: row.lastEffectTick + 1 } : row,
    );
    expect(haulingHash({ ...haulingSnapshot, rows: changedRows })).not.toBe(
      haulingHash(haulingSnapshot),
    );
    const identityRows = mapTestValues(haulingSnapshot.rows, (row) =>
      row.jobId === token.jobId ? { ...row, sourceItemIndex: row.sourceItemIndex + 1 } : row,
    );
    expect(haulingHash({ ...haulingSnapshot, rows: identityRows })).not.toBe(
      haulingHash(haulingSnapshot),
    );
    const corruptSnapshot = {
      ...haulingSnapshot,
      activeCount: 1,
      rows: mapTestValues(haulingSnapshot.rows, (row) =>
        row.jobId === token.jobId ? { ...row, active: 1 } : row,
      ),
    };
    expect(hauling.restoreFromSnapshot(corruptSnapshot)).toStrictEqual({
      ok: false,
      reason: "hauling_snapshot_invalid",
    });
    expect(hauling.createSnapshot()).toStrictEqual(haulingSnapshot);

    const terminalSnapshot = {
      items: items.createSnapshot(),
      storage: storage.createSnapshot(),
      ledger: ledger.createSnapshot(),
      core: core.createSnapshot(),
      metrics: hauling.createMetrics(),
    };
    const terminalCommittedBasis = {
      jobSlotVersion: pickup.jobSlotVersion,
      jobCoreVersion: pickup.jobCoreVersion,
      driverVersion: pickup.driverVersion,
      reservationVersion: pickup.reservationVersion,
    };
    const mismatchedTerminalCore = {
      ...terminalSnapshot.core,
      slots: mapTestValues(terminalSnapshot.core.slots, (row) =>
        row.jobId === token.jobId ? { ...row, targetId: row.targetId + 1 } : row,
      ),
      records: mapTestValues(terminalSnapshot.core.records, (row) =>
        row.jobId === token.jobId ? { ...row, targetId: row.targetId + 1 } : row,
      ),
    };
    expect(core.restoreFromSnapshot(mismatchedTerminalCore)).toMatchObject({ ok: true });
    const mismatchBefore = {
      items: items.createSnapshot(),
      storage: storage.createSnapshot(),
      ledger: ledger.createSnapshot(),
      core: core.createSnapshot(),
      metrics: hauling.createMetrics(),
    };
    hauling.terminalAdoptedInto(
      {
        ...terminalInput,
        expectedJobSlotVersion: terminalCommittedBasis.jobSlotVersion,
        expectedJobCoreVersion: terminalCommittedBasis.jobCoreVersion,
        expectedDriverVersion: terminalCommittedBasis.driverVersion,
        expectedCurrentLedgerVersion: terminalCommittedBasis.reservationVersion,
        tick: terminalInput.tick + 3,
      },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect({
      items: items.createSnapshot(),
      storage: storage.createSnapshot(),
      ledger: ledger.createSnapshot(),
      core: core.createSnapshot(),
      metrics: hauling.createMetrics(),
    }).toStrictEqual(mismatchBefore);
    expect(core.restoreFromSnapshot(terminalSnapshot.core)).toMatchObject({ ok: true });
    hauling.terminalAdoptedInto(
      {
        ...terminalInput,
        expectedJobSlotVersion: terminalCommittedBasis.jobSlotVersion,
        expectedJobCoreVersion: terminalCommittedBasis.jobCoreVersion,
        expectedDriverVersion: terminalCommittedBasis.driverVersion,
        expectedCurrentLedgerVersion: terminalCommittedBasis.reservationVersion,
        tick: terminalInput.tick + 3,
      },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
    expect(pickup).toMatchObject({ ok: true, alreadyCommitted: true, releasedClaimCount: 0 });
    expect({
      items: items.createSnapshot(),
      storage: storage.createSnapshot(),
      ledger: ledger.createSnapshot(),
      core: core.createSnapshot(),
      metrics: hauling.createMetrics(),
    }).toStrictEqual(terminalSnapshot);
  });

  it.each([
    {
      outcome: "canceled" as const,
      failureReason: "cancelled" as const,
      interruptionKind: undefined,
      step: "canceled" as const,
    },
    {
      outcome: "failed" as const,
      failureReason: "path" as const,
      interruptionKind: undefined,
      step: "failed" as const,
    },
    {
      outcome: "canceled" as const,
      failureReason: "cancelled" as const,
      interruptionKind: "immediate" as const,
      step: "canceled" as const,
    },
  ])("closes adopted $outcome hauling exactly once", (terminalCase) => {
    const fixture = createAdoptedPickupFixture();
    const targetSlotId = 2;
    const stack = itemOutput();
    const scratch = { entity: { index: 0, generation: 0 } };
    fixture.items.readStackInto(targetSlotId, fixture.ledger, scratch, stack);
    const slot = storageSlotOutput();
    fixture.storage.readSlotInto(targetSlotId, slot);
    const output = adoptedMutationOutput();
    const terminal = {
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      owner: fixture.owner,
      expectedJobSlotVersion: fixture.pickup.jobSlotVersion,
      expectedJobCoreVersion: fixture.pickup.jobCoreVersion,
      expectedDriverVersion: fixture.pickup.driverVersion,
      expectedCurrentLedgerVersion: fixture.ledger.version,
      tick: fixture.pickupTick + 1,
      outcome: terminalCase.outcome,
      failureReason: terminalCase.failureReason,
      ...(terminalCase.interruptionKind === undefined
        ? {}
        : { interruptionKind: terminalCase.interruptionKind }),
      targetItem: {
        stackId: stack.stackId,
        entityIndex: stack.entityIndex,
        entityGeneration: stack.entityGeneration,
        defId: stack.defId,
        quantity: stack.quantity,
        capacity: stack.capacity,
        amount: 4,
        expectedRowVersion: stack.rowVersion,
        expectedStoreVersion: stack.storeVersion,
        expectedReservationVersion: stack.reservationVersion,
      },
      targetSlot: slot,
      targetDirty: {
        slotId: slot.slotId,
        expectedRowVersion: slot.rowVersion,
        expectedIndexVersion: slot.indexVersion,
        expectedDirtyBacklog: slot.dirtyBacklog,
        expectedDirtyQueued: slot.dirtyQueued,
        expectedDirtyHead: slot.dirtyHead,
        expectedDirtyCapacity: slot.dirtyCapacity,
        expectedDirtyQueueIndex: slot.dirtyQueueIndex,
      },
    };
    fixture.hauling.terminalAdoptedInto(
      terminal,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      cleanupPending: false,
      terminalOutcome: terminalCase.outcome,
      releasedClaimCount: 4,
    });
    expect(fixture.items.readStack(2)).toMatchObject({ quantity: 6 });
    expect(fixture.items.readStack(3)).toMatchObject({ quantity: 0 });
    expect(fixture.items.createMetrics().totalQuantity).toBe(6);
    const read = adoptedJobOutput();
    fixture.hauling.readAdoptedJobInto(
      fixture.token.jobId,
      fixture.token.jobGeneration,
      fixture.owner,
      output.jobSlotVersion,
      read,
    );
    expect(read).toMatchObject({
      ok: true,
      active: false,
      step: terminalCase.step,
      effectPhase: 3,
      terminalOutcome: terminalCase.outcome,
      canceledCount: terminalCase.outcome === "canceled" ? 1 : 0,
      failedCount: terminalCase.outcome === "failed" ? 1 : 0,
    });
  });

  it.each([
    {
      outcome: "canceled" as const,
      failureReason: "cancelled" as const,
      interruptionKind: undefined,
      step: "canceled" as const,
    },
    {
      outcome: "failed" as const,
      failureReason: "path" as const,
      interruptionKind: undefined,
      step: "failed" as const,
    },
    {
      outcome: "canceled" as const,
      failureReason: "cancelled" as const,
      interruptionKind: "immediate" as const,
      step: "canceled" as const,
    },
  ])("closes phase-zero adopted $outcome without a domain effect", (terminalCase) => {
    const fixture = createAdoptedPickupFixture(false);
    const stack = itemOutput();
    fixture.items.readStackInto(2, fixture.ledger, { entity: { index: 0, generation: 0 } }, stack);
    const slot = storageSlotOutput();
    fixture.storage.readSlotInto(2, slot);
    const beforeItems = fixture.items.createSnapshot();
    const output = adoptedMutationOutput();
    fixture.hauling.terminalAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 102,
        outcome: terminalCase.outcome,
        failureReason: terminalCase.failureReason,
        ...(terminalCase.interruptionKind === undefined
          ? {}
          : { interruptionKind: terminalCase.interruptionKind }),
        targetItem: {
          stackId: stack.stackId,
          entityIndex: stack.entityIndex,
          entityGeneration: stack.entityGeneration,
          defId: stack.defId,
          quantity: stack.quantity,
          capacity: stack.capacity,
          amount: 4,
          expectedRowVersion: stack.rowVersion,
          expectedStoreVersion: stack.storeVersion,
          expectedReservationVersion: stack.reservationVersion,
        },
        targetSlot: slot,
        targetDirty: {
          slotId: slot.slotId,
          expectedRowVersion: slot.rowVersion,
          expectedIndexVersion: slot.indexVersion,
          expectedDirtyBacklog: slot.dirtyBacklog,
          expectedDirtyQueued: slot.dirtyQueued,
          expectedDirtyHead: slot.dirtyHead,
          expectedDirtyCapacity: slot.dirtyCapacity,
          expectedDirtyQueueIndex: slot.dirtyQueueIndex,
        },
      },
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      cleanupPending: false,
      terminalOutcome: terminalCase.outcome,
      releasedClaimCount: 4,
    });
    expect(fixture.items.createSnapshot()).toStrictEqual(beforeItems);
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.hauling.readJob(fixture.token.jobId)).toBeUndefined();
    const snapshot = fixture.hauling.createSnapshot();
    expect(restoreHaulingJobStore(snapshot).createSnapshot()).toStrictEqual(snapshot);
  });

  it("resumes phase-zero cleanup without replaying a domain effect", () => {
    const fixture = createAdoptedPickupFixture(false);
    const input = phaseZeroTerminalInput(fixture);
    const output = adoptedMutationOutput();
    const ledgerSnapshot = fixture.ledger.createSnapshot();
    const itemsBefore = fixture.items.createSnapshot();
    expect(
      fixture.ledger.restoreFromSnapshot(
        { ...ledgerSnapshot, ledgerVersion: 0xffff_ffff },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    fixture.hauling.terminalAdoptedInto(
      {
        ...input,
        expectedCurrentLedgerVersion: 0xffff_ffff,
        targetItem: { ...input.targetItem, expectedReservationVersion: 0xffff_ffff },
      },
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, cleanupPending: true, terminalOutcome: "canceled" });
    const pendingDriverVersion = output.driverVersion;
    const pendingSnapshot = fixture.hauling.createSnapshot();
    const pendingHash = formatCanonicalWorldHash({
      fields: createHaulingJobHashFields(pendingSnapshot),
      randomStreams: [],
      queuedCommands: [],
    });
    const reversedRows = mapTestValues(pendingSnapshot.rows, (row) =>
      row.jobId === fixture.token.jobId ? { ...row, lastEffectTick: row.stepEnteredTick - 1 } : row,
    );
    expect(
      fixture.hauling.restoreFromSnapshot({ ...pendingSnapshot, rows: reversedRows }),
    ).toStrictEqual({ ok: false, reason: "hauling_snapshot_invalid" });
    expect(fixture.hauling.createSnapshot()).toStrictEqual(pendingSnapshot);
    expect(
      formatCanonicalWorldHash({
        fields: createHaulingJobHashFields(fixture.hauling.createSnapshot()),
        randomStreams: [],
        queuedCommands: [],
      }),
    ).toBe(pendingHash);
    const pendingCore = fixture.core.createSnapshot();
    const foreignSlots = mapTestValues(pendingCore.slots, (row) =>
      row.jobId === fixture.token.jobId ? { ...row, targetId: row.targetId + 1 } : row,
    );
    const foreignRecords = mapTestValues(pendingCore.records, (row) =>
      row.jobId === fixture.token.jobId ? { ...row, targetId: row.targetId + 1 } : row,
    );
    expect(
      fixture.core.restoreFromSnapshot({
        ...pendingCore,
        slots: foreignSlots,
        records: foreignRecords,
      }),
    ).toMatchObject({ ok: true });
    fixture.hauling.resumeCleanupInto(
      {
        jobId: input.jobId,
        jobGeneration: input.jobGeneration,
        owner: input.owner,
        expectedJobSlotVersion: input.expectedJobSlotVersion,
        expectedJobCoreVersion: input.expectedJobCoreVersion,
        expectedDriverVersion: output.driverVersion,
        expectedCurrentLedgerVersion: 0xffff_ffff,
        tick: input.tick + 1,
        outcome: "canceled",
        failureReason: "cancelled",
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect(fixture.core.restoreFromSnapshot(pendingCore)).toMatchObject({ ok: true });
    expect(fixture.items.createSnapshot()).toStrictEqual(itemsBefore);
    fixture.hauling.terminalAdoptedInto(
      {
        ...input,
        expectedDriverVersion: pendingDriverVersion,
        expectedCurrentLedgerVersion: 0xffff_ffff,
        tick: input.tick + 1,
        targetItem: { ...input.targetItem, expectedReservationVersion: 0xffff_ffff },
      },
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect(fixture.ledger.restoreFromSnapshot(ledgerSnapshot, fixture.registry)).toMatchObject({
      ok: true,
    });
    fixture.hauling.resumeCleanupInto(
      {
        jobId: input.jobId,
        jobGeneration: input.jobGeneration,
        owner: input.owner,
        expectedJobSlotVersion: input.expectedJobSlotVersion,
        expectedJobCoreVersion: input.expectedJobCoreVersion,
        expectedDriverVersion: pendingDriverVersion,
        expectedCurrentLedgerVersion: ledgerSnapshot.ledgerVersion,
        tick: input.tick + 2,
        outcome: "canceled",
        failureReason: "cancelled",
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: true, cleanupPending: false, releasedClaimCount: 4 });
    expect(fixture.items.createSnapshot()).toStrictEqual(itemsBefore);
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
  });

  it("resumes phase-zero cleanup when adoption tick is not created tick plus one", () => {
    const fixture = createAdoptedPickupFixture(false, 0, false, false, 8, undefined, 175);
    const input = phaseZeroTerminalInput(fixture);
    expect(input.tick).toBe(176);
    const output = adoptedMutationOutput();
    const ledgerSnapshot = fixture.ledger.createSnapshot();
    expect(
      fixture.ledger.restoreFromSnapshot(
        { ...ledgerSnapshot, ledgerVersion: 0xffff_ffff },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    fixture.hauling.terminalAdoptedInto(
      {
        ...input,
        expectedCurrentLedgerVersion: 0xffff_ffff,
        targetItem: { ...input.targetItem, expectedReservationVersion: 0xffff_ffff },
      },
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, cleanupPending: true });
    expect(fixture.ledger.restoreFromSnapshot(ledgerSnapshot, fixture.registry)).toMatchObject({
      ok: true,
    });
    fixture.hauling.resumeCleanupInto(
      {
        jobId: input.jobId,
        jobGeneration: input.jobGeneration,
        owner: input.owner,
        expectedJobSlotVersion: input.expectedJobSlotVersion,
        expectedJobCoreVersion: input.expectedJobCoreVersion,
        expectedDriverVersion: output.driverVersion,
        expectedCurrentLedgerVersion: ledgerSnapshot.ledgerVersion,
        tick: input.tick + 1,
        outcome: "canceled",
        failureReason: "cancelled",
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: true, cleanupPending: false, releasedClaimCount: 4 });
  });

  it.each([
    { recordIndex: 1, field: "destination amount", lane: "amount" as const },
    { recordIndex: 2, field: "source interaction spot", lane: "slot" as const },
    { recordIndex: 3, field: "destination claim lease", lane: "lease" as const },
  ])("rejects adopted pickup with substituted $field claim", ({ recordIndex, lane }) => {
    const fixture = createAdoptedPickupFixture(false);
    const ledgerSnapshot = fixture.ledger.createSnapshot();
    const records = mapTestValues(ledgerSnapshot.records, (record, index) =>
      index !== recordIndex
        ? record
        : lane === "amount"
          ? { ...record, amount: record.amount - 1 }
          : lane === "slot"
            ? { ...record, slot: (record.slot ?? 0) + 1 }
            : { ...record, leaseExpiryTick: record.leaseExpiryTick + 1 },
    );
    expect(
      fixture.ledger.restoreFromSnapshot({ ...ledgerSnapshot, records }, fixture.registry),
    ).toMatchObject({ ok: true });
    const input = pickupInputForFixture(fixture, fixture.ledger.version);
    const before = {
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      items: fixture.items.createSnapshot(),
      storage: fixture.storage.createSnapshot(),
    };
    const output = adoptedMutationOutput();
    fixture.hauling.pickupAdoptedInto(
      input,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_source_unavailable" });
    expect({
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      items: fixture.items.createSnapshot(),
      storage: fixture.storage.createSnapshot(),
    }).toStrictEqual(before);
  });

  it("rejects ordinary pickup while cleanup is pending", () => {
    const fixture = createAdoptedPickupFixture(true);
    const terminal = pickedTerminalInput(fixture, "canceled");
    const ledgerSnapshot = fixture.ledger.createSnapshot();
    const output = adoptedMutationOutput();
    expect(
      fixture.ledger.restoreFromSnapshot(
        { ...ledgerSnapshot, ledgerVersion: 0xffff_ffff },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    fixture.hauling.terminalAdoptedInto(
      {
        ...terminal,
        expectedCurrentLedgerVersion: 0xffff_ffff,
        targetItem: { ...terminal.targetItem, expectedReservationVersion: 0xffff_ffff },
      },
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, cleanupPending: true });
    const before = {
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      items: fixture.items.createSnapshot(),
      storage: fixture.storage.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    const pickup = pickupInputForFixture(
      fixture,
      0xffff_ffff,
      output.driverVersion,
      fixture.pickup.jobSlotVersion,
      fixture.pickup.jobCoreVersion,
      terminal.tick + 1,
    );
    fixture.hauling.pickupAdoptedInto(
      pickup,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect({
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      items: fixture.items.createSnapshot(),
      storage: fixture.storage.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(before);
  });

  it.each(["policy", "required_work", "carried_def"] as const)(
    "rejects pickup duplicate with substituted canonical JobCore $field",
    (field) => {
      const fixture = createAdoptedPickupFixture(true);
      const snapshot = fixture.core.createSnapshot();
      const slots = mapTestValues(snapshot.slots, (row) =>
        row.jobId !== fixture.token.jobId
          ? row
          : field === "policy"
            ? { ...row, interruptionPolicyCode: 0 }
            : field === "required_work"
              ? { ...row, requiredWorkQ16: 1 }
              : { ...row, carriedDefId: STONE_DEF },
      );
      const records = mapTestValues(snapshot.records, (row) =>
        row.jobId !== fixture.token.jobId
          ? row
          : field === "policy"
            ? { ...row, interruptionPolicy: "never" as const }
            : field === "required_work"
              ? { ...row, requiredWorkQ16: 1 }
              : { ...row, carriedDefId: STONE_DEF },
      );
      expect(fixture.core.restoreFromSnapshot({ ...snapshot, slots, records })).toMatchObject({
        ok: true,
      });
      const before = {
        hauling: fixture.hauling.createSnapshot(),
        core: fixture.core.createSnapshot(),
        items: fixture.items.createSnapshot(),
        storage: fixture.storage.createSnapshot(),
      };
      const input = pickupInputForFixture(
        fixture,
        fixture.ledger.version,
        fixture.pickup.driverVersion,
        fixture.pickup.jobSlotVersion,
        fixture.pickup.jobCoreVersion,
        fixture.pickupTick + 1,
      );
      const output = adoptedMutationOutput();
      fixture.hauling.pickupAdoptedInto(
        input,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.core,
        fixture.claims,
        output,
      );
      expect(output).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
      expect({
        hauling: fixture.hauling.createSnapshot(),
        core: fixture.core.createSnapshot(),
        items: fixture.items.createSnapshot(),
        storage: fixture.storage.createSnapshot(),
      }).toStrictEqual(before);
    },
  );

  it("rejects terminal duplicate with substituted canonical JobCore payload", () => {
    const fixture = createAdoptedPickupFixture(true);
    const input = pickedTerminalInput(fixture, "canceled");
    const output = adoptedMutationOutput();
    fixture.hauling.terminalAdoptedInto(
      input,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: true });
    const terminalBasis = {
      slot: output.jobSlotVersion,
      core: output.jobCoreVersion,
      driver: output.driverVersion,
      reservation: output.reservationVersion,
    };
    const snapshot = fixture.core.createSnapshot();
    const slots = mapTestValues(snapshot.slots, (row) =>
      row.jobId === fixture.token.jobId ? { ...row, requiredWorkQ16: 1 } : row,
    );
    const records = mapTestValues(snapshot.records, (row) =>
      row.jobId === fixture.token.jobId ? { ...row, requiredWorkQ16: 1 } : row,
    );
    expect(fixture.core.restoreFromSnapshot({ ...snapshot, slots, records })).toMatchObject({
      ok: true,
    });
    const before = fixture.hauling.createSnapshot();
    fixture.hauling.terminalAdoptedInto(
      {
        ...input,
        expectedJobSlotVersion: terminalBasis.slot,
        expectedJobCoreVersion: terminalBasis.core,
        expectedDriverVersion: terminalBasis.driver,
        expectedCurrentLedgerVersion: terminalBasis.reservation,
        tick: input.tick + 1,
      },
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_step_invalid" });
    expect(fixture.hauling.createSnapshot()).toStrictEqual(before);
  });

  it("binds adoption to the exact claim read ids and preserves rollback slot basis", () => {
    const fixture = createAdoptedPickupFixture(false);
    const rolled = driverOutput();
    fixture.hauling.rollbackNewlyAdoptedInto(
      {
        ...fixture.control,
        expectedAdoptedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: fixture.adopted.driverVersion,
      },
      fixture.core,
      rolled,
    );
    expect(rolled).toMatchObject({ ok: true, jobSlotVersion: fixture.adopted.jobSlotVersion + 1 });
    const snapshot = fixture.hauling.createSnapshot();
    expect(snapshot.rows[fixture.token.jobId]).toMatchObject({
      active: 0,
      jobSlotVersion: rolled.jobSlotVersion,
    });

    const rejected = createAdoptedPickupFixture(false, 0, true, true);
    expect(rejected.adopted).toMatchObject({
      ok: false,
      reason: "hauling_adoption_preflight_failed",
    });
    expect(rejected.hauling.createSnapshot()).toStrictEqual(rejected.beforeAdoption);
  });

  it.each(["delivered", "canceled", "failed"] as const)(
    "restores the $outcome driver tombstone when a reused autonomous adoption rolls back",
    (outcome) => {
      const fixture = createAdoptedPickupFixture(true);
      const terminal = pickedTerminalInput(fixture, outcome);
      const terminalOutput = adoptedMutationOutput();
      fixture.hauling.terminalAdoptedInto(
        terminal,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.core,
        fixture.claims,
        terminalOutput,
      );
      expect(terminalOutput).toMatchObject({ ok: true, terminalOutcome: outcome });
      const originSnapshot = fixture.hauling.createSnapshot();
      const originRow = originSnapshot.rows[fixture.token.jobId];
      if (originRow === undefined) throw new Error("missing hauling origin tombstone");
      const next = reserveAndAdoptSameHaulingSlot(fixture, 200);
      expect(next.token).toMatchObject({
        ok: true,
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration + 1,
        originShadowPresent: true,
      });
      expect(next.adopted).toMatchObject({
        ok: true,
        driverDeliveredCount: outcome === "delivered" ? 1 : 0,
        driverCanceledCount: outcome === "canceled" ? 1 : 0,
        driverFailedCount: outcome === "failed" ? 1 : 0,
      });
      const adoptedSnapshot = fixture.hauling.createSnapshot();
      expect(adoptedSnapshot.rows[fixture.token.jobId]).toMatchObject({
        originShadowPresent: 1,
        originPendingTerminalOutcome: outcome === "delivered" ? 1 : outcome === "canceled" ? 2 : 3,
      });
      const adoptedRead = adoptedJobOutput();
      fixture.hauling.readAdoptedJobInto(
        next.token.jobId,
        next.token.jobGeneration,
        fixture.owner,
        next.adopted.jobSlotVersion,
        adoptedRead,
      );
      expect(adoptedRead).toMatchObject({
        ok: true,
        originShadowPresent: true,
        originJobGeneration: fixture.token.jobGeneration,
        originTerminalOutcome: outcome,
        originOwnerIndex: fixture.owner.index,
        originOwnerGeneration: fixture.owner.generation,
      });
      expect(restoreHaulingJobStore(adoptedSnapshot).createSnapshot()).toStrictEqual(
        adoptedSnapshot,
      );
      const hash = (value: typeof adoptedSnapshot): string =>
        formatCanonicalWorldHash({
          fields: createHaulingJobHashFields(value),
          randomStreams: [],
          queuedCommands: [],
        });
      const corruptRows = mapTestValues(adoptedSnapshot.rows, (row) =>
        row.jobId === fixture.token.jobId ? { ...row, originPendingTerminalOutcome: 0 } : row,
      );
      expect(hash({ ...adoptedSnapshot, rows: corruptRows })).not.toBe(hash(adoptedSnapshot));
      expect(
        fixture.hauling.restoreFromSnapshot({ ...adoptedSnapshot, rows: corruptRows }),
      ).toStrictEqual({ ok: false, reason: "hauling_snapshot_invalid" });
      expect(fixture.hauling.createSnapshot()).toStrictEqual(adoptedSnapshot);
      const rolled = driverOutput();
      fixture.hauling.rollbackNewlyAdoptedInto(
        {
          ...next.control,
          expectedAdoptedJobSlotVersion: next.adopted.jobSlotVersion,
          expectedAdoptedDriverVersion: next.adopted.driverVersion,
        },
        fixture.core,
        rolled,
      );
      expect(rolled).toMatchObject({
        ok: true,
        driverDeliveredCount: outcome === "delivered" ? 1 : 0,
        driverCanceledCount: outcome === "canceled" ? 1 : 0,
        driverFailedCount: outcome === "failed" ? 1 : 0,
        jobCoreCurrentTombstoneCount: 1,
        jobCoreCumulativeTerminalCount: 1,
      });
      const restoredRow = fixture.hauling.createSnapshot().rows[fixture.token.jobId];
      expect(restoredRow).toMatchObject({
        active: 0,
        ownerIndex: originRow.ownerIndex,
        ownerGeneration: originRow.ownerGeneration,
        jobGeneration: originRow.jobGeneration,
        stepCode: originRow.stepCode,
        effectPhase: 3,
        pendingTerminalOutcome: originRow.pendingTerminalOutcome,
        jobSlotVersion: rolled.jobSlotVersion,
        originShadowPresent: 0,
      });
      const rolledSnapshot = fixture.hauling.createSnapshot();
      expect(restoreHaulingJobStore(rolledSnapshot).createSnapshot()).toStrictEqual(rolledSnapshot);
    },
  );

  it.each([
    {
      field: "owner",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => ({
        ...control,
        ownerIndex: control.ownerIndex + 1,
      }),
    },
    {
      field: "claim",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => {
        const claimIds = new Uint32Array(control.claimIds);
        claimIds[0] = (claimIds[0] ?? 0) + 1;
        return { ...control, claimIds };
      },
    },
    {
      field: "created tick",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => ({
        ...control,
        claimCreatedTick: control.claimCreatedTick + 1,
      }),
    },
    {
      field: "adoption tick",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => ({
        ...control,
        adoptionTick: control.adoptionTick + 1,
      }),
    },
    {
      field: "reservation version",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => ({
        ...control,
        reservationReadVersion: control.reservationReadVersion + 1,
      }),
    },
    {
      field: "prior driver version",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => ({
        ...control,
        expectedDriverVersion: control.expectedDriverVersion + 1,
      }),
    },
    {
      field: "prior slot version",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => ({
        ...control,
        expectedJobSlotVersion: control.expectedJobSlotVersion + 1,
      }),
    },
    {
      field: "claim count",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => ({
        ...control,
        claimCount: 3,
      }),
    },
    {
      field: "claim tail",
      mutate: (
        control: ReturnType<typeof createAdoptedPickupFixture>["control"],
      ): ExistingClaimsAdoptionControl => {
        const claimIds = new Uint32Array(control.claimIds);
        claimIds[4] = 1;
        return { ...control, claimIds };
      },
    },
  ])("rejects rollback with stale $field before mutation", ({ mutate }) => {
    const fixture = createAdoptedPickupFixture(false);
    const before = fixture.hauling.createSnapshot();
    const output = driverOutput();
    fixture.hauling.rollbackNewlyAdoptedInto(
      {
        ...mutate(fixture.control),
        expectedAdoptedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: fixture.adopted.driverVersion,
      },
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_rollback_preflight_failed" });
    expect(fixture.hauling.createSnapshot()).toStrictEqual(before);
  });

  it("rejects terminal cumulative counter exhaustion before cross-owner mutation", () => {
    const fixture = createAdoptedPickupFixture(false);
    const snapshot = fixture.hauling.createSnapshot();
    expect(
      fixture.hauling.restoreFromSnapshot({ ...snapshot, cumulativeCanceledCount: 0xffff_ffff }),
    ).toMatchObject({ ok: true });
    const before = {
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      items: fixture.items.createSnapshot(),
    };
    const output = adoptedMutationOutput();
    fixture.hauling.terminalAdoptedInto(
      phaseZeroTerminalInput(fixture),
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "hauling_version_exhausted" });
    expect({
      hauling: fixture.hauling.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      items: fixture.items.createSnapshot(),
    }).toStrictEqual(before);
  });

  it("round trips exact hauling claim lifetime and rejects incoherent read and snapshot lanes", () => {
    const fixture = createAdoptedPickupFixture(false);
    const read = adoptedJobOutput();
    const claimIds = read.claimIds;
    const claimEpochs = read.claimEpochs;
    const createdTicks = read.claimCreatedTicks;
    const leaseTicks = read.claimLeaseExpiryTicks;
    fixture.hauling.readAdoptedJobInto(
      fixture.token.jobId,
      fixture.token.jobGeneration,
      fixture.owner,
      fixture.adopted.jobSlotVersion,
      read,
    );
    expect(read).toMatchObject({
      ok: true,
      sourceStackId: 2,
      destinationStackId: 3,
      defId: WOOD_DEF,
      destinationCapacity: 20,
    });
    expect(read.claimIds).toBe(claimIds);
    expect(read.claimEpochs).toBe(claimEpochs);
    expect(read.claimCreatedTicks).toBe(createdTicks);
    expect(read.claimLeaseExpiryTicks).toBe(leaseTicks);
    expect(Array.from(read.claimCreatedTicks)).toStrictEqual([100, 100, 100, 100]);
    expect(Array.from(read.claimLeaseExpiryTicks)).toStrictEqual([400, 400, 400, 400]);
    const short = { ...adoptedJobOutput(), claimIds: new Uint32Array(3) };
    fixture.hauling.readAdoptedJobInto(
      fixture.token.jobId,
      fixture.token.jobGeneration,
      fixture.owner,
      fixture.adopted.jobSlotVersion,
      short,
    );
    expect(short).toMatchObject({ ok: false, reason: "hauling_step_invalid" });

    const snapshot = fixture.hauling.createSnapshot();
    const hash = (value: typeof snapshot): string =>
      formatCanonicalWorldHash({
        fields: createHaulingJobHashFields(value),
        randomStreams: [],
        queuedCommands: [],
      });
    const beforeHash = hash(snapshot);
    const lifetimeRows = mapTestValues(snapshot.rows, (row) =>
      row.jobId === fixture.token.jobId
        ? { ...row, claimLeaseExpiryTicks: [99, ...row.claimLeaseExpiryTicks.slice(1)] }
        : row,
    );
    expect(fixture.hauling.restoreFromSnapshot({ ...snapshot, rows: lifetimeRows })).toStrictEqual({
      ok: false,
      reason: "hauling_snapshot_invalid",
    });
    const falseDeliveredRows = mapTestValues(snapshot.rows, (row) =>
      row.jobId === fixture.token.jobId
        ? {
            ...row,
            effectPhase: 2,
            pendingTerminalOutcome: 1,
            pendingTerminalFailure: 0,
            pendingInterruptionKind: 0,
            lastEffectTick: row.stepEnteredTick + 1,
          }
        : row,
    );
    expect(
      fixture.hauling.restoreFromSnapshot({ ...snapshot, rows: falseDeliveredRows }),
    ).toStrictEqual({ ok: false, reason: "hauling_snapshot_invalid" });
    expect(fixture.hauling.createSnapshot()).toStrictEqual(snapshot);
    expect(hash(fixture.hauling.createSnapshot())).toBe(beforeHash);
    const changedLeaseRows = mapTestValues(snapshot.rows, (row) =>
      row.jobId === fixture.token.jobId
        ? {
            ...row,
            claimLeaseExpiryTicks: mapTestValues(row.claimLeaseExpiryTicks, (tick) => tick + 1),
          }
        : row,
    );
    expect(hash({ ...snapshot, rows: changedLeaseRows })).not.toBe(beforeHash);
  });

  it("uses exact driver headroom for pickup and phase-zero terminal commits", () => {
    const pickupAccepted = createAdoptedPickupFixture(true, 0xffff_fffd);
    expect(pickupAccepted.pickup).toMatchObject({ ok: true, driverVersion: 0xffff_ffff });

    const terminalAccepted = createAdoptedPickupFixture(false, 0xffff_fffc);
    const acceptedOutput = adoptedMutationOutput();
    terminalAccepted.hauling.terminalAdoptedInto(
      phaseZeroTerminalInput(terminalAccepted),
      terminalAccepted.items,
      terminalAccepted.storage,
      terminalAccepted.ledger,
      terminalAccepted.core,
      terminalAccepted.claims,
      acceptedOutput,
    );
    expect(acceptedOutput).toMatchObject({ ok: true, driverVersion: 0xffff_ffff });

    const terminalRejected = createAdoptedPickupFixture(false, 0xffff_fffd);
    const before = terminalRejected.hauling.createSnapshot();
    const rejectedOutput = adoptedMutationOutput();
    terminalRejected.hauling.terminalAdoptedInto(
      phaseZeroTerminalInput(terminalRejected),
      terminalRejected.items,
      terminalRejected.storage,
      terminalRejected.ledger,
      terminalRejected.core,
      terminalRejected.claims,
      rejectedOutput,
    );
    expect(rejectedOutput).toMatchObject({ ok: false, reason: "hauling_version_exhausted" });
    expect(terminalRejected.hauling.createSnapshot()).toStrictEqual(before);
  });

  it.each(["claim_id", "claim_epoch", "target", "amount", "slot"] as const)(
    "rejects substituted terminal %s facts before any owner mutation",
    (substitution) => {
      const fixture = createAdoptedPickupFixture(false);
      if (substitution === "claim_id" || substitution === "claim_epoch") {
        const snapshot = fixture.hauling.createSnapshot();
        const rows = mapTestValues(snapshot.rows, (row) =>
          row.jobId === fixture.token.jobId
            ? {
                ...row,
                claimIds:
                  substitution === "claim_id"
                    ? [(row.claimIds[0] ?? 0) + 100, ...row.claimIds.slice(1)]
                    : row.claimIds,
                claimEpochs:
                  substitution === "claim_epoch"
                    ? [(row.claimEpochs[0] ?? 0) + 1, ...row.claimEpochs.slice(1)]
                    : row.claimEpochs,
              }
            : row,
        );
        expect(fixture.hauling.restoreFromSnapshot({ ...snapshot, rows })).toMatchObject({
          ok: true,
        });
      } else {
        const snapshot = fixture.ledger.createSnapshot();
        const first = snapshot.records[0];
        if (first === undefined) throw new Error("missing hauling claim");
        const substitutedIndex = substitution === "slot" ? 1 : 0;
        const records = mapTestValues(snapshot.records, (record, index) =>
          index === substitutedIndex
            ? substitution === "target"
              ? { ...record, target: fixture.destination }
              : substitution === "amount"
                ? { ...record, amount: record.amount - 1 }
                : { ...record, slot: (record.slot ?? 0) + 1 }
            : record,
        );
        expect(
          fixture.ledger.restoreFromSnapshot({ ...snapshot, records }, fixture.registry),
        ).toMatchObject({ ok: true });
      }
      const before = {
        items: fixture.items.createSnapshot(),
        storage: fixture.storage.createSnapshot(),
        core: fixture.core.createSnapshot(),
        hauling: fixture.hauling.createSnapshot(),
      };
      const output = adoptedMutationOutput();
      fixture.hauling.terminalAdoptedInto(
        phaseZeroTerminalInput(fixture),
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.core,
        fixture.claims,
        output,
      );
      expect(output).toMatchObject({ ok: false });
      expect({
        items: fixture.items.createSnapshot(),
        storage: fixture.storage.createSnapshot(),
        core: fixture.core.createSnapshot(),
        hauling: fixture.hauling.createSnapshot(),
      }).toStrictEqual(before);
    },
  );
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
    expect(
      fixture.ledger.reservedAmountForItem(fixture.stackEntities[0] ?? failMissingEntity()),
    ).toBe(4);
    expect(
      fixture.ledger.reservedAmountForCapacity(
        fixture.storageEntities[1] ?? failMissingEntity(),
        1,
      ),
    ).toBe(4);

    expect(
      fixture.hauling.pickup(0, 3, fixture.items, fixture.storage, fixture.jobCore),
    ).toMatchObject({
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
    expect(
      fixture.ledger.reservedAmountForItem(fixture.stackEntities[0] ?? failMissingEntity()),
    ).toBe(4);
    expect(fixture.ledger.createMetrics().activeCount).toBe(4);
  });

  it("preserves reservations when a Float64-safe tick exceeds uint32", () => {
    const fixture = createFixture();
    refreshAll(fixture);

    expect(createHaul(fixture, 0, 0, 4)).toMatchObject({ ok: true });
    expect(
      fixture.hauling.reserveBeforePickup(
        0,
        4_294_967_296,
        fixture.registry,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.ledger.createMetrics()).toMatchObject({
      activeCount: 4,
      acquiredCount: 4,
      releasedCount: 0,
    });
    const legacyReservedSnapshot = fixture.hauling.createSnapshot();
    expect(legacyReservedSnapshot.rows[0]?.claimCreatedTicks).toStrictEqual([
      4_294_967_296, 4_294_967_296, 4_294_967_296, 4_294_967_296,
    ]);
    expect(restoreHaulingJobStore(legacyReservedSnapshot).createSnapshot()).toStrictEqual(
      legacyReservedSnapshot,
    );
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 6 });
    expect(fixture.items.readStack(1)).toMatchObject({ quantity: 0 });
    expect(fixture.hauling.readJob(0)).toMatchObject({
      step: "reserved",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(totalWood(fixture)).toBe(6);
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
    expect(
      fixture.hauling.pickup(0, 2, fixture.items, fixture.storage, fixture.jobCore),
    ).toMatchObject({
      ok: true,
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });

    expect(
      fixture.hauling.cancel(0, 3, fixture.items, fixture.storage, fixture.ledger, fixture.jobCore),
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
    const legacyTerminalSnapshot = fixture.hauling.createSnapshot();
    expect(restoreHaulingJobStore(legacyTerminalSnapshot).createSnapshot()).toStrictEqual(
      legacyTerminalSnapshot,
    );
    expect(totalWood(fixture)).toBe(6);
  });

  it("keeps material conserved when pickup fails before JobCore transition", () => {
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

    expect(
      fixture.hauling.pickup(0, -1, fixture.items, fixture.storage, fixture.jobCore),
    ).toStrictEqual({
      ok: false,
      reason: "hauling_job_core_failed",
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 6 });
    expect(fixture.hauling.readJob(0)).toMatchObject({
      step: "reserved",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({
      step: "path_to_source",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(4);
    expect(totalWood(fixture)).toBe(6);
  });

  it("keeps delivery fail-closed when JobCore completion rejects invalid tick", () => {
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
    expect(
      fixture.hauling.pickup(0, 2, fixture.items, fixture.storage, fixture.jobCore),
    ).toMatchObject({
      ok: true,
    });

    expect(
      fixture.hauling.deliver(
        0,
        -1,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toStrictEqual({
      ok: false,
      reason: "hauling_job_core_failed",
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.items.readStack(1)).toMatchObject({ quantity: 0 });
    expect(fixture.hauling.readJob(0)).toMatchObject({
      step: "picked_up",
      carriedDefId: WOOD_DEF,
      carriedAmount: 4,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({
      status: "running",
      step: "interact",
      carriedDefId: WOOD_DEF,
      carriedAmount: 4,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(4);
    expect(totalWood(fixture)).toBe(6);
  });

  it("m2-storage-hauling updates multiple supply and demand buckets from dirty owner changes", () => {
    const fixture = createM2Fixture();
    refreshAll(fixture);

    const selected = new Uint32Array(4);
    expect(fixture.storage.selectSupplySlots(WOOD_DEF, 4, selected)).toMatchObject({
      ok: true,
      defId: WOOD_DEF,
      visitedCount: 2,
      selectedCount: 2,
      candidateCapHit: false,
    });
    expect(Array.from(selected.slice(0, 2))).toStrictEqual([0, 1]);
    expect(fixture.storage.selectDemandSlots(WOOD_DEF, 4, selected)).toMatchObject({
      ok: true,
      visitedCount: 2,
      selectedCount: 2,
      candidateCapHit: false,
    });
    expect(Array.from(selected.slice(0, 2))).toStrictEqual([3, 4]);
    expect(fixture.storage.selectSupplySlots(STONE_DEF, 4, selected)).toMatchObject({
      ok: true,
      visitedCount: 1,
      selectedCount: 1,
    });
    expect(selected[0]).toBe(2);
    expect(fixture.storage.selectDemandSlots(STONE_DEF, 4, selected)).toMatchObject({
      ok: true,
      visitedCount: 1,
      selectedCount: 1,
    });
    expect(selected[0]).toBe(5);
    expect(fixture.storage.createMetrics()).toMatchObject({
      dirtyBacklog: 0,
      indexedSupplySlots: 3,
      indexedDemandSlots: 3,
    });

    expect(createHaulBetweenSlots(fixture, 0, 0, 0, 3, 4)).toMatchObject({ ok: true });
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
    expect(fixture.storage.readSlot(0)).toMatchObject({ availableSupply: 4 });
    expect(fixture.storage.readSlot(3)).toMatchObject({ demandQuantity: 2 });

    expect(
      fixture.hauling.pickup(0, 2, fixture.items, fixture.storage, fixture.jobCore),
    ).toMatchObject({ ok: true });
    refreshAll(fixture);
    expect(fixture.storage.readSlot(0)).toMatchObject({ availableSupply: 0 });

    expect(
      fixture.hauling.deliver(
        0,
        3,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    refreshAll(fixture);

    expect(fixture.storage.readSlot(0)).toMatchObject({ quantity: 4, availableSupply: 4 });
    expect(fixture.storage.readSlot(3)).toMatchObject({ quantity: 4, demandQuantity: 2 });
    expect(fixture.storage.createMetrics()).toMatchObject({
      dirtyBacklog: 0,
      indexedSupplySlots: 4,
      indexedDemandSlots: 3,
    });
    expect(totalDef(fixture, WOOD_DEF, 6)).toBe(12);
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
  });

  it("m2-storage-hauling conserves carried quantities on fail and interruption", () => {
    const fixture = createM2Fixture();
    refreshAll(fixture);

    expect(createHaulBetweenSlots(fixture, 0, 0, 0, 3, 4)).toMatchObject({ ok: true });
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
    expect(
      fixture.hauling.pickup(0, 2, fixture.items, fixture.storage, fixture.jobCore),
    ).toMatchObject({ ok: true });
    expect(
      fixture.hauling.fail(
        0,
        3,
        "path",
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.hauling.readJob(0)).toMatchObject({
      step: "failed",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({
      status: "failed",
      failureReason: "path",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 8 });
    expect(totalDef(fixture, WOOD_DEF, 6)).toBe(12);
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);

    expect(createHaulBetweenSlots(fixture, 1, 1, 0, 3, 4)).toMatchObject({ ok: true });
    expect(
      fixture.hauling.reserveBeforePickup(
        1,
        4,
        fixture.registry,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.hauling.pickup(1, 5, fixture.items, fixture.storage, fixture.jobCore),
    ).toMatchObject({ ok: true });
    expect(
      fixture.hauling.interrupt(
        1,
        "immediate",
        6,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });

    expect(fixture.hauling.readJob(1)).toMatchObject({
      step: "canceled",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(fixture.jobCore.readJob(1)).toMatchObject({
      status: "canceled",
      carriedDefId: JOB_NONE,
      carriedAmount: 0,
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 8 });
    expect(totalDef(fixture, WOOD_DEF, 6)).toBe(12);
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
  });

  it("m2-storage-hauling rolls back returned carried items if cancellation is rejected", () => {
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
    expect(
      fixture.hauling.pickup(0, 2, fixture.items, fixture.storage, fixture.jobCore),
    ).toMatchObject({ ok: true });

    expect(
      fixture.hauling.cancel(
        0,
        -1,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "hauling_job_core_failed" });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.hauling.readJob(0)).toMatchObject({
      step: "picked_up",
      carriedDefId: WOOD_DEF,
      carriedAmount: 4,
    });
    expect(totalWood(fixture)).toBe(6);
    expect(fixture.ledger.createMetrics().activeCount).toBe(4);
  });
});

function driverOutput(): HaulingClaimAdoptionOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    jobSlotVersion: 0,
    jobCoreVersion: 0,
    driverVersion: 0,
    activeCount: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    jobCoreReservedCount: 0,
    jobCoreActiveCount: 0,
    jobCoreRunningCount: 0,
    jobCoreCurrentTombstoneCount: 0,
    jobCoreCumulativeTerminalCount: 0,
    driverReservedCount: 0,
    driverPickedUpCount: 0,
    driverDeliveredCount: 0,
    driverCanceledCount: 0,
    driverFailedCount: 0,
    cumulativeDeliveredCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
  };
}
function tokenOutput(): JobTokenIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    ownerOccupied: false,
    ownerLegacyLiveCount: 0,
    state: "free" as const,
    originState: "free" as const,
    slotVersion: 0,
    version: 0,
    slotGenerationCounter: 0,
    originShadowPresent: false,
    originJobGeneration: 0,
    originOwnerIndex: 0,
    originOwnerGeneration: 0,
    originJobKind: 0,
    originTargetId: 0,
    originStatus: undefined,
    originFailureReason: "none" as const,
    originCreatedTick: 0,
    originTerminalTick: 0,
    originEffectPhase: 0,
    terminalEffectPhase: 0,
    reservedCount: 0,
    activeCount: 0,
    runningCount: 0,
    currentTombstoneCount: 0,
    cumulativeTerminalCount: 0,
  };
}
function adoptedMutationOutput(): HaulingAdoptedMutationOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: JOB_NONE,
    jobGeneration: 0,
    jobSlotVersion: 0,
    jobCoreVersion: 0,
    driverVersion: 0,
    itemRowVersion: 0,
    itemStoreVersion: 0,
    storageRowVersion: 0,
    storageIndexVersion: 0,
    storageDirtyBacklog: 0,
    reservationVersion: 0,
    alreadyCommitted: false,
    cleanupPending: false,
    terminalOutcome: undefined,
    releasedClaimCount: 0,
  };
}

function adoptedJobOutput(): HaulingAdoptedJobIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    jobId: JOB_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    sourceSlotId: 0,
    destinationSlotId: 0,
    sourceItemIndex: 0,
    sourceItemGeneration: 0,
    destinationStorageIndex: 0,
    destinationStorageGeneration: 0,
    sourceInteractionSpotId: 0,
    destinationInteractionSpotId: 0,
    sourceStackId: 0,
    destinationStackId: 0,
    defId: 0,
    destinationCapacity: 0,
    claimIds: new Uint32Array(4),
    claimEpochs: new Uint32Array(4),
    claimCreatedTicks: new Float64Array(4),
    claimLeaseExpiryTicks: new Float64Array(4),
    amount: 0,
    createdTick: 0,
    stepEnteredTick: 0,
    step: "unassigned",
    carriedDefId: JOB_NONE,
    carriedAmount: 0,
    jobSlotVersion: 0,
    driverVersion: 0,
    reservationVersion: 0,
    effectPhase: 0,
    pickupCommitted: false,
    cleanupPending: false,
    terminalOutcome: undefined,
    pendingTerminalFailure: 0,
    pendingInterruptionKind: 0,
    lastEffectTick: 0,
    activeCount: 0,
    reservedCount: 0,
    pickedUpCount: 0,
    deliveredCount: 0,
    canceledCount: 0,
    failedCount: 0,
    cumulativeDeliveredCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    originShadowPresent: false,
    originOwnerIndex: 0,
    originOwnerGeneration: 0,
    originSourceSlotId: 0,
    originDestinationSlotId: 0,
    originSourceItemIndex: 0,
    originSourceItemGeneration: 0,
    originDestinationStorageIndex: 0,
    originDestinationStorageGeneration: 0,
    originSourceInteractionSpotId: 0,
    originDestinationInteractionSpotId: 0,
    originSourceStackId: 0,
    originDestinationStackId: 0,
    originDefId: 0,
    originDestinationCapacity: 0,
    originAmount: 0,
    originCreatedTick: 0,
    originStepEnteredTick: 0,
    originJobGeneration: 0,
    originReservationVersion: 0,
    originStep: "unassigned",
    originPickupCommitted: false,
    originLastEffectTick: 0,
    originTerminalOutcome: undefined,
    originPendingTerminalFailure: 0,
    originPendingInterruptionKind: 0,
  };
}
function itemOutput(): ItemStackIntoOutput {
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
function storageSlotOutput(): StorageSlotIntoOutput {
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
function slotInput(
  slotId: number,
  storage: EntityId,
  stackId: number,
  capacity: number,
  desiredQuantity: number,
): StorageSlotInput {
  return {
    slotId,
    storage,
    stackId,
    defId: WOOD_DEF,
    capacity,
    desiredQuantity,
    interactionCellIndex: slotId + 9,
    offerId: slotId,
    workType: 0,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
  };
}
function haulingClaims(
  owner: EntityId,
  source: EntityId,
  destination: EntityId,
  jobId: number,
  generation: number,
): ReservationClaimsIntoOutput {
  const c = {
    ok: true,
    reason: undefined,
    claimIndex: RESERVATION_CLAIM_NONE,
    claimId: RESERVATION_CLAIM_NONE,
    claimCount: 4,
    version: 9,
    activeCount: 4,
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
  c.channelCodes.set([
    RESERVATION_ITEM_QUANTITY,
    RESERVATION_CAPACITY,
    RESERVATION_INTERACTION_SPOT,
    RESERVATION_INTERACTION_SPOT,
  ]);
  for (let i = 0; i < 4; i += 1) {
    c.ownerIndexes[i] = owner.index;
    c.ownerGenerations[i] = owner.generation;
    c.jobIds[i] = jobId;
    c.jobGenerations[i] = generation;
    c.hasTargetFlags[i] = 1;
    const target = i === 0 || i === 2 ? source : destination;
    c.targetIndexes[i] = target.index;
    c.targetGenerations[i] = target.generation;
    c.allocationEpochs[i] = 9;
    c.createdTicks[i] = 100;
    c.leaseExpiryTicks[i] = 400;
  }
  c.amounts[0] = 4;
  c.amounts[1] = 4;
  c.slotIds[1] = 3;
  c.slotIds[2] = 11;
  c.slotIds[3] = 12;
  return c;
}

function haulingClaimFacts(
  source: EntityId,
  destination: EntityId,
  reservationVersion: number,
): HaulingClaimFactsIntoOutput {
  const channelCodes = new Uint8Array(8);
  channelCodes[0] = RESERVATION_ITEM_QUANTITY;
  channelCodes[1] = RESERVATION_CAPACITY;
  channelCodes[2] = RESERVATION_INTERACTION_SPOT;
  channelCodes[3] = RESERVATION_INTERACTION_SPOT;
  const targetIndexes = new Uint32Array(8);
  targetIndexes.fill(JOB_NONE);
  targetIndexes[0] = source.index;
  targetIndexes[1] = destination.index;
  targetIndexes[2] = source.index;
  targetIndexes[3] = destination.index;
  const targetGenerations = new Uint32Array(8);
  targetGenerations.fill(JOB_NONE);
  targetGenerations[0] = source.generation;
  targetGenerations[1] = destination.generation;
  targetGenerations[2] = source.generation;
  targetGenerations[3] = destination.generation;
  const slotIds = new Uint32Array(8);
  slotIds.fill(JOB_NONE);
  slotIds[1] = 3;
  slotIds[2] = 11;
  slotIds[3] = 12;
  const amounts = new Uint32Array(8);
  amounts[0] = 4;
  amounts[1] = 4;
  const limits = new Uint32Array(8);
  limits[0] = 6;
  limits[1] = 20;
  const cellIndexes = new Uint32Array(8);
  cellIndexes.fill(JOB_NONE);
  cellIndexes[2] = 20;
  cellIndexes[3] = 21;
  const domainIds = new Uint32Array(8);
  domainIds.fill(JOB_NONE);
  domainIds[0] = 2;
  domainIds[1] = 3;
  domainIds[2] = 2;
  domainIds[3] = 3;
  const factCodes = new Uint8Array(8);
  factCodes[0] = HAUL_TRANSFER_AMOUNT_FACT_CODE;
  const factValues = new Int32Array(8);
  factValues[0] = 4;
  return {
    ok: true,
    reason: undefined,
    sourceSlotId: 2,
    destinationSlotId: 3,
    sourceStackId: 2,
    destinationStackId: 3,
    defId: WOOD_DEF,
    amount: 4,
    sourceEntityIndex: source.index,
    sourceEntityGeneration: source.generation,
    destinationEntityIndex: destination.index,
    destinationEntityGeneration: destination.generation,
    sourceInteractionSpotId: 11,
    destinationInteractionSpotId: 12,
    sourceRowVersion: 1,
    destinationRowVersion: 1,
    indexVersion: 2,
    descriptor: HAULING_CLAIM_FACTS_DESCRIPTOR,
    workType: HAULING_CLAIM_FACTS_WORK_TYPE,
    offerId: 1,
    opaqueTargetId: 1,
    offerOwnerVersion: 1,
    offerRowVersion: 1,
    offerIndexVersion: 1,
    sourceDirtyBacklog: 0,
    destinationDirtyBacklog: 0,
    itemRowVersion: 1,
    itemStoreVersion: 1,
    reservationVersion,
    manifestVersion: HAULING_CLAIM_FACTS_MANIFEST_VERSION,
    channelCodes,
    targetIndexes,
    targetGenerations,
    slotIds,
    amounts,
    limits,
    cellIndexes,
    domainIds,
    policyKind: HAULING_CLAIM_POLICY_KIND,
    policyVersion: HAULING_CLAIM_POLICY_VERSION,
    factCount: 1,
    factCodes,
    factValues,
    transitionTargetSlot: HAULING_CLAIM_TRANSITION_TARGET_SLOT,
    mappingRowVersion: 1,
    mappingIndexVersion: 1,
    channelCount: 4,
  };
}

function haulingFactsBasis(facts: HaulingClaimFactsIntoOutput): HaulingClaimFactsBasis {
  return {
    descriptor: facts.descriptor,
    workType: facts.workType,
    offerId: facts.offerId,
    opaqueTargetId: facts.opaqueTargetId,
    offerOwnerVersion: facts.offerOwnerVersion,
    offerRowVersion: facts.offerRowVersion,
    offerIndexVersion: facts.offerIndexVersion,
    mappingRowVersion: facts.mappingRowVersion,
    mappingIndexVersion: facts.mappingIndexVersion,
    sourceRowVersion: facts.sourceRowVersion,
    destinationRowVersion: facts.destinationRowVersion,
    storageIndexVersion: facts.indexVersion,
    sourceDirtyBacklog: facts.sourceDirtyBacklog,
    destinationDirtyBacklog: facts.destinationDirtyBacklog,
    sourceInteractionCellIndex: facts.cellIndexes[2] ?? JOB_NONE,
    destinationInteractionCellIndex: facts.cellIndexes[3] ?? JOB_NONE,
    itemRowVersion: facts.itemRowVersion,
    itemStoreVersion: facts.itemStoreVersion,
    reservationVersion: facts.reservationVersion,
  };
}

interface AdoptedPickupFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly owner: EntityId;
  readonly source: EntityId;
  readonly destination: EntityId;
  readonly core: ReturnType<typeof createJobCoreStore>;
  readonly token: JobTokenIntoOutput;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly claims: ReservationClaimsIntoOutput;
  readonly hauling: ReturnType<typeof createHaulingJobStore>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly adopted: HaulingClaimAdoptionOutput;
  readonly control: ExistingClaimsAdoptionControl;
  readonly beforeAdoption: ReturnType<ReturnType<typeof createHaulingJobStore>["createSnapshot"]>;
  readonly beforeCoreAdoption: ReturnType<ReturnType<typeof createJobCoreStore>["createSnapshot"]>;
  readonly pickup: HaulingAdoptedMutationOutput;
  readonly pickupTick: number;
}

function createAdoptedPickupFixture(
  pickupJob = true,
  initialDriverVersion = 0,
  allowAdoptionFailure = false,
  substituteReadClaimId = false,
  haulingCapacity = 8,
  mutateFacts?: (facts: HaulingClaimFactsIntoOutput) => void,
  adoptionTick = 101,
  destinationCapacity = 20,
): AdoptedPickupFixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const owner = allocate(registry);
  const source = allocate(registry);
  const destination = allocate(registry);
  const sourceStorage = allocate(registry);
  const destinationItem = allocate(registry);
  const core = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
  const token = tokenOutput();
  core.reserveAutonomyJobTokenInto(core.version, owner, token);
  const ledger = createReservationLedger({ capacity: 16, entityCapacity: 16, cellCount: 32 });
  const acquired = ledger.acquire(
    {
      owner,
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      createdTick: 100,
      leaseExpiryTick: 400,
      claims: [
        { channel: "item_quantity", item: source, amount: 4, availableAmount: 6 },
        { channel: "capacity", target: destination, capacityId: 3, amount: 4, capacity: 20 },
        { channel: "interaction_spot", target: source, spotId: 11 },
        { channel: "interaction_spot", target: destination, spotId: 12 },
      ],
    },
    registry,
  );
  if (!acquired.ok) throw new Error(acquired.reason);
  const ids = new Uint32Array(8);
  ids.fill(RESERVATION_CLAIM_NONE);
  const epochs = new Uint32Array(8);
  for (let index = 0; index < 4; index += 1) {
    ids[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
    epochs[index] = acquired.version;
  }
  const claims = haulingClaims(owner, source, destination, token.jobId, token.jobGeneration);
  ledger.readActiveClaimsInto(
    ids,
    epochs,
    4,
    owner,
    token.jobId,
    token.jobGeneration,
    acquired.version,
    claims,
  );
  const emptyHauling = createHaulingJobStore(haulingCapacity);
  const hauling =
    initialDriverVersion === 0
      ? emptyHauling
      : restoreHaulingJobStore({
          ...emptyHauling.createSnapshot(),
          storeVersion: initialDriverVersion,
        });
  const adopted = driverOutput();
  const control = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: owner.index,
    ownerGeneration: owner.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: core.version,
    expectedDriverVersion: initialDriverVersion,
    claimCount: 4,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: 100,
    adoptionTick,
    reservationReadVersion: acquired.version,
  };
  const beforeAdoption = hauling.createSnapshot();
  const beforeCoreAdoption = core.createSnapshot();
  const readClaimIds = substituteReadClaimId ? new Uint32Array(ids) : ids;
  if (substituteReadClaimId) readClaimIds[0] = (readClaimIds[0] ?? 0) + 1;
  const claimFacts = haulingClaimFacts(source, destination, acquired.version);
  const claimFactsBasis = haulingFactsBasis(claimFacts);
  mutateFacts?.(claimFacts);
  hauling.adoptExistingClaimsInto(
    control,
    {
      jobId: token.jobId,
      owner,
      sourceSlotId: 2,
      destinationSlotId: 3,
      amount: 4,
      sourceStackId: 2,
      destinationStackId: 3,
      defId: WOOD_DEF,
      createdTick: 100,
      sourceItem: source,
      destinationStorage: destination,
      sourceInteractionSpotId: 11,
      destinationInteractionSpotId: 12,
      destinationCapacity,
      readClaimIds,
      readClaimEpochs: epochs,
      claims,
      claimFacts,
      claimFactsBasis,
    },
    core,
    adopted,
  );
  if (!adopted.ok && !allowAdoptionFailure) throw new Error(String(adopted.reason));
  const items = createItemStackStore(8);
  items.createStack({ stackId: 2, entity: source, defId: WOOD_DEF, quantity: 6, capacity: 8 });
  items.createStack({
    stackId: 3,
    entity: destinationItem,
    defId: WOOD_DEF,
    quantity: 0,
    capacity: 20,
  });
  const storage = createStorageLogisticsIndex(8, 8);
  storage.configureSlot(slotInput(2, sourceStorage, 2, 8, 0));
  storage.configureSlot(slotInput(3, destination, 3, 20, 20));
  const stack = itemOutput();
  const scratch = { entity: { index: 0, generation: 0 } };
  items.readStackInto(2, ledger, scratch, stack);
  const sourceSlot = storageSlotOutput();
  storage.readSlotInto(2, sourceSlot);
  const pickup = adoptedMutationOutput();
  const pickupTick = 102;
  if (pickupJob && adopted.ok)
    hauling.pickupAdoptedInto(
      {
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        owner,
        expectedJobSlotVersion: adopted.jobSlotVersion,
        expectedJobCoreVersion: adopted.jobCoreVersion,
        expectedDriverVersion: adopted.driverVersion,
        expectedCurrentLedgerVersion: ledger.version,
        tick: pickupTick,
        itemRemoval: {
          stackId: stack.stackId,
          entityIndex: stack.entityIndex,
          entityGeneration: stack.entityGeneration,
          defId: stack.defId,
          quantity: stack.quantity,
          reservedQuantity: stack.reservedQuantity,
          ownedReservedQuantity: 4,
          availableQuantity: stack.availableQuantity,
          capacity: stack.capacity,
          amount: 4,
          expectedRowVersion: stack.rowVersion,
          expectedStoreVersion: stack.storeVersion,
          expectedReservationVersion: stack.reservationVersion,
        },
        sourceSlot,
        sourceDirty: {
          slotId: sourceSlot.slotId,
          expectedRowVersion: sourceSlot.rowVersion,
          expectedIndexVersion: sourceSlot.indexVersion,
          expectedDirtyBacklog: sourceSlot.dirtyBacklog,
          expectedDirtyQueued: sourceSlot.dirtyQueued,
          expectedDirtyHead: sourceSlot.dirtyHead,
          expectedDirtyCapacity: sourceSlot.dirtyCapacity,
          expectedDirtyQueueIndex: sourceSlot.dirtyQueueIndex,
        },
      },
      items,
      storage,
      ledger,
      core,
      claims,
      pickup,
    );
  if (pickupJob && adopted.ok && !pickup.ok) throw new Error(String(pickup.reason));
  return {
    registry,
    owner,
    source,
    destination,
    core,
    token,
    ledger,
    claims,
    hauling,
    items,
    storage,
    adopted,
    control,
    beforeAdoption,
    beforeCoreAdoption,
    pickup,
    pickupTick,
  };
}

function phaseZeroTerminalInput(
  fixture: ReturnType<typeof createAdoptedPickupFixture>,
): HaulingAdoptedTerminalInput {
  const stack = itemOutput();
  fixture.items.readStackInto(2, fixture.ledger, { entity: { index: 0, generation: 0 } }, stack);
  const slot = storageSlotOutput();
  fixture.storage.readSlotInto(2, slot);
  return {
    jobId: fixture.token.jobId,
    jobGeneration: fixture.token.jobGeneration,
    owner: fixture.owner,
    expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
    expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
    expectedDriverVersion: fixture.adopted.driverVersion,
    expectedCurrentLedgerVersion: fixture.ledger.version,
    tick: fixture.control.adoptionTick + 1,
    outcome: "canceled" as const,
    failureReason: "cancelled" as const,
    targetItem: {
      stackId: stack.stackId,
      entityIndex: stack.entityIndex,
      entityGeneration: stack.entityGeneration,
      defId: stack.defId,
      quantity: stack.quantity,
      capacity: stack.capacity,
      amount: 4,
      expectedRowVersion: stack.rowVersion,
      expectedStoreVersion: stack.storeVersion,
      expectedReservationVersion: stack.reservationVersion,
    },
    targetSlot: slot,
    targetDirty: {
      slotId: slot.slotId,
      expectedRowVersion: slot.rowVersion,
      expectedIndexVersion: slot.indexVersion,
      expectedDirtyBacklog: slot.dirtyBacklog,
      expectedDirtyQueued: slot.dirtyQueued,
      expectedDirtyHead: slot.dirtyHead,
      expectedDirtyCapacity: slot.dirtyCapacity,
      expectedDirtyQueueIndex: slot.dirtyQueueIndex,
    },
  };
}

function pickupInputForFixture(
  fixture: ReturnType<typeof createAdoptedPickupFixture>,
  expectedLedgerVersion = fixture.ledger.version,
  expectedDriverVersion = fixture.adopted.driverVersion,
  expectedJobSlotVersion = fixture.adopted.jobSlotVersion,
  expectedJobCoreVersion = fixture.adopted.jobCoreVersion,
  tick = fixture.control.adoptionTick + 1,
): HaulingAdoptedPickupInput {
  const stack = itemOutput();
  fixture.items.readStackInto(2, fixture.ledger, { entity: { index: 0, generation: 0 } }, stack);
  const sourceSlot = storageSlotOutput();
  fixture.storage.readSlotInto(2, sourceSlot);
  return {
    jobId: fixture.token.jobId,
    jobGeneration: fixture.token.jobGeneration,
    owner: fixture.owner,
    expectedJobSlotVersion,
    expectedJobCoreVersion,
    expectedDriverVersion,
    expectedCurrentLedgerVersion: expectedLedgerVersion,
    tick,
    itemRemoval: {
      stackId: stack.stackId,
      entityIndex: stack.entityIndex,
      entityGeneration: stack.entityGeneration,
      defId: stack.defId,
      quantity: stack.quantity,
      reservedQuantity: stack.reservedQuantity,
      ownedReservedQuantity: 4,
      availableQuantity: stack.availableQuantity,
      capacity: stack.capacity,
      amount: 4,
      expectedRowVersion: stack.rowVersion,
      expectedStoreVersion: stack.storeVersion,
      expectedReservationVersion: stack.reservationVersion,
    },
    sourceSlot,
    sourceDirty: {
      slotId: sourceSlot.slotId,
      expectedRowVersion: sourceSlot.rowVersion,
      expectedIndexVersion: sourceSlot.indexVersion,
      expectedDirtyBacklog: sourceSlot.dirtyBacklog,
      expectedDirtyQueued: sourceSlot.dirtyQueued,
      expectedDirtyHead: sourceSlot.dirtyHead,
      expectedDirtyCapacity: sourceSlot.dirtyCapacity,
      expectedDirtyQueueIndex: sourceSlot.dirtyQueueIndex,
    },
  };
}

function pickedTerminalInput(
  fixture: ReturnType<typeof createAdoptedPickupFixture>,
  outcome: "delivered" | "canceled" | "failed",
): HaulingAdoptedTerminalInput {
  const targetStackId = outcome === "delivered" ? 3 : 2;
  const stack = itemOutput();
  fixture.items.readStackInto(
    targetStackId,
    fixture.ledger,
    { entity: { index: 0, generation: 0 } },
    stack,
  );
  const slot = storageSlotOutput();
  fixture.storage.readSlotInto(targetStackId, slot);
  const failureReason =
    outcome === "delivered"
      ? ("none" as const)
      : outcome === "canceled"
        ? ("cancelled" as const)
        : ("path" as const);
  return {
    jobId: fixture.token.jobId,
    jobGeneration: fixture.token.jobGeneration,
    owner: fixture.owner,
    expectedJobSlotVersion: fixture.pickup.jobSlotVersion,
    expectedJobCoreVersion: fixture.pickup.jobCoreVersion,
    expectedDriverVersion: fixture.pickup.driverVersion,
    expectedCurrentLedgerVersion: fixture.ledger.version,
    tick: fixture.pickupTick + 1,
    outcome,
    failureReason,
    targetItem: {
      stackId: stack.stackId,
      entityIndex: stack.entityIndex,
      entityGeneration: stack.entityGeneration,
      defId: stack.defId,
      quantity: stack.quantity,
      capacity: stack.capacity,
      amount: 4,
      expectedRowVersion: stack.rowVersion,
      expectedStoreVersion: stack.storeVersion,
      expectedReservationVersion: stack.reservationVersion,
    },
    targetSlot: slot,
    targetDirty: {
      slotId: slot.slotId,
      expectedRowVersion: slot.rowVersion,
      expectedIndexVersion: slot.indexVersion,
      expectedDirtyBacklog: slot.dirtyBacklog,
      expectedDirtyQueued: slot.dirtyQueued,
      expectedDirtyHead: slot.dirtyHead,
      expectedDirtyCapacity: slot.dirtyCapacity,
      expectedDirtyQueueIndex: slot.dirtyQueueIndex,
    },
  };
}

function reserveAndAdoptSameHaulingSlot(
  fixture: ReturnType<typeof createAdoptedPickupFixture>,
  createdTick: number,
): {
  readonly token: JobTokenIntoOutput;
  readonly control: ExistingClaimsAdoptionControl;
  readonly adopted: HaulingClaimAdoptionOutput;
} {
  const token = tokenOutput();
  fixture.core.reserveAutonomyJobTokenInto(fixture.core.version, fixture.owner, token);
  const acquired = fixture.ledger.acquire(
    {
      owner: fixture.owner,
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      createdTick,
      leaseExpiryTick: createdTick + 300,
      claims: [
        { channel: "item_quantity", item: fixture.source, amount: 4, availableAmount: 6 },
        {
          channel: "capacity",
          target: fixture.destination,
          capacityId: 3,
          amount: 4,
          capacity: 20,
        },
        { channel: "interaction_spot", target: fixture.source, spotId: 11 },
        { channel: "interaction_spot", target: fixture.destination, spotId: 12 },
      ],
    },
    fixture.registry,
  );
  if (!acquired.ok) throw new Error(acquired.reason);
  const ids = new Uint32Array(8);
  ids.fill(RESERVATION_CLAIM_NONE);
  const epochs = new Uint32Array(8);
  for (let index = 0; index < 4; index += 1) {
    ids[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
    epochs[index] = acquired.version;
  }
  const claims = haulingClaims(
    fixture.owner,
    fixture.source,
    fixture.destination,
    token.jobId,
    token.jobGeneration,
  );
  fixture.ledger.readActiveClaimsInto(
    ids,
    epochs,
    4,
    fixture.owner,
    token.jobId,
    token.jobGeneration,
    acquired.version,
    claims,
  );
  const control = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: fixture.owner.index,
    ownerGeneration: fixture.owner.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: fixture.core.version,
    expectedDriverVersion: fixture.hauling.createMetrics().version,
    claimCount: 4,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: createdTick,
    adoptionTick: createdTick + 25,
    reservationReadVersion: acquired.version,
  };
  const facts = haulingClaimFacts(fixture.source, fixture.destination, acquired.version);
  const adopted = driverOutput();
  fixture.hauling.adoptExistingClaimsInto(
    control,
    {
      jobId: token.jobId,
      owner: fixture.owner,
      sourceSlotId: 2,
      destinationSlotId: 3,
      amount: 4,
      sourceStackId: 2,
      destinationStackId: 3,
      defId: WOOD_DEF,
      createdTick,
      sourceItem: fixture.source,
      destinationStorage: fixture.destination,
      sourceInteractionSpotId: 11,
      destinationInteractionSpotId: 12,
      destinationCapacity: 20,
      readClaimIds: ids,
      readClaimEpochs: epochs,
      claims,
      claimFacts: facts,
      claimFactsBasis: haulingFactsBasis(facts),
    },
    fixture.core,
    adopted,
  );
  return { token, control, adopted };
}

const WOOD_DEF = 1;
const STONE_DEF = 2;

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

function createM2Fixture(): Fixture {
  const registry = createEntityRegistry({ capacity: 32 });
  const pawns = [allocate(registry), allocate(registry)];
  const stackEntities = allocateMany(registry, 6);
  const storageEntities = allocateMany(registry, 6);
  const items = createItemStackStore(8);
  const storage = createStorageLogisticsIndex(8, 8, 4);
  const offers = createWorkOfferIndex({
    capacity: 8,
    workTypeCapacity: 2,
    regionCapacity: 4,
    defCapacity: 4,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });

  createStack(items, registry, 0, stackEntities[0] ?? failMissingEntity(), WOOD_DEF, 8, 8);
  createStack(items, registry, 1, stackEntities[1] ?? failMissingEntity(), WOOD_DEF, 4, 4);
  createStack(items, registry, 2, stackEntities[2] ?? failMissingEntity(), STONE_DEF, 5, 5);
  createStack(items, registry, 3, stackEntities[3] ?? failMissingEntity(), WOOD_DEF, 0, 10);
  createStack(items, registry, 4, stackEntities[4] ?? failMissingEntity(), WOOD_DEF, 0, 4);
  createStack(items, registry, 5, stackEntities[5] ?? failMissingEntity(), STONE_DEF, 0, 5);

  configureSlotWithDef(
    storage,
    registry,
    0,
    storageEntities[0] ?? failMissingEntity(),
    0,
    WOOD_DEF,
    8,
    0,
  );
  configureSlotWithDef(
    storage,
    registry,
    1,
    storageEntities[1] ?? failMissingEntity(),
    1,
    WOOD_DEF,
    4,
    0,
  );
  configureSlotWithDef(
    storage,
    registry,
    2,
    storageEntities[2] ?? failMissingEntity(),
    2,
    STONE_DEF,
    5,
    0,
  );
  configureSlotWithDef(
    storage,
    registry,
    3,
    storageEntities[3] ?? failMissingEntity(),
    3,
    WOOD_DEF,
    10,
    6,
  );
  configureSlotWithDef(
    storage,
    registry,
    4,
    storageEntities[4] ?? failMissingEntity(),
    4,
    WOOD_DEF,
    4,
    4,
  );
  configureSlotWithDef(
    storage,
    registry,
    5,
    storageEntities[5] ?? failMissingEntity(),
    5,
    STONE_DEF,
    5,
    5,
  );

  return {
    registry,
    items,
    storage,
    offers,
    ledger: createReservationLedger({ capacity: 96, entityCapacity: 32, cellCount: 96 }),
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
      createSlotInput(
        slotId,
        storageEntity,
        stackId,
        WOOD_DEF,
        quantity + desiredQuantity,
        desiredQuantity,
      ),
      registry,
    ),
  ).toMatchObject({ ok: true });
}

function configureSlotWithDef(
  storage: ReturnType<typeof createStorageLogisticsIndex>,
  registry: ReturnType<typeof createEntityRegistry>,
  slotId: number,
  storageEntity: EntityId,
  stackId: number,
  defId: number,
  capacity: number,
  desiredQuantity: number,
): void {
  expect(
    storage.configureSlot(
      createSlotInput(slotId, storageEntity, stackId, defId, capacity, desiredQuantity),
      registry,
    ),
  ).toMatchObject({ ok: true });
}

function createSlotInput(
  slotId: number,
  storageEntity: EntityId,
  stackId: number,
  defId: number,
  capacity: number,
  desiredQuantity: number,
): StorageSlotInput {
  return {
    slotId,
    storage: storageEntity,
    stackId,
    defId,
    capacity,
    desiredQuantity,
    interactionCellIndex: slotId + 10,
    offerId: slotId,
    workType: 0,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
  };
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

function createHaulBetweenSlots(
  fixture: Fixture,
  jobId: number,
  pawnIndex: number,
  sourceSlotId: number,
  destinationSlotId: number,
  amount: number,
): ReturnType<Fixture["hauling"]["createJob"]> {
  return fixture.hauling.createJob(
    {
      jobId,
      owner: fixture.pawns[pawnIndex] ?? failMissingPawn(),
      sourceSlotId,
      destinationSlotId,
      amount,
      createdTick: 0,
    },
    fixture.registry,
    fixture.jobCore,
  );
}

function createStack(
  items: ReturnType<typeof createItemStackStore>,
  registry: ReturnType<typeof createEntityRegistry>,
  stackId: number,
  entity: EntityId,
  defId: number,
  quantity: number,
  capacity: number,
): void {
  expect(items.createStack({ stackId, entity, defId, quantity, capacity }, registry)).toMatchObject(
    {
      ok: true,
    },
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

function totalDef(fixture: Fixture, defId: number, stackCount: number): number {
  let total = 0;

  for (let stackId = 0; stackId < stackCount; stackId += 1) {
    const stack = fixture.items.readStack(stackId);
    if (stack?.defId === defId) {
      total += stack.quantity;
    }
  }

  for (let jobId = 0; jobId < fixture.hauling.capacity; jobId += 1) {
    const job = fixture.hauling.readJob(jobId);
    if (job?.carriedDefId === defId) {
      total += job.carriedAmount;
    }
  }

  return total;
}

function allocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.entity;
}

interface SupplySelectionFixture {
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
}

interface StorageOwnerFixture {
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
}

function createStorageOwnerFixture(capacity: number): StorageOwnerFixture {
  const storage = createStorageLogisticsIndex(capacity, capacity, 2);
  const items = createItemStackStore(capacity);
  expect(
    items.createStack({
      stackId: 0,
      entity: { index: 10, generation: 1 },
      defId: WOOD_DEF,
      quantity: 2,
      capacity: 8,
    }),
  ).toMatchObject({ ok: true });
  return {
    storage,
    items,
    ledger: createReservationLedger({
      capacity: capacity * 2,
      entityCapacity: 32,
      cellCount: 32,
    }),
    offers: createWorkOfferIndex({
      capacity,
      workTypeCapacity: 1,
      regionCapacity: 1,
      defCapacity: 2,
      urgencyBucketCount: 1,
      permissionCapacity: 1,
    }),
  };
}

function preparedStorageDirty(): PreparedStorageSlotDirty {
  return {
    ok: false,
    reason: undefined,
    slotId: 0,
    alreadyQueued: false,
    queueIndex: 0,
    rowVersion: 0,
    indexVersion: 0,
    previousDirtyBacklog: 0,
    nextDirtyBacklog: 0,
    previousDirtyHead: 0,
    nextDirtyHead: 0,
    dirtyCapacity: 0,
  };
}

function dirtyPrepareInput(slot: StorageSlotIntoOutput): StorageSlotDirtyPrepareInput {
  return {
    slotId: slot.slotId,
    expectedRowVersion: slot.rowVersion,
    expectedIndexVersion: slot.indexVersion,
    expectedDirtyBacklog: slot.dirtyBacklog,
    expectedDirtyQueued: slot.dirtyQueued,
    expectedDirtyHead: slot.dirtyHead,
    expectedDirtyCapacity: slot.dirtyCapacity,
    expectedDirtyQueueIndex: slot.dirtyQueueIndex,
  };
}

function poisonPreparedStorageDirty(output: PreparedStorageSlotDirty): void {
  output.ok = true;
  output.reason = "storage_snapshot_invalid";
  output.slotId = 99;
  output.alreadyQueued = true;
  output.queueIndex = 99;
  output.rowVersion = 99;
  output.indexVersion = 99;
  output.previousDirtyBacklog = 99;
  output.nextDirtyBacklog = 99;
  output.previousDirtyHead = 99;
  output.nextDirtyHead = 99;
  output.dirtyCapacity = 99;
}

function poisonStorageSlotOutput(output: StorageSlotIntoOutput): void {
  output.ok = true;
  output.reason = "storage_snapshot_invalid";
  output.active = true;
  output.slotId = 99;
  output.storageIndex = 99;
  output.storageGeneration = 99;
  output.stackId = 99;
  output.defId = 99;
  output.capacity = 99;
  output.desiredQuantity = 99;
  output.interactionCellIndex = 99;
  output.offerId = 99;
  output.workType = 99;
  output.regionId = 99;
  output.urgencyBucket = 99;
  output.permissionId = 99;
  output.quantity = 99;
  output.reservedSupply = 99;
  output.reservedCapacity = 99;
  output.availableSupply = 99;
  output.availableCapacity = 99;
  output.demandQuantity = 99;
  output.offerActive = true;
  output.rowVersion = 99;
  output.indexVersion = 99;
  output.dirtyBacklog = 99;
  output.dirtyQueued = true;
  output.dirtyHead = 99;
  output.dirtyCapacity = 99;
  output.dirtyQueueIndex = 99;
}

function withStorageSnapshotVersion(
  snapshot: StorageLogisticsSnapshot,
  version: number,
): StorageLogisticsSnapshot {
  const updated = replaceStorageRow(snapshot, 0, { rowVersion: version });
  return {
    ...updated,
    indexVersion: version,
    refreshedCount: version - 1,
    dirtyHead: (version - 1) % snapshot.capacity,
  };
}

function replaceStorageRow(
  snapshot: StorageLogisticsSnapshot,
  slotId: number,
  patch: Partial<StorageLogisticsSnapshotRow>,
): StorageLogisticsSnapshot {
  const rows: StorageLogisticsSnapshotRow[] = [];
  for (let index = 0; index < snapshot.rows.length; index += 1) {
    const row = snapshot.rows[index];
    if (row === undefined) throw new Error("missing storage row");
    rows.push(index === slotId ? { ...row, ...patch } : row);
  }
  return { ...snapshot, rows };
}

function storageSnapshotHash(snapshot: StorageLogisticsSnapshot): string {
  return formatCanonicalWorldHash({
    fields: createStorageLogisticsHashFields(snapshot),
    randomStreams: [],
    queuedCommands: [],
  });
}

function captureWorkOfferState(offers: ReturnType<typeof createWorkOfferIndex>): unknown {
  const rows: unknown[] = [];
  for (let offerId = 0; offerId < offers.capacity; offerId += 1) {
    rows.push(offers.readOffer(offerId));
  }
  const queryOutput = new Uint32Array(offers.capacity);
  const queryResult = offers.queryCandidates(
    {
      workType: 0,
      regionId: 0,
      defId: WOOD_DEF,
      urgencyBucket: 0,
      permissionId: 0,
      candidateCap: offers.capacity,
    },
    queryOutput,
  );
  return {
    indexVersion: offers.indexVersion,
    metrics: offers.createMetrics(),
    rows,
    queryResult,
    queryOutput: Array.from(queryOutput),
    active: copyWorkOfferNumericLane(offers, "active"),
    workTypes: copyWorkOfferNumericLane(offers, "workTypes"),
    regionIds: copyWorkOfferNumericLane(offers, "regionIds"),
    defIds: copyWorkOfferNumericLane(offers, "defIds"),
    urgencyBuckets: copyWorkOfferNumericLane(offers, "urgencyBuckets"),
    permissionIds: copyWorkOfferNumericLane(offers, "permissionIds"),
    targetIds: copyWorkOfferNumericLane(offers, "targetIds"),
    targetCellIndexes: copyWorkOfferNumericLane(offers, "targetCellIndexes"),
    scoresMilli: copyWorkOfferNumericLane(offers, "scoresMilli"),
    ownerVersions: copyWorkOfferNumericLane(offers, "ownerVersions"),
    rowVersions: copyWorkOfferNumericLane(offers, "rowVersions"),
    bucketHeads: copyWorkOfferNumericLane(offers, "bucketHeads"),
    bucketCounts: copyWorkOfferNumericLane(offers, "bucketCounts"),
    nextOffer: copyWorkOfferNumericLane(offers, "nextOffer"),
    previousOffer: copyWorkOfferNumericLane(offers, "previousOffer"),
  };
}

function setWorkOfferVersionsForStorage(
  offers: ReturnType<typeof createWorkOfferIndex>,
  offerId: number,
  indexVersion: number,
  rowVersion: number,
): void {
  Reflect.set(offers, "indexVersionValue", indexVersion);
  const rowVersions: unknown = Reflect.get(offers, "rowVersions");
  if (!(rowVersions instanceof Uint32Array)) {
    throw new Error("expected WorkOffer rowVersions lane");
  }
  rowVersions[offerId] = rowVersion;
}

function copyWorkOfferNumericLane(
  offers: ReturnType<typeof createWorkOfferIndex>,
  property: string,
): number[] {
  const value: unknown = Reflect.get(offers, property);
  if (
    !(value instanceof Uint8Array) &&
    !(value instanceof Uint32Array) &&
    !(value instanceof Int32Array)
  ) {
    throw new Error(`expected ${property} to be a WorkOffer numeric lane`);
  }
  return Array.from(value);
}

function createGameSessionRuntimeForStorageHash(seed: string): GameSessionRuntime {
  const initialized = initializeGameSessionRuntime({ seed });
  if (!initialized.ok) throw new Error(initialized.reason);
  return initialized.runtime;
}

function gameSessionOwnerHashFields(runtime: GameSessionRuntime): CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [];
  appendGameSessionOwnerHashFields(fields, runtime, "audit");
  return fields;
}

function hashFieldNames(fields: readonly CanonicalWorldField[]): string[] {
  const names: string[] = [];
  for (const field of fields) names.push(field.name);
  return names;
}

function hashFieldValue(
  fields: readonly CanonicalWorldField[],
  name: string,
): number | string | boolean {
  for (const field of fields) if (field.name === name) return field.value;
  throw new Error(`missing hash field ${name}`);
}

interface SupplySelectionIdentities {
  readonly slotIds: Uint32Array;
  readonly stackIds: Uint32Array;
  readonly rowVersions: Uint32Array;
  readonly availableSupplies: Uint32Array;
  readonly linkedFlags: Uint8Array;
}

function createSupplySelectionFixture(
  candidateCount: number,
  refresh: boolean,
): SupplySelectionFixture {
  const capacity = Math.max(candidateCount, 1);
  const registry = createEntityRegistry({ capacity: capacity * 2 + 1 });
  const entities = allocateMany(registry, candidateCount * 2);
  const items = createItemStackStore(capacity);
  const storage = createStorageLogisticsIndex(capacity, capacity, 4);
  const ledger = createReservationLedger({
    capacity: capacity * 2,
    entityCapacity: capacity * 2 + 1,
    cellCount: capacity + 16,
  });
  const offers = createWorkOfferIndex({
    capacity,
    workTypeCapacity: 1,
    regionCapacity: 1,
    defCapacity: 4,
    urgencyBucketCount: 1,
    permissionCapacity: 1,
  });
  for (let slotId = 0; slotId < candidateCount; slotId += 1) {
    const stackEntity = entities[slotId];
    const storageEntity = entities[candidateCount + slotId];
    if (stackEntity === undefined || storageEntity === undefined) throw new Error("missing entity");
    expect(
      items.createStack({
        stackId: slotId,
        entity: stackEntity,
        defId: WOOD_DEF,
        quantity: slotId + 1,
        capacity: 64,
      }),
    ).toMatchObject({ ok: true });
    expect(
      storage.configureSlot(
        createSlotInput(slotId, storageEntity, slotId, WOOD_DEF, 64, 0),
        registry,
      ),
    ).toMatchObject({ ok: true });
  }
  if (refresh) storage.refreshDirty(items, ledger, offers, candidateCount);
  return { storage };
}

function supplySelectionScratch(): StorageSupplySelectionScratch {
  return {
    slotIds: new Uint32Array(STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES),
    stackIds: new Uint32Array(STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES),
    rowVersions: new Uint32Array(STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES),
    availableSupplies: new Uint32Array(STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES),
    linkedFlags: new Uint8Array(STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES),
  };
}

function supplySelectionOutput(): StorageSupplySelectionIntoOutput {
  return {
    ok: true,
    reason: "storage_snapshot_invalid",
    queryDefId: 99,
    candidateCap: 99,
    visitedCount: 99,
    selectedCount: 99,
    candidateCapHit: true,
    indexVersion: 99,
    dirtyBacklog: 99,
  };
}

function poisonSupplySelection(scratch: StorageSupplySelectionScratch): void {
  scratch.slotIds.fill(99);
  scratch.stackIds.fill(99);
  scratch.rowVersions.fill(99);
  scratch.availableSupplies.fill(99);
  scratch.linkedFlags.fill(1);
}

function expectSupplySelectionCleared(scratch: StorageSupplySelectionScratch): void {
  expect(Array.from(scratch.slotIds)).toStrictEqual(repeatedValues(scratch.slotIds.length, 0));
  expect(Array.from(scratch.stackIds)).toStrictEqual(repeatedValues(scratch.stackIds.length, 0));
  expect(Array.from(scratch.rowVersions)).toStrictEqual(
    repeatedValues(scratch.rowVersions.length, 0),
  );
  expect(Array.from(scratch.availableSupplies)).toStrictEqual(
    repeatedValues(scratch.availableSupplies.length, 0),
  );
  expect(Array.from(scratch.linkedFlags)).toStrictEqual(
    repeatedValues(scratch.linkedFlags.length, 0),
  );
}

function captureSupplySelectionIdentities(
  scratch: StorageSupplySelectionScratch,
): SupplySelectionIdentities {
  return {
    slotIds: scratch.slotIds,
    stackIds: scratch.stackIds,
    rowVersions: scratch.rowVersions,
    availableSupplies: scratch.availableSupplies,
    linkedFlags: scratch.linkedFlags,
  };
}

function expectSupplySelectionIdentities(
  scratch: StorageSupplySelectionScratch,
  identities: SupplySelectionIdentities,
): void {
  expect(scratch.slotIds).toBe(identities.slotIds);
  expect(scratch.stackIds).toBe(identities.stackIds);
  expect(scratch.rowVersions).toBe(identities.rowVersions);
  expect(scratch.availableSupplies).toBe(identities.availableSupplies);
  expect(scratch.linkedFlags).toBe(identities.linkedFlags);
}

function rangeValues(count: number, start: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) values.push(start + index);
  return values;
}

function repeatedValues(count: number, value: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) values.push(value);
  return values;
}

function mapTestValues<T>(values: readonly T[], transform: (value: T, index: number) => T): T[] {
  const transformed: T[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined) throw new Error("missing test value");
    transformed.push(transform(value, index));
  }
  return transformed;
}

function allocateMany(
  registry: ReturnType<typeof createEntityRegistry>,
  count: number,
): readonly EntityId[] {
  const entities: EntityId[] = [];

  for (let index = 0; index < count; index += 1) {
    entities.push(allocate(registry));
  }

  return entities;
}

function failMissingPawn(): never {
  throw new Error("missing pawn");
}

function failMissingEntity(): never {
  throw new Error("missing entity");
}
