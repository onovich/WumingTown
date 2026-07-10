import { describe, expect, it } from "vitest";

import {
  GAME_SESSION_PHASE_ORDER,
  GAME_SESSION_NO_JOB,
  NEED_LANE_COMFORT,
  NEED_LANE_SOCIAL,
  PR1_INTEGRATED_GAME_SESSION_ID,
  PR1_RESOURCE_FOOD,
  PR1_RESOURCE_LAMP_OIL,
  PR1_RESOURCE_STONE,
  PR1_RESOURCE_WOOD,
  createPr1IntegratedGameSessionDefinition,
  initializeGameSessionRuntime,
  runPr1IntegratedGameSessionScenario,
  type GameSessionRuntime,
} from "./index";

describe("PR-1 authoritative GameSessionRuntime", () => {
  it("initializes the 64x64 eight-resident owner graph from one scenario definition", () => {
    const runtime = createRuntime("initializer");

    expect(runtime.definition.scenarioId).toBe(PR1_INTEGRATED_GAME_SESSION_ID);
    expect(runtime.owners.map.width).toBe(64);
    expect(runtime.owners.map.height).toBe(64);
    expect(runtime.owners.residents.activeCount).toBe(8);
    expect(runtime.owners.needs.actorCount).toBe(8);
    expect(runtime.owners.items.stackCount).toBe(4);
    expect(runtime.owners.restFixtures.activeCount).toBe(8);
    expect(runtime.owners.lamps.activeLampCount).toBe(1);
    expect(runtime.owners.buildSites.createMetrics().activeSiteCount).toBe(1);
    expect(runtime.owners.workOffers.activeOfferCount).toBe(6);
    expect(runtime.owners.entities.activeCount).toBe(26);
    expect(runtime.owners.locations.mapMembershipCount).toBe(21);
    expect(runtime.owners.locations.containerMembershipCount).toBe(4);

    for (let cellIndex = 0; cellIndex < runtime.owners.map.cellCount; cellIndex += 1) {
      expect(runtime.owners.map.isCellPassableByIndex(cellIndex)).toEqual({
        ok: true,
        passable: true,
      });
    }

    const resources = runtime.createUiProjection().resources;
    expect(resources).toEqual([
      { defId: PR1_RESOURCE_FOOD, total: 80, available: 80, reserved: 0 },
      { defId: PR1_RESOURCE_WOOD, total: 60, available: 60, reserved: 0 },
      { defId: PR1_RESOURCE_STONE, total: 50, available: 50, reserved: 0 },
      { defId: PR1_RESOURCE_LAMP_OIL, total: 40, available: 40, reserved: 0 },
    ]);
    const build = runtime.owners.buildSites.readBuildOrder(0, runtime.owners.reservations);
    expect(build).toMatchObject({
      active: true,
      completed: false,
      requiredAmountA: 20,
      requiredAmountB: 15,
      buildRequiredTicks: 300,
    });
    expect(runtime.indexBasis).toMatchObject({
      workOfferCount: 6,
      needOwnerVersion: runtime.owners.needs.version,
      restOwnerVersion: runtime.owners.restFixtures.version,
      lampOwnerVersion: runtime.owners.lamps.ownerVersion,
    });
  });

  it("applies commands in stable tick/sequence order and repeats hashes", () => {
    const first = createCommandedRuntime("deterministic");
    const second = createCommandedRuntime("deterministic");

    expect(first.advanceTicks(1_200)).toMatchObject({ advancedTicks: 1_200, finalTick: 1_200 });
    expect(second.advanceTicks(1_200)).toMatchObject({ advancedTicks: 1_200, finalTick: 1_200 });
    expect(first.readLastPhaseOrder()).toEqual(GAME_SESSION_PHASE_ORDER);
    expect(first.createWorldHash()).toBe(second.createWorldHash());
    expect(first.createReadModelHash()).toBe(second.createReadModelHash());
    expect(first.createMetrics()).toEqual(second.createMetrics());
    expect(first.createMetrics()).toMatchObject({
      appliedCommandCount: 3,
      commandQueueDepth: 0,
      phaseViolationCount: 0,
      fullWorldPawnScanCount: 0,
    });

    const reordered = createRuntime("deterministic");
    queueOrThrow(reordered, 0, "second");
    queueOrThrow(reordered, 0, "first");
    queueOrThrow(reordered, 10, "later");
    reordered.advanceTicks(1_200);
    expect(reordered.createWorldHash()).not.toBe(first.createWorldHash());
  });

  it("runs one explicit serializable job and reservation lifecycle through phases 4 and 5", () => {
    const runtime = createRuntime("job-lifecycle");
    runtime.advanceTicks(1);

    expect(runtime.owners.jobs.readJob(0)).toMatchObject({
      status: "running",
      step: "interact",
      progressQ16: 0,
      requiredWorkQ16: 131_072,
    });
    expect(runtime.owners.reservations.activeCount).toBe(1);
    expect(runtime.owners.residents.read(0)).toMatchObject({
      activity: "working",
      currentJobId: 0,
      reason: "game_session.job_working",
    });
    expect(JSON.parse(JSON.stringify(runtime.owners.jobs.createSnapshot()))).toMatchObject({
      activeCount: 1,
      records: [{ jobId: 0, status: "running", step: "interact" }],
    });
    expect(JSON.parse(JSON.stringify(runtime.owners.reservations.createSnapshot()))).toMatchObject({
      activeCount: 1,
      records: [{ jobId: 0, channel: "cell" }],
    });
    expect(runtime.createConservationReport()).toMatchObject({
      activeJobs: 1,
      activeReservations: 1,
      firstDivergence: null,
    });
    expect(runtime.createConservationReport("terminal").firstDivergence).toMatchObject({
      code: "game_session.jobs_leaked",
      actual: 1,
    });

    runtime.advanceTicks(2);
    expect(runtime.owners.jobs.readJob(0)).toMatchObject({
      status: "completed",
      step: "complete",
      progressQ16: 131_072,
    });
    expect(runtime.owners.reservations.activeCount).toBe(0);
    expect(runtime.owners.residents.read(0)).toMatchObject({
      activity: "idle",
      currentJobId: GAME_SESSION_NO_JOB,
      reason: "game_session.job_completed",
    });
    expect(runtime.createMetrics()).toMatchObject({
      activeJobCount: 0,
      activeJobPeak: 1,
      jobTerminalCount: 1,
      activeReservationCount: 0,
      activeReservationPeak: 1,
      reservationAcquiredCount: 1,
      reservationReleasedCount: 1,
    });
  });

  it("distinguishes equal-version comfort and social owner mutations in both hashes", () => {
    const comfort = createRuntime("need-collision");
    const social = createRuntime("need-collision");
    expect(
      comfort.owners.needs.applyLaneDelta(
        { actorId: 0, lane: NEED_LANE_COMFORT, tick: 0, reason: "need.manual_set" },
        -1,
      ),
    ).toMatchObject({ ok: true, changed: true });
    expect(
      social.owners.needs.applyLaneDelta(
        { actorId: 0, lane: NEED_LANE_SOCIAL, tick: 0, reason: "need.manual_set" },
        -1,
      ),
    ).toMatchObject({ ok: true, changed: true });
    expect(comfort.owners.needs.version).toBe(social.owners.needs.version);
    expectCanonicalHashesToDiffer(comfort, social);
  });

  it("distinguishes equal-version resident, resource, and location owner mutations", () => {
    const moving = createRuntime("resident-collision");
    const working = createRuntime("resident-collision");
    moving.owners.residents.setJobState(0, 7, "moving", "game_session.job_reserved");
    working.owners.residents.setJobState(0, 7, "working", "game_session.job_working");
    expect(moving.owners.residents.version).toBe(working.owners.residents.version);
    expectCanonicalHashesToDiffer(moving, working);

    const food = createRuntime("resource-collision");
    const wood = createRuntime("resource-collision");
    expect(food.owners.items.removeQuantity(0, 1, PR1_RESOURCE_FOOD).ok).toBe(true);
    expect(wood.owners.items.removeQuantity(1, 1, PR1_RESOURCE_WOOD).ok).toBe(true);
    expect(food.owners.items.version).toBe(wood.owners.items.version);
    expectCanonicalHashesToDiffer(food, wood);

    const west = createRuntime("location-collision");
    const east = createRuntime("location-collision");
    const westResident = west.owners.residents.read(0);
    const eastResident = east.owners.residents.read(0);
    if (westResident === undefined || eastResident === undefined)
      throw new Error("resident missing");
    expect(
      west.owners.locations.placeOnMap(
        westResident.entity,
        west.owners.entities,
        west.owners.map,
        10,
        10,
      ).ok,
    ).toBe(true);
    expect(
      east.owners.locations.placeOnMap(
        eastResident.entity,
        east.owners.entities,
        east.owners.map,
        11,
        10,
      ).ok,
    ).toBe(true);
    expect(west.owners.locations.version).toBe(east.owners.locations.version);
    expectCanonicalHashesToDiffer(west, east);
  });

  it("keeps a quiet fixed tick free of allocation-bearing result API calls", () => {
    const runtime = createRuntime("quiet-tick-allocation");
    runtime.advanceTicks(100);
    const before = runtime.createMetrics();
    runtime.advanceTicks(1);
    const after = runtime.createMetrics();

    expect(after.eventResultObjectCallCount).toBe(before.eventResultObjectCallCount);
    expect(after).toMatchObject({
      unconditionalResultObjectCallCount: 0,
      needScheduledUpdateCallCount: 0,
    });
  });

  it("keeps explicit pause/speed state and coherent read-only projection bases", () => {
    const runtime = createRuntime("projection");
    runtime.setRequestedSpeed(3);
    runtime.setPaused(true);
    expect(runtime.advanceTicks(60)).toMatchObject({
      advancedTicks: 0,
      finalTick: 0,
      paused: true,
    });
    runtime.setPaused(false);
    runtime.advanceTicks(60);

    const render = runtime.createRenderProjection();
    const ui = runtime.createUiProjection();
    expect(render.readOnly).toBe(true);
    expect(ui.readOnly).toBe(true);
    expect(render.entities).toHaveLength(22);
    expect(ui.residents).toHaveLength(8);
    expect(render.basis).toEqual(ui.basis);
    expect(render.basis).toMatchObject({
      tick: 60,
      snapshotSequence: 60,
      worldHash: runtime.createWorldHash(),
      readModelHash: runtime.createReadModelHash(),
    });
    expect(ui).toMatchObject({ paused: false, requestedSpeed: 3, activeJobCount: 0 });

    const previousBasisVersion = runtime.indexBasis.version;
    expect(runtime.rebuildDerivedIndexes()).toBe(true);
    expect(runtime.indexBasis.version).toBe(previousBasisVersion + 1);
    expect(runtime.owners.workOffers.activeOfferCount).toBe(6);
  });

  it("rejects invalid scenario and decreasing command order with structured reasons", () => {
    const invalid = initializeGameSessionRuntime({
      seed: "invalid",
      scenario: { ...createPr1IntegratedGameSessionDefinition(), mapWidth: 32 },
    });
    expect(invalid).toEqual({
      ok: false,
      reason: "game_session.scenario_invalid",
      stageIndex: 0,
    });

    const runtime = createRuntime("queue-validation");
    queueOrThrow(runtime, 10, "future");
    expect(runtime.queueCommand({ tick: 9, commandId: "out-of-order", kind: "noop" })).toEqual({
      ok: false,
      reason: "game_session.command_order_invalid",
    });
  });

  it("reports the first conservation divergence with structured resource diagnostics", () => {
    const runtime = createRuntime("divergence");
    const removed = runtime.owners.items.removeQuantity(0, 1, PR1_RESOURCE_FOOD);
    expect(removed.ok).toBe(true);

    expect(runtime.createConservationReport().firstDivergence).toEqual({
      code: "game_session.resource_conservation_failed",
      tick: 0,
      subjectId: PR1_RESOURCE_FOOD,
      expected: 80,
      actual: 79,
    });
  });

  it("runs 100000 ticks without job, reservation, queue, or resource leakage", () => {
    const runtime = createRuntime("long-run");
    queueOrThrow(runtime, 0, "start");
    queueOrThrow(runtime, 99_999, "finish");

    runtime.advanceTicks(100_000);
    const conservation = runtime.createConservationReport("terminal");
    const metrics = runtime.createMetrics();
    expect(runtime.tick).toBe(100_000);
    expect(conservation).toMatchObject({
      ok: true,
      activeJobs: 0,
      activeReservations: 0,
      pendingCommands: 0,
      pendingPaths: 0,
      mapDirtyBacklog: 0,
      lampDirtyBacklog: 0,
      needDirtyBacklog: 0,
      restDirtyBacklog: 0,
      storageDirtyBacklog: 0,
      environmentDirtyBacklog: 0,
      workOfferBacklog: 0,
      firstDivergence: null,
    });
    expect(conservation.resources.every((row) => row.delta === 0)).toBe(true);
    expect(metrics).toMatchObject({
      appliedCommandCount: 2,
      commandQueueDepth: 0,
      pathRequestCount: 334,
      pathAcceptedCount: 334,
      pathStaleRejectedCount: 0,
      activeJobCount: 0,
      activeJobPeak: 1,
      jobTerminalCount: 1,
      activeReservationCount: 0,
      activeReservationPeak: 1,
      reservationAcquiredCount: 1,
      reservationReleasedCount: 1,
      reservationConflictCount: 0,
      resourceConservationDelta: 0,
      projectionBacklog: 0,
      phaseViolationCount: 0,
      fullWorldPawnScanCount: 0,
      unconditionalResultObjectCallCount: 0,
      needScheduledUpdateCallCount: 0,
    });
    expect(metrics.eventResultObjectCallCount).toBeGreaterThan(0);
    expect(metrics.pathNodeExpansions).toBeGreaterThan(0);
    expect(runtime.createWorldHash()).toMatch(/^0x[0-9a-f]{8}$/u);
    expect(runtime.createReadModelHash()).toMatch(/^0x[0-9a-f]{8}$/u);
  }, 30_000);

  it("uses the same runtime surface for the headless scenario entry", () => {
    const first = runPr1IntegratedGameSessionScenario({ seed: "5", ticks: 1_800 });
    const second = runPr1IntegratedGameSessionScenario({ seed: "5", ticks: 1_800 });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      scenarioId: PR1_INTEGRATED_GAME_SESSION_ID,
      finalTick: 1_800,
      residentCount: 8,
      conservation: { ok: true },
    });
  });
});

function createCommandedRuntime(seed: string): GameSessionRuntime {
  const runtime = createRuntime(seed);
  queueOrThrow(runtime, 0, "first");
  queueOrThrow(runtime, 0, "second");
  queueOrThrow(runtime, 10, "later");
  return runtime;
}

function createRuntime(seed: string): GameSessionRuntime {
  const initialized = initializeGameSessionRuntime({ seed });
  if (!initialized.ok) {
    throw new Error(`${initialized.reason}:${String(initialized.stageIndex)}`);
  }
  return initialized.runtime;
}

function queueOrThrow(runtime: GameSessionRuntime, tick: number, commandId: string): void {
  const result = runtime.queueCommand({ tick, commandId, kind: "noop" });
  if (!result.ok) throw new Error(result.reason);
}

function expectCanonicalHashesToDiffer(
  first: GameSessionRuntime,
  second: GameSessionRuntime,
): void {
  expect(first.createWorldHash()).not.toBe(second.createWorldHash());
  expect(first.createReadModelHash()).not.toBe(second.createReadModelHash());
}
