import { describe, expect, it } from "vitest";

import {
  M4_OBLIGATION_ACTION_DELIVER_OIL,
  M4_OBLIGATION_ACTION_GIVE_TESTIMONY,
  M4_OBLIGATION_CONDITION_LAMP_OIL_DUTY,
  M4_OBLIGATION_CONDITION_LODGING_WITNESS_DUTY,
  M4_OBLIGATION_INHERITANCE_PERSONAL,
  M4_OBLIGATION_INHERITANCE_ROLE,
  M4_OBLIGATION_TYPE_MATERIAL,
  M4_OBLIGATION_TYPE_WITNESS,
  M4_OBLIGATION_VIOLATION_EVIDENCE_WITHHELD,
  M4_OBLIGATION_VIOLATION_LAMP_GAP_RISK,
  M4_OBLIGATION_VISIBILITY_PUBLIC,
  M4_OBLIGATION_VISIBILITY_ROLE,
  M4_TOWN_RULE_ACTION_CONFIRM_NAME,
  M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
  M4_TOWN_RULE_ENFORCEMENT_NIGHT_WATCH,
  M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY,
  M4_TOWN_RULE_EXCEPTION_EMERGENCY,
  M4_TOWN_RULE_LEGITIMACY_PLAYER_TEMPORARY,
  M4_TOWN_RULE_PENALTY_DENY_ENTRY,
  M4_TOWN_RULE_SCOPE_RESIDENT,
  M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
  M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
  createM4ObligationStore,
  createM4TownRuleStore,
  type M4ObligationInput,
  type M4TownRuleComplianceContext,
  type M4TownRuleInput,
} from "./index";

describe("M4 town rule compliance", () => {
  it("evaluates compliance exceptions, enforcement costs and numeric context lanes", () => {
    const store = createM4TownRuleStore({
      ruleCapacity: 4,
      subjectCapacity: 8,
      regionCapacity: 4,
    });
    expect(store.registerRule(createNightKnockRule({ enforcementCost: 7 }))).toMatchObject({
      ok: true,
    });
    const output = new Uint32Array(2);

    expect(store.evaluateCompliance(createComplianceContext(), output)).toMatchObject({
      ok: true,
      selectedCount: 1,
      selectedRuleId: 0,
      enforcementCost: 7,
      reason: "town_rule_enforcement_cost_applied",
    });
    expect(store.createMetrics()).toMatchObject({ enforcementCostTotal: 7 });

    expect(
      store.evaluateCompliance(createComplianceContext({ knowsRule: 0 }), output),
    ).toMatchObject({
      ok: true,
      reason: "town_rule_rejected_unknown",
      enforcementCost: 0,
    });
    expect(
      store.evaluateCompliance(createComplianceContext({ emergency: 1 }), output),
    ).toMatchObject({
      ok: true,
      reason: "town_rule_rejected_emergency_exception",
    });
    expect(
      store.evaluateCompliance(createComplianceContext({ emergency: 1, trigger: 99 }), output),
    ).toEqual({ ok: false, reason: "town_rule_id_out_of_range" });
    expect(
      store.evaluateCompliance(createComplianceContext({ needPressure: 900 }), output),
    ).toMatchObject({ ok: true, reason: "town_rule_rejected_need" });
    expect(
      store.evaluateCompliance(createComplianceContext({ relationshipPressure: 900 }), output),
    ).toMatchObject({ ok: true, reason: "town_rule_rejected_relationship" });
    expect(
      store.evaluateCompliance(
        createComplianceContext({ fear: 900, enforcementRisk: 100 }),
        output,
      ),
    ).toMatchObject({ ok: true, reason: "town_rule_rejected_fear" });
  });

  it("selects only matching trigger/action rules in the same subject region and time bucket", () => {
    const store = createM4TownRuleStore({
      ruleCapacity: 4,
      subjectCapacity: 8,
      regionCapacity: 4,
    });
    expect(
      store.registerRule(
        createNightKnockRule({
          ruleId: 0,
          trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
          action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(store.registerRule(createNightKnockRule({ ruleId: 1 }))).toMatchObject({
      ok: true,
    });

    const output = new Uint32Array(1);
    expect(
      store.evaluateCompliance(
        createComplianceContext({
          trigger: M4_TOWN_RULE_TRIGGER_THIRD_NIGHT_KNOCK,
          action: M4_TOWN_RULE_ACTION_DO_NOT_ANSWER_KNOCK,
          candidateCap: 1,
          scanCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 1,
      candidateCapHit: false,
      selectedRuleId: 1,
    });
    expect([...output]).toEqual([1]);

    expect(
      store.evaluateCompliance(
        createComplianceContext({
          trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
          action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
          candidateCap: 1,
          scanCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 1,
      candidateCapHit: false,
      selectedRuleId: 0,
    });
    expect([...output]).toEqual([0]);
  });

  it("honors stored exception lanes instead of context alone", () => {
    const store = createM4TownRuleStore({
      ruleCapacity: 4,
      subjectCapacity: 8,
      regionCapacity: 4,
    });
    expect(store.registerRule(createNightKnockRule({ ruleId: 0, exception: 0 }))).toMatchObject({
      ok: true,
    });
    expect(
      store.registerRule(
        createNightKnockRule({
          ruleId: 1,
          action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
          exception: M4_TOWN_RULE_EXCEPTION_EMERGENCY,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerRule(
        createNightKnockRule({
          ruleId: 2,
          action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
          trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
          exception: M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY,
        }),
      ),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(1);
    expect(
      store.evaluateCompliance(createComplianceContext({ emergency: 1, candidateCap: 1 }), output),
    ).toMatchObject({
      ok: true,
      selectedRuleId: 0,
      reason: "town_rule_compliance_allowed",
    });
    expect(
      store.evaluateCompliance(
        createComplianceContext({
          action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
          emergency: 1,
          candidateCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedRuleId: 1,
      reason: "town_rule_rejected_emergency_exception",
    });
    expect(
      store.evaluateCompliance(
        createComplianceContext({
          trigger: M4_TOWN_RULE_TRIGGER_NAME_CONFIRMATION,
          action: M4_TOWN_RULE_ACTION_CONFIRM_NAME,
          confirmedIdentity: 1,
          candidateCap: 1,
        }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedRuleId: 2,
      reason: "town_rule_rejected_confirmed_identity_exception",
    });
  });

  it("does not let out-of-time rules consume the compliance candidate cap", () => {
    const store = createM4TownRuleStore({
      ruleCapacity: 4,
      subjectCapacity: 8,
      regionCapacity: 4,
    });
    expect(
      store.registerRule(createNightKnockRule({ ruleId: 0, timeStartTick: 0, timeEndTick: 50 })),
    ).toMatchObject({ ok: true });
    expect(
      store.registerRule(createNightKnockRule({ ruleId: 1, timeStartTick: 100, timeEndTick: 300 })),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(1);
    expect(
      store.evaluateCompliance(
        createComplianceContext({ tick: 200, candidateCap: 1, scanCap: 2 }),
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 2,
      candidateCapHit: false,
      scanCapHit: false,
      selectedRuleId: 1,
    });
    expect([...output]).toEqual([1]);
  });

  it("uses bounded obligation facts as explicit compliance context", () => {
    const obligations = createM4ObligationStore({ obligationCapacity: 4, actorCapacity: 8 });
    const rules = createM4TownRuleStore({
      ruleCapacity: 4,
      subjectCapacity: 8,
      regionCapacity: 4,
    });
    expect(obligations.registerObligation(createLodgingWitnessDuty())).toMatchObject({
      ok: true,
    });
    expect(obligations.registerObligation(createLampOilDuty({ obligationId: 1 }))).toMatchObject({
      ok: true,
    });
    expect(rules.registerRule(createNightKnockRule())).toMatchObject({ ok: true });

    const dueOutput = new Uint32Array(1);
    const due = obligations.queryDueObligations(
      { debtorId: 2, windowStartTick: 100, windowEndTick: 200, candidateCap: 1, scanCap: 2 },
      dueOutput,
    );
    expect(due).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 1,
      candidateCapHit: true,
    });

    const complianceOutput = new Uint32Array(2);
    expect(
      rules.evaluateCompliance(
        createComplianceContext({ obligationPressure: due.ok ? due.selectedCount * 1_000 : 0 }),
        complianceOutput,
      ),
    ).toMatchObject({
      ok: true,
      visitedCount: 1,
      reason: "town_rule_rejected_obligation_pressure",
    });
  });
});

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

function createLampOilDuty(overrides: Partial<M4ObligationInput> = {}): M4ObligationInput {
  return {
    obligationId: 0,
    creditorId: 1,
    debtorId: 2,
    obligationType: M4_OBLIGATION_TYPE_MATERIAL,
    condition: M4_OBLIGATION_CONDITION_LAMP_OIL_DUTY,
    dueStartTick: 100,
    dueEndTick: 200,
    visibility: M4_OBLIGATION_VISIBILITY_ROLE,
    inheritanceBasis: M4_OBLIGATION_INHERITANCE_ROLE,
    fulfillmentAction: M4_OBLIGATION_ACTION_DELIVER_OIL,
    violationConsequence: M4_OBLIGATION_VIOLATION_LAMP_GAP_RISK,
    sourceEventId: 700,
    ...overrides,
  };
}

function createLodgingWitnessDuty(overrides: Partial<M4ObligationInput> = {}): M4ObligationInput {
  return {
    obligationId: 0,
    creditorId: 3,
    debtorId: 2,
    obligationType: M4_OBLIGATION_TYPE_WITNESS,
    condition: M4_OBLIGATION_CONDITION_LODGING_WITNESS_DUTY,
    dueStartTick: 120,
    dueEndTick: 220,
    visibility: M4_OBLIGATION_VISIBILITY_PUBLIC,
    inheritanceBasis: M4_OBLIGATION_INHERITANCE_PERSONAL,
    fulfillmentAction: M4_OBLIGATION_ACTION_GIVE_TESTIMONY,
    violationConsequence: M4_OBLIGATION_VIOLATION_EVIDENCE_WITHHELD,
    sourceEventId: 701,
    ...overrides,
  };
}
