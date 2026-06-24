import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import type { LocationLifecycleHooks } from "./location-store";
import { isSafeTick, type Tick } from "./time";

export const RESERVATION_LEDGER_SNAPSHOT_VERSION = 1;

export const RESERVATION_ENTITY = 1;
export const RESERVATION_CELL = 2;
export const RESERVATION_ITEM_QUANTITY = 3;
export const RESERVATION_INTERACTION_SPOT = 4;
export const RESERVATION_CAPACITY = 5;

export type ReservationChannel =
  | "entity"
  | "cell"
  | "item_quantity"
  | "interaction_spot"
  | "capacity";

export type ReservationChannelCode =
  | typeof RESERVATION_ENTITY
  | typeof RESERVATION_CELL
  | typeof RESERVATION_ITEM_QUANTITY
  | typeof RESERVATION_INTERACTION_SPOT
  | typeof RESERVATION_CAPACITY;

export type ReservationReason =
  | "reservation_transaction_empty"
  | "reservation_ledger_capacity_exhausted"
  | "reservation_owner_index_out_of_range"
  | "reservation_owner_not_alive"
  | "reservation_owner_generation_mismatch"
  | "reservation_target_index_out_of_range"
  | "reservation_target_not_alive"
  | "reservation_target_generation_mismatch"
  | "reservation_job_id_invalid"
  | "reservation_created_tick_invalid"
  | "reservation_lease_expiry_invalid"
  | "reservation_amount_invalid"
  | "reservation_available_amount_invalid"
  | "reservation_capacity_invalid"
  | "reservation_cell_out_of_range"
  | "reservation_slot_out_of_range"
  | "reservation_entity_conflict"
  | "reservation_cell_conflict"
  | "reservation_interaction_conflict"
  | "reservation_item_quantity_conflict"
  | "reservation_capacity_conflict"
  | "reservation_duplicate_target"
  | "reservation_claim_id_invalid"
  | "reservation_claim_not_active"
  | "reservation_snapshot_version_unsupported";

export type ReservationAcquireResult =
  | {
      readonly ok: true;
      readonly claimIds: readonly number[];
      readonly version: number;
      readonly activeCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: ReservationReason;
      readonly claimIndex?: number;
      readonly conflictingClaimId?: number;
    };

export type ReservationReleaseResult =
  | {
      readonly ok: true;
      readonly releasedCount: number;
      readonly version: number;
      readonly activeCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: ReservationReason;
      readonly claimId?: number;
    };

export interface ReservationLedgerOptions {
  readonly capacity: number;
  readonly entityCapacity: number;
  readonly cellCount: number;
  readonly interactionSpotLimit?: number;
  readonly capacitySlotLimit?: number;
}

export interface ReservationTransactionRequest {
  readonly owner: EntityId;
  readonly jobId: number;
  readonly createdTick: Tick;
  readonly leaseExpiryTick: Tick;
  readonly claims: readonly ReservationClaimRequest[];
}

export type ReservationClaimRequest =
  | {
      readonly channel: "entity";
      readonly target: EntityId;
    }
  | {
      readonly channel: "cell";
      readonly cellIndex: number;
    }
  | {
      readonly channel: "item_quantity";
      readonly item: EntityId;
      readonly amount: number;
      readonly availableAmount: number;
    }
  | {
      readonly channel: "interaction_spot";
      readonly target: EntityId;
      readonly spotId: number;
    }
  | {
      readonly channel: "capacity";
      readonly target: EntityId;
      readonly capacityId: number;
      readonly amount: number;
      readonly capacity: number;
    };

export interface ReservationRecordSnapshot {
  readonly claimId: number;
  readonly channel: ReservationChannel;
  readonly owner: EntityId;
  readonly jobId: number;
  readonly amount: number;
  readonly createdTick: Tick;
  readonly leaseExpiryTick: Tick;
  readonly target?: EntityId;
  readonly cellIndex?: number;
  readonly slot?: number;
}

export interface ReservationLedgerSnapshot {
  readonly snapshotVersion: typeof RESERVATION_LEDGER_SNAPSHOT_VERSION;
  readonly capacity: number;
  readonly entityCapacity: number;
  readonly cellCount: number;
  readonly interactionSpotLimit: number;
  readonly capacitySlotLimit: number;
  readonly ledgerVersion: number;
  readonly activeCount: number;
  readonly records: readonly ReservationRecordSnapshot[];
}

export interface ReservationRecordView extends ReservationRecordSnapshot {
  readonly channelCode: ReservationChannelCode;
}

export interface ReservationLedgerMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly acquiredCount: number;
  readonly releasedCount: number;
  readonly conflictCount: number;
  readonly entityReservationCount: number;
  readonly cellReservationCount: number;
  readonly itemQuantityReservationCount: number;
  readonly interactionReservationCount: number;
  readonly capacityReservationCount: number;
}

type PreparedClaim =
  | {
      readonly channel: "entity";
      readonly channelCode: typeof RESERVATION_ENTITY;
      readonly key: number;
      readonly amount: 1;
      readonly target: EntityId;
      readonly slot: 0;
    }
  | {
      readonly channel: "cell";
      readonly channelCode: typeof RESERVATION_CELL;
      readonly key: number;
      readonly amount: 1;
      readonly cellIndex: number;
      readonly slot: 0;
    }
  | {
      readonly channel: "item_quantity";
      readonly channelCode: typeof RESERVATION_ITEM_QUANTITY;
      readonly key: number;
      readonly amount: number;
      readonly target: EntityId;
      readonly slot: 0;
      readonly limit: number;
    }
  | {
      readonly channel: "interaction_spot";
      readonly channelCode: typeof RESERVATION_INTERACTION_SPOT;
      readonly key: number;
      readonly amount: 1;
      readonly target: EntityId;
      readonly slot: number;
    }
  | {
      readonly channel: "capacity";
      readonly channelCode: typeof RESERVATION_CAPACITY;
      readonly key: number;
      readonly amount: number;
      readonly target: EntityId;
      readonly slot: number;
      readonly limit: number;
    };

type PrepareClaimResult =
  | {
      readonly ok: true;
      readonly claim: PreparedClaim;
    }
  | {
      readonly ok: false;
      readonly reason: ReservationReason;
      readonly conflictingClaimId?: number;
    };

export class ReservationLedger implements LocationLifecycleHooks {
  readonly capacity: number;
  readonly entityCapacity: number;
  readonly cellCount: number;
  readonly interactionSpotLimit: number;
  readonly capacitySlotLimit: number;

  private readonly active: Uint8Array;
  private readonly channelCode: Uint8Array;
  private readonly ownerIndex: Uint32Array;
  private readonly ownerGeneration: Uint32Array;
  private readonly targetIndex: Uint32Array;
  private readonly targetGeneration: Uint32Array;
  private readonly hasTarget: Uint8Array;
  private readonly jobId: Uint32Array;
  private readonly amount: Uint32Array;
  private readonly createdTick: Float64Array;
  private readonly leaseExpiryTick: Float64Array;
  private readonly key: Float64Array;
  private readonly slot: Uint32Array;
  private readonly ownerHead: Int32Array;
  private readonly ownerNext: Int32Array;
  private readonly ownerPrevious: Int32Array;
  private readonly targetHead: Int32Array;
  private readonly targetNext: Int32Array;
  private readonly targetPrevious: Int32Array;
  private readonly freeStack: Uint32Array;
  private readonly entityClaims = new Map<number, number>();
  private readonly cellClaims = new Map<number, number>();
  private readonly interactionClaims = new Map<number, number>();
  private readonly itemQuantityAmounts = new Map<number, number>();
  private readonly capacityAmounts = new Map<number, number>();

  private freeCount = 0;
  private nextClaimId = 0;
  private ledgerVersion = 0;
  private currentActiveCount = 0;
  private acquiredTotal = 0;
  private releasedTotal = 0;
  private conflictTotal = 0;
  private entityReservationCount = 0;
  private cellReservationCount = 0;
  private itemQuantityReservationCount = 0;
  private interactionReservationCount = 0;
  private capacityReservationCount = 0;

  constructor(options: ReservationLedgerOptions) {
    assertValidCapacity(options.capacity, "reservation ledger capacity");
    assertValidCapacity(options.entityCapacity, "reservation entity capacity");
    this.cellCount = requirePositiveSafeInteger(options.cellCount, "reservation cell count");
    this.interactionSpotLimit = requirePositiveSafeInteger(
      options.interactionSpotLimit ?? 65_536,
      "reservation interaction spot limit",
    );
    this.capacitySlotLimit = requirePositiveSafeInteger(
      options.capacitySlotLimit ?? 65_536,
      "reservation capacity slot limit",
    );
    this.capacity = options.capacity;
    this.entityCapacity = options.entityCapacity;
    this.active = new Uint8Array(options.capacity);
    this.channelCode = new Uint8Array(options.capacity);
    this.ownerIndex = new Uint32Array(options.capacity);
    this.ownerGeneration = new Uint32Array(options.capacity);
    this.targetIndex = new Uint32Array(options.capacity);
    this.targetGeneration = new Uint32Array(options.capacity);
    this.hasTarget = new Uint8Array(options.capacity);
    this.jobId = new Uint32Array(options.capacity);
    this.amount = new Uint32Array(options.capacity);
    this.createdTick = new Float64Array(options.capacity);
    this.leaseExpiryTick = new Float64Array(options.capacity);
    this.key = new Float64Array(options.capacity);
    this.slot = new Uint32Array(options.capacity);
    this.ownerHead = new Int32Array(options.entityCapacity);
    this.ownerNext = new Int32Array(options.capacity);
    this.ownerPrevious = new Int32Array(options.capacity);
    this.targetHead = new Int32Array(options.entityCapacity);
    this.targetNext = new Int32Array(options.capacity);
    this.targetPrevious = new Int32Array(options.capacity);
    this.freeStack = new Uint32Array(options.capacity);
    this.ownerHead.fill(-1);
    this.ownerNext.fill(-1);
    this.ownerPrevious.fill(-1);
    this.targetHead.fill(-1);
    this.targetNext.fill(-1);
    this.targetPrevious.fill(-1);
  }

  get version(): number {
    return this.ledgerVersion;
  }

  get activeCount(): number {
    return this.currentActiveCount;
  }

  acquire(
    request: ReservationTransactionRequest,
    registry: EntityRegistry,
  ): ReservationAcquireResult {
    const validation = this.validateTransactionHeader(request, registry);

    if (!validation.ok) {
      this.conflictTotal += 1;
      return validation;
    }

    const prepared: PreparedClaim[] = [];

    for (let index = 0; index < request.claims.length; index += 1) {
      const claimRequest = request.claims[index];

      if (claimRequest === undefined) {
        this.conflictTotal += 1;
        return { ok: false, reason: "reservation_transaction_empty" };
      }

      const preparedClaim = this.prepareClaim(claimRequest, registry);

      if (!preparedClaim.ok) {
        this.conflictTotal += 1;
        const failure: ReservationAcquireResult = {
          ok: false,
          reason: preparedClaim.reason,
          claimIndex: index,
        };

        if (preparedClaim.conflictingClaimId !== undefined) {
          return { ...failure, conflictingClaimId: preparedClaim.conflictingClaimId };
        }

        return failure;
      }

      const pendingValidation = this.validateAgainstPending(preparedClaim.claim, prepared);

      if (!pendingValidation.ok) {
        this.conflictTotal += 1;
        const failure: ReservationAcquireResult = {
          ok: false,
          reason: pendingValidation.reason,
          claimIndex: index,
        };

        if (pendingValidation.conflictingClaimId !== undefined) {
          return { ...failure, conflictingClaimId: pendingValidation.conflictingClaimId };
        }

        return failure;
      }

      prepared.push(preparedClaim.claim);
    }

    if (this.currentActiveCount + prepared.length > this.capacity) {
      this.conflictTotal += 1;
      return { ok: false, reason: "reservation_ledger_capacity_exhausted" };
    }

    const claimIds: number[] = [];

    for (const claim of prepared) {
      const claimId = this.allocateClaimId();
      this.writePreparedClaim(claimId, request, claim);
      claimIds.push(claimId);
    }

    this.ledgerVersion += 1;
    this.acquiredTotal += claimIds.length;

    return {
      ok: true,
      claimIds,
      version: this.ledgerVersion,
      activeCount: this.currentActiveCount,
    };
  }

  releaseClaims(claimIds: readonly number[]): ReservationReleaseResult {
    for (const claimId of claimIds) {
      if (!this.isValidClaimId(claimId)) {
        return { ok: false, reason: "reservation_claim_id_invalid", claimId };
      }

      if ((this.active[claimId] ?? 0) !== 1) {
        return { ok: false, reason: "reservation_claim_not_active", claimId };
      }
    }

    let releasedCount = 0;

    for (const claimId of claimIds) {
      if (this.releaseClaimNoVersion(claimId)) {
        releasedCount += 1;
      }
    }

    return this.finishRelease(releasedCount);
  }

  releaseReservationsForEntity(entity: EntityId): number {
    if (!this.isEntityIndexInRange(entity.index)) {
      return 0;
    }

    let releasedCount = 0;
    let claimId = this.ownerHead[entity.index] ?? -1;

    while (claimId >= 0) {
      const next = this.ownerNext[claimId] ?? -1;

      if (this.isOwner(claimId, entity) && this.releaseClaimNoVersion(claimId)) {
        releasedCount += 1;
      }

      claimId = next;
    }

    claimId = this.targetHead[entity.index] ?? -1;

    while (claimId >= 0) {
      const next = this.targetNext[claimId] ?? -1;

      if (this.isTarget(claimId, entity) && this.releaseClaimNoVersion(claimId)) {
        releasedCount += 1;
      }

      claimId = next;
    }

    if (releasedCount > 0) {
      this.ledgerVersion += 1;
      this.releasedTotal += releasedCount;
    }

    return releasedCount;
  }

  releaseReservationsForOwnerJob(owner: EntityId, jobId: number): ReservationReleaseResult {
    if (!this.isEntityIndexInRange(owner.index) || !isSafeUint32(jobId)) {
      return { ok: false, reason: "reservation_job_id_invalid" };
    }

    let releasedCount = 0;
    let claimId = this.ownerHead[owner.index] ?? -1;

    while (claimId >= 0) {
      const next = this.ownerNext[claimId] ?? -1;

      if (this.isOwner(claimId, owner) && (this.jobId[claimId] ?? 0) === jobId) {
        if (this.releaseClaimNoVersion(claimId)) {
          releasedCount += 1;
        }
      }

      claimId = next;
    }

    return this.finishRelease(releasedCount);
  }

  readRecord(claimId: number): ReservationRecordView | undefined {
    if (!this.isValidClaimId(claimId) || (this.active[claimId] ?? 0) !== 1) {
      return undefined;
    }

    return this.createRecordView(claimId);
  }

  reservedAmountForItem(item: EntityId): number {
    return this.itemQuantityAmounts.get(item.index) ?? 0;
  }

  reservedAmountForCapacity(target: EntityId, capacityId: number): number {
    const key = this.encodeSlotKey(target.index, capacityId, this.capacitySlotLimit);

    if (key < 0) {
      return 0;
    }

    return this.capacityAmounts.get(key) ?? 0;
  }

  createMetrics(): ReservationLedgerMetrics {
    return {
      version: this.ledgerVersion,
      activeCount: this.currentActiveCount,
      acquiredCount: this.acquiredTotal,
      releasedCount: this.releasedTotal,
      conflictCount: this.conflictTotal,
      entityReservationCount: this.entityReservationCount,
      cellReservationCount: this.cellReservationCount,
      itemQuantityReservationCount: this.itemQuantityReservationCount,
      interactionReservationCount: this.interactionReservationCount,
      capacityReservationCount: this.capacityReservationCount,
    };
  }

  createSnapshot(): ReservationLedgerSnapshot {
    const records: ReservationRecordSnapshot[] = [];

    for (let claimId = 0; claimId < this.nextClaimId; claimId += 1) {
      if ((this.active[claimId] ?? 0) === 1) {
        records.push(this.createRecordSnapshot(claimId));
      }
    }

    return {
      snapshotVersion: RESERVATION_LEDGER_SNAPSHOT_VERSION,
      capacity: this.capacity,
      entityCapacity: this.entityCapacity,
      cellCount: this.cellCount,
      interactionSpotLimit: this.interactionSpotLimit,
      capacitySlotLimit: this.capacitySlotLimit,
      ledgerVersion: this.ledgerVersion,
      activeCount: this.currentActiveCount,
      records,
    };
  }

  restoreFromSnapshot(
    snapshot: ReservationLedgerSnapshot,
    registry?: EntityRegistry,
  ): ReservationReleaseResult {
    this.clearAllState();

    for (const record of snapshot.records) {
      const restored = this.restoreRecord(record, registry);

      if (!restored.ok) {
        this.clearAllState();
        return restored;
      }
    }

    this.rebuildFreeStack();
    this.ledgerVersion = snapshot.ledgerVersion;

    return {
      ok: true,
      releasedCount: 0,
      version: this.ledgerVersion,
      activeCount: this.currentActiveCount,
    };
  }

  private validateTransactionHeader(
    request: ReservationTransactionRequest,
    registry: EntityRegistry,
  ): ReservationAcquireResult {
    const ownerValidation = validateEntityHandle(
      request.owner,
      registry,
      "owner",
      this.entityCapacity,
    );

    if (!ownerValidation.ok) {
      return { ok: false, reason: ownerValidation.reason };
    }

    if (!isSafeUint32(request.jobId)) {
      return { ok: false, reason: "reservation_job_id_invalid" };
    }

    if (!isSafeTick(request.createdTick)) {
      return { ok: false, reason: "reservation_created_tick_invalid" };
    }

    if (!isSafeTick(request.leaseExpiryTick) || request.leaseExpiryTick < request.createdTick) {
      return { ok: false, reason: "reservation_lease_expiry_invalid" };
    }

    if (request.claims.length === 0) {
      return { ok: false, reason: "reservation_transaction_empty" };
    }

    return {
      ok: true,
      claimIds: [],
      version: this.ledgerVersion,
      activeCount: this.currentActiveCount,
    };
  }

  private prepareClaim(
    request: ReservationClaimRequest,
    registry: EntityRegistry,
  ): PrepareClaimResult {
    if (request.channel === "entity") {
      const target = this.validateTarget(request.target, registry);

      if (!target.ok) {
        return target;
      }

      const conflictingClaimId = this.entityClaims.get(request.target.index);

      if (conflictingClaimId !== undefined) {
        return { ok: false, reason: "reservation_entity_conflict", conflictingClaimId };
      }

      return {
        ok: true,
        claim: {
          channel: "entity",
          channelCode: RESERVATION_ENTITY,
          key: request.target.index,
          amount: 1,
          target: request.target,
          slot: 0,
        },
      };
    }

    if (request.channel === "cell") {
      if (!isIndexInRange(request.cellIndex, this.cellCount)) {
        return { ok: false, reason: "reservation_cell_out_of_range" };
      }

      const conflictingClaimId = this.cellClaims.get(request.cellIndex);

      if (conflictingClaimId !== undefined) {
        return { ok: false, reason: "reservation_cell_conflict", conflictingClaimId };
      }

      return {
        ok: true,
        claim: {
          channel: "cell",
          channelCode: RESERVATION_CELL,
          key: request.cellIndex,
          amount: 1,
          cellIndex: request.cellIndex,
          slot: 0,
        },
      };
    }

    if (request.channel === "item_quantity") {
      const target = this.validateTarget(request.item, registry);

      if (!target.ok) {
        return target;
      }

      if (!isPositiveUint32(request.amount)) {
        return { ok: false, reason: "reservation_amount_invalid" };
      }

      if (!isSafeUint32(request.availableAmount)) {
        return { ok: false, reason: "reservation_available_amount_invalid" };
      }

      const existingAmount = this.itemQuantityAmounts.get(request.item.index) ?? 0;

      if (existingAmount + request.amount > request.availableAmount) {
        return { ok: false, reason: "reservation_item_quantity_conflict" };
      }

      return {
        ok: true,
        claim: {
          channel: "item_quantity",
          channelCode: RESERVATION_ITEM_QUANTITY,
          key: request.item.index,
          amount: request.amount,
          target: request.item,
          slot: 0,
          limit: request.availableAmount,
        },
      };
    }

    if (request.channel === "interaction_spot") {
      const target = this.validateTarget(request.target, registry);

      if (!target.ok) {
        return target;
      }

      const key = this.encodeSlotKey(
        request.target.index,
        request.spotId,
        this.interactionSpotLimit,
      );

      if (key < 0) {
        return { ok: false, reason: "reservation_slot_out_of_range" };
      }

      const conflictingClaimId = this.interactionClaims.get(key);

      if (conflictingClaimId !== undefined) {
        return { ok: false, reason: "reservation_interaction_conflict", conflictingClaimId };
      }

      return {
        ok: true,
        claim: {
          channel: "interaction_spot",
          channelCode: RESERVATION_INTERACTION_SPOT,
          key,
          amount: 1,
          target: request.target,
          slot: request.spotId,
        },
      };
    }

    const target = this.validateTarget(request.target, registry);

    if (!target.ok) {
      return target;
    }

    if (!isPositiveUint32(request.amount)) {
      return { ok: false, reason: "reservation_amount_invalid" };
    }

    if (!isPositiveUint32(request.capacity)) {
      return { ok: false, reason: "reservation_capacity_invalid" };
    }

    const key = this.encodeSlotKey(
      request.target.index,
      request.capacityId,
      this.capacitySlotLimit,
    );

    if (key < 0) {
      return { ok: false, reason: "reservation_slot_out_of_range" };
    }

    const existingAmount = this.capacityAmounts.get(key) ?? 0;

    if (existingAmount + request.amount > request.capacity) {
      return { ok: false, reason: "reservation_capacity_conflict" };
    }

    return {
      ok: true,
      claim: {
        channel: "capacity",
        channelCode: RESERVATION_CAPACITY,
        key,
        amount: request.amount,
        target: request.target,
        slot: request.capacityId,
        limit: request.capacity,
      },
    };
  }

  private validateAgainstPending(
    claim: PreparedClaim,
    prepared: readonly PreparedClaim[],
  ): PrepareClaimResult {
    if (
      claim.channel === "entity" ||
      claim.channel === "cell" ||
      claim.channel === "interaction_spot"
    ) {
      for (const pending of prepared) {
        if (pending.channelCode === claim.channelCode && pending.key === claim.key) {
          return { ok: false, reason: "reservation_duplicate_target" };
        }
      }

      return { ok: true, claim };
    }

    let pendingAmount = 0;

    for (const pending of prepared) {
      if (pending.channelCode === claim.channelCode && pending.key === claim.key) {
        pendingAmount += pending.amount;
      }
    }

    if (pendingAmount + claim.amount > claim.limit) {
      return {
        ok: false,
        reason:
          claim.channel === "item_quantity"
            ? "reservation_item_quantity_conflict"
            : "reservation_capacity_conflict",
      };
    }

    return { ok: true, claim };
  }

  private validateTarget(target: EntityId, registry: EntityRegistry): PrepareClaimResult {
    const targetValidation = validateEntityHandle(target, registry, "target", this.entityCapacity);

    if (!targetValidation.ok) {
      return targetValidation;
    }

    return {
      ok: true,
      claim: {
        channel: "entity",
        channelCode: RESERVATION_ENTITY,
        key: target.index,
        amount: 1,
        target,
        slot: 0,
      },
    };
  }

  private writePreparedClaim(
    claimId: number,
    request: ReservationTransactionRequest,
    claim: PreparedClaim,
  ): void {
    this.active[claimId] = 1;
    this.channelCode[claimId] = claim.channelCode;
    this.ownerIndex[claimId] = request.owner.index;
    this.ownerGeneration[claimId] = request.owner.generation;
    this.jobId[claimId] = request.jobId;
    this.amount[claimId] = claim.amount;
    this.createdTick[claimId] = request.createdTick;
    this.leaseExpiryTick[claimId] = request.leaseExpiryTick;
    this.key[claimId] = claim.key;
    this.slot[claimId] = claim.slot;

    if ("target" in claim) {
      this.hasTarget[claimId] = 1;
      this.targetIndex[claimId] = claim.target.index;
      this.targetGeneration[claimId] = claim.target.generation;
      this.linkTarget(claimId, claim.target.index);
    } else {
      this.hasTarget[claimId] = 0;
      this.targetIndex[claimId] = 0;
      this.targetGeneration[claimId] = 0;
    }

    this.linkOwner(claimId, request.owner.index);
    this.addToTargetIndex(claimId, claim);
    this.currentActiveCount += 1;
    this.incrementChannelCount(claim.channelCode, 1);
  }

  private restoreRecord(
    record: ReservationRecordSnapshot,
    registry: EntityRegistry | undefined,
  ): ReservationReleaseResult {
    if (!this.isValidClaimId(record.claimId) || (this.active[record.claimId] ?? 0) === 1) {
      return { ok: false, reason: "reservation_claim_id_invalid", claimId: record.claimId };
    }

    if (!isSafeUint32(record.jobId)) {
      return { ok: false, reason: "reservation_job_id_invalid" };
    }

    if (!isPositiveUint32(record.amount)) {
      return { ok: false, reason: "reservation_amount_invalid" };
    }

    if (!isSafeTick(record.createdTick) || !isSafeTick(record.leaseExpiryTick)) {
      return { ok: false, reason: "reservation_created_tick_invalid" };
    }

    if (record.leaseExpiryTick < record.createdTick) {
      return { ok: false, reason: "reservation_lease_expiry_invalid" };
    }

    const owner = validateEntityShape(record.owner, "owner", this.entityCapacity, registry);

    if (!owner.ok) {
      return { ok: false, reason: owner.reason };
    }

    const prepared = this.prepareSnapshotRecord(record, registry);

    if (!prepared.ok) {
      return { ok: false, reason: prepared.reason };
    }

    this.writePreparedClaim(
      record.claimId,
      {
        owner: record.owner,
        jobId: record.jobId,
        createdTick: record.createdTick,
        leaseExpiryTick: record.leaseExpiryTick,
        claims: [],
      },
      prepared.claim,
    );
    this.nextClaimId = Math.max(this.nextClaimId, record.claimId + 1);

    return {
      ok: true,
      releasedCount: 0,
      version: this.ledgerVersion,
      activeCount: this.currentActiveCount,
    };
  }

  private prepareSnapshotRecord(
    record: ReservationRecordSnapshot,
    registry: EntityRegistry | undefined,
  ): PrepareClaimResult {
    if (record.channel === "cell") {
      if (record.cellIndex === undefined || !isIndexInRange(record.cellIndex, this.cellCount)) {
        return { ok: false, reason: "reservation_cell_out_of_range" };
      }

      if (this.cellClaims.has(record.cellIndex)) {
        return { ok: false, reason: "reservation_cell_conflict" };
      }

      return {
        ok: true,
        claim: {
          channel: "cell",
          channelCode: RESERVATION_CELL,
          key: record.cellIndex,
          amount: 1,
          cellIndex: record.cellIndex,
          slot: 0,
        },
      };
    }

    if (record.target === undefined) {
      return { ok: false, reason: "reservation_target_index_out_of_range" };
    }

    const target = validateEntityShape(record.target, "target", this.entityCapacity, registry);

    if (!target.ok) {
      return { ok: false, reason: target.reason };
    }

    if (record.channel === "entity") {
      if (this.entityClaims.has(record.target.index)) {
        return { ok: false, reason: "reservation_entity_conflict" };
      }

      return {
        ok: true,
        claim: {
          channel: "entity",
          channelCode: RESERVATION_ENTITY,
          key: record.target.index,
          amount: 1,
          target: record.target,
          slot: 0,
        },
      };
    }

    if (record.channel === "item_quantity") {
      return {
        ok: true,
        claim: {
          channel: "item_quantity",
          channelCode: RESERVATION_ITEM_QUANTITY,
          key: record.target.index,
          amount: record.amount,
          target: record.target,
          slot: 0,
          limit: Number.MAX_SAFE_INTEGER,
        },
      };
    }

    if (record.slot === undefined) {
      return { ok: false, reason: "reservation_slot_out_of_range" };
    }

    if (record.channel === "interaction_spot") {
      const key = this.encodeSlotKey(record.target.index, record.slot, this.interactionSpotLimit);

      if (key < 0) {
        return { ok: false, reason: "reservation_slot_out_of_range" };
      }

      if (this.interactionClaims.has(key)) {
        return { ok: false, reason: "reservation_interaction_conflict" };
      }

      return {
        ok: true,
        claim: {
          channel: "interaction_spot",
          channelCode: RESERVATION_INTERACTION_SPOT,
          key,
          amount: 1,
          target: record.target,
          slot: record.slot,
        },
      };
    }

    const key = this.encodeSlotKey(record.target.index, record.slot, this.capacitySlotLimit);

    if (key < 0) {
      return { ok: false, reason: "reservation_slot_out_of_range" };
    }

    return {
      ok: true,
      claim: {
        channel: "capacity",
        channelCode: RESERVATION_CAPACITY,
        key,
        amount: record.amount,
        target: record.target,
        slot: record.slot,
        limit: Number.MAX_SAFE_INTEGER,
      },
    };
  }

  private addToTargetIndex(claimId: number, claim: PreparedClaim): void {
    if (claim.channel === "entity") {
      this.entityClaims.set(claim.key, claimId);
      return;
    }

    if (claim.channel === "cell") {
      this.cellClaims.set(claim.key, claimId);
      return;
    }

    if (claim.channel === "interaction_spot") {
      this.interactionClaims.set(claim.key, claimId);
      return;
    }

    if (claim.channel === "item_quantity") {
      this.itemQuantityAmounts.set(
        claim.key,
        (this.itemQuantityAmounts.get(claim.key) ?? 0) + claim.amount,
      );
      return;
    }

    this.capacityAmounts.set(claim.key, (this.capacityAmounts.get(claim.key) ?? 0) + claim.amount);
  }

  private releaseClaimNoVersion(claimId: number): boolean {
    if (!this.isValidClaimId(claimId) || (this.active[claimId] ?? 0) !== 1) {
      return false;
    }

    const code = this.readChannelCode(claimId);
    const key = this.key[claimId] ?? 0;
    const amount = this.amount[claimId] ?? 0;

    if (code === RESERVATION_ENTITY) {
      if (this.entityClaims.get(key) === claimId) {
        this.entityClaims.delete(key);
      }
    } else if (code === RESERVATION_CELL) {
      if (this.cellClaims.get(key) === claimId) {
        this.cellClaims.delete(key);
      }
    } else if (code === RESERVATION_INTERACTION_SPOT) {
      if (this.interactionClaims.get(key) === claimId) {
        this.interactionClaims.delete(key);
      }
    } else if (code === RESERVATION_ITEM_QUANTITY) {
      decrementAmountIndex(this.itemQuantityAmounts, key, amount);
    } else {
      decrementAmountIndex(this.capacityAmounts, key, amount);
    }

    this.unlinkOwner(claimId);
    this.unlinkTarget(claimId);
    this.active[claimId] = 0;
    this.channelCode[claimId] = 0;
    this.hasTarget[claimId] = 0;
    this.ownerNext[claimId] = -1;
    this.ownerPrevious[claimId] = -1;
    this.targetNext[claimId] = -1;
    this.targetPrevious[claimId] = -1;
    this.freeStack[this.freeCount] = claimId;
    this.freeCount += 1;
    this.currentActiveCount -= 1;
    this.incrementChannelCount(code, -1);
    return true;
  }

  private finishRelease(releasedCount: number): ReservationReleaseResult {
    if (releasedCount > 0) {
      this.ledgerVersion += 1;
      this.releasedTotal += releasedCount;
    }

    return {
      ok: true,
      releasedCount,
      version: this.ledgerVersion,
      activeCount: this.currentActiveCount,
    };
  }

  private allocateClaimId(): number {
    if (this.freeCount > 0) {
      this.freeCount -= 1;
      return this.freeStack[this.freeCount] ?? failInternal("missing free claim id");
    }

    if (this.nextClaimId >= this.capacity) {
      failInternal("reservation ledger capacity exhausted after validation");
    }

    const claimId = this.nextClaimId;
    this.nextClaimId += 1;
    return claimId;
  }

  private linkOwner(claimId: number, ownerIndex: number): void {
    const previousHead = this.ownerHead[ownerIndex] ?? -1;
    this.ownerNext[claimId] = previousHead;
    this.ownerPrevious[claimId] = -1;

    if (previousHead >= 0) {
      this.ownerPrevious[previousHead] = claimId;
    }

    this.ownerHead[ownerIndex] = claimId;
  }

  private linkTarget(claimId: number, targetIndex: number): void {
    const previousHead = this.targetHead[targetIndex] ?? -1;
    this.targetNext[claimId] = previousHead;
    this.targetPrevious[claimId] = -1;

    if (previousHead >= 0) {
      this.targetPrevious[previousHead] = claimId;
    }

    this.targetHead[targetIndex] = claimId;
  }

  private unlinkOwner(claimId: number): void {
    const ownerIndex = this.ownerIndex[claimId] ?? 0;
    const previous = this.ownerPrevious[claimId] ?? -1;
    const next = this.ownerNext[claimId] ?? -1;

    if (previous >= 0) {
      this.ownerNext[previous] = next;
    } else if (this.ownerHead[ownerIndex] === claimId) {
      this.ownerHead[ownerIndex] = next;
    }

    if (next >= 0) {
      this.ownerPrevious[next] = previous;
    }
  }

  private unlinkTarget(claimId: number): void {
    if ((this.hasTarget[claimId] ?? 0) !== 1) {
      return;
    }

    const targetIndex = this.targetIndex[claimId] ?? 0;
    const previous = this.targetPrevious[claimId] ?? -1;
    const next = this.targetNext[claimId] ?? -1;

    if (previous >= 0) {
      this.targetNext[previous] = next;
    } else if (this.targetHead[targetIndex] === claimId) {
      this.targetHead[targetIndex] = next;
    }

    if (next >= 0) {
      this.targetPrevious[next] = previous;
    }
  }

  private isOwner(claimId: number, entity: EntityId): boolean {
    return (
      (this.active[claimId] ?? 0) === 1 &&
      (this.ownerIndex[claimId] ?? 0) === entity.index &&
      (this.ownerGeneration[claimId] ?? 0) === entity.generation
    );
  }

  private isTarget(claimId: number, entity: EntityId): boolean {
    return (
      (this.active[claimId] ?? 0) === 1 &&
      (this.hasTarget[claimId] ?? 0) === 1 &&
      (this.targetIndex[claimId] ?? 0) === entity.index &&
      (this.targetGeneration[claimId] ?? 0) === entity.generation
    );
  }

  private createRecordSnapshot(claimId: number): ReservationRecordSnapshot {
    const base = {
      claimId,
      channel: this.readChannel(claimId),
      owner: {
        index: this.ownerIndex[claimId] ?? 0,
        generation: this.ownerGeneration[claimId] ?? 0,
      },
      jobId: this.jobId[claimId] ?? 0,
      amount: this.amount[claimId] ?? 0,
      createdTick: this.createdTick[claimId] ?? 0,
      leaseExpiryTick: this.leaseExpiryTick[claimId] ?? 0,
    };
    const code = this.readChannelCode(claimId);

    if (code === RESERVATION_CELL) {
      return {
        ...base,
        channel: "cell",
        cellIndex: this.key[claimId] ?? 0,
      };
    }

    const target = {
      index: this.targetIndex[claimId] ?? 0,
      generation: this.targetGeneration[claimId] ?? 0,
    };

    if (code === RESERVATION_ENTITY) {
      return {
        ...base,
        channel: "entity",
        target,
      };
    }

    if (code === RESERVATION_ITEM_QUANTITY) {
      return {
        ...base,
        channel: "item_quantity",
        target,
      };
    }

    if (code === RESERVATION_INTERACTION_SPOT) {
      return {
        ...base,
        channel: "interaction_spot",
        target,
        slot: this.slot[claimId] ?? 0,
      };
    }

    return {
      ...base,
      channel: "capacity",
      target,
      slot: this.slot[claimId] ?? 0,
    };
  }

  private createRecordView(claimId: number): ReservationRecordView {
    return {
      ...this.createRecordSnapshot(claimId),
      channelCode: this.readChannelCode(claimId),
    };
  }

  private readChannelCode(claimId: number): ReservationChannelCode {
    const code = this.channelCode[claimId] ?? 0;

    if (code === RESERVATION_ENTITY) {
      return RESERVATION_ENTITY;
    }

    if (code === RESERVATION_CELL) {
      return RESERVATION_CELL;
    }

    if (code === RESERVATION_ITEM_QUANTITY) {
      return RESERVATION_ITEM_QUANTITY;
    }

    if (code === RESERVATION_INTERACTION_SPOT) {
      return RESERVATION_INTERACTION_SPOT;
    }

    return RESERVATION_CAPACITY;
  }

  private readChannel(claimId: number): ReservationChannel {
    return channelNameFromCode(this.readChannelCode(claimId));
  }

  private encodeSlotKey(targetIndex: number, slot: number, slotLimit: number): number {
    if (!isIndexInRange(targetIndex, this.entityCapacity) || !isIndexInRange(slot, slotLimit)) {
      return -1;
    }

    const key = targetIndex * slotLimit + slot;
    return Number.isSafeInteger(key) ? key : -1;
  }

  private isValidClaimId(claimId: number): boolean {
    return isIndexInRange(claimId, this.capacity);
  }

  private isEntityIndexInRange(index: number): boolean {
    return isIndexInRange(index, this.entityCapacity);
  }

  private incrementChannelCount(code: ReservationChannelCode, delta: 1 | -1): void {
    if (code === RESERVATION_ENTITY) {
      this.entityReservationCount += delta;
    } else if (code === RESERVATION_CELL) {
      this.cellReservationCount += delta;
    } else if (code === RESERVATION_ITEM_QUANTITY) {
      this.itemQuantityReservationCount += delta;
    } else if (code === RESERVATION_INTERACTION_SPOT) {
      this.interactionReservationCount += delta;
    } else {
      this.capacityReservationCount += delta;
    }
  }

  private clearAllState(): void {
    this.active.fill(0);
    this.channelCode.fill(0);
    this.hasTarget.fill(0);
    this.ownerHead.fill(-1);
    this.ownerNext.fill(-1);
    this.ownerPrevious.fill(-1);
    this.targetHead.fill(-1);
    this.targetNext.fill(-1);
    this.targetPrevious.fill(-1);
    this.entityClaims.clear();
    this.cellClaims.clear();
    this.interactionClaims.clear();
    this.itemQuantityAmounts.clear();
    this.capacityAmounts.clear();
    this.freeCount = 0;
    this.nextClaimId = 0;
    this.currentActiveCount = 0;
    this.entityReservationCount = 0;
    this.cellReservationCount = 0;
    this.itemQuantityReservationCount = 0;
    this.interactionReservationCount = 0;
    this.capacityReservationCount = 0;
  }

  private rebuildFreeStack(): void {
    this.freeCount = 0;

    for (let claimId = this.nextClaimId - 1; claimId >= 0; claimId -= 1) {
      if ((this.active[claimId] ?? 0) !== 1) {
        this.freeStack[this.freeCount] = claimId;
        this.freeCount += 1;
      }
    }
  }
}

export function createReservationLedger(options: ReservationLedgerOptions): ReservationLedger {
  return new ReservationLedger(options);
}

export function restoreReservationLedger(
  snapshot: ReservationLedgerSnapshot,
  registry?: EntityRegistry,
): ReservationLedger {
  const ledger = createReservationLedger({
    capacity: snapshot.capacity,
    entityCapacity: snapshot.entityCapacity,
    cellCount: snapshot.cellCount,
    interactionSpotLimit: snapshot.interactionSpotLimit,
    capacitySlotLimit: snapshot.capacitySlotLimit,
  });
  const restored = ledger.restoreFromSnapshot(snapshot, registry);

  if (!restored.ok) {
    throw new Error(restored.reason);
  }

  return ledger;
}

function validateEntityHandle(
  entity: EntityId,
  registry: EntityRegistry,
  role: "owner" | "target",
  capacity: number,
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: ReservationReason;
    } {
  const shape = validateEntityShape(entity, role, capacity, registry);

  if (!shape.ok) {
    return shape;
  }

  return { ok: true };
}

function validateEntityShape(
  entity: EntityId,
  role: "owner" | "target",
  capacity: number,
  registry?: EntityRegistry,
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: ReservationReason;
    } {
  if (!isIndexInRange(entity.index, capacity)) {
    return {
      ok: false,
      reason:
        role === "owner"
          ? "reservation_owner_index_out_of_range"
          : "reservation_target_index_out_of_range",
    };
  }

  if (!isSafeUint32(entity.generation)) {
    return {
      ok: false,
      reason:
        role === "owner"
          ? "reservation_owner_generation_mismatch"
          : "reservation_target_generation_mismatch",
    };
  }

  if (registry === undefined) {
    return { ok: true };
  }

  const validation = registry.validate(entity);

  if (validation.ok) {
    return { ok: true };
  }

  if (validation.reason === "entity_generation_mismatch") {
    return {
      ok: false,
      reason:
        role === "owner"
          ? "reservation_owner_generation_mismatch"
          : "reservation_target_generation_mismatch",
    };
  }

  return {
    ok: false,
    reason: role === "owner" ? "reservation_owner_not_alive" : "reservation_target_not_alive",
  };
}

function decrementAmountIndex(index: Map<number, number>, key: number, amount: number): void {
  const nextAmount = (index.get(key) ?? 0) - amount;

  if (nextAmount <= 0) {
    index.delete(key);
  } else {
    index.set(key, nextAmount);
  }
}

function channelNameFromCode(code: ReservationChannelCode): ReservationChannel {
  if (code === RESERVATION_ENTITY) {
    return "entity";
  }

  if (code === RESERVATION_CELL) {
    return "cell";
  }

  if (code === RESERVATION_ITEM_QUANTITY) {
    return "item_quantity";
  }

  if (code === RESERVATION_INTERACTION_SPOT) {
    return "interaction_spot";
  }

  return "capacity";
}

function requirePositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}

function isSafeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function failInternal(message: string): never {
  throw new Error(message);
}
