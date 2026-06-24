import { performance } from "node:perf_hooks";

import {
  createEntityRegistry,
  createHaulingJobStore,
  createItemStackStore,
  createJobCoreStore,
  createReservationLedger,
  createStorageLogisticsIndex,
  createWorkOfferIndex,
  mixUint32,
  type EntityId,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

export interface Logistics10kBenchmarkReport {
  readonly name: "logistics-10k";
  readonly sourceSlotCount: number;
  readonly destinationSlotCount: number;
  readonly pawnCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly selectedOffers: number;
  readonly candidateCapHits: number;
  readonly haulingJobs: number;
  readonly deliveredJobs: number;
  readonly finalActiveClaims: number;
  readonly initialQuantity: number;
  readonly finalQuantity: number;
  readonly activeSupplySlots: number;
  readonly activeDemandSlots: number;
  readonly dirtyBacklog: number;
  readonly selectionChecksum: number;
  readonly quantityChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface Logistics10kBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly sourceSlotCount: number;
  readonly destinationSlotCount: number;
  readonly pawnCount: number;
  readonly candidateCap: number;
  readonly selectedCap: number;
  readonly totalBucketCandidates: number;
  readonly visitedCandidates: number;
  readonly selectedOffers: number;
  readonly candidateCapHits: number;
  readonly haulingJobs: number;
  readonly deliveredJobs: number;
  readonly finalActiveClaims: number;
  readonly initialQuantity: number;
  readonly finalQuantity: number;
  readonly activeSupplySlots: number;
  readonly activeDemandSlots: number;
  readonly dirtyBacklog: number;
  readonly selectionChecksum: number;
  readonly quantityChecksum: number;
}

export interface SampledLogistics10kBenchmark {
  readonly name: "logistics-10k";
  readonly report: Logistics10kBenchmarkReport;
  readonly invariants: Logistics10kBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runLogistics10kBenchmark(): Logistics10kBenchmarkReport {
  const sourceSlotCount = 10_000;
  const destinationSlotCount = 100;
  const pawnCount = 100;
  const candidateCap = 8;
  const selectedCap = 1;
  const totalSlots = sourceSlotCount + destinationSlotCount;
  const entityCapacity = totalSlots * 2 + pawnCount;
  const registry = createEntityRegistry({ capacity: entityCapacity });
  const pawns = allocateMany(registry, pawnCount);
  const stackEntities = allocateMany(registry, totalSlots);
  const storageEntities = allocateMany(registry, totalSlots);
  const items = createItemStackStore(totalSlots);
  const storage = createStorageLogisticsIndex(totalSlots, totalSlots);
  const offers = createWorkOfferIndex({
    capacity: totalSlots,
    workTypeCapacity: 1,
    regionCapacity: pawnCount,
    defCapacity: 8,
    urgencyBucketCount: 1,
    permissionCapacity: 1,
  });
  const ledger = createReservationLedger({
    capacity: 1_024,
    entityCapacity,
    cellCount: 65_536,
  });
  const jobCore = createJobCoreStore({ capacity: pawnCount });
  const hauling = createHaulingJobStore(pawnCount);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  for (let slotId = 0; slotId < sourceSlotCount; slotId += 1) {
    createStack(
      items,
      registry,
      stackEntities[slotId] ?? failMissingEntity(),
      slotId,
      defForSlot(slotId),
      4,
      8,
    );
    configureSlot(
      storage,
      registry,
      storageEntities[slotId] ?? failMissingEntity(),
      slotId,
      slotId,
      defForSlot(slotId),
      8,
      0,
    );
  }

  for (let index = 0; index < destinationSlotCount; index += 1) {
    const slotId = sourceSlotCount + index;
    createStack(
      items,
      registry,
      stackEntities[slotId] ?? failMissingEntity(),
      slotId,
      index % 8,
      0,
      4,
    );
    configureSlot(
      storage,
      registry,
      storageEntities[slotId] ?? failMissingEntity(),
      slotId,
      slotId,
      index % 8,
      4,
      4,
    );
  }

  storage.refreshDirty(items, ledger, offers, totalSlots);
  const initialQuantity = items.createMetrics().totalQuantity;
  const candidateScratch = new Uint32Array(candidateCap);
  const selectedOfferIds = new Uint32Array(selectedCap);
  const selectedScores = new Int32Array(selectedCap);
  let totalBucketCandidates = 0;
  let visitedCandidates = 0;
  let selectedOffers = 0;
  let candidateCapHits = 0;
  let deliveredJobs = 0;
  let selectionChecksum = 0;

  for (let pawnId = 0; pawnId < pawnCount; pawnId += 1) {
    const selected = offers.selectTopOffers(
      {
        pawnId,
        workType: 0,
        regionId: pawnId,
        defId: pawnId % 8,
        urgencyBucket: 0,
        permissionId: 0,
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
    selectedOffers += selected.selectedCount;
    candidateCapHits += selected.rejectedByCandidateCap > 0 ? 1 : 0;
    selectionChecksum = mixUint32(selectionChecksum, selectedOfferIds[0] ?? 0);
    selectionChecksum = mixUint32(selectionChecksum, selectedScores[0] ?? 0);
    deliverOne(
      pawnId,
      pawns[pawnId] ?? failMissingEntity(),
      selectedOfferIds[0] ?? 0,
      sourceSlotCount + pawnId,
      registry,
      items,
      storage,
      ledger,
      jobCore,
      hauling,
    );
    deliveredJobs += 1;
  }

  storage.refreshDirty(items, ledger, offers, totalSlots);
  const storageMetrics = storage.createMetrics();
  const ledgerMetrics = ledger.createMetrics();
  const finalQuantity = items.createMetrics().totalQuantity;
  const quantityChecksum = createQuantityChecksum(items, totalSlots);
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "logistics-10k",
    sourceSlotCount,
    destinationSlotCount,
    pawnCount,
    candidateCap,
    selectedCap,
    totalBucketCandidates,
    visitedCandidates,
    selectedOffers,
    candidateCapHits,
    haulingJobs: pawnCount,
    deliveredJobs,
    finalActiveClaims: ledgerMetrics.activeCount,
    initialQuantity,
    finalQuantity,
    activeSupplySlots: storageMetrics.activeSupplySlots,
    activeDemandSlots: storageMetrics.activeDemandSlots,
    dirtyBacklog: storageMetrics.dirtyBacklog,
    selectionChecksum,
    quantityChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function logistics10kInvariantsFromReport(
  report: Logistics10kBenchmarkReport,
): Logistics10kBenchmarkInvariants {
  return {
    sourceSlotCount: report.sourceSlotCount,
    destinationSlotCount: report.destinationSlotCount,
    pawnCount: report.pawnCount,
    candidateCap: report.candidateCap,
    selectedCap: report.selectedCap,
    totalBucketCandidates: report.totalBucketCandidates,
    visitedCandidates: report.visitedCandidates,
    selectedOffers: report.selectedOffers,
    candidateCapHits: report.candidateCapHits,
    haulingJobs: report.haulingJobs,
    deliveredJobs: report.deliveredJobs,
    finalActiveClaims: report.finalActiveClaims,
    initialQuantity: report.initialQuantity,
    finalQuantity: report.finalQuantity,
    activeSupplySlots: report.activeSupplySlots,
    activeDemandSlots: report.activeDemandSlots,
    dirtyBacklog: report.dirtyBacklog,
    selectionChecksum: report.selectionChecksum,
    quantityChecksum: report.quantityChecksum,
  };
}

function deliverOne(
  jobId: number,
  owner: EntityId,
  sourceSlotId: number,
  destinationSlotId: number,
  registry: ReturnType<typeof createEntityRegistry>,
  items: ReturnType<typeof createItemStackStore>,
  storage: ReturnType<typeof createStorageLogisticsIndex>,
  ledger: ReturnType<typeof createReservationLedger>,
  jobCore: ReturnType<typeof createJobCoreStore>,
  hauling: ReturnType<typeof createHaulingJobStore>,
): void {
  const created = hauling.createJob(
    {
      jobId,
      owner,
      sourceSlotId,
      destinationSlotId,
      amount: 1,
      createdTick: 0,
    },
    registry,
    jobCore,
  );
  if (!created.ok) {
    throw new Error(created.reason);
  }

  const reserved = hauling.reserveBeforePickup(jobId, 1, registry, items, storage, ledger, jobCore);
  if (!reserved.ok) {
    throw new Error(reserved.reason);
  }

  const picked = hauling.pickup(jobId, 2, items, storage, jobCore);
  if (!picked.ok) {
    throw new Error(picked.reason);
  }

  const delivered = hauling.deliver(jobId, 3, items, storage, ledger, jobCore);
  if (!delivered.ok) {
    throw new Error(delivered.reason);
  }
}

function createStack(
  items: ReturnType<typeof createItemStackStore>,
  registry: ReturnType<typeof createEntityRegistry>,
  entity: EntityId,
  stackId: number,
  defId: number,
  quantity: number,
  capacity: number,
): void {
  const created = items.createStack({ stackId, entity, defId, quantity, capacity }, registry);
  if (!created.ok) {
    throw new Error(created.reason);
  }
}

function configureSlot(
  storage: ReturnType<typeof createStorageLogisticsIndex>,
  registry: ReturnType<typeof createEntityRegistry>,
  storageEntity: EntityId,
  slotId: number,
  stackId: number,
  defId: number,
  capacity: number,
  desiredQuantity: number,
): void {
  const configured = storage.configureSlot(
    {
      slotId,
      storage: storageEntity,
      stackId,
      defId,
      capacity,
      desiredQuantity,
      interactionCellIndex: slotId,
      offerId: slotId,
      workType: 0,
      regionId: slotId % 100,
      urgencyBucket: 0,
      permissionId: 0,
    },
    registry,
  );
  if (!configured.ok) {
    throw new Error(configured.reason);
  }
}

function createQuantityChecksum(
  items: ReturnType<typeof createItemStackStore>,
  stackCount: number,
): number {
  let checksum = 0;

  for (let stackId = 0; stackId < stackCount; stackId += 1) {
    checksum = mixUint32(checksum, items.readStack(stackId)?.quantity ?? 0);
  }

  return checksum;
}

function allocateMany(
  registry: ReturnType<typeof createEntityRegistry>,
  count: number,
): readonly EntityId[] {
  const entities: EntityId[] = [];

  for (let index = 0; index < count; index += 1) {
    const allocated = registry.allocate();
    if (!allocated.ok) {
      throw new Error(allocated.reason);
    }
    entities.push(allocated.entity);
  }

  return entities;
}

function defForSlot(slotId: number): number {
  return slotId % 8;
}

function failMissingEntity(): never {
  throw new Error("missing logistics benchmark entity");
}
