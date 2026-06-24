import { assertValidCapacity, type EntityId, type EntityRegistry } from "./entity-id";
import { JOB_NONE, type JobCoreStore } from "./job-core";
import type { ItemStackStore } from "./item-stack-store";
import type { ReservationLedger, ReservationReason } from "./reservation-ledger";
import type { StorageLogisticsIndex } from "./storage-logistics-index";

export const HAULING_JOB_KIND = 1;

const HAUL_STEP_UNASSIGNED = 0;
const HAUL_STEP_CREATED = 1;
const HAUL_STEP_RESERVED = 2;
const HAUL_STEP_PICKED_UP = 3;
const HAUL_STEP_DELIVERED = 4;
const HAUL_STEP_CANCELED = 5;

export type HaulingStep = "unassigned" | "created" | "reserved" | "picked_up" | "delivered" | "canceled";

export type HaulingReason =
  | "hauling_job_id_out_of_range"
  | "hauling_job_already_active"
  | "hauling_job_not_active"
  | "hauling_owner_invalid"
  | "hauling_slot_invalid"
  | "hauling_amount_invalid"
  | "hauling_source_unavailable"
  | "hauling_destination_unavailable"
  | "hauling_def_mismatch"
  | "hauling_step_invalid"
  | "hauling_item_mutation_failed"
  | "hauling_job_core_failed"
  | ReservationReason;

export type HaulingMutationResult =
  | { readonly ok: true; readonly jobId: number; readonly version: number }
  | { readonly ok: false; readonly reason: HaulingReason };

export interface HaulingJobCreateInput {
  readonly jobId: number;
  readonly owner: EntityId;
  readonly sourceSlotId: number;
  readonly destinationSlotId: number;
  readonly amount: number;
  readonly createdTick: number;
}

export interface HaulingJobView extends HaulingJobCreateInput {
  readonly step: HaulingStep;
  readonly carriedDefId: number;
  readonly carriedAmount: number;
}

export interface HaulingMetrics {
  readonly version: number;
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly pickedUpCount: number;
  readonly deliveredCount: number;
  readonly canceledCount: number;
}

export class HaulingJobStore {
  readonly capacity: number;

  private readonly active: Uint8Array;
  private readonly ownerIndexes: Uint32Array;
  private readonly ownerGenerations: Uint32Array;
  private readonly sourceSlotIds: Uint32Array;
  private readonly destinationSlotIds: Uint32Array;
  private readonly amounts: Uint32Array;
  private readonly createdTicks: Uint32Array;
  private readonly stepCodes: Uint8Array;
  private readonly carriedDefIds: Uint32Array;
  private readonly carriedAmounts: Uint32Array;
  private activeCount = 0;
  private storeVersion = 0;

  constructor(capacity: number) {
    assertValidCapacity(capacity, "hauling job capacity");
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.ownerIndexes = new Uint32Array(capacity);
    this.ownerGenerations = new Uint32Array(capacity);
    this.sourceSlotIds = new Uint32Array(capacity);
    this.destinationSlotIds = new Uint32Array(capacity);
    this.amounts = new Uint32Array(capacity);
    this.createdTicks = new Uint32Array(capacity);
    this.stepCodes = new Uint8Array(capacity);
    this.carriedDefIds = new Uint32Array(capacity);
    this.carriedAmounts = new Uint32Array(capacity);
    this.carriedDefIds.fill(JOB_NONE);
  }

  createJob(
    input: HaulingJobCreateInput,
    registry: EntityRegistry,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateCreate(input, registry);
    if (!validation.ok) {
      return validation;
    }

    if ((this.active[input.jobId] ?? 0) === 1) {
      return { ok: false, reason: "hauling_job_already_active" };
    }

    const created = jobCore.createJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        jobKind: HAULING_JOB_KIND,
        targetId: input.destinationSlotId,
        initialStep: "reserve",
        interruptionPolicy: "immediate",
        requiredWorkQ16: 0,
        createdTick: input.createdTick,
      },
      registry,
    );

    if (!created.ok) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.active[input.jobId] = 1;
    this.ownerIndexes[input.jobId] = input.owner.index;
    this.ownerGenerations[input.jobId] = input.owner.generation;
    this.sourceSlotIds[input.jobId] = input.sourceSlotId;
    this.destinationSlotIds[input.jobId] = input.destinationSlotId;
    this.amounts[input.jobId] = input.amount;
    this.createdTicks[input.jobId] = input.createdTick;
    this.stepCodes[input.jobId] = HAUL_STEP_CREATED;
    this.carriedDefIds[input.jobId] = JOB_NONE;
    this.carriedAmounts[input.jobId] = 0;
    this.activeCount += 1;
    return this.finish(input.jobId);
  }

  reserveBeforePickup(
    jobId: number,
    tick: number,
    registry: EntityRegistry,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const context = this.readReservationContext(jobId, items, storage, ledger);
    if (!context.ok) {
      return context;
    }

    const acquired = ledger.acquire(
      {
        owner: this.readOwner(jobId),
        jobId,
        createdTick: tick,
        leaseExpiryTick: tick + 300,
        claims: [
          {
            channel: "item_quantity",
            item: context.sourceStack.entity,
            amount: context.amount,
            availableAmount: context.sourceStack.quantity,
          },
          {
            channel: "capacity",
            target: context.destination.storage,
            capacityId: context.destination.slotId,
            amount: context.amount,
            capacity: context.destination.capacity - context.destination.quantity,
          },
          {
            channel: "interaction_spot",
            target: context.sourceStack.entity,
            spotId: context.source.interactionCellIndex,
          },
          {
            channel: "interaction_spot",
            target: context.destination.storage,
            spotId: context.destination.interactionCellIndex,
          },
        ],
      },
      registry,
    );

    if (!acquired.ok) {
      return { ok: false, reason: acquired.reason };
    }

    const entered = jobCore.enterStep(jobId, "path_to_source", tick);
    if (!entered.ok) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.stepCodes[jobId] = HAUL_STEP_RESERVED;
    storage.markSlotDirty(context.source.slotId);
    storage.markSlotDirty(context.destination.slotId);
    return this.finish(jobId);
  }

  pickup(
    jobId: number,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateStep(jobId, HAUL_STEP_RESERVED);
    if (!validation.ok) {
      return validation;
    }

    const source = storage.readSlot(this.sourceSlotIds[jobId] ?? 0);
    if (source === undefined) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    if (!isSafeUint32(tick)) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    const removed = items.removeQuantity(source.stackId, this.amounts[jobId] ?? 0, source.defId);
    if (!removed.ok) {
      return { ok: false, reason: "hauling_item_mutation_failed" };
    }

    const carried = jobCore.setCarriedState(jobId, source.defId, this.amounts[jobId] ?? 0);
    if (!carried.ok) {
      const restored = items.addQuantity(source.stackId, this.amounts[jobId] ?? 0, source.defId);
      if (!restored.ok) {
        throw new Error(`failed to rollback pickup quantity: ${restored.reason}`);
      }
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    const entered = jobCore.enterStep(jobId, "interact", tick);
    if (!entered.ok) {
      const restored = items.addQuantity(source.stackId, this.amounts[jobId] ?? 0, source.defId);
      if (!restored.ok) {
        throw new Error(`failed to rollback pickup quantity: ${restored.reason}`);
      }
      const cleared = jobCore.setCarriedState(jobId, JOB_NONE, 0);
      if (!cleared.ok) {
        throw new Error(`failed to rollback pickup carried state: ${cleared.reason}`);
      }
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.carriedDefIds[jobId] = source.defId;
    this.carriedAmounts[jobId] = this.amounts[jobId] ?? 0;
    this.stepCodes[jobId] = HAUL_STEP_PICKED_UP;
    storage.markSlotDirty(source.slotId);
    return this.finish(jobId);
  }

  deliver(
    jobId: number,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateStep(jobId, HAUL_STEP_PICKED_UP);
    if (!validation.ok) {
      return validation;
    }

    const destination = storage.readSlot(this.destinationSlotIds[jobId] ?? 0);
    if (destination === undefined) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    if (!isSafeUint32(tick)) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    const added = items.addQuantity(
      destination.stackId,
      this.carriedAmounts[jobId] ?? 0,
      this.carriedDefIds[jobId] ?? 0,
    );
    if (!added.ok) {
      return { ok: false, reason: "hauling_item_mutation_failed" };
    }

    const completed = jobCore.completeJob(jobId, tick, ledger);
    if (!completed.ok) {
      const removed = items.removeQuantity(
        destination.stackId,
        this.carriedAmounts[jobId] ?? 0,
        this.carriedDefIds[jobId] ?? 0,
      );
      if (!removed.ok) {
        throw new Error(`failed to rollback delivery quantity: ${removed.reason}`);
      }
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
    this.stepCodes[jobId] = HAUL_STEP_DELIVERED;
    storage.markSlotDirty(destination.slotId);
    return this.finish(jobId);
  }

  cancel(
    jobId: number,
    tick: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
    jobCore: JobCoreStore,
  ): HaulingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }

    if ((this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED) === HAUL_STEP_PICKED_UP) {
      const source = storage.readSlot(this.sourceSlotIds[jobId] ?? 0);
      if (source === undefined) {
        return { ok: false, reason: "hauling_slot_invalid" };
      }

      const returned = items.addQuantity(
        source.stackId,
        this.carriedAmounts[jobId] ?? 0,
        this.carriedDefIds[jobId] ?? 0,
      );
      if (!returned.ok) {
        return { ok: false, reason: "hauling_item_mutation_failed" };
      }

      storage.markSlotDirty(source.slotId);
    }

    const canceled = jobCore.cancelJob(jobId, tick, ledger);
    if (!canceled.ok) {
      return { ok: false, reason: "hauling_job_core_failed" };
    }

    this.carriedDefIds[jobId] = JOB_NONE;
    this.carriedAmounts[jobId] = 0;
    this.stepCodes[jobId] = HAUL_STEP_CANCELED;
    storage.markSlotDirty(this.destinationSlotIds[jobId] ?? 0);
    return this.finish(jobId);
  }

  readJob(jobId: number): HaulingJobView | undefined {
    if (!this.isActiveJob(jobId)) {
      return undefined;
    }

    return {
      jobId,
      owner: this.readOwner(jobId),
      sourceSlotId: this.sourceSlotIds[jobId] ?? 0,
      destinationSlotId: this.destinationSlotIds[jobId] ?? 0,
      amount: this.amounts[jobId] ?? 0,
      createdTick: this.createdTicks[jobId] ?? 0,
      step: decodeStep(this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED),
      carriedDefId: this.carriedDefIds[jobId] ?? JOB_NONE,
      carriedAmount: this.carriedAmounts[jobId] ?? 0,
    };
  }

  createMetrics(): HaulingMetrics {
    let reservedCount = 0;
    let pickedUpCount = 0;
    let deliveredCount = 0;
    let canceledCount = 0;

    for (let jobId = 0; jobId < this.capacity; jobId += 1) {
      if ((this.active[jobId] ?? 0) === 1) {
        const step = this.stepCodes[jobId] ?? 0;
        reservedCount += step === HAUL_STEP_RESERVED ? 1 : 0;
        pickedUpCount += step === HAUL_STEP_PICKED_UP ? 1 : 0;
        deliveredCount += step === HAUL_STEP_DELIVERED ? 1 : 0;
        canceledCount += step === HAUL_STEP_CANCELED ? 1 : 0;
      }
    }

    return {
      version: this.storeVersion,
      activeCount: this.activeCount,
      reservedCount,
      pickedUpCount,
      deliveredCount,
      canceledCount,
    };
  }

  private readReservationContext(
    jobId: number,
    items: ItemStackStore,
    storage: StorageLogisticsIndex,
    ledger: ReservationLedger,
  ):
    | {
        readonly ok: true;
        readonly amount: number;
        readonly source: NonNullable<ReturnType<StorageLogisticsIndex["readSlot"]>>;
        readonly destination: NonNullable<ReturnType<StorageLogisticsIndex["readSlot"]>>;
        readonly sourceStack: NonNullable<ReturnType<ItemStackStore["readStack"]>>;
      }
    | { readonly ok: false; readonly reason: HaulingReason } {
    const validation = this.validateStep(jobId, HAUL_STEP_CREATED);
    if (!validation.ok) {
      return validation;
    }

    const amount = this.amounts[jobId] ?? 0;
    const source = storage.readSlot(this.sourceSlotIds[jobId] ?? 0);
    const destination = storage.readSlot(this.destinationSlotIds[jobId] ?? 0);
    if (source === undefined || destination === undefined) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    if (source.defId !== destination.defId) {
      return { ok: false, reason: "hauling_def_mismatch" };
    }

    const sourceStack = items.readStack(source.stackId, ledger);
    if (sourceStack === undefined || amount > sourceStack.availableQuantity) {
      return { ok: false, reason: "hauling_source_unavailable" };
    }

    if (amount > destination.availableCapacity) {
      return { ok: false, reason: "hauling_destination_unavailable" };
    }

    return { ok: true, amount, source, destination, sourceStack };
  }

  private validateCreate(
    input: HaulingJobCreateInput,
    registry: EntityRegistry,
  ): HaulingMutationResult {
    if (!isIndexInRange(input.jobId, this.capacity)) {
      return { ok: false, reason: "hauling_job_id_out_of_range" };
    }

    if (!registry.isAlive(input.owner)) {
      return { ok: false, reason: "hauling_owner_invalid" };
    }

    if (!isSafeUint32(input.sourceSlotId) || !isSafeUint32(input.destinationSlotId)) {
      return { ok: false, reason: "hauling_slot_invalid" };
    }

    if (!isPositiveUint32(input.amount) || !isSafeUint32(input.createdTick)) {
      return { ok: false, reason: "hauling_amount_invalid" };
    }

    return { ok: true, jobId: input.jobId, version: this.storeVersion };
  }

  private validateStep(jobId: number, expectedStep: number): HaulingMutationResult {
    const validation = this.validateActive(jobId);
    if (!validation.ok) {
      return validation;
    }

    if ((this.stepCodes[jobId] ?? HAUL_STEP_UNASSIGNED) !== expectedStep) {
      return { ok: false, reason: "hauling_step_invalid" };
    }

    return { ok: true, jobId, version: this.storeVersion };
  }

  private validateActive(jobId: number): HaulingMutationResult {
    if (!this.isActiveJob(jobId)) {
      return { ok: false, reason: "hauling_job_not_active" };
    }

    return { ok: true, jobId, version: this.storeVersion };
  }

  private isActiveJob(jobId: number): boolean {
    return isIndexInRange(jobId, this.capacity) && (this.active[jobId] ?? 0) === 1;
  }

  private readOwner(jobId: number): EntityId {
    return {
      index: this.ownerIndexes[jobId] ?? 0,
      generation: this.ownerGenerations[jobId] ?? 0,
    };
  }

  private finish(jobId: number): HaulingMutationResult {
    this.storeVersion += 1;
    return { ok: true, jobId, version: this.storeVersion };
  }
}

export function createHaulingJobStore(capacity: number): HaulingJobStore {
  return new HaulingJobStore(capacity);
}

function decodeStep(code: number): HaulingStep {
  if (code === HAUL_STEP_CREATED) {
    return "created";
  }
  if (code === HAUL_STEP_RESERVED) {
    return "reserved";
  }
  if (code === HAUL_STEP_PICKED_UP) {
    return "picked_up";
  }
  if (code === HAUL_STEP_DELIVERED) {
    return "delivered";
  }
  if (code === HAUL_STEP_CANCELED) {
    return "canceled";
  }
  return "unassigned";
}

function isIndexInRange(value: number, upperBound: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < upperBound;
}

function isSafeUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isPositiveUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
}
