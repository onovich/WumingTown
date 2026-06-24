import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

import {
  MAP_TERRAIN_BLOCKED,
  createGridPathfinder,
  createMapGrid,
  createPathRequestBatcher,
  createPathVersionBasis,
  createRegionRoomRebuilder,
  createWorkOfferIndex,
  mixUint32,
  type MapGrid,
  type PathVersionBasis,
  type RegionRoomRebuilder,
  type WorkOfferIndex,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

export interface M2PathWorkSelectionBenchmarkReport {
  readonly name: "m2-path-work-selection";
  readonly width: number;
  readonly height: number;
  readonly pawnCount: number;
  readonly offerCount: number;
  readonly selectionCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly exactPathCap: number;
  readonly allEntityScanEquivalent: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly scoredCandidates: number;
  readonly selectedCandidates: number;
  readonly candidateCapHits: number;
  readonly exactPathCapHits: number;
  readonly exactPathRequests: number;
  readonly acceptedPathResults: number;
  readonly staleRejectedResults: number;
  readonly regionRejectedCandidates: number;
  readonly blockedRejectedCandidates: number;
  readonly noRouteRejectedCandidates: number;
  readonly nodeBudgetRejectedCandidates: number;
  readonly queueBacklogPeak: number;
  readonly finalQueueBacklog: number;
  readonly nodeExpansions: number;
  readonly basisChangeCount: number;
  readonly selectionChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M2PathWorkSelectionBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly width: number;
  readonly height: number;
  readonly pawnCount: number;
  readonly offerCount: number;
  readonly selectionCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly exactPathCap: number;
  readonly allEntityScanEquivalent: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly scoredCandidates: number;
  readonly selectedCandidates: number;
  readonly candidateCapHits: number;
  readonly exactPathCapHits: number;
  readonly exactPathRequests: number;
  readonly acceptedPathResults: number;
  readonly staleRejectedResults: number;
  readonly regionRejectedCandidates: number;
  readonly blockedRejectedCandidates: number;
  readonly noRouteRejectedCandidates: number;
  readonly nodeBudgetRejectedCandidates: number;
  readonly queueBacklogPeak: number;
  readonly finalQueueBacklog: number;
  readonly nodeExpansions: number;
  readonly basisChangeCount: number;
  readonly selectionChecksum: number;
}

export interface SampledM2PathWorkSelectionBenchmark {
  readonly name: "m2-path-work-selection";
  readonly report: M2PathWorkSelectionBenchmarkReport;
  readonly invariants: M2PathWorkSelectionBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runM2PathWorkSelectionBenchmark(): M2PathWorkSelectionBenchmarkReport {
  const width = 40;
  const height = 24;
  const pawnCount = 20;
  const offerCount = 48;
  const selectionCount = 100;
  const candidateCap = 24;
  const selectedCap = 12;
  const exactPathCap = 4;
  const fixture = createM2PathWorkFixture(width, height, offerCount);
  const pathfinder = createGridPathfinder(fixture.grid.cellCount);
  const batcher = createPathRequestBatcher(exactPathCap, pathfinder);
  const candidateScratch = new Uint32Array(candidateCap);
  const selectedOfferIds = new Uint32Array(selectedCap);
  const selectedScores = new Int32Array(selectedCap);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  let basis = fixture.basis;
  let totalBucketCandidates = 0;
  let visitedCandidates = 0;
  let scoredCandidates = 0;
  let selectedCandidates = 0;
  let candidateCapHits = 0;
  let exactPathCapHits = 0;
  let exactPathRequests = 0;
  let acceptedPathResults = 0;
  let staleRejectedResults = 0;
  let regionRejectedCandidates = 0;
  let blockedRejectedCandidates = 0;
  let noRouteRejectedCandidates = 0;
  let nodeBudgetRejectedCandidates = 0;
  let basisChangeCount = 0;
  let nodeExpansions = 0;
  let selectionChecksum = 0;

  for (let selectionIndex = 0; selectionIndex < selectionCount; selectionIndex += 1) {
    const pawnId = selectionIndex % pawnCount;
    const selected = fixture.offers.selectTopOffers(
      {
        pawnId,
        workType: 1,
        regionId: fixture.originRegionId,
        defId: 1,
        urgencyBucket: 1,
        permissionId: 1,
        candidateCap,
        maxSelectedOffers: selectedCap,
      },
      candidateScratch,
      selectedOfferIds,
      selectedScores,
    );

    if (!selected.ok) {
      throw new Error(selected.reason);
    }

    totalBucketCandidates += selected.bucketCandidateCount;
    visitedCandidates += selected.visitedCount;
    scoredCandidates += selected.scoredCount;
    selectedCandidates += selected.selectedCount;

    if (selected.rejectedByCandidateCap > 0) {
      candidateCapHits += 1;
    }

    if (selected.selectedCount > exactPathCap) {
      exactPathCapHits += 1;
    }

    const pathSelection = enqueueFirstReachablePath(
      fixture,
      batcher,
      selectedOfferIds,
      selected.selectedCount,
      exactPathCap,
      basis,
      selectionIndex,
    );

    regionRejectedCandidates += pathSelection.regionRejectedCandidates;
    blockedRejectedCandidates += pathSelection.blockedRejectedCandidates;

    if (pathSelection.enqueued) {
      exactPathRequests += 1;
      const processed = batcher.processNext(fixture.grid);

      if (!processed.ok || !processed.processed) {
        throw new Error(processed.ok ? "missing M2 path work result" : processed.reason);
      }

      nodeExpansions += processed.result.nodeExpansions;
      let commitBasis = basis;

      if (selectionIndex % 4 === 0) {
        fixture.centerGateBlocked = !fixture.centerGateBlocked;
        basis = toggleCenterGate(fixture, fixture.centerGateBlocked);
        commitBasis = basis;
        basisChangeCount += 1;
      }

      const committed = batcher.commitResult(processed.result, commitBasis);

      if (committed.ok) {
        acceptedPathResults += 1;
      } else {
        staleRejectedResults += 1;
      }

      if (!processed.result.ok) {
        if (processed.result.reason === "path_no_route") {
          noRouteRejectedCandidates += 1;
        } else if (processed.result.reason === "path_node_budget_exhausted") {
          nodeBudgetRejectedCandidates += 1;
        } else if (
          processed.result.reason === "path_start_blocked" ||
          processed.result.reason === "path_goal_blocked"
        ) {
          blockedRejectedCandidates += 1;
        }
      }

      selectionChecksum = mixUint32(selectionChecksum, processed.result.requestSequence);
      selectionChecksum = mixUint32(selectionChecksum, processed.result.nodeExpansions);
      selectionChecksum = mixUint32(selectionChecksum, committed.ok ? 1 : 0);
    }
  }

  const metrics = batcher.createMetrics();
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "m2-path-work-selection",
    width,
    height,
    pawnCount,
    offerCount,
    selectionCount,
    candidateCap,
    selectedCap,
    exactPathCap,
    allEntityScanEquivalent: pawnCount * offerCount * selectionCount,
    totalBucketCandidates,
    visitedCandidates,
    scoredCandidates,
    selectedCandidates,
    candidateCapHits,
    exactPathCapHits,
    exactPathRequests,
    acceptedPathResults,
    staleRejectedResults,
    regionRejectedCandidates,
    blockedRejectedCandidates,
    noRouteRejectedCandidates,
    nodeBudgetRejectedCandidates,
    queueBacklogPeak: metrics.queueBacklogPeak,
    finalQueueBacklog: metrics.queuedCount,
    nodeExpansions,
    basisChangeCount,
    selectionChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m2PathWorkSelectionInvariantsFromReport(
  report: M2PathWorkSelectionBenchmarkReport,
): M2PathWorkSelectionBenchmarkInvariants {
  return {
    width: report.width,
    height: report.height,
    pawnCount: report.pawnCount,
    offerCount: report.offerCount,
    selectionCount: report.selectionCount,
    candidateCap: report.candidateCap,
    selectedCap: report.selectedCap,
    exactPathCap: report.exactPathCap,
    allEntityScanEquivalent: report.allEntityScanEquivalent,
    totalBucketCandidates: report.totalBucketCandidates,
    visitedCandidates: report.visitedCandidates,
    scoredCandidates: report.scoredCandidates,
    selectedCandidates: report.selectedCandidates,
    candidateCapHits: report.candidateCapHits,
    exactPathCapHits: report.exactPathCapHits,
    exactPathRequests: report.exactPathRequests,
    acceptedPathResults: report.acceptedPathResults,
    staleRejectedResults: report.staleRejectedResults,
    regionRejectedCandidates: report.regionRejectedCandidates,
    blockedRejectedCandidates: report.blockedRejectedCandidates,
    noRouteRejectedCandidates: report.noRouteRejectedCandidates,
    nodeBudgetRejectedCandidates: report.nodeBudgetRejectedCandidates,
    queueBacklogPeak: report.queueBacklogPeak,
    finalQueueBacklog: report.finalQueueBacklog,
    nodeExpansions: report.nodeExpansions,
    basisChangeCount: report.basisChangeCount,
    selectionChecksum: report.selectionChecksum,
  };
}

export function writeM2PathWorkSelectionBenchmarkArtifact(
  artifactPath = path.resolve(
    process.cwd(),
    "coordination",
    "artifacts",
    "WM-0035",
    "benchmarks",
    "m2-path-work-selection-results.json",
  ),
): M2PathWorkSelectionBenchmarkReport {
  const report = runM2PathWorkSelectionBenchmark();
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(
    artifactPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        artifactPath: path.relative(process.cwd(), artifactPath).replaceAll("\\", "/"),
        report,
        invariants: m2PathWorkSelectionInvariantsFromReport(report),
      },
      undefined,
      2,
    )}\n`,
    "utf8",
  );
  return report;
}

interface M2PathWorkFixture {
  readonly grid: MapGrid;
  readonly rebuild: RegionRoomRebuilder;
  readonly offers: WorkOfferIndex;
  readonly originRegionId: number;
  readonly basis: PathVersionBasis;
  centerGateBlocked: boolean;
}

function createM2PathWorkFixture(
  width: number,
  height: number,
  offerCount: number,
): M2PathWorkFixture {
  const grid = createMapGrid({ width, height, chunkSize: 8 });
  carveM2Wall(grid);
  const rebuild = createRegionRoomRebuilder(grid);
  const loaded = rebuild.markAllDirtyForLoad();

  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }

  drainRegionRoom(rebuild);
  const originCell = grid.readCellByIndex(cellIndex(grid, 9, 12));

  if (!originCell.ok) {
    throw new Error(originCell.reason);
  }

  const offers = createWorkOfferIndex({
    capacity: offerCount,
    workTypeCapacity: 4,
    regionCapacity: 128,
    defCapacity: 4,
    urgencyBucketCount: 4,
    permissionCapacity: 4,
  });

  for (let offerId = 0; offerId < offerCount; offerId += 1) {
    const y = 3 + (offerId % 18);
    const registered = offers.registerOffer({
      offerId,
      workType: 1,
      regionId: originCell.cell.regionId,
      defId: 1,
      urgencyBucket: 1,
      permissionId: 1,
      targetId: 10_000 + offerId,
      targetCellIndex: cellIndex(grid, 28 + (offerId % 8), y),
      scoreMilli: 10_000 - offerId,
    });

    if (!registered.ok) {
      throw new Error(registered.reason);
    }
  }

  return {
    grid,
    rebuild,
    offers,
    originRegionId: originCell.cell.regionId,
    basis: basisFrom(grid, rebuild),
    centerGateBlocked: false,
  };
}

function enqueueFirstReachablePath(
  fixture: M2PathWorkFixture,
  batcher: ReturnType<typeof createPathRequestBatcher>,
  selectedOfferIds: Uint32Array,
  selectedCount: number,
  exactPathCap: number,
  basis: PathVersionBasis,
  selectionIndex: number,
): {
  readonly enqueued: boolean;
  readonly regionRejectedCandidates: number;
  readonly blockedRejectedCandidates: number;
} {
  let regionRejectedCandidates = 0;
  let blockedRejectedCandidates = 0;
  const exactLimit = Math.min(selectedCount, exactPathCap);

  for (let index = 0; index < exactLimit; index += 1) {
    const offerId = selectedOfferIds[index] ?? 0xffff_ffff;
    const offer = fixture.offers.readOffer(offerId);

    if (offer === undefined) {
      continue;
    }

    const passable = fixture.grid.isCellPassableByIndex(offer.targetCellIndex);

    if (!passable.ok || !passable.passable) {
      blockedRejectedCandidates += 1;
      continue;
    }

    const targetCell = fixture.grid.readCellByIndex(offer.targetCellIndex);

    if (!targetCell.ok || targetCell.cell.regionId === 0) {
      regionRejectedCandidates += 1;
      continue;
    }

    const enqueued = batcher.enqueue({
      requestSequence: selectionIndex,
      issuedTick: selectionIndex,
      startCellIndex: cellIndex(fixture.grid, 9, 12),
      goalCellIndex: offer.targetCellIndex,
      basis,
      maxNodeExpansions: 2_048,
    });

    if (!enqueued.ok) {
      throw new Error(enqueued.reason);
    }

    return { enqueued: true, regionRejectedCandidates, blockedRejectedCandidates };
  }

  return { enqueued: false, regionRejectedCandidates, blockedRejectedCandidates };
}

function carveM2Wall(grid: MapGrid): void {
  for (let y = 2; y <= 21; y += 1) {
    if (y !== 6 && y !== 12 && y !== 18) {
      setBlocked(grid, 18, y);
    }
  }
}

function toggleCenterGate(fixture: M2PathWorkFixture, blocked: boolean): PathVersionBasis {
  const terrain = blocked ? MAP_TERRAIN_BLOCKED : 0;
  setTerrain(fixture.grid, 18, 12, terrain);
  setTerrain(fixture.grid, 18, 13, terrain);
  markDirty(fixture.rebuild, 18, 12);
  markDirty(fixture.rebuild, 18, 13);
  drainRegionRoom(fixture.rebuild);
  return basisFrom(fixture.grid, fixture.rebuild);
}

function setBlocked(grid: MapGrid, x: number, y: number): void {
  setTerrain(grid, x, y, MAP_TERRAIN_BLOCKED);
}

function setTerrain(grid: MapGrid, x: number, y: number, terrain: number): void {
  const updated = grid.updateCell(x, y, { terrain });

  if (!updated.ok) {
    throw new Error(updated.reason);
  }
}

function markDirty(rebuild: RegionRoomRebuilder, x: number, y: number): void {
  const marked = rebuild.markCellDirty(x, y);

  if (!marked.ok) {
    throw new Error(marked.reason);
  }
}

function basisFrom(grid: MapGrid, rebuild: RegionRoomRebuilder): PathVersionBasis {
  return createPathVersionBasis(grid, {
    navigationVersion: rebuild.navigationVersion,
    regionVersion: rebuild.regionVersion,
    roomVersion: rebuild.roomVersion,
    regionGraphVersion: rebuild.regionGraphVersion,
  });
}

function drainRegionRoom(rebuild: RegionRoomRebuilder): void {
  let guard = 0;

  while (guard < 512) {
    const processed = rebuild.processDirtyCells(256);

    if (!processed.ok) {
      throw new Error(processed.reason);
    }

    if (processed.remainingDirtyCells === 0 && processed.activeCellBacklog === 0) {
      return;
    }

    guard += 1;
  }

  throw new Error("M2 path work benchmark region-room drain guard exhausted");
}

function cellIndex(grid: MapGrid, x: number, y: number): number {
  return y * grid.width + x;
}
