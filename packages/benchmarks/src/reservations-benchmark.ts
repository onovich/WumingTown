import { performance } from "node:perf_hooks";

import {
  createEntityRegistry,
  createReservationLedger,
  mixUint32,
  type EntityId,
} from "@wuming-town/sim-core";

import type { BenchmarkSampleStats } from "./benchmarks";

export interface ReservationsBenchmarkReport {
  readonly name: "reservations";
  readonly ownerCount: number;
  readonly itemTargetCount: number;
  readonly capacityTargetCount: number;
  readonly transactionAttempts: number;
  readonly acceptedTransactions: number;
  readonly rejectedTransactions: number;
  readonly releasedByCleanup: number;
  readonly finalActiveClaims: number;
  readonly conflictCount: number;
  readonly itemQuantityReservationCount: number;
  readonly capacityReservationCount: number;
  readonly transactionChecksum: number;
  readonly cleanupChecksum: number;
  readonly elapsedMs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapDeltaBytes: number;
}

export interface ReservationsBenchmarkInvariants extends Record<string, boolean | number | string> {
  readonly ownerCount: number;
  readonly itemTargetCount: number;
  readonly capacityTargetCount: number;
  readonly transactionAttempts: number;
  readonly acceptedTransactions: number;
  readonly rejectedTransactions: number;
  readonly releasedByCleanup: number;
  readonly finalActiveClaims: number;
  readonly conflictCount: number;
  readonly itemQuantityReservationCount: number;
  readonly capacityReservationCount: number;
  readonly transactionChecksum: number;
  readonly cleanupChecksum: number;
}

export interface SampledReservationsBenchmark {
  readonly name: "reservations";
  readonly report: ReservationsBenchmarkReport;
  readonly invariants: ReservationsBenchmarkInvariants;
  readonly sampleElapsedMs: readonly number[];
  readonly stats: BenchmarkSampleStats;
}

export function runReservationsBenchmark(): ReservationsBenchmarkReport {
  const ownerCount = 64;
  const itemTargetCount = 128;
  const capacityTargetCount = 128;
  const transactionAttempts = 4_608;
  const perTargetLimit = 32;
  const entityCapacity = ownerCount + itemTargetCount + capacityTargetCount;
  const registry = createEntityRegistry({ capacity: entityCapacity });
  const owners = allocateMany(registry, ownerCount);
  const items = allocateMany(registry, itemTargetCount);
  const capacityTargets = allocateMany(registry, capacityTargetCount);
  const ledger = createReservationLedger({
    capacity: 8_192,
    entityCapacity,
    cellCount: 256,
  });
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;
  const startedAtMs = performance.now();
  let acceptedTransactions = 0;
  let rejectedTransactions = 0;
  let transactionChecksum = 0;

  for (let attempt = 0; attempt < transactionAttempts; attempt += 1) {
    const owner = owners[attempt % ownerCount] ?? failMissingEntity();
    const item = items[(attempt * 37) % itemTargetCount] ?? failMissingEntity();
    const capacityTarget =
      capacityTargets[(attempt * 53) % capacityTargetCount] ?? failMissingEntity();
    const result = ledger.acquire(
      {
        owner,
        jobId: attempt,
        createdTick: attempt,
        leaseExpiryTick: attempt + 120,
        claims: [
          {
            channel: "item_quantity",
            item,
            amount: 1,
            availableAmount: perTargetLimit,
          },
          {
            channel: "capacity",
            target: capacityTarget,
            capacityId: 0,
            amount: 1,
            capacity: perTargetLimit,
          },
        ],
      },
      registry,
    );

    if (result.ok) {
      acceptedTransactions += 1;
      transactionChecksum = mixUint32(transactionChecksum, result.version);
      transactionChecksum = mixUint32(transactionChecksum, result.claimIds[0] ?? 0);
    } else {
      rejectedTransactions += 1;
      transactionChecksum = mixUint32(transactionChecksum, attempt);
    }
  }

  let releasedByCleanup = 0;
  let cleanupChecksum = 0;

  for (let index = 0; index < 8; index += 1) {
    const item = items[index] ?? failMissingEntity();
    const released = ledger.releaseReservationsForEntity(item);
    releasedByCleanup += released;
    cleanupChecksum = mixUint32(cleanupChecksum, released);
    cleanupChecksum = mixUint32(cleanupChecksum, item.index);
  }

  for (let index = 0; index < 8; index += 1) {
    const capacityTarget = capacityTargets[index] ?? failMissingEntity();
    const released = ledger.releaseReservationsForEntity(capacityTarget);
    releasedByCleanup += released;
    cleanupChecksum = mixUint32(cleanupChecksum, released);
    cleanupChecksum = mixUint32(cleanupChecksum, capacityTarget.index);
  }

  const metrics = ledger.createMetrics();
  const elapsedMs = performance.now() - startedAtMs;
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    name: "reservations",
    ownerCount,
    itemTargetCount,
    capacityTargetCount,
    transactionAttempts,
    acceptedTransactions,
    rejectedTransactions,
    releasedByCleanup,
    finalActiveClaims: metrics.activeCount,
    conflictCount: metrics.conflictCount,
    itemQuantityReservationCount: metrics.itemQuantityReservationCount,
    capacityReservationCount: metrics.capacityReservationCount,
    transactionChecksum,
    cleanupChecksum,
    elapsedMs,
    heapUsedBeforeBytes,
    heapUsedAfterBytes,
    heapDeltaBytes: heapUsedAfterBytes - heapUsedBeforeBytes,
  };
}

export function reservationsInvariantsFromReport(
  report: ReservationsBenchmarkReport,
): ReservationsBenchmarkInvariants {
  return {
    ownerCount: report.ownerCount,
    itemTargetCount: report.itemTargetCount,
    capacityTargetCount: report.capacityTargetCount,
    transactionAttempts: report.transactionAttempts,
    acceptedTransactions: report.acceptedTransactions,
    rejectedTransactions: report.rejectedTransactions,
    releasedByCleanup: report.releasedByCleanup,
    finalActiveClaims: report.finalActiveClaims,
    conflictCount: report.conflictCount,
    itemQuantityReservationCount: report.itemQuantityReservationCount,
    capacityReservationCount: report.capacityReservationCount,
    transactionChecksum: report.transactionChecksum,
    cleanupChecksum: report.cleanupChecksum,
  };
}

function allocateMany(
  registry: ReturnType<typeof createEntityRegistry>,
  count: number,
): readonly EntityId[] {
  const entities: EntityId[] = [];

  for (let index = 0; index < count; index += 1) {
    const result = registry.allocate();

    if (!result.ok) {
      throw new Error(result.reason);
    }

    entities.push(result.entity);
  }

  return entities;
}

function failMissingEntity(): never {
  throw new Error("missing reservation benchmark entity");
}
