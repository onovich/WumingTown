import { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
import {
  M5_FACTION_FACT_KIND_DEBT_STANCE,
  M5_FACTION_FACT_KIND_FEAR_MEMORY,
  M5_FACTION_FACT_KIND_KNOWN_CLAIM,
  M5_FACTION_FACT_KIND_LEGAL_STANCE,
  M5_FACTION_FACT_KIND_LEGITIMACY,
  M5_FACTION_FACT_KIND_MEMORY_EVENT,
  M5_FACTION_FACT_KIND_TRADE_STANCE,
  M5_FACTION_FACT_MASK_ALL,
  M5_FACTION_GOVERNANCE_NONE,
  M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY,
  M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE,
  type M5FactionFactInput,
  type M5FactionFactQueryResult,
  type M5GovernanceHookInput,
} from "./m5-faction-governance-types";
import { createM5FactionFactStore } from "./m5-faction-store";
import { createM5GovernanceHookStore } from "./m5-governance-store";
import { createM8FactionEndgameStore } from "./m8-faction-endgame-store";
import {
  M8_ENDGAME_EXPLANATION_ACCIDENT_REVIEW,
  M8_ENDGAME_EXPLANATION_COUNTEREVIDENCE,
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
  M8_FACTION_CONSTRAINT_CENSORSHIP_RISK,
  M8_FACTION_CONSTRAINT_COERCIVE_POLICY,
  M8_FACTION_CONSTRAINT_DEBT_COMMERCIALIZATION,
  M8_FACTION_CONSTRAINT_INHERITED_CLAIMS,
  M8_FACTION_CONSTRAINT_LONG_DEBT_TERMS,
  M8_FACTION_CONSTRAINT_MEMORIAL_DUTY,
  M8_FACTION_COUNT,
  M8_FACTION_ENDGAME_NONE,
  M8_FACTION_MOUNTAIN_CONTRACT_FAMILIES,
  M8_FACTION_NIGHT_MARKET_GUESTS,
  M8_FACTION_NINE_INNS_GUILD,
  M8_FACTION_REGISTRY_OFFICE,
  M8_FACTION_RESOURCE_CONTRACT_SERVICE,
  M8_FACTION_RESOURCE_COUNCIL_AUTHORITY,
  M8_FACTION_RESOURCE_LEGAL_RECOGNITION,
  M8_FACTION_RESOURCE_LOCAL_KNOWLEDGE,
  M8_FACTION_RESOURCE_MEMORIAL_TRUST,
  M8_FACTION_RESOURCE_TRADE_SUPPLY,
  M8_FACTION_RETURN_LAMP_SOCIETY,
  M8_FACTION_TOWN_COUNCIL_POSTS,
  type M8EndgameRouteEvaluationResult,
  type M8EndgameRouteInput,
  type M8FactionArcInput,
  type M8FactionEndgameMetrics,
  type M8FactionEndgameReason,
} from "./m8-faction-endgame-types";

export const M8_FACTION_ENDGAME_SCENARIO_ID = "m8.faction_endgame.owner_arcs.v1";
export const M8_FACTION_ENDGAME_ALIAS = "m8-faction-endgame-owner-arcs";
export const M8_FACTION_ENDGAME_SEED = "123";

export interface M8FactionArcScenarioEvidence {
  readonly factionId: number;
  readonly arcState: number;
  readonly resourceMask: number;
  readonly constraintMask: number;
  readonly contradictionMask: number;
  readonly negotiationMask: number;
  readonly failureMask: number;
  readonly explanationMask: number;
  readonly factionFactReason: M5FactionFactQueryResult["reason"];
  readonly factionFactSelectedCount: number;
  readonly factionFactVisitedCount: number;
}

export interface M8EndgameRouteScenarioEvidence {
  readonly routeId: number;
  readonly routeState: number;
  readonly reason: M8FactionEndgameReason;
  readonly supportScore: number;
  readonly costScore: number;
  readonly oppositionScore: number;
  readonly explanationMask: number;
}

export interface M8FactionEndgamePerformanceMetrics {
  readonly factionFactVisits: number;
  readonly routeVisits: number;
  readonly arcVisits: number;
  readonly capHitCount: number;
  readonly staleRejectCount: number;
  readonly maxRouteCandidateCap: number;
  readonly maxRouteScanCap: number;
}

export interface M8FactionEndgameReplayEvidence {
  readonly firstHash: string;
  readonly secondHash: string;
  readonly matched: boolean;
}

export interface M8FactionEndgameScenarioSummary {
  readonly version: 1;
  readonly scenarioId: string;
  readonly alias: string;
  readonly requestedSeed: string;
  readonly factionArcs: readonly M8FactionArcScenarioEvidence[];
  readonly routes: readonly M8EndgameRouteScenarioEvidence[];
  readonly metrics: M8FactionEndgameMetrics;
  readonly performance: M8FactionEndgamePerformanceMetrics;
  readonly replay: M8FactionEndgameReplayEvidence;
  readonly scenarioHash: string;
  readonly protectedM5BaselineTouched: false;
}

export function runM8FactionEndgameScenario(
  seed: string = M8_FACTION_ENDGAME_SEED,
): M8FactionEndgameScenarioSummary {
  const first = runScenarioOnce(seed);
  const second = runScenarioOnce(seed);
  return {
    version: 1,
    scenarioId: M8_FACTION_ENDGAME_SCENARIO_ID,
    alias: M8_FACTION_ENDGAME_ALIAS,
    requestedSeed: seed,
    factionArcs: first.factionArcs,
    routes: first.routes,
    metrics: first.metrics,
    performance: first.performance,
    replay: {
      firstHash: first.scenarioHash,
      secondHash: second.scenarioHash,
      matched: first.scenarioHash === second.scenarioHash,
    },
    scenarioHash: first.scenarioHash,
    protectedM5BaselineTouched: false,
  };
}

function runScenarioOnce(
  seed: string,
): Omit<
  M8FactionEndgameScenarioSummary,
  "version" | "scenarioId" | "alias" | "requestedSeed" | "replay" | "protectedM5BaselineTouched"
> {
  const factionStore = createM5FactionFactStore({
    factCapacity: 42,
    factionCapacity: M8_FACTION_COUNT,
  });
  const governanceStore = createM5GovernanceHookStore({
    hookCapacity: M8_FACTION_COUNT,
    policyCapacity: M8_FACTION_COUNT,
  });
  seedFactionFacts(factionStore);
  seedGovernanceHooks(governanceStore);

  const endgameStore = createM8FactionEndgameStore({
    arcCapacity: M8_FACTION_COUNT,
    routePathCapacity: M8_ENDGAME_ROUTE_COUNT,
  });
  seedFactionArcs(endgameStore, factionStore.ownerVersion, governanceStore.ownerVersion);
  seedRoutes(endgameStore, factionStore.ownerVersion, governanceStore.ownerVersion);

  const factionArcs = collectFactionArcEvidence(endgameStore, factionStore);
  const routes = evaluateRoutes(endgameStore);
  const metrics = endgameStore.createMetrics();
  const performance: M8FactionEndgamePerformanceMetrics = {
    factionFactVisits: factionStore.createMetrics().totalQueryVisits,
    routeVisits: routeVisitCount(routes),
    arcVisits: M8_FACTION_COUNT,
    capHitCount: metrics.queryCapHitCount,
    staleRejectCount: metrics.staleBasisRejectCount,
    maxRouteCandidateCap: 1,
    maxRouteScanCap: 1,
  };
  const scenarioHash = formatUint32Hex(
    hashScenario(seed, factionArcs, routes, metrics, performance),
  );
  return { factionArcs, routes, metrics, performance, scenarioHash };
}

function seedFactionFacts(store: ReturnType<typeof createM5FactionFactStore>): void {
  const kinds = [
    M5_FACTION_FACT_KIND_LEGAL_STANCE,
    M5_FACTION_FACT_KIND_TRADE_STANCE,
    M5_FACTION_FACT_KIND_DEBT_STANCE,
    M5_FACTION_FACT_KIND_LEGITIMACY,
    M5_FACTION_FACT_KIND_FEAR_MEMORY,
    M5_FACTION_FACT_KIND_MEMORY_EVENT,
    M5_FACTION_FACT_KIND_KNOWN_CLAIM,
  ];
  let factId = 0;
  for (let factionId = 0; factionId < M8_FACTION_COUNT; factionId += 1) {
    for (const kind of kinds) {
      const result = store.upsertFact(createFactionFact(factId, factionId, kind));
      if (!result.ok) throw new Error(result.reason);
      factId += 1;
    }
  }
}

function seedGovernanceHooks(store: ReturnType<typeof createM5GovernanceHookStore>): void {
  for (let factionId = 0; factionId < M8_FACTION_COUNT; factionId += 1) {
    const result = store.upsertHook(createGovernanceHook(factionId));
    if (!result.ok) throw new Error(result.reason);
  }
}

function seedFactionArcs(
  store: ReturnType<typeof createM8FactionEndgameStore>,
  factionOwnerVersion: number,
  governanceOwnerVersion: number,
): void {
  for (let factionId = 0; factionId < M8_FACTION_COUNT; factionId += 1) {
    const result = store.registerFactionArc(
      createFactionArc(factionId, factionOwnerVersion, governanceOwnerVersion),
    );
    if (!result.ok) throw new Error(result.reason);
  }
  for (let arcId = 0; arcId < M8_FACTION_COUNT; arcId += 1) {
    const result = store.transitionFactionArc({
      arcId,
      expectedOwnerVersion: store.ownerVersion,
      nextState: M8_FACTION_ARC_STATE_NEGOTIATED,
      tick: 72_000 + arcId,
    });
    if (!result.ok) throw new Error(result.reason);
  }
}

function seedRoutes(
  store: ReturnType<typeof createM8FactionEndgameStore>,
  factionOwnerVersion: number,
  governanceOwnerVersion: number,
): void {
  for (let routeId = 0; routeId < M8_ENDGAME_ROUTE_COUNT; routeId += 1) {
    const result = store.registerRoutePath(
      createRoutePath(routeId, factionOwnerVersion, governanceOwnerVersion),
    );
    if (!result.ok) throw new Error(result.reason);
  }
}

function collectFactionArcEvidence(
  endgameStore: ReturnType<typeof createM8FactionEndgameStore>,
  factionStore: ReturnType<typeof createM5FactionFactStore>,
): readonly M8FactionArcScenarioEvidence[] {
  const arcs: M8FactionArcScenarioEvidence[] = [];
  const arcOutput = new Uint32Array(1);
  const factOutput = new Uint32Array(7);
  for (let factionId = 0; factionId < M8_FACTION_COUNT; factionId += 1) {
    const arcQuery = endgameStore.queryFactionArcs(
      {
        factionId,
        expectedOwnerVersion: endgameStore.ownerVersion,
        candidateCap: 1,
        scanCap: 1,
      },
      arcOutput,
    );
    if (!arcQuery.ok) throw new Error(arcQuery.reason);
    const factQuery = factionStore.queryFacts(
      {
        factionId,
        expectedOwnerVersion: factionStore.ownerVersion,
        subjectId: M5_FACTION_GOVERNANCE_NONE,
        kindMask: M5_FACTION_FACT_MASK_ALL,
        minValue: 0,
        candidateCap: 7,
        scanCap: 7,
      },
      factOutput,
    );
    if (!factQuery.ok) throw new Error(factQuery.reason);
    const arc = endgameStore.readFactionArc(arcOutput[0] ?? M8_FACTION_ENDGAME_NONE);
    if (arc === undefined) throw new Error("missing faction arc");
    arcs.push({
      factionId,
      arcState: arc.state,
      resourceMask: arc.resourceMask,
      constraintMask: arc.constraintMask,
      contradictionMask: arc.contradictionMask,
      negotiationMask: arc.negotiationMask,
      failureMask: arc.failureMask,
      explanationMask: arc.explanationMask,
      factionFactReason: factQuery.reason,
      factionFactSelectedCount: factQuery.selectedCount,
      factionFactVisitedCount: factQuery.visitedCount,
    });
  }
  return arcs;
}

function evaluateRoutes(
  store: ReturnType<typeof createM8FactionEndgameStore>,
): readonly M8EndgameRouteScenarioEvidence[] {
  const routes: M8EndgameRouteScenarioEvidence[] = [];
  const routeOutput = new Uint32Array(1);
  for (let routeId = 0; routeId < M8_ENDGAME_ROUTE_COUNT; routeId += 1) {
    const result = store.evaluateRoute(
      {
        routeId,
        expectedOwnerVersion: store.ownerVersion,
        minSupportScore: 650,
        maxCostScore: 650,
        maxOppositionScore: 550,
        requiredExplanationMask: M8_ENDGAME_REQUIRED_EXPLANATION_MASK,
        candidateCap: 1,
        scanCap: 1,
      },
      routeOutput,
    );
    if (!result.ok) throw new Error(result.reason);
    routes.push(toRouteEvidence(routeId, result));
  }
  return routes;
}

function toRouteEvidence(
  routeId: number,
  result: Extract<M8EndgameRouteEvaluationResult, { readonly ok: true }>,
): M8EndgameRouteScenarioEvidence {
  return {
    routeId,
    routeState: result.routeState,
    reason: result.reason,
    supportScore: result.supportScore,
    costScore: result.costScore,
    oppositionScore: result.oppositionScore,
    explanationMask: result.explanationMask,
  };
}

function createFactionFact(factId: number, factionId: number, kind: number): M5FactionFactInput {
  return {
    factId,
    factionId,
    subjectId: 100 + factionId,
    kind,
    value: 500 + factionId * 20 + kind * 10,
    sourceEventId: 1_000 + factId,
    sourceOwnerVersion: 10 + factionId,
    chronicleOwnerVersion: 20 + factionId,
    obligationOwnerVersion: 30 + factionId,
    tick: 36_000 + factId,
    priority: 900 - kind,
    stableOwnerId: 100 + factionId,
    stableSequence: factId,
  };
}

function createGovernanceHook(factionId: number): M5GovernanceHookInput {
  return {
    hookId: factionId,
    policyId: factionId,
    hookKind:
      factionId % 2 === 0
        ? M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY
        : M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE,
    authorityActorId: 200 + factionId,
    councilPostId: M5_FACTION_GOVERNANCE_NONE,
    temporaryPolicyId: M5_FACTION_GOVERNANCE_NONE,
    enforcementCapacity: 250 + factionId * 30,
    legitimacySourceId: 300 + factionId,
    legitimacyScore: 260 + factionId * 25,
    riskFlags: 0,
    townRuleOwnerVersion: 40 + factionId,
    obligationOwnerVersion: 50 + factionId,
    chronicleOwnerVersion: 60 + factionId,
    sourceEventId: 1_200 + factionId,
    sourceOwnerVersion: 70 + factionId,
    startsAtTick: 0,
    expiresAtTick: 100_000,
    priority: 800 - factionId,
    stableOwnerId: 200 + factionId,
    stableSequence: factionId,
  };
}

function createFactionArc(
  factionId: number,
  factionOwnerVersion: number,
  governanceOwnerVersion: number,
): M8FactionArcInput {
  return {
    arcId: factionId,
    factionId,
    resourceMask: resourceForFaction(factionId),
    constraintMask: constraintForFaction(factionId),
    contradictionMask: 1 << factionId,
    negotiationMask: 1 << factionId,
    failureMask: 1 << factionId,
    explanationMask:
      M8_ENDGAME_REQUIRED_EXPLANATION_MASK |
      M8_ENDGAME_EXPLANATION_COUNTEREVIDENCE |
      M8_ENDGAME_EXPLANATION_ACCIDENT_REVIEW,
    factionOwnerVersion,
    governanceOwnerVersion,
    chronicleOwnerVersion: 100 + factionId,
    obligationOwnerVersion: 200 + factionId,
    ordinanceOwnerVersion: 300 + factionId,
    sourceEventId: 2_000 + factionId,
    sourceOwnerVersion: 400 + factionId,
    priority: 900 - factionId,
    stableSequence: factionId,
  };
}

function createRoutePath(
  routeId: number,
  factionOwnerVersion: number,
  governanceOwnerVersion: number,
): M8EndgameRouteInput {
  const required = M8_ENDGAME_REQUIRED_EXPLANATION_MASK | M8_ENDGAME_EXPLANATION_COUNTEREVIDENCE;
  return {
    routeId,
    supportScore: routeSupport(routeId),
    costScore: routeCost(routeId),
    oppositionScore: routeOpposition(routeId),
    explanationMask: required,
    factionSupportMask: routeFactionSupport(routeId),
    factionOppositionMask: routeFactionOpposition(routeId),
    lampBoundaryScore: routeId === M8_ENDGAME_ROUTE_UNLIT_TOWN ? 300 : 750,
    chronicleScore: 700,
    obligationPressure: routeId === M8_ENDGAME_ROUTE_MIGRATION ? 640 : 520,
    ordinanceLegitimacy: 690,
    socialTrustScore: routeId === M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN ? 540 : 710,
    productionScore: routeId === M8_ENDGAME_ROUTE_HUMAN_TOWN ? 730 : 620,
    factionOwnerVersion,
    governanceOwnerVersion,
    chronicleOwnerVersion: 500 + routeId,
    obligationOwnerVersion: 600 + routeId,
    ordinanceOwnerVersion: 700 + routeId,
    sourceEventId: 3_000 + routeId,
    sourceOwnerVersion: 800 + routeId,
    priority: 900 - routeId,
    stableSequence: routeId,
  };
}

function resourceForFaction(factionId: number): number {
  if (factionId === M8_FACTION_REGISTRY_OFFICE) return M8_FACTION_RESOURCE_LEGAL_RECOGNITION;
  if (factionId === M8_FACTION_NINE_INNS_GUILD) return M8_FACTION_RESOURCE_TRADE_SUPPLY;
  if (factionId === M8_FACTION_MOUNTAIN_CONTRACT_FAMILIES)
    return M8_FACTION_RESOURCE_LOCAL_KNOWLEDGE;
  if (factionId === M8_FACTION_NIGHT_MARKET_GUESTS) return M8_FACTION_RESOURCE_CONTRACT_SERVICE;
  if (factionId === M8_FACTION_RETURN_LAMP_SOCIETY) return M8_FACTION_RESOURCE_MEMORIAL_TRUST;
  return M8_FACTION_RESOURCE_COUNCIL_AUTHORITY;
}

function constraintForFaction(factionId: number): number {
  if (factionId === M8_FACTION_REGISTRY_OFFICE) return M8_FACTION_CONSTRAINT_CENSORSHIP_RISK;
  if (factionId === M8_FACTION_NINE_INNS_GUILD) return M8_FACTION_CONSTRAINT_DEBT_COMMERCIALIZATION;
  if (factionId === M8_FACTION_MOUNTAIN_CONTRACT_FAMILIES)
    return M8_FACTION_CONSTRAINT_INHERITED_CLAIMS;
  if (factionId === M8_FACTION_NIGHT_MARKET_GUESTS) return M8_FACTION_CONSTRAINT_LONG_DEBT_TERMS;
  if (factionId === M8_FACTION_RETURN_LAMP_SOCIETY) return M8_FACTION_CONSTRAINT_MEMORIAL_DUTY;
  return M8_FACTION_CONSTRAINT_COERCIVE_POLICY;
}

function routeSupport(routeId: number): number {
  if (routeId === M8_ENDGAME_ROUTE_HUMAN_TOWN) return 760;
  if (routeId === M8_ENDGAME_ROUTE_COHABITATION_TOWN) return 720;
  if (routeId === M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN) return 700;
  if (routeId === M8_ENDGAME_ROUTE_UNLIT_TOWN) return 540;
  return 690;
}

function routeCost(routeId: number): number {
  if (routeId === M8_ENDGAME_ROUTE_COHABITATION_TOWN) return 700;
  if (routeId === M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN) return 680;
  if (routeId === M8_ENDGAME_ROUTE_MIGRATION) return 640;
  return 620;
}

function routeOpposition(routeId: number): number {
  if (routeId === M8_ENDGAME_ROUTE_COHABITATION_TOWN) return 640;
  if (routeId === M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN) return 620;
  if (routeId === M8_ENDGAME_ROUTE_MIGRATION) return 540;
  return 520;
}

function routeFactionSupport(routeId: number): number {
  if (routeId === M8_ENDGAME_ROUTE_HUMAN_TOWN) return 1 << M8_FACTION_RETURN_LAMP_SOCIETY;
  if (routeId === M8_ENDGAME_ROUTE_COHABITATION_TOWN) return 1 << M8_FACTION_NIGHT_MARKET_GUESTS;
  if (routeId === M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN)
    return 1 << M8_FACTION_MOUNTAIN_CONTRACT_FAMILIES;
  if (routeId === M8_ENDGAME_ROUTE_UNLIT_TOWN) return 1 << M8_FACTION_NINE_INNS_GUILD;
  return 1 << M8_FACTION_REGISTRY_OFFICE;
}

function routeFactionOpposition(routeId: number): number {
  if (routeId === M8_ENDGAME_ROUTE_COHABITATION_TOWN) return 1 << M8_FACTION_REGISTRY_OFFICE;
  if (routeId === M8_ENDGAME_ROUTE_SECRET_KEEPING_TOWN) return 1 << M8_FACTION_TOWN_COUNCIL_POSTS;
  if (routeId === M8_ENDGAME_ROUTE_UNLIT_TOWN) return 1 << M8_FACTION_RETURN_LAMP_SOCIETY;
  return 0;
}

function routeVisitCount(routes: readonly M8EndgameRouteScenarioEvidence[]): number {
  let visits = 0;
  for (const route of routes) {
    if (
      route.routeState === M8_ENDGAME_ROUTE_STATE_AVAILABLE ||
      route.routeState === M8_ENDGAME_ROUTE_STATE_BLOCKED ||
      route.routeState === M8_ENDGAME_ROUTE_STATE_CONTESTED
    ) {
      visits += 1;
    }
  }
  return visits;
}

function hashScenario(
  seed: string,
  arcs: readonly M8FactionArcScenarioEvidence[],
  routes: readonly M8EndgameRouteScenarioEvidence[],
  metrics: M8FactionEndgameMetrics,
  performance: M8FactionEndgamePerformanceMetrics,
): number {
  let hash = hashStringToUint32(`${M8_FACTION_ENDGAME_SCENARIO_ID}:${seed}`);
  for (const arc of arcs) {
    hash = mixUint32(hash, arc.factionId);
    hash = mixUint32(hash, arc.arcState);
    hash = mixUint32(hash, arc.resourceMask);
    hash = mixUint32(hash, arc.constraintMask);
    hash = mixUint32(hash, arc.factionFactSelectedCount);
  }
  for (const route of routes) {
    hash = mixUint32(hash, route.routeId);
    hash = mixUint32(hash, route.routeState);
    hash = mixUint32(hash, route.supportScore);
    hash = mixUint32(hash, route.costScore);
    hash = mixUint32(hash, route.oppositionScore);
  }
  hash = mixUint32(hash, metrics.ownerVersion);
  hash = mixUint32(hash, metrics.negotiatedArcCount);
  hash = mixUint32(hash, metrics.availableRouteCount);
  hash = mixUint32(hash, metrics.blockedRouteCount);
  hash = mixUint32(hash, metrics.contestedRouteCount);
  hash = mixUint32(hash, performance.factionFactVisits);
  hash = mixUint32(hash, performance.routeVisits);
  return hash;
}
