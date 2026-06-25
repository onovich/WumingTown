import {
  M4_CHRONICLE_NONE,
  M4_EVIDENCE_TIER_CREDIBLE,
  M4_EVIDENCE_TIER_HIGHLY_CREDIBLE,
  M4_EVIDENCE_TIER_NONE,
  M4_EVIDENCE_TIER_RUMOR,
  M4_EVIDENCE_TIER_THIN,
  type M4EvidenceSupportTier,
} from "./m4-chronicle-types";
import type { M4EvidenceTraceReason } from "./m4-chronicle-reason-trace";
import type { M4EvidenceRowInput } from "./m4-evidence-types";

export function calculateEvidenceScore(input: M4EvidenceRowInput): number {
  const quality = input.directness + input.preservationQuality + input.perceptionQuality;
  const conflictPenalty = input.interestConflict + Math.floor(input.interestConflict / 2);
  return input.supportWeight + quality > conflictPenalty
    ? input.supportWeight + quality - conflictPenalty
    : 0;
}

export function tierForScore(score: number): M4EvidenceSupportTier {
  if (score >= 800) return M4_EVIDENCE_TIER_HIGHLY_CREDIBLE;
  if (score >= 500) return M4_EVIDENCE_TIER_CREDIBLE;
  if (score >= 250) return M4_EVIDENCE_TIER_THIN;
  if (score > 0) return M4_EVIDENCE_TIER_RUMOR;
  return M4_EVIDENCE_TIER_NONE;
}

export function supportTraceReason(
  tier: M4EvidenceSupportTier,
  candidateCapHit: boolean,
  selectedCapHit: boolean,
): M4EvidenceTraceReason {
  if (candidateCapHit) return "evidence_candidate_cap_reached";
  if (selectedCapHit) return "evidence_selected_cap_reached";
  return tier === M4_EVIDENCE_TIER_NONE ? "evidence_no_support" : "evidence_support_evaluated";
}

export function classMaskFor(value: number): number {
  return value >= 1 && value <= 4 ? 1 << (value - 1) : 0;
}

export function countBits4(mask: number): number {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
}

export function evidenceBefore(
  currentId: number,
  nextId: number,
  nextScore: number,
  scores: Uint32Array,
  classes: Uint8Array,
): boolean {
  const currentScore = scores[currentId] ?? 0;
  if (currentScore !== nextScore) return currentScore > nextScore;
  const currentClass = classes[currentId] ?? 0;
  const nextClass = classes[nextId] ?? 0;
  return currentClass !== nextClass ? currentClass < nextClass : currentId < nextId;
}

export function isQuality(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

export function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M4_CHRONICLE_NONE);
  return values;
}

export function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}
