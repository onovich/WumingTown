import { assertValidCapacity } from "./entity-id";
import type { ItemStackStore } from "./item-stack-store";
import type { MapGrid } from "./map-grid";
import {
  resolveTopKPathCandidates,
  type GridPathfinder,
  type PathCandidate,
  type PathReason,
  type PathSearchResult,
  type PathVersionBasis,
} from "./pathing";
import type { ReservationLedger } from "./reservation-ledger";
import type { Tick } from "./time";

export const M3_FOOD_DEFAULT_CANDIDATE_CAP = 24;
export const M3_FOOD_DEFAULT_SELECTED_CAP = 12;
export const M3_FOOD_DEFAULT_EXACT_PATH_CAP = 4;
export const M3_FOOD_STACK_NONE = 0xffff_ffff;

export type M3FoodReason =
  | "food_stack_id_out_of_range"
  | "food_stack_already_registered"
  | "food_stack_not_registered"
  | "food_def_invalid"
  | "food_region_invalid"
  | "food_permission_invalid"
  | "food_meal_window_invalid"
  | "food_cell_invalid"
  | "food_score_invalid"
  | "food_candidate_cap_invalid"
  | "food_selected_cap_invalid"
  | "food_candidate_buffer_too_small"
  | "food_dirty_backlog"
  | "food.rejected_no_available_portion"
  | "food.rejected_permission"
  | "food.rejected_schedule"
  | "food.rejected_stale_owner"
  | "path.no_route_to_food"
  | "trace.candidate_cap_reached";

export type M3FoodMutationResult =
  | { readonly ok: true; readonly stackId: number; readonly version: number }
  | { readonly ok: false; readonly reason: M3FoodReason };

export interface M3FoodPortionInput {
  readonly stackId: number;
  readonly foodDefId: number;
  readonly regionId: number;
  readonly storageSlotId: number;
  readonly targetCellIndex: number;
  readonly interactionSpotId: number;
  readonly scoreMilli: number;
  readonly permissionId: number;
  readonly mealWindowId: number;
  readonly mealWindowVersion: number;
  readonly safe: boolean;
  readonly permissionAllowed: boolean;
  readonly scheduleAllowed: boolean;
}

export interface M3FoodPortionView extends M3FoodPortionInput {
  readonly availableAmount: number;
  readonly itemStoreVersion: number;
  readonly foodAvailabilityVersion: number;
  readonly linkedCandidate: boolean;
}

export interface M3FoodCandidateQuery {
  readonly foodDefId: number;
  readonly regionId: number;
  readonly permissionId: number;
  readonly mealWindowId: number;
  readonly candidateCap: number;
  readonly maxSelected: number;
}

export type M3FoodCandidateQueryResult =
  | {
      readonly ok: true;
      readonly bucketCandidateCount: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly candidateCapHit: boolean;
      readonly selectedCapHit: boolean;
      readonly selectedStackId: number;
      readonly sourceItemVersion: number;
      readonly foodAvailabilityVersion: number;
      readonly reason: "food.rejected_no_available_portion" | "trace.candidate_cap_reached";
    }
  | { readonly ok: false; readonly reason: M3FoodReason };

export interface M3FoodPathSelectionOptions {
  readonly originCellIndex: number;
  readonly query: M3FoodCandidateQuery;
  readonly maxExactPaths: number;
  readonly basis: PathVersionBasis;
  readonly issuedTick: Tick;
  readonly requestSequenceStart: number;
  readonly maxNodeExpansions?: number;
  readonly stackIdBuffer: Uint32Array;
}

export type M3FoodPathSelectionResult =
  | {
      readonly ok: true;
      readonly stackId: number;
      readonly targetCellIndex: number;
      readonly path: PathSearchResult;
      readonly candidateCount: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly exactPathCount: number;
      readonly candidateCapHit: boolean;
      readonly exactPathCapHit: boolean;
      readonly nodeExpansions: number;
      readonly reason: "trace.candidate_cap_reached" | "food.rejected_no_available_portion";
    }
  | {
      readonly ok: false;
      readonly reason: M3FoodReason;
      readonly pathReason?: PathReason;
      readonly candidateCount: number;
      readonly visitedCount: number;
      readonly selectedCount: number;
      readonly exactPathCount: number;
      readonly candidateCapHit: boolean;
      readonly nodeExpansions: number;
    };

export interface M3FoodMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly indexedCandidateCount: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
  readonly refreshedCount: number;
  readonly rebuiltCount: number;
  readonly lastCandidateCount: number;
  readonly lastVisitedCount: number;
  readonly lastSelectedCount: number;
  readonly lastExactPathCount: number;
  readonly lastCandidateCapHit: boolean;
}

export class M3FoodAvailabilityStore {
  readonly stackCapacity: number;
  readonly foodDefCapacity: number;
  readonly regionCapacity: number;

  private readonly active: Uint8Array;
  private readonly safeFlags: Uint8Array;
  private readonly permissionAllowedFlags: Uint8Array;
  private readonly scheduleAllowedFlags: Uint8Array;
  private readonly linked: Uint8Array;
  private readonly foodDefIds: Uint32Array;
  private readonly regionIds: Uint32Array;
  private readonly storageSlotIds: Uint32Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly interactionSpotIds: Uint32Array;
  private readonly scoreMillis: Uint32Array;
  private readonly permissionIds: Uint32Array;
  private readonly mealWindowIds: Uint32Array;
  private readonly mealWindowVersions: Uint32Array;
  private readonly availableAmounts: Uint32Array;
  private readonly itemStoreVersions: Uint32Array;
  private readonly bucketHeads: Int32Array;
  private readonly bucketCounts: Uint32Array;
  private readonly nextByStack: Int32Array;
  private readonly previousByStack: Int32Array;
  private readonly dirtyQueued: Uint8Array;
  private readonly dirtyQueue: Uint32Array;
  private activeCount = 0;
  private indexedCount = 0;
  private dirtyHead = 0;
  private dirtyCount = 0;
  private dirtyPeak = 0;
  private refreshedCount = 0;
  private rebuiltCount = 0;
  private versionValue = 0;
  private lastCandidateCount = 0;
  private lastVisitedCount = 0;
  private lastSelectedCount = 0;
  private lastExactPathCount = 0;
  private lastCandidateCapHit = false;

  constructor(stackCapacity: number, foodDefCapacity: number, regionCapacity: number) {
    assertValidCapacity(stackCapacity, "m3 food stack capacity");
    assertValidCapacity(foodDefCapacity, "m3 food def capacity");
    assertValidCapacity(regionCapacity, "m3 food region capacity");
    this.stackCapacity = stackCapacity;
    this.foodDefCapacity = foodDefCapacity;
    this.regionCapacity = regionCapacity;
    this.active = new Uint8Array(stackCapacity);
    this.safeFlags = new Uint8Array(stackCapacity);
    this.permissionAllowedFlags = new Uint8Array(stackCapacity);
    this.scheduleAllowedFlags = new Uint8Array(stackCapacity);
    this.linked = new Uint8Array(stackCapacity);
    this.foodDefIds = new Uint32Array(stackCapacity);
    this.regionIds = new Uint32Array(stackCapacity);
    this.storageSlotIds = new Uint32Array(stackCapacity);
    this.targetCellIndexes = new Uint32Array(stackCapacity);
    this.interactionSpotIds = new Uint32Array(stackCapacity);
    this.scoreMillis = new Uint32Array(stackCapacity);
    this.permissionIds = new Uint32Array(stackCapacity);
    this.mealWindowIds = new Uint32Array(stackCapacity);
    this.mealWindowVersions = new Uint32Array(stackCapacity);
    this.availableAmounts = new Uint32Array(stackCapacity);
    this.itemStoreVersions = new Uint32Array(stackCapacity);
    this.bucketHeads = createEmptyLinks(foodDefCapacity * regionCapacity);
    this.bucketCounts = new Uint32Array(foodDefCapacity * regionCapacity);
    this.nextByStack = createEmptyLinks(stackCapacity);
    this.previousByStack = createEmptyLinks(stackCapacity);
    this.dirtyQueued = new Uint8Array(stackCapacity);
    this.dirtyQueue = new Uint32Array(stackCapacity);
  }

  get version(): number {
    return this.versionValue;
  }

  configurePortion(input: M3FoodPortionInput): M3FoodMutationResult {
    const validation = this.validatePortionInput(input);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.stackId] ?? 0) === 1) {
      return { ok: false, reason: "food_stack_already_registered" };
    }

    this.active[input.stackId] = 1;
    this.writePortionConfig(input);
    this.activeCount += 1;
    this.markStackDirty(input.stackId);
    return this.finish(input.stackId);
  }

  updatePortion(input: M3FoodPortionInput): M3FoodMutationResult {
    const validation = this.validatePortionInput(input);
    if (!validation.ok) {
      return validation;
    }

    if (!this.isActiveStack(input.stackId)) {
      return { ok: false, reason: "food_stack_not_registered" };
    }

    this.unlinkCandidate(input.stackId);
    this.writePortionConfig(input);
    this.markStackDirty(input.stackId);
    return this.finish(input.stackId);
  }

  markStackDirty(stackId: number): M3FoodMutationResult {
    if (!this.isActiveStack(stackId)) {
      return { ok: false, reason: "food_stack_not_registered" };
    }

    if ((this.dirtyQueued[stackId] ?? 0) === 0) {
      const tail = (this.dirtyHead + this.dirtyCount) % this.stackCapacity;
      this.dirtyQueue[tail] = stackId;
      this.dirtyQueued[stackId] = 1;
      this.dirtyCount += 1;
      if (this.dirtyCount > this.dirtyPeak) {
        this.dirtyPeak = this.dirtyCount;
      }
    }

    return { ok: true, stackId, version: this.versionValue };
  }

  refreshDirty(items: ItemStackStore, ledger: ReservationLedger, budget: number): M3FoodMetrics {
    let refreshed = 0;

    while (this.dirtyCount > 0 && refreshed < budget) {
      const stackId = this.dirtyQueue[this.dirtyHead] ?? 0;
      this.dirtyHead = (this.dirtyHead + 1) % this.stackCapacity;
      this.dirtyCount -= 1;
      this.dirtyQueued[stackId] = 0;
      this.refreshStack(stackId, items, ledger);
      refreshed += 1;
    }

    if (refreshed > 0) {
      this.refreshedCount += refreshed;
      this.versionValue += 1;
    }

    return this.createMetrics();
  }

  rebuildFromStores(items: ItemStackStore, ledger: ReservationLedger): M3FoodMetrics {
    this.clearCandidates();
    let rebuilt = 0;

    for (let stackId = 0; stackId < this.stackCapacity; stackId += 1) {
      if ((this.active[stackId] ?? 0) === 1) {
        this.refreshStack(stackId, items, ledger);
        rebuilt += 1;
      }
    }

    this.dirtyHead = 0;
    this.dirtyCount = 0;
    this.dirtyQueued.fill(0);
    this.rebuiltCount += rebuilt;
    this.versionValue += 1;
    return this.createMetrics();
  }

  readPortion(stackId: number): M3FoodPortionView | undefined {
    if (!this.isActiveStack(stackId)) {
      return undefined;
    }

    return {
      stackId,
      foodDefId: this.foodDefIds[stackId] ?? 0,
      regionId: this.regionIds[stackId] ?? 0,
      storageSlotId: this.storageSlotIds[stackId] ?? 0,
      targetCellIndex: this.targetCellIndexes[stackId] ?? 0,
      interactionSpotId: this.interactionSpotIds[stackId] ?? 0,
      scoreMilli: this.scoreMillis[stackId] ?? 0,
      permissionId: this.permissionIds[stackId] ?? 0,
      mealWindowId: this.mealWindowIds[stackId] ?? 0,
      mealWindowVersion: this.mealWindowVersions[stackId] ?? 0,
      safe: (this.safeFlags[stackId] ?? 0) === 1,
      permissionAllowed: (this.permissionAllowedFlags[stackId] ?? 0) === 1,
      scheduleAllowed: (this.scheduleAllowedFlags[stackId] ?? 0) === 1,
      availableAmount: this.availableAmounts[stackId] ?? 0,
      itemStoreVersion: this.itemStoreVersions[stackId] ?? 0,
      foodAvailabilityVersion: this.versionValue,
      linkedCandidate: (this.linked[stackId] ?? 0) === 1,
    };
  }

  selectCandidates(
    query: M3FoodCandidateQuery,
    outputStackIds: Uint32Array,
  ): M3FoodCandidateQueryResult {
    const validation = this.validateQuery(query, outputStackIds);
    if (!validation.ok) {
      return validation;
    }

    if (this.dirtyCount > 0) {
      return { ok: false, reason: "food_dirty_backlog" };
    }

    clearUint32(outputStackIds, query.maxSelected, M3_FOOD_STACK_NONE);
    const bucketKey = this.createBucketKey(query.foodDefId, query.regionId);
    const totalCandidates = this.bucketCounts[bucketKey] ?? 0;
    let current = this.bucketHeads[bucketKey] ?? -1;
    let visited = 0;
    let selected = 0;

    while (current >= 0 && visited < query.candidateCap) {
      if (
        (this.permissionIds[current] ?? 0) === query.permissionId &&
        (this.mealWindowIds[current] ?? 0) === query.mealWindowId
      ) {
        if (selected < query.maxSelected) {
          outputStackIds[selected] = current;
          selected += 1;
        }
      }
      visited += 1;
      current = this.nextByStack[current] ?? -1;
    }

    const candidateCapHit = current >= 0;
    const selectedCapHit = selected < totalCandidates && selected === query.maxSelected;
    const reason = candidateCapHit
      ? "trace.candidate_cap_reached"
      : "food.rejected_no_available_portion";
    this.recordSelectionMetrics(totalCandidates, visited, selected, 0, candidateCapHit);
    return {
      ok: true,
      bucketCandidateCount: totalCandidates,
      visitedCount: visited,
      selectedCount: selected,
      candidateCapHit,
      selectedCapHit,
      selectedStackId:
        selected > 0 ? (outputStackIds[0] ?? M3_FOOD_STACK_NONE) : M3_FOOD_STACK_NONE,
      sourceItemVersion: selected > 0 ? (this.itemStoreVersions[outputStackIds[0] ?? 0] ?? 0) : 0,
      foodAvailabilityVersion: this.versionValue,
      reason,
    };
  }

  recordPathMetrics(exactPathCount: number): void {
    this.lastExactPathCount = exactPathCount;
  }

  createMetrics(): M3FoodMetrics {
    return {
      version: this.versionValue,
      activeCount: this.activeCount,
      indexedCandidateCount: this.indexedCount,
      dirtyBacklog: this.dirtyCount,
      dirtyBacklogPeak: this.dirtyPeak,
      refreshedCount: this.refreshedCount,
      rebuiltCount: this.rebuiltCount,
      lastCandidateCount: this.lastCandidateCount,
      lastVisitedCount: this.lastVisitedCount,
      lastSelectedCount: this.lastSelectedCount,
      lastExactPathCount: this.lastExactPathCount,
      lastCandidateCapHit: this.lastCandidateCapHit,
    };
  }

  private refreshStack(stackId: number, items: ItemStackStore, ledger: ReservationLedger): void {
    this.unlinkCandidate(stackId);
    const stack = items.readStack(stackId, ledger);
    if (stack?.defId !== (this.foodDefIds[stackId] ?? 0)) {
      this.availableAmounts[stackId] = 0;
      this.itemStoreVersions[stackId] = items.version;
      return;
    }

    this.availableAmounts[stackId] = stack.availableQuantity;
    this.itemStoreVersions[stackId] = items.version;
    if (
      stack.availableQuantity > 0 &&
      (this.safeFlags[stackId] ?? 0) === 1 &&
      (this.permissionAllowedFlags[stackId] ?? 0) === 1 &&
      (this.scheduleAllowedFlags[stackId] ?? 0) === 1
    ) {
      this.linkCandidate(stackId);
    }
  }

  private linkCandidate(stackId: number): void {
    if ((this.linked[stackId] ?? 0) === 1) {
      return;
    }

    const bucketKey = this.createBucketKey(
      this.foodDefIds[stackId] ?? 0,
      this.regionIds[stackId] ?? 0,
    );
    let current = this.bucketHeads[bucketKey] ?? -1;
    let previous = -1;

    while (current >= 0 && isFoodCandidateBefore(current, stackId, this.scoreMillis)) {
      previous = current;
      current = this.nextByStack[current] ?? -1;
    }

    this.previousByStack[stackId] = previous;
    this.nextByStack[stackId] = current;
    if (previous >= 0) {
      this.nextByStack[previous] = stackId;
    } else {
      this.bucketHeads[bucketKey] = stackId;
    }
    if (current >= 0) {
      this.previousByStack[current] = stackId;
    }
    this.linked[stackId] = 1;
    this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 0) + 1;
    this.indexedCount += 1;
  }

  private unlinkCandidate(stackId: number): void {
    if ((this.linked[stackId] ?? 0) !== 1) {
      return;
    }

    const bucketKey = this.createBucketKey(
      this.foodDefIds[stackId] ?? 0,
      this.regionIds[stackId] ?? 0,
    );
    const previous = this.previousByStack[stackId] ?? -1;
    const next = this.nextByStack[stackId] ?? -1;

    if (previous >= 0) {
      this.nextByStack[previous] = next;
    } else {
      this.bucketHeads[bucketKey] = next;
    }
    if (next >= 0) {
      this.previousByStack[next] = previous;
    }

    this.linked[stackId] = 0;
    this.nextByStack[stackId] = -1;
    this.previousByStack[stackId] = -1;
    this.bucketCounts[bucketKey] = (this.bucketCounts[bucketKey] ?? 1) - 1;
    this.indexedCount -= 1;
  }

  private validatePortionInput(input: M3FoodPortionInput): M3FoodMutationResult {
    if (!isIndexInRange(input.stackId, this.stackCapacity)) {
      return { ok: false, reason: "food_stack_id_out_of_range" };
    }
    if (!isIndexInRange(input.foodDefId, this.foodDefCapacity)) {
      return { ok: false, reason: "food_def_invalid" };
    }
    if (!isIndexInRange(input.regionId, this.regionCapacity)) {
      return { ok: false, reason: "food_region_invalid" };
    }
    if (!isSafeUint32(input.permissionId)) {
      return { ok: false, reason: "food_permission_invalid" };
    }
    if (!isSafeUint32(input.mealWindowId) || !isSafeUint32(input.mealWindowVersion)) {
      return { ok: false, reason: "food_meal_window_invalid" };
    }
    if (!isSafeUint32(input.targetCellIndex) || !isSafeUint32(input.interactionSpotId)) {
      return { ok: false, reason: "food_cell_invalid" };
    }
    if (!isSafeUint32(input.scoreMilli)) {
      return { ok: false, reason: "food_score_invalid" };
    }
    return { ok: true, stackId: input.stackId, version: this.versionValue };
  }

  private validateQuery(
    query: M3FoodCandidateQuery,
    outputStackIds: Uint32Array,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: M3FoodReason } {
    if (!isIndexInRange(query.foodDefId, this.foodDefCapacity)) {
      return { ok: false, reason: "food_def_invalid" };
    }
    if (!isIndexInRange(query.regionId, this.regionCapacity)) {
      return { ok: false, reason: "food_region_invalid" };
    }
    if (!isSafeUint32(query.permissionId)) {
      return { ok: false, reason: "food_permission_invalid" };
    }
    if (!isSafeUint32(query.mealWindowId)) {
      return { ok: false, reason: "food_meal_window_invalid" };
    }
    if (!isPositiveSafeInteger(query.candidateCap)) {
      return { ok: false, reason: "food_candidate_cap_invalid" };
    }
    if (!isPositiveSafeInteger(query.maxSelected) || query.maxSelected > outputStackIds.length) {
      return { ok: false, reason: "food_candidate_buffer_too_small" };
    }
    return { ok: true };
  }

  private writePortionConfig(input: M3FoodPortionInput): void {
    this.foodDefIds[input.stackId] = input.foodDefId;
    this.regionIds[input.stackId] = input.regionId;
    this.storageSlotIds[input.stackId] = input.storageSlotId;
    this.targetCellIndexes[input.stackId] = input.targetCellIndex;
    this.interactionSpotIds[input.stackId] = input.interactionSpotId;
    this.scoreMillis[input.stackId] = input.scoreMilli;
    this.permissionIds[input.stackId] = input.permissionId;
    this.mealWindowIds[input.stackId] = input.mealWindowId;
    this.mealWindowVersions[input.stackId] = input.mealWindowVersion;
    this.safeFlags[input.stackId] = input.safe ? 1 : 0;
    this.permissionAllowedFlags[input.stackId] = input.permissionAllowed ? 1 : 0;
    this.scheduleAllowedFlags[input.stackId] = input.scheduleAllowed ? 1 : 0;
  }

  private clearCandidates(): void {
    this.linked.fill(0);
    this.bucketHeads.fill(-1);
    this.bucketCounts.fill(0);
    this.nextByStack.fill(-1);
    this.previousByStack.fill(-1);
    this.indexedCount = 0;
  }

  private createBucketKey(foodDefId: number, regionId: number): number {
    return foodDefId * this.regionCapacity + regionId;
  }

  private recordSelectionMetrics(
    candidateCount: number,
    visitedCount: number,
    selectedCount: number,
    exactPathCount: number,
    candidateCapHit: boolean,
  ): void {
    this.lastCandidateCount = candidateCount;
    this.lastVisitedCount = visitedCount;
    this.lastSelectedCount = selectedCount;
    this.lastExactPathCount = exactPathCount;
    this.lastCandidateCapHit = candidateCapHit;
  }

  private isActiveStack(stackId: number): boolean {
    return isIndexInRange(stackId, this.stackCapacity) && (this.active[stackId] ?? 0) === 1;
  }

  private finish(stackId: number): M3FoodMutationResult {
    this.versionValue += 1;
    return { ok: true, stackId, version: this.versionValue };
  }
}

export function createM3FoodAvailabilityStore(
  stackCapacity: number,
  foodDefCapacity: number,
  regionCapacity: number,
): M3FoodAvailabilityStore {
  return new M3FoodAvailabilityStore(stackCapacity, foodDefCapacity, regionCapacity);
}

export function resolveM3FoodPathCandidate(
  food: M3FoodAvailabilityStore,
  pathfinder: GridPathfinder,
  grid: MapGrid,
  options: M3FoodPathSelectionOptions,
): M3FoodPathSelectionResult {
  const candidateResult = food.selectCandidates(options.query, options.stackIdBuffer);
  if (!candidateResult.ok) {
    return createPathSelectionFailure(candidateResult.reason);
  }

  if (candidateResult.selectedCount === 0) {
    return {
      ok: false,
      reason: "food.rejected_no_available_portion",
      candidateCount: candidateResult.bucketCandidateCount,
      visitedCount: candidateResult.visitedCount,
      selectedCount: 0,
      exactPathCount: 0,
      candidateCapHit: candidateResult.candidateCapHit,
      nodeExpansions: 0,
    };
  }

  const pathCandidates = createPathCandidates(
    food,
    options.stackIdBuffer,
    candidateResult.selectedCount,
  );
  const pathOptions = {
    originCellIndex: options.originCellIndex,
    candidates: pathCandidates,
    maxExactPaths: options.maxExactPaths,
    basis: options.basis,
    issuedTick: options.issuedTick,
    requestSequenceStart: options.requestSequenceStart,
  };
  const resolved =
    options.maxNodeExpansions === undefined
      ? resolveTopKPathCandidates(pathfinder, grid, pathOptions)
      : resolveTopKPathCandidates(pathfinder, grid, {
          ...pathOptions,
          maxNodeExpansions: options.maxNodeExpansions,
        });

  if (!resolved.ok) {
    return createResolvedFailure(resolved.reason, candidateResult);
  }

  food.recordPathMetrics(resolved.exactPathCount);
  for (let index = 0; index < resolved.results.length; index += 1) {
    const result = resolved.results[index];
    const candidate = pathCandidates[index];
    if (result?.ok === true && candidate !== undefined) {
      return {
        ok: true,
        stackId: candidate.candidateId,
        targetCellIndex: candidate.targetCellIndex,
        path: result,
        candidateCount: candidateResult.bucketCandidateCount,
        visitedCount: candidateResult.visitedCount,
        selectedCount: candidateResult.selectedCount,
        exactPathCount: resolved.exactPathCount,
        candidateCapHit: candidateResult.candidateCapHit,
        exactPathCapHit: resolved.capHitCount > 0,
        nodeExpansions: resolved.nodeExpansions,
        reason: candidateResult.reason,
      };
    }
  }

  const pathReason = readFirstPathReason(resolved.results);
  if (pathReason !== undefined) {
    return {
      ok: false,
      reason: "path.no_route_to_food",
      pathReason,
      candidateCount: candidateResult.bucketCandidateCount,
      visitedCount: candidateResult.visitedCount,
      selectedCount: candidateResult.selectedCount,
      exactPathCount: resolved.exactPathCount,
      candidateCapHit: candidateResult.candidateCapHit,
      nodeExpansions: resolved.nodeExpansions,
    };
  }

  return {
    ok: false,
    reason: "path.no_route_to_food",
    candidateCount: candidateResult.bucketCandidateCount,
    visitedCount: candidateResult.visitedCount,
    selectedCount: candidateResult.selectedCount,
    exactPathCount: resolved.exactPathCount,
    candidateCapHit: candidateResult.candidateCapHit,
    nodeExpansions: resolved.nodeExpansions,
  };
}

function createPathSelectionFailure(reason: M3FoodReason): M3FoodPathSelectionResult {
  return {
    ok: false,
    reason,
    candidateCount: 0,
    visitedCount: 0,
    selectedCount: 0,
    exactPathCount: 0,
    candidateCapHit: false,
    nodeExpansions: 0,
  };
}

function createResolvedFailure(
  reason: PathReason,
  candidateResult: Extract<M3FoodCandidateQueryResult, { readonly ok: true }>,
): M3FoodPathSelectionResult {
  return {
    ok: false,
    reason: "path.no_route_to_food",
    pathReason: reason,
    candidateCount: candidateResult.bucketCandidateCount,
    visitedCount: candidateResult.visitedCount,
    selectedCount: candidateResult.selectedCount,
    exactPathCount: 0,
    candidateCapHit: candidateResult.candidateCapHit,
    nodeExpansions: 0,
  };
}

function createPathCandidates(
  food: M3FoodAvailabilityStore,
  stackIds: Uint32Array,
  selectedCount: number,
): readonly PathCandidate[] {
  const pathCandidates: PathCandidate[] = [];

  for (let index = 0; index < selectedCount; index += 1) {
    const stackId = stackIds[index] ?? M3_FOOD_STACK_NONE;
    const portion = food.readPortion(stackId);
    if (portion !== undefined) {
      pathCandidates.push({
        candidateId: stackId,
        targetCellIndex: portion.targetCellIndex,
        scoreMilli: portion.scoreMilli,
      });
    }
  }

  return pathCandidates;
}

function readFirstPathReason(results: readonly PathSearchResult[]): PathReason | undefined {
  for (const result of results) {
    if (!result.ok) {
      return result.reason;
    }
  }

  return undefined;
}

function isFoodCandidateBefore(current: number, next: number, scores: Uint32Array): boolean {
  const currentScore = scores[current] ?? 0;
  const nextScore = scores[next] ?? 0;
  if (currentScore !== nextScore) {
    return currentScore > nextScore;
  }

  return current < next;
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

function clearUint32(values: Uint32Array, count: number, fill: number): void {
  for (let index = 0; index < count; index += 1) {
    values[index] = fill;
  }
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isSafeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
