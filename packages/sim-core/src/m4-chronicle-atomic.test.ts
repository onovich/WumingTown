import { describe, expect, it } from "vitest";

import {
  M4_CONTRADICTION_SEVERITY_FATAL,
  M4_EVIDENCE_CLASS_OBSERVATION,
  M4_EVIDENCE_CLASS_SOURCE,
  M4_EVIDENCE_CLASS_TESTIMONY,
  M4_EVIDENCE_CLASS_TRACE,
  M4_EVIDENCE_SOURCE_ARCHIVE,
  M4_EVIDENCE_SOURCE_PERSON,
  M4_EVIDENCE_SOURCE_SCENE,
  M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
  createM4ChronicleCaseFileStore,
  createM4EvidenceFactStore,
  createM4EvidenceReasonTraceStore,
  createM4KnowledgeDisseminationStore,
  type M4ChronicleVersionRecorder,
  type M4EvidenceFactStore,
  type M4EvidenceRowInput,
} from "./index";

describe("M4 Chronicle atomic owner mutations", () => {
  it("keeps case open and close atomic when version history is full", () => {
    const cases = createM4ChronicleCaseFileStore({ caseCapacity: 3, versionCapacity: 1 });
    expect(
      cases.openCase({ caseId: 0, openedTick: 1, ownerActorId: 1, primarySubjectId: 10 }),
    ).toMatchObject({ ok: true });

    expect(
      cases.openCase({ caseId: 1, openedTick: 2, ownerActorId: 1, primarySubjectId: 11 }),
    ).toEqual({ ok: false, reason: "chronicle_version_capacity_full" });
    expect(cases.readCase(1)).toBeUndefined();
    expect(cases.createMetrics()).toMatchObject({ activeCaseCount: 1, versionCount: 1 });

    expect(cases.closeCase(0, 3)).toEqual({
      ok: false,
      reason: "chronicle_version_capacity_full",
    });
    expect(cases.readCase(0)).toMatchObject({ status: 1, caseVersion: 1 });
  });

  it("keeps evidence owner mutations atomic when Chronicle recording fails", () => {
    const failing = createFailingRecorder();
    const sourceFailure = createChronicleFixture();
    expect(
      sourceFailure.evidence.registerSource(
        {
          sourceId: 1,
          caseId: 1,
          kind: M4_EVIDENCE_SOURCE_PERSON,
          reliability: 500,
          conflictOfInterest: 0,
          tick: 50,
        },
        failing,
      ),
    ).toEqual({ ok: false, reason: "chronicle_version_capacity_full" });
    expect(sourceFailure.evidence.createMetrics()).toMatchObject({
      sourceCount: 1,
      ownerVersion: 2,
    });

    const hypothesisFailure = createChronicleFixture();
    expect(
      hypothesisFailure.evidence.registerHypothesis(
        {
          hypothesisId: 3,
          caseId: 1,
          ruleSubjectId: 901,
          requiredSupport: 100,
          requiredIndependentClassCount: 1,
          tick: 51,
        },
        failing,
      ),
    ).toEqual({ ok: false, reason: "chronicle_version_capacity_full" });
    expect(hypothesisFailure.evidence.createMetrics()).toMatchObject({ hypothesisCount: 1 });

    const evidenceFailure = createChronicleFixture();
    expect(
      evidenceFailure.evidence.registerEvidence(createEvidenceRow({ evidenceId: 0 }), failing),
    ).toEqual({ ok: false, reason: "chronicle_version_capacity_full" });
    expect(evidenceFailure.evidence.createMetrics()).toMatchObject({ evidenceRowCount: 0 });
    expect(evidenceFailure.evidence.evaluateSupport(2, 8, 4)).toMatchObject({
      ok: true,
      candidateCount: 0,
    });

    const contradictionFailure = createSupportedFixture();
    expect(
      contradictionFailure.evidence.registerContradiction(
        {
          contradictionId: 0,
          caseId: 1,
          hypothesisId: 2,
          evidenceId: 0,
          severity: M4_CONTRADICTION_SEVERITY_FATAL,
          tick: 52,
        },
        failing,
      ),
    ).toEqual({ ok: false, reason: "chronicle_version_capacity_full" });
    expect(contradictionFailure.evidence.createMetrics()).toMatchObject({
      contradictionCount: 0,
    });
    expect(contradictionFailure.evidence.confirmRuleFromHypothesis(4, 2, 32, 16, 53)).toMatchObject(
      { ok: true },
    );
  });

  it("keeps contradiction resolution, confirmation and knowledge grants atomic on recorder failure", () => {
    const failing = createFailingRecorder();
    const { evidence } = createSupportedFixture();
    expect(
      evidence.registerContradiction({
        contradictionId: 0,
        caseId: 1,
        hypothesisId: 2,
        evidenceId: 0,
        severity: M4_CONTRADICTION_SEVERITY_FATAL,
        tick: 60,
      }),
    ).toMatchObject({ ok: true });
    expect(evidence.resolveContradiction(0, 61, failing)).toEqual({
      ok: false,
      reason: "chronicle_version_capacity_full",
    });
    expect(evidence.confirmRuleFromHypothesis(4, 2, 32, 16, 62)).toMatchObject({
      ok: false,
      reason: "evidence_fatal_contradiction_unresolved",
    });

    const confirmFailure = createSupportedFixture();
    const trace = createM4EvidenceReasonTraceStore(4);
    expect(
      confirmFailure.evidence.confirmRuleFromHypothesis(4, 2, 32, 16, 63, failing, trace),
    ).toEqual({
      ok: false,
      reason: "chronicle_version_capacity_full",
      traceSequence: 0,
    });
    expect(confirmFailure.evidence.isConfirmedRuleActive(4)).toBe(false);
    expect(confirmFailure.evidence.createMetrics()).toMatchObject({
      confirmedRuleCount: 0,
      lastSupportCandidateVisits: 0,
      totalSupportCandidateVisits: 0,
    });
    expect(trace.readNewest(0)).toBeUndefined();

    const knowledge = createM4KnowledgeDisseminationStore({
      residentCapacity: 4,
      subjectCapacity: 8,
      rowCapacity: 2,
    });
    expect(
      knowledge.grantKnowledge(
        {
          residentId: 0,
          caseId: 1,
          subjectKind: M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
          subjectId: 2,
          sourceId: 0,
          tick: 64,
        },
        failing,
      ),
    ).toEqual({ ok: false, reason: "chronicle_version_capacity_full" });
    expect(knowledge.createMetrics()).toMatchObject({ rowCount: 0, dirtyBacklog: 0 });
    expect(knowledge.canResidentActAutomatically(0, M4_KNOWLEDGE_KIND_TEMPORARY_POLICY, 2)).toEqual(
      { ok: true, canAct: false, reason: "knowledge.not_actionable" },
    );
  });

  it("rejects cross-case evidence and contradiction contamination", () => {
    const fixture = createTwoCaseFixture();
    expect(
      fixture.evidence.registerEvidence(
        createEvidenceRow({ evidenceId: 0, caseId: 1, hypothesisId: 2, sourceId: 1 }),
      ),
    ).toEqual({ ok: false, reason: "evidence_case_mismatch" });
    expect(
      fixture.evidence.registerEvidence(
        createEvidenceRow({ evidenceId: 0, caseId: 1, hypothesisId: 2, sourceId: 0 }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      fixture.evidence.registerContradiction({
        contradictionId: 0,
        caseId: 2,
        hypothesisId: 3,
        evidenceId: 0,
        severity: M4_CONTRADICTION_SEVERITY_FATAL,
        tick: 72,
      }),
    ).toEqual({ ok: false, reason: "evidence_case_mismatch" });
    expect(fixture.evidence.createMetrics()).toMatchObject({
      evidenceRowCount: 1,
      contradictionCount: 0,
    });
  });

  it("rejects invalid resolve and confirmation ticks without a recorder", () => {
    const { evidence } = createSupportedFixture();
    expect(
      evidence.registerContradiction({
        contradictionId: 0,
        caseId: 1,
        hypothesisId: 2,
        evidenceId: 0,
        severity: M4_CONTRADICTION_SEVERITY_FATAL,
        tick: 80,
      }),
    ).toMatchObject({ ok: true });
    expect(evidence.resolveContradiction(0, -1)).toEqual({
      ok: false,
      reason: "chronicle_value_out_of_range",
    });
    expect(evidence.confirmRuleFromHypothesis(4, 2, 32, 16, -1)).toEqual({
      ok: false,
      reason: "chronicle_value_out_of_range",
      traceSequence: 0,
    });
    expect(evidence.confirmRuleFromHypothesis(4, 2, 32, 16, 81)).toMatchObject({
      ok: false,
      reason: "evidence_fatal_contradiction_unresolved",
    });
  });
});

function createChronicleFixture(): {
  readonly cases: ReturnType<typeof createM4ChronicleCaseFileStore>;
  readonly evidence: M4EvidenceFactStore;
} {
  const cases = createM4ChronicleCaseFileStore({ caseCapacity: 4, versionCapacity: 128 });
  const evidence = createM4EvidenceFactStore({
    caseCapacity: 4,
    sourceCapacity: 8,
    evidenceCapacity: 64,
    hypothesisCapacity: 8,
    contradictionCapacity: 8,
    confirmedRuleCapacity: 16,
  });
  expect(
    cases.openCase({ caseId: 1, openedTick: 10, ownerActorId: 20, primarySubjectId: 700 }),
  ).toMatchObject({ ok: true });
  expect(
    evidence.registerSource(
      {
        sourceId: 0,
        caseId: 1,
        kind: M4_EVIDENCE_SOURCE_PERSON,
        reliability: 700,
        conflictOfInterest: 0,
        tick: 11,
      },
      cases,
    ),
  ).toMatchObject({ ok: true });
  expect(
    evidence.registerHypothesis(
      {
        hypothesisId: 2,
        caseId: 1,
        ruleSubjectId: 900,
        requiredSupport: 1_000,
        requiredIndependentClassCount: 2,
        tick: 12,
      },
      cases,
    ),
  ).toMatchObject({ ok: true });
  return { cases, evidence };
}

function createSupportedFixture(): {
  readonly cases: ReturnType<typeof createM4ChronicleCaseFileStore>;
  readonly evidence: M4EvidenceFactStore;
} {
  const fixture = createChronicleFixture();
  expect(
    fixture.evidence.registerSource(
      {
        sourceId: 1,
        caseId: 1,
        kind: M4_EVIDENCE_SOURCE_SCENE,
        reliability: 900,
        conflictOfInterest: 0,
        tick: 13,
      },
      fixture.cases,
    ),
  ).toMatchObject({ ok: true });
  expect(
    fixture.evidence.registerSource(
      {
        sourceId: 2,
        caseId: 1,
        kind: M4_EVIDENCE_SOURCE_ARCHIVE,
        reliability: 900,
        conflictOfInterest: 0,
        tick: 14,
      },
      fixture.cases,
    ),
  ).toMatchObject({ ok: true });
  const rows: readonly M4EvidenceRowInput[] = [
    createEvidenceRow({ evidenceId: 0, sourceId: 0, evidenceClass: M4_EVIDENCE_CLASS_TESTIMONY }),
    createEvidenceRow({ evidenceId: 1, sourceId: 1, evidenceClass: M4_EVIDENCE_CLASS_TRACE }),
    createEvidenceRow({ evidenceId: 2, sourceId: 2, evidenceClass: M4_EVIDENCE_CLASS_SOURCE }),
  ];
  for (const row of rows) {
    expect(fixture.evidence.registerEvidence(row, fixture.cases)).toMatchObject({ ok: true });
  }

  return fixture;
}

function createTwoCaseFixture(): {
  readonly cases: ReturnType<typeof createM4ChronicleCaseFileStore>;
  readonly evidence: M4EvidenceFactStore;
} {
  const fixture = createChronicleFixture();
  expect(
    fixture.cases.openCase({
      caseId: 2,
      openedTick: 70,
      ownerActorId: 21,
      primarySubjectId: 701,
    }),
  ).toMatchObject({ ok: true });
  expect(
    fixture.evidence.registerSource(
      {
        sourceId: 1,
        caseId: 2,
        kind: M4_EVIDENCE_SOURCE_PERSON,
        reliability: 700,
        conflictOfInterest: 0,
        tick: 70,
      },
      fixture.cases,
    ),
  ).toMatchObject({ ok: true });
  expect(
    fixture.evidence.registerHypothesis(
      {
        hypothesisId: 3,
        caseId: 2,
        ruleSubjectId: 901,
        requiredSupport: 100,
        requiredIndependentClassCount: 1,
        tick: 71,
      },
      fixture.cases,
    ),
  ).toMatchObject({ ok: true });
  return fixture;
}

function createEvidenceRow(overrides: Partial<M4EvidenceRowInput> = {}): M4EvidenceRowInput {
  return {
    evidenceId: 0,
    caseId: 1,
    hypothesisId: 2,
    sourceId: 0,
    evidenceClass: M4_EVIDENCE_CLASS_OBSERVATION,
    supportWeight: 300,
    directness: 100,
    independenceKey: 1,
    preservationQuality: 100,
    perceptionQuality: 100,
    interestConflict: 0,
    tick: 15,
    ...overrides,
  };
}

function createFailingRecorder(): M4ChronicleVersionRecorder {
  return {
    recordVersion(): { readonly ok: false; readonly reason: "chronicle_version_capacity_full" } {
      return { ok: false, reason: "chronicle_version_capacity_full" };
    },
  };
}
