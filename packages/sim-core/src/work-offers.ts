import { assertValidCapacity } from "./entity-id";
import type { MapGrid } from "./map-grid";
import {
  samePathBasis,
  type GridPathfinder,
  type PathReason,
  type PathRequest,
  type PathSearchResult,
  type PathVersionBasis,
} from "./pathing";

export const WORK_OFFER_NONE = 0xffff_ffff;

export type WorkOfferReason =
  | "work_offer_id_out_of_range"
  | "work_offer_already_registered"
  | "work_offer_not_registered"
  | "work_offer_pawn_count_invalid"
  | "work_offer_work_type_out_of_range"
  | "work_offer_region_out_of_range"
  | "work_offer_def_out_of_range"
  | "work_offer_urgency_out_of_range"
  | "work_offer_permission_out_of_range"
  | "work_offer_target_out_of_range"
  | "work_offer_score_out_of_range"
  | "work_offer_candidate_cap_invalid"
  | "work_offer_selected_cap_invalid"
  | "work_offer_candidate_buffer_too_small"
  | "work_offer_pawn_query_buffer_too_small"
  | "work_offer_selection_buffer_too_small"
  | "work_offer_multi_output_buffer_too_small"
  | "work_offer_trace_capacity_invalid";

export type WorkOfferTraceReason =
  | "work_offer_trace_none"
  | "work_offer_candidate_cap"
  | "work_offer_selected_cap"
  | "work_offer_no_candidate";

export type WorkOfferRejectionClass =
  | "work_offer_rejection_candidate_cap"
  | "work_offer_rejection_selected_cap"
  | "work_offer_rejection_no_candidate";

export type WorkOfferPathSelectionReason =
  | "work_path_selected"
  | "work_path_no_indexed_candidate"
  | "work_path_region_unreachable"
  | "work_path_version_basis_stale"
  | "work_path_invalid_candidate"
  | "work_path_blocked"
  | "work_path_no_route"
  | "work_path_node_budget_exhausted"
  | "work_path_exact_topk_cap"
  | "work_path_selection_failed";

export type WorkOfferMutationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        WorkOfferReason,
        | "work_offer_id_out_of_range"
        | "work_offer_already_registered"
        | "work_offer_not_registered"
        | "work_offer_work_type_out_of_range"
        | "work_offer_region_out_of_range"
        | "work_offer_def_out_of_range"
        | "work_offer_urgency_out_of_range"
        | "work_offer_permission_out_of_range"
        | "work_offer_target_out_of_range"
        | "work_offer_score_out_of_range"
      >;
    };

export type WorkOfferQueryResult =
  | {
      readonly ok: true;
      readonly count: number;
      readonly bucketCandidateCount: number;
      readonly visitedCount: number;
      readonly candidateCapHit: boolean;
      readonly outputTruncated: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        WorkOfferReason,
        | "work_offer_work_type_out_of_range"
        | "work_offer_region_out_of_range"
        | "work_offer_def_out_of_range"
        | "work_offer_urgency_out_of_range"
        | "work_offer_permission_out_of_range"
        | "work_offer_candidate_cap_invalid"
      >;
    };

export type WorkOfferSelectionResult =
  | {
      readonly ok: true;
      readonly selectedCount: number;
      readonly bucketCandidateCount: number;
      readonly visitedCount: number;
      readonly scoredCount: number;
      readonly rejectedByCandidateCap: number;
      readonly rejectedBySelectedCap: number;
      readonly traceSequence: number;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        WorkOfferReason,
        | "work_offer_work_type_out_of_range"
        | "work_offer_region_out_of_range"
        | "work_offer_def_out_of_range"
        | "work_offer_urgency_out_of_range"
        | "work_offer_permission_out_of_range"
        | "work_offer_candidate_cap_invalid"
        | "work_offer_selected_cap_invalid"
        | "work_offer_candidate_buffer_too_small"
        | "work_offer_selection_buffer_too_small"
      >;
    };

export type WorkOfferMultiPawnSelectionResult =
  | {
      readonly ok: true;
      readonly pawnCount: number;
      readonly selectedOfferCount: number;
      readonly totalBucketCandidateCount: number;
      readonly totalVisitedCount: number;
      readonly totalScoredCount: number;
      readonly totalRejectedByCandidateCap: number;
      readonly totalRejectedBySelectedCap: number;
      readonly candidateCapHitCount: number;
      readonly selectedCapHitCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        WorkOfferReason,
        | "work_offer_pawn_count_invalid"
        | "work_offer_work_type_out_of_range"
        | "work_offer_region_out_of_range"
        | "work_offer_def_out_of_range"
        | "work_offer_urgency_out_of_range"
        | "work_offer_permission_out_of_range"
        | "work_offer_candidate_cap_invalid"
        | "work_offer_selected_cap_invalid"
        | "work_offer_candidate_buffer_too_small"
        | "work_offer_pawn_query_buffer_too_small"
        | "work_offer_selection_buffer_too_small"
        | "work_offer_multi_output_buffer_too_small"
      >;
    };

export interface WorkOfferIndexOptions {
  readonly capacity: number;
  readonly workTypeCapacity: number;
  readonly regionCapacity: number;
  readonly defCapacity: number;
  readonly urgencyBucketCount: number;
  readonly permissionCapacity: number;
}

export interface WorkOfferInput {
  readonly offerId: number;
  readonly workType: number;
  readonly regionId: number;
  readonly defId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
  readonly targetId: number;
  readonly targetCellIndex: number;
  readonly scoreMilli: number;
}

export interface WorkOfferQuery {
  readonly workType: number;
  readonly regionId: number;
  readonly defId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
  readonly candidateCap: number;
}

export interface WorkOfferSelectionOptions extends WorkOfferQuery {
  readonly pawnId: number;
  readonly maxSelectedOffers: number;
}

export interface WorkOfferMultiPawnSelectionOptions {
  readonly pawnCount: number;
  readonly pawnIds: Uint32Array;
  readonly workTypes: Uint32Array;
  readonly regionIds: Uint32Array;
  readonly defIds: Uint32Array;
  readonly urgencyBuckets: Uint32Array;
  readonly permissionIds: Uint32Array;
  readonly candidateCap: number;
  readonly maxSelectedOffers: number;
}

export interface WorkOfferMultiPawnSelectionScratch {
  readonly candidateOfferIds: Uint32Array;
  readonly selectedOfferIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
}

export interface WorkOfferMultiPawnSelectionOutput {
  readonly selectedOfferIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
  readonly selectedCounts: Uint32Array;
  readonly bucketCandidateCounts: Uint32Array;
  readonly visitedCounts: Uint32Array;
  readonly scoredCounts: Uint32Array;
  readonly rejectedByCandidateCaps: Uint32Array;
  readonly rejectedBySelectedCaps: Uint32Array;
  readonly traceSequences: Uint32Array;
}

export interface WorkOfferPathSelectionOptions extends WorkOfferSelectionOptions {
  readonly originCellIndex: number;
  readonly originRegionId: number;
  readonly issuedTick: number;
  readonly requestSequenceStart: number;
  readonly basis: PathVersionBasis;
  readonly currentBasis: PathVersionBasis;
  readonly maxExactPaths: number;
  readonly maxNodeExpansions?: number;
}

export interface WorkOfferPathSelectionScratch {
  readonly candidateOfferIds: Uint32Array;
  readonly selectedOfferIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
}

export type WorkOfferPathSelectionResult =
  | {
      readonly ok: true;
      readonly reason: WorkOfferPathSelectionReason;
      readonly selectedOfferId: number;
      readonly selectedTargetCellIndex: number;
      readonly selectedPath: PathSearchResult | undefined;
      readonly bucketCandidateCount: number;
      readonly visitedCount: number;
      readonly scoredCount: number;
      readonly selectedCount: number;
      readonly rejectedByCandidateCap: number;
      readonly regionRejectedCount: number;
      readonly invalidRejectedCount: number;
      readonly blockedRejectedCount: number;
      readonly noRouteRejectedCount: number;
      readonly nodeBudgetRejectedCount: number;
      readonly staleRejectedCount: number;
      readonly exactPathCount: number;
      readonly exactPathCapHit: boolean;
      readonly nodeExpansions: number;
      readonly traceSequence: number;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<
        WorkOfferReason,
        | "work_offer_work_type_out_of_range"
        | "work_offer_region_out_of_range"
        | "work_offer_def_out_of_range"
        | "work_offer_urgency_out_of_range"
        | "work_offer_permission_out_of_range"
        | "work_offer_candidate_cap_invalid"
        | "work_offer_selected_cap_invalid"
        | "work_offer_candidate_buffer_too_small"
        | "work_offer_selection_buffer_too_small"
        | "work_offer_trace_capacity_invalid"
      >;
    };

export interface WorkOfferIndexMetrics {
  readonly activeOfferCount: number;
  readonly compositeBucketCount: number;
  readonly backlogCount: number;
}

export interface WorkOfferReasonTraceInput {
  readonly pawnId: number;
  readonly workType: number;
  readonly regionId: number;
  readonly defId: number;
  readonly urgencyBucket: number;
  readonly permissionId: number;
  readonly bucketCandidateCount: number;
  readonly visitedCount: number;
  readonly scoredCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly selectedOfferId: number;
  readonly selectedScoreMilli: number;
  readonly rejectedByCandidateCap: number;
  readonly rejectedBySelectedCap: number;
  readonly rejectionMask: number;
  readonly reason: WorkOfferTraceReason;
}

export interface WorkOfferReasonTraceView extends WorkOfferReasonTraceInput {
  readonly sequence: number;
}

export interface ReasonTraceStoreMetrics {
  readonly capacity: number;
  readonly storedCount: number;
  readonly nextSequence: number;
  readonly backlogCount: number;
}

export class WorkOfferIndex {
  readonly capacity: number;
  readonly workTypeCapacity: number;
  readonly regionCapacity: number;
  readonly defCapacity: number;
  readonly urgencyBucketCount: number;
  readonly permissionCapacity: number;
  readonly compositeBucketCount: number;

  private readonly active: Uint8Array;
  private readonly workTypes: Uint32Array;
  private readonly regionIds: Uint32Array;
  private readonly defIds: Uint32Array;
  private readonly urgencyBuckets: Uint32Array;
  private readonly permissionIds: Uint32Array;
  private readonly targetIds: Uint32Array;
  private readonly targetCellIndexes: Uint32Array;
  private readonly scoresMilli: Int32Array;
  private readonly bucketHeads: Int32Array;
  private readonly bucketCounts: Uint32Array;
  private readonly nextOffer: Int32Array;
  private readonly previousOffer: Int32Array;
  private activeCount = 0;

  constructor(options: WorkOfferIndexOptions) {
    assertValidCapacity(options.capacity, "work offer capacity");
    assertValidCapacity(options.workTypeCapacity, "work offer work type capacity");
    assertValidCapacity(options.regionCapacity, "work offer region capacity");
    assertValidCapacity(options.defCapacity, "work offer def capacity");
    assertValidCapacity(options.urgencyBucketCount, "work offer urgency bucket count");
    assertValidCapacity(options.permissionCapacity, "work offer permission capacity");

    this.capacity = options.capacity;
    this.workTypeCapacity = options.workTypeCapacity;
    this.regionCapacity = options.regionCapacity;
    this.defCapacity = options.defCapacity;
    this.urgencyBucketCount = options.urgencyBucketCount;
    this.permissionCapacity = options.permissionCapacity;
    this.compositeBucketCount = requireCompositeBucketCount(options);
    this.active = new Uint8Array(options.capacity);
    this.workTypes = new Uint32Array(options.capacity);
    this.regionIds = new Uint32Array(options.capacity);
    this.defIds = new Uint32Array(options.capacity);
    this.urgencyBuckets = new Uint32Array(options.capacity);
    this.permissionIds = new Uint32Array(options.capacity);
    this.targetIds = new Uint32Array(options.capacity);
    this.targetCellIndexes = new Uint32Array(options.capacity);
    this.scoresMilli = new Int32Array(options.capacity);
    this.bucketHeads = createEmptyLinks(this.compositeBucketCount);
    this.bucketCounts = new Uint32Array(this.compositeBucketCount);
    this.nextOffer = createEmptyLinks(options.capacity);
    this.previousOffer = createEmptyLinks(options.capacity);
  }

  get activeOfferCount(): number {
    return this.activeCount;
  }

  registerOffer(input: WorkOfferInput): WorkOfferMutationResult {
    const validation = this.validateInput(input);

    if (!validation.ok) {
      return validation;
    }

    if (this.active[input.offerId] === 1) {
      return { ok: false, reason: "work_offer_already_registered" };
    }

    this.writeOffer(input);
    this.insertOffer(input.offerId);
    this.activeCount += 1;
    return { ok: true };
  }

  updateOffer(input: WorkOfferInput): WorkOfferMutationResult {
    const validation = this.validateInput(input);

    if (!validation.ok) {
      return validation;
    }

    if (this.active[input.offerId] !== 1) {
      return { ok: false, reason: "work_offer_not_registered" };
    }

    this.removeOfferFromCurrentBucket(input.offerId);
    this.writeOffer(input);
    this.insertOffer(input.offerId);
    return { ok: true };
  }

  removeOffer(offerId: number): WorkOfferMutationResult {
    if (!isIndexInRange(offerId, this.capacity)) {
      return { ok: false, reason: "work_offer_id_out_of_range" };
    }

    if (this.active[offerId] !== 1) {
      return { ok: false, reason: "work_offer_not_registered" };
    }

    this.removeOfferFromCurrentBucket(offerId);
    this.active[offerId] = 0;
    this.activeCount -= 1;
    return { ok: true };
  }

  queryCandidates(query: WorkOfferQuery, outputOfferIds: Uint32Array): WorkOfferQueryResult {
    const validation = this.validateQuery(query);

    if (!validation.ok) {
      return validation;
    }

    const key = this.createCompositeKey(query);
    const bucketCandidateCount = this.bucketCounts[key] ?? 0;
    const outputLimit = Math.min(outputOfferIds.length, query.candidateCap);
    let current = this.bucketHeads[key] ?? -1;
    let count = 0;
    let visitedCount = 0;

    while (current >= 0 && visitedCount < query.candidateCap) {
      if (count < outputLimit) {
        outputOfferIds[count] = current;
        count += 1;
      }

      visitedCount += 1;
      current = this.nextOffer[current] ?? -1;

      if (count >= outputLimit) {
        break;
      }
    }

    return {
      ok: true,
      count,
      bucketCandidateCount,
      visitedCount,
      candidateCapHit: bucketCandidateCount > visitedCount,
      outputTruncated: bucketCandidateCount > count,
    };
  }

  selectTopOffers(
    options: WorkOfferSelectionOptions,
    candidateScratch: Uint32Array,
    selectedOfferIds: Uint32Array,
    selectedScoresMilli: Int32Array,
    traceStore?: ReasonTraceStore,
  ): WorkOfferSelectionResult {
    const validation = this.validateSelection(options, candidateScratch, selectedOfferIds);

    if (!validation.ok) {
      return validation;
    }

    clearSelection(selectedOfferIds, selectedScoresMilli, options.maxSelectedOffers);
    return this.selectTopOffersForValues(
      options.pawnId,
      options.workType,
      options.regionId,
      options.defId,
      options.urgencyBucket,
      options.permissionId,
      options.candidateCap,
      options.maxSelectedOffers,
      candidateScratch,
      selectedOfferIds,
      selectedScoresMilli,
      traceStore,
    );
  }

  selectTopOffersForPawns(
    options: WorkOfferMultiPawnSelectionOptions,
    scratch: WorkOfferMultiPawnSelectionScratch,
    output: WorkOfferMultiPawnSelectionOutput,
    traceStore?: ReasonTraceStore,
  ): WorkOfferMultiPawnSelectionResult {
    const validation = this.validateMultiPawnSelection(options, scratch, output);

    if (!validation.ok) {
      return validation;
    }

    clearMultiPawnOutput(output, options.pawnCount, options.maxSelectedOffers);
    let selectedOfferCount = 0;
    let totalBucketCandidateCount = 0;
    let totalVisitedCount = 0;
    let totalScoredCount = 0;
    let totalRejectedByCandidateCap = 0;
    let totalRejectedBySelectedCap = 0;
    let candidateCapHitCount = 0;
    let selectedCapHitCount = 0;

    for (let pawnOffset = 0; pawnOffset < options.pawnCount; pawnOffset += 1) {
      clearSelection(
        scratch.selectedOfferIds,
        scratch.selectedScoresMilli,
        options.maxSelectedOffers,
      );
      const selected = this.selectTopOffersForValues(
        options.pawnIds[pawnOffset] ?? 0,
        options.workTypes[pawnOffset] ?? 0,
        options.regionIds[pawnOffset] ?? 0,
        options.defIds[pawnOffset] ?? 0,
        options.urgencyBuckets[pawnOffset] ?? 0,
        options.permissionIds[pawnOffset] ?? 0,
        options.candidateCap,
        options.maxSelectedOffers,
        scratch.candidateOfferIds,
        scratch.selectedOfferIds,
        scratch.selectedScoresMilli,
        traceStore,
      );

      if (!selected.ok) {
        return selected;
      }

      const outputOffset = pawnOffset * options.maxSelectedOffers;
      for (let selectedOffset = 0; selectedOffset < selected.selectedCount; selectedOffset += 1) {
        const writeOffset = outputOffset + selectedOffset;
        output.selectedOfferIds[writeOffset] =
          scratch.selectedOfferIds[selectedOffset] ?? WORK_OFFER_NONE;
        output.selectedScoresMilli[writeOffset] = scratch.selectedScoresMilli[selectedOffset] ?? 0;
      }

      output.selectedCounts[pawnOffset] = selected.selectedCount;
      output.bucketCandidateCounts[pawnOffset] = selected.bucketCandidateCount;
      output.visitedCounts[pawnOffset] = selected.visitedCount;
      output.scoredCounts[pawnOffset] = selected.scoredCount;
      output.rejectedByCandidateCaps[pawnOffset] = selected.rejectedByCandidateCap;
      output.rejectedBySelectedCaps[pawnOffset] = selected.rejectedBySelectedCap;
      output.traceSequences[pawnOffset] = selected.traceSequence;

      selectedOfferCount += selected.selectedCount;
      totalBucketCandidateCount += selected.bucketCandidateCount;
      totalVisitedCount += selected.visitedCount;
      totalScoredCount += selected.scoredCount;
      totalRejectedByCandidateCap += selected.rejectedByCandidateCap;
      totalRejectedBySelectedCap += selected.rejectedBySelectedCap;

      if (selected.rejectedByCandidateCap > 0) {
        candidateCapHitCount += 1;
      }

      if (selected.rejectedBySelectedCap > 0) {
        selectedCapHitCount += 1;
      }
    }

    return {
      ok: true,
      pawnCount: options.pawnCount,
      selectedOfferCount,
      totalBucketCandidateCount,
      totalVisitedCount,
      totalScoredCount,
      totalRejectedByCandidateCap,
      totalRejectedBySelectedCap,
      candidateCapHitCount,
      selectedCapHitCount,
    };
  }

  readOffer(offerId: number): WorkOfferInput | undefined {
    if (!isIndexInRange(offerId, this.capacity) || this.active[offerId] !== 1) {
      return undefined;
    }

    return {
      offerId,
      workType: this.workTypes[offerId] ?? 0,
      regionId: this.regionIds[offerId] ?? 0,
      defId: this.defIds[offerId] ?? 0,
      urgencyBucket: this.urgencyBuckets[offerId] ?? 0,
      permissionId: this.permissionIds[offerId] ?? 0,
      targetId: this.targetIds[offerId] ?? 0,
      targetCellIndex: this.targetCellIndexes[offerId] ?? 0,
      scoreMilli: this.scoresMilli[offerId] ?? 0,
    };
  }

  createMetrics(): WorkOfferIndexMetrics {
    return {
      activeOfferCount: this.activeCount,
      compositeBucketCount: this.compositeBucketCount,
      backlogCount: 0,
    };
  }

  private writeOffer(input: WorkOfferInput): void {
    this.active[input.offerId] = 1;
    this.workTypes[input.offerId] = input.workType;
    this.regionIds[input.offerId] = input.regionId;
    this.defIds[input.offerId] = input.defId;
    this.urgencyBuckets[input.offerId] = input.urgencyBucket;
    this.permissionIds[input.offerId] = input.permissionId;
    this.targetIds[input.offerId] = input.targetId;
    this.targetCellIndexes[input.offerId] = input.targetCellIndex;
    this.scoresMilli[input.offerId] = input.scoreMilli;
  }

  private insertOffer(offerId: number): void {
    const key = this.createCompositeKeyForOffer(offerId);
    insertSorted(this.bucketHeads, this.nextOffer, this.previousOffer, key, offerId);
    this.bucketCounts[key] = (this.bucketCounts[key] ?? 0) + 1;
  }

  private removeOfferFromCurrentBucket(offerId: number): void {
    const key = this.createCompositeKeyForOffer(offerId);
    removeLinked(this.bucketHeads, this.nextOffer, this.previousOffer, key, offerId);
    this.bucketCounts[key] = Math.max(0, (this.bucketCounts[key] ?? 0) - 1);
  }

  private createCompositeKey(query: WorkOfferQuery): number {
    return createCompositeKey(
      query.workType,
      query.regionId,
      query.defId,
      query.urgencyBucket,
      query.permissionId,
      this,
    );
  }

  private createCompositeKeyForOffer(offerId: number): number {
    return createCompositeKey(
      this.workTypes[offerId] ?? 0,
      this.regionIds[offerId] ?? 0,
      this.defIds[offerId] ?? 0,
      this.urgencyBuckets[offerId] ?? 0,
      this.permissionIds[offerId] ?? 0,
      this,
    );
  }

  private validateInput(input: WorkOfferInput): WorkOfferMutationResult {
    if (!isIndexInRange(input.offerId, this.capacity)) {
      return { ok: false, reason: "work_offer_id_out_of_range" };
    }

    const keyValidation = this.validateKey(input);

    if (!keyValidation.ok) {
      return keyValidation;
    }

    if (!isSafeNonNegativeInteger(input.targetId) || input.targetId >= WORK_OFFER_NONE) {
      return { ok: false, reason: "work_offer_target_out_of_range" };
    }

    if (
      !isSafeNonNegativeInteger(input.targetCellIndex) ||
      input.targetCellIndex >= WORK_OFFER_NONE
    ) {
      return { ok: false, reason: "work_offer_target_out_of_range" };
    }

    if (!isInt32(input.scoreMilli)) {
      return { ok: false, reason: "work_offer_score_out_of_range" };
    }

    return { ok: true };
  }

  private validateQuery(query: WorkOfferQuery):
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly reason: Extract<
          WorkOfferReason,
          | "work_offer_work_type_out_of_range"
          | "work_offer_region_out_of_range"
          | "work_offer_def_out_of_range"
          | "work_offer_urgency_out_of_range"
          | "work_offer_permission_out_of_range"
          | "work_offer_candidate_cap_invalid"
        >;
      } {
    const keyValidation = this.validateKey(query);

    if (!keyValidation.ok) {
      return keyValidation;
    }

    if (!isPositiveSafeInteger(query.candidateCap)) {
      return { ok: false, reason: "work_offer_candidate_cap_invalid" };
    }

    return { ok: true };
  }

  private validateSelection(
    options: WorkOfferSelectionOptions,
    candidateScratch: Uint32Array,
    selectedOfferIds: Uint32Array,
  ):
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly reason: Extract<
          WorkOfferReason,
          | "work_offer_work_type_out_of_range"
          | "work_offer_region_out_of_range"
          | "work_offer_def_out_of_range"
          | "work_offer_urgency_out_of_range"
          | "work_offer_permission_out_of_range"
          | "work_offer_candidate_cap_invalid"
          | "work_offer_selected_cap_invalid"
          | "work_offer_candidate_buffer_too_small"
          | "work_offer_selection_buffer_too_small"
        >;
      } {
    const queryValidation = this.validateQuery(options);

    if (!queryValidation.ok) {
      return queryValidation;
    }

    if (!isPositiveSafeInteger(options.maxSelectedOffers)) {
      return { ok: false, reason: "work_offer_selected_cap_invalid" };
    }

    if (candidateScratch.length < options.candidateCap) {
      return { ok: false, reason: "work_offer_candidate_buffer_too_small" };
    }

    if (selectedOfferIds.length < options.maxSelectedOffers) {
      return { ok: false, reason: "work_offer_selection_buffer_too_small" };
    }

    return { ok: true };
  }

  private validateMultiPawnSelection(
    options: WorkOfferMultiPawnSelectionOptions,
    scratch: WorkOfferMultiPawnSelectionScratch,
    output: WorkOfferMultiPawnSelectionOutput,
  ):
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly reason: Extract<
          WorkOfferReason,
          | "work_offer_pawn_count_invalid"
          | "work_offer_work_type_out_of_range"
          | "work_offer_region_out_of_range"
          | "work_offer_def_out_of_range"
          | "work_offer_urgency_out_of_range"
          | "work_offer_permission_out_of_range"
          | "work_offer_candidate_cap_invalid"
          | "work_offer_selected_cap_invalid"
          | "work_offer_candidate_buffer_too_small"
          | "work_offer_pawn_query_buffer_too_small"
          | "work_offer_selection_buffer_too_small"
          | "work_offer_multi_output_buffer_too_small"
        >;
      } {
    if (!isPositiveSafeInteger(options.pawnCount)) {
      return { ok: false, reason: "work_offer_pawn_count_invalid" };
    }

    if (!isPositiveSafeInteger(options.candidateCap)) {
      return { ok: false, reason: "work_offer_candidate_cap_invalid" };
    }

    if (!isPositiveSafeInteger(options.maxSelectedOffers)) {
      return { ok: false, reason: "work_offer_selected_cap_invalid" };
    }

    if (scratch.candidateOfferIds.length < options.candidateCap) {
      return { ok: false, reason: "work_offer_candidate_buffer_too_small" };
    }

    if (
      scratch.selectedOfferIds.length < options.maxSelectedOffers ||
      scratch.selectedScoresMilli.length < options.maxSelectedOffers
    ) {
      return { ok: false, reason: "work_offer_selection_buffer_too_small" };
    }

    if (
      options.pawnIds.length < options.pawnCount ||
      options.workTypes.length < options.pawnCount ||
      options.regionIds.length < options.pawnCount ||
      options.defIds.length < options.pawnCount ||
      options.urgencyBuckets.length < options.pawnCount ||
      options.permissionIds.length < options.pawnCount
    ) {
      return { ok: false, reason: "work_offer_pawn_query_buffer_too_small" };
    }

    const selectedOutputCapacity = options.pawnCount * options.maxSelectedOffers;
    if (
      output.selectedOfferIds.length < selectedOutputCapacity ||
      output.selectedScoresMilli.length < selectedOutputCapacity ||
      output.selectedCounts.length < options.pawnCount ||
      output.bucketCandidateCounts.length < options.pawnCount ||
      output.visitedCounts.length < options.pawnCount ||
      output.scoredCounts.length < options.pawnCount ||
      output.rejectedByCandidateCaps.length < options.pawnCount ||
      output.rejectedBySelectedCaps.length < options.pawnCount ||
      output.traceSequences.length < options.pawnCount
    ) {
      return { ok: false, reason: "work_offer_multi_output_buffer_too_small" };
    }

    for (let pawnOffset = 0; pawnOffset < options.pawnCount; pawnOffset += 1) {
      const keyValidation = this.validateKeyValues(
        options.workTypes[pawnOffset] ?? WORK_OFFER_NONE,
        options.regionIds[pawnOffset] ?? WORK_OFFER_NONE,
        options.defIds[pawnOffset] ?? WORK_OFFER_NONE,
        options.urgencyBuckets[pawnOffset] ?? WORK_OFFER_NONE,
        options.permissionIds[pawnOffset] ?? WORK_OFFER_NONE,
      );

      if (!keyValidation.ok) {
        return keyValidation;
      }
    }

    return { ok: true };
  }

  private selectTopOffersForValues(
    pawnId: number,
    workType: number,
    regionId: number,
    defId: number,
    urgencyBucket: number,
    permissionId: number,
    candidateCap: number,
    maxSelectedOffers: number,
    candidateScratch: Uint32Array,
    selectedOfferIds: Uint32Array,
    selectedScoresMilli: Int32Array,
    traceStore: ReasonTraceStore | undefined,
  ): WorkOfferSelectionResult {
    const queried = this.queryCandidatesForValues(
      workType,
      regionId,
      defId,
      urgencyBucket,
      permissionId,
      candidateCap,
      candidateScratch,
    );

    if (!queried.ok) {
      return queried;
    }

    let selectedCount = 0;

    for (let index = 0; index < queried.count; index += 1) {
      const offerId = candidateScratch[index] ?? WORK_OFFER_NONE;

      if (offerId !== WORK_OFFER_NONE) {
        selectedCount = insertTopOffer(
          selectedOfferIds,
          selectedScoresMilli,
          selectedCount,
          maxSelectedOffers,
          offerId,
          this.scoresMilli[offerId] ?? 0,
        );
      }
    }

    const rejectedByCandidateCap =
      queried.bucketCandidateCount > queried.visitedCount
        ? queried.bucketCandidateCount - queried.visitedCount
        : 0;
    const rejectedBySelectedCap = queried.count > selectedCount ? queried.count - selectedCount : 0;
    const selectedOfferId =
      selectedCount > 0 ? (selectedOfferIds[0] ?? WORK_OFFER_NONE) : WORK_OFFER_NONE;
    const selectedScoreMilli = selectedCount > 0 ? (selectedScoresMilli[0] ?? 0) : 0;
    const rejectionMask = createRejectionMask(
      queried.bucketCandidateCount,
      rejectedByCandidateCap,
      rejectedBySelectedCap,
    );
    const traceSequence =
      traceStore?.recordWorkOfferSelection({
        pawnId,
        workType,
        regionId,
        defId,
        urgencyBucket,
        permissionId,
        bucketCandidateCount: queried.bucketCandidateCount,
        visitedCount: queried.visitedCount,
        scoredCount: queried.count,
        candidateCap,
        selectedCap: maxSelectedOffers,
        selectedOfferId,
        selectedScoreMilli,
        rejectedByCandidateCap,
        rejectedBySelectedCap,
        rejectionMask,
        reason: readTraceReason(rejectionMask),
      }) ?? 0;

    return {
      ok: true,
      selectedCount,
      bucketCandidateCount: queried.bucketCandidateCount,
      visitedCount: queried.visitedCount,
      scoredCount: queried.count,
      rejectedByCandidateCap,
      rejectedBySelectedCap,
      traceSequence,
    };
  }

  private queryCandidatesForValues(
    workType: number,
    regionId: number,
    defId: number,
    urgencyBucket: number,
    permissionId: number,
    candidateCap: number,
    outputOfferIds: Uint32Array,
  ): WorkOfferQueryResult {
    const key = createCompositeKey(workType, regionId, defId, urgencyBucket, permissionId, this);
    const bucketCandidateCount = this.bucketCounts[key] ?? 0;
    const outputLimit = Math.min(outputOfferIds.length, candidateCap);
    let current = this.bucketHeads[key] ?? -1;
    let count = 0;
    let visitedCount = 0;

    while (current >= 0 && visitedCount < candidateCap) {
      if (count < outputLimit) {
        outputOfferIds[count] = current;
        count += 1;
      }

      visitedCount += 1;
      current = this.nextOffer[current] ?? -1;

      if (count >= outputLimit) {
        break;
      }
    }

    return {
      ok: true,
      count,
      bucketCandidateCount,
      visitedCount,
      candidateCapHit: bucketCandidateCount > visitedCount,
      outputTruncated: bucketCandidateCount > count,
    };
  }

  private validateKey(key: Omit<WorkOfferQuery, "candidateCap">):
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly reason: Extract<
          WorkOfferReason,
          | "work_offer_work_type_out_of_range"
          | "work_offer_region_out_of_range"
          | "work_offer_def_out_of_range"
          | "work_offer_urgency_out_of_range"
          | "work_offer_permission_out_of_range"
        >;
      } {
    return this.validateKeyValues(
      key.workType,
      key.regionId,
      key.defId,
      key.urgencyBucket,
      key.permissionId,
    );
  }

  private validateKeyValues(
    workType: number,
    regionId: number,
    defId: number,
    urgencyBucket: number,
    permissionId: number,
  ):
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly reason: Extract<
          WorkOfferReason,
          | "work_offer_work_type_out_of_range"
          | "work_offer_region_out_of_range"
          | "work_offer_def_out_of_range"
          | "work_offer_urgency_out_of_range"
          | "work_offer_permission_out_of_range"
        >;
      } {
    if (!isIndexInRange(workType, this.workTypeCapacity)) {
      return { ok: false, reason: "work_offer_work_type_out_of_range" };
    }

    if (!isIndexInRange(regionId, this.regionCapacity)) {
      return { ok: false, reason: "work_offer_region_out_of_range" };
    }

    if (!isIndexInRange(defId, this.defCapacity)) {
      return { ok: false, reason: "work_offer_def_out_of_range" };
    }

    if (!isIndexInRange(urgencyBucket, this.urgencyBucketCount)) {
      return { ok: false, reason: "work_offer_urgency_out_of_range" };
    }

    if (!isIndexInRange(permissionId, this.permissionCapacity)) {
      return { ok: false, reason: "work_offer_permission_out_of_range" };
    }

    return { ok: true };
  }
}

export function selectPathResolvedWorkOffer(
  index: WorkOfferIndex,
  grid: MapGrid,
  pathfinder: GridPathfinder,
  options: WorkOfferPathSelectionOptions,
  scratch: WorkOfferPathSelectionScratch,
  traceStore?: ReasonTraceStore,
): WorkOfferPathSelectionResult {
  const validation = validatePathSelection(options, scratch);

  if (!validation.ok) {
    return validation;
  }

  const selected = index.selectTopOffers(
    options,
    scratch.candidateOfferIds,
    scratch.selectedOfferIds,
    scratch.selectedScoresMilli,
    traceStore,
  );

  if (!selected.ok) {
    return selected;
  }

  let selectedReason: WorkOfferPathSelectionReason =
    selected.selectedCount === 0 ? "work_path_no_indexed_candidate" : "work_path_selection_failed";
  let regionRejectedCount = 0;
  let invalidRejectedCount = 0;
  let blockedRejectedCount = 0;
  let noRouteRejectedCount = 0;
  let nodeBudgetRejectedCount = 0;
  let staleRejectedCount = 0;
  let exactPathCount = 0;
  let reachableCount = 0;
  let nodeExpansions = 0;

  for (let indexOffset = 0; indexOffset < selected.selectedCount; indexOffset += 1) {
    const offerId = scratch.selectedOfferIds[indexOffset] ?? WORK_OFFER_NONE;

    if (offerId === WORK_OFFER_NONE) {
      invalidRejectedCount += 1;
      selectedReason = firstFailureReason(selectedReason, "work_path_invalid_candidate");
      continue;
    }

    const offer = index.readOffer(offerId);

    if (offer === undefined) {
      invalidRejectedCount += 1;
      selectedReason = firstFailureReason(selectedReason, "work_path_invalid_candidate");
      continue;
    }

    const targetCell = grid.readCellByIndex(offer.targetCellIndex);

    if (!targetCell.ok) {
      invalidRejectedCount += 1;
      selectedReason = firstFailureReason(selectedReason, "work_path_invalid_candidate");
      continue;
    }

    const passable = grid.isCellPassableByIndex(offer.targetCellIndex);

    if (!passable.ok) {
      invalidRejectedCount += 1;
      selectedReason = firstFailureReason(selectedReason, "work_path_invalid_candidate");
      continue;
    }

    if (!passable.passable) {
      blockedRejectedCount += 1;
      selectedReason = firstFailureReason(selectedReason, "work_path_blocked");
      continue;
    }

    if (targetCell.cell.regionId !== options.originRegionId) {
      regionRejectedCount += 1;
      selectedReason = firstFailureReason(selectedReason, "work_path_region_unreachable");
      continue;
    }

    reachableCount += 1;

    if (exactPathCount >= options.maxExactPaths) {
      selectedReason = firstFailureReason(selectedReason, "work_path_exact_topk_cap");
      continue;
    }

    const request = createPathRequestForOffer(options, offer, exactPathCount);
    const path = pathfinder.findPath(grid, request);
    exactPathCount += 1;
    nodeExpansions += path.nodeExpansions;

    if (!samePathBasis(path.basis, options.currentBasis)) {
      staleRejectedCount += 1;
      selectedReason = firstFailureReason(selectedReason, "work_path_version_basis_stale");
      continue;
    }

    if (path.ok) {
      return {
        ok: true,
        reason: "work_path_selected",
        selectedOfferId: offer.offerId,
        selectedTargetCellIndex: offer.targetCellIndex,
        selectedPath: path,
        bucketCandidateCount: selected.bucketCandidateCount,
        visitedCount: selected.visitedCount,
        scoredCount: selected.scoredCount,
        selectedCount: selected.selectedCount,
        rejectedByCandidateCap: selected.rejectedByCandidateCap,
        regionRejectedCount,
        invalidRejectedCount,
        blockedRejectedCount,
        noRouteRejectedCount,
        nodeBudgetRejectedCount,
        staleRejectedCount,
        exactPathCount,
        exactPathCapHit: selected.selectedCount > options.maxExactPaths,
        nodeExpansions,
        traceSequence: selected.traceSequence,
      };
    }

    const pathReason = mapPathReasonToWorkReason(path.reason);
    selectedReason = firstFailureReason(selectedReason, pathReason);

    if (pathReason === "work_path_blocked") {
      blockedRejectedCount += 1;
    } else if (pathReason === "work_path_no_route") {
      noRouteRejectedCount += 1;
    } else if (pathReason === "work_path_node_budget_exhausted") {
      nodeBudgetRejectedCount += 1;
    } else {
      invalidRejectedCount += 1;
    }
  }

  return {
    ok: true,
    reason: selectedReason,
    selectedOfferId: WORK_OFFER_NONE,
    selectedTargetCellIndex: WORK_OFFER_NONE,
    selectedPath: undefined,
    bucketCandidateCount: selected.bucketCandidateCount,
    visitedCount: selected.visitedCount,
    scoredCount: selected.scoredCount,
    selectedCount: selected.selectedCount,
    rejectedByCandidateCap: selected.rejectedByCandidateCap,
    regionRejectedCount,
    invalidRejectedCount,
    blockedRejectedCount,
    noRouteRejectedCount,
    nodeBudgetRejectedCount,
    staleRejectedCount,
    exactPathCount,
    exactPathCapHit: reachableCount > options.maxExactPaths,
    nodeExpansions,
    traceSequence: selected.traceSequence,
  };
}

export class ReasonTraceStore {
  readonly capacity: number;

  private readonly sequences: Uint32Array;
  private readonly pawnIds: Uint32Array;
  private readonly workTypes: Uint32Array;
  private readonly regionIds: Uint32Array;
  private readonly defIds: Uint32Array;
  private readonly urgencyBuckets: Uint32Array;
  private readonly permissionIds: Uint32Array;
  private readonly bucketCandidateCounts: Uint32Array;
  private readonly visitedCounts: Uint32Array;
  private readonly scoredCounts: Uint32Array;
  private readonly candidateCaps: Uint32Array;
  private readonly selectedCaps: Uint32Array;
  private readonly selectedOfferIds: Uint32Array;
  private readonly selectedScoresMilli: Int32Array;
  private readonly rejectedByCandidateCaps: Uint32Array;
  private readonly rejectedBySelectedCaps: Uint32Array;
  private readonly rejectionMasks: Uint8Array;
  private readonly reasonCodes: Uint8Array;
  private writeCursor = 0;
  private stored = 0;
  private nextSequence = 1;

  constructor(capacity: number) {
    if (!isPositiveSafeInteger(capacity)) {
      throw new Error("work offer trace capacity must be a positive safe integer");
    }

    this.capacity = capacity;
    this.sequences = new Uint32Array(capacity);
    this.pawnIds = new Uint32Array(capacity);
    this.workTypes = new Uint32Array(capacity);
    this.regionIds = new Uint32Array(capacity);
    this.defIds = new Uint32Array(capacity);
    this.urgencyBuckets = new Uint32Array(capacity);
    this.permissionIds = new Uint32Array(capacity);
    this.bucketCandidateCounts = new Uint32Array(capacity);
    this.visitedCounts = new Uint32Array(capacity);
    this.scoredCounts = new Uint32Array(capacity);
    this.candidateCaps = new Uint32Array(capacity);
    this.selectedCaps = new Uint32Array(capacity);
    this.selectedOfferIds = new Uint32Array(capacity);
    this.selectedOfferIds.fill(WORK_OFFER_NONE);
    this.selectedScoresMilli = new Int32Array(capacity);
    this.rejectedByCandidateCaps = new Uint32Array(capacity);
    this.rejectedBySelectedCaps = new Uint32Array(capacity);
    this.rejectionMasks = new Uint8Array(capacity);
    this.reasonCodes = new Uint8Array(capacity);
  }

  get storedCount(): number {
    return this.stored;
  }

  recordWorkOfferSelection(input: WorkOfferReasonTraceInput): number {
    const slot = this.writeCursor;
    const sequence = this.nextSequence;

    this.sequences[slot] = sequence;
    this.pawnIds[slot] = input.pawnId;
    this.workTypes[slot] = input.workType;
    this.regionIds[slot] = input.regionId;
    this.defIds[slot] = input.defId;
    this.urgencyBuckets[slot] = input.urgencyBucket;
    this.permissionIds[slot] = input.permissionId;
    this.bucketCandidateCounts[slot] = input.bucketCandidateCount;
    this.visitedCounts[slot] = input.visitedCount;
    this.scoredCounts[slot] = input.scoredCount;
    this.candidateCaps[slot] = input.candidateCap;
    this.selectedCaps[slot] = input.selectedCap;
    this.selectedOfferIds[slot] = input.selectedOfferId;
    this.selectedScoresMilli[slot] = input.selectedScoreMilli;
    this.rejectedByCandidateCaps[slot] = input.rejectedByCandidateCap;
    this.rejectedBySelectedCaps[slot] = input.rejectedBySelectedCap;
    this.rejectionMasks[slot] = input.rejectionMask;
    this.reasonCodes[slot] = encodeTraceReason(input.reason);
    this.writeCursor = (this.writeCursor + 1) % this.capacity;
    this.stored = Math.min(this.capacity, this.stored + 1);
    this.nextSequence += 1;
    return sequence;
  }

  readNewest(ageFromNewest: number): WorkOfferReasonTraceView | undefined {
    if (!isIndexInRange(ageFromNewest, this.stored)) {
      return undefined;
    }

    const slot = (this.writeCursor + this.capacity - 1 - ageFromNewest) % this.capacity;
    return {
      sequence: this.sequences[slot] ?? 0,
      pawnId: this.pawnIds[slot] ?? 0,
      workType: this.workTypes[slot] ?? 0,
      regionId: this.regionIds[slot] ?? 0,
      defId: this.defIds[slot] ?? 0,
      urgencyBucket: this.urgencyBuckets[slot] ?? 0,
      permissionId: this.permissionIds[slot] ?? 0,
      bucketCandidateCount: this.bucketCandidateCounts[slot] ?? 0,
      visitedCount: this.visitedCounts[slot] ?? 0,
      scoredCount: this.scoredCounts[slot] ?? 0,
      candidateCap: this.candidateCaps[slot] ?? 0,
      selectedCap: this.selectedCaps[slot] ?? 0,
      selectedOfferId: this.selectedOfferIds[slot] ?? WORK_OFFER_NONE,
      selectedScoreMilli: this.selectedScoresMilli[slot] ?? 0,
      rejectedByCandidateCap: this.rejectedByCandidateCaps[slot] ?? 0,
      rejectedBySelectedCap: this.rejectedBySelectedCaps[slot] ?? 0,
      rejectionMask: this.rejectionMasks[slot] ?? 0,
      reason: decodeTraceReason(this.reasonCodes[slot] ?? 0),
    };
  }

  createMetrics(): ReasonTraceStoreMetrics {
    return {
      capacity: this.capacity,
      storedCount: this.stored,
      nextSequence: this.nextSequence,
      backlogCount: 0,
    };
  }
}

export function createWorkOfferIndex(options: WorkOfferIndexOptions): WorkOfferIndex {
  return new WorkOfferIndex(options);
}

export function createReasonTraceStore(capacity: number): ReasonTraceStore {
  return new ReasonTraceStore(capacity);
}

function validatePathSelection(
  options: WorkOfferPathSelectionOptions,
  scratch: WorkOfferPathSelectionScratch,
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: Extract<
        WorkOfferReason,
        | "work_offer_candidate_cap_invalid"
        | "work_offer_selected_cap_invalid"
        | "work_offer_candidate_buffer_too_small"
        | "work_offer_selection_buffer_too_small"
        | "work_offer_trace_capacity_invalid"
      >;
    } {
  if (!isPositiveSafeInteger(options.maxExactPaths)) {
    return { ok: false, reason: "work_offer_trace_capacity_invalid" };
  }

  if (scratch.candidateOfferIds.length < options.candidateCap) {
    return { ok: false, reason: "work_offer_candidate_buffer_too_small" };
  }

  if (
    scratch.selectedOfferIds.length < options.maxSelectedOffers ||
    scratch.selectedScoresMilli.length < options.maxSelectedOffers
  ) {
    return { ok: false, reason: "work_offer_selection_buffer_too_small" };
  }

  return { ok: true };
}

function createPathRequestForOffer(
  options: WorkOfferPathSelectionOptions,
  offer: WorkOfferInput,
  exactPathOffset: number,
): PathRequest {
  const request = {
    requestSequence: options.requestSequenceStart + exactPathOffset,
    issuedTick: options.issuedTick,
    startCellIndex: options.originCellIndex,
    goalCellIndex: offer.targetCellIndex,
    basis: options.basis,
  };

  if (options.maxNodeExpansions === undefined) {
    return request;
  }

  return {
    ...request,
    maxNodeExpansions: options.maxNodeExpansions,
  };
}

function mapPathReasonToWorkReason(reason: PathReason): WorkOfferPathSelectionReason {
  if (reason === "path_stale_result") {
    return "work_path_version_basis_stale";
  }

  if (reason === "path_start_blocked" || reason === "path_goal_blocked") {
    return "work_path_blocked";
  }

  if (reason === "path_no_route") {
    return "work_path_no_route";
  }

  if (reason === "path_node_budget_exhausted") {
    return "work_path_node_budget_exhausted";
  }

  return "work_path_invalid_candidate";
}

function firstFailureReason(
  current: WorkOfferPathSelectionReason,
  next: WorkOfferPathSelectionReason,
): WorkOfferPathSelectionReason {
  if (current === "work_path_selection_failed") {
    return next;
  }

  if (current === "work_path_no_indexed_candidate") {
    return next;
  }

  if (current === "work_path_exact_topk_cap" && next !== "work_path_exact_topk_cap") {
    return next;
  }

  return current;
}

function createEmptyLinks(length: number): Int32Array {
  const links = new Int32Array(length);
  links.fill(-1);
  return links;
}

function insertSorted(
  heads: Int32Array,
  next: Int32Array,
  previous: Int32Array,
  bucket: number,
  offerId: number,
): void {
  let current = heads[bucket] ?? -1;
  let before = -1;

  while (current >= 0 && current < offerId) {
    before = current;
    current = next[current] ?? -1;
  }

  previous[offerId] = before;
  next[offerId] = current;

  if (before < 0) {
    heads[bucket] = offerId;
  } else {
    next[before] = offerId;
  }

  if (current >= 0) {
    previous[current] = offerId;
  }
}

function removeLinked(
  heads: Int32Array,
  next: Int32Array,
  previous: Int32Array,
  bucket: number,
  offerId: number,
): void {
  const before = previous[offerId] ?? -1;
  const after = next[offerId] ?? -1;

  if (before < 0) {
    heads[bucket] = after;
  } else {
    next[before] = after;
  }

  if (after >= 0) {
    previous[after] = before;
  }

  previous[offerId] = -1;
  next[offerId] = -1;
}

function insertTopOffer(
  selectedOfferIds: Uint32Array,
  selectedScoresMilli: Int32Array,
  selectedCount: number,
  maxSelectedOffers: number,
  offerId: number,
  scoreMilli: number,
): number {
  let insertIndex = selectedCount;

  for (let index = 0; index < selectedCount; index += 1) {
    const currentId = selectedOfferIds[index] ?? WORK_OFFER_NONE;
    const currentScore = selectedScoresMilli[index] ?? 0;

    if (isBetterOffer(offerId, scoreMilli, currentId, currentScore)) {
      insertIndex = index;
      break;
    }
  }

  if (insertIndex >= maxSelectedOffers) {
    return selectedCount;
  }

  const limit = Math.min(selectedCount, maxSelectedOffers - 1);
  for (let index = limit; index > insertIndex; index -= 1) {
    selectedOfferIds[index] = selectedOfferIds[index - 1] ?? WORK_OFFER_NONE;
    selectedScoresMilli[index] = selectedScoresMilli[index - 1] ?? 0;
  }

  selectedOfferIds[insertIndex] = offerId;
  selectedScoresMilli[insertIndex] = scoreMilli;
  return selectedCount < maxSelectedOffers ? selectedCount + 1 : selectedCount;
}

function clearSelection(
  selectedOfferIds: Uint32Array,
  selectedScoresMilli: Int32Array,
  maxSelectedOffers: number,
): void {
  for (let index = 0; index < maxSelectedOffers; index += 1) {
    selectedOfferIds[index] = WORK_OFFER_NONE;
    selectedScoresMilli[index] = 0;
  }
}

function clearMultiPawnOutput(
  output: WorkOfferMultiPawnSelectionOutput,
  pawnCount: number,
  maxSelectedOffers: number,
): void {
  const selectedCapacity = pawnCount * maxSelectedOffers;

  for (let index = 0; index < selectedCapacity; index += 1) {
    output.selectedOfferIds[index] = WORK_OFFER_NONE;
    output.selectedScoresMilli[index] = 0;
  }

  for (let index = 0; index < pawnCount; index += 1) {
    output.selectedCounts[index] = 0;
    output.bucketCandidateCounts[index] = 0;
    output.visitedCounts[index] = 0;
    output.scoredCounts[index] = 0;
    output.rejectedByCandidateCaps[index] = 0;
    output.rejectedBySelectedCaps[index] = 0;
    output.traceSequences[index] = 0;
  }
}

function isBetterOffer(
  offerId: number,
  scoreMilli: number,
  currentId: number,
  currentScoreMilli: number,
): boolean {
  if (currentId === WORK_OFFER_NONE) {
    return true;
  }

  if (scoreMilli !== currentScoreMilli) {
    return scoreMilli > currentScoreMilli;
  }

  return offerId < currentId;
}

const WORK_OFFER_REJECTION_CANDIDATE_CAP_MASK = 1;
const WORK_OFFER_REJECTION_SELECTED_CAP_MASK = 2;
const WORK_OFFER_REJECTION_NO_CANDIDATE_MASK = 4;

function createRejectionMask(
  bucketCandidateCount: number,
  rejectedByCandidateCap: number,
  rejectedBySelectedCap: number,
): number {
  let mask = 0;

  if (bucketCandidateCount === 0) {
    mask |= WORK_OFFER_REJECTION_NO_CANDIDATE_MASK;
  }

  if (rejectedByCandidateCap > 0) {
    mask |= WORK_OFFER_REJECTION_CANDIDATE_CAP_MASK;
  }

  if (rejectedBySelectedCap > 0) {
    mask |= WORK_OFFER_REJECTION_SELECTED_CAP_MASK;
  }

  return mask;
}

function readTraceReason(rejectionMask: number): WorkOfferTraceReason {
  if ((rejectionMask & WORK_OFFER_REJECTION_NO_CANDIDATE_MASK) !== 0) {
    return "work_offer_no_candidate";
  }

  if ((rejectionMask & WORK_OFFER_REJECTION_CANDIDATE_CAP_MASK) !== 0) {
    return "work_offer_candidate_cap";
  }

  if ((rejectionMask & WORK_OFFER_REJECTION_SELECTED_CAP_MASK) !== 0) {
    return "work_offer_selected_cap";
  }

  return "work_offer_trace_none";
}

function encodeTraceReason(reason: WorkOfferTraceReason): number {
  if (reason === "work_offer_candidate_cap") {
    return 1;
  }

  if (reason === "work_offer_no_candidate") {
    return 2;
  }

  if (reason === "work_offer_selected_cap") {
    return 3;
  }

  return 0;
}

function decodeTraceReason(code: number): WorkOfferTraceReason {
  if (code === 1) {
    return "work_offer_candidate_cap";
  }

  if (code === 2) {
    return "work_offer_no_candidate";
  }

  if (code === 3) {
    return "work_offer_selected_cap";
  }

  return "work_offer_trace_none";
}

function createCompositeKey(
  workType: number,
  regionId: number,
  defId: number,
  urgencyBucket: number,
  permissionId: number,
  dimensions: {
    readonly regionCapacity: number;
    readonly defCapacity: number;
    readonly urgencyBucketCount: number;
    readonly permissionCapacity: number;
  },
): number {
  return (
    (((workType * dimensions.regionCapacity + regionId) * dimensions.defCapacity + defId) *
      dimensions.urgencyBucketCount +
      urgencyBucket) *
      dimensions.permissionCapacity +
    permissionId
  );
}

function requireCompositeBucketCount(options: WorkOfferIndexOptions): number {
  const bucketCount =
    options.workTypeCapacity *
    options.regionCapacity *
    options.defCapacity *
    options.urgencyBucketCount *
    options.permissionCapacity;

  if (!Number.isSafeInteger(bucketCount) || bucketCount <= 0) {
    throw new Error("work offer composite bucket count must be a positive safe integer");
  }

  return bucketCount;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isInt32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= -0x8000_0000 && value <= 0x7fff_ffff;
}
