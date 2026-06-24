import { performance } from "node:perf_hooks";

import { createReasonTraceStore, createWorkOfferIndex, mixUint32 } from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

export interface WorkOffersBenchmarkReport {
  readonly name: "work-offers";
  readonly pawnCount: number;
  readonly offerCount: number;
  readonly offersPerPawnBucket: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly allEntityScanEquivalent: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly scoredCandidates: number;
  readonly selectedOffers: number;
  readonly candidateCapHits: number;
  readonly traceCapacity: number;
  readonly storedTraceCount: number;
  readonly indexActiveOffers: number;
  readonly selectionChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface WorkOffersBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly pawnCount: number;
  readonly offerCount: number;
  readonly offersPerPawnBucket: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly allEntityScanEquivalent: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly scoredCandidates: number;
  readonly selectedOffers: number;
  readonly candidateCapHits: number;
  readonly traceCapacity: number;
  readonly storedTraceCount: number;
  readonly indexActiveOffers: number;
  readonly selectionChecksum: number;
}

export interface SampledWorkOffersBenchmark {
  readonly name: "work-offers";
  readonly report: WorkOffersBenchmarkReport;
  readonly invariants: WorkOffersBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runWorkOffersBenchmark(): WorkOffersBenchmarkReport {
  const pawnCount = 100;
  const offersPerPawnBucket = 100;
  const offerCount = pawnCount * offersPerPawnBucket;
  const candidateCap = 8;
  const selectedCap = 3;
  const traceCapacity = 16;
  const index = createWorkOfferIndex({
    capacity: offerCount,
    workTypeCapacity: 8,
    regionCapacity: 128,
    defCapacity: 16,
    urgencyBucketCount: 8,
    permissionCapacity: 8,
  });
  const traces = createReasonTraceStore(traceCapacity);
  const candidateScratch = new Uint32Array(candidateCap);
  const selectedOfferIds = new Uint32Array(selectedCap);
  const selectedScores = new Int32Array(selectedCap);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  for (let pawnId = 0; pawnId < pawnCount; pawnId += 1) {
    for (let offset = 0; offset < offersPerPawnBucket; offset += 1) {
      const offerId = pawnId * offersPerPawnBucket + offset;
      const registered = index.registerOffer({
        offerId,
        workType: workTypeForPawn(pawnId),
        regionId: regionForPawn(pawnId),
        defId: defForPawn(pawnId),
        urgencyBucket: urgencyForPawn(pawnId),
        permissionId: permissionForPawn(pawnId),
        targetId: offerId,
        targetCellIndex: (offerId * 17) % 16_384,
        scoreMilli: scoreForOffer(pawnId, offset),
      });

      if (!registered.ok) {
        throw new Error(registered.reason);
      }
    }
  }

  let totalBucketCandidates = 0;
  let visitedCandidates = 0;
  let scoredCandidates = 0;
  let selectedOffers = 0;
  let candidateCapHits = 0;
  let selectionChecksum = 0;

  for (let pawnId = 0; pawnId < pawnCount; pawnId += 1) {
    const selected = index.selectTopOffers(
      {
        pawnId,
        workType: workTypeForPawn(pawnId),
        regionId: regionForPawn(pawnId),
        defId: defForPawn(pawnId),
        urgencyBucket: urgencyForPawn(pawnId),
        permissionId: permissionForPawn(pawnId),
        candidateCap,
        maxSelectedOffers: selectedCap,
      },
      candidateScratch,
      selectedOfferIds,
      selectedScores,
      traces,
    );

    if (!selected.ok) {
      throw new Error(selected.reason);
    }

    totalBucketCandidates += selected.bucketCandidateCount;
    visitedCandidates += selected.visitedCount;
    scoredCandidates += selected.scoredCount;
    selectedOffers += selected.selectedCount;

    if (selected.rejectedByCandidateCap > 0) {
      candidateCapHits += 1;
    }

    selectionChecksum = mixUint32(selectionChecksum, selected.traceSequence);
    selectionChecksum = mixUint32(selectionChecksum, selected.selectedCount);
    selectionChecksum = mixUint32(selectionChecksum, selectedOfferIds[0] ?? 0);
    selectionChecksum = mixUint32(selectionChecksum, selectedScores[0] ?? 0);
  }

  const indexMetrics = index.createMetrics();
  const traceMetrics = traces.createMetrics();
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "work-offers",
    pawnCount,
    offerCount,
    offersPerPawnBucket,
    candidateCap,
    selectedCap,
    allEntityScanEquivalent: pawnCount * offerCount,
    totalBucketCandidates,
    visitedCandidates,
    scoredCandidates,
    selectedOffers,
    candidateCapHits,
    traceCapacity,
    storedTraceCount: traceMetrics.storedCount,
    indexActiveOffers: indexMetrics.activeOfferCount,
    selectionChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function workOffersInvariantsFromReport(
  report: WorkOffersBenchmarkReport,
): WorkOffersBenchmarkInvariants {
  return {
    pawnCount: report.pawnCount,
    offerCount: report.offerCount,
    offersPerPawnBucket: report.offersPerPawnBucket,
    candidateCap: report.candidateCap,
    selectedCap: report.selectedCap,
    allEntityScanEquivalent: report.allEntityScanEquivalent,
    totalBucketCandidates: report.totalBucketCandidates,
    visitedCandidates: report.visitedCandidates,
    scoredCandidates: report.scoredCandidates,
    selectedOffers: report.selectedOffers,
    candidateCapHits: report.candidateCapHits,
    traceCapacity: report.traceCapacity,
    storedTraceCount: report.storedTraceCount,
    indexActiveOffers: report.indexActiveOffers,
    selectionChecksum: report.selectionChecksum,
  };
}

function workTypeForPawn(pawnId: number): number {
  return pawnId % 4;
}

function regionForPawn(pawnId: number): number {
  return pawnId;
}

function defForPawn(pawnId: number): number {
  return pawnId % 10;
}

function urgencyForPawn(pawnId: number): number {
  return pawnId % 5;
}

function permissionForPawn(pawnId: number): number {
  return pawnId % 3;
}

function scoreForOffer(pawnId: number, offset: number): number {
  return 1_000 + ((pawnId * 97 + offset * 53) % 9_000);
}
