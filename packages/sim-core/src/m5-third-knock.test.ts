import { describe, expect, it } from "vitest";

import {
  M5_ANOMALY_DEF_THIRD_KNOCK,
  M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK,
  M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH,
  M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
  M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
  M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
  M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT,
  M5_THIRD_KNOCK_NONE,
  M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT,
  M5_THIRD_KNOCK_RESOLUTION_TEMPORARY_POLICY,
  M5_THIRD_KNOCK_STATE_FAILED,
  M5_THIRD_KNOCK_STATE_RESOLVED,
  M5_THIRD_KNOCK_STATE_TRACE,
  M5_THIRD_KNOCK_TERMINAL_CONTAINED,
  M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED,
  M5_THIRD_KNOCK_TERMINAL_POLICY_BOUND,
  M5_THIRD_KNOCK_TRACE_ACTIVATION,
  M5_THIRD_KNOCK_TRACE_LOW_RISK_EVIDENCE,
  createM5AnomalyRosterStore,
  createM5BorrowedShadowAnomalyDefinition,
  createM5ThirdKnockAnomalyDefinition,
  createM5ThirdKnockCrisisStore,
  validThirdKnockDefinition,
  type M5AnomalyDefinitionView,
  type M5CompiledAnomalyRosterInput,
  type M5ThirdKnockActivationBasis,
  type M5ThirdKnockCrisisView,
} from "./index";

const CONTENT_HASH = "0xwm0075";
const ROSTER_VERSION = 2;

describe("M5 third-knock anomaly rule", () => {
  it("loads the rostered third-knock definition with reviewed masks and component ids", () => {
    const roster = createM5AnomalyRosterStore({ definitionCapacity: 3, candidateCapacity: 4 });

    expect(roster.loadCompiledRoster(createRoster())).toMatchObject({ ok: true });
    const definition = requireDefinition(roster.readDefinition(1));
    expect(definition).toMatchObject({
      defId: M5_ANOMALY_DEF_THIRD_KNOCK,
      defIndex: 1,
      ruleComponent: M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK,
      rosterVersion: ROSTER_VERSION,
      contentManifestHash: CONTENT_HASH,
    });
    expect(validThirdKnockDefinition(definition)).toBe(true);

    const tampered = createM5AnomalyRosterStore({ definitionCapacity: 3, candidateCapacity: 4 });
    expect(
      tampered.loadCompiledRoster({
        ...createRoster(),
        definitions: [
          createM5BorrowedShadowAnomalyDefinition(),
          { ...createM5ThirdKnockAnomalyDefinition(), minActivationScore: 0 },
        ],
      }),
    ).toEqual({ ok: false, reason: "m5_anomaly_roster_invalid_definition" });
  });

  it("prevents activation for low threshold risk, missing third answer and known rule policy", () => {
    const { store, definition } = createFixture();
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 0, invitationDebtScore: 599 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 10 })).toEqual({
      ok: false,
      reason: "third_knock_activation_prevented_threshold",
    });

    expect(
      store.registerActivationCandidate(createBasis({ candidateId: 1, knockCount: 2 }), definition),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 1, crisisId: 1, tick: 11 })).toEqual({
      ok: false,
      reason: "third_knock_activation_prevented_prior_knocks",
    });

    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 2, knowsConfirmedRule: 1 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 2, crisisId: 2, tick: 12 })).toEqual({
      ok: false,
      reason: "third_knock_activation_prevented_known_rule_or_policy",
    });
    expect(store.createMetrics()).toMatchObject({
      activeCandidateCount: 3,
      activeCrisisCount: 0,
    });
  });

  it("rejects stale roster basis and unversioned Chronicle obligation guesthouse facts", () => {
    const { store, definition } = createFixture();
    expect(
      store.registerActivationCandidate(
        createBasis({ contentManifestHash: "0xstale" }),
        definition,
      ),
    ).toEqual({ ok: false, reason: "third_knock_stale_content_basis" });

    const invalidVersions: readonly Partial<M5ThirdKnockActivationBasis>[] = [
      { thresholdBasisVersion: 0 },
      { chronicleEvidenceOwnerVersion: 0 },
      { townRuleOwnerVersion: 0 },
      { obligationOwnerVersion: 0 },
      { guesthousePolicyVersion: 0 },
      { lodgingRegisterVersion: 0 },
    ];
    for (const overrides of invalidVersions) {
      expect(store.registerActivationCandidate(createBasis(overrides), definition)).toEqual({
        ok: false,
        reason: "third_knock_basis_version_invalid",
      });
    }
    expect(store.createMetrics()).toMatchObject({ ownerVersion: 0, activeCandidateCount: 0 });
  });

  it("rejects missing sentinel ids for required activation basis facts", () => {
    const { store, definition } = createFixture();
    const invalidIds: readonly Partial<M5ThirdKnockActivationBasis>[] = [
      { residentActorId: M5_THIRD_KNOCK_NONE },
      { guestActorId: M5_THIRD_KNOCK_NONE },
      { doorId: M5_THIRD_KNOCK_NONE },
      { thresholdId: M5_THIRD_KNOCK_NONE },
      { chronicleCaseId: M5_THIRD_KNOCK_NONE },
      { chronicleHypothesisId: M5_THIRD_KNOCK_NONE },
      { stableOwnerId: M5_THIRD_KNOCK_NONE },
    ];
    for (const overrides of invalidIds) {
      expect(store.registerActivationCandidate(createBasis(overrides), definition)).toEqual({
        ok: false,
        reason: "third_knock_value_out_of_range",
      });
    }
    expect(store.readCandidate(0)).toBeUndefined();
    expect(store.createMetrics()).toMatchObject({ ownerVersion: 0, activeCandidateCount: 0 });
  });

  it("pins roster and content basis so stale candidates cannot leak into later queries", () => {
    const { store, definition } = createFixture();
    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    const nextDefinition = {
      ...definition,
      rosterVersion: ROSTER_VERSION + 1,
      contentManifestHash: "0xwm0075-next",
    };

    expect(
      store.registerActivationCandidate(
        createBasis({
          candidateId: 1,
          rosterVersion: ROSTER_VERSION + 1,
          contentManifestHash: "0xwm0075-next",
        }),
        nextDefinition,
      ),
    ).toEqual({ ok: false, reason: "third_knock_stale_content_basis" });

    expect(store.readCandidate(0)).toMatchObject({
      candidateId: 0,
      rosterVersion: ROSTER_VERSION,
      contentManifestHash: CONTENT_HASH,
    });
    const output = new Uint32Array(1);
    expect(
      store.queryActivationCandidates(
        {
          rosterVersion: ROSTER_VERSION + 1,
          contentManifestHash: "0xwm0075-next",
          candidateCap: 1,
          selectedCap: 1,
          minInvitationDebtScore: 0,
        },
        output,
      ),
    ).toEqual({ ok: false, reason: "third_knock_stale_content_basis" });
    expect(
      store.queryActivationCandidates(
        {
          rosterVersion: ROSTER_VERSION,
          contentManifestHash: CONTENT_HASH,
          candidateCap: 1,
          selectedCap: 1,
          minInvitationDebtScore: 0,
        },
        output,
      ),
    ).toMatchObject({ ok: true, selectedCount: 1 });
    expect([...output]).toEqual([0]);
  });

  it("selects bounded activation candidates in stable top-k order with cap metrics", () => {
    const { store, definition } = createFixture();
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 0, invitationDebtScore: 700 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 1, invitationDebtScore: 900, priority: 1, stableOwnerId: 50 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 2, invitationDebtScore: 900, priority: 2, stableOwnerId: 90 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 3, invitationDebtScore: 900, priority: 2, stableOwnerId: 30 }),
        definition,
      ),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(2);
    const result = store.queryActivationCandidates(
      {
        rosterVersion: ROSTER_VERSION,
        contentManifestHash: CONTENT_HASH,
        candidateCap: 2,
        selectedCap: 2,
        minInvitationDebtScore: 0,
      },
      output,
    );

    expect(result).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      candidateCapHit: true,
      selectedCapHit: false,
      reason: "third_knock_activation_candidate_cap_reached",
    });
    expect([...output]).toEqual([3, 2]);
    expect(store.createMetrics()).toMatchObject({
      lastCandidateVisits: 2,
      totalCandidateVisits: 2,
      candidateCapHitCount: 1,
    });
  });

  it("records all low-risk evidence classes and resolves through containment review rows", () => {
    const { store, definition } = createFixture();
    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 20 })).toMatchObject({
      ok: true,
      reason: "third_knock_activated",
    });

    const evidenceKinds = [
      M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
      M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT,
      M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
      M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH,
      M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
    ];
    for (let index = 0; index < evidenceKinds.length; index += 1) {
      expect(
        store.recordLowRiskEvidence({
          crisisId: 0,
          evidenceKind: evidenceKinds[index] ?? 0,
          tick: 21 + index,
        }),
      ).toMatchObject({ ok: true, reason: "third_knock_low_risk_evidence_recorded" });
    }

    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M5_THIRD_KNOCK_STATE_TRACE,
      lowRiskEvidenceCount: 5,
    });
    expect(store.escalateCrisis(0, 30)).toMatchObject({
      ok: true,
      reason: "third_knock_escalated",
    });
    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT,
        tick: 31,
        thresholdSealed: 1,
        witnessesAligned: 1,
        policyPublished: 0,
        debtAcknowledged: 0,
        containmentScore: 700,
        policyScore: 0,
      }),
    ).toMatchObject({ ok: true, reason: "third_knock_resolved_contained" });

    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M5_THIRD_KNOCK_STATE_RESOLVED,
      terminalReason: M5_THIRD_KNOCK_TERMINAL_CONTAINED,
      lowRiskEvidenceCount: 5,
      invitationDebtScore: 700,
      obligationPressure: 300,
    });
    expect(store.readAccidentReview(0)).toMatchObject({
      crisisId: 0,
      resolutionMethod: M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT,
      terminalReason: M5_THIRD_KNOCK_TERMINAL_CONTAINED,
      lowRiskEvidenceCount: 5,
      invitationDebtScore: 700,
      obligationPressure: 300,
      reason: "third_knock_resolved_contained",
    });
    expect(store.readTrace(7)).toMatchObject({
      eventKind: M5_THIRD_KNOCK_TRACE_ACTIVATION,
      reason: "third_knock_activated",
    });
    expect(store.readTrace(6)).toMatchObject({
      eventKind: M5_THIRD_KNOCK_TRACE_LOW_RISK_EVIDENCE,
      evidenceKind: M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
    });
    expect(store.createMetrics()).toMatchObject({
      activeCrisisCount: 0,
      resolvedCrisisCount: 1,
      lowRiskEvidenceCount: 5,
      accidentReviewStoredCount: 1,
    });
  });

  it("rejects invalid resolution scores without changing escalated crisis state", () => {
    const { store, definition } = createFixture();
    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 32 })).toMatchObject({
      ok: true,
    });
    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
        tick: 33,
      }),
    ).toMatchObject({ ok: true });
    expect(store.escalateCrisis(0, 34)).toMatchObject({ ok: true });
    const before = requireCrisis(store.readCrisis(0));

    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M5_THIRD_KNOCK_RESOLUTION_CONTAINMENT,
        tick: 35,
        thresholdSealed: 1,
        witnessesAligned: 1,
        policyPublished: 0,
        debtAcknowledged: 0,
        containmentScore: Number.POSITIVE_INFINITY,
        policyScore: 0,
      }),
    ).toEqual({ ok: false, reason: "third_knock_value_out_of_range" });
    expect(requireCrisis(store.readCrisis(0))).toEqual(before);
  });

  it("caps low-risk evidence count instead of wrapping the uint16 lane", () => {
    const { store, definition } = createFixture();
    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 70 })).toMatchObject({
      ok: true,
    });
    for (let index = 0; index < 0xffff; index += 1) {
      expect(
        store.recordLowRiskEvidence({
          crisisId: 0,
          evidenceKind: M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
          tick: 71 + index,
        }),
      ).toMatchObject({ ok: true });
    }
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M5_THIRD_KNOCK_STATE_TRACE,
      lowRiskEvidenceCount: 0xffff,
    });
    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
        tick: 70_000,
      }),
    ).toEqual({ ok: false, reason: "third_knock_low_risk_evidence_cap_reached" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      lowRiskEvidenceCount: 0xffff,
    });
  });

  it("supports a non-combat temporary policy path", () => {
    const { store, definition } = createFixture();
    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 40 })).toMatchObject({
      ok: true,
    });
    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
        tick: 41,
      }),
    ).toMatchObject({ ok: true });
    expect(store.escalateCrisis(0, 42)).toMatchObject({ ok: true });
    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M5_THIRD_KNOCK_RESOLUTION_TEMPORARY_POLICY,
        tick: 43,
        thresholdSealed: 0,
        witnessesAligned: 0,
        policyPublished: 1,
        debtAcknowledged: 1,
        containmentScore: 0,
        policyScore: 700,
      }),
    ).toMatchObject({ ok: true, reason: "third_knock_resolved_policy_bound" });
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M5_THIRD_KNOCK_STATE_RESOLVED,
      terminalReason: M5_THIRD_KNOCK_TERMINAL_POLICY_BOUND,
    });
  });

  it("records failed terminal debt review only after evidence escalation", () => {
    const { store, definition } = createFixture();
    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 50 })).toMatchObject({
      ok: true,
    });
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED,
        tick: 51,
      }),
    ).toEqual({ ok: false, reason: "third_knock_escalation_requires_evidence" });
    expect(
      store.recordLowRiskEvidence({
        crisisId: 0,
        evidenceKind: M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
        tick: 52,
      }),
    ).toMatchObject({ ok: true });
    expect(store.escalateCrisis(0, 53)).toMatchObject({ ok: true });
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED,
        tick: 54,
      }),
    ).toMatchObject({ ok: true, reason: "third_knock_failed" });

    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M5_THIRD_KNOCK_STATE_FAILED,
      terminalReason: M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED,
      escalationLevel: 1,
    });
    expect(store.readAccidentReview(0)).toMatchObject({
      crisisId: 0,
      terminalReason: M5_THIRD_KNOCK_TERMINAL_DEBT_INVITED,
      reason: "third_knock_failed",
    });
  });

  it("exposes save-shaped numeric state without UI Promise coroutine or closure progress", () => {
    const { store, definition } = createFixture();
    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 60 })).toMatchObject({
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

function createFixture(): {
  readonly store: ReturnType<typeof createM5ThirdKnockCrisisStore>;
  readonly definition: M5AnomalyDefinitionView;
} {
  const roster = createM5AnomalyRosterStore({ definitionCapacity: 3, candidateCapacity: 4 });
  expect(roster.loadCompiledRoster(createRoster())).toMatchObject({ ok: true });
  return {
    store: createM5ThirdKnockCrisisStore({
      candidateCapacity: 6,
      crisisCapacity: 4,
      traceCapacity: 8,
      accidentReviewCapacity: 4,
    }),
    definition: requireDefinition(roster.readDefinition(1)),
  };
}

function createRoster(): M5CompiledAnomalyRosterInput {
  return {
    rosterVersion: ROSTER_VERSION,
    contentManifestHash: CONTENT_HASH,
    validationBasis: "wm0075.validation.ok",
    definitions: [createM5BorrowedShadowAnomalyDefinition(), createM5ThirdKnockAnomalyDefinition()],
  };
}

function createBasis(
  overrides: Partial<M5ThirdKnockActivationBasis> = {},
): M5ThirdKnockActivationBasis {
  const candidateId = overrides.candidateId ?? 0;
  return {
    candidateId,
    defIndex: 1,
    rosterVersion: ROSTER_VERSION,
    contentManifestHash: CONTENT_HASH,
    residentActorId: 100 + candidateId,
    guestActorId: 200 + candidateId,
    doorId: 300 + candidateId,
    thresholdId: 400 + candidateId,
    chronicleCaseId: 500 + candidateId,
    chronicleHypothesisId: 600 + candidateId,
    knockCount: 3,
    answeredThirdKnock: 1,
    thresholdBasisVersion: 11,
    thresholdMarkCount: 2,
    chronicleEvidenceOwnerVersion: 12,
    chronicleSupportScore: 550,
    chronicleIndependentClassCount: 3,
    townRuleOwnerVersion: 13,
    knowsConfirmedRule: 0,
    temporaryPolicyActive: 0,
    obligationOwnerVersion: 14,
    obligationPressure: 300,
    guesthousePolicyVersion: 15,
    lodgingRegisterVersion: 16,
    lodgingRegisterMismatch: 1,
    witnessDisagreementScore: 450,
    priorKnockWitnessCount: 2,
    invitationDebtScore: 700,
    priority: 0,
    stableOwnerId: 700 + candidateId,
    stableSequence: candidateId,
    ...overrides,
  };
}

function requireDefinition(view: M5AnomalyDefinitionView | undefined): M5AnomalyDefinitionView {
  if (view === undefined) throw new Error("expected anomaly definition");
  return view;
}

function requireCrisis(view: M5ThirdKnockCrisisView | undefined): M5ThirdKnockCrisisView {
  if (view === undefined) throw new Error("expected third-knock crisis");
  return view;
}
