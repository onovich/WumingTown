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

export interface M2LogisticsHaulingBenchmarkReport {
  readonly name: "m2-logistics-hauling";
  readonly sourceSlotCount: number;
  readonly destinationSlotCount: number;
  readonly pawnCount: number;
  readonly candidateCap: number;
  readonly selectedSupplySlots: number;
  readonly selectedDemandSlots: number;
  readonly supplyCandidateCapHits: number;
  readonly demandCandidateCapHits: number;
  readonly deliveredJobs: number;
  readonly canceledJobs: number;
  readonly failedJobs: number;
  readonly interruptedJobs: number;
  readonly finalActiveClaims: number;
  readonly initialWoodQuantity: number;
  readonly finalWoodQuantity: number;
  readonly initialStoneQuantity: number;
  readonly finalStoneQuantity: number;
  readonly dirtyBacklogPeak: number;
  readonly finalDirtyBacklog: number;
  readonly indexedSupplySlots: number;
  readonly indexedDemandSlots: number;
  readonly selectionChecksum: number;
  readonly quantityChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M2LogisticsHaulingBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly sourceSlotCount: number;
  readonly destinationSlotCount: number;
  readonly pawnCount: number;
  readonly candidateCap: number;
  readonly selectedSupplySlots: number;
  readonly selectedDemandSlots: number;
  readonly supplyCandidateCapHits: number;
  readonly demandCandidateCapHits: number;
  readonly deliveredJobs: number;
  readonly canceledJobs: number;
  readonly failedJobs: number;
  readonly interruptedJobs: number;
  readonly finalActiveClaims: number;
  readonly initialWoodQuantity: number;
  readonly finalWoodQuantity: number;
  readonly initialStoneQuantity: number;
  readonly finalStoneQuantity: number;
  readonly dirtyBacklogPeak: number;
  readonly finalDirtyBacklog: number;
  readonly indexedSupplySlots: number;
  readonly indexedDemandSlots: number;
  readonly selectionChecksum: number;
  readonly quantityChecksum: number;
}

const WOOD_DEF = 1;
const STONE_DEF = 2;
const SOURCE_SLOTS = 12;
const DESTINATION_SLOTS = 8;
const TOTAL_SLOTS = SOURCE_SLOTS + DESTINATION_SLOTS;
const PAWN_COUNT = 20;
const CANDIDATE_CAP = 6;

export function runM2LogisticsHaulingBenchmark(): M2LogisticsHaulingBenchmarkReport {
  const registry = createEntityRegistry({ capacity: 96 });
  const pawns = allocateMany(registry, PAWN_COUNT);
  const stackEntities = allocateMany(registry, TOTAL_SLOTS);
  const storageEntities = allocateMany(registry, TOTAL_SLOTS);
  const items = createItemStackStore(TOTAL_SLOTS);
  const storage = createStorageLogisticsIndex(TOTAL_SLOTS, TOTAL_SLOTS, 4);
  const offers = createWorkOfferIndex({
    capacity: TOTAL_SLOTS,
    workTypeCapacity: 2,
    regionCapacity: 4,
    defCapacity: 4,
    urgencyBucketCount: 2,
    permissionCapacity: 2,
  });
  const ledger = createReservationLedger({
    capacity: 256,
    entityCapacity: 96,
    cellCount: 256,
  });
  const jobCore = createJobCoreStore({ capacity: PAWN_COUNT });
  const hauling = createHaulingJobStore(PAWN_COUNT);
  const supplyScratch = new Uint32Array(CANDIDATE_CAP);
  const demandScratch = new Uint32Array(CANDIDATE_CAP);
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();

  createFixtureStacks(items, registry, stackEntities, storage, storageEntities);
  let dirtyBacklogPeak = storage.createMetrics().dirtyBacklog;
  storage.refreshDirty(items, ledger, offers, TOTAL_SLOTS);
  dirtyBacklogPeak = Math.max(dirtyBacklogPeak, storage.createMetrics().dirtyBacklog);

  const initialWoodQuantity = totalDef(items, WOOD_DEF);
  const initialStoneQuantity = totalDef(items, STONE_DEF);
  let selectedSupplySlots = 0;
  let selectedDemandSlots = 0;
  let supplyCandidateCapHits = 0;
  let demandCandidateCapHits = 0;
  let deliveredJobs = 0;
  let canceledJobs = 0;
  let failedJobs = 0;
  let interruptedJobs = 0;
  let selectionChecksum = 0;

  for (let jobId = 0; jobId < PAWN_COUNT; jobId += 1) {
    const defId = jobId % 2 === 0 ? WOOD_DEF : STONE_DEF;
    const supply = storage.selectSupplySlots(defId, CANDIDATE_CAP, supplyScratch);
    const demand = storage.selectDemandSlots(defId, CANDIDATE_CAP, demandScratch);
    if (!supply.ok || !demand.ok || supply.selectedCount === 0 || demand.selectedCount === 0) {
      throw new Error("m2 logistics hauling candidate selection failed");
    }

    selectedSupplySlots += supply.selectedCount;
    selectedDemandSlots += demand.selectedCount;
    supplyCandidateCapHits += supply.candidateCapHit ? 1 : 0;
    demandCandidateCapHits += demand.candidateCapHit ? 1 : 0;
    const sourceSlotId = supplyScratch[jobId % supply.selectedCount] ?? failMissingSlot();
    const destinationSlotId = demandScratch[jobId % demand.selectedCount] ?? failMissingSlot();
    selectionChecksum = mixUint32(selectionChecksum, sourceSlotId);
    selectionChecksum = mixUint32(selectionChecksum, destinationSlotId);

    runOneJob(
      jobId,
      pawns[jobId] ?? failMissingEntity(),
      sourceSlotId,
      destinationSlotId,
      registry,
      items,
      storage,
      ledger,
      jobCore,
      hauling,
    );

    if (jobId % 4 === 1) {
      canceledJobs += 1;
    } else if (jobId % 4 === 2) {
      failedJobs += 1;
    } else if (jobId % 4 === 3) {
      interruptedJobs += 1;
    } else {
      deliveredJobs += 1;
    }

    dirtyBacklogPeak = Math.max(dirtyBacklogPeak, storage.createMetrics().dirtyBacklog);
    storage.refreshDirty(items, ledger, offers, TOTAL_SLOTS);
  }

  const finalMetrics = storage.refreshDirty(items, ledger, offers, TOTAL_SLOTS);
  const finalWoodQuantity = totalDef(items, WOOD_DEF);
  const finalStoneQuantity = totalDef(items, STONE_DEF);
  const quantityChecksum = createQuantityChecksum(items);
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "m2-logistics-hauling",
    sourceSlotCount: SOURCE_SLOTS,
    destinationSlotCount: DESTINATION_SLOTS,
    pawnCount: PAWN_COUNT,
    candidateCap: CANDIDATE_CAP,
    selectedSupplySlots,
    selectedDemandSlots,
    supplyCandidateCapHits,
    demandCandidateCapHits,
    deliveredJobs,
    canceledJobs,
    failedJobs,
    interruptedJobs,
    finalActiveClaims: ledger.createMetrics().activeCount,
    initialWoodQuantity,
    finalWoodQuantity,
    initialStoneQuantity,
    finalStoneQuantity,
    dirtyBacklogPeak,
    finalDirtyBacklog: finalMetrics.dirtyBacklog,
    indexedSupplySlots: finalMetrics.indexedSupplySlots,
    indexedDemandSlots: finalMetrics.indexedDemandSlots,
    selectionChecksum,
    quantityChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m2LogisticsHaulingInvariantsFromReport(
  report: M2LogisticsHaulingBenchmarkReport,
): M2LogisticsHaulingBenchmarkInvariants {
  return {
    sourceSlotCount: report.sourceSlotCount,
    destinationSlotCount: report.destinationSlotCount,
    pawnCount: report.pawnCount,
    candidateCap: report.candidateCap,
    selectedSupplySlots: report.selectedSupplySlots,
    selectedDemandSlots: report.selectedDemandSlots,
    supplyCandidateCapHits: report.supplyCandidateCapHits,
    demandCandidateCapHits: report.demandCandidateCapHits,
    deliveredJobs: report.deliveredJobs,
    canceledJobs: report.canceledJobs,
    failedJobs: report.failedJobs,
    interruptedJobs: report.interruptedJobs,
    finalActiveClaims: report.finalActiveClaims,
    initialWoodQuantity: report.initialWoodQuantity,
    finalWoodQuantity: report.finalWoodQuantity,
    initialStoneQuantity: report.initialStoneQuantity,
    finalStoneQuantity: report.finalStoneQuantity,
    dirtyBacklogPeak: report.dirtyBacklogPeak,
    finalDirtyBacklog: report.finalDirtyBacklog,
    indexedSupplySlots: report.indexedSupplySlots,
    indexedDemandSlots: report.indexedDemandSlots,
    selectionChecksum: report.selectionChecksum,
    quantityChecksum: report.quantityChecksum,
  };
}

function createFixtureStacks(
  items: ReturnType<typeof createItemStackStore>,
  registry: ReturnType<typeof createEntityRegistry>,
  stackEntities: readonly EntityId[],
  storage: ReturnType<typeof createStorageLogisticsIndex>,
  storageEntities: readonly EntityId[],
): void {
  for (let slotId = 0; slotId < SOURCE_SLOTS; slotId += 1) {
    const defId = slotId % 2 === 0 ? WOOD_DEF : STONE_DEF;
    createStack(items, registry, slotId, stackEntities[slotId] ?? failMissingEntity(), defId, 8, 8);
    configureSlot(
      storage,
      registry,
      slotId,
      storageEntities[slotId] ?? failMissingEntity(),
      slotId,
      defId,
      8,
      0,
    );
  }

  for (let index = 0; index < DESTINATION_SLOTS; index += 1) {
    const slotId = SOURCE_SLOTS + index;
    const defId = index % 2 === 0 ? WOOD_DEF : STONE_DEF;
    createStack(
      items,
      registry,
      slotId,
      stackEntities[slotId] ?? failMissingEntity(),
      defId,
      0,
      16,
    );
    configureSlot(
      storage,
      registry,
      slotId,
      storageEntities[slotId] ?? failMissingEntity(),
      slotId,
      defId,
      16,
      16,
    );
  }
}

function runOneJob(
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
  mustOk(
    hauling.createJob(
      { jobId, owner, sourceSlotId, destinationSlotId, amount: 2, createdTick: jobId },
      registry,
      jobCore,
    ),
  );
  mustOk(hauling.reserveBeforePickup(jobId, jobId + 1, registry, items, storage, ledger, jobCore));
  mustOk(hauling.pickup(jobId, jobId + 2, items, storage, jobCore));

  if (jobId % 4 === 1) {
    mustOk(hauling.cancel(jobId, jobId + 3, items, storage, ledger, jobCore));
    return;
  }

  if (jobId % 4 === 2) {
    mustOk(hauling.fail(jobId, jobId + 3, "path", items, storage, ledger, jobCore));
    return;
  }

  if (jobId % 4 === 3) {
    mustOk(hauling.interrupt(jobId, "immediate", jobId + 3, items, storage, ledger, jobCore));
    return;
  }

  mustOk(hauling.deliver(jobId, jobId + 3, items, storage, ledger, jobCore));
}

function createStack(
  items: ReturnType<typeof createItemStackStore>,
  registry: ReturnType<typeof createEntityRegistry>,
  stackId: number,
  entity: EntityId,
  defId: number,
  quantity: number,
  capacity: number,
): void {
  mustOk(items.createStack({ stackId, entity, defId, quantity, capacity }, registry));
}

function configureSlot(
  storage: ReturnType<typeof createStorageLogisticsIndex>,
  registry: ReturnType<typeof createEntityRegistry>,
  slotId: number,
  storageEntity: EntityId,
  stackId: number,
  defId: number,
  capacity: number,
  desiredQuantity: number,
): void {
  mustOk(
    storage.configureSlot(
      {
        slotId,
        storage: storageEntity,
        stackId,
        defId,
        capacity,
        desiredQuantity,
        interactionCellIndex: slotId + 32,
        offerId: slotId,
        workType: 0,
        regionId: 0,
        urgencyBucket: 0,
        permissionId: 0,
      },
      registry,
    ),
  );
}

function totalDef(items: ReturnType<typeof createItemStackStore>, defId: number): number {
  let total = 0;

  for (let stackId = 0; stackId < TOTAL_SLOTS; stackId += 1) {
    const stack = items.readStack(stackId);
    if (stack?.defId === defId) {
      total += stack.quantity;
    }
  }

  return total;
}

function createQuantityChecksum(items: ReturnType<typeof createItemStackStore>): number {
  let checksum = 0;

  for (let stackId = 0; stackId < TOTAL_SLOTS; stackId += 1) {
    const stack = items.readStack(stackId);
    checksum = mixUint32(checksum, stack?.quantity ?? 0);
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

function mustOk(result: { readonly ok: boolean; readonly reason?: string }): void {
  if (!result.ok) {
    throw new Error(result.reason ?? "m2 logistics hauling mutation failed");
  }
}

function failMissingEntity(): never {
  throw new Error("missing m2 logistics hauling entity");
}

function failMissingSlot(): never {
  throw new Error("missing m2 logistics hauling slot");
}
