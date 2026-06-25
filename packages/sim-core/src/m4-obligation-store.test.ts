import { describe, expect, it } from "vitest";

import {
  M4_OBLIGATION_ACTION_CONFIRM_NAME,
  M4_OBLIGATION_ACTION_DELIVER_OIL,
  M4_OBLIGATION_ACTION_GIVE_TESTIMONY,
  M4_OBLIGATION_CONDITION_LAMP_OIL_DUTY,
  M4_OBLIGATION_CONDITION_LODGING_WITNESS_DUTY,
  M4_OBLIGATION_CONDITION_NAME_CONFIRMATION,
  M4_OBLIGATION_INHERITANCE_PERSONAL,
  M4_OBLIGATION_INHERITANCE_ROLE,
  M4_OBLIGATION_STATE_FULFILLED,
  M4_OBLIGATION_STATE_VIOLATED,
  M4_OBLIGATION_TYPE_IDENTITY,
  M4_OBLIGATION_TYPE_MATERIAL,
  M4_OBLIGATION_TYPE_WITNESS,
  M4_OBLIGATION_VIOLATION_EVIDENCE_WITHHELD,
  M4_OBLIGATION_VIOLATION_IDENTITY_UNCONFIRMED,
  M4_OBLIGATION_VIOLATION_LAMP_GAP_RISK,
  M4_OBLIGATION_VISIBILITY_PUBLIC,
  M4_OBLIGATION_VISIBILITY_ROLE,
  createM4ObligationStore,
  type M4ObligationInput,
} from "./index";

describe("M4 obligation owner store", () => {
  it("owns explicit obligation facts and cleans due indexes on terminal states", () => {
    const store = createM4ObligationStore({ obligationCapacity: 8, actorCapacity: 8 });

    expect(store.registerObligation(createLampOilDuty())).toMatchObject({
      ok: true,
      reason: "obligation_due_candidates_indexed",
      ownerVersion: 1,
    });
    expect(
      store.registerObligation(createLodgingWitnessDuty({ obligationId: 1, debtorId: 3 })),
    ).toMatchObject({
      ok: true,
      ownerVersion: 2,
    });

    expect(store.readObligation(0)).toMatchObject({
      creditorId: 1,
      debtorId: 2,
      obligationType: M4_OBLIGATION_TYPE_MATERIAL,
      condition: M4_OBLIGATION_CONDITION_LAMP_OIL_DUTY,
      fulfillmentAction: M4_OBLIGATION_ACTION_DELIVER_OIL,
      violationConsequence: M4_OBLIGATION_VIOLATION_LAMP_GAP_RISK,
      sourceEventId: 700,
      ownerVersion: 2,
    });
    expect(store.readObligation(1)).toMatchObject({
      condition: M4_OBLIGATION_CONDITION_LODGING_WITNESS_DUTY,
      fulfillmentAction: M4_OBLIGATION_ACTION_GIVE_TESTIMONY,
    });

    const dueForLampkeeper = new Uint32Array(4);
    expect(
      store.queryDueObligations(
        { debtorId: 2, windowStartTick: 80, windowEndTick: 160, candidateCap: 4, scanCap: 4 },
        dueForLampkeeper,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 1,
      reason: "obligation_due_candidates_indexed",
    });
    expect([...dueForLampkeeper.slice(0, 1)]).toEqual([0]);

    expect(store.fulfillObligation(0, 140)).toMatchObject({
      ok: true,
      reason: "obligation_fulfilled",
    });
    expect(store.violateObligation(1, 190)).toMatchObject({
      ok: true,
      reason: "obligation_violated",
    });
    expect(store.readObligation(0)).toMatchObject({
      state: M4_OBLIGATION_STATE_FULFILLED,
      fulfilledTick: 140,
    });
    expect(store.readObligation(1)).toMatchObject({
      state: M4_OBLIGATION_STATE_VIOLATED,
      violatedTick: 190,
    });

    expect(
      store.queryDueObligations(
        { debtorId: 2, windowStartTick: 80, windowEndTick: 200, candidateCap: 4, scanCap: 4 },
        dueForLampkeeper,
      ),
    ).toMatchObject({ ok: true, selectedCount: 0, reason: "obligation_due_no_candidate" });
    expect(store.createMetrics()).toMatchObject({
      activeCount: 0,
      dueIndexedCount: 0,
      fulfilledCount: 1,
      violatedCount: 1,
    });
  });

  it("rejects invalid mutations before publishing counts, versions or due lanes", () => {
    const store = createM4ObligationStore({ obligationCapacity: 4, actorCapacity: 4 });

    expect(
      store.registerObligation(createLampOilDuty({ dueStartTick: 200, dueEndTick: 100 })),
    ).toEqual({ ok: false, reason: "obligation_due_window_invalid" });
    expect(store.createMetrics()).toMatchObject({
      ownerVersion: 0,
      activeCount: 0,
      dueIndexedCount: 0,
    });

    expect(store.registerObligation(createLampOilDuty())).toMatchObject({ ok: true });
    const before = store.createMetrics();
    expect(store.fulfillObligation(0, -1)).toEqual({
      ok: false,
      reason: "obligation_value_out_of_range",
    });
    expect(store.registerObligation(createLampOilDuty())).toEqual({
      ok: false,
      reason: "obligation_already_registered",
    });
    expect(store.createMetrics()).toEqual(before);
    expect(store.readObligation(0)).toMatchObject({
      state: 1,
      ownerVersion: before.ownerVersion,
    });
  });

  it("returns due candidates through caller caps in stable due order", () => {
    const store = createM4ObligationStore({ obligationCapacity: 8, actorCapacity: 4 });
    for (let obligationId = 0; obligationId < 6; obligationId += 1) {
      expect(
        store.registerObligation(
          createLodgingWitnessDuty({
            obligationId,
            debtorId: 2,
            dueStartTick: 10,
            dueEndTick: 100 - obligationId,
          }),
        ),
      ).toMatchObject({ ok: true });
    }

    const output = new Uint32Array(3);
    expect(
      store.queryDueObligations(
        { debtorId: 2, windowStartTick: 0, windowEndTick: 120, candidateCap: 3, scanCap: 3 },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 3,
      visitedCount: 3,
      candidateCapHit: true,
      reason: "obligation_due_candidate_cap_reached",
    });
    expect([...output]).toEqual([5, 4, 3]);
    expect(store.getActiveDueCountForActor(2, 2)).toBe(2);
    expect(store.createMetrics()).toMatchObject({ lastDueCandidateVisits: 3 });
  });

  it("reports bounded scans when earlier non-overlapping due rows precede a tail match", () => {
    const store = createM4ObligationStore({ obligationCapacity: 16, actorCapacity: 4 });
    for (let obligationId = 0; obligationId < 10; obligationId += 1) {
      expect(
        store.registerObligation(
          createLampOilDuty({
            obligationId,
            dueStartTick: obligationId,
            dueEndTick: 10 + obligationId,
          }),
        ),
      ).toMatchObject({ ok: true });
    }
    expect(
      store.registerObligation(
        createLampOilDuty({ obligationId: 10, dueStartTick: 90, dueEndTick: 150 }),
      ),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(1);
    expect(
      store.queryDueObligations(
        { debtorId: 2, windowStartTick: 100, windowEndTick: 120, candidateCap: 1, scanCap: 4 },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 0,
      visitedCount: 4,
      scanCapHit: true,
      reason: "obligation_due_scan_cap_reached",
    });
    expect([...output]).toEqual([0xffff_ffff]);
    expect(store.createMetrics()).toMatchObject({ lastDueCandidateVisits: 4 });

    expect(
      store.queryDueObligations(
        { debtorId: 2, windowStartTick: 100, windowEndTick: 120, candidateCap: 1, scanCap: 16 },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 1,
      visitedCount: 11,
      candidateCapHit: false,
      scanCapHit: false,
      reason: "obligation_due_candidates_indexed",
    });
    expect([...output]).toEqual([10]);
    expect(store.createMetrics()).toMatchObject({ lastDueCandidateVisits: 11 });
  });

  it("reports incomplete no-match due reads when scan cap is exhausted", () => {
    const store = createM4ObligationStore({ obligationCapacity: 16, actorCapacity: 4 });
    for (let obligationId = 0; obligationId < 12; obligationId += 1) {
      expect(
        store.registerObligation(
          createLampOilDuty({
            obligationId,
            dueStartTick: obligationId,
            dueEndTick: 20 + obligationId,
          }),
        ),
      ).toMatchObject({ ok: true });
    }

    const output = new Uint32Array(2);
    expect(
      store.queryDueObligations(
        { debtorId: 2, windowStartTick: 300, windowEndTick: 320, candidateCap: 2, scanCap: 5 },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCount: 0,
      visitedCount: 5,
      scanCapHit: true,
      reason: "obligation_due_scan_cap_reached",
    });
    expect(store.createMetrics()).toMatchObject({ lastDueCandidateVisits: 5 });
  });

  it("represents name confirmation obligations as numeric facts without prose payloads", () => {
    const store = createM4ObligationStore({ obligationCapacity: 2, actorCapacity: 4 });
    expect(store.registerObligation(createNameConfirmationObligation())).toMatchObject({
      ok: true,
    });

    const obligation = store.readObligation(0);
    expect(obligation).toMatchObject({
      obligationType: M4_OBLIGATION_TYPE_IDENTITY,
      condition: M4_OBLIGATION_CONDITION_NAME_CONFIRMATION,
      fulfillmentAction: M4_OBLIGATION_ACTION_CONFIRM_NAME,
      violationConsequence: M4_OBLIGATION_VIOLATION_IDENTITY_UNCONFIRMED,
    });
    expect(Object.keys(obligation ?? {})).not.toEqual(
      expect.arrayContaining(["text", "description", "mechanicalText", "prose"]),
    );
  });
});

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

function createNameConfirmationObligation(
  overrides: Partial<M4ObligationInput> = {},
): M4ObligationInput {
  return {
    obligationId: 0,
    creditorId: 1,
    debtorId: 2,
    obligationType: M4_OBLIGATION_TYPE_IDENTITY,
    condition: M4_OBLIGATION_CONDITION_NAME_CONFIRMATION,
    dueStartTick: 20,
    dueEndTick: 80,
    visibility: M4_OBLIGATION_VISIBILITY_PUBLIC,
    inheritanceBasis: M4_OBLIGATION_INHERITANCE_PERSONAL,
    fulfillmentAction: M4_OBLIGATION_ACTION_CONFIRM_NAME,
    violationConsequence: M4_OBLIGATION_VIOLATION_IDENTITY_UNCONFIRMED,
    sourceEventId: 702,
    ...overrides,
  };
}
