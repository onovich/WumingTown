import {
  M4_CHRONICLE_NONE,
  M4_EVIDENCE_TIER_CONFIRMED,
  M4_EVIDENCE_TIER_CREDIBLE,
  M4_EVIDENCE_TIER_HIGHLY_CREDIBLE,
  M4_EVIDENCE_TIER_NONE,
  M4_EVIDENCE_TIER_RUMOR,
  M4_EVIDENCE_TIER_THIN,
  isIndexInRange,
  requirePositiveSafeInteger,
  type M4EvidenceSupportTier,
} from "./m4-chronicle-types";

export type M4EvidenceTraceReason =
  | "evidence_support_evaluated"
  | "evidence_no_support"
  | "evidence_candidate_cap_reached"
  | "evidence_selected_cap_reached"
  | "evidence_support_below_threshold"
  | "evidence_independent_class_insufficient"
  | "evidence_fatal_contradiction_unresolved";

export interface M4EvidenceTraceInput {
  readonly caseId: number;
  readonly hypothesisId: number;
  readonly visitedCount: number;
  readonly selectedCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly supportScore: number;
  readonly supportTier: M4EvidenceSupportTier;
  readonly independentClassCount: number;
  readonly fatalContradictionCount: number;
  readonly ownerVersion: number;
  readonly reason: M4EvidenceTraceReason;
}

export interface M4EvidenceTraceView extends M4EvidenceTraceInput {
  readonly sequence: number;
}

export interface M4EvidenceTraceMetrics {
  readonly capacity: number;
  readonly storedCount: number;
  readonly nextSequence: number;
  readonly backlogCount: number;
}

export class M4EvidenceReasonTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly caseIds: Uint32Array;
  private readonly hypothesisIds: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly selectedCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedCaps: Uint32Array;
  private readonly supportScores: Uint32Array;
  private readonly supportTiers: Uint8Array;
  private readonly independentClassCounts: Uint8Array;
  private readonly fatalContradictionCounts: Uint32Array;
  private readonly ownerVersions: Uint32Array;
  private readonly reasonCodes: Uint8Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity: number) {
    this.capacity = requirePositiveSafeInteger(capacity, "evidence trace capacity");
    this.sequences = new Uint32Array(capacity);
    this.caseIds = new Uint32Array(capacity);
    this.caseIds.fill(M4_CHRONICLE_NONE);
    this.hypothesisIds = new Uint32Array(capacity);
    this.hypothesisIds.fill(M4_CHRONICLE_NONE);
    this.visitedCounts = new Uint32Array(capacity);
    this.selectedCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedCaps = new Uint32Array(capacity);
    this.supportScores = new Uint32Array(capacity);
    this.supportTiers = new Uint8Array(capacity);
    this.independentClassCounts = new Uint8Array(capacity);
    this.fatalContradictionCounts = new Uint32Array(capacity);
    this.ownerVersions = new Uint32Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
  }

  recordEvidenceSupport(input: M4EvidenceTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;
    this.sequences[slot] = sequence;
    this.caseIds[slot] = input.caseId;
    this.hypothesisIds[slot] = input.hypothesisId;
    this.visitedCounts[slot] = input.visitedCount;
    this.selectedCounts[slot] = input.selectedCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedCaps[slot] = input.selectedCap;
    this.supportScores[slot] = input.supportScore;
    this.supportTiers[slot] = input.supportTier;
    this.independentClassCounts[slot] = input.independentClassCount;
    this.fatalContradictionCounts[slot] = input.fatalContradictionCount;
    this.ownerVersions[slot] = input.ownerVersion;
    this.reasonCodes[slot] = encodeTraceReason(input.reason);
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): M4EvidenceTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }

    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    return {
      sequence: this.sequences[slot] ?? 0,
      caseId: this.caseIds[slot] ?? M4_CHRONICLE_NONE,
      hypothesisId: this.hypothesisIds[slot] ?? M4_CHRONICLE_NONE,
      visitedCount: this.visitedCounts[slot] ?? 0,
      selectedCount: this.selectedCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedCap: this.selectedCaps[slot] ?? 0,
      supportScore: this.supportScores[slot] ?? 0,
      supportTier: decodeTier(this.supportTiers[slot] ?? 0),
      independentClassCount: this.independentClassCounts[slot] ?? 0,
      fatalContradictionCount: this.fatalContradictionCounts[slot] ?? 0,
      ownerVersion: this.ownerVersions[slot] ?? 0,
      reason: decodeTraceReason(this.reasonCodes[slot] ?? 0),
    };
  }

  createMetrics(): M4EvidenceTraceMetrics {
    return {
      capacity: this.capacity,
      storedCount: this.stored,
      nextSequence: this.nextSequence,
      backlogCount: 0,
    };
  }
}

export function createM4EvidenceReasonTraceStore(capacity: number): M4EvidenceReasonTraceStore {
  return new M4EvidenceReasonTraceStore(capacity);
}

function encodeTraceReason(reason: M4EvidenceTraceReason): number {
  if (reason === "evidence_no_support") return 1;
  if (reason === "evidence_candidate_cap_reached") return 2;
  if (reason === "evidence_selected_cap_reached") return 3;
  if (reason === "evidence_support_below_threshold") return 4;
  if (reason === "evidence_independent_class_insufficient") return 5;
  if (reason === "evidence_fatal_contradiction_unresolved") return 6;
  return 0;
}

function decodeTraceReason(code: number): M4EvidenceTraceReason {
  if (code === 1) return "evidence_no_support";
  if (code === 2) return "evidence_candidate_cap_reached";
  if (code === 3) return "evidence_selected_cap_reached";
  if (code === 4) return "evidence_support_below_threshold";
  if (code === 5) return "evidence_independent_class_insufficient";
  if (code === 6) return "evidence_fatal_contradiction_unresolved";
  return "evidence_support_evaluated";
}

function decodeTier(code: number): M4EvidenceSupportTier {
  if (code === M4_EVIDENCE_TIER_RUMOR) return M4_EVIDENCE_TIER_RUMOR;
  if (code === M4_EVIDENCE_TIER_THIN) return M4_EVIDENCE_TIER_THIN;
  if (code === M4_EVIDENCE_TIER_CREDIBLE) return M4_EVIDENCE_TIER_CREDIBLE;
  if (code === M4_EVIDENCE_TIER_HIGHLY_CREDIBLE) return M4_EVIDENCE_TIER_HIGHLY_CREDIBLE;
  if (code === M4_EVIDENCE_TIER_CONFIRMED) return M4_EVIDENCE_TIER_CONFIRMED;
  return M4_EVIDENCE_TIER_NONE;
}
