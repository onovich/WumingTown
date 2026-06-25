import { describe, expect, it } from "vitest";

import {
  M4_DIRECTOR_CANDIDATE_INCIDENT,
  M4_DIRECTOR_CANDIDATE_RECOVERY,
  M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
  M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT,
  M4_DIRECTOR_NONE,
  M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
  M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
  M4_DIRECTOR_RECOVERY_NONE,
  M4_DIRECTOR_RECOVERY_REST_CARE,
  M4_DIRECTOR_THEME_CRISIS,
  M4_DIRECTOR_THEME_EVIDENCE,
  M4_DIRECTOR_THEME_LAMP,
  createM4DirectorPressureStore,
  createNamedRandomStreams,
  type M4DirectorCandidateInput,
  type M4DirectorPressureSampleInput,
} from "./index";

describe("M4 director pressure and recovery store", () => {
  it("samples aggregate pressure without owning source facts", () => {
    const store = createM4DirectorPressureStore({
      sampleCapacity: 4,
      candidateCapacity: 8,
      cooldownCapacity: 8,
      recoveryWindowCapacity: 4,
      traceCapacity: 8,
    });
    expect(store.recordPressureSample(createPressureSample())).toMatchObject({
      ok: true,
      reason: "director_pressure_sampled",
    });

    expect(store.readLatestPressureSample()).toMatchObject({
      tick: 100,
      lampOwnerVersion: 11,
      evidenceOwnerVersion: 12,
      obligationOwnerVersion: 13,
      crisisOwnerVersion: 14,
      healthOwnerVersion: 15,
      relationshipOwnerVersion: 16,
      caseOwnerVersion: 17,
      lampPressure: 200,
      evidencePressure: 100,
      obligationPressure: 90,
      crisisPressure: 300,
      injuryPressure: 50,
      mentalRiskPressure: 40,
      unresolvedCasePressure: 30,
      totalPressure: 810,
    });
    expect(store.createMetrics()).toMatchObject({
      pressureSampleCount: 1,
      ownerVersion: 1,
    });
  });

  it("uses bounded incident candidates, stable ordering and named random streams", () => {
    const first = createStore();
    const second = createStore();
    registerIncidentSet(first);
    registerIncidentSet(second);
    const firstStreams = createNamedRandomStreams({ seed: "director-test" });
    const secondStreams = createNamedRandomStreams({ seed: "director-test" });
    const firstOutput = new Uint32Array(2);
    const secondOutput = new Uint32Array(2);

    const firstResult = first.selectOpportunity(
      {
        tick: 110,
        candidateCap: 2,
        selectedCap: 2,
        streamName: "m4.director",
        randomStreams: firstStreams,
      },
      firstOutput,
    );
    const secondResult = second.selectOpportunity(
      {
        tick: 110,
        candidateCap: 2,
        selectedCap: 2,
        streamName: "m4.director",
        randomStreams: secondStreams,
      },
      secondOutput,
    );

    expect(firstResult).toMatchObject({
      ok: true,
      selectedCount: 2,
      visitedCount: 2,
      candidateCapHit: true,
      reason: "director_incident_selected",
      selectedCommandKind: M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT,
    });
    expect([...firstOutput]).toEqual([1, 2]);
    expect(secondResult).toEqual(firstResult);
    expect([...secondOutput]).toEqual([...firstOutput]);
    expect(firstStreams.snapshot().streams).toEqual(secondStreams.snapshot().streams);
    expect(first.createMetrics()).toMatchObject({
      lastCandidateVisits: 2,
      totalCandidateVisits: 2,
      selectionCount: 1,
    });
  });

  it("applies cooldowns with structured rejection reasons", () => {
    const store = createStore();
    registerIncidentSet(store);
    const output = new Uint32Array(1);
    const streams = createNamedRandomStreams({ seed: "cooldown" });

    expect(
      store.selectOpportunity(
        {
          tick: 110,
          candidateCap: 1,
          selectedCap: 1,
          streamName: "m4.director",
          randomStreams: streams,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCandidateId: 1,
      reason: "director_incident_selected",
    });
    expect(
      store.selectOpportunity(
        {
          tick: 111,
          candidateCap: 1,
          selectedCap: 1,
          streamName: "m4.director",
          randomStreams: streams,
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCandidateId: M4_DIRECTOR_NONE,
      rejectedCooldownCount: 1,
      reason: "director_cooldown_active",
    });
    expect(store.createMetrics()).toMatchObject({ cooldownWriteCount: 1 });
  });

  it("recovery windows suppress incidents and expose repair opportunities only", () => {
    const store = createStore();
    registerIncidentSet(store);
    expect(store.registerCandidate(createRecoveryCandidate({ candidateId: 4 }))).toMatchObject({
      ok: true,
    });
    expect(
      store.openRecoveryWindow({
        windowId: 0,
        recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
        startTick: 120,
        endTick: 180,
        sourceSampleVersion: 1,
      }),
    ).toMatchObject({ ok: true, reason: "director_recovery_window_opened" });
    const output = new Uint32Array(2);
    const result = store.selectOpportunity(
      {
        tick: 130,
        candidateCap: 2,
        selectedCap: 2,
        streamName: "m4.recovery",
        randomStreams: createNamedRandomStreams({ seed: "recovery" }),
      },
      output,
    );

    expect(result).toMatchObject({
      ok: true,
      recoveryWindowActive: true,
      selectedCandidateId: 4,
      selectedCommandKind: M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
      selectedRecoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
      reason: "director_recovery_selected",
    });
    expect([...output]).toEqual([4, M4_DIRECTOR_NONE]);
    expect(store.readCandidate(4)).toMatchObject({
      commandKind: M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
      commandTargetId: 900,
    });
    expect(store.createMetrics()).toMatchObject({
      recoveryWindowCount: 1,
      activeRecoveryWindowId: 0,
    });
    expect(store.isRecoveryWindowActive(0, 130)).toBe(true);
  });

  it("filters recovery opportunities by the active recovery window type", () => {
    const store = createStore();
    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 4,
          score: 600,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 5,
          theme: M4_DIRECTOR_THEME_EVIDENCE,
          recoveryType: M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
          score: 1_000,
          commandKind: M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      store.openRecoveryWindow({
        windowId: 0,
        recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
        startTick: 120,
        endTick: 180,
        sourceSampleVersion: 1,
      }),
    ).toMatchObject({ ok: true });

    const output = new Uint32Array(1);
    expect(
      store.selectOpportunity(
        {
          tick: 130,
          candidateCap: 1,
          selectedCap: 1,
          streamName: "m4.recovery",
          randomStreams: createNamedRandomStreams({ seed: "type-filter" }),
        },
        output,
      ),
    ).toMatchObject({
      ok: true,
      selectedCandidateId: 4,
      selectedCommandKind: M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
      selectedRecoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
      visitedCount: 1,
      candidateCapHit: false,
      reason: "director_recovery_selected",
    });
    expect([...output]).toEqual([4]);
  });

  it("rejects duplicate recovery-window opens without overwriting rows or metrics", () => {
    const store = createStore();
    const first = {
      windowId: 0,
      recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
      startTick: 120,
      endTick: 180,
      sourceSampleVersion: 1,
    };
    expect(store.openRecoveryWindow(first)).toMatchObject({ ok: true });
    const before = store.readRecoveryWindow(0);
    expect(
      store.openRecoveryWindow({
        windowId: 0,
        recoveryType: M4_DIRECTOR_RECOVERY_REST_CARE,
        startTick: 140,
        endTick: 220,
        sourceSampleVersion: 2,
      }),
    ).toEqual({ ok: false, reason: "director_recovery_window_already_open" });
    expect(store.readRecoveryWindow(0)).toEqual(before);
    expect(store.createMetrics()).toMatchObject({
      recoveryWindowCount: 1,
      activeRecoveryWindowId: 0,
    });
  });

  it("does not report expired recovery windows active and resumes incident selection", () => {
    const store = createStore();
    registerIncidentSet(store);
    expect(store.registerCandidate(createRecoveryCandidate({ candidateId: 4 }))).toMatchObject({
      ok: true,
    });
    expect(
      store.openRecoveryWindow({
        windowId: 0,
        recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
        startTick: 120,
        endTick: 180,
        sourceSampleVersion: 1,
      }),
    ).toMatchObject({ ok: true });

    expect(store.readRecoveryWindow(0)).toMatchObject({ active: 0 });
    expect(store.isRecoveryWindowActive(0, 130)).toBe(true);
    expect(store.isRecoveryWindowActive(0, 181)).toBe(false);
    expect(
      store.selectOpportunity(
        {
          tick: 181,
          candidateCap: 2,
          selectedCap: 2,
          streamName: "m4.director",
          randomStreams: createNamedRandomStreams({ seed: "expired" }),
        },
        new Uint32Array(2),
      ),
    ).toMatchObject({
      ok: true,
      recoveryWindowActive: false,
      selectedCommandKind: M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT,
      reason: "director_incident_selected",
    });
  });

  it("does not expose direct owner-fact mutation commands", () => {
    const store = createStore();
    expect(
      store.registerCandidate(
        createIncidentCandidate({
          candidateId: 6,
          commandKind: M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
        }),
      ),
    ).toEqual({ ok: false, reason: "director_value_out_of_range" });
    expect(
      store.registerCandidate(
        createRecoveryCandidate({
          candidateId: 7,
          recoveryType: M4_DIRECTOR_RECOVERY_EVIDENCE_REVIEW,
          commandKind: M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(store.readCandidate(7)).toMatchObject({
      commandKind: M4_DIRECTOR_COMMAND_EVIDENCE_REVIEW_OPPORTUNITY,
      commandTargetId: 900,
    });
    expect(store.createMetrics()).toMatchObject({
      activeIncidentCandidateCount: 0,
      activeRecoveryCandidateCount: 1,
    });
  });

  it("records replay-shaped numeric traces and stable descriptors", () => {
    const store = createStore();
    registerIncidentSet(store);
    const result = store.selectOpportunity(
      {
        tick: 110,
        candidateCap: 2,
        selectedCap: 2,
        streamName: "m4.director",
        randomStreams: createNamedRandomStreams({ seed: "trace" }),
      },
      new Uint32Array(2),
    );
    expect(result).toMatchObject({ ok: true });
    const trace = store.readTrace(0);
    expect(trace).toMatchObject({
      tick: 110,
      visitedCount: 2,
      selectedCount: 2,
      candidateCap: 2,
      selectedCap: 2,
      recoveryWindowActive: 0,
      reason: "director_incident_selected",
    });
    if (trace === undefined) throw new Error("expected trace");
    for (const value of Object.values(trace)) {
      if (typeof value === "number") expect(Number.isSafeInteger(value)).toBe(true);
    }
  });
});

function createStore(): ReturnType<typeof createM4DirectorPressureStore> {
  const store = createM4DirectorPressureStore({
    sampleCapacity: 4,
    candidateCapacity: 8,
    cooldownCapacity: 8,
    recoveryWindowCapacity: 4,
    traceCapacity: 8,
  });
  expect(store.recordPressureSample(createPressureSample())).toMatchObject({ ok: true });
  return store;
}

function registerIncidentSet(store: ReturnType<typeof createM4DirectorPressureStore>): void {
  expect(
    store.registerCandidate(createIncidentCandidate({ candidateId: 0, score: 500 })),
  ).toMatchObject({ ok: true });
  expect(
    store.registerCandidate(createIncidentCandidate({ candidateId: 1, score: 900 })),
  ).toMatchObject({ ok: true });
  expect(
    store.registerCandidate(createIncidentCandidate({ candidateId: 2, score: 700 })),
  ).toMatchObject({ ok: true });
}

function createPressureSample(
  overrides: Partial<M4DirectorPressureSampleInput> = {},
): M4DirectorPressureSampleInput {
  return {
    tick: 100,
    lampOwnerVersion: 11,
    evidenceOwnerVersion: 12,
    obligationOwnerVersion: 13,
    crisisOwnerVersion: 14,
    healthOwnerVersion: 15,
    relationshipOwnerVersion: 16,
    caseOwnerVersion: 17,
    lampPressure: 200,
    evidencePressure: 100,
    obligationPressure: 90,
    crisisPressure: 300,
    injuryPressure: 50,
    mentalRiskPressure: 40,
    unresolvedCasePressure: 30,
    ...overrides,
  };
}

function createIncidentCandidate(
  overrides: Partial<M4DirectorCandidateInput> = {},
): M4DirectorCandidateInput {
  return {
    candidateId: 0,
    candidateKind: M4_DIRECTOR_CANDIDATE_INCIDENT,
    theme: M4_DIRECTOR_THEME_CRISIS,
    recoveryType: M4_DIRECTOR_RECOVERY_NONE,
    score: 600,
    priority: 2,
    pressureMin: 300,
    cooldownKey: 1,
    cooldownTicks: 20,
    commandKind: M4_DIRECTOR_COMMAND_SCHEDULE_INCIDENT,
    commandTargetId: 800,
    sourceOwnerVersion: 20,
    availableTick: 100,
    expiresTick: 200,
    ...overrides,
  };
}

function createRecoveryCandidate(
  overrides: Partial<M4DirectorCandidateInput> = {},
): M4DirectorCandidateInput {
  return {
    candidateId: 4,
    candidateKind: M4_DIRECTOR_CANDIDATE_RECOVERY,
    theme: M4_DIRECTOR_THEME_LAMP,
    recoveryType: M4_DIRECTOR_RECOVERY_LAMP_REPAIR,
    score: 900,
    priority: 2,
    pressureMin: 0,
    cooldownKey: M4_DIRECTOR_NONE,
    cooldownTicks: 0,
    commandKind: M4_DIRECTOR_COMMAND_LAMP_REPAIR_OPPORTUNITY,
    commandTargetId: 900,
    sourceOwnerVersion: 21,
    availableTick: 100,
    expiresTick: 200,
    ...overrides,
  };
}
