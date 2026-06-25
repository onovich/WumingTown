import { describe, expect, it } from "vitest";

import {
  M4_TOWN_RULE_ACTION_CONFIRM_NAME,
  M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
  M4_TOWN_RULE_ENFORCEMENT_KEEPER,
  M4_TOWN_RULE_ENFORCEMENT_NIGHT_WATCH,
  M4_TOWN_RULE_EXCEPTION_EMERGENCY,
  M4_TOWN_RULE_LEGITIMACY_CHRONICLE_CONFIRMED,
  M4_TOWN_RULE_LEGITIMACY_PLAYER_TEMPORARY,
  M4_TOWN_RULE_PENALTY_DENY_ENTRY,
  M4_TOWN_RULE_PENALTY_WARNING,
  M4_TOWN_RULE_SCOPE_RESIDENT,
  M4_TOWN_RULE_SCOPE_TRAVELER,
  M4_TOWN_RULE_STATE_RETIRED,
  M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
  M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
  createM4TownRuleStore,
  type M4TownRuleComplianceContext,
  type M4TownRuleInput,
} from "./index";

describe("M4 town rule owner store", () => {
  it("owns name-confirmation and night-knock rule facts with structured reasons", () => {
    const store = createM4TownRuleStore({
      ruleCapacity: 8,
      subjectCapacity: 8,
      regionCapacity: 4,
    });

    expect(store.registerRule(createNameConfirmationRule())).toMatchObject({
      ok: true,
      reason: "town_rule_candidates_indexed",
      ownerVersion: 1,
    });
    expect(store.registerRule(createNightKnockRule({ ruleId: 1 }))).toMatchObject({
      ok: true,
      ownerVersion: 2,
    });

    expect(store.readRule(0)).toMatchObject({
      subjectScope: M4_TOWN_RULE_SCOPE_TRAVELER,
      trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
      action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
      enforcementMethod: M4_TOWN_RULE_ENFORCEMENT_KEEPER,
      legitimacySource: M4_TOWN_RULE_LEGITIMACY_CHRONICLE_CONFIRMED,
    });
    expect(store.readRule(1)).toMatchObject({
      trigger: M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
      action: M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
      penalty: M4_TOWN_RULE_PENALTY_DENY_ENTRY,
    });
  });

  it("bounds town-rule candidate reads and removes retired rules from compliance lanes", () => {
    const store = createM4TownRuleStore({
      ruleCapacity: 8,
      subjectCapacity: 8,
      regionCapacity: 4,
    });
    for (let ruleId = 0; ruleId < 5; ruleId += 1) {
      expect(store.registerRule(createNightKnockRule({ ruleId }))).toMatchObject({ ok: true });
    }

    const output = new Uint32Array(2);
    expect(
      store.evaluateCompliance(createComplianceContext({ candidateCap: 2 }), output),
    ).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      candidateCapHit: true,
    });
    expect([...output]).toEqual([0, 1]);

    expect(store.retireRule(0)).toMatchObject({ ok: true });
    expect(store.readRule(0)).toMatchObject({ state: M4_TOWN_RULE_STATE_RETIRED });
    expect(
      store.evaluateCompliance(createComplianceContext({ candidateCap: 2 }), output),
    ).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
    });
    expect([...output]).toEqual([1, 2]);
    expect(store.createMetrics()).toMatchObject({
      activeCount: 4,
      complianceIndexedCount: 4,
    });
  });

  it("rejects invalid rule inputs and avoids hidden mechanical text state", () => {
    const store = createM4TownRuleStore({
      ruleCapacity: 4,
      subjectCapacity: 8,
      regionCapacity: 4,
    });

    expect(
      store.registerRule(createNameConfirmationRule({ timeStartTick: 20, timeEndTick: 10 })),
    ).toEqual({ ok: false, reason: "town_rule_time_window_invalid" });
    expect(store.createMetrics()).toMatchObject({
      ownerVersion: 0,
      activeCount: 0,
      complianceIndexedCount: 0,
    });

    expect(store.registerRule(createNameConfirmationRule())).toMatchObject({ ok: true });
    const rule = store.readRule(0);
    expect(Object.keys(rule ?? {})).not.toEqual(
      expect.arrayContaining(["text", "description", "mechanicalText", "presentation"]),
    );
    expect(
      store.evaluateCompliance(createComplianceContext({ tick: -1 }), new Uint32Array(2)),
    ).toEqual({ ok: false, reason: "town_rule_value_out_of_range" });
    expect(store.readRule(99)).toBeUndefined();
    expect(
      store.evaluateCompliance(createComplianceContext({ subjectId: 99 }), new Uint32Array(1)),
    ).toEqual({
      ok: false,
      reason: "town_rule_id_out_of_range",
    });
    expect(store.readRule(0)).toMatchObject({ ownerVersion: 1 });
  });
});

function createNameConfirmationRule(overrides: Partial<M4TownRuleInput> = {}): M4TownRuleInput {
  return {
    ruleId: 0,
    subjectScope: M4_TOWN_RULE_SCOPE_TRAVELER,
    timeStartTick: 0,
    timeEndTick: 10_000,
    regionId: 1,
    trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
    action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
    exception: 0,
    enforcementMethod: M4_TOWN_RULE_ENFORCEMENT_KEEPER,
    enforcementCost: 0,
    legitimacySource: M4_TOWN_RULE_LEGITIMACY_CHRONICLE_CONFIRMED,
    penalty: M4_TOWN_RULE_PENALTY_WARNING,
    ...overrides,
  };
}

function createNightKnockRule(overrides: Partial<M4TownRuleInput> = {}): M4TownRuleInput {
  return {
    ruleId: 0,
    subjectScope: M4_TOWN_RULE_SCOPE_RESIDENT,
    timeStartTick: 0,
    timeEndTick: 10_000,
    regionId: 1,
    trigger: M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
    action: M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
    exception: M4_TOWN_RULE_EXCEPTION_EMERGENCY,
    enforcementMethod: M4_TOWN_RULE_ENFORCEMENT_NIGHT_WATCH,
    enforcementCost: 0,
    legitimacySource: M4_TOWN_RULE_LEGITIMACY_PLAYER_TEMPORARY,
    penalty: M4_TOWN_RULE_PENALTY_DENY_ENTRY,
    ...overrides,
  };
}

function createComplianceContext(
  overrides: Partial<M4TownRuleComplianceContext> = {},
): M4TownRuleComplianceContext {
  return {
    subjectId: M4_TOWN_RULE_SCOPE_RESIDENT,
    regionId: 1,
    trigger: M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
    action: M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
    tick: 200,
    knowsRule: 1,
    needPressure: 0,
    relationshipPressure: 0,
    fear: 0,
    enforcementRisk: 800,
    emergency: 0,
    confirmedIdentity: 0,
    obligationPressure: 0,
    candidateCap: 2,
    scanCap: 2,
    ...overrides,
  };
}
