import { describe, expect, it } from "vitest";

import {
  M4_EVIDENCE_TIER_CREDIBLE,
  M5_ANOMALY_DEF_BORROWED_SHADOW,
  M5_ANOMALY_RULE_COMPONENT_BORROWED_SHADOW,
  createM4BorrowedShadowCrisisStore,
  createM5AnomalyRosterStore,
  createM5BorrowedShadowAnomalyDefinition,
  runM4CoreVerticalSliceScenario,
  type M4BorrowedShadowActivationBasis,
  type M5AnomalyActivationCandidateInput,
  type M5AnomalyRosterStore,
  type M5CompiledAnomalyDefinitionInput,
  type M5CompiledAnomalyRosterInput,
} from "./index";

const CONTENT_HASH = "0xwm0074";
const ROSTER_VERSION = 1;

describe("M5 anomaly roster", () => {
  it("validates immutable borrowed-shadow roster rows with stable DefIndex order", () => {
    const store = createM5AnomalyRosterStore({ definitionCapacity: 2, candidateCapacity: 4 });

    expect(store.loadCompiledRoster(createRoster())).toEqual({
      ok: true,
      changed: true,
      ownerVersion: 1,
      reason: "m5_anomaly_roster_compiled",
    });

    expect(store.readDefinition(0)).toMatchObject({
      defId: M5_ANOMALY_DEF_BORROWED_SHADOW,
      defIndex: 0,
      contentDefIndex: 0,
      ruleComponent: M5_ANOMALY_RULE_COMPONENT_BORROWED_SHADOW,
      rosterVersion: ROSTER_VERSION,
      contentManifestHash: CONTENT_HASH,
      ownerVersion: 1,
    });
    expect(store.createMetrics()).toMatchObject({
      ownerVersion: 1,
      rosterVersion: ROSTER_VERSION,
      definitionCount: 1,
      activeCandidateCount: 0,
    });
  });

  it("rejects malformed roster order and missing borrowed-shadow definitions", () => {
    const outOfOrder = createM5AnomalyRosterStore({
      definitionCapacity: 2,
      candidateCapacity: 2,
    });
    expect(
      outOfOrder.loadCompiledRoster({
        ...createRoster(),
        definitions: [createM5BorrowedShadowAnomalyDefinition(1, 0)],
      }),
    ).toEqual({ ok: false, reason: "m5_anomaly_roster_definition_order_invalid" });
    expect(outOfOrder.createMetrics()).toMatchObject({ ownerVersion: 0, definitionCount: 0 });

    const missing = createM5AnomalyRosterStore({ definitionCapacity: 2, candidateCapacity: 2 });
    expect(
      missing.loadCompiledRoster({
        ...createRoster(),
        definitions: [
          {
            ...createM5BorrowedShadowAnomalyDefinition(),
            defId: "core.anomaly.future_placeholder.v1",
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "m5_anomaly_roster_missing_borrowed_shadow" });
    expect(missing.readDefinition(0)).toBeUndefined();
  });

  it("rejects tampered borrowed-shadow rule-basis fields", () => {
    const tamperedRows: readonly Partial<M5CompiledAnomalyDefinitionInput>[] = [
      { minActivationScore: 0 },
      { evidenceClassMask: 0 },
      { nonCombatResolutionMask: 0 },
      { schemaVersion: 2 },
    ];

    for (const tamper of tamperedRows) {
      const store = createM5AnomalyRosterStore({ definitionCapacity: 2, candidateCapacity: 2 });
      expect(
        store.loadCompiledRoster({
          ...createRoster(),
          definitions: [{ ...createM5BorrowedShadowAnomalyDefinition(), ...tamper }],
        }),
      ).toEqual({ ok: false, reason: "m5_anomaly_roster_invalid_definition" });
      expect(store.readDefinition(0)).toBeUndefined();
      expect(store.createMetrics()).toMatchObject({ ownerVersion: 0, definitionCount: 0 });
    }
  });

  it("rejects duplicate defIds across all roster rows", () => {
    const store = createM5AnomalyRosterStore({ definitionCapacity: 3, candidateCapacity: 2 });
    expect(
      store.loadCompiledRoster({
        ...createRoster(),
        definitions: [
          createM5BorrowedShadowAnomalyDefinition(),
          createFutureDefinition(1, "core.anomaly.future_duplicate.v1"),
          createFutureDefinition(2, "core.anomaly.future_duplicate.v1"),
        ],
      }),
    ).toEqual({ ok: false, reason: "m5_anomaly_roster_definition_duplicate" });
    expect(store.createMetrics()).toMatchObject({ ownerVersion: 0, definitionCount: 0 });
    expect(store.readDefinition(1)).toBeUndefined();
  });

  it("uses bounded versioned candidate lanes with stable Top-K ordering and cap metrics", () => {
    const store = loadedStore(6);
    expect(
      store.registerActivationCandidate(createCandidate({ candidateId: 0, score: 700 })),
    ).toMatchObject({
      ok: true,
    });
    expect(
      store.registerActivationCandidate(
        createCandidate({ candidateId: 1, score: 900, priority: 1, stableOwnerId: 50 }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createCandidate({ candidateId: 2, score: 900, priority: 2, stableOwnerId: 90 }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createCandidate({ candidateId: 3, score: 900, priority: 2, stableOwnerId: 30 }),
      ),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(2);
    const result = store.queryActivationCandidates(
      {
        defIndex: 0,
        rosterVersion: ROSTER_VERSION,
        contentManifestHash: CONTENT_HASH,
        candidateCap: 2,
        selectedCap: 2,
        minScore: 0,
      },
      output,
    );

    expect(result).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      candidateCapHit: true,
      selectedCapHit: false,
      reason: "m5_anomaly_roster_activation_candidate_cap_reached",
    });
    expect([...output]).toEqual([3, 2]);
    expect(store.createMetrics()).toMatchObject({
      lastCandidateVisits: 2,
      totalCandidateVisits: 2,
      candidateCapHitCount: 1,
    });
  });

  it("rejects stale content basis before publishing activation candidates or reads", () => {
    const store = loadedStore(2);
    expect(
      store.registerActivationCandidate(createCandidate({ contentManifestHash: "0xstale" })),
    ).toEqual({ ok: false, reason: "m5_anomaly_roster_stale_content_basis" });
    expect(store.createMetrics()).toMatchObject({ ownerVersion: 1, activeCandidateCount: 0 });

    const output = new Uint32Array(1);
    expect(
      store.queryActivationCandidates(
        {
          defIndex: 0,
          rosterVersion: ROSTER_VERSION + 1,
          contentManifestHash: CONTENT_HASH,
          candidateCap: 1,
          selectedCap: 1,
          minScore: 0,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "m5_anomaly_roster_stale_content_basis" });
  });

  it("rejects typed-array wrapping basis values with structured reasons", () => {
    const invalidInputs: readonly Partial<M4BorrowedShadowActivationBasis>[] = [
      { lampGapSourceVersion: 0 },
      { lampGapIndexVersion: -1 },
      { evidenceOwnerVersion: 0x1_0000_0000 },
      { identityIndependentClassCount: -1 },
      { identitySupportTier: 0x1_0000 },
    ];
    for (const overrides of invalidInputs) {
      const store = loadedStore(2);
      expect(
        store.registerActivationCandidate(
          createCandidate({ borrowedShadowBasis: createBasis({ ...overrides }) }),
        ),
      ).toMatchObject({ ok: false });
      expect(store.readCandidate(0)).toBeUndefined();
      expect(store.createMetrics()).toMatchObject({ ownerVersion: 1, activeCandidateCount: 0 });
    }
  });

  it("lifts borrowed-shadow data into the roster without changing M4 crisis behavior", () => {
    const roster = loadedStore(2);
    expect(roster.registerActivationCandidate(createCandidate())).toMatchObject({ ok: true });
    const basis = roster.readBorrowedShadowActivationBasis(0);
    expect(basis).toEqual(createBasis());

    const crisis = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(basis).toBeDefined();
    if (basis !== undefined) {
      expect(crisis.registerActivationCandidate(basis)).toMatchObject({
        ok: true,
        reason: "borrowed_shadow_activation_candidates_indexed",
      });
    }
    expect(crisis.activateCandidate({ candidateId: 0, crisisId: 0, tick: 100 })).toMatchObject({
      ok: true,
      reason: "borrowed_shadow_activated",
    });
  });

  it("preserves the reviewed M4 core vertical-slice hashes", () => {
    const summary = runM4CoreVerticalSliceScenario({ seed: "4", ticks: 36_000 });
    expect(summary).toMatchObject({
      contentHash: "0x698f2c41",
      commandStreamHash: "0x538d0e43",
      finalWorldHash: "0xc201a925",
      readModelHash: "0xce261d9d",
    });
  });
});

function loadedStore(candidateCapacity: number): M5AnomalyRosterStore {
  const store = createM5AnomalyRosterStore({ definitionCapacity: 2, candidateCapacity });
  expect(store.loadCompiledRoster(createRoster())).toMatchObject({ ok: true });
  return store;
}

function createRoster(): M5CompiledAnomalyRosterInput {
  return {
    rosterVersion: ROSTER_VERSION,
    contentManifestHash: CONTENT_HASH,
    validationBasis: "wm0073.validation.ok",
    definitions: [createM5BorrowedShadowAnomalyDefinition()],
  };
}

function createFutureDefinition(defIndex: number, defId: string): M5CompiledAnomalyDefinitionInput {
  return {
    ...createM5BorrowedShadowAnomalyDefinition(defIndex, defIndex),
    defId,
    ruleComponent: 10 + defIndex,
    activationPolicy: 20 + defIndex,
    stateOwnerKind: 30 + defIndex,
  };
}

function createCandidate(
  overrides: Partial<M5AnomalyActivationCandidateInput> = {},
): M5AnomalyActivationCandidateInput {
  const candidateId = overrides.candidateId ?? 0;
  const basis = overrides.borrowedShadowBasis ?? createBasis({ candidateId });
  return {
    candidateId,
    defIndex: 0,
    stateOwnerId: candidateId,
    score: basis.lampGapScore,
    priority: 0,
    stableOwnerId: 100 + candidateId,
    stableSequence: candidateId,
    rosterVersion: ROSTER_VERSION,
    contentManifestHash: CONTENT_HASH,
    borrowedShadowBasis: basis,
    ...overrides,
  };
}

function createBasis(
  overrides: Partial<M4BorrowedShadowActivationBasis> = {},
): M4BorrowedShadowActivationBasis {
  return {
    candidateId: 0,
    targetActorId: 100,
    lampId: 200,
    lampGapScore: 700,
    humanClaim: 400,
    lampGapSourceVersion: 11,
    lampGapIndexVersion: 12,
    identityCaseId: 300,
    identityHypothesisId: 400,
    identitySupportTier: M4_EVIDENCE_TIER_CREDIBLE,
    identitySupportScore: 550,
    identityIndependentClassCount: 2,
    identityConfirmed: 0,
    evidenceOwnerVersion: 13,
    obligationOwnerVersion: 14,
    obligationDuePressure: 300,
    townRuleOwnerVersion: 15,
    nightWatchPolicyKnown: 1,
    ...overrides,
  };
}
