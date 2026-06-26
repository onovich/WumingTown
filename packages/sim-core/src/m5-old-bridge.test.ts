import { describe, expect, it } from "vitest";

import {
  M5_ANOMALY_DEF_OLD_BRIDGE_GUEST,
  M5_ANOMALY_RULE_COMPONENT_OLD_BRIDGE_GUEST,
  M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
  M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY,
  M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS,
  M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD,
  M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY,
  M5_OLD_BRIDGE_NONE,
  M5_OLD_BRIDGE_RESOLUTION_OBLIGATION_SETTLEMENT,
  M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY,
  M5_OLD_BRIDGE_RESOLUTION_REROUTE,
  M5_OLD_BRIDGE_STATE_FAILED,
  M5_OLD_BRIDGE_STATE_RESOLVED,
  M5_OLD_BRIDGE_STATE_TRACE,
  M5_OLD_BRIDGE_TERMINAL_OBLIGATION_SETTLED,
  M5_OLD_BRIDGE_TERMINAL_PASSAGE_DENIED,
  M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
  M5_OLD_BRIDGE_TERMINAL_REROUTED,
  M5_OLD_BRIDGE_TRACE_ACTIVATION,
  M5_OLD_BRIDGE_TRACE_LOW_RISK_EVIDENCE,
  createM5AnomalyRosterStore,
  createM5BorrowedShadowAnomalyDefinition,
  createM5OldBridgeGuestAnomalyDefinition,
  createM5OldBridgeGuestCrisisStore,
  createM5ThirdKnockAnomalyDefinition,
  validOldBridgeDefinition,
  type M5AnomalyDefinitionView,
  type M5CompiledAnomalyRosterInput,
  type M5OldBridgeActivationBasis,
  type M5OldBridgeCrisisView,
} from "./index";

const CONTENT_HASH = "0xwm0076";
const ROSTER_VERSION = 3;

describe("M5 old-bridge guest anomaly rule", () => {
  it("loads the rostered old-bridge definition with reviewed masks and component ids", () => {
    const roster = createM5AnomalyRosterStore({ definitionCapacity: 4, candidateCapacity: 4 });
    expect(roster.loadCompiledRoster(createRoster())).toMatchObject({ ok: true });
    const definition = requireDefinition(roster.readDefinition(2));
    expect(definition).toMatchObject({
      defId: M5_ANOMALY_DEF_OLD_BRIDGE_GUEST,
      defIndex: 2,
      ruleComponent: M5_ANOMALY_RULE_COMPONENT_OLD_BRIDGE_GUEST,
      rosterVersion: ROSTER_VERSION,
      contentManifestHash: CONTENT_HASH,
    });
    expect(validOldBridgeDefinition(definition)).toBe(true);

    const tampered = createM5AnomalyRosterStore({ definitionCapacity: 4, candidateCapacity: 4 });
    expect(
      tampered.loadCompiledRoster({
        ...createRoster(),
        definitions: [
          createM5BorrowedShadowAnomalyDefinition(),
          createM5ThirdKnockAnomalyDefinition(),
          { ...createM5OldBridgeGuestAnomalyDefinition(), evidenceClassMask: 0 },
        ],
      }),
    ).toEqual({ ok: false, reason: "m5_anomaly_roster_invalid_definition" });
  });

  it("uses prepared-item and route basis to prevent safe passage or activate unsafe crossings", () => {
    const { store, definition } = createFixture();
    expect(
      store.registerActivationCandidate(
        createBasis({
          candidateId: 0,
          preparedItemStackId: 810,
          preparedItemQuantity: 1,
          preparedItemScore: 700,
        }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 0, crisisId: 0, tick: 10 })).toEqual({
      ok: false,
      reason: "old_bridge_activation_prevented_safe_prepared_item",
    });

    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 1, bridgeWindowActive: 0 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 1, crisisId: 1, tick: 11 })).toEqual({
      ok: false,
      reason: "old_bridge_activation_prevented_outside_bridge_window",
    });

    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 2, routePassable: 0 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(store.activateCandidate({ candidateId: 2, crisisId: 2, tick: 12 })).toEqual({
      ok: false,
      reason: "old_bridge_activation_prevented_route_basis",
    });

    expect(
      store.registerActivationCandidate(createBasis({ candidateId: 3 }), definition),
    ).toMatchObject({
      ok: true,
    });
    expect(store.activateCandidate({ candidateId: 3, crisisId: 3, tick: 13 })).toMatchObject({
      ok: true,
      reason: "old_bridge_activated",
    });
  });

  it("rejects stale route/content basis and malformed prepared-item rows", () => {
    const { store, definition } = createFixture();
    expect(
      store.registerActivationCandidate(
        createBasis({ contentManifestHash: "0xstale" }),
        definition,
      ),
    ).toEqual({ ok: false, reason: "old_bridge_stale_content_basis" });

    const invalidVersions: readonly Partial<M5OldBridgeActivationBasis>[] = [
      { routeBasisVersion: 0 },
      { bridgeLedgerVersion: 0 },
      { preparedItemOwnerVersion: 0 },
      { logisticsIndexVersion: 0 },
      { chronicleEvidenceOwnerVersion: 0 },
      { obligationOwnerVersion: 0 },
      { factionFactOwnerVersion: 0 },
      { seasonOwnerVersion: 0 },
      { oldFamilyRecordVersion: 0 },
    ];
    for (const overrides of invalidVersions) {
      expect(store.registerActivationCandidate(createBasis(overrides), definition)).toEqual({
        ok: false,
        reason: "old_bridge_basis_version_invalid",
      });
    }
    expect(
      store.registerActivationCandidate(
        createBasis({ preparedItemQuantity: 2, preparedItemStackId: M5_OLD_BRIDGE_NONE }),
        definition,
      ),
    ).toEqual({ ok: false, reason: "old_bridge_value_out_of_range" });

    expect(store.registerActivationCandidate(createBasis(), definition)).toMatchObject({
      ok: true,
    });
    const nextDefinition = {
      ...definition,
      rosterVersion: ROSTER_VERSION + 1,
      contentManifestHash: "0xwm0076-next",
    };
    expect(
      store.registerActivationCandidate(
        createBasis({
          candidateId: 1,
          rosterVersion: ROSTER_VERSION + 1,
          contentManifestHash: "0xwm0076-next",
        }),
        nextDefinition,
      ),
    ).toEqual({ ok: false, reason: "old_bridge_stale_content_basis" });
    expect(store.readCandidate(0)).toMatchObject({
      candidateId: 0,
      contentManifestHash: CONTENT_HASH,
    });
  });

  it("selects bounded route/prepared-item candidates without scanning all logistics rows", () => {
    const { store, definition } = createFixture();
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 0, reciprocityDebtScore: 700 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 1, reciprocityDebtScore: 900, priority: 1, stableOwnerId: 50 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 2, reciprocityDebtScore: 900, priority: 2, stableOwnerId: 90 }),
        definition,
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerActivationCandidate(
        createBasis({ candidateId: 3, reciprocityDebtScore: 900, priority: 2, stableOwnerId: 30 }),
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
        minReciprocityDebtScore: 0,
      },
      output,
    );

    expect(result).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      candidateCapHit: true,
      selectedCapHit: false,
      reason: "old_bridge_activation_candidate_cap_reached",
    });
    expect([...output]).toEqual([3, 2]);
    expect(store.createMetrics()).toMatchObject({
      lastCandidateVisits: 2,
      totalCandidateVisits: 2,
      candidateCapHitCount: 1,
    });
  });

  it("records low-risk evidence and resolves reciprocity with review and cleanup rows", () => {
    const { store, definition } = createFixture();
    activateAndEscalate(store, definition, 0, 0, 20);

    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY,
        tick: 31,
        preparedItemDelivered: 1,
        routeReplanned: 0,
        obligationSettled: 0,
        reciprocityScore: 700,
        rerouteScore: 0,
        settlementScore: 0,
      }),
    ).toMatchObject({ ok: true, reason: "old_bridge_resolved_reciprocity" });

    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M5_OLD_BRIDGE_STATE_RESOLVED,
      terminalReason: M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
      lowRiskEvidenceCount: 5,
      cleanupPending: 1,
    });
    expect(store.readReview(0)).toMatchObject({
      crisisId: 0,
      resolutionMethod: M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY,
      terminalReason: M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
      lowRiskEvidenceCount: 5,
      routeBasisVersion: 11,
      preparedItemOwnerVersion: 13,
      factionFactOwnerVersion: 17,
      reason: "old_bridge_resolved_reciprocity",
    });
    expect(store.readTrace(7)).toMatchObject({
      eventKind: M5_OLD_BRIDGE_TRACE_ACTIVATION,
      reason: "old_bridge_activated",
    });
    expect(store.readTrace(6)).toMatchObject({
      eventKind: M5_OLD_BRIDGE_TRACE_LOW_RISK_EVIDENCE,
      evidenceKind: M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
    });
  });

  it("supports reroute and obligation settlement and reports terminal cleanup cap hits", () => {
    const { store, definition } = createFixture();
    activateAndEscalate(store, definition, 0, 0, 40);
    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M5_OLD_BRIDGE_RESOLUTION_REROUTE,
        tick: 51,
        preparedItemDelivered: 0,
        routeReplanned: 1,
        obligationSettled: 0,
        reciprocityScore: 0,
        rerouteScore: 700,
        settlementScore: 0,
      }),
    ).toMatchObject({ ok: true, reason: "old_bridge_resolved_rerouted" });

    activateAndEscalate(store, definition, 1, 1, 60);
    expect(
      store.resolveCrisis({
        crisisId: 1,
        method: M5_OLD_BRIDGE_RESOLUTION_OBLIGATION_SETTLEMENT,
        tick: 71,
        preparedItemDelivered: 0,
        routeReplanned: 0,
        obligationSettled: 1,
        reciprocityScore: 0,
        rerouteScore: 0,
        settlementScore: 700,
      }),
    ).toMatchObject({ ok: true, reason: "old_bridge_resolved_obligation_settled" });

    expect(requireCrisis(store.readCrisis(0))).toMatchObject({
      state: M5_OLD_BRIDGE_STATE_RESOLVED,
      terminalReason: M5_OLD_BRIDGE_TERMINAL_REROUTED,
    });
    expect(requireCrisis(store.readCrisis(1))).toMatchObject({
      state: M5_OLD_BRIDGE_STATE_RESOLVED,
      terminalReason: M5_OLD_BRIDGE_TERMINAL_OBLIGATION_SETTLED,
    });

    const cleanup = new Uint32Array(1);
    expect(store.drainTerminalCleanup(1, cleanup)).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 1,
      cleanupCapHit: true,
      reason: "old_bridge_terminal_cleanup_cap_reached",
    });
    expect([...cleanup]).toEqual([0]);
    expect(store.createMetrics()).toMatchObject({
      terminalCleanupPendingCount: 1,
      terminalCleanupCapHitCount: 1,
    });
  });

  it("preserves terminal cleanup rows when owner version is exhausted", () => {
    const { store, definition } = createFixture();
    activateAndEscalate(store, definition, 0, 0, 60);
    expect(
      store.resolveCrisis({
        crisisId: 0,
        method: M5_OLD_BRIDGE_RESOLUTION_RECIPROCITY,
        tick: 70,
        preparedItemDelivered: 1,
        routeReplanned: 0,
        obligationSettled: 0,
        reciprocityScore: 700,
        rerouteScore: 0,
        settlementScore: 0,
      }),
    ).toMatchObject({ ok: true, reason: "old_bridge_resolved_reciprocity" });

    activateAndEscalate(store, definition, 1, 1, 80);
    expect(
      store.resolveCrisis({
        crisisId: 1,
        method: M5_OLD_BRIDGE_RESOLUTION_REROUTE,
        tick: 90,
        preparedItemDelivered: 0,
        routeReplanned: 1,
        obligationSettled: 0,
        reciprocityScore: 0,
        rerouteScore: 700,
        settlementScore: 0,
      }),
    ).toMatchObject({ ok: true, reason: "old_bridge_resolved_rerouted" });

    expect(store.createMetrics()).toMatchObject({
      terminalCleanupPendingCount: 2,
      terminalCleanupCapHitCount: 0,
    });
    expect(Reflect.set(store, "ownerVersionValue", 0xffff_ffff)).toBe(true);

    const cleanup = new Uint32Array([17]);
    expect(store.drainTerminalCleanup(1, cleanup)).toEqual({
      ok: false,
      reason: "old_bridge_version_exhausted",
    });
    expect([...cleanup]).toEqual([17]);
    expect(requireCrisis(store.readCrisis(0))).toMatchObject({ cleanupPending: 1 });
    expect(requireCrisis(store.readCrisis(1))).toMatchObject({ cleanupPending: 1 });
    expect(store.createMetrics()).toMatchObject({
      ownerVersion: 0xffff_ffff,
      terminalCleanupPendingCount: 2,
      terminalCleanupCapHitCount: 0,
    });
  });

  it("records failed terminal cleanup and exposes serializable numeric state", () => {
    const { store, definition } = createFixture();
    activateAndEscalate(store, definition, 0, 0, 80);
    expect(
      store.failCrisis({
        crisisId: 0,
        terminalReason: M5_OLD_BRIDGE_TERMINAL_PASSAGE_DENIED,
        tick: 91,
      }),
    ).toMatchObject({ ok: true, reason: "old_bridge_failed" });
    const view = requireCrisis(store.readCrisis(0));
    expect(view).toMatchObject({
      state: M5_OLD_BRIDGE_STATE_FAILED,
      terminalReason: M5_OLD_BRIDGE_TERMINAL_PASSAGE_DENIED,
      cleanupPending: 1,
    });
    const forbidden = /promise|coroutine|closure|ui|logisticsScan/i;
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
  readonly store: ReturnType<typeof createM5OldBridgeGuestCrisisStore>;
  readonly definition: M5AnomalyDefinitionView;
} {
  const roster = createM5AnomalyRosterStore({ definitionCapacity: 4, candidateCapacity: 4 });
  expect(roster.loadCompiledRoster(createRoster())).toMatchObject({ ok: true });
  return {
    store: createM5OldBridgeGuestCrisisStore({
      candidateCapacity: 6,
      crisisCapacity: 4,
      traceCapacity: 8,
      reviewCapacity: 4,
    }),
    definition: requireDefinition(roster.readDefinition(2)),
  };
}

function createRoster(): M5CompiledAnomalyRosterInput {
  return {
    rosterVersion: ROSTER_VERSION,
    contentManifestHash: CONTENT_HASH,
    validationBasis: "wm0076.validation.ok",
    definitions: [
      createM5BorrowedShadowAnomalyDefinition(),
      createM5ThirdKnockAnomalyDefinition(),
      createM5OldBridgeGuestAnomalyDefinition(),
    ],
  };
}

function activateAndEscalate(
  store: ReturnType<typeof createM5OldBridgeGuestCrisisStore>,
  definition: M5AnomalyDefinitionView,
  candidateId: number,
  crisisId: number,
  baseTick: number,
): void {
  expect(store.registerActivationCandidate(createBasis({ candidateId }), definition)).toMatchObject(
    {
      ok: true,
    },
  );
  expect(store.activateCandidate({ candidateId, crisisId, tick: baseTick })).toMatchObject({
    ok: true,
  });
  const evidenceKinds = [
    M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
    M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS,
    M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY,
    M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY,
    M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD,
  ];
  for (let index = 0; index < evidenceKinds.length; index += 1) {
    expect(
      store.recordLowRiskEvidence({
        crisisId,
        evidenceKind: evidenceKinds[index] ?? 0,
        tick: baseTick + 1 + index,
      }),
    ).toMatchObject({ ok: true, reason: "old_bridge_low_risk_evidence_recorded" });
  }
  expect(requireCrisis(store.readCrisis(crisisId))).toMatchObject({
    state: M5_OLD_BRIDGE_STATE_TRACE,
    lowRiskEvidenceCount: 5,
  });
  expect(store.escalateCrisis(crisisId, baseTick + 10)).toMatchObject({
    ok: true,
    reason: "old_bridge_escalated",
  });
}

function createBasis(
  overrides: Partial<M5OldBridgeActivationBasis> = {},
): M5OldBridgeActivationBasis {
  const candidateId = overrides.candidateId ?? 0;
  return {
    candidateId,
    defIndex: 2,
    rosterVersion: ROSTER_VERSION,
    contentManifestHash: CONTENT_HASH,
    crossingActorId: 100 + candidateId,
    guestActorId: 200 + candidateId,
    bridgeId: 300,
    routeId: 400 + candidateId,
    bridgeWindowId: 500,
    seasonWindowId: 600,
    bridgeWindowActive: 1,
    routePassable: 1,
    routeBasisVersion: 11,
    routeDelayScore: 400,
    bridgeLedgerVersion: 12,
    bridgeLedgerEntryId: 700 + candidateId,
    bridgeLedgerMismatch: 1,
    preparedItemStackId: M5_OLD_BRIDGE_NONE,
    preparedItemDefId: 800,
    preparedItemQuantity: 0,
    preparedForActorId: 900 + candidateId,
    preparedItemOwnerVersion: 13,
    logisticsIndexVersion: 14,
    chronicleCaseId: 1_000 + candidateId,
    chronicleHypothesisId: 1_100 + candidateId,
    chronicleEvidenceOwnerVersion: 15,
    obligationOwnerVersion: 16,
    obligationId: 1_200 + candidateId,
    obligationPressure: 300,
    factionFactOwnerVersion: 17,
    factionPressure: 200,
    seasonOwnerVersion: 18,
    oldFamilyRecordVersion: 19,
    merchantTestimonyScore: 450,
    oldFamilyOralRecordScore: 500,
    preparedItemScore: 0,
    reciprocityDebtScore: 700,
    selfServingToll: 0,
    priority: 0,
    stableOwnerId: 1_300 + candidateId,
    stableSequence: candidateId,
    ...overrides,
  };
}

function requireDefinition(view: M5AnomalyDefinitionView | undefined): M5AnomalyDefinitionView {
  if (view === undefined) throw new Error("expected anomaly definition");
  return view;
}

function requireCrisis(view: M5OldBridgeCrisisView | undefined): M5OldBridgeCrisisView {
  if (view === undefined) throw new Error("expected old-bridge crisis");
  return view;
}
