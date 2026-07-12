import { mixUint32 } from "./deterministic-hash";
import { assertValidCapacity } from "./entity-id";
import {
  M3_ABILITY_LANE_COUNT,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_INJURY,
  M3_HEALTH_CONDITION_RECOVERING,
  type M3AbilityCacheStore,
  type M3AbilityQueryIntoOutput,
  type M3HealthConditionStore,
  type M3HealthConditionView,
} from "./m3-health";

export const M3_MEDICAL_CARE_SNAPSHOT_VERSION = 1;
export const M3_MEDICAL_DEFAULT_CANDIDATE_CAP = 24;
export const M3_MEDICAL_DEFAULT_SELECTED_CAP = 12;
export const M3_MEDICAL_DEFAULT_EXACT_PATH_CAP = 4;
export const M3_MEDICAL_NO_REQUEST = 0xffff_ffff;

export type M3MedicalReason =
  | "medical.offer_created"
  | "medical.offer_removed"
  | "medical.no_patient"
  | "medical.rejected_invalid_condition"
  | "medical.rejected_patient_not_injured"
  | "medical.rejected_caregiver_ability"
  | "medical.rejected_permission"
  | "medical.rejected_stale_owner_state"
  | "medical.candidate_cap_reached"
  | "medical.selection_empty"
  | "medical.request_id_out_of_range"
  | "medical.actor_out_of_range"
  | "medical.condition_id_out_of_range"
  | "medical.region_out_of_range"
  | "medical.urgency_out_of_range"
  | "medical.permission_out_of_range"
  | "medical.ability_lane_out_of_range"
  | "medical.value_out_of_range"
  | "medical.selected_buffer_too_small";

export interface M3MedicalPatientRequestInput {
  readonly requestId: number;
  readonly patientId: number;
  readonly conditionId: number;
  readonly regionId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
  readonly treatmentDefId: number;
  readonly stockDefId: number;
  readonly stockAmount: number;
  readonly targetCellIndex: number;
  readonly scoreMilli: number;
}

export interface M3MedicalCaregiverStateInput {
  readonly caregiverId: number;
  readonly regionId: number;
  readonly permissionId: number;
  readonly ability: number;
  readonly minimumValue: number;
  readonly allowed: boolean;
}

export interface M3MedicalPatientRequestView extends M3MedicalPatientRequestInput {
  readonly conditionVersion: number;
  readonly actorConditionVersion: number;
  readonly healthStoreVersion: number;
  readonly severity: number;
  readonly clueRef: number;
  readonly counterevidenceRef: number;
}

export interface M3MedicalPatientRequestIntoOutput {
  ok: boolean;
  reason: M3MedicalReason | undefined;
  requestId: number;
  active: boolean;
  patientId: number;
  conditionId: number;
  regionId: number;
  urgencyBucket: number;
  permissionId: number;
  treatmentDefId: number;
  stockDefId: number;
  stockAmount: number;
  targetCellIndex: number;
  scoreMilli: number;
  conditionVersion: number;
  actorConditionVersion: number;
  healthStoreVersion: number;
  severity: number;
  clueRef: number;
  counterevidenceRef: number;
  medicalStoreVersion: number;
}

export interface M3MedicalCaregiverStateView extends M3MedicalCaregiverStateInput {
  readonly abilityValue: number;
  readonly actorConditionVersion: number;
  readonly baseAbilityVersion: number;
  readonly valid: boolean;
}

export interface M3MedicalCaregiverStateIntoOutput {
  ok: boolean;
  reason: M3MedicalReason | undefined;
  caregiverId: number;
  valid: boolean;
  regionId: number;
  permissionId: number;
  ability: number;
  minimumValue: number;
  allowed: boolean;
  abilityValue: number;
  actorConditionVersion: number;
  baseAbilityVersion: number;
  medicalStoreVersion: number;
}

export type M3MedicalMutationResult =
  | {
      readonly ok: true;
      readonly reason: Extract<M3MedicalReason, "medical.offer_created" | "medical.offer_removed">;
      readonly version: number;
    }
  | { readonly ok: false; readonly reason: M3MedicalReason };

export interface M3MedicalSelectionOptions {
  readonly caregiverId: number;
  readonly regionId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
  readonly candidateCap: number;
  readonly maxSelectedRequests: number;
}

export interface M3MedicalSelectionScratch {
  readonly selectedRequestIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
}

export interface M3MedicalSelectionIntoScratch {
  readonly patientReadOutput: M3MedicalPatientRequestIntoOutput;
  readonly caregiverReadOutput: M3MedicalCaregiverStateIntoOutput;
  readonly abilityQueryOutput: M3AbilityQueryIntoOutput;
  readonly requestIds: Uint32Array;
  readonly patientIds: Uint32Array;
  readonly conditionIds: Uint32Array;
  readonly regionIds: Uint32Array;
  readonly urgencyBuckets: Uint32Array;
  readonly permissionIds: Uint32Array;
  readonly treatmentDefIds: Uint32Array;
  readonly stockDefIds: Uint32Array;
  readonly stockAmounts: Uint32Array;
  readonly targetCellIndexes: Uint32Array;
  readonly scoresMilli: Int32Array;
  readonly conditionVersions: Uint32Array;
  readonly actorConditionVersions: Uint32Array;
  readonly healthStoreVersions: Uint32Array;
  readonly severities: Uint16Array;
  readonly clueRefs: Uint32Array;
  readonly counterevidenceRefs: Uint32Array;
}

export interface M3MedicalSelectionIntoOutput {
  ok: boolean;
  reason: M3MedicalReason | undefined;
  queryCaregiverId: number;
  queryRegionId: number;
  queryUrgencyBucket: number;
  queryPermissionId: number;
  candidateCap: number;
  maxSelectedRequests: number;
  bucketCandidateCount: number;
  visitedCount: number;
  scoredCount: number;
  selectedCount: number;
  candidateCapHit: boolean;
  selectedCapHit: boolean;
  rejectedByCandidateCap: number;
  rejectedByPermission: number;
  rejectedByAbility: number;
  rejectedByCondition: number;
  rejectedByStaleBasis: number;
  selectedRequestId: number;
  selectedPatientId: number;
  selectedConditionId: number;
  selectedRegionId: number;
  selectedUrgencyBucket: number;
  selectedPermissionId: number;
  selectedTreatmentDefId: number;
  selectedStockDefId: number;
  selectedStockAmount: number;
  selectedTargetCellIndex: number;
  selectedScoreMilli: number;
  selectedConditionVersion: number;
  selectedActorConditionVersion: number;
  selectedHealthStoreVersion: number;
  selectedSeverity: number;
  selectedClueRef: number;
  selectedCounterevidenceRef: number;
  selectedCaregiverId: number;
  caregiverRegionId: number;
  caregiverPermissionId: number;
  caregiverAbility: number;
  caregiverMinimumValue: number;
  caregiverAbilityValue: number;
  caregiverActorConditionVersion: number;
  caregiverBaseAbilityVersion: number;
  caregiverValid: boolean;
  caregiverAllowed: boolean;
  medicalStoreVersion: number;
  healthStoreVersion: number;
}

export type M3MedicalSelectionResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly bucketCandidateCount: number;
      readonly visitedCount: number;
      readonly scoredCount: number;
      readonly rejectedByCandidateCap: number;
      readonly rejectedByPermission: number;
      readonly rejectedByAbility: number;
      readonly rejectedByCondition: number;
      readonly rejectedByStaleBasis: number;
      readonly selectedRequestId: number;
      readonly reason: "medical.offer_created" | "medical.candidate_cap_reached";
    }
  | { readonly ok: false; readonly reason: M3MedicalReason };

export interface M3MedicalMetrics {
  readonly version: number;
  readonly activePatientRequestCount: number;
  readonly caregiverStateCount: number;
  readonly offerCreatedCount: number;
  readonly offerRemovedCount: number;
  readonly selectionCount: number;
  readonly candidateVisitedCount: number;
  readonly candidateCapHitCount: number;
  readonly permissionRejectCount: number;
  readonly abilityRejectCount: number;
  readonly conditionRejectCount: number;
  readonly staleBasisRejectCount: number;
}

type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: M3MedicalReason };

export class M3MedicalCareStore {
  readonly requestCapacity: number;
  readonly actorCapacity: number;
  readonly regionCapacity: number;
  readonly urgencyBucketCount: number;
  readonly permissionCapacity: number;

  private readonly activeRequests: Uint8Array;
  private readonly patientIds: Uint32Array;
  private readonly conditionIds: Uint32Array;
  private readonly regionIds: Uint32Array;
  private readonly urgencyBuckets: Uint32Array;
  private readonly permissionIds: Uint32Array;
  private readonly treatmentDefIds: Uint32Array;
  private readonly stockDefIds: Uint32Array;
  private readonly stockAmounts: Uint32Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly scoresMilli: Int32Array;
  private readonly conditionVersions: Uint32Array;
  private readonly actorConditionVersions: Uint32Array;
  private readonly healthStoreVersions: Uint32Array;
  private readonly severities: Uint16Array;
  private readonly clueRefs: Uint32Array;
  private readonly counterevidenceRefs: Uint32Array;
  private readonly bucketHeads: Int32Array;
  private readonly bucketCounts: Uint32Array;
  private readonly nextByBucket: Int32Array;
  private readonly previousByBucket: Int32Array;
  private readonly caregiverValid: Uint8Array;
  private readonly caregiverAllowed: Uint8Array;
  private readonly caregiverRegions: Uint32Array;
  private readonly caregiverPermissions: Uint32Array;
  private readonly caregiverAbilities: Uint8Array;
  private readonly caregiverMinimums: Uint16Array;
  private readonly caregiverValues: Uint16Array;
  private readonly caregiverConditionVersions: Uint32Array;
  private readonly caregiverBaseAbilityVersions: Uint32Array;
  private activeRequestCount = 0;
  private caregiverStateCount = 0;
  private storeVersion = 0;
  private createdCount = 0;
  private removedCount = 0;
  private selectionCount = 0;
  private visitedTotal = 0;
  private capHitCount = 0;
  private permissionRejectCount = 0;
  private abilityRejectCount = 0;
  private conditionRejectCount = 0;
  private staleRejectCount = 0;

  constructor(options: {
    readonly requestCapacity: number;
    readonly actorCapacity: number;
    readonly regionCapacity: number;
    readonly urgencyBucketCount: number;
    readonly permissionCapacity: number;
  }) {
    assertValidCapacity(options.requestCapacity, "M3 medical request capacity");
    assertValidCapacity(options.actorCapacity, "M3 medical actor capacity");
    assertValidCapacity(options.regionCapacity, "M3 medical region capacity");
    assertValidCapacity(options.urgencyBucketCount, "M3 medical urgency capacity");
    assertValidCapacity(options.permissionCapacity, "M3 medical permission capacity");
    this.requestCapacity = options.requestCapacity;
    this.actorCapacity = options.actorCapacity;
    this.regionCapacity = options.regionCapacity;
    this.urgencyBucketCount = options.urgencyBucketCount;
    this.permissionCapacity = options.permissionCapacity;
    this.activeRequests = new Uint8Array(options.requestCapacity);
    this.patientIds = new Uint32Array(options.requestCapacity);
    this.conditionIds = new Uint32Array(options.requestCapacity);
    this.regionIds = new Uint32Array(options.requestCapacity);
    this.urgencyBuckets = new Uint32Array(options.requestCapacity);
    this.permissionIds = new Uint32Array(options.requestCapacity);
    this.treatmentDefIds = new Uint32Array(options.requestCapacity);
    this.stockDefIds = new Uint32Array(options.requestCapacity);
    this.stockAmounts = new Uint32Array(options.requestCapacity);
    this.targetCellIndexes = new Uint32Array(options.requestCapacity);
    this.scoresMilli = new Int32Array(options.requestCapacity);
    this.conditionVersions = new Uint32Array(options.requestCapacity);
    this.actorConditionVersions = new Uint32Array(options.requestCapacity);
    this.healthStoreVersions = new Uint32Array(options.requestCapacity);
    this.severities = new Uint16Array(options.requestCapacity);
    this.clueRefs = new Uint32Array(options.requestCapacity);
    this.counterevidenceRefs = new Uint32Array(options.requestCapacity);
    this.bucketHeads = createEmptyLinks(
      options.regionCapacity * options.urgencyBucketCount * options.permissionCapacity,
    );
    this.bucketCounts = new Uint32Array(
      options.regionCapacity * options.urgencyBucketCount * options.permissionCapacity,
    );
    this.nextByBucket = createEmptyLinks(options.requestCapacity);
    this.previousByBucket = createEmptyLinks(options.requestCapacity);
    this.caregiverValid = new Uint8Array(options.actorCapacity);
    this.caregiverAllowed = new Uint8Array(options.actorCapacity);
    this.caregiverRegions = new Uint32Array(options.actorCapacity);
    this.caregiverPermissions = new Uint32Array(options.actorCapacity);
    this.caregiverAbilities = new Uint8Array(options.actorCapacity);
    this.caregiverMinimums = new Uint16Array(options.actorCapacity);
    this.caregiverValues = new Uint16Array(options.actorCapacity);
    this.caregiverConditionVersions = new Uint32Array(options.actorCapacity);
    this.caregiverBaseAbilityVersions = new Uint32Array(options.actorCapacity);
  }

  get version(): number {
    return this.storeVersion;
  }

  upsertPatientRequestFromCondition(
    input: M3MedicalPatientRequestInput,
    health: M3HealthConditionStore,
  ): M3MedicalMutationResult {
    const validation = this.validateRequestInput(input);
    if (!validation.ok) {
      return validation;
    }
    const condition = health.readCondition(input.conditionId);
    const conditionValidation = validatePatientCondition(input, condition);
    if (!conditionValidation.ok) {
      return conditionValidation;
    }
    if (condition === undefined) {
      return { ok: false, reason: "medical.no_patient" };
    }
    if ((this.activeRequests[input.requestId] ?? 0) === 1) {
      this.unlinkRequest(input.requestId);
    } else {
      this.activeRequestCount += 1;
    }
    this.writeRequest(input, condition, health);
    this.linkRequest(input.requestId);
    this.createdCount += 1;
    this.storeVersion += 1;
    return { ok: true, reason: "medical.offer_created", version: this.storeVersion };
  }

  removePatientRequest(requestId: number): M3MedicalMutationResult {
    if (!isIndexInRange(requestId, this.requestCapacity)) {
      return { ok: false, reason: "medical.request_id_out_of_range" };
    }
    if ((this.activeRequests[requestId] ?? 0) !== 1) {
      return { ok: false, reason: "medical.no_patient" };
    }
    this.unlinkRequest(requestId);
    this.activeRequests[requestId] = 0;
    this.activeRequestCount -= 1;
    this.removedCount += 1;
    this.storeVersion += 1;
    return { ok: true, reason: "medical.offer_removed", version: this.storeVersion };
  }

  updateCaregiverStateFromAbility(
    input: M3MedicalCaregiverStateInput,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
  ): M3MedicalMutationResult {
    const validation = this.validateCaregiverInput(input);
    if (!validation.ok) {
      return validation;
    }
    const ability = abilities.queryAbility(
      input.caregiverId,
      input.ability,
      health,
      input.minimumValue,
    );
    if (!ability.ok) {
      this.writeCaregiver(input, 0, 0, 0, false);
      this.abilityRejectCount += 1;
      return { ok: false, reason: "medical.rejected_caregiver_ability" };
    }
    this.writeCaregiver(
      input,
      ability.value,
      ability.actorConditionVersion,
      ability.baseAbilityVersion,
      input.allowed,
    );
    if (!input.allowed) {
      this.permissionRejectCount += 1;
      return { ok: false, reason: "medical.rejected_permission" };
    }
    this.storeVersion += 1;
    return { ok: true, reason: "medical.offer_created", version: this.storeVersion };
  }

  selectTreatmentRequestsInto(
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): void {
    this.resetSelectionInto(options, health, scratch, output);
    if (!this.validateSelectionInto(options, scratch, output)) {
      return;
    }
    if (!this.prepareCaregiverInto(options, health, abilities, scratch, output)) {
      return;
    }

    const medicalVersion = this.storeVersion;
    const healthVersion = health.storeVersion;
    if (
      !this.collectTreatmentRequestsInto(
        options,
        health,
        medicalVersion,
        healthVersion,
        scratch,
        output,
      )
    ) {
      this.failSelectionInto(options, health, scratch, output);
      return;
    }
    if (
      !this.isMedicalSelectionBasisCurrent(
        options,
        health,
        abilities,
        medicalVersion,
        healthVersion,
        scratch,
        output,
      )
    ) {
      this.failSelectionInto(options, health, scratch, output);
      return;
    }
    this.finishSelectionInto(scratch, output);
  }

  selectTreatmentRequests(
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    scratch: M3MedicalSelectionScratch,
  ): M3MedicalSelectionResult {
    const validation = this.validateSelection(options, scratch);
    if (!validation.ok) {
      return validation;
    }
    const caregiver = this.readCaregiverState(options.caregiverId);
    if (caregiver === undefined || !caregiver.valid || !caregiver.allowed) {
      this.permissionRejectCount += 1;
      return { ok: false, reason: "medical.rejected_permission" };
    }
    if (
      caregiver.regionId !== options.regionId ||
      caregiver.permissionId !== options.permissionId ||
      caregiver.abilityValue < caregiver.minimumValue
    ) {
      this.abilityRejectCount += 1;
      return { ok: false, reason: "medical.rejected_caregiver_ability" };
    }
    clearSelectedScratch(scratch);
    const bucketHead = this.bucketHeads[this.bucketIndex(options)] ?? -1;
    let current = bucketHead;
    let visitedCount = 0;
    let scoredCount = 0;
    let rejectedByCondition = 0;
    let rejectedByStaleBasis = 0;
    while (current >= 0 && visitedCount < options.candidateCap) {
      visitedCount += 1;
      const condition = health.readCondition(this.conditionIds[current] ?? 0);
      const checked = this.validateRequestAgainstCondition(current, condition, health);
      if (checked === "ok") {
        scoredCount += 1;
        insertSelectedRequest(current, this.scoresMilli[current] ?? 0, scratch, options);
      } else if (checked === "medical.rejected_stale_owner_state") {
        rejectedByStaleBasis += 1;
      } else {
        rejectedByCondition += 1;
      }
      current = this.nextByBucket[current] ?? -1;
    }
    this.selectionCount += 1;
    this.visitedTotal += visitedCount;
    const rejectedByCandidateCap = current >= 0 ? 1 : 0;
    this.capHitCount += rejectedByCandidateCap > 0 ? 1 : 0;
    this.conditionRejectCount += rejectedByCondition;
    this.staleRejectCount += rejectedByStaleBasis;
    const selectedCount = countSelected(scratch.selectedRequestIds);
    if (selectedCount === 0) {
      return {
        ok: false,
        reason: visitedCount === 0 ? "medical.selection_empty" : "medical.no_patient",
      };
    }
    return {
      ok: true,
      selectedCount,
      bucketCandidateCount: visitedCount,
      visitedCount,
      scoredCount,
      rejectedByCandidateCap,
      rejectedByPermission: 0,
      rejectedByAbility: 0,
      rejectedByCondition,
      rejectedByStaleBasis,
      selectedRequestId: scratch.selectedRequestIds[0] ?? M3_MEDICAL_NO_REQUEST,
      reason:
        rejectedByCandidateCap > 0 ? "medical.candidate_cap_reached" : "medical.offer_created",
    };
  }

  readPatientRequest(requestId: number): M3MedicalPatientRequestView | undefined {
    if (!this.isActiveRequest(requestId)) {
      return undefined;
    }
    return {
      requestId,
      patientId: this.patientIds[requestId] ?? 0,
      conditionId: this.conditionIds[requestId] ?? 0,
      regionId: this.regionIds[requestId] ?? 0,
      urgencyBucket: this.urgencyBuckets[requestId] ?? 0,
      permissionId: this.permissionIds[requestId] ?? 0,
      treatmentDefId: this.treatmentDefIds[requestId] ?? 0,
      stockDefId: this.stockDefIds[requestId] ?? 0,
      stockAmount: this.stockAmounts[requestId] ?? 0,
      targetCellIndex: this.targetCellIndexes[requestId] ?? 0,
      scoreMilli: this.scoresMilli[requestId] ?? 0,
      conditionVersion: this.conditionVersions[requestId] ?? 0,
      actorConditionVersion: this.actorConditionVersions[requestId] ?? 0,
      healthStoreVersion: this.healthStoreVersions[requestId] ?? 0,
      severity: this.severities[requestId] ?? 0,
      clueRef: this.clueRefs[requestId] ?? 0,
      counterevidenceRef: this.counterevidenceRefs[requestId] ?? 0,
    };
  }

  readPatientRequestInto(requestId: number, output: M3MedicalPatientRequestIntoOutput): void {
    this.resetPatientRequestInto(requestId, output);
    if (!isIndexInRange(requestId, this.requestCapacity)) {
      output.reason = "medical.request_id_out_of_range";
      return;
    }
    if ((this.activeRequests[requestId] ?? 0) !== 1) {
      output.reason = "medical.no_patient";
      return;
    }

    output.ok = true;
    output.active = true;
    output.patientId = this.patientIds[requestId] ?? 0;
    output.conditionId = this.conditionIds[requestId] ?? 0;
    output.regionId = this.regionIds[requestId] ?? 0;
    output.urgencyBucket = this.urgencyBuckets[requestId] ?? 0;
    output.permissionId = this.permissionIds[requestId] ?? 0;
    output.treatmentDefId = this.treatmentDefIds[requestId] ?? 0;
    output.stockDefId = this.stockDefIds[requestId] ?? 0;
    output.stockAmount = this.stockAmounts[requestId] ?? 0;
    output.targetCellIndex = this.targetCellIndexes[requestId] ?? 0;
    output.scoreMilli = this.scoresMilli[requestId] ?? 0;
    output.conditionVersion = this.conditionVersions[requestId] ?? 0;
    output.actorConditionVersion = this.actorConditionVersions[requestId] ?? 0;
    output.healthStoreVersion = this.healthStoreVersions[requestId] ?? 0;
    output.severity = this.severities[requestId] ?? 0;
    output.clueRef = this.clueRefs[requestId] ?? 0;
    output.counterevidenceRef = this.counterevidenceRefs[requestId] ?? 0;
  }

  readCaregiverState(caregiverId: number): M3MedicalCaregiverStateView | undefined {
    if (
      !isIndexInRange(caregiverId, this.actorCapacity) ||
      this.caregiverValid[caregiverId] !== 1
    ) {
      return undefined;
    }
    return {
      caregiverId,
      regionId: this.caregiverRegions[caregiverId] ?? 0,
      permissionId: this.caregiverPermissions[caregiverId] ?? 0,
      ability: this.caregiverAbilities[caregiverId] ?? 0,
      minimumValue: this.caregiverMinimums[caregiverId] ?? 0,
      allowed: this.caregiverAllowed[caregiverId] === 1,
      abilityValue: this.caregiverValues[caregiverId] ?? 0,
      actorConditionVersion: this.caregiverConditionVersions[caregiverId] ?? 0,
      baseAbilityVersion: this.caregiverBaseAbilityVersions[caregiverId] ?? 0,
      valid: true,
    };
  }

  readCaregiverStateInto(caregiverId: number, output: M3MedicalCaregiverStateIntoOutput): void {
    this.resetCaregiverStateInto(caregiverId, output);
    if (!isIndexInRange(caregiverId, this.actorCapacity)) {
      output.reason = "medical.actor_out_of_range";
      return;
    }
    if ((this.caregiverValid[caregiverId] ?? 0) !== 1) {
      output.reason = "medical.rejected_caregiver_ability";
      return;
    }

    output.ok = true;
    output.valid = true;
    output.regionId = this.caregiverRegions[caregiverId] ?? 0;
    output.permissionId = this.caregiverPermissions[caregiverId] ?? 0;
    output.ability = this.caregiverAbilities[caregiverId] ?? 0;
    output.minimumValue = this.caregiverMinimums[caregiverId] ?? 0;
    output.allowed = (this.caregiverAllowed[caregiverId] ?? 0) === 1;
    output.abilityValue = this.caregiverValues[caregiverId] ?? 0;
    output.actorConditionVersion = this.caregiverConditionVersions[caregiverId] ?? 0;
    output.baseAbilityVersion = this.caregiverBaseAbilityVersions[caregiverId] ?? 0;
  }

  createMetrics(): M3MedicalMetrics {
    return {
      version: this.storeVersion,
      activePatientRequestCount: this.activeRequestCount,
      caregiverStateCount: this.caregiverStateCount,
      offerCreatedCount: this.createdCount,
      offerRemovedCount: this.removedCount,
      selectionCount: this.selectionCount,
      candidateVisitedCount: this.visitedTotal,
      candidateCapHitCount: this.capHitCount,
      permissionRejectCount: this.permissionRejectCount,
      abilityRejectCount: this.abilityRejectCount,
      conditionRejectCount: this.conditionRejectCount,
      staleBasisRejectCount: this.staleRejectCount,
    };
  }

  createHash(): number {
    let hash = mixUint32(0x6d65_6433, M3_MEDICAL_CARE_SNAPSHOT_VERSION);
    hash = mixUint32(hash, this.storeVersion);
    for (let requestId = 0; requestId < this.requestCapacity; requestId += 1) {
      if ((this.activeRequests[requestId] ?? 0) === 1) {
        hash = mixUint32(hash, requestId);
        hash = mixUint32(hash, this.patientIds[requestId] ?? 0);
        hash = mixUint32(hash, this.conditionIds[requestId] ?? 0);
        hash = mixUint32(hash, this.conditionVersions[requestId] ?? 0);
        hash = mixUint32(hash, this.severities[requestId] ?? 0);
      }
    }
    return hash;
  }

  private writeRequest(
    input: M3MedicalPatientRequestInput,
    condition: M3HealthConditionView,
    health: M3HealthConditionStore,
  ): void {
    this.activeRequests[input.requestId] = 1;
    this.patientIds[input.requestId] = input.patientId;
    this.conditionIds[input.requestId] = input.conditionId;
    this.regionIds[input.requestId] = input.regionId;
    this.urgencyBuckets[input.requestId] = input.urgencyBucket;
    this.permissionIds[input.requestId] = input.permissionId;
    this.treatmentDefIds[input.requestId] = input.treatmentDefId;
    this.stockDefIds[input.requestId] = input.stockDefId;
    this.stockAmounts[input.requestId] = input.stockAmount;
    this.targetCellIndexes[input.requestId] = input.targetCellIndex;
    this.scoresMilli[input.requestId] = input.scoreMilli;
    this.conditionVersions[input.requestId] = condition.conditionVersion;
    this.actorConditionVersions[input.requestId] = condition.actorConditionVersion;
    this.healthStoreVersions[input.requestId] = health.storeVersion;
    this.severities[input.requestId] = condition.severity;
    this.clueRefs[input.requestId] = condition.clueRef;
    this.counterevidenceRefs[input.requestId] = condition.counterevidenceRef;
  }

  private writeCaregiver(
    input: M3MedicalCaregiverStateInput,
    value: number,
    actorConditionVersion: number,
    baseAbilityVersion: number,
    allowed: boolean,
  ): void {
    if (this.caregiverValid[input.caregiverId] !== 1) {
      this.caregiverStateCount += 1;
    }
    this.caregiverValid[input.caregiverId] = 1;
    this.caregiverAllowed[input.caregiverId] = allowed ? 1 : 0;
    this.caregiverRegions[input.caregiverId] = input.regionId;
    this.caregiverPermissions[input.caregiverId] = input.permissionId;
    this.caregiverAbilities[input.caregiverId] = input.ability;
    this.caregiverMinimums[input.caregiverId] = input.minimumValue;
    this.caregiverValues[input.caregiverId] = value;
    this.caregiverConditionVersions[input.caregiverId] = actorConditionVersion;
    this.caregiverBaseAbilityVersions[input.caregiverId] = baseAbilityVersion;
  }

  private validateSelectionInto(
    options: M3MedicalSelectionOptions,
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): boolean {
    if (!isIndexInRange(options.caregiverId, this.actorCapacity)) {
      output.reason = "medical.actor_out_of_range";
      return false;
    }
    if (!isIndexInRange(options.regionId, this.regionCapacity)) {
      output.reason = "medical.region_out_of_range";
      return false;
    }
    if (!isIndexInRange(options.urgencyBucket, this.urgencyBucketCount)) {
      output.reason = "medical.urgency_out_of_range";
      return false;
    }
    if (!isIndexInRange(options.permissionId, this.permissionCapacity)) {
      output.reason = "medical.permission_out_of_range";
      return false;
    }
    if (
      !isPositiveSafeInteger(options.candidateCap) ||
      options.candidateCap > M3_MEDICAL_DEFAULT_CANDIDATE_CAP ||
      !isPositiveSafeInteger(options.maxSelectedRequests) ||
      options.maxSelectedRequests > M3_MEDICAL_DEFAULT_SELECTED_CAP
    ) {
      output.reason = "medical.value_out_of_range";
      return false;
    }
    if (!hasMedicalSelectionScratchCapacity(scratch)) {
      output.reason = "medical.selected_buffer_too_small";
      return false;
    }
    return true;
  }

  private resetSelectionInto(
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): void {
    this.readPatientRequestInto(M3_MEDICAL_NO_REQUEST, scratch.patientReadOutput);
    this.readCaregiverStateInto(M3_MEDICAL_NO_REQUEST, scratch.caregiverReadOutput);
    resetMedicalAbilityQueryOutput(scratch.abilityQueryOutput);
    resetMedicalSelectionScratch(scratch);
    output.ok = false;
    output.reason = undefined;
    output.queryCaregiverId = options.caregiverId;
    output.queryRegionId = options.regionId;
    output.queryUrgencyBucket = options.urgencyBucket;
    output.queryPermissionId = options.permissionId;
    output.candidateCap = options.candidateCap;
    output.maxSelectedRequests = options.maxSelectedRequests;
    output.bucketCandidateCount = 0;
    output.visitedCount = 0;
    output.scoredCount = 0;
    output.selectedCount = 0;
    output.candidateCapHit = false;
    output.selectedCapHit = false;
    output.rejectedByCandidateCap = 0;
    output.rejectedByPermission = 0;
    output.rejectedByAbility = 0;
    output.rejectedByCondition = 0;
    output.rejectedByStaleBasis = 0;
    output.selectedRequestId = M3_MEDICAL_NO_REQUEST;
    output.selectedPatientId = 0;
    output.selectedConditionId = 0;
    output.selectedRegionId = 0;
    output.selectedUrgencyBucket = 0;
    output.selectedPermissionId = 0;
    output.selectedTreatmentDefId = 0;
    output.selectedStockDefId = 0;
    output.selectedStockAmount = 0;
    output.selectedTargetCellIndex = 0;
    output.selectedScoreMilli = 0;
    output.selectedConditionVersion = 0;
    output.selectedActorConditionVersion = 0;
    output.selectedHealthStoreVersion = 0;
    output.selectedSeverity = 0;
    output.selectedClueRef = 0;
    output.selectedCounterevidenceRef = 0;
    output.selectedCaregiverId = M3_MEDICAL_NO_REQUEST;
    output.caregiverRegionId = 0;
    output.caregiverPermissionId = 0;
    output.caregiverAbility = 0;
    output.caregiverMinimumValue = 0;
    output.caregiverAbilityValue = 0;
    output.caregiverActorConditionVersion = 0;
    output.caregiverBaseAbilityVersion = 0;
    output.caregiverValid = false;
    output.caregiverAllowed = false;
    output.medicalStoreVersion = this.storeVersion;
    output.healthStoreVersion = health.storeVersion;
  }

  private prepareCaregiverInto(
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): boolean {
    const caregiver = scratch.caregiverReadOutput;
    this.readCaregiverStateInto(options.caregiverId, caregiver);
    if (!caregiver.ok || !caregiver.valid || !caregiver.allowed) {
      output.reason = "medical.rejected_permission";
      output.rejectedByPermission = 1;
      this.permissionRejectCount += 1;
      return false;
    }
    if (
      caregiver.regionId !== options.regionId ||
      caregiver.permissionId !== options.permissionId ||
      caregiver.abilityValue < caregiver.minimumValue
    ) {
      output.reason = "medical.rejected_caregiver_ability";
      output.rejectedByAbility = 1;
      this.abilityRejectCount += 1;
      return false;
    }
    abilities.queryAbilityInto(
      options.caregiverId,
      caregiver.ability,
      health,
      caregiver.minimumValue,
      scratch.abilityQueryOutput,
    );
    if (!scratch.abilityQueryOutput.ok) {
      output.reason = "medical.rejected_caregiver_ability";
      output.rejectedByAbility = 1;
      this.abilityRejectCount += 1;
      return false;
    }
    if (
      caregiver.medicalStoreVersion !== this.storeVersion ||
      !isMedicalCaregiverAbilityTupleCurrent(caregiver, scratch.abilityQueryOutput)
    ) {
      output.reason = "medical.rejected_stale_owner_state";
      output.rejectedByStaleBasis = 1;
      this.staleRejectCount += 1;
      return false;
    }
    copyMedicalCaregiverIntoOutput(caregiver, output);
    return true;
  }

  private collectTreatmentRequestsInto(
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    medicalVersion: number,
    healthVersion: number,
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): boolean {
    const bucket = this.bucketIndex(options);
    output.bucketCandidateCount = this.bucketCounts[bucket] ?? 0;
    let current = this.bucketHeads[bucket] ?? -1;
    let visited = 0;
    while (current >= 0 && visited < options.candidateCap) {
      this.readPatientRequestInto(current, scratch.patientReadOutput);
      const status = this.validatePatientReadInto(
        current,
        options,
        health,
        medicalVersion,
        healthVersion,
        scratch.patientReadOutput,
      );
      if (status === "ok") {
        output.scoredCount += 1;
        output.selectedCount = insertMedicalPatientIntoScratch(
          scratch.patientReadOutput,
          scratch,
          output.selectedCount,
          options.maxSelectedRequests,
        );
      } else if (status === "medical.rejected_stale_owner_state") {
        output.rejectedByStaleBasis += 1;
      } else {
        output.rejectedByCondition += 1;
      }
      visited += 1;
      current = this.nextByBucket[current] ?? -1;
    }
    output.visitedCount = visited;
    output.candidateCapHit = current >= 0;
    output.selectedCapHit = output.scoredCount > output.selectedCount;
    output.rejectedByCandidateCap = output.candidateCapHit ? 1 : 0;
    return this.storeVersion === medicalVersion && health.storeVersion === healthVersion;
  }

  private validatePatientReadInto(
    requestId: number,
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    medicalVersion: number,
    healthVersion: number,
    patient: M3MedicalPatientRequestIntoOutput,
  ): "ok" | "medical.rejected_invalid_condition" | "medical.rejected_stale_owner_state" {
    if (
      !patient.ok ||
      !patient.active ||
      patient.requestId !== requestId ||
      patient.medicalStoreVersion !== medicalVersion ||
      patient.regionId !== options.regionId ||
      patient.urgencyBucket !== options.urgencyBucket ||
      patient.permissionId !== options.permissionId ||
      patient.healthStoreVersion !== healthVersion ||
      health.storeVersion !== healthVersion ||
      health.actorConditionVersion(patient.patientId) !== patient.actorConditionVersion
    ) {
      return "medical.rejected_stale_owner_state";
    }
    if (patient.severity === 0) {
      return "medical.rejected_invalid_condition";
    }
    return "ok";
  }

  private isMedicalSelectionBasisCurrent(
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    abilities: M3AbilityCacheStore,
    medicalVersion: number,
    healthVersion: number,
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): boolean {
    if (
      this.storeVersion !== medicalVersion ||
      health.storeVersion !== healthVersion ||
      output.medicalStoreVersion !== medicalVersion ||
      output.healthStoreVersion !== healthVersion ||
      output.bucketCandidateCount !== (this.bucketCounts[this.bucketIndex(options)] ?? 0)
    ) {
      return false;
    }
    this.readCaregiverStateInto(options.caregiverId, scratch.caregiverReadOutput);
    abilities.queryAbilityInto(
      options.caregiverId,
      scratch.caregiverReadOutput.ability,
      health,
      scratch.caregiverReadOutput.minimumValue,
      scratch.abilityQueryOutput,
    );
    if (
      this.storeVersion !== medicalVersion ||
      health.storeVersion !== healthVersion ||
      !isMedicalCaregiverOutputCurrent(
        scratch.caregiverReadOutput,
        scratch.abilityQueryOutput,
        output,
      )
    ) {
      return false;
    }
    for (let index = 0; index < output.selectedCount; index += 1) {
      const requestId = scratch.requestIds[index] ?? M3_MEDICAL_NO_REQUEST;
      this.readPatientRequestInto(requestId, scratch.patientReadOutput);
      if (
        this.validatePatientReadInto(
          requestId,
          options,
          health,
          medicalVersion,
          healthVersion,
          scratch.patientReadOutput,
        ) !== "ok" ||
        !isMedicalPatientScratchRowCurrent(scratch.patientReadOutput, index, scratch)
      ) {
        return false;
      }
    }
    return true;
  }

  private failSelectionInto(
    options: M3MedicalSelectionOptions,
    health: M3HealthConditionStore,
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): void {
    this.resetSelectionInto(options, health, scratch, output);
    output.reason = "medical.rejected_stale_owner_state";
    output.rejectedByStaleBasis = 1;
    this.staleRejectCount += 1;
  }

  private finishSelectionInto(
    scratch: M3MedicalSelectionIntoScratch,
    output: M3MedicalSelectionIntoOutput,
  ): void {
    this.selectionCount += 1;
    this.visitedTotal += output.visitedCount;
    this.capHitCount += output.candidateCapHit ? 1 : 0;
    this.conditionRejectCount += output.rejectedByCondition;
    this.staleRejectCount += output.rejectedByStaleBasis;
    if (output.selectedCount === 0) {
      output.reason = output.visitedCount === 0 ? "medical.selection_empty" : "medical.no_patient";
      return;
    }
    output.ok = true;
    output.reason = output.candidateCapHit
      ? "medical.candidate_cap_reached"
      : "medical.offer_created";
    copyFirstMedicalPatientIntoOutput(scratch, output);
  }

  private validateRequestAgainstCondition(
    requestId: number,
    condition: M3HealthConditionView | undefined,
    health: M3HealthConditionStore,
  ):
    | "ok"
    | Extract<
        M3MedicalReason,
        "medical.rejected_invalid_condition" | "medical.rejected_stale_owner_state"
      > {
    if (condition === undefined) {
      return "medical.rejected_invalid_condition";
    }
    if (
      condition.actorId !== (this.patientIds[requestId] ?? 0) ||
      condition.conditionVersion !== (this.conditionVersions[requestId] ?? 0) ||
      condition.actorConditionVersion !== (this.actorConditionVersions[requestId] ?? 0) ||
      health.storeVersion !== (this.healthStoreVersions[requestId] ?? 0)
    ) {
      return "medical.rejected_stale_owner_state";
    }
    if (
      condition.kind !== M3_HEALTH_CONDITION_KIND_INJURY ||
      condition.severity === 0 ||
      condition.terminalState > M3_HEALTH_CONDITION_RECOVERING
    ) {
      return "medical.rejected_invalid_condition";
    }
    return "ok";
  }

  private validateRequestInput(input: M3MedicalPatientRequestInput): ValidationResult {
    if (!isIndexInRange(input.requestId, this.requestCapacity)) {
      return { ok: false, reason: "medical.request_id_out_of_range" };
    }
    if (!isIndexInRange(input.patientId, this.actorCapacity)) {
      return { ok: false, reason: "medical.actor_out_of_range" };
    }
    if (!isNonNegativeUint32(input.conditionId)) {
      return { ok: false, reason: "medical.condition_id_out_of_range" };
    }
    if (!isIndexInRange(input.regionId, this.regionCapacity)) {
      return { ok: false, reason: "medical.region_out_of_range" };
    }
    if (!isIndexInRange(input.urgencyBucket, this.urgencyBucketCount)) {
      return { ok: false, reason: "medical.urgency_out_of_range" };
    }
    if (!isIndexInRange(input.permissionId, this.permissionCapacity)) {
      return { ok: false, reason: "medical.permission_out_of_range" };
    }
    if (
      !isNonNegativeUint32(input.treatmentDefId) ||
      !isNonNegativeUint32(input.stockDefId) ||
      !isPositiveSafeInteger(input.stockAmount) ||
      !isNonNegativeUint32(input.targetCellIndex) ||
      !Number.isSafeInteger(input.scoreMilli)
    ) {
      return { ok: false, reason: "medical.value_out_of_range" };
    }
    return { ok: true };
  }

  private validateCaregiverInput(input: M3MedicalCaregiverStateInput): ValidationResult {
    if (!isIndexInRange(input.caregiverId, this.actorCapacity)) {
      return { ok: false, reason: "medical.actor_out_of_range" };
    }
    if (!isIndexInRange(input.regionId, this.regionCapacity)) {
      return { ok: false, reason: "medical.region_out_of_range" };
    }
    if (!isIndexInRange(input.permissionId, this.permissionCapacity)) {
      return { ok: false, reason: "medical.permission_out_of_range" };
    }
    if (!isIndexInRange(input.ability, M3_ABILITY_LANE_COUNT)) {
      return { ok: false, reason: "medical.ability_lane_out_of_range" };
    }
    if (!isSeverity(input.minimumValue)) {
      return { ok: false, reason: "medical.value_out_of_range" };
    }
    return { ok: true };
  }

  private validateSelection(
    options: M3MedicalSelectionOptions,
    scratch: M3MedicalSelectionScratch,
  ): ValidationResult {
    if (!isIndexInRange(options.caregiverId, this.actorCapacity)) {
      return { ok: false, reason: "medical.actor_out_of_range" };
    }
    if (!isIndexInRange(options.regionId, this.regionCapacity)) {
      return { ok: false, reason: "medical.region_out_of_range" };
    }
    if (!isIndexInRange(options.urgencyBucket, this.urgencyBucketCount)) {
      return { ok: false, reason: "medical.urgency_out_of_range" };
    }
    if (!isIndexInRange(options.permissionId, this.permissionCapacity)) {
      return { ok: false, reason: "medical.permission_out_of_range" };
    }
    if (
      !isPositiveSafeInteger(options.candidateCap) ||
      !isPositiveSafeInteger(options.maxSelectedRequests)
    ) {
      return { ok: false, reason: "medical.value_out_of_range" };
    }
    if (
      scratch.selectedRequestIds.length < options.maxSelectedRequests ||
      scratch.selectedScoresMilli.length < options.maxSelectedRequests
    ) {
      return { ok: false, reason: "medical.selected_buffer_too_small" };
    }
    return { ok: true };
  }

  private linkRequest(requestId: number): void {
    const bucket = this.bucketIndexFor(
      this.regionIds[requestId] ?? 0,
      this.urgencyBuckets[requestId] ?? 0,
      this.permissionIds[requestId] ?? 0,
    );
    let current = this.bucketHeads[bucket] ?? -1;
    let previous = -1;
    while (current >= 0 && current < requestId) {
      previous = current;
      current = this.nextByBucket[current] ?? -1;
    }
    this.previousByBucket[requestId] = previous;
    this.nextByBucket[requestId] = current;
    if (previous < 0) {
      this.bucketHeads[bucket] = requestId;
    } else {
      this.nextByBucket[previous] = requestId;
    }
    if (current >= 0) {
      this.previousByBucket[current] = requestId;
    }
    this.bucketCounts[bucket] = (this.bucketCounts[bucket] ?? 0) + 1;
  }

  private unlinkRequest(requestId: number): void {
    const bucket = this.bucketIndexFor(
      this.regionIds[requestId] ?? 0,
      this.urgencyBuckets[requestId] ?? 0,
      this.permissionIds[requestId] ?? 0,
    );
    const previous = this.previousByBucket[requestId] ?? -1;
    const next = this.nextByBucket[requestId] ?? -1;
    if (previous < 0) {
      this.bucketHeads[bucket] = next;
    } else {
      this.nextByBucket[previous] = next;
    }
    if (next >= 0) {
      this.previousByBucket[next] = previous;
    }
    this.previousByBucket[requestId] = -1;
    this.nextByBucket[requestId] = -1;
    this.bucketCounts[bucket] = (this.bucketCounts[bucket] ?? 1) - 1;
  }

  private bucketIndex(options: M3MedicalSelectionOptions): number {
    return this.bucketIndexFor(options.regionId, options.urgencyBucket, options.permissionId);
  }

  private bucketIndexFor(regionId: number, urgencyBucket: number, permissionId: number): number {
    return (
      (regionId * this.urgencyBucketCount + urgencyBucket) * this.permissionCapacity + permissionId
    );
  }

  private isActiveRequest(requestId: number): boolean {
    return isIndexInRange(requestId, this.requestCapacity) && this.activeRequests[requestId] === 1;
  }

  private resetPatientRequestInto(
    requestId: number,
    output: M3MedicalPatientRequestIntoOutput,
  ): void {
    output.ok = false;
    output.reason = undefined;
    output.requestId = requestId;
    output.active = false;
    output.patientId = 0;
    output.conditionId = 0;
    output.regionId = 0;
    output.urgencyBucket = 0;
    output.permissionId = 0;
    output.treatmentDefId = 0;
    output.stockDefId = 0;
    output.stockAmount = 0;
    output.targetCellIndex = 0;
    output.scoreMilli = 0;
    output.conditionVersion = 0;
    output.actorConditionVersion = 0;
    output.healthStoreVersion = 0;
    output.severity = 0;
    output.clueRef = 0;
    output.counterevidenceRef = 0;
    output.medicalStoreVersion = this.storeVersion;
  }

  private resetCaregiverStateInto(
    caregiverId: number,
    output: M3MedicalCaregiverStateIntoOutput,
  ): void {
    output.ok = false;
    output.reason = undefined;
    output.caregiverId = caregiverId;
    output.valid = false;
    output.regionId = 0;
    output.permissionId = 0;
    output.ability = 0;
    output.minimumValue = 0;
    output.allowed = false;
    output.abilityValue = 0;
    output.actorConditionVersion = 0;
    output.baseAbilityVersion = 0;
    output.medicalStoreVersion = this.storeVersion;
  }
}

export function createM3MedicalCareStore(options: {
  readonly requestCapacity: number;
  readonly actorCapacity: number;
  readonly regionCapacity: number;
  readonly urgencyBucketCount: number;
  readonly permissionCapacity: number;
}): M3MedicalCareStore {
  return new M3MedicalCareStore(options);
}

export function hasMedicalSelectionScratchCapacity(
  scratch: M3MedicalSelectionIntoScratch,
): boolean {
  return (
    scratch.requestIds.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.patientIds.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.conditionIds.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.regionIds.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.urgencyBuckets.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.permissionIds.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.treatmentDefIds.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.stockDefIds.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.stockAmounts.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.targetCellIndexes.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.scoresMilli.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.conditionVersions.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.actorConditionVersions.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.healthStoreVersions.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.severities.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.clueRefs.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP &&
    scratch.counterevidenceRefs.length >= M3_MEDICAL_DEFAULT_SELECTED_CAP
  );
}

export function resetMedicalSelectionScratch(scratch: M3MedicalSelectionIntoScratch): void {
  for (let index = 0; index < M3_MEDICAL_DEFAULT_SELECTED_CAP; index += 1) {
    scratch.requestIds[index] = M3_MEDICAL_NO_REQUEST;
    scratch.patientIds[index] = 0;
    scratch.conditionIds[index] = 0;
    scratch.regionIds[index] = 0;
    scratch.urgencyBuckets[index] = 0;
    scratch.permissionIds[index] = 0;
    scratch.treatmentDefIds[index] = 0;
    scratch.stockDefIds[index] = 0;
    scratch.stockAmounts[index] = 0;
    scratch.targetCellIndexes[index] = 0;
    scratch.scoresMilli[index] = 0;
    scratch.conditionVersions[index] = 0;
    scratch.actorConditionVersions[index] = 0;
    scratch.healthStoreVersions[index] = 0;
    scratch.severities[index] = 0;
    scratch.clueRefs[index] = 0;
    scratch.counterevidenceRefs[index] = 0;
  }
}

export function resetMedicalAbilityQueryOutput(output: M3AbilityQueryIntoOutput): void {
  output.ok = false;
  output.reason = "ability.actor_out_of_range";
  output.actorId = M3_MEDICAL_NO_REQUEST;
  output.ability = 0;
  output.value = 0;
  output.threshold = 0;
  output.baseValue = 0;
  output.conditionPenalty = 0;
  output.actorConditionVersion = 0;
  output.baseAbilityVersion = 0;
  output.visitedConditionCount = 0;
}

export function isMedicalCaregiverAbilityTupleCurrent(
  caregiver: M3MedicalCaregiverStateIntoOutput,
  ability: M3AbilityQueryIntoOutput,
): boolean {
  return (
    caregiver.ok &&
    caregiver.valid &&
    caregiver.allowed &&
    ability.ok &&
    ability.actorId === caregiver.caregiverId &&
    ability.ability === caregiver.ability &&
    ability.threshold === caregiver.minimumValue &&
    ability.value === caregiver.abilityValue &&
    ability.actorConditionVersion === caregiver.actorConditionVersion &&
    ability.baseAbilityVersion === caregiver.baseAbilityVersion
  );
}

export function copyMedicalCaregiverIntoOutput(
  caregiver: M3MedicalCaregiverStateIntoOutput,
  output: M3MedicalSelectionIntoOutput,
): void {
  output.selectedCaregiverId = caregiver.caregiverId;
  output.caregiverRegionId = caregiver.regionId;
  output.caregiverPermissionId = caregiver.permissionId;
  output.caregiverAbility = caregiver.ability;
  output.caregiverMinimumValue = caregiver.minimumValue;
  output.caregiverAbilityValue = caregiver.abilityValue;
  output.caregiverActorConditionVersion = caregiver.actorConditionVersion;
  output.caregiverBaseAbilityVersion = caregiver.baseAbilityVersion;
  output.caregiverValid = caregiver.valid;
  output.caregiverAllowed = caregiver.allowed;
}

export function isMedicalCaregiverOutputCurrent(
  caregiver: M3MedicalCaregiverStateIntoOutput,
  ability: M3AbilityQueryIntoOutput,
  output: M3MedicalSelectionIntoOutput,
): boolean {
  return (
    isMedicalCaregiverAbilityTupleCurrent(caregiver, ability) &&
    caregiver.medicalStoreVersion === output.medicalStoreVersion &&
    caregiver.caregiverId === output.selectedCaregiverId &&
    caregiver.regionId === output.caregiverRegionId &&
    caregiver.permissionId === output.caregiverPermissionId &&
    caregiver.ability === output.caregiverAbility &&
    caregiver.minimumValue === output.caregiverMinimumValue &&
    caregiver.abilityValue === output.caregiverAbilityValue &&
    caregiver.actorConditionVersion === output.caregiverActorConditionVersion &&
    caregiver.baseAbilityVersion === output.caregiverBaseAbilityVersion &&
    caregiver.valid === output.caregiverValid &&
    caregiver.allowed === output.caregiverAllowed
  );
}

export function insertMedicalPatientIntoScratch(
  patient: M3MedicalPatientRequestIntoOutput,
  scratch: M3MedicalSelectionIntoScratch,
  selectedCount: number,
  maxSelected: number,
): number {
  let insertAt = 0;
  while (insertAt < selectedCount && isMedicalScratchCandidateBefore(insertAt, patient, scratch)) {
    insertAt += 1;
  }
  if (insertAt >= maxSelected) {
    return selectedCount;
  }
  let destination = selectedCount < maxSelected ? selectedCount : maxSelected - 1;
  while (destination > insertAt) {
    copyMedicalScratchRow(destination - 1, destination, scratch);
    destination -= 1;
  }
  writeMedicalPatientScratchRow(insertAt, patient, scratch);
  return selectedCount < maxSelected ? selectedCount + 1 : selectedCount;
}

export function isMedicalScratchCandidateBefore(
  selectedIndex: number,
  patient: M3MedicalPatientRequestIntoOutput,
  scratch: M3MedicalSelectionIntoScratch,
): boolean {
  const selectedScore = scratch.scoresMilli[selectedIndex] ?? 0;
  if (selectedScore !== patient.scoreMilli) {
    return selectedScore > patient.scoreMilli;
  }
  const selectedRequestId = scratch.requestIds[selectedIndex] ?? M3_MEDICAL_NO_REQUEST;
  if (selectedRequestId !== patient.requestId) {
    return selectedRequestId < patient.requestId;
  }
  return (scratch.targetCellIndexes[selectedIndex] ?? 0) < patient.targetCellIndex;
}

export function copyMedicalScratchRow(
  source: number,
  destination: number,
  scratch: M3MedicalSelectionIntoScratch,
): void {
  scratch.requestIds[destination] = scratch.requestIds[source] ?? M3_MEDICAL_NO_REQUEST;
  scratch.patientIds[destination] = scratch.patientIds[source] ?? 0;
  scratch.conditionIds[destination] = scratch.conditionIds[source] ?? 0;
  scratch.regionIds[destination] = scratch.regionIds[source] ?? 0;
  scratch.urgencyBuckets[destination] = scratch.urgencyBuckets[source] ?? 0;
  scratch.permissionIds[destination] = scratch.permissionIds[source] ?? 0;
  scratch.treatmentDefIds[destination] = scratch.treatmentDefIds[source] ?? 0;
  scratch.stockDefIds[destination] = scratch.stockDefIds[source] ?? 0;
  scratch.stockAmounts[destination] = scratch.stockAmounts[source] ?? 0;
  scratch.targetCellIndexes[destination] = scratch.targetCellIndexes[source] ?? 0;
  scratch.scoresMilli[destination] = scratch.scoresMilli[source] ?? 0;
  scratch.conditionVersions[destination] = scratch.conditionVersions[source] ?? 0;
  scratch.actorConditionVersions[destination] = scratch.actorConditionVersions[source] ?? 0;
  scratch.healthStoreVersions[destination] = scratch.healthStoreVersions[source] ?? 0;
  scratch.severities[destination] = scratch.severities[source] ?? 0;
  scratch.clueRefs[destination] = scratch.clueRefs[source] ?? 0;
  scratch.counterevidenceRefs[destination] = scratch.counterevidenceRefs[source] ?? 0;
}

export function writeMedicalPatientScratchRow(
  destination: number,
  patient: M3MedicalPatientRequestIntoOutput,
  scratch: M3MedicalSelectionIntoScratch,
): void {
  scratch.requestIds[destination] = patient.requestId;
  scratch.patientIds[destination] = patient.patientId;
  scratch.conditionIds[destination] = patient.conditionId;
  scratch.regionIds[destination] = patient.regionId;
  scratch.urgencyBuckets[destination] = patient.urgencyBucket;
  scratch.permissionIds[destination] = patient.permissionId;
  scratch.treatmentDefIds[destination] = patient.treatmentDefId;
  scratch.stockDefIds[destination] = patient.stockDefId;
  scratch.stockAmounts[destination] = patient.stockAmount;
  scratch.targetCellIndexes[destination] = patient.targetCellIndex;
  scratch.scoresMilli[destination] = patient.scoreMilli;
  scratch.conditionVersions[destination] = patient.conditionVersion;
  scratch.actorConditionVersions[destination] = patient.actorConditionVersion;
  scratch.healthStoreVersions[destination] = patient.healthStoreVersion;
  scratch.severities[destination] = patient.severity;
  scratch.clueRefs[destination] = patient.clueRef;
  scratch.counterevidenceRefs[destination] = patient.counterevidenceRef;
}

export function isMedicalPatientScratchRowCurrent(
  patient: M3MedicalPatientRequestIntoOutput,
  selectedIndex: number,
  scratch: M3MedicalSelectionIntoScratch,
): boolean {
  return (
    patient.requestId === (scratch.requestIds[selectedIndex] ?? M3_MEDICAL_NO_REQUEST) &&
    patient.patientId === (scratch.patientIds[selectedIndex] ?? 0) &&
    patient.conditionId === (scratch.conditionIds[selectedIndex] ?? 0) &&
    patient.regionId === (scratch.regionIds[selectedIndex] ?? 0) &&
    patient.urgencyBucket === (scratch.urgencyBuckets[selectedIndex] ?? 0) &&
    patient.permissionId === (scratch.permissionIds[selectedIndex] ?? 0) &&
    patient.treatmentDefId === (scratch.treatmentDefIds[selectedIndex] ?? 0) &&
    patient.stockDefId === (scratch.stockDefIds[selectedIndex] ?? 0) &&
    patient.stockAmount === (scratch.stockAmounts[selectedIndex] ?? 0) &&
    patient.targetCellIndex === (scratch.targetCellIndexes[selectedIndex] ?? 0) &&
    patient.scoreMilli === (scratch.scoresMilli[selectedIndex] ?? 0) &&
    patient.conditionVersion === (scratch.conditionVersions[selectedIndex] ?? 0) &&
    patient.actorConditionVersion === (scratch.actorConditionVersions[selectedIndex] ?? 0) &&
    patient.healthStoreVersion === (scratch.healthStoreVersions[selectedIndex] ?? 0) &&
    patient.severity === (scratch.severities[selectedIndex] ?? 0) &&
    patient.clueRef === (scratch.clueRefs[selectedIndex] ?? 0) &&
    patient.counterevidenceRef === (scratch.counterevidenceRefs[selectedIndex] ?? 0)
  );
}

export function copyFirstMedicalPatientIntoOutput(
  scratch: M3MedicalSelectionIntoScratch,
  output: M3MedicalSelectionIntoOutput,
): void {
  output.selectedRequestId = scratch.requestIds[0] ?? M3_MEDICAL_NO_REQUEST;
  output.selectedPatientId = scratch.patientIds[0] ?? 0;
  output.selectedConditionId = scratch.conditionIds[0] ?? 0;
  output.selectedRegionId = scratch.regionIds[0] ?? 0;
  output.selectedUrgencyBucket = scratch.urgencyBuckets[0] ?? 0;
  output.selectedPermissionId = scratch.permissionIds[0] ?? 0;
  output.selectedTreatmentDefId = scratch.treatmentDefIds[0] ?? 0;
  output.selectedStockDefId = scratch.stockDefIds[0] ?? 0;
  output.selectedStockAmount = scratch.stockAmounts[0] ?? 0;
  output.selectedTargetCellIndex = scratch.targetCellIndexes[0] ?? 0;
  output.selectedScoreMilli = scratch.scoresMilli[0] ?? 0;
  output.selectedConditionVersion = scratch.conditionVersions[0] ?? 0;
  output.selectedActorConditionVersion = scratch.actorConditionVersions[0] ?? 0;
  output.selectedHealthStoreVersion = scratch.healthStoreVersions[0] ?? 0;
  output.selectedSeverity = scratch.severities[0] ?? 0;
  output.selectedClueRef = scratch.clueRefs[0] ?? 0;
  output.selectedCounterevidenceRef = scratch.counterevidenceRefs[0] ?? 0;
}

function validatePatientCondition(
  input: M3MedicalPatientRequestInput,
  condition: M3HealthConditionView | undefined,
): ValidationResult {
  if (condition === undefined) {
    return { ok: false, reason: "medical.no_patient" };
  }
  if (condition.actorId !== input.patientId) {
    return { ok: false, reason: "medical.rejected_invalid_condition" };
  }
  if (
    condition.kind !== M3_HEALTH_CONDITION_KIND_INJURY ||
    condition.terminalState !== M3_HEALTH_CONDITION_ACTIVE ||
    condition.severity === 0
  ) {
    return { ok: false, reason: "medical.rejected_patient_not_injured" };
  }
  return { ok: true };
}

function insertSelectedRequest(
  requestId: number,
  scoreMilli: number,
  scratch: M3MedicalSelectionScratch,
  options: M3MedicalSelectionOptions,
): void {
  let insertIndex = countSelected(scratch.selectedRequestIds);
  for (let index = 0; index < insertIndex; index += 1) {
    const currentScore = scratch.selectedScoresMilli[index] ?? 0;
    const currentId = scratch.selectedRequestIds[index] ?? M3_MEDICAL_NO_REQUEST;
    if (scoreMilli > currentScore || (scoreMilli === currentScore && requestId < currentId)) {
      insertIndex = index;
      break;
    }
  }
  if (insertIndex >= options.maxSelectedRequests) {
    return;
  }
  const limit = Math.min(
    countSelected(scratch.selectedRequestIds),
    options.maxSelectedRequests - 1,
  );
  for (let index = limit; index > insertIndex; index -= 1) {
    scratch.selectedRequestIds[index] =
      scratch.selectedRequestIds[index - 1] ?? M3_MEDICAL_NO_REQUEST;
    scratch.selectedScoresMilli[index] = scratch.selectedScoresMilli[index - 1] ?? 0;
  }
  scratch.selectedRequestIds[insertIndex] = requestId;
  scratch.selectedScoresMilli[insertIndex] = scoreMilli;
}

function countSelected(selectedRequestIds: Uint32Array): number {
  let count = 0;
  while (count < selectedRequestIds.length && selectedRequestIds[count] !== M3_MEDICAL_NO_REQUEST) {
    count += 1;
  }
  return count;
}

function clearSelectedScratch(scratch: M3MedicalSelectionScratch): void {
  scratch.selectedRequestIds.fill(M3_MEDICAL_NO_REQUEST);
  scratch.selectedScoresMilli.fill(0);
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

export function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

export function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isSeverity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}
