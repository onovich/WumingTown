import { describe, expect, it, vi } from "vitest";

import {
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
