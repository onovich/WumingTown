import type { M4ChronicleReason, M4EvidenceSupportTier } from "./m4-chronicle-types";

export interface M4EvidenceFactStoreOptions {
  readonly caseCapacity: number;
  readonly sourceCapacity: number;
  readonly evidenceCapacity: number;
  readonly hypothesisCapacity: number;
  readonly contradictionCapacity: number;
  readonly confirmedRuleCapacity: number;
}

export interface M4EvidenceSourceInput {
  readonly sourceId: number;
  readonly caseId: number;
  readonly kind: number;
  readonly reliability: number;
  readonly conflictOfInterest: number;
  readonly tick: number;
}

export interface M4EvidenceRowInput {
  readonly evidenceId: number;
  readonly caseId: number;
  readonly hypothesisId: number;
  readonly sourceId: number;
  readonly evidenceClass: number;
  readonly supportWeight: number;
  readonly directness: number;
  readonly independenceKey: number;
  readonly preservationQuality: number;
  readonly perceptionQuality: number;
  readonly interestConflict: number;
  readonly tick: number;
}

export interface M4EvidenceHypothesisInput {
  readonly hypothesisId: number;
  readonly caseId: number;
  readonly ruleSubjectId: number;
  readonly requiredSupport: number;
  readonly requiredIndependentClassCount: number;
  readonly tick: number;
}

export interface M4EvidenceContradictionInput {
  readonly contradictionId: number;
  readonly caseId: number;
  readonly hypothesisId: number;
  readonly evidenceId: number;
  readonly severity: number;
  readonly tick: number;
}

export type M4EvidenceMutationResult =
  | { readonly ok: true; readonly changed: boolean; readonly ownerVersion: number }
  | { readonly ok: false; readonly reason: M4ChronicleReason };

export type M4EvidenceSupportResult =
  | {
      readonly ok: true;
      readonly caseId: number;
      readonly hypothesisId: number;
      readonly supportScore: number;
      readonly supportTier: M4EvidenceSupportTier;
      readonly independentClassCount: number;
      readonly independentClassMask: number;
      readonly candidateCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly fatalUnresolvedContradictionCount: number;
      readonly traceSequence: number;
      readonly ownerVersion: number;
    }
  | { readonly ok: false; readonly reason: M4ChronicleReason };

export type M4EvidenceConfirmRuleResult =
  | {
      readonly ok: true;
      readonly ruleId: number;
      readonly caseId: number;
      readonly hypothesisId: number;
      readonly supportScore: number;
      readonly independentClassCount: number;
      readonly ownerVersion: number;
      readonly traceSequence: number;
    }
  | { readonly ok: false; readonly reason: M4ChronicleReason; readonly traceSequence: number };

export interface M4EvidenceMetrics {
  readonly ownerVersion: number;
  readonly sourceCount: number;
  readonly evidenceRowCount: number;
  readonly hypothesisCount: number;
  readonly contradictionCount: number;
  readonly confirmedRuleCount: number;
  readonly lastSupportCandidateVisits: number;
  readonly totalSupportCandidateVisits: number;
}
