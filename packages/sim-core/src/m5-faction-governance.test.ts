import { describe, expect, it } from "vitest";

import {
  M5_FACTION_FACT_KIND_DEBT_STANCE,
  M5_FACTION_FACT_KIND_FEAR_MEMORY,
  M5_FACTION_FACT_KIND_KNOWN_CLAIM,
  M5_FACTION_FACT_KIND_LEGAL_STANCE,
  M5_FACTION_FACT_KIND_LEGITIMACY,
  M5_FACTION_FACT_KIND_MEMORY_EVENT,
  M5_FACTION_FACT_KIND_TRADE_STANCE,
  M5_FACTION_FACT_MASK_ALL,
  M5_FACTION_FACT_MASK_DEBT_STANCE,
  M5_FACTION_FACT_MASK_LEGAL_STANCE,
  M5_FACTION_FACT_MASK_TRADE_STANCE,
  M5_FACTION_GOVERNANCE_NONE,
  M5_GOVERNANCE_COUNCIL_POST_LAMPKEEPER,
  M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY,
  M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY,
  M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE,
  M5_GOVERNANCE_HOOK_MASK_ALL,
  M5_GOVERNANCE_HOOK_MASK_ENFORCEMENT_CAPACITY,
  M5_GOVERNANCE_HOOK_RISK_FLAG,
  M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY,
  M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
  createM5FactionFactStore,
  createM5GovernanceHookStore,
  type M5FactionFactInput,
  type M5FactionFactView,
  type M5GovernanceHookInput,
  type M5GovernanceHookView,
} from "./index";

describe("M5 faction and governance owner hooks", () => {
  it("stores decomposed faction fact lanes without a single mood authority", () => {
    const store = createM5FactionFactStore({ factCapacity: 12, factionCapacity: 4 });
    const kinds = [
      M5_FACTION_FACT_KIND_LEGAL_STANCE,
      M5_FACTION_FACT_KIND_TRADE_STANCE,
      M5_FACTION_FACT_KIND_DEBT_STANCE,
      M5_FACTION_FACT_KIND_LEGITIMACY,
      M5_FACTION_FACT_KIND_FEAR_MEMORY,
      M5_FACTION_FACT_KIND_MEMORY_EVENT,
      M5_FACTION_FACT_KIND_KNOWN_CLAIM,
    ];
    for (let index = 0; index < kinds.length; index += 1) {
      expect(
        store.upsertFact(
          createFactionFact({ factId: index, kind: kinds[index] ?? 0, value: 200 + index }),
        ),
      ).toMatchObject({ ok: true, reason: "m5_faction_fact_indexed" });
    }

    expect(store.createMetrics()).toMatchObject({
      activeFactCount: 7,
      indexedFactCount: 7,
      legalFactCount: 1,
      tradeFactCount: 1,
      debtFactCount: 1,
      legitimacyFactCount: 1,
      fearMemoryFactCount: 1,
      memoryEventFactCount: 1,
      knownClaimFactCount: 1,
    });
    const view = requireFact(store.readFact(0));
    expect(view).toMatchObject({
      factionId: 1,
      subjectId: 20,
      kind: M5_FACTION_FACT_KIND_LEGAL_STANCE,
      sourceOwnerVersion: 5,
      chronicleOwnerVersion: 7,
      obligationOwnerVersion: 9,
    });
    expect(Object.keys(view).join("|")).not.toMatch(/mood|attitude|ui|text|diplomacy/i);
  });

  it("queries faction facts through bounded versioned faction lanes", () => {
    const store = createM5FactionFactStore({ factCapacity: 8, factionCapacity: 3 });
    expect(store.upsertFact(createFactionFact({ factId: 0, priority: 400 }))).toMatchObject({
      ok: true,
    });
    expect(
      store.upsertFact(createFactionFact({ factId: 1, factionId: 2, priority: 1000 })),
    ).toMatchObject({ ok: true });
    expect(
      store.upsertFact(
        createFactionFact({
          factId: 2,
          kind: M5_FACTION_FACT_KIND_TRADE_STANCE,
          value: 800,
          priority: 900,
          stableSequence: 1,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.upsertFact(
        createFactionFact({
          factId: 3,
          subjectId: 21,
          kind: M5_FACTION_FACT_KIND_DEBT_STANCE,
          value: 900,
          priority: 850,
          stableSequence: 2,
        }),
      ),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(2);
    expect(
      store.queryFacts(
        {
          factionId: 1,
          expectedOwnerVersion: store.ownerVersion,
          subjectId: M5_FACTION_GOVERNANCE_NONE,
          kindMask:
            M5_FACTION_FACT_MASK_LEGAL_STANCE |
            M5_FACTION_FACT_MASK_TRADE_STANCE |
            M5_FACTION_FACT_MASK_DEBT_STANCE,
          minValue: 0,
          candidateCap: 2,
          scanCap: 3,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 3,
      candidateCapHit: true,
      reason: "m5_faction_query_cap_reached",
    });
    expect([...output]).toEqual([2, 3]);
    expect(store.createMetrics()).toMatchObject({
      lastQueryVisits: 3,
      lastQuerySelected: 2,
      queryCapHitCount: 1,
    });

    expect(
      store.queryFacts(
        {
          factionId: 1,
          expectedOwnerVersion: store.ownerVersion - 1,
          subjectId: M5_FACTION_GOVERNANCE_NONE,
          kindMask: M5_FACTION_FACT_MASK_ALL,
          minValue: 0,
          candidateCap: 2,
          scanCap: 4,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "m5_faction_query_stale_basis" });
    expect(store.createMetrics()).toMatchObject({ staleBasisRejectCount: 1 });
  });

  it("evaluates governance policy legality through bounded hook queries", () => {
    const store = createM5GovernanceHookStore({ hookCapacity: 8, policyCapacity: 4 });
    expect(
      store.upsertHook(
        createGovernanceHook({
          hookId: 0,
          hookKind: M5_GOVERNANCE_HOOK_COUNCIL_POST_AUTHORITY,
          councilPostId: M5_GOVERNANCE_COUNCIL_POST_LAMPKEEPER,
          enforcementCapacity: 100,
          legitimacyScore: 200,
          priority: 600,
          stableSequence: 2,
        }),
      ),
    ).toMatchObject({ ok: true, reason: "m5_governance_hook_indexed" });
    expect(
      store.upsertHook(
        createGovernanceHook({
          hookId: 1,
          hookKind: M5_GOVERNANCE_HOOK_TEMPORARY_POLICY_AUTHORITY,
          temporaryPolicyId: 50,
          enforcementCapacity: 300,
          legitimacyScore: 300,
          priority: 900,
          stableSequence: 1,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.upsertHook(
        createGovernanceHook({
          hookId: 2,
          hookKind: M5_GOVERNANCE_HOOK_RISK_FLAG,
          enforcementCapacity: 0,
          legitimacyScore: 0,
          riskFlags: M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
          priority: 500,
          stableSequence: 3,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.upsertHook(
        createGovernanceHook({ hookId: 3, policyId: 2, priority: 1000, stableSequence: 0 }),
      ),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(4);
    expect(
      store.evaluatePolicyHooks(
        {
          policyId: 1,
          expectedOwnerVersion: store.ownerVersion,
          tick: 25,
          hookKindMask: M5_GOVERNANCE_HOOK_MASK_ALL,
          minLegitimacyScore: 400,
          blockedRiskFlags: 0,
          candidateCap: 4,
          scanCap: 4,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 3,
      visitedCount: 3,
      allowed: true,
      policyPressureScore: 900,
      enforcementCapacity: 400,
      legitimacyScore: 500,
      riskFlags: M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
      reason: "m5_governance_query_allowed",
    });
    expect([...output]).toEqual([1, 0, 2, M5_FACTION_GOVERNANCE_NONE]);
    expect(store.createMetrics()).toMatchObject({
      councilPostAuthorityCount: 1,
      temporaryPolicyAuthorityCount: 1,
      riskFlagCount: 1,
      lastQueryVisits: 3,
    });

    expect(
      store.evaluatePolicyHooks(
        {
          policyId: 1,
          expectedOwnerVersion: store.ownerVersion,
          tick: 25,
          hookKindMask: M5_GOVERNANCE_HOOK_MASK_ALL,
          minLegitimacyScore: 400,
          blockedRiskFlags: M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
          candidateCap: 4,
          scanCap: 4,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      allowed: false,
      reason: "m5_governance_query_risk_blocked",
    });
    expect(store.createMetrics()).toMatchObject({ riskBlockedCount: 1 });
  });

  it("does not report cap hits from nonmatching tail rows", () => {
    const factions = createM5FactionFactStore({ factCapacity: 4, factionCapacity: 2 });
    expect(factions.upsertFact(createFactionFact({ factId: 0, priority: 900 }))).toMatchObject({
      ok: true,
    });
    expect(
      factions.upsertFact(
        createFactionFact({
          factId: 1,
          kind: M5_FACTION_FACT_KIND_DEBT_STANCE,
          priority: 800,
          stableSequence: 2,
        }),
      ),
    ).toMatchObject({ ok: true });

    const factOutput = new Uint32Array(1);
    expect(
      factions.queryFacts(
        {
          factionId: 1,
          expectedOwnerVersion: factions.ownerVersion,
          subjectId: M5_FACTION_GOVERNANCE_NONE,
          kindMask: M5_FACTION_FACT_MASK_LEGAL_STANCE,
          minValue: 0,
          candidateCap: 1,
          scanCap: 2,
        },
        factOutput,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 2,
      candidateCapHit: false,
      reason: "m5_faction_query_indexed",
    });
    expect([...factOutput]).toEqual([0]);

    const governance = createM5GovernanceHookStore({ hookCapacity: 4, policyCapacity: 2 });
    expect(
      governance.upsertHook(
        createGovernanceHook({
          hookId: 0,
          hookKind: M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY,
          enforcementCapacity: 300,
          legitimacyScore: 300,
          priority: 900,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      governance.upsertHook(
        createGovernanceHook({
          hookId: 1,
          hookKind: M5_GOVERNANCE_HOOK_RISK_FLAG,
          enforcementCapacity: 0,
          legitimacyScore: 0,
          riskFlags: M5_GOVERNANCE_RISK_FLAG_CENSORSHIP,
          priority: 800,
          stableSequence: 2,
        }),
      ),
    ).toMatchObject({ ok: true });

    const hookOutput = new Uint32Array(1);
    expect(
      governance.evaluatePolicyHooks(
        {
          policyId: 1,
          expectedOwnerVersion: governance.ownerVersion,
          tick: 25,
          hookKindMask: M5_GOVERNANCE_HOOK_MASK_ENFORCEMENT_CAPACITY,
          minLegitimacyScore: 100,
          blockedRiskFlags: 0,
          candidateCap: 1,
          scanCap: 2,
        },
        hookOutput,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 2,
      candidateCapHit: false,
      allowed: true,
      reason: "m5_governance_query_allowed",
    });
    expect([...hookOutput]).toEqual([0]);
  });

  it("rejects unversioned source facts and stale governance query basis", () => {
    const factions = createM5FactionFactStore({ factCapacity: 2, factionCapacity: 2 });
    expect(factions.upsertFact(createFactionFact({ sourceOwnerVersion: 0 }))).toEqual({
      ok: false,
      reason: "m5_faction_source_version_invalid",
    });
    expect(factions.createMetrics()).toMatchObject({ ownerVersion: 0, activeFactCount: 0 });

    const governance = createM5GovernanceHookStore({ hookCapacity: 2, policyCapacity: 2 });
    expect(governance.upsertHook(createGovernanceHook({ townRuleOwnerVersion: 0 }))).toEqual({
      ok: false,
      reason: "m5_governance_source_version_invalid",
    });
    expect(governance.upsertHook(createGovernanceHook())).toMatchObject({ ok: true });
    const output = new Uint32Array([77]);
    expect(
      governance.evaluatePolicyHooks(
        {
          policyId: 1,
          expectedOwnerVersion: 0,
          tick: 25,
          hookKindMask: M5_GOVERNANCE_HOOK_MASK_ALL,
          minLegitimacyScore: 100,
          blockedRiskFlags: 0,
          candidateCap: 1,
          scanCap: 1,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "m5_governance_query_stale_basis" });
    expect([...output]).toEqual([77]);
    expect(governance.createMetrics()).toMatchObject({ staleBasisRejectCount: 1 });
  });

  it("exposes serializable numeric views for derived UI summaries", () => {
    const factions = createM5FactionFactStore({ factCapacity: 2, factionCapacity: 2 });
    const governance = createM5GovernanceHookStore({ hookCapacity: 2, policyCapacity: 2 });
    expect(factions.upsertFact(createFactionFact())).toMatchObject({ ok: true });
    expect(
      governance.upsertHook(
        createGovernanceHook({
          hookKind: M5_GOVERNANCE_HOOK_LEGITIMACY_SOURCE,
          legitimacyScore: 500,
        }),
      ),
    ).toMatchObject({ ok: true });

    const factView = requireFact(factions.readFact(0));
    const hookView = requireHook(governance.readHook(0));
    for (const key of [...Object.keys(factView), ...Object.keys(hookView)]) {
      expect(key).not.toMatch(/mood|attitude|ui|text|template|director/i);
    }
    for (const value of Object.values(factView)) {
      expect(Number.isSafeInteger(value)).toBe(true);
    }
    for (const value of Object.values(hookView)) {
      expect(Number.isSafeInteger(value)).toBe(true);
    }
    expect(JSON.parse(JSON.stringify({ factView, hookView }))).toEqual({ factView, hookView });
  });
});

function createFactionFact(overrides: Partial<M5FactionFactInput> = {}): M5FactionFactInput {
  return {
    factId: 0,
    factionId: 1,
    subjectId: 20,
    kind: M5_FACTION_FACT_KIND_LEGAL_STANCE,
    value: 600,
    sourceEventId: 100,
    sourceOwnerVersion: 5,
    chronicleOwnerVersion: 7,
    obligationOwnerVersion: 9,
    tick: 30,
    priority: 500,
    stableOwnerId: 1,
    stableSequence: 1,
    ...overrides,
  };
}

function createGovernanceHook(
  overrides: Partial<M5GovernanceHookInput> = {},
): M5GovernanceHookInput {
  return {
    hookId: 0,
    policyId: 1,
    hookKind: M5_GOVERNANCE_HOOK_ENFORCEMENT_CAPACITY,
    authorityActorId: 10,
    councilPostId: M5_FACTION_GOVERNANCE_NONE,
    temporaryPolicyId: M5_FACTION_GOVERNANCE_NONE,
    enforcementCapacity: 200,
    legitimacySourceId: 30,
    legitimacyScore: 200,
    riskFlags: 0,
    townRuleOwnerVersion: 11,
    obligationOwnerVersion: 13,
    chronicleOwnerVersion: 17,
    sourceEventId: 200,
    sourceOwnerVersion: 19,
    startsAtTick: 10,
    expiresAtTick: 80,
    priority: 500,
    stableOwnerId: 1,
    stableSequence: 1,
    ...overrides,
  };
}

function requireFact(value: M5FactionFactView | undefined): M5FactionFactView {
  if (value === undefined) throw new Error("expected faction fact view");
  return value;
}

function requireHook(value: M5GovernanceHookView | undefined): M5GovernanceHookView {
  if (value === undefined) throw new Error("expected governance hook view");
  return value;
}
