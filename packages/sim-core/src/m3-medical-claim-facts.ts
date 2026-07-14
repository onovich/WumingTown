import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { ItemStackIntoOutput, ItemStackReadScratch, ItemStackStore } from "./item-stack-store";
import type { ReservationLedger } from "./reservation-ledger";
import {
  STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES,
  type StorageLogisticsIndex,
  type StorageSlotIntoOutput,
  type StorageSupplySelectionIntoOutput,
  type StorageSupplySelectionScratch,
} from "./storage-logistics-index";
import type { CanonicalWorldField } from "./world-hash";

export const M3_MEDICAL_CLAIM_FACTS_SNAPSHOT_VERSION = 1;
export const M3_MEDICAL_TREATMENT_POLICY_KIND = 2;
export const M3_MEDICAL_TREATMENT_POLICY_VERSION = 1;

export type M3MedicalClaimFactsReason =
  | "medical_claim_request_out_of_range"
  | "medical_claim_interaction_not_registered"
  | "medical_claim_interaction_already_registered"
  | "medical_claim_target_invalid"
  | "medical_claim_target_not_alive"
  | "medical_claim_target_generation_mismatch"
  | "medical_claim_value_invalid"
  | "medical_claim_treatment_def_out_of_range"
  | "medical_claim_treatment_policy_not_registered"
  | "medical_claim_stock_candidate_cap_invalid"
  | "medical_claim_stock_scratch_invalid"
  | "medical_claim_stock_def_out_of_range"
  | "medical_claim_stock_region_invalid"
  | "medical_claim_stock_amount_invalid"
  | "medical_claim_stock_dirty_basis_mismatch"
  | "medical_claim_stock_basis_stale"
  | "medical_claim_stock_item_not_alive"
  | "medical_claim_stock_item_generation_mismatch"
  | "medical_claim_stock_candidate_cap_reached"
  | "medical_claim_stock_unavailable";

export interface M3MedicalTreatmentPolicyInput {
  readonly treatmentDefId: number;
  readonly treatmentTicks: number;
  readonly workPerTickQ16: number;
  readonly severityDelta: number;
}

export interface M3MedicalClaimFactsIndexOptions {
  readonly capacity: number;
  readonly registry: EntityRegistry;
  readonly treatmentPolicyCapacity: number;
  readonly treatmentPolicies: readonly M3MedicalTreatmentPolicyInput[];
}

export interface M3MedicalPatientInteractionInput {
  readonly requestId: number;
  readonly target: EntityId;
  readonly interactionSpotId: number;
  readonly targetCellIndex: number;
  readonly sourceVersion: number;
}

export interface M3MedicalPatientInteractionIntoOutput {
  ok: boolean;
  reason: M3MedicalClaimFactsReason | undefined;
  active: boolean;
  requestId: number;
  targetIndex: number;
  targetGeneration: number;
  interactionSpotId: number;
  targetCellIndex: number;
  sourceVersion: number;
  rowVersion: number;
  indexVersion: number;
  activeCount: number;
}

export interface M3MedicalTreatmentPolicyIntoOutput {
  ok: boolean;
  reason: M3MedicalClaimFactsReason | undefined;
  treatmentDefId: number;
  policyKind: number;
  policyVersion: number;
  treatmentTicks: number;
  workPerTickQ16: number;
  severityDelta: number;
  requiredWorkQ16: number;
}

export interface M3MedicalStockSelectionInput {
  readonly stockDefId: number;
  readonly regionId: number;
  readonly requiredAmount: number;
  readonly candidateCap: number;
}

export interface M3MedicalStockSelectionScratch {
  readonly supply: StorageSupplySelectionScratch;
  readonly supplyOutput: StorageSupplySelectionIntoOutput;
  readonly slot: StorageSlotIntoOutput;
  readonly itemRead: ItemStackReadScratch;
  readonly item: ItemStackIntoOutput;
}

export interface M3MedicalStockSelectionIntoOutput {
  ok: boolean;
  reason: M3MedicalClaimFactsReason | undefined;
  queryStockDefId: number;
  queryRegionId: number;
  requiredAmount: number;
  candidateCap: number;
  visitedCount: number;
  eligibleCount: number;
  candidateCapHit: boolean;
  storageSlotId: number;
  stockStackId: number;
  itemEntityIndex: number;
  itemEntityGeneration: number;
  defId: number;
  quantity: number;
  availableQuantity: number;
  stockOwnerVersion: number;
  stockRowVersion: number;
  stockIndexVersion: number;
  stockDirtyBacklog: number;
  itemRowVersion: number;
  itemStoreVersion: number;
  reservationVersion: number;
}

export interface M3MedicalPatientInteractionSnapshotRow {
  readonly requestId: number;
  readonly active: 0 | 1;
  readonly targetIndex: number;
  readonly targetGeneration: number;
  readonly interactionSpotId: number;
  readonly targetCellIndex: number;
  readonly sourceVersion: number;
  readonly rowVersion: number;
}

export interface M3MedicalClaimFactsSnapshotInput {
  readonly snapshotVersion: number;
  readonly capacity: number;
  readonly indexVersion: number;
  readonly activeCount: number;
  readonly rows: readonly M3MedicalPatientInteractionSnapshotRow[];
}

export interface M3MedicalClaimFactsSnapshot extends M3MedicalClaimFactsSnapshotInput {
  readonly snapshotVersion: typeof M3_MEDICAL_CLAIM_FACTS_SNAPSHOT_VERSION;
}

export type M3MedicalClaimFactsRestoreReason =
  | "medical_claim_snapshot_invalid"
  | "medical_claim_snapshot_version_unsupported"
  | "medical_claim_snapshot_target_not_alive"
  | "medical_claim_snapshot_target_generation_mismatch";

export type M3MedicalClaimFactsRestoreResult =
  | { readonly ok: true; readonly version: number }
  | { readonly ok: false; readonly reason: M3MedicalClaimFactsRestoreReason };

export class M3MedicalClaimFactsIndex {
  readonly capacity: number;
  private readonly registry: EntityRegistry;
  private readonly active: Uint8Array;
  private readonly targetIndexes: Uint32Array;
  private readonly targetGenerations: Uint32Array;
  private readonly interactionSpotIds: Uint32Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly sourceVersions: Uint32Array;
  private readonly rowVersions: Uint32Array;
  private readonly policyRegistered: Uint8Array;
  private readonly policyTreatmentTicks: Uint32Array;
  private readonly policyWorkPerTickQ16: Uint32Array;
  private readonly policySeverityDelta: Uint32Array;
  private readonly policyRequiredWorkQ16: Uint32Array;
  private indexVersionValue = 0;
  private activeCountValue = 0;

  constructor(options: M3MedicalClaimFactsIndexOptions) {
    assertValidCapacity(options.capacity, "medical claim facts capacity");
    assertValidCapacity(options.treatmentPolicyCapacity, "medical treatment policy capacity");
    validateTreatmentPolicies(options.treatmentPolicyCapacity, options.treatmentPolicies);
    this.capacity = options.capacity;
    this.registry = options.registry;
    this.active = new Uint8Array(options.capacity);
    this.targetIndexes = new Uint32Array(options.capacity);
    this.targetGenerations = new Uint32Array(options.capacity);
    this.interactionSpotIds = new Uint32Array(options.capacity);
    this.targetCellIndexes = new Uint32Array(options.capacity);
    this.sourceVersions = new Uint32Array(options.capacity);
    this.rowVersions = new Uint32Array(options.capacity);
    this.policyRegistered = new Uint8Array(options.treatmentPolicyCapacity);
    this.policyTreatmentTicks = new Uint32Array(options.treatmentPolicyCapacity);
    this.policyWorkPerTickQ16 = new Uint32Array(options.treatmentPolicyCapacity);
    this.policySeverityDelta = new Uint32Array(options.treatmentPolicyCapacity);
    this.policyRequiredWorkQ16 = new Uint32Array(options.treatmentPolicyCapacity);
    this.copyTreatmentPolicies(options.treatmentPolicies);
  }

  get version(): number {
    return this.indexVersionValue;
  }

  get indexVersion(): number {
    return this.indexVersionValue;
  }

  get activeCount(): number {
    return this.activeCountValue;
  }

  registerPatientInteraction(
    input: M3MedicalPatientInteractionInput,
  ): M3MedicalClaimFactsReason | undefined {
    const requestId = input.requestId;
    if (!isIndexInRange(requestId, this.capacity)) return "medical_claim_request_out_of_range";
    if ((this.active[requestId] ?? 0) === 1) return "medical_claim_interaction_already_registered";
    if (!isValidTarget(input.target)) return "medical_claim_target_invalid";
    if (
      !isUint32(input.interactionSpotId) ||
      !isUint32(input.targetCellIndex) ||
      !isUint32(input.sourceVersion)
    )
      return "medical_claim_value_invalid";
    if (!this.registry.isIndexActive(input.target.index)) return "medical_claim_target_not_alive";
    if (this.registry.generationAt(input.target.index) !== input.target.generation)
      return "medical_claim_target_generation_mismatch";
    this.active[requestId] = 1;
    this.targetIndexes[requestId] = input.target.index;
    this.targetGenerations[requestId] = input.target.generation;
    this.interactionSpotIds[requestId] = input.interactionSpotId;
    this.targetCellIndexes[requestId] = input.targetCellIndex;
    this.sourceVersions[requestId] = input.sourceVersion;
    this.rowVersions[requestId] = 1;
    this.indexVersionValue += 1;
    this.activeCountValue += 1;
    return undefined;
  }

  readPatientInteractionInto(
    requestId: number,
    output: M3MedicalPatientInteractionIntoOutput,
  ): void {
    resetPatientInteractionOutput(requestId, this.indexVersionValue, this.activeCountValue, output);
    if (!isIndexInRange(requestId, this.capacity)) {
      output.reason = "medical_claim_request_out_of_range";
      return;
    }
    if ((this.active[requestId] ?? 0) !== 1) {
      output.reason = "medical_claim_interaction_not_registered";
      return;
    }
    const targetIndex = this.targetIndexes[requestId] ?? 0;
    if (!this.registry.isIndexActive(targetIndex)) {
      output.reason = "medical_claim_target_not_alive";
      return;
    }
    const targetGeneration = this.targetGenerations[requestId] ?? 0;
    if (this.registry.generationAt(targetIndex) !== targetGeneration) {
      output.reason = "medical_claim_target_generation_mismatch";
      return;
    }
    output.ok = true;
    output.active = true;
    output.targetIndex = targetIndex;
    output.targetGeneration = targetGeneration;
    output.interactionSpotId = this.interactionSpotIds[requestId] ?? 0;
    output.targetCellIndex = this.targetCellIndexes[requestId] ?? 0;
    output.sourceVersion = this.sourceVersions[requestId] ?? 0;
    output.rowVersion = this.rowVersions[requestId] ?? 0;
  }

  readTreatmentPolicyInto(
    treatmentDefId: number,
    output: M3MedicalTreatmentPolicyIntoOutput,
  ): void {
    resetTreatmentPolicyOutput(treatmentDefId, output);
    if (!isIndexInRange(treatmentDefId, this.policyRegistered.length)) {
      output.reason = "medical_claim_treatment_def_out_of_range";
      return;
    }
    if ((this.policyRegistered[treatmentDefId] ?? 0) !== 1) {
      output.reason = "medical_claim_treatment_policy_not_registered";
      return;
    }
    output.ok = true;
    output.policyKind = M3_MEDICAL_TREATMENT_POLICY_KIND;
    output.policyVersion = M3_MEDICAL_TREATMENT_POLICY_VERSION;
    output.treatmentTicks = this.policyTreatmentTicks[treatmentDefId] ?? 0;
    output.workPerTickQ16 = this.policyWorkPerTickQ16[treatmentDefId] ?? 0;
    output.severityDelta = this.policySeverityDelta[treatmentDefId] ?? 0;
    output.requiredWorkQ16 = this.policyRequiredWorkQ16[treatmentDefId] ?? 0;
  }

  selectStockInto(
    input: M3MedicalStockSelectionInput,
    storage: StorageLogisticsIndex,
    items: ItemStackStore,
    ledger: ReservationLedger,
    scratch: M3MedicalStockSelectionScratch,
    output: M3MedicalStockSelectionIntoOutput,
  ): void {
    resetMedicalStockSelection(input, scratch.supply, output);
    const inputReason = validateMedicalStockSelectionInput(input, scratch.supply);
    if (inputReason !== undefined) {
      output.reason = inputReason;
      return;
    }
    storage.selectSupplySlotsInto(
      input.stockDefId,
      input.candidateCap,
      scratch.supply,
      scratch.supplyOutput,
    );
    if (!hasPublishableMedicalStockSupplyHeader(input, scratch.supplyOutput)) {
      output.reason = "medical_claim_stock_basis_stale";
      return;
    }
    copyMedicalStockSupplyHeader(scratch.supplyOutput, output);
    const supplyReason = readMedicalStockSupplyFailure(scratch.supplyOutput);
    if (supplyReason !== undefined) {
      output.reason = supplyReason;
      return;
    }
    selectMedicalStockFromSupply(input, this.registry, storage, items, ledger, scratch, output);
  }

  createSnapshot(): M3MedicalClaimFactsSnapshot {
    const rows: M3MedicalPatientInteractionSnapshotRow[] = [];
    for (let requestId = 0; requestId < this.capacity; requestId += 1) {
      rows.push(this.createSnapshotRow(requestId));
    }
    return {
      snapshotVersion: M3_MEDICAL_CLAIM_FACTS_SNAPSHOT_VERSION,
      capacity: this.capacity,
      indexVersion: this.indexVersionValue,
      activeCount: this.activeCountValue,
      rows,
    };
  }

  restoreFromSnapshot(snapshot: unknown): M3MedicalClaimFactsRestoreResult {
    const shapeReason = validateSnapshotShape(snapshot, this.capacity);
    if (shapeReason !== undefined) return { ok: false, reason: shapeReason };
    if (!isValidatedSnapshot(snapshot, this.capacity))
      return { ok: false, reason: "medical_claim_snapshot_invalid" };
    const typedSnapshot = snapshot;
    const registryReason = validateSnapshotRegistry(typedSnapshot, this.registry);
    if (registryReason !== undefined) return { ok: false, reason: registryReason };
    this.clearInteractions();
    for (let requestId = 0; requestId < this.capacity; requestId += 1) {
      const row = typedSnapshot.rows[requestId];
      if (row?.active === 1) this.restoreActiveRow(row);
    }
    this.indexVersionValue = typedSnapshot.indexVersion;
    this.activeCountValue = typedSnapshot.activeCount;
    return { ok: true, version: this.indexVersionValue };
  }

  private copyTreatmentPolicies(policies: readonly M3MedicalTreatmentPolicyInput[]): void {
    let index = 0;
    while (index < policies.length) {
      const policy: M3MedicalTreatmentPolicyInput | undefined = policies[index];
      if (policy === undefined) throw new RangeError("sparse medical treatment policy manifest");
      const id = policy.treatmentDefId;
      this.policyRegistered[id] = 1;
      this.policyTreatmentTicks[id] = policy.treatmentTicks;
      this.policyWorkPerTickQ16[id] = policy.workPerTickQ16;
      this.policySeverityDelta[id] = policy.severityDelta;
      this.policyRequiredWorkQ16[id] = policy.treatmentTicks * policy.workPerTickQ16;
      index += 1;
    }
  }

  private createSnapshotRow(requestId: number): M3MedicalPatientInteractionSnapshotRow {
    const active: 0 | 1 = (this.active[requestId] ?? 0) === 1 ? 1 : 0;
    return {
      requestId,
      active,
      targetIndex: active === 1 ? (this.targetIndexes[requestId] ?? 0) : 0,
      targetGeneration: active === 1 ? (this.targetGenerations[requestId] ?? 0) : 0,
      interactionSpotId: active === 1 ? (this.interactionSpotIds[requestId] ?? 0) : 0,
      targetCellIndex: active === 1 ? (this.targetCellIndexes[requestId] ?? 0) : 0,
      sourceVersion: active === 1 ? (this.sourceVersions[requestId] ?? 0) : 0,
      rowVersion: active === 1 ? (this.rowVersions[requestId] ?? 0) : 0,
    };
  }

  private clearInteractions(): void {
    this.active.fill(0);
    this.targetIndexes.fill(0);
    this.targetGenerations.fill(0);
    this.interactionSpotIds.fill(0);
    this.targetCellIndexes.fill(0);
    this.sourceVersions.fill(0);
    this.rowVersions.fill(0);
  }

  private restoreActiveRow(row: M3MedicalPatientInteractionSnapshotRow): void {
    const id = row.requestId;
    this.active[id] = 1;
    this.targetIndexes[id] = row.targetIndex;
    this.targetGenerations[id] = row.targetGeneration;
    this.interactionSpotIds[id] = row.interactionSpotId;
    this.targetCellIndexes[id] = row.targetCellIndex;
    this.sourceVersions[id] = row.sourceVersion;
    this.rowVersions[id] = row.rowVersion;
  }
}

export function createM3MedicalClaimFactsIndex(
  options: M3MedicalClaimFactsIndexOptions,
): M3MedicalClaimFactsIndex {
  return new M3MedicalClaimFactsIndex(options);
}

export function createM3MedicalClaimFactsHashFields(
  snapshot: M3MedicalClaimFactsSnapshotInput,
  prefix = "medicalClaimFacts",
): readonly CanonicalWorldField[] {
  const fields: CanonicalWorldField[] = [
    { name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion },
    { name: `${prefix}.capacity`, value: snapshot.capacity },
    { name: `${prefix}.indexVersion`, value: snapshot.indexVersion },
    { name: `${prefix}.activeCount`, value: snapshot.activeCount },
  ];
  for (let requestId = 0; requestId < snapshot.rows.length; requestId += 1) {
    const row = snapshot.rows[requestId];
    if (row === undefined) continue;
    const rowPrefix = `${prefix}.row.${String(requestId)}`;
    fields.push({ name: `${rowPrefix}.requestId`, value: row.requestId });
    fields.push({ name: `${rowPrefix}.active`, value: row.active });
    fields.push({ name: `${rowPrefix}.targetIndex`, value: row.targetIndex });
    fields.push({ name: `${rowPrefix}.targetGeneration`, value: row.targetGeneration });
    fields.push({ name: `${rowPrefix}.interactionSpotId`, value: row.interactionSpotId });
    fields.push({ name: `${rowPrefix}.targetCellIndex`, value: row.targetCellIndex });
    fields.push({ name: `${rowPrefix}.sourceVersion`, value: row.sourceVersion });
    fields.push({ name: `${rowPrefix}.rowVersion`, value: row.rowVersion });
  }
  return fields;
}

function validateTreatmentPolicies(
  capacity: number,
  policies: readonly M3MedicalTreatmentPolicyInput[],
): void {
  const seen = new Uint8Array(capacity);
  let index = 0;
  while (index < policies.length) {
    const policy: M3MedicalTreatmentPolicyInput | undefined = policies[index];
    if (policy === undefined || !isIndexInRange(policy.treatmentDefId, capacity))
      throw new RangeError("medical treatment policy id out of range");
    if ((seen[policy.treatmentDefId] ?? 0) === 1)
      throw new RangeError("duplicate medical treatment policy");
    if (!isPositiveUint32(policy.treatmentTicks) || !isPositiveUint32(policy.workPerTickQ16))
      throw new RangeError("medical treatment policy work out of range");
    if (
      !Number.isInteger(policy.severityDelta) ||
      policy.severityDelta < 1 ||
      policy.severityDelta > 1000
    )
      throw new RangeError("medical treatment policy severity out of range");
    const requiredWorkQ16 = policy.treatmentTicks * policy.workPerTickQ16;
    if (
      !Number.isSafeInteger(requiredWorkQ16) ||
      requiredWorkQ16 <= 0 ||
      requiredWorkQ16 > 0xffff_ffff
    )
      throw new RangeError("medical treatment policy required work out of range");
    seen[policy.treatmentDefId] = 1;
    index += 1;
  }
}

function resetPatientInteractionOutput(
  requestId: number,
  indexVersion: number,
  activeCount: number,
  output: M3MedicalPatientInteractionIntoOutput,
): void {
  output.ok = false;
  output.reason = undefined;
  output.active = false;
  output.requestId = requestId;
  output.targetIndex = 0;
  output.targetGeneration = 0;
  output.interactionSpotId = 0;
  output.targetCellIndex = 0;
  output.sourceVersion = 0;
  output.rowVersion = 0;
  output.indexVersion = indexVersion;
  output.activeCount = activeCount;
}

function resetTreatmentPolicyOutput(
  treatmentDefId: number,
  output: M3MedicalTreatmentPolicyIntoOutput,
): void {
  output.ok = false;
  output.reason = undefined;
  output.treatmentDefId = treatmentDefId;
  output.policyKind = 0;
  output.policyVersion = 0;
  output.treatmentTicks = 0;
  output.workPerTickQ16 = 0;
  output.severityDelta = 0;
  output.requiredWorkQ16 = 0;
}

function resetMedicalStockSelection(
  input: M3MedicalStockSelectionInput,
  supply: StorageSupplySelectionScratch,
  output: M3MedicalStockSelectionIntoOutput,
): void {
  clearMedicalStockSupplyLanes(supply);
  output.ok = false;
  output.reason = undefined;
  output.queryStockDefId = input.stockDefId;
  output.queryRegionId = input.regionId;
  output.requiredAmount = input.requiredAmount;
  output.candidateCap = input.candidateCap;
  output.visitedCount = 0;
  output.eligibleCount = 0;
  output.candidateCapHit = false;
  output.stockOwnerVersion = 0;
  output.stockIndexVersion = 0;
  output.stockDirtyBacklog = 0;
  clearMedicalStockWinner(output);
}

function clearMedicalStockSupplyLanes(supply: StorageSupplySelectionScratch): void {
  for (let index = 0; index < STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES; index += 1) {
    supply.slotIds[index] = 0;
    supply.stackIds[index] = 0;
    supply.rowVersions[index] = 0;
    supply.availableSupplies[index] = 0;
    supply.linkedFlags[index] = 0;
  }
}

function clearMedicalStockWinner(output: M3MedicalStockSelectionIntoOutput): void {
  output.storageSlotId = 0;
  output.stockStackId = 0;
  output.itemEntityIndex = 0;
  output.itemEntityGeneration = 0;
  output.defId = 0;
  output.quantity = 0;
  output.availableQuantity = 0;
  output.stockRowVersion = 0;
  output.itemRowVersion = 0;
  output.itemStoreVersion = 0;
  output.reservationVersion = 0;
}

function validateMedicalStockSelectionInput(
  input: M3MedicalStockSelectionInput,
  supply: StorageSupplySelectionScratch,
): M3MedicalClaimFactsReason | undefined {
  if (
    !Number.isSafeInteger(input.candidateCap) ||
    input.candidateCap < 1 ||
    input.candidateCap > STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES
  )
    return "medical_claim_stock_candidate_cap_invalid";
  if (!hasValidMedicalStockScratch(supply)) return "medical_claim_stock_scratch_invalid";
  if (!isUint32(input.stockDefId)) return "medical_claim_stock_def_out_of_range";
  if (!isUint32(input.regionId)) return "medical_claim_stock_region_invalid";
  if (!isPositiveUint32(input.requiredAmount)) return "medical_claim_stock_amount_invalid";
  return undefined;
}

function hasValidMedicalStockScratch(supply: StorageSupplySelectionScratch): boolean {
  return (
    supply.slotIds.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    supply.stackIds.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    supply.rowVersions.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    supply.availableSupplies.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    supply.linkedFlags.length >= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES
  );
}

function copyMedicalStockSupplyHeader(
  supply: StorageSupplySelectionIntoOutput,
  output: M3MedicalStockSelectionIntoOutput,
): void {
  output.visitedCount = supply.visitedCount;
  output.candidateCapHit = supply.candidateCapHit;
  output.stockOwnerVersion = supply.indexVersion;
  output.stockIndexVersion = supply.indexVersion;
  output.stockDirtyBacklog = supply.dirtyBacklog;
}

function hasPublishableMedicalStockSupplyHeader(
  input: M3MedicalStockSelectionInput,
  supply: StorageSupplySelectionIntoOutput,
): boolean {
  if (
    supply.queryDefId !== input.stockDefId ||
    supply.candidateCap !== input.candidateCap ||
    typeof supply.ok !== "boolean" ||
    !isUint32(supply.indexVersion) ||
    !isUint32(supply.dirtyBacklog) ||
    !isUint32(supply.visitedCount) ||
    !isUint32(supply.selectedCount) ||
    typeof supply.candidateCapHit !== "boolean"
  )
    return false;
  if (!supply.ok) {
    return (
      isKnownMedicalStockSupplyFailure(supply.reason) &&
      supply.visitedCount === 0 &&
      supply.selectedCount === 0 &&
      !supply.candidateCapHit
    );
  }
  return (
    supply.reason === undefined &&
    supply.dirtyBacklog === 0 &&
    supply.selectedCount === supply.visitedCount &&
    supply.visitedCount <= input.candidateCap &&
    supply.visitedCount <= STORAGE_SUPPLY_SELECTION_MAX_CANDIDATES &&
    (!supply.candidateCapHit || supply.visitedCount === input.candidateCap)
  );
}

function isKnownMedicalStockSupplyFailure(
  reason: StorageSupplySelectionIntoOutput["reason"],
): boolean {
  return (
    reason === "storage_candidate_buffer_too_small" ||
    reason === "storage_def_invalid" ||
    reason === "storage_dirty_basis_mismatch"
  );
}

function readMedicalStockSupplyFailure(
  supply: StorageSupplySelectionIntoOutput,
): M3MedicalClaimFactsReason | undefined {
  return supply.ok ? undefined : mapMedicalStockSupplyFailure(supply.reason, supply.dirtyBacklog);
}

function mapMedicalStockSupplyFailure(
  reason: StorageSupplySelectionIntoOutput["reason"],
  dirtyBacklog: number,
): M3MedicalClaimFactsReason {
  if (reason === "storage_candidate_buffer_too_small") return "medical_claim_stock_scratch_invalid";
  if (reason === "storage_def_invalid") return "medical_claim_stock_def_out_of_range";
  if (reason === "storage_dirty_basis_mismatch" && dirtyBacklog > 0)
    return "medical_claim_stock_dirty_basis_mismatch";
  return "medical_claim_stock_basis_stale";
}

function selectMedicalStockFromSupply(
  input: M3MedicalStockSelectionInput,
  registry: EntityRegistry,
  storage: StorageLogisticsIndex,
  items: ItemStackStore,
  ledger: ReservationLedger,
  scratch: M3MedicalStockSelectionScratch,
  output: M3MedicalStockSelectionIntoOutput,
): void {
  let hasEpoch = false;
  let itemStoreVersion = 0;
  let reservationVersion = 0;
  let eligibleCount = 0;
  let hasWinner = false;
  for (let index = 0; index < output.visitedCount; index += 1) {
    storage.readSlotInto(scratch.supply.slotIds[index] ?? 0, scratch.slot);
    if (!matchesMedicalStockSlot(input, scratch, output, index)) {
      failMedicalStockSelection(output, "medical_claim_stock_basis_stale");
      return;
    }
    if (scratch.slot.regionId !== input.regionId) continue;
    items.readStackInto(scratch.slot.stackId, ledger, scratch.itemRead, scratch.item);
    if (!matchesMedicalStockItem(input, scratch.slot, scratch.item)) {
      failMedicalStockSelection(output, "medical_claim_stock_basis_stale");
      return;
    }
    const entityReason = medicalStockEntityReason(registry, scratch.item);
    if (entityReason !== undefined) {
      failMedicalStockSelection(output, entityReason);
      return;
    }
    if (hasEpoch && !matchesMedicalStockEpoch(scratch.item, itemStoreVersion, reservationVersion)) {
      failMedicalStockSelection(output, "medical_claim_stock_basis_stale");
      return;
    }
    hasEpoch = true;
    itemStoreVersion = scratch.item.storeVersion;
    reservationVersion = scratch.item.reservationVersion;
    if (scratch.item.availableQuantity < input.requiredAmount) continue;
    eligibleCount += 1;
    if (isBetterMedicalStockWinner(scratch.slot, scratch.item, output, hasWinner)) {
      writeMedicalStockWinner(scratch.slot, scratch.item, output);
      hasWinner = true;
    }
  }
  output.eligibleCount = eligibleCount;
  if (eligibleCount === 0) {
    output.reason = output.candidateCapHit
      ? "medical_claim_stock_candidate_cap_reached"
      : "medical_claim_stock_unavailable";
    return;
  }
  verifyMedicalStockWinner(registry, storage, items, ledger, scratch, output);
}

function matchesMedicalStockSlot(
  input: M3MedicalStockSelectionInput,
  scratch: M3MedicalStockSelectionScratch,
  output: M3MedicalStockSelectionIntoOutput,
  index: number,
): boolean {
  const slot = scratch.slot;
  return (
    slot.ok &&
    slot.active &&
    !slot.dirtyQueued &&
    slot.dirtyBacklog === 0 &&
    slot.slotId === (scratch.supply.slotIds[index] ?? 0) &&
    slot.stackId === (scratch.supply.stackIds[index] ?? 0) &&
    slot.defId === input.stockDefId &&
    slot.rowVersion === (scratch.supply.rowVersions[index] ?? 0) &&
    slot.availableSupply === (scratch.supply.availableSupplies[index] ?? 0) &&
    (scratch.supply.linkedFlags[index] ?? 0) === 1 &&
    slot.indexVersion === output.stockIndexVersion
  );
}

function matchesMedicalStockItem(
  input: M3MedicalStockSelectionInput,
  slot: StorageSlotIntoOutput,
  item: ItemStackIntoOutput,
): boolean {
  return (
    item.ok &&
    item.active &&
    item.stackId === slot.stackId &&
    item.defId === input.stockDefId &&
    item.quantity === slot.quantity &&
    item.reservedQuantity === slot.reservedSupply &&
    item.availableQuantity === slot.availableSupply
  );
}

function medicalStockEntityReason(
  registry: EntityRegistry,
  item: ItemStackIntoOutput,
): M3MedicalClaimFactsReason | undefined {
  if (!registry.isIndexActive(item.entityIndex)) return "medical_claim_stock_item_not_alive";
  if (registry.generationAt(item.entityIndex) !== item.entityGeneration)
    return "medical_claim_stock_item_generation_mismatch";
  return undefined;
}

function matchesMedicalStockEpoch(
  item: ItemStackIntoOutput,
  itemStoreVersion: number,
  reservationVersion: number,
): boolean {
  return item.storeVersion === itemStoreVersion && item.reservationVersion === reservationVersion;
}

function isBetterMedicalStockWinner(
  slot: StorageSlotIntoOutput,
  item: ItemStackIntoOutput,
  output: M3MedicalStockSelectionIntoOutput,
  hasWinner: boolean,
): boolean {
  if (!hasWinner) return true;
  if (item.stackId !== output.stockStackId) return item.stackId < output.stockStackId;
  if (item.entityIndex !== output.itemEntityIndex) return item.entityIndex < output.itemEntityIndex;
  if (item.entityGeneration !== output.itemEntityGeneration)
    return item.entityGeneration < output.itemEntityGeneration;
  return slot.slotId < output.storageSlotId;
}

function writeMedicalStockWinner(
  slot: StorageSlotIntoOutput,
  item: ItemStackIntoOutput,
  output: M3MedicalStockSelectionIntoOutput,
): void {
  output.storageSlotId = slot.slotId;
  output.stockStackId = item.stackId;
  output.itemEntityIndex = item.entityIndex;
  output.itemEntityGeneration = item.entityGeneration;
  output.defId = item.defId;
  output.quantity = item.quantity;
  output.availableQuantity = item.availableQuantity;
  output.stockRowVersion = slot.rowVersion;
  output.itemRowVersion = item.rowVersion;
  output.itemStoreVersion = item.storeVersion;
  output.reservationVersion = item.reservationVersion;
}

function verifyMedicalStockWinner(
  registry: EntityRegistry,
  storage: StorageLogisticsIndex,
  items: ItemStackStore,
  ledger: ReservationLedger,
  scratch: M3MedicalStockSelectionScratch,
  output: M3MedicalStockSelectionIntoOutput,
): void {
  storage.readSlotInto(output.storageSlotId, scratch.slot);
  if (!matchesFinalMedicalStockSlot(scratch.slot, output)) {
    failMedicalStockSelection(output, "medical_claim_stock_basis_stale");
    return;
  }
  items.readStackInto(output.stockStackId, ledger, scratch.itemRead, scratch.item);
  if (!matchesFinalMedicalStockItem(scratch.slot, scratch.item, output)) {
    failMedicalStockSelection(output, "medical_claim_stock_basis_stale");
    return;
  }
  const entityReason = medicalStockEntityReason(registry, scratch.item);
  if (entityReason !== undefined) {
    failMedicalStockSelection(output, entityReason);
    return;
  }
  if (items.version !== output.itemStoreVersion || ledger.version !== output.reservationVersion) {
    failMedicalStockSelection(output, "medical_claim_stock_basis_stale");
    return;
  }
  output.ok = true;
  output.reason = undefined;
}

function matchesFinalMedicalStockSlot(
  slot: StorageSlotIntoOutput,
  output: M3MedicalStockSelectionIntoOutput,
): boolean {
  return (
    slot.ok &&
    slot.active &&
    !slot.dirtyQueued &&
    slot.dirtyBacklog === 0 &&
    slot.slotId === output.storageSlotId &&
    slot.stackId === output.stockStackId &&
    slot.defId === output.defId &&
    slot.regionId === output.queryRegionId &&
    slot.quantity === output.quantity &&
    slot.availableSupply === output.availableQuantity &&
    slot.rowVersion === output.stockRowVersion &&
    slot.indexVersion === output.stockIndexVersion
  );
}

function matchesFinalMedicalStockItem(
  slot: StorageSlotIntoOutput,
  item: ItemStackIntoOutput,
  output: M3MedicalStockSelectionIntoOutput,
): boolean {
  return (
    item.ok &&
    item.active &&
    item.stackId === output.stockStackId &&
    item.entityIndex === output.itemEntityIndex &&
    item.entityGeneration === output.itemEntityGeneration &&
    item.defId === output.defId &&
    item.quantity === output.quantity &&
    item.reservedQuantity === slot.reservedSupply &&
    item.availableQuantity === output.availableQuantity &&
    item.rowVersion === output.itemRowVersion &&
    item.storeVersion === output.itemStoreVersion &&
    item.reservationVersion === output.reservationVersion
  );
}

function failMedicalStockSelection(
  output: M3MedicalStockSelectionIntoOutput,
  reason: M3MedicalClaimFactsReason,
): void {
  output.ok = false;
  output.reason = reason;
  output.eligibleCount = 0;
  clearMedicalStockWinner(output);
}

function validateSnapshotShape(
  value: unknown,
  capacity: number,
): M3MedicalClaimFactsRestoreReason | undefined {
  if (!isPlainRecord(value)) return "medical_claim_snapshot_invalid";
  if (!Object.prototype.hasOwnProperty.call(value, "snapshotVersion"))
    return "medical_claim_snapshot_invalid";
  if (value["snapshotVersion"] !== M3_MEDICAL_CLAIM_FACTS_SNAPSHOT_VERSION)
    return "medical_claim_snapshot_version_unsupported";
  if (!hasExactKeys(value, SNAPSHOT_KEYS)) return "medical_claim_snapshot_invalid";
  const rows = value["rows"];
  if (
    value["capacity"] !== capacity ||
    !isUint32(value["indexVersion"]) ||
    !isUint32(value["activeCount"]) ||
    !isDenseArray(rows) ||
    rows.length !== capacity
  )
    return "medical_claim_snapshot_invalid";
  let activeCount = 0;
  for (let requestId = 0; requestId < rows.length; requestId += 1) {
    const row = rows[requestId];
    if (!isValidSnapshotRow(row, requestId)) return "medical_claim_snapshot_invalid";
    activeCount += row.active;
  }
  if (activeCount !== value["activeCount"] || activeCount !== value["indexVersion"])
    return "medical_claim_snapshot_invalid";
  return undefined;
}

function validateSnapshotRegistry(
  snapshot: M3MedicalClaimFactsSnapshotInput,
  registry: EntityRegistry,
): M3MedicalClaimFactsRestoreReason | undefined {
  for (const row of snapshot.rows) {
    if (row.active === 0) continue;
    if (!registry.isIndexActive(row.targetIndex)) return "medical_claim_snapshot_target_not_alive";
    if (registry.generationAt(row.targetIndex) !== row.targetGeneration)
      return "medical_claim_snapshot_target_generation_mismatch";
  }
  return undefined;
}

function isValidatedSnapshot(
  value: unknown,
  capacity: number,
): value is M3MedicalClaimFactsSnapshotInput {
  return validateSnapshotShape(value, capacity) === undefined;
}

function isValidSnapshotRow(
  value: unknown,
  requestId: number,
): value is M3MedicalPatientInteractionSnapshotRow {
  if (!isPlainRecord(value) || !hasExactKeys(value, SNAPSHOT_ROW_KEYS)) return false;
  if (value["requestId"] !== requestId || !isBit(value["active"])) return false;
  for (const key of SNAPSHOT_UINT_KEYS) if (!isUint32(value[key])) return false;
  if (value["active"] === 0)
    return (
      value["targetIndex"] === 0 &&
      value["targetGeneration"] === 0 &&
      value["interactionSpotId"] === 0 &&
      value["targetCellIndex"] === 0 &&
      value["sourceVersion"] === 0 &&
      value["rowVersion"] === 0
    );
  const targetGeneration = value["targetGeneration"];
  const rowVersion = value["rowVersion"];
  return isUint32(targetGeneration) && targetGeneration > 0 && rowVersion === 1;
}

function isValidTarget(target: EntityId): boolean {
  return (
    Number.isSafeInteger(target.index) && target.index >= 0 && isPositiveUint32(target.generation)
  );
}

function isIndexInRange(value: number, capacity: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < capacity;
}

function isUint32(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff
  );
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function isBit(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) if (!(index in value)) return false;
  return true;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  }
  return true;
}

const SNAPSHOT_KEYS = ["snapshotVersion", "capacity", "indexVersion", "activeCount", "rows"];
const SNAPSHOT_ROW_KEYS = [
  "requestId",
  "active",
  "targetIndex",
  "targetGeneration",
  "interactionSpotId",
  "targetCellIndex",
  "sourceVersion",
  "rowVersion",
];
const SNAPSHOT_UINT_KEYS = [
  "targetIndex",
  "targetGeneration",
  "interactionSpotId",
  "targetCellIndex",
  "sourceVersion",
  "rowVersion",
] as const;
