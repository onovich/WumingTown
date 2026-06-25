import { describe, expect, it } from "vitest";

import {
  M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
  M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
  M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT,
  M4_BORROWED_SHADOW_RESOLUTION_NEGOTIATION,
  M4_BORROWED_SHADOW_STATE_ACTIVATED,
  M4_BORROWED_SHADOW_STATE_ESCALATED,
  M4_BORROWED_SHADOW_STATE_FAILED,
  M4_BORROWED_SHADOW_STATE_RESOLVED,
  M4_BORROWED_SHADOW_STATE_TRACE,
  M4_BORROWED_SHADOW_TERMINAL_ABORTED,
  M4_BORROWED_SHADOW_TERMINAL_CONTAINED,
  M4_BORROWED_SHADOW_TERMINAL_HARM,
  M4_BORROWED_SHADOW_TERMINAL_NEGOTIATED,
  M4_BORROWED_SHADOW_TRACE_ACTIVATION,
  M4_BORROWED_SHADOW_TRACE_LOW_RISK_EVIDENCE,
  M4_EVIDENCE_TIER_CREDIBLE,
  createM4BorrowedShadowCrisisStore,
  type M4BorrowedShadowActivationBasis,
  type M4BorrowedShadowCrisisView,
} from "./index";

describe("M4 borrowed-shadow crisis store", () => {
  it("prevents activation without lamp gap risk or with confirmed identity evidence", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 4,
      crisisCapacity: 4,
      traceCapacity: 8,
    });
    expect(
      store.registerActivationCandidate(createBasis({ candidateId: 0, lampGapScore: 499 })),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 10 })).toEqual({
      ok: false,
      reason: "borrowed_shadow_activation_prevented_lamp_gap",
    });
    expect(store.readCandidate(0)).toMatchObject({ candidateId: 0 });

    expect(
      store.registerActivationCandidate(createBasis({ candidateId: 1, identityConfirmed: 1 })),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 1, crisisId: 1, tick: 11 })).toEqual({
      ok: false,
      reason: "borrowed_shadow_activation_prevented_identity_confirmed",
    });
    expect(store.createMetrics()).toMatchObject({ activeCandidateCount: 2, activeCrisisCount: 0 });
  });

  it("rejects resolution before escalation without changing crisis state or counts", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 12 })).toMatchObject({
      ok: true,
    });
    const before = requireCrisis(store.readCrisis(0));
    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT,
        tick: 13,
        lampGapClosed: 1,
        identityConfirmed: 1,
        containmentScore: 700,
        negotiationScore: 0,
      }),
    ).toEqual({ ok: false, reason: "borrowed_shadow_resolution_requirements_unmet" });
    expect(requireCrisis(store.readCrisis(0))).toEqual(before);
    expect(store.createMetrics()).toMatchObject({
      activeCrisisCount: 1,
      resolvedCrisisCount: 0,
      failedCrisisCount: 0,
    });
  });

  it("rejects irreversible harm before evidence while allowing aborted cleanup", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 14 })).toMatchObject({
      ok: true,
    });
    const before = requireCrisis(store.readCrisis(0));
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M4_BORROWED_SHADOW_TERMINAL_HARM,
        tick: 15,
      }),
    ).toEqual({ ok: false, reason: "borrowed_shadow_escalation_requires_evidence" });
    expect(requireCrisis(store.readCrisis(0))).toEqual(before);
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M4_BORROWED_SHADOW_TERMINAL_ABORTED,
        tick: 16,
      }),
    ).toMatchObject({ ok: true, reason: "borrowed_shadow_failed" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_FAILED,
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_ABORTED,
    });
    expect(store.createMetrics()).toMatchObject({
      activeCrisisCount: 0,
      failedCrisisCount: 1,
    });
  });

  it("rejects irreversible harm after low-risk evidence but before escalation", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 17 })).toMatchObject({
      ok: true,
    });
    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
        tick: 18,
      }),
    ).toMatchObject({ ok: true });
    const before = requireCrisis(store.readCrisis(0));
    expect(before).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_TRACE,
      lowRiskEvidenceCount: 1,
      escalationLevel: 0,
    });
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M4_BORROWED_SHADOW_TERMINAL_HARM,
        tick: 19,
      }),
    ).toEqual({ ok: false, reason: "borrowed_shadow_escalation_requires_evidence" });
    expect(requireCrisis(store.readCrisis(0))).toEqual(before);
    expect(store.createMetrics()).toMatchObject({
      activeCrisisCount: 1,
      failedCrisisCount: 0,
    });
  });

  it("allows irreversible harm only after low-risk evidence and escalation", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 20 })).toMatchObject({
      ok: true,
    });
    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
        tick: 21,
      }),
    ).toMatchObject({ ok: true });
    expect(store.escalateCrisis(0, 22)).toMatchObject({ ok: true });
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M4_BORROWED_SHADOW_TERMINAL_HARM,
        tick: 23,
      }),
    ).toMatchObject({ ok: true, reason: "borrowed_shadow_failed" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_FAILED,
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_HARM,
      lowRiskEvidenceCount: 1,
      escalationLevel: 1,
    });
    expect(store.createMetrics()).toMatchObject({
      activeCrisisCount: 0,
      failedCrisisCount: 1,
    });
  });

  it("rejects activation basis fields that would wrap typed arrays", () => {
    const invalidInputs: readonly Partial<M4BorrowedShadowActivationBasis>[] = [
      { lampGapSourceVersion: -1 },
      { lampGapIndexVersion: 0x1_0000_0000 },
      { evidenceOwnerVersion: -1 },
      { identityIndependentClassCount: -1 },
      { identitySupportTier: 0x1_0000 },
    ];
    for (const overrides of invalidInputs) {
      const store = createM4BorrowedShadowCrisisStore({
        candidateCapacity: 2,
        crisisCapacity: 2,
        traceCapacity: 8,
      });
      expect(store.registerActivationCandidate(createBasis(overrides))).toMatchObject({
        ok: false,
      });
      expect(store.readCandidate(0)).toBeUndefined();
      expect(store.createMetrics()).toMatchObject({
        ownerVersion: 0,
        activeCandidateCount: 0,
        activeCrisisCount: 0,
      });
    }
  });

  it("selects activation candidates in bounded score order with versioned metrics", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 5,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(
      store.registerActivationCandidate(createBasis({ candidateId: 0, lampGapScore: 700 })),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(createBasis({ candidateId: 1, lampGapScore: 900 })),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(createBasis({ candidateId: 2, lampGapScore: 800 })),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(2);
    const result = store.queryActivationCandidates(
      { candidateCap: 2, selectedCap: 2, minLampGapScore: 0 },
      output,
    );
    expect(result).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      candidateCapHit: true,
      selectedCapHit: false,
      ownerVersion: 3,
      reason: "borrowed_shadow_activation_candidate_cap_reached",
    });
    expect([...output]).toEqual([1, 2]);
    expect(store.createMetrics()).toMatchObject({
      lastCandidateVisits: 2,
      totalCandidateVisits: 2,
    });
  });

  it("records low-risk evidence before escalation and resolves through containment", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 4,
      crisisCapacity: 4,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 20 })).toMatchObject({
      ok: true,
      reason: "borrowed_shadow_activated",
    });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_ACTIVATED,
    });
    expect(store.escalateCrisis(0, 21)).toEqual({
      ok: false,
      reason: "borrowed_shadow_escalation_requires_evidence",
    });

    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
        tick: 22,
      }),
    ).toMatchObject({ ok: true, reason: "borrowed_shadow_low_risk_evidence_recorded" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_TRACE,
      lowRiskEvidenceCount: 1,
    });
    expect(store.escalateCrisis(0, 23)).toMatchObject({
      ok: true,
      reason: "borrowed_shadow_escalated",
    });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_ESCALATED,
      escalationLevel: 1,
    });
    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT,
        tick: 24,
        lampGapClosed: 1,
        identityConfirmed: 1,
        containmentScore: 700,
        negotiationScore: 0,
      }),
    ).toMatchObject({ ok: true, reason: "borrowed_shadow_resolved_contained" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_RESOLVED,
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_CONTAINED,
    });
    expect(store.createMetrics()).toMatchObject({
      activeCrisisCount: 0,
      resolvedCrisisCount: 1,
      lowRiskEvidenceCount: 1,
    });
    expect(store.readTrace(3)).toMatchObject({
      eventKind: M4_BORROWED_SHADOW_TRACE_ACTIVATION,
      reason: "borrowed_shadow_activated",
    });
    expect(store.readTrace(2)).toMatchObject({
      eventKind: M4_BORROWED_SHADOW_TRACE_LOW_RISK_EVIDENCE,
      evidenceKind: M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
    });
  });

  it("supports non-combat negotiation resolution", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 30 })).toMatchObject({
      ok: true,
    });
    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
        tick: 31,
      }),
    ).toMatchObject({ ok: true });
    expect(store.escalateCrisis(0, 32)).toMatchObject({ ok: true });
    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M4_BORROWED_SHADOW_RESOLUTION_NEGOTIATION,
        tick: 33,
        lampGapClosed: 0,
        identityConfirmed: 1,
        containmentScore: 0,
        negotiationScore: 700,
      }),
    ).toMatchObject({ ok: true, reason: "borrowed_shadow_resolved_negotiated" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_RESOLVED,
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_NEGOTIATED,
    });
  });

  it("records failed terminal cleanup and rejects later progress", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 40 })).toMatchObject({
      ok: true,
    });
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M4_BORROWED_SHADOW_TERMINAL_ABORTED,
        tick: 41,
      }),
    ).toMatchObject({ ok: true, reason: "borrowed_shadow_failed" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M4_BORROWED_SHADOW_STATE_FAILED,
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_ABORTED,
    });
    expect(store.recordLowRiskEvidence({ crisisId: 0, evidenceKind: 1, tick: 42 })).toEqual({
      ok: false,
      reason: "borrowed_shadow_terminal_state",
    });
    expect(store.createMetrics()).toMatchObject({
      activeCrisisCount: 0,
      failedCrisisCount: 1,
    });
  });

  it("exposes save-shaped numeric state without coroutine or UI-local progress fields", () => {
    const store = createM4BorrowedShadowCrisisStore({
      candidateCapacity: 2,
      crisisCapacity: 2,
      traceCapacity: 8,
    });
    expect(store.registerActivationCandidate(createBasis({ candidateId: 0 }))).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 50 })).toMatchObject({
      ok: true,
    });
    const view = requireCrisis(store.readCrisis(0));
    const forbidden = /promise|coroutine|closure|ui/i;
    for (const key of Object.keys(view)) {
      expect(key).not.toMatch(forbidden);
    }
    for (const value of Object.values(view)) {
      expect(Number.isSafeInteger(value)).toBe(true);
    }
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});

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

function requireCrisis(view: M4BorrowedShadowCrisisView | undefined): M4BorrowedShadowCrisisView {
  if (view === undefined) throw new Error("expected crisis view");
  return view;
}
