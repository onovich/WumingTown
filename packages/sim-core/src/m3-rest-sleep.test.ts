import { describe, expect, it, vi } from "vitest";

import {
  M3_REST_DEFAULT_CANDIDATE_CAP,
  M3_REST_DEFAULT_SELECTED_CAP,
  M3_REST_FIXTURE_NONE,
  MAP_TERRAIN_BLOCKED,
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
  createRestJobDriverStore,
  createRestSleepStore,
  createRestSleepTraceStore,
  selectPathResolvedRestFixture,
  type EntityId,
  type PathCandidate,
  type PathVersionBasis,
} from "./index";

describe("M3 rest and sleep indexed selection", () => {
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
