import { describe, expect, it } from "vitest";

import {
  M4_BORROWED_SHADOW_TERMINAL_CONTAINED,
  M4_BORROWED_SHADOW_TERMINAL_HARM,
  M4_CORE_VERTICAL_SLICE_ALIAS,
  M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
  M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
  deriveM4CoreVerticalSliceScenarioSeed,
  runM4CoreVerticalSliceScenario,
} from "./index";

describe("M4 core vertical slice scenario", () => {
  it("runs the headless borrowed-shadow lamp slice with deterministic hashes", () => {
    const first = runM4CoreVerticalSliceScenario({
      seed: "4",
      ticks: M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
    });
    const second = runM4CoreVerticalSliceScenario({
      seed: "4",
      ticks: M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 1,
      scenarioId: M4_CORE_VERTICAL_SLICE_SCENARIO_ID,
      alias: M4_CORE_VERTICAL_SLICE_ALIAS,
      requestedSeed: "4",
      authoritativeScenarioSeed: deriveM4CoreVerticalSliceScenarioSeed("4"),
      finalTick: M4_CORE_VERTICAL_SLICE_EXPECTED_TICKS,
      tickRate: 30,
    });
    expect(first).toMatchObject({
      seed: "50",
      contentHash: "0x698f2c41",
      commandStreamHash: "0x538d0e43",
      finalWorldHash: "0xc201a925",
      readModelHash: "0xce261d9d",
    });
  });

  it("shows the borrowed-shadow rule can be inferred before irreversible harm", () => {
    const summary = runM4CoreVerticalSliceScenario({ seed: "4", ticks: 36_000 });

    expect(summary.preventionPath).toMatchObject({
      selectedCandidateId: 0,
      reason: "borrowed_shadow_activation_prevented_identity_confirmed",
      evidenceBeforeIrreversibleHarm: true,
    });
    expect(summary.containmentPath).toMatchObject({
      branchId: 2,
      selectedCandidateId: 1,
      reason: "borrowed_shadow_resolved_contained",
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_CONTAINED,
      evidenceBeforeIrreversibleHarm: true,
    });
    expect(summary.failurePath).toMatchObject({
      branchId: 3,
      selectedCandidateId: 2,
      reason: "borrowed_shadow_failed",
      terminalReason: M4_BORROWED_SHADOW_TERMINAL_HARM,
      evidenceBeforeIrreversibleHarm: true,
    });
    expect(summary.containmentPath.lowRiskEvidenceCount).toBeGreaterThan(0);
    expect(summary.failurePath.lowRiskEvidenceCount).toBeGreaterThan(0);
    expect(summary.containmentPath.supportTier).toBeGreaterThanOrEqual(3);
    expect(summary.containmentPath.independentEvidenceClassCount).toBeGreaterThanOrEqual(3);
  });

  it("keeps prevention containment and failure activation bases branch-local", () => {
    const summary = runM4CoreVerticalSliceScenario({ seed: "4", ticks: 36_000 });

    expect(summary.preventionPath.activationBasis).toMatchObject({
      candidateId: 0,
      identityConfirmed: 1,
    });
    expect(summary.preventionPath.identityConfirmedTick).toBeLessThan(
      summary.preventionPath.activationTick,
    );
    expect(summary.preventionPath.obligationFulfilledTick).toBeLessThan(
      summary.preventionPath.activationTick,
    );
    expect(summary.preventionPath.townRuleDecisionTick).toBeLessThan(
      summary.preventionPath.activationTick,
    );

    expect(summary.containmentPath.activationBasis).toMatchObject({
      candidateId: 1,
      identityConfirmed: 0,
    });
    expect(summary.containmentPath.activationBasis.evidenceOwnerVersion).toBeLessThan(
      summary.preventionPath.activationBasis.evidenceOwnerVersion,
    );
    expect(summary.containmentPath.activationTick).toBeLessThan(
      summary.containmentPath.obligationFulfilledTick,
    );
    expect(summary.containmentPath.activationTick).toBeLessThan(
      summary.containmentPath.identityConfirmedTick,
    );
    expect(summary.containmentPath.activationTick).toBeLessThan(
      summary.containmentPath.townRuleDecisionTick,
    );

    expect(summary.failurePath.activationBasis).toMatchObject({
      candidateId: 2,
      identityConfirmed: 0,
    });
    expect(summary.failurePath.identityConfirmedTick).toBe(0);
    expect(summary.failurePath.obligationFulfilledTick).toBe(0);
    expect(summary.failurePath.townRuleDecisionTick).toBe(0);
  });

  it("emits structured dawn-review rows for prevention containment failure and recovery", () => {
    const summary = runM4CoreVerticalSliceScenario({ seed: "4", ticks: 36_000 });
    const reasons: string[] = [];
    const rowIds = new Set<number>();
    for (const row of summary.dawnReviewRows) {
      reasons.push(row.reason);
      expect(rowIds.has(row.rowId)).toBe(false);
      rowIds.add(row.rowId);
      expect(Number.isSafeInteger(row.rowId)).toBe(true);
      expect(Number.isSafeInteger(row.branchId)).toBe(true);
      expect(Number.isSafeInteger(row.tick)).toBe(true);
      expect(Number.isSafeInteger(row.sourceKind)).toBe(true);
      expect(Number.isSafeInteger(row.sourceId)).toBe(true);
      expect(Number.isSafeInteger(row.ownerVersion)).toBe(true);
    }

    expect(reasons).toEqual(
      expect.arrayContaining([
        "m4.borrowed_shadow.activation_prevented",
        "m4.borrowed_shadow.low_risk_evidence_before_harm",
        "m4.borrowed_shadow.contained_non_combat",
        "m4.borrowed_shadow.accident_review_terminal",
        "m4.director.recovery_window_selected",
      ]),
    );
    expect(summary.invariantCounters).toMatchObject({
      preventionPathCount: 1,
      containmentPathCount: 1,
      failurePathCount: 1,
      directFactMutationByDirectorCount: 0,
      m0ToM3RegressionCount: 0,
    });
    expect(summary.invariantCounters.dawnReviewSourceRowCount).toBe(summary.dawnReviewRows.length);
  });

  it("records bounded candidate reads instead of scenario-wide scans", () => {
    const summary = runM4CoreVerticalSliceScenario({ seed: "4", ticks: 36_000 });
    expect(summary.boundedReads.lampGapVisited).toBeLessThanOrEqual(
      summary.boundedReads.lampGapCandidateCap,
    );
    expect(summary.boundedReads.chronicleEvidenceVisited).toBeLessThanOrEqual(
      summary.boundedReads.chronicleEvidenceCandidateCap,
    );
    expect(summary.boundedReads.obligationVisited).toBeLessThanOrEqual(
      summary.boundedReads.obligationScanCap,
    );
    expect(summary.boundedReads.townRuleVisited).toBeLessThanOrEqual(
      summary.boundedReads.townRuleScanCap,
    );
    expect(summary.boundedReads.crisisCandidateVisited).toBeLessThanOrEqual(
      summary.boundedReads.crisisCandidateCap,
    );
    expect(summary.boundedReads.directorVisited).toBeLessThanOrEqual(
      summary.boundedReads.directorCandidateCap,
    );
  });

  it("keeps M3 ordinary-life regression evidence unchanged", () => {
    const summary = runM4CoreVerticalSliceScenario({ seed: "4", ticks: 36_000 });
    expect(summary.m3Regression).toEqual({
      scenarioId: "m3.ordinary_life.injured_caregiver.v1",
      requestedSeed: "3",
      authoritativeScenarioSeed: "46",
      commandStreamHash: "0x226832d2",
      contentHash: "0xdfe7107e",
      finalWorldHash: "0x7eb81a69",
      readModelHash: "0x82bf87d6",
      activeM4FactCountInM3Baseline: 0,
    });
  });
});
