import {
  M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE,
  M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME,
  M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT,
  M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH,
  M4_BORROWED_SHADOW_MIN_GAP_SCORE,
  M4_BORROWED_SHADOW_NONE,
  M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT,
  M4_BORROWED_SHADOW_RESOLUTION_NEGOTIATION,
  type M4BorrowedShadowActivationBasis,
} from "./m4-borrowed-shadow-types";
import { M4_EVIDENCE_TIER_CONFIRMED } from "./m4-chronicle-types";
import {
  M5_ANOMALY_ACTIVATION_POLICY_BORROWED_SHADOW_LAMP_IDENTITY,
  M5_ANOMALY_ACTIVATION_POLICY_THIRD_KNOCK_THRESHOLD_INVITATION,
  M5_ANOMALY_DEF_BORROWED_SHADOW,
  M5_ANOMALY_DEF_THIRD_KNOCK,
  M5_ANOMALY_KIND,
  M5_ANOMALY_NONE,
  M5_ANOMALY_ROSTER_SNAPSHOT_VERSION,
  M5_ANOMALY_RULE_COMPONENT_BORROWED_SHADOW,
  M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK,
  M5_ANOMALY_STATE_OWNER_BORROWED_SHADOW_CRISIS,
  M5_ANOMALY_STATE_OWNER_THIRD_KNOCK_CRISIS,
  type M5AnomalyActivationCandidateInput,
  type M5AnomalyActivationCandidateQuery,
  type M5AnomalyActivationCandidateQueryResult,
  type M5AnomalyActivationCandidateView,
  type M5AnomalyDefinitionView,
  type M5AnomalyRosterMetrics,
  type M5AnomalyRosterMutationResult,
  type M5AnomalyRosterReason,
  type M5AnomalyRosterStoreOptions,
  type M5CompiledAnomalyDefinitionInput,
  type M5CompiledAnomalyRosterInput,
} from "./m5-anomaly-roster-types";
import { M5_THIRD_KNOCK_EVIDENCE_MASK, M5_THIRD_KNOCK_NON_COMBAT_MASK } from "./m5-third-knock";
import { M5_THIRD_KNOCK_MIN_INVITATION_SCORE } from "./m5-third-knock-types";

const M5_BORROWED_SHADOW_EVIDENCE_MASK =
  (1 << M4_BORROWED_SHADOW_EVIDENCE_LAMP_EDGE_FOOTPRINT) |
  (1 << M4_BORROWED_SHADOW_EVIDENCE_WITNESS_MISMATCH) |
  (1 << M4_BORROWED_SHADOW_EVIDENCE_DUPLICATE_NAME) |
  (1 << M4_BORROWED_SHADOW_EVIDENCE_COLD_LAMP_TRACE);

const M5_BORROWED_SHADOW_NON_COMBAT_MASK =
  (1 << M4_BORROWED_SHADOW_RESOLUTION_CONTAINMENT) |
  (1 << M4_BORROWED_SHADOW_RESOLUTION_NEGOTIATION);

export class M5AnomalyRosterStore {
  readonly definitionCapacity: number;
  readonly candidateCapacity: number;

  private readonly definitionActive: Uint8Array;
  private readonly contentDefIndexes: Uint32Array;
  private readonly schemaVersions: Uint16Array;
  private readonly ruleComponents: Uint16Array;
  private readonly activationPolicies: Uint16Array;
  private readonly stateOwnerKinds: Uint16Array;
  private readonly minActivationScores: Uint32Array;
  private readonly evidenceClassMasks: Uint32Array;
  private readonly nonCombatResolutionMasks: Uint32Array;
  private readonly definitionIds: string[];
  private readonly validationBasisHashes: string[];
  private readonly candidateHeadByDef: Int32Array;

  private readonly candidateActive: Uint8Array;
  private readonly candidateDefIndexes: Uint32Array;
  private readonly candidateStateOwnerIds: Uint32Array;
  private readonly candidateScores: Uint32Array;
  private readonly candidatePriorities: Uint32Array;
  private readonly candidateStableOwnerIds: Uint32Array;
  private readonly candidateStableSequences: Uint32Array;
  private readonly candidateRosterVersions: Uint32Array;
  private readonly candidateVersions: Uint32Array;
  private readonly candidateNext: Int32Array;
  private readonly candidatePrevious: Int32Array;

  private readonly basisTargets: Uint32Array;
  private readonly basisLamps: Uint32Array;
  private readonly basisLampGapScores: Uint32Array;
  private readonly basisHumanClaims: Uint32Array;
  private readonly basisLampGapSourceVersions: Uint32Array;
  private readonly basisLampGapIndexVersions: Uint32Array;
  private readonly basisCaseIds: Uint32Array;
  private readonly basisHypothesisIds: Uint32Array;
  private readonly basisSupportTiers: Uint16Array;
  private readonly basisSupportScores: Uint32Array;
  private readonly basisClassCounts: Uint8Array;
  private readonly basisIdentityConfirmed: Uint8Array;
  private readonly basisEvidenceOwnerVersions: Uint32Array;
  private readonly basisObligationOwnerVersions: Uint32Array;
  private readonly basisObligationDuePressures: Uint32Array;
  private readonly basisTownRuleOwnerVersions: Uint32Array;
  private readonly basisNightWatchPolicyKnown: Uint8Array;

  private ownerVersionValue = 0;
  private rosterVersionValue = 0;
  private definitionCountValue = 0;
  private activeCandidateCountValue = 0;
  private contentManifestHashValue = "";
  private validationBasisValue = "";
  private lastCandidateVisits = 0;
  private totalCandidateVisits = 0;
  private candidateCapHitCount = 0;

  constructor(options: M5AnomalyRosterStoreOptions) {
    this.definitionCapacity = requirePositive(options.definitionCapacity, "definition capacity");
    this.candidateCapacity = requirePositive(options.candidateCapacity, "candidate capacity");
    this.definitionActive = new Uint8Array(this.definitionCapacity);
    this.contentDefIndexes = filledUint32(this.definitionCapacity);
    this.schemaVersions = new Uint16Array(this.definitionCapacity);
    this.ruleComponents = new Uint16Array(this.definitionCapacity);
    this.activationPolicies = new Uint16Array(this.definitionCapacity);
    this.stateOwnerKinds = new Uint16Array(this.definitionCapacity);
    this.minActivationScores = new Uint32Array(this.definitionCapacity);
    this.evidenceClassMasks = new Uint32Array(this.definitionCapacity);
    this.nonCombatResolutionMasks = new Uint32Array(this.definitionCapacity);
    this.definitionIds = Array.from({ length: this.definitionCapacity }, () => "");
    this.validationBasisHashes = Array.from({ length: this.definitionCapacity }, () => "");
    this.candidateHeadByDef = filledInt32(this.definitionCapacity);
    this.candidateActive = new Uint8Array(this.candidateCapacity);
    this.candidateDefIndexes = filledUint32(this.candidateCapacity);
    this.candidateStateOwnerIds = filledUint32(this.candidateCapacity);
    this.candidateScores = new Uint32Array(this.candidateCapacity);
    this.candidatePriorities = new Uint32Array(this.candidateCapacity);
    this.candidateStableOwnerIds = filledUint32(this.candidateCapacity);
    this.candidateStableSequences = filledUint32(this.candidateCapacity);
    this.candidateRosterVersions = new Uint32Array(this.candidateCapacity);
    this.candidateVersions = new Uint32Array(this.candidateCapacity);
    this.candidateNext = filledInt32(this.candidateCapacity);
    this.candidatePrevious = filledInt32(this.candidateCapacity);
    this.basisTargets = filledUint32(this.candidateCapacity);
    this.basisLamps = filledUint32(this.candidateCapacity);
    this.basisLampGapScores = new Uint32Array(this.candidateCapacity);
    this.basisHumanClaims = new Uint32Array(this.candidateCapacity);
    this.basisLampGapSourceVersions = new Uint32Array(this.candidateCapacity);
    this.basisLampGapIndexVersions = new Uint32Array(this.candidateCapacity);
    this.basisCaseIds = filledUint32(this.candidateCapacity);
    this.basisHypothesisIds = filledUint32(this.candidateCapacity);
    this.basisSupportTiers = new Uint16Array(this.candidateCapacity);
    this.basisSupportScores = new Uint32Array(this.candidateCapacity);
    this.basisClassCounts = new Uint8Array(this.candidateCapacity);
    this.basisIdentityConfirmed = new Uint8Array(this.candidateCapacity);
    this.basisEvidenceOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.basisObligationOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.basisObligationDuePressures = new Uint32Array(this.candidateCapacity);
    this.basisTownRuleOwnerVersions = new Uint32Array(this.candidateCapacity);
    this.basisNightWatchPolicyKnown = new Uint8Array(this.candidateCapacity);
  }

  get ownerVersion(): number {
    return this.ownerVersionValue;
  }

  get rosterVersion(): number {
    return this.rosterVersionValue;
  }

  get contentManifestHash(): string {
    return this.contentManifestHashValue;
  }

  get validationBasis(): string {
    return this.validationBasisValue;
  }

  loadCompiledRoster(input: M5CompiledAnomalyRosterInput): M5AnomalyRosterMutationResult {
    if (this.definitionCountValue > 0)
      return { ok: false, reason: "m5_anomaly_roster_already_loaded" };
    const valid = this.validateRoster(input);
    if (!valid.ok) return valid;
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    for (const definition of input.definitions) {
      this.writeDefinition(definition);
    }
    this.definitionCountValue = input.definitions.length;
    this.rosterVersionValue = input.rosterVersion;
    this.contentManifestHashValue = input.contentManifestHash;
    this.validationBasisValue = input.validationBasis;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "m5_anomaly_roster_compiled",
    };
  }

  registerActivationCandidate(
    input: M5AnomalyActivationCandidateInput,
  ): M5AnomalyRosterMutationResult {
    const valid = this.validateCandidate(input);
    if (!valid.ok) return valid;
    if ((this.candidateActive[input.candidateId] ?? 0) === 1)
      return { ok: false, reason: "m5_anomaly_roster_candidate_already_registered" };
    const nextVersion = this.nextVersion();
    if (!nextVersion.ok) return nextVersion;
    this.writeCandidate(input, nextVersion.ownerVersion);
    this.linkCandidate(input.candidateId);
    this.activeCandidateCountValue += 1;
    this.ownerVersionValue = nextVersion.ownerVersion;
    return {
      ok: true,
      changed: true,
      ownerVersion: this.ownerVersionValue,
      reason: "m5_anomaly_roster_activation_candidate_indexed",
    };
  }

  queryActivationCandidates(
    query: M5AnomalyActivationCandidateQuery,
    outputCandidateIds: Uint32Array,
  ): M5AnomalyActivationCandidateQueryResult {
    const valid = this.validateCandidateQuery(query, outputCandidateIds);
    if (!valid.ok) return valid;
    clearOutput(outputCandidateIds, query.selectedCap);
    let current = this.candidateHeadByDef[query.defIndex] ?? -1;
    let visited = 0;
    let selected = 0;
    let candidateCapHit = false;
    let selectedCapHit = false;
    while (current >= 0) {
      if (visited >= query.candidateCap) {
        candidateCapHit = true;
        break;
      }
      visited += 1;
      if ((this.candidateScores[current] ?? 0) >= query.minScore) {
        if (selected < query.selectedCap) {
          outputCandidateIds[selected] = current;
          selected += 1;
        } else {
          selectedCapHit = true;
        }
      }
      current = this.candidateNext[current] ?? -1;
    }
    this.lastCandidateVisits = visited;
    this.totalCandidateVisits += visited;
    if (candidateCapHit) this.candidateCapHitCount += 1;
    return {
      ok: true,
      selectedCount: selected,
      visitedCount: visited,
      candidateCapHit,
      selectedCapHit,
      ownerVersion: this.ownerVersionValue,
      reason: candidateReason(selected, candidateCapHit, selectedCapHit),
    };
  }

  readDefinition(defIndex: number): M5AnomalyDefinitionView | undefined {
    if (!isIndex(defIndex, this.definitionCapacity) || (this.definitionActive[defIndex] ?? 0) === 0)
      return undefined;
    return {
      defId: this.definitionIds[defIndex] ?? "",
      defIndex,
      contentDefIndex: this.contentDefIndexes[defIndex] ?? M5_ANOMALY_NONE,
      kind: M5_ANOMALY_KIND,
      schemaVersion: this.schemaVersions[defIndex] ?? 0,
      ruleComponent: this.ruleComponents[defIndex] ?? 0,
      activationPolicy: this.activationPolicies[defIndex] ?? 0,
      stateOwnerKind: this.stateOwnerKinds[defIndex] ?? 0,
      minActivationScore: this.minActivationScores[defIndex] ?? 0,
      evidenceClassMask: this.evidenceClassMasks[defIndex] ?? 0,
      nonCombatResolutionMask: this.nonCombatResolutionMasks[defIndex] ?? 0,
      validationBasisHash: this.validationBasisHashes[defIndex] ?? "",
      rosterVersion: this.rosterVersionValue,
      contentManifestHash: this.contentManifestHashValue,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readCandidate(candidateId: number): M5AnomalyActivationCandidateView | undefined {
    if (
      !isIndex(candidateId, this.candidateCapacity) ||
      (this.candidateActive[candidateId] ?? 0) === 0
    )
      return undefined;
    return {
      candidateId,
      defIndex: this.candidateDefIndexes[candidateId] ?? M5_ANOMALY_NONE,
      stateOwnerId: this.candidateStateOwnerIds[candidateId] ?? M5_ANOMALY_NONE,
      score: this.candidateScores[candidateId] ?? 0,
      priority: this.candidatePriorities[candidateId] ?? 0,
      stableOwnerId: this.candidateStableOwnerIds[candidateId] ?? M5_ANOMALY_NONE,
      stableSequence: this.candidateStableSequences[candidateId] ?? M5_ANOMALY_NONE,
      rosterVersion: this.candidateRosterVersions[candidateId] ?? 0,
      contentManifestHash: this.contentManifestHashValue,
      borrowedShadowBasis: this.createBorrowedShadowBasis(candidateId),
      candidateVersion: this.candidateVersions[candidateId] ?? 0,
      ownerVersion: this.ownerVersionValue,
    };
  }

  readBorrowedShadowActivationBasis(
    candidateId: number,
  ): M4BorrowedShadowActivationBasis | undefined {
    if (
      !isIndex(candidateId, this.candidateCapacity) ||
      (this.candidateActive[candidateId] ?? 0) === 0
    )
      return undefined;
    return this.createBorrowedShadowBasis(candidateId);
  }

  createMetrics(): M5AnomalyRosterMetrics {
    return {
      ownerVersion: this.ownerVersionValue,
      rosterVersion: this.rosterVersionValue,
      definitionCount: this.definitionCountValue,
      activeCandidateCount: this.activeCandidateCountValue,
      lastCandidateVisits: this.lastCandidateVisits,
      totalCandidateVisits: this.totalCandidateVisits,
      candidateCapHitCount: this.candidateCapHitCount,
    };
  }

  private validateRoster(
    input: M5CompiledAnomalyRosterInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5AnomalyRosterReason } {
    if (!isPositiveUint32(input.rosterVersion))
      return { ok: false, reason: "m5_anomaly_roster_invalid_roster_version" };
    if (!isHash(input.contentManifestHash) || input.validationBasis.length === 0)
      return { ok: false, reason: "m5_anomaly_roster_invalid_hash" };
    if (input.definitions.length === 0 || input.definitions.length > this.definitionCapacity)
      return { ok: false, reason: "m5_anomaly_roster_definition_capacity_exceeded" };
    let sawBorrowedShadow = false;
    for (let index = 0; index < input.definitions.length; index += 1) {
      const definition = input.definitions[index];
      if (definition === undefined)
        return { ok: false, reason: "m5_anomaly_roster_invalid_definition" };
      if (definition.defIndex !== index)
        return { ok: false, reason: "m5_anomaly_roster_definition_order_invalid" };
      const validDefinition = validateDefinition(definition);
      if (!validDefinition.ok) return validDefinition;
      if (definition.defId === M5_ANOMALY_DEF_BORROWED_SHADOW) {
        sawBorrowedShadow = true;
      }
      for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
        if (definition.defId === input.definitions[previousIndex]?.defId)
          return { ok: false, reason: "m5_anomaly_roster_definition_duplicate" };
      }
    }
    return sawBorrowedShadow
      ? { ok: true }
      : { ok: false, reason: "m5_anomaly_roster_missing_borrowed_shadow" };
  }

  private validateCandidate(
    input: M5AnomalyActivationCandidateInput,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5AnomalyRosterReason } {
    if (this.definitionCountValue === 0)
      return { ok: false, reason: "m5_anomaly_roster_not_loaded" };
    if (!isIndex(input.candidateId, this.candidateCapacity))
      return { ok: false, reason: "m5_anomaly_roster_candidate_id_out_of_range" };
    if (!this.hasDefinition(input.defIndex))
      return { ok: false, reason: "m5_anomaly_roster_definition_not_registered" };
    if (!matchesBasis(input.rosterVersion, input.contentManifestHash, this))
      return { ok: false, reason: "m5_anomaly_roster_stale_content_basis" };
    if (
      !isUint32(input.stateOwnerId) ||
      !isScore(input.score) ||
      !isUint32(input.priority) ||
      !isUint32(input.stableOwnerId) ||
      !isUint32(input.stableSequence)
    )
      return { ok: false, reason: "m5_anomaly_roster_value_out_of_range" };
    if (input.borrowedShadowBasis.candidateId !== input.candidateId)
      return { ok: false, reason: "m5_anomaly_roster_value_out_of_range" };
    return validateBorrowedShadowBasis(input.borrowedShadowBasis);
  }

  private validateCandidateQuery(
    query: M5AnomalyActivationCandidateQuery,
    output: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M5AnomalyRosterReason } {
    if (this.definitionCountValue === 0)
      return { ok: false, reason: "m5_anomaly_roster_not_loaded" };
    if (!this.hasDefinition(query.defIndex))
      return { ok: false, reason: "m5_anomaly_roster_definition_not_registered" };
    if (!matchesBasis(query.rosterVersion, query.contentManifestHash, this))
      return { ok: false, reason: "m5_anomaly_roster_stale_content_basis" };
    if (!isPositive(query.candidateCap))
      return { ok: false, reason: "m5_anomaly_roster_candidate_cap_invalid" };
    if (!isPositive(query.selectedCap))
      return { ok: false, reason: "m5_anomaly_roster_selected_cap_invalid" };
    if (output.length < query.selectedCap)
      return { ok: false, reason: "m5_anomaly_roster_output_too_small" };
    return isScore(query.minScore)
      ? { ok: true }
      : { ok: false, reason: "m5_anomaly_roster_value_out_of_range" };
  }

  private hasDefinition(defIndex: number): boolean {
    return (
      isIndex(defIndex, this.definitionCapacity) && (this.definitionActive[defIndex] ?? 0) === 1
    );
  }

  private writeDefinition(definition: M5CompiledAnomalyDefinitionInput): void {
    const defIndex = definition.defIndex;
    this.definitionActive[defIndex] = 1;
    this.definitionIds[defIndex] = definition.defId;
    this.contentDefIndexes[defIndex] = definition.contentDefIndex;
    this.schemaVersions[defIndex] = definition.schemaVersion;
    this.ruleComponents[defIndex] = definition.ruleComponent;
    this.activationPolicies[defIndex] = definition.activationPolicy;
    this.stateOwnerKinds[defIndex] = definition.stateOwnerKind;
    this.minActivationScores[defIndex] = definition.minActivationScore;
    this.evidenceClassMasks[defIndex] = definition.evidenceClassMask;
    this.nonCombatResolutionMasks[defIndex] = definition.nonCombatResolutionMask;
    this.validationBasisHashes[defIndex] = definition.validationBasisHash;
  }

  private writeCandidate(input: M5AnomalyActivationCandidateInput, version: number): void {
    const id = input.candidateId;
    this.candidateActive[id] = 1;
    this.candidateDefIndexes[id] = input.defIndex;
    this.candidateStateOwnerIds[id] = input.stateOwnerId;
    this.candidateScores[id] = input.score;
    this.candidatePriorities[id] = input.priority;
    this.candidateStableOwnerIds[id] = input.stableOwnerId;
    this.candidateStableSequences[id] = input.stableSequence;
    this.candidateRosterVersions[id] = input.rosterVersion;
    this.candidateVersions[id] = version;
    this.writeBorrowedShadowBasis(id, input.borrowedShadowBasis);
  }

  private writeBorrowedShadowBasis(id: number, basis: M4BorrowedShadowActivationBasis): void {
    this.basisTargets[id] = basis.targetActorId;
    this.basisLamps[id] = basis.lampId;
    this.basisLampGapScores[id] = basis.lampGapScore;
    this.basisHumanClaims[id] = basis.humanClaim;
    this.basisLampGapSourceVersions[id] = basis.lampGapSourceVersion;
    this.basisLampGapIndexVersions[id] = basis.lampGapIndexVersion;
    this.basisCaseIds[id] = basis.identityCaseId;
    this.basisHypothesisIds[id] = basis.identityHypothesisId;
    this.basisSupportTiers[id] = basis.identitySupportTier;
    this.basisSupportScores[id] = basis.identitySupportScore;
    this.basisClassCounts[id] = basis.identityIndependentClassCount;
    this.basisIdentityConfirmed[id] = basis.identityConfirmed;
    this.basisEvidenceOwnerVersions[id] = basis.evidenceOwnerVersion;
    this.basisObligationOwnerVersions[id] = basis.obligationOwnerVersion;
    this.basisObligationDuePressures[id] = basis.obligationDuePressure;
    this.basisTownRuleOwnerVersions[id] = basis.townRuleOwnerVersion;
    this.basisNightWatchPolicyKnown[id] = basis.nightWatchPolicyKnown;
  }

  private createBorrowedShadowBasis(candidateId: number): M4BorrowedShadowActivationBasis {
    return {
      candidateId,
      targetActorId: this.basisTargets[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      lampId: this.basisLamps[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      lampGapScore: this.basisLampGapScores[candidateId] ?? 0,
      humanClaim: this.basisHumanClaims[candidateId] ?? 0,
      lampGapSourceVersion: this.basisLampGapSourceVersions[candidateId] ?? 0,
      lampGapIndexVersion: this.basisLampGapIndexVersions[candidateId] ?? 0,
      identityCaseId: this.basisCaseIds[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      identityHypothesisId: this.basisHypothesisIds[candidateId] ?? M4_BORROWED_SHADOW_NONE,
      identitySupportTier: this.basisSupportTiers[candidateId] ?? 0,
      identitySupportScore: this.basisSupportScores[candidateId] ?? 0,
      identityIndependentClassCount: this.basisClassCounts[candidateId] ?? 0,
      identityConfirmed: this.basisIdentityConfirmed[candidateId] ?? 0,
      evidenceOwnerVersion: this.basisEvidenceOwnerVersions[candidateId] ?? 0,
      obligationOwnerVersion: this.basisObligationOwnerVersions[candidateId] ?? 0,
      obligationDuePressure: this.basisObligationDuePressures[candidateId] ?? 0,
      townRuleOwnerVersion: this.basisTownRuleOwnerVersions[candidateId] ?? 0,
      nightWatchPolicyKnown: this.basisNightWatchPolicyKnown[candidateId] ?? 0,
    };
  }

  private linkCandidate(candidateId: number): void {
    const defIndex = this.candidateDefIndexes[candidateId] ?? M5_ANOMALY_NONE;
    let current = this.candidateHeadByDef[defIndex] ?? -1;
    let previous = -1;
    while (current >= 0 && this.isCandidateBefore(current, candidateId)) {
      previous = current;
      current = this.candidateNext[current] ?? -1;
    }
    this.candidatePrevious[candidateId] = previous;
    this.candidateNext[candidateId] = current;
    if (previous >= 0) this.candidateNext[previous] = candidateId;
    else this.candidateHeadByDef[defIndex] = candidateId;
    if (current >= 0) this.candidatePrevious[current] = candidateId;
  }

  private nextVersion():
    | { readonly ok: true; readonly ownerVersion: number }
    | { readonly ok: false; readonly reason: "m5_anomaly_roster_version_exhausted" } {
    if (this.ownerVersionValue >= 0xffff_ffff)
      return { ok: false, reason: "m5_anomaly_roster_version_exhausted" };
    return { ok: true, ownerVersion: this.ownerVersionValue + 1 };
  }

  private isCandidateBefore(current: number, next: number): boolean {
    const currentScore = this.candidateScores[current] ?? 0;
    const nextScore = this.candidateScores[next] ?? 0;
    if (currentScore !== nextScore) return currentScore > nextScore;
    const currentPriority = this.candidatePriorities[current] ?? 0;
    const nextPriority = this.candidatePriorities[next] ?? 0;
    if (currentPriority !== nextPriority) return currentPriority > nextPriority;
    const currentOwner = this.candidateStableOwnerIds[current] ?? M5_ANOMALY_NONE;
    const nextOwner = this.candidateStableOwnerIds[next] ?? M5_ANOMALY_NONE;
    if (currentOwner !== nextOwner) return currentOwner < nextOwner;
    const currentSequence = this.candidateStableSequences[current] ?? M5_ANOMALY_NONE;
    const nextSequence = this.candidateStableSequences[next] ?? M5_ANOMALY_NONE;
    return currentSequence !== nextSequence ? currentSequence < nextSequence : current < next;
  }
}

export function createM5AnomalyRosterStore(
  options: M5AnomalyRosterStoreOptions,
): M5AnomalyRosterStore {
  return new M5AnomalyRosterStore(options);
}

export function createM5BorrowedShadowAnomalyDefinition(
  defIndex = 0,
  contentDefIndex = 0,
  validationBasisHash = "m5.borrowed_shadow.rule.v1",
): M5CompiledAnomalyDefinitionInput {
  return {
    defId: M5_ANOMALY_DEF_BORROWED_SHADOW,
    defIndex,
    contentDefIndex,
    kind: M5_ANOMALY_KIND,
    schemaVersion: M5_ANOMALY_ROSTER_SNAPSHOT_VERSION,
    ruleComponent: M5_ANOMALY_RULE_COMPONENT_BORROWED_SHADOW,
    activationPolicy: M5_ANOMALY_ACTIVATION_POLICY_BORROWED_SHADOW_LAMP_IDENTITY,
    stateOwnerKind: M5_ANOMALY_STATE_OWNER_BORROWED_SHADOW_CRISIS,
    minActivationScore: M4_BORROWED_SHADOW_MIN_GAP_SCORE,
    evidenceClassMask: M5_BORROWED_SHADOW_EVIDENCE_MASK,
    nonCombatResolutionMask: M5_BORROWED_SHADOW_NON_COMBAT_MASK,
    validationBasisHash,
  };
}

export function createM5ThirdKnockAnomalyDefinition(
  defIndex = 1,
  contentDefIndex = 1,
  validationBasisHash = "m5.third_knock.rule.v1",
): M5CompiledAnomalyDefinitionInput {
  return {
    defId: M5_ANOMALY_DEF_THIRD_KNOCK,
    defIndex,
    contentDefIndex,
    kind: M5_ANOMALY_KIND,
    schemaVersion: M5_ANOMALY_ROSTER_SNAPSHOT_VERSION,
    ruleComponent: M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK,
    activationPolicy: M5_ANOMALY_ACTIVATION_POLICY_THIRD_KNOCK_THRESHOLD_INVITATION,
    stateOwnerKind: M5_ANOMALY_STATE_OWNER_THIRD_KNOCK_CRISIS,
    minActivationScore: M5_THIRD_KNOCK_MIN_INVITATION_SCORE,
    evidenceClassMask: M5_THIRD_KNOCK_EVIDENCE_MASK,
    nonCombatResolutionMask: M5_THIRD_KNOCK_NON_COMBAT_MASK,
    validationBasisHash,
  };
}

function validateDefinition(
  definition: M5CompiledAnomalyDefinitionInput,
): { readonly ok: true } | { readonly ok: false; readonly reason: M5AnomalyRosterReason } {
  if (
    definition.defId.length === 0 ||
    definition.kind !== M5_ANOMALY_KIND ||
    !isUint32(definition.contentDefIndex) ||
    !isPositive(definition.schemaVersion) ||
    !isPositive(definition.ruleComponent) ||
    !isPositive(definition.activationPolicy) ||
    !isPositive(definition.stateOwnerKind) ||
    !isScore(definition.minActivationScore) ||
    !isUint32(definition.evidenceClassMask) ||
    !isUint32(definition.nonCombatResolutionMask) ||
    !isHash(definition.validationBasisHash)
  )
    return { ok: false, reason: "m5_anomaly_roster_invalid_definition" };
  if (
    definition.defId === M5_ANOMALY_DEF_BORROWED_SHADOW &&
    (definition.ruleComponent !== M5_ANOMALY_RULE_COMPONENT_BORROWED_SHADOW ||
      definition.activationPolicy !== M5_ANOMALY_ACTIVATION_POLICY_BORROWED_SHADOW_LAMP_IDENTITY ||
      definition.stateOwnerKind !== M5_ANOMALY_STATE_OWNER_BORROWED_SHADOW_CRISIS ||
      definition.schemaVersion !== M5_ANOMALY_ROSTER_SNAPSHOT_VERSION ||
      definition.minActivationScore !== M4_BORROWED_SHADOW_MIN_GAP_SCORE ||
      definition.evidenceClassMask !== M5_BORROWED_SHADOW_EVIDENCE_MASK ||
      definition.nonCombatResolutionMask !== M5_BORROWED_SHADOW_NON_COMBAT_MASK)
  )
    return { ok: false, reason: "m5_anomaly_roster_invalid_definition" };
  if (
    definition.defId === M5_ANOMALY_DEF_THIRD_KNOCK &&
    (definition.ruleComponent !== M5_ANOMALY_RULE_COMPONENT_THIRD_KNOCK ||
      definition.activationPolicy !==
        M5_ANOMALY_ACTIVATION_POLICY_THIRD_KNOCK_THRESHOLD_INVITATION ||
      definition.stateOwnerKind !== M5_ANOMALY_STATE_OWNER_THIRD_KNOCK_CRISIS ||
      definition.schemaVersion !== M5_ANOMALY_ROSTER_SNAPSHOT_VERSION ||
      definition.minActivationScore !== M5_THIRD_KNOCK_MIN_INVITATION_SCORE ||
      definition.evidenceClassMask !== M5_THIRD_KNOCK_EVIDENCE_MASK ||
      definition.nonCombatResolutionMask !== M5_THIRD_KNOCK_NON_COMBAT_MASK)
  )
    return { ok: false, reason: "m5_anomaly_roster_invalid_definition" };
  return { ok: true };
}

function validateBorrowedShadowBasis(
  basis: M4BorrowedShadowActivationBasis,
): { readonly ok: true } | { readonly ok: false; readonly reason: M5AnomalyRosterReason } {
  if (
    basis.lampGapSourceVersion === 0 ||
    basis.lampGapIndexVersion === 0 ||
    basis.evidenceOwnerVersion === 0
  )
    return { ok: false, reason: "m5_anomaly_roster_basis_version_invalid" };
  if (
    !isUint32(basis.targetActorId) ||
    !isUint32(basis.lampId) ||
    !isScore(basis.lampGapScore) ||
    !isScore(basis.humanClaim) ||
    !isPositiveUint32(basis.lampGapSourceVersion) ||
    !isPositiveUint32(basis.lampGapIndexVersion) ||
    !isUint32(basis.identityCaseId) ||
    !isUint32(basis.identityHypothesisId) ||
    !isEvidenceSupportTier(basis.identitySupportTier) ||
    !isScore(basis.identitySupportScore) ||
    !isIdentityClassCount(basis.identityIndependentClassCount) ||
    !isFlag(basis.identityConfirmed) ||
    !isPositiveUint32(basis.evidenceOwnerVersion) ||
    !isUint32(basis.obligationOwnerVersion) ||
    !isScore(basis.obligationDuePressure) ||
    !isUint32(basis.townRuleOwnerVersion) ||
    !isFlag(basis.nightWatchPolicyKnown)
  )
    return { ok: false, reason: "m5_anomaly_roster_value_out_of_range" };
  return { ok: true };
}

function matchesBasis(
  rosterVersion: number,
  contentManifestHash: string,
  store: M5AnomalyRosterStore,
): boolean {
  return rosterVersion === store.rosterVersion && contentManifestHash === store.contentManifestHash;
}

function candidateReason(
  selected: number,
  candidateCapHit: boolean,
  selectedCapHit: boolean,
): M5AnomalyRosterReason {
  if (candidateCapHit) return "m5_anomaly_roster_activation_candidate_cap_reached";
  if (selectedCapHit) return "m5_anomaly_roster_activation_selected_cap_reached";
  return selected === 0
    ? "m5_anomaly_roster_activation_no_candidate"
    : "m5_anomaly_roster_activation_candidate_indexed";
}

function isEvidenceSupportTier(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= M4_EVIDENCE_TIER_CONFIRMED;
}

function isIdentityClassCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 4;
}

function isFlag(value: number): boolean {
  return value === 0 || value === 1;
}

function isScore(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000;
}

function isIndex(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function isPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isHash(value: string): boolean {
  return value.length > 0 && value.length <= 128;
}

function requirePositive(value: number, label: string): number {
  if (!isPositive(value)) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function clearOutput(output: Uint32Array, count: number): void {
  for (let index = 0; index < count; index += 1) output[index] = M5_ANOMALY_NONE;
}

function filledUint32(length: number): Uint32Array {
  const values = new Uint32Array(length);
  values.fill(M5_ANOMALY_NONE);
  return values;
}

function filledInt32(length: number): Int32Array {
  const values = new Int32Array(length);
  values.fill(-1);
  return values;
}
