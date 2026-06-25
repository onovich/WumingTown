import { performance } from "node:perf_hooks";

import {
  createEntityRegistry,
  createReservationLedger,
  mixUint32,
  type EntityId,
} from "@wuming-town/sim-core";

export interface M2ReservationContentionBenchmarkReport {
  readonly name: "m2-reservation-contention";
  readonly ownerCount: number;
  readonly targetSetCount: number;
  readonly contentionGroups: number;
  readonly transactionAttempts: number;
  readonly acceptedTransactions: number;
  readonly rejectedTransactions: number;
  readonly entityConflicts: number;
  readonly cellConflicts: number;
  readonly itemQuantityConflicts: number;
  readonly interactionConflicts: number;
  readonly capacityConflicts: number;
  readonly staleTargetRejects: number;
  readonly invalidOwnerRejects: number;
  readonly insufficientAmountRejects: number;
  readonly insufficientCapacityRejects: number;
  readonly invalidParameterRejects: number;
  readonly releasedByTerminalCleanup: number;
  readonly releasedByDestroyCleanup: number;
  readonly clearedByLoadRebuild: number;
  readonly finalActiveClaims: number;
  readonly unexpectedActiveClaims: number;
  readonly ledgerConflictCount: number;
  readonly transactionChecksum: number;
  readonly cleanupChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface M2ReservationContentionBenchmarkInvariants extends Record<
  string,
  boolean | number | string
> {
  readonly ownerCount: number;
  readonly targetSetCount: number;
  readonly contentionGroups: number;
  readonly transactionAttempts: number;
  readonly acceptedTransactions: number;
  readonly rejectedTransactions: number;
  readonly entityConflicts: number;
  readonly cellConflicts: number;
  readonly itemQuantityConflicts: number;
  readonly interactionConflicts: number;
  readonly capacityConflicts: number;
  readonly staleTargetRejects: number;
  readonly invalidOwnerRejects: number;
  readonly insufficientAmountRejects: number;
  readonly insufficientCapacityRejects: number;
  readonly invalidParameterRejects: number;
  readonly releasedByTerminalCleanup: number;
  readonly releasedByDestroyCleanup: number;
  readonly clearedByLoadRebuild: number;
  readonly finalActiveClaims: number;
  readonly unexpectedActiveClaims: number;
  readonly ledgerConflictCount: number;
  readonly transactionChecksum: number;
  readonly cleanupChecksum: number;
}

interface M2ReservationCounters {
  transactionAttempts: number;
  acceptedTransactions: number;
  rejectedTransactions: number;
  entityConflicts: number;
  cellConflicts: number;
  itemQuantityConflicts: number;
  interactionConflicts: number;
  capacityConflicts: number;
  staleTargetRejects: number;
  invalidOwnerRejects: number;
  insufficientAmountRejects: number;
  insufficientCapacityRejects: number;
  invalidParameterRejects: number;
  transactionChecksum: number;
}

export function runM2ReservationContentionBenchmark(): M2ReservationContentionBenchmarkReport {
  const ownerCount = 20;
  const targetSetCount = 64;
  const contentionGroups = 64;
  const cellCount = 2_048;
  const entityCapacity = ownerCount + targetSetCount * 2 + 4;
  const registry = createEntityRegistry({ capacity: entityCapacity });
  const owners = allocateMany(registry, ownerCount);
  const items = allocateMany(registry, targetSetCount);
  const sites = allocateMany(registry, targetSetCount);
  const cleanupTarget = allocateOrThrow(registry);
  const staleTarget = allocateOrThrow(registry);
  const ledger = createReservationLedger({
    capacity: 1_024,
    entityCapacity,
    cellCount,
    interactionSpotLimit: 16,
    capacitySlotLimit: 16,
  });
  const counters: M2ReservationCounters = {
    transactionAttempts: 0,
    acceptedTransactions: 0,
    rejectedTransactions: 0,
    entityConflicts: 0,
    cellConflicts: 0,
    itemQuantityConflicts: 0,
    interactionConflicts: 0,
    capacityConflicts: 0,
    staleTargetRejects: 0,
    invalidOwnerRejects: 0,
    insufficientAmountRejects: 0,
    insufficientCapacityRejects: 0,
    invalidParameterRejects: 0,
    transactionChecksum: 0,
  };
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  let releasedByTerminalCleanup = 0;
  let cleanupChecksum = 0;

  for (let group = 0; group < contentionGroups; group += 1) {
    const owner = owners[group % ownerCount] ?? failMissingEntity();
    const item = items[group] ?? failMissingEntity();
    const site = sites[group] ?? failMissingEntity();
    const jobId = group * 16;
    const baseCell = group * 8;
    const base = ledger.acquire(
      {
        owner,
        jobId,
        createdTick: group,
        leaseExpiryTick: group + 600,
        claims: [
          { channel: "entity", target: site },
          { channel: "cell", cellIndex: baseCell },
          { channel: "item_quantity", item, amount: 4, availableAmount: 10 },
          { channel: "interaction_spot", target: site, spotId: 1 },
          { channel: "capacity", target: site, capacityId: 2, amount: 4, capacity: 8 },
        ],
      },
      registry,
    );

    recordAttempt(counters, base);
    acquireExpectedReject(counters, ledger, registry, owners, group, jobId + 1, [
      { channel: "cell", cellIndex: baseCell + 1 },
      { channel: "entity", target: site },
    ]);
    acquireExpectedReject(counters, ledger, registry, owners, group, jobId + 2, [
      { channel: "item_quantity", item, amount: 1, availableAmount: 10 },
      { channel: "cell", cellIndex: baseCell },
    ]);
    acquireExpectedReject(counters, ledger, registry, owners, group, jobId + 3, [
      { channel: "cell", cellIndex: baseCell + 2 },
      { channel: "item_quantity", item, amount: 7, availableAmount: 10 },
    ]);
    acquireExpectedReject(counters, ledger, registry, owners, group, jobId + 4, [
      { channel: "cell", cellIndex: baseCell + 3 },
      { channel: "interaction_spot", target: site, spotId: 1 },
    ]);
    acquireExpectedReject(counters, ledger, registry, owners, group, jobId + 5, [
      { channel: "cell", cellIndex: baseCell + 4 },
      { channel: "capacity", target: site, capacityId: 2, amount: 5, capacity: 8 },
    ]);

    const released = ledger.releaseReservationsForOwnerJob(owner, jobId);
    if (!released.ok) {
      throw new Error(released.reason);
    }
    releasedByTerminalCleanup += released.releasedCount;
    cleanupChecksum = mixUint32(cleanupChecksum, released.releasedCount);
    cleanupChecksum = mixUint32(cleanupChecksum, jobId);
  }

  registry.destroy(staleTarget);
  const reused = allocateOrThrow(registry);
  if (reused.index !== staleTarget.index) {
    throw new Error("expected stale target index reuse for contention benchmark");
  }

  acquireExpectedReject(counters, ledger, registry, owners, 0, 2_000, [
    { channel: "entity", target: staleTarget },
  ]);
  acquireExpectedReject(counters, ledger, registry, owners, 1, 2_001, [
    {
      channel: "item_quantity",
      item: items[0] ?? failMissingEntity(),
      amount: 11,
      availableAmount: 10,
    },
  ]);
  acquireExpectedReject(counters, ledger, registry, owners, 2, 2_002, [
    {
      channel: "capacity",
      target: sites[0] ?? failMissingEntity(),
      capacityId: 3,
      amount: 9,
      capacity: 8,
    },
  ]);
  acquireExpectedReject(counters, ledger, registry, owners, 3, 2_003, [
    {
      channel: "capacity",
      target: sites[1] ?? failMissingEntity(),
      capacityId: 3,
      amount: 0,
      capacity: 8,
    },
  ]);
  recordAttempt(
    counters,
    ledger.acquire(
      {
        owner: { index: entityCapacity, generation: 0 },
        jobId: 2_004,
        createdTick: 2_004,
        leaseExpiryTick: 2_100,
        claims: [{ channel: "cell", cellIndex: 10 }],
      },
      registry,
    ),
  );

  for (let jobId = 3_000; jobId < 3_004; jobId += 1) {
    const acquired = ledger.acquire(
      {
        owner: owners[jobId % ownerCount] ?? failMissingEntity(),
        jobId,
        createdTick: jobId,
        leaseExpiryTick: jobId + 30,
        claims: [{ channel: "interaction_spot", target: cleanupTarget, spotId: jobId - 3_000 }],
      },
      registry,
    );
    recordAttempt(counters, acquired);
  }
  const releasedByDestroyCleanup = ledger.releaseReservationsForEntity(cleanupTarget);
  cleanupChecksum = mixUint32(cleanupChecksum, releasedByDestroyCleanup);
  cleanupChecksum = mixUint32(cleanupChecksum, cleanupTarget.index);

  const loadOwner = owners[0] ?? failMissingEntity();
  const loadItem = items[1] ?? failMissingEntity();
  const loadClaim = ledger.acquire(
    {
      owner: loadOwner,
      jobId: 4_000,
      createdTick: 4_000,
      leaseExpiryTick: 4_030,
      claims: [{ channel: "item_quantity", item: loadItem, amount: 2, availableAmount: 10 }],
    },
    registry,
  );
  recordAttempt(counters, loadClaim);
  const clearedByLoadRebuild = ledger.activeCount;
  const snapshot = ledger.createSnapshot();
  const restored = ledger.restoreFromSnapshot(
    { ...snapshot, ledgerVersion: snapshot.ledgerVersion + 1, activeCount: 0, records: [] },
    registry,
  );
  if (!restored.ok) {
    throw new Error(restored.reason);
  }
  cleanupChecksum = mixUint32(cleanupChecksum, clearedByLoadRebuild);
  cleanupChecksum = mixUint32(cleanupChecksum, restored.version);

  const metrics = ledger.createMetrics();
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "m2-reservation-contention",
    ownerCount,
    targetSetCount,
    contentionGroups,
    transactionAttempts: counters.transactionAttempts,
    acceptedTransactions: counters.acceptedTransactions,
    rejectedTransactions: counters.rejectedTransactions,
    entityConflicts: counters.entityConflicts,
    cellConflicts: counters.cellConflicts,
    itemQuantityConflicts: counters.itemQuantityConflicts,
    interactionConflicts: counters.interactionConflicts,
    capacityConflicts: counters.capacityConflicts,
    staleTargetRejects: counters.staleTargetRejects,
    invalidOwnerRejects: counters.invalidOwnerRejects,
    insufficientAmountRejects: counters.insufficientAmountRejects,
    insufficientCapacityRejects: counters.insufficientCapacityRejects,
    invalidParameterRejects: counters.invalidParameterRejects,
    releasedByTerminalCleanup,
    releasedByDestroyCleanup,
    clearedByLoadRebuild,
    finalActiveClaims: metrics.activeCount,
    unexpectedActiveClaims: metrics.activeCount,
    ledgerConflictCount: metrics.conflictCount,
    transactionChecksum: counters.transactionChecksum,
    cleanupChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function m2ReservationContentionInvariantsFromReport(
  report: M2ReservationContentionBenchmarkReport,
): M2ReservationContentionBenchmarkInvariants {
  return {
    ownerCount: report.ownerCount,
    targetSetCount: report.targetSetCount,
    contentionGroups: report.contentionGroups,
    transactionAttempts: report.transactionAttempts,
    acceptedTransactions: report.acceptedTransactions,
    rejectedTransactions: report.rejectedTransactions,
    entityConflicts: report.entityConflicts,
    cellConflicts: report.cellConflicts,
    itemQuantityConflicts: report.itemQuantityConflicts,
    interactionConflicts: report.interactionConflicts,
    capacityConflicts: report.capacityConflicts,
    staleTargetRejects: report.staleTargetRejects,
    invalidOwnerRejects: report.invalidOwnerRejects,
    insufficientAmountRejects: report.insufficientAmountRejects,
    insufficientCapacityRejects: report.insufficientCapacityRejects,
    invalidParameterRejects: report.invalidParameterRejects,
    releasedByTerminalCleanup: report.releasedByTerminalCleanup,
    releasedByDestroyCleanup: report.releasedByDestroyCleanup,
    clearedByLoadRebuild: report.clearedByLoadRebuild,
    finalActiveClaims: report.finalActiveClaims,
    unexpectedActiveClaims: report.unexpectedActiveClaims,
    ledgerConflictCount: report.ledgerConflictCount,
    transactionChecksum: report.transactionChecksum,
    cleanupChecksum: report.cleanupChecksum,
  };
}

function acquireExpectedReject(
  counters: M2ReservationCounters,
  ledger: ReturnType<typeof createReservationLedger>,
  registry: ReturnType<typeof createEntityRegistry>,
  owners: readonly EntityId[],
  group: number,
  jobId: number,
  claims: Parameters<ReturnType<typeof createReservationLedger>["acquire"]>[0]["claims"],
): void {
  const owner = owners[(group + jobId) % owners.length] ?? failMissingEntity();
  const result = ledger.acquire(
    {
      owner,
      jobId,
      createdTick: jobId,
      leaseExpiryTick: jobId + 120,
      claims,
    },
    registry,
  );

  recordAttempt(counters, result);
  if (result.ok) {
    throw new Error("expected reservation contention rejection");
  }
}

function recordAttempt(
  counters: M2ReservationCounters,
  result: ReturnType<ReturnType<typeof createReservationLedger>["acquire"]>,
): void {
  counters.transactionAttempts += 1;

  if (result.ok) {
    counters.acceptedTransactions += 1;
    counters.transactionChecksum = mixUint32(counters.transactionChecksum, result.version);
    counters.transactionChecksum = mixUint32(counters.transactionChecksum, result.claimIds.length);
    return;
  }

  counters.rejectedTransactions += 1;
  counters.transactionChecksum = mixUint32(
    counters.transactionChecksum,
    counters.transactionAttempts,
  );
  if (result.reason === "reservation_entity_conflict") {
    counters.entityConflicts += 1;
  } else if (result.reason === "reservation_cell_conflict") {
    counters.cellConflicts += 1;
  } else if (result.reason === "reservation_item_quantity_conflict") {
    counters.itemQuantityConflicts += 1;
  } else if (result.reason === "reservation_interaction_conflict") {
    counters.interactionConflicts += 1;
  } else if (result.reason === "reservation_capacity_conflict") {
    counters.capacityConflicts += 1;
  } else if (
    result.reason === "reservation_target_not_alive" ||
    result.reason === "reservation_target_generation_mismatch"
  ) {
    counters.staleTargetRejects += 1;
  } else if (
    result.reason === "reservation_owner_index_out_of_range" ||
    result.reason === "reservation_owner_generation_mismatch" ||
    result.reason === "reservation_owner_not_alive"
  ) {
    counters.invalidOwnerRejects += 1;
  } else if (result.reason === "reservation_insufficient_amount") {
    counters.insufficientAmountRejects += 1;
  } else if (result.reason === "reservation_insufficient_capacity") {
    counters.insufficientCapacityRejects += 1;
  } else {
    counters.invalidParameterRejects += 1;
  }
}

function allocateMany(
  registry: ReturnType<typeof createEntityRegistry>,
  count: number,
): readonly EntityId[] {
  const entities: EntityId[] = [];

  for (let index = 0; index < count; index += 1) {
    entities.push(allocateOrThrow(registry));
  }

  return entities;
}

function allocateOrThrow(registry: ReturnType<typeof createEntityRegistry>): EntityId {
  const result = registry.allocate();

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.entity;
}

function failMissingEntity(): never {
  throw new Error("missing m2 reservation contention benchmark entity");
}
