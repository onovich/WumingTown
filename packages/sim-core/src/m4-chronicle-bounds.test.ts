import { describe, expect, it } from "vitest";

import {
  M4_EVIDENCE_CLASS_OBSERVATION,
  M4_EVIDENCE_CLASS_SOURCE,
  M4_EVIDENCE_CLASS_TESTIMONY,
  M4_EVIDENCE_CLASS_TRACE,
  M4_EVIDENCE_SOURCE_PERSON,
  createM4ChronicleCaseFileStore,
  createM4EvidenceFactStore,
  createM4EvidenceReasonTraceStore,
  type M4EvidenceRowInput,
} from "./index";

describe("M4 Chronicle bounded evidence reads", () => {
  it("bounds evidence candidate reads without scanning every row", () => {
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

    for (let evidenceId = 0; evidenceId < 40; evidenceId += 1) {
      expect(
        evidence.registerEvidence(
          createEvidenceRow({
            evidenceId,
            supportWeight: 40 + evidenceId,
            evidenceClass: classFor(evidenceId),
          }),
        ),
      ).toMatchObject({ ok: true });
    }

    const trace = createM4EvidenceReasonTraceStore(4);
    expect(evidence.evaluateSupport(2, 32, 16, trace)).toMatchObject({
      ok: true,
      candidateCount: 40,
      visitedCount: 32,
      candidateCapHit: true,
      selectedCapHit: true,
      traceSequence: 1,
    });
    expect(evidence.createMetrics()).toMatchObject({
      evidenceRowCount: 40,
      lastSupportCandidateVisits: 32,
      totalSupportCandidateVisits: 32,
    });
    expect(trace.readNewest(0)).toMatchObject({
      candidateCap: 32,
      selectedCap: 16,
      reason: "evidence_candidate_cap_reached",
    });
  });
});

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

function classFor(offset: number): M4EvidenceRowInput["evidenceClass"] {
  const lane = offset % 4;
  if (lane === 1) return M4_EVIDENCE_CLASS_TESTIMONY;
  if (lane === 2) return M4_EVIDENCE_CLASS_TRACE;
  if (lane === 3) return M4_EVIDENCE_CLASS_SOURCE;
  return M4_EVIDENCE_CLASS_OBSERVATION;
}
