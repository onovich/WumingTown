import { describe, expect, it } from "vitest";

import {
  M4_CONTRADICTION_SEVERITY_FATAL,
  M4_EVIDENCE_CLASS_OBSERVATION,
  M4_EVIDENCE_CLASS_SOURCE,
  M4_EVIDENCE_CLASS_TESTIMONY,
  M4_EVIDENCE_CLASS_TRACE,
  M4_EVIDENCE_DEFAULT_CANDIDATE_CAP,
  M4_EVIDENCE_DEFAULT_SELECTED_CAP,
  M4_EVIDENCE_SOURCE_ARCHIVE,
  M4_EVIDENCE_SOURCE_PERSON,
  M4_EVIDENCE_SOURCE_SCENE,
  M4_EVIDENCE_TIER_HIGHLY_CREDIBLE,
  M4_KNOWLEDGE_KIND_CONFIRMED_RULE,
  M4_KNOWLEDGE_KIND_HYPOTHESIS,
  M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
  createM4ChronicleCaseFileStore,
  createM4EvidenceFactStore,
  createM4EvidenceReasonTraceStore,
  createM4KnowledgeDisseminationStore,
  type M4EvidenceFactStore,
  type M4EvidenceRowInput,
  type M4KnowledgeDirtyKeyOutput,
} from "./index";

describe("M4 Chronicle evidence owner stores", () => {
  it("owns case files, source facts, evidence rows and version history", () => {
    const { cases, evidence } = createChronicleFixture();

    expect(cases.readCase(1)).toMatchObject({
      caseId: 1,
      status: 1,
      caseVersion: 3,
      ownerVersion: 3,
    });
    expect(cases.readVersion(0)).toMatchObject({
      sequence: 1,
      caseId: 1,
      subjectId: 700,
      caseVersion: 1,
    });
    expect(cases.readVersion(2)).toMatchObject({
      sequence: 3,
      changeKind: 4,
      subjectId: 2,
      caseVersion: 3,
    });
    expect(evidence.createMetrics()).toMatchObject({
      sourceCount: 1,
      hypothesisCount: 1,
      evidenceRowCount: 0,
    });
  });

  it("rejects invalid evidence with structured reasons before owner mutation", () => {
    const { evidence } = createChronicleFixture();

    expect(evidence.registerEvidence(createEvidenceRow({ evidenceId: 0, sourceId: 99 }))).toEqual({
      ok: false,
      reason: "evidence_source_not_registered",
    });
    expect(
      evidence.registerEvidence({
        ...createEvidenceRow({ evidenceId: 0 }),
        evidenceClass: 99,
      }),
    ).toEqual({ ok: false, reason: "evidence_class_invalid" });
    expect(
      evidence.registerEvidence(createEvidenceRow({ evidenceId: 0, directness: 1_001 })),
    ).toEqual({ ok: false, reason: "evidence_quality_invalid" });
    expect(evidence.createMetrics()).toMatchObject({
      ownerVersion: 2,
      evidenceRowCount: 0,
    });
  });

  it("computes deterministic support tiers from structured evidence facts", () => {
    const first = createSupportedFixture();
    const second = createSupportedFixture();
    const firstTrace = createM4EvidenceReasonTraceStore(8);
    const secondTrace = createM4EvidenceReasonTraceStore(8);

    const firstSupport = first.evidence.evaluateSupport(
      2,
      M4_EVIDENCE_DEFAULT_CANDIDATE_CAP,
      M4_EVIDENCE_DEFAULT_SELECTED_CAP,
      firstTrace,
    );
    const secondSupport = second.evidence.evaluateSupport(
      2,
      M4_EVIDENCE_DEFAULT_CANDIDATE_CAP,
      M4_EVIDENCE_DEFAULT_SELECTED_CAP,
      secondTrace,
    );

    expect(firstSupport).toEqual(secondSupport);
    expect(firstSupport).toMatchObject({
      ok: true,
      supportScore: 1_800,
      supportTier: M4_EVIDENCE_TIER_HIGHLY_CREDIBLE,
      independentClassCount: 3,
      candidateCount: 3,
      visitedCount: 3,
      candidateCapHit: false,
      fatalUnresolvedContradictionCount: 0,
    });
    expect(firstTrace.readNewest(0)).toMatchObject({
      caseId: 1,
      hypothesisId: 2,
      supportScore: 1_800,
      reason: "evidence_support_evaluated",
    });
  });

  it("requires support, independent evidence classes and no fatal contradiction to confirm rules", () => {
    const { cases, evidence } = createSupportedFixture();
    const trace = createM4EvidenceReasonTraceStore(8);

    expect(
      evidence.registerContradiction(
        {
          contradictionId: 0,
          caseId: 1,
          hypothesisId: 2,
          evidenceId: 0,
          severity: M4_CONTRADICTION_SEVERITY_FATAL,
          tick: 20,
        },
        cases,
      ),
    ).toMatchObject({ ok: true });
    expect(
      evidence.confirmRuleFromHypothesis(
        4,
        2,
        M4_EVIDENCE_DEFAULT_CANDIDATE_CAP,
        M4_EVIDENCE_DEFAULT_SELECTED_CAP,
        21,
        cases,
        trace,
      ),
    ).toEqual({
      ok: false,
      reason: "evidence_fatal_contradiction_unresolved",
      traceSequence: 1,
    });

    expect(evidence.resolveContradiction(0, 22, cases)).toMatchObject({ ok: true });
    expect(
      evidence.confirmRuleFromHypothesis(
        4,
        2,
        M4_EVIDENCE_DEFAULT_CANDIDATE_CAP,
        M4_EVIDENCE_DEFAULT_SELECTED_CAP,
        23,
        cases,
        trace,
      ),
    ).toMatchObject({
      ok: true,
      ruleId: 4,
      supportScore: 1_800,
      independentClassCount: 3,
    });
    expect(evidence.createMetrics()).toMatchObject({ confirmedRuleCount: 1 });

    const weak = createChronicleFixture({ requiredSupport: 2_000, requiredClasses: 4 });
    expect(
      weak.evidence.registerEvidence(createEvidenceRow({ evidenceId: 0 }), weak.cases),
    ).toMatchObject({ ok: true });
    expect(
      weak.evidence.confirmRuleFromHypothesis(4, 2, 32, 16, 24, weak.cases, trace),
    ).toMatchObject({ ok: false, reason: "evidence_support_below_threshold" });
  });

  it("limits automatic resident action to confirmed rules or explicit temporary policies", () => {
    const { cases, evidence } = createSupportedFixture();
    expect(evidence.confirmRuleFromHypothesis(4, 2, 32, 16, 30, cases)).toMatchObject({
      ok: true,
    });
    const knowledge = createM4KnowledgeDisseminationStore({
      residentCapacity: 8,
      subjectCapacity: 16,
      rowCapacity: 8,
    });

    expect(
      knowledge.grantKnowledge(
        {
          residentId: 3,
          caseId: 1,
          subjectKind: M4_KNOWLEDGE_KIND_HYPOTHESIS,
          subjectId: 2,
          sourceId: 0,
          tick: 31,
        },
        cases,
      ),
    ).toMatchObject({ ok: true, rowId: 0 });
    expect(
      knowledge.canResidentActAutomatically(3, M4_KNOWLEDGE_KIND_HYPOTHESIS, 2, evidence),
    ).toEqual({ ok: true, canAct: false, reason: "knowledge.not_actionable" });

    expect(
      knowledge.grantKnowledge(
        {
          residentId: 3,
          caseId: 1,
          subjectKind: M4_KNOWLEDGE_KIND_CONFIRMED_RULE,
          subjectId: 4,
          sourceId: 0,
          tick: 32,
        },
        cases,
      ),
    ).toMatchObject({ ok: true, rowId: 1 });
    expect(
      knowledge.canResidentActAutomatically(3, M4_KNOWLEDGE_KIND_CONFIRMED_RULE, 4, evidence),
    ).toEqual({ ok: true, canAct: true, reason: "knowledge.confirmed_rule_known" });

    expect(
      knowledge.grantKnowledge({
        residentId: 4,
        caseId: 1,
        subjectKind: M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
        subjectId: 8,
        sourceId: 0,
        tick: 33,
      }),
    ).toMatchObject({ ok: true, rowId: 2 });
    expect(knowledge.canResidentActAutomatically(4, M4_KNOWLEDGE_KIND_TEMPORARY_POLICY, 8)).toEqual(
      { ok: true, canAct: true, reason: "knowledge.temporary_policy_known" },
    );
  });

  it("drains exact dissemination dirty keys in stable order", () => {
    const { cases } = createSupportedFixture();
    const knowledge = createM4KnowledgeDisseminationStore({
      residentCapacity: 8,
      subjectCapacity: 16,
      rowCapacity: 8,
    });
    expect(
      knowledge.grantKnowledge({
        residentId: 1,
        caseId: 1,
        subjectKind: M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
        subjectId: 7,
        sourceId: 0,
        tick: 40,
      }),
    ).toMatchObject({ ok: true });
    expect(
      knowledge.grantKnowledge(
        {
          residentId: 2,
          caseId: 1,
          subjectKind: M4_KNOWLEDGE_KIND_CONFIRMED_RULE,
          subjectId: 4,
          sourceId: 0,
          tick: 41,
        },
        cases,
      ),
    ).toMatchObject({ ok: true });

    const dirty = [emptyDirty(), emptyDirty()];
    expect(knowledge.processDirtyKeys(2, dirty)).toMatchObject({
      ok: true,
      processedCount: 2,
      remainingCount: 0,
    });
    expect(dirty).toEqual([
      {
        residentId: 1,
        subjectKind: M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
        subjectId: 7,
        rowId: 0,
        ownerVersion: 1,
        sequence: 1,
      },
      {
        residentId: 2,
        subjectKind: M4_KNOWLEDGE_KIND_CONFIRMED_RULE,
        subjectId: 4,
        rowId: 1,
        ownerVersion: 2,
        sequence: 2,
      },
    ]);
    expect(knowledge.createMetrics()).toMatchObject({
      dirtyBacklog: 0,
      dirtyBacklogPeak: 2,
      dirtyDrainedKeyCount: 2,
    });
  });
});

function createChronicleFixture(
  options: { readonly requiredSupport?: number; readonly requiredClasses?: number } = {},
): {
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
        requiredSupport: options.requiredSupport ?? 1_000,
        requiredIndependentClassCount: options.requiredClasses ?? 2,
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

function emptyDirty(): M4KnowledgeDirtyKeyOutput {
  return {
    residentId: 0,
    subjectKind: M4_KNOWLEDGE_KIND_HYPOTHESIS,
    subjectId: 0,
    rowId: 0,
    ownerVersion: 0,
    sequence: 0,
  };
}
