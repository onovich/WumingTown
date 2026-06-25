import {
  M4_CHRONICLE_CHANGE_DISSEMINATED,
  M4_CHRONICLE_NONE,
  M4_KNOWLEDGE_KIND_CONFIRMED_RULE,
  M4_KNOWLEDGE_KIND_HYPOTHESIS,
  M4_KNOWLEDGE_KIND_TEMPORARY_POLICY,
  isIndexInRange,
  isKnowledgeSubjectKind,
  isNonNegativeSafeInteger,
  isUint32,
  requirePositiveSafeInteger,
  type M4ChronicleReason,
  type M4ChronicleVersionRecorder,
  type M4KnowledgeSubjectKind,
} from "./m4-chronicle-types";
import type { M4EvidenceFactStore } from "./m4-evidence-facts";

export interface M4KnowledgeDisseminationStoreOptions {
  readonly residentCapacity: number;
  readonly subjectCapacity: number;
  readonly rowCapacity: number;
  readonly dirtyCapacity?: number;
}

export interface M4KnowledgeGrantInput {
  readonly residentId: number;
  readonly caseId: number;
  readonly subjectKind: M4KnowledgeSubjectKind;
  readonly subjectId: number;
  readonly sourceId: number;
  readonly tick: number;
}

export interface M4KnowledgeDirtyKeyOutput {
  residentId: number;
  subjectKind: M4KnowledgeSubjectKind;
  subjectId: number;
  rowId: number;
  ownerVersion: number;
  sequence: number;
}

export type M4KnowledgeMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly rowId: number;
      readonly ownerVersion: number;
    }
  | { readonly ok: false; readonly reason: M4ChronicleReason };

export type M4KnowledgeActionResult =
  | {
      readonly ok: true;
      readonly canAct: boolean;
      readonly reason:
        | "knowledge.confirmed_rule_known"
        | "knowledge.temporary_policy_known"
        | "knowledge.not_actionable";
    }
  | { readonly ok: false; readonly reason: M4ChronicleReason };

export type M4KnowledgeDirtyDrainResult =
  | {
      readonly ok: true;
      readonly processedCount: number;
      readonly remainingCount: number;
      readonly ownerVersion: number;
    }
  | { readonly ok: false; readonly reason: M4ChronicleReason };

export interface M4KnowledgeDisseminationMetrics {
  readonly ownerVersion: number;
  readonly rowCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
  readonly dirtyDrainCount: number;
  readonly dirtyDrainedKeyCount: number;
}

export class M4KnowledgeDisseminationStore {
  readonly residentCapacity: number;
  readonly subjectCapacity: number;
  readonly rowCapacity: number;
  readonly dirtyCapacity: number;

  private readonly active: Uint8Array;
  private readonly residentIds: Uint32Array;
  private readonly caseIds: Uint32Array;
  private readonly subjectKinds: Uint8Array;
  private readonly subjectIds: Uint32Array;
  private readonly sourceIds: Uint32Array;
  private readonly rowVersions: Uint32Array;
  private readonly knownByComposite: Int32Array;
  private readonly dirtyQueue: Uint32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtySequences: Uint32Array;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private dirtyDrainCount = 0;
  private dirtyDrainedKeyCount = 0;
  private rowCountValue = 0;
  private ownerVersionValue = 0;
  private nextDirtySequence = 1;

  constructor(options: M4KnowledgeDisseminationStoreOptions) {
    this.residentCapacity = requirePositiveSafeInteger(
      options.residentCapacity,
      "knowledge resident capacity",
    );
    this.subjectCapacity = requirePositiveSafeInteger(
      options.subjectCapacity,
      "knowledge subject capacity",
    );
    this.rowCapacity = requirePositiveSafeInteger(options.rowCapacity, "knowledge row capacity");
    this.dirtyCapacity = requirePositiveSafeInteger(
      options.dirtyCapacity ?? options.rowCapacity,
      "knowledge dirty capacity",
    );
    this.active = new Uint8Array(this.rowCapacity);
    this.residentIds = new Uint32Array(this.rowCapacity);
    this.caseIds = new Uint32Array(this.rowCapacity);
    this.subjectKinds = new Uint8Array(this.rowCapacity);
    this.subjectIds = new Uint32Array(this.rowCapacity);
    this.sourceIds = new Uint32Array(this.rowCapacity);
    this.rowVersions = new Uint32Array(this.rowCapacity);
    this.knownByComposite = new Int32Array(this.residentCapacity * 3 * this.subjectCapacity);
    this.knownByComposite.fill(-1);
    this.dirtyQueue = new Uint32Array(this.dirtyCapacity);
    this.dirtyQueued = new Uint8Array(this.rowCapacity);
    this.dirtySequences = new Uint32Array(this.rowCapacity);
    this.caseIds.fill(M4_CHRONICLE_NONE);
    this.subjectIds.fill(M4_CHRONICLE_NONE);
    this.sourceIds.fill(M4_CHRONICLE_NONE);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  grantKnowledge(
    input: M4KnowledgeGrantInput,
    recorder?: M4ChronicleVersionRecorder,
  ): M4KnowledgeMutationResult {
    const valid = this.validateGrant(input);
    if (!valid.ok) {
      return valid;
    }

    const key = this.createCompositeKey(input.residentId, input.subjectKind, input.subjectId);
    const existing = this.knownByComposite[key] ?? -1;
    if (existing >= 0) {
      return { ok: true, changed: false, rowId: existing, ownerVersion: this.ownerVersionValue };
    }

    if (this.rowCountValue >= this.rowCapacity) {
      return { ok: false, reason: "chronicle_id_out_of_range" };
    }

    if (this.dirtyCount >= this.dirtyCapacity) {
      return { ok: false, reason: "knowledge_dirty_queue_full" };
    }

    if (this.ownerVersionValue >= 0xffff_ffff) {
      return { ok: false, reason: "chronicle_version_exhausted" };
    }

    const recorded = recorder?.recordVersion(
      input.caseId,
      M4_CHRONICLE_CHANGE_DISSEMINATED,
      input.subjectId,
      input.tick,
    );
    if (recorded !== undefined && !recorded.ok) {
      return recorded;
    }

    const nextOwnerVersion = this.ownerVersionValue + 1;
    const rowId = this.rowCountValue;
    this.active[rowId] = 1;
    this.residentIds[rowId] = input.residentId;
    this.caseIds[rowId] = input.caseId;
    this.subjectKinds[rowId] = input.subjectKind;
    this.subjectIds[rowId] = input.subjectId;
    this.sourceIds[rowId] = input.sourceId;
    this.rowVersions[rowId] = nextOwnerVersion;
    this.knownByComposite[key] = rowId;
    this.rowCountValue += 1;
    this.markDirty(rowId);
    this.ownerVersionValue = nextOwnerVersion;

    return { ok: true, changed: true, rowId, ownerVersion: this.ownerVersionValue };
  }

  canResidentActAutomatically(
    residentId: number,
    subjectKind: M4KnowledgeSubjectKind,
    subjectId: number,
    evidence?: M4EvidenceFactStore,
  ): M4KnowledgeActionResult {
    if (!isIndexInRange(residentId, this.residentCapacity)) {
      return { ok: false, reason: "knowledge_resident_out_of_range" };
    }

    if (!isKnowledgeSubjectKind(subjectKind) || !isIndexInRange(subjectId, this.subjectCapacity)) {
      return { ok: false, reason: "knowledge_subject_kind_invalid" };
    }

    const rowId =
      this.knownByComposite[this.createCompositeKey(residentId, subjectKind, subjectId)] ?? -1;
    if (rowId < 0) {
      return { ok: true, canAct: false, reason: "knowledge.not_actionable" };
    }

    if (subjectKind === M4_KNOWLEDGE_KIND_TEMPORARY_POLICY) {
      return { ok: true, canAct: true, reason: "knowledge.temporary_policy_known" };
    }

    if (
      subjectKind === M4_KNOWLEDGE_KIND_CONFIRMED_RULE &&
      (evidence === undefined || evidence.isConfirmedRuleActive(subjectId))
    ) {
      return { ok: true, canAct: true, reason: "knowledge.confirmed_rule_known" };
    }

    return { ok: true, canAct: false, reason: "knowledge.not_actionable" };
  }

  processDirtyKeys(
    budget: number,
    output: M4KnowledgeDirtyKeyOutput[],
  ): M4KnowledgeDirtyDrainResult {
    if (!isNonNegativeSafeInteger(budget)) {
      return { ok: false, reason: "knowledge_dirty_budget_invalid" };
    }

    if (output.length < budget) {
      return { ok: false, reason: "knowledge_dirty_output_too_small" };
    }

    let processed = 0;
    while (processed < budget && this.dirtyCount > 0) {
      const rowId = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.dirtyCapacity;
      this.dirtyCount -= 1;
      this.dirtyQueued[rowId] = 0;
      this.writeDirtyKey(rowId, output[processed]);
      processed += 1;
    }

    this.dirtyDrainCount += 1;
    this.dirtyDrainedKeyCount += processed;
    return {
      ok: true,
      processedCount: processed,
      remainingCount: this.dirtyCount,
      ownerVersion: this.ownerVersionValue,
    };
  }

  createMetrics(): M4KnowledgeDisseminationMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      rowCount: this.rowCountValue,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
      dirtyDrainCount: this.dirtyDrainCount,
      dirtyDrainedKeyCount: this.dirtyDrainedKeyCount,
    };
  }

  private validateGrant(
    input: M4KnowledgeGrantInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M4ChronicleReason } {
    if (!isIndexInRange(input.residentId, this.residentCapacity)) {
      return { ok: false, reason: "knowledge_resident_out_of_range" };
    }

    if (
      !isKnowledgeSubjectKind(input.subjectKind) ||
      !isIndexInRange(input.subjectId, this.subjectCapacity)
    ) {
      return { ok: false, reason: "knowledge_subject_kind_invalid" };
    }

    return isUint32(input.caseId) && isUint32(input.sourceId) && isUint32(input.tick)
      ? { ok: true }
      : { ok: false, reason: "chronicle_value_out_of_range" };
  }

  private markDirty(rowId: number): void {
    const tail = (this.dirtyHead + this.dirtyCount) % this.dirtyCapacity;
    this.dirtyQueue[tail] = rowId;
    this.dirtyQueued[rowId] = 1;
    this.dirtySequences[rowId] = this.nextDirtySequence;
    this.dirtyCount += 1;
    if (this.dirtyCount > this.dirtyPeak) {
      this.dirtyPeak = this.dirtyCount;
    }

    this.nextDirtySequence += 1;
  }

  private writeDirtyKey(rowId: number, output: M4KnowledgeDirtyKeyOutput | undefined): void {
    if (output === undefined || (this.active[rowId] ?? 0) === 0) {
      return;
    }

    output.residentId = this.residentIds[rowId] ?? 0;
    output.subjectKind = decodeSubjectKind(this.subjectKinds[rowId] ?? 0);
    output.subjectId = this.subjectIds[rowId] ?? M4_CHRONICLE_NONE;
    output.rowId = rowId;
    output.ownerVersion = this.rowVersions[rowId] ?? 0;
    output.sequence = this.dirtySequences[rowId] ?? 0;
  }

  private createCompositeKey(
    residentId: number,
    subjectKind: M4KnowledgeSubjectKind,
    subjectId: number,
  ): number {
    return (residentId * 3 + subjectKind - 1) * this.subjectCapacity + subjectId;
  }
}

export function createM4KnowledgeDisseminationStore(
  options: M4KnowledgeDisseminationStoreOptions,
): M4KnowledgeDisseminationStore {
  return new M4KnowledgeDisseminationStore(options);
}

function decodeSubjectKind(value: number): M4KnowledgeSubjectKind {
  if (value === M4_KNOWLEDGE_KIND_CONFIRMED_RULE) {
    return M4_KNOWLEDGE_KIND_CONFIRMED_RULE;
  }

  if (value === M4_KNOWLEDGE_KIND_TEMPORARY_POLICY) {
    return M4_KNOWLEDGE_KIND_TEMPORARY_POLICY;
  }

  return M4_KNOWLEDGE_KIND_HYPOTHESIS;
}
