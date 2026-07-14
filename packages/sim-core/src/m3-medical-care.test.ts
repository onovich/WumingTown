import { describe, expect, it, vi } from "vitest";

import {
  M3_ABILITY_MANIPULATION,
  M3_ABILITY_MOVEMENT,
  M3_ABILITY_STAMINA,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_INJURY,
  M3_HEALTH_CONDITION_RECOVERING,
  M3_MEDICAL_DEFAULT_CANDIDATE_CAP,
  M3_MEDICAL_DEFAULT_SELECTED_CAP,
  M3_MEDICAL_NO_REQUEST,
  RESERVATION_CELL,
  RESERVATION_CLAIM_NONE,
  RESERVATION_INTERACTION_SPOT,
  RESERVATION_ITEM_QUANTITY,
  createEntityRegistry,
  createGridPathfinder,
  createItemStackStore,
  createJobCoreStore,
  createM3AbilityCacheStore,
  createM3HealthAbilityMask,
  createM3HealthConditionStore,
  createM3MedicalCareStore,
  createM3TreatmentJobHashFields,
  createM3TreatmentJobStore,
  createMapGrid,
  createPathVersionBasis,
  createReservationLedger,
  createStorageLogisticsIndex,
  createWorkOfferIndex,
  type EntityId,
  type M3HealthConditionInput,
  type M3HealthConditionIntoOutput,
  type M3MedicalPatientRequestInput,
  type PathSearchResult,
  type M3TreatmentClaimAdoptionOutput,
  type M3TreatmentAdoptedJobIntoOutput,
  type M3TreatmentAdoptedMutationInput,
  type M3TreatmentAdoptedMutationOutput,
  type M3TreatmentAdoptedCompleteInput,
  type M3TreatmentAdoptedTerminalInput,
  type ItemStackIntoOutput,
  type StorageSlotIntoOutput,
  type M3TreatmentClaimAdoptionInput,
  type M3TreatmentStoreSnapshot,
  type ExistingClaimsAdoptionControl,
  type JobTokenIntoOutput,
  type ReservationClaimsIntoOutput,
} from "./index";

describe("m3-medical-care", () => {
  it("adopts exact treatment claims with overflow-safe work and guarded rollback", () => {
    const caregiver = { index: 1, generation: 2 };
    const stock = { index: 8, generation: 3 };
    const patientTarget = { index: 9, generation: 4 };
    const core = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const token = medicalTokenOutput();
    core.reserveAutonomyJobTokenInto(core.version, caregiver, token);
    const ids = new Uint32Array(8);
    ids.fill(RESERVATION_CLAIM_NONE);
    const epochs = new Uint32Array(8);
    for (let i = 0; i < 3; i += 1) {
      ids[i] = i + 3;
      epochs[i] = 11;
    }
    const claims = treatmentClaims(
      caregiver,
      stock,
      patientTarget,
      token.jobId,
      token.jobGeneration,
    );
    const control = {
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      ownerIndex: caregiver.index,
      ownerGeneration: caregiver.generation,
      expectedJobSlotVersion: token.slotVersion,
      expectedJobCoreVersion: core.version,
      expectedDriverVersion: 0,
      claimCount: 3,
      claimIds: ids,
      claimEpochs: epochs,
      claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
      claimCreatedTick: 0x1_0000_0001,
      adoptionTick: 0x1_0000_0002,
      reservationReadVersion: 11,
    };
    const treatment = createM3TreatmentJobStore(8);
    const adopted = medicalDriverOutput();
    treatment.adoptExistingClaimsInto(
      control,
      {
        jobId: token.jobId,
        caregiver,
        caregiverActorId: caregiver.index,
        requestId: 2,
        storageSlotId: 2,
        stockStackId: 3,
        patientInteractionTarget: patientTarget,
        patientInteractionSpotId: 6,
        treatmentCellIndex: 44,
        ability: 1,
        minimumAbilityValue: 10,
        treatmentTicks: 5,
        workPerTickQ16: 65_536,
        severityDelta: 20,
        createdTick: control.claimCreatedTick,
        stockItem: stock,
        patientId: 7,
        conditionId: 12,
        treatmentDefId: 4,
        stockDefId: 5,
        stockAmount: 2,
        conditionVersion: 3,
        actorConditionVersion: 4,
        healthStoreVersion: 5,
        abilityValue: 100,
        caregiverConditionVersion: 6,
        caregiverBaseAbilityVersion: 7,
        stockStoreVersion: 8,
        readClaimIds: ids,
        readClaimEpochs: epochs,
        claims,
      },
      core,
      adopted,
    );
    expect(adopted).toMatchObject({ ok: true, jobGeneration: 1, jobSlotVersion: 2 });
    const rolled = medicalDriverOutput();
    treatment.rollbackNewlyAdoptedInto(
      {
        ...control,
        expectedAdoptedJobSlotVersion: adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: adopted.driverVersion,
      },
      core,
      rolled,
    );
    expect(rolled).toMatchObject({ ok: true, jobSlotVersion: 3, activeCount: 0 });
    expect(claims.version).toBe(11);
  });
  it("reads adopted treatment state into reused fixed lanes and resets stale reads", () => {
    const fixture = createTreatmentAdoptionFixture();
    const output = treatmentAdoptedReadOutput();
    const identity = output;
    const ids = output.claimIds;
    const epochs = output.claimEpochs;
    const created = output.claimCreatedTicks;
    const leases = output.claimLeaseExpiryTicks;
    poisonTreatmentAdoptedOutput(output);
    fixture.treatment.readAdoptedJobInto(
      fixture.control.jobId,
      fixture.control.jobGeneration,
      fixture.control.ownerIndex,
      fixture.control.ownerGeneration,
      fixture.adopted.jobSlotVersion,
      fixture.adopted.driverVersion,
      output,
    );
    expect(output).toBe(identity);
    expect(output.claimIds).toBe(ids);
    expect(output.claimEpochs).toBe(epochs);
    expect(output.claimCreatedTicks).toBe(created);
    expect(output.claimLeaseExpiryTicks).toBe(leases);
    expect(output).toStrictEqual(expectedTreatmentAdoptedRead(fixture));
    poisonTreatmentAdoptedOutput(output);
    fixture.treatment.readAdoptedJobInto(
      fixture.control.jobId,
      fixture.control.jobGeneration + 1,
      fixture.control.ownerIndex,
      fixture.control.ownerGeneration,
      fixture.adopted.jobSlotVersion,
      fixture.adopted.driverVersion,
      output,
    );
    expect(output).toStrictEqual(
      expectedTreatmentAdoptedReadReset(fixture.control.jobId, fixture.adopted.driverVersion),
    );
  });
  it("advances an adopted treatment through pathing and deterministic ready progress", () => {
    const fixture = createTreatmentAdoptionFixture();
    const output = treatmentMutationOutput();
    let input = treatmentMutationInput(fixture, fixture.control.adoptionTick);
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: false,
      step: "pathing_to_patient",
      jobSlotVersion: fixture.adopted.jobSlotVersion,
      jobCoreVersion: fixture.adopted.jobCoreVersion,
      driverVersion: fixture.adopted.driverVersion + 1,
      reservedCount: 0,
      pathingCount: 1,
      treatingCount: 0,
    });
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick);
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({ ok: true, alreadyCommitted: true, pathingCount: 1 });

    fixture.treatment.beginAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: false,
      step: "treating",
      progressQ16: 0,
      pathingCount: 0,
      treatingCount: 1,
    });
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick);
    fixture.treatment.beginAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({ ok: true, alreadyCommitted: true, progressQ16: 0 });

    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: false,
      progressQ16: 65_536,
      readyToComplete: false,
    });
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: true,
      progressQ16: 65_536,
    });

    for (let completedTicks = 2; completedTicks <= 5; completedTicks += 1) {
      input = treatmentMutationInputFromOutput(
        output,
        fixture.control.adoptionTick + completedTicks - 1,
      );
      fixture.treatment.progressAdoptedInto(input, fixture.core, output);
      expect(output).toMatchObject({
        ok: true,
        alreadyCommitted: false,
        progressQ16: completedTicks * 65_536,
        readyToComplete: completedTicks === 5,
      });
    }
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick + 4);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({ ok: true, alreadyCommitted: true, readyToComplete: true });
    const readyTreatment = fixture.treatment.createSnapshot();
    const readyCore = fixture.core.createSnapshot();
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick + 5);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({ ok: false, reason: "medical.step_invalid" });
    expect(fixture.treatment.createSnapshot()).toStrictEqual(readyTreatment);
    expect(fixture.core.createSnapshot()).toStrictEqual(readyCore);
  });

  it("roundtrips reserved pathing partial and ready Treatment-B snapshots", () => {
    const fixture = createTreatmentAdoptionFixture();
    const snapshots: M3TreatmentStoreSnapshot[] = [fixture.treatment.createSnapshot()];
    const output = treatmentMutationOutput();
    let input = treatmentMutationInput(fixture, fixture.control.adoptionTick + 1);
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    snapshots.push(fixture.treatment.createSnapshot());
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick + 1);
    fixture.treatment.beginAdoptedInto(input, fixture.core, output);
    snapshots.push(fixture.treatment.createSnapshot());
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick + 1);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    snapshots.push(fixture.treatment.createSnapshot());
    for (let tick = 2; tick <= 5; tick += 1) {
      input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick + tick);
      fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    }
    snapshots.push(fixture.treatment.createSnapshot());
    for (const snapshot of snapshots) {
      const restored = createM3TreatmentJobStore(8);
      expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
      expect(restored.createSnapshot()).toStrictEqual(snapshot);
      expect(createM3TreatmentJobHashFields(restored.createSnapshot())).toStrictEqual(
        createM3TreatmentJobHashFields(snapshot),
      );
    }
  });

  it("commits the Treatment-C health stock release and terminal tail exactly once", () => {
    const fixture = createTreatmentCFixture();
    const output = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: false,
      effectPhase: 4,
      stockConsumedOnce: true,
      cleanupPending: false,
      terminalOutcome: "completed",
      terminalFailureReason: "none",
      releasedClaimCount: 3,
      completedCount: 1,
      cumulativeCompletedCount: 1,
      conditionDeltaCount: 1,
      stockConsumedCount: 2,
      reservationCleanupCount: 3,
    });
    expect(fixture.health.readCondition(fixture.conditionId)).toMatchObject({ severity: 400 });
    expect(fixture.items.readStack(fixture.stackId, fixture.ledger)).toMatchObject({ quantity: 4 });
    expect(fixture.ledger.activeCount).toBe(0);
    const completedSnapshot = fixture.treatment.createSnapshot();
    const restored = createM3TreatmentJobStore(completedSnapshot.capacity);
    expect(restored.restoreFromSnapshot(completedSnapshot)).toMatchObject({ ok: true });
    expect(restored.createSnapshot()).toStrictEqual(completedSnapshot);
    expect(createM3TreatmentJobHashFields(restored.createSnapshot())).toStrictEqual(
      createM3TreatmentJobHashFields(completedSnapshot),
    );
    const after = treatmentOwnerSnapshots(fixture);
    fixture.treatment.completeAdoptedInto(
      { ...treatmentCompleteInputFromOutput(fixture, output), tick: fixture.terminalTick + 1 },
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: true, alreadyCommitted: true });
    expect(treatmentOwnerSnapshots(fixture)).toStrictEqual(after);
  });

  it("accepts zero-based storage slot zero through completion and terminal-origin roundtrip", () => {
    const fixture = createTreatmentCFixture(0);
    const completed = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      completed,
    );
    expect(completed).toMatchObject({ ok: true, effectPhase: 4 });
    const terminal = fixture.treatment.createSnapshot();
    expect(terminal.rows[completed.jobId]).toMatchObject({ storageSlotId: 0 });
    const terminalRoundtrip = createM3TreatmentJobStore(terminal.capacity);
    expect(terminalRoundtrip.restoreFromSnapshot(terminal)).toMatchObject({ ok: true });
    const reuse = prepareTreatmentReuseAdoption(fixture);
    const adopted = medicalDriverOutput();
    fixture.treatment.adoptExistingClaimsInto(reuse.control, reuse.input, fixture.core, adopted);
    expect(adopted.ok, String(adopted.reason)).toBe(true);
    const origin = fixture.treatment.createSnapshot();
    expect(origin.rows[adopted.jobId]).toMatchObject({ originPresent: 1 });
    expect(origin.rows[adopted.jobId]?.originU32[4]).toBe(0);
    const originRoundtrip = createM3TreatmentJobStore(origin.capacity);
    expect(originRoundtrip.restoreFromSnapshot(origin)).toMatchObject({ ok: true });
  });

  it.each([
    [
      "completed outcome",
      (input: M3TreatmentAdoptedTerminalInput): void => {
        Reflect.set(input, "outcome", "completed");
        Reflect.set(input, "failureReason", "none");
      },
    ],
    [
      "unknown outcome",
      (input: M3TreatmentAdoptedTerminalInput): void => void Reflect.set(input, "outcome", "bogus"),
    ],
    [
      "unknown failed reason",
      (input: M3TreatmentAdoptedTerminalInput): void => {
        Reflect.set(input, "outcome", "failed");
        Reflect.set(input, "failureReason", "bogus");
      },
    ],
    [
      "immediate interruption",
      (input: M3TreatmentAdoptedTerminalInput): void => {
        Reflect.set(input, "outcome", "interrupted");
        Reflect.set(input, "interruptionKind", "immediate");
      },
    ],
    [
      "missing interruption",
      (input: M3TreatmentAdoptedTerminalInput): void => {
        Reflect.set(input, "outcome", "interrupted");
      },
    ],
    [
      "mixed canceled interruption",
      (input: M3TreatmentAdoptedTerminalInput): void => {
        Reflect.set(input, "interruptionKind", "emergency");
      },
    ],
  ] as const)("rejects Treatment-C runtime terminal tuple %s before mutation", (_label, mutate) => {
    const fixture = createTreatmentCFixture();
    const input: M3TreatmentAdoptedTerminalInput = {
      ...treatmentMutationInputFromOutput(fixture.readyOutput, fixture.terminalTick),
      expectedCurrentLedgerVersion: fixture.ledger.version,
      outcome: "canceled",
      failureReason: "cancelled",
      interruptionKind: undefined,
    };
    mutate(input);
    const before = treatmentOwnerSnapshots(fixture);
    const output = treatmentMutationOutput();
    fixture.treatment.terminalAdoptedInto(
      input,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "medical.step_invalid" });
    expect(treatmentOwnerSnapshots(fixture)).toStrictEqual(before);
  });

  it("rejects completed through the negative terminal root after completion", () => {
    const fixture = createTreatmentCFixture();
    const completed = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      completed,
    );
    expect(completed.ok).toBe(true);
    const before = treatmentOwnerSnapshots(fixture);
    const output = treatmentMutationOutput();
    const input: M3TreatmentAdoptedTerminalInput = {
      ...treatmentMutationInputFromOutput(completed, fixture.terminalTick + 1),
      expectedCurrentLedgerVersion: fixture.ledger.version,
      outcome: "canceled",
      failureReason: "cancelled",
      interruptionKind: undefined,
    };
    Reflect.set(input, "outcome", "completed");
    Reflect.set(input, "failureReason", "none");
    fixture.treatment.terminalAdoptedInto(
      input,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      alreadyCommitted: false,
      reason: "medical.step_invalid",
    });
    expect(treatmentOwnerSnapshots(fixture)).toStrictEqual(before);
  });

  it.each([
    ["condition delta", "conditionDeltaCount", 0xffff_ffff],
    ["stock consumed", "stockConsumedCount", 0xffff_fffe],
  ] as const)(
    "rejects phase-zero %s counter exhaustion before any owner write",
    (_label, key, value) => {
      const fixture = createTreatmentCFixture();
      Reflect.set(fixture.treatment, key, value);
      const before = treatmentOwnerSnapshots(fixture);
      const output = treatmentMutationOutput();
      fixture.treatment.completeAdoptedInto(
        treatmentCompleteInput(fixture),
        fixture.health,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.core,
        fixture.claims,
        output,
      );
      expect(output).toMatchObject({ ok: false, reason: "medical.adopted_state_mismatch" });
      expect(treatmentOwnerSnapshots(fixture)).toStrictEqual(before);
    },
  );

  it("rejects phase-one stock counter exhaustion without requiring another condition delta", () => {
    const fixture = createPhaseOneTreatmentFixture();
    Reflect.set(fixture.treatment, "stockConsumedCount", 0xffff_fffe);
    Reflect.set(fixture.treatment, "conditionDeltaCount", 0xffff_ffff);
    const before = treatmentOwnerSnapshots(fixture);
    const output = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "medical.adopted_state_mismatch" });
    expect(treatmentOwnerSnapshots(fixture)).toStrictEqual(before);
  });

  it("rejects malformed Treatment-C v4 terminal snapshots atomically", () => {
    const fixture = createTreatmentCFixture();
    const output = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      output,
    );
    expect(output.ok).toBe(true);
    const snapshot = fixture.treatment.createSnapshot();
    const row = snapshot.rows[output.jobId];
    if (row === undefined) throw new Error("missing Treatment-C terminal row");
    const destination = createM3TreatmentJobStore(snapshot.capacity);
    expect(destination.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    const before = destination.createSnapshot();
    const hashBefore = createM3TreatmentJobHashFields(before);
    const corruptedOrigin = [...row.originU32];
    corruptedOrigin[0] = 1;
    const retainedClaims = [...row.claimIds];
    retainedClaims[0] = 1;
    const malformed: readonly unknown[] = [
      { ...snapshot, snapshotVersion: 3 },
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { claimIds: retainedClaims }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { cleanupPending: 1 }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { terminalOutcomeCode: 2 }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { terminalOutcomeCode: 99 }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { terminalFailureCode: 9 }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { terminalInterruptionCode: 3 }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { progressQ16: 0 }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { stockRowVersion: 0 }),
      treatmentSnapshotWithRowPatch(snapshot, output.jobId, { originU32: corruptedOrigin }),
      { ...snapshot, cumulativeCompletedCount: 0 },
      { ...snapshot, cumulativeCanceledCount: 0, cumulativeInterruptedCount: 1 },
      { ...snapshot, conditionDeltaCount: 0 },
      { ...snapshot, stockConsumedCount: 1 },
      { ...snapshot, reservationCleanupCount: 2 },
    ];
    for (const candidate of malformed) {
      expect(destination.restoreFromSnapshot(candidate)).toMatchObject({ ok: false });
      expect(destination.createSnapshot()).toStrictEqual(before);
      expect(createM3TreatmentJobHashFields(destination.createSnapshot())).toStrictEqual(
        hashBefore,
      );
    }
  });

  it("rejects non-boolean origin presence independently of terminal count reconciliation", () => {
    const fixture = createTreatmentCFixture();
    const completed = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      completed,
    );
    const reuse = prepareTreatmentReuseAdoption(fixture);
    const adopted = medicalDriverOutput();
    fixture.treatment.adoptExistingClaimsInto(reuse.control, reuse.input, fixture.core, adopted);
    expect(adopted.ok).toBe(true);
    const snapshot = fixture.treatment.createSnapshot();
    const destination = createM3TreatmentJobStore(snapshot.capacity);
    expect(destination.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    const before = destination.createSnapshot();
    const hashBefore = createM3TreatmentJobHashFields(before);
    const candidate = treatmentSnapshotWithRowAndTopPatch(
      snapshot,
      adopted.jobId,
      { originPresent: 2 },
      { completedCount: 0 },
    );
    expect(destination.restoreFromSnapshot(candidate)).toMatchObject({ ok: false });
    expect(destination.createSnapshot()).toStrictEqual(before);
    expect(createM3TreatmentJobHashFields(destination.createSnapshot())).toStrictEqual(hashBefore);
  });

  it("rejects malformed phase-one phase-two and phase-three snapshot truths atomically", () => {
    const phaseOneFixture = createPhaseOneTreatmentFixture();
    const phaseOne = phaseOneFixture.treatment.createSnapshot();
    const phaseOneJobId = phaseOneFixture.readyOutput.jobId;

    const phaseTwoFixture = createTreatmentCFixture();
    const phaseTwoRelease = vi
      .spyOn(phaseTwoFixture.ledger, "releaseClaimsInto")
      .mockImplementationOnce(() => undefined);
    const phaseTwoOutput = treatmentMutationOutput();
    phaseTwoFixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(phaseTwoFixture),
      phaseTwoFixture.health,
      phaseTwoFixture.items,
      phaseTwoFixture.storage,
      phaseTwoFixture.ledger,
      phaseTwoFixture.core,
      phaseTwoFixture.claims,
      phaseTwoOutput,
    );
    phaseTwoRelease.mockRestore();
    expect(phaseTwoOutput).toMatchObject({ effectPhase: 2, cleanupPending: true });
    const phaseTwo = phaseTwoFixture.treatment.createSnapshot();

    const phaseThreeFixture = createTreatmentCFixture();
    const phaseThreeRelease = vi
      .spyOn(phaseThreeFixture.ledger, "releaseClaimsInto")
      .mockImplementationOnce(() => undefined);
    const phaseThreeOutput = treatmentMutationOutput();
    phaseThreeFixture.treatment.terminalAdoptedInto(
      {
        ...treatmentMutationInputFromOutput(
          phaseThreeFixture.readyOutput,
          phaseThreeFixture.terminalTick,
        ),
        expectedCurrentLedgerVersion: phaseThreeFixture.ledger.version,
        outcome: "canceled",
        failureReason: "cancelled",
        interruptionKind: undefined,
      },
      phaseThreeFixture.ledger,
      phaseThreeFixture.core,
      phaseThreeFixture.claims,
      phaseThreeOutput,
    );
    phaseThreeRelease.mockRestore();
    expect(phaseThreeOutput).toMatchObject({ effectPhase: 3, cleanupPending: true });
    const phaseThree = phaseThreeFixture.treatment.createSnapshot();

    const cases = [
      {
        snapshot: phaseOne,
        jobId: phaseOneJobId,
        patches: [
          { terminalReasonCode: 10 },
          { progressQ16: 0 },
          { terminalOutcomeCode: 2 },
          { stockRowVersion: 1 },
          { cleanupPending: 1 },
        ],
      },
      {
        snapshot: phaseTwo,
        jobId: phaseTwoOutput.jobId,
        patches: [
          { terminalReasonCode: 10 },
          { progressQ16: 0 },
          { terminalOutcomeCode: 2 },
          { stockRowVersion: 0 },
          { cleanupPending: 0 },
        ],
      },
      {
        snapshot: phaseThree,
        jobId: phaseThreeOutput.jobId,
        patches: [
          { terminalReasonCode: 1 },
          { progressQ16: 1 },
          { terminalOutcomeCode: 1 },
          { stockRowVersion: 1 },
          { cleanupPending: 0 },
        ],
      },
    ] as const;
    for (const entry of cases) {
      const destination = createM3TreatmentJobStore(entry.snapshot.capacity);
      expect(destination.restoreFromSnapshot(entry.snapshot)).toMatchObject({ ok: true });
      const before = destination.createSnapshot();
      const hashBefore = createM3TreatmentJobHashFields(before);
      for (const patch of entry.patches) {
        expect(
          destination.restoreFromSnapshot(
            treatmentSnapshotWithRowPatch(entry.snapshot, entry.jobId, patch),
          ),
        ).toMatchObject({ ok: false });
        expect(destination.createSnapshot()).toStrictEqual(before);
        expect(createM3TreatmentJobHashFields(destination.createSnapshot())).toStrictEqual(
          hashBefore,
        );
      }
    }
  });

  it("requires effect evidence for an active phase-two row and its retained terminal origin", () => {
    const fixture = createTreatmentCFixture();
    const first = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      first,
    );
    expect(first.ok).toBe(true);
    refreshTreatmentStorage(fixture);
    const reuse = advanceReusedTreatment(fixture);
    refreshTreatmentStorage(fixture);
    const reusedFixture: TreatmentCFixture = {
      ...fixture,
      readyOutput: reuse.output,
      terminalTick: reuse.terminalTick,
    };
    const release = vi
      .spyOn(fixture.ledger, "releaseClaimsInto")
      .mockImplementationOnce(
        (
          _claimIds,
          _claimEpochs,
          _claimCount,
          _owner,
          _jobId,
          _jobGeneration,
          _ledgerVersion,
          releaseOutput,
        ) => {
          releaseOutput.ok = false;
          releaseOutput.reason = "reservation_ledger_version_mismatch";
          releaseOutput.version = fixture.ledger.version;
          releaseOutput.releasedCount = 0;
        },
      );
    const pending = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(reusedFixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      pending,
    );
    release.mockRestore();
    expect(pending).toMatchObject({ ok: false, effectPhase: 2, cleanupPending: true });
    const snapshot = fixture.treatment.createSnapshot();
    expect(snapshot.rows[pending.jobId]).toMatchObject({ originPresent: 1, deltaApplied: 1 });
    const destination = createM3TreatmentJobStore(snapshot.capacity);
    expect(destination.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    const before = destination.createSnapshot();
    const hashBefore = createM3TreatmentJobHashFields(before);
    for (const candidate of [
      { ...snapshot, conditionDeltaCount: 1 },
      { ...snapshot, stockConsumedCount: 3 },
      { ...snapshot, reservationCleanupCount: 2 },
    ]) {
      expect(destination.restoreFromSnapshot(candidate)).toMatchObject({ ok: false });
      expect(destination.createSnapshot()).toStrictEqual(before);
      expect(createM3TreatmentJobHashFields(destination.createSnapshot())).toStrictEqual(
        hashBefore,
      );
    }
  });

  it("counts legacy completed stock consumption in the v4 evidence lower bound", () => {
    const fixture = createReadyTreatmentFixture();
    startTreatingJob(fixture, 0);
    const treating = fixture.treatments.createSnapshot();
    const treatingRow = treating.rows[0];
    if (treatingRow === undefined) throw new Error("missing legacy treating row");
    const treatingDestination = createM3TreatmentJobStore(treating.capacity);
    expect(treatingDestination.restoreFromSnapshot(treating)).toMatchObject({ ok: true });
    const treatingBefore = treatingDestination.createSnapshot();
    const treatingHash = createM3TreatmentJobHashFields(treatingBefore);
    expect(
      treatingDestination.restoreFromSnapshot(
        treatmentSnapshotWithRowPatch(treating, 0, { deltaApplied: 1 }),
      ),
    ).toMatchObject({ ok: false });
    expect(treatingDestination.createSnapshot()).toStrictEqual(treatingBefore);
    expect(createM3TreatmentJobHashFields(treatingDestination.createSnapshot())).toStrictEqual(
      treatingHash,
    );
    expect(
      fixture.treatments.tickTreatment(
        0,
        13,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.condition_delta_applied" });
    expect(
      fixture.treatments.tickTreatment(
        0,
        14,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_completed" });
    const snapshot = fixture.treatments.createSnapshot();
    const row = snapshot.rows[0];
    if (row === undefined) throw new Error("missing legacy completed row");
    const requiredWork = row.treatmentTicks * row.workPerTickQ16;
    expect(row).toMatchObject({
      jobGeneration: 0,
      deltaApplied: 1,
      progressQ16: requiredWork,
      stockConsumedOnce: 0,
    });
    const destination = createM3TreatmentJobStore(snapshot.capacity);
    expect(destination.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    const before = destination.createSnapshot();
    const hashBefore = createM3TreatmentJobHashFields(before);
    const malformed = [
      treatmentSnapshotWithRowPatch(snapshot, 0, { deltaApplied: 0 }),
      treatmentSnapshotWithRowPatch(snapshot, 0, { progressQ16: requiredWork - 1 }),
      treatmentSnapshotWithRowPatch(snapshot, 0, { progressQ16: requiredWork + 1 }),
      { ...snapshot, conditionDeltaCount: 0 },
      { ...snapshot, stockConsumedCount: 0 },
    ];
    for (const candidate of malformed) {
      expect(destination.restoreFromSnapshot(candidate)).toMatchObject({ ok: false });
      expect(destination.createSnapshot()).toStrictEqual(before);
      expect(createM3TreatmentJobHashFields(destination.createSnapshot())).toStrictEqual(
        hashBefore,
      );
    }
  });

  it.each([
    ["canceled", "cancelled", undefined],
    ["failed", "target_state", undefined],
    ["interrupted", "cancelled", "safe_point"],
  ] as const)(
    "terminates a phase-zero Treatment-C job as %s",
    (outcome, failureReason, interruptionKind) => {
      const fixture = createTreatmentCFixture();
      const output = treatmentMutationOutput();
      fixture.treatment.terminalAdoptedInto(
        {
          ...treatmentMutationInputFromOutput(fixture.readyOutput, fixture.terminalTick),
          expectedCurrentLedgerVersion: fixture.ledger.version,
          outcome,
          failureReason,
          interruptionKind,
        },
        fixture.ledger,
        fixture.core,
        fixture.claims,
        output,
      );
      expect(output).toMatchObject({
        ok: true,
        effectPhase: 4,
        cleanupPending: false,
        terminalOutcome: outcome,
        releasedClaimCount: 3,
        conditionDeltaCount: 0,
        stockConsumedCount: 0,
      });
      expect(fixture.ledger.activeCount).toBe(0);
      expect(fixture.health.readCondition(fixture.conditionId)).toMatchObject({ severity: 420 });
      expect(fixture.items.readStack(fixture.stackId, fixture.ledger)).toMatchObject({
        quantity: 6,
      });
    },
  );

  it("restores phase-two completion cleanup and retries release without repeating effects", () => {
    const fixture = createTreatmentCFixture();
    const input = treatmentCompleteInput(fixture);
    const healthBefore = fixture.health.readCondition(fixture.conditionId);
    const release = vi
      .spyOn(fixture.ledger, "releaseClaimsInto")
      .mockImplementationOnce(() => undefined);
    const pending = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      input,
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      pending,
    );
    release.mockRestore();
    expect(pending).toMatchObject({
      ok: false,
      effectPhase: 2,
      cleanupPending: true,
      terminalOutcome: "completed",
      conditionDeltaCount: 1,
      stockConsumedCount: 2,
      reservationCleanupCount: 0,
    });
    expect(fixture.health.readCondition(fixture.conditionId)).not.toStrictEqual(healthBefore);
    expect(fixture.items.readStack(fixture.stackId, fixture.ledger)).toMatchObject({ quantity: 4 });
    const restored = createM3TreatmentJobStore(fixture.treatment.capacity);
    expect(restored.restoreFromSnapshot(fixture.treatment.createSnapshot())).toMatchObject({
      ok: true,
    });
    const resumed = treatmentMutationOutput();
    restored.resumeCleanupInto(
      {
        ...treatmentMutationInputFromOutput(pending, fixture.terminalTick + 1),
        expectedCurrentLedgerVersion: fixture.ledger.version,
        outcome: "completed",
        failureReason: "none",
        interruptionKind: undefined,
      },
      fixture.ledger,
      fixture.core,
      fixture.claims,
      resumed,
    );
    expect(resumed).toMatchObject({
      ok: true,
      effectPhase: 4,
      releasedClaimCount: 3,
      conditionDeltaCount: 1,
      stockConsumedCount: 2,
      reservationCleanupCount: 3,
    });
    expect(fixture.items.readStack(fixture.stackId, fixture.ledger)).toMatchObject({ quantity: 4 });
  });

  it("restores phase-three interrupted cleanup and retries only the exact tuple", () => {
    const fixture = createTreatmentCFixture();
    const input = {
      ...treatmentMutationInputFromOutput(fixture.readyOutput, fixture.terminalTick),
      expectedCurrentLedgerVersion: fixture.ledger.version,
      outcome: "interrupted" as const,
      failureReason: "cancelled" as const,
      interruptionKind: "safe_point" as const,
    };
    const release = vi
      .spyOn(fixture.ledger, "releaseClaimsInto")
      .mockImplementationOnce(() => undefined);
    const pending = treatmentMutationOutput();
    fixture.treatment.terminalAdoptedInto(
      input,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      pending,
    );
    release.mockRestore();
    expect(pending).toMatchObject({
      ok: false,
      effectPhase: 3,
      cleanupPending: true,
      terminalOutcome: "interrupted",
      conditionDeltaCount: 0,
      stockConsumedCount: 0,
    });
    const restored = createM3TreatmentJobStore(fixture.treatment.capacity);
    expect(restored.restoreFromSnapshot(fixture.treatment.createSnapshot())).toMatchObject({
      ok: true,
    });
    const wrong = treatmentMutationOutput();
    restored.resumeCleanupInto(
      {
        ...treatmentMutationInputFromOutput(pending, fixture.terminalTick + 1),
        expectedCurrentLedgerVersion: fixture.ledger.version,
        outcome: "canceled",
        failureReason: "cancelled",
        interruptionKind: undefined,
      },
      fixture.ledger,
      fixture.core,
      fixture.claims,
      wrong,
    );
    expect(wrong).toMatchObject({ ok: false, reason: "medical.step_invalid" });
    const resumed = treatmentMutationOutput();
    restored.resumeCleanupInto(
      {
        ...treatmentMutationInputFromOutput(pending, fixture.terminalTick + 1),
        expectedCurrentLedgerVersion: fixture.ledger.version,
        outcome: "interrupted",
        failureReason: "cancelled",
        interruptionKind: "safe_point",
      },
      fixture.ledger,
      fixture.core,
      fixture.claims,
      resumed,
    );
    expect(resumed).toMatchObject({
      ok: true,
      effectPhase: 4,
      interruptedCount: 1,
      cumulativeInterruptedCount: 1,
      reservationCleanupCount: 3,
    });
    expect(fixture.health.readCondition(fixture.conditionId)).toMatchObject({ severity: 420 });
    expect(fixture.items.readStack(fixture.stackId, fixture.ledger)).toMatchObject({ quantity: 6 });
  });

  it("captures and restores a completed Treatment-C origin across token reuse rollback", () => {
    const fixture = createTreatmentCFixture();
    const completed = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      completed,
    );
    expect(completed.ok).toBe(true);
    const terminalSnapshot = fixture.treatment.createSnapshot();
    const terminalRow = terminalSnapshot.rows[completed.jobId];
    if (terminalRow === undefined) throw new Error("missing completed Treatment-C row");
    const reuse = prepareTreatmentReuseAdoption(fixture);
    const adopted = medicalDriverOutput();
    fixture.treatment.adoptExistingClaimsInto(reuse.control, reuse.input, fixture.core, adopted);
    expect(adopted.ok, String(adopted.reason)).toBe(true);
    expect(adopted).toMatchObject({ ok: true, completedCount: 1 });
    const adoptedRow = fixture.treatment.createSnapshot().rows[adopted.jobId];
    expect(adoptedRow).toMatchObject({ active: 1, originPresent: 1, effectPhase: 0 });
    const originSnapshot = fixture.treatment.createSnapshot();
    const originRoundtrip = createM3TreatmentJobStore(originSnapshot.capacity);
    expect(originRoundtrip.restoreFromSnapshot(originSnapshot)).toMatchObject({ ok: true });
    const rolled = medicalDriverOutput();
    fixture.treatment.rollbackNewlyAdoptedInto(
      {
        ...reuse.control,
        expectedAdoptedJobSlotVersion: adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: adopted.driverVersion,
      },
      fixture.core,
      rolled,
    );
    expect(rolled).toMatchObject({ ok: true, completedCount: 1 });
    const restoredSnapshot = fixture.treatment.createSnapshot();
    const restoredRow = restoredSnapshot.rows[completed.jobId];
    if (restoredRow === undefined) throw new Error("missing restored Treatment-C origin row");
    expect(restoredRow).toStrictEqual({
      ...terminalRow,
      jobSlotVersion: rolled.jobSlotVersion,
    });
    const roundtrip = createM3TreatmentJobStore(restoredSnapshot.capacity);
    expect(roundtrip.restoreFromSnapshot(restoredSnapshot)).toMatchObject({ ok: true });
    expect(roundtrip.createSnapshot()).toStrictEqual(restoredSnapshot);
  });

  it("keeps JobCore current tombstones net-zero when a completed origin is replaced", () => {
    const fixture = createTreatmentCFixture();
    const first = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      first,
    );
    expect(first.ok).toBe(true);
    refreshTreatmentStorage(fixture);
    const reuse = advanceReusedTreatment(fixture);
    refreshTreatmentStorage(fixture);
    const reusedFixture: TreatmentCFixture = {
      ...fixture,
      readyOutput: reuse.output,
      terminalTick: reuse.terminalTick,
    };
    const second = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(reusedFixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      second,
    );
    expect(second.ok, String(second.reason)).toBe(true);
    expect(second).toMatchObject({ jobCumulativeTerminalCount: 2 });
    expect(second.jobCurrentTombstoneCount).toBe(fixture.core.currentTombstoneJobCount);
    expect(second.jobCurrentTombstoneCount).toBe(1);
  });

  it("keeps JobCore current tombstones net-zero when a canceled origin is replaced", () => {
    const fixture = createTreatmentCFixture();
    const first = treatmentMutationOutput();
    fixture.treatment.terminalAdoptedInto(
      {
        ...treatmentMutationInputFromOutput(fixture.readyOutput, fixture.terminalTick),
        expectedCurrentLedgerVersion: fixture.ledger.version,
        outcome: "canceled",
        failureReason: "cancelled",
        interruptionKind: undefined,
      },
      fixture.ledger,
      fixture.core,
      fixture.claims,
      first,
    );
    expect(first.ok).toBe(true);
    const reuse = advanceReusedTreatment(fixture);
    const second = treatmentMutationOutput();
    fixture.treatment.terminalAdoptedInto(
      {
        ...treatmentMutationInputFromOutput(reuse.output, reuse.terminalTick),
        expectedCurrentLedgerVersion: fixture.ledger.version,
        outcome: "canceled",
        failureReason: "cancelled",
        interruptionKind: undefined,
      },
      fixture.ledger,
      fixture.core,
      fixture.claims,
      second,
    );
    expect(second).toMatchObject({ ok: true, jobCumulativeTerminalCount: 2 });
    expect(second.jobCurrentTombstoneCount).toBe(fixture.core.currentTombstoneJobCount);
    expect(second.jobCurrentTombstoneCount).toBe(1);
  });

  it("accepts origin-net-zero current headroom and rejects true destination growth", () => {
    const fixture = createTreatmentCFixture();
    const first = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(fixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      first,
    );
    refreshTreatmentStorage(fixture);
    const reuse = advanceReusedTreatment(fixture);
    refreshTreatmentStorage(fixture);
    Reflect.set(fixture.treatment, "completedCount", 0xffff_ffff);
    const reusedFixture: TreatmentCFixture = {
      ...fixture,
      readyOutput: reuse.output,
      terminalTick: reuse.terminalTick,
    };
    const completed = treatmentMutationOutput();
    fixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(reusedFixture),
      fixture.health,
      fixture.items,
      fixture.storage,
      fixture.ledger,
      fixture.core,
      fixture.claims,
      completed,
    );
    expect(completed.ok, String(completed.reason)).toBe(true);
    expect(completed).toMatchObject({ completedCount: 0xffff_ffff });

    const growthFixture = createTreatmentCFixture();
    const growthFirst = treatmentMutationOutput();
    growthFixture.treatment.completeAdoptedInto(
      treatmentCompleteInput(growthFixture),
      growthFixture.health,
      growthFixture.items,
      growthFixture.storage,
      growthFixture.ledger,
      growthFixture.core,
      growthFixture.claims,
      growthFirst,
    );
    const growthReuse = advanceReusedTreatment(growthFixture);
    Reflect.set(growthFixture.treatment, "failedCount", 0xffff_ffff);
    const before = treatmentOwnerSnapshots(growthFixture);
    const failed = treatmentMutationOutput();
    growthFixture.treatment.terminalAdoptedInto(
      {
        ...treatmentMutationInputFromOutput(growthReuse.output, growthReuse.terminalTick),
        expectedCurrentLedgerVersion: growthFixture.ledger.version,
        outcome: "failed",
        failureReason: "target_state",
        interruptionKind: undefined,
      },
      growthFixture.ledger,
      growthFixture.core,
      growthFixture.claims,
      failed,
    );
    expect(failed).toMatchObject({ ok: false, reason: "medical.adopted_state_mismatch" });
    expect(treatmentOwnerSnapshots(growthFixture)).toStrictEqual(before);
  });

  it("treats interrupted current count as a canceled subset during origin replacement", () => {
    const fixture = createTreatmentCFixture();
    const first = treatmentMutationOutput();
    fixture.treatment.terminalAdoptedInto(
      {
        ...treatmentMutationInputFromOutput(fixture.readyOutput, fixture.terminalTick),
        expectedCurrentLedgerVersion: fixture.ledger.version,
        outcome: "canceled",
        failureReason: "cancelled",
        interruptionKind: undefined,
      },
      fixture.ledger,
      fixture.core,
      fixture.claims,
      first,
    );
    const reuse = advanceReusedTreatment(fixture);
    Reflect.set(fixture.treatment, "canceledCount", 0xffff_ffff);
    const interrupted = treatmentMutationOutput();
    fixture.treatment.terminalAdoptedInto(
      {
        ...treatmentMutationInputFromOutput(reuse.output, reuse.terminalTick),
        expectedCurrentLedgerVersion: fixture.ledger.version,
        outcome: "interrupted",
        failureReason: "cancelled",
        interruptionKind: "safe_point",
      },
      fixture.ledger,
      fixture.core,
      fixture.claims,
      interrupted,
    );
    expect(interrupted).toMatchObject({
      ok: true,
      canceledCount: 0xffff_ffff,
      interruptedCount: 1,
    });
  });

  it.each([
    ["uint8 ability", "u32", 12, 0x100],
    ["uint16 minimum ability", "u32", 13, 0x1_0000],
    ["zero severity", "u32", 16, 0],
    ["severity domain", "u32", 16, 1001],
    ["zero treatment ticks", "u32", 14, 0],
    ["zero work", "u32", 15, 0],
    ["zero stock", "u32", 21, 0],
    ["uint16 ability value", "u32", 25, 0x1_0000],
    ["completed stock row", "u32", 29, 0],
    ["completed progress", "u32", 31, 0],
    ["unknown outcome", "codes", 4, 99],
    ["unknown failure", "codes", 5, 9],
    ["immediate interruption", "codes", 6, 3],
    ["terminal step", "codes", 7, 4],
    ["terminal reason", "codes", 8, 0],
    ["terminal tick", "ticks", 2, 0],
  ] as const)(
    "atomically rejects Treatment-C origin %s corruption",
    (_label, lane, index, value) => {
      const fixture = createTreatmentCFixture();
      const completed = treatmentMutationOutput();
      fixture.treatment.completeAdoptedInto(
        treatmentCompleteInput(fixture),
        fixture.health,
        fixture.items,
        fixture.storage,
        fixture.ledger,
        fixture.core,
        fixture.claims,
        completed,
      );
      const reuse = prepareTreatmentReuseAdoption(fixture);
      const adopted = medicalDriverOutput();
      fixture.treatment.adoptExistingClaimsInto(reuse.control, reuse.input, fixture.core, adopted);
      expect(adopted.ok).toBe(true);
      const snapshot = fixture.treatment.createSnapshot();
      const row = snapshot.rows[adopted.jobId];
      if (row === undefined) throw new Error("missing Treatment-C origin row");
      const originU32 = [...row.originU32];
      const originCodes = [...row.originCodes];
      const originTicks = [...row.originTicks];
      if (lane === "u32") originU32[index] = value;
      else if (lane === "codes") originCodes[index] = value;
      else originTicks[index] = value;
      const destination = createM3TreatmentJobStore(snapshot.capacity);
      expect(destination.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
      const before = destination.createSnapshot();
      const hashBefore = createM3TreatmentJobHashFields(before);
      expect(
        destination.restoreFromSnapshot(
          treatmentSnapshotWithRowPatch(snapshot, adopted.jobId, {
            originU32,
            originCodes,
            originTicks,
          }),
        ),
      ).toMatchObject({ ok: false });
      expect(destination.createSnapshot()).toStrictEqual(before);
      expect(createM3TreatmentJobHashFields(destination.createSnapshot())).toStrictEqual(
        hashBefore,
      );
    },
  );

  it.each([
    ["job id", { jobId: 3 }],
    ["job generation", { jobGeneration: 2 }],
    ["owner index", { ownerIndex: 2 }],
    ["owner generation", { ownerGeneration: 3 }],
    ["slot version", { expectedJobSlotVersion: 3 }],
    ["core version", { expectedJobCoreVersion: 3 }],
    ["driver version", { expectedDriverVersion: 2 }],
    ["negative tick", { tick: -1 }],
    ["fractional tick", { tick: 1.5 }],
    ["unsafe tick", { tick: Number.MAX_SAFE_INTEGER + 1 }],
  ] as const)(
    "rejects adopted Treatment-B %s drift before either owner mutates",
    (_label, patch) => {
      const fixture = createTreatmentAdoptionFixture();
      const beforeTreatment = fixture.treatment.createSnapshot();
      const beforeCore = fixture.core.createSnapshot();
      const output = treatmentMutationOutput();
      poisonTreatmentMutationOutput(output);
      fixture.treatment.startPathingAdoptedInto(
        { ...treatmentMutationInput(fixture, fixture.control.adoptionTick), ...patch },
        fixture.core,
        output,
      );
      expect(output.ok).toBe(false);
      expect(output.jobId).toBe(RESERVATION_CLAIM_NONE);
      expect(output.pathingCount).toBe(0);
      expect(fixture.treatment.createSnapshot()).toStrictEqual(beforeTreatment);
      expect(fixture.core.createSnapshot()).toStrictEqual(beforeCore);
    },
  );

  it("fully resets a poisoned caller-owned Treatment-B mutation output", () => {
    const fixture = createTreatmentAdoptionFixture();
    const output = treatmentMutationOutput();
    const identity = output;
    poisonTreatmentMutationOutput(output);
    fixture.treatment.startPathingAdoptedInto(
      { ...treatmentMutationInput(fixture, fixture.control.adoptionTick), tick: -1 },
      fixture.core,
      output,
    );
    expect(output).toBe(identity);
    expect(output).toStrictEqual({ ...treatmentMutationOutput(), reason: "medical.tick_invalid" });
  });

  it("preserves every claim and owner basis across Treatment-B progress", () => {
    const fixture = createTreatmentAdoptionFixture();
    const before = fixture.treatment.createSnapshot().rows[fixture.control.jobId];
    if (before === undefined) throw new Error("missing adopted treatment row");
    const output = treatmentMutationOutput();
    let input = treatmentMutationInput(fixture, Number.MAX_SAFE_INTEGER);
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    input = treatmentMutationInputFromOutput(output, Number.MAX_SAFE_INTEGER);
    fixture.treatment.beginAdoptedInto(input, fixture.core, output);
    input = treatmentMutationInputFromOutput(output, Number.MAX_SAFE_INTEGER);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    const after = fixture.treatment.createSnapshot().rows[fixture.control.jobId];
    if (after === undefined) throw new Error("missing progressed treatment row");
    expect(after.claimIds).toStrictEqual(before.claimIds);
    expect(after.claimEpochs).toStrictEqual(before.claimEpochs);
    expect(after.claimCreatedTicks).toStrictEqual(before.claimCreatedTicks);
    expect(after.claimLeaseExpiryTicks).toStrictEqual(before.claimLeaseExpiryTicks);
    expect(after.reservationVersion).toBe(before.reservationVersion);
    expect(after.conditionVersion).toBe(before.conditionVersion);
    expect(after.healthStoreVersion).toBe(before.healthStoreVersion);
    expect(after.stockStoreVersion).toBe(before.stockStoreVersion);
    expect(after.deltaApplied).toBe(0);
    expect(output).toMatchObject({
      conditionDeltaCount: 0,
      stockConsumedCount: 0,
      reservationCleanupCount: 0,
    });
  });

  it("uses the final version bump and accepts exact duplicates at uint32 max", () => {
    const fixture = createTreatmentAdoptionFixture(1);
    const output = treatmentMutationOutput();
    restoreTreatmentMutationVersions(fixture, 0xffff_fff9, 0xffff_fffc, 0xffff_fffc);
    let input = {
      ...treatmentMutationInput(fixture, fixture.control.adoptionTick),
      expectedDriverVersion: 0xffff_fff9,
      expectedJobCoreVersion: 0xffff_fffc,
      expectedJobSlotVersion: 0xffff_fffc,
    };
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      driverVersion: 0xffff_fffa,
      jobCoreVersion: 0xffff_fffc,
      jobSlotVersion: 0xffff_fffc,
    });
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick);
    fixture.treatment.beginAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: false,
      driverVersion: 0xffff_fffb,
      jobCoreVersion: 0xffff_fffd,
      jobSlotVersion: 0xffff_fffd,
    });
    input = treatmentMutationInputFromOutput(output, fixture.control.adoptionTick);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      readyToComplete: true,
      driverVersion: 0xffff_fffc,
      jobCoreVersion: 0xffff_fffe,
      jobSlotVersion: 0xffff_fffe,
    });
    restoreTreatmentMutationVersions(fixture, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff);
    input = {
      ...treatmentMutationInputFromOutput(output, fixture.control.adoptionTick),
      expectedDriverVersion: 0xffff_ffff,
      expectedJobCoreVersion: 0xffff_ffff,
      expectedJobSlotVersion: 0xffff_ffff,
    };
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({ ok: true, alreadyCommitted: true, readyToComplete: true });
    const beforeTreatment = fixture.treatment.createSnapshot();
    const beforeCore = fixture.core.createSnapshot();
    fixture.treatment.progressAdoptedInto({ ...input, tick: input.tick + 1 }, fixture.core, output);
    expect(output).toMatchObject({ ok: false, reason: "medical.step_invalid" });
    expect(fixture.treatment.createSnapshot()).toStrictEqual(beforeTreatment);
    expect(fixture.core.createSnapshot()).toStrictEqual(beforeCore);
  });

  it("uses the exact R=2 Treatment-B maximum path", () => {
    const fixture = createTreatmentAdoptionFixture(2);
    const output = treatmentMutationOutput();
    restoreTreatmentMutationVersions(fixture, 0xffff_fff8, 0xffff_fffb, 0xffff_fffb);
    let input: M3TreatmentAdoptedMutationInput = {
      ...treatmentMutationInput(fixture, fixture.control.adoptionTick),
      expectedDriverVersion: 0xffff_fff8,
      expectedJobCoreVersion: 0xffff_fffb,
      expectedJobSlotVersion: 0xffff_fffb,
    };
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      driverVersion: 0xffff_fff9,
      jobCoreVersion: 0xffff_fffb,
      jobSlotVersion: 0xffff_fffb,
    });
    input = treatmentMutationInputFromOutput(output, input.tick);
    fixture.treatment.beginAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      driverVersion: 0xffff_fffa,
      jobCoreVersion: 0xffff_fffc,
      jobSlotVersion: 0xffff_fffc,
    });
    input = treatmentMutationInputFromOutput(output, input.tick);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      readyToComplete: false,
      driverVersion: 0xffff_fffb,
      jobCoreVersion: 0xffff_fffd,
      jobSlotVersion: 0xffff_fffd,
    });
    input = treatmentMutationInputFromOutput(output, input.tick + 1);
    fixture.treatment.progressAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      readyToComplete: true,
      driverVersion: 0xffff_fffc,
      jobCoreVersion: 0xffff_fffe,
      jobSlotVersion: 0xffff_fffe,
    });
  });

  it("rejects driver, global, and shared global-slot R=1/R=2 thresholds", () => {
    for (let remaining = 1; remaining <= 2; remaining += 1) {
      for (let stage = 0; stage < 3; stage += 1) {
        for (let exhaustedOwner = 0; exhaustedOwner < 3; exhaustedOwner += 1) {
          const fixture = createTreatmentAdoptionFixture(remaining);
          const output = treatmentMutationOutput();
          let input = treatmentMutationInput(fixture, fixture.control.adoptionTick);
          if (stage >= 1) {
            fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
            expect(output.ok).toBe(true);
            input = treatmentMutationInputFromOutput(output, input.tick);
          }
          if (stage >= 2) {
            fixture.treatment.beginAdoptedInto(input, fixture.core, output);
            expect(output.ok).toBe(true);
          }
          const driverFuture = stage === 0 ? 5 : stage === 1 ? 4 : 3;
          const coreFuture = stage === 2 ? 1 : 2;
          const maxDriver = 0xffff_ffff - (remaining + driverFuture);
          const maxCore = 0xffff_ffff - (remaining + coreFuture);
          const driverVersion = maxDriver + (exhaustedOwner === 0 ? 1 : 0);
          const coreVersion = maxCore + (exhaustedOwner >= 1 ? 1 : 0);
          const slotVersion = maxCore + (exhaustedOwner === 2 ? 1 : 0);
          restoreTreatmentMutationVersions(fixture, driverVersion, coreVersion, slotVersion);
          input = {
            ...treatmentMutationInput(fixture, fixture.control.adoptionTick + stage),
            expectedDriverVersion: driverVersion,
            expectedJobCoreVersion: coreVersion,
            expectedJobSlotVersion: slotVersion,
          };
          const beforeTreatment = fixture.treatment.createSnapshot();
          const beforeCore = fixture.core.createSnapshot();
          if (stage === 0) fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
          else if (stage === 1) fixture.treatment.beginAdoptedInto(input, fixture.core, output);
          else fixture.treatment.progressAdoptedInto(input, fixture.core, output);
          const expectedReason =
            exhaustedOwner === 0
              ? "medical.driver_version_exhausted"
              : "job_core_version_exhausted";
          expect(output).toMatchObject({ ok: false, reason: expectedReason });
          expect(fixture.treatment.createSnapshot()).toStrictEqual(beforeTreatment);
          expect(fixture.core.createSnapshot()).toStrictEqual(beforeCore);
        }
      }
    }
  });

  it("lets a driver-only start duplicate succeed at uint32 max", () => {
    const fixture = createTreatmentAdoptionFixture();
    const output = treatmentMutationOutput();
    let input = treatmentMutationInput(fixture, fixture.control.adoptionTick + 1);
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    restoreTreatmentMutationVersions(
      fixture,
      0xffff_ffff,
      output.jobCoreVersion,
      output.jobSlotVersion,
    );
    input = {
      ...treatmentMutationInputFromOutput(output, fixture.control.adoptionTick + 1),
      expectedDriverVersion: 0xffff_ffff,
    };
    fixture.treatment.startPathingAdoptedInto(input, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: true,
      driverVersion: 0xffff_ffff,
    });
  });

  it.each([
    ["target", { conditionId: 13 }],
    ["required work", { treatmentTicks: 1 }],
  ] as const)("rejects a committed JobCore %s substitution", (_label, patch) => {
    const fixture = createTreatmentAdoptionFixture();
    const treatmentSnapshot = fixture.treatment.createSnapshot();
    expect(
      fixture.treatment.restoreFromSnapshot(
        treatmentSnapshotWithRowPatch(treatmentSnapshot, fixture.control.jobId, patch),
      ),
    ).toMatchObject({ ok: true });
    const beforeTreatment = fixture.treatment.createSnapshot();
    const beforeCore = fixture.core.createSnapshot();
    const output = treatmentMutationOutput();
    fixture.treatment.startPathingAdoptedInto(
      treatmentMutationInput(fixture, fixture.control.adoptionTick),
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "medical.adopted_state_mismatch" });
    expect(fixture.treatment.createSnapshot()).toStrictEqual(beforeTreatment);
    expect(fixture.core.createSnapshot()).toStrictEqual(beforeCore);
  });

  it.each([
    [
      "old schema",
      (snapshot: M3TreatmentStoreSnapshot): unknown => ({ ...snapshot, snapshotVersion: 2 }),
    ],
    [
      "last effect reversal",
      (snapshot: M3TreatmentStoreSnapshot): unknown =>
        treatmentSnapshotWithRowPatch(snapshot, 4, { lastEffectTick: 0 }),
    ],
    [
      "pathing count mismatch",
      (snapshot: M3TreatmentStoreSnapshot): unknown => ({ ...snapshot, pathingCount: 1 }),
    ],
    [
      "progress quantum mismatch",
      (snapshot: M3TreatmentStoreSnapshot): unknown =>
        treatmentSnapshotWithProgressQuantumMismatch(snapshot, 4),
    ],
  ] as const)("atomically rejects Treatment-B snapshot %s", (_label, mutate) => {
    const fixture = createTreatmentAdoptionFixture();
    const destination = createM3TreatmentJobStore(8);
    expect(destination.restoreFromSnapshot(fixture.treatment.createSnapshot())).toMatchObject({
      ok: true,
    });
    const before = destination.createSnapshot();
    const beforeHash = createM3TreatmentJobHashFields(before);
    expect(destination.restoreFromSnapshot(mutate(before))).toMatchObject({ ok: false });
    expect(destination.createSnapshot()).toStrictEqual(before);
    expect(createM3TreatmentJobHashFields(destination.createSnapshot())).toStrictEqual(beforeHash);
  });
  it.each([2, 64])(
    "rejects Treatment adopted read lane length %i with a fixed three-slot reset",
    (laneLength) => {
      const fixture = createTreatmentAdoptionFixture();
      const output = treatmentAdoptedReadOutput(laneLength);
      const ids = output.claimIds;
      const epochs = output.claimEpochs;
      const created = output.claimCreatedTicks;
      const leases = output.claimLeaseExpiryTicks;
      poisonTreatmentAdoptedOutput(output);
      fixture.treatment.readAdoptedJobInto(
        fixture.control.jobId,
        fixture.control.jobGeneration,
        fixture.control.ownerIndex,
        fixture.control.ownerGeneration,
        fixture.adopted.jobSlotVersion,
        fixture.adopted.driverVersion,
        output,
      );
      expect(output).toMatchObject({
        ok: false,
        reason: "medical.rejected_stale_owner_state",
        active: false,
        jobId: fixture.control.jobId,
        driverVersion: fixture.adopted.driverVersion,
      });
      expect(output.claimIds).toBe(ids);
      expect(output.claimEpochs).toBe(epochs);
      expect(output.claimCreatedTicks).toBe(created);
      expect(output.claimLeaseExpiryTicks).toBe(leases);
      for (let index = 0; index < Math.min(3, laneLength); index += 1) {
        expect(output.claimIds[index]).toBe(RESERVATION_CLAIM_NONE);
        expect(output.claimEpochs[index]).toBe(0);
        expect(output.claimCreatedTicks[index]).toBe(0);
        expect(output.claimLeaseExpiryTicks[index]).toBe(0);
      }
      if (laneLength > 3) {
        expect(output.claimIds[3]).toBe(99);
        expect(output.claimEpochs[3]).toBe(99);
        expect(output.claimCreatedTicks[3]).toBe(99);
        expect(output.claimLeaseExpiryTicks[3]).toBe(99);
      }
    },
  );
  it("uses only scalar JobCore adoption and rollback roots", () => {
    const prepared = prepareTreatmentAdoption();
    vi.spyOn(prepared.core, "createRunningJobInto").mockImplementation(() => {
      throw new Error("allocating JobCore create wrapper reached");
    });
    vi.spyOn(prepared.core, "rollbackRunningAutonomyJobInto").mockImplementation(() => {
      throw new Error("allocating JobCore rollback wrapper reached");
    });
    const adopted = medicalDriverOutput();
    prepared.treatment.adoptExistingClaimsInto(
      prepared.control,
      prepared.input,
      prepared.core,
      adopted,
    );
    expect(adopted.ok).toBe(true);
    const rolled = medicalDriverOutput();
    prepared.treatment.rollbackNewlyAdoptedInto(
      {
        ...prepared.control,
        expectedAdoptedJobSlotVersion: adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: adopted.driverVersion,
      },
      prepared.core,
      rolled,
    );
    expect(rolled).toMatchObject({
      ok: true,
      jobSlotVersion: 3,
      activeCount: 0,
      ownerIndex: prepared.control.ownerIndex,
      ownerGeneration: prepared.control.ownerGeneration,
    });
    const treatmentBefore = prepared.treatment.createSnapshot();
    const coreBefore = prepared.core.createSnapshot();
    const reused = medicalDriverOutput();
    prepared.treatment.adoptExistingClaimsInto(
      prepared.control,
      prepared.input,
      prepared.core,
      reused,
    );
    expect(reused).toMatchObject({ ok: false, reason: "medical.driver_version_mismatch" });
    expect(prepared.treatment.createSnapshot()).toStrictEqual(treatmentBefore);
    expect(prepared.core.createSnapshot()).toStrictEqual(coreBefore);
  });
  it("rejects malformed adoption bases before either owner mutates", () => {
    const cases: readonly ((prepared: ReturnType<typeof prepareTreatmentAdoption>) => void)[] = [
      (prepared): void => {
        prepared.input.readClaimIds[0] = 99;
      },
      (prepared): void => {
        prepared.claims.channelCodes[1] = RESERVATION_CELL;
      },
      (prepared): void => {
        prepared.claims.leaseExpiryTicks[2] = prepared.control.claimCreatedTick - 1;
      },
      (prepared): void => {
        prepared.control.adoptionTick = prepared.control.claimCreatedTick - 1;
      },
      (prepared): void => {
        prepared.control.adoptionTick = Number.MAX_SAFE_INTEGER + 1;
      },
      (prepared): void => {
        prepared.input.createdTick += 1;
      },
      (prepared): void => {
        prepared.control.expectedJobCoreVersion += 1;
      },
      (prepared): void => {
        prepared.control.expectedJobSlotVersion += 1;
      },
      (prepared): void => {
        prepared.control.ownerGeneration += 1;
      },
      (prepared): void => {
        prepared.control.jobGeneration += 1;
      },
      (prepared): void => {
        prepared.input.severityDelta = 1001;
      },
      (prepared): void => {
        prepared.input.treatmentTicks = 0xffff_ffff;
        prepared.input.workPerTickQ16 = 0xffff_ffff;
      },
      (prepared): void => {
        prepared.claims.ownerIndexes[3] = 1;
      },
      (prepared): void => {
        prepared.control.claimIds[1] = prepared.control.claimIds[0] ?? RESERVATION_CLAIM_NONE;
        prepared.input.readClaimIds[1] = prepared.input.readClaimIds[0] ?? RESERVATION_CLAIM_NONE;
      },
    ];
    for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
      const mutate = cases[caseIndex];
      if (mutate === undefined) throw new Error("missing adoption mutation case");
      const prepared = prepareTreatmentAdoption();
      const treatmentBefore = prepared.treatment.createSnapshot();
      const coreBefore = prepared.core.createSnapshot();
      mutate(prepared);
      const output = medicalDriverOutput();
      prepared.treatment.adoptExistingClaimsInto(
        prepared.control,
        prepared.input,
        prepared.core,
        output,
      );
      expect(output, `adoption mutation ${String(caseIndex)}`).toMatchObject({
        ok: false,
        reason:
          caseIndex === 6
            ? "job_version_mismatch"
            : caseIndex === 7
              ? "job_token_mismatch"
              : "medical.adoption_preflight_failed",
      });
      expect(prepared.treatment.createSnapshot()).toStrictEqual(treatmentBefore);
      expect(prepared.core.createSnapshot()).toStrictEqual(coreBefore);
    }
  });
  it.each([0, 1, 2])(
    "rejects zero allocation epoch in active Treatment claim slot %i before either owner mutates",
    (claimIndex) => {
      const prepared = prepareTreatmentAdoption();
      prepared.control.claimEpochs[claimIndex] = 0;
      prepared.input.readClaimEpochs[claimIndex] = 0;
      prepared.claims.allocationEpochs[claimIndex] = 0;
      const treatmentBefore = prepared.treatment.createSnapshot();
      const coreBefore = prepared.core.createSnapshot();
      const output = medicalDriverOutput();
      prepared.treatment.adoptExistingClaimsInto(
        prepared.control,
        prepared.input,
        prepared.core,
        output,
      );
      expect(output).toMatchObject({ ok: false, reason: "medical.adoption_preflight_failed" });
      expect(prepared.treatment.createSnapshot()).toStrictEqual(treatmentBefore);
      expect(prepared.core.createSnapshot()).toStrictEqual(coreBefore);
    },
  );
  it.each([
    [
      "channel",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.channelCodes[0] = RESERVATION_CELL),
    ],
    [
      "owner index",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.ownerIndexes[0] = (prepared.claims.ownerIndexes[0] ?? 0) + 1),
    ],
    [
      "owner generation",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.ownerGenerations[0] = (prepared.claims.ownerGenerations[0] ?? 0) + 1),
    ],
    [
      "job id",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.jobIds[0] = (prepared.claims.jobIds[0] ?? 0) + 1),
    ],
    [
      "job generation",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.jobGenerations[0] = (prepared.claims.jobGenerations[0] ?? 0) + 1),
    ],
    [
      "target presence",
      (prepared: PreparedTreatmentAdoption): void => void (prepared.claims.hasTargetFlags[0] = 0),
    ],
    [
      "target index",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.targetIndexes[0] = (prepared.claims.targetIndexes[0] ?? 0) + 1),
    ],
    [
      "target generation",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.targetGenerations[0] =
          (prepared.claims.targetGenerations[0] ?? 0) + 1),
    ],
    [
      "cell",
      (prepared: PreparedTreatmentAdoption): void => void (prepared.claims.cellIndexes[0] = 0),
    ],
    ["slot", (prepared: PreparedTreatmentAdoption): void => void (prepared.claims.slotIds[0] = 0)],
    [
      "amount",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.amounts[0] = (prepared.claims.amounts[0] ?? 0) + 1),
    ],
    [
      "allocation epoch",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.allocationEpochs[0] = (prepared.claims.allocationEpochs[0] ?? 0) + 1),
    ],
    [
      "created tick",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.createdTicks[0] = (prepared.claims.createdTicks[0] ?? 0) + 1),
    ],
    [
      "lease tick",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.claims.leaseExpiryTicks[0] = (prepared.claims.leaseExpiryTicks[0] ?? 0) + 1),
    ],
    [
      "claim reorder",
      (prepared: PreparedTreatmentAdoption): void => {
        const first = prepared.control.claimIds[0] ?? RESERVATION_CLAIM_NONE;
        prepared.control.claimIds[0] = prepared.control.claimIds[1] ?? RESERVATION_CLAIM_NONE;
        prepared.control.claimIds[1] = first;
      },
    ],
    [
      "extra tail",
      (prepared: PreparedTreatmentAdoption): void => void (prepared.claims.ownerIndexes[3] = 1),
    ],
    [
      "read id mismatch",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.input.readClaimIds[2] = (prepared.input.readClaimIds[2] ?? 0) + 1),
    ],
    [
      "read epoch mismatch",
      (prepared: PreparedTreatmentAdoption): void =>
        void (prepared.input.readClaimEpochs[2] = (prepared.input.readClaimEpochs[2] ?? 0) + 1),
    ],
  ] as const)("rejects exact Treatment claim %s drift before any owner write", (_label, mutate) => {
    const prepared = prepareTreatmentAdoption();
    const treatmentBefore = prepared.treatment.createSnapshot();
    const coreBefore = prepared.core.createSnapshot();
    mutate(prepared);
    const output = medicalDriverOutput();
    prepared.treatment.adoptExistingClaimsInto(
      prepared.control,
      prepared.input,
      prepared.core,
      output,
    );
    expect(output).toMatchObject({ ok: false, reason: "medical.adoption_preflight_failed" });
    expect(prepared.treatment.createSnapshot()).toStrictEqual(treatmentBefore);
    expect(prepared.core.createSnapshot()).toStrictEqual(coreBefore);
  });
  it("reports JobCore and Treatment active counts independently on adopt and rollback", () => {
    const prepared = prepareTreatmentAdoption();
    expect(
      prepared.core.createJob({
        jobId: 0,
        owner: { index: 0, generation: 1 },
        jobKind: 1,
        targetId: 1,
        initialStep: "reserve",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: 0,
      }),
    ).toMatchObject({ ok: true });
    prepared.control.expectedJobCoreVersion = prepared.core.version;
    const adopted = medicalDriverOutput();
    prepared.treatment.adoptExistingClaimsInto(
      prepared.control,
      prepared.input,
      prepared.core,
      adopted,
    );
    expect(adopted).toMatchObject({ ok: true, activeCount: 1, jobActiveCount: 2 });
    const rolled = medicalDriverOutput();
    prepared.treatment.rollbackNewlyAdoptedInto(
      {
        ...prepared.control,
        expectedAdoptedJobSlotVersion: adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: adopted.driverVersion,
      },
      prepared.core,
      rolled,
    );
    expect(rolled).toMatchObject({ ok: true, activeCount: 0, jobActiveCount: 1 });
  });
  it.each([
    ["core fffc", 0xffff_fffc, 1, true, undefined],
    ["core fffd", 0xffff_fffd, 1, false, "job_core_version_exhausted"],
    ["core fffe", 0xffff_fffe, 1, false, "job_core_version_exhausted"],
    ["core ffff", 0xffff_ffff, 1, false, "job_core_version_exhausted"],
    ["slot fffc", 0xffff_fffc, 0xffff_fffc, true, undefined],
    ["slot fffd", 0xffff_fffd, 0xffff_fffd, false, "job_slot_version_exhausted"],
    ["slot fffe", 0xffff_fffe, 0xffff_fffe, false, "job_slot_version_exhausted"],
    ["slot ffff", 0xffff_ffff, 0xffff_ffff, false, "job_slot_version_exhausted"],
  ] as const)(
    "classifies Treatment adoption %s boundary without wrapping",
    (_label, coreVersion, slotVersion, accepted, reason) => {
      const prepared = prepareTreatmentAdoption();
      restorePreparedJobCoreVersions(prepared, coreVersion, slotVersion);
      const treatmentBefore = prepared.treatment.createSnapshot();
      const coreBefore = prepared.core.createSnapshot();
      const output = medicalDriverOutput();
      prepared.treatment.adoptExistingClaimsInto(
        prepared.control,
        prepared.input,
        prepared.core,
        output,
      );
      if (accepted) {
        expect(output).toMatchObject({
          ok: true,
          jobCoreVersion: coreVersion + 1,
          jobSlotVersion: slotVersion + 1,
        });
      } else {
        expect(output).toMatchObject({ ok: false, reason });
        expect(prepared.treatment.createSnapshot()).toStrictEqual(treatmentBefore);
        expect(prepared.core.createSnapshot()).toStrictEqual(coreBefore);
      }
    },
  );
  it("uses the final uint32 driver versions without wrapping", () => {
    const prepared = prepareTreatmentAdoption();
    const nearEnd = createM3TreatmentJobStore(8);
    const empty = nearEnd.createSnapshot();
    expect(nearEnd.restoreFromSnapshot({ ...empty, storeVersion: 0xffff_fffd })).toMatchObject({
      ok: true,
    });
    prepared.control.expectedDriverVersion = 0xffff_fffd;
    const adopted = medicalDriverOutput();
    nearEnd.adoptExistingClaimsInto(prepared.control, prepared.input, prepared.core, adopted);
    expect(adopted).toMatchObject({ ok: true, driverVersion: 0xffff_fffe });
    const rolled = medicalDriverOutput();
    nearEnd.rollbackNewlyAdoptedInto(
      {
        ...prepared.control,
        expectedAdoptedJobSlotVersion: adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: adopted.driverVersion,
      },
      prepared.core,
      rolled,
    );
    expect(rolled).toMatchObject({ ok: true, driverVersion: 0xffff_ffff });
    const rollbackExhausted = medicalDriverOutput();
    nearEnd.rollbackNewlyAdoptedInto(
      {
        ...prepared.control,
        expectedAdoptedJobSlotVersion: rolled.jobSlotVersion,
        expectedAdoptedDriverVersion: rolled.driverVersion,
      },
      prepared.core,
      rollbackExhausted,
    );
    expect(rollbackExhausted).toMatchObject({
      ok: false,
      reason: "medical.driver_version_exhausted",
      jobActiveCount: 0,
    });

    const exhausted = createM3TreatmentJobStore(8);
    expect(exhausted.restoreFromSnapshot({ ...empty, storeVersion: 0xffff_ffff })).toMatchObject({
      ok: true,
    });
    const coreBefore = prepareTreatmentAdoption();
    coreBefore.control.expectedDriverVersion = 0xffff_ffff;
    const coreSnapshot = coreBefore.core.createSnapshot();
    const rejected = medicalDriverOutput();
    exhausted.adoptExistingClaimsInto(
      coreBefore.control,
      coreBefore.input,
      coreBefore.core,
      rejected,
    );
    expect(rejected).toMatchObject({ ok: false, reason: "medical.driver_version_exhausted" });
    expect(coreBefore.core.createSnapshot()).toStrictEqual(coreSnapshot);
  });
  it("uses the last reachable JobCore and slot rollback basis without wrapping", () => {
    const prepared = prepareTreatmentAdoption();
    restorePreparedJobCoreVersions(prepared, 0xffff_fffc, 0xffff_fffc);
    const adopted = medicalDriverOutput();
    prepared.treatment.adoptExistingClaimsInto(
      prepared.control,
      prepared.input,
      prepared.core,
      adopted,
    );
    expect(adopted).toMatchObject({
      ok: true,
      jobCoreVersion: 0xffff_fffd,
      jobSlotVersion: 0xffff_fffd,
    });
    const rolled = medicalDriverOutput();
    prepared.treatment.rollbackNewlyAdoptedInto(
      {
        ...prepared.control,
        expectedAdoptedJobSlotVersion: adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: adopted.driverVersion,
      },
      prepared.core,
      rolled,
    );
    expect(rolled).toMatchObject({
      ok: true,
      jobCoreVersion: 0xffff_fffe,
      jobSlotVersion: 0xffff_fffe,
    });
  });
  it.each([
    ["driver mismatch", 1, undefined, undefined, "medical.driver_version_mismatch"],
    ["core mismatch", 0, 2, undefined, "job_version_mismatch"],
    ["slot mismatch", 0, undefined, 3, "job_token_mismatch"],
    ["core fffd exhausted", 0, 0xffff_fffd, undefined, "job_core_version_exhausted"],
    ["core fffe exhausted", 0, 0xffff_fffe, undefined, "job_core_version_exhausted"],
    ["core ffff exhausted", 0, 0xffff_ffff, undefined, "job_core_version_exhausted"],
    ["slot fffe exhausted", 0, undefined, 0xffff_fffe, "job_slot_version_exhausted"],
    ["slot ffff exhausted", 0, undefined, 0xffff_ffff, "job_slot_version_exhausted"],
  ] as const)(
    "classifies Treatment rollback %s before either owner mutates",
    (_label, driverDelta, coreVersion, slotVersion, reason) => {
      const fixture = createTreatmentAdoptionFixture();
      const treatmentBefore = fixture.treatment.createSnapshot();
      const coreBefore = fixture.core.createSnapshot();
      const output = medicalDriverOutput();
      fixture.treatment.rollbackNewlyAdoptedInto(
        {
          ...fixture.control,
          expectedJobCoreVersion: coreVersion ?? fixture.control.expectedJobCoreVersion,
          expectedAdoptedJobSlotVersion: slotVersion ?? fixture.adopted.jobSlotVersion,
          expectedAdoptedDriverVersion: fixture.adopted.driverVersion + driverDelta,
        },
        fixture.core,
        output,
      );
      expect(output).toMatchObject({ ok: false, reason });
      expect(fixture.treatment.createSnapshot()).toStrictEqual(treatmentBefore);
      expect(fixture.core.createSnapshot()).toStrictEqual(coreBefore);
    },
  );
  it("roundtrips and hashes dense v3 adopted and rollback-shadow rows", () => {
    const fixture = createTreatmentAdoptionFixture();
    const snapshot = fixture.treatment.createSnapshot();
    const fields = createM3TreatmentJobHashFields(snapshot);
    expect(
      fields.some(
        (field) =>
          field.name.endsWith("claimLeaseExpiryTick.2") &&
          field.value === fixture.control.claimLeaseExpiryTicks[2],
      ),
    ).toBe(true);
    const restored = createM3TreatmentJobStore(8);
    expect(restored.restoreFromSnapshot(snapshot)).toEqual({
      ok: true,
      version: 1,
      activeCount: 1,
    });
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    const reordered = {
      rows: snapshot.rows,
      staleBasisRejectCount: snapshot.staleBasisRejectCount,
      pathFailureCount: snapshot.pathFailureCount,
      reservationCleanupCount: snapshot.reservationCleanupCount,
      stockConsumedCount: snapshot.stockConsumedCount,
      conditionDeltaCount: snapshot.conditionDeltaCount,
      failedCount: snapshot.failedCount,
      interruptedCount: snapshot.interruptedCount,
      cumulativeCompletedCount: snapshot.cumulativeCompletedCount,
      cumulativeCanceledCount: snapshot.cumulativeCanceledCount,
      cumulativeFailedCount: snapshot.cumulativeFailedCount,
      cumulativeInterruptedCount: snapshot.cumulativeInterruptedCount,
      canceledCount: snapshot.canceledCount,
      completedCount: snapshot.completedCount,
      treatingCount: snapshot.treatingCount,
      pathingCount: snapshot.pathingCount,
      reservedCount: snapshot.reservedCount,
      activeCount: snapshot.activeCount,
      storeVersion: snapshot.storeVersion,
      capacity: snapshot.capacity,
      snapshotVersion: snapshot.snapshotVersion,
    };
    expect(restored.restoreFromSnapshot(reordered)).toMatchObject({ ok: true });
    const before = restored.createSnapshot();
    const reversedRows: unknown[] = [];
    for (const row of snapshot.rows) {
      reversedRows.push(Object.fromEntries(Object.entries(row).reverse()));
    }
    expect(restored.restoreFromSnapshot({ ...reordered, rows: reversedRows })).toMatchObject({
      ok: true,
    });
    const malformed: readonly unknown[] = [
      { ...snapshot, extra: 1 },
      treatmentSnapshotWithRowPatch(snapshot, fixture.control.jobId, { ownerGeneration: 0 }),
      treatmentSnapshotWithRowPatch(snapshot, fixture.control.jobId, {
        claimCreatedTicks: [
          0,
          snapshot.rows[fixture.control.jobId]?.createdTick,
          snapshot.rows[fixture.control.jobId]?.createdTick,
        ],
      }),
      treatmentSnapshotWithRowPatch(snapshot, fixture.control.jobId, { terminalReasonCode: 0 }),
      treatmentSnapshotWithRowPatch(snapshot, fixture.control.jobId, { deltaApplied: 2 }),
      treatmentSnapshotWithRowPatch(snapshot, fixture.control.jobId, { jobGeneration: 0 }),
      treatmentSnapshotWithMissingRowKey(snapshot, fixture.control.jobId, "terminalReasonCode"),
    ];
    for (const candidate of malformed) {
      expect(restored.restoreFromSnapshot(candidate)).toMatchObject({ ok: false });
      expect(restored.createSnapshot()).toStrictEqual(before);
    }
    expect(restored.restoreFromSnapshot({ ...snapshot, snapshotVersion: 1 })).toEqual({
      ok: false,
      reason: "medical.snapshot_version_unsupported",
    });
    expect(restored.createSnapshot()).toStrictEqual(before);
    const rolled = medicalDriverOutput();
    restored.rollbackNewlyAdoptedInto(
      {
        ...fixture.control,
        expectedAdoptedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedAdoptedDriverVersion: fixture.adopted.driverVersion,
      },
      fixture.core,
      rolled,
    );
    expect(rolled.ok).toBe(true);
    const rolledSnapshot = restored.createSnapshot();
    expect(rolledSnapshot.rows[fixture.control.jobId]).toMatchObject({
      active: 0,
      jobGeneration: 0,
      jobSlotVersion: 3,
      stepCode: 2,
    });
    const rolledRestored = createM3TreatmentJobStore(8);
    expect(rolledRestored.restoreFromSnapshot(rolledSnapshot)).toMatchObject({ ok: true });
    expect(rolledRestored.createSnapshot()).toStrictEqual(rolledSnapshot);
  });
  it.each(treatmentAdoptedSnapshotCorruptions())(
    "atomically rejects adopted snapshot %s corruption",
    (_label, patch) => {
      const fixture = createTreatmentAdoptionFixture();
      const snapshot = fixture.treatment.createSnapshot();
      const restored = createM3TreatmentJobStore(8);
      expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
      const before = restored.createSnapshot();
      const beforeHash = createM3TreatmentJobHashFields(before);
      expect(
        restored.restoreFromSnapshot(
          treatmentSnapshotWithRowPatch(snapshot, fixture.control.jobId, patch),
        ),
      ).toMatchObject({ ok: false });
      expect(restored.createSnapshot()).toStrictEqual(before);
      expect(createM3TreatmentJobHashFields(restored.createSnapshot())).toStrictEqual(beforeHash);
    },
  );
  it.each(treatmentLegacySnapshotCorruptions())(
    "atomically rejects legacy active snapshot %s corruption",
    (_label, patch) => {
      const fixture = createReadyTreatmentFixture();
      expect(createTreatmentJob(fixture, 0)).toMatchObject({ ok: true });
      const snapshot = fixture.treatments.createSnapshot();
      const restored = createM3TreatmentJobStore(snapshot.capacity);
      expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
      const before = restored.createSnapshot();
      const beforeHash = createM3TreatmentJobHashFields(before);
      expect(
        restored.restoreFromSnapshot(treatmentSnapshotWithRowPatch(snapshot, 0, patch)),
      ).toMatchObject({ ok: false });
      expect(restored.createSnapshot()).toStrictEqual(before);
      expect(createM3TreatmentJobHashFields(restored.createSnapshot())).toStrictEqual(beforeHash);
    },
  );
  it("roundtrips a real legacy active row with zero severity delta", () => {
    const fixture = createReadyTreatmentFixture();
    expect(createTreatmentJob(fixture, 0, STACK_BANDAGE, 0)).toMatchObject({ ok: true });
    const snapshot = fixture.treatments.createSnapshot();
    expect(snapshot.rows[0]).toMatchObject({ active: 1, jobGeneration: 0, severityDelta: 0 });
    const restored = createM3TreatmentJobStore(snapshot.capacity);
    expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    expect(createM3TreatmentJobHashFields(restored.createSnapshot())).toStrictEqual(
      createM3TreatmentJobHashFields(snapshot),
    );
  });
  it.each(treatmentRollbackSnapshotCorruptions())(
    "atomically rejects rollback-shadow %s corruption",
    (_label, patchRow) => {
      const fixture = createTreatmentAdoptionFixture();
      const rolled = medicalDriverOutput();
      fixture.treatment.rollbackNewlyAdoptedInto(
        {
          ...fixture.control,
          expectedAdoptedJobSlotVersion: fixture.adopted.jobSlotVersion,
          expectedAdoptedDriverVersion: fixture.adopted.driverVersion,
        },
        fixture.core,
        rolled,
      );
      expect(rolled.ok).toBe(true);
      const snapshot = fixture.treatment.createSnapshot();
      const row = snapshot.rows[fixture.control.jobId];
      if (row === undefined) throw new Error("missing rollback shadow row");
      const restored = createM3TreatmentJobStore(8);
      expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
      const before = restored.createSnapshot();
      const beforeHash = createM3TreatmentJobHashFields(before);
      expect(
        restored.restoreFromSnapshot(
          treatmentSnapshotWithRowPatch(snapshot, fixture.control.jobId, patchRow(row)),
        ),
      ).toMatchObject({ ok: false });
      expect(restored.createSnapshot()).toStrictEqual(before);
      expect(createM3TreatmentJobHashFields(restored.createSnapshot())).toStrictEqual(beforeHash);
    },
  );
  it("reads patient and caregiver rows into reusable flat outputs", () => {
    const fixture = createReadyTreatmentFixture();
    const legacyPatient = fixture.medical.readPatientRequest(REQUEST_YAO_SPRAIN);
    const legacyCaregiver = fixture.medical.readCaregiverState(ACTOR_MIN);
    if (legacyPatient === undefined || legacyCaregiver === undefined) {
      throw new Error("missing medical owner rows");
    }
    const patientOutput = createPatientRequestIntoOutput();
    const caregiverOutput = createCaregiverStateIntoOutput();
    const patientIdentity = patientOutput;
    const caregiverIdentity = caregiverOutput;
    const legacyPatientRead = vi
      .spyOn(fixture.medical, "readPatientRequest")
      .mockImplementation(() => {
        throw new Error("materializing readPatientRequest called");
      });
    const legacyCaregiverRead = vi
      .spyOn(fixture.medical, "readCaregiverState")
      .mockImplementation(() => {
        throw new Error("materializing readCaregiverState called");
      });

    fixture.medical.readPatientRequestInto(REQUEST_YAO_SPRAIN, patientOutput);
    expect(patientOutput).toEqual({
      ok: true,
      reason: undefined,
      ...legacyPatient,
      active: true,
      medicalStoreVersion: 2,
    });
    expect(patientOutput).toBe(patientIdentity);

    fixture.medical.readCaregiverStateInto(ACTOR_MIN, caregiverOutput);
    expect(caregiverOutput).toEqual({
      ok: true,
      reason: undefined,
      ...legacyCaregiver,
      medicalStoreVersion: 2,
    });
    expect(caregiverOutput).toBe(caregiverIdentity);
    expect(legacyPatientRead).not.toHaveBeenCalled();
    expect(legacyCaregiverRead).not.toHaveBeenCalled();

    fixture.medical.readPatientRequestInto(1, patientOutput);
    expect(patientOutput).toEqual({
      ok: false,
      reason: "medical.no_patient",
      requestId: 1,
      active: false,
      patientId: 0,
      conditionId: 0,
      regionId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      treatmentDefId: 0,
      stockDefId: 0,
      stockAmount: 0,
      targetCellIndex: 0,
      scoreMilli: 0,
      conditionVersion: 0,
      actorConditionVersion: 0,
      healthStoreVersion: 0,
      severity: 0,
      clueRef: 0,
      counterevidenceRef: 0,
      medicalStoreVersion: 2,
    });
    expect(patientOutput).toBe(patientIdentity);

    fixture.medical.readPatientRequestInto(-1, patientOutput);
    expect(patientOutput).toEqual({
      ok: false,
      reason: "medical.request_id_out_of_range",
      requestId: -1,
      active: false,
      patientId: 0,
      conditionId: 0,
      regionId: 0,
      urgencyBucket: 0,
      permissionId: 0,
      treatmentDefId: 0,
      stockDefId: 0,
      stockAmount: 0,
      targetCellIndex: 0,
      scoreMilli: 0,
      conditionVersion: 0,
      actorConditionVersion: 0,
      healthStoreVersion: 0,
      severity: 0,
      clueRef: 0,
      counterevidenceRef: 0,
      medicalStoreVersion: 2,
    });
    expect(patientOutput).toBe(patientIdentity);

    fixture.medical.readCaregiverStateInto(1, caregiverOutput);
    expect(caregiverOutput).toEqual({
      ok: false,
      reason: "medical.rejected_caregiver_ability",
      caregiverId: 1,
      valid: false,
      regionId: 0,
      permissionId: 0,
      ability: 0,
      minimumValue: 0,
      allowed: false,
      abilityValue: 0,
      actorConditionVersion: 0,
      baseAbilityVersion: 0,
      medicalStoreVersion: 2,
    });
    expect(caregiverOutput).toBe(caregiverIdentity);

    fixture.medical.readCaregiverStateInto(-1, caregiverOutput);
    expect(caregiverOutput).toEqual({
      ok: false,
      reason: "medical.actor_out_of_range",
      caregiverId: -1,
      valid: false,
      regionId: 0,
      permissionId: 0,
      ability: 0,
      minimumValue: 0,
      allowed: false,
      abilityValue: 0,
      actorConditionVersion: 0,
      baseAbilityVersion: 0,
      medicalStoreVersion: 2,
    });
    expect(caregiverOutput).toBe(caregiverIdentity);
    expect(legacyPatientRead).not.toHaveBeenCalled();
    expect(legacyCaregiverRead).not.toHaveBeenCalled();
  });

  it("selects coherent caller-owned medical rows without materializing owner views", () => {
    const fixture = createMedicalFixture();
    const requestInputs = [
      { ...createRequestFor(CONDITION_YAO_SPRAIN, 0, 900), targetCellIndex: 9 },
      { ...createRequestFor(CONDITION_YAO_SPRAIN, 1, 900), targetCellIndex: 1 },
      { ...createRequestFor(CONDITION_YAO_SPRAIN, 2, 1_000), targetCellIndex: 7 },
    ];
    for (const input of requestInputs) {
      expect(
        fixture.medical.upsertPatientRequestFromCondition(input, fixture.health),
      ).toMatchObject({ ok: true });
    }
    allowCaregiver(fixture);
    const options = createMedicalSelectionOptions();
    const legacyScratch = createSelectionScratch();
    const legacy = fixture.medical.selectTreatmentRequests(options, fixture.health, legacyScratch);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy medical selection failure: ${legacy.reason}`);
    }
    const first = fixture.medical.readPatientRequest(2) ?? failMissingMedicalPatient();
    const caregiver = fixture.medical.readCaregiverState(ACTOR_MIN) ?? failMissingCaregiver();
    const scratch = createMedicalSelectionIntoScratch();
    const output = createMedicalSelectionIntoOutput();
    const outputIdentity = output;
    const scratchIdentity = scratch;
    const patientReadIdentity = scratch.patientReadOutput;
    const caregiverReadIdentity = scratch.caregiverReadOutput;
    const abilityOutputIdentity = scratch.abilityQueryOutput;
    const patientReadSpy = vi
      .spyOn(fixture.medical, "readPatientRequest")
      .mockImplementation(() => {
        throw new Error("materializing medical patient read called");
      });
    const caregiverReadSpy = vi
      .spyOn(fixture.medical, "readCaregiverState")
      .mockImplementation(() => {
        throw new Error("materializing caregiver read called");
      });
    const conditionReadSpy = vi.spyOn(fixture.health, "readCondition").mockImplementation(() => {
      throw new Error("materializing condition read called");
    });
    const abilityReadSpy = vi.spyOn(fixture.abilities, "queryAbility").mockImplementation(() => {
      throw new Error("materializing ability query called");
    });

    fixture.medical.selectTreatmentRequestsInto(
      options,
      fixture.health,
      fixture.abilities,
      scratch,
      output,
    );
    expect(output).toEqual({
      ok: true,
      reason: legacy.reason,
      queryCaregiverId: options.caregiverId,
      queryRegionId: options.regionId,
      queryUrgencyBucket: options.urgencyBucket,
      queryPermissionId: options.permissionId,
      candidateCap: options.candidateCap,
      maxSelectedRequests: options.maxSelectedRequests,
      bucketCandidateCount: 3,
      visitedCount: legacy.visitedCount,
      scoredCount: legacy.scoredCount,
      selectedCount: legacy.selectedCount,
      candidateCapHit: false,
      selectedCapHit: false,
      rejectedByCandidateCap: legacy.rejectedByCandidateCap,
      rejectedByPermission: legacy.rejectedByPermission,
      rejectedByAbility: legacy.rejectedByAbility,
      rejectedByCondition: legacy.rejectedByCondition,
      rejectedByStaleBasis: legacy.rejectedByStaleBasis,
      selectedRequestId: first.requestId,
      selectedPatientId: first.patientId,
      selectedConditionId: first.conditionId,
      selectedRegionId: first.regionId,
      selectedUrgencyBucket: first.urgencyBucket,
      selectedPermissionId: first.permissionId,
      selectedTreatmentDefId: first.treatmentDefId,
      selectedStockDefId: first.stockDefId,
      selectedStockAmount: first.stockAmount,
      selectedTargetCellIndex: first.targetCellIndex,
      selectedScoreMilli: first.scoreMilli,
      selectedConditionVersion: first.conditionVersion,
      selectedActorConditionVersion: first.actorConditionVersion,
      selectedHealthStoreVersion: first.healthStoreVersion,
      selectedSeverity: first.severity,
      selectedClueRef: first.clueRef,
      selectedCounterevidenceRef: first.counterevidenceRef,
      selectedCaregiverId: caregiver.caregiverId,
      caregiverRegionId: caregiver.regionId,
      caregiverPermissionId: caregiver.permissionId,
      caregiverAbility: caregiver.ability,
      caregiverMinimumValue: caregiver.minimumValue,
      caregiverAbilityValue: caregiver.abilityValue,
      caregiverActorConditionVersion: caregiver.actorConditionVersion,
      caregiverBaseAbilityVersion: caregiver.baseAbilityVersion,
      caregiverValid: caregiver.valid,
      caregiverAllowed: caregiver.allowed,
      medicalStoreVersion: fixture.medical.version,
      healthStoreVersion: fixture.health.storeVersion,
    });
    expect(Array.from(legacyScratch.selectedRequestIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.requestIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.scoresMilli.subarray(0, 3))).toEqual([1_000, 900, 900]);
    expect(Array.from(scratch.targetCellIndexes.subarray(0, 3))).toEqual([7, 9, 1]);
    for (let index = 0; index < output.selectedCount; index += 1) {
      const requestId = scratch.requestIds[index] ?? M3_MEDICAL_NO_REQUEST;
      expectMedicalSelectionScratchRow(scratch, index, requestId, fixture);
    }
    expect(output).toBe(outputIdentity);
    expect(scratch).toBe(scratchIdentity);
    expect(scratch.patientReadOutput).toBe(patientReadIdentity);
    expect(scratch.caregiverReadOutput).toBe(caregiverReadIdentity);
    expect(scratch.abilityQueryOutput).toBe(abilityOutputIdentity);
    expect(patientReadSpy).not.toHaveBeenCalled();
    expect(caregiverReadSpy).not.toHaveBeenCalled();
    expect(conditionReadSpy).not.toHaveBeenCalled();
    expect(abilityReadSpy).not.toHaveBeenCalled();
  });

  it("reports exact medical bucket totals beyond the 24/12 bounded traversal", () => {
    const fixture = createMedicalFixture(30);
    for (let requestId = 0; requestId < 30; requestId += 1) {
      expect(
        fixture.medical.upsertPatientRequestFromCondition(
          {
            ...createRequestFor(CONDITION_YAO_SPRAIN, requestId, 10_000 - requestId),
            targetCellIndex: requestId,
          },
          fixture.health,
        ),
      ).toMatchObject({ ok: true });
    }
    allowCaregiver(fixture);
    const scratch = createMedicalSelectionIntoScratch();
    const output = createMedicalSelectionIntoOutput();
    const options = createMedicalSelectionOptions();
    const legacyScratch = createSelectionScratch();
    const legacy = fixture.medical.selectTreatmentRequests(options, fixture.health, legacyScratch);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy medical selection failure: ${legacy.reason}`);
    }

    fixture.medical.selectTreatmentRequestsInto(
      options,
      fixture.health,
      fixture.abilities,
      scratch,
      output,
    );
    expect(legacy.bucketCandidateCount).toBe(24);
    expect(output).toMatchObject({
      ok: true,
      reason: "medical.candidate_cap_reached",
      bucketCandidateCount: 30,
      visitedCount: 24,
      scoredCount: 24,
      selectedCount: 12,
      candidateCapHit: true,
      selectedCapHit: true,
      rejectedByCandidateCap: 1,
      selectedRequestId: 0,
    });
    expect(Array.from(scratch.requestIds)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const smallOptions = createMedicalSelectionOptions({ candidateCap: 3, maxSelectedRequests: 2 });
    fixture.medical.selectTreatmentRequestsInto(
      smallOptions,
      fixture.health,
      fixture.abilities,
      scratch,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      bucketCandidateCount: 30,
      visitedCount: 3,
      scoredCount: 3,
      selectedCount: 2,
      candidateCapHit: true,
      selectedCapHit: true,
      candidateCap: 3,
      maxSelectedRequests: 2,
    });
    expect(Array.from(scratch.requestIds.subarray(0, 4))).toEqual([
      0,
      1,
      M3_MEDICAL_NO_REQUEST,
      M3_MEDICAL_NO_REQUEST,
    ]);
  });

  it("rejects invalid medical caps and every undersized Into lane before traversal", () => {
    const fixture = createReadyTreatmentFixture();
    const metricsBefore = fixture.medical.createMetrics();
    const invalidOptions = [
      createMedicalSelectionOptions({ candidateCap: 0 }),
      createMedicalSelectionOptions({ candidateCap: 25 }),
      createMedicalSelectionOptions({ maxSelectedRequests: 0 }),
      createMedicalSelectionOptions({ maxSelectedRequests: 13 }),
    ];
    for (const options of invalidOptions) {
      const scratch = createMedicalSelectionIntoScratch();
      const output = createMedicalSelectionIntoOutput();
      fixture.medical.selectTreatmentRequestsInto(
        options,
        fixture.health,
        fixture.abilities,
        scratch,
        output,
      );
      expect(output).toEqual(
        createMedicalSelectionResetOutput(options, fixture, "medical.value_out_of_range"),
      );
      expectMedicalSelectionScratchReset(scratch, fixture);
    }
    for (const lane of MEDICAL_SELECTION_SCRATCH_LANES) {
      const options = createMedicalSelectionOptions();
      const scratch = createMedicalSelectionIntoScratch(lane);
      const output = createMedicalSelectionIntoOutput();
      fixture.medical.selectTreatmentRequestsInto(
        options,
        fixture.health,
        fixture.abilities,
        scratch,
        output,
      );
      expect(output).toEqual(
        createMedicalSelectionResetOutput(options, fixture, "medical.selected_buffer_too_small"),
      );
      expectMedicalSelectionScratchReset(scratch, fixture);
    }
    expect(fixture.medical.createMetrics()).toEqual(metricsBefore);
  });

  it("rejects caregiver and patient staleness without trusting medical version alone", () => {
    const caregiverFixture = createReadyTreatmentFixture();
    const medicalVersion = caregiverFixture.medical.version;
    expect(
      caregiverFixture.abilities.setBaseAbility(ACTOR_MIN, M3_ABILITY_MANIPULATION, 800),
    ).toEqual({ ok: true });
    const caregiverScratch = createMedicalSelectionIntoScratch();
    const caregiverOutput = createMedicalSelectionIntoOutput();
    caregiverFixture.medical.selectTreatmentRequestsInto(
      createMedicalSelectionOptions(),
      caregiverFixture.health,
      caregiverFixture.abilities,
      caregiverScratch,
      caregiverOutput,
    );
    expect(caregiverFixture.medical.version).toBe(medicalVersion);
    expect(caregiverOutput).toMatchObject({
      ok: false,
      reason: "medical.rejected_stale_owner_state",
      rejectedByStaleBasis: 1,
      medicalStoreVersion: medicalVersion,
      visitedCount: 0,
    });

    const finalFixture = createReadyTreatmentFixture();
    const finalMedicalVersion = finalFixture.medical.version;
    const finalScratch = createMedicalSelectionIntoScratch();
    const finalOutput = createMedicalSelectionIntoOutput();
    const originalPatientRead = finalFixture.medical.readPatientRequestInto.bind(
      finalFixture.medical,
    );
    let abilityVersionAdvanced = false;
    const patientReadSpy = vi
      .spyOn(finalFixture.medical, "readPatientRequestInto")
      .mockImplementation((requestId, readOutput) => {
        originalPatientRead(requestId, readOutput);
        if (requestId === REQUEST_YAO_SPRAIN && !abilityVersionAdvanced) {
          expect(
            finalFixture.abilities.setBaseAbility(ACTOR_MIN, M3_ABILITY_MANIPULATION, 800),
          ).toEqual({ ok: true });
          abilityVersionAdvanced = true;
        }
      });
    const finalOptions = createMedicalSelectionOptions();
    finalFixture.medical.selectTreatmentRequestsInto(
      finalOptions,
      finalFixture.health,
      finalFixture.abilities,
      finalScratch,
      finalOutput,
    );
    patientReadSpy.mockRestore();
    expect(abilityVersionAdvanced).toBe(true);
    expect(finalFixture.medical.version).toBe(finalMedicalVersion);
    expect(finalOutput).toEqual({
      ...createMedicalSelectionResetOutput(
        finalOptions,
        finalFixture,
        "medical.rejected_stale_owner_state",
      ),
      rejectedByStaleBasis: 1,
    });
    expectMedicalSelectionScratchReset(finalScratch, finalFixture);
    expect(finalFixture.medical.createMetrics()).toMatchObject({
      selectionCount: 0,
      candidateVisitedCount: 0,
      staleBasisRejectCount: 1,
    });

    const patientFixture = createReadyTreatmentFixture();
    const patientMedicalVersion = patientFixture.medical.version;
    expect(
      patientFixture.health.updateCondition({
        conditionId: CONDITION_YAO_SPRAIN,
        severity: 300,
      }),
    ).toMatchObject({ ok: true });
    const patientScratch = createMedicalSelectionIntoScratch();
    const patientOutput = createMedicalSelectionIntoOutput();
    const conditionReadSpy = vi
      .spyOn(patientFixture.health, "readCondition")
      .mockImplementation(() => {
        throw new Error("materializing condition read called");
      });
    patientFixture.medical.selectTreatmentRequestsInto(
      createMedicalSelectionOptions(),
      patientFixture.health,
      patientFixture.abilities,
      patientScratch,
      patientOutput,
    );
    expect(patientFixture.medical.version).toBe(patientMedicalVersion);
    expect(patientOutput).toMatchObject({
      ok: false,
      reason: "medical.no_patient",
      bucketCandidateCount: 1,
      visitedCount: 1,
      scoredCount: 0,
      selectedCount: 0,
      rejectedByStaleBasis: 1,
      medicalStoreVersion: patientMedicalVersion,
      healthStoreVersion: patientFixture.health.storeVersion,
    });
    expect(conditionReadSpy).not.toHaveBeenCalled();
  });

  it("selects treatment offers from patient owner state and caregiver ability state", () => {
    const fixture = createMedicalFixture();
    const scratch = createSelectionScratch();

    expect(
      fixture.medical.upsertPatientRequestFromCondition(createRequest(), fixture.health),
    ).toMatchObject({ ok: true, reason: "medical.offer_created" });
    expect(
      fixture.medical.updateCaregiverStateFromAbility(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          permissionId: PERMISSION_CLINIC,
          ability: M3_ABILITY_MANIPULATION,
          minimumValue: 700,
          allowed: true,
        },
        fixture.health,
        fixture.abilities,
      ),
    ).toMatchObject({ ok: true });

    const selected = fixture.medical.selectTreatmentRequests(
      {
        caregiverId: ACTOR_MIN,
        regionId: REGION_CLINIC,
        urgencyBucket: URGENCY_HIGH,
        permissionId: PERMISSION_CLINIC,
        candidateCap: 24,
        maxSelectedRequests: 12,
      },
      fixture.health,
      scratch,
    );
    expect(selected).toMatchObject({
      ok: true,
      selectedCount: 1,
      bucketCandidateCount: 1,
      visitedCount: 1,
      scoredCount: 1,
      selectedRequestId: REQUEST_YAO_SPRAIN,
      reason: "medical.offer_created",
    });
    expect(fixture.medical.createMetrics()).toMatchObject({
      activePatientRequestCount: 1,
      caregiverStateCount: 1,
      selectionCount: 1,
      candidateVisitedCount: 1,
    });
  });

  it("stops medical offer traversal at candidateCap and reports a bounded cap hit", () => {
    const fixture = createMedicalFixture();
    for (let offset = 0; offset < 5; offset += 1) {
      const conditionId = CONDITION_YAO_SPRAIN + offset;
      if (offset > 0) {
        expect(fixture.health.addCondition(createSprain(conditionId))).toMatchObject({ ok: true });
      }
    }
    for (let offset = 0; offset < 5; offset += 1) {
      const conditionId = CONDITION_YAO_SPRAIN + offset;
      expect(
        fixture.medical.upsertPatientRequestFromCondition(
          createRequestFor(conditionId, offset, 100 + offset * 100),
          fixture.health,
        ),
      ).toMatchObject({ ok: true });
    }
    allowCaregiver(fixture);
    const scratch = createSelectionScratch();

    const selected = fixture.medical.selectTreatmentRequests(
      {
        caregiverId: ACTOR_MIN,
        regionId: REGION_CLINIC,
        urgencyBucket: URGENCY_HIGH,
        permissionId: PERMISSION_CLINIC,
        candidateCap: 2,
        maxSelectedRequests: 12,
      },
      fixture.health,
      scratch,
    );

    expect(selected).toMatchObject({
      ok: true,
      bucketCandidateCount: 2,
      visitedCount: 2,
      scoredCount: 2,
      rejectedByCandidateCap: 1,
      reason: "medical.candidate_cap_reached",
    });
    expect(fixture.medical.createMetrics()).toMatchObject({
      selectionCount: 1,
      candidateVisitedCount: 2,
      candidateCapHitCount: 1,
    });
  });

  it("progresses treatment through reservations pathing condition delta and cleanup", () => {
    const fixture = createReadyTreatmentFixture();
    const created = createTreatmentJob(fixture, 0);
    expect(created).toMatchObject({ ok: true, reason: "medical.treatment_created" });

    expect(
      fixture.treatments.reserve(
        0,
        10,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_reserved" });
    expect(fixture.ledger.activeCount).toBe(3);

    const path = createPath(fixture, 11);
    expect(
      fixture.treatments.startPathing(
        0,
        11,
        path,
        fixture.pathBasis,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_pathing" });
    expect(fixture.treatments.beginTreatment(0, 12, fixture.jobCore)).toMatchObject({
      ok: true,
      reason: "medical.treatment_started",
    });
    expect(
      fixture.treatments.tickTreatment(
        0,
        13,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.condition_delta_applied" });
    expect(
      fixture.treatments.tickTreatment(
        0,
        14,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_completed" });

    expect(fixture.health.readCondition(CONDITION_YAO_SPRAIN)).toMatchObject({
      severity: 260,
    });
    expect(fixture.items.readStack(STACK_BANDAGE)).toMatchObject({
      quantity: 2,
      availableQuantity: 2,
    });
    expect(fixture.ledger.activeCount).toBe(0);
    expect(fixture.treatments.readJob(0)).toMatchObject({
      step: "completed",
      deltaApplied: true,
      terminalReason: "medical.treatment_completed",
    });
    const completedCondition = readConditionOrThrow(fixture, CONDITION_YAO_SPRAIN);
    const completedJob = readTreatmentJobOrThrow(fixture, 0);
    expect(completedJob.conditionVersion).toBe(completedCondition.conditionVersion);
    expect(fixture.treatments.createMetrics()).toMatchObject({
      completedCount: 1,
      conditionDeltaCount: 1,
      stockConsumedCount: 1,
      reservationCleanupCount: 3,
    });

    expect(fixture.health.drainAbilityInvalidations(fixture.abilities, 8)).toBe(4);
    expect(
      fixture.abilities.queryAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, fixture.health, 1),
    ).toMatchObject({
      ok: true,
      value: 640,
      actorConditionVersion: 2,
      visitedConditionCount: 1,
    });
  });

  it("fails and cleans reserved treatment when completion basis changes", () => {
    const stalePatient = createReadyTreatmentFixture();
    startTreatingJob(stalePatient, 2);
    expect(
      stalePatient.treatments.tickTreatment(
        2,
        30,
        stalePatient.health,
        stalePatient.abilities,
        stalePatient.items,
        stalePatient.ledger,
        stalePatient.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      stalePatient.health.updateCondition({ conditionId: CONDITION_YAO_SPRAIN, severity: 410 }),
    ).toMatchObject({ ok: true });
    expect(
      stalePatient.treatments.tickTreatment(
        2,
        31,
        stalePatient.health,
        stalePatient.abilities,
        stalePatient.items,
        stalePatient.ledger,
        stalePatient.jobCore,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_stale_owner_state" });
    expect(stalePatient.ledger.activeCount).toBe(0);
    expect(stalePatient.items.readStack(STACK_BANDAGE)).toMatchObject({ quantity: 3 });
    expect(stalePatient.treatments.readJob(2)).toMatchObject({
      step: "failed",
      terminalReason: "medical.rejected_stale_owner_state",
    });

    const missingStock = createReadyTreatmentFixture();
    startTreatingJob(missingStock, 3);
    expect(
      missingStock.treatments.tickTreatment(
        3,
        40,
        missingStock.health,
        missingStock.abilities,
        missingStock.items,
        missingStock.ledger,
        missingStock.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(missingStock.items.removeQuantity(STACK_BANDAGE, 3, DEF_BANDAGE)).toMatchObject({
      ok: true,
    });
    expect(
      missingStock.treatments.tickTreatment(
        3,
        41,
        missingStock.health,
        missingStock.abilities,
        missingStock.items,
        missingStock.ledger,
        missingStock.jobCore,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_no_stock" });
    expect(missingStock.ledger.activeCount).toBe(0);
    expect(missingStock.treatments.readJob(3)).toMatchObject({
      step: "failed",
      terminalReason: "medical.rejected_no_stock",
    });

    const weakCaregiver = createReadyTreatmentFixture();
    startTreatingJob(weakCaregiver, 4);
    expect(
      weakCaregiver.treatments.tickTreatment(
        4,
        50,
        weakCaregiver.health,
        weakCaregiver.abilities,
        weakCaregiver.items,
        weakCaregiver.ledger,
        weakCaregiver.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(weakCaregiver.abilities.setBaseAbility(ACTOR_MIN, M3_ABILITY_MANIPULATION, 600)).toEqual(
      { ok: true },
    );
    expect(
      weakCaregiver.treatments.tickTreatment(
        4,
        51,
        weakCaregiver.health,
        weakCaregiver.abilities,
        weakCaregiver.items,
        weakCaregiver.ledger,
        weakCaregiver.jobCore,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_caregiver_ability" });
    expect(weakCaregiver.ledger.activeCount).toBe(0);
    expect(weakCaregiver.treatments.readJob(4)).toMatchObject({
      step: "failed",
      terminalReason: "medical.rejected_caregiver_ability",
    });
  });

  it("records updated condition row version separately from health store version", () => {
    const fixture = createVersionSkewTreatmentFixture();
    startTreatingJob(fixture, 5);
    expect(
      fixture.treatments.tickTreatment(
        5,
        60,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.treatments.tickTreatment(
        5,
        61,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true, reason: "medical.treatment_completed" });

    const condition = readConditionOrThrow(fixture, CONDITION_YAO_SPRAIN);
    const job = readTreatmentJobOrThrow(fixture, 5);
    expect(job.conditionVersion).toBe(condition.conditionVersion);
    expect(job.healthStoreVersion).toBe(fixture.health.storeVersion);
    expect(job.conditionVersion).not.toBe(job.healthStoreVersion);
  });

  it("cancels reserved treatment jobs without consuming stock or leaking reservations", () => {
    const fixture = createReadyTreatmentFixture();
    expect(createTreatmentJob(fixture, 1)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        1,
        20,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    expect(fixture.ledger.activeCount).toBe(3);

    expect(
      fixture.treatments.interrupt(1, "immediate", 21, fixture.ledger, fixture.jobCore),
    ).toEqual({
      ok: false,
      reason: "job.interruption_denied",
    });
    expect(fixture.ledger.activeCount).toBe(3);
    expect(fixture.treatments.cancel(1, 21, fixture.ledger, fixture.jobCore)).toMatchObject({
      ok: true,
      reason: "medical.interrupted_safe_point",
    });
    expect(fixture.ledger.activeCount).toBe(0);
    expect(fixture.items.readStack(STACK_BANDAGE)).toMatchObject({ quantity: 3 });
    expect(fixture.health.readCondition(CONDITION_YAO_SPRAIN)).toMatchObject({ severity: 420 });
    expect(fixture.treatments.readJob(1)).toMatchObject({
      step: "canceled",
      deltaApplied: false,
    });
  });

  it("distinguishes ability permission stock path reservation and stale owner-state failures", () => {
    const fixture = createReadyTreatmentFixture();
    const scratch = createSelectionScratch();

    expect(
      fixture.medical.updateCaregiverStateFromAbility(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          permissionId: PERMISSION_CLINIC,
          ability: M3_ABILITY_MANIPULATION,
          minimumValue: 950,
          allowed: true,
        },
        fixture.health,
        fixture.abilities,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_caregiver_ability" });

    expect(
      fixture.medical.updateCaregiverStateFromAbility(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          permissionId: PERMISSION_CLINIC,
          ability: M3_ABILITY_MANIPULATION,
          minimumValue: 700,
          allowed: false,
        },
        fixture.health,
        fixture.abilities,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_permission" });
    expect(
      fixture.medical.selectTreatmentRequests(
        {
          caregiverId: ACTOR_MIN,
          regionId: REGION_CLINIC,
          urgencyBucket: URGENCY_HIGH,
          permissionId: PERMISSION_CLINIC,
          candidateCap: 24,
          maxSelectedRequests: 12,
        },
        fixture.health,
        scratch,
      ),
    ).toEqual({ ok: false, reason: "medical.rejected_permission" });

    allowCaregiver(fixture);
    expect(createTreatmentJob(fixture, 2, 99)).toEqual({
      ok: false,
      reason: "medical.rejected_no_stock",
    });
    expect(fixture.items.removeQuantity(STACK_BANDAGE, 3, DEF_BANDAGE)).toMatchObject({ ok: true });
    expect(createTreatmentJob(fixture, 2)).toEqual({
      ok: false,
      reason: "medical.rejected_no_stock",
    });
    expect(fixture.items.addQuantity(STACK_BANDAGE, 3, DEF_BANDAGE)).toMatchObject({ ok: true });

    expect(createTreatmentJob(fixture, 2)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        2,
        30,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const failedPath = createFailedPath(fixture, 31);
    expect(
      fixture.treatments.startPathing(
        2,
        31,
        failedPath,
        fixture.pathBasis,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toEqual({ ok: false, reason: "path.no_route_to_patient" });
    expect(fixture.ledger.activeCount).toBe(0);
    expect(fixture.treatments.readJob(2)).toMatchObject({
      step: "failed",
      terminalReason: "path.no_route_to_patient",
    });
    const restored = createM3TreatmentJobStore(8);
    expect(restored.restoreFromSnapshot(fixture.treatments.createSnapshot())).toMatchObject({
      ok: true,
    });
    expect(restored.readJob(2)).toMatchObject({
      step: "failed",
      terminalReason: "path.no_route_to_patient",
    });

    expect(createTreatmentJob(fixture, 3)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        3,
        40,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: true });
    expect(createTreatmentJob(fixture, 4)).toMatchObject({ ok: true });
    expect(
      fixture.treatments.reserve(
        4,
        41,
        fixture.health,
        fixture.abilities,
        fixture.items,
        fixture.ledger,
        fixture.jobCore,
        fixture.registry,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_interaction_conflict" });
    expect(fixture.treatments.readJob(4)).toMatchObject({
      step: "failed",
      terminalReason: "reservation_interaction_conflict",
    });
    expect(fixture.treatments.cancel(3, 42, fixture.ledger, fixture.jobCore)).toMatchObject({
      ok: true,
    });
    expect(fixture.ledger.activeCount).toBe(0);

    expect(
      fixture.health.updateCondition({ conditionId: CONDITION_YAO_SPRAIN, severity: 300 }),
    ).toMatchObject({ ok: true });
    expect(createTreatmentJob(fixture, 5)).toEqual({
      ok: false,
      reason: "medical.rejected_stale_owner_state",
    });

    const stalePathFixture = createReadyTreatmentFixture();
    expect(createTreatmentJob(stalePathFixture, 6)).toMatchObject({ ok: true });
    expect(
      stalePathFixture.treatments.reserve(
        6,
        44,
        stalePathFixture.health,
        stalePathFixture.abilities,
        stalePathFixture.items,
        stalePathFixture.ledger,
        stalePathFixture.jobCore,
        stalePathFixture.registry,
      ),
    ).toMatchObject({ ok: true });
    const stalePath = createPath(stalePathFixture, 45);
    const staleBasis = {
      mapVersion: stalePathFixture.pathBasis.mapVersion,
      navigationVersion: stalePathFixture.pathBasis.navigationVersion + 1,
      regionVersion: stalePathFixture.pathBasis.regionVersion,
      roomVersion: stalePathFixture.pathBasis.roomVersion,
      regionGraphVersion: stalePathFixture.pathBasis.regionGraphVersion,
    };
    expect(
      stalePathFixture.treatments.startPathing(
        6,
        45,
        stalePath,
        staleBasis,
        stalePathFixture.ledger,
        stalePathFixture.jobCore,
      ),
    ).toEqual({ ok: false, reason: "path.stale_basis" });
    expect(stalePathFixture.ledger.activeCount).toBe(0);
    expect(stalePathFixture.treatments.readJob(6)).toMatchObject({
      step: "failed",
      terminalReason: "path.stale_basis",
    });
  });
});

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
type TreatmentSnapshotRow = M3TreatmentStoreSnapshot["rows"][number];
function treatmentAdoptedSnapshotCorruptions(): readonly (readonly [
  string,
  Readonly<Record<string, unknown>>,
])[] {
  return [
    ["uint8 ability", { ability: 0x100 }],
    ["uint16 minimum ability", { minimumAbilityValue: 0x1_0000 }],
    ["uint16 severity", { severityDelta: 0x1_0000 }],
    ["severity domain", { severityDelta: 1001 }],
    ["uint16 ability value", { abilityValue: 0x1_0000 }],
    ["zero treatment ticks", { treatmentTicks: 0 }],
    ["zero work per tick", { workPerTickQ16: 0 }],
    ["zero stock amount", { stockAmount: 0 }],
    ["overflowing work product", { treatmentTicks: 0xffff_ffff, workPerTickQ16: 2 }],
    ["zero reservation version", { reservationVersion: 0 }],
    ["invalid reserved reason", { terminalReasonCode: 0 }],
  ];
}

function treatmentLegacySnapshotCorruptions(): readonly (readonly [
  string,
  Readonly<Record<string, unknown>>,
])[] {
  return [
    ["uint8 ability", { ability: 0x100 }],
    ["uint16 minimum ability", { minimumAbilityValue: 0x1_0000 }],
    ["uint16 severity", { severityDelta: 0x1_0000 }],
    ["uint16 ability value", { abilityValue: 0x1_0000 }],
    ["severity domain", { severityDelta: 1001 }],
    ["zero treatment ticks", { treatmentTicks: 0 }],
    ["zero work per tick", { workPerTickQ16: 0 }],
    ["zero stock amount", { stockAmount: 0 }],
    ["overflowing work product", { treatmentTicks: 0xffff_ffff, workPerTickQ16: 2 }],
  ];
}

function treatmentRollbackSnapshotCorruptions(): readonly (readonly [
  string,
  (row: TreatmentSnapshotRow) => Readonly<Record<string, unknown>>,
])[] {
  return [
    [
      "duplicate claim ids",
      (row): Readonly<Record<string, unknown>> => ({
        claimIds: [row.claimIds[0], row.claimIds[0], row.claimIds[2]],
      }),
    ],
    [
      "zero epoch",
      (row): Readonly<Record<string, unknown>> => ({
        claimEpochs: [row.claimEpochs[0], 0, row.claimEpochs[2]],
      }),
    ],
    ["zero stock", (): Readonly<Record<string, unknown>> => ({ stockAmount: 0 })],
    ["zero reservation", (): Readonly<Record<string, unknown>> => ({ reservationVersion: 0 })],
    ["bad work", (): Readonly<Record<string, unknown>> => ({ workPerTickQ16: 0 })],
    [
      "bad narrow lane",
      (): Readonly<Record<string, unknown>> => ({ minimumAbilityValue: 0x1_0000 }),
    ],
    ["bad reason", (): Readonly<Record<string, unknown>> => ({ terminalReasonCode: 0 })],
    [
      "reversed tick",
      (row): Readonly<Record<string, unknown>> => ({ stepEnteredTick: row.createdTick - 1 }),
    ],
  ];
}

interface PreparedTreatmentAdoption {
  readonly caregiver: EntityId;
  readonly stock: EntityId;
  readonly patientTarget: EntityId;
  readonly core: ReturnType<typeof createJobCoreStore>;
  readonly treatment: ReturnType<typeof createM3TreatmentJobStore>;
  readonly claims: ReservationClaimsIntoOutput;
  readonly control: Mutable<ExistingClaimsAdoptionControl>;
  readonly input: Mutable<M3TreatmentClaimAdoptionInput>;
}

function prepareTreatmentAdoption(treatmentTickCount = 5): PreparedTreatmentAdoption {
  const caregiver = { index: 1, generation: 2 };
  const stock = { index: 8, generation: 3 };
  const patientTarget = { index: 9, generation: 4 };
  const core = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
  const token = medicalTokenOutput();
  core.reserveAutonomyJobTokenInto(core.version, caregiver, token);
  const ids = new Uint32Array(8);
  ids.fill(RESERVATION_CLAIM_NONE);
  const epochs = new Uint32Array(8);
  for (let index = 0; index < 3; index += 1) {
    ids[index] = index + 3;
    epochs[index] = 11;
  }
  const claims = treatmentClaims(caregiver, stock, patientTarget, token.jobId, token.jobGeneration);
  const control: Mutable<ExistingClaimsAdoptionControl> = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: caregiver.index,
    ownerGeneration: caregiver.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: core.version,
    expectedDriverVersion: 0,
    claimCount: 3,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: 0x1_0000_0001,
    adoptionTick: 0x1_0000_0002,
    reservationReadVersion: 11,
  };
  const input: Mutable<M3TreatmentClaimAdoptionInput> = {
    jobId: token.jobId,
    caregiver,
    caregiverActorId: caregiver.index,
    requestId: 2,
    storageSlotId: 2,
    stockStackId: 3,
    patientInteractionTarget: patientTarget,
    patientInteractionSpotId: 6,
    treatmentCellIndex: 44,
    ability: 1,
    minimumAbilityValue: 10,
    treatmentTicks: treatmentTickCount,
    workPerTickQ16: 65_536,
    severityDelta: 20,
    createdTick: control.claimCreatedTick,
    stockItem: stock,
    patientId: 7,
    conditionId: 12,
    treatmentDefId: 4,
    stockDefId: 5,
    stockAmount: 2,
    conditionVersion: 3,
    actorConditionVersion: 4,
    healthStoreVersion: 5,
    abilityValue: 100,
    caregiverConditionVersion: 6,
    caregiverBaseAbilityVersion: 7,
    stockStoreVersion: 8,
    readClaimIds: new Uint32Array(ids),
    readClaimEpochs: new Uint32Array(epochs),
    claims,
  };
  return {
    caregiver,
    stock,
    patientTarget,
    core,
    treatment: createM3TreatmentJobStore(8),
    claims,
    control,
    input,
  };
}

function restorePreparedJobCoreVersions(
  prepared: PreparedTreatmentAdoption,
  coreVersion: number,
  slotVersion: number,
): void {
  const snapshot = prepared.core.createSnapshot();
  const slot = snapshot.slots[prepared.control.jobId];
  if (slot === undefined) throw new Error("missing prepared JobCore slot");
  const slots = [...snapshot.slots];
  slots[prepared.control.jobId] = { ...slot, slotVersion };
  expect(
    prepared.core.restoreFromSnapshot({
      ...snapshot,
      storeVersion: coreVersion,
      slots,
    }),
  ).toMatchObject({ ok: true });
  prepared.control.expectedJobCoreVersion = coreVersion;
  prepared.control.expectedJobSlotVersion = slotVersion;
}

function restoreTreatmentMutationVersions(
  fixture: PreparedTreatmentAdoption & { readonly adopted: M3TreatmentClaimAdoptionOutput },
  driverVersion: number,
  coreVersion: number,
  slotVersion: number,
): void {
  const treatmentSnapshot = fixture.treatment.createSnapshot();
  const rows = [...treatmentSnapshot.rows];
  const treatmentRow = rows[fixture.control.jobId];
  if (treatmentRow === undefined) throw new Error("missing committed Treatment row");
  rows[fixture.control.jobId] = { ...treatmentRow, jobSlotVersion: slotVersion };
  expect(
    fixture.treatment.restoreFromSnapshot({
      ...treatmentSnapshot,
      storeVersion: driverVersion,
      rows,
    }),
  ).toMatchObject({ ok: true });
  const coreSnapshot = fixture.core.createSnapshot();
  const slot = coreSnapshot.slots[fixture.control.jobId];
  if (slot === undefined) throw new Error("missing committed JobCore slot");
  const slots = [...coreSnapshot.slots];
  slots[fixture.control.jobId] = { ...slot, slotVersion };
  expect(
    fixture.core.restoreFromSnapshot({ ...coreSnapshot, storeVersion: coreVersion, slots }),
  ).toMatchObject({ ok: true });
}

function createTreatmentAdoptionFixture(treatmentTickCount = 5): PreparedTreatmentAdoption & {
  readonly adopted: M3TreatmentClaimAdoptionOutput;
} {
  const fixture = prepareTreatmentAdoption(treatmentTickCount);
  const adopted = medicalDriverOutput();
  fixture.treatment.adoptExistingClaimsInto(fixture.control, fixture.input, fixture.core, adopted);
  expect(adopted.ok).toBe(true);
  return { ...fixture, adopted };
}

function treatmentAdoptedReadOutput(laneLength = 3): M3TreatmentAdoptedJobIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    jobSlotVersion: 0,
    driverVersion: 0,
    caregiverActorId: 0,
    requestId: 0,
    storageSlotId: 0,
    stockStackId: 0,
    stockItemIndex: 0,
    stockItemGeneration: 0,
    patientTargetIndex: 0,
    patientTargetGeneration: 0,
    patientInteractionSpotId: 0,
    treatmentCellIndex: 0,
    ability: 0,
    minimumAbilityValue: 0,
    treatmentTicks: 0,
    workPerTickQ16: 0,
    severityDelta: 0,
    createdTick: 0,
    stepEnteredTick: 0,
    lastEffectTick: 0,
    jobCoreLastMutationTick: 0,
    patientId: 0,
    conditionId: 0,
    treatmentDefId: 0,
    stockDefId: 0,
    stockAmount: 0,
    conditionVersion: 0,
    actorConditionVersion: 0,
    healthStoreVersion: 0,
    abilityValue: 0,
    caregiverConditionVersion: 0,
    caregiverBaseAbilityVersion: 0,
    stockStoreVersion: 0,
    reservationVersion: 0,
    jobCoreAdoptionReservationVersion: 0,
    jobCoreAdoptionDriverVersion: 0,
    jobCoreAdoptionSlotVersion: 0,
    progressQ16: 0,
    deltaApplied: false,
    stockConsumedOnce: false,
    cleanupPending: false,
    effectPhase: 0,
    terminalOutcome: undefined,
    terminalFailureReason: "none",
    terminalInterruptionKind: undefined,
    step: "unassigned",
    terminalReason: "medical.treatment_created",
    activeCount: 0,
    reservedCount: 0,
    pathingCount: 0,
    treatingCount: 0,
    completedCount: 0,
    canceledCount: 0,
    failedCount: 0,
    interruptedCount: 0,
    cumulativeCompletedCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    cumulativeInterruptedCount: 0,
    conditionDeltaCount: 0,
    stockConsumedCount: 0,
    reservationCleanupCount: 0,
    pathFailureCount: 0,
    staleBasisRejectCount: 0,
    claimIds: new Uint32Array(laneLength),
    claimEpochs: new Uint32Array(laneLength),
    claimCreatedTicks: new Float64Array(laneLength),
    claimLeaseExpiryTicks: new Float64Array(laneLength),
  };
}

function poisonTreatmentAdoptedOutput(output: M3TreatmentAdoptedJobIntoOutput): void {
  output.ok = true;
  output.reason = "medical.treatment_completed";
  output.active = true;
  output.jobId = 99;
  output.jobGeneration = 99;
  output.ownerIndex = 99;
  output.ownerGeneration = 99;
  output.jobSlotVersion = 99;
  output.driverVersion = 99;
  output.caregiverActorId = 99;
  output.requestId = 99;
  output.stockStackId = 99;
  output.stockItemIndex = 99;
  output.stockItemGeneration = 99;
  output.patientTargetIndex = 99;
  output.patientTargetGeneration = 99;
  output.patientInteractionSpotId = 99;
  output.treatmentCellIndex = 99;
  output.ability = 99;
  output.minimumAbilityValue = 99;
  output.treatmentTicks = 99;
  output.workPerTickQ16 = 99;
  output.severityDelta = 99;
  output.createdTick = 99;
  output.stepEnteredTick = 99;
  output.lastEffectTick = 99;
  output.patientId = 99;
  output.conditionId = 99;
  output.treatmentDefId = 99;
  output.stockDefId = 99;
  output.stockAmount = 99;
  output.conditionVersion = 99;
  output.actorConditionVersion = 99;
  output.healthStoreVersion = 99;
  output.abilityValue = 99;
  output.caregiverConditionVersion = 99;
  output.caregiverBaseAbilityVersion = 99;
  output.stockStoreVersion = 99;
  output.reservationVersion = 99;
  output.progressQ16 = 99;
  output.deltaApplied = true;
  output.step = "completed";
  output.terminalReason = "medical.treatment_completed";
  output.activeCount = 99;
  output.reservedCount = 99;
  output.pathingCount = 99;
  output.treatingCount = 99;
  output.completedCount = 99;
  output.canceledCount = 99;
  output.failedCount = 99;
  output.conditionDeltaCount = 99;
  output.stockConsumedCount = 99;
  output.reservationCleanupCount = 99;
  output.pathFailureCount = 99;
  output.staleBasisRejectCount = 99;
  output.claimIds.fill(99);
  output.claimEpochs.fill(99);
  output.claimCreatedTicks.fill(99);
  output.claimLeaseExpiryTicks.fill(99);
}

function expectedTreatmentAdoptedRead(
  fixture: PreparedTreatmentAdoption & { readonly adopted: M3TreatmentClaimAdoptionOutput },
): M3TreatmentAdoptedJobIntoOutput {
  return {
    ...treatmentAdoptedReadOutput(),
    ok: true,
    active: true,
    jobId: fixture.control.jobId,
    jobGeneration: fixture.control.jobGeneration,
    ownerIndex: fixture.control.ownerIndex,
    ownerGeneration: fixture.control.ownerGeneration,
    jobSlotVersion: fixture.adopted.jobSlotVersion,
    driverVersion: fixture.adopted.driverVersion,
    caregiverActorId: fixture.input.caregiverActorId,
    requestId: fixture.input.requestId,
    storageSlotId: fixture.input.storageSlotId,
    stockStackId: fixture.input.stockStackId,
    stockItemIndex: fixture.stock.index,
    stockItemGeneration: fixture.stock.generation,
    patientTargetIndex: fixture.patientTarget.index,
    patientTargetGeneration: fixture.patientTarget.generation,
    patientInteractionSpotId: fixture.input.patientInteractionSpotId,
    treatmentCellIndex: fixture.input.treatmentCellIndex,
    ability: fixture.input.ability,
    minimumAbilityValue: fixture.input.minimumAbilityValue,
    treatmentTicks: fixture.input.treatmentTicks,
    workPerTickQ16: fixture.input.workPerTickQ16,
    severityDelta: fixture.input.severityDelta,
    createdTick: fixture.control.claimCreatedTick,
    stepEnteredTick: fixture.control.adoptionTick,
    lastEffectTick: fixture.control.adoptionTick,
    jobCoreLastMutationTick: fixture.control.adoptionTick,
    patientId: fixture.input.patientId,
    conditionId: fixture.input.conditionId,
    treatmentDefId: fixture.input.treatmentDefId,
    stockDefId: fixture.input.stockDefId,
    stockAmount: fixture.input.stockAmount,
    conditionVersion: fixture.input.conditionVersion,
    actorConditionVersion: fixture.input.actorConditionVersion,
    healthStoreVersion: fixture.input.healthStoreVersion,
    abilityValue: fixture.input.abilityValue,
    caregiverConditionVersion: fixture.input.caregiverConditionVersion,
    caregiverBaseAbilityVersion: fixture.input.caregiverBaseAbilityVersion,
    stockStoreVersion: fixture.input.stockStoreVersion,
    reservationVersion: fixture.control.reservationReadVersion,
    jobCoreAdoptionReservationVersion: fixture.control.reservationReadVersion,
    jobCoreAdoptionDriverVersion: fixture.control.expectedDriverVersion,
    jobCoreAdoptionSlotVersion: fixture.adopted.jobSlotVersion,
    step: "reserved",
    terminalReason: "medical.treatment_reserved",
    activeCount: 1,
    reservedCount: 1,
    claimIds: new Uint32Array([3, 4, 5]),
    claimEpochs: new Uint32Array([11, 11, 11]),
    claimCreatedTicks: new Float64Array([
      fixture.control.claimCreatedTick,
      fixture.control.claimCreatedTick,
      fixture.control.claimCreatedTick,
    ]),
    claimLeaseExpiryTicks: new Float64Array([
      fixture.control.claimLeaseExpiryTicks[0] ?? 0,
      fixture.control.claimLeaseExpiryTicks[1] ?? 0,
      fixture.control.claimLeaseExpiryTicks[2] ?? 0,
    ]),
  };
}

function expectedTreatmentAdoptedReadReset(
  jobId: number,
  driverVersion: number,
): M3TreatmentAdoptedJobIntoOutput {
  const output = treatmentAdoptedReadOutput();
  output.reason = "medical.rejected_stale_owner_state";
  output.jobId = jobId;
  output.driverVersion = driverVersion;
  output.claimIds.fill(RESERVATION_CLAIM_NONE);
  return output;
}

function treatmentSnapshotWithRowPatch(
  snapshot: M3TreatmentStoreSnapshot,
  jobId: number,
  patch: Readonly<Record<string, unknown>>,
): unknown {
  const rows: unknown[] = [...snapshot.rows];
  const row = snapshot.rows[jobId];
  if (row === undefined) throw new Error("missing treatment snapshot row");
  rows[jobId] = { ...row, ...patch };
  return { ...snapshot, rows };
}

function treatmentSnapshotWithRowAndTopPatch(
  snapshot: M3TreatmentStoreSnapshot,
  jobId: number,
  rowPatch: Readonly<Record<string, unknown>>,
  topPatch: Readonly<Record<string, unknown>>,
): unknown {
  const rows: unknown[] = [...snapshot.rows];
  const row = snapshot.rows[jobId];
  if (row === undefined) throw new Error("missing treatment snapshot row");
  rows[jobId] = { ...row, ...rowPatch };
  return { ...snapshot, ...topPatch, rows };
}

function treatmentSnapshotWithProgressQuantumMismatch(
  snapshot: M3TreatmentStoreSnapshot,
  jobId: number,
): unknown {
  const rows: unknown[] = [...snapshot.rows];
  const row = snapshot.rows[jobId];
  if (row === undefined) throw new Error("missing treatment snapshot row");
  rows[jobId] = {
    ...row,
    stepCode: 4,
    terminalReasonCode: 12,
    progressQ16: 1,
    lastEffectTick: row.stepEnteredTick,
  };
  return { ...snapshot, reservedCount: 0, treatingCount: 1, rows };
}

function treatmentSnapshotWithMissingRowKey(
  snapshot: M3TreatmentStoreSnapshot,
  jobId: number,
  key: string,
): unknown {
  const rows: unknown[] = [...snapshot.rows];
  const row = snapshot.rows[jobId];
  if (row === undefined) throw new Error("missing treatment snapshot row");
  const mutable: Record<string, unknown> = { ...row };
  Reflect.deleteProperty(mutable, key);
  rows[jobId] = mutable;
  return { ...snapshot, rows };
}

function medicalDriverOutput(): M3TreatmentClaimAdoptionOutput {
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
    jobActiveCount: 0,
    jobReservedCount: 0,
    jobRunningCount: 0,
    jobCurrentTombstoneCount: 0,
    jobCumulativeTerminalCount: 0,
    reservedCount: 0,
    pathingCount: 0,
    treatingCount: 0,
    completedCount: 0,
    canceledCount: 0,
    failedCount: 0,
    conditionDeltaCount: 0,
    stockConsumedCount: 0,
    reservationCleanupCount: 0,
    pathFailureCount: 0,
    staleBasisRejectCount: 0,
  };
}

function treatmentMutationOutput(): M3TreatmentAdoptedMutationOutput {
  return {
    ok: false,
    reason: undefined,
    alreadyCommitted: false,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    jobSlotVersion: 0,
    jobCoreVersion: 0,
    driverVersion: 0,
    step: "unassigned",
    progressQ16: 0,
    readyToComplete: false,
    effectPhase: 0,
    stockConsumedOnce: false,
    cleanupPending: false,
    terminalOutcome: undefined,
    terminalFailureReason: "none",
    terminalInterruptionKind: undefined,
    releasedClaimCount: 0,
    healthStoreVersion: 0,
    conditionVersion: 0,
    actorConditionVersion: 0,
    itemStoreVersion: 0,
    itemRowVersion: 0,
    reservationVersion: 0,
    jobReservedCount: 0,
    jobActiveCount: 0,
    jobRunningCount: 0,
    jobCurrentTombstoneCount: 0,
    jobCumulativeTerminalCount: 0,
    activeCount: 0,
    reservedCount: 0,
    pathingCount: 0,
    treatingCount: 0,
    completedCount: 0,
    canceledCount: 0,
    failedCount: 0,
    interruptedCount: 0,
    cumulativeCompletedCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    cumulativeInterruptedCount: 0,
    conditionDeltaCount: 0,
    stockConsumedCount: 0,
    reservationCleanupCount: 0,
    pathFailureCount: 0,
    staleBasisRejectCount: 0,
  };
}

function poisonTreatmentMutationOutput(output: M3TreatmentAdoptedMutationOutput): void {
  output.ok = true;
  output.reason = "medical.treatment_completed";
  output.alreadyCommitted = true;
  output.jobId = 99;
  output.jobGeneration = 99;
  output.ownerIndex = 99;
  output.ownerGeneration = 99;
  output.jobSlotVersion = 99;
  output.jobCoreVersion = 99;
  output.driverVersion = 99;
  output.step = "completed";
  output.progressQ16 = 99;
  output.readyToComplete = true;
  output.reservationVersion = 99;
  output.jobReservedCount = 99;
  output.jobActiveCount = 99;
  output.jobRunningCount = 99;
  output.jobCurrentTombstoneCount = 99;
  output.jobCumulativeTerminalCount = 99;
  output.activeCount = 99;
  output.reservedCount = 99;
  output.pathingCount = 99;
  output.treatingCount = 99;
  output.completedCount = 99;
  output.canceledCount = 99;
  output.failedCount = 99;
  output.conditionDeltaCount = 99;
  output.stockConsumedCount = 99;
  output.reservationCleanupCount = 99;
  output.pathFailureCount = 99;
  output.staleBasisRejectCount = 99;
}

function treatmentMutationInput(
  fixture: PreparedTreatmentAdoption & { readonly adopted: M3TreatmentClaimAdoptionOutput },
  tick: number,
): M3TreatmentAdoptedMutationInput {
  return {
    jobId: fixture.control.jobId,
    jobGeneration: fixture.control.jobGeneration,
    ownerIndex: fixture.control.ownerIndex,
    ownerGeneration: fixture.control.ownerGeneration,
    expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
    expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
    expectedDriverVersion: fixture.adopted.driverVersion,
    tick,
  };
}

function treatmentMutationInputFromOutput(
  output: M3TreatmentAdoptedMutationOutput,
  tick: number,
): M3TreatmentAdoptedMutationInput {
  return {
    jobId: output.jobId,
    jobGeneration: output.jobGeneration,
    ownerIndex: output.ownerIndex,
    ownerGeneration: output.ownerGeneration,
    expectedJobSlotVersion: output.jobSlotVersion,
    expectedJobCoreVersion: output.jobCoreVersion,
    expectedDriverVersion: output.driverVersion,
    tick,
  };
}
function medicalTokenOutput(): JobTokenIntoOutput {
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
function treatmentClaims(
  owner: EntityId,
  stock: EntityId,
  patient: EntityId,
  jobId: number,
  generation: number,
): ReservationClaimsIntoOutput {
  const c = {
    ok: true,
    reason: undefined,
    claimIndex: RESERVATION_CLAIM_NONE,
    claimId: RESERVATION_CLAIM_NONE,
    claimCount: 3,
    version: 11,
    activeCount: 3,
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
  c.ownerIndexes.fill(RESERVATION_CLAIM_NONE);
  c.jobIds.fill(RESERVATION_CLAIM_NONE);
  c.targetIndexes.fill(RESERVATION_CLAIM_NONE);
  c.cellIndexes.fill(RESERVATION_CLAIM_NONE);
  c.slotIds.fill(RESERVATION_CLAIM_NONE);
  c.channelCodes.set([RESERVATION_ITEM_QUANTITY, RESERVATION_INTERACTION_SPOT, RESERVATION_CELL]);
  for (let i = 0; i < 3; i += 1) {
    c.ownerIndexes[i] = owner.index;
    c.ownerGenerations[i] = owner.generation;
    c.jobIds[i] = jobId;
    c.jobGenerations[i] = generation;
    c.allocationEpochs[i] = 11;
    c.createdTicks[i] = 0x1_0000_0001;
    c.leaseExpiryTicks[i] = 0x1_0000_0100;
  }
  c.hasTargetFlags[0] = 1;
  c.targetIndexes[0] = stock.index;
  c.targetGenerations[0] = stock.generation;
  c.hasTargetFlags[1] = 1;
  c.targetIndexes[1] = patient.index;
  c.targetGenerations[1] = patient.generation;
  c.amounts[0] = 2;
  c.slotIds[1] = 6;
  c.cellIndexes[2] = 44;
  return c;
}

const ACTOR_YAO = 0;
const ACTOR_MIN = 2;
const ACTOR_SU = 5;
const REGION_CLINIC = 1;
const PERMISSION_CLINIC = 1;
const URGENCY_HIGH = 3;
const REQUEST_YAO_SPRAIN = 0;
const CONDITION_YAO_SPRAIN = 2;
const CONDITION_EXTRA = 7;
const DEF_LEFT_LEG_SPRAIN = 100;
const DEF_BANDAGE = 200;
const DEF_TREAT_SPRAIN = 300;
const BODY_PART_LEFT_LEG = 6;
const SOURCE_SPRAIN = 46;
const CLUE_LIMP = 10;
const COUNTER_NO_FEVER = 20;
const STACK_BANDAGE = 0;

interface TreatmentCFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly owner: EntityId;
  readonly stock: EntityId;
  readonly patientTarget: EntityId;
  readonly treatment: ReturnType<typeof createM3TreatmentJobStore>;
  readonly core: ReturnType<typeof createJobCoreStore>;
  readonly health: ReturnType<typeof createM3HealthConditionStore>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly storage: ReturnType<typeof createStorageLogisticsIndex>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly claims: ReservationClaimsIntoOutput;
  readonly readyOutput: M3TreatmentAdoptedMutationOutput;
  readonly conditionId: number;
  readonly stackId: number;
  readonly storageSlotId: number;
  readonly terminalTick: number;
}

interface TreatmentReuseAdoption {
  readonly control: ExistingClaimsAdoptionControl;
  readonly input: M3TreatmentClaimAdoptionInput;
}

interface TreatmentReuseMutation {
  readonly output: M3TreatmentAdoptedMutationOutput;
  readonly terminalTick: number;
}

function createTreatmentCFixture(storageSlotId = 1): TreatmentCFixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const owner = mustAllocate(registry);
  const stock = mustAllocate(registry);
  const patientTarget = mustAllocate(registry);
  const storageEntity = mustAllocate(registry);
  const conditionId = CONDITION_YAO_SPRAIN;
  const stackId = STACK_BANDAGE;
  const createdTick = 0x1_0000_0001;
  const adoptionTick = createdTick + 1;
  const core = createJobCoreStore({ capacity: 8, ownerCapacity: 16, autonomyJobStart: 4 });
  const token = medicalTokenOutput();
  core.reserveAutonomyJobTokenInto(core.version, owner, token);
  if (!token.ok) throw new Error(String(token.reason));
  const health = createM3HealthConditionStore({
    actorCapacity: 16,
    conditionCapacity: 8,
    abilityDirtyCapacity: 24,
  });
  expect(health.addCondition(createSprain(conditionId))).toMatchObject({ ok: true });
  const items = createItemStackStore(4);
  expect(
    items.createStack(
      { stackId, entity: stock, defId: DEF_BANDAGE, quantity: 6, capacity: 6 },
      registry,
    ),
  ).toMatchObject({ ok: true });
  const ledger = createReservationLedger({ capacity: 32, entityCapacity: 16, cellCount: 64 });
  const acquired = ledger.acquire(
    {
      owner,
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      createdTick,
      leaseExpiryTick: createdTick + 300,
      claims: [
        { channel: "item_quantity", item: stock, amount: 2, availableAmount: 6 },
        { channel: "interaction_spot", target: patientTarget, spotId: 6 },
        { channel: "cell", cellIndex: 44 },
      ],
    },
    registry,
  );
  if (!acquired.ok) throw new Error(acquired.reason);
  const ids = new Uint32Array(8);
  ids.fill(RESERVATION_CLAIM_NONE);
  const epochs = new Uint32Array(8);
  for (let index = 0; index < 3; index += 1) {
    ids[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
    epochs[index] = acquired.version;
  }
  const claims = treatmentClaims(owner, stock, patientTarget, token.jobId, token.jobGeneration);
  ledger.readActiveClaimsInto(
    ids,
    epochs,
    3,
    owner,
    token.jobId,
    token.jobGeneration,
    ledger.version,
    claims,
  );
  if (!claims.ok) throw new Error(String(claims.reason));
  const storage = createStorageLogisticsIndex(4, 4, 256);
  expect(
    storage.configureSlot(
      {
        slotId: storageSlotId,
        storage: storageEntity,
        stackId,
        defId: DEF_BANDAGE,
        capacity: 6,
        desiredQuantity: 0,
        interactionCellIndex: 11,
        offerId: 1,
        workType: 0,
        regionId: 0,
        urgencyBucket: 0,
        permissionId: 0,
      },
      registry,
    ),
  ).toMatchObject({ ok: true });
  const offers = createWorkOfferIndex({
    capacity: 4,
    workTypeCapacity: 2,
    regionCapacity: 2,
    defCapacity: 256,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });
  storage.refreshDirty(items, ledger, offers, 4);
  const healthRow = treatmentHealthOutput();
  health.readConditionInto(conditionId, healthRow);
  if (!healthRow.ok) throw new Error("missing Treatment-C condition");
  const treatment = createM3TreatmentJobStore(8);
  const adopted = medicalDriverOutput();
  treatment.adoptExistingClaimsInto(
    {
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      ownerIndex: owner.index,
      ownerGeneration: owner.generation,
      expectedJobSlotVersion: token.slotVersion,
      expectedJobCoreVersion: core.version,
      expectedDriverVersion: 0,
      claimCount: 3,
      claimIds: ids,
      claimEpochs: epochs,
      claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
      claimCreatedTick: createdTick,
      adoptionTick,
      reservationReadVersion: ledger.version,
    },
    {
      jobId: token.jobId,
      caregiver: owner,
      caregiverActorId: owner.index,
      requestId: 2,
      storageSlotId,
      stockStackId: stackId,
      patientInteractionTarget: patientTarget,
      patientInteractionSpotId: 6,
      treatmentCellIndex: 44,
      ability: M3_ABILITY_MANIPULATION,
      minimumAbilityValue: 10,
      treatmentTicks: 1,
      workPerTickQ16: 65_536,
      severityDelta: 20,
      createdTick,
      stockItem: stock,
      patientId: healthRow.actorId,
      conditionId,
      treatmentDefId: 4,
      stockDefId: DEF_BANDAGE,
      stockAmount: 2,
      conditionVersion: healthRow.conditionVersion,
      actorConditionVersion: healthRow.actorConditionVersion,
      healthStoreVersion: healthRow.storeVersion,
      abilityValue: 100,
      caregiverConditionVersion: 0,
      caregiverBaseAbilityVersion: 1,
      stockStoreVersion: items.version,
      readClaimIds: new Uint32Array(ids),
      readClaimEpochs: new Uint32Array(epochs),
      claims,
    },
    core,
    adopted,
  );
  if (!adopted.ok) throw new Error(String(adopted.reason));
  const readyOutput = treatmentMutationOutput();
  treatment.startPathingAdoptedInto(
    treatmentMutationInputFromAdopted(adopted, adoptionTick + 1),
    core,
    readyOutput,
  );
  treatment.beginAdoptedInto(
    treatmentMutationInputFromOutput(readyOutput, adoptionTick + 2),
    core,
    readyOutput,
  );
  treatment.progressAdoptedInto(
    treatmentMutationInputFromOutput(readyOutput, adoptionTick + 2),
    core,
    readyOutput,
  );
  if (!readyOutput.ok || !readyOutput.readyToComplete) throw new Error(String(readyOutput.reason));
  return {
    registry,
    owner,
    stock,
    patientTarget,
    treatment,
    core,
    health,
    items,
    storage,
    ledger,
    claims,
    readyOutput: { ...readyOutput },
    conditionId,
    stackId,
    storageSlotId,
    terminalTick: adoptionTick + 3,
  };
}

function prepareTreatmentReuseAdoption(fixture: TreatmentCFixture): TreatmentReuseAdoption {
  const token = medicalTokenOutput();
  fixture.core.reserveAutonomyJobTokenInto(fixture.core.version, fixture.owner, token);
  if (!token.ok) throw new Error(String(token.reason));
  const createdTick = fixture.terminalTick + 10;
  const acquired = fixture.ledger.acquire(
    {
      owner: fixture.owner,
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      createdTick,
      leaseExpiryTick: createdTick + 300,
      claims: [
        { channel: "item_quantity", item: fixture.stock, amount: 2, availableAmount: 4 },
        { channel: "interaction_spot", target: fixture.patientTarget, spotId: 6 },
        { channel: "cell", cellIndex: 44 },
      ],
    },
    fixture.registry,
  );
  if (!acquired.ok) throw new Error(acquired.reason);
  const ids = new Uint32Array(8);
  ids.fill(RESERVATION_CLAIM_NONE);
  const epochs = new Uint32Array(8);
  for (let index = 0; index < 3; index += 1) {
    ids[index] = acquired.claimIds[index] ?? RESERVATION_CLAIM_NONE;
    epochs[index] = acquired.version;
  }
  const claims = treatmentClaims(
    fixture.owner,
    fixture.stock,
    fixture.patientTarget,
    token.jobId,
    token.jobGeneration,
  );
  fixture.ledger.readActiveClaimsInto(
    ids,
    epochs,
    3,
    fixture.owner,
    token.jobId,
    token.jobGeneration,
    fixture.ledger.version,
    claims,
  );
  if (!claims.ok) throw new Error(String(claims.reason));
  const health = treatmentHealthOutput();
  fixture.health.readConditionInto(fixture.conditionId, health);
  if (!health.ok) throw new Error("missing reused Treatment-C condition");
  const control: ExistingClaimsAdoptionControl = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: fixture.owner.index,
    ownerGeneration: fixture.owner.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: fixture.core.version,
    expectedDriverVersion: fixture.treatment.createSnapshot().storeVersion,
    claimCount: 3,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: createdTick,
    adoptionTick: createdTick + 1,
    reservationReadVersion: fixture.ledger.version,
  };
  return {
    control,
    input: {
      jobId: token.jobId,
      caregiver: fixture.owner,
      caregiverActorId: fixture.owner.index,
      requestId: 3,
      storageSlotId: 1,
      stockStackId: fixture.stackId,
      patientInteractionTarget: fixture.patientTarget,
      patientInteractionSpotId: 6,
      treatmentCellIndex: 44,
      ability: M3_ABILITY_MANIPULATION,
      minimumAbilityValue: 10,
      treatmentTicks: 1,
      workPerTickQ16: 65_536,
      severityDelta: 20,
      createdTick,
      stockItem: fixture.stock,
      patientId: health.actorId,
      conditionId: fixture.conditionId,
      treatmentDefId: 4,
      stockDefId: DEF_BANDAGE,
      stockAmount: 2,
      conditionVersion: health.conditionVersion,
      actorConditionVersion: health.actorConditionVersion,
      healthStoreVersion: health.storeVersion,
      abilityValue: 100,
      caregiverConditionVersion: 0,
      caregiverBaseAbilityVersion: 1,
      stockStoreVersion: fixture.items.version,
      readClaimIds: new Uint32Array(ids),
      readClaimEpochs: new Uint32Array(epochs),
      claims,
    },
  };
}

function advanceReusedTreatment(fixture: TreatmentCFixture): TreatmentReuseMutation {
  const reuse = prepareTreatmentReuseAdoption(fixture);
  const adopted = medicalDriverOutput();
  fixture.treatment.adoptExistingClaimsInto(reuse.control, reuse.input, fixture.core, adopted);
  if (!adopted.ok) throw new Error(String(adopted.reason));
  const output = treatmentMutationOutput();
  fixture.treatment.startPathingAdoptedInto(
    treatmentMutationInputFromAdopted(adopted, reuse.control.adoptionTick + 1),
    fixture.core,
    output,
  );
  fixture.treatment.beginAdoptedInto(
    treatmentMutationInputFromOutput(output, reuse.control.adoptionTick + 2),
    fixture.core,
    output,
  );
  fixture.treatment.progressAdoptedInto(
    treatmentMutationInputFromOutput(output, reuse.control.adoptionTick + 2),
    fixture.core,
    output,
  );
  if (!output.ok || !output.readyToComplete) throw new Error(String(output.reason));
  return { output: { ...output }, terminalTick: reuse.control.adoptionTick + 3 };
}

function refreshTreatmentStorage(fixture: TreatmentCFixture): void {
  const offers = createWorkOfferIndex({
    capacity: 4,
    workTypeCapacity: 2,
    regionCapacity: 2,
    defCapacity: 256,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });
  expect(fixture.storage.markSlotDirty(fixture.storageSlotId)).toMatchObject({ ok: true });
  fixture.storage.refreshDirty(fixture.items, fixture.ledger, offers, 4);
}

function createPhaseOneTreatmentFixture(): TreatmentCFixture {
  const fixture = createTreatmentCFixture();
  const condition = fixture.health.readCondition(fixture.conditionId);
  if (condition === undefined) throw new Error("missing phase-one condition");
  expect(
    fixture.health.updateCondition({
      conditionId: fixture.conditionId,
      severity: condition.severity - 20,
      terminalState: M3_HEALTH_CONDITION_RECOVERING,
    }),
  ).toMatchObject({ ok: true });
  const updated = treatmentHealthOutput();
  fixture.health.readConditionInto(fixture.conditionId, updated);
  if (!updated.ok) throw new Error("missing updated phase-one condition");
  const snapshot = fixture.treatment.createSnapshot();
  const restored = createM3TreatmentJobStore(snapshot.capacity);
  expect(
    restored.restoreFromSnapshot(
      treatmentSnapshotWithRowAndTopPatch(
        snapshot,
        fixture.readyOutput.jobId,
        {
          effectPhase: 1,
          deltaApplied: 1,
          terminalOutcomeCode: 1,
          terminalFailureCode: 0,
          terminalInterruptionCode: 0,
          terminalReasonCode: 12,
          conditionVersion: updated.conditionVersion,
          actorConditionVersion: updated.actorConditionVersion,
          healthStoreVersion: updated.storeVersion,
          lastEffectTick: fixture.terminalTick,
        },
        {
          storeVersion: snapshot.storeVersion + 1,
          conditionDeltaCount: snapshot.conditionDeltaCount + 1,
        },
      ),
    ),
  ).toMatchObject({ ok: true });
  return {
    ...fixture,
    treatment: restored,
    readyOutput: {
      ...fixture.readyOutput,
      driverVersion: snapshot.storeVersion + 1,
      effectPhase: 1,
      healthStoreVersion: updated.storeVersion,
      conditionVersion: updated.conditionVersion,
      actorConditionVersion: updated.actorConditionVersion,
      conditionDeltaCount: snapshot.conditionDeltaCount + 1,
    },
  };
}

function treatmentMutationInputFromAdopted(
  adopted: M3TreatmentClaimAdoptionOutput,
  tick: number,
): M3TreatmentAdoptedMutationInput {
  return {
    jobId: adopted.jobId,
    jobGeneration: adopted.jobGeneration,
    ownerIndex: adopted.ownerIndex,
    ownerGeneration: adopted.ownerGeneration,
    expectedJobSlotVersion: adopted.jobSlotVersion,
    expectedJobCoreVersion: adopted.jobCoreVersion,
    expectedDriverVersion: adopted.driverVersion,
    tick,
  };
}

function treatmentCompleteInput(fixture: TreatmentCFixture): M3TreatmentAdoptedCompleteInput {
  const condition = treatmentHealthOutput();
  fixture.health.readConditionInto(fixture.conditionId, condition);
  const item = treatmentItemOutput();
  fixture.items.readStackInto(
    fixture.stackId,
    fixture.ledger,
    { entity: { index: 0, generation: 0 } },
    item,
  );
  const slot = treatmentStorageOutput();
  fixture.storage.readSlotInto(fixture.storageSlotId, slot);
  return {
    ...treatmentMutationInputFromOutput(fixture.readyOutput, fixture.terminalTick),
    expectedCurrentLedgerVersion: fixture.ledger.version,
    healthMutation: {
      conditionId: condition.conditionId,
      expectedActorId: condition.actorId,
      expectedDefId: condition.defId,
      expectedSeverity: condition.severity,
      expectedTerminalState: condition.terminalState,
      expectedAffectedAbilityMask: condition.affectedAbilityMask,
      expectedStoreVersion: condition.storeVersion,
      expectedConditionVersion: condition.conditionVersion,
      expectedActorConditionVersion: condition.actorConditionVersion,
      severityDelta: 20,
    },
    stockRemoval: {
      stackId: item.stackId,
      entityIndex: item.entityIndex,
      entityGeneration: item.entityGeneration,
      defId: item.defId,
      quantity: item.quantity,
      reservedQuantity: item.reservedQuantity,
      ownedReservedQuantity: 2,
      availableQuantity: item.availableQuantity,
      capacity: item.capacity,
      amount: 2,
      expectedRowVersion: item.rowVersion,
      expectedStoreVersion: item.storeVersion,
      expectedReservationVersion: item.reservationVersion,
    },
    stockSlot: slot,
    stockDirty: {
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

function treatmentCompleteInputFromOutput(
  fixture: TreatmentCFixture,
  output: M3TreatmentAdoptedMutationOutput,
): M3TreatmentAdoptedCompleteInput {
  return {
    ...treatmentCompleteInput(fixture),
    ...treatmentMutationInputFromOutput(output, fixture.terminalTick),
    expectedCurrentLedgerVersion: fixture.ledger.version,
  };
}

function treatmentOwnerSnapshots(fixture: TreatmentCFixture): unknown {
  return {
    treatment: fixture.treatment.createSnapshot(),
    core: fixture.core.createSnapshot(),
    healthHash: fixture.health.createHash(),
    items: fixture.items.createSnapshot(),
    storage: fixture.storage.createSnapshot(),
    ledger: fixture.ledger.createSnapshot(),
  };
}

function treatmentHealthOutput(): M3HealthConditionIntoOutput {
  return {
    ok: false,
    conditionId: RESERVATION_CLAIM_NONE,
    actorId: 0,
    defId: 0,
    kind: 0,
    bodyPart: 0,
    severity: 0,
    ageTicks: 0,
    sourceId: 0,
    componentFlags: 0,
    clueRef: 0,
    counterevidenceRef: 0,
    terminalState: 0,
    affectedAbilityMask: 0,
    storeVersion: 0,
    conditionVersion: 0,
    actorConditionVersion: 0,
    updateCount: 0,
    invalidationCount: 0,
    dirtyWriteCursor: 0,
    dirtyCount: 0,
    dirtyPeak: 0,
    dirtyCapacity: 0,
  };
}

function treatmentItemOutput(): ItemStackIntoOutput {
  return {
    ok: false,
    reason: undefined,
    active: false,
    stackId: RESERVATION_CLAIM_NONE,
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

function treatmentStorageOutput(): StorageSlotIntoOutput {
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

interface MedicalFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly health: ReturnType<typeof createM3HealthConditionStore>;
  readonly abilities: ReturnType<typeof createM3AbilityCacheStore>;
  readonly medical: ReturnType<typeof createM3MedicalCareStore>;
  readonly treatments: ReturnType<typeof createM3TreatmentJobStore>;
  readonly items: ReturnType<typeof createItemStackStore>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly jobCore: ReturnType<typeof createJobCoreStore>;
  readonly caregiver: EntityId;
  readonly patient: EntityId;
  readonly stock: EntityId;
  readonly grid: ReturnType<typeof createMapGrid>;
  readonly pathBasis: ReturnType<typeof createPathVersionBasis>;
}

type PatientRequestIntoOutput = Parameters<MedicalFixture["medical"]["readPatientRequestInto"]>[1];
type CaregiverStateIntoOutput = Parameters<MedicalFixture["medical"]["readCaregiverStateInto"]>[1];
type MedicalSelectionOptionsForTest = Parameters<
  MedicalFixture["medical"]["selectTreatmentRequestsInto"]
>[0];
type MedicalSelectionIntoScratchForTest = Parameters<
  MedicalFixture["medical"]["selectTreatmentRequestsInto"]
>[3];
type MedicalSelectionIntoOutputForTest = Parameters<
  MedicalFixture["medical"]["selectTreatmentRequestsInto"]
>[4];
type MedicalSelectionScratchLane = Exclude<
  keyof MedicalSelectionIntoScratchForTest,
  "patientReadOutput" | "caregiverReadOutput" | "abilityQueryOutput"
>;

const MEDICAL_SELECTION_SCRATCH_LANES: readonly MedicalSelectionScratchLane[] = [
  "requestIds",
  "patientIds",
  "conditionIds",
  "regionIds",
  "urgencyBuckets",
  "permissionIds",
  "treatmentDefIds",
  "stockDefIds",
  "stockAmounts",
  "targetCellIndexes",
  "scoresMilli",
  "conditionVersions",
  "actorConditionVersions",
  "healthStoreVersions",
  "severities",
  "clueRefs",
  "counterevidenceRefs",
];

function createPatientRequestIntoOutput(): PatientRequestIntoOutput {
  return {
    ok: true,
    reason: "medical.value_out_of_range",
    requestId: 99,
    active: true,
    patientId: 99,
    conditionId: 99,
    regionId: 99,
    urgencyBucket: 99,
    permissionId: 99,
    treatmentDefId: 99,
    stockDefId: 99,
    stockAmount: 99,
    targetCellIndex: 99,
    scoreMilli: 99,
    conditionVersion: 99,
    actorConditionVersion: 99,
    healthStoreVersion: 99,
    severity: 99,
    clueRef: 99,
    counterevidenceRef: 99,
    medicalStoreVersion: 99,
  };
}

function createCaregiverStateIntoOutput(): CaregiverStateIntoOutput {
  return {
    ok: true,
    reason: "medical.value_out_of_range",
    caregiverId: 99,
    valid: true,
    regionId: 99,
    permissionId: 99,
    ability: 99,
    minimumValue: 99,
    allowed: true,
    abilityValue: 99,
    actorConditionVersion: 99,
    baseAbilityVersion: 99,
    medicalStoreVersion: 99,
  };
}

function createMedicalSelectionOptions(
  overrides: Partial<MedicalSelectionOptionsForTest> = {},
): MedicalSelectionOptionsForTest {
  return {
    caregiverId: ACTOR_MIN,
    regionId: REGION_CLINIC,
    urgencyBucket: URGENCY_HIGH,
    permissionId: PERMISSION_CLINIC,
    candidateCap: M3_MEDICAL_DEFAULT_CANDIDATE_CAP,
    maxSelectedRequests: M3_MEDICAL_DEFAULT_SELECTED_CAP,
    ...overrides,
  };
}

function createMedicalSelectionIntoScratch(
  undersizedLane?: MedicalSelectionScratchLane,
): MedicalSelectionIntoScratchForTest {
  return {
    patientReadOutput: createPatientRequestIntoOutput(),
    caregiverReadOutput: createCaregiverStateIntoOutput(),
    abilityQueryOutput: createMedicalAbilityQueryOutput(),
    requestIds: createPoisonedMedicalUint32Lane("requestIds", undersizedLane),
    patientIds: createPoisonedMedicalUint32Lane("patientIds", undersizedLane),
    conditionIds: createPoisonedMedicalUint32Lane("conditionIds", undersizedLane),
    regionIds: createPoisonedMedicalUint32Lane("regionIds", undersizedLane),
    urgencyBuckets: createPoisonedMedicalUint32Lane("urgencyBuckets", undersizedLane),
    permissionIds: createPoisonedMedicalUint32Lane("permissionIds", undersizedLane),
    treatmentDefIds: createPoisonedMedicalUint32Lane("treatmentDefIds", undersizedLane),
    stockDefIds: createPoisonedMedicalUint32Lane("stockDefIds", undersizedLane),
    stockAmounts: createPoisonedMedicalUint32Lane("stockAmounts", undersizedLane),
    targetCellIndexes: createPoisonedMedicalUint32Lane("targetCellIndexes", undersizedLane),
    scoresMilli: createPoisonedMedicalInt32Lane("scoresMilli", undersizedLane),
    conditionVersions: createPoisonedMedicalUint32Lane("conditionVersions", undersizedLane),
    actorConditionVersions: createPoisonedMedicalUint32Lane(
      "actorConditionVersions",
      undersizedLane,
    ),
    healthStoreVersions: createPoisonedMedicalUint32Lane("healthStoreVersions", undersizedLane),
    severities: createPoisonedMedicalUint16Lane("severities", undersizedLane),
    clueRefs: createPoisonedMedicalUint32Lane("clueRefs", undersizedLane),
    counterevidenceRefs: createPoisonedMedicalUint32Lane("counterevidenceRefs", undersizedLane),
  };
}

function medicalLaneCapacity(
  lane: MedicalSelectionScratchLane,
  undersizedLane: MedicalSelectionScratchLane | undefined,
): number {
  return lane === undersizedLane ? M3_MEDICAL_DEFAULT_SELECTED_CAP - 1 : 12;
}

function createPoisonedMedicalUint32Lane(
  lane: MedicalSelectionScratchLane,
  undersizedLane: MedicalSelectionScratchLane | undefined,
): Uint32Array {
  return new Uint32Array(medicalLaneCapacity(lane, undersizedLane)).fill(99);
}

function createPoisonedMedicalInt32Lane(
  lane: MedicalSelectionScratchLane,
  undersizedLane: MedicalSelectionScratchLane | undefined,
): Int32Array {
  return new Int32Array(medicalLaneCapacity(lane, undersizedLane)).fill(-99);
}

function createPoisonedMedicalUint16Lane(
  lane: MedicalSelectionScratchLane,
  undersizedLane: MedicalSelectionScratchLane | undefined,
): Uint16Array {
  return new Uint16Array(medicalLaneCapacity(lane, undersizedLane)).fill(99);
}

function createMedicalAbilityQueryOutput(): MedicalSelectionIntoScratchForTest["abilityQueryOutput"] {
  return {
    ok: true,
    reason: "ability.cache_hit",
    actorId: 99,
    ability: 99,
    value: 99,
    threshold: 99,
    baseValue: 99,
    conditionPenalty: 99,
    actorConditionVersion: 99,
    baseAbilityVersion: 99,
    visitedConditionCount: 99,
  };
}

function createMedicalSelectionIntoOutput(): MedicalSelectionIntoOutputForTest {
  return {
    ok: true,
    reason: "medical.value_out_of_range",
    queryCaregiverId: 99,
    queryRegionId: 99,
    queryUrgencyBucket: 99,
    queryPermissionId: 99,
    candidateCap: 99,
    maxSelectedRequests: 99,
    bucketCandidateCount: 99,
    visitedCount: 99,
    scoredCount: 99,
    selectedCount: 99,
    candidateCapHit: true,
    selectedCapHit: true,
    rejectedByCandidateCap: 99,
    rejectedByPermission: 99,
    rejectedByAbility: 99,
    rejectedByCondition: 99,
    rejectedByStaleBasis: 99,
    selectedRequestId: 99,
    selectedPatientId: 99,
    selectedConditionId: 99,
    selectedRegionId: 99,
    selectedUrgencyBucket: 99,
    selectedPermissionId: 99,
    selectedTreatmentDefId: 99,
    selectedStockDefId: 99,
    selectedStockAmount: 99,
    selectedTargetCellIndex: 99,
    selectedScoreMilli: 99,
    selectedConditionVersion: 99,
    selectedActorConditionVersion: 99,
    selectedHealthStoreVersion: 99,
    selectedSeverity: 99,
    selectedClueRef: 99,
    selectedCounterevidenceRef: 99,
    selectedCaregiverId: 99,
    caregiverRegionId: 99,
    caregiverPermissionId: 99,
    caregiverAbility: 99,
    caregiverMinimumValue: 99,
    caregiverAbilityValue: 99,
    caregiverActorConditionVersion: 99,
    caregiverBaseAbilityVersion: 99,
    caregiverValid: true,
    caregiverAllowed: true,
    medicalStoreVersion: 99,
    healthStoreVersion: 99,
  };
}

function createMedicalSelectionResetOutput(
  options: MedicalSelectionOptionsForTest,
  fixture: MedicalFixture,
  reason: MedicalSelectionIntoOutputForTest["reason"],
): MedicalSelectionIntoOutputForTest {
  return {
    ok: false,
    reason,
    queryCaregiverId: options.caregiverId,
    queryRegionId: options.regionId,
    queryUrgencyBucket: options.urgencyBucket,
    queryPermissionId: options.permissionId,
    candidateCap: options.candidateCap,
    maxSelectedRequests: options.maxSelectedRequests,
    bucketCandidateCount: 0,
    visitedCount: 0,
    scoredCount: 0,
    selectedCount: 0,
    candidateCapHit: false,
    selectedCapHit: false,
    rejectedByCandidateCap: 0,
    rejectedByPermission: 0,
    rejectedByAbility: 0,
    rejectedByCondition: 0,
    rejectedByStaleBasis: 0,
    selectedRequestId: M3_MEDICAL_NO_REQUEST,
    selectedPatientId: 0,
    selectedConditionId: 0,
    selectedRegionId: 0,
    selectedUrgencyBucket: 0,
    selectedPermissionId: 0,
    selectedTreatmentDefId: 0,
    selectedStockDefId: 0,
    selectedStockAmount: 0,
    selectedTargetCellIndex: 0,
    selectedScoreMilli: 0,
    selectedConditionVersion: 0,
    selectedActorConditionVersion: 0,
    selectedHealthStoreVersion: 0,
    selectedSeverity: 0,
    selectedClueRef: 0,
    selectedCounterevidenceRef: 0,
    selectedCaregiverId: M3_MEDICAL_NO_REQUEST,
    caregiverRegionId: 0,
    caregiverPermissionId: 0,
    caregiverAbility: 0,
    caregiverMinimumValue: 0,
    caregiverAbilityValue: 0,
    caregiverActorConditionVersion: 0,
    caregiverBaseAbilityVersion: 0,
    caregiverValid: false,
    caregiverAllowed: false,
    medicalStoreVersion: fixture.medical.version,
    healthStoreVersion: fixture.health.storeVersion,
  };
}

function expectMedicalSelectionScratchReset(
  scratch: MedicalSelectionIntoScratchForTest,
  fixture: MedicalFixture,
): void {
  for (const laneName of MEDICAL_SELECTION_SCRATCH_LANES) {
    const lane = scratch[laneName];
    const expected = laneName === "requestIds" ? M3_MEDICAL_NO_REQUEST : 0;
    for (const value of lane) {
      expect(value).toBe(expected);
    }
  }
  expect(scratch.patientReadOutput).toEqual(
    createPatientRequestResetOutput(M3_MEDICAL_NO_REQUEST, fixture.medical.version),
  );
  expect(scratch.caregiverReadOutput).toEqual(
    createCaregiverStateResetOutput(M3_MEDICAL_NO_REQUEST, fixture.medical.version),
  );
  expect(scratch.abilityQueryOutput).toEqual({
    ok: false,
    reason: "ability.actor_out_of_range",
    actorId: M3_MEDICAL_NO_REQUEST,
    ability: 0,
    value: 0,
    threshold: 0,
    baseValue: 0,
    conditionPenalty: 0,
    actorConditionVersion: 0,
    baseAbilityVersion: 0,
    visitedConditionCount: 0,
  });
}

function createPatientRequestResetOutput(
  requestId: number,
  medicalStoreVersion: number,
): PatientRequestIntoOutput {
  return {
    ok: false,
    reason: "medical.request_id_out_of_range",
    requestId,
    active: false,
    patientId: 0,
    conditionId: 0,
    regionId: 0,
    urgencyBucket: 0,
    permissionId: 0,
    treatmentDefId: 0,
    stockDefId: 0,
    stockAmount: 0,
    targetCellIndex: 0,
    scoreMilli: 0,
    conditionVersion: 0,
    actorConditionVersion: 0,
    healthStoreVersion: 0,
    severity: 0,
    clueRef: 0,
    counterevidenceRef: 0,
    medicalStoreVersion,
  };
}

function createCaregiverStateResetOutput(
  caregiverId: number,
  medicalStoreVersion: number,
): CaregiverStateIntoOutput {
  return {
    ok: false,
    reason: "medical.actor_out_of_range",
    caregiverId,
    valid: false,
    regionId: 0,
    permissionId: 0,
    ability: 0,
    minimumValue: 0,
    allowed: false,
    abilityValue: 0,
    actorConditionVersion: 0,
    baseAbilityVersion: 0,
    medicalStoreVersion,
  };
}

function expectMedicalSelectionScratchRow(
  scratch: MedicalSelectionIntoScratchForTest,
  index: number,
  requestId: number,
  fixture: MedicalFixture,
): void {
  const patient = createPatientRequestIntoOutput();
  fixture.medical.readPatientRequestInto(requestId, patient);
  expect(patient.ok).toBe(true);
  expect(scratch.requestIds[index]).toBe(patient.requestId);
  expect(scratch.patientIds[index]).toBe(patient.patientId);
  expect(scratch.conditionIds[index]).toBe(patient.conditionId);
  expect(scratch.regionIds[index]).toBe(patient.regionId);
  expect(scratch.urgencyBuckets[index]).toBe(patient.urgencyBucket);
  expect(scratch.permissionIds[index]).toBe(patient.permissionId);
  expect(scratch.treatmentDefIds[index]).toBe(patient.treatmentDefId);
  expect(scratch.stockDefIds[index]).toBe(patient.stockDefId);
  expect(scratch.stockAmounts[index]).toBe(patient.stockAmount);
  expect(scratch.targetCellIndexes[index]).toBe(patient.targetCellIndex);
  expect(scratch.scoresMilli[index]).toBe(patient.scoreMilli);
  expect(scratch.conditionVersions[index]).toBe(patient.conditionVersion);
  expect(scratch.actorConditionVersions[index]).toBe(patient.actorConditionVersion);
  expect(scratch.healthStoreVersions[index]).toBe(patient.healthStoreVersion);
  expect(scratch.severities[index]).toBe(patient.severity);
  expect(scratch.clueRefs[index]).toBe(patient.clueRef);
  expect(scratch.counterevidenceRefs[index]).toBe(patient.counterevidenceRef);
}

function createMedicalFixture(requestCapacity = 8): MedicalFixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const caregiver = mustAllocate(registry);
  const patient = mustAllocate(registry);
  const stock = mustAllocate(registry);
  const health = createM3HealthConditionStore({
    actorCapacity: 6,
    conditionCapacity: 8,
    abilityDirtyCapacity: 32,
  });
  const abilities = createM3AbilityCacheStore({ actorCapacity: 6, dirtyCapacity: 32 });
  expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_MOVEMENT, 900)).toEqual({ ok: true });
  expect(abilities.setBaseAbility(ACTOR_YAO, M3_ABILITY_STAMINA, 760)).toEqual({ ok: true });
  expect(abilities.setBaseAbility(ACTOR_MIN, M3_ABILITY_MANIPULATION, 920)).toEqual({ ok: true });
  abilities.drainInvalidationBacklog(8);
  expect(health.addCondition(createSprain())).toMatchObject({ ok: true });
  const medical = createM3MedicalCareStore({
    requestCapacity,
    actorCapacity: 6,
    regionCapacity: 4,
    urgencyBucketCount: 4,
    permissionCapacity: 4,
  });
  const treatments = createM3TreatmentJobStore(8);
  const items = createItemStackStore(4);
  expect(
    items.createStack({
      stackId: STACK_BANDAGE,
      entity: stock,
      defId: DEF_BANDAGE,
      quantity: 3,
      capacity: 3,
    }),
  ).toMatchObject({ ok: true });
  const ledger = createReservationLedger({ capacity: 32, entityCapacity: 16, cellCount: 16 });
  const jobCore = createJobCoreStore({ capacity: 8 });
  const grid = createMapGrid({ width: 4, height: 4, chunkSize: 2 });
  const pathBasis = createPathVersionBasis(grid, {
    navigationVersion: 0,
    regionVersion: 0,
    roomVersion: 0,
    regionGraphVersion: 0,
  });
  return {
    registry,
    health,
    abilities,
    medical,
    treatments,
    items,
    ledger,
    jobCore,
    caregiver,
    patient,
    stock,
    grid,
    pathBasis,
  };
}

function createReadyTreatmentFixture(): MedicalFixture {
  const fixture = createMedicalFixture();
  expect(
    fixture.medical.upsertPatientRequestFromCondition(createRequest(), fixture.health),
  ).toMatchObject({ ok: true });
  allowCaregiver(fixture);
  return fixture;
}

function createVersionSkewTreatmentFixture(): MedicalFixture {
  const fixture = createMedicalFixture();
  expect(fixture.health.addCondition(createSprain(CONDITION_EXTRA))).toMatchObject({ ok: true });
  expect(
    fixture.medical.upsertPatientRequestFromCondition(createRequest(), fixture.health),
  ).toMatchObject({ ok: true });
  allowCaregiver(fixture);
  return fixture;
}

function allowCaregiver(fixture: MedicalFixture): void {
  expect(
    fixture.medical.updateCaregiverStateFromAbility(
      {
        caregiverId: ACTOR_MIN,
        regionId: REGION_CLINIC,
        permissionId: PERMISSION_CLINIC,
        ability: M3_ABILITY_MANIPULATION,
        minimumValue: 700,
        allowed: true,
      },
      fixture.health,
      fixture.abilities,
    ),
  ).toMatchObject({ ok: true });
}

function startTreatingJob(fixture: MedicalFixture, jobId: number): void {
  expect(createTreatmentJob(fixture, jobId)).toMatchObject({ ok: true });
  expect(
    fixture.treatments.reserve(
      jobId,
      10 + jobId,
      fixture.health,
      fixture.abilities,
      fixture.items,
      fixture.ledger,
      fixture.jobCore,
      fixture.registry,
    ),
  ).toMatchObject({ ok: true });
  expect(
    fixture.treatments.startPathing(
      jobId,
      11 + jobId,
      createPath(fixture, 11 + jobId),
      fixture.pathBasis,
      fixture.ledger,
      fixture.jobCore,
    ),
  ).toMatchObject({ ok: true });
  expect(fixture.treatments.beginTreatment(jobId, 12 + jobId, fixture.jobCore)).toMatchObject({
    ok: true,
  });
}

function createTreatmentJob(
  fixture: MedicalFixture,
  jobId: number,
  stockStackId = STACK_BANDAGE,
  severityDelta = 160,
): ReturnType<MedicalFixture["treatments"]["createJob"]> {
  return fixture.treatments.createJob(
    {
      jobId,
      caregiver: fixture.caregiver,
      caregiverActorId: ACTOR_MIN,
      requestId: REQUEST_YAO_SPRAIN,
      stockStackId,
      patientInteractionTarget: fixture.patient,
      patientInteractionSpotId: 7,
      treatmentCellIndex: 5,
      ability: M3_ABILITY_MANIPULATION,
      minimumAbilityValue: 700,
      treatmentTicks: 2,
      workPerTickQ16: 65_536,
      severityDelta,
      createdTick: 0,
    },
    fixture.medical,
    fixture.health,
    fixture.abilities,
    fixture.items,
    fixture.jobCore,
    fixture.registry,
  );
}

function createPath(fixture: MedicalFixture, tick: number): PathSearchResult {
  return createGridPathfinder(fixture.grid.cellCount).findPath(fixture.grid, {
    requestSequence: tick,
    issuedTick: tick,
    startCellIndex: 0,
    goalCellIndex: 5,
    basis: fixture.pathBasis,
  });
}

function createFailedPath(fixture: MedicalFixture, tick: number): PathSearchResult {
  return {
    ok: false,
    requestSequence: tick,
    basis: fixture.pathBasis,
    startCellIndex: 0,
    goalCellIndex: 5,
    reason: "path_no_route",
    nodeExpansions: 0,
  };
}

function createSelectionScratch(): {
  readonly selectedRequestIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
} {
  const selectedRequestIds = new Uint32Array(12);
  selectedRequestIds.fill(M3_MEDICAL_NO_REQUEST);
  return {
    selectedRequestIds,
    selectedScoresMilli: new Int32Array(12),
  };
}

function readConditionOrThrow(
  fixture: MedicalFixture,
  conditionId: number,
): NonNullable<ReturnType<MedicalFixture["health"]["readCondition"]>> {
  const condition = fixture.health.readCondition(conditionId);
  if (condition === undefined) {
    throw new Error(`missing condition ${String(conditionId)}`);
  }
  return condition;
}

function readTreatmentJobOrThrow(
  fixture: MedicalFixture,
  jobId: number,
): NonNullable<ReturnType<MedicalFixture["treatments"]["readJob"]>> {
  const job = fixture.treatments.readJob(jobId);
  if (job === undefined) {
    throw new Error(`missing treatment job ${String(jobId)}`);
  }
  return job;
}

function createSprain(conditionId = CONDITION_YAO_SPRAIN): M3HealthConditionInput {
  return {
    conditionId,
    actorId: conditionId === CONDITION_EXTRA ? ACTOR_SU : ACTOR_YAO,
    defId: DEF_LEFT_LEG_SPRAIN,
    kind: M3_HEALTH_CONDITION_KIND_INJURY,
    bodyPart: BODY_PART_LEFT_LEG,
    severity: 420,
    ageTicks: 0,
    sourceId: SOURCE_SPRAIN,
    componentFlags: 0,
    clueRef: CLUE_LIMP,
    counterevidenceRef: COUNTER_NO_FEVER,
    terminalState: M3_HEALTH_CONDITION_ACTIVE,
    affectedAbilityMask: createM3HealthAbilityMask([M3_ABILITY_MOVEMENT, M3_ABILITY_STAMINA]),
  };
}

function createRequest(): M3MedicalPatientRequestInput {
  return createRequestFor(CONDITION_YAO_SPRAIN, REQUEST_YAO_SPRAIN, 900);
}

function createRequestFor(
  conditionId: number,
  requestId: number,
  scoreMilli: number,
): M3MedicalPatientRequestInput {
  return {
    requestId,
    patientId: ACTOR_YAO,
    conditionId,
    regionId: REGION_CLINIC,
    urgencyBucket: URGENCY_HIGH,
    permissionId: PERMISSION_CLINIC,
    treatmentDefId: DEF_TREAT_SPRAIN,
    stockDefId: DEF_BANDAGE,
    stockAmount: 1,
    targetCellIndex: 5,
    scoreMilli,
  };
}

function failMissingMedicalPatient(): never {
  throw new Error("missing medical patient request");
}

function failMissingCaregiver(): never {
  throw new Error("missing medical caregiver state");
}

function mustAllocate(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const allocated = registry.allocate();
  if (!allocated.ok) {
    throw new Error("test registry capacity exhausted");
  }
  return allocated.entity;
}
