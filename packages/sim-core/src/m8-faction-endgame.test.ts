import { describe, expect, it } from "vitest";

import {
  M8_ENDGAME_REQUIRED_EXPLANATION_MASK,
  M8_ENDGAME_ROUTE_COHABITATION_TOWN,
  M8_ENDGAME_ROUTE_COUNT,
  M8_ENDGAME_ROUTE_HUMAN_TOWN,
  M8_ENDGAME_ROUTE_MIGRATION,
  M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN,
  M8_ENDGAME_ROUTE_STATE_AVAILABLE,
  M8_ENDGAME_ROUTE_STATE_BLOCKED,
  M8_ENDGAME_ROUTE_STATE_CONTESTED,
  M8_ENDGAME_ROUTE_UNLIT_TOWN,
  M8_FACTION_ARC_STATE_NEGOTIATED,
  M8_FACTION_COUNT,
  M8_FACTION_ENDGAME_SCENARIO_ID,
  M8_FACTION_MASK_ALL,
  M8_FACTION_REGISTRY_OFFICE,
  M8_FACTION_RESOURCE_LEGAL_RECOGNITION,
  createM8FactionEndgameStore,
  runM8FactionEndgameScenario,
  type M8EndgameRouteInput,
  type M8EndgameRouteScenarioEvidence,
  type M8FactionArcInput,
} from "./index";

describe("M8 faction and endgame owner integration", () => {
  it("runs a deterministic headless scenario for all required factions and routes", () => {
    const summary = runM8FactionEndgameScenario();
    const replay = runM8FactionEndgameScenario();

    expect(summary).toMatchObject({
      version: 1,
      scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
      protectedM5BaselineTouched: false,
    });
    expect(replay).toEqual(summary);
    expect(summary.replay).toMatchObject({
      matched: true,
      firstHash: summary.scenarioHash,
      secondHash: summary.scenarioHash,
    });
    expect(summary.factionArcs).toHaveLength(M8_FACTION_COUNT);
    expect(summary.routes).toHaveLength(M8_ENDGAME_ROUTE_COUNT);
    expect(summary.metrics).toMatchObject({
      activeArcCount: 6,
      indexedArcCount: 6,
      negotiatedArcCount: 6,
      activeRoutePathCount: 5,
      indexedRoutePathCount: 5,
      availableRouteCount: 2,
      blockedRouteCount: 1,
      contestedRouteCount: 2,
      queryCapHitCount: 0,
      staleBasisRejectCount: 0,
    });
    expect(summary.performance).toMatchObject({
      factionFactVisits: 42,
      routeVisits: 5,
      arcVisits: 6,
      capHitCount: 0,
      staleRejectCount: 0,
      maxRouteCandidateCap: 1,
      maxRouteScanCap: 1,
    });
  });

  it("keeps each faction arc decomposed into owner facts instead of a mood bar", () => {
    const summary = runM8FactionEndgameScenario();

    for (const arc of summary.factionArcs) {
      expect(arc.arcState).toBe(M8_FACTION_ARC_STATE_NEGOTIATED);
      expect(arc.resourceMask).not.toBe(0);
      expect(arc.constraintMask).not.toBe(0);
      expect(arc.contradictionMask).not.toBe(0);
      expect(arc.negotiationMask).not.toBe(0);
      expect(arc.failureMask).not.toBe(0);
      expect(arc.explanationMask & M8_ENDGAME_REQUIRED_EXPLANATION_MASK).toBe(
        M8_ENDGAME_REQUIRED_EXPLANATION_MASK,
      );
      expect(arc.factionFactReason).toBe("m5_faction_query_indexed");
      expect(arc.factionFactSelectedCount).toBe(7);
      expect(arc.factionFactVisitedCount).toBe(7);
    }

    expect(summary.factionArcs[M8_FACTION_REGISTRY_OFFICE]).toMatchObject({
      resourceMask: M8_FACTION_RESOURCE_LEGAL_RECOGNITION,
    });
    expect(JSON.stringify(summary.factionArcs)).not.toMatch(/mood|attitude|ui|text|epilogue/i);
  });

  it("derives available, blocked and contested endgame route states with reasons", () => {
    const routes = runM8FactionEndgameScenario().routes;

    expect(route(routes, M8_ENDGAME_ROUTE_HUMAN_TOWN)).toMatchObject({
      routeState: M8_ENDGAME_ROUTE_STATE_AVAILABLE,
      reason: "m8_faction_endgame_route_available",
    });
    expect(route(routes, M8_ENDGAME_ROUTE_COHABITATION_TOWN)).toMatchObject({
      routeState: M8_ENDGAME_ROUTE_STATE_CONTESTED,
      reason: "m8_faction_endgame_route_contested",
    });
    expect(route(routes, M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN)).toMatchObject({
      routeState: M8_ENDGAME_ROUTE_STATE_CONTESTED,
      reason: "m8_faction_endgame_route_contested",
    });
    expect(route(routes, M8_ENDGAME_ROUTE_UNLIT_TOWN)).toMatchObject({
      routeState: M8_ENDGAME_ROUTE_STATE_BLOCKED,
      reason: "m8_faction_endgame_route_blocked_low_support",
    });
    expect(route(routes, M8_ENDGAME_ROUTE_MIGRATION)).toMatchObject({
      routeState: M8_ENDGAME_ROUTE_STATE_AVAILABLE,
      reason: "m8_faction_endgame_route_available",
    });

    for (const routeEvidence of routes) {
      expect(routeEvidence.explanationMask & M8_ENDGAME_REQUIRED_EXPLANATION_MASK).toBe(
        M8_ENDGAME_REQUIRED_EXPLANATION_MASK,
      );
    }
  });

  it("rejects stale route basis and reports cap exhaustion without scanning all routes", () => {
    const store = createM8FactionEndgameStore({ arcCapacity: 2, routePathCapacity: 2 });
    expect(store.registerFactionArc(createArc(0))).toMatchObject({
      ok: true,
      reason: "m8_faction_endgame_arc_registered",
    });
    const arcOutput = new Uint32Array([77]);
    expect(
      store.queryFactionArcs(
        { factionId: 0, expectedOwnerVersion: 0, candidateCap: 1, scanCap: 1 },
        arcOutput,
      ),
    ).toEqual({ ok: false, reason: "m8_faction_endgame_query_stale_basis" });
    expect([...arcOutput]).toEqual([77]);

    expect(store.registerFactionArc(createArc(1))).toMatchObject({ ok: true });
    const cappedOutput = new Uint32Array(1);
    expect(
      store.queryFactionArcs(
        { factionId: 0, expectedOwnerVersion: store.ownerVersion, candidateCap: 1, scanCap: 1 },
        cappedOutput,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 1,
      candidateCapHit: false,
      scanCapHit: true,
      reason: "m8_faction_endgame_query_scan_cap_reached",
    });
    expect(store.createMetrics()).toMatchObject({
      staleBasisRejectCount: 1,
      lastQueryVisits: 1,
    });
  });

  it("rejects duplicate active arc registration without resetting state or indexes", () => {
    const store = createM8FactionEndgameStore({ arcCapacity: 2, routePathCapacity: 1 });
    expect(store.registerFactionArc(createArc(0))).toMatchObject({
      ok: true,
      reason: "m8_faction_endgame_arc_registered",
    });
    expect(
      store.transitionFactionArc({
        arcId: 0,
        expectedOwnerVersion: store.ownerVersion,
        nextState: M8_FACTION_ARC_STATE_NEGOTIATED,
        tick: 100,
      }),
    ).toMatchObject({ ok: true });
    const before = store.createMetrics();

    expect(
      store.registerFactionArc(
        createArc(0, {
          resourceMask: M8_FACTION_RESOURCE_LEGAL_RECOGNITION,
          contradictionMask: 1 << 1,
          negotiationMask: 1 << 1,
          failureMask: 1 << 1,
          priority: 1,
        }),
      ),
    ).toEqual({ ok: false, reason: "m8_faction_endgame_arc_already_registered" });

    expect(store.createMetrics()).toEqual(before);
    expect(store.readFactionArc(0)).toMatchObject({
      state: M8_FACTION_ARC_STATE_NEGOTIATED,
      contradictionMask: 1,
      negotiationMask: 1,
      failureMask: 1,
      priority: 100,
    });
    const output = new Uint32Array(2);
    expect(
      store.queryFactionArcs(
        { factionId: 0, expectedOwnerVersion: store.ownerVersion, candidateCap: 2, scanCap: 2 },
        output,
      ),
    ).toMatchObject({ ok: true, selectedCount: 1, visitedCount: 1 });
  });

  it("rejects duplicate active route registration without resetting route state or counts", () => {
    const store = createM8FactionEndgameStore({ arcCapacity: 1, routePathCapacity: 2 });
    expect(store.registerRoutePath(createRoute(0))).toMatchObject({
      ok: true,
      reason: "m8_faction_endgame_route_registered",
    });
    const routeOutput = new Uint32Array(1);
    expect(
      store.evaluateRoute(
        {
          routeId: 0,
          expectedOwnerVersion: store.ownerVersion,
          minSupportScore: 600,
          maxCostScore: 700,
          maxOppositionScore: 700,
          requiredExplanationMask: M8_ENDGAME_REQUIRED_EXPLANATION_MASK,
          candidateCap: 1,
          scanCap: 1,
        },
        routeOutput,
      ),
    ).toMatchObject({
      ok: true,
      routeState: M8_ENDGAME_ROUTE_STATE_AVAILABLE,
      reason: "m8_faction_endgame_route_available",
    });
    const before = store.createMetrics();

    expect(store.registerRoutePath(createRoute(0, { supportScore: 1000, priority: 1 }))).toEqual({
      ok: false,
      reason: "m8_faction_endgame_route_already_registered",
    });

    expect(store.createMetrics()).toEqual(before);
    expect(store.readRoutePath(0)).toMatchObject({
      state: M8_ENDGAME_ROUTE_STATE_AVAILABLE,
      supportScore: 700,
      priority: 100,
    });
  });

  it("rejects invalid arc masks before storage", () => {
    const invalidArcMasks: readonly Partial<M8FactionArcInput>[] = [
      { contradictionMask: 0 },
      { contradictionMask: -1 },
      { contradictionMask: 1.5 },
      { contradictionMask: M8_FACTION_MASK_ALL + 1 },
      { contradictionMask: 2 ** 33 },
      { negotiationMask: -1 },
      { negotiationMask: 1.5 },
      { negotiationMask: M8_FACTION_MASK_ALL + 1 },
      { negotiationMask: 2 ** 33 },
      { failureMask: -1 },
      { failureMask: 1.5 },
      { failureMask: M8_FACTION_MASK_ALL + 1 },
      { failureMask: 2 ** 33 },
    ];

    for (const invalidArcMask of invalidArcMasks) {
      const store = createM8FactionEndgameStore({ arcCapacity: 1, routePathCapacity: 1 });
      expect(store.registerFactionArc(createArc(0, invalidArcMask))).toEqual({
        ok: false,
        reason: "m8_faction_endgame_mask_invalid",
      });
      expect(store.readFactionArc(0)).toBeUndefined();
      expect(store.createMetrics()).toMatchObject({ activeArcCount: 0, indexedArcCount: 0 });
    }
  });

  it("rejects invalid route faction masks before storage", () => {
    const invalidRouteMasks: readonly Partial<M8EndgameRouteInput>[] = [
      { factionSupportMask: 0 },
      { factionSupportMask: -1 },
      { factionSupportMask: 1.5 },
      { factionSupportMask: M8_FACTION_MASK_ALL + 1 },
      { factionSupportMask: 2 ** 33 },
      { factionOppositionMask: -1 },
      { factionOppositionMask: 1.5 },
      { factionOppositionMask: M8_FACTION_MASK_ALL + 1 },
      { factionOppositionMask: 2 ** 33 },
    ];

    for (const invalidRouteMask of invalidRouteMasks) {
      const store = createM8FactionEndgameStore({ arcCapacity: 1, routePathCapacity: 1 });
      expect(store.registerRoutePath(createRoute(0, invalidRouteMask))).toEqual({
        ok: false,
        reason: "m8_faction_endgame_mask_invalid",
      });
      expect(store.readRoutePath(0)).toBeUndefined();
      expect(store.createMetrics()).toMatchObject({
        activeRoutePathCount: 0,
        indexedRoutePathCount: 0,
      });
    }
  });
});

function route(
  routes: readonly M8EndgameRouteScenarioEvidence[],
  routeId: number,
): M8EndgameRouteScenarioEvidence {
  for (const candidate of routes) {
    if (candidate.routeId === routeId) return candidate;
  }
  throw new Error(`missing route ${String(routeId)}`);
}

function createArc(arcId: number, overrides: Partial<M8FactionArcInput> = {}): M8FactionArcInput {
  return {
    arcId,
    factionId: 0,
    resourceMask: 1,
    constraintMask: 1,
    contradictionMask: 1,
    negotiationMask: 1,
    failureMask: 1,
    explanationMask: M8_ENDGAME_REQUIRED_EXPLANATION_MASK,
    factionOwnerVersion: 1,
    governanceOwnerVersion: 1,
    chronicleOwnerVersion: 1,
    obligationOwnerVersion: 1,
    ordinanceOwnerVersion: 1,
    sourceEventId: 1,
    sourceOwnerVersion: 1,
    priority: 100 - arcId,
    stableSequence: arcId,
    ...overrides,
  };
}

function createRoute(
  routeId: number,
  overrides: Partial<M8EndgameRouteInput> = {},
): M8EndgameRouteInput {
  return {
    routeId,
    supportScore: 700,
    costScore: 500,
    oppositionScore: 400,
    explanationMask: M8_ENDGAME_REQUIRED_EXPLANATION_MASK,
    factionSupportMask: 1,
    factionOppositionMask: 0,
    lampBoundaryScore: 700,
    chronicleScore: 700,
    obligationPressure: 300,
    ordinanceLegitimacy: 700,
    socialTrustScore: 700,
    productionScore: 700,
    factionOwnerVersion: 1,
    governanceOwnerVersion: 1,
    chronicleOwnerVersion: 1,
    obligationOwnerVersion: 1,
    ordinanceOwnerVersion: 1,
    sourceEventId: 1,
    sourceOwnerVersion: 1,
    priority: 100 - routeId,
    stableSequence: routeId,
    ...overrides,
  };
}
