import { describe, expect, it } from "vitest";

import {
  M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
  M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME,
  M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
  M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH,
  M5_ALPHA_CONTENT_ALIAS,
  M5_ALPHA_CONTENT_EXPECTED_TICKS,
  M5_ALPHA_CONTENT_SCENARIO_ID,
  M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
  M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY,
  M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS,
  M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD,
  M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY,
  M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
  M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
  M5_SEASON_COMMAND_SCHEDULE_EVENT,
  M5_SEASON_RECOVERY_RESOURCE,
  M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH,
  M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
  M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
  M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
  M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT,
  M5_THIRD_KNOCK_TERMINAL_CONTAINED,
  deriveM5AlphaContentScenarioSeed,
  runM5AlphaContentScenario,
} from "./index";

describe("M5 alpha content framework scenario", () => {
  it("runs deterministically with recorded seed and hash surfaces", () => {
    const first = runM5AlphaContentScenario({
      seed: "5",
      ticks: M5_ALPHA_CONTENT_EXPECTED_TICKS,
    });
    const second = runM5AlphaContentScenario({
      seed: "5",
      ticks: M5_ALPHA_CONTENT_EXPECTED_TICKS,
    });

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      version: 1,
      scenarioId: M5_ALPHA_CONTENT_SCENARIO_ID,
      alias: M5_ALPHA_CONTENT_ALIAS,
      requestedSeed: "5",
      authoritativeScenarioSeed: deriveM5AlphaContentScenarioSeed("5"),
      seed: deriveM5AlphaContentScenarioSeed("5"),
      finalTick: M5_ALPHA_CONTENT_EXPECTED_TICKS,
      tickRate: 30,
    });
    expect(first).toMatchObject({
      authoritativeScenarioSeed: "155",
      contentHash: "0xe55d3015",
      commandStreamHash: "0x81d37435",
      finalWorldHash: "0x9a4a905c",
      readModelHash: "0x57eba2b7",
    });
  });

  it("records content catalog, anomaly roster and M4 regression evidence", () => {
    const summary = runM5AlphaContentScenario({
      seed: "5",
      ticks: M5_ALPHA_CONTENT_EXPECTED_TICKS,
    });

    expect(summary.contentCatalog).toMatchObject({
      definitionCount: 30,
      catalogEntryCount: 20,
      reviewNoteCount: 20,
      blockedCatalogEntryCount: 1,
      blockedReasonCount: 1,
    });
    expect(summary.roster).toMatchObject({
      rosterVersion: 5,
      definitionCount: 3,
      borrowedShadowCandidateCapHit: true,
      borrowedShadowSelectedCapHit: false,
    });
    expect(summary.borrowedShadow.evidenceKinds).toEqual([
      M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
      M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH,
      M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME,
      M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
    ]);
    expect(summary.m4Regression).toEqual({
      scenarioId: "m4.core_vertical_slice.borrowed_shadow_lamps.v1",
      requestedSeed: "4",
      authoritativeScenarioSeed: "50",
      contentHash: "0x698f2c41",
      commandStreamHash: "0x538d0e43",
      finalWorldHash: "0xc201a925",
      readModelHash: "0xce261d9d",
      unchanged: true,
    });
  });

  it("exercises third-knock and old-bridge rules with non-combat reviews", () => {
    const summary = runM5AlphaContentScenario({
      seed: "5",
      ticks: M5_ALPHA_CONTENT_EXPECTED_TICKS,
    });

    expect(summary.thirdKnock.evidenceKinds).toEqual([
      M5_THIRD_KNOCK_EVIDENCE_PRIOR_KNOCKS,
      M5_THIRD_KNOCK_EVIDENCE_WITNESS_DISAGREEMENT,
      M5_THIRD_KNOCK_EVIDENCE_THRESHOLD_MARKS,
      M5_THIRD_KNOCK_EVIDENCE_LODGING_REGISTER_MISMATCH,
      M5_THIRD_KNOCK_EVIDENCE_OBLIGATION_PRESSURE,
    ]);
    expect(summary.thirdKnock).toMatchObject({
      queryCandidateCapHit: true,
      activationReason: "third_knock_activated",
      lowRiskEvidenceCount: 5,
      terminalReason: M5_THIRD_KNOCK_TERMINAL_CONTAINED,
      preventionReason: "third_knock_activation_prevented_threshold",
    });
    expect(summary.thirdKnock.review).toMatchObject({
      lowRiskEvidenceCount: 5,
      terminalReason: M5_THIRD_KNOCK_TERMINAL_CONTAINED,
      reason: "third_knock_resolved_contained",
    });

    expect(summary.oldBridge.evidenceKinds).toEqual([
      M5_OLD_BRIDGE_EVIDENCE_BRIDGE_LEDGER,
      M5_OLD_BRIDGE_EVIDENCE_MISSING_PREPARED_GOODS,
      M5_OLD_BRIDGE_EVIDENCE_ROUTE_DELAY,
      M5_OLD_BRIDGE_EVIDENCE_MERCHANT_TESTIMONY,
      M5_OLD_BRIDGE_EVIDENCE_OLD_FAMILY_ORAL_RECORD,
    ]);
    expect(summary.oldBridge).toMatchObject({
      queryCandidateCapHit: true,
      activationReason: "old_bridge_activated",
      lowRiskEvidenceCount: 5,
      terminalReason: M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
    });
    expect(summary.oldBridge.review).toMatchObject({
      lowRiskEvidenceCount: 5,
      terminalReason: M5_OLD_BRIDGE_TERMINAL_RECIPROCITY_ACCEPTED,
      reason: "old_bridge_resolved_reciprocity",
    });
  });

  it("exercises faction governance hooks, season events and strategy paths", () => {
    const summary = runM5AlphaContentScenario({
      seed: "5",
      ticks: M5_ALPHA_CONTENT_EXPECTED_TICKS,
    });

    expect(summary.factionGovernance.factionQuery).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 4,
      candidateCapHit: true,
      reason: "m5_faction_query_cap_reached",
    });
    expect(summary.factionGovernance.governanceAllowed).toMatchObject({
      ok: true,
      allowed: true,
      reason: "m5_governance_query_allowed",
    });
    expect(summary.factionGovernance.governanceBlocked).toMatchObject({
      ok: true,
      allowed: false,
      reason: "m5_governance_query_risk_blocked",
    });

    expect(summary.season.preconditionFailure).toMatchObject({
      ok: true,
      selectedCount: 0,
      rejectedPreconditionCount: 4,
      reason: "m5_season_event_precondition_failed",
    });
    expect(summary.season.incidentSelection).toMatchObject({
      ok: true,
      selectedCommandKind: M5_SEASON_COMMAND_SCHEDULE_EVENT,
      reason: "m5_season_event_incident_selected",
    });
    expect(summary.season.cooldownSelection).toMatchObject({
      ok: true,
      selectedCount: 0,
      rejectedCooldownCount: 1,
      reason: "m5_season_event_cooldown_active",
    });
    expect(summary.season.recoverySelection).toMatchObject({
      ok: true,
      recoveryWindowActive: true,
      selectedRecoveryType: M5_SEASON_RECOVERY_RESOURCE,
      selectedCommandKind: M5_SEASON_COMMAND_RESOURCE_OPPORTUNITY,
      reason: "m5_season_event_recovery_selected",
    });

    expect(strategyPathIds(summary.strategyPaths)).toEqual([
      "evidence_first",
      "lamp_patrol",
      "faction_negotiation",
      "conservative_governance",
    ]);
    expect(allStrategyPathsAreNonCombat(summary.strategyPaths)).toBe(true);
    expect(summary.stopSigns).toEqual({
      saveReplayImplemented: false,
      workerProjectionImplemented: false,
      benchmarkBaselineUpdated: false,
      m6Created: false,
      nextTasks: ["WM-0081", "WM-0082", "WM-0083"],
    });
  });
});

function strategyPathIds(paths: readonly { readonly pathId: string }[]): readonly string[] {
  const ids: string[] = [];
  for (const path of paths) {
    ids.push(path.pathId);
  }
  return ids;
}

function allStrategyPathsAreNonCombat(
  paths: readonly { readonly nonCombatResolution: boolean }[],
): boolean {
  for (const path of paths) {
    if (!path.nonCombatResolution) return false;
  }
  return true;
}
