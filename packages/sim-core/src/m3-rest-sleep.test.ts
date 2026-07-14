import { describe, expect, it, vi } from "vitest";
import { matchesAutonomyOriginTerminalScalars, type JobTokenIntoOutput } from "./job-core";

import {
  M3_REST_DEFAULT_CANDIDATE_CAP,
  M3_REST_DEFAULT_SELECTED_CAP,
  M3_REST_FIXTURE_NONE,
  M3_REST_SLEEP_JOB_KIND,
  M3_REST_SLEEP_STORE_VERSION,
  RESERVATION_CLAIM_NONE,
  RESERVATION_ENTITY,
  RESERVATION_INTERACTION_SPOT,
  MAP_TERRAIN_BLOCKED,
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  createEntityRegistry,
  createGridPathfinder,
  createJobCoreStore,
  createMapGrid,
  createM3EnvironmentStore,
  createNamedRandomStreams,
  createNeedStore,
  createPathVersionBasis,
  createReservationLedger,
  createRestCandidateIndex,
  createRestAdoptedJobIntoOutput,
  createRestAdoptedMutationOutput,
  createRestJobDriverHashFields,
  createRestJobDriverStore,
  createRestSleepStore,
  createRestSleepTraceStore,
  selectPathResolvedRestFixture,
  formatCanonicalWorldHash,
  type EntityId,
  type PathCandidate,
  type PathVersionBasis,
  type RestClaimAdoptionOutput,
  type RestClaimAdoptionInput,
  type RestAdoptedTerminalInput,
  type RestAdoptedTickInput,
  type RestNewlyAdoptedRollbackControl,
  type ExistingClaimsAdoptionControl,
  type ReservationClaimsIntoOutput,
} from "./index";

describe("M3 rest and sleep indexed selection", () => {
  it("advances an adopted Rest job atomically and releases both exact claims once", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const output = createRestAdoptedMutationOutput();
    const identity = output;
    fixture.rest.beginAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        tick: 102,
      },
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: true, alreadyCommitted: false });
    expect(output).toMatchObject({
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobCoreActiveCount: 1,
      jobCoreRunningCount: 1,
      driverActiveCount: 1,
      driverPathingCount: 0,
      driverRecoveringCount: 1,
      cumulativeCompletedCount: 0,
    });
    const begin = {
      slot: output.jobSlotVersion,
      core: output.jobCoreVersion,
      driver: output.driverVersion,
    };
    fixture.rest.beginAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: begin.slot,
        expectedJobCoreVersion: begin.core,
        expectedDriverVersion: begin.driver,
        tick: 102,
      },
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: true, alreadyCommitted: true });
    const tickInput: RestAdoptedTickInput = {
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      owner: fixture.owner,
      expectedJobSlotVersion: begin.slot,
      expectedJobCoreVersion: begin.core,
      expectedDriverVersion: begin.driver,
      tick: 103,
      needMutation: {
        actorId: fixture.owner.index,
        lane: NEED_LANE_REST,
        tick: 103,
        reason: "need.external_delta" as const,
        sourceSystemId: M3_REST_SLEEP_JOB_KIND,
        sourceEventId: fixture.token.jobId,
        expectedStoreVersion: fixture.needs.version,
        expectedLaneVersion: fixture.needs.readLaneOwnerVersion(
          fixture.owner.index,
          NEED_LANE_REST,
        ),
        expectedValue: 790,
        delta: 1,
      },
    };
    const beforeNeedReject = {
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      need: restNeedBasis(fixture),
    };
    fixture.rest.tickAdoptedInto(
      {
        ...tickInput,
        needMutation: {
          ...tickInput.needMutation,
          expectedLaneVersion: tickInput.needMutation.expectedLaneVersion + 1,
        },
      },
      fixture.needs,
      fixture.core,
      output,
    );
    expect(output.ok).toBe(false);
    expect({
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      need: restNeedBasis(fixture),
    }).toStrictEqual(beforeNeedReject);
    fixture.rest.tickAdoptedInto(tickInput, fixture.needs, fixture.core, output);
    expect(output).toMatchObject({ ok: true, readyToComplete: true, alreadyCommitted: false });
    expect(fixture.needs.readLaneValue(fixture.owner.index, NEED_LANE_REST)).toBe(791);
    const committed = {
      slot: output.jobSlotVersion,
      core: output.jobCoreVersion,
      driver: output.driverVersion,
    };
    const duplicateInput: RestAdoptedTickInput = {
      ...tickInput,
      expectedJobSlotVersion: committed.slot,
      expectedJobCoreVersion: committed.core,
      expectedDriverVersion: committed.driver,
    };
    const forgedNeedMutations: readonly RestAdoptedTickInput["needMutation"][] = [
      { ...duplicateInput.needMutation, actorId: duplicateInput.needMutation.actorId + 1 },
      { ...duplicateInput.needMutation, lane: NEED_LANE_HUNGER },
      { ...duplicateInput.needMutation, reason: "need.manual_set" as const },
      { ...duplicateInput.needMutation, sourceSystemId: M3_REST_SLEEP_JOB_KIND + 1 },
      { ...duplicateInput.needMutation, sourceEventId: fixture.token.jobId + 1 },
      { ...duplicateInput.needMutation, expectedValue: 789 },
      { ...duplicateInput.needMutation, delta: 2 },
      {
        ...duplicateInput.needMutation,
        expectedStoreVersion: duplicateInput.needMutation.expectedStoreVersion + 1,
      },
      {
        ...duplicateInput.needMutation,
        expectedLaneVersion: duplicateInput.needMutation.expectedLaneVersion + 1,
      },
    ];
    for (const needMutation of forgedNeedMutations) {
      const before = {
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        need: restNeedBasis(fixture),
      };
      fixture.rest.tickAdoptedInto(
        { ...duplicateInput, needMutation },
        fixture.needs,
        fixture.core,
        output,
      );
      expect(output.ok).toBe(false);
      expect(output).toMatchObject({
        ownerIndex: RESERVATION_CLAIM_NONE,
        jobCoreActiveCount: 0,
        driverActiveCount: 0,
      });
      expect({
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        need: restNeedBasis(fixture),
      }).toStrictEqual(before);
    }
    const beforeForgedTick = {
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      need: restNeedBasis(fixture),
    };
    fixture.rest.tickAdoptedInto(
      { ...duplicateInput, tick: duplicateInput.tick + 1 },
      fixture.needs,
      fixture.core,
      output,
    );
    expect(output.ok).toBe(false);
    expect({
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      need: restNeedBasis(fixture),
    }).toStrictEqual(beforeForgedTick);
    fixture.rest.tickAdoptedInto(duplicateInput, fixture.needs, fixture.core, output);
    expect(output).toMatchObject({ ok: true, alreadyCommitted: true, readyToComplete: true });
    expect(output).toBe(identity);
    const committedRest = fixture.rest.createSnapshot();
    const hash = (snapshot: typeof committedRest): string =>
      formatCanonicalWorldHash({
        fields: createRestJobDriverHashFields(snapshot),
        randomStreams: [],
        queuedCommands: [],
      });
    const committedHash = hash(committedRest);
    const committedRow = committedRest.rows[fixture.token.jobId];
    if (committedRow === undefined) throw new Error("missing committed Rest row");
    const changedBasisRows = copyWithReplacement(committedRest.rows, fixture.token.jobId, {
      ...committedRow,
      lastNeedDelta: committedRow.lastNeedDelta + 1,
    });
    expect(hash({ ...committedRest, rows: changedBasisRows })).not.toBe(committedHash);
    const corruptRows = copyWithReplacement(committedRest.rows, fixture.token.jobId, {
      ...committedRow,
      lastNeedNextStoreVersion: committedRow.lastNeedNextStoreVersion + 2,
    });
    expect(fixture.rest.restoreFromSnapshot({ ...committedRest, rows: corruptRows })).toMatchObject(
      { ok: false },
    );
    expect(fixture.rest.createSnapshot()).toStrictEqual(committedRest);
    expect(hash(fixture.rest.createSnapshot())).toBe(committedHash);
    const terminal: RestAdoptedTerminalInput = {
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      owner: fixture.owner,
      expectedJobSlotVersion: committed.slot,
      expectedJobCoreVersion: committed.core,
      expectedDriverVersion: committed.driver,
      expectedCurrentLedgerVersion: fixture.ledger.version,
      tick: 104,
      outcome: "completed" as const,
      failureReason: "none" as const,
      terminalReason: "rest.completed" as const,
    };
    const beforeStale = {
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    fixture.rest.terminalAdoptedInto(
      { ...terminal, expectedCurrentLedgerVersion: fixture.ledger.version - 1 },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output.ok).toBe(false);
    expect({
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(beforeStale);
    fixture.rest.terminalAdoptedInto(terminal, fixture.ledger, fixture.core, output);
    expect(output).toMatchObject({
      ok: true,
      releasedClaimCount: 2,
      terminalOutcome: "completed",
      cleanupPending: false,
    });
    expect(output).toMatchObject({
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobCoreActiveCount: 0,
      jobCoreCurrentTombstoneCount: 1,
      jobCoreCumulativeTerminalCount: 1,
      driverActiveCount: 0,
      driverCompletedCount: 1,
      cumulativeCompletedCount: 1,
      cleanupReleaseCount: 2,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    const terminalBasis = {
      slot: output.jobSlotVersion,
      core: output.jobCoreVersion,
      driver: output.driverVersion,
    };
    fixture.rest.terminalAdoptedInto(
      {
        ...terminal,
        expectedJobSlotVersion: terminalBasis.slot,
        expectedJobCoreVersion: terminalBasis.core,
        expectedDriverVersion: terminalBasis.driver,
        expectedCurrentLedgerVersion: fixture.ledger.version,
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      alreadyCommitted: true,
      releasedClaimCount: 0,
      terminalOutcome: "completed",
    });
    expect(output).toMatchObject({
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobCoreActiveCount: 0,
      jobCoreCurrentTombstoneCount: 1,
      jobCoreCumulativeTerminalCount: 1,
      driverActiveCount: 0,
      driverCompletedCount: 1,
      cumulativeCompletedCount: 1,
      cleanupReleaseCount: 2,
    });
  });

  it("persists Rest cleanup pending and resumes only exact release and terminal tail", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const output = createRestAdoptedMutationOutput();
    const identity = output;
    fixture.rest.beginAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        tick: 102,
      },
      fixture.core,
      output,
    );
    const running = {
      slot: output.jobSlotVersion,
      core: output.jobCoreVersion,
      driver: output.driverVersion,
    };
    const liveLedger = fixture.ledger.createSnapshot();
    expect(fixture.ledger.releaseClaims([fixture.ids[0] ?? RESERVATION_CLAIM_NONE])).toMatchObject({
      ok: true,
      releasedCount: 1,
    });
    const terminal: RestAdoptedTerminalInput = {
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      owner: fixture.owner,
      expectedJobSlotVersion: running.slot,
      expectedJobCoreVersion: running.core,
      expectedDriverVersion: running.driver,
      expectedCurrentLedgerVersion: fixture.ledger.version,
      tick: 103,
      outcome: "canceled" as const,
      failureReason: "cancelled" as const,
      terminalReason: "rest.cancelled",
    };
    fixture.rest.terminalAdoptedInto(terminal, fixture.ledger, fixture.core, output);
    expect(output).toMatchObject({ ok: false, cleanupPending: true });
    expect(output).toBe(identity);
    expect(output).toMatchObject({
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobSlotVersion: terminal.expectedJobSlotVersion,
      jobCoreVersion: terminal.expectedJobCoreVersion,
      jobCoreActiveCount: 1,
      driverActiveCount: 1,
      driverRecoveringCount: 1,
      cleanupReleaseCount: 0,
    });
    const pendingDriverVersion = output.driverVersion;
    const pendingRest = fixture.rest.createSnapshot();
    const pendingCore = fixture.core.createSnapshot();
    const pendingRow = pendingRest.rows[fixture.token.jobId];
    if (pendingRow === undefined) throw new Error("missing pending Rest row");
    const pendingRows = [...pendingRest.rows];
    pendingRows[fixture.token.jobId] = { ...pendingRow, pendingOutcome: 4 };
    const pendingProbe = createRestJobDriverStore(8);
    expect(pendingProbe.restoreFromSnapshot(pendingRest)).toMatchObject({ ok: true });
    const pendingProbeBefore = pendingProbe.createSnapshot();
    expect(pendingProbe.restoreFromSnapshot({ ...pendingRest, rows: pendingRows })).toMatchObject({
      ok: false,
    });
    expect(pendingProbe.createSnapshot()).toStrictEqual(pendingProbeBefore);
    const retryFailureBasis = {
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    fixture.rest.resumeCleanupInto(
      {
        ...terminal,
        expectedDriverVersion: pendingDriverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 104,
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({
      ok: false,
      cleanupPending: true,
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration,
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      jobSlotVersion: terminal.expectedJobSlotVersion,
      jobCoreVersion: terminal.expectedJobCoreVersion,
      driverVersion: pendingDriverVersion,
      reservationVersion: fixture.ledger.version,
      jobCoreActiveCount: 1,
      jobCoreRunningCount: 1,
      driverActiveCount: 1,
      driverRecoveringCount: 1,
      driverCanceledCount: 0,
      cumulativeCanceledCount: 0,
      cleanupReleaseCount: 0,
    });
    expect({
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(retryFailureBasis);
    const restoredRest = createRestJobDriverStore(8);
    const restoredCore = createJobCoreStore({
      capacity: 8,
      ownerCapacity: 16,
      autonomyJobStart: 4,
    });
    const restoredLedger = createReservationLedger({
      capacity: 16,
      entityCapacity: 16,
      cellCount: 32,
    });
    expect(restoredRest.restoreFromSnapshot(pendingRest)).toMatchObject({ ok: true });
    expect(restoredCore.restoreFromSnapshot(pendingCore, fixture.registry)).toMatchObject({
      ok: true,
    });
    expect(restoredLedger.restoreFromSnapshot(liveLedger, fixture.registry)).toMatchObject({
      ok: true,
    });
    const pendingBasis = {
      rest: restoredRest.createSnapshot(),
      core: restoredCore.createSnapshot(),
      ledger: restoredLedger.createSnapshot(),
      need: restNeedBasis(fixture),
    };
    restoredRest.beginAdoptedInto(
      {
        jobId: terminal.jobId,
        jobGeneration: terminal.jobGeneration,
        owner: terminal.owner,
        expectedJobSlotVersion: terminal.expectedJobSlotVersion,
        expectedJobCoreVersion: terminal.expectedJobCoreVersion,
        expectedDriverVersion: pendingDriverVersion,
        tick: 104,
      },
      restoredCore,
      output,
    );
    expect(output.ok).toBe(false);
    restoredRest.tickAdoptedInto(
      {
        jobId: terminal.jobId,
        jobGeneration: terminal.jobGeneration,
        owner: terminal.owner,
        expectedJobSlotVersion: terminal.expectedJobSlotVersion,
        expectedJobCoreVersion: terminal.expectedJobCoreVersion,
        expectedDriverVersion: pendingDriverVersion,
        tick: 104,
        needMutation: {
          actorId: fixture.owner.index,
          lane: NEED_LANE_REST,
          tick: 104,
          reason: "need.external_delta",
          sourceSystemId: M3_REST_SLEEP_JOB_KIND,
          sourceEventId: fixture.token.jobId,
          expectedStoreVersion: fixture.needs.version,
          expectedLaneVersion: fixture.needs.readLaneOwnerVersion(
            fixture.owner.index,
            NEED_LANE_REST,
          ),
          expectedValue: 790,
          delta: 1,
        },
      },
      fixture.needs,
      restoredCore,
      output,
    );
    expect(output.ok).toBe(false);
    restoredRest.terminalAdoptedInto(
      {
        ...terminal,
        expectedDriverVersion: pendingDriverVersion,
        expectedCurrentLedgerVersion: restoredLedger.version,
        tick: 104,
      },
      restoredLedger,
      restoredCore,
      output,
    );
    expect(output.ok).toBe(false);
    expect({
      rest: restoredRest.createSnapshot(),
      core: restoredCore.createSnapshot(),
      ledger: restoredLedger.createSnapshot(),
      need: restNeedBasis(fixture),
    }).toStrictEqual(pendingBasis);
    restoredRest.resumeCleanupInto(
      {
        ...terminal,
        expectedDriverVersion: pendingDriverVersion,
        expectedCurrentLedgerVersion: restoredLedger.version,
        tick: 104,
      },
      restoredLedger,
      restoredCore,
      output,
    );
    expect(output).toMatchObject({
      ok: true,
      cleanupPending: false,
      releasedClaimCount: 2,
      terminalOutcome: "canceled",
    });
    expect(output).toMatchObject({
      ownerIndex: fixture.owner.index,
      jobCoreActiveCount: 0,
      jobCoreCurrentTombstoneCount: 1,
      jobCoreCumulativeTerminalCount: 1,
      driverActiveCount: 0,
      driverCanceledCount: 1,
      driverInterruptedCount: 0,
      cumulativeCanceledCount: 1,
      cumulativeInterruptedCount: 0,
      cleanupReleaseCount: 2,
    });
    expect(restoredLedger.createMetrics().activeCount).toBe(0);
  });

  it.each([
    ["canceled", "cancelled", undefined, "rest.cancelled"],
    ["failed", "path", undefined, "path.no_route_to_rest_fixture"],
    ["interrupted", "cancelled", "safe_point", "job.interrupted_safe_point"],
  ] as const)(
    "terminates an adopted phase-zero Rest job as %s exactly once",
    (outcome, failureReason, interruptionKind, terminalReason) => {
      const fixture = createAdoptedRestLifecycleFixture();
      const output = createRestAdoptedMutationOutput();
      const terminalInput: RestAdoptedTerminalInput = {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 102,
        outcome,
        failureReason,
        terminalReason,
        ...(interruptionKind === undefined ? {} : { interruptionKind }),
      };
      fixture.rest.terminalAdoptedInto(terminalInput, fixture.ledger, fixture.core, output);
      expect(output).toMatchObject({
        ok: true,
        terminalOutcome: outcome,
        releasedClaimCount: 2,
        cleanupPending: false,
      });
      expect(fixture.ledger.createMetrics().activeCount).toBe(0);
      const duplicateBasis = {
        slot: output.jobSlotVersion,
        core: output.jobCoreVersion,
        driver: output.driverVersion,
      };
      const beforeDuplicate = {
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
      };
      fixture.rest.terminalAdoptedInto(
        {
          ...terminalInput,
          expectedJobSlotVersion: duplicateBasis.slot,
          expectedJobCoreVersion: duplicateBasis.core,
          expectedDriverVersion: duplicateBasis.driver,
          expectedCurrentLedgerVersion: fixture.ledger.version - 1,
        },
        fixture.ledger,
        fixture.core,
        output,
      );
      expect(output.ok).toBe(false);
      if (outcome === "interrupted") {
        fixture.rest.terminalAdoptedInto(
          {
            ...terminalInput,
            interruptionKind: "immediate",
            expectedJobSlotVersion: duplicateBasis.slot,
            expectedJobCoreVersion: duplicateBasis.core,
            expectedDriverVersion: duplicateBasis.driver,
            expectedCurrentLedgerVersion: fixture.ledger.version,
          },
          fixture.ledger,
          fixture.core,
          output,
        );
        expect(output.ok).toBe(false);
      }
      if (outcome === "canceled" || outcome === "interrupted") {
        if (outcome === "canceled") {
          fixture.rest.terminalAdoptedInto(
            {
              ...terminalInput,
              outcome: "interrupted",
              interruptionKind: "safe_point",
              terminalReason: "job.interrupted_safe_point",
              expectedJobSlotVersion: duplicateBasis.slot,
              expectedJobCoreVersion: duplicateBasis.core,
              expectedDriverVersion: duplicateBasis.driver,
              expectedCurrentLedgerVersion: fixture.ledger.version,
            },
            fixture.ledger,
            fixture.core,
            output,
          );
        } else {
          fixture.rest.terminalAdoptedInto(
            {
              jobId: terminalInput.jobId,
              jobGeneration: terminalInput.jobGeneration,
              owner: terminalInput.owner,
              expectedJobSlotVersion: duplicateBasis.slot,
              expectedJobCoreVersion: duplicateBasis.core,
              expectedDriverVersion: duplicateBasis.driver,
              expectedCurrentLedgerVersion: fixture.ledger.version,
              tick: terminalInput.tick,
              outcome: "canceled",
              failureReason: "cancelled",
              terminalReason: "rest.cancelled",
            },
            fixture.ledger,
            fixture.core,
            output,
          );
        }
        expect(output.ok).toBe(false);
      }
      expect({
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
      }).toStrictEqual(beforeDuplicate);
      fixture.rest.terminalAdoptedInto(
        {
          ...terminalInput,
          expectedJobSlotVersion: duplicateBasis.slot,
          expectedJobCoreVersion: duplicateBasis.core,
          expectedDriverVersion: duplicateBasis.driver,
          expectedCurrentLedgerVersion: fixture.ledger.version,
        },
        fixture.ledger,
        fixture.core,
        output,
      );
      expect(output).toMatchObject({ ok: true, alreadyCommitted: true, releasedClaimCount: 0 });
      expect({
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
      }).toStrictEqual(beforeDuplicate);
    },
  );

  it("rejects a terminal snapshot whose persisted request tuple is not canonical", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const output = createRestAdoptedMutationOutput();
    fixture.rest.terminalAdoptedInto(
      restCanceledTerminal(
        fixture.token.jobId,
        fixture.token.jobGeneration,
        fixture.owner,
        fixture.adopted.jobSlotVersion,
        fixture.adopted.jobCoreVersion,
        fixture.adopted.driverVersion,
        fixture.ledger.version,
        102,
      ),
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output.ok).toBe(true);
    const before = fixture.rest.createSnapshot();
    const row = before.rows[fixture.token.jobId];
    if (row === undefined) throw new Error("missing terminal Rest row");
    const rows = [...before.rows];
    rows[fixture.token.jobId] = { ...row, pendingInterruptionCode: 1 };
    const hash = (): string =>
      formatCanonicalWorldHash({
        fields: createRestJobDriverHashFields(fixture.rest.createSnapshot()),
        randomStreams: [],
        queuedCommands: [],
      });
    const beforeHash = hash();
    expect(fixture.rest.restoreFromSnapshot({ ...before, rows })).toMatchObject({ ok: false });
    expect(fixture.rest.createSnapshot()).toStrictEqual(before);
    expect(hash()).toBe(beforeHash);
    rows[fixture.token.jobId] = { ...row, terminalOutcome: 4 };
    expect(fixture.rest.restoreFromSnapshot({ ...before, rows })).toMatchObject({ ok: false });
    expect(fixture.rest.createSnapshot()).toStrictEqual(before);
    expect(hash()).toBe(beforeHash);
  });

  it("rejects non-canonical empty and fabricated legacy rows atomically", () => {
    const rest = createRestJobDriverStore(8);
    const before = rest.createSnapshot();
    const hash = (): string =>
      formatCanonicalWorldHash({
        fields: createRestJobDriverHashFields(rest.createSnapshot()),
        randomStreams: [],
        queuedCommands: [],
      });
    const beforeHash = hash();
    const row = before.rows[0];
    if (row === undefined) throw new Error("missing canonical Rest row");
    const corruptions = [
      { ...row, environmentVersion: 1 },
      { ...row, claimCreatedTicks: [1, 0], claimLeaseExpiryTicks: [2, 0] },
      { ...row, active: 1 },
    ];
    for (const corrupted of corruptions) {
      const rows = [...before.rows];
      rows[0] = corrupted;
      expect(
        rest.restoreFromSnapshot({ ...before, activeCount: corrupted.active, rows }),
      ).toMatchObject({ ok: false });
      expect(rest.createSnapshot()).toStrictEqual(before);
      expect(hash()).toBe(beforeHash);
    }
  });

  it("rejects every non-canonical adopted terminal tuple before owner mutation", () => {
    const cases: readonly Partial<RestAdoptedTerminalInput>[] = [
      { outcome: "completed", failureReason: "cancelled", terminalReason: "rest.completed" },
      { outcome: "canceled", failureReason: "none", terminalReason: "rest.cancelled" },
      {
        outcome: "interrupted",
        failureReason: "cancelled",
        terminalReason: "job.interrupted_safe_point",
      },
      {
        outcome: "interrupted",
        failureReason: "cancelled",
        interruptionKind: "safe_point",
        terminalReason: "rest.cancelled",
      },
      { outcome: "interrupted", failureReason: "cancelled", terminalReason: "rest.cancelled" },
      {
        outcome: "canceled",
        failureReason: "cancelled",
        interruptionKind: "safe_point",
        terminalReason: "job.interrupted_safe_point",
      },
      { outcome: "failed", failureReason: "path", terminalReason: "rest.need_update_failed" },
    ];
    for (const mismatch of cases) {
      const fixture = createAdoptedRestLifecycleFixture();
      const input: RestAdoptedTerminalInput = {
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
        terminalReason: "rest.cancelled",
        ...mismatch,
      };
      const before = {
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
      };
      const output = createRestAdoptedMutationOutput();
      fixture.rest.terminalAdoptedInto(input, fixture.ledger, fixture.core, output);
      expect(output).toMatchObject({ ok: false, cleanupPending: false });
      expect({
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
      }).toStrictEqual(before);
    }
  });

  it("rejects mismatched active and terminal JobCore committed rows without mutation", () => {
    const activeFixture = createAdoptedRestLifecycleFixture();
    const output = createRestAdoptedMutationOutput();
    activeFixture.rest.beginAdoptedInto(
      {
        jobId: activeFixture.token.jobId,
        jobGeneration: activeFixture.token.jobGeneration,
        owner: activeFixture.owner,
        expectedJobSlotVersion: activeFixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: activeFixture.adopted.jobCoreVersion,
        expectedDriverVersion: activeFixture.adopted.driverVersion,
        tick: 102,
      },
      activeFixture.core,
      output,
    );
    expect(output.ok).toBe(true);
    const activeBasis = {
      slot: output.jobSlotVersion,
      core: output.jobCoreVersion,
      driver: output.driverVersion,
    };
    const rogueProgress = {
      ok: false,
      reason: undefined,
      jobId: M3_REST_FIXTURE_NONE,
      jobGeneration: 0,
      slotVersion: 0,
      version: 0,
      progressQ16: 0,
      readyToComplete: false,
    };
    activeFixture.core.tickAutonomyJobInto(
      activeFixture.token.jobId,
      activeFixture.token.jobGeneration,
      activeFixture.owner,
      activeBasis.slot,
      activeBasis.core,
      103,
      1,
      rogueProgress,
    );
    expect(rogueProgress.ok).toBe(true);
    const staleRest = activeFixture.rest.createSnapshot();
    const staleRow = staleRest.rows[activeFixture.token.jobId];
    if (staleRow === undefined) throw new Error("missing active Rest row");
    const staleRows = [...staleRest.rows];
    staleRows[activeFixture.token.jobId] = {
      ...staleRow,
      jobSlotVersion: rogueProgress.slotVersion,
    };
    expect(activeFixture.rest.restoreFromSnapshot({ ...staleRest, rows: staleRows })).toMatchObject(
      { ok: true },
    );
    const activeBefore = {
      rest: activeFixture.rest.createSnapshot(),
      core: activeFixture.core.createSnapshot(),
    };
    activeFixture.rest.beginAdoptedInto(
      {
        jobId: activeFixture.token.jobId,
        jobGeneration: activeFixture.token.jobGeneration,
        owner: activeFixture.owner,
        expectedJobSlotVersion: rogueProgress.slotVersion,
        expectedJobCoreVersion: rogueProgress.version,
        expectedDriverVersion: activeBasis.driver,
        tick: 102,
      },
      activeFixture.core,
      output,
    );
    expect(output.ok).toBe(false);
    expect({
      rest: activeFixture.rest.createSnapshot(),
      core: activeFixture.core.createSnapshot(),
    }).toStrictEqual(activeBefore);

    const terminalFixture = createAdoptedRestLifecycleFixture();
    const request = restCanceledTerminal(
      terminalFixture.token.jobId,
      terminalFixture.token.jobGeneration,
      terminalFixture.owner,
      terminalFixture.adopted.jobSlotVersion,
      terminalFixture.adopted.jobCoreVersion,
      terminalFixture.adopted.driverVersion,
      terminalFixture.ledger.version,
      102,
    );
    terminalFixture.rest.terminalAdoptedInto(
      request,
      terminalFixture.ledger,
      terminalFixture.core,
      output,
    );
    expect(output.ok).toBe(true);
    const terminalBasis = {
      slot: output.jobSlotVersion,
      core: output.jobCoreVersion,
      driver: output.driverVersion,
    };
    const terminalSnapshot = terminalFixture.core.createSnapshot();
    const terminalSlot = terminalSnapshot.slots[terminalFixture.token.jobId];
    if (terminalSlot === undefined) throw new Error("missing terminal JobCore slot");
    const terminalCorruptions = [
      { slot: { ...terminalSlot, interruptionPolicyCode: 2 }, kind: "policy" as const },
      {
        slot: { ...terminalSlot, stepTickCount: terminalSlot.stepTickCount + 1 },
        kind: "ticks" as const,
      },
    ];
    for (const corruption of terminalCorruptions) {
      const slots = [...terminalSnapshot.slots];
      slots[terminalFixture.token.jobId] = corruption.slot;
      const records: (typeof terminalSnapshot.records)[number][] = [];
      for (const record of terminalSnapshot.records) {
        if (record.jobId !== terminalFixture.token.jobId) records.push(record);
        else if (corruption.kind === "policy")
          records.push({ ...record, interruptionPolicy: "immediate" });
        else records.push({ ...record, stepTickCount: record.stepTickCount + 1 });
      }
      const forgedTerminalCore = createJobCoreStore({
        capacity: 8,
        ownerCapacity: 16,
        autonomyJobStart: 4,
      });
      expect(
        forgedTerminalCore.restoreFromSnapshot(
          { ...terminalSnapshot, slots, records },
          terminalFixture.registry,
        ),
      ).toMatchObject({ ok: true });
      const before = {
        rest: terminalFixture.rest.createSnapshot(),
        core: forgedTerminalCore.createSnapshot(),
        ledger: terminalFixture.ledger.createSnapshot(),
      };
      terminalFixture.rest.terminalAdoptedInto(
        {
          ...request,
          expectedJobSlotVersion: terminalBasis.slot,
          expectedJobCoreVersion: terminalBasis.core,
          expectedDriverVersion: terminalBasis.driver,
          expectedCurrentLedgerVersion: terminalFixture.ledger.version,
        },
        terminalFixture.ledger,
        forgedTerminalCore,
        output,
      );
      expect(output.ok).toBe(false);
      expect({
        rest: terminalFixture.rest.createSnapshot(),
        core: forgedTerminalCore.createSnapshot(),
        ledger: terminalFixture.ledger.createSnapshot(),
      }).toStrictEqual(before);
    }
  });

  it("does not complete from original work when the prepared Need remains below target", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const output = createRestAdoptedMutationOutput();
    fixture.rest.beginAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: fixture.adopted.jobSlotVersion,
        expectedJobCoreVersion: fixture.adopted.jobCoreVersion,
        expectedDriverVersion: fixture.adopted.driverVersion,
        tick: 102,
      },
      fixture.core,
      output,
    );
    expect(
      fixture.needs.applyLaneDelta(
        {
          actorId: fixture.owner.index,
          lane: NEED_LANE_REST,
          tick: 103,
          reason: "need.external_delta",
          sourceSystemId: 99,
          sourceEventId: 1,
        },
        -10,
      ),
    ).toMatchObject({ ok: true });
    fixture.rest.tickAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: output.jobSlotVersion,
        expectedJobCoreVersion: output.jobCoreVersion,
        expectedDriverVersion: output.driverVersion,
        tick: 104,
        needMutation: {
          actorId: fixture.owner.index,
          lane: NEED_LANE_REST,
          tick: 104,
          reason: "need.external_delta",
          sourceSystemId: M3_REST_SLEEP_JOB_KIND,
          sourceEventId: fixture.token.jobId,
          expectedStoreVersion: fixture.needs.version,
          expectedLaneVersion: fixture.needs.readLaneOwnerVersion(
            fixture.owner.index,
            NEED_LANE_REST,
          ),
          expectedValue: 780,
          delta: 1,
        },
      },
      fixture.needs,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: true, readyToComplete: false });
    const before = {
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    fixture.rest.terminalAdoptedInto(
      {
        jobId: fixture.token.jobId,
        jobGeneration: fixture.token.jobGeneration,
        owner: fixture.owner,
        expectedJobSlotVersion: output.jobSlotVersion,
        expectedJobCoreVersion: output.jobCoreVersion,
        expectedDriverVersion: output.driverVersion,
        expectedCurrentLedgerVersion: fixture.ledger.version,
        tick: 105,
        outcome: "completed",
        failureReason: "none",
        terminalReason: "rest.completed",
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output.ok).toBe(false);
    expect({
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(before);
  });

  it("rejects every legacy id-only Rest root before touching a positive-generation row", () => {
    const calls = [
      (fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>): LegacyRestMutationResult =>
        fixture.rest.beginRecovery(fixture.token.jobId, 102, fixture.core),
      (fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>): LegacyRestMutationResult =>
        fixture.rest.tickRecovery(
          fixture.token.jobId,
          102,
          fixture.needs,
          fixture.core,
          fixture.ledger,
        ),
      (fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>): LegacyRestMutationResult =>
        fixture.rest.cancel(fixture.token.jobId, 102, fixture.ledger, fixture.core),
      (fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>): LegacyRestMutationResult =>
        fixture.rest.fail(
          fixture.token.jobId,
          102,
          "path.no_route_to_rest_fixture",
          fixture.ledger,
          fixture.core,
        ),
      (fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>): LegacyRestMutationResult =>
        fixture.rest.interrupt(
          fixture.token.jobId,
          "safe_point",
          102,
          fixture.ledger,
          fixture.core,
        ),
      (fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>): LegacyRestMutationResult =>
        fixture.rest.reserveFixture(
          fixture.token.jobId,
          102,
          202,
          createRestSleepStore(1, 1, 1),
          fixture.registry,
          fixture.ledger,
          fixture.core,
        ),
    ];
    for (const call of calls) {
      const fixture = createAdoptedRestLifecycleFixture();
      const before = {
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
        need: restNeedBasis(fixture),
      };
      expect(call(fixture)).toMatchObject({ ok: false });
      expect({
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
        ledger: fixture.ledger.createSnapshot(),
        need: restNeedBasis(fixture),
      }).toStrictEqual(before);
    }
  });

  it("rejects an exhausted ledger before creating an unrecoverable cleanup-pending row", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const live = fixture.ledger.createSnapshot();
    expect(
      fixture.ledger.restoreFromSnapshot({ ...live, ledgerVersion: 0xffff_ffff }, fixture.registry),
    ).toMatchObject({ ok: true });
    const before = {
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    };
    const output = createRestAdoptedMutationOutput();
    fixture.rest.terminalAdoptedInto(
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
        terminalReason: "rest.cancelled",
      },
      fixture.ledger,
      fixture.core,
      output,
    );
    expect(output).toMatchObject({ ok: false, cleanupPending: false });
    expect({
      rest: fixture.rest.createSnapshot(),
      core: fixture.core.createSnapshot(),
      ledger: fixture.ledger.createSnapshot(),
    }).toStrictEqual(before);
  });

  it("restores a reused terminal Rest origin exactly on adoption rollback", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const terminal = createRestAdoptedMutationOutput();
    fixture.rest.terminalAdoptedInto(
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
        terminalReason: "rest.cancelled",
      },
      fixture.ledger,
      fixture.core,
      terminal,
    );
    expect(terminal).toMatchObject({
      ok: true,
      driverCanceledCount: 1,
      cumulativeCanceledCount: 1,
      jobCoreCurrentTombstoneCount: 1,
    });
    const terminalSnapshot = fixture.rest.createSnapshot();
    const terminalRow = terminalSnapshot.rows[fixture.token.jobId];
    if (terminalRow === undefined) throw new Error("missing Rest terminal row");
    const nextToken = restTokenOutput();
    fixture.core.reserveAutonomyJobTokenInto(fixture.core.version, fixture.owner, nextToken);
    expect(nextToken).toMatchObject({
      ok: true,
      jobId: fixture.token.jobId,
      jobGeneration: fixture.token.jobGeneration + 1,
    });
    const acquired = fixture.ledger.acquire(
      {
        owner: fixture.owner,
        jobId: nextToken.jobId,
        jobGeneration: nextToken.jobGeneration,
        createdTick: 200,
        leaseExpiryTick: 400,
        claims: [
          { channel: "entity", target: fixture.fixtureEntity },
          { channel: "interaction_spot", target: fixture.fixtureEntity, spotId: 4 },
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
    const claims = restClaims(
      fixture.owner,
      fixture.fixtureEntity,
      nextToken.jobId,
      nextToken.jobGeneration,
    );
    fixture.ledger.readActiveClaimsInto(
      ids,
      epochs,
      2,
      fixture.owner,
      nextToken.jobId,
      nextToken.jobGeneration,
      acquired.version,
      claims,
    );
    const control: ExistingClaimsAdoptionControl = {
      jobId: nextToken.jobId,
      jobGeneration: nextToken.jobGeneration,
      ownerIndex: fixture.owner.index,
      ownerGeneration: fixture.owner.generation,
      expectedJobSlotVersion: nextToken.slotVersion,
      expectedJobCoreVersion: fixture.core.version,
      expectedDriverVersion: terminal.driverVersion,
      claimCount: 2,
      claimIds: ids,
      claimEpochs: epochs,
      claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
      claimCreatedTick: 200,
      adoptionTick: 201,
      reservationReadVersion: acquired.version,
    };
    const adoptionInput: RestClaimAdoptionInput = {
      jobId: nextToken.jobId,
      owner: fixture.owner,
      actorId: fixture.owner.index,
      fixtureId: 5,
      restKind: "sleep",
      recoveryTargetValue: 791,
      recoveryPerTickQ16: 65_536,
      createdTick: 200,
      interruptionPolicy: "at_safe_point",
      fixtureEntity: fixture.fixtureEntity,
      targetCellIndex: 20,
      interactionSpotId: 4,
      scheduleWindow: "night",
      environmentVersion: 3,
      needOwnerVersion: fixture.needs.readLaneOwnerVersion(fixture.owner.index, NEED_LANE_REST),
      currentRestValue: 790,
      readClaimIds: ids,
      readClaimEpochs: epochs,
      claims,
    };
    const adopted = restDriverOutput();
    fixture.rest.adoptExistingClaimsInto(control, adoptionInput, fixture.core, adopted);
    expect(adopted).toMatchObject({ ok: true, driverCanceledCount: 0, cumulativeCanceledCount: 1 });
    const rolled = restDriverOutput();
    expect(fixture.rest.createSnapshot().rows[nextToken.jobId]).toMatchObject({
      active: 1,
      ownerIndex: control.ownerIndex,
      ownerGeneration: control.ownerGeneration,
      actorId: adoptionInput.actorId,
      fixtureId: adoptionInput.fixtureId,
      restKindCode: 1,
      stepCode: 2,
      targetCellIndex: adoptionInput.targetCellIndex,
      interactionSpotId: adoptionInput.interactionSpotId,
      scheduleCode: 3,
      environmentVersion: adoptionInput.environmentVersion,
      needOwnerVersion: adoptionInput.needOwnerVersion,
      reservationVersion: control.reservationReadVersion,
      claimIds: [control.claimIds[0], control.claimIds[1]],
      claimEpochs: [control.claimEpochs[0], control.claimEpochs[1]],
      claimCreatedTicks: [control.claimCreatedTick, control.claimCreatedTick],
      claimLeaseExpiryTicks: [control.claimLeaseExpiryTicks[0], control.claimLeaseExpiryTicks[1]],
      jobGeneration: control.jobGeneration,
      jobSlotVersion: adopted.jobSlotVersion,
      jobCoreStepTickCount: 0,
      jobCoreAdoptionReservationVersion: control.reservationReadVersion,
      jobCoreAdoptionDriverVersion: control.expectedDriverVersion,
      jobCoreAdoptionSlotVersion: adopted.jobSlotVersion,
      createdTick: control.claimCreatedTick,
      recoveryTargetValue: adoptionInput.recoveryTargetValue,
      recoveryPerTickQ16: adoptionInput.recoveryPerTickQ16,
      recoveryProgressQ16: 0,
      stepEnteredTick: control.adoptionTick,
      lastEffectTick: control.adoptionTick,
      effectPhase: 0,
      interruptionPolicyCode: 1,
      requiredWorkQ16: 65_536,
      readyToComplete: 0,
      cleanupPending: 0,
      pendingOutcome: 0,
      pendingReasonCode: 0,
      pendingFailureCode: 0,
      pendingInterruptionCode: 0,
      returnedOnce: 0,
      terminalReasonCode: 0,
      terminalOutcome: 0,
    });
    const restOrigin = fixture.rest.createSnapshot().rows[nextToken.jobId]?.origin;
    const coreOrigin = fixture.core.createSnapshot().slots[nextToken.jobId];
    expect(restOrigin).toMatchObject({
      jobCoreStepTickCount: coreOrigin?.originStepTickCount,
      jobCoreAdoptionReservationVersion: coreOrigin?.originAdoptionReservationVersion,
      jobCoreAdoptionDriverVersion: coreOrigin?.originAdoptionDriverVersion,
      jobCoreAdoptionSlotVersion: coreOrigin?.originAdoptionSlotVersion,
    });
    expect(coreOrigin).toMatchObject({
      active: 1,
      jobKind: M3_REST_SLEEP_JOB_KIND,
      targetId: adoptionInput.fixtureId,
      statusCode: 2,
      stepCode: 2,
      interruptionPolicyCode: 1,
      failureReasonCode: 0,
      createdTick: control.claimCreatedTick,
      stepEnteredTick: control.adoptionTick,
      stepTickCount: 0,
      progressQ16: 0,
      requiredWorkQ16: 65_536,
      carriedDefId: M3_REST_FIXTURE_NONE,
      carriedAmount: 0,
      terminalEffectPhase: 0,
      lastMutationTick: control.adoptionTick,
      originJobGeneration: restOrigin?.jobGeneration,
      originOwnerIndex: restOrigin?.ownerIndex,
      originOwnerGeneration: restOrigin?.ownerGeneration,
      originJobKind: M3_REST_SLEEP_JOB_KIND,
      originTargetId: restOrigin?.fixtureId,
      originStatusCode: 5,
      originFailureReasonCode: 8,
      originCreatedTick: restOrigin?.createdTick,
      originTerminalTick: restOrigin?.lastEffectTick,
      originEffectPhase: restOrigin?.effectPhase,
      originInterruptionPolicyCode: 1,
      originProgressQ16: restOrigin?.recoveryProgressQ16,
      originRequiredWorkQ16: restOrigin?.requiredWorkQ16,
      originStepTickCount: restOrigin?.jobCoreStepTickCount,
      originAdoptionReservationVersion: restOrigin?.jobCoreAdoptionReservationVersion,
      originAdoptionDriverVersion: restOrigin?.jobCoreAdoptionDriverVersion,
      originAdoptionSlotVersion: restOrigin?.jobCoreAdoptionSlotVersion,
      originLastMutationTick: restOrigin?.lastEffectTick,
    });
    expect(
      matchesAutonomyOriginTerminalScalars(
        fixture.core,
        nextToken.jobId,
        nextToken.jobGeneration,
        fixture.owner.index,
        fixture.owner.generation,
        adopted.jobSlotVersion,
        restOrigin?.jobGeneration ?? 0,
        restOrigin?.ownerIndex ?? 0,
        restOrigin?.ownerGeneration ?? 0,
        M3_REST_SLEEP_JOB_KIND,
        restOrigin?.fixtureId ?? M3_REST_FIXTURE_NONE,
        "canceled",
        "cancelled",
        restOrigin?.createdTick ?? 0,
        restOrigin?.lastEffectTick ?? 0,
        restOrigin?.effectPhase ?? 0,
        "at_safe_point",
        restOrigin?.recoveryProgressQ16 ?? 0,
        restOrigin?.requiredWorkQ16 ?? 0,
        restOrigin?.jobCoreStepTickCount ?? 0,
        restOrigin?.jobCoreAdoptionReservationVersion ?? 0,
        restOrigin?.jobCoreAdoptionDriverVersion ?? 0,
        restOrigin?.jobCoreAdoptionSlotVersion ?? 0,
      ),
    ).toBe(true);
    const originToken = restTokenOutput();
    fixture.core.readAutonomyJobTokenInto(
      nextToken.jobId,
      nextToken.jobGeneration,
      fixture.owner,
      adopted.jobSlotVersion,
      originToken,
    );
    expect(originToken).toMatchObject({
      ok: true,
      version: adopted.jobCoreVersion,
      originShadowPresent: true,
      originJobGeneration: restOrigin?.jobGeneration,
      originOwnerIndex: restOrigin?.ownerIndex,
      originOwnerGeneration: restOrigin?.ownerGeneration,
      originJobKind: M3_REST_SLEEP_JOB_KIND,
      originTargetId: restOrigin?.fixtureId,
      originStatus: "canceled",
      originFailureReason: "cancelled",
      originCreatedTick: restOrigin?.createdTick,
      originTerminalTick: restOrigin?.lastEffectTick,
      originEffectPhase: restOrigin?.effectPhase,
    });
    fixture.rest.rollbackNewlyAdoptedInto(
      restRollbackControl(control, adoptionInput, adopted),
      fixture.core,
      rolled,
    );
    expect(rolled.reason).toBeUndefined();
    expect(rolled).toMatchObject({
      ok: true,
      driverCanceledCount: 1,
      cumulativeCanceledCount: 1,
      jobCoreCurrentTombstoneCount: 1,
      jobSlotVersion: control.expectedJobSlotVersion + 3,
    });
    expect(fixture.core.createSnapshot().slots[nextToken.jobId]?.slotVersion).toBe(
      rolled.jobSlotVersion,
    );
    const restoredSnapshot = fixture.rest.createSnapshot();
    const restoredRow = restoredSnapshot.rows[nextToken.jobId];
    expect(restoredRow).toMatchObject({
      active: 0,
      jobGeneration: terminalRow.jobGeneration,
      ownerIndex: terminalRow.ownerIndex,
      ownerGeneration: terminalRow.ownerGeneration,
      stepCode: terminalRow.stepCode,
      terminalReasonCode: terminalRow.terminalReasonCode,
      effectPhase: terminalRow.effectPhase,
      lastNeedExpectedValue: terminalRow.lastNeedExpectedValue,
      lastNeedDelta: terminalRow.lastNeedDelta,
      jobSlotVersion: control.expectedJobSlotVersion + 3,
    });
    const restoredHash = formatCanonicalWorldHash({
      fields: createRestJobDriverHashFields(restoredSnapshot),
      randomStreams: [],
      queuedCommands: [],
    });
    const roundTrip = createRestJobDriverStore(8);
    expect(roundTrip.restoreFromSnapshot(restoredSnapshot)).toMatchObject({ ok: true });
    expect(
      formatCanonicalWorldHash({
        fields: createRestJobDriverHashFields(roundTrip.createSnapshot()),
        randomStreams: [],
        queuedCommands: [],
      }),
    ).toBe(restoredHash);
  });

  it("clears terminal origin shadows across consecutive autonomous generations", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const firstTerminal = createRestAdoptedMutationOutput();
    fixture.rest.terminalAdoptedInto(
      restCanceledTerminal(
        fixture.token.jobId,
        fixture.token.jobGeneration,
        fixture.owner,
        fixture.adopted.jobSlotVersion,
        fixture.adopted.jobCoreVersion,
        fixture.adopted.driverVersion,
        fixture.ledger.version,
        102,
      ),
      fixture.ledger,
      fixture.core,
      firstTerminal,
    );
    expect(firstTerminal).toMatchObject({
      ok: true,
      driverCanceledCount: 1,
      cumulativeCanceledCount: 1,
    });
    const second = adoptNextRestGeneration(fixture, 200, 201);
    expect(second.adopted).toMatchObject({
      ok: true,
      driverCanceledCount: 0,
      cumulativeCanceledCount: 1,
    });
    const secondTerminal = createRestAdoptedMutationOutput();
    fixture.rest.terminalAdoptedInto(
      restCanceledTerminal(
        second.token.jobId,
        second.token.jobGeneration,
        fixture.owner,
        second.adopted.jobSlotVersion,
        second.adopted.jobCoreVersion,
        second.adopted.driverVersion,
        fixture.ledger.version,
        202,
      ),
      fixture.ledger,
      fixture.core,
      secondTerminal,
    );
    expect(secondTerminal).toMatchObject({
      ok: true,
      driverCanceledCount: 1,
      cumulativeCanceledCount: 2,
    });
    expect(fixture.rest.createSnapshot().rows[second.token.jobId]?.origin.present).toBe(0);
    const third = adoptNextRestGeneration(fixture, 300, 301);
    expect(third.adopted).toMatchObject({
      ok: true,
      driverCanceledCount: 0,
      cumulativeCanceledCount: 2,
    });
    const snapshot = fixture.rest.createSnapshot();
    const restored = createRestJobDriverStore(8);
    expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    expect(
      formatCanonicalWorldHash({
        fields: createRestJobDriverHashFields(restored.createSnapshot()),
        randomStreams: [],
        queuedCommands: [],
      }),
    ).toBe(
      formatCanonicalWorldHash({
        fields: createRestJobDriverHashFields(snapshot),
        randomStreams: [],
        queuedCommands: [],
      }),
    );
  });

  it("rejects rollback when the Rest origin diverges from the exact JobCore shadow", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const terminal = createRestAdoptedMutationOutput();
    fixture.rest.terminalAdoptedInto(
      restCanceledTerminal(
        fixture.token.jobId,
        fixture.token.jobGeneration,
        fixture.owner,
        fixture.adopted.jobSlotVersion,
        fixture.adopted.jobCoreVersion,
        fixture.adopted.driverVersion,
        fixture.ledger.version,
        102,
      ),
      fixture.ledger,
      fixture.core,
      terminal,
    );
    expect(terminal.ok).toBe(true);
    const next = adoptNextRestGeneration(fixture, 200, 201);
    const adoptedSnapshot = fixture.rest.createSnapshot();
    const adoptedRow = adoptedSnapshot.rows[next.token.jobId];
    const emptyOrigin = createRestJobDriverStore(8).createSnapshot().rows[0]?.origin;
    if (adoptedRow === undefined || emptyOrigin === undefined) {
      throw new Error("missing Rest origin fixture");
    }
    const corruptions = [
      { ...adoptedRow.origin, recoveryProgressQ16: adoptedRow.origin.recoveryProgressQ16 + 1 },
      emptyOrigin,
    ];
    for (const origin of corruptions) {
      const rows = [...adoptedSnapshot.rows];
      rows[next.token.jobId] = { ...adoptedRow, origin };
      expect(fixture.rest.restoreFromSnapshot({ ...adoptedSnapshot, rows })).toMatchObject({
        ok: true,
      });
      const before = { rest: fixture.rest.createSnapshot(), core: fixture.core.createSnapshot() };
      const output = restDriverOutput();
      fixture.rest.rollbackNewlyAdoptedInto(
        restRollbackControl(next.control, next.input, next.adopted),
        fixture.core,
        output,
      );
      expect(output.ok).toBe(false);
      expect({
        rest: fixture.rest.createSnapshot(),
        core: fixture.core.createSnapshot(),
      }).toStrictEqual(before);
      expect(fixture.rest.restoreFromSnapshot(adoptedSnapshot)).toMatchObject({ ok: true });
    }
  });

  it("rejects rollback when any complete JobCore terminal shadow basis is forged", () => {
    const fixture = createAdoptedRestLifecycleFixture();
    const terminal = createRestAdoptedMutationOutput();
    fixture.rest.terminalAdoptedInto(
      restCanceledTerminal(
        fixture.token.jobId,
        fixture.token.jobGeneration,
        fixture.owner,
        fixture.adopted.jobSlotVersion,
        fixture.adopted.jobCoreVersion,
        fixture.adopted.driverVersion,
        fixture.ledger.version,
        102,
      ),
      fixture.ledger,
      fixture.core,
      terminal,
    );
    expect(terminal.ok).toBe(true);
    const next = adoptNextRestGeneration(fixture, 200, 201);
    expect(next.adopted.ok).toBe(true);
    const coreSnapshot = fixture.core.createSnapshot();
    const slot = coreSnapshot.slots[next.token.jobId];
    if (slot === undefined) throw new Error("missing JobCore origin slot");
    const corruptions = [
      { ...slot, originStepTickCount: slot.originStepTickCount + 1 },
      { ...slot, originAdoptionReservationVersion: slot.originAdoptionReservationVersion + 1 },
      { ...slot, originAdoptionDriverVersion: slot.originAdoptionDriverVersion + 1 },
      { ...slot, originAdoptionSlotVersion: slot.originAdoptionSlotVersion + 1 },
    ];
    for (const corrupted of corruptions) {
      const slots = [...coreSnapshot.slots];
      slots[next.token.jobId] = corrupted;
      const forgedCore = createJobCoreStore({
        capacity: 8,
        ownerCapacity: 16,
        autonomyJobStart: 4,
      });
      expect(
        forgedCore.restoreFromSnapshot({ ...coreSnapshot, slots }, fixture.registry),
      ).toMatchObject({ ok: true });
      const before = { rest: fixture.rest.createSnapshot(), core: forgedCore.createSnapshot() };
      const output = restDriverOutput();
      fixture.rest.rollbackNewlyAdoptedInto(
        restRollbackControl(next.control, next.input, next.adopted),
        forgedCore,
        output,
      );
      expect(output.ok).toBe(false);
      expect({
        rest: fixture.rest.createSnapshot(),
        core: forgedCore.createSnapshot(),
      }).toStrictEqual(before);
    }
  });

  it("adopts exact fixture claims with checked recovery work and guarded rollback", () => {
    const owner = { index: 1, generation: 2 };
    const target = { index: 6, generation: 3 };
    const core = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
    const token = restTokenOutput();
    core.reserveAutonomyJobTokenInto(core.version, owner, token);
    const ids = new Uint32Array(8);
    ids.fill(RESERVATION_CLAIM_NONE);
    ids[0] = 2;
    ids[1] = 3;
    const epochs = new Uint32Array(8);
    epochs[0] = 7;
    epochs[1] = 7;
    const claims = restClaims(owner, target, token.jobId, token.jobGeneration);
    const control = {
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      ownerIndex: owner.index,
      ownerGeneration: owner.generation,
      expectedJobSlotVersion: token.slotVersion,
      expectedJobCoreVersion: core.version,
      expectedDriverVersion: 0,
      claimCount: 2,
      claimIds: ids,
      claimEpochs: epochs,
      claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
      claimCreatedTick: 0x1_0000_0001,
      adoptionTick: 0x1_0000_0002,
      reservationReadVersion: 7,
    };
    const rest = createRestJobDriverStore(8);
    const adopted = restDriverOutput();
    const adoptionInput: RestClaimAdoptionInput = {
      jobId: token.jobId,
      owner,
      actorId: owner.index,
      fixtureId: 5,
      restKind: "sleep",
      recoveryTargetValue: 800,
      recoveryPerTickQ16: 65_536,
      createdTick: control.claimCreatedTick,
      interruptionPolicy: "at_safe_point",
      fixtureEntity: target,
      targetCellIndex: 20,
      interactionSpotId: 4,
      scheduleWindow: "night",
      environmentVersion: 3,
      needOwnerVersion: 4,
      currentRestValue: 790,
      readClaimIds: ids,
      readClaimEpochs: epochs,
      claims,
    };
    rest.adoptExistingClaimsInto(control, adoptionInput, core, adopted);
    expect(adopted).toMatchObject({ ok: true, jobGeneration: 1, jobSlotVersion: 2 });
    expect(M3_REST_SLEEP_STORE_VERSION).toBe(2);
    const read = createRestAdoptedJobIntoOutput();
    const claimIds = read.claimIds;
    const claimEpochs = read.claimEpochs;
    rest.readAdoptedJobInto(
      token.jobId,
      token.jobGeneration,
      owner.index,
      owner.generation,
      adopted.jobSlotVersion,
      adopted.driverVersion,
      read,
    );
    expect(read).toMatchObject({
      ok: true,
      active: true,
      jobId: token.jobId,
      ownerIndex: owner.index,
      ownerGeneration: owner.generation,
      fixtureId: 5,
      step: "pathing_to_fixture",
      createdTick: control.claimCreatedTick,
      stepEnteredTick: control.adoptionTick,
      lastEffectTick: control.adoptionTick,
      effectPhase: 0,
      cleanupPending: 0,
      returnedOnce: 0,
      pathingCount: 1,
    });
    expect(Array.from(read.claimIds)).toEqual([
      2,
      3,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
      RESERVATION_CLAIM_NONE,
    ]);
    expect(Array.from(read.claimEpochs)).toEqual([7, 7, 0, 0, 0, 0, 0, 0]);
    rest.readAdoptedJobInto(
      token.jobId,
      token.jobGeneration,
      owner.index + 1,
      owner.generation,
      adopted.jobSlotVersion,
      adopted.driverVersion,
      read,
    );
    expect(read).toMatchObject({ ok: false, active: false, jobId: RESERVATION_CLAIM_NONE });
    expect(read.claimIds).toBe(claimIds);
    expect(read.claimEpochs).toBe(claimEpochs);
    const beforeInvalidRestore = rest.createSnapshot();
    expect(rest.restoreFromSnapshot({ ...beforeInvalidRestore, snapshotVersion: 1 })).toMatchObject(
      {
        ok: false,
      },
    );
    expect(rest.createSnapshot()).toStrictEqual(beforeInvalidRestore);
    const rolled = restDriverOutput();
    rest.rollbackNewlyAdoptedInto(
      restRollbackControl(control, adoptionInput, adopted),
      core,
      rolled,
    );
    expect(rolled).toMatchObject({ ok: true, jobSlotVersion: 4, activeCount: 0 });
    expect(claims.version).toBe(7);
  });
  it("preflights every Rest adoption fact before mutating JobCore or driver", () => {
    const cases: readonly ((fixture: RestAdoptionFixture) => RestClaimAdoptionInput)[] = [
      (fixture): RestClaimAdoptionInput => ({
        ...fixture.input,
        actorId: fixture.input.actorId + 1,
      }),
      invalidRestKindInput,
      invalidRestScheduleInput,
      invalidRestPolicyInput,
      (fixture): RestClaimAdoptionInput => ({ ...fixture.input, recoveryPerTickQ16: 0 }),
      (fixture): RestClaimAdoptionInput => {
        fixture.claims.channelCodes[1] = RESERVATION_ENTITY;
        return fixture.input;
      },
      (fixture): RestClaimAdoptionInput => {
        fixture.control.claimIds[7] = 9;
        return fixture.input;
      },
    ];
    for (const mutate of cases) {
      const fixture = createRestAdoptionFixture();
      const input = mutate(fixture);
      const beforeCore = fixture.core.createSnapshot();
      const beforeRest = fixture.rest.createSnapshot();
      fixture.rest.adoptExistingClaimsInto(fixture.control, input, fixture.core, fixture.output);
      expect(fixture.output.ok).toBe(false);
      expect(fixture.core.createSnapshot()).toStrictEqual(beforeCore);
      expect(fixture.rest.createSnapshot()).toStrictEqual(beforeRest);
    }
    const outOfBounds = createRestAdoptionFixture(4);
    const beforeCore = outOfBounds.core.createSnapshot();
    const beforeRest = outOfBounds.rest.createSnapshot();
    outOfBounds.rest.adoptExistingClaimsInto(
      outOfBounds.control,
      outOfBounds.input,
      outOfBounds.core,
      outOfBounds.output,
    );
    expect(outOfBounds.output.ok).toBe(false);
    expect(outOfBounds.core.createSnapshot()).toStrictEqual(beforeCore);
    expect(outOfBounds.rest.createSnapshot()).toStrictEqual(beforeRest);
  });
  it("rejects forged rollback bases without changing the adopted Core or Rest row", () => {
    const cases: readonly ((
      base: RestNewlyAdoptedRollbackControl,
    ) => RestNewlyAdoptedRollbackControl)[] = [
      (base): RestNewlyAdoptedRollbackControl => ({ ...base, expectedDriverVersion: 1 }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedJobSlotVersion: base.expectedJobSlotVersion + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({ ...base, claimCount: 1 }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        adoptionTick: base.adoptionTick + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedActorId: base.expectedActorId + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedFixtureId: base.expectedFixtureId + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({ ...base, expectedRestKind: "rest" }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedTargetCellIndex: base.expectedTargetCellIndex + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedInteractionSpotId: base.expectedInteractionSpotId + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedScheduleWindow: "dawn",
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedEnvironmentVersion: base.expectedEnvironmentVersion + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedNeedOwnerVersion: base.expectedNeedOwnerVersion + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedRecoveryTargetValue: base.expectedRecoveryTargetValue + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedRecoveryPerTickQ16: base.expectedRecoveryPerTickQ16 + 1,
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedInterruptionPolicy: "immediate",
      }),
      (base): RestNewlyAdoptedRollbackControl => ({
        ...base,
        expectedRequiredWorkQ16: base.expectedRequiredWorkQ16 + 1,
      }),
    ];
    for (const buildControl of cases) {
      const fixture = createRestAdoptionFixture();
      fixture.rest.adoptExistingClaimsInto(
        fixture.control,
        fixture.input,
        fixture.core,
        fixture.output,
      );
      expect(fixture.output.ok).toBe(true);
      const rollback = buildControl(
        restRollbackControl(fixture.control, fixture.input, fixture.output),
      );
      const beforeCore = fixture.core.createSnapshot();
      const beforeRest = fixture.rest.createSnapshot();
      const output = restDriverOutput();
      fixture.rest.rollbackNewlyAdoptedInto(rollback, fixture.core, output);
      expect(output.ok).toBe(false);
      expect(fixture.core.createSnapshot()).toStrictEqual(beforeCore);
      expect(fixture.rest.createSnapshot()).toStrictEqual(beforeRest);
    }
  });
  it("reads fixture rows into one reusable flat output without materializing entities", () => {
    const fixture = createFixture(16, 2);
    registerFixture(fixture, 0, {
      kind: "bedroll",
      restKind: "sleep",
      regionId: 1,
      targetCellIndex: 9,
      interactionSpotId: 7,
      scheduleWindow: "night",
      weatherExposure: "outdoor",
      permissionId: 1,
      recoveryPerTickQ16: 5 << 16,
      baseScoreMilli: 12_345,
    });
    const legacy = fixture.rest.readFixture(0) ?? failMissingFixture();
    const output = createRestFixtureIntoOutput();
    const identity = output;
    const legacyRead = vi.spyOn(fixture.rest, "readFixture").mockImplementation(() => {
      throw new Error("materializing readFixture called");
    });
    const legacyEntityRead = vi.spyOn(fixture.rest, "readFixtureEntity").mockImplementation(() => {
      throw new Error("materializing readFixtureEntity called");
    });

    fixture.rest.readFixtureInto(0, output);
    expect(output).toEqual({
      ok: true,
      reason: undefined,
      fixtureId: legacy.fixtureId,
      active: true,
      entityIndex: legacy.entity.index,
      entityGeneration: legacy.entity.generation,
      kind: legacy.kind,
      restKind: legacy.restKind,
      regionId: legacy.regionId,
      targetCellIndex: legacy.targetCellIndex,
      interactionSpotId: legacy.interactionSpotId,
      scheduleWindow: legacy.scheduleWindow,
      weatherExposure: legacy.weatherExposure,
      permissionId: legacy.permissionId,
      recoveryPerTickQ16: legacy.recoveryPerTickQ16,
      baseScoreMilli: legacy.baseScoreMilli,
      ownerVersion: legacy.ownerVersion,
      storeVersion: fixture.rest.version,
    });
    expect(output).toBe(identity);
    expect(legacyRead).not.toHaveBeenCalled();
    expect(legacyEntityRead).not.toHaveBeenCalled();

    fixture.rest.readFixtureInto(1, output);
    expect(output).toEqual({
      ok: false,
      reason: "rest.fixture_not_active",
      fixtureId: 1,
      active: false,
      entityIndex: 0,
      entityGeneration: 0,
      kind: undefined,
      restKind: undefined,
      regionId: 0,
      targetCellIndex: 0,
      interactionSpotId: 0,
      scheduleWindow: undefined,
      weatherExposure: undefined,
      permissionId: 0,
      recoveryPerTickQ16: 0,
      baseScoreMilli: 0,
      ownerVersion: 0,
      storeVersion: 1,
    });
    expect(output).toBe(identity);

    fixture.rest.readFixtureInto(-1, output);
    expect(output).toEqual({
      ok: false,
      reason: "rest.fixture_id_out_of_range",
      fixtureId: -1,
      active: false,
      entityIndex: 0,
      entityGeneration: 0,
      kind: undefined,
      restKind: undefined,
      regionId: 0,
      targetCellIndex: 0,
      interactionSpotId: 0,
      scheduleWindow: undefined,
      weatherExposure: undefined,
      permissionId: 0,
      recoveryPerTickQ16: 0,
      baseScoreMilli: 0,
      ownerVersion: 0,
      storeVersion: 1,
    });
    expect(output).toBe(identity);
    expect(legacyRead).not.toHaveBeenCalled();
    expect(legacyEntityRead).not.toHaveBeenCalled();
  });

  it("selects caller-owned rest candidates with coherent row and environment bases", () => {
    const fixture = createFixture(16, 3);
    registerFixture(fixture, 0, {
      kind: "bedroll",
      restKind: "sleep",
      regionId: 1,
      targetCellIndex: 9,
      interactionSpotId: 20,
      scheduleWindow: "night",
      weatherExposure: "outdoor",
      permissionId: 1,
      recoveryPerTickQ16: 5 << 16,
      baseScoreMilli: 900,
    });
    registerFixture(fixture, 1, {
      kind: "clinic_mat",
      restKind: "sleep",
      regionId: 1,
      targetCellIndex: 1,
      interactionSpotId: 21,
      scheduleWindow: "night",
      weatherExposure: "outdoor",
      permissionId: 1,
      recoveryPerTickQ16: 6 << 16,
      baseScoreMilli: 900,
    });
    registerFixture(fixture, 2, {
      kind: "bedroll",
      restKind: "sleep",
      regionId: 1,
      targetCellIndex: 7,
      interactionSpotId: 22,
      scheduleWindow: "night",
      weatherExposure: "outdoor",
      permissionId: 1,
      recoveryPerTickQ16: 7 << 16,
      baseScoreMilli: 1_000,
    });
    fixture.index.rebuildFromStore(fixture.rest);
    const query = createRestCandidateQuery({
      regionId: 1,
      restKind: "sleep",
      scheduleWindow: "night",
      weatherExposure: "outdoor",
      permissionId: 1,
    });
    const environment = createRestEnvironmentBasis({
      scheduleWindow: "night",
      scheduleWindowVersion: 11,
      weatherExposure: "outdoor",
      outdoorWorkAllowed: true,
      weatherVersion: 12,
      weatherSourceVersion: 13,
    });
    const legacyIds = new Uint32Array(M3_REST_DEFAULT_SELECTED_CAP);
    const legacy = fixture.index.selectCandidates(query, legacyIds);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy rest selection failure: ${legacy.reason}`);
    }
    const scratch = createRestSelectionScratch();
    const output = createRestSelectionOutput();
    const outputIdentity = output;
    const scratchIdentity = scratch;
    const fixtureReadIdentity = scratch.fixtureReadOutput;

    fixture.index.selectCandidatesInto(query, environment, fixture.rest, scratch, output);
    const first = fixture.rest.readFixture(2) ?? failMissingFixture();
    expect(output).toEqual({
      ok: true,
      reason: legacy.reason,
      queryRegionId: query.regionId,
      queryRestKind: query.restKind,
      queryScheduleWindow: query.scheduleWindow,
      queryWeatherExposure: query.weatherExposure,
      queryPermissionId: query.permissionId,
      candidateCap: query.candidateCap,
      maxSelectedFixtures: query.maxSelectedFixtures,
      environmentScheduleWindow: environment.scheduleWindow,
      scheduleWindowVersion: environment.scheduleWindowVersion,
      environmentWeatherExposure: environment.weatherExposure,
      outdoorWorkAllowed: environment.outdoorWorkAllowed,
      weatherVersion: environment.weatherVersion,
      weatherSourceVersion: environment.weatherSourceVersion,
      candidateTotal: legacy.candidateTotal,
      visitedCount: legacy.visitedCount,
      selectedCount: legacy.selectedCount,
      candidateCapHit: legacy.candidateCapHit,
      selectedCapHit: legacy.selectedCapHit,
      selectedFixtureId: first.fixtureId,
      selectedEntityIndex: first.entity.index,
      selectedEntityGeneration: first.entity.generation,
      selectedFixtureKind: first.kind,
      selectedRestKind: first.restKind,
      selectedRegionId: first.regionId,
      selectedTargetCellIndex: first.targetCellIndex,
      selectedInteractionSpotId: first.interactionSpotId,
      selectedScheduleWindow: first.scheduleWindow,
      selectedWeatherExposure: first.weatherExposure,
      selectedPermissionId: first.permissionId,
      selectedRecoveryPerTickQ16: first.recoveryPerTickQ16,
      selectedScoreMilli: first.baseScoreMilli,
      selectedCachedFixtureVersion: first.ownerVersion,
      selectedCurrentFixtureOwnerVersion: first.ownerVersion,
      selectedLinkedCandidate: true,
      restStoreVersion: fixture.rest.version,
      sourceVersion: legacy.sourceVersion,
      indexVersion: legacy.indexVersion,
      dirtyBacklog: 0,
    });
    expect(Array.from(legacyIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.fixtureIds.subarray(0, 3))).toEqual([2, 0, 1]);
    expect(Array.from(scratch.scoreMillis.subarray(0, 3))).toEqual([1_000, 900, 900]);
    expect(Array.from(scratch.targetCellIndexes.subarray(0, 3))).toEqual([7, 9, 1]);
    for (let index = 0; index < output.selectedCount; index += 1) {
      const fixtureId = scratch.fixtureIds[index] ?? M3_REST_FIXTURE_NONE;
      const row = fixture.rest.readFixture(fixtureId) ?? failMissingFixture();
      expectRestSelectionScratchRow(scratch, index, row);
    }
    expect(output).toBe(outputIdentity);
    expect(scratch).toBe(scratchIdentity);
    expect(scratch.fixtureReadOutput).toBe(fixtureReadIdentity);
  });

  it("honors smaller rest caps and the fixed 24/12 bounds", () => {
    const fixture = createFixture(64, 30);
    for (let fixtureId = 0; fixtureId < 30; fixtureId += 1) {
      registerFixture(fixture, fixtureId, { baseScoreMilli: 10_000 - fixtureId });
    }
    fixture.index.rebuildFromStore(fixture.rest);
    const environment = createRestEnvironmentBasis();
    const scratch = createRestSelectionScratch();
    const output = createRestSelectionOutput();
    const fullQuery = createRestCandidateQuery();

    fixture.index.selectCandidatesInto(fullQuery, environment, fixture.rest, scratch, output);
    expect(output).toMatchObject({
      ok: true,
      reason: "trace.candidate_cap_reached",
      candidateTotal: 30,
      visitedCount: 24,
      selectedCount: 12,
      candidateCapHit: true,
      selectedCapHit: true,
      selectedFixtureId: 0,
      dirtyBacklog: 0,
    });
    expect(Array.from(scratch.fixtureIds)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const smallQuery = createRestCandidateQuery({ candidateCap: 3, maxSelectedFixtures: 2 });
    const legacyIds = new Uint32Array(M3_REST_DEFAULT_SELECTED_CAP);
    const legacy = fixture.index.selectCandidates(smallQuery, legacyIds);
    if (!legacy.ok) {
      throw new Error(`unexpected legacy rest selection failure: ${legacy.reason}`);
    }
    fixture.index.selectCandidatesInto(smallQuery, environment, fixture.rest, scratch, output);
    expect(output).toMatchObject({
      ok: true,
      reason: legacy.reason,
      candidateTotal: legacy.candidateTotal,
      visitedCount: legacy.visitedCount,
      selectedCount: legacy.selectedCount,
      candidateCapHit: legacy.candidateCapHit,
      selectedCapHit: legacy.selectedCapHit,
      candidateCap: 3,
      maxSelectedFixtures: 2,
    });
    expect(Array.from(scratch.fixtureIds.subarray(0, 4))).toEqual([
      legacyIds[0],
      legacyIds[1],
      M3_REST_FIXTURE_NONE,
      M3_REST_FIXTURE_NONE,
    ]);
    expect(scratch.scoreMillis[2]).toBe(0);
    expect(scratch.cachedFixtureVersions[11]).toBe(0);
  });

  it("rejects invalid rest inputs and every undersized aligned lane before traversal", () => {
    const fixture = createFixture(16, 1);
    registerFixture(fixture, 0, {});
    fixture.index.rebuildFromStore(fixture.rest);
    const metricsBefore = fixture.index.createMetrics(fixture.rest);
    const environment = createRestEnvironmentBasis();
    const invalidQueries = [
      createRestCandidateQuery({ candidateCap: 0 }),
      createRestCandidateQuery({ candidateCap: 25 }),
      createRestCandidateQuery({ maxSelectedFixtures: 0 }),
      createRestCandidateQuery({ maxSelectedFixtures: 13 }),
    ];
    for (const query of invalidQueries) {
      const scratch = createRestSelectionScratch();
      const output = createRestSelectionOutput();
      fixture.index.selectCandidatesInto(query, environment, fixture.rest, scratch, output);
      expect(output).toEqual(
        createRestSelectionResetOutput(query, environment, fixture, "rest.fixture_input_invalid"),
      );
      expectRestSelectionScratchReset(scratch, fixture.rest.version);
    }
    for (const lane of REST_SELECTION_SCRATCH_LANES) {
      const query = createRestCandidateQuery();
      const scratch = createRestSelectionScratch(lane);
      const output = createRestSelectionOutput();
      fixture.index.selectCandidatesInto(query, environment, fixture.rest, scratch, output);
      expect(output).toEqual(
        createRestSelectionResetOutput(query, environment, fixture, "rest.fixture_input_invalid"),
      );
      expectRestSelectionScratchReset(scratch, fixture.rest.version);
    }
    expect(fixture.index.createMetrics(fixture.rest)).toEqual(metricsBefore);
  });

  it("rejects mismatched schedule/weather bases and a dirty rest index", () => {
    const fixture = createFixture(16, 1);
    registerFixture(fixture, 0, { weatherExposure: "outdoor" });
    fixture.index.rebuildFromStore(fixture.rest);
    const query = createRestCandidateQuery({ weatherExposure: "outdoor" });
    const cases = [
      {
        environment: createRestEnvironmentBasis({ scheduleWindow: "night" }),
        reason: "rest.rejected_schedule_window" as const,
      },
      {
        environment: createRestEnvironmentBasis({ weatherExposure: "indoor" }),
        reason: "rest.rejected_weather_exposure" as const,
      },
      {
        environment: createRestEnvironmentBasis({
          weatherExposure: "outdoor",
          outdoorWorkAllowed: false,
        }),
        reason: "rest.rejected_weather_exposure" as const,
      },
    ];
    for (const item of cases) {
      const scratch = createRestSelectionScratch();
      const output = createRestSelectionOutput();
      fixture.index.selectCandidatesInto(query, item.environment, fixture.rest, scratch, output);
      expect(output).toEqual(
        createRestSelectionResetOutput(query, item.environment, fixture, item.reason),
      );
      expectRestSelectionScratchReset(scratch, fixture.rest.version);
    }

    const versionBeforeDirty = fixture.index.createMetrics(fixture.rest).version;
    expect(fixture.index.markFixtureDirty(0)).toEqual({
      ok: true,
      id: 0,
      version: versionBeforeDirty,
    });
    const environment = createRestEnvironmentBasis({
      weatherExposure: "outdoor",
      outdoorWorkAllowed: true,
    });
    const scratch = createRestSelectionScratch();
    const output = createRestSelectionOutput();
    fixture.index.selectCandidatesInto(query, environment, fixture.rest, scratch, output);
    expect(output).toEqual(
      createRestSelectionResetOutput(query, environment, fixture, "rest.fixture_input_invalid", 1),
    );
    expectRestSelectionScratchReset(scratch, fixture.rest.version);
    expect(fixture.index.createMetrics(fixture.rest)).toMatchObject({
      version: versionBeforeDirty,
      dirtyBacklog: 1,
      selectionCount: 0,
      candidateVisitedCount: 0,
    });
  });

  it("fails closed when any explicit environment owner version changes mid-selection", () => {
    const versionFields = [
      "scheduleWindowVersion",
      "weatherVersion",
      "weatherSourceVersion",
    ] as const;

    for (const versionField of versionFields) {
      const fixture = createFixture(16, 1);
      registerFixture(fixture, 0, {});
      fixture.index.rebuildFromStore(fixture.rest);
      const query = createRestCandidateQuery();
      const environment = { ...createRestEnvironmentBasis() };
      const scratch = createRestSelectionScratch();
      const output = createRestSelectionOutput();
      const originalRead = fixture.rest.readFixtureInto.bind(fixture.rest);
      let versionAdvanced = false;
      const readSpy = vi
        .spyOn(fixture.rest, "readFixtureInto")
        .mockImplementation((fixtureId, readOutput) => {
          originalRead(fixtureId, readOutput);
          if (fixtureId === 0 && !versionAdvanced) {
            environment[versionField] += 1;
            versionAdvanced = true;
          }
        });

      fixture.index.selectCandidatesInto(query, environment, fixture.rest, scratch, output);
      readSpy.mockRestore();
      expect(versionAdvanced).toBe(true);
      expect(output).toEqual(
        createRestSelectionResetOutput(query, environment, fixture, "rest.fixture_input_invalid"),
      );
      expectRestSelectionScratchReset(scratch, fixture.rest.version);
      expect(fixture.index.createMetrics(fixture.rest)).toMatchObject({
        selectionCount: 0,
        candidateVisitedCount: 0,
      });
    }
  });

  it("rejects a missed dirty fixture after another refresh catches sourceVersion up", () => {
    const fixture = createFixture(16, 2);
    registerFixture(fixture, 0, { baseScoreMilli: 1_000, targetCellIndex: 3 });
    registerFixture(fixture, 1, { baseScoreMilli: 900, targetCellIndex: 4 });
    fixture.index.rebuildFromStore(fixture.rest);
    const cachedA = fixture.rest.readFixture(0)?.ownerVersion ?? 0;
    expect(fixture.rest.removeFixture(0)).toMatchObject({ ok: true });
    registerFixture(fixture, 0, { baseScoreMilli: 1_100, targetCellIndex: 5 });
    const currentA = fixture.rest.readFixture(0)?.ownerVersion ?? 0;
    expect(currentA).toBeGreaterThan(cachedA);
    expect(fixture.index.markFixtureDirty(1)).toMatchObject({ ok: true });
    expect(fixture.index.refreshDirty(fixture.rest, 1)).toMatchObject({ ok: true, id: 1 });
    expect(fixture.index.createMetrics(fixture.rest)).toMatchObject({
      dirtyBacklog: 0,
      version: 2,
    });

    const query = createRestCandidateQuery();
    const environment = createRestEnvironmentBasis();
    const scratch = createRestSelectionScratch();
    const output = createRestSelectionOutput();
    fixture.index.selectCandidatesInto(query, environment, fixture.rest, scratch, output);
    expect(output).toEqual(
      createRestSelectionResetOutput(query, environment, fixture, "rest.fixture_input_invalid"),
    );
    expect(output.sourceVersion).toBe(fixture.rest.version);
    expect(output.dirtyBacklog).toBe(0);
    expectRestSelectionScratchReset(scratch, fixture.rest.version);
  });

  it("selects tired actors through bounded indexed candidates and Top-K exact paths", () => {
    const fixture = createFixture(64, 40);
    const traces = createRestSleepTraceStore(8);
    const output = new Uint32Array(12);
    const pathScratch: PathCandidate[] = [];

    for (let fixtureId = 0; fixtureId < 30; fixtureId += 1) {
      registerFixture(fixture, fixtureId, {
        restKind: "rest",
        scheduleWindow: "dawn",
        targetCellIndex: fixtureId + 1,
        baseScoreMilli: 10_000 - fixtureId,
      });
    }
    fixture.index.rebuildFromStore(fixture.rest);

    const result = selectPathResolvedRestFixture({
      actorId: 0,
      originCellIndex: 0,
      regionId: 0,
      restKind: "rest",
      permissionId: 0,
      issuedTick: 0,
      requestSequenceStart: 100,
      needStore: fixture.needs,
      environment: fixture.environment.createProjection(0),
      restStore: fixture.rest,
      restIndex: fixture.index,
      pathfinder: fixture.pathfinder,
      grid: fixture.grid,
      pathBasis: fixture.pathBasis,
      outputFixtureIds: output,
      pathCandidateScratch: pathScratch,
      traceStore: traces,
      candidateCap: 24,
      maxSelectedFixtures: 12,
      maxExactPaths: 4,
    });

    expect(result).toMatchObject({
      ok: true,
      actorId: 0,
      fixtureId: 0,
      candidateTotal: 30,
      visitedCount: 24,
      selectedCount: 12,
      exactPathCount: 4,
      candidateCapHit: true,
      exactPathCapHit: true,
      reason: "rest.selected_indexed_path",
    });
    expect([...output]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(traces.readNewest(0)).toMatchObject({
      reason: "trace.candidate_cap_reached",
      candidateTotal: 30,
      visitedCount: 24,
      selectedCount: 12,
      exactPathCount: 4,
      fixtureId: 0,
    });
  });

  it("emits structured reasons for schedule weather ability emergency and path failures", () => {
    const fixture = createFixture(16, 8);
    const output = new Uint32Array(4);
    const pathScratch: PathCandidate[] = [];

    registerFixture(fixture, 0, {
      restKind: "rest",
      scheduleWindow: "daytime",
      targetCellIndex: 2,
    });
    fixture.index.rebuildFromStore(fixture.rest);

    expect(selectForTest(fixture, output, pathScratch)).toMatchObject({
      ok: false,
      reason: "rest.rejected_schedule_window",
    });

    registerFixture(fixture, 1, {
      restKind: "rest",
      scheduleWindow: "dawn",
      weatherExposure: "outdoor",
      targetCellIndex: 3,
    });
    fixture.index.rebuildFromStore(fixture.rest);
    expect(selectForTest(fixture, output, pathScratch)).toMatchObject({
      ok: false,
      reason: "rest.rejected_weather_exposure",
    });

    expect(selectForTest(fixture, output, pathScratch, { actorCanRest: false })).toMatchObject({
      ok: false,
      reason: "rest.rejected_ability",
    });

    expect(
      fixture.needs.setLane(
        {
          actorId: 0,
          lane: 0,
          tick: 1,
          reason: "need.manual_set",
        },
        100,
      ),
    ).toMatchObject({ ok: true });
    expect(selectForTest(fixture, output, pathScratch)).toMatchObject({
      ok: false,
      reason: "rest.rejected_emergency_need",
    });

    expect(
      fixture.needs.setLane(
        {
          actorId: 0,
          lane: 0,
          tick: 2,
          reason: "need.manual_set",
        },
        500,
      ),
    ).toMatchObject({ ok: true });
    registerFixture(fixture, 2, {
      restKind: "rest",
      scheduleWindow: "dawn",
      targetCellIndex: 4,
      baseScoreMilli: 20_000,
    });
    expect(fixture.grid.updateCellByIndex(4, { terrain: MAP_TERRAIN_BLOCKED })).toMatchObject({
      ok: true,
    });
    fixture.pathBasis = createBasis(fixture.grid);
    fixture.index.rebuildFromStore(fixture.rest);

    expect(selectForTest(fixture, output, pathScratch)).toMatchObject({
      ok: false,
      reason: "path.no_route_to_rest_fixture",
      exactPathCount: 1,
    });
  });
});

function restDriverOutput(): RestClaimAdoptionOutput {
  return {
    ok: false,
    reason: undefined,
    jobId: RESERVATION_CLAIM_NONE,
    jobGeneration: 0,
    jobSlotVersion: 0,
    jobCoreVersion: 0,
    driverVersion: 0,
    activeCount: 0,
    ownerIndex: RESERVATION_CLAIM_NONE,
    ownerGeneration: 0,
    jobCoreReservedCount: 0,
    jobCoreActiveCount: 0,
    jobCoreRunningCount: 0,
    jobCoreCurrentTombstoneCount: 0,
    jobCoreCumulativeTerminalCount: 0,
    driverPathingCount: 0,
    driverRecoveringCount: 0,
    driverCompletedCount: 0,
    driverCanceledCount: 0,
    driverFailedCount: 0,
    driverInterruptedCount: 0,
    reservationAttemptCount: 0,
    reservationFailureCount: 0,
    cleanupReleaseCount: 0,
    cumulativeCompletedCount: 0,
    cumulativeCanceledCount: 0,
    cumulativeFailedCount: 0,
    cumulativeInterruptedCount: 0,
  };
}
function restTokenOutput(): JobTokenIntoOutput {
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
function restClaims(
  owner: EntityId,
  target: EntityId,
  jobId: number,
  generation: number,
): ReservationClaimsIntoOutput {
  const c = {
    ok: true,
    reason: undefined,
    claimIndex: RESERVATION_CLAIM_NONE,
    claimId: RESERVATION_CLAIM_NONE,
    claimCount: 2,
    version: 7,
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
  c.channelCodes[0] = RESERVATION_ENTITY;
  c.channelCodes[1] = RESERVATION_INTERACTION_SPOT;
  c.ownerIndexes.fill(RESERVATION_CLAIM_NONE);
  c.jobIds.fill(RESERVATION_CLAIM_NONE);
  c.targetIndexes.fill(RESERVATION_CLAIM_NONE);
  c.cellIndexes.fill(RESERVATION_CLAIM_NONE);
  c.slotIds.fill(RESERVATION_CLAIM_NONE);
  for (let i = 0; i < 2; i += 1) {
    c.ownerIndexes[i] = owner.index;
    c.ownerGenerations[i] = owner.generation;
    c.jobIds[i] = jobId;
    c.jobGenerations[i] = generation;
    c.hasTargetFlags[i] = 1;
    c.targetIndexes[i] = target.index;
    c.targetGenerations[i] = target.generation;
    c.allocationEpochs[i] = 7;
    c.createdTicks[i] = 0x1_0000_0001;
    c.leaseExpiryTicks[i] = 0x1_0000_0100;
  }
  c.slotIds[1] = 4;
  return c;
}

interface RestAdoptionFixture {
  readonly core: ReturnType<typeof createJobCoreStore>;
  readonly rest: ReturnType<typeof createRestJobDriverStore>;
  readonly control: ExistingClaimsAdoptionControl;
  readonly input: RestClaimAdoptionInput;
  readonly claims: ReservationClaimsIntoOutput;
  readonly output: RestClaimAdoptionOutput;
}

function invalidRestKindInput(fixture: RestAdoptionFixture): RestClaimAdoptionInput {
  const input: RestClaimAdoptionInput = { ...fixture.input };
  Reflect.set(input, "restKind", "invalid");
  return input;
}

function invalidRestScheduleInput(fixture: RestAdoptionFixture): RestClaimAdoptionInput {
  const input: RestClaimAdoptionInput = { ...fixture.input };
  Reflect.set(input, "scheduleWindow", "invalid");
  return input;
}

function invalidRestPolicyInput(fixture: RestAdoptionFixture): RestClaimAdoptionInput {
  const input: RestClaimAdoptionInput = { ...fixture.input };
  Reflect.set(input, "interruptionPolicy", "invalid");
  return input;
}

function createRestAdoptionFixture(restCapacity = 8): RestAdoptionFixture {
  const owner = { index: 1, generation: 2 };
  const target = { index: 6, generation: 3 };
  const core = createJobCoreStore({ capacity: 8, ownerCapacity: 4, autonomyJobStart: 4 });
  const token = restTokenOutput();
  core.reserveAutonomyJobTokenInto(core.version, owner, token);
  const ids = new Uint32Array(8);
  ids.fill(RESERVATION_CLAIM_NONE);
  ids[0] = 2;
  ids[1] = 3;
  const epochs = new Uint32Array(8);
  epochs[0] = 7;
  epochs[1] = 7;
  const claims = restClaims(owner, target, token.jobId, token.jobGeneration);
  const control: ExistingClaimsAdoptionControl = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: owner.index,
    ownerGeneration: owner.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: core.version,
    expectedDriverVersion: 0,
    claimCount: 2,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: 0x1_0000_0001,
    adoptionTick: 0x1_0000_0002,
    reservationReadVersion: 7,
  };
  const input: RestClaimAdoptionInput = {
    jobId: token.jobId,
    owner,
    actorId: owner.index,
    fixtureId: 5,
    restKind: "sleep",
    recoveryTargetValue: 800,
    recoveryPerTickQ16: 65_536,
    createdTick: control.claimCreatedTick,
    fixtureEntity: target,
    targetCellIndex: 20,
    interactionSpotId: 4,
    scheduleWindow: "night",
    environmentVersion: 3,
    needOwnerVersion: 4,
    currentRestValue: 790,
    readClaimIds: ids,
    readClaimEpochs: epochs,
    claims,
  };
  return {
    core,
    rest: createRestJobDriverStore(restCapacity),
    control,
    input,
    claims,
    output: restDriverOutput(),
  };
}

interface AdoptedRestLifecycleFixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly owner: EntityId;
  readonly fixtureEntity: EntityId;
  readonly core: ReturnType<typeof createJobCoreStore>;
  readonly token: JobTokenIntoOutput;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly ids: Uint32Array;
  readonly epochs: Uint32Array;
  readonly claims: ReservationClaimsIntoOutput;
  readonly control: ExistingClaimsAdoptionControl;
  readonly rest: ReturnType<typeof createRestJobDriverStore>;
  readonly adopted: RestClaimAdoptionOutput;
  readonly needs: ReturnType<typeof createNeedStore>;
}

interface AdoptedRestGeneration {
  readonly token: JobTokenIntoOutput;
  readonly control: ExistingClaimsAdoptionControl;
  readonly input: RestClaimAdoptionInput;
  readonly adopted: RestClaimAdoptionOutput;
}

type LegacyRestMutationResult = ReturnType<
  ReturnType<typeof createRestJobDriverStore>["beginRecovery"]
>;

function createAdoptedRestLifecycleFixture(): AdoptedRestLifecycleFixture {
  const registry = createEntityRegistry({ capacity: 16 });
  const owner = allocate(registry);
  const fixtureEntity = allocate(registry);
  const core = createJobCoreStore({ capacity: 8, ownerCapacity: 16, autonomyJobStart: 4 });
  const token = restTokenOutput();
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
        { channel: "entity", target: fixtureEntity },
        { channel: "interaction_spot", target: fixtureEntity, spotId: 4 },
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
  const claims = restClaims(owner, fixtureEntity, token.jobId, token.jobGeneration);
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
  const control: ExistingClaimsAdoptionControl = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: owner.index,
    ownerGeneration: owner.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: core.version,
    expectedDriverVersion: 0,
    claimCount: 2,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: 100,
    adoptionTick: 101,
    reservationReadVersion: acquired.version,
  };
  const rest = createRestJobDriverStore(8);
  const adopted = restDriverOutput();
  rest.adoptExistingClaimsInto(
    control,
    {
      jobId: token.jobId,
      owner,
      actorId: owner.index,
      fixtureId: 5,
      restKind: "sleep",
      recoveryTargetValue: 791,
      recoveryPerTickQ16: 65_536,
      createdTick: 100,
      fixtureEntity,
      targetCellIndex: 20,
      interactionSpotId: 4,
      scheduleWindow: "night",
      interruptionPolicy: "at_safe_point",
      environmentVersion: 3,
      needOwnerVersion: 1,
      currentRestValue: 790,
      readClaimIds: ids,
      readClaimEpochs: epochs,
      claims,
    },
    core,
    adopted,
  );
  expect(adopted).toMatchObject({ ok: true, jobGeneration: token.jobGeneration });
  const needs = createNeedStore({ actorCapacity: 16, updateIntervalTicks: 8 });
  expect(
    needs.registerActor({
      actorId: owner.index,
      hunger: 300,
      rest: 790,
      comfort: 600,
      social: 600,
      safety: 700,
      sourceTick: 0,
    }),
  ).toMatchObject({ ok: true });
  return {
    registry,
    owner,
    fixtureEntity,
    core,
    token,
    ledger,
    ids,
    epochs,
    claims,
    control,
    rest,
    adopted,
    needs,
  };
}

function adoptNextRestGeneration(
  fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>,
  createdTick: number,
  adoptionTick: number,
): AdoptedRestGeneration {
  const token = restTokenOutput();
  fixture.core.reserveAutonomyJobTokenInto(fixture.core.version, fixture.owner, token);
  if (!token.ok) throw new Error(token.reason);
  const acquired = fixture.ledger.acquire(
    {
      owner: fixture.owner,
      jobId: token.jobId,
      jobGeneration: token.jobGeneration,
      createdTick,
      leaseExpiryTick: createdTick + 200,
      claims: [
        { channel: "entity", target: fixture.fixtureEntity },
        { channel: "interaction_spot", target: fixture.fixtureEntity, spotId: 4 },
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
  const claims = restClaims(fixture.owner, fixture.fixtureEntity, token.jobId, token.jobGeneration);
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
  if (!claims.ok) throw new Error(claims.reason);
  const control: ExistingClaimsAdoptionControl = {
    jobId: token.jobId,
    jobGeneration: token.jobGeneration,
    ownerIndex: fixture.owner.index,
    ownerGeneration: fixture.owner.generation,
    expectedJobSlotVersion: token.slotVersion,
    expectedJobCoreVersion: fixture.core.version,
    expectedDriverVersion: fixture.rest.createSnapshot().storeVersion,
    claimCount: 2,
    claimIds: ids,
    claimEpochs: epochs,
    claimLeaseExpiryTicks: new Float64Array(claims.leaseExpiryTicks),
    claimCreatedTick: createdTick,
    adoptionTick,
    reservationReadVersion: acquired.version,
  };
  const adopted = restDriverOutput();
  const input: RestClaimAdoptionInput = {
    jobId: token.jobId,
    owner: fixture.owner,
    actorId: fixture.owner.index,
    fixtureId: 5,
    restKind: "sleep",
    recoveryTargetValue: 791,
    recoveryPerTickQ16: 65_536,
    createdTick,
    interruptionPolicy: "at_safe_point",
    fixtureEntity: fixture.fixtureEntity,
    targetCellIndex: 20,
    interactionSpotId: 4,
    scheduleWindow: "night",
    environmentVersion: 3,
    needOwnerVersion: 1,
    currentRestValue: 790,
    readClaimIds: ids,
    readClaimEpochs: epochs,
    claims,
  };
  fixture.rest.adoptExistingClaimsInto(control, input, fixture.core, adopted);
  return { token, control, input, adopted };
}

function restCanceledTerminal(
  jobId: number,
  jobGeneration: number,
  owner: EntityId,
  expectedJobSlotVersion: number,
  expectedJobCoreVersion: number,
  expectedDriverVersion: number,
  expectedCurrentLedgerVersion: number,
  tick: number,
): RestAdoptedTerminalInput {
  return {
    jobId,
    jobGeneration,
    owner,
    expectedJobSlotVersion,
    expectedJobCoreVersion,
    expectedDriverVersion,
    expectedCurrentLedgerVersion,
    tick,
    outcome: "canceled",
    failureReason: "cancelled",
    terminalReason: "rest.cancelled",
  };
}

function restRollbackControl(
  control: ExistingClaimsAdoptionControl,
  input: RestClaimAdoptionInput,
  adopted: RestClaimAdoptionOutput,
): RestNewlyAdoptedRollbackControl {
  return {
    ...control,
    expectedAdoptedJobSlotVersion: adopted.jobSlotVersion,
    expectedAdoptedDriverVersion: adopted.driverVersion,
    expectedActorId: input.actorId,
    expectedFixtureId: input.fixtureId,
    expectedRestKind: input.restKind,
    expectedTargetCellIndex: input.targetCellIndex,
    expectedInteractionSpotId: input.interactionSpotId,
    expectedScheduleWindow: input.scheduleWindow,
    expectedEnvironmentVersion: input.environmentVersion,
    expectedNeedOwnerVersion: input.needOwnerVersion,
    expectedRecoveryTargetValue: input.recoveryTargetValue,
    expectedRecoveryPerTickQ16: input.recoveryPerTickQ16,
    expectedInterruptionPolicy:
      input.interruptionPolicy ?? (input.restKind === "sleep" ? "emergency_only" : "at_safe_point"),
    expectedRequiredWorkQ16: (input.recoveryTargetValue - input.currentRestValue) * 65_536,
  };
}

function restNeedBasis(fixture: ReturnType<typeof createAdoptedRestLifecycleFixture>): {
  readonly version: number;
  readonly laneVersion: number;
  readonly value: number;
} {
  return {
    version: fixture.needs.version,
    laneVersion: fixture.needs.readLaneOwnerVersion(fixture.owner.index, NEED_LANE_REST),
    value: fixture.needs.readLaneValue(fixture.owner.index, NEED_LANE_REST),
  };
}

describe("M3 rest and sleep explicit job drivers", () => {
  it("recovers rest with Q16 progress and releases reservations on completion", () => {
    const fixture = createFixture(16, 4);
    registerFixture(fixture, 0, {
      restKind: "rest",
      scheduleWindow: "dawn",
      targetCellIndex: 2,
      recoveryPerTickQ16: 10 << 16,
    });
    fixture.index.rebuildFromStore(fixture.rest);

    expect(createRestJob(fixture, 0, 0, "rest", 260, 10 << 16)).toMatchObject({ ok: true });
    expect(
      fixture.jobs.reserveFixture(
        0,
        1,
        301,
        fixture.rest,
        fixture.registry,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);
    expect(fixture.jobs.beginRecovery(0, 2, fixture.jobCore)).toMatchObject({ ok: true });

    expect(
      fixture.jobs.tickRecovery(0, 3, fixture.needs, fixture.jobCore, fixture.ledger),
    ).toMatchObject({ ok: true });
    expect(fixture.needs.readLaneValue(0, NEED_LANE_REST)).toBe(250);
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);

    expect(
      fixture.jobs.tickRecovery(0, 4, fixture.needs, fixture.jobCore, fixture.ledger),
    ).toMatchObject({ ok: true });
    expect(fixture.needs.readLaneValue(0, NEED_LANE_REST)).toBe(260);
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.jobs.readJob(0)).toMatchObject({
      step: "complete",
      terminalReason: "rest.completed",
      fixtureClaimId: M3_REST_FIXTURE_NONE,
      interactionClaimId: M3_REST_FIXTURE_NONE,
    });
    expect(fixture.jobCore.readJob(0)).toMatchObject({
      status: "completed",
      carriedAmount: 0,
    });
    expect(fixture.jobs.createMetrics()).toMatchObject({
      completedJobCount: 1,
      cleanupReleaseCount: 2,
    });
  });

  it("keeps driver state serializable and restores deterministic snapshots", () => {
    const fixture = createFixture(16, 4);
    registerFixture(fixture, 0, {
      restKind: "sleep",
      scheduleWindow: "dawn",
      targetCellIndex: 2,
      recoveryPerTickQ16: 5 << 16,
    });

    expect(createRestJob(fixture, 0, 0, "sleep", 270, 5 << 16)).toMatchObject({ ok: true });
    expect(
      fixture.jobs.reserveFixture(
        0,
        1,
        301,
        fixture.rest,
        fixture.registry,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(fixture.jobs.beginRecovery(0, 2, fixture.jobCore)).toMatchObject({ ok: true });
    expect(
      fixture.jobs.tickRecovery(0, 3, fixture.needs, fixture.jobCore, fixture.ledger),
    ).toMatchObject({ ok: true });

    const snapshot = fixture.jobs.createSnapshot();
    expect(snapshot.rows[0]).toMatchObject({
      claimEpochs: [1, 1],
      claimCreatedTicks: [1, 1],
      claimLeaseExpiryTicks: [301, 301],
    });
    const restored = createRestJobDriverStore(4);
    expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    expect(restored.readJob(0)).toMatchObject({
      step: "sleeping",
      restKind: "sleep",
      recoveryProgressQ16: 5 << 16,
      fixtureClaimId: 0,
      interactionClaimId: 1,
    });
  });

  it("releases reservations on cancellation failure and allowed interruption paths", () => {
    const fixture = createFixture(16, 4);
    registerFixture(fixture, 0, { restKind: "rest", scheduleWindow: "dawn", targetCellIndex: 2 });
    registerFixture(fixture, 1, { restKind: "sleep", scheduleWindow: "dawn", targetCellIndex: 3 });

    expect(createRestJob(fixture, 0, 0, "rest", 280, 10 << 16)).toMatchObject({ ok: true });
    expect(
      fixture.jobs.reserveFixture(
        0,
        1,
        301,
        fixture.rest,
        fixture.registry,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.jobs.fail(0, 2, "path.no_route_to_rest_fixture", fixture.ledger, fixture.jobCore),
    ).toMatchObject({ ok: true });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.jobs.readJob(0)).toMatchObject({
      step: "failed",
      terminalReason: "path.no_route_to_rest_fixture",
    });

    expect(createRestJob(fixture, 1, 1, "sleep", 280, 10 << 16)).toMatchObject({ ok: true });
    expect(
      fixture.jobs.reserveFixture(
        1,
        3,
        303,
        fixture.rest,
        fixture.registry,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(fixture.jobs.beginRecovery(1, 4, fixture.jobCore)).toMatchObject({ ok: true });
    const deniedSnapshot = fixture.jobs.createSnapshot();
    const deniedJobCore = fixture.jobCore.readJob(1);
    expect(fixture.jobs.interrupt(1, "safe_point", 5, fixture.ledger, fixture.jobCore)).toEqual({
      ok: false,
      reason: "job.interruption_denied",
    });
    expect(fixture.jobs.createSnapshot()).toStrictEqual(deniedSnapshot);
    expect(fixture.jobCore.readJob(1)).toStrictEqual(deniedJobCore);
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);

    expect(
      fixture.jobs.interrupt(1, "emergency", 6, fixture.ledger, fixture.jobCore),
    ).toMatchObject({
      ok: true,
    });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
    expect(fixture.jobs.readJob(1)).toMatchObject({
      step: "cancelled",
      terminalReason: "job.interrupted_safe_point",
    });
    expect(fixture.jobCore.readJob(1)).toMatchObject({ status: "canceled" });
  });

  it("rejects cross-outcome legacy terminals and adopted-only basis residue atomically", () => {
    const canceledFixture = createFixture(16, 4);
    registerFixture(canceledFixture, 0, {
      restKind: "rest",
      scheduleWindow: "dawn",
      targetCellIndex: 2,
    });
    expect(createRestJob(canceledFixture, 0, 0, "rest", 280, 10 << 16)).toMatchObject({
      ok: true,
    });
    expect(
      canceledFixture.jobs.reserveFixture(
        0,
        1,
        301,
        canceledFixture.rest,
        canceledFixture.registry,
        canceledFixture.ledger,
        canceledFixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      canceledFixture.jobs.cancel(0, 2, canceledFixture.ledger, canceledFixture.jobCore),
    ).toMatchObject({ ok: true });

    const interruptedFixture = createFixture(16, 4);
    registerFixture(interruptedFixture, 0, {
      restKind: "rest",
      scheduleWindow: "dawn",
      targetCellIndex: 2,
    });
    expect(createRestJob(interruptedFixture, 0, 0, "rest", 280, 10 << 16)).toMatchObject({
      ok: true,
    });
    expect(
      interruptedFixture.jobs.reserveFixture(
        0,
        1,
        301,
        interruptedFixture.rest,
        interruptedFixture.registry,
        interruptedFixture.ledger,
        interruptedFixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(interruptedFixture.jobs.beginRecovery(0, 2, interruptedFixture.jobCore)).toMatchObject({
      ok: true,
    });
    expect(
      interruptedFixture.jobs.interrupt(
        0,
        "emergency",
        3,
        interruptedFixture.ledger,
        interruptedFixture.jobCore,
      ),
    ).toMatchObject({ ok: true });

    const adoptedOnlyBasis = [
      "jobCoreStepTickCount",
      "jobCoreAdoptionReservationVersion",
      "jobCoreAdoptionDriverVersion",
      "jobCoreAdoptionSlotVersion",
    ] as const;
    const cases = [
      {
        snapshot: canceledFixture.jobs.createSnapshot(),
        oppositeOutcome: 4,
        oppositeReason: 11,
      },
      {
        snapshot: interruptedFixture.jobs.createSnapshot(),
        oppositeOutcome: 2,
        oppositeReason: 26,
      },
    ] as const;
    for (const entry of cases) {
      const row = entry.snapshot.rows[0];
      if (row === undefined) throw new Error("missing legacy terminal Rest row");
      const corruptions: (typeof row)[] = [
        { ...row, terminalOutcome: entry.oppositeOutcome },
        { ...row, terminalReasonCode: entry.oppositeReason },
      ];
      for (const field of adoptedOnlyBasis) corruptions.push({ ...row, [field]: 1 });
      for (const corrupted of corruptions) {
        const probe = createRestJobDriverStore(4);
        const before = probe.createSnapshot();
        const beforeHash = formatCanonicalWorldHash({
          fields: createRestJobDriverHashFields(before),
          randomStreams: [],
          queuedCommands: [],
        });
        const rows = [...entry.snapshot.rows];
        rows[0] = corrupted;
        expect(probe.restoreFromSnapshot({ ...entry.snapshot, rows })).toMatchObject({ ok: false });
        expect(probe.createSnapshot()).toStrictEqual(before);
        expect(
          formatCanonicalWorldHash({
            fields: createRestJobDriverHashFields(probe.createSnapshot()),
            randomStreams: [],
            queuedCommands: [],
          }),
        ).toBe(beforeHash);
      }
    }
  });

  it("prevents duplicate fixture reservations without leaking claims", () => {
    const fixture = createFixture(16, 4);
    registerFixture(fixture, 0, { restKind: "rest", scheduleWindow: "dawn", targetCellIndex: 2 });

    expect(createRestJob(fixture, 0, 0, "rest", 280, 10 << 16)).toMatchObject({ ok: true });
    expect(createRestJob(fixture, 1, 0, "rest", 280, 10 << 16)).toMatchObject({ ok: true });
    expect(
      fixture.jobs.reserveFixture(
        0,
        1,
        301,
        fixture.rest,
        fixture.registry,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });

    expect(
      fixture.jobs.reserveFixture(
        1,
        2,
        302,
        fixture.rest,
        fixture.registry,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: false, reason: "reservation_entity_conflict" });
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);

    expect(fixture.jobs.cancel(0, 3, fixture.ledger, fixture.jobCore)).toMatchObject({ ok: true });
    expect(fixture.ledger.createMetrics().activeCount).toBe(0);
  });

  it("round-trips reservation-specific structured reasons through traces and snapshots", () => {
    const fixture = createFixture(16, 4);
    const traces = createRestSleepTraceStore(4);
    registerFixture(fixture, 0, { restKind: "rest", scheduleWindow: "dawn", targetCellIndex: 2 });

    expect(createRestJob(fixture, 0, 0, "rest", 280, 10 << 16)).toMatchObject({ ok: true });
    expect(
      fixture.jobs.fail(0, 1, "reservation_entity_conflict", fixture.ledger, fixture.jobCore),
    ).toMatchObject({ ok: true });

    traces.record({
      tick: 1,
      actorId: 0,
      fixtureId: 0,
      candidateTotal: 1,
      visitedCount: 1,
      selectedCount: 1,
      candidateCap: 24,
      selectedCap: 12,
      exactPathCount: 0,
      exactPathCap: 4,
      nodeExpansions: 0,
      sourceRestVersion: fixture.rest.version,
      environmentVersion: 1,
      reservationVersion: fixture.ledger.version,
      reason: "reservation_entity_conflict",
    });

    const snapshot = fixture.jobs.createSnapshot();
    const restored = createRestJobDriverStore(4);
    expect(restored.restoreFromSnapshot(snapshot)).toMatchObject({ ok: true });
    expect(restored.readJob(0)).toMatchObject({
      step: "failed",
      terminalReason: "reservation_entity_conflict",
    });
    expect(restored.createSnapshot()).toStrictEqual(snapshot);
    expect(traces.readNewest(0)).toMatchObject({ reason: "reservation_entity_conflict" });
  });

  it("does not advance progress when rest need ownership rejects recovery", () => {
    const fixture = createFixture(16, 4);
    registerFixture(fixture, 0, { restKind: "rest", scheduleWindow: "dawn", targetCellIndex: 2 });

    expect(
      fixture.jobs.createJob(
        {
          jobId: 0,
          owner: fixture.actor,
          actorId: 3,
          fixtureId: 0,
          restKind: "rest",
          recoveryTargetValue: 40,
          recoveryPerTickQ16: 10 << 16,
          createdTick: 0,
        },
        fixture.rest,
        fixture.environment.createProjection(0),
        fixture.needs,
        fixture.registry,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.jobs.reserveFixture(
        0,
        1,
        301,
        fixture.rest,
        fixture.registry,
        fixture.ledger,
        fixture.jobCore,
      ),
    ).toMatchObject({ ok: true });
    expect(fixture.jobs.beginRecovery(0, 2, fixture.jobCore)).toMatchObject({ ok: true });

    const beforeDriver = fixture.jobs.createSnapshot();
    const beforeCore = fixture.jobCore.readJob(0);
    expect(
      fixture.jobs.tickRecovery(0, 3, fixture.needs, fixture.jobCore, fixture.ledger),
    ).toStrictEqual({ ok: false, reason: "rest.need_update_failed" });

    expect(fixture.jobs.createSnapshot()).toStrictEqual(beforeDriver);
    expect(fixture.jobCore.readJob(0)).toStrictEqual(beforeCore);
    expect(fixture.ledger.createMetrics().activeCount).toBe(2);
  });
});

interface Fixture {
  readonly registry: ReturnType<typeof createEntityRegistry>;
  readonly actor: EntityId;
  readonly fixtureEntities: readonly EntityId[];
  readonly needs: ReturnType<typeof createNeedStore>;
  readonly rest: ReturnType<typeof createRestSleepStore>;
  readonly index: ReturnType<typeof createRestCandidateIndex>;
  readonly jobs: ReturnType<typeof createRestJobDriverStore>;
  readonly jobCore: ReturnType<typeof createJobCoreStore>;
  readonly ledger: ReturnType<typeof createReservationLedger>;
  readonly environment: ReturnType<typeof createM3EnvironmentStore>;
  readonly grid: ReturnType<typeof createMapGrid>;
  readonly pathfinder: ReturnType<typeof createGridPathfinder>;
  pathBasis: PathVersionBasis;
}

type RestFixtureIntoOutputForTest = Parameters<Fixture["rest"]["readFixtureInto"]>[1];
type RestCandidateQueryForTest = Parameters<Fixture["index"]["selectCandidatesInto"]>[0];
type RestEnvironmentBasisForTest = Parameters<Fixture["index"]["selectCandidatesInto"]>[1];
type RestSelectionScratchForTest = Parameters<Fixture["index"]["selectCandidatesInto"]>[3];
type RestSelectionOutputForTest = Parameters<Fixture["index"]["selectCandidatesInto"]>[4];
type RestSelectionScratchLane = Exclude<keyof RestSelectionScratchForTest, "fixtureReadOutput">;
type RestFixtureViewForTest = NonNullable<ReturnType<Fixture["rest"]["readFixture"]>>;

function copyWithReplacement<T>(rows: readonly T[], index: number, replacement: T): T[] {
  const copy: T[] = [];
  for (const row of rows) copy.push(row);
  copy[index] = replacement;
  return copy;
}

const REST_SELECTION_SCRATCH_LANES: readonly RestSelectionScratchLane[] = [
  "fixtureIds",
  "entityIndexes",
  "entityGenerations",
  "fixtureKindCodes",
  "restKindCodes",
  "regionIds",
  "targetCellIndexes",
  "interactionSpotIds",
  "scheduleCodes",
  "weatherCodes",
  "permissionIds",
  "recoveryPerTickQ16s",
  "scoreMillis",
  "cachedFixtureVersions",
  "currentFixtureOwnerVersions",
  "linkedCandidateFlags",
];

function createRestFixtureIntoOutput(): RestFixtureIntoOutputForTest {
  return {
    ok: true,
    reason: "rest.fixture_input_invalid",
    fixtureId: 99,
    active: true,
    entityIndex: 99,
    entityGeneration: 99,
    kind: "clinic_mat",
    restKind: "rest",
    regionId: 99,
    targetCellIndex: 99,
    interactionSpotId: 99,
    scheduleWindow: "dawn",
    weatherExposure: "indoor",
    permissionId: 99,
    recoveryPerTickQ16: 99,
    baseScoreMilli: 99,
    ownerVersion: 99,
    storeVersion: 99,
  };
}

function createRestCandidateQuery(
  overrides: Partial<RestCandidateQueryForTest> = {},
): RestCandidateQueryForTest {
  return {
    regionId: 0,
    restKind: "rest",
    scheduleWindow: "dawn",
    weatherExposure: "indoor",
    permissionId: 0,
    candidateCap: M3_REST_DEFAULT_CANDIDATE_CAP,
    maxSelectedFixtures: M3_REST_DEFAULT_SELECTED_CAP,
    ...overrides,
  };
}

function createRestEnvironmentBasis(
  overrides: Partial<RestEnvironmentBasisForTest> = {},
): RestEnvironmentBasisForTest {
  return {
    scheduleWindow: "dawn",
    scheduleWindowVersion: 7,
    weatherExposure: "indoor",
    outdoorWorkAllowed: false,
    weatherVersion: 8,
    weatherSourceVersion: 9,
    ...overrides,
  };
}

function createRestSelectionScratch(
  undersizedLane?: RestSelectionScratchLane,
): RestSelectionScratchForTest {
  return {
    fixtureReadOutput: createRestFixtureIntoOutput(),
    fixtureIds: createPoisonedRestUint32Lane("fixtureIds", undersizedLane),
    entityIndexes: createPoisonedRestUint32Lane("entityIndexes", undersizedLane),
    entityGenerations: createPoisonedRestUint32Lane("entityGenerations", undersizedLane),
    fixtureKindCodes: createPoisonedRestUint8Lane("fixtureKindCodes", undersizedLane),
    restKindCodes: createPoisonedRestUint8Lane("restKindCodes", undersizedLane),
    regionIds: createPoisonedRestUint32Lane("regionIds", undersizedLane),
    targetCellIndexes: createPoisonedRestUint32Lane("targetCellIndexes", undersizedLane),
    interactionSpotIds: createPoisonedRestUint32Lane("interactionSpotIds", undersizedLane),
    scheduleCodes: createPoisonedRestUint8Lane("scheduleCodes", undersizedLane),
    weatherCodes: createPoisonedRestUint8Lane("weatherCodes", undersizedLane),
    permissionIds: createPoisonedRestUint32Lane("permissionIds", undersizedLane),
    recoveryPerTickQ16s: createPoisonedRestUint32Lane("recoveryPerTickQ16s", undersizedLane),
    scoreMillis: createPoisonedRestUint32Lane("scoreMillis", undersizedLane),
    cachedFixtureVersions: createPoisonedRestUint32Lane("cachedFixtureVersions", undersizedLane),
    currentFixtureOwnerVersions: createPoisonedRestUint32Lane(
      "currentFixtureOwnerVersions",
      undersizedLane,
    ),
    linkedCandidateFlags: createPoisonedRestUint8Lane("linkedCandidateFlags", undersizedLane),
  };
}

function createPoisonedRestUint32Lane(
  lane: RestSelectionScratchLane,
  undersizedLane: RestSelectionScratchLane | undefined,
): Uint32Array {
  const capacity = lane === undersizedLane ? M3_REST_DEFAULT_SELECTED_CAP - 1 : 12;
  return new Uint32Array(capacity).fill(99);
}

function createPoisonedRestUint8Lane(
  lane: RestSelectionScratchLane,
  undersizedLane: RestSelectionScratchLane | undefined,
): Uint8Array {
  const capacity = lane === undersizedLane ? M3_REST_DEFAULT_SELECTED_CAP - 1 : 12;
  return new Uint8Array(capacity).fill(1);
}

function createRestSelectionOutput(): RestSelectionOutputForTest {
  return {
    ok: true,
    reason: "rest.fixture_input_invalid",
    queryRegionId: 99,
    queryRestKind: "sleep",
    queryScheduleWindow: "night",
    queryWeatherExposure: "outdoor",
    queryPermissionId: 99,
    candidateCap: 99,
    maxSelectedFixtures: 99,
    environmentScheduleWindow: "night",
    scheduleWindowVersion: 99,
    environmentWeatherExposure: "outdoor",
    outdoorWorkAllowed: true,
    weatherVersion: 99,
    weatherSourceVersion: 99,
    candidateTotal: 99,
    visitedCount: 99,
    selectedCount: 99,
    candidateCapHit: true,
    selectedCapHit: true,
    selectedFixtureId: 99,
    selectedEntityIndex: 99,
    selectedEntityGeneration: 99,
    selectedFixtureKind: "bedroll",
    selectedRestKind: "sleep",
    selectedRegionId: 99,
    selectedTargetCellIndex: 99,
    selectedInteractionSpotId: 99,
    selectedScheduleWindow: "night",
    selectedWeatherExposure: "outdoor",
    selectedPermissionId: 99,
    selectedRecoveryPerTickQ16: 99,
    selectedScoreMilli: 99,
    selectedCachedFixtureVersion: 99,
    selectedCurrentFixtureOwnerVersion: 99,
    selectedLinkedCandidate: true,
    restStoreVersion: 99,
    sourceVersion: 99,
    indexVersion: 99,
    dirtyBacklog: 99,
  };
}

function createRestSelectionResetOutput(
  query: RestCandidateQueryForTest,
  environment: RestEnvironmentBasisForTest,
  fixture: Fixture,
  reason: RestSelectionOutputForTest["reason"],
  dirtyBacklog = fixture.index.createMetrics(fixture.rest).dirtyBacklog,
): RestSelectionOutputForTest {
  return {
    ok: false,
    reason,
    queryRegionId: query.regionId,
    queryRestKind: query.restKind,
    queryScheduleWindow: query.scheduleWindow,
    queryWeatherExposure: query.weatherExposure,
    queryPermissionId: query.permissionId,
    candidateCap: query.candidateCap,
    maxSelectedFixtures: query.maxSelectedFixtures,
    environmentScheduleWindow: environment.scheduleWindow,
    scheduleWindowVersion: environment.scheduleWindowVersion,
    environmentWeatherExposure: environment.weatherExposure,
    outdoorWorkAllowed: environment.outdoorWorkAllowed,
    weatherVersion: environment.weatherVersion,
    weatherSourceVersion: environment.weatherSourceVersion,
    candidateTotal: 0,
    visitedCount: 0,
    selectedCount: 0,
    candidateCapHit: false,
    selectedCapHit: false,
    selectedFixtureId: M3_REST_FIXTURE_NONE,
    selectedEntityIndex: 0,
    selectedEntityGeneration: 0,
    selectedFixtureKind: undefined,
    selectedRestKind: undefined,
    selectedRegionId: 0,
    selectedTargetCellIndex: 0,
    selectedInteractionSpotId: 0,
    selectedScheduleWindow: undefined,
    selectedWeatherExposure: undefined,
    selectedPermissionId: 0,
    selectedRecoveryPerTickQ16: 0,
    selectedScoreMilli: 0,
    selectedCachedFixtureVersion: 0,
    selectedCurrentFixtureOwnerVersion: 0,
    selectedLinkedCandidate: false,
    restStoreVersion: fixture.rest.version,
    sourceVersion: fixture.rest.version,
    indexVersion: fixture.index.createMetrics(fixture.rest).version,
    dirtyBacklog,
  };
}

function expectRestSelectionScratchReset(
  scratch: RestSelectionScratchForTest,
  storeVersion: number,
): void {
  for (const laneName of REST_SELECTION_SCRATCH_LANES) {
    const lane = scratch[laneName];
    const expected = laneName === "fixtureIds" ? M3_REST_FIXTURE_NONE : 0;
    for (const value of lane) {
      expect(value).toBe(expected);
    }
  }
  expect(scratch.fixtureReadOutput).toEqual(
    createRestFixtureResetOutput(M3_REST_FIXTURE_NONE, storeVersion),
  );
}

function createRestFixtureResetOutput(
  fixtureId: number,
  storeVersion: number,
): RestFixtureIntoOutputForTest {
  return {
    ok: false,
    reason: "rest.fixture_id_out_of_range",
    fixtureId,
    active: false,
    entityIndex: 0,
    entityGeneration: 0,
    kind: undefined,
    restKind: undefined,
    regionId: 0,
    targetCellIndex: 0,
    interactionSpotId: 0,
    scheduleWindow: undefined,
    weatherExposure: undefined,
    permissionId: 0,
    recoveryPerTickQ16: 0,
    baseScoreMilli: 0,
    ownerVersion: 0,
    storeVersion,
  };
}

function expectRestSelectionScratchRow(
  scratch: RestSelectionScratchForTest,
  index: number,
  fixture: RestFixtureViewForTest,
): void {
  expect(scratch.fixtureIds[index]).toBe(fixture.fixtureId);
  expect(scratch.entityIndexes[index]).toBe(fixture.entity.index);
  expect(scratch.entityGenerations[index]).toBe(fixture.entity.generation);
  expect(scratch.fixtureKindCodes[index]).toBe(fixture.kind === "bedroll" ? 1 : 0);
  expect(scratch.restKindCodes[index]).toBe(fixture.restKind === "sleep" ? 1 : 0);
  expect(scratch.regionIds[index]).toBe(fixture.regionId);
  expect(scratch.targetCellIndexes[index]).toBe(fixture.targetCellIndex);
  expect(scratch.interactionSpotIds[index]).toBe(fixture.interactionSpotId);
  expect(scratch.scheduleCodes[index]).toBe(restScheduleCode(fixture.scheduleWindow));
  expect(scratch.weatherCodes[index]).toBe(fixture.weatherExposure === "outdoor" ? 1 : 0);
  expect(scratch.permissionIds[index]).toBe(fixture.permissionId);
  expect(scratch.recoveryPerTickQ16s[index]).toBe(fixture.recoveryPerTickQ16);
  expect(scratch.scoreMillis[index]).toBe(fixture.baseScoreMilli);
  expect(scratch.cachedFixtureVersions[index]).toBe(fixture.ownerVersion);
  expect(scratch.currentFixtureOwnerVersions[index]).toBe(fixture.ownerVersion);
  expect(scratch.linkedCandidateFlags[index]).toBe(1);
}

function restScheduleCode(window: RestFixtureViewForTest["scheduleWindow"]): number {
  if (window === "daytime") return 1;
  if (window === "evening") return 2;
  if (window === "night") return 3;
  return 0;
}

function createFixture(entityCapacity: number, fixtureCapacity: number): Fixture {
  const registry = createEntityRegistry({ capacity: entityCapacity });
  const actor = allocate(registry);
  const fixtureEntities = allocateMany(registry, fixtureCapacity);
  const needs = createNeedStore({ actorCapacity: 4, updateIntervalTicks: 8 });
  expect(
    needs.registerActor({
      actorId: 0,
      hunger: 500,
      rest: 240,
      comfort: 650,
      social: 520,
      safety: 700,
      sourceTick: 0,
    }),
  ).toMatchObject({ ok: true });

  const environment = createM3EnvironmentStore();
  environment.advanceToTick(0, createNamedRandomStreams({ seed: "m3-rest-test" }));
  const grid = createMapGrid({ width: 8, height: 8, chunkSize: 4 });

  return {
    registry,
    actor,
    fixtureEntities,
    needs,
    rest: createRestSleepStore(fixtureCapacity, 2, 2),
    index: createRestCandidateIndex({
      fixtureCapacity,
      regionCapacity: 2,
      permissionCapacity: 2,
    }),
    jobs: createRestJobDriverStore(4),
    jobCore: createJobCoreStore({ capacity: 4 }),
    ledger: createReservationLedger({ capacity: 16, entityCapacity, cellCount: 64 }),
    environment,
    grid,
    pathfinder: createGridPathfinder(64),
    pathBasis: createBasis(grid),
  };
}

function registerFixture(
  fixture: Fixture,
  fixtureId: number,
  overrides: Partial<Parameters<Fixture["rest"]["registerFixture"]>[0]>,
): void {
  expect(
    fixture.rest.registerFixture(
      {
        fixtureId,
        entity: fixture.fixtureEntities[fixtureId] ?? failMissingEntity(),
        kind: "clinic_mat",
        restKind: "rest",
        regionId: 0,
        targetCellIndex: 2,
        interactionSpotId: fixtureId,
        scheduleWindow: "dawn",
        weatherExposure: "indoor",
        permissionId: 0,
        recoveryPerTickQ16: 10 << 16,
        baseScoreMilli: 10_000,
        ...overrides,
      },
      fixture.registry,
    ),
  ).toMatchObject({ ok: true });
}

function selectForTest(
  fixture: Fixture,
  output: Uint32Array,
  pathScratch: PathCandidate[],
  overrides: Partial<Parameters<typeof selectPathResolvedRestFixture>[0]> = {},
): ReturnType<typeof selectPathResolvedRestFixture> {
  return selectPathResolvedRestFixture({
    actorId: 0,
    originCellIndex: 0,
    regionId: 0,
    restKind: "rest",
    permissionId: 0,
    issuedTick: 0,
    requestSequenceStart: 1,
    needStore: fixture.needs,
    environment: fixture.environment.createProjection(0),
    restStore: fixture.rest,
    restIndex: fixture.index,
    pathfinder: fixture.pathfinder,
    grid: fixture.grid,
    pathBasis: fixture.pathBasis,
    outputFixtureIds: output,
    pathCandidateScratch: pathScratch,
    maxSelectedFixtures: output.length,
    maxExactPaths: 1,
    ...overrides,
  });
}

function createRestJob(
  fixture: Fixture,
  jobId: number,
  fixtureId: number,
  restKind: "rest" | "sleep",
  recoveryTargetValue: number,
  recoveryPerTickQ16: number,
): ReturnType<Fixture["jobs"]["createJob"]> {
  return fixture.jobs.createJob(
    {
      jobId,
      owner: fixture.actor,
      actorId: 0,
      fixtureId,
      restKind,
      recoveryTargetValue,
      recoveryPerTickQ16,
      createdTick: 0,
    },
    fixture.rest,
    fixture.environment.createProjection(0),
    fixture.needs,
    fixture.registry,
    fixture.jobCore,
  );
}

function createBasis(grid: ReturnType<typeof createMapGrid>): PathVersionBasis {
  return createPathVersionBasis(grid, {
    navigationVersion: grid.globalVersion,
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
  throw new Error("missing fixture entity");
}

function failMissingFixture(): never {
  throw new Error("missing rest fixture");
}
