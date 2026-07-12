import { mixUint32 } from "./deterministic-hash";
import { assertValidCapacity } from "./entity-id";
import {
  M3_ABILITY_LANE_COUNT,
  M3_HEALTH_CONDITION_ACTIVE,
  M3_HEALTH_CONDITION_KIND_INJURY,
  M3_HEALTH_CONDITION_RECOVERING,
  type M3AbilityCacheStore,
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

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isSeverity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000;
}
