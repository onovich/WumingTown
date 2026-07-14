import { describe, expect, it } from "vitest";

import {
  MAP_TERRAIN_BLOCKED,
  M3_FOOD_DEFAULT_CANDIDATE_CAP,
  M3_FOOD_DEFAULT_EXACT_PATH_CAP,
  M3_FOOD_DEFAULT_SELECTED_CAP,
  M3_FOOD_STACK_NONE,
  NEED_LANE_HUNGER,
  calculateM3FoodConservationTotal,
  createM3EatingJobHashFields,
  createEntityRegistry,
  createGridPathfinder,
  createItemStackStore,
  createJobCoreStore,
  createM3EatingJobDriverStore,
  createM3FoodAvailabilityStore,
  createMapGrid,
  createNeedStore,
  createNeedUrgencyIndex,
  createPathVersionBasis,
  createReservationLedger,
  createStorageLogisticsIndex,
  createWorkOfferIndex,
  formatCanonicalWorldHash,
  restoreM3EatingJobDriverStore,
  resolveM3FoodPathCandidate,
  RESERVATION_CLAIM_NONE,
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  type EntityId,
  type ExistingClaimsAdoptionControl,
  type ItemStackQuantityAdditionPrepareInput,
  type M3EatingClaimAdoptionOutput,
  type M3EatingAdoptedPickupInput,
  type M3FoodPortionInput,
  type M3EatingClaimAdoptionInput,
  type M3EatingAdoptedJobIntoOutput,
  type PathVersionBasis,
  type StorageSlotInput,
  type ReservationClaimsIntoOutput,
  type JobTokenIntoOutput,
} from "./index";
import type { M3EatingAdoptedMutationOutput } from "./m3-eating-jobs";
import type { NeedLaneMutationPrepareInput } from "./m3-needs";

describe("M3 food availability and eating logistics", () => {
  it("rejects out-of-capacity and truncated adopted create facts before JobCore mutation", () => {
    const outOfBounds = createAdoptedEatingFixture(0, {
      coreCapacity: 10,
      autonomyJobStart: 8,
      eatingCapacity: 8,
    });
    expect(outOfBounds.token.jobId).toBe(8);
    expect(outOfBounds.adopted).toMatchObject({
      ok: false,
      reason: "eating_adoption_preflight_failed",
    });
    expect(outOfBounds.core.version).toBe(outOfBounds.token.version);
    expect(outOfBounds.eating.createMetrics()).toMatchObject({ version: 0, activeCount: 0 });

    const invalidAbility: Partial<M3EatingClaimAdoptionInput> = { abilityAllowed: false };
    Reflect.set(invalidAbility, "abilityAllowed", 1);
    const invalidFacts: readonly Partial<M3EatingClaimAdoptionInput>[] = [
      { sourceStackId: 0x1_0000_0000 },
      { storageSlotId: 0x1_0000_0000 },
      { foodDefId: 0x1_0000_0000 },
      { amount: 0x1_0000_0000 },
      { hungerRestore: 0x1_0000_0000 },
      { itemStoreVersion: 0x1_0000_0000 },
      { foodAvailabilityVersion: 0x1_0000_0000 },
      { mealWindowVersion: 0x1_0000_0000 },
      { abilityAllowed: false },
      invalidAbility,
      { createdTick: -1 },
    ];
    for (const adoptionOverrides of invalidFacts) {
      const fixture = createAdoptedEatingFixture(0, { adoptionOverrides });
      expect(fixture.adopted).toMatchObject({
        ok: false,
        reason: "eating_adoption_preflight_failed",
      });
      expect(fixture.core.version).toBe(fixture.token.version);
      expect(fixture.eating.createMetrics()).toMatchObject({ version: 0, activeCount: 0 });
    }
  });

  it("adopts exact positive-generation claims and rolls back without touching ledger custody", () => {
    const fixture = createAdoptedEatingFixture();
    const { control, core, eating, claims, adopted: output } = fixture;
    expect(output).toMatchObject({
      ok: true,
      jobGeneration: 1,
      jobSlotVersion: 2,
      activeCount: 1,
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
    });
    expect(output).toMatchObject({
      jobCoreReservedCount: 0,
      jobCoreActiveCount: 1,
      jobCoreRunningCount: 1,
      driverReservedCount: 1,
      driverPickedUpCount: 0,
      cumulativeConsumedCount: 0,
      reservationAttemptCount: 0,
    });
    const rollback = createDriverOutput();
    eating.rollbackNewlyAdoptedInto(
      {
        ...control,
        expectedAdoptedJobSlotVersion: output.jobSlotVersion,
        expectedAdoptedDriverVersion: output.driverVersion,
      },
      core,
      rollback,
    );
    expect(rollback).toMatchObject({
      ok: true,
      jobSlotVersion: 3,
      activeCount: 0,
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobCoreVersion: fixture.control.expectedJobCoreVersion + 2,
      driverVersion: fixture.control.expectedDriverVersion + 2,
    });
    expect(rollback).toMatchObject({
      jobCoreReservedCount: 1,
      jobCoreActiveCount: 0,
      jobCoreRunningCount: 0,
      driverReservedCount: 0,
    });
    expect(claims).toMatchObject({ ok: true, claimCount: 2, version: fixture.ledger.version });
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);
    const rollbackShadow = eating.createSnapshot();
    expect(restoreM3EatingJobDriverStore(rollbackShadow).createSnapshot()).toStrictEqual(
      rollbackShadow,
    );
  });

  it("rejects forged rollback prior bases and noncanonical claim tails before either owner writes", () => {
    for (const changed of ["driver", "slot", "core", "count", "tail"] as const) {
      const fixture = createAdoptedEatingFixture();
      const claimIds = new Uint32Array(fixture.control.claimIds);
      if (changed === "tail") claimIds[7] = 123;
      const control = {
        ...fixture.control,
        expectedAdoptedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: fixture.adopted.driverVersion,
        expectedDriverVersion:
          fixture.control.expectedDriverVersion + (changed === "driver" ? 1 : 0),
        expectedJobSlotVersion:
          fixture.control.expectedJobSlotVersion + (changed === "slot" ? 1 : 0),
        expectedJobCoreVersion:
          fixture.control.expectedJobCoreVersion + (changed === "core" ? 1 : 0),
        claimCount: changed === "count" ? 1 : 2,
        claimIds,
      };
      const before = {
        core: fixture.core.createSnapshot(),
        eating: fixture.eating.createSnapshot(),
      };
      const output = createDriverOutput();
      fixture.eating.rollbackNewlyAdoptedInto(control, fixture.core, output);
      expect(output).toMatchObject({
        ok: false,
        reason: "eating_rollback_preflight_failed",
        ownerIndex: 0,
        ownerGeneration: 0,
      });
      expect({
        core: fixture.core.createSnapshot(),
        eating: fixture.eating.createSnapshot(),
      }).toStrictEqual(before);
    }
  });

  it("exposes a full-token autonomous terminal root for phase-zero claim cleanup", () => {
    const fixture = createAdoptedEatingFixture();
    const output = createEatingMutationOutput();
    fixture.eating.terminalAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 102,
        outcome: "canceled",
        failureReason: "cancelled",
        itemAddition: createEatingItemAddition(fixture, 1),
      },
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: true, cleanupPending: false, releasedClaimCount: 2 });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
  });

  it.each([
    {
      outcome: "canceled" as const,
      failureReason: "cancelled" as const,
      interruptionKind: undefined,
    },
    { outcome: "failed" as const, failureReason: "path" as const, interruptionKind: undefined },
    {
      outcome: "interrupted" as const,
      failureReason: "cancelled" as const,
      interruptionKind: "safe_point" as const,
    },
  ])("returns carried food once for adopted $outcome terminal", (terminalCase) => {
    const fixture = createAdoptedEatingFixture();
    const pickup = pickupAdoptedEating(fixture);
    expect(pickup).toMatchObject({ ok: true, alreadyCommitted: false });
    expect(fixture.items.readStack(2)).toMatchObject({ quantity: 2 });
    const output = createEatingMutationOutput();
    const terminalInput = {
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      owner: fixture.owner,
      expectedJobSlotVersion: pickup.jobSlotVersion,
      expectedJobCoreVersion: pickup.jobCoreVersion,
      expectedDriverVersion: pickup.driverVersion,
      expectedCurrentLedgerVersion: fixture.ledger.version,
      tick: 103,
      outcome: terminalCase.outcome,
      failureReason: terminalCase.failureReason,
      ...(terminalCase.interruptionKind === undefined
        ? {}
        : { interruptionKind: terminalCase.interruptionKind }),
      itemAddition: createEatingItemAddition(fixture, 1),
    };
    fixture.eating.terminalAdoptedInto(
      terminalInput,
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      terminalOutcome: terminalCase.outcome,
      cleanupPending: false,
      releasedClaimCount: 2,
    });
    expect(fixture.items.readStack(2)).toMatchObject({ quantity: 3 });
    const duplicate = {
      ...terminalInput,
      expectedJobSlotVersion: output.jobSlotVersion,
      expectedJobCoreVersion: output.jobCoreVersion,
      expectedDriverVersion: output.driverVersion,
      expectedCurrentLedgerVersion: fixture.ledger.version,
      tick: 104,
      itemAddition: createEatingItemAddition(fixture, 1),
    };
    fixture.eating.terminalAdoptedInto(
      duplicate,
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: true,
      terminalOutcome: terminalCase.outcome,
    });
    expect(fixture.items.readStack(2)).toMatchObject({ quantity: 3 });
    const terminalBeforeStale = {
      items: fixture.items.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
    };
    fixture.eating.terminalAdoptedInto(
      { ...duplicate, expectedJobSlotVersion: duplicate.expectedJobSlotVersion - 1, tick: 105 },
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    expect({
      items: fixture.items.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
    }).toStrictEqual(terminalBeforeStale);
  });

  it("returns structured pickup duplicate only for a fresh exact caller basis", () => {
    const fixture = createAdoptedEatingFixture();
    const pickup = pickupAdoptedEating(fixture);
    const before = {
      items: fixture.items.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    const duplicate = createEatingMutationOutput();
    fixture.eating.pickupAdoptedInto(
      createEatingPickupInput(fixture, pickup, 103),
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      duplicate,
    );
    expect(duplicate).toMatchObject({
      ok: true,
      alreadyCommitted: true,
      driverVersion: pickup.driverVersion,
      jobSlotVersion: pickup.jobSlotVersion,
    });
    expect({
      items: fixture.items.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(before);

    const stale = createEatingMutationOutput();
    const staleInput = {
      ...createEatingPickupInput(fixture, pickup, 104),
      expectedCurrentLedgerVersion: fixture.ledger.version + 1,
    };
    fixture.eating.pickupAdoptedInto(
      staleInput,
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      stale,
    );
    expect(stale).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    expect({
      items: fixture.items.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(before);
  });

  it("commits the Need effect once and retries only exact cleanup", () => {
    const fixture = createAdoptedEatingFixture();
    const pickup = pickupAdoptedEating(fixture);
    expect(pickup.ok).toBe(true);
    const liveLedger = fixture.ledger.createSnapshot();
    expect(
      fixture.ledger.restoreFromSnapshot(
        { ...liveLedger, ledgerVersion: 0xffff_ffff },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const needMutation: NeedLaneMutationPrepareInput = {
      actorId: fixture.owner.index,
      lane: NEED_LANE_HUNGER,
      tick: 103,
      reason: "need.external_delta" as const,
      sourceSystemId: 3,
      sourceEventId: fixture.token.jobId,
      expectedStoreVersion: fixture.needs.version,
      expectedLaneVersion: fixture.needs.readLaneOwnerVersion(
        fixture.owner.index,
        NEED_LANE_HUNGER,
      ),
      expectedValue: 300,
      delta: 40,
    };
    const output = createEatingMutationOutput();
    fixture.eating.consumeAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: pickup.jobSlotVersion,
        expectedJobCoreVersion: pickup.jobCoreVersion,
        expectedDriverVersion: pickup.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 103,
        needMutation,
      },
      fixture.needs,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, cleanupPending: true, terminalOutcome: "consumed" });
    const pendingDriverVersion = output.driverVersion;
    expect(fixture.needs.readLaneValue(fixture.owner.index, NEED_LANE_HUNGER)).toBe(340);
    expect(fixture.ledger.restoreFromSnapshot(liveLedger, fixture.registry)).toMatchObject({
      ok: true,
    });
    const beforeOrdinaryRetry = {
      needs: readEatingNeedBasis(fixture),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    fixture.eating.consumeAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: pickup.jobSlotVersion,
        expectedJobCoreVersion: pickup.jobCoreVersion,
        expectedDriverVersion: pendingDriverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 104,
        needMutation,
      },
      fixture.needs,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    expect({
      needs: readEatingNeedBasis(fixture),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(beforeOrdinaryRetry);
    fixture.eating.resumeCleanupInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: pickup.jobSlotVersion,
        expectedJobCoreVersion: pickup.jobCoreVersion,
        expectedDriverVersion: pendingDriverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 104,
        outcome: "consumed",
        failureReason: "none",
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      cleanupPending: false,
      terminalOutcome: "consumed",
      releasedClaimCount: 2,
    });
    expect(fixture.needs.readLaneValue(fixture.owner.index, NEED_LANE_HUNGER)).toBe(340);
    const finalDriverVersion = output.driverVersion;
    fixture.eating.consumeAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: output.jobSlotVersion,
        expectedJobCoreVersion: output.jobCoreVersion,
        expectedDriverVersion: output.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 105,
        needMutation,
      },
      fixture.needs,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: true,
      terminalOutcome: "consumed",
      driverVersion: finalDriverVersion,
    });
    expect(fixture.needs.readLaneValue(fixture.owner.index, NEED_LANE_HUNGER)).toBe(340);
  });

  it.each([
    {
      outcome: "canceled" as const,
      failureReason: "cancelled" as const,
      interruptionKind: undefined,
    },
    { outcome: "failed" as const, failureReason: "path" as const, interruptionKind: undefined },
    {
      outcome: "interrupted" as const,
      failureReason: "cancelled" as const,
      interruptionKind: "safe_point" as const,
    },
  ])("retries only exact cleanup after a returned $outcome effect", (terminalCase) => {
    const fixture = createAdoptedEatingFixture();
    const pickup = pickupAdoptedEating(fixture);
    const liveLedger = fixture.ledger.createSnapshot();
    expect(
      fixture.ledger.restoreFromSnapshot(
        { ...liveLedger, ledgerVersion: 0xffff_ffff },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const output = createEatingMutationOutput();
    const firstInput = {
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      owner: fixture.owner,
      expectedJobSlotVersion: pickup.jobSlotVersion,
      expectedJobCoreVersion: pickup.jobCoreVersion,
      expectedDriverVersion: pickup.driverVersion,
      expectedCurrentLedgerVersion: fixture.ledger.version,
      tick: 103,
      outcome: terminalCase.outcome,
      failureReason: terminalCase.failureReason,
      ...(terminalCase.interruptionKind === undefined
        ? {}
        : { interruptionKind: terminalCase.interruptionKind }),
      itemAddition: createEatingItemAddition(fixture, 1),
    };
    fixture.eating.terminalAdoptedInto(
      firstInput,
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      cleanupPending: true,
      terminalOutcome: terminalCase.outcome,
    });
    expect(fixture.items.readStack(2)).toMatchObject({ quantity: 3 });
    const pendingVersion = output.driverVersion;
    const pending = fixture.eating.createSnapshot();
    const pendingRow = pending.rows[fixture.token.jobId];
    expect(pendingRow).toMatchObject({ effectPhase: 2, cleanupPending: 1, returnedOnce: 1 });
    const expectedCounters =
      terminalCase.outcome === "failed"
        ? { cumulativeFailedCount: 1 }
        : terminalCase.outcome === "interrupted"
          ? { cumulativeInterruptedCount: 1 }
          : { cumulativeCanceledCount: 1 };
    expect(pending).toMatchObject(expectedCounters);

    const beforeOrdinary = {
      item: fixture.items.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    fixture.eating.terminalAdoptedInto(
      {
        ...firstInput,
        expectedDriverVersion: pendingVersion,
        tick: 104,
        itemAddition: createEatingItemAddition(fixture, 1),
      },
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    fixture.eating.pickupAdoptedInto(
      createEatingPickupInput(
        fixture,
        {
          jobSlotVersion: pickup.jobSlotVersion,
          jobCoreVersion: pickup.jobCoreVersion,
          driverVersion: pendingVersion,
        },
        104,
      ),
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    fixture.eating.consumeAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: pickup.jobSlotVersion,
        expectedJobCoreVersion: pickup.jobCoreVersion,
        expectedDriverVersion: pendingVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 104,
        needMutation: createEatingNeedMutation(fixture, 104),
      },
      fixture.needs,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    expect({
      item: fixture.items.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(beforeOrdinary);

    expect(fixture.ledger.restoreFromSnapshot(liveLedger, fixture.registry)).toMatchObject({
      ok: true,
    });
    const itemBeforeResume = fixture.items.createSnapshot();
    fixture.eating.resumeCleanupInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: pickup.jobSlotVersion,
        expectedJobCoreVersion: pickup.jobCoreVersion,
        expectedDriverVersion: pendingVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 105,
        outcome: terminalCase.outcome,
        failureReason: terminalCase.failureReason,
        ...(terminalCase.interruptionKind === undefined
          ? {}
          : { interruptionKind: terminalCase.interruptionKind }),
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      cleanupPending: false,
      terminalOutcome: terminalCase.outcome,
      releasedClaimCount: 2,
    });
    expect(fixture.items.createSnapshot()).toStrictEqual(itemBeforeResume);
    expect(fixture.eating.createSnapshot()).toMatchObject(expectedCounters);
    expect(fixture.eating.createMetrics()).toMatchObject(
      terminalCase.outcome === "interrupted"
        ? { interruptedCount: 1, currentInterruptedJobs: 1, canceledCount: 0 }
        : terminalCase.outcome === "canceled"
          ? { interruptedCount: 0, canceledCount: 1 }
          : { interruptedCount: 0, failedCount: 1 },
    );
    const terminalRead = createEatingAdoptedJobOutput();
    fixture.eating.readAdoptedJobInto(
      fixture.token.jobId,
      fixture.token.jobGeneration,
      fixture.owner,
      output.jobSlotVersion,
      terminalRead,
    );
    expect(terminalRead).toMatchObject(
      terminalCase.outcome === "interrupted"
        ? { ok: true, interruptedCount: 1, currentInterruptedJobs: 1, canceledCount: 0 }
        : terminalCase.outcome === "canceled"
          ? { ok: true, interruptedCount: 0, canceledCount: 1 }
          : { ok: true, interruptedCount: 0, failedCount: 1 },
    );

    const duplicateInput = {
      ...firstInput,
      expectedJobSlotVersion: output.jobSlotVersion,
      expectedJobCoreVersion: output.jobCoreVersion,
      expectedDriverVersion: output.driverVersion,
      expectedCurrentLedgerVersion: fixture.ledger.version,
      tick: 106,
      itemAddition: createEatingItemAddition(fixture, 1),
    };
    const beforeDuplicate = {
      item: fixture.items.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    fixture.eating.terminalAdoptedInto(
      duplicateInput,
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: true,
      terminalOutcome: terminalCase.outcome,
    });
    expect({
      item: fixture.items.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: fixture.eating.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(beforeDuplicate);
  });

  it("retries phase-zero terminal cleanup without a domain effect", () => {
    const fixture = createAdoptedEatingFixture();
    const liveLedger = fixture.ledger.createSnapshot();
    expect(
      fixture.ledger.restoreFromSnapshot(
        { ...liveLedger, ledgerVersion: 0xffff_ffff },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const output = createEatingMutationOutput();
    fixture.eating.terminalAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 102,
        outcome: "canceled",
        failureReason: "cancelled",
        itemAddition: createEatingItemAddition(fixture, 1),
      },
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, cleanupPending: true, terminalOutcome: "canceled" });
    expect(fixture.eating.createSnapshot().rows[fixture.token.jobId]).toMatchObject({
      effectPhase: 2,
      cleanupPending: 1,
      returnedOnce: 0,
      pickupOnce: 0,
    });
    const pendingVersion = output.driverVersion;
    expect(fixture.ledger.restoreFromSnapshot(liveLedger, fixture.registry)).toMatchObject({
      ok: true,
    });
    fixture.eating.resumeCleanupInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: pendingVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 103,
        outcome: "canceled",
        failureReason: "cancelled",
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: true, releasedClaimCount: 2, terminalOutcome: "canceled" });
    expect(fixture.eating.createSnapshot()).toMatchObject({ cumulativeCanceledCount: 1 });
  });

  it("roundtrips reserved and picked adopted rows with exact read and hash bases", () => {
    const fixture = createAdoptedEatingFixture();
    const reserved = fixture.eating.createSnapshot();
    const restoredReserved = restoreM3EatingJobDriverStore(reserved);
    expect(restoredReserved.createSnapshot()).toStrictEqual(reserved);
    const read = createEatingAdoptedJobOutput();
    const identity = read;
    restoredReserved.readAdoptedJobInto(
      fixture.token.jobId,
      fixture.token.jobGeneration,
      fixture.owner,
      fixture.adopted.jobSlotVersion,
      read,
    );
    expect(read).toBe(identity);
    expect(read).toMatchObject({
      ok: true,
      active: true,
      step: "reserved",
      effectPhase: 0,
      reservationVersion: fixture.ledger.version,
      lastEffectTick: 101,
    });
    expect(Array.from(read.claimIds)).toStrictEqual(Array.from(fixture.ids.slice(0, 2)));
    expect(Array.from(read.claimEpochs)).toStrictEqual(Array.from(fixture.epochs.slice(0, 2)));
    expect(Array.from(read.claimCreatedTicks)).toStrictEqual([100, 100]);
    expect(Array.from(read.claimLeaseExpiryTicks)).toStrictEqual([400, 400]);
    expect(read).toMatchObject({
      itemStoreVersion: fixture.items.version,
      foodAvailabilityVersion: 1,
      mealWindowVersion: 1,
      abilityAllowed: true,
      activeCount: 1,
      reservedCount: 1,
      reservationAttemptCount: 0,
      cumulativeConsumedCount: 0,
      terminalReason: "food.job_created",
    });

    const hash = (snapshot: typeof reserved): string =>
      formatCanonicalWorldHash({
        fields: createM3EatingJobHashFields(snapshot),
        randomStreams: [],
        queuedCommands: [],
      });
    const reservedRow = reserved.rows[fixture.token.jobId];
    if (reservedRow === undefined) throw new Error("missing reserved eating row");
    const changedRows = copyWithReplacement(reserved.rows, fixture.token.jobId, {
      ...reservedRow,
      reservationVersion: reservedRow.reservationVersion + 1,
    });
    expect(hash({ ...reserved, rows: changedRows })).not.toBe(hash(reserved));
    const changedLeaseRows = copyWithReplacement(reserved.rows, fixture.token.jobId, {
      ...reservedRow,
      claimLeaseExpiryTicks: [
        reservedRow.claimLeaseExpiryTicks[0] ?? 0,
        (reservedRow.claimLeaseExpiryTicks[1] ?? 0) + 1,
      ],
    });
    expect(hash({ ...reserved, rows: changedLeaseRows })).not.toBe(hash(reserved));

    const pickup = pickupAdoptedEating(fixture);
    expect(pickup.ok).toBe(true);
    const picked = fixture.eating.createSnapshot();
    expect(restoreM3EatingJobDriverStore(picked).createSnapshot()).toStrictEqual(picked);
    expect(picked.rows[fixture.token.jobId]).toMatchObject({
      active: 1,
      effectPhase: 1,
      stepCode: 3,
      carriedDefId: GRAIN_BOWL,
      carriedAmount: 1,
      pickupOnce: 1,
    });
    const pickedRow = picked.rows[fixture.token.jobId];
    if (pickedRow === undefined) throw new Error("missing picked eating row");
    const badPickedRows = copyWithReplacement(picked.rows, fixture.token.jobId, {
      ...pickedRow,
      terminalReasonCode: 5,
    });
    expect(
      createM3EatingJobDriverStore(picked.capacity).restoreFromSnapshot({
        ...picked,
        rows: badPickedRows,
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects persisted claim lifetime drift before any pickup mutation", () => {
    const fixture = createAdoptedEatingFixture();
    const snapshot = fixture.eating.createSnapshot();
    const snapshotRow = snapshot.rows[fixture.token.jobId];
    if (snapshotRow === undefined) throw new Error("missing eating row");
    const rows = copyWithReplacement(snapshot.rows, fixture.token.jobId, {
      ...snapshotRow,
      claimLeaseExpiryTicks: [
        snapshotRow.claimLeaseExpiryTicks[0] ?? 0,
        (snapshotRow.claimLeaseExpiryTicks[1] ?? 0) + 1,
      ],
    });
    const drifted = restoreM3EatingJobDriverStore({ ...snapshot, rows });
    const before = {
      items: fixture.items.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: drifted.createSnapshot(),
    };
    const output = createEatingMutationOutput();
    drifted.pickupAdoptedInto(
      createEatingPickupInput(fixture, fixture.adopted, 102),
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    expect({
      items: fixture.items.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
      core: fixture.core.createSnapshot(),
      eating: drifted.createSnapshot(),
    }).toStrictEqual(before);
  });

  it("rejects cumulative counter exhaustion before domain, ledger, or JobCore writes", () => {
    const terminalFixture = createAdoptedEatingFixture();
    const terminalSnapshot = terminalFixture.eating.createSnapshot();
    const terminalStore = restoreM3EatingJobDriverStore({
      ...terminalSnapshot,
      cumulativeCanceledCount: 0xffff_ffff,
    });
    const terminalBefore = {
      items: terminalFixture.items.createSnapshot(),
      ledger: terminalFixture.ledger.createSnapshot(),
      core: terminalFixture.core.createSnapshot(),
      eating: terminalStore.createSnapshot(),
    };
    const terminalOutput = createEatingMutationOutput();
    terminalStore.terminalAdoptedInto(
      {
        jobId: terminalFixture.token.jobId,
        jobGeneration: terminalFixture.token.jobGeneration,
        owner: terminalFixture.owner,
        expectedJobSlotVersion: terminalFixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: terminalFixture.adopted.jobCoreVersion,
        expectedDriverVersion: terminalFixture.adopted.driverVersion,
        expectedCurrentLedgerVersion: terminalFixture.ledger.version,
        tick: 102,
        outcome: "canceled",
        failureReason: "cancelled",
        itemAddition: createEatingItemAddition(terminalFixture, 1),
      },
      terminalFixture.items,
      terminalFixture.ledger,
      terminalFixture.core,
      terminalFixture.claims,
      terminalOutput,
    );
    expect(terminalOutput).toMatchObject({ ok: false, reason: "eating_version_exhausted" });
    expect({
      items: terminalFixture.items.createSnapshot(),
      ledger: terminalFixture.ledger.createSnapshot(),
      core: terminalFixture.core.createSnapshot(),
      eating: terminalStore.createSnapshot(),
    }).toStrictEqual(terminalBefore);

    for (const counters of [
      { consumedAmountTotal: 0xffff_ffff },
      { cumulativeConsumedCount: 0xffff_ffff },
    ]) {
      const fixture = createAdoptedEatingFixture();
      const pickup = pickupAdoptedEating(fixture);
      const picked = fixture.eating.createSnapshot();
      const exhausted = restoreM3EatingJobDriverStore({ ...picked, ...counters });
      const before = {
        needs: readEatingNeedBasis(fixture),
        ledger: fixture.ledger.createSnapshot(),
        core: fixture.core.createSnapshot(),
        eating: exhausted.createSnapshot(),
      };
      const output = createEatingMutationOutput();
      exhausted.consumeAdoptedInto(
        {
          jobId: fixture.token.jobId,
          jobGeneration: fixture.token.jobGeneration,
          owner: fixture.owner,
          expectedJobSlotVersion: pickup.jobSlotVersion,
          expectedJobCoreVersion: pickup.jobCoreVersion,
          expectedDriverVersion: pickup.driverVersion,
          expectedCurrentLedgerVersion: fixture.ledger.version,
          tick: 103,
          needMutation: createEatingNeedMutation(fixture, 103),
        },
        fixture.needs,
        fixture.ledger,
        fixture.core,
        fixture.claims,
        output,
      );
      expect(output).toMatchObject({ ok: false, reason: "eating_version_exhausted" });
      expect({
        needs: readEatingNeedBasis(fixture),
        ledger: fixture.ledger.createSnapshot(),
        core: fixture.core.createSnapshot(),
        eating: exhausted.createSnapshot(),
      }).toStrictEqual(before);
    }
  });

  it("roundtrips cleanup-pending and terminal adopted rows", () => {
    const cleanup = createAdoptedEatingFixture();
    const pickup = pickupAdoptedEating(cleanup);
    const liveLedger = cleanup.ledger.createSnapshot();
    expect(
      cleanup.ledger.restoreFromSnapshot(
        { ...liveLedger, ledgerVersion: 0xffff_ffff },
        cleanup.registry,
      ),
    ).toMatchObject({ ok: true });
    const output = createEatingMutationOutput();
    cleanup.eating.consumeAdoptedInto(
      {
        jobId: cleanup.token.jobId,
        jobGeneration: cleanup.token.jobGeneration,
        owner: cleanup.owner,
        expectedJobSlotVersion: pickup.jobSlotVersion,
        expectedJobCoreVersion: pickup.jobCoreVersion,
        expectedDriverVersion: pickup.driverVersion,
        expectedCurrentLedgerVersion: cleanup.ledger.version,
        tick: 103,
        needMutation: createEatingNeedMutation(cleanup, 103),
      },
      cleanup.needs,
      cleanup.ledger,
      cleanup.core,
      cleanup.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, cleanupPending: true, terminalOutcome: "consumed" });
    const pending = cleanup.eating.createSnapshot();
    expect(restoreM3EatingJobDriverStore(pending).createSnapshot()).toStrictEqual(pending);
    expect(pending.rows[cleanup.token.jobId]).toMatchObject({
      active: 1,
      effectPhase: 2,
      pendingTerminalOutcome: 4,
      consumedDefId: GRAIN_BOWL,
      consumedAmount: 1,
    });
    const pendingRow = pending.rows[cleanup.token.jobId];
    if (pendingRow === undefined) throw new Error("missing pending eating row");
    const badPendingRows = copyWithReplacement(pending.rows, cleanup.token.jobId, {
      ...pendingRow,
      terminalReasonCode: 3,
    });
    expect(
      createM3EatingJobDriverStore(pending.capacity).restoreFromSnapshot({
        ...pending,
        rows: badPendingRows,
      }),
    ).toMatchObject({ ok: false });
    const badConsumedTuple = copyWithReplacement(pending.rows, cleanup.token.jobId, {
      ...pendingRow,
      returnedOnce: 1,
    });
    expect(
      createM3EatingJobDriverStore(pending.capacity).restoreFromSnapshot({
        ...pending,
        rows: badConsumedTuple,
      }),
    ).toMatchObject({ ok: false });

    const terminal = createAdoptedEatingFixture();
    const terminalOutput = createEatingMutationOutput();
    terminal.eating.terminalAdoptedInto(
      {
        jobId: terminal.token.jobId,
        jobGeneration: terminal.token.jobGeneration,
        owner: terminal.owner,
        expectedJobSlotVersion: terminal.adopted.jobSlotVersion,
        expectedJobCoreVersion: terminal.adopted.jobCoreVersion,
        expectedDriverVersion: terminal.adopted.driverVersion,
        expectedCurrentLedgerVersion: terminal.ledger.version,
        tick: 102,
        outcome: "failed",
        failureReason: "path",
        itemAddition: createEatingItemAddition(terminal, 1),
      },
      terminal.items,
      terminal.ledger,
      terminal.core,
      terminal.claims,
      terminalOutput,
    );
    expect(terminalOutput.ok).toBe(true);
    const tombstone = terminal.eating.createSnapshot();
    expect(restoreM3EatingJobDriverStore(tombstone).createSnapshot()).toStrictEqual(tombstone);
    expect(tombstone.rows[terminal.token.jobId]).toMatchObject({
      active: 0,
      effectPhase: 3,
      stepCode: 6,
      pendingTerminalOutcome: 2,
      pendingTerminalFailure: 4,
      reservationVersion: terminal.ledger.version,
      claimIds: [RESERVATION_CLAIM_NONE, RESERVATION_CLAIM_NONE],
      claimEpochs: [0, 0],
    });
    const tombstoneRow = tombstone.rows[terminal.token.jobId];
    if (tombstoneRow === undefined) throw new Error("missing terminal eating row");
    const badTerminalRows = copyWithReplacement(tombstone.rows, terminal.token.jobId, {
      ...tombstoneRow,
      terminalReasonCode: 4,
    });
    expect(
      createM3EatingJobDriverStore(tombstone.capacity).restoreFromSnapshot({
        ...tombstone,
        rows: badTerminalRows,
      }),
    ).toMatchObject({ ok: false });
  });

  it.each(["cancel", "fail"] as const)(
    "fails legacy %s closed for adopted jobs before item or claim mutation",
    (operation) => {
      const fixture = createAdoptedEatingFixture();
      expect(pickupAdoptedEating(fixture).ok).toBe(true);
      const unrelated = createFoodFixture(1);
      const before = {
        items: fixture.items.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
        core: fixture.core.createSnapshot(),
        eating: fixture.eating.createSnapshot(),
      };
      const result =
        operation === "cancel"
          ? fixture.eating.cancel(
              fixture.token.jobId,
              103,
              fixture.items,
              unrelated.food,
              unrelated.storage,
              fixture.ledger,
              fixture.core,
            )
          : fixture.eating.fail(
              fixture.token.jobId,
              103,
              "path",
              fixture.items,
              unrelated.food,
              unrelated.storage,
              fixture.ledger,
              fixture.core,
            );
      expect(result).toStrictEqual({ ok: false, reason: "eating_step_invalid" });
      expect({
        items: fixture.items.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
        core: fixture.core.createSnapshot(),
        eating: fixture.eating.createSnapshot(),
      }).toStrictEqual(before);
    },
  );

  it("uses exact fffb-through-ffff driver headroom for adopted terminal closure", () => {
    for (const version of [0xffff_fffb, 0xffff_fffc]) {
      const fixture = createAdoptedEatingFixture(version);
      expect(fixture.adopted.ok).toBe(true);
      const output = createEatingMutationOutput();
      fixture.eating.terminalAdoptedInto(
        {
          jobId: fixture.token.jobId,
          jobGeneration: fixture.token.jobGeneration,
          owner: fixture.owner,
          expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
          expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
          expectedDriverVersion: fixture.adopted.driverVersion,
          expectedCurrentLedgerVersion: fixture.ledger.version,
          tick: 102,
          outcome: "canceled",
          failureReason: "cancelled",
          itemAddition: createEatingItemAddition(fixture, 1),
        },
        fixture.items,
        fixture.ledger,
        fixture.core,
        fixture.claims,
        output,
      );
      expect(output).toMatchObject({ ok: true, driverVersion: version + 3 });
    }
    const terminalRejected = createAdoptedEatingFixture(0xffff_fffd);
    const beforeTerminal = terminalRejected.eating.createSnapshot();
    const rejectedOutput = createEatingMutationOutput();
    terminalRejected.eating.terminalAdoptedInto(
      {
        jobId: terminalRejected.token.jobId,
        jobGeneration: terminalRejected.token.jobGeneration,
        owner: terminalRejected.owner,
        expectedJobSlotVersion: terminalRejected.adopted.jobSlotVersion,
        expectedJobCoreVersion: terminalRejected.adopted.jobCoreVersion,
        expectedDriverVersion: terminalRejected.adopted.driverVersion,
        expectedCurrentLedgerVersion: terminalRejected.ledger.version,
        tick: 102,
        outcome: "canceled",
        failureReason: "cancelled",
        itemAddition: createEatingItemAddition(terminalRejected, 1),
      },
      terminalRejected.items,
      terminalRejected.ledger,
      terminalRejected.core,
      terminalRejected.claims,
      rejectedOutput,
    );
    expect(rejectedOutput).toMatchObject({ ok: false, reason: "eating_version_exhausted" });
    expect(terminalRejected.eating.createSnapshot()).toStrictEqual(beforeTerminal);
    for (const version of [0xffff_fffe, 0xffff_ffff]) {
      const fixture = createAdoptedEatingFixture(version);
      expect(fixture.adopted).toMatchObject({ ok: false, reason: "eating_version_exhausted" });
    }
  });

  it("clears terminal audit when the same slot is adopted by a new generation", () => {
    const fixture = createAdoptedEatingFixture();
    const terminal = createEatingMutationOutput();
    fixture.eating.terminalAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 102,
        outcome: "failed",
        failureReason: "path",
        itemAddition: createEatingItemAddition(fixture, 1),
      },
      fixture.items,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      terminal,
    );
    expect(terminal.ok).toBe(true);

    const token = createTokenOutputForAdoption();
    fixture.core.reserveAutonomyJobTokenInto(fixture.core.version, fixture.owner, token);
    expect(token).toMatchObject({ ok: true, jobId: fixture.token.jobId, jobGeneration: 2 });
    const acquired = fixture.ledger.acquire(
      {
        owner: fixture.owner,
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        createdTick: 103,
        leaseExpiryTick: 403,
        claims: [
          { channel: "item_quantity", item: fixture.itemEntity, amount: 1, availableAmount: 3 },
          { channel: "interaction_spot", target: fixture.itemEntity, spotId: 7 },
        ],
      },
      fixture.registry,
    );
    if (!acquired.ok) throw new Error(acquired.reason);
    const ids = new Uint32Array(8);
    ids.fill(RESERVATION_CLAIM_NONE);
    const epochs = new Uint32Array(8);
    for (let index = 0; index < 2; index += 1) {
      ids[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
      epochs[index] = acquired.version;
    }
    const claims = createEatingClaims(fixture.owner, token.jobId, token.jobGeneration, 103);
    fixture.ledger.readActiveClaimsInto(
      ids,
      epochs,
      2,
      fixture.owner,
      token.jobId,
      token.jobGeneration,
      acquired.version,
      claims,
    );
    const adopted = createDriverOutput();
    fixture.eating.adoptExistingClaimsInto(
      {
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        ownerIndex: fixture.owner.index,
        ownerGeneration: fixture.owner.generation,
        expectedJobSlotVersion: token.slotVersion,
        expectedJobCoreVersion: fixture.core.version,
        expectedDriverVersion: terminal.driverVersion,
        claimCount: 2,
        claimIds: ids,
        claimEpochs: epochs,
        claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
        claimCreatedTick: 103,
        adoptionTick: 104,
        reservationReadVersion: acquired.version,
      },
      {
        jobId: token.jobId,
        owner: fixture.owner,
        sourceStackId: 2,
        storageSlotId: 5,
        foodDefId: GRAIN_BOWL,
        amount: 1,
        hungerRestore: 40,
        itemStoreVersion: fixture.items.version,
        foodAvailabilityVersion: 1,
        mealWindowVersion: 1,
        abilityAllowed: true,
        createdTick: 103,
        itemEntity: fixture.itemEntity,
        interactionSpotId: 7,
        readClaimIds: ids,
        readClaimEpochs: epochs,
        claims,
      },
      fixture.core,
      adopted,
    );
    expect(adopted.ok).toBe(true);
    const snapshot = fixture.eating.createSnapshot();
    expect(snapshot.rows[token.jobId]).toMatchObject({
      jobGeneration: 2,
      active: 1,
      effectPhase: 0,
      stepCode: 2,
      terminalReasonCode: 0,
    });
    expect(restoreM3EatingJobDriverStore(snapshot).createSnapshot()).toStrictEqual(snapshot);
  });

  it("rejects old or incoherent eating snapshots atomically", () => {
    const fixture = createAdoptedEatingFixture();
    const snapshot = fixture.eating.createSnapshot();
    expect(fixture.eating.restoreFromSnapshot({ ...snapshot, snapshotVersion: 0 })).toStrictEqual({
      ok: false,
      reason: "eating_snapshot_invalid",
    });
    expect(fixture.eating.createSnapshot()).toStrictEqual(snapshot);

    const snapshotRow = snapshot.rows[fixture.token.jobId];
    if (snapshotRow === undefined) throw new Error("missing reserved eating row");
    const rows = copyWithReplacement(snapshot.rows, fixture.token.jobId, {
      ...snapshotRow,
      carriedDefId: GRAIN_BOWL,
      carriedAmount: 1,
    });
    expect(fixture.eating.restoreFromSnapshot({ ...snapshot, rows })).toStrictEqual({
      ok: false,
      reason: "eating_snapshot_invalid",
    });
    expect(fixture.eating.createSnapshot()).toStrictEqual(snapshot);

    const zeroGenerationRows = copyWithReplacement(snapshot.rows, fixture.token.jobId, {
      ...snapshotRow,
      jobGeneration: 0,
    });
    expect(
      fixture.eating.restoreFromSnapshot({ ...snapshot, rows: zeroGenerationRows }),
    ).toStrictEqual({ ok: false, reason: "eating_snapshot_invalid" });
    expect(fixture.eating.createSnapshot()).toStrictEqual(snapshot);

    const reasonRows = copyWithReplacement(snapshot.rows, fixture.token.jobId, {
      ...snapshotRow,
      terminalReasonCode: 5,
    });
    expect(fixture.eating.restoreFromSnapshot({ ...snapshot, rows: reasonRows })).toStrictEqual({
      ok: false,
      reason: "eating_snapshot_invalid",
    });
    expect(fixture.eating.createSnapshot()).toStrictEqual(snapshot);
  });

  it("rejects positive-row conservation and cumulative counter corruption", () => {
    const reservedFixture = createAdoptedEatingFixture();
    const reserved = reservedFixture.eating.createSnapshot();
    const reservedRow = reserved.rows[reservedFixture.token.jobId];
    if (reservedRow === undefined) throw new Error("missing reserved eating row");
    const reservedCorruptions = [
      { ...reservedRow, amount: 0 },
      { ...reservedRow, abilityAllowed: 0 },
      { ...reservedRow, hungerRestore: 0x8000_0000 },
      { ...reservedRow, claimIds: [reservedRow.claimIds[0] ?? 0, reservedRow.claimIds[0] ?? 0] },
      { ...reservedRow, lastEffectTick: reservedRow.lastEffectTick + 1 },
    ];
    for (const corrupted of reservedCorruptions) {
      const rows = copyWithReplacement(reserved.rows, corrupted.jobId, corrupted);
      expect(
        createM3EatingJobDriverStore(reserved.capacity).restoreFromSnapshot({ ...reserved, rows }),
      ).toMatchObject({ ok: false });
    }
    expect(
      createM3EatingJobDriverStore(reserved.capacity).restoreFromSnapshot({
        ...reserved,
        reservationFailures: reserved.reservationAttempts + 1,
      }),
    ).toMatchObject({ ok: false });

    const pickedFixture = createAdoptedEatingFixture();
    expect(pickupAdoptedEating(pickedFixture).ok).toBe(true);
    const picked = pickedFixture.eating.createSnapshot();
    const pickedRow = picked.rows[pickedFixture.token.jobId];
    if (pickedRow === undefined) throw new Error("missing picked eating row");
    const pickedRows = copyWithReplacement(picked.rows, pickedFixture.token.jobId, {
      ...pickedRow,
      carriedAmount: pickedRow.amount + 1,
    });
    expect(
      createM3EatingJobDriverStore(picked.capacity).restoreFromSnapshot({
        ...picked,
        rows: pickedRows,
      }),
    ).toMatchObject({ ok: false });

    const pendingFixture = createAdoptedEatingFixture();
    const pickup = pickupAdoptedEating(pendingFixture);
    const liveLedger = pendingFixture.ledger.createSnapshot();
    expect(
      pendingFixture.ledger.restoreFromSnapshot(
        { ...liveLedger, ledgerVersion: 0xffff_ffff },
        pendingFixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const output = createEatingMutationOutput();
    pendingFixture.eating.consumeAdoptedInto(
      {
        jobId: pendingFixture.token.jobId,
        jobGeneration: pendingFixture.token.jobGeneration,
        owner: pendingFixture.owner,
        expectedJobSlotVersion: pickup.jobSlotVersion,
        expectedJobCoreVersion: pickup.jobCoreVersion,
        expectedDriverVersion: pickup.driverVersion,
        expectedCurrentLedgerVersion: pendingFixture.ledger.version,
        tick: 103,
        needMutation: createEatingNeedMutation(pendingFixture, 103),
      },
      pendingFixture.needs,
      pendingFixture.ledger,
      pendingFixture.core,
      pendingFixture.claims,
      output,
    );
    const pending = pendingFixture.eating.createSnapshot();
    expect(
      createM3EatingJobDriverStore(pending.capacity).restoreFromSnapshot({
        ...pending,
        cumulativeConsumedCount: 0,
      }),
    ).toMatchObject({ ok: false });
    const pendingBefore = pendingFixture.eating.createSnapshot();
    const pendingHash = formatCanonicalWorldHash({
      fields: createM3EatingJobHashFields(pendingBefore),
      randomStreams: [],
      queuedCommands: [],
    });
    expect(
      pendingFixture.eating.restoreFromSnapshot({ ...pending, consumedAmountTotal: 0 }),
    ).toMatchObject({ ok: false });
    expect(pendingFixture.eating.createSnapshot()).toStrictEqual(pendingBefore);
    expect(
      formatCanonicalWorldHash({
        fields: createM3EatingJobHashFields(pendingFixture.eating.createSnapshot()),
        randomStreams: [],
        queuedCommands: [],
      }),
    ).toBe(pendingHash);
    const pendingRow = pending.rows[pendingFixture.token.jobId];
    if (pendingRow === undefined) throw new Error("missing pending eating row");
    const pendingRows = copyWithReplacement(pending.rows, pendingFixture.token.jobId, {
      ...pendingRow,
      consumedDefId: pendingRow.foodDefId + 1,
    });
    expect(
      createM3EatingJobDriverStore(pending.capacity).restoreFromSnapshot({
        ...pending,
        rows: pendingRows,
      }),
    ).toMatchObject({ ok: false });

    const consumedRow = pending.rows[pendingFixture.token.jobId];
    let secondRow = pending.rows[0];
    if (secondRow?.jobId === pendingFixture.token.jobId) secondRow = pending.rows[1];
    if (consumedRow === undefined || secondRow === undefined)
      throw new Error("missing rows for consumed sum overflow");
    let overflowRows = copyWithReplacement(pending.rows, consumedRow.jobId, {
      ...consumedRow,
      amount: 0xffff_ffff,
      consumedAmount: 0xffff_ffff,
    });
    overflowRows = copyWithReplacement(overflowRows, secondRow.jobId, {
      ...consumedRow,
      jobId: secondRow.jobId,
      amount: 0xffff_ffff,
      consumedAmount: 0xffff_ffff,
    });
    expect(
      createM3EatingJobDriverStore(pending.capacity).restoreFromSnapshot({
        ...pending,
        activeCount: 2,
        cumulativeConsumedCount: 2,
        consumedAmountTotal: 0xffff_ffff,
        rows: overflowRows,
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects duplicate calls when committed JobCore payload Tick differs", () => {
    const running = createAdoptedEatingFixture();
    const pickup = pickupAdoptedEating(running);
    const runningSnapshot = running.eating.createSnapshot();
    const runningRow = runningSnapshot.rows[running.token.jobId];
    if (runningRow === undefined) throw new Error("missing running eating row");
    const runningRows = copyWithReplacement(runningSnapshot.rows, running.token.jobId, {
      ...runningRow,
      stepEnteredTick: runningRow.stepEnteredTick + 1,
      lastEffectTick: runningRow.lastEffectTick + 1,
    });
    const driftedRunning = restoreM3EatingJobDriverStore({ ...runningSnapshot, rows: runningRows });
    const runningBefore = {
      items: running.items.createSnapshot(),
      core: running.core.createSnapshot(),
      eating: driftedRunning.createSnapshot(),
      ledger: running.ledger.createSnapshot(),
    };
    const output = createEatingMutationOutput();
    driftedRunning.pickupAdoptedInto(
      createEatingPickupInput(running, pickup, 104),
      running.items,
      running.ledger,
      running.core,
      running.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    expect({
      items: running.items.createSnapshot(),
      core: running.core.createSnapshot(),
      eating: driftedRunning.createSnapshot(),
      ledger: running.ledger.createSnapshot(),
    }).toStrictEqual(runningBefore);

    const terminal = createAdoptedEatingFixture();
    terminal.eating.terminalAdoptedInto(
      {
        jobId: terminal.token.jobId,
        jobGeneration: terminal.token.jobGeneration,
        owner: terminal.owner,
        expectedJobSlotVersion: terminal.adopted.jobSlotVersion,
        expectedJobCoreVersion: terminal.adopted.jobCoreVersion,
        expectedDriverVersion: terminal.adopted.driverVersion,
        expectedCurrentLedgerVersion: terminal.ledger.version,
        tick: 102,
        outcome: "canceled",
        failureReason: "cancelled",
        itemAddition: createEatingItemAddition(terminal, 1),
      },
      terminal.items,
      terminal.ledger,
      terminal.core,
      terminal.claims,
      output,
    );
    const terminalBasis = {
      jobSlotVersion: output.jobSlotVersion,
      jobCoreVersion: output.jobCoreVersion,
      driverVersion: output.driverVersion,
    };
    const terminalSnapshot = terminal.eating.createSnapshot();
    const terminalRow = terminalSnapshot.rows[terminal.token.jobId];
    if (terminalRow === undefined) throw new Error("missing terminal eating row");
    const terminalRows = copyWithReplacement(terminalSnapshot.rows, terminal.token.jobId, {
      ...terminalRow,
      stepEnteredTick: terminalRow.stepEnteredTick + 1,
    });
    const driftedTerminal = restoreM3EatingJobDriverStore({
      ...terminalSnapshot,
      rows: terminalRows,
    });
    const terminalBefore = {
      items: terminal.items.createSnapshot(),
      core: terminal.core.createSnapshot(),
      eating: driftedTerminal.createSnapshot(),
      ledger: terminal.ledger.createSnapshot(),
    };
    driftedTerminal.terminalAdoptedInto(
      {
        jobId: terminal.token.jobId,
        jobGeneration: terminal.token.jobGeneration,
        owner: terminal.owner,
        expectedJobSlotVersion: terminalBasis.jobSlotVersion,
        expectedJobCoreVersion: terminalBasis.jobCoreVersion,
        expectedDriverVersion: terminalBasis.driverVersion,
        expectedCurrentLedgerVersion: terminal.ledger.version,
        tick: 104,
        outcome: "canceled",
        failureReason: "cancelled",
        itemAddition: createEatingItemAddition(terminal, 1),
      },
      terminal.items,
      terminal.ledger,
      terminal.core,
      terminal.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "eating_step_invalid" });
    expect({
      items: terminal.items.createSnapshot(),
      core: terminal.core.createSnapshot(),
      eating: driftedTerminal.createSnapshot(),
      ledger: terminal.ledger.createSnapshot(),
    }).toStrictEqual(terminalBefore);
  });
  it("reads reusable flat portion facts and exposes dirty backlog without a version advance", () => {
    const fixture = createFoodFixture(1, 3);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const output = createFoodPortionIntoOutput();
    const identity = output;
    const legacy = fixture.food.readPortion(0) ?? failMissingPortion();

    fixture.food.readPortionInto(0, output);
    expect(output).toEqual({
      ok: true,
      reason: undefined,
      ...legacy,
      active: true,
      dirtyBacklog: 0,
    });
    expect(output).toBe(identity);

    const versionBeforeDirty = fixture.food.version;
    expect(fixture.food.markStackDirty(0)).toEqual({
      ok: true,
      stackId: 0,
      version: versionBeforeDirty,
    });
    expect(fixture.food.version).toBe(versionBeforeDirty);
    fixture.food.readPortionInto(0, output);
    expect(output).toMatchObject({
      ok: true,
      reason: undefined,
      stackId: 0,
      foodAvailabilityVersion: versionBeforeDirty,
      active: true,
      linkedCandidate: true,
      dirtyBacklog: 1,
    });
    expect(output).toBe(identity);

    const dirtyStore = createM3FoodAvailabilityStore(2, 4, 4);
    expect(
      dirtyStore.configurePortion({
        stackId: 0,
        foodDefId: GRAIN_BOWL,
        regionId: REGION_YARD,
        storageSlotId: 0,
        targetCellIndex: 0,
        interactionSpotId: 20,
        scoreMilli: 10_000,
        permissionId: PUBLIC_PERMISSION,
        mealWindowId: MIDDAY_MEAL,
        mealWindowVersion: 1,
        safe: true,
        permissionAllowed: true,
        scheduleAllowed: true,
      }),
    ).toEqual({ ok: true, stackId: 0, version: 1 });
    expect(dirtyStore.createMetrics()).toMatchObject({ version: 1, dirtyBacklog: 1 });

    dirtyStore.readPortionInto(1, output);
    expect(output).toEqual({
      ok: false,
      reason: "food_stack_not_registered",
      stackId: 1,
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
      foodAvailabilityVersion: 1,
      active: false,
      linkedCandidate: false,
      dirtyBacklog: 1,
    });
    expect(output).toBe(identity);

    dirtyStore.readPortionInto(-1, output);
    expect(output).toEqual({
      ok: false,
      reason: "food_stack_id_out_of_range",
      stackId: -1,
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
      foodAvailabilityVersion: 1,
      active: false,
      linkedCandidate: false,
      dirtyBacklog: 1,
    });
    expect(output).toBe(identity);
  });

  it("selects caller-owned food candidates in stable score and source-row order", () => {
    const fixture = createFoodFixture(3, 2);
    updateFoodPortionConfig(fixture, 0, {
      regionId: 2,
      interactionSpotId: 20,
      targetCellIndex: 9,
      scoreMilli: 900,
      permissionId: 1,
      mealWindowId: 3,
      mealWindowVersion: 11,
    });
    updateFoodPortionConfig(fixture, 1, {
      regionId: 2,
      interactionSpotId: 21,
      targetCellIndex: 1,
      scoreMilli: 900,
      permissionId: 1,
      mealWindowId: 3,
      mealWindowVersion: 12,
    });
    updateFoodPortionConfig(fixture, 2, {
      regionId: 2,
      interactionSpotId: 22,
      targetCellIndex: 7,
      scoreMilli: 1_000,
      permissionId: 1,
      mealWindowId: 3,
      mealWindowVersion: 13,
    });
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const query = createFoodCandidateQuery({
      regionId: 2,
      permissionId: 1,
      mealWindowId: 3,
    });
    const legacyIds = new Uint32Array(M3_FOOD_DEFAULT_SELECTED_CAP);
    const legacy = fixture.food.selectCandidates(query, legacyIds);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy food selection failure: ${legacy.reason}`);
    }

    const scratch = createFoodSelectionScratch();
    const output = createFoodSelectionOutput();
    const scratchIdentity = scratch;
    const stackLaneIdentity = scratch.stackIds;
    const outputIdentity = output;
    fixture.food.selectCandidatesInto(query, scratch, output);
    const first = fixture.food.readPortion(2) ?? failMissingPortion();

    expect(output).toEqual({
      ok: true,
      reason: legacy.reason,
      queryFoodDefId: query.foodDefId,
      queryRegionId: query.regionId,
      queryPermissionId: query.permissionId,
      queryMealWindowId: query.mealWindowId,
      candidateCap: query.candidateCap,
      maxSelected: query.maxSelected,
      bucketCandidateCount: legacy.bucketCandidateCount,
      visitedCount: legacy.visitedCount,
      selectedCount: legacy.selectedCount,
      candidateCapHit: legacy.candidateCapHit,
      selectedCapHit: legacy.selectedCapHit,
      selectedStackId: first.stackId,
      selectedFoodDefId: first.foodDefId,
      selectedRegionId: first.regionId,
      selectedStorageSlotId: first.storageSlotId,
      selectedTargetCellIndex: first.targetCellIndex,
      selectedInteractionSpotId: first.interactionSpotId,
      selectedScoreMilli: first.scoreMilli,
      selectedPermissionId: first.permissionId,
      selectedMealWindowId: first.mealWindowId,
      selectedMealWindowVersion: first.mealWindowVersion,
      selectedSafe: first.safe,
      selectedPermissionAllowed: first.permissionAllowed,
      selectedScheduleAllowed: first.scheduleAllowed,
      selectedAvailableAmount: first.availableAmount,
      sourceItemVersion: first.itemStoreVersion,
      selectedLinkedCandidate: first.linkedCandidate,
      foodAvailabilityVersion: first.foodAvailabilityVersion,
      dirtyBacklog: 0,
    });
    expect(Array.from(legacyIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.stackIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.scoreMillis.subarray(0, 3))).toEqual([1_000, 900, 900]);
    expect(Array.from(scratch.targetCellIndexes.subarray(0, 3))).toEqual([7, 9, 1]);
    expect(Array.from(scratch.itemStoreVersions.subarray(0, 3))).toEqual([
      fixture.items.version,
      fixture.items.version,
      fixture.items.version,
    ]);
    expect(Array.from(scratch.mealWindowVersions.subarray(0, 3))).toEqual([13, 11, 12]);
    expect(Array.from(scratch.permissionAllowedFlags.subarray(0, 3))).toEqual([1, 1, 1]);
    expect(Array.from(scratch.scheduleAllowedFlags.subarray(0, 3))).toEqual([1, 1, 1]);
    for (let index = 0; index < output.selectedCount; index += 1) {
      const stackId = scratch.stackIds[index] ?? M3_FOOD_STACK_NONE;
      const portion = fixture.food.readPortion(stackId) ?? failMissingPortion();
      expect(scratch.stackIds[index]).toBe(portion.stackId);
      expect(scratch.foodDefIds[index]).toBe(portion.foodDefId);
      expect(scratch.regionIds[index]).toBe(portion.regionId);
      expect(scratch.storageSlotIds[index]).toBe(portion.storageSlotId);
      expect(scratch.targetCellIndexes[index]).toBe(portion.targetCellIndex);
      expect(scratch.interactionSpotIds[index]).toBe(portion.interactionSpotId);
      expect(scratch.scoreMillis[index]).toBe(portion.scoreMilli);
      expect(scratch.permissionIds[index]).toBe(portion.permissionId);
      expect(scratch.mealWindowIds[index]).toBe(portion.mealWindowId);
      expect(scratch.mealWindowVersions[index]).toBe(portion.mealWindowVersion);
      expect(scratch.safeFlags[index]).toBe(portion.safe ? 1 : 0);
      expect(scratch.permissionAllowedFlags[index]).toBe(portion.permissionAllowed ? 1 : 0);
      expect(scratch.scheduleAllowedFlags[index]).toBe(portion.scheduleAllowed ? 1 : 0);
      expect(scratch.availableAmounts[index]).toBe(portion.availableAmount);
      expect(scratch.itemStoreVersions[index]).toBe(portion.itemStoreVersion);
      expect(scratch.linkedCandidateFlags[index]).toBe(portion.linkedCandidate ? 1 : 0);
    }
    expect(output).toBe(outputIdentity);
    expect(scratch).toBe(scratchIdentity);
    expect(scratch.stackIds).toBe(stackLaneIdentity);
  });

  it("honors smaller caller caps and the fixed 24/12 food bounds", () => {
    const fixture = createFoodFixture(30);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const scratch = createFoodSelectionScratch();
    const output = createFoodSelectionOutput();
    const fullQuery = createFoodCandidateQuery();

    fixture.food.selectCandidatesInto(fullQuery, scratch, output);
    expect(output).toMatchObject({
      ok: true,
      reason: "trace.candidate_cap_reached",
      bucketCandidateCount: 30,
      visitedCount: 24,
      selectedCount: 12,
      candidateCapHit: true,
      selectedCapHit: true,
      selectedStackId: 0,
      dirtyBacklog: 0,
    });
    expect(Array.from(scratch.stackIds)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const smallQuery = createFoodCandidateQuery({ candidateCap: 3, maxSelected: 2 });
    const legacyIds = new Uint32Array(M3_FOOD_DEFAULT_SELECTED_CAP);
    const legacy = fixture.food.selectCandidates(smallQuery, legacyIds);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy food selection failure: ${legacy.reason}`);
    }
    fixture.food.selectCandidatesInto(smallQuery, scratch, output);
    expect(output).toMatchObject({
      ok: true,
      reason: legacy.reason,
      bucketCandidateCount: legacy.bucketCandidateCount,
      visitedCount: legacy.visitedCount,
      selectedCount: legacy.selectedCount,
      candidateCapHit: legacy.candidateCapHit,
      selectedCapHit: legacy.selectedCapHit,
      candidateCap: 3,
      maxSelected: 2,
    });
    expect(Array.from(scratch.stackIds.subarray(0, 4))).toEqual([
      legacyIds[0],
      legacyIds[1],
      M3_FOOD_STACK_NONE,
      M3_FOOD_STACK_NONE,
    ]);
    expect(scratch.scoreMillis[2]).toBe(0);
    expect(scratch.itemStoreVersions[11]).toBe(0);
    expect(scratch.permissionAllowedFlags[11]).toBe(0);
  });

  it("rejects invalid caps and every undersized food scratch lane before traversal", () => {
    const fixture = createFoodFixture(1);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const metricsBefore = fixture.food.createMetrics();
    const invalidQueries = [
      {
        query: createFoodCandidateQuery({ candidateCap: 25 }),
        reason: "food_candidate_cap_invalid" as const,
      },
      {
        query: createFoodCandidateQuery({ maxSelected: 13 }),
        reason: "food_selected_cap_invalid" as const,
      },
    ];

    for (const invalid of invalidQueries) {
      const scratch = createFoodSelectionScratch();
      const output = createFoodSelectionOutput();
      fixture.food.selectCandidatesInto(invalid.query, scratch, output);
      expect(output).toEqual(
        createFoodSelectionResetOutput(invalid.query, fixture.food.version, 0, invalid.reason),
      );
      expectFoodSelectionScratchReset(scratch);
    }

    for (const lane of FOOD_SELECTION_SCRATCH_LANES) {
      const query = createFoodCandidateQuery();
      const scratch = createFoodSelectionScratch(lane);
      const output = createFoodSelectionOutput();
      fixture.food.selectCandidatesInto(query, scratch, output);
      expect(output).toEqual(
        createFoodSelectionResetOutput(
          query,
          fixture.food.version,
          0,
          "food_candidate_buffer_too_small",
        ),
      );
      expectFoodSelectionScratchReset(scratch);
    }
    expect(fixture.food.createMetrics()).toEqual(metricsBefore);
  });

  it("rejects a dirty food index even when its owner version did not advance", () => {
    const fixture = createFoodFixture(1);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    const versionBeforeDirty = fixture.food.version;
    const metricsBefore = fixture.food.createMetrics();
    expect(fixture.food.markStackDirty(0)).toEqual({
      ok: true,
      stackId: 0,
      version: versionBeforeDirty,
    });
    const query = createFoodCandidateQuery();
    const scratch = createFoodSelectionScratch();
    const output = createFoodSelectionOutput();
    const outputIdentity = output;

    fixture.food.selectCandidatesInto(query, scratch, output);
    expect(output).toEqual(
      createFoodSelectionResetOutput(query, versionBeforeDirty, 1, "food_dirty_backlog"),
    );
    expect(output).toBe(outputIdentity);
    expectFoodSelectionScratchReset(scratch);
    expect(fixture.food.version).toBe(versionBeforeDirty);
    expect(fixture.food.createMetrics()).toMatchObject({
      lastCandidateCount: metricsBefore.lastCandidateCount,
      lastVisitedCount: metricsBefore.lastVisitedCount,
      lastSelectedCount: metricsBefore.lastSelectedCount,
      dirtyBacklog: 1,
    });
  });

  it("selects edible resources through bounded indexed candidates and Top-K path evidence", () => {
    const fixture = createFoodFixture(30);
    const grid = createMapGrid({ width: 8, height: 4, chunkSize: 4 });
    const pathfinder = createGridPathfinder(grid.cellCount);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);

    const selected = resolveM3FoodPathCandidate(fixture.food, pathfinder, grid, {
      originCellIndex: 0,
      query: {
        foodDefId: GRAIN_BOWL,
        regionId: REGION_YARD,
        permissionId: PUBLIC_PERMISSION,
        mealWindowId: MIDDAY_MEAL,
        candidateCap: M3_FOOD_DEFAULT_CANDIDATE_CAP,
        maxSelected: M3_FOOD_DEFAULT_SELECTED_CAP,
      },
      maxExactPaths: M3_FOOD_DEFAULT_EXACT_PATH_CAP,
      basis: createBasis(grid),
      issuedTick: 10,
      requestSequenceStart: 1,
      stackIdBuffer: new Uint32Array(M3_FOOD_DEFAULT_SELECTED_CAP),
    });

    expect(selected).toMatchObject({
      ok: true,
      stackId: 0,
      candidateCount: 30,
      visitedCount: 24,
      selectedCount: 12,
      exactPathCount: 4,
      candidateCapHit: true,
      exactPathCapHit: true,
      reason: "trace.candidate_cap_reached",
    });
    expect(fixture.food.createMetrics()).toMatchObject({
      indexedCandidateCount: 30,
      lastCandidateCount: 30,
      lastVisitedCount: 24,
      lastSelectedCount: 12,
      lastExactPathCount: 4,
      lastCandidateCapHit: true,
    });
  });

  it("reserves item quantity and interaction spot atomically before pickup", () => {
    const fixture = createFoodFixture(1);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 0, 0)).toMatchObject({ ok: true });

    const stack = fixture.items.readStack(0) ?? failMissingStack();
    expect(
      fixture.ledger.acquire(
        {
          owner: fixture.actors[1] ?? failMissingEntity(),
          jobId: 99,
          createdTick: 1,
          leaseExpiryTick: 300,
          claims: [
            {
              channel: "interaction_spot",
              target: stack.entity,
              spotId: 20,
            },
          ],
        },
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });

    expect(
      fixture.eating.reserveBeforePickup(
        0,
        2,
        fixture.registry,
        fixture.items,
        fixture.food,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toStrictEqual({ ok: false, reason: "reservation.interaction_spot_conflict" });
    expect(fixture.ledger.createMetrics()).toMatchObject({
      activeCount: 1,
      itemQuantityReservationCount: 0,
      interactionReservationCount: 1,
    });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 1 });
    expect(fixture.eating.readJob(0)).toMatchObject({ step: "created", carriedAmount: 0 });
  });

  it("consumes exactly one integer portion once and conserves storage carried consumed lanes", () => {
    const fixture = createFoodFixture(1, 3);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(totalFood(fixture)).toBe(3);

    expect(reserve(fixture, 0, 1)).toMatchObject({ ok: true, reason: "food.job_reserved" });
    expect(pickup(fixture, 0, 2)).toMatchObject({ ok: true, reason: "food.job_picked_up" });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(totalFood(fixture)).toBe(3);

    expect(
      fixture.eating.consume(
        0,
        3,
        fixture.needs,
        fixture.ledger,
        fixture.jobCore,
        fixture.needIndex,
      ),
    ).toMatchObject({ ok: true, reason: "food.consumed_integer_portion" });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.eating.readJob(0)).toMatchObject({
      step: "consumed",
      carriedAmount: 0,
      consumedDefId: GRAIN_BOWL,
      consumedAmount: 1,
      terminalReason: "food.consumed_integer_portion",
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({ status: "completed", carriedAmount: 0 });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.needs.readLaneValue(0, NEED_LANE_HUNGER)).toBe(360);
    expect(totalFood(fixture)).toBe(3);

    expect(
      fixture.eating.consume(0, 4, fixture.needs, fixture.ledger, fixture.jobCore),
    ).toStrictEqual({ ok: false, reason: "eating_step_invalid" });
    expect(totalFood(fixture)).toBe(3);
  });

  it("returns carried food and releases reservations on cancellation after pickup", () => {
    const fixture = createFoodFixture(1, 2);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(reserve(fixture, 0, 1)).toMatchObject({ ok: true });
    expect(pickup(fixture, 0, 2)).toMatchObject({ ok: true });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 1 });

    expect(
      fixture.eating.cancel(
        0,
        3,
        fixture.items,
        fixture.food,
        fixture.storage,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "food.job_canceled" });
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.eating.readJob(0)).toMatchObject({
      step: "canceled",
      carriedAmount: 0,
      consumedAmount: 0,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(totalFood(fixture)).toBe(2);
  });

  it("rejects out-of-range hunger restore before job state can split", () => {
    const fixture = createFoodFixture(1, 2);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);

    expect(createEatingJobFromPortion(fixture, 0, 0, 0, true, 0xffff_ffff)).toStrictEqual({
      ok: false,
      reason: "eating_need_delta_invalid",
    });

    expect(fixture.eating.readJob(0)).toBeUndefined();
    expect(fixture.jobCore.readJob(0)).toBeUndefined();
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 2 });
    expect(fixture.needs.readLaneValue(0, NEED_LANE_HUNGER)).toBe(280);
    expect(totalFood(fixture)).toBe(2);
  });

  it("does not complete or release reservations when consume need validation fails", () => {
    const fixture = createFoodFixture(1, 2);
    fixture.food.rebuildFromStores(fixture.items, fixture.ledger);
    expect(createEatingJobFromPortion(fixture, 0, 1, 0)).toMatchObject({ ok: true });
    expect(reserve(fixture, 0, 1)).toMatchObject({ ok: true });
    expect(pickup(fixture, 0, 2)).toMatchObject({ ok: true });

    expect(
      fixture.eating.consume(0, 3, fixture.needs, fixture.ledger, fixture.jobCore),
    ).toStrictEqual({ ok: false, reason: "eating_need_mutation_failed" });

    expect(fixture.eating.readJob(0)).toMatchObject({
      step: "picked_up",
      carriedDefId: GRAIN_BOWL,
      carriedAmount: 1,
      consumedAmount: 0,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({
      status: "running",
      step: "interact",
      carriedDefId: GRAIN_BOWL,
      carriedAmount: 1,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);
    expect(fixture.items.readStack(0)).toMatchObject({ quantity: 1 });
    expect(totalFood(fixture)).toBe(2);
  });

  it("emits structured no-food permission schedule ability stale-owner and path reasons", () => {
    const emptyFixture = createFoodFixture(0);
    const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    expect(
      resolveM3FoodPathCandidate(emptyFixture.food, createGridPathfinder(grid.cellCount), grid, {
        originCellIndex: 0,
        query: {
          foodDefId: GRAIN_BOWL,
          regionId: REGION_YARD,
          permissionId: PUBLIC_PERMISSION,
          mealWindowId: MIDDAY_MEAL,
          candidateCap: 4,
          maxSelected: 2,
        },
        maxExactPaths: 2,
        basis: createBasis(grid),
        issuedTick: 0,
        requestSequenceStart: 1,
        stackIdBuffer: new Uint32Array(2),
      }),
    ).toMatchObject({ ok: false, reason: "food.rejected_no_available_portion" });

    const permissionFixture = createFoodFixture(1, 1, { permissionAllowed: false });
    permissionFixture.food.rebuildFromStores(permissionFixture.items, permissionFixture.ledger);
    expect(createEatingJobFromPortion(permissionFixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(reserve(permissionFixture, 0, 1)).toStrictEqual({
      ok: false,
      reason: "food.rejected_permission",
    });

    const scheduleFixture = createFoodFixture(1, 1, { scheduleAllowed: false });
    scheduleFixture.food.rebuildFromStores(scheduleFixture.items, scheduleFixture.ledger);
    expect(createEatingJobFromPortion(scheduleFixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(reserve(scheduleFixture, 0, 1)).toStrictEqual({
      ok: false,
      reason: "food.rejected_schedule",
    });

    const abilityFixture = createFoodFixture(1);
    abilityFixture.food.rebuildFromStores(abilityFixture.items, abilityFixture.ledger);
    expect(createEatingJobFromPortion(abilityFixture, 0, 0, 0, false)).toStrictEqual({
      ok: false,
      reason: "food.rejected_ability",
    });

    const staleFixture = createFoodFixture(1);
    staleFixture.food.rebuildFromStores(staleFixture.items, staleFixture.ledger);
    expect(createEatingJobFromPortion(staleFixture, 0, 0, 0)).toMatchObject({ ok: true });
    expect(staleFixture.items.addQuantity(0, 1, GRAIN_BOWL)).toMatchObject({ ok: true });
    staleFixture.food.markStackDirty(0);
    staleFixture.food.refreshDirty(staleFixture.items, staleFixture.ledger, 1);
    expect(reserve(staleFixture, 0, 2)).toStrictEqual({
      ok: false,
      reason: "food.rejected_stale_owner",
    });

    const blockedGrid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
    expect(blockedGrid.updateCell(1, 0, { terrain: MAP_TERRAIN_BLOCKED })).toMatchObject({
      ok: true,
    });
    const pathFixture = createFoodFixture(1, 1, { targetCellIndex: 1 });
    pathFixture.food.rebuildFromStores(pathFixture.items, pathFixture.ledger);
    expect(
      resolveM3FoodPathCandidate(
        pathFixture.food,
        createGridPathfinder(blockedGrid.cellCount),
        blockedGrid,
        {
          originCellIndex: 0,
          query: {
            foodDefId: GRAIN_BOWL,
            regionId: REGION_YARD,
            permissionId: PUBLIC_PERMISSION,
            mealWindowId: MIDDAY_MEAL,
            candidateCap: 4,
            maxSelected: 2,
          },
          maxExactPaths: 2,
          basis: createBasis(blockedGrid),
          issuedTick: 0,
          requestSequenceStart: 1,
          stackIdBuffer: new Uint32Array(2),
        },
      ),
    ).toMatchObject({
      ok: false,
      reason: "path.no_route_to_food",
      pathReason: "path_goal_blocked",
      exactPathCount: 1,
    });
  });
});

function createDriverOutput(): M3EatingClaimAdoptionOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    jobSlotVersion: 0,
    jobCoreVersion: 0,
    driverVersion: 0,
    activeCount: 0,
    jobCoreReservedCount: 0,
    jobCoreActiveCount: 0,
    jobCoreRunningCount: 0,
    jobCoreCurrentTombstoneCount: 0,
    jobCoreCumulativeTerminalCount: 0,
    driverReservedCount: 0,
    driverPickedUpCount: 0,
    driverConsumedCount: 0,
    driverCanceledCount: 0,
    driverFailedCount: 0,
    driverInterruptedCount: 0,
    currentInterruptedJobs: 0,
    reservationAttemptCount: 0,
    reservationFailureCount: 0,
    cumulativeConsumedCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    cumulativeInterruptedCount: 0,
    consumedAmountTotal: 0,
  };
}

function createTokenOutputForAdoption(): JobTokenIntoOutput {
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

function createEatingClaims(
  owner: EntityId,
  jobId: number,
  jobGeneration: number,
  createdTick: number,
): ReservationClaimsIntoOutput {
  const output = {
    ok: true,
    reason: undefined,
    claimIndex: RESERVATION_CLAIM_NONE,
    claimId: RESERVATION_CLAIM_NONE,
    claimCount: 2,
    version: 8,
    activeCount: 2,
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
  output.channelCodes[0] = RESERVATION_ITEM_QUANTITY;
  output.channelCodes[1] = RESERVATION_INTERACTION_SPOT;
  for (let index = 0; index < 2; index += 1) {
    output.ownerIndexes[index] = owner.index;
    output.ownerGenerations[index] = owner.generation;
    output.jobIds[index] = jobId;
    output.jobGenerations[index] = jobGeneration;
    output.hasTargetFlags[index] = 1;
    output.targetIndexes[index] = 9;
    output.targetGenerations[index] = 3;
    output.allocationEpochs[index] = 8;
    output.createdTicks[index] = createdTick;
    output.leaseExpiryTicks[index] = 400;
  }
  output.amounts[0] = 1;
  output.slotIds[1] = 7;
  return output;
}

interface AdoptedEatingFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly owner: EntityId;
  readonly itemEntity: EntityId;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly core: ReturnType<typeof createJobCoreStore>;
  readonly token: JobTokenIntoOutput;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly ids: Uint32Array;
  readonly epochs: Uint32Array;
  readonly claims: ReservationClaimsIntoOutput;
  readonly control: ExistingClaimsAdoptionControl;
  readonly eating: ReturnType<typeof createM3EatingJobDriverStore>;
  readonly adopted: M3EatingClaimAdoptionOutput;
  readonly needs: ReturnType<typeof createNeedStore>;
}

function createAdoptedEatingFixture(
  initialDriverVersion = 0,
  options: {
    readonly coreCapacity?: number;
    readonly autonomyJobStart?: number;
    readonly eatingCapacity?: number;
    readonly adoptionOverrides?: Partial<M3EatingClaimAdoptionInput>;
  } = {},
): AdoptedEatingFixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const owner = allocate(registry);
  const itemEntity = allocate(registry);
  const items = createItemStackStore(8);
  expect(
    items.createStack(
      { stackId: 2, entity: itemEntity, defId: GRAIN_BOWL, quantity: 3, capacity: 8 },
      registry,
    ),
  ).toMatchObject({ ok: true });
  const core = createJobCoreStore({
    capacity: options.coreCapacity ?? 8,
    ownerCapacity: 16,
    autonomyJobStart: options.autonomyJobStart ?? 4,
  });
  const token = createTokenOutputForAdoption();
  core.reserveAutonomyJobTokenInto(core.version, owner, token);
  expect(token).toMatchObject({ ok: true, jobGeneration: 1 });
  const ledger = createReservationLedger({ capacity: 16, entityCapacity: 16, cellCount: 32 });
  const acquired = ledger.acquire(
    {
      owner,
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      createdTick: 100,
      leaseExpiryTick: 400,
      claims: [
        { channel: "item_quantity", item: itemEntity, amount: 1, availableAmount: 3 },
        { channel: "interaction_spot", target: itemEntity, spotId: 7 },
      ],
    },
    registry,
  );
  if (!acquired.ok) throw new Error(acquired.reason);
  const ids = new Uint32Array(8);
  ids.fill(RESERVATION_CLAIM_NONE);
  const epochs = new Uint32Array(8);
  for (let index = 0; index < 2; index += 1) {
    ids[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
    epochs[index] = acquired.version;
  }
  const claims = createEatingClaims(owner, token.jobId, token.jobGeneration, 100);
  ledger.readActiveClaimsInto(
    ids,
    epochs,
    2,
    owner,
    token.jobId,
    token.jobGeneration,
    acquired.version,
    claims,
  );
  expect(claims).toMatchObject({ ok: true, claimCount: 2, version: acquired.version });
  const control = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: owner.index,
    ownerGeneration: owner.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: core.version,
    expectedDriverVersion: initialDriverVersion,
    claimCount: 2,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: 100,
    adoptionTick: 101,
    reservationReadVersion: acquired.version,
  };
  const emptyEating = createM3EatingJobDriverStore(options.eatingCapacity ?? 8);
  const eating =
    initialDriverVersion === 0
      ? emptyEating
      : restoreM3EatingJobDriverStore({
          ...emptyEating.createSnapshot(),
          storeVersion: initialDriverVersion,
        });
  const adopted = createDriverOutput();
  eating.adoptExistingClaimsInto(
    control,
    {
      jobId: token.jobId,
      owner,
      sourceStackId: 2,
      storageSlotId: 5,
      foodDefId: GRAIN_BOWL,
      amount: 1,
      hungerRestore: 40,
      itemStoreVersion: items.version,
      foodAvailabilityVersion: 1,
      mealWindowVersion: 1,
      abilityAllowed: true,
      createdTick: 100,
      itemEntity,
      interactionSpotId: 7,
      claims,
      readClaimIds: ids,
      readClaimEpochs: epochs,
      ...options.adoptionOverrides,
    },
    core,
    adopted,
  );
  const needs = createNeedStore({ actorCapacity: 16, updateIntervalTicks: 8 });
  expect(
    needs.registerActor({
      actorId: owner.index,
      hunger: 300,
      rest: 500,
      comfort: 600,
      social: 600,
      safety: 700,
      sourceTick: 0,
    }),
  ).toMatchObject({ ok: true });
  return {
    registry,
    owner,
    itemEntity,
    items,
    core,
    token,
    ledger,
    ids,
    epochs,
    claims,
    control,
    eating,
    adopted,
    needs,
  };
}

function createEatingMutationOutput(): M3EatingAdoptedMutationOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    jobSlotVersion: 0,
    jobCoreVersion: 0,
    driverVersion: 0,
    reservationVersion: 0,
    itemRowVersion: 0,
    itemStoreVersion: 0,
    needLaneVersion: 0,
    needStoreVersion: 0,
    cleanupPending: false,
    alreadyCommitted: false,
    releasedClaimCount: 0,
    terminalOutcome: undefined,
  };
}

function createEatingAdoptedJobOutput(): M3EatingAdoptedJobIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    sourceStackId: 0,
    storageSlotId: 0,
    foodDefId: 0,
    amount: 0,
    hungerRestore: 0,
    itemEntityIndex: 0,
    itemEntityGeneration: 0,
    interactionSpotId: 0,
    itemStoreVersion: 0,
    foodAvailabilityVersion: 0,
    mealWindowVersion: 0,
    abilityAllowed: false,
    claimIds: new Uint32Array(2),
    claimEpochs: new Uint32Array(2),
    claimCreatedTicks: new Float64Array(2),
    claimLeaseExpiryTicks: new Float64Array(2),
    createdTick: 0,
    stepEnteredTick: 0,
    step: "unassigned",
    carriedDefId: RESERVATION_CLAIM_NONE,
    carriedAmount: 0,
    consumedDefId: RESERVATION_CLAIM_NONE,
    consumedAmount: 0,
    jobSlotVersion: 0,
    driverVersion: 0,
    reservationVersion: 0,
    effectPhase: 0,
    cleanupPending: 0,
    returnedOnce: 0,
    pickupCommitted: false,
    lastEffectTick: 0,
    pendingOutcome: undefined,
    pendingFailure: "none",
    pendingInterruption: undefined,
    terminalReason: "food.job_created",
    activeCount: 0,
    reservedCount: 0,
    pickedUpCount: 0,
    consumedCount: 0,
    canceledCount: 0,
    failedCount: 0,
    interruptedCount: 0,
    currentInterruptedJobs: 0,
    reservationAttemptCount: 0,
    reservationFailureCount: 0,
    cumulativeConsumedCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    cumulativeInterruptedCount: 0,
    consumedAmountTotal: 0,
  };
}

function createEatingNeedMutation(
  fixture: ReturnType<typeof createAdoptedEatingFixture>,
  tick: number,
): NeedLaneMutationPrepareInput {
  return {
    actorId: fixture.owner.index,
    lane: NEED_LANE_HUNGER,
    tick,
    reason: "need.external_delta",
    sourceSystemId: 3,
    sourceEventId: fixture.token.jobId,
    expectedStoreVersion: fixture.needs.version,
    expectedLaneVersion: fixture.needs.readLaneOwnerVersion(fixture.owner.index, NEED_LANE_HUNGER),
    expectedValue: fixture.needs.readLaneValue(fixture.owner.index, NEED_LANE_HUNGER),
    delta: 40,
  };
}

function readEatingNeedBasis(fixture: ReturnType<typeof createAdoptedEatingFixture>): {
  readonly version: number;
  readonly laneVersion: number;
  readonly value: number;
} {
  return {
    version: fixture.needs.version,
    laneVersion: fixture.needs.readLaneOwnerVersion(fixture.owner.index, NEED_LANE_HUNGER),
    value: fixture.needs.readLaneValue(fixture.owner.index, NEED_LANE_HUNGER),
  };
}

function createEatingItemAddition(
  fixture: ReturnType<typeof createAdoptedEatingFixture>,
  amount: number,
): ItemStackQuantityAdditionPrepareInput {
  const stack = fixture.items.readStack(2, fixture.ledger);
  if (stack === undefined) throw new Error("missing adopted eating stack");
  return {
    stackId: stack.stackId,
    entityIndex: stack.entity.index,
    entityGeneration: stack.entity.generation,
    defId: stack.defId,
    quantity: stack.quantity,
    capacity: stack.capacity,
    amount,
    expectedRowVersion: stack.rowVersion,
    expectedStoreVersion: stack.storeVersion,
    expectedReservationVersion: fixture.ledger.version,
  };
}

function pickupAdoptedEating(
  fixture: ReturnType<typeof createAdoptedEatingFixture>,
): M3EatingAdoptedMutationOutput {
  const output = createEatingMutationOutput();
  fixture.eating.pickupAdoptedInto(
    createEatingPickupInput(fixture, fixture.adopted, 102),
    fixture.items,
    fixture.ledger,
    fixture.core,
    fixture.claims,
    output,
  );
  return output;
}

function createEatingPickupInput(
  fixture: ReturnType<typeof createAdoptedEatingFixture>,
  basis: Pick<M3EatingAdoptedMutationOutput, "jobSlotVersion" | "jobCoreVersion" | "driverVersion">,
  tick: number,
): M3EatingAdoptedPickupInput {
  const stack = fixture.items.readStack(2, fixture.ledger);
  if (stack === undefined) throw new Error("missing adopted eating pickup stack");
  return {
    jobId: fixture.token.jobId,
    jobGeneration: fixture.token.jobGeneration,
    owner: fixture.owner,
    expectedJobSlotVersion: basis.jobSlotVersion,
    expectedJobCoreVersion: basis.jobCoreVersion,
    expectedDriverVersion: basis.driverVersion,
    expectedCurrentLedgerVersion: fixture.ledger.version,
    tick,
    itemRemoval: {
      stackId: stack.stackId,
      entityIndex: stack.entity.index,
      entityGeneration: stack.entity.generation,
      defId: stack.defId,
      quantity: stack.quantity,
      reservedQuantity: stack.reservedQuantity,
      ownedReservedQuantity: 1,
      availableQuantity: stack.availableQuantity,
      capacity: stack.capacity,
      amount: 1,
      expectedRowVersion: stack.rowVersion,
      expectedStoreVersion: stack.storeVersion,
      expectedReservationVersion: fixture.ledger.version,
    },
  };
}

function copyWithReplacement<T>(rows: readonly T[], index: number, replacement: T): T[] {
  const copy: T[] = [];
  for (const row of rows) copy.push(row);
  copy[index] = replacement;
  return copy;
}

const GRAIN_BOWL = 1;
const REGION_YARD = 0;
const PUBLIC_PERMISSION = 0;
const MIDDAY_MEAL = 1;

type FoodPortionIntoOutput = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["readPortionInto"]
>[1];
type FoodCandidateQuery = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["selectCandidatesInto"]
>[0];
type FoodSelectionScratch = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["selectCandidatesInto"]
>[1];
type FoodSelectionOutput = Parameters<
  ReturnType<typeof createM3FoodAvailabilityStore>["selectCandidatesInto"]
>[2];
type FoodSelectionScratchLane = keyof FoodSelectionScratch;

const FOOD_SELECTION_SCRATCH_LANES: readonly FoodSelectionScratchLane[] = [
  "stackIds",
  "foodDefIds",
  "regionIds",
  "storageSlotIds",
  "targetCellIndexes",
  "interactionSpotIds",
  "scoreMillis",
  "permissionIds",
  "mealWindowIds",
  "mealWindowVersions",
  "safeFlags",
  "permissionAllowedFlags",
  "scheduleAllowedFlags",
  "availableAmounts",
  "itemStoreVersions",
  "linkedCandidateFlags",
];

interface FoodFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly food: ReturnType<typeof createM3FoodAvailabilityStore>;
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly offers: ReturnType<typeof createWorkOfferIndex>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly jobCore: ReturnType<typeof createJobCoreStore>;
  readonly eating: ReturnType<typeof createM3EatingJobDriverStore>;
  readonly needs: ReturnType<typeof createNeedStore>;
  readonly needIndex: ReturnType<typeof createNeedUrgencyIndex>;
  readonly actors: readonly EntityId[];
}

function createFoodPortionIntoOutput(): FoodPortionIntoOutput {
  return {
    ok: true,
    reason: "food_score_invalid",
    stackId: 99,
    foodDefId: 99,
    hungerRestore: 99,
    regionId: 99,
    storageSlotId: 99,
    targetCellIndex: 99,
    interactionSpotId: 99,
    scoreMilli: 99,
    permissionId: 99,
    mealWindowId: 99,
    mealWindowVersion: 99,
    safe: true,
    permissionAllowed: true,
    scheduleAllowed: true,
    availableAmount: 99,
    itemStoreVersion: 99,
    foodAvailabilityVersion: 99,
    active: true,
    linkedCandidate: true,
    dirtyBacklog: 99,
  };
}

function createFoodCandidateQuery(overrides: Partial<FoodCandidateQuery> = {}): FoodCandidateQuery {
  return {
    foodDefId: GRAIN_BOWL,
    regionId: REGION_YARD,
    permissionId: PUBLIC_PERMISSION,
    mealWindowId: MIDDAY_MEAL,
    candidateCap: M3_FOOD_DEFAULT_CANDIDATE_CAP,
    maxSelected: M3_FOOD_DEFAULT_SELECTED_CAP,
    ...overrides,
  };
}

function createFoodSelectionScratch(
  undersizedLane?: FoodSelectionScratchLane,
): FoodSelectionScratch {
  return {
    stackIds: createPoisonedUint32Lane("stackIds", undersizedLane),
    foodDefIds: createPoisonedUint32Lane("foodDefIds", undersizedLane),
    regionIds: createPoisonedUint32Lane("regionIds", undersizedLane),
    storageSlotIds: createPoisonedUint32Lane("storageSlotIds", undersizedLane),
    targetCellIndexes: createPoisonedUint32Lane("targetCellIndexes", undersizedLane),
    interactionSpotIds: createPoisonedUint32Lane("interactionSpotIds", undersizedLane),
    scoreMillis: createPoisonedUint32Lane("scoreMillis", undersizedLane),
    permissionIds: createPoisonedUint32Lane("permissionIds", undersizedLane),
    mealWindowIds: createPoisonedUint32Lane("mealWindowIds", undersizedLane),
    mealWindowVersions: createPoisonedUint32Lane("mealWindowVersions", undersizedLane),
    safeFlags: createPoisonedUint8Lane("safeFlags", undersizedLane),
    permissionAllowedFlags: createPoisonedUint8Lane("permissionAllowedFlags", undersizedLane),
    scheduleAllowedFlags: createPoisonedUint8Lane("scheduleAllowedFlags", undersizedLane),
    availableAmounts: createPoisonedUint32Lane("availableAmounts", undersizedLane),
    itemStoreVersions: createPoisonedUint32Lane("itemStoreVersions", undersizedLane),
    linkedCandidateFlags: createPoisonedUint8Lane("linkedCandidateFlags", undersizedLane),
  };
}

function createPoisonedUint32Lane(
  lane: FoodSelectionScratchLane,
  undersizedLane: FoodSelectionScratchLane | undefined,
): Uint32Array {
  const capacity = lane === undersizedLane ? M3_FOOD_DEFAULT_SELECTED_CAP - 1 : 12;
  return new Uint32Array(capacity).fill(99);
}

function createPoisonedUint8Lane(
  lane: FoodSelectionScratchLane,
  undersizedLane: FoodSelectionScratchLane | undefined,
): Uint8Array {
  const capacity = lane === undersizedLane ? M3_FOOD_DEFAULT_SELECTED_CAP - 1 : 12;
  return new Uint8Array(capacity).fill(1);
}

function createFoodSelectionOutput(): FoodSelectionOutput {
  return {
    ok: true,
    reason: "food_score_invalid",
    queryFoodDefId: 99,
    queryRegionId: 99,
    queryPermissionId: 99,
    queryMealWindowId: 99,
    candidateCap: 99,
    maxSelected: 99,
    bucketCandidateCount: 99,
    visitedCount: 99,
    selectedCount: 99,
    candidateCapHit: true,
    selectedCapHit: true,
    selectedStackId: 99,
    selectedFoodDefId: 99,
    selectedRegionId: 99,
    selectedStorageSlotId: 99,
    selectedTargetCellIndex: 99,
    selectedInteractionSpotId: 99,
    selectedScoreMilli: 99,
    selectedPermissionId: 99,
    selectedMealWindowId: 99,
    selectedMealWindowVersion: 99,
    selectedSafe: true,
    selectedPermissionAllowed: true,
    selectedScheduleAllowed: true,
    selectedAvailableAmount: 99,
    sourceItemVersion: 99,
    selectedLinkedCandidate: true,
    foodAvailabilityVersion: 99,
    dirtyBacklog: 99,
  };
}

function createFoodSelectionResetOutput(
  query: FoodCandidateQuery,
  foodAvailabilityVersion: number,
  dirtyBacklog: number,
  reason: FoodSelectionOutput["reason"],
): FoodSelectionOutput {
  return {
    ok: false,
    reason,
    queryFoodDefId: query.foodDefId,
    queryRegionId: query.regionId,
    queryPermissionId: query.permissionId,
    queryMealWindowId: query.mealWindowId,
    candidateCap: query.candidateCap,
    maxSelected: query.maxSelected,
    bucketCandidateCount: 0,
    visitedCount: 0,
    selectedCount: 0,
    candidateCapHit: false,
    selectedCapHit: false,
    selectedStackId: M3_FOOD_STACK_NONE,
    selectedFoodDefId: 0,
    selectedRegionId: 0,
    selectedStorageSlotId: 0,
    selectedTargetCellIndex: 0,
    selectedInteractionSpotId: 0,
    selectedScoreMilli: 0,
    selectedPermissionId: 0,
    selectedMealWindowId: 0,
    selectedMealWindowVersion: 0,
    selectedSafe: false,
    selectedPermissionAllowed: false,
    selectedScheduleAllowed: false,
    selectedAvailableAmount: 0,
    sourceItemVersion: 0,
    selectedLinkedCandidate: false,
    foodAvailabilityVersion,
    dirtyBacklog,
  };
}

function expectFoodSelectionScratchReset(scratch: FoodSelectionScratch): void {
  for (const laneName of FOOD_SELECTION_SCRATCH_LANES) {
    const lane = scratch[laneName];
    const expected = laneName === "stackIds" ? M3_FOOD_STACK_NONE : 0;
    for (const value of lane) {
      expect(value).toBe(expected);
    }
  }
}

function createFoodFixture(
  stackCount: number,
  quantity = 1,
  overrides: Partial<M3FoodPortionInput> = {},
): FoodFixture {
  const capacity = Math.max(1, stackCount);
  const registry = createEntityRegistry({ capacity: 96 });
  const actors = [allocate(registry), allocate(registry)];
  const stackEntities = allocateMany(registry, capacity);
  const storageEntities = allocateMany(registry, capacity);
  const items = createItemStackStore(capacity);
  const storage = createStorageLogisticsIndex(capacity, capacity, 4);
  const offers = createWorkOfferIndex({
    capacity,
    workTypeCapacity: 2,
    regionCapacity: 4,
    defCapacity: 4,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });
  const food = createM3FoodAvailabilityStore(capacity, 4, 4);
  const ledger = createReservationLedger({ capacity: 128, entityCapacity: 96, cellCount: 64 });
  const jobCore = createJobCoreStore({ capacity: 8 });
  const eating = createM3EatingJobDriverStore(8);
  const needs = createNeedStore({ actorCapacity: 8, updateIntervalTicks: 8 });
  const needIndex = createNeedUrgencyIndex({ actorCapacity: 8 });

  expect(
    needs.registerActor({
      actorId: 0,
      hunger: 280,
      rest: 500,
      comfort: 650,
      social: 520,
      safety: 700,
      sourceTick: 0,
    }),
  ).toMatchObject({ ok: true });

  for (let stackId = 0; stackId < stackCount; stackId += 1) {
    const stackEntity = stackEntities[stackId] ?? failMissingEntity();
    const storageEntity = storageEntities[stackId] ?? failMissingEntity();
    expect(
      items.createStack(
        {
          stackId,
          entity: stackEntity,
          defId: GRAIN_BOWL,
          quantity,
          capacity: quantity + 8,
        },
        registry,
      ),
    ).toMatchObject({ ok: true });
    expect(
      storage.configureSlot(createSlot(stackId, storageEntity, quantity + 8), registry),
    ).toMatchObject({
      ok: true,
    });
    expect(
      food.configurePortion({
        stackId,
        foodDefId: GRAIN_BOWL,
        regionId: REGION_YARD,
        storageSlotId: stackId,
        targetCellIndex: overrides.targetCellIndex ?? stackId % 16,
        interactionSpotId: 20,
        scoreMilli: 10_000 - stackId,
        permissionId: PUBLIC_PERMISSION,
        mealWindowId: MIDDAY_MEAL,
        mealWindowVersion: 1,
        safe: true,
        permissionAllowed: true,
        scheduleAllowed: true,
        ...overrides,
      }),
    ).toMatchObject({ ok: true });
  }

  storage.refreshDirty(items, ledger, offers, capacity);
  return {
    registry,
    items,
    food,
    storage,
    offers,
    ledger,
    jobCore,
    eating,
    needs,
    needIndex,
    actors,
  };
}

function updateFoodPortionConfig(
  fixture: FoodFixture,
  stackId: number,
  overrides: Partial<M3FoodPortionInput>,
): void {
  const portion = fixture.food.readPortion(stackId) ?? failMissingPortion();
  expect(
    fixture.food.updatePortion({
      stackId: portion.stackId,
      foodDefId: portion.foodDefId,
      regionId: portion.regionId,
      storageSlotId: portion.storageSlotId,
      targetCellIndex: portion.targetCellIndex,
      interactionSpotId: portion.interactionSpotId,
      scoreMilli: portion.scoreMilli,
      permissionId: portion.permissionId,
      mealWindowId: portion.mealWindowId,
      mealWindowVersion: portion.mealWindowVersion,
      safe: portion.safe,
      permissionAllowed: portion.permissionAllowed,
      scheduleAllowed: portion.scheduleAllowed,
      ...overrides,
    }),
  ).toMatchObject({ ok: true, stackId });
}

function createEatingJobFromPortion(
  fixture: FoodFixture,
  jobId: number,
  actorIndex: number,
  stackId: number,
  abilityAllowed = true,
  hungerRestore = 80,
): ReturnType<FoodFixture["eating"]["createJob"]> {
  const portion = fixture.food.readPortion(stackId) ?? failMissingPortion();
  return fixture.eating.createJob(
    {
      jobId,
      owner: fixture.actors[actorIndex] ?? failMissingEntity(),
      sourceStackId: stackId,
      storageSlotId: portion.storageSlotId,
      foodDefId: portion.foodDefId,
      amount: 1,
      hungerRestore,
      itemStoreVersion: portion.itemStoreVersion,
      foodAvailabilityVersion: portion.foodAvailabilityVersion,
      mealWindowVersion: portion.mealWindowVersion,
      abilityAllowed,
      createdTick: 0,
    },
    fixture.registry,
    fixture.jobCore,
  );
}

function reserve(
  fixture: FoodFixture,
  jobId: number,
  tick: number,
): ReturnType<FoodFixture["eating"]["reserveBeforePickup"]> {
  return fixture.eating.reserveBeforePickup(
    jobId,
    tick,
    fixture.registry,
    fixture.items,
    fixture.food,
    fixture.storage,
    fixture.ledger,
    fixture.jobCore,
  );
}

function pickup(
  fixture: FoodFixture,
  jobId: number,
  tick: number,
): ReturnType<FoodFixture["eating"]["pickup"]> {
  return fixture.eating.pickup(
    jobId,
    tick,
    fixture.items,
    fixture.food,
    fixture.storage,
    fixture.jobCore,
  );
}

function totalFood(fixture: FoodFixture): number {
  return calculateM3FoodConservationTotal(
    fixture.items,
    fixture.eating,
    GRAIN_BOWL,
    fixture.items.capacity,
  );
}

function createSlot(slotId: number, storageEntity: EntityId, capacity: number): StorageSlotInput {
  return {
    slotId,
    storage: storageEntity,
    stackId: slotId,
    defId: GRAIN_BOWL,
    capacity,
    desiredQuantity: 0,
    interactionCellIndex: 20,
    offerId: slotId,
    workType: 0,
    regionId: REGION_YARD,
    urgencyBucket: 0,
    permissionId: PUBLIC_PERMISSION,
  };
}

function createBasis(grid: ReturnType<typeof createMapGrid>): PathVersionBasis {
  return createPathVersionBasis(grid, {
    navigationVersion: 1,
    regionVersion: 1,
    roomVersion: 1,
    regionGraphVersion: 1,
  });
}

function allocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.entity;
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

function failMissingEntity(): never {
  throw new Error("missing entity");
}

function failMissingStack(): never {
  throw new Error("missing stack");
}

function failMissingPortion(): never {
  throw new Error("missing portion");
}
