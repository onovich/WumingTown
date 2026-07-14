import { describe, expect, it } from "vitest";

import { createEntityRegistry } from "./entity-id";
import type { EntityId } from "./entity-id";
import {
  JOB_CORE_SNAPSHOT_VERSION,
  JOB_NONE,
  createJobCoreHashFields,
  commitPreparedAutonomyTerminal,
  createJobCoreStore,
  restoreJobCoreStore,
  type JobCreateInput,
  type JobFailureReason,
  type AutonomyJobMutationIntoOutput,
  type PreparedAutonomyTerminal,
  type JobTokenIntoOutput,
} from "./job-core";
import { createReservationLedger } from "./reservation-ledger";
import { formatCanonicalWorldHash } from "./world-hash";

describe("JobCoreStore", () => {
  it("reserves owner-affine autonomy tokens and burns generation across exact release", () => {
    const owner = { index: 2, generation: 7 };
    const store = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const first = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, first);
    expect(first).toMatchObject({
      ok: true,
      found: true,
      ownerOccupied: true,
      ownerLegacyLiveCount: 0,
      jobGeneration: 1,
      state: "reserved",
      slotVersion: 1,
      reservedCount: 1,
    });
    const duplicate = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, duplicate);
    expect(duplicate).toMatchObject({ ok: false, reason: "job_owner_already_bound" });

    const released = createTokenOutput();
    store.releaseReservedAutonomyJobTokenInto(
      first.jobId,
      first.jobGeneration,
      owner,
      first.slotVersion,
      released,
    );
    expect(released).toMatchObject({ ok: true, state: "free", ownerOccupied: false });

    const reused = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, reused);
    expect(reused.jobId).toBe(first.jobId);
    expect(reused.jobGeneration).toBe(2);
    expect(reused.slotVersion).toBe(3);
  });

  it("atomically adopts a reserved token as running and rolls it back to the same token", () => {
    const owner = { index: 1, generation: 4 };
    const store = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const adopted = createTokenOutput();
    store.createRunningJobInto(
      {
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        owner,
        jobKind: 3,
        targetId: 12,
        initialStep: "path_to_source",
        interruptionPolicy: "at_safe_point",
        requiredWorkQ16: 0,
        createdTick: 0x1_0000_0001,
        stepEnteredTick: 0x1_0000_0002,
        adoptionReservationVersion: 11,
        adoptionDriverVersion: 4,
        expectedSlotVersion: token.slotVersion,
        expectedJobCoreVersion: store.version,
      },
      adopted,
    );
    expect(adopted).toMatchObject({ ok: true, state: "running", runningCount: 1 });
    const rolledBack = createTokenOutput();
    store.rollbackRunningAutonomyJobInto(
      {
        jobId: adopted.jobId,
        jobGeneration: adopted.jobGeneration,
        owner,
        expectedSlotVersion: adopted.slotVersion,
        expectedJobCoreVersion: store.version,
        expectedCreatedTick: 0x1_0000_0001,
        expectedAdoptionTick: 0x1_0000_0002,
        expectedReservationVersion: 11,
        expectedAdoptedDriverVersion: 5,
      },
      rolledBack,
    );
    expect(rolledBack).toMatchObject({
      ok: true,
      state: "reserved",
      jobGeneration: token.jobGeneration,
      slotVersion: token.slotVersion + 2,
      reservedCount: 1,
      runningCount: 0,
    });
  });

  it("maintains one exact owner row across legacy-only occupancy and token exclusion", () => {
    const owner = { index: 1, generation: 4 };
    const store = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    expect(store.createJob(createJob({ jobId: 0, owner }))).toMatchObject({ ok: true });
    expect(store.createJob(createJob({ jobId: 1, owner }))).toMatchObject({ ok: true });
    const ownerFacts = createTokenOutput();
    store.readAutonomyJobTokenForOwnerInto(owner, ownerFacts);
    expect(ownerFacts).toMatchObject({
      ok: true,
      found: false,
      ownerOccupied: true,
      ownerLegacyLiveCount: 2,
      ownerIndex: owner.index,
      ownerGeneration: owner.generation,
    });
    const refusedToken = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, refusedToken);
    expect(refusedToken).toMatchObject({ ok: false, reason: "job_owner_already_bound" });
    expect(
      store.createJob(
        createJob({
          jobId: 2,
          owner: { index: owner.index, generation: owner.generation + 1 },
        }),
      ),
    ).toMatchObject({ ok: false, reason: "job_owner_already_bound" });
    expect(store.completeJob(0, 1)).toMatchObject({ ok: true });
    store.readAutonomyJobTokenForOwnerInto(owner, ownerFacts);
    expect(ownerFacts).toMatchObject({ ok: true, ownerLegacyLiveCount: 1 });
    expect(store.completeJob(1, 2)).toMatchObject({ ok: true });
    store.readAutonomyJobTokenForOwnerInto(owner, ownerFacts);
    expect(ownerFacts).toMatchObject({ ok: false, reason: "job_not_active" });
    expect(
      store.createJob(createJob({ jobId: 3, owner: { index: 4, generation: 1 } })),
    ).toMatchObject({ ok: false, reason: "job_owner_invalid" });
  });

  it("always reserves the lowest reusable autonomous id independent of release order", () => {
    const store = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const first = createTokenOutput();
    const second = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, { index: 0, generation: 1 }, first);
    store.reserveAutonomyJobTokenInto(store.version, { index: 1, generation: 1 }, second);
    expect([first.jobId, second.jobId]).toEqual([4, 5]);
    const releasedFirst = createTokenOutput();
    const releasedSecond = createTokenOutput();
    store.releaseReservedAutonomyJobTokenInto(
      first.jobId,
      first.jobGeneration,
      { index: 0, generation: 1 },
      first.slotVersion,
      releasedFirst,
    );
    store.releaseReservedAutonomyJobTokenInto(
      second.jobId,
      second.jobGeneration,
      { index: 1, generation: 1 },
      second.slotVersion,
      releasedSecond,
    );
    const reused = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, { index: 2, generation: 1 }, reused);
    expect(reused.jobId).toBe(4);
    const reverse = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const a = createTokenOutput();
    const b = createTokenOutput();
    reverse.reserveAutonomyJobTokenInto(reverse.version, { index: 0, generation: 1 }, a);
    reverse.reserveAutonomyJobTokenInto(reverse.version, { index: 1, generation: 1 }, b);
    reverse.releaseReservedAutonomyJobTokenInto(
      b.jobId,
      b.jobGeneration,
      { index: 1, generation: 1 },
      b.slotVersion,
      createTokenOutput(),
    );
    reverse.releaseReservedAutonomyJobTokenInto(
      a.jobId,
      a.jobGeneration,
      { index: 0, generation: 1 },
      a.slotVersion,
      createTokenOutput(),
    );
    const reverseReused = createTokenOutput();
    reverse.reserveAutonomyJobTokenInto(
      reverse.version,
      { index: 2, generation: 1 },
      reverseReused,
    );
    expect(reverseReused.jobId).toBe(4);
  });

  it("rejects rollback after any autonomous progress without changing the row", () => {
    const owner = { index: 1, generation: 4 };
    const store = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const adopted = createTokenOutput();
    store.createRunningJobInto(
      {
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        owner,
        jobKind: 3,
        targetId: 12,
        initialStep: "path_to_source",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 1,
        createdTick: 10,
        stepEnteredTick: 11,
        adoptionReservationVersion: 7,
        adoptionDriverVersion: 2,
        expectedSlotVersion: token.slotVersion,
        expectedJobCoreVersion: store.version,
      },
      adopted,
    );
    const progressed = createAutonomyMutationOutput();
    store.tickAutonomyJobInto(
      adopted.jobId,
      adopted.jobGeneration,
      owner,
      adopted.slotVersion,
      store.version,
      12,
      1,
      progressed,
    );
    const before = store.version;
    const rolledBack = createTokenOutput();
    store.rollbackRunningAutonomyJobInto(
      {
        jobId: adopted.jobId,
        jobGeneration: adopted.jobGeneration,
        owner,
        expectedSlotVersion: progressed.slotVersion,
        expectedJobCoreVersion: store.version,
        expectedCreatedTick: 10,
        expectedAdoptionTick: 11,
        expectedReservationVersion: 7,
        expectedAdoptedDriverVersion: 3,
      },
      rolledBack,
    );
    expect(rolledBack).toMatchObject({ ok: false, reason: "job_status_invalid" });
    expect(store.version).toBe(before);
  });

  it("preflights and commits an autonomous terminal tombstone without a fallible tail", () => {
    const owner = { index: 1, generation: 4 };
    const store = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const adopted = createTokenOutput();
    store.createRunningJobInto(
      {
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        owner,
        jobKind: 3,
        targetId: 12,
        initialStep: "interact",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: 0x1_0000_0001,
        stepEnteredTick: 0x1_0000_0002,
        adoptionReservationVersion: 11,
        adoptionDriverVersion: 4,
        expectedSlotVersion: token.slotVersion,
        expectedJobCoreVersion: store.version,
      },
      adopted,
    );
    expect(store.enterStep(adopted.jobId, "interact", 0x1_0000_0003)).toEqual({
      ok: false,
      reason: "job_id_out_of_range",
    });
    const mutation = createAutonomyMutationOutput();
    store.enterAutonomyStepInto(
      adopted.jobId,
      adopted.jobGeneration,
      owner,
      adopted.slotVersion,
      store.version,
      "interact",
      0x1_0000_0003,
      mutation,
    );
    expect(mutation).toMatchObject({ ok: true, slotVersion: adopted.slotVersion + 1 });
    const stale = createAutonomyMutationOutput();
    store.setAutonomyCarriedStateInto(
      adopted.jobId,
      adopted.jobGeneration,
      owner,
      adopted.slotVersion,
      store.version,
      9,
      2,
      0x1_0000_0003,
      stale,
    );
    expect(stale).toMatchObject({ ok: false, reason: "job_token_mismatch" });
    store.setAutonomyCarriedStateInto(
      adopted.jobId,
      adopted.jobGeneration,
      owner,
      mutation.slotVersion,
      store.version,
      9,
      2,
      0x1_0000_0003,
      mutation,
    );
    store.tickAutonomyJobInto(
      adopted.jobId,
      adopted.jobGeneration,
      owner,
      mutation.slotVersion,
      store.version,
      0x1_0000_0004,
      0,
      mutation,
    );
    const prepared = createPreparedAutonomyTerminal();
    store.prepareAutonomyTerminalInto(
      {
        jobId: adopted.jobId,
        jobGeneration: adopted.jobGeneration,
        owner,
        expectedSlotVersion: mutation.slotVersion,
        expectedJobCoreVersion: store.version,
        tick: 0x1_0000_0001,
        status: "completed",
        failureReason: "none",
        effectPhase: 1,
      },
      prepared,
    );
    expect(prepared).toMatchObject({ ok: false, reason: "job_tick_invalid" });
    store.prepareAutonomyTerminalInto(
      {
        jobId: adopted.jobId,
        jobGeneration: adopted.jobGeneration,
        owner,
        expectedSlotVersion: mutation.slotVersion,
        expectedJobCoreVersion: store.version,
        tick: 0x1_0000_0005,
        status: "completed",
        failureReason: "none",
        effectPhase: 1,
      },
      prepared,
    );
    expect(prepared).toMatchObject({ ok: true, nextSlotVersion: mutation.slotVersion + 1 });

    commitPreparedAutonomyTerminal(store, prepared);
    const reused = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, reused);
    expect(reused).toMatchObject({
      ok: true,
      jobId: adopted.jobId,
      jobGeneration: adopted.jobGeneration + 1,
      cumulativeTerminalCount: 1,
      currentTombstoneCount: 1,
    });

    const reusedRunning = createTokenOutput();
    store.createRunningJobInto(
      {
        jobId: reused.jobId,
        jobGeneration: reused.jobGeneration,
        owner,
        jobKind: 3,
        targetId: 12,
        initialStep: "interact",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: 0x1_0000_0004,
        stepEnteredTick: 0x1_0000_0004,
        adoptionReservationVersion: 12,
        adoptionDriverVersion: 5,
        expectedSlotVersion: reused.slotVersion,
        expectedJobCoreVersion: store.version,
      },
      reusedRunning,
    );
    store.prepareAutonomyTerminalInto(
      {
        jobId: reusedRunning.jobId,
        jobGeneration: reusedRunning.jobGeneration,
        owner,
        expectedSlotVersion: reusedRunning.slotVersion,
        expectedJobCoreVersion: store.version,
        tick: 0x1_0000_0005,
        status: "completed",
        failureReason: "none",
        effectPhase: 1,
      },
      prepared,
    );
    commitPreparedAutonomyTerminal(store, prepared);
    const third = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, third);
    expect(third).toMatchObject({ currentTombstoneCount: 1, cumulativeTerminalCount: 2 });
  });

  it("preserves a complete tombstone shadow across reserve snapshot restore and abort", () => {
    const owner = { index: 1, generation: 4 };
    const store = createJobCoreStore({ capacity: 6, ownerCapacity: 3, autonomyJobStart: 4 });
    const first = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, first);
    const running = createTokenOutput();
    store.createRunningJobInto(
      {
        jobId: first.jobId,
        jobGeneration: first.jobGeneration,
        owner,
        jobKind: 9,
        targetId: 21,
        initialStep: "path_to_source",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 10,
        createdTick: 10,
        stepEnteredTick: 11,
        adoptionReservationVersion: 7,
        adoptionDriverVersion: 3,
        expectedSlotVersion: first.slotVersion,
        expectedJobCoreVersion: store.version,
      },
      running,
    );
    const progressed = createAutonomyMutationOutput();
    store.tickAutonomyJobInto(
      running.jobId,
      running.jobGeneration,
      owner,
      running.slotVersion,
      store.version,
      12,
      5,
      progressed,
    );
    const terminal = createPreparedAutonomyTerminal();
    store.prepareAutonomyTerminalInto(
      {
        jobId: running.jobId,
        jobGeneration: running.jobGeneration,
        owner,
        expectedSlotVersion: progressed.slotVersion,
        expectedJobCoreVersion: store.version,
        tick: 13,
        status: "failed",
        failureReason: "path",
        effectPhase: 6,
      },
      terminal,
    );
    commitPreparedAutonomyTerminal(store, terminal);
    const replacement = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, replacement);
    expect(replacement).toMatchObject({
      originShadowPresent: true,
      originJobGeneration: first.jobGeneration,
      originOwnerIndex: owner.index,
      originOwnerGeneration: owner.generation,
      originJobKind: 9,
      originTargetId: 21,
      originStatus: "failed",
      originFailureReason: "path",
      originCreatedTick: 10,
      originTerminalTick: 13,
      originEffectPhase: 6,
      slotGenerationCounter: 2,
      jobGeneration: 2,
    });
    const snapshot = store.createSnapshot();
    expect(snapshot.slots[replacement.jobId]).toMatchObject({
      originStepTickCount: 1,
      originProgressQ16: 5,
      originRequiredWorkQ16: 10,
    });
    const restored = restoreJobCoreStore(snapshot);
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    expect(hashJobSnapshot(restored.createSnapshot())).toBe(hashJobSnapshot(snapshot));
    const aborted = createTokenOutput();
    restored.releaseReservedAutonomyJobTokenInto(
      replacement.jobId,
      replacement.jobGeneration,
      owner,
      replacement.slotVersion,
      aborted,
    );
    expect(aborted).toMatchObject({
      state: "tombstone",
      jobGeneration: first.jobGeneration,
      slotGenerationCounter: 2,
      terminalEffectPhase: 6,
      originShadowPresent: false,
      currentTombstoneCount: 1,
    });
  });

  it("persists owner index and deterministic free heap and rejects schema v1", () => {
    const store = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    expect(
      store.createJob(createJob({ jobId: 0, owner: { index: 0, generation: 2 } })),
    ).toMatchObject({ ok: true });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, { index: 1, generation: 3 }, token);
    const snapshot = store.createSnapshot();
    expect(restoreJobCoreStore(snapshot).createSnapshot()).toStrictEqual(snapshot);
    expect(store.restoreFromSnapshot({ ...snapshot, snapshotVersion: 1 })).toEqual({
      ok: false,
      reason: "job_snapshot_version_unsupported",
    });
  });

  it("supports the exact four-transition version boundary without uint32 wrap", () => {
    const base = createJobCoreStore({ capacity: 5, ownerCapacity: 2, autonomyJobStart: 4 });
    const snapshot = base.createSnapshot();
    const slot = snapshot.slots[4];
    if (slot === undefined) throw new Error("missing autonomy slot");
    const boundary = restoreJobCoreStore({
      ...snapshot,
      storeVersion: 0xffff_fffb,
      slots: copyWithReplacement(snapshot.slots, 4, { ...slot, slotVersion: 0xffff_fffb }),
    });
    const owner = { index: 1, generation: 1 };
    const reserved = createTokenOutput();
    boundary.reserveAutonomyJobTokenInto(boundary.version, owner, reserved);
    expect(reserved).toMatchObject({ slotVersion: 0xffff_fffc, version: 0xffff_fffc });
    const adopted = createTokenOutput();
    boundary.createRunningJobInto(
      {
        jobId: reserved.jobId,
        jobGeneration: reserved.jobGeneration,
        owner,
        jobKind: 1,
        targetId: 2,
        initialStep: "path_to_source",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: 1,
        stepEnteredTick: 2,
        adoptionReservationVersion: 1,
        adoptionDriverVersion: 1,
        expectedSlotVersion: reserved.slotVersion,
        expectedJobCoreVersion: boundary.version,
      },
      adopted,
    );
    expect(adopted).toMatchObject({ slotVersion: 0xffff_fffd, version: 0xffff_fffd });
    const rolledBack = createTokenOutput();
    boundary.rollbackRunningAutonomyJobInto(
      {
        jobId: adopted.jobId,
        jobGeneration: adopted.jobGeneration,
        owner,
        expectedSlotVersion: adopted.slotVersion,
        expectedJobCoreVersion: boundary.version,
        expectedCreatedTick: 1,
        expectedAdoptionTick: 2,
        expectedReservationVersion: 1,
        expectedAdoptedDriverVersion: 2,
      },
      rolledBack,
    );
    expect(rolledBack).toMatchObject({ slotVersion: 0xffff_fffe, version: 0xffff_fffe });
    const released = createTokenOutput();
    boundary.releaseReservedAutonomyJobTokenInto(
      rolledBack.jobId,
      rolledBack.jobGeneration,
      owner,
      rolledBack.slotVersion,
      released,
    );
    expect(released).toMatchObject({ slotVersion: 0xffff_ffff, version: 0xffff_ffff });
    const exhausted = createTokenOutput();
    boundary.reserveAutonomyJobTokenInto(boundary.version, owner, exhausted);
    expect(exhausted).toMatchObject({ ok: false, reason: "job_slot_version_exhausted" });
  });

  it("rejects exhausted global, slot, generation and adoption bases before mutation", () => {
    const owner = { index: 0, generation: 1 };
    const base = createJobCoreStore({ capacity: 5, ownerCapacity: 2, autonomyJobStart: 4 });
    const baseSnapshot = base.createSnapshot();
    const baseSlot = baseSnapshot.slots[4];
    if (baseSlot === undefined) throw new Error("missing autonomy slot");
    const assertReserveRejected = (snapshot: typeof baseSnapshot, reason: string): void => {
      const store = restoreJobCoreStore(snapshot);
      const before = store.createSnapshot();
      const output = createTokenOutput();
      store.reserveAutonomyJobTokenInto(store.version, owner, output);
      expect(output).toMatchObject({ ok: false, reason });
      expect(store.createSnapshot()).toStrictEqual(before);
    };
    for (const version of [0xffff_fffc, 0xffff_fffd, 0xffff_fffe, 0xffff_ffff]) {
      assertReserveRejected(
        { ...baseSnapshot, storeVersion: version },
        "job_core_version_exhausted",
      );
    }
    for (const version of [0xffff_fffc, 0xffff_fffd, 0xffff_fffe, 0xffff_ffff]) {
      assertReserveRejected(
        {
          ...baseSnapshot,
          storeVersion: version,
          slots: copyWithReplacement(baseSnapshot.slots, 4, {
            ...baseSlot,
            slotVersion: version,
          }),
        },
        "job_slot_version_exhausted",
      );
    }
    assertReserveRejected(
      {
        ...baseSnapshot,
        slots: copyWithReplacement(baseSnapshot.slots, 4, {
          ...baseSlot,
          slotGenerationCounter: 0xffff_ffff,
        }),
      },
      "job_generation_exhausted",
    );

    const store = createJobCoreStore({ capacity: 5, ownerCapacity: 2, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const beforeAdoption = store.createSnapshot();
    for (const adoptionDriverVersion of [0xffff_fffe, 0xffff_ffff, 0x1_0000_0000]) {
      const output = createTokenOutput();
      store.createRunningJobInto(
        {
          jobId: token.jobId,
          jobGeneration: token.jobGeneration,
          owner,
          jobKind: 1,
          targetId: 2,
          initialStep: "path_to_source",
          interruptionPolicy: "immediate",
          requiredWorkQ16: 0,
          createdTick: 1,
          stepEnteredTick: 2,
          adoptionReservationVersion: 1,
          adoptionDriverVersion,
          expectedSlotVersion: token.slotVersion,
          expectedJobCoreVersion: store.version,
        },
        output,
      );
      expect(output.ok).toBe(false);
      expect(store.createSnapshot()).toStrictEqual(beforeAdoption);
    }
    const running = createTokenOutput();
    store.createRunningJobInto(
      {
        jobId: token.jobId,
        jobGeneration: token.jobGeneration,
        owner,
        jobKind: 1,
        targetId: 2,
        initialStep: "path_to_source",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: 1,
        stepEnteredTick: 2,
        adoptionReservationVersion: 1,
        adoptionDriverVersion: 0xffff_fffd,
        expectedSlotVersion: token.slotVersion,
        expectedJobCoreVersion: store.version,
      },
      running,
    );
    expect(running.ok).toBe(true);
    const beforeRollback = store.createSnapshot();
    for (const expectedAdoptedDriverVersion of [0xffff_ffff, 0x1_0000_0000]) {
      const output = createTokenOutput();
      store.rollbackRunningAutonomyJobInto(
        {
          jobId: running.jobId,
          jobGeneration: running.jobGeneration,
          owner,
          expectedSlotVersion: running.slotVersion,
          expectedJobCoreVersion: store.version,
          expectedCreatedTick: 1,
          expectedAdoptionTick: 2,
          expectedReservationVersion: 1,
          expectedAdoptedDriverVersion,
        },
        output,
      );
      expect(output).toMatchObject({ ok: false, reason: "job_version_mismatch" });
      expect(store.createSnapshot()).toStrictEqual(beforeRollback);
    }
  });

  it("restores a complete nonzero tombstone after reserve adopt rollback and release", () => {
    const owner = { index: 0, generation: 2 };
    const store = createJobCoreStore({ capacity: 5, ownerCapacity: 2, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const running = adoptToken(store, token, owner, 10, 11, 3, 2);
    const progress = createAutonomyMutationOutput();
    store.tickAutonomyJobInto(
      running.jobId,
      running.jobGeneration,
      owner,
      running.slotVersion,
      store.version,
      12,
      7,
      progress,
    );
    const terminal = createPreparedAutonomyTerminal();
    store.prepareAutonomyTerminalInto(
      {
        jobId: progress.jobId,
        jobGeneration: progress.jobGeneration,
        owner,
        expectedSlotVersion: progress.slotVersion,
        expectedJobCoreVersion: store.version,
        tick: 13,
        status: "failed",
        failureReason: "path",
        effectPhase: 9,
      },
      terminal,
    );
    commitPreparedAutonomyTerminal(store, terminal);
    const terminalSnapshot = store.createSnapshot();
    const terminalRow = terminalSnapshot.slots[running.jobId];
    if (terminalRow === undefined) throw new Error("missing terminal row");

    const replacement = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, replacement);
    const replacementRunning = createTokenOutput();
    store.createRunningJobInto(
      {
        jobId: replacement.jobId,
        jobGeneration: replacement.jobGeneration,
        owner,
        jobKind: 8,
        targetId: 30,
        initialStep: "path_to_source",
        interruptionPolicy: "at_safe_point",
        requiredWorkQ16: 4,
        createdTick: 20,
        stepEnteredTick: 21,
        adoptionReservationVersion: 8,
        adoptionDriverVersion: 5,
        expectedSlotVersion: replacement.slotVersion,
        expectedJobCoreVersion: store.version,
      },
      replacementRunning,
    );
    const rolledBack = createTokenOutput();
    store.rollbackRunningAutonomyJobInto(
      {
        jobId: replacementRunning.jobId,
        jobGeneration: replacementRunning.jobGeneration,
        owner,
        expectedSlotVersion: replacementRunning.slotVersion,
        expectedJobCoreVersion: store.version,
        expectedCreatedTick: 20,
        expectedAdoptionTick: 21,
        expectedReservationVersion: 8,
        expectedAdoptedDriverVersion: 6,
      },
      rolledBack,
    );
    expect(rolledBack).toMatchObject({ ok: true, state: "reserved", originShadowPresent: true });
    const released = createTokenOutput();
    store.releaseReservedAutonomyJobTokenInto(
      rolledBack.jobId,
      rolledBack.jobGeneration,
      owner,
      rolledBack.slotVersion,
      released,
    );
    expect(released).toMatchObject({ ok: true, state: "tombstone", originShadowPresent: false });
    const restoredRow = store.createSnapshot().slots[running.jobId];
    expect(restoredRow).toMatchObject({
      active: terminalRow.active,
      ownerIndex: terminalRow.ownerIndex,
      ownerGeneration: terminalRow.ownerGeneration,
      jobKind: terminalRow.jobKind,
      targetId: terminalRow.targetId,
      statusCode: terminalRow.statusCode,
      stepCode: terminalRow.stepCode,
      interruptionPolicyCode: terminalRow.interruptionPolicyCode,
      failureReasonCode: terminalRow.failureReasonCode,
      createdTick: terminalRow.createdTick,
      stepEnteredTick: terminalRow.stepEnteredTick,
      stepTickCount: terminalRow.stepTickCount,
      progressQ16: terminalRow.progressQ16,
      requiredWorkQ16: terminalRow.requiredWorkQ16,
      carriedDefId: terminalRow.carriedDefId,
      carriedAmount: terminalRow.carriedAmount,
      jobGeneration: terminalRow.jobGeneration,
      autonomyState: terminalRow.autonomyState,
      terminalEffectPhase: terminalRow.terminalEffectPhase,
      adoptionReservationVersion: terminalRow.adoptionReservationVersion,
      adoptionDriverVersion: terminalRow.adoptionDriverVersion,
      adoptionSlotVersion: terminalRow.adoptionSlotVersion,
      lastMutationTick: terminalRow.lastMutationTick,
    });
  });

  it("round trips a RUNNING replacement while retaining its complete tombstone shadow", () => {
    const owner = { index: 0, generation: 2 };
    const store = createJobCoreStore({ capacity: 5, ownerCapacity: 2, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const running = adoptToken(store, token, owner, 10, 11, 3, 2);
    const terminal = createPreparedAutonomyTerminal();
    store.prepareAutonomyTerminalInto(
      {
        jobId: running.jobId,
        jobGeneration: running.jobGeneration,
        owner,
        expectedSlotVersion: running.slotVersion,
        expectedJobCoreVersion: store.version,
        tick: 12,
        status: "completed",
        failureReason: "none",
        effectPhase: 4,
      },
      terminal,
    );
    commitPreparedAutonomyTerminal(store, terminal);
    const replacement = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, replacement);
    const replacementRunning = adoptToken(store, replacement, owner, 20, 21, 5, 7);
    const snapshot = store.createSnapshot();
    expect(snapshot.slots[replacementRunning.jobId]).toMatchObject({
      autonomyState: 2,
      originShadowPresent: 1,
      originJobGeneration: token.jobGeneration,
      originTerminalTick: 12,
      originEffectPhase: 4,
    });
    expect(restoreJobCoreStore(snapshot).createSnapshot()).toStrictEqual(snapshot);
  });

  it("rejects slot permutations and makes their canonical hash diverge", () => {
    const store = createJobCoreStore({ capacity: 6, ownerCapacity: 2, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, { index: 0, generation: 1 }, token);
    const released = createTokenOutput();
    store.releaseReservedAutonomyJobTokenInto(
      token.jobId,
      token.jobGeneration,
      { index: 0, generation: 1 },
      token.slotVersion,
      released,
    );
    const snapshot = store.createSnapshot();
    const slots = [...snapshot.slots];
    const first = slots[4];
    const second = slots[5];
    if (first === undefined || second === undefined) throw new Error("missing autonomy slots");
    slots[4] = second;
    slots[5] = first;
    const permuted = { ...snapshot, slots };
    expect(hashJobSnapshot(permuted)).not.toBe(hashJobSnapshot(snapshot));
    expect(store.restoreFromSnapshot(permuted)).toEqual({
      ok: false,
      reason: "job_snapshot_record_invalid",
    });
    expect(store.createSnapshot()).toStrictEqual(snapshot);
  });

  it("rejects orphan, generation, enum, reverse-tick and mixed-shape snapshot corruption", () => {
    const owner = { index: 0, generation: 2 };
    const store = createJobCoreStore({ capacity: 5, ownerCapacity: 2, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const running = adoptToken(store, token, owner, 10, 11, 3, 2);
    const snapshot = store.createSnapshot();
    const slot = snapshot.slots[running.jobId];
    const ownerRow = snapshot.owners[owner.index];
    if (slot === undefined || ownerRow === undefined) throw new Error("missing snapshot rows");
    const corruptions = [
      {
        ...snapshot,
        owners: copyWithReplacement(snapshot.owners, owner.index, {
          ...ownerRow,
          occupied: 0,
          ownerGeneration: 0,
          autonomyJobId: JOB_NONE,
        }),
      },
      {
        ...snapshot,
        slots: copyWithReplacement(snapshot.slots, running.jobId, {
          ...slot,
          jobGeneration: 0,
        }),
      },
      {
        ...snapshot,
        slots: copyWithReplacement(snapshot.slots, running.jobId, { ...slot, statusCode: 99 }),
      },
      {
        ...snapshot,
        slots: copyWithReplacement(snapshot.slots, running.jobId, {
          ...slot,
          lastMutationTick: 9,
        }),
      },
      { ...snapshot, storeVersion: running.slotVersion - 1 },
      { ...snapshot, unknownLegacyField: 1 },
    ];
    for (const corrupted of corruptions) {
      expect(store.restoreFromSnapshot(corrupted).ok).toBe(false);
      expect(store.createSnapshot()).toStrictEqual(snapshot);
    }
  });

  it("rejects FREE activity, invalid tombstone owners and invalid shadow owners atomically", () => {
    const freeStore = createJobCoreStore({ capacity: 6, ownerCapacity: 2, autonomyJobStart: 4 });
    const freeSnapshot = freeStore.createSnapshot();
    const corruptFree = {
      ...freeSnapshot,
      activeCount: 1,
      slots: copyWithReplacement(freeSnapshot.slots, 4, {
        ...freeSnapshot.slots[4],
        active: 1,
      }),
    };
    expect(freeStore.restoreFromSnapshot(corruptFree).ok).toBe(false);
    expect(freeStore.createSnapshot()).toStrictEqual(freeSnapshot);

    const owner = { index: 0, generation: 2 };
    const token = createTokenOutput();
    freeStore.reserveAutonomyJobTokenInto(freeStore.version, owner, token);
    const running = adoptToken(freeStore, token, owner, 1, 2, 3, 4);
    const terminal = createPreparedAutonomyTerminal();
    freeStore.prepareAutonomyTerminalInto(
      {
        jobId: running.jobId,
        jobGeneration: running.jobGeneration,
        owner,
        expectedSlotVersion: running.slotVersion,
        expectedJobCoreVersion: freeStore.version,
        tick: 3,
        status: "completed",
        failureReason: "none",
        effectPhase: 2,
      },
      terminal,
    );
    commitPreparedAutonomyTerminal(freeStore, terminal);
    const tombstoneSnapshot = freeStore.createSnapshot();
    const invalidTombstone = {
      ...tombstoneSnapshot,
      slots: copyWithReplacement(tombstoneSnapshot.slots, running.jobId, {
        ...tombstoneSnapshot.slots[running.jobId],
        ownerGeneration: 0,
      }),
    };
    expect(freeStore.restoreFromSnapshot(invalidTombstone).ok).toBe(false);
    expect(freeStore.createSnapshot()).toStrictEqual(tombstoneSnapshot);
    const replacement = createTokenOutput();
    freeStore.reserveAutonomyJobTokenInto(freeStore.version, owner, replacement);
    const shadowSnapshot = freeStore.createSnapshot();
    const invalidShadow = {
      ...shadowSnapshot,
      slots: copyWithReplacement(shadowSnapshot.slots, replacement.jobId, {
        ...shadowSnapshot.slots[replacement.jobId],
        originOwnerIndex: 2,
        originOwnerGeneration: 0,
      }),
    };
    expect(freeStore.restoreFromSnapshot(invalidShadow).ok).toBe(false);
    expect(freeStore.createSnapshot()).toStrictEqual(shadowSnapshot);
  });

  it("allows rollback only at the exact untouched adoption basis", () => {
    const owner = { index: 0, generation: 2 };
    const store = createJobCoreStore({ capacity: 5, ownerCapacity: 2, autonomyJobStart: 4 });
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    const running = adoptToken(store, token, owner, 10, 11, 3, 2);
    const mutation = createAutonomyMutationOutput();
    store.setAutonomyCarriedStateInto(
      running.jobId,
      running.jobGeneration,
      owner,
      running.slotVersion,
      store.version,
      JOB_NONE,
      0,
      11,
      mutation,
    );
    const rollback = createTokenOutput();
    store.rollbackRunningAutonomyJobInto(
      {
        jobId: running.jobId,
        jobGeneration: running.jobGeneration,
        owner,
        expectedSlotVersion: mutation.slotVersion,
        expectedJobCoreVersion: store.version,
        expectedCreatedTick: 10,
        expectedAdoptionTick: 11,
        expectedReservationVersion: 3,
        expectedAdoptedDriverVersion: 3,
      },
      rollback,
    );
    expect(rollback).toMatchObject({ ok: false, reason: "job_status_invalid" });
  });

  it("makes legacy terminal transitions once-only and rejects reverse time", () => {
    const owner = { index: 0, generation: 1 };
    const store = createJobCoreStore({ capacity: 6, ownerCapacity: 2, autonomyJobStart: 4 });
    expect(store.createJob(createJob({ jobId: 0, owner, createdTick: 10 }))).toMatchObject({
      ok: true,
    });
    expect(store.enterStep(0, "interact", 12)).toMatchObject({ ok: true });
    expect(store.tickJob(0, 11, 1)).toMatchObject({ ok: false, reason: "job_tick_invalid" });
    expect(store.completeJob(0, 13)).toMatchObject({ ok: true });
    const terminalCount = store.createMetrics().terminalCount;
    expect(store.completeJob(0, 14)).toMatchObject({ ok: false, reason: "job_not_active" });
    expect(store.enterStep(0, "interact", 14)).toMatchObject({
      ok: false,
      reason: "job_not_active",
    });
    expect(store.tickJob(0, 14, 1)).toMatchObject({ ok: false, reason: "job_not_active" });
    expect(store.createMetrics().terminalCount).toBe(terminalCount);
    const token = createTokenOutput();
    store.reserveAutonomyJobTokenInto(store.version, owner, token);
    expect(token).toMatchObject({ ok: true, ownerLegacyLiveCount: 0 });
  });
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

function createTokenOutput(): JobTokenIntoOutput {
  return {
    ok: false,
    found: false,
    reason: undefined,
    jobId: JOB_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    ownerOccupied: false,
    ownerLegacyLiveCount: 0,
    state: "free",
    originState: "free",
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
    originFailureReason: "none",
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

function copyWithReplacement<T>(rows: readonly T[], index: number, replacement: T): T[] {
  const copy: T[] = [];
  for (const row of rows) copy.push(row);
  copy[index] = replacement;
  return copy;
}

function createPreparedAutonomyTerminal(): PreparedAutonomyTerminal {
  return {
    ok: false,
    reason: undefined,
    jobId: JOB_NONE,
    jobGeneration: 0,
    ownerIndex: 0,
    ownerGeneration: 0,
    expectedSlotVersion: 0,
    expectedJobCoreVersion: 0,
    tick: 0,
    statusCode: 0,
    failureReasonCode: 0,
    effectPhase: 0,
    nextSlotVersion: 0,
    nextJobCoreVersion: 0,
  };
}

function createAutonomyMutationOutput(): AutonomyJobMutationIntoOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: JOB_NONE,
    jobGeneration: 0,
    slotVersion: 0,
    version: 0,
    progressQ16: 0,
    readyToComplete: false,
  };
}

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

function adoptToken(
  store: ReturnType<typeof createJobCoreStore>,
  token: JobTokenIntoOutput,
  owner: EntityId,
  createdTick: number,
  adoptionTick: number,
  reservationVersion: number,
  driverVersion: number,
): JobTokenIntoOutput {
  const output = createTokenOutput();
  store.createRunningJobInto(
    {
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      owner,
      jobKind: 3,
      targetId: 12,
      initialStep: "path_to_source",
      interruptionPolicy: "immediate",
      requiredWorkQ16: 0,
      createdTick,
      stepEnteredTick: adoptionTick,
      adoptionReservationVersion: reservationVersion,
      adoptionDriverVersion: driverVersion,
      expectedSlotVersion: token.slotVersion,
      expectedJobCoreVersion: store.version,
    },
    output,
  );
  if (!output.ok) throw new Error(output.reason);
  return output;
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
