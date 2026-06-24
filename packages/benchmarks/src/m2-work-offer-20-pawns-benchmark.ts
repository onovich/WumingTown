import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

import {
  WORK_OFFER_NONE,
  createReasonTraceStore,
  createWorkOfferIndex,
  mixUint32,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

export interface M2WorkOffer20PawnsBenchmarkReport {
  readonly name: "m2-work-offer-20-pawns";
  readonly pawnCount: number;
  readonly offerCount: number;
  readonly offersPerPawnBucket: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly traceCapacity: number;
  readonly allEntityScanEquivalent: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly scoredCandidates: number;
  readonly selectedOffers: number;
  readonly candidateCapHits: number;
  readonly selectedCapHits: number;
  readonly rejectedByCandidateCap: number;
  readonly rejectedBySelectedCap: number;
  readonly storedTraceCount: number;
  readonly newestTraceSequence: number;
  readonly equivalentScoreStable: boolean;
  readonly indexActiveOffers: number;
  readonly selectionChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M2WorkOffer20PawnsBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly pawnCount: number;
  readonly offerCount: number;
  readonly offersPerPawnBucket: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly traceCapacity: number;
  readonly allEntityScanEquivalent: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly scoredCandidates: number;
  readonly selectedOffers: number;
  readonly candidateCapHits: number;
  readonly selectedCapHits: number;
  readonly rejectedByCandidateCap: number;
  readonly rejectedBySelectedCap: number;
  readonly storedTraceCount: number;
  readonly newestTraceSequence: number;
  readonly equivalentScoreStable: boolean;
  readonly indexActiveOffers: number;
  readonly selectionChecksum: number;
}

export interface SampledM2WorkOffer20PawnsBenchmark {
  readonly name: "m2-work-offer-20-pawns";
  readonly report: M2WorkOffer20PawnsBenchmarkReport;
  readonly invariants: M2WorkOffer20PawnsBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM2WorkOffer20PawnsBenchmark(): M2WorkOffer20PawnsBenchmarkReport {
  const pawnCount = 20;
  const offersPerPawnBucket = 30;
  const offerCount = pawnCount * offersPerPawnBucket;
  const candidateCap = 24;
  const selectedCap = 12;
  const traceCapacity = 64;
  const index = createWorkOfferIndex({
    capacity: offerCount,
    workTypeCapacity: 4,
    regionCapacity: 32,
    defCapacity: 8,
    urgencyBucketCount: 4,
    permissionCapacity: 8,
  });
  const traces = createReasonTraceStore(traceCapacity);
  const options = createM2SelectionOptions(pawnCount, candidateCap, selectedCap);
  const output = createM2SelectionOutput(pawnCount, selectedCap);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  registerM2Offers(index, pawnCount, offersPerPawnBucket);
  const selected = index.selectTopOffersForPawns(
    options,
    {
      candidateOfferIds: new Uint32Array(candidateCap),
      selectedOfferIds: new Uint32Array(selectedCap),
      selectedScoresMilli: new Int32Array(selectedCap),
    },
    output,
    traces,
  );

  if (!selected.ok) {
    throw new Error(selected.reason);
  }

  let selectionChecksum = 0;
  let equivalentScoreStable = true;

  for (let pawnId = 0; pawnId < pawnCount; pawnId += 1) {
    const outputOffset = pawnId * selectedCap;
    const expectedFirstOffer = pawnId * offersPerPawnBucket;
    const firstOffer = output.selectedOfferIds[outputOffset] ?? WORK_OFFER_NONE;
    const secondOffer = output.selectedOfferIds[outputOffset + 1] ?? WORK_OFFER_NONE;

    if (firstOffer !== expectedFirstOffer || secondOffer !== expectedFirstOffer + 1) {
      equivalentScoreStable = false;
    }

    selectionChecksum = mixUint32(selectionChecksum, output.selectedCounts[pawnId] ?? 0);
    selectionChecksum = mixUint32(selectionChecksum, output.bucketCandidateCounts[pawnId] ?? 0);
    selectionChecksum = mixUint32(selectionChecksum, output.visitedCounts[pawnId] ?? 0);
    selectionChecksum = mixUint32(selectionChecksum, firstOffer);
    selectionChecksum = mixUint32(selectionChecksum, output.selectedScoresMilli[outputOffset] ?? 0);
    selectionChecksum = mixUint32(selectionChecksum, output.traceSequences[pawnId] ?? 0);
  }

  const indexMetrics = index.createMetrics();
  const traceMetrics = traces.createMetrics();
  const newestTrace = traces.readNewest(0);
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "m2-work-offer-20-pawns",
    pawnCount,
    offerCount,
    offersPerPawnBucket,
    candidateCap,
    selectedCap,
    traceCapacity,
    allEntityScanEquivalent: pawnCount * offerCount,
    totalBucketCandidates: selected.totalBucketCandidateCount,
    visitedCandidates: selected.totalVisitedCount,
    scoredCandidates: selected.totalScoredCount,
    selectedOffers: selected.selectedOfferCount,
    candidateCapHits: selected.candidateCapHitCount,
    selectedCapHits: selected.selectedCapHitCount,
    rejectedByCandidateCap: selected.totalRejectedByCandidateCap,
    rejectedBySelectedCap: selected.totalRejectedBySelectedCap,
    storedTraceCount: traceMetrics.storedCount,
    newestTraceSequence: newestTrace?.sequence ?? 0,
    equivalentScoreStable,
    indexActiveOffers: indexMetrics.activeOfferCount,
    selectionChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m2WorkOffer20PawnsInvariantsFromReport(
  report: M2WorkOffer20PawnsBenchmarkReport,
): M2WorkOffer20PawnsBenchmarkInvariants {
  return {
    pawnCount: report.pawnCount,
    offerCount: report.offerCount,
    offersPerPawnBucket: report.offersPerPawnBucket,
    candidateCap: report.candidateCap,
    selectedCap: report.selectedCap,
    traceCapacity: report.traceCapacity,
    allEntityScanEquivalent: report.allEntityScanEquivalent,
    totalBucketCandidates: report.totalBucketCandidates,
    visitedCandidates: report.visitedCandidates,
    scoredCandidates: report.scoredCandidates,
    selectedOffers: report.selectedOffers,
    candidateCapHits: report.candidateCapHits,
    selectedCapHits: report.selectedCapHits,
    rejectedByCandidateCap: report.rejectedByCandidateCap,
    rejectedBySelectedCap: report.rejectedBySelectedCap,
    storedTraceCount: report.storedTraceCount,
    newestTraceSequence: report.newestTraceSequence,
    equivalentScoreStable: report.equivalentScoreStable,
    indexActiveOffers: report.indexActiveOffers,
    selectionChecksum: report.selectionChecksum,
  };
}

export function writeM2WorkOffer20PawnsBenchmarkArtifact(
  artifactPath = path.resolve(
    process.cwd(),
    "coordination",
    "artifacts",
    "WM-0036",
    "benchmarks",
    "m2-work-offer-20-pawns-results.json",
  ),
): M2WorkOffer20PawnsBenchmarkReport {
  const report = runM2WorkOffer20PawnsBenchmark();
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(
    artifactPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        artifactPath: path.relative(process.cwd(), artifactPath).replaceAll("\\", "/"),
        report,
        invariants: m2WorkOffer20PawnsInvariantsFromReport(report),
      },
      undefined,
      2,
    )}\n`,
    "utf8",
  );
  return report;
}

function registerM2Offers(
  index: ReturnType<typeof createWorkOfferIndex>,
  pawnCount: number,
  offersPerPawnBucket: number,
): void {
  for (let pawnId = pawnCount - 1; pawnId >= 0; pawnId -= 1) {
    for (let offset = offersPerPawnBucket - 1; offset >= 0; offset -= 1) {
      const offerId = pawnId * offersPerPawnBucket + offset;
      const registered = index.registerOffer({
        offerId,
        workType: workTypeForPawn(pawnId),
        regionId: regionForPawn(pawnId),
        defId: defForPawn(pawnId),
        urgencyBucket: urgencyForPawn(pawnId),
        permissionId: permissionForPawn(pawnId),
        targetId: 10_000 + offerId,
        targetCellIndex: (offerId * 37) % 16_384,
        scoreMilli: scoreForOffer(offset),
      });

      if (!registered.ok) {
        throw new Error(registered.reason);
      }
    }
  }
}

function createM2SelectionOptions(
  pawnCount: number,
  candidateCap: number,
  selectedCap: number,
): {
  readonly pawnCount: number;
  readonly pawnIds: Uint32Array;
  readonly workTypes: Uint32Array;
  readonly regionIds: Uint32Array;
  readonly defIds: Uint32Array;
  readonly urgencyBuckets: Uint32Array;
  readonly permissionIds: Uint32Array;
  readonly candidateCap: number;
  readonly maxSelectedOffers: number;
} {
  const pawnIds = new Uint32Array(pawnCount);
  const workTypes = new Uint32Array(pawnCount);
  const regionIds = new Uint32Array(pawnCount);
  const defIds = new Uint32Array(pawnCount);
  const urgencyBuckets = new Uint32Array(pawnCount);
  const permissionIds = new Uint32Array(pawnCount);

  for (let pawnId = 0; pawnId < pawnCount; pawnId += 1) {
    pawnIds[pawnId] = pawnId;
    workTypes[pawnId] = workTypeForPawn(pawnId);
    regionIds[pawnId] = regionForPawn(pawnId);
    defIds[pawnId] = defForPawn(pawnId);
    urgencyBuckets[pawnId] = urgencyForPawn(pawnId);
    permissionIds[pawnId] = permissionForPawn(pawnId);
  }

  return {
    pawnCount,
    pawnIds,
    workTypes,
    regionIds,
    defIds,
    urgencyBuckets,
    permissionIds,
    candidateCap,
    maxSelectedOffers: selectedCap,
  };
}

function createM2SelectionOutput(
  pawnCount: number,
  selectedCap: number,
): {
  readonly selectedOfferIds: Uint32Array;
  readonly selectedScoresMilli: Int32Array;
  readonly selectedCounts: Uint32Array;
  readonly bucketCandidateCounts: Uint32Array;
  readonly visitedCounts: Uint32Array;
  readonly scoredCounts: Uint32Array;
  readonly rejectedByCandidateCaps: Uint32Array;
  readonly rejectedBySelectedCaps: Uint32Array;
  readonly traceSequences: Uint32Array;
} {
  return {
    selectedOfferIds: new Uint32Array(pawnCount * selectedCap),
    selectedScoresMilli: new Int32Array(pawnCount * selectedCap),
    selectedCounts: new Uint32Array(pawnCount),
    bucketCandidateCounts: new Uint32Array(pawnCount),
    visitedCounts: new Uint32Array(pawnCount),
    scoredCounts: new Uint32Array(pawnCount),
    rejectedByCandidateCaps: new Uint32Array(pawnCount),
    rejectedBySelectedCaps: new Uint32Array(pawnCount),
    traceSequences: new Uint32Array(pawnCount),
  };
}

function workTypeForPawn(pawnId: number): number {
  return pawnId % 2;
}

function regionForPawn(pawnId: number): number {
  return pawnId;
}

function defForPawn(pawnId: number): number {
  return pawnId % 4;
}

function urgencyForPawn(pawnId: number): number {
  return 1 + (pawnId % 2);
}

function permissionForPawn(pawnId: number): number {
  return pawnId % 4;
}

function scoreForOffer(offset: number): number {
  if (offset === 0 || offset === 1) {
    return 50_000;
  }

  return 10_000 - offset;
}
