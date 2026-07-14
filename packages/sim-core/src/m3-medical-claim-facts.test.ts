import { describe, expect, it, vi } from "vitest";

import {
  M3_MEDICAL_CLAIM_FACTS_SNAPSHOT_VERSION,
  M3_MEDICAL_TREATMENT_POLICY_KIND,
  M3_MEDICAL_TREATMENT_POLICY_VERSION,
  STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES,
  createEntityRegistry,
  createItemStackStore,
  createM3MedicalClaimFactsHashFields,
  createM3MedicalClaimFactsIndex,
  createReservationLedger,
  createStorageLogisticsIndex,
  createWorkOfferIndex,
  type EntityId,
  type ItemStackIntoOutput,
  type CanonicalWorldField,
  type M3MedicalClaimFactsIndexOptions,
  type M3MedicalClaimFactsSnapshot,
  type M3MedicalPatientInteractionIntoOutput,
  type M3MedicalPatientInteractionInput,
  type M3MedicalStockSelectionIntoOutput,
  type M3MedicalStockSelectionScratch,
  type M3MedicalTreatmentPolicyIntoOutput,
  type StorageSlotIntoOutput,
  type StorageSupplySelectionIntoOutput,
} from "./index";

describe("M3 medical interaction and treatment policy facts", () => {
  it("defensively copies two immutable policies and publishes exact O(1) reads", () => {
    const registry = createEntityRegistry({ capacity: 8 });
    const first = { treatmentDefId: 1, treatmentTicks: 3, workPerTickQ16: 40, severityDelta: 5 };
    const second = { treatmentDefId: 3, treatmentTicks: 7, workPerTickQ16: 9, severityDelta: 2 };
    const policies = [first, second];
    const facts = createM3MedicalClaimFactsIndex({
      capacity: 4,
      registry,
      treatmentPolicyCapacity: 5,
      treatmentPolicies: policies,
    });
    first.treatmentTicks = 99;
    second.severityDelta = 99;
    policies[0] = { treatmentDefId: 0, treatmentTicks: 1, workPerTickQ16: 1, severityDelta: 1 };
    const output = policyOutput();
    const identity = output;
    facts.readTreatmentPolicyInto(1, output);
    expect(output).toBe(identity);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      treatmentDefId: 1,
      policyKind: M3_MEDICAL_TREATMENT_POLICY_KIND,
      policyVersion: M3_MEDICAL_TREATMENT_POLICY_VERSION,
      treatmentTicks: 3,
      workPerTickQ16: 40,
      severityDelta: 5,
      requiredWorkQ16: 120,
    });
    facts.readTreatmentPolicyInto(3, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      treatmentDefId: 3,
      policyKind: M3_MEDICAL_TREATMENT_POLICY_KIND,
      policyVersion: M3_MEDICAL_TREATMENT_POLICY_VERSION,
      treatmentTicks: 7,
      workPerTickQ16: 9,
      severityDelta: 2,
      requiredWorkQ16: 63,
    });
  });

  it("rejects invalid, duplicate, and overflowing policy manifests before construction", () => {
    const registry = createEntityRegistry({ capacity: 4 });
    const valid = { treatmentDefId: 0, treatmentTicks: 1, workPerTickQ16: 1, severityDelta: 1 };
    const sparsePolicies: M3MedicalClaimFactsIndexOptions["treatmentPolicies"] = new Array(1);
    const invalidPolicies = [
      [{ ...valid, treatmentDefId: -1 }],
      [{ ...valid, treatmentDefId: 2 }],
      [valid, { ...valid }],
      [{ ...valid, treatmentTicks: 0 }],
      [{ ...valid, treatmentTicks: -1 }],
      [{ ...valid, treatmentTicks: 0.5 }],
      [{ ...valid, workPerTickQ16: 0 }],
      [{ ...valid, workPerTickQ16: -1 }],
      [{ ...valid, workPerTickQ16: 0.5 }],
      [{ ...valid, severityDelta: 0 }],
      [{ ...valid, severityDelta: 1001 }],
      [{ ...valid, treatmentTicks: 0xffff_ffff, workPerTickQ16: 2 }],
      sparsePolicies,
    ];
    for (const treatmentPolicies of invalidPolicies) {
      expect(() =>
        createM3MedicalClaimFactsIndex({
          capacity: 2,
          registry,
          treatmentPolicyCapacity: 2,
          treatmentPolicies,
        }),
      ).toThrow(RangeError);
    }
  });

  it("fully resets poisoned policy output for missing and out-of-range definitions", () => {
    const facts = createFacts(createEntityRegistry({ capacity: 4 }));
    const output = policyOutput();
    const identity = output;
    facts.readTreatmentPolicyInto(2, output);
    expect(output).toBe(identity);
    expect(output).toStrictEqual({
      ok: false,
      reason: "medical_claim_treatment_policy_not_registered",
      treatmentDefId: 2,
      policyKind: 0,
      policyVersion: 0,
      treatmentTicks: 0,
      workPerTickQ16: 0,
      severityDelta: 0,
      requiredWorkQ16: 0,
    });
    poisonPolicyOutput(output);
    facts.readTreatmentPolicyInto(4, output);
    expect(output).toStrictEqual({
      ok: false,
      reason: "medical_claim_treatment_def_out_of_range",
      treatmentDefId: 4,
      policyKind: 0,
      policyVersion: 0,
      treatmentTicks: 0,
      workPerTickQ16: 0,
      severityDelta: 0,
      requiredWorkQ16: 0,
    });
  });

  it("registers one exact interaction and rejects every invalid path without writes", () => {
    const registry = createEntityRegistry({ capacity: 8 });
    const target = allocate(registry);
    const other = allocate(registry);
    const facts = createFacts(registry);
    const input = interactionInput(1, target);
    const missing = interactionOutput();
    const missingIdentity = missing;
    facts.readPatientInteractionInto(0, missing);
    expect(missing).toBe(missingIdentity);
    expect(missing).toStrictEqual(
      failedInteractionOutput(0, "medical_claim_interaction_not_registered", 0, 0),
    );
    expect(facts.registerPatientInteraction(input)).toBeUndefined();
    expect(facts.version).toBe(1);
    expect(facts.indexVersion).toBe(1);
    expect(facts.activeCount).toBe(1);
    const output = interactionOutput();
    facts.readPatientInteractionInto(1, output);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      active: true,
      requestId: 1,
      targetIndex: target.index,
      targetGeneration: target.generation,
      interactionSpotId: 7,
      targetCellIndex: 11,
      sourceVersion: 0,
      rowVersion: 1,
      indexVersion: 1,
      activeCount: 1,
    });
    const before = facts.createSnapshot();
    const cases = [
      {
        input: {
          ...input,
          target: { index: -1, generation: 0 },
          interactionSpotId: -1,
        },
        reason: "medical_claim_interaction_already_registered",
      },
      {
        input: {
          ...interactionInput(-1, target),
          target: { index: -1, generation: 0 },
          interactionSpotId: -1,
        },
        reason: "medical_claim_request_out_of_range",
      },
      {
        input: { ...interactionInput(2, target), target: { index: -1, generation: 1 } },
        reason: "medical_claim_target_invalid",
      },
      {
        input: { ...interactionInput(2, target), interactionSpotId: -1 },
        reason: "medical_claim_value_invalid",
      },
      {
        input: { ...interactionInput(2, target), targetCellIndex: 0.5 },
        reason: "medical_claim_value_invalid",
      },
      {
        input: { ...interactionInput(2, target), sourceVersion: -1 },
        reason: "medical_claim_value_invalid",
      },
      {
        input: {
          ...interactionInput(2, { index: 7, generation: 1 }),
          interactionSpotId: -1,
        },
        reason: "medical_claim_value_invalid",
      },
      {
        input: {
          ...interactionInput(2, other),
          target: { index: other.index, generation: other.generation + 1 },
        },
        reason: "medical_claim_target_generation_mismatch",
      },
    ] as const;
    for (const testCase of cases) {
      expect(facts.registerPatientInteraction(testCase.input)).toBe(testCase.reason);
      expect(facts.createSnapshot()).toStrictEqual(before);
    }
    expect(registry.destroy(other)).toMatchObject({ ok: true });
    expect(facts.registerPatientInteraction(interactionInput(2, other))).toBe(
      "medical_claim_target_not_alive",
    );
    expect(facts.createSnapshot()).toStrictEqual(before);
  });

  it("revalidates target liveness and generation on every read without leaking row fields", () => {
    const registry = createEntityRegistry({ capacity: 2 });
    const target = allocate(registry);
    const facts = createFacts(registry);
    expect(facts.registerPatientInteraction(interactionInput(0, target))).toBeUndefined();
    expect(registry.destroy(target)).toMatchObject({ ok: true });
    const output = interactionOutput();
    const identity = output;
    facts.readPatientInteractionInto(0, output);
    expect(output).toBe(identity);
    expect(output).toStrictEqual(
      failedInteractionOutput(0, "medical_claim_target_not_alive", 1, 1),
    );
    const recycled = allocate(registry);
    expect(recycled.index).toBe(target.index);
    poisonInteractionOutput(output);
    facts.readPatientInteractionInto(0, output);
    expect(output).toStrictEqual(
      failedInteractionOutput(0, "medical_claim_target_generation_mismatch", 1, 1),
    );
    expect(facts.createSnapshot().rows[0]).toMatchObject({
      active: 1,
      targetIndex: target.index,
      targetGeneration: target.generation,
    });
    poisonInteractionOutput(output);
    facts.readPatientInteractionInto(4, output);
    expect(output).toStrictEqual(
      failedInteractionOutput(4, "medical_claim_request_out_of_range", 1, 1),
    );
  });

  it("round trips interactions and atomically rejects malformed snapshots", () => {
    const registry = createEntityRegistry({ capacity: 8 });
    const target = allocate(registry);
    const facts = createFacts(registry);
    expect(facts.registerPatientInteraction(interactionInput(2, target))).toBeUndefined();
    const snapshot = facts.createSnapshot();
    const restored = createFacts(registry);
    expect(restored.restoreFromSnapshot(snapshot)).toStrictEqual({ ok: true, version: 1 });
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    const before = restored.createSnapshot();
    expect(restored.restoreFromSnapshot({ ...snapshot, snapshotVersion: 2 })).toStrictEqual({
      ok: false,
      reason: "medical_claim_snapshot_version_unsupported",
    });
    expect(restored.createSnapshot()).toStrictEqual(before);
    const malformed = createMalformedSnapshots(snapshot);
    for (const malformedSnapshot of malformed) {
      expect(restored.restoreFromSnapshot(malformedSnapshot)).toMatchObject({ ok: false });
      expect(restored.createSnapshot()).toStrictEqual(before);
    }
  });

  it("reports exact dead and recycled registry restore failures atomically", () => {
    const sourceRegistry = createEntityRegistry({ capacity: 4 });
    const target = allocate(sourceRegistry);
    const source = createFacts(sourceRegistry);
    expect(source.registerPatientInteraction(interactionInput(0, target))).toBeUndefined();
    const snapshot = source.createSnapshot();

    const deadRegistry = createEntityRegistry({ capacity: 4 });
    const deadDestination = createFacts(deadRegistry);
    const deadBefore = deadDestination.createSnapshot();
    expect(deadDestination.restoreFromSnapshot(snapshot)).toStrictEqual({
      ok: false,
      reason: "medical_claim_snapshot_target_not_alive",
    });
    expect(deadDestination.createSnapshot()).toStrictEqual(deadBefore);

    const recycledRegistry = createEntityRegistry({ capacity: 4 });
    const prior = allocate(recycledRegistry);
    expect(prior.index).toBe(target.index);
    expect(recycledRegistry.destroy(prior)).toMatchObject({ ok: true });
    const recycled = allocate(recycledRegistry);
    expect(recycled.index).toBe(target.index);
    const recycledDestination = createFacts(recycledRegistry);
    const recycledBefore = recycledDestination.createSnapshot();
    expect(recycledDestination.restoreFromSnapshot(snapshot)).toStrictEqual({
      ok: false,
      reason: "medical_claim_snapshot_target_generation_mismatch",
    });
    expect(recycledDestination.createSnapshot()).toStrictEqual(recycledBefore);
  });

  it("excludes immutable treatment policy from interaction snapshots and hashes", () => {
    const registry = createEntityRegistry({ capacity: 4 });
    const target = allocate(registry);
    const first = createFacts(registry, [
      { treatmentDefId: 1, treatmentTicks: 2, workPerTickQ16: 3, severityDelta: 4 },
    ]);
    const second = createFacts(registry, [
      { treatmentDefId: 1, treatmentTicks: 9, workPerTickQ16: 8, severityDelta: 7 },
    ]);
    expect(first.registerPatientInteraction(interactionInput(1, target))).toBeUndefined();
    expect(second.registerPatientInteraction(interactionInput(1, target))).toBeUndefined();
    expect(first.createSnapshot()).toStrictEqual(second.createSnapshot());
    expect(createM3MedicalClaimFactsHashFields(first.createSnapshot())).toStrictEqual(
      createM3MedicalClaimFactsHashFields(second.createSnapshot()),
    );
    const firstPolicy = policyOutput();
    const secondPolicy = policyOutput();
    first.readTreatmentPolicyInto(1, firstPolicy);
    second.readTreatmentPolicyInto(1, secondPolicy);
    expect(firstPolicy).not.toStrictEqual(secondPolicy);
  });

  it("emits exact top-level and ascending eight-field row hash order with prefix", () => {
    const registry = createEntityRegistry({ capacity: 4 });
    const target = allocate(registry);
    const facts = createFacts(registry);
    expect(facts.registerPatientInteraction(interactionInput(1, target))).toBeUndefined();
    expect(createM3MedicalClaimFactsHashFields(facts.createSnapshot(), "medical")).toStrictEqual([
      { name: "medical.snapshotVersion", value: M3_MEDICAL_CLAIM_FACTS_SNAPSHOT_VERSION },
      { name: "medical.capacity", value: 4 },
      { name: "medical.indexVersion", value: 1 },
      { name: "medical.activeCount", value: 1 },
      ...expectedRowHash("medical", 0, 0, 0, 0, 0, 0, 0, 0),
      ...expectedRowHash("medical", 1, 1, target.index, target.generation, 7, 11, 0, 1),
      ...expectedRowHash("medical", 2, 0, 0, 0, 0, 0, 0, 0),
      ...expectedRowHash("medical", 3, 0, 0, 0, 0, 0, 0, 0),
    ]);
  });

  it("selects one bounded stock winner without mutating any authority", () => {
    const fixture = createStockFixture([
      { slotId: 3, stackId: 4, regionId: 1, quantity: 8 },
      { slotId: 1, stackId: 2, regionId: 1, quantity: 9 },
    ]);
    const scratch = stockScratch();
    const output = stockOutput();
    const identities = [scratch.supply, scratch.supply.slotIds, scratch.slot, scratch.item, output];
    const medicalBefore = fixture.facts.createSnapshot();
    const medicalHashBefore = createM3MedicalClaimFactsHashFields(medicalBefore);
    const itemBefore = fixture.items.createSnapshot();
    const storageBefore = fixture.storage.createSnapshot();
    const ledgerBefore = fixture.ledger.createSnapshot();
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 5, candidateCap: 24 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect([
      scratch.supply,
      scratch.supply.slotIds,
      scratch.slot,
      scratch.item,
      output,
    ]).toStrictEqual(identities);
    expect(output).toStrictEqual({
      ok: true,
      reason: undefined,
      queryStockDefId: 1,
      queryRegionId: 1,
      requiredAmount: 5,
      candidateCap: 24,
      visitedCount: 2,
      eligibleCount: 2,
      candidateCapHit: false,
      storageSlotId: 1,
      stockStackId: 2,
      itemEntityIndex: fixture.entities[1]?.index,
      itemEntityGeneration: fixture.entities[1]?.generation,
      defId: 1,
      quantity: 9,
      availableQuantity: 9,
      stockOwnerVersion: storageBefore.indexVersion,
      stockRowVersion: 2,
      stockIndexVersion: storageBefore.indexVersion,
      stockDirtyBacklog: 0,
      itemRowVersion: 1,
      itemStoreVersion: fixture.items.version,
      reservationVersion: fixture.ledger.version,
    });
    expect(fixture.facts.createSnapshot()).toStrictEqual(medicalBefore);
    expect(createM3MedicalClaimFactsHashFields(fixture.facts.createSnapshot())).toStrictEqual(
      medicalHashBefore,
    );
    expect(fixture.items.createSnapshot()).toStrictEqual(itemBefore);
    expect(fixture.storage.createSnapshot()).toStrictEqual(storageBefore);
    expect(fixture.ledger.createSnapshot()).toStrictEqual(ledgerBefore);
  });

  it("validates stock input order and fully resets poisoned caller storage", () => {
    const fixture = createStockFixture([]);
    const cases = [
      {
        input: { stockDefId: -1, regionId: -1, requiredAmount: 0, candidateCap: 0 },
        reason: "medical_claim_stock_candidate_cap_invalid",
      },
      {
        input: { stockDefId: -1, regionId: -1, requiredAmount: 0, candidateCap: 25 },
        reason: "medical_claim_stock_candidate_cap_invalid",
      },
      {
        input: { stockDefId: -1, regionId: 0, requiredAmount: 1, candidateCap: 1 },
        reason: "medical_claim_stock_def_out_of_range",
      },
      {
        input: { stockDefId: 1, regionId: -1, requiredAmount: 1, candidateCap: 1 },
        reason: "medical_claim_stock_region_invalid",
      },
      {
        input: { stockDefId: 1, regionId: 0, requiredAmount: 0, candidateCap: 1 },
        reason: "medical_claim_stock_amount_invalid",
      },
      {
        input: { stockDefId: 1, regionId: 0, requiredAmount: 1, candidateCap: 1.5 },
        reason: "medical_claim_stock_candidate_cap_invalid",
      },
      {
        input: { stockDefId: 1.5, regionId: 0, requiredAmount: 1, candidateCap: 1 },
        reason: "medical_claim_stock_def_out_of_range",
      },
      {
        input: { stockDefId: 1, regionId: 0.5, requiredAmount: 1, candidateCap: 1 },
        reason: "medical_claim_stock_region_invalid",
      },
      {
        input: { stockDefId: 1, regionId: 0, requiredAmount: 1.5, candidateCap: 1 },
        reason: "medical_claim_stock_amount_invalid",
      },
      {
        input: { stockDefId: 1, regionId: 0x1_0000_0000, requiredAmount: 1, candidateCap: 1 },
        reason: "medical_claim_stock_region_invalid",
      },
      {
        input: { stockDefId: 0x1_0000_0000, regionId: 0, requiredAmount: 1, candidateCap: 1 },
        reason: "medical_claim_stock_def_out_of_range",
      },
      {
        input: { stockDefId: 1, regionId: 0, requiredAmount: 0x1_0000_0000, candidateCap: 1 },
        reason: "medical_claim_stock_amount_invalid",
      },
    ] as const;
    const scratch = stockScratch();
    const output = stockOutput();
    for (const testCase of cases) {
      poisonStockScratch(scratch, output);
      fixture.facts.selectStockInto(
        testCase.input,
        fixture.storage,
        fixture.items,
        fixture.ledger,
        scratch,
        output,
      );
      expect(output.reason).toBe(testCase.reason);
      expect(output.ok).toBe(false);
      expect(output).toMatchObject({
        queryStockDefId: testCase.input.stockDefId,
        queryRegionId: testCase.input.regionId,
        requiredAmount: testCase.input.requiredAmount,
        candidateCap: testCase.input.candidateCap,
      });
      expectStockSelectionCleared(scratch, output);
      expectSupplyLanesCleared(scratch);
      expectStockAuthorityReset(output);
    }
    const short = stockScratch(23);
    poisonStockScratch(short, output);
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 0, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      short,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_scratch_invalid");
    for (const lane of [
      "slotIds",
      "stackIds",
      "rowVersions",
      "availableSupplies",
      "linkedFlags",
    ] as const) {
      const laneScratch = stockScratch(24, lane);
      fixture.facts.selectStockInto(
        { stockDefId: 1, regionId: 0, requiredAmount: 1, candidateCap: 1 },
        fixture.storage,
        fixture.items,
        fixture.ledger,
        laneScratch,
        output,
      );
      expect(output.reason).toBe("medical_claim_stock_scratch_invalid");
    }
    const oversized = stockScratch(25);
    const oversizedIdentity = oversized.supply.slotIds;
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 0, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      oversized,
      output,
    );
    expect(oversized.supply.slotIds).toBe(oversizedIdentity);
  });

  it("bounds selection to the stable 24-slot prefix and reports cap hits exactly", () => {
    const rows: StockFixtureRow[] = [];
    for (let index = 0; index < 25; index += 1)
      rows.push({ slotId: index, stackId: index, regionId: index === 0 ? 1 : 0, quantity: 8 });
    const fixture = createStockFixture(rows);
    const scratch = stockScratch();
    const output = stockOutput();
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 0, requiredAmount: 5, candidateCap: 24 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      visitedCount: 24,
      eligibleCount: 23,
      candidateCapHit: true,
      stockStackId: 1,
    });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 3, requiredAmount: 5, candidateCap: 24 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      reason: "medical_claim_stock_candidate_cap_reached",
      visitedCount: 24,
      candidateCapHit: true,
    });
    expect(scratch.supply.slotIds[23]).toBe(23);
    const exactRows: StockFixtureRow[] = [];
    for (let index = 0; index < 24; index += 1)
      exactRows.push({ slotId: index, stackId: index, regionId: 0, quantity: 8 });
    const exact = createStockFixture(exactRows);
    exact.facts.selectStockInto(
      { stockDefId: 1, regionId: 0, requiredAmount: 5, candidateCap: 24 },
      exact.storage,
      exact.items,
      exact.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({ ok: true, visitedCount: 24, candidateCapHit: false });
  });

  it("maps only a positive real dirty backlog to the public dirty reason", () => {
    const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
    const scratch = stockScratch();
    const output = stockOutput();
    const original = fixture.storage.selectSupplySlotsInto.bind(fixture.storage);
    const spy = vi
      .spyOn(fixture.storage, "selectSupplySlotsInto")
      .mockImplementation((defId, cap, supply, supplyOutput): void => {
        original(defId, cap, supply, supplyOutput);
        supplyOutput.ok = false;
        supplyOutput.reason = "storage_dirty_basis_mismatch";
        supplyOutput.dirtyBacklog = 0;
        supplyOutput.visitedCount = 0;
        supplyOutput.selectedCount = 0;
        supplyOutput.candidateCapHit = false;
        supply.slotIds.fill(0);
        supply.stackIds.fill(0);
        supply.rowVersions.fill(0);
        supply.availableSupplies.fill(0);
        supply.linkedFlags.fill(0);
      });
    poisonStockScratch(scratch, output);
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      reason: "medical_claim_stock_basis_stale",
      queryStockDefId: 1,
      queryRegionId: 1,
      stockOwnerVersion: fixture.storage.createSnapshot().indexVersion,
      stockIndexVersion: fixture.storage.createSnapshot().indexVersion,
      stockDirtyBacklog: 0,
    });
    expectStockSelectionCleared(scratch, output);
    spy.mockRestore();
    expect(fixture.storage.markSlotDirty(0)).toMatchObject({ ok: true });
    poisonStockScratch(scratch, output);
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_dirty_basis_mismatch");
    expect(output.stockOwnerVersion).toBe(fixture.storage.createSnapshot().indexVersion);
    expect(output.stockIndexVersion).toBe(fixture.storage.createSnapshot().indexVersion);
    expect(output.stockDirtyBacklog).toBe(1);
    expectStockSelectionCleared(scratch, output);
  });

  it.each([
    ["negative visited", "visitedCount", -1],
    ["fractional visited", "visitedCount", 0.5],
    ["negative selected", "selectedCount", -1],
    ["fractional selected", "selectedCount", 0.5],
    ["selected mismatch", "selectedCount", 0],
    ["count above cap", "visitedCount", 2],
    ["hit short prefix", "candidateCapHit", true],
    ["invalid index", "indexVersion", -1],
    ["fractional index", "indexVersion", 0.5],
    ["invalid backlog", "dirtyBacklog", -1],
    ["fractional backlog", "dirtyBacklog", 0.5],
    ["query mismatch", "queryDefId", 2],
    ["cap mismatch", "candidateCap", 2],
    ["nonboolean ok", "ok", 1],
    ["nonboolean hit", "candidateCapHit", 1],
    ["success reason residue", "reason", "storage_dirty_basis_mismatch"],
    ["false with success residue", "ok", false],
    ["false with known reason residue", "falseKnownResidue", 0],
    ["false with unknown reason", "falseUnknownReason", 0],
    ["false with undefined reason", "falseEmptyReason", 0],
  ] as const)("rejects adversarial supply header: %s", (_label, field, value) => {
    const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
    const scratch = stockScratch();
    const output = stockOutput();
    const original = fixture.storage.selectSupplySlotsInto.bind(fixture.storage);
    const spy = vi
      .spyOn(fixture.storage, "selectSupplySlotsInto")
      .mockImplementation((defId, cap, supply, supplyOutput): void => {
        original(defId, cap, supply, supplyOutput);
        mutateSupplyHeader(field, value, supplyOutput);
      });
    poisonStockScratch(scratch, output);
    fixture.facts.selectStockInto(
      {
        stockDefId: 1,
        regionId: 1,
        requiredAmount: 1,
        candidateCap: field === "candidateCapHit" ? 2 : 1,
      },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_basis_stale");
    expect(output).toMatchObject({
      queryStockDefId: 1,
      queryRegionId: 1,
      requiredAmount: 1,
      candidateCap: field === "candidateCapHit" ? 2 : 1,
    });
    expectStockSelectionCleared(scratch, output);
    expectStockAuthorityReset(output);
    spy.mockRestore();
  });

  it("distinguishes unavailable from bounded candidate-cap exhaustion without aggregating stacks", () => {
    const insufficient = createStockFixture([
      { slotId: 0, stackId: 0, regionId: 2, quantity: 3 },
      { slotId: 1, stackId: 1, regionId: 2, quantity: 4 },
    ]);
    const scratch = stockScratch();
    const output = stockOutput();
    insufficient.facts.selectStockInto(
      { stockDefId: 1, regionId: 2, requiredAmount: 5, candidateCap: 24 },
      insufficient.storage,
      insufficient.items,
      insufficient.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_unavailable");
    expect(output.eligibleCount).toBe(0);

    const capped = createStockFixture([
      { slotId: 0, stackId: 0, regionId: 0, quantity: 2 },
      { slotId: 1, stackId: 1, regionId: 2, quantity: 8 },
    ]);
    capped.facts.selectStockInto(
      { stockDefId: 1, regionId: 2, requiredAmount: 5, candidateCap: 1 },
      capped.storage,
      capped.items,
      capped.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_candidate_cap_reached");
    expect(output.candidateCapHit).toBe(true);
    capped.facts.selectStockInto(
      { stockDefId: 1, regionId: 2, requiredAmount: 5, candidateCap: 2 },
      capped.storage,
      capped.items,
      capped.ledger,
      scratch,
      output,
    );
    expect(output.ok).toBe(true);
    expect(output.stockStackId).toBe(1);
  });

  it("prefers the lower stockStackId before the storageSlotId tie-break", () => {
    const fixture = createStockFixture([
      { slotId: 3, stackId: 0, regionId: 1, quantity: 8 },
      { slotId: 1, stackId: 1, regionId: 1, quantity: 8 },
    ]);
    const output = stockOutput();
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 2 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      stockScratch(),
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      visitedCount: 2,
      eligibleCount: 2,
      stockStackId: 0,
      storageSlotId: 3,
    });
  });

  it("prefers stockStackId before the later entity and slot tuple fields", () => {
    const fixture = createStockFixture([
      { slotId: 1, stackId: 1, regionId: 1, quantity: 8 },
      { slotId: 3, stackId: 0, regionId: 1, quantity: 8 },
    ]);
    const stackOneEntity = fixture.entities[0];
    const stackZeroEntity = fixture.entities[1];
    if (stackOneEntity === undefined || stackZeroEntity === undefined) {
      throw new Error("missing stock fixture entity");
    }
    expect(stackOneEntity.index).toBeLessThan(stackZeroEntity.index);
    const output = stockOutput();
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 2 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      stockScratch(),
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      visitedCount: 2,
      eligibleCount: 2,
      stockStackId: 0,
      itemEntityIndex: stackZeroEntity.index,
      itemEntityGeneration: stackZeroEntity.generation,
      storageSlotId: 3,
    });
  });

  it("fails closed for dirty storage and destroyed or recycled item entities", () => {
    const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
    const scratch = stockScratch();
    const output = stockOutput();
    expect(fixture.storage.markSlotDirty(0)).toMatchObject({ ok: true });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_dirty_basis_mismatch");
    fixture.storage.refreshDirty(fixture.items, fixture.ledger, fixture.offers, 1);
    const entity = fixture.entities[0];
    if (entity === undefined) throw new Error("missing fixture entity");
    expect(fixture.registry.destroy(entity)).toMatchObject({ ok: true });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_item_not_alive");
    expect(allocate(fixture.registry).index).toBe(entity.index);
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_item_generation_mismatch");
    expect(output.storageSlotId).toBe(0);
  });

  it("clears a partial winner when a later candidate or final region read is stale", () => {
    const fixture = createStockFixture([
      { slotId: 0, stackId: 0, regionId: 1, quantity: 8 },
      { slotId: 1, stackId: 1, regionId: 1, quantity: 8 },
    ]);
    const scratch = stockScratch();
    const output = stockOutput();
    const originalRead = fixture.storage.readSlotInto.bind(fixture.storage);
    let readCount = 0;
    const spy = vi
      .spyOn(fixture.storage, "readSlotInto")
      .mockImplementation((slotId, into): void => {
        originalRead(slotId, into);
        readCount += 1;
        if (readCount === 2) into.rowVersion += 1;
      });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 2 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      reason: "medical_claim_stock_basis_stale",
      storageSlotId: 0,
      stockStackId: 0,
      eligibleCount: 0,
    });
    spy.mockRestore();
    readCount = 0;
    const finalSpy = vi
      .spyOn(fixture.storage, "readSlotInto")
      .mockImplementation((slotId, into): void => {
        originalRead(slotId, into);
        readCount += 1;
        if (readCount === 3) into.regionId += 1;
      });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 2 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      reason: "medical_claim_stock_basis_stale",
      storageSlotId: 0,
      stockStackId: 0,
    });
    finalSpy.mockRestore();
  });

  it.each([
    "active",
    "dirtyQueued",
    "dirtyBacklog",
    "slotId",
    "stackId",
    "defId",
    "availableSupply",
    "rowVersion",
    "indexVersion",
  ] as const)("rejects captured Storage %s drift", (field) => {
    const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
    const scratch = stockScratch();
    const output = stockOutput();
    const original = fixture.storage.readSlotInto.bind(fixture.storage);
    const spy = vi
      .spyOn(fixture.storage, "readSlotInto")
      .mockImplementation((slotId, into): void => {
        original(slotId, into);
        mutateStockSlotField(field, into);
      });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_basis_stale");
    expectStockSelectionCleared(scratch, output);
    spy.mockRestore();
  });

  it("rejects a forged captured linked lane", () => {
    const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
    const scratch = stockScratch();
    const output = stockOutput();
    const original = fixture.storage.selectSupplySlotsInto.bind(fixture.storage);
    const spy = vi
      .spyOn(fixture.storage, "selectSupplySlotsInto")
      .mockImplementation((defId, cap, supply, supplyOutput): void => {
        original(defId, cap, supply, supplyOutput);
        supply.linkedFlags[0] = 0;
      });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_basis_stale");
    expectStockSelectionCleared(scratch, output);
    spy.mockRestore();
  });

  it.each(["inactive", "stack", "def", "quantity", "reserved", "available"] as const)(
    "rejects stale Item %s facts without publishing a winner",
    (field) => {
      const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
      const scratch = stockScratch();
      const output = stockOutput();
      const originalRead = fixture.items.readStackInto.bind(fixture.items);
      const spy = vi
        .spyOn(fixture.items, "readStackInto")
        .mockImplementation((stackId, ledger, readScratch, into): void => {
          originalRead(stackId, ledger, readScratch, into);
          mutateStockItemField(field, into);
        });
      fixture.facts.selectStockInto(
        { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
        fixture.storage,
        fixture.items,
        fixture.ledger,
        scratch,
        output,
      );
      expect(output).toMatchObject({
        ok: false,
        reason: "medical_claim_stock_basis_stale",
        storageSlotId: 0,
        stockStackId: 0,
      });
      spy.mockRestore();
    },
  );

  it("rejects cross-candidate epochs and final Item/Ledger getter drift", () => {
    const fixture = createStockFixture([
      { slotId: 0, stackId: 0, regionId: 1, quantity: 8 },
      { slotId: 1, stackId: 1, regionId: 1, quantity: 8 },
    ]);
    const scratch = stockScratch();
    const output = stockOutput();
    const originalRead = fixture.items.readStackInto.bind(fixture.items);
    let reads = 0;
    const epochSpy = vi
      .spyOn(fixture.items, "readStackInto")
      .mockImplementation((stackId, ledger, readScratch, into): void => {
        originalRead(stackId, ledger, readScratch, into);
        reads += 1;
        if (reads === 2) into.storeVersion += 1;
      });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 2 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output.reason).toBe("medical_claim_stock_basis_stale");
    epochSpy.mockRestore();
    const currentItemVersion = fixture.items.version;
    const getterSpy = vi
      .spyOn(fixture.items, "version", "get")
      .mockReturnValue(currentItemVersion + 1);
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 2 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      reason: "medical_claim_stock_basis_stale",
      storageSlotId: 0,
    });
    getterSpy.mockRestore();
    const currentLedgerVersion = fixture.ledger.version;
    let ledgerReads = 0;
    const ledgerGetterSpy = vi
      .spyOn(fixture.ledger, "version", "get")
      .mockImplementation((): number => {
        ledgerReads += 1;
        return ledgerReads >= 3 ? currentLedgerVersion + 1 : currentLedgerVersion;
      });
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      reason: "medical_claim_stock_basis_stale",
      storageSlotId: 0,
    });
    ledgerGetterSpy.mockRestore();
  });

  it.each(["row", "store", "reservation", "quantity", "reserved", "available"] as const)(
    "rejects final winner %s drift",
    (field) => {
      const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
      const scratch = stockScratch();
      const output = stockOutput();
      const originalRead = fixture.items.readStackInto.bind(fixture.items);
      let reads = 0;
      const spy = vi
        .spyOn(fixture.items, "readStackInto")
        .mockImplementation((stackId, ledger, readScratch, into): void => {
          originalRead(stackId, ledger, readScratch, into);
          reads += 1;
          if (reads === 2) mutateFinalStockItemField(field, into);
        });
      fixture.facts.selectStockInto(
        { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
        fixture.storage,
        fixture.items,
        fixture.ledger,
        scratch,
        output,
      );
      expect(output).toMatchObject({
        ok: false,
        reason: "medical_claim_stock_basis_stale",
        storageSlotId: 0,
      });
      spy.mockRestore();
    },
  );

  it("never reaches materializing or global-scan compatibility roots", () => {
    const fixture = createStockFixture([{ slotId: 0, stackId: 0, regionId: 1, quantity: 8 }]);
    const storageSelect = vi.spyOn(fixture.storage, "selectSupplySlots").mockImplementation(() => {
      throw new Error("materializing selector reached");
    });
    const storageRead = vi.spyOn(fixture.storage, "readSlot").mockImplementation(() => {
      throw new Error("materializing slot read reached");
    });
    const itemRead = vi.spyOn(fixture.items, "readStack").mockImplementation(() => {
      throw new Error("materializing item read reached");
    });
    const originalDirtyQueueRead: unknown = Reflect.get(fixture.storage, "findDirtyQueueIndex");
    if (typeof originalDirtyQueueRead !== "function")
      throw new Error("missing private dirty queue probe");
    let dirtyQueueRead = false;
    Reflect.set(fixture.storage, "findDirtyQueueIndex", (): never => {
      dirtyQueueRead = true;
      throw new Error("dirty queue scan reached");
    });
    const output = stockOutput();
    fixture.facts.selectStockInto(
      { stockDefId: 1, regionId: 1, requiredAmount: 1, candidateCap: 1 },
      fixture.storage,
      fixture.items,
      fixture.ledger,
      stockScratch(),
      output,
    );
    expect(output.ok).toBe(true);
    expect(storageSelect).not.toHaveBeenCalled();
    expect(storageRead).not.toHaveBeenCalled();
    expect(itemRead).not.toHaveBeenCalled();
    expect(dirtyQueueRead).toBe(false);
    Reflect.set(fixture.storage, "findDirtyQueueIndex", originalDirtyQueueRead);
  });
});

function createFacts(
  registry: ReturnType<typeof createEntityRegistry>,
  treatmentPolicies = [
    { treatmentDefId: 1, treatmentTicks: 3, workPerTickQ16: 40, severityDelta: 5 },
  ],
): ReturnType<typeof createM3MedicalClaimFactsIndex> {
  const options: M3MedicalClaimFactsIndexOptions = {
    capacity: 4,
    registry,
    treatmentPolicyCapacity: 4,
    treatmentPolicies,
  };
  return createM3MedicalClaimFactsIndex(options);
}

interface StockFixtureRow {
  readonly slotId: number;
  readonly stackId: number;
  readonly regionId: number;
  readonly quantity: number;
}

function createStockFixture(rows: readonly StockFixtureRow[]): {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly facts: ReturnType<typeof createM3MedicalClaimFactsIndex>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
  readonly entities: readonly EntityId[];
} {
  const capacity = 64;
  const registry = createEntityRegistry({ capacity });
  const facts = createFacts(registry);
  const items = createItemStackStore(capacity);
  const storage = createStorageLogisticsIndex(capacity, capacity, 4);
  const ledger = createReservationLedger({ capacity: 32, entityCapacity: capacity, cellCount: 64 });
  const offers = createWorkOfferIndex({
    capacity,
    workTypeCapacity: 4,
    regionCapacity: 4,
    defCapacity: 4,
    urgencyBucketCount: 4,
    permissionCapacity: 4,
  });
  const entities: EntityId[] = [];
  const entitiesByStack: (EntityId | undefined)[] = [];
  for (const row of rows) {
    let itemEntity = entitiesByStack[row.stackId];
    if (itemEntity === undefined) {
      itemEntity = allocate(registry);
      entitiesByStack[row.stackId] = itemEntity;
      expect(
        items.createStack(
          {
            stackId: row.stackId,
            entity: itemEntity,
            defId: 1,
            quantity: row.quantity,
            capacity: 100,
          },
          registry,
        ),
      ).toMatchObject({ ok: true });
    }
    const storageEntity = allocate(registry);
    entities.push(itemEntity);
    expect(
      storage.configureSlot(
        {
          slotId: row.slotId,
          storage: storageEntity,
          stackId: row.stackId,
          defId: 1,
          capacity: 100,
          desiredQuantity: 0,
          interactionCellIndex: row.slotId,
          offerId: row.slotId,
          workType: 1,
          regionId: row.regionId,
          urgencyBucket: 1,
          permissionId: 1,
        },
        registry,
      ),
    ).toMatchObject({ ok: true });
  }
  storage.refreshDirty(items, ledger, offers, capacity);
  return { registry, facts, items, storage, ledger, offers, entities };
}

function stockScratch(
  length = STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES,
  shortLane?: "slotIds" | "stackIds" | "rowVersions" | "availableSupplies" | "linkedFlags",
): M3MedicalStockSelectionScratch {
  return {
    supply: {
      slotIds: new Uint32Array(shortLane === "slotIds" ? 23 : length),
      stackIds: new Uint32Array(shortLane === "stackIds" ? 23 : length),
      rowVersions: new Uint32Array(shortLane === "rowVersions" ? 23 : length),
      availableSupplies: new Uint32Array(shortLane === "availableSupplies" ? 23 : length),
      linkedFlags: new Uint8Array(shortLane === "linkedFlags" ? 23 : length),
    },
    supplyOutput: {
      ok: false,
      reason: undefined,
      queryDefId: 0,
      candidateCap: 0,
      visitedCount: 0,
      selectedCount: 0,
      candidateCapHit: false,
      indexVersion: 0,
      dirtyBacklog: 0,
    },
    slot: storageSlotOutput(),
    itemRead: { entity: { index: 0, generation: 0 } },
    item: {
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
    },
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

function stockOutput(): M3MedicalStockSelectionIntoOutput {
  return {
    ok: false,
    reason: undefined,
    queryStockDefId: 0,
    queryRegionId: 0,
    requiredAmount: 0,
    candidateCap: 0,
    visitedCount: 0,
    eligibleCount: 0,
    candidateCapHit: false,
    storageSlotId: 0,
    stockStackId: 0,
    itemEntityIndex: 0,
    itemEntityGeneration: 0,
    defId: 0,
    quantity: 0,
    availableQuantity: 0,
    stockOwnerVersion: 0,
    stockRowVersion: 0,
    stockIndexVersion: 0,
    stockDirtyBacklog: 0,
    itemRowVersion: 0,
    itemStoreVersion: 0,
    reservationVersion: 0,
  };
}

function poisonStockScratch(
  scratch: M3MedicalStockSelectionScratch,
  output: M3MedicalStockSelectionIntoOutput,
): void {
  scratch.supply.slotIds.fill(99);
  scratch.supply.stackIds.fill(99);
  scratch.supply.rowVersions.fill(99);
  scratch.supply.availableSupplies.fill(99);
  scratch.supply.linkedFlags.fill(1);
  output.ok = true;
  output.reason = "medical_claim_stock_unavailable";
  output.queryStockDefId = 99;
  output.queryRegionId = 99;
  output.requiredAmount = 99;
  output.candidateCap = 99;
  output.visitedCount = 99;
  output.eligibleCount = 99;
  output.candidateCapHit = true;
  output.storageSlotId = 99;
  output.stockStackId = 99;
  output.itemEntityIndex = 99;
  output.itemEntityGeneration = 99;
  output.defId = 99;
  output.quantity = 99;
  output.availableQuantity = 99;
  output.stockOwnerVersion = 99;
  output.stockRowVersion = 99;
  output.stockIndexVersion = 99;
  output.stockDirtyBacklog = 99;
  output.itemRowVersion = 99;
  output.itemStoreVersion = 99;
  output.reservationVersion = 99;
}

function expectStockSelectionCleared(
  _scratch: M3MedicalStockSelectionScratch,
  output: M3MedicalStockSelectionIntoOutput,
): void {
  expect(output.eligibleCount).toBe(0);
  expect(output.storageSlotId).toBe(0);
  expect(output.stockStackId).toBe(0);
  expect(output.itemEntityIndex).toBe(0);
  expect(output.itemEntityGeneration).toBe(0);
  expect(output.defId).toBe(0);
  expect(output.quantity).toBe(0);
  expect(output.availableQuantity).toBe(0);
  expect(output.stockRowVersion).toBe(0);
  expect(output.itemRowVersion).toBe(0);
  expect(output.itemStoreVersion).toBe(0);
  expect(output.reservationVersion).toBe(0);
}

function expectSupplyLanesCleared(scratch: M3MedicalStockSelectionScratch): void {
  const zeros = new Array(24).fill(0);
  expect(Array.from(scratch.supply.slotIds)).toStrictEqual(zeros);
  expect(Array.from(scratch.supply.stackIds)).toStrictEqual(zeros);
  expect(Array.from(scratch.supply.rowVersions)).toStrictEqual(zeros);
  expect(Array.from(scratch.supply.availableSupplies)).toStrictEqual(zeros);
  expect(Array.from(scratch.supply.linkedFlags)).toStrictEqual(zeros);
}

function expectStockAuthorityReset(output: M3MedicalStockSelectionIntoOutput): void {
  expect(output.visitedCount).toBe(0);
  expect(output.eligibleCount).toBe(0);
  expect(output.candidateCapHit).toBe(false);
  expect(output.stockOwnerVersion).toBe(0);
  expect(output.stockIndexVersion).toBe(0);
  expect(output.stockDirtyBacklog).toBe(0);
}

function mutateSupplyHeader(
  field:
    | keyof StorageSupplySelectionIntoOutput
    | "falseKnownResidue"
    | "falseUnknownReason"
    | "falseEmptyReason",
  value: unknown,
  output: StorageSupplySelectionIntoOutput,
): void {
  if (field === "falseKnownResidue") {
    output.ok = false;
    output.reason = "storage_dirty_basis_mismatch";
    return;
  }
  if (field === "falseUnknownReason") {
    output.ok = false;
    Reflect.set(output, "reason", "storage_unknown");
    output.visitedCount = 0;
    output.selectedCount = 0;
    output.candidateCapHit = false;
    return;
  }
  if (field === "falseEmptyReason") {
    output.ok = false;
    output.reason = undefined;
    output.visitedCount = 0;
    output.selectedCount = 0;
    output.candidateCapHit = false;
    return;
  }
  Reflect.set(output, field, value);
}

function mutateStockItemField(
  field: "inactive" | "stack" | "def" | "quantity" | "reserved" | "available",
  output: ItemStackIntoOutput,
): void {
  if (field === "inactive") output.active = false;
  else if (field === "stack") output.stackId += 1;
  else if (field === "def") output.defId += 1;
  else if (field === "quantity") output.quantity += 1;
  else if (field === "reserved") output.reservedQuantity += 1;
  else output.availableQuantity += 1;
}

function mutateStockSlotField(
  field:
    | "active"
    | "dirtyQueued"
    | "dirtyBacklog"
    | "slotId"
    | "stackId"
    | "defId"
    | "availableSupply"
    | "rowVersion"
    | "indexVersion",
  output: StorageSlotIntoOutput,
): void {
  if (field === "active") output.active = false;
  else if (field === "dirtyQueued") output.dirtyQueued = true;
  else if (field === "dirtyBacklog") output.dirtyBacklog += 1;
  else if (field === "slotId") output.slotId += 1;
  else if (field === "stackId") output.stackId += 1;
  else if (field === "defId") output.defId += 1;
  else if (field === "availableSupply") output.availableSupply += 1;
  else if (field === "rowVersion") output.rowVersion += 1;
  else output.indexVersion += 1;
}

function mutateFinalStockItemField(
  field: "row" | "store" | "reservation" | "quantity" | "reserved" | "available",
  output: ItemStackIntoOutput,
): void {
  if (field === "row") output.rowVersion += 1;
  else if (field === "store") output.storeVersion += 1;
  else if (field === "reservation") output.reservationVersion += 1;
  else if (field === "quantity") output.quantity += 1;
  else if (field === "reserved") output.reservedQuantity += 1;
  else output.availableQuantity += 1;
}

function interactionInput(requestId: number, target: EntityId): M3MedicalPatientInteractionInput {
  return { requestId, target, interactionSpotId: 7, targetCellIndex: 11, sourceVersion: 0 };
}

function interactionOutput(): M3MedicalPatientInteractionIntoOutput {
  return {
    ok: true,
    reason: "medical_claim_value_invalid",
    active: true,
    requestId: 99,
    targetIndex: 99,
    targetGeneration: 99,
    interactionSpotId: 99,
    targetCellIndex: 99,
    sourceVersion: 99,
    rowVersion: 99,
    indexVersion: 99,
    activeCount: 99,
  };
}

function failedInteractionOutput(
  requestId: number,
  reason: M3MedicalPatientInteractionIntoOutput["reason"],
  indexVersion: number,
  activeCount: number,
): M3MedicalPatientInteractionIntoOutput {
  return {
    ok: false,
    reason,
    active: false,
    requestId,
    targetIndex: 0,
    targetGeneration: 0,
    interactionSpotId: 0,
    targetCellIndex: 0,
    sourceVersion: 0,
    rowVersion: 0,
    indexVersion,
    activeCount,
  };
}

function poisonInteractionOutput(output: M3MedicalPatientInteractionIntoOutput): void {
  output.ok = true;
  output.reason = "medical_claim_value_invalid";
  output.active = true;
  output.requestId = 99;
  output.targetIndex = 99;
  output.targetGeneration = 99;
  output.interactionSpotId = 99;
  output.targetCellIndex = 99;
  output.sourceVersion = 99;
  output.rowVersion = 99;
  output.indexVersion = 99;
  output.activeCount = 99;
}

function policyOutput(): M3MedicalTreatmentPolicyIntoOutput {
  return {
    ok: true,
    reason: "medical_claim_value_invalid",
    treatmentDefId: 99,
    policyKind: 99,
    policyVersion: 99,
    treatmentTicks: 99,
    workPerTickQ16: 99,
    severityDelta: 99,
    requiredWorkQ16: 99,
  };
}

function poisonPolicyOutput(output: M3MedicalTreatmentPolicyIntoOutput): void {
  output.ok = true;
  output.reason = "medical_claim_value_invalid";
  output.treatmentDefId = 99;
  output.policyKind = 99;
  output.policyVersion = 99;
  output.treatmentTicks = 99;
  output.workPerTickQ16 = 99;
  output.severityDelta = 99;
  output.requiredWorkQ16 = 99;
}

function allocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();
  if (!result.ok) throw new Error(result.reason);
  return result.entity;
}

function createMalformedSnapshots(snapshot: M3MedicalClaimFactsSnapshot): unknown[] {
  const malformed: unknown[] = [];
  malformed.push({ ...snapshot, extra: 1 });
  const missing: Record<string, unknown> = {
    snapshotVersion: snapshot.snapshotVersion,
    capacity: snapshot.capacity,
    indexVersion: snapshot.indexVersion,
    rows: snapshot.rows,
  };
  malformed.push(missing);
  const sparseRows = Array.from(snapshot.rows);
  Reflect.deleteProperty(sparseRows, 1);
  malformed.push({ ...snapshot, rows: sparseRows });
  malformed.push({ ...snapshot, rows: snapshot.rows.slice(0, 3) });
  malformed.push({ ...snapshot, rows: replaceSnapshotRow(snapshot, 1, { requestId: 2 }) });
  malformed.push({ ...snapshot, activeCount: 0 });
  malformed.push({ ...snapshot, indexVersion: 0 });
  malformed.push({ ...snapshot, rows: replaceSnapshotRow(snapshot, 0, { targetCellIndex: 1 }) });
  malformed.push({ ...snapshot, rows: replaceSnapshotRow(snapshot, 1, { rowVersion: 2 }) });
  malformed.push({ ...snapshot, rows: replaceSnapshotRow(snapshot, 1, { sourceVersion: 0.5 }) });
  const baseRow = snapshot.rows[1];
  if (baseRow === undefined) throw new Error("missing snapshot row");
  const extraRow = { ...baseRow, extra: 1 };
  const extraRows: unknown[] = Array.from(snapshot.rows);
  extraRows[1] = extraRow;
  malformed.push({ ...snapshot, rows: extraRows });
  return malformed;
}

function replaceSnapshotRow(
  snapshot: M3MedicalClaimFactsSnapshot,
  requestId: number,
  changes: Readonly<Record<string, number>>,
): unknown[] {
  const rows: unknown[] = Array.from(snapshot.rows);
  const row = snapshot.rows[requestId];
  if (row === undefined) throw new Error("missing snapshot row");
  rows[requestId] = { ...row, ...changes };
  return rows;
}

function expectedRowHash(
  prefix: string,
  requestId: number,
  active: number,
  targetIndex: number,
  targetGeneration: number,
  interactionSpotId: number,
  targetCellIndex: number,
  sourceVersion: number,
  rowVersion: number,
): readonly CanonicalWorldField[] {
  const rowPrefix = `${prefix}.row.${String(requestId)}`;
  return [
    { name: `${rowPrefix}.requestId`, value: requestId },
    { name: `${rowPrefix}.active`, value: active },
    { name: `${rowPrefix}.targetIndex`, value: targetIndex },
    { name: `${rowPrefix}.targetGeneration`, value: targetGeneration },
    { name: `${rowPrefix}.interactionSpotId`, value: interactionSpotId },
    { name: `${rowPrefix}.targetCellIndex`, value: targetCellIndex },
    { name: `${rowPrefix}.sourceVersion`, value: sourceVersion },
    { name: `${rowPrefix}.rowVersion`, value: rowVersion },
  ];
}
